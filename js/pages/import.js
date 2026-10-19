// استيراد مجلدات كاملة: ملف ZIP أو مجلد من الجهاز، مع معاينة الشجرة قبل الاعتماد وتقرير بالنتيجة
import { App, sb, q, catOf } from '../api.js';
import { esc, icon, fmtNum, fmtSize, toast, errMsg, refreshIcons, emptyState, confirmBox, fmtDate } from '../ui.js';
import { pageHead, catIcon } from './_common.js';
import { getJSZip, extOf } from '../extract.js';
import { ALLOWED, validateFile, sha256, uploadOne, analyzeFile } from '../upload.js';

const nrm = (s) => String(s ?? '').replace(/[ًٌٍَُِّْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/^(الاستاذه|الاستاذة|استاذه|أ\.|ا\.|المعلمه)\s*/g, '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

const CAT_KEYWORDS = {
  remedial: ['علاج', 'اثرائ', 'إثرائ', 'remedial', 'enrich'],
  satisfaction: ['رضا', 'اولياء', 'استبان', 'satisf'],
  weekly: ['اسبوع', 'أسبوع', 'weekly'],
  semester: ['فصلي', 'فصليه', 'توزيع المنهج', 'semester'],
  period_tests: ['فتره', 'فترة', 'الفترات', 'period'],
  diagnostic: ['تشخيص', 'diagnos'],
  learning_styles: ['انماط', 'أنماط', 'نمط', 'learning style'],
  nafes: ['نافس', 'nafes', 'الاختبارات الوطنيه'],
  committee: ['شواهد', 'عامه', 'محاضر', 'اجتماع', 'تقارير اللجنه', 'committee'],
};
function matchCategory(name) {
  const n = nrm(name);
  for (const c of App.categories) if (n === nrm(c.title) || n.includes(nrm(c.title))) return c.key;
  for (const [k, words] of Object.entries(CAT_KEYWORDS)) if (words.some((w) => n.includes(nrm(w)))) return k;
  return null;
}
function matchTeacher(name, people) {
  const n = nrm(name);
  if (!n) return null;
  let best = null, score = 0;
  for (const p of people) {
    const pn = nrm(p.full_name);
    if (pn === n || p.username === n) return p.id;
    const toks = n.split(' ').filter((t) => t.length > 1);
    const hit = toks.filter((t) => pn.split(' ').includes(t)).length;
    const s = hit / Math.max(toks.length, 1);
    if (hit >= Math.min(2, toks.length) && s > score) { score = s; best = p.id; }
  }
  return best;
}

export default async function importPage(view) {
  const people = (await q.teachers()).filter((p) => p.is_teacher);
  let entries = []; // { path: 'a/b/c.pdf', name, size, getFile: async () => File }
  let groups = [];  // mapping groups

  view.innerHTML = `
    ${pageHead('استيراد مجلدات كاملة', 'ارفعي ملف ZIP أو اختاري مجلداً من جهازك، وسيُعرض هيكل المجلدات وتوزيعه على المعلمات قبل اعتماد الاستيراد.')}
    <div class="grid c2">
      <div class="card"><h3>${icon('file-archive')} الخيار الأول: ملف مضغوط ZIP</h3>
        <p class="muted" style="font-size:.86rem">يُفك الضغط داخل متصفحك، ولا يُرفع إلى التخزين الآمن إلا الملفات المسموحة بعد موافقتك.</p>
        <input type="file" accept=".zip,application/zip" data-zip></div>
      <div class="card"><h3>${icon('folder-up')} الخيار الثاني: مجلد من الجهاز</h3>
        <p class="muted" style="font-size:.86rem">اختاري المجلد الرئيسي الذي يحتوي المجلدات الفرعية والملفات.</p>
        <input type="file" webkitdirectory directory multiple data-dir>
        <p class="muted" data-dir-note style="font-size:.8rem"></p></div>
    </div>
    <div class="card" style="margin-top:16px">
      <h4>${icon('info')} الهيكل المتوقع</h4>
      <p class="muted" style="font-size:.86rem;margin:0">يتعرف النظام تلقائياً على: <b>اسم المجلد الرئيسي</b> (مثل "الخطط الأسبوعية") ثم <b>اسم المعلمة</b> ثم أي مجلدات فرعية (المادة/الصف/الفترة) — أو العكس (المعلمة ثم المجلد). يمكنك تصحيح أي ربط قبل الاستيراد.</p>
    </div>
    <div data-preview></div>`;

  const dirInput = view.querySelector('[data-dir]');
  if (!('webkitdirectory' in dirInput)) {
    view.querySelector('[data-dir-note]').textContent = 'متصفحك لا يدعم اختيار المجلدات. استخدمي ملف ZIP بدلاً من ذلك.';
    dirInput.disabled = true;
  }
  dirInput.addEventListener('change', () => {
    entries = [...dirInput.files].filter((f) => !/^(اقرئيني\.txt|\.DS_Store|Thumbs\.db|desktop\.ini)$/i.test(f.name)).map((f) => ({ path: f.webkitRelativePath || f.name, name: f.name, size: f.size, getFile: async () => f }));
    analyzeTree();
  });
  view.querySelector('[data-zip]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const prev = view.querySelector('[data-preview]');
    prev.innerHTML = `<div class="card" style="margin-top:16px"><span class="spinner sm"></span> جارٍ قراءة الملف المضغوط…</div>`;
    try {
      const JSZip = await getJSZip();
      const zip = await JSZip.loadAsync(file, {
        decodeFileName: (bytes) => { try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (x) { try { return new TextDecoder('windows-1256').decode(bytes); } catch (y) { return new TextDecoder().decode(bytes); } } },
      });
      entries = [];
      zip.forEach((path, zf) => {
        if (zf.dir || /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini|~\$|اقرئيني\.txt$)/i.test(path)) return;
        const name = path.split('/').pop();
        entries.push({ path, name, size: zf._data?.uncompressedSize ?? 0, getFile: async () => new File([await zf.async('blob')], name, { type: ALLOWED[extOf(name)] || '' }) });
      });
      analyzeTree();
    } catch (ex) { prev.innerHTML = `<div class="alert bad" style="margin-top:16px">${icon('circle-x')}<div>تعذر فتح الملف المضغوط: ${esc(errMsg(ex))}</div></div>`; refreshIcons(); }
  });

  function analyzeTree() {
    // إزالة المجلد الجذري المشترك
    const split = entries.map((e) => e.path.split('/').filter(Boolean));
    while (split.length && split.every((p) => p.length > 2 && p[0] === split[0][0])) split.forEach((p) => p.shift());
    entries.forEach((e, i) => { e.parts = split[i]; });
    // تحديد الترتيب: مجلد ثم معلمة، أو معلمة ثم مجلد
    const lvl1 = [...new Set(entries.map((e) => e.parts[0]))];
    const catFirst = lvl1.filter((n) => matchCategory(n)).length >= lvl1.filter((n) => matchTeacher(n, people)).length;
    const gmap = new Map();
    for (const e of entries) {
      const p = e.parts;
      let catName, teacherName, rest;
      if (p.length === 1) { catName = ''; teacherName = ''; rest = []; }
      else if (catFirst) { catName = p[0]; teacherName = p.length > 2 ? p[1] : ''; rest = p.length > 2 ? p.slice(2, -1) : []; }
      else { teacherName = p[0]; catName = p.length > 2 ? p[1] : ''; rest = p.length > 2 ? p.slice(2, -1) : []; }
      const key = catName + '|' + teacherName;
      if (!gmap.has(key)) {
        const cat = matchCategory(catName);
        const t = teacherName ? matchTeacher(teacherName, people) : null;
        gmap.set(key, { key, catName, teacherName, cat, teacher: t, files: [] });
      }
      const g = gmap.get(key);
      e.rest = rest;
      g.files.push(e);
    }
    groups = [...gmap.values()];
    groups.forEach((g) => {
      if (g.teacher === null && g.teacherName) g.unknownTeacher = true;
      if (!catOf(g.cat)?.per_teacher) g.teacher = null;
    });
    renderPreview();
  }

  function renderPreview() {
    const prev = view.querySelector('[data-preview]');
    const total = entries.length;
    const bad = entries.filter((e) => !ALLOWED[extOf(e.name)]).length;
    const folders = new Set(entries.map((e) => e.parts.slice(0, -1).join('/')).filter(Boolean)).size;
    prev.innerHTML = `<div class="card" style="margin-top:16px">
      <div class="card-head"><h3>${icon('list-tree')} معاينة الاستيراد</h3>
        <div class="row"><span class="chip">${fmtNum(folders)} مجلد</span><span class="chip">${fmtNum(total)} ملف</span>${bad ? `<span class="chip bad">${fmtNum(bad)} صيغة غير مسموحة ستُتجاهل</span>` : ''}</div></div>
      ${groups.length ? `<div class="table-wrap"><table><thead><tr><th>المجلد في الملف</th><th>يُستورد إلى</th><th>المعلمة</th><th>الملفات</th></tr></thead><tbody>
      ${groups.map((g, i) => `<tr>
        <td><div><b>${esc(g.catName || '(جذر)')}</b>${g.teacherName ? ` / ${esc(g.teacherName)}` : ''}</div></td>
        <td><select data-gcat="${i}"><option value="">— تجاهل —</option>${App.categories.map((c) => `<option value="${c.key}" ${g.cat === c.key ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select></td>
        <td>${catOf(g.cat)?.per_teacher ? `<select data-gt="${i}"><option value="">— غير محددة (تُحفظ في المجلد المشترك للمراجعة) —</option>${people.map((p) => `<option value="${p.id}" ${g.teacher === p.id ? 'selected' : ''}>${esc(p.full_name)}</option>`).join('')}</select>
          ${g.unknownTeacher && !g.teacher ? '<div class="chip warn" style="margin-top:4px">لم يُتعرف على المعلمة</div>' : ''}` : '<span class="muted">مجلد مشترك</span>'}</td>
        <td class="num">${fmtNum(g.files.length)}</td></tr>`).join('')}
      </tbody></table></div>` : emptyState('لا توجد ملفات', 'folder')}
      <details style="margin-top:12px"><summary class="muted">عرض شجرة الملفات كاملة</summary><div class="tree" style="margin-top:8px">${treeHtml(entries)}</div></details>
      <div class="divider"></div>
      <label class="check"><input type="checkbox" data-skipdup checked> تخطي الملفات المكررة (المطابقة تماماً لملفات موجودة)</label>
      <label class="check" style="margin-top:6px"><input type="checkbox" data-ai checked> قراءة الملفات وتحليلها بالذكاء الاصطناعي بعد الاستيراد</label>
      <div class="row" style="margin-top:14px"><button class="btn primary" data-go ${groups.length ? '' : 'disabled'}>${icon('check')} اعتماد الاستيراد</button></div>
      <div data-progress></div>
    </div>`;
    refreshIcons();
    prev.querySelectorAll('[data-gcat]').forEach((s) => s.addEventListener('change', () => { const g = groups[s.dataset.gcat]; g.cat = s.value || null; if (!catOf(g.cat)?.per_teacher) g.teacher = null; renderPreview(); }));
    prev.querySelectorAll('[data-gt]').forEach((s) => s.addEventListener('change', () => { groups[s.dataset.gt].teacher = s.value || null; }));
    prev.querySelector('[data-go]')?.addEventListener('click', () => runImport(prev.querySelector('[data-skipdup]').checked, prev.querySelector('[data-ai]').checked));
  }

  async function runImport(skipDup, doAI) {
    const todo = groups.filter((g) => g.cat).flatMap((g) => g.files.map((e) => ({ e, g })));
    if (!todo.length) return toast('لم يُحدد أي مجلد للاستيراد', 'warn');
    if (!(await confirmBox(`سيتم استيراد حتى ${todo.length} ملف. لن يُستبدل أي ملف موجود. متابعة؟`, { ok: 'ابدئي الاستيراد' }))) return;
    view.querySelector('[data-go]').disabled = true;
    const { data: job } = await sb.from('import_jobs').insert({ created_by: App.user.id, source: 'zip' }).select().single();
    const rep = { folders: new Set(), imported: 0, read: 0, failed_read: 0, duplicates: [], unknown_owner: [], invalid: [], errors: [], needs_review: [] };
    const prog = view.querySelector('[data-progress]');
    const imported = [];
    let i = 0;
    for (const { e, g } of todo) {
      i++;
      prog.innerHTML = `<div style="margin-top:12px"><div class="row between"><span>جارٍ الاستيراد: ${esc(e.name)}</span><span class="num">${i}/${todo.length}</span></div><div class="bar" style="margin-top:6px"><i style="width:${(100 * i) / todo.length}%"></i></div></div>`;
      try {
        const file = await e.getFile();
        const v = await validateFile(file);
        if (!v.ok) { rep.invalid.push(`${e.path} — ${v.reason}`); continue; }
        const hash = await sha256(file);
        if (skipDup) {
          const { data: d } = await sb.from('files').select('id, name').eq('sha256', hash).limit(1);
          if (d?.length) { rep.duplicates.push(`${e.path} (مطابق لـ ${d[0].name})`); continue; }
        }
        const perTeacher = catOf(g.cat).per_teacher;
        const owner = perTeacher ? g.teacher : null;
        let rest = e.rest || [];
        if (perTeacher && !owner) rep.unknown_owner.push(e.path);
        // المستوى الثاني إن لم يكن معلمة معروفة يبقى مجلداً فرعياً باسمه
        if (g.teacherName && (!perTeacher || !owner)) rest = [g.teacherName, ...rest];
        const folderPath = rest.join('/');
        if (folderPath) rep.folders.add(`${g.cat}/${owner || 'general'}/${folderPath}`);
        const row = await uploadOne({ file, category: g.cat, teacherId: owner, folderPath, hash, importJobId: job?.id });
        rep.imported++;
        imported.push({ row, file });
      } catch (ex) { rep.errors.push(`${e.path} — ${errMsg(ex)}`); }
    }
    if (doAI) {
      let k = 0;
      for (const { row, file } of imported) {
        k++;
        prog.innerHTML = `<div style="margin-top:12px"><div class="row between"><span>${icon('sparkles')} قراءة وتحليل: ${esc(row.name)}</span><span class="num">${k}/${imported.length}</span></div><div class="bar" style="margin-top:6px"><i style="width:${(100 * k) / imported.length}%"></i></div></div>`;
        refreshIcons();
        try {
          const r = await analyzeFile(row, file);
          if (r.ok) { rep.read++; if (r.status !== 'read_ok') rep.needs_review.push(row.name); }
          else { if (r.status === 'failed') rep.failed_read++; rep.needs_review.push(row.name + (r.reason ? ' — ' + r.reason : '')); }
        } catch (ex) { rep.failed_read++; rep.needs_review.push(row.name + ' — ' + errMsg(ex)); }
      }
    }
    const report = {
      folders: rep.folders.size, files_total: todo.length, imported: rep.imported, read: rep.read, failed_read: rep.failed_read,
      duplicates: rep.duplicates, unknown_owner: rep.unknown_owner, invalid: rep.invalid, errors: rep.errors, needs_review: rep.needs_review,
    };
    if (job) await sb.from('import_jobs').update({ status: 'done', finished_at: new Date().toISOString(), report }).eq('id', job.id);
    prog.innerHTML = reportHtml(report);
    refreshIcons();
    toast(`اكتمل الاستيراد: ${report.imported} ملف`, 'ok');
  }

  // آخر عمليات الاستيراد
  const { data: jobs } = await sb.from('import_jobs').select('*').order('created_at', { ascending: false }).limit(5);
  if (jobs?.length) {
    view.insertAdjacentHTML('beforeend', `<div class="card" style="margin-top:16px"><h3>${icon('history')} آخر عمليات الاستيراد</h3>
      ${jobs.map((j) => `<details><summary>${fmtDate(j.created_at, true)} — ${fmtNum(j.report?.imported ?? 0)} ملف مستورد</summary>${reportHtml(j.report || {})}</details>`).join('')}</div>`);
    refreshIcons();
  }
}

function reportHtml(r) {
  const list = (title, arr, tone) => arr?.length ? `<details style="margin-top:6px"><summary><span class="chip ${tone}">${fmtNum(arr.length)}</span> ${title}</summary><ul style="font-size:.82rem;margin:6px 0;padding-inline-start:18px">${arr.slice(0, 300).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>` : '';
  return `<div class="card" style="margin-top:12px;background:var(--surface-2)"><h4>${icon('clipboard-list')} تقرير نتيجة الاستيراد</h4>
    <div class="grid c4" style="gap:10px">
      <div><div class="muted" style="font-size:.8rem">المجلدات المستوردة</div><b class="num">${fmtNum(r.folders ?? 0)}</b></div>
      <div><div class="muted" style="font-size:.8rem">الملفات المستوردة</div><b class="num">${fmtNum(r.imported ?? 0)} / ${fmtNum(r.files_total ?? 0)}</b></div>
      <div><div class="muted" style="font-size:.8rem">قُرئت وحُللت</div><b class="num">${fmtNum(r.read ?? 0)}</b></div>
      <div><div class="muted" style="font-size:.8rem">تعذر تحليلها</div><b class="num">${fmtNum(r.failed_read ?? 0)}</b></div>
    </div>
    ${list('ملفات مكررة (لم تُستورد)', r.duplicates, 'warn')}
    ${list('ملفات لم يُحدد صاحبتها (حُفظت في المجلد المشترك)', r.unknown_owner, 'warn')}
    ${list('ملفات تحتاج إلى مراجعة يدوية', r.needs_review, 'info')}
    ${list('صيغ غير مسموحة أو ملفات تالفة', r.invalid, 'bad')}
    ${list('أخطاء أثناء الرفع', r.errors, 'bad')}
  </div>`;
}

function treeHtml(entries) {
  const root = {};
  entries.forEach((e) => { let n = root; e.parts.slice(0, -1).forEach((p) => { n = (n[p] ||= {}); }); (n.__files ||= []).push(e); });
  const walk = (n) => Object.keys(n).filter((k) => k !== '__files').sort().map((k) => `<details open><summary>${icon('folder')} ${esc(k)}</summary>${walk(n[k])}</details>`).join('')
    + (n.__files || []).map((f) => `<div class="tf">${icon('file')} ${esc(f.name)} <small class="muted">${fmtSize(f.size)}</small>${ALLOWED[extOf(f.name)] ? '' : ' <span class="chip bad">غير مسموح</span>'}</div>`).join('');
  return walk(root);
}
