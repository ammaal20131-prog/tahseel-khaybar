// حسابي: البيانات وتغيير كلمة المرور
import { App, sb } from '../api.js';
import { esc, icon, toast, withBusy, errMsg, ROLES } from '../ui.js';
import { pageHead } from './_common.js';

export default async function account(view) {
  const p = App.profile;
  view.innerHTML = `
    ${pageHead('حسابي')}
    <div class="grid c2">
      <div class="card"><h3>${icon('id-card')} بيانات الحساب</h3>
        <dl class="kv"><dt>الاسم</dt><dd>${esc(p.full_name)}</dd><dt>اسم المستخدم</dt><dd dir="ltr" style="text-align:start">${esc(p.username)}</dd>
        <dt>الصلاحية</dt><dd>${esc(ROLES[p.role])}</dd>${p.employee_code ? `<dt>الرقم الوظيفي</dt><dd>${esc(p.employee_code)}</dd>` : ''}</dl>
        <p class="muted" style="font-size:.82rem;margin-top:12px">لتعديل الاسم أو المواد تواصلي مع رئيسة اللجنة.</p></div>
      <form class="card" data-pw style="display:grid;gap:12px"><h3>${icon('key-round')} تغيير كلمة المرور</h3>
        <label class="field">كلمة المرور الجديدة<input type="password" name="a" dir="ltr" autocomplete="new-password" minlength="8" required></label>
        <label class="field">تأكيد كلمة المرور<input type="password" name="b" dir="ltr" autocomplete="new-password" minlength="8" required></label>
        <button class="btn primary" type="submit">${icon('save')} حفظ</button></form>
    </div>`;
  const f = view.querySelector('[data-pw]');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (f.a.value !== f.b.value) return toast('كلمتا المرور غير متطابقتين', 'warn');
    if (f.a.value.length < 8) return toast('8 أحرف على الأقل', 'warn');
    await withBusy(f.querySelector('button'), async () => {
      const { error } = await sb.auth.updateUser({ password: f.a.value });
      if (error) toast(errMsg(error), 'bad'); else { toast('تم تغيير كلمة المرور', 'ok'); f.reset(); }
    });
  });
}
