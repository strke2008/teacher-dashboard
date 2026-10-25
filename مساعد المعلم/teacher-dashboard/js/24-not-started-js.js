/* ═════════ 🚶 لم يبدؤوا بعد: طلاب لهم أنشطة منشورة ولم يسلّموا أيًّا منها ═════════ */
function nsList(){
  if(!Array.isArray(STUDENTS)||!Array.isArray(HW)) return [];
  const pub=HW.filter(h=>remPublished(h));
  return STUDENTS.map(s=>{ const mine=pub.filter(h=>hwFor(h,s.cls)); return {s,n:mine.length,any:mine.some(h=>h.subs&&h.subs[s.id])}; })
    .filter(x=>x.n>0&&!x.any).sort((a,b)=>String(a.s.cls).localeCompare(String(b.s.cls),'ar')||String(a.s.name).localeCompare(String(b.s.name),'ar'));
}
/* ═══ 💬 رسائل الطلاب: سؤال أو مشكلة من «راسل معلمك» في البوابة، والرد يصل الطالب في تنبيهاته ═══ */
let ASKS=null, ASK_CATS={activity:'سؤال عن نشاط',tech:'مشكلة في البوابة',grade:'درجة أو تصحيح',lesson:'استفسار عن الدرس',other:'أخرى'};
const ASK_REPLY_CAT='💬 دردشة';
const ASK_QUICK=['تم حل المشكلة — جرّب الآن ✅','سأشرحها لك في الحصة القادمة إن شاء الله','راجع شرح الدرس في الكتاب ثم أعد المحاولة','فتحت لك محاولة إضافية في النشاط','راجعت درجتك وهي صحيحة','أحسنت على سؤالك 👏 — '];
const ASK_PUSHED=new Map();
let ASK_LAST=0;
let ASK_BADGE=-1;
/* 🎓 «راسل معلمك» في بوابة الطلاب: البطاقة أو الزر العائم أو كلاهما، أو إغلاق التواصل — إعداد واحد للجميع يحفظه الخادم */
let ASK_PMODE=null;
const ASK_PMODES={both:'البطاقة + زر عائم',card:'البطاقة فقط',fab:'زر عائم فقط',off:'التواصل مغلق'};
async function askPortalModeSet(mode){
  try{ const r=await fetch(getApi().replace(/\/+$/,'')+'/ask-cfg',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),mode})});
    const j=await r.json(); if(!j.ok||!j.mode) throw new Error(j.error||'');
    ASK_PMODE=j.mode; toast(j.mode==='off'?'🔒 أُغلق التواصل — لا يستطيع الطلاب إرسال رسائل جديدة':`🎓 عند الطلاب: ${ASK_PMODES[j.mode]}`,'good');
  }catch(e){ toast(r404(e)||/unauthorized/.test(String(e&&e.message))?'انشر worker.js الأخير أولًا':'تعذّر الحفظ — تحقق من الاتصال','bad'); }
  try{ askCardRender(); }catch(e){} if(document.getElementById('ask-inbox')) asksOpen(true);
}
function askPortalModeSel(){ if(ASK_PMODE===null) return '';
  return `<label class="askf-mode${ASK_PMODE==='off'?' off':''}" title="كيف يظهر «راسل معلمك» في بوابة الطلاب">🎓 عند الطلاب:
    <select onchange="askPortalModeSet(this.value)">${Object.entries(ASK_PMODES).map(([k,v])=>`<option value="${k}"${k===ASK_PMODE?' selected':''}>${k==='off'?'🔒 ':''}${v}</option>`).join('')}</select></label>`; }
