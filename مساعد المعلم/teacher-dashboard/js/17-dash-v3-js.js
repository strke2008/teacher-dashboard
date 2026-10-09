/* ═════════ 🔬 تحليل الفقرات: الصعوبة والتمييز والبدائل والثبات ═════════
   الصعوبة p = نسبة من أجاب صحيحًا · التمييز D = p(أعلى 27%) − p(أدنى 27%) بحسب الدرجة الكلية
   الثبات KR-20 للأسئلة ثنائية التصحيح. المعايير الشائعة في القياس التربوي. */
function iaQTitle(q){ const k=q.t||'q';
  return k==='a'?('رتّب الحروف: '+(q.w||'')):k==='s'?('رتّب الجملة: '+String(q.s||'').slice(0,50)):k==='m'?('وصّل: '+(((q.p||[])[0]||[''])[0])+' …'):String(q.q||''); }
function iaBuild(h,cls){
  const qs=h.qs||[], k=qs.length;
  const rows=Object.entries(h.subs||{}).map(([sid,v])=>({s:byId(sid),v,d:String(v&&v.d||'')})).filter(r=>r.s&&r.d.length===k&&(!cls||String(r.s.cls||'')===cls));
  rows.forEach(r=>r.tot=[...r.d].filter(c=>c==='1').length);
  rows.sort((a,b)=>b.tot-a.tot);
  const n=rows.length, g=n>=6?Math.max(2,Math.round(n*0.27)):0, up=rows.slice(0,g), lo=g?rows.slice(-g):[];
  const pOf=(set,i)=>set.length?set.filter(r=>r.d[i]==='1').length/set.length:null;
  const items=qs.map((q,i)=>{
    const p=pOf(rows,i), D=g?pOf(up,i)-pOf(lo,i):null, kd=q.t||'q';
    let dist=null;
    if(kd==='q'&&Array.isArray(q.o)){ dist=q.o.map((o,j)=>{ const c=set=>set.filter(r=>Array.isArray(r.v.ans)&&r.v.ans[i]===j).length; return {o,j,key:j===q.a,all:c(rows),up:c(up),lo:c(lo)}; }); }
    const pv=p==null?null:p<0.25?['bad','صعب جدًا']:p>0.9?['warn','سهل جدًا']:p<0.35||p>0.8?['ok','مقبول']:['good','مناسب'];
    const dv=D==null?null:D<0?['bad','سالب — راجع مفتاح الإجابة']:D<0.2?['bad','ضعيف']:D<0.3?['warn','مقبول']:D<0.4?['ok','جيد']:['good','ممتاز'];
    const notes=[];
    if(dist){ dist.filter(x=>!x.key&&x.all===0&&n>=10).forEach(x=>notes.push(`البديل «${x.o}» لم يختره أحد — بديل غير فعّال`));
      dist.filter(x=>!x.key&&g&&x.up>x.lo&&x.up>0).forEach(x=>notes.push(`البديل «${x.o}» جذب المتفوقين أكثر من غيرهم — قد يكون صحيحًا أيضًا أو غامضًا`)); }
    let rec='إبقاء', rk='good';
    if(D!=null&&D<0){ rec='مراجعة المفتاح أو حذف'; rk='bad'; }
    else if((D!=null&&D<0.2)||(p!=null&&(p<0.2||p>0.95))){ rec='تعديل الصياغة أو البدائل'; rk='warn'; }
    return {q,i,kd,p,D,pv,dv,dist,notes,rec,rk};
  });
  // الثبات KR-20
  let kr=null; if(n>=5&&k>=3){ const m=rows.reduce((a,r)=>a+r.tot,0)/n, vr=rows.reduce((a,r)=>a+(r.tot-m)**2,0)/n;
    const spq=items.reduce((a,x)=>a+(x.p||0)*(1-(x.p||0)),0); if(vr>0) kr=k/(k-1)*(1-spq/vr); }
  const mean=n?rows.reduce((a,r)=>a+r.tot,0)/n:0, sd=n?Math.sqrt(rows.reduce((a,r)=>a+(r.tot-mean)**2,0)/n):0;
  return {h,cls,k,n,g,items,kr,mean,sd};
}
function iaBody(A,print){
  const pct=x=>x==null?'—':Math.round(x*100)+'%', f2=x=>x==null?'—':(Math.round(x*100)/100).toFixed(2);
  const chip=v=>v?`<span class="ia-chip ${v[0]}">${v[1]}</span>`:'—';
  const krV=A.kr==null?null:A.kr<0?['bad','غير قابل للتفسير — العينة صغيرة أو الأسئلة متعارضة']:A.kr>=0.8?['good','مرتفع']:A.kr>=0.7?['ok','جيد']:A.kr>=0.5?['warn','مقبول']:['bad','منخفض'];
  const cnt=k=>A.items.filter(x=>x.rk===k).length;
  return `<div class="ct-kpis ct-kpis6">
      <div class="ct-kpi"><b>${A.n}</b><span>طالب مُحلَّل</span><small>${A.g?`المجموعتان العليا والدنيا: ${A.g} لكل منهما`:'التمييز يحتاج 6 طلاب فأكثر'}</small></div>
      <div class="ct-kpi"><b>${A.k}</b><span>سؤال</span></div>
      <div class="ct-kpi"><b>${(Math.round(A.mean*10)/10)}/${A.k}</b><span>المتوسط</span><small>الانحراف المعياري ${(Math.round(A.sd*10)/10)}</small></div>
      <div class="ct-kpi ${krV?krV[0]==='good'?'tick':krV[0]==='bad'?'bad':'warn':''}"><b>${f2(A.kr)}</b><span>الثبات (KR-20)</span><small>${krV?krV[1]:'يحتاج 5 طلاب و3 أسئلة'}</small></div>
      <div class="ct-kpi tick"><b>${cnt('good')}</b><span>أسئلة جيدة</span></div>
      <div class="ct-kpi ${cnt('bad')?'bad':'warn'}"><b>${cnt('warn')+cnt('bad')}</b><span>تحتاج مراجعة</span></div></div>
    <div class="ct-table" style="margin-top:.6rem"><table class="ia-tbl"><thead><tr><th>م</th><th>السؤال</th><th>الصعوبة (p)</th><th>التمييز (D)</th><th>التوصية</th></tr></thead><tbody>
    ${A.items.map(x=>`<tr><td>${x.i+1}</td><td class="q">${esc(iaQTitle(x.q)).slice(0,160)}
        ${x.dist?`<div class="ia-dist">${x.dist.map(d=>`<span class="${!d.key&&d.all===0?'dead':''}">${d.key?'<b class="key">✓ ':''}${esc(String(d.o).slice(0,30))}: ${d.all}${A.g?` (عليا ${d.up} · دنيا ${d.lo})`:''}${d.key?'</b>':''}</span>`).join(' · ')}</div>`:''}
        ${x.notes.map(t=>`<div class="ia-dist" style="color:#8a6200">⚠️ ${esc(t)}</div>`).join('')}</td>
      <td>${pct(x.p)}<br>${chip(x.pv)}</td><td>${f2(x.D)}<br>${chip(x.dv)}</td><td><span class="ia-chip ${x.rk}">${x.rec}</span></td></tr>`).join('')}
    </tbody></table></div>
    <div class="muted" style="font-size:.74rem;margin-top:.5rem;line-height:1.8">
      <b>طريقة القراءة:</b> الصعوبة = نسبة من أجاب صحيحًا (المناسب 35%–80%). التمييز = الفرق بين نسبة الصواب في أعلى 27% وأدنى 27% من الطلاب بحسب درجاتهم
      (0.40 فأكثر ممتاز · 0.30 جيد · 0.20 مقبول · أقل ضعيف · السالب يعني أن الضعاف أجابوا أفضل من المتفوقين فراجع المفتاح).
      الثبات KR-20: 0.70 فأكثر جيد للاختبارات الصفية. يُحسب من التسليمات المكتملة فقط.</div>`;
}
function openItemAnalysis(id,cls){
  const h=HW.find(x=>String(x.id)===String(id)); if(!h) return;
  if(!(h.qs||[]).length){ toast('لا أسئلة في هذا النشاط','bad'); return; }
  window._iaId=id; window._iaCls=cls||'';
  const A=iaBuild(h,cls||''), classes=[...new Set(Object.keys(h.subs||{}).map(s=>byId(s)?.cls).filter(Boolean))].sort();
  openModal(`<h2>🔬 تحليل الفقرات — ${esc(h.title)}</h2>
    <div class="row" style="gap:.5rem;margin:.2rem 0 .6rem">${classes.length>1?`<select class="inp" style="width:auto" onchange="openItemAnalysis('${esc(id)}',this.value)"><option value="">كل الفصول</option>${classes.map(c=>`<option ${c===cls?'selected':''}>${esc(c)}</option>`).join('')}</select>`:''}
      <span class="spacer"></span><button class="btn sm" onclick="iaPrint()">🖨️ طباعة التحليل</button></div>
    ${A.n?iaBody(A):'<div class="feature-empty">لا تسليمات مكتملة لتحليلها.</div>'}
    <div class="modal-foot"><button class="btn ghost" onclick="openReport('${esc(id)}')">→ تقرير النشاط</button><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`);
  document.getElementById('modal')?.classList.add('activity-report-modal');
}
function iaPrint(){
  const h=HW.find(x=>String(x.id)===String(window._iaId)); if(!h) return; ensureLogo();
  const A=iaBuild(h,window._iaCls||'');
  let box=document.getElementById('plan-print'); if(!box){ box=document.createElement('div'); box.id='plan-print'; box.className='rep'; document.body.appendChild(box); }
  box.innerHTML=`<div class="rep-page plan-doc ct-pf-print">${repHead('تحليل فقرات: '+h.title+(A.cls?' — '+A.cls:''),'تحليل')}<div class="rep-in">${iaBody(A,true)}
    <div class="plan-sign"><div>معلم المادة<b>${esc(rcGet('teacher')||'')}</b><span>التوقيع: ....................</span></div>
      <div>مدير المدرسة<b>${esc(rcGet('principal')||'')||'&nbsp;'}</b><span>التوقيع: ....................</span></div></div></div></div>`;
  closeModal();
  unifiedA4Print({bodyClass:'printing-plans',title:'تحليل الفقرات',selector:'#plan-print',orientation:'portrait',margin:'8mm'});
}

