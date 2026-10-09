/* ═══ ⚙️ الإعدادات: تبويبات داخلية — كل قسم مستقل بدل صفحة طويلة. لا يُحذف شيء: «الكل» يعرض كل الأقسام كما كانت ═══ */
(function settingsTabsInit(){
  const pd=document.getElementById('p-data'); if(!pd||pd.querySelector('.set-tabs')) return;
  const CATS=[['year','📅 السنة الدراسية',['السنة الدراسية']],['school','🏫 المدرسة والمظهر',['بيانات المدرسة','مظهر التطبيق']],['ai','🤖 الذكاء الاصطناعي',['الذكاء الاصطناعي']],
    ['students','👥 الطلاب والنقل',['نقل الطلاب','طرق استيراد','استعادة طالب']],
    ['links','🔗 الروابط والخادم والإشعارات',['الإشعارات','رابط صفحة','رابط بوابة','الخادم']],
    ['backup','💾 النسخ والتنظيف',['النسخ الاحتياطية','تنظيف']],['danger','⛔ منطقة الخطر',['منطقة الخطر']]];
  let cur='year';
  [...pd.children].forEach(el=>{
    const h=(el.querySelector('h2')?.textContent||'').trim();
    const c=h&&CATS.find(([,,keys])=>keys.some(k=>h.includes(k)));
    if(c) cur=c[0];
    el.dataset.setcat=cur;
  });
  const bar=document.createElement('div'); bar.className='set-tabs no-print';
  bar.innerHTML=CATS.map(([k,l])=>`<button type="button" data-set="${k}" class="${k==='danger'?'danger':''}">${l}</button>`).join('')+'<button type="button" data-set="all">☰ الكل</button>';
  pd.prepend(bar);
  function setCat(k){
    [...pd.children].forEach(el=>{ if(el===bar) return; el.classList.toggle('set-off', k!=='all' && el.dataset.setcat!==k); });
    bar.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b.dataset.set===k));
    try{ localStorage.setItem('dash_set_cat_v1',k); }catch(e){}
  }
  window.settingsCat=setCat;
  bar.addEventListener('click',e=>{ const b=e.target.closest('[data-set]'); if(b) setCat(b.dataset.set); });
  let first='school'; try{ first=localStorage.getItem('dash_set_cat_v1')||'school'; }catch(e){}
  if(first==='danger') first='school';
  setCat(CATS.some(c=>c[0]===first)||first==='all'?first:'school');
  // أي انتقال برمجي إلى قسم في الإعدادات (مثل فتح إعدادات الإشعارات) يُظهر تبويبه أولًا
  const orig=Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView=function(){
    try{ if(pd.contains(this)){ const sec=[...pd.children].find(c=>c.contains(this)); if(sec&&sec.classList.contains('set-off')) setCat(sec.dataset.setcat); } }catch(e){}
    return orig.apply(this,arguments);
  };
})();

/* ═══ 👤 كل المداخل القديمة لملف/تقرير الطالب تفتح الملف الموحّد على التبويب المناسب ═══ */
const _legacyStudentProfile=openStudentProfile, _legacyStudentReport=studentReport;
openStudentProfile=function(id){ if(byId(id)) ctOpenProfile(id,'acts'); };
studentReport=function(sid){ if(byId(sid)) ctOpenProfile(sid,'report'); };

