'use strict';
/* ═════════ 🟢 المتصلون الآن + 📣 الرسالة الفورية ═════════
   بوابة الطالب ترسل نبضًا كل ~30 ث وهي ظاهرة (/presence): نعرض هنا من متصل الآن وماذا يفعل.
   الرسالة الفورية ليست نظامًا مستقلًا: رسالة عادية (/messages) تُحفظ في رسائل الطالب ويصله إشعارها،
   ومعها live:true فيرى المتصل تنبيهًا على صندوقه العائم خلال ثوانٍ. ورده يصل «💬 رسائل الطلاب» (ASKS، re = معرّف الرسالة)
   ونرد عليه من هناك كأي رسالة طالب. هنا نعرض فقط حالة التسليم والردود المرتبطة بكل رسالة. */
const ONL={data:null,at:0,busy:false,sel:new Set(),cls:'',open:false,timer:0};
function onlApi(){ return (typeof getApi==='function'?getApi():'').replace(/\/+$/,''); }
function onlStu(sid){ return (Array.isArray(STUDENTS)?STUDENTS:[]).find(s=>String(s.id)===String(sid))||null; }
function onlAgo(ms){ const m=Math.round(ms/60000); return m<1?'الآن':m===1?'منذ دقيقة':m===2?'منذ دقيقتين':m<=10?`منذ ${m} دقائق`:`منذ ${m} دقيقة`; }
function onlRows(){
  const D=ONL.data; if(!D) return {on:[],recent:[]};
  // الأعمار بساعة الخادم (D.now) مضافًا إليها ما مضى منذ الجلب — لا نعتمد على ساعة جهاز المعلم
  const lim=Number(D.onlineMs)||90000, t=(Number(D.now)||ONL.at)+(Date.now()-ONL.at);
  const rows=(D.presence||[]).map(p=>({...p,s:onlStu(p.sid),age:Math.max(0,t-Number(p.at)),dur:Math.max(0,t-Number(p.since))})).filter(r=>r.s);
  return { on:rows.filter(r=>r.age<lim), recent:rows.filter(r=>r.age>=lim) };
}
async function onlLoad(){
  if(ONL.busy) return; const api=onlApi(), tok=(typeof getTok==='function'?getTok():'');
  if(!api||!tok) return; ONL.busy=true;
  try{ const r=await fetch(api+'/presence?t='+encodeURIComponent(tok),{cache:'no-store'}); const j=await r.json().catch(()=>null);
    if(j&&j.ok){ ONL.data=j; ONL.at=Date.now(); } }catch(e){} finally{ ONL.busy=false; }
  onlChip(); if(ONL.open) onlRender(); try{ askFabRender(); }catch(e){}
}
function onlChip(){
  const host=document.querySelector('.masthead-in'); if(!host) return;
  let b=document.getElementById('onl-chip');
  if(!b){ b=document.createElement('button'); b.type='button'; b.id='onl-chip'; b.className='onl-chip no-print'; b.onclick=onlOpen;
    /* الشريحة آخر عنصر في الشريط فيُدفع هامشها التلقائي بها أقصى اليسار دائمًا */
    host.appendChild(b); }
  const {on}=onlRows(), unread=onlReplies().filter(x=>x.status==='open').length;
  b.innerHTML=`<i class="onl-dot ${on.length?'on':''}"></i><b>${on.length}</b><span class="onl-w"> متصل الآن</span>${unread?`<span class="onl-badge" title="ردود على رسائلك تنتظرك في «رسائل الطلاب»">${unread}</span>`:''}`;
  b.title=on.length?on.slice(0,8).map(r=>r.s.name).join('، '):'لا أحد من طلابك في البوابة الآن';
}
/* ردود الطلاب على رسائلك الفورية: من «رسائل الطلاب» نفسها */
function onlReplies(){ const mids=new Set(((ONL.data&&ONL.data.live)||[]).map(n=>n.mid)); return (typeof ASKS!=='undefined'&&Array.isArray(ASKS)?ASKS:[]).filter(x=>x.re&&mids.has(x.re)); }
function onlOpen(){
  ONL.open=true;
  openModal(`<div id="onl-box"><div class="muted" style="padding:1rem">⏳ جارٍ التحميل…</div></div>`);
  const veil=document.getElementById('veil');
  const stop=()=>{ ONL.open=false; clearInterval(ONL.timer); onlChip(); };
  let tick=0;
  clearInterval(ONL.timer); ONL.timer=setInterval(()=>{ if(!veil||!veil.classList.contains('on')||!document.getElementById('onl-box')) return stop(); if(document.hidden) return; onlLoad(); if(++tick%3===0) onlAsks(); },10000);
  Promise.all([onlLoad(),onlAsks()]).then(()=>onlRender());
}
async function onlAsks(){ if(typeof asksLoad!=='function') return; await asksLoad(); if(ONL.open) onlRender(); onlChip(); }
function onlRender(){
  const box=document.getElementById('onl-box'); if(!box) return;
  const {on,recent}=onlRows(), D=ONL.data;
  if(!D){ box.innerHTML='<div class="ct-warn">تعذّر جلب المتصلين — تأكد من نشر worker.js وربط قاعدة D1.</div>'; return; }
  const classes=[...new Set(on.map(r=>String(r.s.cls||'')))].filter(Boolean).sort();
  const list=on.filter(r=>!ONL.cls||String(r.s.cls||'')===ONL.cls);
  [...ONL.sel].forEach(id=>{ if(!on.some(r=>String(r.sid)===id)) ONL.sel.delete(id); });
  const name=sid=>{ const s=onlStu(sid); return s?s.name:'طالب'; };
  const groups={}, reps=onlReplies();
  (D.live||[]).forEach(n=>{ (groups[n.mid]=groups[n.mid]||{mid:n.mid,body:n.body,at:n.at,items:[]}).items.push(n); });
  const tpl=['هل النشاط يعمل معك بشكل صحيح؟','افتح النشاط الجديد وأخبرني رأيك 👍','جرّب هذه الميزة وأخبرني هل واجهتك مشكلة','أحسنت! استمر 🌟','ادخل المسابقة المباشرة الآن 🎮'];
  // التحديث كل 10 ث لا يمسح ما تكتبه ولا يحرّك التمرير: نحفظ النص والمؤشر ومواضع التمرير ثم نعيدها
  const ta0=document.getElementById('onl-msg'), act=document.activeElement, keep={
    draft:ta0?ta0.value:(ONL.draft||''), focus:act&&box.contains(act)&&act.id?act.id:'', s0:ta0?ta0.selectionStart:0, s1:ta0?ta0.selectionEnd:0,
    list:box.querySelector('.onl-list')?.scrollTop||0, scrollers:[] };
  for(let el=box;el;el=el.parentElement){ if(el.scrollTop) keep.scrollers.push([el,el.scrollTop]); }
  box.innerHTML=`<h2 style="margin:0 0 .2rem">🟢 المتصلون الآن <span class="chip ${on.length?'tick':'ghost'}">${on.length}</span></h2>
    <p class="muted" style="font-size:.8rem;margin:.1rem 0 .6rem">من فتح البوابة خلال آخر دقيقة ونصف وهي ظاهرة على شاشته · يتحدث كل 10 ثوانٍ</p>
    ${classes.length>1?`<div class="row" style="gap:.3rem;flex-wrap:wrap;margin-bottom:.5rem"><button class="chip ${!ONL.cls?'tick':'ghost'}" onclick="ONL.cls='';onlRender()">الكل</button>${classes.map(c=>`<button class="chip ${ONL.cls===c?'tick':'ghost'}" onclick="ONL.cls=${JSON.stringify(c).replace(/"/g,'&quot;')};onlRender()">${esc(c)}</button>`).join('')}</div>`:''}
    ${list.length?`<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:.3rem"><label class="muted" style="font-size:.8rem"><input type="checkbox" ${list.every(r=>ONL.sel.has(String(r.sid)))?'checked':''} onchange="onlSelAll(this.checked)"> تحديد الكل (${list.length})</label><span class="muted" style="font-size:.78rem">${ONL.sel.size} محدد</span></div>
      <div class="onl-list">${list.map(r=>`<label class="onl-row"><input type="checkbox" ${ONL.sel.has(String(r.sid))?'checked':''} onchange="onlSel('${esc(r.sid)}',this.checked)">
        <i class="onl-dot on"></i><span class="onl-n"><b>${esc(r.s.name)}</b><small>${esc(r.s.cls||'')} · متصل ${esc(onlAgo(r.dur))}</small></span>
        <span class="onl-w">${esc(r.w||'')}</span><button type="button" class="btn ghost sm" title="محادثة خاصة" onclick="event.preventDefault();closeModal();chOpen('${esc(r.sid)}')">💬</button></label>`).join('')}</div>
      <div class="onl-send"><div class="onl-tpl">${tpl.map(t=>`<button type="button" class="chip ghost" onclick="document.getElementById('onl-msg').value=${JSON.stringify(t).replace(/"/g,'&quot;')};document.getElementById('onl-msg').focus()">${esc(t)}</button>`).join('')}</div>
        <textarea id="onl-msg" class="inp" rows="2" maxlength="1000" oninput="ONL.draft=this.value" placeholder="تصل لصندوق محادثة الطالب خلال ثوانٍ وتبقى في رسائله، ورده يصلك في «💬 رسائل الطلاب»…"></textarea>
        <div class="row" style="gap:.4rem;justify-content:flex-end;margin-top:.4rem"><span id="onl-st" class="muted" style="font-size:.8rem;margin-inline-end:auto"></span><button class="btn tick" onclick="onlSend()">📣 أرسل للمحددين</button></div></div>`
    :`<div class="empty" style="padding:1.2rem"><span class="big">🌙</span>لا أحد من طلابك${ONL.cls?' في هذا الفصل':''} في البوابة الآن.</div>`}
    ${recent.length?`<details style="margin-top:.6rem"><summary class="muted" style="cursor:pointer;font-size:.82rem">ظهروا خلال آخر نصف ساعة (${recent.length})</summary><div class="onl-recent">${recent.slice(0,40).map(r=>`<span class="chip ghost" title="${esc(r.w||'')}">${esc(r.s.name)} · ${esc(onlAgo(r.age))}</span>`).join('')}</div></details>`:''}
    <div class="onl-hist"><b>📨 رسائلك الفورية (آخر 6 ساعات)</b>${Object.values(groups).length?Object.values(groups).sort((a,b)=>b.at-a.at).slice(0,12).map(g=>`<div class="onl-g"><div class="onl-gh"><span>«${esc(g.body)}»</span><small>${esc(onlAgo(Date.now()-g.at))} · وصلت ${g.items.filter(n=>n.seen_at).length} من ${g.items.length}</small></div>
      ${reps.filter(x=>x.re===g.mid).map(x=>`<div class="onl-rep ${x.status==='open'?'new':''}"><b>${esc(x.name||name(x.sid))}:</b> ${esc(x.text)}
        <button type="button" class="btn ghost sm" onclick="closeModal();chOpen('${esc(x.sid)}')">${x.status==='open'?'💬 رد عليه':'💬 المحادثة'}</button></div>`).join('')}
      ${g.items.filter(n=>!n.seen_at).length?`<div class="muted" style="font-size:.74rem">⏳ لم تصل بعد: ${g.items.filter(n=>!n.seen_at).map(n=>esc(name(n.sid))).join('، ')}</div>`:''}</div>`).join(''):'<div class="muted" style="font-size:.8rem">لم ترسل رسالة فورية بعد.</div>'}</div>
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`;
  const ta=document.getElementById('onl-msg'); if(ta){ ta.value=keep.draft; ONL.draft=keep.draft; }
  const ls=box.querySelector('.onl-list'); if(ls) ls.scrollTop=keep.list;
  keep.scrollers.forEach(([el,t])=>{ if(el.isConnected) el.scrollTop=t; });
  if(keep.focus){ const f=document.getElementById(keep.focus); if(f){ f.focus({preventScroll:true}); if(f===ta) try{ ta.setSelectionRange(keep.s0,keep.s1); }catch(e){} } }
}
function onlSel(id,on){ on?ONL.sel.add(String(id)):ONL.sel.delete(String(id)); const t=document.querySelector('#onl-box .onl-list')?.previousElementSibling?.querySelector('span'); if(t) t.textContent=`${ONL.sel.size} محدد`; }
function onlSelAll(on){ const {on:rows}=onlRows(); rows.filter(r=>!ONL.cls||String(r.s.cls||'')===ONL.cls).forEach(r=>on?ONL.sel.add(String(r.sid)):ONL.sel.delete(String(r.sid))); onlRender(); }
async function onlSend(){
  const ta=document.getElementById('onl-msg'), st=document.getElementById('onl-st'), body=String(ta&&ta.value||'').trim();
  if(!ONL.sel.size){ st.textContent='حدّد طالبًا واحدًا على الأقل.'; return; }
  if(!body){ st.textContent='اكتب الرسالة.'; ta.focus(); return; }
  st.textContent='جارٍ الإرسال…';
  try{ const j=await (await fetch(onlApi()+'/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),title:'رسالة من معلمك',body,type:'message',priority:'normal',audience:'students',
      recipients:[...ONL.sel].map(id=>{ const s=onlStu(id); return {id,name:s?s.name:''}; }),live:true})})).json();
    if(!j||!j.ok) throw new Error(j&&j.error||'فشل');
    toast(j.live?`📣 أُرسلت إلى ${j.count} — تظهر لهم خلال ثوانٍ وتبقى في رسائلهم`:`📨 وصلت لرسائل ${j.count} — انشر worker.js الأخير لتصلهم فورًا`,'good'); ta.value=''; ONL.draft=''; ONL.sel.clear(); await onlLoad(); onlRender();
  }catch(e){ st.textContent='تعذّر الإرسال: '+(e.message||''); }
}
/* تحديث العدّاد: كل 30 ث واللوحة ظاهرة، وفورًا عند العودة إليها */
setTimeout(onlLoad,4000);
setInterval(()=>{ if(!document.hidden&&!ONL.open) onlLoad(); },30000);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&Date.now()-ONL.at>15000) onlLoad(); });
