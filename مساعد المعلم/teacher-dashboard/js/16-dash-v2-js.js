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
  const acts=HW.filter(h=>hwFor(h,cls)&&(typeof remPublished==='function'?remPublished(h):(typeof activityReady!=='function'||activityReady(h))));
  let exp=0,done=0; acts.forEach(h=>roster.forEach(s=>{ exp++; if(h.subs&&h.subs[s.id]) done++; }));
  return { cls, n:roster.length, G,
    mastery:tot?Math.round(cor/tot*100):null, measured:lv.length,
    dist:{t:lv.filter(l=>l.status==='متقن').length,w:lv.filter(l=>l.status==='قريب من الإتقان').length,b:lv.filter(l=>l.status==='يحتاج دعم').length,u:roster.length-lv.length},
    part:v2Avg(m('participation').map(x=>x.g.participation.score)), hw:v2Avg(m('homework').map(x=>x.g.homework.score)),
    beh:v2Avg(G.map(x=>x.g.behavior&&x.g.behavior.measured?x.g.behavior.score:10)), att:v2Avg(m('attendance').map(x=>x.g.attendance.rate)),
    exam:v2Avg(G.map(x=>x.g.exam&&x.g.exam.measured?x.g.exam.score:NaN)), acts:acts.length, sub:v2Pct(done,exp) };
}
function cfSkills(cls){
  const all={}; ctRoster(cls).forEach(s=>Object.entries(ctSk(s.id)||{}).forEach(([k,v])=>{ const a=all[k]||(all[k]={c:0,t:0,weak:[]}); a.c+=v.c; a.t+=v.t; if(v.t>=2&&v.rate<60) a.weak.push(String(s.id)); }));
  return Object.entries(all).filter(([,a])=>a.t>=3).map(([k,a])=>({k,rate:Math.round(a.c/a.t*100),weak:a.weak})).sort((a,b)=>a.rate-b.rate);
}

/* 🎯 حصر الطلاب الضعاف دراسيًا — الأولوية بقرار المعلم:
   ① درجة الاختبار أقل من 10 من 20 (كما في كشف الدرجات) ← ② لم يحل أي نشاط منشور له ← ③ إتقان المهارات أقل من 50%.
   الطالب في أعلى فئة تنطبق عليه، والشروط الأخرى تظهر وسومًا بجانبه. ومعه حالة الخطة العلاجية. */
const CF_EXAM_GAP=10, CF_SKILL_GAP=50;
function cfWeakList(cls){
  const plans=(CT_GRADES&&CT_GRADES.plans)||[];
  const planOf=sid=>plans.find(p=>p.status!=='done'&&(p.members||[]).some(m=>String(m.studentId)===String(sid)));
  const acts=HW.filter(h=>hwFor(h,cls)&&(typeof remPublished==='function'?remPublished(h):(typeof activityReady!=='function'||activityReady(h))));
  return ctRoster(cls).map(s=>{ const g=ctG(s.id), e=g.exam||{};
    const exam=e.measured&&e.score!=null?Number(e.score):null;   // درجة الكشف نفسها (مع بطاقات المتجر) — رصد موحّد
    const lv=g.level&&g.level.measured?g.level:null;
    const skAll=Object.entries(ctSk(s.id)).filter(([,v])=>v.t>=2), skC=skAll.reduce((a,[,v])=>a+v.c,0), skT=skAll.reduce((a,[,v])=>a+v.t,0);
    const mastery=lv?lv.rate:skT?Math.round(skC/skT*100):null;
    const sk=skAll.filter(([,v])=>v.rate<SKILL_GAP_UI).sort((a,b)=>a[1].rate-b[1].rate);
    const done=acts.filter(h=>h.subs&&h.subs[s.id]).length;
    const f={exam:exam!=null&&exam<CF_EXAM_GAP, none:acts.length>0&&!done, skill:mastery!=null&&mastery<CF_SKILL_GAP};
    return {s,exam,mastery,sk,done,acts:acts.length,f,cat:f.exam?1:f.none?2:f.skill?3:0,plan:planOf(s.id)}; }).filter(x=>x.cat)
    .sort((a,b)=>a.cat-b.cat||(a.exam??99)-(b.exam??99)||(a.mastery??101)-(b.mastery??101));
}
function cfWeakHTML(cls,print){
  const R=cfWeakList(cls); const _pub=HW.filter(h=>hwFor(h,cls)&&(typeof remPublished==='function'?remPublished(h):true)).length; const n=c=>R.filter(x=>x.cat===c).length, noPlan=R.filter(x=>!x.plan).length;
  const CAT={1:['bad',`الاختبار أقل من ${CF_EXAM_GAP}`],2:['bad','لم يحل أي نشاط'],3:['warn',`المهارات أقل من ${CF_SKILL_GAP}%`]};
  const tags=x=>[x.cat!==1&&x.f.exam?CAT[1][1]:'',x.cat!==2&&x.f.none?CAT[2][1]:'',x.cat!==3&&x.f.skill?CAT[3][1]:''].filter(Boolean).map(t=>`<small class="cf-weak-also">+ ${t}</small>`).join('');
  const name=s=>print?esc(s.name):ctNameLink(s);
  return `<div class="ct-card cf-weak" style="margin-top:.7rem"><b>🎯 حصر الطلاب الضعاف دراسيًا (${R.length})</b>
    <div class="muted" style="font-size:.78rem;margin:.2rem 0 .45rem">الأولوية: ① درجة الاختبار أقل من ${CF_EXAM_GAP} من 20 (كما في كشف الدرجات) ← ② لم يحل أي نشاط منشور له ← ③ إتقان المهارات أقل من ${CF_SKILL_GAP}%.</div>
    ${R.length?`<div class="cf-weak-sum"><span class="chip bad">① الاختبار ${n(1)}</span><span class="chip bad">② بلا أنشطة ${n(2)}</span><span class="chip warn">③ المهارات ${n(3)}</span>${noPlan?`<span class="chip ghost">${noPlan} بلا خطة علاجية</span>`:''}</div>
    <div class="ct-table"><table class="cf-weak-t"><thead><tr><th>#</th><th>الطالب</th><th>الأولوية</th><th>الاختبار</th><th>الأنشطة</th><th>الإتقان</th><th>أضعف المهارات</th><th>الخطة</th></tr></thead><tbody>
    ${R.map((x,i)=>`<tr class="c${x.cat}"><td>${i+1}</td><td>${name(x.s)}${tags(x)}</td><td><span class="chip ${CAT[x.cat][0]}">${'①②③'[x.cat-1]} ${CAT[x.cat][1]}</span></td>
      <td class="${x.f.exam?'bad':''}">${x.exam!=null?`<b>${x.exam}</b>/20`:'<span class="muted">—</span>'}</td>
      <td class="${x.f.none?'bad':''}">${x.done} من ${x.acts}</td>
      <td class="${x.f.skill?'bad':''}">${x.mastery!=null?x.mastery+'%':'<span class="muted">لم يُقَس</span>'}</td>
      <td class="cf-weak-sk">${x.sk.slice(0,3).map(([k,v])=>`<span>${esc(String(k).replace(/^نافس:\s*/,''))} <b>${v.rate}%</b></span>`).join('')||'<span class="muted">—</span>'}</td>
      <td>${x.plan?'<span class="chip tick">🩺 خطة جارية</span>':print?'<span class="muted">لا توجد</span>':`<button class="btn tick sm" onclick="ctPlanStudent('${esc(x.s.id)}')">＋ خطة</button>`}</td></tr>`).join('')}
    </tbody></table></div>`:'<div class="muted" style="font-size:.84rem">✅ لا يوجد طالب درجته أقل من 10، أو بلا أنشطة، أو مهاراته أقل من 50% حسب البيانات الحالية.'+(_pub?'':' ولا توجد أنشطة منشورة لهذا الفصل بعد.')+'</div>'}</div>`;
}

