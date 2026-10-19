// التقارير الذكية للجنة التحصيل الدراسي
import { App, q, teacherNameMap } from '../api.js';
import { esc, icon, fmtDate, emptyState } from '../ui.js';
import { pageHead } from './_common.js';

export const REPORT_KINDS = [
  ['teachers', 'تقرير إنجاز المعلمات', 'users', 'نسبة إنجاز كل معلمة والمتطلبات المرفوعة والناقصة'],
  ['completion', 'تقرير اكتمال ملفات اللجنة', 'folder-check', 'اكتمال المتطلبات في كل مجلد ولكل متطلب'],
  ['remedial', 'تقرير الخطط العلاجية والإثرائية', 'heart-pulse', 'الخطط المرفوعة واكتمال عناصرها ومؤشرات قياس الأثر'],
  ['period_tests', 'تقرير تحليل نتائج اختبارات الفترة', 'chart-column', 'المتوسطات ونسب النجاح والإتقان من الكشوف الفعلية'],
  ['diagnostic', 'تقرير تحليل نتائج الاختبارات التشخيصية', 'stethoscope', 'المهارات المتقنة وغير المتقنة والتدخل العلاجي'],
  ['satisfaction', 'تقرير قياس رضا أولياء الأمور', 'smile', 'نتائج الاستبانات وعدد الاستجابات وجوانب التحسين'],
  ['plans', 'تقرير الخطط الأسبوعية والفصلية', 'calendar-days', 'رفع الخطط واكتمال عناصرها لكل معلمة'],
  ['learning_styles', 'تقرير أنماط التعلم والاستراتيجيات المستخدمة', 'lightbulb', 'الاستراتيجيات والأنشطة ومراعاة الفروق الفردية'],
  ['gaps', 'تقرير النواقص والمتطلبات غير المكتملة', 'file-warning', 'كل ما لم يُرفع أو أُعيد للاستكمال'],
  ['final', 'التقرير الختامي لأعمال لجنة التحصيل الدراسي', 'award', 'ملخص شامل لأعمال اللجنة خلال الفترة'],
];

export default async function reports(view) {
  const [saved, people] = await Promise.all([q.reports(), App.isStaff ? q.teachers() : Promise.resolve([])]);
  const names = teacherNameMap(people);
  view.innerHTML = `
    ${pageHead('التقارير الذكية للجنة التحصيل الدراسي', 'تقارير مبنية على البيانات الفعلية في النظام، مع صياغة اختيارية للملخص والتوصيات بالذكاء الاصطناعي. جاهزة للطباعة والتنزيل.')}
    ${App.isStaff ? `<div class="grid auto">${REPORT_KINDS.map(([k, t, ic, d], i) => `<a class="card folder-card" href="#/report/new/${k}">
      <span class="num-badge">${i + 1}</span><div class="fi" style="background:var(--gold-soft);color:var(--gold)">${icon(ic)}</div>
      <div class="ft">${esc(t)}</div><div class="fd">${esc(d)}</div><div class="fs"><span>${icon('plus')} إنشاء تقرير</span></div></a>`).join('')}</div>` : ''}
    <div class="card" style="margin-top:18px">
      <div class="card-head"><h3>${icon('archive')} التقارير المحفوظة</h3></div>
      ${saved.length ? `<div class="table-wrap"><table><thead><tr><th>التقرير</th><th>تاريخ الإصدار</th><th>أعدته</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${saved.map((r) => `<tr><td><a href="#/report/${r.id}" style="font-weight:600">${esc(r.title)}</a>${r.teacher_id ? ` <span class="chip">${esc(names[r.teacher_id] || 'خاص بمعلمة')}</span>` : ''}</td>
        <td class="muted">${fmtDate(r.created_at, true)}</td><td>${esc(names[r.created_by] || '')}</td>
        <td>${r.approved ? '<span class="chip ok">معتمد</span>' : '<span class="chip warn">غير معتمد</span>'}</td>
        <td class="actions"><a class="btn sm" href="#/report/${r.id}">${icon('eye')} عرض</a></td></tr>`).join('')}
      </tbody></table></div>` : emptyState(App.isStaff ? 'لم تُحفظ تقارير بعد' : 'لا توجد تقارير مشاركة معك', 'file-chart-column')}
    </div>`;
}
