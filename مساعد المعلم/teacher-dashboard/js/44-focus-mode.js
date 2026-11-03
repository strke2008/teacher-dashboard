/* ═══════════ 🎯 وضع الحصة — نسخة مركّزة للرصد داخل الفصل ═══════════
   يُفتح من «✋ الرصد» أعلى اللوحة ومن تنبيه بداية الحصة. يختفي كل شيء آخر (القوائم، الأقسام، المحادثات)،
   ويبقى: شريط علوي بالحصة والوقت المتبقي، وثلاث صفحات فقط أسفل الشاشة: ✋ الرصد · 📝 الاختبارات (وفيها 📷 الكاميرا) · 💌 رسائل.
   يبقى مفتوحًا — ولو أُغلق التطبيق وفُتح — حتى تضغط «✕ خروج». لا يغيّر أي بيانات ولا طريقة حفظها. */
const FM_KEY = 'hw_focus_v1', FM_TAB_KEY = 'hw_focus_tab_v1';
const FM = { on: false, tab: 'r', timer: 0 };
const FM_TABS = [['r', '✋', 'الرصد'], ['e', '📝', 'الاختبارات'], ['m', '💌', 'رسائل']];
const fmGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const fmSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };

/* فصل الوضع: الذي اخترته في الشريط، وإلا فصل الحصة الجارية/القادمة من الجدول، وإلا فصل الرصد الحالي */
function fmCls() {
  const pick = window._fmCls && ctValidCls(window._fmCls) === window._fmCls ? window._fmCls : '';
  if (pick) return pick;
  const L = typeof qrLesson === 'function' ? qrLesson() : null;
  return ctValidCls(L && L.cls || window._ctRcCls);
}
function fmBarHTML() {
  const L = typeof qrLesson === 'function' ? qrLesson() : null, cls = fmCls(), k = tdKsaNow();
  const mine = L && L.cls === cls, ord = typeof QR_ORD !== 'undefined' ? (QR_ORD[L && L.n] || (L && L.n)) : (L && L.n);
  const title = mine ? `${L.now ? '🟢' : '⏭️'} الحصة ${ord} · ${esc(cls)}` : `✋ ${esc(cls || 'اختر الفصل')}`;
  const sub = mine ? `${L.s} – ${L.e} · وضع الحصة` : 'وضع الحصة · اضغط لتغيير الفصل';
  const left = mine ? (L.now ? `⏳ ${Math.max(0, L.em - k.min)} د` : `يبدأ بعد ${Math.max(0, L.sm - k.min)} د`) : '';
  const opts = ctClasses().map(c => `<option ${c === cls ? 'selected' : ''}>${esc(c)}</option>`).join('');
  return `<label class="fm-t" title="تغيير الفصل"><b>${title}</b><small>${sub}</small><select aria-label="الفصل" onchange="fmPickCls(this.value)">${opts}</select></label>
    ${left ? `<span class="fm-tm">${left}</span>` : ''}<button type="button" class="fm-x" onclick="fmExit()">✕ خروج</button>`;
}
function fmPaintBars() {
  let top = document.getElementById('fm-top'), bot = document.getElementById('fm-bot');
  if (!top) { top = document.createElement('div'); top.id = 'fm-top'; top.className = 'no-print'; document.body.appendChild(top); }
  if (!bot) { bot = document.createElement('nav'); bot.id = 'fm-bot'; bot.className = 'no-print'; bot.setAttribute('aria-label', 'وضع الحصة'); document.body.appendChild(bot); }
  top.innerHTML = fmBarHTML();
  bot.innerHTML = FM_TABS.map(([k, ic, l]) => `<button type="button" class="${FM.tab === k ? 'on' : ''}" aria-current="${FM.tab === k}" onclick="fmGo('${k}')"><i>${ic}</i>${l}</button>`).join('');
}
function fmGo(tab) {
  FM.tab = FM_TABS.some(t => t[0] === tab) ? tab : 'r'; fmSet(FM_TAB_KEY, FM.tab);
  const cls = fmCls(); if (cls) { window._ctRcCls = cls; window._ctExCls = cls; window._ctMsCls = cls; window._ctRcClsUser = 1; }
  try { if (typeof exKbClose === 'function') exKbClose(true); } catch (e) {}
  if (FM.tab === 'r') { window._ctRcView = 'day'; window._ctRcD = ctToday(); ctGo('records'); }
  else if (FM.tab === 'e') { window._ctExMode = 'rec'; ctGo('exams'); }
  else ctGo('messages');
  fmPaintBars(); try { scrollTo(0, 0); } catch (e) {}
}
function fmPickCls(c) { window._fmCls = c; fmGo(FM.tab); }
function fmEnter(tab) {
  FM.on = true; fmSet(FM_KEY, '1');
  document.body.classList.add('fm');
  clearInterval(FM.timer); FM.timer = setInterval(() => { if (FM.on) fmPaintBars(); }, 30000);
  fmGo(tab || fmGet(FM_TAB_KEY) || 'r');
}
function fmExit() {
  FM.on = false; fmSet(FM_KEY, null); window._fmCls = '';
  clearInterval(FM.timer); document.body.classList.remove('fm');
  ['fm-top', 'fm-bot'].forEach(id => document.getElementById(id)?.remove());
  try { if (typeof exKbClose === 'function') exKbClose(true); } catch (e) {}
  try { goTab('dashboard'); } catch (e) {}
}
/* أُغلق التطبيق وهو في وضع الحصة: يعود إليه */
(function fmBoot() {
  if (fmGet(FM_KEY) !== '1') return;
  document.body.classList.add('fm');                       // لا وميض للوحة الكاملة قبل الدخول
  const t0 = Date.now(), go = () => {
    if (typeof ctGo === 'function' && typeof qrPaint === 'function' && Array.isArray(STUDENTS) && STUDENTS.length) fmEnter();
    else if (Date.now() - t0 < 15000) setTimeout(go, 250); else fmEnter();
  };
  setTimeout(go, 300);
})();
