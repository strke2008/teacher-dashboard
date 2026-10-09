/* ═════════ 🗂️ رصد سريع من صفحة اليوم — تعديلات محلية ثم حفظ واحد ═════════ */
const TQ={cls:'',day:'',ch:{}};
const TQ_P=[['شارك','p','✓ شارك'],['لم يشارك','n','لم يشارك'],['غائب','a','غائب'],['غائب بعذر','e','بعذر']];
const TQ_H=[['أنجز','hd','أنجز'],['لم ينجز','hn','لم ينجز']];
function tqVal(m,sid){ const k=m+'|'+sid; if(k in TQ.ch) return TQ.ch[k]; return ctStatus(CT_DATA||{},m,TQ.day,sid); }
function tdQuick(cls){
  if(!CT_DATA){ toast('بيانات الفصل لم تُحمّل بعد — حاول بعد لحظة','bad'); return; }
  TQ.cls=cls; TQ.day=tdKsaNow().day; TQ.ch={}; TQ.beh=[]; TQ.tpl=[]; TQ.openBeh=''; tqRender();
}
function tqRender(){
  const roster=ctRoster(TQ.cls), n=Object.keys(TQ.ch).length+TQ.beh.length;
  const cnt=v=>roster.filter(s=>tqVal('participation',s.id)===v).length;
  // إعادة الرسم كانت تُرجع القائمة لأعلاها، فتفتح قائمة السلوك لطالب في الأسفل خارج الشاشة
  const _q=()=>[document.querySelector('#modal .tq-list'),document.getElementById('modal')], _sc=_q().map(e=>e?e.scrollTop:0);
  openModal(`<h2>🗂️ رصد ${esc(TQ.cls)} — اليوم</h2>
    <div class="tq-top"><button class="btn tick sm" onclick="tqAll()">✅ الكل شارك</button>
      <span class="muted" style="font-size:.8rem">ثم عدّل الاستثناءات · شارك ${cnt('شارك')} · لم يشارك ${cnt('لم يشارك')} · غائب ${cnt('غائب')+cnt('غائب بعذر')}</span></div>
    <div class="tq-list">${roster.map(s=>{ const id=String(s.id), p=tqVal('participation',id), h=tqVal('homework',id), ch=('participation|'+id in TQ.ch)||('homework|'+id in TQ.ch);
      return `<div class="tq-row ${ch?'ch':''}" data-sid="${esc(id)}"><span class="tq-n">${esc(s.name)}</span>
        <span class="tq-seg">${TQ_P.map(([v,c,l])=>`<button type="button" class="${c} ${p===v?'on':''}" onclick="tqSet('participation','${esc(id)}','${v}')">${l}</button>`).join('')}</span>
        <span class="tq-seg">${TQ_H.map(([v,c,l])=>`<button type="button" class="${c} ${h===v?'on':''}" onclick="tqSet('homework','${esc(id)}','${v}')">${l}</button>`).join('')}</span>
        <button type="button" class="tq-bbtn ${TQ.openBeh===id?'on':''}" onclick="tqBehToggle('${esc(id)}')" title="ملاحظة سلوكية">🌟⚠️${(()=>{ const n=bhvToday(id)+TQ.beh.filter(b=>b.sid===id).length; return n?` ${n}`:''; })()}</button>
        ${TQ.beh.map((b,i)=>b.sid===id?`<span class="tq-bchip ${b.type==='positive'?'p':'n'}">${esc(b.category)} <a href="#" onclick="event.preventDefault();TQ.beh.splice(${i},1);tqRender()">✕</a></span>`:'').join('')}
        ${TQ.openBeh===id?`<div class="tq-bpick">${bhvPickerHTML(id,'tq')}</div>`:''}</div>`; }).join('')||'<div class="feature-empty">لا طلاب في هذا الفصل.</div>'}</div>
    <div class="tq-foot"><button class="btn tick" id="tq-save" onclick="tqSave()" ${n?'':'disabled'}>💾 حفظ ${n?`(${n} تعديل)`:''}</button>
      <button class="btn ghost sm" onclick="tqClose(true)">فتح السجل الكامل</button><span class="spacer"></span>
      <button class="btn ghost" onclick="tqClose()">إغلاق</button></div>`);
  _q().forEach((e,i)=>{ if(e) e.scrollTop=_sc[i]; });
  if(TQ.openBeh&&TQ._scrollBeh){ TQ._scrollBeh=false; const r=document.querySelector(`.tq-row[data-sid="${CSS.escape(TQ.openBeh)}"]`); if(r) r.scrollIntoView({block:'nearest',behavior:'smooth'}); }
}
function tqSet(m,sid,v){
  const k=m+'|'+sid, cur=tqVal(m,sid);
  TQ.ch[k]=cur===v?'':v;   // ضغطة ثانية على الاختيار نفسه تلغيه
  if(TQ.ch[k]===ctStatus(CT_DATA||{},m,TQ.day,sid)) delete TQ.ch[k];
  tqRender();
}
function tqAll(){ ctRoster(TQ.cls).forEach(s=>{ if(!tqVal('participation',String(s.id))) TQ.ch['participation|'+s.id]='شارك'; }); tqRender(); }
async function tqSave(){
  const ch=Object.entries(TQ.ch), beh=TQ.beh.slice(), tpl=TQ.tpl.slice(); if(!ch.length&&!beh.length) return;
  const b=document.getElementById('tq-save'); if(b){ b.disabled=true; b.textContent='جارٍ الحفظ…'; }
  const d=TQ.day, now=Date.now();
  try{
    await ctSave(D=>{ ch.forEach(([k,v])=>{ const [m,sid]=k.split('|'); D[m]=D[m]||{}; D[m][d]=D[m][d]||{};
      if(v) D[m][d][sid]={status:v,at:now}; else delete D[m][d][sid];
      // كما في البوابة: الغائب «معذور» في واجب يومه تلقائيًا
      if(m==='participation'){ D.homework=D.homework||{}; D.homework[d]=D.homework[d]||{}; const h=D.homework[d][sid], hs=String(h&&h.status||'');
        if(v==='غائب'||v==='غائب بعذر'){ if(!hs||hs==='لم ينجز') D.homework[d][sid]={status:'معذور',at:now,auto:true,prev:hs}; }
        else if(h&&h.auto) D.homework[d][sid]={status:h.prev||'',at:now}; } });
      if(beh.length){ D.behavior=Array.isArray(D.behavior)?D.behavior:[]; beh.forEach((b,i)=>D.behavior.unshift({id:(now+i).toString(36),studentId:b.sid,type:b.type,category:b.category,note:b.note||'',date:d,at:now+i})); }
      if(tpl.length){ D.behaviorTemplates=[...tpl,...(Array.isArray(D.behaviorTemplates)?D.behaviorTemplates:[])].slice(0,500); } });
    toast(`✓ حُفظ رصد ${TQ.cls}${beh.length?` و${beh.length} ملاحظة سلوكية`:''}`,'good'); TQ.ch={}; TQ.beh=[]; TQ.tpl=[]; closeModal(); thDraw();
  }catch(e){ toast('تعذّر الحفظ — تحقق من الاتصال','bad'); if(b){ b.disabled=false; b.textContent='💾 حفظ'; } }
}
async function tqClose(full){
  if((Object.keys(TQ.ch).length||TQ.beh.length)&&!(await askConfirm('لم تحفظ تعديلات الرصد. إغلاق بدون حفظ؟',{yes:'إغلاق',danger:true}))) return;
  TQ.ch={}; TQ.beh=[]; TQ.tpl=[]; closeModal();
  if(full){ window._ctRcCls=TQ.cls; window._ctRcD=TQ.day; window._ctRcView='day'; ctGo('records'); }
}

