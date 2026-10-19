// البحث: المعلمات، المواد، أنواع الملفات، الحالات، ومحتوى المستندات المستخرج
import { App, q, catOf, subjectName, gradeName, teacherNameMap } from '../api.js';
import { esc, icon, statusChip, fileIcon, emptyState, timeAgo, STATUS, refreshIcons } from '../ui.js';
import { pageHead } from './_common.js';

export default async function search(view, params, query) {
  const text = (query.q || '').trim();
  view.innerHTML = `
    ${pageHead('البحث', 'ابحثي باسم المعلمة أو المادة أو الصف أو نوع الخطة أو حالة الملف أو أي كلمة داخل المستندات المقروءة.')}
    <form class="card row" data-f style="margin-bottom:16px">
      <input type="search" name="q" value="${esc(text)}" placeholder="مثال: الخطة العلاجية الرياضيات، مهارة الكسور، يحتاج إلى مراجعة…" style="flex:1;min-width:220px">
      <select name="cat"><option value="">كل المجلدات</option>${App.categories.map((c) => `<option value="${c.key}" ${query.cat === c.key ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select>
      <select name="st"><option value="">كل الحالات</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${query.st === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select>
      <button class="btn primary">${icon('search')} بحث</button>
    </form>
    <div data-res></div>`;
  const form = view.querySelector('[data-f]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    ['q', 'cat', 'st'].forEach((k) => form[k].value && p.set(k, form[k].value));
    location.hash = '#/search?' + p.toString();
  });
  const res = view.querySelector('[data-res]');
  if (!text && !query.cat && !query.st) { res.innerHTML = emptyState('اكتبي كلمة للبحث', 'search'); refreshIcons(); return; }

  const [people, files] = await Promise.all([App.isStaff ? q.teachers() : Promise.resolve([App.profile]), q.files({ category: query.cat || undefined, status: query.st || undefined, limit: 2000 })]);
  const names = teacherNameMap(people);
  const t = text.toLowerCase();
  const statusHit = Object.entries(STATUS).filter(([, v]) => text && v.label.includes(text)).map(([k]) => k);
  const subjHit = App.subjects.filter((s) => text && (s.name.includes(text) || text.includes(s.name))).map((s) => s.id);
  const gradeHit = App.grades.filter((s) => text && (s.name.includes(text) || text.includes(s.name.replace('المتوسط', '').trim()))).map((s) => s.id);
  const catHit = App.categories.filter((c) => text && (c.title.includes(text) || text.includes(c.title))).map((c) => c.key);

  const meta = files.filter((f) => !text ||
    f.name.toLowerCase().includes(t) || (names[f.teacher_id] || '').includes(text) || (f.folder_path || '').includes(text) ||
    statusHit.includes(f.status) || subjHit.includes(f.subject_id) || gradeHit.includes(f.grade_id) || catHit.includes(f.category_key) ||
    (f.semester || '').includes(text) || (f.doc_type || '').includes(t));
  let content = [];
  if (text) {
    try { content = await q.search(text); } catch (e) { content = []; }
    if (query.cat) content = content.filter((c) => c.category_key === query.cat);
    if (query.st) content = content.filter((c) => c.status === query.st);
  }
  const teacherHits = App.isStaff && text ? people.filter((p) => p.full_name.includes(text) || p.username.includes(t)) : [];
  const seen = new Set(meta.map((f) => f.id));
  const contentOnly = content.filter((c) => !seen.has(c.file_id));

  res.innerHTML = `
    ${teacherHits.length ? `<div class="card"><h3>${icon('users')} معلمات</h3><div class="sub-folders">${teacherHits.map((p) => `<a class="sub-folder" href="#/teacher/${p.id}">${icon('user')}<div><div class="sn">${esc(p.full_name)}</div><div class="sm" dir="ltr">${esc(p.username)}</div></div></a>`).join('')}</div></div>` : ''}
    <div class="card"><h3>${icon('files')} ملفات مطابقة <span class="chip">${meta.length}</span></h3>
      ${meta.length ? table(meta.slice(0, 200), names) : emptyState('لا توجد ملفات مطابقة في البيانات الوصفية', 'file-search')}</div>
    ${text ? `<div class="card"><h3>${icon('scan-text')} نتائج داخل محتوى المستندات <span class="chip">${content.length}</span></h3>
      ${content.length ? `<div class="list">${content.map((c) => `<a class="list-item" href="#/file/${c.file_id}" style="color:inherit;text-decoration:none">
        <div class="li-ic">${icon(fileIcon(c.name))}</div><div class="li-main"><div class="li-t">${esc(c.name)}</div>
        <div class="li-s" style="white-space:normal">${highlight(c.snippet, text)}</div><div class="li-s">${esc(names[c.teacher_id] || 'عام')} · ${esc(catOf(c.category_key).title)}</div></div>${statusChip(c.status)}</a>`).join('')}</div>`
        : emptyState('لا نتائج في محتوى الملفات المقروءة. البحث في المحتوى يشمل الملفات التي قُرئت فقط.', 'scan-search')}</div>` : ''}`;
  refreshIcons();
}

function table(list, names) {
  return `<div class="table-wrap"><table><thead><tr><th>الملف</th><th>المعلمة</th><th>المجلد</th><th>المادة / الصف</th><th>الحالة</th><th>رُفع</th></tr></thead><tbody>
    ${list.map((f) => `<tr><td><a class="file-name" href="#/file/${f.id}">${icon(fileIcon(f.name))}${esc(f.name)}</a></td><td>${esc(names[f.teacher_id] || 'عام')}</td>
      <td class="muted">${esc(catOf(f.category_key).title)}</td><td class="muted">${esc([subjectName(f.subject_id), gradeName(f.grade_id)].filter(Boolean).join(' · ') || '—')}</td>
      <td>${statusChip(f.status)}</td><td class="muted">${timeAgo(f.created_at)}</td></tr>`).join('')}</tbody></table></div>`;
}
function highlight(s, t) {
  const e = esc(s || '');
  if (!t) return e;
  return e.split(esc(t)).join(`<mark>${esc(t)}</mark>`);
}
