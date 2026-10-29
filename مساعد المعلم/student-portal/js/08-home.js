/* 🏠 الصفحة الرئيسية للطالب: تحية بحسب الوقت، والأرقام الثلاثة (إنجازي · نقاطي · ترتيبي)، وشريط تنقل سفلي للجوال
   وورقة «حسابي». طبقة فوق العناصر القائمة: تقرأ ما تعرضه الصفحة وتنقر أزرارها الأصلية — لا تكرر منطقها. */
(function(){
  const $id = id => document.getElementById(id);
  const HS = { pct:null, pts:null, rank:null };
  /* 🔀 الطالب يختار: التصميم الجديد (الافتراضي) أو القديم — محفوظ على جهازه */
  const isClassic = () => { try{ return localStorage.getItem('home_style') === 'classic'; }catch(e){ return false; } };
  function setStyle(classic){
    try{ if(classic) localStorage.setItem('home_style', 'classic'); else localStorage.removeItem('home_style'); }catch(e){}
    location.reload();
  }
  // في التصميم القديم: زر صغير بجانب «مظهري» و«لست أنا» للعودة للجديد
  function classicBtn(){
    const box = document.querySelector('#gate-space .sp-head-btns'); if(!box || box.querySelector('.hs-new-btn')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pt-gear hs-new-btn'; b.textContent = '✨ التصميم الجديد';
    b.onclick = () => setStyle(false); box.appendChild(b);
  }

  function hello(){
    const h = new Date().getHours();
    return h < 12 ? 'صباح الخير ☀️' : h < 18 ? 'مساء الخير 👋' : 'مساء الخير 🌙';
  }
  function headInit(){
    const g = $id('space-greeting'); if(!g || !g.parentElement) return;
    let s = g.parentElement.querySelector('.hs-hello');
    if(!s){ s = document.createElement('span'); s.className = 'hs-hello'; g.parentElement.insertBefore(s, g); }
    s.textContent = hello();
  }

  /* ── الأرقام الثلاثة ── */
  function num(t){ const m = String(t || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).match(/\d+/); return m ? Number(m[0]) : null; }
  function statsInit(){
    const card = $id('space-next-card'); if(!card || $id('hs-stats')) return;
    card.insertAdjacentHTML('afterend', `<div class="hs-stats" id="hs-stats">
      <button type="button" class="hs-stat" data-go="acts"><b id="hs-pct">—</b><small>إنجازي</small><i><em id="hs-pct-bar"></em></i></button>
      <button type="button" class="hs-stat" data-go="store"><b id="hs-pts">—</b><small>نقاطي ⭐</small></button>
      <button type="button" class="hs-stat" data-go="board"><b id="hs-rank">—</b><small>ترتيبي 🏆</small></button></div>`);
    $id('hs-stats').querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
    statsDraw();
  }
  function statsDraw(){
    const p = $id('space-progress-pct'), bal = $id('gate-bal');
    const pct = p ? num(p.textContent) : null;
    const pts = bal && bal.textContent.trim() ? num(bal.textContent) : null;
    const set = (id, v) => { const e = $id(id); if(e) e.textContent = v; };
    set('hs-pct', pct == null ? '—' : pct + '%');
    const bar = $id('hs-pct-bar'); if(bar) bar.style.setProperty('--p', (pct || 0) + '%');
    set('hs-pts', pts == null ? '—' : pts.toLocaleString('en-US'));
    const R = window.__hsRank;
    set('hs-rank', R && R.r ? '#' + R.r : '—');
  }

  /* ── التنقل ── */
  function scrollTo(el){ if(el) el.scrollIntoView({ behavior:'smooth', block:'start' }); }
  function go(k){
    closeSheet();
    if(k === 'home'){ window.scrollTo({ top:0, behavior:'smooth' }); setOn('home'); return; }
    if(k === 'acts'){
      const list = $id('gate-list'), t = $id('all-activities-toggle');
      if(list && list.classList.contains('hide') && t) t.click();
      scrollTo($id('all-activities-panel')); setOn('acts'); return;
    }
    if(k === 'board'){ scrollTo($id('gate-board')); setOn('board'); return; }
    if(k === 'store'){
      const box = $id('gate-store-box'), t = $id('gate-store-toggle');
      if(box && box.classList.contains('hide') && t && !t.disabled) t.click();
      scrollTo($id('gate-store').classList.contains('hide') ? $id('gate-bal') : $id('gate-store')); setOn('store'); return;
    }
    if(k === 'me') openSheet();
  }
  function setOn(k){ document.querySelectorAll('.hs-nav [data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === k)); }

  function navInit(){
    if($id('hs-nav')) return;
    const n = document.createElement('nav'); n.id = 'hs-nav'; n.className = 'hs-nav'; n.setAttribute('aria-label', 'التنقل');
    n.innerHTML = [['home','🏠','الرئيسية'],['acts','📋','أنشطتي'],['board','🏆','الصدارة'],['store','🛒','المتجر'],['me','👤','حسابي']]
      .map(([k, i, t]) => `<button type="button" data-nav="${k}" class="${k === 'home' ? 'on' : ''}"><i>${i}</i>${t}${k === 'acts' ? '<span class="hs-bdg" id="hs-acts-bdg" hidden></span>' : ''}</button>`).join('');
    document.body.appendChild(n);
    n.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => go(b.dataset.nav));
  }
  // يظهر الشريط في الصفحة الرئيسية فقط (لا أثناء حل نشاط أو داخل لعبة أو مراجعة)
  function navVisible(){
    const gate = $id('s-gate'), sp = $id('gate-space');
    const on = !!(gate && sp && !gate.classList.contains('hide') && !sp.classList.contains('hide') && !document.body.classList.contains('rev-mode'));
    document.documentElement.classList.toggle('hs-nav-on', on);
  }
  // عدد الأنشطة المطلوبة الآن على «أنشطتي»
  function badge(){
    const b = $id('hs-acts-bdg'); if(!b) return;
    let n = 0;
    try{
      const t = typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10);
      n = (Array.isArray(window.__journeyRows) ? window.__journeyRows : []).filter(h => h && !h.remedial && !h.done
        && !(typeof isPureGameRow === 'function' && isPureGameRow(h)) && (typeof gateActionable === 'function' ? gateActionable(h, t) : true)).length;
    }catch(e){}
    b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n);
  }
  // القسم الظاهر يضيء في الشريط أثناء التمرير
  let scT = 0;
  function onScroll(){
    clearTimeout(scT); scT = setTimeout(() => {
      if(!document.documentElement.classList.contains('hs-nav-on') || $id('hs-sheet')) return;
      const marks = [['acts', $id('all-activities-panel')], ['board', $id('gate-board')], ['store', $id('gate-bal')]];
      let cur = 'home'; const y = window.innerHeight * 0.45;
      for(const [k, el] of marks){ if(el && el.offsetParent && el.getBoundingClientRect().top < y) cur = k; }
      if(window.scrollY < 80) cur = 'home';
      setOn(cur);
    }, 80);
  }

  /* ── 🧩 ترتيب الصفحة: الطالب يرتّب الأقسام ويخفي ما لا يحتاجه (على جهازه). لا تُنقل العناصر في الصفحة —
     الترتيب بصريًا (CSS order) فلا يتأثر أي منطق يعتمد عليها. الأقسام الأساسية لا تُخفى. ── */
  const BLOCKS = [
    { k:'review',  t:'🔎 مهام التصحيح وفرص التحسين', lock:1, el:() => [$id('space-review')] },
    { k:'ann',     t:'📢 إعلانات المعلم',            lock:1, el:() => [$id('space-ann')] },
    { k:'acts',    t:'📚 جميع أنشطتي',               lock:1, el:() => [$id('all-activities-panel')] },
    { k:'notices', t:'🔔 التنبيهات',                 lock:1, el:() => [document.querySelector('#gate-space .space-notices')] },
    { k:'plan',    t:'🎯 خطتي العلاجية',             lock:1, el:() => [$id('space-plan')] },
    { k:'journey', t:'🗺️ رحلتي التعليمية',                  el:() => [$id('student-journey'), $id('journey-workspace')] },
    { k:'board',   t:'🏆 الصدارة',                          el:() => [$id('gate-board')] },
    { k:'store',   t:'🛒 المتجر',                           el:() => [$id('gate-bal'), $id('gate-store')] },
    { k:'walls',   t:'🧱 حائط الإبداع',                     el:() => [$id('space-walls')] },
    { k:'certs',   t:'🏅 شهاداتي',                          el:() => [$id('space-certs')] },
    { k:'report',  t:'📄 تقريري',                           el:() => [$id('my-report-panel')] },
    { k:'ask',     t:'💬 اسأل معلمك',                       el:() => [$id('space-ask')] },
  ];
  const LAY_KEY = 'home_layout_v1';
  function layGet(){
    let L = null; try{ L = JSON.parse(localStorage.getItem(LAY_KEY) || 'null'); }catch(e){}
    const keys = BLOCKS.map(b => b.k), o = (L && Array.isArray(L.o) ? L.o : []).filter(k => keys.includes(k));
    keys.forEach(k => { if(!o.includes(k)) o.push(k); });     // قسم جديد يُضاف في آخره
    const h = (L && Array.isArray(L.h) ? L.h : []).filter(k => keys.includes(k) && !BLOCKS.find(b => b.k === k).lock);
    return { o, h };
  }
  function laySave(L){ try{ localStorage.setItem(LAY_KEY, JSON.stringify(L)); }catch(e){} layApply(); }
  function layApply(){
    const L = layGet();
    const fixed = [[document.querySelector('#s-gate > .sheet:not(#gate-space)'), 0], [document.querySelector('#gate-space .student-space-head'), 1],
      [document.querySelector('#gate-space .now-compact'), 2], [$id('live-card'), 3]];
    fixed.forEach(([el, n]) => { if(el) el.style.order = n; });
    L.o.forEach((k, i) => { const b = BLOCKS.find(x => x.k === k); (b.el() || []).forEach(el => { if(!el) return; el.style.order = 10 + i * 10; el.classList.toggle('hs-off', L.h.includes(k)); }); });
    // قسم مخفي ⇒ زره في الشريط السفلي يختفي أيضًا
    [['board', 'board'], ['store', 'store']].forEach(([k, nav]) => { const b = document.querySelector(`.hs-nav [data-nav="${nav}"]`); if(b) b.hidden = L.h.includes(k); });
  }
  function openOrder(){
    closeSheet();
    const draw = () => {
      const L = layGet();
      const s = $id('hs-sheet') || Object.assign(document.createElement('div'), { id:'hs-sheet', className:'hs-sheet' });
      s.innerHTML = `<div class="hs-pan" role="dialog" aria-label="ترتيب صفحتي"><div class="hs-grab"></div>
        <div class="hs-ord-h"><b>🧩 ترتيب صفحتي</b><small>رتّب الأقسام بالأسهم، وأخفِ ما لا تحتاجه. 🔒 الأقسام الأساسية لا تُخفى.</small></div>
        <div class="hs-ord">${L.o.map((k, i) => { const b = BLOCKS.find(x => x.k === k), off = L.h.includes(k);
          return `<div class="hs-ord-row${off ? ' off' : ''}"><span class="hs-ord-n">${i + 1}</span><span class="hs-ord-t">${b.t}</span>
            <button type="button" data-up="${k}" ${i ? '' : 'disabled'} aria-label="لأعلى">↑</button><button type="button" data-dn="${k}" ${i < L.o.length - 1 ? '' : 'disabled'} aria-label="لأسفل">↓</button>
            ${b.lock ? '<span class="hs-ord-lock" title="قسم أساسي">🔒</span>' : `<button type="button" class="hs-eye" data-eye="${k}" aria-label="${off ? 'إظهار' : 'إخفاء'}">${off ? '🙈' : '👁️'}</button>`}</div>`; }).join('')}</div>
        <div class="hs-ord-foot"><button type="button" class="hs-ord-reset" data-reset>↩ الترتيب الافتراضي</button><button type="button" class="hs-ord-done" data-done>تم ✓</button></div></div>`;
      if(!s.parentNode){ document.body.appendChild(s); s.onclick = e => { if(e.target === s){ closeSheet(); onScroll(); } }; }
      const mv = (k, d) => { const L2 = layGet(), i = L2.o.indexOf(k), j = i + d; if(j < 0 || j >= L2.o.length) return; [L2.o[i], L2.o[j]] = [L2.o[j], L2.o[i]]; laySave(L2); draw(); };
      s.querySelectorAll('[data-up]').forEach(b => b.onclick = () => mv(b.dataset.up, -1));
      s.querySelectorAll('[data-dn]').forEach(b => b.onclick = () => mv(b.dataset.dn, 1));
      s.querySelectorAll('[data-eye]').forEach(b => b.onclick = () => { const L2 = layGet(), k = b.dataset.eye; L2.h = L2.h.includes(k) ? L2.h.filter(x => x !== k) : [...L2.h, k]; laySave(L2); draw(); });
      s.querySelector('[data-reset]').onclick = () => { try{ localStorage.removeItem(LAY_KEY); }catch(e){} layApply(); draw(); };
      s.querySelector('[data-done]').onclick = () => { closeSheet(); onScroll(); };
    };
    draw(); setOn('me');
  }
  // «جميع أنشطتي» مفتوحة عند الدخول (مرة واحدة)، و«رحلتي» مختصرة تُفتح بالضغط
  let actsOpened = false;
  function actsOpen(){
    if(actsOpened) return; const list = $id('gate-list'), t = $id('all-activities-toggle'), p = $id('all-activities-panel');
    if(!list || !t || !p || p.classList.contains('hide')) return;
    actsOpened = true; if(list.classList.contains('hide')){ const y = window.scrollY; t.click(); window.scrollTo(0, y); }
  }
  function journeyInit(){
    const j = $id('student-journey'), h = j && j.querySelector('.journey-head'); if(!h || h.dataset.hs) return;
    h.dataset.hs = '1'; h.setAttribute('role', 'button'); h.tabIndex = 0;
    const tg = () => j.classList.toggle('hs-open'); h.addEventListener('click', tg); h.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); tg(); } });
  }

  /* ── ورقة «حسابي» ── */
  function closeSheet(){ const s = $id('hs-sheet'); if(s) s.remove(); }
  function openSheet(){
    closeSheet(); setOn('me');
    const av = document.querySelector('#gate-space .student-space-head .avatar');
    const nm = ($id('space-greeting') || {}).textContent || '';
    const s = document.createElement('div'); s.id = 'hs-sheet'; s.className = 'hs-sheet';
    const item = (k, i, t, sub, cls) => `<button type="button" class="hs-item ${cls || ''}" data-me="${k}"><i>${i}</i><span>${t}${sub ? `<small>${sub}</small>` : ''}</span></button>`;
    s.innerHTML = `<div class="hs-pan" role="dialog" aria-label="حسابي"><div class="hs-grab"></div>
      <div class="hs-who"><span class="avatar">${av ? av.innerHTML : '🎓'}</span><div><b>${nm.replace(/^أهلاً\s*/, '').replace(/[👋]/g, '').trim() || 'حسابي'}</b><small>${hello()}</small></div></div>
      ${item('theme', '🎨', 'مظهري', 'الألوان والصورة والإطار')}
      ${item('report', '📄', 'تقريري', 'تقرير الأسبوع وتقرير الفترة')}
      ${item('notes', '🔔', 'التنبيهات', 'الرسائل والتحديثات')}
      ${item('order', '🧩', 'ترتيب صفحتي', 'رتّب الأقسام وأخفِ ما لا تحتاجه')}
      ${item('old', '↩️', 'التصميم القديم', 'ارجع لشكل البوابة السابق — وتعود للجديد متى شئت')}
      ${item('switch', '👥', 'لست أنا', 'تسجيل الخروج والدخول باسم آخر', 'warn')}</div>`;
    document.body.appendChild(s);
    s.onclick = e => { if(e.target === s){ closeSheet(); onScroll(); } };
    s.querySelectorAll('[data-me]').forEach(b => b.onclick = () => {
      const k = b.dataset.me; closeSheet(); onScroll();
      if(k === 'theme'){ const x = $id('pt-open'); if(x) x.click(); }
      else if(k === 'report'){ const p = $id('my-report-panel'), box = $id('my-report-box'), t = $id('my-report-toggle');
        if(box && box.classList.contains('hide') && t) t.click(); scrollTo(p); }
      else if(k === 'notes') scrollTo(document.querySelector('#gate-space .space-notices'));
      else if(k === 'old') setStyle(true);
      else if(k === 'order') openOrder();
      else if(k === 'switch'){ const x = document.querySelector('#gate-space .sp-switch'); if(x) x.click(); }
    });
  }

  function init(){
    if(isClassic()){   // التصميم القديم كما كان: بلا شريط ولا أرقام ولا تحية — فقط زر العودة للجديد
      classicBtn();
      const sp = $id('gate-space'); if(sp) new MutationObserver(classicBtn).observe(sp, { attributes:true, attributeFilter:['class'], childList:true, subtree:true });
      window.hsGo = () => {}; return;
    }
    headInit(); statsInit(); navInit(); navVisible(); badge(); layApply(); journeyInit();
    const mo = (el, fn, opt) => { if(el) new MutationObserver(fn).observe(el, opt); };
    mo($id('s-gate'), navVisible, { attributes:true, attributeFilter:['class'] });
    mo($id('gate-space'), () => { navVisible(); headInit(); statsInit(); }, { attributes:true, attributeFilter:['class'] });
    mo(document.body, navVisible, { attributes:true, attributeFilter:['class'] });
    mo($id('space-progress-pct'), statsDraw, { childList:true, characterData:true, subtree:true });
    mo($id('gate-bal'), statsDraw, { childList:true, characterData:true, subtree:true });
    mo($id('all-activities-count'), () => { badge(); actsOpen(); }, { childList:true, characterData:true, subtree:true });
    mo($id('student-journey'), journeyInit, { childList:true, subtree:true });
    document.addEventListener('hs-rank', statsDraw);
    window.addEventListener('scroll', onScroll, { passive:true });
    document.addEventListener('keydown', e => { if(e.key === 'Escape') closeSheet(); });
    setInterval(() => { headInit(); badge(); }, 60000);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.hsGo = go;
})();