/* ═════════ ⏰ تذكيرات المعلم من البوابة (data.reminders) — نفس حساب المواعيد ═════════ */
function tdRemTitle(r){
  if(r.kind==='duty'){ const D=CT_DATA||{}, x=(D.roles||[]).find(o=>o&&o.active&&o.cls===r.cls&&o.title==='مسؤول رصد الواجبات'), st=x&&(STUDENTS||[]).find(s=>String(s.id)===String(x.studentId));
    return st?`ذكّر ${tdShortName(st.name)} برصد واجبات ${r.cls}`:`ذكّر مسؤول رصد الواجبات · ${r.cls}`; }
  return r.title||'تذكير';
}
function tdRemToday(){
  const D=CT_DATA; if(!D||!Array.isArray(D.reminders)) return [];
  const k=tdKsaNow(), sc=D.schedule||{}, T=tdTimes(sc), g=(sc.grid||{})[String(k.dow)]||{};
  const hm=t=>{ const p=String(t||'7:00').split(':'); return (+p[0]||0)*60+(+p[1]||0); };
  const lbl=m=>{ m=((m%1440)+1440)%1440; const h=Math.floor(m/60), mi=m%60; return `${((h+11)%12)+1}:${String(mi).padStart(2,'0')} ${h<12?'ص':'م'}`; };
  const out=[];
  D.reminders.forEach(r=>{ if(!r||r.paused) return;
    if(r.repeat==='once'?r.date!==k.day:!(r.days||[]).includes(k.dow)) return;
    const a=r.at||{}; let sm=null;
    if(a.t==='class'){ const t=T.find(x=>String(g[String(x.n)]||'').trim()===a.cls); if(t) sm=t.sm; }
    else if(a.t==='period'){ const t=T.find(x=>x.n===Number(a.p)); if(t) sm=t.sm; }
    else if(a.t==='time'&&/^\d{1,2}:\d{2}$/.test(a.hm||'')) sm=hm(a.hm);
    if(sm==null) return;
    const fire=Math.max(0,sm-(Number(r.lead)||0));
    out.push({r,fire,hm:lbl(fire),late:fire<=k.min,done:!!(r.done&&r.done[k.day])}); });
  return out.sort((a,b)=>a.fire-b.fire);
}
async function tdRemDone(id){
  const d=tdKsaNow().day;
  try{ await ctSave(D=>{ const r=(D.reminders||[]).find(x=>x&&x.id===id); if(r){ r.done=r.done||{}; r.done[d]=true; } }); toast('✓ تمّت — وتظهر منجزة في بوابة المعلم أيضًا','good'); thDraw(); }
  catch(e){ toast('تعذّر الحفظ','bad'); }
}

