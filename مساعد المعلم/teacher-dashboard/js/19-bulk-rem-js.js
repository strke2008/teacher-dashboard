/* ═════════ 📨 التذكير: مكوّنات مشتركة بين التذكير الفردي والجماعي ═════════ */
function remKsaDay(off){ return new Date(Date.now()+3*3600000+(off||0)*864e5).toISOString().slice(0,10); }
/* أنشطة ينتهي موعدها اليوم أو غدًا ولم يسلّمها بعد — تذكير وقائي قبل التأخر */
function remSoonActivities(s){
  const t0=remKsaDay(0), t1=remKsaDay(1);
  return HW.filter(h=>remPublished(h)&&hwFor(h,s.cls)&&h.due&&(h.due===t0||h.due===t1)&&!(h.subs&&h.subs[s.id]));
}
/* الواجب الورقي «لم ينجز» في آخر 7 أيام من سجل الحصص */
function remPaperMissed(s,D){
  const H=(D&&D.homework)||{}, out=[];
  for(let i=0;i<7;i++){ const d=remKsaDay(-i), r=H[d]&&H[d][String(s.id)], st=r&&(typeof r==='string'?r:r.status); if(st==='لم ينجز') out.push(d); }
  return out.reverse();
}
const REM_WD=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
function remDayName(d){ const x=new Date(d+'T12:00:00Z'); return isNaN(x)?d:`${REM_WD[x.getUTCDay()]} ${x.getUTCDate()}/${x.getUTCMonth()+1}`; }
function remCompose(s,x){
  const site=getSite().replace(/\/+$/,''), lnk=h=>h.sid?`${site}/#${h.sid}`:'';
  const first=String(s.name||'').trim().split(/\s+/)[0]||'', t0=remKsaDay(0);
  const P=[], S=[], n=x.missing.length, k=x.soon.length, p=x.paper.length;
  if(n){
    P.push(`نود تذكيركم بوجود ${n} ${n===1?'نشاط متأخر':'أنشطة متأخرة'} لم يتم تسليمها حتى الآن:\n`+x.missing.map(h=>lnk(h)?`• ${h.title}\n  🔗 ${lnk(h)}`:`• ${h.title}`).join('\n'));
    S.push(`لديك ${n===1?'نشاط لم يُسلَّم':n===2?'نشاطان لم يُسلَّما':n+' أنشطة لم تُسلَّم'} بعد:\n${x.missing.map(h=>`• ${h.title}${h.due?` (موعده ${fmtDate(h.due+'T00:00:00')})`:''}`).join('\n')}\n\nافتح «أنشطتي» وأكملها اليوم — تجدها في قائمة أنشطتك.`);
  }
  if(k){
    P.push(`${k===1?'نشاط ينتهي موعده قريبًا':'أنشطة ينتهي موعدها قريبًا'} ولم يُسلَّم بعد:\n`+x.soon.map(h=>`• ${h.title} (${h.due===t0?'ينتهي اليوم':'ينتهي غدًا'})${lnk(h)?`\n  🔗 ${lnk(h)}`:''}`).join('\n'));
    S.push(`⏳ ${k===1?'نشاط ينتهي قريبًا — سلّمه قبل إغلاقه':'أنشطة تنتهي قريبًا — سلّمها قبل إغلاقها'}:\n${x.soon.map(h=>`• ${h.title} (${h.due===t0?'ينتهي اليوم':'ينتهي غدًا'})`).join('\n')}`);
  }
  if(p){
    const days=x.paper.map(remDayName).join(' · ');
    P.push(`📕 لم يُنجز الطالب الواجب ${p===1?'يوم':'أيام'}: ${days}.`);
    S.push(`📕 لم تُنجز واجبك ${p===1?'يوم':'أيام'}: ${days} — أكمله وأحضره في الحصة القادمة.`);
  }
  if(x.mad.length){
    P.push(`واجبات منصة مدرستي مفتوحة ولم تُحل بعد (${x.mad.length}):\n${madUnsolvedLines(x.mad)}`);
    S.push(`📱 ${x.mad.length===1?'واجب في منصة مدرستي مفتوح':'واجبات في منصة مدرستي مفتوحة'} ولم تحلها بعد:\n${madUnsolvedLines(x.mad)}\n\nادخل مدرستي وحلّها قبل الإغلاق.`);
  }
  return { parent:`السلام عليكم، ولي أمر الطالب ${s.name}،\nالفصل: ${s.cls||'غير محدد'}\n\n${P.join('\n\n')}\n\nنأمل متابعة الطالب وإكمالها.\nوشكرًا لتعاونكم.`,
           student:`مرحبًا ${first} 👋\n${S.join('\n\n')}\n\nبالتوفيق 🌟` };
}

