/* ═══════════════════════════════════════════════════════════════════
   🔔 إشعارات تسليم الطلاب (Web Push)
   الواجهة لا تحمل أي سر: المفتاح العام من الخادم، والإرسال يتم من الـ Worker
   فقط بعد حفظ تسليم حقيقي. هنا: التسجيل، الحالة، الإشعار التجريبي، وفتح التسليم.
   ═══════════════════════════════════════════════════════════════════ */
const PUSH_UI = { reg: null, sub: null, busy: false, devices: [], configured: null };
function pushEnv(){
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const secure = window.isSecureContext && /^https?:$/.test(location.protocol);
  const supported = secure && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  return { ios, standalone, secure, supported, permission: ('Notification' in window) ? Notification.permission : 'unsupported' };
}
function pushDeviceLabel(){
  const ua = navigator.userAgent || '';
  const dev = /iPhone/.test(ua) ? 'iPhone' : (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) ? 'iPad'
    : /Android/.test(ua) ? 'Android' : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'جهاز';
  const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) && !/Edg\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return br && !/iPhone|iPad/.test(dev) ? `${dev} · ${br}` : dev;
}
function pushB64ToBytes(b64u){
  const s=String(b64u||'').replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(s+'==='.slice((s.length+3)%4));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function pushApi(path, body){
  const api=getApi(); if(!api) throw new Error('no_api');
  const r=await fetch(api.replace(/\/+$/,'')+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok || j.ok===false){ const e=new Error(j.error||('http_'+r.status)); e.status=r.status; throw e; }
  return j;
}
async function pushRegisterWorker(){
  const env=pushEnv();
  if(!env.secure || !('serviceWorker' in navigator)) return null;
  try{
    const api=getApi();
    PUSH_UI.reg = await navigator.serviceWorker.register('./sw.js'+(api?`?api=${encodeURIComponent(api.replace(/\/+$/,''))}`:''), { scope: './' });
    return PUSH_UI.reg;
  }catch(e){ console.warn('sw register failed:', e); return null; }
}
async function pushCurrentSubscription(){
  const reg=PUSH_UI.reg || await pushRegisterWorker();
  if(!reg || !reg.pushManager) return null;
  try{ return await reg.pushManager.getSubscription(); }catch(_){ return null; }
}

/* عند كل فتح: إن كان مسموحًا ومشتركًا، نؤكد الاشتراك الحالي للخادم (يعالج تغيّره) */
async function pushSilentSync(){
  const env=pushEnv();
  if(!env.supported || env.permission!=='granted' || !getTok()) return;
  const sub=await pushCurrentSubscription();
  if(!sub) return;
  const prevEndpoint=localStorage.getItem('hwapp_push_endpoint_v1')||'';
  try{
    const j=await pushApi('/push/subscribe',{t:getTok(),subscription:sub.toJSON(),label:pushDeviceLabel(),
      replaceEndpoint: prevEndpoint && prevEndpoint!==sub.endpoint ? prevEndpoint : undefined});
    localStorage.setItem('hwapp_push_endpoint_v1',sub.endpoint);
    PUSH_UI.devices=j.devices||[];
  }catch(e){ console.warn('push sync:',e.message); }
}

async function pushEnable(){
  if(PUSH_UI.busy) return;
  const env=pushEnv();
  if(env.ios && !env.standalone){ pushRenderCard('للحصول على إشعارات تسليم الطلاب على iPhone، أضف «مساعد المعلم» إلى الشاشة الرئيسية ثم افتحه من الأيقونة وفعّل الإشعارات.'); return; }
  if(!env.supported){ pushRenderCard('هذا المتصفح لا يدعم إشعارات Push.'); return; }
  if(!getTok()){ toast('اضبط كلمة سر الخادم أولًا','bad'); return; }
  PUSH_UI.busy=true; pushRenderCard('جارٍ التفعيل…');
  try{
    const keyInfo=await pushApi('/push/public-key');
    if(!keyInfo.configured || !keyInfo.publicKey){ PUSH_UI.configured=false; pushRenderCard(); return; }
    // يجب أن يُطلب الإذن مباشرة من ضغطة المستخدم — شرط Safari على iPhone
    const perm = Notification.permission==='granted' ? 'granted' : await Notification.requestPermission();
    if(perm!=='granted'){ pushRenderCard(perm==='denied'
      ? 'رُفض إذن الإشعارات. فعّله من إعدادات الجهاز: الإعدادات ← الإشعارات ← مساعد المعلم.'
      : 'لم يُمنح الإذن بعد.'); return; }
    const reg=PUSH_UI.reg || await pushRegisterWorker();
    if(!reg) throw new Error('sw');
    await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    const wantKey=pushB64ToBytes(keyInfo.publicKey);
    if(sub && sub.options && sub.options.applicationServerKey){
      // تغيّر المفتاح العام على الخادم: الاشتراك القديم لن يعمل — نجدده
      const cur=new Uint8Array(sub.options.applicationServerKey);
      if(cur.length!==wantKey.length || cur.some((b,i)=>b!==wantKey[i])){ try{ await sub.unsubscribe(); }catch(_){} sub=null; }
    }
    if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:wantKey});
    const prevEndpoint=localStorage.getItem('hwapp_push_endpoint_v1')||'';
    const j=await pushApi('/push/subscribe',{t:getTok(),subscription:sub.toJSON(),label:pushDeviceLabel(),
      replaceEndpoint: prevEndpoint && prevEndpoint!==sub.endpoint ? prevEndpoint : undefined});
    localStorage.setItem('hwapp_push_endpoint_v1',sub.endpoint);
    PUSH_UI.sub=sub; PUSH_UI.devices=j.devices||[]; PUSH_UI.configured=true;
    toast('تم تفعيل إشعارات تسليم الطلاب على هذا الجهاز ✓','good');
    pushRenderCard();
  }catch(e){
    console.error('pushEnable:',e);
    pushRenderCard(e.status===401 ? 'كلمة سر الخادم غير صحيحة.' : e.message==='too_many_devices' ? 'وصلت للحد الأقصى من الأجهزة (10). احذف جهازًا قديمًا أولًا.' : 'تعذّر التفعيل. تأكد من الاتصال ثم أعد المحاولة.');
  }finally{ PUSH_UI.busy=false; }
}
async function pushSendTest(){
  if(PUSH_UI.busy) return;
  PUSH_UI.busy=true;
  try{
    const j=await pushApi('/push/test',{t:getTok()});
    toast(j.sent ? `أُرسل إشعار تجريبي إلى ${j.sent} ${j.sent===1?'جهاز':'أجهزة'} — أغلق التطبيق للتأكد من وصوله` : 'لا توجد أجهزة نشطة. فعّل الإشعارات أولًا.', j.sent?'good':'bad');
    await pushRefreshStatus();
  }catch(e){ toast(e.message==='push_not_configured'?'مفاتيح VAPID غير مضبوطة في الخادم':'تعذّر إرسال الإشعار التجريبي','bad'); }
  finally{ PUSH_UI.busy=false; }
}
async function pushDisableThisDevice(){
  const sub=await pushCurrentSubscription();
  try{
    if(sub){ await pushApi('/push/unsubscribe',{t:getTok(),endpoint:sub.endpoint}); await sub.unsubscribe(); }
    localStorage.removeItem('hwapp_push_endpoint_v1');
    toast('أُوقفت الإشعارات على هذا الجهاز','good');
  }catch(e){ toast('تعذّر الإيقاف','bad'); }
  await pushRefreshStatus();
}
async function pushRemoveDevice(id){
  try{ await pushApi('/push/unsubscribe',{t:getTok(),id}); }catch(_){}
  await pushRefreshStatus();
}
async function pushRefreshStatus(){
  if(!getApi() || !getTok()){ pushRenderCard(); return; }
  try{
    PUSH_UI.sub=await pushCurrentSubscription();
    const j=await pushApi('/push/status',{t:getTok(),endpoint:PUSH_UI.sub?PUSH_UI.sub.endpoint:''});
    PUSH_UI.configured=!!j.configured; PUSH_UI.devices=j.devices||[]; if(j.prefs) PUSH_UI.prefs=j.prefs;
  }catch(e){ PUSH_UI.configured=null; }
  pushRenderCard();
}
function pushRenderCard(message){
  const box=document.getElementById('push-settings-body'); if(!box) return;
  const env=pushEnv();
  const current=PUSH_UI.devices.find(d=>d.current);
  const active=!!(env.permission==='granted' && PUSH_UI.sub && current);
  const pill=document.getElementById('push-settings-status');
  if(pill){ pill.textContent=active?'🟢 الإشعارات مفعلة':'🔴 الإشعارات غير مفعلة'; pill.className='pill '+(active?'push-on':'push-off'); }
  let hint='';
  if(PUSH_UI.configured===false) hint='الخادم غير مُعد للإشعارات بعد: أضف VAPID_PUBLIC_KEY وVAPID_PRIVATE_KEY وVAPID_SUBJECT في إعدادات الـ Worker.';
  else if(!env.secure) hint='الإشعارات تعمل فقط عند فتح اللوحة من رابط https (وليس كملف على الجهاز).';
  else if(env.ios && !env.standalone) hint='للحصول على إشعارات تسليم الطلاب على iPhone، أضف «مساعد المعلم» إلى الشاشة الرئيسية (Safari ← مشاركة ← إضافة إلى الشاشة الرئيسية) ثم افتحه من الأيقونة وفعّل الإشعارات.';
  else if(!env.supported) hint='هذا المتصفح لا يدعم إشعارات Push. على iPhone يلزم iOS 16.4 أو أحدث مع فتح التطبيق من الشاشة الرئيسية.';
  else if(env.permission==='denied') hint='إذن الإشعارات مرفوض على هذا الجهاز. فعّله من إعدادات الجهاز ثم ارجع هنا.';
  const canEnable = PUSH_UI.configured!==false && env.supported && !(env.ios && !env.standalone) && env.permission!=='denied';
  box.innerHTML=`
    <p class="push-lead">يصلك إشعار على أجهزتك عند تسليم الطلاب ورسائلهم — حتى لو كان التطبيق مغلقًا. اختر الأنواع من الأسفل.</p>
    ${message?`<div class="push-msg">${esc(message)}</div>`:''}
    ${hint?`<div class="push-hint">${esc(hint)}</div>`:''}
    <div class="row" style="gap:.5rem;flex-wrap:wrap;margin:.7rem 0">
      ${active
        ? `<button class="btn tick" type="button" onclick="pushSendTest()">📨 إرسال إشعار تجريبي</button>
           <button class="btn ghost" type="button" onclick="pushDisableThisDevice()">إيقاف على هذا الجهاز</button>`
        : `<button class="btn tick" type="button" onclick="pushEnable()" ${canEnable?'':'disabled'}>🔔 تفعيل إشعارات تسليم الطلاب</button>
           ${PUSH_UI.devices.length?`<button class="btn ghost" type="button" onclick="pushSendTest()">📨 إرسال إشعار تجريبي</button>`:''}`}
    </div>
    ${PUSH_UI.devices.length?`<div class="push-devices">
      <b>الأجهزة المسجلة (${PUSH_UI.devices.length})</b>
      ${PUSH_UI.devices.map(d=>`<div class="push-device">
        <span>${d.label==='iPhone'||d.label==='iPad'?'📱':'💻'} ${esc(d.label)}${d.current?' <em>· هذا الجهاز</em>':''}</span>
        <small>${d.lastOkAt?'آخر وصول '+fmtDate(d.lastOkAt)+' '+fmtTime(d.lastOkAt):d.lastError?'⚠️ تعذّر آخر إرسال':'لم يُرسل له بعد'}</small>
        ${d.current?'':`<button class="btn ghost sm" type="button" onclick="pushRemoveDevice('${esc(d.id)}')">حذف</button>`}
      </div>`).join('')}
    </div>`:''}
    ${PUSH_UI.prefs?pushPrefsHTML(PUSH_UI.prefs):''}`;
}
/* 🎛️ ما الذي يصلك: لكل نوع مفتاح، وساعات هدوء اختيارية. يُحفظ في الخادم فيسري على كل أجهزتك.
   المكتوم لا يُرسل إشعارًا فقط — التسليمات والرسائل تبقى في اللوحة كالعادة */