/* ═════════ 🙋 غائبو اليوم ═════════ */
function tdAbsentLine(){
  const D=CT_DATA; if(!D) return '';
  const day=tdKsaNow().day, P=(D.participation||{})[day]||{};
  const ab=(STUDENTS||[]).filter(s=>{ const r=P[String(s.id)], st=r&&(typeof r==='string'?r:r.status); return st==='غائب'||st==='غائب بعذر'; });
  if(!ab.length) return '';
  return `<div class="td-abs"><b>🙋 غائبو اليوم (${ab.length}):</b>${ab.slice(0,12).map(s=>`<a href="#" onclick="event.preventDefault();ctOpenProfile('${thEsc(s.id)}')" title="${thEsc(s.cls||'')}">${thEsc(tdShortName(s.name))}</a>`).join('')}${ab.length>12?`<span class="muted">+${ab.length-12}</span>`:''}</div>`;
}

/* ═════════ 🌙 ملخص نهاية اليوم (بعد آخر حصة) — والخميس ملخص الأسبوع ═════════ */
function tdDaySummary(D,k,T,rec){
  const P=(D.participation||{})[k.day]||{}, st=r=>r&&(typeof r==='string'?r:r.status);
  const ab=Object.values(P).filter(r=>/غائب/.test(st(r)||'')).length;
  const t0=Date.parse(k.day+'T00:00:00+03:00'); let subs=0; HW.forEach(h=>Object.values(h.subs||{}).forEach(v=>{ if(v&&+v.at>=t0) subs++; }));
  const beh=(D.behavior||[]).filter(x=>x&&!x.deleted&&x.date===k.day), pos=beh.filter(x=>x.type==='positive').length;
  const done=T.filter(rec).length, thu=k.dow===4;
  return `<div class="td-sum"><b>🌙 انتهت حصص اليوم — ${done===T.length?'رصدتها كلها 👏':`رُصد ${done} من ${T.length}`}</b>
    <div class="td-sum-g"><span>🙋 الغياب: <b>${ab}</b></span><span>📥 تسليمات اليوم: <b>${subs}</b></span><span>🌟 ملاحظات إيجابية: <b>${pos}</b></span><span>⚠️ سلوكية: <b>${beh.length-pos}</b></span></div>
    ${done<T.length?`<div class="td-pers" style="margin-top:.5rem">${T.filter(t=>!rec(t)).map(t=>`<button type="button" class="td-per miss" onclick="tdQuick('${thEsc(((D.schedule||{}).grid||{})[String(k.dow)][String(t.n)])}')">! ${t.n} · ${thEsc(((D.schedule||{}).grid||{})[String(k.dow)][String(t.n)])} — ارصدها</button>`).join('')}</div>`:''}
    ${thu?`<div style="margin-top:.55rem;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap"><b>📆 نهاية الأسبوع</b><button class="btn sm" onclick="kashfGo('weekly');setTimeout(()=>wrOpen(),600)">📤 إرسال تقارير الأسبوع للطلاب</button></div>`:''}</div>`;
}

