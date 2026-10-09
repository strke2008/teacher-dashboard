/* ═════════ 🚶 لم يبدؤوا بعد: طلاب لهم أنشطة منشورة ولم يسلّموا أيًّا منها ═════════ */
function nsList(){
  if(!Array.isArray(STUDENTS)||!Array.isArray(HW)) return [];
  const pub=HW.filter(h=>remPublished(h));
  return STUDENTS.map(s=>{ const mine=pub.filter(h=>hwFor(h,s.cls)); return {s,n:mine.length,any:mine.some(h=>h.subs&&h.subs[s.id])}; })
    .filter(x=>x.n>0&&!x.any).sort((a,b)=>String(a.s.cls).localeCompare(String(b.s.cls),'ar')||String(a.s.name).localeCompare(String(b.s.name),'ar'));
}
/* ═══ 💬 رسائل الطلاب: سؤال أو مشكلة من «راسل معلمك» في البوابة، والرد يصل الطالب في تنبيهاته ═══ */
let ASKS=null, ASK_CATS={activity:'سؤال عن نشاط',tech:'مشكلة في البوابة',grade:'درجة أو تصحيح',lesson:'استفسار عن الدرس',other:'أخرى'};
const ASK_QUICK=['تم حل المشكلة — جرّب الآن ✅','سأشرحها لك في الحصة القادمة إن شاء الله','راجع شرح الدرس في الكتاب ثم أعد المحاولة','فتحت لك محاولة إضافية في النشاط','راجعت درجتك وهي صحيحة','أحسنت على سؤالك 👏 — '];
async function asksLoad(){
  try{ const r=await fetch(getApi().replace(/\/+$/,'')+'/asks?t='+encodeURIComponent(getTok()),{cache:'no-store'}); const j=await r.json();
    if(j&&j.ok){ ASKS=j.rows||[]; if(j.cats) ASK_CATS=j.cats; try{ thDraw(); }catch(e){} if(document.getElementById('ask-inbox')) asksOpen(true); } }catch(e){}
}
function askAgo(t){ const m=Math.round((Date.now()-t)/60000); return m<1?'الآن':m<60?`قبل ${m} د`:m<1440?`قبل ${Math.round(m/60)} س`:`قبل ${Math.round(m/1440)} يوم`; }
function asksOpen(keep){
  if(ASKS===null){ toast('جارٍ جلب الرسائل…'); asksLoad().then(()=>asksOpen()); return; }
  const open=ASKS.filter(x=>x.status==='open'), done=ASKS.filter(x=>x.status!=='open').slice(0,30);
  const card=x=>`<div class="ask-t" id="askc-${thEsc(x.id)}">
      <div class="ask-t-h"><b>${thEsc(x.name)}</b><span class="muted">${thEsc(x.cls||'')}</span><span class="ask-cat">${thEsc(ASK_CATS[x.cat]||'')}</span><span class="muted">${askAgo(x.at)}</span></div>
      ${x.hwTitle?`<div class="muted" style="font-size:.78rem">📚 «${thEsc(x.hwTitle)}»</div>`:''}
      <div class="ask-t-q">${thEsc(x.text)}</div>
      ${x.status==='open'?`<div class="ask-quick">${ASK_QUICK.map(t=>`<button type="button" onclick="askQuick('${thEsc(x.id)}',this.textContent)">${thEsc(t)}</button>`).join('')}</div>
      <textarea class="inp" id="askr-${thEsc(x.id)}" rows="2" maxlength="1000" placeholder="اكتب ردك… يصل الطالب في تنبيهاته"></textarea>
      <div class="ask-t-b"><button type="button" class="btn tick sm" onclick="askSend('${thEsc(x.id)}')">📩 أرسل الرد</button>
        <button type="button" class="btn ghost sm" title="حللتها معه في الفصل — لا يُرسل شيء" onclick="askSend('${thEsc(x.id)}',true)">✓ أُغلق دون رد</button>
        ${(STUDENTS||[]).some(s=>String(s.id)===String(x.sid))?`<button type="button" class="btn ghost sm" onclick="ctOpenProfile('${thEsc(x.sid)}')" title="الملف الشامل">👤</button>`:''}</div>`
      :`${x.reply?`<div class="ask-t-r">📩 ${thEsc(x.reply)}</div><div class="muted" style="font-size:.74rem;margin-top:.2rem">${x.seenAt?'👁️ قرأ الطالب الرد':'⏳ لم يقرأ الطالب الرد بعد'}</div>`:'<div class="muted" style="font-size:.78rem">أُغلق دون رد</div>'}
        <div class="ask-t-b"><button type="button" class="btn ghost sm" onclick="askReopen('${thEsc(x.id)}')">↩️ إعادة فتح</button></div>`}
    </div>`;
  const html=`<h2 id="ask-inbox">💬 رسائل الطلاب ${open.length?`<span class="chip bad">${open.length} تنتظر ردك</span>`:''}</h2>
    <p class="muted" style="font-size:.82rem;margin:.2rem 0 .7rem">يرسلها الطالب من «💬 راسل معلمك» في بوابته (حتى ${3} أسئلة مفتوحة و5 رسائل يوميًا). ردك يصله في تنبيهاته مع إشعار.</p>
    ${open.length?open.map(card).join(''):'<div class="feature-empty">لا رسائل تنتظر ردك 🌿</div>'}
    ${done.length?`<details style="margin-top:.7rem"><summary class="muted" style="cursor:pointer">✓ تمّ الرد عليها (${done.length})</summary>${done.map(card).join('')}</details>`:''}
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إغلاق</button><button class="btn ghost" onclick="asksLoad()">🔄 تحديث</button></div>`;
  if(keep&&document.getElementById('ask-inbox')){ const m=document.getElementById('ask-inbox').parentElement; if(m) m.innerHTML=html; return; }
  openModal(html);
}
function askQuick(id,t){ const ta=document.getElementById('askr-'+id); if(!ta) return; ta.value=ta.value?ta.value.trim()+' '+t:t; ta.focus(); }
async function askSend(id,close){
  const ta=document.getElementById('askr-'+id), reply=close?'':String(ta&&ta.value||'').trim();
  if(!close&&!reply){ toast('اكتب الرد أولًا','bad'); ta&&ta.focus(); return; }
  try{ const r=await fetch(getApi().replace(/\/+$/,'')+'/ask-reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),id,reply,close:!!close})});
    const j=await r.json(); if(!j.ok) throw new Error(j.error||'');
    const i=ASKS.findIndex(x=>x.id===id); if(i>=0) ASKS[i]=j.item;
    toast(close?'✓ أُغلقت الرسالة':'📩 وصل ردك للطالب في تنبيهاته','good'); asksOpen(true); thDraw();
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
