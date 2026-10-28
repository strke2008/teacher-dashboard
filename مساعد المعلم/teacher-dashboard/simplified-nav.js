/* طبقة التنقل المبسط + التخصيص — إضافة فقط، لا تعدّل أي ملف أصلي.
   الفكرة (حسب طلب المعلم): هو يختار الصفحات التي يدخلها دائمًا فتظهر
   في الشريط مباشرة (القائمة الجانبية على الكمبيوتر، الشريط السفلي على
   الجوال)، والباقي كله في «المزيد». التخصيص من زر «تخصيص القائمة».
   - الصفحات المثبّتة تُحفظ محليًا فقط (localStorage) ولا تُرسل لأي مكان.
   - الضغط على أي صفحة ينقر زرها الأصلي (class .tab) فينفّذ منطق 02.js
     الأصلي كاملًا؛ لا يتكرّر منطق التنقّل هنا.
   - شريط تبويبات القسم أعلى المحتوى ما زال موجودًا للتبديل بين صفحات
     القسم الحالي، ويلتف على صفوف فكلها ظاهرة بلا سحب.
   - ملاحظات أمان:
     - عناصر هذه الطبقة لا تحمل class "tab" ولا data-tab أبدًا، حتى لا
       تلتقطها محدّدات 02.js.
     - الألوان كلها من متغيرات الثيم؛ الشريحة النشطة تستخدم زوج الثيم
       النشط نفسه (nav-active / nav-active-text) لضمان القراءة.
     - إن غابت القائمة الأصلية أو نقص زر أصلي، تتوقف الطبقة كلها بدل
       أن تختفي صفحة من التنقل.
     - الجوال يعرض أول 4 صفحات مثبّتة في الشريط السفلي (5 خانات مع
       «المزيد»)، والمثبّتة الزائدة تظهر أولًا داخل ورقة «المزيد». */