/* 🏆 العشرة الأوائل: بمجموع كشف الدرجات من 60 (أعمال السنة 40 + الاختبار 20)، والاختبار بدرجة الكشف نفسها (مع بطاقات المتجر)
   حتى لا تُشترى المرتبة · التعادل يُحسم بالإتقان ثم الاختبار · من لم تصل بياناته من الخادم لا يدخل */
function cfTopList(cls,n=10){
  const G=CT_GRADES||{}, term=G.term, r1=v=>Math.round((Number(v)||0)*10)/10;
  return ctRoster(cls).filter(s=>G.map&&G.map[String(s.id)]).map(s=>{ const g=ctG(s.id), e=g.exam||{};
    const acts=compActivitiesForStudent(s,term), done=compSubmissionCount(acts,s,term);
    const a=acts.length?Math.round(done/acts.length*100)/10:null;
    const exam=e.measured&&e.score!=null?r1(e.score):null;   // درجة الكشف نفسها (مع بطاقات المتجر) فيطابق المجموع كشف الدرجات ونور
    const _parts=[g.participation?.measured?g.participation.score:null,g.homework?.measured?g.homework.score:null,g.behavior?.measured?g.behavior.score:null,a].filter(v=>Number.isFinite(v));
    const work=_parts.length?r1(_parts.reduce((s2,v)=>s2+v,0)):0;
    const lv=g.level&&g.level.measured?g.level.rate:null;
    return {s,work,exam,total:r1(work+(exam??0)),mastery:lv,done,acts:acts.length}; })
    .filter(x=>x.done>0||x.exam!=null)
    .sort((a,b)=>b.total-a.total||(b.mastery??-1)-(a.mastery??-1)||(b.exam??-1)-(a.exam??-1)).slice(0,n);
}
function cfTopHTML(cls,print){
  const R=cfTopList(cls), name=s=>print?esc(s.name):ctNameLink(s);
  const meta=x=>`<span>📝 ${x.exam!=null?x.exam+'/20':'—'}</span><span>📚 ${x.work}/40</span><span>🎯 ${x.mastery!=null?x.mastery+'%':'—'}</span>`;
  const pod=R.slice(0,3), rest=R.slice(3), M=['🥇','🥈','🥉'];
  return `<div class="cf2-card cf2-top"><div class="cf2-h"><b>🏆 العشرة الأوائل — فصل ${esc(cls)}</b><small>بالمجموع من 60 · مطابق لكشف الدرجات · التعادل بالإتقان ثم الاختبار</small>
      ${!print && R.length ? `<button class="btn tick sm cf2-honor" onclick="t3Open('${esc(cls)}')">🏅 تكريم الثلاثة الأوائل</button>` : ''}</div>
    ${R.length?`<div class="cf2-podium">${pod.map((x,i)=>`<div class="cf2-pod p${i+1}"><div class="cf2-medal">${M[i]}</div><div class="cf2-pn">${name(x.s)}</div>
        <div class="cf2-ps"><b>${x.total}</b><small>/${x.exam!=null?60:40}</small></div><div class="cf2-pm">${meta(x)}</div></div>`).join('')}</div>
      ${rest.length?`<ol class="cf2-rank" start="4">${rest.map((x,i)=>`<li><span class="cf2-rn">${i+4}</span><span class="cf2-rname">${name(x.s)}</span>
        <span class="cf2-rbar"><u style="width:${Math.round(x.total/(x.exam!=null?60:40)*100)}%"></u></span><b class="cf2-rt">${x.total}<small>/${x.exam!=null?60:40}</small></b><span class="cf2-rmeta">${meta(x)}</span></li>`).join('')}</ol>`:''}`
    :'<div class="cf2-empty">لا توجد درجات مرصودة بعد لهذا الفصل.</div>'}</div>`;
}

