// إنشاء التقارير وعرضها وتصديرها (طباعة/PDF، Excel، Word)
import { App, sb, q, fn, catOf, subjectName, gradeName, teacherNameMap } from '../api.js';
import { esc, icon, fmtDate, fmtHijri, fmtNum, fmtPct, toast, errMsg, withBusy, refreshIcons, downloadBlob, confirmBox, STATUS, REQ_STATE, todayISO } from '../ui.js';
import { pageHead, Chart } from './_common.js';
import { REPORT_KINDS } from './reports.js';
import { getXLSX } from '../extract.js';
import { comparePeriods } from '../stats.js';
import { NAFES_KEY, NAFES_REQS, nafesSubjectIds } from '../nafes.js';

const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);

export default async function reportPage(view, params, query) {
  if (params.kind) return builder(view, params.kind, query);
  const r = await q.report(params.id);
  if (!r) throw new Error('التقرير غير موجود أو غير مشارك معك');
  return show(view, r.content, { saved: r });
}

async function builder(view, kind, query) {
  const def = REPORT_KINDS.find((k) => k[0] === kind);
  if (!def) throw new Error('نوع تقرير غير معروف');
  const people = await q.teachers();
  const teacherOpts = people.filter((p) => p.is_teacher);
  const filters = { teacher: query.teacher || '', semester: query.semester || '' };
  const content = await build(kind, filters, people);
  content.title = def[1] + (filters.teacher ? ` — ${teacherOpts.find((p) => p.id === filters.teacher)?.full_name || ''}` : '');
  view.innerHTML = `
    ${pageHead(esc(def[1]), 'تقرير مبني على البيانات الحالية في النظام.', '', `<a href="#/reports">التقارير</a> ${icon('chevron-left')} ${esc(def[1])}`)}
    <form class="card filters no-print" data-f style="margin-bottom:14px">
      ${`<select name="teacher"><option value="">كل المعلمات</option>${teacherOpts.map((p) => `<option value="${p.id}" ${filters.teacher === p.id ? 'selected' : ''}>${esc(p.full_name)}</option>`).join('')}</select>`}
      <input name="semester" placeholder="الفصل الدراسي (اختياري)" value="${esc(filters.semester)}">
      <button class="btn">${icon('filter')} تحديث</button>
    </form>
    <div data-report></div>`;
  view.querySelector('[data-f]').addEventListener('submit', (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (e.target.teacher.value) p.set('teacher', e.target.teacher.value);
    if (e.target.semester.value.trim()) p.set('semester', e.target.semester.value.trim());
    location.hash = `#/report/new/${kind}` + (p.toString() ? '?' + p : '');
  });
  return show(view.querySelector('[data-report]'), content, { filters });
}

