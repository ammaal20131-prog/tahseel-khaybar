// الاتصال بقاعدة البيانات والتخزين والوظائف (Supabase)
const cfg = window.TAHSEEL_CONFIG || {};
// النسخة التجريبية (DEMO) تعمل ببيانات وهمية داخل المتصفح للمعاينة فقط
export const DEMO = !!cfg.DEMO;
const { createClient } = DEMO
  ? await import('./demo/mock.js')
  : await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
export const configured = DEMO || (!!cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR-PROJECT') && !!cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes('YOUR-'));
export const sb = configured ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'tahseel-auth' },
}) : null;
const DOMAIN = cfg.LOGIN_EMAIL_DOMAIN || 'khaybar-tahseel.com';

// الحالة العامة للتطبيق
export const App = {
  user: null, profile: null, settings: null, categories: [], subjects: [], grades: [],
  isStaff: false, isAdmin: false, ai: { ai_ready: false }, logoUrl: 'assets/moe-logo.png', unread: 0,
};

const must = ({ data, error }) => { if (error) throw error; return data; };
// جلب كل الصفوف على دفعات (حد Supabase الافتراضي 1000 صف)
async function fetchAll(make, size = 1000) {
  const out = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await make().range(from, from + size - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < size) return out;
  }
}

// ---------------- الدخول ----------------
export async function login(username, password) {
  const email = `${String(username).trim().toLowerCase()}@${DOMAIN}`;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    if (/Invalid login credentials/i.test(error.message)) throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
    if (/banned|disabled/i.test(error.message)) throw new Error('هذا الحساب موقوف. تواصلي مع إدارة المدرسة');
    throw error;
  }
  await sb.rpc('touch_login');
}
export const logout = () => sb.auth.signOut();
export async function currentUser() {
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}

export async function loadPublicSettings() {
  const { data } = await sb.from('settings').select('*').eq('id', 1).maybeSingle();
  App.settings = data || App.settings || {};
  if (App.settings?.logo_path) App.logoUrl = sb.storage.from('branding').getPublicUrl(App.settings.logo_path).data.publicUrl;
  return App.settings;
}

export async function loadContext() {
  App.user = await currentUser();
  if (!App.user) return null;
  const [p, s, c, sub, g] = await Promise.all([
    sb.from('profiles').select('*').eq('id', App.user.id).maybeSingle(),
    loadPublicSettings(),
    sb.from('categories').select('*').order('sort'),
    sb.from('subjects').select('*').order('name'),
    sb.from('grades').select('*').order('sort'),
  ]);
  App.profile = p.data;
  if (!App.profile) return null;
  App.categories = c.data || [];
  App.subjects = sub.data || [];
  App.grades = g.data || [];
  App.isAdmin = ['principal', 'chair'].includes(App.profile.role);
  App.isStaff = App.isAdmin || App.profile.role === 'committee';
  fn('ai', { action: 'config' }).then((r) => { App.ai = r; }).catch(() => { App.ai = { ai_ready: false }; });
  return App.profile;
}

export const catOf = (key) => App.categories.find((c) => c.key === key) || { key, title: key };
export const subjectName = (id) => App.subjects.find((s) => s.id === id)?.name || '';
export const gradeName = (id) => App.grades.find((s) => s.id === id)?.name || '';