/* ═════════ 📨 التذكير الجماعي: رسالة شخصية لكل طالب إلى بوابته ═════════ */
const BR={cls:'',act:'',soon:true,paper:true,mad:true,sel:null,only:null,rows:[],D:null,madBy:null,busy:false};
/* 🚶 لم يسلّم أي نشاط قط ⇒ الأرجح أنه لا يفتح البوابة: التذكير لبوابته لا يصله، فالأنفع ولي الأمر */
function brNoPortal(s){ return !(HW||[]).some(h=>h&&h.subs&&h.subs[s.id]); }
/* 📈 أثر التذكير: من ذكّرتهم في آخر 7 أيام — من سلّم بعد التذكير، ومن ما زال عليه شيء */
function brEffect(){
  const since=Date.now()-7*864e5, out={n:0,done:0,pending:[],last:0};
  (STUDENTS||[]).forEach(s=>{ const r=remLast(s,'student'); if(!r||r.at<since) return; out.n++; out.last=Math.max(out.last,r.at);
    const after=(HW||[]).some(h=>{ const v=h&&h.subs&&h.subs[s.id]; return v&&Number(v.at)>r.at; });
    if(after) out.done++; else if(getStudentMissingActivities(s).length||remSoonActivities(s).length) out.pending.push(String(s.id)); });
  return out;
}
function brEffectLine(){ const e=brEffect(); if(!e.n) return '';
  return `<div class="br-eff">📈 <b>أثر التذكير:</b> ذكّرت ${e.n===1?'طالبًا واحدًا':e.n===2?'طالبين':e.n+(e.n<=10?' طلاب':' طالبًا')} خلال الأسبوع — سلّم منهم بعد التذكير <b style="color:#13734f">${e.done} ✓</b>${e.pending.length?` · لم يستجب ${e.pending.length} <button class="btn ghost sm" onclick="brRemindPending()">📨 ذكّر من لم يستجب</button>`:' · 👏 استجاب الجميع'}</div>`; }