// ---------------------------------------------------------------------
//  بناء محتوى التقرير من البيانات الفعلية
// ---------------------------------------------------------------------
async function build(kind, filters, people) {
  const names = teacherNameMap(people);
  let [prog, reqs, files] = await Promise.all([q.progress(), q.reqStatus(filters.teacher || undefined), q.files({ teacher: filters.teacher || undefined, limit: 10000 })]);
  if (filters.teacher) prog = prog.filter((p) => p.teacher_id === filters.teacher);
  if (filters.semester) files = files.filter((f) => (f.semester || '').includes(filters.semester));
  const C = { kind, generated_at: new Date().toISOString(), filters, facts: [], tables: [], charts: [], lists: [], notes: [], sources: [], narrative: null };
  const S = App.settings || {};
  C.header = { school: S.school_name, committee: S.committee_name, year: S.academic_year, semester: filters.semester || S.semester, principal: S.principal_name, directorate: S.directorate };
  const anFor = async (list) => { const a = await q.analyses(list.map((f) => f.id)); return Object.fromEntries(a.map((x) => [x.file_id, x])); };
  const cat = (k) => catOf(k).title;
  const src = (list) => list.slice(0, 300).map((f) => ({ id: f.id, name: f.name, teacher: names[f.teacher_id] || 'عام', folder: cat(f.category_key) }));
  const elems = (a) => { const e = a?.elements || []; return e.length ? `${e.filter((x) => x.status === 'present').length}/${e.length}` : '—'; };
  const missingEl = (a) => (a?.elements || []).filter((x) => x.status !== 'present').map((x) => x.item).join('، ');
  const statusL = (s) => STATUS[s]?.label || s;
  const teacherRows = prog.filter((p) => p.active && p.required > 0);

  const teachersSection = () => {
    const avg = teacherRows.length ? Math.round(teacherRows.reduce((s, p) => s + Number(p.submit_pct), 0) / teacherRows.length) : 0;
    C.facts.push(
      { label: 'عدد المعلمات المشمولات', value: fmtNum(teacherRows.length) },
      { label: 'متوسط نسبة الرفع', value: fmtPct(avg) },
      { label: 'معلمات أكملن رفع كل المتطلبات', value: fmtNum(teacherRows.filter((p) => p.missing === 0).length) },
      { label: 'معلمات لديهن ملفات معادة للاستكمال', value: fmtNum(teacherRows.filter((p) => p.returned > 0).length) });
    C.tables.push({ title: 'إنجاز المعلمات', columns: ['المعلمة', 'المطلوبة', 'المرفوعة', 'المعتمدة', 'الناقصة', 'المعادة', 'نسبة الرفع ٪', 'نسبة الاعتماد ٪'],
      rows: teacherRows.map((p) => [p.full_name, p.required, p.submitted, p.complete, p.missing, p.returned, Number(p.submit_pct), Number(p.complete_pct)]) });
    C.charts.push({ title: 'نسبة رفع المتطلبات لكل معلمة', type: 'bar', horizontal: true, labels: teacherRows.map((p) => p.full_name), datasets: [{ label: 'نسبة الرفع ٪', data: teacherRows.map((p) => Number(p.submit_pct)) }], max: 100 });
  };
  const completionSection = () => {
    const tot = reqs.length, sub = reqs.filter((r) => r.state !== 'missing').length, comp = reqs.filter((r) => r.state === 'complete').length;
    C.facts.push({ label: 'إجمالي المتطلبات (معلمة × متطلب)', value: fmtNum(tot) }, { label: 'المرفوع منها', value: `${fmtNum(sub)} (${fmtPct(pct(sub, tot))})` }, { label: 'المعتمد منها', value: `${fmtNum(comp)} (${fmtPct(pct(comp, tot))})` });
    const byCat = App.categories.map((c) => { const r = reqs.filter((x) => x.category_key === c.key); const s = r.filter((x) => x.state !== 'missing').length; const a = r.filter((x) => x.state === 'complete').length;
      return [c.title, r.length, s, a, pct(s, r.length), files.filter((f) => f.category_key === c.key).length]; }).filter((r) => r[1] || r[5]);
    C.tables.push({ title: 'الاكتمال حسب المجلد', columns: ['المجلد', 'المطلوب', 'المرفوع', 'المعتمد', 'نسبة الرفع ٪', 'عدد الملفات'], rows: byCat });
    const byReq = {}; reqs.forEach((r) => { const k = r.requirement_id; (byReq[k] ||= { t: r.title, c: r.category_key, d: r.due_date, n: 0, s: 0, a: 0 }); byReq[k].n++; if (r.state !== 'missing') byReq[k].s++; if (r.state === 'complete') byReq[k].a++; });
    C.tables.push({ title: 'الاكتمال حسب المتطلب', columns: ['المتطلب', 'المجلد', 'الموعد', 'المرفوع', 'المعتمد', 'من أصل'], rows: Object.values(byReq).map((r) => [r.t, cat(r.c), r.d || '—', r.s, r.a, r.n]) });
    C.charts.push({ title: 'نسبة الرفع حسب المجلد', type: 'bar', labels: byCat.map((r) => r[0]), datasets: [{ label: 'نسبة الرفع ٪', data: byCat.map((r) => r[4]) }], max: 100 });
  };
  const gapsSection = () => {
    const today = todayISO();
    const miss = reqs.filter((r) => r.state === 'missing' || r.state === 'incomplete');
    const bad = files.filter((f) => ['needs_completion', 'failed'].includes(f.status));
    C.facts.push({ label: 'متطلبات لم تُرفع', value: fmtNum(reqs.filter((r) => r.state === 'missing').length) },
      { label: 'منها متأخرة عن موعدها', value: fmtNum(reqs.filter((r) => r.state === 'missing' && r.due_date && r.due_date < today).length) },
      { label: 'ملفات معادة للاستكمال', value: fmtNum(files.filter((f) => f.status === 'needs_completion').length) },
      { label: 'ملفات تعذرت قراءتها', value: fmtNum(files.filter((f) => f.status === 'failed').length) });
    C.tables.push({ title: 'المتطلبات غير المكتملة', columns: ['المعلمة', 'المتطلب', 'المجلد', 'الموعد', 'الحالة', 'متأخر'],
      rows: miss.map((r) => [r.full_name, r.title, cat(r.category_key), r.due_date || '—', REQ_STATE[r.state]?.label || r.state, r.state === 'missing' && r.due_date && r.due_date < today ? 'نعم' : '']) });
    if (bad.length) C.tables.push({ title: 'ملفات تحتاج استكمالاً أو إعادة رفع', columns: ['المعلمة', 'الملف', 'المجلد', 'الحالة', 'السبب'], rows: bad.map((f) => [names[f.teacher_id] || 'عام', f.name, cat(f.category_key), statusL(f.status), f.status_reason || '']) });
    C.sources = src(bad);
  };

  if (kind === 'teachers') { teachersSection(); }
  else if (kind === 'completion') { completionSection(); }
  else if (kind === 'gaps') { gapsSection(); }
  else if (kind === 'remedial') {
    const list = files.filter((f) => f.category_key === 'remedial');
    const an = await anFor(list);
    const rem = list.filter((f) => an[f.id]?.doc_type === 'remedial_plan').length, enr = list.filter((f) => an[f.id]?.doc_type === 'enrichment_plan').length;
    C.facts.push({ label: 'ملفات الخطط والبرامج المرفوعة', value: fmtNum(list.length) }, { label: 'خطط علاجية (حسب القراءة الآلية)', value: fmtNum(rem) },
      { label: 'خطط إثرائية (حسب القراءة الآلية)', value: fmtNum(enr) }, { label: 'معتمدة', value: fmtNum(list.filter((f) => f.status === 'approved').length) },
      { label: 'لم تُقرأ أو تعذرت قراءتها', value: fmtNum(list.filter((f) => !an[f.id] || an[f.id].error).length) });
    C.tables.push({ title: 'الخطط والبرامج', columns: ['المعلمة', 'الملف', 'النوع', 'المادة', 'اكتمال العناصر', 'العناصر الناقصة', 'الحالة'],
      rows: list.map((f) => [names[f.teacher_id] || '', f.name, an[f.id]?.doc_type_label || '—', subjectName(f.subject_id) || an[f.id]?.extracted?.subject || '—', elems(an[f.id]), missingEl(an[f.id]), statusL(f.status)]) });
    const ind = list.flatMap((f) => (an[f.id]?.extracted?.sections || []).filter((s) => /مؤشر|قياس|أثر|اثر/.test(s.title)).flatMap((s) => s.items.map((i) => `${names[f.teacher_id] || ''}: ${i}`)));
    if (ind.length) C.lists.push({ title: 'مؤشرات قياس الأثر المستخرجة من الخطط', items: ind.slice(0, 40), extracted: true });
    C.sources = src(list);
  }
  else if (kind === 'period_tests' || kind === 'diagnostic') {
    const list = files.filter((f) => f.category_key === kind);
    const an = await anFor(list);
    const withStats = list.filter((f) => an[f.id]?.stats?.kind === 'grades' && an[f.id].stats.ok);
    C.facts.push({ label: 'ملفات مرفوعة', value: fmtNum(list.length) }, { label: 'ملفات بكشوف درجات قابلة للحساب', value: fmtNum(withStats.length) },
      { label: 'إجمالي الطالبات في الكشوف المحسوبة', value: fmtNum(withStats.reduce((s, f) => s + (an[f.id].stats.students || 0), 0)) });
    if (kind === 'period_tests') {
      const rows = withStats.map((f) => { const s = an[f.id].stats; const m = s.columns.find((c) => c.label === s.main_column) || {};
        return [names[f.teacher_id] || '', subjectName(f.subject_id) || '—', gradeName(f.grade_id) || '—', f.name, s.students, m.label || '', m.max ?? 'غير معروفة', m.mean_pct ?? '—', m.pass_rate ?? '—', s.mastery_pct ? (m.mastery_rate ?? '—') : 'غير محدد']; });
      C.tables.push({ title: 'نتائج اختبارات الفترة (محسوبة من الكشوف الأصلية)', columns: ['المعلمة', 'المادة', 'الصف', 'الملف', 'عدد الطالبات', 'العمود الرئيسي', 'العظمى', 'المتوسط ٪', 'النجاح ٪', 'الإتقان ٪'], rows });
      const lv = {}; withStats.forEach((f) => { const s = an[f.id].stats; const m = s.columns.find((c) => c.label === s.main_column); if (m?.levels) Object.entries(m.levels).forEach(([k, v]) => { const kk = k.replace(/\(.*\)/, '').trim(); lv[kk] = (lv[kk] || 0) + v; }); });
      if (Object.keys(lv).length) { C.tables.push({ title: 'توزيع مستويات الأداء (مجموع الكشوف)', columns: ['المستوى', 'عدد الطالبات'], rows: Object.entries(lv) }); C.charts.push({ title: 'توزيع مستويات الأداء', type: 'bar', labels: Object.keys(lv), datasets: [{ label: 'عدد الطالبات', data: Object.values(lv) }] }); }
      const groups = {}; withStats.forEach((f) => { if (f.subject_id && f.grade_id) (groups[`${f.teacher_id}|${f.subject_id}|${f.grade_id}`] ||= []).push(f); });
      const cmp = [];
      Object.values(groups).filter((g) => g.length > 1).forEach((g) => { g.sort((a, b) => a.created_at.localeCompare(b.created_at)); for (let i = 1; i < g.length; i++) { const c = comparePeriods(an[g[i - 1].id].stats, an[g[i].id].stats); if (c.comparable) cmp.push([names[g[i].teacher_id] || '', subjectName(g[i].subject_id), gradeName(g[i].grade_id), `${g[i - 1].name} ← ${g[i].name}`, c.mean_pct_a, c.mean_pct_b, c.diff_mean_pct, c.diff_pass_rate ?? '—']); } });
      if (cmp.length) C.tables.push({ title: 'المقارنة بين الفترات (فقط عند توفر بيانات قابلة للمقارنة)', columns: ['المعلمة', 'المادة', 'الصف', 'الملفان', 'المتوسط السابق ٪', 'المتوسط اللاحق ٪', 'الفرق', 'فرق النجاح'], rows: cmp });
      else C.notes.push('لا توجد فترتان محللتان لنفس المعلمة والمادة والصف؛ لذا لا يتضمن التقرير حكماً على التحسن أو التراجع.');
      if (rows.length) C.charts.push({ title: 'متوسط الأداء ٪ لكل كشف', type: 'bar', labels: rows.map((r) => `${r[0]} — ${r[1]}`), datasets: [{ label: 'المتوسط ٪', data: rows.map((r) => (typeof r[7] === 'number' ? r[7] : null)) }], max: 100 });
    } else {
      const skills = withStats.flatMap((f) => (an[f.id].stats.skills || []).map((k) => ({ ...k, f })));
      const lbl = { mastered: 'متقنة (70٪ فأكثر من الطالبات)', partial: 'إتقان جزئي (50–69٪)', needs_intervention: 'تحتاج تدخلاً علاجياً (أقل من 50٪)', unknown: 'لا يمكن الحكم' };
      C.facts.push({ label: 'مهارات مقاسة', value: fmtNum(skills.length) }, { label: 'تحتاج تدخلاً علاجياً', value: fmtNum(skills.filter((k) => k.status === 'needs_intervention').length) }, { label: 'متقنة', value: fmtNum(skills.filter((k) => k.status === 'mastered').length) });
      C.tables.push({ title: 'نتائج المهارات (محسوبة من الكشوف الأصلية)', columns: ['المعلمة', 'المادة', 'الصف', 'المهارة', 'عدد الطالبات', 'نسبة من أتقنّ ٪', 'التصنيف'],
        rows: skills.map((k) => [names[k.f.teacher_id] || '', subjectName(k.f.subject_id) || '—', gradeName(k.f.grade_id) || '—', k.skill, k.n, k.mastery_rate ?? '—', lbl[k.status]]) });
      if (skills.some((k) => k.status === 'unknown')) C.notes.push('بعض الكشوف لم يُحدد لها معيار إتقان أو درجة عظمى للمهارة؛ لذلك لم يُحكم على إتقان مهاراتها.');
      const weak = list.flatMap((f) => (an[f.id]?.extracted?.sections || []).filter((s) => /ضعف|غير المتقن|تدخل|علاج/.test(s.title)).flatMap((s) => s.items.map((i) => `${names[f.teacher_id] || ''}: ${i}`)));
      if (weak.length) C.lists.push({ title: 'جوانب الضعف والتدخل العلاجي المستخرجة من التقارير', items: weak.slice(0, 40), extracted: true });
    }
    const issues = withStats.flatMap((f) => (an[f.id].stats.issues || []).map((i) => `${f.name}: ${i.message}`));
    if (issues.length) C.lists.push({ title: 'تنبيهات على اكتمال البيانات واتساقها', items: issues.slice(0, 40) });
    const noStats = list.filter((f) => !withStats.includes(f));
    if (noStats.length) C.notes.push(`${noStats.length} ملف لم تُحسب له إحصاءات (ليس كشف Excel/CSV أو تعذر قراءته)؛ لم يدخل في الأرقام أعلاه.`);
    C.sources = src(list);
  }
  else if (kind === 'nafes') {
    const list = files.filter((f) => f.category_key === NAFES_KEY);
    const an = await anFor(list);
    const nreqs = reqs.filter((r) => r.category_key === NAFES_KEY);
    const sids = nafesSubjectIds();
    const asg = (await q.assignments()).filter((a) => sids.includes(a.subject_id));
    const tids = [...new Set(nreqs.map((r) => r.teacher_id))];
    const subjOf = (t) => [...new Set(asg.filter((a) => a.teacher_id === t).map((a) => subjectName(a.subject_id)))].join('، ');
    const fileSubj = (f) => subjectName(f.subject_id) || subjOf(f.teacher_id) || '—';
    const sub = nreqs.filter((r) => r.state !== 'missing').length, comp = nreqs.filter((r) => r.state === 'complete').length;
    const withStats = list.filter((f) => an[f.id]?.stats?.kind === 'grades' && an[f.id].stats.ok);
    C.facts.push({ label: 'معلمات نافس (العلوم، الرياضيات، اللغة العربية)', value: fmtNum(tids.length) },
      { label: 'متطلبات نافس المرفوعة', value: `${fmtNum(sub)} من ${fmtNum(nreqs.length)} (${fmtPct(pct(sub, nreqs.length))})` },
      { label: 'المعتمد منها', value: `${fmtNum(comp)} (${fmtPct(pct(comp, nreqs.length))})` },
      { label: 'ملفات قسم نافس', value: fmtNum(list.length) },
      { label: 'كشوف اختبارات تجريبية محسوبة', value: fmtNum(withStats.length) });
    // جاهزية كل معلمة
    const st = (t, title) => { const r = nreqs.find((x) => x.teacher_id === t && x.title === title); return r ? (REQ_STATE[r.state]?.label || r.state) : '—'; };
    C.tables.push({ title: 'جاهزية المعلمات لنافس', columns: ['المعلمة', 'المادة', ...NAFES_REQS.map((r) => r.title), 'نسبة الرفع ٪'],
      rows: tids.map((t) => { const mine = nreqs.filter((r) => r.teacher_id === t); return [names[t] || mine[0]?.full_name || '', subjOf(t) || '—', ...NAFES_REQS.map((r) => st(t, r.title)), pct(mine.filter((r) => r.state !== 'missing').length, mine.length)]; }) });
    // حسب المادة
    const subjects = [...new Set(asg.map((a) => subjectName(a.subject_id)))];
    const bySubj = subjects.map((s) => {
      const ts = [...new Set(asg.filter((a) => subjectName(a.subject_id) === s).map((a) => a.teacher_id))].filter((t) => tids.includes(t));
      const rr = nreqs.filter((r) => ts.includes(r.teacher_id));
      const sf = withStats.filter((f) => fileSubj(f).includes(s));
      const means = sf.map((f) => { const x = an[f.id].stats; return x.columns.find((c) => c.label === x.main_column)?.mean_pct; }).filter((v) => typeof v === 'number');
      return [s, ts.length, pct(rr.filter((r) => r.state !== 'missing').length, rr.length), sf.length, means.length ? Math.round(10 * means.reduce((a, b) => a + b, 0) / means.length) / 10 : '—'];
    });
    if (bySubj.length) C.tables.push({ title: 'نافس حسب المادة', columns: ['المادة', 'عدد المعلمات', 'نسبة رفع المتطلبات ٪', 'كشوف تجريبية محسوبة', 'متوسط الأداء في الكشوف ٪'], rows: bySubj });
    if (bySubj.length) C.charts.push({ title: 'نسبة رفع متطلبات نافس حسب المادة', type: 'bar', labels: bySubj.map((r) => r[0]), datasets: [{ label: 'نسبة الرفع ٪', data: bySubj.map((r) => r[2]) }], max: 100 });
    // نتائج الاختبارات التجريبية
    if (withStats.length) {
      C.tables.push({ title: 'نتائج الاختبارات التجريبية (محسوبة من الكشوف الأصلية)', columns: ['المعلمة', 'المادة', 'الملف', 'عدد الطالبات', 'المتوسط ٪', 'النجاح ٪'],
        rows: withStats.map((f) => { const s = an[f.id].stats; const m = s.columns.find((c) => c.label === s.main_column) || {}; return [names[f.teacher_id] || '', fileSubj(f), f.name, s.students, m.mean_pct ?? '—', m.pass_rate ?? '—']; }) });
      const skills = withStats.flatMap((f) => (an[f.id].stats.skills || []).map((k) => ({ ...k, f })));
      const lbl = { mastered: 'متقنة', partial: 'إتقان جزئي', needs_intervention: 'تحتاج تدخلاً علاجياً', unknown: 'لا يمكن الحكم' };
      if (skills.length) {
        C.facts.push({ label: 'مهارات مقاسة في الاختبارات التجريبية', value: fmtNum(skills.length) }, { label: 'مهارات تحتاج تدخلاً علاجياً', value: fmtNum(skills.filter((k) => k.status === 'needs_intervention').length) });
        const sorted = [...skills].sort((a, b) => (a.mastery_rate ?? 999) - (b.mastery_rate ?? 999));
        C.tables.push({ title: 'المهارات مرتبة من الأضعف إلى الأقوى', columns: ['المادة', 'المهارة', 'المعلمة', 'عدد الطالبات', 'نسبة من أتقنّ ٪', 'التصنيف'],
          rows: sorted.map((k) => [fileSubj(k.f), k.skill, names[k.f.teacher_id] || '', k.n, k.mastery_rate ?? '—', lbl[k.status]]) });
        const weak = sorted.filter((k) => typeof k.mastery_rate === 'number').slice(0, 15);
        if (weak.length) C.charts.push({ title: 'أضعف المهارات (نسبة الإتقان ٪)', type: 'bar', horizontal: true, labels: weak.map((k) => `${fileSubj(k.f)} — ${k.skill}`.slice(0, 60)), datasets: [{ label: 'الإتقان ٪', data: weak.map((k) => k.mastery_rate) }], max: 100 });
        subjects.forEach((s) => { const w = skills.filter((k) => fileSubj(k.f).includes(s) && k.status === 'needs_intervention').map((k) => k.skill);
          if (w.length) C.lists.push({ title: `مهارات ${s} التي تحتاج تدخلاً علاجياً قبل نافس`, items: [...new Set(w)].slice(0, 25) }); });
      }
      const groups = {}; withStats.forEach((f) => (groups[`${f.teacher_id}|${fileSubj(f)}`] ||= []).push(f));
      const cmp = [];
      Object.values(groups).filter((g) => g.length > 1).forEach((g) => { g.sort((a, b) => a.created_at.localeCompare(b.created_at)); for (let i = 1; i < g.length; i++) { const c = comparePeriods(an[g[i - 1].id].stats, an[g[i].id].stats); if (c.comparable) cmp.push([names[g[i].teacher_id] || '', fileSubj(g[i]), `${g[i - 1].name} ← ${g[i].name}`, c.mean_pct_a, c.mean_pct_b, c.diff_mean_pct]); } });
      if (cmp.length) C.tables.push({ title: 'تطور الأداء بين الاختبارات التجريبية', columns: ['المعلمة', 'المادة', 'الاختباران', 'المتوسط السابق ٪', 'المتوسط اللاحق ٪', 'الفرق'], rows: cmp });
      else C.notes.push('لا يوجد اختباران تجريبيان محللان لنفس المعلمة والمادة؛ لذا لا يتضمن التقرير حكماً على التحسن.');
    } else C.notes.push('لم تُرفع كشوف اختبارات تجريبية بصيغة Excel أو CSV بعد. ارفعي الكشف بعمود لكل مهارة ليُحسب الإتقان لكل مهارة تلقائياً.');
    const ext = list.filter((f) => !withStats.includes(f)).flatMap((f) => (an[f.id]?.extracted?.sections || []).filter((s) => /ضعف|اضعف|أضعف|مجال|توصي/.test(s.title)).flatMap((s) => s.items.map((i) => `${names[f.teacher_id] || ''} (${fileSubj(f)}): ${i}`)));
    if (ext.length) C.lists.push({ title: 'ما استُخرج من تقارير نافس والخطط المرفوعة', items: ext.slice(0, 40), extracted: true });
    C.sources = src(list);
  }
  else if (kind === 'satisfaction') {
    const list = files.filter((f) => f.category_key === 'satisfaction');
    const an = await anFor(list);
    const sv = list.filter((f) => an[f.id]?.stats?.kind === 'survey' && an[f.id].stats.ok);
    const responses = sv.reduce((s, f) => s + an[f.id].stats.responses, 0);
    C.facts.push({ label: 'ملفات الاستبانات المحللة', value: fmtNum(sv.length) }, { label: 'إجمالي الاستجابات', value: fmtNum(responses) });
    const qmap = {};
    sv.forEach((f) => an[f.id].stats.questions.forEach((x) => { const m = (qmap[x.question] ||= { n: 0, d: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } }); m.n += x.n; Object.entries(x.distribution).forEach(([k, v]) => (m.d[k] += v)); }));
    const qrows = Object.entries(qmap).map(([qq, m]) => { const mean = (5 * m.d[5] + 4 * m.d[4] + 3 * m.d[3] + 2 * m.d[2] + m.d[1]) / m.n; return [qq, m.n, Math.round(mean * 100) / 100, pct(m.d[5] + m.d[4], m.n), pct(m.d[3], m.n), pct(m.d[2] + m.d[1], m.n)]; });
    if (qrows.length) {
      const overall = Math.round((qrows.reduce((s, r) => s + r[2] * r[1], 0) / qrows.reduce((s, r) => s + r[1], 0)) * 100) / 100;
      C.facts.push({ label: 'متوسط الرضا العام (من 5)', value: String(overall) });
      C.tables.push({ title: 'نتائج عبارات الاستبانة', columns: ['العبارة', 'عدد الإجابات', 'المتوسط من 5', 'موافق ٪', 'محايد ٪', 'غير موافق ٪'], rows: qrows });
      const sorted = [...qrows].sort((a, b) => b[2] - a[2]);
      C.lists.push({ title: 'أعلى جوانب الرضا (حسب المتوسط)', items: sorted.slice(0, 3).map((r) => `${r[0]} — ${r[2]} من 5`) });
      C.lists.push({ title: 'جوانب تحتاج تحسيناً (أدنى المتوسطات)', items: sorted.slice(-3).reverse().map((r) => `${r[0]} — ${r[2]} من 5`) });
      C.charts.push({ title: 'نسبة الموافقة لكل عبارة', type: 'bar', horizontal: true, labels: qrows.map((r) => r[0].slice(0, 50)), datasets: [{ label: 'موافق ٪', data: qrows.map((r) => r[3]) }], max: 100 });
    } else C.notes.push('لا توجد ملفات استبانة بصيغة Excel/CSV قابلة للحساب. ارفعي نتائج الاستبانة (مثل تصدير Google Forms أو Microsoft Forms) لتُحسب النسب.');
    C.sources = src(list);
  }
  else if (kind === 'plans') {
    const wk = files.filter((f) => f.category_key === 'weekly'), sm = files.filter((f) => f.category_key === 'semester');
    const an = await anFor([...wk, ...sm]);
    const rate = (l) => { const a = l.map((f) => an[f.id]).filter((x) => x?.elements?.length); if (!a.length) return '—'; return Math.round(100 * a.reduce((s, x) => s + x.elements.filter((e) => e.status === 'present').length / x.elements.length, 0) / a.length); };
    C.facts.push({ label: 'خطط أسبوعية مرفوعة', value: fmtNum(wk.length) }, { label: 'خطط فصلية مرفوعة', value: fmtNum(sm.length) });
    const tids = [...new Set([...prog.map((p) => p.teacher_id)])];
    C.tables.push({ title: 'الخطط لكل معلمة', columns: ['المعلمة', 'الخطط الأسبوعية', 'متوسط اكتمال عناصر الأسبوعية ٪', 'الخطط الفصلية', 'متوسط اكتمال عناصر الفصلية ٪', 'آخر رفع'],
      rows: tids.map((t) => { const w = wk.filter((f) => f.teacher_id === t), s = sm.filter((f) => f.teacher_id === t); const last = [...w, ...s].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        return [names[t] || '', w.length, rate(w), s.length, rate(s), last ? fmtDate(last.created_at) : '—']; }) });
    const weeks = wk.map((f) => an[f.id]?.extracted?.week).filter(Boolean);
    if (weeks.length) C.lists.push({ title: 'الأسابيع الدراسية المستخرجة من الخطط', items: [...new Set(weeks)].slice(0, 30), extracted: true });
    C.sources = src([...wk, ...sm]);
  }
  else if (kind === 'learning_styles') {
    const list = files.filter((f) => f.category_key === 'learning_styles');
    const an = await anFor(list);
    C.facts.push({ label: 'ملفات أنماط التعلم', value: fmtNum(list.length) }, { label: 'معلمات رفعن ملفات', value: fmtNum(new Set(list.map((f) => f.teacher_id)).size) });
    const strat = {};
    list.forEach((f) => (an[f.id]?.extracted?.sections || []).filter((s) => /استراتيج|أنشط|انشط|نشاط|تنويع/.test(s.title)).forEach((s) => s.items.forEach((i) => { (strat[i] ||= new Set()).add(names[f.teacher_id] || ''); })));
    const rows = Object.entries(strat).map(([k, v]) => [k, v.size, [...v].join('، ')]).sort((a, b) => b[1] - a[1]);
    if (rows.length) C.tables.push({ title: 'الاستراتيجيات والأنشطة المستخرجة', columns: ['الاستراتيجية / النشاط', 'عدد المعلمات', 'المعلمات'], rows: rows.slice(0, 60), extracted: true });
    C.tables.push({ title: 'ملفات أنماط التعلم', columns: ['المعلمة', 'الملف', 'اكتمال العناصر', 'الحالة'], rows: list.map((f) => [names[f.teacher_id] || '', f.name, elems(an[f.id]), statusL(f.status)]) });
    C.notes.push('تُستخدم أنماط التعلم وسيلةً لتنويع التدريس ومراعاة احتياجات الطالبات، لا لتصنيف الطالبة تصنيفاً ثابتاً.');
    C.sources = src(list);
  }
  else if (kind === 'final') {
    completionSection();
    teachersSection();
    C.tables.push({ title: 'ملفات اللجنة حسب الحالة', columns: ['الحالة', 'عدد الملفات'], rows: Object.entries(STATUS).map(([k, v]) => [v.label, files.filter((f) => f.status === k).length]).filter((r) => r[1]) });
    const tests = files.filter((f) => f.category_key === 'period_tests');
    const an = await anFor(tests);
    const st = tests.map((f) => an[f.id]?.stats).filter((s) => s?.ok);
    if (st.length) {
      const mains = st.map((s) => s.columns.find((c) => c.label === s.main_column)).filter((m) => m?.pass_rate != null);
      if (mains.length) C.facts.push({ label: 'متوسط نسب النجاح في كشوف الفترات المحسوبة', value: `${fmtPct(Math.round(mains.reduce((a, m) => a + m.pass_rate, 0) / mains.length))} (${mains.length} كشف)` });
    }
    const committeeDocs = files.filter((f) => f.category_key === 'committee');
    C.facts.push({ label: 'وثائق اللجنة العامة (محاضر، تقارير، شواهد)', value: fmtNum(committeeDocs.length) });
    C.sources = src(files.filter((f) => f.status === 'approved').slice(0, 100));
  }
  return C;
}