/* ═════════ 📈 مقارنة الفترات: الفترة الحالية بالسابقة لها ═════════ */
let CT_PREV=null;
function ctPrevSP(){ const {sem,per}=ctSem(); return per===2?{sem,per:1,label:`الفترة الأولى`}:sem===2?{sem:1,per:2,label:'الفترة الثانية من الفصل الأول'}:null; }
async function ctEnsurePrev(force){
  const P=ctPrevSP(); if(!P){ CT_PREV=null; return null; }
  const key=P.sem+':'+P.per; if(!force&&CT_PREV&&CT_PREV.key===key) return CT_PREV;
  try{ const g=await loadServerGrades(false,P.sem,P.per); CT_PREV={key,label:P.label,map:(g&&g.map)||{},plans:(g&&g.plans)||[]}; }
  catch(e){ CT_PREV=null; }
  // نعيد مخزن التقارير إلى الفترة الحالية (من الذاكرة) كي لا تتأثر صفحات التقارير
  try{ const {sem,per}=ctSem(); await loadServerGrades(false,sem,per); }catch(e){}
  return CT_PREV;
}
function ctPG(sid){ return (CT_PREV&&CT_PREV.map&&CT_PREV.map[String(sid)])||{}; }
function cmpIt(label,a,b,unit,dec,inv){ // inv: الزيادة سيئة (مثل «يحتاج دعم»)
  if(a==null||b==null||!Number.isFinite(a)||!Number.isFinite(b)) return '';
  const d=Math.round((b-a)*(dec?10:1))/(dec?10:1), good=inv?d<0:d>0, bad=inv?d>0:d<0, cls=good?'up':bad?'dn':'eq', ar=d>0?'▲':d<0?'▼':'●';
  return `<span class="cmp-it">${label}: ${a}${unit} ← <b>${b}${unit}</b> <span class="${cls}">${ar}${d>0?'+':''}${d}</span></span>`;
}
function ctCmpStudentHTML(sid){
  if(!CT_PREV) return '';
  const a=ctPG(sid), b=ctG(sid), m=(g,k,f)=>g[k]&&g[k].measured?f(g[k]):null;
  const items=[cmpIt('الإتقان',m(a,'level',x=>x.rate),m(b,'level',x=>x.rate),'%'),
    cmpIt('الاختبارات',m(a,'exam',x=>x.score),m(b,'exam',x=>x.score),'',1),
    cmpIt('المشاركة',m(a,'participation',x=>x.score),m(b,'participation',x=>x.score),'',1),
    cmpIt('الواجبات',m(a,'homework',x=>x.score),m(b,'homework',x=>x.score),'',1),
    cmpIt('السلوك',m(a,'behavior',x=>x.score),m(b,'behavior',x=>x.score),'',1),
    cmpIt('الحضور',m(a,'attendance',x=>x.rate),m(b,'attendance',x=>x.rate),'%')].filter(Boolean);
  return items.length?`<div class="cmp-row"><span class="cmp-h">📈 مقارنة بـ${esc(CT_PREV.label)}:</span>${items.join('')}</div>`:'';
}
function ctCmpClassHTML(cls){
  if(!CT_PREV) return '';
  const a=cfStats(cls,ctPG), b=cfStats(cls);
  const items=[cmpIt('الإتقان',a.mastery,b.mastery,'%'),cmpIt('الحضور',a.att,b.att,'%'),cmpIt('المشاركة',a.part,b.part,'',1),cmpIt('الواجبات',a.hw,b.hw,'',1),cmpIt('السلوك',a.beh,b.beh,'',1),cmpIt('الاختبارات',a.exam,b.exam,'',1),
    cmpIt('يحتاج دعم',a.dist.b,b.dist.b,'',0,1),cmpIt('متقن',a.dist.t,b.dist.t,'')].filter(Boolean);
  return items.length?`<div class="cmp-row"><span class="cmp-h">📈 مقارنة بـ${esc(CT_PREV.label)}:</span>${items.join('')}</div>`:'';
}

