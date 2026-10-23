// إنشاء حسابات منسوبات المدرسة دفعة واحدة (للمديرة ورئيسة اللجنة)
import { App, fn } from '../api.js';
import { esc, icon, toast, modal, errMsg, ROLES, downloadBlob, refreshIcons } from '../ui.js';
import { getXLSX } from '../extract.js';
import { rerender } from '../main.js';

// [اسم المستخدم، الاسم، الصلاحية، تُطلب منها ملفات؟، [[المادة، الصفوف]]]
const ALL = [1, 2, 3];
const ROSTER = [
  ['zahra', 'الأستاذة زهراء الشهراني', 'principal', false, []],
  ['noha', 'الأستاذة نهى الزهراني', 'committee', true, [['العلوم', [1]], ['التربية البدنية', [1]]]],
  ['aisha', 'الأستاذة عائشة عمير الشهراني', 'committee', true, [['العلوم', [2, 3]]]],
  ['haya', 'الأستاذة هيا الشهراني', 'committee', true, [['العلوم', [2]], ['التربية البدنية', [2]]]],
  ['salma', 'الأستاذة سلمى فلاح', 'teacher', true, [['اللغة العربية', ALL]]],
  ['fatima', 'الأستاذة فاطمة عون', 'teacher', true, [['اللغة العربية', ALL]]],
  ['ghazwa', 'الأستاذة غزوا العتيبي', 'teacher', true, [['العلوم', [3]], ['التربية الأسرية', [3]]]],
  ['munira', 'الأستاذة منيرة الشهراني', 'teacher', true, [['التربية الأسرية', [1, 2]]]],
  ['zahrah', 'الأستاذة زهرة الشهراني', 'teacher', true, [['الدراسات الاجتماعية', ALL]]],
  ['ahlam', 'الأستاذة أحلام الشهراني', 'teacher', true, [['التربية الفنية', [1]], ['المهارات الرقمية', [3]]]],
  ['saraobaid', 'الأستاذة سارة عبيد الشهراني', 'teacher', true, [['الدراسات الإسلامية', ALL]]],
  ['hayaali', 'الأستاذة هيا علي الشهراني', 'teacher', true, [['الدراسات الإسلامية', ALL]]],
  ['sarahashmi', 'الأستاذة سارة الهاشمي', 'teacher', true, [['الدراسات الإسلامية', ALL]]],
  ['najwa', 'الأستاذة نجوى آل معشي', 'teacher', true, [['الرياضيات', [3]]]],
  ['noura', 'الأستاذة نورة الشهراني', 'teacher', true, [['الرياضيات', [2]]]],
  ['muzna', 'الأستاذة مزنة الشهراني', 'teacher', true, [['الرياضيات', [1]]]],
  ['wafaa', 'الأستاذة وفاء الشهراني', 'teacher', true, [['اللغة الإنجليزية', [2]], ['التربية الفنية', [2]]]],
  ['thamra', 'الأستاذة ثمراء الشهراني', 'teacher', true, [['اللغة الإنجليزية', [3]]]],
  ['shaima', 'الأستاذة الشيماء عسيري', 'teacher', true, [['اللغة الإنجليزية', [1]]]],
  ['jumana', 'الأستاذة جمانة الشهري', 'teacher', true, [['التربية الفنية', [3]], ['اللغة الإنجليزية', [1]]]],
];

const ALIAS = { 'التربية الأسرية': 'الأسرية', 'التربية البدنية': 'البدنية' };
const subjectId = (name) => (App.subjects.find((s) => s.name === name) || App.subjects.find((s) => s.name.includes(ALIAS[name] || name)))?.id;
const gradeId = (sort) => (App.grades.find((g) => g.sort === sort) || App.grades[sort - 1])?.id;

function genPass() {
  const a = 'abcdefghjkmnpqrstuvwxyz', d = '23456789';
  const r = (s) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  return Array.from({ length: 5 }, () => r(a)).join('') + Array.from({ length: 4 }, () => r(d)).join('');
}

