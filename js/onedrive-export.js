// تصدير ملفات الموقع بنفس ترتيب مجلدات OneDrive (ملف ZIP يُفك داخل مجلد OneDrive فيتحدث كله)
import { App, q, downloadFileBlob } from './api.js';
import { esc, icon, modal, toast, errMsg, fmtNum, downloadBlob, refreshIcons } from './ui.js';
import { getJSZip } from './extract.js';

const LAST_KEY = 'tahseel-onedrive-last-export';
const getLast = () => { try { return localStorage.getItem(LAST_KEY); } catch (e) { return null; } };
const setLast = (v) => { try { localStorage.setItem(LAST_KEY, v); } catch (e) { /* ignore */ } };
const clean = (s) => String(s || '').replace(/[\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();

export function openOneDriveExport() {
  const last = getLast();
  const m = modal({
    title: 'تصدير بترتيب مجلدات OneDrive',
    body: `<p style="font-size:.9rem">يُنزَّل ملف ZIP مرتب بنفس مجلدات OneDrive: <b>مجلدات المعلمات ← اسم المعلمة ← القسم</b>، و<b>مجلدات اللجنة المشتركة</b>.</p>
      <div style="display:grid;gap:8px;margin:10px 0">
        <label class="check"><input type="radio" name="scope" value="new" ${last ? 'checked' : 'disabled'}> الملفات الجديدة فقط منذ آخر تصدير ${last ? `<span class="muted">(${new Date(last).toLocaleString('ar-SA-u-nu-latn')})</span>` : '<span class="muted">(لا يوجد تصدير سابق من هذا الجهاز)</span>'}</label>
        <label class="check"><input type="radio" name="scope" value="all" ${last ? '' : 'checked'}> كل الملفات</label>
        <label class="check"><input type="checkbox" name="approved"> الملفات المعتمدة فقط</label>
      </div>
      <div class="alert" style="font-size:.84rem">${icon('info')}<div><b>بعد التنزيل:</b> افتحي ملف ZIP، وانسخي مجلد «ملف لجنة التحصيل الدراسي» إلى داخل OneDrive في اللاب توب (فوق المجلد الموجود). عند السؤال اختاري «استبدال» أو «تخطي». يتزامن OneDrive تلقائياً.</div></div>
      <div data-prog class="muted" style="font-size:.84rem;margin-top:8px"></div>`,
    footer: `<button class="btn primary" data-go>${icon('download')} تنزيل</button><button class="btn ghost" data-close>إغلاق</button>`,
  });
  refreshIcons();
  m.$('[data-go]').addEventListener('click', async (e) => {
    const btn = e.currentTarget; btn.disabled = true;
    const prog = m.$('[data-prog]');
    try {
      const scope = m.$('input[name=scope]:checked').value;
      const onlyApproved = m.$('input[name=approved]').checked;
      let files = await q.files({ limit: 10000 });
      if (scope === 'new' && last) files = files.filter((f) => (f.updated_at || f.created_at) > last);
      if (onlyApproved) files = files.filter((f) => f.status === 'approved');
      if (!files.length) { prog.textContent = 'لا توجد ملفات جديدة للتصدير.'; btn.disabled = false; return; }
      const startedAt = new Date().toISOString();
      const people = Object.fromEntries((await q.teachers()).map((p) => [p.id, p.full_name]));
      const cats = Object.fromEntries(App.categories.map((c) => [c.key, c]));
      const root = clean(`ملف لجنة التحصيل الدراسي ${App.settings?.academic_year?.replace(/هـ$/, '') || ''}`);
      const JSZip = await getJSZip();
      const zip = new JSZip();
      const used = new Set();
      let ok = 0, fail = 0, i = 0;
      for (const f of files) {
        i++; prog.textContent = `${fmtNum(i)} / ${fmtNum(files.length)}: ${f.name}`;
        const c = cats[f.category_key] || { title: f.category_key, sort: 99, per_teacher: false };
        const catDir = clean(`${c.sort}- ${c.title}`);
        const base = f.teacher_id && c.per_teacher
          ? `${root}/مجلدات المعلمات/${clean(people[f.teacher_id] || 'معلمة')}/${catDir}`
          : `${root}/مجلدات اللجنة المشتركة/${catDir}${f.teacher_id ? '/' + clean(people[f.teacher_id] || '') : ''}`;
        const dir = [base, ...String(f.folder_path || '').split('/').map(clean).filter(Boolean)].join('/');
        let name = clean(f.name) || f.id;
        let path = `${dir}/${name}`;
        for (let k = 2; used.has(path); k++) path = `${dir}/${name.replace(/(\.[^.]+)?$/, ` (${k})$1`)}`;
        used.add(path);
        try { zip.file(path, await downloadFileBlob(f.storage_path)); ok++; } catch (ex) { fail++; }
      }
      prog.textContent = 'جارٍ تجهيز ملف ZIP…';
      const out = await zip.generateAsync({ type: 'blob' });
      downloadBlob(out, `OneDrive-${root}-${startedAt.slice(0, 10)}.zip`);
      setLast(startedAt);
      prog.innerHTML = `اكتمل: ${fmtNum(ok)} ملف${fail ? ` — تعذر تنزيل ${fmtNum(fail)}` : ''}. انسخي محتواه إلى OneDrive.`;
      toast('تم تجهيز ملف التصدير', 'ok');
    } catch (ex) { toast(errMsg(ex), 'bad', 7000); prog.textContent = ''; }
    btn.disabled = false;
  });
}
