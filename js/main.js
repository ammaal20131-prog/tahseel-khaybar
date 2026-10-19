// نقطة البداية: التحقق من الدخول، رسم الإطار العام، والتنقل بين الصفحات
import { sb, App, configured, loadContext, loadPublicSettings, logout, refreshUnread, DEMO } from './api.js';
import { esc, icon, refreshIcons, toast, ROLES, initials, $ } from './ui.js';
import { ensureNafes, loadNafesFlag } from './nafes.js';

const app = document.getElementById('app');

const ROUTES = [
  ['', 'dashboard'],
  ['folders', 'folders'],
  ['folder/:cat', 'folder'],
  ['folder/:cat/:teacher', 'folder'],
  ['file/:id', 'file'],
  ['tasks', 'tasks'],
  ['teachers', 'teachers', 'staff'],
  ['teacher/:id', 'teacher', 'staff'],
  ['review', 'review', 'staff'],
  ['requirements', 'requirements', 'staff'],
  ['calendar', 'calendar'],
  ['reports', 'reports'],
  ['report/new/:kind', 'report', 'staff'],
  ['report/:id', 'report'],
  ['search', 'search'],
  ['assistant', 'assistant'],
  ['notifications', 'notifications'],
  ['import', 'import', 'staff'],
  ['settings', 'settings', 'admin'],
  ['audit', 'audit', 'admin'],
  ['account', 'account'],
];

function match(hash) {
  const [path, qs] = hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  for (const [pattern, page, guard] of ROUTES) {
    const pp = pattern.split('/').filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params = {};
    if (pp.every((p, i) => (p.startsWith(':') ? (params[p.slice(1)] = decodeURIComponent(parts[i]), true) : p === parts[i])))
      return { page, params, guard, query: Object.fromEntries(new URLSearchParams(qs || '')) };
  }
  return null;
}

function navItems() {
  const p = App.profile;
  const staff = App.isStaff, admin = App.isAdmin;
  const items = [
    ['', 'layout-dashboard', 'الصفحة الرئيسية'],
    ['folders', 'folder-open', 'المجلدات'],
  ];
  if (p.is_teacher) items.push(['tasks', 'list-checks', 'متطلباتي']);
  if (staff) items.push(['review', 'clipboard-check', 'المراجعة والاعتماد', 'review']);
  items.push(['calendar', 'calendar-clock', 'التقويم والمواعيد']);
  const group2 = [
    ['reports', 'file-chart-column', 'التقارير الذكية'],
    ['assistant', 'sparkles', 'المساعد الذكي'],
    ['search', 'search', 'البحث'],
  ];
  const group3 = [];
  if (staff) group3.push(['teachers', 'users', 'المعلمات والإنجاز'], ['requirements', 'list-todo', 'المتطلبات والمواعيد'], ['import', 'folder-input', 'استيراد مجلدات']);
  if (admin) group3.push(['settings', 'settings', 'إعدادات الموقع'], ['audit', 'history', 'سجل العمليات']);
  return { main: items, tools: group2, admin: group3 };
}