// ---------------- الوظائف على الخادم ----------------
export async function fn(name, body) {
  const { data, error } = await sb.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch (e) { /* ignore */ }
    if (/Failed to send a request|FunctionsFetchError/i.test(msg)) msg = `تعذر الوصول إلى وظيفة الخادم "${name}". تأكدي من نشرها في Supabase.`;
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// ---------------- البيانات ----------------
export const q = {
  // تُحسب الإحصاءات في المتصفح من استعلامات خفيفة بدل دالة dashboard_stats الثقيلة (كانت تتجاوز مهلة الخادم)
  stats: async () => {
    const [rs, files, an, profs, subs] = await Promise.all([
      q.reqStatusRaw(),
      fetchAll(() => sb.from('files').select('id, status, category_key, teacher_id')),
      fetchAll(() => sb.from('file_analyses').select('file_id').is('error', null)),
      fetchAll(() => sb.from('profiles').select('id, is_teacher, active')),
      sb.from('subjects').select('id', { count: 'exact', head: true }),
    ]);
    const cnt = (arr, f) => arr.filter(f).length;
    const byT = {};
    rs.forEach((r) => { const t = (byT[r.teacher_id] ||= { req: 0, miss: 0 }); t.req++; if (r.state === 'missing') t.miss++; });
    return {
      teachers: cnt(profs, (p) => p.is_teacher && p.active),
      subjects: subs.count || 0,
      files: files.length,
      analyzed: new Set(an.map((a) => a.file_id)).size,
      complete: cnt(files, (f) => f.status === 'approved'),
      incomplete: cnt(files, (f) => ['needs_completion', 'failed'].includes(f.status)),
      to_review: cnt(files, (f) => ['read_ok', 'needs_review'].includes(f.status)),
      req_total: rs.length,
      req_submitted: cnt(rs, (r) => r.state !== 'missing'),
      req_complete: cnt(rs, (r) => r.state === 'complete'),
      teachers_committed: Object.values(byT).filter((t) => t.req > 0 && t.miss === 0).length,
      teachers_with_reqs: Object.values(byT).filter((t) => t.req > 0).length,
      by_category: [...App.categories].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)).map((c) => ({
        key: c.key, title: c.title, sort: c.sort,
        required: cnt(rs, (r) => r.category_key === c.key),
        submitted: cnt(rs, (r) => r.category_key === c.key && r.state !== 'missing'),
        complete: cnt(rs, (r) => r.category_key === c.key && r.state === 'complete'),
        files: cnt(files, (f) => f.category_key === c.key),
      })),
    };
  },
  reqStatusRaw: async () => fetchAll(() => sb.from('requirement_status').select('teacher_id, requirement_id, category_key, state')),
  progress: async () => {
    const [profs, rs, files] = await Promise.all([
      fetchAll(() => sb.from('profiles').select('id, full_name, username, active, last_login_at, last_upload_at, role, is_teacher')),
      q.reqStatusRaw(),
      fetchAll(() => sb.from('files').select('teacher_id, status')),
    ]);
    return profs.filter((p) => p.is_teacher).map((p) => {
      const r = rs.filter((x) => x.teacher_id === p.id), f = files.filter((x) => x.teacher_id === p.id);
      const required = r.length, submitted = r.filter((x) => x.state !== 'missing').length, complete = r.filter((x) => x.state === 'complete').length;
      return { teacher_id: p.id, full_name: p.full_name, username: p.username, active: p.active, last_login_at: p.last_login_at, last_upload_at: p.last_upload_at, role: p.role,
        required, submitted, complete, missing: required - submitted, returned: r.filter((x) => x.state === 'incomplete').length,
        files: f.length, to_review: f.filter((x) => ['read_ok', 'needs_review'].includes(x.status)).length,
        submit_pct: required ? Math.round((100 * submitted) / required) : 0, complete_pct: required ? Math.round((100 * complete) / required) : 0 };
    }).sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'));
  },
  reqStatus: async (teacherId) => {
    let qq = sb.from('requirement_status').select('*');
    if (teacherId) qq = qq.eq('teacher_id', teacherId);
    return must(await qq.order('due_date', { ascending: true, nullsFirst: false }));
  },
  teachers: async () => must(await sb.from('profiles').select('*').order('full_name')),
  teacher: async (id) => must(await sb.from('profiles').select('*').eq('id', id).maybeSingle()),
  assignments: async (teacherId) => {
    let qq = sb.from('teacher_assignments').select('*');
    if (teacherId) qq = qq.eq('teacher_id', teacherId);
    return must(await qq);
  },
  files: async (filter = {}) => {
    let qq = sb.from('files').select('*');
    if (filter.category) qq = qq.eq('category_key', filter.category);
    if (filter.teacher === null) qq = qq.is('teacher_id', null);
    else if (filter.teacher) qq = qq.eq('teacher_id', filter.teacher);
    if (filter.status) qq = Array.isArray(filter.status) ? qq.in('status', filter.status) : qq.eq('status', filter.status);
    if (filter.requirement) qq = qq.eq('requirement_id', filter.requirement);
    if (filter.ids) qq = qq.in('id', filter.ids);
    qq = qq.order(filter.order || 'created_at', { ascending: false });
    if (filter.limit) qq = qq.limit(filter.limit);
    return must(await qq);
  },
  file: async (id) => must(await sb.from('files').select('*').eq('id', id).maybeSingle()),
  analysis: async (fileId) => must(await sb.from('file_analyses').select('*').eq('file_id', fileId).eq('is_latest', true).maybeSingle()),
  analyses: async (fileIds) => fileIds.length ? must(await sb.from('file_analyses').select('*').in('file_id', fileIds).eq('is_latest', true)) : [],
  latestAnalyses: async (limit = 10) => must(await sb.from('file_analyses').select('id, file_id, doc_type_label, summary, created_at, error').eq('is_latest', true).order('created_at', { ascending: false }).limit(limit)),
  notes: async (fileId) => must(await sb.from('file_notes').select('*').eq('file_id', fileId).order('created_at', { ascending: false })),
  folders: async (category, teacher) => {
    let qq = sb.from('folders').select('*').eq('category_key', category);
    qq = teacher ? qq.eq('teacher_id', teacher) : qq.is('teacher_id', null);
    return must(await qq);
  },
  requirements: async () => must(await sb.from('requirements').select('*').order('category_key').order('sort')),
  notifications: async (limit = 50) => must(await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit)),
  unreadCount: async () => {
    const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
    return count || 0;
  },
  reports: async () => must(await sb.from('reports').select('id, kind, title, approved, created_at, created_by, teacher_id').order('created_at', { ascending: false })),
  report: async (id) => must(await sb.from('reports').select('*').eq('id', id).maybeSingle()),
  audit: async (limit = 200, before) => {
    let qq = sb.from('audit_log').select('*').order('at', { ascending: false }).limit(limit);
    if (before) qq = qq.lt('at', before);
    return must(await qq);
  },
  search: async (text) => must(await sb.rpc('search_files', { q: text, lim: 60 })),
};

export async function signedUrl(path, download = false, filename) {
  const { data, error } = await sb.storage.from('files').createSignedUrl(path, 60 * 10, download ? { download: filename || true } : undefined);
  if (error) throw error;
  return data.signedUrl;
}
export async function downloadFileBlob(path) {
  const { data, error } = await sb.storage.from('files').download(path);
  if (error) throw error;
  return data;
}

export async function refreshUnread() {
  try { App.unread = await q.unreadCount(); } catch (e) { App.unread = 0; }
  const dot = document.getElementById('notif-dot');
  if (dot) { dot.textContent = App.unread > 99 ? '99+' : App.unread; dot.hidden = !App.unread; }
  return App.unread;
}

export function teacherNameMap(list) {
  const m = {}; (list || []).forEach((t) => { m[t.id] = t.full_name; }); return m;
}