function brRemindPending(){ const e=brEffect(); BR.cls=''; BR.act=''; BR.only=new Set(e.pending); BR.sel=null; if(document.getElementById('modal')&&/تذكير جماعي/.test(document.getElementById('modal').textContent||'')) brRender(); else openBulkReminder(true); }
async function openBulkReminder(keepOnly){
  openModal('<h2>📨 تذكير جماعي</h2><div class="muted" style="padding:1rem">⏳ جارٍ تجهيز القائمة…</div>');
  BR.sel=null; if(!keepOnly) BR.only=null;
  try{ BR.D=await loadComprehensiveClassroom(false); }catch(e){ BR.D=null; }
  BR.madBy=null;
  try{ const dates=[...Array(14)].map((_,i)=>remKsaDay(-i));
    const j=await Promise.race([madApi('/madrasati/week',{dates}),new Promise((_,no)=>setTimeout(()=>no(new Error('timeout')),6000))]);
    BR.madBy=(j&&j.bySid)||{}; }catch(e){ BR.madBy=null; }
  brRender();
}
function brMad(sid){
  const md=BR.madBy&&BR.madBy[String(sid)]; if(!md) return [];
  return madOpenOnly((md.o||[]).map(o=>({title:o.t,st:'pending',dueAt:o.d})));
}
function brBuild(){
  const roster=(STUDENTS||[]).filter(s=>(!BR.cls||String(s.cls||'')===BR.cls)&&(!BR.only||BR.only.has(String(s.id))));
  BR.rows=roster.map(s=>{
    const missing=getStudentMissingActivities(s), soonAll=remSoonActivities(s);
    // نشاط محدد: متأخر أو ينتهي اليوم/غدًا — من لم يسلّمه فقط
    if(BR.act&&!missing.some(h=>String(h.id)===BR.act)&&!soonAll.some(h=>String(h.id)===BR.act)) return null;
    const actSoon=BR.act&&soonAll.some(h=>String(h.id)===BR.act);
    const x={missing, soon:(BR.soon||actSoon)?soonAll:[], paper:BR.paper?remPaperMissed(s,BR.D):[], mad:BR.mad?brMad(s.id):[]};
    if(!x.missing.length&&!x.soon.length&&!x.paper.length&&!x.mad.length) return null;
    const last=remLast(s,'student'), recent=!!(last&&Date.now()-last.at<REM_GUARD_MS);
    const cm=remCompose(s,x); return {s,x,last,recent,np:brNoPortal(s),msg:cm.student,pmsg:cm.parent};
  }).filter(Boolean).sort((a,b)=>(b.x.missing.length-a.x.missing.length)||String(a.s.name).localeCompare(String(b.s.name),'ar'));
  // التحديد الافتراضي: لا من ذكّرته قبل يومين، ولا من لا يفتح البوابة (رسالته لولي أمره) — إلا في «ذكّر من لم يستجب»
  if(!BR.sel) BR.sel=new Set(BR.rows.filter(r=>BR.only?!r.np:(!r.recent&&!r.np)).map(r=>String(r.s.id)));
  else { const ids=new Set(BR.rows.map(r=>String(r.s.id))); [...BR.sel].forEach(i=>{ if(!ids.has(i)) BR.sel.delete(i); }); }
}
function brRender(){
  brBuild();
  const classes=[...new Set((STUDENTS||[]).map(s=>String(s.cls||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  const t1=remKsaDay(1), overdueActs=HW.filter(h=>remPublished(h)&&h.due&&(new Date(h.due+'T23:59:59')<new Date()||h.due<=t1)&&(!BR.cls||hwFor(h,BR.cls)));
  const sel=BR.rows.filter(r=>BR.sel.has(String(r.s.id))).length;
  const chip=(c,t)=>`<span class="br-chip ${c}">${t}</span>`;
  openModal(`<h2>📨 تذكير جماعي</h2>
    <p class="muted" style="font-size:.82rem;margin:.1rem 0 .4rem">رسالة شخصية لكل طالب بما عليه هو فقط، تصل إلى «أنشطتي» في بوابته وتنبيهًا على جواله. من ذكّرته خلال يومين غير محدد تلقائيًا.</p>
    ${BR.only?`<div class="br-eff">🎯 تعرض فقط من ذكّرتهم ولم يستجيبوا (${BR.rows.length}) <button class="btn ghost sm" onclick="BR.only=null;BR.sel=null;brRender()">عرض الكل</button></div>`:brEffectLine()}
    ${(()=>{ const np=BR.rows.filter(r=>r.np).length; return np?`<div class="br-np">🚶 ${np===1?'<b>طالب</b> لم يسلّم':np===2?'<b>طالبان</b> لم يسلّما':`<b>${np}</b> ${np<=10?'طلاب':'طالبًا'} لم يسلّموا`} أي نشاط قط — الأرجح أنهم لا يفتحون البوابة، فلم يُحدَّدوا. أرسل لأولياء أمورهم بزر «💬 ولي الأمر» بجانب كل اسم.</div>`:''; })()}
    <div class="br-tools">
      <select class="inp" style="width:auto" onchange="BR.cls=this.value;BR.act='';BR.sel=null;brRender()"><option value="">كل الفصول</option>${classes.map(c=>`<option ${c===BR.cls?'selected':''}>${esc(c)}</option>`).join('')}</select>
      <select class="inp" style="width:auto;max-width:240px" onchange="BR.act=this.value;BR.sel=null;brRender()"><option value="">كل الأنشطة المتأخرة والقريبة</option>${overdueActs.map(h=>`<option value="${esc(h.id)}" ${String(h.id)===BR.act?'selected':''}>${esc(h.title)}</option>`).join('')}</select>
      <label><input type="checkbox" ${BR.soon?'checked':''} onchange="BR.soon=this.checked;BR.sel=null;brRender()"> ⏳ ما ينتهي اليوم وغدًا</label>
      <label><input type="checkbox" ${BR.paper?'checked':''} onchange="BR.paper=this.checked;BR.sel=null;brRender()"> 📕 الواجب الورقي (آخر أسبوع)</label>
      <label title="${BR.madBy?'':'تعذّر جلب واجبات مدرستي الآن'}"><input type="checkbox" ${BR.mad&&BR.madBy?'checked':''} ${BR.madBy?'':'disabled'} onchange="BR.mad=this.checked;BR.sel=null;brRender()"> 📱 واجبات مدرستي المفتوحة</label>
    </div>
    ${BR.rows.length?`<div class="br-list">${BR.rows.map(r=>{ const id=String(r.s.id), on=BR.sel.has(id);
      return `<div class="br-row ${on?'':'off'}"><input type="checkbox" ${on?'checked':''} onchange="brToggle('${esc(id)}',this.checked)">
        <div class="br-main"><b>${esc(r.s.name)}</b><small>${esc(r.s.cls||'')}</small>
          <div class="br-chips">${r.x.missing.length?chip('late',`⏰ ${r.x.missing.length} متأخر`):''}${r.x.soon.length?chip('soon',`⏳ ${r.x.soon.length} قريب`):''}${r.x.paper.length?chip('paper',`📕 ورقي ${r.x.paper.length}`):''}${r.x.mad.length?chip('mad',`📱 مدرستي ${r.x.mad.length}`):''}
          ${r.np?chip('np','🚶 لا يفتح البوابة'):''}${r.last?`<span class="br-last">آخر تذكير ${remAgo(r.last.at)}</span>`:''}${(()=>{ const pl=remLast(r.s,'parent'); return pl?`<span class="br-last">· ولي الأمر ${remAgo(pl.at)}</span>`:''; })()}</div>
          <details><summary class="muted" style="font-size:.74rem;cursor:pointer">عرض الرسالة</summary><div class="br-msg">${esc(r.msg)}</div></details></div>
        <div class="br-par"><button class="btn ghost sm" title="رسالة جاهزة لولي الأمر عبر واتساب" onclick="brParent('${esc(id)}','wa')">💬 ولي الأمر</button><button class="btn ghost sm" title="نسخ رسالة ولي الأمر" onclick="brParent('${esc(id)}','copy')">📋</button></div></div>`; }).join('')}</div>`
      :'<div class="feature-empty">لا يوجد طالب يحتاج تذكيرًا بهذه الشروط 🌿</div>'}
    <div class="br-foot"><button class="btn ghost sm" onclick="brAll(true)">تحديد الكل</button><button class="btn ghost sm" onclick="brAll(false)">إلغاء التحديد</button>
      <span class="spacer"></span><span class="br-status" id="br-status"></span>
      <button class="btn tick" id="br-send" onclick="brSend()" ${sel?'':'disabled'}>📨 إرسال إلى بوابات ${sel} ${sel===1?'طالب':'طلاب'}</button></div>
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`);
}
function brToggle(id,on){ if(on) BR.sel.add(id); else BR.sel.delete(id); brRender(); }
function brAll(on){ BR.sel=new Set(on?BR.rows.map(r=>String(r.s.id)):[]); brRender(); }
async function brSend(){
  if(BR.busy) return;
  const list=BR.rows.filter(r=>BR.sel.has(String(r.s.id))); if(!list.length) return;
  const api=getApi(), tok=getTok(); if(!api||!tok){ toast('اضبط عنوان الخادم وكلمة السر أولًا','bad'); return; }
  if(!(await askConfirm(`سيصل تذكير شخصي إلى بوابة ${list.length} ${list.length===1?'طالب':'طلاب'}، كلٌّ بما عليه فقط.`,{title:'تأكيد التذكير الجماعي',yes:'أرسل'}))) return;
  BR.busy=true; const st=document.getElementById('br-status'), btn=document.getElementById('br-send'); if(btn) btn.disabled=true;
  let ok=0; const fails=[];
  // ⚡ عدة طلاب في وقت واحد (6) بدل واحد تلو الآخر
  const one=async r=>{
    try{
      const res=await fetch(api.replace(/\/+$/,'')+'/messages',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({t:tok,audience:'students',title:'تذكير: أنشطة لم تُسلَّم',body:r.msg,type:'activity',priority:'important',recipients:[{id:String(r.s.id),name:String(r.s.name||'')}]})});
      const j=await res.json().catch(()=>({}));
      if(res.ok&&j.ok){ ok++; remLogAdd(r.s.id,'student','bulk'); markFollowupHandled(r.s.id); BR.sel.delete(String(r.s.id)); }
      else fails.push(r.s.name);
    }catch(e){ fails.push(r.s.name); }
    if(st) st.textContent=`جارٍ الإرسال… ${ok+fails.length}/${list.length}`;
  };
  const q=list.slice(); await Promise.all(Array.from({length:Math.min(6,q.length)},async()=>{ while(q.length) await one(q.shift()); }));
  BR.busy=false; BR.only=null;
  try{ renderDashboard(); thDraw(); }catch(e){}
  brRender();
  const st2=document.getElementById('br-status');
  if(st2){ st2.textContent=`✓ أُرسل ${ok}`+(fails.length?` · تعذّر ${fails.length}: ${fails.slice(0,5).join('، ')}`:''); st2.style.color=fails.length?'#a3283c':'#13734f'; }
  toast(`أُرسل التذكير إلى ${ok} ${ok===1?'طالب':'طلاب'}`+(fails.length?` · تعذّر ${fails.length}`:''),fails.length?'bad':'good');
}
