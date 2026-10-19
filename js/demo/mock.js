// =====================================================================
//  خادم تجريبي داخل المتصفح (للمعاينة والاختبار فقط)
//  يحاكي واجهة Supabase بالبيانات الوهمية؛ لا يُستخدم في النسخة الفعلية.
// =====================================================================
import { analyzeGradeSheet, analyzeSurvey } from '../stats.js';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(16).slice(2) + Date.now().toString(16));
const now = () => new Date().toISOString();
const daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString();
const dateIn = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

// ---------------------------------------------------------------------
//  البيانات التجريبية
// ---------------------------------------------------------------------
const pid = (n) => `11111111-0000-4000-8000-${String(n).padStart(12, '0')}`;
const P = {
  chair: pid(1), principal: pid(2), noha: pid(3), aisha: pid(4), haya: pid(5),
  t1: pid(6), t2: pid(7), t3: pid(8), fatima: pid(9), munira: pid(10), nawha: pid(11), asha: pid(12), zahrah: pid(13),
  ahlam: pid(14), saraobaid: pid(15), hayaali: pid(16), sarahashmi: pid(17), najwa: pid(18), noura: pid(19), muzna: pid(20),
  thamra: pid(21), shaima: pid(22), jumana: pid(23),
};
// منسوبات المدرسة: [المعرف، اسم المستخدم، الاسم، الصلاحية، معلمة؟، المادة]
const ROSTER = [
  [P.chair, 'amal', 'الأستاذة أمل الشهري', 'chair', true, null],
  [P.principal, 'zahra', 'الأستاذة زهراء الشهراني', 'principal', false, null],
  [P.noha, 'noha', 'الأستاذة نهى الزهراني', 'committee', true, null],
  [P.aisha, 'aisha', 'الأستاذة عائشة عمير الشهراني', 'committee', true, null],
  // قسم اللغة العربية
  [P.t2, 'salma', 'الأستاذة سلمى فلاح', 'teacher', true, 'اللغة العربية'],
  [P.fatima, 'fatima', 'الأستاذة فاطمة عون', 'teacher', true, 'اللغة العربية'],
  // قسم العلوم
  [P.t1, 'ghazwa', 'الأستاذة غزوة العتيبي', 'teacher', true, 'العلوم'],
  [P.haya, 'haya', 'الأستاذة هيا الشهراني', 'committee', true, 'العلوم'],
  [P.nawha, 'nawha', 'الأستاذة نوهة الزهراني', 'teacher', true, 'العلوم'],
  [P.asha, 'asha', 'الأستاذة عاشة الشهراني', 'teacher', true, 'العلوم'],
  // قسم التربية الأسرية
  [P.munira, 'munira', 'الأستاذة منيرة الشهراني', 'teacher', true, null],
  // قسم الاجتماعيات
  [P.zahrah, 'zahrah', 'الأستاذة زهرة الشهراني', 'teacher', true, 'الدراسات الاجتماعية'],
  // قسم المهارات الرقمية (أمل الشهري أعلاه)
  [P.ahlam, 'ahlam', 'الأستاذة أحلام الشهراني', 'teacher', true, null],
  // قسم الدراسات الإسلامية
  [P.saraobaid, 'saraobaid', 'الأستاذة سارة عبيد الشهراني', 'teacher', true, 'الدراسات الإسلامية'],
  [P.hayaali, 'hayaali', 'الأستاذة هيا علي الشهراني', 'teacher', true, 'الدراسات الإسلامية'],
  [P.sarahashmi, 'sarahashmi', 'الأستاذة سارة الهاشمي', 'teacher', true, 'الدراسات الإسلامية'],
  // قسم الرياضيات
  [P.najwa, 'najwa', 'الأستاذة نجوى معشي', 'teacher', true, null],
  [P.noura, 'noura', 'الأستاذة نورة الشهراني', 'teacher', true, null],
  [P.muzna, 'muzna', 'الأستاذة مزنة الشهراني', 'teacher', true, null],
  // قسم اللغة الإنجليزية
  [P.t3, 'wafaa', 'الأستاذة وفاء الشهراني', 'teacher', true, null],
  [P.thamra, 'thamra', 'الأستاذة ثمراء الشهراني', 'teacher', true, null],
  [P.shaima, 'shaima', 'الأستاذة الشيماء عسيري', 'teacher', true, null],
  [P.jumana, 'jumana', 'الأستاذة جمانة الشهري', 'teacher', true, null],
];
function seed() {
  const db = {};
  db.settings = [{ id: 1, site_title: 'ملف لجنة التحصيل الدراسي', school_name: 'متوسطة خيبر الجنوب', committee_name: 'لجنة التحصيل الدراسي', academic_year: '1448هـ', semester: 'الفصل الدراسي الأول', principal_name: 'الأستاذة زهراء الشهراني', designer_name: 'الأستاذة أمل الشهري', directorate: 'الإدارة العامة للتعليم بمنطقة عسير',
    committee_members: ['الأستاذة نهى الزهراني', 'الأستاذة أمل الشهري', 'الأستاذة عائشة عمير الشهراني', 'الأستاذة هيا الشهراني'], logo_path: null, ai_enabled: true, ai_send_student_files: false, max_upload_mb: 25, updated_at: now() }];
  const prof = (id, username, full_name, role, is_teacher, extra = {}) => ({ id, username, full_name, role, is_teacher, employee_code: null, active: true, last_login_at: daysAgo(Math.random() * 6), last_upload_at: daysAgo(Math.random() * 9), created_at: daysAgo(40), ...extra });
  db.profiles = ROSTER.map(([id, username, full_name, role, is_teacher]) => prof(id, username, full_name, role, is_teacher));
  db.subjects = ['القرآن الكريم', 'الدراسات الإسلامية', 'اللغة العربية', 'الرياضيات', 'العلوم', 'اللغة الإنجليزية', 'الدراسات الاجتماعية', 'المهارات الرقمية', 'التربية الأسرية', 'التربية الفنية', 'التربية البدنية'].map((name, i) => ({ id: i + 1, name }));
  db.grades = [{ id: 1, name: 'الأول المتوسط', sort: 1 }, { id: 2, name: 'الثاني المتوسط', sort: 2 }, { id: 3, name: 'الثالث المتوسط', sort: 3 }];
  const S = (n) => db.subjects.find((s) => s.name === n).id;
  // الصفوف مبدئياً كل الصفوف الثلاثة؛ تُعدل من صفحة المعلمات
  db.teacher_assignments = ROSTER.filter((r) => r[5]).flatMap(([t, , , , , s]) => db.grades.map((g) => ({ teacher_id: t, subject_id: S(s), grade_id: g.id })));
  // مواد إضافية بصف محدد: [المعلمة، المادة، الصف]
  [[P.chair, 'التربية الفنية', 2], [P.jumana, 'التربية الفنية', 3], [P.ahlam, 'التربية الفنية', 1],
    [P.noha, 'التربية البدنية', 1], [P.aisha, 'التربية البدنية', 3], [P.haya, 'التربية البدنية', 2],
    [P.munira, 'التربية الأسرية', 1], [P.munira, 'التربية الأسرية', 2], [P.t1, 'التربية الأسرية', 3],
    [P.chair, 'المهارات الرقمية', 2], [P.chair, 'المهارات الرقمية', 3], [P.ahlam, 'المهارات الرقمية', 3],
    [P.t3, 'اللغة الإنجليزية', 2], [P.jumana, 'اللغة الإنجليزية', 1], [P.shaima, 'اللغة الإنجليزية', 1], [P.thamra, 'اللغة الإنجليزية', 3],
    [P.muzna, 'الرياضيات', 1], [P.noura, 'الرياضيات', 2], [P.najwa, 'الرياضيات', 3]]
    .forEach(([t, s, g]) => db.teacher_assignments.push({ teacher_id: t, subject_id: S(s), grade_id: g }));
  db.categories = [
    ['remedial', 'الخطط العلاجية والإثرائية', 'الخطط العلاجية والإثرائية والبرامج المقدمة وشواهد التنفيذ وقياس الأثر', 1, true, false],
    ['satisfaction', 'قياس رضا أولياء الأمور', 'نماذج الاستبانات ونتائجها وتحليل الاستجابات والإجراءات التحسينية', 2, false, true],
    ['weekly', 'الخطط الأسبوعية', 'الخطط الأسبوعية لكل معلمة', 3, true, false],
    ['semester', 'الخطط الفصلية', 'الخطة الفصلية وتوزيع المنهج والأهداف والمهارات وأدوات التقويم', 4, true, false],
    ['period_tests', 'تحليل نتائج اختبارات الفترة', 'كشوف الدرجات وتحليل النتائج وخطط التحسين لكل مادة وصف وفترة', 5, true, true],
    ['diagnostic', 'تحليل نتائج الاختبار التشخيصي', 'نتائج الاختبارات التشخيصية وجداول المهارات والخطط العلاجية الناتجة', 6, true, true],
    ['learning_styles', 'أنماط التعلم', 'تقارير أنماط وتفضيلات التعلم والأنشطة والاستراتيجيات ومراعاة الفروق الفردية', 7, true, false],
    ['committee', 'الشواهد والتقارير العامة للجنة', 'محاضر الاجتماعات وخطة العمل والتقارير الدورية والمبادرات والتقرير الختامي', 8, false, false],
  ].map(([key, title, description, sort, per_teacher, student_data]) => ({ key, title, description, sort, per_teacher, student_data, icon: null }));
  const R = (category_key, title, due, checklist) => ({ id: uid(), category_key, title, description: null, teacher_id: null, due_date: due, checklist, active: true, sort: 1, created_by: P.chair, created_at: daysAgo(30) });
  db.requirements = [
    R('remedial', 'الخطة العلاجية', dateIn(-5), ['الفئة المستهدفة', 'مظاهر الضعف', 'أسباب الضعف', 'الأنشطة العلاجية', 'فترات المتابعة', 'مؤشرات قياس الأثر']),
    R('remedial', 'الخطة الإثرائية', dateIn(6), ['الفئة المستهدفة', 'مظاهر التفوق', 'الأنشطة الإثرائية', 'فترات المتابعة']),
    R('weekly', 'الخطة الأسبوعية', dateIn(2), ['المادة', 'الصف', 'الأسبوع الدراسي', 'موضوعات الدروس', 'الأهداف التعليمية', 'الواجبات والأنشطة', 'أساليب التقويم']),
    R('semester', 'الخطة الفصلية وتوزيع المنهج', dateIn(-12), ['توزيع المنهج', 'الأهداف التعليمية', 'المهارات الأساسية', 'الجدول الزمني', 'أدوات التقويم', 'مؤشرات الإنجاز']),
    R('period_tests', 'تحليل نتائج اختبار الفترة', dateIn(14), ['كشف الدرجات', 'متوسط الدرجات', 'نسبة النجاح', 'توزيع المستويات', 'خطة التحسين']),
    R('diagnostic', 'تحليل نتائج الاختبار التشخيصي', dateIn(-20), ['جدول المهارات', 'المهارات المتقنة', 'المهارات غير المتقنة', 'الفئات المستهدفة', 'التوصيات']),
    R('learning_styles', 'تقرير أنماط التعلم والفروق الفردية', dateIn(25), ['أداة تحديد تفضيلات التعلم', 'الاستراتيجيات', 'الأنشطة المتنوعة', 'الشواهد']),
  ];
  db.files = []; db.file_analyses = []; db.file_notes = []; db.folders = [];
  const F = (teacher, cat, name, status, opts = {}) => {
    const id = uid(); const ext = name.split('.').pop();
    db.files.push({ id, teacher_id: teacher, category_key: cat, folder_path: opts.path || '', requirement_id: opts.req === false ? null : (db.requirements.find((r) => r.category_key === cat)?.id || null),
      name, storage_path: `${teacher || 'general'}/${cat}/${id}.${ext}`, mime_type: '', ext, size_bytes: opts.size || 180000 + Math.round(Math.random() * 900000), sha256: uid(), status, status_reason: opts.reason || null,
      semester: 'الفصل الدراسي الأول', doc_date: null, doc_type: opts.doc_type || null, subject_id: opts.subject ? S(opts.subject) : null, grade_id: opts.grade || null,
      uploaded_by: teacher || P.chair, reviewed_by: status === 'approved' ? P.chair : null, reviewed_at: status === 'approved' ? daysAgo(1) : null, import_job_id: null, created_at: daysAgo(opts.ago ?? Math.random() * 12), updated_at: now() });
    return id;
  };
  const A = (file, a) => db.file_analyses.push({ id: uid(), file_id: file, created_at: daysAgo(0.5), method: 'pdf-vision', model: 'claude-sonnet-5-5', is_latest: true, reviewed: false, quality_notes: [], recommendations: [], unknown_fields: [], extracted_text: '', error: null, stats: null, ...a });

  let id = F(P.t1, 'remedial', 'الخطة العلاجية - علوم أول متوسط.pdf', 'needs_review', { subject: 'العلوم', grade: 1, doc_type: 'remedial_plan', reason: 'عنصران ناقصان', ago: 1 });
  A(id, { doc_type: 'remedial_plan', doc_type_label: 'خطة علاجية', summary: 'خطة علاجية لطالبات الصف الأول المتوسط في مادة العلوم تستهدف ضعف مهارات قراءة الرسوم البيانية وتفسير التجارب. تتضمن أنشطة علاجية أسبوعية ومتابعة كل أسبوعين، لكنها لا تحدد مؤشرات واضحة لقياس الأثر ولا أسباب الضعف.',
    extracted: { teacher_name: 'الأستاذة غزوة العتيبي', subject: 'العلوم', grade: 'الأول المتوسط', semester: 'الفصل الدراسي الأول', academic_year: '1448هـ', date: null, week: null, title: 'خطة علاجية', confidence: 'high',
      sections: [{ title: 'الأهداف', items: ['تحسين قراءة الرسوم البيانية', 'تفسير نتائج التجارب البسيطة'] }, { title: 'الإجراءات والأنشطة', items: ['بطاقات تدريبية أسبوعية', 'تعلم بالأقران', 'أوراق عمل متدرجة'] }, { title: 'الفئات المستهدفة', items: ['6 طالبات من الصف الأول المتوسط (أ)'] }] },
    elements: [{ item: 'الفئة المستهدفة', status: 'present', note: '6 طالبات' }, { item: 'مظاهر الضعف', status: 'present', note: 'قراءة الرسوم البيانية' }, { item: 'أسباب الضعف', status: 'missing', note: 'لم تُذكر أسباب الضعف' }, { item: 'الأنشطة العلاجية', status: 'present', note: 'بطاقات وأوراق عمل' }, { item: 'فترات المتابعة', status: 'present', note: 'كل أسبوعين' }, { item: 'مؤشرات قياس الأثر', status: 'missing', note: 'لا توجد أداة قياس قبلي/بعدي' }],
    quality_notes: ['الخطة مكتوبة بوضوح ومنظمة في جدول'], recommendations: ['إضافة قياس قبلي وبعدي لتحديد أثر الخطة', 'تحديد أسباب الضعف لكل طالبة (معرفية، أسرية، ذاتية)'], unknown_fields: ['التاريخ'] });
  id = F(P.t1, 'weekly', 'الخطة الأسبوعية - الأسبوع 6.pdf', 'approved', { subject: 'العلوم', grade: 1, path: 'العلوم/الأول المتوسط', ago: 3 });
  A(id, { doc_type: 'weekly_plan', doc_type_label: 'خطة أسبوعية', summary: 'خطة الأسبوع السادس لمادة العلوم للصف الأول المتوسط تشمل درسَي الخلية ووظائفها مع واجب وتقويم ختامي.', extracted: { teacher_name: 'الأستاذة غزوة العتيبي', subject: 'العلوم', grade: 'الأول المتوسط', semester: null, academic_year: null, date: null, week: 'الأسبوع السادس', title: 'الخطة الأسبوعية', confidence: 'high', sections: [{ title: 'موضوعات الدروس', items: ['الخلية', 'وظائف أجزاء الخلية'] }] },
    elements: ['المادة', 'الصف', 'الأسبوع الدراسي', 'موضوعات الدروس', 'الأهداف التعليمية', 'الواجبات والأنشطة', 'أساليب التقويم'].map((item) => ({ item, status: 'present', note: '' })) });
  db.file_notes.push({ id: uid(), file_id: id, author_id: P.chair, kind: 'approve', body: 'خطة مكتملة', created_at: daysAgo(1) });
  const rows = [['م', 'اسم الطالبة', 'الاختبار القصير (10)', 'اختبار الفترة من 20', 'المجموع'], ['', 'الدرجة العظمى', 10, 20, 30]];
  const nm = ['طالبة أ', 'طالبة ب', 'طالبة ج', 'طالبة د', 'طالبة هـ', 'طالبة و', 'طالبة ز', 'طالبة ح', 'طالبة ط', 'طالبة ي', 'طالبة ك', 'طالبة ل', 'طالبة م', 'طالبة ن', 'طالبة س', 'طالبة ع', 'طالبة ف', 'طالبة ص', 'طالبة ق', 'طالبة ر'];
  const scores = [[9, 18], [7, 14], [5, 9], [10, 19], [8, 15], [6, 12], [4, 7], [9, 17], [7, 13], [8, 16], [3, 6], [10, 20], [6, 11], [7, 15], [9, 18], [5, 10], [8, 14], [6, 'غ'], [9, 19], [7, 12]];
  nm.forEach((n, i) => rows.push([i + 1, n, scores[i][0], scores[i][1], typeof scores[i][1] === 'number' ? scores[i][0] + scores[i][1] : scores[i][0]]));
  const gs = analyzeGradeSheet(rows, { passPct: 50, masteryPct: 80 }); gs.sheet = 'الفترة الأولى';
  id = F(P.t1, 'period_tests', 'كشف درجات الفترة الأولى - علوم ثالث.xlsx', 'read_ok', { subject: 'العلوم', grade: 3, path: 'العلوم/الثالث المتوسط/الفترة الأولى', ago: 2 });
  A(id, { method: 'spreadsheet', doc_type: 'period_test_analysis', doc_type_label: 'تحليل نتائج اختبارات الفترة', stats: gs, summary: 'كشف درجات الفترة الأولى لمادة العلوم (20 طالبة). المتوسط والنسب محسوبة من الكشف. توجد طالبة غائبة عن اختبار الفترة.',
    extracted: { teacher_name: null, subject: 'العلوم', grade: 'الثالث المتوسط', semester: null, academic_year: null, date: null, week: null, title: 'الفترة الأولى', confidence: 'medium', sections: [{ title: 'المهارات التي تحتاج إلى تحسين', items: ['حل المسائل التطبيقية', 'تفسير الرسوم البيانية'] }] },
    elements: [{ item: 'كشف الدرجات', status: 'present', note: '' }, { item: 'متوسط الدرجات', status: 'present', note: 'محسوب' }, { item: 'نسبة النجاح', status: 'present', note: 'محسوبة' }, { item: 'توزيع المستويات', status: 'present', note: 'محسوب' }, { item: 'خطة التحسين', status: 'missing', note: 'لم تُرفق خطة تحسين' }],
    recommendations: ['إعداد خطة علاجية لمجموعة الطالبات دون الحد', 'برنامج إثرائي للطالبات اللاتي تجاوزن 90٪'] });
  const dg = analyzeGradeSheet([['الاسم', 'جمع الكسور (5)', 'ضرب الأعداد العشرية (5)', 'حل المعادلات (5)', 'قراءة الجداول (5)'],
    ...['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي', 'ك', 'ل'].map((n, i) => ['طالبة ' + n, [5, 4, 3, 5, 4, 2, 5, 4, 5, 3, 4, 5][i], [2, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3][i], [4, 4, 3, 5, 4, 3, 4, 2, 5, 4, 3, 4][i], [5, 5, 4, 5, 4, 4, 5, 5, 4, 3, 5, 5][i]])], { masteryPct: 80, mode: 'diagnostic' });
  id = F(P.noura, 'diagnostic', 'الاختبار التشخيصي - رياضيات ثاني.xlsx', 'approved', { subject: 'الرياضيات', grade: 2, ago: 15 });
  A(id, { method: 'spreadsheet', doc_type: 'diagnostic_analysis', doc_type_label: 'تحليل نتائج الاختبار التشخيصي', stats: dg, summary: 'نتائج الاختبار التشخيصي لأربع مهارات (12 طالبة). مهارة ضرب الأعداد العشرية تحتاج تدخلاً علاجياً.', extracted: { subject: 'الرياضيات', grade: 'الثاني المتوسط', confidence: 'high', sections: [] },
    elements: [{ item: 'جدول المهارات', status: 'present', note: '' }, { item: 'المهارات غير المتقنة', status: 'present', note: 'ضرب الأعداد العشرية' }] });
  id = F(P.noura, 'remedial', 'خطة علاجية - ضرب الأعداد العشرية.docx', 'approved', { subject: 'الرياضيات', grade: 2, ago: 10 });
  A(id, { method: 'docx', doc_type: 'remedial_plan', doc_type_label: 'خطة علاجية', summary: 'خطة علاجية ناتجة عن الاختبار التشخيصي لمهارة ضرب الأعداد العشرية.', extracted: { confidence: 'high', sections: [{ title: 'مؤشرات قياس الأثر', items: ['اختبار قصير بعد 3 أسابيع', 'نسبة الإتقان المستهدفة 70٪'] }] }, elements: [{ item: 'الفئة المستهدفة', status: 'present', note: '' }, { item: 'مؤشرات قياس الأثر', status: 'present', note: '' }] });
  id = F(P.t2, 'weekly', 'خطة أسبوعية لغتي.jpg', 'failed', { subject: 'اللغة العربية', grade: 2, reason: 'الصورة غير واضحة؛ تعذرت قراءة النص', ago: 0.3 });
  A(id, { method: 'ocr-image', error: 'الصورة غير واضحة؛ تعذرت قراءة النص. أعيدي التصوير بإضاءة جيدة أو ارفعي PDF.' });
  F(P.t2, 'semester', 'توزيع منهج لغتي الخالدة - ثاني متوسط.pdf', 'needs_completion', { subject: 'اللغة العربية', grade: 2, reason: 'ينقص الجدول الزمني وأدوات التقويم', ago: 4 });
  F(P.saraobaid, 'weekly','الخطة الأسبوعية - الدراسات الإسلامية.pdf', 'unprocessed', { subject: 'الدراسات الإسلامية', grade: 2, ago: 0.1 });
  id = F(P.ahlam, 'learning_styles','تقرير مراعاة الفروق الفردية.pdf', 'read_ok', { subject: 'المهارات الرقمية', grade: 3, ago: 5 });
  A(id, { doc_type: 'learning_styles', doc_type_label: 'أنماط التعلم', summary: 'تقرير يوضح تنويع الاستراتيجيات في مادة المهارات الرقمية بما يراعي تفضيلات التعلم المختلفة.', extracted: { confidence: 'high', sections: [{ title: 'الاستراتيجيات المستخدمة', items: ['التعلم التعاوني', 'التعلم القائم على المشروعات', 'العروض المرئية'] }, { title: 'الأنشطة المتنوعة', items: ['تصميم عرض تقديمي', 'تحدي برمجي قصير'] }] }, elements: [{ item: 'الاستراتيجيات', status: 'present', note: '' }, { item: 'الشواهد', status: 'present', note: '' }] });
  const sv = analyzeSurvey([['الطابع الزمني', 'تتواصل المدرسة معي بشأن مستوى ابنتي', 'أنا راضٍ عن مستوى تحصيل ابنتي', 'البرامج العلاجية مفيدة لابنتي', 'ملاحظاتك'],
    ...Array.from({ length: 34 }, (_, i) => ['', ['موافق بشدة', 'موافق', 'موافق', 'محايد', 'موافق بشدة', 'غير موافق'][i % 6], ['موافق', 'موافق بشدة', 'محايد', 'موافق', 'غير موافق', 'موافق'][i % 6], ['موافق بشدة', 'موافق', 'محايد', 'محايد', 'موافق', 'موافق بشدة'][i % 6], i % 5 === 0 ? 'نأمل زيادة التواصل حول الواجبات' : ''])]);
  id = F(null, 'satisfaction', 'نتائج استبانة رضا أولياء الأمور.csv', 'approved', { req: false, ago: 7 });
  A(id, { method: 'spreadsheet', doc_type: 'parent_satisfaction', doc_type_label: 'قياس رضا أولياء الأمور', stats: sv, summary: 'نتائج 34 استجابة من أولياء الأمور على ثلاث عبارات. أعلى رضا عن البرامج العلاجية، وأدناه عن مستوى التحصيل.', extracted: { confidence: 'high', sections: [] }, elements: [] });
  F(null, 'committee', 'محضر الاجتماع الأول 1448.pdf', 'approved', { req: false, path: 'محاضر الاجتماعات', ago: 20 });
  F(null, 'committee', 'خطة رفع المستوى التحصيلي.pdf', 'approved', { req: false, path: 'خطة العمل', ago: 25 });
  ['العلوم/الأول المتوسط', 'العلوم/الثالث المتوسط', 'العلوم/الثالث المتوسط/الفترة الأولى', 'العلوم'].forEach((p) => db.folders.push({ id: uid(), category_key: p.includes('الفترة') ? 'period_tests' : 'weekly', teacher_id: P.t1, path: p, created_by: P.chair, created_at: daysAgo(9) }));
  db.notifications = [
    { id: uid(), user_id: P.chair, kind: 'deadline', title: 'ملفات بانتظار مراجعتك', body: '3 ملفات قُرئت وتحتاج مراجعة', link: '#/review', read_at: null, created_at: daysAgo(0.2), dedupe_key: null },
    { id: uid(), user_id: P.t1, kind: 'approved', title: 'تم اعتماد ملفك', body: 'الخطة الأسبوعية - الأسبوع 6.pdf', link: '#/folders', read_at: null, created_at: daysAgo(1), dedupe_key: null },
    { id: uid(), user_id: P.t1, kind: 'deadline', title: 'اقترب الموعد النهائي: الخطة الأسبوعية', body: 'الموعد: ' + dateIn(2), link: '#/tasks', read_at: null, created_at: daysAgo(0.5), dedupe_key: null },
  ];
  db.reports = []; db.import_jobs = [];
  db.audit_log = db.files.map((f, i) => ({ id: i + 1, actor_id: f.uploaded_by, action: 'insert', entity: 'files', entity_id: f.id, details: { name: f.name, status: 'unprocessed' }, at: f.created_at }));
  return db;
}

