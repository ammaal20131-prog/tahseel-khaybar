// مستعرض المجلد: مجلدات المعلمات ← المجلدات الفرعية ← الملفات
import { App, sb, q, catOf, subjectName, gradeName, teacherNameMap, signedUrl } from '../api.js';
import { esc, icon, fmtNum, fmtPct, fmtSize, timeAgo, statusChip, reqChip, fileIcon, emptyState, progressBar, pctClass, toast, promptBox, confirmBox, errMsg, withBusy, refreshIcons, STATUS, initials } from '../ui.js';
import { pageHead, catIcon, folderLink } from './_common.js';
import { openUploadDialog, analyzeMany } from '../upload.js';
import { rerender } from '../main.js';
import { NAFES_KEY, NAFES_SECTIONS, nafesSubjectIds } from '../nafes.js';

export default async function folder(view, params, query) {
  const cat = catOf(params.cat);
  if (!cat?.title || !App.categories.some((c) => c.key === params.cat)) throw new Error('المجلد غير موجود');

  // مجلد بحسب المعلمات: الإدارة ترى قائمة المعلمات أولاً، والمعلمة تُحوَّل لمجلدها
  if (cat.per_teacher && !params.teacher) {
    if (!App.isStaff) { location.replace(folderLink(cat.key, App.user.id)); return; }
    return teacherList(view, cat);
  }
  const teacherId = params.teacher && params.teacher !== 'general' ? params.teacher : null;
  if (!teacherId && !App.isStaff) throw new Error('هذا المجلد مشترك للجنة والإدارة');
  if (teacherId && !App.isStaff && teacherId !== App.user.id) throw new Error('لا يمكنك فتح مجلد معلمة أخرى');
  return browser(view, cat, teacherId, query.path || '');
}

async function teacherList(view, cat) {
  const [prog, reqs, files] = await Promise.all([q.progress(), q.reqStatus(), q.files({ category: cat.key })]);
  const byT = {};
  files.forEach((f) => { (byT[f.teacher_id] ||= []).push(f); });
  // نافس: معلمات العلوم والرياضيات واللغة العربية فقط (من لديهن متطلبات نافس أو ملفات فيه)
  const nafesOnly = cat.key === NAFES_KEY;
  const rows = prog.filter((t) => t.active && (!nafesOnly || reqs.some((x) => x.teacher_id === t.teacher_id && x.category_key === cat.key) || files.some((f) => f.teacher_id === t.teacher_id))).map((t) => {
    const r = reqs.filter((x) => x.teacher_id === t.teacher_id && x.category_key === cat.key);
    const submitted = r.filter((x) => x.state !== 'missing').length;
    const fs = byT[t.teacher_id] || [];
    return { ...t, req: r.length, submitted, pct: r.length ? Math.round((100 * submitted) / r.length) : null, files: fs.length,
      review: fs.filter((f) => ['read_ok', 'needs_review'].includes(f.status)).length, last: fs[0]?.created_at };
  });
  view.innerHTML = `
    ${pageHead(`${icon(catIcon(cat.key))} ${esc(cat.title)}`, esc(cat.description || ''), `
      <button class="btn" data-mk>${icon('folder-plus')} إنشاء مجلدات المعلمات الفرعية</button>`,
      `<a href="#/folders">المجلدات</a> ${icon('chevron-left')} <span>${esc(cat.title)}</span>`)}
    <div class="card">
      <div class="filters" style="margin-bottom:12px">
        <input type="search" placeholder="بحث باسم المعلمة" data-f>
        <select data-st><option value="">كل الحالات</option><option value="missing">لديها نواقص</option><option value="review">بانتظار مراجعة</option><option value="done">مكتمل الرفع</option></select>
      </div>
      <div class="sub-folders" data-grid></div>
    </div>`;
  const grid = view.querySelector('[data-grid]');
  const paint = () => {
    const f = view.querySelector('[data-f]').value.trim();
    const st = view.querySelector('[data-st]').value;
    const list = rows.filter((r) => (!f || r.full_name.includes(f)) &&
      (!st || (st === 'missing' && r.submitted < r.req) || (st === 'review' && r.review) || (st === 'done' && r.req && r.submitted === r.req)));
    grid.innerHTML = list.length ? list.map((r) => `<a class="sub-folder" href="${folderLink(cat.key, r.teacher_id)}" style="flex-direction:column;align-items:stretch;gap:8px">
      <div class="row" style="gap:10px;flex-wrap:nowrap">${icon('folder')}<div style="min-width:0"><div class="sn">${esc(r.full_name)}</div>
        <div class="sm">${fmtNum(r.files)} ملف${r.review ? ` · ${fmtNum(r.review)} للمراجعة` : ''}${r.last ? ' · ' + timeAgo(r.last) : ''}</div></div></div>
      ${r.pct !== null ? `<div class="mini-bar">${progressBar(r.pct, pctClass(r.pct))}<small class="num">${r.submitted}/${r.req}</small></div>` : '<small class="muted">لا متطلبات محددة</small>'}
    </a>`).join('') : emptyState(rows.length ? 'لا نتائج مطابقة' : 'لا توجد معلمات مسجلات بعد', 'users');
    refreshIcons();
  };
  view.querySelector('[data-f]').addEventListener('input', paint);
  view.querySelector('[data-st]').addEventListener('change', paint);
  view.querySelector('[data-mk]').addEventListener('click', async (e) => {
    await withBusy(e.currentTarget, async () => {
      const n = await makeSubjectFolders(cat.key, rows.map((r) => r.teacher_id));
      toast(n ? `أُنشئ ${n} مجلداً فرعياً حسب مواد وصفوف كل معلمة` : 'المجلدات موجودة مسبقاً أو لم تُحدد مواد المعلمات بعد', n ? 'ok' : 'warn');
    });
  });
  paint();
}

