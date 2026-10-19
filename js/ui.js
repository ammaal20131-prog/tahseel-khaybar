// أدوات الواجهة المشتركة
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const icon = (name, cls = '') => `<i data-lucide="${name}" class="${cls}"></i>`;

export function refreshIcons() {
  try { window.lucide?.createIcons({ attrs: { 'aria-hidden': 'true' } }); } catch (e) { /* offline */ }
}

export const STATUS = {
  unprocessed:      { label: 'لم تتم معالجته',       cls: '',       icon: 'circle-dashed' },
  processing:       { label: 'قيد القراءة',          cls: 'info',   icon: 'loader' },
  read_ok:          { label: 'تمت القراءة بنجاح',     cls: 'violet', icon: 'scan-text' },
  needs_review:     { label: 'يحتاج إلى مراجعة',      cls: 'warn',   icon: 'eye' },
  approved:         { label: 'معتمد',                cls: 'ok',     icon: 'badge-check' },
  needs_completion: { label: 'يحتاج إلى استكمال',     cls: 'bad',    icon: 'undo-2' },
  failed:           { label: 'تعذرت القراءة',         cls: 'bad',    icon: 'triangle-alert' },
};
export const statusChip = (s) => { const x = STATUS[s] || { label: s, cls: '', icon: 'circle' }; return `<span class="chip ${x.cls}">${icon(x.icon)} ${esc(x.label)}</span>`; };

export const REQ_STATE = {
  missing:    { label: 'لم يُرفع', cls: 'bad' },
  submitted:  { label: 'مرفوع – بانتظار الاعتماد', cls: 'info' },
  incomplete: { label: 'أُعيد للاستكمال', cls: 'warn' },
  complete:   { label: 'مكتمل ومعتمد', cls: 'ok' },
};
export const reqChip = (s) => { const x = REQ_STATE[s] || { label: s, cls: '' }; return `<span class="chip ${x.cls}">${esc(x.label)}</span>`; };

export const ROLES = { principal: 'مديرة المدرسة', chair: 'رئيسة اللجنة', committee: 'عضوة اللجنة', teacher: 'معلمة' };

export const CAT_ICONS = {
  remedial: 'heart-pulse', satisfaction: 'smile', weekly: 'calendar-days', semester: 'book-open',
  period_tests: 'chart-column', diagnostic: 'stethoscope', learning_styles: 'lightbulb', committee: 'archive',
};

const AR_NUM = new Intl.NumberFormat('ar-SA-u-nu-latn');
export const fmtNum = (n) => (n === null || n === undefined || Number.isNaN(n)) ? '—' : AR_NUM.format(n);
export const fmtPct = (n) => (n === null || n === undefined || Number.isNaN(n)) ? '—' : `${AR_NUM.format(n)}٪`;
export function fmtDate(d, withTime = false) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const opts = { year: 'numeric', month: 'short', day: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) };
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', opts).format(dt);
}
export const todayISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function fmtHijri(d = new Date()) {
  try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(d)); }
  catch (e) { return ''; }
}
export function timeAgo(d) {
  if (!d) return '—';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'الآن';
  if (s < 3600) return `قبل ${Math.floor(s / 60)} دقيقة`;
  if (s < 86400) return `قبل ${Math.floor(s / 3600)} ساعة`;
  if (s < 86400 * 30) return `قبل ${Math.floor(s / 86400)} يوم`;
  return fmtDate(d);
}
export function fmtSize(b) {
  if (!b && b !== 0) return '—';
  if (b < 1024) return `${b} بايت`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} ك.ب`;
  return `${(b / 1024 / 1024).toFixed(1)} م.ب`;
}
export function fileIcon(name = '') {
  const e = name.split('.').pop().toLowerCase();
  if (e === 'pdf') return 'file-text';
  if (['doc', 'docx', 'txt'].includes(e)) return 'file-type';
  if (['xls', 'xlsx', 'csv'].includes(e)) return 'file-spreadsheet';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(e)) return 'file-image';
  if (['ppt', 'pptx'].includes(e)) return 'presentation';
  return 'file';
}
export const initials = (n = '') => n.replace(/^(الأستاذة|أ\.|الاستاذة)\s*/, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join(' ');

// ---------- toast ----------
export function toast(msg, kind = '', ms = 4200) {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `${icon(kind === 'ok' ? 'circle-check' : kind === 'bad' ? 'circle-x' : kind === 'warn' ? 'triangle-alert' : 'info')}<div>${esc(msg)}</div>`;
  document.getElementById('toasts').appendChild(el);
  refreshIcons();
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, ms);
}
export const errMsg = (e) => {
  const m = e?.message || e?.error_description || e?.error || String(e);
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'تعذر الاتصال بالخادم. تحققي من الإنترنت.';
  if (/JWT expired|invalid JWT/i.test(m)) return 'انتهت الجلسة، سجلي الدخول مجدداً';
  if (/row-level security/i.test(m)) return 'ليس لديك صلاحية لهذه العملية';
  if (/Payload too large|exceeded the maximum allowed size/i.test(m)) return 'حجم الملف أكبر من المسموح';
  if (/mime type .* is not supported|invalid_mime_type/i.test(m)) return 'نوع الملف غير مسموح';
  if (/duplicate key/i.test(m)) return 'العنصر موجود مسبقاً';
  return m;
};

// ---------- modal ----------
export function modal({ title, body = '', footer = '', wide = false, onClose } = {}) {
  const root = document.getElementById('modal-root');
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-h"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="إغلاق">${icon('x')}</button></div>
    <div class="modal-b">${body}</div>${footer ? `<div class="modal-f">${footer}</div>` : ''}</div>`;
  root.appendChild(back);
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  back.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  refreshIcons();
  const first = back.querySelector('input, select, textarea');
  if (first) setTimeout(() => first.focus(), 50);
  return { el: back, close, $: (s) => back.querySelector(s), $$: (s) => [...back.querySelectorAll(s)] };
}

