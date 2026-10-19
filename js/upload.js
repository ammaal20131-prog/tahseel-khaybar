// رفع الملفات والمجلدات، التحقق من النوع والحجم، كشف التكرار، وإرسالها للتحليل
import { sb, App, fn, catOf, q, downloadFileBlob } from './api.js';
import { esc, icon, modal, toast, refreshIcons, fmtSize, errMsg, fileIcon, confirmBox } from './ui.js';
import { extOf, prepareForAnalysis, needsGradeOptions } from './extract.js';
import { safeStatsForAI } from './stats.js';

export const ALLOWED = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
export const ACCEPT = Object.keys(ALLOWED).map((e) => '.' + e).join(',');

// فحص توقيع الملف (أول البايتات) للتأكد أن محتواه يطابق امتداده
async function magicOk(file, ext) {
  const b = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  if (ext === 'pdf') return hex.startsWith('25504446');
  if (['docx', 'xlsx', 'pptx'].includes(ext)) return hex.startsWith('504b0304');
  if (['doc', 'xls', 'ppt'].includes(ext)) return hex.startsWith('d0cf11e0') || hex.startsWith('504b0304') || /^(3c|ef|ff|fe)/.test(hex);
  if (['jpg', 'jpeg'].includes(ext)) return hex.startsWith('ffd8ff');
  if (ext === 'png') return hex.startsWith('89504e47');
  if (ext === 'webp') return hex.startsWith('52494646');
  if (['csv', 'txt'].includes(ext)) return !b.slice(0, 8).some((x) => x === 0);
  return false;
}

export async function validateFile(file) {
  const ext = extOf(file.name);
  const maxMb = App.settings?.max_upload_mb || 25;
  if (!ALLOWED[ext]) return { ok: false, reason: `صيغة .${ext || '؟'} غير مسموحة` };
  if (file.size === 0) return { ok: false, reason: 'الملف فارغ' };
  if (file.size > maxMb * 1024 * 1024) return { ok: false, reason: `الحجم أكبر من ${maxMb} م.ب` };
  if (!(await magicOk(file, ext))) return { ok: false, reason: 'محتوى الملف لا يطابق امتداده (قد يكون تالفاً)' };
  return { ok: true, ext, mime: ALLOWED[ext] };
}

export async function sha256(file) {
  const buf = await file.arrayBuffer();
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }));
const knownFolders = new Set();
const cleanPath = (p) => String(p || '').split('/').map((s) => s.trim()).filter(Boolean).join('/');

// رفع ملف واحد وإنشاء سجله
export async function uploadOne({ file, category, teacherId, folderPath = '', requirementId = null, semester = null, importJobId = null, hash = null, subjectId = null, gradeId = null }) {
  const v = await validateFile(file);
  if (!v.ok) throw new Error(v.reason);
  const id = uuid();
  const owner = teacherId || 'general';
  const storagePath = `${owner}/${category}/${id}.${v.ext}`;
  const { error: upErr } = await sb.storage.from('files').upload(storagePath, file, { contentType: v.mime, upsert: false, cacheControl: '3600' });
  if (upErr) throw upErr;
  const row = {
    id, teacher_id: teacherId || null, category_key: category, folder_path: cleanPath(folderPath),
    requirement_id: requirementId || null, name: file.name, storage_path: storagePath, mime_type: v.mime, ext: v.ext,
    size_bytes: file.size, sha256: hash || await sha256(file), semester: semester || App.settings?.semester || null,
    uploaded_by: App.user.id, import_job_id: importJobId, subject_id: subjectId, grade_id: gradeId,
  };
  const { data, error } = await sb.from('files').insert(row).select().single();
  if (error) {
    await sb.storage.from('files').remove([storagePath]);
    throw error;
  }
  if (folderPath) {
    // إنشاء سجلات المجلدات الفرعية (لكل مستوى من المسار)
    const parts = cleanPath(folderPath).split('/');
    for (let i = 0; i < parts.length; i++) {
      const key = `${category}|${teacherId || ''}|${parts.slice(0, i + 1).join('/')}`;
      if (knownFolders.has(key)) continue;
      knownFolders.add(key);
      // التكرار متوقع (المجلد موجود مسبقاً) ويُتجاهل
      await sb.from('folders').insert({ category_key: category, teacher_id: teacherId || null, path: parts.slice(0, i + 1).join('/'), created_by: App.user.id }).then(() => {}, () => {});
    }
  }
  return data;
}

