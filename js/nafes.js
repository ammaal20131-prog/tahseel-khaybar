// قسم نافس (الاختبارات الوطنية) — لمعلمات العلوم والرياضيات واللغة العربية
// يُجهَّز تلقائياً عند دخول المديرة أو رئيسة اللجنة: إنشاء المجلد ومتطلبات كل معلمة مادة مشمولة.
import { App, sb } from './api.js';

export const NAFES_KEY = 'nafes';
export const NAFES_SUBJECTS = ['اللغة العربية', 'الرياضيات', 'العلوم'];
export const nafesSubjectIds = () => App.subjects.filter((s) => NAFES_SUBJECTS.includes(s.name)).map((s) => s.id);

export const NAFES_CATEGORY = {
  key: NAFES_KEY, title: 'نافس – الاختبارات الوطنية', icon: 'target', sort: 9, per_teacher: true, student_data: true,
  description: 'لمعلمات العلوم والرياضيات واللغة العربية: تحليل نتائج نافس السابقة، الاختبارات التجريبية بالمهارات، الخطط العلاجية، وشواهد التهيئة',
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
export const NAFES_SECTIONS = ['نتائج نافس السابقة', 'الاختبارات التجريبية', 'الخطط العلاجية', 'شواهد التهيئة'];

// هل يظهر المجلد للمستخدمة الحالية؟
export const showCategory = (c) => c.key !== NAFES_KEY || App.isStaff || App.nafes;

export async function loadNafesFlag() {
  App.nafes = false;
  if (App.isStaff || !App.categories.some((c) => c.key === NAFES_KEY)) return;
  const sids = nafesSubjectIds();
  if (!sids.length) return;
  const { data } = await sb.from('teacher_assignments').select('subject_id').eq('teacher_id', App.user.id).in('subject_id', sids).limit(1);
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
    }
    await syncNafesRequirements();
  } catch (e) { console.warn('nafes setup', e); }
}

export async function syncNafesRequirements() {
  const sids = nafesSubjectIds();
  if (!sids.length) return 0;
  const [asg, profs, reqs] = await Promise.all([
    sb.from('teacher_assignments').select('teacher_id, subject_id').in('subject_id', sids),
    sb.from('profiles').select('id, active, is_teacher'),
    sb.from('requirements').select('teacher_id, title').eq('category_key', NAFES_KEY),
  ]);
  const ok = new Set((profs.data || []).filter((p) => p.active && p.is_teacher).map((p) => p.id));
  const teachers = [...new Set((asg.data || []).map((a) => a.teacher_id))].filter((t) => ok.has(t));
  const have = new Set((reqs.data || []).map((r) => `${r.teacher_id}|${r.title}`));
  const rows = teachers.flatMap((t) => NAFES_REQS.filter((r) => !have.has(`${t}|${r.title}`))
    .map((r) => ({ category_key: NAFES_KEY, teacher_id: t, title: r.title, description: r.description, checklist: r.checklist, sort: r.sort, active: true, created_by: App.user.id })));
  if (!rows.length) return 0;
  const { error } = await sb.from('requirements').insert(rows);
  if (error) throw error;
  return rows.length;
}