const PUSH_CAT_UI=[
  ['act','📝','حل الأنشطة والواجبات','الأنشطة العادية والفهم القرائي والتشخيصي'],
  ['files','📎','تسليم المشاريع والملفات','ملفات بانتظار مراجعتك'],
  ['games','🎮','الألعاب التعليمية','نتيجة الطالب في اللعبة'],
  ['lab','🔬','المختبر الافتراضي','إجراء تجربة'],
  ['resub','🔁','إعادة التسليم','طالب أعاد حل نشاط سلّمه قبل'],
  ['review','🔎','إنهاء مهمة المراجعة','بعد تصحيح أخطائه'],
  ['ask','💬','رسائل وأسئلة الطلاب','سؤال جديد أو رد على رسالتك'],
  ['wall','🧱','منشورات الجدار','منشور ينتظر اعتمادك'],
  ['lesson','⏰','بداية الحصة','من جدولك — بضغطة يفتح رصد الفصل'],
  ['task','📌','تذكيراتي','مهامك من «اليوم ← مهام اليوم» في موعدها']];
function pushPrefsHTML(P){
  const hrs=v=>Array.from({length:24},(_,h)=>`<option value="${h}" ${h===v?'selected':''}>${h===0?'12 ص':h<12?h+' ص':h===12?'12 م':(h-12)+' م'}</option>`).join('');
  const off=PUSH_CAT_UI.filter(([k])=>P.on[k]===false).length;
  return `<div class="push-prefs">
    <b>🎛️ ما الذي يصلك؟ <small>${off?`${off} ${off===1?'نوع موقوف':'أنواع موقوفة'}`:'كل الأنواع مفعّلة'}</small></b>
    ${PUSH_CAT_UI.map(([k,ic,t,sub])=>`<label class="push-pref"><span class="pp-ic">${ic}</span><span class="pp-t">${t}<small>${sub}</small></span>
      <input type="checkbox" class="pp-sw" ${P.on[k]!==false?'checked':''} onchange="pushPrefSet('${k}',this.checked)"></label>`).join('')}
    <label class="push-pref"><span class="pp-ic">🌙</span><span class="pp-t">ساعات الهدوء<small>لا تصل إشعارات في هذا الوقت (توقيت المدرسة)</small></span>
      <input type="checkbox" class="pp-sw" ${P.quiet.on?'checked':''} onchange="pushPrefSet('quiet',this.checked)"></label>
    ${P.quiet.on?`<div class="push-quiet">من <select class="inp" onchange="pushPrefSet('from',+this.value)">${hrs(P.quiet.from)}</select> إلى <select class="inp" onchange="pushPrefSet('to',+this.value)">${hrs(P.quiet.to)}</select></div>`:''}
    <small class="push-prefs-note">يسري على كل أجهزتك. المكتوم يبقى ظاهرًا في اللوحة، لكن بدون إشعار.</small>
  </div>`;
}
async function pushPrefSet(k,v){
  const P=JSON.parse(JSON.stringify(PUSH_UI.prefs||{on:{},quiet:{on:false,from:22,to:6}}));
  if(k==='quiet') P.quiet.on=!!v; else if(k==='from'||k==='to') P.quiet[k]=v; else P.on[k]=!!v;
  const old=PUSH_UI.prefs; PUSH_UI.prefs=P; pushRenderCard();
  try{ const j=await pushApi('/push/prefs',{t:getTok(),prefs:P}); PUSH_UI.prefs=j.prefs; toast('✓ حُفظ','good'); }
  catch(e){ PUSH_UI.prefs=old; toast('تعذّر الحفظ — تحقق من الاتصال','bad'); }
  pushRenderCard();
}

