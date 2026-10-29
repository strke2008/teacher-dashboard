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
      else if(k === 'switch'){ const x = document.querySelector('#gate-space .sp-switch'); if(x) x.click(); }
    });
  }

  function init(){
    if(isClassic()){   // التصميم القديم كما كان: بلا شريط ولا أرقام ولا تحية — فقط زر العودة للجديد
      classicBtn();
      const sp = $id('gate-space'); if(sp) new MutationObserver(classicBtn).observe(sp, { attributes:true, attributeFilter:['class'], childList:true, subtree:true });
      window.hsGo = () => {}; return;
    }
    headInit(); statsInit(); navInit(); navVisible(); badge();
    const mo = (el, fn, opt) => { if(el) new MutationObserver(fn).observe(el, opt); };
    mo($id('s-gate'), navVisible, { attributes:true, attributeFilter:['class'] });
    mo($id('gate-space'), () => { navVisible(); headInit(); statsInit(); }, { attributes:true, attributeFilter:['class'] });
    mo(document.body, navVisible, { attributes:true, attributeFilter:['class'] });
    mo($id('space-progress-pct'), statsDraw, { childList:true, characterData:true, subtree:true });
    mo($id('gate-bal'), statsDraw, { childList:true, characterData:true, subtree:true });
    mo($id('all-activities-count'), badge, { childList:true, characterData:true, subtree:true });
    document.addEventListener('hs-rank', statsDraw);
    window.addEventListener('scroll', onScroll, { passive:true });
    document.addEventListener('keydown', e => { if(e.key === 'Escape') closeSheet(); });
    setInterval(() => { headInit(); badge(); }, 60000);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.hsGo = go;
})();