// ---------------------------------------------------------------------
//  العرض
// ---------------------------------------------------------------------
function reportHtml(C, saved) {
  const H = C.header || {};
  const N = C.narrative;
  const aiTag = '<span class="ai-tag">صياغة بالذكاء الاصطناعي — راجعيها قبل الاعتماد</span>';
  const list = (arr) => `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  return `<article class="report" id="report-doc">
    <header class="rh">
      <img src="${esc(App.settings?.logo_path ? App.logoUrl : 'assets/moe-logo.png')}" alt="وزارة التعليم">
      <div class="c"><div>وزارة التعليم — ${esc(H.directorate || '')}</div><div>${esc(H.school || '')} — ${esc(H.committee || '')}</div><h1>${esc(C.title)}</h1></div>
      <div class="m">العام الدراسي: ${esc(H.year || '')}<br>${esc(H.semester || '')}<br>تاريخ الإصدار: ${fmtDate(C.generated_at)}<br>${esc(fmtHijri(C.generated_at))}
        ${saved ? `<br>الحالة: ${saved.approved ? 'معتمد' : 'غير معتمد'}` : ''}</div>
    </header>
    <h2>الملخص التنفيذي ${N ? aiTag : ''}</h2>
    ${N?.executive_summary ? `<p>${esc(N.executive_summary)}</p>` : ''}
    ${C.facts.length ? `<table><tbody>${C.facts.map((f) => `<tr><th style="width:55%">${esc(f.label)}</th><td class="num"><b>${esc(f.value)}</b></td></tr>`).join('')}</tbody></table>` : ''}
    ${C.tables.length ? `<h2>البيانات والجداول</h2>${C.tables.map((t) => `<h3 style="font-size:.95rem;margin:14px 0 6px">${esc(t.title)}${t.extracted ? ' <span class="ai-tag">مستخرج آلياً من الملفات</span>' : ''}</h3>
      ${t.rows.length ? `<div class="table-wrap"><table><thead><tr>${t.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="muted">لا توجد بيانات.</p>'}`).join('')}` : ''}
    ${C.charts.length ? `<h2>الرسوم البيانية</h2>${C.charts.map((c, i) => `<div class="chart-box" style="height:${c.horizontal ? Math.max(220, c.labels.length * 28) : 280}px;margin-bottom:16px"><canvas data-chart="${i}" aria-label="${esc(c.title)}"></canvas></div>`).join('')}` : ''}
    ${C.lists.map((l) => `<h2>${esc(l.title)}${l.extracted ? ' <span class="ai-tag">مستخرج آلياً من الملفات</span>' : ''}</h2>${list(l.items)}`).join('')}
    ${N ? `
      ${N.key_findings?.length ? `<h2>أبرز النتائج ${aiTag}</h2>${list(N.key_findings)}` : ''}
      ${N.strengths?.length ? `<h2>جوانب القوة ${aiTag}</h2>${list(N.strengths)}` : ''}
      ${N.improvements?.length ? `<h2>فرص التحسين ${aiTag}</h2>${list(N.improvements)}` : ''}
      ${N.recommendations?.length ? `<h2>التوصيات ${aiTag}</h2>${list(N.recommendations)}` : ''}
      ${N.actions?.length ? `<h2>الإجراءات المقترحة ${aiTag}</h2>${list(N.actions)}` : ''}
      ${N.data_limits?.length ? `<h2>حدود البيانات</h2>${list(N.data_limits)}` : ''}` : ''}
    ${C.notes.length ? `<h2>ملاحظات منهجية</h2>${list(C.notes)}` : ''}
    <h2>المرفقات والمصادر</h2>
    <p style="font-size:.85rem">جميع الأرقام في هذا التقرير محسوبة من البيانات المرفوعة في المنصة${C.filters?.semester ? ` (الفصل: ${esc(C.filters.semester)})` : ''}. ${N ? 'الأجزاء الموسومة بالذكاء الاصطناعي مقترحات تحتاج مراجعة بشرية.' : ''}</p>
    ${C.sources.length ? `<ol style="font-size:.8rem">${C.sources.map((s) => `<li><a href="#/file/${esc(s.id)}">${esc(s.name)}</a> — ${esc(s.teacher)} — ${esc(s.folder)}</li>`).join('')}</ol>` : '<p class="muted" style="font-size:.85rem">بيانات الإنجاز والمتطلبات من قاعدة بيانات المنصة.</p>'}
    <div class="sig"><div>رئيسة لجنة التحصيل الدراسي<br><br>التوقيع: ....................</div><div>مديرة المدرسة<br>${esc(H.principal || '')}<br>التوقيع: ....................</div></div>
  </article>`;
}

