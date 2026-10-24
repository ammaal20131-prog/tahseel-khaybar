// الصفحة الرئيسية — لوحة المتابعة
import { App, q, catOf, teacherNameMap } from '../api.js';
import { esc, icon, fmtNum, fmtPct, timeAgo, statusChip, reqChip, fileIcon, emptyState, progressBar, pctClass, todayISO } from '../ui.js';
import { letterhead, kpi, catIcon, folderLink, Chart, cssVar } from './_common.js';
import { showCategory } from '../nafes.js';

export default async function dashboard(view) {
  const [stats, files, analyses] = await Promise.all([q.stats(), q.files({ limit: 8 }), q.latestAnalyses(6)]);
  const teachers = App.isStaff ? await q.teachers() : [App.profile];
  const names = teacherNameMap(teachers);
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const completion = pct(stats.req_complete, stats.req_total);
  const commitment = pct(stats.req_submitted, stats.req_total);

  if (!App.isStaff) return teacherDashboard(view, stats, files, analyses);

  const reqs = await q.reqStatus();
  const today = todayISO();
  const overdue = reqs.filter((r) => r.state === 'missing' && r.due_date && r.due_date < today);
  const alerts = await q.files({ status: ['needs_review', 'needs_completion', 'failed'], limit: 8 });
  const fileNames = {}; files.forEach((f) => (fileNames[f.id] = f));

  view.innerHTML = `
    ${letterhead()}
    <div class="grid c4 kpis">
      ${kpi(fmtNum(stats.teachers), 'المعلمات المسجلات', 'users', '', '#/teachers')}
      ${kpi(fmtNum(stats.subjects), 'المواد الدراسية', 'book-marked', 'gold', App.isAdmin ? '#/settings' : '')}
      ${kpi(fmtNum(stats.files), 'الملفات المرفوعة', 'files', 'info', '#/folders')}
      ${kpi(fmtNum(stats.analyzed), 'ملفات حُللت بالذكاء الاصطناعي', 'sparkles', 'violet', '#/review')}
      ${kpi(fmtNum(stats.complete), 'ملفات مكتملة (معتمدة)', 'badge-check', '', '#/review?status=approved')}
      ${kpi(fmtNum(stats.incomplete), 'ملفات ناقصة أو تعذرت قراءتها', 'file-warning', 'bad', '#/review?status=needs_completion')}
      ${kpi(fmtPct(completion), 'نسبة إنجاز أعمال اللجنة', 'target', 'gold', '#/teachers')}
      ${kpi(fmtPct(commitment), 'التزام المعلمات برفع المطلوب', 'calendar-check', '', '#/teachers')}
    </div>

    <div class="grid c3" style="margin-top:16px">
      <div class="card span-2">
        <div class="card-head"><h3>${icon('chart-column')} مستوى اكتمال متطلبات اللجنة حسب المجلد</h3><a class="btn sm ghost" href="#/reports">التقارير ${icon('arrow-left')}</a></div>
        <div class="chart-box" style="height:300px"><canvas id="c-cat" aria-label="مخطط اكتمال المتطلبات"></canvas></div>
        ${stats.req_total ? '' : `<p class="muted" style="font-size:.84rem">لا توجد متطلبات أو معلمات بعد. أضيفي المعلمات من صفحة "المعلمات والإنجاز".</p>`}
      </div>
      <div class="card">
        <div class="card-head"><h3>${icon('bell-ring')} تنبيهات تحتاج متابعة</h3></div>
        <div class="list">
          ${overdue.slice(0, 4).map((r) => `<div class="list-item"><div class="li-ic" style="color:var(--bad)">${icon('clock-alert')}</div>
            <div class="li-main"><div class="li-t">${esc(r.title)}</div><div class="li-s">${esc(r.full_name)} — انتهى الموعد ${esc(r.due_date)}</div></div></div>`).join('')}
          ${alerts.map((f) => `<a class="list-item" href="#/file/${f.id}" style="color:inherit;text-decoration:none"><div class="li-ic">${icon(fileIcon(f.name))}</div>
            <div class="li-main"><div class="li-t">${esc(f.name)}</div><div class="li-s">${esc(names[f.teacher_id] || 'عام')}</div></div>${statusChip(f.status)}</a>`).join('')}
          ${!overdue.length && !alerts.length ? emptyState('لا توجد تنبيهات حالياً', 'check-check') : ''}
        </div>
        ${overdue.length > 4 ? `<a class="btn sm ghost" href="#/teachers">عرض كل النواقص (${overdue.length})</a>` : ''}
      </div>
    </div>

    <h2 style="margin:26px 0 12px">${icon('zap')} الوصول السريع</h2>
    <div class="grid auto">${folderCards(stats.by_category)}</div>

    <div class="grid c2" style="margin-top:18px">
      <div class="card">
        <div class="card-head"><h3>${icon('upload')} آخر الملفات المرفوعة</h3></div>
        <div class="list">${files.length ? files.map((f) => `<a class="list-item" href="#/file/${f.id}" style="color:inherit;text-decoration:none">
          <div class="li-ic">${icon(fileIcon(f.name))}</div>
          <div class="li-main"><div class="li-t">${esc(f.name)}</div><div class="li-s">${esc(names[f.teacher_id] || 'وثيقة عامة')} · ${esc(catOf(f.category_key).title)} · ${timeAgo(f.created_at)}</div></div>
          ${statusChip(f.status)}</a>`).join('') : emptyState('لم تُرفع ملفات بعد', 'upload-cloud')}</div>
      </div>
      <div class="card ai-box">
        <div class="card-head"><h3>${icon('sparkles')} آخر تحليلات الذكاء الاصطناعي</h3><span class="ai-note">${icon('info')} تحتاج مراجعة بشرية قبل الاعتماد</span></div>
        <div class="list">${analyses.length ? analyses.map((a) => `<a class="list-item" href="#/file/${a.file_id}" style="color:inherit;text-decoration:none">
          <div class="li-ic" style="color:var(--violet)">${icon(a.error ? 'triangle-alert' : 'scan-text')}</div>
          <div class="li-main"><div class="li-t">${esc(a.doc_type_label || (a.error ? 'لم يكتمل التحليل' : 'تحليل'))}</div>
          <div class="li-s" style="white-space:normal">${esc((a.summary || a.error || '').slice(0, 140))}</div></div>
          <small>${timeAgo(a.created_at)}</small></a>`).join('') : emptyState('لا توجد تحليلات بعد', 'sparkles')}</div>
      </div>
    </div>`;

  drawCategoryChart(stats.by_category);
}