function renderShell() {
  const s = App.settings || {};
  const p = App.profile;
  const nav = navItems();
  const link = ([h, ic, t, id]) => `<a href="#/${h}" data-nav="${h}">${icon(ic)}<span>${esc(t)}</span>${id ? `<span class="badge" data-badge="${id}" hidden></span>` : ''}</a>`;
  app.innerHTML = `
  <div class="shell">
    <aside class="sidebar" aria-label="القائمة الرئيسية">
      <div class="side-brand">
        <img src="assets/moe-logo-white.png" alt="وزارة التعليم">
        <div><div class="t1">${esc(s.site_title || 'ملف لجنة التحصيل الدراسي')}</div><div class="t2">${esc(s.school_name || '')}</div></div>
      </div>
      <nav class="nav">
        ${nav.main.map(link).join('')}
        <div class="nav-label">الأدوات الذكية</div>
        ${nav.tools.map(link).join('')}
        ${nav.admin.length ? `<div class="nav-label">الإدارة</div>${nav.admin.map(link).join('')}` : ''}
      </nav>
      <div class="side-foot">العام الدراسي ${esc(s.academic_year || '')}<br>إعداد وتصميم: ${esc(s.designer_name || '')}</div>
    </aside>
    <div class="backdrop" data-backdrop></div>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-btn" data-menu aria-label="القائمة">${icon('menu')}</button>
        <form class="search-box" data-search role="search">${icon('search')}<input type="search" placeholder="ابحثي عن معلمة، مادة، ملف، أو محتوى مستند…" aria-label="بحث"></form>
        <div class="top-actions">
          <button class="icon-btn" data-theme-toggle aria-label="الوضع الداكن">${icon('moon')}</button>
          <a class="icon-btn" href="#/notifications" aria-label="التنبيهات">${icon('bell')}<span class="dot" id="notif-dot" hidden></span></a>
          <button class="user-chip" data-user-menu>
            <span class="avatar">${esc(initials(p.full_name))}</span>
            <span><div class="n">${esc(p.full_name)}</div><div class="r">${esc(ROLES[p.role])}</div></span>
            ${icon('chevron-down')}
          </button>
        </div>
      </header>
      ${DEMO ? `<div class="no-print" style="background:var(--gold-soft);color:var(--ink);border-bottom:1px solid var(--line);padding:7px 22px;font-size:.84rem">${icon('flask-conical')} <b>نسخة تجريبية للمعاينة:</b> البيانات وهمية، والتحليل الذكي محاكى، ولا يُرفع أي ملف إلى خادم.</div>` : ''}
      <main class="content" id="view" tabindex="-1"></main>
    </div>
  </div>`;
  const shell = $('.shell');
  $('[data-menu]').addEventListener('click', () => shell.classList.toggle('nav-open'));
  $('[data-backdrop]').addEventListener('click', () => shell.classList.remove('nav-open'));
  $('[data-search]').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = e.target.querySelector('input').value.trim();
    if (v) location.hash = '#/search?q=' + encodeURIComponent(v);
  });
  $('[data-theme-toggle]').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('tahseel-theme', next); } catch (e) { /* ignore */ }
  });
  $('[data-user-menu]').addEventListener('click', (e) => {
    e.stopPropagation();
    let menu = document.getElementById('user-menu');
    if (menu) { menu.remove(); return; }
    menu = document.createElement('div');
    menu.id = 'user-menu';
    menu.className = 'card';
    menu.style.cssText = 'position:fixed;top:58px;inset-inline-end:16px;z-index:80;padding:8px;min-width:200px;';
    menu.innerHTML = `<a class="btn ghost" style="width:100%;justify-content:flex-start" href="#/account">${icon('user-cog')} حسابي وكلمة المرور</a>
      <button class="btn ghost" style="width:100%;justify-content:flex-start" data-logout>${icon('log-out')} تسجيل الخروج</button>`;
    document.body.appendChild(menu);
    refreshIcons();
    menu.querySelector('[data-logout]').addEventListener('click', async () => { await logout(); location.hash = '#/'; location.reload(); });
    setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
  });
  refreshIcons();
  refreshUnread();
  updateBadges();
}

export async function updateBadges() {
  if (!App.isStaff) return;
  try {
    const { count } = await sb.from('files').select('id', { count: 'exact', head: true }).in('status', ['read_ok', 'needs_review']);
    const b = document.querySelector('[data-badge="review"]');
    if (b) { b.textContent = count; b.hidden = !count; }
  } catch (e) { /* ignore */ }
}

