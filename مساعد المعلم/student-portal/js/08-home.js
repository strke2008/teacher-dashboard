/* 🏠 الصفحة الرئيسية للطالب: تحية بحسب الوقت، والأرقام الثلاثة (إنجازي · نقاطي · ترتيبي)، وشريط تنقل سفلي للجوال
   وورقة «حسابي». طبقة فوق العناصر القائمة: تقرأ ما تعرضه الصفحة وتنقر أزرارها الأصلية — لا تكرر منطقها. */
(function(){
  const $id = id => document.getElementById(id);
  const HS = { pct:null, pts:null, rank:null };
  /* 🔀 الطالب يختار: التصميم الجديد (الافتراضي) أو القديم — محفوظ على جهازه */
  const isClassic = () => { try{ return localStorage.getItem('home_style') === 'classic'; }catch(e){ return false; } };
  async function setStyle(classic){
    try{ if(classic) localStorage.setItem('home_style', 'classic'); else localStorage.removeItem('home_style'); }catch(e){}
    try{ const L = layRead(); layWrite({ ...L, at: Date.now() }); await layPush(); }catch(e){}   // التصميم يتبعه على أجهزته
    location.reload();
  }
  /* ☁️ الترتيب والتصميم في الخادم (مربوطان بجلسة الطالب): يطبَّق على كل أجهزته، والأحدث يغلب */
  const LAY_KEY = 'home_layout_v1';
  const sidNow = () => { try{ return String(mySid || ''); }catch(e){ return ''; } };
  function layRead(){ let L = null; try{ L = JSON.parse(localStorage.getItem(LAY_KEY) || 'null'); }catch(e){}
    return L && typeof L === 'object' && (!L.sid || L.sid === sidNow()) ? L : {}; }   // ترتيب أخٍ على الجهاز نفسه لا يُطبَّق
  function layWrite(L){ try{ localStorage.setItem(LAY_KEY, JSON.stringify({ ...L, sid: sidNow() })); }catch(e){} }
  function layApi(){ try{ return typeof ptApi === 'function' ? ptApi() : ''; }catch(e){ return ''; } }
  function laySession(){ try{ return typeof getStoreSession === 'function' ? getStoreSession() : ''; }catch(e){ return ''; } }
  let layPushT = 0;
  function layPush(){
    const api = layApi(), tok = laySession(); if(!api || !tok) return Promise.resolve();
    const L = layRead();
    return fetch(api + '/home-layout', { method:'POST', keepalive:true, headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ session: tok, op:'set', layout:{ o: L.o || [], h: L.h || [], ...(Array.isArray(L.nav) ? { nav: L.nav } : {}), at: Number(L.at) || Date.now(), style: isClassic() ? 'classic' : 'new' } }) }).catch(() => {});
  }
  let laySynced = '';
  async function laySync(){
    const sid = sidNow(), api = layApi(), tok = laySession(); if(!sid || !api || !tok || laySynced === sid) return;
    laySynced = sid;
    try{
      const j = await (await fetch(api + '/home-layout', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ session: tok, op:'get' }) })).json();
      if(!j || !j.ok || sidNow() !== sid) return;
      const S = j.layout, L = layRead();
      if(S && (!L.at || Number(S.at) > Number(L.at))){
        layWrite({ o: S.o, h: S.h, ...(Array.isArray(S.nav) ? { nav: S.nav } : {}), at: S.at });
        const wantClassic = S.style === 'classic';
        if(wantClassic !== isClassic()){ try{ if(wantClassic) localStorage.setItem('home_style', 'classic'); else localStorage.removeItem('home_style'); }catch(e){} location.reload(); return; }
        if(!isClassic()){ layApply(); navBuild(); }
      } else if(L.at && (!S || Number(L.at) > Number(S.at))) layPush();   // تعديل على هذا الجهاز لم يصل الخادم بعد
    }catch(e){ laySynced = ''; }
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
    if(k === 'notes'){ scrollTo(document.querySelector('#gate-space .space-notices')); setOn('notes'); return; }
    if(k === 'report'){ const box = $id('my-report-box'), t = $id('my-report-toggle'); if(box && box.classList.contains('hide') && t) t.click(); scrollTo($id('my-report-panel')); setOn('report'); return; }
    if(k === 'journey'){ scrollTo($id('hs-jmap')); setOn('journey'); return; }
    if(k === 'walls'){
      const w = $id('space-walls');
      if(!w || !w.children.length){ if(typeof toast === 'function') toast('لا يوجد حائط إبداع مفتوح لفصلك الآن'); setOn('home'); return; }
      scrollTo(w); setOn('walls'); return;
    }
    if(k === 'me') openSheet();
  }
  function setOn(k){ document.querySelectorAll('.hs-nav [data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === k)); }

  /* 📱 الشريط السفلي يحدده الطالب: «الرئيسية» أوله و«حسابي» آخره دائمًا، وما بينهما يختاره (حتى 4) —
     وما لم يختره يظهر داخل «حسابي». الافتراضي: أنشطتي · التنبيهات · تقريري · الصدارة */
  const NAV_POOL = [['acts','📋','أنشطتي','كل أنشطتك والمطلوب منك'],['notes','🔔','التنبيهات','الرسائل والتحديثات'],['report','📄','تقريري','تقرير الأسبوع وتقرير الفترة'],
    ['board','🏆','الصدارة','فصلي · كل الفصول · الفصول'],['store','🛒','المتجر','بطاقات بنقاطك'],['journey','🗺️','رحلتي','خريطة مسارك'],['walls','🧱','الإبداع','حائط الإبداع وأعمال زملائك']];
  const NAV_DEF = ['acts','notes','report','board'], NAV_MAX = 4;
  const navPick = () => layGet().nav;
  function navInit(){
    if($id('hs-nav')) return;
    const n = document.createElement('nav'); n.id = 'hs-nav'; n.className = 'hs-nav'; n.setAttribute('aria-label', 'التنقل');
    document.body.appendChild(n); navBuild();
  }
  function navBuild(){
    const n = $id('hs-nav'); if(!n) return;
    const cur = (n.querySelector('.on') || {}).dataset?.nav || 'home';
    const items = [['home','🏠','الرئيسية'], ...navPick().map(k => NAV_POOL.find(x => x[0] === k)), ['me','👤','حسابي']];
    n.classList.toggle('n6', items.length > 5);
    n.innerHTML = items.map(([k, i, t]) => `<button type="button" data-nav="${k}" class="${k === cur ? 'on' : ''}"><i>${i}</i>${t}<span class="hs-bdg" id="hs-${k}-bdg" hidden></span></button>`).join('');
    n.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => go(b.dataset.nav));
    try{ badge(); meBadge(); layHideNav(); }catch(e){}
  }
  function openNavCfg(){
    closeSheet();
    const draw = () => {
      const pick = navPick(), s = $id('hs-sheet') || Object.assign(document.createElement('div'), { id:'hs-sheet', className:'hs-sheet' });
      const row = ([k, i, t, sub], on, idx) => `<div class="hs-ord-row${on ? '' : ' hs-nav-avail'}"><span class="hs-ord-n">${on ? idx + 1 : ''}</span><span class="hs-ord-t">${i} ${t}<small class="hs-nav-sub">${sub}</small></span>
        ${on ? `<button type="button" data-nup="${k}" ${idx ? '' : 'disabled'} aria-label="لأعلى">↑</button><button type="button" data-ndn="${k}" ${idx < pick.length - 1 ? '' : 'disabled'} aria-label="لأسفل">↓</button><button type="button" data-nrm="${k}" aria-label="إزالة من الشريط">✕</button>`
          : `<button type="button" class="hs-nav-add" data-nadd="${k}" ${pick.length >= NAV_MAX ? 'disabled' : ''}>＋ أضف</button>`}</div>`;
      s.innerHTML = `<div class="hs-pan" role="dialog" aria-label="أزرار الشريط"><div class="hs-grab"></div>
        <div class="hs-ord-h"><b>📱 أزرار الشريط السفلي</b><small>«الرئيسية» و«حسابي» ثابتان، واختر بينهما حتى ${NAV_MAX} أزرار. ما لا تختاره تجده داخل «حسابي».</small></div>
        <div class="hs-navpv">${[['home','🏠','الرئيسية'], ...pick.map(k => NAV_POOL.find(x => x[0] === k)), ['me','👤','حسابي']].map(([k, i, t]) => `<span><i>${i}</i>${t}</span>`).join('')}</div>
        <div class="hs-ord">${pick.map((k, i) => row(NAV_POOL.find(x => x[0] === k), true, i)).join('')}
          ${NAV_POOL.some(x => !pick.includes(x[0])) ? `<div class="hs-nav-grp">＋ أضف إلى الشريط</div>` : ''}
          ${NAV_POOL.filter(x => !pick.includes(x[0])).map(x => row(x, false)).join('')}</div>
        ${pick.length >= NAV_MAX ? '<p class="hs-nav-full">الشريط ممتلئ — أزل زرًّا لتضيف غيره</p>' : ''}
        <div class="hs-ord-foot"><button type="button" class="hs-ord-reset" data-nreset>↩ الافتراضي</button><button type="button" class="hs-ord-done" data-done>تم ✓</button></div></div>`;
      if(!s.parentNode){ document.body.appendChild(s); s.onclick = e => { if(e.target === s){ closeSheet(); onScroll(); } }; }
      const save = nav => { const L = layGet(); laySave({ ...L, nav }); draw(); };
      const mv = (k, d) => { const p = navPick(), i = p.indexOf(k), j = i + d; if(j < 0 || j >= p.length) return; [p[i], p[j]] = [p[j], p[i]]; save(p); };
      s.querySelectorAll('[data-nup]').forEach(b => b.onclick = () => mv(b.dataset.nup, -1));
      s.querySelectorAll('[data-ndn]').forEach(b => b.onclick = () => mv(b.dataset.ndn, 1));
      s.querySelectorAll('[data-nrm]').forEach(b => b.onclick = () => save(navPick().filter(x => x !== b.dataset.nrm)));
      s.querySelectorAll('[data-nadd]').forEach(b => b.onclick = () => { const p = navPick(); if(p.length < NAV_MAX) save([...p, b.dataset.nadd]); });
      s.querySelector('[data-nreset]').onclick = () => save(NAV_DEF.slice());
      s.querySelector('[data-done]').onclick = () => { closeSheet(); onScroll(); };
    };
    draw(); setOn('me');
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
      const el = { acts: $id('all-activities-panel'), board: $id('gate-board'), store: $id('gate-store'), notes: document.querySelector('#gate-space .space-notices'), report: $id('my-report-panel'), journey: $id('hs-jmap'), walls: $id('space-walls') };
      const marks = navPick().map(k => [k, el[k]]);
      // القسم الأقرب فوق منتصف الشاشة (لا آخر قسم في ترتيب الشريط)
      let cur = 'home', best = -Infinity; const y = window.innerHeight * 0.45;
      for(const [k, el] of marks){ if(!el || !el.offsetParent) continue; const t = el.getBoundingClientRect().top; if(t < y && t > best){ best = t; cur = k; } }
      if(window.scrollY < 80) cur = 'home';
      setOn(cur);
    }, 80);
  }

  /* ── 🧩 ترتيب الصفحة: الطالب يرتّب الأقسام ويخفي ما لا يحتاجه (على جهازه). لا تُنقل العناصر في الصفحة —
     الترتيب بصريًا (CSS order) فلا يتأثر أي منطق يعتمد عليها. الأقسام الأساسية لا تُخفى. ── */
  const BLOCKS = [
    { k:'journey', t:'🗺️ رحلتي (خريطة المسار)',            el:() => [$id('hs-jmap'), $id('journey-workspace')] },
    { k:'review',  t:'🔎 مهام التصحيح وفرص التحسين', lock:1, el:() => [$id('space-review')] },
    { k:'ann',     t:'📢 إعلانات المعلم',            lock:1, el:() => [$id('space-ann')] },
    { k:'acts',    t:'📚 جميع أنشطتي',               lock:1, el:() => [$id('all-activities-panel')] },
    { k:'notices', t:'🔔 التنبيهات',                 lock:1, el:() => [document.querySelector('#gate-space .space-notices')] },
    { k:'plan',    t:'🎯 خطتي العلاجية',             lock:1, el:() => [$id('space-plan')] },
    { k:'board',   t:'🏆 الصدارة',                          el:() => [$id('gate-board')] },
    { k:'store',   t:'🛒 المتجر',                           el:() => [$id('gate-bal'), $id('gate-store')] },
    { k:'walls',   t:'🧱 حائط الإبداع',                     el:() => [$id('space-walls')] },
    { k:'certs',   t:'🏅 شهاداتي',                          el:() => [$id('space-certs')] },
    { k:'report',  t:'📄 تقريري',                           el:() => [$id('my-report-panel')] },
    { k:'ask',     t:'💬 اسأل معلمك',                       el:() => [$id('space-ask')] },
  ];
  function layGet(){
    const L = layRead();
    const keys = BLOCKS.map(b => b.k), o = (L && Array.isArray(L.o) ? L.o : []).filter(k => keys.includes(k));
    keys.forEach(k => { if(!o.includes(k)) o.push(k); });     // قسم جديد يُضاف في آخره
    const h = (L && Array.isArray(L.h) ? L.h : []).filter(k => keys.includes(k) && !BLOCKS.find(b => b.k === k).lock);
    const nav = Array.isArray(L.nav) ? L.nav.filter(k => NAV_POOL.some(x => x[0] === k)).slice(0, NAV_MAX) : NAV_DEF.slice();
    return { o, h, nav };
  }
  function laySave(L){ layWrite({ o: L.o, h: L.h, nav: L.nav, at: Date.now() }); layApply(); navBuild(); clearTimeout(layPushT); layPushT = setTimeout(layPush, 700); }
  function layApply(){
    const L = layGet();
    const fixed = [[document.querySelector('#s-gate > .sheet:not(#gate-space)'), 0], [document.querySelector('#gate-space .student-space-head'), 1],
      [document.querySelector('#gate-space .now-compact'), 2], [$id('live-card'), 3]];
    fixed.forEach(([el, n]) => { if(el) el.style.order = n; });
    L.o.forEach((k, i) => { const b = BLOCKS.find(x => x.k === k); (b.el() || []).forEach(el => { if(!el) return; el.style.order = 10 + i * 10; el.classList.toggle('hs-off', L.h.includes(k)); }); });
    // قسم مخفي ⇒ زره في الشريط السفلي يختفي أيضًا
    layHideNav();
  }
  // قسم مخفي من «ترتيب صفحتي» ⇒ زرّه في الشريط يختفي (الصدارة/المتجر/رحلتي)
  function layHideNav(){ const L = layGet(); ['board','store','journey','walls'].forEach(k => { const b = document.querySelector(`.hs-nav [data-nav="${k}"]`); if(b) b.hidden = L.h.includes(k); }); }
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
      s.querySelector('[data-reset]').onclick = () => { laySave({ o: BLOCKS.map(b => b.k), h: [] }); draw(); };
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
  /* 🗺️ «رحلتي» خريطة مسار: المراحل نقاط على طريق واحد، الحالية نابضة، وسطر «خطوتك الآن» بزر «انطلق».
     تُقرأ من بطاقة الرحلة الأصلية (تبقى مخفية) ويضغط كل نقطة زرّها الأصلي — منطق الرحلة كما هو. */
  const JM_SHORT = { 'اكتشف طريقة تعلمك':'طريقتي', 'اعرف مستواك':'مستواي', 'ابدأ رحلة التعلم':'أتعلّم', 'طبّق وجرّب':'أجرّب', 'نافس':'نافس', 'الألعاب':'ألعب', 'طوّر مستواك':'أتطوّر' };
  function jmapDraw(){
    const src = $id('student-journey'), anchor = $id('gate-space'); if(!src || !anchor) return;
    let box = $id('hs-jmap');
    if(!box){ box = document.createElement('section'); box.id = 'hs-jmap'; box.className = 'hs-jmap'; box.setAttribute('aria-label', 'رحلتي');
      const after = $id('student-journey'); after.parentNode.insertBefore(box, after); layApply(); }
    const steps = [...src.querySelectorAll('#journey-steps .journey-step')];
    box.classList.toggle('hide', src.classList.contains('hide') || !steps.length);
    if(!steps.length) return;
    const D = steps.map(el => ({ el, t: (el.querySelector('.js-title')?.textContent || '').trim().replace(/^[0-9٠-٩]+[.)]\s*/, ''),
      ic: (el.querySelector('.js-icon')?.childNodes[0]?.textContent || '').trim(), note: (el.querySelector('.js-note')?.textContent || '').trim(),
      done: el.classList.contains('done'), cur: el.classList.contains('current'), wait: el.classList.contains('wait'), bd: el.querySelector('.js-badge')?.textContent || '' }));
    let ci = D.findIndex(x => x.cur); if(ci < 0) ci = D.findIndex(x => !x.done && !x.wait);
    const reach = Math.max(D.map(x => x.done).lastIndexOf(true), ci), w = reach > 0 ? reach / (D.length - 1) : 0, cur = D[ci];
    const pct = ($id('journey-percent') || {}).textContent || '';
    box.innerHTML = `<div class="jm-h"><b>🗺️ رحلتي</b><span>${pct}</span></div>
      <div class="jm-road" style="--w:${w}"><i></i>${D.map((x, i) => `<button type="button" class="jm-n ${x.done ? 'done' : i === ci ? 'cur' : x.wait ? 'wait' : ''}" data-jm="${i}" aria-label="${x.t}${x.done ? ' — مكتملة' : i === ci ? ' — خطوتك الآن' : x.wait ? ' — قريبًا' : ''}"><em>${x.done ? '✓' : x.ic}${x.bd && !x.done ? `<b class="bd">${x.bd}</b>` : ''}</em><small>${JM_SHORT[x.t] || x.t}</small></button>`).join('')}</div>
      ${cur ? `<div class="jm-now"><div><b>📍 خطوتك الآن: ${cur.t}</b>${cur.bd ? `عندك ${cur.bd} ${+cur.bd === 1 ? 'نشاط ينتظرك' : 'أنشطة تنتظرك'} هنا` : (cur.note || 'الخطوة التالية في رحلتك')}</div><button type="button" class="jm-go" data-jm="${ci}">انطلق ←</button></div>`
        : `<div class="jm-now done"><div><b>🌟 أكملت رحلتك حتى الآن</b>واصل — كل مرحلة جديدة تظهر هنا</div></div>`}`;
    box.querySelectorAll('[data-jm]').forEach(b => b.onclick = () => {
      const x = D[+b.dataset.jm]; if(!x) return;
      if(x.el.onclick){ x.el.click(); return; }
      try{ toast(x.note || (x.wait ? 'هذه المرحلة تُفتح لاحقًا' : x.t)); }catch(e){}
    });
  }
  function journeyInit(){
    const j = $id('student-journey'), h = j && j.querySelector('.journey-head'); if(!h || h.dataset.hs) return;
    h.dataset.hs = '1'; h.setAttribute('role', 'button'); h.tabIndex = 0;
    const tg = () => j.classList.toggle('hs-open'); h.addEventListener('click', tg); h.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); tg(); } });
  }

  /* 🔴 الجديد في «حسابي»: رسائل التنبيهات غير المقروءة + تقرير أسبوع/فترة جديد — على الزر وداخل الورقة */
  function meCounts(){
    const shown = id => { const e = $id(id); return !!(e && !e.classList.contains('hide')); };
    const un = $id('space-unread');
    const wl = $id('space-walls');
    return { notes: un && !un.classList.contains('hide') ? (num(un.textContent) || 0) : 0, report: (shown('my-report-new') ? 1 : 0) + (shown('my-report-new-p') ? 1 : 0),
      walls: wl ? wl.querySelectorAll('.wall-tile .new').length : 0 };   // حوائط فيها منشورات جديدة
  }
  function meBadge(){
    const c = meCounts(), pick = navPick(), set = (id, v) => { const b = $id(id); if(b){ b.hidden = !v; b.textContent = v > 9 ? '9+' : String(v); } };
    set('hs-notes-bdg', c.notes); set('hs-report-bdg', c.report); set('hs-walls-bdg', c.walls);
    set('hs-me-bdg', (pick.includes('notes') ? 0 : c.notes) + (pick.includes('report') ? 0 : c.report) + (pick.includes('walls') ? 0 : c.walls));   // «حسابي» يعدّ ما ليس على الشريط
    const sh = $id('hs-sheet'); if(!sh) return;
    [['notes', c.notes], ['report', c.report], ['walls', c.walls]].forEach(([k, v]) => { const it = sh.querySelector(`[data-me="go:${k}"]`); if(!it) return;
      let d = it.querySelector('.hs-item-bdg'); if(!v){ if(d) d.remove(); return; }
      if(!d){ d = document.createElement('b'); d.className = 'hs-item-bdg'; it.appendChild(d); } d.textContent = v > 9 ? '9+' : String(v); });
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
      ${NAV_POOL.filter(x => !navPick().includes(x[0]) && x[0] !== 'acts' && !(layGet().h.includes(x[0]))).map(([k, i, t, sub]) => item('go:' + k, i, t, sub)).join('')}
      ${item('theme', '🎨', 'مظهري', 'الألوان والصورة والإطار')}
      ${item('order', '🧩', 'ترتيب صفحتي', 'رتّب الأقسام وأخفِ ما لا تحتاجه')}
      ${item('navcfg', '📱', 'أزرار الشريط السفلي', 'اختر ما يظهر في الشريط')}
      ${item('old', '↩️', 'التصميم القديم', 'ارجع لشكل البوابة السابق — وتعود للجديد متى شئت')}
      ${item('switch', '👥', 'لست أنا', 'تسجيل الخروج والدخول باسم آخر', 'warn')}</div>`;
    document.body.appendChild(s); meBadge();
    s.onclick = e => { if(e.target === s){ closeSheet(); onScroll(); } };
    s.querySelectorAll('[data-me]').forEach(b => b.onclick = () => {
      const k = b.dataset.me; closeSheet(); onScroll();
      if(k.startsWith('go:')) go(k.slice(3));
      else if(k === 'theme'){ const x = $id('pt-open'); if(x) x.click(); }
      else if(k === 'navcfg') openNavCfg();
      else if(k === 'old') setStyle(true);
      else if(k === 'order') openOrder();
      else if(k === 'switch'){ const x = document.querySelector('#gate-space .sp-switch'); if(x) x.click(); }
    });
  }

  function init(){
    if(isClassic()){   // التصميم القديم كما كان: بلا شريط ولا أرقام ولا تحية — فقط زر العودة للجديد
      classicBtn();
      const sp = $id('gate-space'); if(sp) new MutationObserver(() => { classicBtn(); if(!sp.classList.contains('hide')) laySync(); }).observe(sp, { attributes:true, attributeFilter:['class'], childList:true, subtree:true });
      laySync();
      window.hsGo = () => {}; return;
    }
    headInit(); statsInit(); navInit(); navVisible(); badge(); layApply(); journeyInit();
    const mo = (el, fn, opt) => { if(el) new MutationObserver(fn).observe(el, opt); };
    mo($id('s-gate'), navVisible, { attributes:true, attributeFilter:['class'] });
    mo($id('gate-space'), () => { navVisible(); headInit(); statsInit(); if(!$id('gate-space').classList.contains('hide')) laySync(); }, { attributes:true, attributeFilter:['class'] });
    laySync();
    mo(document.body, navVisible, { attributes:true, attributeFilter:['class'] });
    mo($id('space-progress-pct'), statsDraw, { childList:true, characterData:true, subtree:true });
    mo($id('gate-bal'), statsDraw, { childList:true, characterData:true, subtree:true });
    mo($id('space-unread'), meBadge, { attributes:true, attributeFilter:['class'], childList:true, characterData:true, subtree:true });
    mo($id('my-report-new'), meBadge, { attributes:true, attributeFilter:['class'] });
    mo($id('my-report-new-p'), meBadge, { attributes:true, attributeFilter:['class'] });
    mo($id('space-walls'), meBadge, { childList:true, subtree:true });
    meBadge();
    mo($id('all-activities-count'), () => { badge(); actsOpen(); }, { childList:true, characterData:true, subtree:true });
    mo($id('student-journey'), () => { journeyInit(); jmapDraw(); }, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class'] });
    jmapDraw();
    document.addEventListener('hs-rank', statsDraw);
    window.addEventListener('scroll', onScroll, { passive:true });
    document.addEventListener('keydown', e => { if(e.key === 'Escape') closeSheet(); });
    setInterval(() => { headInit(); badge(); }, 60000);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.hsGo = go;
})();
