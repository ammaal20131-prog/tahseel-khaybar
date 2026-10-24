// استيراد الملفات التي ترفعها المعلمات مباشرة في OneDrive إلى الموقع (تستخدمه مهمة المزامنة المجدولة)
// الخطوة 1 (في الموقع): prepareImport() — تجهز خطة فيها قائمة ملفات الموقع وروابط رفع مؤقتة، وتعيد رابطاً واحداً.
// الخطوة 2 (في صفحة OneDrive): server/import-sharepoint.js.txt — يرفع الملفات غير الموجودة في الموقع على دفعات.
// الخطوة 3 (في الموقع): ingestImport() — يضيف كل ملف لمجلد معلمته وقسمه، ثم يقرأه بالذكاء الاصطناعي.
import { App, q, sb } from './api.js';
import { buildSyncManifest } from './sync.js';
import { uploadOne, analyzeFile, sha256 } from './upload.js';

const BUNDLES = 12;
const PLAN = 'general/_sync/import-plan.json';
const norm = (s) => String(s || '').normalize('NFKC').replace(/[‎‏⁦-⁩‪-‮]/g, '').replace(/\s+/g, ' ').trim();
const clean = (s) => String(s || '').replace(/[‎‏⁦-⁩‪-‮]/g, '').replace(/[\\:*?"<>|#%]/g, '-').replace(/\s+/g, ' ').trim();

export async function prepareImport({ hours = 6 } = {}) {
  if (!App.isStaff) throw new Error('الاستيراد للمديرة واللجنة فقط');
  const man = await buildSyncManifest({ hours });
  const teachers = (await q.teachers()).filter((p) => p.is_teacher && p.active !== false).map((p) => clean(p.full_name));
  const stamp = Date.now();
  const uploads = [];
  for (let k = 0; k < BUNDLES; k++) {
    const path = `general/_import/od-${stamp}-${k}.bin`;
    const { data, error } = await sb.storage.from('files').createSignedUploadUrl(path);
    if (error) throw error;
    uploads.push({ path, url: data.signedUrl });
  }
  const plan = { created: new Date().toISOString(), manifestUrl: man.url, teachers, uploads };
  const { error } = await sb.storage.from('files').upload(PLAN, new Blob([JSON.stringify(plan)], { type: 'text/plain' }), { upsert: true, contentType: 'text/plain' });
  if (error) throw error;
  const { data: s, error: e2 } = await sb.storage.from('files').createSignedUrl(PLAN, hours * 3600);
  if (e2) throw e2;
  return { url: s.signedUrl, siteFiles: man.count };
}

function pickRequirement(reqs, catKey, teacherId, name) {
  const list = reqs.filter((r) => r.category_key === catKey && r.active && (!r.teacher_id || r.teacher_id === teacherId))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  if (catKey === 'remedial') {
    if (/إثرائ|اثرائ/.test(name)) return list.find((r) => /إثرائ/.test(r.title))?.id || list[0]?.id || null;
    if (/أثر|اثر/.test(name)) return list.find((r) => /أثر/.test(r.title))?.id || list[0]?.id || null;
    return list.find((r) => /علاج/.test(r.title))?.id || list[0]?.id || null;
  }
  return list[0]?.id || null;
}

export async function ingestImport({ read = true } = {}) {
  if (!App.isStaff) throw new Error('الاستيراد للمديرة واللجنة فقط');
  const { data: pb, error } = await sb.storage.from('files').download(PLAN);
  if (error) throw error;
  const plan = JSON.parse(await pb.text());
  const people = (await q.teachers());
  const byName = Object.fromEntries(people.map((p) => [norm(clean(p.full_name)), p]));
  const catBySort = Object.fromEntries(App.categories.filter((c) => c.per_teacher).map((c) => [String(c.sort), c]));
  const { data: reqs } = await sb.from('requirements').select('id,category_key,teacher_id,title,active,sort');
  const existing = await q.files({ limit: 10000 });
  const seen = new Set(existing.map((f) => f.sha256)); // ملف مطابق موجود في الموقع (لأي معلمة) لا يُستورد مرة ثانية
  const added = [], skipped = [], failed = [];
  const done = [];
  for (const up of plan.uploads) {
    const { data: blob } = await sb.storage.from('files').download(up.path).catch(() => ({ data: null }));
    if (!blob) continue;
    done.push(up.path);
    const buf = await blob.arrayBuffer();
    const n = new DataView(buf).getUint32(0);
    const hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, n)));
    let off = 4 + n;
    for (const [rel, len] of hdr) {
      const bytes = buf.slice(off, off + len); off += len;
      const parts = rel.split('/'); // مجلدات المعلمات/اسم المعلمة/رقم- القسم/.../الملف
      const teacher = byName[norm(parts[1])];
      const sortNo = (parts[2] || '').match(/^(\d+)/)?.[1];
      const cat = catBySort[sortNo];
      const name = parts[parts.length - 1];
      if (!teacher || !cat) { skipped.push(rel + ' (مجلد غير معروف)'); continue; }
      // بعض الصور محفوظة بامتداد غير صحيح (PNG باسم .jpg) — نصحح الامتداد حسب محتوى الملف
      const h = [...new Uint8Array(bytes.slice(0, 4))].map((x) => x.toString(16).padStart(2, '0')).join('');
      const real = h.startsWith('89504e47') ? 'png' : h.startsWith('ffd8ff') ? 'jpg' : h.startsWith('25504446') ? 'pdf' : h.startsWith('52494646') ? 'webp' : null;
      const ext = (name.match(/\.([^.]+)$/)?.[1] || '').toLowerCase();
      const fixed = real && ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext) && !(real === 'jpg' && ext === 'jpeg') && real !== ext ? name.replace(/\.[^.]+$/, '.' + real) : name;
      const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', doc: 'application/msword', xls: 'application/vnd.ms-excel', ppt: 'application/vnd.ms-powerpoint', csv: 'text/csv', txt: 'text/plain' };
      const file = new File([bytes], fixed, { type: MIME[(fixed.match(/\.([^.]+)$/)?.[1] || '').toLowerCase()] || '' });
      try {
        const hash = await sha256(file);
        if (seen.has(hash)) { skipped.push(rel + ' (موجود في الموقع)'); continue; }
        const row = await uploadOne({
          file, category: cat.key, teacherId: teacher.id, folderPath: parts.slice(3, -1).join('/'),
          requirementId: pickRequirement(reqs || [], cat.key, teacher.id, name), hash,
        });
        seen.add(hash);
        if (read) { try { await analyzeFile(row); } catch (e) { /* تُقرأ لاحقاً من صفحة الملف */ } }
        added.push(`${teacher.full_name} / ${cat.title} / ${name}`);
      } catch (e) { failed.push(`${rel}: ${e.message}`); }
    }
  }
  if (done.length) await sb.storage.from('files').remove(done);
  return { added: added.length, addedList: added, skipped: skipped.length, skippedList: skipped.slice(0, 30), failed };
}