// ---------------------------------------------------------------------
//  الحالة
// ---------------------------------------------------------------------
const KEY = 'tahseel-demo-db-v10';
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ } },
};
let DB;
try { DB = JSON.parse(store.get(KEY) || 'null'); } catch (e) { DB = null; }
if (!DB) DB = seed();
const blobs = new Map();
const persist = () => store.set(KEY, JSON.stringify(DB));
let SESSION = null;
try { SESSION = JSON.parse(store.get('tahseel-demo-session') || 'null'); } catch (e) { SESSION = null; }
const me = () => DB.profiles.find((p) => p.id === SESSION?.user?.id);
const isStaff = () => ['principal', 'chair', 'committee'].includes(me()?.role);
const isAdmin = () => ['principal', 'chair'].includes(me()?.role);

// "صلاحيات" مبسطة تحاكي سياسات الخادم
function visible(table, rows) {
  const u = me();
  if (!u) return table === 'settings' ? rows : [];
  if (isStaff()) {
    if (table === 'notifications') return rows.filter((r) => r.user_id === u.id);
    if (table === 'audit_log' && !isAdmin()) return [];
    return rows;
  }
  switch (table) {
    case 'files': case 'folders': return rows.filter((r) => r.teacher_id === u.id);
    case 'file_analyses': case 'latest_analyses': case 'file_notes': return rows.filter((r) => DB.files.find((f) => f.id === r.file_id)?.teacher_id === u.id);
    case 'profiles': return rows.filter((r) => r.id === u.id);
    case 'teacher_assignments': return rows.filter((r) => r.teacher_id === u.id);
    case 'requirements': return rows.filter((r) => !r.teacher_id || r.teacher_id === u.id);
    case 'notifications': return rows.filter((r) => r.user_id === u.id);
    case 'reports': return rows.filter((r) => r.teacher_id === u.id && r.approved);
    case 'requirement_status': case 'teacher_progress': return rows.filter((r) => r.teacher_id === u.id);
    case 'audit_log': case 'import_jobs': return [];
    default: return rows;
  }
}