/* فتح التسليم الذي أرسل الإشعار: «آخر التسليمات» ثم إبراز الصف */
async function openSubmissionFromPush(data){
  if(!data) return;
  // ⏰ تنبيه حصة/تذكير (بوابة المعلم داخل اللوحة): يفتح البوابة نفسها
  // ⏰ تنبيه حصة: رصد فصلها في اللوحة · تذكير: «تذكيراتي»
  if(data.type==='lesson'){ const t0=Date.now(); let kick=false; const go=()=>{ if(typeof tpx3Load==='function'&&typeof CT_DATA!=='undefined'&&CT_DATA){ tpx3Load().then(()=>window.tpx3LessonOpen(data.d,data.p)).then(()=>{ if(typeof fmEnter==='function'&&window._ctRcCls){ window._fmCls=window._ctRcCls; fmEnter('r'); } }).catch(()=>{}); return; } if(!kick&&Date.now()-t0>2500&&typeof ctGo==='function'){ kick=true; try{ ctGo('schedule'); }catch(e){} } if(Date.now()-t0<15000) setTimeout(go,300); }; go(); return; }
  if(data.type==='task'){ const t0=Date.now(); const go=()=>{ if(typeof rmgOpen==='function'&&typeof CT_DATA!=='undefined'&&CT_DATA){ try{ rmgOpen(); }catch(e){} } else if(Date.now()-t0<15000) setTimeout(go,300); }; setTimeout(go,600); return; }
  // 🧰 من بوابة المعلم: الشهادات/المستويات/المهام في «أدوات الفصل»
  if(data.open==='ct' && /^(certs|levels|duties)$/.test(data.tab||'')){ const t0=Date.now(); const go=()=>{ if(typeof ctGo==='function'){ try{ ctGo(data.tab); }catch(e){} } else if(Date.now()-t0<8000) setTimeout(go,300); }; setTimeout(go,600); return; }
  // 📂 «الملف الكامل» من بوابة المعلم
  if(data.open==='student' && data.sid){ const t0=Date.now(); const go=()=>{ if(typeof byId==='function' && byId(data.sid)) openStudentProfile(data.sid); else if(Date.now()-t0<8000) setTimeout(go,300); }; go(); return; }
  if(data.type==='wall' || data.open==='wall'){ goTab('walls'); if(data.id) setTimeout(()=>{ try{ wallOpen(String(data.id)); }catch(_){} },500); return; }
  if(data.type==='ask' || data.open==='asks'){
    // الضغط على التنبيه واللوحة مفتوحة: الرسالة نفسها مع التنبيه، طبّقها فورًا بدل انتظار الجلب (نسخة الخادم قد تتأخر دقيقة)
    if(data.item && typeof askApplyPush==='function'){ try{ askApplyPush(data.item); }catch(_){} }
    goTab('dashboard'); setTimeout(()=>asksOpen(),400); return;
  }
  if(data.type==='test' || data.open==='notifications'){ goTab('data'); setTimeout(()=>document.getElementById('push-settings-sheet')?.scrollIntoView({block:'start',behavior:'smooth'}),150); return; }
  goTab('dashboard');
  // عند الفتح البارد تكون اللوحة في منتصف مزامنتها الأولى: ننتظرها ثم نجلب التسليمات
  try{
    const t0=Date.now();
    while(Date.now()-t0<8000 && ((typeof liveChecking!=='undefined' && liveChecking) || (typeof _pulling!=='undefined' && _pulling))) await new Promise(r=>setTimeout(r,200));
    if(typeof checkLiveSubmissions==='function') await checkLiveSubmissions(true);
  }catch(_){}
  const h=HW.find(x=>String(x.sid)===String(data.hw) || String(x.id)===String(data.hw));
  const sid=String(data.sid||'');
  // اللوحة تعيد رسم «آخر التسليمات» بعد المزامنة فيُستبدل الصف — نعيد الإبراز حتى يستقر
  const until=Date.now()+5000; let scrolled=false, seen=false;
  const tick=()=>{
    const row=h && document.querySelector(`#dash-recent [data-sub-hw="${CSS.escape(String(h.id))}"][data-sub-sid="${CSS.escape(sid)}"]`);
    if(row){
      seen=true;
      if(!row.classList.contains('push-focus')) row.classList.add('push-focus');
      if(!scrolled){ row.scrollIntoView({block:'center',behavior:'smooth'}); scrolled=true; }
    }
    if(Date.now()<until){ setTimeout(tick,300); return; }
    if(row) setTimeout(()=>row.classList.remove('push-focus'),2500);
    // خارج آخر 7 تسليمات: نفتح ملف الطالب مباشرة
    else if(!seen){
      if(sid && typeof byId==='function' && byId(sid)) openStudentProfile(sid);
      else toast('وصل التسليم — حدّث الصفحة إن لم يظهر بعد','good');
    }
  };
  setTimeout(tick,200);
}
function pushHandleLaunchParams(){
  const q=new URLSearchParams(location.search);
  const open=q.get('open');
  if(!open) return;
  const data= open==='submission' ? {type:'submission',hw:q.get('hw'),sid:q.get('sid'),at:Number(q.get('at'))||0} : open==='wall' ? {type:'wall',id:q.get('id')} : open==='student' ? {open,sid:q.get('sid')} : open==='ct' ? {open,tab:q.get('tab')} : open==='lesson' ? {type:'lesson',d:q.get('d'),p:q.get('p')} : open==='tasks' ? {type:'task'} : {open};
  try{ history.replaceState(null,'',location.pathname+location.hash); }catch(_){}
  setTimeout(()=>openSubmissionFromPush(data),900);   // بعد اكتمال أول رسم ومزامنة
}
if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('message', ev=>{
    if(ev.data && ev.data.type==='push-open') openSubmissionFromPush(ev.data.data);
    // 🔔 إشعار تسليم وصل الآن واللوحة مفتوحة ⇒ أظهره فورًا
    if(ev.data && ev.data.type==='push-sub' && ev.data.data){ const d=ev.data.data;
      // ⚡ البيانات في الإشعار نفسه تُعرض فورًا؛ ثم مزامنة للتأكيد (قد يعيد الخادم نسخة قديمة لدقيقة — لا تمحو ما عُرض)
      if(d.type==='ask'){ try{ askApplyPush(d.item); }catch(e){} }
      else if(d.type==='wall'){ try{ wallBadgeRefresh(true); }catch(e){} }
      else if(d.hw){ try{ liveApplyPushRow(d); }catch(e){} try{ liveCheckOne(String(d.hw)); }catch(e){} try{ projBadgeRefresh(true); }catch(e){} } }
    // ⚡ اللوحة تُفتح من النسخة المحفوظة على الجهاز؛ إن وُجد إصدار أحدث نعرض زر تحديث بدل إعادة تحميل مفاجئة
    if(ev.data && ev.data.type==='dash-update') APPUPD.mark();
  });
}
function dashShowUpdate(auto){
  if(document.getElementById('dash-upd')) return;
  const b=document.createElement('div'); b.id='dash-upd';
  b.style.cssText='position:fixed;inset-inline:12px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:3000;max-width:460px;margin:auto;background:#16233A;color:#fff;border-radius:14px;padding:10px 12px;display:flex;align-items:center;gap:10px;font-weight:700;font-size:.9rem;box-shadow:0 10px 30px rgba(0,0,0,.25)';
  /* ⬆ «لازم آخر نسخة»: يظهر فقط وأنت وسط عمل (كتابة/رصد/نافذة) — لا يُغلق، ويُحدَّث وحده حين تنتهي */
  b.innerHTML='<span style="flex:1">🔄 تحديث مطلوب للوحة<small style="display:block;font-weight:500;opacity:.75;font-size:.78em">يُحدَّث وحده حين تنتهي مما تعمله</small></span><button type="button" style="font:inherit;font-weight:800;border:0;border-radius:10px;padding:7px 12px;background:#1B9C6B;color:#fff;cursor:pointer">تحديث الآن</button>';
  b.children[1].onclick=()=>APPUPD.apply();
  document.body.appendChild(b);
}
/* 🔄 فحص الإصدار من الصفحة نفسها (مع العودة إليها، وكل 10 دقائق): تُقارَن أرقام إصدار الملفات (?v=) في الصفحة
   المفتوحة بنسخة الخادم الحالية — بمعامل فريد يتجاوز أي ذاكرة مؤقتة — وإن اختلفت يظهر زر «تحديث الآن» */
