// تقويم مواعيد رفع الخطط والتقارير + تصدير ICS
import { App, q, catOf } from '../api.js';
import { esc, icon, emptyState, downloadBlob, reqChip } from '../ui.js';
import { pageHead } from './_common.js';

export default async function calendar(view, params, query) {
  const reqs = (await q.requirements()).filter((r) => r.active && r.due_date && (App.isStaff || !r.teacher_id || r.teacher_id === App.user.id));
  const mine = App.profile.is_teacher ? await q.reqStatus(App.user.id) : [];
  const stateOf = Object.fromEntries(mine.map((m) => [m.requirement_id, m.state]));
  const now = new Date();
  let y = Number(query.y) || now.getFullYear(), mo = query.m ? Number(query.m) - 1 : now.getMonth();
  const first = new Date(y, mo, 1);
  const start = new Date(first); start.setDate(1 - ((first.getDay() + 1) % 7)); // الأسبوع يبدأ السبت
  const days = [];
  for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayS = iso(now);
  const monthName = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' }).format(first);
  const prev = new Date(y, mo - 1, 1), next = new Date(y, mo + 1, 1);
  const upcoming = reqs.filter((r) => r.due_date >= todayS).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 12);

  view.innerHTML = `
    ${pageHead('التقويم والمواعيد', 'مواعيد رفع الخطط والتقارير المحددة من الإدارة.', `<button class="btn" data-ics>${icon('calendar-plus')} تصدير إلى التقويم (ICS)</button>`)}
    <div class="grid c3">
      <div class="card span-2">
        <div class="card-head">
          <a class="btn sm ghost" href="#/calendar?y=${prev.getFullYear()}&m=${prev.getMonth() + 1}">${icon('chevron-right')}</a>
          <h3>${esc(monthName)}</h3>
          <a class="btn sm ghost" href="#/calendar?y=${next.getFullYear()}&m=${next.getMonth() + 1}">${icon('chevron-left')}</a>
        </div>
        <div class="cal">
          ${['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map((d) => `<div class="dh">${d}</div>`).join('')}
          ${days.map((d) => { const s = iso(d); const ev = reqs.filter((r) => r.due_date === s);
            return `<div class="dc ${d.getMonth() !== mo ? 'out' : ''} ${s === todayS ? 'today' : ''}"><span class="dn">${d.getDate()}</span>
              ${ev.map((r) => `<span class="ev ${s < todayS && stateOf[r.id] === 'missing' ? 'late' : ''}" title="${esc(r.title)}">${esc(r.title)}</span>`).join('')}</div>`; }).join('')}
        </div>
      </div>
      <div class="card">
        <h3>${icon('clock')} المواعيد القادمة</h3>
        ${upcoming.length ? `<div class="list">${upcoming.map((r) => `<div class="list-item"><div class="li-ic">${icon('calendar')}</div>
          <div class="li-main"><div class="li-t">${esc(r.title)}</div><div class="li-s">${esc(catOf(r.category_key).title)} · ${esc(r.due_date)}</div></div>
          ${stateOf[r.id] ? reqChip(stateOf[r.id]) : ''}</div>`).join('')}</div>` : emptyState('لا توجد مواعيد قادمة', 'calendar')}
      </div>
    </div>`;

  view.querySelector('[data-ics]').addEventListener('click', () => {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const escI = (s) => String(s).replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tahseel Khaybar//AR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:مواعيد لجنة التحصيل الدراسي'];
    reqs.forEach((r) => {
      const d = r.due_date.replace(/-/g, '');
      const n = new Date(r.due_date); n.setDate(n.getDate() + 1);
      lines.push('BEGIN:VEVENT', `UID:${r.id}@tahseel`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${iso(n).replace(/-/g, '')}`,
        `SUMMARY:${escI('موعد: ' + r.title)}`, `DESCRIPTION:${escI(catOf(r.category_key).title + (r.description ? ' — ' + r.description : ''))}`,
        'BEGIN:VALARM', 'TRIGGER:-P2D', 'ACTION:DISPLAY', `DESCRIPTION:${escI('اقترب موعد: ' + r.title)}`, 'END:VALARM', 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    downloadBlob(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }), 'مواعيد-لجنة-التحصيل.ics');
  });
}