/* ═════════ 📅 شريط الأسبوع: مواعيد الأنشطة والاختبارات والتذكيرات المؤرخة ═════════ */
function tdWeek(){
  const k=tdKsaNow(), sun=Date.parse(k.day+'T00:00:00Z')-k.dow*864e5;
  const days=[0,1,2,3,4].map(i=>new Date(sun+i*864e5).toISOString().slice(0,10));
  let ex=[]; try{ ex=JSON.parse(localStorage.getItem('dash_exam_dates_v1')||'[]'); }catch(e){}
  const D=CT_DATA||{};
  try{ const {sem,per}=ctSem(), b=ctBook(JSON.parse(JSON.stringify(D)),sem,per); b.tests.forEach(t=>{ if(t&&t.date) ex.push({d:t.date,title:t.title||'اختبار',cls:[]}); }); }catch(e){}
  const evs=d=>{
    const L=[];
    ex.filter(x=>x.d===d).forEach(x=>L.push(`<button type="button" class="td-ev ex" title="${thEsc((x.cls||[]).join('، '))}">📝 ${thEsc(x.title)}${x.cls&&x.cls.length?` · ${thEsc(x.cls.join('، '))}`:''}</button>`));
    HW.filter(h=>remPublished(h)&&h.due===d).forEach(h=>{ const m=hwPool(h).filter(s=>!(h.subs&&h.subs[s.id])).length;
      L.push(`<button type="button" class="td-ev act" onclick="openReport('${thEsc(h.id)}')" title="يُغلق هذا اليوم">📋 ${thEsc(h.title)}${m?` · ${m} لم يسلّموا`:' · ✓'}</button>`); });
    (D.reminders||[]).filter(r=>r&&!r.paused&&r.repeat==='once'&&r.date===d).forEach(r=>L.push(`<span class="td-ev rm">⏰ ${thEsc(tdRemTitle(r))}</span>`));
    return L.join('');
  };
  const any=days.some(d=>evs(d));
  return `<div class="td-card-h" style="margin:0 0 .4rem"><b>📅 هذا الأسبوع</b>${any?'':'<small>لا مواعيد هذا الأسبوع</small>'}</div>
    <div class="td-week">${days.map((d,i)=>`<div class="td-day ${d===k.day?'today':d<k.day?'past':''}"><h4>${CT_DAYS[i]}<small>${Number(d.slice(8))}/${Number(d.slice(5,7))}</small></h4>${evs(d)}</div>`).join('')}</div>`;
}

/* ═════════ 🔄 صفحة حيّة: كل دقيقة يُعاد الرسم (الوقت يتقدّم)، وكل 5 دقائق جلب جديد ═════════ */
let TD_LAST_PER=null, TD_LAST_PULL=0;
function tdLiveTick(){
  const D=CT_DATA; if(!D) return;
  const k=tdKsaNow(); if(!(k.dow>=0&&k.dow<=4)) return;
  const sc=D.schedule||{}, g=(sc.grid||{})[String(k.dow)]||{}, cur=tdTimes(sc).find(t=>g[String(t.n)]&&k.min>=t.sm&&k.min<t.em);
  const key=cur?k.day+':'+cur.n:'';
  if(TD_LAST_PER!==null&&key&&key!==TD_LAST_PER){
    const msg=`🔔 بدأت الحصة ${cur.n} · ${g[String(cur.n)]}`; toast(msg,'good');
    try{ if('Notification' in window&&Notification.permission==='granted'&&document.hidden) new Notification('مساعد المعلم',{body:msg.replace('🔔 ','')}); }catch(e){}
  }
  TD_LAST_PER=key;
}
setInterval(()=>{
  const on=document.getElementById('p-dashboard')?.classList.contains('on'); if(!on||document.hidden) return;
  if(document.getElementById('veil')?.classList.contains('on')) return;   // لا نرسم فوق نافذة مفتوحة
  try{ thDraw(); }catch(e){}
  if(Date.now()-TD_LAST_PULL>5*60000){ TD_LAST_PULL=Date.now();
    (async()=>{ try{ await renderTodayHub(true); }catch(e){} try{ if(typeof pullAll==='function'){ await pullAll(true); renderDashboard(); } }catch(e){} })(); }
},60000);
