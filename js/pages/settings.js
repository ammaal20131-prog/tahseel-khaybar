// إعدادات الموقع (للمديرة ورئيسة اللجنة)
import { App, sb, q, fn, loadPublicSettings, downloadFileBlob } from '../api.js';
import { esc, icon, toast, withBusy, errMsg, confirmBox, promptBox, refreshIcons, downloadBlob, fmtNum } from '../ui.js';
import { pageHead } from './_common.js';
import { getJSZip } from '../extract.js';
import { rerender } from '../main.js';

export default async function settings(view) {
  const s = await loadPublicSettings();
  let ai = App.ai;
  try { ai = await fn('ai', { action: 'config' }); App.ai = ai; } catch (e) { /* ignore */ }
  const members = Array.isArray(s.committee_members) ? s.committee_members : [];

  view.innerHTML = `
    ${pageHead('إعدادات الموقع', 'الترويسة الرسمية، الشعار، العام الدراسي، الذكاء الاصطناعي، والقوائم المرجعية.')}
    <div class="grid c2">
      <form class="card" data-gen style="display:grid;gap:12px">
        <h3>${icon('landmark')} الترويسة الرسمية</h3>
        <div class="form-grid">
          <label class="field full">عنوان الموقع<input name="site_title" value="${esc(s.site_title)}"></label>
          <label class="field">اسم المدرسة<input name="school_name" value="${esc(s.school_name)}"></label>
          <label class="field">اسم اللجنة<input name="committee_name" value="${esc(s.committee_name)}"></label>
          <label class="field">العام الدراسي<input name="academic_year" value="${esc(s.academic_year)}"></label>
          <label class="field">الفصل الدراسي الحالي<input name="semester" value="${esc(s.semester)}"></label>
          <label class="field">مديرة المدرسة<input name="principal_name" value="${esc(s.principal_name)}"></label>
          <label class="field">إعداد وتصميم<input name="designer_name" value="${esc(s.designer_name)}"></label>
          <label class="field full">الإدارة التعليمية<input name="directorate" value="${esc(s.directorate)}"></label>
          <label class="field full">عضوات اللجنة <span class="hint">اسم في كل سطر — تظهر في الترويسة وصفحة الدخول</span><textarea name="members" rows="4">${esc(members.join('\n'))}</textarea></label>
          <label class="field">الحد الأقصى لحجم الملف (م.ب)<input name="max_upload_mb" type="number" min="1" max="50" value="${esc(s.max_upload_mb)}"></label>
        </div>
        <button class="btn primary">${icon('save')} حفظ</button>
      </form>
      <div class="stack">
        <div class="card">
          <h3>${icon('image')} شعار وزارة التعليم</h3>
          <div class="row" style="gap:16px">
            <div style="background:var(--head);padding:12px;border-radius:12px"><img src="${esc(s.logo_path ? App.logoUrl : 'assets/moe-logo-white.png')}" alt="الشعار" style="width:110px;display:block"></div>
            <div class="muted" style="font-size:.84rem;flex:1">الشعار الحالي ${s.logo_path ? 'مرفوع من الإعدادات' : 'مأخوذ من ترويسة ملف المدرسة'}. استخدمي النسخة الرسمية المعتمدة من الوزارة (PNG بخلفية شفافة يفضّل باللون الأبيض).</div>
          </div>
          <div class="row" style="margin-top:10px"><input type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" data-logo style="flex:1">
          ${s.logo_path ? `<button class="btn sm ghost danger" data-logo-rm>${icon('trash-2')} استعادة الافتراضي</button>` : ''}</div>
        </div>
        <div class="card ai-box">
          <h3>${icon('sparkles')} الذكاء الاصطناعي والخصوصية</h3>
          <div class="alert ${ai?.has_key ? 'ok' : 'warn'}" style="margin-bottom:10px">${icon(ai?.has_key ? 'circle-check' : 'triangle-alert')}<div>${ai?.has_key ? `مفتاح Claude API مضاف على الخادم (النموذج: <span dir="ltr">${esc(ai.model || '')}</span>).` : 'لم يُضف مفتاح Claude API على الخادم بعد. ستُحفظ الملفات وتُحسب الإحصاءات، لكن لن تُقرأ بالذكاء الاصطناعي. راجعي دليل النشر.'}</div></div>
          <label class="check"><input type="checkbox" data-ai-on ${s.ai_enabled ? 'checked' : ''}> تفعيل القراءة والتحليل بالذكاء الاصطناعي</label>
          <label class="check" style="margin-top:8px;align-items:flex-start"><input type="checkbox" data-ai-student ${s.ai_send_student_files ? 'checked' : ''} style="margin-top:5px">
            <span>السماح بإرسال ملفات PDF والصور التي قد تحتوي أسماء طالبات (كشوف الدرجات، الاستبانات) إلى خدمة الذكاء الاصطناعي.<br><small class="muted">موقوف افتراضياً. عند إيقافه تُحلَّل كشوف Excel/CSV داخل المتصفح ويُرسل للذكاء الاصطناعي الأرقام المجمعة فقط بلا أسماء. فعّليه فقط إن كان متوافقاً مع الضوابط المعتمدة لديكم.</small></span></label>
        </div>
        <div class="card">
          <h3>${icon('database-backup')} النسخ الاحتياطي</h3>
          <p class="muted" style="font-size:.84rem">تنزيل نسخة من البيانات (المعلمات، المتطلبات، الملفات وحالاتها، التحليلات، الملاحظات، السجل) بصيغة JSON، ونسخة من كل الملفات المرفوعة في ملف ZIP.</p>
          <div class="row"><button class="btn" data-bk-json>${icon('file-json')} تنزيل البيانات</button><button class="btn" data-bk-zip>${icon('file-archive')} تنزيل كل الملفات (ZIP)</button></div>
          <div data-bk-prog class="muted" style="font-size:.84rem;margin-top:8px"></div>
        </div>
      </div>
    </div>
    <div class="grid c2" style="margin-top:16px">
      ${listCard('subjects', 'المواد الدراسية', 'book-marked', App.subjects)}
      ${listCard('grades', 'الصفوف', 'graduation-cap', App.grades)}
    </div>`;
  refreshIcons();

  const form = view.querySelector('[data-gen]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await withBusy(form.querySelector('button'), async () => {
      const patch = {};
      ['site_title', 'school_name', 'committee_name', 'academic_year', 'semester', 'principal_name', 'designer_name', 'directorate'].forEach((k) => (patch[k] = form[k].value.trim()));
      patch.max_upload_mb = Math.min(50, Math.max(1, Number(form.max_upload_mb.value) || 25));
      patch.committee_members = form.members.value.split('\n').map((x) => x.trim()).filter(Boolean);
      patch.updated_at = new Date().toISOString();
      const { error } = await sb.from('settings').update(patch).eq('id', 1);
      if (error) toast(errMsg(error), 'bad'); else { toast('تم حفظ الإعدادات', 'ok'); await loadPublicSettings(); location.reload(); }
    });
  });
  const setFlag = async (k, v) => { const { error } = await sb.from('settings').update({ [k]: v }).eq('id', 1); if (error) toast(errMsg(error), 'bad'); else { toast('تم الحفظ', 'ok'); App.settings[k] = v; } };
  view.querySelector('[data-ai-on]').addEventListener('change', (e) => setFlag('ai_enabled', e.target.checked));
  view.querySelector('[data-ai-student]').addEventListener('change', async (e) => {
    if (e.target.checked && !(await confirmBox('تفعيل هذا الخيار يعني إرسال ملفات قد تحتوي أسماء ودرجات طالبات إلى خدمة ذكاء اصطناعي خارجية. هل هذا متوافق مع الضوابط المعتمدة؟', { ok: 'نعم، فعّلي', danger: true }))) { e.target.checked = false; return; }
    setFlag('ai_send_student_files', e.target.checked);
  });
  view.querySelector('[data-logo]').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 2 * 1024 * 1024) return toast('الحد 2 م.ب', 'warn');
    const path = `logo-${Date.now()}.${f.name.split('.').pop().toLowerCase()}`;
    const { error } = await sb.storage.from('branding').upload(path, f, { contentType: f.type, upsert: true });
    if (error) return toast(errMsg(error), 'bad');
    await setFlag('logo_path', path); location.reload();
  });
  view.querySelector('[data-logo-rm]')?.addEventListener('click', async () => { await setFlag('logo_path', null); location.reload(); });

  view.querySelectorAll('[data-add-item]').forEach((b) => b.addEventListener('click', async () => {
    const t = b.dataset.addItem;
    const name = await promptBox(t === 'subjects' ? 'اسم المادة' : 'اسم الصف', { required: true, ok: 'إضافة' });
    if (!name) return;
    const row = t === 'grades' ? { name, sort: App.grades.length + 1 } : { name };
    const { error } = await sb.from(t).insert(row);
    if (error) toast(errMsg(error), 'bad'); else { toast('تمت الإضافة', 'ok'); location.reload(); }
  }));
  view.querySelectorAll('[data-del-item]').forEach((b) => b.addEventListener('click', async () => {
    const [t, id] = b.dataset.delItem.split(':');
    if (!(await confirmBox('حذف هذا العنصر؟ سيُزال من الملفات المرتبطة به ومن إسناد المعلمات.', { ok: 'حذف', danger: true }))) return;
    const { error } = await sb.from(t).delete().eq('id', id);
    if (error) toast(errMsg(error), 'bad'); else location.reload();
  }));

  const prog = view.querySelector('[data-bk-prog]');
  view.querySelector('[data-bk-json]').addEventListener('click', async (e) => {
    await withBusy(e.currentTarget, async () => {
      const out = { exported_at: new Date().toISOString(), school: s.school_name };
      for (const t of ['settings', 'profiles', 'subjects', 'grades', 'teacher_assignments', 'categories', 'folders', 'requirements', 'files', 'file_analyses', 'file_notes', 'reports', 'import_jobs', 'audit_log']) {
        const all = []; let from = 0;
        for (;;) { const { data, error } = await sb.from(t).select('*').range(from, from + 999); if (error) { out[t + '_error'] = error.message; break; } all.push(...data); if (data.length < 1000) break; from += 1000; }
        out[t] = all;
      }
      downloadBlob(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }), `نسخة-احتياطية-${new Date().toISOString().slice(0, 10)}.json`);
    });
  });
  view.querySelector('[data-bk-zip]').addEventListener('click', async (e) => {
    const files = await q.files({ limit: 10000 });
    const total = files.reduce((a, f) => a + (f.size_bytes || 0), 0);
    if (!(await confirmBox(`سيتم تنزيل ${fmtNum(files.length)} ملف (حوالي ${(total / 1048576).toFixed(0)} م.ب) وتجميعها داخل المتصفح. قد يستغرق ذلك وقتاً.`, { ok: 'ابدئي' }))) return;
    await withBusy(e.currentTarget, async () => {
      const JSZip = await getJSZip();
      const zip = new JSZip();
      const people = Object.fromEntries((await q.teachers()).map((p) => [p.id, p.full_name]));
      const cats = Object.fromEntries(App.categories.map((c) => [c.key, c.title]));
      let i = 0;
      for (const f of files) {
        i++; prog.textContent = `${i} / ${files.length}: ${f.name}`;
        try {
          const blob = await downloadFileBlob(f.storage_path);
          const dir = [cats[f.category_key] || f.category_key, f.teacher_id ? (people[f.teacher_id] || f.teacher_id) : 'مشترك', f.folder_path].filter(Boolean).join('/');
          zip.file(`${dir}/${f.id.slice(0, 8)}-${f.name}`, blob);
        } catch (ex) { /* skip */ }
      }
      prog.textContent = 'جارٍ الضغط…';
      const out = await zip.generateAsync({ type: 'blob' });
      downloadBlob(out, `ملفات-لجنة-التحصيل-${new Date().toISOString().slice(0, 10)}.zip`);
      prog.textContent = 'اكتمل التنزيل';
    });
  });
}

function listCard(table, title, ic, rows) {
  return `<div class="card"><div class="card-head"><h3>${icon(ic)} ${title}</h3><button class="btn sm" data-add-item="${table}">${icon('plus')} إضافة</button></div>
    <div class="list">${rows.map((r) => `<div class="list-item"><div class="li-main"><div class="li-t">${esc(r.name)}</div></div><button class="btn sm ghost" data-del-item="${table}:${r.id}" aria-label="حذف">${icon('x')}</button></div>`).join('')}</div></div>`;
}
