// قائمة المراجعة والاعتماد
import { App, sb, q, catOf, teacherNameMap } from '../api.js';
import { esc, icon, fmtNum, timeAgo, statusChip, fileIcon, emptyState, STATUS, toast, errMsg, confirmBox, refreshIcons } from '../ui.js';
import { pageHead } from './_common.js';
import { rerender, updateBadges } from '../main.js';

export default async function review(view, params, query) {
  const status = query.status || 'queue';
  const statuses = status === 'queue' ? ['read_ok', 'needs_review', 'failed', 'unprocessed'] : [status];
  const [files, people] = await Promise.all([q.files({ status: statuses, limit: 500 }), q.teachers()]);
  const names = teacherNameMap(people);
  const ans = await q.analyses(files.map((f) => f.id));
  const anBy = Object.fromEntries(ans.map((a) => [a.file_id, a]));
  const tabs = [['queue', 'بانتظار المراجعة'], ['needs_completion', 'معادة للاستكمال'], ['approved', 'معتمدة'], ['failed', 'تعذرت قراءتها']];

  view.innerHTML = `
    ${pageHead('المراجعة والاعتماد', 'راجعي نتائج القراءة الآلية مقابل الملف الأصلي، ثم اعتمدي الملف أو أعيديه للمعلمة مع النواقص.')}
    <div class="tabs">${tabs.map(([k, l]) => `<button class="${k === status ? 'on' : ''}" data-tab="${k}">${esc(l)}</button>`).join('')}</div>
    <div class="card">
      <div class="filters" style="margin-bottom:12px">
        <input type="search" placeholder="بحث" data-f>
        <select data-cat><option value="">كل المجلدات</option>${App.categories.map((c) => `<option value="${c.key}">${esc(c.title)}</option>`).join('')}</select>
        <select data-t><option value="">كل المعلمات</option>${people.filter((p) => p.is_teacher).map((p) => `<option value="${p.id}">${esc(p.full_name)}</option>`).join('')}</select>
        ${App.isAdmin && status === 'queue' ? `<button class="btn sm" data-bulk disabled>${icon('badge-check')} اعتماد المحدد</button>` : ''}
      </div>
      <div data-list></div>
    </div>`;
  view.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { location.hash = '#/review' + (b.dataset.tab === 'queue' ? '' : '?status=' + b.dataset.tab); }));

  const paint = () => {
    const f = view.querySelector('[data-f]').value.trim();
    const c = view.querySelector('[data-cat]').value;
    const t = view.querySelector('[data-t]').value;
    const list = files.filter((x) => (!f || x.name.includes(f) || (names[x.teacher_id] || '').includes(f)) && (!c || x.category_key === c) && (!t || x.teacher_id === t));
    view.querySelector('[data-list]').innerHTML = list.length ? `<div class="table-wrap"><table><thead><tr>
      ${App.isAdmin && status === 'queue' ? '<th><input type="checkbox" data-all aria-label="تحديد الكل"></th>' : ''}
      <th>الملف</th><th>المعلمة</th><th>المجلد</th><th>نتيجة القراءة</th><th>الحالة</th><th>رُفع</th><th></th></tr></thead><tbody>
      ${list.map((x) => { const a = anBy[x.id]; const el = a?.elements || []; const ok = el.filter((e) => e.status === 'present').length;
        return `<tr>
        ${App.isAdmin && status === 'queue' ? `<td><input type="checkbox" data-sel="${x.id}" ${x.status === 'read_ok' ? '' : ''}></td>` : ''}
        <td><a class="file-name" href="#/file/${x.id}">${icon(fileIcon(x.name))}${esc(x.name)}</a></td>
        <td>${esc(names[x.teacher_id] || 'عام')}</td><td class="muted">${esc(catOf(x.category_key).title)}</td>
        <td style="font-size:.82rem">${a ? (a.error ? `<span class="muted">${esc(a.error.slice(0, 70))}</span>` : `${esc(a.doc_type_label || '')}${el.length ? ` · العناصر ${ok}/${el.length}` : ''}`) : '<span class="muted">لم يُحلل</span>'}</td>
        <td>${statusChip(x.status)}</td><td class="muted">${timeAgo(x.created_at)}</td>
        <td class="actions"><a class="btn sm primary" href="#/file/${x.id}">${icon('clipboard-check')} مراجعة</a></td></tr>`; }).join('')}
      </tbody></table></div>` : emptyState('لا توجد ملفات في هذه القائمة', 'check-check');
    refreshIcons();
    const bulk = view.querySelector('[data-bulk]');
    const sync = () => { if (bulk) bulk.disabled = !view.querySelectorAll('[data-sel]:checked').length; };
    view.querySelectorAll('[data-sel]').forEach((c) => c.addEventListener('change', sync));
    view.querySelector('[data-all]')?.addEventListener('change', (e) => { view.querySelectorAll('[data-sel]').forEach((c) => (c.checked = e.target.checked)); sync(); });
  };
  ['[data-f]', '[data-cat]', '[data-t]'].forEach((s) => view.querySelector(s).addEventListener(s === '[data-f]' ? 'input' : 'change', paint));
  view.querySelector('[data-bulk]')?.addEventListener('click', async () => {
    const ids = [...view.querySelectorAll('[data-sel]:checked')].map((c) => c.dataset.sel);
    if (!(await confirmBox(`اعتماد ${ids.length} ملف؟ تأكدي أنك راجعتِ كلاً منها.`, { ok: 'اعتماد' }))) return;
    let ok = 0;
    for (const id of ids) { const { error } = await sb.rpc('review_file', { p_file: id, p_decision: 'approve', p_note: 'اعتماد جماعي' }); if (!error) ok++; }
    toast(`تم اعتماد ${ok} ملف`, 'ok'); updateBadges(); rerender();
  });
  paint();
}
