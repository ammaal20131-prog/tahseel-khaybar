// استخراج النصوص والجداول داخل المتصفح (Word / Excel / CSV / نص)
// ملفات PDF والصور تُقرأ على الخادم بالذكاء الاصطناعي (يشمل التعرف الضوئي على الحروف للمصورة)
import { loadScript } from './ui.js';
import { analyzeGradeSheet, analyzeSurvey } from './stats.js';

let XLSXmod = null;
export async function getXLSX() {
  if (!XLSXmod) XLSXmod = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
  return XLSXmod;
}
export async function getMammoth() {
  await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js');
  return window.mammoth;
}
export async function getJSZip() {
  const m = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
  return m.default || m;
}

export const extOf = (name = '') => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');

// فك ترميز النص (UTF-8 أو ترميز ويندوز العربي)
export function decodeText(buf) {
  const u8 = new Uint8Array(buf);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u8).replace(/^﻿/, ''); }
  catch (e) {
    try { return new TextDecoder('windows-1256').decode(u8); } catch (e2) { return new TextDecoder().decode(u8); }
  }
}

export async function readWorkbook(buf, ext) {
  const XLSX = await getXLSX();
  if (ext === 'csv') return XLSX.read(decodeText(buf), { type: 'string', raw: false });
  return XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
}

export async function workbookSheets(wb) {
  const XLSX = await getXLSX();
  return wb.SheetNames.map((name) => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
    const numeric = rows.reduce((s, r) => s + r.filter((c) => typeof c === 'number').length, 0);
    return { name, rows, numeric };
  });
}

// يعيد { text, rows (للورقة الرئيسية), sheetName, sheets }
export async function extractSpreadsheet(buf, ext) {
  const XLSX = await getXLSX();
  const wb = await readWorkbook(buf, ext);
  const sheets = await workbookSheets(wb);
  const main = [...sheets].sort((a, b) => b.numeric - a.numeric || b.rows.length - a.rows.length)[0];
  const text = wb.SheetNames.slice(0, 4).map((n) => `### ${n}\n` + XLSX.utils.sheet_to_csv(wb.Sheets[n])).join('\n\n').slice(0, 120000);
  return { text, rows: main?.rows || [], sheetName: main?.name, sheets: sheets.map((s) => s.name) };
}

export async function extractDocx(buf) {
  const mammoth = await getMammoth();
  const r = await mammoth.extractRawText({ arrayBuffer: buf });
  return r.value || '';
}
export async function docxToHtml(buf) {
  const mammoth = await getMammoth();
  const r = await mammoth.convertToHtml({ arrayBuffer: buf });
  return r.value || '';
}
export async function sheetToHtml(buf, ext) {
  const XLSX = await getXLSX();
  const wb = await readWorkbook(buf, ext);
  return wb.SheetNames.slice(0, 6).map((n) => `<h4 style="margin:12px 8px 6px">${n.replace(/</g, '&lt;')}</h4>` + XLSX.utils.sheet_to_html(wb.Sheets[n], { editable: false }).replace(/<html>|<\/html>|<body>|<\/body>|<head>.*?<\/head>/gs, '')).join('');
}

// هل يحتاج الملف خيارات تحليل الدرجات؟
export const needsGradeOptions = (category, ext) => ['period_tests', 'diagnostic', 'nafes'].includes(category) && ['xlsx', 'xls', 'csv'].includes(ext);

// استخراج كامل قبل إرسال الملف للتحليل الذكي
// opts: خيارات الدرجات { maxScore, maxPerColumn, passPct, masteryPct }
export async function prepareForAnalysis(file, category, opts = {}) {
  const ext = extOf(file.name);
  const out = { text: undefined, stats: null, note: null };
  try {
    if (ext === 'docx') out.text = await extractDocx(await file.arrayBuffer());
    else if (ext === 'txt') out.text = decodeText(await file.arrayBuffer());
    else if (['xlsx', 'xls', 'csv'].includes(ext)) {
      const s = await extractSpreadsheet(await file.arrayBuffer(), ext);
      out.text = s.text;
      if (category === 'period_tests') out.stats = analyzeGradeSheet(s.rows, { ...opts, mode: 'period' });
      else if (category === 'diagnostic' || category === 'nafes') out.stats = analyzeGradeSheet(s.rows, { ...opts, mode: 'diagnostic' });
      else if (category === 'satisfaction') out.stats = analyzeSurvey(s.rows);
      if (out.stats) out.stats.sheet = s.sheetName;
    }
  } catch (e) {
    out.note = 'تعذر استخراج المحتوى داخل المتصفح: ' + e.message;
  }
  return out;
}