/* 🏷️ رقم إصدار اللوحة v1.0.N (يزيده stamp_dashboard.py مع كل تعديل) وحالته من فحص الإصدار نفسه:
   ✓ الأحدث · ⬆ يوجد أحدث (اضغط للتحديث) · لم يُتحقق بعد (اضغط للتحقق). يظهر في القائمة الجانبية و«المزيد» */
const APPVER = { v: ((document.querySelector('meta[name="app-version"]') || {}).content || ''), state: '', next: '', at: 0 };
function appVerHTML(){
  const v = APPVER.v ? 'v' + APPVER.v : '—', st = APPVER.state;
  const s = st === 'latest' ? '<b class="av-ok">✓ أحدث إصدار</b>' : st === 'update' ? '<b class="av-up">⬆ يوجد إصدار أحدث — اضغط للتحديث</b>' : st === 'checking' ? '<span>جارٍ التحقق…</span>' : st === 'fail' ? '<span>تعذّر التحقق — اضغط للمحاولة</span>' : '<span>اضغط للتحقق من التحديث</span>';
  return `<span class="av-n">الإصدار <bdi>${v}</bdi></span>${s}`;
}
function appVerPaint(){ document.querySelectorAll('[data-appver]').forEach(e => { e.innerHTML = appVerHTML(); e.dataset.st = APPVER.state || ''; }); }
function appVerTap(){ if(APPVER.state === 'update') location.reload(); else if(window.appVerCheck) window.appVerCheck(); }
document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-appver]'); if(t){ e.preventDefault(); appVerTap(); } });
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', appVerPaint, { once:true }); else setTimeout(appVerPaint, 0);
(function verWatch(){
  const sig = html => [...String(html).matchAll(/(?:href|src)="([^"]+\?v=[0-9a-f]+)"/g)].map(m => m[1]).sort().join('|') + '|' + ((/name="app-version" content="([^"]+)"/.exec(String(html)) || [])[1] || '');
  const mine = sig(document.documentElement.outerHTML);
  if(!mine) return;
  /* 📱 تطبيق الشاشة الرئيسية في iPhone: عند الرجوع إليه «يُستأنف» ولا يُعاد فتحه — قد لا يصل حدث الظهور، والمؤقتات متوقفة
     طوال غيابه، وأول طلب بعد الاستئناف قد يعلق على اتصال جمّده النظام (لا ينتهي حتى تتغير الشبكة). فكان الزر لا يظهر
     إلا بإطفاء الواي فاي. الآن: مهلة 10 ث للفحص ثم إعادة، ويُفحص أيضًا عند التركيز والعودة للشبكة واكتشاف الاستئناف */
  let last = 0, busy = false, retry = 0;
  const check = async (force) => {
    if(document.hidden || busy || (!force && Date.now() - last < 60000)) return; last = Date.now(); busy = true;
    const ac = window.AbortController ? new AbortController() : null, to = setTimeout(() => { try{ ac && ac.abort(); }catch(e){} }, 10000);
    let ok = false; const t0 = Date.now();
    try{
      const r = await fetch(location.pathname + '?_sw=' + Date.now().toString(36), { cache: 'no-store', credentials: 'same-origin', ...(ac ? { signal: ac.signal } : {}) });
      if(!r.ok) APPVER.err = 'ردّ الموقع ' + r.status + ' بعد ' + (Date.now() - t0) + ' م.ث';
      if(r.ok){ const html = await r.text(), other = sig(html); ok = true; if(other && other !== mine){ APPVER.state = 'update'; APPVER.next = (/name="app-version" content="([^"]+)"/.exec(html) || [])[1] || ''; APPUPD.mark(); } else if(other) APPVER.state = 'latest'; APPVER.at = Date.now(); appVerPaint(); }
    }catch(e){ APPVER.err = (e && e.name === 'AbortError' ? 'انتهت المهلة (10 ث)' : 'فشل الاتصال: ' + ((e && (e.message || e.name)) || '؟')) + ' بعد ' + (Date.now() - t0) + ' م.ث'; }
    clearTimeout(to);
    /* 🛰️ الموقع لا يرد مباشرة (تطبيق الآيفون على بعض شبكات الواي فاي): نفس الصفحة عبر خادم البيانات */
    if(!ok){ try{ const api = (typeof getApi === 'function' ? String(getApi() || '') : '').replace(/\/+$/, '');
      if(api){ const r2 = await fetch(`${api}/site?h=${encodeURIComponent(location.host)}&p=${encodeURIComponent(location.pathname)}`, { cache: 'no-store' });
        if(r2.ok){ const html = await r2.text(), other = sig(html); if(other.length > 1){ ok = true; APPVER.via = 'server';
          if(other !== mine){ APPVER.state = 'update'; APPVER.next = (/name="app-version" content="([^"]+)"/.exec(html) || [])[1] || ''; APPUPD.mark(); } else APPVER.state = 'latest'; APPVER.at = Date.now(); appVerPaint(); } } } }catch(e){} }
    busy = false;
    if(!ok && !document.hidden){ clearTimeout(retry); retry = setTimeout(() => check(true), 5000); }   // علق أو فشل: محاولة جديدة باتصال جديد
  };
  /* الضغط: ينتظر فحصًا جاريًا (كان يُحكم بالفشل فورًا إن صادف فحصًا في الخلفية) */
  window.appVerCheck = async () => { APPVER.state = 'checking'; appVerPaint();
    for(let i = 0; busy && i < 60; i++) await new Promise(r => setTimeout(r, 200));
    await check(true); if(APPVER.state === 'checking'){ APPVER.state = 'fail'; appVerPaint(); } };
  const back = () => { if(!document.hidden) check(); };
  document.addEventListener('visibilitychange', back);
  addEventListener('pageshow', back); addEventListener('focus', back); addEventListener('online', () => check(true));
  /* الاستئناف بلا حدث: مؤقت كل 15 ث — إن مرّ بين نبضتين أكثر من دقيقة فالتطبيق كان مجمّدًا */
  let beat = Date.now(); setInterval(() => { const n = Date.now(); if(n - beat > 60000) check(true); beat = n; }, 15000);
  setTimeout(check, 4000); setInterval(check, 600000);   // مبكرًا: يُكتشف التحديث عند الفتح قبل أن تبدأ العمل
})();
(function pushBoot(){
  const run=()=>{ pushRegisterWorker().then(()=>{ pushSilentSync(); pushRefreshStatus(); }); pushHandleLaunchParams(); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else setTimeout(run,0);
})();


/* 📱 الشريط السفلي في الجوال: سفاري iOS أحيانًا يترك العناصر الثابتة (bottom:0) مرتفعة عن أسفل الشاشة
   — بعد إغلاق لوحة المفاتيح أو تصغير شريط العنوان — حتى تُعاد رسم الصفحة. نقيس الفجوة الفعلية
   بين أسفل الشريط وأسفل الشاشة المرئية ونُنزله بمقدارها. لا نرفعه أبدًا (حتى لا يغطي لوحة المفاتيح). */
(function mobileNavPin(){
  const vv=window.visualViewport; if(!vv) return;
  let nav=null, cur=0, raf=0;
  const fix=()=>{ raf=0;
    nav=nav||document.getElementById('simp-bottomnav'); if(!nav) return;   // الشريط السفلي الجديد (القديم حُذف)
    if(innerWidth>700 || vv.scale>1.05 || getComputedStyle(nav).display==='none'){ if(cur){ cur=0; nav.style.transform=''; } return; }
    const base=nav.getBoundingClientRect().bottom-cur;              // موضعه بلا تصحيح
    const gap=Math.round(vv.offsetTop+vv.height-base);
    const want=gap>2?gap:0;
    if(want!==cur){ cur=want; nav.style.transform=want?`translate3d(0,${want}px,0)`:''; }
  };
  const later=()=>{ if(!raf) raf=requestAnimationFrame(fix); };
  vv.addEventListener('resize',later); vv.addEventListener('scroll',later);
  addEventListener('scroll',later,{passive:true}); addEventListener('orientationchange',()=>setTimeout(fix,350));
  addEventListener('focusout',()=>setTimeout(fix,300)); addEventListener('pageshow',()=>setTimeout(fix,100));
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) setTimeout(fix,200); });
  if('onscrollend' in window) addEventListener('scrollend',fix);
  setTimeout(fix,500);
})();

window.__APPUPD_CFG={api:()=>getApi(),show:()=>dashShowUpdate(true),name:'مساعد المعلم',
  busy:()=>{const m=document.getElementById('modal');return !!(m&&m.innerHTML.trim()&&m.offsetParent!==null&&getComputedStyle(m).visibility!=='hidden')||!!document.querySelector('.opv-veil,dialog[open]')}};
/* ⬆ شاشة «جارٍ تحديث التطبيق» (بشعار التطبيق) أثناء تنزيل الإصدار الأحدث وإعادة الفتح */
function updOverlay(name){
  if(document.getElementById('upd-ov')) return; const o=document.createElement('div'); o.id='upd-ov'; o.setAttribute('role','status');
  o.style.cssText='position:fixed;inset:0;z-index:100000;background:#F5F7F9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:inherit;color:#0F1A24';
  const nx=(typeof APPVER!=='undefined'&&APPVER.next)?' — v'+APPVER.next:'';
  o.innerHTML='<svg width="88" height="88" viewBox="0 0 512 512" style="border-radius:20px;box-shadow:0 10px 30px rgba(15,157,116,.25)"><rect width="512" height="512" fill="#0F9D74"/><g transform="translate(256 256) scale(10.67) translate(-12 -12)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></g></svg>'
    +'<b style="font-size:1.35rem">'+(name||'مساعد المعلم')+'</b><span style="font-size:.95rem;color:#5B6B7B">جارٍ تحديث التطبيق…'+nx+'</span>'
    +'<i style="width:150px;height:5px;border-radius:9px;background:#E3E8ED;overflow:hidden;position:relative"><i style="position:absolute;inset:0;width:40%;border-radius:9px;background:#0F9D74;animation:updMove 1.1s ease-in-out infinite alternate"></i></i>'
    +'<style>@keyframes updMove{from{transform:translateX(0)}to{transform:translateX(-150%)}}</style>';
  document.body.appendChild(o);
}
/* ملف الخلفية ينزّل الإصدار الأحدث كاملًا ويحفظه قبل إعادة الفتح (مباشرة أو عبر الخادم) — حد أقصى 25 ث */
async function updSwRefresh(){
  try{ const reg=navigator.serviceWorker&&await navigator.serviceWorker.getRegistration('./'), sw=reg&&reg.active; if(!sw) return;
    await new Promise(res=>{ const ch=new MessageChannel(), to=setTimeout(res,25000); ch.port1.onmessage=()=>{ clearTimeout(to); res(); }; sw.postMessage({type:'dash-refresh'},[ch.port2]); }); }catch(e){}
}
/* 🔄 «لازم آخر نسخة» — إن وُجد إصدار أحدث:
   • عند الفتح أو الرجوع للتطبيق (أول 30 ث): شاشة «جارٍ تحديث التطبيق» وإعادة الفتح عليه فورًا — بلا خيار «لاحقًا».
   • وسط عمل (كتابة، رصد، نافذة مفتوحة): شريط «تحديث مطلوب» لا يُغلق، ويُحدَّث وحده حين تنتهي (دقيقة بلا لمس) أو تخرج من التطبيق.
   • بلا اتصال أو تعذّر التحقق: يعمل بالنسخة المحفوظة.
   حماية: محاولتان تلقائيتان على الأكثر كل 3 دقائق (لا دوامة إعادة تحميل). و«إجبار كل الأجهزة» من الإعدادات كما هو. */
const APPUPD=(()=>{
  const CFG=window.__APPUPD_CFG||{},LS=CFG.key||'app_force_seen',T0=Date.now();let pending=false,hard=0,since=0,lastAct=Date.now(),lastInput=0,hidAt=0,visAt=Date.now(),going=false;
  addEventListener('input',()=>{lastInput=Date.now()},true);
  ['pointerdown','keydown','wheel','touchstart'].forEach(e=>addEventListener(e,()=>{lastAct=Date.now()},{capture:true,passive:true}));
  const editing=()=>{const a=document.activeElement;return !!(a&&(a.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))&&!/^(button|checkbox|radio|range|submit)$/i.test(a.type||''))};
  const busy=()=>editing()||Date.now()-lastInput<20000||!!(CFG.busy&&CFG.busy());
  const tries=()=>{try{const x=JSON.parse(sessionStorage.getItem('upd_auto')||'null');return x&&Date.now()-x.at<180000?x.n:0}catch(e){return 0}};
  async function apply(){
    if(going)return;going=true;
    try{updOverlay(CFG.name)}catch(e){}
    try{sessionStorage.setItem('upd_auto',JSON.stringify({n:tries()+1,at:Date.now()}))}catch(e){}
    if(hard){try{localStorage.setItem(LS,String(hard))}catch(e){}
      try{if(window.caches)for(const k of await caches.keys())await caches.delete(k)}catch(e){}
      try{const R=navigator.serviceWorker&&navigator.serviceWorker.getRegistrations?await navigator.serviceWorker.getRegistrations():[];await Promise.all(R.map(r=>r.update().catch(()=>{})))}catch(e){}}
    else await updSwRefresh();
    location.reload();
  }
  const fresh=()=>Date.now()-T0<30000||Date.now()-visAt<30000;
  function tick(){if(!pending||going)return;
    const idle=Date.now()-lastAct>60000,late=Date.now()-since>4*3600e3;
    if((idle&&!busy())||(late&&!editing()&&Date.now()-lastInput>120000))apply()}
  function mark(h){if(h)hard=Math.max(hard,h);if(!pending){pending=true;since=Date.now()}
    if(!going&&fresh()&&!busy()&&tries()<2){apply();return}
    if(CFG.show)try{CFG.show()}catch(e){}}
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){hidAt=Date.now();if(pending&&!busy())apply();return}
    visAt=Date.now();
    if(pending&&hidAt&&Date.now()-hidAt>15000&&!busy())apply();else checkForce()});
  async function checkForce(){
    if(!CFG.api)return;let api='';try{api=String(CFG.api()||'').replace(/\/+$/,'')}catch(e){}if(!api)return;
    try{const v=window.__hwVer;window.__hwVer=null;   // أول فحص يستخدم ردّ /version الذي طلبته الصفحة عند الفتح
      const j=v?await v:await (await fetch(api+'/version',{cache:'no-store'})).json(),f=Number(j&&j.force)||0;let seen=0;try{seen=Number(localStorage.getItem(LS))||0}catch(e){}
      if(f>seen){if(!seen&&performance.now()<15000&&Date.now()-f>86400e3){try{localStorage.setItem(LS,String(f))}catch(e){}return}   // جهاز جديد فُتح الآن بعد طلب قديم: هو أصلًا أحدث نسخة
        mark(f);tick()}}catch(e){}
  }
  setInterval(tick,5000);setTimeout(checkForce,4000);setInterval(checkForce,600000);
  return {mark,apply,get pending(){return pending}};
})();

