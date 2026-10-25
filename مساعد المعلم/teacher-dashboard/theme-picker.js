/* ثيمات لوحة المعلم — ملف إضافة فقط.
   لا يلمس أي كود أصلي، ولا يقرأ ولا يكتب أي بيانات للطلاب أو الدرجات.
   يحفظ الثيم فقط في مفتاح مستقل: oasis_theme_v1.
   يعمل بتغيير متغيرات CSS الأصلية للوحة (paper, ink, ui-*, app-nav-*).
   لا يوجد زر عائم: قسم الثيمات يُدرج داخل صفحة الإعدادات (p-data) فقط،
   وتحديدًا ضمن تبويب «المدرسة والمظهر» مع باقي تبويبات الإعدادات،
   ولا يظهر في الصفحة الرئيسية ولا يغطي صندوق الرسائل العائم. */
(function(){
  var KEY='oasis_theme_v1';
  var PRESETS={
    old:{label:'الواجهة القديمة',vars:{'--paper':'#E9EEF5','--paper-2':'#F7FAFD','--ink':'#16233A','--ink-soft':'#5A6B84','--ui-muted':'#5A6B84','--rule':'#C9D6E5','--ui-bg':'#E9EEF5','--ui-surface':'#F7FAFD','--ui-surface-2':'#F1F5FA','--ui-border':'#D5E0EC','--ui-border-strong':'#C9D6E5','--ui-accent':'#3B5F86','--ui-accent-soft':'#EEF3F8','--app-nav-bg':'#16233A','--app-nav-text':'#DCE6F1','--app-nav-muted':'#91A4BD','--app-nav-active':'#F1F5F9','--app-nav-active-text':'#16233A','--card':'#FFFFFF'}},
    oasis:{label:'واحة المعلم',vars:{'--paper':'#F7F1E5','--paper-2':'#FFFCF5','--ink':'#1F2A22','--ink-soft':'#7A6F5C','--ui-muted':'#7A6F5C','--rule':'#E8DDC4','--ui-bg':'#FFFCF5','--ui-surface':'#FFFCF5','--ui-surface-2':'#F3E6C8','--ui-border':'#E8DDC4','--ui-border-strong':'#D8C9A8','--ui-accent':'#C9A86A','--ui-accent-soft':'#F3E6C8','--app-nav-bg':'#123332','--app-nav-text':'#F5EEDD','--app-nav-muted':'#D8CDB4','--app-nav-active':'#C9A86A','--app-nav-active-text':'#123332','--card':'#FFFCF5'}},
    sand:{label:'رمل فاتح',vars:{'--paper':'#F3EDE0','--paper-2':'#FFFFFF','--ink':'#2B2620','--ink-soft':'#7C7263','--ui-muted':'#7C7263','--rule':'#E2D9C3','--ui-bg':'#FFFFFF','--ui-surface':'#FFFFFF','--ui-surface-2':'#F5E7C8','--ui-border':'#E2D9C3','--ui-border-strong':'#D8C9A8','--ui-accent':'#B7791F','--ui-accent-soft':'#F5E7C8','--app-nav-bg':'#3E3A2E','--app-nav-text':'#F5EFE0','--app-nav-muted':'#D8CDB4','--app-nav-active':'#B7791F','--app-nav-active-text':'#FFFFFF','--card':'#FFFFFF'}},
    plum:{label:'عنابي دافئ',vars:{'--paper':'#F9F0EE','--paper-2':'#FFFDFB','--ink':'#2B1B20','--ink-soft':'#7A5C60','--ui-muted':'#7A5C60','--rule':'#E8CFC8','--ui-bg':'#FFFDFB','--ui-surface':'#FFFDFB','--ui-surface-2':'#F6E3C8','--ui-border':'#E8CFC8','--ui-border-strong':'#D8B8AC','--ui-accent':'#C08A3A','--ui-accent-soft':'#F6E3C8','--app-nav-bg':'#4A1F2A','--app-nav-text':'#FBEFEA','--app-nav-muted':'#E8CFC8','--app-nav-active':'#C08A3A','--app-nav-active-text':'#FFFFFF','--card':'#FFFDFB'}}
  };
  var FIELDS=[
    ['--paper','لون الخلفية'],
    ['--ui-surface','لون البطاقات'],
    ['--app-nav-bg','لون القائمة الجانبية'],
    ['--app-nav-text','لون نص القائمة الجانبية'],
    ['--app-nav-muted','لون عناوين القائمة الجانبية'],
    ['--app-nav-active','لون العنصر النشط في القائمة'],
    ['--app-nav-active-text','لون نص العنصر النشط'],
    ['--ui-accent','لون التمييز'],
    ['--ink','لون النص'],
    ['--ink-soft','لون النص الثانوي'],
    ['--ui-border','لون الحدود']
  ];
  function load(){try{var t=JSON.parse(localStorage.getItem(KEY)||'null');if(t&&t.vars&&t.name!=='night'){t.at=Number(t.at)||0;return t;}}catch(e){}return {name:'oasis',at:0,vars:JSON.parse(JSON.stringify(PRESETS.oasis.vars))};}
  var theme=load();
  function isDark(){ if(theme.name!=='custom')return false; var h=String(theme.vars['--paper']||'').replace('#',''); if(h.length===3)h=h.split('').map(function(c){return c+c;}).join(''); if(h.length!==6)return false; var r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16); return (0.2126*r+0.7152*g+0.0722*b)/255<0.45; }
  function apply(){var r=document.documentElement.style;if(!theme.vars['--card'])theme.vars['--card']=theme.vars['--ui-surface']||'#FFFFFF';Object.keys(theme.vars).forEach(function(k){r.setProperty(k,theme.vars[k]);});
    /* التشخيص الجذري: ثيم الليل كان يغيّر المتغيرات فقط دون تفعيل الوضع الداكن الأصلي
       (221 قاعدة في app.css تعمل فقط عند :root[data-ui-theme="dark"])، فبقيت الخانات البيضاء الثابتة بيضاء.
       الآن نفعّل الوضع الداكن الأصلي نفسه فقط عند اختيار خلفية داكنة حرة من الألوان، حتى يبقى النص مقروءًا، ونزامن مفتاحه الأصلي. */
    var dark=isDark(); document.documentElement.dataset.uiTheme=dark?'dark':'light';
    try{localStorage.setItem('hwapp_ui_theme_v1',dark?'dark':'light');}catch(e){} }
  function saveLocal(){try{localStorage.setItem(KEY,JSON.stringify(theme));}catch(e){}}
  var sessionChanged=false, serverTimer=null;
  function save(){theme.at=Date.now();saveLocal();scheduleServerSave();}
  function scheduleServerSave(){try{clearTimeout(serverTimer);}catch(e){}serverTimer=setTimeout(serverSave,600);}
  function serverBase(){try{if(typeof getApi!=='function'||typeof getTok!=='function')return null;var api=getApi(),tok=getTok();if(!api||!tok)return null;return{api:api.replace(/\/+$/,''),tok:tok};}catch(e){return null;}}
  function serverNote(msg){var el=document.getElementById('thm-server-note');if(el)el.textContent=msg;}
  function serverSave(){var sb=serverBase();if(!sb)return;try{fetch(sb.api+'/theme',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:sb.tok,theme:{name:theme.name,vars:theme.vars,at:theme.at}})})
    .then(function(r){return r.ok;}).then(function(ok){serverNote(ok?'☁️ الثيم محفوظ على الخادم — يظهر على كل أجهزتك.':'⚠️ تعذّر حفظ الثيم على الخادم — محفوظ محليًا على هذا المتصفح فقط.');})
    .catch(function(){serverNote('⚠️ تعذّر الاتصال بالخادم — الثيم محفوظ محليًا فقط.');});}catch(e){}}
  function serverLoad(){var sb=serverBase();if(!sb){serverNote('💾 الحفظ محلي فقط على هذا المتصفح — اضبط عنوان الخادم وكلمة السر في الإعدادات لمزامنة الثيم على كل أجهزتك.');return;}
    try{fetch(sb.api+'/theme?t='+encodeURIComponent(sb.tok),{cache:'no-store'})
    .then(function(r){if(!r.ok)throw new Error('http'+r.status);return r.json();})
    .then(function(j){var st=j&&j.theme;
      if(!st||!st.vars){if(Number(theme.at||0)>0)scheduleServerSave();else serverNote('☁️ الربط بالخادم جاهز — سيُحفظ الثيم عليه عند تغييره.');return;}
      var sat=Number(st.at)||0,lat=Number(theme.at)||0;
      if(!sessionChanged&&sat>=lat){var clean={};Object.keys(st.vars).forEach(function(k){var v=st.vars[k];if(/^--[a-z0-9-]+$/.test(k)&&typeof v==='string'&&/^#[0-9A-Fa-f]{3,8}$/.test(v))clean[k]=v;});
        theme={name:String(st.name||'custom'),at:sat,vars:Object.assign({},JSON.parse(JSON.stringify(PRESETS.oasis.vars)),clean)};
        apply();saveLocal();sync();serverNote('☁️ تمت مزامنة الثيم من الخادم.');}
      else if(lat>sat){scheduleServerSave();}
      else{serverNote('☁️ الثيم محفوظ على الخادم — يظهر على كل أجهزتك.');}})
    .catch(function(){serverNote('⚠️ تعذّرت مزامنة الثيم مع الخادم — يُستخدم الثيم المحفوظ على هذا المتصفح.');});}catch(e){}}
  function sync(){document.querySelectorAll('#thm-settings-sheet .thm-card').forEach(function(c){c.classList.toggle('on',c.getAttribute('data-name')===theme.name);});FIELDS.forEach(function(f){var el=document.getElementById('thm-col-'+f[0]);if(el)el.value=theme.vars[f[0]]||'#123332';});}
  function setPreset(name){sessionChanged=true;theme={name:name,at:0,vars:JSON.parse(JSON.stringify(PRESETS[name].vars))};apply();save();sync();}
  function setColor(key,val){sessionChanged=true;theme.vars[key]=val;if(key==='--ui-surface')theme.vars['--card']=val;theme.name='custom';apply();save();sync();}
  function build(){
    var panel=document.getElementById('p-data');
    if(!panel||document.getElementById('thm-settings-sheet'))return;
    var sheet=document.createElement('div');
    sheet.className='sheet';sheet.id='thm-settings-sheet';
    var presetsHtml=Object.keys(PRESETS).map(function(k){var v=PRESETS[k].vars;return '<button type="button" class="thm-card" data-name="'+k+'"><span class="sw"><i style="background:'+v['--app-nav-bg']+'"></i><i style="background:'+v['--ui-accent']+'"></i><i style="background:'+v['--paper']+'"></i><i style="background:'+v['--ui-surface']+'"></i></span><b>'+PRESETS[k].label+'</b></button>';}).join('');
    var fieldsHtml=FIELDS.map(function(f){return '<div class="thm-row"><label for="thm-col-'+f[0]+'">'+f[1]+'</label><input type="color" id="thm-col-'+f[0]+'" value="'+(theme.vars[f[0]]||'#123332')+'"></div>';}).join('');
    sheet.innerHTML='<div class="sheet-head"><h2>🎨 مظهر التطبيق — تخصيص الواجهة</h2></div><p style="margin:0 0 .9rem;color:var(--ink-soft);font-size:.88rem;line-height:1.7">اختر ثيمًا جاهزًا، أو غيّر أي لون براحتك — بما فيه نص القائمة الجانبية وشريط الجوال — التغيير فوري ويُحفظ تلقائيًا على جهازك.</p><div class="thm-grid">'+presetsHtml+'</div>'+fieldsHtml+'<button type="button" class="thm-reset">استعادة تصميم الواحة</button><div class="thm-note">الثيم محفوظ في مفتاح مستقل ولا يمس أي بيانات للطلاب أو الدرجات.</div><div class="thm-note" id="thm-server-note">⏳ جارٍ التحقق من مزامنة الخادم…</div>';
    sheet.dataset.setcat='school';
    var firstSchool=null; Array.prototype.forEach.call(panel.children,function(el){ if(!firstSchool && el.dataset && el.dataset.setcat==='school') firstSchool=el; });
    if(firstSchool) panel.insertBefore(sheet,firstSchool);
    else { var bar=panel.querySelector('.set-tabs'); if(bar&&bar.nextSibling) panel.insertBefore(sheet,bar.nextSibling); else panel.insertBefore(sheet,panel.firstChild); }
    try{ var curCat=localStorage.getItem('dash_set_cat_v1')||'school'; if(curCat==='danger') curCat='school'; if(typeof window.settingsCat==='function') window.settingsCat(curCat); else if(curCat!=='all'&&curCat!=='school') sheet.classList.add('set-off'); }catch(e){}
    sheet.querySelectorAll('.thm-card').forEach(function(c){c.addEventListener('click',function(){setPreset(c.getAttribute('data-name'));});});
    FIELDS.forEach(function(f){var el=document.getElementById('thm-col-'+f[0]);if(el)el.addEventListener('input',function(){setColor(f[0],el.value);});});
    sheet.querySelector('.thm-reset').addEventListener('click',function(){setPreset('oasis');});
    sync();
    serverLoad();
  }
  apply();
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',build);}else{build();}
})();