export function confirmBox(message, { ok = 'تأكيد', danger = false, title = 'تأكيد' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title, body: `<p>${esc(message)}</p>`,
      footer: `<button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button><button class="btn ghost" data-close>إلغاء</button>`,
      onClose: () => { if (!done) resolve(false); },
    });
    m.$('[data-ok]').addEventListener('click', () => { done = true; m.close(); resolve(true); });
  });
}

export function promptBox(label, { title = '', value = '', textarea = false, ok = 'حفظ', required = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title: title || label,
      body: `<label class="field">${esc(label)}${textarea ? `<textarea>${esc(value)}</textarea>` : `<input value="${esc(value)}">`}</label>`,
      footer: `<button class="btn primary" data-ok>${esc(ok)}</button><button class="btn ghost" data-close>إلغاء</button>`,
      onClose: () => { if (!done) resolve(null); },
    });
    const inp = m.$('input, textarea');
    const go = () => { const v = inp.value.trim(); if (required && !v) { inp.focus(); return; } done = true; m.close(); resolve(v); };
    m.$('[data-ok]').addEventListener('click', go);
    if (!textarea) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
}

export async function withBusy(btn, fn) {
  const html = btn?.innerHTML;
  if (btn) { btn.classList.add('loading'); btn.innerHTML = `<span class="spinner sm"></span> ${btn.textContent.trim()}`; }
  try { return await fn(); }
  finally { if (btn) { btn.classList.remove('loading'); btn.innerHTML = html; refreshIcons(); } }
}

export const emptyState = (text, ic = 'inbox') => `<div class="empty">${icon(ic)}<div>${esc(text)}</div></div>`;
export const progressBar = (pct, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, pct || 0))}%"></i></div>`;
export const pctClass = (p) => (p >= 80 ? '' : p >= 50 ? 'gold' : p > 0 ? 'warn' : 'bad');

// تحميل سكربت خارجي مرة واحدة
const loaded = {};
export function loadScript(src) {
  if (!loaded[src]) loaded[src] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('تعذر تحميل مكتبة: ' + src));
    document.head.appendChild(s);
  });
  return loaded[src];
}

// تنزيل ملف من المتصفح
export function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

// ترتيب جدول بالنقر على العنوان
export function sortRows(rows, key, dir) {
  return [...rows].sort((a, b) => {
    const x = a[key], y = b[key];
    if (x === y) return 0;
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ar');
    return dir === 'desc' ? -r : r;
  });
}

// تحويل Markdown بسيط (من المساعد الذكي) إلى HTML آمن
export function miniMarkdown(md = '') {
  const lines = esc(md).split('\n');
  let html = '', inList = false;
  for (let ln of lines) {
    ln = ln.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\[([^\]]+)\]\((#\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
    const li = ln.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (li) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${li[1]}</li>`; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    const hd = ln.match(/^#{1,4}\s+(.*)$/);
    if (hd) { html += `<h4>${hd[1]}</h4>`; continue; }
    html += ln.trim() ? `<p>${ln}</p>` : '';
  }
  if (inList) html += '</ul>';
  return html;
}
