// عناصر مشتركة بين الصفحات
import { App, catOf } from '../api.js';
import { esc, icon, fmtHijri, CAT_ICONS } from '../ui.js';

export function letterhead(compact = false) {
  const s = App.settings || {};
  const members = Array.isArray(s.committee_members) ? s.committee_members : [];
  return `<section class="letterhead">
    <div class="lh-logo"><img src="${esc(App.settings?.logo_path ? App.logoUrl : 'assets/moe-logo-white.png')}" alt="شعار وزارة التعليم"></div>
    <div class="lh-main">
      <div style="font-size:.82rem;color:#b9d0c9">وزارة التعليم · ${esc(s.directorate || '')}</div>
      <h1>${esc(s.site_title || 'ملف لجنة التحصيل الدراسي')}</h1>
      <div class="school">${esc(s.school_name || '')} — ${esc(s.committee_name || '')}</div>
    </div>
    <div class="lh-meta">
      <div>العام الدراسي: <b>${esc(s.academic_year || '')}</b> · <b>${esc(s.semester || '')}</b></div>
      <div>مديرة المدرسة: <b>${esc(s.principal_name || '')}</b></div>
      <div>إعداد وتصميم: <b>${esc(s.designer_name || '')}</b></div>
      <div>${esc(fmtHijri())}</div>
    </div>
    ${!compact && members.length ? `<div class="lh-members">${icon('users')} عضوات اللجنة: ${members.map((m) => `<span class="m">${esc(m)}</span>`).join('')}</div>` : ''}
  </section>`;
}

export const catIcon = (key) => CAT_ICONS[key] || 'folder';

export function folderLink(catKey, teacherId, path) {
  let h = `#/folder/${catKey}`;
  if (teacherId) h += `/${teacherId}`;
  else if (!catOf(catKey).per_teacher) h += '/general';
  if (path) h += `?path=${encodeURIComponent(path)}`;
  return h;
}

export function pageHead(title, sub = '', actions = '', crumbs = '') {
  return `<div class="page-head">
    <div>${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}<h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
    ${actions ? `<div class="row">${actions}</div>` : ''}
  </div>`;
}

export function kpi(value, label, ic, tone = '', href = '') {
  return `<div class="card kpi">
    <div class="ic ${tone}">${icon(ic)}</div>
    <div><div class="v">${value}</div><div class="l">${esc(label)}</div></div>
    ${href ? `<a class="stretch" href="${href}" aria-label="${esc(label)}"></a>` : ''}
  </div>`;
}

let chartMod = null;
export async function Chart() {
  if (!chartMod) chartMod = (await import('https://cdn.jsdelivr.net/npm/chart.js@4.4.4/auto/+esm')).default;
  const css = getComputedStyle(document.documentElement);
  chartMod.defaults.font.family = css.getPropertyValue('--font');
  chartMod.defaults.color = css.getPropertyValue('--muted').trim();
  chartMod.defaults.borderColor = css.getPropertyValue('--line').trim();
  return chartMod;
}
export const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
