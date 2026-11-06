/* 🎙️ محرّك الصوت الموحّد للموقع كله (HWV) — نفس ما ثبت على iPhone في «صوت ١٠» بالاختبارات:
   • بعد إغلاق جلسة الاستماع، أي جلسة جديدة في الصفحة نفسها لا يصلها صوت حتى يُعاد فتح المتصفح
     (يبدو أنه سمعك أول مرة فقط، ويبقى مؤشر الميكروفون البرتقالي مضاءً).
   • لذا: كائن تعرّف واحد للصفحة، وجلسة مستمرة تبدأ بلمستك. «إيقاف» يكتمها فقط، وتُغلق وحدها بعد 10 دقائق بلا استعمال
     (على غير iPhone تُغلق فورًا). البحث بالصوت والرصد بالصوت والاختبارات والرسائل كلها تتشارك الكائن نفسه.
   • النص على iPhone يطول في نتيجة واحدة مع كلامك: نعدّ الكلمات ونعطي الجديد فقط، ونعتمده بعد سكوت 1.3 ث. */
window.HWV = (function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const V = { rec: null, active: false, owner: null, n: {}, t: {}, pend: null, idleT: 0, offT: 0, err: '', ext: false, takeover: [] };
  const words = t => String(t || '').trim().split(/\s+/).filter(Boolean);
  function instance(fresh) {   // الكائن الوحيد (جديد فقط بعد تعطّله)
    if (!SR) return null;
    if (!V.rec || fresh) { const r = new SR(); r.lang = 'ar-SA'; r.interimResults = true; r.maxAlternatives = 1; r.continuous = true;
      r.addEventListener('start', () => { if (V.rec === r) V.active = true; }); r.addEventListener('end', () => { if (V.rec === r) V.active = false; }); V.rec = r; }
    return V.rec;
  }
  function commit() { const p = V.pend; V.pend = null; clearTimeout(V.idleT); if (!p) return; V.n[p.i] = p.len; const o = V.owner; if (o && o.on) o.onText(p.text, true); }
  function install(r) {
    r.onstart = () => { V.n = {}; V.t = {}; V.err = ''; };
    r.onresult = ev => { const o = V.owner, from = typeof ev.resultIndex === 'number' ? ev.resultIndex : 0;
      for (let i = from; i < ev.results.length; i++) { const res = ev.results[i]; if (!res) continue; const w = words(res[0] && res[0].transcript), pv = V.t[i];
        /* 🍎 iPhone يبدأ أحيانًا جملة جديدة في الخانة نفسها (النص يقصر ويتغيّر أوله): بدون هذا تُبتلع كل الكلمات الجديدة حتى يتجاوز عددها القديم */
        if (pv && w.length && (w.length < (V.n[i] || 0) || w.length < pv.length) && w[0] !== pv[0]) { V.n[i] = 0; if (V.onReset) try { V.onReset(i); } catch (e) {} }
        V.t[i] = w; const n = V.n[i] || 0;
        if (!o || !o.on) { V.n[i] = w.length; continue; }            // مكتوم: يُستهلك ولا يُعطى
        if (w.length <= n) continue; const text = w.slice(n).join(' ');
        if (res.isFinal) { V.pend = null; clearTimeout(V.idleT); V.n[i] = w.length; o.onText(text, true); }
        else { V.pend = { i, len: w.length, text }; o.onText(text, false); clearTimeout(V.idleT); V.idleT = setTimeout(commit, 1300); } } };
    r.onerror = e => { const err = (e && e.error) || ''; if (err === 'audio-capture') V.err = err; const o = V.owner; if (o && o.on && o.onError) o.onError(err); };
    r.onend = () => { commit(); const o = V.owner; if (o && o.on && o.onStop) { o.on = false; o.onStop('ended'); } };   // إعادة بلا لمسة = جلسة صمّاء: يعود الزر وتلمسه مجددًا
  }
  function claim(o, fromExt) {   // مالك جديد (لمسة): يوقف المالك السابق بأي جزء من الموقع
    clearTimeout(V.offT); commit();
    if (V.owner && V.owner !== o && V.owner.on) { V.owner.on = false; V.owner.onStop && V.owner.onStop('taken'); }
    if (!fromExt) V.takeover.forEach(f => { try { f(o); } catch (e) {} });   // الاختبارات/الرسائل تأخذه بنفسها فلا تُوقَف
  }
  function go(o) {   // تُستدعى داخل لمستك
    if (!SR) return false; claim(o); V.ext = false; V.owner = o; o.on = true; const r = instance(false); install(r);
    if (V.active) return true;
    const fresh = V.err === 'audio-capture'; V.err = '';
    try { instance(fresh).start(); if (fresh) install(V.rec); return true; }
    catch (e) { try { const r2 = instance(true); install(r2); r2.start(); return true; } catch (x) { o.on = false; return false; } }
  }
  function idle() {   // لا أحد يستمع: على iPhone تبقى الجلسة مكتومة 10 دقائق، وعلى غيره تُغلق الآن
    clearTimeout(V.offT); const stop = () => { if (!(V.owner && V.owner.on) && !V.ext && V.active) { try { V.rec.stop(); } catch (e) {} } };
    if (IOS) V.offT = setTimeout(stop, 600000); else setTimeout(stop, 0);
  }
  function mute(o) { commit(); if (o) o.on = false; idle(); }
  return { sup: !!SR, ios: IOS, go, mute, instance, idle, set onReset(f) { V.onReset = f; },
    get active() { return V.active; },
    /* للاختبارات والرسائل (VBI): يأخذ الكائن نفسه ويركّب معالجاته، ويوقف أي مالك آخر */
    adopt(fresh) { claim(null, true); V.owner = null; V.ext = true; return instance(fresh); },
    release() { V.ext = false; idle(); },
    onTakeover(f) { V.takeover.push(f); } };
})();

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
  let cur = null;   // { inp, btn, owner }
  function stop() { if (!cur) return; const c = cur; cur = null; clearTimeout(c.t); HWV.mute(c.owner); c.btn.classList.remove('on'); c.btn.setAttribute('aria-pressed', 'false'); }
  const clean = t => String(t || '').replace(/[.,،؟?!]+/g, ' ').replace(/^\s*(ابحث عن|ابحث|الطالب)\s+/, '').replace(/\s+/g, ' ').trim();
  function put(inp, text) {
    inp.value = text; inp.dispatchEvent(new Event('input', { bubbles: true }));
    try { inp.focus({ preventScroll: true }); inp.setSelectionRange(text.length, text.length); } catch (e) {}
  }
  function listen(inp, btn) {
    if (cur && cur.inp === inp) { stop(); return; } stop();
    const c = { inp, btn, t: 0 };
    c.owner = { on: false,
      onText: (t, final) => { const v = clean(t); if (v) { put(inp, v); clearTimeout(c.t); } if (final && v) stop(); },
      onStop: () => { if (cur === c) { cur = null; btn.classList.remove('on'); btn.setAttribute('aria-pressed', 'false'); } },
      onError: err => { if (err === 'not-allowed' || err === 'service-not-allowed') { try { toast('اسمح باستخدام الميكروفون من إعدادات المتصفح', 'bad'); } catch (e) {} stop(); } } };
    cur = c; btn.classList.add('on'); btn.setAttribute('aria-pressed', 'true');
    if (!HWV.go(c.owner)) { stop(); try { toast('تعذّر تشغيل الميكروفون — أغلق المتصفح وافتحه ثم حاول', 'bad'); } catch (e) {} return; }
    c.t = setTimeout(() => { if (cur === c) { stop(); try { toast('لم أسمع اسمًا — اضغط الميكروفون وقل اسم الطالب', 'warn'); } catch (e) {} } }, 9000);
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
