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
    { key:'teach',    icon:'📚', label:'التعليم',            pages:[['hw',null],['books',null],['projects',null],['live',null],['madrasati',null]] },
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
    return { icon: icon ? (icon.getAttribute('data-emo') || icon.textContent.trim() || '•') : '•', label: label };   // data-emo: الإيموجي الأصلي بعد تحويله لأيقونة (js/45-icons.js)
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

  /* الأيقونة مرسومة مباشرة (45-icons.js يُحمَّل أولًا)، مع الإيموجي في data-emo لمن يقرأه؛ وإلا الإيموجي نفسه */
  function icoOf(e){ var h = (typeof window.icoFor === 'function') ? window.icoFor(e) : ''; return h || e; }
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
          + '<span>'+icoOf(info.icon)+'</span><span>'+info.label+'</span></button>';
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
      var shRow = document.createElement('div'); shRow.className = 'simp-sh-row';
      var shSet = mkBtn('simp-sh-customize simp-sh-settings', '⚙️ الإعدادات');
      shSet.setAttribute('data-simp-settings', '1');
      shSet.addEventListener('click', function(){ closeSheet(); activate('data', null); });
      var cust = mkBtn('simp-sh-customize', '✏️ تخصيص القائمة');
      cust.addEventListener('click', function(){ openCustomize(); });
      shRow.appendChild(shSet); shRow.appendChild(cust);
      sheet.appendChild(shRow);
      // على الجوال: المثبّتة الزائدة عن أول 4 تظهر هنا أولًا.
      var isMobile = window.innerWidth <= 700;
      if(isMobile && pins.length > MOBILE_BAR_PINS){
        var g = document.createElement('div');
        g.className = 'simp-sh-grp';
        g.textContent = '📌 صفحاتك المثبّتة الأخرى';
        sheet.appendChild(g);
        pins.slice(MOBILE_BAR_PINS).forEach(function(p){
          var info = origLabel(p.tab, p.view);
          var b = mkBtn('simp-sh-page', '<span>'+icoOf(info.icon)+'</span><span>'+info.label+'</span>');
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
          var b = mkBtn('simp-sh-page', '<span>'+icoOf(info.icon)+'</span><span>'+info.label+'</span>');
          b.setAttribute('data-simp-key', keyOf(pg[0], pg[1]));
          b.addEventListener('click', function(){ closeSheet(); activate(pg[0], pg[1]); });
          sheet.appendChild(b);
        });
      });
      var av = document.createElement('button'); av.type = 'button'; av.className = 'app-ver simp-sh-ver'; av.setAttribute('data-appver', '');   // 🏷️ رقم الإصدار وحالته
      sheet.appendChild(av); try{ if(window.appVerPaint) window.appVerPaint(); }catch(e){}
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
      if(window.innerWidth > 700) sheet.appendChild(styleToggle(function(){ if(navStyle() === 'sections'){ closeSheet(); editMode = true; renderSidebarPins(); } else openCustomize(); }));
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
            '<span>'+icoOf(info.icon)+'</span><span class="simp-lb">'+info.label+'</span>'
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
    var box = document.getElementById('simp-nav') || document.createElement('div');   // موجود في الصفحة (بآخر شكل محفوظ)
    box.id = 'simp-nav'; box.innerHTML = '';
    var pinWrap = document.createElement('div');
    pinWrap.id = 'simp-pins';
    box.appendChild(pinWrap);
    var moreBtn = mkBtn('simp-sec', '<span class="simp-ic">⋯</span><span class="simp-lb">المزيد</span>');
    moreBtn.setAttribute('data-simp-more', '1');
    moreBtn.addEventListener('click', openMore);
    box.appendChild(moreBtn);
    // ⚙️ الإعدادات بجانب «تخصيص القائمة» — وصول بضغطة بدل «المزيد»
    var custRow = document.createElement('div'); custRow.className = 'simp-cust-row';
    var setBtn = mkBtn('simp-customize simp-settings', '⚙️ الإعدادات');
    setBtn.setAttribute('data-simp-settings', '1');
    setBtn.addEventListener('click', function(){ activate('data', null); });
    var custBtn = mkBtn('simp-customize', '✏️ تخصيص القائمة');
    custBtn.addEventListener('click', openCustomize);
    custRow.appendChild(setBtn); custRow.appendChild(custBtn);
    box.appendChild(custRow);
    scroll.insertBefore(box, scroll.firstChild);
    /* 🗂️ القائمة الجانبية بالأقسام: عنوان ثابت لكل قسم وتحته صفحاتك المختارة منه؛
       المخفية تحت «+N» (تُفتح مؤقتًا)، والصفحة المفتوحة الآن تظهر في قسمها ولو لم تكن مختارة.
       التخصيص داخل القائمة نفسها: مفتاح لكل صفحة وسحب ⋮⋮ للترتيب داخل القسم. */
    var editMode = false, openHid = {};
    // 🔀 شكل القائمة: «بالأقسام» (الجديد) أو «قائمة واحدة» (القديم) — يختاره المعلم، ويُحفظ على الجهاز
    var STYLE_KEY = 'simp_style_v1';
    function navStyle(){ try{ return localStorage.getItem(STYLE_KEY) === 'flat' ? 'flat' : 'sections'; }catch(e){ return 'sections'; } }
    function styleToggle(after){
      var w = document.createElement('div'); w.className = 'simp-style'; w.setAttribute('role', 'radiogroup'); w.setAttribute('aria-label', 'شكل القائمة');
      w.innerHTML = '<span class="simp-style-t">شكل القائمة</span>';
      [['sections', 'بالأقسام'], ['flat', 'قائمة واحدة']].forEach(function(o){
        var b = mkBtn('simp-style-b' + (navStyle() === o[0] ? ' on' : ''), o[1]);
        b.setAttribute('data-simp-style', o[0]); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(navStyle() === o[0]));
        b.addEventListener('click', function(){ try{ localStorage.setItem(STYLE_KEY, o[0]); }catch(e){} openHid = {}; lastCur = ''; renderSidebarPins(); sync(); if(after) after(); });
        w.appendChild(b);
      });
      return w;
    }
    function renderFlat(){   // الشكل القديم كما كان: «📌 صفحاتك» + «المزيد»
      var title = document.createElement('div'); title.className = 'simp-grp-title'; title.textContent = '📌 صفحاتك'; pinWrap.appendChild(title);
      var pins = pinnedPages();
      if(!pins.length){ var hint = document.createElement('div'); hint.className = 'simp-hint'; hint.textContent = 'لا صفحات مثبّتة — افتح «المزيد» ثم «تخصيص القائمة» واختر ما يظهر هنا.'; pinWrap.appendChild(hint); }
      pins.forEach(function(p){ pinWrap.appendChild(pageRow([p.tab, p.view], keyOf(p.tab, p.view))); });
    }
    function curKey(){ var on = document.querySelector('#main-nav .tab.on'); return on ? keyOf(on.dataset.tab, on.dataset.view || null) : ''; }
    function pageRow(p, k, cls){
      var info = origLabel(p[0], p[1]);
      var b = mkBtn('simp-sec' + (cls ? ' ' + cls : ''), '<span class="simp-ic">'+icoOf(info.icon)+'</span><span class="simp-lb">'+info.label+'</span>');
      b.setAttribute('data-simp-pin', k);
      b.addEventListener('click', function(){ activate(p[0], p[1]); });
      return b;
    }
    function setPinned(k, on){
      var cur = loadPins(), i = cur.indexOf(k);
      if(on && i < 0){
        var sec = sectionOf.apply(null, parseKey(k)), last = -1;
        cur.forEach(function(x, j){ var s2 = sectionOf.apply(null, parseKey(x)); if(s2 && sec && s2.key === sec.key) last = j; });
        if(last >= 0) cur.splice(last + 1, 0, k); else cur.push(k);
      }
      if(!on && i >= 0) cur.splice(i, 1);
      commitPins(cur); renderSidebarPins(); renderBar();
    }
    function reorderSection(keys){   // ترتيب المختارة داخل قسم: تُستبدل مواضعها في الترتيب العام بالترتيب الجديد
      var cur = loadPins(), set = {}; keys.forEach(function(k){ set[k] = 1; });
      var slots = []; cur.forEach(function(k, i){ if(set[k]) slots.push(i); });
      var want = keys.filter(function(k){ return cur.indexOf(k) >= 0; });
      slots.forEach(function(pos, j){ cur[pos] = want[j]; });
      commitPins(cur); renderBar();
    }
    function dragify(handle, row, list){
      handle.addEventListener('pointerdown', function(e){
        e.preventDefault(); e.stopPropagation(); row.classList.add('drag');
        function mv(ev){
          var rows = [].slice.call(list.querySelectorAll('.simp-edit-row.pinned'));
          for(var i = 0; i < rows.length; i++){ var r = rows[i]; if(r === row) continue; var bx = r.getBoundingClientRect(), mid = bx.top + bx.height / 2;
            var pos = row.compareDocumentPosition(r);
            if(ev.clientY < mid && (pos & 2)){ list.insertBefore(row, r); return; }                 // r فوقه: اصعد
            if(ev.clientY > mid && (pos & 4)){ list.insertBefore(row, r.nextElementSibling); return; } }   // r تحته: انزل
        }
        function up(){ window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); row.classList.remove('drag');
          reorderSection([].slice.call(list.querySelectorAll('.simp-edit-row.pinned')).map(function(r){ return r.getAttribute('data-simp-edit'); })); }
        // على النافذة: نقل الصف داخل القائمة يُسقط التقاط المؤشر عن المقبض
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      });
    }
    function editRow(p, k, pinned, list){
      var info = origLabel(p[0], p[1]);
      var r = document.createElement('div'); r.className = 'simp-edit-row' + (pinned ? ' pinned' : ''); r.setAttribute('data-simp-edit', k);
      r.innerHTML = '<span class="simp-drag" title="اسحب للترتيب">⋮⋮</span><span class="simp-ic">'+icoOf(info.icon)+'</span><span class="simp-lb">'+info.label+'</span>'
        + '<button type="button" class="simp-tog'+(pinned ? ' on' : '')+'" role="switch" aria-checked="'+pinned+'" aria-label="إظهار '+info.label+'"></button>';
      r.querySelector('.simp-tog').addEventListener('click', function(){ setPinned(k, !pinned); });
      if(pinned) dragify(r.querySelector('.simp-drag'), r, list);
      return r;
    }
    function renderSidebarPins(){
      while(pinWrap.firstChild) pinWrap.removeChild(pinWrap.firstChild);
      var flat = navStyle() === 'flat'; if(flat) editMode = false;
      box.classList.toggle('simp-flat', flat);
      if(flat){ renderFlat(); custBtn.innerHTML = icoOf('✏️') + ' تخصيص القائمة'; custBtn.classList.remove('done'); paintBadges(); return; }
      pinWrap.classList.toggle('editing', editMode);
      var pinsArr = loadPins(), pinSet = {}; pinsArr.forEach(function(k){ pinSet[k] = 1; });
      var cur = curKey();
      if(editMode){
        pinWrap.appendChild(styleToggle());
        var h = document.createElement('div'); h.className = 'simp-edit-hint';
        h.textContent = 'شغّل الصفحات اللي تبيها تظهر، ورتّبها بسحب النقاط اللي جنب كل صفحة.'; pinWrap.appendChild(h);
      }
      SECTIONS.forEach(function(sec){
        if(sec.key === 'settings') return;                     // للإعدادات زرها تحت
        var ordered = pinsArr.filter(function(k){ var s2 = sectionOf.apply(null, parseKey(k)); return s2 && s2.key === sec.key; });
        var hidden = sec.pages.filter(function(pg){ return !pinSet[keyOf(pg[0], pg[1])]; });
        var list = document.createElement('div'); list.className = 'simp-gl';
        if(sec.key !== 'home'){
          var gh = document.createElement('div'); gh.className = 'simp-gh'; gh.setAttribute('data-simp-gh', sec.key);
          gh.innerHTML = '<span>'+icoOf(sec.icon)+'</span><span class="simp-gh-t">'+sec.label+'</span>';
          if(!editMode && hidden.length){
            var pill = mkBtn('simp-hid' + (openHid[sec.key] ? ' open' : ''), (openHid[sec.key] ? '−' : '+') + hidden.length);
            pill.setAttribute('data-simp-hid', sec.key);
            pill.setAttribute('aria-label', (openHid[sec.key] ? 'إخفاء' : 'إظهار') + ' ' + hidden.length + ' صفحات مخفية من ' + sec.label);
            pill.addEventListener('click', function(){ openHid[sec.key] = !openHid[sec.key]; renderSidebarPins(); sync(); });
            gh.appendChild(pill);
          }
          pinWrap.appendChild(gh);
        }
        if(editMode){
          var keysInOrder = ordered.concat(sec.pages.map(function(pg){ return keyOf(pg[0], pg[1]); }).filter(function(k){ return !pinSet[k]; }));
          keysInOrder.forEach(function(k){ list.appendChild(editRow(parseKey(k), k, !!pinSet[k], list)); });
        }else{
          ordered.forEach(function(k){ list.appendChild(pageRow(parseKey(k), k)); });
          hidden.forEach(function(pg){ var k = keyOf(pg[0], pg[1]);
            if(openHid[sec.key] || k === cur) list.appendChild(pageRow(pg, k, 'simp-temp')); });
          if(sec.key !== 'home' && !list.childNodes.length){ var e = document.createElement('div'); e.className = 'simp-gh-empty'; e.textContent = 'لا صفحات مختارة — اضغط الرقم'; list.appendChild(e); }
        }
        pinWrap.appendChild(list);
      });
      if(editMode){
        var mob = mkBtn('simp-mob-order', '📱 ترتيب شريط الجوال السفلي');
        mob.addEventListener('click', openCustomize); pinWrap.appendChild(mob);
      }
      custBtn.innerHTML = icoOf(editMode ? '✅' : '✏️') + (editMode ? ' تم' : ' تخصيص القائمة');
      custBtn.classList.toggle('done', editMode);
      paintBadges();
    }
    custBtn.removeEventListener('click', openCustomize);
    custBtn.addEventListener('click', function(){
      if((window.innerWidth <= 700 || navStyle() === 'flat') && !editMode){ openCustomize(); return; }   // الجوال والشكل القديم: ورقة التخصيص كما هي
      editMode = !editMode; openHid = {}; renderSidebarPins(); sync();
    });

    // ---- الشريط السفلي (جوال): أول 4 مثبّتات + المزيد ----
    var bar = document.getElementById('simp-bottomnav') || document.createElement('nav');   // موجود في الصفحة (بآخر شكل محفوظ)
    bar.id = 'simp-bottomnav';
    bar.setAttribute('aria-label','التنقل المخصص للجوال');
    if(!bar.parentNode) document.body.appendChild(bar);
    var barMoreBtn = null;
    function renderBar(){
      while(bar.firstChild) bar.removeChild(bar.firstChild);
      var pins = pinnedPages().slice(0, MOBILE_BAR_PINS);
      pins.forEach(function(p){
        var info = origLabel(p.tab, p.view);
        var b = mkBtn('', '<span class="simp-bic">'+icoOf(info.icon)+'</span><b>'+info.label+'</b>');
        b.setAttribute('data-simp-pin', keyOf(p.tab, p.view));
        b.addEventListener('click', function(){ activate(p.tab, p.view); });
        bar.appendChild(b);
      });
      barMoreBtn = mkBtn('', '<span class="simp-bic" data-emo="•••">'+icoOf('•••')+'</span><b>المزيد</b>');
      barMoreBtn.setAttribute('data-simp-more', '1');
      barMoreBtn.addEventListener('click', openMore);
      bar.appendChild(barMoreBtn);
      paintBadges();
      snapSoon();
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
      box.querySelectorAll('[data-simp-hid]').forEach(function(el){ var sec = sectionByKey(el.getAttribute('data-simp-hid')), n = 0;
        if(sec) sec.pages.forEach(function(pg){ var k = keyOf(pg[0], pg[1]); if(!sideKeys[k]) n += m[k] || 0; }); putBadge(el, n, 'proj-badge-in'); });
      if(barMoreBtn) putBadge(barMoreBtn, restBar, 'proj-badge');
      document.querySelectorAll('#simp-sheet [data-simp-key], #simp-strip [data-simp-key]').forEach(function(el){ putBadge(el, m[el.getAttribute('data-simp-key')] || 0, 'proj-badge-in'); });
    }
    window.simpNavBadges = paintBadges;

    // ---- المزامنة: أي تبديل أصلي يحدّث النشط والشريط والذاكرة ----
    var lastCur = '';
    function sync(){
      var on = document.querySelector('#main-nav .tab.on');
      if(!on) return;
      var tab = on.dataset.tab, view = on.dataset.view || null;
      var sec = sectionOf(tab, view);
      if(sec) saveLast(sec.key, tab, view);
      var cur = keyOf(tab, view);
      if(!editMode && cur !== lastCur){ lastCur = cur; renderSidebarPins(); }
      box.querySelectorAll('[data-simp-pin]').forEach(function(b){
        b.classList.toggle('on', b.getAttribute('data-simp-pin') === cur);
      });
      var barKeys = [];
      bar.querySelectorAll('[data-simp-pin]').forEach(function(b){ barKeys.push(b.getAttribute('data-simp-pin')); });
      var inBar = barKeys.indexOf(cur) >= 0;
      moreBtn.classList.toggle('on', !pinnedPages().some(function(p){ return keyOf(p.tab, p.view) === cur; }));
      if(barMoreBtn) barMoreBtn.classList.toggle('on', !inBar);
      renderStrip(sec, tab, view);
      snapSoon();
    }
    /* آخر شكل للشريطين يُحفظ ليُعرض فورًا في الفتح التالي قبل تحميل السكربتات (بعد أن تأخذ الأزرار أيقوناتها) */
    var snapT = 0;
    function snapSoon(){ clearTimeout(snapT); snapT = setTimeout(function(){ if(editMode) return; try{ localStorage.setItem('simp_snap_v1', JSON.stringify({ bar: bar.innerHTML, side: box.innerHTML, at: Date.now() })); }catch(e){} }, 700); }
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

  /* فشل البناء: يعود التنقل الأصلي (الصفحة تبدأ بـ simp-nav لتخفيه من أول رسم) */
  function start(){ var ok = false; try{ ok = build(); }catch(e){ ok = false; }
    if(!ok){ document.body.classList.remove('simp-nav'); ['simp-bottomnav','simp-nav'].forEach(function(id){ var e = document.getElementById(id); if(e) e.remove(); }); try{ localStorage.removeItem('simp_snap_v1'); }catch(e){} } }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
