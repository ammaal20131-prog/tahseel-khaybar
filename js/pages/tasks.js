// متطلباتي (للمعلمة): ما المطلوب، ما رُفع، وما يحتاج استكمالاً
import { App, q, catOf } from '../api.js';
import { esc, icon, reqChip, fmtNum, emptyState, progressBar, pctClass, todayISO } from '../ui.js';
import { pageHead, catIcon, folderLink } from './_common.js';
import { openUploadDialog } from '../upload.js';
import { rerender } from '../main.js';

export default async function tasks(view) {
  const reqs = await q.reqStatus(App.user.id);
  const returned = await q.files({ teacher: App.user.id, status: 'needs_completion' });
  const total = reqs.length, sub = reqs.filter((r) => r.state !== 'missing').length;
  const p = total ? Math.round((100 * sub) / total) : 0;
  const today = todayISO();
  const groups = App.categories.map((c) => ({ c, items: reqs.filter((r) => r.category_key === c.key) })).filter((g) => g.items.length);

  view.innerHTML = `
    ${pageHead('متطلباتي', 'الملفات المطلوبة منكِ لملف لجنة التحصيل الدراسي، وحالة كل منها.')}
    <div class="card" style="margin-bottom:16px">
      <div class="row between"><b>نسبة إنجاز متطلباتي</b><span class="num">${fmtNum(sub)} / ${fmtNum(total)}</span></div>
      <div style="margin-top:8px">${progressBar(p, pctClass(p))}</div>
    </div>
    ${returned.length ? `<div class="alert bad" style="margin-bottom:16px">${icon('undo-2')}<div><b>ملفات أُعيدت لكِ لاستكمال النواقص:</b>
      <ul style="margin:6px 0 0;padding-inline-start:18px">${returned.map((f) => `<li><a href="#/file/${f.id}">${esc(f.name)}</a>${f.status_reason ? ' — ' + esc(f.status_reason) : ''}</li>`).join('')}</ul></div></div>` : ''}
    ${groups.length ? groups.map(({ c, items }) => `<div class="card">
      <div class="card-head"><h3>${icon(catIcon(c.key))} ${esc(c.title)}</h3><a class="btn sm ghost" href="${folderLink(c.key, App.user.id)}">${icon('folder-open')} فتح المجلد</a></div>
      <div class="table-wrap"><table><thead><tr><th>المتطلب</th><th>الموعد النهائي</th><th>الملفات</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${items.map((r) => `<tr>
        <td><b>${esc(r.title)}</b></td>
        <td class="num ${r.state === 'missing' && r.due_date && r.due_date < today ? '' : ''}">${r.due_date ? `${esc(r.due_date)}${r.state === 'missing' && r.due_date < today ? ' <span class="chip bad">متأخر</span>' : ''}` : '—'}</td>
        <td class="num">${fmtNum(r.files_count)}</td>
        <td>${reqChip(r.state)}</td>
        <td class="actions">${r.state !== 'complete' ? `<button class="btn sm primary" data-up="${r.requirement_id}" data-cat="${r.category_key}">${icon('upload')} رفع</button>` : icon('badge-check')}</td>
      </tr>`).join('')}</tbody></table></div></div>`).join('') : `<div class="card">${emptyState('لا توجد متطلبات محددة لكِ حالياً', 'list-checks')}</div>`}`;

  view.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () =>
    openUploadDialog({ category: b.dataset.cat, teacherId: App.user.id, requirementId: b.dataset.up, onDone: () => setTimeout(rerender, 400) })));
}