/* ═══ 🏠 اليوم: حصص اليوم + ما يحتاج قرارك + بحث سريع يفتح الملف الشامل ═══ */
let TH_AT=0, TH_BUSY=false;
function thEsc(x){ return typeof esc==='function'?esc(x):String(x??''); }
function thSearch(){
  const q=document.getElementById('th-q'), out=document.getElementById('th-res'); if(!q||!out) return;
  const n=v=>typeof normAr==='function'?normAr(v):String(v||'');
  const t=n(q.value).trim();
  if(!t){ out.innerHTML=''; return; }
  const list=(STUDENTS||[]).filter(s=>n(`${s.name||''} ${s.cls||''}`).includes(t)).slice(0,6);
  out.innerHTML=list.map(s=>`<button type="button" onclick="ctOpenProfile('${thEsc(s.id)}')" title="الملف الشامل">👤 ${thEsc(s.name)}<small>${thEsc(s.cls||'')}</small></button>`).join('')
    ||'<div class="muted" style="font-size:.8rem">لا يوجد طالب بهذا الاسم.</div>';
}
function thActions(){
  const out=[];
  const plans=((typeof CT_GRADES!=='undefined'&&CT_GRADES&&CT_GRADES.plans)||(typeof PLAN_DATA!=='undefined'&&PLAN_DATA&&PLAN_DATA.plans)||[]).filter(p=>p.status!=='done');
  const need=plans.filter(p=>p.timing&&p.timing.expired).length;
  const soon=plans.filter(p=>p.timing&&!p.timing.expired&&p.timing.left!=null&&p.timing.left<=3).length;
  if(need) out.push(['bad','🩺',`${need} ${need===1?'خطة علاجية انتهت مدتها وتنتظر قرارك':'خطط علاجية انتهت مدتها وتنتظر قرارك'}`,need,"goTab('plans')"]);
  if(soon) out.push(['warn','⏳',`${soon} ${soon===1?'خطة تنتهي':'خطط تنتهي'} خلال 3 أيام`,soon,"goTab('plans')"]);
  if(typeof CT_DATA!=='undefined'&&CT_DATA){
    let al=[]; try{ al=ctAlertsOpen(''); }catch(e){}
    const bad=al.filter(a=>a.lvl==='bad').length, warn=al.length-bad;
    if(bad) out.push(['bad','🚫',`${bad===1?'طالب غائب':bad+' طلاب غائبون'} 3 أيام متتالية أو أكثر — اضغط لعرض الأسماء`,bad,"thShowAlerts('bad')"]);
    if(warn){ const k=t=>al.filter(a=>a.lvl==='warn'&&a.t.includes(t)).length, parts=[[k('غياب'),'غياب'],[k('الواجب'),'واجبات'],[k('لم يشارك'),'مشاركة']].filter(x=>x[0]).map(x=>`${x[1]} ${x[0]}`);
      out.push(['warn','⚠️',`طلاب يحتاجون متابعة (${parts.join(' · ')}) — اضغط لعرض الأسماء`,warn,"thShowAlerts('warn')"]); }
  }
  try{ const pend=(typeof REQS!=='undefined'&&Array.isArray(REQS))?REQS.length:0; if(pend) out.push(['warn','💌',`${pend===1?'طالب اشترى':pend+' طلاب اشتروا'} «رسالة شكر لولي الأمر» من المتجر — بانتظار إرسالك`,pend,"thGoReqs()"]); }catch(e){}
  /* تنبيهات الأنشطة نفسها التي في «تفاصيل المتابعة» أسفل الصفحة — مجمّعة بنوعها */
  try{ const A=dashboardAlerts()||[];
    const over=A.filter(a=>/لم يسلّم|لم يلعب/.test(a.title||'')), soon=A.filter(a=>/موعد قريب/.test(a.title||'')), pub=A.filter(a=>/إعادة نشر|بلا مهام|غير مكتمل/.test(a.title||'')), fast=A.filter(a=>String(a.icon)==='⚡');
    const miss=over.reduce((n,a)=>n+((a.students||[]).length),0);
    // نشاط واحد يكفيه «ابدأ بمتابعة» أعلى البطاقة؛ عند أكثر من نشاط نعرض المجموع
    if(over.length>1) out.push(['bad','⏰',`${over.length} أنشطة انتهت مواعيدها — مجموع ما لم يُسلَّم ${miss}`,over.length,"thGoTo('dash-alerts')"]);
    if(soon.length) out.push(['warn','⏳',`${soon.length===1?'نشاط ينتهي':soon.length+' أنشطة تنتهي'} خلال يومين ولم يكتمل التسليم`,soon.length,"thGoTo('dash-alerts')"]);
    if(pub.length) out.push(['warn','🔄','أنشطة تحتاج نشرًا أو إكمال محتوى',pub.length,"thGoTo('dash-alerts')"]);
    if(fast.length) out.push(['warn','⚡','تسليمات بسرعة مريبة تحتاج مراجعة',fast.length,"thGoTo('dash-alerts')"]); }catch(e){}
  try{ const late=(STUDENTS||[]).filter(s=>!isFollowupHandled(s)&&getStudentMissingActivities(s).length).length;
    if(late) out.push(['warn','📨',`${late===1?'طالب متأخر لم تذكّره':late+' طلاب متأخرون لم تذكّرهم'} — ذكّرهم دفعة واحدة`,late,"openBulkReminder()"]); }catch(e){}
  try{ const sp=(Array.isArray(STORE_PURCHASES)?STORE_PURCHASES:[]).filter(isStorePurchaseNew).length; if(sp) out.push(['info','🛒',`${sp===1?'عملية شراء جديدة':sp+' عمليات شراء جديدة'} من متجر الطلاب`,sp,"thGoTo('store-purchases-panel')"]); }catch(e){}
  try{ const dv=devPending().length; if(dv) out.push(['bad','🚩',`${dv===1?'جهاز واحد مستخدم':dv+' أجهزة مستخدمة'} لأكثر من طالب — اضغط للتحقق`,dv,"thShowDevices()"]); }catch(e){}
  const rank={bad:0,warn:1,info:2}; out.sort((a,b)=>rank[a[0]]-rank[b[0]]);
  return out;
}
/* تنبيهات الانضباط من كل الفصول في نافذة واحدة: الاسم والفصل والسبب، ومنها مباشرة إلى الملف أو سجل الفصل */
function thShowAlerts(lvl){
  let all=[]; try{ all=ctAlerts(''); }catch(e){}
  if(lvl) all=all.filter(a=>a.lvl===lvl);
  const al=all.filter(fuOpen), done=all.filter(a=>!fuOpen(a));
  window._fuCur=al.map(a=>({sid:String(a.s.id),type:a.type}));
  // صف واحد لكل طالب يجمع أسبابه (غياب · واجب · مشاركة) بدل تكراره
  const per=new Map(); al.forEach(a=>{ const k=String(a.s.id); const g=per.get(k)||{s:a.s,items:[],lvl:'warn'}; g.items.push(a); if(a.lvl==='bad') g.lvl='bad'; per.set(k,g); });
  const byCls={}; [...per.values()].forEach(g=>{ const c=String(g.s.cls||'بدون فصل'); (byCls[c]=byCls[c]||[]).push(g); });
  const clsList=Object.keys(byCls).sort((a,b)=>a.localeCompare(b,'ar',{numeric:true}));
  const it=g=>JSON.stringify(g.items.map(a=>({sid:String(a.s.id),type:a.type}))).replace(/"/g,'&quot;');
  const grp=c=>JSON.stringify(byCls[c].flatMap(g=>g.items.map(a=>({sid:String(a.s.id),type:a.type})))).replace(/"/g,'&quot;');
  const again=`thShowAlerts('${lvl||''}')`;
  openModal(`<h2>${lvl==='bad'?'🚫 غياب متتالٍ':'⚠️ طلاب يحتاجون متابعة'}</h2>
    <p class="muted" style="font-size:.84rem;margin:.2rem 0 .8rem">محسوبة من رصد الحضور والواجب والمشاركة. بعد أن تتابع الطالب اضغط
    <b>«📞 تواصلت»</b> (يُسجَّل في ملفه ضمن التواصل مع ولي الأمر) أو <b>«✓ تابعته»</b> — فيختفي على كل أجهزتك ولا يعود إلا إذا <b>تكرر منه</b> بعد اليوم.</p>
    ${clsList.length?clsList.map(c=>`<div class="th-al-cls"><div class="th-al-h"><b>🎓 ${thEsc(c)}</b><span class="muted">${byCls[c].length} ${byCls[c].length===1?'طالب':'طلاب'}</span>
        <button type="button" class="btn ghost sm" onclick="fuMark(JSON.parse(this.dataset.it)).then(()=>${again})" data-it="${grp(c)}">✓ تابعتهم جميعًا</button>
        <button type="button" class="btn ghost sm" onclick="closeModal();thOpenRecords('${thEsc(c)}')">🗂️ السجل</button></div>
      ${byCls[c].map(g=>`<div class="th-al fu-row ${g.lvl}"><span><b>${thEsc(g.s.name)}</b><small>${g.items.map(a=>thEsc(a.t)).join(' · ')}</small></span>
        <span class="fu-acts"><button type="button" class="btn tick sm" title="سجّل أنك تواصلت مع ولي أمره" onclick="fuMark(JSON.parse(this.dataset.it),'اتصال').then(()=>${again})" data-it="${it(g)}">📞 تواصلت</button>
        <button type="button" class="btn ghost sm" title="تابعته دون تواصل مع ولي الأمر" onclick="fuMark(JSON.parse(this.dataset.it)).then(()=>${again})" data-it="${it(g)}">✓ تابعته</button>
        <button type="button" class="btn ghost sm" onclick="ctOpenProfile('${thEsc(g.s.id)}')" title="الملف الشامل">👤</button></span></div>`).join('')}</div>`).join('')
      :'<div class="feature-empty">لا تنبيهات تحتاج متابعتك الآن 🌿</div>'}
    ${done.length?`<details style="margin-top:.6rem"><summary class="muted" style="cursor:pointer">✓ تمت متابعتهم (${done.length}) — يعودون فقط إذا تكرر منهم</summary>
      ${done.map(a=>`<div class="th-al"><span><b>${thEsc(a.s.name)}</b><small>${thEsc(a.t)} · تابعته ${fuDay(fuAt(a.s.id,a.type))}</small></span>
        <button type="button" class="btn ghost sm" onclick="fuUndo('${thEsc(a.s.id)}','${a.type}').then(()=>${again})">↩️ إلغاء</button></div>`).join('')}</details>`:''}
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`);
}
function thOpenRecords(cls){ window._ctRcCls=cls; window._ctRcView='month'; window._ctAlOpen=true; ctGo('records'); }
/* 🚩 الأجهزة المشتركة: نافذة تعرض كل جهاز وطلابه وأنشطتهم، ويُعلَّم الجهاز «تحققت» فلا يعود التنبيه
   إلا إذا دخل منه طالب جديد (المفتاح = الجهاز + أسماء طلابه) */
const DEV_OK_KEY='dash_dev_ok_v1';
function devOkList(){ let L=[]; try{ L=JSON.parse(localStorage.getItem(DEV_OK_KEY)||'[]'); }catch(e){}
  const srv=(typeof CT_DATA!=='undefined'&&CT_DATA&&Array.isArray(CT_DATA.devOk))?CT_DATA.devOk:[]; return [...new Set([...L,...srv])]; }
function devSig(x){ return x.dv+'|'+x.names.map(n=>n[0]).sort().join('،'); }
function devPending(){ const ok=new Set(devOkList()); return deviceAudit().filter(x=>!ok.has(devSig(x))); }
async function devMarkOk(sig,quiet){ const L=devOkList(); if(!L.includes(sig)) L.push(sig); try{ localStorage.setItem(DEV_OK_KEY,JSON.stringify(L.slice(-300))); }catch(e){}
  try{ await ctSave(D=>{ D.devOk=Array.isArray(D.devOk)?D.devOk:[]; if(!D.devOk.includes(sig)) D.devOk.push(sig); D.devOk=D.devOk.slice(-300); }); }catch(e){}
  if(!quiet){ thShowDevices(); try{ thDraw(); }catch(e){} } }
async function devUnmark(sig){ try{ localStorage.setItem(DEV_OK_KEY,JSON.stringify(devOkList().filter(x=>x!==sig))); }catch(e){}
  try{ await ctSave(D=>{ D.devOk=(Array.isArray(D.devOk)?D.devOk:[]).filter(x=>x!==sig); }); }catch(e){}
  thShowDevices(true); try{ thDraw(); }catch(e){} }
function thShowDevices(showOk){
  const ok=new Set(devOkList()), all=deviceAudit(), pend=all.filter(x=>!ok.has(devSig(x))), done=all.filter(x=>ok.has(devSig(x)));
  const stu=nm=>(STUDENTS||[]).find(s=>s.name===nm)||(STUDENTS||[]).find(s=>normAr(s.name)===normAr(nm));
  const card=(x,i,isOk)=>{ const sig=devSig(x), sameCls=new Set(x.names.map(([nm])=>String(stu(nm)?.cls||''))).size===1;
    return `<div class="th-al-cls"><div class="th-al-h"><b>📱 جهاز ${i+1}</b><span class="muted">${x.names.length===2?'طالبان':x.names.length+' طلاب'}${sameCls?' · من الفصل نفسه':' · من فصول مختلفة (غالبًا إخوة)'}</span>
      ${isOk?`<button type="button" class="btn ghost sm" onclick='devUnmark(${JSON.stringify(sig)})'>↩️ إعادة للتنبيه</button>`:`<button type="button" class="btn tick sm" onclick='devMarkOk(${JSON.stringify(sig)})'>✓ تحققت — لا مشكلة</button>`}</div>
      ${x.names.map(([nm,acts])=>{ const s=stu(nm), u=[...new Set(acts)];
        return `<div class="th-al ${isOk?'':'bad'}"><span><b>${thEsc(nm)}</b><small>${thEsc(s?.cls||'')} · ${u.length} ${u.length===1?'نشاط':'أنشطة'}: ${thEsc(u.slice(0,4).join('، '))}${u.length>4?'…':''}</small></span>
          ${s?`<button type="button" class="btn ghost sm" onclick="ctOpenProfile('${thEsc(s.id)}','report')">📄 إجاباته</button>`:''}</div>`; }).join('')}</div>`; };
  openModal(`<h2>🚩 جهاز واحد لأكثر من طالب</h2>
    <p class="muted" style="font-size:.84rem;margin:.2rem 0 .8rem">كل جهاز يُعرف ببصمته عند التسليم. إن سلّم منه أكثر من طالب فقد يكونون <b>إخوة على جوال واحد</b> — وهذا طبيعي —
    وقد يكون <b>حلًّا نيابة عن زميل</b>. قارن إجاباتهم من «📄 إجاباته»، ثم اضغط «تحققت» ليختفي التنبيه <b>على كل أجهزتك</b> (يعود فقط إن سلّم من الجهاز طالب جديد).</p>
    ${pend.length?pend.map((x,i)=>card(x,i,false)).join(''):'<div class="feature-empty">لا أجهزة تحتاج تحققًا 🌿</div>'}
    ${done.length?`<details style="margin-top:.6rem" ${showOk?'open':''}><summary class="muted" style="cursor:pointer">✓ أجهزة تحققت منها (${done.length})</summary>${done.map((x,i)=>card(x,i,true)).join('')}</details>`:''}
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`);
}
/* انتقال إلى قسم في «تفاصيل المتابعة» أسفل الرئيسية مع إبرازه */
function thGoTo(id){
  if(!document.getElementById('p-dashboard')?.classList.contains('on')) goTab('dashboard');
  setTimeout(()=>{ const el=document.getElementById(id); if(!el) return; const dt=el.closest('details'); if(dt) dt.open=true; const box=el.closest('.sheet')||el;
    box.scrollIntoView({behavior:'smooth',block:'start'}); box.classList.remove('th-flash'); void box.offsetWidth; box.classList.add('th-flash'); }, 120);
}
/* طلبات رسائل الشكر معروضة في «يحتاج انتباهك» أسفل الرئيسية — ننزل إليها ونُبرزها */
function thGoReqs(){
  if(!document.getElementById('p-dashboard')?.classList.contains('on')) goTab('dashboard');
  setTimeout(()=>{ const el=document.getElementById('attention-requests'); if(!el) return; const dt=el.closest('details'); if(dt) dt.open=true;
    el.scrollIntoView({behavior:'smooth',block:'center'});
    el.classList.remove('th-flash'); void el.offsetWidth; el.classList.add('th-flash'); }, 120);
}
/* ═══ 🏠 اليوم: شريط «الآن» · أرقام اليوم · مهام اليوم (قائمة واحدة) ═══ */
const TD_DONE_KEY='dash_task_done_v1';
function tdDone(){ try{ return JSON.parse(localStorage.getItem(TD_DONE_KEY)||'{}')||{}; }catch(e){ return {}; } }
function tdMarkDone(k){ const d=tdDone(), now=Date.now(); d[k]=now; Object.keys(d).forEach(x=>{ if(now-d[x]>21*864e5) delete d[x]; });
  try{ localStorage.setItem(TD_DONE_KEY,JSON.stringify(d)); }catch(e){} thDraw(); }
async function tdAckAll(kind){
  const msg=kind==='dev'?'تُعلَّم كل الأجهزة المشتركة الحالية «تحققت». يعود التنبيه فقط إذا سلّم من أحدها طالب جديد.'
    :kind==='ns'?'تُسجَّل متابعة كل من لم يبدأ. يعود الطالب فقط إذا نُشر له نشاط جديد ولم يبدأ.'
    :'تُسجَّل متابعة كل الطلاب في هذا التنبيه. يعود الطالب فقط إذا تكرر منه بعد اليوم (غياب أو واجب أو مشاركة جديدة).';
  if(!(await askConfirm(msg,{title:'تمت متابعتهم جميعًا؟',yes:'نعم، تابعتهم',no:'إلغاء'}))) return;
  if(kind==='dev'){ for(const x of devPending()) await devMarkOk(devSig(x),true); try{ thDraw(); }catch(e){} return; }
  if(kind==='ns') return fuMark(nsOpenList().map(x=>({sid:String(x.s.id),type:'ns'})));
  let al=[]; try{ al=ctAlertsOpen('').filter(a=>a.lvl===kind); }catch(e){}
  return fuMark(al.map(a=>({sid:String(a.s.id),type:a.type})));
}
function tdUndoAll(){ try{ localStorage.removeItem(TD_DONE_KEY); }catch(e){} thDraw(); }
/* أوقات الحصص بنفس حساب بوابة المعلم: بداية الأولى + المدة + الفسح، والحصة المعدّلة يدويًا تتجاوز الحساب */
function tdTimes(sc){
  const d={dur:45,gap:0,count:7,breakAfter:3,breakLen:30,prayAfter:6,prayLen:20}, s=Object.assign({},d,sc||{});
  ['dur','gap','count','breakAfter','breakLen','prayAfter','prayLen'].forEach(k=>{ if(typeof s[k]!=='number') s[k]=d[k]; });
  const pre=Object.assign({summer:'07:00',winter:'07:15'},s.presets||{}), act=s.active==='winter'?'winter':'summer';
  const hm=t=>{ const p=String(t||'07:00').split(':'); return (+p[0]||0)*60+(+p[1]||0); }, mm=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
  const base=hm(pre[act]), fix=s.fix||{}, out=[];
  for(let n=1;n<=s.count;n++){
    let st=base+(n-1)*(s.dur+s.gap)+(n>s.breakAfter?s.breakLen:0)+((s.prayAfter>0&&n>s.prayAfter)?s.prayLen:0), en=st+s.dur;
    const f=fix[String(n)]; if(f&&f.s){ st=hm(f.s); en=f.e?hm(f.e):st+s.dur; }
    out.push({n,sm:st,em:en,s:mm(st),e:mm(en)});
  }
  return out;
}
function tdKsaNow(){ const d=new Date(Date.now()+3*3600000); return {dow:d.getUTCDay(), min:d.getUTCHours()*60+d.getUTCMinutes(), day:d.toISOString().slice(0,10)}; }
function tdDateLabel(){
  const now=new Date(), tz={timeZone:'Asia/Riyadh'};
  try{ const g=now.toLocaleDateString('ar-SA-u-ca-gregory',{...tz,weekday:'long',day:'numeric',month:'long'});
    const h=now.toLocaleDateString('ar-SA-u-ca-islamic-umalqura',{...tz,day:'numeric',month:'long'}); return `${g} · ${h}`; }catch(e){ return ''; }
}
function tdRecorded(D,cls,day){ const P=(D.participation||{})[day]||{}; return ctRoster(cls).some(x=>P[String(x.id)]); }
function tdShortName(n){ const t=String(n||'').trim().split(/\s+/).filter(Boolean); if(t.length<3) return t.join(' ');
  const k=['عبد','عبدال','أبو','ابو','أم','ام'].includes(t[0])?2:1; return t.slice(0,k).concat(t.length>k?[t[t.length-1]]:[]).join(' '); }
function tdNowBar(){
  const D=(typeof CT_DATA!=='undefined'&&CT_DATA)||null, k=tdKsaNow();
  if(!D) return `<div class="td-now muted">${TH_BUSY?'⏳ جارٍ جلب الجدول…':'اربط الخادم من الإعدادات لعرض حصص اليوم.'}</div>`;
  if(!(k.dow>=0&&k.dow<=4)) return '<div class="td-now muted">📅 لا دوام اليوم — استمتع بإجازتك 🌿</div>';
  const sc=D.schedule||{}, g=(sc.grid||{})[String(k.dow)]||{}, T=tdTimes(sc).filter(t=>g[String(t.n)]);
  if(!T.length) return `<div class="td-now muted">📅 لا حصص في جدولك اليوم — أضفها من «السجلات والحضور ← 🗓️ الجدول».</div>`;
  const rec=t=>tdRecorded(D,g[String(t.n)],k.day);
  const cur=T.find(t=>k.min>=t.sm&&k.min<t.em), next=T.find(t=>t.sm>k.min);
  const pend=T.filter(t=>t.em<=k.min&&!rec(t)).pop();
  const go=t=>`tdQuick('${thEsc(g[String(t.n)])}')`;
  let head;
  if(!cur&&!next) return tdDaySummary(D,k,T,rec);   // انتهى اليوم: ملخص (وفيه الحصص غير المرصودة)
  if(cur&&!rec(cur)) head=`<b>⏰ الآن: الحصة ${cur.n} · <bdi>${thEsc(g[String(cur.n)])}</bdi></b><small>تنتهي ${cur.e}</small><button class="btn tick sm" onclick="${go(cur)}">🗂️ ارصدها</button>`;
  else if(pend) head=`<b>⚠️ الحصة ${pend.n} · <bdi>${thEsc(g[String(pend.n)])}</bdi> انتهت ولم تُرصد</b><button class="btn sm" onclick="${go(pend)}">🗂️ ارصدها الآن</button>`;
  else if(cur) head=`<b>⏰ الآن: الحصة ${cur.n} · <bdi>${thEsc(g[String(cur.n)])}</bdi></b><small>تنتهي ${cur.e}</small><span class="td-ok">✓ رُصدت</span>`;
  else if(next) head=`<b>⏭️ القادمة: الحصة ${next.n} · <bdi>${thEsc(g[String(next.n)])}</bdi></b><small>تبدأ ${next.s}</small>`;
  else return tdDaySummary(D,k,T,rec);
  const chip=t=>{ const st=rec(t)?'done':(cur&&cur.n===t.n)?'cur':t.em<=k.min?'miss':'soon';
    return `<button type="button" class="td-per ${st}" onclick="${go(t)}" title="${t.s}–${t.e}">${st==='done'?'✓':st==='cur'?'●':st==='miss'?'!':'○'} ${t.n} · <bdi>${thEsc(g[String(t.n)])}</bdi><small>${t.s}</small></button>`; };
  return `<div class="td-now"><div class="td-now-h">${head}</div><div class="td-pers">${T.map(chip).join('')}</div></div>`;
}
function tdKpis(){
  const D=(typeof CT_DATA!=='undefined'&&CT_DATA)||null, k=tdKsaNow(), out=[];
  if(D&&k.dow>=0&&k.dow<=4){ const g=((D.schedule||{}).grid||{})[String(k.dow)]||{}, cl=Object.values(g).filter(Boolean);
    if(cl.length) out.push(['🗂️','مرصود اليوم',`${cl.filter(c=>tdRecorded(D,c,k.day)).length}/${cl.length}`,"ctGo('records')"]); }
  const t0=Date.parse(k.day+'T00:00:00+03:00'); let subs=0; HW.forEach(h=>Object.values(h.subs||{}).forEach(v=>{ if(v&&+v.at>=t0) subs++; }));
  out.push(['📥','تسليمات اليوم',subs,"document.querySelector('#dash-recent')?.closest('details')?.setAttribute('open','');thGoTo('dash-recent')"]);
  const late=(STUDENTS||[]).filter(s=>getStudentMissingActivities(s).length).length;
  out.push(['⏰','طلاب متأخرون',late,'openBulkReminder()']);
  const plans=((typeof CT_GRADES!=='undefined'&&CT_GRADES&&CT_GRADES.plans)||(typeof PLAN_DATA!=='undefined'&&PLAN_DATA&&PLAN_DATA.plans)||[]).filter(p=>p.status!=='done'&&p.timing&&p.timing.expired).length;
  out.push(['🩺','خطط تنتظر قرارك',plans,"goTab('plans')"]);
  return `<div class="td-kpis">${out.map(([i,l,v,go])=>`<button type="button" class="td-kpi" onclick="${go}">${i} <span>${l}</span> <b>${v}</b></button>`).join('')}</div>`;
}
function brOpenFor(id){ BR.act=String(id); BR.cls=''; BR.sel=null; BR.only=null; openBulkReminder(); }
function tdTasks(){
  const L=[], now=new Date(), t0=remKsaDay(0), t1=remKsaDay(1);
  ((typeof CT_GRADES!=='undefined'&&CT_GRADES&&CT_GRADES.alerts)||[]).forEach(a=>{
    const dis=encodeURIComponent(JSON.stringify(a.dismiss||{[a.key]:a.count}));
    L.push({key:'pm:'+a.key+':'+a.count,lv:a.tone==='positive'?'info':'warn',ic:a.tone==='positive'?'💌':'💬',t:`${tdShortName(a.name)}: ${a.reason} — يحتاج رسالة لولي الأمر`,
      acts:[['✍️ اكتب الرسالة',`pmsgOpen('${thEsc(a.studentId)}','${thEsc(a.suggest||'')}','${dis}')`]],doneJs:`pmsgDone('${dis}')`}); });
  tdRemToday().forEach(x=>{ if(x.done) return;
    L.push({key:'rem:'+x.r.id+':'+t0,lv:x.late?'warn':'info',ic:'⏰',t:`${tdRemTitle(x.r)} — ${x.hm}`,acts:[],remId:x.r.id}); });
  HW.filter(remPublished).forEach(h=>{
    const miss=hwPool(h).filter(s=>!(h.subs&&h.subs[s.id])).length; if(!miss||!h.due) return;
    const id=thEsc(h.id), acts=[['📨 ذكّرهم',`brOpenFor('${id}')`],['📊',`openReport('${id}')`]];
    if(new Date(h.due+'T23:59:59')<now) L.push({key:`od:${h.id}:${miss}`,lv:'bad',ic:'⏰',t:`«${h.title}» انتهى موعده · ${miss} لم ${miss===1?'يسلّم':'يسلّموا'}`,acts});
    else if(h.due===t0||h.due===t1) L.push({key:`soon:${h.id}:${miss}:${h.due}`,lv:'warn',ic:'⏳',t:`«${h.title}» ينتهي ${h.due===t0?'اليوم':'غدًا'} · ${miss} لم ${miss===1?'يسلّم':'يسلّموا'} بعد`,acts});
  });
  { const e=typeof brEffect==='function'?brEffect():null; if(e&&e.n&&e.pending.length) L.push({key:'bre:'+e.last+':'+e.pending.length,lv:'info',ic:'📈',t:`أثر التذكير: سلّم ${e.done} من ${e.n} ذكّرتهم — لم يستجب ${e.pending.length}`,acts:[['📨 ذكّرهم','brRemindPending()']]}); }
  { const M=typeof TD_MAD!=='undefined'?TD_MAD:null;
    if(M&&M.pendingLogin) L.push({key:'madlogin:'+M.pendingLogin,lv:'warn',ic:'🔑',t:'مزامنة مدرستي تنتظر تسجيل دخولك — بعد الدخول تكتمل وحدها',acts:[['فتح مدرستي',"window.open('https://schools.madrasati.sa/','_blank','noopener')"]]});
    else if(M&&M.n&&M.last&&Date.now()-M.last>72*3600e3) L.push({key:'madstale:'+M.last,lv:'warn',ic:'📱',t:`آخر مزامنة لمدرستي ${remAgo(M.last)} — «من حل ومن لم يحل» قد لا يكون دقيقًا`,acts:[['🔄 زامن الآن','tdMadSync()']]}); }
  { const q=(ASKS||[]).filter(x=>x.status==='open'); if(q.length) L.push({key:'ask:'+q.map(x=>x.id).join(','),lv:'bad',ic:'💬',noDone:true,
      t:`${q.length===1?'رسالة من طالب تنتظر ردك':q.length===2?'رسالتان من الطلاب تنتظران ردك':q.length+' رسائل من الطلاب تنتظر ردك'} — ${q.slice(0,2).map(x=>tdShortName(x.name)).join('، ')}${q.length>2?'…':''}`,acts:[['💬 ردّ',"asksOpen()"]]}); }
  { const ns=typeof nsOpenList==='function'?nsOpenList():[]; if(ns.length) L.push({doneJs:'tdAckAll(\'ns\')',key:'ns:'+ns.map(x=>x.s.id).join(','),lv:'warn',ic:'🚶',t:`${ns.length===1?'طالب واحد لم يبدأ':ns.length===2?'طالبان لم يبدآ':ns.length+' طلاب لم يبدؤوا'} بعد — لم ${ns.length===1?'يسلّم':ns.length===2?'يسلّما':'يسلّموا'} أي نشاط في البوابة`,acts:[['عرض','nsOpen()']]}); }
  thActions().forEach(([lv,ic,t,n,go])=>{
    if(/انتهت مواعيدها|ينتهي خلال يومين|متأخر(ون)? لم تذكّر/.test(t)) return;   // مغطّاة بأسطر الأنشطة أعلاه
    const isDash=/thGoTo\('dash-alerts'\)/.test(go);
    // التنبيهات القائمة على أشخاص: «✓ تم» يسجّل متابعتهم (على الخادم) بدل إخفاء النص مؤقتًا على هذا الجهاز
    const ack=ic==='🚫'?"tdAckAll('bad')":ic==='⚠️'&&/يحتاجون متابعة/.test(t)?"tdAckAll('warn')":ic==='🚩'?"tdAckAll('dev')":'';
    L.push({key:`a:${ic}:${t}:${n}`,lv:isDash?'info':lv,ic,t:t.replace(/ — (اضغط للتحقق|اضغط لعرض الأسماء)$/,''),acts:[[/thGoReqs|attention/.test(go)?'عرض':/plans/.test(go)?'قرّر':'عرض',go]],n,...(ack?{doneJs:ack}:{})});
  });
  return L;
}
/* 📱 حالة مزامنة مدرستي لصفحة اليوم: آخر مزامنة من الخادم (تعمل من الجوال أيضًا) + «بانتظار الدخول» من الإضافة إن وُجدت */
let TD_MAD=(()=>{ try{ return JSON.parse(localStorage.getItem('dash_today_mad_v1')||'null'); }catch(e){ return null; } })();
async function tdMadLoad(){
  try{ const j=await madApi('/madrasati/list'); const L=(j&&j.assignments)||[]; const m={n:L.length,last:L.reduce((x,a)=>Math.max(x,Number(a.syncedAt)||0),0),pendingLogin:0,at:Date.now()};
    try{ if(typeof madbCall==='function'){ const p=await madbCall('ping',null,1200); if(p&&p.ok){ const a=await madbCall('getAuto',null,2000); if(a&&a.pendingLogin&&Date.now()-a.pendingLogin<3*864e5) m.pendingLogin=a.pendingLogin; } } }catch(e){}
    TD_MAD=m; try{ localStorage.setItem('dash_today_mad_v1',JSON.stringify(m)); }catch(e){} thDraw(); }catch(e){}
}
async function tdMadSync(){
  // فحص سريع واحد (1.2 ث) — بلا الإضافة نذهب لصفحة مدرستي فورًا بدل انتظار المحاولات
  let on=false; try{ const p=await madbCall('ping',null,1200); on=!!(p&&p.ok); if(on) await madBridgeInit(true); }catch(e){}
  if(on&&typeof MADB!=='undefined'&&MADB.ok){ toast('🔄 بدأت مزامنة مدرستي — إن احتاجت تسجيل دخول يصلك إشعار، وبعد الدخول تكتمل وحدها','good'); await madBridgeSync(); tdMadLoad(); }
  else { goTab('madrasati'); toast('المزامنة تعمل من الكمبيوتر المثبّتة عليه إضافة «جسر مدرستي»','bad'); }
}
/* ⚡ نسخة مختصرة من بيانات اليوم تُحفظ على الجهاز فتُرسم الصفحة فور فتحها، ثم تُحدَّث من الخادم */
const TD_CACHE_KEY='dash_today_cache_v1';
let TD_CACHE=(()=>{ try{ const c=JSON.parse(localStorage.getItem(TD_CACHE_KEY)||'null'); return c&&Date.now()-c.at<7*864e5?c:null; }catch(e){ return null; } })();
function tdCacheSave(){
  try{ const D=CT_DATA; if(!D) return; const from=remKsaDay(-7), recent=m=>Object.fromEntries(Object.entries(D[m]||{}).filter(([d])=>d>=from));
    const G=(typeof CT_GRADES!=='undefined'&&CT_GRADES)||null;
    const c={at:Date.now(),data:{schedule:D.schedule,reminders:D.reminders,roles:D.roles,msgFlags:D.msgFlags,examBooks:D.examBooks,academic:D.academic,
      participation:recent('participation'),homework:recent('homework'),behavior:(D.behavior||[]).filter(x=>x&&String(x.date||'')>=from).slice(0,300)},
      grades:G?{alerts:G.alerts||[],plans:(G.plans||[]).map(p=>({status:p.status,timing:p.timing}))}:(TD_CACHE&&TD_CACHE.grades)||null};
    localStorage.setItem(TD_CACHE_KEY,JSON.stringify(c)); TD_CACHE=c; }catch(e){}
}
function thDraw(){
  // قبل وصول بيانات الخادم: ارسم من النسخة المحفوظة (مؤقتًا وبشكل متزامن فقط — لا تبقى في CT_DATA)
  if(!CT_DATA&&TD_CACHE&&TD_CACHE.data){ const g0=CT_GRADES; CT_DATA=TD_CACHE.data; if(!CT_GRADES&&TD_CACHE.grades) CT_GRADES=TD_CACHE.grades;
    try{ thDrawNow(); }finally{ CT_DATA=null; CT_GRADES=g0; } return; }
  thDrawNow();
}
function thDrawNow(){
  const box=document.getElementById('today-hub'); if(!box) return;
  const dl=document.getElementById('td-date'); if(dl&&!dl.textContent) dl.textContent=tdDateLabel();
  const done=tdDone(), all=tdTasks(), open=all.filter(x=>!done[x.key]), hid=all.length-open.length;
  const main=open.filter(x=>x.lv!=='info'), low=open.filter(x=>x.lv==='info');
  const row=x=>`<div class="td-task ${x.lv}"><span class="td-ic">${x.ic}</span><span class="td-t">${thEsc(x.t)}</span>
    <span class="td-acts">${x.acts.map(([l,go])=>`<button type="button" class="btn ghost sm" onclick="${go}">${l}</button>`).join('')}${x.noDone?'':x.doneJs?`<button type="button" class="td-done" title="تم الإرسال — يُزال حتى يتكرر من جديد" onclick="${x.doneJs}">✓ تم</button>`:x.remId?`<button type="button" class="td-done" title="تمّت — تُحفظ في تذكيراتك بالبوابة أيضًا" onclick="tdRemDone('${thEsc(x.remId)}')">✓ تم</button>`:`<button type="button" class="td-done" title="تم — إخفاؤه حتى يتغيّر" onclick="tdMarkDone('${thEsc(x.key).replace(/'/g,"\\'")}')">✓ تم</button>`}</span></div>`;
  tdLiveTick();
  const sT=document.getElementById('td-slot-tasks'), sW=document.getElementById('td-slot-week');
  const tasksHTML=`<div class="td-card td-taskcard"><div class="td-card-h"><b>✅ مهام اليوم</b><a href="#" class="td-link" onclick="event.preventDefault();rmgOpen()">⏰ تذكيراتي</a><small>${open.length?`${open.length} ${open.length===1?'مهمة':'مهام'}`:''}${hid?` · <a href="#" onclick="event.preventDefault();tdUndoAll()">إظهار المنجزة (${hid})</a>`:''}</small></div>
      ${main.length?main.map(row).join(''):(TH_BUSY&&!CT_DATA?'<div class="muted" style="padding:.6rem">⏳ جارٍ الفحص…</div>':'<div class="td-empty">🌿 لا شيء عاجل — كل شيء تحت السيطرة</div>')}
      ${low.length?`<details class="td-low"><summary>أقل أهمية (${low.length})</summary>${low.map(row).join('')}</details>`:''}</div>`;
  const head=`${tdNowBar()}${tdKpis()}${tdAbsentLine()}`;
  if(sT&&sW){ box.innerHTML=head; sT.innerHTML=tasksHTML; sW.innerHTML=tdWeek(); try{ tlDecorate(); }catch(e){} }
  else box.innerHTML=head+tasksHTML+`<div class="td-weekcard">${tdWeek()}</div>`;
}
/* كل تحديث للوحة (تسليم جديد، مزامنة، إرسال تذكير) يعيد رسم «مهام اليوم» */
(function(){ const _rd=window.renderDashboard; if(typeof _rd!=='function') return;
  window.renderDashboard=function(){ const r=_rd.apply(this,arguments); try{ thDraw(); }catch(e){} return r; }; })();
async function renderTodayHub(fetchNow){
  thDraw();
  const api=typeof getApi==='function'?getApi():'', tok=typeof getTok==='function'?getTok():'';
  if(!api||!tok||TH_BUSY) return;
  if(!fetchNow&&CT_DATA&&Date.now()-TH_AT<180000) return;
  if(Date.now()-TH_AT<20000&&CT_DATA) return;
  TH_BUSY=true; thDraw();
  try{
    // ⚡ كل الطلبات معًا: الإعدادات الأكاديمية والفصل، والدرجات تبدأ فور وصول الإعدادات (تحتاج الفصل/الفترة فقط)
    // بدل انتظار بيانات الفصل كاملة ثم طلبها — كان ذلك يضيف ذهابًا وإيابًا كاملًا للخادم قبل ظهور التنبيهات.
    const acadP=loadDashboardAcademic().catch(()=>null);
    // وفي الزيارات التالية لا ننتظر حتى الإعدادات: الفصل/الفترة معروفان من النسخة المحفوظة، ونتحقق بعد وصولها
    const semOf=a=>{ a=a||{}; const s1=Number(a.currentSemester)===2?2:1; return { sem:s1, per:Number(a.semesters?.[s1]?.activePeriod)===2?2:1 }; };
    const cacheA=(typeof DASH_ACADEMIC==='undefined'||!DASH_ACADEMIC)&&TD_CACHE&&TD_CACHE.data&&TD_CACHE.data.academic&&TD_CACHE.data.academic.semesters?TD_CACHE.data.academic:null;
    let gradesP=null;
    if(!CT_GRADES){
      if(cacheA){ const g=semOf(cacheA), early=loadServerGrades(true,g.sem,g.per).catch(()=>null);
        gradesP=Promise.all([acadP,early]).then(async([,G])=>{ const n=ctSem(); CT_GRADES=(G&&n.sem===g.sem&&n.per===g.per)?G:await loadServerGrades(true,n.sem,n.per); return CT_GRADES; }).catch(()=>null); }
      else gradesP=acadP.then(()=>ctEnsureGrades(false)).catch(()=>null);
    }
    tdMadLoad(); asksLoad();
    const [,cd]=await Promise.all([acadP, ctLoad()]);
    CT_DATA=cd; TH_AT=Date.now(); thDraw(); tdCacheSave();
    if(gradesP){ try{ await gradesP; tdCacheSave(); }catch(e){} }
  }catch(e){}
  TH_BUSY=false; thDraw();
}
(function(){ const go=()=>{ try{ if(document.getElementById('p-dashboard')?.classList.contains('on')) renderTodayHub(true); else thDraw(); }catch(e){ console.warn('todayHub',e); } };
  // كانت تنتظر 1.2 ثانية ثابتة؛ الآن فور اكتمال تحميل الصفحة (كل السكربتات معرّفة)، والنسخة المحفوظة تُرسم فورًا
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(go,0)); else setTimeout(go,0); })();
