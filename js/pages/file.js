// صفحة الملف: معاينة، بيانات مستخرجة، تحليل الذكاء الاصطناعي، المراجعة والاعتماد
import { App, sb, q, catOf, subjectName, gradeName, signedUrl, downloadFileBlob } from '../api.js';
import { esc, icon, fmtSize, fmtDate, fmtNum, fmtPct, timeAgo, statusChip, fileIcon, emptyState, toast, confirmBox, promptBox, errMsg, withBusy, refreshIcons, modal, ROLES } from '../ui.js';
import { pageHead, folderLink, Chart, cssVar } from './_common.js';
import { analyzeFile, openUploadDialog } from '../upload.js';
import { docxToHtml, sheetToHtml, needsGradeOptions } from '../extract.js';
import { comparePeriods } from '../stats.js';
import { rerender, updateBadges } from '../main.js';

const FIELD_LABELS = { teacher_name: 'اسم المعلمة', subject: 'المادة', grade: 'الصف', semester: 'الفصل الدراسي', academic_year: 'العام الدراسي', date: 'التاريخ', week: 'الأسبوع', title: 'العنوان' };
const METHOD = { 'pdf-vision': 'قراءة PDF (نصي ومصور)', 'ocr-image': 'تعرف ضوئي على صورة', docx: 'نص مستند Word', spreadsheet: 'جدول بيانات', local: 'حساب محلي فقط', pdf: 'PDF', image: 'صورة', unsupported: 'صيغة غير مدعومة' };

