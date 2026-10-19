// المجلدات الرئيسية الثمانية
import { App, q } from '../api.js';
import { esc, icon, fmtNum, fmtPct, progressBar, pctClass } from '../ui.js';
import { pageHead, catIcon, folderLink } from './_common.js';
import { oneDriveUrl } from './teachers.js';

export default async function folders(view) {
  const stats = await q.stats();
  const cats = App.categories.filter((c) => App.isStaff || c.per_teacher);
  view.innerHTML = `
    ${pageHead('المجلدات', App.isStaff ? 'نظام مجلدات منظم لكل متطلبات اللجنة: افتحي أي مجلد لاستعراض مجلدات المعلمات وملفاتها.' : 'مجلداتك الخاصة؛ لا يطّلع عليها إلا أنتِ واللجنة والإدارة.',
      oneDriveUrl(App.profile.onedrive_url) ? `<a class="btn" href="${esc(oneDriveUrl(App.profile.onedrive_url))}" target="_blank" rel="noopener">${icon('cloud')} مجلدي في OneDrive</a>` : '')}
    <div class="grid auto">
      ${cats.map((c, i) => {
        const s = (stats.by_category || []).find((x) => x.key === c.key) || {};
        const p = s.required ? Math.round((100 * s.submitted) / s.required) : null;
        const href = App.isStaff ? folderLink(c.key, null) : folderLink(c.key, App.user.id);
        return `<a class="card folder-card" href="${href}">
          <span class="num-badge">المجلد ${i + 1}</span>
          <div class="fi">${icon(catIcon(c.key))}</div>
          <div class="ft">${esc(c.title)}</div>
          <div class="fd">${esc(c.description || '')}</div>
          ${p !== null ? progressBar(p, pctClass(p)) : ''}
          <div class="fs"><span>${icon('file')} ${fmtNum(s.files || 0)} ملف</span>
            ${p !== null ? `<span>${icon('target')} ${fmtPct(p)} مرفوع</span>` : ''}
            ${c.per_teacher ? `<span>${icon('users')} مجلد لكل معلمة</span>` : `<span>${icon('folder')} مجلد مشترك</span>`}</div>
        </a>`;
      }).join('')}
    </div>`;
}