function folderCards(byCat = []) {
  return App.categories.filter((c) => (App.isStaff || c.per_teacher) && showCategory(c)).map((c, i) => {
    const s = byCat.find((x) => x.key === c.key) || {};
    const p = s.required ? Math.round((100 * s.submitted) / s.required) : null;
    return `<a class="card folder-card" href="${App.isStaff || !c.per_teacher ? folderLink(c.key, null) : folderLink(c.key, App.user.id)}">
      <span class="num-badge">${i + 1}</span>
      <div class="fi">${icon(catIcon(c.key))}</div>
      <div class="ft">${esc(c.title)}</div>
      <div class="fd">${esc(c.description || '')}</div>
      ${p !== null ? progressBar(p, pctClass(p)) : ''}
      <div class="fs"><span>${icon('file')} ${fmtNum(s.files || 0)} ملف</span>${p !== null ? `<span>${icon('target')} ${fmtPct(p)}</span>` : ''}</div>
    </a>`;
  }).join('');
}

async function drawCategoryChart(byCat = []) {
  const el = document.getElementById('c-cat');
  if (!el) return;
  let C;
  try { C = await Chart(); } catch (e) { el.parentElement.innerHTML = '<p class="muted">تعذر تحميل مكتبة الرسوم البيانية.</p>'; return; }
  const rows = byCat.filter((r) => r.required > 0);
  new C(el, {
    type: 'bar',
    data: {
      labels: rows.map((r) => r.title),
      datasets: [
        { label: 'معتمد', data: rows.map((r) => r.complete), backgroundColor: cssVar('--primary'), borderRadius: 5, stack: 's' },
        { label: 'مرفوع بانتظار الاعتماد', data: rows.map((r) => r.submitted - r.complete), backgroundColor: cssVar('--gold'), borderRadius: 5, stack: 's' },
        { label: 'لم يُرفع', data: rows.map((r) => r.required - r.submitted), backgroundColor: cssVar('--line'), borderRadius: 5, stack: 's' },
      ],
    },
    options: {
      indexAxis: 'y', maintainAspectRatio: false, responsive: true,
      plugins: { legend: { position: 'bottom', rtl: true, labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { rtl: true } },
      scales: { x: { stacked: true, ticks: { precision: 0 }, title: { display: true, text: 'عدد المتطلبات (معلمة × متطلب)' } }, y: { stacked: true, position: 'right' } },
    },
  });
}

async function teacherDashboard(view, stats, files, analyses) {
  const reqs = await q.reqStatus(App.user.id);
  const total = reqs.length, done = reqs.filter((r) => r.state === 'complete').length, sub = reqs.filter((r) => r.state !== 'missing').length;
  const p = total ? Math.round((100 * sub) / total) : 0;
  const todo = reqs.filter((r) => r.state === 'missing' || r.state === 'incomplete');
  view.innerHTML = `
    ${letterhead(true)}
    <div class="grid c3">
      <div class="card" style="display:flex;gap:18px;align-items:center">
        <div class="ring" style="--p:${p}"><div><b>${p}٪</b><small>نسبة الرفع</small></div></div>
        <div><h3 style="margin:0">أهلاً ${esc(App.profile.full_name)}</h3>
          <div class="muted" style="font-size:.88rem">رفعتِ ${fmtNum(sub)} من ${fmtNum(total)} متطلباً، واعتُمد منها ${fmtNum(done)}.</div>
          <div class="row" style="margin-top:10px;gap:8px"><a class="btn sm primary" href="#/quick">${icon('zap')} التعبئة السريعة</a><a class="btn sm" href="#/tasks">${icon('list-checks')} متطلباتي</a></div></div>
      </div>
      ${kpi(fmtNum(stats.files), 'ملفاتي المرفوعة', 'files', 'info', '#/folders')}
      ${kpi(fmtNum(todo.length), 'متطلبات لم تكتمل', 'file-warning', todo.length ? 'bad' : '', '#/tasks')}
    </div>
    <div class="grid c2" style="margin-top:16px">
      <div class="card">
        <div class="card-head"><h3>${icon('list-todo')} المطلوب مني الآن</h3></div>
        <div class="list">${todo.length ? todo.slice(0, 8).map((r) => `<a class="list-item" href="${folderLink(r.category_key, App.user.id)}" style="color:inherit;text-decoration:none">
          <div class="li-ic">${icon(catIcon(r.category_key))}</div>
          <div class="li-main"><div class="li-t">${esc(r.title)}</div><div class="li-s">${esc(catOf(r.category_key).title)}${r.due_date ? ' · الموعد ' + esc(r.due_date) : ''}</div></div>
          ${reqChip(r.state)}</a>`).join('') : emptyState('أحسنتِ! لا توجد متطلبات ناقصة', 'party-popper')}</div>
      </div>
      <div class="card">
        <div class="card-head"><h3>${icon('upload')} آخر ملفاتي</h3></div>
        <div class="list">${files.length ? files.map((f) => `<a class="list-item" href="#/file/${f.id}" style="color:inherit;text-decoration:none">
          <div class="li-ic">${icon(fileIcon(f.name))}</div>
          <div class="li-main"><div class="li-t">${esc(f.name)}</div><div class="li-s">${esc(catOf(f.category_key).title)} · ${timeAgo(f.created_at)}</div></div>
          ${statusChip(f.status)}</a>`).join('') : emptyState('لم ترفعي ملفات بعد', 'upload-cloud')}</div>
      </div>
    </div>
    <h2 style="margin:26px 0 12px">${icon('zap')} الوصول السريع</h2>
    <div class="grid auto">${folderCards(stats.by_category)}</div>`;
}
