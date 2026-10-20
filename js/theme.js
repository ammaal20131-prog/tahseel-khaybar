// الهوية البصرية للتقارير — تُحفظ في settings.report_theme وتُطبق على كل تقرير (عرض، طباعة/PDF، Word)
import { App, sb } from './api.js';

export const FONTS = {
  'IBM Plex Sans Arabic': 'IBM+Plex+Sans+Arabic:wght@400;600;700',
  'Tajawal': 'Tajawal:wght@400;500;700;800',
  'Cairo': 'Cairo:wght@400;600;700',
  'Almarai': 'Almarai:wght@400;700;800',
  'Noto Kufi Arabic': 'Noto+Kufi+Arabic:wght@400;600;700',
  'Amiri': 'Amiri:wght@400;700',
};

export const PRESETS = {
  moe: { name: 'وزارة التعليم', primary: '#0f3d3c', accent: '#1c9a7a', soft: '#eaf5f1' },
  gold: { name: 'أخضر وذهبي', primary: '#0f3d3c', accent: '#b48a2f', soft: '#f5efe2' },
  navy: { name: 'كحلي رسمي', primary: '#1d2b53', accent: '#3a6ea5', soft: '#e8eef7' },
  teal: { name: 'تركوازي', primary: '#0b5563', accent: '#18a0a8', soft: '#e3f4f5' },
  violet: { name: 'بنفسجي', primary: '#3b2a63', accent: '#8a63c9', soft: '#efe9f8' },
  maroon: { name: 'عنابي', primary: '#5a1f2b', accent: '#b0485a', soft: '#f6e8eb' },
};

export const HEADER_STYLES = {
  classic: 'كلاسيكي: الشعار يميناً والبيانات يساراً',
  band: 'شريط ملوّن بعرض الصفحة',
  centered: 'رسمي متوسط: الشعار في الأعلى والعنوان تحته',
};

export const DEFAULT_THEME = {
  preset: 'gold', primary: '#0f3d3c', accent: '#b48a2f', soft: '#f5efe2',
  font: 'IBM Plex Sans Arabic', header: 'classic',
  logo2_path: null,          // شعار ثانٍ اختياري (المدرسة، رؤية 2030، اللجنة...)
  cover: false,              // صفحة غلاف
  watermark: '',             // علامة مائية نصية (مثل: سري، مسودة)
  footer: '',                // نص تذييل كل صفحة
  sig: [                     // خانات التوقيع
    { title: 'رئيسة لجنة التحصيل الدراسي', name: '' },
    { title: 'مديرة المدرسة', name: '' },
  ],
  stripe_tables: true,       // تظليل صفوف الجداول بالتناوب
};

export function getTheme() {
  const t = { ...DEFAULT_THEME, ...(App.settings?.report_theme || {}) };
  if (!Array.isArray(t.sig) || !t.sig.length) t.sig = DEFAULT_THEME.sig;
  return t;
}

export const logo2Url = (t) => (t.logo2_path ? sb.storage.from('branding').getPublicUrl(t.logo2_path).data.publicUrl : '');

export function ensureFont(font) {
  const fam = FONTS[font];
  if (!fam || font === 'IBM Plex Sans Arabic') return;
  const id = 'font-' + font.replace(/\s+/g, '-');
  if (document.getElementById(id)) return;
  const l = document.createElement('link');
  l.id = id; l.rel = 'stylesheet'; l.href = `https://fonts.googleapis.com/css2?family=${fam}&display=swap`;
  document.head.appendChild(l);
}

// متغيرات CSS للتقرير
export const themeStyle = (t) => `--rp:${t.primary};--ra:${t.accent};--rs:${t.soft};--rf:'${t.font}',${t.font === 'Amiri' ? 'serif' : "'IBM Plex Sans Arabic',sans-serif"}`;

export async function saveTheme(t) {
  const { error } = await sb.from('settings').update({ report_theme: t }).eq('id', 1);
  if (error) {
    if (/report_theme/.test(error.message)) throw new Error('يلزم تحديث قاعدة البيانات مرة واحدة لإضافة حقل الهوية البصرية (report_theme). راجعي رسالة Claude.');
    throw error;
  }
  App.settings.report_theme = t;
}
