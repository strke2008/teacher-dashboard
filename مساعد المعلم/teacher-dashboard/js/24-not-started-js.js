/* ═════════ 🚶 لم يبدؤوا بعد: طلاب لهم أنشطة منشورة ولم يسلّموا أيًّا منها ═════════ */
function nsList(){
  if(!Array.isArray(STUDENTS)||!Array.isArray(HW)) return [];
  const pub=HW.filter(h=>remPublished(h));
  return STUDENTS.map(s=>{ const mine=pub.filter(h=>hwFor(h,s.cls)); return {s,n:mine.length,any:mine.some(h=>h.subs&&h.subs[s.id])}; })
    .filter(x=>x.n>0&&!x.any).sort((a,b)=>String(a.s.cls).localeCompare(String(b.s.cls),'ar')||String(a.s.name).localeCompare(String(b.s.name),'ar'));
}
/* ═══ 💬 رسائل الطلاب: سؤال أو مشكلة من «راسل معلمك» في البوابة، والرد يصل الطالب في تنبيهاته ═══ */
let ASKS=null, ASK_CATS={activity:'سؤال عن نشاط',tech:'مشكلة في البوابة',grade:'درجة أو تصحيح',lesson:'استفسار عن الدرس',other:'أخرى'};
const ASK_REPLY_CAT='↩️ ردّ على رسالتك';
const ASK_QUICK=['تم حل المشكلة — جرّب الآن ✅','سأشرحها لك في الحصة القادمة إن شاء الله','راجع شرح الدرس في الكتاب ثم أعد المحاولة','فتحت لك محاولة إضافية في النشاط','راجعت درجتك وهي صحيحة','أحسنت على سؤالك 👏 — '];
const ASK_PUSHED=new Map();
let ASK_LAST=0;
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
  if(!ASKS.some(x=>x.id===item.id)) ASKS.unshift(item);
  try{ thDraw(); }catch(e){} try{ askFabRender(); askCardRender(); }catch(e){} if(document.getElementById('ask-inbox')) try{ asksOpen(true); }catch(e){}
}
async function asksLoad(){
  try{ const r=await fetch(getApi().replace(/\/+$/,'')+'/asks?t='+encodeURIComponent(getTok()),{cache:'no-store'}); const j=await r.json();
    if(j&&j.ok){ ASKS=j.rows||[]; if(j.cats) ASK_CATS=j.cats; if(j.mode) ASK_PMODE=j.mode;
      // سؤال وصل بالإشعار قبل أن يظهر في رد الخادم (نسخة قديمة لدقيقة): يبقى ظاهرًا دقيقتين
      ASK_PUSHED.forEach((v,id)=>{ if(Date.now()-v.at>120000||ASKS.some(x=>x.id===id)) ASK_PUSHED.delete(id); else ASKS.unshift(v.item); }); ASK_LAST=Date.now(); try{ thDraw(); }catch(e){} try{ askFabRender(); askCardRender(); }catch(e){} if(document.getElementById('ask-inbox')) asksOpen(true); } }catch(e){}
}
function askAgo(t){ const m=Math.round((Date.now()-t)/60000); return m<1?'الآن':m<60?`قبل ${m} د`:m<1440?`قبل ${Math.round(m/60)} س`:`قبل ${Math.round(m/1440)} يوم`; }
function asksOpen(keep){
  if(ASKS===null){ toast('جارٍ جلب الرسائل…'); asksLoad().then(()=>asksOpen()); return; }
  const open=ASKS.filter(x=>x.status==='open'), done=ASKS.filter(x=>x.status!=='open').slice(0,30);
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
  const open=ASKS.filter(x=>x.status==='open').sort((a,b)=>(a.at||0)-(b.at||0)), done=ASKS.filter(x=>x.status!=='open');
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
const ASKF={open:false,seen:0,ex:'',on:(()=>{ try{ return localStorage.getItem('askf_on_v1')==='1'; }catch(e){ return false; } })()};
/* اسم الطالب في الرسائل: يفتح ملفه الشامل مباشرة (إن كان في الكشف) */
function askNameHTML(x){ const ok=(STUDENTS||[]).some(s=>String(s.id)===String(x.sid));
  return ok?`<b class="ask-nm" role="link" tabindex="0" title="افتح ملف الطالب" onclick="ctOpenProfile('${thEsc(x.sid)}')">${thEsc(x.name)}</b>`:`<b>${thEsc(x.name)}</b>`; }
/* 📌 الصندوق العائم اختياري: المعلم يُظهره أو يخفيه (يُحفظ على هذا الجهاز) */
function askFabSet(on){ ASKF.on=!!on; try{ localStorage.setItem('askf_on_v1',on?'1':'0'); }catch(e){}
  if(!on){ ASKF.open=false; document.getElementById('askf-pan')?.remove(); document.getElementById('askf-btn')?.remove(); }
  askFabRender(); try{ askCardRender(); }catch(e){} if(document.getElementById('ask-inbox')) try{ asksOpen(true); }catch(e){}
  toast(on?'📌 ظهر صندوق الرسائل العائم — تصل إليه من أي صفحة':'أُخفي صندوق الرسائل العائم','good'); }
function askFabToggleBtn(){ return `<button type="button" class="askf-pin${ASKF.on?' on':''}" onclick="askFabSet(${!ASKF.on})" title="${ASKF.on?'إخفاء الزر العائم':'إظهار زر عائم للرسائل في كل الصفحات'}">📌 ${ASKF.on?'عائم عندي ✓':'عائم عندي'}</button>`; }
function askFabRender(){
  if(!document.body) return;
  if(!ASKF.on){ document.getElementById('askf-btn')?.remove(); document.getElementById('askf-pan')?.remove(); return; }
  let b=document.getElementById('askf-btn');
  if(!b){ b=document.createElement('button'); b.type='button'; b.id='askf-btn'; b.className='askf-btn'; b.setAttribute('aria-label','رسائل الطلاب');
    b.onclick=()=>askFabToggle(); document.body.appendChild(b); }
  const open=Array.isArray(ASKS)?ASKS.filter(x=>x.status==='open'):[], n=open.length;
  if(n>ASKF.seen && ASKF.seen>=0 && Array.isArray(ASKS)){ b.classList.remove('ping'); void b.offsetWidth; b.classList.add('ping'); }
  ASKF.seen=n;
  b.innerHTML=`<span class="askf-ic">💬</span>${n?`<b class="askf-n">${n>99?'99+':n}</b>`:''}`;
  b.title=n?`${n} ${n===1?'رسالة تنتظر ردك':'رسائل تنتظر ردك'}`:'رسائل الطلاب';
  b.classList.toggle('has',!!n);
  if(ASKF.open) askFabPanel();
}
function askFabToggle(on){
  ASKF.open=on===undefined?!ASKF.open:!!on;
  const p=document.getElementById('askf-pan');
  if(!ASKF.open){ if(p) p.remove(); document.getElementById('askf-btn')?.classList.remove('on'); return; }
  if(ASKS===null) asksLoad();
  askFabPanel(); document.getElementById('askf-btn')?.classList.add('on');
}
function askFabPanel(){
  let p=document.getElementById('askf-pan');
  if(!p){ p=document.createElement('div'); p.id='askf-pan'; p.className='askf-pan'; p.setAttribute('role','dialog'); document.body.appendChild(p); }
  const focus=document.activeElement&&p.contains(document.activeElement)?document.activeElement.id:'';
  const open=Array.isArray(ASKS)?ASKS.filter(x=>x.status==='open').sort((a,b)=>(a.at||0)-(b.at||0)):[];
  const done=Array.isArray(ASKS)?ASKS.filter(x=>x.status!=='open').length:0;
  const item=x=>{ const id=thEsc(x.id);
    return `<div class="askf-it"><div class="askf-h">${askNameHTML(x)}<span class="muted">${thEsc(x.cls||'')}</span><span class="muted askf-t">${askAgo(x.at)}</span></div>
      ${(ASK_CATS[x.cat]||(x.cat==='reply'?ASK_REPLY_CAT:''))||x.hwTitle?`<div class="askf-meta">${(ASK_CATS[x.cat]||(x.cat==='reply'?ASK_REPLY_CAT:''))?`<span class="ask-cat">${thEsc((ASK_CATS[x.cat]||(x.cat==='reply'?ASK_REPLY_CAT:'')))}</span>`:''}${x.hwTitle?`<span class="muted">📚 «${thEsc(x.hwTitle)}»</span>`:''}</div>`:''}
      <div class="askf-q">${thEsc(x.text)}</div>
      ${ASKF.ex===x.id?`<div class="ask-quick">${ASK_QUICK.slice(0,4).map(t=>`<button type="button" onclick="askQuick('${id}',this.textContent,'askfr-')">${thEsc(t)}</button>`).join('')}</div>
      <textarea class="inp" id="askfr-${id}" rows="2" maxlength="1000" placeholder="اكتب ردك… يصل الطالب في تنبيهاته" oninput="ASK_DRAFT['${id}']=this.value">${thEsc(ASK_DRAFT[x.id]||'')}</textarea>
      <div class="askf-b"><button type="button" class="btn tick sm" onclick="askSend('${id}',false,'askfr-')">📩 أرسل</button><button type="button" class="btn ghost sm" onclick="ASKF.ex='';askFabPanel()">إلغاء</button></div>`
      :`<div class="askf-b"><button type="button" class="btn sm" onclick="ASKF.ex='${id}';askFabPanel();setTimeout(()=>document.getElementById('askfr-${id}')?.focus(),30)">✍️ رد</button>
        <button type="button" class="btn ghost sm" title="حللتها معه في الفصل — لا يُرسل شيء" onclick="askSend('${id}',true)">✓ أُغلق دون رد</button>
`}</div></div>`; };
  p.innerHTML=`<div class="askf-top"><b>💬 رسائل الطلاب</b>${open.length?`<span class="chip bad">${open.length} تنتظر ردك</span>`:''}<button type="button" class="askf-x" onclick="askFabToggle(false)" aria-label="إغلاق">✕</button></div>
    <div class="askf-list">${ASKS===null?'<div class="muted" style="padding:1rem;text-align:center">⏳ جارٍ الجلب…</div>':open.length?open.map(item).join(''):`<div class="askf-empty">🌿 لا رسائل تنتظر ردك${done?`<small>ردَدت على ${done}</small>`:''}</div>`}</div>
    <div class="askf-foot"><button type="button" class="btn ghost sm" onclick="askFabToggle(false);asksOpen()">كل الرسائل والسابقة</button><button type="button" class="btn ghost sm" onclick="asksLoad()">🔄 تحديث</button><button type="button" class="btn ghost sm" onclick="askFabSet(false)" title="يمكنك إظهاره مجددًا من بطاقة «رسائل الطلاب»">إخفاء الزر</button></div>`;
  if(focus){ const el=document.getElementById(focus); if(el){ el.focus(); try{ el.setSelectionRange(el.value.length,el.value.length); }catch(e){} } }
}
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&ASKF.open) askFabToggle(false); });
(function(){ const o=window.thDraw; if(typeof o==='function') window.thDraw=function(){ try{ return o.apply(this,arguments); } finally { try{ askFabRender(); }catch(e){} } }; })();
/* ⚡ الرسائل حيّة حتى بلا إشعار: عند العودة للوحة، وكل دقيقة والصندوق العائم ظاهر */
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&Date.now()-ASK_LAST>30000) try{ asksLoad(); }catch(e){} });
setInterval(()=>{ if(!document.hidden&&ASKF.on&&Date.now()-ASK_LAST>55000) try{ asksLoad(); }catch(e){} },20000);
if(document.readyState!=='loading') askFabRender(); else document.addEventListener('DOMContentLoaded',()=>askFabRender());
