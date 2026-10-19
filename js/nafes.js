// قسم نافس (الاختبارات الوطنية) — لمعلمات العلوم والرياضيات واللغة العربية
// يُجهَّز تلقائياً عند دخول المديرة أو رئيسة اللجنة: إنشاء المجلد ومتطلبات كل معلمة مادة مشمولة.
import { App, sb } from './api.js';

export const NAFES_KEY = 'nafes';
export const NAFES_SUBJECTS = ['اللغة العربية', 'الرياضيات', 'العلوم'];
export const nafesSubjectIds = () => App.subjects.filter((s) => NAFES_SUBJECTS.includes(s.name)).map((s) => s.id);

export const NAFES_CATEGORY = {
  key: NAFES_KEY, title: 'نافس – الاختبارات الوطنية', icon: 'target', sort: 9, per_teacher: true, student_data: true,
  description: 'لمعلمات الثالث المتوسط في العلوم والرياضيات واللغة العربية: تحليل نتائج نافس السابقة، الاختبارات التجريبية بالمهارات، الخطط العلاجية، وشواهد التهيئة',
};

export const NAFES_REQS = [
  { title: 'تحليل نتائج نافس السابقة', sort: 1,
    description: 'تقرير نتائج المدرسة في نافس لمادتك (من تقرير الوزارة أو منصة نافس) مع تحليلك له',
    checklist: ['نتائج المدرسة في المادة', 'المقارنة بمتوسط المنطقة أو المملكة', 'المجالات أو المهارات الأضعف أداءً', 'المجالات أو المهارات الأعلى أداءً', 'التوصيات'] },
  { title: 'نتائج الاختبار التجريبي المحاكي لنافس', sort: 2,
    description: 'كشف درجات الاختبار التجريبي — يفضل Excel بعمود لكل مهارة ليُحسب الإتقان لكل مهارة تلقائياً',
    checklist: ['كشف الدرجات', 'المهارات أو المجالات المقيسة', 'نسبة الإتقان لكل مهارة', 'الفئات المحتاجة إلى دعم', 'الإجراء المتخذ بعد الاختبار'] },
  { title: 'الخطة العلاجية لنافس', sort: 3,
    description: 'خطة علاج المهارات الضعيفة استعداداً لنافس',
    checklist: ['المهارات المستهدفة', 'الفئة المستهدفة', 'الأنشطة والاستراتيجيات', 'الجدول الزمني', 'أدوات القياس', 'مؤشرات التحسن'] },
  { title: 'شواهد التهيئة والتدريب لنافس', sort: 4,
    description: 'صور أو تقارير لحصص التدريب والتهيئة والاختبارات القصيرة',
    checklist: ['وصف النشاط أو التدريب', 'التاريخ', 'الفئة المستهدفة'] },
];
// المعلمات المستهدفات افتراضياً (الثالث المتوسط) — تُعدَّل من زر «تحديد معلمات نافس» في مجلد نافس
export const NAFES_DEFAULT_USERNAMES = ['najwa', 'fatima', 'salma', 'haya', 'ghazwa'];
const MANUAL_SORT = 10; // متطلبات أضافتها الإدارة يدوياً

export const NAFES_SECTIONS = ['نتائج نافس السابقة', 'الاختبارات التجريبية', 'الخطط العلاجية', 'شواهد التهيئة'];

// هل يظهر المجلد للمستخدمة الحالية؟
export const showCategory = (c) => c.key !== NAFES_KEY || App.isStaff || App.nafes;

export async function loadNafesFlag() {
  App.nafes = false;
  if (App.isStaff || !App.categories.some((c) => c.key === NAFES_KEY)) return;
  const { data } = await sb.from('requirements').select('id').eq('category_key', NAFES_KEY).eq('teacher_id', App.user.id).eq('active', true).limit(1);
  App.nafes = !!data?.length;
}

// تجهيز القسم ومزامنة المتطلبات مع معلمات المواد المشمولة (يعمل بصمت، ولا يكرر شيئاً موجوداً)
export async function ensureNafes() {
  if (!App.isAdmin) return;
  try {
    if (!App.categories.some((c) => c.key === NAFES_KEY)) {
      const { error } = await sb.from('categories').insert(NAFES_CATEGORY);
      if (error && !/duplicate|exists/i.test(error.message)) throw error;
      App.categories = [...App.categories, NAFES_CATEGORY].sort((a, b) => a.sort - b.sort);
    } else {
      const cur = App.categories.find((c) => c.key === NAFES_KEY);
      if (cur.description !== NAFES_CATEGORY.description) {
        await sb.from('categories').update({ description: NAFES_CATEGORY.description }).eq('key', NAFES_KEY);
        cur.description = NAFES_CATEGORY.description;
      }
    }
    await syncNafesRequirements();
  } catch (e) { console.warn('nafes setup', e); }
}

// يضيف متطلبات نافس للمعلمات المستهدفات افتراضياً (مرة واحدة لكل معلمة)، ويوقف ما أُنشئ آلياً لغيرهن
export async function syncNafesRequirements() {
  const [profs, reqs] = await Promise.all([
    sb.from('profiles').select('id, username, active, is_teacher'),
    sb.from('requirements').select('id, teacher_id, title, sort, active').eq('category_key', NAFES_KEY),
  ]);
  const people = profs.data || [];
  const def = new Set(people.filter((p) => p.active && p.is_teacher && NAFES_DEFAULT_USERNAMES.includes(p.username)).map((p) => p.id));
  const all = reqs.data || [];
  const stale = all.filter((r) => r.active && r.sort < MANUAL_SORT && r.teacher_id && !def.has(r.teacher_id)).map((r) => r.id);
  if (stale.length) await sb.from('requirements').update({ active: false }).in('id', stale);
  const have = new Set(all.map((r) => `${r.teacher_id}|${r.title}`));
  const rows = [...def].flatMap((t) => newRows(t, 0).filter((r) => !have.has(`${t}|${r.title}`)));
  if (!rows.length) return 0;
  const { error } = await sb.from('requirements').insert(rows);
  if (error) throw error;
  return rows.length;
}

const newRows = (t, offset) => NAFES_REQS.map((r) => ({ category_key: NAFES_KEY, teacher_id: t, title: r.title, description: r.description, checklist: r.checklist, sort: r.sort + offset, active: true, created_by: App.user.id }));

// تحديد المعلمات المستهدفات يدوياً (من مجلد نافس)
export async function setNafesTeachers(selectedIds) {
  const { data } = await sb.from('requirements').select('id, teacher_id, title, active').eq('category_key', NAFES_KEY);
  const all = data || [];
  const sel = new Set(selectedIds);
  const off = all.filter((r) => r.active && !sel.has(r.teacher_id)).map((r) => r.id);
  const on = all.filter((r) => !r.active && sel.has(r.teacher_id)).map((r) => r.id);
  if (off.length) { const { error } = await sb.from('requirements').update({ active: false }).in('id', off); if (error) throw error; }
  if (on.length) { const { error } = await sb.from('requirements').update({ active: true }).in('id', on); if (error) throw error; }
  const have = new Set(all.map((r) => `${r.teacher_id}|${r.title}`));
  const rows = [...sel].flatMap((t) => newRows(t, MANUAL_SORT).filter((r) => !have.has(`${t}|${r.title}`)));
  if (rows.length) { const { error } = await sb.from('requirements').insert(rows); if (error) throw error; }
}