export default async function filePage(view, params) {
  const f = await q.file(params.id);
  if (!f) throw new Error('الملف غير موجود أو ليس لديك صلاحية للاطلاع عليه');
  const [an, notes, owner, profilesAll] = await Promise.all([
    q.analysis(f.id), q.notes(f.id), f.teacher_id ? q.teacher(f.teacher_id) : null, App.isStaff ? q.teachers() : Promise.resolve([App.profile]),
  ]);
  const people = {}; profilesAll.forEach((p) => (people[p.id] = p.full_name));
  let reqTitle = '';
  if (f.requirement_id) { const { data } = await sb.from('requirements').select('title').eq('id', f.requirement_id).maybeSingle(); reqTitle = data?.title || ''; }
  const cat = catOf(f.category_key);
  const isOwner = f.teacher_id === App.user.id;
  const canEdit = App.isStaff || (isOwner && f.status !== 'approved');
  const canApprove = App.isAdmin;

  view.innerHTML = `
    ${pageHead(`${icon(fileIcon(f.name))} ${esc(f.name)}`, `${statusChip(f.status)} ${f.status_reason ? `<span class="muted" style="margin-inline-start:6px">${esc(f.status_reason)}</span>` : ''}`,
      `<button class="btn" data-dl>${icon('download')} تنزيل</button>
       ${canEdit || App.isStaff ? `<button class="btn" data-an>${icon('sparkles')} ${an ? 'إعادة التحليل' : 'قراءة وتحليل'}</button>` : ''}
       ${canEdit ? `<button class="btn" data-rep>${icon('replace')} استبدال</button>` : ''}
       ${canEdit ? `<button class="btn danger" data-del>${icon('trash-2')}</button>` : ''}`,
      `<a href="#/folders">المجلدات</a> ${icon('chevron-left')} <a href="${folderLink(f.category_key, f.teacher_id)}">${esc(cat.title)}${owner ? ' · ' + esc(owner.full_name) : ''}</a>${f.folder_path ? ` ${icon('chevron-left')} <a href="${folderLink(f.category_key, f.teacher_id, f.folder_path)}">${esc(f.folder_path)}</a>` : ''}`)}

    ${App.isStaff ? `<div class="card" style="margin-bottom:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <b>${icon('clipboard-check')} قرار المراجعة:</b>
      ${canApprove && f.status !== 'approved' ? `<button class="btn primary sm" data-rev="approve">${icon('badge-check')} اعتماد</button>` : ''}
      ${f.status !== 'needs_completion' ? `<button class="btn sm danger" data-rev="return">${icon('undo-2')} إعادة للمعلمة لاستكمال النواقص</button>` : ''}
      ${['approved', 'needs_completion'].includes(f.status) ? `<button class="btn sm" data-rev="reopen">${icon('rotate-ccw')} إعادة فتح المراجعة</button>` : ''}
      <button class="btn sm ghost" data-rev="note">${icon('message-square-plus')} ملاحظة إدارية</button>
      ${!canApprove ? `<span class="muted" style="font-size:.8rem">الاعتماد النهائي للمديرة ورئيسة اللجنة</span>` : ''}
    </div>` : ''}

    <div class="file-layout">
      <div class="card" style="padding:12px">
        <div class="card-head" style="padding:4px 6px 0"><h3>${icon('eye')} معاينة الملف الأصلي</h3></div>
        <div class="preview" data-prev><div class="empty"><span class="spinner"></span></div></div>
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head"><h3>${icon('info')} بيانات الملف</h3>${canEdit ? `<button class="btn sm ghost" data-meta>${icon('pencil')} تعديل</button>` : ''}</div>
          <dl class="kv">
            <dt>صاحبة الملف</dt><dd>${esc(owner?.full_name || 'وثيقة عامة للجنة')}</dd>
            <dt>المجلد</dt><dd>${esc(cat.title)}${f.folder_path ? ' / ' + esc(f.folder_path) : ''}</dd>
            <dt>المتطلب</dt><dd>${esc(reqTitle || '—')}</dd>
            <dt>المادة</dt><dd>${esc(subjectName(f.subject_id) || '—')}</dd>
            <dt>الصف</dt><dd>${esc(gradeName(f.grade_id) || '—')}</dd>
            <dt>الفصل الدراسي</dt><dd>${esc(f.semester || '—')}</dd>
            <dt>الحجم</dt><dd class="num">${fmtSize(f.size_bytes)}</dd>
            <dt>تاريخ الرفع</dt><dd>${fmtDate(f.created_at, true)} — ${esc(people[f.uploaded_by] || '')}</dd>
            ${f.reviewed_at ? `<dt>آخر مراجعة</dt><dd>${fmtDate(f.reviewed_at, true)} — ${esc(people[f.reviewed_by] || '')}</dd>` : ''}
          </dl>
        </div>
        ${analysisCard(an, f)}
        <div class="card">
          <div class="card-head"><h3>${icon('messages-square')} سجل المراجعة والملاحظات</h3></div>
          ${notes.length ? `<div class="timeline">${notes.map((n) => `<div class="t"><span class="d" style="background:${n.kind === 'approve' ? 'var(--ok)' : n.kind === 'return' ? 'var(--bad)' : 'var(--gold)'}"></span>
            <div><b>${esc({ approve: 'اعتماد', return: 'إعادة للاستكمال', reopen: 'إعادة فتح', note: 'ملاحظة' }[n.kind] || n.kind)}</b> — ${esc(people[n.author_id] || '')} <small>${timeAgo(n.created_at)}</small>
            ${n.body ? `<div>${esc(n.body)}</div>` : ''}</div></div>`).join('')}</div>` : emptyState('لا توجد ملاحظات بعد', 'message-square')}
        </div>
        <div data-links></div>
      </div>
    </div>`;
  refreshIcons();

  renderPreview(view.querySelector('[data-prev]'), f);
  if (an?.stats) drawStats(view, an.stats);
  relatedLinks(view.querySelector('[data-links]'), f, an);

  view.querySelector('[data-dl]').addEventListener('click', async () => {
    try { location.href = await signedUrl(f.storage_path, true, f.name); } catch (e) { toast(errMsg(e), 'bad'); }
  });
  view.querySelector('[data-an]')?.addEventListener('click', async (e) => {
    let gradeOpts = {};
    if (needsGradeOptions(f.category_key, f.ext)) {
      gradeOpts = await askGradeOpts(an?.stats);
      if (!gradeOpts) return;
    }
    await withBusy(e.currentTarget, async () => {
      try {
        const r = await analyzeFile(f, null, gradeOpts);
        toast(r.ok ? 'اكتملت القراءة والتحليل' : (r.reason || 'تمت المعالجة'), r.ok ? 'ok' : 'warn', 6000);
        rerender(); updateBadges();
      } catch (ex) { toast(errMsg(ex), 'bad', 7000); rerender(); }
    });
  });
  view.querySelector('[data-rep]')?.addEventListener('click', () =>
    openUploadDialog({ category: f.category_key, teacherId: f.teacher_id, folderPath: f.folder_path, requirementId: f.requirement_id, replace: f, onDone: (rows) => { if (rows[0]) location.hash = '#/file/' + rows[0].id; } }));
  view.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!(await confirmBox(`حذف الملف "${f.name}" نهائياً؟ لا يمكن التراجع.`, { ok: 'حذف', danger: true }))) return;
    try {
      const { error } = await sb.from('files').delete().eq('id', f.id);
      if (error) throw error;
      await sb.storage.from('files').remove([f.storage_path]);
      toast('تم حذف الملف', 'ok');
      location.hash = folderLink(f.category_key, f.teacher_id, f.folder_path);
    } catch (e) { toast(errMsg(e), 'bad'); }
  });
  view.querySelectorAll('[data-rev]').forEach((b) => b.addEventListener('click', async () => {
    const d = b.dataset.rev;
    let note = null;
    if (d === 'return') { note = await promptBox('اكتبي النواقص المطلوب استكمالها (ستصل للمعلمة)', { title: 'إعادة لاستكمال النواقص', textarea: true, required: true, ok: 'إعادة', value: suggestReturnNote(an) }); if (note === null) return; }
    else if (d === 'note') { note = await promptBox('الملاحظة الإدارية', { textarea: true, required: true, ok: 'حفظ وإشعار المعلمة' }); if (note === null) return; }
    else if (d === 'approve') { if (!(await confirmBox('اعتماد هذا الملف؟ سيُحسب المتطلب مكتملاً ويصل إشعار للمعلمة.', { ok: 'اعتماد' }))) return; }
    try {
      const { error } = await sb.rpc('review_file', { p_file: f.id, p_decision: d, p_note: note });
      if (error) throw error;
      toast('تم حفظ القرار', 'ok'); rerender(); updateBadges();
    } catch (e) { toast(errMsg(e), 'bad'); }
  }));
  view.querySelector('[data-meta]')?.addEventListener('click', () => editMeta(f));
  view.querySelector('[data-mark-reviewed]')?.addEventListener('click', async () => {
    const { error } = await sb.from('file_analyses').update({ reviewed: true }).eq('id', an.id);
    if (error) toast(errMsg(error), 'bad'); else { toast('تم تأكيد مراجعة البيانات المستخرجة', 'ok'); rerender(); }
  });
}

