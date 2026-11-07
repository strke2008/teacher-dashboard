'use strict';

/* ═══════════════ التخزين ═══════════════ */
const K = { st:'hwapp_students_v1', hw:'hwapp_assignments_v1', log:'hwapp_log_v1', perks:'hwapp_perks_v1', reqs:'hwapp_reqs_v1', thanks:'hwapp_thanks_v1', purchasesSeen:'hwapp_store_purchases_seen_v1' };

/* يجب تعريف load قبل أي مخزن يعتمد عليه. كان هذا الترتيب الخاطئ يوقف السكربت بالكامل بسبب TDZ. */
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

/* مسودات الأسئلة: مستقلة عن النشاط النهائي حتى لا تختلط المراجعة بالمزامنة */
const K_QS_DRAFTS = 'hwapp_qs_drafts_v1';
let QS_DRAFTS = load(K_QS_DRAFTS, {});
if(!QS_DRAFTS || typeof QS_DRAFTS !== 'object' || Array.isArray(QS_DRAFTS)) QS_DRAFTS = {};
function getQsDraft(id){
  const d = QS_DRAFTS[String(id)];
  return Array.isArray(d) ? d.map(q=>JSON.parse(JSON.stringify(q))) : null;
}
function setQsDraft(id, qs){
  QS_DRAFTS[String(id)] = (Array.isArray(qs)?qs:[]).map(q=>JSON.parse(JSON.stringify(q)));
  try{ localStorage.setItem(K_QS_DRAFTS, JSON.stringify(QS_DRAFTS)); return true; }
  catch(e){ toast('تعذّر حفظ مسودة الأسئلة محليًا','bad'); return false; }
}
function deleteQsDraft(id){
  delete QS_DRAFTS[String(id)];
  try{ localStorage.setItem(K_QS_DRAFTS, JSON.stringify(QS_DRAFTS)); }catch(e){}
}
let _suppressSyncSave = false;

const save = (k, v) => {
  if (typeof gInvalidate === 'function' && (k === 'hwapp_students_v1' || k === 'hwapp_assignments_v1')) gInvalidate();
  try {
    localStorage.setItem(k, JSON.stringify(v));
    if (!_suppressSyncSave && !_localMutationInFlight &&
        (k === 'hwapp_students_v1' || k === 'hwapp_assignments_v1' ||
         k === 'hwapp_perks_v1' || k === 'hwapp_repcfg_v1') &&
        typeof pushState === 'function') {
      pushState();
    }
    return true;
  } catch (e) {
    toast('تعذّر الحفظ — مساحة التخزين ممتلئة. صدّر نسخة فوراً', 'bad');
    return false;
  }
};

let STUDENTS = load(K.st, []);
let HW       = load(K.hw, []);
// الاختبار الورقي يستخدم سجلًا مؤقتًا داخليًا أثناء مولد الذكاء.
// لا يجوز أن يظهر هذا السجل كنشاط أو يدخل في المزامنة.
HW = Array.isArray(HW) ? HW.filter(h => h && !h.__examProxy) : [];
let PERKS    = load(K.perks, {});

const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
/* 🆔 مطابقة التسليم بالطالب: المعرف أولًا، والاسم احتياطٌ للسجلات القديمة فقط.
   الاسم المكرر لا يُطابَق بالاسم إطلاقًا — لا نخمّن صاحب التسليم. */
function matchStudent(row){
  const sid = String(row && (row.sid || row.studentId) || '').trim();
  if(sid){ const byId = STUDENTS.find(s => String(s.id) === sid); if(byId) return byId; return null; }
  const nm = String(row && row.name || '').trim();
  if(!nm) return null;
  const hits = STUDENTS.filter(s => String(s.name||'').trim() === nm);
  return hits.length === 1 ? hits[0] : null;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId = id => STUDENTS.find(s => s.id === id);

/* بطاقات المتجر — نقاط النشاط فقط */
const CARDS = [
  { id:'dbl',    name:'نقاط مضاعفة',      price:150, ic:'⭐', teacher:false },
  { id:'thanks', name:'رسالة شكر للأهل',  price:1000, ic:'💌', teacher:true  },
  { id:'retry',  name:'إعادة محاولة',     price:80,  ic:'🔁', teacher:false },
  { id:'hint',   name:'تلميح',            price:30,  ic:'💡', teacher:false },
  { id:'ticket', name:'تذكرتا مسابقة (2 بسعر 1)', price:50,  ic:'🎟️', teacher:false },
  { id:'madforgive', name:'مسح خصم مدرستي', price:250, ic:'🧽', teacher:false },
  { id:'hwforgive', name:'مسح خصم واجب الفصل', price:250, ic:'📘', teacher:false },
  { id:'fifty', name:'حذف إجابتين', price:40, ic:'✂️', teacher:false },
  { id:'cert', name:'شهادة شكر وتقدير', price:1500, ic:'🏅', teacher:false },
  { id:'avatars', name:'رموز حصرية', price:250, ic:'🐉', teacher:false },
  { id:'theme_gold', name:'مظهر ذهبي حصري', price:250, ic:'✨', teacher:false },
  { id:'theme_diamond', name:'مظهر ماسي حصري', price:250, ic:'💎', teacher:false },
  { id:'frame', name:'إطار الصورة', price:200, ic:'🖼️', teacher:false },
  { id:'namecolor', name:'اسم ملوّن', price:300, ic:'🌈', teacher:false },
  { id:'theme_saudi', name:'مظهر اليوم الوطني ٩٦', price:250, ic:'🇸🇦', teacher:false },
  { id:'theme_spaceweek', name:'مظهر أسبوع الفضاء', price:250, ic:'🚀', teacher:false }
];

/* ═══════════════ أدوات واجهة ═══════════════ */
let toastT;


function toast(msg, kind) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'on' + (kind ? ' ' + kind : '');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.className = '', 2600);
}
function openModal(html) {
  const modal = document.getElementById('modal');
  modal.classList.remove('activity-report-modal','noor-exp-modal');
  modal.innerHTML = html;
  /* زر إغلاق موحد للجوال: لا نعتمد على وجود زر في نهاية المحتوى. */
  if (!modal.querySelector('.modal-mobile-close')) {
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'modal-mobile-close no-print';
    close.setAttribute('aria-label','إغلاق النافذة');
    close.innerHTML = '×';
    close.addEventListener('click', closeModal);
    modal.prepend(close);
  }
  document.getElementById('veil').classList.add('on');
}
function closeModal() { document.getElementById('veil').classList.remove('on'); }
document.getElementById('veil')?.addEventListener('click', (e)=>{
  if(e.target?.id==='veil') closeModal();
});
/* 💬 تأكيد بتصميم اللوحة بدل نافذة المتصفح.
   confirm() الأصلية تعرض «This page says» بالإنجليزية وبشكل غريب عن
   الواجهة، ولا تُترجم ولا تُنسّق. هذه تعيد وعدًا فتُستعمل مع await. */
function askConfirm(msg, opts){
  const o = opts || {};
  return new Promise(resolve=>{
    // ⚠️ طبقة مستقلة لا openModal: النافذة الأصلية تستبدل محتوى الحاوية،
    // فكان التأكيد يمحو نموذج النشاط المفتوح ويُخرجك من الإعداد.
    const el = document.createElement('div');
    el.className = 'ask-veil';
    el.innerHTML = `<div class="ask-card" role="dialog" aria-modal="true">
        <div class="ask-ic ${o.danger?'danger':''}">${o.danger?'⚠️':'❓'}</div>
        <b>${esc(o.title||'تأكيد')}</b>
        <p>${esc(String(msg||''))}</p>
        <div class="ask-row">
          ${o.no===null?'':`<button class="btn ghost" data-ask="0">${esc(o.no||'إلغاء')}</button>`}
          <button class="btn ${o.danger?'danger':'tick'}" data-ask="1">${esc(o.yes||'تأكيد')}</button>
        </div></div>`;
    const done = v => { el.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = e => { if(e.key==='Escape'){ e.stopPropagation(); done(false); } };
    el.addEventListener('click', e=>{
      if(e.target===el) return done(false);
      const b=e.target.closest('[data-ask]'); if(b) done(b.dataset.ask==='1');
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(el);
    setTimeout(()=>el.querySelector('[data-ask="1"]')?.focus(), 40);
  });
}
function askAlert(msg, title){
  return askConfirm(msg, { title: title || 'تنبيه', yes:'حسنًا', no:null }).then(()=>{});
}

/* ⋯ المزيد: ما لا يتّسع له الشريط السفلي. يفتح التبويب بالنقر على زره
   الأصلي في الشريط العلوي، فلا يتكرّر منطق التنقّل في مكانين. */
function goTab(name){
  closeModal();
  if(name==='classtools:profile'){ stcOpen(window._ctPfSid||STUDENT_CENTER_SELECTED); return; }
  const [tab,view] = String(name||'').split(':');
  const btn = view
    ? document.querySelector(`.tab[data-tab="${tab}"][data-view="${view}"]`)
    : document.querySelector(`.tab[data-tab="${tab}"]:not([data-view])`);
  if(btn) btn.click();
  else if(tab==='classtools'){ // أدوات الفصل كاملة (بلا قسم)
    CT_VIEW=view||''; document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('on',p.id==='p-classtools'));
    ctMarkNav(); renderClassTools(true); }
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

document.querySelectorAll('.tab,.mobile-nav button[data-tab]').forEach(t => t.onclick = () => {
  document.querySelectorAll('.tab,.mobile-nav button[data-tab]').forEach(x => x.classList.toggle('on', x.dataset.tab === t.dataset.tab && (x.dataset.view||'') === (t.dataset.view||'')));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('on', p.id === 'p-' + t.dataset.tab));
  if (t.dataset.tab === 'dashboard') { renderDashboard(); syncStore(true); try{ renderTodayHub(true); }catch(e){} }
  if (t.dataset.tab === 'messages') { initStudentMessages(); msgqLoad(); try{ annInit(); annLoad(); }catch(e){} }
  if (t.dataset.tab === 'walls') { try{ wallAdminLoad(); }catch(e){} }
  if (t.dataset.tab !== 'projects') { try{ projLeave(); }catch(e){} }
  if (t.dataset.tab === 'students') { renderReqs(); renderDevWarn(); renderStudentsCenter(); syncStore(true); }
  if (t.dataset.tab === 'hw') { renderHw(); pullAll(true); }
  if (t.dataset.tab === 'grades') {
    __reportsHubActive=false;
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));
    document.getElementById('p-reports-main')?.classList.add('on');
    document.querySelectorAll('.tab,.mobile-nav button[data-tab]').forEach(x=>x.classList.toggle('on',x.dataset.tab==='grades'));
  }
  if (t.dataset.tab === 'reports') { __reportsHubActive=true; kashfGo(null); }
  if (t.dataset.tab === 'projects') { loadProjects(false); }
  if (t.dataset.tab === 'madrasati') { madLoad(false); madBridgeInit(false); }
  if (t.dataset.tab === 'books') { try{ bkRender(true); }catch(e){} }
  if (t.dataset.tab === 'exam-shop') { loadExamShopPolicy(false); if(typeof saleLoad==='function') saleLoad(); syncStore(true).then(()=>{ try{ renderExamShopStudents(); }catch(e){} }); }
  if (t.dataset.tab === 'plans') { renderPlans(true); }
  if (t.dataset.tab === 'classtools') { CT_VIEW = t.dataset.view || ''; renderClassTools(true); }
  if (t.dataset.tab === 'exam') { examInit(); }
  if (t.dataset.tab === 'data') { try{ backupLoad(); }catch(e){} try{ Promise.resolve(loadDashboardAcademic()).then(()=>{ try{ renderDashboardAcademicControl(); }catch(e){} }); }catch(e){} }
  if (t.dataset.tab === 'live') { try{ liveTLoad(); }catch(e){} }
});


function compToday(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
/* ═══════════════════════════════════════════════════════════════
   الدرجات لم تعد تُحسب هنا. تصل جاهزة من الـ Worker عبر /grades،
   وهو المكان الوحيد الذي تُكتب فيه القاعدة. لتغييرها: عدّل
   GRADE_RULES في الـ Worker ثم Deploy — ينطبق على الجوال واللوحة معًا.
   ═══════════════════════════════════════════════════════════════ */
let COMP_GRADES = null, COMP_GRADES_RAW = false, COMP_GRADES_PERIOD = 1, COMP_GRADES_SEMESTER = 1;
let COMP_GRADES_CACHE = new Map();
let COMP_GRADES_LOADED_AT = new Map();
const REPORT_NET_TIMEOUT = 10000;
// الكشوف بيانات شبه ثابتة: نعيد استخدام النسخة لمدة 6 ساعات، ولا نطلب الشبكة
// عند التنقل بين الشامل والأسبوعي أو تغيير الفلاتر. زر «تحديث» يتجاوز التخزين المؤقت.
const REPORT_CACHE_TTL = 6 * 60 * 60 * 1000;
function reportApiBase(){
  return (typeof API!=='undefined'?API:'https://homework.ahmadalmarzooq2009.workers.dev').replace(/\/+$/,'');
}
async function reportFetchJson(url, timeout=REPORT_NET_TIMEOUT){
  let lastErr=null;
  for(let attempt=0; attempt<2; attempt++){
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),timeout);
    try{
      const r=await fetch(url,{signal:ctrl.signal,cache:'no-store'});
      clearTimeout(timer);
      if(!r.ok){
        const e=new Error('http '+r.status); e.httpStatus=r.status;
        if(r.status>=500 && attempt===0){ lastErr=e; continue; }
        throw e;
      }
      return await r.json();
    }catch(e){
      clearTimeout(timer); lastErr=e;
      if(attempt===0) continue;
    }
  }
  throw lastErr||new Error('network error');
}
async function loadServerGrades(force=false, semester=1, period=1){
  semester=Number(semester)===2?2:1;
  period=Number(period)===2?2:1;
  const key=`${semester}:${period}`;
  const cached=COMP_GRADES_CACHE.get(key);
  const cachedAt=Number(COMP_GRADES_LOADED_AT.get(key)||0);
  if(!force && cached && (Date.now()-cachedAt)<REPORT_CACHE_TTL){
    COMP_GRADES=cached; COMP_GRADES_PERIOD=period; COMP_GRADES_SEMESTER=semester; COMP_GRADES_RAW=true;
    return cached;
  }
  const bundle=await loadReportBundle(force,semester,period);
  const g=bundle.grades||{};
  const result={...g,map:Object.fromEntries((g.students||[]).map(x=>[String(x.id),x]))};
  COMP_GRADES=result;
  COMP_GRADES_PERIOD=period;
  COMP_GRADES_SEMESTER=semester;
  COMP_GRADES_RAW=true;
  return result;
}
let DASH_ACADEMIC = null;
let DASH_ACADEMIC_LOADING = null;

async function loadDashboardAcademic(force=false){
  if(!force && DASH_ACADEMIC) return DASH_ACADEMIC;
  if(DASH_ACADEMIC_LOADING) return DASH_ACADEMIC_LOADING;
  DASH_ACADEMIC_LOADING=(async()=>{
    const tok=localStorage.getItem('hwapp_tok_v1')||'';
    const api=(typeof API!=='undefined'?API:'https://homework.ahmadalmarzooq2009.workers.dev').replace(/\/+$/,'');
    try{
      const r=await fetch(api+'/academic?t='+encodeURIComponent(tok));
      const j=await r.json();
      if(!r.ok || !j.ok) throw new Error('academic http '+r.status);
      DASH_ACADEMIC=j.academic||{};
      renderDashboardAcademicControl();
      return DASH_ACADEMIC;
    }catch(e){
      DASH_ACADEMIC=null;
      const st=document.getElementById('dashboard-academic-status');
      if(st) st.textContent='تعذّر قراءة حالة الفترة';
      const btn=document.getElementById('dashboard-period-transition');
      if(btn) btn.style.display='none';
      return null;
    }finally{ DASH_ACADEMIC_LOADING=null; }
  })();
  return DASH_ACADEMIC_LOADING;
}

/* 🔄 الرجوع للوحة (تبويب/جهاز): تُقرأ الفترة الجارية من الخادم — إن انتقلت من جهاز آخر تُحدَّث الكشوف ومهام اليوم بدل البقاء على القديمة */
(function(){ let last=0;
  const sig=a=>{ a=a||{}; const s=a.semesters||{}; return [a.currentSemester,(s['1']||{}).status,(s['1']||{}).activePeriod,(s['2']||{}).status,(s['2']||{}).activePeriod].join('|'); };
  document.addEventListener('visibilitychange',async()=>{
    if(document.visibilityState!=='visible'||!DASH_ACADEMIC||Date.now()-last<60000) return; last=Date.now();
    const before=sig(DASH_ACADEMIC), a=await loadDashboardAcademic(true).catch(()=>null);
    if(!a||sig(a)===before) return;
    COMP_GRADES=null; COMP_GRADES_RAW=false; COMP_GRADES_CACHE.clear(); COMP_GRADES_LOADED_AT.clear();
    try{ CT_GRADES=null; CT_DATA=null; }catch(e){}
    toast('📅 تغيّرت الفترة الدراسية (من جهاز آخر) — حُدّثت اللوحة','good');
    try{ if(typeof renderAll==='function') renderAll(); }catch(e){}
    try{ if(typeof renderTodayHub==='function') renderTodayHub(true); }catch(e){}
  });
})();
function renderDashboardAcademicControl(){
  const semValue=Number(document.getElementById('comp-semester')?.value||DASH_ACADEMIC?.currentSemester||1)===2?2:1;
  const sem=(DASH_ACADEMIC?.semesters||{})[String(semValue)]||{};
  const active=Number(sem.activePeriod)===2?2:1;
  const current=Number(DASH_ACADEMIC?.currentSemester)===2?2:1;
  const status=document.getElementById('dashboard-academic-status');
  const action=document.getElementById('dashboard-academic-action');
  const archive=document.getElementById('dashboard-year-archive');
  const del=document.getElementById('dashboard-year-delete');
  if(status){
    status.className='chip '+(sem.status==='closed'?'bad':sem.status==='not_started'?'ghost':active===2?'tick':'ghost');
    status.textContent=sem.status==='not_started'?'الفصل الثاني لم يبدأ بعد':sem.status==='closed'?`🔒 الفصل الدراسي ${semValue} مغلق`:`الفصل ${semValue} · الفترة الحالية للرصد: ${active===1?'الأولى':'الثانية'}`+(()=>{const e=String((sem.periods||{})[String(active)]?.end||'');return e&&e<ctToday()?` · 📌 تُحسب درجاتها حتى ${e.replace(/-/g,'/')}`:''})();
  }
  if(action){
    action.style.display='none'; action.disabled=false;
    if(semValue===1 && sem.status!=='closed' && active===1){
      action.style.display='inline-flex'; action.textContent='🔒 إغلاق الفترة الأولى وبدء الفترة الثانية';
    } else if(semValue===1 && sem.status!=='closed' && active===2){
      action.style.display='inline-flex'; action.textContent='🔒 إغلاق الفصل الأول وبدء الفصل الثاني';
    } else if(semValue===2 && sem.status==='not_started' && (DASH_ACADEMIC?.semesters?.['1']?.status==='closed')){
      action.style.display='inline-flex'; action.textContent='▶️ بدء الفصل الدراسي الثاني';
    } else if(semValue===2 && sem.status!=='closed' && active===1){
      action.style.display='inline-flex'; action.textContent='🔒 إغلاق الفترة الأولى وبدء الفترة الثانية';
    } else if(semValue===2 && sem.status!=='closed' && active===2){
      // عند نهاية السنة تظهر خياري الأرشفة/الحذف فقط، حتى لا يحدث الإنهاء
      // تلقائيًا بمجرد الضغط على الزر العام.
      action.style.display='none';
    }
  }
  const endYearReady=(current===2 && semValue===2 && sem.status!=='closed' && active===2);
  if(archive) archive.style.display=endYearReady?'inline-flex':'none';
  if(del) del.style.display=endYearReady?'inline-flex':'none';
}

async function postDashboardAcademic(payload){
  const tok=localStorage.getItem('hwapp_tok_v1')||'';
  const api=(typeof API!=='undefined'?API:'https://homework.ahmadalmarzooq2009.workers.dev').replace(/\/+$/,'');
  const r=await fetch(api+'/academic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,t:tok})});
  const j=await r.json();
  if(!r.ok || !j.ok) throw new Error(j.error||('http '+r.status));
  DASH_ACADEMIC=j.academic||DASH_ACADEMIC;
  COMP_GRADES=null; COMP_GRADES_RAW=false;
  COMP_GRADES_CACHE.clear();
  COMP_GRADES_LOADED_AT.clear();
  if(payload.action==='start_period2'){
    const cp=document.getElementById('comp-period'); if(cp) cp.value='2';
  } else if(payload.action==='start_semester2'){
    const cs=document.getElementById('comp-semester'), cp=document.getElementById('comp-period'); if(cs) cs.value='2'; if(cp) cp.value='1';
  } else if(payload.action==='end_year'){
    const cs=document.getElementById('comp-semester'), cp=document.getElementById('comp-period'); if(cs) cs.value='1'; if(cp) cp.value='1';
  }
  renderDashboardAcademicControl();
  await renderComprehensive(true);
  return j;
}

/* 📊 ما يدخل في «درجة الأنشطة»: النشاط العادي والفهم القرائي والمختبر — إلا ما جعله المعلم «تدريبًا بلا درجة».
   الدرجة على التسليم: (ما سلّمه ÷ المطلوب منه) × 10، ولكل فترة أنشطتها حسب وقت نشر النشاط. */
const GRADE_KINDS=['normal','reading','lab'];
function hwCounts(h){ return !!h && GRADE_KINDS.includes(h.kind||'normal') && !h.noGrade; }
/* نفس actAssignedAt في الخادم: أول نشر ← آخر نشر ← آخر تعديل/الإنشاء، ولا يتجاوز أول تسليم (لا يُسلَّم نشاط قبل نشره) */
function hwAssignedAt(h){
  if(!h) return 0;
  const m=/^s([0-9a-z]{8,9})/.exec(String(h.id||'')); const x=m?parseInt(m[1],36):0;   // uid() يبدأ بوقت الإنشاء
  const t=Number(h.firstPub||h.publishedAt||h.at)||((x>1.5e12&&x<4e12)?x:0);
  let s0=0; for(const v of Object.values(h.subs||{})){ const u=Number(v&&(v.fat||v.at))||0; if(u>1.5e12&&(!s0||u<s0)) s0=u; }
  return s0&&(!t||s0<t)?s0:t;
}
function hwInTerm(h,term){
  if(!term) return true;
  const t=hwAssignedAt(h); if(!t) return true;
  if(term.startAt&&t<term.startAt) return false;
  if(term.endAt&&t>=term.endAt) return false;
  const d=new Date(t+3*3600000).toISOString().slice(0,10);   // يوم النشر بتوقيت السعودية
  if((term.explicit||term.startSet)&&term.start&&d<term.start) return false;
  if((term.explicit||term.endSet)&&term.end&&d>term.end) return false;   // 📌 ما نُشر بعد نهاية الفترة المحددة لا يُحسب فيها
  return true;
}
/* حدود الفترة من درجات الخادم المحمّلة (إن وُجدت) */
function compTermFor(semester,period){
  const k=`${Number(semester)===2?2:1}:${Number(period)===2?2:1}`;
  try{ const g=COMP_GRADES_CACHE.get(k); if(g&&g.term) return g.term; }catch(e){}
  try{ const b=REPORT_BUNDLE_CACHE.get(k); if(b&&b.grades&&b.grades.term) return b.grades.term; }catch(e){}
  return null;
}
/* شارة على بطاقة النشاط: هل يدخل درجة الأنشطة؟ (اضغطها للتبديل في الأنواع القابلة للاحتساب) */
function hwGradePill(h){
  if(!GRADE_KINDS.includes(h.kind||'normal')) return '<span class="pill hw-gr" title="هذا النوع لا يدخل درجة الأنشطة">🎯 تدريب</span>';
  const on=hwCounts(h);
  return `<button type="button" class="pill hw-gr${on?' on':''}" onclick="hwToggleGrade('${h.id}')" title="${on?'يدخل في درجة الأنشطة — اضغط لجعله تدريبًا بلا درجة':'تدريب بلا درجة — اضغط ليدخل في درجة الأنشطة'}">${on?'📊 يدخل في الدرجة':'🎯 تدريب بلا درجة'}</button>`;
}
function compActivitiesForStudent(s,term){
  const cls=String(s.cls||s.className||s.class||'').trim();
  return (Array.isArray(HW)?HW:[]).filter(h=>{
    if(!hwCounts(h)) return false;
    if(!hwInTerm(h,term)) return false;
    if(!h.sid && !h.published && !(Array.isArray(h.s)&&h.s.length)) return false;
    if(cls && !hwFor(h, cls)) return false;
    if(Array.isArray(h.s) && h.s.length){
      return h.s.map(String).includes(String(s.id)) || h.s.map(String).includes(String(s.name));
    }
    // النشاط المنشور دون قائمة طلاب محددة يُعد مطلوبًا لجميع طلاب الفصل.
    return true;
  });
}
/* 🔒 بعد إغلاق الفترة: لا يُحسب لها إلا ما سُلّم قبل لحظة الإغلاق (term.closedAt، أو endAt للإغلاقات القديمة) */
/* 🔓 فرصة التحسين تمدّ لحظة القطع إلى نهايتها (term.improve.until) — نفس termCut في الخادم */
function termCut(term){ const c=Number(term&&(term.closedAt||term.endAt))||0, u=Number(term&&term.improve&&term.improve.until)||0; return c&&u>c?u:c; }
function compSubmissionCount(acts,s,term){
  const sid=String(s.id), name=String(s.name||''), cut=termCut(term);
  return acts.filter(h=>{
    const subs=h.subs||{}, sub=subs[sid]||subs[name];
    if(!sub) return false;
    if(!cut) return true;
    const t=Number(sub.fat||sub.at)||0;
    return !t||t<cut;
  }).length;
}
function compAnnualLevel(total){
  if(total>=54) return 'ممتاز';
  if(total>=48) return 'جيد جدًا';
  if(total>=42) return 'جيد';
  if(total>=30) return 'يحتاج متابعة';
  return 'يحتاج دعم';
}
let REPORT_CLASSROOM_LOADING=null;
let REPORT_CLASSROOM_LOADED_AT=0;
let REPORT_BUNDLE_LOADING=new Map();
let REPORT_BUNDLE_CACHE=new Map();
let REPORT_BUNDLE_LOADED_AT=new Map();
let REPORT_STATE_LOADING=null;

async function ensureReportRoster(){
  if(Array.isArray(STUDENTS) && STUDENTS.length) return true;
  if(REPORT_STATE_LOADING) return REPORT_STATE_LOADING;
  const api=getApi(), tok=getTok();
  if(!api || !tok) return false;
  REPORT_STATE_LOADING=(async()=>{
    try{
      const ok=await pullState();
      return !!ok && Array.isArray(STUDENTS) && STUDENTS.length>0;
    }catch(e){
      console.warn('report roster sync:',e);
      return false;
    }finally{ REPORT_STATE_LOADING=null; }
  })();
  return REPORT_STATE_LOADING;
}

async function loadReportBundle(force=false, semester=1, period=1){
  semester=Number(semester)===2?2:1;
  period=Number(period)===2?2:1;
  const key=`${semester}:${period}`;
  const cached=REPORT_BUNDLE_CACHE.get(key);
  const cachedAt=Number(REPORT_BUNDLE_LOADED_AT.get(key)||0);
  if(!force && cached && (Date.now()-cachedAt)<REPORT_CACHE_TTL){
    return cached;
  }
  if(REPORT_BUNDLE_LOADING.has(key)) return REPORT_BUNDLE_LOADING.get(key);

  // إذا لم تكن قائمة الطلاب موجودة محليًا، ثبّت الحالة أولًا. هذا يمنع فتح الكشف
  // أثناء الإقلاع من إظهار «لا توجد بيانات» قبل اكتمال المزامنة.
  if((!Array.isArray(STUDENTS)||!STUDENTS.length) && getApi() && getTok()){
    await ensureReportRoster();
  }

  const tok=localStorage.getItem('hwapp_tok_v1')||'';
  const url=reportApiBase()+'/reports?t='+encodeURIComponent(tok)
    +`&semester=${semester}&period=${period}&_=${Date.now()}`;
  const pending=(async()=>{
    try{
      const j=await reportFetchJson(url);
      if(!j||!j.ok) throw new Error('bad reports payload');
      const bundle={...j,
        classroom:j.classroom&&typeof j.classroom==='object'?j.classroom:{},
        grades:j.grades&&typeof j.grades==='object'?j.grades:{map:{},students:[],rules:{max:10}}
      };
      // حالة قائمة الطلاب القادمة من نفس اللقطة، فقط عندما تكون الواجهة المحلية فارغة.
      if((!Array.isArray(STUDENTS)||!STUDENTS.length) && Array.isArray(bundle.grades.students) && bundle.grades.students.length){
        STUDENTS=bundle.grades.students.map(x=>({id:String(x.id),name:String(x.name||''),cls:String(x.cls||'')}));
        save(K.st,STUDENTS);
      }
      window._classroomData=bundle.classroom;
      REPORT_CLASSROOM_LOADED_AT=Date.now();
      REPORT_BUNDLE_CACHE.set(key,bundle);
      REPORT_BUNDLE_LOADED_AT.set(key,Date.now());
      const g=bundle.grades;
      const result={...g,map:Object.fromEntries((g.students||[]).map(x=>[String(x.id),x]))};
      COMP_GRADES=result;
      COMP_GRADES_PERIOD=period;
      COMP_GRADES_SEMESTER=semester;
      COMP_GRADES_RAW=true;
      COMP_GRADES_CACHE.set(key,result);
      COMP_GRADES_LOADED_AT.set(key,Date.now());
      return bundle;
    }catch(e){
      console.warn('reports bundle sync:',e);
      if(cached) return cached;
      throw e;
    }finally{
      REPORT_BUNDLE_LOADING.delete(key);
    }
  })();
  REPORT_BUNDLE_LOADING.set(key,pending);
  return pending;
}

async function loadComprehensiveClassroom(force=false){
  const sem=Number(document.getElementById('comp-semester')?.value||1)===2?2:1;
  const period=Number(document.getElementById('comp-period')?.value||1)===2?2:1;
  const hasCache=window._classroomData && typeof window._classroomData==='object' &&
    (window._classroomData.participation||window._classroomData.homework||window._classroomData.behavior);
  const age=REPORT_CLASSROOM_LOADED_AT ? Date.now()-REPORT_CLASSROOM_LOADED_AT : Infinity;
  if(!force && hasCache && age<REPORT_CACHE_TTL) return window._classroomData;
  if(REPORT_CLASSROOM_LOADING) return REPORT_CLASSROOM_LOADING;
  REPORT_CLASSROOM_LOADING=(async()=>{
    try{
      const bundle=await loadReportBundle(force,sem,period);
      window._crcErr=false;
      return bundle.classroom||{};
    }catch(e){
      console.warn('comprehensive classroom sync:',e);
      if(hasCache) return window._classroomData;
      window._crcErr=true;
      return {};
    }finally{ REPORT_CLASSROOM_LOADING=null; }
  })();
  return REPORT_CLASSROOM_LOADING;
}

/* ═══════════════════════════════════════════════════════════════
   🩹 العلاج التلقائي — جهة المعلم
   1) عند نشر نشاط تُولَّد في الخلفية أسئلة بديلة (سؤالان لكل سؤال + تذكير)
      بمفتاح الذكاء الاصطناعي المضبوط هنا، وتُحفظ في الخادم مخفية.
   2) الخادم يفتح للطالب المخفق مهمة علاجية شخصية ويحسمها بنفسه.
   3) هذه اللوحة تعرض ما حدث، وتُبرز فقط من يحتاج تدخلك.
   ═══════════════════════════════════════════════════════════════ */
/* أسماء المهارات المعروفة (التشخيصي أولًا) تُعطى للذكاء الاصطناعي ليعيد استخدامها حرفيًا — فتُقاس الخطة على المهارة نفسها */
/* 🎯 المهارة = ناتج تعلم نافس من قائمة مغلقة (34-skill-outcomes-js.js) — لا أسماء جديدة لكل نشاط */
function skillNamesHint(){try{return typeof skOutcomeHint==='function'?skOutcomeHint():''}catch(e){return ''}}
function twinHash(h){let s=0;const str=JSON.stringify((h.qs||[]).map(q=>[q.t||'q',q.q,q.a,q.o]));for(let i=0;i<str.length;i++)s=(s*31+str.charCodeAt(i))|0;return String(s>>>0)}
function twinEligible(h){return !!(h&&h.published&&h.sid&&!h.noRem&&(h.kind||'normal')==='normal'&&!h.remedial&&Array.isArray(h.qs)&&h.qs.some(q=>['q','tf','f'].includes(q.t||'q')))}
let REM_ON=true; // مفتاح العلاج التلقائي العام (من الخادم)
let REM_TWINS=null; // معرّفات الأنشطة التي لها أسئلة بديلة محفوظة في الخادم
function twinReady(h){return h.twinsHash===twinHash(h)||!!(REM_TWINS&&REM_TWINS.has(String(h.sid))&&!h.twinsHash)}
function twinNeeded(h){return twinEligible(h)&&!twinReady(h)}
function twinHasKey(){try{return ['groq','gemini','claude','openai','openrouter'].some(p=>!!readingAIGetKey(p))}catch(e){return false}}
function twinPrompt(items){return `أنت معلم علوم للمرحلة المتوسطة في المملكة العربية السعودية. لكل سؤال أدناه اكتب:
0) "skill": ناتج التعلم الرسمي الذي يقيسه السؤال من القائمة أدناه حرفيًا، أو «لا شيء» إن لم يقس أيًّا منها.${skillNamesHint()}
1) "tip": تذكيرًا قصيرًا (أقل من 30 كلمة) بالمفهوم العلمي الذي يقيسه السؤال، دون أن يكشف إجابة أي سؤال.
2) "alts": سؤالين بديلين يقيسان نفس المفهوم بنفس الصعوبة ونفس النوع، بصياغة وسياق أو أرقام مختلفة، وبإجابة صحيحة واحدة مؤكدة علميًا. لا تكرر نص السؤال الأصلي. كل بديل مستقل بذاته يحمل معطياته كاملة: لا تكتب «في المسألة السابقة» أو «السؤال السابق» أو «الجدول أعلاه» — يظهر البديل للطالب وحده في مهمة علاجية.
الأنواع: "q" اختيار من متعدد بأربعة خيارات في "o" و"a" رقم الخيار الصحيح بدءًا من 0؛ "tf" صح أو خطأ و"a" true أو false؛ "f" إكمال و"a" كلمة أو رقم قصير.
أخرج JSON فقط بهذا الشكل: {"items":[{"i":0,"tip":"...","alts":[{"t":"q","q":"...","o":["...","...","...","..."],"a":0},{"t":"q","q":"...","o":["...","...","...","..."],"a":2}]}]}
الأسئلة:
${JSON.stringify(items)}`}
function twinClean(a,t){
  if(!a||typeof a!=='object')return null;const q=String(a.q||'').trim();if(!q)return null;const tt=a.t||t;
  if(tt==='tf')return{t:'tf',q,a:a.a===true||a.a==='true'};
  if(tt==='f'){const v=String(a.a??'').trim();return v?{t:'f',q,a:v}:null}
  const o=(Array.isArray(a.o)?a.o:[]).map(x=>String(x??'').trim()).filter(Boolean);const ai=parseInt(a.a,10);
  if(o.length<3||!(ai>=0&&ai<o.length)||new Set(o).size!==o.length)return null;return{t:'q',q,o,a:ai};
}
/* نموذج اقتصادي سريع لهذه المهمة البسيطة، بدل النموذج الكبير المضبوط للتوليد العام */
const TWIN_ECO={claude:'claude-haiku-5-5',gemini:'gemini-3.8-flash',openrouter:'google/gemini-3.8-flash',openai:'gpt-6-luna'};
function twinModel(p){const list=(READING_AI_PROVIDERS[p]&&READING_AI_PROVIDERS[p].models)||[];const eco=TWIN_ECO[p];return eco&&list.includes(eco)?eco:readingAIModels()[p]}
function twinQCount(h){return (h.qs||[]).filter(q=>['q','tf','f'].includes(q.t||'q')).length}
function twinCalls(h){return Math.max(1,Math.ceil(twinQCount(h)/6))}
let TWIN_PART=0,TWIN_PARTS=0,TWIN_T0=0,TWIN_AC=null,TWIN_STOP=false,TWIN_TICK=0;
async function twinGenerate(h){
  // السؤال المبني على شكل (q.img) لا بديل له: الذكاء الاصطناعي لا يرى الشكل فيكتب سؤالًا بلا معنى
  const src=h.qs.map((q,i)=>({i,t:q.t||'q',q:q.q,o:q.o,a:q.a,img:q.img})).filter(x=>['q','tf','f'].includes(x.t)&&!x.img).map(({img,...x})=>x);
  const out=[];TWIN_PARTS=Math.ceil(src.length/6);
  for(let k=0;k<src.length;k+=6){
    if(TWIN_STOP)throw new Error('أوقفتَ التجهيز');
    TWIN_PART=k/6+1;TWIN_T0=Date.now();autoRemStatus();
    const chunk=src.slice(k,k+6),{p,m:model}=aiRouteTwin();
    const ac=new AbortController();TWIN_AC=ac;let timer;
    const raw=await Promise.race([readingAICall(p,model,twinPrompt(chunk),ac.signal),
      new Promise((_,rej)=>{timer=setTimeout(()=>{try{ac.abort()}catch(e){}rej(new Error('انتهت مهلة الذكاء الاصطناعي (90 ثانية) دون رد'))},90000);
        ac.signal.addEventListener('abort',()=>rej(new Error(TWIN_STOP?'أوقفتَ التجهيز':'أُلغي الطلب')))})]).finally(()=>{clearTimeout(timer);TWIN_AC=null});
    let d;try{d=aiSafeJson(raw)}catch(e){console.warn('twins raw',String(raw).slice(0,600));throw new Error('رد الذكاء الاصطناعي ليس بالصيغة المطلوبة')}
    const arr=Array.isArray(d&&d.items)?d.items:(Array.isArray(d)?d:[]);
    for(const it of arr){const i=parseInt(it&&it.i,10),orig=chunk.find(c=>c.i===i);if(!orig)continue;
      const alts=(Array.isArray(it.alts)?it.alts:[]).map(a=>twinClean(a,orig.t)).filter(Boolean).filter(a=>a.q!==orig.q).slice(0,2);
      if(alts.length)out.push({i,tip:String(it.tip||'').slice(0,300),skill:String(it.skill||'').trim().slice(0,40),alts});}
  }
  return out;
}
let TWIN_BUSY=false;const TWIN_Q=[];let TWIN_NOW='',TWIN_CUR='',TWIN_ERR='',TWIN_OK=0,TWIN_FAIL=0,TWIN_LAST='';const TWIN_RUN=new Set();
function twinQueue(h){if(!h||!twinNeeded(h)||TWIN_Q.includes(h.id)||TWIN_CUR===h.id)return;
  // 🧭 نشاط نافس: بدائله من بنك نافس (أسئلة أخرى على الناتج نفسه بأشكالها) بلا ذكاء اصطناعي
  if(typeof hwIsNafs==='function'&&hwIsNafs(h)&&typeof nafsTwinsSave==='function'){nafsTwinsSave(h).then(()=>autoRemStatus());return}TWIN_Q.push(h.id);TWIN_RUN.add(h.id);twinPump();autoRemStatus()}
async function twinPump(){
  if(TWIN_BUSY)return;
  if(!twinHasKey()){TWIN_ERR='لا يوجد مفتاح ذكاء اصطناعي — أضفه من ⚙️ إعدادات الذكاء الاصطناعي';TWIN_Q.length=0;TWIN_RUN.clear();autoRemStatus();return}
  TWIN_BUSY=true;TWIN_STOP=false;TWIN_ERR='';TWIN_OK=0;TWIN_FAIL=0;TWIN_LAST='';autoRemStatus();
  clearInterval(TWIN_TICK);TWIN_TICK=setInterval(autoRemStatus,1000);
  try{while(TWIN_Q.length){
    const qid=TWIN_Q.shift();const h=HW.find(x=>x.id===qid);if(!twinNeeded(h))continue;
    TWIN_CUR=qid;TWIN_NOW=h.title||'نشاط';autoRemStatus();
    try{
      const items=await twinGenerate(h);
      if(!items.length)throw new Error('رد الذكاء الاصطناعي لم يتضمن أسئلة صالحة');
      const r=await fetch(getApi().replace(/\/+$/,'')+'/twins',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({t:getTok(),hw:h.sid,hash:twinHash(h),items})});
      let j=null;try{j=await r.json()}catch(e){}
      if(r.status===401)throw new Error('رمز المعلم غير مقبول في الخادم');
      if(r.status===404||(j&&/not found/i.test(String(j.error||''))))throw new Error('الخادم لا يعرف حفظ الأسئلة البديلة — ارفع ملف worker.js الأخير ثم أعد المحاولة');
      if(!r.ok||!j||!j.ok)throw new Error('تعذّر حفظ الأسئلة في الخادم ('+r.status+')');
      h.twinsHash=twinHash(h);h.twinsAt=Date.now();h.twinsN=j.n;save(K.hw,HW);
      // 🏷️ مهارات الأسئلة تُحفظ مع الأسئلة البديلة (بلا تكلفة إضافية)
      try{const map={};items.forEach(it=>{const v=it.skill&&(typeof skFromAI==='function'?skFromAI(it.skill):it.skill);if(v)map[it.i]=v});
        if(Object.keys(map).length){await fetch(getApi().replace(/\/+$/,'')+'/skills',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),hw:h.sid,hash:twinHash(h),map})});h.skillsHash=twinHash(h);save(K.hw,HW);}}catch(_){}
      if(REM_TWINS)REM_TWINS.add(String(h.sid));TWIN_OK++;
    }catch(e){
      console.warn('twins',h&&h.title,e);TWIN_FAIL++;
      const msg=e&&e.message?e.message:String(e);
      TWIN_ERR=`«${h.title||'نشاط'}»: ${/Failed to fetch|NetworkError|Load failed/i.test(msg)?'تعذّر الاتصال بالخادم أو بمزوّد الذكاء الاصطناعي — تحقّق من الإنترنت ثم أعد المحاولة':msg}`;
      if(TWIN_STOP||/الخادم|رمز المعلم|مفتاح|رصيد|quota|credit|billing|429|401/i.test(TWIN_ERR)){TWIN_Q.length=0}
    }
    TWIN_CUR='';autoRemStatus();await new Promise(r=>setTimeout(r,1200));
  }}finally{
    TWIN_BUSY=false;TWIN_NOW='';TWIN_CUR='';clearInterval(TWIN_TICK);if(TWIN_STOP){TWIN_ERR='أوقفتَ التجهيز. ما اكتمل محفوظ، ولم يُرسل أي طلب بعد الإيقاف.'}
    TWIN_LAST=TWIN_OK||TWIN_FAIL?`آخر تجهيز: نجح ${TWIN_OK}${TWIN_FAIL?` وتعذّر ${TWIN_FAIL}`:''}`:'';
    TWIN_RUN.clear();autoRemStatus();
  }
}
const TWIN_AUTO_KEY='rem_auto_twins_v1';
function twinAuto(){try{return localStorage.getItem(TWIN_AUTO_KEY)!=='0'}catch(e){return true}}
/* لا تجهيز صامت عند فتح الصفحة: التجهيز الجماعي بضغطة منك بعد عرض التكلفة التقديرية */

const REM_ST={open:['🟡','بانتظار الطالب'],retry:['🟠','محاولة ثانية'],mastered:['🟢','أتقن'],escalated:['🔴','يحتاج تدخلك']};
function autoRemStatus(){
  const el=document.getElementById('auto-rem-twins');if(!el)return;
  const all=HW.filter(twinEligible),readyL=all.filter(h=>!twinNeeded(h)),ready=readyL.length,key=twinHasKey();
  const total=TWIN_RUN.size,pos=Math.max(1,total-TWIN_Q.length),secs=TWIN_T0?Math.round((Date.now()-TWIN_T0)/1000):0;
  const pct=all.length?Math.round(ready/all.length*100):0;
  let action='';
  if(!TWIN_BUSY){
    if(all.length&&ready>=all.length) action='<span class="ar-pill ok">✅ كلها جاهزة</span>';
    else if(key&&all.length>ready) action=`<button class="btn sm" onclick="twinBackfill()">⚙️ جهّز الباقي (${all.length-ready})</button>`;
  }
  el.innerHTML=`
    <div class="ar-twin-top">
      <div class="ar-twin-num"><b>${ready}</b><span>من ${all.length} نشاط جاهز</span></div>
      <div class="ar-bar"><i style="width:${pct}%"></i></div>
      <div class="ar-twin-act">${action}</div>
    </div>
    ${TWIN_BUSY?`<div class="ar-run">
      <div class="ar-run-t">⏳ <b>يعمل الآن</b> — النشاط ${pos} من ${total}: «${planEsc(TWIN_NOW||'…')}»</div>
      <div class="ar-run-m"><span>الطلب ${TWIN_PART||1} من ${TWIN_PARTS||1}</span><span class="${secs>60?'warn':''}">⏱ ${secs} ث${secs>60?' (الحد 90)':''}</span><span>${planEsc(aiRouteTwin().m)}</span>
      <button class="btn bad sm" onclick="twinStop()">⏹ إيقاف</button></div></div>`:''}
    ${!TWIN_BUSY&&TWIN_LAST?`<div class="ar-note">${planEsc(TWIN_LAST)}</div>`:''}
    ${TWIN_ERR?`<div class="ar-alert">⚠️ ${planEsc(TWIN_ERR)}</div>`:''}
    ${key?'':'<div class="ar-alert">لا يوجد مفتاح ذكاء اصطناعي في الإعدادات. بدونه تستخدم المهام العلاجية الأسئلة الأصلية بترتيب خيارات مختلف.</div>'}
    ${(()=>{const need=HW.filter(skillNeeded).length;return need&&key?`<div class="ar-note" style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">🏷️ ${need} نشاط بلا تصنيف مهارات — التصنيف يجعل التشخيص والقياس بالمهارة نفسها <button class="btn ghost sm" ${SKILL_BUSY?'disabled':''} onclick="skillTagMissing()">${SKILL_BUSY?'⏳ يصنّف…':'صنّف المهارات'}</button></div>`:''})()}
    <label class="ar-switch-row"><span class="ar-switch"><input type="checkbox" ${skillAuto()?'checked':''} onchange="skillSetAuto(this.checked)"><i></i></span>
      <span><b>تصنيف مهارات الأسئلة تلقائيًا عند النشر</b><small>طلب قصير رخيص لكل نشاط جديد، ويأتي مجانًا مع الأسئلة البديلة إن كانت مفعّلة. الأنشطة القديمة تُصنَّف بالزر أعلاه.</small></span></label>
    <label class="ar-switch-row"><span class="ar-switch"><input type="checkbox" ${twinAuto()?'checked':''} onchange="twinSetAuto(this.checked)"><i></i></span>
      <span><b>تجهيز تلقائي عند نشر نشاط جديد</b><small>أوقفه لتوفير الرصيد؛ وتستطيع التجهيز يدويًا لكل نشاط من القائمة أدناه.</small></span></label>`;
  const acts=document.getElementById('auto-rem-acts');if(acts)acts.innerHTML=remActsTable();
}
/* قائمة الأنشطة: علاج تلقائي لكل نشاط + حالة أسئلته البديلة */
function remActsTable(){
  const acts=HW.filter(h=>h&&h.published&&h.sid&&(h.kind||'normal')==='normal'&&!h.remedial&&Array.isArray(h.qs)&&h.qs.length);
  if(!acts.length)return '<div class="ar-empty">لا توجد أنشطة منشورة بعد.</div>';
  const busy=TWIN_BUSY,on=acts.filter(h=>!h.noRem).length;
  return `<div class="ar-sub">${on} من ${acts.length} نشاط مفعّل له العلاج. الموقوف لا تُفتح منه مهام علاجية ولا يستهلك رصيدًا.</div>
    <div class="ar-list">${acts.map(h=>{const on=!h.noRem,ready=on&&!twinNeeded(h);
      const st=!on?'<span class="ar-pill">موقوف</span>':ready?`<button class="btn ghost sm" onclick="twinPreview('${planEsc(h.id)}')">👁️ الأسئلة</button>`
        :(busy&&TWIN_CUR===h.id?'<span class="ar-pill">⏳ يُجهَّز</span>':twinHasKey()?`<button class="btn ghost sm" ${busy?'disabled':''} onclick="twinOne('${planEsc(h.id)}')">⚙️ جهّز · ${twinCalls(h)} طلب</button>`:'<span class="ar-pill warn">بلا أسئلة بديلة</span>');
      return `<div class="ar-item ${on?'':'off'}">
        <label class="ar-switch" title="علاج تلقائي"><input type="checkbox" ${on?'checked':''} onchange="remToggle('${planEsc(h.id)}',this.checked)"><i></i></label>
        <div class="ar-item-t"><b>${planEsc(h.title||'نشاط')}</b><small>${twinQCount(h)} سؤال${h.cls?' · '+planEsc(typeof hwClsLabel==='function'?hwClsLabel(h):h.cls):''}</small></div>
        <div class="ar-item-a">${st}</div></div>`}).join('')}</div>`;
}
let REM_OPEN=0,REM_ESC=0;
function remApplyMaster(){
  const box=document.getElementById('auto-rem');if(!box)return;
  box.classList.toggle('ar-is-off',!REM_ON);
  const bd=box.querySelector('.ar-body');if(bd)bd.style.display=(!REM_ON&&!REM_ESC)?'none':'';
  const cb=document.getElementById('rem-master');if(cb)cb.checked=REM_ON;
  const t=document.getElementById('rem-master-t');if(t)t.textContent=REM_ON?'مفعّل':'موقوف';
  const off=document.getElementById('rem-off-note');
  if(off){const o=REM_OPEN||0,x=REM_ESC||0;
    off.innerHTML=REM_ON||!(o||x)?'':`<div class="ar-off-strip">⏳ <span>ما زال مفتوحًا عند الطلاب: <b>${o}</b> ${o===1?'مهمة':'مهام'}</span>${x?`<span class="ar-pill bad">🔴 ${x} يحتاج تدخلك</span>`:''}<span class="muted" style="font-size:.76rem">تُكمَل كما هي، ثم يختفي هذا السطر.</span></div>`;}
}
async function renderAutoRem(){
  const box=document.getElementById('auto-rem');if(!box)return;
  box.classList.add('ar');
  box.innerHTML=`
    <div class="ar-head">
      <div class="ar-title"><h3>🤖 العلاج التلقائي</h3>
        <p>من يحصل على أقل من 60% في نشاط أو اختبار — <b>أو في مهارة داخل النشاط</b> ولو كان مجموعه جيدًا — تصله مهمة علاجية شخصية تبدأ بأضعف مهارة. إتقان 80% يغلقها، وإخفاقه مرتين يظهر لك هنا.</p>
        <div class="ar-off-sub">متوقف: لا تُفتح مهام علاجية جديدة ولا يُستهلك رصيد الذكاء الاصطناعي.</div></div>
      <label class="ar-master"><span class="ar-switch big"><input type="checkbox" id="rem-master" ${REM_ON?'checked':''} onchange="remSetEnabled(this.checked)"><i></i></span><b id="rem-master-t">${REM_ON?'مفعّل':'موقوف'}</b></label>
    </div>
    <div id="rem-off-note"></div>
    <div class="ar-body">
      <div class="ar-kpis" id="auto-rem-kpis"></div>
      <div id="auto-rem-esc"></div>
      <details class="ar-sec ar-dim" open><summary>🧩 الأسئلة البديلة</summary><div id="auto-rem-twins" class="ar-sec-b"></div></details>
      <details class="ar-sec ar-dim"><summary>📋 التحكم لكل نشاط</summary><div id="auto-rem-acts" class="ar-sec-b"></div></details>
      <details class="ar-sec" id="auto-rem-recent-sec"><summary>🕘 آخر المهام العلاجية</summary><div id="auto-rem-body" class="ar-sec-b"><div class="ar-empty">جارٍ التحميل…</div></div></details>
    </div>`;
  remApplyMaster();autoRemStatus();
  let rows=[];
  try{const r=await fetch(getApi().replace(/\/+$/,'')+'/remedials?t='+encodeURIComponent(getTok()));const j=await r.json();rows=(j&&j.rows)||[];REM_ROWS=rows.slice();setTimeout(()=>{try{planSyncRemActions()}catch(e){}},0);
    if(j&&Array.isArray(j.twins)){REM_TWINS=new Set(j.twins.map(String))}
    if(j&&typeof j.enabled==='boolean')REM_ON=j.enabled;}catch(e){}
  try{const rs=await fetch(getApi().replace(/\/+$/,'')+'/skills-list?t='+encodeURIComponent(getTok()));const js=await rs.json();if(js&&Array.isArray(js.hw))SKILL_SERVER=new Set(js.hw.map(String));if(js&&Array.isArray(js.names))SKILL_NAMES=js.names.map(String).filter(Boolean);if(js&&js.alias&&typeof SKILL_ALIAS!=='undefined')SKILL_ALIAS=js.alias;if(js&&Array.isArray(js.custom)&&typeof skCustomApply==='function')skCustomApply(js.custom)}catch(e){}
  remApplyMaster();autoRemStatus();
  const clsF=(document.getElementById('plan-class')||{}).value||'';
  if(clsF)rows=rows.filter(x=>String(x.cls||'')===clsF);
  const cnt=k=>rows.filter(x=>x.status===k).length;
  REM_OPEN=cnt('open')+cnt('retry');REM_ESC=cnt('escalated');remApplyMaster();
  const k=document.getElementById('auto-rem-kpis');
  if(k)k.innerHTML=[['open','بانتظار الطالب','🟡'],['retry','محاولة ثانية','🟠'],['mastered','أتقن','🟢'],['escalated','يحتاج تدخلك','🔴']]
    .map(([s,t,i])=>`<div class="ar-kpi ${s}"><span>${i} ${t}</span><b>${cnt(s)}</b></div>`).join('');
  const line=x=>{const s=REM_ST[x.status]||['⚪',x.status];
    const tries=(x.attempts||[]).map((a,i)=>a.rate!=null?`م${i+1} ${a.rate}%`:`م${i+1} لم يحل`).join(' · ');
    return `<div class="ar-rec ${x.status}"><div class="ar-rec-t"><b>${planEsc(x.name)}</b><small>${planEsc(x.cls||'')}</small>
      <span>${x.kind==='exam'?'📝':'✏️'} ${planEsc(x.reason||x.srcTitle||'')}${x.fallback?' · بلا أسئلة بديلة':''}</span></div>
      <div class="ar-rec-m"><span>قبل ${x.before!=null?x.before+'%':'—'}</span>${tries?`<span>${tries}</span>`:''}</div>
      <span class="ar-pill ${x.status==='mastered'?'ok':x.status==='escalated'?'bad':''}">${s[0]} ${s[1]}</span>${remDueHTML(x)}${x.status==='escalated'?remPlanBtn(x):''}</div>`};
  const escL=rows.filter(x=>x.status==='escalated');
  const e=document.getElementById('auto-rem-esc');
  /* قابلة للطي: مطويّة افتراضيًا، ويُحفظ اختيار المعلم */
  const escOpen=(()=>{ try{ return localStorage.getItem('ar_escal_open')==='1'; }catch(_){ return false; } })();
  if(e)e.innerHTML=escL.length?`<details class="ar-escal" ${escOpen?'open':''} ontoggle="try{localStorage.setItem('ar_escal_open',this.open?'1':'0')}catch(_){}"><summary class="ar-escal-h"><span>🔴 ${escL.length} ${escL.length===1?'طالب يحتاج':'طلاب يحتاجون'} تدخلك — أخفق في المهمة العلاجية مرتين. اضغط «＋ خطة له» فتُبنى خطته من إخفاقه، أو تحدّث معه.</span><span class="ar-escal-tg" aria-hidden="true"></span></summary>${escL.map(line).join('')}</details>`:'';
  const body=document.getElementById('auto-rem-body');
  const cleanN=remCleanable(REM_ROWS).length;
  const cleanBar=cleanN?`<div class="row" style="gap:.5rem;align-items:center;justify-content:space-between;margin-bottom:.5rem;flex-wrap:wrap"><span class="muted" style="font-size:.8rem">${cleanN} ${cleanN===1?'مهمة منتهية':'مهام منتهية'} (أتقنها الطلاب) يمكن حذفها</span><button type="button" class="btn ghost sm" onclick="remClean()">🧹 حذف المهام المنتهية</button></div>`:'';
  try{ renderPlanCandidates(); }catch(e){}
  try{ pqLegacyNudge(); }catch(e){}
  if(body)body.innerHTML=cleanBar+(rows.length?rows.filter(x=>x.status!=='escalated').slice(0,30).map(line).join('')||'<div class="ar-empty">لا مهام أخرى.</div>':'<div class="ar-empty">لم تُفتح مهام علاجية بعد. ستظهر هنا تلقائيًا عند أول إخفاق.</div>');
}

/* ＋ خطة له: من «يحتاج تدخلك» مباشرة — يفتح نموذج الخطة على الطالب، بتشخيصه (المهارات والإجراءات)
   وسبب الإخفاق في المهمة العلاجية. إن كانت له خطة قائمة نفتحها بدل إنشاء خطة مكررة. */
function remActivePlan(sid){ return ((PLAN_DATA&&PLAN_DATA.plans)||[]).find(p=>p&&p.status!=='done'&&(String(p.studentId)===String(sid)||(p.group&&(p.members||[]).some(m=>String(m.studentId)===String(sid))))); }
function remPlanBtn(x){
  const pl=remActivePlan(x.sid);
  return pl?`<button type="button" class="btn ghost sm ar-plan-btn" onclick="openPlanForm('${planEsc(pl.id)}')" title="له خطة قائمة — افتحها وحدّثها">📋 فتح خطته</button>`
           :`<button type="button" class="btn tick sm ar-plan-btn" onclick="remPlanFor('${planEsc(x.id)}')" title="خطة علاجية حسب إخفاقه">＋ خطة له</button>`;
}

/* ═══ 🩹 ربط الخطة العلاجية بمهمة للطالب ═══
   الخطة سجلٌّ للمعلم؛ هذا الزر يحوّلها إلى تدريب يصل للطالب في بوابته،
   من أخطائه في المهارات المستهدفة (الأنشطة والتشخيصي)، وإن لم تُحدَّد مهارة فمن أضعف نشاطين — بقرار المعلم وبلا شرط 60%. */
let REM_ROWS=[];
/* 🧹 المنتهية القابلة للحذف: أتقنها الطالب، ولا تتبع خطة مفتوحة (نتيجتها جزء من قياس الخطة) */
function remOpenPlanIds(){return new Set(((PLAN_DATA&&PLAN_DATA.plans)||[]).filter(p=>p&&p.status!=='done').map(p=>String(p.id)))}
function remCleanable(rows){const op=remOpenPlanIds();return (rows||[]).filter(x=>x&&x.status==='mastered'&&!(x.planId&&op.has(String(x.planId))))}
/* ⏰ موعد المهمة العلاجية المفتوحة (آخر محاولة لم تُحل): يُغلق بعد 7 أيام من إرسالها.
   بعد الموعد تُقفل في بوابة الطالب — زر «افتحها» يمدّدها 7 أيام أخرى. */
function remDue(x){
  if(!x||(x.status!=='open'&&x.status!=='retry')) return null;
  const a=(x.attempts||[])[(x.attempts||[]).length-1]; if(!a||a.rate!=null) return null;
  const due=String(a.due||new Date(Number(a.at||x.createdAt||0)+3*3600000+7*86400000).toISOString().slice(0,10));
  return { due, late: due<new Date(Date.now()+3*3600000).toISOString().slice(0,10) };
}
function remDueHTML(x,named){
  const d=remDue(x); if(!d) return '';
  const who=named?planEsc(x.name)+': ':'';
  return `<span class="rem-due-box">${d.late
    ? `<span class="rem-due late">⏰ ${who}فات موعدها (${planEsc(d.due)})</span><button type="button" class="btn tick sm rem-ext" onclick="remExtend('${planEsc(x.id)}')" title="تُفتح للطالب في بوابته 7 أيام">🔓 افتحها للطالب</button>`
    : `<span class="rem-due">⏳ ${who}تُغلق ${planEsc(d.due)}</span><button type="button" class="btn ghost sm rem-ext" onclick="remExtend('${planEsc(x.id)}')" title="أضف 7 أيام من اليوم">⏰ مدّد</button>`}</span>`;
}
const PLAN_REM_ACTION='حل المهمة العلاجية المرسلة إلى بوابة الطالب';
function planMemberIds(p){return p.group?(p.members||[]).map(m=>String(m.studentId)):[String(p.studentId||(p.members&&p.members[0]&&p.members[0].studentId)||'')]}
function planRemRows(p){return REM_ROWS.filter(x=>x.planId===p.id)}
function planRemHTML(p){
  const rows=planRemRows(p);if(!rows.length)return '';
  const st=x=>{const s=REM_ST[x.status]||['⚪',x.status];const last=(x.attempts||[]).filter(a=>a.rate!=null).map(a=>a.rate+'%').join(' ← ');
    return `<span class="ar-pill ${x.status==='mastered'?'ok':x.status==='escalated'?'bad':''}">${s[0]} ${p.group?planEsc(x.name)+': ':''}${s[1]}${last?' · '+last:''}</span>`};
  return `<div class="plan-rem"><b>🩹 المهمة العلاجية في البوابة:</b> ${rows.map(x=>st(x)+remDueHTML(x,p.group)).join(' ')}</div>`;
}
/* يُعلَّم الإجراء منفَّذًا حين يحل كل من أُرسلت له مهمة الخطة محاولةً واحدة على الأقل */
async function planSyncRemActions(){
  const raw=window._classroomData&&Array.isArray(window._classroomData.plans)?window._classroomData.plans:null;if(!raw)return;
  let changed=false;
  const sync=list=>list.map(pl=>{const rows=REM_ROWS.filter(x=>x.planId===pl.id);if(!rows.length)return pl;
    const solved=rows.every(x=>(x.attempts||[]).some(a=>a.rate!=null));
    const acts=(pl.actions||[]).slice();let i=acts.findIndex(a=>a.text===PLAN_REM_ACTION);
    if(i<0){acts.push({text:PLAN_REM_ACTION,done:false});i=acts.length-1;changed=true}
    if(solved&&!acts[i].done){acts[i]={...acts[i],done:true};changed=true}
    if(solved)acts.forEach((a,k)=>{if(String(a.text).startsWith('إعادة حل')&&!a.done){acts[k]={...a,done:true};changed=true}});
    return {...pl,actions:acts};});
  sync(raw);   // يحدد هل تغيّر شيء، ثم يُطبَّق على أحدث نسخة في الخادم لحظة الحفظ
  if(changed){try{await savePlans(all=>sync(all));renderPlans(true)}catch(e){}}
  (PLAN_DATA&&PLAN_DATA.plans||[]).forEach(p=>{const el=document.getElementById('plan-rem-'+p.id);if(el)el.innerHTML=planRemHTML(p);const g=document.getElementById('plan-goals-'+p.id);if(g)g.innerHTML=planGoalChips(p);const tl=document.getElementById('plan-tl-'+p.id);if(tl)tl.innerHTML=planTimelineHTML(p)});
}

/* ═══ ⏰ مدة الخطة والقرار بعد انتهائها ═══ */
/* الحقول المحفوظة للخطة — مصدر واحد حتى لا تضيع المدة وسجل القرارات عند أي حفظ */
function planRaw(p){return {id:p.id,studentId:p.studentId,studentIds:p.studentIds,startDate:p.startDate,endDate:p.endDate,reason:p.reason,
  actions:(p.actions||[]).map(a=>({...a})),notes:p.notes,status:p.status,durationDays:p.durationDays,dueDate:p.dueDate,
  round:p.round,createdAt:p.createdAt,measure:p.measure,pattern:p.pattern,interventionChanged:p.interventionChanged,outcome:p.outcome,skills:Array.isArray(p.skills)?p.skills.slice():undefined,history:Array.isArray(p.history)?p.history.map(x=>({...x})):undefined,
  at:Date.now() /* أحدث من أي رقعة تلقائية سبقت: ما يراه المعلم الآن يصبح هو الأصل */}}
const PLAN_DECISIONS={
  close_success:{icon:'✅',t:'إغلاق: نجحت الخطة',d:'وصل للهدف — تُغلق الخطة.'},
  extend:{icon:'🔁',t:'تمديد أسبوعين بنفس الإجراءات',d:'تحسّن ولم يصل للهدف — نكمل، مع مهمة علاجية جديدة.'},
  change:{icon:'🔄',t:'تغيير نوع التدخل وتمديد أسبوعين',d:'التدريب الذاتي لم يُحدث فرقًا — ننتقل لإجراء يقوم به المعلم.'},
  extend_measure:{icon:'📩',t:'تمديد أسبوع مع مهمة علاجية',d:'لا يوجد قياس بعد البدء — نرسل له مهمة حتى يتوفر قياس فعلي.'},
  refer:{icon:'👥',t:'إحالة للمرشد الطلابي وإبلاغ ولي الأمر',d:'لم يتحسّن رغم تغيير التدخل — تُغلق الخطة بالإحالة.'}
};
const fmtD=d=>String(d||'').replace(/-/g,'/');
function planTimingHTML(p){
  const t=p.timing;if(!t||!t.due)return '';
  if(p.status==='done')return p.outcome?`<div class="plan-time done">🏁 النتيجة: <b>${planEsc(p.outcome)}</b>${p.endDate?` · ${fmtD(p.endDate)}`:''}</div>`:'';
  if(!t.expired)return `<div class="plan-time">📅 تنتهي ${fmtD(t.due)} · ${t.left===0?'اليوم':`بعد ${t.left} ${t.left===1?'يوم':'أيام'}`}${t.round>1?` · الجولة ${t.round}`:''}</div>`;
  const s=PLAN_DECISIONS[t.decision]||PLAN_DECISIONS.extend;
  return `<div class="plan-due"><div class="plan-due-h">⏰ انتهت مدة الخطة (${fmtD(t.due)}) — قرارك مطلوب</div>
    <div class="plan-due-why">${planEsc(t.why)}</div>
    ${t.decision!=='refer'?`<div class="plan-due-why" style="opacity:.8">إن لم تقرّر خلال يومين من انتهاء المدة يُنفَّذ القرار المقترح تلقائيًا.</div>`:'<div class="plan-due-why" style="opacity:.8">الإحالة لا تُنفَّذ تلقائيًا — تحتاج قرارك.</div>'}
    <div class="plan-due-a"><button class="btn tick sm" onclick="planDecide('${planEsc(p.id)}','${t.decision}')">${s.icon} ${s.t}</button>
      <select class="inp sm" onchange="if(this.value){planDecide('${planEsc(p.id)}',this.value);this.value=''}" aria-label="قرار آخر" style="width:auto"><option value="">قرار آخر…</option>
      ${Object.entries(PLAN_DECISIONS).filter(([k])=>k!==t.decision).map(([k,v])=>`<option value="${k}">${v.icon} ${v.t}</option>`).join('')}</select></div></div>`;
}

/* ═══ 📢 الإعلانات والملفات للطلاب ═══ */
const ANN_LIM={image:10,pdf:25,video:95,ppt:50};
let ANN_FILES=[];
function annKindOf(t,n){t=String(t||'').toLowerCase();const ext=(/\.([a-z0-9]{2,5})$/i.exec(String(n||''))||[])[1]||'';
  if(/powerpoint|presentationml/.test(t)||(/^(pptx?|ppsx)$/i.test(ext)&&(!t||t==='application/octet-stream'))) return 'ppt';   // 📊 عرض PowerPoint (يُعرف بامتداده إن لم يرسل المتصفح نوعه)
  return /^image\/(jpeg|png|webp|gif)$/.test(t)?'image':/^video\/(mp4|webm|quicktime)$/.test(t)?'video':t==='application/pdf'?'pdf':''}
const annIcon=k=>({image:'🖼️',video:'🎬',pdf:'📄',ppt:'📊'}[k]||'📎');
const annMB=n=>(n/1048576).toFixed(n<1048576?2:1)+' MB';
function annInit(){
  const box=document.getElementById('ann-classes');if(!box)return;
  // إعادة بناء شرائح الفصول في كل زيارة (م6) مع الحفاظ على اختيارات الفصول الموجودة
  const hadPrev=box.dataset.ready==='1';
  const prev=new Set([...box.querySelectorAll('input:checked')].map(x=>x.value));
  const cls=[...new Set((STUDENTS||[]).map(s=>String(s.cls||s.className||'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  box.innerHTML=`<label class="ann-chip"><input type="checkbox" value="" ${(!hadPrev||prev.has(''))?'checked':''}> كل الطلاب</label>`+cls.map(c=>`<label class="ann-chip"><input type="checkbox" value="${esc(c)}" ${prev.has(c)?'checked':''}> ${esc(c)}</label>`).join('');
  if(![...box.querySelectorAll('input')].some(x=>x.checked)) box.querySelector('input[value=""]').checked=true;
  if(box.dataset.ready)return;box.dataset.ready='1';
  box.addEventListener('change',e=>{const all=box.querySelector('input[value=""]');if(e.target===all&&all.checked)box.querySelectorAll('input:not([value=""])').forEach(x=>x.checked=false);else if(e.target!==all&&e.target.checked)all.checked=false;
    if(![...box.querySelectorAll('input')].some(x=>x.checked))all.checked=true});
  document.getElementById('ann-files').addEventListener('change',e=>{
    for(const f of e.target.files){const k=annKindOf(f.type,f.name);
      if(!k){toast(`«${f.name}» نوع غير مدعوم — صورة أو فيديو أو PDF أو PowerPoint فقط`,'bad');continue}
      if(f.size>ANN_LIM[k]*1048576){toast(`«${f.name}» أكبر من ${ANN_LIM[k]}MB`,'bad');continue}
      if(ANN_FILES.length>=6){toast('الحد 6 مرفقات','bad');break}
      ANN_FILES.push(f)}
    e.target.value='';annPicked()});
  document.getElementById('ann-send').onclick=annSend;
  // ⏰ اختصارات «يختفي بعد»: تُحسب من وقت الظهور (أو من الآن)
  document.getElementById('ann-quick').addEventListener('click',e=>{const b=e.target.closest('[data-ann-q]');if(!b)return;const d=+b.dataset.annQ;
    const fv=document.getElementById('ann-from').value, base=fv?new Date(fv).getTime():Date.now();
    document.getElementById('ann-until').value=d?annLocal(base+d*864e5):'';
    document.querySelectorAll('#ann-quick button').forEach(x=>x.classList.toggle('on',x===b))});
}
/* ⏰ أدوات الوقت: حقل datetime-local بتوقيت الجهاز ⇄ ملّي ثانية */
const annLocal=ms=>{const d=new Date(ms);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)};
const annMs=v=>v?new Date(v).getTime():0;
const annWhen=ms=>new Date(ms).toLocaleString('ar-SA-u-ca-gregory',{weekday:'short',day:'numeric',month:'numeric',hour:'numeric',minute:'2-digit'});
function annState(a,now=Date.now()){
  if(a.showFrom&&a.showFrom>now) return {k:'soon',t:`⏳ مجدول — يظهر ${annWhen(a.showFrom)}${a.showUntil?` ويختفي ${annWhen(a.showUntil)}`:''}`};
  if(a.showUntil&&a.showUntil<=now) return {k:'off',t:`⌛ انتهى ظهوره ${annWhen(a.showUntil)} — مخفي عن الطلاب`};
  return {k:'on',t:a.showUntil?`✅ ظاهر الآن — يختفي ${annWhen(a.showUntil)}`:'✅ ظاهر الآن — بلا نهاية'};
}
function annPicked(){
  const el=document.getElementById('ann-picked');if(!el)return;
  el.innerHTML=ANN_FILES.map((f,i)=>`<span class="ann-file">${annIcon(annKindOf(f.type,f.name))} ${esc(f.name)} <small>${annMB(f.size)}</small><button type="button" onclick="ANN_FILES.splice(${i},1);annPicked()" aria-label="إزالة">✕</button></span>`).join('');
}
function annSend(){
  const title=document.getElementById('ann-title').value.trim(),body=document.getElementById('ann-body').value.trim();
  if(!title&&!body&&!ANN_FILES.length){toast('اكتب عنوانًا أو أرفق ملفًا','bad');return}
  const classes=[...document.querySelectorAll('#ann-classes input:checked')].map(x=>x.value).filter(Boolean);
  const from=annMs(document.getElementById('ann-from').value), until=annMs(document.getElementById('ann-until').value);
  if(until&&until<=(from||Date.now())){toast('وقت الاختفاء يجب أن يكون بعد وقت الظهور','bad');return}
  const fd=new FormData();fd.append('t',getTok());fd.append('title',title);fd.append('body',body);fd.append('classes',JSON.stringify(classes));
  if(from>Date.now()+60000) fd.append('from',String(from)); if(until) fd.append('until',String(until));
  ANN_FILES.forEach(f=>fd.append('files',f,f.name));
  const pr=document.getElementById('ann-progress'),btn=document.getElementById('ann-send');
  pr.classList.remove('hide');btn.disabled=true;
  const xhr=new XMLHttpRequest();xhr.open('POST',getApi().replace(/\/+$/,'')+'/ann');
  xhr.upload.onprogress=e=>{if(e.lengthComputable){const p=Math.round(e.loaded/e.total*100);pr.querySelector('i').style.width=p+'%';pr.querySelector('span').textContent=`جارٍ الرفع ${p}% (${annMB(e.loaded)} من ${annMB(e.total)})`}};
  xhr.onload=()=>{btn.disabled=false;pr.classList.add('hide');let j={};try{j=JSON.parse(xhr.responseText)}catch(e){}
    if(xhr.status===404||/not found/i.test(String(j.error||''))&&!j.ok){toast('ارفع worker.js الأخير ثم أعد المحاولة','bad');return}
    if(!j.ok){toast(j.error==='too_big'?`«${j.name}» أكبر من المسموح`:j.error==='bad_type'?`«${j.name}» نوع غير مدعوم`:j.error&&/R2/.test(j.error)?'تخزين الملفات (R2) غير مربوط بالخادم':'تعذّر النشر','bad');return}
    toast(from>Date.now()+60000?`⏳ جُدول الإعلان — يظهر للطلاب ${annWhen(from)}`:'📢 نُشر الإعلان — يظهر الآن في بوابة الطلاب','good');
    document.getElementById('ann-title').value='';document.getElementById('ann-body').value='';document.getElementById('ann-from').value='';document.getElementById('ann-until').value='';
    document.querySelectorAll('#ann-quick button').forEach(x=>x.classList.remove('on'));ANN_FILES=[];annPicked();annLoad()};
  xhr.onerror=()=>{btn.disabled=false;pr.classList.add('hide');toast('انقطع الاتصال أثناء الرفع','bad')};
  xhr.send(fd);
}
async function annLoad(){
  const el=document.getElementById('ann-list');if(!el)return;
  let rows=[], loadErr=false;
  try{const r=await fetch(getApi().replace(/\/+$/,'')+'/ann-list?t='+encodeURIComponent(getTok()));const j=await r.json();if(!r.ok) throw new Error('ann');rows=j.rows||[]}catch(e){ loadErr=true; }
  if(!rows.length){el.innerHTML='<div class="muted" style="font-size:.86rem">'+(loadErr?'تعذّر تحميل الإعلانات — تحقق من الاتصال وأعد فتح التبويب.':'لا توجد إعلانات منشورة.')+'</div>';return}
  const base=getApi().replace(/\/+$/,''),tk=encodeURIComponent(getTok());
  ANN_ROWS=rows;
  el.innerHTML=rows.map(a=>{const st=annState(a);return `<div class="ann-row ${st.k}"><div style="min-width:0;flex:1"><b>${esc(a.title||'(بلا عنوان)')}</b>
    <span class="ann-st ${st.k}">${st.t}</span>
    <small class="muted">أُنشئ ${new Date(a.at).toLocaleString('ar-SA',{dateStyle:'medium',timeStyle:'short'})}${a.editedAt?` · ✏️ عُدّل ${new Date(a.editedAt).toLocaleString('ar-SA',{dateStyle:'medium',timeStyle:'short'})}`:''} · ${a.classes&&a.classes.length?esc(a.classes.join('، ')):'كل الطلاب'}</small>
    ${a.body?`<div class="muted" style="font-size:.84rem;white-space:pre-wrap">${esc(a.body.slice(0,160))}${a.body.length>160?'…':''}</div>`:''}
    ${(()=>{ const fa=(window.hwFileAuth?hwFileAuth():'t='+tk), u=i=>`${base}/ann-file?a=${encodeURIComponent(a.id)}&f=${i}&${fa}`, fs=(a.files||[]).map((f,i)=>({...f,i}));
      // 🖼️ معاينة كما يراها الطلاب: الصور مصغّرة (تُفتح كاملة بالضغط) والفيديو يعمل هنا، وبقية الملفات روابط
      const im=fs.filter(f=>f.kind==='image'), vd=fs.filter(f=>f.kind==='video'), ot=fs.filter(f=>f.kind!=='image'&&f.kind!=='video');
      return `${im.length||vd.length?`<div class="ann-pv">${im.map(f=>`<a href="${u(f.i)}" target="_blank" rel="noopener" title="${esc(f.name)}"><img loading="lazy" src="${u(f.i)}" alt="${esc(f.name)}"></a>`).join('')}${vd.map(f=>`<video controls playsinline preload="metadata" src="${u(f.i)}"></video>`).join('')}</div>`:''}
        ${ot.length?`<div class="ann-fl">${ot.map(f=>`<a href="${u(f.i)}" target="_blank" rel="noopener">${annIcon(f.kind)} ${esc(f.name)}</a>`).join('')}</div>`:''}`; })()}
    <div class="ann-edit hide" id="ann-ed-${esc(a.id)}"><label>يظهر من<input class="inp" type="datetime-local" value="${a.showFrom?annLocal(a.showFrom):''}"></label><label>ويختفي في<input class="inp" type="datetime-local" value="${a.showUntil?annLocal(a.showUntil):''}"></label>
      <button class="btn tick sm" type="button" onclick="annTimeSave('${esc(a.id)}')">حفظ الوقت</button></div></div>
    <div class="ann-acts">${st.k==='on'?`<button class="btn ghost sm" onclick="annTimeSet('${esc(a.id)}','hide')">⏹️ أخفِ الآن</button>`:`<button class="btn ghost sm" onclick="annTimeSet('${esc(a.id)}','show')">▶️ أظهر الآن</button>`}
      <button class="btn ghost sm" onclick="annEditOpen('${esc(a.id)}')">✏️ تعديل</button>
      <button class="btn ghost sm" onclick="document.getElementById('ann-ed-${esc(a.id)}').classList.toggle('hide')">⏰ الوقت</button>
      <button class="btn ghost sm" onclick="annDelete('${esc(a.id)}')">🗑️ حذف</button></div></div>`}).join('');
}
let ANN_ROWS=[];

/* ═══ 🏷️ تصنيف مهارات الأسئلة لأنشطة منشورة (طلب صغير رخيص: أسماء المهارات فقط) ═══ */
let SKILL_SERVER=null, SKILL_BUSY=false, SKILL_NAMES=[]; // أسماء المهارات المصنّفة في الخادم (للاقتراح في الخطة)
function skillEligible(h){return !!(h&&h.published&&h.sid&&(h.kind||'normal')==='normal'&&!h.remedial&&Array.isArray(h.qs)&&h.qs.some(q=>['q','tf','f'].includes(q.t||'q'))&&!h.qs.some(q=>q&&q.skill))}   // أسئلة نافس تحمل ناتج تعلمها
function skillNeeded(h){return skillEligible(h)&&h.skillsHash!==twinHash(h)&&!(SKILL_SERVER&&SKILL_SERVER.has(String(h.sid))&&!h.skillsHash)}
/* 🏷️ تصنيف تلقائي عند النشر: طلب قصير رخيص (أسماء المهارات فقط). إن كان توليد الأسئلة البديلة
   سيعمل للنشاط نفسه فالتصنيف يأتي معه بلا طلب إضافي. */
const SKILL_AUTO_KEY='rem_auto_skills_v1';
function skillAuto(){try{return localStorage.getItem(SKILL_AUTO_KEY)!=='0'}catch(e){return true}}
const SKILL_Q=[];
function skillQueue(h){
  if(!skillAuto()||!skillNeeded(h)||!twinHasKey()||SKILL_Q.includes(h.id))return;
  if(REM_ON&&twinAuto()&&twinNeeded(h))return;          // سيأتي التصنيف مع الأسئلة البديلة
  SKILL_Q.push(h.id);skillPump();
}
async function skillPump(){
  if(SKILL_BUSY)return;SKILL_BUSY=true;
  try{while(SKILL_Q.length){const id=SKILL_Q.shift(),h=HW.find(x=>x.id===id);if(!skillNeeded(h))continue;
    try{await skillTagOne(h)}catch(e){console.warn('skills',e);if(/worker|مفتاح/.test(String(e&&e.message))){SKILL_Q.length=0}}
    await new Promise(r=>setTimeout(r,800))}}
  finally{SKILL_BUSY=false;try{autoRemStatus()}catch(_){}}
}
async function skillTagOne(h){
  const src=h.qs.map((q,i)=>({i,q:q.q,...(Array.isArray(q.o)?{o:q.o}:{})})).filter((x,i)=>['q','tf','f'].includes(h.qs[i].t||'q'));   // الخيارات تحدد ما يقيسه السؤال بدقة أكبر
  const map={};
  for(let k=0;k<src.length;k+=15){
    const chunk=src.slice(k,k+15),{p,m:model}=aiRouteTwin();
    const prompt=`صنّف كل سؤال علوم (المرحلة المتوسطة) بناتج التعلم الذي يقيسه، واستخدم الاسم نفسه للأسئلة التي تقيس الشيء نفسه.${skillNamesHint()}
أخرج JSON فقط: {"skills":{"0":"اسم المهارة","1":"..."}}
الأسئلة:
${JSON.stringify(chunk)}`;
    const raw=await readingAICall(p,model,prompt,new AbortController().signal);const d=aiSafeJson(raw)||{};
    const s=d.skills||{};for(const c of chunk){const raw=String(s[c.i]??s[String(c.i)]??'').trim(),v=typeof skFromAI==='function'?skFromAI(raw):raw.slice(0,40);if(v)map[c.i]=v}
  }
  // «لا شيء» لكل الأسئلة نتيجة صحيحة (النشاط خارج النواتج) — تُحفظ فلا يُعاد تصنيفه في كل مرة
  const r=await fetch(getApi().replace(/\/+$/,'')+'/skills',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),hw:h.sid,hash:twinHash(h),map})});
  const j=await r.json();if(!j.ok)throw new Error(r.status===404?'ارفع worker.js الأخير':'تعذّر الحفظ');
  h.skillsHash=twinHash(h);save(K.hw,HW);if(SKILL_SERVER)SKILL_SERVER.add(String(h.sid));
}
async function skillTagMissing(){
  if(SKILL_BUSY)return;if(!twinHasKey()){toast('أضف مفتاح ذكاء اصطناعي أولًا','bad');return}
  const list=HW.filter(skillNeeded);if(!list.length){toast('كل الأنشطة مصنّفة');return}
  if(!(await askConfirm(`سيُصنَّف ${list.length} نشاط (${list.reduce((t,h)=>t+Math.ceil(twinQCount(h)/15),0)} طلب قصير للذكاء الاصطناعي). يُستخدم التصنيف لتشخيص الطالب بالمهارة وقياس الخطة عليها.`,{title:'تصنيف مهارات الأسئلة',yes:'ابدأ',no:'إلغاء'})))return;
  SKILL_BUSY=true;let ok=0,err='';
  for(const h of list){try{toast(`🏷️ يصنّف «${h.title}»…`);await skillTagOne(h);ok++}catch(e){err=e.message||String(e);if(/worker|مفتاح/.test(err))break}}
  SKILL_BUSY=false;toast(err&&!ok?`تعذّر التصنيف: ${err}`:`🏷️ صُنّف ${ok} نشاط${err?` (تعذّر بعضها: ${err})`:''}`,err&&!ok?'bad':'good');autoRemStatus();
}

/* ═══════════ 🧰 أدوات الفصل — نسخة مكتبية لما في بوابة المعلم ═══════════
   المستويات · دفتر الاختبارات · السجلات · الشهادات · الجدول.
   تقرأ وتكتب بيانات الفصل نفسها على الخادم (/classroom) التي تستخدمها البوابة، فيبقى الاثنان متزامنين.
   كل حفظ يجلب أحدث نسخة من الخادم أولًا ثم يعدّل الحقل المطلوب وحده — فلا يُمحى ما رصدته البوابة للتو. */
let CT_TAB='levels', CT_DATA=null, CT_GRADES=null, CT_BUSY=false;
const CT_TABS=[['profile','👤 ملف الطالب'],['levels','📊 المستويات'],['skills','🧭 خريطة المهارات'],['exams','📝 دفتر الاختبارات'],['records','🗂️ السجلات'],['certs','🏅 الشهادات'],['schedule','🗓️ الجدول'],['messages','💌 رسائل الحصة']];
/* أقسام القائمة الجانبية: كل قسم يعرض جزءًا من الأدوات بعنوانه، ويبقى «أدوات الفصل» كاملًا لمن يفتحها بلا قسم */
let CT_VIEW='';
const CT_VIEWS={
  profile:{tabs:['profile'],title:'👤 ملف الطالب',sub:'ملف واحد لكل طالب: النظرة الشاملة، الأنشطة والإجراءات، تقرير الأنشطة المفصل، وتقرير الفترة — مع الطباعة.'},
  records:{tabs:['records','schedule','messages'],title:'🗂️ السجلات والحضور',sub:'رصد الحضور والمشاركة والواجب والسلوك يوميًا، والسجل الشهري، وجدول الحصص.'},
  analysis:{tabs:['levels','skills'],title:'📈 المستويات والمهارات',sub:'مستوى كل طالب واتجاهه من حساب الخادم، وخريطة المهارات للفصل لاكتشاف ما يحتاج إعادة شرح.'},
  exams:{tabs:['exams'],title:'📝 دفتر الاختبارات',sub:'رصد درجات الاختبارات القصيرة والفترية، اللصق من جدول، والتصدير.'},
  certs:{tabs:['certs'],title:'🏅 الشهادات',sub:'شهادات الشكر والتقدير: المرشحون، الطباعة، والإرسال إلى بوابة الطالب.'}
};
function ctViewOf(tab){ return Object.keys(CT_VIEWS).find(v=>CT_VIEWS[v].tabs.includes(tab))||''; }
function ctMarkNav(){
  document.querySelectorAll('.tab,.mobile-nav button[data-tab]').forEach(x=>x.classList.toggle('on', x.dataset.tab==='classtools' && (x.dataset.view||'')===CT_VIEW));
}
/* فتح أداة من أي مكان: ينتقل إلى قسمها في القائمة ويُبقي الاختيار الحالي داخلها */
function ctGo(tab){
  if(tab==='profile'){ stcOpen(window._ctPfSid||STUDENT_CENTER_SELECTED); return; }   // 👤 ملف الطالب صار داخل «الطلاب»
  CT_TAB=tab;
  const view=ctViewOf(tab), panel=document.getElementById('p-classtools');
  if(!panel||!panel.classList.contains('on')){ goTab('classtools:'+view); return; }
  if(CT_VIEW&&CT_VIEW!==view) CT_VIEW=view;
  ctMarkNav(); renderClassTools();
}
function ctApi(){ return (typeof getApi==='function'?getApi():'').replace(/\/+$/,''); }
async function ctLoad(){
  const r=await fetch(ctApi()+'/classroom?t='+encodeURIComponent(getTok()));
  const j=await r.json().catch(()=>null);
  if(!r.ok||!j||!j.ok) throw new Error('load '+r.status);
  return (j.data&&typeof j.data==='object')?j.data:{};
}
/* حفظ آمن: أحدث نسخة من الخادم ← تعديل ← إرسال */
async function ctSave(mutate){
  const fresh=await ctLoad();
  mutate(fresh);
  const r=await fetch(ctApi()+'/classroom',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),data:fresh,clientAt:Date.now()})});
  if(!r.ok) throw new Error('save '+r.status);
  CT_DATA=fresh; window._classroomData=fresh; try{ COMP_GRADES=null; }catch(e){}
  try{ if(typeof tdCacheSave==='function') tdCacheSave(); }catch(e){}
  return fresh;
}
function ctSemActive(){ const a=(typeof DASH_ACADEMIC!=='undefined'&&DASH_ACADEMIC)||{}; const s=Number(a.currentSemester)===2?2:1; return { sem:s, per:Number(a.semesters?.[s]?.activePeriod)===2?2:1, closed:(a.semesters?.[s]?.status)==='closed' }; }
/* 📅 الفترة المعروضة في كل اللوحة: الجارية افتراضيًا، أو فترة مغلقة يختارها المعلم (للتقارير وملف الفصل وشهادات الأوائل).
   العرض فقط — الرصد الجديد (درجات الاختبارات…) يبقى على الفترة الجارية دائمًا (ctSemActive). */
const VSP_KEY='view_sp_v1';
function vspList(){
  const a=(typeof DASH_ACADEMIC!=='undefined'&&DASH_ACADEMIC)||{}, cur=Number(a.currentSemester)===2?2:1, out=[];
  for(const sn of [1,2]){ const S=(a.semesters||{})[sn]||{}; if(!S.status||S.status==='not_started') continue;
    for(const pn of [1,2]){ const closed=S.status==='closed'||(S.periodStatus||{})[pn]==='closed'||(pn===1&&Number(S.activePeriod)===2);
      const active=sn===cur&&S.status!=='closed'&&(Number(S.activePeriod)===2?2:1)===pn;
      if(closed||active) out.push({sem:sn,per:pn,closed,active}); } }
  return out;
}
function vspGet(){ try{ const v=JSON.parse(localStorage.getItem(VSP_KEY)||'null'); return v&&v.sem&&v.per?{sem:Number(v.sem)===2?2:1,per:Number(v.per)===2?2:1}:null; }catch(e){ return null; } }
function ctSem(){
  const a=ctSemActive(), v=vspGet(); if(!v||(v.sem===a.sem&&v.per===a.per)) return a;
  const hit=vspList().find(x=>x.sem===v.sem&&x.per===v.per); if(!hit) return a;
  return { sem:v.sem, per:v.per, closed:hit.closed, viewing:true };
}
/* فصل محفوظ قد لا يعود موجودًا في القوائم: تحقق منه قبل عرضه، وإلا ارجع لأول فصل (أو «الكل» عند allowAll) */
function ctValidCls(v,allowAll){ const cs=ctClasses(); if(v!=null&&v!==''&&cs.includes(v)) return v; return allowAll?'':(cs[0]||''); }
function ctClasses(){ return [...new Set((STUDENTS||[]).map(s=>String(s.cls||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar')); }
function ctRoster(cls){ return (STUDENTS||[]).filter(s=>!cls||String(s.cls||'')===cls).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar')); }
function ctToday(){ return new Date(Date.now()+3*3600000).toISOString().slice(0,10); }
function ctClassSel(id,val,onch,all=true){ return `<select class="inp" id="${id}" style="width:auto;min-width:130px" onchange="${onch}">${all?'<option value="">كل الفصول</option>':''}${ctClasses().map(c=>`<option value="${esc(c)}" ${c===val?'selected':''}>${esc(c)}</option>`).join('')}</select>`; }

async function renderClassTools(force){
  // 👤 ملف الطالب يُرسم داخل «الطلاب»: تبويباته وأزراره تستدعي renderClassTools فيُعاد رسمه هناك
  if(typeof stcActive==='function' && stcActive() && document.querySelector('#student-center-detail .stc-file')) return renderStudentCenterDetail(force?2:1);
  if(CT_TAB==='profile'){ CT_TAB='records'; stcOpen(window._ctPfSid||STUDENT_CENTER_SELECTED); return; }
  const box=document.getElementById('ct-body'), nav=document.getElementById('ct-nav'); if(!box) return;
  const V=CT_VIEWS[CT_VIEW], tabs=V?CT_TABS.filter(([k])=>V.tabs.includes(k)):CT_TABS;
  if(!tabs.some(([k])=>k===CT_TAB)) CT_TAB=tabs[0][0];
  const h=document.getElementById('ct-title'), sb=document.getElementById('ct-sub');
  if(h) h.textContent=V?V.title:'🧰 أدوات الفصل';
  if(sb) sb.textContent=V?V.sub:'المستويات ودفتر الاختبارات والسجلات والشهادات والجدول — على شاشة كبيرة. تُرصد من «✋ الرصد» وتُراجع هنا.';
  if(nav){ nav.style.display=tabs.length>1?'':'none';
    nav.innerHTML=tabs.map(([k,l])=>`<button type="button" class="btn ${k===CT_TAB?'':'ghost'} sm" onclick="CT_TAB='${k}';renderClassTools()">${l}</button>`).join(''); }
  if(force||!CT_DATA){
    box.innerHTML='<div class="muted" style="padding:1rem">⏳ جارٍ جلب بيانات الفصل من الخادم…</div>';
    try{ try{ await loadDashboardAcademic(); }catch(e){} CT_DATA=await ctLoad(); window._ctOffline=false; }
    catch(e){ if(CT_TAB!=='profile'){ box.innerHTML='<div class="ct-warn">تعذّر الاتصال بالخادم — تحقق من الاتصال ثم اضغط 🔄 تحديث.</div>'; return; } window._ctOffline=true; }
  }
  const tb=document.getElementById('ct-today-box'); if(tb) tb.innerHTML=(!CT_VIEW||CT_VIEW==='records')?ctTodayHTML():'';
  try{
    if(CT_TAB==='levels') await ctLevels(box, force);
    else if(CT_TAB==='skills') await ctSkills(box, force);
    else if(CT_TAB==='profile') await ctProfile(box, force);
    else if(CT_TAB==='exams') ctExams(box);
    else if(CT_TAB==='records') ctRecords(box);
    else if(CT_TAB==='certs'){ try{ await ctEnsureGrades(force); }catch(e){} ctCerts(box); }
    else if(CT_TAB==='classfile') await ctClassFile(box, force);
    else if(CT_TAB==='portfolio') await ctPortfolio(box, force);
    else if(CT_TAB==='duties') await ctDuties(box, force);
    else if(CT_TAB==='messages') ctMessages(box);
    else ctSchedule(box);
  }catch(e){ console.error('classTools',e); box.innerHTML='<div class="ct-warn">حدث خطأ أثناء العرض.</div>'; }
}

/* ── 📊 المستويات: من حساب الخادم نفسه (/grades) الذي تعرضه البوابة ── */
async function ctLevels(box, force){
  const {sem,per}=ctSem();
  if(force||!CT_GRADES){ box.innerHTML='<div class="muted" style="padding:1rem">⏳ جارٍ حساب المستويات…</div>'; await ctEnsureGrades(true); }
  const cls=ctValidCls(window._ctLvCls,true), q=String(window._ctLvQ||'').trim();
  const M=CT_GRADES.mastery||{excellent:85,near:70};
  const rows=ctRoster(cls).map(s=>({s,l:(CT_GRADES.map&&CT_GRADES.map[String(s.id)]?.level)||{measured:false}})).filter(x=>!q||String(x.s.name).includes(q));
  const groups=['متقن','قريب من الإتقان','يحتاج دعم'];
  const cnt=g=>rows.filter(x=>x.l.status===g).length, un=rows.filter(x=>!x.l.measured).length;
  const tone={ 'متقن':'tick','قريب من الإتقان':'warn','يحتاج دعم':'bad' };
  const order=x=>!x.l.measured?3:x.l.status==='يحتاج دعم'?0:x.l.status==='قريب من الإتقان'?1:2;
  rows.sort((a,b)=>order(a)-order(b)||((a.l.rate??999)-(b.l.rate??999)));
  // 🔎 بطاقات العدّ مرشِّحات: الضغط على «يحتاج دعم» يعرض هؤلاء فقط (والضغط ثانيةً يلغي)
  const F=window._ctLvF||'', shown=F?rows.filter(x=>F==='__un'?!x.l.measured:x.l.status===F):rows, tot=Math.max(1,rows.length);
  const kpi=(key,label,c,tn)=>`<button type="button" class="ct-kpi ${tn||''} ${F===key?'on':''}" onclick="window._ctLvF=${JSON.stringify(F===key?'':key).replace(/"/g,'&quot;')};renderClassTools()" title="اعرض ${label} فقط"><b>${c}</b><span>${label}</span></button>`;
  box.innerHTML=`<div class="row ct-tools">${ctClassSel('ct-lv-cls',cls,"window._ctLvCls=this.value;renderClassTools()")}
      <input class="inp" type="search" placeholder="🔍 ابحث بالاسم" value="${esc(q)}" oninput="window._ctLvQ=this.value;clearTimeout(window._ctLvT);window._ctLvT=setTimeout(()=>{renderClassTools();setTimeout(()=>{const e=document.querySelector('#ct-body input[type=search]');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length)}},0)},250)" style="flex:1;min-width:160px">
      <span class="muted" style="font-size:.78rem">الفصل ${sem===1?'الأول':'الثاني'} · الفترة ${per===1?'الأولى':'الثانية'}</span><button class="btn tick sm" onclick="ctLvReportPick(ctValidCls(window._ctLvCls,true))">📊 تقرير مختصر</button></div>
    <div class="ct-kpis lv-kpis">${groups.map(g=>kpi(g,g,cnt(g),tone[g])).join('')}${kpi('__un','لم يُقَس بعد',un,'')}</div>
    <div class="sk-bar lv-bar" role="img" aria-label="${groups.map(g=>g+' '+cnt(g)).join('، ')}، لم يُقَس ${un}">${cnt('متقن')?`<i class="ok" style="flex:${cnt('متقن')}"></i>`:''}${cnt('قريب من الإتقان')?`<i class="mid" style="flex:${cnt('قريب من الإتقان')}"></i>`:''}${cnt('يحتاج دعم')?`<i class="weak" style="flex:${cnt('يحتاج دعم')}"></i>`:''}${un?`<i class="un" style="flex:${un}"></i>`:''}</div>
    <div class="sk-leg" style="margin:.3rem 0 .2rem"><span class="ok">متقن ${Math.round(cnt('متقن')/tot*100)}%</span><span class="mid">قريب ${Math.round(cnt('قريب من الإتقان')/tot*100)}%</span><span class="weak">يحتاج دعم ${Math.round(cnt('يحتاج دعم')/tot*100)}%</span>${F?`<span class="muted">يُعرض: ${F==='__un'?'لم يُقَس بعد':esc(F)} فقط — اضغط البطاقة ثانيةً لعرض الكل</span>`:''}</div>
    <div class="muted" style="font-size:.76rem;margin:.2rem 0 .6rem">من نسبة الإجابات الصحيحة في أنشطة الفترة: ${M.excellent}% فأكثر «متقن» · ${M.near}%–${M.excellent-1}% «قريب من الإتقان» · أقل «يحتاج دعم». الاتجاه: أول أنشطة الفترة مقابل آخرها. النسب أعلاه ${q?'من نتائج البحث':'من كل الفصل'} (تشمل غير المقيسين).</div>
    ${!cls?ctClassCompare():''}
    ${(()=>{const dn=rows.filter(x=>x.l.measured&&x.s&&ctG(x.s.id).trend&&ctG(x.s.id).trend.measurable&&ctG(x.s.id).trend.change<=-10&&x.l.status!=='يحتاج دعم');return dn.length?`<div class="ct-warn" style="margin-bottom:.6rem">⚠️ يتراجعون قبل أن يصلوا «يحتاج دعم»: ${dn.map(x=>ctNameLink(x.s)+' '+ctTrendHTML(ctG(x.s.id).trend)).join(' · ')}</div>`:''})()}
    <div class="ct-table"><table><thead><tr><th>الطالب</th><th>الفصل</th><th>المستوى</th><th>النسبة</th><th>الاتجاه</th><th>الأساس</th><th></th></tr></thead><tbody>
    ${shown.map(x=>`<tr><td><b>${ctNameLink(x.s)}</b></td><td class="muted">${esc(x.s.cls||'')}</td>
      <td>${x.l.measured?`<span class="chip ${tone[x.l.status]||'ghost'}">${esc(x.l.status||x.l.label||'')}</span>`:'<span class="chip ghost">لم يُقَس</span>'}</td>
      <td>${x.l.measured?`<b>${x.l.rate}%</b>`:'—'}</td><td>${ctTrendHTML(ctG(x.s.id).trend)}</td>
      <td class="muted" style="font-size:.78rem">${x.l.measured?`${x.l.correct} من ${x.l.total} سؤالًا في ${x.l.count} نشاط`:'لم يحل أي نشاط في الفترة'}</td>
      <td>${x.l.measured&&x.l.status==='يحتاج دعم'?`<button class="btn tick sm" onclick="ctPlanFor('${esc(x.s.id)}','${esc(String(x.l.rate))}')">＋ خطة</button>`:''}</td></tr>`).join('')||'<tr><td colspan="7" class="muted">لا يوجد طلاب.</td></tr>'}
    </tbody></table></div>`;
}
/* مقارنة الفصول: متوسط الإتقان وتوزيع المستويات */
function ctClassCompare(){
  const rows=ctClasses().map(c=>{ const r=ctRoster(c).map(s=>ctG(s.id).level||{}).filter(l=>l.measured);
    const c2=k=>r.filter(l=>l.status===k).length, tot=r.reduce((a,l)=>a+(l.total||0),0), cor=r.reduce((a,l)=>a+(l.correct||0),0);
    return { c, n:r.length, avg:tot?Math.round(cor/tot*100):null, m:c2('متقن'), q:c2('قريب من الإتقان'), w:c2('يحتاج دعم') }; }).filter(x=>x.n);
  if(rows.length<2) return '';
  return `<div class="ct-cmp">${rows.map(x=>`<div class="ct-cmp-r"><b>${esc(x.c)}</b><span class="ct-cmp-bar" title="متقن ${x.m} · قريب ${x.q} · يحتاج دعم ${x.w}"><i class="t" style="flex:${x.m}"></i><i class="w" style="flex:${x.q}"></i><i class="b" style="flex:${x.w}"></i></span><span>${x.avg==null?'—':x.avg+'%'}</span></div>`).join('')}</div>`;
}

/* ── 📝 دفتر الاختبارات: الاختبارات وتواريخها ودرجاتها — نفس examBooks في البوابة ── */
function ctBook(d,sem,per){
  d.examBooks=d.examBooks&&typeof d.examBooks==='object'?d.examBooks:{};
  const root=d.examBooks[String(sem)]=d.examBooks[String(sem)]||{};
  const b=root[String(per)]=root[String(per)]||{tests:[],scores:{}};
  b.tests=Array.isArray(b.tests)?b.tests:[]; b.scores=b.scores&&typeof b.scores==='object'?b.scores:{};
  return b;
}
/* دفتر الاختبارات: فترة مغلقة للعرض فقط — درجاتها المعتمدة (الكشوف، ولي الأمر، الشهادات) من لقطة الإغلاق، فالتعديل بعده لا يصل إليها */
function ctExamSP(){ const a=ctSemActive(), sem=Number(window._ctExSem||a.sem)===2?2:1, per=Number(window._ctExPer||a.per)===2?2:1;
  const S=((typeof DASH_ACADEMIC!=='undefined'&&DASH_ACADEMIC)||{}).semesters?.[sem]||{};
  const closed=S.status==='closed'||(S.periodStatus||{})[per]==='closed'||(per===1&&Number(S.activePeriod)===2);
  return { sem, per, closed }; }
/* 📱 «رصد» (مثل بوابة المعلم: اختبار ظاهر، لوحة أرقام، صوت، كاميرا التصحيح الآلي) · 📊 «جدول» (كل الاختبارات) */
function ctExMode(){ const v=window._ctExMode||(()=>{ try{ return localStorage.getItem('ct_ex_mode_v1'); }catch(e){ return ''; } })(); return v==='table'||v==='rec'?v:(innerWidth<900?'rec':'table'); }
/* ملف الرصد كبير (محرّك الكاميرا): يُحمَّل عند أول حاجة فقط، بنسخته من index.html */
const TPX_LOADS={};
/* نافذة تضيفها الصفحات المنقولة (الاختبارات/الجدول/الرسائل) خارج منطقتها (body): تنسيقاتها محصورة في .tpx،
   فبدون هذه العلامة كانت تُضاف بلا تنسيق (مثل «عرض الورقة المصححة» لا تظهر). .tpx نفسها متغيرات ألوان فقط */
function tpxOwn(el){ try{ if(el&&el.classList) el.classList.add('tpx'); }catch(e){} return el; }
function tpxLoadPart(js,css,flag){
  if(window[flag]) return Promise.resolve();
  if(TPX_LOADS[js]) return TPX_LOADS[js];
  const href=f=>{ const l=document.querySelector(`link[data-tpx="${f}"]`); return l?l.getAttribute('href'):f; };
  return TPX_LOADS[js]=new Promise((ok,no)=>{
    if(!document.querySelector(`link[rel=stylesheet][data-tpx-css="${css}"]`)){ const c=document.createElement('link'); c.rel='stylesheet'; c.href=href(css); c.dataset.tpxCss=css; document.head.appendChild(c); }
    const s=document.createElement('script'); s.src=href(js); s.onload=()=>ok(); s.onerror=()=>{ delete TPX_LOADS[js]; no(new Error('load')); }; document.head.appendChild(s); });
}
function tpxLoad(){ return tpxLoadPart('js/41-exams-record.js','exams-record.css','TPX_READY'); }
/* 🗓️ الجدول وتنبيه الحصص وتذكيراتي (js/42-schedule.js) */
function tpx3Load(){ return tpxLoadPart('js/42-schedule.js','schedule.css','TPX3_READY'); }
/* 💌 رسائل الحصة للطلاب (js/43-messages.js) */
function tpx4Load(){ return tpxLoadPart('js/43-messages.js','messages.css','TPX4_READY'); }
function ctMessages(box){
  const cls=ctValidCls(window._ctMsCls);
  box.innerHTML=`<div class="row ct-tools">${ctClassSel('ct-ms-cls',cls,"window._ctMsCls=this.value;renderClassTools()",false)}</div><div id="tpx4-box"><div class="feature-empty" style="padding:1.2rem">جارٍ الفتح…</div></div>`;
  tpx4Load().then(()=>{ const b=document.getElementById('tpx4-box'); if(b&&b.isConnected) window.tpx4Mount(b); })
    .catch(()=>{ const b=document.getElementById('tpx4-box'); if(b) b.innerHTML='<div class="feature-empty" style="padding:1.2rem">تعذّر التحميل — تحقق من الاتصال ثم <a href="#" onclick="event.preventDefault();renderClassTools()">أعد المحاولة</a>.</div>'; });
}
function tpx3Mount(box,fn){
  box.innerHTML='<div id="tpx3-box"><div class="feature-empty" style="padding:1.2rem">جارٍ الفتح…</div></div>';
  tpx3Load().then(()=>{ const b=document.getElementById('tpx3-box'); if(b&&b.isConnected) window[fn](b); })
    .catch(()=>{ const b=document.getElementById('tpx3-box'); if(b) b.innerHTML='<div class="feature-empty" style="padding:1.2rem">تعذّر التحميل — تحقق من الاتصال ثم <a href="#" onclick="event.preventDefault();renderClassTools()">أعد المحاولة</a>.</div>'; });
}
/* يُحمَّل ملف الجدول وحده بعد فتح اللوحة إن احتاجه شيء يعمل في الخلفية:
   «الرصد التلقائي» (يُنهي الحصص في وقتها) · تنبيه الحصص · تذكيراتي (تُرسل مواعيدها للخادم ليصل الإشعار) */
function tpx3Need(){ try{ if(window.TPX3_READY||!CT_DATA) return false; let pp=false; try{ pp=localStorage.getItem('tp_push_on_v1')==='1'; }catch(e){}
  return !!((CT_DATA.schedule&&CT_DATA.schedule.auto)||(Array.isArray(CT_DATA.reminders)&&CT_DATA.reminders.length)||pp); }catch(e){ return false; } }
setInterval(()=>{ if(tpx3Need()) tpx3Load().catch(()=>{}); },20000);
function ctExams(box){
  const mode=ctExMode(), seg=`<span class="ct-seg ct-ex-mode"><button type="button" class="${mode==='rec'?'on':''}" onclick="ctExModeSet('rec')">📱 رصد</button><button type="button" class="${mode==='table'?'on':''}" onclick="ctExModeSet('table')">📊 جدول</button></span>`;
  if(mode==='rec'){
    const cls=ctValidCls(window._ctExCls);
    box.innerHTML=`<div class="row ct-tools">${ctClassSel('ct-ex-cls',cls,"window._ctExCls=this.value;renderClassTools()",false)}${seg}</div><div id="tpx-box"><div class="feature-empty" style="padding:1.2rem">جارٍ فتح الرصد…</div></div>`;
    tpxLoad().then(()=>{ const b=document.getElementById('tpx-box'); if(b&&b.isConnected) window.tpxExamsMount(b); })
      .catch(()=>{ const b=document.getElementById('tpx-box'); if(b) b.innerHTML='<div class="feature-empty" style="padding:1.2rem">تعذّر تحميل صفحة الرصد — تحقق من الاتصال ثم <a href="#" onclick="event.preventDefault();renderClassTools()">أعد المحاولة</a>.</div>'; });
    return;
  }
  ctExamsTable(box,seg);
}
function ctExamsTable(box,seg){
  const {sem,per,closed}=ctExamSP(), cls=ctValidCls(window._ctExCls);
  const b=ctBook(JSON.parse(JSON.stringify(CT_DATA)),sem,per), max=b.tests.reduce((t,x)=>t+Math.max(0,Number(x.max)||0),0);
  const dis=closed?'disabled':'';
  const sc=(sid,tid)=>{ const v=b.scores[String(sid)]&&b.scores[String(sid)][String(tid)]; const n=v&&typeof v==='object'?Number(v.score):Number(v); return Number.isFinite(n)?n:''; };
  const raw=sid=>b.tests.reduce((t,x)=>{const v=sc(sid,x.id);return t+(v===''?0:Math.min(Number(x.max)||0,v))},0);
  const has=sid=>b.tests.some(x=>sc(sid,x.id)!=='');
  box.innerHTML=`<div class="row ct-tools">
      <select class="inp" style="width:auto" onchange="window._ctExSem=this.value;renderClassTools()"><option value="1" ${sem===1?'selected':''}>الفصل الأول</option><option value="2" ${sem===2?'selected':''}>الفصل الثاني</option></select>
      <select class="inp" style="width:auto" onchange="window._ctExPer=this.value;renderClassTools()"><option value="1" ${per===1?'selected':''}>الفترة الأولى</option><option value="2" ${per===2?'selected':''}>الفترة الثانية</option></select>
      ${closed?'<span class="chip bad" title="الدرجات المعتمدة لهذه الفترة من لقطة الإغلاق — التعديل بعده لا يصل إلى الكشوف ولا ولي الأمر">🔒 الفترة مغلقة — للعرض فقط</span>':''}${seg||''}</div>
    <div class="ct-card"><div class="row" style="justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap"><b>الاختبارات (${b.tests.length}) · مجموعها ${max} ← يُحوَّل إلى 20</b>
      <button class="btn tick sm" ${dis} onclick="ctExamAdd()">＋ اختبار</button></div>
      <div class="muted" style="font-size:.76rem;margin:.25rem 0 .5rem">📅 تاريخ الاختبار تعتمد عليه الخطط العلاجية في القياس قبل الخطة وبعدها — حدّده لكل اختبار.</div>
      ${b.tests.map((t,i)=>`<div class="ct-test"><input class="inp" value="${esc(t.title||('اختبار '+(i+1)))}" maxlength="80" ${dis} onchange="ctExamEdit('${esc(t.id)}','title',this.value)" aria-label="اسم الاختبار">
        <label>الدرجة<input class="inp" type="number" min="1" max="100" step="0.5" value="${Number(t.max)||10}" ${dis} onchange="ctExamEdit('${esc(t.id)}','max',this.value)"></label>
        <label>التاريخ<input class="inp" type="date" value="${esc(t.date||'')}" ${dis} onchange="ctExamEdit('${esc(t.id)}','date',this.value)"></label>
        ${t.date?'':'<span class="chip warn" title="بلا تاريخ تُحسب درجاته بتاريخ رصدها">بلا تاريخ</span>'}
        <button class="btn ghost sm" ${dis} title="حذف الاختبار ودرجاته" aria-label="حذف" onclick="ctExamDel('${esc(t.id)}')">🗑️</button></div>`).join('')||'<div class="muted">لا اختبارات بعد — أضف أول اختبار.</div>'}</div>
    ${b.tests.length?`<div class="row ct-tools" style="margin-top:.8rem">${ctClassSel('ct-ex-cls',cls,"window._ctExCls=this.value;renderClassTools()",false)}<span class="muted" style="font-size:.78rem">الدرجة تُحفظ عند الخروج من الخانة · فارغ = لم يُرصد</span><span class="spacer"></span>
      <label class="row" style="gap:.3rem;font-size:.8rem;cursor:pointer"><input type="checkbox" ${window._ctExMiss?'checked':''} onchange="window._ctExMiss=this.checked;renderClassTools()"> إبراز غير المرصود</label>
      <button class="btn ghost sm" onclick="ctExamExport()">⬇️ تصدير Excel</button>
      <button class="btn ghost sm" onclick="ctExamHistory()" title="آخر تعديلات الدرجات مع إمكانية الإرجاع">🕘 سجل التعديلات${(b.log||[]).length?` (${(b.log||[]).length})`:''}</button></div>
    ${ctExamStatsHTML(ctExamStats(b,ctRoster(cls)))}
    <div class="ct-table ${window._ctExMiss?'ct-miss-on':''}"><table><thead><tr><th>الطالب</th>${b.tests.map(t=>`<th>${esc(t.title||'اختبار')}<br><small class="muted">من ${Number(t.max)||10}</small>${closed?'':`<br><button class="btn ghost sm" style="margin-top:.2rem" onclick="ctExamPaste('${esc(t.id)}')" title="لصق عمود درجات من Excel">📋 لصق</button>`}</th>`).join('')}<th>المجموع</th><th>من 20</th></tr></thead><tbody>
    ${ctRoster(cls).map(s=>`<tr><td><b>${ctNameLink(s)}</b></td>${b.tests.map(t=>`<td><input class="inp ct-sc ${sc(s.id,t.id)===''?'empty':''}" type="number" min="0" max="${Number(t.max)||10}" step="0.25" value="${sc(s.id,t.id)}" ${dis} ${(h=>h?`title="${esc(h)}" data-log="1"`:'')(ctExamCellHint(b,s.id,t.id))} onchange="ctExamScore('${esc(s.id)}','${esc(t.id)}',this)"></td>`).join('')}
      <td class="ct-raw" data-sid="${esc(s.id)}">${has(s.id)?raw(s.id):'—'}</td><td class="ct-20" data-sid="${esc(s.id)}"><b>${has(s.id)&&max>0?+(raw(s.id)/max*20).toFixed(2):'—'}</b></td></tr>`).join('')||`<tr><td colspan="${b.tests.length+3}" class="muted">لا طلاب في هذا الفصل.</td></tr>`}
    </tbody></table></div><div class="muted" style="font-size:.74rem;margin-top:.3rem">«من 20» هنا قبل بطاقات رفع الدرجة؛ الدرجة النهائية بعدها تظهر في الكشوف.</div>`:''}`;
}
function ctExamFmt(v){ return v===null||v===undefined||v===''?'فارغ':String(+Number(v).toFixed(2)); }
function ctExamWhen(ms){ try{ return new Date(ms).toLocaleString('ar-SA-u-ca-gregory',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}); }catch(e){ return ''; } }
function ctExamCellHint(b,sid,tid){
  const L=(b.log||[]).filter(e=>e.sid===String(sid)&&e.tid===String(tid)).slice(0,3);
  return L.length?'آخر التعديلات:\n'+L.map(e=>`${ctExamFmt(e.from)} ← ${ctExamFmt(e.to)} · ${ctExamWhen(e.at)}`).join('\n'):'';
}

/* ── 🗂️ السجلات: مراجعة الرصد وتعديله حسب الفصل والتاريخ ── */
const CT_PART=['شارك','لم يشارك','غائب','غائب بعذر'], CT_HW=['أنجز','لم ينجز','معذور'];
function ctRecords(box){
  if(!window._ctRcClsUser&&typeof qrLesson==='function'){ const L=qrLesson(); if(L&&L.now&&(!window._ctRcD||window._ctRcD===ctToday())) window._ctRcCls=L.cls; }   // الحصة الجارية تُختار وحدها
  const cls=ctValidCls(window._ctRcCls), d=window._ctRcD||ctToday(), D=CT_DATA||{};
  const st=(m,sid)=>{ const r=D[m]&&D[m][d]&&D[m][d][String(sid)]; return String((r&&(typeof r==='string'?r:r.status))||''); };
  const roster=ctRoster(cls);
  const beh=(Array.isArray(D.behavior)?D.behavior:[]).filter(x=>x&&!x.deleted&&x.date===d&&roster.some(s=>String(s.id)===String(x.studentId)));
  const sel=(m,sid,opts)=>`<select class="inp ct-st ${st(m,sid)?'on':''}" onchange="ctSetStatus('${m}','${esc(sid)}',this.value)"><option value="">—</option>${opts.map(o=>`<option ${st(m,sid)===o?'selected':''}>${o}</option>`).join('')}</select>`;
  const c=(m,v)=>roster.filter(s=>st(m,s.id)===v).length;
  const view=window._ctRcView||'day', al=ctAlerts(cls);
  const top=`<div class="row ct-tools">${ctClassSel('ct-rc-cls',cls,"window._ctRcCls=this.value;window._ctRcClsUser=1;renderClassTools()",false)}
      <span class="ct-seg"><button type="button" class="${view==='day'?'on':''}" onclick="window._ctRcView='day';renderClassTools()">يوم</button><button type="button" class="${view==='month'?'on':''}" onclick="window._ctRcView='month';renderClassTools()">شهر</button></span>
      ${view==='month'?`<input class="inp" type="month" value="${esc(window._ctRcM||ctToday().slice(0,7))}" style="width:auto" onchange="window._ctRcM=this.value;renderClassTools()">`:''}</div>
    ${al.length?`<details class="ct-alerts" ${window._ctAlOpen!==false?'open':''} ontoggle="window._ctAlOpen=this.open"><summary>🔔 تنبيهات الانضباط (${al.length})</summary>${al.map(a=>`<div class="ct-al ${a.lvl}">${ctNameLink(a.s)} — ${esc(a.t)}</div>`).join('')}</details>`:''}`;
  if(view==='month'){ box.innerHTML=top+ctRecordsMonth(box); return; }
  // ✋ الرصد السريع (js/40-quick-record.js): لمسة فورية + طابور لا يضيع دون شبكة
  if(typeof qrDayHTML==='function'){ box.innerHTML=top+qrDayHTML(); qrPaint(); return; }
  box.innerHTML=top+`<div class="row ct-tools">
      <input class="inp" type="date" value="${esc(d)}" style="width:auto" onchange="window._ctRcD=this.value;renderClassTools()">
      <button class="btn ghost sm" onclick="ctAllPresent()" title="يرصد «شارك» لكل من لم يُرصد له شيء في هذا اليوم">✅ الكل شارك</button>
      <span class="muted" style="font-size:.78rem">شارك ${c('participation','شارك')} · لم يشارك ${c('participation','لم يشارك')} · غائب ${c('participation','غائب')}${c('participation','غائب بعذر')?` (منه بعذر ${c('participation','غائب بعذر')})`:''} · أنجز الواجب ${c('homework','أنجز')} · لم ينجز ${c('homework','لم ينجز')}</span></div>
    <div class="ct-table"><table><thead><tr><th>الطالب</th><th>الحضور والمشاركة</th><th>الواجب</th></tr></thead><tbody>
      ${roster.map(s=>`<tr><td><b>${ctNameLink(s)}</b></td><td>${sel('participation',s.id,CT_PART)}</td><td>${sel('homework',s.id,CT_HW)}</td></tr>`).join('')||'<tr><td colspan="3" class="muted">لا طلاب في هذا الفصل.</td></tr>'}
    </tbody></table></div>
    <div class="ct-card" style="margin-top:.7rem"><b>📝 ملاحظات السلوك في هذا اليوم (${beh.length})</b>
      ${beh.map(x=>{const s=roster.find(a=>String(a.id)===String(x.studentId));return `<div class="ct-beh"><span>${x.type==='positive'?'🌟':'⚠️'} <b>${esc(s?s.name:'')}</b> — ${esc([x.category,x.note].filter(Boolean).join(' — ')||'')}</span><button class="btn ghost sm" onclick="ctBehDel('${esc(String(x.id))}')" title="حذف الملاحظة">🗑️</button></div>`}).join('')||'<div class="muted" style="font-size:.82rem">لا ملاحظات.</div>'}
      <div class="muted" style="font-size:.74rem;margin-top:.3rem">إضافة الملاحظات من «✋ الرصد» ← السلوك؛ هنا المراجعة والتصحيح.</div></div>`;
}

/* ── 🏅 الشهادات: سجلّها، وإصدار جديد، وطباعة رسمية بالترويسة ── */
function ctCerts(box){
  const D=CT_DATA||{}, cls=ctValidCls(window._ctCeCls,true);
  window._ctCeDraft={st:document.getElementById('ct-ce-st')?.value||'',reason:document.getElementById('ct-ce-reason')?.value||''};
  const list=(Array.isArray(D.certificates)?D.certificates:[]).filter(x=>x&&!x.deleted).map(x=>({x,s:(STUDENTS||[]).find(a=>String(a.id)===String(x.studentId))}))
    .filter(r=>r.s&&(!cls||String(r.s.cls||'')===cls)).sort((a,b)=>(Number(b.x.at)||0)-(Number(a.x.at)||0));
  window._ctCeSel=window._ctCeSel||new Set();
  const cand=ctCertCandidates(cls);
  const _orphans=(Array.isArray(D.certificates)?D.certificates:[]).filter(x=>x&&!x.deleted&&!(STUDENTS||[]).some(a=>String(a.id)===String(x.studentId))).length;
  const _totalCerts=(Array.isArray(D.certificates)?D.certificates:[]).filter(x=>x&&!x.deleted&&(STUDENTS||[]).some(a=>String(a.id)===String(x.studentId))).length;
  const _visSel=[...window._ctCeSel].filter(id=>list.some(r=>String(r.x.id)===id));
  box.innerHTML=`${cand.length?`<div class="ct-card" style="margin-bottom:.7rem"><b>✨ مرشحون للتكريم من بياناتك (${cand.length})</b>
      <div class="muted" style="font-size:.76rem;margin:.2rem 0 .4rem">إتقان: مستوى «متقن» في نتيجتين فأكثر · تحسّن: +15 نقطة فأكثر · خطة: خطة منتهية ناجحة · انضباط: حضور كامل 10 أيام فأكثر وكل الواجبات (3 فأكثر) منجزة. من كُرّم خلال آخر 45 يومًا يظهر في الآخر.</div>
      ${cand.slice(0,15).map(c=>`<div class="ct-cand"><span>${ctNameLink(c.s)} <span class="muted">${esc(c.s.cls||'')}</span> ${c.why.map(w=>`<span class="chip tick" title="${esc(w[1])}">${esc(w[0])}</span>`).join(' ')}${c.had?' <span class="chip ghost">كُرّم مؤخرًا</span>':''}<br><small class="muted">${c.why.map(w=>esc(w[1])).join(' · ')}</small></span>
        <button class="btn tick sm" onclick='ctCertQuick(${JSON.stringify(String(c.s.id))},${JSON.stringify(c.why.map(w=>CT_CERT_REASON[w[0]]).filter(Boolean).join('، '))})'>🏅 إصدار</button></div>`).join('')}${cand.length>15?`<div class="muted" style="font-size:.76rem">و${cand.length-15} مرشحًا آخر</div>`:''}</div>`:''}
    <div class="ct-card"><b>＋ شهادة جديدة</b>
      <div class="row" style="gap:.45rem;flex-wrap:wrap;margin-top:.45rem">
        <select class="inp" id="ct-ce-st" style="flex:1;min-width:200px"><option value="">اختر الطالب…</option>${ctRoster(cls).map(s=>`<option value="${esc(s.id)}" ${String(s.id)===String(window._ctCeDraft?.st||'')?'selected':''}>${esc(s.name)}${s.cls?' — '+esc(s.cls):''}</option>`).join('')}</select>
        <input class="inp" id="ct-ce-reason" placeholder="سبب التكريم" value="${esc(window._ctCeDraft?.reason||'التميز والمشاركة الفاعلة')}" style="flex:1;min-width:200px">
        <button class="btn tick sm" onclick="ctCertAdd()">إصدار وطباعة</button></div></div>
    <div class="row ct-tools" style="margin-top:.7rem">${ctClassSel('ct-ce-cls',cls,"window._ctCeCls=this.value;window._ctCeSel=new Set();renderClassTools()")}
      <span class="muted" style="font-size:.78rem">${list.length} شهادة${cls?' في الفصل المختار':''}</span><span class="spacer"></span>
      <select class="inp" style="width:auto" title="تصميم الشهادة" onchange="ctCertSetTpl(this.value)">${[['moe','🇸🇦 تصميم الوزارة — شكر وتقدير'],['classic','تصميم كلاسيكي'],['gold','تصميم ذهبي'],['modern','تصميم حديث']].map(([v,t])=>`<option value="${v}" ${ctCertTpl()===v?'selected':''}>${t}</option>`).join('')}</select>
      ${ctCertTpl()==='moe'?`<button class="btn ghost sm" onclick="ctCertMoeSettings()" title="عبارة ما قبل الاسم وسطر الدعاء وصاحبا التوقيع">⚙️ نص الشهادة</button>`:''}
      <button class="btn ghost sm" ${_visSel.length?'':'disabled'} onclick="ctCertShare()" title="يرسل الشهادات المحددة إلى بوابة كل طالب ليحفظها أو يطبعها">📤 إرسال المحدد للبوابة</button>
      <button class="btn sm" ${_visSel.length?'':'disabled'} onclick="ctCertPrint()">🖨️ طباعة المحدد (${_visSel.length})</button></div>
    ${_orphans?`<div class="muted" style="font-size:.78rem;margin-bottom:.4rem">⚠️ ${_orphans} شهادة لطلاب محذوفين — لا تظهر في الجدول</div>`:''}
    <div class="ct-table"><table><thead><tr><th></th><th>الطالب</th><th>الفصل</th><th>السبب</th><th>التاريخ</th><th></th></tr></thead><tbody>
      ${list.map(r=>`<tr><td><input type="checkbox" ${window._ctCeSel.has(String(r.x.id))?'checked':''} onchange="this.checked?_ctCeSel.add('${esc(String(r.x.id))}'):_ctCeSel.delete('${esc(String(r.x.id))}');renderClassTools()"></td>
        <td><b>${esc(r.s.name)}</b></td><td class="muted">${esc(r.s.cls||'')}</td><td>${esc(r.x.reason||'')}</td><td class="muted">${esc(String(r.x.date||'').replace(/-/g,'/'))}</td>
        <td>${(()=>{ const L=ctCertLeft(r.x); return L>0?`<span class="chip tick" title="الطالب يراها في بوابته ويستطيع حفظها وطباعتها — تختفي بعد 7 أيام من الإرسال">📤 في البوابة · ${L===1?'يوم':L===2?'يومان':L+' أيام'}</span> `:r.x.shared?'<span class="chip ghost" title="انتهت أيامها السبعة في بوابة الطالب — أعد إرسالها إن أردت">⌛ انتهى عرضها</span> ':''; })()}<button class="btn ghost sm" onclick="ctCertPrint(['${esc(String(r.x.id))}'])" aria-label="طباعة" title="طباعة">🖨️</button><button class="btn ghost sm" onclick="ctCertShare(['${esc(String(r.x.id))}'],${ctCertLeft(r.x)>0?'false':'true'})" title="${ctCertLeft(r.x)>0?'سحبها من بوابة الطالب':r.x.shared?'إعادة إرسالها إلى بوابة الطالب (7 أيام جديدة)':'إرسالها إلى بوابة الطالب ليحفظها أو يطبعها بنفسه (تبقى 7 أيام)'}" aria-label="إرسال إلى بوابة الطالب أو سحبها">${ctCertLeft(r.x)>0?'↩️':'📤'}</button><button class="btn ghost sm" onclick="ctCertMsg('${esc(String(r.x.id))}')" aria-label="نسخ رسالة لولي الأمر" title="نسخ رسالة لولي الأمر">✉️</button><button class="btn ghost sm" onclick="ctCertDel('${esc(String(r.x.id))}')" aria-label="حذف" title="حذف">🗑️</button></td></tr>`).join('')||`<tr><td colspan="6" class="muted">${_totalCerts?'لا شهادات في هذا الفصل — جرّب فصلًا آخر.':'لا شهادات بعد — تُصدر من هنا.'}</td></tr>`}
    </tbody></table></div>`;
}
const CT_MOE_KEY='ct_cert_moe_v1';
const CT_MOE_DEF={ pre:'تتقدم إدارة {المدرسة} ومعلم مادة {المادة} بالشكر والتقدير للطالب', dua:'سائلين المولى له دوام التوفيق والنجاح',
  rTitle:'معلم المادة', rName:'{المعلم}', lTitle:'مدير المدرسة', lName:'{المدير}' };
function ctCertTpl(){ try{ return window._ctCeTpl||localStorage.getItem('ct_cert_tpl_v1')||'moe'; }catch(e){ return window._ctCeTpl||'moe'; } }
function ctMoeCfg(){ try{ return Object.assign({},CT_MOE_DEF,JSON.parse(localStorage.getItem(CT_MOE_KEY)||'{}')); }catch(e){ return {...CT_MOE_DEF}; } }
function ctMoeFill(t,s){
  return String(t||'').replace(/\{المدرسة\}/g,rcGet('school')||'المدرسة').replace(/\{المادة\}/g,rcGet('subject')||'العلوم')
    .replace(/\{المعلم\}/g,rcGet('teacher')||'').replace(/\{المدير\}/g,rcGet('principal')||'').replace(/\{الفصل\}/g,(s&&s.cls)||'').replace(/\s+/g,' ').trim();
}
/* 🏅 شهادات المتجر (يشتريها الطالب بـ 1500 نقطة) تصدر من الخادم بنص شهادتك وتوقيعاتك نفسها:
   يُرسل النص بعد ملء المدرسة والمادة والمعلم والمدير، ويبقى {الفصل} ليُملأ لكل طالب. يُرسل فقط إذا تغيّر. */
async function ctCertTplPush(){
  const api=getApi(), tok=getTok(); if(!api||!tok) return;
  const k=ctMoeCfg(), s={cls:'{الفصل}'};
  const tpl={pre:ctMoeFill(k.pre,s),dua:ctMoeFill(k.dua,s),rTitle:ctMoeFill(k.rTitle,s),rName:ctMoeFill(k.rName,s),lTitle:ctMoeFill(k.lTitle,s),lName:ctMoeFill(k.lName,s)};
  const sig=JSON.stringify(tpl); try{ if(localStorage.getItem('ct_cert_tpl_pushed_v1')===sig) return; }catch(e){}
  try{ const r=await fetch(`${api}/cert-tpl`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:tok,tpl})});
    if(r.ok) try{ localStorage.setItem('ct_cert_tpl_pushed_v1',sig); }catch(e){} }catch(e){}
}
/* التاريخ هجريًا (أم القرى) مع الميلادي، والفصل يُذكر فقط إن كان فصلًا فعليًا (مثل 2/1) */
function ctCertDateLine(d){
  const g=String(d||'').replace(/-/g,'/').replace(/\d/g,x=>'٠١٢٣٤٥٦٧٨٩'[x]); let h='';
  // الهجري بترتيب الميلادي نفسه (سنة/شهر/يوم) حتى لا يظهر مقلوبًا بجانبه
  try{ const t=Date.parse(String(d||'')+'T12:00:00Z'); if(t){ const P=Object.fromEntries(new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',{day:'numeric',month:'numeric',year:'numeric'}).formatToParts(new Date(t)).map(x=>[x.type,x.value]));
    if(P.year&&P.month&&P.day) h=`${P.year}/${P.month}/${P.day}`.replace(/\s*هـ/,'').replace(/\u200f/g,''); } }catch(e){}
  return h?`حُررت في ${h}هـ الموافق ${g}م`:(g?`حُررت في ${g}م`:'');
}

/* ── 🗓️ الجدول الأسبوعي: أي فصل في أي حصة. الأوقات والتنبيهات تبقى في البوابة ── */
const CT_DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
function ctSch(D){
  const s=(D.schedule&&typeof D.schedule==='object')?D.schedule:{};
  return { count:Math.max(4,Math.min(8,Number(s.count)||7)), grid:(s.grid&&typeof s.grid==='object')?s.grid:{} };
}
function ctSchedule(box){ tpx3Mount(box,'tpx3ScheduleMount'); }

/* ═══════════ 🧰 أدوات الفصل — الإضافات المتقدمة ═══════════ */
async function ctEnsureGrades(force){
  const {sem,per}=ctSem();
  if(!force&&!CT_GRADES){   // 💾 آخر نسخة على هذا الجهاز تُعرض فورًا، والجديدة تُجلب في الخلفية ثم يُعاد الرسم
    const st=await ctGradesStoreGet(sem,per);
    if(st&&!CT_GRADES){ CT_GRADES=st; ctGradesRefresh(sem,per); return CT_GRADES; }
  }
  if(force||!CT_GRADES){ CT_GRADES=await loadServerGrades(true,sem,per); ctGradesStorePut(sem,per,CT_GRADES); }
  return CT_GRADES;
}
/* 💾 نسخة الدرجات على الجهاز (Cache API — أكبر من حد localStorage)، لكل جلسة دخول وفترة.
   جلب /reports ثقيل (كل الطلاب وكل الأنشطة): بدونها كان ملف الطالب ينتظره مع كل فتح للتطبيق */
function ctGradesKey(sem,per){ let t=''; try{ t=String(getTok()||'').slice(-8); }catch(e){} return '/__ct_grades__/'+encodeURIComponent(t)+'/'+sem+'-'+per; }
async function ctGradesStoreGet(sem,per){
  try{ if(!('caches' in window)) return null; const c=await caches.open('ct-grades-v1'), r=await c.match(ctGradesKey(sem,per)); if(!r) return null;
    const j=await r.json(); return j&&j.map&&Array.isArray(j.students)?j:null; }catch(e){ return null; }
}
function ctGradesStorePut(sem,per,g){
  try{ if(!('caches' in window)||!g||!g.map) return; const body=JSON.stringify(g);
    caches.open('ct-grades-v1').then(c=>c.put(ctGradesKey(sem,per),new Response(body,{headers:{'Content-Type':'application/json'}}))).catch(()=>{}); }catch(e){}
}
let CT_GRADES_REFRESH=null;
function ctGradesRefresh(sem,per){
  if(CT_GRADES_REFRESH) return CT_GRADES_REFRESH;
  return CT_GRADES_REFRESH=loadServerGrades(true,sem,per).then(g=>{
    ctGradesStorePut(sem,per,g); const c=ctSem(); if(c.sem!==sem||c.per!==per) return;
    const old=CT_GRADES, sid=String(window._ctPfSid||''), J=x=>JSON.stringify(x||null);
    CT_GRADES=g;
    if(old&&old.map&&g&&g.map&&J(old.map[sid])===J(g.map[sid])) { try{ if(typeof thDraw==='function') thDraw(); }catch(e){} return; }   // ملف الطالب المعروض لم يتغير: لا إعادة رسم
    try{ if(typeof stcActive==='function'&&stcActive()&&document.querySelector('#student-center-detail .stc-file')) renderStudentCenterDetail(1); }catch(e){}
    try{ if(CT_TAB==='profile'&&document.querySelector('#ct-body #ct-pf')) renderClassTools(); }catch(e){}
    try{ if(typeof thDraw==='function') thDraw(); }catch(e){}
  }).catch(()=>{}).finally(()=>{ CT_GRADES_REFRESH=null; });
}
function ctG(sid){ return (CT_GRADES&&CT_GRADES.map&&CT_GRADES.map[String(sid)])||{}; }
/* 🎯 مهارات الطالب بقواعد الخطط نفسها (من الخادم): نواتج نافس للفصل الدراسي كله، آخر 6 أسئلة، 3 أسئلة على الأقل.
   فلا تقول خريطة المهارات شيئًا وقائمة العلاج شيئًا آخر. (خادم قديم: المصنّفة بنواتج نافس فقط من نسب الفترة) */
function ctSk(sid){
  const g=ctG(sid), o={};
  if(Array.isArray(g.official)){ g.official.forEach(x=>{ if(x.prior||x.early) return; const t=x.recent||x.total; o[x.skill]={rate:x.rate,t,c:Math.round(x.rate*t/100),n:x.total,unit:x.unit,earlier:!!x.earlier}; }); return o; }
  Object.entries(g.skills||{}).forEach(([k,v])=>{ const c=typeof skCanon==='function'?skCanon(k):k; if(v.t>=3&&typeof planIsOutcome==='function'&&planIsOutcome(c)){ const a=o[c]||(o[c]={c:0,t:0}); a.c+=v.c; a.t+=v.t; a.rate=Math.round(a.c/a.t*100); a.n=a.t; } });
  return o;
}
/* قاعدة القرار الموحّدة مع قائمة العلاج (من الخادم): إعادة شرح إن ضعف ثلث الفصل فأكثر (3 على الأقل)، جماعية لـ3 فأكثر، وإلا فردية */
function ctSkAct(weak,classSize){ const R=(CT_GRADES&&CT_GRADES.groupRules)||{min:3,classWideShare:30};
  if(!weak) return 'ok'; if(weak>=R.min&&weak/Math.max(1,classSize)*100>=R.classWideShare) return 'reteach'; return weak>=R.min?'group':'one'; }
function ctTrendHTML(t){
  if(!t||!t.measurable) return '<span class="muted">—</span>';
  const c=t.change, cls=c>=10?'up':c<=-10?'down':'flat';
  return `<span class="ct-trend ${cls}" title="أول الفترة ${t.early}% ← آخرها ${t.late}%">${c>=10?'▲':c<=-10?'▼':'●'} ${c>0?'+':''}${c}</span>`;
}
function ctHeat(rate){
  if(rate==null) return 'background:transparent';
  const h=Math.round(Math.max(0,Math.min(100,rate))*1.2);   // 0=أحمر ← 120=أخضر
  return `background:hsl(${h} 62% 88%);color:hsl(${h} 70% 22%)`;
}
function ctOpenProfile(sid,sub){ window._ctPfSub=sub||'overview'; window._ctPfSid=String(sid); const s=(STUDENTS||[]).find(x=>String(x.id)===String(sid)); if(s) window._ctPfCls=String(s.cls||''); closeModal(); stcOpen(sid); }
function ctNameLink(s){ return `<a href="#" class="ct-name" onclick="event.preventDefault();ctOpenProfile('${esc(s.id)}')">${esc(s.name)}</a>`; }

/* ── 📅 حصصي اليوم (أعلى التبويب دائمًا) ── */
function ctTodayHTML(){
  const D=CT_DATA||{}, s=ctSch(D);
  const dow=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Riyadh',weekday:'short'}).format(new Date()).replace(/Sun/,'0').replace(/Mon/,'1').replace(/Tue/,'2').replace(/Wed/,'3').replace(/Thu/,'4').replace(/Fri/,'5').replace(/Sat/,'6'));
  if(!(dow>=0&&dow<=4)) return '<div class="ct-today muted">📅 لا دوام اليوم.</div>';
  const g=s.grid[String(dow)]||{}, ps=Object.keys(g).map(Number).sort((a,b)=>a-b).filter(p=>g[String(p)]);
  if(!ps.length) return `<div class="ct-today muted">📅 ${CT_DAYS[dow]}: لا حصص في جدولك اليوم — أضفها من «🗓️ الجدول».</div>`;
  const d=ctToday(), done=c=>{ const P=D.participation&&D.participation[d]||{}; return ctRoster(c).some(x=>P[String(x.id)]); };
  return `<div class="ct-today"><b>📅 حصص اليوم (${CT_DAYS[dow]})</b>${ps.map(p=>{ const c=g[String(p)];
    return `<button type="button" class="ct-per ${done(c)?'done':''}" onclick="window._ctRcCls='${esc(c)}';window._ctRcClsUser=1;window._ctRcD='${d}';window._ctRcView='day';ctGo('records')" title="افتح سجل ${esc(c)} لليوم">الحصة ${p} · <b>${esc(c)}</b> ${done(c)?'✓ رُصد':'— لم يُرصد'}</button>`; }).join('')}</div>`;
}

/* ── 🧭 خريطة المهارات — ثلاث قراءات للبيانات نفسها:
   «حسب المهارة» (الافتراضي): بطاقة لكل مهارة من الأضعف، فيها متوسط الفصل وكم أتقنها/قريب/لم يتقن، والقرار المناسب
     (إعادة شرح للفصل كله · خطة جماعية · طالب واحد · الفصل متمكّن) — بدل جدول أرقام يُفسَّر بالعين.
   «حسب الطالب»: كل طالب ومهاراته المفقودة كشارات، مرتبًا بالأكثر احتياجًا.
   «الجدول الكامل»: مصفوفة الطالب × المهارة لمن يريد التفاصيل، بدليل ألوان واضح.
   الطالب يُحسب في المهارة إذا أجاب عن سؤالين فأكثر فيها؛ الحدود: أتقن ≥ SKILL_TARGET_UI، لم يتقن < SKILL_GAP_UI. ── */
function ctSkBand(rate){ return rate>=SKILL_TARGET_UI?'ok':rate>=SKILL_GAP_UI?'mid':'weak'; }
function ctSkChip(name,rate,band,onclick){ return `<button type="button" class="sk-chip ${band}" ${onclick?`onclick="${onclick}"`:''} title="${rate}%">${esc(name)} <b>${rate}%</b></button>`; }
/* صفوف المهارات لمجموعة طلاب: متوسط الفصل، ومن أتقن/قريب/لم يتقن، والقرار — تشترك فيها الخريطة والتقرير المختصر */
function ctSkillRows(roster){
  const all={}; roster.forEach(s=>Object.entries(ctSk(s.id)||{}).forEach(([k,v])=>{ const a=all[k]||(all[k]={c:0,t:0,n:0}); a.c+=v.c; a.t+=v.t; a.n++; }));
  let skills=Object.keys(all).filter(k=>all[k].t>=3);
  const T=SKILL_TARGET_UI, G=SKILL_GAP_UI;
  const R=skills.map(k=>{
    const seen=roster.map(s=>({s,v:ctSk(s.id)?.[k]})).filter(x=>x.v&&x.v.t>=2).sort((a,b)=>a.v.rate-b.v.rate);
    const ok=seen.filter(x=>x.v.rate>=T), mid=seen.filter(x=>x.v.rate>=G&&x.v.rate<T), weak=seen.filter(x=>x.v.rate<G);
    const act=!seen.length?'none':ctSkAct(weak.length,roster.length);
    // متوسط الفصل من الطلاب المقيسين فقط (سؤالان فأكثر): إجابات متفرقة بلا طالب مقيس لا تُعرض كمتوسط للفصل
    const sc=seen.reduce((a,x)=>a+x.v.c,0), st=seen.reduce((a,x)=>a+x.v.t,0);
    return {k,avg:st?Math.round(sc/st*100):null,t:all[k].t,seen,ok,mid,weak,act};
  }).sort((a,b)=>(a.avg==null)-(b.avg==null)||(a.avg??0)-(b.avg??0));   // غير المقيسة في الآخر
  skills=R.map(r=>r.k);
  return {skills,R};
}
async function ctSkills(box,force){
  await ctEnsureGrades(force);
  const cls=ctValidCls(window._ctSkCls), roster=ctRoster(cls);
  const {skills,R}=ctSkillRows(roster);
  const tools=`<div class="row ct-tools">${ctClassSel('ct-sk-cls',cls,"window._ctSkCls=this.value;renderClassTools()",false)}<button class="btn tick sm" onclick="ctLvReportPick(ctValidCls(window._ctSkCls))">📊 تقرير مختصر</button>${typeof skAliasOpen==='function'?(()=>{const n=skUnmappedCount();return `<button class="btn ${n?'':'ghost'} sm" onclick="skAliasOpen()" title="مطابقة المهارات القديمة بنواتج تعلم نافس">🎯 توحيد على نواتج نافس${n?` <span class="chip bad">${n}</span>`:''}</button>`})():''}`;
  if(!skills.length){ const old=typeof skUnmappedCount==='function'?skUnmappedCount():0, need=typeof skillNeeded==='function'?HW.filter(skillNeeded).length:0;
    box.innerHTML=`${tools}</div><div class="ct-warn">${old?`⚠️ أسئلة أنشطتك مصنّفة بـ<b>${old} ${old===1?'اسم مهارة قديم':'أسماء مهارات قديمة'}</b> غير مربوطة بنواتج نافس — الخريطة تعرض نواتج نافس فقط. اربطها مرة واحدة فتظهر هنا بإجاباتها كلها. <button type="button" class="btn tick sm" onclick="skAliasOpen()">🎯 اربطها الآن</button>`
      :need?`لا توجد بعد إجابات على نواتج نافس لهذا الفصل — ${need} ${need<=10?'أنشطة':'نشاطًا'} بلا تصنيف. <button type="button" class="btn tick sm" onclick="skillTagMissing()">🏷️ صنّفها</button>`
      :'لا توجد بعد إجابات كافية على نواتج نافس لهذا الفصل (3 أسئلة للطالب في الناتج). انشر نشاط نافس أو اختبارًا تشخيصيًا، أو صنّف أسئلة أنشطتك.'}</div>`; return; }
  const T=SKILL_TARGET_UI, G=SKILL_GAP_UI, first=n=>String(n||'').split(' ').slice(0,2).join(' ');
  const view=window._ctSkView||'skill', n=a=>R.filter(r=>a.includes(r.act)).length;
  const planBtn=(r,label,cls2)=>`<button class="btn ${cls2||'tick'} sm" onclick='ctGroupPlan(${JSON.stringify(r.k)},${JSON.stringify(r.weak.map(x=>String(x.s.id)))})'>${label}</button>`;
  const actHTML=r=>r.act==='reteach'?`<div class="sk-act reteach"><span>⚠️ <b>${r.weak.length} من ${r.seen.length}</b> لم يتقنوها — الأرجح أن الشرح لم يصل: <b>أعد شرحها للفصل كله</b> ثم قِس من جديد.</span>${planBtn(r,`👥 خطة للـ${r.weak.length}`,'ghost')}</div>`
    :r.act==='group'?`<div class="sk-act group"><span>👥 <b>${r.weak.length} طلاب</b> لم يتقنوها — يكفيهم تدخّل واحد.</span>${planBtn(r,'＋ خطة جماعية')}</div>`
    :r.act==='one'?`<div class="sk-act one"><span>👤 ${r.weak.length===1?'طالب واحد':'طالبان'} لم ${r.weak.length===1?'يتقنها':'يتقناها'}: <b>${r.weak.map(x=>esc(first(x.s.name))+` (${x.v.rate}%)`).join('، ')}</b> — خطة فردية.</span>${r.weak.length===1?planBtn(r,'＋ خطة فردية','ghost'):''}</div>`
    :r.act==='ok'?`<div class="sk-act ok"><span>✅ الفصل متمكّن منها${r.mid.length?` — ${r.mid.length} قريبون يكفيهم تدريب قصير`:''}.</span></div>`
    :`<div class="sk-act none"><span>لا توجد إجابات كافية بعد (سؤالان لكل طالب على الأقل).</span></div>`;
  const people=(arr,band)=>arr.map(x=>ctSkChip(first(x.s.name),x.v.rate,band,`ctOpenProfile('${esc(x.s.id)}')`)).join('');
  const card=r=>{ const tot=Math.max(1,r.seen.length);
    return `<div class="sk-card ${r.act}">
      <div class="sk-head"><div class="sk-name"><b>${esc(planSkName(r.k))}</b><small>${planSkUnit(r.k).title?'📚 '+esc(planSkUnit(r.k).title)+' · ':''}${r.seen.length} طالبًا</small></div>
        <div class="sk-avg ${r.avg==null?'none':ctSkBand(r.avg)}"><b>${r.avg==null?'—':r.avg+'%'}</b><small>${r.avg==null?'لم يُقَس بعد':'متوسط الفصل'}</small></div></div>
      <div class="sk-bar" role="img" aria-label="أتقن ${r.ok.length}، قريب ${r.mid.length}، لم يتقن ${r.weak.length}">${r.ok.length?`<i class="ok" style="flex:${r.ok.length}"></i>`:''}${r.mid.length?`<i class="mid" style="flex:${r.mid.length}"></i>`:''}${r.weak.length?`<i class="weak" style="flex:${r.weak.length}"></i>`:''}${r.seen.length?'':'<i class="none" style="flex:1"></i>'}</div>
      <div class="sk-leg"><span class="ok">أتقن <b>${r.ok.length}</b></span><span class="mid">قريب <b>${r.mid.length}</b></span><span class="weak">لم يتقن <b>${r.weak.length}</b></span><span class="muted">${Math.round(r.ok.length/tot*100)}% من المقيسين أتقنها</span></div>
      ${actHTML(r)}
      ${r.weak.length||r.mid.length?`<details class="sk-who"><summary>من يحتاجها؟ (${r.weak.length+r.mid.length})</summary><div class="sk-chips">${people(r.weak,'weak')}${people(r.mid,'mid')}</div></details>`:''}
    </div>`; };
  const byStudent=()=>{ const rows=roster.map(s=>{ const sk=Object.entries(ctSk(s.id)||{}).filter(([k,v])=>skills.includes(k)&&v.t>=2);
      return {s,weak:sk.filter(([,v])=>v.rate<G).sort((a,b)=>a[1].rate-b[1].rate),mid:sk.filter(([,v])=>v.rate>=G&&v.rate<T).sort((a,b)=>a[1].rate-b[1].rate),n:sk.length}; })
      .sort((a,b)=>b.weak.length-a.weak.length||b.mid.length-a.mid.length);
    return `<div class="sk-students">${rows.map(x=>`<div class="sk-st ${x.weak.length?'weak':x.mid.length?'mid':x.n?'ok':'none'}">
      <div class="sk-st-n">${ctNameLink(x.s)}<small>${x.n?(x.weak.length?`${x.weak.length} مهارة لم يتقنها`:x.mid.length?'قريب في بعض المهارات':'✅ أتقن كل مهاراته'):'لم يُقَس بعد'}</small></div>
      <div class="sk-chips">${x.weak.map(([k,v])=>ctSkChip(planSkName(k),v.rate,'weak')).join('')}${x.mid.map(([k,v])=>ctSkChip(planSkName(k),v.rate,'mid')).join('')}</div>
      ${x.weak.length?`<button class="btn tick sm" onclick="ctPlanStudent('${esc(x.s.id)}')">＋ خطة</button>`:''}</div>`).join('')}</div>`; };
  const table=()=>`<div class="ct-table"><table class="ct-heat"><thead><tr><th>الطالب</th>${skills.map(k=>`<th title="${esc(planSkName(k))}"><div class="ct-sk-h">${esc(planSkName(k))}</div></th>`).join('')}</tr>
      <tr class="ct-avg"><th>متوسط الفصل</th>${R.map(r=>r.avg==null?'<td class="muted">—</td>':`<td style="${ctHeat(r.avg)}"><b>${r.avg}%</b></td>`).join('')}</tr>
      <tr><th>لم يتقنها</th>${R.map(r=>`<td>${r.weak.length?`<b>${r.weak.length}</b>`:'—'}</td>`).join('')}</tr></thead><tbody>
    ${roster.map(s=>`<tr><td>${ctNameLink(s)}</td>${skills.map(k=>{ const v=ctSk(s.id)?.[k]; return v?`<td style="${ctHeat(v.rate)}" title="${v.c} من ${v.t}">${v.rate}%</td>`:'<td class="muted">—</td>'; }).join('')}</tr>`).join('')}
    </tbody></table></div>`;
  const tab=(k,l)=>`<button type="button" class="${view===k?'on':''}" onclick="window._ctSkView='${k}';renderClassTools()">${l}</button>`;
  box.innerHTML=`${tools}<div class="sk-views" role="tablist">${tab('skill','🧩 حسب المهارة')}${tab('student','👤 حسب الطالب')}${tab('table','▦ الجدول الكامل')}</div></div>
    <div class="sk-sum">
      <div class="sk-sum-c reteach"><b>${n(['reteach'])}</b><span>⚠️ تحتاج إعادة شرح للفصل</span></div>
      <div class="sk-sum-c group"><b>${n(['group','one'])}</b><span>👥 تحتاج علاجًا لبعض الطلاب</span></div>
      <div class="sk-sum-c ok"><b>${n(['ok'])}</b><span>✅ الفصل متمكّن منها</span></div>
    </div>
    <div class="sk-legend"><span class="ok">أتقن ${T}% فأكثر</span><span class="mid">قريب ${G}–${T-1}%</span><span class="weak">لم يتقن أقل من ${G}%</span><span class="muted">نواتج نافس للفصل الدراسي (الأنشطة والتشخيصي والمختبر) · آخر 6 أسئلة للطالب في الناتج · يُحكم عليه بعد 3 أسئلة — بقواعد قائمة العلاج نفسها</span></div>
    ${view==='student'?byStudent():view==='table'?table():(()=>{ const M=R.filter(r=>r.seen.length), U=R.filter(r=>!r.seen.length);
      // مهارات بلا طالب مقيس (سؤال واحد لكل طالب): أسماء متفرقة لفكرة واحدة — تُجمع في صندوق مطوي بدل بطاقات فارغة
      return `${M.length?`<div class="sk-grid">${M.map(card).join('')}</div>`:'<div class="ct-warn">لا توجد مهارة قيس فيها طالب بسؤالين فأكثر بعد.</div>'}
      ${U.length?`<div class="sk-unmeasured"><div class="sk-um-h"><b>🔎 ${U.length} مهارة لم تُقَس بعد</b><span class="muted">كل طالب أجاب فيها عن سؤال واحد فقط — غالبًا أسماء متفرقة لفكرة واحدة صنّفها الذكاء الاصطناعي لكل سؤال على حدة. وحّدها على نواتج نافس فتُجمع إجاباتها وتُقاس.</span>${typeof skAliasOpen==='function'?'<button class="btn tick sm" onclick="skAliasOpen()">🎯 توحيد على نواتج نافس</button>':''}</div>
        <details><summary class="muted">عرض أسمائها</summary><div class="sk-chips">${U.map(r=>`<span class="sk-chip none">${esc(r.k)} <small>${r.t} إجابة</small></span>`).join('')}</div></details></div>`:''}`; })()}`;
}

/* ── 📝 دفتر الاختبارات: إحصاءات + لصق + تصدير ── */
function ctExamStats(b,roster){
  return b.tests.map(t=>{
    const mx=Number(t.max)||10, vals=roster.map(s=>{const v=b.scores[String(s.id)]&&b.scores[String(s.id)][String(t.id)];const n=v&&typeof v==='object'?Number(v.score):Number(v);return Number.isFinite(n)?Math.min(mx,n):null});
    const got=vals.filter(v=>v!==null), n=got.length;
    if(!n) return { t, n, miss:roster.length };
    const avg=got.reduce((a,v)=>a+v,0)/n, pass=got.filter(v=>v>=mx/2).length;
    const bins=[0,0,0,0,0]; got.forEach(v=>bins[Math.min(4,Math.floor(v/mx*5))]++);
    return { t, n, miss:roster.length-n, avg:+avg.toFixed(2), pct:Math.round(avg/mx*100), max:Math.max(...got), min:Math.min(...got), pass:Math.round(pass/n*100), bins };
  });
}
function ctExamStatsHTML(st){
  if(!st.length) return '';
  return `<div class="ct-stats">${st.map(x=>`<div class="ct-stat"><b>${esc(x.t.title||'اختبار')}</b>
    ${x.n?`<div class="ct-stat-r"><span>المتوسط <b>${x.avg}</b> (${x.pct}%)</span><span>الأعلى <b>${x.max}</b></span><span>الأدنى <b>${x.min}</b></span><span>النجاح <b>${x.pass}%</b></span></div>
    <div class="ct-bins" title="توزيع الدرجات من الأدنى إلى الأعلى">${x.bins.map((c,i)=>`<i style="height:${Math.max(4,Math.round(c/Math.max(...x.bins,1)*34))}px" title="${['0–20%','20–40%','40–60%','60–80%','80–100%'][i]}: ${c}"></i>`).join('')}</div>`:'<div class="muted" style="font-size:.78rem">لم تُرصد درجات بعد</div>'}
    ${x.miss?`<div class="ct-miss">⚠️ ${x.miss} بلا درجة</div>`:''}</div>`).join('')}</div>`;
}

/* ── 🗂️ السجلات: عرض شهري + تنبيهات الانضباط + «الكل شارك» ── */
function ctDaysBack(n){ const out=[]; const t=Date.parse(ctToday()+'T00:00:00Z'); for(let i=0;i<n;i++) out.push(new Date(t-i*86400000).toISOString().slice(0,10)); return out; }
/* يوم الدوام السابق لتاريخ ما (تُتجاوز الجمعة والسبت) — لسلسلة الغياب المتتالي (خ1) */
function ctPrevSchoolDay(dateStr){ let d=new Date(Date.parse(dateStr+'T00:00:00Z')-86400000); while(d.getUTCDay()===5||d.getUTCDay()===6) d=new Date(d.getTime()-86400000); return d.toISOString().slice(0,10); }
function ctStatus(D,m,d,sid){ const r=D[m]&&D[m][d]&&D[m][d][String(sid)]; return String((r&&(typeof r==='string'?r:r.status))||''); }
function ctAlerts(cls){
  const D=CT_DATA||{}, out=[];
  const days30=ctDaysBack(30), days14=ctDaysBack(14);
  ctRoster(cls).forEach(s=>{
    // غياب متتالٍ حتى آخر يوم مرصود له — تقويميًا: كل يوم يليه يوم الدوام السابق مباشرة (خ1)
    const rec=Object.keys(D.participation||{}).filter(d=>ctStatus(D,'participation',d,s.id)).sort().reverse();
    let streak=0, prevDay=null; for(const d of rec){ if(ctStatus(D,'participation',d,s.id)!=='غائب') break; if(prevDay!==null && d!==ctPrevSchoolDay(prevDay)) break; streak++; prevDay=d; }
    const absD=days30.filter(d=>ctStatus(D,'participation',d,s.id)==='غائب'), abs=absD.length;
    const missD=days14.filter(d=>ctStatus(D,'homework',d,s.id)==='لم ينجز'), miss=missD.length;
    const npD=days14.filter(d=>ctStatus(D,'participation',d,s.id)==='لم يشارك'), nopart=npD.length;
    const lastOf=a=>a.slice().sort().pop()||'';   // آخر حدث: المتابعة تُخفي التنبيه حتى يتكرر بعدها
    if(streak>=3) out.push({s,lvl:'bad',type:'abs',last:lastOf(absD)||rec[0]||'',t:`غائب ${streak} أيام متتالية حتى آخر رصد`});
    else if(abs>=3) out.push({s,lvl:'warn',type:'abs',last:lastOf(absD),t:`${abs} أيام غياب بلا عذر في آخر 30 يومًا`});
    if(miss>=3) out.push({s,lvl:'warn',type:'hw',last:lastOf(missD),t:`لم ينجز الواجب ${miss} مرات في آخر أسبوعين`});
    if(nopart>=4) out.push({s,lvl:'warn',type:'part',last:lastOf(npD),t:`«لم يشارك» ${nopart} مرات في آخر أسبوعين`});
  });
  return out;
}
/* ✅ المتابعة: تُحفظ في بيانات الفصل على الخادم (تظهر على كل الأجهزة). التنبيه يختفي بعدها
   ولا يعود إلا إذا تكرر منه حدث جديد بعد تاريخ المتابعة (غياب جديد، واجب جديد لم يُنجز…) */
const FU_LABEL={abs:'متابعة الغياب',hw:'متابعة الواجبات',part:'متابعة المشاركة',ns:'لم يبدأ في البوابة'};
function fuDay(ms){ return ms?new Date(Number(ms)+3*3600000).toISOString().slice(0,10):''; }
function fuAt(sid,type){ const F=(typeof CT_DATA!=='undefined'&&CT_DATA&&CT_DATA.followups)||{}; return Number((F[String(sid)]||{})[type])||0; }
function fuOpen(a){ const at=fuAt(a.s.id,a.type); return !(at && a.last && fuDay(at)>=a.last); }
function ctAlertsOpen(cls){ return ctAlerts(cls).filter(fuOpen); }
async function fuMark(items,how){
  if(!items.length) return;
  try{
    await ctSave(D=>{ D.followups=D.followups&&typeof D.followups==='object'?D.followups:{}; const now=Date.now();
      items.forEach(it=>{ const o=D.followups[String(it.sid)]=D.followups[String(it.sid)]||{}; o[it.type]=now; });
      if(how){ D.contacts=Array.isArray(D.contacts)?D.contacts:[]; const by={};
        items.forEach(it=>{ (by[it.sid]=by[it.sid]||[]).push(FU_LABEL[it.type]||it.type); });
        Object.entries(by).forEach(([sid,rs])=>D.contacts.push({id:v2Id(),studentId:String(sid),date:ctToday(),channel:how,reason:[...new Set(rs)].join('، '),result:'',at:Date.now()})); }
    });
    toast(how?`📞 سُجّل التواصل في ملف ${items.length===1?'الطالب':'الطلاب'}`:'✓ سُجّلت المتابعة — يعود التنبيه فقط إذا تكرر بعد اليوم','good');
  }catch(e){ toast('تعذّر الحفظ — تحقق من الاتصال','bad'); }
  try{ thDraw(); }catch(e){}
}
function ctRecordsMonth(box){
  const cls=ctValidCls(window._ctRcCls), D=CT_DATA||{}, m=window._ctRcM||ctToday().slice(0,7);
  const [Y,M]=m.split('-').map(Number), n=new Date(Date.UTC(Y,M,0)).getUTCDate();
  const days=Array.from({length:n},(_,i)=>`${m}-${String(i+1).padStart(2,'0')}`).filter(d=>{const w=new Date(d+'T00:00:00Z').getUTCDay();return w<=4});
  const roster=ctRoster(cls);
  const P={'شارك':['ش','p'],'لم يشارك':['ل','n'],'غائب':['غ','a'],'غائب بعذر':['ع','e']};
  const recDays=days.filter(d=>roster.some(s=>ctStatus(D,'participation',d,s.id)||ctStatus(D,'homework',d,s.id)));
  if(!recDays.length) return `<div class="muted" style="font-size:.76rem;margin-bottom:.4rem">ش شارك · ل لم يشارك · غ غائب · ع غائب بعذر · النقطة الحمراء = لم ينجز الواجب</div><div class="muted" style="padding:1rem;text-align:center">لا أيام مرصودة في هذا الشهر بعد.</div>`;
  return `<div class="muted" style="font-size:.76rem;margin-bottom:.4rem">ش شارك · ل لم يشارك · غ غائب · ع غائب بعذر · النقطة الحمراء = لم ينجز الواجب · تظهر أيام الدوام المرصودة فقط (${recDays.length} يومًا)</div>
    <div class="ct-table"><table class="ct-month"><thead><tr><th>الطالب</th>${recDays.map(d=>`<th title="${d}">${Number(d.slice(8))}</th>`).join('')}<th>غياب</th><th>لم يشارك</th><th>لم ينجز</th></tr></thead><tbody>
    ${roster.map(s=>{ let a=0,ae=0,nn=0,hw=0; const cells=recDays.map(d=>{ const st=ctStatus(D,'participation',d,s.id), h=ctStatus(D,'homework',d,s.id); const p=P[st];
        if(st==='غائب')a++; else if(st==='غائب بعذر'){a++; ae++} if(st==='لم يشارك')nn++; if(h==='لم ينجز')hw++;
        return `<td class="ct-m ${p?p[1]:''}" title="${d}: ${esc(st||'—')}${h?' · الواجب: '+esc(h):''}" onclick="window._ctRcD='${d}';window._ctRcView='day';renderClassTools()">${p?p[0]:''}${h==='لم ينجز'?'<i></i>':''}</td>`; }).join('');
      return `<tr><td>${ctNameLink(s)}</td>${cells}<td><b class="${a>=3?'bad':''}">${a}</b>${ae?`<div class="muted" style="font-size:.7rem">منه بعذر ${ae}</div>`:''}</td><td>${nn}</td><td><b class="${hw>=3?'bad':''}">${hw}</b></td></tr>`; }).join('')}
    </tbody></table></div>`;
}

/* ── 🏅 الشهادات: مرشحون تلقائيون + تصاميم + رسالة ولي الأمر ── */
function ctCertCandidates(cls){
  const D=CT_DATA||{}, out=[], have=new Set((D.certificates||[]).filter(c=>c&&!c.deleted&&(Date.now()-(Number(c.at)||0))<45*86400000).map(c=>String(c.studentId)));
  const plans=(CT_GRADES&&CT_GRADES.plans)||[];
  ctRoster(cls).forEach(s=>{
    const g=ctG(s.id), why=[];
    if(g.level&&g.level.measured&&g.level.status==='متقن'&&g.level.count>=2) why.push(['إتقان',`متقن بنسبة ${g.level.rate}%`]);
    if(g.trend&&g.trend.measurable&&g.trend.change>=15) why.push(['تحسّن',`تحسّن من ${g.trend.early}% إلى ${g.trend.late}%`]);
    if(plans.some(p=>p.status==='done'&&/نجحت/.test(p.outcome||'')&&(p.members||[]).some(m=>String(m.studentId)===String(s.id)))) why.push(['خطة',`نجحت خطته العلاجية`]);
    const at=g.attendance||{}, hw=g.homework||{};
    if(at.measured&&at.days>=10&&!(at.absent||0)&&hw.measured&&!(hw.missed||0)&&(hw.done||0)>=3) why.push(['انضباط','حضور كامل وكل واجباته منجزة']);
    if(why.length) out.push({s,why,had:have.has(String(s.id))});
  });
  return out.sort((a,b)=>a.had-b.had||b.why.length-a.why.length);
}
const CT_CERT_REASON={ 'إتقان':'إتقانه مهارات المادة وتميّزه في التحصيل', 'تحسّن':'تحسّن مستواه الملحوظ واجتهاده', 'خطة':'جدّه ومثابرته حتى حقق أهداف خطته', 'انضباط':'انضباطه والتزامه بالحضور وأداء واجباته' };
/* أيام بقاء الشهادة في بوابة الطالب (7 من إرسالها) — 0 إن لم تُرسل أو انتهت */
function ctCertLeft(c){ const at=c&&c.shared&&Number(c.shared.at); if(!at) return 0; return Math.max(0,Math.ceil((7*864e5-(Date.now()-at))/864e5)); }

/* ── 🗓️ طباعة الجدول ── */
function ctSchPrint(){
  const s=ctSch(CT_DATA||{}); ensureLogo();
  let box=document.getElementById('plan-print'); if(!box){ box=document.createElement('div'); box.id='plan-print'; box.className='rep'; document.body.appendChild(box); }
  box.innerHTML=`<div class="rep-page plan-doc">${repHead('الجدول الدراسي الأسبوعي','')}<div class="rep-in">
    <div class="rep-info"><div>المعلم<b>${esc(rcGet('teacher')||'')}</b></div><div>المادة<b>${esc(rcGet('subject')||'العلوم')}</b></div></div>
    <div class="rep-box"><table class="rt"><thead><tr><th>اليوم</th>${Array.from({length:s.count},(_,i)=>`<th>الحصة ${i+1}</th>`).join('')}</tr></thead><tbody>
    ${CT_DAYS.map((dn,dy)=>`<tr><td><b>${dn}</b></td>${Array.from({length:s.count},(_,i)=>`<td>${esc((s.grid[String(dy)]||{})[String(i+1)]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></div>`;
  unifiedA4Print({bodyClass:'printing-plans',title:'الجدول الدراسي',selector:'#plan-print',orientation:'landscape',margin:'8mm'});
}

/* ── 👤 ملف الطالب الشامل ── */
/* 👤 ملف الطالب الموحّد: كل ما يخص الطالب في صفحة واحدة بتبويبات —
   النظرة الشاملة (حساب الخادم) · الأنشطة والإجراءات · تقرير الأنشطة المفصل · تقرير الفترة كما يراه الطالب */
const CT_PF_SUBS=[['overview','📊 نظرة شاملة'],['acts','📚 الأنشطة والإجراءات'],['report','📄 تقرير الأنشطة المفصل'],['period','📤 تقرير الفترة']];
async function ctProfile(box,force){
  let off=!!window._ctOffline; if(!off){ try{ await ctEnsureGrades(force); }catch(e){ off=true; } }
  if(!off){ try{ await ctEnsurePrev(force); }catch(e){} }
  const cls=ctValidCls(window._ctPfCls), roster=ctRoster(cls);
  let sid=window._ctPfSid; if(!roster.some(s=>String(s.id)===String(sid))) sid=roster[0]?String(roster[0].id):'';
  window._ctPfSid=sid;
  const sub=CT_PF_SUBS.some(x=>x[0]===window._ctPfSub)?window._ctPfSub:'overview';
  const printBtn={overview:`<button class="btn sm" onclick="ctProfilePrint()">🖨️ طباعة الملف الشامل</button>`,
    report:`<button class="btn sm" onclick="printStudentReport('${esc(sid)}')">🖨️ طباعة تقرير الأنشطة</button>`,
    period:`<button class="btn sm" onclick="window.__srepPreview&&srpPrint(window.__srepPreview)">🖨️ طباعة تقرير الفترة</button> <button class="btn tick sm" onclick="reportShare(window.__srepPreview)" title="ملف PDF يُرسل بواتساب لولي الأمر أو المرشد">📤 مشاركة PDF</button>`}[sub]||'';
  const head=`<div class="row ct-tools no-print">${ctClassSel('ct-pf-cls',cls,"window._ctPfCls=this.value;window._ctPfSid='';renderClassTools()",false)}
      <select class="inp" id="ct-pf-sel" style="flex:1;min-width:200px" onchange="window._ctPfSid=this.value;renderClassTools()">${roster.map(s=>`<option value="${esc(s.id)}" ${String(s.id)===sid?'selected':''}>${esc(s.name)}</option>`).join('')}</select>
      ${sid?`<button class="btn ghost sm" title="الطالب السابق" onclick="ctPfStep(-1)">→</button><button class="btn ghost sm" title="الطالب التالي" onclick="ctPfStep(1)">←</button>`:''}
      ${sid&&typeof pfPinChip==='function'?pfPinChip(sid):''}</div>`;
  if(!sid){ box.innerHTML=head+'<div class="muted">لا طلاب في هذا الفصل.</div>'; return; }
  /* 🗂️ تبويبات ملف الطالب: متابعة يومية أولًا، ثم التقارير — أسماء قصيرة، وشريط يُسحب أفقيًا على الجوال */
  const PF_ORDER=[['overview','📊','نظرة شاملة'],['acts','📚','الأنشطة'],['points','🪙','سجل النقاط'],['timeline','🕓','الخط الزمني'],['contacts','📞','التواصل'],['|','','التقارير'],['report','📄','تقرير الأنشطة'],['period','📤','تقرير الفترة']];
  const have=new Set(CT_PF_SUBS.map(x=>x[0])), extra=CT_PF_SUBS.filter(x=>!PF_ORDER.some(o=>o[0]===x[0]));
  const tabBtn=(k,ic,l)=>`<button type="button" role="tab" aria-selected="${k===sub}" class="pf-tab${k===sub?' on':''}" data-k="${k}" onclick="window._ctPfSub='${k}';renderClassTools()"><span class="pf-ti">${ic}</span>${l}</button>`;
  const tabs=PF_ORDER.filter(o=>o[0]==='|'||have.has(o[0])).map(([k,ic,l])=>k==='|'?`<span class="pf-sep" aria-hidden="true">${l}</span>`:tabBtn(k,ic,l)).join('')
    +extra.map(([k,l])=>tabBtn(k,'',l)).join('');
  const bar=`<div class="pf-nav no-print"><nav class="pf-tabs" role="tablist" aria-label="أقسام ملف الطالب">${tabs}</nav></div>
    <div class="pf-acts no-print">
      <button class="pf-act" onclick="openAddStudentPoints('${esc(sid)}')">＋ نقاط</button>
      <button class="pf-act" onclick="bhvOpen('${esc(sid)}')">🌟 سلوك</button>
      <button class="pf-act" onclick="pmsgOpen('${esc(sid)}')">💬 ولي الأمر</button>
      <button class="pf-act" onclick="openStudentReminder('${esc(sid)}')">📨 تذكير</button>
      <button class="pf-act" onclick="openStudentForm('${esc(sid)}')">✏️ تعديل البيانات</button>
      ${printBtn?`<span class="pf-print">${printBtn}</span>`:''}</div>`;
  box.innerHTML=head+bar+`<div id="ct-pf" class="sf-body"></div>`;
  const el=box.querySelector('#ct-pf');   // داخل هذا الملف تحديدًا: قد توجد نسخة أخرى قيد الاستبدال (تبويب «الطلاب»)
  if(sub==='overview') el.innerHTML=(off?'<div class="ct-warn">تعذّر الاتصال بالخادم — المستوى والحضور والسلوك تحتاج الخادم. تبويب «الأنشطة والإجراءات» يعمل من بيانات هذا الجهاز.'+(window._ctOffline?'':' <span class="muted">· إعادة المحاولة تلقائيًا…</span>')+'</div>':'')+ctProfileBody(sid);
  else if(sub==='acts'){ el.classList.add('sf-embed'); sfEmbed(el,()=>_legacyStudentProfile(sid)); el.insertAdjacentHTML('afterbegin',pfGradeBox(sid)); }
  else if(sub==='report'){ el.classList.add('sf-embed'); sfEmbed(el,()=>_legacyStudentReport(sid)); }
  else if(sub==='timeline') sfTimeline(el,sid);
  else if(sub==='contacts') sfContacts(el,sid);
  else if(sub==='points' && typeof sfPoints==='function') sfPoints(el,sid);
  else sfPeriod(el,sid);
  // تعذّر جلب الدرجات (شبكة بطيئة): يُعاد المحاولة وحده مرتين، ويُستبدل الملف إن نجح وهو ما زال معروضًا
  // (بعد سلسلة التبويبات لا داخلها — كان وضعه بينها يُفرغ كل تبويب غير «نظرة شاملة»)
  if(off&&!window._ctOffline&&(box._pfRetry||0)<2){ box._pfRetry=(box._pfRetry||0)+1; const s0=sid;
    setTimeout(()=>{ if(box.isConnected&&String(window._ctPfSid)===String(s0)) ctProfile(box,false).catch(()=>{}); },4000*box._pfRetry); }
  else if(!off) box._pfRetry=0;
}
/* يعرض محتوى نافذة قديمة داخل الصفحة: نلتقط ما كانت سترسله إلى النافذة ونضعه هنا */
/* 📊 درجة الأنشطة في ملف الطالب: سلّم كم من الأنشطة المحسوبة في الفترة الحالية، وما الناقص */
function pfGradeBox(sid){
  const s=(STUDENTS||[]).find(x=>String(x.id)===String(sid)); if(!s) return '';
  const {sem,per}=ctSem(), term=compTermFor(sem,per);
  const acts=compActivitiesForStudent(s,term), done=compSubmissionCount(acts,s,term);
  const score=acts.length?Math.round(done/acts.length*100)/10:10;
  const miss=acts.filter(h=>{ const v=h.subs||{}; return !v[String(s.id)]&&!v[String(s.name||'')]; });
  return `<div class="pf-gr">📊 <b>درجة الأنشطة${term?` — ${per===2?'الفترة الثانية':'الفترة الأولى'}`:''}:</b>
    سلّم <b class="pf-gr-n">${done}</b> من <b class="pf-gr-n">${acts.length}</b> من الأنشطة المحسوبة · الدرجة <b>${score} / 10</b>
    ${miss.length?`<div class="pf-gr-miss">لم يسلّم: ${miss.map(h=>'«'+esc(h.title)+'»').join('، ')}</div>`:acts.length?'<div class="muted" style="font-size:.8rem;margin-top:.3rem">✓ سلّم كل الأنشطة المحسوبة</div>':''}</div>`;
}
function sfEmbed(el,fn){
  const orig=window.openModal; let got=false;
  window.openModal=h=>{ got=true; el.innerHTML=h; };
  try{ fn(); }catch(e){ console.error('sfEmbed',e); }
  finally{ window.openModal=orig; }
  if(!got) el.innerHTML='<div class="muted">لا توجد بيانات لعرضها.</div>';
}
/* 📄 ورقة الاختبار الممسوحة داخل تقرير الفترة في ملف الطالب: زر بجانب الاختبار يفتح الصورة المصححة
   (بختم الدرجة)، والإجابات الصحيحة بإطار أخضر متقطع، وصح/خطأ لكل سؤال. المعلم يراها ولو لم تُنشر للطالب */
const SFPP={sid:'',list:[],used:new Set(),on:false};
function sfPaperOf(t){ if(!SFPP.on) return null; const L=SFPP.list||[]; const p=L.find(x=>t.id!=null&&String(x.test)===String(t.id))||L.find(x=>x.title===t.title&&!SFPP.used.has(x.test)); if(p) SFPP.used.add(p.test); return p||null; }
/* ⚠️ درجات اختبارات مرصودة على هذا الجهاز ولم تصل للخادم (التقرير يبنيه الخادم): كانت تظهر في الكشف و«لم يُرصد» في التقرير بلا تفسير */
function sfExamSyncWarn(rep,sem,per,sid){
  try{
    const b=(((CT_DATA||{}).examBooks||{})[String(sem)]||{})[String(per)]; if(!b||!b.scores) return '';
    const mine=b.scores[String(sid)]||{}, num=v=>{ const n=v&&typeof v==='object'?Number(v.score):Number(v); return Number.isFinite(n)?n:null; };
    const srvT=(rep&&rep.exam&&rep.exam.tests)||[], srv=new Map(srvT.map(t=>[String(t.id),t]));
    const miss=(b.tests||[]).filter(t=>{ const loc=num(mine[String(t.id)]); if(loc==null) return false; const s=srv.get(String(t.id)); return !s||s.score==null||Number(s.score)!==loc; });
    // 🗑️ اختبار حذفته من هذا الجهاز وما زال في دفتر الخادم (فيظهر في التقرير وبوابة الطالب وولي الأمر)
    const dels=new Set((Array.isArray(b.delTests)?b.delTests:[]).map(d=>d&&String(d.id))), live=new Set((b.tests||[]).map(t=>String(t.id)));
    const gone=srvT.filter(t=>dels.has(String(t.id))&&!live.has(String(t.id)));
    if(!miss.length&&!gone.length) return '';
    const pend=(typeof qrOut==='function'?qrOut():[]).length, err=(typeof QR!=='undefined'&&QR.err)||'';
    return `<div class="ct-warn no-print" style="margin-bottom:.6rem">⚠️ ${miss.length?`<b>درجات مرصودة على هذا الجهاز لم تصل للخادم بعد:</b> ${miss.map(t=>esc(t.title||t.id)).join('، ')} — لذلك يظهر هنا «لم يُرصد».`:''}
      ${gone.length?`${miss.length?'<br>':''}<b>اختبار حذفته على هذا الجهاز ولم يصل حذفه للخادم:</b> ${gone.map(t=>esc(t.title||t.id)).join('، ')} — لذلك ما زال يظهر في التقرير.`:''}
      <div class="muted" style="font-size:.8rem;margin-top:.25rem">${pend?`${pend} عملية بانتظار الإرسال`:'لا شيء في طابور الإرسال'}${err?` · آخر محاولة: ${esc(err)}`:''}</div>
      <button type="button" class="btn sm" style="margin-top:.4rem" onclick="this.disabled=true;this.textContent='⏳ جارٍ الإرسال…';sfExamResend()">📤 أرسلها الآن</button></div>`;
  }catch(e){ return ''; }
}
async function sfExamResend(){
  try{
    const {sem,per}=ctExamSP(), b=(((CT_DATA||{}).examBooks||{})[String(sem)]||{})[String(per)];
    if(b&&typeof qrDo==='function') qrDo({k:'exb',sem:String(sem),per:String(per),book:JSON.parse(JSON.stringify(b))});   // لقطة الدفتر من جديد (لو ضاعت من الطابور)
    if(typeof qrFlush==='function') await qrFlush();
  }catch(e){}
  if(typeof QR!=='undefined'&&QR.err) toast('لم تُرسل: '+QR.err,'bad'); else toast('تم الإرسال للخادم — قد يتأخر ظهوره في التقرير دقيقة','good');
  try{ if(stcActive()) renderStudentCenterDetail(1); else renderClassTools(); }catch(e){}
}
async function sfPeriod(el,sid){
  const {sem,per}=ctSem(), s=(STUDENTS||[]).find(x=>String(x.id)===String(sid));
  el.innerHTML='<div class="muted" style="padding:1rem">⏳ جارٍ إعداد تقرير الفترة…</div>'; window.__srepPreview=null;
  try{ if(!compTermFor(sem,per)) await loadServerGrades(false,sem,per); }catch(e){}
  try{
    const [j,pp]=await Promise.all([healthApi('/student-report/preview',{semester:sem,period:per,sid,note:'',acts:srepActsFor(s?[s]:[],sem,per)}),
      omrApiCall('/omr/papers/of?sid='+encodeURIComponent(sid)).catch(()=>({papers:[]}))]);
    if(String(window._ctPfSid)!==String(sid)) return;
    window.__srepPreview=j.report; SFPP.sid=String(sid); SFPP.list=(pp.papers||[]); SFPP.used=new Set();
    SFPP.on=true; let rep=''; try{ rep=srxHTML(j.report); }finally{ SFPP.on=false; } const rest=SFPP.list.filter(p=>!SFPP.used.has(p.test)&&(p.sem||1)===Number(sem));   // أوراق ممسوحة لا تقابل اختبارًا في التقرير
    el.innerHTML=sfExamSyncWarn(j.report,sem,per,sid)+`<div class="muted no-print" style="font-size:.8rem;margin-bottom:.5rem">هكذا يظهر التقرير للطالب في بوابته. الإرسال لكل الفصل من «الكشوف ← 📤 تقارير الطلاب».</div>${rep}
      ${rest.length?`<div class="sfpp-rest no-print"><b>📝 أوراق اختبارات ممسوحة أخرى</b>${rest.map(p=>`<button type="button" class="sfpp-btn" onclick="sfPaperOpen('${esc(p.test)}')">📄 ${esc(p.title)} · ${p.score} / ${p.max}${p.pub?'':' <small>(غير منشورة)</small>'}</button>`).join('')}</div>`:''}`;
  }catch(e){ el.innerHTML='<div class="ct-warn">تعذّر إعداد تقرير الفترة — يحتاج اتصالًا بالخادم.</div>'; }
}
/* 🔍 لماذا «لم يُقَس» الإتقان؟ نفس شروط الخادم: نشاط عادي/مختبر · له أسئلة · نُشر في الفترة (كدرجة الأنشطة) وسُلّم قبل إغلاقها.
   إن وجدنا هنا تسليمات تصلح للقياس والخادم لم يقسها فنسخة الخادم ناقصة أو worker.js قديم. */
function ctMasteryWhy(sid){
  const T=(CT_GRADES&&CT_GRADES.term)||null, S=String(sid), c={kind:0,noq:0,out:0,late:0,ok:0}, cut=termCut(T);
  for(const h of HW||[]){ const v=h&&h.subs&&h.subs[S]; if(!v) continue;
    if(!['normal','lab'].includes(h.kind||'normal')){ c.kind++; continue; }
    if(!(Number(v.total)>0)){ c.noq++; continue; }
    if(!hwInTerm(h,T)){ c.out++; continue; }
    const t=Number(v.fat||v.at)||0; if(cut&&t&&t>=cut){ c.late++; continue; }
    c.ok++; }
  const why=[c.kind?`${c.kind} من نوع لا يُقاس (قراءة/مشروع/لعبة/تشخيصي)`:'',c.noq?`${c.noq} بلا أسئلة`:'',c.out?`${c.out} من أنشطة فترة أخرى`:'',c.late?`${c.late} سُلّمت بعد إغلاق الفترة`:''].filter(Boolean);
  if(c.ok) return `⚠️ عنده ${c.ok} تسليم يصلح للقياس لكن الخادم لم يحسبه — انشر worker.js الأخير ثم اضغط «🔄 تحديث»`;
  return why.length?'لم يُقس لأن تسليماته: '+why.join(' · '):'لم يسلّم نشاطًا عاديًا بأسئلة في هذه الفترة';
}
function ctProfileBody(sid){
  const s=(STUDENTS||[]).find(x=>String(x.id)===String(sid))||{}, g=ctG(sid), D=CT_DATA||{}, {sem,per}=ctSem();
  const L=g.level||{}, A=g.attendance||{}, H=g.homework||{}, P=g.participation||{}, B=g.behavior||{}, E=g.exam||{};
  const kpi=(t,v,sub,tone='')=>`<div class="ct-kpi ${tone}"><b>${v}</b><span>${t}</span>${sub?`<small>${sub}</small>`:''}</div>`;
  const tone={ 'متقن':'tick','قريب من الإتقان':'warn','يحتاج دعم':'bad' }[L.status]||'';
  const skills=Object.entries(g.skills||{}).filter(([,v])=>v.t>=2).sort((a,b)=>a[1].rate-b[1].rate);
  const b=ctBook(JSON.parse(JSON.stringify(D)),sem,per), by=b.scores[String(sid)]||{};
  const beh=(D.behavior||[]).filter(x=>x&&!x.deleted&&String(x.studentId)===String(sid)).sort((a,c)=>(Number(c.at)||0)-(Number(a.at)||0));
  const certs=(D.certificates||[]).filter(x=>x&&!x.deleted&&String(x.studentId)===String(sid));
  const plans=((CT_GRADES&&CT_GRADES.plans)||[]).filter(p=>(p.members||[]).some(m=>String(m.studentId)===String(sid)));
  const days30=ctDaysBack(30), abs30=days30.filter(d=>ctStatus(D,'participation',d,sid)==='غائب').length;
  return `<div class="ct-pf-head"><div><h3 style="margin:0">${esc(s.name||'')}</h3><span class="muted">${esc(s.cls||'')} · الفصل ${sem===1?'الأول':'الثاني'} · الفترة ${per===1?'الأولى':'الثانية'}</span></div>
      <div>${L.measured?`<span class="chip ${tone}">${esc(L.status||'')}</span>`:'<span class="chip ghost">لم يُقَس</span>'} ${g.trend&&g.trend.measurable?ctTrendHTML(g.trend):''}</div></div>
    <div class="par-box" id="par-box" data-sid="${esc(String(sid))}">${parBoxHTML(String(sid))}</div>
    ${typeof ctCmpStudentHTML==='function'?ctCmpStudentHTML(sid):''}
    <div class="ct-kpis ct-kpis6">
      ${kpi('الإتقان',L.measured?L.rate+'%':'—',L.measured?`${L.correct}/${L.total} في ${L.count} نشاط`:`<span class="ct-why">${esc(ctMasteryWhy(sid))}</span>`,tone)}
      ${kpi('الاختبارات',E.measured&&E.score!=null?`${E.score}/20`:'—','')}
      ${kpi('المشاركة',P.measured?`${P.score}/10`:'—',P.measured?`شارك ${P.yes} · لم يشارك ${P.no}`:'')}
      ${kpi('الواجبات',H.measured?`${H.score}/10`:'—',H.measured?`أنجز ${H.done||0} · لم ينجز ${H.missed||0}`:'')}
      ${kpi('السلوك',B.measured?`${B.score}/10`:'10/10',`🌟 ${B.pos||0} · ⚠️ ${B.neg||0}`)}
      ${kpi('الحضور',A.measured&&A.rate!=null?A.rate+'%':'—',A.measured?`غياب ${A.absent||0} · بعذر ${A.excused||0}${abs30?` · ${abs30} في آخر شهر`:''}`:'', A.rate!=null&&A.rate<90?'warn':'')}
    </div>
    <div class="ct-pf-grid">
      <div class="ct-card"><b>🏷️ المهارات</b>${skills.length?skills.map(([k,v])=>`<div class="ct-bar"><span>${esc(k)}</span><i><u style="width:${v.rate}%;${ctHeat(v.rate)}"></u></i><b>${v.rate}%</b></div>`).join(''):'<div class="muted" style="font-size:.82rem">لا أسئلة مصنّفة بالمهارات بعد.</div>'}</div>
      <div class="ct-card"><b>📝 الاختبارات</b>${b.tests.length?b.tests.map(t=>{const v=by[String(t.id)];const n=v&&typeof v==='object'?Number(v.score):Number(v);return `<div class="ct-bar"><span>${esc(t.title||'اختبار')}</span><i><u style="width:${Number.isFinite(n)?Math.round(n/(Number(t.max)||10)*100):0}%;${Number.isFinite(n)?ctHeat(n/(Number(t.max)||10)*100):''}"></u></i><b>${Number.isFinite(n)?`${n}/${t.max}`:'—'}</b></div>`}).join(''):'<div class="muted" style="font-size:.82rem">لا اختبارات في الفترة.</div>'}</div>
      <div class="ct-card"><b>🩺 الخطط العلاجية (${plans.length})</b>${plans.map(p=>`<div class="ct-li"><span>${esc(String(p.reason||'').split(' — ')[0]||'خطة')} · ${esc(p.startDate||'')}</span><span class="chip ${p.verdict==='تحسّن'?'tick':p.verdict==='تراجع'?'bad':'ghost'}">${esc(p.status==='done'?(p.outcome||'منتهية'):p.verdict||'')}</span></div>`).join('')||'<div class="muted" style="font-size:.82rem">لا خطط.</div>'}</div>
      <div class="ct-card"><b>📝 السلوك (${beh.length})</b>${beh.slice(0,8).map(x=>`<div class="ct-li"><span>${x.type==='positive'?'🌟':'⚠️'} ${esc([x.category,x.note].filter(Boolean).join(' — '))}</span><span class="muted">${esc(String(x.date||'').replace(/-/g,'/'))}</span></div>`).join('')||'<div class="muted" style="font-size:.82rem">لا ملاحظات.</div>'}</div>
      <div class="ct-card"><b>🏅 الشهادات (${certs.length})</b>${certs.map(c=>`<div class="ct-li"><span>${esc(c.reason||'')}</span><span class="muted">${esc(String(c.date||'').replace(/-/g,'/'))}</span></div>`).join('')||'<div class="muted" style="font-size:.82rem">لا شهادات.</div>'}</div>
    </div>`;
}

/* ═══ الخطط العلاجية ═══
   التقارير تُحسب في الـ Worker (قبل/بعد من إجابات الطالب)، وهنا عرض وتحرير فقط. */
const PLAN_ACTION_BANK=[
 'مراجعة المفاهيم الأساسية للوحدة مع المعلم 10 دقائق أسبوعيًا',
 'إعادة حل الأنشطة التي أخطأ فيها بعد شرحها',
 'تكليف بورقة تدريب إضافية أسبوعيًا',
 'إجلاسه في الصف الأمامي ومتابعته أثناء النشاط',
 'إسناده إلى زميل متقن للعمل الثنائي',
 'تجزئة المهمة إلى خطوات صغيرة مع تحقق بعد كل خطوة',
 'تكليفه بتلخيص الدرس شفهيًا في نهاية الحصة',
 'التواصل مع ولي الأمر لمتابعة المذاكرة المنزلية',
 'منحه مهمة صفية تعزّز ثقته بنفسه',
];
let PLAN_DATA=null, planEditId='';
function planEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
/* 💾 حفظ الخطط: يُفضَّل تمرير دالة تعدّل «أحدث قائمة في الخادم» لحظة الحفظ — لا القائمة المعروضة.
   (كانت الصفحة تعرض لقطة فترة مغلقة، فيحفظ أي زر تلك اللقطة فوق الخطط الحقيقية ويمحو ما أُنشئ بعدها) */
async function savePlans(plansOrFn){
  const tok=localStorage.getItem('hwapp_tok_v1')||'';
  const api=(typeof API!=='undefined'?API:'https://homework.ahmadalmarzooq2009.workers.dev').replace(/\/+$/,'');
  const cd=await loadComprehensiveClassroom(true);
  const fresh=(Array.isArray(cd.plans)?cd.plans:[]).map(planRaw);
  const plans=typeof plansOrFn==='function'?(plansOrFn(fresh)||fresh):plansOrFn;
  const body={...cd, plans};
  const r=await fetch(api+'/classroom',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({t:tok,data:body,clientAt:Date.now()})});
  if(!r.ok) throw new Error('save failed');
  window._classroomData=body;
  COMP_GRADES=null;
  return body;
}
/* 📅 تاريخ اليوم بتوقيت السعودية ± أيام (YYYY-MM-DD) — هنا لا في 19-bulk-rem: «اليوم» (15-dash-reorg) يستدعيها عند التحميل قبل وصول ذلك الملف */
function remKsaDay(off){ return new Date(Date.now()+3*3600000+(off||0)*864e5).toISOString().slice(0,10); }
function planSP(){ try{ return ctSemActive(); }catch(e){ return {sem:1,per:1}; } }
function planRate(m){return (m&&m.measured)?m.rate+'%':'—'}
function planBadge(v){
  const map={'تحسّن':'tick','تراجع':'bad','بلا فرق يُعتد به':'warn','لم يُقَس أثرها بعد':'ghost','لا يوجد قياس قبلي للمقارنة':'ghost','لا يوجد قياس بعد':'ghost'};
  return `<span class="chip ${map[v]||'ghost'}">${planEsc(v)}</span>`;
}
/* ✏️ نموذج الخطة نافذة فوق الصفحة: يبقى المعلم في مكانه من القائمة، ويرجع إليه عند الإغلاق */
function closePlanForm(){
  const box=document.getElementById('plan-form'); if(box){ box.style.display='none'; box.innerHTML=''; }
  document.body.classList.remove('pf-open');
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('pf-open')&&!document.querySelector('.veil.on,.ask-veil'))closePlanForm()});
function openPlanForm(id){
  planEditId=id||'';window._pfMemCls=undefined;window._pfMemQ='';
  const p=(PLAN_DATA&&PLAN_DATA.plans||[]).find(x=>x.id===id);
  window._pfSkills=p&&Array.isArray(p.skills)?p.skills.slice():[];
  window._pfPattern=p&&p.pattern||'';
  const grp=!!(p&&p.group);
  window._pfMembers=grp?(p.members||[]).map(m=>String(m.studentId)):[];
  const box=document.getElementById('plan-form'); if(!box) return;
  const opts=(STUDENTS||[]).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar'))
    .map(s=>`<option value="${planEsc(s.id)}" ${p&&p.studentId===s.id?'selected':''}>${planEsc(s.name)}${s.cls?' — '+planEsc(s.cls):''}</option>`).join('');
  const acts=(p&&Array.isArray(p.actions)?p.actions:[]).map(a=>a.text);
  // يُنقل إلى body: أحد آباء التبويب عليه transform فيجعل position:fixed نسبيًا له لا للشاشة
  if(box.parentElement!==document.body) document.body.appendChild(box);
  box.style.display=''; box.classList.add('pf-modal'); document.body.classList.add('pf-open');
  box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
  box.innerHTML=`<div class="card pf-dialog" style="background:var(--ui-surface-2)">
    <div class="pf-head"><h3>${p?`✏️ تعديل خطة ${planEsc(p.name||'')}`:'＋ خطة علاجية جديدة'}</h3>
      <button type="button" class="btn ghost sm" onclick="closePlanForm()" title="إغلاق (Esc)" aria-label="إغلاق">✕</button></div>
    <div class="row" style="gap:.5rem;flex-wrap:wrap;margin-top:.5rem">
      <label style="flex:1;min-width:240px">الطالب<select id="pf-student" class="inp">${opts}</select></label>
      <label style="min-width:150px;align-self:flex-end">نوع الخطة<span style="display:flex;align-items:center;gap:.35rem;font-weight:400;padding:.45rem 0"><input type="checkbox" id="pf-group" ${grp?'checked':''} onchange="togglePlanGroup()"> خطة جماعية</span></label>
      <label style="min-width:150px">تاريخ البدء<input id="pf-start" type="date" class="inp" value="${planEsc(p?p.startDate:new Date().toISOString().slice(0,10))}"></label>
      <label style="min-width:150px">مدة الخطة<select id="pf-dur" class="inp">${[7,14,21,28].map(d=>`<option value="${d}" ${((p&&p.durationDays)||14)==d?'selected':''}>${d===7?'أسبوع':d===14?'أسبوعان (موصى به)':d===21?'ثلاثة أسابيع':'أربعة أسابيع'}</option>`).join('')}</select></label>
      <label style="min-width:190px">أساس الحكم على الخطة<select id="pf-measure" class="inp" title="بماذا يُقاس نجاح الخطة">${[['auto','تلقائي حسب نمط الطالب'],['academic','📘 التحصيل (الأنشطة والمهارات)'],['hw','📚 تسليم الواجبات'],['att','🗓️ الحضور'],['beh','🙂 السلوك']].map(([v,t])=>`<option value="${v}" ${((p&&p.measure)||'auto')===v?'selected':''}>${t}</option>`).join('')}</select></label>
      <input id="pf-end" type="hidden" value="${planEsc(p?p.endDate:'')}">
      ${p?'':`<label style="flex-basis:100%;display:flex;gap:.45rem;align-items:center;font-weight:600;font-size:.88rem;margin-top:.2rem"><input type="checkbox" id="pf-send" checked> 🩹 أرسل مهمة علاجية للبوابة فور إنشاء الخطة <span class="muted" style="font-weight:400;font-size:.78rem">(من أخطائه في المهارات المستهدفة وحدها — تُعلَّم إجراءاتها تلقائيًا عند الحل)</span></label>`}
    </div>
    <div id="pf-members" style="display:none;margin-top:.5rem"></div>
    <div id="pf-skills-box" style="margin-top:.6rem"></div>
    <div id="pf-dx" style="margin-top:.6rem"></div>
    <label style="display:block;margin-top:.5rem">سبب الخطة (الفجوة المحددة)
      <input id="pf-reason" class="inp" placeholder="يُملأ تلقائيًا من المهارات المفقودة — عدّله بما تعرفه عنه" value="${planEsc(p?p.reason:'')}"></label>
    <div style="margin-top:.6rem"><b>③ الإجراءات العلاجية</b>
      <div class="muted" style="font-size:.8rem">لكل مهارة مستهدفة إجراءان يناسبان مستواها (تأسيس أو دعم) — تُضاف وتُحذف مع تحديدها. أضف ما تراه من المقترحات العامة.</div>
      <div id="pf-bank" style="display:flex;flex-wrap:wrap;gap:.4rem;margin:.5rem 0">
        ${PLAN_ACTION_BANK.map(a=>`<button type="button" class="btn ghost sm" onclick="addPlanAction(this.textContent)">${planEsc(a)}</button>`).join('')}
      </div>
      <div class="row" style="gap:.4rem"><input id="pf-new" class="inp" placeholder="إجراء آخر…" style="flex:1"><button class="btn sm" onclick="addPlanAction(document.getElementById('pf-new').value);document.getElementById('pf-new').value=''">إضافة</button></div>
      <ul id="pf-actions" style="margin:.6rem 0;padding-inline-start:1.1rem"></ul>
    </div>
    <label style="display:block">ملاحظات<textarea id="pf-notes" class="inp" rows="2">${planEsc(p?p.notes:'')}</textarea></label>
    <div class="row" style="gap:.5rem;margin-top:.7rem">
      <button class="btn tick" onclick="submitPlan()">💾 حفظ الخطة</button>
      <button class="btn ghost" onclick="closePlanForm()">إلغاء</button>
      ${p?`<button class="btn bad" onclick="deletePlan('${planEsc(p.id)}')">🗑️ حذف</button>`:''}
    </div>
  </div>`;
  window._pfActions=acts.slice();
  renderPlanActions();
  renderPlanMembers();
  const sel=document.getElementById('pf-student');
  if(sel&&!sel._dx){ sel._dx=1; sel.addEventListener('change',()=>showDiagnosis(sel.value,true)); }
  showDiagnosis(sel?sel.value:'', !p);
}
/* التحليل التلقائي: يقرأ التصنيف من الخادم ويعرضه مع أدلته */
function showDiagnosis(sid,autofill){
  const box=document.getElementById('pf-dx'); if(!box) return;
  const dx=((PLAN_DATA&&PLAN_DATA.diagnoses)||{})[String(sid)];
  window._pfSid=String(sid||''); renderPlanSkills();
  if(!dx||!dx.pattern){
    box.innerHTML=`<div class="dx-box muted">${planEsc(dx?dx.label:'اختر الطالب ليُحلَّل نمطه')}</div>`;
    return;
  }
  const sk=dx.basis==='skills', sup=sk?(dx.support||[]):dx.signals;
  box.innerHTML=`<div class="dx-box ${sk?'':'dx-warn'}">
    <div class="row" style="justify-content:space-between;align-items:center;gap:.5rem">
      <b>${sk?'🎯 أساس الخطة: المهارات المفقودة أعلاه':`🔍 النمط الظاهر من البيانات: ${planEsc(dx.label)}`}</b>
      ${dx.confident?'':'<span class="chip warn">قياس محدود — تحقّق بنفسك</span>'}
    </div>
    ${sup.length?`<div style="margin-top:.4rem"><span class="muted" style="font-size:.8rem">${sk?'عوامل مساندة (تضيف إجراءً داعمًا ولا تغيّر أساس الخطة):':'المؤشرات:'}</span> ${sup.map(x=>`<span class="chip ghost">${planEsc(x.text)}</span>`).join(' ')}</div>`:''}
    ${!sk&&dx.noSkills?`<div class="dx-nosk">⚠️ لم تُحدَّد مهارة مفقودة — الخطة الآن عامة على النمط. حدّد المهارة من الجدول أعلاه (أو أرسل اختبارًا تشخيصيًا) حتى تُبنى الخطة عليها وتُقاس.</div>`:''}
    ${!sk&&dx.weak&&dx.weak.length?`<div class="muted" style="font-size:.82rem;margin-top:.4rem">أضعف الأنشطة: ${dx.weak.map(a=>`${planEsc(a.title)} <b>${a.rate}%</b>`).join(' · ')}</div>`:''}
    <div class="muted" style="font-size:.78rem;margin-top:.45rem">${sk?'المهارة المفقودة تُظهر <b>ماذا</b> ينقصه، لا <b>لماذا</b> — السبب (قرائي، منزلي، فجوة سابقة) يبقى لملاحظتك.':'هذا تصنيفٌ لما تُظهره البيانات لا تشخيصٌ للسبب — عدّل النص بما تعرفه عن الطالب.'}</div>
    <div class="row" style="gap:.4rem;margin-top:.5rem;flex-wrap:wrap">
      <button type="button" class="btn ghost sm" onclick="applyDiagnosis('${planEsc(sid)}')">↺ إعادة تطبيق المقترح</button>
    </div></div>`;
  if(autofill) applyDiagnosis(sid);
}
function applyDiagnosis(sid){
  const dx=((PLAN_DATA&&PLAN_DATA.diagnoses)||{})[String(sid)];
  if(!dx||!dx.pattern) return;
  const rs=document.getElementById('pf-reason');
  if(rs) rs.value=dx.summary||'';
  window._pfPattern=dx.pattern||'';
  window._pfSkills=(dx.skills||[]).map(s=>s.skill);
  renderPlanSkills();
  window._pfActions=(dx.actions||[]).slice();
  renderPlanActions();
}
/* 🏷️ المهارات المستهدفة في الخطة
   مصدرها: «تصنيف مهارات الأسئلة» — الذكاء الاصطناعي يعطي كل سؤال في النشاط المنشور اسم مهارته
   (تلقائيًا عند النشر، أو من زر «صنّف الآن» في لوحة العلاج التلقائي أعلى هذا القسم) ويُحفظ في الخادم.
   الخادم يحسب نسبة الطالب في كل مهارة، فيقترح هنا ما دون 60%. المحدَّد يُحفظ في الخطة (حتى 6)
   ويُقاس الأثر عليه متى توفّرت 3 أسئلة منه قبل البدء وبعده. */
const PLAN_SKILL_MAX=6, SKILL_TARGET_UI=80, SKILL_GAP_UI=60;
/* مستوى المهارة: نفس نطاقات التقرير التشخيصي */
function skBand(r){return r>=SKILL_TARGET_UI?{k:'mastered',n:'متمكّن',c:'tick'}:r>=SKILL_GAP_UI?{k:'review',n:'يحتاج مراجعة',c:'ghost'}:r>=40?{k:'support',n:'فجوة تحتاج دعمًا',c:'warn'}:{k:'found',n:'يحتاج تأسيسًا',c:'bad'}}
/* إجراءات تسمّي المهارة وتناسب مستواها (نفس منطق الخادم) */
function skActions(skill,rate){const n=`«${skill}»`;return (rate!=null&&rate<40)
  ?[`تأسيس ${n}: إعادة تدريسها من البداية بمحسوسات وأمثلة مختلفة عن شرح الصف`,`تدريب متدرّج على ${n} من السهل إلى الأصعب مع تحقق بعد كل خطوة`]
  :[`دعم ${n}: شرح موجّه لأخطائه فيها ثم مثال محلول معه`,`ورقة تدريب قصيرة على ${n} (5 أسئلة) وتصحيحها معه`]}
/* كل أسماء المهارات المعروفة: المصنّفة في الأنشطة + مهارات أسئلة الاختبارات التشخيصية */
function knownSkillNames(){const d=(typeof HW!=='undefined'?HW:[]).filter(h=>h&&h.kind==='diag').flatMap(h=>(h.qs||[]).map(q=>String(q&&q.skill||'').trim())).filter(Boolean);
  const C=typeof skCanon==='function'?skCanon:(x=>x), O=typeof skOutcomes==='function'?skOutcomes().map(o=>o.key):[];   // نواتج الفصل أولًا، والقديمة بأسمائها الموحّدة
  return [...new Set([...O,...(SKILL_NAMES||[]).map(C),...d.map(C)])]}
/* ملف المهارات للطالب أو للمجموعة (متوسط الأعضاء، وعدد من تنقصه المهارة) */
function planGapProfile(){
  const D=(PLAN_DATA&&PLAN_DATA.diagnoses)||{}, grp=!!document.getElementById('pf-group')?.checked;
  const ids=grp?(window._pfMembers||[]).map(String):[String(window._pfSid||'')];
  const by=new Map();
  ids.forEach(id=>{const dx=D[id];const prof=dx&&Array.isArray(dx.profile)?dx.profile:(dx&&Array.isArray(dx.skills)?dx.skills:[]);
    prof.forEach(x=>{const o=by.get(x.skill)||{skill:x.skill,rates:[],total:0,diag:0,acts:0,miss:0};o.rates.push(x.rate);o.total+=x.total||0;o.diag+=x.diag||0;o.acts+=x.acts!=null?x.acts:(x.total||0);if(x.rate<SKILL_GAP_UI)o.miss++;by.set(x.skill,o)})});
  return {grp,n:ids.filter(Boolean).length,rows:[...by.values()].map(o=>({...o,rate:Math.round(o.rates.reduce((t,v)=>t+v,0)/o.rates.length)})).sort((a,b)=>a.rate-b.rate)};
}
/* 📈 «بعد الخطة» لكل مهارة (عند فتح خطة قائمة): نتيجة المهمة العلاجية (آخر محاولة محلولة)
   ونتيجة الأنشطة الجديدة منذ بدء الخطة. «الإتقان» في الجدول يبقى مجمل الفترة من الأنشطة والتشخيصي
   — المهمة العلاجية لا تدخل فيه — فقد يبقى أحمر رغم حل الطالب مهمته. */
function planAfterMap(){
  const out=new Map(), p=planEditId&&(PLAN_DATA&&PLAN_DATA.plans||[]).find(x=>x.id===planEditId); if(!p) return out;
  const ids=new Set(planMemberIds(p));
  const get=k=>out.get(k)||(out.set(k,{ac:0,at:0,rc:0,rt:0}),out.get(k));
  (p.members||[]).forEach(m=>{ ((m.skill&&m.skill.items)||[]).forEach(it=>{ if(it.after&&it.after.total){ const o=get(it.skill); o.ac+=it.after.correct; o.at+=it.after.total; } }); });
  (REM_ROWS||[]).filter(x=>x.planId===p.id&&ids.has(String(x.sid))).forEach(x=>{
    const done=(x.attempts||[]).filter(a=>a&&a.rate!=null).sort((a,b)=>(b.doneAt||0)-(a.doneAt||0))[0]; if(!done) return;
    if(done.skills) Object.entries(done.skills).forEach(([k,v])=>{ if(v&&v.t){ const o=get(k); o.rc+=v.c; o.rt+=v.t; } });
    else (p.skills||[]).forEach(k=>{ if(String(x.srcTitle||'').includes(k)){ const o=get(k); o.rc+=Math.round(done.rate/100*(done.n||5)); o.rt+=done.n||5; } });
  });
  return out;
}
function planAfterCell(a){
  if(!a||(!a.at&&!a.rt)) return '<span class="muted">—</span>';
  const pc=(c,t)=>Math.round(c/t*100), tag=r=>r>=SKILL_TARGET_UI?'ok':r>=SKILL_GAP_UI?'':'bad';
  return [a.rt?`<span class="sk-after ${tag(pc(a.rc,a.rt))}" title="نتيجة المهمة العلاجية (${a.rc} من ${a.rt})">🩹 ${pc(a.rc,a.rt)}%</span>`:'',
          a.at?`<span class="sk-after ${a.at>=2?tag(pc(a.ac,a.at)):''}" title="الأنشطة منذ بدء الخطة (${a.ac} من ${a.at})">✏️ ${pc(a.ac,a.at)}%</span>`:''].filter(Boolean).join(' ');
}
function renderPlanSkills(){
  const box=document.getElementById('pf-skills-box'); if(!box) return;
  // 🔒 المهارات = نواتج نافس فقط (من كل المصادر: أنشطة مصنّفة، تشخيصي، أنشطة نافس) مجمّعة بالوحدة؛
  //    الأسماء القديمة غير المربوطة لا تدخل الخطة — تُعدّ ويُدعى المعلم لربطها
  const G=planGapProfile(), AF=planAfterMap(), hasAf=AF.size>0;
  const rows=G.rows.filter(r=>planIsOutcome(r.skill)), legacy=G.rows.filter(r=>!planIsOutcome(r.skill));
  const chosen=window._pfSkills=(window._pfSkills||[]).slice(0,PLAN_SKILL_MAX);
  const rate=new Map([...rows.map(r=>[r.skill,r.rate]),...(typeof planNafsRateMap==='function'?planNafsRateMap():[])]);
  const elig=(typeof HW!=='undefined'?HW:[]).filter(skillEligible), need=elig.filter(skillNeeded).length;
  const diagN=(typeof HW!=='undefined'?HW:[]).filter(h=>h&&h.kind==='diag'&&(h.qs||[]).some(q=>q&&q.skill)).length;
  const gaps=planByUnit(rows.filter(r=>r.rate<SKILL_GAP_UI)), rest=planByUnit(rows.filter(r=>r.rate>=SKILL_GAP_UI));
  const manual=chosen.filter(k=>!rate.has(k));
  const src=r=>[r.diag?`🔍 تشخيصي ${r.diag}`:'',r.acts?`✏️ أنشطة ${r.acts}`:''].filter(Boolean).join(' · ');
  const row=r=>{const b=skBand(r.rate);return `<tr class="${chosen.includes(r.skill)?'on':''}"><td><input type="checkbox" class="pf-skill" value="${planEsc(r.skill)}" ${chosen.includes(r.skill)?'checked':''} onchange="planSkillToggle(this)" aria-label="${planEsc(r.skill)}"></td>
    <td class="sk-n">${planEsc(planSkName(r.skill))}</td><td><b>${r.rate}%</b></td><td><span class="chip ${b.c}">${b.n}</span>${G.grp&&r.miss?` <small class="muted">${r.miss} من ${G.n}</small>`:''}</td>${hasAf?`<td class="sk-af">${planAfterCell(AF.get(r.skill))}</td>`:''}<td class="muted sk-src">${src(r)} سؤالًا</td></tr>`};
  box.innerHTML=`<div class="dx-box pf-gap">
    <div class="row" style="justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap">
      <b>① تحديد الفجوات في المهارات ${G.grp?`<span class="muted" style="font-weight:400;font-size:.78rem">(متوسط ${G.n} طلاب)</span>`:''}</b>
      <span class="chip ${chosen.length?'tick':'warn'}">${chosen.length}/${PLAN_SKILL_MAX} مهارة مستهدفة</span>
    </div>
    <div class="muted" style="font-size:.78rem;margin-top:.3rem;line-height:1.7">من إجاباته في <b>الاختبار التشخيصي</b> (لكل سؤال مهارته) و<b>الأنشطة</b> (تصنَّف أسئلتها بالذكاء الاصطناعي). ما دون ${SKILL_GAP_UI}% <b>مهارة مفقودة</b> تُحدَّد تلقائيًا، والخطة تُبنى عليها: هدف وإجراءات ومهمة علاجية وقياس لكل مهارة.</div>
    ${rows.length?`<div class="sk-wrap"><table class="sk-t"><thead><tr><th></th><th>المهارة</th><th>الإتقان</th><th>المستوى</th>${hasAf?'<th title="بعد بدء الخطة">بعد الخطة</th>':''}<th>المصدر</th></tr></thead><tbody>
      ${planUnitRows(gaps,row,hasAf?6:5)||`<tr><td colspan="${hasAf?6:5}" class="muted" style="text-align:center">لا ناتج دون ${SKILL_GAP_UI}% — لا توجد فجوة مهارية ظاهرة.</td></tr>`}
      ${manual.map(k=>`<tr class="on"><td><input type="checkbox" class="pf-skill" value="${planEsc(k)}" checked onchange="planSkillToggle(this)"></td><td class="sk-n">${planEsc(planSkName(k))}${planIsOutcome(k)?'':' <small class="muted">(اسم قديم)</small>'}</td><td>—</td><td><span class="chip ghost">${planIsOutcome(k)?'بلا قياس بعد':'اسم قديم'}</span></td>${hasAf?`<td class="sk-af">${planAfterCell(AF.get(k))}</td>`:''}<td class="muted sk-src">${knownSkillNames().includes(k)?'تُقاس من الأسئلة القادمة':'✍️ لا تطابق اسم مهارة مصنّفة — لن تُقاس'}</td></tr>`).join('')}
    </tbody></table></div>
    ${hasAf?`<div class="sk-af-note">ℹ️ <b>«الإتقان»</b> تشخيص الفترة من الأنشطة والتشخيصي، ولا تدخل فيه المهمة العلاجية — فيبقى كما شُخّص. التحسّن يظهر في <b>«بعد الخطة»</b>: 🩹 المهمة العلاجية · ✏️ الأنشطة منذ البدء. الخطة تنجح حين تبلغ كل مهارة ${SKILL_TARGET_UI}% في الأسئلة الجديدة بعد البدء (الأنشطة + الأسئلة البديلة في المهمة؛ السؤال الأصلي المعاد لا يُحتسب).</div>`:''}
    ${rest.length?`<details class="sk-more"><summary>نواتج أخرى أعلى من ${SKILL_GAP_UI}% <span class="chip ghost">${rest.length}</span></summary><table class="sk-t"><tbody>${planUnitRows(rest,row,hasAf?6:5)}</tbody></table></details>`:''}
    ${legacy.length?`<div class="pf-legacy">⚠️ ${legacy.length} ${legacy.length===1?'مهارة باسم قديم':'مهارات بأسماء قديمة'} خارج نواتج نافس لا تدخل الخطة (${legacy.slice(0,3).map(r=>planEsc(r.skill)).join('، ')}${legacy.length>3?'…':''}) — <button type="button" class="btn ghost sm" onclick="skAliasOpen()">🎯 اربطها بالنواتج</button></div>`:''}`
    :`<div class="sk-none">⚠️ <b>لم تُحدَّد فجوات مهارية لهذا ${G.grp?'المجموعة':'الطالب'} بعد.</b> لتحديدها:
        <ul><li>أرسل <b>🔍 اختبارًا تشخيصيًا</b> للفصل — كل سؤال فيه مرتبط بمهارة${diagN?` (لديك ${diagN} اختبار)`:''}.</li>
        <li>أو صنّف أسئلة الأنشطة بمهاراتها${need?` — ${need} نشاط بلا تصنيف`:''}.</li></ul>
        بدونها ستكون الخطة عامة على النمط، لا على مهارة محددة.</div>`}
    ${need&&twinHasKey()?`<div class="row" style="gap:.4rem;margin-top:.4rem;align-items:center;flex-wrap:wrap"><span class="muted" style="font-size:.78rem">⚠️ ${need} نشاط بلا تصنيف — مهاراتها لا تظهر ولا تُقاس.</span><button type="button" class="btn ghost sm" onclick="skillTagMissing()">🏷️ صنّف الآن</button></div>`
      :need?`<div class="muted" style="font-size:.78rem;margin-top:.4rem">⚠️ ${need} نشاط بلا تصنيف — أضف مفتاح ذكاء اصطناعي من ⚙️ الإعدادات ليُصنَّف.</div>`:''}
    <div class="row" style="gap:.4rem;margin-top:.5rem">
      <select id="pf-skill-new" class="inp" style="flex:1"><option value="">＋ أضف ناتجًا لاحظت ضعفه (من نواتج نافس)…</option>${planOutcomeOptions(chosen)}</select>
      <button type="button" class="btn ghost sm" onclick="skCustomOpen('plan')" title="مهارة ترى أنها يجب أن تكون ضمن القائمة — تُضاف داخل وحدتها">➕ مهارة جديدة</button>
      <button type="button" class="btn sm" onclick="planSkillAdd()">إضافة</button>
    </div>
    ${chosen.length?`<div class="pf-goals"><b>② أهداف الخطة</b><ol>${chosen.map(k=>`<li>أن ${G.grp?'يتقن الطلاب':'يتقن الطالب'} مهارة <b>«${planDisp(k)}»</b> بنسبة ${SKILL_TARGET_UI}% فأكثر <span class="muted">— ${rate.has(k)?`مستواه الآن ${rate.get(k)}%`:'لا قياس قبلي بعد'}</span></li>`).join('')}</ol>
      <div class="muted" style="font-size:.76rem">تُغلق الخطة ناجحة عندما تبلغ كل مهارة ${SKILL_TARGET_UI}%، والمهمة العلاجية تُبنى من أخطائه في هذه المهارات وحدها.</div></div>`:''}
  </div>`;
  const nb=document.getElementById('pf-nafs'); if(nb) nb.remove();   // كان جدولًا ثانيًا لنواتج نافس من أنشطة نافس وحدها — صار ضمن الجدول الموحّد
}
/* 🔒 نواتج نافس: الاسم الرسمي «نافس: …»، اسمه المختصر للعرض، ووحدته — والعرض مجمّع بالوحدة */
/* عرض فقط: «نافس: قانون نيوتن الأول» ← «قانون نيوتن الأول» (المحفوظ يبقى بالاسم الرسمي الكامل لأن مطابقة الإجراءات بمهاراتها تعتمد عليه) */
function planDisp(t){ return planEsc(String(t??'').replace(/نافس:\s*/g,'')); }
function planIsOutcome(k){ return typeof nafsIsSkill==='function'&&nafsIsSkill(k)&&!!(typeof nafsOutOfSkill==='function'&&nafsOutOfSkill(k)); }
function planSkName(k){ return String(k||'').replace(/^نافس:\s*/,''); }
function planSkUnit(k){ const o=typeof nafsOutOfSkill==='function'?nafsOutOfSkill(k):null, s=o&&(NAFS_SECTIONS||[]).find(x=>x.id===o.sec); return s?{id:s.id,title:s.title,term:s.term,ord:(NAFS_SECTIONS||[]).indexOf(s)}:{id:'',title:'',term:0,ord:999}; }
function planByUnit(rows){ return rows.slice().sort((a,b)=>planSkUnit(a.skill).ord-planSkUnit(b.skill).ord||a.rate-b.rate); }
function planUnitRows(rows,row,cols){ let cur=null; return rows.map(r=>{ const u=planSkUnit(r.skill); const h=u.title!==cur?`<tr class="sk-unit"><td colspan="${cols}">📚 ${planEsc(u.title)}${u.term?` <small class="muted">· الفصل ${u.term===1?'الأول':'الثاني'}</small>`:''}</td></tr>`:''; cur=u.title; return h+row(r); }).join(''); }
function planOutcomeOptions(chosen){
  const cur=(typeof ctSemActive==='function'?ctSemActive().sem:1), all=(typeof skAllOutcomes==='function'?skAllOutcomes():[]), set=new Set(chosen||[]), by={};
  all.filter(o=>!set.has(o.key)).forEach(o=>{ const g=`${o.term===cur?'⭐ ':''}الفصل ${o.term===1?'الأول':'الثاني'} · ${o.sec}`; (by[g]=by[g]||[]).push(o); });
  return Object.entries(by).map(([g,os])=>`<optgroup label="${planEsc(g)}">${os.map(o=>`<option value="${planEsc(o.key)}">${planEsc(o.short)}</option>`).join('')}</optgroup>`).join('');
}
/* تحديد مهارة يضيف إجراءاتها، وإلغاؤها يحذفها */
function planSkillActsSync(skill,on){
  const acts=window._pfActions=window._pfActions||[], tag=`«${skill}»`;
  if(on){const r=planGapProfile().rows.find(x=>x.skill===skill),nr=!r&&typeof planNafsRateMap==='function'?planNafsRateMap().get(skill):null;skActions(skill,r?r.rate:(nr??null)).forEach(t=>{if(!acts.includes(t))acts.push(t)})}
  else window._pfActions=acts.filter(t=>!String(t).includes(tag));
  renderPlanActions();
}
/* إضافة ناتج بالمفتاح مباشرة (بعد إنشاء مهارة جديدة من ➕) */
function planSkillAddKey(k){ const cur=window._pfSkills||[]; if(!cur.includes(k)){ if(cur.length>=PLAN_SKILL_MAX){ toast(`الحد ${PLAN_SKILL_MAX} مهارات للخطة — ألغِ واحدة أولًا`,'bad'); renderPlanSkills(); return } cur.push(k); planSkillActsSync(k,true) }
  window._pfSkills=cur; renderPlanSkills(); planReasonSync(); }
/* سبب الخطة يتبع المهارات المحددة ما لم يكتبه المعلم بنفسه */
function planReasonSync(){
  const rs=document.getElementById('pf-reason'); if(!rs) return;
  const ks=window._pfSkills||[]; if(!ks.length) return;
  if(rs.value&&!rs.value.startsWith('فجوة في المهارات')) return;
  const rate=new Map(planGapProfile().rows.map(r=>[r.skill,r.rate]));
  const keep=rs.value.includes(' · عوامل مساندة: ')?' · عوامل مساندة: '+rs.value.split(' · عوامل مساندة: ')[1]:'';
  rs.value=`فجوة في المهارات — ${ks.map(k=>rate.has(k)?`${k} (${rate.get(k)}%)`:k).join('، ')}${keep}`;
}
function renderPlanMembers(){
  const box=document.getElementById('pf-members'); if(!box) return;
  const on=document.getElementById('pf-group')?.checked;
  const sel=document.getElementById('pf-student');
  if(sel) sel.disabled=!!on;
  try{renderPlanSkills()}catch(e){}   // جدول الفجوات يتبع أعضاء المجموعة
  if(!on){ box.style.display='none'; return }
  box.style.display='';
  const chosen=new Set((window._pfMembers||[]).map(String));
  const all=(STUDENTS||[]).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar'));
  const classes=[...new Set(all.map(s=>String(s.cls||'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  if(window._pfMemCls===undefined) window._pfMemCls=(document.getElementById('plan-class')||{}).value||'';
  const cls=window._pfMemCls, q=String(window._pfMemQ||'').trim();
  const roster=all.filter(s=>!cls||String(s.cls||'')===cls);
  const cand=new Set(((PLAN_DATA&&PLAN_DATA.planCandidates)||[]).map(x=>String(x.id||x.studentId||'')));
  const inCls=roster.filter(s=>chosen.has(String(s.id))).length;
  box.innerHTML=`<div class="dx-box"><div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap"><b>أعضاء المجموعة (${chosen.size})</b>
      ${cls&&chosen.size!==inCls?`<span class="muted" style="font-size:.76rem">${chosen.size-inCls} من فصول أخرى</span>`:''}</div>
    <div class="muted" style="font-size:.78rem;margin:.2rem 0 .45rem">القياس القبلي والبعدي يُحسبان لكل طالب على حدة، ويُعرض المتوسط ومن تحسّن ومن تراجع.</div>
    <div class="mem-tools">
      <select class="inp" onchange="window._pfMemCls=this.value;renderPlanMembers()" aria-label="الفصل"><option value="">كل الفصول (${all.length})</option>${classes.map(c=>`<option value="${planEsc(c)}" ${c===cls?'selected':''}>${planEsc(c)} (${all.filter(s=>String(s.cls||'')===c).length})</option>`).join('')}</select>
      <input class="inp" type="search" placeholder="🔍 ابحث بالاسم" value="${planEsc(q)}" oninput="window._pfMemQ=this.value;planMemFilter()" aria-label="بحث">
    </div>
    <div class="mem-tools mem-btns">
      <button type="button" class="btn ghost sm" onclick="planMemBulk('all')">☑️ تحديد الكل${cls?' في '+planEsc(cls):''}</button>
      ${cand.size?`<button type="button" class="btn ghost sm" onclick="planMemBulk('cand')">🎯 المرشحون فقط</button>`:''}
      <button type="button" class="btn ghost sm" onclick="planMemBulk('none')">إلغاء التحديد</button>
    </div>
    <div class="mem-grid" id="pf-mem-grid">${roster.map(st=>`<label class="mem-item ${chosen.has(String(st.id))?'on':''}" data-name="${planEsc(st.name)}" data-id="${planEsc(st.id)}"><input type="checkbox" ${chosen.has(String(st.id))?'checked':''} onchange="togglePlanMember('${planEsc(st.id)}')"> ${planEsc(st.name)}${cand.has(String(st.id))?' <span title="مرشح لخطة علاجية">🎯</span>':''}</label>`).join('')||'<div class="muted">لا يوجد طلاب في هذا الفصل</div>'}</div></div>`;
  planMemFilter();
}
/* البحث يخفي ولا يعيد الرسم، حتى يبقى المؤشر في خانة البحث */
function planMemFilter(){
  const q=String(window._pfMemQ||'').trim();
  document.querySelectorAll('#pf-mem-grid .mem-item').forEach(el=>{el.style.display=!q||String(el.dataset.name||'').includes(q)?'':'none'});
}
/* 🎯 أسماء مهارات قديمة (من تصنيف سابق أو اختبار تشخيصي) غير مربوطة بنواتج نافس: لا تدخل تحديد الخطط حتى تُربط.
   شريط دائم أعلى الخطط، وتُفتح أداة الربط تلقائيًا مرة في اليوم */
function pqLegacyNudge(){
  const box=document.getElementById('plan-groups'); if(!box||typeof skUnmappedCount!=='function') return;
  const n=skUnmappedCount();
  // أسئلة تشخيصية لم يطابق اسم مهارتها ناتجًا عند الاستيراد ← بلا مهارة حتى يختار المعلم ناتجها في المحرر
  const dg=(typeof HW!=='undefined'?HW:[]).filter(h=>h&&h.kind==='diag').map(h=>({h,k:(h.qs||[]).filter(q=>q&&q.skRaw&&!q.skill).length})).filter(x=>x.k);
  box.innerHTML=(n?`<div class="pq-legacy">⚠️ <b>${n}</b> ${n===1?'اسم مهارة قديم غير مربوط':'أسماء مهارات قديمة غير مربوطة'} بنواتج نافس — إجابات طلابك عليها <b>لا تدخل تحديد الخطط</b> حتى تربطها. <button type="button" class="btn tick sm" onclick="skAliasOpen()">🎯 اربطها الآن</button></div>`:'')
    +((L=>L.length?`<div class="pq-legacy multi">📌 ${L.length===1?'خطة جارية مهاراتها':`${L.length} خطط جارية مهاراتها`} بأسماء قديمة غير مربوطة بنواتج نافس — تُقاس بنشاطها العام لا بالمهارة. ${n?'اربط الأسماء أعلاه، أو ':''}حدّث مهاراتها: ${L.slice(0,8).map(p=>`<button type="button" class="btn ghost sm" onclick="openPlanForm('${planEsc(p.id)}')">✏️ ${planEsc(p.name||'خطة')}</button>`).join(' ')}${L.length>8?' …':''}</div>`:'')(planLegacyPlans()))
    +(dg.length?`<div class="pq-legacy multi">🔍 أسئلة تشخيصية بلا ناتج — مهارتها لم تطابق نواتج نافس، فلا تدخل إجاباتها التشخيص: ${dg.map(x=>`<button type="button" class="btn ghost sm" onclick="openQs('${planEsc(x.h.id)}')">«${planEsc(x.h.title||'تشخيصي')}» · ${x.k} ${x.k===1?'سؤال':x.k<=10?'أسئلة':'سؤالًا'}</button>`).join(' ')}</div>`:'');
  if(!n) return;
  const today=new Date().toISOString().slice(0,10); let last=''; try{ last=localStorage.getItem('ska_auto_day')||''; }catch(e){}
  const onPlans=document.getElementById('plan-list')&&document.getElementById('plan-list').offsetParent;
  if(last!==today&&onPlans&&!document.getElementById('veil')?.classList.contains('on')){ try{ localStorage.setItem('ska_auto_day',today); }catch(e){} setTimeout(()=>{ try{ skAliasOpen(); }catch(e){} },700); }
}
function planLegacyPlans(){ const cv=k=>typeof skCanon==='function'?skCanon(k):k;
  return ((PLAN_DATA&&PLAN_DATA.plans)||[]).filter(p=>p.status!=='done'&&(p.skills||[]).some(k=>!planIsOutcome(cv(k)))); }
function renderPlanGroups(){
  const box=document.getElementById('plan-groups'); if(!box) return;
  return;   // 🧭 المجموعات صارت ضمن «قائمة العلاج هذا الأسبوع» — والصندوق يحمل الآن شريط الأسماء القديمة (pqLegacyNudge)
  const cls=document.getElementById('plan-class')?.value||'';
  const gs=((PLAN_DATA&&PLAN_DATA.planGroups)||[]).filter(g=>!cls||g.cls===cls);
  if(!gs.length){ box.innerHTML=''; return }
  box.innerHTML=`<details class="card plan-fold" style="background:var(--ui-surface-2)" ${window._planFoldG?'open':''} ontoggle="window._planFoldG=this.open">
    <summary>👥 مجموعات مقترحة <span class="chip ghost">${gs.length}</span> <span class="muted" style="font-size:.78rem;font-weight:400">طلاب تجمعهم فجوة واحدة</span></summary>
    <div class="muted" style="font-size:.8rem;margin-top:.3rem">طلاب يشتركون في نفس الفجوة — تدخّل واحد يكفيهم بدل خطط منفصلة.</div>
    <div style="margin-top:.5rem">${gs.slice(0,8).map(g=>`<div class="grp-row">
      <div><b>${planEsc(g.label)}</b> <span class="muted">${planEsc(g.cls)}</span>
        <div class="muted" style="font-size:.82rem;margin-top:.2rem">${g.members.map(m=>planEsc(m.name)).join(' · ')}</div>
        ${g.classWide?`<div class="grp-wide">⚠️ ${planEsc(g.note)}</div>`:`<div class="muted" style="font-size:.8rem;margin-top:.2rem">${planEsc(g.note)}</div>`}</div>
      <button class="btn ${g.classWide?'ghost':'tick'} sm" onclick="planFromGroup('${planEsc(g.key)}')">＋ خطة جماعية</button>
    </div>`).join('')}</div></details>`;
}
function renderPlanActions(){
  const ul=document.getElementById('pf-actions'); if(!ul) return;
  const list=window._pfActions||[];
  ul.innerHTML=list.length?list.map((a,i)=>`<li style="margin:.25rem 0">${planDisp(a)} <button class="btn ghost sm" onclick="removePlanAction(${i})">حذف</button></li>`).join('')
    :'<li class="muted">لم تُضف إجراءات بعد.</li>';
}
/* 📝 الاختبارات: قياس مستقل بجانب الأنشطة */
function planExamRow(p){
  const e=p.exam; if(!e) return '';
  const r=m=>m&&m.measured&&m.rate!=null?m.rate+'%':'—';
  const g=e.gain==null?'':((e.gain>0?'▲ +':e.gain<0?'▼ ':'= ')+e.gain+' نقطة');
  const det=m=>m&&m.measured&&m.tests?` (${m.tests} ${m.tests===1?'اختبار':'اختبارات'})`:'';
  return `<div class="plan-exam"><b>📝 الاختبارات</b>
    <span>قبل الخطة <b>${r(e.before)}</b>${det(e.before)}</span><span>←</span><span>بعدها <b>${r(e.after)}</b>${det(e.after)}</span>
    ${g?`<span class="chip ${e.verdict==='تحسّن'?'tick':e.verdict==='تراجع'?'bad':'ghost'}">${g}</span>`:`<span class="chip ghost">${planEsc(e.verdict)}</span>`}
    ${(()=>{const L=x=>(x&&Array.isArray(x.list)?x.list:[]).map(t=>`${planEsc(t.title)} <small class="muted">${planEsc(String(t.date).slice(5).replace('-','/'))}</small> <b>${t.rate}%</b>`).join(' · ');
      const b=L(e.before),a=L(e.after);return b||a?`<div class="plan-exam-l"><span>قبل: ${b||'—'}</span><span>بعد: ${a||'—'}</span></div>`:''})()}
    ${e.undated?`<div class="plan-exam-un">📅 ${e.undated===1?'اختبار بلا تاريخ':e.undated+' اختبارات بلا تاريخ'}${Array.isArray(e.undatedList)&&e.undatedList.length?` (${[...new Set(e.undatedList)].map(planEsc).join('، ')})`:''} — <b>لم ${e.undated===1?'يُحتسب':'تُحتسب'} في المقارنة</b> لأنه لا يُعرف أكان قبل الخطة أم بعدها. حدّد تاريخه في «دفتر الاختبارات».</div>`:''}</div>`;
}
/* 📊 أدلة الحكم: دلالة الفرق، والمقارنة بالفصل، وفترة خط الأساس (تُحسب في الخادم) */
const PLAN_CONF_TONE={strong:'tick',likely:'warn',weak:'ghost'};
function planSigned(v){return v==null?'—':(v>0?'+':'')+v}
function planDate(d){return String(d||'').replace(/-/g,'/')}
function planBaseText(p){const w=p.window||{};if(!w.baseTo)return '';return w.baseFrom?`من ${planDate(w.baseFrom)} إلى ${planDate(w.baseTo)} (آخر 30 يومًا قبل البدء)`:`كل ما قبل ${planDate(w.from)} (آخر 30 يومًا لم تكفِ: أقل من 10 أسئلة)`}
function planPeerText(p){const r=p.peers;if(!r)return '';if(r.gain==null)return `لا مقارنة بالفصل (قِيس ${r.n} من زملائه فقط، والحد الأدنى 3)`;return `تغيّر زملائه في الفترة نفسها ${planSigned(r.gain)} (${r.n} طالبًا) ← الأثر الصافي للخطة ${planSigned(p.net)} نقطة`}
function planEvidenceHTML(p){
  const c=p.confidence, parts=[];
  if(c)parts.push(`<span class="chip ${PLAN_CONF_TONE[c.level]||'ghost'}" title="مجال الثقة 95% للفرق: من ${c.lo} إلى ${c.hi} نقطة">📊 ${planEsc(c.label)}</span><span class="muted">الفرق الحقيقي غالبًا بين ${planSigned(c.lo)} و${planSigned(c.hi)} نقطة · ${c.nBefore} ${planEsc(p.mainUnit||'سؤالًا')} قبل و${c.nAfter} بعد</span>`);
  const pt=planPeerText(p); if(pt)parts.push(`<span>👥 ${planEsc(pt)}</span>`);
  const bt=planBaseText(p); if(bt)parts.push(`<span class="muted">📅 خط الأساس: ${planEsc(bt)}</span>`);
  return parts.length?`<div class="plan-evid">${parts.join('')}</div>`:'';
}
/* 🧭 المؤشرات الانضباطية (من الخادم): الواجبات، المشاركة، الحضور، السلوك — قبل وبعد */
const PLAN_MEASURE_ICON={academic:'📘',hw:'📚',att:'🗓️',beh:'🙂',part:'🙋'};
function planMainLabel(p){return p.mainBy&&p.mainBy!=='academic'?`${PLAN_MEASURE_ICON[p.mainBy]||''} ${p.measureLabel||''}`:(p.basis==='skills'?'📘 المهارات المستهدفة':(Array.isArray(p.skills)&&p.skills.length?'📘 كل الأنشطة':'📘 التحصيل'))}
/* خطة مهارات لم تُقَس مهاراتها بعد: الرقم الكبير من كل الأنشطة — يجب أن يُقال صراحة */
function planBasisNote(p){return (!p.mainBy||p.mainBy==='academic')&&p.basis!=='skills'&&Array.isArray(p.skills)&&p.skills.length?`<div class="pc-basis">ℹ️ الرقم أعلاه من <b>كل أنشطته</b> — المهارات المستهدفة نفسها لم تُقَس بعد بأسئلة كافية (3 قبل البدء و3 بعده). نتيجة كل مهارة في الشارات أعلاه وفي «مسار الخطة».</div>`:''}
function planConductRows(p){const c=p.conduct;if(!c)return [];return ['hw','part','att','beh'].map(k=>c[k]).filter(x=>x&&(x.before.total||x.after.total))}
function planConductHTML(p){
  const rows=planConductRows(p); if(!rows.length&&!p.academic) return '';
  const r=m=>m&&m.total?`${m.rate}% <small class="muted">(${m.correct}/${m.total})</small>`:'—';
  const ac=p.academic;
  return `<div class="plan-skt"><b>🧭 كل عناصر التقييم قبل الخطة وبعدها</b><table><thead><tr><th>العنصر</th><th>قبل</th><th>بعد</th><th>الفرق</th></tr></thead><tbody>
    ${ac?`<tr><td>📘 التحصيل (${ac.basis==='skills'?'المهارات':'الأنشطة'})</td><td>${r(ac.before)}</td><td>${r(ac.after)}</td><td>${ac.gain==null?'<span class="muted">—</span>':`<b class="${ac.gain>=5?'up':ac.gain<=-5?'down':''}">${planSigned(ac.gain)}</b>`}</td></tr>`:''}
    ${rows.map(x=>`<tr ${x.key===p.mainBy?'class="main"':''}><td>${PLAN_MEASURE_ICON[x.key]||''} ${planEsc(x.label)}${x.key===p.mainBy?' <span class="chip tick" style="font-size:.68rem">أساس الحكم</span>':''}${x.key==='beh'&&x.after.neg?` <small class="muted">(${x.after.neg} ملاحظة بعد)</small>`:''}</td><td>${r(x.before)}</td><td>${r(x.after)}</td><td>${x.gain==null?'<span class="muted">لا يكفي</span>':`<b class="${x.gain>=5?'up':x.gain<=-5?'down':''}">${planSigned(x.gain)}</b>`}</td></tr>`).join('')}
  </tbody></table><div class="muted" style="font-size:.74rem">من سجلات المعلم الفعلية: آخر 30 يومًا قبل البدء مقابل مدة الخطة. الغياب بعذر والواجب «معذور» لا يُحسبان على الطالب. كل عنصر مستقل ولا يُدمج في رقم واحد.</div></div>`;
}
function planSkillRows(p){const it=p.skill&&Array.isArray(p.skill.items)?p.skill.items:[];return it}
/* 🎯 هدف كل مهارة مستهدفة: مستواه قبل ← بعد، وعلامة ✓ متى بلغ الهدف */
function planGoalRows(p){
  const ks=Array.isArray(p.skills)?p.skills:[], it=planSkillRows(p);
  return ks.map(k=>{const x=it.find(y=>y.skill===k)||{};const b=x.before?x.before.rate:null,a=x.after&&x.after.total>=2?x.after.rate:null;
    return {skill:k,before:b,after:a,beforeX:x.before,afterX:x.after,gain:x.gain,met:a!=null&&a>=SKILL_TARGET_UI}});
}
/* ═══ 📈 مسار الخطة: ما تغيّر بعد كل خطوة، بتاريخه ═══
   المصادر كلها فعلية: تاريخ البدء ومستواه قبله (الخادم) · المهام العلاجية ومحاولاتها ونتيجتها لكل مهارة ·
   الإجراءات المنفّذة وتاريخ تنفيذها · الأنشطة التي حلّها بعد البدء ودرجتها · قرارات ما بعد المدة · الإغلاق. */
function planDayMs(d){ return Date.parse(String(d||'')+'T00:00:00')||0; }
function planTlDate(ms){ if(!ms) return ''; const d=new Date(ms); return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`; }
function planMemberSkill(p,sid){
  const m=(p.members||[]).find(x=>String(x.studentId)===String(sid))||(p.group?null:p);
  const it=m&&m.skill&&Array.isArray(m.skill.items)?m.skill.items:[];
  const rem=planRemSkillsFor(p,sid);
  return (Array.isArray(p.skills)?p.skills:[]).map(k=>{const x=it.find(y=>y.skill===k)||{};
    return {skill:k,before:x.before||null,after:x.after&&x.after.total?x.after:null,rem:rem[k]!=null?rem[k]:null,
      act:x.afterAct||null,remP:x.afterRem||null,rep:Number(x.remRepeat)||0,sup:Number(x.actSuperseded)||0,srv:'afterAct' in x};});
}
function planEvents(p){
  const ev=[], ids=planMemberIds(p).filter(Boolean), grp=!!p.group, nm=sid=>{const s=(STUDENTS||[]).find(x=>String(x.id)===String(sid));return s?String(s.name).split(/\s+/).slice(0,2).join(' '):'';};
  const who=sid=>grp?`<b>${planEsc(nm(sid))}</b>: `:'';
  const start=planDayMs(p.startDate)||Number(p.createdAt)||0;
  if(start) ev.push({at:start,k:'start',ic:'🚩',t:`بدأت الخطة${(p.skills||[]).length?` على ${p.skills.length===1?'مهارة':p.skills.length+' مهارات'}: ${p.skills.map(x=>'«'+planEsc(x)+'»').join('، ')}`:''}`,
    d:p.before&&p.before.measured?`مستواه قبلها ${p.before.rate}% (${p.before.correct} من ${p.before.total})`:'لا قياس قبلي'});
  (REM_ROWS||[]).filter(x=>x.planId===p.id).forEach(x=>{
    (x.attempts||[]).forEach((a,i)=>{
      ev.push({at:Number(a.at)||Number(x.createdAt)||0,k:'send',ic:'📤',t:`${who(x.sid)}أُرسلت ${i?'المحاولة الثانية من ':''}المهمة العلاجية (${a.n||'?'} أسئلة من أخطائه)`,d:''});
      if(a.rate!=null){ const sk=a.skills?Object.entries(a.skills).filter(([,v])=>v&&v.t).map(([k,v])=>`«${planDisp(k)}» ${Math.round(v.c/v.t*100)}%`).join(' · '):'';
        ev.push({at:Number(a.doneAt)||Number(x.updatedAt)||0,k:a.rate>=SKILL_TARGET_UI?'ok':'try',ic:a.rate>=SKILL_TARGET_UI?'🟢':'🟠',
          t:`${who(x.sid)}حلّ المهمة العلاجية${x.attempts.length>1?` (م${i+1})`:''}: <b>${a.rate}%</b>${a.rate>=SKILL_TARGET_UI?' — أتقنها':i===0&&x.attempts.length>1?' — فُتحت له محاولة ثانية بأسئلة مختلفة':x.status==='escalated'?' — أخفق مرتين: يحتاج تدخلك':''}`,d:sk});
      }
    });
  });
  (p.actions||[]).forEach(a=>{ if(a&&a.done&&a.doneAt) ev.push({at:Number(a.doneAt),k:'act',ic:'✔',t:`نُفِّذ إجراء: ${planDisp(a.text)}`,d:''}); });
  // ✏️ الأنشطة العادية التي حلّها بعد البدء — هي ما يقيس الأثر رسميًا
  const startAt=Math.max(start,Number(p.createdAt)||0);
  if(startAt) ids.forEach(sid=>{ const st=(STUDENTS||[]).find(x=>String(x.id)===String(sid));
    (typeof HW!=='undefined'?HW:[]).forEach(h=>{ if(!h||h.remedial||!['normal','lab','reading'].includes(h.kind||'normal')) return;
      const v=(h.subs||{})[String(sid)]||(st&&(h.subs||{})[String(st.name)]); if(!v||!(Number(v.at)>=startAt)) return;
      const n=Number(v.total)||0,c=Number(v.correct)||0;
      ev.push({at:Number(v.at),k:'meas',ic:'✏️',t:`${who(sid)}حلّ نشاط «${planEsc(h.title)}»: <b>${n?Math.round(c/n*100)+'%':'—'}</b>${n?` (${c} من ${n})`:''}`,d:'يُحتسب في قياس الأثر'}); }); });
  (p.history||[]).forEach(x=>ev.push({at:planDayMs(x.at),k:'dec',ic:'⚖️',t:`قرار بعد انتهاء المدة: ${planEsc(x.label||'')}`,d:`الأثر وقتها: ${planEsc(x.verdict||'—')}${x.gain!=null?` (${planSigned(x.gain)})`:''}`}));
  if(p.status==='done') ev.push({at:planDayMs(p.endDate)||Date.now(),k:'end',ic:'🏁',t:`أُغلقت الخطة: <b>${planEsc(p.outcome||'منتهية')}</b>`,d:p.after&&p.after.measured?`مستواه عند الإغلاق ${p.after.rate}%${p.gain!=null?` (${planSigned(p.gain)} نقطة)`:''}`:''});
  return ev.filter(e=>e.at).sort((a,b)=>a.at-b.at);
}
/* جدول المقارنة لكل مهارة: قبل · المهمة العلاجية · الأنشطة بعد البدء — ثم الحكم */
function planCompareHTML(p){
  const ks=Array.isArray(p.skills)?p.skills:[]; if(!ks.length) return '';
  const ids=planMemberIds(p).filter(Boolean);
  const pc=m=>m&&m.total?m.rate:null;
  const cell=(v,x)=>v==null?'<span class="muted">—</span>':`<b class="${v>=SKILL_TARGET_UI?'up':v<SKILL_GAP_UI?'down':''}">${v}%</b>${x?` <small class="muted">${x}</small>`:''}`;
  const rows=ids.flatMap(sid=>planMemberSkill(p,sid).map(r=>{
    const b=r.before&&r.before.total?r.before:null, a=r.after;
    // الخادم القديم: «بعد» من الأنشطة وحدها، والمهمة من سجلها
    const act=r.srv?r.act:a, remP=r.srv?r.remP:null;
    const src=[act?`✏️ أنشطة ${act.correct}/${act.total}`:'',r.sup?`<span class="muted">✏️ ${r.sup} ${r.sup===1?'سؤال':r.sup===2?'سؤالان':'أسئلة'} في أنشطة قبل مهمة التحقق — حلّت محلها النتيجة الأحدث</span>`:'',remP?`🩹 أسئلة بديلة ${remP.correct}/${remP.total}`:'',r.rep?`🔁 ${r.rep===1?'سؤال أصلي معاد':r.rep===2?'سؤالان أصليان معادان':r.rep+' أسئلة أصلية معادة'} (لا تُحتسب)`:'',
      !r.srv&&r.rem!=null?`🩹 المهمة ${r.rem}%`:'',
      r.srv&&!remP&&!r.rep&&r.rem!=null?`🩹 مهمة سابقة ${r.rem}% <span class="muted">(أُرسلت قبل التحديث: بلا تفصيل لكل سؤال — لا تُحتسب)</span>`:''].filter(Boolean).join('<br>');
    const old=r.srv&&!remP&&!r.rep&&r.rem!=null;
    const res=a&&a.total>=2?(a.rate>=SKILL_TARGET_UI?'<span class="chip tick">✓ بلغ الهدف</span>':!b?`<span class="chip warn">دون الهدف (${a.rate}%) — لا قياس قبلي للمقارنة</span>`:a.rate-b.rate>=5?'<span class="chip warn">تحسّن ولم يبلغ الهدف</span>':'<span class="chip bad">لم يتحسّن بعد</span>')
      :a&&a.total===1?'<span class="chip ghost">سؤال واحد — لا يكفي للحكم</span>'
      :r.rep?'<span class="chip ghost">🔁 أسئلة معادة فقط — جهّز الأسئلة البديلة</span>'
      :old?'<span class="chip warn">أرسل مهمة تحقق</span>'
      :'<span class="chip ghost">لم يُقَس بعد</span>';
    const s=(STUDENTS||[]).find(x=>String(x.id)===String(sid));
    return `<tr>${p.group?`<td>${planEsc(s?String(s.name).split(/\s+/).slice(0,2).join(' '):'')}</td>`:''}<td class="sk-n">${planEsc(r.skill)}</td><td>${cell(pc(b),b?`${b.correct}/${b.total}`:'')}</td><td>${cell(pc(a),a?`${a.correct}/${a.total}`:'')}</td><td class="pl-src">${src||'<span class="muted">—</span>'}</td><td>${res}</td></tr>`;}));
  return `<div class="pl-cmp"><table><thead><tr>${p.group?'<th>الطالب</th>':''}<th>المهارة</th><th>قبل الخطة</th><th>بعد الخطة</th><th>مصدر القياس البعدي</th><th>النتيجة (الهدف ${SKILL_TARGET_UI}%)</th></tr></thead><tbody>${rows.join('')}</tbody></table>
    <div class="muted" style="font-size:.74rem;margin-top:.3rem;line-height:1.7">«قبل» من إجاباته قبل البدء. «بعد» من كل سؤال جديد على المهارة بعد البدء: ✏️ الأنشطة العادية و🩹 <b>الأسئلة البديلة</b> في المهمة العلاجية (صياغة وأرقام جديدة للمهارة نفسها). 🔁 السؤال الأصلي المعاد بخيارات مرتبة من جديد <b>لا يُحتسب</b>: يقيس التذكّر لا الفهم. يُحكم من سؤالين فأكثر لكل مهارة.</div></div>`;
}
function planTimelineHTML(p){
  const ev=planEvents(p), cmp=planCompareHTML(p);
  if(!ev.length&&!cmp) return '';
  const meas=ev.filter(e=>e.k==='meas').length, next=p.status==='done'?''
    :!(REM_ROWS||[]).some(x=>x.planId===p.id)?'🩹 أرسل له المهمة العلاجية (زر 🩹 أسفل البطاقة) — أول تدريب من أخطائه.'
    :(REM_ROWS||[]).some(x=>x.planId===p.id&&(x.status==='open'||x.status==='retry'))?'⏳ بانتظار حلّه للمهمة العلاجية في بوابته.'
    :!meas&&!(p.after&&p.after.measured&&p.basis==='skills')?`🩹 المهمة العلاجية السابقة لا تكفي للقياس — أرسل <b>مهمة تحقق</b>: حتى 3 أسئلة بديلة لكل مهارة، ونتيجتها تحسم الخطة. <button type="button" class="btn tick sm" onclick="planSendRemedial('${planEsc(p.id)}',true)">🩹 أرسل مهمة تحقق</button>`
    :p.timing&&p.timing.skillsLeft&&p.timing.skillsLeft.length?`🎯 لم تبلغ الهدف بعد: ${p.timing.skillsLeft.map(x=>'«'+planEsc(x.skill)+'»').join('، ')} — نشاط آخر عليها.`:'';
  return `<div class="pl-tl"><div class="pc-sub">📈 مسار الخطة — ما تغيّر بعد كل خطوة</div>
    ${cmp}
    <ol class="pl-ev">${ev.map(e=>`<li class="${e.k}"><span class="pl-d">${planTlDate(e.at)}</span><span class="pl-i">${e.ic}</span><div>${e.t}${e.d?`<small>${e.d}</small>`:''}</div></li>`).join('')}</ol>
    ${next?`<div class="pl-next"><b>الخطوة التالية:</b> ${next}</div>`:''}</div>`;
}
/* بعد الخطة لكل مهارة: الأنشطة الجديدة أولًا (الحكم الرسمي)، وإلا نتيجة المهمة العلاجية 🩹 (متوسط الأعضاء في الخطة الجماعية) */
function planRemAvg(p){const ids=planMemberIds(p).filter(Boolean),acc={};ids.forEach(id=>{const b=planRemSkillsFor(p,id);Object.entries(b).forEach(([k,v])=>{(acc[k]=acc[k]||[]).push(v)})});
  const out={};Object.entries(acc).forEach(([k,a])=>{out[k]=Math.round(a.reduce((t,v)=>t+v,0)/a.length)});return out}
function planGoalChips(p){const n=m=>m?` (${m.correct} من ${m.total})`:'',rem=planRemAvg(p);return planGoalRows(p).map(g=>{const r=g.after==null&&rem[g.skill]!=null?rem[g.skill]:null;
  const cls=g.met?'ok':g.after!=null?'no':r!=null?(r>=SKILL_TARGET_UI?'rem':'rem no'):'';
  return `<span class="pc-goal ${cls}" title="الهدف ${SKILL_TARGET_UI}% · قبل ${g.before!=null?g.before+'%'+n(g.beforeX):'لا قياس'} · بعد ${g.after!=null?g.after+'%'+n(g.afterX):'لم يُقَس بنشاط جديد بعد'}${r!=null?` · 🩹 المهمة العلاجية ${r}% — يتأكد الإتقان بنشاط جديد`:''}${g.gain!=null?` · الفرق ${planSigned(g.gain)}`:''}">${g.met?'✓ ':'🎯 '}${planDisp(g.skill)} <b>${g.before!=null?g.before+'%':'—'} ← ${g.after!=null?g.after+'%':r!=null?'🩹 '+r+'%':'…'}</b></span>`}).join('')}
/* 🗂️ البطاقة المختصرة: ما يحتاجه المعلم في نظرة (النتيجة، الثقة، التقدم، المطلوب منه)،
   والتفاصيل والأدلة في قسم قابل للطي يُحفظ فتحه بين التحديثات. */
window._planOpen=window._planOpen||new Set();
function planCard(p){
  const id=planEsc(p.id), t=p.timing||{}, done=p.status==='done';
  const arrow=p.gain==null?'':(p.gain>0?'▲':p.gain<0?'▼':'=');
  const tone=p.gain==null?'':p.gain>=5?'up':p.gain<=-5?'down':'';
  const c=p.confidence, conf=c?`<span class="chip ${PLAN_CONF_TONE[c.level]||'ghost'}" title="${planEsc(c.label)} — المدى ${planSigned(c.lo)} إلى ${planSigned(c.hi)}">${c.level==='strong'?'مؤكد':c.level==='likely'?'مرجّح':'غير مؤكد'}</span>`:'';
  const prog=p.actionsTotal?Math.round((p.actionsDone/p.actionsTotal)*100):0;
  const when=done?(p.outcome?`🏁 ${planEsc(p.outcome)}`:'منتهية'):t.due?(t.expired?'<b class="plan-need">⏰ قرارك مطلوب</b>':`📅 ${t.left===0?'تنتهي اليوم':`باقي ${t.left} ${t.left===1?'يوم':t.left<=10?'أيام':'يومًا'}`}`):'';
  const skills=Array.isArray(p.skills)&&p.skills.length?p.skills:[];
  const open=window._planOpen.has(String(p.id));
  return `<div class="card plan-card pc ${t.expired&&!done?'pc-need':''}" id="pc-${id}">
    <div class="pc-top">
      <div class="pc-who"><b>${planEsc(p.name)}</b> <span class="muted">${planEsc(p.cls)}</span>
        <div class="pc-why">${planEsc(String(p.reason||'بلا سبب محدد').split(' — ')[0])}${skills.length?'':(p.mainBy&&p.mainBy!=='academic'?'':' · <span style="color:#B26A00">⚠️ بلا مهارة محددة</span>')}</div>
        ${skills.length?`<div class="pc-goals" id="plan-goals-${id}" title="هدف كل مهارة: ${SKILL_TARGET_UI}% فأكثر">${planGoalChips(p)}</div>`:''}</div>
      <div class="pc-badges">${planBadge(p.verdict)}${conf}</div>
    </div>
    <div class="pc-mid">
      <div class="pc-score"><span class="pc-by">${planMainLabel(p)}</span><span>${planRate(p.before)}</span><i>←</i><span>${planRate(p.after)}</span>
        ${p.gain==null?'':`<b class="pc-gain ${tone}">${arrow} ${planSigned(p.gain)}</b>`}</div>
      <div class="pc-meta">
        ${p.net!=null?`<span title="${planEsc(planPeerText(p))}">👥 صافي ${planSigned(p.net)}</span>`:''}
        ${p.group?`<span>👨‍🎓 ${p.size} طلاب · تحسّن ${p.improved}</span>`:''}
        <span class="pc-prog" title="الإجراءات المنفّذة"><i style="width:${prog}%"></i></span><span class="muted">${p.actionsDone}/${p.actionsTotal} إجراء</span>
        <span>${when}</span>
      </div>
    </div>
    ${planBasisNote(p)}
    ${p.caution?`<div class="pc-warn">⚠️ ${planEsc(p.caution)}</div>`:''}
    ${t.expired&&!done?planTimingHTML(p):''}
    <details class="pc-det" ${open?'open':''} ontoggle="planToggleOpen('${id}',this.open)"><summary>التفاصيل والأدلة</summary>
      <div class="pc-body">
        ${p.reason?`<div class="muted" style="font-size:.82rem">${planEsc(p.reason)}</div>`:''}
        <div id="plan-tl-${id}">${planTimelineHTML(p)}</div>
        ${typeof planNafsHTML==='function'?planNafsHTML(p):''}
        ${planEvidenceHTML(p)}
        ${planExamRow(p)}
        ${p.group?`<div class="mem-table">${(p.members||[]).map(m=>`<div class="mem-row"><span>${planEsc(m.name)}</span><span class="muted">قبل ${m.before.measured?m.before.rate+'%':'—'} · بعد ${m.after.measured?m.after.rate+'%':'—'}${m.exam?` · 📝 ${m.exam.before.measured?m.exam.before.rate+'%':'—'} ← ${m.exam.after.measured?m.exam.after.rate+'%':'—'}`:''}</span><span class="chip ${m.verdict==='تحسّن'?'tick':m.verdict==='تراجع'?'bad':'ghost'}">${m.gain==null?planEsc(m.verdict):(m.gain>0?'+':'')+m.gain}</span></div>`).join('')}</div>`:''}
        ${planConductHTML(p)}
        <div class="pc-sub">الإجراءات</div>
        <ul class="pc-acts">${(p.actions||[]).map((a,i)=>`<li><label><input type="checkbox" ${a.done?'checked':''} onchange="togglePlanAction('${id}',${i})"> ${planDisp(a.text)}</label></li>`).join('')||'<li class="muted">بلا إجراءات</li>'}</ul>
        <div class="muted" style="font-size:.8rem">خلال الخطة: الحضور ${p.context&&p.context.attendanceRate!=null?p.context.attendanceRate+'%':'—'} (${p.context?p.context.missedDays:0} غياب) · الواجب ${p.context?p.context.hwDone:0} مسلَّم و${p.context?p.context.hwMissed:0} غير مسلَّم · ${(p.academic?p.academic.after.acts:p.after.acts)||0} نشاط بعد البدء · من ${planEsc(p.startDate||'')}</div>
        ${p.notes?`<div class="muted" style="font-size:.85rem;margin-top:.3rem">📝 ${planEsc(p.notes)}</div>`:''}
        ${t.expired&&!done?'':planTimingHTML(p)}
        <div id="plan-rem-${id}">${planRemHTML(p)}</div>
      </div></details>
    <div class="pc-btns">
      <button class="btn ghost sm pc-ic" onclick="openPlanForm('${id}')" title="تعديل الخطة" aria-label="تعديل الخطة">✏️</button>
      <button class="btn ghost sm pc-ic" onclick="printPlans('${id}')" title="طباعة الخطة" aria-label="طباعة الخطة">🖨️</button>
      <button class="btn ghost sm pc-ic" onclick="planDrillOpen('${id}')" title="ورقة تدريب مطبوعة على مهارة من الخطة (من أسئلة أنشطتك)" aria-label="ورقة تدريب">📝</button>
      <button class="btn ghost sm pc-ic" onclick="printPlanSheet('${id}')" title="ورقة الطالب: المطلوب منه مع مربعات «تمّ» — مستند تنفيذ الخطة" aria-label="ورقة الطالب">📄</button>
      <button class="btn ghost sm pc-ic" onclick="planParentMsg('${id}')" title="رسالة لولي الأمر" aria-label="رسالة لولي الأمر">✉️</button>
      ${done?`<button class="btn ghost sm pc-ic" onclick="closePlan('${id}','active')" title="إعادة فتح الخطة" aria-label="إعادة فتح الخطة">↺</button>`
        :`<button class="btn ghost sm pc-ic" onclick="planSendRemedial('${id}')" title="${p.group?'أرسل لهم مهمة علاجية':'أرسل له مهمة علاجية'}" aria-label="أرسل مهمة علاجية">🩹</button>`}
      ${done?'':`<button class="btn tick sm" style="margin-inline-start:auto" onclick="closePlan('${id}','done')">✔ إنهاء</button>`}
    </div>
  </div>`;
}
/* 🧭 قائمة العلاج هذا الأسبوع — مدخل واحد مرتّب بدل ثلاث بوابات متفرقة، والمهارة أولًا:
   1) قرارك مطلوب (انتهت مدة الخطة)  2) نقطة فحص اليوم السابع  3) إعادة شرح للفصل (ضعف ثلث الفصل فأكثر في مهارة)
   4) خطط جماعية (3 فأكثر تجمعهم مهارة)  5) خطط فردية (تأسيس <40 أولًا ثم فجوة 40–59)  6) أخفق مرتين في العلاج التلقائي
   7) متابعة انضباط (غياب/واجبات بلا ضعف مهاري) — مطويّة، ليست خطة علاجية */
const PQ_BAND={found:['تأسيس','bad'],support:['فجوة','warn'],review:['مراجعة','ghost'],mastered:['متمكن','tick']};
const PQ_RETEACH_KEY='plan_reteach_v1';
/* «✓ أعدت الشرح» تُحفظ في الخادم (plan-reteach) فتظهر على كل أجهزتك؛ والمحفوظ قديمًا في هذا الجهاز يُنقل إليه مرة واحدة */
let PQ_RETEACH=null;
function pqReteachLocal(){ try{ return JSON.parse(localStorage.getItem(PQ_RETEACH_KEY)||'{}')||{}; }catch(e){ return {}; } }
async function pqReteachPost(key,undo){ const r=await fetch(getApi().replace(/\/+$/,'')+'/plan-reteach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),key,undo:!!undo})});
  const j=await r.json(); if(!r.ok||!j||!j.ok) throw new Error('save'); PQ_RETEACH=j.map||{}; return PQ_RETEACH; }
async function pqReteachLoad(){
  try{ const j=await (await fetch(getApi().replace(/\/+$/,'')+'/plan-reteach?t='+encodeURIComponent(getTok()),{cache:'no-store'})).json();
    if(!j||!j.ok) return; PQ_RETEACH=j.map||{};
    const loc=Object.entries(pqReteachLocal()).filter(([k,t])=>Date.now()-t<14*864e5&&!(k in PQ_RETEACH));
    for(const [k] of loc) await pqReteachPost(k);
    try{ localStorage.removeItem(PQ_RETEACH_KEY); }catch(e){}
  }catch(e){}
}
function pqReteachDone(cls,skill){ const t=(PQ_RETEACH||pqReteachLocal())[cls+'|'+skill]; return !!t&&Date.now()-t<14*864e5; }
/* أيام منذ «أعدت الشرح» لهذه المهارة في الفصل (null: لم تُسجَّل) */
function pqReteachAge(cls,skill){ const t=(PQ_RETEACH||pqReteachLocal())[cls+'|'+skill]; return t?(Date.now()-t)/864e5:null; }
/* 🏫 ضعف تغطيه «إعادة شرح للفصل»: لا خطة فردية قبل إعادة الشرح وأسبوع بعدها — فإن بقي الضعف ظهر الطالب فرديًا */
function pqWaitsReteach(c){ const w=c.weak||[]; if(!w.length||w.some(x=>x.covered!=='reteach')) return false;
  return w.every(x=>{ const a=pqReteachAge(c.cls,x.skill); return a==null||a<7; }); }
function pqCheckpointDue(p){ const t=p.timing||{}; if(p.status==='done'||t.expired||t.left==null||!t.days||t.left<=0) return false;
  const r=t.round||1; return (t.days-t.left)>=7 && !(p.history||[]).some(h=>h.decision==='checkpoint'&&(h.round||1)===r); }
/* 🩺 اقتراح نقطة الفحص: من نتيجة المهمة العلاجية للخطة، ثم القياس منذ بدئها، ثم تنفيذ الإجراءات —
   ومعه زر الخطوة التالية مباشرة (أرسل مهمة · غيّر الإجراء · ذكّره) */
function pqAdvice(p){
  const R=(REM_ROWS||[]).filter(x=>x.planId===p.id), n=k=>R.filter(x=>x.status===k).length;
  const esc=n('escalated'), ok=n('mastered'), open=n('open')+n('retry');
  const id=planEsc(p.id), send=`<button class="btn ghost sm" onclick="planSendRemedial('${id}')">🩹 أرسل مهمة</button>`, edit=`<button class="btn ghost sm" onclick="openPlanForm('${id}')">✏️ غيّر الإجراء</button>`;
  const g=p.gain, meas=p.after&&p.after.measured;
  if(esc) return {k:'change',c:'bad',t:`${p.group?`${esc} من المجموعة أخفقوا`:'أخفق'} في المهمة العلاجية مرتين — الإجراء الحالي لا يكفي: جلسة فردية مع المعلم أو شرح بطريقة مختلفة`,b:edit};
  if(meas&&g!=null&&g<=0) return {k:'change',c:'bad',t:`لا تحسّن منذ بدء الخطة (${g>0?'+':''}${g}) — غيّر نوع التدخل بدل انتظار نهاية المدة`,b:edit};
  if(!R.length) return {k:'send',c:'warn',t:'لم تُرسل مهمة علاجية بعد — أرسلها الآن ليظهر أثر الخطة قبل نهايتها',b:send};
  if(open&&!ok) return {k:'remind',c:'warn',t:`المهمة العلاجية لم تُحل بعد${p.group?` (${open} ${open===1?'طالب':'طلاب'})`:''} — ذكّره بها`,b:`<button class="btn ghost sm" onclick="planParentMsg('${id}')">✉️ أبلغ ولي الأمر</button>`};
  if(!(p.actionsDone>0)&&p.actionsTotal) return {k:'act',c:'warn',t:'لم يُنفَّذ أي إجراء من الخطة — ابدأ بالإجراء الأول هذا الأسبوع',b:`<button class="btn ghost sm" onclick="pqGo('${id}')">عرض الإجراءات</button>`};
  if(ok||(meas&&g>0)) return {k:'keep',c:'tick',t:`${ok?'أتقن المهمة العلاجية':'يتحسّن'}${meas&&g!=null?` (${g>0?'+':''}${g})`:''} — استمر بالإجراءات نفسها حتى نهاية المدة`,b:''};
  return {k:'wait',c:'ghost',t:'لا قياس كافٍ بعد — استمر وتابع نتيجة المهمة',b:''};
}
/* أزرار علاج «بلا ناتج»: صنّف ما لم يُصنَّف إطلاقًا، واربط ما صُنّف بأسماء قديمة */
function pqTagBtns(c){ const need=typeof skillNeeded==='function'&&typeof HW!=='undefined'?HW.filter(skillNeeded).length:0, old=typeof skUnmappedCount==='function'?skUnmappedCount():0;
  return (need&&typeof skillTagMissing==='function'?`<button type="button" class="btn ${c} sm" onclick="event.preventDefault();skillTagMissing()">🏷️ صنّف ${need} ${need===1?'نشاط':need<=10?'أنشطة':'نشاطًا'}</button>`:'')
    +(old?`<button type="button" class="btn ${c} sm" onclick="event.preventDefault();skAliasOpen()">🎯 اربط ${old} ${old===1?'اسمًا قديمًا':'أسماء قديمة'}</button>`:''); }
/* نواتج الطالب الضعيفة مجمّعة بوحدتها: «📚 الحركة والقوى: قانون نيوتن الأول 25% · …» */
function pqSkills(list){ const by=new Map(); (list||[]).forEach(x=>{ const u=x.unit||planSkUnit(x.skill).title||''; if(!by.has(u)) by.set(u,[]); by.get(u).push(x); });
  return [...by.entries()].map(([u,L])=>`<span class="pq-unit">${u?`<small>📚 ${planEsc(u)}:</small> `:''}${L.map(x=>{ const b=PQ_BAND[x.band]||['','ghost'];
    return `<span class="chip ${b[1]}" title="${planEsc(b[0])}${x.earlier?' · من الفترة الأولى ولم يُقَس بعدها':''}${x.covered?(x.covered==='reteach'?' · مغطّاة بإعادة الشرح للفصل':' · مغطّاة بخطة جماعية مقترحة'):''}">${planDisp(x.skill)} ${x.rate}%${x.earlier?' <small>ف1</small>':''}${x.covered?' ↺':''}</span>`; }).join(' ')}</span>`).join(''); }
const PQ_OPEN_KEY='pq_open_v1';
function pqOpen(t,def){ try{ const o=JSON.parse(localStorage.getItem(PQ_OPEN_KEY)||'{}'); return t in o?!!o[t]:def; }catch(e){ return def; } }
/* مهارات الطالب في الصف: أضعف 4 ظاهرة، والباقي خلف «+N» */
function pqSkillsShort(list){ const L=list||[]; if(L.length<=4) return pqSkills(L);
  return pqSkills(L.slice(0,4))+`<details class="pq-chipmore"><summary>+${L.length-4} ${L.length-4===1?'مهارة':L.length-4<=10?'مهارات':'مهارة'} أخرى</summary>${pqSkills(L.slice(4))}</details>`; }
function renderPlanCandidates(){
  const box=document.getElementById('plan-candidates'); if(!box) return;
  const cls=document.getElementById('plan-class')?.value||'', inC=x=>!cls||String(x.cls||'')===cls;
  const P=((PLAN_DATA&&PLAN_DATA.plans)||[]).filter(p=>p.status!=='done'&&inC(p));
  const decide=P.filter(p=>p.timing&&p.timing.expired), check=P.filter(pqCheckpointDue);
  const G=((PLAN_DATA&&PLAN_DATA.planGroups)||[]).filter(inC);
  const reteach=G.filter(g=>g.kind==='skill'&&g.classWide&&!pqReteachDone(g.cls,g.title)).sort((a,b)=>b.share-a.share);
  const groups=G.filter(g=>!g.classWide).sort((a,b)=>(a.avgRate??100)-(b.avgRate??100));
  const C=((PLAN_DATA&&PLAN_DATA.planCandidates)||[]).filter(inC);
  const waitR=C.filter(c=>c.track==='skill'&&pqWaitsReteach(c));
  const indiv=C.filter(c=>c.track==='skill'&&c.individual!==false&&!pqWaitsReteach(c)), conduct=C.filter(c=>c.track==='conduct'), untag=C.filter(c=>c.track==='untagged');
  const escR=(REM_ROWS||[]).filter(x=>x.status==='escalated'&&inC(x)&&!remActivePlan(x.sid));
  const total=decide.length+check.length+reteach.length+groups.length+indiv.length+escR.length;
  if(!total&&!conduct.length&&!untag.length){ box.innerHTML=''; return; }
  // 📂 كل قسم قابل للطي ويُحفظ اختيارك؛ افتراضيًا تُفتح «قرارك مطلوب» و«نقطة الفحص» فقط
  const sec=(ic,t,n,sub,body,cls2='')=>n?`<details class="pq-sec ${cls2}" ${pqOpen(t,cls2==='need'||cls2==='chk')?'open':''} ontoggle="pqOpenSet(${planEsc(JSON.stringify(t))},this.open)"><summary class="pq-h"><b>${ic} ${t}</b><span class="chip ghost">${n}</span>${sub?`<small>${sub}</small>`:''}</summary>${body}</details>`:'';
  const more=(arr,k,f)=>arr.slice(0,window['_pqAll'+k]?999:6).map(f).join('')+(arr.length>6&&!window['_pqAll'+k]?`<button type="button" class="btn ghost sm pq-more" onclick="window._pqAll${k}=1;renderPlanCandidates()">عرض الكل (${arr.length})</button>`:'');
  const who=p=>planEsc(p.name||((p.members||[]).map(m=>m.name).join('، '))||'');
  box.innerHTML=`<div class="pq card">
    <div class="pq-top"><b>🧭 قائمة العلاج هذا الأسبوع</b><span class="muted">مرتبة بالأولوية — نواتج نافس للفصل الدراسي · آخر 6 أسئلة للطالب في الناتج (3 على الأقل) · تأسيس &lt;40% · فجوة 40–59% · الهدف 80%</span></div>
    ${sec('🔴','قرارك مطلوب',decide.length,'انتهت مدة الخطة',more(decide,'D',p=>`<div class="pq-row"><div><b>${who(p)}</b> <span class="muted">${planEsc(p.cls||'')}</span><div class="pq-d">${planEsc((p.timing&&p.timing.why)||'')}</div></div><button class="btn tick sm" onclick="pqGo('${planEsc(p.id)}')">افتح القرار</button></div>`),'need')}
    ${sec('🟠','نقطة فحص اليوم السابع',check.length,'راجع نتيجة المهمة العلاجية وعدّل الإجراء إن لزم',more(check,'K',p=>`<div class="pq-row"><div><b>${who(p)}</b> <span class="muted">${planEsc(p.cls||'')}</span>
        <div class="pq-d">بعد ${(p.timing.days-p.timing.left)} أيام من ${p.timing.days} · الآن ${p.after&&p.after.measured?p.after.rate+'%':'لم يُقَس بعد'}${(p.skills||[]).length?' · '+(p.skills||[]).map(planDisp).join('، '):''}</div>
        ${(a=>`<div class="pq-adv ${a.c}">💡 ${planEsc(a.t)}</div>`)(pqAdvice(p))}</div>
        <span class="pq-acts">${pqAdvice(p).b}<button class="btn ghost sm" onclick="pqGo('${planEsc(p.id)}')">عرض</button><button class="btn tick sm" onclick="pqCheckpoint('${planEsc(p.id)}')">✓ تم الفحص</button></span></div>`),'chk')}
    ${sec('🏫','أعد الشرح للفصل كله',reteach.length,`ضعف ثلث الفصل فأكثر في المهارة — مشكلة تدريس لا خطط فردية${waitR.length?` · ${waitR.length} ${waitR.length===1?'طالب ينتظر':'طلاب ينتظرون'} إعادة الشرح قبل أي خطة فردية (ويظهرون فرديًا بعدها بأسبوع إن بقي الضعف)`:''}`,more(reteach,'R',g=>`<div class="pq-row"><div><b>«${planDisp(g.title)}»</b> <span class="muted">${planEsc(g.cls)}${planSkUnit(g.title).title?' · 📚 '+planEsc(planSkUnit(g.title).title):''}</span>
        <div class="pq-d">${g.ofClass} من ${g.classSize} دون 60% (${g.share}%) · متوسطهم ${g.avgRate}%</div></div><button class="btn tick sm" onclick="pqReteach('${planEsc(g.cls)}','${planEsc(g.title)}')">✓ أعدت الشرح</button></div>`),'')}
    ${sec('👥','خطط جماعية',groups.length,'3 فأكثر تجمعهم الفجوة نفسها — تدخّل واحد يكفيهم',more(groups,'G',g=>`<div class="pq-row"><div><b>${planDisp(g.title||g.label)}</b> <span class="muted">${planEsc(g.cls)}${planSkUnit(g.title).title?' · 📚 '+planEsc(planSkUnit(g.title).title):''}</span> ${g.avgRate!=null?`<span class="chip ${(PQ_BAND[g.avgRate<40?'found':'support']||[])[1]}">${g.avgRate<40?'تأسيس':'فجوة'} · متوسط ${g.avgRate}%</span>`:''}
        <div class="pq-d">${g.members.map(m=>planEsc(m.name)).join(' · ')}</div>${g.untagged?`<div class="pq-adv warn">🏷️ أسئلة هذا النشاط بلا نواتج نافس — صنّفها (أو اربط أسماءها القديمة) لتعرف المهارة الناقصة بدل خطة على النشاط كله</div>`:''}</div>
        <span class="pq-acts">${g.untagged?pqTagBtns('ghost'):''}<button class="btn tick sm" onclick="planFromGroup('${planEsc(g.key)}')">＋ خطة جماعية</button></span></div>`))}
    ${sec('👤','خطط فردية',indiv.length,'تأسيس أولًا، ثم من عنده مهارات أكثر',more(indiv,'I',c=>`<div class="pq-row"><div><b>${planEsc(c.name)}</b> <span class="muted">${planEsc(c.cls)}</span> ${c.tier===1?'<span class="chip bad">تأسيس</span>':c.tier===2?'<span class="chip warn">فجوة</span>':''}
        <div class="pq-d">${(c.weak||[]).length?pqSkillsShort(c.weak):planEsc((c.reasons[0]||{}).text||'')}${(c.conduct||[]).length?` <span class="muted">· ${c.conduct.map(r=>planEsc(r.text)).join(' · ')}</span>`:''}
          ${(c.early||[]).length?`<div class="pq-prior pq-early">🔎 قياس أولي (سؤالان فقط — لا تُبنى عليه خطة بعد): ${c.early.map(x=>`${planDisp(x.skill)} ${x.rate}%`).join(' · ')}</div>`:''}
          ${(c.prior||[]).length?(()=>{ const cur=planSP().sem, by={}; c.prior.forEach(x=>{ const k=x.term&&x.term<cur?`↩︎ فجوة سابقة (الفصل ${x.term===1?'الأول':'الثاني'})`:`ℹ️ من نواتج الفصل ${x.term===2?'الثاني':'الأول'} — خارج الفصل الحالي`; (by[k]=by[k]||[]).push(`${planDisp(x.skill)} ${x.rate}%`); });
            return Object.entries(by).map(([k,L])=>`<div class="pq-prior">${k}: ${L.join(' · ')}</div>`).join(''); })():''}</div></div>
        <button class="btn tick sm" onclick="planFromCandidate('${planEsc(c.studentId)}',${JSON.stringify(c.reasons.map(r=>r.text).join(' · ')).replace(/"/g,'&quot;')})">＋ خطة</button></div>`))}
    ${sec('🤖','أخفق مرتين في العلاج التلقائي',escR.length,'يحتاج تدخّلك المباشر',more(escR,'E',x=>`<div class="pq-row"><div><b>${planEsc(x.name)}</b> <span class="muted">${planEsc(x.cls||'')}</span><div class="pq-d">«${planEsc(x.srcTitle||x.reason||'')}»</div></div>${remPlanBtn(x)}</div>`))}
    ${untag.length?`<details class="pq-sec pq-conduct" ${pqOpen('untag',false)?'open':''} ontoggle="pqOpenSet('untag',this.open)"><summary><b>🏷️ ضعف بلا ناتج محدد</b> <span class="chip ghost">${untag.length}</span> <small>إتقانهم دون 60% لكن أسئلة أنشطتهم بلا نواتج نافس — صنّفها أو اربط أسماءها القديمة، فتتحول إلى خطة على المهارة الناقصة نفسها</small>
        ${pqTagBtns('tick')}</summary>
      ${untag.map(c=>`<div class="pq-row"><div><b>${planEsc(c.name)}</b> <span class="muted">${planEsc(c.cls)}</span><div class="pq-d">${c.reasons.map(r=>planEsc(r.text)).join(' · ')}</div></div></div>`).join('')}</details>`:''}
    ${conduct.length?`<details class="pq-sec pq-conduct" ${pqOpen('conduct',false)?'open':''} ontoggle="pqOpenSet('conduct',this.open)"><summary><b>📋 متابعة انضباط</b> <span class="chip ghost">${conduct.length}</span> <small>غياب أو واجبات بلا ضعف مهاري — تواصل وتذكير، لا خطة علاجية</small></summary>
      ${conduct.map(c=>`<div class="pq-row"><div><b>${planEsc(c.name)}</b> <span class="muted">${planEsc(c.cls)}</span><div class="pq-d">${c.conduct.map(r=>planEsc(r.text)).join(' · ')}</div></div>
        <button class="btn ghost sm" onclick="planFromCandidate('${planEsc(c.studentId)}',${JSON.stringify(c.reasons.map(r=>r.text).join(' · ')).replace(/"/g,'&quot;')})">＋ متابعة</button></div>`).join('')}</details>`:''}
  </div>`;
}
let PLAN_SUM_F='';
const PLAN_SUM_TEST={
  need:p=>p.status!=='done'&&p.timing&&p.timing.expired,
  soon:p=>p.status!=='done'&&p.timing&&!p.timing.expired&&p.timing.left!=null&&p.timing.left<=7,
  soon3:p=>p.status!=='done'&&p.timing&&!p.timing.expired&&p.timing.left!=null&&p.timing.left<=3,
  improved:p=>p.verdict==='تحسّن',
  declined:p=>p.verdict==='تراجع',
  flat:p=>p.verdict==='بلا فرق يُعتد به',
  pending:p=>p.gain==null
};
function planFiltered(){
  const cls=document.getElementById('plan-class')?.value||'';
  const st=document.getElementById('plan-status')?.value;
  return (PLAN_DATA&&PLAN_DATA.plans||[]).filter(p=>(!cls||p.cls===cls)&&(st===''||st==null||(p.status||'active')===st));
}
function bindPlanFilters(){
  const c=document.getElementById('plan-class'), st=document.getElementById('plan-status');
  if(c&&!c._b){c._b=1;c.addEventListener('change',()=>renderPlans(false))}
  if(st&&!st._b){st._b=1;st.addEventListener('change',()=>renderPlans(false))}
}
/* شدة الخطة: أدنى نسبة قبل الخطة في مهاراتها (لكل الأعضاء)، وإلا نسبتها العامة — خطط الانضباط آخرًا */
function planSeverity(p){
  const r=[]; (p.members||[]).forEach(m=>((m.skill&&m.skill.items)||[]).forEach(it=>{ if(it.before&&it.before.rate!=null&&(it.before.total||0)>=2) r.push(it.before.rate); }));
  if(r.length) return Math.min(...r);
  return p.mainBy&&p.mainBy!=='academic'?200:(p.before&&p.before.measured&&p.before.rate!=null?p.before.rate:150);
}
async function renderPlans(force=false){
  try{renderAutoRem()}catch(e){}
  bindPlanFilters();
  const state=document.getElementById('plan-state'), list=document.getElementById('plan-list');
  if(!state||!list) return;
  state.textContent='جاري تحميل الخطط…';
  // الخطط جارية دائمًا: تُقرأ من الفترة الحالية (لا لقطة الفترة الأولى المغلقة)
  const AS=planSP();
  try{ PLAN_DATA=await loadServerGrades(force||!COMP_GRADES_RAW||COMP_GRADES_SEMESTER!==AS.sem||COMP_GRADES_PERIOD!==AS.per,AS.sem,AS.per); }
  catch(e){ state.textContent='تعذّر الاتصال بالخادم — لا يمكن عرض القياس القبلي والبعدي.'; list.innerHTML=''; const _pg=document.getElementById('plan-groups'), _pc=document.getElementById('plan-candidates'); if(_pg)_pg.innerHTML=''; if(_pc)_pc.innerHTML=''; return }
  if(force||!PQ_RETEACH) await pqReteachLoad();
  const sel=document.getElementById('plan-class');
  if(sel){
    const _cur=sel.value;
    const cs=[...new Set((STUDENTS||[]).map(s=>String(s.cls||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    sel.innerHTML='<option value="">كل الفصول</option>'+cs.map(c=>`<option value="${planEsc(c)}">${planEsc(c)}</option>`).join('');
    if(_cur&&cs.includes(_cur)) sel.value=_cur;
  }
  // الترتيب: قرارك مطلوب أولًا، ثم الجارية بشدة ضعف المهارة (أدنى نسبة قبل الخطة)، ثم الأقرب انتهاءً، والمنتهية آخرًا
  const rank=p=>p.status==='done'?2:(p.timing&&p.timing.expired)?0:1;
  const rows=planFiltered().slice().sort((x,y)=>rank(x)-rank(y)||planSeverity(x)-planSeverity(y)||((x.timing&&x.timing.left)??999)-((y.timing&&y.timing.left)??999));
  const improved=rows.filter(p=>p.verdict==='تحسّن').length;
  const sure=rows.filter(p=>p.verdict==='تحسّن'&&p.confidence&&p.confidence.level!=='weak').length;
  const need=rows.filter(p=>p.status!=='done'&&p.timing&&p.timing.expired).length;
  const soon=rows.filter(p=>p.status!=='done'&&p.timing&&!p.timing.expired&&p.timing.left!=null&&p.timing.left<=7).length;
  const pending=rows.filter(p=>p.gain==null).length;
  const declined=rows.filter(PLAN_SUM_TEST.declined).length, flat=rows.filter(PLAN_SUM_TEST.flat).length;
  // 🔎 الأرقام أزرار فرز: الضغط يعرض تلك الخطط فقط، والضغط ثانية (أو على «خطة») يعيد الكل
  const F=PLAN_SUM_F, chip=(k,n,label,extra='')=>`<button type="button" class="${k==='need'?'need ':k==='declined'?'down ':''}${F===k?'on':''}" ${n||k===''?'':'disabled'} aria-pressed="${F===k}" onclick="planSumFilter('${k}')"><b>${n}</b>${label}${extra}</button>`;
  state.innerHTML=`<div class="plan-sum">${chip('',rows.length,'خطة')}${need||F==='need'?chip('need',need,'تحتاج قرارك'):''}${soon||F==='soon'?chip('soon',soon,'تنتهي خلال أسبوع'):''}${F==='soon3'?chip('soon3',rows.filter(PLAN_SUM_TEST.soon3).length,'تنتهي خلال 3 أيام'):''}${chip('improved',improved,'تحسّن',sure!==improved?` (${sure} مؤكد)`:'')}${declined||F==='declined'?chip('declined',declined,'تراجع'):''}${flat||F==='flat'?chip('flat',flat,'بلا فرق'):''}${pending||F==='pending'?chip('pending',pending,'لم تُقَس بعد'):''}</div>`;
  renderPlanGroups();
  renderPlanCandidates();
  try{ pqLegacyNudge(); }catch(e){}
  const shown=F?rows.filter(PLAN_SUM_TEST[F]||(()=>true)):rows;
  list.innerHTML=(F&&!shown.length?'<div class="muted" style="padding:1.2rem;text-align:center">لا خطط في هذا الفرز.</div>':'')+(shown.map(planCard).join('')||(F?'':'<div class="muted" style="padding:1.5rem;text-align:center">لا توجد خطط. ابدأ بـ«خطة جديدة» أو من قائمة المرشحين.</div>'));
}
/* 🩹 نتيجة الطالب في المهام العلاجية لهذه الخطة لكل مهارة (آخر محاولة محلولة) */
function planRemSkillsFor(p,sid){
  const by={};
  (REM_ROWS||[]).filter(x=>x.planId===p.id&&String(x.sid)===String(sid)).forEach(x=>{
    const done=(x.attempts||[]).filter(a=>a&&a.rate!=null).sort((a,b)=>(b.doneAt||0)-(a.doneAt||0))[0]; if(!done) return;
    if(done.skills) Object.entries(done.skills).forEach(([k,v])=>{ if(v&&v.t) by[k]=Math.round(v.c/v.t*100); });
    else (p.skills||[]).forEach(k=>{ if(by[k]==null&&String(x.srcTitle||'').includes(k)) by[k]=done.rate; });
  });
  return by;
}
/* سطر تفسير درجة الواجب في الكشف الشامل: الجزآن وأسباب الخصم (الحساب نفسه من الخادم) */
function compHwNote(h){
  if(!h || (!h.measured && !(h.madrasati&&h.madrasati.measured))) return 'لم يُرصد بعد';
  const cp=h.classPart, md=h.madrasati;
  if(!cp || !md) return `سُلّم ${h.done||0} · لم يُسلَّم ${h.missed||0}${h.inGrace?` · ${h.inGrace} بفترة سماح`:''}`;
  const f=v=>Number(v).toFixed(1).replace(/\.0$/,'');
  const cls=`الفصل ${f(cp.score)}/5: ${cp.measured?`لم يُسلَّم ${h.missed||0}${h.inGrace?` · ${h.inGrace} سماح`:''}`:'لم يُرصد'}`;
  const mad=`مدرستي ${f(md.score)}/5: ${!md.linked?'غير مربوط':md.measured?`لم يحل ${md.missed||0}${md.inGrace?` · ${md.inGrace} مفتوح`:''}`:'لا واجبات'}`;
  return `${cls}<br>${mad}`;
}
/* 📱 الكشف الشامل في الجوال: جدول مضغوط بالأرقام فقط والاسم ثابت، والتفاصيل عند لمس الطالب.
   الكشف الرسمي (للطباعة والكمبيوتر) يبقى كما هو، ويُعرض في الجوال بزر «الكشف الرسمي». */
let COMP_MOB=[], COMP_MOB_NEED=false;
const COMP_MOB_LV={'ممتاز':'g1','جيد جدًا':'g2','جيد':'g3','يحتاج متابعة':'g4','يحتاج دعم':'g5'};
function compMobHTML(rows,classes,cls,avg){
  COMP_MOB=rows;
  const f=v=>v==null?'<span class="cm-mut">—</span>':String(Math.round(v*10)/10);
  const show=rows.map((r,i)=>[r,i]).filter(([r])=>!COMP_MOB_NEED||r.miss||/يحتاج/.test(r.level));
  const chip=(l,on,go)=>`<button type="button" class="${on?'on':''}" onclick="${go}">${l}</button>`;
  const setCls=c=>`document.getElementById('comp-class').value='${esc(c)}';renderComprehensive()`;
  return `<div class="comp-mob no-print${document.getElementById('comp-table')?.classList.contains('cm-official')?' cm-hide':''}">
    <div class="cm-chips">${chip('الكل',!cls,setCls(''))}${classes.map(c=>chip(esc(c),cls===c,setCls(c))).join('')}${chip('⚠️ يحتاج دعم/متابعة',COMP_MOB_NEED,'COMP_MOB_NEED=!COMP_MOB_NEED;renderComprehensive()')}</div>
    <div class="cm-tw"><table class="cm-t"><thead><tr><th class="cm-nm">الطالب</th><th>مشاركة<small>10</small></th><th>واجب<small>10</small></th><th>سلوك<small>10</small></th><th>أنشطة<small>10</small></th><th>اختبار<small>20</small></th><th>مجموع<small>60</small></th></tr></thead>
    <tbody>${show.length?show.map(([r,i])=>r.miss
      ?`<tr><td class="cm-nm"><b>${esc(r.name)}</b><small>${esc(r.cls)}</small></td><td colspan="6" class="cm-miss">لم تصل بياناته — «🔄 تحديث»</td></tr>`
      :`<tr onclick="compMobOpen(${i})"><td class="cm-nm"><b>${esc(r.name)}</b><small>${esc(r.cls)}</small></td><td>${f(r.p)}</td><td>${f(r.h)}</td><td>${f(r.b)}</td><td>${f(r.a)}</td><td>${f(r.ex)}</td>
        <td class="cm-tot ${COMP_MOB_LV[r.level]||''}">${f(r.total)}${r.unrec.length?'<i class="cm-dot" title="مجموع مؤقت"></i>':''}</td></tr>`).join('')
      :'<tr><td colspan="7" class="cm-miss">لا يوجد طلاب يحتاجون دعمًا أو متابعة 🌿</td></tr>'}</tbody>
    <tfoot><tr><td class="cm-nm">متوسط</td><td>${avg.p}</td><td>${avg.h}</td><td>${avg.b}</td><td>${avg.a}</td><td>${avg.ex}</td><td>${avg.t}</td></tr></tfoot></table></div>
    <div class="cm-leg"><span><i class="cm-dot"></i> مجموع مؤقت — بعض الدرجات لم تُرصد</span><span>المس الطالب للتفاصيل</span></div>
    <div class="cm-lv">${Object.entries(COMP_MOB_LV).map(([l,c])=>`<span class="${c}">${l}</span>`).join('')}</div>
  </div>
  <div class="cm-offbar no-print"><button type="button" class="btn ghost sm" onclick="compMobOfficial()">${document.getElementById('comp-table')?.classList.contains('cm-official')?'📱 العرض المختصر':'🖨️ الكشف الرسمي'}</button></div>`;
}
async function renderComprehensive(force=false){
  try{ vspSyncSelects(); }catch(e){}
  const state=document.getElementById('comp-state');
  const table=document.getElementById('comp-table');
  if(!state||!table) return;

  const arr=Array.isArray(STUDENTS)?STUDENTS:[];
  const searchRaw=String(document.getElementById('comp-search')?.value||'').trim();
  const search=(typeof normAr==='function'?normAr(searchRaw):searchRaw).toLowerCase();
  const classValue=String(document.getElementById('comp-class')?.value||'');
  const semester=Number(document.getElementById('comp-semester')?.value||1)===2?2:1;
   const period=Number(document.getElementById('comp-period')?.value||1)===2?2:1;
  await loadDashboardAcademic();
  renderDashboardAcademicControl();
  const classes=[...new Set(arr.map(s=>String(s.cls||s.className||s.class||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  const cs=document.getElementById('comp-class');
  if(cs){
    const cur=classValue;
    cs.innerHTML='<option value="">كل الفصول</option>'+classes.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    if(classes.includes(cur)) cs.value=cur;
  }
  const cls=String(cs?.value||'');

  const draw=(cd,G)=>{
    const data=cd||{};
    const arrNow=Array.isArray(STUDENTS)?STUDENTS:[];
    G=G||{map:{},rules:{max:10}};
    const participation=data.participation||{};
    const homework=data.homework||{};
    const behavior=(Array.isArray(data.behavior)?data.behavior:[]).filter(x=>x&&!x.deleted);
    const rows=arrNow.filter(s=>{
      const name=String(s.name||s.n||'');
      const nm=typeof normAr==='function'?normAr(name):name.toLowerCase();
      const sc=String(s.cls||s.className||s.class||'');
      return (!search||stuMatch(searchRaw,name)) && (!cls||sc===cls);
    }).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ar'));

    let sums={p:0,h:0,b:0,a:0,exam:0,total:0};
    let assignedTotal=0,submittedTotal=0;
    let counted=0; const missingSync=[], mob=[];   // mob: صفوف عرض الجوال المضغوط (الأرقام نفسها)
    const html=rows.map((s,i)=>{
      const sid=String(s.id||'');
      const g=(G.map&&G.map[sid])||null;
      const p=g?g.participation:{score:null,measured:false,yes:0,no:0};
      const h=g?g.homework:{score:null,measured:false,done:0,missed:0,inGrace:0};
      const b=g?g.behavior:{score:null,measured:false,neg:0,pos:0};
      const exam=g?g.exam:{score:null,measured:false,max:20};
      const examScore=exam.score==null?0:Number(exam.score)||0;
      const bScore=b.score==null?0:b.score, bNeg=b.neg||0, bPos=b.pos||0;
      const acts=compActivitiesForStudent(s,G.term);
      const submitted=compSubmissionCount(acts,s,G.term);
      // لا أنشطة مطلوبة = لا بيانات، لا رسوب. (كان يعطي 0.0/10 صامتًا)
      const aScore=acts.length?Math.round(submitted/acts.length*100)/10:(G.rules&&G.rules.max)||10;
      // 🛡️ طالب لم يصل من الخادم (أُضيف ولم تُزامَن بياناته بعد): لا يُطبع بأصفار.
      // الأصفار على ورقة رسمية تعني «رسب»، والحقيقة أنها «لم تصل بياناته».
      if(!g){
        missingSync.push(String(s.name||''));
        mob.push({name:String(s.name||''),cls:String(s.cls||s.className||s.class||''),miss:true});
        return `<tr class="comp-unsynced">
          <td class="cnum">${i+1}</td>
          <td class="cnm"><b>${esc(s.name||'')}</b><small>${esc(String(s.cls||s.className||s.class||''))}</small></td>
          <td class="score" colspan="6" style="text-align:center;color:#B4740E">
            لم تصل بيانات هذا الطالب من الخادم — اضغط «تحديث» بعد مزامنة الدفتر</td>
          <td class="clevel">—</td></tr>`;
      }
      const pScore=p.score==null?0:p.score, hScore=h.score==null?0:h.score;
      const unrec=[]; if(!p.measured)unrec.push('المشاركة'); if(!h.measured)unrec.push('الواجب'); /* السلوك يبدأ كاملًا (10) ولا ينقص إلا بملاحظة سلبية: بلا ملاحظات = 10 مستحقة، لا «لم يُرصد» */ if(!exam.measured)unrec.push('الاختبار');
      const workTotal=Math.round((pScore+hScore+bScore+aScore)*10)/10;
      const total=Math.round((workTotal+examScore)*10)/10;
      const level=compAnnualLevel(total);
      counted++;
      sums.p+=pScore; sums.h+=hScore; sums.b+=bScore; sums.a+=aScore; sums.exam+=examScore; sums.total+=total;
      assignedTotal+=acts.length; submittedTotal+=submitted;
      mob.push({name:String(s.name||''),cls:String(s.cls||s.className||s.class||''),p:pScore,h:hScore,b:bScore,a:aScore,ex:exam.measured?examScore:null,total,level,unrec,
        np:p.measured?`شارك ${p.yes} · لم يشارك ${p.no}`:'لم يُرصد بعد', nh:compHwNote(h), nb:`${bNeg?`${bNeg} ملاحظة سلبية`:'بلا ملاحظات سلبية'}${bPos?` · ${bPos} إيجابي`:''}`,
        na:acts.length?`${submitted} من ${acts.length} نشاطًا مسلّمًا`:'لا أنشطة مطلوبة — تُحتسب كاملة'});
      return `<tr>
        <td class="cnum">${i+1}</td>
        <td class="cnm"><b>${esc(s.name||'')}</b><small>${esc(String(s.cls||s.className||s.class||''))}</small></td>
        <td class="score"><b>${pScore.toFixed(1)}</b><small>/10</small><em>${p.measured?`شارك ${p.yes} · لم يشارك ${p.no}`:'لم يُرصد بعد'}</em></td>
        <td class="score"><b>${hScore.toFixed(1)}</b><small>/10</small><em>${compHwNote(h)}</em></td>
        <td class="score"><b>${bScore.toFixed(1)}</b><small>/10</small><em>${bNeg?`${bNeg} ملاحظة سلبية`:'بلا ملاحظات سلبية'}${bPos?` · ${bPos} إيجابي`:''}</em></td>
        <td class="score"><b>${aScore.toFixed(1)}</b><small>/10</small><em>${acts.length?`${submitted} من ${acts.length} نشاطًا مسلّمًا`:'لا أنشطة مطلوبة — تُحتسب كاملة (10/10)'}</em></td>
        <td class="score cexam"><b>${examScore.toFixed(1)}</b><small>/20</small><em>${exam.measured?'مرصود':'لم يُرصد بعد'}</em></td>
        <td class="score cgrand"><b>${total.toFixed(1)}</b><small>/60</small><em>${unrec.length?`⚠️ مجموع مؤقت — لم يُرصد: ${unrec.join('، ')}`:'40 أعمال سنة + 20 اختبار'}</em></td>
        <td class="clevel">${esc(level)}</td>
      </tr>`;
    }).join('');

    const n=rows.length;
    // المتوسط على الطلاب المحسوبين فقط — لا يجرّه صفٌّ لم تصل بياناته
    const avg=v=>counted?(v/counted).toFixed(1):'0.0';
    state.textContent=n
      ?`عدد الطلاب: ${n} · الأنشطة/المهام المسلّمة: ${submittedTotal} من ${assignedTotal}`
        +(missingSync.length?` · ⚠️ ${missingSync.length} طالب لم تصل بياناتهم من الخادم`:'')
      :'لا يوجد طلاب مطابقون للبحث';
    table.innerHTML=n?`<div class="comp-report rep"><div class="rep-page">
      ${repHead('','الكشف الشامل لأعمال السنة',semester)}
      <div class="rep-in">
        <div class="rep-info">
          <div>المادة<b>${esc(rcGet('subject')||'العلوم')}</b></div>
          <div>الفصل<b>${esc(cls||'كل الفصول')}</b></div>
          <div>الفصل الدراسي<b>${semester===2?'الفصل الدراسي الثاني':'الفصل الدراسي الأول'}</b></div>
          <div>الفترة<b>${period===2?'الفترة الثانية':'الفترة الأولى'}</b></div>
          <div>عدد الطلاب المحسوبين<b>${counted}</b></div>
          ${missingSync.length?`<div>لم تصل بياناتهم<b>${missingSync.length}</b></div>`:''}
          <div>تاريخ الكشف<b>${compToday().replace(/-/g,'/')}</b></div>
        </div>
        <div class="rep-sec">الكشف النهائي للطلاب</div>
        <div class="rep-box" style="padding:.45rem">
          <table class="rt comprehensive-table">
            <thead><tr>
              <th class="cnum">م</th><th>اسم الطالب</th><th>المشاركة<br><small>10 درجات</small></th><th>الواجب<br><small>10 درجات</small></th><th>السلوك<br><small>10 درجات</small></th><th>الأنشطة والمهام<br><small>10 درجات</small></th><th>الاختبار<br><small>20 درجة</small></th><th>المجموع<br><small>60 درجة</small></th><th>التقدير</th>
            </tr></thead>
            <tbody>${html}</tbody>
            <tfoot><tr><td colspan="2">متوسط الفصل</td><td>${avg(sums.p)}</td><td>${avg(sums.h)}</td><td>${avg(sums.b)}</td><td>${avg(sums.a)}</td><td>${avg(sums.exam)}</td><td>${avg(sums.total)}</td><td>—</td></tr></tfoot>
          </table>
        </div>
        ${repFoot()}
      </div>
    </div></div>${compMobHTML(mob,classes,cls,{p:avg(sums.p),h:avg(sums.h),b:avg(sums.b),a:avg(sums.a),ex:avg(sums.exam),t:avg(sums.total)})}`:'<div class="empty" style="padding:2rem;text-align:center">لا توجد بيانات للعرض.</div>';
  };

  state.textContent = arr.length ? (cls?`جاري تجهيز كشف ${cls}…`:'جاري تجهيز الكشف…') : 'لا يوجد طلاب في الكشف.';
  const data=await loadComprehensiveClassroom(force);
  let G=null;
  try{ G=await loadServerGrades(force||!COMP_GRADES||COMP_GRADES_PERIOD!==period||COMP_GRADES_SEMESTER!==semester, semester, period); }
  catch(e){
    state.textContent='تعذّر جلب الدرجات من الخادم — لا يمكن عرض الكشف بأرقام غير موثوقة. تحقّق من الاتصال ثم اضغط «تحديث».';
    table.innerHTML='<div class="empty" style="padding:2rem;text-align:center">لم تصل الدرجات من الخادم.<br><small>الكشف لا يحسب الدرجات محليًا حتى لا يخالف ما يحسبه الخادم.</small></div>';
    return;
  }
  draw(data,G);
}

/* ═══════════ 🗓️ الكشف الأسبوعي ═══════════
   يقرأ ما رصدته في بوابة المعلم (المشاركة/الواجب/السلوك) ويعرض أسبوعًا
   واحدًا كما هو: أرقام خام لا درجات. الكشف الشامل يحوّلها إلى تقدير من ٤٠،
   وهذا يريك ماذا حدث هذا الأسبوع بالضبط. الأسبوع يبدأ الأحد.
   ══════════════════════════════════════════ */
let WK_OFFSET = 0;

function wkStartSunday(offset){
  const d = new Date();
  d.setHours(12,0,0,0);                       // ظهرًا: يقي من فروق التوقيت الصيفي
  d.setDate(d.getDate() - d.getDay() + (offset*7));
  return d;
}
function wkISO(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function wkDates(offset){
  const st = wkStartSunday(offset), out = [];
  for(let i=0;i<7;i++){ const d=new Date(st); d.setDate(st.getDate()+i); out.push(wkISO(d)); }
  return out;
}
function weekShift(dir){
  WK_OFFSET = dir===0 ? 0 : WK_OFFSET + dir;
  if(WK_OFFSET > 0) WK_OFFSET = 0;            // لا كشف لأسبوع لم يأتِ بعد
  renderWeekly();
}

/* 🗓️ التقرير الأسبوعي التلقائي: التشغيل/الإيقاف وحالة آخر إرسال (الإرسال نفسه في الخادم) */
async function wkAutoLoad(){
  const box=document.getElementById('wkauto'); if(!box) return;
  const api=getApi(), tok=getTok(); if(!api||!tok){ box.style.display='none'; return; }
  try{
    const r=await fetch(api.replace(/\/+$/,'')+'/weekly-auto?t='+encodeURIComponent(tok)); const j=await r.json();
    if(!j.ok) throw 0;
    box.style.display=''; document.getElementById('wkauto-on').checked=!!j.on; wkAutoLast(j);
  }catch(e){ box.style.display='none'; }
}
function wkAutoLast(j){
  const el=document.getElementById('wkauto-last'); if(!el) return;
  const L=j.last;
  if(!j.on && !L){ el.textContent=''; return; }
  if(!L){ el.textContent='لم يُرسل تلقائيًا بعد — أول إرسال صباح الأحد القادم.'; return; }
  const sk=(L.skippedClasses||[]).length?` · لم يُرسل لـ ${L.skippedClasses.join('، ')} (لا رصد ذلك الأسبوع)`:'';
  el.textContent=`آخر إرسال تلقائي: أسبوع ${wrArabicDate(L.from)} — ${wrArabicDate(L.to)} · وصل ${L.sent} ${L.sent===1?'طالبًا':'طالب'}${sk}`;
}

async function renderWeekly(force=false){
  try{ wkAutoLoad(); }catch(e){}
  const state = document.getElementById('wk-state');
  const table = document.getElementById('wk-table');
  if(!state || !table) return;

  const arr = Array.isArray(STUDENTS) ? STUDENTS : [];
  const classes = [...new Set(arr.map(s=>String(s.cls||s.className||s.class||'').trim()).filter(Boolean))]
                    .sort((a,b)=>a.localeCompare(b,'ar'));
  const cs = document.getElementById('wk-class');
  if(cs){
    const cur = String(cs.value||'');
    cs.innerHTML = '<option value="">كل الفصول</option>' + classes.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    if(classes.includes(cur)) cs.value = cur;
  }
  const cls = String(cs?.value||'');
  const search = String(document.getElementById('wk-search')?.value||'').trim();
  const searchNorm = typeof normAr==='function' ? normAr(search) : search.toLowerCase();

  state.textContent = 'جارٍ تجهيز الكشف…';
  const data = await loadComprehensiveClassroom(force) || {};
  const arrNow = Array.isArray(STUDENTS) ? STUDENTS : [];
  const P = data.participation || {}, H = data.homework || {}, B = (Array.isArray(data.behavior)?data.behavior:[]).filter(x=>x&&!x.deleted);
  if(window._crcErr && !Object.keys(P).length && !Object.keys(H).length && !B.length){
    state.textContent='تعذّر جلب بيانات الرصد من الخادم — تحقق من الاتصال ثم اضغط «تحديث».';
    table.innerHTML='<div class="empty" style="padding:2rem;text-align:center">لم تصل بيانات الرصد من الخادم.<br><small>الكشف لا يعرض أصفارًا بدل بيانات لم تصل.</small></div>';
    return;
  }

  const dates = wkDates(WK_OFFSET);
  const dset  = new Set(dates);
  const rows  = arrNow.filter(s=>{
    const sameClass = !cls || String(s.cls||s.className||s.class||'').trim()===cls;
    if(!sameClass) return false;
    if(!searchNorm) return true;
    const nm=String(s.name||'');
    const nn=typeof normAr==='function' ? normAr(nm) : nm.toLowerCase();
    return stuMatch(search, nm);
  });

  // سلوك الأسبوع مفهرسًا بالطالب
  const behBy = new Map();
  const wkLegend = new Map();          // أيقونة → اسمها الكامل، لهذا الأسبوع وحده
  for(const b of B){
    if(!b || !dset.has(String(b.date||''))) continue;
    const k = String(b.studentId||'');
    if(!behBy.has(k)) behBy.set(k,{pos:0,neg:0,icons:[],labels:[]});
    const o = behBy.get(k);
    if(b.type==='positive') o.pos++; else o.neg++;
    // 🎭 الأيقونة وحدها في الجدول (لتقصر الصفوف) والاسم الكامل في المفتاح
    // أسفله — القوالب الجاهزة كلها تبدأ بأيقونة، والمخصّص قد لا يبدأ بها.
    const label = String(b.category||b.note||'').trim();
    const head = label.split(/\s+/)[0] || '';
    const ic = (head && !/[\u0600-\u06FF]/.test(head)) ? head : (b.type==='positive'?'🟢':'🔴');
    o.icons.push(ic); o.labels.push([String(b.date||''),label||(b.type==='positive'?'ملاحظة إيجابية':'ملاحظة سلبية'),b.type==='positive']);
    wkLegend.set(label || (b.type==='positive'?'ملاحظة إيجابية':'ملاحظة سلبية'), ic);
  }

  // الأيام التي رُصد فيها شيء فعلًا — لا نعاقب أيام العطلة أو الأيام بلا حصة
  // (خ11: يومٌ بملاحظة سلوك فقط يومٌ مرصود أيضًا؛ والشرط يوميّ بدقّة — النسخة الحرفية من التقرير
  //  B.some(b=>dset.has(...)) بلا ربط باليوم d كانت ستعدّ كل أيام الأسبوع مرصودةً عند أي ملاحظة)
  const active = dates.filter(d => (P[d] && Object.keys(P[d]).length) || (H[d] && Object.keys(H[d]).length) || B.some(b => String(b.date||'')===d));

  let sumShared=0, sumMissed=0, sumAbsent=0, sumDone=0, sumUndone=0, sumExcused=0, sumPos=0, sumNeg=0;
  const built = rows.map(s=>{
    const id = String(s.id||'');
    let shared=0, missed=0, absent=0, done=0, undone=0, excused=0;
    for(const d of dates){
      const pv = (P[d]||{})[id]?.status || '';
      if(pv==='شارك') shared++; else if(pv==='لم يشارك') missed++; else if(pv==='غائب') absent++; else if(pv==='غائب بعذر') absent++;
      const hv = (H[d]||{})[id]?.status || '';
      if(hv==='أنجز') done++; else if(hv==='لم ينجز') undone++; else if(hv==='معذور') excused++;
    }
    const bh = behBy.get(id) || {pos:0,neg:0,icons:[]};
    sumShared+=shared; sumMissed+=missed; sumAbsent+=absent;
    sumDone+=done; sumUndone+=undone; sumExcused+=excused;
    sumPos+=bh.pos; sumNeg+=bh.neg;
    // 🚩 قاعدة الانتباه — معلنة صراحةً أسفل الكشف حتى لا تكون حكمًا خفيًا
    const flag = (missed>=2) || (undone>=2) || (bh.neg>=1);
    const nothing = !shared && !missed && !absent && !done && !undone && !excused && !bh.pos && !bh.neg;
    return {s, shared, missed, absent, done, undone, excused, bh, flag, nothing};
  }).sort((a,b)=> (b.flag-a.flag) || String(a.s.name||'').localeCompare(String(b.s.name||''),'ar'));

  const flagged = built.filter(x=>x.flag).length;
  const unseen  = built.filter(x=>x.nothing).length;
  const pRate = (sumShared+sumMissed) ? Math.round(sumShared*100/(sumShared+sumMissed)) : null;
  const hRate = (sumDone+sumUndone)   ? Math.round(sumDone*100/(sumDone+sumUndone))     : null;

  const label = `${dates[0].replace(/-/g,'/')} — ${dates[6].replace(/-/g,'/')}`;
  state.textContent = `الأسبوع ${label} · ${rows.length} طالب · ${active.length} يوم مرصود`
    + (WK_OFFSET ? ` · (قبل ${Math.abs(WK_OFFSET)} أسبوع)` : '');

  if(!rows.length){
    table.innerHTML='<div class="empty" style="padding:2rem;text-align:center">لا يوجد طلاب في هذا الفصل.</div>';
    return;
  }
  if(!active.length){
    table.innerHTML=`<div class="empty" style="padding:2rem;text-align:center">لا يوجد رصد في هذا الأسبوع (${esc(label)}).<br><small>الرصد من «✋ الرصد» أعلى اللوحة.</small></div>`;
    return;
  }

  const cell = (n, cls2) => n ? `<b class="${cls2||''}">${n}</b>` : '<span style="opacity:.35">—</span>';
  const body = built.map((x,i)=>`
    <tr${x.flag?' class="wk-flag"':''}>
      <td class="cnum">${i+1}</td>
      <td class="cnm">${esc(x.s.name||'')}${x.flag?' <span title="يحتاج انتباهاً">🚩</span>':''}</td>
      <td>${cell(x.shared)}</td><td>${cell(x.missed)}</td><td>${cell(x.absent)}</td>
      <td>${cell(x.done)}</td><td>${cell(x.undone)}</td><td>${cell(x.excused)}</td>
      <td class="wk-beh">${x.bh.icons.length
        ? x.bh.icons.slice(0,5).map(ic=>`<span>${esc(ic)}</span>`).join('')
          + (x.bh.icons.length>5?`<small>+${x.bh.icons.length-5}</small>`:'')
        : '<span style="opacity:.35">—</span>'}</td>
      <td>${x.nothing?'<small>لم يُرصد</small>':(x.flag?'🚩 انتباه':'✅')}</td>
    </tr>`).join('');

  table.innerHTML = `<div class="comp-report rep"><div class="rep-page">
    ${repHead('','الكشف الأسبوعي')}
    <div class="rep-in">
      <div class="rep-info">
        <div>المادة<b>${esc(rcGet('subject')||'العلوم')}</b></div>
        <div>الفصل<b>${esc(cls||'كل الفصول')}</b></div>
        <div>الأسبوع<b>${esc(label)}</b></div>
        <div>الأيام المرصودة<b>${active.length}</b></div>
      </div>
      <div class="rep-sec">تفصيل الأسبوع لكل طالب</div>
      <div class="rep-box" style="padding:.45rem">
        <table class="rt comprehensive-table">
          <thead><tr>
            <th class="cnum">م</th><th>اسم الطالب</th>
            <th>شارك</th><th>لم يشارك</th><th>غائب</th>
            <th>أنجز</th><th>لم ينجز</th><th>معذور</th>
            <th>السلوكيات</th><th>الحالة</th>
          </tr></thead>
          <tbody>${body}</tbody>
          <tfoot><tr><td colspan="2">مجموع الفصل</td>
            <td>${sumShared}</td><td>${sumMissed}</td><td>${sumAbsent}</td>
            <td>${sumDone}</td><td>${sumUndone}</td><td>${sumExcused}</td>
            <td>🟢 ${sumPos} · 🔴 ${sumNeg}</td><td>—</td></tr></tfoot>
        </table>
      </div>
      ${wkLegend.size?`<div class="wk-legend">مفتاح السلوكيات: ${
        [...wkLegend.entries()].map(([lb,ic])=>`<span><b>${esc(ic)}</b> ${esc(lb)}</span>`).join('')
      }</div>`:''}
      <div class="muted" style="font-size:.8rem;margin-top:.5rem">🚩 انتباه: لم يشارك مرتين فأكثر، أو لم ينجز الواجب مرتين فأكثر، أو لديه ملاحظة سلوكية سلبية واحدة على الأقل هذا الأسبوع.</div>
      ${repFoot()}
    </div>
  </div></div>${wkMobHTML(built,classes,cls,{shared:sumShared,missed:sumMissed,absent:sumAbsent,done:sumDone,undone:sumUndone,pos:sumPos,neg:sumNeg})}`;
}

/* 📱 الكشف الأسبوعي في الجوال: نفس فكرة الكشف الشامل — أرقام مضغوطة والاسم ثابت، والتفاصيل عند لمس الطالب */
let WK_MOB=[], WK_MOB_FLAG=false;
function wkMobHTML(built,classes,cls,sum){
  WK_MOB=built;
  const t=document.getElementById('wk-table'), off=!!(t&&t.classList.contains('cm-official'));
  const show=built.map((x,i)=>[x,i]).filter(([x])=>!WK_MOB_FLAG||x.flag);
  const chip=(l,on,go)=>`<button type="button" class="${on?'on':''}" onclick="${go}">${l}</button>`;
  const setCls=c=>`document.getElementById('wk-class').value='${esc(c)}';renderWeekly()`;
  const of=(a,b,bad)=>(a+b)?`<span class="${bad?'cm-bad':''}">${a}<small>/${a+b}</small></span>`:'<span class="cm-mut">—</span>';
  const n=(v,c)=>v?`<span class="${c||''}">${v}</span>`:'<span class="cm-mut">—</span>';
  const beh=x=>(x.bh.pos||x.bh.neg)?`${x.bh.pos?`<bdi dir="ltr" class="cm-pos">+${x.bh.pos}</bdi>`:''}${x.bh.neg?`<bdi dir="ltr" class="cm-bad">−${x.bh.neg}</bdi>`:''}`:'<span class="cm-mut">—</span>';
  return `<div class="comp-mob no-print${off?' cm-hide':''}">
    <div class="cm-chips">${chip('الكل',!cls,setCls(''))}${classes.map(c=>chip(esc(c),cls===c,setCls(c))).join('')}${chip('🚩 يحتاج انتباه',WK_MOB_FLAG,'WK_MOB_FLAG=!WK_MOB_FLAG;renderWeekly()')}</div>
    <div class="cm-tw"><table class="cm-t"><thead><tr><th class="cm-nm">الطالب</th><th>مشاركة<small>شارك/رُصد</small></th><th>غياب</th><th>واجب<small>أنجز/رُصد</small></th><th>سلوك</th><th>الحالة</th></tr></thead>
    <tbody>${show.length?show.map(([x,i])=>`<tr onclick="wkMobOpen(${i})"><td class="cm-nm"><b>${esc(x.s.name||'')}</b><small>${esc(String(x.s.cls||x.s.className||x.s.class||''))}</small></td>
      <td>${of(x.shared,x.missed,x.missed>=2)}</td><td>${n(x.absent,'cm-warn')}</td><td>${of(x.done,x.undone,x.undone>=2)}</td><td class="cm-beh">${beh(x)}</td>
      <td>${x.nothing?'<small class="cm-mut">لم يُرصد</small>':x.flag?'🚩':'✅'}</td></tr>`).join('')
      :'<tr><td colspan="6" class="cm-miss">لا يوجد طلاب يحتاجون انتباهًا هذا الأسبوع 🌿</td></tr>'}</tbody>
    <tfoot><tr><td class="cm-nm">الفصل</td><td>${sum.shared}<small>/${sum.shared+sum.missed}</small></td><td>${sum.absent}</td><td>${sum.done}<small>/${sum.done+sum.undone}</small></td><td><bdi dir="ltr" class="cm-pos">+${sum.pos}</bdi> <bdi dir="ltr" class="cm-bad">−${sum.neg}</bdi></td><td>—</td></tr></tfoot></table></div>
    <div class="cm-leg"><span>🚩 لم يشارك أو لم ينجز مرتين فأكثر، أو ملاحظة سلبية</span><span>المس الطالب للتفاصيل</span></div>
  </div>
  <div class="cm-offbar no-print"><button type="button" class="btn ghost sm" onclick="compMobOfficial('wk-table')">${off?'📱 العرض المختصر':'🖨️ الكشف الرسمي'}</button></div>`;
}

/* ═══════════ 📊 تحليل الكشف الشامل ═══════════
   لا يحسب شيئًا من جديد: يستهلك نفس مصادر الكشف الشامل — درجات الخادم
   وcompActivitiesForStudent — فلا يختلف رقمان عن بعضهما أبدًا.
   ═══════════════════════════════════════════ */
const K_CAMODE = 'hwapp_camode_v1';
let CA_RENDER_SEQ = 0;
function caMode(){ return localStorage.getItem(K_CAMODE) === 'brief' ? 'brief' : 'full'; }
function syncCaModeButtons(mode){
  const value = mode === 'brief' ? 'brief' : 'full';
  document.querySelectorAll('#ca-modebar .an-mode').forEach(b=>{
    const selected = b.dataset.m === value;
    b.classList.toggle('on', selected);
    b.setAttribute('aria-selected', selected ? 'true' : 'false');
  });
}
const CA_LEVELS = ['ممتاز','جيد جدًا','جيد','يحتاج متابعة','يحتاج دعم'];
const CA_COLOR  = { 'ممتاز':'#0E5B4E','جيد جدًا':'#2E7D64','جيد':'#7A8B45','يحتاج متابعة':'#B4740E','يحتاج دعم':'#B3261E' };


async function renderCompAnalysis(force=false){
  try{ vspSyncSelects(); }catch(e){}
  const state=document.getElementById('ca-state'), body=document.getElementById('ca-body');
  if(!state||!body) return;
  const renderSeq = ++CA_RENDER_SEQ;

  const arr=Array.isArray(STUDENTS)?STUDENTS:[];
  const classes=[...new Set(arr.map(s=>String(s.cls||s.className||s.class||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  const cs=document.getElementById('ca-class');
  if(cs){
    const cur=String(cs.value||'');
    cs.innerHTML='<option value="">كل الفصول</option>'+classes.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    if(classes.includes(cur)) cs.value=cur;
  }
  const cls=String(cs?.value||'');

  // تحديد الفترة قبل أي استدعاء غير متزامن، حتى لا تدخل const في Temporal Dead Zone
  // أثناء جلب الدرجات. كان الخطأ هنا يجعل فشلًا محليًا في JavaScript يظهر للمستخدم
  // كأنه فشل في جلب الدرجات من الخادم.
  const semester=Number(document.getElementById('comp-semester')?.value||1)===2?2:1;
  const period=Number(document.getElementById('comp-period')?.value||1)===2?2:1;

  const MODE = caMode();
  syncCaModeButtons(MODE);

  state.textContent='جارٍ التحليل…';
  let G=null;
  try{ G=await loadServerGrades(force||!COMP_GRADES||COMP_GRADES_PERIOD!==period||COMP_GRADES_SEMESTER!==semester,semester,period); }
  catch(e){
    if(renderSeq !== CA_RENDER_SEQ) return;
    state.textContent='تعذّر جلب الدرجات من الخادم — لا يمكن التحليل بأرقام غير موثوقة.';
    body.innerHTML='<div class="empty" style="padding:2rem;text-align:center">لم تصل الدرجات من الخادم.</div>';
    return;
  }
  if(renderSeq !== CA_RENDER_SEQ) return;
  G=G||{map:{},rules:{max:10}};
  const MAX=(G.rules&&G.rules.max)||10;

  const arrNow=Array.isArray(STUDENTS)?STUDENTS:[];
  const rows=arrNow.filter(s=>!cls||String(s.cls||s.className||s.class||'').trim()===cls);
  const calc=[]; const unsynced=[];
  for(const s of rows){
    const g=(G.map&&G.map[String(s.id||'')])||null;
    if(!g){ unsynced.push(String(s.name||'')); continue; }   // كما في الكشف: لا يُحسب بأصفار
    const p=g.participation?.score??0, h=g.homework?.score??0, b=g.behavior?.score??0;
    const exam=(g.exam&&g.exam.score!=null)?Number(g.exam.score):0;
    const acts=compActivitiesForStudent(s,G.term);
    const sub=compSubmissionCount(acts,s,G.term);
    const a=acts.length?Math.round(sub/acts.length*100)/10:MAX;
    const total=Math.round((p+h+b+a+exam)*10)/10;
    calc.push({ s, p, h, b, a, exam, total, level:compAnnualLevel(total),
                cls:String(s.cls||s.className||s.class||'').trim(),
                noActs:!acts.length,
                unrec:(!g.participation?.measured?1:0)+(!g.homework?.measured?1:0)+(!g.behavior?.measured?1:0)+(!g.exam?.measured?1:0) });
  }

  if(!calc.length){
    state.textContent = rows.length ? 'لم تصل بيانات هؤلاء الطلاب من الخادم.' : 'لا يوجد طلاب.';
    body.innerHTML='<div class="empty" style="padding:2rem;text-align:center">لا توجد بيانات للتحليل.</div>';
    return;
  }

  const n=calc.length;
  const avg=k=>Math.round(calc.reduce((t,x)=>t+x[k],0)/n*10)/10;
  const comps=[['المشاركة','p',MAX],['الواجب','h',MAX],['السلوك','b',MAX],['الأنشطة والمهام','a',MAX],['الاختبار','exam',20]]
    .map(([lbl,k,max])=>({lbl,k,max,v:avg(k),pct:max?avg(k)/max*100:0})).sort((x,y)=>x.pct-y.pct);
  const weakest=comps[0];
  const dist=CA_LEVELS.map(l=>({ l, c:calc.filter(x=>x.level===l).length }));
  const maxC=Math.max(1,...dist.map(d=>d.c));
  let __acc=0;
  const caStops = dist.map(d=>{ const pc=d.c/n*100; const seg=`${CA_COLOR[d.l]} ${__acc}% ${__acc+pc}%`; __acc+=pc; return seg; }).join(',');
  const needy=calc.filter(x=>x.level==='يحتاج دعم'||x.level==='يحتاج متابعة')
                  .sort((x,y)=>x.total-y.total);
  const top=[...calc].sort((x,y)=>y.total-x.total).slice(0,5);
  const byCls=[...new Set(calc.map(x=>x.cls))].filter(Boolean).sort((a,b)=>a.localeCompare(b,'ar'))
    .map(c=>{ const g=calc.filter(x=>x.cls===c); const m=k=>Math.round(g.reduce((t,x)=>t+x[k],0)/g.length*10)/10;
      return { c, n:g.length, t:Math.round(g.reduce((t,x)=>t+x.total,0)/g.length*10)/10,
               p:m('p'), h:m('h'), b:m('b'), a:m('a'), exam:m('exam') }; })
    .sort((a,b)=>b.t-a.t);

  state.textContent=`${n} طالبًا محسوبًا · ${semester===1?'الفصل الدراسي الأول':'الفصل الدراسي الثاني'} · متوسط المجموع ${avg('total')} من 60` + (G.closed?' · 🔒 مؤرشف':'')
    + (unsynced.length?` · ⚠️ ${unsynced.length} لم تصل بياناتهم`:'');
  if(renderSeq !== CA_RENDER_SEQ || caMode() !== MODE) return;
  syncCaModeButtons(MODE);

  const noActsN=calc.filter(x=>x.noActs).length, unrecN=calc.filter(x=>x.unrec>0).length;
  body.innerHTML=`<div class="comp-report rep"><div class="rep-page${MODE==='brief'?' one-page':''}">
    ${repHead('','تحليل الكشف الشامل',semester)}
    <div class="rep-in">
      <div class="rep-info">
        <div>المادة<b>${esc(rcGet('subject')||'العلوم')}</b></div>
        <div>الفصل<b>${esc(cls||'كل الفصول')}</b></div>
        <div>الفصل الدراسي<b>${semester===2?'الفصل الدراسي الثاني':'الفصل الدراسي الأول'}</b></div>
        <div>الفترة<b>${period===2?'الفترة الثانية':'الفترة الأولى'}</b></div>
        <div>عدد الطلاب<b>${n}</b></div>
        <div>متوسط المجموع<b>${avg('total')} / 60</b></div>
      </div>
      <div class="rep-band">أضعف عنصر: <b>${esc(weakest.lbl)}</b> بمتوسط ${weakest.v} من ${weakest.max} (${Math.round(weakest.pct)}%) — هنا يُبدأ العلاج</div>
      ${(noActsN||unrecN)?`<div class="muted" style="font-size:.82rem;margin:.3rem 0">${[noActsN?`${noActsN} بلا أنشطة مطلوبة — عُنصر الأنشطة محسوب كاملًا (10/10) لهم`:'',unrecN?`⚠️ ${unrecN} طالبًا لديهم عناصر لم تُرصد بعد وتدخل بصفر في المتوسطات`:''].filter(Boolean).join(' · ')}</div>`:''}

      <div class="rep-sec">رسم بياني (متوسط كل عنصر)</div>
      <div class="rep-box">
        <div class="bars">
          ${comps.map(c=>`<div class="b"><em>${c.v}/${c.max}</em>
            <i style="height:${Math.max(0,Math.min(100,c.pct))}%;background:${c.pct>=80?'#0E5B4E':c.pct>=60?'#B4740E':'#B3261E'}"></i></div>`).join('')}
        </div>
        <div class="blab">${comps.map(c=>`<span>${esc(c.lbl)}</span>`).join('')}</div>
      </div>

      <div class="rep-charts">
        <div>
          <div class="rep-sec">رسم بياني (نسب الطلاب لكل تقدير)</div>
          <div class="rep-box" style="display:flex;gap:.7rem;align-items:center">
            <div class="leg" style="flex:1">
              ${dist.map(d=>`<div><i style="background:${CA_COLOR[d.l]}"></i>
                <span style="flex:1">${esc(d.l)}</span><b>${Math.round(d.c/n*100)}%</b></div>`).join('')}
            </div>
            <div class="donut" style="background:conic-gradient(${caStops})">
              ${(()=>{const top=dist.reduce((m,d)=>d.c>m.c?d:m,dist[0]);return `<b><span>${Math.round(top.c/n*100)}%</span><small>${esc(top.l)}</small></b>`})()}
            </div>
          </div>
        </div>
        <div>
          <div class="rep-sec">رسم بياني (عدد الطلاب حسب تقديرهم)</div>
          <div class="rep-box">
            <div class="bars">
              ${dist.slice().reverse().map(d=>`<div class="b"><em>${d.c}</em>
                <i style="height:${maxC?d.c/maxC*100:0}%;background:${CA_COLOR[d.l]}"></i></div>`).join('')}
            </div>
            <div class="blab">${dist.slice().reverse().map(d=>`<span>${esc(d.l)}</span>`).join('')}</div>
          </div>
        </div>
      </div>

      ${byCls.length>1?`<div class="rep-sec">مقارنة الفصول</div>
      <div class="rep-box" style="padding:.45rem">
        <table class="rt comprehensive-table"><thead><tr>
          <th>الفصل</th><th>الطلاب</th>
          ${MODE==='full'?'<th>المشاركة</th><th>الواجب</th><th>السلوك</th><th>الأنشطة</th><th>الاختبار</th>':''}
          <th>المجموع / 60</th></tr></thead>
          <tbody>${byCls.map(x=>`<tr><td class="cnm">${esc(x.c)}</td><td>${x.n}</td>
            ${MODE==='full'?`<td class="score">${x.p}</td><td class="score">${x.h}</td>
              <td class="score">${x.b}</td><td class="score">${x.a}</td><td class="score">${x.exam}</td>`:''}
            <td class="score ctotal">${x.t}</td></tr>`).join('')}</tbody></table></div>`:''}

      ${MODE==='full'?`<div class="rep-sec">يحتاجون تدخّلًا (${needy.length})</div>
      <div class="rep-box" style="padding:.45rem">
        ${needy.length?`<table class="rt comprehensive-table"><thead><tr>
          <th class="cnum">م</th><th>اسم الطالب</th><th>المجموع</th><th>التقدير</th><th>أضعف عنصر لديه</th></tr></thead>
          <tbody>${needy.map((x,i)=>{
            const mine=[['المشاركة',x.p,MAX],['الواجب',x.h,MAX],['السلوك',x.b,MAX],['الأنشطة',x.a,MAX],['الاختبار',x.exam,20]].sort((a,b)=>(a[1]/a[2])-(b[1]/b[2]))[0];
            return `<tr><td class="cnum">${i+1}</td><td class="cnm">${esc(x.s.name||'')}</td>
              <td class="score ctotal">${x.total}</td><td class="clevel">${esc(x.level)}</td>
              <td>${esc(mine[0])} <small>${mine[1]}</small></td></tr>`;}).join('')}</tbody></table>`
          :'<div class="muted" style="padding:.6rem;text-align:center">لا أحد دون مستوى «جيد».</div>'}
      </div>`:''}
      ${MODE==='full'&&top.length?`<div class="rep-sec">الأعلى في الفصل</div>
      <div class="rep-box" style="padding:.45rem">
        <table class="rt comprehensive-table"><thead><tr>
          <th class="cnum">م</th><th>اسم الطالب</th><th>المجموع</th><th>التقدير</th></tr></thead>
          <tbody>${top.map((x,i)=>`<tr><td class="cnum">${i+1}</td><td class="cnm">${esc(x.s.name||'')}</td>
            <td class="score ctotal">${x.total}</td><td class="clevel">${esc(x.level)}</td></tr>`).join('')}</tbody></table></div>`:''}

      ${repFoot()}
    </div>
  </div></div>`;
}

/* 🏷️ يُلصق اسم العمود على كل خلية بعد الرسم، فتقرأ البطاقة على الجوال
   «المشاركة ٩» لا «٩» مجرّدة. لا يمسّ الطباعة: سمة فقط، والجدول كما هو. */
function labelTableCells(root){
  const scope = root || document;
  scope.querySelectorAll('table.comprehensive-table').forEach(tb=>{
    const ths = [...tb.querySelectorAll('thead th')].map(th=>String(th.textContent||'').trim());
    if(!ths.length) return;
    tb.querySelectorAll('tbody tr').forEach(tr=>{
      [...tr.children].forEach((td,i)=>{
        if(td.hasAttribute('data-label')) return;
        td.setAttribute('data-label', ths[i] || '');
      });
    });
  });
}

/* 🖨️ محرك موحّد للكشوف الثلاثة فقط: نفس المسار في الجوال والكمبيوتر.
   يعزل اللوحة المطلوبة، يلغي تصغير الجوال، ويحدد A4 والاتجاه وقت الطباعة. */
/* 🖨️ على الكمبيوتر يتوقف window.print() حتى يُغلق الحوار، فيكفي مؤقت قصير بعده لإلغاء وضع الطباعة.
   على الجوال يعود فورًا والمعاينة لم تكتمل؛ إلغاء الوضع بعد 1.5 ث كان يُخرج التقرير بتنسيق الشاشة.
   هنا نقيس: إن عاد فورًا ننتظر afterprint (والمؤقت الطويل احتياط فقط). */
function printThen(done){
  const t0=Date.now(); window.print();
  setTimeout(done, Date.now()-t0 < 400 ? 120000 : 1500);
}
function unifiedA4Print({bodyClass,title,selector,orientation='portrait',margin='7mm'}){
  clearReportZoom();
  const box=document.querySelector(selector);
  if(!box || !box.innerHTML.trim()){ toast('لا توجد بيانات للطباعة','bad'); return; }
  ensureLogo();
  const oldTitle=document.title;
  const oldStyle=document.getElementById('__unified-a4-print-style');
  if(oldStyle) oldStyle.remove();
  const style=document.createElement('style');
  style.id='__unified-a4-print-style';
  style.textContent=`@media print{ @page{size:A4 ${orientation}; margin:${margin};} }`;
  document.head.insertBefore(style, document.getElementById('late-css'));
  // الاختبار الورقي صفحته 210×297 مم بحشوه الداخلي فهامشه صفر. ستايل الكشف الشامل فيه
  // @page{margin:7mm!important} عام لكل طباعة، فيُنقص الورقة وتنقسم كل صفحة اختبار إلى ورقتين
  // مع قصّ الحافة اليسرى، ولا تتغلب عليه قاعدة !important لاحقة في Chrome.
  // لذلك يُعطَّل ذلك الستايل أثناء طباعة الاختبار فقط ويعود فورًا بعدها.
  const compPrint = (bodyClass==='printing-exam'||bodyClass==='printing-cert') ? document.getElementById('comprehensive-print-identical-all-devices') : null;
  if(compPrint) compPrint.disabled = true;
  document.title=title||oldTitle;
  document.body.classList.add(bodyClass);
  const done=()=>{
    document.body.classList.remove(bodyClass);
    document.title=oldTitle;
    const st=document.getElementById('__unified-a4-print-style');
    if(st) st.remove();
    if(compPrint) compPrint.disabled = false;
    window.removeEventListener('afterprint',done);
  };
  window.addEventListener('afterprint',done);
  setTimeout(()=>printThen(done),120);
}


/* ═══════════ 🖨️ الاختبارات الورقية: كليشة رسمية من بنك الأسئلة أو من JSON ═══════════ */
/* شعار الوزارة كان يُولَّد داخل تصيير التحليل فقط، فيغيب عن أي كليشة تُفتح قبله */
if(!window.__MOE_LOGO) window.__MOE_LOGO = `<svg preserveAspectRatio="xMidYMid meet" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
	 viewBox="0 0 1000 1000" style="enable-background:new 0 0 1000 1000;" xml:space="preserve">
<style type="text/css">
	.moe-st0{fill:#929497;}
	.moe-st1{fill:#008A79;}
	.moe-st2{fill:#00897D;}
	.moe-st3{fill:#008880;}
	.moe-st4{fill:#00998B;}
	.moe-st5{fill:#009B8B;}
	.moe-st6{fill:#00A08B;}
	.moe-st7{fill:#00B4A6;}
	.moe-st8{fill:#00B6A7;}
	.moe-st9{fill:#009D8A;}
	.moe-st10{fill:#019A8B;}
</style>
<path class="moe-st0" d="M114,682.2c0.5,0.6,0.8,0.6,1.1,0l15.3-29.1c0.2-0.4,0.5-0.6,0.9-0.6h2.8c0.5,0,1,0.5,1,1v33.4c0,0.6-0.5,1-1,1
	h-2.8c-0.6,0-1-0.5-1-1v-26l-13.4,25c-1.5,2.7-4.8,2.7-6.2,0l-11-21.7V687c0,0.6-0.4,1-1,1H96c-0.5,0-1-0.5-1-1v-33.4
	c0-0.6,0.5-1,1-1h2.8c0.4,0,0.7,0.2,0.9,0.6l0,0l0,0l0,0l0,0L114,682.2L114,682.2z"/>
<path class="moe-st0" d="M147.4,661.6h2.8c0.6,0,1,0.5,1,1v24.3c0,0.6-0.4,1-1,1h-2.8c-0.6,0-1-0.5-1-1v-24.3
	C146.4,662,146.9,661.6,147.4,661.6L147.4,661.6z"/>
<path class="moe-st0" d="M148.8,652.5c1.4,0,2.6,1.2,2.6,2.6c0,1.4-1.2,2.6-2.6,2.6c-1.4,0-2.6-1.2-2.6-2.6S147.4,652.5,148.8,652.5
	L148.8,652.5z"/>
<path class="moe-st0" d="M198.2,661.6h2.8c0.6,0,1,0.5,1,1v24.3c0,0.6-0.5,1-1,1h-2.8c-0.5,0-1-0.5-1-1v-24.3
	C197.2,662,197.7,661.6,198.2,661.6L198.2,661.6z"/>
<path class="moe-st0" d="M199.6,652.5c1.4,0,2.6,1.2,2.6,2.6c0,1.4-1.2,2.6-2.6,2.6c-1.4,0-2.6-1.2-2.6-2.6S198.2,652.5,199.6,652.5
	L199.6,652.5z"/>
<path class="moe-st0" d="M560.9,661.6h2.8c0.5,0,1,0.5,1,1v24.3c0,0.6-0.5,1-1,1h-2.8c-0.6,0-1-0.5-1-1v-24.3
	C559.9,662,560.4,661.6,560.9,661.6L560.9,661.6z"/>
<path class="moe-st0" d="M562.3,652.5c1.4,0,2.6,1.2,2.6,2.6c0,1.4-1.2,2.6-2.6,2.6c-1.4,0-2.6-1.2-2.6-2.6S560.9,652.5,562.3,652.5
	L562.3,652.5z"/>
<path class="moe-st0" d="M181.9,672.1c0-6.2-5.2-8.3-15.9-8.2v22.9c0,0.5-0.5,1-1,1h-2.8c-0.5,0-1-0.5-1-1v-24.3c0-0.6,0.5-1,1-1
	c4.2,0,8.4-0.1,12.6,0c7.5,0.3,11.9,5,11.9,12.3v13.1c0,0.5-0.5,1-1,1h-2.8c-0.5,0-1-0.5-1-1V672.1L181.9,672.1z"/>
<path class="moe-st0" d="M625.8,672.1c0-6.2-5.2-8.3-15.9-8.2v22.9c0,0.5-0.5,1-1,1h-2.8c-0.5,0-1-0.5-1-1v-24.3c0-0.6,0.5-1,1-1
	c4.2,0,8.4-0.1,12.6,0c7.5,0.3,11.9,5,11.9,12.3v13.1c0,0.5-0.5,1-1,1h-2.8c-0.5,0-1-0.5-1-1V672.1L625.8,672.1z"/>
<path class="moe-st0" d="M449.1,677.2c0,6.2,5.2,8.3,15.9,8.2v-22.9c0-0.5,0.5-1,1-1h2.8c0.5,0,1,0.5,1,1v24.3c0,0.6-0.5,1-1,1
	c-4.2,0-8.4,0.1-12.6,0c-7.5-0.3-11.9-5-11.9-12.3v-13.1c0-0.5,0.5-1,1-1h2.8c0.5,0,1,0.5,1,1L449.1,677.2L449.1,677.2z"/>
<path class="moe-st0" d="M236,675.6v-22.1c0-0.6,0.5-1,1-1h2.8c0.6,0,1,0.5,1,1v7.6c0,0.3,0.2,0.5,0.5,0.5h7c0.3,0,0.5,0.2,0.5,0.5v1.4
	c0,0.3-0.2,0.5-0.5,0.5h-7c-0.3,0-0.5,0.2-0.5,0.5V678c0,4,2.3,6.3,6.9,7.3c2.8,0.6,3.6,2.7,0.2,2.6
	C240.5,687.7,236,682.9,236,675.6L236,675.6z"/>
<path class="moe-st0" d="M539.1,675.6v-22.1c0-0.6,0.5-1,1-1h2.8c0.5,0,1,0.5,1,1v7.6c0,0.3,0.2,0.5,0.5,0.5h7c0.3,0,0.5,0.2,0.5,0.5
	v1.4c0,0.3-0.2,0.5-0.5,0.5h-7c-0.3,0-0.5,0.2-0.5,0.5V678c0,4,2.3,6.3,6.9,7.3c2.8,0.6,3.6,2.7,0.2,2.6
	C543.5,687.7,539.1,682.9,539.1,675.6L539.1,675.6z"/>
<path class="moe-st0" d="M349.4,664.8v22.1c0,0.5,0.5,1,1,1h2.8c0.5,0,1-0.5,1-1v-15.2c0-0.3,0.2-0.5,0.5-0.5h7c0.3,0,0.5-0.2,0.5-0.5
	v-1.4c0-0.3-0.2-0.5-0.5-0.5h-7c-0.3,0-0.5-0.2-0.5-0.5v-5.8c0-4,2.3-6.3,6.9-7.3c2.8-0.6,3.6-2.7,0.2-2.6
	C353.8,652.7,349.4,657.5,349.4,664.8L349.4,664.8z"/>
<path class="moe-st0" d="M256.4,673.8v13.1c0,0.5,0.5,1,1,1h2.8c0.5,0,1-0.5,1-1c0-16.9,0,7.4,0-15.4c0-4,2.3-6.3,6.9-7.3
	c2.8-0.6,3.6-2.7,0.2-2.6C260.8,661.8,256.4,666.5,256.4,673.8L256.4,673.8z"/>
<path class="moe-st0" d="M295.1,688.4c0-0.3-0.2-0.5-0.5-0.5c-1.9,0-3.1,0-5.7-0.1c-7.5-0.3-11.9-5-11.9-12.3v-13.1c0-0.5,0.5-1,1-1h2.8
	c0.5,0,1,0.5,1,1v14.7c0,4.5,2.9,8.5,6.8,8.5c2.4,0,6.6-1.9,6.6-6.9c0-5.4,0-10.9,0-16.3c0-0.5,0.5-1,1-1h2.8c0.5,0,1,0.5,1,1v29.2
	c0,7.3-4.4,12.1-11.9,12.3c-3.4,0.1-2.6-2,0.2-2.6c4.6-1,6.9-3.6,7-7.6L295.1,688.4L295.1,688.4z"/>
<path class="moe-st0" d="M381.5,652.5c7.6,0,15.3,0,22.9,0c0.4,0,0.7,0.3,0.7,0.7v2c0,0.4-0.3,0.7-0.7,0.7h-19.1v11.8h13.6
	c0.4,0,0.7,0.3,0.7,0.7v2c0,0.4-0.3,0.7-0.7,0.7h-13.6v13.4h19.1c0.4,0,0.7,0.3,0.7,0.7v2c0,0.4-0.3,0.7-0.7,0.7
	c-7.6,0-15.3,0-22.9,0c-0.6,0-1-0.5-1-1v-33.4C380.5,653,381,652.5,381.5,652.5L381.5,652.5z"/>
<path class="moe-st0" d="M333.5,661.6h-6c-5.5,0-10,4.5-10,10v6.3c0,5.5,4.5,10,10,10h6c5.5,0,10-4.5,10-10v-6.3
	C343.5,666.1,339,661.6,333.5,661.6z M338.3,679.2c0,3.3-2.7,6.1-6.1,6.1h-3.6c-3.3,0-6.1-2.7-6.1-6.1v-8.9c0.1-3.4,2.8-6.1,6.1-6.1
	h3.6c3.3,0,6.1,2.7,6.1,6.1V679.2z"/>
<path class="moe-st0" d="M588.7,661.6h-6c-5.5,0-10,4.5-10,10v6.3c0,5.5,4.5,10,10,10h6c5.5,0,10-4.5,10-10v-6.3
	C598.7,666.1,594.2,661.6,588.7,661.6z M593.6,679.2c0,3.3-2.7,6.1-6.1,6.1h-3.6c-3.3,0-6.1-2.7-6.1-6.1v-8.9
	c0.1-3.4,2.8-6.1,6.1-6.1h3.6c3.3,0,6.1,2.7,6.1,6.1V679.2z"/>
<path class="moe-st0" d="M434.3,652.5h-2.8c-0.5,0-1,0.5-1,1v7.6c0,0.3-0.2,0.5-0.5,0.5h-11.2c-5.5,0-10,4.5-10,10v6.3
	c0,5.5,4.5,10,10,10h12.7h1.8h1c0.6,0,1-0.5,1-1v-33.4C435.3,652.9,434.8,652.5,434.3,652.5z M430.5,685.1c0,0.3-0.2,0.5-0.5,0.5h-9
	c-4,0-7.3-3.3-7.3-7.3v-7c0-4,3.3-7.3,7.3-7.3h9c0.3,0,0.5,0.2,0.5,0.5V685.1z"/>
<path class="moe-st0" d="M529.7,661.6c-4.7,0-8.6,0-15.4,0c-5.5,0-10,4.5-10,10v6.3c0,5.5,4.5,10,10,10c4.9,0,10.9-0.7,11.6-0.6
	c0.5,0.1,0.7,0.6,1.5,0.6h2.3c0.6,0,1-0.5,1-1v-24.3C530.7,662,530.2,661.6,529.7,661.6z M526,679.4c0,2.4-1.6,6.7-9.5,6.1
	c-4-0.3-7.3-3.3-7.3-7.3v-7c0-4,3.3-7.3,7.3-7.3h9c0.3,0,0.5,0.2,0.5,0.5V679.4z"/>
<path class="moe-st0" d="M486.1,687.9c-5.5,0-10-4.5-10-10v-6.3c0-5.5,4.5-10,10-10h13.1c0.1,0,0.2,0.1,0.2,0.2v1.9
	c0,0.1-0.1,0.2-0.2,0.2c-3.7,0-7.3,0-11,0c-4,0-7.3,3.3-7.3,7.3v7c0,4,3.3,7.3,7.3,7.3c3.7,0,7.3,0,11,0c0.1,0,0.2,0.1,0.2,0.2v1.9
	c0,0.1-0.1,0.2-0.2,0.2L486.1,687.9L486.1,687.9z"/>
<path class="moe-st0" d="M224.9,663.6c2.4,0,2.4-3.3,0.1-3.5c-6.7-0.7-12.9,0.8-14.5,6.1c-1.2,4,1.2,7.6,7,8.7c7.6,1.4,10.5,5.1,7.3,8.5
	c-1.7,1.7-6.8,1.1-10.5,1.3c-4,0.2-3.5,3.2,0,3.2c6,0.1,12.7,0.9,15.1-3.1c2.5-4.2,0.4-10-4.3-11c-6.3-1.3-10.2-2.7-9.4-6.3
	C216.4,663.9,219.5,663.7,224.9,663.6L224.9,663.6z"/>
<path class="moe-st1" d="M631.4,458.6c4,0,7.2,3.2,7.2,7.2s-3.2,7.2-7.2,7.2s-7.2-3.2-7.2-7.2C624.3,461.8,627.5,458.6,631.4,458.6
	L631.4,458.6z"/>
<path class="moe-st1" d="M631.4,396.7c4.3,0,7.8,3.5,7.8,7.8s-3.5,7.8-7.8,7.8s-7.8-3.5-7.8-7.8C623.6,400.2,627.1,396.7,631.4,396.7
	L631.4,396.7z"/>
<path class="moe-st2" d="M667.2,426.1c4.3,0,7.8,3.5,7.8,7.8s-3.5,7.8-7.8,7.8s-7.8-3.5-7.8-7.8S662.9,426.1,667.2,426.1L667.2,426.1z"
	/>
<path class="moe-st2" d="M597.2,427.4c4.3,0,7.8,3.5,7.8,7.8s-3.5,7.8-7.8,7.8s-7.8-3.5-7.8-7.8C589.3,430.9,592.8,427.4,597.2,427.4
	L597.2,427.4z"/>
<path class="moe-st3" d="M525,438.3c4,0,7.2,3.2,7.2,7.2s-3.2,7.2-7.2,7.2s-7.2-3.2-7.2-7.2S521,438.3,525,438.3L525,438.3z"/>
<path class="moe-st3" d="M738.3,437.4c4,0,7.2,3.2,7.2,7.2s-3.2,7.2-7.2,7.2s-7.2-3.2-7.2-7.2S734.4,437.4,738.3,437.4L738.3,437.4z"/>
<path class="moe-st3" d="M669,368.7c4.7,0,8.4,3.8,8.4,8.4c0,4.7-3.8,8.4-8.4,8.4c-4.7,0-8.4-3.8-8.4-8.4
	C660.6,372.4,664.3,368.7,669,368.7L669,368.7z"/>
<path class="moe-st3" d="M595.2,369.6c4.7,0,8.4,3.8,8.4,8.4c0,4.7-3.8,8.4-8.4,8.4c-4.7,0-8.4-3.8-8.4-8.4S590.6,369.6,595.2,369.6
	L595.2,369.6z"/>
<path class="moe-st3" d="M558.5,401c4.7,0,8.4,3.8,8.4,8.4c0,4.7-3.8,8.4-8.4,8.4c-4.7,0-8.4-3.8-8.4-8.4S553.9,401,558.5,401L558.5,401
	z"/>
<path class="moe-st3" d="M705.7,399.6c5,0,9,4,9,9s-4,9-9,9s-9-4-9-9S700.8,399.6,705.7,399.6L705.7,399.6z"/>
<path class="moe-st4" d="M708.4,344c5.5,0,9.9,4.4,9.9,9.9s-4.4,9.9-9.9,9.9s-9.9-4.4-9.9-9.9S702.9,344,708.4,344L708.4,344z"/>
<path class="moe-st5" d="M750.2,324.9c6.8,0,12.3,5.5,12.3,12.3s-5.5,12.3-12.3,12.3s-12.3-5.5-12.3-12.3
	C737.9,330.5,743.4,324.9,750.2,324.9L750.2,324.9z"/>
<path class="moe-st6" d="M793.6,311.4c7.9,0,14.3,6.4,14.3,14.3s-6.4,14.3-14.3,14.3c-7.9,0-14.3-6.4-14.3-14.3S785.7,311.4,793.6,311.4
	L793.6,311.4z"/>
<path class="moe-st7" d="M838,302.2c8.3,0,14.9,6.7,14.9,14.9c0,8.3-6.7,14.9-14.9,14.9c-8.3,0-15-6.7-15-14.9
	C823,308.9,829.7,302.2,838,302.2L838,302.2z"/>
<path class="moe-st8" d="M883.1,296.1c9.2,0,16.7,7.5,16.7,16.7s-7.5,16.7-16.7,16.7s-16.7-7.5-16.7-16.7
	C866.4,303.5,873.9,296.1,883.1,296.1L883.1,296.1z"/>
<path class="moe-st4" d="M747.4,379c5.5,0,9.9,4.4,9.9,9.9s-4.4,9.9-9.9,9.9s-9.9-4.4-9.9-9.9C737.4,383.5,741.9,379,747.4,379
	L747.4,379z"/>
<path class="moe-st5" d="M790.9,363c6.8,0,12.3,5.5,12.3,12.3s-5.5,12.3-12.3,12.3s-12.3-5.5-12.3-12.3C778.6,368.6,784.1,363,790.9,363
	L790.9,363z"/>
<path class="moe-st6" d="M836.7,352.8c7.9,0,14.3,6.4,14.3,14.3s-6.4,14.3-14.3,14.3c-7.9,0-14.3-6.4-14.3-14.3
	C822.4,359.2,828.8,352.8,836.7,352.8L836.7,352.8z"/>
<path class="moe-st7" d="M884.9,351.2c8.3,0,14.9,6.7,14.9,14.9c0,8.3-6.7,15-14.9,15c-8.3,0-15-6.7-15-15
	C869.9,357.9,876.6,351.2,884.9,351.2L884.9,351.2z"/>
<path class="moe-st4" d="M785,415.8c5.5,0,9.9,4.4,9.9,9.9s-4.4,9.9-9.9,9.9s-9.9-4.4-9.9-9.9C775.1,420.2,779.5,415.8,785,415.8
	L785,415.8z"/>
<path class="moe-st5" d="M836.7,403.5c6.8,0,12.3,5.5,12.3,12.3s-5.5,12.3-12.3,12.3s-12.3-5.5-12.3-12.3
	C824.4,409.1,829.9,403.5,836.7,403.5L836.7,403.5z"/>
<path class="moe-st6" d="M886.2,402.2c7.4,0,13.4,6,13.4,13.4s-6,13.4-13.4,13.4s-13.4-6-13.4-13.4C872.7,408.2,878.8,402.2,886.2,402.2
	L886.2,402.2z"/>
<path class="moe-st4" d="M555.6,345.3c5.5,0,9.9,4.4,9.9,9.9s-4.4,9.9-9.9,9.9s-9.9-4.4-9.9-9.9C545.7,349.8,550.1,345.3,555.6,345.3
	L555.6,345.3z"/>
<path class="moe-st9" d="M514.4,326.7c6.8,0,12.3,5.5,12.3,12.3s-5.5,12.3-12.3,12.3s-12.3-5.5-12.3-12.3
	C502,332.2,507.6,326.7,514.4,326.7L514.4,326.7z"/>
<path class="moe-st6" d="M470.7,313.1c7.9,0,14.3,6.4,14.3,14.3s-6.4,14.3-14.3,14.3s-14.3-6.4-14.3-14.3
	C456.4,319.5,462.8,313.1,470.7,313.1L470.7,313.1z"/>
<path class="moe-st7" d="M426.4,304.4c8.3,0,14.9,6.7,14.9,15s-6.7,14.9-14.9,14.9c-8.3,0-15-6.7-15-14.9
	C411.4,311.1,418.1,304.4,426.4,304.4L426.4,304.4z"/>
<path class="moe-st8" d="M381.4,296.1c9.2,0,16.7,7.5,16.7,16.7s-7.5,16.7-16.7,16.7s-16.7-7.5-16.7-16.7
	C364.7,303.5,372.2,296.1,381.4,296.1L381.4,296.1z"/>
<path class="moe-st4" d="M516.8,380.3c5.5,0,9.9,4.4,9.9,9.9s-4.4,9.9-9.9,9.9s-9.9-4.4-9.9-9.9C506.9,384.8,511.3,380.3,516.8,380.3
	L516.8,380.3z"/>
<path class="moe-st9" d="M472.9,364.4c6.8,0,12.3,5.5,12.3,12.3s-5.5,12.3-12.3,12.3s-12.3-5.5-12.3-12.3S466.1,364.4,472.9,364.4
	L472.9,364.4z"/>
<path class="moe-st6" d="M426.4,354.1c7.9,0,14.3,6.4,14.3,14.3s-6.4,14.3-14.3,14.3s-14.3-6.4-14.3-14.3S418.5,354.1,426.4,354.1
	L426.4,354.1z"/>
<path class="moe-st7" d="M379.6,352.5c8.3,0,15,6.7,15,14.9c0,8.3-6.7,15-15,15s-14.9-6.7-14.9-15C364.7,359.2,371.3,352.5,379.6,352.5
	L379.6,352.5z"/>
<path class="moe-st4" d="M479.4,417.1c5.5,0,9.9,4.4,9.9,9.9s-4.4,9.9-9.9,9.9s-9.9-4.4-9.9-9.9C469.5,421.6,473.9,417.1,479.4,417.1
	L479.4,417.1z"/>
<path class="moe-st9" d="M429,404.9c6.8,0,12.3,5.5,12.3,12.3s-5.5,12.3-12.3,12.3s-12.3-5.5-12.3-12.3S422.2,404.9,429,404.9L429,404.9
	z"/>
<path class="moe-st6" d="M377.4,403.6c7.4,0,13.4,6,13.4,13.4s-6,13.4-13.4,13.4s-13.4-6-13.4-13.4S370,403.6,377.4,403.6L377.4,403.6z"
	/>
<circle class="moe-st10" cx="166.4" cy="613.6" r="4"/>
<circle class="moe-st10" cx="366" cy="550.7" r="4"/>
<path class="moe-st10" d="M179.9,609.6c-2.3,0-4.1,1.8-4,4c0,2.2,1.8,4,4,4c2.2,0,4-1.8,4-4S182.1,609.6,179.9,609.6z"/>
<circle class="moe-st10" cx="488.8" cy="550.7" r="4"/>
<path class="moe-st10" d="M379.5,554.7c2.2,0,4-1.8,4-4s-1.8-4-4-4c-2.3,0-4.1,1.8-4,4C375.5,552.9,377.3,554.7,379.5,554.7z"/>
<path class="moe-st10" d="M475.4,554.7c2.2,0,4-1.8,4-4s-1.8-4-4-4c-2.3,0-4.1,1.8-4,4C471.4,552.9,473.2,554.7,475.4,554.7z"/>
<path class="moe-st10" d="M571.4,565.4h-6.5c-0.4,0-0.7,0.3-0.8,0.7c0,11.8,0,23.5,0,35.3s-5.5,12.2-7.7,13c-2.9,1-2.2,4.3,1.2,3.8
	c5-0.7,14.5-4.3,14.5-20.2c0-12.2,0-19.7,0-31.9C572.1,565.7,571.8,565.4,571.4,565.4z"/>
<circle class="moe-st10" cx="568.3" cy="550.7" r="4"/>
<path class="moe-st10" d="M629.8,565.2h-23.1c-14.2,0-23.3,4.9-23.2,18.7v14.8c0,0.4,0.3,0.7,0.7,0.7h37.7c0.4,0.2,0.8,0.5,0.8,0.9v9
	c-0.1,2.2-3.2,4-5,5.5c-1.6,1.4-1.6,2.4,1.8,2.1c4.3-0.4,11.1-5.7,11-10.6v-7.5V592v-26.1C630.5,565.5,630.2,565.2,629.8,565.2z
	 M622.6,592.3c0,0.4-0.4,0.8-0.8,0.8h-29.5c-0.4,0-0.8-0.4-0.8-0.8V582c0-4.6,3.2-10.1,12.2-10.1h18.1c0.4,0,0.8,0.4,0.8,0.8V592.3z
	"/>
<path class="moe-st10" d="M549.1,546.6h-6.5c-0.4,0-0.7,0.4-0.7,0.8V599c0,0.4,0.3,0.7,0.7,0.7h6.5c0.4,0,0.7-0.3,0.7-0.7v-51.7
	C549.8,546.9,549.5,546.6,549.1,546.6z"/>
<path class="moe-st10" d="M426.6,546.6h-6.5c-0.3,0-0.7,0.4-0.7,0.8V599c0,0.4,0.3,0.7,0.7,0.7h6.5c0.4,0,0.7-0.3,0.7-0.7v-51.7
	C427.3,546.9,427,546.6,426.6,546.6z"/>
<path class="moe-st10" d="M527.7,565.4h-6.5c-0.4,0-0.7,0.3-0.8,0.7c0,11.8,0,23.5,0,35.3s-5.5,12.2-7.7,13c-2.9,1-2.2,4.3,1.2,3.8
	c5-0.7,14.5-4.3,14.5-20.2c0-12.2,0-19.7,0-31.9C528.4,565.7,528.1,565.4,527.7,565.4z"/>
<path class="moe-st10" d="M503.2,565.4h-23.1c-14.2,0-23.3,4.9-23.2,18.7v14.8c0,0.4,0.3,0.7,0.7,0.7c15.2,0,30.4,0,45.6,0
	c0.4,0,0.7-0.3,0.7-0.7v-32.8C503.9,565.7,503.6,565.4,503.2,565.4z M495.9,592.3c0,0.4-0.4,0.8-0.8,0.8h-29.5
	c-0.4,0-0.8-0.4-0.8-0.8V582c0-4.6,3.2-10.1,12.2-10.1h18.1c0.4,0,0.8,0.4,0.8,0.8V592.3z"/>
<path class="moe-st10" d="M405.4,546.5H399c-0.4,0-0.7,0.3-0.7,0.7V591c0,0.4-0.3,0.7-0.7,0.7h-20.1c-0.4,0-0.7-0.3-0.7-0.7v-25.1
	c0-0.4-0.3-0.7-0.7-0.7h-6.5c-0.4,0-0.7,0.3-0.7,0.7V591c0,0.4-0.3,0.7-0.7,0.7H286c-0.4,0-0.8-0.4-0.8-0.8V582
	c0-4.6,3.2-10.2,12.2-10.2h33.3c0.4,0,0.7-0.3,0.7-0.7V566c0-0.4-0.3-0.7-0.7-0.7h-30.3c-14.2,0-23.3,4.9-23.2,18.7v6.9
	c0,0.4-0.3,0.7-0.7,0.7h-66.8c-0.4,0-0.7-0.3-0.7-0.7V547c0-0.4-0.3-0.7-0.7-0.7h-6.5c-0.4,0-0.7,0.3-0.7,0.7v44
	c0,0.4-0.3,0.7-0.7,0.7h-22.5c-0.4,0-0.7-0.3-0.7-0.7v-24.6c0-0.4-0.3-0.7-0.7-0.7H170c-0.4,0-0.7,0.3-0.7,0.7V591
	c0,0.4-0.3,0.7-0.7,0.7H154c-0.4,0-0.7-0.3-0.7-0.7v-6.9c0.1-13.8-9-18.7-23.2-18.7h-28.5c-0.4,0-0.7,0.3-0.7,0.7v43.2h0.1
	c-0.1,2.2-3.2,4-5,5.5c-1.6,1.4-1.6,2.4,1.8,2.1c4.3-0.4,11.1-5.7,11-10.6v-6.8h43.7h252.9c0.4,0,0.7-0.3,0.7-0.7v-51.6
	C406.1,546.8,405.8,546.5,405.4,546.5z M145.4,590.9c0,0.4-0.3,0.8-0.8,0.8h-34.9c-0.4,0-0.8-0.4-0.8-0.8v-18.2
	c0-0.4,0.4-0.8,0.8-0.8h23.5c9,0,12.2,5.5,12.2,10.1V590.9z"/>
</svg>`;

let EXAM_SRC = { mc: [], tf: [], label: '' };

/* ══ حفظ بيانات ترويسة الاختبار ══
   تحفظ محليًا حتى لا يضطر المعلم لإعادة كتابة بيانات المدرسة/الصف/الوقت كل مرة. */
const K_EXAM_HEADER = 'hwapp_exam_header_v1';
const EXAM_HEADER_TEXT_IDS = ['ex-subject','ex-grade','ex-time','ex-date','ex-office','ex-dept','ex-school'];
const EXAM_HEADER_CHECK_IDS = ['ex-show-subject','ex-show-grade','ex-show-time','ex-show-date','ex-show-office','ex-show-dept','ex-show-school'];
const EXAM_HEADER_EXTRA_IDS = ['ex-logo-size'];

function readExamHeaderSaved(){
  try{
    const v = JSON.parse(localStorage.getItem(K_EXAM_HEADER) || '{}');
    return v && typeof v === 'object' ? v : {};
  }catch(e){ return {}; }
}

function saveExamHeaderNow(showToast=true){
  const data = { fields:{}, checks:{}, extras:{} };
  EXAM_HEADER_TEXT_IDS.forEach(id=>{
    const el=document.getElementById(id);
    if(el) data.fields[id]=el.value ?? '';
  });
  EXAM_HEADER_CHECK_IDS.forEach(id=>{
    const el=document.getElementById(id);
    if(el) data.checks[id]=!!el.checked;
  });
  EXAM_HEADER_EXTRA_IDS.forEach(id=>{
    const el=document.getElementById(id);
    if(el) data.extras[id]=el.value ?? '';
  });
  try{
    localStorage.setItem(K_EXAM_HEADER, JSON.stringify(data));
    if(showToast) toast('تم حفظ بيانات الترويسة','good');
    return true;
  }catch(e){
    console.warn('saveExamHeaderNow:',e);
    if(showToast) toast('تعذر حفظ بيانات الترويسة','bad');
    return false;
  }
}

function loadExamHeaderSaved(){
  const data = readExamHeaderSaved();
  const fields = data.fields || {};
  const checks = data.checks || {};
  const extras = data.extras || {};

  EXAM_HEADER_TEXT_IDS.forEach(id=>{
    const el=document.getElementById(id);
    if(el && Object.prototype.hasOwnProperty.call(fields,id)) el.value = String(fields[id] ?? '');
  });
  EXAM_HEADER_CHECK_IDS.forEach(id=>{
    const el=document.getElementById(id);
    if(el && Object.prototype.hasOwnProperty.call(checks,id)) el.checked = !!checks[id];
  });
  EXAM_HEADER_EXTRA_IDS.forEach(id=>{
    const el=document.getElementById(id);
    if(el && Object.prototype.hasOwnProperty.call(extras,id)) el.value = String(extras[id] ?? '');
  });
}

function bindExamHeaderAutosave(){
  [...EXAM_HEADER_TEXT_IDS, ...EXAM_HEADER_CHECK_IDS, ...EXAM_HEADER_EXTRA_IDS].forEach(id=>{
    const el=document.getElementById(id);
    if(!el || el.__examHeaderBound) return;
    el.__examHeaderBound = true;
    const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(ev, ()=>saveExamHeaderNow(false));
  });
}

/* ⚙️ اختيارات المعلم المعتادة (القالب، الأعداد، الدرجة، النماذج، الخط…) تُحفظ تلقائيًا عند تغييرها
   وتُستعاد عند فتح الصفحة — مرة واحدة لكل تحميل، فلا تطغى على اختبار محفوظ فتحه المعلم ثم عاد للتبويب */
const K_EXAM_PREFS = 'hwapp_exam_prefs_v1';
const EXAM_PREF_IDS = ['ex-tpl','ex-nmc','ex-ntf','ex-nmt','ex-mark','ex-model-count','ex-teacher','ex-font','ex-size'];
const EXAM_PREF_CHECKS = ['ex-omr-marks','ex-shuffle','ex-hindi','ex-fill-bank'];
function saveExamPrefs(){
  const v = {}, c = {};
  EXAM_PREF_IDS.forEach(id => { const el = document.getElementById(id); if(el) v[id] = el.dataset.keep !== undefined ? el.dataset.keep : el.value; });   // المعطّل في «المصمَّم» يحفظ قيمة المعلم لا مجموع التصميم
  EXAM_PREF_CHECKS.forEach(id => { const el = document.getElementById(id); if(el) c[id] = !!el.checked; });
  try{ localStorage.setItem(K_EXAM_PREFS, JSON.stringify({ v, c, at:Date.now() })); }catch(e){}
}
function loadExamPrefs(){
  let P = null; try{ P = JSON.parse(localStorage.getItem(K_EXAM_PREFS) || 'null'); }catch(e){}
  if(!P || typeof P !== 'object') return;
  Object.entries(P.v || {}).forEach(([id, val]) => { const el = document.getElementById(id); if(!el || !EXAM_PREF_IDS.includes(id)) return;
    if(el.tagName === 'SELECT' && ![...el.options].some(o => o.value === String(val))) return;      // قالب أُلغي مثلًا
    el.value = String(val ?? ''); delete el.dataset.keep; });
  Object.entries(P.c || {}).forEach(([id, on]) => { const el = document.getElementById(id); if(el && EXAM_PREF_CHECKS.includes(id)) el.checked = !!on; });
  try{ examModelsChanged(); }catch(e){}
}
function bindExamPrefsAutosave(){
  [...EXAM_PREF_IDS, ...EXAM_PREF_CHECKS].forEach(id => {
    const el = document.getElementById(id); if(!el || el.__exPrefBound) return; el.__exPrefBound = true;
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => setTimeout(saveExamPrefs, 0));   // بعد معالجات القالب
  });
}

function examInit(){
  ensureLogo();
  const sel = document.getElementById('ex-hw');
  if(sel){
    const list = examHwList(), ok = new Set(list.map(h => String(h.id)));
    let ids = examHwIds().filter(id => ok.has(id));
    // لا تحديد افتراضي: المعلم يختار النشاط بنفسه (كان أول نشاط يُحدَّد تلقائيًا كلما فُتحت الصفحة)
    sel.value = ids.join(',');
  }
  examHwRenderPick();
  syncExamHwBank();
  const fill = (id, v) => { const el=document.getElementById(id); if(el && !el.value) el.value = v || ''; };
  fill('ex-subject', rcGet('subject') || 'العلوم');
  fill('ex-dept', rcGet('dept') || 'الإدارة العامة للتعليم بالمنطقة الشرقية');
  fill('ex-school', rcGet('school') || '');
  fill('ex-office', rcGet('office') || '');
  if(!window._exsInit){ window._exsInit = true; try{ examStepsInit(); }catch(e){} }
  fill('ex-teacher', rcGet('teacher') || '');
  loadExamHeaderSaved();
  bindExamHeaderAutosave();
  if(!window._exPrefsInit){ window._exPrefsInit = true; try{ loadExamPrefs(); }catch(e){} }
  bindExamPrefsAutosave();
  syncExamPrintAllButton();
  examBuild();
}

let EXAM_JSON_BANK = { mc:[], tf:[], label:'', raw:null };
let EXAM_HW_BANK = { id:'', title:'', mc:[], tf:[] };

function examHwBankAll(){ return [...(EXAM_HW_BANK.mc||[]), ...(EXAM_HW_BANK.tf||[])]; }
function examHwSelected(){
  return {
    mc:(EXAM_HW_BANK.mc||[]).filter(q=>q.selected!==false),
    tf:(EXAM_HW_BANK.tf||[]).filter(q=>q.selected!==false)
  };
}
function examModelsBarInto(listId, bank){
  const list=document.getElementById(listId); if(!list) return;
  let bar=document.getElementById(listId+'-models');
  if(!bar){ bar=document.createElement('div'); bar.id=listId+'-models'; list.parentNode.insertBefore(bar,list); }
  bar.innerHTML=examModelsBar(bank);
}
/* 🏷️ وسوم بنك الأسئلة: «📏 طويل» (يُقاس كما يُطبع بعمود واحد) و«🔁 متشابه» (مع رقم شبيهه)، وعرض نموذج بعينه
   بالتوزيع نفسه الذي يُطبع به — فيرى المعلم ما في النموذج (أ) وما يتشابه أو يطول فيه */
const EX_LONG_CACHE = new WeakMap();
/* 📐 أربعة خيارات في سطر واحد؟ يُقاس كل سؤال كما يُطبع (الخط والمقاس نفسهما): يُعتمد السطر الواحد إن لم يلتف أي خيار،
   وإلا خياران في السطر. كان الحكم بعدد الحروف: ٢٢ يلتف أحيانًا، و١٦ يرسل أسئلة كثيرة إلى سطرين فلا تتسع الورقة */
const EX_FOUR_CACHE = new Map();   // بالنص لا بالكائن: الأسئلة تُبنى من جديد مع كل فتح، فكان القياس يُعاد كاملًا كل مرة
function examFourFits(qs, font, size, fit){
  if(EX_FOUR_CACHE.size > 6000) EX_FOUR_CACHE.clear();
  const out = new Set(), sig = q => [font, size, fit || 0, ...(q.o || [])].join('\u0001');
  const need = qs.filter(q => { const c = EX_FOUR_CACHE.get(sig(q)); if(c !== undefined){ if(c) out.add(q); return false; } return true; });
  if(!need.length) return out;
  let box = document.getElementById('exam-measure-q');
  if(!box){ box = document.createElement('div'); box.id = 'exam-measure-q'; document.body.appendChild(box); }
  box.style.cssText = 'position:absolute;left:-10000px;top:0;width:210mm;visibility:hidden;pointer-events:none;zoom:1';
  box.innerHTML = `<div class="exam-page" data-font="${esc(font)}" data-size="${esc(size)}" data-auto="1"${fit ? ` data-fit="${fit}"` : ''} style="height:auto;box-shadow:none"><div class="ex-sec">${need.map((q, i) =>
    `<div class="ex-q" data-k="${i}"><div class="ex-qt"><span class="ex-num">1</span><span>.</span></div><div class="ex-opts four">${(q.o || []).map(o => `<div class="ex-opt"><span class="ex-box"></span><span class="ex-ltr">أ</span><span class="exm-o">${escExamText(o)}</span></div>`).join('')}</div></div>`).join('')}</div></div>`;
  let fs0 = 0;   // كل الخيارات بالخط والمقاس نفسيهما: يكفي حسابه مرة
  box.querySelectorAll('[data-k]').forEach(el => { const q = need[+el.dataset.k];
    const ok = [...el.querySelectorAll('.exm-o')].every(o => { const r = document.createRange(); r.selectNodeContents(o); const fs = fs0 || (fs0 = parseFloat(getComputedStyle(o).fontSize) || 12);
      const tops = [...r.getClientRects()].filter(b => b.width > 1).map(b => b.top); return !tops.length || Math.max(...tops) - Math.min(...tops) < fs * 0.6; });
    EX_FOUR_CACHE.set(sig(q), ok); if(ok) out.add(q); });
  box.innerHTML = '';
  return out;
}
function examLongIntrinsic(items){
  const out = new Map(), tpl = examTpl(), font = document.getElementById('ex-font')?.value || 'trad', size = document.getElementById('ex-size')?.value || 'm';
  const sig = x => [tpl, font, size, x.q, ...(x.o || [])].join('\u0001');
  const need = items.filter(x => { const c = EX_LONG_CACHE.get(x); if(c && c.sig === sig(x)){ if(c.why) out.set(x, c.why); return false; } return true; });
  if(!need.length) return out;
  let box = document.getElementById('exam-measure-q');
  if(!box){ box = document.createElement('div'); box.id = 'exam-measure-q'; document.body.appendChild(box); }
  box.style.cssText = 'position:absolute;left:-10000px;top:0;width:210mm;visibility:hidden;pointer-events:none;zoom:1';
  const L4 = ['أ','ب','ج','د'], F4 = tpl === 't5' ? examFourFits(need.filter(x => x.kind !== 'tf'), font, size) : null;
  box.innerHTML = `<div class="exam-page" data-font="${esc(font)}" data-size="${esc(size)}"${tpl === 't5' ? ' data-auto="1"' : ''} style="height:auto;box-shadow:none"><div class="ex-sec">${need.map((x, i) => x.kind === 'tf'
    ? `<div class="ex-tf" data-k="${i}"><span class="ex-num">1</span><span class="exm-t">${escExamText(x.q)}</span><span class="ex-tf-c"><span class="ex-box"></span> صح</span><span class="ex-tf-c"><span class="ex-box"></span> خطأ</span></div>`
    : `<div class="ex-q" data-k="${i}"><div class="ex-qt"><span class="ex-num">1</span><span class="exm-t">${escExamText(x.q)}</span></div><div class="ex-opts${F4 && F4.has(x) ? ' four' : ''}">${(x.o || []).map((o, j) => `<div class="ex-opt"><span class="ex-box"></span><span class="ex-ltr">${L4[j] || ''}</span><span class="exm-o">${escExamText(o)}</span></div>`).join('')}</div></div>`).join('')}</div></div>`;
  const lines = el => { if(!el || !el.textContent.trim()) return 0; const r = document.createRange(); r.selectNodeContents(el);
    const tops = [...r.getClientRects()].filter(b => b.width > 1).map(b => b.top).sort((a, b) => a - b), fs = parseFloat(getComputedStyle(el).fontSize) || 12;
    let n = 0, last = -1e9; tops.forEach(t => { if(t - last > fs * 0.6){ n++; last = t; } }); return n; };
  box.querySelectorAll('[data-k]').forEach(el => { const x = need[+el.dataset.k], why = [];
    const n = lines(el.querySelector('.exm-t'));
    if(x.kind === 'tf'){ if(n >= 2) why.push(n === 2 ? 'العبارة في سطرين' : `العبارة في ${n} أسطر`); }
    else { if(n >= 3) why.push(`السؤال في ${n} أسطر`); const w = [...el.querySelectorAll('.exm-o')].filter(o => lines(o) >= 2).length; if(w) why.push(w === 1 ? 'خيار في سطرين' : `${w} خيارات في سطرين`); }
    const v = why.join(' · '); EX_LONG_CACHE.set(x, { sig:sig(x), why:v }); if(v) out.set(x, v); });
  box.innerHTML = '';
  return out;
}
/* محتوى كل نموذج كما يبنيه examBuild (البذرة والمصدر نفسهما) */
function examBankModels(bank){
  const n = examModelCount(); if(n < 2) return null;
  const src = document.getElementById('ex-src')?.value || 'hw', N = examNeed();
  let mc, tf, label;
  if(bank === 'hw'){ const p = examHwSelected(); mc = p.mc; tf = p.tf; label = EXAM_HW_BANK.title || ''; }
  else { const useSel = document.getElementById('ex-use-selected')?.checked; const p = useSel ? examJsonSelected() : { mc:EXAM_SRC.mc || [], tf:EXAM_SRC.tf || [] }; mc = p.mc; tf = p.tf; label = EXAM_SRC.label || ''; }
  if(bank === 'hw' && src !== 'hw') return null;
  const seed = `${String((document.getElementById('ex-title')?.value || '').trim() || 'اختبار')}|${String(label || 'source')}|${n}`;
  return { n, M: examSpreadAll(mc, tf, N.nmc, N.ntf, n, seed).M };
}
function examBankDecorate(bank, all, filtered){
  const viewEl = document.getElementById(bank === 'hw' ? 'ex-hw-bank-view' : 'ex-bank-view');
  const MD = examBankModels(bank), nM = MD ? MD.n : 1;
  if(viewEl){ const cur = viewEl.value || 'all';
    viewEl.innerHTML = '<option value="all">كل البنك</option><option value="flag">⚠️ الطويل والمتشابه فقط</option>' + (MD ? MD.M.map((_, m) => `<option value="m${m}">نموذج ${examModelLetter(m)}</option>`).join('') : '');
    viewEl.value = [...viewEl.options].some(o => o.value === cur) ? cur : 'all'; }
  const view = viewEl ? viewEl.value : 'all', mi = /^m(\d)$/.test(view) ? +view.slice(1) : -1;
  const inModel = mi >= 0 && MD ? [...MD.M[mi].mc, ...MD.M[mi].tf] : null;
  const scope = inModel || all.filter(x => x.selected !== false);
  const longs = examLongIntrinsic(scope);
  // التشابه: داخل النموذج المعروض، أو بين الأسئلة المحددة في البنك كله
  const sim = new Map(), num = x => all.indexOf(x) + 1;
  for(let i = 0; i < scope.length; i++) for(let j = i + 1; j < scope.length; j++) if(scope[i] !== scope[j] && exSimClash(scope[i], scope[j])){
    (sim.get(scope[i]) || sim.set(scope[i], []).get(scope[i])).push(num(scope[j])); (sim.get(scope[j]) || sim.set(scope[j], []).get(scope[j])).push(num(scope[i])); }
  const shared = new Set(); if(MD){ const seen = new Map(); MD.M.forEach(m => [...m.mc, ...m.tf].forEach(x => seen.set(x, (seen.get(x) || 0) + 1))); seen.forEach((c, x) => { if(c > 1) shared.add(x); }); }
  let list = filtered;
  if(inModel){ const set = new Set(inModel); list = filtered.filter(x => set.has(x)); }
  else if(view === 'flag') list = filtered.filter(x => longs.has(x) || sim.has(x));
  const tags = x => `${longs.has(x) ? `<span class="qtype exq-long" title="${esc(longs.get(x))}">📏 طويل</span>` : ''}${sim.has(x) ? `<span class="qtype exq-sim" title="يشبه السؤال ${sim.get(x).join('، ')}">🔁 يشبه ${sim.get(x).map(k => '#' + k).join(' ')}</span>` : ''}${inModel && shared.has(x) ? '<span class="qtype exq-shared" title="البنك لا يكفي كل النماذج فتكرر في نموذج آخر">↔ مشترك</span>' : ''}`;
  const nl = scope.filter(x => longs.has(x)).length, ns = scope.filter(x => sim.has(x)).length;
  const summary = inModel
    ? `<div class="exq-sum">📄 <b>نموذج ${examModelLetter(mi)}</b>: ${MD.M[mi].mc.length} اختيار + ${MD.M[mi].tf.length} صح/خطأ · ${ns ? `<b class="w">🔁 ${ns} متشابهة فيه</b>` : '🔁 لا تشابه فيه'} · ${nl ? `<b class="w">📏 ${nl} طويلة</b>` : '📏 لا طويل'}${MD.M[mi].mc.concat(MD.M[mi].tf).some(x => shared.has(x)) ? ' · ↔ فيه أسئلة مشتركة مع نموذج آخر' : ''}</div>`
    : (nl || ns) && view !== 'flag' ? `<div class="exq-sum">${ns ? `<b class="w">🔁 ${ns} متشابهة</b>` : ''}${ns && nl ? ' · ' : ''}${nl ? `<b class="w">📏 ${nl} طويلة</b>` : ''} <button type="button" class="exq-sum-go" onclick="examBankViewSet('${bank}','flag')">اعرضها وحدها ←</button></div>`
    : view === 'flag' ? `<div class="exq-sum">⚠️ الطويل والمتشابه فقط <button type="button" class="exq-sum-go" onclick="examBankViewSet('${bank}','all')">كل البنك ←</button></div>` : '';
  return { list, tags, summary };
}
function renderExamHwBank(){
  const wrap=document.getElementById('ex-hw-bank');
  const list=document.getElementById('ex-hw-bank-list');
  if(!wrap||!list) return;
  examModelsBarInto('ex-hw-bank-list','hw');
  wrap.style.display = (document.getElementById('ex-src')?.value||'hw')==='hw' && examHwIds().length ? '' : 'none';   // لا بنك قبل اختيار نشاط
  const all=examHwBankAll();
  const c=document.getElementById('ex-hw-bank-count');
  if(!all.length){
    if(c) c.textContent='0 محدد من 0';
    list.innerHTML=`<div class="exam-bank-empty">${examHwIds().length?'لا توجد أسئلة اختيار متعدد أو صح/خطأ في الأنشطة المحددة.':'اختر نشاطًا أو أكثر من القائمة أعلاه.'}</div>`;
    return;
  }
  const q=(document.getElementById('ex-hw-bank-search')?.value||'').trim().toLowerCase();
  const f=document.getElementById('ex-hw-bank-filter')?.value||'all';
  const filtered=all.filter(x=>{
    const type=x.kind==='tf'?'tf':'mc';
    const txt=String(x.q||'').toLowerCase();
    return (f==='all'||f===type) && (!q||txt.includes(q));
  });
  const selCount=all.filter(x=>x.selected!==false).length;
  if(c) c.textContent=`${selCount} محدد من ${all.length}`;
  const dupN=EXAM_HW_BANK.dup||0;
  if(c) c.title=dupN?`${dupN} ${dupN===1?'سؤال مكرر':'أسئلة مكررة'} بين الأنشطة لم ${dupN===1?'يُضف':'تُضف'}`:'';
  if(c&&dupN) c.textContent+=` · 🔁 ${dupN} مكرر حُذف`;
  const sb=document.getElementById('ex-hw-sim-btn'); if(sb){ let g=0, all=0; try{ const G=examHwSimGroups(); all=G.length; g=G.filter(x=>x.filter(y=>y.on).length>1).length; }catch(e){} sb.textContent=g?`🔁 المتشابهة (${g})`:all?'🔁 المتشابهة ✓':'🔁 المتشابهة'; sb.classList.toggle('warn',g>0); sb.title=g?`${g} ${g===1?'مجموعة':'مجموعات'} فيها أكثر من سؤال بنفس الفكرة`:(all?'راجعت المتشابهة — كل مجموعة بقي منها سؤال واحد أو اخترت إبقاءها':'لا أسئلة متشابهة'); }
  const DEC=examBankDecorate('hw',all,filtered);
  if(!DEC.list.length){ list.innerHTML=DEC.summary+'<div class="exam-bank-empty">لا توجد أسئلة مطابقة.</div>'; return; }
  list.innerHTML=DEC.summary+DEC.list.map(x=>{
    const idx=all.indexOf(x);
    const type=x.kind==='tf'?'صح / خطأ':'اختيار متعدد';
    return `<label class="exam-bank-item">
      <input type="checkbox" ${x.selected!==false?'checked':''} onchange="toggleExamHwQuestion(${idx},this.checked)">
      <span class="qtxt"><span class="qnum">${idx+1}.</span> ${escExamText(x.q)}<span class="qmeta"><span class="qtype">${x.kind==='tf'?'صح/خطأ':'اختيار'}</span>${x.edited?'<span class="qtype exq-tag">✏️ معدّل</span>':''}${DEC.tags(x)}${EXAM_HW_BANK.multi&&x.src?`<span class="qtype qsrc" title="${esc(x.src)}">📚 ${esc(x.src)}</span>`:''}</span></span>
      <span class="qside">${examModelSel('hw',idx,x)}<button type="button" class="exq-edi" title="تعديل السؤال" aria-label="تعديل السؤال" onclick="event.preventDefault();event.stopPropagation();examQEdit('hw',${idx})">✏️</button></span>
    </label>`;
  }).join('');
}

function examJsonBankAll(){ return [...(EXAM_JSON_BANK.mc||[]), ...(EXAM_JSON_BANK.tf||[])]; }
function examJsonSelected(){
  const mc=(EXAM_JSON_BANK.mc||[]).filter(q=>q.selected!==false);
  const tf=(EXAM_JSON_BANK.tf||[]).filter(q=>q.selected!==false);
  return {mc,tf};
}
function renderExamJsonBank(){
  const wrap=document.getElementById('ex-json-bank');
  const list=document.getElementById('ex-bank-list');
  if(!wrap||!list) return;
  const fbox=document.getElementById('ex-json-files');
  if(fbox){
    const fs=EXAM_JSON_BANK.files||[];
    const cnt=n=>[...EXAM_JSON_BANK.mc,...EXAM_JSON_BANK.tf].filter(q=>q.src===n).length;
    fbox.innerHTML=fs.length&&(document.getElementById('ex-src')?.value||'json')==='json'
      ? fs.map(n=>`<span class="exjf-chip">📄 ${esc(n)} <b>${cnt(n)}</b>${fs.length>1?`<button type="button" title="إزالة أسئلة هذا الملف" aria-label="إزالة" onclick="examJsonRemoveFile(${esc(JSON.stringify(n))})">✕</button>`:''}</span>`).join('') : '';
  }
  examModelsBarInto('ex-bank-list','json');

  const source=document.getElementById('ex-src')?.value || 'json';
  const title=document.getElementById('ex-bank-title');
  const desc=document.getElementById('ex-bank-desc');
  if(title) title.textContent = source==='ai' ? '✦ بنك أسئلة مولد الذكاء' : '📚 بنك أسئلة ملف JSON';
  if(desc) desc.textContent = source==='ai'
    ? 'اختر الأسئلة المولدة بالذكاء التي تريد إدخالها في الاختبار، ثم صدّر البنك عند الحاجة.'
    : 'حدد الأسئلة التي تريد إدخالها في الاختبار، ثم صدّر البنك عند الحاجة.';
  wrap.style.display = source==='json' || source==='ai' ? '' : 'none';   // مصدر «بنك نشاط»: لا يظهر بنك الملف (كان يظهر عند تغيير عدد النماذج)
  if(!(EXAM_JSON_BANK.mc.length||EXAM_JSON_BANK.tf.length)){
    const c=document.getElementById('ex-bank-count'); if(c) c.textContent='0 محدد من 0';
    const isAI=(document.getElementById('ex-src')?.value||'json')==='ai';
    list.innerHTML=isAI
      ? '<div class="exam-bank-empty">✦ لم يتم توليد أسئلة بعد. استخدم زر «توليد أسئلة الاختبار بالذكاء» أعلاه.</div>'
      : '<div class="exam-bank-empty">📥 اختر ملف JSON من الأعلى لعرض بنك الأسئلة وتحديد الفقرات التي تريدها في الاختبار.</div>';
    return;
  }
  const q=(document.getElementById('ex-bank-search')?.value||'').trim().toLowerCase();
  const f=document.getElementById('ex-bank-filter')?.value||'all';
  const all=examJsonBankAll();
  const filtered=all.filter(x=>{
    const type=(x.kind==='tf'?'tf':'mc');
    const txt=String(x.q||'').toLowerCase();
    return (f==='all'||f===type) && (!q||txt.includes(q));
  });
  const selCount=all.filter(x=>x.selected!==false).length;
  const c=document.getElementById('ex-bank-count'); if(c) c.textContent=`${selCount} محدد من ${all.length}`;
  const DEC=examBankDecorate('json',all,filtered);
  if(!DEC.list.length){ list.innerHTML=DEC.summary+'<div class="exam-bank-empty">لا توجد أسئلة مطابقة.</div>'; return; }
  list.innerHTML=DEC.summary+DEC.list.map(x=>{
    const idx=all.indexOf(x);
    const type=x.kind==='tf'?'صح / خطأ':'اختيار متعدد';
    return `<label class="exam-bank-item">
      <input type="checkbox" ${x.selected!==false?'checked':''} onchange="toggleExamJsonQuestion(${idx},this.checked)">
      <span class="qtxt"><span class="qnum">${idx+1}.</span> ${escExamText(x.q)}<span class="qmeta"><span class="qtype">${x.kind==='tf'?'صح/خطأ':'اختيار'}</span>${x.edited?'<span class="qtype exq-tag">✏️ معدّل</span>':''}${DEC.tags(x)}${EXAM_JSON_BANK.multi&&x.src?`<span class="qtype qsrc" title="${esc(x.src)}">📄 ${esc(x.src)}</span>`:''}</span></span>
      <span class="qside">${examModelSel('json',idx,x)}<button type="button" class="exq-edi" title="تعديل السؤال" aria-label="تعديل السؤال" onclick="event.preventDefault();event.stopPropagation();examQEdit('json',${idx})">✏️</button></span>
    </label>`;
  }).join('');
}

/* 📚 عدة أنشطة في اختبار واحد: المحدد يُحفظ في #ex-hw كمعرّفات مفصولة بفواصل */
function examHwList(){ return HW.filter(h => (h.qs||[]).some(q => q && (q.t==='q' || q.t==='tf' || q.t==='f' || q.t==='m' || q.t==='e'))); }
function examHwIds(){ return String(document.getElementById('ex-hw')?.value || '').split(',').map(s => s.trim()).filter(Boolean); }
function examHwActs(){ const ids = examHwIds(); return ids.map(id => HW.find(x => String(x.id) === id)).filter(Boolean); }
function examHwRenderPick(){
  const box = document.getElementById('ex-hw-pick'); if(!box) return;
  // إعادة الرسم تبدأ القائمة من أولها: نحفظ موضع التمرير فيبقى المعلم عند النشاط الذي حدّده
  const keepTop = box.querySelector('.exhw-list')?.scrollTop || 0;
  const list = examHwList(), on = new Set(examHwIds());
  if(!list.length){ box.innerHTML = '<div class="exam-bank-empty">لا توجد أنشطة فيها بنك أسئلة</div>'; return; }
  const q = String(window._exHwQ || '').trim();
  const cnt = h => { const qs = (h.qs||[]).filter(Boolean); const mc = qs.filter(x => x.t==='q').length, tf = qs.filter(x => x.t==='tf').length, ex = qs.filter(x => ['f','m','e'].includes(x.t)).length;
    return [mc ? `${mc} اختيار` : '', tf ? `${tf} صح/خطأ` : '', ex ? `${ex} أخرى` : ''].filter(Boolean).join(' · '); };
  box.innerHTML = `<div class="exhw-top">
      <input class="inp" type="search" placeholder="🔍 ابحث عن نشاط" value="${esc(q)}" oninput="window._exHwQ=this.value;examHwFilter()">
      <span class="pill pts">${on.size} ${on.size === 1 ? 'نشاط محدد' : 'أنشطة محددة'}</span>
      ${on.size ? `<button type="button" class="btn ghost sm" onclick="examHwSet([])">إلغاء الكل</button>` : ''}
    </div>
    <div class="exhw-list">${list.map(h => `<label class="exhw-item ${on.has(String(h.id)) ? 'on' : ''}" data-t="${esc(h.title||'')}">
      <input type="checkbox" ${on.has(String(h.id)) ? 'checked' : ''} onchange="examHwToggle('${esc(String(h.id))}',this.checked)">
      <span class="exhw-t">${esc(h.title||'نشاط')}</span><span class="exhw-c">${cnt(h)}</span></label>`).join('')}</div>`;
  examHwFilter();
  const L = box.querySelector('.exhw-list'); if(L && keepTop) L.scrollTop = keepTop;
}
function examHwFilter(){
  const q = String(window._exHwQ || '').trim();
  document.querySelectorAll('#ex-hw-pick .exhw-item').forEach(el => { el.style.display = !q || String(el.dataset.t || '').includes(q) ? '' : 'none'; });
}
/* أسئلة الأنشطة المحددة مجتمعة. تُرتَّب بالتناوب بين الأنشطة (١ من الأول، ١ من الثاني…)
   فيأخذ الاختبار من كل نشاط بالتساوي بدل أن يستهلك النشاط الأول وحده. ويُحفظ ما ألغيته من أسئلة عند إضافة نشاط آخر. */
/* ✏️ نص سؤال اختصره المعلم من «📏 الطويلة»: يبقى بعد إعادة جمع البنك (بمفتاح السؤال في النشاط) */
const EXAM_HW_EDITS = new Map();
function examHwCollect(withState){
  const acts = examHwActs(), per = acts.map(h => ({ mc:[], tf:[] }));
  const prev = new Map(examHwBankAll().map(x => [x.key, x]));
  acts.forEach((h, k) => (h.qs||[]).forEach((q, i) => {
    if(!q) return;
    const key = String(h.id) + '|' + i, src = h.title || 'نشاط';
    if(q.t==='q' && Array.isArray(q.o) && q.o.filter(Boolean).length>=2)
      per[k].mc.push(withState ? {q:String(q.q||''),o:q.o.map(x=>String(x||'')).slice(0,4),a:Number(q.a)||0,kind:'mc',key,src,selected:prev.has(key)?prev.get(key).selected:true,...(prev.has(key)&&Number.isInteger(prev.get(key).model)?{model:prev.get(key).model}:{})}
                               : { q:String(q.q||''), o:q.o.map(x=>String(x||'')).slice(0,4), a:Number(q.a)||0 });
    else if(q.t==='tf')
      per[k].tf.push(withState ? {q:String(q.q||''),a:q.a===true,kind:'tf',key,src,selected:prev.has(key)?prev.get(key).selected:true,...(prev.has(key)&&Number.isInteger(prev.get(key).model)?{model:prev.get(key).model}:{})}
                               : { q:String(q.q||''), a: q.a === true });
  }));
  // خ15: بعد قصّ الخيارات إلى 4 قد يبقى فهرس الإجابة خارج النطاق (سؤال نافس بخمسة خيارات إجابته الخامس)
  // فيُعاد إلى 0 كما يفعل مسار JSON في examNormalizeSource — وإلا عُرضت إجابة غير موجودة
  per.forEach(p=>p.mc.forEach(x=>{ if(!(x.a>=0&&x.a<x.o.length)) x.a=0; }));
  if(withState) per.forEach(p=>[...p.mc,...p.tf].forEach(x=>{ const e=EXAM_HW_EDITS.get(x.key); if(e) examQApplyEdit(x, e); }));
  // 🔁 السؤال نفسه في أكثر من نشاط (أو مرتين في النشاط نفسه) يدخل مرة واحدة: النص بعد تطبيع الحروف،
  // ومع الخيارات في الاختيار من متعدد («أي مما يلي صحيح؟» بخيارات مختلفة سؤالان مختلفان)
  const seen = new Set(); let dup = 0;
  const qKey = (x, t) => t + '|' + rdNormAr(x.q) + (t === 'mc' ? '|' + x.o.map(rdNormAr).sort().join('|') : '');
  const weave = t => { const out = [], max = Math.max(0, ...per.map(p => p[t].length)); for(let i = 0; i < max; i++) per.forEach(p => { const x = p[t][i]; if(!x) return; const k = qKey(x, t); if(seen.has(k)){ dup++; return; } seen.add(k); out.push(x); }); return out; };
  return { mc:weave('mc'), tf:weave('tf'), dup, title:acts.map(h => h.title || 'نشاط').join(' + '), acts };
}
/* 🔁 الأسئلة المتشابهة بين الأنشطة المحددة: نفس الفكرة بصيغة أخرى أو بنوع آخر (اختيار ↔ صح/خطأ ↔ زوج وصل).
   المقارنة بالكلمات ذات المعنى بعد التطبيع (بلا «ال» وحروف العطف والكلمات الشائعة مثل ما/هي/التي/أي مما يلي)،
   للسؤال وحده وللسؤال مع إجابته الصحيحة، والأعلى يُعتمد. المعلم يرى المجموعات ويختار ما يبقى — لا حذف تلقائي */
let EXAM_HW_MPOFF = new Set();            // أزواج وصل استبعدها المعلم (تُحترم في حفظ JSON)
const EX_SIM_STOP = new Set('ما ماذا هي هو هم التي الذي الذين في من على عن الي الى اي مما يلي ياتي الاتيه الاتي كم تساوي عند المقصود ب و او ان لا هل تعد يعد تعرف يعرف بانها بانه ذلك هذه هذا لذلك فان فما كل له لها جسم الجسم'.split(' '));
function exSimTokens(t){
  return rdNormAr(String(t ?? '').replace(/[٫,]/g, '.')).replace(/[÷×+=\-/]/g, ' ').split(' ').filter(w => w && !EX_SIM_STOP.has(w))
    .map(w => { w = w.replace(/^(وال|بال|كال|فال|لل|ال)/, ''); return w.length > 4 ? w.replace(/(ات|ون|ين|ها|ه)$/, '') : w; }).filter(w => w.length > 1);
}
function exSimJac(a, b){ const A = new Set(a), B = new Set(b); let n = 0; A.forEach(x => { if(B.has(x)) n++; }); return n / ((A.size + B.size - n) || 1); }
function examHwSimItems(){
  const out = [], bank = new Map(examHwBankAll().map(x => [x.key, x]));
  examHwActs().forEach(h => (h.qs || []).forEach((q, i) => {
    if(!q) return; const key = String(h.id) + '|' + i, src = h.title || 'نشاط';
    if(q.t === 'q' || q.t === 'tf'){ const b = bank.get(key); if(!b) return;
      // النص من بنك الاختبار (بعد تعديل المعلم إن وُجد)، لا من النشاط
      const ans = q.t === 'q' ? String((b.o || [])[Number(b.a) || 0] || '') : '';
      out.push({ key, kind: q.t === 'q' ? 'mc' : 'tf', src, q: String(b.q || ''), ans, tf: b.a === true, on: b.selected !== false, ...(b.edited ? { edited:true } : {}), tq: exSimTokens(b.q), ta: exSimTokens(String(b.q || '') + ' ' + ans) }); }
    else if(q.t === 'm') (q.p || []).forEach((p, k) => { if(!Array.isArray(p) || !p[0] || !p[1]) return; const kk = key + '|' + k;
      out.push({ key: kk, kind: 'mp', src, q: String(p[0]), ans: String(p[1]), on: !EXAM_HW_MPOFF.has(kk), tq: exSimTokens(p[0] + ' ' + p[1]), ta: exSimTokens(p[0] + ' ' + p[1]) }); });
  }));
  return out;
}
function examHwSimGroups(){
  const it = examHwSimItems(), par = it.map((_, i) => i), best = it.map(() => 0);
  const find = i => par[i] === i ? i : (par[i] = find(par[i]));
  for(let a = 0; a < it.length; a++) for(let b = a + 1; b < it.length; b++){
    if(it[a].key.split('|').slice(0, 2).join('|') === it[b].key.split('|').slice(0, 2).join('|')) continue;   // أزواج الوصل الواحد
    const sc = Math.max(exSimJac(it[a].ta, it[b].ta), exSimJac(it[a].tq, it[b].tq));
    if(sc >= 0.55){ par[find(a)] = find(b); best[a] = Math.max(best[a], sc); best[b] = Math.max(best[b], sc); }
  }
  const g = new Map(); it.forEach((x, i) => { if(!best[i]) return; const r = find(i); if(!g.has(r)) g.set(r, []); g.get(r).push({ ...x, sc: best[i] }); });
  return [...g.values()].filter(v => v.length > 1).sort((a, b) => Math.max(...b.map(x => x.sc)) - Math.max(...a.map(x => x.sc)));
}
/* ✏️ تعديل سؤال في بنك الاختبار (صياغة، اختصار، تصحيح الإجابة): يتغير في الاختبار فقط لا في النشاط.
   الأصل يُحفظ في _orig ليُعاد بضغطة، وتعديلات بنك النشاط تبقى بعد إعادة جمعه (EXAM_HW_EDITS بمفتاح السؤال) */
function examQApplyEdit(x, e){
  if(!x._orig) x._orig = { q:x.q, ...(x.o ? { o:x.o.slice() } : {}), a:x.a };
  try{ EX_SIM_TOK.delete(x); }catch(e){}                          // كلمات «المتشابهة» تُحسب من النص الجديد
  x.q = e.q; if(e.o && x.o) x.o = e.o.slice(); if(e.a !== undefined) x.a = e.a;
  if(x.o && !(x.a >= 0 && x.a < x.o.length)) x.a = 0;
  x.edited = true;
}
function syncExamHwBank(){
  const C = examHwCollect(true);
  EXAM_HW_BANK={id:examHwIds().join(','),title:C.title,mc:C.mc,tf:C.tf,dup:C.dup,multi:C.acts.length>1};
  renderExamHwBank();
}

function examSourceFromActivity(){
  const C = examHwCollect(false);
  return { mc:C.mc, tf:C.tf, label:C.title };
}

/* مقاسات A4 بالبكسل عند 96dpi — الأساس الذي يُبنى عليه تقسيم الصفحات */
const EX_MM = 3.779527559;
const EX_PAGE_H = 297 * EX_MM;
const EX_PAD_TOP = 8 * EX_MM, EX_PAD_BOTTOM = 7 * EX_MM;
const EX_INNER_H = EX_PAGE_H - EX_PAD_TOP - EX_PAD_BOTTOM;

function examDigits(v, hindi){
  // درجات الكسور (ربع/نصف درجة للفقرة): بلا ذيول فاصلة عائمة، والفاصلة العشرية العربية «٫» مع الأرقام الهندية
  if(typeof v === 'number' && !Number.isInteger(v)) v = +v.toFixed(2);
  return hindi ? String(v).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]).replace(/(\d|[٠-٩])\.(?=[0-9٠-٩])/g, '$1٫') : String(v);
}
/* درجة الفقرة: ربع درجة فأكثر بخطوات الربع (0.25 · 0.5 · 0.75 · 1 …) */
function examMarkVal(){ const n = Number(String(document.getElementById('ex-mark')?.value ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.max(0.25, Math.min(10, Math.round(n * 4) / 4)) : 1; }

/* يقيس ارتفاع كل فقرة فعليًا بعرض A4 وبلا تصغير، ليأتي التقسيم مطابقًا للورق */
function examMeasure(pageAttrs, html){
  let box = document.getElementById('exam-measure');
  if(!box){ box = document.createElement('div'); box.id = 'exam-measure'; document.body.appendChild(box); }
  box.style.cssText = 'position:absolute;left:-10000px;top:0;width:210mm;visibility:hidden;pointer-events:none;zoom:1';
  box.innerHTML = `<div class="exam-page" ${pageAttrs} style="height:auto;box-shadow:none">${html}</div>`;
  const h = el => { try{ return el.getBoundingClientRect().height || 0; }catch(e){ return 0; } };
  const out = {};
  box.querySelectorAll('[data-mid]').forEach(el => { out[el.getAttribute('data-mid')] = h(el); });
  box.innerHTML = '';          // لا يبقى في الصفحة نسخة قياس تُطبع أو تُحتسب
  return out;
}

/* ═══════════════ 🤖 مولّد أسئلة الاختبار الورقي ═══════════════ */
let EXAM_AI_ACTIVE_PROXY=null;

/* استبدال الاعتماد داخل مولّد الأنشطة عند العمل بوضع الاختبار الورقي */

/* تحويل الأرقام الإنجليزية في محتوى الأسئلة إلى أرقام عربية هندية: 2026 → ٢٠٢٦ */
function toArabicIndicDigits(value){
  if (value === null || value === undefined) return value;
  return String(value)
    // نحافظ على الأس كرمز داخلي حتى يمكن عرضه مرتفعًا، مثل م/ث² → م/ث<sup>٢</sup>
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, function(d){
      const map = {'⁰':'٠','¹':'١','²':'٢','³':'٣','⁴':'٤','⁵':'٥','⁶':'٦','⁷':'٧','⁸':'٨','⁹':'٩'};
      const sup = map[d] || d;
      return '\uE000' + sup + '\uE001';
    })
    .replace(/[0-9]/g, function(d){
      return '٠١٢٣٤٥٦٧٨٩'.charAt(d.charCodeAt(0) - 48);
    });
}

/* عرض النص مع إبقاء الأرقام العلوية مرتفعة: م/ث٢ → م/ث² بصريًا */
/* 🔢 أرقام نص السؤال تُطبع عربية (١٢٣) ولو كُتبت إنجليزية — تتبع خيار «أرقام عربية» (مفعّل افتراضيًا).
   تُستثنى الأرقام الملتصقة بحروف لاتينية (H2O · CO2 · m2) والكسر العشري يصير «٫» */
function examArDigits(t){
  return String(t).replace(/[0-9]+(?:\.[0-9]+)?/g, (m, off, all) => {
    if(/[A-Za-z]/.test(all[off-1] || '') || /[A-Za-z]/.test(all[off+m.length] || '')) return m;
    return m.replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]).replace('.', '٫');
  });
}
function escExamText(value){
  let raw = value == null ? '' : String(value);
  if(document.getElementById('ex-hindi')?.checked !== false) raw = examArDigits(raw);
  let s = esc(raw);
  // الأس يبقى عنصرًا معزولًا حتى لا يعبث اتجاه RTL بمكانه.
  s = s.replace(/\uE000([٠١٢٣٤٥٦٧٨٩])\uE001/g, '<span class="exam-power" dir="ltr">$1</span>');
  s = s.replace(/\\uE000([٠١٢٣٤٥٦٧٨٩])\\uE001/g, '<span class="exam-power" dir="ltr">$1</span>');
  return s;
}

function examDistributedModelSlice(items, perModel, modelIndex, modelCount, seed){
  const pool = Array.isArray(items) ? items.slice() : [];
  const count = Math.max(0, Number(perModel) || 0);
  const index = Math.max(0, Number(modelIndex) || 0);
  const models = Math.max(1, Number(modelCount) || 1);

  if(!pool.length || !count) return [];

  let h = 2166136261 >>> 0;
  const seedText = String(seed);
  for(let i=0;i<seedText.length;i++){
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }

  const rnd = () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for(let i=pool.length-1;i>0;i--){
    const j=Math.floor(rnd()*(i+1));
    [pool[i],pool[j]]=[pool[j],pool[i]];
  }

  const start = index * count;
  return pool.slice(start, start + count);
}

/* 🗂️ توزيع الأسئلة على النماذج: ما ثبّته المعلم لنموذج يذهب إليه أولًا، والباقي (تلقائي)
   يُخلط ببذرة ثابتة ويُقسَّم بالتتابع على حاجة كل نموذج — فلا يتكرر سؤال بين نموذجين ما دام البنك يكفي. */
function examModelValid(x, models){ return x && Number.isInteger(x.model) && x.model >= 0 && x.model < models; }
/* 🔁 الأسئلة المتشابهة المُبقاة لا تجتمع في نموذج واحد: نفس مقياس «المتشابهة» (الكلمات ذات المعنى للسؤال، ومعه إجابته)،
   ويشمل الاختيار والصح/خطأ معًا (فكرة واحدة بنوعين). مع عدة نماذج يُوزَّع كل سؤال على أول نموذج فيه مكان وليس فيه شبيهه؛
   ومع نموذج واحد يُؤخذ غير المتشابه أولًا ولا يُلجأ للشبيه إلا إن لم يكفِ البنك */
const EX_SIM_TOK = new WeakMap();
function exSimTok(x){
  let t = EX_SIM_TOK.get(x); if(t) return t;
  const ans = x && x.kind !== 'tf' && Array.isArray(x.o) ? String(x.o[Number(x.a) || 0] || '') : '';
  t = { q: exSimTokens(x && x.q), a: exSimTokens(String(x && x.q || '') + ' ' + ans) }; EX_SIM_TOK.set(x, t); return t;
}
function exSimClash(x, y){ const a = exSimTok(x), b = exSimTok(y); return Math.max(exSimJac(a.a, b.a), exSimJac(a.q, b.q)) >= 0.55; }
function examSpreadPick(mc, tf, nmc, ntf, idx, models, seed){
  mc = Array.isArray(mc) ? mc : []; tf = Array.isArray(tf) ? tf : [];
  if(models < 2){
    const got = [], pick = (L, n) => { const out = [], later = [];
      for(const x of L){ if(out.length >= n) break; (got.some(y => exSimClash(x, y)) ? later : out).push(x); if(out.includes(x)) got.push(x); }
      for(const x of later){ if(out.length >= n) break; out.push(x); got.push(x); }
      const keep = new Set(out); return L.filter(x => keep.has(x)); };      // ترتيب البنك كما هو
    const m = pick(mc, nmc); return { mc:m, tf:pick(tf, ntf) };
  }
  return examSpreadAll(mc, tf, nmc, ntf, models, seed).M[idx] || { mc:[], tf:[] };
}
/* كل النماذج دفعة واحدة. cap = سعة كل نموذج (افتراضيًا حاجته)؛ fill = إن لم يكفِ البنك يُكمَّل النموذج الناقص
   بأسئلة من نماذج أخرى (الأقل استعمالًا وغير الشبيهة بما فيه) بدل أن يبقى ناقصًا — وتُعدّ في shared ليُنبَّه المعلم */
function examSpreadAll(mc, tf, nmc, ntf, models, seed, opt){
  opt = opt || {}; mc = Array.isArray(mc) ? mc : []; tf = Array.isArray(tf) ? tf : [];
  const cap = { mc: opt.capMc || nmc, tf: opt.capTf || ntf }, usePins = opt.pins !== false;
  const M = Array.from({ length:models }, () => ({ mc:[], tf:[] }));
  const pinOk = x => usePins && examModelValid(x, models);
  const pinned = (L, t) => L.filter(pinOk).forEach(x => { if(M[x.model][t].length < cap[t]) M[x.model][t].push(x); });
  pinned(mc, 'mc'); pinned(tf, 'tf');
  // جولة أولى: كل سؤال في أول نموذج فيه مكان وليس فيه شبيهه (أو أقلها امتلاءً مع balance للتوزيع الظاهر)، ويُؤجَّل ما لا مكان له بلا شبيه؛
  // جولة ثانية: المؤجَّل يملأ ما بقي فقط (البنك لا يكفي) في النموذج الأقل تشابهًا — فالزائد يُترك بدل أن يجاور شبيهه
  const clashes = (m, x) => [...M[m].mc, ...M[m].tf].filter(y => y !== x && exSimClash(x, y)).length;
  const later = { mc:[], tf:[] };
  const open = t => M.map((_, m) => m).filter(m => M[m][t].length < cap[t]);
  const pass1 = (L, t) => examDistributedModelSlice(L.filter(x => !pinOk(x)), L.length, 0, 1, seed + '|' + t).forEach(x => {
    const o = open(t); if(!o.length) return;
    const ok = o.filter(m => !clashes(m, x)); if(!ok.length){ later[t].push(x); return; }
    M[opt.balance ? ok.reduce((b, m) => M[m][t].length < M[b][t].length ? m : b, ok[0]) : ok[0]][t].push(x); });
  const pass2 = t => later[t].forEach(x => {
    const o = open(t); if(!o.length) return;
    M[o.reduce((b, m) => clashes(m, x) < clashes(b, x) ? m : b, o[0])][t].push(x); });
  pass1(mc, 'mc'); pass1(tf, 'tf'); pass2('mc'); pass2('tf');
  const shared = { mc:0, tf:0 };
  if(opt.fill !== false){
    const used = new Map(); M.forEach(m => [...m.mc, ...m.tf].forEach(x => used.set(x, (used.get(x) || 0) + 1)));
    const order = { mc: examDistributedModelSlice(mc, mc.length, 0, 1, seed + '|fill|mc'), tf: examDistributedModelSlice(tf, tf.length, 0, 1, seed + '|fill|tf') };
    ['mc', 'tf'].forEach(t => M.forEach((_, m) => {
      const need = t === 'mc' ? nmc : ntf;
      while(M[m][t].length < need){
        const c = order[t].filter(x => !M[m][t].includes(x)); if(!c.length) break;
        const sc = x => (clashes(m, x) ? 1000 : 0) + (used.get(x) || 0);
        const x = c.reduce((b, y) => sc(y) < sc(b) ? y : b, c[0]);
        M[m][t].push(x); used.set(x, (used.get(x) || 0) + 1); shared[t]++;
      }
    }));
  }
  return { M, shared };
}
/* حاجة كل نموذج من الاختيار والصح/خطأ حسب القالب (نفس حساب examBuild) */
function examNeed(){
  const TPL = examTpl(), num = (id, d) => { const n = Number(document.getElementById(id)?.value); return Number.isFinite(n) ? n : d; };
  return { nmc: TPL === 't1' || TPL === 't5' ? Math.max(0, num('ex-nmc', 5)) : TPL === 't4' ? examFlexCount('mc') : 5,
           ntf: TPL === 't1' || TPL === 't5' ? Math.max(0, num('ex-ntf', 5)) : TPL === 't4' ? examFlexCount('tf') : 5 };
}
function examModelCount(){ return Math.max(1, Math.min(6, Number(document.getElementById('ex-model-count')?.value) || 1)); }
function examModelSel(bank, idx, x){
  const n = examModelCount(); if(n < 2) return '';
  const v = examModelValid(x, n) ? x.model : -1;
  return `<select class="inp exm-sel ${v >= 0 ? 'on' : ''}" title="النموذج الذي يظهر فيه السؤال" aria-label="النموذج" onclick="event.stopPropagation()" onchange="examSetModel('${bank}',${idx},this.value)">
    <option value="-1" ${v < 0 ? 'selected' : ''}>تلقائي</option>${Array.from({length:n}, (_, m) => `<option value="${m}" ${v === m ? 'selected' : ''}>نموذج ${examModelLetter(m)}</option>`).join('')}</select>`;
}
function examBankItems(bank){ return bank === 'hw' ? examHwBankAll() : examJsonBankAll(); }
function examXCounts(n){
  const P = examXPins(), out = Array.from({length:n}, () => ({}));
  let auto = 0;
  examXTypes().forEach(t => examXItems(t).forEach(it => { const v = P[examXKey(t, it)]; if(Number.isInteger(v) && v >= 0 && v < n) out[v][t] = (out[v][t] || 0) + 1; else auto++; }));
  return { out, auto };
}
/* قائمة الأسطر مع نموذج كل سطر — داخل قسم الحقول النصية */
function examXPanel(){
  const n = examModelCount(), types = examXTypes(); if(n < 2 || !types.length) return '';
  const P = examXPins();
  const row = (t, it, i) => {
    const v = P[examXKey(t, it)], on = Number.isInteger(v) && v >= 0 && v < n;
    const txt = t === 'match' ? `${it.a} ← ${it.b}` : t === 'fill' ? it.q : it;
    return `<div class="exx-row"><span class="exx-t">${EX_XT[t].icon} ${esc(String(txt).slice(0, 90))}</span>
      <select class="inp exm-sel ${on ? 'on' : ''}" aria-label="النموذج" onchange="examXSet('${t}',${i},this.value)"><option value="-1" ${on ? '' : 'selected'}>تلقائي</option>${Array.from({length:n}, (_, m) => `<option value="${m}" ${on && v === m ? 'selected' : ''}>نموذج ${examModelLetter(m)}</option>`).join('')}</select></div>`;
  };
  const body = types.map(t => { const items = examXItems(t); return items.length ? `<div class="exx-h">${EX_XT[t].icon} ${EX_XT[t].label} (${items.length})</div>${items.map((it, i) => row(t, it, i)).join('')}` : ''; }).join('');
  return body ? `<details class="exx" ${window._exxOpen ? 'open' : ''} ontoggle="window._exxOpen=this.open"><summary>📌 اختر نموذج كل سطر (اختياري)</summary><div class="exx-list">${body}</div></details>` : '';
}
function examModelsBar(bank){
  const n = examModelCount(); if(n < 2) return '';
  const all = examBankItems(bank).filter(x => x.selected !== false);
  const { nmc, ntf } = examNeed(), mcAll = all.filter(x => x.kind !== 'tf'), tfAll = all.filter(x => x.kind === 'tf');
  // ما سيدخل كل نموذج فعلًا (المثبّت + التلقائي + المُكمَّل)، لا عدد المثبّت فقط
  const R = examSpreadAll(mcAll, tfAll, nmc, ntf, n, 'bar');
  const sim = m => { const L = [...R.M[m].mc, ...R.M[m].tf]; let c = 0; for(let i = 0; i < L.length; i++) for(let j = i + 1; j < L.length; j++) if(L[i] !== L[j] && exSimClash(L[i], L[j])) c++; return c; };
  const per = R.M.map((p, m) => ({ mc:p.mc.length, tf:p.tf.length, sim: sim(m) }));
  const shared = R.shared.mc + R.shared.tf, simN = per.reduce((t, p) => t + p.sim, 0);
  const lack = (h, need) => h < need ? ` <b style="color:#b42318">(${h}/${need})</b>` : '';
  const XC = examXCounts(n);
  const auto = all.filter(x => !examModelValid(x, n)).length + XC.auto;
  return `<div class="exm-bar"><b title="لكل سؤال اختر نموذجه من القائمة بجانبه، أو اتركه «تلقائي» فيُوزَّع على النماذج بلا تكرار. المثبّت يدخل نموذجه أولًا ثم يُكمل الباقي تلقائيًا. اضغط نموذجًا لترى ما فيه.">🗂️ النماذج <span class="exm-i">ⓘ</span></b>
    ${per.map((p, m) => `<span class="exm-chip exm-chip-go" role="button" tabindex="0" title="اعرض ما في هذا النموذج" onclick="examBankShowModel('${bank}',${m})">${examModelLetter(m)}: ${p.mc} اختيار${lack(p.mc, nmc)} · ${p.tf} صح/خطأ${lack(p.tf, ntf)}${p.sim ? ` · <b style="color:#b54708">🔁 ${p.sim} تشابه</b>` : ''}${examXTypes().map(t => ` · ${XC.out[m][t] || 0} ${EX_XT[t].label}`).join('')}</span>`).join('')}
    <span class="exm-chip auto" title="أسئلة بلا نموذج مثبّت — تُوزَّع تلقائيًا">تلقائي: ${auto}</span>
    <span class="exm-acts"><button type="button" class="btn ghost sm" onclick="examModelsAuto('${bank}')" title="يثبّت كل سؤال في نموذج بالتساوي وبلا أسئلة متشابهة في نموذج واحد">⚖️ وزّع</button>
    <button type="button" class="btn ghost sm" onclick="examModelsClear('${bank}')" title="يعيد كل الأسئلة إلى «تلقائي»">مسح</button></span>
    ${shared ? `<div class="exm-warn" title="أسئلة البنك لا تكفي ${n} نماذج كاملة (كل نموذج ${nmc} اختيار + ${ntf} صح/خطأ)، فكُمّلت النماذج بأسئلة مشتركة بين نموذجين. لتجنّب ذلك: أضف أسئلة أو قلّل العدد أو النماذج.">⚠️ البنك لا يكفي: ${shared} ${shared === 1 ? 'سؤال مشترك' : 'أسئلة مشتركة'} بين النماذج <span class="exm-i">ⓘ</span></div>` : ''}
    ${simN ? `<div class="exm-warn" title="تثبيت يدوي غالبًا — «⚖️ وزّع» يفرّقها">🔁 في نموذج واحد أسئلة متشابهة — اضغط «⚖️ وزّع» <span class="exm-i">ⓘ</span></div>` : ''}
</div>`;
}
async function omrApiCall(path, body){
  const api=getApi(), tok=getTok(); if(!api||!tok) throw new Error('noapi');
  const base=api.replace(/\/+$/,'');
  const r = body ? await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:tok,...body})}) : await fetch(base+path+(path.includes('?')?'&':'?')+'t='+encodeURIComponent(tok));
  const j = await r.json(); if(!j || j.ok===false) throw new Error(j&&j.error||'fail'); return j;
}

/* ═══════════ 📄 قالبا الاختبار الورقي ٢ و٣ ═══════════
   القالب ١ (الحالي) لم يتغيّر. القالبان الجديدان ورقتان بلا أي نظام جديد للأسئلة:
     ص١ = الترويسة + ٥ اختيار + ٥ صح/خطأ (نفس بناء القالب ١ حرفيًا، من نفس البنك)
     ص٢ = ٥ وصل + (القالب ٢: ٥ أكمل الفراغ | القالب ٣: «أجب عن كل مما يلي» بعدد ودرجات تحددها)
   أسئلة الوصل والفراغ والمقالي تُدخل في حقول نصية (أو تُسحب من نشاط/JSON فيه أسئلة f و m). */
const EX_ORD = ['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر'];
const EX_LET = ['أ','ب','ج','د','هـ','و','ز','ح'];
const EX_N = 5;                                   // وصل = 5، أكمل الفراغ = 5
const EX_OPEN_MAX = 8;
function examTpl(){ const v = document.getElementById('ex-tpl')?.value; return v === 't4' ? 't4' : 't5'; }
/* بقي قالبان: «ورقة واحدة» (t5) و«مصمَّم» (t4). الاختبار المحفوظ على قالب أُلغي يُفتح على بديله بنفس الأسئلة:
   t1 (٥ + ٥ بلا وصل) ← ورقة واحدة بلا وصل · t2/t3 (ورقتان) ← مصمَّم بنفس الصفحتين والأقسام والدرجات */
/* 📷 الورقة تُصحَّح بالجوال؟ «ورقة واحدة» دائمًا، و«المصمَّم» حسب خياره */
function examOmrOn(){ return examTpl() !== 't4' || document.getElementById('ex-omr-marks')?.checked !== false; }
function examAr2En(s){ return String(s ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/٫/g,'.').replace(/،/g,','); }
function examLines(txt){ return String(txt || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean); }

function examParseMatch(txt){
  const pairs = [], extra = [];
  examLines(txt).forEach(l => {
    let i = l.indexOf('|'); if(i < 0) i = l.indexOf('=');
    if(i < 0) return;
    const a = l.slice(0, i).trim(), b = l.slice(i+1).trim();
    if(a && b) pairs.push({ a, b }); else if(!a && b) extra.push(b);      // سطر يبدأ بـ | = خيار مشتِّت في العمود الثاني
  });
  return { pairs, extra };
}
function examParseFill(txt){
  return examLines(txt).map(l => {
    const i = l.lastIndexOf('|');
    return { q:(i < 0 ? l : l.slice(0, i)).trim(), a:(i < 0 ? '' : l.slice(i+1)).trim() };
  }).filter(x => x.q);
}
function examParseMarks(s){
  return examAr2En(s).split(/[,\s+]+/).map(x => x.trim()).filter(Boolean).map(Number).filter(n => Number.isFinite(n) && n >= 0);
}
/* توزيع درجة القسم على n سؤالًا: أعداد صحيحة إن أمكن (٥ على ٣ ← ٢،٢،١)، وإلا بأنصاف الدرجات */
function examSplitMarks(total, n){
  total = Math.max(0, Number(total) || 0); n = Math.max(1, Math.min(EX_OPEN_MAX, Math.round(n) || 1));
  if(Number.isInteger(total) && total >= n){
    const b = Math.floor(total / n), r = total % n;
    return Array.from({length:n}, (_, i) => b + (i < r ? 1 : 0));
  }
  const H = Math.round(total * 2), b = Math.floor(H / n), r = H - b * n;
  return Array.from({length:n}, (_, i) => (b + (i < r ? 1 : 0)) / 2);
}
function examTplSyncUI(){
  const t = examTpl();
  const show = (id, on) => { const el = document.getElementById(id); if(el) el.style.display = on ? '' : 'none'; };
  const L = t === 't4' ? examFlexLayout() : null, uses = k => !!(L && L.some(pg => pg.some(x => x.t === k)));
  show('ex-flex-ui', t === 't4'); show('ex-omr-marks-f', t === 't4');
  show('ex-extra', t === 't2' || t === 't3' || t === 't5' || (t === 't4' && (uses('match') || uses('fill') || uses('open'))));
  show('ex-extra-fill', t === 't2' || uses('fill')); show('ex-extra-open', t === 't3' || uses('open'));
  show('ex-nmt-f', t === 't5');   // 📷 القالب ٥: عدد أزواج الوصل (مربعات أرقام تُقرأ بالكاميرا)
  const exMatch = document.getElementById('ex-match-txt')?.closest('.field'); if(exMatch) exMatch.style.display = t === 't4' && !uses('match') ? 'none' : '';
  // القالب ٤: عدد أسئلة «أجب» ودرجاتها من تصميم الصفحات، لا من حقول القالب ٣
  const openGrid = document.querySelector('#ex-extra-open > .grid2'); if(openGrid) openGrid.style.display = t === 't4' ? 'none' : '';
  examPullBtnSync();
  const mk = document.getElementById('ex-mark'); if(mk){ mk.disabled = t === 't4'; mk.title = t === 't4' ? 'في القالب المصمَّم لكل قسم درجته' : ''; }
  ['ex-nmc','ex-ntf'].forEach(id => {                 // القالبان ٢ و٣: ٥ + ٥ ثابتة · القالب ٤: مجموع أقسامه
    const el = document.getElementById(id); if(!el) return;
    if(t === 't1' || t === 't5'){ if(el.dataset.keep !== undefined){ el.value = el.dataset.keep; delete el.dataset.keep; } el.disabled = false; }
    else {
      if(el.dataset.keep === undefined) el.dataset.keep = el.value;
      el.value = t === 't4' ? String(examFlexCount(id === 'ex-nmc' ? 'mc' : 'tf')) : '5'; el.disabled = true;
    }
  });
  if(t === 't4') examFlexRenderUI();
  const mh = document.getElementById('ex-extra-models'), MC = Math.max(1, Number(document.getElementById('ex-model-count')?.value) || 1);
  if(mh){ mh.style.display = MC > 1 ? '' : 'none';
    const keepScroll = mh.querySelector('.exx-list')?.scrollTop || 0;
    if(MC > 1){
      const XC = examXCounts(MC);
      mh.innerHTML = `<div style="flex-basis:100%">🗂️ <b>${MC} نماذج:</b> كل حقل أدناه بنكٌ للنماذج. السطر «تلقائي» يُوزَّع بالتتابع (الأولى للنموذج أ ثم ب…)، ويمكنك تثبيت أي سطر على نموذج. زر «⚖️ وزّع تلقائيًا» في بنك الأسئلة يوزّع هذه الأسطر أيضًا.</div>`
        + Array.from({length:MC}, (_, m) => `<span class="exm-chip">نموذج ${examModelLetter(m)}: ${examXTypes().map(t => `${XC.out[m][t] || 0} ${EX_XT[t].label}`).join(' · ')}</span>`).join('')
        + `<span class="exm-chip auto">تلقائي: ${XC.auto}</span>` + examXPanel();
      const lst = mh.querySelector('.exx-list'); if(lst) lst.scrollTop = keepScroll;
    } else mh.innerHTML = ''; }
}

/* ═══════════ 📐 القالب ٤: اختبار مصمَّم ═══════════
   المعلم يحدد الصفحات، وفي كل صفحة أقسامًا بالترتيب: نوع السؤال + العدد + درجة الفقرة.
   المحتوى من المصادر نفسها: الاختيار والصح/خطأ من البنك أعلاه، والوصل والفراغ والمقالي من الحقول النصية،
   ويؤخذ كل نوع بالترتيب عبر أقسامه (قسما فراغ بـ٥ و٣ = أول ٥ أسطر ثم الثلاثة التالية). */
const EX_FLEX_KEY = 'exam_flex_layout_v1';
const EX_FLEX_TYPES = {
  mc:    { label:'اختيار من متعدد', max:20 },
  tf:    { label:'صح أو خطأ', max:20 },
  match: { label:'وصّل', max:8 },
  fill:  { label:'أكمل الفراغ', max:15 },
  open:  { label:'أجب عن كل مما يلي', max:8 },
};
const EX_FLEX_DEFAULT = [[{t:'mc',n:5,m:1},{t:'tf',n:5,m:1}],[{t:'match',n:5,m:1},{t:'open',n:3,m:2}]];
/* تصاميم جاهزة بضغطة (كانت قوالب مستقلة): ورقتان ٢٠ سؤالًا، وورقتان مرنتان، وورقة بسيطة */
const EX_FLEX_PRESETS = [
  { label:'📄📄 ٢٠ سؤالًا', hint:'ورقتان: ٥ اختيار + ٥ صح/خطأ | ٥ وصل + ٥ أكمل الفراغ', L:[[{t:'mc',n:5,m:1},{t:'tf',n:5,m:1}],[{t:'match',n:5,m:1},{t:'fill',n:5,m:1}]] },
  { label:'📄📄 مع «أجب»', hint:'ورقتان: ٥ اختيار + ٥ صح/خطأ | ٥ وصل + ٣ أسئلة «أجب عن كل مما يلي»', L:EX_FLEX_DEFAULT },
  { label:'📄 ورقة واحدة', hint:'ورقة: ٥ اختيار + ٥ صح/خطأ', L:[[{t:'mc',n:5,m:1},{t:'tf',n:5,m:1}]] },
];
function examFlexClean(L){
  if(!Array.isArray(L)) return null;
  const pages = L.slice(0, 6).map(pg => (Array.isArray(pg) ? pg : []).slice(0, 6).map(x => {
    const t = EX_FLEX_TYPES[x && x.t] ? x.t : 'mc';
    const n = Math.max(1, Math.min(EX_FLEX_TYPES[t].max, Math.round(Number(x && x.n) || 1)));
    const m = Math.max(0.25, Math.min(20, Math.round((Number(x && x.m) || 1) * 4) / 4));
    const l = t === 'open' ? Math.max(0, Math.min(15, Math.round(Number(x && x.l) || 0))) : 0;   // أسطر الإجابة: 0 = تلقائي حسب الدرجة
    return l ? { t, n, m, l } : { t, n, m };
  }));
  return pages.length ? pages : null;
}
function examFlexLayout(){
  const el = document.getElementById('ex-flex');
  let L = null; try{ L = examFlexClean(JSON.parse(el && el.value || 'null')); }catch(e){}
  if(!L){ try{ L = examFlexClean(JSON.parse(localStorage.getItem(EX_FLEX_KEY) || 'null')); }catch(e){} }
  L = L || JSON.parse(JSON.stringify(EX_FLEX_DEFAULT));
  if(el && !el.value) el.value = JSON.stringify(L);
  return L;
}
function examFlexCount(t){ return examFlexLayout().reduce((a, pg) => a + pg.filter(x => x.t === t).reduce((b, x) => b + x.n, 0), 0); }
function examFlexRenderUI(){
  const box = document.getElementById('ex-flex-ui'); if(!box) return;
  const L = examFlexLayout();
  let total = 0, no = 0;
  const pages = L.map((pg, pi) => {
    const rows = pg.map((x, si) => {
      const sub = +(x.n * x.m).toFixed(2); total += sub; no++;
      return `<div class="exf-row">
        <span class="exf-no">${EX_ORD[no - 1] || no}</span>
        <select class="inp" onchange="examFlexEdit(${pi},${si},'t',this.value)" aria-label="نوع السؤال">${Object.entries(EX_FLEX_TYPES).map(([k, v]) => `<option value="${k}" ${k === x.t ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
        <label class="exf-f">العدد<input class="inp" type="number" min="1" max="${EX_FLEX_TYPES[x.t].max}" value="${x.n}" onchange="examFlexEdit(${pi},${si},'n',this.value)"></label>
        <label class="exf-f">درجة ${x.t === 'match' ? 'الزوج' : x.t === 'open' ? 'السؤال' : 'الفقرة'}<input class="inp" type="number" min="0.25" step="0.25" value="${x.m}" onchange="examFlexEdit(${pi},${si},'m',this.value)"></label>
        ${x.t === 'open' ? `<label class="exf-f">أسطر الإجابة<input class="inp" type="number" min="1" max="15" placeholder="تلقائي" title="عدد الأسطر تحت كل سؤال — فارغ = تلقائي حسب الدرجة" value="${x.l || ''}" onchange="examFlexEdit(${pi},${si},'l',this.value)"></label>` : '<span></span>'}
        <span class="exf-sub">${sub} درجة</span>
        <span class="exf-tools">
          <button type="button" class="btn ghost sm" title="تحريك لأعلى" aria-label="تحريك لأعلى" onclick="examFlexAct('up',${pi},${si})" ${pi === 0 && si === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" class="btn ghost sm" title="تحريك لأسفل" aria-label="تحريك لأسفل" onclick="examFlexAct('down',${pi},${si})" ${pi === L.length - 1 && si === pg.length - 1 ? 'disabled' : ''}>▼</button>
          <button type="button" class="btn ghost sm" title="حذف القسم" aria-label="حذف القسم" onclick="examFlexAct('delSec',${pi},${si})">🗑️</button>
        </span></div>`;
    }).join('');
    return `<div class="exf-page"><div class="exf-ph"><b>📄 الصفحة ${pi + 1}</b>${pi === 0 ? '<span class="muted">مع الترويسة وبيانات الطالب</span>' : ''}
        <span class="spacer"></span>${L.length > 1 ? `<button type="button" class="btn ghost sm" onclick="examFlexAct('delPage',${pi})">حذف الصفحة</button>` : ''}</div>
      ${rows}<button type="button" class="btn ghost sm" onclick="examFlexAct('addSec',${pi})">＋ قسم في هذه الصفحة</button></div>`;
  }).join('');
  box.innerHTML = `<div class="sheet-head" style="margin-bottom:.55rem"><div><h3 style="font-size:.95rem;margin:0">📐 تصميم الاختبار</h3>
      <div class="muted" style="font-size:.74rem;margin-top:.15rem">لكل صفحة أقسامها بالترتيب. الاختيار والصح/خطأ من بنك الأسئلة أعلاه، والوصل والفراغ و«أجب» من الحقول أدناه — يؤخذ كل نوع بالترتيب عبر أقسامه.</div></div>
      <span class="spacer"></span><span class="pill pts">المجموع ${+total.toFixed(2)} درجة</span></div>
    ${pages}
    <div class="row" style="gap:.45rem;flex-wrap:wrap;margin-top:.55rem">
      <button type="button" class="btn sm" onclick="examFlexAct('addPage')">＋ صفحة جديدة</button>
      <span class="muted" style="font-size:.76rem;margin-inline-start:.4rem">جاهز:</span>
      ${EX_FLEX_PRESETS.map((x, i) => `<button type="button" class="btn ghost sm" onclick="examFlexAct('preset',${i})" title="${esc(x.hint)}">${x.label}</button>`).join('')}
    </div>`;
}
/* محتوى الأقسام: يُسحب من كل مصدر بالترتيب، ويُحسب المجموع قبل رسم الترويسة */
function examFlexData(o){
  const L = examFlexLayout(), notes = [];
  const mcQ = o.mc.slice(), tfQ = o.tf.slice();
  const M = examParseMatch(o.val('ex-match-txt'));
  const fills = examParseFill(o.val('ex-fill-txt')), opens = examLines(o.val('ex-open-txt'));
  let mcN = 0, tfN = 0, extraUsed = false, total = 0, no = 0;
  // عدة نماذج: كل نموذج يبدأ من كتلته في الحقل النصي (أ أولًا ثم ب…) إن كفت الأسطر
  const need = t => L.reduce((a, pg) => a + pg.filter(x => x.t === t).reduce((b, x) => b + x.n, 0), 0);
  const MM = Math.max(1, o.modelCount || 1), Tm = need('match'), Tf = need('fill'), To = need('open');
  const mPool = examModelLines(M.pairs, Tm, o, 'الوصل', notes, 'match');
  const fPool = examModelLines(fills, Tf, o, 'أكمل الفراغ', notes, 'fill');
  const oPool = examModelLines(opens, To, o, 'أجب', notes, 'open');
  let mi = 0, fi = 0, oi = 0;
  const firstMatchKey = (() => { for(let pi = 0; pi < L.length; pi++) for(let si = 0; si < L[pi].length; si++) if(L[pi][si].t === 'match') return `${pi}-${si}`; return ''; })();
  const pages = L.map((pg, pi) => pg.map((x, si) => {
    const ord = EX_ORD[no++] || String(no), sec = { t:x.t, ord, m:x.m, key:`${pi}-${si}` };
    if(x.t === 'mc' || x.t === 'tf'){
      const pool = x.t === 'mc' ? mcQ : tfQ, items = pool.splice(0, x.n);
      if(items.length < x.n) notes.push(`${EX_FLEX_TYPES[x.t].label} (السؤال ${ord}): ${items.length} من ${x.n} فقط في البنك المحدد`);
      sec.items = items; sec.start = x.t === 'mc' ? mcN : tfN;
      if(x.t === 'mc') mcN += items.length; else tfN += items.length;
      sec.marks = +(items.length * x.m).toFixed(2);
    }else if(x.t === 'match'){
      const got = mPool.slice(mi, mi + x.n); mi += x.n;
      if(got.length < x.n) notes.push(`الوصل (السؤال ${ord}): ${got.length} من ${x.n} أزواج — تُترك الباقية فارغة`);
      const A = Array.from({length:x.n}, (_, i) => got[i] || { a:'', b:'' });
      let B = A.map((p, i) => ({ t:p.b, ans:i }));
      if(!extraUsed){ M.extra.slice(0, Math.max(0, EX_LET.length - x.n)).forEach(t => B.push({ t, ans:-1 })); extraUsed = true; }
      B = o.shuffle(B, o.seed + '|mt' + sec.key + '|' + o.modelIndex);
      if(B.length > 1 && A.every((_, i) => B[i] && B[i].ans === i)) B = B.slice(1).concat(B[0]);
      sec.X = { A, B, letterOf: A.map((_, i) => EX_LET[B.findIndex(b => b.ans === i)] || ''), marksMatch: +(x.n * x.m).toFixed(2) };
      sec.marks = sec.X.marksMatch;
      // 📷 للتصحيح الآلي: الوصل بمربعات أرقام يضلّلها الطالب (حتى ٦ أزواج — ما يتسع له السطر ويقرؤه الجوال)
      if(o.omr){
        const real = got.filter(p => p && p.a && p.b);
        if(x.n > 6) notes.push(`الوصل (السؤال ${ord}): ${x.n} أزواج — التصحيح الآلي يقرأ حتى ٦، فيُطبع وصلًا تقليديًا يُصحَّح يدويًا`);
        else if(real.length >= 2){
          if(M.extra.length && sec.key === firstMatchKey) notes.push('الوصل: الخيارات المشتِّتة (سطر يبدأ بـ |) لا تظهر في وصل التضليل — كل سطر عبارة يقابلها خيار');
          sec.AM = examAutoMatchFrom(real, o, x.m, notes, o.seed + '|amt' + sec.key + '|' + (o.modelIndex || 0));
          sec.marks = sec.AM.marks;
        }
      }
    }else if(x.t === 'fill'){
      let F = fPool.slice(fi, fi + x.n); fi += x.n;
      if(F.length < x.n) notes.push(`أكمل الفراغ (السؤال ${ord}): ${F.length} من ${x.n} — تُترك الباقية فارغة`);
      while(F.length < x.n) F.push({ q:'', a:'', blank:true });
      if(o.modelCount > 1 || o.mix) F = o.shuffle(F, o.seed + '|fl' + sec.key + '|' + o.modelIndex);
      sec.X = { fill:F, marksTail: +(x.n * x.m).toFixed(2) };
      if(document.getElementById('ex-fill-bank')?.checked){
        const ans = F.filter(f => !f.blank && f.a).map(f => f.a);
        const extra = String(o.val('ex-fill-extra') || '').split(/\s*[-–—،,|]\s*/).map(s => s.trim()).filter(Boolean);
        let words = [...new Set([...ans, ...extra])];
        if(words.length > 1){ words = o.shuffle(words, o.seed + '|wb' + sec.key + '|' + o.modelIndex); if(ans.length > 1 && ans.every((a, i) => words[i] === a)) words = words.slice(1).concat(words[0]); }
        sec.X.wordBank = words;
      }
      sec.marks = sec.X.marksTail;
    }else{
      const Q = oPool.slice(oi, oi + x.n); oi += x.n;
      if(Q.length < x.n) notes.push(`أجب (السؤال ${ord}): ${Q.length} من ${x.n} أسئلة مكتوبة — تُترك الباقية فارغة`);
      let items = Array.from({length:x.n}, (_, i) => ({ q:Q[i] || '', m:x.m }));
      if(o.modelCount > 1 || o.mix) items = o.shuffle(items, o.seed + '|op' + sec.key + '|' + o.modelIndex);
      // أسطر القسم كما حددها المعلم، وإلا تلقائي حسب الدرجة (حقل الأسطر العام خاص بالقالب ٣)
      sec.X = { open:items, marksTail: +(x.n * x.m).toFixed(2), linesFixed: x.l || 0, linesSet: !!x.l };
      sec.marks = sec.X.marksTail;
    }
    total += sec.marks;
    return sec;
  }));
  // ℹ️ ليس خطأ: النص المكتوب أكثر مما يتسع له التصميم — نقول كم كُتب وكم يُستخدم وكيف يُستفاد من الباقي
  const extraNote = (label, unit, have, used, sec) => { if(have > used) notes.push(`${label}: كتبت ${have} ${unit} والتصميم يستخدم ${used}${MM > 1 ? ` (${used / MM} لكل نموذج)` : ''} — ${used ? `زِد عدد ${unit} قسم «${sec}» في «📐 تصميم الاختبار»` : `أضف قسم «${sec}» في «📐 تصميم الاختبار»`} لاستخدام الباقي، أو احذف الزائد من النص`); };
  extraNote('الوصل', 'أزواج', M.pairs.length, Tm * MM, 'وصّل');
  extraNote('أكمل الفراغ', 'أسئلة', fills.length, Tf * MM, 'أكمل الفراغ');
  extraNote('أجب', 'أسئلة', opens.length, To * MM, 'أجب');
  return { pages, notes, total: +total.toFixed(2), mcN, tfN };
}
function examFlexSecHtml(sec, o){
  const L4 = ['أ','ب','ج','د'], D = o.D, key = o.key;
  if(sec.t === 'mc'){
    if(!sec.items.length) return '';
    return `<div class="ex-sec">${examSecHead('h-mc', `السؤال ${sec.ord}: اختر الإجابة الصحيحة فيما يلي:`, sec.marks, D)}${sec.items.map((q, i) => `
      <div class="ex-q" data-mid="mc${sec.start + i}" data-m="${sec.m}">
        <div class="ex-qt"><span class="ex-num">${D(i+1)}</span><span>${escExamText(q.q)}</span></div>
        <div class="ex-opts">${q.o.map((op, j) => `<div class="ex-opt${key && j === q.a ? ' key' : ''}"><span class="ex-box"></span><span class="ex-ltr">${L4[j] || ''}</span><span>${escExamText(op)}</span></div>`).join('')}</div>
      </div>`).join('')}</div>`;
  }
  if(sec.t === 'tf'){
    if(!sec.items.length) return '';
    return `<div class="ex-sec">${examSecHead('h-tf', `السؤال ${sec.ord}: ضع علامة (✓) أمام العبارة الصحيحة و(✗) أمام الخاطئة:`, sec.marks, D)}${sec.items.map((q, i) => `
      <div class="ex-tf" data-mid="tf${sec.start + i}" data-m="${sec.m}"><span class="ex-num">${D(i+1)}</span><span>${escExamText(q.q)}</span>
        <span class="ex-tf-c${key && q.a ? ' key' : ''}"><span class="ex-box"></span> صح</span>
        <span class="ex-tf-c${key && !q.a ? ' key' : ''}"><span class="ex-box"></span> خطأ</span></div>`).join('')}</div>`;
  }
  if(sec.t === 'match') return sec.AM ? examAutoMatchSec(sec.AM, { D, key, no:sec.ord }) : examMatchSec(sec.X, { D, key, no:sec.ord });
  if(sec.t === 'fill') return examFillSec(sec.X, { D, key, no:sec.ord });
  return examOpenSec(sec.X, { D, key, no:sec.ord, shrink: sec.X.linesSet ? 0 : (o.shrink || 0) });   // الأسطر المحددة يدويًا لا تُضغط
}
/* كل صفحة كما صمّمها المعلم؛ إن لم تتسع تُضغط المسافات (٣ مستويات)، ثم تُوزّع أقسامها على صفحة إضافية مع تنبيه */
function examFlexRender(F, c){
  const { headHtml, contHead, pageAttrs, box, D, key } = c;
  const LIMIT = EX_PAGE_H - 3 * EX_MM, warn = [];
  const pageHtml = (first, inner) => (first ? headHtml : contHead('')) + inner;
  const out = [];
  F.pages.forEach((secs, pi) => {
    let done = false;
    for(let f = 0; f <= 3 && !done; f++){
      const attrs = pageAttrs + (f ? ` data-fit="${f}"` : '');
      const inner = secs.map(s => examFlexSecHtml(s, { D, key, shrink:f })).join('');
      if(f === 3 || examMeasurePage(attrs, pageHtml(pi === 0, inner)) <= LIMIT){
        if(f === 3 && examMeasurePage(attrs, pageHtml(pi === 0, inner)) > LIMIT && secs.length > 1){
          // لا تتسع حتى بأقصى ضغط: تُقسم أقسامها على صفحات متتالية بدل قصّها
          let cur = [];
          secs.forEach(s => {
            const h = examFlexSecHtml(s, { D, key, shrink:3 });
            cur.push(h);
            if(cur.length > 1 && examMeasurePage(attrs, pageHtml(pi === 0 && !out.some(p => p.pi === pi), cur.join(''))) > LIMIT){
              cur.pop(); out.push({ pi, attrs, inner:cur.join('') }); cur = [h];
            }
          });
          if(cur.length) out.push({ pi, attrs, inner:cur.join('') });
          warn.push(`الصفحة ${pi + 1} لا تتسع لأقسامها فوُزّعت على صفحتين — قلّل العدد أو انقل قسمًا لصفحة أخرى`);
        }else{
          if(f === 3 && examMeasurePage(attrs, pageHtml(pi === 0, inner)) > LIMIT) warn.push(`الصفحة ${pi + 1}: القسم أطول من صفحة — قلّل عدد أسئلته`);
          out.push({ pi, attrs, inner, fit:f });
        }
        done = true;
      }
    }
  });
  const n = out.length;
  box.innerHTML = out.map((p, i) => `
    <div class="exam-page" ${p.attrs}>
      ${key ? `<span class="ex-keytag">نموذج الإجابة</span>` : ''}
      ${pageHtml(i === 0, p.inner)}
      <div class="ex-pager">صفحة ${D(i+1)} من ${D(n)}</div>
    </div>`).join('');
  return { n, warn, fit: out.some(p => p.fit) };
}
/* زر الإرجاع يظهر فقط إن عُدّل نص مسحوب يدويًا */
function examPullBtnSync(){
  const b = document.getElementById('ex-pull-btn'); if(!b) return;
  b.style.display = ['ex-match-txt','ex-fill-txt','ex-open-txt'].some(id => { const el = document.getElementById(id); return el && el.dataset.auto !== undefined && el.value !== el.dataset.auto; }) ? '' : 'none';
}

/* 🗂️ الوصل والفراغ و«أجب» مع عدة نماذج: الحقل النصي هو البنك، يُقسم بالتتابع —
   الأسطر الأولى للنموذج (أ) ثم (ب)… فإن لم تكفِ الأسطر يشترك النموذج في أسئلة (أ) مع خلط ترتيبها، ويُنبَّه. */
/* 📌 تثبيت أسطر الوصل/الفراغ/«أجب» على نموذج: يُحفظ في #ex-extra-pins بمفتاح نص السطر (يصمد لإعادة الترتيب) */
const EX_XT = { match:{ label:'الوصل', icon:'🔗', unit:'زوج' }, fill:{ label:'أكمل الفراغ', icon:'✏️', unit:'فراغ' }, open:{ label:'أجب', icon:'📝', unit:'سؤال' } };
function examXKey(t, it){ return t + '|' + (t === 'match' ? it.a + '|' + it.b : t === 'fill' ? it.q + '|' + it.a : String(it)); }
function examXPins(){ try{ const v = JSON.parse(document.getElementById('ex-extra-pins')?.value || '{}'); return v && typeof v === 'object' ? v : {}; }catch(e){ return {}; } }
function examXItems(t){
  if(t === 'match') return examParseMatch(document.getElementById('ex-match-txt')?.value || '').pairs;
  if(t === 'fill') return examParseFill(document.getElementById('ex-fill-txt')?.value || '');
  return examLines(document.getElementById('ex-open-txt')?.value || '');
}
/* الأنواع النصية المستخدمة في القالب الحالي */
function examXTypes(){
  const t = examTpl();
  if(t === 't2') return ['match','fill'];
  if(t === 't3') return ['match','open'];
  if(t === 't4'){ const L = examFlexLayout().flat(); return ['match','fill','open'].filter(k => L.some(x => x.t === k)); }
  return [];
}
/* حصة النموذج: المثبّت له أولًا، ثم غير المثبّت بالتتابع (أ أولًا ثم ب…) بلا تكرار */
function examModelLines(arr, need, o, label, notes, t){
  arr = Array.isArray(arr) ? arr : []; need = Math.max(0, need | 0);
  const M = Math.max(1, o.modelCount || 1), idx = o.modelIndex || 0;
  if(M < 2) return arr.slice(0, need);
  const P = examXPins(), pin = it => { const v = P[examXKey(t, it)]; return Number.isInteger(v) && v >= 0 && v < M ? v : -1; };
  const pinned = m => arr.filter(it => pin(it) === m), auto = arr.filter(it => pin(it) < 0);
  let off = 0; for(let m = 0; m < idx; m++) off += Math.max(0, need - pinned(m).length);
  const mine = pinned(idx).slice(0, need), rest = auto.slice(off, off + need - mine.length);
  let out = mine.concat(rest);
  if(out.length < need && arr.length >= need){
    // الأسطر لا تكفي هذا النموذج: يُكمل من بداية غير المثبّت (يشترك مع أ) ويُنبَّه
    const have = new Set(out); out = out.concat(auto.filter(x => !have.has(x)).slice(0, need - out.length));
    notes.push(`${label}: الأسطر لا تكفي النموذج (${examModelLetter(idx)}) فيشترك في بعض أسئلة غيره — أضف أسطرًا أو عدّل التثبيت`);
  }
  return out;
}
/* بيانات القسمين الإضافيين (وصل + أكمل الفراغ/أجب). لا تقرأ إلا من الحقول أعلاه. */
function examExtras(tpl, o){
  const notes = [], n = EX_N, mk = o.mark;
  const M = examParseMatch(o.val('ex-match-txt')), MM = Math.max(1, o.modelCount || 1);
  if(M.pairs.length > n * MM) notes.push(`الوصل: استُخدمت أول ${n * MM} أزواج من ${M.pairs.length}`);
  if(M.pairs.length < n) notes.push(`الوصل: ${M.pairs.length} من ${n} أزواج فقط — تُترك الباقية فارغة`);
  const mPairs = examModelLines(M.pairs, n, o, 'الوصل', notes, 'match');
  const A = Array.from({length:n}, (_, i) => mPairs[i] || { a:'', b:'' });
  let B = A.map((p, i) => ({ t:p.b, ans:i }));
  M.extra.slice(0, 3).forEach(t => B.push({ t, ans:-1 }));
  B = o.shuffle(B, o.seed + '|mt|' + o.modelIndex);
  if(B.length > 1 && A.every((_, i) => B[i] && B[i].ans === i)) B = B.slice(1).concat(B[0]);   // لا تتطابق الإجابات مع ترتيب العمود الأول
  const letterOf = A.map((_, i) => EX_LET[B.findIndex(x => x.ans === i)] || '');
  const X = { tpl, A, B, letterOf, notes, marks:0, kind: tpl === 't2' ? 'fill' : 'open' };
  X.marksMatch = n * mk;
  if(tpl === 't2'){
    let F = examParseFill(o.val('ex-fill-txt'));
    if(F.length > n * MM) notes.push(`أكمل الفراغ: استُخدمت أول ${n * MM} أسئلة من ${F.length}`);
    if(F.length < n) notes.push(`أكمل الفراغ: ${F.length} من ${n} — تُترك الباقية فارغة`);
    F = examModelLines(F, n, o, 'أكمل الفراغ', notes, 'fill'); while(F.length < n) F.push({ q:'', a:'', blank:true });
    if(o.modelCount > 1 || o.mix) F = o.shuffle(F, o.seed + '|fl|' + o.modelIndex);
    X.fill = F; X.marksTail = n * mk;
    /* بنك الكلمات (اختياري للتبسيط): إجابات الفراغات + كلمات تمويه، بترتيب مخلوط لا يطابق ترتيب الأسئلة */
    if(document.getElementById('ex-fill-bank')?.checked){
      const ans = F.filter(f => !f.blank && f.a).map(f => f.a);
      const extra = String(o.val('ex-fill-extra') || '').split(/\s*[-–—،,|]\s*/).map(s => s.trim()).filter(Boolean);
      let words = [...new Set([...ans, ...extra])];
      if(ans.length < F.filter(f => !f.blank).length) notes.push('بنك الكلمات: بعض أسئلة الفراغ بلا إجابة بعد «|» فلن تظهر كلماتها');
      if(words.length > 1){
        words = o.shuffle(words, o.seed + '|wb|' + o.modelIndex);
        if(ans.length > 1 && ans.every((a, i) => words[i] === a)) words = words.slice(1).concat(words[0]);
      }
      X.wordBank = words;
    }
  }else{
    let ms = examParseMarks(o.val('ex-open-marks'));
    if(!ms.length){
      const cnt = Math.max(1, Math.min(EX_OPEN_MAX, Number(o.val('ex-open-n')) || 3));
      ms = examSplitMarks(Number(examAr2En(o.val('ex-open-total'))) || 5, cnt);
    }
    if(ms.length > EX_OPEN_MAX){ notes.push(`أجب: الحد الأقصى ${EX_OPEN_MAX} أسئلة`); ms = ms.slice(0, EX_OPEN_MAX); }
    let Q = examLines(o.val('ex-open-txt'));
    if(Q.length > ms.length * MM) notes.push(`أجب: ${Q.length} سؤالًا مكتوبًا والمحدد ${ms.length * MM} — استُخدمت الأولى فقط`);
    if(Q.length < ms.length) notes.push(`أجب: ${Q.length} من ${ms.length} أسئلة مكتوبة — تُترك الباقية فارغة`);
    Q = examModelLines(Q, ms.length, o, 'أجب', notes, 'open');
    let items = ms.map((m, i) => ({ q:Q[i] || '', m }));
    if(o.modelCount > 1 || o.mix){ const idx = o.shuffle(items.map((_, i) => i), o.seed + '|op|' + o.modelIndex); items = idx.map(i => ({ q:items[i].q, m:items[i].m })); }
    X.open = items; X.marksTail = +ms.reduce((a, b) => a + b, 0).toFixed(2);
    const L = Number(examAr2En(o.val('ex-open-lines')));
    X.linesFixed = Number.isFinite(L) && L >= 1 ? Math.min(8, Math.round(L)) : 0;
  }
  X.marks = +(X.marksMatch + X.marksTail).toFixed(2);
  return X;
}

const EX_BLANK_RE = /(_{2,}|＿{2,}|…{2,}|\.{4,})/g, EX_BLANK_TEST = /(_{2,}|＿{2,}|…{2,}|\.{4,})/;
function examSecHead(id, text, marks, D){
  return `<div class="ex-sec-head" data-mid="${id}"><span>${text}</span><span class="ex-badge">${D(marks)} درجة</span></div>`;
}
function examMatchSec(X, o){
  /* ✍️ الطالب يكتب رقم العبارة من العمود الأول في المربع المقابل للعمود الثاني —
     كان يُطلب حرف العمود الثاني فكتب أغلب الطلاب الرقم الملاصق للمربع. العمود الثاني بلا حروف، فلا لبس */
  const rows = Math.max(X.A.length, X.B.length);
  let h = `<div class="ex-mhead"><span>العمود الأول</span><span>الرقم</span><span>العمود الثاني</span></div>`;
  for(let i = 0; i < rows; i++){
    const a = X.A[i], b = X.B[i];
    const src = b && b.ans >= 0 ? X.A[b.ans] : null;
    const keyTxt = !o.key || !b ? '' : src && src.a ? o.D(b.ans + 1) : '—';
    h += `<div class="ex-mrow" data-mid="mt${i}">
      <span class="ex-mcell">${a ? `<span class="ex-num">${o.D(i+1)}</span><span>${a.a ? escExamText(a.a) : '<i class="ex-dots"></i>'}</span>` : ''}</span>
      ${b ? `<span class="ex-mbox${o.key ? ' key' : ''}">${keyTxt}</span>` : '<span></span>'}
      <span class="ex-mcell">${b ? `<span class="ex-mdot"></span><span>${b.t ? escExamText(b.t) : '<i class="ex-dots"></i>'}</span>` : ''}</span>
    </div>`;
  }
  return `<div class="ex-sec">${examSecHead('h-mt', `السؤال ${o.no}: صِل بين العمودين (اكتب رقم العمود الأول في المربع):`, X.marksMatch, o.D)}${h}</div>`;
}
function examFillSec(X, o){
  const rows = X.fill.map((f, i) => {
    let body;
    if(f.blank) body = '<i class="ex-dots wide"></i>';
    else{
      let used = false;
      const blank = () => { const a = !used && o.key && f.a ? escExamText(f.a) : ''; used = true; return `<span class="ex-blank${a ? ' key' : ''}">${a}</span>`; };
      let t = escExamText(f.q);
      body = EX_BLANK_TEST.test(t) ? t.replace(EX_BLANK_RE, blank) : `${t} ${blank()}`;
    }
    return `<div class="ex-fq" data-mid="fl${i}"><span class="ex-num">${o.D(i+1)}</span><span class="ex-fq-t">${body}</span></div>`;
  }).join('');
  const wb = Array.isArray(X.wordBank) && X.wordBank.length
    ? `<div class="ex-wbank" data-mid="wb">( ${X.wordBank.map(w => `<span>${escExamText(w)}</span>`).join('<i> - </i>')} )</div>` : '';
  const head = wb ? `السؤال ${o.no}: أكمل الفراغات التالية بما يناسبها من الكلمات:` : `السؤال ${o.no}: أكمل الفراغات التالية بما يناسبها:`;
  return `<div class="ex-sec">${examSecHead('h-fl', head, X.marksTail, o.D)}${wb}${rows}</div>`;
}
function examOpenSec(X, o){
  const rows = X.open.map((it, i) => {
    let lines = X.linesFixed || (it.m <= 1 ? 3 : it.m <= 2 ? 4 : 5);
    lines = Math.max(1, lines - o.shrink);
    return `<div class="ex-oq" data-mid="op${i}">
      <div class="ex-qt"><span class="ex-num">${o.D(i+1)}</span><span class="ex-oq-t">${it.q ? escExamText(it.q) : '<i class="ex-dots wide"></i>'}</span><span class="ex-omark">${o.D(it.m)} ${it.m === 1 ? 'درجة' : it.m === 2 ? 'درجتان' : it.m > 2 && it.m <= 10 && Number.isInteger(it.m) ? 'درجات' : 'درجة'}</span></div>
      <div class="ex-lines">${'<i></i>'.repeat(lines)}</div></div>`;
  }).join('');
  return `<div class="ex-sec">${examSecHead('h-op', `السؤال ${o.no}: أجب عن كل مما يلي:`, X.marksTail, o.D)}${rows}</div>`;
}
/* ارتفاع صفحة كاملة بعرض A4 الحقيقي (المحتوى + الحشو) لنعرف هل تتسع */
/* القياس نفسه يتكرر مع كل فتح للصفحة ومع كل تعديل لا يغيّر المحتوى: يُحفظ ارتفاع كل محتوى (بعد اكتمال تحميل الخطوط فقط) */
const EX_MEASURE_CACHE = new Map();
function exHash(str){ let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for(let i = 0; i < str.length; i++){ const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36) + ':' + str.length; }
function examMeasurePage(attrs, html){
  const fontsOk = !document.fonts || document.fonts.status === 'loaded', ck = fontsOk ? exHash(attrs + '\u0001' + html) : '';
  if(ck && EX_MEASURE_CACHE.has(ck)) return EX_MEASURE_CACHE.get(ck);
  const h = examMeasurePageNow(attrs, html);
  if(ck && h > 0 && examMeasurePageNow.stable){ if(EX_MEASURE_CACHE.size > 300) EX_MEASURE_CACHE.clear(); EX_MEASURE_CACHE.set(ck, h); }   // صورة (شعار) لم تكتمل بعد ⇒ لا يُحفظ
  return h;
}
function examMeasurePageNow(attrs, html){
  let box = document.getElementById('exam-measure');
  if(!box){ box = document.createElement('div'); box.id = 'exam-measure'; document.body.appendChild(box); }
  box.style.cssText = 'position:absolute;left:-10000px;top:0;width:210mm;visibility:hidden;pointer-events:none;zoom:1';
  box.innerHTML = `<div class="exam-page" ${attrs} style="height:auto;box-shadow:none">${html}</div>`;
  let h = 0; try{ h = box.firstElementChild.getBoundingClientRect().height || 0; }catch(e){}
  examMeasurePageNow.stable = [...box.querySelectorAll('img')].every(i => i.complete && i.naturalWidth);
  box.innerHTML = '';
  return h;
}
function examRenderTemplate(c){
  const { X, units, headHtml, contHead, footHtml, pageAttrs, box, D, key, mc, tf } = c;
  const grp = sec => { const us = units.filter(u => u.sec === sec); return us.length ? `<div class="ex-sec">${us.map(u => u.html).join('')}</div>` : ''; };
  const base = (mc.length ? 1 : 0) + (tf.length ? 1 : 0);
  const LIMIT = EX_PAGE_H - 3 * EX_MM;
  const build = f => {
    const attrs = pageAttrs + (f ? ` data-fit="${f}"` : '');
    const matchH = examMatchSec(X, { D, key, no:EX_ORD[base] });
    const tailH = X.kind === 'fill' ? examFillSec(X, { D, key, no:EX_ORD[base+1] }) : examOpenSec(X, { D, key, no:EX_ORD[base+1], shrink:f });
    return { attrs, groups:[grp('mc') + grp('tf'), matchH + tailH], loose:[grp('mc'), grp('tf'), matchH, tailH] };
  };
  const pageHtml = (i, inner, last) => (i === 0 ? headHtml : contHead('')) + inner + (last ? footHtml : '');
  let fit = 0, B = build(0);
  for(; fit <= 3; fit++){
    B = build(fit);
    if(B.groups.every((g, i) => examMeasurePage(B.attrs, pageHtml(i, g, i === B.groups.length - 1)) <= LIMIT)) break;
  }
  let pages, overflow = false;
  if(fit > 3){                        // لا يتسع في صفحتين حتى بأقصى ضغط: نوزّع الأقسام على صفحات إضافية بدل قصّ المحتوى
    fit = 3; B = build(3); overflow = true;
    pages = [[]];
    B.loose.filter(Boolean).forEach(g => {
      const cur = pages[pages.length - 1]; cur.push(g);
      if(cur.length > 1 && examMeasurePage(B.attrs, pageHtml(pages.length - 1, cur.join(''), true)) > LIMIT){ cur.pop(); pages.push([g]); }
    });
    pages = pages.map(p => p.join(''));
  }else pages = B.groups;
  const n = pages.length;
  box.innerHTML = pages.map((p, i) => `
    <div class="exam-page" ${B.attrs}>
      ${key ? `<span class="ex-keytag">نموذج الإجابة</span>` : ''}
      ${pageHtml(i, p, i === n - 1)}
      <div class="ex-pager">صفحة ${D(i+1)} من ${D(n)}</div>
    </div>`).join('');
  return { n, fit, overflow };
}

/* 📷 القالب ٥ — الوصل بمربعات: يضع الطالب ✓ في مربع رقم العبارة المناسبة من العمود الأول (لا يكتب رقمًا بخط يده)
   فيقرؤه الجوال كما يقرأ الاختيار من متعدد. 2–6 أزواج (حد مربعات السؤال الواحد في المصحح الآلي) */
/* سطرا الإدارة والمكتب في رأس الورقة: «بالمنطقة الشرقية» وحدها تُكمَّل «الإدارة العامة للتعليم بالمنطقة الشرقية» و«مكتب التعليم بالمنطقة الشرقية»
   (كانت تُطبع «مكتب التعليم: بالمنطقة الشرقية»)، والاسم الكامل يبقى كما كُتب */
function examDeptLine(v){ v = String(v || '').trim(); if(!v) return 'الإدارة العامة للتعليم'; return /^(ال)?إدار[ةه]/.test(v) ? v : (/^ب/.test(v) ? 'الإدارة العامة للتعليم ' + v : v); }
function examOfficeLine(v){ v = String(v || '').trim(); return /^مكتب/.test(v) ? v : (/^ب/.test(v) ? 'مكتب التعليم ' + v : 'مكتب التعليم: ' + v); }
function examAutoMatch(o){
  const n = Math.max(0, Math.min(6, Number(examAr2En(o.val('ex-nmt'))) || 0)), notes = [];
  if(n < 2) return null;
  const M = examParseMatch(o.val('ex-match-txt'));
  if(!M.pairs.length){ notes.push('الوصل: اكتب الأزواج في «أسئلة الوصل» (عبارة | ما يناسبها)'); return { A:[], B:[], notes, marks:0, empty:true }; }
  const A = examModelLines(M.pairs, n, o, 'الوصل', notes, 'match').filter(p => p && p.a && p.b);
  if(A.length < n) notes.push(`الوصل: ${A.length} من ${n} أزواج فقط`);
  if(A.length < 2) return { A:[], B:[], notes, marks:0, empty:true };
  return examAutoMatchFrom(A, o, o.mark, notes, o.seed + '|amt|' + (o.modelIndex || 0));
}
/* أزواج الوصل ← شكل التضليل: الجمل في العمود الأول، والكلمات مخلوطة مرقّمة في الثاني (يستعمله «ورقة واحدة» و«المصمَّم») */
function examAutoMatchFrom(A, o, mark, notes, seed){
  // الجملة (الطرف الأطول) في العمود الأول بلا ترقيم، والكلمة (الأقصر) مرقّمة في العمود الثاني — أيًّا كان ترتيب المعلم للزوج
  const len = k => A.reduce((t, p) => t + String(p[k]).length, 0);
  const flip = len('b') > len('a');
  const S = A.map(p => flip ? p.b : p.a), W = A.map(p => flip ? p.a : p.b);
  // نص مكرر في أي عمود لإجابتين مختلفتين: الطالب لا يفرّق بينهما ويُخطَّأ وهو مصيب
  const dups = L => L.filter((t, i) => L.findIndex(u => rdNormAr(u) === rdNormAr(t)) !== i).filter((t, i, arr) => arr.findIndex(u => rdNormAr(u) === rdNormAr(t)) === i);
  [[dups(S), 'الأول'], [dups(W), 'الثاني']].forEach(([d, c]) => { if(d.length) notes.push(`⚠️ الوصل: «${d.join('»، «')}» مكررة في العمود ${c} — الطالب لا يفرّق بينها، غيّر إحداها`); });
  let B = o.shuffle(W.map((t, i) => ({ t, ans:i })), seed);
  // الأعمدة متقابلة في السطر نفسه: لا تقع إجابة أي عبارة في سطرها (تُكشف بالنظر). تبديل كل موضع ثابت مع جاره يزيله
  for(let i = 0; i < B.length; i++) if(B[i].ans === i){ const j = (i + 1) % B.length; [B[i], B[j]] = [B[j], B[i]]; }
  for(let i = 0; i < B.length; i++) if(B[i].ans === i){ const j = (i + B.length - 1) % B.length; [B[i], B[j]] = [B[j], B[i]]; }
  return { A, S, B, notes, marks: +(A.length * mark).toFixed(2), m: mark };
}
/* الوصل بشكل الوصل التقليدي: عبارات العمود الأول يمين (بلا رقم ولا حرف: هي ما يُجاب عنه) ← مربعات التضليل في الوسط
   وتحت كل مربع رقمه ← العمود الثاني يسار مرقّمًا (الخيارات). كل تركيز الطالب: أي رقم يناسب هذه الجملة */
function examAutoMatchSec(AM, o){
  const head = `<div class="ex-amt-h" data-mid="mta"><span>العمود الأول</span><span>رقم الإجابة من العمود الثاني</span><span>العمود الثاني</span></div>`;
  // الأسطر = الجمل بترتيب المعلم، والعمود الثاني = ما يناسبها مخلوطًا ومرقّمًا؛ مفتاح السطر i = موضع ما يناسبه
  const rows = AM.A.map((p, i) => { const ans = AM.B.findIndex(b => b.ans === i);
    return `<div class="ex-amtq" data-mid="mtq${i}"${AM.m !== undefined ? ` data-m="${AM.m}"` : ''}>
    <span class="ex-amt-c1"><span class="ex-amt-t">${escExamText(AM.S[i])}</span></span>
    <span class="ex-amt-o">${AM.B.map((_, j) => `<span class="ex-amto${o.key && j === ans ? ' key' : ''}"><span class="ex-box"></span><i>${o.D(j+1)}</i></span>`).join('')}</span>
    <span class="ex-amt-c2">${AM.B[i] ? `<b class="ex-num">${o.D(i+1)}</b><span class="ex-amt-c1t">${escExamText(AM.B[i].t)}</span>` : ''}</span></div>`; }).join('');
  return `<div class="ex-sec ex-amt">${examSecHead('h-amt', `السؤال ${o.no}: ضلّل أمام كل عبارة في العمود الأول رقم ما يناسبها من العمود الثاني:`, AM.marks, o.D)}${head}${rows}</div>`;
}
function examAutoRender(c){
  const { AM, units, headHtml, contHead, pageAttrs, box, D, key, mc, tf } = c;
  // عمودان للفقرات القصيرة (الاختيار بخيارات قصيرة، والصح/الخطأ) — يُلجأ إليهما فقط إن لم تتسع الورقة بعمود واحد
  const shortMc = mc.every(q => String(q.q || '').length <= 70 && (q.o || []).every(o => String(o || '').length <= 22));
  const font = (/data-font="([^"]*)"/.exec(pageAttrs) || [])[1] || 'trad', size = (/data-size="([^"]*)"/.exec(pageAttrs) || [])[1] || 'm';
  const F4 = {}, fourAt = f => F4[f] || (F4[f] = examFourFits(mc, font, size, f));
  const fx = (h, f) => h.replace(/%%F4:(\d+)%%/g, (_, i) => fourAt(f).has(mc[+i]) ? ' four' : '');
  const grp = (sec, cols, f) => { const us = units.filter(u => u.sec === sec); return us.length ? `<div class="ex-sec${cols ? ' ex-cols' : ''}">${us.map(u => fx(u.html, f)).join('')}</div>` : ''; };
  const base = (mc.length ? 1 : 0) + (tf.length ? 1 : 0);
  const mt = AM && AM.A.length >= 2 ? examAutoMatchSec(AM, { D, key, no:EX_ORD[base] }) : '';
  const LIMIT = EX_PAGE_H - 3 * EX_MM;
  // درجات الضغط بالترتيب: عمود واحد ← صح/خطأ بعمودين ← والاختيار بعمودين ← ثم تقليل المسافات والخط (data-fit 1–3)
  // اختيار طويل لا يُقسم عمودين، لكن تصغير المسافات والخط يبقى متاحًا (كان يُتخطى كله فتنتقل الفقرات لصفحة ثانية بلا محاولة)
  const steps = [[0,0,0],[0,1,0],[0,1,1],[1,1,1],[2,1,1],[3,1,1],[4,1,1]].map(x => shortMc ? x : [x[0], x[1], 0]).filter((x, i, a) => a.findIndex(y => y.join() === x.join()) === i);
  let parts = [], attrs = pageAttrs, fit = 0, ok = false;
  for(const [f, tfc, mcc] of steps){
    parts = [grp('mc', mcc, f), grp('tf', tfc, f), mt].filter(Boolean); fit = f;
    attrs = pageAttrs + ' data-auto="1"' + (f ? ` data-fit="${f}"` : '');
    if(examMeasurePage(attrs, headHtml + parts.join('')) <= LIMIT){ ok = true; break; }
  }
  let pages = [parts.join('')], overflow = false;
  if(!ok){                       // لا تتسع حتى بأقصى ضغط: أقسام على صفحات (ما بعد الأولى يدوي) بدل قصّ المحتوى
    fit = 4; overflow = true; attrs = pageAttrs + ' data-auto="1" data-fit="4"'; pages = [[]];
    parts = [grp('mc', shortMc ? 1 : 0, 4), grp('tf', 1, 4), mt].filter(Boolean);
    parts.forEach(g => { const cur = pages[pages.length - 1]; cur.push(g);
      if(cur.length > 1 && examMeasurePage(attrs, (pages.length === 1 ? headHtml : contHead('')) + cur.join('')) > LIMIT){ cur.pop(); pages.push([g]); } });
    pages = pages.map(p => p.join(''));
  }
  const n = pages.length;
  box.innerHTML = pages.map((p, i) => `
    <div class="exam-page" ${attrs}>
      ${key ? `<span class="ex-keytag">نموذج الإجابة</span>` : ''}
      ${i === 0 ? headHtml : contHead('')}${p}
      <div class="ex-pager">صفحة ${D(i+1)} من ${D(n)}</div>
    </div>`).join('');
  return { n, fit, overflow };
}

/* 📋 حالة المعاينة: ملخص قصير (شرائح) + زر «⚠️ ملاحظات» يفتح قائمة واضحة بدل سطر طويل مزدحم */
let EXS_OPEN=false;
function examStatusDecorate(){
  const st=document.getElementById('ex-status'); if(!st) return;
  const txt=st.textContent||''; if(!txt||st.dataset.src===txt) return;
  const i=txt.indexOf('⚠️'), head=(i<0?txt:txt.slice(0,i)).replace(/[\s·]+$/,'');
  const warns=[...new Set((i<0?'':txt.slice(i)).split(/\s+·\s+/).map(w=>w.replace(/^[\s·]*⚠️\s*/,'').trim()).filter(Boolean))];
  if(!/^المعاينة:/.test(head)&&!warns.length) return;
  const parts=head.replace(/^المعاينة:\s*/,'').split(/\s+·\s+/).filter(Boolean);
  st.innerHTML=`<div class="exs">${parts.map((p,k)=>`<span class="exs-c${k===0?' main':''}">${esc(p)}</span>`).join('')}
    ${warns.length?`<button type="button" class="exs-w${EXS_OPEN?' on':''}" onclick="EXS_OPEN=!EXS_OPEN;this.classList.toggle('on',EXS_OPEN);this.closest('#ex-status').querySelector('.exs-list').classList.toggle('hide',!EXS_OPEN);this.lastChild.textContent=EXS_OPEN?'⌃':'⌄'">⚠️ ${warns.length} ${warns.length===1?'ملاحظة':warns.length===2?'ملاحظتان':'ملاحظات'} <i>${EXS_OPEN?'⌃':'⌄'}</i></button>`:''}</div>
    ${warns.length?`<ol class="exs-list${EXS_OPEN?'':' hide'}">${warns.map(w=>`<li>${esc(w)}</li>`).join('')}</ol>`:''}`;
  st.style.color='';
  st.dataset.src=st.textContent;
}
/* ⬛ علامات الزوايا: أربعة مربعات سوداء في زوايا كل صفحة فيها مربعات إجابة، واحد منها مفرّغ (أسفل اليسار) لمعرفة الاتجاه.
   الجوال يقيس منها الورقة، فتُقرأ ولو طُبعت مصغّرة («ملاءمة الصفحة») أو قُصّت حافتها. لا تغيّر مكان أي شيء في الورقة. */
function examFiducials(){
  // الصفحات التالية تحمل أيضًا وسمًا مربعًا أسود بجانب رقم الصفحة (موضعه يختلف لكل صفحة): الجوال يعرف به أنها الثانية
  // أو الثالثة… فيقرؤها بخريطتها ويضمها إلى ورقة الطالب نفسه. الصفحة الأولى بلا وسم
  if(!examOmrOn()) return;                                     // المصمَّم بلا تصحيح آلي: ورقة عادية بلا علامات
  const pages = [...document.querySelectorAll('#exam-paper .exam-page')];
  let k = 0;
  pages.forEach(pg => {
    if(!pg.querySelector('.ex-box')) return;
    const idx = k++;
    if(pg.querySelector(':scope > .ex-fid')) return;
    pg.insertAdjacentHTML('beforeend', ['tl','tr','br','bl'].map(c => `<i class="ex-fid ${c}" aria-hidden="true"></i>`).join('')
      + (idx ? `<i class="ex-ptag" data-pg="${idx + 1}" style="left:${36 + (idx - 1) * 12}mm" aria-hidden="true"></i>` : ''));
  });
}
function examBuild(force){
  const r = examBuild0(force);
  try{ examFiducials(); }catch(e){}
  try{ const box = document.getElementById('exam-paper'), st = document.getElementById('ex-status'), on = !!window._exSample;
    if(box) box.classList.toggle('ex-sample', on);
    if(on && st && box && box.querySelector('.ex-sec')) st.innerHTML = '<b style="color:#b54708">👁 هذا شكل القالب فقط بأسئلة توضيحية</b> — اختر الأسئلة من «٢ الأسئلة» لتظهر هنا';
  }catch(e){}
  try{ examStepSums(); examPrevZoom(); }catch(e){}
  return r;
}
/* 🗂️ خطوات الصفحة: ملخص سطر لكل خطوة مطوية، وحالة الفتح محفوظة على الجهاز */
const K_EXS_OPEN = 'hwapp_exs_open_v1';
function examStepsInit(){
  let o = {}; try{ o = JSON.parse(localStorage.getItem(K_EXS_OPEN) || '{}'); }catch(e){}
  const v = id => (document.getElementById(id)?.value || '').trim();
  // الترويسة تُطوى إن كانت محفوظة من قبل (اسم المدرسة معبأ) — لا يُعاد ملؤها كل مرة
  const def = { tpl:true, q:true, head: !v('ex-school'), look:false };
  document.querySelectorAll('#p-exam details.exs').forEach(d => { const k = d.dataset.k; d.open = k in o ? !!o[k] : def[k]; });
}
function examStepSums(){
  const $s = (k, t) => { const e = document.getElementById('exs-sum-' + k); if(e){ e.textContent = t; e.title = t; } };
  const v = id => (document.getElementById(id)?.value || '').trim();
  const opt = id => { const e = document.getElementById(id); return e && e.selectedOptions[0] ? e.selectedOptions[0].textContent.trim() : ''; };
  const D = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const TPL = examTpl(), N = examNeed(), mc = examModelCount();
  const parts = [opt('ex-tpl').split('—')[0].trim()];
  if(N.nmc) parts.push(D(N.nmc) + ' اختيار'); if(N.ntf) parts.push(D(N.ntf) + ' صح/خطأ');
  if(TPL === 't5' && Number(v('ex-nmt'))) parts.push(D(v('ex-nmt')) + ' وصل');
  parts.push(mc > 1 ? D(mc) + ' نماذج' : 'نموذج واحد');
  $s('tpl', parts.join(' · '));
  const src = v('ex-src') || 'hw';
  const cnt = src === 'hw' ? (examHwIds().length ? document.getElementById('ex-hw-bank-count')?.textContent : '') : document.getElementById('ex-bank-count')?.textContent;
  $s('q', [opt('ex-src'), src === 'hw' ? (examHwIds().length ? D(examHwIds().length) + ' ' + (examHwIds().length === 1 ? 'نشاط' : 'أنشطة') : 'لم تختر نشاطًا') : '', cnt || ''].filter(Boolean).join(' · '));
  $s('head', [v('ex-title'), v('ex-subject'), v('ex-grade'), v('ex-school')].filter(Boolean).join(' · ') || 'لم تُعبأ');
  $s('look', [opt('ex-font').split('—')[0].trim(), 'خط ' + opt('ex-size').split('—')[0].trim(), document.getElementById('ex-hindi')?.checked ? 'أرقام عربية' : ''].filter(Boolean).join(' · '));
}
/* المعاينة تُصغَّر لتملأ عرض عمودها (الطباعة والقياس بالحجم الحقيقي) */
function examPrevZoom(){
  const w = document.getElementById('exw-prev'); if(!w || !w.clientWidth || window._exzLock) return;   // أثناء قياس التصحيح الآلي: الحجم الحقيقي
  const z = Math.max(.3, Math.min(1, (w.clientWidth - 16) / (210 * EX_MM)));
  w.style.setProperty('--exz', z.toFixed(3));
  if(!w._ro && window.ResizeObserver){ w._ro = new ResizeObserver(() => { if(window._exzLock) return; const z2 = Math.max(.3, Math.min(1, (w.clientWidth - 16) / (210 * EX_MM))); w.style.setProperty('--exz', z2.toFixed(3)); }); w._ro.observe(w); }
}
function examBuild0(force){
  const box = document.getElementById('exam-paper');
  if(!box) return;
  examTplSyncUI();
  const TPL = examTpl();
  const src = document.getElementById('ex-src')?.value || 'hw';
  const data = src === 'hw' ? (EXAM_HW_BANK.id ? {mc:EXAM_HW_BANK.mc||[], tf:EXAM_HW_BANK.tf||[], label:EXAM_HW_BANK.title||''} : examSourceFromActivity())
                                : (EXAM_JSON_BANK.mc.length||EXAM_JSON_BANK.tf.length ? EXAM_SRC : EXAM_SRC);

  const val = id => (document.getElementById(id)?.value || '').trim();
  const num = (id, d) => { const n = Number(document.getElementById(id)?.value); return Number.isFinite(n) ? n : d; };
  const key   = !!document.getElementById('ex-key')?.checked;
  const mix   = !!document.getElementById('ex-shuffle')?.checked;
  const hindi = !!document.getElementById('ex-hindi')?.checked;
  const modelCount = Math.max(1, Math.min(6, num('ex-model-count', 1)));
  const modelIndex = Math.max(0, Math.min(modelCount - 1, num('ex-model', 0)));
  const fontK = val('ex-font') || 'trad';
  const sizeK = val('ex-size') || 'm';
  const logoSize = Math.max(20, Math.min(42, num('ex-logo-size', 32)));
  // أسئلة مولد الذكاء تستخدم الأرقام العربية تلقائيًا، حتى لو لم يُفعّل المستخدم خيار الأرقام يدويًا.
  const D = v => examDigits(v, hindi || src==='ai');

  let mc = data.mc.slice(), tf = data.tf.slice();
  if((src==='json' || src==='ai') && document.getElementById('ex-use-selected')?.checked){
    const picked=examJsonSelected();
    mc=picked.mc.slice(); tf=picked.tf.slice();
  }else if(src==='hw'){
    const picked=examHwSelected();
    mc=picked.mc.slice(); tf=picked.tf.slice();
  }

  const nmc = TPL === 't1' || TPL === 't5' ? Math.max(0, num('ex-nmc', 5)) : TPL === 't4' ? examFlexCount('mc') : 5;    // القالبان ٢ و٣: ٥ + ٥ ثابتة · ٤: مجموع أقسامه
  const ntf = TPL === 't1' || TPL === 't5' ? Math.max(0, num('ex-ntf', 5)) : TPL === 't4' ? examFlexCount('tf') : 5;

  /*
     عند تعدد النماذج نوزع من كامل بنك الأسئلة أولًا، ثم نأخذ حصة كل نموذج.
     لذلك لا يتكرر السؤال بين النماذج، ولا يقتصر الاختيار على أول N سؤالًا.
  */
  if(modelCount > 1){
    const modelSeed = `${String(val('ex-title')||'اختبار')}|${String(data.label||'source')}|${modelCount}`;

    // يحترم تثبيت المعلم للنماذج، ولا يجمع سؤالين متشابهين في نموذج واحد
    ({ mc, tf } = examSpreadPick(mc, tf, nmc, ntf, modelIndex, modelCount, modelSeed));
  }else{
    ({ mc, tf } = examSpreadPick(mc, tf, nmc, ntf, 0, 1, ''));
  }
  // 👁 لم تُختر أسئلة بعد: يُعرض شكل القالب بأسئلة توضيحية (عليها «مثال») — لا يُطبع ولا يُجهَّز للتصحيح
  const sample = window._exSample = !mc.length && !tf.length;
  if(sample){
    mc = Array.from({length:nmc}, (_, i) => ({ q:`نص سؤال الاختيار من متعدد ${i + 1}`, o:['الخيار الأول','الخيار الثاني','الخيار الثالث','الخيار الرابع'], a:0 }));
    tf = Array.from({length:ntf}, (_, i) => ({ q:`نص عبارة الصح أو الخطأ ${i + 1}`, a:true }));
  }
  const EX_SAMPLE_TXT = { 'ex-match-txt':'العبارة الأولى | الكلمة ١\nالعبارة الثانية | الكلمة ٢\nالعبارة الثالثة | الكلمة ٣\nالعبارة الرابعة | الكلمة ٤\nالعبارة الخامسة | الكلمة ٥\nالعبارة السادسة | الكلمة ٦\nالعبارة السابعة | الكلمة ٧\nالعبارة الثامنة | الكلمة ٨',
    'ex-fill-txt':Array.from({length:15}, (_, i) => `جملة الفراغ ${i + 1} ______ | إجابة`).join('\n'), 'ex-open-txt':Array.from({length:8}, (_, i) => `نص السؤال ${i + 1}`).join('\n') };
  const val0 = val, valS = id => sample && EX_SAMPLE_TXT[id] && !val0(id) ? EX_SAMPLE_TXT[id] : val0(id);

  // طبقة أخيرة بعد تحديد الأسئلة فعليًا، لأن اختيار البنك كان يعيد الكائنات الأصلية.
  // بذلك تبقى الأرقام عربية في نص السؤال والخيارات حتى بعد التحديد والطباعة.
  if(src==='ai'){
    mc = mc.map(q => ({...q, q:toArabicIndicDigits(q.q), o:(q.o||[]).map(toArabicIndicDigits)}));
    tf = tf.map(q => ({...q, q:toArabicIndicDigits(q.q)}));
  }

  // النماذج ثابتة: نفس النموذج يعرض نفس الترتيب عند إعادة البناء/الطباعة.
  // خيار الخلط القديم يبقى مدعومًا، لكن النموذج يفرض بذرة ثابتة مختلفة لكل نموذج.
  const modelSeed = `${String(val('ex-title')||'اختبار')}` + '|' + `${EXAM_SRC?.label||'source'}`;
  const seededShuffle = (arr, seedText) => {
    const a = arr.slice();
    let h = 2166136261 >>> 0;
    for(let i=0;i<seedText.length;i++){ h ^= seedText.charCodeAt(i); h = Math.imul(h,16777619) >>> 0; }
    const rnd = () => { h += 0x6D2B79F5; let t=h; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
    for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  };
  if(mix || modelCount > 1){
    mc = seededShuffle(mc, modelSeed+'|mc|'+modelIndex);
    tf = seededShuffle(tf, modelSeed+'|tf|'+modelIndex);
  }


  // البنك لا يكفي هذا النموذج: يُقال صراحةً بدل أن يخرج النموذج أقصر من غيره بصمت
  const shortNote = modelCount > 1 && (mc.length < nmc || tf.length < ntf)
    ? ` · ⚠️ النموذج (${examModelLetter(modelIndex)}): ${mc.length < nmc ? `${mc.length} من ${nmc} اختيار` : ''}${mc.length < nmc && tf.length < ntf ? ' و' : ''}${tf.length < ntf ? `${tf.length} من ${ntf} صح/خطأ` : ''} — البنك لا يكفي، أضف أسئلة أو قلّل التثبيت` : '';
  const mark = examMarkVal();
  const X = TPL === 't1' || TPL === 't4' || TPL === 't5' ? null : examExtras(TPL, { mark, modelIndex, modelCount, seed:modelSeed, shuffle:seededShuffle, mix, val });
  const FX = TPL === 't4' ? examFlexData({ mc, tf, val:valS, modelIndex, modelCount, seed:modelSeed, shuffle:seededShuffle, mix, omr:examOmrOn() }) : null;
  const AM = TPL === 't5' ? examAutoMatch({ mark, modelIndex, modelCount, seed:modelSeed, shuffle:seededShuffle, val:valS }) : null;
  const total = FX ? FX.total : (mc.length + tf.length) * mark + (X ? X.marks : 0) + (AM ? AM.marks : 0);
  const dots = '.'.repeat(26);

  const st = document.getElementById('ex-status');
  if(!mc.length && !tf.length && !(FX && FX.pages.some(pg => pg.some(x => x.t !== 'mc' && x.t !== 'tf')))){
    if(st) st.textContent = 'لا توجد فقرات — اختر أسئلة من النشاط المحفوظ أو ارفع ملف JSON.';
    box.innerHTML = `<div class="exam-page"><div class="ex-empty">لا توجد فقرات لعرضها.<br>اختر أسئلة من نشاط محفوظ أو ارفع ملف JSON.</div></div>`;
    return;
  }

  const logo = window.__MOE_LOGO
    ? window.__MOE_LOGO
    : `<div class="ex-fallback">وزارة التعليم<br><span style="font-size:9pt">Ministry of Education</span></div>`;
  const L = ['أ','ب','ج','د'];
  const pageAttrs = `data-font="${esc(fontK)}" data-size="${esc(sizeK)}"`;

  const headHtml = `
    <div class="ex-head" data-mid="head">
      <div class="ex-side right">
        <b>المملكة العربية السعودية</b>
        <span>وزارة التعليم</span>
        ${document.getElementById('ex-show-dept')?.checked ? `<span>${esc(examDeptLine(val('ex-dept')))}</span>` : ''}
        ${document.getElementById('ex-show-office')?.checked && val('ex-office') ? `<span>${esc(examOfficeLine(val('ex-office')))}</span>` : ''}
        ${document.getElementById('ex-show-school')?.checked ? `<span class="ex-school-line">مدرسة: ${esc(val('ex-school') || dots.slice(0,18))}</span>` : ''}
      </div>
      <div class="ex-logo-slot"><div class="ex-logo" style="--exam-logo-size:${logoSize}mm">${logo}</div></div>
      <div class="ex-side left">
        ${document.getElementById('ex-show-subject')?.checked ? `<div class="ex-meta-row"><span>المادة: ${esc(val('ex-subject') || dots.slice(0,12))}</span></div>` : ''}
        ${document.getElementById('ex-show-grade')?.checked ? `<div class="ex-meta-row"><span>الصف: ${esc(val('ex-grade') || dots.slice(0,12))}</span></div>` : ''}
        ${document.getElementById('ex-show-date')?.checked ? `<div class="ex-meta-row"><span>التاريخ: ${D(esc(val('ex-date') || '..... / ..... / 14..... هـ'))}</span></div>` : ''}
        ${document.getElementById('ex-show-time')?.checked ? `<div class="ex-meta-row"><span>الزمن: ${D(esc(val('ex-time') || dots.slice(0,10)))}</span></div>` : ''}
      </div>
    </div>
    <div class="ex-title" data-mid="title">${esc(val('ex-title') || 'اختبار قصير')}${modelCount > 1 ? ` <span class="ex-model-badge">نموذج (${examModelLetter(modelIndex)})<span class="ex-mcode" aria-hidden="true">${Array.from({length:modelCount},(_,k)=>`<i${k===modelIndex?' class="on"':''}></i>`).join('')}</span></span>` : ''}</div>
    <div class="ex-student" data-mid="stu">
      ${examNamed() ? `<div class="ex-sname">اسم الطالب: <b class="ex-nm">يُطبع اسم كل طالب هنا</b><span class="ex-scode" aria-hidden="true">${'<i></i>'.repeat(20)}</span></div>
      <div>الصف: <b class="ex-ncls">${dots.slice(0,14)}</b></div>` : `<div>اسم الطالب: ${dots}</div>
      <div>الصف: ${dots.slice(0,14)}</div>`}
      <div class="ex-mark"><b>الدرجة</b><span>&nbsp;</span><em>من ${D(total)}</em></div>
    </div>`;

  const contHead = t => `<div class="ex-cont" data-mid="cont">${esc(val('ex-title') || 'اختبار')} — تابع${t?` (${t})`:''}</div>`;

  const footHtml = '';

  /* الفقرات كوحدات مستقلة قابلة للتوزيع على الصفحات */
  const units = [];
  // خيارات السؤال في سطر واحد إن اتسعت فعلًا بلا التفاف — يُقرَّر في examAutoRender لكل درجة ضغط (الخط الأصغر يتسع لأكثر)
  if(mc.length){
    units.push({ sec:'mc', kind:'head', id:'h-mc',
      html:`<div class="ex-sec-head" data-mid="h-mc"><span>السؤال الأول: اختر الإجابة الصحيحة فيما يلي:</span><span class="ex-badge">${D(mc.length*mark)} درجة</span></div>` });
    mc.forEach((q, i) => {
      units.push({ sec:'mc', kind:'item', id:'mc'+i, html:`
        <div class="ex-q" data-mid="mc${i}">
          <div class="ex-qt"><span class="ex-num">${D(i+1)}</span><span>${escExamText(q.q)}</span></div>
          <div class="ex-opts${TPL === 't5' ? `%%F4:${i}%%` : ''}">
            ${q.o.map((o, j) => `<div class="ex-opt${key && j===q.a ? ' key' : ''}">
              <span class="ex-box"></span><span class="ex-ltr">${L[j]||''}</span><span>${escExamText(o)}</span></div>`).join('')}
          </div>
        </div>` });
    });
  }
  if(tf.length){
    units.push({ sec:'tf', kind:'head', id:'h-tf',
      html:`<div class="ex-sec-head" data-mid="h-tf"><span>السؤال ${mc.length?'الثاني':'الأول'}: ضع علامة (✓) أمام العبارة الصحيحة و(✗) أمام الخاطئة:</span><span class="ex-badge">${D(tf.length*mark)} درجة</span></div>` });
    tf.forEach((q, i) => units.push({ sec:'tf', kind:'item', id:'tf'+i, html:`
      <div class="ex-tf" data-mid="tf${i}">
        <span class="ex-num">${D(i+1)}</span>
        <span>${escExamText(q.q)}</span>
        <span class="ex-tf-c${key && q.a ? ' key' : ''}"><span class="ex-box"></span> صح</span>
        <span class="ex-tf-c${key && !q.a ? ' key' : ''}"><span class="ex-box"></span> خطأ</span>
      </div>` }));
  }

  /* القالب ٤: الصفحات والأقسام كما صمّمها المعلم */
  if(FX){
    const R = examFlexRender(FX, { headHtml, contHead, pageAttrs, box, D, key });
    const warn = [...FX.notes, ...R.warn];
    const cnt = {}; FX.pages.forEach(pg => pg.forEach(x => { cnt[x.t] = (cnt[x.t] || 0) + (x.items ? x.items.length : x.t === 'match' ? x.X.A.length : x.t === 'fill' ? x.X.fill.length : x.X.open.length); }));
    if(st){
      st.textContent = `المعاينة: ${Object.entries(cnt).map(([k, v]) => `${v} ${EX_FLEX_TYPES[k].label}`).join(' + ')} · المجموع ${total} درجة · ${R.n} صفحة A4` + (R.fit ? ' · ضُغطت المسافات لتتسع' : '')
        + (modelCount > 1 ? ` · النموذج (${examModelLetter(modelIndex)}) من ${modelCount}` : '') + (warn.length ? ' · ⚠️ ' + warn.join(' · ') : '') + shortNote;
      st.style.color = R.warn.length || shortNote ? '#B4232F' : '';
    }
    return;
  }
  /* 📷 القالب ٥: ورقة واحدة يصححها الجوال كلها — اختيار + صح/خطأ + وصل بمربعات أرقام */
  if(TPL === 't5'){
    const R = examAutoRender({ AM, units, headHtml, contHead, pageAttrs, box, D, key, mc, tf });
    const warn = [...(AM ? AM.notes : [])];
    if(R.overflow) warn.push('لا تتسع في صفحة واحدة حتى بعد الضغط — قلّل الأسئلة: ما بعد الصفحة الأولى يُصحَّح يدويًا');
    if(st){
      st.textContent = `المعاينة: ${mc.length} اختيار + ${tf.length} صح/خطأ${AM ? ` + ${AM.A.length} وصل` : ''} · المجموع ${total} درجة · ${R.n} صفحة A4`
        + (R.overflow ? '' : ' · 📷 كلها تُصحَّح بالجوال') + (R.fit ? ' · ضُغطت المسافات لتتسع' : '')
        + (modelCount > 1 ? ` · النموذج (${examModelLetter(modelIndex)}) من ${modelCount}` : '') + (warn.length ? ' · ⚠️ ' + warn.join(' · ') : '') + shortNote;
      st.style.color = R.overflow || shortNote ? '#B4232F' : '';
    }
    return;
  }
  /* القالبان ٢ و٣: صفحتان — تُبنى من نفس وحدات الاختيار وصح/خطأ أعلاه، ثم قسمان إضافيان */
  if(X){
    const R = examRenderTemplate({ X, units, headHtml, contHead, footHtml, pageAttrs, box, D, key, mc, tf });
    const warn = [...X.notes]; if(R.overflow) warn.push('المحتوى لا يتسع في صفحتين حتى بعد الضغط — خفّف أسطر الإجابة أو عدد الأسئلة');
    if(st){
      st.textContent = `المعاينة: ${mc.length} اختيار + ${tf.length} صح/خطأ + ${EX_N} وصل + ` + (X.kind==='fill' ? `${EX_N} أكمل الفراغ` : `${X.open.length} أجب`) + ` · المجموع ${total} درجة · ${R.n} صفحة A4` + (R.fit ? ' · ضُغطت المسافات تلقائيًا' : '') + (modelCount > 1 ? ` · النموذج (${examModelLetter(modelIndex)}) من ${modelCount}` : '') + (warn.length ? ' — ⚠ ' + warn.join(' · ') : '') + shortNote;
      st.style.color = R.overflow || shortNote ? '#B4232F' : '';
    }
    return;
  }
  if(st) st.style.color = '';
  // قياس واحد لكل العناصر بعرض الورقة الحقيقي
  const H = examMeasure(pageAttrs, headHtml + units.map(u=>u.html).join('') + footHtml + contHead(''));
  // القياس الحقيقي هو الأصل، وهذه تقديرات احتياطية قريبة منه إن تعذّر القياس
  const est = u => u.kind==='head' ? 32 : (u.sec==='mc' ? 60 : 30);
  const hOf = u => H[u.id] || est(u);
  const headH = H['head'] ? (H['head'] + H['title'] + H['stu'] + 18) : 168;
  const contH = H['cont'] || 28;
  const SEC_PAD = 11;   // إطار القسم وحوافه

  /* التوزيع على صفحات فعلية: الفقرة لا تُقصّ، والقسم يُعاد فتحه بعنوانه عند الانتقال */
  const contOf = head => head.replace('</span><span class="ex-badge"', ' (تابع)</span><span class="ex-badge"');
  const headHOf = sec => (H[sec==='mc'?'h-mc':'h-tf'] || 40) + SEC_PAD;

  const pages = [];
  let page = { groups: [], used: headH };
  const pushPage = () => { pages.push(page); page = { groups: [], used: contH + 18 }; };
  const lastGroup = () => page.groups[page.groups.length - 1];

  units.forEach(u => {
    if(u.kind === 'head'){
      const h = headHOf(u.sec);
      // لا يُفتح قسم في ذيل صفحة لا تتسع لعنوانه وفقرة واحدة على الأقل
      if(page.groups.length && page.used + h + hOf({kind:'item',sec:u.sec,id:'_'}) > EX_INNER_H) pushPage();
      page.groups.push({ sec:u.sec, head:u.html, items:[] });
      page.used += h;
      return;
    }
    const h = hOf(u);
    if(page.used + h > EX_INNER_H){
      const g = lastGroup();
      pushPage();
      if(g) { page.groups.push({ sec:g.sec, head:contOf(g.head), items:[] }); page.used += headHOf(g.sec); }
    }
    const g = lastGroup();
    if(g){ g.items.push({ html:u.html, h }); page.used += h; }
  });
  pages.push(page);

  /*
    الاختبار القصير 5+5 مصمم ليظهر كورقة A4 واحدة.
    لا نحجز مساحة لمعلم/توقيع/ملاحظات لأنها حُذفت من الورقة.
  */
  if(units.length <= 11){
    const groups = [];
    units.forEach(u => {
      if(u.kind === 'head'){
        groups.push({sec:u.sec, head:u.html, items:[]});
      }else{
        const g = groups[groups.length - 1];
        if(g) g.items.push({html:u.html, h:hOf(u)});
      }
    });
    pages.length = 0;
    pages.push({groups, used:EX_INNER_H});
  }

  const serialize = p => p.groups.map(g => `<div class="ex-sec">${g.head}${g.items.map(i=>i.html).join('')}</div>`).join('');
  const bodies = pages.map(serialize);
  bodies[bodies.length - 1] += footHtml;

  const n = bodies.length;
  box.innerHTML = bodies.map((p, i) => `
    <div class="exam-page" ${pageAttrs}>
      ${key ? `<span class="ex-keytag">نموذج الإجابة</span>` : ''}
      ${i===0 ? headHtml : contHead('')}
      ${p}
      <div class="ex-pager">صفحة ${D(i+1)} من ${D(n)}</div>
    </div>`).join('');

  if(st) st.textContent = `المعاينة: ${mc.length} اختيار من متعدد + ${tf.length} صح/خطأ · المجموع ${total} درجة · ${n} صفحة A4` + (modelCount > 1 ? ` · النموذج (${examModelLetter(modelIndex)}) من ${modelCount}` : '') + shortNote;
  if(st) st.style.color = shortNote ? '#B4232F' : '';
}

function examModelLetter(i){
  const letters=['أ','ب','ج','د','هـ','و'];
  return letters[Math.max(0,Math.min(letters.length-1,Number(i)||0))];
}
function syncExamPrintAllButton(){
  const count=Math.max(1,Math.min(6,Number(document.getElementById('ex-model-count')?.value)||1));
  const btn=document.getElementById('ex-print-all-models');
  if(btn) btn.style.display = count > 1 ? '' : 'none';
}

function examModelsChanged(){
  const count=Math.max(1,Math.min(6,Number(document.getElementById('ex-model-count')?.value)||1));
  const sel=document.getElementById('ex-model');
  if(!sel) return;
  const prev=Math.max(0,Math.min(count-1,Number(sel.value)||0));
  sel.innerHTML=Array.from({length:count},(_,i)=>`<option value="${i}">نموذج (${examModelLetter(i)})</option>`).join('');
  sel.value=String(prev);
  sel.disabled=count===1;
  syncExamPrintAllButton();
  try{ renderExamHwBank(); renderExamJsonBank(); }catch(e){}
  examBuild();
}

/* 🧾 أوراق بأسماء الطلاب: كل ورقة عليها اسم صاحبها ورمز من 20 مربعًا مطبوعًا يقرؤه الجوال فيربطها بالطالب وحده.
   الرمز = بصمة رقم الطالب الداخلي (16 بتًا) + ملح (3 بتات) يُختار حتى لا يتكرر رمز بين طلاب الطباعة + بت تكافؤ.
   لا يُرسل للخادم أي اسم: القالب يحفظ مواقع المربعات فقط، والمطابقة في الجوال من قائمة الفصل نفسها. */
function examNamed(){ return !!document.getElementById('ex-named')?.checked; }
function omrStuHash(salt, id){ let h = 0x811c9dc5; const s = salt + ':' + id; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0) & 0xffff; }

/* 🔍 تصغير التقرير ليتّسع لعرض الجوال — بنفس تخطيط الكمبيوتر حرفيًا.
   zoom يصغّر التخطيط كله (لا يقصّه ولا يعيد ترتيبه)، والمقياس يُحسب من
   العرض الطبيعي للتقرير مقسومًا على عرض الشاشة. الطباعة تُلغيه تمامًا. */
const REP_BOXES = '#comp-table .rep-page, #wk-table .rep-page, #ca-body .rep-page, #an-body .rep-page, #p-grades .grades-table-wrap';
function fitReportsToWidth(){
  // أثناء الطباعة لا يُعاد التصغير: الجوال يغيّر المقاس وهو يُعدّ المعاينة فيعود zoom ويخرب التنسيق
  if(/\bprinting-/.test(document.body.className) || window.matchMedia('print').matches){ clearReportZoom(); return; }
  const mobile = window.matchMedia('(max-width:700px)').matches;
  document.querySelectorAll(REP_BOXES).forEach(el=>{
    el.style.zoom = '';                                  // نقيس دائمًا بلا تصغير سابق
    if(!mobile) return;
    const avail = el.parentElement ? el.parentElement.clientWidth : 0;
    const natural = el.scrollWidth;
    if(avail > 0 && natural > avail + 2){
      el.style.zoom = Math.max(0.32, Math.min(1, avail / natural)).toFixed(3);
    }
  });
}
function clearReportZoom(){ document.querySelectorAll(REP_BOXES).forEach(el=>{ el.style.zoom=''; }); }
addEventListener('resize', ()=>{ clearTimeout(window.__fitT); window.__fitT=setTimeout(fitReportsToWidth,150); });
addEventListener('beforeprint', ()=>{ clearTimeout(window.__fitT); clearReportZoom(); });
addEventListener('orientationchange', ()=>setTimeout(fitReportsToWidth,300));
/* الرسم غير متزامن (ينتظر الخادم)، فبدل ملاحقة كل دالة رسم نراقب لوحات
   التقارير: أي جدول جديد يُوسَم فور ظهوره. */
(function watchReportTables(){
  const ids=['p-comprehensive','p-weekly','p-compan','p-grades','p-analysis'];
  const run=()=>{
    const obs=new MutationObserver(()=>{ labelTableCells(document); fitReportsToWidth(); });
    ids.forEach(id=>{ const el=document.getElementById(id); if(el) obs.observe(el,{childList:true,subtree:true}); });
    labelTableCells(document); fitReportsToWidth();
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();
})();


/* ═══════════════ الطلاب ═══════════════ */
function classes() {
  return [...new Set(STUDENTS.map(s => s.cls).filter(Boolean))].sort();
}
function fillClassFilter() {
  const sel = document.getElementById('class-filter');
  const cur = sel.value || '__all__';
  sel.innerHTML = '<option value="__all__">كل الفصول</option>' +
    classes().map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  sel.value = [...sel.options].some(o => o.value === cur) ? cur : '__all__';
}
// تطبيع عربي للبحث: يتجاهل التشكيل والهمزات و«بن»
/* 🔎 مطابقة ذكية لأسماء الطلاب (كل خانات البحث، بالكتابة والصوت) — على نهج بوابة الطالب وأكثر تسامحًا:
   تتجاهل التشكيل والحروف المخفية والهمزات (أ إ آ ا · ى ي · ة ه · ؤ و · ئ ي) و«بن/ابن/بنت»، وتوحّد «عبد الله/عبدالله»،
   وتقبل «ال» أو بدونها، وبداية الكلمة، وخطأ حرف في كلمة من 5 أحرف فأكثر (حرفين من 8)، وأي ترتيب للكلمات */
const STU_STOP={'بن':1,'ابن':1,'بنت':1};
function stuNorm(x){ return String(x||'').normalize('NFKC').replace(/[ً-ٰٟـ]/g,'').replace(/[​-‏‪-‮⁦-⁩؜﻿]/g,'')
  .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/[^\p{L}\p{N}\s]/gu,' ').toLowerCase().replace(/\s+/g,' ').trim(); }
function stuToks(x){ const r=stuNorm(x).split(' ').filter(Boolean), o=[]; for(let i=0;i<r.length;i++){ if((r[i]==='عبد'||r[i]==='ابو'||r[i]==='ابي')&&r[i+1]){ o.push(r[i]+r[++i]); continue; } if(!STU_STOP[r[i]]) o.push(r[i]); } return o; }
const stuBare=t=>t.length>3&&t.startsWith('ال')?t.slice(2):t;
function stuLev(a,b,max){ if(Math.abs(a.length-b.length)>max) return max+1; let p=Array.from({length:b.length+1},(_,j)=>j);
  for(let i=1;i<=a.length;i++){ const c=[i]; let m=i; for(let j=1;j<=b.length;j++){ c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1)); if(c[j]<m) m=c[j]; } if(m>max) return max+1; p=c; } return p[b.length]; }
function stuTokOk(q,t){ if(t.startsWith(q)) return true; const qb=stuBare(q), tb=stuBare(t); if(tb.startsWith(qb)) return true;
  // التسامح من 5 أحرف: «احمد/محمد» بينهما حرف واحد فلا تسامح في القصيرة
  if(qb.length>=5 && !/\d/.test(qb)){ const max=qb.length>=8?2:1; if(stuLev(qb,tb,max)<=max) return true; if(tb.length>qb.length && stuLev(qb,tb.slice(0,qb.length),max)<=max) return true; } return false; }
function stuMatch(q,name){
  const qs=stuToks(q); if(!qs.length) return true; const ns=stuToks(name), used=new Set();
  const ok=qs.every(x=>{ const k=ns.findIndex((t,i)=>!used.has(i)&&stuTokOk(x,t)); if(k<0) return false; used.add(k); return true; });
  if(ok) return true;
  // احتياط لكتابة ملتصقة/مفصولة («عبدالله»، «الشهري سعد») — لبحث من 5 أحرف فقط، وإلا جاء «حمد» بكل «احمد/محمد»
  const qq=stuNorm(q).replace(/\s/g,''); return qq.length>=5 && stuNorm(name).replace(/\s/g,'').includes(qq);
}
function normAr(x){
  return String(x||'')
    .replace(/[\u064B-\u0652\u0640]/g,'')
    .replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
    .replace(/\s+/g,' ').trim();
}

function filtered() {
  // يدعم العناصر الجديدة (مركز الطلاب) والقديمة معاً
  const clsEl = document.getElementById('students-center-class') || document.getElementById('class-filter');
  const c = clsEl ? clsEl.value : '';
  let list = (!c || c === '__all__') ? STUDENTS : STUDENTS.filter(s => s.cls === c);
  const box = document.getElementById('students-center-search') || document.getElementById('st-search');
  const q = box ? normAr(box.value) : '';
  const clr = document.getElementById('st-clear');
  if(clr) clr.style.display = q ? '' : 'none';
  if(!q) return list;
  // كل كلمة بحث يجب أن توجد في الاسم أو الفصل
  const words = q.split(' ').filter(Boolean);
  return list.filter(s=>{
    const hay = normAr(s.name + ' ' + (s.cls||''));
    return stuMatch(box.value, s.name + ' ' + (s.cls||''));
  });
}

/* ↕️ فرز جدول الطلاب */
let STSORT = { key:'name', dir:'asc', hw:'__all__' };
function stFillHw(){
  const sel = document.getElementById('st-hw'); if(!sel) return;
  const c = document.getElementById('class-filter');
  const cls = c ? c.value : '__all__';
  const list = gradedHW().filter(h => (!cls || cls==='__all__') ? true : (hwFor(h, cls)))
                 .slice().sort((a,b)=>(b.at||0)-(a.at||0));
  const cur = sel.value;
  sel.innerHTML = '<option value="__all__">كل الأنشطة</option>' +
    list.map(h=>`<option value="${esc(h.id)}">${esc(h.title)}</option>`).join('');
  sel.value = [...sel.options].some(o=>o.value===cur) ? cur : '__all__';
  STSORT.hw = sel.value;
}

function renderStudents() {
  // الواجهة الجديدة «مركز الطلاب» — إن وُجدت فهي المسؤولة
  if(!document.getElementById('st-list')){
    if(typeof renderStudentsCenter === 'function') renderStudentsCenter();
    if(typeof renderDevWarn === 'function') renderDevWarn();
    if(typeof renderReqs === 'function') renderReqs();
    return;
  }
  stFillHw();
  fillClassFilter();
  const sortBy = (document.getElementById('st-sort')||{}).value || 'need';
  const list = filtered().slice().sort((a, b) => {
    if(sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
    if(sortBy === 'points') return (b.points||0) - (a.points||0);
    if(sortBy === 'grade'){ return perf(b).pct - perf(a).pct; }
    if(sortBy === 'done'){ return perf(b).done - perf(a).done; }
    const pa = perf(a), pb = perf(b);
    if(PERF_ORDER[pa.key] !== PERF_ORDER[pb.key]) return PERF_ORDER[pa.key] - PERF_ORDER[pb.key];
    return (b.points || 0) - (a.points || 0);
  });
  const subEl = document.getElementById('st-sub');
  if(subEl) subEl.textContent = STUDENTS.length ? `${STUDENTS.length} طالب` : '';
  const totEl = document.getElementById('class-total');
  if(totEl) totEl.textContent =
    list.length ? `${list.length} طالب · ${list.reduce((n, s) => n + (s.points || 0), 0)} نقطة` : 'لا أحد';
  renderDevWarn();
  const bar = document.getElementById('perf-bar');
  if(bar){
    const c = { top:0, ok:0, low:0, stop:0, none:0 };
    list.forEach(s=>c[perf(s).key]++);
    bar.innerHTML = list.length
      ? `<span class="pill" style="background:rgba(27,156,107,.14);color:#1B9C6B">متميّز ${c.top}</span>
         <span class="pill" style="background:rgba(46,107,184,.13);color:#2E6BB8">منتظم ${c.ok}</span>
         <span class="pill" style="background:rgba(200,138,46,.15);color:#C88A2E">متعثّر ${c.low}</span>
         <span class="pill" style="background:rgba(180,35,47,.12);color:#B4232F">متوقّف ${c.stop}</span>` : '';
  }

  // 📋 جدول الطلاب — فرز بالنقر على رأس العمود
  const oneHw = STSORT.hw && STSORT.hw !== '__all__' ? HW.find(h=>h.id===STSORT.hw) : null;

  const rows = list.map(s=>{
    const scope = oneHw ? [oneHw] : gradedHW().filter(h => hwFor(h, s.cls));
    let got=0, max=0, done=0, lastAt=0, lateN=0;
    scope.forEach(h=>{
      const hMax = h.max || 20; max += hMax;
      const v = (h.subs||{})[s.id];
      if(v){
        done++;
        got += Math.round(hMax * (v.correct||0) / Math.max(1, v.total||1));
        if(v.at && v.at > lastAt) lastAt = v.at;
        if(h.due && v.at && new Date(v.at).toISOString().slice(0,10) > h.due) lateN++;
      }
    });
    return { s, got, max, done, of: scope.length, lastAt, lateN,
             pct: max ? Math.round(got/max*100) : 0 };
  });

  const dir = STSORT.dir === 'desc' ? -1 : 1;
  rows.sort((a,b)=>{
    const k = STSORT.key;
    if(k === 'name') return a.s.name.localeCompare(b.s.name,'ar') * dir;
    if(k === 'cls')  return String(a.s.cls||'').localeCompare(String(b.s.cls||''),'ar') * dir
                            || a.s.name.localeCompare(b.s.name,'ar');
    let x,y;
    if(k === 'grade'){ x=a.got; y=b.got; }
    else if(k === 'pct'){ x=a.pct; y=b.pct; }
    else if(k === 'done'){ x=a.done; y=b.done; }
    else if(k === 'date'){ x=a.lastAt; y=b.lastAt; }
    else if(k === 'points'){ x=a.s.points||0; y=b.s.points||0; }
    else { x=a.got; y=b.got; }
    if(x === y) return a.s.name.localeCompare(b.s.name,'ar');
    return (x-y) * dir;
  });

  const ar = k => STSORT.key === k ? (STSORT.dir==='desc' ? ' ▼' : ' ▲') : '';
  const label = oneHw ? esc(oneHw.title) : 'الإجمالي';

  document.getElementById('st-list').innerHTML = rows.length ? `
    <div style="overflow-x:auto">
    <table class="gt">
      <thead><tr>
        <th style="width:34px">#</th>
        <th style="text-align:start;cursor:pointer" onclick="stSort('name')">الطالب${ar('name')}</th>
        <th style="cursor:pointer;width:74px" onclick="stSort('cls')">الفصل${ar('cls')}</th>
        <th style="cursor:pointer;width:78px" onclick="stSort('grade')">الدرجة${ar('grade')}<span class="dt" style="color:#9FB2CC">${label}</span></th>
        <th style="cursor:pointer;width:60px" onclick="stSort('pct')">%${ar('pct')}</th>
        <th style="cursor:pointer;width:70px" onclick="stSort('done')">سلّم${ar('done')}</th>
        <th style="cursor:pointer;width:96px" onclick="stSort('date')">آخر تسليم${ar('date')}</th>
        <th style="cursor:pointer;width:66px" onclick="stSort('points')">النقاط${ar('points')}</th>
        <th style="width:74px">—</th></tr></thead>
      <tbody>
        ${rows.map((r,i)=>`<tr${r.done===0?' style="background:rgba(214,69,91,.05)"':''}>
          <td style="color:var(--ink-soft);font-size:.76rem">${i+1}</td>
          <td class="nm" title="${esc(r.s.name)}">${esc(r.s.name)}${r.lateN?' <span style="color:#C88A2E" title="تسليم متأخر">⏰</span>':''}</td>
          <td style="font-size:.78rem">${esc(r.s.cls||'—')}</td>
          <td><b>${r.done?r.got:'—'}</b>${r.done?`<span class="dt">من ${r.max}</span>`:''}</td>
          <td style="color:${r.done?(r.pct>=80?'var(--tick)':r.pct>=50?'#C88A2E':'var(--pen)'):'#BBB'}">${r.done?r.pct+'%':'—'}</td>
          <td style="color:${r.done===r.of?'var(--tick)':r.done===0?'var(--pen)':'#C88A2E'}">${r.done}/${r.of}</td>
          <td style="font-size:.76rem;font-weight:400">${r.lastAt?fmtDate(r.lastAt):'—'}</td>
          <td style="color:var(--tick)">${r.s.points||0}</td>
          <td>
            <button class="btn ghost sm" onclick="openStudentForm('${r.s.id}')" title="تعديل">✏️</button>
            <button class="btn ghost sm" onclick="delStudent('${r.s.id}')" title="حذف">🗑️</button>
          </td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr style="background:#EFF3F8;font-weight:700">
        <td colspan="3" style="text-align:start">المتوسط</td>
        <td>${rows.length?Math.round(rows.reduce((n,r)=>n+r.got,0)/rows.length):0}</td>
        <td>${rows.length?Math.round(rows.reduce((n,r)=>n+r.pct,0)/rows.length):0}%</td>
        <td>${rows.reduce((n,r)=>n+r.done,0)}/${rows.reduce((n,r)=>n+r.of,0)}</td>
        <td></td>
        <td>${rows.reduce((n,r)=>n+(r.s.points||0),0)}</td>
        <td></td>
      </tr></tfoot>
    </table></div>`
    : (document.getElementById('st-search') && document.getElementById('st-search').value.trim())
      ? `<div class="empty"><span class="big">🔍</span>لا نتائج لـ «${esc(document.getElementById('st-search').value.trim())}»
         <div style="margin-top:.6rem"><button class="btn ghost sm" onclick="clearSearch()">مسح البحث</button></div></div>`
      : `<div class="empty"><span class="big">👥</span>أضف طلابك لتبدأ — أو استورد كشف الأسماء من تبويب البيانات.</div>`;
}

/* 🚩 فحص النزاهة: جهاز واحد استُخدم لأكثر من طالب عبر كل الأنشطة */
function deviceAudit(){
  const byDev = {};   // بصمة الجهاز → { اسم الطالب → [أسماء الأنشطة] }
  HW.forEach(h=>{
    Object.entries(h.subs || {}).forEach(([sid, v])=>{
      const dv = v.dev; if(!dv) return;
      const st = byId(sid); if(!st) return;
      byDev[dv] = byDev[dv] || {};
      (byDev[dv][st.name] = byDev[dv][st.name] || []).push(h.title);
    });
  });
  return Object.entries(byDev)
    .map(([dv, names])=>({ dv, names: Object.entries(names) }))
    .filter(x=>x.names.length > 1)
    .sort((a,b)=>b.names.length - a.names.length);
}

function renderDevWarn(){
  // قسم الأجهزة أُزيل من بطاقة التنبيهات بطلب المعلم — تفاصيله باقية في نافذة «مركز اليوم» فقط (زر «تحققت»).
  const box = document.getElementById('dev-warn'); if(!box) return;
  const list = deviceAudit();
  const badge = document.getElementById('dev-warn-count');
  if(badge){ badge.textContent = list.length; badge.style.display = list.length ? '' : 'none'; }
  if(!list.length){ box.innerHTML = ''; return; }
  box.innerHTML = `
    <div class="sheet" style="background:rgba(214,69,91,.07);border:1.5px solid var(--pen);margin-bottom:.9rem">
      <div class="sheet-head" style="margin-bottom:.4rem">
        <h2 style="color:var(--pen)">🚩 جهاز واحد لأكثر من طالب</h2>
        <span class="spacer"></span>
        <span class="pill due">${list.length}</span>
      </div>
      <p style="margin:0 0 .6rem;color:var(--ink-soft);font-size:.84rem">
        قد يكونون إخوة على جوال واحد — وقد يكون انتحالاً. تحقّق بنفسك.
      </p>
      ${list.map((x,i)=>`
        <div class="ruled" style="padding:.6rem .9rem">
          <div class="muted" style="font-size:.74rem;margin-bottom:.3rem">جهاز ${i+1}</div>
          ${x.names.map(([nm, acts])=>`<div class="row" style="gap:.4rem;margin-bottom:.22rem">
            <b style="flex:1">${esc(nm)}</b>
            <span class="pill quiet" style="font-size:.74rem">${esc([...new Set(acts)].join(' · '))}</span>
          </div>`).join('')}
        </div>`).join('')}
    </div>`;
}

/* ═══════════ 📥 استيراد الطلاب من ملف ═══════════ */

// يحمّل مكتبة عند الحاجة فقط — الملف يبقى يعمل بلا إنترنت لبقية المهام
function loadLib(src, check){
  return new Promise((resolve, reject)=>{
    if(check()) return resolve();
    const el = document.createElement('script');
    el.src = src;
    el.onload = ()=> check() ? resolve() : reject(new Error('lib'));
    el.onerror = ()=> reject(new Error('net'));
    document.head.appendChild(el);
  });
}

// أعمدة تُتجاهل: الأرقام والسجل المدني والصف وما شابه
const IMP_SKIP = /^(م|#|رقم|ت|تسلسل|السجل|سجل|هوية|الهوية|رقم الهوية|السجل المدني|الجنس|الصف|الفصل|الشعبة|المرحلة|الجنسية|الحالة|ملاحظات|no|id|serial|class|grade|gender)$/i;
// عبارات ترويسة/تذييل لا تُعدّ أسماء
const IMP_NOISE = new RegExp([
  'اسم الطالب','أسماء الطلاب','اسم الطالبة','قائمة الطلاب','سجل متابعة','سجل الطلاب',
  'كشف','صفحة','المجموع','وزارة','المملكة','الإدارة','المدرسة','مدير','المعلم','معلم المادة',
  'الفصل الدراسي','العام الدراسي','العام الدر','رقم الجلوس','الفترة','التوقيع',
  'درجة','تقويمات','مشاركة','أنشطة صفية','واجبات','تطبيقات','مشاريع','بحوث',
  '^الصف\\s*[:：]','^الفصل\\s*[:：]','^المادة\\s*[:：]','^المعلم\\s*[:：]','^اليوم','^التاريخ'
].join('|'));
const looksLikeName = v => {
  const t = String(v||'').trim();
  if(t.length < 5) return false;                    // اسم قصير جداً
  if(/^[\d\u0660-\u0669]+$/.test(t)) return false;  // أرقام فقط
  if(/^[\d\u0660-\u0669\s\-\/.:]+$/.test(t)) return false;   // تواريخ
  if(IMP_SKIP.test(t)) return false;                // عنوان عمود
  if(IMP_NOISE.test(t)) return false;               // ترويسة أو تذييل
  const letters = (t.match(/[\u0621-\u064AA-Za-z]/g)||[]).length;
  return letters >= 4 && t.split(/\s+/).length >= 2; // كلمتان فأكثر
};


async function readExcelStudentRecords(file, opts){   // opts.phones: يقرأ أيضًا عمود جوال ولي الأمر (لقائمة التصويت)
  await loadLib('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
                ()=> typeof XLSX !== 'undefined');

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type:'array', cellDates:false });
  const records = [];

  const clean = value => String(value||'').trim().replace(/\s+/g,' ');

  const findLabelValue = (rows, labels) => {
    const wanted = labels.map(x=>clean(x).replace(/[:：]/g,''));
    for(let r=0;r<Math.min(rows.length,20);r++){
      for(let c=0;c<rows[r].length;c++){
        const cell=clean(rows[r][c]).replace(/[:：]/g,'');
        if(!cell) continue;
        if(wanted.some(label=>cell===label || cell.includes(label))){
          for(let k=c+1;k<Math.min(rows[r].length,c+6);k++){
            const value=clean(rows[r][k]);
            if(value && !wanted.includes(value.replace(/[:：]/g,''))) return value;
          }
        }
      }
    }
    return '';
  };

  wb.SheetNames.forEach(sn=>{
    const sheet = wb.Sheets[sn];

    // blankrows:false removes empty Excel rows, so array indexes cannot be used
    // to address B2/B8 reliably. Read the actual worksheet cells first.
    const cellValue = address => clean(sheet[address]?.v);

    const rows = XLSX.utils.sheet_to_json(
      sheet,
      {header:1, blankrows:true, defval:''}
    ).map(r=>Array.isArray(r)?r:[]);

    let grade = cellValue('B2');
    let section = cellValue('B8');

    // Fallback for exports whose metadata is stored in different cells.
    if(!grade) grade = findLabelValue(rows, ['الصف']);
    if(!section) section = findLabelValue(rows, ['الفصل','الشعبة']);

    // Final fallback: inspect the first 20 physical worksheet rows,
    // including merged-cell layouts.
    if(!grade || !section){
      const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null;
      if(range){
        for(let r=range.s.r; r<=Math.min(range.e.r, 19); r++){
          for(let c=range.s.c; c<=Math.min(range.e.c, 23); c++){
            const address = XLSX.utils.encode_cell({r,c});
            const value = clean(sheet[address]?.v);
            if(!value) continue;

            if(!grade && /^(الصف|المرحلة)$/u.test(value.replace(/[:：]/g,''))){
              for(let k=c+1; k<=Math.min(c+5, range.e.c); k++){
                const candidate = clean(sheet[XLSX.utils.encode_cell({r,k})]?.v);
                if(candidate && !/^(الصف|المرحلة)$/u.test(candidate.replace(/[:：]/g,''))){
                  grade = candidate;
                  break;
                }
              }
            }

            if(!section && /^(الفصل|الشعبة|القسم)$/u.test(value.replace(/[:：]/g,''))){
              for(let k=c+1; k<=Math.min(c+5, range.e.c); k++){
                const candidate = clean(sheet[XLSX.utils.encode_cell({r,k})]?.v);
                if(candidate && !/^(الفصل|الشعبة|القسم)$/u.test(candidate.replace(/[:：]/g,''))){
                  section = candidate;
                  break;
                }
              }
            }
          }
        }
      }
    }

    const classLabel=[grade,section].filter(Boolean).join(' - ');

    const nameRows=rows.filter(row=>row.some(v=>looksLikeName(v)));
    if(!nameRows.length) return;

    const width=Math.max(...nameRows.map(r=>r.length));
    let best=-1,bestScore=0;
    for(let c=0;c<width;c++){
      let score=0;
      nameRows.forEach(r=>{if(looksLikeName(r[c])) score++;});
      if(score>bestScore){bestScore=score;best=c;}
    }

    // 📱 عمود الجوال: عنوانه (جوال/هاتف — ويُفضَّل «ولي الأمر»)، وإلا أكثر عمود خلاياه أرقام جوال سعودية
    let phCol=-1;
    if(opts&&opts.phones){ opts._hdrRow=-1;
      const digits=v=>String(v||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g,'');
      const isPh=v=>/^(?:966|0)?5\d{8}$/.test(digits(v));
      let hdr=-1, hdrScore=0;
      rows.slice(0,40).forEach((r,ri)=>r.forEach((v,c)=>{ const t=clean(v); if(!/جوال|هاتف|موبايل|تواصل/.test(t)) return; const sc=/ولي|الأب|الام|الأم/.test(t)?2:1; if(sc>hdrScore){ hdrScore=sc; hdr=c; opts._hdrRow=ri; } }));
      if(hdr>=0 && nameRows.some(r=>isPh(r[hdr]))) phCol=hdr;
      else { let bs=0; for(let c=0;c<width;c++){ const sc=nameRows.filter(r=>isPh(r[c])).length; if(sc>bs){ bs=sc; phCol=c; } } if(bs<nameRows.length*.3) phCol=-1; }
      opts._digits=digits; if(phCol<0) opts._hdrRow=-1;
    }
    if(best>=0){
      nameRows.forEach(r=>{
        const name=clean(r[best]);
        if(phCol>=0 && opts._hdrRow>=0 && rows.indexOf(r)<=opts._hdrRow) return;   // ما فوق صف العناوين بيانات الملف (الصف، المدرسة) لا طلاب
        if(looksLikeName(name)) records.push(phCol>=0?{name,cls:classLabel,phone:opts._digits(r[phCol])}:{name,cls:classLabel});
      });
    }
  });

  return records;
}

/* ═══════════════ الأنشطة ═══════════════ */
function renderHw() {
  // لا تعرض سجلات مولد الاختبار المؤقتة حتى لو بقيت من نسخة قديمة.
  if(Array.isArray(HW)) HW = HW.filter(h => h && !h.__examProxy);
  renderBackupWarn();
  renderPubWarn();
  const hwFilter = (document.getElementById('hw-filter') || {}).value || 'all';
  /* فرز حسب النوع: القائمة تُبنى من الأنواع الموجودة فعلًا مع عددها */
  const kindSel = document.getElementById('hw-kind-filter');
  const kindOf = h => h.remedial ? 'remedial' : (isGamesKind && isGamesKind(h) ? 'games' : (h.kind || 'normal'));
  const KIND_LABELS = { normal:'📝 نشاط', reading:'📖 فهم قرائي', games:'🎮 ألعاب', files:'📎 تسليم ملفات', lab:'🔬 مختبر افتراضي', style:'🧠 أنماط التعلّم', diag:'🔍 اختبار تشخيصي', remedial:'🩹 علاجي' };
  if(kindSel){
    const cur = kindSel.value, counts = {};
    HW.forEach(h => { const k = kindOf(h); counts[k] = (counts[k]||0) + 1; });
    kindSel.innerHTML = `<option value="">كل الأنواع (${HW.length})</option>` + Object.keys(KIND_LABELS).filter(k => counts[k])
      .map(k => `<option value="${k}">${KIND_LABELS[k]} (${counts[k]})</option>`).join('');
    kindSel.value = counts[cur] ? cur : '';
  }
  const hwKind = kindSel ? kindSel.value : '';
  const today = new Date();
  const list = HW.slice().sort((a, b) => (b.at || 0) - (a.at || 0)).filter(h => !hwKind || kindOf(h) === hwKind).filter(h => {
    const overdue = h.due && new Date(h.due + 'T23:59:59') < today;
    if(hwFilter === 'draft') return !h.published;
    if(hwFilter === 'dirty') return !!h.dirty;
    if(hwFilter === 'open') return !!h.published && !h.dirty && !overdue;
    if(hwFilter === 'overdue') return !!overdue && !!h.published;
    if(hwFilter === 'empty') return (h.kind === 'files' || h.kind === 'lab') ? false : !activityReady(h);
    return true;
  });
  document.getElementById('hw-sub').textContent = HW.length ? `${HW.length} نشاط` : '';
  const selectableVisible = list.filter(h => h);
  const selectedVisible = selectableVisible.filter(h => HW_REPUBLISH_SELECTED.has(h.id));
  const bulkBar = selectableVisible.length ? `
    <div class="sheet" style="margin:.65rem 0">
      <div class="row" style="gap:.55rem;flex-wrap:wrap">
        <label class="row" style="gap:.45rem;cursor:pointer;font-size:.86rem">
          <input type="checkbox" ${selectableVisible.length && selectedVisible.length===selectableVisible.length?'checked':''}
            onchange="toggleAllHwSelection(this.checked)">
          تحديد الأنشطة الظاهرة
        </label>
        <span class="pill quiet" style="font-weight:700">☑ ${selectedVisible.length} ${selectedVisible.length===1 ? 'نشاط محدد' : 'أنشطة محددة'}</span>
        <span class="spacer"></span>
        <button class="btn tick sm" onclick="republishSelectedHw()" ${selectedVisible.length?'':'disabled'}>🔄 إعادة نشر الرابط</button>
        <button class="btn pen sm" onclick="deleteSelectedHw()" ${selectedVisible.length?'':'disabled'}>🗑️ حذف الأنشطة</button>
      </div>
    </div>` : '';
  document.getElementById('hw-list').innerHTML = bulkBar + (list.length ? list.map(h => {
    const subs = Object.keys(h.subs || {}).length;
    const pool = hwPool(h).length;
    const late = h.due && new Date(h.due) < new Date(new Date().toDateString());
    const isFiles = h.kind === 'files' || h.kind === 'lab';
    const isLab = h.kind === 'lab';
    const isGames = (h.kind === 'games' || h.kind === 'game');
    const canRepublish = !!h.published && activityReady(h);
    return `<div class="sheet">
      <div class="sheet-head" style="margin-bottom:.55rem">
        <label class="row" style="gap:.55rem;min-width:0;cursor:pointer" title="تحديد هذا النشاط للإجراء الجماعي">
          <input type="checkbox" ${HW_REPUBLISH_SELECTED.has(h.id)?'checked':''} onchange="toggleHwSelection('${h.id}',this.checked)" aria-label="تحديد ${esc(h.title)}">
          <h2 style="margin:0">${hwTitleHTML(h)}</h2>
        </label>
        <span class="spacer"></span>
        ${h.due ? `<span class="pill ${late ? 'due' : 'quiet'}">${late ? 'انتهى' : 'يُغلق'} ${esc(h.due)}</span>` : ''}
        ${(h.kind||'normal')==='normal'
          ? `${hwIsNafs(h)?`<span class="pill" style="background:rgba(46,107,184,.14);color:#2E6BB8">🧭 نافس · ${h.nfMode==='sim'?'⏱️ محاكاة':'🎯 تدريب'}</span>`:''}<span class="pill quiet">${h.max || 20} درجة</span><span class="pill pts">${Number(h.pts)||0} نقطة</span>`
          : h.kind==='lab'
            ? `<span class="pill" style="background:rgba(46,107,184,.14);color:#2E6BB8">🔬 مختبر</span><span class="pill quiet">${h.max || 20} درجة</span><span class="pill pts">${Number(h.pts)||0} نقطة</span>`
          : h.kind==='diag'
            ? `<span class="pill" style="background:rgba(46,107,184,.14);color:#2E6BB8">🔍 تشخيصي</span>`
            : h.kind==='style'
              ? `<span class="pill" style="background:rgba(138,90,180,.14);color:#7B4FA8">🧠 أنماط التعلّم</span>`
              : h.kind==='reading'
                ? `<span class="pill" style="background:rgba(27,156,107,.14);color:#1B9C6B">📖 فهم قرائي</span>`
                : (h.kind==='games' || h.kind==='game')
                  ? `<span class="pill" style="background:rgba(200,138,46,.14);color:#A66F0A">🎮 ألعاب</span>`
                  : `<span class="pill" style="background:rgba(46,107,184,.14);color:#2E6BB8">📎 تسليم ملفات</span>`}
        ${hwGradePill(h)}
        ${isFiles
          ? (!h.published ? '<span class="pill due">📤 لم يُنشر</span>'
             : h.dirty ? '<span class="pill" style="background:rgba(200,138,46,.16);color:#C88A2E">🔄 تعديل غير منشور</span>'
             : `<span class="pill" style="background:rgba(27,156,107,.14);color:var(--tick)" title="${h.publishedAt ? 'آخر نشر: '+new Date(h.publishedAt).toLocaleString('ar-SA') : ''}">✅ منشور${h.publishedAt ? ' · '+fmtDate(h.publishedAt) : ''}</span>`)
          : isGames ? !gameReady(h) ? `<span class="pill due">⚠️ محتوى اللعبة غير مكتمل</span>` : (!h.published ? '<span class="pill due">📤 لم يُنشر</span>' : h.dirty ? '<span class="pill" style="background:rgba(200,138,46,.16);color:#C88A2E">🔄 تعديل غير منشور</span>' : `<span class="pill" style="background:rgba(27,156,107,.14);color:var(--tick)">✅ منشور</span>`)
          : !(h.qs||[]).length ? '<span class="pill due">⚠️ بلا مهام</span>'
          : !h.published ? '<span class="pill due">📤 لم يُنشر</span>'
          : h.dirty ? '<span class="pill" style="background:rgba(200,138,46,.16);color:#C88A2E">🔄 تعديل غير منشور</span>'
          : `<span class="pill" style="background:rgba(27,156,107,.14);color:var(--tick)" title="${h.publishedAt ? 'آخر نشر: '+new Date(h.publishedAt).toLocaleString('ar-SA') : ''}">✅ منشور${h.publishedAt ? ' · '+fmtDate(h.publishedAt) : ''}</span>`}
      </div>
      <div class="row" style="font-size:.85rem;color:var(--ink-soft)">
        <span>${esc(hwClsLabel(h))}</span>
        <span>·</span>
        <span>سلّم ${subs} من ${pool}</span>
        <span class="spacer"></span>
        ${isLab
          ? `<button class="btn ghost sm" onclick="openHwForm('${h.id}')">${esc(labSummary(h))}</button>`
          : isFiles
          ? '<span class="pill quiet" style="font-size:.76rem">لا توجد أسئلة — المطلوب إرفاق العمل</span>'
          : isGames
            ? `<button class="btn ghost sm" onclick="openStudentGameSettings('${h.id}')">${gamesSummary(h)}</button>`
            : `<button class="btn ghost sm" onclick="openQs('${h.id}')">المهام (${(h.qs||[]).length})</button>`}
        ${!isGames && activityGames(h).length ? `<button class="btn ghost sm" onclick="openStudentGameSettings('${h.id}')" title="النشاط يصل الطالب كأسئلة، وألعابه تظهر في قسم الألعاب">${gamesSummary(h)} · منفصلة</button>` : ''}
        <button class="btn ${(!h.published || h.dirty) ? 'pen' : 'tick'} sm" onclick="openLink('${h.id}')"
          ${!activityReady(h)?`disabled title="${esc(activityEmptyMsg(h))}"`:''}>${
            !h.published ? '📤 انشر' : h.dirty ? '🔄 أعد النشر' : '🔗 الرابط'}</button>
        ${h.kind==='reading' && (h.qs||[]).length ? `<button class="btn ghost sm hw-icon-btn" onclick="openReadingPrint('${h.id}')" title="طباعة ورقة الفهم القرائي" aria-label="طباعة ورقة الفهم القرائي">🖨️</button>` : ''}
        <button class="btn ghost sm hw-icon-btn" onclick="openReport('${h.id}')" title="تقرير النشاط" aria-label="تقرير النشاط">📊</button>
        <button class="btn ghost sm hw-icon-btn" onclick="pullResults('${h.id}')" title="تحديث النتائج" aria-label="تحديث النتائج">🔄</button>
        <button class="btn ghost sm" type="button" onclick="openActivityMessage('${h.id}')" title="رسالة جاهزة للإرسال">💬 الرسالة</button>
        ${subs && h.kind==='style' ? `<button class="btn ghost sm" onclick="openStylesReport('${h.id}')" title="تقرير أنماط التعلّم">🧠 التقرير</button>` : ''}
        ${subs && h.kind!=='style' && h.kind!=='lab' ? `<button class="btn ghost sm hw-icon-btn" onclick="remedialHw('${h.id}')" title="نشاط علاجي من الأخطاء" aria-label="نشاط علاجي من الأخطاء">🩹</button>` : ''}
        <button class="btn ghost sm hw-icon-btn" onclick="dupHw('${h.id}')" title="نسخ النشاط لفصل آخر" aria-label="نسخ النشاط لفصل آخر">📋</button>
        <button class="btn ghost sm hw-icon-btn" onclick="openHwForm('${h.id}')" title="تعديل النشاط" aria-label="تعديل النشاط">✏️</button>
        <button class="btn ghost sm hw-icon-btn danger-icon" onclick="delHw('${h.id}')" title="حذف النشاط" aria-label="حذف النشاط">🗑️</button>
      </div>
    </div>`;
  }).join('')
    : (HW.length?`<div class="empty"><span class="big">🔎</span>لا توجد أنشطة مطابقة للتصفية الحالية. <button class="btn sm" type="button" onclick="document.getElementById('hw-filter').value='all';document.getElementById('hw-kind-filter').value='';renderHw()">مسح التصفية</button></div>`:`<div class="empty"><span class="big">📋</span>لا توجد أنشطة بعد. أنشئ نشاطاً وحدّد نقاطه، ثم تابع من سلّم.</div>`));
}

function openHwForm(id) {
  const h = id ? HW.find(x => x.id === id) : null;
  openModal(`
    <h2>${h ? 'تعديل نشاط' : 'نشاط جديد'}</h2>
    <div class="field" style="margin-bottom:.35rem"><label>ما نوع هذا النشاط؟</label></div>
    <div class="kind-tiles">
      ${HW_KINDS.map(k=>`<button type="button" class="kind-tile" data-kind="${k.v}"
        aria-pressed="${hwFormKind(h)===k.v?'true':'false'}"
        onclick="hwPickKind('${k.v}')">
        <span class="ki">${k.ic}</span><b>${k.t}</b><small>${k.d}</small></button>`).join('')}
    </div>
    <select id="h-kind" style="display:none" onchange="hwKindChanged()" data-new="${h?'':'1'}">
      ${HW_KINDS.map(k=>`<option value="${k.v}" ${hwFormKind(h)===k.v?'selected':''}>${k.t}</option>`).join('')}
    </select>
    <div class="field"><label>العنوان <span class="muted" style="font-weight:400">(يظهر للطالب بنوعه كما هنا)</span></label>
      <div class="hw-title-row">${hwKindChip(hwFormKind(h), true)}<input class="inp" id="h-title" value="${h ? esc(h.title) : ''}" placeholder="مثال: مراجعة درس الثدييات"></div></div>
    <div class="grid2">
      <div class="field"><label>الفصل</label>
        ${hwClsPickerHTML(h,'h-cls')}</div>
      <div class="field"><label>موعد الإغلاق</label>
        <input class="inp" type="date" id="h-due" value="${h ? esc(h.due || '') : ''}"></div>
    </div>
    <div>
      <span id="h-kind-note" style="font-size:.76rem;color:var(--ink-soft);margin:0 0 .5rem;display:block"></span>
      <div id="h-brief-wrap" style="display:none;margin-top:.65rem">
        <label class="field"><span>📋 المطلوب من الطالب</span>
          <textarea class="inp" id="h-brief" rows="3" placeholder="صوّر مثالاً على التغير الكيميائي في مطبخ بيتك، واشرح لماذا هو كيميائي لا فيزيائي.">${h && h.brief ? esc(h.brief) : ''}</textarea>
        </label>
        <label class="field"><span>📎 ما يُسلّمه</span>
          <input class="inp" id="h-deliver" placeholder="صورة واحدة + سطران شرحًا · أو مقطع 30 ثانية" value="${h && h.deliver ? esc(h.deliver) : ''}">
        </label>
        <label class="field"><span>✅ يُقبل إذا</span>
          <input class="inp" id="h-accept" placeholder="ظهر التغير في الصورة وذكرتَ دليلاً واحدًا" value="${h && h.accept ? esc(h.accept) : ''}">
        </label>
        <div class="row" style="gap:.4rem;flex-wrap:wrap;margin-top:.2rem">
          <button type="button" class="btn ghost sm" onclick="briefTemplate('science')">قالب تجربة علمية</button>
          <button type="button" class="btn ghost sm" onclick="briefTemplate('observe')">قالب رصد ظاهرة</button>
          <button type="button" class="btn ghost sm" onclick="briefTemplate('build')">قالب نموذج/مجسّم</button>
          <button type="button" class="ai-btn sm" onclick="openExperimentAIGenerator()"><span class="ai-mark">✦</span> توليد تجربة</button>
        </div>
        <select class="inp proj-tpl-pick" id="h-proj-tpl" onchange="projTemplate(this.value)" aria-label="مشاريع جاهزة">
          <option value="">📚 مشاريع جاهزة (${PROJ_TEMPLATES.length}) — اختر مشروعًا</option>
          ${PROJ_DOMAINS.map(([d,t])=>`<optgroup label="${t}">${PROJ_TEMPLATES.map((x,i)=>x.d===d?`<option value="${i}">${esc(x.t)}</option>`:'').join('')}</optgroup>`).join('')}
        </select>
        <input type="hidden" id="h-illus" value="${h && h.kind==='files' && h.illus ? esc(h.illus) : ''}">
        <div id="h-illus-prev" class="illus-prev"></div>
        <small style="display:block;color:var(--ink-soft);font-size:.74rem;margin-top:.4rem;line-height:1.7">
          «يُقبل إذا» يعطي الطالب معيار النجاح مسبقًا — ويعطيك معيار مراجعة ثابتًا لكل التسليمات.
        </small>
      </div>
      <div id="h-reading-wrap" style="display:none;margin-top:.65rem;padding:.75rem;border:1px solid var(--rule);border-radius:12px;background:rgba(27,156,107,.04)">
        <div class="field"><label>📖 النص القرائي الأساسي</label>
          <div style="display:flex;gap:.45rem;align-items:center;flex-wrap:wrap;margin:.35rem 0 .5rem">
            <label class="ai-btn sm quiet" id="h-reading-pdf-btn" style="cursor:pointer"><span class="ai-mark">📄</span> استخراج النص من PDF<input type="file" accept="application/pdf,.pdf" style="display:none" onchange="readingExtractPdfAndStructure(this)"></label>
            <button type="button" class="ai-btn sm quiet" onclick="readingOrganizeCurrentText()"><span class="ai-mark">✦</span> تنظيم النص الحالي</button><button type="button" class="ai-btn sm quiet" onclick="bkPick('h-reading-text','h-reading-pdf-status')"><span class="ai-mark">📖</span> من مكتبة الكتب</button>
            <span id="h-reading-pdf-status" style="font-size:.78rem;color:var(--ink-soft)"></span>
          </div>
          <div id="h-reading-text-bk"></div>
          <textarea class="inp" id="h-reading-text" rows="9" placeholder="سيُنشأ هنا النص التعليمي الأساسي مرتبًا من الدرس. يمكنك أيضًا كتابته أو تعديله يدويًا.">${h && h.reading ? esc(h.reading.text||'') : ''}</textarea>
          <small style="color:var(--ink-soft);font-size:.74rem;line-height:1.7">يقرأ النظام PDF، يحدد متن الدرس، يستبعد الأهداف والأسئلة والتمارين والهوامش، ثم ينظم النص التعليمي دون تلخيصه ليكون أساسًا لأسئلة الفهم القرائي.</small>
        </div>
        <div class="field"><label>مراحل الفهم القرائي المستخدمة</label>
          <div class="row" style="gap:.5rem;flex-wrap:wrap">
            ${[['pre','🎯 قبل القراءة'],['during','📖 أثناء القراءة'],['post','🧠 بعد القراءة'],['apply','🔬 التطبيق']].map(([v,l])=>`
              <label class="pill quiet" style="cursor:pointer;padding:.45rem .65rem">
                <input type="checkbox" class="rd-stage" value="${v}" ${(h&&h.reading&&Array.isArray(h.reading.stages)?h.reading.stages:['pre','during','post']).includes(v) ? 'checked':''}> ${l}
              </label>`).join('')}
          </div>
        </div>
        <div class="field" style="margin-bottom:.15rem"><label>📎 هل يتطلب التطبيق مرفقًا؟</label>
          <label class="row" style="gap:.45rem;font-size:.84rem;cursor:pointer">
            <input type="checkbox" id="h-reading-attach" ${h&&h.reading&&h.reading.requireAttachment?'checked':''}>
            <span>نعم، سيظهر للطالب تنبيه لرفع صورة/PDF/فيديو في مرحلة التطبيق</span>
          </label>
        </div>
        <div class="row" style="gap:.4rem;flex-wrap:wrap;margin-top:.45rem">
          <button type="button" class="btn ghost sm" onclick="readingDemoTemplate()">📖 تعبئة قالب فهم قرائي تجريبي</button>
          <button type="button" class="ai-btn sm" onclick="openReadingAIGenerator()"><span class="ai-mark">✦</span> توليد النص والأسئلة بالذكاء الاصطناعي</button>
          <button type="button" class="btn ghost sm" onclick="openReadingTemplateHelp()">ℹ️ كيف سيظهر للطالب؟</button>
        </div>
        <div id="reading-ai-ready" style="display:none;margin-top:.6rem;padding:.65rem .75rem;border:1px solid #BFE6D6;border-radius:12px;background:#EDF8F4;color:#176B52;font-size:.82rem;line-height:1.75;font-weight:700">
          ✅ تم إنشاء النص والأسئلة بنجاح. راجع المحتوى ثم اضغط <b>حفظ</b>، وبعد الحفظ يمكنك <b>نشر النشاط للطلاب</b>.
        </div>
        <small style="display:block;color:var(--ink-soft);font-size:.74rem;line-height:1.7">
          القالب يعبّي النص والمراحل والأسئلة تلقائيًا، ثم يمكنك تعديل أي شيء قبل الحفظ والنشر.
        </small>
      </div>

      <div id="h-lab-wrap" style="display:none;margin-top:.65rem;padding:.75rem;border:1px solid var(--rule);border-radius:12px;background:rgba(46,107,184,.04)">
        <div class="field"><label>🔬 الموضوع</label>
          <select class="inp" id="h-lab-topic" onchange="labTopicChanged()">${LAB_TOPICS.map(([v,t])=>`<option value="${v}" ${((h&&h.lab&&h.lab.topic)||'mixtures')===v?'selected':''}>${t}</option>`).join('')}</select>
          <small id="h-lab-topic-note" style="color:var(--ink-soft);font-size:.74rem;line-height:1.7"></small></div>
        <div class="field" id="h-lab-pair-wrap"><label>المادتان في التجربة</label>
          <div class="grid2">
            <select class="inp" id="h-lab-a"><option value="">— اختيار حر للطالب —</option>${LAB_MATS.map(([v,t])=>`<option value="${v}" ${h&&h.lab&&h.lab.pair&&h.lab.pair[0]===v?'selected':''}>${t}</option>`).join('')}</select>
            <select class="inp" id="h-lab-b"><option value="">— اختيار حر للطالب —</option>${LAB_MATS.map(([v,t])=>`<option value="${v}" ${h&&h.lab&&h.lab.pair&&h.lab.pair[1]===v?'selected':''}>${t}</option>`).join('')}</select>
          </div>
          <small style="color:var(--ink-soft);font-size:.74rem;line-height:1.7">حدّد المادتين حتى تكون التجربة واحدة لكل الطلاب والتقييم عادلًا (مثال: الملح + الرمل تتطلب إذابة ثم ترشيحًا ثم تبخيرًا). اتركهما فارغين ليختار الطالب بنفسه. بعد التسليم يبقى المختبر مفتوحًا للتدريب الحر بلا درجة.</small>
        </div>
      </div>

      <div id="h-nafs-wrap" style="display:none;margin-top:.65rem">${typeof nafsFormPicker==='function' ? nafsFormPicker(h) : ''}</div>

      <label id="h-project-grade-wrap" class="row" style="display:none;gap:.5rem;margin-top:.65rem;padding:.65rem .75rem;border:1px solid var(--rule);border-radius:10px;background:rgba(27,156,107,.05);cursor:pointer">
        <input type="checkbox" id="h-project-grade" ${h && h.kind==='files' && h.projectGraded ? 'checked' : ''}>
        <span><b>☑️ احتساب المشروع ضمن درجات المشاريع</b><br><small style="color:var(--ink-soft)">المشاريع المؤكدة فقط تدخل في درجة المشاريع الكاملة (10 درجات).</small></span>
      </label>
    </div>
    <div class="grid2" id="h-scores">
      <div class="field"><label>الدرجة الكاملة</label>
        <input class="inp" type="number" id="h-max" min="1" value="${h ? (h.max || 20) : 20}">
        <span style="font-size:.76rem;color:var(--ink-soft);margin-top:.2rem;display:block">
          للكشف الأكاديمي — تُوزَّع بنسبة الإصابة</span></div>
      <div class="field"><label>نقاط المتجر</label>
        <input class="inp" type="number" id="h-pts" min="1" value="${h ? (h.pts || 50) : 50}">
        <span style="font-size:.76rem;color:var(--ink-soft);margin-top:.2rem;display:block">
          عملة الطالب في المتجر</span></div>
    </div>
    <label id="h-grade-wrap" class="row" style="gap:.5rem;margin-top:.65rem;padding:.65rem .75rem;border:1px solid var(--rule);border-radius:10px;background:rgba(46,107,184,.05);cursor:pointer">
      <input type="checkbox" id="h-grade" ${h && h.noGrade ? '' : 'checked'}>
      <span><b>📊 يدخل في درجة الأنشطة</b><br><small style="color:var(--ink-soft)">الدرجة = ما سلّمه الطالب ÷ الأنشطة المطلوبة منه في الفترة × 10. أزل العلامة ليصبح النشاط «🎯 تدريبًا» بلا درجة (تبقى نقاط المتجر).</small></span>
    </label>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn" onclick="saveHw('${id || ''}')">حفظ</button>
    </div>`);
  hwKindChanged();
  illusPrev();
  setTimeout(() => document.getElementById('h-title').focus(), 60);
}

/* 🔍 أنواع النشاط: التشخيصي وأنماط التعلّم بلا نقاط */
const KIND_NOTE = {
  normal: '📊 يدخل في درجة الأنشطة ويمنح نقاط المتجر.',
  diag:   'لقياس المستوى قبل التدريس — لا نقاط ولا يدخل درجة الأنشطة، وتظهر نتيجته كمؤشر في ملف الطالب.',
  style:  'لا إجابة صحيحة — كل خيار يُصنّف نمط تعلّم، والنتيجة نمط الطالب الغالب. لا يدخل درجة الأنشطة.',
  reading:'نص علمي مع أسئلة موزعة على مراحل الفهم القرائي. 📊 يدخل في درجة الأنشطة.',
  files:  'يرفع الطالب صور تنفيذ المشروع أو ملف PDF. لا يدخل ضمن الأنشطة، ويمكن تأكيد احتسابه ضمن درجات المشاريع.',
  nafs:   'أسئلة الاختبارات الوطنية (نافس) بأشكالها ونواتج تعلمها — تُصحَّح آليًا. اختر الفصل والأقسام وتُضاف الأسئلة تلقائيًا. يظهر للطالب في خانة «🧭 نافس». افتراضيًا تدريب بلا درجة.',
  lab:    'تجربة في المختبر الافتراضي: يخلط الطالب ويلاحظ ويجيب ويفصل عمليًا. يصحّحها الخادم. 📊 تدخل في درجة الأنشطة مع نقاط المتجر. تظهر للطالب في «طبّق وجرّب».',
  games:  'نشاط تفاعلي مستقل — تدريب لا يدخل درجة الأنشطة. اختر 🎴 كشف الكلمات أو 🔐 افتح القفل، ويمكن توليد محتوى اللعبة بالذكاء الاصطناعي.'
};
const HW_KINDS=[
  {v:'normal', ic:'📝', t:'نشاط عادي',   d:'أسئلة بدرجة ونقاط'},
  {v:'reading',ic:'📖', t:'فهم قرائي',   d:'نص + مهارات قراءة'},
  {v:'games',  ic:'🎮', t:'ألعاب',       d:'لعبة أو أكثر بلا درجة'},
  {v:'diag',   ic:'🔍', t:'تشخيصي',      d:'قياس مستوى بلا نقاط'},
  {v:'style',  ic:'🧠', t:'أنماط التعلّم', d:'تصنيف بلا إجابة صحيحة'},
  {v:'files',  ic:'📎', t:'تسليم ملفات', d:'صور أو PDF أو فيديو'},
  {v:'lab',    ic:'🔬', t:'مختبر افتراضي', d:'تجربة تفاعلية بدرجة'},
  {v:'nafs',   ic:'🧭', t:'نافس',        d:'أسئلة وطنية بالأشكال'}
];
/* 🧭 نشاط نافس يُحفظ «عاديًا» (kind normal) مع قائمة أقسامه h.nafs — فتعمل معه المهارات والعلاج والتصحيح كما هي */
/* 🏷️ نوع النشاط قبل اسمه — بالأيقونة والاسم واللون نفسها في بوابة الطالب */
const HW_KIND_COLORS = { normal:'#2E6BB8', reading:'#1B9C6B', games:'#A66F0A', diag:'#2E6BB8', style:'#7B4FA8', files:'#2E6BB8', lab:'#2E6BB8', nafs:'#0E7490', remedial:'#B4232F' };
const HW_KIND_NAME = { normal:'نشاط', reading:'فهم قرائي', games:'ألعاب', diag:'اختبار تشخيصي', style:'أنماط التعلّم', files:'مشروع', lab:'مختبر افتراضي', nafs:'نافس', remedial:'علاجي' };
function hwKindChip(k, inForm){
  k = HW_KIND_NAME[k] ? k : 'normal'; const ic = (HW_KINDS.find(x => x.v === k) || {}).ic || (k === 'remedial' ? '🩹' : '📝');
  return `<span class="act-kind"${inForm ? ' id="h-title-kind"' : ''} style="--k:${HW_KIND_COLORS[k]}">${ic} ${HW_KIND_NAME[k]}</span>`;
}
/* العنوان في قائمة الأنشطة كما يراه الطالب: النوع قبله، إلا إن كتبه المعلم في العنوان (فالأيقونة فقط) */
function hwTitleHTML(h){
  const k = h && h.remedial ? 'remedial' : hwFormKind(h), t = String((h && h.title) || '');
  const norm = v => String(v).replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
  const has = norm(t).includes(norm(HW_KIND_NAME[k] || 'نشاط').replace(/ (.*)$/, '')) || (k === 'games' && /لعب|العاب|لعبه/.test(norm(t)));
  const ic = (HW_KINDS.find(x => x.v === k) || {}).ic || (k === 'remedial' ? '🩹' : '📝');
  return (has ? ic + ' ' : hwKindChip(k) + ' ') + esc(t);
}
const hwIsNafs=h=>!!(h && (h.kind||'normal')==='normal' && Array.isArray(h.nafs) && h.nafs.length);
const hwFormKind=h=>!h ? 'normal' : hwIsNafs(h) ? 'nafs' : (h.kind==='game' ? 'games' : (h.kind||'normal'));
/* 🔬 المختبر الافتراضي — المواد المتاحة لموضوع «المخاليط» (يطابق صفحة المختبر والـ Worker) */
const LAB_MATS=[['water','الماء'],['oil','الزيت'],['salt','الملح'],['sugar','السكر'],['sand','الرمل'],['gravel','الحصى'],['iron','برادة الحديد']];
const labMatName=k=>(LAB_MATS.find(x=>x[0]===k)||[k,k])[1];
/* موضوعات المختبر المتاحة — يطابق LAB_TOPICS في الـ Worker */
const LAB_TOPICS=[['mixtures','المخاليط'],['friction','قوة الاحتكاك'],['inertia','القصور الذاتي'],['work','الشغل'],['machines','الآلات البسيطة'],['newton3','قانون نيوتن الثالث'],['physchg','الخواص والتغيرات الفيزيائية'],['chemchg','الخواص والتغيرات الكيميائية']];
const LAB_TOPIC_NOTE={
  chemchg:'يتوقع ثم ينفّذ خمسة تغيّرات (الخل وصودا الخبز، اليود والنشا، محلولان يكوّنان راسبًا، احتراق المغنيسيوم بالنظارة والماسك، ذوبان الملح) فيرصد العلامات (غاز، لون، راسب، ضوء، حرارة) ويحكم: كيميائي أم فيزيائي؛ ثم يزن التفاعل في كأس مفتوحة (تنقص الكتلة) وقارورة مغلقة ببالون (ثابتة) فيكتشف حفظ الكتلة؛ ثم تحدٍّ: ميّز أربعة مساحيق بيضاء بالكواشف.',
  physchg:'يزن الطالب ثلاث عينات فلزية ويقيس حجمها بإزاحة الماء في مخبار مدرّج ويحسب الكثافة = الكتلة ÷ الحجم ويتعرّف المادة من جدول الكثافات؛ ثم يراقب الميزان أثناء انصهار الجليد وكبس ورقة ألومنيوم وذوبان السكر فيكتشف أن الكتلة محفوظة ولا تتكوّن مادة جديدة. التحدي: أي السوارين ذهب خالص؟',
  newton3:'يتوقع ثم يسحب ميزانين نابضيين متصلين (أحدهما مثبت في جدار) ثلاث سحبات بقوى مختلفة فيكتشف أن قراءتيهما متساويتان دائمًا؛ ثم يطلق نابضًا مضغوطًا بين عربتين (متساويتين ثم مختلفتين في الكتلة) فيقرأ القوة نفسها على العربتين ويحسب سرعة كل منهما = المسافة ÷ الزمن؛ ثم تحدٍّ: اجعل الحمراء أسرع بثلاث مرات.',
  mixtures:'يخلط الطالب مادتين ويلاحظ، ثم يفصلهما عمليًا.',
  work:'يتوقع ثم يسحب صندوقًا بميزان نابضي ثلاث سحبات (يغيّر متغيرًا واحدًا كل مرة) ويحسب الشغل = القوة × المسافة، ثم يدفع جدارًا لا يتحرك فيكتشف أن الشغل صفر؛ ثم تحدٍّ: أنجز 30 جول بالضبط.',
  machines:'رافعة: يضع الميزان على 0.5 و1 و1.5 m من نقطة الارتكاز ويحسب الفائدة الآلية. سطح مائل: يرفع صندوقًا على أسطح 0.5 و1 و2 m ويحسب الشغل فيكتشف أن الآلة توفّر القوة لا الشغل؛ ثم تحدٍّ: ارفع 90 N بقوة 30 N.',
  inertia:'جزءان: عربة وراكب تصطدم بحاجز (بحزام وبدونه)، ثم عربات مختلفة الكتلة يدفعها الطالب بالقوة نفسها ويقيس زمنها بين بوابتين ضوئيتين ويحسب سرعتها؛ ثم تحدٍّ: ما الدفعة التي تعوّض مضاعفة الكتلة؟',
  friction:'ثلاثة مسارات بأسطح مختلفة الخشونة (زجاج، خشب، ورق صنفرة): يُطلق الطالب قالبًا من ارتفاع واحد، ويقيس مسافة التوقف، ويفسّرها بقانوني نيوتن الأول والثاني، ثم يحل تحديًا عمليًا.'
};
function labTopicChanged(){
  const t=(document.getElementById('h-lab-topic')||{}).value||'mixtures';
  const pw=document.getElementById('h-lab-pair-wrap'); if(pw) pw.style.display = t==='mixtures' ? '' : 'none';
  const nt=document.getElementById('h-lab-topic-note'); if(nt) nt.textContent=LAB_TOPIC_NOTE[t]||'';
}
function labSummary(h){
  const t=(h&&h.lab&&h.lab.topic)||'mixtures';
  if(t==='friction') return '⚙️ قوة الاحتكاك · ثلاثة أسطح';
  if(t==='inertia') return '🚗 القصور الذاتي · حزام الأمان والكتلة';
  if(t==='work') return '🏋️ الشغل · القوة × المسافة';
  if(t==='machines') return '🔧 الآلات البسيطة · الرافعة والسطح المائل';
  if(t==='newton3') return '🤝 قانون نيوتن الثالث · الفعل ورد الفعل';
  if(t==='physchg') return '⚖️ الخواص والتغيرات الفيزيائية · الكثافة وحفظ الكتلة';
  if(t==='chemchg') return '🧪 الخواص والتغيرات الكيميائية · العلامات وحفظ الكتلة';
  const p=h&&h.lab&&Array.isArray(h.lab.pair)&&h.lab.pair.length===2?h.lab.pair:null;
  return '🔬 المخاليط · '+(p?labMatName(p[0])+' + '+labMatName(p[1]):'اختيار حر');
}

function hwKindChanged(){
  const k = (document.getElementById('h-kind')||{}).value || 'normal';
  { const c = document.getElementById('h-title-kind'); if(c) c.outerHTML = hwKindChip(k, true); }
  const box = document.getElementById('h-scores');
  const note = document.getElementById('h-kind-note');
  if(box) box.style.display = (k === 'normal' || k === 'reading' || k === 'lab' || k === 'nafs') ? '' : 'none';
  const gw = document.getElementById('h-grade-wrap');
  if(gw) gw.style.display = (GRADE_KINDS.includes(k) || k === 'nafs') ? '' : 'none';
  const nw = document.getElementById('h-nafs-wrap');
  if(nw) nw.style.display = (k === 'nafs') ? '' : 'none';
  const lw = document.getElementById('h-lab-wrap');
  if(lw) lw.style.display = (k === 'lab') ? '' : 'none';
  if(k === 'lab') labTopicChanged();
  const taskHint = document.getElementById('h-kind-note');
  if(taskHint) taskHint.textContent = KIND_NOTE[k] || '';
  if(note) note.textContent = KIND_NOTE[k] || '';
  const pg = document.getElementById('h-project-grade-wrap');
  if(pg) pg.style.display = (k === 'files') ? '' : 'none';
  const bw = document.getElementById('h-brief-wrap');
  if(bw) bw.style.display = (k === 'files') ? '' : 'none';
  const rw = document.getElementById('h-reading-wrap');
  if(rw) rw.style.display = (k === 'reading') ? '' : 'none';
}
/* 📚 مشاريع جاهزة للمرحلة المتوسطة: تعبّئ العنوان والحقول الثلاثة، واحتساب المشروع (درجته من 10 في تبويب المشاريع)، وموعد إغلاق حسب المدة المقترحة */
const PROJ_DOMAINS=[['stem','تطبيقات STEM'],['des','التصميم والابتكار التقني'],['ai','الذكاء الاصطناعي']];
const PROJ_TEMPLATES=[{"il":"bridge","d": "stem", "t": "جسر الورق: من يصمد أكثر؟", "b": "ابنِ جسرًا من الورق والشريط اللاصق فقط يعبر فجوة ٢٠ سم بين كومتي كتب (١٠ أوراق A4 ومتر شريط كحد أقصى، دون لصقه بالكتب). ١) ارسم تصميمين وتوقّع أيهما أقوى. ٢) ابنِ الأول واختبره بإضافة قطع نقدية في كوب وسطه حتى ينهار، وسجّل العدد ومكان الانكسار. ٣) غيّر شيئًا واحدًا فقط وابنِ الجسر الثاني واختبره بالطريقة نفسها. ٤) اكتب جدول النتائج واستنتاجًا يفسر الفرق بالشكل وتوزيع الحمل، ثم فقرة «ماذا تعلمت».", "v": "ملف PDF (الاسم والفصل، الرسمان، الجدول، الاستنتاج، ماذا تعلمت) + ٣ صور (الجسر الأول، الثاني، الاختبار) + فيديو اختياري ٦٠ ثانية", "a": "بنيتَ جسرين بالقيود المحددة، وسجلت النتائج في جدول، وفسرت سبب قوة الأفضل، واسمك وفصلك في الملف", "n": 5}, {"il":"balloon","d": "stem", "t": "سيارة البالون: قانون نيوتن الثالث يتحرك", "b": "اصنع سيارة من علبة كرتون أو قارورة بلاستيكية صغيرة و٤ أغطية قوارير وعودي شواء ومصاصات، ويدفعها هواء بالون مثبت بمصاصة تخرج من الخلف. ١) تأكد أن العجلات تدور بحرية. ٢) انفخ ٤ نفخات وأطلقها من خط بداية، وقِس المسافة بالسنتيمتر ٣ مرات واحسب المتوسط. ٣) غيّر متغيرًا واحدًا فقط (عدد النفخات أو نوع السطح أو طول المصاصة) وكرر ٣ مرات. ٤) سجّل الجدول، وحدّد الفعل ورد الفعل، وفسّر سبب تغيّر المسافة، ثم اكتب «ماذا تعلمت».", "v": "فيديو ٦٠ ثانية للانطلاق والقياس + صورتان للمراحل + ملف PDF أو صورة ورقة (الاسم والفصل، الجدول، الإجابات، ماذا تعلمت)", "a": "تحركت السيارة بهواء البالون، وأجريت ٣ محاولات لكل حالة، وحددت الفعل ورد الفعل بشكل صحيح", "n": 5}, {"il":"filter","d": "stem", "t": "مرشح من قارورة: كيف نُصفّي الماء العكر؟", "b": "⚠️ الماء الناتج غير صالح للشرب أبدًا. اصنع مرشحًا من قارورة ١٫٥ لتر مقلوبة الفوهة، وطبقاته من الأسفل: قطن، ثم رمل ناعم، ثم رمل خشن، ثم حصى (بعد غسلها). ١) رشّح كوب ماء عكر بالتراب، وقِس الزمن، وقيّم الصفاء من ١ إلى ٥ مقارنةً بكوب لم يُرشَّح. ٢) رشّح الناتج مرة ثانية. ٣) رشّح ماءً مذابًا فيه ملح، وجفف ٥ قطرات منه على طبق داكن في الشمس لتعرف هل مرّ الملح. ٤) اكتب دور كل طبقة، وماذا أزال المرشح وماذا لم يُزل، ولماذا الماء غير صالح للشرب، ثم «ماذا تعلمت».", "v": "صورة المرشح مع أسماء الطبقات + صورة كوبي «قبل وبعد» على خلفية بيضاء + صورة طبق الملح + ملف PDF أو صورة ورقة (الاسم والفصل، الجدول، الإجابات، ماذا تعلمت)", "a": "رتبت الطبقات صحيحًا، وظهرت المقارنة، وفسرت لماذا الماء غير صالح للشرب رغم صفائه", "n": 4}, {"il":"holder","d": "des", "t": "حامل جوال من الكرتون: صمّم، اختبر، حسّن", "b": "صمّم حامل جوال من الكرتون والمواد المعاد استخدامها بهذه المواصفات: لا يسقط عند لمس الشاشة ١٠ مرات، وزاويتان على الأقل، وفتحة لسلك الشحن، وأبعاد لا تتجاوز ١٥ × ١٥ × ١٥ سم. ١) اسأل ٣ أشخاص عن احتياجهم وأضف مواصفة من إجاباتهم. ٢) ارسم ٣ أفكار واختر واحدة بجدول تقييم (الثبات، وسهولة الصنع، والزوايا). ٣) اصنع النموذج واختبره وسجّل النتائج. ٤) حسّن شيئًا واحدًا وأعد الاختبار. ٥) فسّر ثباته بمركز الثقل وقاعدة الارتكاز، واكتب «ماذا تعلمت».", "v": "صورة الرسومات وجدول الاختيار + صورتا النموذج الأول والنهائي + فيديو ٣٠ ثانية للاختبار + ملف PDF أو صورة ورقة (الاسم والفصل، المقابلات، النتائج، التفسير، ماذا تعلمت)", "a": "الحامل يحقق المواصفات الخمس، ويظهر التحسين بين النموذجين، والتفسير صحيح", "n": 5}, {"il":"school","d": "des", "t": "مُبتكِر المدرسة: حل واحد لمشكلة حقيقية", "b": "اختر مشكلة حقيقية يواجهها الطلاب في المدرسة وصمّم لها حلًا. ١) اكتب ٣ مشكلات، واسأل ٥ زملاء دون ذكر أسمائهم: هل تواجهها؟ وكم مرة؟ ٢) اختر الأعلى، واكتبها: «يواجه طلاب … مشكلة … بسبب …». ٣) اقترح ٣ حلول، واختر حلًا آمنًا بلا تكلفة لا يخالف الأنظمة ويُجرَّب خلال أسبوع. ٤) اصنع نموذجًا أوليًا (مجسم، أو ملصق، أو شاشات تطبيق على ورق، أو منظّم). ٥) جرّبه مع ٣ زملاء بعد استئذان المعلم، وحسّنه. ٦) اكتب الملخص: المشكلة، والأدلة، والأفكار، والحل وسببه، والتجربة، والتحسين، وماذا تعلمت. يُسمح بالعمل في مجموعة من ٢ إلى ٣ مع ذكر دور كل عضو.", "v": "ملف PDF (صفحتان كحد أقصى) على القالب + ٢ إلى ٣ صور للنموذج + فيديو اختياري ٩٠ ثانية", "a": "المشكلة مدعومة بإجابات ٥ زملاء، والحل مجرَّب مع ٣ زملاء وتظهر فيه آثار التحسين", "n": 14}, {"il":"quiz","d": "des", "t": "صمّم مسابقتك العلمية الرقمية", "b": "صمّم مسابقة رقمية من ١٠ أسئلة عن الدرس الذي يحدده المعلم: ٦ اختيار من متعدد، و٢ صح وخطأ، و٢ عن صورة أو موقف من الحياة. ١) اكتب الأسئلة وإجاباتها ورقم صفحة الكتاب على ورقة أولًا. ٢) اكتب شرحًا قصيرًا بأسلوبك لكل إجابة. ٣) أنشئها في أداة مجانية (نماذج Google في وضع الاختبار، أو Microsoft Forms، أو عرض تقديمي بروابط، أو Scratch). ٤) أضف عنصر لعب (نقاط، أو مستويات، أو قصة)، ولا تطلب أي بيانات شخصية من اللاعب. ٥) جرّبها مع ٣ أشخاص وعدّل الأسئلة الغامضة.", "v": "ملف PDF (الاسم والفصل، الرابط كاملًا، الأسئلة والإجابات وأرقام الصفحات، نتيجة التجربة، ماذا تعلمت) + ٢ إلى ٣ لقطات شاشة، أو فيديو دقيقتين إن لم يوجد رابط", "a": "المسابقة تعمل، وفيها ١٠ أسئلة صحيحة حسب الكتاب بشرح بعد كل إجابة، والرابط مكتوب في الملف", "n": 7}, {"il":"detective","d": "ai", "t": "محقق العلوم: هل أصاب الذكاء الاصطناعي؟", "b": "اطرح ٦ أسئلة من الدرس على أداة ذكاء اصطناعي مجانية بإذن ولي أمرك، ولا تكتب أي بيانات شخصية: سؤالا تعريف، وسؤالا «لماذا»، وسؤال مثال أو حساب، وسؤال «مفخّخ» فيه معلومة خاطئة. ١) التقط لقطة شاشة لكل سؤال ورد. ٢) قارن كل رد بالكتاب وصنّفه: صحيح، أو ناقص، أو خاطئ. ٣) صحّح الناقص والخاطئ بأسلوبك مع رقم الصفحة. ٤) إن كانت كلها صحيحة فاطرح سؤالين أصعب واشرح كيف تحققت. ٥) اكتب جدول النتائج و٣ نصائح لاستخدام الذكاء الاصطناعي في المذاكرة، ثم «ماذا تعلمت».", "v": "ملف PDF (الاسم والفصل، اسم الأداة والتاريخ، جدول: السؤال والرد والحكم والتصحيح ورقم الصفحة، النصائح، ماذا تعلمت) + حتى ٣ صور للقطات الشاشة", "a": "وثقت الأداة والأسئلة الستة، وتحققت من كل رد بالكتاب مع رقم الصفحة، والتصحيحات بأسلوبك", "n": 5}, {"il":"poster","d": "ai", "t": "ملصقي العلمي بمساعدة الذكاء الاصطناعي", "b": "صمّم ملصقًا علميًا عن موضوع من الدرس، يحتوي: عنوانًا، و٤ معلومات بأسلوبك مع رقم صفحة الكتاب، وصورة مع تسميات تكتبها أنت، وسؤال تفكير، وسطر مصادر. ١) ولّد الصورة بأداة ذكاء اصطناعي مجانية بإذن ولي أمرك، واطلبها «بدون كتابة». ٢) ولّد ٣ صور على الأقل بتعديل الأمر، واحفظ لقطة لكل أمر. ٣) افحص الصورة علميًا (اتجاه الأسهم، والأجزاء، والكلمات المشوهة) وعالج أي خطأ. ٤) صمّم الملصق في Canva أو PowerPoint أو على ورقة بخط يدك. ٥) اعرضه على شخص وحسّنه. لا تكتب أي بيانات شخصية ولا ترفع صورتك.", "v": "الملصق النهائي (صورة أو PDF) + ملف PDF «سجل الذكاء الاصطناعي» (الاسم والفصل، الأداة والتاريخ، الأوامر الثلاثة، اللقطات، الأخطاء ومعالجتها، ماذا تعلمت)", "a": "المعلومات الأربع صحيحة ومعها أرقام الصفحات، والأوامر الثلاثة موثقة، والتسميات من كتابتك", "n": 5}, {"il":"bank","d": "ai", "t": "بنك أسئلتي: الذكاء الاصطناعي يقترح وأنا أتحقق", "b": "اطلب من أداة ذكاء اصطناعي مجانية بإذن ولي أمرك ١٢ سؤالًا عن الدرس (٦ اختيار من متعدد، و٣ صح وخطأ، و٣ إجابة قصيرة مع الإجابات)، دون أن تكتب أي بيانات شخصية. ١) وثّق الأمر بلقطة شاشة. ٢) راجع كل سؤال: هل هو من الدرس؟ هل الإجابة صحيحة حسب الكتاب (رقم الصفحة)؟ هل الصياغة واضحة؟ هل الخيارات معقولة؟ ٣) سجّل ٣ تعديلات على الأقل (قبل، وبعد، والسبب). ٤) ألّف سؤالين بنفسك. ٥) أخرج بنكًا نهائيًا من ١٠ أسئلة متدرجة بمفتاح إجابة وأرقام صفحات. ٦) جرّب ٥ أسئلة على شخص وسجّل النتيجة، ثم «ماذا تعلمت».", "v": "ملف PDF (الاسم والفصل، الأداة والأمر، جدول التحقق والتعديلات، البنك النهائي ومفتاح الإجابة، نتيجة التجربة، ماذا تعلمت) + لقطة أو اثنتان لرد الأداة", "a": "البنك ١٠ أسئلة صحيحة حسب الكتاب مع أرقام الصفحات، وفيه ٣ تعديلات مسجلة وسؤالان من تأليفك", "n": 6}];
/* 🖼️ الرسم التوضيحي المرفق بالنشاط (مفتاح في PROJ_ILLUS) — معاينة في النموذج مع زر إزالة */
function illusSvg(k){ return (typeof PROJ_ILLUS==='object' && PROJ_ILLUS && k && PROJ_ILLUS[k]) || ''; }
function illusImg(k){ return (typeof PROJ_ILLUS_IMG==='object' && PROJ_ILLUS_IMG && k && PROJ_ILLUS_IMG[k]) || ''; }
function illusSrc(svg){ return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg); }
function illusPrev(){
  const box=document.getElementById('h-illus-prev'); if(!box) return;
  const k=(document.getElementById('h-illus')||{}).value||'', img=illusImg(k), svg=img?'':illusSvg(k);
  box.innerHTML=(img||svg)?`<img src="${img?'projects/'+img:illusSrc(svg)}" alt="الرسم التوضيحي للمشروع"><div class="illus-prev-bar"><span>🖼️ يظهر هذا ${img?'الشكل':'الرسم'} للطالب فوق «المطلوب»</span><button type="button" class="btn ghost sm" onclick="illusSet('')">✕ إزالة الرسم</button></div>`:'';
}

/* 🏫 جمهور النشاط: كل الفصول · فصل واحد (h.cls كما كان) · عدة فصول (h.clsList).
   كل شروط «هل يخص النشاط هذا الطالب/الفصل» تمر من هنا — لا يُقرأ h.cls مباشرة للجمهور. */
function hwClasses(h){ const l=Array.isArray(h&&h.clsList)?h.clsList.map(String).filter(Boolean):[]; return l.length?l:((h&&h.cls)?[String(h.cls)]:[]); }
function hwFor(h, cls){ const l=hwClasses(h); return !l.length || l.includes(String(cls||'')); }
function hwPool(h){ return STUDENTS.filter(s=>hwFor(h, s.cls)); }
function hwClsLabel(h){ const l=hwClasses(h); return l.length ? l.join('، ') : 'كل الفصول'; }
/* منتقي الفصول: «كل الفصول» أو أي عدد من الفصول */
function hwClsPickerHTML(h, id){
  const sel=hwClasses(h||{}), all=!sel.length;
  return `<div class="cls-picker" id="${id}">
    <label class="cls-chip all${all?' on':''}"><input type="checkbox" data-all ${all?'checked':''}> كل الفصول</label>
    ${classes().map(c=>`<label class="cls-chip${sel.includes(c)?' on':''}"><input type="checkbox" value="${esc(c)}" ${sel.includes(c)?'checked':''}> ${esc(c)}</label>`).join('')}
  </div><div class="cls-hint" id="${id}-hint">${all?'يظهر لطلاب كل الفصول':`يظهر لطلاب: ${esc(sel.join('، '))}`}</div>`;
}
document.addEventListener('change', e=>{
  const box=e.target.closest && e.target.closest('.cls-picker'); if(!box) return;
  const allCb=box.querySelector('input[data-all]'), cbs=[...box.querySelectorAll('input:not([data-all])')];
  if(e.target===allCb){ if(allCb.checked) cbs.forEach(c=>c.checked=false); else if(!cbs.some(c=>c.checked)) allCb.checked=true; }
  else { if(e.target.checked) allCb.checked=false; else if(!cbs.some(c=>c.checked)) allCb.checked=true; }
  box.querySelectorAll('.cls-chip').forEach(l=>l.classList.toggle('on', l.querySelector('input').checked));
  const picked=cbs.filter(c=>c.checked).map(c=>c.value), hint=document.getElementById(box.id+'-hint');
  if(hint) hint.textContent = picked.length ? `يظهر لطلاب: ${picked.join('، ')}` : 'يظهر لطلاب كل الفصول';
});


/* ═══════════════ إعدادات الاتصال ═══════════════ */
/* عدّل العنوانين هنا فقط عند تغيير الروابط */
const SITE_URL = 'https://homwork.pages.dev';
const API_URL  = 'https://homework.ahmadalmarzooq2009.workers.dev';

const K_SITE = 'hwapp_site_v1';
/* 🔗 بوابة المعلم: عنوانها لم يكن مخزَّنًا في أي مكان. لا نكتبه في الكود
   لئلا ينكسر يوم تنشرها على نطاق آخر — يُحفظ هنا ويُحرَّر من الإعدادات. */
const K_PORTAL = 'hwapp_portal_url_v1';
/* 📱 بوابة المعلم صارت جزءًا من موقع اللوحة (./portal/): تطبيق واحد ودخول واحد (كلمة السر نفسها محفوظة للاثنين).
   رابط مخصص قديم في الإعدادات يبقى يعمل إن كتبه المعلم */
try{ if(/teachergate\.pages\.dev/i.test(localStorage.getItem('hwapp_portal_url_v1')||'')) localStorage.removeItem('hwapp_portal_url_v1'); }catch(e){}   // الرابط القديم المنفصل ⇒ المدمجة
function getPortal(){ return (localStorage.getItem(K_PORTAL) || '').trim(); }
function syncPortalBtn(){
  const b=document.getElementById('portal-link-btn');
  if(b) b.style.display = '';
}
function getSite(){ return (localStorage.getItem(K_SITE) || SITE_URL).trim(); }

const K_API = 'hwapp_api_v1_test', K_TOK = 'hwapp_tok_v1', K_SEEN = 'hwapp_seen_v1';
function getApi(){ return (localStorage.getItem(K_API) || API_URL).trim(); }
function getTok(){ return (localStorage.getItem(K_TOK) || '').trim(); }

/* ⬇️ سحب نتائج الطلاب من الخادم ومنح النقاط */
let PULL_FAILS = 0;   // فشل جلب ⇒ لا يتقدم مؤشر «ما تغيّر»
async function pullResults(id, silent){
  const h = HW.find(x=>x.id===id); if(!h) return 0;
  const api = getApi(), tok = getTok();
  if(!api || !tok){
    if(!silent) toast('ضع عنوان الخادم وكلمة السر في تبويب البيانات', 'bad');
    return 0;
  }
  if(!h.sid){
    if(!silent) toast('أنشئ رابط الطالب أولاً', 'bad');
    return 0;
  }
  if(!silent) toast('جارٍ التحديث…');

  let j;
  try{
    const r = await fetch(`${api}/results?hw=${encodeURIComponent(h.sid)}&t=${encodeURIComponent(tok)}`);
    j = await r.json();
    if(r.status === 401){
      PULL_FAILS++;
      if(!silent) toast('كلمة السر غير صحيحة', 'bad');
      return 0;
    }
    if(!r.ok || !j.ok) throw 0;
  }catch(e){
    PULL_FAILS++;
    if(!silent) toast('تعذّر الاتصال بالخادم — تحقق من العنوان', 'bad');
    return 0;
  }

  h.subs = h.subs || {};
  let added = 0, skipped = 0;

  (j.rows||[]).forEach(row=>{
    const st = matchStudent(row);
    if(!st){
      // 🧾 سجل لطالب غير موجود في الكشف الحالي — يُحفظ ويُعلن، ولا يُحذف من الخادم
      skipped++;
      h.orphans = h.orphans || {};
      h.orphans[String(row.sid || row.name || skipped)] = {
        sid: String(row.sid||''), name: String(row.name||'—'), at: Number(row.at)||0,
        correct: row.correct, total: row.total, files: row.files||[]
      };
      return;
    }
    // موجود مسبقاً: /results يحتفظ بآخر تسليم للطالب فقط،
    // لذلك يجب تحديث السجل إذا كان هذا التسليم أحدث من الموجود محلياً.
    if(h.subs[st.id]){
      const cur = h.subs[st.id];
      const curAt = Number(cur.at) || 0;
      const rowAt = Number(row.at) || 0;

      if(rowAt > curAt){
        const total = Math.max(1, row.total||1);
        const pts = Math.round((h.pts||0) * (row.correct||0) / total);

        // الطالب استخدم المحاولة الإضافية فعلاً. أعد زر الإعادة إلى حالته الأصلية.
        if(h.extraAttempts && Number(h.extraAttempts[st.id]||0)>0){
          h.extraAttempts[st.id]=Math.max(0, Number(h.extraAttempts[st.id])-1);
          if(h.extraAttempts[st.id]===0) delete h.extraAttempts[st.id];
        }

        h.subs[st.id] = {
          online:true,
          correct:row.correct||0,
          total,
          pts,
          d:row.d||'',
          dev:row.dev||'',
          secs:row.secs||0, away:row.away&&typeof row.away==='object'?row.away:null,
          ans:Array.isArray(row.ans) ? row.ans : null,
          files:Array.isArray(row.files) ? row.files : [],
          reviewStatus: h.kind==='files' ? String(row.reviewStatus||'pending').toLowerCase() : (row.reviewStatus||''),
          reviewReason: row.reviewReason||'',
          reviewedAt: Number(row.reviewedAt)||0,
      lab: row.lab && typeof row.lab==='object' ? row.lab : null,
          lab: row.lab && typeof row.lab==='object' ? row.lab : null,
          resubmitUntil: Number(row.resubmitUntil)||0,
          at:row.at||0,
          fat:Number(cur.fat||cur.at)||Number(row.at)||0   // ⏱️ وقت أول تسليم: إعادة المحاولة بعد إغلاق الفترة لا تنقل النشاط خارجها
        };
        added++;
      }else if(!Array.isArray(cur.ans) && Array.isArray(row.ans)){
        cur.ans = row.ans; added++;
      }
      // 📁 مراجعة المشروع (قبول/رفض) تتغيّر على الخادم دون تسليم جديد — نحدّثها حتى لا تبقى «بانتظار المراجعة»
      if(h.kind==='files' && Number(row.at||0)===curAt){
        const rs=String(row.reviewStatus||'pending').toLowerCase(), ra=Number(row.reviewedAt)||0;
        if(liveReviewNewer(cur, row)){
          cur.reviewStatus=rs; cur.reviewReason=row.reviewReason||''; cur.reviewedAt=ra; cur.resubmitUntil=Number(row.resubmitUntil)||0;
        }
      }
      return;
    }

    const total = Math.max(1, row.total||1);
    const pts = Math.round((h.pts||0) * (row.correct||0) / total);

    // إذا كان للطالب إذن إعادة تسليم محفوظ محليًا، فقد استُخدم عند وصول هذا التسليم.
    if(h.extraAttempts && Number(h.extraAttempts[st.id]||0)>0){
      h.extraAttempts[st.id]=Math.max(0, Number(h.extraAttempts[st.id])-1);
      if(h.extraAttempts[st.id]===0) delete h.extraAttempts[st.id];
    }

    h.subs[st.id] = {
      online:true,
      correct:row.correct||0,
      total,
      pts,
      d:row.d||'',
      dev:row.dev||'',
      secs:row.secs||0, away:row.away&&typeof row.away==='object'?row.away:null,
      ans: Array.isArray(row.ans) ? row.ans : null,   // 🧠 لازمة لحساب نمط التعلّم والمراجعة
      files: Array.isArray(row.files) ? row.files : [],
      reviewStatus: h.kind==='files' ? String(row.reviewStatus||'pending').toLowerCase() : (row.reviewStatus||''),
      reviewReason: row.reviewReason||'',
      reviewedAt: Number(row.reviewedAt)||0,
      resubmitUntil: Number(row.resubmitUntil)||0,
      at:row.at||0,
      fat:Number(row.at)||0
    };
    added++;
  });

  save(K.hw, HW);
  save(K.st, STUDENTS);
  renderHw();
  renderStudents();
  renderStudentsCenter();
  renderGrades();
  renderAnalysis();
  renderDashboard();
  updateMeta();

  if(!silent){
    // 📊 نفس عدّ اللوحة: فقط التسليمات المرتبطة بالطلاب الموجودين حاليًا في الكشف.
    const currentSubmitted = Object.keys(h.subs||{}).filter(sid => !!byId(sid)).length;
    const orphanCount = Object.keys(h.orphans||{}).length;
    const rosterCount = STUDENTS.filter(x => hwFor(h, x.cls)).length;
    const extra = orphanCount ? ` · + ${orphanCount} تسليمات لطلاب غير موجودين في الكشف الحالي` : '';
    toast(
      added
        ? `وصل ${added} تسليم جديد · ${currentSubmitted} من ${rosterCount} طالبًا سلّموا${extra}`
        : `${currentSubmitted} من ${rosterCount} طالبًا سلّموا${extra}`,
      added ? 'good' : ''
    );
  }

  return added;
}

// 🔄 اسحب تسليمات كل الأنشطة المنشورة دفعة واحدة
async function pullAll(silent){
  let published = HW.filter(h => h && h.sid);
  if(!published.length) return 0;
  const plan = await resChangedPlan(published, 'pull');   // 💸 ما تغيّر فقط
  published = plan.list;

  let total = 0; const f0 = PULL_FAILS;
  for(const h of published){
    try{
      total += (await pullResults(h.id, true)) || 0;
    }catch(e){
      PULL_FAILS++;
      console.error('pullResults failed:', h.id, e);
    }
  }
  if(PULL_FAILS === f0) plan.commit();
  return total;
}

/* محرر أنشطة النشاط — ستة أنواع تفاعلية */
const QT = {
  q:  'اختيار من متعدد',
  tf: 'صح أو خطأ',
  f:  'أكمل الفراغ',
  a:  'رتّب الحروف',
  s:  'رتّب الجملة',
  m:  'وصّل'
};

let QS_KIND = 'normal';   // نوع النشاط المفتوح في المحرر

function openQs(id){
  const h = HW.find(x => x.id === id); if(!h) return;
  // المسودة منفصلة عن h.qs. لذلك المزامنة لا تستطيع استبدال أسئلة لم يعتمدها المعلم بعد.
  const draft = getQsDraft(id);
  const displayQs = draft || (Array.isArray(h.qs) ? h.qs : []);
  QS_KIND = h.kind || 'normal';
  // 🎯 نواتج أسئلة النشاط العادي محفوظة في الخادم (skills:<النشاط>) — تُعرض في المحرر ويصححها المعلم
  QS_SKH = (QS_KIND==='normal'&&h.published&&h.sid&&!draft&&!displayQs.some(q=>q&&q.skill)) ? String(h.sid) : ''; QS_SKMAP=null;
  if(QS_SKH) setTimeout(()=>qsSkLoad(QS_SKH),0);
  const isStyle = QS_KIND === 'style';
  openModal(`
    <h2>مهام — ${esc(h.title)}</h2>
    <p style="color:var(--ink-soft);font-size:.85rem;margin:.2rem 0 .9rem">
      ${isStyle
        ? '🧠 <b>لا توجد إجابة صحيحة</b> — كل خيار يمثّل نمط تعلّم بالترتيب: <b>بصري · سمعي · حركي · قرائي/كتابي</b>.'
        : QS_KIND==='diag'
          ? '🔍 اختبار تشخيصي — حدّد الإجابة الصحيحة لقياس المستوى، بلا نقاط.'
          : 'كل مهمة تساوي درجة واحدة. اختر النوع ثم املأ الحقول.'}</p>
    <div id="qs-box">${displayQs.map((q,i)=>qRow(q,i)).join('') || '<p style="color:var(--ink-soft)">لا مهام بعد.</p>'}</div>
    <div class="row" style="gap:.4rem;margin-top:.6rem;flex-wrap:wrap">
      ${Object.keys(QT).map(k=>`<button class="btn ghost sm" onclick="addQ('${k}')">+ ${QT[k]}</button>`).join('')}
    </div>
    ${QS_KIND==='normal' ? `
    <div style="margin-top:.8rem;padding-top:.8rem;border-top:1px solid var(--rule)">
      <div class="row" style="gap:.5rem;flex-wrap:wrap">
        <button type="button" class="ai-btn solid" style="flex:1;min-width:170px" onclick="openNormalAIGenerator('${id}')"><span class="ai-mark">✦</span> توليد الأسئلة بالذكاء</button>
        <button class="btn ghost" style="flex:1;min-width:150px" onclick="openStudentGameSettings('${id}')">🎮 إعداد اللعبة</button>
        <button class="btn ghost" style="flex:1;min-width:150px" onclick="document.getElementById('imp-qs').click()">📥 استيراد JSON</button>
      </div>
      <input type="file" id="imp-qs" accept=".json" style="display:none" onchange="importQs(event,'${id}')">
      <p style="color:var(--ink-soft);font-size:.8rem;margin:.5rem 0 0">اختر بين التوليد المباشر من AI أو استيراد أسئلة محفوظة. ويمكنك تعديل الأسئلة قبل الحفظ.</p>
    </div>` : (QS_KIND==='diag' ? `
    <div style="margin-top:.8rem;padding-top:.8rem;border-top:1px solid var(--rule)">
      <div class="row" style="gap:.5rem;flex-wrap:wrap">
        <button type="button" class="ai-btn solid" style="flex:1;min-width:190px" onclick="openDiagnosticAIGenerator('${id}')"><span class="ai-mark">✦</span> توليد الاختبار بالذكاء</button>
        <button class="btn" style="flex:1;min-width:190px" onclick="document.getElementById('imp-qs').click()">📥 استيراد تشخيصي</button>
      </div>
      <input type="file" id="imp-qs" accept=".json" style="display:none" onchange="importQs(event,'${id}')">
      <p style="color:var(--ink-soft);font-size:.8rem;margin:.5rem 0 0">استورد اختبارًا تشخيصيًا محفوظًا سابقًا مباشرة، دون استدعاء الذكاء الاصطناعي أو استهلاك أي توكن.</p>
    </div>` : (QS_KIND==='style' ? `
    <div style="margin-top:.8rem;padding-top:.8rem;border-top:1px solid var(--rule)">
      <div class="row" style="gap:.5rem;flex-wrap:wrap">
        <button type="button" class="ai-btn solid" style="flex:1;min-width:190px" onclick="openLearningStylesAIGenerator('${id}')"><span class="ai-mark">✦</span> توليد المواقف بالذكاء</button>
        <button class="btn" style="flex:1;min-width:190px" onclick="document.getElementById('imp-qs').click()">📥 استيراد أنماط</button>
      </div>
      <input type="file" id="imp-qs" accept=".json" style="display:none" onchange="importQs(event,'${id}')">
      <p style="color:var(--ink-soft);font-size:.8rem;margin:.5rem 0 0">استورد اختبار أنماط تعلم محفوظًا سابقًا مباشرة، دون AI أو استهلاك توكن.</p>
    </div>` : ((QS_KIND==='games' || QS_KIND==='game') ? `
    <div style="margin-top:.8rem;padding-top:.8rem;border-top:1px solid var(--rule)">
      <div class="row" style="gap:.5rem;flex-wrap:wrap">
        <button type="button" class="ai-btn solid" style="flex:1;min-width:170px" onclick="openNormalAIGenerator('${id}')"><span class="ai-mark">✦</span> توليد البنك واللعبة</button>
        <button class="btn ghost" style="flex:1;min-width:150px" onclick="openStudentGameSettings('${id}')">🎮 إعداد اللعبة</button>
        <button class="btn ghost" style="flex:1;min-width:150px" onclick="document.getElementById('imp-qs').click()">📥 استيراد JSON</button>
      </div>
      <input type="file" id="imp-qs" accept=".json" style="display:none" onchange="importQs(event,'${id}')">
      <p style="color:var(--ink-soft);font-size:.8rem;margin:.5rem 0 0">بنك الاختيار من متعدد هنا هو مصدر اللعبة. عدّله ثم أعد بناء اللعبة من «إعداد اللعبة».</p>
    </div>` : `
    <div style="margin-top:.8rem;padding-top:.8rem;border-top:1px solid var(--rule)">
      <button class="btn tick" style="width:100%" onclick="document.getElementById('imp-qs').click()">استيراد من ملف أسئلة الألعاب التعليمية</button>
      <input type="file" id="imp-qs" accept=".json" style="display:none" onchange="importQs(event,'${id}')">
      <p style="color:var(--ink-soft);font-size:.8rem;margin:.5rem 0 0">يحوّل أسئلة الدرس إلى مهام تلقائياً.</p>
    </div>`)))}
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إغلاق</button>
      <button class="btn ghost" onclick="exportQsJson('${id}')">💾 حفظ JSON</button>
      <button class="btn" onclick="saveQs('${id}')">حفظ</button>
    </div>`);
}

/* 🖼️ حقول السؤال التي لا يحررها المحرر (الشكل، المهارة، ربط نافس…) تُحفظ في الصف وتعود عند الحفظ —
   كان المحرر يعيد بناء السؤال من الحقول الظاهرة فقط فتضيع صور أسئلة نافس */
const Q_EDITED=new Set(['t','q','o','a','tags','w','h','s','p','stage']);
function qRowExtras(q){ const x={}; Object.keys(q||{}).forEach(k=>{ if(!Q_EDITED.has(k) && q[k]!=null && q[k]!=='') x[k]=q[k]; }); return x; }
/* 🎯 ناتج سؤال التشخيصي يُختار يدويًا من نواتج نافس — السؤال الذي لم يطابق اسمُ مهارته (skRaw) ناتجًا
   يبقى بلا مهارة فلا تدخل إجاباته التشخيص حتى يُختار له ناتج هنا */
let QS_SKH='', QS_SKMAP=null;
function qSkOptions(cur){
  const all=skAllOutcomes(), by={}, legacy=cur&&!all.some(o=>o.key===cur);
  all.forEach(o=>{ const g=`الفصل ${o.term===1?'الأول':'الثاني'} · ${o.sec}`; (by[g]=by[g]||[]).push(o); });
  return `<option value="">— بلا ناتج (لا يدخل التشخيص ولا الخطط) —</option>${legacy?`<option value="${esc(cur)}" selected>${esc(cur)} (اسم قديم)</option>`:''}
    ${Object.entries(by).map(([g,os])=>`<optgroup label="${esc(g)}">${os.map(o=>`<option value="${esc(o.key)}" ${o.key===cur?'selected':''}>${esc(o.short)}</option>`).join('')}</optgroup>`).join('')}`;
}
function qRowSkHTML(q){
  if(typeof skAllOutcomes!=='function') return '';
  // ناتج مكتوب على السؤال نفسه (التشخيصي وأسئلة نافس) يُعدَّل في السؤال
  if(QS_KIND==='diag'||q.skill){
    const cur=String(q.skill||''), legacy=cur&&!skAllOutcomes().some(o=>o.key===cur);
    return `<div class="q-sk${cur&&!legacy?'':' need'}"><label>🎯 الناتج</label><select class="inp f-sk">${qSkOptions(cur)}</select>
    ${!cur&&q.skRaw?`<small>⚠️ المهارة «${esc(q.skRaw)}» لم تطابق أي ناتج — اختر الناتج الذي يقيسه السؤال</small>`:legacy?'<small>⚠️ اسم قديم خارج نواتج نافس — اختر الناتج المقابل</small>':''}</div>`;
  }
  // النشاط العادي المنشور: تصنيف الذكاء الاصطناعي من الخادم، يُملأ بعد التحميل (qsSkLoad)
  if(QS_SKH&&QS_SKMAP) return `<div class="q-sk need"><label>🎯 الناتج</label><select class="inp f-skm" onchange="this.closest('.q-sk').classList.toggle('need',!this.value)">${qSkOptions('')}</select><small class="q-sk-src">سؤال جديد — اختر ناتجه، وإلا يصنّفه الذكاء الاصطناعي بعد الحفظ</small></div>`;
  if(QS_SKH) return `<div class="q-sk"><label>🎯 الناتج</label><select class="inp f-skm" disabled><option value="">⏳ جارٍ تحميل التصنيف…</option></select><small class="q-sk-src"></small></div>`;
  return '';
}
async function qsSkLoad(hw){
  let j=null; try{ j=await (await fetch(getApi().replace(/\/+$/,'')+'/skills?hw='+encodeURIComponent(hw)+'&t='+encodeURIComponent(getTok()),{cache:'no-store'})).json(); }catch(e){}
  if(QS_SKH!==hw) return;
  const rows=[...document.querySelectorAll('#qs-box [data-q]')];
  if(!j||!j.ok){ rows.forEach(r=>{ const b=r.querySelector('.q-sk'); if(b) b.remove(); }); return; }
  QS_SKMAP={map:j.map||{},man:new Set((j.man||[]).map(String))};
  rows.forEach(r=>{ const sel=r.querySelector('.f-skm'); if(!sel) return; const i=String(r.dataset.q), raw=QS_SKMAP.map[i]||'';
    const cur=raw?(typeof skCanon==='function'?skCanon(raw):raw):'';
    sel.innerHTML=qSkOptions(cur); sel.disabled=false; sel.dataset.orig=cur;
    const box=sel.closest('.q-sk'), src=box.querySelector('.q-sk-src'), legacy=cur&&!skAllOutcomes().some(o=>o.key===cur);
    box.classList.toggle('need',!cur||legacy);
    src.textContent=!cur?'⚠️ بلا ناتج — إجاباته لا تدخل تحديد الخطط':legacy?'⚠️ اسم قديم خارج نواتج نافس — اختر الناتج المقابل':QS_SKMAP.man.has(i)?'✍️ اخترته أنت':'🤖 تصنيف الذكاء الاصطناعي — صحّحه إن لزم';
    sel.onchange=()=>{ box.classList.toggle('need',!sel.value); src.textContent=sel.value?'✍️ اخترته أنت':'⚠️ بلا ناتج — إجاباته لا تدخل تحديد الخطط'; };
  });
}
function qRow(q,i){
  const k = q.t || 'q';
  let body = '';
  if(k==='q'){
    const o = q.o || ['','','',''];
    const isStyle = (typeof QS_KIND !== 'undefined') && QS_KIND === 'style';
    const TAGS = ['بصري','سمعي','حركي','قرائي/كتابي'];
    const COL  = { 'بصري':'#2E6BB8','سمعي':'#7B4FA8','حركي':'#C88A2E','قرائي/كتابي':'#1B9C6B' };
    const ICO  = { 'بصري':'👁️','سمعي':'👂','حركي':'✋','قرائي/كتابي':'📖' };
    body = o.map((t,j)=>{
      const tag = (q.tags && q.tags[j]) || TAGS[j] || '';
      return `<div class="row" style="gap:.4rem;margin-bottom:.3rem">
      ${isStyle
        ? `<span class="pill" style="min-width:88px;justify-content:center;font-size:.74rem;
             background:${(COL[tag]||'#5A6B84')}1f;color:${COL[tag]||'#5A6B84'}">${ICO[tag]||''} ${esc(tag)}</span>`
        : `<input type="radio" name="ans${i}" value="${j}" ${(q.a||0)===j?'checked':''} style="width:20px;height:20px;accent-color:#1B9C6B">`}
      <input class="inp f-o" value="${esc(t)}" placeholder="خيار ${j+1}" style="flex:1"></div>`;
    }).join('');
  }
  else if(k==='tf'){
    body = `<div class="row" style="gap:.8rem">
      <label class="row" style="gap:.3rem"><input type="radio" name="ans${i}" value="1" ${q.a?'checked':''} style="width:20px;height:20px;accent-color:#1B9C6B"> العبارة صحيحة</label>
      <label class="row" style="gap:.3rem"><input type="radio" name="ans${i}" value="0" ${!q.a?'checked':''} style="width:20px;height:20px;accent-color:#D6455B"> خاطئة</label></div>`;
  }
  else if(k==='f'){
    body = `<input class="inp f-a" value="${esc(q.a||'')}" placeholder="الإجابة الصحيحة">`;
  }
  else if(k==='a'){
    body = `<input class="inp f-w" value="${esc(q.w||'')}" placeholder="الكلمة (تُخلط حروفها)" style="margin-bottom:.3rem">
            <input class="inp f-h" value="${esc(q.h||'')}" placeholder="تلميح يظهر للطالب">`;
  }
  else if(k==='s'){
    body = `<input class="inp f-s" value="${esc(q.s||'')}" placeholder="الجملة كاملة (تُخلط كلماتها)">`;
  }
  else if(k==='m'){
    const p = q.p || [['',''],['',''],['','']];
    body = p.map((pr,j)=>`<div class="row" style="gap:.4rem;margin-bottom:.3rem">
      <input class="inp f-l" value="${esc(pr[0])}" placeholder="طرف ${j+1}" style="flex:1">
      <input class="inp f-r" value="${esc(pr[1])}" placeholder="يقابله" style="flex:1"></div>`).join('');
  }
  const needsQ = (k==='q'||k==='tf'||k==='f');
  const readingStage = (QS_KIND==='reading')
    ? `<div class="field" style="margin:.45rem 0 .35rem">
         <label>📚 مرحلة الفهم القرائي</label>
         <select class="inp f-stage">
           ${[['pre','🎯 قبل القراءة'],['during','📖 أثناء القراءة'],['post','🧠 بعد القراءة'],['apply','🔬 التطبيق']].map(([v,l])=>`<option value="${v}" ${(q.stage||'during')===v?'selected':''}>${l}</option>`).join('')}
         </select>
       </div>` : '';
  const keep = qRowExtras(q), keepImg = keep.img && /^(nafs\/[\w.-]+\.(webp|png|jpe?g)|https:\/\/\S+)$/i.test(String(keep.img)) ? String(keep.img) : '';
  return `<div class="ruled" data-q="${i}" data-k="${k}"${q.ev?` data-ev="${esc(q.ev)}"`:''}${q.sk?` data-sk="${esc(q.sk)}"`:''}${Object.keys(keep).length?` data-x="${esc(JSON.stringify(keep))}"`:''} style="padding:.8rem 1rem">
    <div class="row" style="margin-bottom:.4rem">
      <span class="pill quiet">${QT[k]}</span>
      <span class="spacer"></span>
      <button class="btn ghost sm" onclick="this.closest('[data-q]').remove()">حذف</button>
    </div>
    ${needsQ ? `<input class="inp f-q" value="${esc(q.q||'')}" placeholder="${k==='f'?'اكتب الجملة وضع ___ مكان الفراغ':'نص السؤال'}" style="margin-bottom:.45rem">` : ''}
    ${keepImg ? `<div class="q-row-img"><img src="${esc(keepImg)}" alt="شكل السؤال" loading="lazy"><small>🖼️ شكل السؤال${keep.skill?` · 🎯 ${esc(keep.skill)}`:''} — يبقى مع السؤال عند الحفظ</small></div>` : ''}
    ${readingStage}
    ${body}
    ${needsQ?qRowSkHTML(q):''}
  </div>`;
}

/* 📥 استيراد المهام من ملف أسئلة الألعاب التعليمية */

// 🔀 خلط الخيارات مع تتبّع موقع الإجابة الصحيحة
// (المولّد يضع الصحيحة أولاً دائماً — فالطالب يحفظ النمط بدل المعلومة)
function shuffleOpts(opts, correctIdx){
  const arr = opts.map((t,i)=>({t, ok:i===correctIdx}));
  for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  return { o: arr.map(x=>x.t), a: arr.findIndex(x=>x.ok) };
}

/* ═══ مساعدات مشتركة لترويسة/تذييل التقارير ═══ */
function ensureLogo(){
  if(window.__MOE_LOGO) return;
  // ولّده مرة واحدة عبر تصيير التحليل في الخلفية
  try{ if(typeof renderAnalysis === 'function') renderAnalysis(); }catch(e){}
}

/* 🎨 هوية التقارير الموحّدة: ترويسة متدرّجة (أخضر←أزرق) بشعار الوزارة في الوسط، العام والفصل الدراسي
   يسارًا، ثم شريط عنوان كحلي، وأقسام بإطار وعنوانها على الإطار، وتذييل بالمدرسة والمعلم */
function repYearLines(semArg){
  let y=''; try{ y=new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',{year:'numeric'}).format(new Date()).replace(/\s*هـ\s*$/,''); }catch(e){}
  const a=(typeof DASH_ACADEMIC!=='undefined'&&DASH_ACADEMIC)||{}; const sem=Number(semArg)||Number(a.currentSemester)||0;
  const dt=new Date(), d=`${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`;
  return [y?`العام الدراسي ${y}هـ`:'', sem===1?'الفصل الدراسي الأول':sem===2?'الفصل الدراسي الثاني':sem===3?'الفصل الدراسي الثالث':'', `التاريخ: ${d}`].filter(Boolean);
}
function repHead(sub, title, sem){
  ensureLogo();
  const school=rcGet('school')||'', teacher=rcGet('teacher')||'';
  try{ document.documentElement.style.setProperty('--rp-foot', JSON.stringify([school, teacher?`معلم المادة: ${teacher}`:'', rcGet('subject')?`مادة ${rcGet('subject')}`:''].filter(Boolean).join('   ·   ')||' ')); }catch(e){}
  // «تقرير» وحدها عنوان عام: يصبح الوصف هو العنوان (ملف الفصل 2/1 بدل «تقرير — ملف الفصل»)
  let t=String(title==null?'تحليل النتائج':title).trim(), st=String(sub||'').trim().replace(/^\((.*)\)$/,'$1');
  if(!t||t==='تقرير'){ t=st; st=''; }
  return `
    <div class="rep-head rh2">
      <div class="t">
        <b>المملكة العربية السعودية</b>
        <span>وزارة التعليم</span>
        <span>${esc(rcGet('dept') || 'الإدارة العامة للتعليم')}</span>
        <span>${esc(school || 'المدرسة')}</span>
      </div>
      <div class="logo">${(window.__MOE_LOGO || '').replace(/viewBox="0 0 1000 1000"/,'viewBox="85 286 825 428"')}</div>
      <div class="yr">${repYearLines(sem).map(x=>`<span>${esc(x)}</span>`).join('')}</div>
    </div>
    <div class="rep-title"><b>${esc(t||st)}</b>${t&&st?`<span>${esc(st)}</span>`:''}</div>`;
}

function repFoot(){
  return `
    <div class="rep-foot">
      <div>المعلم: <b>${esc(rcGet('teacher') || '—')}</b></div>
      <div>مدير المدرسة: <b>${esc(rcGet('principal') || '—')}</b></div>
    </div>`;
}

function repInfo(D, shownCls){
  const today = new Date().toLocaleDateString('ar-SA-u-ca-gregory', { day:'numeric', month:'long', year:'numeric' });
  const _target = hwClsLabel(D.h);
  const _shown = (shownCls && shownCls !== '__all__') ? shownCls : null;
  const _clsLine = _shown ? (_shown === _target ? _shown : _shown + ' · النشاط يستهدف: ' + _target) : _target;
  return `
    <div class="rep-info">
      <div>الاختبار<b>${esc(D.h.title)}</b></div>
      <div>الفصل<b>${esc(_clsLine)}</b></div>
      <div>المادة<b>${esc(rcGet('subject') || 'العلوم')}</b></div>
      <div>التاريخ<b>${today}</b></div>
      <div>أجاب<b>${D.done} من ${D.pool.length}</b></div>
      <div>متوسط الإتقان<b>${D.avg}%</b></div>
    </div>`;
}

/* ═══ 🔍 التقرير التشخيصي — منطقه الخاص ═══ */

// نطاقات تشخيصية (لا «ممتاز/ضعيف» — الطالب لم يُدرَّس بعد)
const DIAG_BANDS = [
  { min:80, name:'متمكّن',        color:'#1B9C6B', act:'يستطيع الانطلاق للمستوى التالي' },
  { min:60, name:'يحتاج مراجعة',  color:'#2E6BB8', act:'مراجعة سريعة تكفيه' },
  { min:40, name:'يحتاج دعمًا',    color:'#C88A2E', act:'دعم موجّه في المفاهيم الناقصة' },
  { min:0,  name:'يحتاج تأسيسًا',  color:'#B4232F', act:'إعادة تأسيس المفاهيم الأساسية' }
];
const diagBand = p => DIAG_BANDS.find(b=>p>=b.min) || DIAG_BANDS[DIAG_BANDS.length-1];

function diagBuild(hid, cls){
  const h = diagHW().find(x=>x.id===hid);
  if(!h) return null;
  const pool = STUDENTS.filter(s =>
    (hwFor(h, s.cls)) && ((!cls || cls==='__all__') ? true : s.cls === cls));
  const qn = (h.qs||[]).length || 1;

  const rows = [];
  pool.forEach(s=>{
    const v = (h.subs||{})[s.id];
    if(!v) return;
    const pct = Math.round((v.correct||0)/Math.max(1,v.total||1)*100);
    rows.push({ s, correct:v.correct||0, total:v.total||qn, pct, band:diagBand(pct), d:String(v.d||'') });
  });

  // خريطة الفجوات: نسبة من أصاب كل مهمة
  const gaps = (h.qs||[]).map((q,i)=>{
    let ok=0, seen=0;
    rows.forEach(r=>{ if(r.d[i] !== undefined){ seen++; if(r.d[i]==='1') ok++; } });
    const pct = seen ? Math.round(ok/seen*100) : 0;
    const _sTxt = String(q.s||'');
    const title = q.t==='a' ? (q.h||'رتّب الحروف') : q.t==='s' ? ('رتّب الجملة: ' + (_sTxt.length>40 ? _sTxt.slice(0,40)+'…' : _sTxt))
                : q.t==='m' ? ('وصّل: ' + (((q.p||[])[0]||[''])[0]||'') + ' …') : (q.q||`مهمة ${i+1}`);
    const right = q.t==='q' ? (q.o||[])[q.a] : q.t==='tf' ? (q.a?'صح':'خطأ')
                : q.t==='f' ? q.a : q.t==='a' ? q.w : q.t==='s' ? q.s : '';
    return { i, title, right, ok, seen, pct, missed: seen-ok };
  }).sort((a,b)=>a.pct-b.pct);

  const done = rows.length;
  const avg  = done ? Math.round(rows.reduce((n,r)=>n+r.pct,0)/done) : 0;
  const counts = {};
  rows.forEach(r=>{ counts[r.band.name] = (counts[r.band.name]||0)+1; });

  // 🎯 خريطة المهارات: لكل مهارة نسبة الفصل ومن تنقصه (دون 60%) — أساس الخطط العلاجية
  const skMap = new Map();
  (h.qs||[]).forEach((q,i)=>{ const k=String(q&&q.skill||'').trim(); if(!k) return;
    const o=skMap.get(k)||{skill:k,domain:String(q.domain||''),idx:[]}; o.idx.push(i); skMap.set(k,o); });
  rows.forEach(r=>{ r.skills={}; skMap.forEach(o=>{ let c=0,t=0; o.idx.forEach(i=>{ if(r.d[i]!==undefined){ t++; if(r.d[i]==='1') c++; } });
    if(t) r.skills[o.skill]={c,t,rate:Math.round(c/t*100)}; }); });
  const skills = [...skMap.values()].map(o=>{
    const got=rows.filter(r=>r.skills[o.skill]);
    const rate=got.length?Math.round(got.reduce((n,r)=>n+r.skills[o.skill].c,0)/Math.max(1,got.reduce((n,r)=>n+r.skills[o.skill].t,0))*100):0;
    const miss=got.filter(r=>r.skills[o.skill].rate<SKILL_GAP_UI).sort((a,b)=>a.skills[o.skill].rate-b.skills[o.skill].rate);
    return {...o, q:o.idx.length, rate, seen:got.length, miss};
  }).sort((a,b)=>a.rate-b.rate);
  return { h, pool, rows, gaps, done, avg, counts, qn, skills };
}

function dgFill(){
  const cSel = document.getElementById('dg-class');
  const hSel = document.getElementById('dg-hw');
  if(!cSel || !hSel) return;
  const curC = cSel.value, curH = hSel.value;
  cSel.innerHTML = '<option value="__all__">كل الفصول</option>' +
    classes().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if([...cSel.options].some(o=>o.value===curC)) cSel.value = curC;

  const cls = cSel.value;
  const list = diagHW().filter(h => (!cls || cls==='__all__') ? true : (hwFor(h, cls)))
                       .slice().sort((a,b)=>(b.at||0)-(a.at||0));
  hSel.innerHTML = list.length
    ? list.map(h=>`<option value="${esc(h.id)}">${esc(h.title)}</option>`).join('')
    : '<option value="">لا اختبارات تشخيصية</option>';
  if([...hSel.options].some(o=>o.value===curH)) hSel.value = curH;
}

function renderDiagPanel(){
  dgFill();
  const box = document.getElementById('dg-body'); if(!box) return;
  const cls = (document.getElementById('dg-class')||{}).value || '__all__';
  const hid = (document.getElementById('dg-hw')||{}).value || '';
  const D = diagBuild(hid, cls);

  if(!D){
    box.innerHTML = `<div class="empty"><span class="big">🔍</span>
      ${diagHW().length ? 'لا اختبارات تشخيصية لهذا الفصل.' : 'لا يوجد اختبار تشخيصي بعد.'}<br>
      <span style="font-size:.85rem">${diagHW().length ? 'جرّب فصلًا آخر أو أنشئ اختبارًا لهذا الفصل.' : 'أنشئ نشاطاً واختر نوعه «🔍 اختبار تشخيصي».'}</span></div>`;
    return;
  }
  if(!D.done){
    box.innerHTML = `<div class="empty"><span class="big">⏳</span>
      ${D.pool.length ? 'لم يجب أحد بعد على «' + esc(D.h.title) + '».' : 'لا طلاب في هذا الفصل.'}</div>`;
    return;
  }

  const weak    = D.gaps.filter(g=>g.pct < 50);
  const mid     = D.gaps.filter(g=>g.pct >= 50 && g.pct < 75);
  const strong  = D.gaps.filter(g=>g.pct >= 75);
  const cnt = nm => D.counts[nm] || 0;

  box.innerHTML = `
    <div class="rep-page one-page">
      ${repHead('(تقرير تشخيصي)')}
      <div class="rep-in">
        ${repInfo(D, cls)}

        <div class="rep-band">🔍 تقرير تشخيصي — قياس المستوى قبل التدريس</div>

        <!-- ① مجموعات المستوى -->
        <div class="rep-sec">مجموعات المستوى</div>
        <div class="rep-box">
          <table class="rt"><thead><tr>
            <th>المستوى</th><th>النطاق</th><th>عدد الطلاب</th><th>النسبة من المجيبين</th><th>الإجراء المقترح</th>
          </tr></thead><tbody>
            ${DIAG_BANDS.map((b,i)=>{
              const hi = i===0 ? 100 : DIAG_BANDS[i-1].min - 1;
              const c = cnt(b.name);
              return `<tr>
                <td style="background:${b.color};color:#fff;font-weight:700">${b.name}</td>
                <td>${b.min} - ${hi}%</td>
                <td><b>${c}</b></td>
                <td>${D.done?Math.round(c/D.done*100):0}%</td>
                <td style="text-align:start;font-size:.9em">${b.act}</td>
              </tr>`;
            }).join('')}
          </tbody></table>
        </div>

        ${D.skills.length?`<!-- ②أ خريطة المهارات -->
        <div class="rep-sec">خريطة الفجوات في المهارات — أساس الخطط العلاجية</div>
        <div class="rep-box">
          <table class="rt"><thead><tr><th>المهارة</th><th>المجال</th><th>الأسئلة</th><th>إتقان الفصل</th><th>تنقصه المهارة (دون ${SKILL_GAP_UI}%)</th><th class="no-print"></th></tr></thead><tbody>
            ${D.skills.map(k=>{const b=skBand(k.rate),col=k.rate>=80?'#1B9C6B':k.rate>=60?'#2E6BB8':k.rate>=40?'#C88A2E':'#B4232F';return `<tr>
              <td style="text-align:start"><b>${esc(k.skill)}</b></td><td style="font-size:.85em">${esc(k.domain||'—')}</td><td>${k.q}</td>
              <td><b style="color:${col}">${k.rate}%</b><small style="display:block;font-size:.78em">${b.n}</small></td>
              <td style="text-align:start;font-size:.85em">${k.miss.length?`<b>${k.miss.length}</b> من ${k.seen}: ${k.miss.slice(0,6).map(r=>esc(r.s.name.split(' ').slice(0,2).join(' '))).join('، ')}${k.miss.length>6?` +${k.miss.length-6}`:''}`:'<span style="color:#1B9C6B">لا أحد ✓</span>'}</td>
              <td class="no-print">${k.miss.length?`<button type="button" class="btn ${k.miss.length/Math.max(1,k.seen)>=.3?'ghost':'tick'} sm" onclick="planFromDiag('${esc(D.h.id)}',${JSON.stringify(k.skill).replace(/"/g,'&quot;')})">＋ خطة${k.miss.length>1?' جماعية':''}</button>`:''}</td></tr>`}).join('')}
          </tbody></table>
          ${D.skills.some(k=>k.miss.length/Math.max(1,k.seen)>=.3)?`<div style="margin-top:.5rem;font-size:.84em;color:#8a5a00">⚠️ المهارة التي تنقص 30% من الفصل فأكثر: الأرجح أن الشرح لم يصل — أعد تدريسها للفصل كله قبل الخطط العلاجية.</div>`:''}
        </div>`:''}
        <!-- ② خريطة الفجوات -->
        <div class="rep-sec">${D.skills.length?'تفصيل الأسئلة — ما أخفق فيه الفصل':'خريطة الفجوات — ما يحتاجه الفصل'}</div>
        <div class="rep-box">
          <div class="rep-info" style="margin-bottom:.55rem">
            <div>فجوة حادّة<b style="color:#B4232F">${weak.length} مهمة</b></div>
            <div>تحتاج تعزيزًا<b style="color:#C88A2E">${mid.length} مهمة</b></div>
            <div>متقنة<b style="color:#1B9C6B">${strong.length} مهمة</b></div>
          </div>
          ${weak.length ? `
            <div style="font-weight:700;color:#B4232F;margin:.3rem 0 .4rem;font-size:.92em">
              ⚠️ ابدأ بهذي المفاهيم — أخفق فيها أكثر من نصف الفصل</div>
            ${weak.slice(0,10).map(g=>`
              <div class="hb" style="margin-bottom:.35rem">
                <span class="nm" title="${esc(g.title)}">${g.i+1}. ${esc(g.title)}</span>
                <span class="tr"><i style="width:${Math.max(g.pct,2)}%;background:#B4232F"></i></span>
                <span class="vv" style="color:#B4232F">${g.pct}%</span>
                <span class="muted" style="font-size:.76rem;min-width:4.6rem;text-align:end">${g.missed} أخفقوا</span>
              </div>`).join('')}${weak.length>10?`<div class="muted" style="font-size:.78rem">و${weak.length-10} مهمة أخرى ضمن الفجوات الحادّة</div>`:''}
          ` : `<div style="text-align:center;color:#1B9C6B;font-weight:700;padding:.5rem">
                 ✅ لا فجوات حادّة — الفصل متمكّن من الأساسيات</div>`}
          ${mid.length ? `
            <div style="font-weight:700;color:#C88A2E;margin:.7rem 0 .4rem;font-size:.92em">
              تحتاج تعزيزًا</div>
            ${mid.slice(0,6).map(g=>`
              <div class="hb" style="margin-bottom:.3rem">
                <span class="nm" title="${esc(g.title)}">${g.i+1}. ${esc(g.title)}</span>
                <span class="tr"><i style="width:${g.pct}%;background:#C88A2E"></i></span>
                <span class="vv" style="color:#C88A2E">${g.pct}%</span>
                <span class="muted" style="font-size:.76rem;min-width:4.6rem;text-align:end">${g.missed} أخفقوا</span>
              </div>`).join('')}${mid.length>6?`<div class="muted" style="font-size:.78rem">و${mid.length-6} مهمة أخرى تحتاج تعزيزًا</div>`:''}` : ''}
        </div>

        ${repFoot()}
      </div>
    </div>

    <!-- ③ صفحة الطلاب -->
    <div class="rep-page">
      ${repHead('(توزيع الطلاب)')}
      <div class="rep-in">
        <div class="rep-sec">الطلاب حسب المستوى</div>
        ${DIAG_BANDS.filter(b=>cnt(b.name)).map(b=>{
          const list = D.rows.filter(r=>r.band.name===b.name)
                             .sort((a,b2)=>b2.pct-a.pct);
          return `<div class="rep-box" style="margin-bottom:.55rem">
            <div class="row" style="gap:.5rem;margin-bottom:.5rem">
              <span class="pill" style="background:${b.color};color:#fff">${b.name}</span>
              <b>${list.length} طالب</b>
              <span class="muted" style="font-size:.84rem">— ${b.act}</span>
            </div>
            <div class="diag-student-list">
              ${list.map((r,i)=>`<div class="diag-student-item">
                <span class="diag-student-num">${i+1}</span>
                <div class="diag-student-main">
                  <b>${esc(r.s.name)}</b>
                  <small>${esc(r.s.cls || 'بدون فصل')}${(()=>{const m=Object.entries(r.skills||{}).filter(([,v])=>v.rate<SKILL_GAP_UI).sort((a,b2)=>a[1].rate-b2[1].rate);return m.length?` · تنقصه: ${m.slice(0,3).map(([k,v])=>`${esc(k)} ${v.rate}%`).join('، ')}${m.length>3?` +${m.length-3}`:''}`:''})()}</small>
                </div>
                <span class="diag-student-pct" style="color:${b.color}">${r.pct}%</span>
                <button type="button" class="btn ghost sm no-print"
                        onclick="openStudentProfile('${esc(r.s.id)}')">فتح الملف</button>
              </div>`).join('')}
            </div>
          </div>`;
        }).join('')}
        ${repFoot()}
      </div>
    </div>`;
}


/* 🧠 لوحة تقرير أنماط التعلّم */
function styFill(){
  const cSel = document.getElementById('sty-class');
  const hSel = document.getElementById('sty-hw');
  if(!cSel || !hSel) return;
  const curC = cSel.value, curH = hSel.value;
  cSel.innerHTML = '<option value="__all__">كل الفصول</option>' +
    classes().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if([...cSel.options].some(o=>o.value===curC)) cSel.value = curC;

  const cls = cSel.value;
  const list = styleHW().filter(h => (!cls || cls==='__all__') ? true : (hwFor(h, cls)))
                        .slice().sort((a,b)=>(b.at||0)-(a.at||0));
  hSel.innerHTML = list.length
    ? list.map(h=>`<option value="${esc(h.id)}">${esc(h.title)}</option>`).join('')
    : '<option value="">لا اختبارات أنماط</option>';
  if([...hSel.options].some(o=>o.value===curH)) hSel.value = curH;
}

function renderStylesPanel(){
  styFill();
  const box = document.getElementById('sty-body'); if(!box) return;
  const _styQ = (document.getElementById('sty-search')||{}).value || '';
  const cls = (document.getElementById('sty-class')||{}).value || '__all__';
  const hid = (document.getElementById('sty-hw')||{}).value || '';
  const h = styleHW().find(x=>x.id===hid);

  if(!h){
    box.innerHTML = `<div class="empty"><span class="big">🧠</span>
      ${styleHW().length ? 'لا اختبارات أنماط لهذا الفصل.' : 'لا يوجد اختبار أنماط تعلّم بعد.'}<br>
      <span style="font-size:.85rem">${styleHW().length ? 'جرّب فصلًا آخر أو أنشئ اختبارًا لهذا الفصل.' : 'أنشئ نشاطاً واختر نوعه «🧠 أنماط التعلّم» ثم استورد الأسئلة.'}</span></div>`;
    return;
  }

  const pool = STUDENTS.filter(s =>
    (hwFor(h, s.cls)) && ((!cls || cls==='__all__') ? true : s.cls === cls));
  const rows = [];
  const counts = Object.fromEntries(STYLE_ORDER.map(k=>[k,0]));
  pool.forEach(s=>{
    const t = styleTally(h, s.id);
    if(!t) return;
    rows.push({ s, ...t });
    counts[t.top] = (counts[t.top]||0) + 1;
  });

  if(!rows.length){
    box.innerHTML = `<div class="empty"><span class="big">⏳</span>
      ${pool.length ? 'لم يجب أحد بعد على «' + esc(h.title) + '».' : 'لا طلاب في هذا الفصل.'}</div>`;
    return;
  }

  const order = STYLE_ORDER.slice();
  Object.keys(counts).forEach(k=>{ if(order.indexOf(k)<0) order.push(k); });
  const n = rows.length;
  // النمط الغالب = الأكثر طلابًا (لا أول نمط في الترتيب الثابت)
  const topK = order.reduce((b,k)=>(counts[k]||0)>(counts[b]||0)?k:b, order[0]);
  const sc = k => STYLE_COLOR[k] || '#5A6B84';
  const si = k => STYLE_ICON[k] || '🏷️';
  const _maxC = Math.max(0, ...order.map(k=>counts[k]||0));
  const _tied = order.filter(k=>(counts[k]||0)===_maxC && _maxC>0);
  const cnt = k => counts[k] || 0;

  const TIPS = {
    'بصري':'أكثر من المخططات والصور والخرائط الذهنية، واكتب العناصر على السبورة.',
    'سمعي':'اشرح شفويًا، وأتِح النقاش والعمل الثنائي، واطلب منهم إعادة الشرح بأصواتهم.',
    'حركي':'صمّم أنشطة عملية وتجارب ونماذج ملموسة، وقلّل الجلوس الطويل.',
    'قرائي/كتابي':'وفّر ملخصات مكتوبة وبطاقات مفاهيم، واطلب تدوين الملاحظات.'
  };

  const _styTarget = hwClsLabel(h);
  const _styShown = (cls && cls !== '__all__') ? cls : null;
  const _styClsLine = _styShown ? (_styShown === _styTarget ? _styShown : _styShown + ' · النشاط يستهدف: ' + _styTarget) : _styTarget;
  const _styToday = new Date().toLocaleDateString('ar-SA-u-ca-gregory', { day:'numeric', month:'long', year:'numeric' });
  box.innerHTML = `
    <div class="rep-page one-page">
      ${repHead('(أنماط التعلّم)')}
      <div class="rep-in">
        <div class="rep-info">
          <div>الاختبار<b>${esc(h.title)}</b></div>
          <div>الفصل<b>${esc(_styClsLine)}</b></div>
          <div>التاريخ<b>${_styToday}</b></div>
          <div>أجاب<b>${n} من ${pool.length}</b></div>
          <div>النمط الغالب<b style="color:${sc(topK)}">${si(topK)} ${esc(topK)}</b>${_tied.length>1?`<span class="muted" style="font-size:.8rem"> · تعادل مع ${esc(_tied.filter(k=>k!==topK).join('، '))}</span>`:''}</div>
        </div>
        <div class="rep-band">🧠 تقرير أنماط التعلّم — كيف يتعلّم طلابك</div>

        <div class="rep-sec">توزيع الفصل</div>
        <div class="rep-box">
          ${order.map(k=>{
            const c = cnt(k), pct = Math.round(c/n*100);
            return `<div class="hb" style="margin-bottom:.45rem">
              <span class="nm">${si(k)} ${esc(k)}</span>
              <span class="tr"><i style="width:${Math.max(pct,2)}%;background:${sc(k)}"></i></span>
              <span class="vv" style="color:${sc(k)}">${pct}%</span>
              <span class="muted" style="font-size:.78rem;min-width:3.4rem;text-align:end">${c} طالب</span>
            </div>`;
          }).join('')}
        </div>

        <div class="rep-sec">توصيات تدريسية</div>
        <div class="rep-box">
          <table class="rt"><thead><tr><th>النمط</th><th>الطلاب</th><th>ماذا تفعل في الحصة</th></tr></thead>
          <tbody>
            ${order.map(k=>`<tr>
              <td style="background:${sc(k)};color:#fff;font-weight:700">${si(k)} ${esc(k)}</td>
              <td><b>${cnt(k)}</b> (${Math.round(cnt(k)/n*100)}%)</td>
              <td style="text-align:start;font-size:.9em">${esc(TIPS[k]||'نوّع الأساليب.')}</td>
            </tr>`).join('')}
          </tbody></table>
          <div style="margin-top:.5rem;font-size:.88rem">
            <b>الأولوية: ${si(topK)} ${esc(topK)}</b>
            <span class="muted"> — ابدأ به ثم نوّع ليشمل البقية.</span>
          </div>
        </div>
        ${repFoot()}
      </div>
    </div>

<div class="rep-page">
      ${repHead('(نمط كل طالب)')}
      <div class="rep-in">
      <div class="sheet-head no-print" style="margin-bottom:.5rem"><h2>نمط كل طالب</h2>
        <span class="spacer"></span>
        <input class="inp" id="sty-search" placeholder="🔍 ابحث بالاسم" value="${esc(_styQ)}"
               style="width:auto;min-width:150px" oninput="styFilterList()"></div>
      <div style="overflow-x:auto"><table class="gt" id="sty-table">
        <thead><tr>
          <th style="width:38px">#</th>
          <th style="text-align:start">الطالب</th>
          <th style="width:80px">الفصل</th>
          <th style="width:130px">النمط الغالب</th>
          ${order.map(k=>`<th style="width:64px">${si(k)}<span class="dt" style="color:#9FB2CC">${esc(k)}</span></th>`).join('')}
        </tr></thead>
        <tbody>
          ${rows.slice().sort((a,b)=>a.s.name.localeCompare(b.s.name,'ar')).map((r,i)=>{
            const map = {}; r.rows.forEach(([k,c])=>map[k]=Math.round(c/r.total*100));
            return `<tr data-nm="${esc(normAr(r.s.name))}">
              <td style="color:var(--ink-soft);font-size:.76rem">${i+1}</td>
              <td class="nm">${esc(r.s.name)}</td>
              <td style="font-size:.78rem">${esc(r.s.cls||'—')}</td>
              <td><b style="color:${sc(r.top)}">${si(r.top)} ${esc(r.top)}</b></td>
              ${order.map(k=>`<td style="color:${map[k]?sc(k):'#BBB'}">${map[k]?map[k]+'%':'—'}</td>`).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
      ${repFoot()}
      </div>
    </div>`;
}


/* ═══ وضع مختصر/مفصّل للتشخيصي وأنماط التعلّم ═══ */
const K_DIAGMODE = 'hwapp_diagmode_v1';
const K_STYLEMODE = 'hwapp_stylemode_v1';

function diagMode(){
  return localStorage.getItem(K_DIAGMODE) || 'full';
}

function stylesMode(){
  return localStorage.getItem(K_STYLEMODE) || 'full';
}

function syncReportModeButtons(type, mode){
  const selector = type === 'diag' ? '.diag-mode' : '.styles-mode';
  document.querySelectorAll(selector).forEach(btn=>{
    const selected = btn.dataset.m === mode;
    btn.classList.toggle('on', selected);
    btn.setAttribute('aria-selected', selected ? 'true' : 'false');
  });
}

function applyReportMode(boxId, type, mode){
  const box = document.getElementById(boxId);
  if(!box) return;
  box.classList.toggle('report-mode-brief', mode === 'brief');
  box.classList.toggle('report-mode-full', mode === 'full');
  syncReportModeButtons(type, mode);
}

function applyDiagMode(){
  applyReportMode('dg-body', 'diag', diagMode());
}

function applyStylesMode(){
  applyReportMode('sty-body', 'styles', stylesMode());
}

const _renderDiagPanelWithMode = renderDiagPanel;
renderDiagPanel = function(){
  _renderDiagPanelWithMode();
  applyDiagMode();
};

const _renderStylesPanelWithMode = renderStylesPanel;
renderStylesPanel = function(){
  _renderStylesPanelWithMode();
  applyStylesMode();
  styFilterList();
};


function styFilterList(){
  const q = normAr((document.getElementById('sty-search')||{}).value || '');
  const w = q.split(' ').filter(Boolean);
  document.querySelectorAll('#sty-table tbody tr').forEach(tr=>{
    const hay = tr.dataset.nm || '';
    tr.style.display = (!w.length || w.every(x=>hay.indexOf(x)!==-1)) ? '' : 'none';
  });
}


/* 🧠 حساب نمط الطالب من إجاباته */
function normalizeLearningStyle(value){
  const key = String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
  if(!key) return '';
  if(['بصري','بصرية','visual','vis'].includes(key)) return 'بصري';
  if(['سمعي','سمعية','auditory','auditive','audio'].includes(key)) return 'سمعي';
  if(['حركي','حركية','kinesthetic','kinaesthetic','kinesthetic learning'].includes(key)) return 'حركي';
  if([
    'قرائي/كتابي','قرائي / كتابي','قرائي وكتابي','قرائي و كتابي',
    'قراءة/كتابة','قراءة / كتابة','قراءة وكتابة','قراءة و كتابة',
    'reading/writing','reading / writing','reading and writing',
    'reading','writing','read/write'
  ].includes(key)) return 'قرائي/كتابي';
  return String(value).trim();
}

function styleTally(h, sid){
  const v = (h.subs||{})[sid];
  if(!v || !Array.isArray(v.ans)) return null;

  const tally = Object.fromEntries(STYLE_ORDER.map(k=>[k,0]));
  let total = 0;

  (h.qs||[]).forEach((q,i)=>{
    const pick = v.ans[i];
    if(pick === null || pick === undefined) return;

    const rawTag = q.tags && q.tags[pick];
    const rawOption = q.o && q.o[pick];
    const byPosition = STYLE_ORDER[pick];
    const tag = normalizeLearningStyle(rawTag || rawOption || byPosition);

    if(!tag) return;
    if(!(tag in tally)) tally[tag] = 0;
    tally[tag] += 1;
    total += 1;
  });

  if(!total) return null;

  const rows = Object.entries(tally)
    .filter(([,count])=>count > 0)
    .sort((a,b)=>b[1]-a[1] || STYLE_ORDER.indexOf(a[0])-STYLE_ORDER.indexOf(b[0]));

  return {
    rows,
    total,
    top: rows[0][0],
    topPct: Math.round(rows[0][1]/total*100)
  };
}

const STYLE_COLOR = { 'بصري':'#2E6BB8', 'سمعي':'#7B4FA8', 'حركي':'#C88A2E', 'قرائي/كتابي':'#1B9C6B' };
const STYLE_TIP = {
  'بصري':'استخدم معه المخططات والصور والخرائط الذهنية',
  'سمعي':'اشرح له شفويًا وأتِح له النقاش وإعادة الشرح',
  'حركي':'أشركه في التجارب والأنشطة العملية',
  'قرائي/كتابي':'زوّده بملخصات مكتوبة واطلب منه التدوين'
};
const STYLE_ICON  = { 'بصري':'👁️', 'سمعي':'👂', 'حركي':'✋', 'قرائي/كتابي':'📖' };


/* 🧠 ملف أنماط التعلّم: كل خيار يمثّل نمطاً بترتيب ثابت */
const STYLE_ORDER = ['بصري','سمعي','حركي','قرائي/كتابي'];

/* 🔒 مهارة سؤال التشخيصي من نواتج نافس فقط: الاسم الوارد يُطابَق بالناتج الرسمي، وإلا يبقى السؤال بلا مهارة
   (كان أي اسم يُقبل، والافتراضي «مهارة أساسية» — فتتفرّق الإجابات على أسماء لا تلتقي مع نواتج الأنشطة) */
function impDiagSk(x){ const raw=String(x&&x.skill||'').trim(), sk=raw&&typeof skFromAI==='function'?skFromAI(raw):'';
  return { domain:String(x&&x.domain||'المفاهيم الأساسية'), ...(sk?{skill:sk}:{}), ...(raw&&!sk?{skRaw:raw.slice(0,60)}:{}) }; }

function updateStudentGameCount(){
  const type=normalizeGameType(document.getElementById('game-type')?.value||'memory');
  const note=document.getElementById('game-count-note');
  if(!note) return;
  if(isMcqGameType(type)){
    const m=gameMeta(type);
    const rows=[...document.querySelectorAll('#game-lock-rows .game-lock-row')];
    const valid=rows.filter(r=>{
      const q=r.querySelector('.game-lock-q')?.value.trim();
      const opts=[...r.querySelectorAll('.game-lock-opt')].map(x=>x.value.trim()).filter(Boolean);
      return q && opts.length>=2 && r.querySelector('input[type=radio]:checked');
    }).length;
    const over=rows.length>m.max?` · ⚠️ يُستخدم أول ${m.max} فقط`:'';
    note.textContent=`${rows.length} سؤالًا · ${valid} صالحة · الحد ${m.min}–${m.max}${over}`;
  }else{
    const words=[...document.querySelectorAll('#game-memory-rows .game-word')].map(x=>x.value.trim()).filter(Boolean);
    note.textContent=`${words.length} كلمة · ${Math.min(words.length,8)} أزواج ستظهر في اللوحة`;
  }
}

function addStudentLockQuestionRow(item={}){
  const box=document.getElementById('game-lock-rows'); if(!box) return;
  const index=box.querySelectorAll('.game-lock-row').length+1;
  const options=Array.isArray(item.o)?item.o.slice(0,4):[];
  const answer=Number.isInteger(Number(item.a))?Number(item.a):0;
  const row=document.createElement('div');
  row.className='game-lock-row';
  row.style.cssText='border:1.5px solid var(--rule);border-radius:14px;padding:.75rem;margin-bottom:.55rem;background:#F8FAFC';
  row.innerHTML=`
    <div class="row" style="gap:.45rem;align-items:center">
      <span class="pill quiet" style="min-width:2.2rem;justify-content:center">${index}</span>
      <b style="font-size:.82rem;flex:1">مرحلة ${index}</b>
      <button type="button" class="btn ghost sm game-lock-remove">حذف</button>
    </div>
    <input class="inp game-lock-q" value="${esc(item.q||'')}" placeholder="السؤال" style="margin-top:.5rem">
    <div class="game-lock-editor-options" style="display:grid;gap:.4rem;margin-top:.45rem">
      ${[0,1,2,3].map(i=>`<label class="row" style="gap:.35rem;align-items:center">
        <input type="radio" name="lock-answer-${index}" value="${i}" ${i===answer?'checked':''}>
        <input class="inp game-lock-opt" value="${esc(options[i]||'')}" placeholder="الخيار ${i+1}">
      </label>`).join('')}
    </div>`;
  row.querySelector('.game-lock-remove').onclick=()=>{row.remove();updateStudentGameCount();};
  box.appendChild(row);
  row.querySelectorAll('input').forEach(el=>el.addEventListener('input',updateStudentGameCount));
  row.querySelectorAll('input[type=radio]').forEach(el=>el.addEventListener('change',updateStudentGameCount));
  updateStudentGameCount();
}

let GAME_EDIT=null;   // { id, list:[{type,data}], idx }

function gameEditEntry(){ return GAME_EDIT ? GAME_EDIT.list[GAME_EDIT.idx] : null; }

function openStudentGameSettings(id, preset){
  const h=HW.find(x=>x.id===id) || (EXAM_AI_ACTIVE_PROXY && EXAM_AI_ACTIVE_PROXY.id===id ? EXAM_AI_ACTIVE_PROXY : null); if(!h) return;
  const list=activityGames(h).map(g=>({type:normalizeGameType(g.type),data:(g.data||[]).slice(),prize:g.prize}));

  if(preset && preset.type && Array.isArray(preset.data)){
    const entry={type:normalizeGameType(preset.type),data:preset.data.slice()};
    const i=Number.isInteger(preset.index)?preset.index:-1;
    if(i>=0 && i<list.length){ list[i]=entry; GAME_EDIT={id,list,idx:i,preset:true}; }
    else { list.push(entry); GAME_EDIT={id,list,idx:list.length-1,preset:true}; }
  }else{
    if(!list.length) list.push({type:normalizeGameType(h.game?.type||'memory'),data:[]});
    GAME_EDIT={id,list,idx:0,preset:false};
  }

  const bank=(h.qs||[]).filter(q=>q && q.t==='q').length;
  openModal(`
    <h2>🎮 ألعاب الطالب — ${esc(h.title)}</h2>
    <p style="color:var(--ink-soft);font-size:.85rem;line-height:1.7;margin:.2rem 0 .7rem">
      المسار: <b>بنك الأسئلة ← بناء الألعاب ← حفظ ← نشر</b>. يمكنك وضع أكثر من لعبة في هذا النشاط،
      ويراها الطالب كبطاقات منفصلة في رابط واحد، ولكل لعبة محاولة واحدة ونقاطها الخاصة.
    </p>
    <div id="game-server-note"></div>
    ${GAME_EDIT.preset?`<div class="pill due" style="margin-bottom:.5rem">🤖 محتوى مقترح من الذكاء الاصطناعي — لم يُحفظ بعد</div>`:''}
    ${!isGamesKind(h)?`<div style="margin:0 0 .6rem;padding:.6rem .7rem;border:1.5px solid rgba(214,69,91,.35);
      border-radius:12px;background:rgba(214,69,91,.06);font-size:.82rem;line-height:1.7">
      <b>⚠️ نوع هذا النشاط «${esc(HW_KINDS.find(k=>k.v===(h.kind||'normal'))?.t||h.kind||'عادي')}» وليس «ألعاب».</b><br>
      سيصل الطالب كنشاط أسئلة، وتظهر ألعابه في قسم الألعاب منفصلة. إن أردته ألعابًا فقط:
      <button class="btn sm" type="button" style="margin-top:.4rem" onclick="convertToGamesActivity('${id}')">🎮 حوّله إلى نشاط ألعاب</button>
    </div>`:''}
    <div class="row" style="gap:.4rem;flex-wrap:wrap;margin-bottom:.6rem">
      <span class="pill quiet">بنك الاختيار من متعدد: ${bank}</span>
      <button class="btn ghost sm" type="button" onclick="openQs('${id}')">📝 فتح بنك الأسئلة</button>
      ${bank>=2?`<button class="btn ghost sm" type="button" onclick="rebuildGameFromBank('${id}')">🔁 أعد بناء اللعبة من البنك</button>`:''}
    </div>
    <div id="game-editor-body"></div>
    <div class="row" style="gap:.5rem;flex-wrap:wrap;margin-top:.7rem;padding-top:.7rem;border-top:1px solid var(--rule)">
      <button id="game-ai-btn" class="ai-btn solid" style="flex:1;min-width:190px" type="button"
        onclick="openNormalAIGenerator('${id}', document.getElementById('game-type')?.value, GAME_EDIT?GAME_EDIT.idx:0)"><span class="ai-mark">✦</span> توليد محتوى اللعبة بالذكاء</button>
      <button class="btn ghost sm" type="button" onclick="exportStudentGameJson('${id}')">💾 تصدير JSON</button>
      <button class="btn ghost sm" type="button" onclick="document.getElementById('imp-game-json').click()">📥 استيراد JSON</button>
      <input type="file" id="imp-game-json" accept=".json,application/json" style="display:none" onchange="importStudentGameJson(event,'${id}')">
    </div>
    <p class="muted" style="font-size:.76rem;margin:.45rem 0 0">⚠️ لا شيء يصل الطالب حتى تضغط «حفظ الألعاب» ثم «انشر/أعد النشر».</p>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn" onclick="saveStudentGameSettings('${id}')">حفظ الألعاب</button>
    </div>`);
  renderGameEditor();
  serverGamesBanner();
}

/* يعيد رسم شريط الألعاب ومحرر اللعبة المحددة من الذاكرة لا من النشاط المحفوظ */
function renderGameEditor(){
  const box=document.getElementById('game-editor-body');
  if(!box || !GAME_EDIT) return;
  const e=gameEditEntry();
  const strip=GAME_EDIT.list.map((g,i)=>{
    const on=i===GAME_EDIT.idx;
    const n=(g.data||[]).length;
    const ok=gameEntryReady(g);
    return `<button type="button" class="btn ${on?'tick':'ghost'} sm" onclick="gameEditSelect(${i})" style="gap:.3rem">
      ${gameTypeLabel(g.type)} ${i+1} <span style="opacity:.75">(${n})</span>${ok?'':' ⚠️'}
    </button>`;
  }).join('');

  box.innerHTML=`
    <div class="row" style="gap:.4rem;flex-wrap:wrap;margin-bottom:.55rem">
      ${strip}
      ${GAME_EDIT.list.length<MAX_GAMES_PER_ACTIVITY?`<button type="button" class="btn ghost sm" onclick="gameEditAdd()">➕ أضف لعبة</button>`:''}
      ${GAME_EDIT.list.length>1?`<button type="button" class="btn ghost sm danger-icon" onclick="gameEditRemove(${GAME_EDIT.idx})">🗑️ احذف الحالية</button>`:''}
    </div>
    <div class="field"><label>نوع اللعبة ${GAME_EDIT.idx+1}</label>
      <select class="inp" id="game-type" onchange="gameEditorTypeChanged('${GAME_EDIT.id}')">
        ${Object.keys(GAME_TYPE_META).map(k=>`<option value="${k}" ${e.type===k?'selected':''}>${GAME_TYPE_META[k].label}</option>`).join('')}
      </select>
      <span id="game-type-hint" style="font-size:.75rem;color:var(--ink-soft);margin-top:.25rem;display:block">${esc(gameMeta(e.type).hint||'')}</span>
    </div>
    <div id="game-memory-editor" style="display:${isMcqGameType(e.type)?'none':''}">
      <div id="game-memory-rows">
        ${(e.type==='memory'?e.data:[]).map((w,i)=>`<div class="row game-word-row" style="gap:.45rem;margin-bottom:.4rem">
          <span class="pill quiet" style="min-width:2.2rem;justify-content:center">${i+1}</span>
          <input class="inp game-word" value="${esc(w)}" placeholder="كلمة أو مصطلح" style="flex:1">
          <button class="btn ghost sm" type="button" onclick="this.closest('.game-word-row').remove();updateStudentGameCount()">حذف</button>
        </div>`).join('')}
      </div>
      <button class="btn ghost sm" type="button" onclick="addStudentGameWordRow()">+ إضافة كلمة يدويًا</button>
    </div>
    <div id="game-lock-editor" style="display:${isMcqGameType(e.type)?'':'none'}">
      ${e.type==='lock'?`<div class="field">
        <label>🎁 ما داخل الصندوق <small style="color:var(--ink-soft)">يظهر للطالب عند فتح الرمز كاملًا</small></label>
        <input class="inp" id="game-prize" maxlength="160" value="${esc(e.prize||'')}"
          placeholder="مثال: أحسنت! لك ورقة امتياز عند المعلم · أو: عشر دقائق نشاط حر">
        <span style="font-size:.74rem;color:var(--ink-soft);margin-top:.25rem;display:block">
          الصندوق لا ينفتح إلا بإجابة كل الأسئلة صحيحة، ومعه ١٠ نقاط مكافأة إتقان ضمن الخمسين.</span>
      </div>`:''}
      <div id="game-lock-rows"></div>
      <button class="btn ghost sm" type="button" onclick="addStudentLockQuestionRow()">+ إضافة سؤال</button>
      <p class="muted" style="font-size:.76rem;margin:.45rem 0 0">أسئلة اختيار من متعدد — تصلح لكل ألعاب هذه العائلة، فبنك واحد يكفي.</p>
    </div>
    <div id="game-count-note" class="muted" style="font-size:.8rem;margin-top:.6rem"></div>`;

  if(isMcqGameType(e.type)) (e.data||[]).forEach(item=>addStudentLockQuestionRow(item));
  document.getElementById('game-memory-rows')?.addEventListener('input',updateStudentGameCount);
  updateStudentGameCount();
}

/* 🔎 هل الخادم المنشور يدعم الألعاب المتعددة وكل أنواعها؟
   النسخة القديمة تمرر «كشف الكلمات» فقط وتحذف الباقي بصمت — وهذا لا يظهر
   في أي رسالة خطأ، فنسأل الخادم عن نفسه مرة واحدة لكل جلسة. */
let SERVER_GAMES=null;   // null=لم يُفحص · true=حديث · false=قديم
async function checkServerGames(force){
  if(!force && SERVER_GAMES!==null) return SERVER_GAMES;
  const api=getApi();
  if(!api) return (SERVER_GAMES=null);
  try{
    const r=await fetch(api.replace(/\/+$/,'')+'/version',{method:'GET'});
    if(!r.ok) return (SERVER_GAMES=false);
    const j=await r.json();
    SERVER_GAMES=!!(j && j.multiGame);
  }catch(e){
    console.error('checkServerGames:',e);
    SERVER_GAMES=null;
  }
  return SERVER_GAMES;
}

function serverGamesBanner(){
  const el=document.getElementById('game-server-note');
  if(!el) return;
  checkServerGames().then(ok=>{
    const box=document.getElementById('game-server-note');
    if(!box) return;
    if(ok===true){ box.innerHTML=''; return; }
    if(ok===false){
      box.innerHTML=`<div style="margin:0 0 .6rem;padding:.6rem .7rem;border:1.5px solid rgba(214,69,91,.4);
        border-radius:12px;background:rgba(214,69,91,.07);font-size:.82rem;line-height:1.7">
        <b>⛔ الخادم المنشور نسخة قديمة.</b><br>
        سيمرّر «كشف الكلمات» فقط ويحذف بقية الألعاب بصمت عند الطالب.
        انشر ملف الـWorker الجديد ثم أعد نشر النشاط.
      </div>`;
    }else{
      box.innerHTML=`<div class="muted" style="font-size:.76rem;margin:0 0 .5rem">تعذّر فحص الخادم الآن — تأكد من الاتصال قبل النشر.</div>`;
    }
  });
}

/* توليد رابط الطالب */
function hwShortId(h){
  // 🆔 معرف ثابت وفريد فعليًا. المعرّف القديم ذي 4 محارف كان معرضًا للتصادم،
  // وهذا خطير لأن sid هو هوية النشاط على الخادم والرابط المختصر.
  if(!h.sid){
    const rnd = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID().replace(/-/g,'').slice(0,12).toUpperCase()
      : Math.random().toString(36).slice(2,14).toUpperCase();
    h.sid = 'A' + Date.now().toString(36).toUpperCase() + rnd;
  }
  h.key = h.key || Math.random().toString(36).slice(2,10);
  return h.sid;
}

let HW_REPUBLISH_SELECTED = new Set();

/* ═══════════ 🎮 المسار الموحّد: جاهزية النشاط · تسميات الألعاب · نقطة حفظ واحدة ═══════════
   كل ما يتعلق بـ «هل النشاط جاهز للنشر؟» يمر من هنا فقط، بدل شروط متفرقة
   كانت تفترض أن اللعبة الوحيدة هي «كشف الكلمات» وتمنع نشر «افتح القفل». */
const GAME_TYPE_META = {
  /* الحدود مطابقة لما تعرضه بوابة الطالب فعلاً. أي زيادة تُقتطع عندها بصمت.
     كل ما عدا «كشف الكلمات» يعمل على بنك الاختيار من متعدد نفسه،
     فالمحرر واحد والبنك واحد ولا يتكرر إعداد الأسئلة لكل لعبة. */
  memory:      { label:'🎴 كشف الكلمات',      min:2, max:8,  unit:'كلمة', mcq:false,
                 hint:'بطاقات مقلوبة — يبحث الطالب عن الكلمتين المتطابقتين' },
  lock:        { label:'🔐 افتح القفل',        min:2, max:8,  unit:'سؤال', mcq:true,
                 hint:'كل إجابة صحيحة تكشف رقمًا من رمز القفل' },
  millionaire: { label:'🧗 قفزة الصخور',       min:4, max:8,  unit:'سؤال', mcq:true,
                 hint:'صخور عائمة فوق هاوية — يقفز على الصحيحة، والخاطئة تتفتّت تحته' },
  timeattack:  { label:'🎈 صيد البالونات',     min:5, max:12, unit:'سؤال', mcq:true,
                 hint:'الخيارات بالونات تصعد وتهرب — يفرقع الصحيح قبل أن يفلت' },
  survival:    { label:'🧺 سلة المحصول',       min:4, max:10, unit:'سؤال', mcq:true,
                 hint:'الخيارات تتساقط ويحرّك الطالب سلته لالتقاط الصحيح — ثلاث سلال فقط' },
  million:     { label:'💰 من سيربح المليون',   min:5, max:10, unit:'سؤال', mcq:true,
                 hint:'سلّم جوائز ونقاط أمان و٣ مساعدات (٥٠:٥٠ · تمديد الوقت · تبديل السؤال) — رتّب الأسئلة من الأسهل للأصعب' },
  whack:       { label:'🔨 اضرب الخُلد',        min:4, max:10, unit:'سؤال', mcq:true,
                 hint:'الخيارات تطلّ من جحورها لحظة ثم تختفي — يضرب الصحيح قبل أن يغيب' },
  jumper:      { label:'🍄 قفزة البطل',         min:4, max:10, unit:'سؤال', mcq:true,
                 hint:'أركيد ريترو: يتحرك ويقفز ليضرب بلوك «؟» المكتوب عليه إجابته، ويتفادى الوحش' },
  invaders:    { label:'👾 غزاة الفضاء',        min:4, max:10, unit:'سؤال', mcq:true,
                 hint:'أركيد ريترو: الغزاة يحملون الإجابات — يصوّب ويطلق على الصحيح ويتفادى القنابل' },
  claw:        { label:'🕹️ آلة المخلب',         min:4, max:10, unit:'سؤال', mcq:true,
                 hint:'أركيد ريترو: يحرك المخلب فوق كبسولة إجابته ثم ينزله ليلتقطها' }
};
function isMcqGameType(t){ return !!gameMeta(t).mcq; }
const MAX_GAMES_PER_ACTIVITY = 4;
/* يُعرَّف قبل أول استخدام: activityGames تُستدعى أثناء أول رسم للوحة */
const GAME_TYPE_ALIAS = { confidence: 'whack' };
function gameMeta(t){ return GAME_TYPE_META[String(t||'').toLowerCase()] || GAME_TYPE_META.memory; }
function gameTypeLabel(t){ return gameMeta(t).label; }
function isGamesKind(h){ return !!h && (h.kind === 'games' || h.kind === 'game'); }
/* النشاط الواحد قد يحمل عدة ألعاب: h.games مصفوفة، و h.game يبقى اللعبة الأولى للتوافق */
function activityGames(h){
  if(!h) return [];
  const raw = Array.isArray(h.games) ? h.games : null;
  const list = raw ? raw.slice() : [h.game].filter(Boolean);
  return list.filter(g => g && g.type && Array.isArray(g.data))
             .map(g => (GAME_TYPE_ALIAS[String(g.type).toLowerCase()]
                        ? { ...g, type: normalizeGameType(g.type) } : g));
}
function gameEntryReady(g){ return !!g && Array.isArray(g.data) && g.data.length >= gameMeta(g.type).min; }
function gameReady(h){ return activityGames(h).some(gameEntryReady); }
function gamesSummary(h){
  const list=activityGames(h).filter(gameEntryReady);
  if(!list.length) return 'بلا ألعاب';
  if(list.length===1) return `${gameTypeLabel(list[0].type)} (${list[0].data.length})`;
  return `🎮 ${list.length} ألعاب (${list.reduce((n,g)=>n+g.data.length,0)} عنصر)`;
}
function activityReady(h){
  if(!h) return false;
  if(h.kind === 'files') return true;
  if(h.kind === 'lab') return !!h.lab;
  if(isGamesKind(h)) return gameReady(h);
  return (h.qs || []).length > 0 || gameReady(h);
}
function activityEmptyMsg(h){
  if(isGamesKind(h)){
    const m = gameMeta(h && h.game && h.game.type);
    return 'أكمل محتوى ' + m.label + ' أولاً — ' + m.min + ' عناصر على الأقل';
  }
  return 'أضف أسئلة للنشاط أولاً';
}

/* نقطة الحفظ الوحيدة لمحتوى النشاط: المحرر اليدوي · الذكاء الاصطناعي · استيراد JSON.
   تكتب محليًا ← تتحقق من التخزين فعليًا ← تزامن ← تُرجع النتيجة بلا ادعاء نجاح. */
async function commitActivityContent(id, patch){
  patch = patch || {};
  const h = HW.find(x => x.id === id);
  if(!h) return { ok:false, synced:false, error:'النشاط غير موجود' };
  beginLocalMutation();
  try{
    const now = Date.now();
    if(Array.isArray(patch.qs)) h.qs = JSON.parse(JSON.stringify(patch.qs));
    if(patch.games === null || patch.game === null){ delete h.games; delete h.game; }
    else if(Array.isArray(patch.games)){
      const list = patch.games
        .filter(g => g && g.type && Array.isArray(g.data))
        .slice(0, MAX_GAMES_PER_ACTIVITY)
        .map(g => {
          const entry = {
            type: normalizeGameType(g.type),
            data: JSON.parse(JSON.stringify(g.data)),
            source: g.source || 'manual',
            updatedAt: now
          };
          // 🎁 جائزة صندوق «افتح القفل» تُحفظ مع اللعبة
          if (entry.type === 'lock' && String(g.prize || '').trim()) {
            entry.prize = String(g.prize).trim().slice(0, 160);
          }
          return entry;
        });
      if(list.length){ h.games = list; h.game = list[0]; }
      else { delete h.games; delete h.game; }
    }
    else if(patch.game && patch.game.type && Array.isArray(patch.game.data)){
      const entry = {
        type: normalizeGameType(patch.game.type),
        data: JSON.parse(JSON.stringify(patch.game.data)),
        source: patch.game.source || 'manual',
        updatedAt: now
      };
      h.games = [entry]; h.game = entry;
    }
    /* لا نحوّل نشاطًا عاديًا إلى «ألعاب» لمجرد إرفاق لعبة به؛
       هذا كان يلغي وصول أسئلة النشاط العادي للطالب. */
    if(patch.kind && patch.kind !== h.kind) h.kind = patch.kind;
    h.at = now;
    if(h.published) h.dirty = true;

    if(!save(K.hw, HW)) throw new Error('تعذّر الحفظ على الجهاز');

    const stored = load(K.hw, []);
    const check = Array.isArray(stored) ? stored.find(x => String(x && x.id) === String(id)) : null;
    if(!check) throw new Error('لم يثبت النشاط في التخزين المحلي');
    if(Array.isArray(patch.qs) && (check.qs || []).length !== patch.qs.length)
      throw new Error('لم يثبت بنك الأسئلة في التخزين المحلي');
    if(Array.isArray(patch.games) && patch.games.length &&
       activityGames(check).length !== Math.min(patch.games.length, MAX_GAMES_PER_ACTIVITY))
      throw new Error('لم تثبت الألعاب في التخزين المحلي');
    if(patch.game && Array.isArray(patch.game.data) &&
       (!check.game || (check.game.data || []).length !== patch.game.data.length))
      throw new Error('لم تثبت اللعبة في التخزين المحلي');

    if(patch.dropDraft) deleteQsDraft(id);

    let synced = true;
    if(getApi() && getTok()){
      try{ synced = await pushStateNow(); }
      catch(e){ synced = false; console.error('commitActivityContent sync:', e); }
    }
    if(Array.isArray(patch.qs) && patch.qs.length && typeof qbAutoAdd==='function') qbAutoAdd(h, patch.qs);   // 🗃️ بنك الأسئلة: يُحفظ ما اعتمده المعلم (في الخلفية)
    return { ok:true, synced, activity:h };
  }catch(e){
    console.error('commitActivityContent:', e);
    return { ok:false, synced:false, error:(e && e.message) || 'تعذّر الحفظ' };
  }finally{
    endLocalMutation();
  }
}

/* إغلاق المسار: بعد الحفظ، النشاط المنشور يُحدَّث عند الطلاب تلقائيًا. */
async function refreshPublishedActivity(id){
  const h = HW.find(x => x.id === id);
  if(!h || !h.published || !h.dirty) return null;
  if(!getApi() || !getTok()) return false;
  try{ await publishHwSilently(h); save(K.hw, HW); return true; }
  catch(e){ console.error('refreshPublishedActivity:', e); return false; }
}

function buildPublishPayload(h){
  hwShortId(h);
  const pool = hwPool(h);
  h.roster = pool.map(s=>s.id);
  return {
    id:h.sid, k:h.key, t:h.title, p:h.pts, d:h.due||'', at:Number(h.at)||0,
    api:getApi(), cls:(hwClasses(h).length>1 ? hwClasses(h).join('، ') : (h.cls||'')), mx:h.max||20, kind:h.kind||'normal',
    /* 📋 وصف المهمة يصل الطالب مع النشاط — القديمة بلا وصف تبقى كما هي */
    br:h.brief||'', dv:h.deliver||'', ac:h.accept||'',
    /* 🖼️ رسم توضيحي (SVG) يعرضه الطالب صورةً فوق «المطلوب» */
    ilu:(h.kind==='files' && typeof illusImg==='function' && illusImg(h.illus)) || '',
    il:(h.kind==='files' && typeof illusImg==='function' && !illusImg(h.illus) && illusSvg(h.illus)) || '',
    cm:pool.reduce((m,s)=>{ m[s.name]=s.cls||''; return m; },{}),
    rt:h.reading||null,
    // 📖 اسم واضح ومتوافق مع بوابة الطالب الحديثة، مع إبقاء rt للبيانات المنشورة القديمة.
    reading:h.reading||null,
    g:activityGames(h)[0]||h.game||null,
    gs:activityGames(h).filter(gameEntryReady),
    s:pool.map(s=>s.name), q:h.qs||[],
    /* 🔬 إعداد المختبر: الموضوع والمادتان (أو اختيار حر) — التصحيح في الـ Worker */
    lab:h.kind==='lab' ? (h.lab||{topic:'mixtures',pair:null}) : null,
    /* 🩹 أوقف المعلم العلاج التلقائي لهذا النشاط */
    nr:h.noRem ? 1 : 0,
    /* 📊 يدخل في درجة الأنشطة؟ تعرضه البوابة شارةً على النشاط */
    ng:hwCounts(h) ? 0 : 1,
    /* 🧭 نشاط نافس: يظهر للطالب في خانة «نافس» */
    nf:hwIsNafs(h) ? 1 : 0,
    /* 🧭 وضع نشاط نافس: train تدريب (تغذية فورية ومحاولة ثانية) · sim محاكاة (مؤقت nt ثانية لكل سؤال) */
    ...(hwIsNafs(h) ? { nm: h.nfMode==='sim' ? 'sim' : 'train', nt: Number(h.nfSec)||90 } : {})
  };
}

async function publishHwSilently(h){
  const api=getApi(), tok=getTok();
  if(!api || !tok) throw new Error('config');
  if(!activityReady(h)) throw new Error('empty');
  const payload=buildPublishPayload(h);
  const r=await fetch(api.replace(/\/+$/,'')+'/publish',{
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({t:tok,id:h.sid,payload})
  });
  let j=null; try{ j=await r.json(); }catch(e){}
  if(r.status===401) throw new Error('unauthorized');
  if(!r.ok || !j || !j.ok) throw new Error('publish');
  h.published=true; delete h.dirty; if(!h.firstPub) h.firstPub=(h.publishedAt&&hwAssignedAt(h))||Date.now(); h.publishedAt=Date.now();   // لا يُختم «أول نشر» بيوم إعادة النشر
  try{if(REM_ON&&twinAuto())twinQueue(h)}catch(e){}
  try{skillQueue(h)}catch(e){}
  return payload;
}


/* ═══════════════ تحكم شراء درجات الاختبارات ═══════════════ */
let EXAM_SHOP_POLICY={enabled:true,startAt:0,endAt:0,maxPerStudent:3,students:{}};
let ESP_LOADED=false, ESP_ERR=false;
function espSemester(){const el=document.getElementById('esp-semester');const v=el?.dataset.userChanged?el.value:(DASH_ACADEMIC?.currentSemester||el?.value||1);if(el&&!el.dataset.userChanged)el.value=Number(v)===2?'2':'1';return Number(v)===2?2:1;}
function espDateValue(ts){ if(!ts) return ''; const d=new Date(Number(ts)); if(Number.isNaN(d.getTime())) return ''; const z=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; }
function renderExamShopStatus(){
  const box=document.getElementById('exam-shop-status'); if(!box) return;
  const p=EXAM_SHOP_POLICY||{}; const now=Date.now(); let cls='open', text='🟢 الشراء متاح حاليًا.';
  if(p.enabled===false){cls='closed';text='🔴 الشراء مغلق يدويًا.';}
  else if(p.startAt&&now<p.startAt){cls='closed';text=`⏳ الشراء لم يبدأ بعد. يبدأ في ${new Date(p.startAt).toLocaleString('ar-SA-u-ca-gregory')}.`;}
  else if(p.endAt&&now>p.endAt){cls='closed';text=`⛔ انتهت الإتاحة في ${new Date(p.endAt).toLocaleString('ar-SA-u-ca-gregory')}.`;}
  else if(Number(p.maxPerStudent)<=0){cls='closed';text='🔴 الحد المسموح حاليًا 0 درجة.';}
  const range=(p.startAt||p.endAt)?` · ${p.startAt?new Date(p.startAt).toLocaleString('ar-SA-u-ca-gregory'): 'الآن'} → ${p.endAt?new Date(p.endAt).toLocaleString('ar-SA-u-ca-gregory'):'بدون انتهاء'}`:'';
  box.className='exam-shop-status '+cls; box.textContent=`الفصل الدراسي ${espSemester()} · `+text+` الحد العام: ${p.maxPerStudent??3} درجة لكل طالب`+range;
}
function examShopStudentClass(st){ return String(st?.cls ?? st?.className ?? st?.class ?? st?.grade ?? '').trim(); }
function populateExamShopClassFilter(){
  const sel=document.getElementById('esp-class-filter'); if(!sel) return;
  const current=sel.value;
  const classes=[...new Set((Array.isArray(STUDENTS)?STUDENTS:[]).map(examShopStudentClass).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar',{numeric:true}));
  sel.innerHTML='<option value="">📚 كل الصفوف</option>'+classes.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if(classes.includes(current)) sel.value=current;
}
function renderExamShopStudents(){
  const box=document.getElementById('exam-shop-students'); if(!box) return;
  populateExamShopClassFilter();
  const q=String(document.getElementById('esp-search')?.value||'').trim().toLowerCase();
  const classFilter=String(document.getElementById('esp-class-filter')?.value||'').trim();
  const p=EXAM_SHOP_POLICY||{}; const ov=p.students||{};
  const arr=(Array.isArray(STUDENTS)?STUDENTS:[]).filter(st=>{
    const cls=examShopStudentClass(st);
    const matchesClass=!classFilter||cls===classFilter;
    const name=String(st.name||'').trim().toLowerCase();
    return matchesClass && (!q||name.includes(q));
  }).sort((a,b)=>{
    const ca=examShopStudentClass(a), cb=examShopStudentClass(b);
    const cc=ca.localeCompare(cb,'ar',{numeric:true}); if(cc) return cc;
    return String(a.name||'').localeCompare(String(b.name||''),'ar');
  });
  document.getElementById('esp-student-count').textContent=arr.length;
  document.getElementById('esp-overrides').textContent=Object.keys(ov).length;
  document.getElementById('esp-max-summary').textContent=String(p.maxPerStudent??3);
  if(!arr.length){box.innerHTML='<div class="exam-shop-status">لا يوجد طلاب مطابقون للفرز أو البحث.</div>';return;}
  box.innerHTML=arr.map(st=>{const sid=String(st.id||'');const has=Object.prototype.hasOwnProperty.call(ov,sid);const val=has?ov[sid]:'';const cls=examShopStudentClass(st);return `<div class="exam-shop-student"><div><b>${esc(st.name||'طالب')}</b><small>${esc(cls||'غير محدد')} · ${has?'حد خاص للفصل':'يستخدم الحد العام للفصل'}${(typeof st.points==='number')?` · رصيده ${st.points} نقطة`:''}</small></div><input class="inp" data-esp-sid="${esc(sid)}" type="number" min="0" max="20" step="0.5" value="${has?esc(String(val)):''}" placeholder="افتراضي" title="الحد الخاص لهذا الطالب من 0 إلى 20 درجة"><span class="exam-shop-used muted">${has?`مسموح ${val}`:`مسموح ${p.maxPerStudent??3}`}</span></div>`;}).join('');
}
async function loadExamShopPolicy(silent){
  const api=getApi(),tok=getTok(); if(!api||!tok){if(!silent)toast('اضبط عنوان الخادم وكلمة السر أولًا','bad');return;}
  const sem=espSemester();
  try{const r=await fetch(`${api}/exam-shop-policy?t=${encodeURIComponent(tok)}&semester=${sem}&_=${Date.now()}`,{cache:'no-store'});const j=await r.json();if(!r.ok||!j.ok)throw 0;EXAM_SHOP_POLICY=j.policy||EXAM_SHOP_POLICY;ESP_LOADED=true;ESP_ERR=false;
    if(document.getElementById('esp-enabled')) document.getElementById('esp-enabled').value=EXAM_SHOP_POLICY.enabled===false?'0':'1';
    if(document.getElementById('esp-max')) document.getElementById('esp-max').value=EXAM_SHOP_POLICY.maxPerStudent??3;
    if(document.getElementById('esp-start')) document.getElementById('esp-start').value=espDateValue(EXAM_SHOP_POLICY.startAt);
    if(document.getElementById('esp-end')) document.getElementById('esp-end').value=espDateValue(EXAM_SHOP_POLICY.endAt);
    renderExamShopStatus();renderExamShopStudents();
  }catch(e){ESP_ERR=true;const sb=document.getElementById('exam-shop-status');if(sb){sb.className='exam-shop-status closed';sb.textContent='تعذّر تحميل إعدادات المتجر من الخادم — المعروض قيم افتراضية غير محفوظة. أعد التحميل قبل الحفظ.';}if(!silent)toast('تعذّر تحميل تحكم درجات المتجر','bad');}
}

/* ═══════════════ الاتصال بالخادم ═══════════════ */
/* 🔄 مزامنة الأرصدة وطلبات رسائل الشكر */
// 💌 الطلبات محفوظة محلياً — تظهر فوراً بلا انتظار الخادم
let REQS = load(K.reqs, []);
let STORE_PURCHASES = load('hwapp_store_purchases_v1', []);
let STORE_PURCHASES_SEEN = new Set((load(K.purchasesSeen, []) || []).map(String));
// silent=true → تحديث تلقائي بلا إشعارات
async function syncStore(silent){
  const api = getApi(), tok = getTok();
  if(!api || !tok){ if(!silent) toast('اضبط عنوان الخادم وكلمة السر في تبويب البيانات', 'bad'); return; }
  if(!silent) toast('جارٍ التحديث…');
  try{
    const r = await fetch(`${api}/store?t=${encodeURIComponent(tok)}`);
    if(r.status === 401){ if(!silent) toast('كلمة السر غير صحيحة','bad'); return; }
    const j = await r.json();
    if(!j.ok) throw 0;
    // 🆔 الأرصدة مخزّنة بمعرف الطالب. المطابقة بالاسم وحدها كانت تفشل دائمًا
    // فيبقى رصيد كل طالب صفرًا في اللوحة. نطابق بالمعرف أولًا ثم بالاسم.
    let synced = 0;
    const byId = new Map(STUDENTS.map(s=>[String(s.id||''),s]));
    const byNm = new Map(STUDENTS.map(s=>[String(s.name||'').trim(),s]));
    if(Array.isArray(j.rows) && j.rows.length){
      j.rows.forEach(r=>{
        const st = (r.sid && byId.get(String(r.sid))) || byNm.get(String(r.name||'').trim());
        if(st){ st.points = r.pts||0; synced++; }
      });
    }else{
      Object.entries(j.balances||{}).forEach(([nm,pts])=>{
        const st = byId.get(String(nm)) || byNm.get(String(nm).trim());
        if(st){ st.points = pts; synced++; }
      });
    }
    // الأرصدة من الخادم نفسه: تُحفظ على الجهاز فقط ولا تُعاد رفعًا (كانت تُرفع اللقطة كاملة كل 5 ثوانٍ)
    _suppressSyncSave=true; try{ save(K.st, STUDENTS); }finally{ _suppressSyncSave=false; }
    // سجل المشتريات الكامل يأتي من الخادم. هذا مستقل عن طلبات رسائل الشكر حتى لا تختفي العملية من سجل المعلم بعد معالجة الطلب.
    STORE_PURCHASES = Array.isArray(j.purchases) ? j.purchases.slice().sort((a,b)=>(b.at||0)-(a.at||0)) : [];
    ctCertTplPush();
    try{ localStorage.setItem('hwapp_store_purchases_v1', JSON.stringify(STORE_PURCHASES.slice(0,500))); }catch(_){}
    renderStorePurchases();
    // 💌 سجل رسائل الشكر من الخادم، مع دمج سجل هذا الجهاز القديم مرة واحدة
    if(Array.isArray(j.thanks)){
      THX_SERVER = j.thanks.slice();
      try{
        const local = load(K.thanks, []);
        if(local.length && !localStorage.getItem('hwapp_thanks_imported_v1')){
          const ri = await fetch(`${api}/thanks-log-import`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ t: tok, items: local }) });
          const ji = await ri.json();
          if(ji && ji.ok){ localStorage.setItem('hwapp_thanks_imported_v1', '1');
            const seenL = new Set(THX_SERVER.map(x=>`${x.name}|${x.status}|${Math.round((x.at||0)/60000)}`));
            local.forEach(x=>{ const k=`${x.name}|${x.status}|${Math.round((x.at||0)/60000)}`; if(!seenL.has(k)){ seenL.add(k); THX_SERVER.push(x); } }); }
        }
      }catch(_){}
    }
    // اعرض فقط البطاقات التي تحتاج تدخّلك — الآلية تُنفَّذ وحدها
    const NEED = {}; CARDS.forEach(c=>{ if(c.teacher) NEED[c.id]=1; });
    // ادمج: أبقِ المحفوظ محلياً وأضف الجديد — لا تستبدل
    const incoming = (j.requests || []).filter(q=>NEED[q.card]);
    const seen = {};
    REQS.forEach(q=>{ seen[q.key] = q; });
    // نسخة الخادم هي المرجع (فيها «أُرسلت لمساحة الطالب» من أي جهاز)
    incoming.forEach(q=>{ if(!seen[q.key]) { seen[q.key] = q; REQS.push(q); } else Object.assign(seen[q.key], q); });
    // احذف ما نُفّذ على الخادم (لم يعد في الوارد) إن كانت الاستجابة كاملة
    if(j.ok){
      const live = {};
      incoming.forEach(q=>live[q.key] = 1);
      REQS = REQS.filter(q=>live[q.key]);
    }
    save(K.reqs, REQS);
    renderReqs(); renderStudents(); renderStudentsCenter(); renderDashboard(); updateReqBadge(); updateMeta();
    if(!silent) toast(`حُدّث ${synced} رصيد · ${STORE_PURCHASES.length} عملية شراء`, 'good');
  }catch(e){ if(!silent) toast('تعذّر الاتصال بالخادم','bad'); }
}

function initialsStore(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0,2).map(x=>x[0]||'').join('').slice(0,2)||'ط';
}
function storeCardLabel(q){
  const map={exam05:'+0.5 درجة',exam1:'+1 درجة',exam2:'+2 درجتين',exam3:'+3 درجات',dbl:'نقاط مضاعفة',thanks:'رسالة شكر للأهل',retry:'إعادة محاولة',early:'مراجعة مبكرة',hint:'تلميح',title:'لقب'};
  const nm=map[q?.card] || (CARDS.find(c=>c.id===q?.card)||{}).name || String(q?.card||'بطاقة');
  return (q?.card==='madforgive'||q?.card==='hwforgive')&&q.hwTitle ? `${nm} — «${q.hwTitle}»` : nm;
}
/* 🛒 عمليات الشراء في «يحتاج انتباهك»: تظهر الجديدة فقط.
   بعد «تمت المراجعة» تختفي اللوحة كلها، ويبقى السجل الكامل في «تحكم درجات المتجر».
   علامة المراجعة = ختم آخر عملية رُوجعت، محفوظ مع التنبيهات المُزالة فيتزامن بين أجهزتك. */
const SHOP_REVIEW_PREFIX='shop-reviewed|';
function storeReviewedAt(){
  let at=0;
  try{
    Object.keys(DISMISSED_ALERTS||{}).forEach(k=>{
      if(k.startsWith(SHOP_REVIEW_PREFIX)) at=Math.max(at, Number(k.slice(SHOP_REVIEW_PREFIX.length))||0);
    });
  }catch(_){ /* قبل تهيئة حالة التنبيهات عند تحميل الصفحة */ }
  return at;
}
function isStorePurchaseNew(q){
  if(!q) return false;
  if(q.key && STORE_PURCHASES_SEEN.has(String(q.key))) return false;   // علامات الإصدار السابق (هذا الجهاز)
  return (Number(q.at)||0) > storeReviewedAt();
}
function storePurchaseRowHTML(q, showNew){
  const name=String(q.name||'الطالب');
  const isExam=q.kind==='exam-bonus';
  const detail=isExam ? `رفع درجة الاختبار · الفصل ${q.semester||1} · الفترة ${q.period||1}` : storeCardLabel(q);
  const fresh=showNew && isStorePurchaseNew(q);
  return `<div class="store-purchase-row${fresh?' is-new':''}">
    <span class="store-purchase-avatar">${esc(initialsStore(name))}</span>
    <div class="store-purchase-main"><b>${esc(name)} ${fresh?'<span class="store-purchase-new">جديد</span>':''}</b><small>${esc(detail)}${isExam?` · ${(Number(q.price)||0).toLocaleString('ar-SA')} نقطة`:''} · ${fmtDate(q.at)} ${fmtTime(q.at)}</small></div>
    <span class="store-purchase-badge ${isExam?'store-purchase-exam':''}">${isExam?'+'+gRoundStore(q.add)+' درجة':(Number(q.price)||0).toLocaleString('ar-SA')+' نقطة'}</span>
  </div>`;
}
function renderStorePurchases(){
  const box=document.getElementById('store-purchases-panel');
  const list=Array.isArray(STORE_PURCHASES)?STORE_PURCHASES:[];
  const fresh=list.filter(isStorePurchaseNew);
  const logBtn=document.getElementById('store-log-count');
  if(logBtn) logBtn.textContent=fresh.length?` (${fresh.length} جديدة)`:'';
  updateAttentionCount();
  if(!box) return;
  if(!fresh.length){ box.innerHTML=''; box.style.display='none'; return; }
  box.style.display='';
  const rows=fresh.slice(0,6);
  box.innerHTML=`
    <div class="store-purchases-head">
      <div class="store-purchases-title"><span style="font-size:1.15rem">🛒</span><h3>عمليات شراء جديدة</h3><span class="store-purchase-new">${fresh.length}</span></div>
      <div class="store-purchases-meta">
        <button class="btn ghost sm" type="button" onclick="openAllStorePurchases()">السجل الكامل</button>
        <button class="btn tick sm" type="button" onclick="markStorePurchasesSeen()">✓ تمت المراجعة</button>
      </div>
    </div>
    <div class="store-purchase-list">${rows.map(q=>storePurchaseRowHTML(q,false)).join('')}</div>
    ${fresh.length>rows.length?`<div class="store-purchase-more">و${fresh.length-rows.length} عمليات أخرى — افتح السجل الكامل</div>`:''}`;
}
/* عدّاد «يحتاج انتباهك» = التنبيهات + عمليات الشراء غير المراجعة + طلبات الشكر المعلّقة (م11) */
function updateAttentionCount(){
  const alertsLen=Number(window.__dashAlertsLen)||0;
  const shopNew=(Array.isArray(STORE_PURCHASES)?STORE_PURCHASES:[]).filter(isStorePurchaseNew).length;
  const reqsLen=(Array.isArray(REQS)?REQS:[]).length;
  const total=alertsLen+shopNew+reqsLen;
  const badge=document.getElementById('dash-alert-badge');
  if(badge) badge.textContent=total;
  const reqBadge=document.getElementById('attention-req-count');
  if(reqBadge){ reqBadge.textContent=reqsLen; reqBadge.style.display=reqsLen?'':'none'; }
  const summary=document.getElementById('dash-alert-count');
  if(summary) summary.textContent=!total ? 'كل شيء جيد'
    : [alertsLen?`${alertsLen} حالة تحتاج إجراء`:'', shopNew?`${shopNew} عملية شراء للمراجعة`:'', reqsLen?`${reqsLen} طلب شكر للمراجعة`:''].filter(Boolean).join(' · ');
}
function gRoundStore(v){ const n=Number(v)||0; return Number.isInteger(n)?String(n):String(Math.round(n*10)/10); }
function updateReqBadge(){
  // طلبات رسائل الشكر تظهر حصريًا داخل «📌 يحتاج انتباهك».
}


/* 📨 رسالة الشكر إلى مساحة الطالب (بوابته) — نوع «thanks» تعرضه البوابة بطاقة احتفالية.
   لا يُخفي الطلب ولا النافذة: تبقى كل الخيارات (نسخ للواتساب…)، ويختفي الطلب فقط عند «✓ أرسلتها».
   الإرسال يُحفظ بمفتاح الطلب (تبقى علامته بعد التحديث)، وإعادة الإرسال تطلب تأكيدًا. */
const TP_SENT_KEY = 'thanks_portal_sent_v1';
function thanksPortalMap(){ try{ return JSON.parse(localStorage.getItem(TP_SENT_KEY) || '{}') || {}; }catch(e){ return {}; } }
function thanksPortalAt(key){ if(!key) return 0; const q=(REQS||[]).find(x=>x.key===key); return (q&&q.portalAt) || thanksPortalMap()[key] || 0; }
function thanksPortalLabel(key, long){ const at = thanksPortalAt(key); if(!at) return long ? '📨 أرسلها لمساحة الطالب' : '📨 لمساحة الطالب';
  let tm = ''; try{ tm = new Date(at).toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' }); }catch(e){} return `✓ وصلت لمساحته ${tm}`; }

function renderReqs(){
  const box=document.getElementById('attention-requests');
  if(!box) return;
  if(!REQS.length){ box.innerHTML=''; return; }

  // الاسم الأول فقط (مع تجاهل «بن» و«عبد»)
  const firstName = full => {
    const parts = String(full||'').trim().split(/\s+/).filter(Boolean);
    if(!parts.length) return 'ابنكم';
    let nm = parts[0];
    if(/^عبد$/.test(nm) && parts[1]) nm += ' ' + parts[1];
    return nm;
  };

  /* 📊 يقرأ سجل الطالب ويبني رسالة تعكس أداءه الحقيقي */
  const thanksProfile = name => {
    const st = STUDENTS.find(x=>x.name===name) || STUDENTS.find(x=>normAr(x.name)===normAr(name));
    if(!st) return null;
    const hws = gradedHW().filter(h => hwFor(h, st.cls)).slice().sort((a,b)=>(a.at||0)-(b.at||0));
    const done = [];
    hws.forEach(h=>{
      const v = (h.subs||{})[st.id];
      if(!v) return;
      const hMax = h.max || 20;
      done.push({ h, hMax,
        grade: Math.round(hMax * (v.correct||0) / Math.max(1, v.total||1)),
        pct: Math.round((v.correct||0) / Math.max(1, v.total||1) * 100),
        late: !!(h.due && v.at && new Date(v.at).toISOString().slice(0,10) > h.due) });
    });
    if(!done.length) return null;

    const last = done[done.length-1];
    const avg  = Math.round(done.reduce((n,x)=>n+x.pct,0) / done.length);
    const rate = hws.length ? done.length / hws.length : 0;
    const onTime = done.every(x=>!x.late);

    // الاتجاه: قارن النصف الأول بالثاني
    let trend = 0;
    if(done.length >= 3){
      const h = Math.ceil(done.length/2);
      const a = done.slice(0,h).reduce((n,x)=>n+x.pct,0)/h;
      const b = done.slice(h).reduce((n,x)=>n+x.pct,0)/(done.length-h);
      trend = Math.round(b - a);
    }
    return { last, avg, trend, done: done.length, of: hws.length, rate, onTime,
             perfect: done.filter(x=>x.pct===100).length };
  };

  // صيغة العدد العربية: نشاط / نشاطين / 3 أنشطة
  const nActs = k => k===1 ? 'نشاط' : k===2 ? 'نشاطين' : `${k} أنشطة`;
  // «ابنكم» أو «ابنتكم» حسب الاسم
  const child = full => /(^|\s)(بنت|بنه)(\s|$)/.test(String(full||'')) ? 'ابنتكم' : 'ابنكم';
  const heShe = full => /(^|\s)(بنت|بنه)(\s|$)/.test(String(full||''));
  // لا تقل «نشاط نشاط الأسبوع» إن كان العنوان يبدأ بها أصلاً
  const actTitleOf = h => {
    const t = String((h && h.title) || '').trim();
    if(!t) return 'النشاط';
    return /^نشاط/.test(t) ? t : 'نشاط ' + t;
  };

  /* 💌 الرسالة تُبنى من حالته — لا قالب واحد للجميع */
  const makeThanksMessage = name => {
    const f = firstName(name);
    const C = child(name);           // ابنكم / ابنتكم
    const F = heShe(name);           // مؤنّث؟
    const subject = String(rcGet('subject') || 'العلوم').trim() || 'العلوم';
    const subjectPhrase = `في مادة ${subject}`;
    const p = thanksProfile(name);
    if(!p) return `أشكر ${C} ${f} على ${F?'تميّزها واجتهادها':'تميّزه واجتهاده'} ${subjectPhrase} في أداء النشاط 🌟\nكلمة تشجيع منكم تصنع فرقًا كبيرًا 👏`;

    const lines = [];

    // ① الحالة الأبرز أولاً، مع إدخال المادة طبيعيًا داخل سياق الرسالة
    if(p.trend >= 15)
      lines.push(`أشكر ${C} ${f} على تحسّن ${F?'مستواها':'مستواه'} الواضح ${subjectPhrase} — ارتفع ${F?'أداؤها':'أداؤه'} إلى ${p.last.pct}% في آخر نشاط 📈`);
    else if(p.perfect >= 2)
      lines.push(`أشكر ${C} ${f} على ${F?'تحقيقها':'تحقيقه'} الدرجة الكاملة في ${nActs(p.perfect)} ${subjectPhrase} 🌟`);
    else if(p.avg >= 90)
      lines.push(`أشكر ${C} ${f} على ${F?'تميّزها':'تميّزه'} ${subjectPhrase} — متوسط ${F?'أدائها':'أدائه'} ${p.avg}% 🌟`);
    else if(p.rate === 1 && p.of > 1)
      lines.push(`أشكر ${C} ${f} على ${F?'التزامها':'التزامه'} في ${subjectPhrase} — ${F?'سلّمت':'سلّم'} جميع الأنشطة (${p.done} من ${p.of}) ✅`);
    else if(p.avg >= 75)
      lines.push(`أشكر ${C} ${f} على ${F?'أدائها':'أدائه'} الجيد ${subjectPhrase} في ${actTitleOf(p.last.h)} — ${p.last.grade} من ${p.last.hMax} 👏`);
    else if(p.trend > 0)
      lines.push(`أشكر ${C} ${f} على ${F?'تقدّمها':'تقدّمه'} خطوة بخطوة ${subjectPhrase}، وآخر نشاط أفضل من سابقه 📈`);
    else
      lines.push(`أشكر ${C} ${f} على ${F?'اجتهادها':'اجتهاده'} ${subjectPhrase} في ${actTitleOf(p.last.h)} 🌟`);

    // ② لمسة ثانية إن استحقّها
    if(p.onTime && p.done >= 2 && p.avg < 90)
      lines.push(F ? `وتلتزم بمواعيد التسليم ⏱️` : `ويلتزم بمواعيد التسليم ⏱️`);
    else if(p.perfect === 1 && p.avg < 90)
      lines.push(F ? `وحصلت على الدرجة الكاملة في أحدها 💯` : `وحصل على الدرجة الكاملة في أحدها 💯`);

    lines.push(`كلمة تشجيع منكم تصنع فرقًا كبيرًا 👏`);
    return lines.join('\n');
  };

  box.innerHTML=`
    <div class="attention-requests">
      <div class="attention-requests-head">
        <b>💌 طلبات رسائل شكر</b>
        <span class="pill due">${REQS.length}</span>
      </div>
      <div class="attention-requests-list">
        ${REQS.map(q=>{
          const name=String(q.name || 'الطالب').trim();
          // 🎓 فصل الطالب — يسهّل تحديده بين مئات الطلاب
          const st = STUDENTS.find(x=>x.name===name)
                  || STUDENTS.find(x=>normAr(x.name)===normAr(name));
          const cls = st && st.cls ? st.cls : '';
          const message=makeThanksMessage(name);
          return `<div class="attention-request">
            <div class="attention-request-person">
              <span class="attention-request-avatar">${esc(initials(name))}</span>
              <div>
                <b>${esc(name)}</b>
                <small>${cls ? `<span class="pill quiet" style="font-size:.72rem;margin-inline-end:.3rem">🎓 ${esc(cls)}</span>` : ''}${(()=>{ const pa=thanksPortalAt(q.key); let ago=''; try{ if(q.at){ const dd=Math.floor((Date.now()-q.at)/864e5); ago=dd<=0?'اليوم':dd===1?'أمس':`منذ ${dd} أيام`; } }catch(e){}
                  return `اشترى رسالة شكر لولي أمره${ago?' · '+ago:''}${pa?` · <span style="color:#13734f;font-weight:700">${esc(thanksPortalLabel(q.key))}</span>`:''}`; })()}</small>
              </div>
            </div>
            <div class="attention-request-actions">${(()=>{ const pa=thanksPortalAt(q.key), d=`data-message="${esc(message)}" data-sid="${esc(st ? st.id : '')}" data-name="${esc(name)}" data-key="${esc(q.key)}"`;
              return pa
                ? `<button class="btn tick sm" onclick="doResolveReq('${esc(q.key)}','sent')" title="الرسالة وصلت لمساحة الطالب — أنهِ الطلب وسجّله في ملفه">✓ إنهاء الطلب</button><button class="btn ghost sm" onclick="previewThanksMessage(this)" ${d}>💌 الرسالة</button>`
                : `<button class="btn primary sm" onclick="previewThanksMessage(this)" ${d}>💌 أرسل الرسالة</button><button class="btn ghost sm" onclick="resolveReq('${esc(q.key)}','skipped')" title="أزله وسجّل أنه لم يُرسل">تخطٍّ</button>`; })()}
            </div>
          </div>`;
        }).join('')}
      </div>
      <div id="thanks-message-preview" class="thanks-message-preview hide" aria-hidden="true"></div>
    </div>`;
}


/* 💌 سجل رسائل الشكر — يبقى في ملف الطالب فلا يضيع حقه */
/* السجل يأتي من الخادم (/store) فيظهر من الجوال والكمبيوتر معًا؛ المحلي احتياط قبل أول مزامنة */
let THX_SERVER = null;
function thanksLog(){ return Array.isArray(THX_SERVER) ? THX_SERVER : load(K.thanks, []); }
function thanksFor(name){
  const nn = normAr(name);
  return thanksLog().filter(x => normAr(x.name) === nn).sort((a,b)=>b.at-a.at);
}

/* 📊 مؤشر أداء الطالب */
function perf(s){
  const hws = gradedHW().filter(h => hwFor(h, s.cls));
  if(!hws.length) return { key:'none', label:'—', color:'#5A6B84', bg:'#EFF3F8', done:0, of:0, pct:0 };
  let done=0, got=0, max=0;
  hws.forEach(h=>{ const v=(h.subs||{})[s.id]; max += h.pts||0; if(v){ done++; got += v.pts||0; } });
  const rate = done / hws.length, pct = max ? Math.round(got/max*100) : 0;
  if(done === 0)                  return { key:'stop', label:'متوقّف', color:'#B4232F', bg:'rgba(180,35,47,.12)', done, of:hws.length, pct };
  if(rate >= .8 && pct >= 80)     return { key:'top',  label:'متميّز', color:'#1B9C6B', bg:'rgba(27,156,107,.14)', done, of:hws.length, pct };
  if(rate >= .8)                  return { key:'ok',   label:'منتظم',  color:'#2E6BB8', bg:'rgba(46,107,184,.13)', done, of:hws.length, pct };
  return                                 { key:'low',  label:'متعثّر', color:'#C88A2E', bg:'rgba(200,138,46,.15)', done, of:hws.length, pct };
}
const PERF_ORDER = { stop:0, low:1, ok:2, top:3, none:4 };

/* ☁️ مزامنة الدفتر مع الخادم
   قاعدة مهمة: السحب لا يطلق رفعًا جديدًا، والرفع لا يعمل مرتين بالتوازي.
   هذا يمنع 409 الوهمي الناتج عن إرسال نفس اللقطة مرتين أو عن حلقة
   pull → localStorage → push → 409. */
let _pushT = null, _pulling = false;
let _pushInFlight = null;
let _syncGeneration = 0;

// مفاتيح التنبيهات التي غيّرها المستخدم محليًا ولم نؤكد رفعها للخادم بعد.
let _dismissedAlertPending = {};
let _localMutationInFlight = false;

function beginLocalMutation(){
  _localMutationInFlight = true;
}

function endLocalMutation(){
  _localMutationInFlight = false;
}

const SYNC_BASE_KEY = 'hwapp_sync_base_state_v1';
let STATE_BASE_SAVED_AT = 0;
let SYNC_BASE_STATE = null;

function syncStatePayload(){
  return {
    students: STUDENTS,
    // لا ترفع سجلات مولّد الاختبار المؤقتة إلى الخادم.
    assignments: (Array.isArray(HW) ? HW : []).filter(h => h && !h.__examProxy),
    perks: PERKS,
    repcfg: REPCFG,
    dismissed: DISMISSED_ALERTS
  };
}

function syncClone(value){
  try { return JSON.parse(JSON.stringify(value)); }
  catch { return value; }
}

function syncLoadBase(){
  try{
    const raw = localStorage.getItem(SYNC_BASE_KEY);
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    if(!parsed || typeof parsed !== 'object') return null;
    STATE_BASE_SAVED_AT = Number(parsed.savedAt) || 0;
    SYNC_BASE_STATE = parsed.data ? syncClone(parsed.data) : null;
    return SYNC_BASE_STATE;
  }catch{
    return null;
  }
}

function syncSaveBase(data, savedAt){
  STATE_BASE_SAVED_AT = Number(savedAt) || 0;
  SYNC_BASE_STATE = syncClone(data);
  try{
    localStorage.setItem(SYNC_BASE_KEY, JSON.stringify({
      savedAt: STATE_BASE_SAVED_AT,
      data: SYNC_BASE_STATE
    }));
  }catch{}
}

syncLoadBase();

function syncStableJson(value){
  if(Array.isArray(value)) return '[' + value.map(syncStableJson).join(',') + ']';
  if(value && typeof value === 'object'){
    return '{' + Object.keys(value).sort().map(k =>
      JSON.stringify(k) + ':' + syncStableJson(value[k])
    ).join(',') + '}';
  }
  return JSON.stringify(value);
}

function syncDataEqual(a, b){
  return syncStableJson(a || {}) === syncStableJson(b || {});
}

function mergeByIdThreeWay(base, remote, local){
  const baseList = Array.isArray(base) ? base : [];
  const remoteList = Array.isArray(remote) ? remote : [];
  const localList = Array.isArray(local) ? local : [];

  const idOf = item => String(item && item.id || '');
  const mapOf = list => new Map(list.filter(x => idOf(x)).map(x => [idOf(x), x]));

  const bm = mapOf(baseList);
  const rm = mapOf(remoteList);
  const lm = mapOf(localList);
  const ids = new Set([...bm.keys(), ...rm.keys(), ...lm.keys()]);
  const result = [];

  for(const id of ids){
    const b = bm.get(id);
    const r = rm.get(id);
    const l = lm.get(id);

    if(!b){
      if(r && l) result.push(syncDataEqual(r, l) ? r : {...r, ...l});
      else if(r) result.push(r);
      else if(l) result.push(l);
      continue;
    }

    if(!r && !l) continue;
    if(!r){
      if(syncDataEqual(l, b)) continue;
      result.push(l);
      continue;
    }
    if(!l){
      if(syncDataEqual(r, b)) result.push(r);
      continue;
    }

    if(syncDataEqual(l, b)){
      result.push(r);
    }else if(syncDataEqual(r, b)){
      result.push(l);
    }else if(syncDataEqual(r, l)){
      result.push(l);
    }else{
      // نفس السجل تغير على الجهازين: نمزج الحقول بدل استبدال سجل كامل.
      const merged = {...r};
      const keys = new Set([...Object.keys(r), ...Object.keys(l), ...Object.keys(b)]);
      for(const key of keys){
        const bv = b[key];
        const rv = r[key];
        const lv = l[key];
        if(syncDataEqual(lv, bv)) merged[key] = rv;
        else if(syncDataEqual(rv, bv)) merged[key] = lv;
        else if(!syncDataEqual(rv, lv)) merged[key] = lv;
      }
      result.push(merged);
    }
  }

  const order = [...remoteList.map(idOf), ...localList.map(idOf)];
  result.sort((a, b) => order.indexOf(idOf(a)) - order.indexOf(idOf(b)));
  return result;
}

async function pushStateNow(_retry){
  const api=getApi(), tok=getTok();
  if(!api || !tok) return false;

  if(!_retry){
    clearTimeout(_pushT);
    _syncGeneration++;
  }

  if(_pushInFlight && !_retry) return _pushInFlight;

  const run=async()=>{
    /*
     * إذا لم توجد نسخة أساس، احصل عليها قبل أول POST.
     * بدون ذلك كان أول حفظ بعد فتح الصفحة قد يُرفض بـ409 بسبب baseSavedAt=0.
     */
    if(!STATE_BASE_SAVED_AT || !SYNC_BASE_STATE){
      const sr=await fetch(`${api}/state?t=${encodeURIComponent(tok)}&_=${Date.now()}`,{
        cache:'no-store'
      });
      if(sr.status===401) throw new Error('unauthorized');
      if(!sr.ok) throw new Error(`state snapshot failed: ${sr.status}`);
      const sj=await sr.json();
      if(!sj?.ok || !sj?.data) throw new Error('state snapshot invalid');

      const remoteBase={
        students:Array.isArray(sj.data.students)?sj.data.students:[],
        assignments:Array.isArray(sj.data.assignments)?sj.data.assignments:[],
        perks:sj.data.perks&&typeof sj.data.perks==='object'?sj.data.perks:{},
        repcfg:sj.data.repcfg&&typeof sj.data.repcfg==='object'?sj.data.repcfg:{},
        dismissed:sj.data.dismissed&&typeof sj.data.dismissed==='object'?sj.data.dismissed:{}
      };
      syncSaveBase(remoteBase,Number(sj.data.savedAt)||0);
    }

    const response=await fetch(api+'/state',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        t:tok,
        baseSavedAt:STATE_BASE_SAVED_AT||0,
        data:syncStatePayload()
      })
    });

    if(response.status===409){
      if(_retry) throw new Error('state conflict');

      const localSnapshot=syncStatePayload();
      const baseSavedAt=STATE_BASE_SAVED_AT;

      let server=null;
      try{
        const sr=await fetch(`${api}/state?t=${encodeURIComponent(tok)}&_=${Date.now()}`,{
          cache:'no-store'
        });
        if(sr.ok){
          const sj=await sr.json();
          if(sj?.ok && sj.data) server=sj.data;
        }
      }catch(e){
        console.warn('state conflict snapshot:',e);
      }

      if(!server) throw new Error('state conflict');

      if(syncDataEqual(server,localSnapshot)){
        syncSaveBase(localSnapshot,Number(server.savedAt)||baseSavedAt||0);
        return true;
      }

      const base=SYNC_BASE_STATE;
      if(!base || !baseSavedAt) throw new Error('state conflict: missing sync base');

      const mergedStudents=mergeByIdThreeWay(
        Array.isArray(base.students)?base.students:[],
        Array.isArray(server.students)?server.students:[],
        Array.isArray(localSnapshot.students)?localSnapshot.students:[]
      );
      const mergedAssignments=mergeByIdThreeWay(
        Array.isArray(base.assignments)?base.assignments.filter(h=>h&&!h.__examProxy):[],
        Array.isArray(server.assignments)?server.assignments.filter(h=>h&&!h.__examProxy):[],
        Array.isArray(localSnapshot.assignments)?localSnapshot.assignments.filter(h=>h&&!h.__examProxy):[]
      );

      STUDENTS=mergedStudents;
      HW=mergedAssignments;

      const mergeObjectThreeWay=(baseObject,remoteObject,localObject)=>{
        const b=baseObject&&typeof baseObject==='object'?baseObject:{};
        const r=remoteObject&&typeof remoteObject==='object'?remoteObject:{};
        const l=localObject&&typeof localObject==='object'?localObject:{};
        const keys=new Set([...Object.keys(b),...Object.keys(r),...Object.keys(l)]);
        const out={};

        for(const key of keys){
          const bv=b[key],rv=r[key],lv=l[key];
          if(syncDataEqual(lv,bv)){
            if(rv!==undefined) out[key]=rv;
          }else if(syncDataEqual(rv,bv)){
            if(lv!==undefined) out[key]=lv;
          }else if(syncDataEqual(rv,lv)){
            if(lv!==undefined) out[key]=lv;
          }else if(lv!==undefined){
            out[key]=lv;
          }
        }
        return out;
      };

      PERKS=mergeObjectThreeWay(base.perks,server.perks,localSnapshot.perks);
      REPCFG=mergeObjectThreeWay(base.repcfg,server.repcfg,localSnapshot.repcfg);
      DISMISSED_ALERTS=mergeObjectThreeWay(
        base.dismissed,server.dismissed,localSnapshot.dismissed
      );

      _suppressSyncSave=true;
      try{
        save(K.st,STUDENTS);
        save(K.hw,HW);
        save(K.perks,PERKS);
        uiSave(K_ALERTS_UI.dismissed,DISMISSED_ALERTS);
      }finally{
        _suppressSyncSave=false;
      }

      renderAll();

      // مهم: الأساس هنا هو server وليس merged local؛ لأن POST التالي يقارن بالخادم الذي قرأناه.
      syncSaveBase(server,Number(server.savedAt)||baseSavedAt||0);

      return await pushStateNow(true);
    }

    if(!response.ok){
      throw new Error(`state push failed: ${response.status}`);
    }

    const result=await response.json();
    if(!result.ok && !result.skipped) throw new Error('state push rejected');

    if(result.savedAt){
      syncSaveBase(syncStatePayload(),Number(result.savedAt));
    }
    // ختم التغيير الذي أحدثه هذا الحفظ نفسه: فحص /rev التالي لا يعيد تنزيل اللقطة بسببه (خادم قديم بلا stateAt ⇒ كالسابق)
    if(result.stateAt) window.__OWN_STATE_AT=Number(result.stateAt);
    return true;
  };

  _pushInFlight=run().finally(()=>{ _pushInFlight=null; });
  return _pushInFlight;
}

function pushState(){
  const api = getApi(), tok = getTok();
  if(!api || !tok || _pulling) return;

  clearTimeout(_pushT);
  const generation = ++_syncGeneration;

  _pushT = setTimeout(async ()=>{
    if(_pulling || generation !== _syncGeneration) return;
    if(!STUDENTS.length && !HW.length && !Object.keys(REPCFG).length) return;

    try{
      const pendingAtSend = Object.keys(_dismissedAlertPending);
      await pushStateNow();
      pendingAtSend.forEach(k=>{ delete _dismissedAlertPending[k]; });
    }catch(e){
      console.warn('pushState:', e);
    }
  }, 300);
}

async function pullState(){
  if(_localMutationInFlight) return false;

  const api=getApi(), tok=getTok();
  if(!api || !tok) return false;

  clearTimeout(_pushT);
  _syncGeneration++;

  try{
    const r=await fetch(`${api}/state?t=${encodeURIComponent(tok)}&_=${Date.now()}`,{
      cache:'no-store'
    });
    if(r.status===401){
      toast('كلمة السر غير صحيحة','bad');
      return false;
    }

    const j=await r.json();
    if(!j.ok || !j.data) return false;
    // 🛡️ نسخة أقدم من آخر حفظ نعرفه (قراءة متأخرة من التخزين): لا تُطبَّق — كانت تُرجع تنبيهات أزلتها وتعديلات قمت بها
    if(STATE_BASE_SAVED_AT && (Number(j.data.savedAt)||0) && Number(j.data.savedAt) < STATE_BASE_SAVED_AT) return false;

    _pulling=true;

    const serverBase={
      students:Array.isArray(j.data.students)?j.data.students:[],
      assignments:Array.isArray(j.data.assignments)?j.data.assignments.filter(h => h && !h.__examProxy):[],
      perks:j.data.perks&&typeof j.data.perks==='object'?j.data.perks:{},
      repcfg:j.data.repcfg&&typeof j.data.repcfg==='object'?j.data.repcfg:{},
      dismissed:j.data.dismissed&&typeof j.data.dismissed==='object'?j.data.dismissed:{}
    };
    const serverAt=Number(j.data.savedAt)||0;

    // احتفظ بالسلف القديم قبل استبداله؛ هذا هو أساس الدمج الحقيقي.
    const previousBase=SYNC_BASE_STATE ? syncClone(SYNC_BASE_STATE) : null;
    const previousSavedAt=STATE_BASE_SAVED_AT;

    let mergedStudents=serverBase.students;
    let mergedAssignments=serverBase.assignments;

    if(previousBase && previousSavedAt){
      mergedStudents=mergeByIdThreeWay(
        Array.isArray(previousBase.students)?previousBase.students:[],
        serverBase.students,
        Array.isArray(STUDENTS)?STUDENTS:[]
      );
      mergedAssignments=mergeByIdThreeWay(
        Array.isArray(previousBase.assignments)?previousBase.assignments.filter(h=>h&&!h.__examProxy):[],
        serverBase.assignments.filter(h=>h&&!h.__examProxy),
        Array.isArray(HW)?HW.filter(h=>h&&!h.__examProxy):[]
      );
    }else{
      // أول مزامنة بلا سلف معروف: لا تمحُ تغييرًا محليًا أحدث من لقطة الخادم.
      const protectLocalNewer=(remote,local)=>{
        const out=[...remote];
        const index=new Map(out.map(x=>[String(x?.id||''),x]));
        for(const item of Array.isArray(local)?local:[]){
          const id=String(item?.id||'');
          if(!id) continue;
          const localAt=Math.max(Number(item.at)||0,Number(item.publishedAt)||0);
          if(localAt>serverAt){
            const pos=out.findIndex(x=>String(x?.id||'')===id);
            if(pos>=0) out[pos]=item;
            else out.push(item);
          }
        }
        return out;
      };
      mergedStudents=protectLocalNewer(serverBase.students,STUDENTS);
      mergedAssignments=protectLocalNewer(serverBase.assignments,HW);
    }

    // 💸 نسخة الخادم أسقطت تسليمًا عالجه هذا الجهاز ⇒ الجلب التالي كامل (مؤشر «ما تغيّر» تجاوزه)
    try{ const byId=new Map((mergedAssignments||[]).map(h=>[String(h&&h.id),h]));
      if((Array.isArray(HW)?HW:[]).some(h=>{ const m=h&&h.subs&&byId.get(String(h.id)); return m&&Object.keys(h.subs).some(k=>!(m.subs&&m.subs[k])); })) resChangedReset(); }catch(e){}
    STUDENTS=mergedStudents;
    HW=mergedAssignments;
    PERKS=serverBase.perks;

    if(Object.keys(serverBase.repcfg).length){
      REPCFG=serverBase.repcfg;
      localStorage.setItem(K_RC,JSON.stringify(REPCFG));
      loadRepCfg();
    }

    if(serverBase.dismissed && typeof serverBase.dismissed==='object'){
      let changed=false;
      Object.entries(serverBase.dismissed).forEach(([k,v])=>{
        if(!DISMISSED_ALERTS[k]){
          DISMISSED_ALERTS[k]=v;
          changed=true;
        }
      });
      Object.keys(DISMISSED_ALERTS).forEach(k=>{
        if(!(k in serverBase.dismissed) && !_dismissedAlertPending[k]){
          delete DISMISSED_ALERTS[k];
          changed=true;
        }
      });
      if(changed) uiSave(K_ALERTS_UI.dismissed,DISMISSED_ALERTS);
    }

    _suppressSyncSave=true;
    try{
      save(K.st,STUDENTS);
      save(K.hw,HW);
      save(K.perks,PERKS);
    }finally{
      _suppressSyncSave=false;
      _pulling=false;
    }

    // بعد الدمج أصبحت النسخة الحالية هي السلف الذي يقاس عليه الحفظ التالي.
    syncSaveBase(serverBase,serverAt);

    renderAll();
    pullExtraAttemptStatus();
    return true;
  }catch(e){
    console.error('pullState:',e);
  }finally{
    _pulling=false;
  }

  return false;
}

/* 🔔 مراقبة التسليمات المباشرة
   مصدر واحد لاكتشاف التسليم، تحديث «آخر التسليمات»، وإطلاق التنبيه.
   مفتاح التسليم ثابت قدر الإمكان حتى لا يتحول اختلاف صيغة الوقت إلى تسليم جديد. */
const LIVE_SUB_KEY = 'hwapp_live_submissions_v7';
let liveKnownSubs = new Set();
let liveReady = false;
let liveChecking = false;

function liveStudentName(row){
  return String(row?.name || '').trim();
}

function liveNormalizeTime(value){
  if(value === null || value === undefined || value === '') return '';

  if(typeof value === 'number'){
    const ms = value < 1e12 ? value * 1000 : value;
    if(Number.isFinite(ms)) return String(Math.floor(ms / 60000));
  }

  const text = String(value).trim();
  if(!text) return '';

  const numeric = Number(text);
  if(Number.isFinite(numeric)){
    const ms = numeric < 1e12 ? numeric * 1000 : numeric;
    return String(Math.floor(ms / 60000));
  }

  const parsed = Date.parse(text);
  if(Number.isFinite(parsed)){
    return String(Math.floor(parsed / 60000));
  }

  return text.replace(/\s+/g, ' ').toLowerCase();
}

function liveSubmissionId(hw, row){
  const explicitId =
    row?.id ??
    row?.submissionId ??
    row?.submission_id ??
    row?.attemptId ??
    row?.attempt_id;

  if(explicitId !== undefined && explicitId !== null && String(explicitId).trim()){
    return `${hw.id}|submission:${String(explicitId).trim()}`;
  }

  const name = liveStudentName(row);
  const time = liveNormalizeTime(row?.at ?? row?.d);
  const correct = Number(row?.correct ?? 0);
  const total = Number(row?.total ?? 0);

  return `${hw.id}|student:${name}|time:${time}|score:${correct}/${total}`;
}

/* ⚡ صف تسليم وصل داخل الإشعار: يُضاف للوحة فورًا بالمنطق نفسه للفحص الدوري (المحاولة الإضافية تُخصم مرة واحدة) */
function liveApplyPushRow(d){
  const row=d&&d.row; if(!row) return false;
  const h=HW.find(x=>x&&(String(x.sid)===String(d.hw)||String(x.id)===String(d.hw))); if(!h) return false;
  const st=(STUDENTS||[]).find(s=>String(s.id)===String(row.sid))||(STUDENTS||[]).find(s=>String(s.name||'').trim()===String(row.name||'').trim()); if(!st) return false;
  const r={...row,name:st.name}, key=liveRowKey(h,r), ex=h.subs&&h.subs[st.id];
  const isNew=!liveKnownSubs.has(key)&&!(ex&&Number(ex.at)>=Number(r.at));
  if(isNew&&h.extraAttempts&&Number(h.extraAttempts[st.id]||0)>0){ h.extraAttempts[st.id]=Math.max(0,Number(h.extraAttempts[st.id])-1); if(h.extraAttempts[st.id]===0) delete h.extraAttempts[st.id]; }
  liveKnownSubs.add(key); liveSaveKnown();
  if(!addLiveRowToLocal(h,r)) return false;
  save(K.hw,HW);
  try{ renderDashboard(); }catch(e){} try{ renderHw(); }catch(e){} try{ renderStudentsCenter(); }catch(e){}
  return true;
}
function liveRowKey(hw, row){
  return liveSubmissionId(hw, row);
}


/* مراجعة الخادم أحدث من المحلية؟ (وقت مراجعة أحدث، أو الوقت نفسه بحالة مختلفة) */
function liveReviewNewer(prev, row){
  const pa=Number(prev&&prev.reviewedAt)||0, ra=Number(row&&row.reviewedAt)||0;
  const ps=String(prev&&prev.reviewStatus||'pending').toLowerCase(), rs=String(row&&row.reviewStatus||'pending').toLowerCase();
  return ra>pa || (ra===pa && rs!==ps);
}
function addLiveRowToLocal(hw, row){
  const name = String(row?.name || '').trim();
  const student = STUDENTS.find(
    s => String(s.name || '').trim() === name
  );

  if(!student) return false;

  hw.subs = hw.subs || {};

  const total = Math.max(1, Number(row?.total) || 1);
  const correct = Math.max(0, Number(row?.correct) || 0);
  const serverAt = Number(row?.at) || 0;

  const next = {
    online:true,
    correct,
    total,
    pts:Math.round((hw.pts || 0) * correct / total),
    d:row?.d || '',
    dev:row?.dev || '',
    secs:Number(row?.secs) || 0, away:row?.away&&typeof row.away==='object'?row.away:null,
    files:Array.isArray(row?.files) ? row.files : [],
    at:serverAt
  };
  // 📁 مراجعة المشروع (قبول/رفض) تأتي مع صف الخادم — بدونها يبقى المرفوض «بانتظار المراجعة»
  if(hw.kind==='files'){
    next.reviewStatus=String(row?.reviewStatus||'pending').toLowerCase();
    next.reviewReason=row?.reviewReason||'';
    next.reviewedAt=Number(row?.reviewedAt)||0;
    next.resubmitUntil=Number(row?.resubmitUntil)||0;
  }

  const previous = hw.subs[student.id];

  if(!previous){
    hw.subs[student.id] = next;
    return true;
  }

  const oldAt = Number(previous.at) || 0;

  // Never replace a real server timestamp with the browser clock.
  if(serverAt > oldAt){
    hw.subs[student.id] = next;
    return true;
  }

  if(serverAt === oldAt && (
    previous.correct !== next.correct ||
    previous.total !== next.total ||
    previous.pts !== next.pts ||
    String(previous.d || '') !== String(next.d || '') ||
    (hw.kind==='files' && liveReviewNewer(previous, next))
  )){
    // لا نرجع مراجعةً أحدث إلى نسخة أقدم (الخادم قد يعيد النسخة السابقة لثوانٍ بعد القبول/الرفض)
    if(hw.kind==='files' && !liveReviewNewer(previous, next)){ ['reviewStatus','reviewReason','reviewedAt','resubmitUntil'].forEach(k=>delete next[k]); }
    hw.subs[student.id] = {
      ...previous,
      ...next,
      at:oldAt
    };
    return true;
  }

  return false;
}

function liveLoadKnown(){
  try{
    const raw = JSON.parse(localStorage.getItem(LIVE_SUB_KEY) || '[]');
    if(Array.isArray(raw)){
      liveKnownSubs = new Set(raw.filter(Boolean).slice(-5000));
    }
  }catch(_){
    liveKnownSubs = new Set();
  }
}

function liveSaveKnown(){
  try{
    localStorage.setItem(
      LIVE_SUB_KEY,
      JSON.stringify([...liveKnownSubs].slice(-5000))
    );
  }catch(_){}
}


// 🔔 يقرأ عدّاد التغيير — قراءة واحدة بدل مئات
let _lastRev = null;
async function serverChanged(){
  const api = getApi(), tok = getTok();
  if(!api || !tok) return true;
  try{
    const r = await fetch(`${api}/rev?t=${encodeURIComponent(tok)}`, {cache:'no-store'});
    if(!r.ok) return true;                 // مسار غير موجود ⇒ تصرّف كالسابق
    const j = await r.json();
    if(!j.ok) return true;
    if(_lastRev === null){ _lastRev = j.rev; return true; }   // أول مرة: اسحب
    if(j.rev === _lastRev) return false;                      // لا جديد
    _lastRev = j.rev;
    return true;
  }catch(e){ return false; }               // لا إنترنت ⇒ لا تُرهق الشبكة
}

/* 💸 جلب نتائج ما تغيّر فقط: الخادم يعرف أي نشاط تغيّرت تسليماته (/results-changed)، فلا نعيد قراءة تسليمات
   كل الأنشطة عند كل تغيير (كانت أغلب فاتورة القراءات). لكل مسار مؤشره في هذا الجهاز؛ جلب كامل أول مرة ثم مرة يوميًا
   احتياطًا، وبهامش دقيقتين للخلف لأن قائمة KV قد تتأخر عن الكتابة. خادم قديم بلا المسار ⇒ جلب كامل كالسابق. */
const CHG_KEY='hwapp_reschg_v1', CHG_BACK=120000, CHG_FULL=864e5;
function resChangedReset(){ try{ const all=JSON.parse(localStorage.getItem(CHG_KEY)||'{}')||{}; Object.values(all).forEach(o=>{ if(o) o.full=0; }); localStorage.setItem(CHG_KEY,JSON.stringify(all)); }catch(e){} }
async function resChangedPlan(list, slot){
  let st={}; try{ st=JSON.parse(localStorage.getItem(CHG_KEY)||'{}')||{}; }catch(e){}
  const key=slot+'|'+getApi(), c=st[key]||null;
  const save=(o)=>{ try{ const all=JSON.parse(localStorage.getItem(CHG_KEY)||'{}')||{}; all[key]=o; localStorage.setItem(CHG_KEY,JSON.stringify(all)); }catch(e){} };
  let j=null;
  try{ const since=c&&c.cur?c.cur-CHG_BACK:Date.now();
    const r=await fetch(`${getApi()}/results-changed?t=${encodeURIComponent(getTok())}&since=${since}&_=${Date.now()}`,{cache:'no-store'});
    if(r.ok) j=await r.json().catch(()=>null); }catch(e){}
  if(!j||!j.ok) return {list, commit(){}};                    // خادم قديم/تعذّر ⇒ كل الأنشطة، بلا مؤشر
  const full=!c||!c.cur||Date.now()-(c.full||0)>CHG_FULL||(j.start||0)>c.cur;   // مؤشر أقدم من بداية التتبع ⇒ كامل
  const commit=()=>save({cur:j.now, full:full?Date.now():(c.full||0)});
  if(full) return {list, commit, full:true};
  const set=new Set((j.hws||[]).map(String));
  return {list:list.filter(h=>set.has(String(h.sid))), commit};
}
async function liveFetchResults(list, limit=6){
  const out=new Array(list.length); let i=0;
  const worker=async()=>{ while(i<list.length){ const k=i++, h=list[k];
    try{ const r=await fetch(`${getApi()}/results?hw=${encodeURIComponent(h.sid)}&t=${encodeURIComponent(getTok())}&_=${Date.now()}`,{cache:'no-store'});
      out[k]=[h, r.ok ? await r.json().catch(()=>null) : null]; }catch(e){ out[k]=[h,null]; } } };
  await Promise.all(Array.from({length:Math.min(limit,list.length)},worker));
  return out.filter(Boolean);
}
/* 🔔 وصل إشعار تسليم واللوحة مفتوحة: نفحص ذلك النشاط وحده فورًا بنفس منطق الفحص الدوري
   (المحاولات الإضافية والتنبيه وغيرها) بدل انتظار دوره. إن كان فحص آخر جاريًا نعيد المحاولة بعد لحظة. */
async function liveCheckOne(hwSid, tries=0){
  if(!hwSid || !getApi() || !getTok()) return;
  const h=HW.find(x=>x && (x.sid===hwSid || x.id===hwSid));
  if(liveChecking){ if(tries<8) setTimeout(()=>liveCheckOne(hwSid,tries+1),1000); return; }
  try{ await checkLiveSubmissions(true, h&&h.sid ? h.sid : null); }catch(e){}
}
async function checkLiveSubmissions(force, onlySid){
  if(liveChecking || !getApi() || !getTok()) return 0;
  // ⚡ لا تسحب كل النتائج إلا إذا تغيّر شيء فعلاً
  if(!force && !(await serverChanged())) return 0;

  liveChecking = true;
  let changed = false;
  const fresh = [];
  let plan = null, planOk = false;

  try{
    let published = HW.filter(h => h && h.sid && (!onlySid || h.sid === onlySid));
    plan = onlySid ? null : await resChangedPlan(published, 'live');   // 💸 ما تغيّر فقط
    if(plan) published = plan.list;

    // ⚡ نتائج كل الأنشطة بالتوازي (6 طلبات معًا) بدل طلب تلو الآخر — كان التسليم الجديد ينتظر دوره في الطابور
    const fetched = await liveFetchResults(published);
    planOk = !!plan && fetched.every(([h, j]) => j && j.ok);   // فشل جلب ⇒ لا يتقدم المؤشر فيُعاد لاحقًا
    for(const [h, j] of fetched){
      try{
        if(!j || !j.ok) continue;

        for(const row of (j.rows || [])){
          const key = liveRowKey(h, row);
          const name = String(row.name || '').trim();
          const st = matchStudent(row);

          const existing = st && h.subs ? h.subs[st.id] : null;
          const existingAt = Number(existing?.at) || 0;
          const rowAt = Number(row.at) || 0;

          const known = liveKnownSubs.has(key);
          const sameExisting =
            !!existing &&
            (
              !rowAt ||
              !existingAt ||
              rowAt <= existingAt
            );

          // الجديد = غير معروف من قبل (المعرفة محفوظة بين الجلسات)
          if(!known && !sameExisting){
            if(h.extraAttempts && Number(h.extraAttempts[st?.id]||0)>0){
              h.extraAttempts[st.id]=Math.max(0, Number(h.extraAttempts[st.id])-1);
              if(h.extraAttempts[st.id]===0) delete h.extraAttempts[st.id];
            }
            fresh.push({h, row});
          }

          liveKnownSubs.add(key);

          if(addLiveRowToLocal(h, row)){
            changed = true;
          }
        }
      }catch(error){
        console.warn('live submission check failed:', h.id, error);
      }
    }

    liveSaveKnown();

    if(!liveReady){
      liveReady = true;

      if(changed){
        save(K.hw, HW);
        save(K.st, STUDENTS);
        renderAll();
      }

      // 🔔 تسليمات وصلت والكراسة مغلقة — أخبره بها عند الفتح
      if(fresh.length === 1){
        const it = fresh[0];
        toast(`🔔 ${String(it.row.name||'طالب').trim()} سلّم «${it.h.title||'نشاط'}»`, 'good');
      }else if(fresh.length > 1){
        toast(`🔔 وصل ${fresh.length} تسليماً أثناء غيابك`, 'good');
      }

      return fresh.length;
    }

    if(changed){
      save(K.hw, HW);
      save(K.st, STUDENTS);
      // Do not depend on the Activities tab being open.
      renderAll();
    }

    // 🔔 الإشعار مستقل عن تغيّر البيانات محلياً
    if(fresh.length === 1){
      const item = fresh[0];
      const name = String(item.row.name || 'طالب').trim();
      const title = item.h.title || 'نشاط';
      toast(`🔔 ${name} سلّم «${title}»`, 'good');
    }else if(fresh.length > 1){
      toast(`🔔 وصل ${fresh.length} تسليمات جديدة`, 'good');
    }

    return fresh.length;
  }finally{
    if(planOk) plan.commit();   // بعد المعالجة والحفظ المحلي
    liveChecking = false;
  }
}

liveLoadKnown();

/* 🔐 كلمة السر: تُطلب مرة في كل متصفح */
async function ensureToken(){
  if(getTok()) return true;
  return new Promise(res=>{
    openModal(`
      <h2>كلمة السر</h2>
      <p style="color:var(--ink-soft);font-size:.88rem;margin:.2rem 0 .9rem">
        اكتب كلمة سر الخادم مرة واحدة في هذا المتصفح، فتُحمَّل بياناتك.</p>
      <input type="text" class="inp no-pwsave" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-bwignore id="tok-in" placeholder="TEACHER_TOKEN" style="direction:ltr;text-align:center">
      <label style="display:flex;align-items:center;gap:.5rem;margin:.7rem 0 0;font-size:.86rem;cursor:pointer"><input type="checkbox" id="tok-temp"> جهاز مشترك (مثل كمبيوتر المدرسة) — يخرج تلقائيًا بعد يوم</label>
      <div class="modal-foot">
        <button class="btn tick" style="width:100%" id="tok-go">دخول</button>
      </div>`);
    const go = async ()=>{
      const v = document.getElementById('tok-in').value.trim();
      if(!v) return;
      localStorage.setItem(K_TOK, v);
      try{ if(document.getElementById('tok-temp')?.checked) localStorage.setItem('hw_login_temp','1'); else localStorage.removeItem('hw_login_temp'); }catch(e){}
      const ok = await pullState();
      if(getTok()===v && window.hwAuthUpgrade) window.hwAuthUpgrade();   // 🔑 كلمة السر ⇒ جلسة لهذا الجهاز
      if(ok === false && !getTok()) return;
      closeModal(); res(true);
      syncStore(true); pullAll(true); ctCertTplPush();
    };
    document.getElementById('tok-go').onclick = go;
    document.getElementById('tok-in').addEventListener('keydown', e=>{ if(e.key==='Enter') go(); });
    setTimeout(()=>document.getElementById('tok-in').focus(),80);
  });
}

/* 📋 كشف الدرجات */
const fmtDate = ts => { try{ const d=new Date(ts);
  return d.getFullYear()+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getDate()).padStart(2,'0'); }catch(e){ return ''; } };
const fmtTime = ts => { try{ const d=new Date(ts); return d.toLocaleTimeString('ar-SA-u-nu-latn',{hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; } };   // أرقام موحّدة مع التاريخ
function gFillClasses(){
  const sel = document.getElementById('g-class');
  if(!sel) return;

  const current = sel.value;
  const classes = [...new Set(
    STUDENTS.map(s=>String(s.cls||'').trim()).filter(Boolean)
  )].sort((a,b)=>a.localeCompare(b,'ar'));

  sel.innerHTML =
    '<option value="__all__">كل الفصول</option>' +
    classes.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');

  // عند فتح الكشف لأول مرة يبدأ دائمًا على كل الفصول.
  // إذا كان المستخدم قد اختار فصلًا بالفعل، نحافظ على اختياره.
  if(current && current !== '__all__' && classes.includes(current)){
    sel.value = current;
  }else{
    sel.value = '__all__';
  }
}

function gFillActivities(){
  const sel = document.getElementById('g-hw'); if(!sel) return;
  const cur = sel.value;
  const classSel = document.getElementById('g-class');
  const cls = classSel ? classSel.value : '__all__';

  // الأنشطة المعتمدة فقط — التشخيصي والأنماط لهما تقاريرهما الخاصة
  const list = gradedHW()
    .filter(h => (!cls || cls==='__all__') ? true : (hwFor(h, cls)))
    .slice()
    .sort((a,b)=>(a.at||0)-(b.at||0));

  sel.innerHTML =
    '<option value="__all__">كل الأنشطة</option>' +
    list.map(h=>`<option value="${esc(h.id)}">${esc(h.title)}</option>`).join('');

  if([...sel.options].some(o=>o.value===cur)) sel.value=cur;
  else sel.value='__all__';
}

/* 🔐 رموز الطلاب السرية */
let PINS = {};
async function loadPins(silent){
  const api = getApi(), tok = getTok();
  if(!api || !tok){ if(!silent) toast('اضبط الخادم أولاً','bad'); return; }
  try{
    const j = await (await fetch(`${api}/pins?t=${encodeURIComponent(tok)}`)).json();
    if(j.ok){ PINS = j.pins || {}; PIN_IDX = null; /* الفهرس يُبنى من جديد مع الرموز */ if(!silent) toast(`${Object.keys(PINS).length} رمز`,'good'); }
  }catch(e){ if(!silent) toast('تعذّر الجلب','bad'); }
}

/* ⚡ فهرس الأسماء المطبَّعة.
   pinOf كانت تمسح 174 طالبًا وتُطبّع اسمين في كل خطوة، ثم تمسح مفاتيح
   PINS كذلك. فتح النافذة وحده كان ~111 ألف تطبيع نصّي — وهذا سبب البطء.
   الفهرس يُبنى مرة ويُعاد بناؤه إذا تغيّرت قائمة الطلاب أو الرموز. */
let PIN_IDX = null, PIN_IDX_KEY = '';
function pinIndex(){
  const key = STUDENTS.length + '|' + Object.keys(PINS||{}).length;
  if(PIN_IDX && PIN_IDX_KEY === key) return PIN_IDX;
  const byName = new Map(), byPinKey = new Map();
  for(const s of STUDENTS){ const n = normAr(s.name); if(!byName.has(n)) byName.set(n, s); }
  for(const k of Object.keys(PINS||{})){ const n = normAr(k); if(!byPinKey.has(n)) byPinKey.set(n, k); }
  PIN_IDX = { byName, byPinKey }; PIN_IDX_KEY = key;
  return PIN_IDX;
}
function pinOf(name){
  const ix = pinIndex(), nn = normAr(name);
  const st = ix.byName.get(nn);
  const sid = st ? String(st.id || '').trim() : '';
  if(sid && PINS[sid]) return PINS[sid];
  if(PINS[name]) return PINS[name];
  const k = ix.byPinKey.get(nn);
  return k ? PINS[k] : '';
}

/* 👤 تقرير الطالب الكامل — كل أنشطته ومهاراته */
function studentReport(sid){
  const st = byId(sid); if(!st) return;
  const hws = gradedHW().filter(h => hwFor(h, st.cls)).slice().sort((a,b)=>(a.at||0)-(b.at||0));

  let got=0, max=0, done=0, late=0;
  const skill = {};
  const rows = hws.map(h=>{
    const hMax = h.max || 20; max += hMax;
    const v = (h.subs||{})[st.id];
    if(!v) return { h, hMax, done:false };
    done++;
    const g = Math.round(hMax * (v.correct||0) / Math.max(1, v.total||1));
    got += g;
    const isLate = h.due && v.at && new Date(v.at).toISOString().slice(0,10) > h.due;
    if(isLate) late++;
    // المهارات
    const d = String(v.d||''), qs = h.qs||[];
    if(d.length === qs.length) qs.forEach((q,i)=>{
      const k = q.t||'q';
      skill[k] = skill[k] || {n:0, ok:0};
      skill[k].n++; if(d[i]==='1') skill[k].ok++;
    });
    return { h, hMax, done:true, g, v, isLate,
             pct: Math.round((v.correct||0)/Math.max(1,v.total||1)*100) };
  });

  const pct = max ? Math.round(got/max*100) : 0;
  const band = BANDS.find(b=>pct >= b.min) || BANDS[BANDS.length-1];

  // الاتجاه: قارن النصف الأول بالثاني
  const solved = rows.filter(r=>r.done);
  let trend = '';
  if(solved.length >= 2){
    const half = Math.ceil(solved.length/2);
    const a = solved.slice(0,half).reduce((n,r)=>n+r.pct,0)/half;
    const b = solved.slice(half).reduce((n,r)=>n+r.pct,0)/(solved.length-half);
    const diff = Math.round(b-a);
    trend = diff > 8 ? `<span style="color:var(--tick)">↗ يتحسّن (+${diff}%)</span>`
          : diff < -8 ? `<span style="color:var(--pen)">↘ يتراجع (${diff}%)</span>`
          : `<span style="color:var(--ink-soft)">→ مستقر</span>`;
  }

  // 📊 متوسط الفصل للمقارنة
  const mates = STUDENTS.filter(x=>x.cls===st.cls);
  let clsSum=0, clsN=0;
  mates.forEach(m=>{
    let g=0, mx=0, any=false;
    hws.forEach(h=>{ const hM=h.max||20; const v=(h.subs||{})[m.id];
      mx+=hM; if(v){ any=true; g+=Math.round(hM*(v.correct||0)/Math.max(1,v.total||1)); } });
    if(any && mx){ clsSum += Math.round(g/mx*100); clsN++; }
  });
  const clsAvg = clsN ? Math.round(clsSum/clsN) : 0;
  const gap = pct - clsAvg;

  openModal(`
    <h2 style="margin-bottom:.1rem">${esc(st.name)}</h2>
    <p style="color:var(--ink-soft);font-size:.85rem;margin:0 0 .7rem">
      ${esc(st.cls||'بلا فصل')}</p>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.45rem;margin-bottom:.7rem">
      <div class="sheet" style="margin:0;padding:.55rem .3rem;text-align:center">
        <div style="font-size:1.25rem;font-weight:800;line-height:1.1">${got}<span style="font-size:.72rem;font-weight:400;color:var(--ink-soft)">/${max}</span></div>
        <div style="font-size:.72rem;color:var(--ink-soft);margin-top:.15rem">الدرجة</div></div>
      <div class="sheet" style="margin:0;padding:.55rem .3rem;text-align:center">
        <div style="font-size:1.25rem;font-weight:800;line-height:1.1;color:${band.color}">${pct}%</div>
        <div style="font-size:.72rem;color:${band.color};margin-top:.15rem">${band.name.replace(/ـ/g,'')}</div></div>
      <div class="sheet" style="margin:0;padding:.55rem .3rem;text-align:center">
        <div style="font-size:1.25rem;font-weight:800;line-height:1.1;color:${done===hws.length?'var(--tick)':'#C88A2E'}">${done}<span style="font-size:.72rem;font-weight:400;color:var(--ink-soft)">/${hws.length}</span></div>
        <div style="font-size:.72rem;color:var(--ink-soft);margin-top:.15rem">سلّم</div></div>
      <div class="sheet" style="margin:0;padding:.55rem .3rem;text-align:center">
        <div style="font-size:1.25rem;font-weight:800;line-height:1.1;color:${late?'#C88A2E':'var(--tick)'}">${late}</div>
        <div style="font-size:.72rem;color:var(--ink-soft);margin-top:.15rem">متأخر</div></div>
    </div>

    ${clsN > 1 ? `
    <div class="sheet" style="margin:0 0 .7rem;padding:.5rem .75rem">
      <div class="row" style="gap:.5rem;font-size:.86rem">
        <span style="flex:1">مقارنة بفصله</span>
        <span class="muted">متوسط الفصل ${clsAvg}%</span>
        <b style="color:${gap>=5?'var(--tick)':gap<=-5?'var(--pen)':'var(--ink-soft)'}">
          ${gap>0?'أعلى بـ '+gap:gap<0?'أدنى بـ '+Math.abs(gap):'مطابق'}${gap!==0?'%':''}</b>
      </div>
      <div style="height:7px;border-radius:99px;background:var(--rule);margin-top:.4rem;position:relative;overflow:hidden">
        <i style="position:absolute;inset-inline-start:0;top:0;height:100%;width:${Math.min(pct,100)}%;background:${band.color};border-radius:99px"></i>
        <i style="position:absolute;inset-inline-start:${Math.min(clsAvg,100)}%;top:-2px;height:11px;width:2.5px;background:#16233A"></i>
      </div>
    </div>` : ''}
    ${trend ? `<div style="text-align:center;margin-bottom:.7rem;font-weight:700">${trend}</div>` : ''}

    ${(()=>{ // 🔍 مؤشرات التشخيص وأنماط التعلّم
      const rows = [];
      diagHW().filter(h=>hwFor(h, st.cls)).forEach(h=>{
        const v = (h.subs||{})[st.id]; if(!v) return;
        const p = Math.round((v.correct||0)/Math.max(1,v.total||1)*100);
        const lvl = p>=80 ? ['متقدّم','#1B9C6B'] : p>=60 ? ['متوسط','#2E6BB8']
                  : p>=40 ? ['يحتاج دعمًا','#C88A2E'] : ['أساسي','#B4232F'];
        rows.push(`<div class="row" style="gap:.5rem;padding:.32rem .2rem;border-bottom:1px solid var(--rule);font-size:.87rem">
          <span style="flex:1">🔍 ${esc(h.title)}</span>
          <span class="muted" style="font-size:.8rem">${v.correct}/${v.total}</span>
          <b style="color:${lvl[1]}">${lvl[0]} · ${p}%</b></div>`);
      });
      styleHW().filter(h=>hwFor(h, st.cls)).forEach(h=>{
        const v = (h.subs||{})[st.id]; if(!v || !Array.isArray(v.ans)) return;
        const tally = {};
        (h.qs||[]).forEach((q,i)=>{
          const pick = v.ans[i];
          const tag = (q.tags && q.tags[pick]) || (q.o && q.o[pick]) || null;
          if(tag) tally[tag] = (tally[tag]||0) + 1;
        });
        const top = Object.entries(tally).sort((a,b)=>b[1]-a[1]);
        if(!top.length) return;
        const total = top.reduce((n,x)=>n+x[1],0);
        const tp = top[0][0];
        rows.push(`<div style="padding:.4rem .2rem;border-bottom:1px solid var(--rule)">
          <div class="row" style="gap:.5rem;font-size:.87rem">
            <span style="flex:1">${STYLE_ICON[tp]||'🧠'} ${esc(h.title)}</span>
            <b style="color:${STYLE_COLOR[tp]||'var(--tick)'}">${esc(tp)}</b></div>
          <div class="muted" style="font-size:.77rem;margin-top:.2rem">
            ${top.map(([k,c])=>`${esc(k)} ${Math.round(c/total*100)}%`).join(' · ')}</div>
          ${STYLE_TIP[tp] ? `<div style="font-size:.79rem;margin-top:.25rem;color:${STYLE_COLOR[tp]}">
            💡 ${esc(STYLE_TIP[tp])}</div>` : ''}</div>`);
      });
      if(!rows.length) return '';
      return `<div class="rep-sec">🔍 مؤشرات تشخيصية</div>
        <div class="rep-box" style="padding:.55rem">${rows.join('')}</div>`;
    })()}

    ${(()=>{ const th = thanksFor(st.name);
      if(!th.length) return '';
      return `<div class="rep-sec">💌 رسائل الشكر</div>
      <div class="rep-box" style="padding:.55rem">
        ${th.map(x=>{
          const ok = x.status === 'sent';
          return `<div class="row" style="gap:.5rem;padding:.3rem .2rem;border-bottom:1px solid var(--rule);font-size:.86rem">
            <span style="color:${ok?'var(--tick)':'var(--pen)'};font-weight:700">${ok?'✓':'✗'}</span>
            <span style="flex:1">${ok?'أُرسلت لولي الأمر':'لم تُرسل بعد'}</span>
            <span class="muted" style="font-size:.78rem">${fmtDate(x.at)}</span>
          </div>`;
        }).join('')}
      </div>`; })()}

    <div class="rep-sec" style="display:flex;align-items:center;justify-content:center;gap:.6rem">
      <span>أنشطته</span>
      <button onclick="toggleAllQd()" style="background:rgba(255,255,255,.2);border:none;color:#fff;
        border-radius:8px;padding:.15rem .55rem;font-family:inherit;font-size:.74rem;cursor:pointer">
        ▾ افتح الكل</button>
    </div>
    <div class="rep-box" style="padding:.5rem">
      ${rows.length ? rows.map(r=>{
        if(!r.done) return `<div class="row" style="gap:.5rem;padding:.35rem .3rem;border-bottom:1px solid var(--rule)">
          <span style="flex:1;font-size:.87rem">${esc(r.h.title)}</span>
          <span class="pill due">لم يسلّم</span></div>`;
        const c = r.pct>=80?'var(--tick)':r.pct>=50?'#C88A2E':'var(--pen)';
        const qs = r.h.qs || [];
        const dd = String(r.v.d||'');
        const canDetail = dd.length === qs.length && qs.length > 0;
        return `<div style="border-bottom:1px solid var(--rule)">
          <div class="row" style="gap:.5rem;padding:.35rem .3rem;${canDetail?'cursor:pointer':''}"
               ${canDetail?`onclick="toggleQd('${r.h.id}')"`:''}>
            <span style="flex:1;font-size:.87rem">${canDetail?'<span id="qa-'+r.h.id+'" style="color:var(--ink-soft);font-size:.75rem">▸</span> ':''}${esc(r.h.title)}${r.isLate?' <span style="color:#C88A2E">⏰</span>':''}</span>
            <span style="font-size:.76rem;color:var(--ink-soft)">${r.v.correct}/${r.v.total} مهمة</span>
            <span style="width:60px;height:6px;background:var(--rule);border-radius:99px;overflow:hidden">
              <i style="display:block;height:100%;width:${r.pct}%;background:${c}"></i></span>
            <b style="color:${c};min-width:3.2rem;text-align:end">${r.g}/${r.hMax}</b>
            <span style="font-size:.72rem;color:var(--ink-soft);min-width:5rem;text-align:end">${r.v.at?fmtDate(r.v.at):''}</span>
          </div>
          ${canDetail ? `<div id="qd-${r.h.id}" class="hide" style="padding:.15rem .3rem .5rem 1.2rem;background:#F7F9FC">
            ${qs.map((q,i)=>{
              const ok = dd[i]==='1';
              const k = q.t||'q';
              const title = k==='a' ? ('رتّب الحروف: '+(q.w||''))
                          : k==='s' ? ('رتّب الجملة: '+String(q.s||'').slice(0,38))
                          : k==='m' ? ('وصّل: '+(((q.p||[])[0]||[''])[0])+' …')
                          : (q.q||'');
              const right = k==='q' ? (q.o||[])[q.a] : k==='tf' ? (q.a?'صح':'خطأ')
                          : k==='f' ? q.a : k==='a' ? q.w : k==='s' ? q.s
                          : (q.p||[]).map(x=>x[0]+' ← '+x[1]).join(' · ');
              return `<div style="display:flex;gap:.45rem;align-items:flex-start;padding:.28rem 0;font-size:.82rem;
                        border-bottom:1px dashed var(--rule)">
                <span style="color:${ok?'var(--tick)':'var(--pen)'};font-weight:700;min-width:1.1rem">${ok?'✓':'✗'}</span>
                <span style="color:var(--ink-soft);min-width:1.2rem">${i+1}.</span>
                <span style="flex:1">${esc(title)}
                  ${ok?'':`<span style="display:block;color:var(--tick);font-size:.78rem;margin-top:.15rem">الصحيح: ${esc(right)}</span>`}
                </span>
                <span class="pill quiet" style="font-size:.7rem">${KIND_NAME[k]||k}</span>
              </div>`;
            }).join('')}
          </div>` : ''}
        </div>`;
      }).join('') : '<p class="muted">لا أنشطة لفصله بعد.</p>'}
    </div>

    ${Object.keys(skill).length ? `
    <div class="rep-sec" style="margin-top:.8rem">أداؤه حسب نوع السؤال</div>
    <div class="rep-box" style="padding:.6rem">
      ${Object.entries(skill).map(([k,v])=>{
        const p = Math.round(v.ok/v.n*100);
        const c = p>=75?'var(--tick)':p>=50?'#C88A2E':'var(--pen)';
        return `<div class="hb"><span class="nm">${KIND_NAME[k]||k}</span>
          <span class="tr"><i style="width:${Math.max(p,2)}%;background:${c}"></i></span>
          <span class="vv" style="color:${c}">${p}%</span>
          <span class="muted" style="font-size:.74rem;min-width:3.4rem;text-align:end">${v.ok}/${v.n}</span></div>`;
      }).join('')}
      <div class="muted" style="font-size:.75rem;margin-top:.4rem;line-height:1.5">
        نسبة الإصابة في كل نوع — قد تعكس صعوبة الأسئلة لا مستوى الطالب.</div>
    </div>` : ''}

    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إغلاق</button>
      <button class="btn tick" onclick="printStudentReport('${st.id}')">🖨️ طباعة</button>
      <button class="btn" onclick="closeModal();openStudentProfile('${st.id}')">👤 ملفه</button>
    </div>`);
}


/* ↕️ حالة الفرز في كشف الدرجات */
let GSORT = { key:'grade', dir:'desc' };   // grade | name | pct | coins | done | h:<id>
const gArrow = key => GSORT.key === key ? (GSORT.dir==='desc' ? ' ▼' : ' ▲') : '';

/* ⚡ ذاكرة مؤقتة لحسابات كشف الدرجات — الفرز لا يعيد الحساب */
let _gCache = null;
function gInvalidate(){ _gCache = null; }
function gCacheKey(){
  const el = id => { const e=document.getElementById(id); return e ? e.value : ''; };
  return [el('g-class'), el('g-hw'), el('g-search'), HW.length, STUDENTS.length,
          HW.reduce((n,h)=>n+Object.keys(h.subs||{}).length,0)].join('|');
}

// الأنشطة التي تدخل الكشف الأكاديمي (بلا تشخيصي/أنماط)
/* الأنشطة في التقارير وملف الطالب: ما نُشر للطلاب فقط — المسودة التي لم تُنشر لا يراها الطالب، فلا تُعد «لم يسلّم» */
const hwEverPublished = h => !!(h && (h.published || h.sid || Object.keys(h.subs || {}).length));
const gradedHW = () => HW.filter(h => ((h.kind||'normal') === 'normal' || h.kind === 'reading') && hwEverPublished(h));
const diagHW   = () => HW.filter(h => h.kind === 'diag' && hwEverPublished(h));
const styleHW  = () => HW.filter(h => h.kind === 'style' && hwEverPublished(h));

function gBuild(){
  const sel = document.getElementById('g-class');
  const cls = sel ? sel.value : '__all__';
  let studs = (!cls || cls==='__all__') ? STUDENTS : STUDENTS.filter(s=>s.cls===cls);
  const gq = (()=>{ const b=document.getElementById('g-search'); return b ? normAr(b.value) : ''; })();
  if(gq){
    const words = gq.split(' ').filter(Boolean);
    studs = studs.filter(s=>stuMatch(document.getElementById('g-search').value, s.name));
  }
  // أنشطة هذا الفصل فقط (أو كلها)، مع دعم اختيار نشاط واحد
  const hwSel = document.getElementById('g-hw');
  const hwId = hwSel ? hwSel.value : '__all__';
  const hws = gradedHW().filter(h =>
      ((!cls || cls==='__all__') ? true : (hwFor(h, cls))) &&
      ((!hwId || hwId==='__all__') ? true : h.id===hwId)
    ).sort((a,b)=>(a.at||0)-(b.at||0));
  const rows = studs.map(s=>{
    const cells = hws.map(h=>{
      const hMax = h.max || 20;                     // الدرجة الكاملة التي حدّدها المعلم
      const v = (h.subs||{})[s.id];
      if(!v) return { done:false, pts:0, max:hMax, coins:0, maxCoins:h.pts||0 };
      const late = h.due && v.at && fmtDate(v.at).replace(/\//g,'-') > h.due;
      const grade = Math.round(hMax * (v.correct||0) / Math.max(1, v.total||1));
      return { done:true, pts: (v.manualGrade !== undefined ? v.manualGrade : grade), max:hMax,
               manual: v.manualGrade !== undefined,
               coins:v.pts||0, maxCoins:h.pts||0,
               correct:v.correct, total:v.total, at:v.at, late };
    });
    const got = cells.reduce((n,c)=>n+(c.done?c.pts:0),0);
    const max = cells.reduce((n,c)=>n+c.max,0);
    const coins = cells.reduce((n,c)=>n+(c.done?c.coins:0),0);
    const done = cells.filter(c=>c.done).length;
    const lastAt = cells
      .filter(c=>c.done && c.at)
      .map(c=>c.at)
      .sort((x,y)=>new Date(y).getTime()-new Date(x).getTime())[0] || 0;
    const lateN = cells.filter(c=>c.late).length;
    return { s, cells, got, max, coins, done, lastAt, lateN,
             pct: max ? Math.round(got/max*100) : 0 };
  });

  // ↕️ الفرز
  _gCache = { key: gCacheKey(), rows, hws };
  return gSortRows(rows, hws);
}

/* يفرز صفوفاً محسوبة مسبقاً */
function gSortRows(rows, hws){
  const dir = GSORT.dir === 'desc' ? -1 : 1;
  const key = GSORT.key;
  rows = rows.slice();
  rows.sort((a,b)=>{
    let x, y;
    if(key === 'name'){ return a.s.name.localeCompare(b.s.name,'ar') * dir; }
    else if(key === 'grade'){ x=a.got; y=b.got; }
    else if(key === 'pct'){ x=a.pct; y=b.pct; }
    else if(key === 'coins'){ x=a.coins; y=b.coins; }
    else if(key === 'done'){ x=a.done; y=b.done; }
    else if(key === 'date'){ x=a.lastAt; y=b.lastAt; }
    else if(key.startsWith('h:')){
      const i = hws.findIndex(h=>h.id === key.slice(2));
      x = (a.cells[i] && a.cells[i].done) ? a.cells[i].pts : -1;
      y = (b.cells[i] && b.cells[i].done) ? b.cells[i].pts : -1;
    } else { x=a.got; y=b.got; }
    if(x === y) return a.s.name.localeCompare(b.s.name,'ar');
    return (x - y) * dir;
  });
  return { hws, rows, studs: rows.map(r=>r.s) };
}

/* نقطة الدخول: تستخدم الذاكرة المؤقتة إن كانت صالحة */
function gData(){
  if(_gCache && _gCache.key === gCacheKey())
    return gSortRows(_gCache.rows, _gCache.hws);
  return gBuild();
}


function renderGrades(){
  gFillClasses();
  gFillActivities();

  const data = gData();
  const heavy = data.rows.length * Math.max(1, data.hws.length);
  const box = document.getElementById('g-table');
  const summary = document.getElementById('g-summary');
  const legend = document.getElementById('g-legend');
  if(!box) return;

  const rows = data.rows || [];
  const hws = data.hws || [];

  const totalExpected = rows.reduce((n,r)=>n+r.cells.length,0);
  const totalDone = rows.reduce((n,r)=>n+r.done,0);
  const completion = totalExpected ? Math.round(totalDone/totalExpected*100) : 0;
  const avgPct = rows.length ? Math.round(rows.reduce((n,r)=>n+r.pct,0)/rows.length) : 0;
  const late = rows.reduce((n,r)=>n+r.lateN,0);
  const missing = Math.max(0,totalExpected-totalDone);

  const stateSel = document.getElementById('g-state');
  const state = stateSel ? stateSel.value : '__all__';

  const filteredRows = rows.filter(r=>{
    if(state==='done') return r.done === r.cells.length && r.cells.length>0;
    if(state==='missing') return r.done < r.cells.length;
    if(state==='none') return r.done === 0 && r.cells.length>0;
    if(state==='late') return r.lateN > 0;
    if(state==='excellent') return r.pct >= 90;
    if(state==='weak') return r.pct < 50;
    return true;
  });

  const fExpected = filteredRows.reduce((n,r)=>n+r.cells.length,0);
  const fDone = filteredRows.reduce((n,r)=>n+r.done,0);
  const fCompletion = fExpected ? Math.round(fDone/fExpected*100) : 0;
  const fAvgPct = filteredRows.length ? Math.round(filteredRows.reduce((n,r)=>n+r.pct,0)/filteredRows.length) : 0;
  const fGotAvg = filteredRows.length ? Math.round(filteredRows.reduce((n,r)=>n+r.got,0)/filteredRows.length) : 0;

  if(summary){
    summary.innerHTML = state==='__all__' ? `${rows.length} طالب · ${hws.length} نشاط · <b>${completion}%</b> تسليم` : `المعروض بالتصفية: ${filteredRows.length} من ${rows.length} طالب · ${hws.length} نشاط · <b>${fCompletion}%</b> تسليم`;
  }

  const rank = new Map(rows.slice().sort((a,b)=>b.pct-a.pct || b.got-a.got).map((r,i)=>[r.s.id,i+1]));

  const head = `
    <div class="grades-kpis">
      <div class="grades-kpi"><span>👥 الطلاب</span><b>${rows.length}</b></div>
      <div class="grades-kpi"><span>📋 الأنشطة</span><b>${hws.length}</b></div>
      <div class="grades-kpi"><span>✅ التسليم</span><b>${completion}%</b><small>${totalDone}/${totalExpected}</small></div>
      <div class="grades-kpi"><span>📈 المتوسط</span><b>${avgPct}%</b></div>
      <div class="grades-kpi"><span>⏰ المتأخر</span><b>${late}</b></div>
    </div>
    <div class="grades-tools no-print">
      <select class="inp" id="g-state" onchange="renderGrades()">
        <option value="__all__">كل الحالات</option>
        <option value="done" ${state==='done'?'selected':''}>🟢 مكتمل</option>
        <option value="missing" ${state==='missing'?'selected':''}>🟡 ناقص</option>
        <option value="none" ${state==='none'?'selected':''}>🔴 لم يسلّم</option>
        <option value="late" ${state==='late'?'selected':''}>⏰ متأخر</option>
        <option value="excellent" ${state==='excellent'?'selected':''}>⭐ 90% فأعلى</option>
        <option value="weak" ${state==='weak'?'selected':''}>📉 أقل من 50%</option>
      </select>
      
    </div>`;

  const rowsHtml = filteredRows.map((r,idx)=>{
    const rankNo = rank.get(r.s.id) || idx+1;
    const status = r.done===0 ? ['danger','لم يسلّم'] :
      r.pct>=90 ? ['good','ممتاز'] :
      r.pct>=70 ? ['good','جيد'] :
      r.pct>=50 ? ['warn','يحتاج متابعة'] : ['danger','متعثر'];

    const cells = r.cells.map((c,ci)=>{
      const h=hws[ci];
      if(!c.done) return `<td class="gcell missing" onclick="editGrade('${r.s.id}','${h.id}')"><span>—</span><small>رصد يدوي</small></td>`;
      const p=c.max ? Math.round(c.pts/c.max*100) : 0;
      const cls=p>=80?'g-good':p>=50?'g-warn':'g-bad';
      return `<td class="gcell ${cls}${c.manual?' manual':''}" onclick="editGrade('${r.s.id}','${h.id}')" title="اضغط لتعديل الدرجة">
        <b>${c.pts}</b><small>/${c.max}${c.manual?' ✍️':''}</small>${c.late?'<em>⏰</em>':''}
      </td>`;
    }).join('');

    return `<tr class="grade-student-row">
      
      <td class="g-rank">${rankNo}</td>
      <td class="g-student" onclick="studentReport('${r.s.id}')" title="فتح التقرير المفصل للطالب">
        <b>${esc(r.s.name)}</b><small>${esc(r.s.cls||'بدون فصل')}</small>
      </td>
      ${cells}
      <td class="g-total"><b>${r.got}</b><small>من ${r.max}</small></td>
      <td class="g-pct ${status[0]}"><b>${r.pct}%</b><small>${status[1]}</small></td>
      <td class="g-done"><b>${r.done}/${r.cells.length}</b>${r.lateN?`<small>⏰ ${r.lateN}</small>`:''}</td>
      <td class="g-last"><b>${r.lastAt ? fmtDate(r.lastAt) : '—'}</b><small>${r.lastAt ? fmtTime(r.lastAt) : 'لا يوجد'}</small></td>
    </tr>`;
  }).join('');

  const avgCells = hws.map((h,ci)=>{
    const vals=filteredRows.map(r=>r.cells[ci]).filter(Boolean).filter(c=>c.done);
    const av=vals.length?Math.round(vals.reduce((n,c)=>n+c.pts,0)/vals.length):0;
    const rate=filteredRows.length?Math.round(vals.length/filteredRows.length*100):0;
    return `<td class="g-foot-cell"><b>${av}</b><small>${rate}% تسليم</small></td>`;
  }).join('');

  const table = filteredRows.length ? `
    <div class="grades-table-wrap">
      <table class="gt grades-pro">
        <thead><tr>
          
          <th>#</th>
          <th class="g-student-head" style="cursor:pointer" onclick="gSort('name')" title="فرز بالاسم">الطالب${gArrow('name')}</th>
          ${hws.map(h=>`<th class="g-hw-head" style="cursor:pointer" onclick="gSort('h:${h.id}')" title="${esc(h.title)} — فرز بهذا النشاط">${esc(h.title)}${gArrow('h:'+h.id)}<small>${h.max||20} درجة</small></th>`).join('')}
          <th style="cursor:pointer" onclick="gSort('grade')" title="فرز بالمجموع">المجموع${gArrow('grade')}</th>
          <th style="cursor:pointer" onclick="gSort('pct')">%${gArrow('pct')}</th>
          <th style="cursor:pointer" onclick="gSort('done')">التسليم${gArrow('done')}</th>
          <th style="cursor:pointer" onclick="gSort('date')" title="فرز بآخر تسليم">آخر تسليم${gArrow('date')}</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr><td colspan="2" class="g-foot-label">المتوسط / التسليم</td>${avgCells}
          <td>${fGotAvg}</td>
          <td>${fAvgPct}%</td><td>${fDone}/${fExpected}</td><td>—</td></tr>
        </tfoot>
      </table>
    </div>` :
    `<div class="empty"><span class="big">${rows.length?'🔎':'📊'}</span>${rows.length?'لا توجد نتائج مطابقة للفلاتر.':'لا توجد بيانات كافية لعرض كشف الدرجات.'}</div>`;

  box.innerHTML = head + table;

  if(legend){
    legend.innerHTML = `
      <div class="grades-legend">
        <span><i class="lg-good"></i> أداء جيد</span>
        <span><i class="lg-warn"></i> يحتاج متابعة</span>
        <span><i class="lg-bad"></i> متعثر</span>
        <span>✍️ درجة معدلة يدويًا</span>
        <span>⏰ تسليم متأخر</span>
        <span>${missing} حالة غير مسلّمة</span>
      </div>`;
  }
}

/* 📈 تبويب التحليل — تقرير النتائج بنمط وزارة التعليم */
const BANDS = [
  { key:'excellent', name:'ممتـــــاز', min:90, color:'#4CAF7D' },
  { key:'vgood',     name:'جيد جدًا',   min:75, color:'#3FB89B' },
  { key:'good',      name:'جيــــــد',  min:60, color:'#4A90D9' },
  { key:'pass',      name:'مقبول',      min:50, color:'#F0932B' },
  { key:'weak',      name:'ضعيف',       min:0,  color:'#EE5A6F' }
];
const KIND_NAME = { q:'اختيار من متعدد', tf:'صح أو خطأ', f:'أكمل الفراغ',
                    a:'رتّب الحروف', s:'رتّب الجملة', m:'وصّل' };
const RC = ['school','dept','teacher','principal','counselor','subject','term','year','period'];
const K_RC = 'hwapp_repcfg_v1';
let REPCFG = (function(){
  try { const v = JSON.parse(localStorage.getItem(K_RC)); if(v && typeof v==='object') return v; } catch {}
  // ترحيل من التخزين القديم (مفتاح لكل حقل)
  const old = {};
  RC.forEach(k=>{ const v = localStorage.getItem('hwapp_rc_'+k); if(v) old[k] = v; });
  return old;
})();
function rcGet(k){ return REPCFG[k] || ''; }
function rcSave(){
  save(K_RC, REPCFG);      // save يدفعه للخادم تلقائياً
  try{ ctCertTplPush(); }catch(e){}   // أسماء المدرسة والمعلم والمدير تصل لشهادات المتجر
}
/* 🏫 حقول «بيانات المدرسة والتوقيعات» في الإعدادات — نفس مخزن بيانات التقارير (مصدر واحد) */
function offNamesLoad(){
  let filled=0;
  document.querySelectorAll('.offn').forEach(e=>{const k=e.dataset.rc;e.value=rcGet(k);if(rcGet(k))filled++;
    e.oninput=()=>{REPCFG[k]=e.value.trim();rcSave();const twin=document.getElementById('rc-'+k);if(twin)twin.value=e.value;
      const s=document.getElementById('off-names-saved');if(s){s.textContent='✓ حُفظ — يظهر في التقارير الرسمية';clearTimeout(s._t);s._t=setTimeout(()=>s.textContent='',2500)}offNamesStatus()}});
  offNamesStatus();
}
function offNamesStatus(){
  const st=document.getElementById('off-names-status');if(!st)return;
  const miss=[['teacher','معلم المادة'],['principal','مدير المدرسة'],['counselor','المرشد الطلابي'],['school','المدرسة']].filter(([k])=>!rcGet(k)).map(x=>x[1]);
  st.textContent=miss.length?`ناقص: ${miss.join('، ')}`:'✓ مكتملة';st.className='pill '+(miss.length?'warn':'tick');
}
function loadRepCfg(){
  try{offNamesLoad()}catch(e){}
  { const c=document.getElementById('rc-parskills'); if(c){ c.checked=rcGet('parentSkills')!=='off';
      c.onchange=()=>{ REPCFG.parentSkills=c.checked?'':'off'; rcSave(); toast(c.checked?'✓ المهارات تظهر لولي الأمر':'أُخفيت المهارات من صفحة ولي الأمر'); }; } }
  RC.forEach(k=>{ const e=document.getElementById('rc-'+k); if(e) e.value = rcGet(k); });
  document.querySelectorAll('.rcf').forEach(e=>{
    e.oninput = ()=>{ REPCFG[e.id.slice(3)] = e.value; rcSave(); renderAnalysis(); document.querySelectorAll(`.offn[data-rc="${e.id.slice(3)}"]`).forEach(x=>x.value=e.value); try{offNamesStatus()}catch(_){} };
  });
}
const K_ANMODE = 'hwapp_anmode_v1';
function anMode(){ return localStorage.getItem(K_ANMODE) || 'full'; }
function anFillHw(){
  const sel = document.getElementById('an-hw'); if(!sel) return;
  const c = document.getElementById('an-class2');
  const cls = c ? c.value : '__all__';
  // الأنشطة المعتمدة فقط — للتشخيصي والأنماط تبويباهما
  const list = gradedHW()
                 .filter(h => (!cls || cls==='__all__') ? true : (hwFor(h, cls)))
                 .slice().sort((a,b)=>(b.at||0)-(a.at||0));
  const cur = sel.value;
  sel.innerHTML = '<option value="__all__">كل الأنشطة</option>' +
    list.map(h=>`<option value="${esc(h.id)}">${esc(h.title)}</option>`).join('');
  sel.value = [...sel.options].some(o=>o.value===cur) ? cur : '__all__';
}

function anFillClasses(){
  [['an-class'],['an-class2']].forEach(([id])=>{
    const sel = document.getElementById(id); if(!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="__all__">كل الفصول</option>' +
      classes().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    if([...sel.options].some(o=>o.value===cur)) sel.value = cur;
  });
}

function anBuild(){
  const sel = document.getElementById('an-class2') || document.getElementById('an-class');
  const cls = sel ? sel.value : '__all__';
  const studs = (!cls || cls==='__all__') ? STUDENTS : STUDENTS.filter(s=>s.cls===cls);
  let hws = gradedHW().filter(h => (!cls || cls==='__all__') ? true : (hwFor(h, cls)));
  const hwSel = document.getElementById('an-hw');
  const hwId = hwSel ? hwSel.value : '__all__';
  const oneHw = (hwId && hwId !== '__all__') ? HW.find(h=>h.id===hwId) : null;
  if(oneHw) hws = [oneHw];
  // التشخيصي بلا درجة مُسندة ⇒ اعتبر كل مهمة درجة
  const maxOf = h => h.max || ((h.kind && h.kind!=='normal') ? ((h.qs||[]).length||1) : 20);
  const full = hws.reduce((n,h)=>n+maxOf(h),0);

  const rows = studs.map(s=>{
    let got=0, done=0, coins=0;
    hws.forEach(h=>{
      const v=(h.subs||{})[s.id];
      if(v){ done++;
        got += Math.round(maxOf(h) * (v.correct||0) / Math.max(1, v.total||1));
        coins += v.pts||0; }
    });
    const pct = full ? Math.round(got/full*100) : 0;
    const band = BANDS.find(b=>pct >= b.min) || BANDS[BANDS.length-1];
    // 🚩 من لم يسلّم شيئاً ليس «ضعيفاً» — لا يُحسب في متوسط الأداء
    return { s, got, done, coins, of:hws.length, pct, band, noSub: done === 0 };
  }).sort((a,b)=>b.got-a.got);

  // 📌 تحليل كل مهمة على حدة: كم طالباً حلّها صحيحاً
  const items = [];
  hws.forEach(h=>{
    const qs = h.qs || [];
    const right = qs.map(()=>0), tot = qs.map(()=>0);
    Object.entries(h.subs || {}).forEach(([sid,v])=>{
      if(!studs.some(x=>x.id===sid)) return;
      const d = String(v.d||''); if(d.length !== qs.length) return;
      for(let i=0;i<qs.length;i++){ tot[i]++; if(d[i]==='1') right[i]++; }
    });
    qs.forEach((q,i)=>{
      if(!tot[i]) return;
      const pct = Math.round(right[i]/tot[i]*100);
      const k = q.t || 'q';
      const _sTxt = String(q.s||'');
      const title = k==='a' ? ('رتّب الحروف: ' + (q.w||''))
                  : k==='s' ? ('رتّب الجملة: ' + (_sTxt.length>40 ? _sTxt.slice(0,40)+'…' : _sTxt))
                  : k==='m' ? ('وصّل: ' + ((q.p||[])[0]||[''])[0] + ' …')
                  : (q.q || '');
      const fullTitle = k==='s' ? ('رتّب الجملة: ' + _sTxt) : title;
      items.push({ h, q, i, k, title, fullTitle, right:right[i], tot:tot[i], pct });
    });
  });
  items.sort((a,b)=>a.pct-b.pct);   // الأصعب أولاً

  // 📊 فصل المسلّمين عن غير المسلّمين
  const solved  = rows.filter(r=>!r.noSub);
  const missing = rows.filter(r=>r.noSub);
  const avgSolved = solved.length ? Math.round(solved.reduce((n,r)=>n+r.pct,0)/solved.length) : 0;
  const gotSolved = solved.reduce((n,r)=>n+r.got,0);

  return { rows, hws, cls, full, items, oneHw, solved, missing, avgSolved, gotSolved };
}

function renderAnalysis(){
  anFillClasses(); anFillHw();
  const MODE = anMode();
  // أزرار تحليل الأنشطة فقط — أزرار تحليل الكشف الشامل (data-ca) لها وضعها المستقل
  document.querySelectorAll('.an-mode:not([data-ca])').forEach(b=>b.classList.toggle('on', b.dataset.m===MODE));
  const A = anBuild();
  const box = document.getElementById('an-body'); if(!box) return;

  if(!A.rows.length || !A.hws.length){
    box.innerHTML = `<div class="empty"><span class="big">📊</span>${
      !A.rows.length ? 'لا يوجد طلاب في هذا الفصل' : (gradedHW().some(h=>A.cls==='__all__'||hwFor(h,A.cls)) ? 'لا أنشطة معتمدة لهذا الفصل' : 'لا توجد أنشطة بعد')}</div>`;
    return;
  }

  // 📊 الإحصاء من المسلّمين فقط — غير المسلّم ليس «ضعيفاً»
  const nAll   = A.rows.length;
  const solved = A.solved || A.rows.filter(r=>!r.noSub);
  const miss   = A.missing || A.rows.filter(r=>r.noSub);
  const n      = solved.length;
  const scores = n ? solved.map(r=>r.got) : [0];
  const sum    = scores.reduce((a,b)=>a+b,0);
  const avg    = n ? Math.round(sum/n*10)/10 : 0;
  const rate   = (A.full && n) ? Math.round(sum/(A.full*n)*100) : 0;
  const subRate= nAll ? Math.round(n/nAll*100) : 0;
  const counts = {}; BANDS.forEach(b=>counts[b.key]=0);
  solved.forEach(r=>counts[r.band.key]++);
  const maxC = Math.max(1, ...Object.values(counts));

  const today = new Date();
  const dateStr = today.toLocaleDateString('ar-SA-u-ca-gregory', { day:'numeric', month:'long', year:'numeric' });
  const clsName = A.cls==='__all__' ? 'كل الفصول' : A.cls;

  // النطاق بالدرجات لكل تقدير
  const rangeOf = (b,i) => {
    const hi = i===0 ? A.full : Math.round(A.full * (BANDS[i-1].min/100)) - 1;
    const lo = Math.round(A.full * (b.min/100));
    return lo > hi ? String(lo) : `${lo} - ${hi}`;
  };

  const MOE_LOGO = `<svg preserveAspectRatio="xMidYMid meet" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
	 viewBox="0 0 1000 1000" style="enable-background:new 0 0 1000 1000;" xml:space="preserve">
<style type="text/css">
	.moe-st0{fill:#929497;}
	.moe-st1{fill:#008A79;}
	.moe-st2{fill:#00897D;}
	.moe-st3{fill:#008880;}
	.moe-st4{fill:#00998B;}
	.moe-st5{fill:#009B8B;}
	.moe-st6{fill:#00A08B;}
	.moe-st7{fill:#00B4A6;}
	.moe-st8{fill:#00B6A7;}
	.moe-st9{fill:#009D8A;}
	.moe-st10{fill:#019A8B;}
</style>
<path class="moe-st0" d="M114,682.2c0.5,0.6,0.8,0.6,1.1,0l15.3-29.1c0.2-0.4,0.5-0.6,0.9-0.6h2.8c0.5,0,1,0.5,1,1v33.4c0,0.6-0.5,1-1,1
	h-2.8c-0.6,0-1-0.5-1-1v-26l-13.4,25c-1.5,2.7-4.8,2.7-6.2,0l-11-21.7V687c0,0.6-0.4,1-1,1H96c-0.5,0-1-0.5-1-1v-33.4
	c0-0.6,0.5-1,1-1h2.8c0.4,0,0.7,0.2,0.9,0.6l0,0l0,0l0,0l0,0L114,682.2L114,682.2z"/>
<path class="moe-st0" d="M147.4,661.6h2.8c0.6,0,1,0.5,1,1v24.3c0,0.6-0.4,1-1,1h-2.8c-0.6,0-1-0.5-1-1v-24.3
	C146.4,662,146.9,661.6,147.4,661.6L147.4,661.6z"/>
<path class="moe-st0" d="M148.8,652.5c1.4,0,2.6,1.2,2.6,2.6c0,1.4-1.2,2.6-2.6,2.6c-1.4,0-2.6-1.2-2.6-2.6S147.4,652.5,148.8,652.5
	L148.8,652.5z"/>
<path class="moe-st0" d="M198.2,661.6h2.8c0.6,0,1,0.5,1,1v24.3c0,0.6-0.5,1-1,1h-2.8c-0.5,0-1-0.5-1-1v-24.3
	C197.2,662,197.7,661.6,198.2,661.6L198.2,661.6z"/>
<path class="moe-st0" d="M199.6,652.5c1.4,0,2.6,1.2,2.6,2.6c0,1.4-1.2,2.6-2.6,2.6c-1.4,0-2.6-1.2-2.6-2.6S198.2,652.5,199.6,652.5
	L199.6,652.5z"/>
<path class="moe-st0" d="M560.9,661.6h2.8c0.5,0,1,0.5,1,1v24.3c0,0.6-0.5,1-1,1h-2.8c-0.6,0-1-0.5-1-1v-24.3
	C559.9,662,560.4,661.6,560.9,661.6L560.9,661.6z"/>
<path class="moe-st0" d="M562.3,652.5c1.4,0,2.6,1.2,2.6,2.6c0,1.4-1.2,2.6-2.6,2.6c-1.4,0-2.6-1.2-2.6-2.6S560.9,652.5,562.3,652.5
	L562.3,652.5z"/>
<path class="moe-st0" d="M181.9,672.1c0-6.2-5.2-8.3-15.9-8.2v22.9c0,0.5-0.5,1-1,1h-2.8c-0.5,0-1-0.5-1-1v-24.3c0-0.6,0.5-1,1-1
	c4.2,0,8.4-0.1,12.6,0c7.5,0.3,11.9,5,11.9,12.3v13.1c0,0.5-0.5,1-1,1h-2.8c-0.5,0-1-0.5-1-1V672.1L181.9,672.1z"/>
<path class="moe-st0" d="M625.8,672.1c0-6.2-5.2-8.3-15.9-8.2v22.9c0,0.5-0.5,1-1,1h-2.8c-0.5,0-1-0.5-1-1v-24.3c0-0.6,0.5-1,1-1
	c4.2,0,8.4-0.1,12.6,0c7.5,0.3,11.9,5,11.9,12.3v13.1c0,0.5-0.5,1-1,1h-2.8c-0.5,0-1-0.5-1-1V672.1L625.8,672.1z"/>
<path class="moe-st0" d="M449.1,677.2c0,6.2,5.2,8.3,15.9,8.2v-22.9c0-0.5,0.5-1,1-1h2.8c0.5,0,1,0.5,1,1v24.3c0,0.6-0.5,1-1,1
	c-4.2,0-8.4,0.1-12.6,0c-7.5-0.3-11.9-5-11.9-12.3v-13.1c0-0.5,0.5-1,1-1h2.8c0.5,0,1,0.5,1,1L449.1,677.2L449.1,677.2z"/>
<path class="moe-st0" d="M236,675.6v-22.1c0-0.6,0.5-1,1-1h2.8c0.6,0,1,0.5,1,1v7.6c0,0.3,0.2,0.5,0.5,0.5h7c0.3,0,0.5,0.2,0.5,0.5v1.4
	c0,0.3-0.2,0.5-0.5,0.5h-7c-0.3,0-0.5,0.2-0.5,0.5V678c0,4,2.3,6.3,6.9,7.3c2.8,0.6,3.6,2.7,0.2,2.6
	C240.5,687.7,236,682.9,236,675.6L236,675.6z"/>
<path class="moe-st0" d="M539.1,675.6v-22.1c0-0.6,0.5-1,1-1h2.8c0.5,0,1,0.5,1,1v7.6c0,0.3,0.2,0.5,0.5,0.5h7c0.3,0,0.5,0.2,0.5,0.5
	v1.4c0,0.3-0.2,0.5-0.5,0.5h-7c-0.3,0-0.5,0.2-0.5,0.5V678c0,4,2.3,6.3,6.9,7.3c2.8,0.6,3.6,2.7,0.2,2.6
	C543.5,687.7,539.1,682.9,539.1,675.6L539.1,675.6z"/>
<path class="moe-st0" d="M349.4,664.8v22.1c0,0.5,0.5,1,1,1h2.8c0.5,0,1-0.5,1-1v-15.2c0-0.3,0.2-0.5,0.5-0.5h7c0.3,0,0.5-0.2,0.5-0.5
	v-1.4c0-0.3-0.2-0.5-0.5-0.5h-7c-0.3,0-0.5-0.2-0.5-0.5v-5.8c0-4,2.3-6.3,6.9-7.3c2.8-0.6,3.6-2.7,0.2-2.6
	C353.8,652.7,349.4,657.5,349.4,664.8L349.4,664.8z"/>
<path class="moe-st0" d="M256.4,673.8v13.1c0,0.5,0.5,1,1,1h2.8c0.5,0,1-0.5,1-1c0-16.9,0,7.4,0-15.4c0-4,2.3-6.3,6.9-7.3
	c2.8-0.6,3.6-2.7,0.2-2.6C260.8,661.8,256.4,666.5,256.4,673.8L256.4,673.8z"/>
<path class="moe-st0" d="M295.1,688.4c0-0.3-0.2-0.5-0.5-0.5c-1.9,0-3.1,0-5.7-0.1c-7.5-0.3-11.9-5-11.9-12.3v-13.1c0-0.5,0.5-1,1-1h2.8
	c0.5,0,1,0.5,1,1v14.7c0,4.5,2.9,8.5,6.8,8.5c2.4,0,6.6-1.9,6.6-6.9c0-5.4,0-10.9,0-16.3c0-0.5,0.5-1,1-1h2.8c0.5,0,1,0.5,1,1v29.2
	c0,7.3-4.4,12.1-11.9,12.3c-3.4,0.1-2.6-2,0.2-2.6c4.6-1,6.9-3.6,7-7.6L295.1,688.4L295.1,688.4z"/>
<path class="moe-st0" d="M381.5,652.5c7.6,0,15.3,0,22.9,0c0.4,0,0.7,0.3,0.7,0.7v2c0,0.4-0.3,0.7-0.7,0.7h-19.1v11.8h13.6
	c0.4,0,0.7,0.3,0.7,0.7v2c0,0.4-0.3,0.7-0.7,0.7h-13.6v13.4h19.1c0.4,0,0.7,0.3,0.7,0.7v2c0,0.4-0.3,0.7-0.7,0.7
	c-7.6,0-15.3,0-22.9,0c-0.6,0-1-0.5-1-1v-33.4C380.5,653,381,652.5,381.5,652.5L381.5,652.5z"/>
<path class="moe-st0" d="M333.5,661.6h-6c-5.5,0-10,4.5-10,10v6.3c0,5.5,4.5,10,10,10h6c5.5,0,10-4.5,10-10v-6.3
	C343.5,666.1,339,661.6,333.5,661.6z M338.3,679.2c0,3.3-2.7,6.1-6.1,6.1h-3.6c-3.3,0-6.1-2.7-6.1-6.1v-8.9c0.1-3.4,2.8-6.1,6.1-6.1
	h3.6c3.3,0,6.1,2.7,6.1,6.1V679.2z"/>
<path class="moe-st0" d="M588.7,661.6h-6c-5.5,0-10,4.5-10,10v6.3c0,5.5,4.5,10,10,10h6c5.5,0,10-4.5,10-10v-6.3
	C598.7,666.1,594.2,661.6,588.7,661.6z M593.6,679.2c0,3.3-2.7,6.1-6.1,6.1h-3.6c-3.3,0-6.1-2.7-6.1-6.1v-8.9
	c0.1-3.4,2.8-6.1,6.1-6.1h3.6c3.3,0,6.1,2.7,6.1,6.1V679.2z"/>
<path class="moe-st0" d="M434.3,652.5h-2.8c-0.5,0-1,0.5-1,1v7.6c0,0.3-0.2,0.5-0.5,0.5h-11.2c-5.5,0-10,4.5-10,10v6.3
	c0,5.5,4.5,10,10,10h12.7h1.8h1c0.6,0,1-0.5,1-1v-33.4C435.3,652.9,434.8,652.5,434.3,652.5z M430.5,685.1c0,0.3-0.2,0.5-0.5,0.5h-9
	c-4,0-7.3-3.3-7.3-7.3v-7c0-4,3.3-7.3,7.3-7.3h9c0.3,0,0.5,0.2,0.5,0.5V685.1z"/>
<path class="moe-st0" d="M529.7,661.6c-4.7,0-8.6,0-15.4,0c-5.5,0-10,4.5-10,10v6.3c0,5.5,4.5,10,10,10c4.9,0,10.9-0.7,11.6-0.6
	c0.5,0.1,0.7,0.6,1.5,0.6h2.3c0.6,0,1-0.5,1-1v-24.3C530.7,662,530.2,661.6,529.7,661.6z M526,679.4c0,2.4-1.6,6.7-9.5,6.1
	c-4-0.3-7.3-3.3-7.3-7.3v-7c0-4,3.3-7.3,7.3-7.3h9c0.3,0,0.5,0.2,0.5,0.5V679.4z"/>
<path class="moe-st0" d="M486.1,687.9c-5.5,0-10-4.5-10-10v-6.3c0-5.5,4.5-10,10-10h13.1c0.1,0,0.2,0.1,0.2,0.2v1.9
	c0,0.1-0.1,0.2-0.2,0.2c-3.7,0-7.3,0-11,0c-4,0-7.3,3.3-7.3,7.3v7c0,4,3.3,7.3,7.3,7.3c3.7,0,7.3,0,11,0c0.1,0,0.2,0.1,0.2,0.2v1.9
	c0,0.1-0.1,0.2-0.2,0.2L486.1,687.9L486.1,687.9z"/>
<path class="moe-st0" d="M224.9,663.6c2.4,0,2.4-3.3,0.1-3.5c-6.7-0.7-12.9,0.8-14.5,6.1c-1.2,4,1.2,7.6,7,8.7c7.6,1.4,10.5,5.1,7.3,8.5
	c-1.7,1.7-6.8,1.1-10.5,1.3c-4,0.2-3.5,3.2,0,3.2c6,0.1,12.7,0.9,15.1-3.1c2.5-4.2,0.4-10-4.3-11c-6.3-1.3-10.2-2.7-9.4-6.3
	C216.4,663.9,219.5,663.7,224.9,663.6L224.9,663.6z"/>
<path class="moe-st1" d="M631.4,458.6c4,0,7.2,3.2,7.2,7.2s-3.2,7.2-7.2,7.2s-7.2-3.2-7.2-7.2C624.3,461.8,627.5,458.6,631.4,458.6
	L631.4,458.6z"/>
<path class="moe-st1" d="M631.4,396.7c4.3,0,7.8,3.5,7.8,7.8s-3.5,7.8-7.8,7.8s-7.8-3.5-7.8-7.8C623.6,400.2,627.1,396.7,631.4,396.7
	L631.4,396.7z"/>
<path class="moe-st2" d="M667.2,426.1c4.3,0,7.8,3.5,7.8,7.8s-3.5,7.8-7.8,7.8s-7.8-3.5-7.8-7.8S662.9,426.1,667.2,426.1L667.2,426.1z"
	/>
<path class="moe-st2" d="M597.2,427.4c4.3,0,7.8,3.5,7.8,7.8s-3.5,7.8-7.8,7.8s-7.8-3.5-7.8-7.8C589.3,430.9,592.8,427.4,597.2,427.4
	L597.2,427.4z"/>
<path class="moe-st3" d="M525,438.3c4,0,7.2,3.2,7.2,7.2s-3.2,7.2-7.2,7.2s-7.2-3.2-7.2-7.2S521,438.3,525,438.3L525,438.3z"/>
<path class="moe-st3" d="M738.3,437.4c4,0,7.2,3.2,7.2,7.2s-3.2,7.2-7.2,7.2s-7.2-3.2-7.2-7.2S734.4,437.4,738.3,437.4L738.3,437.4z"/>
<path class="moe-st3" d="M669,368.7c4.7,0,8.4,3.8,8.4,8.4c0,4.7-3.8,8.4-8.4,8.4c-4.7,0-8.4-3.8-8.4-8.4
	C660.6,372.4,664.3,368.7,669,368.7L669,368.7z"/>
<path class="moe-st3" d="M595.2,369.6c4.7,0,8.4,3.8,8.4,8.4c0,4.7-3.8,8.4-8.4,8.4c-4.7,0-8.4-3.8-8.4-8.4S590.6,369.6,595.2,369.6
	L595.2,369.6z"/>
<path class="moe-st3" d="M558.5,401c4.7,0,8.4,3.8,8.4,8.4c0,4.7-3.8,8.4-8.4,8.4c-4.7,0-8.4-3.8-8.4-8.4S553.9,401,558.5,401L558.5,401
	z"/>
<path class="moe-st3" d="M705.7,399.6c5,0,9,4,9,9s-4,9-9,9s-9-4-9-9S700.8,399.6,705.7,399.6L705.7,399.6z"/>
<path class="moe-st4" d="M708.4,344c5.5,0,9.9,4.4,9.9,9.9s-4.4,9.9-9.9,9.9s-9.9-4.4-9.9-9.9S702.9,344,708.4,344L708.4,344z"/>
<path class="moe-st5" d="M750.2,324.9c6.8,0,12.3,5.5,12.3,12.3s-5.5,12.3-12.3,12.3s-12.3-5.5-12.3-12.3
	C737.9,330.5,743.4,324.9,750.2,324.9L750.2,324.9z"/>
<path class="moe-st6" d="M793.6,311.4c7.9,0,14.3,6.4,14.3,14.3s-6.4,14.3-14.3,14.3c-7.9,0-14.3-6.4-14.3-14.3S785.7,311.4,793.6,311.4
	L793.6,311.4z"/>
<path class="moe-st7" d="M838,302.2c8.3,0,14.9,6.7,14.9,14.9c0,8.3-6.7,14.9-14.9,14.9c-8.3,0-15-6.7-15-14.9
	C823,308.9,829.7,302.2,838,302.2L838,302.2z"/>
<path class="moe-st8" d="M883.1,296.1c9.2,0,16.7,7.5,16.7,16.7s-7.5,16.7-16.7,16.7s-16.7-7.5-16.7-16.7
	C866.4,303.5,873.9,296.1,883.1,296.1L883.1,296.1z"/>
<path class="moe-st4" d="M747.4,379c5.5,0,9.9,4.4,9.9,9.9s-4.4,9.9-9.9,9.9s-9.9-4.4-9.9-9.9C737.4,383.5,741.9,379,747.4,379
	L747.4,379z"/>
<path class="moe-st5" d="M790.9,363c6.8,0,12.3,5.5,12.3,12.3s-5.5,12.3-12.3,12.3s-12.3-5.5-12.3-12.3C778.6,368.6,784.1,363,790.9,363
	L790.9,363z"/>
<path class="moe-st6" d="M836.7,352.8c7.9,0,14.3,6.4,14.3,14.3s-6.4,14.3-14.3,14.3c-7.9,0-14.3-6.4-14.3-14.3
	C822.4,359.2,828.8,352.8,836.7,352.8L836.7,352.8z"/>
<path class="moe-st7" d="M884.9,351.2c8.3,0,14.9,6.7,14.9,14.9c0,8.3-6.7,15-14.9,15c-8.3,0-15-6.7-15-15
	C869.9,357.9,876.6,351.2,884.9,351.2L884.9,351.2z"/>
<path class="moe-st4" d="M785,415.8c5.5,0,9.9,4.4,9.9,9.9s-4.4,9.9-9.9,9.9s-9.9-4.4-9.9-9.9C775.1,420.2,779.5,415.8,785,415.8
	L785,415.8z"/>
<path class="moe-st5" d="M836.7,403.5c6.8,0,12.3,5.5,12.3,12.3s-5.5,12.3-12.3,12.3s-12.3-5.5-12.3-12.3
	C824.4,409.1,829.9,403.5,836.7,403.5L836.7,403.5z"/>
<path class="moe-st6" d="M886.2,402.2c7.4,0,13.4,6,13.4,13.4s-6,13.4-13.4,13.4s-13.4-6-13.4-13.4C872.7,408.2,878.8,402.2,886.2,402.2
	L886.2,402.2z"/>
<path class="moe-st4" d="M555.6,345.3c5.5,0,9.9,4.4,9.9,9.9s-4.4,9.9-9.9,9.9s-9.9-4.4-9.9-9.9C545.7,349.8,550.1,345.3,555.6,345.3
	L555.6,345.3z"/>
<path class="moe-st9" d="M514.4,326.7c6.8,0,12.3,5.5,12.3,12.3s-5.5,12.3-12.3,12.3s-12.3-5.5-12.3-12.3
	C502,332.2,507.6,326.7,514.4,326.7L514.4,326.7z"/>
<path class="moe-st6" d="M470.7,313.1c7.9,0,14.3,6.4,14.3,14.3s-6.4,14.3-14.3,14.3s-14.3-6.4-14.3-14.3
	C456.4,319.5,462.8,313.1,470.7,313.1L470.7,313.1z"/>
<path class="moe-st7" d="M426.4,304.4c8.3,0,14.9,6.7,14.9,15s-6.7,14.9-14.9,14.9c-8.3,0-15-6.7-15-14.9
	C411.4,311.1,418.1,304.4,426.4,304.4L426.4,304.4z"/>
<path class="moe-st8" d="M381.4,296.1c9.2,0,16.7,7.5,16.7,16.7s-7.5,16.7-16.7,16.7s-16.7-7.5-16.7-16.7
	C364.7,303.5,372.2,296.1,381.4,296.1L381.4,296.1z"/>
<path class="moe-st4" d="M516.8,380.3c5.5,0,9.9,4.4,9.9,9.9s-4.4,9.9-9.9,9.9s-9.9-4.4-9.9-9.9C506.9,384.8,511.3,380.3,516.8,380.3
	L516.8,380.3z"/>
<path class="moe-st9" d="M472.9,364.4c6.8,0,12.3,5.5,12.3,12.3s-5.5,12.3-12.3,12.3s-12.3-5.5-12.3-12.3S466.1,364.4,472.9,364.4
	L472.9,364.4z"/>
<path class="moe-st6" d="M426.4,354.1c7.9,0,14.3,6.4,14.3,14.3s-6.4,14.3-14.3,14.3s-14.3-6.4-14.3-14.3S418.5,354.1,426.4,354.1
	L426.4,354.1z"/>
<path class="moe-st7" d="M379.6,352.5c8.3,0,15,6.7,15,14.9c0,8.3-6.7,15-15,15s-14.9-6.7-14.9-15C364.7,359.2,371.3,352.5,379.6,352.5
	L379.6,352.5z"/>
<path class="moe-st4" d="M479.4,417.1c5.5,0,9.9,4.4,9.9,9.9s-4.4,9.9-9.9,9.9s-9.9-4.4-9.9-9.9C469.5,421.6,473.9,417.1,479.4,417.1
	L479.4,417.1z"/>
<path class="moe-st9" d="M429,404.9c6.8,0,12.3,5.5,12.3,12.3s-5.5,12.3-12.3,12.3s-12.3-5.5-12.3-12.3S422.2,404.9,429,404.9L429,404.9
	z"/>
<path class="moe-st6" d="M377.4,403.6c7.4,0,13.4,6,13.4,13.4s-6,13.4-13.4,13.4s-13.4-6-13.4-13.4S370,403.6,377.4,403.6L377.4,403.6z"
	/>
<circle class="moe-st10" cx="166.4" cy="613.6" r="4"/>
<circle class="moe-st10" cx="366" cy="550.7" r="4"/>
<path class="moe-st10" d="M179.9,609.6c-2.3,0-4.1,1.8-4,4c0,2.2,1.8,4,4,4c2.2,0,4-1.8,4-4S182.1,609.6,179.9,609.6z"/>
<circle class="moe-st10" cx="488.8" cy="550.7" r="4"/>
<path class="moe-st10" d="M379.5,554.7c2.2,0,4-1.8,4-4s-1.8-4-4-4c-2.3,0-4.1,1.8-4,4C375.5,552.9,377.3,554.7,379.5,554.7z"/>
<path class="moe-st10" d="M475.4,554.7c2.2,0,4-1.8,4-4s-1.8-4-4-4c-2.3,0-4.1,1.8-4,4C471.4,552.9,473.2,554.7,475.4,554.7z"/>
<path class="moe-st10" d="M571.4,565.4h-6.5c-0.4,0-0.7,0.3-0.8,0.7c0,11.8,0,23.5,0,35.3s-5.5,12.2-7.7,13c-2.9,1-2.2,4.3,1.2,3.8
	c5-0.7,14.5-4.3,14.5-20.2c0-12.2,0-19.7,0-31.9C572.1,565.7,571.8,565.4,571.4,565.4z"/>
<circle class="moe-st10" cx="568.3" cy="550.7" r="4"/>
<path class="moe-st10" d="M629.8,565.2h-23.1c-14.2,0-23.3,4.9-23.2,18.7v14.8c0,0.4,0.3,0.7,0.7,0.7h37.7c0.4,0.2,0.8,0.5,0.8,0.9v9
	c-0.1,2.2-3.2,4-5,5.5c-1.6,1.4-1.6,2.4,1.8,2.1c4.3-0.4,11.1-5.7,11-10.6v-7.5V592v-26.1C630.5,565.5,630.2,565.2,629.8,565.2z
	 M622.6,592.3c0,0.4-0.4,0.8-0.8,0.8h-29.5c-0.4,0-0.8-0.4-0.8-0.8V582c0-4.6,3.2-10.1,12.2-10.1h18.1c0.4,0,0.8,0.4,0.8,0.8V592.3z
	"/>
<path class="moe-st10" d="M549.1,546.6h-6.5c-0.4,0-0.7,0.4-0.7,0.8V599c0,0.4,0.3,0.7,0.7,0.7h6.5c0.4,0,0.7-0.3,0.7-0.7v-51.7
	C549.8,546.9,549.5,546.6,549.1,546.6z"/>
<path class="moe-st10" d="M426.6,546.6h-6.5c-0.3,0-0.7,0.4-0.7,0.8V599c0,0.4,0.3,0.7,0.7,0.7h6.5c0.4,0,0.7-0.3,0.7-0.7v-51.7
	C427.3,546.9,427,546.6,426.6,546.6z"/>
<path class="moe-st10" d="M527.7,565.4h-6.5c-0.4,0-0.7,0.3-0.8,0.7c0,11.8,0,23.5,0,35.3s-5.5,12.2-7.7,13c-2.9,1-2.2,4.3,1.2,3.8
	c5-0.7,14.5-4.3,14.5-20.2c0-12.2,0-19.7,0-31.9C528.4,565.7,528.1,565.4,527.7,565.4z"/>
<path class="moe-st10" d="M503.2,565.4h-23.1c-14.2,0-23.3,4.9-23.2,18.7v14.8c0,0.4,0.3,0.7,0.7,0.7c15.2,0,30.4,0,45.6,0
	c0.4,0,0.7-0.3,0.7-0.7v-32.8C503.9,565.7,503.6,565.4,503.2,565.4z M495.9,592.3c0,0.4-0.4,0.8-0.8,0.8h-29.5
	c-0.4,0-0.8-0.4-0.8-0.8V582c0-4.6,3.2-10.1,12.2-10.1h18.1c0.4,0,0.8,0.4,0.8,0.8V592.3z"/>
<path class="moe-st10" d="M405.4,546.5H399c-0.4,0-0.7,0.3-0.7,0.7V591c0,0.4-0.3,0.7-0.7,0.7h-20.1c-0.4,0-0.7-0.3-0.7-0.7v-25.1
	c0-0.4-0.3-0.7-0.7-0.7h-6.5c-0.4,0-0.7,0.3-0.7,0.7V591c0,0.4-0.3,0.7-0.7,0.7H286c-0.4,0-0.8-0.4-0.8-0.8V582
	c0-4.6,3.2-10.2,12.2-10.2h33.3c0.4,0,0.7-0.3,0.7-0.7V566c0-0.4-0.3-0.7-0.7-0.7h-30.3c-14.2,0-23.3,4.9-23.2,18.7v6.9
	c0,0.4-0.3,0.7-0.7,0.7h-66.8c-0.4,0-0.7-0.3-0.7-0.7V547c0-0.4-0.3-0.7-0.7-0.7h-6.5c-0.4,0-0.7,0.3-0.7,0.7v44
	c0,0.4-0.3,0.7-0.7,0.7h-22.5c-0.4,0-0.7-0.3-0.7-0.7v-24.6c0-0.4-0.3-0.7-0.7-0.7H170c-0.4,0-0.7,0.3-0.7,0.7V591
	c0,0.4-0.3,0.7-0.7,0.7H154c-0.4,0-0.7-0.3-0.7-0.7v-6.9c0.1-13.8-9-18.7-23.2-18.7h-28.5c-0.4,0-0.7,0.3-0.7,0.7v43.2h0.1
	c-0.1,2.2-3.2,4-5,5.5c-1.6,1.4-1.6,2.4,1.8,2.1c4.3-0.4,11.1-5.7,11-10.6v-6.8h43.7h252.9c0.4,0,0.7-0.3,0.7-0.7v-51.6
	C406.1,546.8,405.8,546.5,405.4,546.5z M145.4,590.9c0,0.4-0.3,0.8-0.8,0.8h-34.9c-0.4,0-0.8-0.4-0.8-0.8v-18.2
	c0-0.4,0.4-0.8,0.8-0.8h23.5c9,0,12.2,5.5,12.2,10.1V590.9z"/>
</svg>`;
  window.__MOE_LOGO = MOE_LOGO;      // متاح للتقارير الأخرى
  const head = (sub) => repHead(sub, 'تحليل النتائج');   // الترويسة الموحّدة لكل التقارير

  // شرائح الدونات
  let acc = 0;
  const stops = BANDS.map(b=>{
    const p = n ? counts[b.key]/n*100 : 0;
    const seg = `${b.color} ${acc}% ${acc+p}%`;
    acc += p; return seg;
  }).join(',');

  box.innerHTML = `
  <div class="rep">
    <div class="rep-page${MODE==='brief' ? ' one-page' : ''}">
      ${head('')}
      <div class="rep-in">
        <div class="rep-info">
          <div>الفصل: <b>${esc(clsName)}</b></div>
          <div>النشاط: <b>${A.oneHw ? esc(A.oneHw.title) : 'كل الأنشطة ('+A.hws.length+')'}</b></div>
          <div>المادة: <b>${esc(rcGet('subject') || '—')}</b></div>
          <div>الفصل الدراسي: <b>${esc(rcGet('term') || (repYearLines().find(x=>x.startsWith('الفصل الدراسي'))||'').replace('الفصل الدراسي ','') || '—')}</b></div>
          <div>السنة الدراسية: <b>${esc(rcGet('year') || (repYearLines().find(x=>x.startsWith('العام الدراسي'))||'').replace('العام الدراسي ','') || '—')}</b></div>
          <div>التاريخ: <b>${dateStr}</b></div>
          <div>الدرجة الكاملة: <b>${A.full}</b></div>
        </div>

        <div class="rep-band">${esc(rcGet('period') || 'كل الفترات')}</div>

        ${miss.length ? `
        <div style="border:1.5px solid #C88A2E;background:#FFFBF2;border-radius:8px;
                    padding:.5rem .7rem;margin-bottom:.55rem;font-size:.88rem;color:#7A5A18">
          <b>ملاحظة:</b> الإحصائيات محسوبة من <b>${n}</b> طالبًا سلّموا من أصل <b>${nAll}</b>
          (${subRate}%). و<b>${miss.length}</b> ${miss.length===1?'طالب لم يسلّم'
            :miss.length===2?'طالبان لم يسلّما':'طلاب لم يسلّموا'} — غير محسوبين في المتوسط.
        </div>` : ''}

        <div class="rep-sec">الإحصائيات التفصيلية</div>
        <div class="rep-box">
          <div class="rep-grid">
            <table class="rt">
              <thead><tr><th>المستوى</th><th>النطاق</th><th>عدد الطلاب</th></tr></thead>
              <tbody>
                ${BANDS.map((b,i)=>`<tr>
                  <td class="lv" style="background:${b.color}">${b.name}</td>
                  <td>${rangeOf(b,i)}</td>
                  <td>${counts[b.key]}</td></tr>`).join('')}
                ${miss.length ? `<tr>
                  <td class="lv" style="background:#5A6B84">لم يسلّم</td>
                  <td>—</td>
                  <td><b>${miss.length}</b></td></tr>` : ''}
              </tbody>
            </table>
            <div class="rst">
              <div><span>عدد الطلاب</span><span>${nAll}</span></div>
              <div><span>سلّـــم</span><span>${n} (${subRate}%)</span></div>
              <div><span>أعلـــى درجـــــة</span><span>${Math.max(...scores)}</span></div>
              <div><span>أقـــل درجــــــة</span><span>${Math.min(...scores)}</span></div>
              <div><span>متوسط المسلّمين</span><span>${avg}</span></div>
              <div><span>نسبة التحصيل</span><span>${rate}%</span></div>
            </div>
          </div>
        </div>

        <div class="rep-charts">
          <div>
            <div class="rep-sec">رسم بياني (نسب الطلاب لكل تقدير)</div>
            <div class="rep-box" style="display:flex;gap:.7rem;align-items:center">
              <div class="leg" style="flex:1">
                ${BANDS.map(b=>`<div><i style="background:${b.color}"></i>
                  <span style="flex:1">${b.name.replace(/ـ/g,'')}</span>
                  <b>${n?Math.round(counts[b.key]/n*100):0}%</b></div>`).join('')}
              </div>
              <div class="donut" style="background:conic-gradient(${stops})">
                ${(()=>{const top=BANDS.reduce((m,b)=>(counts[b.key]||0)>(counts[m.key]||0)?b:m,BANDS[0]);return `<b><span>${n?Math.round((counts[top.key]||0)/n*100):0}%</span><small>${top.name.replace(/ـ/g,'')}</small></b>`})()}
              </div>
            </div>
          </div>
          <div>
            <div class="rep-sec">رسم بياني (عدد الطلاب حسب تقديرهم)</div>
            <div class="rep-box">
              <div class="bars">
                ${BANDS.slice().reverse().map(b=>`<div class="b">
                  <em>${counts[b.key]}</em>
                  <i style="height:${counts[b.key]/maxC*100}%;background:${b.color}"></i></div>`).join('')}
              </div>
              <div class="blab">
                ${BANDS.slice().reverse().map(b=>`<span>${b.name.replace(/ـ/g,'')}</span>`).join('')}
              </div>
            </div>
          </div>
        </div>

        ${(MODE==='full' && A.items.length && A.items.length<=25) ? `
        <div class="rep-sec">خريطة الفصل (طالب × مهمة)</div>
        <div class="rep-box" style="overflow-x:auto">
          ${(()=>{
            const hs = A.hws;
            const cells = [];
            A.rows.forEach(r=>{
              const row = [];
              hs.forEach(h=>{
                const v = (h.subs||{})[r.s.id];
                const d = v ? String(v.d||'') : '';
                (h.qs||[]).forEach((q,i)=>{
                  row.push(!v ? null : (d[i]==='1'));
                });
              });
              cells.push({ nm:r.s.name, row });
            });
            const cols = cells.length ? cells[0].row.length : 0;
            if(!cols) return '<p class="muted">لا بيانات</p>';
            return `<table class="heat">
              <thead><tr><th class="nm">الطالب</th>
                ${Array.from({length:cols},(_,i)=>`<th>${i+1}</th>`).join('')}</tr></thead>
              <tbody>${cells.map(c=>`<tr><td class="nm">${esc(c.nm)}</td>
                ${c.row.map(v=> v===null
                  ? '<td style="background:#F0F0F0;color:#BBB">—</td>'
                  : v ? '<td style="background:#CFEBDD;color:#1B7A55">✓</td>'
                      : '<td style="background:#FADCE0;color:#C43">✗</td>').join('')}
              </tr>`).join('')}</tbody></table>
            <div style="margin-top:.5rem;font-size:.74rem;color:#666;text-align:center">
              <span style="color:#1B7A55">✓ صحيح</span> ·
              <span style="color:#C43">✗ خطأ</span> ·
              <span style="color:#999">— لم يسلّم</span> ·
              عمود أحمر = مهمة صعبة على الجميع · صف أحمر = طالب يحتاج دعماً
            </div>`;
          })()}
        </div>` : ''}

        ${(MODE==='full' && A.items.length>25) ? `<div class="muted" style="font-size:.8rem;margin-bottom:.6rem">خريطة الفصل تُعرض حتى 25 مهمة — عدد المهام الحالي ${A.items.length}.</div>` : ''}

        ${(MODE==='brief' && A.items.length) ? `
        <div class="rep-sec">أصعب المهام</div>
        <div class="rep-box">
          ${A.items.slice(0,3).map((x,i)=>{
            const c = x.pct < 50 ? '#EE5A6F' : x.pct < 75 ? '#F0932B' : '#4CAF7D';
            return `<div class="hb">
              <span class="nm" title="${esc(x.fullTitle||x.title)}">${i+1}. ${esc(x.title)}</span>
              <span class="tr"><i style="width:${Math.max(x.pct,2)}%;background:${c}"></i></span>
              <span class="vv" style="color:${c}">${x.pct}%</span></div>`;
          }).join('')}
        </div>` : ''}

        <div class="rep-foot">
          <div>المعلم: <b>${esc(rcGet('teacher') || '—')}</b></div>
          <div>مدير المدرسة: <b>${esc(rcGet('principal') || '—')}</b></div>
        </div>
      </div>
    </div>

    ${(MODE==='full' && A.items.length) ? `
    <div class="rep-page">
      ${head('(تحليل المهام)')}
      <div class="rep-in">
        <div class="rep-band">مرتّبة من الأصعب إلى الأسهل — راجع المهام الحمراء في الحصة</div>

        <div class="rep-sec">رسم بياني (نسبة من حلّ كل مهمة صحيحاً)</div>
        <div class="rep-box">
          ${A.items.map((x,i)=>{
            const c = x.pct < 50 ? '#EE5A6F' : x.pct < 75 ? '#F0932B' : '#4CAF7D';
            return `<div class="hb">
              <span class="nm" title="${esc(x.fullTitle||x.title)}">${i+1}. ${esc(x.title)}</span>
              <span class="tr"><i style="width:${Math.max(x.pct,2)}%;background:${c}"></i></span>
              <span class="vv" style="color:${c}">${x.pct}%</span>
            </div>`;
          }).join('')}
          <div style="display:flex;justify-content:space-between;font-size:.7rem;color:#888;
                      padding:.3rem 52px .1rem 178px;border-top:1px solid #E3EBE9;margin-top:.4rem">
            <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
          </div>
        </div>

        <div class="rep-sec">تفصيل المهام</div>
        <div class="muted" style="font-size:.8rem;margin:-.2rem 0 .5rem">تُعرض هنا المهام التي أجاب عنها طالب واحد على الأقل.</div>
        <table class="rt" style="border:1px solid #D8E3E0;border-top:none">
          <thead><tr>
            <th style="width:40px">م</th><th>المهمة</th>
            <th style="width:110px">النشاط</th><th style="width:88px">النوع</th>
            <th style="width:76px">حلّها</th><th style="width:88px">النسبة</th>
          </tr></thead>
          <tbody>
            ${A.items.map((x,i)=>{
              const c = x.pct < 50 ? '#EE5A6F' : x.pct < 75 ? '#F0932B' : '#4CAF7D';
              return `<tr>
                <td>${i+1}</td>
                <td style="text-align:start" title="${esc(x.fullTitle||x.title)}">${esc(x.title)}</td>
                <td style="font-size:.76rem">${esc(x.h.title)}</td>
                <td style="font-size:.76rem">${esc(KIND_NAME[x.k]||x.k)}</td>
                <td>${x.right} / ${x.tot}</td>
                <td style="background:${c}22;color:${c};font-weight:700">${x.pct}%</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        <div style="margin-top:.7rem;font-size:.8rem;color:#555;text-align:center">
          <span style="color:#EE5A6F;font-weight:700">أحمر</span> أقل من 50% ·
          <span style="color:#F0932B;font-weight:700">برتقالي</span> 50–74% ·
          <span style="color:#4CAF7D;font-weight:700">أخضر</span> 75% فأكثر
        </div>
        <div class="rep-foot">
          <div>المعلم: <b>${esc(rcGet('teacher') || '—')}</b></div>
          <div>مدير المدرسة: <b>${esc(rcGet('principal') || '—')}</b></div>
        </div>
      </div>
    </div>` : ''}

    ${MODE==='full' ? `
    <div class="rep-page">
      ${head('(قائمة الطلاب)')}
      <div class="rep-in">
        <table class="rt">
          <thead><tr><th style="width:44px">م</th><th>اسم الطالب</th><th style="width:80px">الدرجة</th><th style="width:105px">التقدير</th></tr></thead>
          <tbody>
            ${A.rows.map((r,i)=>`<tr>
              <td>${i+1}</td>
              <td style="text-align:start">${esc(r.s.name)}</td>
              <td>${r.noSub?'—':r.got}</td>
              <td style="background:${r.noSub?'#5A6B84':r.band.color}22;color:${r.noSub?'#5A6B84':r.band.color};font-weight:700">${r.noSub?'لم يسلّم':r.band.name.replace(/ـ/g,'')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div class="rep-foot">
          <div>المعلم: <b>${esc(rcGet('teacher') || '—')}</b></div>
          <div>مدير المدرسة: <b>${esc(rcGet('principal') || '—')}</b></div>
        </div>
      </div>
    </div>` : ''}
  </div>`;
}

/* ═══════════════ البيانات ═══════════════ */
/* 📤 تنبيه الأنشطة غير المنشورة */
function renderPubWarn(){
  const box = document.getElementById('pub-warn'); if(!box) return;
  const ready = HW.filter(h => activityReady(h) && !h.published);
  const stale = HW.filter(h => activityReady(h) && h.published && h.dirty);
  if(!ready.length && !stale.length){ box.innerHTML = ''; return; }
  box.innerHTML = `
    <div class="sheet" style="background:rgba(214,69,91,.07);border:1.5px solid var(--pen);margin-bottom:.9rem">
      <div class="row" style="gap:.6rem;flex-wrap:wrap">
        <b style="color:var(--pen)">📤 ${
          ready.length && stale.length ? `${ready.length} نشاط لم يُنشر · ${stale.length} بحاجة إعادة نشر`
          : ready.length ? `${ready.length} نشاط جاهز لم يُنشر بعد`
          : `${stale.length} نشاط عدّلته ولم تُعد نشره`}</b>
      </div>
      <p style="margin:.4rem 0 0;color:var(--ink-soft);font-size:.83rem">
        ${stale.length ? 'الطلاب يرون النسخة القديمة حتى تُعيد النشر. ' : ''}اضغط زر النشر على النشاط.
      </p>
      <div class="row" style="gap:.35rem;margin-top:.5rem;flex-wrap:wrap">
        ${[...ready,...stale].slice(0,6).map(h=>
          `<button class="btn pen sm" onclick="openLink('${h.id}')">${esc(h.title)}</button>`).join('')}
      </div>
    </div>`;
}

/* 💾 تذكير النسخ الاحتياطي — يظهر بعد 7 أيام أو 3 أنشطة جديدة */
const K_BK = 'hwapp_lastbackup_v1';
function renderBackupWarn(){
  const box = document.getElementById('backup-warn'); if(!box) return;
  if(!STUDENTS.length && !HW.length){ box.innerHTML=''; return; }
  const last = +(localStorage.getItem(K_BK) || 0);
  const days = last ? Math.floor((Date.now()-last)/86400000) : 999;
  if(days < 30){ box.innerHTML=''; return; }   // الخادم ينسخ أسبوعيًا تلقائيًا؛ نسخة على الجهاز شهريًا تكفي
  box.innerHTML = `
    <div class="sheet" style="background:rgba(46,107,184,.07);border:1.5px solid #2E6BB8;margin-bottom:.9rem">
      <div class="row" style="gap:.6rem;flex-wrap:wrap">
        <b style="color:#2E6BB8">💾 ${last ? `مرّ ${days} يوماً على آخر نسخة كاملة على جهازك` : 'لم تحفظ نسخة كاملة على جهازك بعد'}</b><small style="display:block;color:var(--ink-soft);font-size:.78rem">الخادم يأخذ نسخة كل جمعة تلقائيًا؛ هذه نسخة إضافية على جهازك للاحتياط.</small>
        <span class="spacer"></span>
        <button class="btn tick sm" onclick="backupDownloadFull()">⬇️ نسخة كاملة</button>
        <button class="btn ghost sm" onclick="snoozeBackup()">لاحقاً</button>
      </div>
    </div>`;
}
/* 💾 النسخ الاحتياطية (الخادم) */
const BK_KIND = { auto:'تلقائية', manual:'يدوية', 'pre-restore':'قبل استعادة' };
function bkApi(){ return (getApi()||'').replace(/\/+$/,''); }
function bkDate(ms){ try{ return new Date(ms).toLocaleString('ar-SA-u-ca-gregory',{weekday:'long',day:'numeric',month:'long',hour:'numeric',minute:'2-digit'}); }catch(e){ return new Date(ms).toISOString(); } }
function bkSize(b){ b=Number(b)||0; return b>=1048576?(b/1048576).toFixed(1)+' م.ب':(b/1024).toFixed(0)+' ك.ب'; }
async function backupLoad(){
  const box=document.getElementById('backup-list'); if(!box) return;
  const api=bkApi(), tok=getTok(); if(!api||!tok){ box.innerHTML='<p class="muted">اضبط عنوان الخادم وكلمة السر أولًا.</p><button class="btn sm" type="button" onclick="window.settingsCat&&window.settingsCat(\'links\')">ضبط الخادم</button>'; return; }
  try{
    const j=await (await fetch(api+'/backup/list?t='+encodeURIComponent(tok))).json();
    if(!j.ok) throw 0;
    const L=j.list||[];
    box.innerHTML=(j.lastError?`<p class="muted" style="color:#B45309">⚠️ فشلت آخر نسخة تلقائية (${esc(bkDate(j.lastError.at))}): ${esc(j.lastError.error)}</p>`:'')
      +(L.length?L.map(x=>`<div class="bk-row"><div><b>${esc(bkDate(x.at))}</b><small>${BK_KIND[x.kind]||x.kind} · ${x.students||0} طالب · ${x.activities||0} نشاط · ${bkSize(x.size)}</small></div>
        <div class="bk-btns"><button class="btn ghost sm" type="button" onclick="backupDownload('${esc(x.id)}')" aria-label="تنزيل النسخة" title="تنزيل النسخة">⬇️</button><button class="btn ghost sm" type="button" onclick="backupRestoreId('${esc(x.id)}','${esc(bkDate(x.at))}')">↩️ استعادة</button></div></div>`).join('')
        :'<p class="muted">لا توجد نسخ في الخادم بعد — أول نسخة تلقائية يوم الجمعة، أو اضغط «📸 نسخة في الخادم الآن».</p>');
  }catch(e){ box.innerHTML='<p class="muted">تعذّر تحميل قائمة النسخ.</p><button class="btn sm" type="button" onclick="backupLoad()">↻ إعادة المحاولة</button>'; }
}


/* ══════════════════════════════════════════════
   ميزات الواجهة الإضافية — محلية فقط
   ══════════════════════════════════════════════ */

const K_ALERTS_UI = {
  dismissed: 'hwapp_ui_dismissed_alerts_v1'
};

let DISMISSED_ALERTS = load(K_ALERTS_UI.dismissed, {});

function alertKey(parts){
  return parts.filter(Boolean).join('|');
}

function isAlertDismissed(key){
  return Boolean(key && DISMISSED_ALERTS[key]);
}

function dismissAlert(key){
  if(!key) return;

  // تنبيه السرعة المريبة يُحفظ لكل طالب على حدة.
  // لذلك الطلاب الذين عولجوا لا يعودون، بينما يظهر أي طالب سريع جديد لاحقًا.
  const alert = dashboardAlerts().find(a=>a.key===key);
  if(alert && Array.isArray(alert.studentAlertKeys) && alert.studentAlertKeys.length){
    const stamp=Date.now();
    alert.studentAlertKeys.forEach(k=>{ if(k) DISMISSED_ALERTS[k]=stamp; });
  }else{
    DISMISSED_ALERTS[key] = Date.now();
  }

  uiSave(K_ALERTS_UI.dismissed, DISMISSED_ALERTS);
  // سجّل التغيير كعملية محلية معلّقة حتى يؤكده الخادم.
  if(alert && Array.isArray(alert.studentAlertKeys) && alert.studentAlertKeys.length){
    alert.studentAlertKeys.forEach(k=>{ if(k) _dismissedAlertPending[k]=true; });
  }else{
    _dismissedAlertPending[key] = true;
  }
  pushState();            // ☁️ ليختفي على كل أجهزتك
  renderDashboard();
  toast('تمت إزالة التنبيه من القائمة', 'good');
}


const K_UI = {
  goals:'hwapp_ui_goals_v1',
  theme:'hwapp_ui_theme_v1'
};
let UI_THEME = load(K_UI.theme, 'light');

function uiSave(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch{ return false; }
}

function initials(name){
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0,2).map(x=>x[0]).join('') || 'ط').toUpperCase();
}

function pct(n,d){
  return d ? Math.max(0, Math.min(100, Math.round(n/d*100))) : 0;
}

/* 🎯 احتساب موحّد لملفات المشاريع
   ملفات المشاريع لا تحتوي أسئلة/إجابات، لذلك correct/total لا يصلحان لاحتساب الدرجة.
   مقبول = الدرجة الكاملة، قيد المراجعة = لا درجة بعد، مرفوض = صفر.
*/
function projectFileGrade(h,v){
  if(!h || h.kind!=='files' || !h.projectGraded || !v) return null;
  // الغائب = مقبول، توحيدًا مع projectReviewStatus() في تبويب المشاريع (م9)
  const status=String(v.reviewStatus||'accepted').toLowerCase();
  if(status==='accepted') return Number(h.max||20);
  if(status==='rejected') return 0;
  return null;
}
/* 🧭 سياسة كل نوع نشاط — مصدر واحد للتنبيهات والإحصاءات:
   • perf: هل تدخل درجته في «متوسط الإنجاز» وتنبيه ضعف الأداء؟
   • fastSecs: أقل زمن معقول للحل؛ null = لا معنى لتنبيه السرعة لهذا النوع.
   الألعاب مصممة لتُنهى بسرعة، والأنماط استبانة بلا إجابة صحيحة، والمشاريع
   بلا زمن حل — فلا تُعامل كأنشطة أسئلة. */
function activityKindPolicy(h){
  const k=String(h?.kind||'normal');
  const qn=(h?.qs||[]).length;
  if(k==='games'||k==='game') return {kind:'games', icon:'🎮', perf:false, score:false, fastSecs:null, doneText:'لُعبت'};
  if(k==='files') return {kind:'files', icon:'📎', perf:!!h.projectGraded, score:!!h.projectGraded, fastSecs:null, doneText:'سُلّم'};
  if(k==='lab') return {kind:'lab', icon:'🔬', perf:true, score:true, fastSecs:null, doneText:'أُجريت'};
  if(k==='style') return {kind:'style', icon:'🧠', perf:false, score:false, fastSecs:null, doneText:'اكتمل'};
  if(k==='diag') return {kind:'diag', icon:'🔍', perf:false, score:true, fastSecs:qn?qn*4:null, rule:'4 ثوانٍ للسؤال'};
  if(k==='reading'){
    // القراءة تحتاج وقتًا قبل الأسئلة: نحو 300 كلمة في الدقيقة كحد أدنى متسامح
    const words=String(h?.reading?.text||h?.rt?.text||'').split(/\s+/).filter(Boolean).length;
    const readSecs=Math.round(words/5);
    return {kind:'reading', icon:'📖', perf:true, score:true, fastSecs:qn?qn*5+readSecs:null,
            rule:`قراءة ${words} كلمة + 5 ثوانٍ للسؤال`};
  }
  return {kind:'normal', icon:h?.remedial?'🩹':'📝', perf:true, score:true, fastSecs:qn?qn*5:null, rule:'5 ثوانٍ للمهمة'};
}
function isSuspiciouslyFast(h,v){
  const pol=activityKindPolicy(h);
  if(!pol.fastSecs || !v || v.manual) return false;
  const secs=Number(v.secs)||0;
  return secs>0 && secs<pol.fastSecs;
}
function activityGrade(h,v){
  if(!v) return null;
  if(h && h.kind==='files') return projectFileGrade(h,v);
  const hMax=Number(h?.max||20);
  return v.manualGrade !== undefined ? Number(v.manualGrade) : Math.round(hMax*(Number(v.correct)||0)/Math.max(1,Number(v.total)||1));
}
function activityGradeLabel(h,v){
  if(!v) return '—';
  if(h?.kind==='files' && h.projectGraded){
    // الغائب = مقبول، توحيدًا مع projectReviewStatus() في تبويب المشاريع (م9)
    const st=String(v.reviewStatus||'accepted').toLowerCase();
    if(st==='pending') return 'قيد المراجعة';
    if(st==='accepted') return `${Number(h.max||20)}/${Number(h.max||20)}`;
    if(st==='rejected') return `0/${Number(h.max||20)}`;
  }
  const g=activityGrade(h,v);
  return Number.isFinite(g) ? `${g}/${Number(h?.max||20)}` : '—';
}

function activityStats(){
  const all = [];
  HW.forEach(h=>{
    if(!remPublished(h)) return;   // المسودات خارج نسب التسليم
    const scope = hwPool(h);
    const total = scope.length;
    const done = scope.filter(s=>h.subs && h.subs[s.id]).length;
    const scores = scope.map(s=>activityGrade(h,h.subs&&h.subs[s.id])).filter(v=>Number.isFinite(v));
    const avg = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
    all.push({h,total,done,avg});
  });
  return all;
}

function studentStats(s){
  // المسودات خارج العدّ (م3): كما في activityStats وgetStudentMissingActivities
  const acts = HW.filter(h=>hwFor(h, s.cls) && remPublished(h));
  let done=0, score=0, max=0, last=0;
  acts.forEach(h=>{
    const v=h.subs && h.subs[s.id];
    if(!v) return;
    done++;
    const hm=Number(h.max||20);
    // الأنماط (بلا إجابة صحيحة) والألعاب والتشخيصي لا تُحسب ضمن الإنجاز
    const g=activityKindPolicy(h).perf ? activityGrade(h,v) : null;
    if(Number.isFinite(g)){ score += g; max += hm; }
    if(v.at && v.at>last) last=v.at;
  });
  return {acts,done,score,max,pct:pct(score,max),last};
}

function dashboardAlerts(){
  const alerts=[];
  const now=new Date();

  HW.forEach(h=>{
    const scope=hwPool(h);
    const missing=scope.filter(s=>!(h.subs&&h.subs[s.id]));

    const pub=remPublished(h);   // المسودة لم يرها الطلاب — لا تُعد متأخرة
    if(pub && h.due && new Date(h.due+'T23:59:59') < now && missing.length){
      // 🔑 المفتاح ثابت على النشاط — لا يتغيّر بتغيّر قائمة المتأخرين
      const key=alertKey(['missing-overdue',h.id]);
      if(!isAlertDismissed(key)){
        const gamesKind=activityKindPolicy(h).kind==='games';
        alerts.push({
          key,
          kind:gamesKind?'warn':'danger',
          icon:gamesKind?'🎮':'⏰',
          title:gamesKind?`${missing.length} طالب لم يلعب`:`${missing.length} طالب لم يسلّم`,
          text:`نشاط «${h.title}» انتهى موعده.`,
          action:'عرض الطلاب',
          activityId:h.id,
          students:missing.map(s=>({id:s.id,name:s.name,cls:s.cls||''}))
        });
      }
    }else if(pub && h.due && missing.length && (new Date(h.due+'T23:59:59')-now)<48*3600000){
      const key=alertKey(['missing-soon',h.id]);
      if(!isAlertDismissed(key)){
        alerts.push({
          key,
          kind:'warn',
          icon:'⚠️',
          title:`موعد قريب: ${h.title}`,
          text:`متبقّي ${missing.length} طالب بدون تسليم.`,
          action:'عرض الطلاب',
          activityId:h.id,
          students:missing.map(s=>({id:s.id,name:s.name,cls:s.cls||''}))
        });
      }
    }

    if(h.dirty){
      const key=alertKey(['dirty',h.id]);
      if(!isAlertDismissed(key)){
        alerts.push({
          key,
          kind:'warn',
          icon:'🔄',
          title:'نشاط يحتاج إعادة نشر',
          text:`«${h.title}» تم تعديله بعد آخر نشر.`,
          action:'فتح النشاط',
          activityId:h.id
        });
      }
    }

    // المحتوى الناقص حسب النوع: المشروع لا يحتاج أسئلة، والألعاب تحتاج محتوى اللعبة
    if(!activityReady(h)){
      const key=alertKey(['empty',h.id]);
      if(!isAlertDismissed(key)){
        const games=activityKindPolicy(h).kind==='games';
        alerts.push({
          key,
          kind:'warn',
          icon:games?'🎮':'📝',
          title:games?'لعبة محتواها غير مكتمل':'نشاط بلا مهام',
          text:games?`«${h.title}»: ${activityEmptyMsg(h)}`:`«${h.title}» لم تتم إضافة أسئلة له بعد.`,
          action:'فتح النشاط',
          activityId:h.id
        });
      }
    }
  });

  HW.forEach(h=>{
    const pol=activityKindPolicy(h);
    if(!pol.fastSecs) return;   // ألعاب · أنماط تعلّم · مشاريع: لا تنبيه سرعة

    const fast=[];
    Object.entries(h.subs||{}).forEach(([sid,v])=>{
      if(isSuspiciouslyFast(h,v)){
        const st=byId(sid);
        if(st){
          const studentKey=alertKey(['fast-student',h.id,st.id]);
          // كل طالب حالة مستقلة حتى لا يعود التنبيه بعد ظهور طالب سريع جديد.
          if(!isAlertDismissed(studentKey)){
            fast.push({
              id:st.id,name:st.name,cls:st.cls||'',secs:v.secs,
              alertStudentKey:studentKey
            });
          }
        }
      }
    });

    if(fast.length){
      fast.sort((a,b)=>a.secs-b.secs);
      const ids=fast.map(x=>x.id).sort();
      const key=alertKey(['fast',h.id]);
      alerts.push({
        key,
        kind:'danger',
        icon:'⚡',
        title:`${fast.length} ${fast.length===1?'طالب أنهى':fast.length===2?'طالبان أنهيا':'طلاب أنهوا'} «${h.title}» بسرعة مريبة`,
        text:`أقل من الحد المعقول (${pol.rule} ≈ ${pol.fastSecs} ثانية).`,
        action:'عرض الطلاب',
        activityId:h.id,
        students:fast,
        studentAlertKeys:fast.map(x=>x.alertStudentKey)
      });
    }
  });

  (typeof deviceAudit==='function' ? deviceAudit() : []).forEach(x=>{
    const students=x.names.map(([nm])=>{
      const st=STUDENTS.find(y=>y.name===nm);
      return st ? {id:st.id,name:st.name,cls:st.cls||''} : {id:'',name:nm,cls:''};
    });
    const ids=students.map(s=>s.id||s.name).sort();
    const key=alertKey(['device', x.dv || ids[0]]);

    if(!isAlertDismissed(key)){
      const acts=[...new Set(x.names.flatMap(([,a])=>a))].join('، ');
      alerts.push({
        key,
        kind:'danger',
        icon:'🚩',
        title:`جهاز واحد استُخدم لـ ${students.length} طلاب`,
        text:acts ? `الأنشطة: ${acts}` : 'تم رصد استخدام نفس الجهاز لأكثر من طالب.',
        action:'عرض الطلاب',
        students
      });
    }
  });

  STUDENTS.forEach(s=>{
    const st=studentStats(s);
    if(st.done>=2 && st.pct<50){
      const key=alertKey(['low-performance',s.id]);
      if(!isAlertDismissed(key)){
        alerts.push({
          key,
          kind:'danger',
          icon:'📉',
          title:s.name,
          text:`متوسط الإنجاز ${st.pct}% — قد يحتاج دعمًا.`,
          action:'فتح ملف الطالب',
          students:[{id:s.id,name:s.name,cls:s.cls||''}]
        });
      }
    }
  });

  return alerts.slice(0,10);
}


function renderDashboardAlerts(alerts){
  const box=document.getElementById('dash-alerts');
  if(!box) return;

  window.__dashAlertsLen=alerts.length;
  updateAttentionCount();

  if(!alerts.length){
    box.innerHTML=`
      <div class="alert-empty">
        <span>🎉</span>
        <span>لا توجد حالات تحتاج تدخلاً الآن.</span>
      </div>`;
    return;
  }

  const levelLabel=kind=>kind==='danger'?'عاجل':kind==='warn'?'متابعة':'جيد';

  box.innerHTML=alerts.map(a=>{
    const students=Array.isArray(a.students) ? a.students : [];
    const isMissing=a.key?.startsWith('missing-overdue|') || a.key?.startsWith('missing-soon|');

    if(isMissing && a.activityId){
      const h=HW.find(x=>x.id===a.activityId);
      const scope=h ? (hwPool(h)) : [];
      const missingCount=students.length;
      const submittedCount=Math.max(0,scope.length-missingCount);
      const submittedPct=scope.length ? Math.round((submittedCount/scope.length)*100) : 0;
      const classCount=new Set(students.map(s=>s.cls||'بدون فصل')).size;

      return `
        <article class="alert ${a.kind} alert-summary-card" data-alert-key="${esc(a.key)}">
          <span class="a-icon" aria-hidden="true">${a.icon}</span>
          <div class="a-body">
            <div class="alert-title-row">
              <div class="alert-title-wrap">
                <b>${esc(h?.title||a.title)}</b>
                <span class="a-level">${levelLabel(a.kind)}</span>
              </div>
              <button class="alert-dismiss" type="button" onclick="dismissAlert('${esc(a.key)}')">✓ تم التعامل</button>
            </div>

            <span class="alert-text">${esc(a.text)}</span>

            <div class="alert-kpis">
              <div>
                <b>${missingCount}</b>
                <span>لم يسلّموا</span>
              </div>
              <div>
                <b>${submittedPct}%</b>
                <span>نسبة التسليم</span>
              </div>
              <div>
                <b>${classCount}</b>
                <span>${classCount===1?'فصل':'فصول'} تحتاج متابعة</span>
              </div>
            </div>

            <div class="alert-progress">
              <div class="progress-track"><i style="width:${submittedPct}%"></i></div>
              <small>${submittedCount} من ${scope.length} سلّموا</small>
            </div>

            <div class="alert-footer">
              <button class="alert-main-action" type="button" onclick="openMissingSummary('${esc(a.activityId)}')">متابعة المتأخرين</button>
              <button class="alert-dismiss-mobile" type="button" onclick="dismissAlert('${esc(a.key)}')">✓ تم التعامل مع الحالة</button>
            </div>
          </div>
        </article>`;
    }

    const preview=students.slice(0,1);
    const rest=Math.max(0,students.length-preview.length);
    const studentPreview=students.length ? `
      <div class="alert-students compact">
        ${preview.map(s=>`
          <div class="alert-student">
            <div class="alert-student-info">
              <span class="alert-student-avatar">${esc(initials(s.name))}</span>
              <div>
                <b>${esc(s.name)}</b>
                ${s.cls ? `<small>${esc(s.cls)}</small>` : ''}
                ${s.secs ? `<small>${Number(s.secs)} ثانية</small>` : ''}
              </div>
            </div>
            ${s.id ? `<div style="display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end">
              <button class="alert-student-open" type="button" onclick="openStudentProfile('${esc(s.id)}')">فتح الملف</button>
              ${a.key.indexOf('fast|')===0 ? `<button class="alert-student-open" type="button" style="border-color:#BFDACE;background:#F5FAF8;color:#0E5B4E" onclick="sendFastReviewRequest('${esc(s.id)}','${esc(a.activityId)}')">📨 إرسال مراجعة</button>` : ''}
            </div>` : ''}
          </div>
        `).join('')}
        ${rest ? `<div class="alert-more">+ ${rest} ${rest===1?'طالب آخر':'طلاب آخرين'}</div>` : ''}
      </div>` : '';

    return `
      <article class="alert ${a.kind}" data-alert-key="${esc(a.key)}">
        <span class="a-icon" aria-hidden="true">${a.icon}</span>
        <div class="a-body">
          <div class="alert-title-row">
            <div class="alert-title-wrap">
              <b title="${esc(a.title)}">${esc(a.title)}</b>
              <span class="a-level">${levelLabel(a.kind)}</span>
            </div>
            <button class="alert-dismiss" type="button" onclick="dismissAlert('${esc(a.key)}')">✓ تم التعامل</button>
          </div>
          <span class="alert-text">${esc(a.text)}</span>
          ${studentPreview}
          <div class="alert-footer">
            ${students.length ? `<button class="alert-main-action" type="button" onclick="openAlertStudentList('${esc(a.key)}')">${esc(a.action||'عرض الطلاب')}</button>` : ''}
            <button class="alert-dismiss-mobile" type="button" onclick="dismissAlert('${esc(a.key)}')">✓ تم التعامل مع الحالة</button>
          </div>
        </div>
      </article>`;
  }).join('');
}

function renderNextActions(){
  const out=document.getElementById('dash-next-actions');
  if(!out) return;

  const stats=activityStats();

  /* الميزة الأولى والأهم:
     أعرض للمعلم نشاطًا واحدًا فقط يحتاج إجراء الآن،
     وهو النشاط المنتهي الذي لديه أكبر عدد من الطلاب غير المسلّمين. */
  const overdue=stats
    .map(x=>{
      const missing=Math.max(0,x.total-x.done);
      return {...x,missing};
    })
    .filter(x=>x.h.due && new Date(x.h.due+'T23:59:59') < new Date() && x.missing>0)
    .sort((a,b)=>{
      if(b.missing!==a.missing) return b.missing-a.missing;
      return new Date(a.h.due)-new Date(b.h.due);
    });

  if(overdue.length){
    const x=overdue[0];
    const h=x.h;
    const cls=hwClasses(h).length ? hwClsLabel(h) : 'عدة فصول';

    out.innerHTML=`
      <div class="feature-item next-action-primary">
        <span class="fi-icon">⏰</span>
        <div class="fi-main">
          <div class="fi-title">ابدأ بمتابعة «${esc(h.title)}»</div>
          <div class="fi-sub">
            ${esc(cls)} · ${x.missing} ${x.missing===1?'طالب لم يسلّم':'طلاب لم يسلّموا'} · انتهى موعد التسليم
          </div>
        </div>
        <div style="display:flex;gap:.45rem;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn sm tick" type="button"
            onclick="openReport('${esc(h.id)}')">متابعة</button>
        </div>
      </div>`;
    return;
  }

  /* إذا لم توجد حالة عاجلة، لا نملأ المساحة باقتراحات ثانوية */
  out.innerHTML=`
    <div class="feature-item">
      <span class="fi-icon">✓</span>
      <div class="fi-main">
        <div class="fi-title">لا توجد أولوية عاجلة الآن</div>
        <div class="fi-sub">لا يوجد نشاط منتهٍ به طلاب لم يسلّموا.</div>
      </div>
    </div>`;
}

function followupCaseKey(s){
  const missing=getStudentMissingActivities(s) || [];
  return missing.map(h=>String(h.id || h.sid || '')).filter(Boolean).sort().join('|');
}

function isFollowupHandled(s){
  const key=followupCaseKey(s);
  return !!(key && s && s.followupHandledKey===key);
}

/* 🔄 الضغط على الشعار أو «مساعد المعلم»: تحديث الصفحة.
   قبلها: تُرسل التعديلات المعلّقة للخادم (بحد 3 ثوانٍ)، وتأكيد إن كانت نافذة تحرير مفتوحة. */
async function brandRefresh(){
  const veil = document.getElementById('veil');
  if(veil && veil.classList.contains('on')){
    if(!(await askConfirm('ستُغلق النافذة المفتوحة، وما لم تحفظه فيها لن يُحفظ.', { title:'تحديث الصفحة؟', yes:'حدّث', no:'رجوع' }))) return;
  }
  document.querySelectorAll('.brand-refresh .mark').forEach(el => el.classList.add('spin'));
  // نتذكّر التبويب الحالي وموضع التمرير، فيعود إليه التحديث بدل «اليوم»
  try{ const t=document.querySelector('.tab.on[data-tab]');
    if(t) sessionStorage.setItem('dash_refresh_tab', JSON.stringify({tab:t.dataset.tab, view:t.dataset.view||'', y:Math.round(scrollY)})); }catch(e){}
  try{ if(getApi() && getTok()) await Promise.race([pushStateNow(), new Promise(r => setTimeout(r, 3000))]); }catch(e){}
  location.reload();
}
document.addEventListener('click', e => { if(e.target.closest && e.target.closest('.brand-refresh')) brandRefresh(); });
/* بعد تحديث الشعار: الرجوع للتبويب الذي كان مفتوحًا (مرة واحدة — الفتح العادي يبدأ من «اليوم») */
document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
  let r=null; try{ r=JSON.parse(sessionStorage.getItem('dash_refresh_tab')||'null'); sessionStorage.removeItem('dash_refresh_tab'); }catch(e){}
  if(!r || !r.tab || (r.tab==='dashboard' && !r.view)) { if(r && r.y) setTimeout(()=>scrollTo(0,r.y),400); return; }
  try{ goTab(r.view ? r.tab+':'+r.view : r.tab); }catch(e){ return; }
  if(r.y) setTimeout(()=>scrollTo(0,r.y),400);
}, 0));
document.addEventListener('keydown', e => { if((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('.brand-refresh')){ e.preventDefault(); brandRefresh(); } });
function markFollowupHandled(studentId){
  const s=byId(studentId);
  if(!s) return;
  const key=followupCaseKey(s);
  if(!key) return;
  s.followupHandledKey=key;
  save(K.st,STUDENTS);
  pushState();
}

function renderFollowupStudents(){
  const out=document.getElementById('dash-followup-students');
  if(!out) return;

  const now=new Date();

  const ranked=STUDENTS.map(s=>{
    let missing=0;
    let overdueTotal=0;

    HW.forEach(h=>{
      if(!remPublished(h)) return;
      if(!hwFor(h, s.cls)) return;
      if(!h.due) return;

      const dueEnd=new Date(h.due+'T23:59:59');
      if(dueEnd>=now) return;

      overdueTotal++;
      const submitted=!!(h.subs && h.subs[s.id]);
      if(!submitted) missing++;
    });

    return {s,missing,overdueTotal};
  })
  .filter(x=>x.missing>0)
  .sort((a,b)=>{
    if(b.missing!==a.missing) return b.missing-a.missing;
    const ap=a.overdueTotal ? a.missing/a.overdueTotal : 0;
    const bp=b.overdueTotal ? b.missing/b.overdueTotal : 0;
    if(bp!==ap) return bp-ap;
    return String(a.s.name||'').localeCompare(String(b.s.name||''),'ar');
  });

  const activeRanked=ranked.filter(x=>!isFollowupHandled(x.s));
  window.__followupRanked=activeRanked;
  // القائمة الكاملة: من لم تُتابعه أولًا، ثم من تابعته (بعلامة) — لا يختفي أحد من «عرض الجميع»
  window.__followupAll=[...activeRanked, ...ranked.filter(x=>isFollowupHandled(x.s))];
  const visible=activeRanked.slice(0,5);
  const handledCount=ranked.length-activeRanked.length;
  const restCount=Math.max(0,ranked.length-visible.length);

  if(!ranked.length){
    out.innerHTML=`
      <div class="feature-item">
        <span class="fi-icon">✓</span>
        <div class="fi-main">
          <div class="fi-title">لا يوجد طلاب يحتاجون متابعة الآن</div>
          <div class="fi-sub">لا توجد أنشطة منتهية لدى الطلاب بدون تسليم.</div>
        </div>
      </div>`;
    return;
  }

  const allHandledNote = !activeRanked.length ? `
      <div class="feature-item">
        <span class="fi-icon">✓</span>
        <div class="fi-main">
          <div class="fi-title">تابعت جميع المتأخرين (${ranked.length})</div>
          <div class="fi-sub">أُرسلت لهم تذكيرات. يعود الطالب لهذه القائمة إذا تأخر في نشاط جديد.</div>
        </div>
      </div>` : '';
  out.innerHTML=allHandledNote + visible.map(x=>{
    const count=x.missing;
    return `
      <div class="feature-item student-row-click" onclick="openStudentProfile('${esc(x.s.id)}')">
        <span class="avatar" style="width:38px;height:38px;font-size:.78rem">${esc(initials(x.s.name))}</span>
        <div class="fi-main">
          <div class="fi-title">${esc(x.s.name)}</div>
          <div class="fi-sub">${esc(x.s.cls||'بدون فصل')} · ${count} ${count===1?'نشاط لم يسلّمه':'أنشطة لم يسلّمها'}</div>
        </div>
        <span class="followup-count">${count}</span>
        <span class="followup-arrow">‹</span>
      </div>`;
  }).join('') + (restCount ? `
      <button class="btn ghost" type="button" style="width:100%;margin-top:.7rem" onclick="openFollowupAllStudents()">عرض جميع الطلاب (${ranked.length})${handledCount?` · ${activeRanked.length ? `${activeRanked.length} لم تُتابَع` : 'كلهم تمت متابعتهم'}`:''}</button>` : '');
}

function renderDashboard(){
  renderReqs();
  renderStorePurchases();
  const stats=activityStats();
  const totalSubs=stats.reduce((n,x)=>n+x.done,0);
  const totalExpected=stats.reduce((n,x)=>n+x.total,0);
  const completion=pct(totalSubs,totalExpected);
  const scored=stats.filter(x=>x.done).map(x=>x.avg/((x.h&&x.h.max)||20)*100);
  const avg=scored.length?Math.round(scored.reduce((a,b)=>a+b,0)/scored.length):0;
  const active=HW.filter(h=>activityReady(h)).length;
  const alerts=dashboardAlerts();

  const statBox=document.getElementById('dash-stats');
  if(statBox){
    statBox.innerHTML=`
      <div class="stat-card"><div class="stat-top"><span class="stat-label">الطلاب</span><span class="stat-icon">👥</span></div><b class="stat-value">${STUDENTS.length}</b><span class="stat-note">${classes().length} فصول</span></div>
      <div class="stat-card"><div class="stat-top"><span class="stat-label">الأنشطة</span><span class="stat-icon">📋</span></div><b class="stat-value">${HW.length}</b><span class="stat-note">${active} جاهز للتسليم</span></div>
      <div class="stat-card"><div class="stat-top"><span class="stat-label">نسبة التسليم</span><span class="stat-icon">✅</span></div><b class="stat-value ${completion>=80?'kpi-good':completion>=50?'kpi-warn':'kpi-bad'}">${completion}%</b><span class="stat-note">${totalSubs} من ${totalExpected}</span></div>
      <div class="stat-card"><div class="stat-top"><span class="stat-label">متوسط الدرجات</span><span class="stat-icon">📈</span></div><b class="stat-value">${avg}%</b><span class="stat-note">${alerts.length ? `${alerts.length} تنبيهات` : 'لا توجد تنبيهات مهمة'}</span></div>`;
  }

  renderDashboardAlerts(alerts);

  const recent=[];
  HW.forEach(h=>Object.entries(h.subs||{}).forEach(([sid,v])=>{
    const st=byId(sid);
    if(st&&v&&v.at) recent.push({st,h,v});
  }));
  recent.sort((a,b)=>{
    const atDiff=(Number(b.v.at)||0)-(Number(a.v.at)||0);
    if(atDiff) return atDiff;
    return String(a.s?.name||'').localeCompare(String(b.s?.name||''),'ar');
  });
  const rb=document.getElementById('dash-recent');
  if(rb){
    rb.innerHTML=recent.slice(0,(typeof tlRows==='function'?tlRows('recent'):7)).map(x=>{   // العدد يتبع طول البطاقة (🧩 ترتيب)
      const isProject=x.h?.kind==='files';
      const ps=String(x.v?.reviewStatus||'accepted').toLowerCase();
      const pendingProject=isProject && ps==='pending';
      const statusHtml=isProject && ps==='pending'
        ? `<button class="recent-project-icon-btn recent-project-review-link" type="button" title="مراجعة تسليم المشروع" aria-label="مراجعة تسليم المشروع" onclick="event.stopPropagation();openRecentProjectSubmission('${String(x.h.id||x.h.sid||'').replace(/'/g, "\\'")}','${String(x.st.id).replace(/'/g, "\\'")}')">🕐</button>`
        : isProject && ps==='accepted'
          ? `<span class="recent-project-icon-btn recent-project-approved" title="معتمد" aria-label="معتمد">✅</span>`
          : isProject && ps==='rejected'
            ? `<span class="recent-project-icon-btn recent-project-rejected" title="مرفوض" aria-label="مرفوض">❌</span>`
            : !activityKindPolicy(x.h).score
              ? `<b style="color:var(--ink-soft);font-weight:700">${activityKindPolicy(x.h).doneText||'سُلّم'}</b>`
              : `<b>${esc(activityGradeLabel(x.h,x.v))}</b>`;
      return `<div class="feature-item student-row-click" data-sub-hw="${esc(String(x.h.id))}" data-sub-sid="${esc(String(x.st.id))}" onclick="openStudentProfile('${String(x.st.id).replace(/'/g,"\\'")}')">
        <span class="fi-icon">${activityKindPolicy(x.h).icon}</span><div class="fi-main"><div class="fi-title">${esc(x.st.name)}</div><div class="fi-sub">${esc(x.h.title)} · <span class="fi-when">${fmtDate(x.v.at)} · ${fmtTime(x.v.at)}</span></div></div>
        ${statusHtml}
      </div>`;
    }).join('') || `<div class="feature-empty">لا توجد تسليمات بعد.</div>`;
  }

  const hs=document.getElementById('dash-hw-summary');
  if(hs) hs.textContent=`${active} نشاط فعّال`;
  renderNextActions();
  renderFollowupStudents();

  const hb=document.getElementById('dash-hw');
  if(hb){
    hb.innerHTML=stats.length ? stats.slice().sort((a,b)=>b.done-a.done).slice(0,8).map(x=>{
      const p=pct(x.done,x.total);
      const pol=activityKindPolicy(x.h);
      // النوع بلا درجة لا يُعرض له متوسط؛ والمشروع المُقيَّم قيد المراجعة لا يُحسب صفرًا
      const graded=Object.values(x.h.subs||{}).map(v=>activityGrade(x.h,v)).filter(Number.isFinite);
      const avgText=!pol.score ? `${pol.icon} ${pol.doneText}`
        : graded.length ? `${Math.round(graded.reduce((a,b)=>a+b,0)/graded.length)}/${x.h.max||20}`
        : pol.kind==='files' ? 'قيد المراجعة' : `0/${x.h.max||20}`;
      return `<div style="margin-bottom:.7rem">
        <div class="row" style="margin-bottom:.25rem"><b style="font-size:.82rem;flex:1">${esc(x.h.title)}</b><span style="font-size:.72rem;color:var(--ink-soft)">${x.done}/${x.total} · ${avgText}</span></div>
        <div class="progress-track"><i style="width:${p}%"></i></div>
      </div>`;
    }).join('') : `<div class="feature-empty">أنشئ أول نشاط ليظهر ملخصه هنا.</div>`;
  }
}


/* منشور فعلًا (له معرّف على الخادم) وجاهز — المسودة لا تدخل التذكير */
function remPublished(h){ return !!h && !!(h.sid||h.published) && activityReady(h); }
function getStudentMissingActivities(s){
  const now=new Date();
  return HW.filter(h=>{
    if(!remPublished(h)) return false;   // المسودة لم يرها الطالب — لا تُذكر له
    if(!hwFor(h, s.cls)) return false;
    if(!h.due) return false;
    if(new Date(h.due+'T23:59:59')>=now) return false;
    return !(h.subs && h.subs[s.id]);
  });
}
/* ⏳ التذكير لما يمكن حله فقط: الواجب المُغلق فات وقته ولا فائدة من تذكيره (يبقى ظاهرًا في رصد مدرستي) */
function madOpenOnly(list){
  const now=Date.now();
  return (list||[]).filter(x=>x && x.st==='pending' && !(x.dueAt && Date.parse(x.dueAt)<=now))
    .sort((a,b)=>(Date.parse(a.dueAt)||Infinity)-(Date.parse(b.dueAt)||Infinity));   // الأقرب إغلاقًا أولًا
}
/* 📚 مدرستي تُغلق الواجب في موعده (لا سماح فيها): نص «يُغلق اليوم 11:59 م / غدًا / الأحد 12/10» بتوقيت السعودية */
function madCloseText(dueAt){
  if(!dueAt) return '';
  const tz={timeZone:'Asia/Riyadh'}, d=new Date(dueAt), now=new Date();
  const key=x=>x.toLocaleDateString('en-CA',tz);
  const diff=Math.round((Date.parse(key(d))-Date.parse(key(now)))/864e5);
  const time=d.toLocaleTimeString('ar-SA',{...tz,hour:'numeric',minute:'2-digit'});
  const day=diff===0?'اليوم':diff===1?'غدًا':d.toLocaleDateString('ar-SA-u-ca-gregory',{...tz,weekday:'long',day:'numeric',month:'numeric'});
  return `يُغلق ${day} الساعة ${time}`;
}
function madUnsolvedLines(list, direct){
  // 🔗 direct (رسالة الطالب فقط): رابط الواجب نفسه في مدرستي تحت عنوانه — من رمز الواجب + رقم المدرسة والمادة في رابط «واجباتي»
  const su=x=>{ const k=typeof madKeyFor==='function'?madKeyFor(x):x.k; return direct&&k&&typeof madSolveUrl==='function'?madSolveUrl(k):''; };
  return list.map(x=>`• ${x.title}${x.st==='pending'?` (${x.dueAt?madCloseText(x.dueAt)+' — بادِر بحله قبل الإغلاق':'ما زال مفتوحًا'})`:' (أُغلق ولم يُحل)'}${su(x)?`\n  ↳ ${su(x)}`:''}`).join('\n');
}

/* 📨 إرسال التذكير للطالب عبر نظام الرسائل نفسه (يصله إشعار تلقائيًا من الخادم) */
/* 🕓 سجل التذكيرات لكل طالب: متى وعبر أي قناة (يُحفظ في سجل الطالب فيُزامَن مع الخادم وأجهزتك).
   التكرار خلال 48 ساعة على القناة نفسها يتطلب ضغطة ثانية للتأكيد — لا نافذة، كي يبقى فتح واتساب ضمن الضغطة. */
const REM_GUARD_MS = 48*3600e3;
const REM_CH = { student:'📲 للطالب', parent:'💬 لولي الأمر' };
function remAgo(at){
  const m = Math.max(1, Math.round((Date.now()-at)/60000));
  if(m < 60) return `قبل ${m} ${m===1?'دقيقة':m===2?'دقيقتين':m<=10?'دقائق':'دقيقة'}`;
  const h = Math.round(m/60); if(h < 24) return `قبل ${h===1?'ساعة':h===2?'ساعتين':h<=10?h+' ساعات':h+' ساعة'}`;
  const d = Math.round(h/24); return `قبل ${d===1?'يوم':d===2?'يومين':d<=10?d+' أيام':d+' يومًا'}`;
}
function remLast(s, ch){ return (Array.isArray(s && s.remLog) ? s.remLog : []).find(x => x && x.ch === ch) || null; }
function remLogAdd(id, ch, via){
  const s = byId(id); if(!s) return;
  s.remLog = [{ at: Date.now(), ch, via: via || '' }, ...(Array.isArray(s.remLog) ? s.remLog : [])].slice(0, 5);
  save(K.st, STUDENTS); pushState();
  const box = document.getElementById('rem-history'); if(box) box.innerHTML = remHistoryHTML(s);
}
function remHistoryHTML(s){
  const st = remLast(s,'student'), pr = remLast(s,'parent');
  if(!st && !pr) return '<span class="rem-hist-none">🕓 لم يُرسل له تذكير من قبل.</span>';
  const f = x => new Date(x.at).toLocaleString('ar-SA-u-ca-gregory',{weekday:'long',day:'numeric',month:'long',hour:'numeric',minute:'2-digit'});
  return '🕓 آخر تذكير: ' + [st && `${REM_CH.student} <b>${remAgo(st.at)}</b> <small>(${f(st)})</small>`, pr && `${REM_CH.parent}${pr.via==='copy'?' (نسخ)':''} <b>${remAgo(pr.at)}</b> <small>(${f(pr)})</small>`].filter(Boolean).join(' · ');
}
function remStudentSummary(s){ const x = (Array.isArray(s && s.remLog) ? s.remLog : [])[0]; return x ? `آخر تذكير ${remAgo(x.at)}` : ''; }

function openStudentProfile(id){
  const s=byId(id); if(!s) return;
  const st=studentStats(s);
  const rows=st.acts.map(h=>{
    const v=h.subs&&h.subs[s.id];
    const pol=activityKindPolicy(h);
    // الألعاب والأنماط بلا درجة، والمشروع قيد المراجعة ليس صفرًا
    const label=!v ? '—'
      : !pol.score ? `<span style="color:var(--ink-soft);font-weight:700">${pol.icon} ${pol.doneText}</span>`
      : pol.kind==='files' ? esc(activityGradeLabel(h,v))
      : esc(activityGradeLabel(h,v));
    return `<div class="feature-item"><span class="fi-icon">${v?pol.icon:'○'}</span><div class="fi-main"><div class="fi-title">${esc(h.title)}</div><div class="fi-sub">${v?fmtDate(v.at):'لم يسلّم بعد'}</div></div><b>${label}</b></div>`;
  }).join('');
  const badgeCount=studentBadges(s).filter(x=>x.unlocked).length;

  openModal(`
    <div class="profile-head"><div class="avatar">${esc(initials(s.name))}</div><div class="ph-main"><h3>${esc(s.name)}<span id="health-badge" hidden aria-label="له حالة صحية مسجلة">🩺</span></h3><span style="font-size:.75rem;color:var(--ink-soft)">${esc(s.cls||'بدون فصل')}</span>
      ${(()=>{ // 🧠 نمط التعلّم من آخر اختبار أنماط
        const sh = styleHW().filter(h=>hwFor(h, s.cls)).slice().sort((a,b)=>(b.at||0)-(a.at||0));
        for(const h of sh){
          const t = styleTally(h, s.id);
          if(t) return `<div style="margin-top:.25rem">
            <span class="pill" style="font-size:.74rem;background:${(STYLE_COLOR[t.top]||'#5A6B84')}1f;color:${STYLE_COLOR[t.top]||'#5A6B84'}"
              title="${esc(t.rows.map(([k,c])=>k+' '+Math.round(c/t.total*100)+'%').join(' · '))}">
              ${STYLE_ICON[t.top]||''} ${esc(t.top)} ${t.topPct}%</span></div>`;
        }
        return '';
      })()}
    </div><button class="btn ghost sm" onclick="openStudentForm('${s.id}');setTimeout(()=>{},0)">✏️ تعديل</button></div>
    <div class="mini-grid">
      <div class="mini-stat"><b>${s.points||0}</b><span>نقطة</span></div>
      <div class="mini-stat"><b>${st.done}/${st.acts.length}</b><span>أنشطة</span></div>
      <div class="mini-stat"><b>${st.pct}%</b><span>الإنجاز</span></div>
    </div>
    <div class="health-box" id="health-box"></div>
    <div class="section-title"><h3>📚 سجل الأنشطة</h3><span>${badgeCount} إنجازات</span></div>
    <div class="feature-list" style="max-height:330px;overflow:auto">${rows||'<div class="feature-empty">لا توجد أنشطة لهذا الطالب.</div>'}</div>
    <div class="student-actions">
      <div class="student-actions-title">
        <h4>🎯 إجراء مع الطالب</h4>
        <span>إجراءات مرتبطة بحالته</span>
      </div>
      <div class="student-actions-grid">
        <button class="btn student-action-btn" type="button" onclick="openStudentReminder('${esc(s.id)}')">
          📨 إرسال تذكير
          <small>${remStudentSummary(s) ? `🕓 ${remStudentSummary(s)}` : 'للطالب بإشعار · ولولي الأمر بواتساب'}</small>
        </button>
        <button class="btn ghost student-action-btn" type="button" onclick="openStudentOverdue('${esc(s.id)}')">
          📋 الأنشطة المتأخرة
          <small>عرض ما يحتاج متابعة</small>
        </button>
        <button class="btn ghost student-action-btn" type="button" onclick="openStudentRetryChooser('${esc(s.id)}')">
          🔓 السماح بإعادة التسليم
          <small>اختر النشاط ثم اسمح بمحاولة إضافية</small>
        </button>
        <button class="btn ghost student-action-btn" type="button" onclick="openBadges('${esc(s.id)}')">
          🏆 إنجازاته
          <small>عرض إنجازات الطالب</small>
        </button>
      </div>
    </div>
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`);
  healthRender(String(s.id));
}

function studentBadges(s){
  const st=studentStats(s);
  const perfect=st.acts.filter(h=>{
    const v=h.subs&&h.subs[s.id]; return v && (v.correct||0)>=Math.max(1,v.total||1);
  }).length;
  return [
    {id:'first',ic:'🌱',name:'البداية',desc:'أكمل أول نشاط',unlocked:st.done>=1},
    {id:'three',ic:'🔥',name:'استمرار',desc:'أكمل 3 أنشطة',unlocked:st.done>=3},
    {id:'five',ic:'🚀',name:'متقدم',desc:'أكمل 5 أنشطة',unlocked:st.done>=5},
    {id:'perfect',ic:'⭐',name:'درجة كاملة',desc:'أتم نشاطًا بلا أخطاء',unlocked:perfect>=1},
    {id:'points',ic:'💰',name:'جامع النقاط',desc:'وصل إلى 100 نقطة',unlocked:(s.points||0)>=100},
    {id:'excellent',ic:'🏅',name:'متميز',desc:'إنجاز 90% فأكثر',unlocked:st.done>=2&&st.pct>=90}
  ];
}

function applyUiTheme(){
  document.documentElement.dataset.uiTheme=UI_THEME;
}

function injectUiTheme(){
  if(document.getElementById('ui-theme-style')) return;
  const st=document.createElement('style');
  st.id='ui-theme-style';
  st.textContent=`
    :root[data-ui-theme="dark"]{
      --paper:#111A2A;--paper-2:#182337;--ink:#EEF2F7;--ink-soft:#A9B8CC;
      --rule:#304158;--ui-bg:#0D1522;--ui-surface:#182337;--ui-surface-2:#111A2A;
      --ui-border:#304158;--ui-border-strong:#40536D;
    }
    :root[data-ui-theme="dark"] body{background:#0D1522;color:#EEF2F7}
    :root[data-ui-theme="dark"] .sheet,
    :root[data-ui-theme="dark"] .stat-card,
    :root[data-ui-theme="dark"] .feature-item,
    :root[data-ui-theme="dark"] .goal-card,
    :root[data-ui-theme="dark"] .badge,
    :root[data-ui-theme="dark"] .alert,
    :root[data-ui-theme="dark"] .mini-stat,
    :root[data-ui-theme="dark"] .profile-head{background:#182337;border-color:#304158}
    :root[data-ui-theme="dark"] .inp{background:#111A2A;color:#EEF2F7}
    :root[data-ui-theme="dark"] .empty,
    :root[data-ui-theme="dark"] .feature-empty{background:#111A2A;border-color:#40536D}
    :root[data-ui-theme="dark"] .gt td.nm{background:#182337}
    :root[data-ui-theme="dark"] .gt tr:hover td{background:#202E43}
    :root[data-ui-theme="dark"] .stat-card .stat-icon,
    :root[data-ui-theme="dark"] .feature-item .fi-icon,
    :root[data-ui-theme="dark"] .profile-head{background:#111A2A}
  `;
  document.head.insertBefore(st, document.getElementById('late-css'));
  applyUiTheme();
}

/* إضافة زر الوضع الليلي في تبويب البيانات بدون تعديل HTML الأساسي */
function addThemeControl(){
  const dataPanel=document.getElementById('p-data');
  if(!dataPanel || document.getElementById('ui-theme-card')) return;
  const card=document.createElement('div');
  card.id='ui-theme-card';
  card.className='sheet';
  card.innerHTML=`<div class="sheet-head"><h2>🎨 مظهر التطبيق</h2></div>
    <p style="margin:0 0 .8rem;color:var(--ink-soft);font-size:.88rem">اختيار المظهر محفوظ على هذا الجهاز فقط.</p>
    <button class="btn ghost" onclick="toggleUiTheme()">🌓 تبديل الوضع الليلي</button>`;
  dataPanel.insertBefore(card,dataPanel.firstElementChild);
}

function enhanceStudentTable(){
  const table=document.querySelector('#st-list table');
  if(!table) return;
  table.querySelectorAll('tbody tr').forEach((tr,i)=>{
    const nameCell=tr.querySelector('td.nm');
    if(!nameCell || tr.dataset.profileBound) return;
    const student=filtered()[i];
    if(!student) return;
    tr.classList.add('student-row-click');
    tr.dataset.profileBound='1';
    tr.addEventListener('dblclick',()=>openStudentProfile(student.id));
    nameCell.title='انقر مرتين لفتح ملف الطالب';
  });
}

/* اجعل Dashboard أول شاشة مع الإبقاء على التبويبات الأصلية */
function activateDashboardDefault(){
  const tabs=document.querySelectorAll('.tab');
  const dash=document.querySelector('.tab[data-tab="dashboard"]');
  if(dash){
    tabs.forEach(t=>t.classList.toggle('on',t===dash));
    document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('on',p.id==='p-dashboard'));
    renderDashboard();
  }
}

/* ربط Dashboard مع الرسم المعتاد */
const _renderAllOriginal = renderAll;
renderAll = function(){
  _renderAllOriginal();
  renderDashboard();
  addThemeControl();
  injectUiTheme();
  enhanceStudentTable();
};

injectUiTheme();


let __reportsHubActive=false;
function openDedicatedReport(view){
  __reportsHubActive=true;
  const reportTab=document.querySelector('.tab[data-tab="reports"]');
  document.querySelectorAll('.tab,.mobile-nav button[data-tab]').forEach(x=>x.classList.toggle('on',x.dataset.tab==='reports'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));
  if(view==='weekly'){
    document.getElementById('p-weekly')?.classList.add('on');
    renderWeekly(false);
  }else if(view==='compan'){
    document.getElementById('p-compan')?.classList.add('on');
    renderCompAnalysis(false);
  }else{
    document.getElementById('p-comprehensive')?.classList.add('on');
    renderComprehensive(false);
  }
  if(reportTab) reportTab.classList.add('on');
  document.querySelectorAll('.mobile-nav button[data-tab="reports"]').forEach(x=>x.classList.add('on'));
  document.querySelectorAll('.report-switch-btn').forEach(btn=>{
    const m=(btn.getAttribute('onclick')||'').match(/switchReportView\('([^']+)'\)/);
    if(m){ btn.classList.toggle('on', m[1]===view); btn.setAttribute('aria-selected', m[1]===view?'true':'false'); }
  });
  if(view==='compan') syncCaModeButtons(caMode());
}


let STUDENT_CENTER_SELECTED = null;


/* ⚡ ذاكرة لرسمة واحدة: الفرز يستدعي الحساب مرتين لكل مقارنة، فـ174 طالبًا
   تعني ~1740 استدعاءً في الرسمة الواحدة. تُمسح مع كل رسمة فلا تتقادم. */
let SC_CACHE = null;
function studentCenterData(s){
  if(SC_CACHE && SC_CACHE.has(s.id)) return SC_CACHE.get(s.id);
  const out = studentCenterDataRaw(s);
  if(SC_CACHE) SC_CACHE.set(s.id, out);
  return out;
}
function studentCenterDataRaw(s){
  const st=studentStats(s);
  const acts=st.acts;
  const missing=acts.filter(h=>!(h.subs&&h.subs[s.id])).length;
  const late=acts.reduce((n,h)=>{
    const v=h.subs&&h.subs[s.id];
    return n+(v&&v.late?1:0);
  },0);
  const avg=st.pct;
  const status=avg>=90?'متميز':avg>=70?'جيد':avg>=50?'يحتاج متابعة':'متعثر';
  return {...st,missing,late,avg,status};
}

function studentAttentionScore(s){
  const d=studentCenterData(s);
  return (d.missing*4)+(d.late*2)+(d.avg<50?8:d.avg<70?4:0);
}

function populateStudentCenterClasses(){
  const sel=document.getElementById('students-center-class');
  if(!sel) return;
  const current=sel.value;
  const cls=[...new Set(STUDENTS.map(s=>s.cls).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'ar'));
  sel.innerHTML='<option value="">كل الفصول</option>'+cls.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if(cls.includes(current)) sel.value=current;
}

let SC_DIR = 'desc';   // ↓ الأعلى أولاً

/* نسبة آخر اختبار تشخيصي للطالب */
function scDiagPct(s){
  const hs = diagHW().filter(h=>hwFor(h, s.cls)).slice().sort((a,b)=>(b.at||0)-(a.at||0));
  for(const h of hs){
    const v = (h.subs||{})[s.id];
    if(v) return Math.round((v.correct||0)/Math.max(1,v.total||1)*100);
  }
  return -1;   // لم يختبر — يقع في الأسفل
}

function renderStudentsCenter(quiet){
  SC_CACHE = new Map();
  populateStudentCenterClasses();
  const q=normAr(document.getElementById('students-center-search')?.value||'');
  const cls=document.getElementById('students-center-class')?.value||'';
  const sort=document.getElementById('students-center-sort')?.value||'name';
  const dir = SC_DIR === 'asc' ? -1 : 1;   // ↓ تنازلي افتراضياً

  let list=STUDENTS.filter(s=>{
    const text=normAr(`${s.name} ${s.cls||''}`);
    return (!q||text.includes(q))&&(!cls||s.cls===cls);
  });

  list.sort((a,b)=>{
    const da=studentCenterData(a), db=studentCenterData(b);
    let r;
    if(sort==='performance')      r = db.pct - da.pct;
    else if(sort==='completion')  r = pct(db.done,db.acts.length) - pct(da.done,da.acts.length);
    else if(sort==='points')      r = (b.points||0) - (a.points||0);
    else if(sort==='missing')     r = (db.acts.length-db.done) - (da.acts.length-da.done);
    else if(sort==='late')        r = (db.late||0) - (da.late||0);
    else if(sort==='diag')        r = scDiagPct(b) - scDiagPct(a);
    else if(sort==='attention')   r = studentAttentionScore(b) - studentAttentionScore(a);
    else {                        // الاسم: أ→ي عند ↓
      return String(a.name||'').localeCompare(String(b.name||''),'ar') * (SC_DIR==='asc' ? -1 : 1);
    }
    if(r === 0) return String(a.name||'').localeCompare(String(b.name||''),'ar');
    return r * dir;
  });

  const count=document.getElementById('students-center-count');
  if(count) count.textContent=`${list.length} طالب من أصل ${(STUDENTS||[]).length}`;
  window.STC_LIST=list.map(s=>String(s.id));   // ترتيب القائمة: للسابق/التالي في ملف الطالب

  const box=document.getElementById('students-center-list');
  if(!box) return;

  box.innerHTML=list.map(s=>{
    const d=studentCenterData(s);
    const active=String(s.id)===String(STUDENT_CENTER_SELECTED);
    const total = d.acts.length;
    const miss  = total - d.done;
    // 🚦 حالة تستحق الانتباه بدل نسبة مكرّرة
    let tone, label;
    if(total && d.done === 0){ tone='bad';  label='لم يسلّم'; }
    else if(miss > 0)        { tone='warn'; label='ناقص '+miss; }
    else if(!total)          { tone='ok';   label='—'; }
    else if(d.pct >= 90)     { tone='good'; label='متميّز'; }
    else if(d.pct >= 50)     { tone='ok';   label='مكتمل'; }
    else                     { tone='warn'; label='يحتاج دعمًا'; }
    return `<button type="button" class="student-list-item ${active?'selected':''}" onclick="selectStudentCenter('${esc(s.id)}',false)">
      <span class="student-list-avatar">${esc(initials(s.name))}</span>
      <span class="student-list-main">
        <b title="${esc(s.name)}">${esc(s.name)}</b>
        <small>${esc(s.cls||'بدون فصل')} · ${d.done}/${total} تسليم${total&&d.done?' · '+d.pct+'%':''}</small>
      </span>
      <span class="student-list-score ${tone}" style="white-space:nowrap">${label}</span>
    </button>`;
  }).join('') || `<div class="feature-empty">لا يوجد طالب مطابق.</div>`;

  if(STUDENT_CENTER_SELECTED && !list.some(s=>String(s.id)===String(STUDENT_CENTER_SELECTED))){
    STUDENT_CENTER_SELECTED=null;
  }
  if(STUDENT_CENTER_SELECTED && list.some(s=>String(s.id)===String(STUDENT_CENTER_SELECTED))){
    renderStudentCenterDetail(quiet?0:'auto');   // البحث والفرز لا يعيدان رسم الملف المفتوح، والتحديثات في الخلفية فقط إن تغيّرت بيانات هذا الطالب
  }else if(list.length){
    STUDENT_CENTER_SELECTED=list[0].id;
    renderStudentCenterDetail(1);
    requestAnimationFrame(()=>{
      document.querySelectorAll('.student-list-item').forEach(el=>el.classList.remove('selected'));
      const target=[...document.querySelectorAll('.student-list-item')].find(el=>el.getAttribute('onclick')?.includes(`'${list[0].id}'`));
      if(target) target.classList.add('selected');
    });
  }
  if(!list.length){ const dp=document.getElementById('student-center-detail'); if(dp) dp.innerHTML=`<div class="student-center-empty"><div class="student-center-empty-icon">👤</div><h3>اختر طالبًا</h3><p>يُفتح هنا ملفه الكامل: النظرة الشاملة، الأنشطة، النقاط، الخط الزمني، التواصل، والتقارير.</p></div>`; }
  SC_CACHE = null;
}

/* ═══════════ 🎮 المسابقات المباشرة — لوحة المعلم ═══════════
   الإنشاء (قالب «مراجعة ما قبل الاختبار») والمراقبة الحية والإلغاء مع الاسترداد.
   الأسئلة من أنشطتك: اختيار من متعدد (t:'q') وصح/خطأ (t:'tf') فقط. كل الحساب في الخادم. */
const LVT = { games: [], monId: null, monTimer: 0, off: 0 };
const LV_ST = { SCHEDULED: ['🗓️', 'مجدولة'], REGISTRATION: ['🟡', 'التسجيل مفتوح'], WAITING: ['⏳', 'بانتظار البداية'], LIVE: ['🟢', 'مباشرة الآن'], FINISHED: ['🏁', 'انتهت'], CANCELLED: ['🚫', 'ملغاة'] };
function lvApi(){ return (getApi() || '').replace(/\/+$/, ''); }
async function lvPost(path, body){
  const r = await fetch(lvApi() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: getTok(), ...(body || {}) }) });
  const j = await r.json().catch(() => ({}));
  if(!r.ok || !j.ok){ const e = new Error(j.error || ('http_' + r.status)); e.j = j; throw e; }
  return j;
}
function lvWhen(ms){ try{ return new Date(ms).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }); }catch(e){ return new Date(ms).toISOString(); } }
function lvChip(st){ const x = LV_ST[st] || ['•', st]; return `<span class="lv-chip lv-${String(st).toLowerCase()}">${x[0]} ${x[1]}</span>`; }
const LV_ERR = { no_questions: 'لا أسئلة صالحة', start_in_past: 'وقت البداية يجب أن يكون بعد دقيقة على الأقل', bad_registration_window: 'فترة التسجيل غير صحيحة', already_started: 'بدأت المسابقة — لا يمكن إلغاؤها', unauthorized: 'كلمة السر غير صحيحة', setup_db: 'قاعدة البيانات (D1) غير مربوطة بالخادم' };

async function liveTLoad(){
  const box = document.getElementById('lv-list'); if(!box) return;
  try{ lvDailyLoad(); }catch(e){}
  if(!lvApi() || !getTok()){ box.innerHTML = '<p class="muted">اضبط عنوان الخادم وكلمة السر أولًا.</p>'; return; }
  try{
    const t0 = Date.now(), j = await lvPost('/live/list'); LVT.off = j.now + (Date.now() - t0) / 2 - Date.now(); LVT.games = j.games || [];
    const active = LVT.games.filter(g => ['LIVE','WAITING','REGISTRATION','SCHEDULED'].includes(g.status)), past = LVT.games.filter(g => !active.includes(g));
    const sec = (title, list, cls) => list.length ? `<div class="lv-sec ${cls}"><h3>${title} <span>${list.length}</span>${cls === 'past' ? `<button type="button" class="lv-delall" onclick="lvDeleteAllPast()">🗑 حذف الكل (${list.length})</button>` : ''}</h3>${list.map(lvRowHTML).join('')}</div>` : '';
    box.innerHTML = LVT.games.length ? sec('القادمة والجارية', active, 'now') + sec('السابقة', past, 'past')
      : '<p class="muted">لا توجد مسابقات بعد — اضغط «➕ مسابقة جديدة».</p>';
    try{ lvDailyBar(); }catch(e){}
  }catch(e){ box.innerHTML = `<p class="muted">تعذّر التحميل${LV_ERR[e.message] ? ': ' + LV_ERR[e.message] : ''}.</p>`; }
}
/* صف مسابقة: مربع الحالة · الاسم وشرائح التفاصيل · الحالة واللاعبون وأيقونة الحذف */
const LV_ICON = { SCHEDULED: '🗓️', REGISTRATION: '📝', WAITING: '⏳', LIVE: '🟢', FINISHED: '🏁', CANCELLED: '🚫' };
const LV_TRASH = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
function lvDay(ms){ try{ return new Date(ms).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' }); }catch(e){ return ''; } }
function lvTime(ms){ try{ return new Date(ms).toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' }); }catch(e){ return ''; } }
function lvRowHTML(g){
  const skin = ({ boss: '👹 وحش الزعيم', shapes: '🎨 الأشكال', balloons: '🎈 بالونات', rocket: '🚀 صواريخ', jumper: '🍄 قفزة البطل', invaders: '👾 غزاة الفضاء', claw: '🕹️ آلة المخلب' })[g.skin] || '🎯 كلاسيكي';
  return `<div class="lv-row st-${String(g.status).toLowerCase()}" onclick="lvMonitor('${esc(g.id)}')" role="button" tabindex="0">
    <div class="lv-ic">${LV_ICON[g.status] || '🎮'}</div>
    <div class="lv-main">
      <b>${esc(g.title)}${/^🔁/.test(g.source || '') ? ' <span class="lvd-tag">🔁 يومية</span>' : ''}</b>
      <div class="lv-meta"><span>📅 ${lvDay(g.startAt)}</span><span>⏰ ${lvTime(g.startAt)}</span><span>❓ ${g.n} ${g.n > 10 ? 'سؤالًا' : 'أسئلة'}</span><span>${g.fee ? `💰 ${g.fee} نقطة` : '🆓 مجانية'}</span><span>${skin}</span>${(g.classes || []).length ? `<span>🏫 ${esc(g.classes.join('، '))}</span>` : ''}</div>
    </div>
    <div class="lv-side">${lvChip(g.status)}<span class="lv-pc" title="اللاعبون">👥 <b>${g.players}</b>${g.maxPlayers ? `<small>/${g.maxPlayers}</small>` : ''}</span></div>
    ${g.status !== 'LIVE' ? `<button class="lv-del" type="button" title="حذف" aria-label="حذف" onclick="event.stopPropagation();lvDelete('${esc(g.id)}')">${LV_TRASH}</button>` : '<span class="lv-del-ph"></span>'}
  </div>`;
}
/* ═══ 🔁 المسابقة اليومية التلقائية: الخادم ينشئها كل يوم في الموعد، بأسئلة عشوائية من كل أنشطتك المنشورة ═══ */
let LVD = null;
const LV_DOW = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
/* 📚 مصدر أسئلة المسابقة اليومية: «auto» كل الأنشطة المنشورة · «pick» أنشطة يحددها المعلم فقط */
const lvActId = h => String(h.sid || h.id || '');
function lvDailyBank(D){
  D = D || LVD || {}; const pick = D.src === 'pick' ? new Set((D.srcIds || []).map(String)) : null;
  const pub = HW.filter(h => h && (h.published || h.sid) && !['nafs', 'style'].includes(h.kind || 'normal') && !(h.nafs && h.nafs.length) && (!pick || pick.has(lvActId(h))));
  const seen = new Set(), bank = []; let acts = 0;
  for(const h of pub){ const qs = lvBankOf(h).filter(q => !/<img|\[صورة|!\[/.test(q.q)); if(qs.length) acts++;
    for(const q of qs){ const k = q.q.replace(/\s+/g, ' '); if(!seen.has(k)){ seen.add(k); bank.push(q); } } }
  return { bank, acts };
}
function lvDailySig(b){ let h = 0; const t = b.map(q => q.q + '|' + q.o.join('|') + '|' + q.a).join('#'); for(let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return b.length + ':' + h; }
async function lvDailyLoad(){
  const el = document.getElementById('lv-daily'); if(!el) return;
  try{ const j = await lvPost('/live/daily', { op: 'get' }); LVD = j.daily || {}; }catch(e){ LVD = null; el.innerHTML = ''; return; }
  // بنك الأسئلة يتبع أنشطتك: إن تغيّرت (نشاط جديد مثلًا) يُرسل الجديد بصمت
  if(LVD.on){ try{ const { bank, acts } = lvDailyBank(), sig = lvDailySig(bank);
    if(bank.length && localStorage.getItem('lvd_sig') !== sig){ const j = await lvPost('/live/daily', { op: 'bank', bank, acts }); LVD = j.daily || LVD; localStorage.setItem('lvd_sig', sig); } }catch(e){} }
  lvDailyBar();
}
/* ⏰ أوقات المسابقة اليومية: حتى 4 مواعيد في اليوم — الطالب يختار الأنسب له */
function lvDailyTimes(D){ const t = (D && Array.isArray(D.times) && D.times.length ? D.times : [(D && D.time) || '20:00']).filter(Boolean); return [...new Set(t)].sort(); }
function lvTime12(t){ const [h, m] = String(t).split(':').map(Number); if(!Number.isFinite(h)) return t; const pm = h >= 12, hh = h % 12 || 12;
  return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'صباحًا' : h < 15 ? 'ظهرًا' : h < 18 ? 'عصرًا' : 'مساءً'}`; }
function lvDailyBar(){
  const el = document.getElementById('lv-daily'); if(!el || !LVD) return;
  const D = LVD, days = (D.days || []).length === 7 ? 'كل يوم' : (D.days || []).map(d => LV_DOW[d]).join('، ') || '—';
  el.innerHTML = `<div class="lvd-bar ${D.on ? 'on' : ''}" onclick="lvDailyOpen()" role="button" tabindex="0">
    <span class="lvd-ic">🔁</span>
    <span class="lvd-tx"><b>المسابقة اليومية التلقائية ${D.on ? '<em>مفعّلة</em>' : '<i>متوقفة</i>'}</b>
      <small>${D.on ? `${days} · ⏰ ${esc(lvDailyTimes(D).map(lvTime12).join(' و '))} · ❓ ${D.n || 10} أسئلة من ${D.bankN || 0} في البنك${D.src === 'pick' ? ` (${(D.srcIds || []).length} ${(D.srcIds || []).length > 10 ? 'نشاطًا محددًا' : 'أنشطة محددة'})` : ''}${D.next ? ` · القادمة: ${lvWhen(D.next)}` : ''}${D.lastErr ? ' · ⚠️ ' + (D.lastErr === 'no_questions' ? 'لا أسئلة في البنك' : esc(D.lastErr)) : ''}` : 'مسابقة كل يوم في وقت ثابت بأسئلة عشوائية من كل دروسك — اضغط للإعداد'}</small></span>
    <span class="lvd-go">${D.on ? '⚙️ تعديل' : 'إعداد ←'}</span></div>${lvDailyLastHTML()}`;
}
/* 📊 آخر مسابقة يومية: حالتها وعدد من لعب، وضغطة تفتح نتائجها */
function lvDailyLastHTML(){
  const G = ((typeof LVT !== 'undefined' && LVT.games) || []).filter(g => /^🔁/.test(g.source || ''));
  if(!G.length) return '';
  const g = G.find(x => !['SCHEDULED','REGISTRATION','WAITING'].includes(x.status)) || G[0], done = G.filter(x => x.status === 'FINISHED').length;
  const why = g.status === 'CANCELLED' ? (g.players ? ' — لم يكتمل الحد الأدنى' : ' — لم يسجّل أحد') : '';
  return `<div class="lvd-last" onclick="lvMonitor('${esc(g.id)}')" role="button" tabindex="0">
    <span>📊 <b>آخر مسابقة يومية:</b> ${lvDay(g.startAt)} · ${lvChip(g.status)} · 👥 <b>${g.players || 0}</b> ${g.players === 1 ? 'لاعب' : 'لاعبين'}${why}${done > 1 ? ` · <small>${done} مسابقات منتهية في القائمة أدناه</small>` : ''}</span>
    <span class="lvd-go">${g.status === 'FINISHED' ? 'النتائج ←' : 'التفاصيل ←'}</span></div>`;
}
/* ── بنك الأسئلة من الأنشطة ── */
function lvBankOf(h){
  const out = [];
  for(const q of (h && h.qs) || []){
    if(!q) continue;
    if(q.t === 'q' && Array.isArray(q.o)){
      const o = q.o.slice(0, 4).map(x => String(x || '').trim()), a = Number(q.a);
      if(String(q.q || '').trim() && o.length >= 2 && o.every(Boolean) && Number.isInteger(a) && a >= 0 && a < o.length) out.push({ q: String(q.q).trim(), o, a });
    } else if(q.t === 'tf' && String(q.q || '').trim()) out.push({ q: String(q.q).trim(), o: ['صح', 'خطأ'], a: q.a === true ? 0 : 1 });
  }
  return out;
}

// مزامنة صلاحيات إعادة التسليم من الخادم، لتكون كل الواجهات متطابقة بعد التحديث.
async function pullExtraAttemptStatus(){
  const api=getApi(), tok=getTok();
  if(!api || !tok || !Array.isArray(HW) || !HW.length || !Array.isArray(STUDENTS)) return;
  try{
    const before=JSON.stringify(HW.map(h=>h.extraAttempts||{}));
    const byName=new Map(STUDENTS.map(s=>[String(s.name||'').trim(),s.id]));
    const apply=(h,grants)=>{ const extra={}; Object.entries(grants||{}).forEach(([name,count])=>{ const id=byName.get(String(name).trim()); if(id && Number(count)>0) extra[id]=Number(count); }); h.extraAttempts=extra; };
    // ⚡ طلب واحد لكل الأنشطة (الخادم الجديد)، وإلا طلب لكل نشاط كما كان
    let all=null;
    try{ const r=await fetch(`${api}/extra-attempt-status?all=1&t=${encodeURIComponent(tok)}`,{cache:'no-store'}); const j=r.ok?await r.json().catch(()=>null):null; if(j&&j.ok&&j.all&&typeof j.all==='object') all=j.all; }catch(e){}
    if(all) HW.forEach(h=>{ const hwId=h.sid||h.id; if(hwId) apply(h, all[hwId]); });
    else await Promise.all(HW.map(async h=>{
      const hwId=h.sid || h.id;
      if(!hwId) return;
      const r=await fetch(`${api}/extra-attempt-status?hwId=${encodeURIComponent(hwId)}&t=${encodeURIComponent(tok)}`);
      if(!r.ok) return;
      const j=await r.json().catch(()=>({}));
      if(!j.ok || !j.grants) return;
      apply(h, j.grants);
    }));
    // بيانات من الخادم نفسه: لا تُعاد رفعًا إليه، ولا رسم إلا إذا تغيّر شيء
    if(JSON.stringify(HW.map(h=>h.extraAttempts||{}))!==before){
      _suppressSyncSave=true; try{ save(K.hw,HW); }finally{ _suppressSyncSave=false; }
      renderAll();
    }
  }catch(e){ console.error('pullExtraAttemptStatus:',e); }
}


/* Run the students-center UI after the application's existing render cycle. */
const _renderAllBeforeStudentsCenter = renderAll;
renderAll = function(){
  _renderAllBeforeStudentsCenter();
  if(document.getElementById('p-students')) renderStudentsCenter();
};


/* ═══════════════ التشغيل ═══════════════ */
function updateMeta() {
  const m = document.getElementById('meta-line'); if(!m) return;
  // عدّاد «N طالب · N نشاط» أُزيل من الشريط العلوي (ماله داعي — الأرقام نفسها في «أرقام عامة»)؛
  // إخفاؤه يزيل أيضًا الهامش التلقائي الثاني الذي كان يبعثر حبوب الشريط، فيبقى الشريط مجموعتين
  // نظيفتين: العلامة يمينًا، وحبوب الفترة/المتصلين/البوابة مجتمعة يسارًا. يبقى فقط تلميح البداية عند عدم وجود طلاب.
  if (STUDENTS.length) { m.style.display='none'; }
  else { m.style.display=''; m.textContent='ابدأ بإضافة الطلاب'; }
}
function renderAll() {
  // كل واجهة مستقلة؛ خطأ في التحليل أو الطلاب لا يجوز أن يمنع Dashboard من الظهور.
  const renderSafely = fn => {
    try { fn(); } catch (error) { console.error('UI render error:', error); }
  };
  renderSafely(renderStudents);
  renderSafely(renderHw);
  renderSafely(renderGrades);
  renderSafely(renderAnalysis);
  renderSafely(updateMeta);
  renderSafely(renderDashboard);
  renderSafely(renderStudentsCenter);
}
(function(){
  const e=document.getElementById('site-url'); if(e) e.value = getSite();
  const pe=document.getElementById('portal-url'); if(pe) pe.value = getPortal();
  syncPortalBtn();
  const a=document.getElementById('api-url');  if(a) a.value = getApi();
  const t=document.getElementById('api-tok');  if(t) t.value = getTok();
})();
loadRepCfg();
activateDashboardDefault();
renderAll();

/* 🔄 مزامنة التسليمات — تعمل من الصفحة الرئيسية وجميع التبويبات */
(async function bootAndSync(){
  let running = false;
  let initialized = false;

  /* ⚡ مزامنة موفّرة:
     - طلب صغير (/rev) يخبر هل تغيّرت بيانات الطلاب والأنشطة (stateAt) أو وصل جديد (rev)
     - لا تُنزّل اللقطة كاملة إلا عند التغيير، ومرة كل 5 دقائق احتياطًا
     - كل 5 ثوانٍ أثناء الاستخدام، وكل دقيقة إذا تُركت اللوحة بلا لمس أو كانت في الخلفية */
  let lastFull=0, lastStateAt=null, lastRevSeen=null, lastActive=Date.now(), timer=0;
  ['pointerdown','keydown','wheel','touchstart'].forEach(t=>addEventListener(t,()=>{ const idle=Date.now()-lastActive>60000; lastActive=Date.now(); if(idle) schedule(0); },{passive:true,capture:true}));
  function schedule(ms){ clearTimeout(timer); timer=setTimeout(tick, ms); }
  function nextDelay(){ return (document.hidden || Date.now()-lastActive>60000) ? 60000 : 5000; }
  async function tick(){ await syncNow(); schedule(nextDelay()); }

  async function syncNow(force){
    if(running || !getApi() || !getTok()) return;

    running = true;

    try{
      let probe=null;
      try{ const r=await fetch(`${getApi()}/rev?t=${encodeURIComponent(getTok())}`,{cache:'no-store'}); if(r.ok) probe=await r.json().catch(()=>null); }catch(e){}
      const stale = Date.now()-lastFull > 5*60000;   // تنزيل كامل احتياطي كل 5 دقائق
      const known = probe && probe.ok && Number(probe.stateAt) > 0;     // الخادم القديم لا يعيد stateAt ⇒ نتصرف كالسابق
      // تغيير الحالة الذي سببه حفظ هذه اللوحة نفسها ليس جديدًا — بياناته عندنا (أي حفظ آخر بعده يغيّر الختم فيُنزَّل)
      if(known && Number(probe.stateAt)===window.__OWN_STATE_AT && initialized && !force && !stale) lastStateAt = Number(probe.stateAt);
      const stateChanged = force || !initialized || stale || !known || Number(probe.stateAt)!==lastStateAt;
      const revChanged = force || !initialized || stale || !probe || !probe.ok || probe.rev!==lastRevSeen;

      if(stateChanged){
        const pulled = await pullState();
        if(!pulled && !initialized) return;
        lastFull = Date.now();
        if(known) lastStateAt = Number(probe.stateAt);
      }
      if(probe && probe.ok) lastRevSeen = probe.rev;

      if(revChanged || stateChanged){
        // نتائج الأنشطة (التسليمات) — مباشرة بلا فحص /rev ثانٍ
        await checkLiveSubmissions(true);
        // المتجر والأرصدة
        await syncStore(true);
        // 💬 رسائل الطلاب (بطاقة صفحة اليوم)
        try{ if(typeof asksLoad==='function' && !(typeof ASK_LAST!=='undefined' && Date.now()-ASK_LAST<5000)) asksLoad(); }catch(e){}   // «اليوم» جلبها للتو: لا طلب ثانٍ
      }

      initialized = true;
    }catch(error){
      console.error('submission sync:', error);
    }finally{
      running = false;
    }
  }

  await ensureToken();
  await syncNow();
  schedule(nextDelay());

  document.addEventListener('visibilitychange', ()=>{
    if(!document.hidden){ lastActive=Date.now(); schedule(0); }
  });

  window.addEventListener('focus', ()=>{ lastActive=Date.now(); schedule(0); });
})();

/* 📋 بعد كل بناء للورقة: تُرتَّب حالة المعاينة (ملخص + ملاحظات عند الطلب) */
(function(){ const o=window.examBuild; if(typeof o==='function') window.examBuild=function(){ try{ return o.apply(this,arguments); } finally { try{ examStatusDecorate(); }catch(e){} } }; })();


/* ═══ 👪 ولي الأمر في ملف الطالب: جواله (من مدرستي أو يدويًا) · واتساب مباشر · رابط تقرير ابنه ═══ */
let PARENTS=null, PARENTS_AT=0;
async function parLoad(force){
  if(!force && PARENTS && Date.now()-PARENTS_AT<60000) return PARENTS;
  try{ const r=await fetch(getApi().replace(/\/+$/,'')+'/parent-phones?t='+encodeURIComponent(getTok())); const j=await r.json(); if(j&&j.ok){ PARENTS=j.parents||{}; PARENTS_AT=Date.now(); } }catch(e){}
  return PARENTS;
}
function parFmt(p){ return p?'0'+String(p):''; }
function parLink(){ return getSite().replace(/\/+$/,'')+'/parent'; }
/* 👪 سطر رابط تقرير ولي الأمر يُلحق برسائل أولياء الأمور */
function parFooter(){ return `\n\n📊 لمتابعة مستوى ابنكم ودرجاته: ${parLink()}\n(الدخول باسم الطالب ورقم جوالكم المسجّل في المدرسة)`; }
/* 💬 واتساب لولي الأمر: على رقمه مباشرة إن كان محفوظًا، وإلا تختار المحادثة بنفسك */
function parWaUrl(sid,text){ const x=PARENTS&&PARENTS[String(sid)]; return 'https://wa.me/'+(x&&x.p?'966'+x.p:'')+'?text='+encodeURIComponent(text||''); }
function parWaOpen(sid,text){ const u=parWaUrl(sid,text), w=window.open(u,'_blank','noopener'); if(!w) location.href=u; }
setTimeout(()=>{ try{ if(getApi()&&getTok()) parLoad(); }catch(e){} },4000);
function parBoxHTML(sid){
  if(PARENTS===null){ parLoad().then(()=>{ const b=document.getElementById('par-box'); if(b&&b.dataset.sid===sid) b.innerHTML=parBoxHTML(sid); }); return '<span class="muted">👪 جارٍ جلب جوال ولي الأمر…</span>'; }
  const x=PARENTS[sid], s=(STUDENTS||[]).find(v=>String(v.id)===sid)||{};
  if(!x) return `<span class="par-ic">👪</span><span class="par-tx"><b>لا يوجد جوال لولي الأمر</b><small>أضفه يدويًا، أو من مدرستي: «تقارير إدارة المدرسة ← معلومات الطلاب» ثم زر الإضافة «📱 أرسل جوالات أولياء الأمور»</small></span>
    <button type="button" class="btn sm" onclick="parEdit('${esc(sid)}')">＋ أضف الجوال</button>`;
  const wa='966'+x.p, msg=`السلام عليكم ولي أمر الطالب ${String(s.name||'').split(/\s+/)[0]}،\nيمكنكم متابعة مستوى ابنكم ودرجاته في مادة ${rcGet('subject')||'العلوم'} من هذا الرابط:\n${parLink()}\nالدخول باسم الطالب ورقم جوالكم هذا.`;
  return `<span class="par-ic">👪</span><span class="par-tx"><b>${esc(x.pn||'ولي الأمر')} · <span dir="ltr">${esc(parFmt(x.p))}</span></b><small>${x.src==='manual'?'أدخلته يدويًا':'من مدرستي'}</small></span>
    <a class="btn tick sm" target="_blank" rel="noopener" href="https://wa.me/${wa}">💬 واتساب</a>
    <a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}" title="رسالة فيها رابط تقرير ابنه وطريقة الدخول">🔗 أرسل رابط التقرير</a>
    <button type="button" class="btn ghost sm" onclick="parEdit('${esc(sid)}')">✏️</button>`;
}

/* ═══ 👥 «الطلاب» و«ملف الطالب» في تبويب واحد ═══
   الحاسب: القائمة يمينًا وملف الطالب الكامل بجانبها (يُختار الطالب فيُفتح ملفه مكانه).
   الجوال: القائمة أولًا، والضغط على طالب يفتح ملفه بملء الشاشة مع زر «→ القائمة».
   الملف نفسه هو ctProfile (نظرة شاملة، الأنشطة، النقاط، الخط الزمني، التواصل، التقارير) — بلا نسخة ثانية. */
// var بلا قيمة ابتدائية: قد يُستدعى رسم الملف أثناء تحميل الملف قبل هذا السطر (let كانت ترمي «before initialization»)
var STC_SHOWN, STC_SEQ;
function stcPanel(){ return document.getElementById('p-students'); }
function stcActive(){ const p=stcPanel(); return !!(p&&p.classList.contains('on')); }
function stcMobile(){ try{ return window.matchMedia('(max-width:900px)').matches; }catch(e){ return false; } }
/* force: 0 لا يعيد رسم الملف المعروض نفسه · 1 يعيد رسمه · 2 يعيد جلب الدرجات أيضًا */
/* تجهيز بيانات ملف الطالب في الخلفية بعد ظهور اللوحة (درجات الفترة الحالية + السابقة)، بلا رسم:
   كان الملف يُرسم مخفيًا عند الإقلاع فتصل بياناته مبكرًا؛ بدونه صار فتح الملف ينتظر طلبين ثقيلين أمام المعلم */
function stcWarm(){   // يُنادى أثناء تحميل هذا الملف نفسه: العلامة على window لا متغيّر let (لم يُعرَّف بعد)
  if(window._stcWarm) return; window._stcWarm=1;
  const go=async()=>{ if(window._ctOffline||!getApi()||!getTok()) { window._stcWarm=0; return; }
    try{ await ctEnsureGrades(); }catch(e){ window._stcWarm=0; return; }
    try{ if(typeof ctEnsurePrev==='function') await ctEnsurePrev(); }catch(e){} };
  setTimeout(()=>{ if('requestIdleCallback' in window) requestIdleCallback(go,{timeout:3000}); else go(); },1500);
}
/* بصمة ما يعرضه ملف الطالب: سجله، ودرجاته (الحالية والسابقة)، وتسليماته، وبيانات الفصل */
function stcSig(s){
  try{ const sid=String(s.id), J=x=>JSON.stringify(x===undefined?null:x);
    const subs=(HW||[]).reduce((a,h)=>{ const v=h&&h.subs&&(h.subs[sid]||h.subs[String(s.name||'')]); return v?a+(h.id||'')+':'+(v.at||v.fat||1)+';':a; },'');
    return [J(s), J(CT_GRADES&&CT_GRADES.map&&CT_GRADES.map[sid]), J(typeof CT_PREV!=='undefined'&&CT_PREV&&CT_PREV.map&&CT_PREV.map[sid]), subs, (CT_DATA&&CT_DATA.savedAt)||0, window._ctPfSub||''].join('\u0001');
  }catch(e){ return String(Math.random()); }
}
async function renderStudentCenterDetail(force){
  const box=document.getElementById('student-center-detail'), s=byId(STUDENT_CENTER_SELECTED);
  if(!box||!s) return;
  if(!stcActive()){ STC_SHOWN=''; stcWarm(); return; }   // صفحة الطلاب مخفية: لا يُرسم الملف — تُجهَّز بياناته فقط في الخلفية
  // تحديث في الخلفية (مزامنة المتجر/البيانات/القائمة): كان يعيد رسم الملف المفتوح كاملًا كل مرة فيُرى «يتحمّل من جديد».
  // الآن يُعاد رسمه فقط إن تغيّرت بيانات هذا الطالب نفسه
  if(force==='auto'){ force=(STC_SHOWN===String(s.id)&&box.querySelector('.stc-file')&&box._stcSig===stcSig(s))?0:1; }
  if(!force && STC_SHOWN===String(s.id) && box.querySelector('.stc-file')) return;
  box._stcSig=stcSig(s);
  const seq=STC_SEQ=(STC_SEQ||0)+1; STC_SHOWN=String(s.id);
  if(String(window._ctPfSid)!==String(s.id)) window._ctPfSub=window._ctPfSub||'overview';
  window._ctPfSid=String(s.id); window._ctPfCls=String(s.cls||'');
  // لا نسختان من الملف (معرّفاته فريدة): إن بقي ملف قديم في «أدوات الفصل» يُفرَّغ
  const cb=document.getElementById('ct-body'); if(cb&&cb.querySelector('#ct-pf')) cb.innerHTML='';
  if(!box.querySelector('.stc-file')) box.innerHTML='<div class="muted" style="padding:1.2rem">⏳ جارٍ فتح ملف الطالب…</div>';
  const old=[...box.children];
  const el=document.createElement('div'); el.className='stc-file'; el.style.display='none'; box.appendChild(el);
  old.forEach(o=>{ const pf=o.querySelector&&o.querySelector('#ct-pf'); if(pf) pf.removeAttribute('id'); });   // يرسم ctProfile في الجديد
  try{ await ctProfile(el, force===2); }catch(e){ el.innerHTML='<div class="ct-warn">تعذّر فتح ملف الطالب — حدّث الصفحة.</div>'; }
  if(seq!==STC_SEQ){ el.remove(); return; }   // اختير طالب آخر أثناء التحميل
  stcDecorate(el,s);
  old.forEach(o=>o.remove()); el.style.display='';
}
function stcDecorate(el,s){
  const L=window.STC_LIST||[], i=L.indexOf(String(s.id)), sid=esc(s.id);
  const nav=`<div class="stc-nav no-print">
    <button type="button" class="btn ghost sm stc-back" onclick="stcBack()">→ القائمة</button>
    <span class="stc-who"><b>${esc(s.name)}</b><small>${esc(s.cls||'بدون فصل')}${i>=0?` · ${i+1} من ${L.length}`:''}</small></span>
    ${typeof pfPinChip==='function'?pfPinChip(s.id):''}
    <span class="stc-btns">${L.length>1?`<button type="button" class="btn ghost sm" title="الطالب السابق في القائمة" onclick="stcStep(-1)">→</button><button type="button" class="btn ghost sm" title="الطالب التالي في القائمة" onclick="stcStep(1)">←</button>`:''}
      <button type="button" class="btn ghost sm stc-del" title="حذف الطالب" onclick="delStudent('${sid}')">🗑️</button></span></div>`;
  const tools=el.querySelector('.ct-tools'); if(tools) tools.outerHTML=nav; else el.insertAdjacentHTML('afterbegin',nav);
  const pf=el.querySelector('#ct-pf');
  if(pf && (window._ctPfSub||'overview')==='overview'){ const x=stcAttentionHTML(s); if(x) pf.insertAdjacentHTML('afterbegin',x); }
}
/* ⚠️ ما كان في اللوحة المختصرة ولا يوجد في الملف: «يحتاج تدخّلك» ومؤشرات التشخيصي ونمط التعلّم */
function stcAttentionHTML(s){
  let d; try{ d=studentCenterData(s); }catch(e){ return ''; }
  const a=[]; if(d.missing) a.push(`لديه ${d.missing} نشاط غير مسلّم`); if(d.late) a.push(`${d.late} تسليم متأخر`); if(d.pct<60&&d.done>=2) a.push('متوسط الأداء يحتاج متابعة');
  const ind=[];
  try{ diagHW().filter(h=>hwFor(h,s.cls)).forEach(h=>{ const v=(h.subs||{})[s.id]; if(!v) return; const p=Math.round((v.correct||0)/Math.max(1,v.total||1)*100);
    const lv=p>=80?['متقدّم','#1B9C6B']:p>=60?['متوسط','#2E6BB8']:p>=40?['يحتاج دعمًا','#C88A2E']:['أساسي','#B4232F'];
    ind.push(`<span class="stc-ind" style="--c:${lv[1]}">🔍 ${esc(h.title)}: <b>${lv[0]} · ${p}%</b></span>`); }); }catch(e){}
  try{ styleHW().filter(h=>hwFor(h,s.cls)).forEach(h=>{ const t=styleTally(h,s.id); if(!t) return;
    ind.push(`<span class="stc-ind" style="--c:${STYLE_COLOR[t.top]||'#5A6B84'}">${STYLE_ICON[t.top]||'🧠'} نمط التعلّم: <b>${esc(t.top)} ${t.topPct}%</b></span>`); }); }catch(e){}
  if(!a.length&&!ind.length) return '';
  return `<div class="stc-alert">${a.length?`<div class="stc-att"><b>⚠️ يحتاج تدخّلك:</b> ${a.map(esc).join(' · ')}</div>`:''}${ind.length?`<div class="stc-inds">${ind.join('')}</div>`:''}</div>`;
}
/* فتح ملف طالب من أي مكان (الرسائل، الخطط، اللوحة…): ينتقل إلى «الطلاب» ويختاره */
function stcOpen(sid){
  sid=String(sid||''); closeModal();
  if(!stcActive()) goTab('students');
  if(!sid||!byId(sid)) return;
  if(!(window.STC_LIST||[]).includes(sid)){   // البحث أو الفصل يخفيه: يُفرَّغان
    const q=document.getElementById('students-center-search'), c=document.getElementById('students-center-class');
    if(q) q.value=''; if(c) c.value='';
  }
  STUDENT_CENTER_SELECTED=sid; STC_SHOWN='';
  renderStudentsCenter();
  if(stcMobile()){ stcPanel()?.classList.add('stc-open'); window.scrollTo({top:0}); }
  else { const it=document.querySelector('.student-list-item.selected'); if(it) it.scrollIntoView({block:'nearest'}); }
}
// الضغط على «الطلاب» في القائمة (والجوال خاصة) يعيد إلى قائمة الطلاب
document.addEventListener('click',e=>{ if(e.target.closest&&e.target.closest('.tab[data-tab="students"],.mobile-nav button[data-tab="students"]')) stcPanel()?.classList.remove('stc-open'); },true);

/* 📅 مبدّل الفترة المعروضة: زر في أعلى اللوحة + شريط تنبيه حين تُعرض فترة مغلقة */
function vspDraw(){
  const sp=ctSem(), b=document.getElementById('vsp-btn'), bn=document.getElementById('vsp-banner'), L=vspList();
  if(b){ b.style.display=L.length>1?'':'none'; b.innerHTML=`📅 <span class="vsp-sem">${sp.sem===2?'الفصل الثاني':'الفصل الأول'} · </span>${sp.per===2?'الفترة الثانية':'الفترة الأولى'}${sp.viewing?' 🔒':''}`; b.classList.toggle('on',!!sp.viewing); }
  if(bn){ bn.classList.toggle('hide',!sp.viewing);
    // سطر واحد رفيع (كان ثلث شاشة الجوال ويتكرر في كل صفحة): الفترة + فرصة التحسين + الرجوع — والشرح مرة واحدة لكل جهاز
    if(sp.viewing){ bn.innerHTML=`<span class="vsp-t" title="الكشوف وملف الفصل والتقارير وشهادات الأوائل لهذه الفترة — الرصد الجديد يبقى على الفترة الجارية">👁️ <b><span class="vsp-sem">${sp.sem===2?'الفصل الثاني':'الفصل الأول'} · </span>${sp.per===2?'الفترة الثانية':'الفترة الأولى'}</b> <small>مغلقة</small></span>${impBannerBtn(sp)}<button class="btn sm vsp-back" type="button" onclick="vspSet(0)">↩️ الحالية</button>`;
      try{ if(!localStorage.getItem('vsp_note_seen_v1')){ localStorage.setItem('vsp_note_seen_v1','1'); toast('👁️ تعرض فترة مغلقة في الكشوف والتقارير وملف الفصل — الرصد الجديد يبقى على الفترة الجارية','good'); } }catch(e){} } }
}
/* 🔓 فرصة تحسين فترة مغلقة: يفتح المعلم للطلاب مدة يسلّمون فيها أنشطة الفترة التي لم يسلّموها، فتُحسب لها.
   الدرجة لا تنقص (تسليم إضافي فقط)، والرصد اليدوي (المشاركة والواجب والسلوك والاختبارات) يبقى مقفلًا. */
function impOf(sem,per){
  const a=(typeof DASH_ACADEMIC!=='undefined'&&DASH_ACADEMIC)||{}, snap=(((a.semesters||{})[sem]||{}).periodSnapshots||{})[per], I=snap&&snap.term&&snap.term.improve;
  if(!I) return null; const until=Number(I.until)||0;
  return { ...I, until, on: until>Date.now(), day: new Date(until+3*3600000-1000).toISOString().slice(0,10), term: snap.term };
}
function impDayLabel(d){ const t=new Date(d+'T12:00:00Z'); return isNaN(t)?d:`${['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][t.getUTCDay()]} ${t.getUTCDate()}/${t.getUTCMonth()+1}`; }
function impBannerBtn(sp){
  const I=impOf(sp.sem,sp.per);
  return `<button class="btn sm imp-btn${I&&I.on?' on':''}" type="button" onclick="impOpen(${sp.sem},${sp.per})" title="${I&&I.on?`فرصة التحسين مفتوحة حتى ${impDayLabel(I.day)}`:'افتح فرصة تحسين للطلاب'}">${I&&I.on?`🔓 <span class="vsp-sem">الفرصة </span>حتى ${impDayLabel(I.day)}`:'🔓 فرصة تحسين'}</button>`;
}
// أول تحميل والمعلم على فترة مغلقة: الكشف الشامل وسجل مدرستي يفتحان عليها أيضًا (مرة واحدة، ثم يبقى اختياره اليدوي)
// اختيارات الفصل/الفترة في الكشوف تعكس دائمًا الفترة المختارة أعلى اللوحة (لا تعود للأولى في كل دخول)
const VSP_SELS=[['comp-semester','comp-period'],['ca-semester','ca-period'],['madr-sem','madr-per']];
function vspSyncSelects(){ if(!vspList().length) return; const sp=ctSem();
  VSP_SELS.forEach(([a,b])=>{ const x=document.getElementById(a), y=document.getElementById(b); if(x) x.value=String(sp.sem); if(y) y.value=String(sp.per); }); }
(function(){
  const lda=loadDashboardAcademic;
  loadDashboardAcademic=async function(...a){ const r=await lda.apply(this,a); try{ vspDraw(); vspSyncSelects(); renderDashboardAcademicControl(); }catch(e){} return r; };
  const go=()=>{ try{ vspDraw(); }catch(e){} };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',go); else go();
})();
