// المتطلبات والمواعيد النهائية (تضيفها الإدارة لكل مجلد)
import { App, sb, q, catOf, teacherNameMap } from '../api.js';
import { esc, icon, emptyState, toast, modal, withBusy, errMsg, confirmBox, refreshIcons } from '../ui.js';
import { pageHead, catIcon } from './_common.js';
import { rerender } from '../main.js';

export default async function requirements(view) {
  const [reqs, people, status] = await Promise.all([q.requirements(), q.teachers(), q.reqStatus()]);
  const names = teacherNameMap(people);
  const counts = {};
  status.forEach((s) => { const c = (counts[s.requirement_id] ||= { t: 0, s: 0 }); c.t++; if (s.state !== 'missing') c.s++; });

  view.innerHTML = `
    ${pageHead('المتطلبات والمواعيد النهائية', 'ما يجب على كل معلمة رفعه في كل مجلد، مع الموعد النهائي والعناصر التي يتحقق منها الذكاء الاصطناعي.',
      App.isAdmin ? `<button class="btn primary" data-add>${icon('plus')} متطلب جديد</button>` : '')}
    ${App.categories.map((c) => {
      const list = reqs.filter((r) => r.category_key === c.key);
      return `<div class="card">
        <div class="card-head"><h3>${icon(catIcon(c.key))} ${esc(c.title)}</h3>${App.isAdmin ? `<button class="btn sm ghost" data-add-cat="${c.key}">${icon('plus')} إضافة</button>` : ''}</div>
        ${list.length ? `<div class="table-wrap"><table><thead><tr><th>المتطلب</th><th>يطبق على</th><th>الموعد النهائي</th><th>عناصر التحقق</th><th>الرفع</th><th></th></tr></thead><tbody>
        ${list.map((r) => `<tr style="${r.active ? '' : 'opacity:.5'}">
          <td><b>${esc(r.title)}</b>${r.description ? `<div class="muted" style="font-size:.78rem">${esc(r.description)}</div>` : ''}${r.active ? '' : ' <span class="chip">موقوف</span>'}</td>
          <td>${r.teacher_id ? esc(names[r.teacher_id] || '—') : 'جميع المعلمات'}</td>
          <td class="num">${esc(r.due_date || '—')}</td>
          <td class="muted" style="font-size:.78rem;max-width:280px">${(r.checklist || []).map(esc).join('، ') || '—'}</td>
          <td class="num">${counts[r.id] ? `${counts[r.id].s}/${counts[r.id].t}` : '—'}</td>
          <td class="actions">${App.isAdmin ? `<button class="btn sm ghost" data-edit="${r.id}">${icon('pencil')}</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>` : emptyState(c.per_teacher ? 'لا توجد متطلبات لهذا المجلد' : 'مجلد مشترك للجنة — تُرفع وثائقه من قبل اللجنة', 'list-todo')}
      </div>`;
    }).join('')}`;

  const open = (r, cat) => {
    const isNew = !r;
    const m = modal({
      title: isNew ? 'متطلب جديد' : 'تعديل المتطلب', wide: true,
      body: `<div class="form-grid">
        <label class="field">المجلد<select data-cat>${App.categories.map((c) => `<option value="${c.key}" ${(r?.category_key || cat) === c.key ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select></label>
        <label class="field">يطبق على<select data-t><option value="">جميع المعلمات</option>${people.filter((p) => p.is_teacher).map((p) => `<option value="${p.id}" ${r?.teacher_id === p.id ? 'selected' : ''}>${esc(p.full_name)}</option>`).join('')}</select></label>
        <label class="field">عنوان المتطلب<input data-title value="${esc(r?.title || '')}" placeholder="مثال: الخطة الأسبوعية — الأسبوع الخامس"></label>
        <label class="field">الموعد النهائي<input type="date" data-due value="${esc(r?.due_date || '')}"></label>
        <label class="field full">وصف مختصر<input data-desc value="${esc(r?.description || '')}"></label>
        <label class="field full">العناصر الأساسية التي يجب أن يحتويها الملف <span class="hint">عنصر في كل سطر — يقارن الذكاء الاصطناعي الملف بها</span>
          <textarea data-check rows="6">${esc((r?.checklist || []).join('\n'))}</textarea></label>
        ${!isNew ? `<label class="check full"><input type="checkbox" data-active ${r.active ? 'checked' : ''}> متطلب فعّال (يُحسب في نسبة الإنجاز)</label>` : ''}
        ${isNew ? `<p class="full muted" style="font-size:.82rem">${icon('bell')} سيصل تنبيه بالمتطلب الجديد للمعلمات المعنيات فور الحفظ.</p>` : ''}
      </div>`,
      footer: `<button class="btn primary" data-save>${icon('save')} حفظ</button>${!isNew ? `<button class="btn danger" data-del>${icon('trash-2')} حذف</button>` : ''}<button class="btn ghost" data-close>إلغاء</button>`,
    });
    m.$('[data-save]').addEventListener('click', async (e) => {
      await withBusy(e.currentTarget, async () => {
        const row = {
          category_key: m.$('[data-cat]').value, teacher_id: m.$('[data-t]').value || null,
          title: m.$('[data-title]').value.trim(), due_date: m.$('[data-due]').value || null,
          description: m.$('[data-desc]').value.trim() || null,
          checklist: m.$('[data-check]').value.split('\n').map((s) => s.trim()).filter(Boolean),
        };
        if (!row.title) return toast('اكتبي عنوان المتطلب', 'warn');
        if (!isNew) row.active = m.$('[data-active]').checked;
        const { error } = isNew ? await sb.from('requirements').insert({ ...row, created_by: App.user.id }) : await sb.from('requirements').update(row).eq('id', r.id);
        if (error) toast(errMsg(error), 'bad'); else { toast('تم الحفظ', 'ok'); m.close(); rerender(); }
      });
    });
    m.$('[data-del]')?.addEventListener('click', async () => {
      if (!(await confirmBox('حذف المتطلب؟ الملفات المرفوعة تبقى محفوظة لكنها لن ترتبط به. يمكنك بدلاً من ذلك إيقافه.', { ok: 'حذف', danger: true }))) return;
      const { error } = await sb.from('requirements').delete().eq('id', r.id);
      if (error) toast(errMsg(error), 'bad'); else { toast('تم الحذف', 'ok'); m.close(); rerender(); }
    });
  };
  view.querySelector('[data-add]')?.addEventListener('click', () => open(null, App.categories[0]?.key));
  view.querySelectorAll('[data-add-cat]').forEach((b) => b.addEventListener('click', () => open(null, b.dataset.addCat)));
  view.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => open(reqs.find((r) => r.id === b.dataset.edit))));
  refreshIcons();
}