function requirementStatus() {
  const out = [];
  DB.profiles.filter((p) => p.is_teacher && p.active).forEach((p) => DB.requirements.filter((r) => r.active && (!r.teacher_id || r.teacher_id === p.id)).forEach((r) => {
    const fs = DB.files.filter((f) => f.requirement_id === r.id && f.teacher_id === p.id);
    const ap = fs.filter((f) => f.status === 'approved').length, rt = fs.filter((f) => f.status === 'needs_completion').length;
    out.push({ teacher_id: p.id, full_name: p.full_name, requirement_id: r.id, title: r.title, category_key: r.category_key, due_date: r.due_date,
      files_count: fs.length, approved_count: ap, returned_count: rt, pending_count: fs.length - ap - rt,
      state: ap ? 'complete' : rt ? 'incomplete' : fs.length ? 'submitted' : 'missing', last_upload: fs[0]?.created_at || null });
  }));
  return out;
}
function teacherProgress() {
  const rs = requirementStatus();
  return DB.profiles.filter((p) => p.is_teacher).map((p) => {
    const r = rs.filter((x) => x.teacher_id === p.id); const fs = DB.files.filter((f) => f.teacher_id === p.id);
    const required = r.length, submitted = r.filter((x) => x.state !== 'missing').length, complete = r.filter((x) => x.state === 'complete').length;
    return { teacher_id: p.id, full_name: p.full_name, username: p.username, active: p.active, last_login_at: p.last_login_at, last_upload_at: p.last_upload_at, role: p.role,
      required, submitted, complete, missing: r.filter((x) => x.state === 'missing').length, returned: r.filter((x) => x.state === 'incomplete').length,
      files: fs.length, to_review: fs.filter((f) => ['read_ok', 'needs_review'].includes(f.status)).length,
      submit_pct: required ? Math.round((100 * submitted) / required) : 0, complete_pct: required ? Math.round((100 * complete) / required) : 0 };
  });
}
const source = (t) => t === 'requirement_status' ? requirementStatus() : t === 'teacher_progress' ? teacherProgress() : t === 'latest_analyses' ? DB.file_analyses.filter((a) => a.is_latest) : (DB[t] ||= []);

