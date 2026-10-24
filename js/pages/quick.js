// التعبئة السريعة: كل أقسام المعلمة في صفحة واحدة — رفع مباشر للموقع، ورابط مجلدها في OneDrive، وخطتها الأسبوعية
import { App, q, catOf } from '../api.js';
import { esc, icon, reqChip, fmtNum, progressBar, pctClass, emptyState } from '../ui.js';
import { pageHead, catIcon, folderLink } from './_common.js';
import { openUploadDialog } from '../upload.js';
import { rerender } from '../main.js';
import { OD_LINKS, PLAN_LINKS } from '../od-links.js';

const short = (n) => String(n || '').replace(/^الأستاذة\s+/, '').trim();

export default async function quick(view, params, query) {
  let teacher = App.profile;
  let teachers = [];
  if (App.isStaff) {
    teachers = (await q.teachers()).filter((p) => p.is_teacher && p.active !== false).sort((a, b) => short(a.full_name).localeCompare(short(b.full_name), 'ar'));
    if (query.t) teacher = teachers.find((p) => p.id === query.t) || teacher;
    else if (!App.profile.is_teacher && teachers.length) teacher = teachers[0];
  }
  const tid = teacher.id;
  const reqs = await q.reqStatus(tid);
  const links = OD_LINKS[short(teacher.full_name)] || null;
  const total = reqs.length, done = reqs.filter((r) => r.state !== 'missing').length;
  const pct = total ? Math.round((100 * done) / total) : 0;
  const cats = App.categories.filter((c) => c.per_teacher && reqs.some((r) => r.category_key === c.key))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

  const picker = App.isStaff ? `<label class="field" style="min-width:220px;margin:0"><select data-pick aria-label="اختيار المعلمة">
      ${teachers.map((p) => `<option value="${p.id}" ${p.id === tid ? 'selected' : ''}>${esc(short(p.full_name))}</option>`).join('')}</select></label>` : '';

  view.innerHTML = `
    ${pageHead('التعبئة السريعة', `${esc(teacher.full_name)} — ارفعي كل ملف في قسمه مباشرة، أو افتحي مجلدك في الون درايف.`, picker)}
    <div class="card qf-sum">
      <div class="row between"><b>ما رُفع من المطلوب</b><span class="num">${fmtNum(done)} / ${fmtNum(total)}</span></div>
      <div style="margin-top:8px">${progressBar(pct, pctClass(pct))}</div>
      ${links ? `<div class="qf-od">${icon('cloud')} <span>مجلدك في الون درايف:</span> <a class="btn sm" href="${esc(links.main)}" target="_blank" rel="noopener">${icon('external-link')} فتح المجلد كاملاً</a></div>` : ''}
    </div>

    ${cats.length ? `<div class="qf-grid">${cats.map((c) => {
      const items = reqs.filter((r) => r.category_key === c.key);
      const ok = items.filter((r) => r.state !== 'missing').length;
      const od = links?.sections?.['k' + c.sort];
      return `<section class="card qf-card qf-k${c.sort}">
        <div class="qf-top"><h3>${icon(catIcon(c.key))} ${esc(c.title)}</h3><span class="chip ${ok === items.length ? 'ok' : ok ? 'warn' : 'bad'}">${fmtNum(ok)} / ${fmtNum(items.length)}</span></div>
        <ul class="qf-reqs">${items.map((r) => `<li>
          <span class="qf-rt">${esc(r.title)}</span>${reqChip(r.state)}
          <button class="btn sm ${r.state === 'missing' ? 'primary' : ''}" data-up="${r.requirement_id}" data-cat="${c.key}">${icon('upload')} ${r.state === 'missing' ? 'رفع' : 'إضافة'}</button>
        </li>`).join('')}</ul>
        <div class="qf-foot"><a href="${folderLink(c.key, tid)}">${icon('folder-open')} ملفاتي في هذا القسم</a>${od ? `<a href="${esc(od)}" target="_blank" rel="noopener">${icon('cloud')} القسم في الون درايف</a>` : ''}</div>
      </section>`;
    }).join('')}</div>` : `<div class="card">${emptyState('لا توجد متطلبات محددة حالياً', 'list-checks')}</div>`}

    <section class="card qf-plan">
      <div class="card-head"><h3>${icon('calendar-range')} الخطة التعليمية الأسبوعية</h3></div>
      <p class="muted" style="margin:0 0 10px;font-size:.88rem">افتحي مجلد خطة مادتك، ثم مجلد الصف، وارفعي خطة الأسبوع.</p>
      <div class="qf-pl">
        ${(links?.plans || []).map(([l, u]) => `<a class="btn primary" href="${esc(u)}" target="_blank" rel="noopener">${icon('cloud')} خطة ${esc(l)}</a>`).join('')}
        <a class="btn" href="${esc(PLAN_LINKS.onedrive)}" target="_blank" rel="noopener">${icon('folder-open')} ملف الخطة كاملاً (ون درايف)</a>
        <a class="btn" href="${esc(PLAN_LINKS.gdrive)}" target="_blank" rel="noopener">${icon('hard-drive')} رابط الخطة (قوقل درايف)</a>
      </div>
    </section>
    <p class="muted" style="font-size:.82rem;margin-top:12px">${icon('info')} الملفات التي ترفعينها في الون درايف تنتقل للموقع تلقائياً في المزامنة (9:52 صباحاً، 1:52 ظهراً، 8:52 مساءً)، والرفع هنا في الموقع يظهر فوراً.</p>`;

  view.querySelector('[data-pick]')?.addEventListener('change', (e) => { location.hash = '#/quick?t=' + e.target.value; });
  view.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () =>
    openUploadDialog({ category: b.dataset.cat, teacherId: tid, requirementId: b.dataset.up, onDone: () => setTimeout(rerender, 400) })));
}