/* ⚡ سؤال طالب وصل داخل الإشعار: يظهر في «رسائل الطلاب» فورًا */
function askApplyPush(item){
  if(!item||!item.id) return;
  ASK_PUSHED.set(item.id,{at:Date.now(),item});
  if(!Array.isArray(ASKS)) ASKS=[];
  const i=ASKS.findIndex(x=>x.id===item.id);
  if(i>=0){ if((item.at||0)>=(ASKS[i].at||0)) ASKS[i]=item; } else ASKS.unshift(item);
  try{ thDraw(); }catch(e){} try{ askFabRender(); askCardRender(); }catch(e){} if(document.getElementById('ask-inbox')) try{ asksOpen(true); }catch(e){}
}
async function asksLoad(){
  try{ const r=await fetch(getApi().replace(/\/+$/,'')+'/asks?t='+encodeURIComponent(getTok()),{cache:'no-store'}); const j=await r.json();
    if(j&&j.ok){ ASKS=j.rows||[]; if(j.cats) ASK_CATS=j.cats; if(j.mode) ASK_PMODE=j.mode;
      // سؤال وصل بالإشعار قبل أن يظهر في رد الخادم (نسخة قديمة لدقيقة): الأحدث زمنًا هو المعروض حتى يلحق به الخادم
      ASK_PUSHED.forEach((v,id)=>{ if(Date.now()-v.at>120000){ ASK_PUSHED.delete(id); return; }
        const i=ASKS.findIndex(x=>x.id===id);
        if(i<0) ASKS.unshift(v.item);
        else if((v.item.at||0)>(ASKS[i].at||0)) ASKS[i]=v.item; else ASK_PUSHED.delete(id); }); ASK_LAST=Date.now(); try{ thDraw(); }catch(e){} try{ askFabRender(); askCardRender(); }catch(e){} if(document.getElementById('ask-inbox')) asksOpen(true); } }catch(e){}
}
function askAgo(t){ const m=Math.round((Date.now()-t)/60000); return m<1?'الآن':m<60?`قبل ${m} د`:m<1440?`قبل ${Math.round(m/60)} س`:`قبل ${Math.round(m/1440)} يوم`; }
function asksOpen(keep){
  if(ASKS===null){ toast('جارٍ جلب الرسائل…'); asksLoad().then(()=>asksOpen(true)); return; }
  if(!keep){ asksLoad(); try{ askApplyInbox(); }catch(e){} }   // فتح العلبة يجلب الجديد فورًا (كما في الصندوق العائم) — العرض من المخزون أولًا ثم يتجدد عند وصول الجلب
  const open=ASKS.filter(x=>x.status==='open'), done=ASKS.filter(x=>x.status!=='open'&&x.kind!=='t').slice(0,30);
  const card=x=>`<div class="ask-t" id="askc-${thEsc(x.id)}">
      <div class="ask-t-h">${askNameHTML(x)}<span class="muted">${thEsc(x.cls||'')}</span><span class="ask-cat">${thEsc((ASK_CATS[x.cat]||(x.cat==='reply'?ASK_REPLY_CAT:''))||'')}</span><span class="muted">${askAgo(x.at)}</span></div>
      ${x.hwTitle?`<div class="muted" style="font-size:.78rem">📚 «${thEsc(x.hwTitle)}»</div>`:''}
      ${x.reText?`<div class="muted" style="font-size:.78rem">📣 ردًا على رسالتك: «${thEsc(x.reText)}»</div>`:''}
      <div class="ask-t-q">${thEsc(x.text)}</div>
      ${x.status==='open'?`<div class="ask-quick">${ASK_QUICK.map(t=>`<button type="button" onclick="askQuick('${thEsc(x.id)}',this.textContent)">${thEsc(t)}</button>`).join('')}</div>
      <textarea class="inp" id="askr-${thEsc(x.id)}" rows="2" maxlength="1000" placeholder="اكتب ردك… يصل الطالب في تنبيهاته"></textarea>
      <div class="ask-t-b"><button type="button" class="btn tick sm" onclick="askSend('${thEsc(x.id)}')">📩 أرسل الرد</button>
        <button type="button" class="btn ghost sm" title="حللتها معه في الفصل — لا يُرسل شيء" onclick="askSend('${thEsc(x.id)}',true)">✓ أُغلق دون رد</button>
</div>`
      :`${x.reply?`<div class="ask-t-r">📩 ${thEsc(x.reply)}</div><div class="muted" style="font-size:.74rem;margin-top:.2rem">${x.seenAt?'👁️ قرأ الطالب الرد':'⏳ لم يقرأ الطالب الرد بعد'}</div>`:'<div class="muted" style="font-size:.78rem">أُغلق دون رد</div>'}
        <div class="ask-t-b"><button type="button" class="btn ghost sm" onclick="askReopen('${thEsc(x.id)}')">↩️ إعادة فتح</button></div>`}
    </div>`;
  const html=`<h2 id="ask-inbox">💬 رسائل الطلاب ${open.length?`<span class="chip bad">${open.length} تنتظر ردك</span>`:''} ${askFabToggleBtn()} ${askPortalModeSel()}</h2>
    <p class="muted" style="font-size:.82rem;margin:.2rem 0 .7rem">يرسلها الطالب من «💬 راسل معلمك» في بوابته (حتى ${3} أسئلة مفتوحة و5 رسائل يوميًا). ردك يصله في تنبيهاته مع إشعار.</p>
    ${open.length?open.map(card).join(''):'<div class="feature-empty">لا رسائل تنتظر ردك 🌿</div>'}
    ${done.length?`<details style="margin-top:.7rem"><summary class="muted" style="cursor:pointer">✓ تمّ الرد عليها (${done.length})</summary>${done.map(card).join('')}</details>`:''}
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إغلاق</button><button class="btn ghost" onclick="asksLoad()">🔄 تحديث</button></div>`;
  if(keep&&document.getElementById('ask-inbox')){ const m=document.getElementById('ask-inbox').parentElement; if(m) m.innerHTML=html; return; }
  openModal(html);
}
/* 💬 بطاقة «رسائل الطلاب» في صفحة اليوم: كل رسالة مفتوحة مع رد سريع، بلا فتح نافذة */
const ASK_CARD_OPEN=new Set(), ASK_DRAFT={};
function asksCardHTML(){
  if(ASKS===null) return `<div class="td-card askc-card"><div class="td-card-h"><b>💬 رسائل الطلاب</b></div><div class="muted" style="padding:.5rem">⏳ جارٍ الجلب…</div></div>`;
  const open=ASKS.filter(x=>x.status==='open').sort((a,b)=>(a.at||0)-(b.at||0)), done=ASKS.filter(x=>x.status!=='open'&&x.kind!=='t');
  const item=x=>{ const id=thEsc(x.id), ex=ASK_CARD_OPEN.has(x.id);
    return `<div class="askc ${ex?'ex':''}"><div class="askc-h">${askNameHTML(x)}<span class="muted">${thEsc(x.cls||'')}</span>${(ASK_CATS[x.cat]||(x.cat==='reply'?ASK_REPLY_CAT:''))?`<span class="ask-cat">${thEsc((ASK_CATS[x.cat]||(x.cat==='reply'?ASK_REPLY_CAT:'')))}</span>`:''}<span class="muted askc-t">${askAgo(x.at)}</span></div>
      ${x.hwTitle?`<div class="muted askc-hw">📚 «${thEsc(x.hwTitle)}»</div>`:''}
      ${x.reText?`<div class="muted askc-hw">📣 ردًا على رسالتك: «${thEsc(x.reText)}»</div>`:''}
      <div class="askc-q">${thEsc(x.text)}</div>
      ${ex?`<div class="ask-quick">${ASK_QUICK.map(t=>`<button type="button" onclick="askQuick('${id}',this.textContent,'askcr-')">${thEsc(t)}</button>`).join('')}</div>
        <textarea class="inp" id="askcr-${id}" rows="2" maxlength="1000" placeholder="اكتب ردك… يصل الطالب في تنبيهاته" oninput="ASK_DRAFT['${id}']=this.value">${thEsc(ASK_DRAFT[x.id]||'')}</textarea>
        <div class="askc-b"><button type="button" class="btn tick sm" onclick="askSend('${id}',false,'askcr-')">📩 أرسل</button><button type="button" class="btn ghost sm" onclick="askCardToggle('${id}')">إلغاء</button>
          <button type="button" class="btn ghost sm" title="حللتها معه في الفصل — لا يُرسل شيء" onclick="askSend('${id}',true)">✓ أُغلق دون رد</button></div>`
      :`<div class="askc-b"><button type="button" class="btn sm" onclick="askCardToggle('${id}')">✍️ رد</button></div>`}</div>`; };
  return `<div class="td-card askc-card"><div class="td-card-h"><b>💬 رسائل الطلاب</b>${open.length?`<span class="chip bad">${open.length} تنتظر ردك</span>`:''}${askFabToggleBtn()}${askPortalModeSel()}<a href="#" class="td-link" onclick="event.preventDefault();asksOpen()">كل الرسائل</a></div>
    ${open.length?`<div class="askc-list">${open.map(item).join('')}</div>`:`<div class="td-empty">🌿 لا رسائل تنتظر ردك${done.length?` <small class="muted">· ردَدت على ${done.length}</small>`:''}</div>`}</div>`;
}
function askCardRender(){ const sA=document.getElementById('td-slot-asks'); if(sA){ try{ sA.innerHTML=asksCardHTML(); }catch(e){} } }
function askCardToggle(id){ ASK_CARD_OPEN.has(id)?ASK_CARD_OPEN.delete(id):ASK_CARD_OPEN.add(id); askCardRender(); if(ASK_CARD_OPEN.has(id)) setTimeout(()=>document.getElementById('askcr-'+id)?.focus(),30); }
function askQuick(id,t,pre){ const ta=document.getElementById((pre||'askr-')+id); if(!ta) return; ta.value=ta.value?ta.value.trim()+' '+t:t; if(pre==='askcr-') ASK_DRAFT[id]=ta.value; ta.focus(); }
async function askSend(id,close,pre){
  const ta=document.getElementById((pre||'askr-')+id), reply=close?'':String(ta&&ta.value||'').trim();
  if(!close&&!reply){ toast('اكتب الرد أولًا','bad'); ta&&ta.focus(); return; }
  try{ const r=await fetch(getApi().replace(/\/+$/,'')+'/ask-reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),id,reply,close:!!close})});
    const j=await r.json(); if(!j.ok) throw new Error(j.error||'');
    const i=ASKS.findIndex(x=>x.id===id); if(i>=0) ASKS[i]=j.item;
    ASK_CARD_OPEN.delete(id); delete ASK_DRAFT[id];
    toast(close?'✓ أُغلقت الرسالة':'📩 وصل ردك للطالب في تنبيهاته','good'); if(document.getElementById('ask-inbox')) asksOpen(true); if(document.activeElement) document.activeElement.blur(); askCardRender(); thDraw();
  }catch(e){ toast(r404(e)?'ارفع worker.js الأخير':'تعذّر الإرسال — تحقق من الاتصال','bad'); }
}
function r404(e){ return /not found|404/.test(String(e&&e.message||'')); }
async function askReopen(id){
  try{ const r=await fetch(getApi().replace(/\/+$/,'')+'/ask-reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),id,reopen:true})});
    const j=await r.json(); if(!j.ok) throw 0; const i=ASKS.findIndex(x=>x.id===id); if(i>=0) ASKS[i]=j.item; asksOpen(true); thDraw(); }catch(e){ toast('تعذّر — تحقق من الاتصال','bad'); }
}
function nsLastPub(s){ return Math.max(0,...HW.filter(h=>remPublished(h)&&hwFor(h,s.cls)).map(h=>Number(h.publishedAt||h.at)||0)); }
function nsOpenList(){ return nsList().filter(x=>{ const at=fuAt(x.s.id,'ns'); return !(at && at>=nsLastPub(x.s)); }); }
function nsMsg(s){ return `مرحبًا ${tdShortName(s.name)} 👋 لديك أنشطة في بوابة الطالب لم تبدأها بعد. ادخل البوابة: ${getSite()} وابدأ باختبار «اكتشف طريقة تعلمك» ثم «اعرف مستواك»، وبعدها تُفتح لك الأنشطة والألعاب. بالتوفيق 🌟`; }
async function nsCopy(sid){ const s=(STUDENTS||[]).find(x=>String(x.id)===String(sid)); if(!s) return; const t=nsMsg(s);
  try{ await navigator.clipboard.writeText(t); toast('📋 نُسخت رسالة للطالب','good'); }catch(e){ prompt('انسخ الرسالة:',t); } }
function nsOpen(){
  const all=nsList(), L=nsOpenList(), done=all.filter(x=>!L.includes(x)), by={}; L.forEach(x=>{ (by[x.s.cls||'—']=by[x.s.cls||'—']||[]).push(x); });
  openModal(`<h2>🚶 لم يبدؤوا بعد (${L.length})</h2>
    <p class="muted" style="font-size:.8rem;margin:.1rem 0 .5rem">طلاب لهم أنشطة منشورة ولم يسلّموا أيًّا منها. ابدأ بسؤال الطالب عن السبب: جهاز؟ لا يعرف الدخول؟ طلب انضمام معلّق؟ — ثم ساعده يحل أول نشاط أمامك.</p>
    ${Object.keys(by).map(c=>`<b style="font-size:.85rem;display:block;margin-top:.5rem">${esc(c)} (${by[c].length})</b>${by[c].map(x=>`<div class="du-li"><span>${esc(x.s.name)}<small>${x.n===1?'نشاط واحد منشور':x.n===2?'نشاطان منشوران':x.n+' أنشطة منشورة'} له · لم يسلّم شيئًا</small></span>
      <span class="du-acts"><button class="btn ghost sm" title="رسالة للطالب فيها رابط البوابة وخطوة البداية" onclick="nsCopy('${esc(x.s.id)}')">📋 للطالب</button>
      <button class="btn ghost sm" onclick="pmsgOpen('${esc(x.s.id)}','start')">💬 ولي الأمر</button>
      <button class="btn tick sm" title="سجّل أنك تواصلت مع ولي أمره" onclick="fuMark([{sid:'${esc(x.s.id)}',type:'ns'}],'اتصال').then(nsOpen)">📞 تواصلت</button>
      <button class="btn ghost sm" title="تابعته — يختفي حتى يُنشر له نشاط جديد" onclick="fuMark([{sid:'${esc(x.s.id)}',type:'ns'}]).then(nsOpen)">✓ تابعته</button>
      <button class="btn ghost sm" onclick="ctOpenProfile('${esc(x.s.id)}')" title="الملف الشامل">📁</button></span></div>`).join('')}`).join('')||(all.length?'<div class="feature-empty">✓ تابعت كل من لم يبدأ — يعودون إذا نُشر لهم نشاط جديد ولم يبدؤوا.</div>':'<div class="feature-empty">🎉 كل الطلاب بدؤوا.</div>')}
    ${L.length>1?`<div style="margin-top:.6rem"><button class="btn ghost sm" onclick="fuMark(nsOpenList().map(x=>({sid:String(x.s.id),type:'ns'}))).then(nsOpen)">✓ تابعتهم جميعًا (${L.length})</button></div>`:''}
    ${done.length?`<details style="margin-top:.6rem"><summary class="muted" style="cursor:pointer">✓ تمت متابعتهم (${done.length})</summary>${done.map(x=>`<div class="du-li"><span>${esc(x.s.name)}<small>${esc(x.s.cls||'')} · تابعته ${fuDay(fuAt(x.s.id,'ns'))}</small></span>
      <button class="btn ghost sm" onclick="fuUndo('${esc(x.s.id)}','ns').then(nsOpen)">↩️ إلغاء</button></div>`).join('')}</details>`:''}
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`);
}

/* 💬 صندوق رسائل الطلاب العائم: زر ثابت في كل الصفحات عليه عدد الرسائل المفتوحة، يفتح لوحة للرد السريع */
const ASKF={open:false,seen:0,ex:'',on:(()=>{ try{ return localStorage.getItem('askf_on_v1')!=='0'; }catch(e){ return true; } })(),view:'',q:''};
/* اسم الطالب في الرسائل: يفتح ملفه الشامل مباشرة (إن كان في الكشف) */
function askNameHTML(x){ const ok=(STUDENTS||[]).some(s=>String(s.id)===String(x.sid));
  return ok?`<b class="ask-nm" role="link" tabindex="0" title="افتح ملف الطالب" onclick="ctOpenProfile('${thEsc(x.sid)}')">${thEsc(x.name)}</b>`:`<b>${thEsc(x.name)}</b>`; }
/* 📌 الصندوق العائم اختياري: المعلم يُظهره أو يخفيه (يُحفظ على هذا الجهاز) */
function askFabSet(on){ ASKF.on=!!on; try{ localStorage.setItem('askf_on_v1',on?'1':'0'); }catch(e){}
  if(!on){ ASKF.open=false; document.getElementById('askf-pan')?.remove(); document.getElementById('askf-btn')?.remove(); document.documentElement.classList.remove('chat-open'); askfInert(false); }
  askFabRender(); try{ askCardRender(); }catch(e){} if(document.getElementById('ask-inbox')) try{ asksOpen(true); }catch(e){}
  if(!arguments[1]) toast(on?'📌 ظهر صندوق المحادثات العائم — تصل إليه من أي صفحة':'أُخفي صندوق المحادثات العائم','good'); }
function askFabToggleBtn(){ return `<button type="button" class="askf-pin${ASKF.on?' on':''}" onclick="askFabSet(${!ASKF.on})" title="${ASKF.on?'إخفاء الزر العائم':'إظهار زر عائم للرسائل في كل الصفحات'}">📌 ${ASKF.on?'عائم عندي ✓':'عائم عندي'}</button>`; }
/* 🔴 شارة أيقونة التطبيق (iOS 16.4+ للتطبيقات المثبتة): الرقم الدقيق للرسائل المفتوحة — يصحح ما يضعه الـ SW مؤقتًا */
function askSyncBadge(n){
  try{
    if(!Array.isArray(ASKS)||typeof navigator==='undefined'||!('setAppBadge' in navigator)||n===ASK_BADGE) return;
    ASK_BADGE=n;
    const p=n>0?navigator.setAppBadge(n):(navigator.clearAppBadge?navigator.clearAppBadge():null);
    if(p&&p.catch) p.catch(()=>{});
  }catch(e){}
}
/* 📥 قراءة صندوق الإشعارات المحفوظة (يكتبه الـ SW عند كل إشعار دردشة): رسائل وصلت واللوحة مغلقة
   تُطبَّق فور الفتح/العودة بلا انتظار الخادم — والجلب الدوري بعدها يصححها بنسخة الخادم */
async function askApplyInbox(){
  try{
    if(!('caches' in window)) return;
    const cache=await caches.open('dash-push-inbox-v1');
    const r=await cache.match('/__push_inbox__');
    if(!r) return;
    const j=await r.json(); const items=Array.isArray(j&&j.items)?j.items:[];
    for(const it of items){
      if(it&&it.id&&!(Array.isArray(ASKS)&&ASKS.some(x=>x.id===it.id))){ try{ askApplyPush(it); }catch(e){} }
    }
  }catch(e){}
}
function askFabRender(){
  if(!document.body) return;
  if(!ASKF.on){ document.getElementById('askf-btn')?.remove(); document.getElementById('askf-pan')?.remove(); document.documentElement.classList.remove('chat-open'); askfInert(false); return; }
  let b=document.getElementById('askf-btn');
  if(!b){ b=document.createElement('button'); b.type='button'; b.id='askf-btn'; b.className='askf-btn'; b.setAttribute('aria-label','رسائل الطلاب');
    b.onclick=()=>askFabToggle(); document.body.appendChild(b); }
  const open=Array.isArray(ASKS)?ASKS.filter(x=>x.status==='open'):[], n=open.length;
  if(n>ASKF.seen && ASKF.seen>=0 && Array.isArray(ASKS)){ b.classList.remove('ping'); void b.offsetWidth; b.classList.add('ping'); }
  ASKF.seen=n;
  askSyncBadge(n);
  const onN=typeof onlRows==='function'?onlRows().on.length:0;
  b.innerHTML=`<span class="askf-ic">💬</span>${n?`<b class="askf-n">${n>99?'99+':n}</b>`:''}${onN?`<i class="askf-on" title="${onN} متصل الآن"></i>`:''}`;
  b.title=(n?`${n} ${n===1?'رسالة تنتظر ردك':'رسائل تنتظر ردك'}`:'المحادثات')+(onN?` · ${onN} متصل الآن`:'');
  b.classList.toggle('has',!!n);
  if(ASKF.open) askFabPanel();
}
/* ⌨️ إخفاء سهمي التنقل (∧ ∨) فوق كيبورد الجوال — مرآة إصلاح دردشة الطالب:
   أثناء فتح صندوق المحادثات على الشاشات الصغيرة يبقى صندوق الرد حقل الكتابة
   الوحيد القابل للتركيز، فيخفي المتصفح السهمين عادةً. (علامة ✓ واجهة نظام
   ولا يملك أي موقع إزالتها.) على الشاشات الكبيرة لا يتغير شيء. */
function askfInert(on){
  const mobile=window.matchMedia('(max-width:700px)').matches;
  Array.from(document.body.children).forEach(el=>{
    if(el.id==='askf-pan'||el.id==='askf-btn') return;
    if(on&&mobile) el.setAttribute('inert','');
    else el.removeAttribute('inert');
  });
}
function askFabToggle(on){
  ASKF.open=on===undefined?!ASKF.open:!!on;
  const p=document.getElementById('askf-pan');
  document.documentElement.classList.toggle('chat-open',ASKF.open); chVV();
  if(!ASKF.open){ if(p) p.remove(); document.getElementById('askf-btn')?.classList.remove('on'); askfInert(false); return; }
  asksLoad();   // فتح الصندوق يجلب الجديد فورًا بدل عرض المخزون وانتظار الدوري
  try{ askApplyInbox(); }catch(e){}   // ورسائل الإشعارات المحفوظة تُطبَّق فورًا بلا انتظار الخادم
  askFabPanel(); document.getElementById('askf-btn')?.classList.add('on'); askfInert(true);
}
/* 💬 صندوق المحادثات العائم: كل ما بينك وبين كل طالب في خيط واحد —
   أسئلته من «راسل معلمك» وردودك عليها، ورسائلك الخاصة له (kind:'t') وردوده عليها. مصدر واحد: ASKS.
   ردك في خيط فيه سؤال مفتوح = رد على السؤال (/ask-reply)؛ وإلا = رسالة خاصة جديدة (/messages chat+live).
   الطالب المتصل الآن يرى تنبيهًا أحمر على صندوقه العائم خلال ثوانٍ، وغير المتصل يجدها في رسائله ومعها إشعار. */
/* 📱 على الجوال يملأ الصندوق الشاشة الظاهرة فوق لوحة المفاتيح (visualViewport) — مثل تطبيقات المحادثة */
function chVV(){ const vv=window.visualViewport, r=document.documentElement.style; if(!vv) return;
  r.setProperty('--vvh',Math.round(vv.height)+'px'); r.setProperty('--vvt',Math.round(vv.offsetTop)+'px');
  document.documentElement.classList.toggle('kb-open',window.innerHeight-vv.height>120);   // لوحة المفاتيح ظاهرة
  if(ASKF.open) askfInert(true);   // عبور نقطة 700px مع بقاء الصندوق مفتوحًا
  const th=document.getElementById('ch-thread'); if(th&&document.activeElement&&/^chr-/.test(document.activeElement.id||'')) th.scrollTop=th.scrollHeight; }
if(window.visualViewport){ visualViewport.addEventListener('resize',chVV); visualViewport.addEventListener('scroll',chVV); }
function chStu(sid){ return (STUDENTS||[]).find(s=>String(s.id)===String(sid))||null; }
/* 💬 الدردشة مفتوحة مع هذا الطالب؟ (تأتي مع /presence كل 30 ث) */
function chIsOpen(sid){ return !!(typeof ONL!=='undefined'&&ONL.data&&(ONL.data.chats||[]).some(c=>String(c.sid)===String(sid))); }
async function chToggle(sid,open){
  try{ const j=await (await fetch(getApi().replace(/\/+$/,'')+'/chat-open',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),sid:String(sid),open:!!open})})).json();
    if(!j.ok) throw new Error(j.error||'');
    if(ONL.data){ const c=(ONL.data.chats||[]).filter(x=>String(x.sid)!==String(sid)); if(open) c.push({sid:String(sid),at:Date.now()}); ONL.data.chats=c; }
    toast(open?'🔓 فُتحت الدردشة — يكتب لك متى شاء':'🔒 أُغلقت الدردشة — يعود لنظام السؤال العادي','good'); askFabPanel();
  }catch(e){ toast(r404(e)||/unauthorized|no_db/.test(String(e&&e.message))?'انشر worker.js الأخير أولًا':'تعذّر — تحقق من الاتصال','bad'); }
}
function chOn(sid){ try{ return typeof onlRows==='function'&&onlRows().on.some(r=>String(r.sid)===String(sid)); }catch(e){ return false; } }
function chThreads(){
  const by=new Map();
  (Array.isArray(ASKS)?ASKS:[]).forEach(x=>{ const k=String(x.sid||('n:'+x.name)); let t=by.get(k);
    if(!t){ const s=chStu(x.sid); t={sid:String(x.sid||''),name:s?s.name:x.name,cls:s?s.cls:x.cls,items:[],last:0,open:0}; by.set(k,t); }
    t.items.push(x); t.last=Math.max(t.last,x.at||0,x.repliedAt||0); if(x.status==='open') t.open++; });
  return [...by.values()].sort((a,b)=>(b.open>0)-(a.open>0)||b.last-a.last);
}
function chBubbles(items){
  const out=[];
  items.forEach(x=>{
    if(x.kind==='t') out.push({who:'t',text:x.text,at:x.at});
    else { const ctx=[x.cat==='reply'?'':(ASK_CATS[x.cat]||''),x.hwTitle?`📚 «${x.hwTitle}»`:''].filter(Boolean).join(' · ');
      out.push({who:'s',text:x.text,at:x.at,ctx,open:x.status==='open'});
      if(x.reply) out.push({who:'t',text:x.reply,at:x.repliedAt||x.at,seen:!!x.seenAt}); }
  });
  return out.sort((a,b)=>a.at-b.at);
}
function chTime(t){ try{ const d=new Date(t), today=new Date().toDateString()===d.toDateString();
  return (today?'':d.toLocaleDateString('ar-SA',{day:'numeric',month:'short'})+' · ')+d.toLocaleTimeString('ar-SA',{hour:'numeric',minute:'2-digit'}); }catch(e){ return ''; } }