async function appForceAll(btn){
  if(!getApi()||!getTok()){ toast('اضبط عنوان الخادم وكلمة السر أولًا','bad'); return; }
  if(typeof askConfirm==='function' && !(await askConfirm('كل الأجهزة المفتوحة (لوحتك وبوابات الطلاب) تمسح نسختها المحفوظة وتعيد التحميل مرة واحدة، في أول لحظة لا يكون فيها أحد يكتب أو يحل نشاطًا. متابعة؟'))) return;
  if(btn) btn.disabled=true;
  try{ const r=await fetch(getApi().replace(/\/+$/,'')+'/app/force',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok()})}); const j=await r.json();
    if(!j.ok) throw new Error(j.error||'fail'); try{ localStorage.setItem('app_force_seen',String(j.at)); }catch(e){}
    const o=document.getElementById('app-force-last'); if(o) o.textContent='آخر طلب: '+fmtDate(j.at)+' '+fmtTime(j.at);
    toast('✓ أُرسل طلب التحديث — يصل لكل جهاز خلال 10 دقائق أو عند فتحه','good'); }
  catch(e){ toast(/unauthorized/.test(e.message)?'كلمة السر غير صحيحة':'تعذّر الإرسال — هل رفعت worker.js الجديد؟','bad'); }
  if(btn) btn.disabled=false;
}

