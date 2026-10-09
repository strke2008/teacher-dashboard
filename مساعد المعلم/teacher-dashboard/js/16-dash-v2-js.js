/* ═════════ أدوات مشتركة ═════════ */
function v2Avg(a){ const v=a.filter(x=>Number.isFinite(x)); return v.length?Math.round(v.reduce((s,x)=>s+x,0)/v.length*10)/10:null; }
function v2Pct(n,d){ return d?Math.round(n/d*100):null; }
function v2Date(ts){ try{ return new Date(ts).toLocaleDateString('ar-SA-u-ca-gregory',{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return ''; } }
function v2Id(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
/* إحصاء فصل من حساب الخادم */
function cfStats(cls,gget){
  const roster=ctRoster(cls), G=roster.map(s=>({s,g:(gget||ctG)(s.id)}));
  const lv=G.map(x=>x.g.level||{}).filter(l=>l.measured);
  const cor=lv.reduce((a,l)=>a+(l.correct||0),0), tot=lv.reduce((a,l)=>a+(l.total||0),0);
  const m=k=>G.filter(x=>x.g[k]&&x.g[k].measured);
  const acts=HW.filter(h=>hwFor(h,cls)&&(typeof activityReady!=='function'||activityReady(h)));
  let exp=0,done=0; acts.forEach(h=>roster.forEach(s=>{ exp++; if(h.subs&&h.subs[s.id]) done++; }));
  return { cls, n:roster.length, G,
    mastery:tot?Math.round(cor/tot*100):null, measured:lv.length,
    dist:{t:lv.filter(l=>l.status==='متقن').length,w:lv.filter(l=>l.status==='قريب من الإتقان').length,b:lv.filter(l=>l.status==='يحتاج دعم').length,u:roster.length-lv.length},
    part:v2Avg(m('participation').map(x=>x.g.participation.score)), hw:v2Avg(m('homework').map(x=>x.g.homework.score)),
    beh:v2Avg(G.map(x=>x.g.behavior&&x.g.behavior.measured?x.g.behavior.score:10)), att:v2Avg(m('attendance').map(x=>x.g.attendance.rate)),
    exam:v2Avg(G.map(x=>x.g.exam&&x.g.exam.measured?x.g.exam.score:NaN)), acts:acts.length, sub:v2Pct(done,exp) };
}
function cfSkills(cls){
  const all={}; ctRoster(cls).forEach(s=>Object.entries(ctG(s.id).skills||{}).forEach(([k,v])=>{ const a=all[k]||(all[k]={c:0,t:0,weak:[]}); a.c+=v.c; a.t+=v.t; if(v.t>=2&&v.rate<60) a.weak.push(String(s.id)); }));
  return Object.entries(all).filter(([,a])=>a.t>=3).map(([k,a])=>({k,rate:Math.round(a.c/a.t*100),weak:a.weak})).sort((a,b)=>a.rate-b.rate);
}

/* ═════════ 🏫 ملف الفصل ═════════ */
function ctClassFileBody(cls,print){
  const st=cfStats(cls), kpi=(t,v,sub,tone='')=>`<div class="ct-kpi ${tone}"><b>${v??'—'}</b><span>${t}</span>${sub?`<small>${sub}</small>`:''}</div>`;
  const sk=cfSkills(cls), weak=sk.slice(0,3), strong=sk.slice(-3).reverse().filter(x=>x.rate>=70);
  const support=st.G.filter(x=>(x.g.level&&x.g.level.status==='يحتاج دعم')||(x.g.trend&&x.g.trend.measurable&&x.g.trend.change<=-10));
  let cands=[]; try{ cands=ctCertCandidates(cls); }catch(e){}
  let al=[]; try{ al=ctAlerts(cls); }catch(e){}
  const plans=((CT_GRADES&&CT_GRADES.plans)||[]).filter(p=>(p.members||[]).some(mm=>st.G.some(x=>String(x.s.id)===String(mm.studentId))));
  const act=plans.filter(p=>p.status!=='done'), imp=plans.filter(p=>p.verdict==='تحسّن').length;
  const all=ctClasses().map(c=>cfStats(c)).filter(x=>x.n);
  const cols=[['mastery','الإتقان','%'],['sub','التسليم','%'],['att','الحضور','%'],['part','المشاركة','/10'],['hw','الواجبات','/10'],['beh','السلوك','/10'],['exam','الاختبارات','/20']];
  const best=k=>{ const v=all.map(x=>x[k]).filter(Number.isFinite); return v.length>1?[Math.max(...v),Math.min(...v)]:[null,null]; };
  const d=st.dist, tot=Math.max(1,st.n), btn=h=>print?'':h;
  const name=s=>print?esc(s.name):ctNameLink(s);
  return `
    ${typeof ctCmpClassHTML==='function'?ctCmpClassHTML(cls):''}
    <div class="ct-kpis ct-kpis6">
      ${kpi('الطلاب',st.n,`قيس منهم ${st.measured}`)}
      ${kpi('الإتقان',st.mastery!=null?st.mastery+'%':null,'من إجابات الأنشطة',st.mastery==null?'':st.mastery>=85?'tick':st.mastery>=70?'warn':'bad')}
      ${kpi('التسليم',st.sub!=null?st.sub+'%':null,`${st.acts} نشاط`)}
      ${kpi('الحضور',st.att!=null?st.att+'%':null,'',st.att!=null&&st.att<90?'warn':'')}
      ${kpi('المشاركة',st.part!=null?st.part+'/10':null)}
      ${kpi('الواجبات',st.hw!=null?st.hw+'/10':null)}
    </div>
    <div class="ct-card" style="margin-top:.6rem"><b>📊 توزيع المستويات</b>
      <div class="cf-dist"><i class="t" style="flex:${d.t}"></i><i class="w" style="flex:${d.w}"></i><i class="b" style="flex:${d.b}"></i><i class="u" style="flex:${d.u}"></i></div>
      <div class="cf-legend"><span>🟢 متقن ${d.t} (${Math.round(d.t/tot*100)}%)</span><span>🟡 قريب ${d.w}</span><span>🔴 يحتاج دعم ${d.b}</span><span>⚪ لم يُقَس ${d.u}</span>
        <span>· السلوك ${st.beh??'—'}/10 · الاختبارات ${st.exam??'—'}/20</span></div></div>
    <div class="cf-grid">
      <div class="ct-card"><b>🔻 أضعف المهارات</b>${weak.length?weak.map(x=>`<div class="ct-bar"><span>${esc(x.k)}</span><i><u style="width:${x.rate}%;${ctHeat(x.rate)}"></u></i><b>${x.rate}%</b></div>
          ${btn(x.weak.length>=2?`<div style="margin:-.1rem 0 .4rem"><button class="btn ghost sm" onclick='ctGroupPlan(${JSON.stringify(x.k)},${JSON.stringify(x.weak)})'>🩺 خطة جماعية لـ ${x.weak.length} طلاب</button></div>`:'')}`).join(''):'<div class="muted" style="font-size:.82rem">لا أسئلة مصنّفة بالمهارات بعد.</div>'}
        ${weak.length&&weak[0].rate<60&&weak[0].weak.length>=st.n*0.6?'<div class="ct-warn" style="margin-top:.4rem;font-size:.8rem">معظم الفصل ضعيف في «'+esc(weak[0].k)+'» — الأنسب إعادة شرحها للفصل كله.</div>':''}</div>
      <div class="ct-card"><b>🔺 نقاط القوة</b>${strong.length?strong.map(x=>`<div class="ct-bar"><span>${esc(x.k)}</span><i><u style="width:${x.rate}%;${ctHeat(x.rate)}"></u></i><b>${x.rate}%</b></div>`).join(''):'<div class="muted" style="font-size:.82rem">—</div>'}</div>
      <div class="ct-card"><b>🆘 يحتاجون دعمًا (${support.length})</b>${support.slice(0,12).map(x=>`<div class="ct-li"><span>${name(x.s)}</span><span class="chip ${x.g.level&&x.g.level.status==='يحتاج دعم'?'bad':'warn'}">${x.g.level&&x.g.level.status==='يحتاج دعم'?esc(x.g.level.rate+'%'):'يتراجع '+esc(x.g.trend.change)}</span></div>`).join('')||'<div class="muted" style="font-size:.82rem">لا أحد 🌿</div>'}</div>
      <div class="ct-card"><b>🌟 المتميزون (${cands.length})</b>${cands.slice(0,12).map(x=>`<div class="ct-li"><span>${name(x.s)} <small class="muted">${esc(x.why.map(w=>w[0]).join('، '))}</small></span>${x.had?'<span class="chip ghost">🏅 لديه شهادة</span>':btn(`<button class="btn ghost sm" onclick="ctCertQuick('${esc(x.s.id)}',CT_CERT_REASON['${esc(x.why[0][0])}']||'تميّزه')">🏅 شهادة</button>`)}</div>`).join('')||'<div class="muted" style="font-size:.82rem">لا مرشحين بعد.</div>'}</div>
      <div class="ct-card"><b>🩺 الخطط العلاجية</b><div class="ct-li"><span>جارية</span><b>${act.length}</b></div><div class="ct-li"><span>منتهية</span><b>${plans.length-act.length}</b></div><div class="ct-li"><span>حكمها «تحسّن»</span><b>${imp}</b></div></div>
      <div class="ct-card"><b>🔔 تنبيهات الانضباط (${al.length})</b>${al.slice(0,8).map(a=>`<div class="ct-al ${a.lvl}">${name(a.s)} — ${esc(a.t)}</div>`).join('')||'<div class="muted" style="font-size:.82rem">لا تنبيهات.</div>'}</div>
    </div>
    ${all.length>1?`<div class="ct-card" style="margin-top:.7rem"><b>⚖️ مقارنة بالفصول الأخرى</b><div class="ct-table"><table class="cf-cmp"><thead><tr><th>الفصل</th><th>الطلاب</th>${cols.map(c=>`<th>${c[1]}</th>`).join('')}</tr></thead><tbody>
      ${all.map(x=>`<tr><td class="${x.cls===cls?'me':''}"><b>${esc(x.cls)}</b></td><td class="${x.cls===cls?'me':''}">${x.n}</td>${cols.map(([k,,u])=>{ const [hi,lo]=best(k), v=x[k]; return `<td class="${x.cls===cls?'me ':''}${v!=null&&v===hi?'best':v!=null&&v===lo?'worst':''}">${v!=null?v+(u==='%'?'%':''):'—'}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div><div class="muted" style="font-size:.74rem;margin-top:.3rem">الأخضر أعلى فصل والأحمر أدناه في كل عنصر.</div></div>`:''}`;
}
async function ctClassFile(box,force){
  try{ await ctEnsureGrades(force); }catch(e){}
  try{ await ctEnsurePrev(force); }catch(e){}
  const cls=window._ctCfCls??(ctClasses()[0]||'');
  box.innerHTML=`<div class="row ct-tools no-print">${ctClassSel('ct-cf-cls',cls,"window._ctCfCls=this.value;renderClassTools()",false)}
      <span class="muted" style="font-size:.78rem">${(()=>{const {sem,per}=ctSem();return `الفصل ${sem===1?'الأول':'الثاني'} · الفترة ${per===1?'الأولى':'الثانية'}`})()}</span><span class="spacer"></span>
      <button class="btn sm" onclick="ctClassFilePrint()">🖨️ طباعة ملف الفصل</button></div>${cls?ctClassFileBody(cls):'<div class="muted">لا فصول.</div>'}`;
}
function ctClassFilePrint(){
  const cls=window._ctCfCls??(ctClasses()[0]||''); if(!cls) return; ensureLogo();
  let box=document.getElementById('plan-print'); if(!box){ box=document.createElement('div'); box.id='plan-print'; box.className='rep'; document.body.appendChild(box); }
  box.innerHTML=`<div class="rep-page plan-doc ct-pf-print cf-print">${repHead('ملف الفصل '+cls,'تقرير')}<div class="rep-in">${ctClassFileBody(cls,true)}
    <div class="plan-note">البيانات محسوبة من سجلات المعلم الفعلية وإجابات الطلاب في الأنشطة خلال الفترة الحالية.</div>
    <div class="plan-sign"><div>معلم المادة<b>${esc(rcGet('teacher')||'')}</b><span>التوقيع: ....................</span></div>
      <div>مدير المدرسة<b>${esc(rcGet('principal')||'')||'&nbsp;'}</b><span>التوقيع: ....................</span></div></div></div></div>`;
  unifiedA4Print({bodyClass:'printing-plans',title:'ملف الفصل',selector:'#plan-print',orientation:'portrait',margin:'8mm'});
}

/* ═════════ 🕓 الخط الزمني للطالب ═════════ */
const TL_CATS=[['all','الكل'],['acad','📚 الأكاديمي'],['att','🗓️ الحضور والواجب'],['beh','🌟 السلوك والتحفيز'],['com','📞 التواصل والملاحظات']];
function sfTimelineEvents(sid){
  const D=CT_DATA||{}, ev=[], S=String(sid), dts=d=>Date.parse(d+'T09:00:00')||0;
  HW.forEach(h=>{ const v=h.subs&&h.subs[S]; if(v&&v.at){ let g=''; try{ g=activityGradeLabel(h,v); }catch(e){} ev.push({at:+v.at,c:'acad',k:'info',ic:'📝',t:`سلّم «${h.title}»`,s:g}); } });
  const P={'غائب':['bad','🚫','غائب'],'غائب بعذر':['warn','📄','غائب بعذر'],'لم يشارك':['warn','🤐','لم يشارك']};
  Object.keys(D.participation||{}).forEach(d=>{ const st=ctStatus(D,'participation',d,S); if(P[st]) ev.push({at:dts(d),c:'att',k:P[st][0],ic:P[st][1],t:P[st][2]}); });
  Object.keys(D.homework||{}).forEach(d=>{ if(ctStatus(D,'homework',d,S)==='لم ينجز') ev.push({at:dts(d),c:'att',k:'warn',ic:'📕',t:'لم ينجز الواجب'}); });
  (D.behavior||[]).filter(x=>x&&!x.deleted&&String(x.studentId)===S).forEach(x=>ev.push({at:x.date?dts(x.date):+x.at,c:'beh',k:x.type==='positive'?'good':'bad',ic:x.type==='positive'?'🌟':'⚠️',t:[x.category,x.note].filter(Boolean).join(' — ')||'ملاحظة سلوكية'}));
  (D.certificates||[]).filter(x=>x&&!x.deleted&&String(x.studentId)===S).forEach(x=>ev.push({at:x.date?dts(x.date):+x.at,c:'beh',k:'good',ic:'🏅',t:'شهادة شكر وتقدير',s:x.reason}));
  ((CT_GRADES&&CT_GRADES.plans)||[]).filter(p=>(p.members||[]).some(m=>String(m.studentId)===S)).forEach(p=>{
    if(p.startDate) ev.push({at:dts(p.startDate),c:'acad',k:'info',ic:'🩺',t:'بدأت خطة علاجية',s:String(p.reason||'').split(' — ')[0]});
    if(p.status==='done'&&p.endDate) ev.push({at:dts(p.endDate),c:'acad',k:p.verdict==='تحسّن'?'good':'warn',ic:'🏁',t:`أُغلقت الخطة: ${p.outcome||p.verdict||''}`}); });
  try{ const {sem,per}=ctSem(), b=ctBook(JSON.parse(JSON.stringify(D)),sem,per), by=b.scores[S]||{};
    b.tests.forEach(t=>{ const v=by[String(t.id)], n=v&&typeof v==='object'?Number(v.score):Number(v); if(Number.isFinite(n)) ev.push({at:(v&&v.at)||(t.date?dts(t.date):0),c:'acad',k:n>=(Number(t.max)||10)/2?'good':'bad',ic:'🧪',t:`${t.title||'اختبار'}: ${n}/${Number(t.max)||10}`}); }); }catch(e){}
  (D.contacts||[]).filter(x=>x&&!x.deleted&&String(x.studentId)===S).forEach(x=>ev.push({at:x.date?dts(x.date):+x.at,c:'com',k:'info',ic:'📞',t:`تواصل مع ولي الأمر (${x.channel||''}) — ${x.reason||''}`,s:x.result}));
  (D.notes||[]).filter(x=>x&&!x.deleted&&String(x.studentId)===S).forEach(x=>ev.push({at:+x.at,c:'com',k:'info',ic:'🗒️',t:x.text}));
  const out=[]; ev.filter(e=>e.at).sort((a,b)=>b.at-a.at).forEach(e=>{
    // الأيام المتتالية بالحدث نفسه (غائب، لم ينجز…) تُدمج في سطر واحد
    const p=out[out.length-1];
    if(p&&p.c==='att'&&e.c==='att'&&p.t===e.t&&(p.last-e.at)<=4*864e5){ p.n++; p.last=e.at; return; }
    out.push({...e,n:1,last:e.at});
  });
  out.forEach(e=>{ if(e.n>1){ e.s=`${e.n} أيام: من ${v2Date(e.last)} إلى ${v2Date(e.at)}`; e.t=e.t+` (${e.n} أيام)`; } });
  return out;
}
function sfTimeline(el,sid){
  const f=window._tlCat||'all', ev=sfTimelineEvents(sid).filter(e=>f==='all'||e.c===f);
  let last='', html='';
  ev.slice(0,150).forEach(e=>{ const m=new Date(e.at).toLocaleDateString('ar-SA-u-ca-gregory',{month:'long',year:'numeric'});
    if(m!==last){ html+=`<div class="tl-month">${esc(m)}</div>`; last=m; }
    html+=`<div class="tl-ev ${e.k}"><span class="ic">${e.ic}</span><span class="tx">${esc(e.t)}${e.s?`<small>${esc(e.s)}</small>`:''}</span><span class="dt">${esc(v2Date(e.at))}</span></div>`; });
  el.innerHTML=`<div class="tl-filters no-print">${TL_CATS.map(([k,l])=>`<button type="button" class="${k===f?'on':''}" onclick="window._tlCat='${k}';renderClassTools()">${l}</button>`).join('')}</div>
    ${html||'<div class="muted">لا أحداث مسجّلة بعد.</div>'}${ev.length>150?'<div class="muted" style="font-size:.78rem">يُعرض أحدث 150 حدثًا.</div>':''}`;
}

/* ═════════ 📞 التواصل مع ولي الأمر + 🗒️ ملاحظات المعلم ═════════ */
const CN_CH=['واتساب','اتصال هاتفي','رسالة نصية','مقابلة حضورية','عبر المرشد الطلابي'];
const CN_RS=['تذكير بأنشطة متأخرة','غياب متكرر','ملاحظة سلوكية','ضعف في المستوى','خطة علاجية','شكر وتقدير','تحسّن ملحوظ','أخرى'];
function sfContacts(el,sid){
  const D=CT_DATA||{}, S=String(sid);
  const cs=(D.contacts||[]).filter(x=>x&&!x.deleted&&String(x.studentId)===S).sort((a,b)=>String(b.date).localeCompare(String(a.date))||(b.at-a.at));
  const ns=(D.notes||[]).filter(x=>x&&!x.deleted&&String(x.studentId)===S).sort((a,b)=>b.at-a.at);
  const off=!!window._ctOffline;
  el.innerHTML=`${off?'<div class="ct-warn">السجل يُحفظ على الخادم — تعذّر الاتصال الآن.</div>':''}
    <div class="ct-card"><b>📞 سجل التواصل مع ولي الأمر (${cs.length})</b>
      <div class="cn-form no-print" style="margin-top:.5rem">
        <label>التاريخ<input class="inp" type="date" id="cn-date" value="${ctToday()}"></label>
        <label>الوسيلة<select class="inp" id="cn-ch">${CN_CH.map(x=>`<option>${x}</option>`).join('')}</select></label>
        <label>السبب<select class="inp" id="cn-rs">${CN_RS.map(x=>`<option>${x}</option>`).join('')}</select></label>
        <label style="grid-column:1/-1">النتيجة / ما اتُّفق عليه<input class="inp" id="cn-res" maxlength="300" placeholder="مثال: وعد ولي الأمر بمتابعة الواجبات يوميًا"></label>
        <button class="btn sm" onclick="cnAdd('${esc(S)}')" ${off?'disabled':''}>＋ تسجيل التواصل</button></div>
      ${cs.map(x=>`<div class="cn-item"><span>📞</span><span class="tx"><b>${esc(x.reason||'')}</b> · ${esc(x.channel||'')}<small>${esc(String(x.date||'').replace(/-/g,'/'))}${x.result?' — '+esc(x.result):''}</small></span><button class="cn-del no-print" title="حذف" onclick="cnDel('contacts','${esc(x.id)}')">✕</button></div>`).join('')||'<div class="muted" style="font-size:.82rem">لا تواصل مسجّل بعد.</div>'}</div>
    <div class="ct-card" style="margin-top:.7rem"><b>🗒️ ملاحظات خاصة (${ns.length})</b> <small class="muted">تظهر لك فقط — لا تصل للطالب ولا تُطبع</small>
      <div class="row no-print" style="margin:.5rem 0;gap:.4rem"><input class="inp" id="nt-text" maxlength="500" style="flex:1" placeholder="مثال: يحتاج الجلوس في الأمام · يتفاعل مع الأنشطة العملية"><button class="btn sm" onclick="ntAdd('${esc(S)}')" ${off?'disabled':''}>＋ إضافة</button></div>
      ${ns.map(x=>`<div class="cn-item"><span>🗒️</span><span class="tx">${esc(x.text)}<small>${esc(v2Date(x.at))}</small></span><button class="cn-del no-print" title="حذف" onclick="cnDel('notes','${esc(x.id)}')">✕</button></div>`).join('')||'<div class="muted" style="font-size:.82rem">لا ملاحظات.</div>'}</div>`;
}
async function cnAdd(sid){
  const g=id=>(document.getElementById(id)||{}).value||'';
  const rec={id:v2Id(),studentId:String(sid),date:g('cn-date')||ctToday(),channel:g('cn-ch'),reason:g('cn-rs'),result:g('cn-res').trim(),at:Date.now()};
  try{ await ctSave(D=>{ D.contacts=Array.isArray(D.contacts)?D.contacts:[]; D.contacts.push(rec); }); toast('📞 سُجّل التواصل','good'); renderClassTools(); }
  catch(e){ toast('تعذّر الحفظ','bad'); }
}
async function ntAdd(sid){
  const t=((document.getElementById('nt-text')||{}).value||'').trim(); if(!t) return;
  try{ await ctSave(D=>{ D.notes=Array.isArray(D.notes)?D.notes:[]; D.notes.push({id:v2Id(),studentId:String(sid),text:t,at:Date.now()}); }); toast('🗒️ أُضيفت الملاحظة','good'); renderClassTools(); }
  catch(e){ toast('تعذّر الحفظ','bad'); }
}
async function cnDel(kind,id){
  if(!(await askConfirm('حذف هذا السجل؟',{danger:true,yes:'حذف'}))) return;
  try{ await ctSave(D=>{ const L=Array.isArray(D[kind])?D[kind]:[]; const x=L.find(r=>String(r.id)===String(id)); if(x){ x.deleted=true; x.at=Date.now(); } D[kind]=L; }); renderClassTools(); }
  catch(e){ toast('تعذّر الحذف','bad'); }
}

/* ═════════ 🧾 ملف إنجاز المعلم ═════════ */
function ctPortfolioBody(print){
  const D=CT_DATA||{}, {sem,per}=ctSem(), classes=ctClasses(), all=classes.map(c=>cfStats(c)).filter(x=>x.n);
  const n=(STUDENTS||[]).length, tot=all.reduce((a,x)=>({t:a.t+x.dist.t,w:a.w+x.dist.w,b:a.b+x.dist.b,u:a.u+x.dist.u}),{t:0,w:0,b:0,u:0});
  const stats=activityStats(), exp=stats.reduce((a,x)=>a+x.total,0), dn=stats.reduce((a,x)=>a+x.done,0);
  const KL={normal:'📝 أنشطة',reading:'📖 فهم قرائي',games:'🎮 ألعاب تعليمية',files:'📎 مشاريع وتسليم ملفات',lab:'🔬 مختبر افتراضي',style:'🧠 أنماط التعلّم',diag:'🔍 اختبارات تشخيصية'};
  const kinds={}; HW.forEach(h=>{ const k=h&&h.remedial?'🩹 أنشطة علاجية':(KL[String(h&&h.kind||'normal')]||'📝 أنشطة'); kinds[k]=(kinds[k]||0)+1; });
  const plans=(CT_GRADES&&CT_GRADES.plans)||[], done=plans.filter(p=>p.status==='done'), imp=plans.filter(p=>p.verdict==='تحسّن');
  const gains=plans.map(p=>p.gain).filter(Number.isFinite), stud=new Set(plans.flatMap(p=>(p.members||[]).map(m=>String(m.studentId)))).size;
  const certs=(D.certificates||[]).filter(c=>c&&!c.deleted), pos=(D.behavior||[]).filter(x=>x&&!x.deleted&&x.type==='positive').length, neg=(D.behavior||[]).filter(x=>x&&!x.deleted&&x.type!=='positive').length;
  const days=Object.keys(D.participation||{}).filter(d=>Object.keys(D.participation[d]||{}).length).length;
  const cons=(D.contacts||[]).filter(c=>c&&!c.deleted), byR={}; cons.forEach(c=>byR[c.reason]=(byR[c.reason]||0)+1);
  let tests=0, exAvg=null; try{ const b=ctBook(JSON.parse(JSON.stringify(D)),sem,per); tests=b.tests.length; const s=ctExamStats(b,STUDENTS||[]).filter(x=>x.n); exAvg=s.length?Math.round(s.reduce((a,x)=>a+x.pct,0)/s.length):null; }catch(e){}
  const kpi=(t,v,sub,tone='')=>`<div class="ct-kpi ${tone}"><b>${v??'—'}</b><span>${t}</span>${sub?`<small>${sub}</small>`:''}</div>`;
  const row=(a,b)=>`<div class="ct-li"><span>${a}</span><b>${b}</b></div>`;
  return `<div class="rep-info" style="margin-bottom:.6rem"><div>المعلم<b>${esc(rcGet('teacher')||'—')}</b></div><div>المادة<b>${esc(rcGet('subject')||'—')}</b></div><div>المدرسة<b>${esc(rcGet('school')||'—')}</b></div><div>الفترة<b>الفصل ${sem===1?'الأول':'الثاني'} · ${per===1?'الفترة الأولى':'الفترة الثانية'}</b></div></div>
    <div class="ct-kpis ct-kpis6">${kpi('الفصول',classes.length)}${kpi('الطلاب',n)}${kpi('الأنشطة',HW.length,`نسبة التسليم ${v2Pct(dn,exp)??'—'}%`)}${kpi('الخطط العلاجية',plans.length,`${imp.length} تحسّن`)}${kpi('شهادات التقدير',certs.length)}${kpi('تواصل مع أولياء الأمور',cons.length)}</div>
    <div class="cf-grid">
      <div class="ct-card"><b>📚 التدريس والأنشطة</b>${Object.entries(kinds).sort((a,b)=>b[1]-a[1]).map(([k,v])=>row(esc(k),v)).join('')}${row('نسبة التسليم الكلية',(v2Pct(dn,exp)??'—')+'%')}${row('الاختبارات المرصودة في الفترة',tests)}${exAvg!=null?row('متوسط نتائج الاختبارات',exAvg+'%'):''}</div>
      <div class="ct-card"><b>📊 مستويات الطلاب (من إجاباتهم)</b>
        <div class="cf-dist"><i class="t" style="flex:${tot.t}"></i><i class="w" style="flex:${tot.w}"></i><i class="b" style="flex:${tot.b}"></i><i class="u" style="flex:${tot.u}"></i></div>
        ${row('🟢 متقن',tot.t)}${row('🟡 قريب من الإتقان',tot.w)}${row('🔴 يحتاج دعم',tot.b)}${row('⚪ لم يُقَس',tot.u)}</div>
      <div class="ct-card"><b>🩺 المعالجة والدعم</b>${row('خطط علاجية',plans.length)}${row('طلاب شملتهم الخطط',stud)}${row('خطط مكتملة',done.length)}${row('حكمها «تحسّن» (قياس قبلي وبعدي)',imp.length)}${gains.length?row('متوسط التحسن المقاس',(v2Avg(gains)>0?'+':'')+v2Avg(gains)+' نقطة'):''}</div>
      <div class="ct-card"><b>🌟 التحفيز والانضباط</b>${row('شهادات شكر وتقدير',certs.length)}${row('ملاحظات سلوكية إيجابية',pos)}${row('ملاحظات تحتاج متابعة',neg)}${row('أيام رصد الحضور والمشاركة',days)}</div>
      ${CT_PREV?`<div class="ct-card"><b>📈 التطور مقارنة بـ${esc(CT_PREV.label)}</b>${all.map(x=>{ const a=cfStats(x.cls,ctPG); return `<div class="ct-li"><span>${esc(x.cls)}</span><span>${[cmpIt('الإتقان',a.mastery,x.mastery,'%'),cmpIt('يحتاج دعم',a.dist.b,x.dist.b,'',0,1)].filter(Boolean).join(' ')||'—'}</span></div>`; }).join('')}</div>`:''}
      <div class="ct-card"><b>📞 الشراكة مع الأسرة</b>${row('مرات التواصل الموثّقة',cons.length)}${Object.entries(byR).sort((a,b)=>b[1]-a[1]).map(([k,v])=>row(esc(k),v)).join('')}</div>
    </div>
    ${all.length?`<div class="ct-card" style="margin-top:.7rem"><b>⚖️ ملخص الفصول</b><div class="ct-table"><table class="cf-cmp"><thead><tr><th>الفصل</th><th>الطلاب</th><th>الإتقان</th><th>التسليم</th><th>الحضور</th><th>متقن</th><th>يحتاج دعم</th></tr></thead><tbody>
      ${all.map(x=>`<tr><td><b>${esc(x.cls)}</b></td><td>${x.n}</td><td>${x.mastery??'—'}${x.mastery!=null?'%':''}</td><td>${x.sub??'—'}${x.sub!=null?'%':''}</td><td>${x.att??'—'}${x.att!=null?'%':''}</td><td>${x.dist.t}</td><td>${x.dist.b}</td></tr>`).join('')}</tbody></table></div></div>`:''}`;
}
async function ctPortfolio(box,force){
  try{ await ctEnsureGrades(force); }catch(e){}
  try{ await ctEnsurePrev(force); }catch(e){}
  box.innerHTML=`<div class="row ct-tools no-print"><span class="muted" style="font-size:.8rem">ملخص فصلي لإنجازك محسوب من بياناتك الفعلية — يصلح لملف الأداء الوظيفي ولزيارة المشرف.</span><span class="spacer"></span>
      <button class="btn sm" onclick="ctPortfolioPrint()">🖨️ طباعة ملف الإنجاز</button></div>${ctPortfolioBody()}`;
}
function ctPortfolioPrint(){
  ensureLogo();
  let box=document.getElementById('plan-print'); if(!box){ box=document.createElement('div'); box.id='plan-print'; box.className='rep'; document.body.appendChild(box); }
  box.innerHTML=`<div class="rep-page plan-doc ct-pf-print cf-print">${repHead('ملف إنجاز المعلم','تقرير')}<div class="rep-in">${ctPortfolioBody(true)}
    <div class="plan-note">جميع الأرقام محسوبة آليًا من سجلات المعلم وإجابات الطلاب الفعلية.</div>
    <div class="plan-sign"><div>معلم المادة<b>${esc(rcGet('teacher')||'')}</b><span>التوقيع: ....................</span></div>
      <div>مدير المدرسة<b>${esc(rcGet('principal')||'')||'&nbsp;'}</b><span>التوقيع: ....................</span></div></div></div></div>`;
  unifiedA4Print({bodyClass:'printing-plans',title:'ملف إنجاز المعلم',selector:'#plan-print',orientation:'portrait',margin:'8mm'});
}

/* ═════════ تسجيل الأقسام الجديدة في أدوات الفصل ═════════ */
CT_TABS.push(['classfile','🏫 ملف الفصل'],['portfolio','🧾 ملف الإنجاز']);
CT_VIEWS.classfile={tabs:['classfile'],title:'🏫 ملف الفصل',sub:'كل ما يخص الفصل في صفحة واحدة: المستويات والمهارات والمحتاجون للدعم والمتميزون ومقارنته بالفصول الأخرى — مع طباعة للمشرف.'};
CT_VIEWS.portfolio={tabs:['portfolio'],title:'🧾 ملف إنجاز المعلم',sub:'تقرير فصلي يجمع إنجازك: الأنشطة، مستويات الطلاب، الخطط العلاجية ونتائجها، التحفيز، والتواصل مع الأسر.'};
CT_PF_SUBS.splice(2,0,['timeline','🕓 الخط الزمني'],['contacts','📞 التواصل والملاحظات']);

/* ═════════ 🔎 بحث شامل Ctrl+K: طالب · فصل · صفحة ═════════ */
function qkOpen(){
  if(document.querySelector('.qk-veil')) return;
  const v=document.createElement('div'); v.className='qk-veil';
  v.innerHTML=`<div class="qk-box" role="dialog"><input id="qk-q" placeholder="ابحث عن طالب أو فصل أو صفحة…" autocomplete="off"><div class="qk-list" id="qk-list"></div><div class="qk-hint">↑↓ للتنقل · Enter للفتح · Esc للإغلاق · Ctrl+K من أي مكان</div></div>`;
  document.body.appendChild(v);
  const pages=[...document.querySelectorAll('.app-sidebar-scroll .tab')].map(b=>({t:b.innerText.replace(/\s+/g,' ').trim(),go:b.dataset.view?`goTab('${b.dataset.tab}:${b.dataset.view}')`:`goTab('${b.dataset.tab}')`,ic:'📄',k:'صفحة'}));
  let sel=0, items=[];
  const n=x=>typeof normAr==='function'?normAr(x):String(x||'');
  const draw=()=>{ const q=n(document.getElementById('qk-q').value).trim();
    const st=(STUDENTS||[]).filter(s=>!q||n(s.name).includes(q)).slice(0,q?8:0).map(s=>({t:s.name,ic:'👤',k:s.cls||'',go:`ctOpenProfile('${esc(s.id)}')`}));
    const cl=ctClasses().filter(c=>!q||n(c).includes(q)).slice(0,4).map(c=>({t:'ملف الفصل '+c,ic:'🏫',k:'فصل',go:`window._ctCfCls='${esc(c)}';ctGo('classfile')`}));
    const pg=pages.filter(p=>!q||n(p.t).includes(q)).slice(0,q?6:20);
    items=[...st,...cl,...pg]; sel=Math.min(sel,Math.max(0,items.length-1));
    document.getElementById('qk-list').innerHTML=items.map((x,i)=>`<button type="button" data-i="${i}" class="${i===sel?'on':''}">${x.ic} ${esc(x.t)}<small>${esc(x.k)}</small></button>`).join('')||'<div class="muted" style="padding:.8rem">لا نتائج.</div>'; };
  const close=()=>{ v.remove(); document.removeEventListener('keydown',key,true); };
  const run=i=>{ const x=items[i]; if(!x) return; close(); try{ (new Function(x.go))(); }catch(e){ console.warn(e); } };
  const key=e=>{ if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); close(); }
    else if(e.key==='ArrowDown'){ e.preventDefault(); sel=Math.min(items.length-1,sel+1); draw(); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); sel=Math.max(0,sel-1); draw(); }
    else if(e.key==='Enter'){ e.preventDefault(); run(sel); } };
  document.addEventListener('keydown',key,true);
  v.addEventListener('click',e=>{ if(e.target===v) close(); const b=e.target.closest('[data-i]'); if(b) run(+b.dataset.i); });
  document.getElementById('qk-q').addEventListener('input',()=>{ sel=0; draw(); });
  draw(); setTimeout(()=>document.getElementById('qk-q')?.focus(),20);
}
document.addEventListener('keydown',e=>{ if((e.ctrlKey||e.metaKey)&&(e.key==='k'||e.key==='K'||e.code==='KeyK')){ e.preventDefault(); qkOpen(); } });