async function show(view, C, { saved, filters } = {}) {
  view.innerHTML = `
    <div class="row no-print" style="margin-bottom:12px">
      ${App.isStaff && !saved ? `<button class="btn" data-ai>${icon('sparkles')} صياغة الملخص والتوصيات بالذكاء الاصطناعي</button>` : ''}
      ${App.isStaff && !saved ? `<button class="btn primary" data-save>${icon('save')} حفظ التقرير</button>` : ''}
      ${saved && App.isAdmin ? `<button class="btn ${saved.approved ? '' : 'primary'}" data-approve>${icon('badge-check')} ${saved.approved ? 'إلغاء الاعتماد' : 'اعتماد التقرير'}</button>` : ''}
      <span class="spacer"></span>
      <button class="btn" data-print>${icon('printer')} طباعة / PDF</button>
      <button class="btn" data-xls>${icon('file-spreadsheet')} Excel</button>
      <button class="btn" data-doc>${icon('file-type')} Word</button>
      ${saved && App.isAdmin ? `<button class="btn ghost danger" data-del>${icon('trash-2')}</button>` : ''}
    </div>
    <div data-doc-wrap>${reportHtml(C, saved)}</div>`;
  refreshIcons();
  const charts = [];
  const draw = async () => {
    charts.forEach((c) => c.destroy()); charts.length = 0;
    let Ch; try { Ch = await Chart(); } catch (e) { return; }
    view.querySelectorAll('[data-chart]').forEach((cv) => {
      const c = C.charts[cv.dataset.chart];
      charts.push(new Ch(cv, { type: c.type, data: { labels: c.labels, datasets: c.datasets.map((d) => ({ ...d, backgroundColor: '#0d6b52', borderRadius: 5 })) },
        options: { indexAxis: c.horizontal ? 'y' : 'x', maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, title: { display: true, text: c.title, color: '#0f3d3c' } },
          scales: { [c.horizontal ? 'x' : 'y']: { beginAtZero: true, ...(c.max ? { max: c.max } : {}), ticks: { color: '#333' } }, [c.horizontal ? 'y' : 'x']: { ticks: { color: '#333' }, ...(c.horizontal ? { position: 'right' } : {}) } } } }));
    });
  };
  draw();
  const redraw = () => { view.querySelector('[data-doc-wrap]').innerHTML = reportHtml(C, saved); refreshIcons(); draw(); };

  view.querySelector('[data-ai]')?.addEventListener('click', async (e) => {
    await withBusy(e.currentTarget, async () => {
      try {
        const data = { title: C.title, header: C.header, facts: C.facts, tables: C.tables.map((t) => ({ ...t, rows: t.rows.slice(0, 80) })), lists: C.lists, notes: C.notes };
        const r = await fn('ai', { action: 'narrative', kind: C.kind, title: C.title, data });
        C.narrative = r.text; C.narrative_model = r.model;
        redraw(); toast('تمت الصياغة — راجعي النص قبل الحفظ والاعتماد', 'ok');
      } catch (ex) { toast(errMsg(ex), 'bad', 7000); }
    });
  });
  view.querySelector('[data-save]')?.addEventListener('click', async (e) => {
    await withBusy(e.currentTarget, async () => {
      const { data, error } = await sb.from('reports').insert({ kind: C.kind, title: C.title, params: filters || {}, content: C, teacher_id: filters?.teacher || null, created_by: App.user.id }).select().single();
      if (error) toast(errMsg(error), 'bad'); else { toast('تم حفظ التقرير' + (filters?.teacher ? ' — سيظهر للمعلمة بعد اعتماده' : ''), 'ok'); location.hash = '#/report/' + data.id; }
    });
  });
  view.querySelector('[data-approve]')?.addEventListener('click', async () => {
    const { error } = await sb.from('reports').update({ approved: !saved.approved, approved_by: App.user.id }).eq('id', saved.id);
    if (error) toast(errMsg(error), 'bad'); else { toast(saved.approved ? 'أُلغي الاعتماد' : 'تم اعتماد التقرير', 'ok'); saved.approved = !saved.approved; location.reload(); }
  });
  view.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!(await confirmBox('حذف التقرير المحفوظ؟', { ok: 'حذف', danger: true }))) return;
    const { error } = await sb.from('reports').delete().eq('id', saved.id);
    if (error) toast(errMsg(error), 'bad'); else location.hash = '#/reports';
  });
  view.querySelector('[data-print]').addEventListener('click', () => window.print());
  view.querySelector('[data-xls]').addEventListener('click', async (e) => {
    await withBusy(e.currentTarget, async () => {
      const XLSX = await getXLSX();
      const wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
      const H = C.header || {};
      const summary = [[C.title], [`${H.school || ''} — ${H.committee || ''}`], [`العام الدراسي ${H.year || ''} — ${H.semester || ''}`], [`تاريخ الإصدار: ${new Date(C.generated_at).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn')}`], [],
        ['المؤشر', 'القيمة'], ...C.facts.map((f) => [f.label, f.value])];
      if (C.narrative) summary.push([], ['الملخص التنفيذي (صياغة بالذكاء الاصطناعي)'], [C.narrative.executive_summary], [], ['التوصيات (مقترحة)'], ...C.narrative.recommendations.map((r) => [r]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'الملخص');
      const used = new Set(['الملخص']);
      C.tables.forEach((t, i) => {
        let nm = t.title.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28).trim() || `جدول ${i + 1}`;
        while (used.has(nm)) nm = nm.slice(0, 25) + ' ' + i;
        used.add(nm);
        const ws = XLSX.utils.aoa_to_sheet([t.columns, ...t.rows]);
        ws['!cols'] = t.columns.map(() => ({ wch: 20 }));
        XLSX.utils.book_append_sheet(wb, ws, nm);
      });
      if (C.sources.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['الملف', 'المعلمة', 'المجلد'], ...C.sources.map((s) => [s.name, s.teacher, s.folder])]), 'المصادر');
      const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${C.title}.xlsx`);
    });
  });
  view.querySelector('[data-doc]').addEventListener('click', () => {
    const doc = view.querySelector('#report-doc').cloneNode(true);
    doc.querySelectorAll('.chart-box').forEach((b) => {
      const cv = view.querySelector(`[data-chart="${b.querySelector('canvas')?.dataset.chart}"]`);
      if (cv) { const img = document.createElement('img'); img.src = cv.toDataURL('image/png'); img.style.width = '15cm'; b.replaceWith(img); } else b.remove();
    });
    doc.querySelectorAll('header img').forEach((img) => { img.src = new URL(img.getAttribute('src'), location.href).href; img.style.width = '2.6cm'; });
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(C.title)}</title>
      <style>body{font-family:'Sakkal Majalla','Traditional Arabic',Arial;direction:rtl;font-size:13pt}table{border-collapse:collapse;width:100%;margin:6pt 0}td,th{border:1px solid #999;padding:4pt;text-align:right;font-size:11pt}th{background:#eef4f1}h1{font-size:18pt;color:#0f3d3c;text-align:center}h2{font-size:14pt;color:#0f3d3c;border-right:4pt solid #b48a2f;padding-right:6pt}.ai-tag{font-size:9pt;color:#5b4aa8}.rh{border-bottom:2pt solid #b48a2f}.sig{margin-top:30pt}</style></head><body>${doc.outerHTML}</body></html>`;
    downloadBlob(new Blob(['﻿' + html], { type: 'application/msword' }), `${C.title}.doc`);
  });
  return () => charts.forEach((c) => c.destroy());
}
