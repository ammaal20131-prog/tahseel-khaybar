// المساعد الذكي: يجيب من بيانات النظام فقط وضمن صلاحيات المستخدمة
import { App, fn } from '../api.js';
import { esc, icon, miniMarkdown, refreshIcons, errMsg } from '../ui.js';
import { pageHead } from './_common.js';

const history = [];

export default async function assistant(view) {
  const sugg = App.isStaff ? [
    'ما الملفات الناقصة لدى كل معلمة؟',
    'ما الخطط العلاجية التي تحتاج إلى مراجعة؟',
    'ما أبرز المهارات التي ظهر فيها ضعف وفق نتائج الاختبارات المرفوعة؟',
    'ما نسبة اكتمال ملفات اللجنة؟',
    'ما التقارير والملفات التي لم تُعتمد بعد؟',
    'ما أبرز توصيات التحسين المستخرجة من التقارير؟',
  ] : ['ما الملفات الناقصة لدي؟', 'ما الملفات التي أُعيدت لي ولماذا؟', 'ما أبرز توصيات التحسين على خططي؟'];

  view.innerHTML = `
    ${pageHead(`${icon('sparkles')} المساعد الذكي`, 'يجيب من الملفات والبيانات الموجودة في النظام فقط، ويعرض الوثائق التي اعتمد عليها.')}
    ${App.ai?.ai_ready ? '' : `<div class="alert warn" style="margin-bottom:14px">${icon('triangle-alert')}<div>المساعد الذكي غير مفعل حالياً${App.ai?.has_key === false ? ' — لم يُضف مفتاح Claude API في إعدادات الخادم' : ''}.</div></div>`}
    <div class="card">
      <div class="chat" data-chat>
        ${history.length ? '' : `<div class="msg bot">مرحباً ${esc(App.profile.full_name)}، اسأليني عن إنجاز الملفات أو نتائج التحليل أو التوصيات.<div class="suggest" style="margin-top:10px">${sugg.map((s) => `<button data-s>${esc(s)}</button>`).join('')}</div></div>`}
      </div>
      <form class="chat-input" data-f><input name="q" placeholder="اكتبي سؤالك…" autocomplete="off" required><button class="btn primary">${icon('send')}</button></form>
    </div>`;
  const chat = view.querySelector('[data-chat]');
  const add = (role, html) => { const d = document.createElement('div'); d.className = 'msg ' + role; d.innerHTML = html; chat.appendChild(d); refreshIcons(); d.scrollIntoView({ block: 'end', behavior: 'smooth' }); return d; };
  history.forEach((m) => add(m.role === 'user' ? 'user' : 'bot', m.role === 'user' ? esc(m.content) : render(m)));

  const ask = async (text) => {
    add('user', esc(text));
    const wait = add('bot', '<span class="spinner sm"></span> أبحث في بيانات النظام…');
    try {
      const r = await fn('ai', { action: 'assistant', question: text, history: history.map(({ role, content }) => ({ role, content })) });
      const msg = { role: 'assistant', content: r.answer, sources: r.sources || [] };
      history.push({ role: 'user', content: text }, msg);
      wait.innerHTML = render(msg);
    } catch (e) { wait.innerHTML = `<span style="color:var(--bad)">${esc(errMsg(e))}</span>`; }
    refreshIcons();
  };
  view.querySelector('[data-f]').addEventListener('submit', (e) => { e.preventDefault(); const v = e.target.q.value.trim(); if (v) { e.target.q.value = ''; ask(v); } });
  view.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => ask(b.textContent)));
}

function render(m) {
  return miniMarkdown(m.content) + (m.sources?.length ? `<div class="muted" style="font-size:.8rem;margin-top:8px;border-top:1px solid var(--line);padding-top:6px">${icon('paperclip')} الوثائق المعتمد عليها: ${m.sources.map((s) => `<a href="#/file/${esc(s.id)}">${esc(s.name)}</a>`).join('، ')}</div>` : '');
}