/* ═════════ 🏅 تكريم الثلاثة الأوائل: شهادة خاصة تظهر في صفحة ولي الأمر + تهنئة واتساب ═════════ */
const T3_ORD=['الأول','الثاني','الثالث'], T3_MED=['🥇','🥈','🥉'];
let T3={ sent:{}, tpl:null, cls:'', all:false, pv:null };
const t3Api=()=>getApi().replace(/\/+$/,'');
function t3Label(){ const {sem,per}=ctSem(); return { sem, per, label:`${sem===1?'الفصل الأول':'الفصل الثاني'} — ${per===1?'الفترة الأولى':'الفترة الثانية'}` }; }
/* الثلاثة الأوائل للفصل من «العشرة الأوائل» نفسها — مع تنبيه إن تعادل الثالث والرابع في المجموع */
function t3Of(cls){ const L=cfTopList(cls,4), top=L.slice(0,3); return { cls, top, tie: L.length>3 && L[3].total===L[2].total ? L[3] : null }; }
function t3SentFor(sid){ const {sem,per}=ctSem(); return ((T3.sent||{})[String(sid)]||[]).find(e=>e.sem===sem&&e.per===per)||null; }
async function t3Load(){ try{ const r=await fetch(t3Api()+'/honor-top3?t='+encodeURIComponent(getTok())); const j=await r.json(); if(j&&j.ok){ T3.sent=j.top3||{}; T3.tpl=j.tpl||null; } }catch(e){} }
async function t3Open(cls){
  T3.cls=cls; T3.all=false; T3.pv=null;
  openModal(`<div class="t3"><div class="muted">⏳ جارٍ التحميل…</div></div>`);
  await Promise.all([t3Load(), typeof parLoad==='function'?parLoad():null]); t3Draw();
}
function t3Draw(){
  const box=document.querySelector('.t3'); if(!box) return;
  const L=t3Label(), groups=(T3.all?ctClasses():[T3.cls]).map(t3Of).filter(g=>g.top.length);
  const toSend=groups.flatMap(g=>g.top.map((x,i)=>({x,i,cls:g.cls}))).filter(o=>{ const e=t3SentFor(o.x.s.id); return !e||e.rank!==o.i+1; });
  const ph=sid=>PARENTS&&PARENTS[String(sid)];
  box.innerHTML=`<div class="t3-hd"><div><h2>🏅 تكريم الثلاثة الأوائل</h2><p>شهادة خاصة باسم الطالب ومركزه تظهر لولي أمره في صفحة ولي الأمر · ${esc(L.label)}</p></div></div>
    <div class="t3-seg"><button class="${T3.all?'':'on'}" onclick="T3.all=false;t3Draw()">فصل ${esc(T3.cls)}</button><button class="${T3.all?'on':''}" onclick="T3.all=true;t3Draw()">كل الفصول (${ctClasses().length})</button></div>
    <div class="t3-body">${groups.map(g=>`<div class="t3-cls"><div class="t3-ch"><b>🏫 ${esc(g.cls)}</b>${g.tie?`<span class="t3-tie">⚠️ تعادل في المجموع بين الثالث و«${esc(g.tie.s.name.split(' ')[0])}» (${g.tie.total}) — الترتيب حسمه الإتقان ثم الاختبار</span>`:''}</div>
      ${g.top.map((x,i)=>{ const e=t3SentFor(x.s.id), ok=e&&e.rank===i+1, p=ph(x.s.id);
        return `<div class="t3-row r${i+1}"><span class="t3-m">${T3_MED[i]}</span><div class="t3-n"><b>${esc(x.s.name)}</b><small>المركز ${T3_ORD[i]} · ${x.total} من ${x.exam!=null?60:40}${x.mastery!=null?` · إتقان ${x.mastery}%`:''}</small></div>
          <span class="chip ${ok?'tick':'ghost'}">${ok?'✓ أُرسلت':e?'أُرسلت بمركز آخر':'لم تُرسل'}</span>
          <div class="t3-act"><button class="btn ghost sm" onclick="t3Preview('${esc(x.s.id)}','${esc(g.cls)}',${i+1},${x.total},${x.exam!=null?60:40})">👁️ معاينة</button>
            ${ok?`<button class="btn sm ${p?'tick':'ghost'}" onclick="t3Wa('${esc(x.s.id)}','${esc(g.cls)}',${i+1})" title="${p?'تهنئة على جوال ولي الأمر':'لا يوجد جوال محفوظ — تختار المحادثة بنفسك'}">💬 تهنئة واتساب</button>
              <button class="btn ghost sm" onclick="t3Revoke('${esc(x.s.id)}')" title="سحب الشهادة من صفحة ولي الأمر">↩️</button>`:''}</div></div>`; }).join('')}</div>`).join('')||'<div class="muted">لا درجات مرصودة بعد.</div>'}</div>
    ${T3.pv?`<div class="t3-pv"><div class="t3-pvh"><b>👁️ معاينة شهادة ${esc(T3.pv.name)}</b><button class="btn ghost sm" onclick="T3.pv=null;t3Draw()">إغلاق المعاينة</button></div><iframe id="t3-frame" src="${esc(getSite().replace(/\/+$/,''))}/parent.html?preview=top3" title="معاينة الشهادة"></iframe></div>`:''}
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إغلاق</button>
      <button class="btn tick" id="t3-send" ${toSend.length?'':'disabled'} onclick="t3Send()">${toSend.length?`📨 إرسال ${toSend.length} ${toSend.length>2&&toSend.length<11?'شهادات':'شهادة'} لأولياء الأمور`:'✓ أُرسلت كلها'}</button></div>`;
  T3.queue=toSend;
}
/* المعاينة: صفحة ولي الأمر نفسها في إطار، تصلها بيانات الشهادة برسالة (عليها شارة «معاينة») */
function t3Cert(sid,cls,rank,total,max){
  const s=(STUDENTS||[]).find(v=>String(v.id)===String(sid))||{}, k=T3.tpl||{}, subj=rcGet('subject')||'العلوم', L=t3Label();
  return { rank, name:s.name||'', cls, date:ctCertDateLine(ctToday()), pre:k.pre||'يتقدم معلم المادة بالشكر والتقدير للطالب', dua:k.dua||'سائلين المولى له دوام التوفيق والنجاح',
    reason:`حصوله على المركز ${T3_ORD[rank-1]} على طلاب الفصل ${cls} في مادة ${subj} — ${L.label}`, total, max,
    rTitle:k.rTitle||'معلم المادة', rName:k.rName||rcGet('teacher')||'', lTitle:k.lTitle||'مدير المدرسة', lName:k.lName||rcGet('principal')||'' };
}
function t3Preview(sid,cls,rank,total,max){
  const c=t3Cert(sid,cls,rank,total,max); T3.pv=c; t3Draw();
  const f=document.getElementById('t3-frame'), send=()=>{ try{ f.contentWindow.postMessage({type:'mb-top3-preview',c},'*'); }catch(e){} };
  if(f){ f.onload=()=>setTimeout(send,150); f.scrollIntoView({behavior:'smooth',block:'nearest'}); }
}
window.addEventListener('message',ev=>{ if(ev.data&&ev.data.type==='mb-top3-ready'&&T3.pv){ const f=document.getElementById('t3-frame'); if(f&&ev.source===f.contentWindow) f.contentWindow.postMessage({type:'mb-top3-preview',c:T3.pv},'*'); } });
async function t3Send(){
  const q=T3.queue||[]; if(!q.length) return; const b=document.getElementById('t3-send'); if(b){ b.disabled=true; b.textContent='⏳ جارٍ الإرسال…'; }
  const L=t3Label();
  try{ const r=await fetch(t3Api()+'/honor-top3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),op:'send',sem:L.sem,per:L.per,label:L.label,
      items:q.map(o=>({sid:o.x.s.id,rank:o.i+1,cls:o.cls,total:o.x.total,max:o.x.exam!=null?60:40}))})});
    const j=await r.json(); if(!j.ok) throw new Error(j.error||r.status); T3.sent=j.top3||T3.sent;
    toast(`🏅 أُرسلت ${j.sent} ${j.sent>2&&j.sent<11?'شهادات':'شهادة'} — تظهر الآن في صفحة ولي الأمر. أرسل التهنئة بالواتساب من زر كل طالب.`,'good'); t3Draw();
  }catch(e){ toast('تعذّر الإرسال: '+(/404|not_found/.test(String(e.message))?'انشر worker.js الأخير':e.message),'bad'); t3Draw(); }
}
async function t3Revoke(sid){
  const s=(STUDENTS||[]).find(v=>String(v.id)===String(sid))||{}; if(!confirm(`سحب شهادة الأوائل من صفحة ولي أمر ${s.name||''}؟`)) return;
  const L=t3Label();
  try{ const r=await fetch(t3Api()+'/honor-top3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),op:'revoke',sid,sem:L.sem,per:L.per})});
    const j=await r.json(); if(j.ok){ T3.sent=j.top3||{}; toast('سُحبت الشهادة','good'); } }catch(e){ toast('تعذّر السحب','bad'); }
  t3Draw();
}
function t3Wa(sid,cls,rank){
  const s=(STUDENTS||[]).find(v=>String(v.id)===String(sid))||{}, subj=rcGet('subject')||'العلوم';
  parWaOpen(sid,`السلام عليكم ولي أمر الطالب ${String(s.name||'').split(/\s+/)[0]}،\nيسعدنا تهنئتكم بحصول ابنكم على *المركز ${T3_ORD[rank-1]}* على طلاب فصل ${cls} في مادة ${subj} 🏆\nشهادة التكريم بانتظاركم في صفحة ولي الأمر:\n${parLink()}\n(الدخول باسم الطالب ورقم جوالكم المسجّل في المدرسة)\nبارك الله فيه ونفع به.`);
}

/* ═════════ 🏫 ملف الفصل ═════════ */
function ctClassFileBody(cls,print){
  const st=cfStats(cls);
  const sk=cfSkills(cls), weak=sk.slice(0,3), strong=sk.slice(-3).reverse().filter(x=>x.rate>=70&&!weak.some(w=>w.k===x.k));
  const support=st.G.filter(x=>(x.g.level&&x.g.level.status==='يحتاج دعم')||(x.g.trend&&x.g.trend.measurable&&x.g.trend.change<=-10));
  let cands=[]; try{ cands=ctCertCandidates(cls); }catch(e){}
  let al=[], alAll=[]; try{ alAll=ctAlerts(cls); al=ctAlertsOpen(cls); }catch(e){}
  const plans=((CT_GRADES&&CT_GRADES.plans)||[]).filter(p=>(p.members||[]).some(mm=>st.G.some(x=>String(x.s.id)===String(mm.studentId))));
  const act=plans.filter(p=>p.status!=='done'), imp=plans.filter(p=>p.status==='done'&&p.verdict==='تحسّن').length;
  const all=ctClasses().map(c=>cfStats(c)).filter(x=>x.n);
  const cols=[['mastery','الإتقان','%'],['sub','التسليم','%'],['att','الحضور','%'],['part','المشاركة','/10'],['hw','الواجبات','/10'],['beh','السلوك','/10'],['exam','الاختبارات','/20']];
  const best=k=>{ const v=all.map(x=>x[k]).filter(Number.isFinite); return v.length>1?[Math.max(...v),Math.min(...v)]:[null,null]; };
  const d=st.dist, tot=Math.max(1,st.n), btn=h=>print?'':h;
  const name=s=>print?esc(s.name):ctNameLink(s);
  const {sem,per}=ctSem();
  // 🎨 لون الحالة من النسبة: أخضر ≥85 · أصفر ≥70 · أحمر دونها
  const tone=p=>p==null?'':p>=85?'g':p>=70?'y':'r';
  const tile=(ic,t,v,max,unit,sub)=>{ const p=v==null?null:Math.round(v/max*100);
    return `<div class="cf2-tile ${tone(p)}"><div class="cf2-ti">${ic}</div><div class="cf2-tv"><b>${v??'—'}</b><small>${v==null?'':unit}</small></div><div class="cf2-tl">${t}</div>
      <div class="cf2-tb"><u style="width:${p??0}%"></u></div>${sub?`<div class="cf2-ts">${sub}</div>`:''}</div>`; };
  const ring=st.mastery;
  const seg=(k,n,l)=>n?`<i class="${k}" style="flex:${n}" title="${l} ${n}">${n/tot>=.08?n:''}</i>`:'';
  const sec=(ic,t,sub)=>`<div class="cf2-sec"><span>${ic}</span><b>${t}</b>${sub?`<small>${sub}</small>`:''}</div>`;
  const li=(a,b)=>`<div class="cf2-li"><span>${a}</span>${b}</div>`;
  const bar=x=>`<div class="cf2-sk ${tone(x.rate)}"><span>${esc(String(x.k).replace(/^نافس:\s*/,''))}</span><i><u style="width:${x.rate}%"></u></i><b>${x.rate}%</b></div>`;
  return `<div class="cf2">
    <div class="cf2-hero">
      <div class="cf2-ring ${tone(ring)}" style="--p:${ring??0}"><b>${ring!=null?ring+'%':'—'}</b><small>الإتقان</small></div>
      <div class="cf2-hi"><div class="cf2-ht">🏫 فصل ${esc(cls)}</div>
        <div class="cf2-hs">الفصل ${sem===1?'الأول':'الثاني'} · الفترة ${per===1?'الأولى':'الثانية'} · ${st.n} طالبًا (قيس منهم ${st.measured}) · ${st.acts} نشاطًا · الإتقان مرجّح بعدد الأسئلة</div>
        <div class="cf2-dist">${seg('t',d.t,'متقن')}${seg('w',d.w,'قريب')}${seg('b',d.b,'يحتاج دعم')}${seg('u',d.u,'لم يُقَس')}</div>
        <div class="cf2-lg"><span class="t">متقن <b>${d.t}</b></span><span class="w">قريب <b>${d.w}</b></span><span class="b">يحتاج دعم <b>${d.b}</b></span><span class="u">لم يُقَس <b>${d.u}</b></span></div></div>
    </div>
    ${typeof ctCmpClassHTML==='function'?ctCmpClassHTML(cls):''}
    <div class="cf2-tiles">
      ${tile('📤','التسليم',st.sub,100,'%',`${st.acts} نشاط`)}
      ${tile('🗓️','الحضور',st.att,100,'%')}
      ${tile('🙋','المشاركة',st.part,10,'/10')}
      ${tile('📘','الواجبات',st.hw,10,'/10')}
      ${tile('🌟','السلوك',st.beh,10,'/10','يبدأ من 10 لمن لا ملاحظات عليه')}
      ${tile('📝','الاختبارات',st.exam,20,'/20')}
    </div>

    ${sec('🏆','التميّز','الأوائل ومن يستحق التكريم')}
    ${cfTopHTML(cls,print)}
    <div class="cf2-card"><div class="cf2-h"><b>🌟 مرشحون للتكريم (${cands.length})</b><small>إتقان أو تحسّن أو خطة ناجحة أو انضباط كامل</small></div>
      ${cands.length?`<div class="cf2-chips">${cands.slice(0,16).map(x=>`<div class="cf2-cand"><span>${name(x.s)}<small>${esc(x.why.map(w=>w[0]).join('، '))}</small></span>${x.had?'<em>🏅 لديه شهادة</em>':btn(`<button class="btn ghost sm" onclick="ctCertQuick('${esc(x.s.id)}','${x.why.map(w=>CT_CERT_REASON[w[0]]).filter(Boolean).join('، ')||'تميّزه'}')">🏅 شهادة</button>`)}</div>`).join('')}</div>${cands.length>16?`<div class="muted" style="font-size:.76rem">و${cands.length-16} مرشحًا آخر</div>`:''}`:'<div class="cf2-empty">لا مرشحين حاليًا.</div>'}</div>

    ${sec('🎯','المتابعة والعلاج','من يحتاج تدخّلًا الآن')}
    ${cfWeakHTML(cls,print)}
    <div class="cf2-grid3">
      <div class="cf2-card"><div class="cf2-h"><b>🆘 يحتاجون دعمًا (${support.length})</b></div>${support.slice(0,12).map(x=>li(name(x.s),`<span class="chip ${x.g.level&&x.g.level.status==='يحتاج دعم'?'bad':'warn'}">${x.g.level&&x.g.level.status==='يحتاج دعم'?esc(x.g.level.rate+'%'):'يتراجع '+esc(Math.abs(x.g.trend.change))}</span>`)).join('')||'<div class="cf2-empty">لا أحد ✅</div>'}${support.length>12?`<div class="muted" style="font-size:.76rem">و${support.length-12} آخرون</div>`:''}</div>
      <div class="cf2-card"><div class="cf2-h"><b>🔔 تنبيهات الانضباط (${al.length})</b></div>${al.slice(0,8).map(a=>`<div class="cf2-al ${a.lvl}">${name(a.s)}<small>${esc(a.t)}</small></div>`).join('')||'<div class="cf2-empty">لا تنبيهات ✅</div>'}${al.length>8?`<div class="muted" style="font-size:.76rem">و${al.length-8} تنبيهًا آخر</div>`:''}${alAll.length>al.length?`<div class="muted" style="font-size:.76rem">تمت متابعة ${alAll.length-al.length} تنبيهًا سابقًا</div>`:''}</div>
      <div class="cf2-card"><div class="cf2-h"><b>🩺 الخطط العلاجية</b></div>
        <div class="cf2-nums"><div><b>${act.length}</b><small>جارية</small></div><div><b>${plans.length-act.length}</b><small>منتهية</small></div><div class="g"><b>${imp}</b><small>تحسّن</small></div></div></div>
    </div>

    ${sec('🧠','المهارات','من إجابات الطلاب في الأنشطة ونواتج نافس الرسمية')}
    <div class="cf2-grid2">
      <div class="cf2-card"><div class="cf2-h"><b>🔻 أضعف المهارات</b></div>${weak.length?weak.map(x=>bar(x)+btn(x.weak.length>=2?`<button class="btn ghost sm cf2-gp" onclick='ctGroupPlan(${JSON.stringify(x.k)},${JSON.stringify(x.weak)})'>🩺 خطة جماعية لـ ${x.weak.length} طلاب</button>`:'')).join(''):'<div class="cf2-empty">لا أسئلة مصنّفة بمهارات بعد.</div>'}
        ${weak.length&&weak[0].rate<60&&ctSkAct(weak[0].weak.length,st.n)==='reteach'?'<div class="ct-warn" style="margin-top:.5rem;font-size:.8rem">معظم الفصل ضعيف في «'+esc(weak[0].k)+'» — الأنسب إعادة شرحها للفصل كله.</div>':''}</div>
      <div class="cf2-card"><div class="cf2-h"><b>🔺 نقاط القوة</b></div>${strong.length?strong.map(bar).join(''):'<div class="cf2-empty">لا مهارة بلغت 70% بعد.</div>'}</div>
    </div>

    ${all.length>1?`${sec('⚖️','مقارنة بالفصول الأخرى','الأخضر أعلى فصل والأحمر أدناه في كل عنصر')}
    <div class="cf2-card"><div class="ct-table"><table class="cf-cmp"><thead><tr><th>الفصل</th><th>الطلاب</th>${cols.map(c=>`<th>${c[1]}${c[2]==='%'?'':' '+c[2]}</th>`).join('')}</tr></thead><tbody>
      ${all.map(x=>`<tr><td class="${x.cls===cls?'me':''}"><b>${esc(x.cls)}</b></td><td class="${x.cls===cls?'me':''}">${x.n}</td>${cols.map(([k,,u])=>{ const [hi,lo]=best(k), v=x[k]; return `<td class="${x.cls===cls?'me ':''}${v!=null&&hi!=null&&hi!==lo&&v===hi?'best':v!=null&&hi!=null&&hi!==lo&&v===lo?'worst':''}">${v!=null?v+(u==='%'?'%':''):'—'}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div></div>`:`<div class="muted" style="font-size:.78rem">مقارنة الفصول تظهر عند وجود أكثر من فصل واحد.</div>`}
  </div>`;
}
async function ctClassFile(box,force){
  let _cfErr=false;
  try{ await ctEnsureGrades(force); }catch(e){ _cfErr=true; }
  try{ await ctEnsurePrev(force); }catch(e){ _cfErr=true; }
  const cls=ctValidCls(window._ctCfCls);
  box.innerHTML=`<div class="row ct-tools no-print">${ctClassSel('ct-cf-cls',cls,"window._ctCfCls=this.value;renderClassTools()",false)}
      <span class="muted" style="font-size:.78rem">${(()=>{const {sem,per}=ctSem();return `الفصل ${sem===1?'الأول':'الثاني'} · الفترة ${per===1?'الأولى':'الثانية'}`})()}</span><span class="spacer"></span>
      <button class="btn sm" onclick="ctClassFilePrint()">🖨️ طباعة ملف الفصل</button></div>${_cfErr?`<div class="ct-warn" style="margin-top:.5rem">تعذّر جلب بعض البيانات من الخادم — الأرقام المعروضة قد تكون ناقصة أو قديمة.</div>`:''}${cls?ctClassFileBody(cls):'<div class="muted">لا فصول.</div>'}`;
}
function ctClassFilePrint(){
  const cls=ctValidCls(window._ctCfCls); if(!cls) return; ensureLogo();
  let box=document.getElementById('plan-print'); if(!box){ box=document.createElement('div'); box.id='plan-print'; box.className='rep'; document.body.appendChild(box); }
  box.innerHTML=`<div class="rep-page plan-doc ct-pf-print cf-print">${repHead('ملف الفصل '+cls,'تقرير')}<div class="rep-in">${ctClassFileBody(cls,true)}
    <div class="plan-note">${(()=>{const {sem,per}=ctSem();return `البيانات محسوبة من سجلات المعلم الفعلية وإجابات الطلاب في الأنشطة خلال الفصل ${sem===1?'الأول':'الثاني'} · الفترة ${per===1?'الأولى':'الثانية'}.`;})()}</div>
    <div class="plan-sign"><div>معلم المادة<b>${esc(rcGet('teacher')||'')}</b><span>التوقيع: ....................</span></div>
      <div>مدير المدرسة<b>${esc(rcGet('principal')||'')||'&nbsp;'}</b><span>التوقيع: ....................</span></div></div></div></div>`;
  unifiedA4Print({bodyClass:'printing-plans',title:'ملف الفصل',selector:'#plan-print',orientation:'landscape',margin:'8mm'});
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
  const kinds={}; HW.filter(h=>typeof remPublished==='function'?remPublished(h):true).forEach(h=>{ const k=h&&h.remedial?'🩹 أنشطة علاجية':(KL[String(h&&h.kind||'normal')]||'📝 أنشطة'); kinds[k]=(kinds[k]||0)+1; });
  const plans=(CT_GRADES&&CT_GRADES.plans)||[], done=plans.filter(p=>p.status==='done'), imp=plans.filter(p=>p.status==='done'&&p.verdict==='تحسّن');
  const gains=done.map(p=>p.gain).filter(Number.isFinite), stud=new Set(plans.flatMap(p=>{const ms=(p.members||[]).map(m=>String(m.studentId)).filter(Boolean); return ms.length?ms:(p.studentId?[String(p.studentId)]:[]);})).size;
  const certs=(D.certificates||[]).filter(c=>c&&!c.deleted), pos=(D.behavior||[]).filter(x=>x&&!x.deleted&&x.type==='positive').length, neg=(D.behavior||[]).filter(x=>x&&!x.deleted&&x.type!=='positive').length;
  const days=Object.keys(D.participation||{}).filter(d=>Object.keys(D.participation[d]||{}).length).length;
  const cons=(D.contacts||[]).filter(c=>c&&!c.deleted), byR={}; cons.forEach(c=>byR[c.reason]=(byR[c.reason]||0)+1);
  let tests=0, exAvg=null; try{ const b=ctBook(JSON.parse(JSON.stringify(D)),sem,per); const _es=ctExamStats(b,STUDENTS||[]); tests=_es.filter(x=>x.n).length; const s=_es.filter(x=>x.n); exAvg=s.length?Math.round(s.reduce((a,x)=>a+x.pct,0)/s.length):null; }catch(e){}
  const kpi=(t,v,sub,tone='')=>`<div class="ct-kpi ${tone}"><b>${v??'—'}</b><span>${t}</span>${sub?`<small>${sub}</small>`:''}</div>`;
  const row=(a,b)=>`<div class="ct-li"><span>${a}</span><b>${b}</b></div>`;
  return `<div class="rep-info" style="margin-bottom:.6rem"><div>المعلم<b>${esc(rcGet('teacher')||'—')}</b></div><div>المادة<b>${esc(rcGet('subject')||'—')}</b></div><div>المدرسة<b>${esc(rcGet('school')||'—')}</b></div><div>الفترة<b>الفصل ${sem===1?'الأول':'الثاني'} · ${per===1?'الفترة الأولى':'الفترة الثانية'}</b></div></div>
    <div class="muted" style="font-size:.78rem;margin-bottom:.5rem">نطاق الأرقام: المستويات والخطط والاختبارات تخص الفترة المعروضة؛ الشهادات والسلوك والتواصل وأيام المشاركة تراكمية لكل الفترات</div>
    <div class="ct-kpis ct-kpis6">${kpi('الفصول',classes.length)}${kpi('الطلاب',n)}${kpi('الأنشطة',stats.length,`نسبة التسليم ${v2Pct(dn,exp)??'—'}%`)}${kpi('الخطط العلاجية',plans.length,`${imp.length} تحسّن`)}${kpi('شهادات التقدير',certs.length)}${kpi('تواصل مع أولياء الأمور',cons.length)}</div>
    <div class="cf-grid">
      <div class="ct-card"><b>📚 التدريس والأنشطة</b>${Object.entries(kinds).sort((a,b)=>b[1]-a[1]).map(([k,v])=>row(esc(k),v)).join('')}${Object.entries(kinds).length?'':row('لا أنشطة منشورة بعد','—')}${row('نسبة التسليم الكلية',(v2Pct(dn,exp)??'—')+'%')}${row('الاختبارات المرصودة في الفترة',tests)}${exAvg!=null?row('متوسط نتائج الاختبارات',exAvg+'%'):''}</div>
      <div class="ct-card"><b>📊 مستويات الطلاب (من إجاباتهم)</b>
        <div class="cf-dist" role="img" aria-label="متقن ${tot.t}، قريب ${tot.w}، يحتاج دعم ${tot.b}، لم يُقَس ${tot.u}" title="متقن ${tot.t}، قريب ${tot.w}، يحتاج دعم ${tot.b}، لم يُقَس ${tot.u}"><i class="t" style="flex:${tot.t}"></i><i class="w" style="flex:${tot.w}"></i><i class="b" style="flex:${tot.b}"></i><i class="u" style="flex:${tot.u}"></i></div>
        ${row('🟢 متقن',tot.t)}${row('🟡 قريب من الإتقان',tot.w)}${row('🔴 يحتاج دعم',tot.b)}${row('⚪ لم يُقَس',tot.u)}</div>
      <div class="ct-card"><b>🩺 المعالجة والدعم</b>${row('خطط علاجية',plans.length)}${row('طلاب شملتهم الخطط',stud)}${row('خطط مكتملة',done.length)}${row('حكمها «تحسّن» (قياس قبلي وبعدي)',imp.length)}${gains.length?row('متوسط التحسن المقاس',(v2Avg(gains)>0?'+':'')+v2Avg(gains)+' نقطة'):''}</div>
      <div class="ct-card"><b>🌟 التحفيز والانضباط</b>${row('شهادات شكر وتقدير',certs.length)}${row('ملاحظات سلوكية إيجابية',pos)}${row('ملاحظات تحتاج متابعة',neg)}${row('أيام رصد الحضور والمشاركة',days)}</div>
      ${CT_PREV?`<div class="ct-card"><b>📈 التطور مقارنة بـ${esc(CT_PREV.label)}</b>${all.map(x=>{ const a=cfStats(x.cls,ctPG); return `<div class="ct-li"><span>${esc(x.cls)}</span><span>${[cmpIt('الإتقان',a.mastery,x.mastery,'%'),cmpIt('يحتاج دعم',a.dist.b,x.dist.b,'',0,1)].filter(Boolean).join(' ')||'—'}</span></div>`; }).join('')}</div>`:''}
      <div class="ct-card"><b>📞 الشراكة مع الأسرة</b>${row('مرات التواصل الموثّقة',cons.length)}${Object.entries(byR).sort((a,b)=>b[1]-a[1]).map(([k,v])=>row(esc(k),v)).join('')}</div>
    </div>
    ${all.length?`<div class="ct-card" style="margin-top:.7rem"><b>⚖️ ملخص الفصول</b><div class="ct-table"><table class="cf-cmp"><thead><tr><th>الفصل</th><th>الطلاب</th><th>الإتقان</th><th>التسليم</th><th>الحضور</th><th>متقن</th><th>يحتاج دعم</th></tr></thead><tbody>
      ${all.map(x=>`<tr><td><b>${esc(x.cls)}</b></td><td>${x.n}</td><td>${x.mastery??'—'}${x.mastery!=null?'%':''}</td><td>${x.sub??'—'}${x.sub!=null?'%':''}</td><td>${x.att??'—'}${x.att!=null?'%':''}</td><td>${x.dist.t}</td><td>${x.dist.b}</td></tr>`).join('')}</tbody></table></div></div><div class="muted" style="font-size:.76rem;margin-top:.3rem">الإتقان: نسبة الإجابات الصحيحة مرجّحة بعدد الأسئلة · التسليم: نسبة الأنشطة المنشورة المسلّمة · الحضور: متوسط أيام الحضور من الأيام المرصودة</div>`:''}`;
}
async function ctPortfolio(box,force){
  let _pfErr=false;
  try{ await ctEnsureGrades(force); }catch(e){ _pfErr=true; }
  try{ await ctEnsurePrev(force); }catch(e){ _pfErr=true; }
  box.innerHTML=`<div class="row ct-tools no-print"><span class="muted" style="font-size:.8rem">ملخص فصلي لإنجازك محسوب من بياناتك الفعلية — يصلح لملف الأداء الوظيفي ولزيارة المشرف.</span><span class="spacer"></span>
      <button class="btn sm" onclick="ctPortfolioPrint()">🖨️ طباعة ملف الإنجاز</button></div>${_pfErr?`<div class="ct-warn" style="margin-top:.5rem">تعذّر جلب بعض البيانات من الخادم — الأرقام المعروضة قد تكون ناقصة أو قديمة.</div>`:''}${ctPortfolioBody()}`;
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
  const pages=[...document.querySelectorAll('.app-sidebar-scroll .tab')].map(b=>({t:b.innerText.replace(/\s+/g,' ').trim(),act:'tab',tab:b.dataset.tab,view:b.dataset.view||'',ic:'📄',k:'صفحة'}));
  let sel=0, items=[];
  const n=x=>typeof normAr==='function'?normAr(x):String(x||'');
  const draw=()=>{ const q=n(document.getElementById('qk-q').value).trim();
    const st=(STUDENTS||[]).filter(s=>!q||n(s.name).includes(q)).slice(0,q?8:0).map(s=>({t:s.name,ic:'👤',k:s.cls||'',act:'profile',id:s.id}));
    const cl=ctClasses().filter(c=>!q||n(c).includes(q)).slice(0,4).map(c=>({t:'ملف الفصل '+c,ic:'🏫',k:'فصل',act:'classfile',cls:c}));
    const pg=pages.filter(p=>!q||n(p.t).includes(q)).slice(0,q?6:20);
    items=[...st,...cl,...pg]; sel=Math.min(sel,Math.max(0,items.length-1));
    document.getElementById('qk-list').innerHTML=items.map((x,i)=>`<button type="button" data-i="${i}" class="${i===sel?'on':''}">${x.ic} ${esc(x.t)}<small>${esc(x.k)}</small></button>`).join('')||'<div class="muted" style="padding:.8rem">لا نتائج.</div>'; };
  const close=()=>{ v.remove(); document.removeEventListener('keydown',key,true); };
  /* 🔐 إصلاح أمني: أفعال منظمة بدل نصوص كود كانت تُنفَّذ بـ new Function —
     اسم فصل/معرف فيه علامة اقتباس كان يحقن كودًا بصلاحيات المعلم */
  const run=i=>{ const x=items[i]; if(!x) return; close(); try{
    if(x.act==='tab') goTab(x.view?`${x.tab}:${x.view}`:x.tab);
    else if(x.act==='profile') ctOpenProfile(x.id);
    else if(x.act==='classfile'){ window._ctCfCls=x.cls; ctGo('classfile'); }
  }catch(e){ console.warn(e); } };
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
