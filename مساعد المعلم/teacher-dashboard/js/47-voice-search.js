/* 🎤 البحث بالصوت في كل خانات البحث عن طالب — زر ميكروفون داخل الخانة: تقول الاسم فيُكتب فيها وتُصفّى النتائج كأنك كتبته.
   يُضاف تلقائيًا لكل خانة بحث عن طالب (الثابتة والتي تبنيها الصفحات لاحقًا). خانة «✋ الرصد» لها ميكروفونها الخاص (رصد بالصوت) فلا تُلمس.
   لا يعمل إلا إن دعم المتصفح التعرّف على الكلام؛ وإلا لا يظهر الزر أصلًا. */
(function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
  const IDS = ['th-q', 'msg-student-search', 'students-center-search', 'comp-search', 'wk-search', 'g-search', 'projects-search', 'bp-q', 'wr-q', 'qk-q', 'ch-q', 'omr-q', 'exam-search', 'ms-q', 'esp-search'];
  const SKIP = ['qr-q'];   // الرصد السريع: ميكروفونه يرصد بالصوت
  const isTarget = el => el && el.tagName === 'INPUT' && !el.dataset.vs && !SKIP.includes(el.id) && !el.disabled && /^(search|text|)$/.test(el.getAttribute('type') || '') &&
    (IDS.includes(el.id) || /(ابحث|بحث|ابدأ محادثة)[^…]*(طالب|الطالب|الطلاب)/.test(el.getAttribute('placeholder') || ''));
  const ico = () => (typeof window.icoSVG === 'function' && window.icoSVG('mic')) || '🎤';
  let cur = null;   // { rec, inp, btn }
  function stop() { if (!cur) return; const c = cur; cur = null; try { c.rec.abort(); } catch (e) {} c.btn.classList.remove('on'); c.btn.setAttribute('aria-pressed', 'false'); }
  function put(inp, text) {
    inp.value = text; inp.dispatchEvent(new Event('input', { bubbles: true }));
    try { inp.focus({ preventScroll: true }); inp.setSelectionRange(text.length, text.length); } catch (e) {}
  }
  function listen(inp, btn) {
    if (cur && cur.inp === inp) { stop(); return; } stop();
    const rec = new SR(); rec.lang = 'ar-SA'; rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
    cur = { rec, inp, btn }; btn.classList.add('on'); btn.setAttribute('aria-pressed', 'true');
    let last = '';
    rec.onresult = ev => { let t = ''; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
      t = t.replace(/[.,،؟?!]+/g, ' ').replace(/^\s*(ابحث عن|ابحث|الطالب)\s+/, '').replace(/\s+/g, ' ').trim(); if (t && t !== last) { last = t; put(inp, t); } };
    rec.onerror = ev => { if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { try { toast('اسمح باستخدام الميكروفون من إعدادات المتصفح', 'bad'); } catch (e) {} }
      else if (ev.error === 'no-speech') { try { toast('لم أسمع شيئًا — اضغط الميكروفون وقل اسم الطالب', 'warn'); } catch (e) {} } };
    rec.onend = () => { if (cur && cur.rec === rec) stop(); };
    try { rec.start(); } catch (e) { stop(); }
  }
  function attach(inp) {
    inp.dataset.vs = '1';
    const cs = getComputedStyle(inp), w = document.createElement('span'); w.className = 'vs-wrap';
    // الغلاف يأخذ مكان الخانة وتخطيطها (flex، العرض، الهوامش)، والخانة تملؤه
    w.style.display = cs.display === 'inline-block' || cs.display === 'inline' ? 'inline-block' : 'block';
    for (const k of ['flex', 'minWidth', 'maxWidth', 'margin']) if (inp.style[k]) { w.style[k] = inp.style[k]; inp.style[k] = ''; }
    if (!w.style.flex && cs.flexGrow !== '0') w.style.flex = cs.flexGrow + ' ' + cs.flexShrink + ' ' + cs.flexBasis;
    if (inp.style.width) { w.style.width = inp.style.width; inp.style.width = '100%'; }
    inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'vs-mic'; b.setAttribute('aria-label', 'بحث بالصوت'); b.setAttribute('aria-pressed', 'false'); b.title = 'بحث بالصوت — قل اسم الطالب';
    b.innerHTML = ico(); b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); listen(inp, b); });
    b.addEventListener('mousedown', e => e.preventDefault());   // لا يُفقد التركيز من الخانة (بعض القوائم تُغلق عند فقده)
    w.appendChild(b);
  }
  const scan = root => { if (!root || root.nodeType !== 1) return; if (isTarget(root)) attach(root); root.querySelectorAll && root.querySelectorAll('input').forEach(el => { if (isTarget(el)) attach(el); }); };
  let q = 0; const pend = new Set();
  new MutationObserver(rs => { for (const r of rs) r.addedNodes.forEach(n => { if (n.nodeType === 1) pend.add(n); }); if (pend.size && !q) q = requestAnimationFrame(() => { q = 0; const L = [...pend]; pend.clear(); L.forEach(n => n.isConnected && scan(n)); }); })
    .observe(document.documentElement, { childList: true, subtree: true });
  const first = () => scan(document.body);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', first); else first();
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
})();
