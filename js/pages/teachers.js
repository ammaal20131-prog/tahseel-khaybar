// إدارة المعلمات ومتابعة الإنجاز
import { App, sb, q, fn, subjectName, gradeName } from '../api.js';
import { esc, icon, fmtNum, fmtPct, timeAgo, progressBar, pctClass, emptyState, toast, modal, withBusy, errMsg, ROLES, sortRows, refreshIcons, downloadBlob, confirmBox } from '../ui.js';
import { pageHead } from './_common.js';
import { getXLSX } from '../extract.js';
import { rerender } from '../main.js';

export default async function teachers(view) {
  const [prog, people, asg] = await Promise.all([q.progress(), q.teachers(), q.assignments()]);
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  const rows = people.map((p) => {
    const g = prog.find((x) => x.teacher_id === p.id) || {};
    const a = asg.filter((x) => x.teacher_id === p.id);
    return {
      ...p, ...g, id: p.id,
      subjects: [...new Set(a.map((x) => subjectName(x.subject_id)))].join('، '),
      grades: [...new Set(a.map((x) => gradeName(x.grade_id)))].join('، '),
      subject_ids: a.map((x) => x.subject_id), grade_ids: a.map((x) => x.grade_id),
      pct: g.required ? g.submit_pct : null,
      review_state: g.returned ? 'returned' : g.to_review ? 'review' : g.required && g.complete === g.required ? 'done' : g.files ? 'partial' : 'none',
    };
  });
  let sortKey = 'full_name', sortDir = 'asc';

  view.innerHTML = `
    ${pageHead('المعلمات ومتابعة الإنجاز', 'حسابات الدخول، المواد والصفوف، ونسبة إنجاز كل معلمة.', `
      ${App.isAdmin ? `<button class="btn primary" data-add>${icon('user-plus')} إضافة معلمة</button>` : ''}
      <button class="btn" data-xls>${icon('file-spreadsheet')} تصدير Excel</button>`)}
    <div class="card">
      <div class="filters" style="margin-bottom:12px">
        <input type="search" placeholder="بحث بالاسم أو اسم المستخدم" data-f>
        <select data-subj><option value="">كل المواد</option>${App.subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
        <select data-grade><option value="">كل الصفوف</option>${App.grades.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
        <select data-state><option value="">كل حالات الإنجاز</option><option value="low">أقل من 50٪</option><option value="mid">50–99٪</option><option value="full">100٪</option><option value="review">بانتظار مراجعة</option><option value="returned">لديها ملفات معادة</option><option value="inactive">حسابات موقوفة</option></select>
      </div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th class="sortable" data-sort="full_name">الاسم</th><th>المادة</th><th>الصفوف</th>
          <th class="sortable" data-sort="pct">نسبة الإنجاز</th>
          <th class="sortable" data-sort="required">المطلوبة</th><th class="sortable" data-sort="submitted">المرفوعة</th>
          <th class="sortable" data-sort="missing">الناقصة</th><th>المراجعة</th><th class="sortable" data-sort="last_login_at">آخر دخول</th><th></th>
        </tr></thead><tbody data-body></tbody></table></div>
    </div>`;

  const body = view.querySelector('[data-body]');
  const paint = () => {
    const f = view.querySelector('[data-f]').value.trim().toLowerCase();
    const sj = Number(view.querySelector('[data-subj]').value);
    const gr = Number(view.querySelector('[data-grade]').value);
    const st = view.querySelector('[data-state]').value;
    let list = rows.filter((r) => (st === 'inactive' ? !r.active : true) &&
      (!f || r.full_name.toLowerCase().includes(f) || r.username.includes(f)) &&
      (!sj || r.subject_ids.includes(sj)) && (!gr || r.grade_ids.includes(gr)) &&
      (!st || st === 'inactive' || (st === 'low' && (r.pct ?? 0) < 50) || (st === 'mid' && r.pct >= 50 && r.pct < 100) || (st === 'full' && r.pct === 100) || (st === 'review' && r.to_review) || (st === 'returned' && r.returned)));
    list = sortRows(list, sortKey, sortDir);
    body.innerHTML = list.length ? list.map((r) => `<tr style="${r.active ? '' : 'opacity:.55'}">
      <td><a href="#/teacher/${r.id}" style="font-weight:600;color:var(--ink)">${esc(r.full_name)}</a>
        <div class="muted" style="font-size:.76rem"><span dir="ltr">${esc(r.username)}</span> · ${esc(ROLES[r.role])}${r.active ? '' : ' · <span class="chip bad">موقوف</span>'}</div></td>
      <td>${esc(r.subjects || '—')}</td><td class="muted" style="font-size:.8rem">${esc(r.grades || '—')}</td>
      <td>${r.is_teacher ? (r.pct !== null ? `<div class="mini-bar">${progressBar(r.pct, pctClass(r.pct))}<b class="num">${fmtPct(r.pct)}</b></div>` : '<span class="muted">—</span>') : '<span class="muted">لا تُطلب منها ملفات</span>'}</td>
      <td class="num">${fmtNum(r.required ?? 0)}</td><td class="num">${fmtNum(r.submitted ?? 0)}</td>
      <td class="num">${r.missing ? `<span class="chip bad">${fmtNum(r.missing)}</span>` : '0'}</td>
      <td>${{ returned: '<span class="chip warn">معاد للاستكمال</span>', review: `<span class="chip info">${fmtNum(r.to_review)} للمراجعة</span>`, done: '<span class="chip ok">مكتمل</span>', partial: '<span class="chip">جزئي</span>', none: '<span class="muted">—</span>' }[r.review_state]}</td>
      <td class="muted" style="font-size:.8rem">${r.last_login_at ? timeAgo(r.last_login_at) : 'لم تدخل بعد'}</td>
      <td class="actions"><a class="btn sm" href="#/teacher/${r.id}">${icon('eye')}</a>${oneDriveUrl(r.onedrive_url) ? ` <a class="btn sm ghost" href="${esc(oneDriveUrl(r.onedrive_url))}" target="_blank" rel="noopener" title="مجلد OneDrive">${icon('cloud')}</a>` : ''}${App.isAdmin ? ` <button class="btn sm ghost" data-edit="${r.id}">${icon('pencil')}</button>` : ''}</td>
    </tr>`).join('') : `<tr><td colspan="10">${emptyState(rows.length ? 'لا نتائج مطابقة' : 'لم تُضف معلمات بعد', 'users')}</td></tr>`;
    refreshIcons();
    body.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => accountDialog(byId[b.dataset.edit], asg)));
  };
  ['[data-f]', '[data-subj]', '[data-grade]', '[data-state]'].forEach((s) => view.querySelector(s).addEventListener(s === '[data-f]' ? 'input' : 'change', paint));
  view.querySelectorAll('[data-sort]').forEach((th) => th.addEventListener('click', () => {
    const k = th.dataset.sort; sortDir = sortKey === k && sortDir === 'asc' ? 'desc' : 'asc'; sortKey = k; paint();
  }));
  view.querySelector('[data-add]')?.addEventListener('click', () => accountDialog(null, asg));
  view.querySelector('[data-xls]').addEventListener('click', async (e) => {
    await withBusy(e.currentTarget, async () => {
      const XLSX = await getXLSX();
      const data = rows.map((r) => ({
        'الاسم': r.full_name, 'اسم المستخدم': r.username, 'الصلاحية': ROLES[r.role], 'المواد': r.subjects, 'الصفوف': r.grades,
        'المطلوبة': r.required ?? 0, 'المرفوعة': r.submitted ?? 0, 'المعتمدة': r.complete ?? 0, 'الناقصة': r.missing ?? 0,
        'نسبة الإنجاز ٪': r.pct ?? '', 'بانتظار المراجعة': r.to_review ?? 0, 'معادة للاستكمال': r.returned ?? 0,
        'آخر دخول': r.last_login_at ? new Date(r.last_login_at).toLocaleString('ar-SA-u-nu-latn') : '', 'آخر رفع': r.last_upload_at ? new Date(r.last_upload_at).toLocaleString('ar-SA-u-nu-latn') : '',
        'الحالة': r.active ? 'مفعل' : 'موقوف',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = Object.keys(data[0] || {}).map(() => ({ wch: 18 }));
      const wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
      XLSX.utils.book_append_sheet(wb, ws, 'إنجاز المعلمات');
      const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `إنجاز-المعلمات-${new Date().toISOString().slice(0, 10)}.xlsx`);
    });
  });
  paint();
}

// نافذة إضافة/تعديل حساب
export function accountDialog(p, asg = []) {
  const isNew = !p;
  const mine = p ? asg.filter((a) => a.teacher_id === p.id) : [];
  const has = (s, g) => mine.some((a) => a.subject_id === s && a.grade_id === g);
  const m = modal({
    title: isNew ? 'إضافة معلمة / حساب جديد' : `تعديل: ${p.full_name}`, wide: true,
    body: `<div class="form-grid">
      <label class="field">الاسم الكامل<input data-n value="${esc(p?.full_name || '')}" placeholder="الأستاذة …"></label>
      <label class="field">الرقم الوظيفي أو رمز المعلمة <span class="hint">اختياري</span><input data-code value="${esc(p?.employee_code || '')}"></label>
      <label class="field full">رابط مجلد OneDrive <span class="hint">اختياري — انسخيه من "مشاركة" في OneDrive</span><input data-od dir="ltr" type="url" value="${esc(p?.onedrive_url || '')}" placeholder="https://1drv.ms/f/…"></label>
      <label class="field">اسم المستخدم <span class="hint">إنجليزي صغير وأرقام، مثال: noha.z</span><input data-u dir="ltr" value="${esc(p?.username || '')}" autocapitalize="off"></label>
      <label class="field">الصلاحية<select data-r>${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${(p?.role || 'teacher') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      ${isNew ? `<label class="field">كلمة المرور <span class="hint">8 أحرف على الأقل — سلّميها للمعلمة</span><div class="row" style="flex-wrap:nowrap"><input data-p dir="ltr" value="${genPass()}"><button class="btn sm" type="button" data-gen>${icon('refresh-cw')}</button></div></label>` : ''}
      <label class="check full"><input type="checkbox" data-t ${p ? (p.is_teacher ? 'checked' : '') : 'checked'}> تُطلب منها ملفات (معلمة مادة) — تُحسب لها نسبة إنجاز</label>
      <div class="full"><b style="font-size:.88rem">المواد والصفوف التي تدرّسها</b>
        <div class="table-wrap" style="margin-top:6px;max-height:280px;overflow:auto"><table><thead><tr><th>المادة</th>${App.grades.map((g) => `<th>${esc(g.name)}</th>`).join('')}</tr></thead><tbody>
        ${App.subjects.map((s) => `<tr><td>${esc(s.name)}</td>${App.grades.map((g) => `<td><input type="checkbox" data-asg="${s.id}:${g.id}" ${has(s.id, g.id) ? 'checked' : ''} aria-label="${esc(s.name)} ${esc(g.name)}"></td>`).join('')}</tr>`).join('')}
        </tbody></table></div></div>
    </div>`,
    footer: `<button class="btn primary" data-save>${icon('save')} ${isNew ? 'إنشاء الحساب' : 'حفظ'}</button>
      ${!isNew ? `<button class="btn" data-reset>${icon('key-round')} إعادة تعيين كلمة المرور</button>
        <button class="btn ${p.active ? 'danger' : ''}" data-active>${icon(p.active ? 'user-x' : 'user-check')} ${p.active ? 'إيقاف الحساب' : 'تفعيل الحساب'}</button>
        <button class="btn ghost danger" data-del>${icon('trash-2')} حذف</button>` : ''}
      <button class="btn ghost" data-close>إلغاء</button>`,
  });
  m.$('[data-gen]')?.addEventListener('click', () => { m.$('[data-p]').value = genPass(); });
  const collect = () => ({
    full_name: m.$('[data-n]').value.trim(), employee_code: m.$('[data-code]').value.trim(),
    username: m.$('[data-u]').value.trim().toLowerCase(), role: m.$('[data-r]').value, is_teacher: m.$('[data-t]').checked,
    onedrive_url: m.$('[data-od]').value.trim() || null,
    assignments: m.$$('[data-asg]:checked').map((c) => { const [s, g] = c.dataset.asg.split(':'); return { subject_id: Number(s), grade_id: Number(g) }; }),
  });
  m.$('[data-save]').addEventListener('click', async (e) => {
    await withBusy(e.currentTarget, async () => {
      try {
        const d = collect();
        if (d.onedrive_url && !oneDriveUrl(d.onedrive_url)) throw new Error('رابط OneDrive يجب أن يبدأ بـ https://');
        if (isNew) {
          const password = m.$('[data-p]').value;
          await fn('admin-users', { action: 'create', ...d, password });
          m.close();
          modal({ title: 'تم إنشاء الحساب', body: `<p>سلّمي المعلمة بيانات الدخول التالية:</p>
            <div class="card" style="background:var(--surface-2)"><dl class="kv"><dt>الاسم</dt><dd>${esc(d.full_name)}</dd><dt>اسم المستخدم</dt><dd dir="ltr" style="text-align:start">${esc(d.username)}</dd><dt>كلمة المرور</dt><dd dir="ltr" style="text-align:start">${esc(password)}</dd><dt>رابط الموقع</dt><dd dir="ltr" style="text-align:start">${esc(location.origin + location.pathname)}</dd></dl></div>
            <p class="muted" style="font-size:.82rem">تستطيع المعلمة تغيير كلمة المرور من "حسابي" بعد الدخول.</p>`,
            footer: '<button class="btn primary" data-close>تم</button>', onClose: rerender });
        } else {
          await fn('admin-users', { action: 'update', id: p.id, ...d });
          toast('تم الحفظ', 'ok'); m.close(); rerender();
        }
      } catch (ex) { toast(errMsg(ex), 'bad', 7000); }
    });
  });
  m.$('[data-reset]')?.addEventListener('click', async (e) => {
    const pw = genPass();
    if (!(await confirmBox(`ستُعيَّن كلمة مرور جديدة: ${pw}\nسلّميها للمعلمة.`, { ok: 'تعيين' }))) return;
    try { await fn('admin-users', { action: 'reset_password', id: p.id, password: pw }); toast('تم التعيين. كلمة المرور الجديدة: ' + pw, 'ok', 15000); }
    catch (ex) { toast(errMsg(ex), 'bad'); }
  });
  m.$('[data-active]')?.addEventListener('click', async () => {
    try { await fn('admin-users', { action: 'set_active', id: p.id, active: !p.active }); toast(p.active ? 'تم إيقاف الحساب' : 'تم تفعيل الحساب', 'ok'); m.close(); rerender(); }
    catch (ex) { toast(errMsg(ex), 'bad'); }
  });
  m.$('[data-del]')?.addEventListener('click', async () => {
    if (!(await confirmBox(`حذف حساب ${p.full_name} نهائياً؟`, { ok: 'حذف', danger: true }))) return;
    try { await fn('admin-users', { action: 'delete', id: p.id }); toast('تم الحذف', 'ok'); m.close(); rerender(); }
    catch (ex) { toast(errMsg(ex), 'bad', 8000); }
  });
}

// يقبل روابط https فقط (يمنع javascript: وغيرها)
export function oneDriveUrl(u) {
  return typeof u === 'string' && /^https:\/\/\S+$/i.test(u.trim()) ? u.trim() : '';
}

function genPass() {
  const a = 'abcdefghjkmnpqrstuvwxyz', d = '23456789';
  const r = (s) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  return Array.from({ length: 5 }, () => r(a)).join('') + Array.from({ length: 4 }, () => r(d)).join('');
}
