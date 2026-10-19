// التنبيهات
import { App, sb, q, refreshUnread } from '../api.js';
import { esc, icon, timeAgo, emptyState, toast, errMsg, promptBox } from '../ui.js';
import { pageHead } from './_common.js';
import { rerender } from '../main.js';

const KIND = { approved: ['badge-check', 'ok'], returned: ['undo-2', 'bad'], failed: ['triangle-alert', 'bad'], requirement: ['list-plus', 'info'], deadline: ['clock-alert', 'warn'], missing: ['file-warning', 'bad'], note: ['message-square', 'gold'], admin: ['megaphone', 'gold'], info: ['info', ''] };

export default async function notifications(view) {
  const list = await q.notifications(100);
  view.innerHTML = `
    ${pageHead('التنبيهات', '', `${list.some((n) => !n.read_at) ? `<button class="btn" data-all>${icon('check-check')} تعليم الكل كمقروء</button>` : ''}
      ${App.isStaff ? `<button class="btn primary" data-send>${icon('megaphone')} تنبيه لجميع المعلمات</button>` : ''}`)}
    <div class="card"><div class="list">
      ${list.length ? list.map((n) => { const [ic, tone] = KIND[n.kind] || KIND.info;
        return `<a class="list-item" href="${esc(n.link || '#/notifications')}" data-id="${n.id}" style="color:inherit;text-decoration:none;${n.read_at ? 'opacity:.62' : ''}">
          <div class="li-ic" style="${tone ? `color:var(--${tone});background:var(--${tone}-soft)` : ''}">${icon(ic)}</div>
          <div class="li-main"><div class="li-t">${esc(n.title)}</div>${n.body ? `<div class="li-s" style="white-space:normal">${esc(n.body)}</div>` : ''}</div>
          <small class="muted">${timeAgo(n.created_at)}</small>${n.read_at ? '' : '<span class="badge" style="min-width:10px;height:10px;padding:0"></span>'}</a>`; }).join('')
        : emptyState('لا توجد تنبيهات', 'bell-off')}
    </div></div>`;
  view.querySelectorAll('[data-id]').forEach((a) => a.addEventListener('click', () => {
    sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', a.dataset.id).is('read_at', null).then(refreshUnread);
  }));
  view.querySelector('[data-all]')?.addEventListener('click', async () => {
    await sb.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
    refreshUnread(); rerender();
  });
  view.querySelector('[data-send]')?.addEventListener('click', async () => {
    const t = await promptBox('نص التنبيه', { title: 'تنبيه لجميع المعلمات', textarea: true, required: true, ok: 'إرسال' });
    if (!t) return;
    const { data, error } = await sb.rpc('send_notification', { p_user: null, p_title: 'تنبيه من لجنة التحصيل الدراسي', p_body: t, p_link: '#/tasks' });
    if (error) toast(errMsg(error), 'bad'); else toast(`أُرسل التنبيه إلى ${data} معلمة`, 'ok');
  });
}
