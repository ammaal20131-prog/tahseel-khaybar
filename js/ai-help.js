// حالة الذكاء الاصطناعي وإرشادات التفعيل
import { App, fn } from './api.js';
import { icon, modal, refreshIcons } from './ui.js';

const PROJECT = 'bluxwcamszrxtehnnsbp';

export async function aiReady() {
  try { App.ai = await fn('ai', { action: 'config' }); } catch (e) { /* keep last */ }
  return !!App.ai?.ai_ready;
}

export function showAiSetup() {
  const noKey = App.ai?.has_key === false;
  const body = noKey ? (App.isAdmin ? `<p>الذكاء الاصطناعي يحتاج إلى <b>مفتاح Claude API</b> يُحفظ على الخادم مرة واحدة فقط (لا يظهر في الموقع أبداً):</p>
      <ol style="line-height:2">
        <li>افتحي <a href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a> وسجلي الدخول، ثم أضيفي رصيداً من <b>Billing</b> (الدفع حسب الاستخدام).</li>
        <li>من <b>API Keys</b> اضغطي <b>Create Key</b> وانسخي المفتاح.</li>
        <li>افتحي <a href="https://supabase.com/dashboard/project/${PROJECT}/functions/secrets" target="_blank" rel="noopener">أسرار Supabase</a> ← <b>Add new secret</b>: الاسم <code dir="ltr">ANTHROPIC_API_KEY</code> والقيمة المفتاح الذي نسختِه ← <b>Save</b>.</li>
        <li>ارجعي هنا وحدّثي الصفحة؛ تتفعل أيقونات الذكاء تلقائياً.</li>
      </ol>
      <p class="muted" style="font-size:.82rem">لا ترسلي المفتاح في المحادثات أو الرسائل؛ ضعيه في Supabase فقط.</p>`
    : '<p>الذكاء الاصطناعي غير مفعل بعد. تواصلي مع رئيسة اللجنة أو مديرة المدرسة لتفعيله.</p>')
    : `<p>الذكاء الاصطناعي موقوف من <a href="#/settings">إعدادات الموقع</a>. ${App.isAdmin ? 'فعّلي خيار «تفعيل القراءة والتحليل بالذكاء الاصطناعي».' : 'تواصلي مع الإدارة لتفعيله.'}</p>`;
  modal({ title: 'تفعيل الذكاء الاصطناعي', body, footer: '<button class="btn primary" data-close>حسناً</button>' });
  refreshIcons();
}

export const aiBadge = () => (App.ai?.ai_ready ? '' : ` <span class="chip warn" style="font-size:.7rem">غير مفعل</span>`);
export { icon };