try{ localStorage.removeItem('hwapp_start_portal_v1'); }catch(e){}   // الفتح الذكي على البوابة أُلغي مع البوابة

/* 🔐 الأجهزة المسجّل دخولها: قائمة الجلسات، وإلغاء جهاز، وإخراج الكل عدا هذا، والخروج من هذا الجهاز */
async function devCall(path, extra){
  const r=await fetch(getApi().replace(/\/+$/,'')+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),...(extra||{})})});
  const j=await r.json().catch(()=>({})); if(!r.ok||j.ok===false) throw new Error(j.error||('http_'+r.status)); return j;
}
async function devLoad(){
  const box=document.getElementById('dev-list'); if(!box) return;
  if(!/^ts1\./.test(getTok())){ box.innerHTML='<p class="muted" style="font-size:.86rem">هذا الجهاز ما زال يستخدم كلمة السر مباشرة. ارفع worker.js الجديد ثم أعد فتح اللوحة، فيتحول لدخول خاص به تلقائيًا.</p><button class="btn ghost" type="button" onclick="devLoad()">🔄 إعادة المحاولة</button>'; if(window.hwAuthUpgrade) hwAuthUpgrade(); return; }
  box.innerHTML='<p class="muted">جارٍ التحميل…</p>';
  let j; try{ j=await devCall('/auth/sessions'); }catch(e){ box.innerHTML='<p class="muted">تعذّر التحميل.</p><button class="btn ghost" type="button" onclick="devLoad()">🔄 إعادة المحاولة</button>'; return; }
  const L=(j.sessions||[]).slice().sort((a,b)=>(b.id===j.current)-(a.id===j.current)||(b.lastAt||0)-(a.lastAt||0));
  const ago=t=>{ if(!t) return '—'; const m=Math.round((Date.now()-t)/60000); return m<60?'قبل قليل':m<1440?`قبل ${Math.round(m/60)} ساعة`:`قبل ${Math.round(m/1440)} يوم`; };
  box.innerHTML=`<div class="push-devices" style="border:0;padding:0">${L.map(d=>`<div class="push-device">
      <span>${/iPhone|Android/.test(d.label)?'📱':/iPad/.test(d.label)?'📲':'💻'} ${esc(d.label)}${d.id===j.current?' <em>· هذا الجهاز</em>':''}${d.temp?' <em style="color:#B7791F">· مؤقت</em>':''}</span>
      <small>دخل ${fmtDate(d.createdAt)} · آخر استخدام ${ago(d.lastAt)}</small>
      ${d.id===j.current?'':`<button class="btn ghost sm" type="button" onclick="devRevoke('${esc(d.id)}')">إلغاء دخوله</button>`}
    </div>`).join('')||'<p class="muted">لا توجد أجهزة.</p>'}</div>
    <div class="row" style="gap:.5rem;flex-wrap:wrap;margin-top:.7rem">
      ${L.length>1?'<button class="btn ghost" type="button" onclick="devRevoke(\'others\')">إخراج كل الأجهزة الأخرى</button>':''}
      <button class="btn ghost" type="button" onclick="devLogout()">🚪 خروج من هذا الجهاز</button>
      <button class="btn ghost" type="button" onclick="devLoad()">🔄 تحديث</button></div>`;
}
async function devRevoke(id){
  if(typeof askConfirm==='function' && !(await askConfirm(id==='others'?'كل أجهزتك الأخرى ستحتاج كلمة السر من جديد. متابعة؟':'هذا الجهاز سيحتاج كلمة السر من جديد. متابعة؟'))) return;
  try{ const j=await devCall('/auth/revoke',{id}); toast(`✓ أُلغي دخول ${j.n} ${j.n===1?'جهاز':'أجهزة'}`,'good'); }catch(e){ toast('تعذّر الإلغاء','bad'); }
  devLoad();
}
async function devLogout(){
  if(typeof askConfirm==='function' && !(await askConfirm('ستخرج من هذا الجهاز وتحتاج كلمة السر للدخول مرة أخرى. متابعة؟'))) return;
  try{ await devCall('/auth/logout'); }catch(e){}
  try{ localStorage.removeItem(K_TOK); localStorage.removeItem('hw_vk_v1'); }catch(e){}
  try{ if(window.caches) await caches.delete('ct-grades-v1'); }catch(e){}   // نسخة الدرجات على الجهاز تخرج مع الجلسة
  location.reload();
}