// إنشاء مجلدات فرعية: المادة / الصف (+ الفترات لمجلد اختبارات الفترة)
async function makeSubjectFolders(catKey, teacherIds) {
  const asg = await q.assignments();
  let n = 0;
  const periods = catKey === 'period_tests' ? ['الفترة الأولى', 'الفترة الثانية'] : [];
  const nafes = catKey === NAFES_KEY, nsids = nafesSubjectIds();
  for (const tid of teacherIds) {
    if (nafes) {
      for (const sid of [...new Set(asg.filter((x) => x.teacher_id === tid && nsids.includes(x.subject_id)).map((x) => x.subject_id))]) {
        const sn = subjectName(sid);
        for (const p of [sn, ...NAFES_SECTIONS.map((x) => `${sn}/${x}`)]) {
          const { error } = await sb.from('folders').insert({ category_key: catKey, teacher_id: tid, path: p, created_by: App.user.id });
          if (!error) n++;
        }
      }
      continue;
    }
    for (const a of asg.filter((x) => x.teacher_id === tid)) {
      const base = `${subjectName(a.subject_id)}/${gradeName(a.grade_id)}`;
      const paths = [subjectName(a.subject_id), base, ...periods.map((p) => `${base}/${p}`)];
      for (const p of paths) {
        const { error } = await sb.from('folders').insert({ category_key: catKey, teacher_id: tid, path: p, created_by: App.user.id });
        if (!error) n++;
      }
    }
  }
  return n;
}

