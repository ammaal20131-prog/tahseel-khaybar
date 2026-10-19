// صفحة معلمة: الإنجاز والملفات والمتطلبات
import { App, q, catOf, subjectName, gradeName } from '../api.js';
import { esc, icon, fmtNum, fmtPct, fmtDate, timeAgo, statusChip, reqChip, fileIcon, emptyState, progressBar, pctClass, ROLES, initials } from '../ui.js';
import { pageHead, catIcon, folderLink, kpi } from './_common.js';
import { accountDialog, oneDriveUrl } from './teachers.js';
import { promptBox, toast, errMsg } from '../ui.js';
import { sb } from '../api.js';

export default async function teacher(view, params) {
  const [p, reqs, files, asg, prog] = await Promise.all([
    q.teacher(params.id), q.reqStatus(params.id), q.files({ teacher: params.id }), q.assignments(params.id), q.progress(),
  ]);
  if (!p) throw new Error('المعلمة غير موجودة');
  const g = prog.find((x) => x.teacher_id === p.id) || {};
  const pct = g.required ? g.submit_pct : 0;
  view.innerHTML = `
    ${pageHead(`<span class="avatar" style="display:inline-grid;width:42px;height:42px;vertical-align:middle;margin-inline-end:8px">${esc(initials(p.full_name))}</span>${esc(p.full_name)}`,
      `${esc(ROLES[p.role])} · <span dir="ltr">${esc(p.username)}</span>${p.employee_code ? ' · ' + esc(p.employee_code) : ''} · ${p.active ? '<span class="chip ok">مفعل</span>' : '<span class="chip bad">موقوف</span>'}`,
      `${oneDriveUrl(p.onedrive_url) ? `<a class="btn" href="${esc(oneDriveUrl(p.onedrive_url))}" target="_blank" rel="noopener">${icon('cloud')} مجلد OneDrive</a>` : ''}<button class="btn" data-notify>${icon('bell-plus')} إرسال تنبيه</button>${App.isAdmin ? `<button class="btn" data-edit>${icon('pencil')} تعديل الحساب</button>` : ''}`,
      `<a href="#/teachers">المعلمات</a> ${icon('chevron-left')} ${esc(p.full_name)}`)}
    <div class="grid c4 kpis">
      ${kpi(fmtPct(pct), 'نسبة الإنجاز', 'target', 'gold')}
      ${kpi(`${fmtNum(g.submitted || 0)} / ${fmtNum(g.required || 0)}`, 'المتطلبات المرفوعة', 'list-checks')}
      ${kpi(fmtNum(g.missing || 0), 'متطلبات ناقصة', 'file-warning', g.missing ? 'bad' : '')}
      ${kpi(fmtNum(files.length), 'إجمالي الملفات', 'files', 'info')}
    </div>
    <div class="grid c3" style="margin-top:16px">
      <div class="card">
        <h3>${icon('book-marked')} المواد والصفوف</h3>
        ${asg.length ? `<ul style="padding-inline-start:18px;margin:0">${asg.map((a) => `<li>${esc(subjectName(a.subject_id))} — ${esc(gradeName(a.grade_id))}</li>`).join('')}</ul>` : '<p class="muted">لم تُحدد بعد</p>'}
        <div class="divider"></div>
        <dl class="kv"><dt>آخر دخول</dt><dd>${p.last_login_at ? fmtDate(p.last_login_at, true) : 'لم تدخل بعد'}</dd><dt>آخر رفع ملف</dt><dd>${p.last_upload_at ? fmtDate(p.last_upload_at, true) : '—'}</dd></dl>
      </div>
      <div class="card span-2">
        <div class="card-head"><h3>${icon('list-checks')} المتطلبات</h3><div style="min-width:160px">${progressBar(pct, pctClass(pct))}</div></div>
        ${reqs.length ? `<div class="table-wrap"><table><thead><tr><th>المتطلب</th><th>المجلد</th><th>الموعد</th><th>الحالة</th></tr></thead><tbody>
        ${reqs.map((r) => `<tr><td><b>${esc(r.title)}</b></td><td><a href="${folderLink(r.category_key, p.id)}">${esc(catOf(r.category_key).title)}</a></td><td class="num">${esc(r.due_date || '—')}</td><td>${reqChip(r.state)}</td></tr>`).join('')}
        </tbody></table></div>` : emptyState(p.is_teacher ? 'لا متطلبات' : 'هذا الحساب لا تُطلب منه ملفات', 'list-checks')}
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="card-head"><h3>${icon('folder-open')} مجلدات المعلمة</h3>${oneDriveUrl(p.onedrive_url) ? '' : `<span class="muted" style="font-size:.82rem">${icon('cloud-off')} لم يُربط مجلد OneDrive${App.isAdmin ? ' — أضيفيه من "تعديل الحساب"' : ''}</span>`}</div>
      <div class="sub-folders">${App.categories.filter((c) => c.per_teacher).map((c) => {
        const n = files.filter((f) => f.category_key === c.key).length;
        return `<a class="sub-folder" href="${folderLink(c.key, p.id)}">${icon(catIcon(c.key))}<div><div class="sn">${esc(c.title)}</div><div class="sm">${fmtNum(n)} ملف</div></div></a>`;
      }).join('')}</div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="card-head"><h3>${icon('files')} آخر الملفات</h3></div>
      ${files.length ? `<div class="table-wrap"><table><thead><tr><th>الملف</th><th>المجلد</th><th>رُفع</th><th>الحالة</th></tr></thead><tbody>
      ${files.slice(0, 30).map((f) => `<tr><td><a class="file-name" href="#/file/${f.id}">${icon(fileIcon(f.name))}${esc(f.name)}</a></td><td>${esc(catOf(f.category_key).title)}</td><td class="muted">${timeAgo(f.created_at)}</td><td>${statusChip(f.status)}</td></tr>`).join('')}
      </tbody></table></div>` : emptyState('لا توجد ملفات', 'files')}
    </div>`;
  view.querySelector('[data-edit]')?.addEventListener('click', () => accountDialog(p, asg));
  view.querySelector('[data-notify]').addEventListener('click', async () => {
    const t = await promptBox('نص التنبيه', { title: `تنبيه إلى ${p.full_name}`, textarea: true, required: true, ok: 'إرسال' });
    if (!t) return;
    const { error } = await sb.rpc('send_notification', { p_user: p.id, p_title: 'تنبيه من لجنة التحصيل الدراسي', p_body: t, p_link: '#/tasks' });
    if (error) toast(errMsg(error), 'bad'); else toast('تم إرسال التنبيه', 'ok');
  });
}
