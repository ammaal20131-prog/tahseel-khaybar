// تجهيز قائمة المزامنة مع OneDrive (تستخدمها مهمة المزامنة المجدولة)
// تُنشئ ملفاً مؤقتاً فيه مسار كل ملف بترتيب مجلدات OneDrive ورابط تنزيل مؤقت، وتعيد رابطاً واحداً له.
import { App, q, sb } from './api.js';

const clean = (s) => String(s || '').replace(/[‎‏⁦-⁩‪-‮]/g, '')
  .replace(/[\\:*?"<>|#%]/g, '-').replace(/\s+/g, ' ').trim();

export async function buildSyncManifest({ hours = 6 } = {}) {
  if (!App.isStaff) throw new Error('المزامنة للمديرة واللجنة فقط');
  const files = await q.files({ limit: 10000 });
  const people = Object.fromEntries((await q.teachers()).map((p) => [p.id, p.full_name]));
  const cats = Object.fromEntries(App.categories.map((c) => [c.key, c]));
  const used = new Set();
  const items = files.map((f) => {
    const c = cats[f.category_key] || { title: f.category_key, sort: 99, per_teacher: false };
    const catDir = clean(`${c.sort}- ${c.title}`);
    const base = f.teacher_id && c.per_teacher
      ? `مجلدات المعلمات/${clean(people[f.teacher_id] || 'معلمة')}/${catDir}`
      : `مجلدات اللجنة المشتركة/${catDir}${f.teacher_id ? '/' + clean(people[f.teacher_id] || '') : ''}`;
    const dir = [base, ...String(f.folder_path || '').split('/').map(clean).filter(Boolean)].join('/');
    const name = clean(f.name) || f.id;
    let path = `${dir}/${name}`;
    for (let k = 2; used.has(path); k++) path = `${dir}/${name.replace(/(\.[^.]+)?$/, ` (${k})$1`)}`;
    used.add(path);
    return { path, sp: f.storage_path, size: f.size_bytes };
  });
  const exp = hours * 3600;
  if (items.length) {
    const { data, error } = await sb.storage.from('files').createSignedUrls(items.map((i) => i.sp), exp);
    if (error) throw error;
    items.forEach((it, i) => { it.url = data[i]?.signedUrl; delete it.sp; });
  }
  const year = String(App.settings?.academic_year || '').replace(/هـ$/, '');
  const manifest = { root: `ملف لجنة التحصيل الدراسي ${year}`.trim(), created: new Date().toISOString(), items };
  const path = 'general/_sync/manifest.txt';
  const { error: upErr } = await sb.storage.from('files').upload(path, new Blob([JSON.stringify(manifest)], { type: 'text/plain' }), { upsert: true, contentType: 'text/plain' });
  if (upErr) throw upErr;
  const { data: s, error: sErr } = await sb.storage.from('files').createSignedUrl(path, exp);
  if (sErr) throw sErr;
  return { url: s.signedUrl, count: items.length };
}