function notify(user_id, kind, title, body, link) { DB.notifications.unshift({ id: uid(), user_id, kind, title, body, link, read_at: null, created_at: now(), dedupe_key: null }); }
function audit(action, entity, entity_id, details) { DB.audit_log.unshift({ id: DB.audit_log.length + 1, actor_id: me()?.id || null, action, entity, entity_id, details, at: now() }); }

// ---------------------------------------------------------------------
//  باني الاستعلامات
// ---------------------------------------------------------------------
class Query {
  constructor(table) { this.t = table; this.f = []; this.ord = []; this.lim = null; this.rng = null; this.op = 'select'; this.payload = null; this._one = 0; this.ret = false; this.headCount = false; }
  select(cols, opts) { if (this.op === 'select') this.op = 'select'; else this.ret = true; if (opts?.head) this.headCount = true; return this; }
  insert(p) { this.op = 'insert'; this.payload = p; return this; }
  update(p) { this.op = 'update'; this.payload = p; return this; }
  upsert(p) { this.op = 'upsert'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.f.push((r) => r[c] === v); return this; }
  neq(c, v) { this.f.push((r) => r[c] !== v); return this; }
  is(c, v) { this.f.push((r) => (v === null ? r[c] === null || r[c] === undefined : r[c] === v)); return this; }
  in(c, vs) { this.f.push((r) => vs.includes(r[c])); return this; }
  lt(c, v) { this.f.push((r) => r[c] < v); return this; }
  order(c, o = {}) { this.ord.push([c, o.ascending !== false, o.nullsFirst]); return this; }
  limit(n) { this.lim = n; return this; }
  range(a, b) { this.rng = [a, b]; return this; }
  maybeSingle() { this._one = 1; return this; }
  single() { this._one = 2; return this; }
  then(res, rej) { return Promise.resolve().then(() => this.exec()).then(res, rej); }
  exec() {
    const T = this.t;
    if (this.op === 'insert' || this.op === 'upsert') {
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r) => ({ id: r.id || (T === 'subjects' || T === 'grades' ? Math.max(0, ...DB[T].map((x) => x.id)) + 1 : uid()), created_at: now(), ...r }));
      if (T === 'files' && !isStaff()) rows.forEach((r) => { if (r.teacher_id !== me().id) throw new Error('لا يمكنك الرفع إلا في مجلدك'); r.status = 'unprocessed'; });
      if (T === 'files') rows.forEach((r) => { r.status ||= 'unprocessed'; r.updated_at = now(); audit('insert', 'files', r.id, { name: r.name }); });
      if (T === 'folders') for (const r of rows) if (DB.folders.some((x) => x.category_key === r.category_key && x.teacher_id === r.teacher_id && x.path === r.path)) return { data: null, error: { message: 'duplicate key value' } };
      if (T === 'requirements') rows.forEach((r) => { r.active ??= true; r.checklist ||= []; DB.profiles.filter((p) => p.is_teacher && p.active && (!r.teacher_id || r.teacher_id === p.id)).forEach((p) => notify(p.id, 'requirement', 'متطلب جديد: ' + r.title, r.due_date ? 'الموعد النهائي: ' + r.due_date : '', '#/tasks')); });
      if (T === 'reports') rows.forEach((r) => { r.approved = false; });
      if (T === 'import_jobs') rows.forEach((r) => { r.status = 'running'; r.report = {}; });
      (DB[T] ||= []).push(...rows); persist();
      return { data: this._one ? rows[0] : rows, error: null };
    }
    let rows = visible(T, source(T)).filter((r) => this.f.every((fn) => fn(r)));
    if (this.op === 'update') {
      if (T === 'files' && !isStaff()) for (const r of rows) if (r.status === 'approved') return { data: null, error: { message: 'الملف معتمد ولا يمكن تعديله' } };
      rows.forEach((r) => { Object.assign(r, this.payload); if (T === 'files') r.updated_at = now(); });
      if (T === 'files') rows.forEach((r) => audit('update', 'files', r.id, { after: { name: r.name, status: r.status } }));
      persist();
      return { data: this._one ? rows[0] : rows, error: null };
    }
    if (this.op === 'delete') {
      if (T === 'files' && !isStaff() && rows.some((r) => r.status === 'approved')) return { data: null, error: { message: 'الملف معتمد ولا يمكن حذفه' } };
      const ids = new Set(rows.map((r) => r)); DB[T] = DB[T].filter((r) => !ids.has(r));
      if (T === 'files') { rows.forEach((r) => audit('delete', 'files', r.id, { name: r.name })); DB.file_analyses = DB.file_analyses.filter((a) => DB.files.some((f) => f.id === a.file_id)); }
      persist();
      return { data: rows, error: null };
    }
    for (const [c, asc] of [...this.ord].reverse()) rows = [...rows].sort((a, b) => { const x = a[c], y = b[c]; if (x === y) return 0; if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : 1) * (asc ? 1 : -1); });
    const count = rows.length;
    if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1);
    if (this.lim) rows = rows.slice(0, this.lim);
    if (this.headCount) return { data: null, count, error: null };
    if (this._one) { if (!rows[0] && this._one === 2) return { data: null, error: { message: 'not found' } }; return { data: rows[0] ? structuredClone(rows[0]) : null, error: null }; }
    return { data: structuredClone(rows), count, error: null };
  }
}

