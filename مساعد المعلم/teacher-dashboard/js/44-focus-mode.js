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
/* حصص اليوم من الجدول بأوقاتها (نفس مصدر qrLesson) */
function fmTodayLessons(k) {
  try {
    if (!(k.dow >= 0 && k.dow <= 4)) return [];
    const sc = (CT_DATA || {}).schedule || {}, g = (sc.grid || {})[String(k.dow)] || {};
    return tdTimes(sc).filter(t => g[String(t.n)]).map(t => ({ ...t, cls: g[String(t.n)] }));
  } catch (e) { return []; }
}
function fmBarHTML() {
  const L = typeof qrLesson === 'function' ? qrLesson() : null, cls = fmCls(), k = tdKsaNow();
  const mine = L && L.cls === cls, ord = typeof QR_ORD !== 'undefined' ? (QR_ORD[L && L.n] || (L && L.n)) : (L && L.n);
  const ic = n => (typeof window.icoSVG === 'function' ? window.icoSVG(n) : '');
  const dot = mine && L.now ? '<i class="fm-dot" aria-hidden="true"></i>' : '';
  const title = mine ? `${dot}الحصة ${L.n} · ${esc(cls)}` : esc(cls || 'اختر الفصل');
  const dl = fmTodayLessons(k).filter(t => t.cls === cls), other = dl.find(t => t.em > k.min) || dl[dl.length - 1];   // فصل مختار غير الحصة الحالية: موعده اليوم
  const sub = mine ? `${L.s} – ${L.e}${L.now ? '' : ' · القادمة'}` : other ? `الحصة ${other.n} · ${other.s} – ${other.e}${other.em <= k.min ? ' · انتهت' : ''}` : 'لا حصة له اليوم · اضغط لتغيير الفصل';
  const left = mine ? (L.now ? `${Math.max(0, L.em - k.min)} د` : `بعد ${Math.max(0, L.sm - k.min)} د`) : '';
  // قائمة الفصل = جدول اليوم: كل حصة بوقتها (الجارية والقادمة والمنتهية)، ثم الفصول التي ليس لها حصة اليوم
  const day = fmTodayLessons(k), cur = L && L.cls === cls ? L.n : 0; let sel = false;
  const pick = (c, n) => { const on = !sel && c === cls && (!n || !cur || n === cur); if (on) sel = true; return on ? 'selected' : ''; };
  const lessonOpts = day.map(t => `<option value="${esc(t.cls)}" ${pick(t.cls, t.n)}>الحصة ${t.n} · ${t.s} – ${t.e} · ${esc(t.cls)}${k.min >= t.sm && k.min < t.em ? ' — الآن' : k.min >= t.em ? ' ✓' : ''}</option>`).join('');
  const rest = ctClasses().filter(c => !day.some(t => t.cls === c)).map(c => `<option value="${esc(c)}" ${pick(c, 0)}>${esc(c)}</option>`).join('');
  const opts = day.length ? `<optgroup label="حصص اليوم">${lessonOpts}</optgroup>${rest ? `<optgroup label="${day.length ? 'لا حصة لها اليوم' : 'الفصول'}">${rest}</optgroup>` : ''}`
    : `<optgroup label="لا حصص في جدولك اليوم">${rest}</optgroup>`;
  return `<span class="fm-ic">${ic('hand')}</span><label class="fm-t" title="تغيير الفصل"><b><span class="fm-tt">${title}</span><span class="fm-chev">${ic('chev')}</span></b><small>${sub}</small><select aria-label="الفصل" onchange="fmPickCls(this.value)">${opts}</select></label>
    ${left ? `<span class="fm-tm">${ic('clock')}${left}</span>` : ''}<button type="button" class="fm-x" onclick="fmExit()" aria-label="خروج من وضع الحصة">${ic('x')}خروج</button>`;
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
