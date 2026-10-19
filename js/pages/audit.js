// سجل العمليات والتعديلات
import { q, teacherNameMap } from '../api.js';
import { esc, icon, fmtDate, emptyState, refreshIcons } from '../ui.js';
import { pageHead } from './_common.js';

const ACT = { insert: 'إضافة', update: 'تعديل', delete: 'حذف', create_account: 'إنشاء حساب', update_account: 'تعديل حساب', reset_password: 'إعادة تعيين كلمة مرور', enable_account: 'تفعيل حساب', disable_account: 'إيقاف حساب', delete_account: 'حذف حساب' };
const ENT = { files: 'ملف', profiles: 'مستخدمة', requirements: 'متطلب', settings: 'الإعدادات', file_notes: 'مراجعة/ملاحظة', reports: 'تقرير', accounts: 'حساب' };

export default async function audit(view) {
  const [rows, people] = await Promise.all([q.audit(300), q.teachers()]);
  const names = teacherNameMap(people);
  const describe = (r) => {
    const d = r.details || {};
    const a = d.after || d, b = d.before;
    if (r.entity === 'files') {
      if (r.action === 'update' && b && a && b.status !== a.status) return `${esc(a.name)}: تغيرت الحالة من ${esc(b.status)} إلى ${esc(a.status)}`;
      return esc(a.name || (b && b.name) || '');
    }
    if (r.entity === 'file_notes') return `${esc({ approve: 'اعتماد', return: 'إعادة للاستكمال', reopen: 'إعادة فتح', note: 'ملاحظة' }[a.kind] || a.kind)}${a.body ? ': ' + esc(String(a.body).slice(0, 90)) : ''}`;
    if (r.entity === 'profiles') return esc(a.full_name || '');
    if (r.entity === 'requirements') return esc(a.title || '');
    if (r.entity === 'accounts') return esc(names[r.entity_id] || d.username || '');
    if (r.entity === 'reports') return esc(a.title || '');
    return '';
  };
  view.innerHTML = `
    ${pageHead('سجل العمليات', 'كل عمليات الرفع والحذف والتعديل والاعتماد وإدارة الحسابات (آخر 300 عملية).')}
    <div class="card"><div class="filters" style="margin-bottom:10px"><input type="search" placeholder="تصفية" data-f>
      <select data-e><option value="">كل الأنواع</option>${Object.entries(ENT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div data-l></div></div>`;
  const paint = () => {
    const f = view.querySelector('[data-f]').value.trim();
    const e = view.querySelector('[data-e]').value;
    const list = rows.filter((r) => (!e || r.entity === e) && (!f || describe(r).includes(f) || (names[r.actor_id] || '').includes(f)));
    view.querySelector('[data-l]').innerHTML = list.length ? `<div class="table-wrap"><table><thead><tr><th>الوقت</th><th>المستخدمة</th><th>العملية</th><th>العنصر</th><th>التفاصيل</th></tr></thead><tbody>
      ${list.map((r) => `<tr><td class="muted" style="white-space:nowrap">${fmtDate(r.at, true)}</td><td>${esc(names[r.actor_id] || (r.actor_id ? '—' : 'النظام'))}</td>
        <td>${esc(ACT[r.action] || r.action)}</td><td>${esc(ENT[r.entity] || r.entity)}</td><td style="font-size:.84rem">${describe(r)}</td></tr>`).join('')}
      </tbody></table></div>` : emptyState('لا توجد عمليات', 'history');
    refreshIcons();
  };
  view.querySelector('[data-f]').addEventListener('input', paint);
  view.querySelector('[data-e]').addEventListener('change', paint);
  paint();
}