// ---------------------------------------------------------------------
//  الدوال (RPC)
// ---------------------------------------------------------------------
function rpc(name, args = {}) {
  const u = me();
  if (name === 'touch_login') { if (u) u.last_login_at = now(); persist(); return null; }
  if (name === 'run_deadline_alerts') return 0;
  if (name === 'dashboard_stats') {
    const rs = visible('requirement_status', requirementStatus()); const fs = visible('files', DB.files);
    const tp = visible('teacher_progress', teacherProgress());
    return {
      teachers: isStaff() ? DB.profiles.filter((p) => p.is_teacher && p.active).length : 1, subjects: DB.subjects.length, files: fs.length,
      analyzed: new Set(visible('file_analyses', DB.file_analyses).filter((a) => !a.error).map((a) => a.file_id)).size,
      complete: fs.filter((f) => f.status === 'approved').length, incomplete: fs.filter((f) => ['needs_completion', 'failed'].includes(f.status)).length,
      to_review: fs.filter((f) => ['read_ok', 'needs_review'].includes(f.status)).length,
      req_total: rs.length, req_submitted: rs.filter((r) => r.state !== 'missing').length, req_complete: rs.filter((r) => r.state === 'complete').length,
      teachers_committed: tp.filter((p) => p.required && !p.missing).length, teachers_with_reqs: tp.filter((p) => p.required).length,
      by_category: DB.categories.map((c) => ({ key: c.key, title: c.title, sort: c.sort, required: rs.filter((r) => r.category_key === c.key).length, submitted: rs.filter((r) => r.category_key === c.key && r.state !== 'missing').length, complete: rs.filter((r) => r.category_key === c.key && r.state === 'complete').length, files: fs.filter((f) => f.category_key === c.key).length })),
    };
  }
  if (name === 'search_files') {
    const qq = String(args.q || '');
    return visible('files', DB.files).map((f) => { const a = DB.file_analyses.find((x) => x.file_id === f.id && x.is_latest);
      const hay = [f.name, a?.summary, a?.doc_type_label, a?.extracted_text, JSON.stringify(a?.extracted?.sections || [])].join(' ');
      return hay.includes(qq) ? { file_id: f.id, name: f.name, teacher_id: f.teacher_id, category_key: f.category_key, status: f.status, snippet: (a?.summary || '').slice(0, 220), rank: 1 } : null; }).filter(Boolean);
  }
  if (name === 'review_file') {
    if (!isStaff()) throw new Error('غير مصرح');
    if (args.p_decision === 'approve' && !isAdmin()) throw new Error('الاعتماد من صلاحية المديرة أو رئيسة اللجنة');
    const f = DB.files.find((x) => x.id === args.p_file);
    const map = { approve: 'approved', return: 'needs_completion', reopen: 'needs_review' };
    if (map[args.p_decision]) { f.status = map[args.p_decision]; f.reviewed_by = u.id; f.reviewed_at = now(); f.status_reason = args.p_decision === 'return' ? args.p_note : args.p_decision === 'approve' ? null : f.status_reason; }
    DB.file_notes.unshift({ id: uid(), file_id: f.id, author_id: u.id, kind: args.p_decision, body: args.p_note || '', created_at: now() });
    if (f.teacher_id) notify(f.teacher_id, { approve: 'approved', return: 'returned', note: 'note', reopen: 'info' }[args.p_decision], { approve: 'تم اعتماد ملفك', return: 'أُعيد ملف لاستكمال النواقص', note: 'ملاحظة إدارية على ملف', reopen: 'أعيد فتح مراجعة ملف' }[args.p_decision], f.name + (args.p_note ? ' — ' + args.p_note : ''), '#/file/' + f.id);
    audit('insert', 'file_notes', f.id, { kind: args.p_decision, body: args.p_note });
    persist(); return f;
  }
  if (name === 'send_notification') {
    const ts = DB.profiles.filter((p) => p.is_teacher && p.active && (!args.p_user || p.id === args.p_user));
    ts.forEach((p) => notify(p.id, 'admin', args.p_title, args.p_body, args.p_link)); persist(); return ts.length;
  }
  throw new Error('rpc غير معروف: ' + name);
}