async function browser(view, cat, teacherId, path) {
  const [files, folders, teacher, reqs] = await Promise.all([
    q.files({ category: cat.key, teacher: teacherId }),
    q.folders(cat.key, teacherId),
    teacherId ? q.teacher(teacherId) : null,
    teacherId ? q.reqStatus(teacherId) : Promise.resolve([]),
  ]);
  const catReqs = reqs.filter((r) => r.category_key === cat.key);
  const prefix = path ? path + '/' : '';
  // المجلدات الفرعية المباشرة في المسار الحالي
  const subSet = new Map();
  const addSub = (p) => {
    if (!p.startsWith(prefix) || p === path) return;
    const name = p.slice(prefix.length).split('/')[0];
    if (name) subSet.set(name, (subSet.get(name) || 0));
  };
  folders.forEach((f) => addSub(f.path));
  files.forEach((f) => { if (f.folder_path) addSub(f.folder_path); });
  files.forEach((f) => { const fp = f.folder_path || ''; if (fp.startsWith(prefix) && fp !== path) { const n = fp.slice(prefix.length).split('/')[0]; if (subSet.has(n)) subSet.set(n, subSet.get(n) + 1); } });
  const here = files.filter((f) => (f.folder_path || '') === path);
  const ownerName = teacher?.full_name || 'المجلد المشترك';
  const canUpload = App.isStaff || teacherId === App.user.id;

  const crumbsParts = path ? path.split('/') : [];
  const crumbs = [
    `<a href="#/folders">المجلدات</a>`,
    cat.per_teacher && App.isStaff ? `<a href="${folderLink(cat.key, null)}">${esc(cat.title)}</a>` : `<a href="${folderLink(cat.key, teacherId)}">${esc(cat.title)}</a>`,
    cat.per_teacher && App.isStaff ? `<a href="${folderLink(cat.key, teacherId)}">${esc(ownerName)}</a>` : '',
    ...crumbsParts.map((p, i) => `<a href="${folderLink(cat.key, teacherId || (cat.per_teacher ? null : null), crumbsParts.slice(0, i + 1).join('/'))}">${esc(p)}</a>`),
  ].filter(Boolean).join(` ${icon('chevron-left')} `);

  view.innerHTML = `
    ${pageHead(`${icon(path ? 'folder-open' : catIcon(cat.key))} ${esc(path ? crumbsParts[crumbsParts.length - 1] : (cat.per_teacher ? ownerName : cat.title))}`,
      cat.per_teacher ? `${esc(cat.title)}${teacher ? ` · ${esc(teacher.full_name)}` : ''}` : esc(cat.description || ''),
      canUpload ? `<button class="btn primary" data-up>${icon('upload')} رفع ملفات أو مجلد</button>
        <button class="btn" data-newf>${icon('folder-plus')} مجلد فرعي</button>
        ${files.some((f) => ['unprocessed', 'failed'].includes(f.status)) ? `<button class="btn" data-anall>${icon('sparkles')} تحليل غير المقروء</button>` : ''}` : '',
      crumbs)}

    ${catReqs.length && !path ? `<div class="card" style="margin-bottom:16px">
      <div class="card-head"><h3>${icon('list-checks')} الملفات المطلوبة في هذا المجلد</h3>
        <span class="muted" style="font-size:.85rem">${catReqs.filter((r) => r.state !== 'missing').length} من ${catReqs.length} مرفوع</span></div>
      <div class="table-wrap"><table><thead><tr><th>المتطلب</th><th>الموعد النهائي</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${catReqs.map((r) => `<tr><td><b>${esc(r.title)}</b></td><td class="num">${esc(r.due_date || '—')}</td><td>${reqChip(r.state)}</td>
        <td class="actions">${canUpload && r.state !== 'complete' ? `<button class="btn sm" data-up-req="${r.requirement_id}">${icon('upload')} رفع</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></div>` : ''}

    ${subSet.size ? `<div class="sub-folders" style="margin-bottom:16px">
      ${[...subSet.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ar')).map(([n, c]) => `<a class="sub-folder" href="${folderLink(cat.key, teacherId, prefix + n)}">${icon('folder')}
        <div><div class="sn">${esc(n)}</div><div class="sm">${fmtNum(c)} ملف</div></div></a>`).join('')}
    </div>` : ''}

    <div class="card">
      <div class="card-head"><h3>${icon('files')} الملفات ${here.length ? `<span class="chip">${fmtNum(here.length)}</span>` : ''}</h3>
        <div class="filters"><input type="search" placeholder="بحث في المجلد" data-ff>
          <select data-fs><option value="">كل الحالات</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></div></div>
      <div data-files></div>
    </div>`;

  const paintFiles = () => {
    const ff = view.querySelector('[data-ff]').value.trim();
    const fs = view.querySelector('[data-fs]').value;
    const list = (ff ? files.filter((f) => f.name.includes(ff) || (f.folder_path || '').includes(ff)) : here).filter((f) => !fs || f.status === fs);
    view.querySelector('[data-files]').innerHTML = list.length ? `<div class="table-wrap"><table>
      <thead><tr><th>الملف</th>${ff ? '<th>المسار</th>' : ''}<th>المادة / الصف</th><th>الحجم</th><th>رُفع</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${list.map((f) => `<tr>
        <td><a class="file-name" href="#/file/${f.id}">${icon(fileIcon(f.name))}<span>${esc(f.name)}</span></a></td>
        ${ff ? `<td class="muted">${esc(f.folder_path || '—')}</td>` : ''}
        <td class="muted">${esc([subjectName(f.subject_id), gradeName(f.grade_id)].filter(Boolean).join(' · ') || '—')}</td>
        <td class="num muted">${fmtSize(f.size_bytes)}</td>
        <td class="muted">${timeAgo(f.created_at)}</td>
        <td>${statusChip(f.status)}</td>
        <td class="actions"><button class="btn sm ghost" data-dl="${f.id}" title="تنزيل">${icon('download')}</button>
          <a class="btn sm" href="#/file/${f.id}">${icon('eye')} فتح</a></td>
      </tr>`).join('')}</tbody></table></div>`
      : emptyState(files.length ? 'لا توجد ملفات في هذا المستوى' : 'المجلد فارغ — ابدئي برفع الملفات', 'folder-open');
    refreshIcons();
    view.querySelectorAll('[data-dl]').forEach((b) => b.addEventListener('click', async () => {
      const f = files.find((x) => x.id === b.dataset.dl);
      try { location.href = await signedUrl(f.storage_path, true, f.name); } catch (e) { toast(errMsg(e), 'bad'); }
    }));
  };
  view.querySelector('[data-ff]').addEventListener('input', paintFiles);
  view.querySelector('[data-fs]').addEventListener('change', paintFiles);
  paintFiles();

  const up = (requirementId) => openUploadDialog({ category: cat.key, teacherId, folderPath: path, requirementId, onDone: () => setTimeout(rerender, 400) });
  view.querySelector('[data-up]')?.addEventListener('click', () => up(null));
  view.querySelectorAll('[data-up-req]').forEach((b) => b.addEventListener('click', () => up(b.dataset.upReq)));
  view.querySelector('[data-newf]')?.addEventListener('click', async () => {
    const name = await promptBox('اسم المجلد الفرعي', { title: 'مجلد فرعي جديد', required: true, ok: 'إنشاء' });
    if (!name) return;
    const clean = name.replace(/[\/\\]/g, '-').trim();
    const { error } = await sb.from('folders').insert({ category_key: cat.key, teacher_id: teacherId, path: prefix + clean, created_by: App.user.id });
    if (error) toast(errMsg(error), 'bad'); else { toast('تم إنشاء المجلد', 'ok'); rerender(); }
  });
  view.querySelector('[data-anall]')?.addEventListener('click', async (e) => {
    const list = files.filter((f) => ['unprocessed', 'failed'].includes(f.status));
    if (!(await confirmBox(`سيتم إرسال ${list.length} ملف للقراءة والتحليل. قد يستغرق ذلك بعض الوقت.`, { ok: 'ابدئي' }))) return;
    const btn = e.currentTarget;
    btn.disabled = true;
    const r = await analyzeMany(list, (i, n) => { btn.innerHTML = `<span class="spinner sm"></span> ${i}/${n}`; });
    toast(`اكتمل: ${r.ok} ملف${r.bad ? ` — تعذر ${r.bad}` : ''}`, r.bad ? 'warn' : 'ok');
    rerender();
  });
}