function chOpen(sid){ if(!ASKF.on) askFabSet(true,true); ASKF.view=String(sid); ASKF.q=''; askFabToggle(true); setTimeout(()=>document.getElementById('chr-'+sid)?.focus(),60); }
function askFabPanel(){
  let p=document.getElementById('askf-pan');
  if(!p){ p=document.createElement('div'); p.id='askf-pan'; p.className='askf-pan'; p.setAttribute('role','dialog'); document.body.appendChild(p); }
  const focus=document.activeElement&&p.contains(document.activeElement)?document.activeElement.id:'';
  // موضع التمرير قبل إعادة الرسم: من كان عند آخر رسالة يبقى عندها، ومن صعد يقرأ القديم لا يُسحب
  const th0=document.getElementById('ch-thread'), sameView=p.dataset.view===ASKF.view;
  const stick=!th0||!sameView||th0.scrollHeight-th0.scrollTop-th0.clientHeight<60, top0=th0?th0.scrollTop:0;
  const TH=chThreads(), openN=TH.reduce((a,t)=>a+t.open,0); let html='';
  const foot=`<div class="askf-foot"><button type="button" class="btn ghost sm" onclick="askFabToggle(false);asksOpen()">كل الأسئلة والسابقة</button><button type="button" class="btn ghost sm" onclick="asksLoad()">🔄 تحديث</button><button type="button" class="btn ghost sm" onclick="askFabSet(false)" title="يمكنك إظهاره مجددًا من بطاقة «رسائل الطلاب»">إخفاء الزر</button></div>`;
  if(ASKF.view){
    const sid=ASKF.view, s=chStu(sid), t=TH.find(x=>x.sid===sid), on=chOn(sid), id=thEsc(sid), B=chBubbles(t?t.items:[]), hasOpen=!!(t&&t.open);
    const nm=s?s.name:(t?t.name:'طالب');
    html=`<div class="askf-top ch-top"><button type="button" class="askf-x" onclick="ASKF.view='';askFabPanel()" aria-label="رجوع">→</button>
        <div class="ch-who"><b>${s?`<span class="ask-nm" role="link" tabindex="0" onclick="ctOpenProfile('${id}')" title="افتح ملف الطالب">${thEsc(nm)}</span>`:thEsc(nm)}</b>
        <small>${on?'<i class="onl-dot on"></i> متصل الآن':'غير متصل'}${s&&s.cls?' · '+thEsc(s.cls):''}</small></div>
        <button type="button" class="ch-lock ${chIsOpen(sid)?'on':''}" onclick="chToggle('${id}',${!chIsOpen(sid)})" title="${chIsOpen(sid)?'الطالب يكتب لك متى شاء — اضغط للإغلاق':'الطالب لا يبدأ الكتابة إلا بأسئلة «راسل معلمك» — اضغط للفتح'}">${chIsOpen(sid)?'🔓 الدردشة مفتوحة':'🔒 الدردشة مغلقة'}</button>
        <button type="button" class="askf-x" onclick="askFabToggle(false)" aria-label="إغلاق">✕</button></div>
      <div class="askf-list ch-thread" id="ch-thread">${B.length?B.map(m=>`<div class="ch-b ${m.who}${m.open?' open':''}">${m.ctx?`<small class="ch-ctx">${thEsc(m.ctx)}</small>`:''}<div>${thEsc(m.text)}</div>
          <small class="ch-t">${chTime(m.at)}${m.who==='t'&&m.seen?' · 👁️ قرأها':''}${m.open?' · ⏳ ينتظر ردك':''}</small></div>`).join('')
        :`<div class="askf-empty">💬 ابدأ محادثة مع ${thEsc(nm)}<small>${on?'متصل الآن — يظهر له تنبيه أحمر على صندوق المحادثة خلال ثوانٍ':'تصله في رسائله ومعها إشعار، وتظهر في صندوق محادثته أول ما يفتح البوابة'}</small></div>`}</div>
      <div class="ch-comp"><div class="ch-q">${hasOpen?`<div class="ask-quick">${ASK_QUICK.slice(0,4).map(q=>`<button type="button" onclick="askQuick('${id}',this.textContent,'chr-')">${thEsc(q)}</button>`).join('')}</div>`:''}</div>
        <div class="ch-row"><textarea class="inp" id="chr-${id}" rows="2" maxlength="1000" placeholder="${hasOpen?'ردك عليه…':chIsOpen(sid)?(on?'اكتب له — يصله فورًا…':'اكتب له — يصله في رسائله…'):'رسالة خاصة — إرسالها يفتح الدردشة معه…'}" oninput="ASK_DRAFT['ch:${id}']=this.value"
          onkeydown="if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();chSend('${id}')}">${thEsc(ASK_DRAFT['ch:'+sid]||'')}</textarea>
        <button type="button" class="btn tick ch-send" onclick="chSend('${id}')" aria-label="إرسال">📩</button></div>
        <div class="ch-cl">${hasOpen?`<button type="button" class="btn ghost sm" style="margin-top:.3rem" title="حللتها معه في الفصل — لا يُرسل شيء" onclick="chClose('${id}')">✓ أُغلق سؤاله دون رد</button>`:''}</div></div>`;
  } else {
    const q=ASKF.q.trim(), onl=typeof onlRows==='function'?onlRows().on:[];
    const found=q?(STUDENTS||[]).filter(s=>String(s.name||'').includes(q)).slice(0,8):[];
    const row=t=>{ const last=t.items.slice().sort((a,b)=>Math.max(b.at||0,b.repliedAt||0)-Math.max(a.at||0,a.repliedAt||0))[0];
      const lastTxt=last?(last.kind==='t'?'أنت: '+last.text:last.reply&&last.repliedAt>=last.at?'أنت: '+last.reply:last.text):'';
      return `<button type="button" class="ch-it${t.open?' open':''}" onclick="chOpen('${thEsc(t.sid)}')"><span class="ch-nm">${chOn(t.sid)?'<i class="onl-dot on"></i>':''}<b>${thEsc(t.name)}</b><small>${thEsc(t.cls||'')}</small>${chIsOpen(t.sid)?'<em class="ch-open">🔓 دردشة</em>':''}
        <small class="ch-tm">${askAgo(t.last)}</small></span><span class="ch-last">${thEsc(String(lastTxt).slice(0,90))}</span>${t.open?`<b class="ch-n">${t.open}</b>`:''}</button>`; };
    html=`<div class="askf-top"><b>💬 المحادثات</b>${openN?`<span class="chip bad">${openN} تنتظر ردك</span>`:''}<button type="button" class="askf-x" onclick="askFabToggle(false)" aria-label="إغلاق">✕</button></div>
      <div class="ch-search"><input class="inp" id="ch-q" type="search" placeholder="🔍 ابدأ محادثة مع أي طالب…" value="${thEsc(ASKF.q)}" oninput="ASKF.q=this.value;askFabPanel()"></div>
      <div class="askf-list">${q?(found.length?found.map(s=>`<button type="button" class="ch-it" onclick="chOpen('${thEsc(s.id)}')"><span class="ch-nm">${chOn(s.id)?'<i class="onl-dot on"></i>':''}<b>${thEsc(s.name)}</b><small>${thEsc(s.cls||'')}</small></span></button>`).join(''):'<div class="askf-empty">لا طالب بهذا الاسم</div>')
        :`${onl.length?`<div class="ch-onl"><small>🟢 متصلون الآن</small>${onl.slice(0,12).map(r=>`<button type="button" class="chip ghost" onclick="chOpen('${thEsc(r.sid)}')">${thEsc(r.s.name.split(' ')[0])}</button>`).join('')}</div>`:''}
          ${ASKS===null?'<div class="muted" style="padding:1rem;text-align:center">⏳ جارٍ الجلب…</div>':TH.length?TH.slice(0,40).map(row).join(''):'<div class="askf-empty">🌿 لا محادثات بعد<small>ابحث عن طالب بالأعلى لتبدأ</small></div>'}`}</div>`;
  }
  /* ✍️ التحديث الدوري (رسائل جديدة، حالة الاتصال) لا يعيد بناء خانة الكتابة ولا البحث: كان يُغلق لوحة مفاتيح الجوال
     ويقطع الإملاء ويرمي المؤشر لآخر النص كل بضع ثوانٍ. في الشاشة نفسها تُحدَّث الأجزاء المتغيرة فقط */
  const keep=ASKF.view?p.querySelector('.ch-row textarea'):p.querySelector('#ch-q');
  if(sameView && keep && keep.id===(ASKF.view?'chr-'+thEsc(ASKF.view):'ch-q')){
    const tpl=document.createElement('div'); tpl.innerHTML=html;
    let moved=false;
    (ASKF.view?['.askf-top','#ch-thread','.ch-q','.ch-cl']:['.askf-top','.askf-list']).forEach(sel=>{ const a=p.querySelector(sel), b=tpl.querySelector(sel);
      if(a&&b&&a.innerHTML!==b.innerHTML){ a.innerHTML=b.innerHTML; if(sel==='#ch-thread') moved=true; } });
    if(ASKF.view){ const nt=tpl.querySelector('.ch-row textarea'); if(nt&&keep.placeholder!==nt.placeholder) keep.placeholder=nt.placeholder; }
    const th=document.getElementById('ch-thread'); if(th&&moved) th.scrollTop=stick?th.scrollHeight:top0;
    return;
  }
  p.innerHTML=html;
  p.insertAdjacentHTML('beforeend',foot); p.dataset.view=ASKF.view; p.classList.toggle('thr',!!ASKF.view);
  // بعد إضافة الذيل (يغيّر ارتفاع القائمة) لا قبله — وإلا توقفت قبل آخر رسالة
  const th=document.getElementById('ch-thread'); if(th) th.scrollTop=stick?th.scrollHeight:top0;
  if(focus){ const el=document.getElementById(focus); if(el){ el.focus(); try{ el.setSelectionRange(el.value.length,el.value.length); }catch(e){} } }
}
async function chSend(sid){
  const ta=document.getElementById('chr-'+sid), text=String(ta&&ta.value||'').trim(); if(!text){ ta&&ta.focus(); return; }
  const t=chThreads().find(x=>x.sid===String(sid)), open=t?t.items.filter(x=>x.status==='open').sort((a,b)=>a.at-b.at):[];
  const api=getApi().replace(/\/+$/,''), post=(path,b)=>fetch(api+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),...b})}).then(r=>r.json());
  ta.disabled=true;
  try{
    if(open.length){ // رد واحد على أحدث سؤال مفتوح، والأقدم منها تُغلق (الرد في المحادثة يجيب عنها معًا)
      const j=await post('/ask-reply',{id:open[open.length-1].id,reply:text}); if(!j.ok) throw new Error(j.error||'');
      const i=ASKS.findIndex(x=>x.id===j.item.id); if(i>=0) ASKS[i]=j.item;
      for(const x of open.slice(0,-1)){ try{ const k=await post('/ask-reply',{id:x.id,close:true}); const n=ASKS.findIndex(y=>y.id===x.id); if(k.ok&&n>=0) ASKS[n]=k.item; }catch(e){} }
    } else {
      const s=chStu(sid); const j=await post('/messages',{title:'رسالة من معلمك',body:text,type:'message',priority:'normal',audience:'students',recipients:[{id:String(sid),name:s?s.name:''}],live:true,chat:true});
      if(!j.ok) throw new Error(j.error||''); (j.chat||[]).forEach(it=>{ ASK_PUSHED.set(it.id,{at:Date.now(),item:it}); if(!ASKS.some(x=>x.id===it.id)) ASKS.unshift(it); });
      if(!(j.chat||[]).length) toast('وصلت لرسائله — انشر worker.js الأخير لتظهر في المحادثة','bad');
      else if(typeof ONL!=='undefined'&&ONL.data&&!chIsOpen(sid)){ (ONL.data.chats=ONL.data.chats||[]).push({sid:String(sid),at:Date.now()}); toast('🔓 فُتحت الدردشة معه — يرد عليك متى شاء حتى تغلقها','good'); }
    }
    delete ASK_DRAFT['ch:'+sid]; ta.value='';
    askFabRender(); askFabPanel(); try{ askCardRender(); thDraw(); }catch(e){}
    setTimeout(()=>document.getElementById('chr-'+sid)?.focus(),30);
  }catch(e){ toast(r404(e)?'ارفع worker.js الأخير':'تعذّر الإرسال — تحقق من الاتصال','bad'); }
  finally{ const el=document.getElementById('chr-'+sid); if(el) el.disabled=false; }
}
async function chClose(sid){ const t=chThreads().find(x=>x.sid===String(sid)); if(!t) return; for(const x of t.items.filter(x=>x.status==='open')) await askSend(x.id,true); askFabPanel(); }
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&ASKF.open) askFabToggle(false); });
(function(){ const o=window.thDraw; if(typeof o==='function') window.thDraw=function(){ try{ return o.apply(this,arguments); } finally { try{ askFabRender(); }catch(e){} } }; })();
/* ⚡ الرسائل حيّة حتى بلا إشعار: لحظة العودة للوحة، وكل 5 ثوانٍ تقريبًا والصندوق مفتوح، ونحو 25 ثانية وهو مغلق */
document.addEventListener('visibilitychange',()=>{ if(document.hidden) return; try{ askApplyInbox(); }catch(e){} if(Date.now()-ASK_LAST>5000) try{ asksLoad(); }catch(e){} });
setInterval(()=>{ if(!document.hidden&&ASKF.on&&Date.now()-ASK_LAST>(ASKF.open?5000:25000)) try{ asksLoad(); }catch(e){} },5000);
if(document.readyState!=='loading'){ askFabRender(); try{ askApplyInbox(); }catch(e){} } else document.addEventListener('DOMContentLoaded',()=>{ askFabRender(); try{ askApplyInbox(); }catch(e){} });