export function bulkAccountsDialog(existingUsernames = []) {
  const taken = new Set(existingUsernames.map((u) => String(u).toLowerCase()));
  const list = ROSTER.map(([username, full_name, role, is_teacher, asg]) => ({
    username, full_name, role, is_teacher, password: genPass(), exists: taken.has(username),
    assignments: asg.flatMap(([s, gs]) => gs.map((g) => ({ subject_id: subjectId(s), grade_id: gradeId(g) }))).filter((x) => x.subject_id && x.grade_id),
    subjects: asg.map(([s]) => s).join('، '),
  }));
  const todo = list.filter((x) => !x.exists);

  const m = modal({
    title: 'إنشاء حسابات المنسوبات دفعة واحدة', wide: true,
    body: `<p class="muted" style="font-size:.85rem">القائمة مجهزة بأسماء منسوبات المدرسة. أزيلي علامة من لا تريدين إنشاء حساب لها، ويمكنك تعديل اسم المستخدم. كلمات المرور مولّدة عشوائياً، وبعد الإنشاء تنزّلين ملف Excel بها لتسليم كل معلمة بياناتها.</p>
      <div class="table-wrap" style="max-height:420px;overflow:auto"><table>
        <thead><tr><th></th><th>الاسم</th><th>اسم المستخدم</th><th>الصلاحية</th><th>المادة</th><th data-h>الحالة</th></tr></thead>
        <tbody>${list.map((r, i) => `<tr data-row="${i}" style="${r.exists ? 'opacity:.5' : ''}">
          <td><input type="checkbox" data-c ${r.exists ? 'disabled' : 'checked'} aria-label="${esc(r.full_name)}"></td>
          <td>${esc(r.full_name)}</td>
          <td><input data-u dir="ltr" value="${esc(r.username)}" style="width:120px" ${r.exists ? 'disabled' : ''}></td>
          <td>${esc(ROLES[r.role])}</td>
          <td class="muted" style="font-size:.8rem">${esc(r.subjects || '—')}</td>
          <td data-s>${r.exists ? '<span class="chip ok">موجود مسبقاً</span>' : '<span class="muted">—</span>'}</td>
        </tr>`).join('')}</tbody></table></div>`,
    footer: `<button class="btn primary" data-go>${icon('users')} إنشاء الحسابات المحددة (${todo.length})</button>
      <button class="btn" data-dl hidden>${icon('file-spreadsheet')} تنزيل بيانات الدخول (Excel)</button>
      <button class="btn ghost" data-close>إغلاق</button>`,
    onClose: rerender,
  });
  refreshIcons();

  const created = [];
  m.$('[data-go]').addEventListener('click', async (e) => {
    const btn = e.currentTarget; btn.disabled = true;
    const rows = m.$$('[data-row]');
    for (const tr of rows) {
      const r = list[Number(tr.dataset.row)];
      const cb = tr.querySelector('[data-c]');
      if (r.exists || !cb.checked || r.done) continue;
      const cell = tr.querySelector('[data-s]');
      r.username = tr.querySelector('[data-u]').value.trim().toLowerCase();
      cell.innerHTML = '<span class="muted">جارٍ الإنشاء…</span>';
      try {
        await fn('admin-users', { action: 'create', username: r.username, password: r.password, full_name: r.full_name, role: r.role, is_teacher: r.is_teacher, assignments: r.assignments });
        r.done = true; created.push(r); cb.disabled = true;
        cell.innerHTML = '<span class="chip ok">تم</span>';
      } catch (ex) {
        cell.innerHTML = `<span class="chip bad" title="${esc(errMsg(ex))}">${esc(errMsg(ex)).slice(0, 60)}</span>`;
      }
    }
    btn.disabled = false;
    if (created.length) { m.$('[data-dl]').hidden = false; toast(`تم إنشاء ${created.length} حساباً — نزّلي ملف بيانات الدخول الآن`, 'ok', 9000); }
  });

  m.$('[data-dl]').addEventListener('click', async () => {
    try {
      const XLSX = await getXLSX();
      const url = location.origin + location.pathname;
      const data = created.map((r) => ({ 'الاسم': r.full_name, 'اسم المستخدم': r.username, 'كلمة المرور': r.password, 'الصلاحية': ROLES[r.role], 'رابط الموقع': url }));
      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 50 }];
      const wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
      XLSX.utils.book_append_sheet(wb, ws, 'بيانات الدخول');
      const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'بيانات-دخول-المعلمات.xlsx');
    } catch (ex) { toast(errMsg(ex), 'bad'); }
  });
}