(function(){
  'use strict';
  var SECTIONS = [
    { key:'home',     icon:'🏠', label:'لوحة التحكم',        pages:[['dashboard',null]] },
    { key:'teach',    icon:'📚', label:'التعليم',            pages:[['hw',null],['projects',null],['live',null],['madrasati',null]] },
    { key:'students', icon:'👥', label:'الطلاب',             pages:[['students',null],['classtools','records'],['plans',null],['classtools','duties']] },
    { key:'exams',    icon:'📝', label:'الاختبارات والدرجات', pages:[['classtools','exams'],['exam',null],['nafs',null],['classtools','analysis'],['grades',null]] },
    { key:'reports',  icon:'📊', label:'التقارير والملفات',   pages:[['reports',null],['classtools','classfile'],['classtools','portfolio']] },
    { key:'contact',  icon:'💬', label:'التواصل والتحفيز',   pages:[['messages',null],['walls',null],['classtools','certs'],['exam-shop',null]] },
    { key:'settings', icon:'⚙️', label:'الإعدادات',          pages:[['data',null]] }
  ];
  var PINS_KEY = 'simp_pins_v1';
  var LAST_KEY = 'simp_last_v1';
  var DEFAULT_PINS = ['dashboard','hw','students','classtools:records'];
  var MOBILE_BAR_PINS = 4;

  function keyOf(tab, view){ return view ? tab+':'+view : tab; }
  function parseKey(k){ var p = String(k).split(':'); return [p[0], p[1] || null]; }
  function sectionByKey(key){
    for(var i=0;i<SECTIONS.length;i++) if(SECTIONS[i].key===key) return SECTIONS[i];
    return null;
  }
  function sectionOf(tab, view){
    for(var i=0;i<SECTIONS.length;i++){
      var ps = SECTIONS[i].pages;
      for(var j=0;j<ps.length;j++){
        if(ps[j][0]===tab && (ps[j][1]||null)===(view||null)) return SECTIONS[i];
      }
    }
    return null;
  }
  function allPages(){
    var out = [];
    SECTIONS.forEach(function(sec){
      sec.pages.forEach(function(pg){ out.push({ tab: pg[0], view: pg[1], sec: sec }); });
    });
    return out;
  }
  function knownKey(k){
    return allPages().some(function(p){ return keyOf(p.tab, p.view) === k; });
  }
  // حالة التخصيص المحلية: {pins, at}. الشكل القديم (مصفوفة مباشرة)
  // ما زال مقروءًا للترحيل، ويُعامل كأنه بلا طابع زمني (at=0).
  var pinsState = null;
  function filterKnownPins(arr){
    var seen = {}, out = [];
    (arr || []).forEach(function(k){ if(knownKey(k) && !seen[k]){ seen[k] = true; out.push(k); } });
    return out;
  }
  function loadPinsState(){
    try{
      var raw = JSON.parse(localStorage.getItem(PINS_KEY) || 'null');
      if(Array.isArray(raw)){ var f = filterKnownPins(raw); if(f.length) return { pins: f, at: 0 }; }
      if(raw && Array.isArray(raw.pins)) return { pins: filterKnownPins(raw.pins), at: Number(raw.at) || 0 };
    }catch(e){}
    return { pins: DEFAULT_PINS.slice(), at: 0 };
  }
  function loadPins(){ return pinsState ? pinsState.pins : loadPinsState().pins; }
  // ترتيب العرض = ترتيب المصفوفة المحفوظة نفسها (ترتيب المستخدم)،
  // لا الترتيب الافتراضي للأقسام.
  function pinnedPages(){
    var map = {};
    allPages().forEach(function(p){ map[keyOf(p.tab, p.view)] = p; });
    var out = [];
    loadPins().forEach(function(k){ if(map[k]) out.push(map[k]); });
    return out;
  }

  function loadLast(){
    try{ return JSON.parse(localStorage.getItem(LAST_KEY) || '{}') || {}; }
    catch(e){ return {}; }
  }
  function saveLast(secKey, tab, view){
    try{
      var m = loadLast();
      m[secKey] = keyOf(tab, view);
      localStorage.setItem(LAST_KEY, JSON.stringify(m));
    }catch(e){}
  }
  function rememberedPage(sec){
    var m = loadLast()[sec.key];
    if(m){
      var parts = parseKey(m);
      for(var i=0;i<sec.pages.length;i++){
        if(sec.pages[i][0]===parts[0] && (sec.pages[i][1]||null)===(parts[1]||null)) return sec.pages[i];
      }
    }
    return sec.pages[0];
  }
  function origBtn(tab, view){
    if(view) return document.querySelector('.tab[data-tab="'+tab+'"][data-view="'+view+'"]');
    return document.querySelector('.tab[data-tab="'+tab+'"]:not([data-view])');
  }
  function origLabel(tab, view){
    var b = origBtn(tab, view);
    if(!b) return { icon:'•', label: tab };
    var icon = b.querySelector('.app-nav-icon');
    var spans = b.querySelectorAll('span:not(.proj-badge)');   // العدّاد ليس جزءًا من الاسم
    var label = spans.length ? spans[spans.length-1].textContent.trim() : b.textContent.trim();
    return { icon: icon ? icon.textContent.trim() : '•', label: label };
  }
  function activate(tab, view){
    var b = origBtn(tab, view);
    if(b){ b.click(); return true; }
    if(typeof window.goTab === 'function'){
      window.goTab(view ? tab+':'+view : tab); return true;
    }
    return false;
  }
  function mkBtn(cls, html){
    var b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.innerHTML = html;
    return b;
  }

  function build(){
    var nav = document.getElementById('main-nav');
    if(!nav) return false;
    var scroll = nav.querySelector('.app-sidebar-scroll');
    if(!scroll) return false;
    var pages = allPages();
    for(var i=0;i<pages.length;i++){
      if(!origBtn(pages[i].tab, pages[i].view)) return false;
    }
    pinsState = loadPinsState();
    document.body.classList.add('simp-nav');

    // ---- مزامنة التخصيص مع الخادم (بنفس نمط مزامنة الثيمات) ----
    var sessionChanged = false, serverTimer = null, navStatus = '', sheetMode = null;
    function savePinsLocal(){ try{ localStorage.setItem(PINS_KEY, JSON.stringify(pinsState)); }catch(e){} }
    function serverBase(){ try{ if(typeof getApi !== 'function' || typeof getTok !== 'function') return null; var api = getApi(), tok = getTok(); if(!api || !tok) return null; return { api: api.replace(/\/+$/, ''), tok: tok }; }catch(e){ return null; } }
    function serverNote(msg){ navStatus = msg; var el = sheet.querySelector('.simp-sh-status'); if(el) el.textContent = msg; }
    function scheduleServerSave(){ try{ clearTimeout(serverTimer); }catch(e){} serverTimer = setTimeout(serverSave, 600); }
    function commitPins(arr){ sessionChanged = true; pinsState = { pins: arr, at: Date.now() }; savePinsLocal(); scheduleServerSave(); }
    function serverSave(){
      var sb = serverBase();
      if(!sb || typeof fetch === 'undefined') return;
      try{
        fetch(sb.api + '/nav', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ t: sb.tok, nav: { pins: pinsState.pins, at: pinsState.at } }) })
        .then(function(r){ return r.ok; })
        .then(function(ok){ serverNote(ok ? '☁️ التخصيص محفوظ على الخادم — يظهر على كل أجهزتك.' : '⚠️ تعذّر حفظ التخصيص على الخادم — محفوظ على هذا الجهاز فقط.'); })
        .catch(function(){ serverNote('⚠️ تعذّر الاتصال بالخادم — التخصيص محفوظ على هذا الجهاز فقط.'); });
      }catch(e){}
    }
    function serverLoad(){
      var sb = serverBase();
      if(!sb || typeof fetch === 'undefined'){ serverNote('💾 الحفظ محلي فقط على هذا الجهاز — اضبط عنوان الخادم وكلمة السر في الإعدادات لمزامنة التخصيص على كل أجهزتك.'); return; }
      try{
        fetch(sb.api + '/nav?t=' + encodeURIComponent(sb.tok), { cache: 'no-store' })
        .then(function(r){ if(!r.ok) throw new Error('http' + r.status); return r.json(); })
        .then(function(j){
          var st = j && j.nav;
          if(!st || !Array.isArray(st.pins)){
            var cur = loadPins();
            var isDefault = cur.length === DEFAULT_PINS.length && cur.every(function(k, i){ return k === DEFAULT_PINS[i]; });
            if(!isDefault) scheduleServerSave();
            else serverNote('☁️ الربط بالخادم جاهز — سيُحفظ التخصيص عليه عند تغييره.');
            return;
          }
          var sat = Number(st.at) || 0, lat = Number(pinsState.at) || 0;
          if(!sessionChanged && sat >= lat){
            var clean = filterKnownPins(st.pins);
            // مصفوفة فارغة من الخادم تعني إلغاء تثبيت الكل عن قصد، لا عودة للافتراضي.
            pinsState = { pins: (clean.length || !st.pins.length) ? clean : DEFAULT_PINS.slice(), at: sat };
            savePinsLocal();
            renderSidebarPins();
            renderBar();
            if(sheetMode === 'customize') openCustomize();
            serverNote('☁️ تمت مزامنة التخصيص من الخادم.');
          }
          else if(lat > sat){ scheduleServerSave(); }
          else{ serverNote('☁️ التخصيص محفوظ على الخادم — يظهر على كل أجهزتك.'); }
        })
        .catch(function(){ serverNote('⚠️ تعذّرت مزامنة التخصيص مع الخادم — يُستخدم التخصيص المحفوظ على هذا الجهاز.'); });
      }catch(e){}
    }

    // ---- شريط تبويبات القسم أعلى المحتوى (يلتف على صفوف) ----
    var main = document.querySelector('main.wrap') || document.querySelector('main');
    var strip = document.createElement('div');
    strip.id = 'simp-strip';
    strip.className = 'no-print';
    if(main && main.firstChild) main.insertBefore(strip, main.firstChild);
    else if(main) main.appendChild(strip);
    function renderStrip(sec, activeTab, activeView){
      if(!sec || sec.pages.length <= 1){ strip.innerHTML = ''; strip.hidden = true; return; }
      var html = '';
      sec.pages.forEach(function(pg){
        var info = origLabel(pg[0], pg[1]);
        var on = pg[0]===activeTab && (pg[1]||null)===(activeView||null);
        html += '<button type="button" class="simp-chip'+(on?' on':'')+'" data-simp-key="'+keyOf(pg[0], pg[1])+'" data-simp-tab="'+pg[0]+'"'+(pg[1]?' data-simp-view="'+pg[1]+'"':'')+'>'
          + '<span>'+info.icon+'</span><span>'+info.label+'</span></button>';
      });
      strip.innerHTML = html;
      strip.hidden = false;
      paintBadges();
      strip.querySelectorAll('.simp-chip').forEach(function(b){
        b.addEventListener('click', function(){
          activate(b.getAttribute('data-simp-tab'), b.getAttribute('data-simp-view'));
        });
      });
    }

    // ---- ورقة مشتركة: «المزيد» و«تخصيص القائمة» ----
    var scrim = document.createElement('div');
    scrim.id = 'simp-scrim';
    var sheet = document.createElement('div');
    sheet.id = 'simp-sheet';
    sheet.className = 'no-print';
    document.body.appendChild(scrim);
    document.body.appendChild(sheet);
    function closeSheet(){ sheetMode = null; sheet.classList.remove('on'); scrim.classList.remove('on'); }
    scrim.addEventListener('click', closeSheet);
    function clearSheet(){ while(sheet.firstChild) sheet.removeChild(sheet.firstChild); }
    function sheetCloseBtn(){
      var b = mkBtn('simp-sh-close', 'إغلاق');
      b.addEventListener('click', closeSheet);
      return b;
    }
    function openSectionRemembered(key){
      var sec = sectionByKey(key);
      if(!sec) return;
      var pg = rememberedPage(sec);
      activate(pg[0], pg[1]);
    }

    function openMore(){
      sheetMode = 'more';
      clearSheet();
      var pins = pinnedPages();
      var pinSet = {};
      pins.forEach(function(p){ pinSet[keyOf(p.tab, p.view)] = true; });
      var cust = mkBtn('simp-sh-customize', '⚙️ تخصيص القائمة — اختر ما يظهر في الشريط');
      cust.addEventListener('click', function(){ openCustomize(); });
      sheet.appendChild(cust);
      // على الجوال: المثبّتة الزائدة عن أول 4 تظهر هنا أولًا.
      var isMobile = window.innerWidth <= 700;
      if(isMobile && pins.length > MOBILE_BAR_PINS){
        var g = document.createElement('div');
        g.className = 'simp-sh-grp';
        g.textContent = '📌 صفحاتك المثبّتة الأخرى';
        sheet.appendChild(g);
        pins.slice(MOBILE_BAR_PINS).forEach(function(p){
          var info = origLabel(p.tab, p.view);
          var b = mkBtn('simp-sh-page', '<span>'+info.icon+'</span><span>'+info.label+'</span>');
          b.setAttribute('data-simp-key', keyOf(p.tab, p.view));
          b.addEventListener('click', function(){ closeSheet(); activate(p.tab, p.view); });
          sheet.appendChild(b);
        });
      }
      SECTIONS.forEach(function(sec){
        var rest = sec.pages.filter(function(pg){ return !pinSet[keyOf(pg[0], pg[1])]; });
        if(!rest.length) return;
        var title = mkBtn('simp-sh-grp-btn', sec.icon+' '+sec.label);
        title.addEventListener('click', function(){ closeSheet(); openSectionRemembered(sec.key); });
        sheet.appendChild(title);
        rest.forEach(function(pg){
          var info = origLabel(pg[0], pg[1]);
          var b = mkBtn('simp-sh-page', '<span>'+info.icon+'</span><span>'+info.label+'</span>');
          b.setAttribute('data-simp-key', keyOf(pg[0], pg[1]));
          b.addEventListener('click', function(){ closeSheet(); activate(pg[0], pg[1]); });
          sheet.appendChild(b);
        });
      });
      sheet.appendChild(sheetCloseBtn());
      sheet.classList.add('on');
      scrim.classList.add('on');
      paintBadges();
    }

    function movePin(k, dir){
      var cur = loadPins();
      var idx = cur.indexOf(k);
      var j = idx + dir;
      if(idx < 0 || j < 0 || j >= cur.length) return;
      var tmp = cur[idx]; cur[idx] = cur[j]; cur[j] = tmp;
      commitPins(cur);
      renderSidebarPins();
      renderBar();
      openCustomize(); // إعادة رسم الورقة بالترتيب الجديد مع بقائها مفتوحة
    }
    function openCustomize(){
      sheetMode = 'customize';
      clearSheet();
      var pins = loadPins();
      var pinSet = {};
      pins.forEach(function(k){ pinSet[k] = true; });
      var h = document.createElement('div');
      h.className = 'simp-sh-title';
      h.textContent = '⚙️ تخصيص القائمة';
      sheet.appendChild(h);
      var note = document.createElement('p');
      note.className = 'simp-sh-note';
      note.textContent = 'اضغط على أي صفحة لتثبيتها في الشريط أو إلغاء تثبيتها. المثبّتة تظهر في الشريط مباشرة حسب ترتيبك، والباقي في «المزيد». على الجوال يظهر أول 4 صفحات مثبّتة حسب ترتيبك في الشريط السفلي.';
      sheet.appendChild(note);
      var statusEl = document.createElement('div');
      statusEl.className = 'simp-sh-status';
      statusEl.textContent = navStatus;
      sheet.appendChild(statusEl);
      // ---- ترتيب المثبّتة: من قبل من، بالأسهم ----
      var ordTitle = document.createElement('div');
      ordTitle.className = 'simp-sh-grp';
      ordTitle.textContent = '↕ ترتيب صفحاتك المثبّتة';
      sheet.appendChild(ordTitle);
      var ordered = pinnedPages();
      if(ordered.length < 2){
        var ordHint = document.createElement('p');
        ordHint.className = 'simp-sh-note';
        ordHint.textContent = ordered.length
          ? 'صفحة واحدة مثبّتة — ثبّت صفحة أخرى على الأقل حتى يظهر الترتيب.'
          : 'لا صفحات مثبّتة بعد — ثبّت صفحتين على الأقل من القائمة أدناه ثم رتّبهما هنا.';
        sheet.appendChild(ordHint);
      }
      ordered.forEach(function(p, idx){
        var k = keyOf(p.tab, p.view);
        var info = origLabel(p.tab, p.view);
        var row = document.createElement('div');
        row.className = 'simp-order-row';
        row.setAttribute('data-simp-ord', k);
        var num = document.createElement('span');
        num.className = 'simp-ord-num';
        num.textContent = String(idx + 1);
        var lb = document.createElement('span');
        lb.className = 'simp-lb';
        lb.textContent = info.icon+' '+info.label;
        var up = mkBtn('simp-arrow', '↑');
        up.setAttribute('data-simp-move', 'up');
        up.setAttribute('data-simp-key', k);
        if(idx === 0) up.setAttribute('disabled', '');
        up.addEventListener('click', function(){ movePin(k, -1); });
        var down = mkBtn('simp-arrow', '↓');
        down.setAttribute('data-simp-move', 'down');
        down.setAttribute('data-simp-key', k);
        if(idx === ordered.length - 1) down.setAttribute('disabled', '');
        down.addEventListener('click', function(){ movePin(k, 1); });
        row.appendChild(num);
        row.appendChild(lb);
        row.appendChild(up);
        row.appendChild(down);
        sheet.appendChild(row);
      });
      SECTIONS.forEach(function(sec){
        var title = document.createElement('div');
        title.className = 'simp-sh-grp';
        title.textContent = sec.icon+' '+sec.label;
        sheet.appendChild(title);
        sec.pages.forEach(function(pg){
          var k = keyOf(pg[0], pg[1]);
          var info = origLabel(pg[0], pg[1]);
          var pinned = !!pinSet[k];
          var row = mkBtn('simp-pin-row'+(pinned?' pinned':''),
            '<span>'+info.icon+'</span><span class="simp-lb">'+info.label+'</span>'
            + '<span class="simp-pin-state">'+(pinned?'✓ مثبّتة':'+ تثبيت')+'</span>');
          row.setAttribute('data-simp-pin', k);
          row.addEventListener('click', function(){
            var cur = loadPins();
            var idx = cur.indexOf(k);
            if(idx >= 0) cur.splice(idx, 1);
            else cur.push(k);
            commitPins(cur);
            renderSidebarPins();
            renderBar();
            openCustomize(); // إعادة رسم الورقة بالحالة الجديدة مع بقائها مفتوحة
          });
          sheet.appendChild(row);
        });
      });
      var restore = mkBtn('simp-sh-restore', '↩ استعادة الافتراضي');
      restore.addEventListener('click', function(){
        commitPins(DEFAULT_PINS.slice());
        renderSidebarPins();
        renderBar();
        openCustomize();
      });
      sheet.appendChild(restore);
      sheet.appendChild(sheetCloseBtn());
      sheet.classList.add('on');
      scrim.classList.add('on');
    }

    // ---- القائمة الجانبية (كمبيوتر): المثبّتة + المزيد + تخصيص ----
    var box = document.createElement('div');
    box.id = 'simp-nav';
    var pinWrap = document.createElement('div');
    pinWrap.id = 'simp-pins';
    box.appendChild(pinWrap);
    var moreBtn = mkBtn('simp-sec', '<span class="simp-ic">⋯</span><span class="simp-lb">المزيد</span>');
    moreBtn.setAttribute('data-simp-more', '1');
    moreBtn.addEventListener('click', openMore);
    box.appendChild(moreBtn);
    var custBtn = mkBtn('simp-customize', '⚙️ تخصيص القائمة');
    custBtn.addEventListener('click', openCustomize);
    box.appendChild(custBtn);
    scroll.insertBefore(box, scroll.firstChild);
    function renderSidebarPins(){
      while(pinWrap.firstChild) pinWrap.removeChild(pinWrap.firstChild);
      var title = document.createElement('div');
      title.className = 'simp-grp-title';
      title.textContent = '📌 صفحاتك';
      pinWrap.appendChild(title);
      var pins = pinnedPages();
      if(!pins.length){
        var hint = document.createElement('div');
        hint.className = 'simp-hint';
        hint.textContent = 'لا صفحات مثبّتة — افتح «المزيد» ثم «تخصيص القائمة» واختر ما يظهر هنا.';
        pinWrap.appendChild(hint);
      }
      pins.forEach(function(p){
        var info = origLabel(p.tab, p.view);
        var b = mkBtn('simp-sec', '<span class="simp-ic">'+info.icon+'</span><span class="simp-lb">'+info.label+'</span>');
        b.setAttribute('data-simp-pin', keyOf(p.tab, p.view));
        b.addEventListener('click', function(){ activate(p.tab, p.view); });
        pinWrap.appendChild(b);
      });
      paintBadges();
    }

    // ---- الشريط السفلي (جوال): أول 4 مثبّتات + المزيد ----
    var bar = document.createElement('nav');
    bar.id = 'simp-bottomnav';
    bar.setAttribute('aria-label','التنقل المخصص للجوال');
    document.body.appendChild(bar);
    var barMoreBtn = null;
    function renderBar(){
      while(bar.firstChild) bar.removeChild(bar.firstChild);
      var pins = pinnedPages().slice(0, MOBILE_BAR_PINS);
      pins.forEach(function(p){
        var info = origLabel(p.tab, p.view);
        var b = mkBtn('', '<span class="simp-bic">'+info.icon+'</span><b>'+info.label+'</b>');
        b.setAttribute('data-simp-pin', keyOf(p.tab, p.view));
        b.addEventListener('click', function(){ activate(p.tab, p.view); });
        bar.appendChild(b);
      });
      barMoreBtn = mkBtn('', '<span class="simp-bic">•••</span><b>المزيد</b>');
      barMoreBtn.setAttribute('data-simp-more', '1');
      barMoreBtn.addEventListener('click', openMore);
      bar.appendChild(barMoreBtn);
      paintBadges();
    }

    // ---- 🔴 العدّادات (المشاريع، حائط الإبداع…): تأتي من navBadgeSet في 03-projects ----
    // على الصفحة المثبّتة نفسها، وعلى «المزيد» مجموع ما ليس ظاهرًا في الشريط، وداخل ورقة «المزيد» وشريط القسم.
    function badgeMap(){ try{ return (typeof NAV_BADGES !== 'undefined' && NAV_BADGES) || {}; }catch(e){ return {}; } }
    function fmtN(n){ return n > 99 ? '99+' : String(n); }
    function putBadge(el, n, cls){
      var b = el.querySelector('.simp-bdg');
      if(!n){ if(b) b.remove(); return; }
      if(!b){ b = document.createElement('span'); el.appendChild(b); }
      b.className = 'simp-bdg ' + cls; b.textContent = fmtN(n);
    }
    function paintBadges(){
      if(!box) return;
      var m = badgeMap();
      var sideKeys = {}, barKeys = {};
      box.querySelectorAll('[data-simp-pin]').forEach(function(el){ var k = el.getAttribute('data-simp-pin'); sideKeys[k] = 1; putBadge(el, m[k] || 0, 'proj-badge-in'); });
      bar.querySelectorAll('[data-simp-pin]').forEach(function(el){ var k = el.getAttribute('data-simp-pin'); barKeys[k] = 1; putBadge(el, m[k] || 0, 'proj-badge'); });
      var restSide = 0, restBar = 0;
      Object.keys(m).forEach(function(k){ if(!sideKeys[k]) restSide += m[k] || 0; if(!barKeys[k]) restBar += m[k] || 0; });
      putBadge(moreBtn, restSide, 'proj-badge-in');
      if(barMoreBtn) putBadge(barMoreBtn, restBar, 'proj-badge');
      document.querySelectorAll('#simp-sheet [data-simp-key], #simp-strip [data-simp-key]').forEach(function(el){ putBadge(el, m[el.getAttribute('data-simp-key')] || 0, 'proj-badge-in'); });
    }
    window.simpNavBadges = paintBadges;

    // ---- المزامنة: أي تبديل أصلي يحدّث النشط والشريط والذاكرة ----
    function sync(){
      var on = document.querySelector('#main-nav .tab.on');
      if(!on) return;
      var tab = on.dataset.tab, view = on.dataset.view || null;
      var sec = sectionOf(tab, view);
      if(sec) saveLast(sec.key, tab, view);
      var cur = keyOf(tab, view);
      box.querySelectorAll('[data-simp-pin]').forEach(function(b){
        b.classList.toggle('on', b.getAttribute('data-simp-pin') === cur);
      });
      var barKeys = [];
      bar.querySelectorAll('[data-simp-pin]').forEach(function(b){ barKeys.push(b.getAttribute('data-simp-pin')); });
      var inBar = barKeys.indexOf(cur) >= 0;
      moreBtn.classList.toggle('on', !pinnedPages().some(function(p){ return keyOf(p.tab, p.view) === cur; }));
      if(barMoreBtn) barMoreBtn.classList.toggle('on', !inBar);
      renderStrip(sec, tab, view);
    }
    renderSidebarPins();
    renderBar();
    var obs = new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){
        var t = muts[i].target;
        if(t.closest && t.closest('#simp-nav, #simp-bottomnav, #simp-sheet, #simp-strip')) continue;
        if(muts[i].type === 'attributes'){ sync(); return; }
      }
    });
    obs.observe(nav, { subtree:true, attributes:true, attributeFilter:['class'] });
    sync();
    serverLoad();
    return true;
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