// ---------------------------------------------------------------------
//  الوظائف (admin-users / ai) — محاكاة
// ---------------------------------------------------------------------
async function invoke(name, body) {
  await new Promise((r) => setTimeout(r, 350));
  if (name === 'admin-users') {
    if (body.action === 'status') return { needs_setup: false };
    if (!isAdmin()) throw new Error('هذه العملية للمديرة ورئيسة اللجنة فقط');
    if (body.action === 'create') {
      if (DB.profiles.some((p) => p.username === body.username)) throw new Error('اسم المستخدم مستخدم مسبقاً');
      const id = uid();
      DB.profiles.push({ id, username: body.username, full_name: body.full_name, role: body.role || 'teacher', is_teacher: body.is_teacher, employee_code: body.employee_code || null, onedrive_url: body.onedrive_url || null, active: true, last_login_at: null, last_upload_at: null, created_at: now() });
      (body.assignments || []).forEach((a) => DB.teacher_assignments.push({ teacher_id: id, ...a }));
      audit('create_account', 'accounts', id, { username: body.username }); persist(); return { ok: true, id };
    }
    const p = DB.profiles.find((x) => x.id === body.id);
    if (body.action === 'update') { Object.assign(p, { full_name: body.full_name, role: body.role, is_teacher: body.is_teacher, employee_code: body.employee_code, username: body.username, onedrive_url: body.onedrive_url || null });
      if (body.assignments) { DB.teacher_assignments = DB.teacher_assignments.filter((a) => a.teacher_id !== p.id).concat(body.assignments.map((a) => ({ teacher_id: p.id, ...a }))); } persist(); return { ok: true }; }
    if (body.action === 'reset_password') return { ok: true };
    if (body.action === 'set_active') { p.active = body.active; persist(); return { ok: true }; }
    if (body.action === 'delete') { if (DB.files.some((f) => f.teacher_id === p.id)) throw new Error('لهذه المعلمة ملفات محفوظة؛ أوقفي الحساب بدلاً من حذفه'); DB.profiles = DB.profiles.filter((x) => x !== p); persist(); return { ok: true }; }
  }
  if (name === 'ai') {
    if (body.action === 'config') return { ai_ready: true, has_key: true, ai_enabled: true, model: 'محاكاة (نسخة تجريبية)' };
    if (body.action === 'analyze') {
      const f = DB.files.find((x) => x.id === body.file_id);
      if (!f) throw new Error('الملف غير موجود');
      await new Promise((r) => setTimeout(r, 700));
      DB.file_analyses.forEach((a) => { if (a.file_id === f.id) a.is_latest = false; });
      const reqs = DB.requirements.find((r) => r.id === f.requirement_id)?.checklist || [];
      const elements = reqs.map((item, i) => ({ item, status: i % 4 === 3 ? 'missing' : 'present', note: i % 4 === 3 ? 'لم يُعثر على هذا العنصر (محاكاة)' : 'موجود (محاكاة)' }));
      const cat = DB.categories.find((c) => c.key === f.category_key);
      DB.file_analyses.push({ id: uid(), file_id: f.id, created_at: now(), method: ['xlsx', 'xls', 'csv'].includes(f.ext) ? 'spreadsheet' : f.ext === 'docx' ? 'docx' : 'pdf-vision', model: 'محاكاة', is_latest: true, reviewed: false,
        doc_type: f.category_key, doc_type_label: cat.title, stats: body.stats || null, extracted_text: (body.text || '').slice(0, 5000),
        summary: 'هذا ملخص تجريبي: في النسخة الفعلية يقرأ Claude الملف ويستخرج محتواه ويقارنه بالعناصر المطلوبة.' + (body.stats?.ok ? ' الإحصاءات المعروضة محسوبة فعلياً من الملف الذي رفعتِه.' : ''),
        extracted: { teacher_name: me().full_name, subject: null, grade: null, semester: null, academic_year: null, date: null, week: null, title: f.name, confidence: 'medium', sections: [] },
        elements, quality_notes: ['محاكاة: لا تُرسل الملفات لأي خدمة في النسخة التجريبية'], recommendations: ['توصية تجريبية'], unknown_fields: ['المادة', 'الصف', 'التاريخ'], error: null });
      const keep = ['approved', 'needs_completion'].includes(f.status);
      if (!keep) { f.status = elements.some((e) => e.status !== 'present') ? 'needs_review' : 'read_ok'; f.status_reason = f.status === 'needs_review' ? 'عناصر ناقصة' : null; }
      persist(); return { ok: true, status: f.status };
    }
    if (body.action === 'assistant') {
      const rs = visible('requirement_status', requirementStatus()).filter((r) => r.state !== 'complete');
      const byT = {}; rs.forEach((r) => (byT[r.full_name] ||= []).push(`${r.title} (${({ missing: 'لم يُرفع', submitted: 'بانتظار الاعتماد', incomplete: 'معاد للاستكمال' })[r.state]})`));
      const review = visible('files', DB.files).filter((f) => ['read_ok', 'needs_review'].includes(f.status));
      return { answer: `**إجابة تجريبية من بيانات النسخة التجريبية** (في النسخة الفعلية يجيب Claude عن سؤالك بالتفصيل):\n\n**المتطلبات غير المكتملة:**\n${Object.entries(byT).map(([t, l]) => `- ${t}: ${l.join('، ')}`).join('\n') || '- لا يوجد'}\n\n**ملفات بانتظار المراجعة:**\n${review.map((f) => `- [${f.name}](#/file/${f.id})`).join('\n') || '- لا يوجد'}`,
        sources: review.map((f) => ({ id: f.id, name: f.name })) };
    }
    if (body.action === 'narrative') {
      const facts = body.data?.facts || [];
      return { ok: true, model: 'محاكاة', text: { executive_summary: 'ملخص تجريبي: في النسخة الفعلية يصوغ Claude ملخصاً رسمياً من أرقام التقرير فقط. ' + facts.slice(0, 3).map((f) => `${f.label}: ${f.value}`).join('؛ ') + '.',
        key_findings: facts.slice(0, 4).map((f) => `${f.label} بلغ ${f.value}`), strengths: ['(تجريبي) انتظام رفع الخطط الأسبوعية لدى عدد من المعلمات'], improvements: ['(تجريبي) استكمال مؤشرات قياس الأثر في الخطط العلاجية'],
        recommendations: ['(تجريبي) متابعة المتطلبات المتأخرة أسبوعياً', '(تجريبي) ربط كل خطة علاجية بنتائج الاختبار التشخيصي'], actions: ['(تجريبي) اجتماع قصير مع المعلمات ذوات النواقص'], data_limits: ['(تجريبي) لا تتوفر بيانات مقارنة بين فترتين لكل المواد'] } };
    }
  }
  throw new Error('وظيفة غير معروفة');
}

// ---------------------------------------------------------------------
//  واجهة شبيهة بـ supabase-js
// ---------------------------------------------------------------------
const tinyPdf = (title) => new Blob([`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj 4 0 obj<</Length 60>>stream\nBT /F1 18 Tf 60 760 Td (Demo file - sample preview) Tj ET\nendstream endobj 5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`], { type: 'application/pdf' });
function blobFor(path) {
  if (blobs.has(path)) return blobs.get(path);
  const f = DB.files.find((x) => x.storage_path === path);
  if (f?.ext === 'csv' || f?.ext === 'xlsx') return new Blob(['الاسم,الدرجة\nطالبة أ,18\nطالبة ب,15\n'], { type: 'text/csv' });
  return tinyPdf(f?.name || 'demo');
}

export function createClient() {
  const listeners = [];
  return {
    auth: {
      async getSession() { return { data: { session: SESSION } }; },
      async getUser() { return { data: { user: SESSION?.user || null } }; },
      async signInWithPassword({ email }) {
        const un = email.split('@')[0];
        const p = DB.profiles.find((x) => x.username === un);
        if (!p) return { error: { message: 'Invalid login credentials' } };
        if (!p.active) return { error: { message: 'User is banned' } };
        SESSION = { user: { id: p.id, email } }; store.set('tahseel-demo-session', JSON.stringify(SESSION));
        listeners.forEach((l) => l('SIGNED_IN', SESSION)); return { error: null };
      },
      async signOut() { SESSION = null; store.del('tahseel-demo-session'); return { error: null }; },
      async updateUser() { return { error: null }; },
      onAuthStateChange(cb) { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
    },
    from: (t) => new Query(t),
    rpc: async (n, a) => { try { return { data: rpc(n, a), error: null }; } catch (e) { return { data: null, error: { message: e.message } }; } },
    functions: { invoke: async (n, { body }) => { try { return { data: await invoke(n, body), error: null }; } catch (e) { return { data: null, error: { message: e.message, context: { json: async () => ({ error: e.message }) } } }; } } },
    storage: {
      from: (bucket) => ({
        async upload(path, file) { blobs.set(path, file); return { data: { path }, error: null }; },
        async download(path) { return { data: blobFor(path), error: null }; },
        async createSignedUrl(path) { return { data: { signedUrl: URL.createObjectURL(blobFor(path)) }, error: null }; },
        async remove(paths) { paths.forEach((p) => blobs.delete(p)); return { data: null, error: null }; },
        getPublicUrl(path) { return { data: { publicUrl: blobs.has(path) ? URL.createObjectURL(blobs.get(path)) : 'assets/moe-logo-white.png' } }; },
      }),
    },
  };
}

export const DEMO_USERS = [
  ['amal', 'رئيسة اللجنة', 'الأستاذة أمل الشهري'],
  ['zahra', 'مديرة المدرسة', 'الأستاذة زهراء الشهراني'],
  ['noha', 'عضوة اللجنة', 'الأستاذة نهى الزهراني'],
  ['ghazwa', 'معلمة', 'الأستاذة غزوة العتيبي'],
];
export function resetDemo() { store.del(KEY); store.del('tahseel-demo-session'); }