function suggestReturnNote(an) {
  if (!an?.elements?.length) return '';
  const miss = an.elements.filter((e) => e.status !== 'present').map((e) => `- ${e.item}${e.note ? ': ' + e.note : ''}`);
  return miss.length ? 'يرجى استكمال ما يلي:\n' + miss.join('\n') : '';
}

function analysisCard(an, f) {
  if (!an) return `<div class="card ai-box"><div class="card-head"><h3>${icon('sparkles')} القراءة والتحليل</h3></div>
    ${f.status === 'processing' ? `<p>${icon('loader')} الملف قيد القراءة…</p>` : emptyState('لم يُحلَّل هذا الملف بعد. اضغطي "قراءة وتحليل".', 'scan-text')}</div>`;
  const ex = an.extracted || {};
  const elements = an.elements || [];
  const sections = ex.sections || [];
  const present = elements.filter((e) => e.status === 'present').length;
  return `<div class="card ai-box">
    <div class="card-head"><h3>${icon('sparkles')} نتيجة القراءة والتحليل</h3>
      <span class="chip ai">${esc(METHOD[an.method] || an.method || '')}</span></div>
    <div class="ai-note" style="margin-bottom:10px">${icon('shield-alert')} نتائج آلية — تُعتمد بعد المراجعة البشرية. ${an.reviewed ? '<span class="chip ok">روجعت</span>' : (App.isStaff && !an.error ? '<button class="btn sm ghost" data-mark-reviewed>تأكيد مراجعة البيانات</button>' : '')}</div>
    ${an.error ? `<div class="alert ${/خصوصية|غير مفعل|موقوف/.test(an.error) ? 'warn' : 'bad'}">${icon('triangle-alert')}<div>${esc(an.error)}</div></div>` : ''}
    ${an.doc_type_label ? `<p><b>نوع الوثيقة:</b> ${esc(an.doc_type_label)} ${ex.confidence ? `<span class="chip ${ex.confidence === 'high' ? 'ok' : ex.confidence === 'low' ? 'bad' : 'warn'}">ثقة ${({ high: 'عالية', medium: 'متوسطة', low: 'منخفضة' })[ex.confidence]}</span>` : ''}</p>` : ''}
    ${an.summary ? `<h4>الملخص</h4><p>${esc(an.summary)}</p>` : ''}
    ${!an.error || Object.keys(ex).length > 2 ? `<h4>البيانات المستخرجة</h4><dl class="kv">${Object.entries(FIELD_LABELS).map(([k, l]) => `<dt>${l}</dt>${ex[k] ? `<dd>${esc(ex[k])}</dd>` : `<dd class="unknown">غير معروفة — تحتاج مراجعة</dd>`}`).join('')}</dl>` : ''}
    ${elements.length ? `<h4 style="margin-top:14px">اكتمال الملف <span class="chip">${present}/${elements.length}</span></h4><div class="el-list">
      ${elements.map((e) => `<div class="el ${e.status}"><span class="s">${icon(e.status === 'present' ? 'circle-check' : e.status === 'missing' ? 'circle-x' : 'circle-help')}</span>
        <div><b>${esc(e.item)}</b> <span class="muted" style="font-size:.78rem">${e.status === 'present' ? 'مكتمل' : e.status === 'missing' ? 'غير موجود' : 'يحتاج مراجعة'}</span>${e.note ? `<div class="n">${esc(e.note)}</div>` : ''}</div></div>`).join('')}</div>` : ''}
    ${sections.map((s) => `<h4 style="margin-top:14px">${esc(s.title)}</h4><ul style="margin:0;padding-inline-start:20px">${(s.items || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`).join('')}
    ${an.stats ? statsHtml(an.stats) : ''}
    ${(an.quality_notes || []).length ? `<h4 style="margin-top:14px">ملاحظات على جودة الملف</h4><ul style="margin:0;padding-inline-start:20px">${an.quality_notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    ${(an.recommendations || []).length ? `<h4 style="margin-top:14px">توصيات التحسين <span class="chip ai">مقترحة من الذكاء الاصطناعي</span></h4><ul style="margin:0;padding-inline-start:20px">${an.recommendations.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    ${(an.unknown_fields || []).length ? `<div class="alert warn" style="margin-top:12px">${icon('circle-help')}<div><b>معلومات تعذر تحديدها:</b> ${an.unknown_fields.map(esc).join('، ')}</div></div>` : ''}
    <p class="muted" style="font-size:.76rem;margin-top:12px">${fmtDate(an.created_at, true)}${an.model ? ' · ' + esc(an.model) : ''}</p>
  </div>`;
}

function statsHtml(s) {
  if (s.kind === 'grades') {
    if (!s.ok) return `<div class="alert warn" style="margin-top:12px">${icon('calculator')}<div>${esc(s.error)}</div></div>`;
    return `<h4 style="margin-top:14px">${icon('calculator')} الإحصاءات المحسوبة من الكشف <span class="chip ok">بيانات فعلية</span></h4>
      <p class="muted" style="font-size:.82rem">عدد الطالبات: <b>${fmtNum(s.students)}</b> · نسبة النجاح المعتمدة: ${fmtPct(s.pass_pct)}${s.mastery_pct ? ` · معيار الإتقان: ${fmtPct(s.mastery_pct)}` : ' · لم يُحدد معيار إتقان'}${s.sheet ? ` · الورقة: ${esc(s.sheet)}` : ''}</p>
      <div class="table-wrap"><table><thead><tr><th>العمود</th><th>العظمى</th><th>العدد</th><th>المتوسط</th><th>المتوسط ٪</th><th>النجاح</th>${s.mastery_pct ? '<th>الإتقان</th>' : ''}</tr></thead><tbody>
      ${s.columns.map((c) => `<tr${c.label === s.main_column ? ' style="font-weight:700"' : ''}><td>${esc(c.label)}</td><td class="num">${c.max ?? '؟'}</td><td class="num">${c.n}</td><td class="num">${c.mean ?? '—'}</td><td class="num">${fmtPct(c.mean_pct)}</td><td class="num">${fmtPct(c.pass_rate)}</td>${s.mastery_pct ? `<td class="num">${fmtPct(c.mastery_rate)}</td>` : ''}</tr>`).join('')}
      </tbody></table></div>
      <div class="chart-box" style="height:200px;margin-top:10px"><canvas data-levels></canvas></div>
      ${s.skills ? `<h4 style="margin-top:12px">المهارات</h4><div class="el-list">${s.skills.map((k) => `<div class="el ${k.status === 'mastered' ? 'present' : k.status === 'needs_intervention' ? 'missing' : 'review'}"><span class="s">${icon(k.status === 'mastered' ? 'circle-check' : k.status === 'needs_intervention' ? 'circle-x' : 'circle-help')}</span>
        <div><b>${esc(k.skill)}</b><div class="n">${k.mastery_rate !== null ? `أتقنتها ${fmtPct(k.mastery_rate)} (${k.mastered} من ${k.n})` : 'لا يمكن الحكم دون معيار إتقان ودرجة عظمى'}</div></div></div>`).join('')}</div>` : ''}
      ${[...s.issues, ...s.columns.flatMap((c) => (c.issues || []).map((m) => ({ message: `${c.label}: ${m}` })))].length ? `<div class="alert warn" style="margin-top:10px">${icon('triangle-alert')}<div><b>تنبيهات على البيانات:</b><ul style="margin:4px 0 0;padding-inline-start:18px">${[...s.issues, ...s.columns.flatMap((c) => (c.issues || []).map((m) => ({ message: `${c.label}: ${m}` })))].map((i) => `<li>${esc(i.message)}</li>`).join('')}</ul></div></div>` : ''}`;
  }
  if (s.kind === 'survey') {
    if (!s.ok) return `<div class="alert warn" style="margin-top:12px">${icon('calculator')}<div>${esc(s.error || 'تعذر تحليل الاستبانة')}</div></div>`;
    return `<h4 style="margin-top:14px">${icon('calculator')} نتائج الاستبانة <span class="chip ok">بيانات فعلية</span></h4>
      <p class="muted" style="font-size:.82rem">عدد الاستجابات: <b>${fmtNum(s.responses)}</b> · متوسط الرضا العام: <b>${s.overall_mean ?? '—'}</b> من 5 (${fmtPct(s.overall_pct)})</p>
      <div class="table-wrap"><table><thead><tr><th>العبارة</th><th>ن</th><th>المتوسط</th><th>موافق</th><th>محايد</th><th>غير موافق</th></tr></thead><tbody>
      ${s.questions.map((x) => `<tr><td>${esc(x.question)}</td><td class="num">${x.n}</td><td class="num">${x.mean}</td><td class="num">${fmtPct(x.agree_pct)}</td><td class="num">${fmtPct(x.neutral_pct)}</td><td class="num">${fmtPct(x.disagree_pct)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="chart-box" style="height:${Math.max(180, s.questions.length * 34)}px;margin-top:10px"><canvas data-survey></canvas></div>`;
  }
  return '';
}

async function drawStats(view, s) {
  let C; try { C = await Chart(); } catch (e) { return; }
  const lv = view.querySelector('[data-levels]');
  if (lv && s.kind === 'grades') {
    const main = s.columns.find((c) => c.label === s.main_column);
    if (!main?.levels) { lv.parentElement.remove(); }
    else new C(lv, { type: 'bar', data: { labels: Object.keys(main.levels), datasets: [{ label: `عدد الطالبات — ${main.label}`, data: Object.values(main.levels), backgroundColor: [cssVar('--ok'), cssVar('--primary'), cssVar('--info'), cssVar('--gold'), cssVar('--bad')], borderRadius: 6 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: true, text: `توزيع مستويات الأداء — ${main.label}` } }, scales: { y: { ticks: { precision: 0 } } } } });
  }
  const sv = view.querySelector('[data-survey]');
  if (sv && s.kind === 'survey') {
    new C(sv, { type: 'bar', data: { labels: s.questions.map((x) => x.question.length > 48 ? x.question.slice(0, 46) + '…' : x.question),
      datasets: [
        { label: 'موافق', data: s.questions.map((x) => x.agree_pct), backgroundColor: cssVar('--primary'), stack: 'a' },
        { label: 'محايد', data: s.questions.map((x) => x.neutral_pct), backgroundColor: cssVar('--gold'), stack: 'a' },
        { label: 'غير موافق', data: s.questions.map((x) => x.disagree_pct), backgroundColor: cssVar('--bad'), stack: 'a' }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { position: 'bottom', rtl: true } }, scales: { x: { stacked: true, max: 100, ticks: { callback: (v) => v + '٪' } }, y: { stacked: true, position: 'right' } } } });
  }
}

async function renderPreview(box, f) {
  const ext = (f.ext || f.name.split('.').pop()).toLowerCase();
  try {
    if (ext === 'pdf') {
      const url = await signedUrl(f.storage_path);
      box.innerHTML = `<iframe src="${esc(url)}" title="معاينة ${esc(f.name)}"></iframe>`;
    } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      const url = await signedUrl(f.storage_path);
      box.innerHTML = `<img src="${esc(url)}" alt="${esc(f.name)}">`;
    } else if (ext === 'docx') {
      const blob = await downloadFileBlob(f.storage_path);
      box.innerHTML = `<div class="doc-html" dir="auto">${sanitize(await docxToHtml(await blob.arrayBuffer()))}</div>`;
    } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
      const blob = await downloadFileBlob(f.storage_path);
      box.innerHTML = `<div class="sheet-html">${sanitize(await sheetToHtml(await blob.arrayBuffer(), ext))}</div>`;
    } else if (ext === 'txt') {
      const blob = await downloadFileBlob(f.storage_path);
      box.innerHTML = `<pre class="doc-html" style="white-space:pre-wrap">${esc(await blob.text())}</pre>`;
    } else {
      box.innerHTML = emptyState('لا تتوفر معاينة لهذه الصيغة داخل المتصفح. نزّلي الملف لفتحه.', 'file');
    }
  } catch (e) {
    box.innerHTML = `<div class="alert bad" style="margin:12px">${icon('circle-x')}<div>تعذرت المعاينة: ${esc(errMsg(e))}</div></div>`;
  }
  refreshIcons();
}

// إزالة أي سكربتات أو أحداث من HTML المستخرج من الملفات
function sanitize(html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  t.content.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((n) => n.remove());
  t.content.querySelectorAll('*').forEach((n) => [...n.attributes].forEach((a) => {
    if (/^on/i.test(a.name) || (/^(href|src)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name);
  }));
  return t.innerHTML;
}

function askGradeOpts(prev) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title: 'إعدادات تحليل الدرجات',
      body: `<p class="muted">تُحسب الإحصاءات من الكشف الأصلي داخل المتصفح.</p><div class="form-grid">
        <label class="field">الدرجة العظمى للمجموع<input type="number" data-max value="${prev?.columns?.find((c) => c.is_total)?.max ?? ''}"></label>
        <label class="field">الدرجة العظمى لكل مهارة/عمود<input type="number" data-maxcol></label>
        <label class="field">نسبة النجاح ٪<input type="number" data-pass value="${prev?.pass_pct ?? 50}"></label>
        <label class="field">معيار الإتقان ٪<input type="number" data-mastery value="${prev?.mastery_pct ?? ''}" placeholder="اختياري"></label></div>`,
      footer: `<button class="btn primary" data-ok>متابعة</button><button class="btn ghost" data-close>إلغاء</button>`,
      onClose: () => { if (!done) resolve(null); },
    });
    m.$('[data-ok]').addEventListener('click', () => {
      done = true;
      const v = (s) => Number(m.$(s).value) || undefined;
      resolve({ maxScore: v('[data-max]'), maxPerColumn: v('[data-maxcol]'), passPct: v('[data-pass]') || 50, masteryPct: v('[data-mastery]') || null });
      m.close();
    });
  });
}

async function editMeta(f) {
  const reqs = (await q.requirements()).filter((r) => r.category_key === f.category_key && (!r.teacher_id || r.teacher_id === f.teacher_id));
  const m = modal({
    title: 'تعديل بيانات الملف',
    body: `<div class="form-grid">
      <label class="field full">اسم الملف<input data-name value="${esc(f.name)}"></label>
      <label class="field">المتطلب<select data-req><option value="">—</option>${reqs.map((r) => `<option value="${r.id}" ${r.id === f.requirement_id ? 'selected' : ''}>${esc(r.title)}</option>`).join('')}</select></label>
      <label class="field">الفصل الدراسي<input data-sem value="${esc(f.semester || '')}"></label>
      <label class="field">المادة<select data-subj><option value="">—</option>${App.subjects.map((s) => `<option value="${s.id}" ${s.id === f.subject_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="field">الصف<select data-grade><option value="">—</option>${App.grades.map((s) => `<option value="${s.id}" ${s.id === f.grade_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="field full">المسار داخل المجلد <span class="hint">مثال: الرياضيات/الأول المتوسط</span><input data-path value="${esc(f.folder_path || '')}"></label></div>`,
    footer: `<button class="btn primary" data-ok>حفظ</button><button class="btn ghost" data-close>إلغاء</button>`,
  });
  m.$('[data-ok]').addEventListener('click', async (e) => {
    await withBusy(e.currentTarget, async () => {
      const patch = {
        name: m.$('[data-name]').value.trim() || f.name, requirement_id: m.$('[data-req]').value || null,
        semester: m.$('[data-sem]').value.trim() || null, subject_id: Number(m.$('[data-subj]').value) || null,
        grade_id: Number(m.$('[data-grade]').value) || null,
        folder_path: m.$('[data-path]').value.split('/').map((s) => s.trim()).filter(Boolean).join('/'),
      };
      const { error } = await sb.from('files').update(patch).eq('id', f.id);
      if (error) toast(errMsg(error), 'bad'); else { toast('تم الحفظ', 'ok'); m.close(); rerender(); }
    });
  });
}

// روابط مرتبطة: من التشخيص إلى الخطة العلاجية، ومقارنة الفترات عند توفر بيانات قابلة للمقارنة
async function relatedLinks(box, f, an) {
  if (!f.teacher_id) return;
  if (f.category_key === 'diagnostic') {
    let plans = await q.files({ category: 'remedial', teacher: f.teacher_id });
    if (f.subject_id) plans = plans.filter((p) => !p.subject_id || p.subject_id === f.subject_id);
    box.innerHTML = `<div class="card"><div class="card-head"><h3>${icon('link')} الخطط العلاجية المرتبطة بهذا التشخيص</h3></div>
      ${plans.length ? `<div class="list">${plans.map((p) => `<a class="list-item" href="#/file/${p.id}" style="color:inherit;text-decoration:none"><div class="li-ic">${icon('heart-pulse')}</div><div class="li-main"><div class="li-t">${esc(p.name)}</div><div class="li-s">${esc(subjectName(p.subject_id) || '')}</div></div>${statusChip(p.status)}</a>`).join('')}</div>`
        : `<p class="muted">لا توجد خطة علاجية مرفوعة لهذه المعلمة${f.subject_id ? ' في هذه المادة' : ''} بعد.</p>`}
      <a class="btn sm" href="${folderLink('remedial', f.teacher_id)}">${icon('folder-open')} مجلد الخطط العلاجية</a></div>`;
  }
  if (f.category_key === 'period_tests' && an?.stats?.ok) {
    let others = (await q.files({ category: 'period_tests', teacher: f.teacher_id })).filter((x) => x.id !== f.id && x.subject_id === f.subject_id && x.grade_id === f.grade_id);
    if (!f.subject_id || !f.grade_id) others = [];
    const ans = await q.analyses(others.map((o) => o.id));
    const comps = ans.filter((a) => a.stats?.ok).map((a) => ({ file: others.find((o) => o.id === a.file_id), c: comparePeriods(a.stats, an.stats) }));
    box.innerHTML = `<div class="card"><div class="card-head"><h3>${icon('git-compare')} المقارنة بين الفترات</h3></div>
      ${!f.subject_id || !f.grade_id ? '<p class="muted">حددي المادة والصف لهذا الملف لتمكين المقارنة مع الفترات الأخرى.</p>' :
        comps.length ? `<div class="table-wrap"><table><thead><tr><th>مقارنة مع</th><th>المتوسط ٪ (الملف الآخر ← هذا الملف)</th><th>النجاح ٪</th></tr></thead><tbody>
        ${comps.map(({ file, c }) => c.comparable ? `<tr><td><a href="#/file/${file.id}">${esc(file.name)}</a></td><td class="num">${fmtPct(c.mean_pct_a)} ← ${fmtPct(c.mean_pct_b)} (${c.diff_mean_pct > 0 ? '+' : ''}${c.diff_mean_pct})</td><td class="num">${fmtPct(c.pass_rate_a)} ← ${fmtPct(c.pass_rate_b)}</td></tr>`
          : `<tr><td>${esc(file.name)}</td><td colspan="2" class="muted">${esc(c.reason)}</td></tr>`).join('')}</tbody></table></div>
          <p class="muted" style="font-size:.78rem;margin-top:6px">المقارنة وصفية بين ملفين لنفس المادة والصف؛ اختلاف عدد الطالبات أو طبيعة الاختبار قد يؤثر على التفسير.</p>`
        : '<p class="muted">لا توجد فترة أخرى محللة لنفس المادة والصف؛ لا يمكن الحكم على التحسن أو التراجع.</p>'}</div>`;
  }
  refreshIcons();
}
