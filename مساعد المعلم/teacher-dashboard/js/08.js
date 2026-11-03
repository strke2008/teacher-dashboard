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
  ['lesson','⏰','بداية الحصة','من جدولك في بوابة المعلم — بضغطة تبدأ الحصة'],
  ['task','📌','تذكيراتي','مهامك من بوابة المعلم في موعدها']];
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
  if(data.type==='lesson' || data.type==='task'){ location.href = data.url || './portal/'; return; }
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
  const data= open==='submission' ? {type:'submission',hw:q.get('hw'),sid:q.get('sid'),at:Number(q.get('at'))||0} : open==='wall' ? {type:'wall',id:q.get('id')} : open==='student' ? {open,sid:q.get('sid')} : {open};
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
  b.innerHTML='<span style="flex:1">🔄 نسخة أحدث من اللوحة جاهزة<small style="display:block;font-weight:500;opacity:.75;font-size:.78em">تُحدَّث وحدها حين تتوقف عن العمل</small></span><button type="button" style="font:inherit;font-weight:800;border:0;border-radius:10px;padding:7px 12px;background:#1B9C6B;color:#fff;cursor:pointer">تحديث الآن</button><button type="button" aria-label="لاحقًا" style="font:inherit;border:0;background:transparent;color:#9FB2CC;cursor:pointer;font-size:1rem">✕</button>';
  b.children[1].onclick=()=>location.reload(); b.children[2].onclick=()=>b.remove();
  document.body.appendChild(b);
}
/* 🔄 فحص الإصدار من الصفحة نفسها (مع العودة إليها، وكل 10 دقائق): تُقارَن أرقام إصدار الملفات (?v=) في الصفحة
   المفتوحة بنسخة الخادم الحالية — بمعامل فريد يتجاوز أي ذاكرة مؤقتة — وإن اختلفت يظهر زر «تحديث الآن» */
(function verWatch(){
  const sig = html => [...String(html).matchAll(/(?:href|src)="([^"]+\?v=[0-9a-f]+)"/g)].map(m => m[1]).sort().join('|');
  const mine = sig(document.documentElement.outerHTML);
  if(!mine) return;
  let last = 0;
  const check = async () => {
    if(document.hidden || Date.now() - last < 60000) return; last = Date.now();
    try{
      const r = await fetch(location.pathname + '?_sw=' + Date.now().toString(36), { cache: 'no-store', credentials: 'same-origin' });
      if(!r.ok) return;
      const other = sig(await r.text());
      if(other && other !== mine) APPUPD.mark();
    }catch(e){}
  };
  document.addEventListener('visibilitychange', () => { if(!document.hidden) check(); });
  setTimeout(check, 20000); setInterval(check, 600000);
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
    nav=nav||document.getElementById('mobile-nav'); if(!nav) return;
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

window.__APPUPD_CFG={api:()=>getApi(),show:()=>dashShowUpdate(true),
  busy:()=>{const m=document.getElementById('modal');return !!(m&&m.innerHTML.trim()&&m.offsetParent!==null&&getComputedStyle(m).visibility!=='hidden')||!!document.querySelector('.opv-veil,dialog[open]')}};
/* 🔄 التحديث الإجباري: أي إصدار أحدث يُطبَّق وحده في أول لحظة آمنة — عند الخروج من التطبيق أو العودة إليه، أو بعد دقيقتين بلا لمس —
   ولا يُطبَّق أبدًا وسط عمل (نافذة مفتوحة، كتابة، حل نشاط). و«إجبار كل الأجهزة» من لوحة التحكم: الخادم يحفظ وقت الطلب،
   وكل جهاز يراه (عند الفتح والعودة وكل 10 دقائق) يمسح نسخته المحفوظة ويعيد التحميل مرة واحدة. لا يُلغى تسجيل الإشعارات. */
const APPUPD=(()=>{
  const CFG=window.__APPUPD_CFG||{},LS=CFG.key||'app_force_seen';let pending=false,hard=0,since=0,lastAct=Date.now(),lastInput=0,hidAt=0,going=false;
  addEventListener('input',()=>{lastInput=Date.now()},true);
  ['pointerdown','keydown','wheel','touchstart'].forEach(e=>addEventListener(e,()=>{lastAct=Date.now()},{capture:true,passive:true}));
  const editing=()=>{const a=document.activeElement;return !!(a&&(a.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))&&!/^(button|checkbox|radio|range|submit)$/i.test(a.type||''))};
  const busy=()=>editing()||Date.now()-lastInput<120000||!!(CFG.busy&&CFG.busy());
  async function apply(){
    if(going)return;going=true;
    if(hard){try{localStorage.setItem(LS,String(hard))}catch(e){}
      try{if(window.caches)for(const k of await caches.keys())await caches.delete(k)}catch(e){}
      try{const R=navigator.serviceWorker&&navigator.serviceWorker.getRegistrations?await navigator.serviceWorker.getRegistrations():[];await Promise.all(R.map(r=>r.update().catch(()=>{})))}catch(e){}}
    location.reload();
  }
  function tick(){if(!pending||going)return;
    const idle=Date.now()-lastAct>120000,late=Date.now()-since>4*3600e3;
    if((idle&&!busy())||(late&&!editing()&&Date.now()-lastInput>120000))apply()}
  function mark(h){if(h)hard=Math.max(hard,h);if(!pending){pending=true;since=Date.now()}if(CFG.show)try{CFG.show()}catch(e){}}
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){hidAt=Date.now();if(pending&&!busy())apply();return}
    if(pending&&hidAt&&Date.now()-hidAt>15000&&!busy())apply();else checkForce()});
  async function checkForce(){
    if(!CFG.api)return;let api='';try{api=String(CFG.api()||'').replace(/\/+$/,'')}catch(e){}if(!api)return;
    try{const j=await (await fetch(api+'/version',{cache:'no-store'})).json(),f=Number(j&&j.force)||0;let seen=0;try{seen=Number(localStorage.getItem(LS))||0}catch(e){}
      if(f>seen){if(!seen&&performance.now()<15000&&Date.now()-f>86400e3){try{localStorage.setItem(LS,String(f))}catch(e){}return}   // جهاز جديد فُتح الآن بعد طلب قديم: هو أصلًا أحدث نسخة
        mark(f);tick()}}catch(e){}
  }
  setInterval(tick,30000);setTimeout(checkForce,4000);setInterval(checkForce,600000);
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

/* 📱 الفتح الذكي: تطبيق الشاشة الرئيسية على الجوال يبدأ في بوابة المعلم (الحصة والرصد)، والكمبيوتر في اللوحة.
   الرجوع من البوابة للوحة لا يعيدك إليها في الجلسة نفسها. الإعداد في «بوابة المعلم» بالإعدادات */
function smartStartGet(){ try{ return localStorage.getItem('hwapp_start_portal_v1')!=='0'; }catch(e){ return true; } }
function smartStartSet(on){ try{ localStorage.setItem('hwapp_start_portal_v1', on?'1':'0'); }catch(e){} toast(on?'✓ على الجوال يفتح التطبيق على بوابة المعلم':'✓ يفتح التطبيق على لوحة التحكم دائمًا','good'); }
(function(){ const e=document.getElementById('smart-start'); if(e) e.checked=smartStartGet(); })();