let currentCleanup = null;
let renderSeq = 0;
async function route() {
  const view = document.getElementById('view');
  if (!view) return;
  const m = match(location.hash || '#/');
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const h = a.dataset.nav;
    const cur = (location.hash || '#/').replace(/^#\/?/, '').split('?')[0];
    a.classList.toggle('active', h === '' ? cur === '' : cur === h || cur.startsWith(h + '/') || (h === 'folders' && cur.startsWith('folder')) || (h === 'teachers' && cur.startsWith('teacher')) || (h === 'reports' && cur.startsWith('report')));
  });
  $('.shell')?.classList.remove('nav-open');
  if (typeof currentCleanup === 'function') { try { currentCleanup(); } catch (e) { /* ignore */ } }
  currentCleanup = null;
  if (!m) { view.innerHTML = `<div class="empty">${icon('map-pin-off')}<div>الصفحة غير موجودة</div><a class="btn" href="#/">العودة للرئيسية</a></div>`; refreshIcons(); return; }
  if ((m.guard === 'staff' && !App.isStaff) || (m.guard === 'admin' && !App.isAdmin)) {
    view.innerHTML = `<div class="empty">${icon('lock')}<div>هذه الصفحة غير متاحة لصلاحيتك</div></div>`; refreshIcons(); return;
  }
  const seq = ++renderSeq;
  view.innerHTML = `<div class="skeleton" style="height:38px;width:40%;margin-bottom:18px"></div><div class="grid c4">${'<div class="skeleton" style="height:96px"></div>'.repeat(4)}</div>`;
  try {
    const mod = await import(`./pages/${m.page}.js`);
    if (seq !== renderSeq) return;
    view.innerHTML = '';
    if (!window.gsap) { view.classList.remove('fade-in'); void view.offsetWidth; view.classList.add('fade-in'); }
    currentCleanup = await mod.default(view, m.params, m.query);
    refreshIcons();
    window.scrollTo(0, 0);
    animateIn(view);
  } catch (e) {
    console.error(e);
    if (seq !== renderSeq) return;
    view.innerHTML = `<div class="alert bad">${icon('circle-x')}<div><b>تعذر عرض الصفحة.</b><br>${esc(e.message || e)}</div></div>`;
    refreshIcons();
  }
}
export const rerender = () => route();

// حركة دخول ناعمة للبطاقات عند فتح كل صفحة (GSAP)، وتُتجاوز لمن فعّل تقليل الحركة
function animateIn(view) {
  const g = window.gsap;
  if (!g || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const items = [...view.querySelectorAll('.card')].filter((el) => !el.parentElement.closest('#view .card')).slice(0, 24);
  if (!items.length) return;
  g.from(items, { y: 18, opacity: 0, duration: 0.6, stagger: 0.05, ease: 'power4.out', clearProps: 'transform,opacity' });
}

function notConfigured() {
  app.innerHTML = `<div class="login-form" style="min-height:100vh"><div class="card" style="max-width:560px">
    <h2>${icon('plug')} الموقع غير مربوط بقاعدة البيانات بعد</h2>
    <p>افتحي الملف <span class="kbd">config.js</span> وضعي فيه رابط مشروع Supabase والمفتاح العام (anon key)، ثم أعيدي رفع الموقع.</p>
    <p class="muted">التفاصيل خطوة بخطوة في دليل النشر المرفق مع الموقع.</p></div></div>`;
  refreshIcons();
}

let booted = false;
export async function boot() {
  if (!configured) return notConfigured();
  try {
    const profile = await loadContext();
    if (profile) { await ensureNafes(); await loadNafesFlag().catch(() => {}); }
    if (!profile) {
      const user = App.user;
      if (user) {
        // حساب دخول بلا ملف تعريف (لم تنشئه الإدارة) — لا يُسمح له بأي شيء
        await logout();
        toast('هذا الحساب غير مسجل في النظام. تواصلي مع إدارة المدرسة.', 'bad', 7000);
      }
      await loadPublicSettings().catch(() => {});
      const { default: loginPage } = await import('./pages/login.js');
      return loginPage(app);
    }
    if (!profile.active) {
      await logout();
      toast('هذا الحساب موقوف. تواصلي مع إدارة المدرسة.', 'bad', 7000);
      const { default: loginPage } = await import('./pages/login.js');
      return loginPage(app);
    }
    renderShell();
    if (!booted) {
      booted = true;
      window.addEventListener('hashchange', route);
      setInterval(refreshUnread, 60000);
    }
    await route();
    if (App.isStaff) sb.rpc('run_deadline_alerts').then(() => refreshUnread(), () => {});
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="login-form" style="min-height:100vh"><div class="alert bad" style="max-width:560px">${icon('circle-x')}<div><b>تعذر تشغيل الموقع</b><br>${esc(e.message || e)}</div></div></div>`;
    refreshIcons();
  }
}

sb?.auth.onAuthStateChange((evt) => {
  if (evt === 'SIGNED_OUT' && document.getElementById('view')) location.reload();
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
