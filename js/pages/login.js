// صفحة الدخول + التهيئة الأولى (إنشاء حساب المديرة/رئيسة اللجنة)
import { App, login, fn, DEMO } from '../api.js';
import { esc, icon, refreshIcons, toast, withBusy, errMsg } from '../ui.js';

export default async function loginPage(root) {
  const s = App.settings || {};
  const members = Array.isArray(s.committee_members) ? s.committee_members : [];
  root.innerHTML = `
  <div class="login">
    <section class="login-art">
      <div>
        <img src="assets/moe-logo-white.png" alt="شعار وزارة التعليم">
        <h1>${esc(s.site_title || 'ملف لجنة التحصيل الدراسي')}</h1>
        <div class="school">${esc(s.school_name || 'متوسطة خيبر الجنوب')}</div>
        <p style="color:#c6dad4;margin-top:12px;max-width:460px">منصة مركزية لتنظيم أعمال لجنة التحصيل الدراسي: ملفات المعلمات، الخطط العلاجية والإثرائية، تحليل النتائج، وقياس رضا أولياء الأمور.</p>
      </div>
      <div class="members">
        العام الدراسي <b>${esc(s.academic_year || '')}</b><br>
        مديرة المدرسة: <b>${esc(s.principal_name || '')}</b><br>
        إعداد وتصميم: <b>${esc(s.designer_name || '')}</b><br>
        ${members.length ? `عضوات اللجنة: ${members.map(esc).join(' · ')}` : ''}
      </div>
    </section>
    <section class="login-form">
      <form data-login autocomplete="on">
        <div><h2>تسجيل الدخول</h2><p class="muted">أدخلي اسم المستخدم وكلمة المرور التي زوّدتك بها الإدارة.</p></div>
        <label class="field">اسم المستخدم<input name="u" dir="ltr" autocomplete="username" required autocapitalize="off" spellcheck="false"></label>
        <label class="field">كلمة المرور<input name="p" type="password" dir="ltr" autocomplete="current-password" required></label>
        <button class="btn primary" type="submit">${icon('log-in')} دخول</button>
        <div class="alert bad" data-err hidden></div>
        <p class="muted" style="font-size:.82rem">نسيتِ كلمة المرور؟ تواصلي مع رئيسة اللجنة أو مديرة المدرسة لإعادة تعيينها.</p>
        <div data-setup></div>
      </form>
    </section>
  </div>`;
  refreshIcons();

  const form = root.querySelector('[data-login]');
  const err = root.querySelector('[data-err]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const btn = form.querySelector('button[type=submit]');
    await withBusy(btn, async () => {
      try {
        await login(form.u.value, form.p.value);
        if (location.hash && location.hash !== '#/') location.hash = '#/';
        const { boot } = await import('../main.js');
        await boot();
      } catch (ex) {
        err.innerHTML = `${icon('circle-x')}<div>${esc(errMsg(ex))}</div>`; err.hidden = false; refreshIcons();
      }
    });
  });

  if (DEMO) {
    const { DEMO_USERS, resetDemo } = await import('../demo/mock.js');
    root.querySelector('[data-setup]').innerHTML = `<div class="alert info">${icon('flask-conical')}<div><b>نسخة تجريبية للمعاينة</b> — البيانات وهمية والتحليل الذكي محاكى. ادخلي بأحد الحسابات (أي كلمة مرور):
      <div class="row" style="margin-top:8px">${DEMO_USERS.map(([u, r]) => `<button type="button" class="btn sm" data-demo="${u}">${esc(r)}</button>`).join('')}</div>
      <button type="button" class="btn sm ghost" data-reset style="margin-top:6px">${icon('rotate-ccw')} إعادة البيانات التجريبية</button></div></div>`;
    refreshIcons();
    root.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => { form.u.value = b.dataset.demo; form.p.value = 'demo'; form.requestSubmit(); }));
    root.querySelector('[data-reset]').addEventListener('click', () => { resetDemo(); location.reload(); });
    return;
  }
  // التهيئة الأولى: تظهر فقط إن لم يوجد أي حساب إداري
  try {
    const st = await fn('admin-users', { action: 'status' });
    if (st.needs_setup) showSetup(root.querySelector('[data-setup]'));
  } catch (e) {
    root.querySelector('[data-setup]').innerHTML = `<div class="alert warn">${icon('triangle-alert')}<div>تعذر الاتصال بوظيفة إدارة الحسابات: ${esc(e.message)}</div></div>`;
    refreshIcons();
  }
}

function showSetup(box) {
  box.innerHTML = `<div class="alert info">${icon('sparkles')}<div><b>التهيئة الأولى للموقع</b><br>لا يوجد حساب إداري بعد. أنشئي حساب رئيسة اللجنة أو المديرة الآن (يظهر هذا الخيار مرة واحدة فقط).
    <div style="margin-top:8px"><button type="button" class="btn sm primary" data-open>إنشاء الحساب الإداري الأول</button></div></div></div>`;
  refreshIcons();
  box.querySelector('[data-open]').addEventListener('click', () => {
    box.innerHTML = `<div class="card" style="display:grid;gap:12px">
      <h3>${icon('shield-check')} الحساب الإداري الأول</h3>
      <label class="field">الاسم الكامل<input data-n value="${esc(App.settings?.designer_name || '')}"></label>
      <label class="field">الصلاحية<select data-r><option value="chair">رئيسة اللجنة</option><option value="principal">مديرة المدرسة</option></select></label>
      <label class="field">اسم المستخدم <span class="hint">أحرف إنجليزية صغيرة وأرقام، مثال: amal</span><input data-u dir="ltr" autocapitalize="off"></label>
      <label class="field">كلمة المرور <span class="hint">8 أحرف على الأقل</span><input data-p type="password" dir="ltr" autocomplete="new-password"></label>
      <label class="field" data-code-wrap>رمز التهيئة <span class="hint">إن كنتِ وضعتِ SETUP_CODE في إعدادات الوظيفة</span><input data-c dir="ltr"></label>
      <button type="button" class="btn primary" data-go>${icon('check')} إنشاء الحساب</button>
    </div>`;
    refreshIcons();
    box.querySelector('[data-go]').addEventListener('click', async (e) => {
      await withBusy(e.currentTarget, async () => {
        try {
          const username = box.querySelector('[data-u]').value.trim().toLowerCase();
          const password = box.querySelector('[data-p]').value;
          await fn('admin-users', {
            action: 'bootstrap', username, password,
            full_name: box.querySelector('[data-n]').value.trim(),
            role: box.querySelector('[data-r]').value,
            setup_code: box.querySelector('[data-c]').value.trim() || undefined,
          });
          toast('تم إنشاء الحساب. جارٍ تسجيل الدخول…', 'ok');
          await login(username, password);
          location.hash = '#/settings'; location.reload();
        } catch (ex) { toast(errMsg(ex), 'bad', 7000); }
      });
    });
  });
}