// تحليل ملف (يستخرج محتوى Word/Excel محلياً ثم يرسل للخادم)
export async function analyzeFile(fileRow, localFile = null, gradeOpts = {}) {
  let f = localFile;
  const ext = fileRow.ext || extOf(fileRow.name);
  if (!f && ['docx', 'txt', 'xlsx', 'xls', 'csv'].includes(ext)) {
    const blob = await downloadFileBlob(fileRow.storage_path);
    f = new File([blob], fileRow.name, { type: fileRow.mime_type || '' });
  }
  let payload = { action: 'analyze', file_id: fileRow.id };
  if (f) {
    const prep = await prepareForAnalysis(f, fileRow.category_key, gradeOpts);
    const cat = catOf(fileRow.category_key);
    if (prep.text !== undefined) payload.text = prep.text;
    if (prep.stats) payload.stats = safeStatsForAI(prep.stats, { includeComments: !!App.settings?.ai_send_student_files || !cat.student_data });
  }
  return await fn('ai', payload);
}

// ---------------- نافذة الرفع ----------------
// opts: { category, teacherId, folderPath, requirementId, replace (fileRow), onDone }
export function openUploadDialog(opts) {
  const cat = catOf(opts.category);
  const isFolderAllowed = !opts.replace;
  const queue = []; // { file, rel, status, el }
  let reqs = [];

  const m = modal({
    title: opts.replace ? `استبدال: ${opts.replace.name}` : `رفع ملفات — ${cat.title}`,
    wide: true,
    body: `
      ${opts.replace ? `<div class="alert warn">${icon('triangle-alert')}<div>سيُرفع الملف الجديد ويحل محل الملف الحالي بعد نجاح الرفع، وسيُحذف الملف القديم.</div></div><div class="divider"></div>` : ''}
      <div class="form-grid">
        <label class="field">المتطلب المرتبط <span class="hint">يحدد ما يُحسب ضمن نسبة الإنجاز</span>
          <select data-req><option value="">— بدون متطلب محدد —</option></select></label>
        <label class="field">الفصل الدراسي
          <input data-sem value="${esc(App.settings?.semester || '')}"></label>
        <label class="field">المادة <select data-subj><option value="">— غير محددة —</option>${App.subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>
        <label class="field">الصف <select data-grade><option value="">— غير محدد —</option>${App.grades.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>
        ${opts.folderPath ? `<div class="full muted">سيُحفظ داخل: <b>${esc(opts.folderPath)}</b></div>` : ''}
      </div>
      <div class="card" data-grade-opts hidden style="margin-top:14px;background:var(--surface-2)">
        <h4>${icon('calculator')} إعدادات تحليل الدرجات</h4>
        <p class="muted" style="font-size:.84rem">تُحسب الإحصاءات من الكشف نفسه داخل المتصفح. إن كانت الدرجة العظمى مكتوبة في عنوان العمود (مثل "الاختبار من 20") فستُكتشف تلقائياً.</p>
        <div class="form-grid">
          <label class="field">الدرجة العظمى للمجموع <span class="hint">اختياري إن كانت في الكشف</span><input type="number" min="1" data-max></label>
          <label class="field">الدرجة العظمى لكل مهارة/عمود <span class="hint">للاختبار التشخيصي</span><input type="number" min="1" data-maxcol></label>
          <label class="field">نسبة النجاح ٪<input type="number" min="1" max="100" value="50" data-pass></label>
          <label class="field">معيار الإتقان ٪ <span class="hint">اتركيه فارغاً إن لم يكن معتمداً</span><input type="number" min="1" max="100" data-mastery placeholder="مثال: 80"></label>
        </div>
      </div>
      <div class="dropzone" data-drop style="margin-top:14px">
        ${icon('upload-cloud')}
        <div style="font-weight:600;color:var(--ink);margin-top:6px">اسحبي الملفات هنا أو اضغطي للاختيار</div>
        <div style="font-size:.8rem;margin-top:4px">PDF، Word، Excel، CSV، صور JPG/PNG — حتى ${App.settings?.max_upload_mb || 25} م.ب للملف</div>
      </div>
      <input type="file" data-input ${opts.replace ? '' : 'multiple'} accept="${ACCEPT}" hidden>
      <input type="file" data-dir webkitdirectory directory multiple hidden>
      ${isFolderAllowed ? `<div class="row" style="margin-top:10px"><button class="btn sm" data-pick-dir>${icon('folder-up')} رفع مجلد كامل</button><span class="muted" style="font-size:.8rem" data-dir-note></span></div>` : ''}
      <div class="up-list" data-list></div>
      <label class="check" style="margin-top:12px"><input type="checkbox" data-ai checked> قراءة الملفات وتحليلها بالذكاء الاصطناعي بعد الرفع</label>
    `,
    footer: `<button class="btn primary" data-go disabled>${icon('upload')} رفع</button><button class="btn ghost" data-close>إغلاق</button>`,
  });

  const $ = m.$;
  const reqSel = $('[data-req]');
  q.requirements().then((rs) => {
    reqs = rs.filter((r) => r.active && r.category_key === opts.category && (!r.teacher_id || r.teacher_id === opts.teacherId));
    reqSel.innerHTML += reqs.map((r) => `<option value="${r.id}">${esc(r.title)}${r.due_date ? ' — حتى ' + esc(r.due_date) : ''}</option>`).join('');
    const pre = opts.requirementId || opts.replace?.requirement_id;
    if (pre) reqSel.value = pre;
    else if (reqs.length === 1) reqSel.value = reqs[0].id;
  }).catch(() => {});
  if (opts.replace) {
    if (opts.replace.subject_id) $('[data-subj]').value = opts.replace.subject_id;
    if (opts.replace.grade_id) $('[data-grade]').value = opts.replace.grade_id;
    if (opts.replace.semester) $('[data-sem]').value = opts.replace.semester;
  }
  if (!App.ai?.ai_ready) {
    const c = $('[data-ai]'); c.checked = true;
    c.parentElement.insertAdjacentHTML('afterend', `<div class="muted" style="font-size:.8rem;margin-top:4px">${icon('info')} التحليل الذكي غير مفعل حالياً؛ ستُحفظ الملفات وتُحسب الإحصاءات المتاحة وتُحوَّل للمراجعة البشرية.</div>`);
  }

  if (!isFolderAllowed) $('[data-dir]')?.remove();
  else {
    const dirInput = $('[data-dir]');
    if (!('webkitdirectory' in dirInput)) $('[data-dir-note]').textContent = 'متصفحك لا يدعم اختيار المجلدات؛ استخدمي ملف ZIP من صفحة الاستيراد.';
    $('[data-pick-dir]').addEventListener('click', () => dirInput.click());
    dirInput.addEventListener('change', () => addFiles([...dirInput.files], true));
  }

  const input = $('[data-input]');
  const drop = $('[data-drop]');
  drop.addEventListener('click', () => input.click());
  input.addEventListener('change', () => addFiles([...input.files]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', async (e) => {
    e.preventDefault(); drop.classList.remove('over');
    const items = [...(e.dataTransfer.items || [])];
    const entries = items.map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
    if (entries.some((en) => en.isDirectory) && isFolderAllowed) {
      const files = [];
      await Promise.all(entries.map((en) => walkEntry(en, '', files)));
      addFiles(files, true);
    } else addFiles([...e.dataTransfer.files]);
  });

  async function addFiles(files, withRel = false) {
    if (opts.replace) { queue.length = 0; $('[data-list]').innerHTML = ''; files = files.slice(0, 1); }
    for (const f of files) {
      if (/^(\.|~\$|thumbs\.db|desktop\.ini)/i.test(f.name)) continue;
      const rel = withRel ? (f._rel ?? f.webkitRelativePath ?? '').split('/').slice(0, -1).join('/') : '';
      const v = await validateFile(f);
      const item = { file: f, rel, v, status: v.ok ? 'ready' : 'invalid' };
      item.el = document.createElement('div');
      item.el.className = 'up-item';
      queue.push(item);
      $('[data-list]').appendChild(item.el);
      paint(item, v.ok ? 'جاهز للرفع' : v.reason);
    }
    $('[data-go]').disabled = !queue.some((i) => i.status === 'ready');
    const showGrade = queue.some((i) => i.v.ok && needsGradeOptions(opts.category, i.v.ext));
    $('[data-grade-opts]').hidden = !showGrade;
  }

  function paint(item, msg, pct = null) {
    const cls = { ready: '', invalid: 'bad', uploading: 'info', uploaded: 'ok', analyzing: 'violet', done: 'ok', error: 'bad', dup: 'warn', skipped: '' }[item.status] || '';
    item.el.innerHTML = `${icon(fileIcon(item.file.name))}
      <div style="min-width:0"><div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.file.name)}</div>
      <div class="muted" style="font-size:.76rem">${item.rel ? esc(item.rel) + ' · ' : ''}${fmtSize(item.file.size)}</div></div>
      <span class="chip ${cls}">${esc(msg)}</span>
      ${pct !== null ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ''}`;
    refreshIcons();
  }

  $('[data-go]').addEventListener('click', async () => {
    const go = $('[data-go]');
    go.disabled = true;
    const requirementId = reqSel.value || null;
    const semester = $('[data-sem]').value.trim() || null;
    const subjectId = Number($('[data-subj]').value) || null;
    const gradeId = Number($('[data-grade]').value) || null;
    const doAI = $('[data-ai]').checked;
    const gradeOpts = {
      maxScore: Number($('[data-max]').value) || undefined,
      maxPerColumn: Number($('[data-maxcol]').value) || undefined,
      passPct: Number($('[data-pass]').value) || 50,
      masteryPct: Number($('[data-mastery]').value) || null,
    };
    const ready = queue.filter((i) => i.status === 'ready');

    // كشف التكرار
    for (const it of ready) it.hash = await sha256(it.file);
    const hashes = ready.map((i) => i.hash);
    let dupRows = [];
    if (hashes.length) {
      const { data } = await sb.from('files').select('id, name, sha256, teacher_id').in('sha256', hashes);
      dupRows = (data || []).filter((d) => (d.teacher_id || null) === (opts.teacherId || null) && d.id !== opts.replace?.id);
    }
    if (dupRows.length) {
      const names = dupRows.map((d) => d.name).slice(0, 5).join('، ');
      const keep = await confirmBox(`يوجد ${dupRows.length} ملف مطابق تماماً لملفات مرفوعة سابقاً (${names}). هل تريدين رفع النسخ المكررة أيضاً؟`, { ok: 'رفع المكرر', title: 'ملفات مكررة' });
      if (!keep) ready.forEach((it) => { if (dupRows.some((d) => d.sha256 === it.hash)) { it.status = 'dup'; paint(it, 'تُخطي (مكرر)'); } });
    }

    const uploaded = [];
    for (const it of queue.filter((i) => i.status === 'ready')) {
      it.status = 'uploading'; paint(it, 'جارٍ الرفع…', 40);
      try {
        const base = opts.folderPath || '';
        const folderPath = [base, it.rel].filter(Boolean).join('/');
        it.row = await uploadOne({ file: it.file, category: opts.category, teacherId: opts.teacherId, folderPath, requirementId, semester, hash: it.hash, subjectId, gradeId });
        it.status = 'uploaded'; paint(it, 'تم الرفع', 100);
        uploaded.push(it);
      } catch (e) {
        it.status = 'error'; paint(it, 'فشل: ' + errMsg(e));
      }
    }

    if (opts.replace && uploaded.length) {
      try {
        await sb.from('files').delete().eq('id', opts.replace.id);
        await sb.storage.from('files').remove([opts.replace.storage_path]);
      } catch (e) { toast('رُفع الملف الجديد لكن تعذر حذف القديم: ' + errMsg(e), 'warn'); }
    }

    if (doAI) {
      for (const it of uploaded) {
        it.status = 'analyzing'; paint(it, 'قيد القراءة والتحليل…', 70);
        try {
          const r = await analyzeFile(it.row, it.file, gradeOpts);
          it.status = 'done';
          paint(it, r.ok ? (r.status === 'read_ok' ? 'تمت القراءة بنجاح' : 'يحتاج إلى مراجعة') : (r.status === 'failed' ? 'تعذرت القراءة' : 'بانتظار المراجعة'), 100);
        } catch (e) {
          it.status = 'error'; paint(it, 'تعذر التحليل: ' + errMsg(e));
        }
      }
    }
    const okN = uploaded.length, badN = queue.filter((i) => i.status === 'error' || i.status === 'invalid').length;
    toast(`تم رفع ${okN} ملف${badN ? ` — ${badN} لم يُرفع` : ''}`, badN ? 'warn' : 'ok');
    go.textContent = 'تم';
    opts.onDone?.(uploaded.map((u) => u.row));
  });

  return m;
}

// قراءة مجلد مسحوب داخل المتصفح
function walkEntry(entry, path, out) {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((f) => { f._rel = path + f.name; out.push(f); resolve(); }, () => resolve());
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const all = [];
      const readBatch = () => reader.readEntries(async (ents) => {
        if (!ents.length) { await Promise.all(all.map((e) => walkEntry(e, path + entry.name + '/', out))); resolve(); }
        else { all.push(...ents); readBatch(); }
      }, () => resolve());
      readBatch();
    } else resolve();
  });
}

// إعادة تحليل ملفات موجودة على دفعات
export async function analyzeMany(rows, onStep) {
  let ok = 0, bad = 0;
  for (const [i, r] of rows.entries()) {
    try { await analyzeFile(r); ok++; } catch (e) { bad++; }
    onStep?.(i + 1, rows.length);
  }
  return { ok, bad };
}
