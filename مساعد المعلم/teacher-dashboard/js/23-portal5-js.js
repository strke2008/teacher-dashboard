const BHV_POS=[['🌟 مشاركة فعالة','مشاركة إيجابية وفاعلة في الحصة'],['🙋 إجابة متميزة','إجابة متميزة وفهم واضح للمفهوم'],['📚 إنجاز الواجب','الحرص على إنجاز الواجب والالتزام'],['🏆 إنجاز متميز','إنجاز متميز وجهد واضح'],['🤝 تعاون','تعاون إيجابي مع الزملاء'],['✅ التزام وانضباط','التزام وانضباط داخل الفصل'],['💡 مبادرة','مبادرة إيجابية وحرص على التعلم'],['🌱 تحسن ملحوظ','تحسن ملحوظ في الأداء والسلوك']];
const BHV_NEG=[['⏰ تأخر','التأخر عن الحصة أو بداية العمل'],['📚 عدم إنجاز الواجب','عدم إنجاز الواجب المطلوب'],['⚠️ مخالفة تعليمات','عدم الالتزام بتعليمات الحصة'],['🗣️ حديث جانبي','الحديث الجانبي بما يؤثر في سير الحصة'],['🚫 سلوك غير مناسب','سلوك غير مناسب يحتاج إلى متابعة'],['📱 استخدام غير مصرح','استخدام الجهاز أو الهاتف دون إذن'],['👥 إزعاج الزملاء','إزعاج الزملاء أو التأثير في تعلمهم'],['🔁 تكرار الملاحظة','تكرار السلوك رغم التنبيه']];
/* ═════════ 🌟 السلوك: نفس قوالب البوابة + قوالب المعلم المشتركة (behaviorTemplates) ═════════ */
function bhvTemplates(){ return ((CT_DATA&&CT_DATA.behaviorTemplates)||[]).filter(x=>x&&x.title); }
function bhvToday(sid){ const d=tdKsaNow().day; return ((CT_DATA&&CT_DATA.behavior)||[]).filter(x=>x&&!x.deleted&&x.date===d&&String(x.studentId)===String(sid)).length; }
/* mode: 'tq' (داخل الرصد السريع — يُحفظ مع الرصد) · 'one' (نافذة طالب — يُحفظ فورًا) */
function bhvPickerHTML(sid,mode){
  const T=bhvTemplates(), f=mode==='tq'?'tqBehAdd':'bhvSave', q=s=>esc(String(s)).replace(/'/g,'&#39;');
  const chip=(type,t,n,cls)=>`<button type="button" class="bh-chip ${cls}" title="${q(n)}" onclick="${f}('${esc(sid)}','${type}','${q(t)}','${q(n)}')">${esc(t)}</button>`;
  return `<div class="bh-grp"><b>🌟 إيجابي</b>${BHV_POS.map(([t,n])=>chip('positive',t,n,'p')).join('')}${T.filter(x=>x.type==='positive').map(x=>chip('positive',x.title,x.note||'','p t')).join('')}</div>
    <div class="bh-grp"><b>⚠️ يحتاج متابعة</b>${BHV_NEG.map(([t,n])=>chip('negative',t,n,'n')).join('')}${T.filter(x=>x.type!=='positive').map(x=>chip('negative',x.title,x.note||'','n t')).join('')}</div>
    <div class="bh-custom"><select class="inp" id="bh-type-${esc(sid)}" style="flex:0 0 auto"><option value="positive">🌟 إيجابي</option><option value="negative">⚠️ متابعة</option></select>
      <input class="inp" id="bh-title-${esc(sid)}" placeholder="سلوك مخصص…" maxlength="60">
      <label style="font-size:.76rem;display:flex;align-items:center;gap:.2rem"><input type="checkbox" id="bh-tpl-${esc(sid)}"> احفظه قالبًا</label>
      <button type="button" class="btn sm" onclick="bhvCustom('${esc(sid)}','${mode}')">＋</button>
      ${T.length?`<a href="#" style="font-size:.76rem" onclick="event.preventDefault();bhvTplManage()">⚙️ القوالب (${T.length})</a>`:''}</div>`;
}
function tqBehToggle(sid){ TQ.openBeh=TQ.openBeh===sid?'':sid; TQ._scrollBeh=!!TQ.openBeh; tqRender(); }
function tqBehAdd(sid,type,cat,note){ TQ.beh.push({sid,type,category:cat,note}); TQ.openBeh=''; tqRender(); }
function bhvCustom(sid,mode){
  const g=id=>document.getElementById(id), t=String(g('bh-title-'+sid)?.value||'').trim(), type=g('bh-type-'+sid)?.value||'negative', save=!!g('bh-tpl-'+sid)?.checked;
  if(!t){ toast('اكتب السلوك أولًا','bad'); return; }
  if(mode==='tq'){ if(save) TQ.tpl.push({title:t,note:'',type}); tqBehAdd(sid,type,t,''); }
  else bhvSave(sid,type,t,'',save);
}
function bhvOpen(sid){
  const s=(STUDENTS||[]).find(x=>String(x.id)===String(sid)); if(!s) return;
  if(!CT_DATA){ toast('بيانات الفصل لم تُحمّل بعد','bad'); return; }
  const recent=((CT_DATA.behavior)||[]).filter(x=>x&&!x.deleted&&String(x.studentId)===String(sid)).slice(0,5);
  openModal(`<h2>🌟 ملاحظة سلوكية — ${esc(s.name)}</h2><p class="muted" style="font-size:.8rem;margin:.1rem 0 .5rem">تُسجَّل بتاريخ اليوم فور الضغط، وتظهر في البوابة وملف الطالب وكشف الأسبوع.</p>
    ${bhvPickerHTML(sid,'one')}
    ${recent.length?`<div style="margin-top:.6rem"><b style="font-size:.82rem">آخر الملاحظات</b>${recent.map(x=>`<div class="du-li"><span>${x.type==='positive'?'🌟':'⚠️'} ${esc(x.category||'')}<small>${esc(String(x.date||'').replace(/-/g,'/'))}</small></span></div>`).join('')}</div>`:''}
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`);
}
async function bhvSave(sid,type,cat,note,asTpl){
  const d=tdKsaNow().day, now=Date.now();
  try{ await ctSave(D=>{ D.behavior=Array.isArray(D.behavior)?D.behavior:[]; D.behavior.unshift({id:now.toString(36),studentId:String(sid),type,category:cat,note:note||'',date:d,at:now});
      if(asTpl){ D.behaviorTemplates=[{title:cat,note:'',type},...(Array.isArray(D.behaviorTemplates)?D.behaviorTemplates:[])].slice(0,500); } });
    toast(`${type==='positive'?'🌟':'⚠️'} سُجّلت «${cat}»`,'good'); closeModal(); try{ renderClassTools(); }catch(e){} try{ thDraw(); }catch(e){} }
  catch(e){ toast('تعذّر الحفظ','bad'); }
}
function bhvTplManage(){
  const T=bhvTemplates();
  openModal(`<h2>⚙️ قوالب السلوك</h2><p class="muted" style="font-size:.8rem">قوالبك المشتركة مع بوابة المعلم.</p>
    ${T.map((x,i)=>`<div class="du-li"><span>${x.type==='positive'?'🌟':'⚠️'} ${esc(x.title)}${x.note?`<small>${esc(x.note)}</small>`:''}</span><button class="btn ghost sm" onclick="bhvTplDel(${i})">🗑️</button></div>`).join('')||'<div class="feature-empty">لا قوالب.</div>'}
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`);
}
async function bhvTplDel(i){
  const x=bhvTemplates()[i]; if(!x) return;
  try{ await ctSave(D=>{ D.behaviorTemplates=(D.behaviorTemplates||[]).filter(t=>!(t&&t.title===x.title&&(t.type||'negative')===(x.type||'negative'))); }); toast('حُذف القالب','good'); bhvTplManage(); }
  catch(e){ toast('تعذّر الحذف','bad'); }
}

/* ═════════ ⏰ إدارة التذكيرات — نفس صيغة data.reminders في البوابة ═════════ */
const RMG_DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
let RMG=null;
function rmgWhen(r){ const a=r.at||{}, lead=Number(r.lead)||0, hm=t=>{ const p=String(t||'7:00').split(':'); return schH12((+p[0]||0)*60+(+p[1]||0)); };
  const when=a.t==='class'?`عند حصة ${a.cls}`:a.t==='period'?`عند الحصة ${a.p}`:`الساعة ${hm(a.hm)}`;
  const days=r.repeat==='once'?`مرة واحدة ${r.date}`:(r.days||[]).length===5?'كل يوم دراسي':'كل '+(r.days||[]).map(d=>RMG_DAYS[d]).join(' و');
  return `${days} · ${when}${lead?` · قبلها بـ ${lead} د`:''}`; }
function rmgOpen(){
  const all=((CT_DATA&&CT_DATA.reminders)||[]).slice(), T=tdRemToday();
  openModal(`<h2>⏰ تذكيراتي</h2><p class="muted" style="font-size:.8rem;margin:.1rem 0 .4rem">مشتركة مع بوابة المعلم. ⓘ إشعار الجوال للتذكير الجديد أو المعدّل يُفعَّل عند فتحك البوابة بعده.</p>
    <b style="font-size:.85rem">اليوم</b>${T.map(x=>`<div class="rm-row"><span>${x.done?'✅':'⏰'} ${esc(tdRemTitle(x.r))}<small>${x.hm}</small></span></div>`).join('')||'<div class="muted" style="font-size:.82rem;padding:.3rem">لا تذكيرات اليوم.</div>'}
    <div id="rmg-form"></div>
    <div class="row" style="gap:.4rem;margin:.5rem 0"><button class="btn tick sm" onclick="rmgEdit()">＋ تذكير جديد</button><button class="btn ghost sm" onclick="rmgEditDuty()">📋 تذكير رصد الواجبات</button></div>
    <b style="font-size:.85rem">كل التذكيرات (${all.length})</b>
    ${all.map(r=>`<div class="rm-row ${r.paused?'paused':''}"><span>${esc(tdRemTitle(r))}<small>${esc(rmgWhen(r))}${r.paused?' · موقوف':''}</small></span>
      <button title="تعديل" onclick="rmgEdit('${esc(r.id)}')">✎</button><button title="${r.paused?'تشغيل':'إيقاف'}" onclick="rmgPause('${esc(r.id)}')">${r.paused?'▶':'⏸'}</button><button title="حذف" onclick="rmgDel('${esc(r.id)}')">🗑</button></div>`).join('')||'<div class="muted" style="font-size:.82rem;padding:.3rem">لم تضف تذكيرات بعد.</div>'}
    <div class="modal-foot"><button class="btn ghost" onclick="RMG=null;closeModal()">إغلاق</button></div>`);
  if(RMG) rmgForm();
}
function rmgEdit(id){ const r=id&&((CT_DATA&&CT_DATA.reminders)||[]).find(x=>x.id===id);
  RMG=r?JSON.parse(JSON.stringify(r)):{id:'',kind:'',title:'',repeat:'weekly',days:[0,1,2,3,4],date:tdKsaNow().day,at:{t:'time',hm:'07:00'},lead:0}; rmgForm(); }
function rmgClassDays(cls){ const g=(((CT_DATA||{}).schedule)||{}).grid||{}, out=[]; for(let d=0;d<=4;d++){ if(Object.values(g[String(d)]||{}).some(v=>String(v||'').trim()===cls)) out.push(d); } return out; }
function rmgEditDuty(){ const act=((CT_DATA&&CT_DATA.roles)||[]).filter(x=>x&&x.active&&x.title==='مسؤول رصد الواجبات'), cls=act.length?act[0].cls:(ctClasses()[0]||'');
  if(!act.length) toast('لا يوجد مسؤول رصد واجبات معيّن — عيّنه من «🎖️ مهام الطلاب»');
  const d=rmgClassDays(cls); RMG={id:'',kind:'duty',cls,title:'',repeat:'weekly',days:d.length?d:[0],date:tdKsaNow().day,at:{t:'class',cls},lead:0}; rmgForm(); }
function rmgForm(){
  const f=document.getElementById('rmg-form'), e=RMG; if(!f) return; if(!e){ f.innerHTML=''; return; }
  const cl=ctClasses(), T=tdTimes(((CT_DATA||{}).schedule)||{}), a=e.at||{};
  f.innerHTML=`<div class="rm-form"><b>${e.id?'تعديل التذكير':e.kind==='duty'?'📋 تذكير رصد الواجبات':'تذكير جديد'}</b>
    ${e.kind==='duty'?`<label>الفصل<select class="inp" onchange="RMG.cls=this.value;RMG.at={t:'class',cls:this.value};const d=rmgClassDays(this.value);if(d.length)RMG.days=d;rmgForm()">${cl.map(c=>`<option ${c===e.cls?'selected':''}>${esc(c)}</option>`).join('')}</select></label>`
      :`<label>المهمة<input class="inp" value="${esc(e.title)}" placeholder="مثال: ذكّر الطلاب بإحضار دفتر النشاط" oninput="RMG.title=this.value"></label>`}
    <span class="ct-seg"><button type="button" class="${e.repeat!=='once'?'on':''}" onclick="RMG.repeat='weekly';rmgForm()">كل أسبوع</button><button type="button" class="${e.repeat==='once'?'on':''}" onclick="RMG.repeat='once';rmgForm()">مرة واحدة</button></span>
    ${e.repeat==='once'?`<label>التاريخ<input class="inp" type="date" value="${esc(e.date)}" onchange="RMG.date=this.value"></label>`
      :`<div class="rm-days">${RMG_DAYS.map((n,d)=>`<label><input type="checkbox" ${(e.days||[]).includes(d)?'checked':''} onchange="const s=new Set(RMG.days||[]);this.checked?s.add(${d}):s.delete(${d});RMG.days=[...s].sort()">${n}</label>`).join('')}</div>`}
    ${e.kind==='duty'?'':`<label>الموعد<select class="inp" onchange="RMG.at=this.value==='class'?{t:'class',cls:ctClasses()[0]||''}:this.value==='period'?{t:'period',p:1}:{t:'time',hm:'07:00'};rmgForm()">
      <option value="class" ${a.t==='class'?'selected':''}>عند حصة فصل (من جدولك)</option><option value="period" ${a.t==='period'?'selected':''}>عند حصة برقمها</option><option value="time" ${a.t==='time'?'selected':''}>ساعة محددة</option></select></label>`}
    ${a.t==='class'&&e.kind!=='duty'?`<label>الفصل<select class="inp" onchange="RMG.at.cls=this.value">${cl.map(c=>`<option ${c===a.cls?'selected':''}>${esc(c)}</option>`).join('')}</select></label>`:''}
    ${a.t==='period'?`<label>الحصة<select class="inp" onchange="RMG.at.p=+this.value">${T.map(x=>`<option value="${x.n}" ${x.n===Number(a.p)?'selected':''}>الحصة ${x.n} — ${schH12(x.sm)}</option>`).join('')}</select></label>`:''}
    ${a.t==='time'?`<label>الساعة<input class="inp" type="time" value="${esc(a.hm||'07:00')}" onchange="RMG.at.hm=this.value"></label>`:''}
    <label>التنبيه<select class="inp" onchange="RMG.lead=+this.value">${[0,3,5,10,15].map(v=>`<option value="${v}" ${Number(e.lead)===v?'selected':''}>${v?`قبل الموعد بـ ${v} د`:'في الموعد'}</option>`).join('')}</select></label>
    <div class="row" style="gap:.4rem"><button class="btn tick sm" onclick="rmgSave()">حفظ</button><button class="btn ghost sm" onclick="RMG=null;rmgForm()">إلغاء</button></div></div>`;
}
async function rmgSave(){
  const e=RMG; if(!e) return;
  if(e.kind!=='duty'&&!String(e.title||'').trim()){ toast('اكتب المهمة','bad'); return; }
  if(e.repeat==='once'?!/^\d{4}-\d{2}-\d{2}$/.test(e.date||''):!(e.days||[]).length){ toast(e.repeat==='once'?'اختر التاريخ':'اختر يومًا واحدًا على الأقل','bad'); return; }
  if(e.at.t==='class'&&!e.at.cls){ toast('اختر الفصل','bad'); return; }
  const r={id:e.id||('r'+Date.now().toString(36)),kind:e.kind||'',cls:e.cls||'',title:String(e.title||'').trim().slice(0,120),repeat:e.repeat==='once'?'once':'weekly',
    days:e.repeat==='once'?[]:e.days,date:e.repeat==='once'?e.date:'',at:e.at,lead:Number(e.lead)||0,paused:!!e.paused,done:(e.done||{})};
  try{ await ctSave(D=>{ D.reminders=(Array.isArray(D.reminders)?D.reminders:[]).filter(x=>x&&x.id!==r.id).concat([r]); }); RMG=null; toast('✓ حُفظ التذكير','good'); rmgOpen(); thDraw(); }
  catch(err){ toast('تعذّر الحفظ','bad'); }
}
async function rmgPause(id){ try{ await ctSave(D=>{ const r=(D.reminders||[]).find(x=>x&&x.id===id); if(r) r.paused=!r.paused; }); rmgOpen(); thDraw(); }catch(e){ toast('تعذّر الحفظ','bad'); } }
async function rmgDel(id){ const r=((CT_DATA&&CT_DATA.reminders)||[]).find(x=>x.id===id); if(!r) return;
  if(!(await askConfirm(`حذف «${tdRemTitle(r)}»؟`,{title:'حذف التذكير',yes:'احذف',danger:true}))){ rmgOpen(); return; }
  try{ await ctSave(D=>{ D.reminders=(D.reminders||[]).filter(x=>x&&x.id!==id); }); toast('حُذف التذكير','good'); }catch(e){ toast('تعذّر الحذف','bad'); }
  rmgOpen(); thDraw(); }

/* ═════════ 💬 رسائل أولياء الأمور الجاهزة + «يحتاجون رسالة» (تنبيهات الخادم وmsgFlags) ═════════ */
const PM_POS=[['🌟 مشاركة إيجابية','participation'],['📚 إنجاز الواجب','homework'],['🏆 إنجاز متميز','achievement'],['🌱 تحسن ملحوظ','improvement'],['🤝 تعاون والتزام','cooperation'],['🧪 تميز في المادة','science']];
const PM_NEG=[['🚶 لم يبدأ في البوابة','start'],['⚠️ ملاحظة سلوكية','behavior'],['📚 عدم إنجاز الواجب','homework_neg'],['⏰ تأخر','late'],['📝 يحتاج متابعة دراسية','support'],['🎯 يحتاج تعزيز مهارة','skill']];
function pmFirst(full){ const t=String(full||'').trim().split(/\s+/).filter(Boolean); if(!t.length) return ''; return ['عبد','عبدال','أبو','ابو','أم','ام','بن','ابن'].includes(t[0])&&t[1]?t[0]+' '+t[1]:t[0]; }
function pmText(k,s){ const n=pmFirst(s.name), sub='مادة '+(String(rcGet('subject')||'العلوم').trim());
  const M={participation:`أشكر ابنكم ${n} على مشاركته الفاعلة في ${sub}.`,homework:`أشكر ابنكم ${n} على التزامه بإنجاز واجب ${sub}.`,achievement:`أشكر ابنكم ${n} على أدائه المتميز في ${sub}.`,
    improvement:`ألاحظ تحسنًا واضحًا في مستوى ابنكم ${n} في ${sub}.`,cooperation:`أشكر ابنكم ${n} على تعاونه والتزامه داخل الحصة.`,science:`أشكر ابنكم ${n} على اهتمامه وحرصه في ${sub}.`,
    behavior:`أرجو متابعة ابنكم ${n}، فقد صدرت منه ملاحظة سلوكية في حصة ${sub.replace('مادة ','')}.`,homework_neg:`لم ينجز ابنكم ${n} واجب ${sub}، وأرجو متابعته.`,
    late:`تأخر ابنكم ${n} عن حصة ${sub.replace('مادة ','')}، وأرجو تنبيهه على الالتزام بالوقت.`,support:`يحتاج ابنكم ${n} إلى متابعة إضافية في ${sub}.`,skill:`يحتاج ابنكم ${n} إلى مزيد من التدريب على مهارات ${sub}.`,
    start:`لم يبدأ ابنكم ${n} حل أنشطة ${sub} في بوابة الطالب حتى الآن. أرجو مساعدته في الدخول والبدء باختباري البداية ثم الأنشطة: ${typeof getSite==='function'?getSite():''}`};
  return M[k]||M.behavior; }
let PM={sid:'',dis:''};
function pmsgOpen(sid,suggest,dis){
  const s=(STUDENTS||[]).find(x=>String(x.id)===String(sid)); if(!s) return; PM={sid:String(sid),dis:dis||''};
  const card=([l,k])=>{ const t=pmText(k,s); return `<div class="pm-card ${suggest===k?'sug':''}"><b>${esc(l)}</b>${suggest===k?' <span class="chip tick">مقترحة</span>':''}<p>${esc(t)}</p>
    <div class="row"><button class="btn ghost sm" onclick="pmSend('${k}','copy')">📋 نسخ</button><button class="btn sm" onclick="pmSend('${k}','wa')">💬 واتساب</button></div></div>`; };
  openModal(`<h2>💬 رسالة لولي أمر ${esc(s.name)}</h2><p class="muted" style="font-size:.8rem;margin:.1rem 0 .5rem">النص باسم الطالب الأول. النسخ أو الواتساب يُسجَّل في «سجل التواصل» بملفه${dis?'، ويُزيله من «يحتاجون رسالة»':''}.</p>
    <b style="font-size:.84rem">🌟 رسائل إيجابية</b><div class="pm-grid">${PM_POS.map(card).join('')}</div>
    <b style="font-size:.84rem;display:block;margin-top:.6rem">⚠️ رسائل متابعة</b><div class="pm-grid">${PM_NEG.map(card).join('')}</div>
    <b style="font-size:.84rem;display:block;margin-top:.6rem">✍️ رسالة مخصصة</b><textarea class="inp" id="pm-custom" rows="2" placeholder="استخدم {الطالب} و{الفصل}"></textarea>
    <div class="row" style="gap:.3rem;margin-top:.3rem"><button class="btn ghost sm" onclick="pmSend('custom','copy')">📋 نسخ</button><button class="btn sm" onclick="pmSend('custom','wa')">💬 واتساب</button></div>
    <div class="modal-foot">${dis?`<button class="btn tick" onclick="pmsgDone('${dis}');closeModal()">✓ تم الإرسال</button>`:''}<button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`);
}
async function pmSend(k,how){
  const s=(STUDENTS||[]).find(x=>String(x.id)===PM.sid); if(!s) return;
  let t,label;
  if(k==='custom'){ t=String(document.getElementById('pm-custom')?.value||'').replace(/\{الطالب\}/g,pmFirst(s.name)).replace(/\{الاسم الكامل\}/g,s.name).replace(/\{الفصل\}/g,s.cls||''); label='رسالة مخصصة'; if(!t.trim()){ toast('اكتب الرسالة','bad'); return; } }
  else { t=pmText(k,s); label=([...PM_POS,...PM_NEG].find(x=>x[1]===k)||['رسالة'])[0].replace(/^\S+\s/,''); }
  if(how==='wa'){ const w=window.open('https://wa.me/?text='+encodeURIComponent(t),'_blank','noopener'); if(!w) location.href='https://wa.me/?text='+encodeURIComponent(t); }
  else { try{ await navigator.clipboard.writeText(t); toast('📋 نُسخت الرسالة','good'); }catch(e){ prompt('انسخ الرسالة:',t); } }
  try{ const id=PM.sid, dis=PM.dis; await ctSave(D=>{ D.contacts=Array.isArray(D.contacts)?D.contacts:[];
      D.contacts.push({id:v2Id(),studentId:id,date:ctToday(),channel:how==='wa'?'واتساب':'رسالة نصية',reason:label,result:'',at:Date.now()});
      if(dis){ const m=JSON.parse(decodeURIComponent(dis)); D.msgFlags=D.msgFlags||{}; Object.entries(m).forEach(([kk,v])=>{ D.msgFlags[kk]=Math.max(Number(D.msgFlags[kk])||0,Number(v)||0); }); } });
    if(PM.dis) pmDropAlert(PM.dis); }catch(e){}
}
function pmDropAlert(dis){ try{ const m=JSON.parse(decodeURIComponent(dis)); if(CT_GRADES&&Array.isArray(CT_GRADES.alerts)) CT_GRADES.alerts=CT_GRADES.alerts.filter(a=>!(a.key in m)); }catch(e){} try{ thDraw(); }catch(e){} }
async function pmsgDone(dis){
  try{ const m=JSON.parse(decodeURIComponent(dis)); await ctSave(D=>{ D.msgFlags=D.msgFlags||{}; Object.entries(m).forEach(([k,v])=>{ D.msgFlags[k]=Math.max(Number(D.msgFlags[k])||0,Number(v)||0); }); });
    pmDropAlert(dis); toast('أُزيل من القائمة حتى يتكرر من جديد','good'); }catch(e){ toast('تعذّر الحفظ','bad'); }
}

/* ═════════ 🎖️ مهام الطلاب (data.roles) — إسناد، إنهاء، عدالة التوزيع، سجل ═════════ */
const duN=c=>c===1?'مهمة واحدة':c===2?'مهمتان':c+(c<=10?' مهام':' مهمة');
const DUTY_PRESETS_D=['عريف الفصل','مساعد العريف','مسؤول رصد الواجبات','منظّم الخروج للمعمل','مسؤول أدوات المعمل والسلامة','مسؤول النظافة والترتيب','مسؤول التقنية والعرض','قائد المجموعة','مسؤول توزيع الأوراق'];
async function ctDuties(box,force){
  try{ await ctEnsureGrades(force); }catch(e){}
  const cls=window._duCls??(ctClasses()[0]||''), roster=ctRoster(cls), roles=((CT_DATA&&CT_DATA.roles)||[]).filter(r=>r&&r.cls===cls);
  const nm=id=>((STUDENTS||[]).find(x=>String(x.id)===String(id))||{}).name||'طالب محذوف';
  const act=roles.filter(r=>r.active).sort((a,b)=>DUTY_PRESETS_D.indexOf(a.title)-DUTY_PRESETS_D.indexOf(b.title));
  const fair=roster.map(s=>({s,d:ctG(s.id).duties||{count:roles.filter(r=>String(r.studentId)===String(s.id)).length}})).map(x=>({...x,c:Number(x.d.count)||0})).sort((a,b)=>a.c-b.c||String(a.s.name).localeCompare(String(b.s.name),'ar'));
  const past=roles.filter(r=>!r.active).sort((a,b)=>String(b.to||b.from).localeCompare(String(a.to||a.from))).slice(0,20);
  box.innerHTML=`<div class="row ct-tools">${ctClassSel('du-cls',cls,"window._duCls=this.value;renderClassTools()",false)}<span class="muted" style="font-size:.78rem">مسؤوليات تُسند للطلاب — لا تدخل في الدرجات. مشتركة مع بوابة المعلم.</span></div>
    <div class="ct-card"><b>＋ إسناد مهمة</b><div class="row" style="gap:.4rem;margin-top:.4rem;flex-wrap:wrap">
      <select class="inp" id="du-title" style="width:auto" onchange="document.getElementById('du-custom').style.display=this.value==='__c'?'':'none'">${DUTY_PRESETS_D.map(t=>`<option>${esc(t)}</option>`).join('')}<option value="__c">مهمة أخرى…</option></select>
      <input class="inp" id="du-custom" placeholder="اسم المهمة" style="display:none;width:auto">
      <select class="inp" id="du-sid" style="width:auto;min-width:200px">${fair.map(x=>`<option value="${esc(x.s.id)}">${esc(x.s.name)} — ${x.c?duN(x.c):'لم يُسند إليه'}</option>`).join('')}</select>
      <button class="btn tick sm" onclick="dutyAssign()">إسناد</button></div>
      <div class="muted" style="font-size:.74rem;margin-top:.3rem">قائمة الطلاب مرتبة بالأقل نصيبًا أولًا — ⚖️ عدالة التوزيع. إسناد مهمة قائمة لطالب آخر يُنهيها للسابق تلقائيًا.</div></div>
    <div class="du-grid">
      <div class="ct-card"><b>المهام القائمة (${act.length})</b>${act.map(r=>`<div class="du-li"><span><b>${esc(r.title)}</b><small>${esc(nm(r.studentId))} · منذ ${esc(String(r.from||'').replace(/-/g,'/'))}</small></span><button class="btn ghost sm" onclick="dutyEnd('${esc(r.id)}')">إنهاء</button></div>`).join('')||'<div class="muted" style="font-size:.82rem">لا مهام مسندة في هذا الفصل بعد.</div>'}</div>
      <div class="ct-card"><b>⚖️ عدالة التوزيع</b>${fair.slice(0,12).map(x=>`<div class="du-li"><span>${esc(x.s.name)}</span><span class="chip ${x.c?x.c>=3?'tick':'ghost':'warn'}" style="flex:none">${x.c?duN(x.c):'لم يُسند إليه'}</span></div>`).join('')}${fair.length>12?`<div class="muted" style="font-size:.76rem">و${fair.length-12} آخرون…</div>`:''}</div>
      <div class="ct-card"><b>📜 سجل المهام (${past.length})</b>${past.map(r=>`<div class="du-li"><span>${esc(r.title)}<small>${esc(pmFirst(nm(r.studentId)))} · ${esc(String(r.from||'').replace(/-/g,'/'))} ← ${esc(String(r.to||'').replace(/-/g,'/'))}</small></span></div>`).join('')||'<div class="muted" style="font-size:.82rem">لا سجل بعد.</div>'}</div>
    </div>`;
}
async function dutyAssign(){
  const cls=window._duCls??(ctClasses()[0]||''), tv=document.getElementById('du-title')?.value, title=tv==='__c'?String(document.getElementById('du-custom')?.value||'').trim():tv, sid=document.getElementById('du-sid')?.value;
  if(!title){ toast('اكتب اسم المهمة','bad'); return; } if(!sid){ toast('اختر الطالب','bad'); return; }
  const d=ctToday(); let prev='';
  try{ await ctSave(D=>{ D.roles=Array.isArray(D.roles)?D.roles:[];
      D.roles.forEach(r=>{ if(r&&r.active&&r.cls===cls&&r.title===title){ r.active=false; r.to=d; prev=r.studentId; } });
      D.roles.unshift({id:Date.now().toString(36),cls,title,studentId:sid,from:d,to:'',active:true}); });
    const n=id=>pmFirst(((STUDENTS||[]).find(x=>String(x.id)===String(id))||{}).name);
    toast(prev?`${title}: ${n(sid)} بدلًا من ${n(prev)}`:`أُسندت «${title}» إلى ${n(sid)}`,'good'); CT_GRADES=null; renderClassTools(true); }
  catch(e){ toast('تعذّر الحفظ','bad'); }
}
async function dutyEnd(id){ try{ await ctSave(D=>{ const r=(D.roles||[]).find(x=>x&&x.id===id); if(r){ r.active=false; r.to=ctToday(); } }); toast('أُنهيت المهمة','good'); CT_GRADES=null; renderClassTools(true); }catch(e){ toast('تعذّر الحفظ','bad'); } }
CT_TABS.push(['duties','🎖️ مهام الطلاب']);
CT_VIEWS.duties={tabs:['duties'],title:'🎖️ مهام الطلاب',sub:'إسناد المسؤوليات للطلاب (عريف الفصل، مسؤول رصد الواجبات…) مع عدالة التوزيع وسجل المهام — مشتركة مع بوابة المعلم.'};

/* ═════════ 📆 تواريخ فترات التقييم — في الإعدادات ← السنة الدراسية ═════════ */
function termsRender(){
  const sh=document.getElementById('academic-year-sheet'); if(!sh) return;
  let box=document.getElementById('terms-box'); if(!box){ box=document.createElement('div'); box.id='terms-box'; sh.appendChild(box); }
  const A=(typeof DASH_ACADEMIC!=='undefined'&&DASH_ACADEMIC)||{}, S=A.semesters||{};
  const card=(sem,per)=>{ const s=S[String(sem)]||{}, p=(s.periods||{})[String(per)]||{}, closed=s.status==='closed'||(s.periodStatus||{})[String(per)]==='closed', id=`tr-${sem}-${per}`;
    return `<div class="tr-card"><b>الفصل ${sem===1?'الأول':'الثاني'} · الفترة ${per===1?'الأولى':'الثانية'}${closed?' 🔒':''}</b>
      <div class="row"><label class="muted" style="font-size:.78rem">من <input class="inp" type="date" id="${id}-s" value="${esc(p.start||'')}" ${closed?'disabled':''}></label>
      <label class="muted" style="font-size:.78rem">إلى <input class="inp" type="date" id="${id}-e" value="${esc(p.end||'')}" ${closed?'disabled':''}></label></div>
      <div class="row" style="margin-top:.35rem">${closed?'<span class="muted" style="font-size:.76rem">مغلقة ومحفوظة بلقطة — لا تتغير حدودها</span>':`<button class="btn sm" onclick="termsSave(${sem},${per})">حفظ</button><button class="btn ghost sm" onclick="termsSave(${sem},${per},true)">↩️ تلقائي</button>`}</div></div>`; };
  box.innerHTML=`<h3 style="margin:1rem 0 .2rem;font-size:.95rem">📆 تواريخ فترات التقييم</h3>
    <p class="muted" style="font-size:.8rem;margin:0">كل الدرجات والكشوف والتقارير تُحسب داخل هذه الحدود. «تلقائي» يعيدها للحساب الافتراضي. مشتركة مع بوابة المعلم.</p>
    <div class="tr-grid">${card(1,1)}${card(1,2)}${card(2,1)}${card(2,2)}</div>`;
}
async function termsSave(sem,per,reset){
  const id=`tr-${sem}-${per}`, st=reset?'':(document.getElementById(id+'-s')?.value||''), en=reset?'':(document.getElementById(id+'-e')?.value||'');
  if(st&&en&&st>en){ toast('تاريخ «من» بعد «إلى»','bad'); return; }
  try{ await postDashboardAcademic({action:'set_dates',semester:sem,period:per,start:st,end:en}); toast(reset?'عادت الفترة للتلقائي':`📅 حُفظت الفترة${en?' حتى '+en.replace(/-/g,'/'):''}`,'good'); CT_GRADES=null; }
  catch(e){ const m=String(e.message||''); toast(m==='period_closed'?'هذه الفترة مغلقة ومحفوظة بلقطة — لا تتغير حدودها.':m==='semester_closed'?'الفصل مغلق.':m==='start_after_end'?'تاريخ البداية بعد النهاية':'تعذّر الحفظ','bad'); }
  termsRender();
}
(function(){ const _r=window.renderDashboardAcademicControl; if(typeof _r==='function') window.renderDashboardAcademicControl=function(){ const x=_r.apply(this,arguments); try{ termsRender(); }catch(e){} return x; }; })();
setTimeout(()=>{ try{ termsRender(); }catch(e){} },1500);
