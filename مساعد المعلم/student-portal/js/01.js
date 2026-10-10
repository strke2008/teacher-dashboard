'use strict';
/* عنوان الخادم — يجعل روابط الطلاب قصيرة */
const API = 'https://homework.ahmadalmarzooq2009.workers.dev';
console.log('بوابة الطالب — build v14 · تمرير الشاشات');

function b64ToStr(b){
  b = b.replace(/-/g,'+').replace(/_/g,'/');
  while(b.length % 4) b += '=';
  return new TextDecoder().decode(Uint8Array.from(atob(b), c=>c.charCodeAt(0)));
}
let HW = null;
let SHORT_ID = '';
try{
  const raw = (location.hash||'').replace(/^#/,'');
  const p = new URLSearchParams(raw);
  const h = p.get('h');
  if(h) HW = JSON.parse(b64ToStr(h));               // صيغة قديمة طويلة — تبقى تعمل
  else if(/^[A-Za-z0-9_-]{3,24}$/.test(raw)) SHORT_ID = raw;   // رمز قصير
}catch(e){ HW = null; }

const $ = id => document.getElementById(id);
let idx=0, ans=[], me=-1, myName='', built=[];
let MYPTS = 0, MYPERKS = {};
let hintUsed = {};

updateActivityHomeButton();

/* 🔔 إشعارات ونوافذ داخل الصفحة — نوافذ المتصفح لا تعمل جيداً على الجوال */
let _tT;
function toast(msg, kind){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'on' + (kind ? ' ' + kind : '');
  clearTimeout(_tT); _tT = setTimeout(()=>t.className='', 2800);
}
function ask({ title, msg, icon, yes, no }){
  return new Promise(res=>{
    const v = document.getElementById('veil');
    document.getElementById('dlg-icon').textContent = icon || '';
    document.getElementById('dlg-title').textContent = title || '';
    document.getElementById('dlg-msg').textContent = msg || '';
    const y = document.getElementById('dlg-yes'), nB = document.getElementById('dlg-no');
    y.textContent = yes || 'تأكيد';
    nB.textContent = no || 'إلغاء';
    nB.style.display = no === null ? 'none' : '';
    const done = val => { v.classList.remove('on'); y.onclick=null; nB.onclick=null; res(val); };
    y.onclick = ()=>done(true);
    nB.onclick = ()=>done(false);
    v.classList.add('on');
  });
}
const note = (msg, title, icon) => ask({ title: title||'', msg, icon, yes:'حسناً', no:null });
/* 🔝 الشاشة الجديدة تبدأ من أولها: كان الانتقال يحتفظ بموضع الشاشة السابقة،
   فتفتح النشاط وأنت في منتصفه أو يقصّه المتصفح للأعلى. */
function toTop(smooth){
  try{ window.scrollTo({top:0,behavior:smooth?'smooth':'auto'}); }
  catch(e){ window.scrollTo(0,0); }
}
const show = id => {
  const el=$(id);
  if(!el) return;
  el.classList.remove('hide');
  if(/^s-/.test(String(id))) toTop();
};
const hide = id => $(id).classList.add('hide');

/* 🏠 رجوع واضح من أي نشاط إلى البوابة الرئيسية.
   النشاط يفتح برابط hash مستقل، لذلك لا نعتمد على زر رجوع المتصفح الذي قد يعيد
   الطالب إلى صفحة وسيطة أو يعيد فتح النشاط نفسه. */
function goStudentHome(){
  try{ location.hash=''; }catch(e){}
  location.href = location.pathname;
}

/* 🔄 الضغط على أيقونة «أنشطتي» أو اسمها: تحديث الصفحة وجلب الأنشطة من جديد.
   داخل نشاط بدأ حلّه: تأكيد أولًا حتى لا تضيع إجاباته بلمسة عابرة. */
async function barRefresh(){
  const inQuiz = !!(HW || SHORT_ID) && (() => { const q = $('s-quiz'); return q && !q.classList.contains('hide') && Array.isArray(ans) && ans.some(a => a !== undefined && a !== null && !(Array.isArray(a) && !a.length)); })();
  if(inQuiz && !(await ask({ icon:'🔄', title:'تحديث الصفحة؟', msg:'ستخرج من النشاط ولن تُحفظ إجاباتك الحالية.', yes:'نعم، حدّث', no:'متابعة الحل' }))) return;
  document.querySelectorAll('.bar-refresh').forEach(el => el.classList.add('spin'));
  if(location.hash){ try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){} }
  location.reload();
}
document.addEventListener('click', e => { if(e.target.closest('.bar-refresh')) barRefresh(); });
document.addEventListener('keydown', e => { if((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('.bar-refresh')){ e.preventDefault(); barRefresh(); } });
function updateActivityHomeButton(){
  const b=$('activity-home');
  if(!b) return;
  const hasActivity=!!(HW || SHORT_ID);
  b.classList.toggle('hide', !hasActivity);
  b.onclick=goStudentHome;
}

const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle = a => a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(v=>v[1]);
const norm = s => String(s||'').replace(/[\u064B-\u0652\u0640]/g,'')
  .replace(/[\u0623\u0625\u0622]/g,'\u0627').replace(/\u0649/g,'\u064A').replace(/\u0629/g,'\u0647')
  .replace(/\s+/g,' ').trim();

const KINDS = { q:'اختيار من متعدد', tf:'صح أو خطأ', f:'أكمل الفراغ',
                a:'رتّب الحروف', m:'وصّل', s:'رتّب الجملة' };

/* ── هوية الجهاز والقفل ── */
const DEV_KEY='hwdev_id_v1', NAME_KEY='hwdev_name_v1';
function devId(){
  let v=null; try{ v=localStorage.getItem(DEV_KEY); }catch(e){}
  if(!v){ v='d'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
          try{ localStorage.setItem(DEV_KEY,v); }catch(e){} }
  return v;
}
function lockedName(){ try{ return localStorage.getItem(NAME_KEY)||''; }catch(e){ return ''; } }
function setLockedName(nm){ try{ localStorage.setItem(NAME_KEY,nm); }catch(e){} }
/* 🆔 المعرف الثابت: يبقى وإن تغيّر الاسم أو الفصل */
const SID_KEY = 'hw_sid_v1';
let mySid = (function(){ try{ return localStorage.getItem(SID_KEY)||''; }catch(e){ return ''; } })();
function setMySid(id){ mySid = String(id||''); try{ if(mySid) localStorage.setItem(SID_KEY,mySid); else localStorage.removeItem(SID_KEY); }catch(e){}
  // 🔐 جلسة المتجر تخص طالبًا واحدًا: تغيّر الطالب على الجهاز ⇒ تُمسح فورًا
  try{ const o = JSON.parse(localStorage.getItem(STORE_SESS_KEY)||'null'); if(o && o.sid !== mySid) localStorage.removeItem(STORE_SESS_KEY); }catch(e){}
}
/* 🔐 جلسة المتجر: يصدرها الخادم بعد التحقق من الرمز السري، وتُرسل مع كل عملية صرف */
const STORE_SESS_KEY = 'hw_store_session_v1';
function getStoreSession(){
  try{ const o = JSON.parse(localStorage.getItem(STORE_SESS_KEY)||'null');
       if(o && o.token && o.sid && o.sid === mySid && Number(o.exp) > Date.now() + 60000) return o.token; }catch(e){}
  return '';
}
function saveStoreSession(j){
  try{ if(j && j.session && j.sid) localStorage.setItem(STORE_SESS_KEY, JSON.stringify({ sid:String(j.sid), token:j.session, exp:Number(j.sessionExp)||0 })); }catch(e){}
}
function clearStoreSession(){ try{ localStorage.removeItem(STORE_SESS_KEY); }catch(e){} }
function idQS(){ return mySid ? ('&sid=' + encodeURIComponent(mySid)) : ''; }
// 🔑 القفل مرتبط بالطالب لا بالجهاز — فالإخوة على جوال واحد لا يحجب بعضهم
function doneKey(nm){
  const who = nm || myName || lockedName() || '';
  return 'hwdone_' + (HW && HW.id || 'x') + '__' + who;
}
function isDone(nm){ try{ return localStorage.getItem(doneKey(nm))==='1'; }catch(e){ return false; } }
function markDone(nm){ try{ localStorage.setItem(doneKey(nm),'1'); }catch(e){} }
function clearDone(nm){ try{ localStorage.removeItem(doneKey(nm)); }catch(e){} }
/* 🛡️ الخادم هو المرجع: علامة «سلّمت» المحفوظة على الجهاز احتياط عند انقطاع الاتصال فقط.
   كانت تحجب الطالب ولو لم تصل إجاباته للخادم (انقطاع أثناء الإرسال) أو بعد أن أعاد المعلم ضبط تسليمه،
   فيعمل النشاط في متصفح آخر ولا يعمل في جهازه. */
async function serverSubmitted(nm){
  const api=((HW&&HW.api)||API||'').replace(/\/+$/,''); if(!api||!nm) return null;
  const ids=[HW&&HW.id,HW&&HW.sid].filter((v,i,a)=>v&&a.indexOf(v)===i);
  let seen=null;
  for(const hwKey of ids){
    try{ const r=await fetch(api+'/me?name='+encodeURIComponent(nm)+idQS()+'&hw='+encodeURIComponent(hwKey)+'&_='+Date.now(),{cache:'no-store'});
      const x=await r.json(); if(x&&x.ok){ if(x.submitted||Number(x.extra||x.extraAttempts||0)>0) return x; seen=x; } }catch(e){}
  }
  return seen;
}

async function verifyActivityStillPublished(){
  // 🔐 حتى الرابط الطويل القديم لا يستطيع تجاوز حذف النشاط من الخادم.
  // الرابط يحمل نسخة من النشاط، لذلك نتحقق من وجود النسخة المنشورة قبل السماح بالدخول.
  if(!HW || !HW.id || !API) return true;
  try{
    const r = await fetch(API.replace(/\/+$/,'') + '/hw?id=' + encodeURIComponent(HW.id) + '&_=' + Date.now(), {
      cache:'no-store'
    });
    if(r.status === 404) return false;
    if(!r.ok) return null;
    const live = await r.json();
    // استخدم النسخة المنشورة من الخادم، وليس النسخة المضمّنة في الرابط.
    if(!live || !Array.isArray(live.q)) return null;
    HW = live;
    return true;
  }catch(e){
    return null;
  }
}

function showActivityUnavailable(message){
  $('bar-title').textContent = 'نشاط غير متاح';
  { const bc=document.getElementById('bar-credit'); if(bc) bc.classList.toggle('hide', true); }
  show('s-empty');
  document.querySelector('#s-empty h2').textContent = 'هذا النشاط لم يعد متاحًا';
  document.querySelector('#s-empty p').textContent = message || 'تم حذف النشاط أو إغلاقه من قبل المعلم.';
}

/* 🔁 إعادة تسليم المشروع المرفوض
   هذا المسار منفصل عن نظام القفل الأصلي:
   - لا يغيّر beginWith ولا منطق التسليم العادي.
   - يفحص /mine أولاً، ثم يفتح s-files مباشرة فقط إذا كان المشروع
     مرفوضاً وما زالت مهلة إعادة التسليم سارية.
*/
async function openRejectedProjectResubmit(nm){
  if(!HW || HW.kind !== 'files' || !nm) return false;
  const api = (API || '').replace(/\/+$/,'');
  if(!api) return false;

  try{
    const r = await fetch(
      api + '/mine?name=' + encodeURIComponent(nm) + idQS() + '&_=' + Date.now(),
      {cache:'no-store'}
    );
    if(!r.ok) return false;

    const j = await r.json();
    if(!j || !j.ok || !Array.isArray(j.rows)) return false;

    const row = j.rows.find(h =>
      String(h.id || '') === String(HW.id || '') ||
      (HW.sid && String(h.id || '') === String(HW.sid))
    );
    if(!row) return false;

    const until = Number(row.resubmitUntil || 0);
    const rejected = String(row.reviewStatus || '').toLowerCase() === 'rejected';

    if(!rejected || !until || until <= Date.now()) return false;

    // فقط هنا نتجاوز علامة التسليم المحلية القديمة.
    try{ localStorage.removeItem(doneKey(nm)); }catch(e){}

    myName = nm;
    hide('s-who');
    hide('s-empty');
    show('s-files');

    $('files-title').textContent = '🔁 إعادة تسليم المشروع';
    $('files-student').textContent =
      'الطالب: ' + myName +
      ' · متاح حتى ' + new Date(until).toLocaleString('ar-SA');

    resetFilePicker();
    showDirectMessages(myName);
    return true;
  }catch(e){
    console.warn('openRejectedProjectResubmit:', e);
    return false;
  }
}

async function openMeasureReport(hwId, nm, reportKind){
  const api = ((HW && HW.api) || API || '').replace(/\/+$/,'');
  if(!api) return;
  try{
    const r = await fetch(`${api}/review?hw=${encodeURIComponent(hwId)}&name=${encodeURIComponent(nm)}${idQS()}`);
    const j = await r.json();
    if(!j || !j.ok || !j.open){
      toast('تعذّر فتح التقرير حالياً','bad');
      return;
    }

    const kind = reportKind || (HW && HW.kind) || String(j.kind||'');
    const screens = ['s-gate','s-pin','s-pre','s-who','s-quiz','s-files','s-empty','s-done'];
    screens.forEach(id=>{ const el=$(id); if(el) el.classList.add('hide'); });
    show('s-done');

    $('done-name').textContent = nm;
    $('more-box').classList.remove('hide');
    $('more-line').textContent = 'يمكنك الرجوع إلى قائمة أنشطتك في أي وقت.';
    $('more-btn').textContent = '📚 أنشطتي';
    $('more-btn').onclick = ()=>{
      try{ location.hash=''; }catch(e){}
      location.href = location.pathname;
    };
    $('review').innerHTML = '';
    $('done-line').textContent = '';
    $('sent-line').textContent = 'تم التسليم سابقًا · هذا التقرير للعرض فقط.';

    const cardStyle = 'background:linear-gradient(180deg,#fff,#f8fafc);border:1px solid var(--rule);border-radius:18px;padding:1rem;margin-top:.75rem';
    const muted = 'color:var(--ink-soft);font-size:.88rem;line-height:1.9';
    const pctBar = (pct)=>`<div style="height:10px;background:#e8edf3;border-radius:999px;overflow:hidden;margin-top:.45rem"><div style="height:100%;width:${Math.max(0,Math.min(100,pct))}%;background:var(--tick);border-radius:999px"></div></div>`;

    if(kind === 'style'){
      const TAGS = ['بصري','سمعي','حركي','قرائي/كتابي'];
      const ICO = {'بصري':'👁️','سمعي':'👂','حركي':'✋','قرائي/كتابي':'📖'};
      const tally = {};
      (j.q||[]).forEach((q,i)=>{
        const a = j.ans ? j.ans[i] : null;
        if(a===null || a===undefined) return;
        const tag = (q.tags && q.tags[a]) || TAGS[a];
        if(tag) tally[tag]=(tally[tag]||0)+1;
      });
      const rows = TAGS.map(k=>[k,Number(tally[k]||0)]);
      const total = rows.reduce((n,x)=>n+x[1],0)||1;
      rows.sort((a,b)=>b[1]-a[1]);
      const top = rows[0][1] ? rows[0][0] : '';
      const topPct = top ? Math.round(rows[0][1]/total*100) : 0;

      $('done-score').style.fontSize='1rem';
      $('done-score').innerHTML = `
        <div style="font-size:.85rem;color:var(--ink-soft);font-weight:700">🧠 النمط الغالب</div>
        <div style="font-size:2.15rem;font-weight:900;margin-top:.15rem">${ICO[top]||'🧠'} ${esc(top||'لم يكتمل')}</div>
        <div style="font-size:.9rem;color:var(--ink-soft);margin-top:.2rem">مؤشر تفضيل في طريقة التعلّم، وليس درجة</div>`;
      $('done-line').innerHTML = `
        <div style="${cardStyle};text-align:start">
          <div style="font-weight:800;font-size:1rem">📊 توزيع تفضيلاتك</div>
          ${rows.map(([k,c])=>{
            const pct=Math.round(c/total*100);
            return `<div style="margin-top:.8rem"><div style="display:flex;justify-content:space-between;gap:.7rem;font-weight:700"><span>${ICO[k]} ${esc(k)}</span><span>${pct}%</span></div>${pctBar(pct)}</div>`;
          }).join('')}
        </div>`;
      $('review').innerHTML = `
        <div style="${cardStyle};text-align:start">
          <h3 style="margin:0 0 .45rem">🧠 ماذا يعني هذا؟</h3>
          <p style="${muted};margin:0">تميل إلى الاستفادة أكثر من طرق التعلم المرتبطة بنمطك الغالب، مع بقاء جميع الأنماط مفيدة في التعلم.</p>
          <div style="margin-top:.75rem;padding:.7rem .8rem;border-radius:12px;background:rgba(27,156,107,.08);font-size:.84rem;line-height:1.8">
            <b>مهم:</b> هذا مؤشر على تفضيلك في التعلم، وليس حكمًا ثابتًا على قدرتك أو نجاحك.
          </div>
        </div>`;
      $('more-line').textContent = 'استخدم هذا المؤشر لاختيار طرق مذاكرة متنوعة، ثم تابع رحلتك التعليمية.';

    }else if(kind === 'diag'){
      const correct = Number(j.correct||0), total = Number(j.total||0);
      const pct = total ? Math.round(correct/total*100) : 0;
      $('done-score').style.fontSize='1rem';
      $('done-score').innerHTML = `
        <div style="font-size:.85rem;color:var(--ink-soft);font-weight:700">🔍 نتيجة التشخيص</div>
        <div style="font-size:2.15rem;font-weight:900;margin-top:.15rem">${correct} <span style="font-size:1.25rem;color:var(--ink-soft)">من ${total}</span></div>
        <div style="font-size:.9rem;color:var(--ink-soft);margin-top:.2rem">${pct}% من الإجابات كانت صحيحة</div>`;

      const stats = {};
      (j.q||[]).forEach((q,i)=>{
        const domain=String(q.domain||'المهارات العامة').trim()||'المهارات العامة';
        if(!stats[domain]) stats[domain]={correct:0,total:0,skills:{}};
        const ok=String(j.d||'')[i]==='1';
        stats[domain].total++;
        if(ok) stats[domain].correct++;
        const skill=String(q.skill||'').trim();
        if(skill){
          if(!stats[domain].skills[skill]) stats[domain].skills[skill]={correct:0,total:0};
          stats[domain].skills[skill].total++;
          if(ok) stats[domain].skills[skill].correct++;
        }
      });

      const domains = Object.entries(stats).map(([d,v])=>{
        const p=Math.round(v.correct/Math.max(1,v.total)*100);
        const skills=Object.entries(v.skills).map(([sk,x])=>{
          const sp=Math.round(x.correct/Math.max(1,x.total)*100);
          return `<div style="margin-top:.65rem;padding-top:.6rem;border-top:1px solid var(--rule)">
            <div style="display:flex;justify-content:space-between;gap:.6rem;font-size:.84rem"><span>• ${esc(sk)}</span><b>${x.correct}/${x.total}</b></div>${pctBar(sp)}
          </div>`;
        }).join('');
        return `<div style="${cardStyle};text-align:start">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;font-weight:800"><span>📚 ${esc(d)}</span><span>${v.correct}/${v.total}</span></div>
          <div style="${muted};margin-top:.2rem">نسبة الإتقان الحالية: ${p}%</div>
          ${pctBar(p)}${skills}
        </div>`;
      }).join('');

      $('done-line').innerHTML = `<div style="${cardStyle};text-align:start"><div style="font-weight:800">🎯 ماذا نعرف من هذه النتيجة؟</div><p style="${muted};margin:.35rem 0 0">هذا التشخيص نقطة بداية تساعد على تحديد المهارات التي تحتاج إلى مراجعة وتعزيز، وليس درجة نهائية.</p></div>`;
      $('review').innerHTML = `<div style="margin-top:.9rem;text-align:start"><h3 style="margin:0 0 .25rem">📊 مجالات التشخيص</h3>${domains||'<div class="sheet muted">لا توجد تفاصيل كافية.</div>'}</div>`;
      $('more-line').textContent = 'ابدأ بمراجعة المهارات التي تحتاج إلى تعزيز، ثم واصل أنشطتك التعليمية.';
    }

    window.scrollTo({top:0,behavior:'instant'});
  }catch(e){
    console.warn('openMeasureReport:',e);
    toast('تعذّر تحميل التقرير','bad');
  }
}

/* 🔒 بوابة البداية خارج الرحلة: النشاط العادي والفهم القرائي والتجارب لا تُفتح قبل اختباري البداية.
   الحالة تُحفظ عند رسم الرحلة (لكل طالب) لأن الفتح برابط لا يعرف نتائج الطالب. */
const START_GATE_KEY = 'hw_startgate_v1';
function startGateWho(){ try{ return localStorage.getItem(SID_KEY) || localStorage.getItem(NAME_KEY) || ''; }catch(e){ return ''; } }
function startGateSave(open){ try{ const w = mySid || myName || startGateWho(); if(w) localStorage.setItem(START_GATE_KEY, JSON.stringify({ who:String(w), open:!!open, at:Date.now() })); }catch(e){} }
function startGateClosedFor(){ try{ const o = JSON.parse(localStorage.getItem(START_GATE_KEY)||'null'); const w = startGateWho(); return !!(o && o.open === false && w && String(o.who) === String(w)); }catch(e){ return false; } }
function startGated(h){ const k = String((h && h.kind) || 'normal'); return !(h && h.remedial) && !['style','diag'].includes(k); }   // الألعاب أيضًا تُقفل حتى اختباري البداية (مثل قسم الألعاب)
const START_GATE_MSG = 'يُفتح هذا النشاط بعد إكمال اختباري البداية: «اكتشف طريقة تعلمك» ثم «اعرف مستواك».';
async function boot(){
  if(!HW || !Array.isArray(HW.q) || (HW.kind !== 'files' && !HW.q.length)){ show('s-empty'); return; }
  // 🔒 فتح برابط/إشعار قبل اختباري البداية
  if(startGated(HW) && startGateClosedFor()){
    show('s-empty');
    document.querySelector('#s-empty h2').textContent = '🔒 ابدأ باختباري البداية أولًا';
    document.querySelector('#s-empty p').textContent = START_GATE_MSG + ' تجدهما في «رحلتك التعليمية» في صفحة أنشطتي.';
    $('bar-title').textContent = 'أنشطتي';
    return;
  }
  const KI = { style:'🧠', diag:'🔍', files:'📎' };
  $('bar-title').textContent = (KI[HW.kind] ? KI[HW.kind] + ' ' : '') + (HW.t || 'نشاط');
  { const bc=document.getElementById('bar-credit'); if(bc) bc.classList.toggle('hide', true); }
  $('who-title').textContent = (KI[HW.kind] ? KI[HW.kind] + ' ' : '') + (HW.t || 'نشاط');
  const kindNote = HW.kind === 'style' ? ' 🧠 اختبار أنماط تعلّم — لا توجد إجابة صحيحة'
                 : HW.kind === 'diag'  ? ' 🔍 اختبار تشخيصي — لقياس مستواك'
                 : '';
  renderBrief();
  $('who-sub').textContent = HW.kind==='files' ? 'تسليم صور أو PDF أو فيديو' : `${HW.q.length} مهمة`
    + (HW.p ? ` · ${HW.p} نقطة` : '')
    + (HW.d ? ` · يُغلق ${HW.d}` : '') + kindNote;
  const lk = lockedName();

  // 🔁 للمشروع المرفوض فقط: افحص حالة إعادة التسليم قبل القفل المحلي.
  // إذا لم توجد صلاحية إعادة تسليم، يستمر النظام الأصلي حرفياً.
  if(lk && await openRejectedProjectResubmit(lk)) return;

  // 🔒 اجحب فقط إن كان صاحب الجهاز نفسه هو من سلّم — بعد التأكد من الخادم
  if(lk && isDone(lk)){
    const sv=await serverSubmitted(lk);
    if(sv && !sv.submitted) clearDone(lk);   // الخادم لا يعرف تسليمًا ← العلامة المحلية قديمة أو لم يصل الإرسال
  }
  if(lk && isDone(lk)){
    show('s-empty');
    document.querySelector('#s-empty h2').textContent = `سبق أن سلّمت هذا النشاط يا ${lk}`;
    document.querySelector('#s-empty p').innerHTML =
      'راجعت الإجابات وانتهى.<br><span style="font-size:.86rem">إن كنت طالباً آخر على نفس الجهاز، اضغط الزر بالأسفل.</span>';
    showSwitchOnLocked(lk);
    offerRetry();
    offerMore(lockedName() || myName, 'empty');
    return;
  }
  if(lk){
    $('locked-name').textContent = lk;
    $('who-locked').classList.remove('hide');
    $('who-form').classList.add('hide');
  }
  show('s-who');
}

(async function(){
  if(!HW && SHORT_ID && API){
    $('bar-title').textContent = 'جارٍ التحميل…';
  { const bc=document.getElementById('bar-credit'); if(bc) bc.classList.toggle('hide', true); }
    try{
      const r = await fetch(API.replace(/\/+$/,'') + '/hw?id=' + encodeURIComponent(SHORT_ID) + '&_=' + Date.now(), {cache:'no-store'});
      if(r.ok) HW = await r.json();
      else if(r.status === 404){ showActivityUnavailable(); return; }
    }catch(e){}
    // 🔬 تجربة المختبر الافتراضي تُفتح في صفحة المختبر (نفس الموقع، فالهوية محفوظة)
    if(HW && String(HW.kind||'') === 'lab'){ location.replace('lab/?hw=' + encodeURIComponent(HW.id || SHORT_ID)); return; }
    if(!HW){
      $('bar-title').textContent = 'نشاط';
  { const bc=document.getElementById('bar-credit'); if(bc) bc.classList.toggle('hide', true); }
      show('s-empty');
      document.querySelector('#s-empty h2').textContent = 'تعذّر تحميل النشاط';
      document.querySelector('#s-empty p').textContent = 'تحقّق من اتصالك بالإنترنت ثم أعد فتح الرابط.';
      return;
    }
  }
  // 🚪 لا رمز في الرابط → اعرض بوابة النشاطات
  if(!HW && !SHORT_ID){
    $('bar-title').textContent = 'أنشطتي';
  { const bc=document.getElementById('bar-credit'); if(bc) bc.classList.toggle('hide', false); }
    gateShow();
    return;
  }

  // 🔐 فحص نهائي للروابط الطويلة المضمّنة داخل #h=...
  // إذا حذف المعلم النشاط من الخادم، تمنع الصفحة الدخول حتى لو كان الرابط القديم محفوظًا.
  if(HW && !SHORT_ID){
    const status = await verifyActivityStillPublished();
    if(status === false){ showActivityUnavailable(); return; }
    if(status === null){
      showActivityUnavailable('تعذّر التحقق من حالة النشاط. أعد فتح الرابط مع توفر الاتصال بالإنترنت.');
      return;
    }
  }

  boot();
})();



/* ── مطابقة اسم الطالب: أقل قدر كافٍ لتحديد طالب واحد ── */
const STOP={'بن':1,'ابن':1,'بنت':1,'ال':1};
function nameTokens(s){
  const raw = norm(s).split(' ').filter(Boolean);
  const out = [];
  for(let i=0;i<raw.length;i++){
    // توحيد «عبد الحميد» مع «عبدالحميد» ونحوها دون تغيير ترتيب الاسم.
    if(raw[i] === 'عبد' && raw[i+1]){ out.push('عبد' + raw[++i]); continue; }
    if(!STOP[raw[i]]) out.push(raw[i]);
  }
  return out;
}
// 📌 مطابقة مثبَّتة على الاسم الأول — نسخة مطابقة حرفيًا لِما في الـ Worker.
// أول كلمة يكتبها الطالب يجب أن تكون اسمه الأول، والباقي بعده بالترتيب،
// حتى لا يجرّ اسمُ الأب زملاءَ لا علاقة لهم بالبحث.
function nameMatches(t, r){
  if(!t.length || !r.length) return false;
  if(t[0] !== r[0]) return false;
  let i = 1;
  for(let j = 1; j < r.length && i < t.length; j++){ if(r[j] === t[i]) i++; }
  return i === t.length;
}

function resolveName(typed, names){
  const t = nameTokens(typed);
  if(!t.length) return { error:'short', hits:[] };
  const hits = [];
  (names||[]).forEach((nm,i)=>{ if(nameMatches(t, nameTokens(nm))) hits.push(i); });
  // إذا كتب الطالب الاسم الكامل بالضبط، فالتطابق التام يحسمه حتى لو بدأ
  // به اسم طالب آخر أطول. وإلا فلا نقبل إلا تطابقًا واحدًا.
  if(hits.length > 1){
    const exact = hits.filter(i=>{
      const r=nameTokens(names[i]);
      return r.length===t.length && r.every((x,j)=>x===t[j]);
    });
    if(exact.length===1) return { idx:exact[0], hits:exact };
  }
  if(hits.length===1) return { idx:hits[0], hits };
  return { hits, error:hits.length ? 'many' : 'none' };
}

function findStudent(typed){
  const r=resolveName(typed,HW.s||[]);
  if(r.idx!==undefined) return { idx:r.idx };
  if(r.error==='short') return { err:'اكتب اسمك أو جزءًا من اسمك' };
  if(r.error==='many') return { err:'يوجد أكثر من طالب مطابق — أضف كلمة أخرى من اسمك' };
  return { err:'لم أجد اسمًا مطابقًا — تأكد من الكتابة' };
}

async function beginWith(i){
  me = i;
  myName = (HW.s && HW.s[me]) || 'طالب';

  // الهوية والرمز يُحسمان في resolveIdentity — المسار نفسه الذي تسلكه البوابة
  const okPin = await requirePin(myName);
  if(!okPin) return;

  setLockedName(myName);

  /*
   * صلاحية المعلم تتغلب على قفل التسليم المحلي.
   * لا نستهلك الصلاحية هنا؛ تُستهلك عند التسليم الفعلي في /submit.
   */
  let extraAttempts = 0;
  try{
    const api = ((HW && HW.api) || API || '').replace(/\/+$/,'');
    if(api){
      // نتحقق من الصلاحية باستخدام معرّف النشاط الحالي، ثم sid عند وجوده
      // لأن بعض الأنشطة القديمة تستخدم sid كمعرّف الصلاحية في الخادم.
      const ids = [HW && HW.id, HW && HW.sid].filter((v,i,a)=>v && a.indexOf(v)===i);
      let j = null;
      for(const hwKey of ids){
        try{
          const r = await fetch(
            api + '/me?name=' + encodeURIComponent(myName) + idQS() +
            '&hw=' + encodeURIComponent(hwKey)
          );
          const x = await r.json();
          if(x && x.ok){
            j = x;
            extraAttempts = Number(x.extra || x.extraAttempts || 0);
            if(extraAttempts > 0 || x.submitted) break;
          }
        }catch(e){}
      }
      if(j){
        // 🔒 القفل الحقيقي من الخادم — لا يتجاوزه تغيير الجهاز، ولا تحجب علامة محلية ما لم يستلمه الخادم
        if(j.submitted) markDone(myName); else clearDone(myName);
        MYPTS = j.pts || MYPTS; MYPERKS = j.perks || MYPERKS;
      }
    }
  }catch(e){}

  // قرار الخادم يتغلب على الرابط المباشر أو القفل المحلي.
  // إذا انتهى الموعد فلا يفتح النشاط إلا بصلاحية إضافية من المعلم.
  if(typeof j === 'object' && j && j.canSubmit === false && extraAttempts <= 0 && !(HW.kind === 'style' || HW.kind === 'diag') ){
    hide('s-who');
    show('s-empty');
    const already = !!j.submitted || isDone(myName);
    document.querySelector('#s-empty h2').textContent = already
      ? `سبق أن سلّمت هذا النشاط يا ${myName}`
      : 'انتهى موعد هذا النشاط';
    document.querySelector('#s-empty p').innerHTML = already
      ? 'وصلت إجاباتك للمعلم — لا يمكن الحل مرة أخرى إلا إذا سمح لك المعلم بمحاولة إضافية.'
      : 'انتهى موعد التسليم. يمكن فتح النشاط فقط إذا منحك المعلم صلاحية إعادة التسليم.';
    if(already) offerRetry();
    offerMore(lockedName() || myName, 'empty');
    return;
  }

  if(isDone(myName) && extraAttempts <= 0){
    if(HW.kind === 'style' || HW.kind === 'diag'){
      hide('s-who');
      hide('s-empty');
      show('s-done');
      $('done-name').textContent = myName;
      $('done-score').textContent = HW.kind === 'style' ? '🧠' : '🔍';
      $('done-line').textContent = 'جارٍ تحميل تقريرك…';
      $('sent-line').textContent = 'تم التسليم سابقًا. لا يمكن إعادة الحل.';
      $('more-box').classList.remove('hide');
      $('more-line').textContent = 'يمكنك الاطلاع على التقرير ثم العودة إلى أنشطتك.';
      openMeasureReport(HW.id, myName);
      return;
    }
    hide('s-who');
    show('s-empty');
    document.querySelector('#s-empty h2').textContent =
      `سبق أن سلّمت هذا النشاط يا ${myName}`;
    document.querySelector('#s-empty p').innerHTML =
      'وصلت إجاباتك للمعلم — لا يمكن الحل مرة أخرى.' +
      '<br><span style="font-size:.86rem">تملك بطاقة «إعادة محاولة»؟ ستظهر بالأسفل.</span>';
    offerRetry();
    offerMore(lockedName() || myName, 'empty');
    return;
  }

  if(HW.kind === 'files'){
    hide('s-who');
    show('s-files');
    $('files-title').textContent = '📎 ' + (HW.t || 'تسليم العمل');
    $('files-student').textContent = 'الطالب: ' + myName + (HW.d ? ' · موعد التسليم: ' + HW.d : '');
    resetFilePicker();
    showDirectMessages(myName);
    return;
  }

  hide('s-who');
  show('s-pre');
  $('pre-name').textContent = myName;
  await loadStore(true);
  // 💬 رسائل المعلم تصل هنا أيضًا — لا في البوابة وحدها
  showDirectMessages(myName);
}

// 📎 النسخة التجريبية: رفع الصور وPDF إلى R2 عبر الخادم
let selectedFiles = [];
const MAX_FILES = 5, MAX_FILE_BYTES = 20*1024*1024, MAX_VIDEO_BYTES = 60*1024*1024,
      isVideoFile = f => String(f && f.type || '').startsWith('video/')
        || /\.(mp4|mov|m4v|3gp|webm|avi|mkv)$/i.test(String(f && f.name || '')),
      fileAllowed = f => { const t=String(f&&f.type||''), n=String(f&&f.name||'');
        return t.startsWith('image/') || t==='application/pdf' || isVideoFile(f)
            || /\.(jpg|jpeg|png|webp|heic|heif|gif|pdf)$/i.test(n); },
      capFor = f => isVideoFile(f) ? MAX_VIDEO_BYTES : MAX_FILE_BYTES;
function formatFileSize(n){ return n < 1024*1024 ? Math.max(1,Math.round(n/1024))+' KB' : (n/1024/1024).toFixed(1)+' MB'; }
function resetFilePicker(){
  selectedFiles=[];
  const el=$('files-input'); if(el) el.value='';
  renderSelectedFiles();
}
async function compressImage(file){
  if(!file.type.startsWith('image/')) return file;
  try{
    const bmp = await createImageBitmap(file);
    const max = 2000;
    const scale = Math.min(1, max/Math.max(bmp.width,bmp.height));
    const w=Math.max(1,Math.round(bmp.width*scale)), h=Math.max(1,Math.round(bmp.height*scale));
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const ctx=c.getContext('2d'); ctx.drawImage(bmp,0,0,w,h); bmp.close?.();
    const blob=await new Promise(res=>c.toBlob(res,'image/jpeg',.82));
    if(!blob) return file;
    const base=(file.name||'صورة').replace(/\.[^.]+$/,'');
    return new File([blob],base+'.jpg',{type:'image/jpeg',lastModified:Date.now()});
  }catch(e){ return file; }
}
/* 🎥 معالجة الفيديو: الحد الحقيقي للحجم هو 60 MB فقط.
   إذا تجاوز الفيديو 60 MB نضغطه كاملاً داخل جهاز الطالب بدون قص وبدون فرض مدة.
   مدة 5 دقائق مجرد توصية في الواجهة لأن التحويل يصبح أطول كلما زادت المدة.
   نستخدم Mediabunny فوق WebCodecs بدل Canvas/MediaRecorder. */
let videoProcessing=false, videoQueue=[];
let mediaToolkitPromise=null;

function getVideoDuration(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file), v=document.createElement('video');
    let done=false;
    const finish=(ok,val)=>{
      if(done) return; done=true;
      URL.revokeObjectURL(url);
      try{ v.removeAttribute('src'); v.load(); }catch{}
      ok?resolve(val):reject(val);
    };
    v.preload='metadata'; v.playsInline=true;
    v.onloadedmetadata=()=>Number.isFinite(v.duration)&&v.duration>0
      ? finish(true,v.duration) : finish(false,new Error('duration'));
    v.onerror=()=>finish(false,new Error('video'));
    v.src=url;
  });
}

async function loadMediaToolkit(){
  if(mediaToolkitPromise) return mediaToolkitPromise;
  mediaToolkitPromise=(async()=>{
    if(!('VideoDecoder' in window) || !('VideoEncoder' in window)) throw new Error('webcodecs');
    try{
      return await import('https://cdn.jsdelivr.net/npm/mediabunny@1.54.0/+esm');
    }catch(e){
      console.error('Mediabunny load failed:',e);
      throw new Error('toolkit');
    }
  })();
  return mediaToolkitPromise;
}

function showVideoProcessing(message='جاري تجهيز الفيديو…', percent=0){
  const box=$('file-status');
  if(box) box.textContent=message;
  const bar=$('file-progress'), bi=$('file-progress-i');
  if(bar&&bi){ bar.style.display='block'; bi.style.width=Math.max(0,Math.min(100,percent))+'%'; }
}

function videoBitrateFor(duration,targetBytes,audioBps){
  const total=Math.floor((targetBytes*8)/Math.max(0.5,duration));
  return Math.max(180000, Math.min(8000000, Math.floor((total-audioBps)*0.92)));
}

async function compressVideoWithMediabunny(file,targetBytes,pass=1){
  const MB=await loadMediaToolkit();
  const {
    Input, Output, Conversion, ALL_FORMATS, BlobSource, BufferTarget,
    Mp4OutputFormat, Quality, canEncodeVideo, canEncodeAudio
  }=MB;
  if(!Input||!Output||!Conversion||!BlobSource||!BufferTarget||!Mp4OutputFormat||!Quality) throw new Error('toolkit');

  const input=new Input({source:new BlobSource(file),formats:ALL_FORMATS});
  const output=new Output({format:new Mp4OutputFormat(),target:new BufferTarget()});
  const duration=await input.computeDuration();
  if(!Number.isFinite(duration)||duration<=0) throw new Error('duration');

  const audioBps=pass===1?64000:48000;
  const videoBps=videoBitrateFor(duration,targetBytes,audioBps);
  const maxWidth=pass===1?1280:960;

  // نتأكد من دعم الترميز قبل بدء عملية ثقيلة، لأن الآيفون ليس مشهوراً بحسن النية.
  if(canEncodeVideo && !(await canEncodeVideo('avc',{width:Math.min(maxWidth,1920),height:1080,bitrate:videoBps,hardwareAcceleration:'no-preference'}))) throw new Error('encode-video');
  const hasAac=canEncodeAudio ? await canEncodeAudio('aac',{bitrate:audioBps}) : true;

  const conversion=await Conversion.init({
    input,
    output,
    tracks:'primary',
    video: async track=>({
      codec:'avc',
      width:Math.min(maxWidth,await track.getDisplayWidth()),
      quality:new Quality({bitrate:videoBps}),
      frameRate:30,
      hardwareAcceleration:'no-preference',
      forceTranscode:true
    }),
    audio:hasAac ? {codec:'aac',quality:new Quality({bitrate:audioBps}),forceTranscode:true} : {discard:true},
    copy:false,
    showWarnings:false
  });
  if(!conversion.isValid) throw new Error('conversion');

  conversion.onProgress=p=>{
    const pct=Math.max(1,Math.min(99,Math.round(Number(p||0)*100)));
    showVideoProcessing(
      pass===1
        ? `جاري ضغط الفيديو على الجهاز… ${pct}%`
        : `لم يكفِ الضغط الأول، نجرب ضغطًا أقوى… ${pct}%`,
      pct
    );
  };

  await conversion.execute();
  const buf=output.target.buffer;
  if(!buf || !buf.byteLength) throw new Error('empty');
  const mime='video/mp4';
  return new File([buf],makeProcessedVideoName(file.name,mime),{type:mime,lastModified:Date.now()});
}

function makeProcessedVideoName(name,mime){
  const base=(name||'فيديو').replace(/\.[^.]+$/,'');
  return base+'-مضغوط.mp4';
}

async function compressVideoInBrowser(file){
  const duration=await getVideoDuration(file);
  if(!Number.isFinite(duration)||duration<=0) throw new Error('duration');

  // المحاولة الأولى: هدف 55 MB مع المحافظة على جودة جيدة.
  let out=await compressVideoWithMediabunny(file,55*1024*1024,1);
  if(out.size<=MAX_VIDEO_BYTES) return out;

  // المحاولة الثانية: هدف 50 MB ودقة أقل. لا قص، فقط ضغط أقوى.
  out=await compressVideoWithMediabunny(file,50*1024*1024,2);
  if(out.size>MAX_VIDEO_BYTES) throw new Error('still-big');
  return out;
}

async function videoTooBig(f){
  videoQueue.push(f);
  if(videoProcessing) return;
  videoProcessing=true;
  try{
    while(videoQueue.length){
      if(selectedFiles.length>=MAX_FILES){
        videoQueue=[];
        toast('تم الوصول إلى حد 5 ملفات، لذلك لم تتم إضافة بقية الفيديوهات.','bad');
        break;
      }
      const current=videoQueue.shift();
      const mb=Math.round(current.size/1024/1024);
      try{
        const secs=await getVideoDuration(current);
        if(!Number.isFinite(secs)||secs<=0) throw new Error('duration');
        const durationLabel=`${Math.floor(secs/60)}:${String(Math.round(secs%60)).padStart(2,'0')}`;
        // لا نبدأ ضغط فيديو طويل جداً إذا كان حجمه أصلاً فوق الحد.
        // 5 دقائق هنا حدّ وقائي لبدء المعالجة فقط، وليست حداً للحجم أو مدة الفيديو المقبولة مباشرة.
        if(secs>5*60){
          throw new Error('too-long-to-compress');
        }
        showVideoProcessing(`الفيديو ${mb} MB ومدته ${durationLabel} — سيتم ضغطه كاملاً بدون قص…`,2);
        const out=await compressVideoInBrowser(current);
        if(out.size>MAX_VIDEO_BYTES) throw new Error('still-big');
        selectedFiles.push(out);
        renderSelectedFiles();
        showVideoProcessing(`تم تجهيز الفيديو: ${formatFileSize(current.size)} ← ${formatFileSize(out.size)} ✅`,100);
        await new Promise(r=>setTimeout(r,350));
      }catch(e){
        console.error('video processing:',e);
        let msg='تعذر ضغط الفيديو على هذا الجهاز. حدّث Safari أو جرّب Chrome حديثًا.';
        if(e.message==='too-long-to-compress') msg='الفيديو أكبر من 60 MB ومدته أكثر من 5 دقائق. اختصر الفيديو إلى 5 دقائق أو أقل، أو منتجه/أعد تصويره ثم حاول رفعه مرة أخرى. لم تبدأ عملية الضغط لتجنب انتظار طويل.';
        else if(e.message==='still-big') msg='تم ضغط الفيديو كاملًا لكنه ما زال أكبر من 60 MB. خفّض جودة التصوير ثم أعد اختياره.';
        else if(e.message==='webcodecs' || e.message==='encode-video') msg='جهازك لا يتيح ترميز الفيديو المطلوب داخل المتصفح. حدّث iOS/Safari ثم أعد المحاولة.';
        else if(e.message==='toolkit') msg='تعذر تحميل أداة معالجة الفيديو. تحقق من اتصال الإنترنت ثم أعد المحاولة.';
        else if(e.message==='conversion') msg='تعذر إنشاء نسخة MP4 مضغوطة لهذا الفيديو. جرّب حفظه بصيغة MP4 ثم أعد اختياره.';
        toast(msg,'bad');
      }
    }
  }finally{
    videoProcessing=false;
    videoQueue=[];
    if($('file-progress')) $('file-progress').style.display='none';
  }
}

function fileTooBig(f){
  const mb=Math.round(f.size/1024/1024);
  toast(`الملف ${f.name} حجمه ${mb} MB، والحد الأقصى للصور وPDF هو 20 MB.`,'bad');
}

async function addSelectedFiles(list){
  const incoming=[...list];
  if(selectedFiles.length>=MAX_FILES){ toast('يمكن إرفاق 5 ملفات كحد أقصى','bad'); return; }
  for(const f of incoming){
    if(selectedFiles.length>=MAX_FILES){ toast('تم الوصول إلى حد 5 ملفات','bad'); break; }
    if(!fileAllowed(f)){ toast('المسموح صور أو PDF أو فيديو فقط','bad'); continue; }
    if(selectedFiles.some(x=>x.name===f.name && x.size===f.size)){ continue; }

    if(isVideoFile(f)){
      // الحد الحقيقي للحجم هو 60 MB. نفحص مدة الفيديو فقط إذا تجاوز هذا الحجم،
      // و5 دقائق حد وقائي يمنع بدء ضغط طويل جداً، وليس حداً على الفيديو المقبول مباشرة.
      if(f.size>MAX_VIDEO_BYTES){ videoTooBig(f); continue; }
      selectedFiles.push(f);
      continue;
    }

    if(f.size>MAX_FILE_BYTES){ fileTooBig(f); continue; }
    selectedFiles.push(f);
  }
  renderSelectedFiles();
}
function renderSelectedFiles(){
  const box=$('file-list'), btn=$('send-files'); if(!box) return;
  box.innerHTML=selectedFiles.map((f,i)=>`<div class="file-chip">
    <span>${f.type==='application/pdf'?'📄':isVideoFile(f)?'🎥':'🖼️'}</span><span class="file-name" title="${esc(f.name)}">${esc(f.name)}</span>
    <span class="file-size">${formatFileSize(f.size)}</span>
    <button class="file-remove" type="button" onclick="removeSelectedFile(${i})" aria-label="حذف الملف">×</button>
  </div>`).join('');
  if(btn) btn.disabled=!selectedFiles.length;
  if($('file-status')) $('file-status').textContent=selectedFiles.length ? `${selectedFiles.length} ملف جاهز للإرسال` : '';
}
function removeSelectedFile(i){ selectedFiles.splice(i,1); renderSelectedFiles(); }
/* 📋 بطاقة المطلوب: تُعرض قبل زر الرفع مباشرة كي يقرأها الطالب وهو
   على وشك التسليم لا وهو يتصفّح. نشاط بلا وصف لا يعرض شيئًا. */
function renderBrief(){
  const box=$('brief-box'); if(!box) return;
  const br=String(HW.br||'').trim(), dv=String(HW.dv||'').trim(), ac=String(HW.ac||'').trim();
  if(!br && !dv && !ac){ box.innerHTML=''; box.style.display='none'; return; }
  box.style.display='';
  box.innerHTML=`
    ${br?`<div class="brief-row"><span class="brief-k">📋 المطلوب</span><p>${esc(br)}</p></div>`:''}
    ${dv?`<div class="brief-row"><span class="brief-k">📎 تُسلّم</span><p>${esc(dv)}</p></div>`:''}
    ${ac?`<div class="brief-row ok"><span class="brief-k">✅ يُقبل إذا</span><p>${esc(ac)}</p></div>`:''}`;
}
async function submitFileWork(){
  if(!selectedFiles.length) return;
  const api=((HW&&HW.api)||API||'').replace(/\/+$/,'');
  if(!api){ toast('الخدمة غير متاحة حالياً','bad'); return; }
  const send=$('send-files'), status=$('file-status'), bar=$('file-progress'), bi=$('file-progress-i');
  send.disabled=true; bar.style.display='block'; bi.style.width='5%'; status.textContent='جاري تجهيز الملفات…';
  try{
    const prepared=[];
    for(let i=0;i<selectedFiles.length;i++){
      const f=await compressImage(selectedFiles[i]);
      if(f.size>capFor(f)) throw new Error('size');
      prepared.push(f); bi.style.width=Math.round(10+(i+1)/selectedFiles.length*25)+'%';
    }
    const fd=new FormData();
    fd.append('hw',HW.id); fd.append('name',myName); fd.append('sid',mySid||'');
    prepared.forEach(f=>fd.append('files',f,f.name));
    status.textContent='جاري رفع العمل…'; bi.style.width='45%';
    const r=await fetch(api+'/file-submit',{method:'POST',body:fd});
    const j=await r.json().catch(()=>({}));
    if(!r.ok || !j.ok) throw new Error(j.error||'upload');
    bi.style.width='100%'; status.textContent='تم رفع العمل وإرساله للمعلم ✅';
    markDone(myName);
    hide('s-files'); show('s-done');
    $('done-name').textContent=myName;
    $('done-score').textContent='✅';
    $('done-line').textContent=`تم إرسال ${prepared.length} ${prepared.length===1?'ملف':'ملفات'} للمعلم.`;
    $('sent-line').textContent='وصلت المرفقات بنجاح. يمكنك العودة إلى أنشطتك.';
    offerMore(myName);
  }catch(e){
    console.error('submitFileWork:',e);
    const already = e.message==='already_submitted';
    const expired = e.message==='resubmission window expired';
    status.textContent = e.message==='size' ? 'أحد الملفات تجاوز الحد المسموح.'
      : already ? 'سبق أن سلّمت هذا المشروع وهو عند المعلم. تُفتح إعادة الرفع فقط إذا رفضه المعلم أو سمح لك بإعادة التسليم.'
      : expired ? 'انتهت مهلة إعادة تسليم المشروع بعد الرفض. اطلب من معلمك السماح بإعادة التسليم.'
      : 'تعذّر رفع العمل — حاول مرة أخرى.';
    toast(already ? 'المشروع مُسلَّم مسبقًا' : expired ? 'انتهت مهلة إعادة التسليم' : 'تعذّر إرسال المرفقات','bad');
    if(already){ markDone(myName); send.disabled=true; return; }
    send.disabled=false;
  }
}
$('pick-files').onclick=()=>$('files-input').click();
$('files-input').onchange=e=>{ addSelectedFiles(e.target.files); e.target.value=''; };
$('send-files').onclick=submitFileWork;

// يبدأ الحل فعلياً
let startedAt = 0;
/* ⏱️ وتيرة الحل: لا «التالي» قبل وقت قراءة السؤال، ولا «إنهاء وتسليم» قبل الحد الكلي.
   القاعدة نفسها في الخادم (activityPace) وفي «السرعة المريبة» بلوحة المعلم:
   5 ث للسؤال · التشخيصي 4 ث · الفهم القرائي +زمن قراءة النص على السؤال الأول · الألعاب والأنماط بلا حد. */
function paceFor(hw){
  const k = String(hw && hw.kind || 'normal'), qn = Array.isArray(hw && hw.q) ? hw.q.length : 0;
  if(!qn || k==='games' || k==='game' || k==='files' || k==='style') return { perQ:0, minSecs:0, readSecs:0 };
  if(k==='diag') return { perQ:4, minSecs:qn*4, readSecs:0 };
  if(k==='reading'){
    const words = String((hw.reading && hw.reading.text) || (hw.rt && hw.rt.text) || '').split(/\s+/).filter(Boolean).length;
    const readSecs = Math.round(words/5);
    return { perQ:5, minSecs:qn*5 + readSecs, readSecs };
  }
  return { perQ:5, minSecs:qn*5, readSecs:0 };
}
const PACE = { perQ:0, minSecs:0, readSecs:0, readAt:0, spent:[], cur:-1, at:0, timer:0 };
/* 📖 وقت القراءة يُضاف على أول سؤال يظهر معه النص — لا على أسئلة «قبل القراءة» والنص مقفل فيها.
   المجموع (minSecs) لا يتغير، والخادم يتحقق من المجموع فقط. */
function paceReadAt(){
  try{
    const reading = HW && (HW.reading || HW.rt);
    if(!reading || !Array.isArray(HW.q)) return 0;
    const i = HW.q.findIndex(q => rdxMode(reading, q) === 'open');
    return i >= 0 ? i : 0;
  }catch(e){ return 0; }
}
function paceReset(){
  Object.assign(PACE, paceFor(HW), { readAt: paceReadAt(), spent: HW.q.map(()=>0), cur:-1, at:0 });
  clearInterval(PACE.timer); PACE.timer = setInterval(paceTick, 250);
  let hint = $('pace-hint');
  if(!hint){ const nav = $('q-next') && $('q-next').parentElement; if(nav){ nav.insertAdjacentHTML('afterend','<p id="pace-hint" class="pace-hint"></p>'); hint = $('pace-hint'); } }
  if(hint){ hint.textContent = PACE.perQ ? '⏳ اقرأ كل سؤال جيدًا — يُفتح زر الانتقال بعد لحظات.' : ''; hint.classList.toggle('hide', !PACE.perQ); }
}
function paceEnter(i){ const now = Date.now(); if(PACE.cur >= 0) PACE.spent[PACE.cur] += now - PACE.at; PACE.cur = i; PACE.at = now; }
function paceLeftMs(){
  if(!PACE.perQ || PACE.cur < 0) return 0;
  const need = (PACE.perQ + (PACE.cur === PACE.readAt ? PACE.readSecs : 0)) * 1000;   // النص يُقرأ عند أول ظهوره
  let left = need - (PACE.spent[PACE.cur] + (Date.now() - PACE.at));
  // الخادم يقيس من وصول طلب /start (بعد لحظة البدء هنا بزمن الشبكة): ثانيتان هامش حتى لا يُرفض طالب تأنّى فعلًا
  if(idx === HW.q.length - 1 && startedAt) left = Math.max(left, (PACE.minSecs + 2)*1000 - (Date.now() - startedAt));
  return Math.max(0, left);
}
function paceTick(){
  const b = $('q-next'), quiz = $('s-quiz');
  if(!b || !quiz || quiz.classList.contains('hide') || !HW || !HW.q) return;
  const base = idx === HW.q.length - 1 ? 'إنهاء وتسليم' : 'التالي';
  const left = paceLeftMs();
  if(left > 0){ b.disabled = true; b.textContent = `${base} (${Math.ceil(left/1000)})`; }
  else { b.textContent = base; b.disabled = !ready(); }
}
function paceStartServer(){
  const api = ((HW && HW.api) || API || '').replace(/\/+$/,'');
  if(!api || !HW || !HW.id) return;
  fetch(api + '/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ hw:HW.id, sid:mySid||'', name:myName||lockedName()||'' }) })
    .then(r => r.json()).then(j => { if(j && j.ok && Number.isFinite(j.minSecs)) Object.assign(PACE, { perQ:j.perQ, minSecs:j.minSecs, readSecs:j.readSecs||0 }); }).catch(()=>{});
}
function startSolving(){
  startedAt = Date.now();
  paceStartServer();
  hintUsed = {};
  ans = HW.q.map(()=>null);
  paceReset();
  built = HW.q.map(q=>{
    const k = q.t || 'q';
    if(k==='a') return { pool: shuffle(String(q.w||'').replace(/\s/g,'').split('')) };
    if(k==='s') return { pool: shuffle(String(q.s||'').trim().split(/\s+/)) };
    if(k==='m') return { right: shuffle((q.p||[]).map((x,i)=>({t:x[1], i}))), pick:null };
    return {};
  });
  hide('s-pre'); show('s-quiz'); render();
}

/* 💡 قائمة أسماء الفصل: يكتب، يرى اسمه، يضغط عليه — كما في البوابة تمامًا.
   كان الرابط المباشر يعرض اقتراحًا واحدًا فقط، وإن تعدد المطابقون ردّه
   برسالة «أضف كلمة أخرى» ولا يريه من هم. */
/* 🔒 لا تُعرض أسماء الزملاء. حين يطابق المكتوبُ أكثر من طالب نطلب الكلمة
   التالية من اسمه فقط، متدرّجين: الأب ← الجد ← اللقب ← الاسم كاملًا. */
function narrowMsg(count, typedCount){
  const ask = typedCount <= 1 ? 'أضف اسم أبيك'
            : typedCount === 2 ? 'أضف اسم جدّك'
            : typedCount === 3 ? 'أضف اسم العائلة'
            : 'اكتب اسمك كاملاً كما هو في الكشف';
  return `يوجد ${count} طلاب بهذا الاسم — ${ask}`;
}
function candidates(typed){ return resolveName(typed,HW.s||[]).hits || []; }
function hideWhoMatches(){ const e=$('who-matches'); if(e){ e.classList.add('hide'); e.innerHTML=''; } }
function renderWhoMatches(idxs, note){
  const box=$('who-matches'); if(!box) return;
  $('who-hint').classList.add('hide');
  box.classList.remove('hide');
  const cls = (HW && HW.cls) ? String(HW.cls) : '';
  box.innerHTML = (note?`<div class="muted" style="font-size:.8rem;padding:0 .2rem .1rem">${esc(note)}</div>`:'')
    + idxs.map(i=>`<button class="who-pick" data-i="${i}"
      style="width:100%;text-align:start;padding:.7rem .85rem;border-radius:11px;
      background:rgba(27,156,107,.09);border:1.5px solid var(--tick);color:var(--ink);
      font-family:inherit;font-size:.95rem;cursor:pointer">
      <b>${esc(HW.s[i]||'')}</b>${cls?`<span class="muted" style="font-size:.78rem;display:block">${esc(cls)}</span>`:''}
    </button>`).join('');
  box.querySelectorAll('.who-pick').forEach(b=>{
    b.onclick = ()=>{ const i=+b.dataset.i; $('who-in').value = HW.s[i];
      hideWhoMatches(); $('who-err').textContent=''; beginWith(i); };
  });
}
/* الرابط المباشر يطابق داخل كشف النشاط (فصل الطالب) — لا يرى الكشف كله.
   فالنشاط غير المسند لفصله لا يُظهر اسمه أصلًا. الأحكام نفسها في المسارين:
   اسم واحد ⇒ يدخل · أكثر ⇒ يُطلب اسم الأب ثم الجد ثم اللقب · لا قوائم. */
function updateHint(){
  const val=$('who-in').value;
  $('who-hint').classList.add('hide');
  if(!nameTokens(val).length){ hideWhoMatches(); $('who-err').textContent=''; return; }
  const r=resolveName(val,HW.s||[]);
  const hits = (r.idx!==undefined) ? [r.idx] : (r.hits||[]);
  if(hits.length === 1){
    hideWhoMatches();
    renderWhoMatches(hits, 'هل هذا أنت؟ اضغط للتأكيد');
    $('who-err').textContent='';
  }else if(hits.length > 1){
    hideWhoMatches();
    $('who-err').textContent = narrowMsg(hits.length, nameTokens(val).length);
  }else{
    hideWhoMatches();
    $('who-err').textContent='لم أجد اسمًا مطابقًا — تأكد من الكتابة';
  }
}

$('who-in').addEventListener('input', updateHint);

$('pre-go').onclick = ()=> startSolving();
$('pre-shop').onclick = ()=>{
  const box = $('pre-store');
  box.classList.toggle('hide');
  if(!box.classList.contains('hide')) renderStore('pre-store');
};

$('dp-in') && $('dp-in').addEventListener('input', e=>{
  e.target.value = e.target.value.replace(/\D/g,'').slice(0,4);
  if($('dp-err')) $('dp-err').textContent = '';
});
$('dp-in') && $('dp-in').addEventListener('keydown', e=>{ if(e.key==='Enter') $('dp-go').click(); });


$('who-go').onclick = ()=>{
  const val = $('who-in').value;
  const r = resolveName(val, HW.s||[]);
  if(r.idx!==undefined){ $('who-err').textContent=''; hideWhoMatches(); beginWith(r.idx); return; }
  if((r.hits||[]).length > 1){
    hideWhoMatches();
    $('who-err').textContent = narrowMsg(r.hits.length, nameTokens(val).length); return; }
  $('who-err').textContent = r.error==='short'
    ? 'اكتب اسمك أو جزءًا من اسمك' : 'لم أجد اسمًا مطابقًا — تأكد من الكتابة';
};
$('who-in').addEventListener('keydown', e=>{ if(e.key==='Enter') $('who-go').click(); });

$('who-go2').onclick = ()=>{
  const r = findStudent(lockedName());
  if(r.err){ $('who-form').classList.remove('hide'); $('who-locked').classList.add('hide'); return; }
  beginWith(r.idx);
};
$('who-switch').onclick = async ()=>{
  if(!await ask({ icon:'👤', title:'تغيير الاسم',
    msg:'هذا الجهاز مسجّل باسم ' + lockedName() + '.\nهل أنت طالب آخر فعلاً؟',
    yes:'نعم، أنا طالب آخر', no:'رجوع' })) return;
  if(!await ask({ icon:'⚠️', title:'تنبيه',
    msg:'سيُبلَّغ المعلم أن هذا الجهاز استُخدم لأكثر من طالب.', yes:'متابعة', no:'إلغاء' })) return;
  try{ localStorage.removeItem(NAME_KEY); localStorage.removeItem(SID_KEY); }catch(e){}
  mySid = '';
  $('who-locked').classList.add('hide'); $('who-form').classList.remove('hide');
  setTimeout(()=>$('who-in').focus(),50);
};

/* 🚪 البوابة: رابط واحد يعرض نشاطات الطالب */
const todayISO = () => new Date().toISOString().slice(0,10);

async function gateShow(){
  const homeBtn=$('activity-home'); if(homeBtn) homeBtn.classList.add('hide');
  show('s-gate');

  MYPTS = 0;
  MYPERKS = {};

  const storeToggle = $('gate-store-toggle');
  const storeBox = $('gate-store-box');
  const storeStatus = $('gate-store-status');

  if(storeToggle && !storeToggle.dataset.bound){
    storeToggle.dataset.bound = '1';
    storeToggle.onclick = ()=>{
      if(!myName) return;
      storeBox.classList.toggle('hide');
      storeToggle.textContent =
        storeBox.classList.contains('hide') ? 'فتح المتجر' : 'إخفاء المتجر';

      if(!storeBox.classList.contains('hide')){
        renderStore('gate-store-box');
      }
    };
  }

  if(storeToggle){
    storeToggle.disabled = true;
    storeToggle.textContent = 'فتح المتجر';
  }

  if(storeBox){
    storeBox.innerHTML = '';
    storeBox.classList.add('hide');
  }

  if(storeStatus){
    storeStatus.textContent = 'جارٍ تحميل بيانات الطالب…';
  }

  const lk = lockedName();

  if(lk){
    $('gate-name').textContent = lk;
    $('gate-known').classList.remove('hide');
    $('gate-form').classList.add('hide');
    await gateLoad(lk, { restored:true });
  }else if(storeStatus){
    storeStatus.textContent = 'اكتب اسم الطالب أولاً لعرض المتجر';
  }
}

/* ═══════════════════════════════════════════════════════════════
   🆔 الهوية: مسار واحد يسلكه الرابط المباشر والبوابة معًا.
   كان لكل منهما منطقه، فاختلفا في التقاط المعرف وفي معالجة الاسم
   المكرر — ومن هذا الاختلاف وحده جاءت أعطال الدخول. الشاشتان تبقيان
   مختلفتين (الرابط يبدأ نشاطًا، والبوابة تعرض قائمة)، أما القرار
   فمن هنا فقط.
   يعيد: {mode:'ok'} أو {mode:'ambiguous'} أو {mode:'ask', isNew}
   ═══════════════════════════════════════════════════════════════ */
async function resolveIdentity(nm, sid){
  const api = ((typeof HW!=='undefined' && HW && HW.api) || API || '').replace(/\/+$/,'');

  // ١) المعرف: من النشاط المنشور إن وُجد، وإلا مما وصل من البوابة،
  //    وإلا فمعرف الجهاز — ولا يُقبل معرف الجهاز إن كان الاسم غير اسمه.
  let id = String(sid || '');
  if(!id && typeof HW!=='undefined' && HW && HW.sm && HW.sm[nm]) id = String(HW.sm[nm]);
  if(!id && lockedName() === nm) id = mySid || '';
  setMySid(id);

  if(!api) return { mode:'ok' };

  // ٢) حالة الرمز — تُسأل بالمعرف متى توفّر، فيسقط التباس الأسماء المتشابهة
  let st = null;
  try{
    st = await (await fetch(api + '/pinstatus?name=' + encodeURIComponent(nm) + idQS())).json();
  }catch(e){ return { mode:'ok' }; }             // بلا إنترنت: لا نحجب الطالب
  if(!st || !st.ok) return { mode:'ok' };
  if(st.sid) setMySid(st.sid);
  if(st.ambiguous) return { mode:'ambiguous' };
  if(!st.enabled) return { mode:'ok' };          // نظام الرمز مطفأ عند المعلم
  if(lockedName() === nm && st.hasPin) return { mode:'ok' };   // مقفول على هذا الجهاز
  return { mode:'ask', isNew: !st.hasPin };
}

/* رسالة موحّدة لأخطاء الرمز — كانت مكتوبة مرتين فاختلفتا */
function pinErrText(err){
  return err === 'wrong'     ? 'رمز غير صحيح — نسيته؟ اطلبه من معلمك'
       : err === 'locked'    ? 'محاولات كثيرة — انتظر ربع ساعة أو اطلب من معلمك تصفير رمزك'
       : err === 'ambiguous' ? 'يوجد أكثر من طالب بهذا الاسم — اختر اسمك من القائمة'
       : 'أدخل 4 أرقام';
}

/* إرسال الرمز — نقطة واحدة تخدم الشاشتين */
async function sendPin(nm, pin){
  const api = ((typeof HW!=='undefined' && HW && HW.api) || API || '').replace(/\/+$/,'');
  const j = await (await fetch(api + '/pin', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ name: nm, sid: mySid||'', pin }) })).json();
  if(j && j.sid) setMySid(j.sid);
  if(j && j.ok) saveStoreSession(j);
  return j;
}

/* 🔐 نافذة الرمز للمتجر: تظهر فقط إن لم توجد جلسة صالحة.
   تعيد التوكن، أو '' إن ألغى الطالب. */
async function promptStorePin(){
  const nm = String(myName || lockedName() || '').trim();
  const api = ((typeof HW!=='undefined' && HW && HW.api) || API || '').replace(/\/+$/,'');
  if((!nm && !mySid) || !api) return '';
  let isNew = false;
  try{
    const st = await (await fetch(api + '/pinstatus?name=' + encodeURIComponent(nm) + idQS())).json();
    if(st && st.sid) setMySid(st.sid);
    if(st && st.ambiguous){ toast('يوجد أكثر من طالب بهذا الاسم — اختر اسمك من البوابة','bad'); return ''; }
    isNew = !(st && st.hasPin);
  }catch(e){ toast('تعذّر الاتصال','bad'); return ''; }
  return await new Promise(resolve=>{
    const box = document.createElement('div');
    box.id = 'store-pin';
    box.style.cssText = 'position:fixed;inset:0;z-index:70;background:rgba(22,35,58,.55);display:flex;align-items:center;justify-content:center;padding:1rem';
    box.innerHTML = `
      <div class="sheet" style="max-width:360px;width:100%;text-align:center">
        <h3 style="margin:.2rem 0 .3rem">${isNew ? '🔐 اختر رمزك السري' : '🔐 أدخل رمزك السري'}</h3>
        <p class="muted" style="font-size:.84rem;margin:0 0 .8rem">${isNew
          ? 'المتجر محمي برمز سري حتى لا يستطيع أحد الشراء من رصيدك.<br><b>أربعة أرقام — لا تخبر بها أحداً.</b>'
          : 'لحماية رصيدك، أدخل رمزك مرة واحدة على هذا الجهاز. نسيته؟ اطلبه من معلمك.'}</p>
        <input id="store-pin-in" inputmode="numeric" autocomplete="off" maxlength="4"
          style="direction:ltr;text-align:center;font-size:1.5rem;letter-spacing:.5rem;width:100%;padding:.5rem;border-radius:12px;border:1px solid rgba(0,0,0,.2)">
        <div id="store-pin-err" style="min-height:1.3rem;font-size:.82rem;color:#c0392b;margin:.4rem 0"></div>
        <div style="display:flex;gap:.5rem">
          <button class="btn tick" id="store-pin-go" style="flex:1">${isNew ? 'احفظ الرمز' : 'تأكيد'}</button>
          <button class="btn ghost" id="store-pin-no">إلغاء</button>
        </div>
      </div>`;
    document.body.appendChild(box);
    const inp = box.querySelector('#store-pin-in'), err = box.querySelector('#store-pin-err');
    const done = tok => { box.remove(); resolve(tok || ''); };
    inp.addEventListener('input', ()=>{ inp.value = inp.value.replace(/\D/g,'').slice(0,4); err.textContent=''; });
    const go = async ()=>{
      const pin = String(inp.value||'').trim();
      if(!/^\d{4}$/.test(pin)){ err.textContent = 'أدخل 4 أرقام'; return; }
      err.textContent = '…';
      try{
        const j = await sendPin(nm, pin);
        if(!j || !j.ok){ err.textContent = pinErrText(j && j.error); return; }
        if(!j.session){ err.textContent = 'تعذّر إنشاء الجلسة — راجع معلمك'; return; }
        if(isNew) toast('حُفظ رمزك — احفظه جيداً','good');
        done(j.session);
      }catch(e){ err.textContent = 'تعذّر الاتصال'; }
    };
    box.querySelector('#store-pin-go').onclick = go;
    inp.addEventListener('keydown', e=>{ if(e.key==='Enter') go(); });
    box.querySelector('#store-pin-no').onclick = ()=> done('');
    setTimeout(()=>inp.focus(), 80);
  });
}

/* 🛒 كل عمليات الصرف تمر من هنا: تُرفق الجلسة، وتطلب الرمز عند غيابها أو انتهائها.
   تعيد Response عاديًا حتى لا يتغير كود المستدعي. */
async function storeFetch(url, opts){
  const body = (()=>{ try{ return JSON.parse((opts && opts.body) || '{}') || {}; }catch(e){ return {}; } })();
  const synth = (j, status) => new Response(JSON.stringify(j), { status, headers:{'Content-Type':'application/json'} });
  const send = tok => fetch(url, { ...(opts||{}), method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...body, session: tok }) });
  let tok = getStoreSession();
  if(!tok){ tok = await promptStorePin(); if(!tok) return synth({ ok:false, error:'auth_cancel' }, 401); }
  let r = await send(tok);
  if(r.status === 401){
    clearStoreSession();
    tok = await promptStorePin();
    if(!tok) return synth({ ok:false, error:'auth_cancel' }, 401);
    r = await send(tok);
  }
  if(r.status === 503){
    const j = await r.clone().json().catch(()=>({}));
    if(j.error === 'setup_db' || j.error === 'setup_secret') toast('المتجر متوقف مؤقتًا حتى يُكمل المعلم إعداد الحماية — لم يُخصم شيء','bad');
  } else if(r.status === 429){
    toast('طلب آخر قيد التنفيذ — حاول بعد لحظة','bad');
  }
  return r;
}
function storeErrText(j, fallback){
  const e = j && j.error;
  return e === 'auth_cancel' ? 'أُلغيت العملية — لم يُخصم شيء'
       : e === 'setup_db' || e === 'setup_secret' ? 'المتجر متوقف مؤقتًا حتى يُكمل المعلم إعداد الحماية'
       : e === 'busy' ? 'طلب آخر قيد التنفيذ — حاول بعد لحظة'
       : fallback;
}

/* 🔐 يطلب الرمز في الرابط المباشر — يرجع true إن سُمح بالدخول */
function requirePin(nm){
  return new Promise(async resolve => {
    const state = await resolveIdentity(nm, '');
    if(state.mode === 'ok') return resolve(true);

    hide('s-who');
    show('s-pin');
    $('dp-who').textContent = nm;

    // اسمان متطابقان في الكشف: الرابط المباشر لا يملك قائمة اختيار،
    // وكان يعرض «اختر رمزك» ثم يرفض التسجيل بلا سبب مفهوم. نوجّهه للبوابة.
    if(state.mode === 'ambiguous'){
      $('dp-title').textContent = '👥 يوجد أكثر من طالب بهذا الاسم';
      $('dp-sub').innerHTML = 'افتح البوابة الرئيسية واختر اسمك من القائمة مرة واحدة، ثم ارجع لهذا الرابط.';
      $('dp-err').textContent = '';
      $('dp-in').value = '';
      $('dp-in').classList.add('hide');
      $('dp-go').textContent = '🚪 افتح البوابة الرئيسية';
      $('dp-go').onclick = ()=>{ location.href = location.pathname; };
      $('dp-back').onclick = ()=>{
        $('dp-in').classList.remove('hide');
        hide('s-pin'); show('s-who'); resolve(false);
      };
      return;
    }

    const isNew = state.isNew;
    $('dp-title').textContent = isNew ? '🔐 اختر رمزك السري' : '🔐 أدخل رمزك السري';
    $('dp-sub').innerHTML = isNew
      ? 'أربعة أرقام تحفظها — ستحتاجها عند الدخول من جهاز آخر.<br><b>لا تخبر بها أحداً.</b>'
      : 'الرمز الذي اخترته سابقاً. نسيته؟ اطلبه من معلمك.';
    $('dp-in').classList.remove('hide');
    $('dp-in').value = ''; $('dp-err').textContent = '';
    $('dp-go').textContent = isNew ? 'احفظ الرمز وابدأ' : 'دخول';
    setTimeout(()=>$('dp-in').focus(), 80);

    $('dp-go').onclick = async ()=>{
      const pin = String($('dp-in').value||'').trim();
      if(!/^\d{4}$/.test(pin)){ $('dp-err').textContent = 'أدخل 4 أرقام'; return; }
      $('dp-err').textContent = '…';
      try{
        const j = await sendPin(nm, pin);
        if(!j.ok){ $('dp-err').textContent = pinErrText(j.error); return; }
        hide('s-pin');
        if(isNew) toast('حُفظ رمزك — احفظه جيداً','good');
        resolve(true);
      }catch(e){ $('dp-err').textContent = 'تعذّر الاتصال'; }
    };
    $('dp-back').onclick = ()=>{ hide('s-pin'); show('s-who'); resolve(false); };
  });
}

/* 🔐 بوابة الرمز السري — نفس قرار الرابط المباشر، بشاشة البوابة */
async function gateAfterName(nm, sid){
  const state = await resolveIdentity(nm, sid);
  if(state.mode === 'ambiguous'){
    $('gate-err').textContent = 'يوجد أكثر من طالب بهذا الاسم — اختر اسمك من القائمة';
    return;
  }
  if(state.mode === 'ok'){ finishGate(nm); return; }
  askPin(nm, state.isNew);
}

function finishGate(nm){
  setLockedName(nm);
  $('gate-name').textContent = nm;
  $('gate-known').classList.remove('hide');
  $('gate-form').classList.add('hide');
  $('gate-pin').classList.add('hide');
  gateLoad(nm);
}

function askPin(nm, isNew){
  $('gate-form').classList.add('hide');
  $('gate-known').classList.add('hide');
  $('gate-pin').classList.remove('hide');
  $('pin-who').textContent = nm;
  $('pin-title').textContent = isNew ? '🔐 اختر رمزك السري' : '🔐 أدخل رمزك السري';
  $('pin-sub').innerHTML = isNew
    ? 'أربعة أرقام تحفظها — ستحتاجها عند الدخول من جهاز آخر.<br><b>لا تخبر بها أحداً.</b>'
    : 'الرمز الذي اخترته سابقاً. نسيته؟ اطلبه من معلمك.';
  $('pin-in').value = '';
  $('pin-err').textContent = '';
  $('pin-go').textContent = isNew ? 'احفظ الرمز وابدأ' : 'دخول';
  $('pin-go').dataset.nm = nm;
  $('pin-go').dataset.new = isNew ? '1' : '';
  setTimeout(()=>$('pin-in').focus(), 80);
}

async function submitPin(){
  const nm = $('pin-go').dataset.nm;
  const isNew = $('pin-go').dataset.new === '1';
  const pin = String($('pin-in').value || '').trim();
  if(!/^\d{4}$/.test(pin)){ $('pin-err').textContent = 'أدخل 4 أرقام'; return; }
  $('pin-err').textContent = '…';
  try{
    const j = await sendPin(nm, pin);
    if(!j.ok){ $('pin-err').textContent = pinErrText(j.error); return; }
    $('pin-err').textContent = '';
    if(isNew) toast('حُفظ رمزك — احفظه جيداً','good');
    finishGate(nm);
  }catch(e){ $('pin-err').textContent = 'تعذّر الاتصال'; }
}

$('pin-go') && ($('pin-go').onclick = ()=> submitPin());
$('pin-in') && $('pin-in').addEventListener('keydown', e=>{ if(e.key==='Enter') submitPin(); });
$('pin-in') && $('pin-in').addEventListener('input', e=>{
  e.target.value = e.target.value.replace(/\D/g,'').slice(0,4);
  if($('pin-err')) $('pin-err').textContent='';
});
$('pin-back') && ($('pin-back').onclick = ()=>{
  $('gate-pin').classList.add('hide');
  $('gate-form').classList.remove('hide');
  $('gate-in').value = ''; $('gate-in').focus();
});

// 💡 اقتراح حي: بعد جزأين يسأل الخادم عن الاسم الكامل
let _gT = null;
$('gate-in') && $('gate-in').addEventListener('input', ()=>{
  clearTimeout(_gT);
  const q = $('gate-in').value.trim();
  $('gate-hint').classList.add('hide');
  if(!q) { $('gate-err').textContent=''; return; }
  $('gate-err').textContent = '…';
  _gT = setTimeout(async ()=>{
    const api = (API||'').replace(/\/+$/,''); if(!api) return;
    try{
      const j = await (await fetch(api + '/find', { method:'POST',
        headers:{'Content-Type':'application/json'}, body: JSON.stringify({ q }) })).json();
      hideGateMatches();
      // اعرض القائمة دائمًا — واحدًا كان أو عشرين. الطالب يختار بلمسة
      // بدل أن يُطلب منه «أضف اسمًا آخر» وهو لا يعرف كم يلزم.
      if(j.ok && Array.isArray(j.matches) && j.matches.length === 1){
        $('gate-hint').classList.add('hide');
        renderGateMatches(j.matches, 'هل هذا أنت؟ اضغط للتأكيد');
        $('gate-err').textContent = '';
      } else if(j.error === 'many'){
        $('gate-err').textContent = narrowMsg(j.total, j.typed || nameTokens(q).length);
      } else if(j.error === 'none'){
        $('gate-err').textContent = 'لم أجد اسمًا مطابقًا — تأكد من الكتابة';
      } else if(j.error === 'short'){
        $('gate-err').textContent = 'اكتب اسم الطالب';
      } else { $('gate-err').textContent = ''; }
    }catch(e){ $('gate-err').textContent = ''; }
  }, 250);
});

function hideGateMatches(){ const e=$('gate-matches'); if(e){ e.classList.add('hide'); e.innerHTML=''; } }
/* قائمة الأسماء: يكتب الطالب، يرى اسمه، يضغط عليه. كانت هذه الدالة
   مكتوبة ولا تُستدعى قط، فكان الطالب يُواجه برسالة خطأ بدل قائمة. */
function renderGateMatches(list, note){
  const box = $('gate-matches'); if(!box) return;
  $('gate-hint').classList.add('hide');
  box.classList.remove('hide');
  box.innerHTML = (note ? `<div class="muted" style="font-size:.8rem;padding:0 .2rem .1rem">${esc(note)}</div>` : '')
    + list.map(m=>`<button class="gate-pick" data-sid="${esc(m.id||'')}" data-nm="${esc(m.name||'')}"
      style="width:100%;text-align:start;padding:.7rem .85rem;border-radius:11px;
      background:rgba(27,156,107,.09);border:1.5px solid var(--tick);color:var(--ink);
      font-family:inherit;font-size:.95rem;cursor:pointer">
      <b>${esc(m.name||'')}</b>${m.cls?`<span class="muted" style="font-size:.78rem;display:block">${esc(m.cls)}</span>`:''}
    </button>`).join('');
  box.querySelectorAll('.gate-pick').forEach(b=>{
    b.onclick = async ()=>{
      const nm = b.dataset.nm, sid = b.dataset.sid;
      $('gate-in').value = nm;
      hideGateMatches();
      $('gate-err').textContent = '';
      await gateAfterName(nm, sid);
    };
  });
}

$('gate-suggest') && ($('gate-suggest').onclick = async ()=>{
  const nm = $('gate-suggest').dataset.nm;
  const sid = $('gate-suggest').dataset.sid || '';
  $('gate-in').value = nm;
  $('gate-hint').classList.add('hide');
  await gateAfterName(nm, sid);
});

$('gate-go') && ($('gate-go').onclick = async ()=>{
  const q = $('gate-in').value.trim();
  const api = (API||'').replace(/\/+$/,'');
  if(!api){ $('gate-err').textContent = 'الخدمة غير متاحة حالياً'; return; }
  $('gate-err').textContent = 'جارٍ البحث…';
  try{
    const r = await fetch(api + '/find', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ q }) });
    const j = await r.json();
    if(!j.ok || !Array.isArray(j.matches) || j.matches.length !== 1){
      $('gate-err').textContent = j.error==='short' ? 'اكتب اسم الطالب'
        : j.error==='many' ? narrowMsg(j.total, j.typed || nameTokens(q).length)
        : 'لم أجد اسمًا مطابقًا — تأكد من الكتابة';
      return;
    }
    $('gate-err').textContent = '';
    await gateAfterName(j.matches[0].name, j.matches[0].id || '');
  }catch(e){ $('gate-err').textContent = 'تعذّر الاتصال — تحقق من الإنترنت'; }
});

/* 🧹 إعادة البوابة إلى حقل الاسم — يستعملها زر «لست أنا» وكذلك اكتشافُ
   أن الطالب المحفوظ لم يعد في الكشف. كانت مكتوبة في مكان واحد فقط. */
function resetGateToNameForm(){
  $('gate-known').classList.add('hide');
  $('gate-form').classList.remove('hide');
  $('gate-list').innerHTML = '';
  $('gate-bal').innerHTML = '';
  $('gate-board').innerHTML = '';

  // 🧹 عند الضغط على «لست أنا» نعيد الصفحة بالكامل إلى حالة إدخال الاسم.
  // كانت بطاقة «رحلتك التعليمية / خطوتك التالية واضحة» تبقى ظاهرة لأنها
  // مستقلة عن gate-space، فتظهر بيانات الطالب السابق للطالب الجديد.
  const journey = $('student-journey');
  if(journey) journey.classList.add('hide');
  const journeyWorkspace = $('journey-workspace');
  if(journeyWorkspace) journeyWorkspace.classList.add('hide');
  const allActivities = $('all-activities-panel');
  if(allActivities) allActivities.classList.add('hide');
  // 📄 «تقريري» لا يظهر إلا بعد الدخول، وعند الخروج يُفرَّغ حتى لا يرى الطالب التالي تقارير من قبله
  const myRep = $('my-report-panel');
  if(myRep){ myRep.classList.add('hide'); myRep.classList.remove('mr-has-new');
    ['my-report-box','my-report-alert','my-report-new','my-report-new-p','my-report-ping'].forEach(id=>{ const e=$(id); if(e) e.classList.add('hide'); });
    const mb=$('my-report-box'); if(mb) mb.innerHTML=''; const ch=$('my-report-chev'); if(ch) ch.textContent='⌄'; }
  try{ WEEKLY_MSGS=[]; SREP_MSGS=[]; Object.assign(MYREP,{open:false,reports:[],idx:0,wk:0,tab:'',loaded:false}); REP_SEEN_SRV=new Set(); }catch(e){}

  // 🧹 «مساحتك التعليمية» أُضيفت بعد كتابة هذا الزر فبقيت ظاهرة: اسم الطالب
  // السابق وتنبيهاته يراهما الطالب التالي على نفس الجهاز. نُعيدها لحالتها الأولى.
  const space = $('gate-space');
  if(space){
    space.classList.add('hide');
    const g = $('space-greeting'); if(g) g.textContent = 'مساحتك التعليمية';
    const nx = $('space-next'); if(nx) nx.textContent = 'جارٍ التحميل…';
    const pg = $('space-progress'); if(pg) pg.textContent = '—';
    const nl = $('space-notices-list');
    if(nl) nl.innerHTML = '<div class="space-empty">لا توجد تنبيهات جديدة</div>';
    const un = $('space-unread'); if(un) un.classList.add('hide');
  }
  try{ ptReset(); }catch(e){}
  { const sr=document.getElementById('space-review'); if(sr) sr.innerHTML=''; const sa=document.getElementById('space-ann'); if(sa) sa.innerHTML=''; const sp=document.getElementById('space-plan'); if(sp) sp.innerHTML=''; }
  const gpin = $('gate-pin'); if(gpin) gpin.classList.add('hide');
  { const gs=$('gate-store'); if(gs) gs.classList.add('hide'); }   // 🛒 المتجر لا يظهر قبل الدخول

  const storeBox = $('gate-store-box');
  const storeToggle = $('gate-store-toggle');
  const storeStatus = $('gate-store-status');

  if(storeBox){
    storeBox.innerHTML = '';
    storeBox.classList.add('hide');
  }
  if(storeToggle){
    storeToggle.disabled = true;
    storeToggle.textContent = 'فتح المتجر';
  }
  if(storeStatus){
    storeStatus.textContent = 'اكتب اسم الطالب أولاً لعرض المتجر';
  }

}

$('gate-switch') && ($('gate-switch').onclick = async ()=>{
  if(!await ask({ icon:'👤', title:'تغيير الاسم',
    msg:'هذا الجهاز مسجّل باسم ' + lockedName() + '.\nهل أنت طالب آخر فعلاً؟',
    yes:'نعم', no:'رجوع' })) return;
  try{ localStorage.removeItem(NAME_KEY); localStorage.removeItem(SID_KEY); }catch(e){}
  mySid = '';

  myName = '';
  MYPTS = 0;
  MYPERKS = {};

  resetGateToNameForm();
  setTimeout(()=>$('gate-in').focus(),50);
});

/* 🔁 استخدام بطاقة إعادة المحاولة من بوابة الطالب */
async function startRetryFromGate(hwId, nm){
  const api = (API || '').replace(/\/+$/,'');

  const confirmed = await ask({
    icon:'🔁',
    title:'إعادة محاولة النشاط',
    msg:'لديك بطاقة إعادة محاولة لهذا النشاط.\nهل تريد استخدامها وإعادة الحل؟',
    yes:'نعم، أعد الحل',
    no:'إلغاء'
  });

  if(!confirmed) return;

  try{
    const r = await storeFetch(api + '/use', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ name:nm, sid:mySid||'', card:'retry', hw:hwId })
    });

    const j = await r.json();

    if(!r.ok || !j.ok){
      toast(
        j && j.error === 'none'
          ? 'لا تملك بطاقة إعادة محاولة'
          : 'تعذّر استخدام بطاقة إعادة المحاولة',
        'bad'
      );
      return;
    }

    try{
      localStorage.removeItem('hwdone_' + hwId + '__' + nm);
    }catch(e){}

    location.hash = hwId;
    location.reload();
  }catch(e){
    toast('تعذّر الاتصال — حاول لاحقاً','bad');
  }
}

/* ═══ 🔎 مهمة التصحيح — بدل «تمت المراجعة» ═══
   الطالب يعيد حل ما أخطأ فيه فقط، سؤالًا سؤالًا، بمحاولة واحدة، ولا يُقبل جوابه قبل مهلة قراءة يفرضها الخادم.
   نص السبب يأتي من الخادم (review.text) فيتطابق في البطاقة والتنبيه. */
function rtReviewText(h){ return (h && h.review && h.review.text) || 'طلب منك معلمك مراجعة إجاباتك في هذا النشاط.'; }
function rtTaskLine(h, plain){
  const n = h && h.review ? Number(h.review.wrong) : null;
  if(n === 0) return plain ? 'إجاباتك صحيحة — أكّد أنك ستتأنى.' : 'إجاباتك كانت صحيحة، لكن خذ وقتك في النشاط القادم.';
  if(n > 0) return plain ? `أعد حل ${n} ${n===1?'سؤال':n===2?'سؤالين':'أسئلة'} أخطأت فيها.` : `المطلوب: أعد حل <b>${n}</b> ${n===1?'سؤال':n===2?'سؤالين':'أسئلة'} أخطأت فيها — بتأنٍّ، ومحاولة واحدة لكل سؤال.`;
  return plain ? '' : 'أعد حل الأسئلة التي أخطأت فيها بتأنٍّ.';
}
const RT = { hw:'', nm:'', data:null, idx:0, timer:0 };
function rtApi(){ return ((typeof HW!=='undefined' && HW && HW.api) || API || '').replace(/\/+$/,''); }
async function rtPost(path, body){
  const r = await storeFetch(rtApi()+path, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const j = await r.json().catch(()=>({}));
  return { status: r.status, j };
}
function rtClose(refresh){
  clearInterval(RT.timer); document.getElementById('rt-sheet')?.remove(); document.body.style.overflow='';
  if(refresh && RT.nm) gateLoad(RT.nm);
}
async function openReviewTask(hwId, nm){
  RT.hw = hwId; RT.nm = nm || myName; RT.idx = 0;
  document.getElementById('rt-sheet')?.remove();
  const box = document.createElement('div'); box.id='rt-sheet'; box.className='rt-sheet';
  box.innerHTML = '<div class="rt-panel"><p class="muted center" style="margin:2rem 0">جارٍ تجهيز مهمة التصحيح…</p></div>';
  document.body.appendChild(box); document.body.style.overflow='hidden';
  const { status, j } = await rtPost('/review-task/start', { hwId });
  if(!j.ok){
    const msg = j.error==='auth_cancel' ? 'يلزم رمزك السري لبدء المهمة.' : j.error==='no_request' ? 'لا توجد مراجعة مطلوبة لهذا النشاط الآن.' : 'تعذّر فتح المهمة — حاول لاحقًا.';
    box.querySelector('.rt-panel').innerHTML = `<p class="center" style="margin:1.5rem 0">${msg}</p><button class="btn ghost" onclick="rtClose(${j.error==='no_request'})">إغلاق</button>`;
    return;
  }
  RT.data = j;
  RT.idx = j.items.findIndex(q => !j.answered[q.i]); if(RT.idx < 0) RT.idx = j.items.length;
  rtRender(j.waitMs);
}
function rtHead(){
  const j = RT.data, n = j.items.length;
  const done = Math.min(RT.idx, n);
  return `<div class="rt-top"><b>🔎 مهمة التصحيح</b><button class="rt-x" onclick="rtClose(false)" aria-label="إغلاق">✕</button></div>
    <div class="rt-title">«${esc(j.title||'النشاط')}»</div>
    <div class="rt-reason">${esc(j.reason && j.reason.text || '')}</div>
    ${n?`<div class="rt-prog"><span style="width:${Math.round(done/n*100)}%"></span></div><div class="rt-step">${done<n?`سؤال ${done+1} من ${n}`:'اكتملت الأسئلة'}</div>`:''}`;
}
function rtCountdown(ms, btn){
  clearInterval(RT.timer);
  const end = Date.now() + Math.max(0, ms||0);
  const label = btn.dataset.label;
  const tick = () => {
    const s = Math.ceil((end - Date.now())/1000);
    if(s > 0){ btn.disabled = true; btn.textContent = `${label} (${s})`; }
    else { clearInterval(RT.timer); btn.textContent = label; btn.disabled = !rtHasAnswer(); btn.dataset.ready='1'; }
  };
  btn.dataset.ready=''; tick(); RT.timer = setInterval(tick, 250);
}
function rtHasAnswer(){
  const q = RT.data.items[RT.idx]; if(!q) return false;
  if(!q.auto) return true;
  if(q.t==='f') return !!String(document.getElementById('rt-f')?.value||'').trim();
  return document.querySelector('#rt-sheet .rt-opt.sel') !== null;
}
function rtRender(waitMs){
  const j = RT.data, panel = document.querySelector('#rt-sheet .rt-panel'); if(!panel) return;
  if(!j.items.length){
    panel.innerHTML = rtHead() + `<div class="rt-q"><p style="margin:0;line-height:1.9">✅ إجاباتك في هذا النشاط كانت صحيحة.<br>معلمك يطلب منك فقط أن تأخذ وقتك في قراءة الأسئلة في المرات القادمة.</p></div>
      <button class="btn tick rt-confirm" data-label="✓ فهمت، سأتأنّى" onclick="rtAck(this)">✓ فهمت، سأتأنّى</button>`;
    rtCountdown(waitMs, panel.querySelector('.rt-confirm')); return;
  }
  if(RT.idx >= j.items.length){ rtSummary(); return; }
  const q = j.items[RT.idx];
  let body = '';
  if(q.t==='q') body = `<div class="rt-opts">${q.o.map((o,k)=>`<button type="button" class="rt-opt" data-v="${k}">${esc(o)}</button>`).join('')}</div>`;
  else if(q.t==='tf') body = `<div class="rt-opts two"><button type="button" class="rt-opt" data-v="true">✓ صح</button><button type="button" class="rt-opt" data-v="false">✗ خطأ</button></div>`;
  else if(q.t==='f') body = `<input id="rt-f" class="inp" autocomplete="off" placeholder="اكتب الإجابة">`;
  else body = `<div class="rt-right">الإجابة الصحيحة:<br><b>${esc(q.right||'')}</b></div><p class="muted" style="font-size:.8rem;margin:.4rem 0 0">اقرأها جيدًا ثم اضغط «اطّلعت».</p>`;
  panel.innerHTML = rtHead() + `<div class="rt-q">
      <div class="rt-qt">${esc(q.q||'')}</div>
      ${q.prev && q.prev!=='—' ? `<div class="rt-prev">إجابتك السابقة: <s>${esc(q.prev)}</s> ✗</div>`:''}
      ${body}</div>
    <div id="rt-fb"></div>
    <button class="btn tick rt-confirm" data-label="${q.auto?'تأكيد الإجابة':'اطّلعت'}" onclick="rtAnswer(this)">${q.auto?'تأكيد الإجابة':'اطّلعت'}</button>
    <p class="rt-hint">⏳ اقرأ السؤال جيدًا — يُفتح زر التأكيد بعد لحظات، ولكل سؤال محاولة واحدة.</p>`;
  const btn = panel.querySelector('.rt-confirm');
  panel.querySelectorAll('.rt-opt').forEach(b => b.onclick = () => { panel.querySelectorAll('.rt-opt').forEach(x=>x.classList.remove('sel')); b.classList.add('sel'); if(btn.dataset.ready) btn.disabled=false; });
  const f = document.getElementById('rt-f'); if(f) f.oninput = () => { if(btn.dataset.ready) btn.disabled = !f.value.trim(); };
  rtCountdown(waitMs, btn);
}
async function rtAnswer(btn){
  const q = RT.data.items[RT.idx]; if(!q || btn.disabled) return;
  let a = 'seen';
  if(q.t==='q') a = Number(document.querySelector('#rt-sheet .rt-opt.sel')?.dataset.v);
  else if(q.t==='tf') a = document.querySelector('#rt-sheet .rt-opt.sel')?.dataset.v === 'true';
  else if(q.t==='f') a = String(document.getElementById('rt-f')?.value||'').trim();
  btn.disabled = true; btn.textContent = '…';
  const { status, j } = await rtPost('/review-task/answer', { hwId: RT.hw, qi: q.i, a });
  if(status === 429 && j.error === 'too_fast'){ btn.textContent = btn.dataset.label; rtCountdown(j.waitMs, btn); toast('خذ وقتك في قراءة السؤال','bad'); return; }
  if(!j.ok && j.error !== 'already'){ btn.disabled=false; btn.textContent=btn.dataset.label; toast(j.error==='auth_cancel'?'يلزم رمزك السري':'تعذّر الإرسال — حاول مجددًا','bad'); return; }
  RT.data.answered[q.i] = { ok: j.correct ?? null, right: j.right };
  document.querySelectorAll('#rt-sheet .rt-opt').forEach(b => b.disabled = true);
  const fb = document.getElementById('rt-fb');
  fb.innerHTML = j.correct === true ? '<div class="rt-fb ok">✓ إجابة صحيحة — أحسنت التصحيح</div>'
    : j.correct === false ? `<div class="rt-fb no">✗ ليست صحيحة. الإجابة الصحيحة: <b>${esc(j.right||'')}</b></div>`
    : '<div class="rt-fb seen">✓ سُجّل اطّلاعك</div>';
  if(j.done){ RT.result = j.result; btn.remove(); fb.insertAdjacentHTML('beforeend','<button class="btn tick rt-confirm" onclick="rtSummary()">عرض النتيجة ←</button>'); return; }
  btn.remove(); fb.insertAdjacentHTML('beforeend','<button class="btn tick rt-confirm" onclick="RT.idx++;rtRender(8000)">السؤال التالي ←</button>');
}
async function rtAck(btn){
  if(btn.disabled) return; btn.disabled = true;
  const { status, j } = await rtPost('/review-task/ack', { hwId: RT.hw });
  if(status === 429){ rtCountdown(j.waitMs, btn); return; }
  if(!j.ok){ btn.disabled=false; toast('تعذّر الإرسال','bad'); return; }
  RT.result = j.result; rtSummary();
}
function rtSummary(){
  clearInterval(RT.timer);
  const panel = document.querySelector('#rt-sheet .rt-panel'); if(!panel) return;
  const vals = Object.values(RT.data.answered||{}), auto = vals.filter(x=>x.ok!==null).length, fixed = vals.filter(x=>x.ok===true).length;
  const msg = !RT.data.items.length ? 'شكرًا لتأكيدك — أُبلغ معلمك.'
    : fixed === auto ? `ممتاز! صحّحت كل الأسئلة (${fixed} من ${auto}).`
    : `صحّحت ${fixed} من ${auto}. راجع الإجابات الصحيحة التي ظهرت لك قبل النشاط القادم.`;
  panel.innerHTML = rtHead() + `<div class="rt-done"><div class="rt-big">${!RT.data.items.length||fixed===auto?'🌟':'💪'}</div><b>${msg}</b>
    <p class="muted" style="margin:.4rem 0 0;font-size:.84rem">أُرسلت نتيجة المراجعة إلى معلمك.</p></div>
    <button class="btn tick rt-confirm" onclick="rtClose(true)">إنهاء</button>`;
}

async function completeReviewRequest(hwId, nm){
  try{
    const api=(API||'').replace(/\/+$/,'');
    const r=await fetch(api+'/review-request/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:nm,sid:mySid||'',hwId})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok || !j.ok) throw new Error(j.error||'failed');
    await gateLoad(nm);
  }catch(e){
    const box=document.getElementById('gate-list');
    if(box) { const old=box.querySelector('.review-error'); if(old) old.remove(); box.insertAdjacentHTML('afterbegin','<div class="review-error" style="padding:.6rem;color:#B4232F">تعذّر تسجيل المراجعة، حاول مرة أخرى.</div>'); }
  }
}

/* ═══════════════════════════════════════════════════════════════
   💬 رسائل المعلم — مصدر واحد يخدم البوابة والرابط المباشر معًا.
   كانت تُقرأ في البوابة فقط، والطالب يصله رابط النشاط من مدرستي
   ولا يفتح البوابة أصلًا — فلا تصله رسالة معلمه إطلاقًا.
   ═══════════════════════════════════════════════════════════════ */
const MSG_SEEN_KEY = 'hw_msgseen_v1';
function seenMsgIds(){
  try{ const v=JSON.parse(localStorage.getItem(MSG_SEEN_KEY)||'[]'); return Array.isArray(v)?v:[]; }catch(e){ return []; }
}
function markMsgsSeen(ids){
  try{
    const set = new Set(seenMsgIds().concat(ids.filter(Boolean)));
    localStorage.setItem(MSG_SEEN_KEY, JSON.stringify([...set].slice(-200)));
  }catch(e){}
}
const MSG_ICON = { exam:'🗓️', warning:'⚠️', achievement:'⭐', activity:'📚', cert:'🏅', weekly:'📊', thanks:'💌', reply:'📩' };
const MSG_RANK = { urgent:0, important:1, normal:2 };
/* ⏳ مدة ظهور الرسالة في التنبيهات: تاريخ انتهاء صريح إن وُجد، وإلا حسب نوعها.
   الاختبار يبقى حتى يوم الاختبار، والتقرير الأسبوعي مكانه «تقريري» لا التنبيهات. */
const MSG_TTL_DAYS = { thanks:14, cert:30, achievement:21, warning:14, activity:14, message:21, reply:21 };
function msgActive(m){
  const now=Date.now();
  if(m.expiresAt){ const t=Date.parse(m.expiresAt); if(t && t<now) return false; }
  if(m.examDate){ const t=Date.parse(String(m.examDate).slice(0,10)+'T23:59:59+03:00'); if(t) return t>=now; }
  const at=Date.parse(m.createdAt||'')||0; if(!at) return true;
  const days=MSG_TTL_DAYS[isThanksMsg(m)?'thanks':m.type]||MSG_TTL_DAYS.message;
  return now-at < days*864e5;
}
const msgTime = m => Date.parse(m.createdAt||'')||0;
/* الأحدث في الأعلى؛ والعاجل الجديد وحده يتقدّم */
const msgOrder = (a,b) => ((b.priority==='urgent'&&b.isNew)?1:0)-((a.priority==='urgent'&&a.isNew)?1:0) || (b.at||0)-(a.at||0);
let WEEKLY_MSGS = [], SREP_MSGS = [];

/* يعيد مصفوفة الرسائل جاهزة، أو null إن تعذّر الوصول (فرق مهم:
   «لا رسائل» غير «لم أستطع الجلب» — والثانية يجب أن تُعرض لا تُبتلع). */
/* 🧹 تنظيف من المنبع: سطر البيانات ⟨WK⟩ يُنزع فور وصول الرسالة وتُعلَّق
   الأرقام عليها. البوابة تعرض الرسائل في أكثر من مكان — والتنظيف في
   موضع واحد أوثق من تذكّر كل موضع عرض؛ فقد نسيت أحدها فعلًا. */
function msgSanitize(list){
  return (list||[]).map(m=>{
    if(!m || typeof m.body!=='string') return m;
    const xi = m.body.indexOf('⟨EX⟩');
    if(xi >= 0){ let ex=null; try{ ex=JSON.parse(m.body.slice(xi+4)); }catch(e){} return Object.assign({}, m, { body: m.body.slice(0,xi).trim(), ex }); }
    const i = m.body.indexOf('⟨WK⟩');
    if(i < 0) return m;
    let wk = null;
    try{ wk = JSON.parse(m.body.slice(i+4)); }catch(e){}
    return Object.assign({}, m, { body: m.body.slice(0,i).trim(), wk });
  });
}
async function fetchMessages(nm){
  const api = ((typeof HW!=='undefined' && HW && HW.api) || API || '').replace(/\/+$/,'');
  if(!api) return null;
  for(let attempt=1; attempt<=2; attempt++){
    try{
      const r = await fetch(api + '/messages?name=' + encodeURIComponent(nm) + idQS(), {cache:'no-store'});
      const j = await r.json();
      if(j && j.ok) return msgSanitize(Array.isArray(j.messages) ? j.messages : []);
    }catch(e){}
    if(attempt < 2) await new Promise(f=>setTimeout(f, 700));
  }
  return null;
}


async function fetchNoticeState(nm){
  const api = ((typeof HW!=='undefined' && HW && HW.api) || API || '').replace(/\/+$/,'');
  if(!api) return null;
  try{
    const r = await fetch(api + '/notice-state?name=' + encodeURIComponent(nm) + idQS(), {cache:'no-store'});
    const j = await r.json();
    if(j && j.ok) return new Set(Array.isArray(j.deleted) ? j.deleted.map(String) : []);
  }catch(e){}
  return null;
}

async function dismissNoticeServer(nm, key){
  const api = ((typeof HW!=='undefined' && HW && HW.api) || API || '').replace(/\/+$/,'');
  if(!api) return false;
  try{
    const r = await fetch(api + '/notice-dismiss', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:nm, sid:mySid||'', key:String(key||'')})
    });
    const j = await r.json().catch(()=>({}));
    return !!(r.ok && j.ok);
  }catch(e){ return false; }
}

/* 🏅 شهادة التقدير: تُرسم بطاقةً كاملة ويطبعها الطالب بنفسه —
   لا ملف يُخزَّن على الخادم ولا رابط ينتهي. ومن أراد PDF اختار
   «حفظ كـPDF» من نافذة الطباعة نفسها على الجوال والكمبيوتر. */
function certParse(body){
  const t = String(body||'');
  const name  = (t.match(/تُمنح للطالب:\s*(.+)/)||[])[1] || '';
  // «تقديرًا» فيها تنوين حرفٌ مستقل، فالمطابقة على «لـ:» وحدها أمتن
  const reason= (t.match(/لـ\s*:\s*(.+)/)||[])[1] || '';
  return { name:name.trim(), reason:reason.trim() };
}
function certDateAr(){
  try{ return new Intl.DateTimeFormat('ar-SA-u-ca-gregory',{timeZone:'Asia/Riyadh',dateStyle:'long'}).format(new Date()); }
  catch(e){ return new Date().toISOString().slice(0,10); }
}
function certCardHTML(m, isNew){
  const p = certParse(m.body);
  const nm = p.name || (typeof STUDENT_NAME!=='undefined' ? STUDENT_NAME : '');
  const rs = p.reason || 'التميز والمشاركة الفاعلة';
  const id = 'cert-' + Math.random().toString(36).slice(2,8);
  return `<div class="cert-wrap">
    <div class="cert-sheet" id="${id}">
      <div class="cert-top">المملكة العربية السعودية · وزارة التعليم</div>
      <div class="cert-title">شهادة تقدير</div>
      <div class="cert-lead">تُمنح للطالب</div>
      <div class="cert-name">${esc(nm)}</div>
      <div class="cert-lead">تقديرًا لـ</div>
      <div class="cert-reason">${esc(rs)}</div>
      <div class="cert-foot"><span>${esc(certDateAr())}</span><span>معلم المادة</span></div>
    </div>
    <button class="cert-print" onclick="certPrint('${id}')">🖨️ طباعة الشهادة أو حفظها PDF</button>
    ${isNew?'<span class="priority-badge">جديد</span>':''}
  </div>`;
}
/* 💌 رسالة الشكر: بطاقة احتفالية — ألوان دافئة، ظرف يتمايل ونجوم وقلوب تطفو، واحتفال بالقصاصات
   أول مرة تُفتح فيها (مرة واحدة لكل رسالة)، وزر «أرِها لأهلك» للمشاركة. */
const THANKS_SEEN_KEY = 'thanks_celebrated_v1';
function isThanksMsg(m){ return String(m && m.type || '') === 'thanks' || /رسالة شكر من معلمك/.test(String(m && m.title || '')); }
function thanksCardHTML(m, isNew){
  const id = 'thx-' + String(m.id || Math.random().toString(36).slice(2, 8)).replace(/[^\w-]/g, '');
  let seen = {}; try{ seen = JSON.parse(localStorage.getItem(THANKS_SEEN_KEY) || '{}'); }catch(e){}
  const celebrate = !seen[m.id];
  if(celebrate) setTimeout(() => thanksCelebrate(id, m.id), 350);
  const floats = ['⭐','💛','✨','🌟','💖','⭐','✨','💛'].map((e, i) => `<i style="--x:${8 + i * 12}%;--d:${(i * 0.45).toFixed(2)}s;--s:${(3.2 + (i % 3) * 0.7).toFixed(1)}s">${e}</i>`).join('');
  return `<div class="thx-card" id="${id}">
    <div class="thx-floats" aria-hidden="true">${floats}</div>
    <div class="thx-env" aria-hidden="true">💌</div>
    <div class="thx-kick">رسالة شكر من معلمك 🌟</div>
    ${isNew ? '<span class="thx-new">جديدة</span>' : ''}
    <p class="thx-body">${esc(m.body || '')}</p>
    ${thanksFootHTML(m, id)}
    <div class="thx-fx" aria-hidden="true"></div>
  </div>`;
}
function thanksCelebrate(id, mid){
  const card = document.getElementById(id); if(!card) return;
  const fx = card.querySelector('.thx-fx'), cols = ['#FFD23F', '#FF7AC6', '#7CE85A', '#38E8FF', '#FF9F1C', '#C77DFF'];
  for(let i = 0; i < 60; i++){ const b = document.createElement('b'); b.style.left = (Math.random() * 100) + '%'; b.style.background = cols[i % cols.length];
    b.style.animationDelay = (Math.random() * 0.6) + 's'; b.style.animationDuration = (1.6 + Math.random() * 1.2) + 's'; fx.appendChild(b); setTimeout(() => b.remove(), 3200); }
  card.classList.add('thx-wow'); setTimeout(() => card.classList.remove('thx-wow'), 1400);
  try{ GameSound.sfx('match'); }catch(e){}
  try{ navigator.vibrate && navigator.vibrate([30, 60, 30]); }catch(e){}
  try{ const s = JSON.parse(localStorage.getItem(THANKS_SEEN_KEY) || '{}'); s[mid] = Date.now(); localStorage.setItem(THANKS_SEEN_KEY, JSON.stringify(s)); }catch(e){}
}
/* 💌 المشاركة مع الأهل: مرتان كحد أقصى خلال 7 أيام من صدورها، والخادم هو الحكم.
   النص المُرسل يحمل تاريخ الصدور ورابط تحقق، فلا تُقدَّم رسالة قديمة على أنها جديدة. */
const THX_DAYS = 7, THX_MAX = 2, THX_USED_KEY = 'thanks_share_used_v1';
function thxUsed(mid){ try{ return (JSON.parse(localStorage.getItem(THX_USED_KEY)||'{}')[mid])||0; }catch(e){ return 0; } }
function thxSetUsed(mid, n){ try{ const o = JSON.parse(localStorage.getItem(THX_USED_KEY)||'{}'); o[mid] = n; localStorage.setItem(THX_USED_KEY, JSON.stringify(o)); }catch(e){} }
function thanksFootHTML(m, id){
  const issued = Date.parse(m.createdAt || '') || 0, until = issued + THX_DAYS * 86400000;
  const fmt = t => new Date(t).toLocaleDateString('ar-SA', { day:'numeric', month:'long' });
  const used = thxUsed(m.id), left = Math.max(0, THX_MAX - used);
  if(!issued || Date.now() > until) return `<div class="thx-foot"><span>👏 أنت تستحقها!</span><span class="thx-note">انتهت مدة مشاركتها مع الأهل</span></div>`;
  if(left <= 0) return `<div class="thx-foot"><span>👏 أنت تستحقها!</span><span class="thx-note">شاركتها مع أهلك ✓</span></div>`;
  return `<div class="thx-foot"><span>👏 أنت تستحقها! أرِها لأهلك</span>
    <button type="button" class="thx-share" data-mid="${esc(m.id)}" onclick="thanksShare('${id}','${esc(m.id)}')">📤 شاركها مع أهلك</button>
    <span class="thx-note">${left === 1 ? 'مشاركة واحدة متبقية' : 'مشاركتان متاحتان'} · حتى ${fmt(until)}</span></div>`;
}
async function thanksShare(id, mid){
  const card = document.getElementById(id); if(!card || !mid) return;
  const btn = card.querySelector('.thx-share'); if(btn){ btn.disabled = true; btn.textContent = 'جارٍ التجهيز…'; }
  let j = null;
  try{
    const api = ((typeof HW!=='undefined'&&HW&&HW.api)||API||'').replace(/\/+$/,'');
    const r = await storeFetch(api + '/thanks-share', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ msgId: mid, name: String(myName||lockedName()||'').trim(), sid: mySid||'' }) });
    j = await r.json();
  }catch(e){ j = { ok:false, error:'net' }; }
  const foot = card.querySelector('.thx-foot');
  if(!j || !j.ok){
    if(j && j.error === 'auth_cancel'){ if(btn){ btn.disabled = false; btn.textContent = '📤 شاركها مع أهلك'; } return; }
    if(j && j.error === 'limit') thxSetUsed(mid, THX_MAX);
    const msg = j && j.error === 'limit' ? 'شاركت هذه الرسالة مرتين — وهذا الحد المسموح.'
      : j && j.error === 'expired' ? 'انتهت مدة مشاركة هذه الرسالة (7 أيام من صدورها).'
      : 'تعذّر تجهيز الرسالة — تحقّق من الاتصال وحاول مرة أخرى.';
    toast(msg, 'bad');
    if(j && (j.error === 'limit' || j.error === 'expired')){ if(foot) foot.outerHTML = thanksFootHTML({ id: mid, createdAt: j.error === 'expired' ? '1970-01-01' : new Date().toISOString() }, id); }
    else if(btn){ btn.disabled = false; btn.textContent = '📤 شاركها مع أهلك'; }
    return;
  }
  thxSetUsed(mid, j.used);
  try{ if(navigator.share){ await navigator.share({ text: j.text }); } else { await navigator.clipboard.writeText(j.text); toast('📋 نُسخت الرسالة — أرسلها لأهلك', 'good'); } }
  catch(e){ if(!(e && e.name === 'AbortError')){ try{ await navigator.clipboard.writeText(j.text); toast('📋 نُسخت الرسالة — أرسلها لأهلك', 'good'); }catch(_){ toast('تعذّر النسخ', 'bad'); } } }
  const m = { id: mid, createdAt: new Date(j.until - THX_DAYS * 86400000).toISOString() };
  if(foot) foot.outerHTML = thanksFootHTML(m, id);
}
/* 🖨️ تنظيف ما بعد الطباعة: على iPhone تعود window.print() فورًا ويرسم Safari المعاينة لاحقًا،
   فإزالة نسخة الطباعة بمؤقت (أو مع afterprint المبكر) تُخرج ورقة فاضية. لذا تبقى حتى أول لمسة بعد الطباعة
   (قواعد الطباعة لا تؤثر على الشاشة، فبقاؤها لا يغيّر شيئًا مما يراه الطالب). */
let PRINT_CLEAN=null;
function printCleanupLater(fn){
  if(PRINT_CLEAN){ try{ PRINT_CLEAN(); }catch(e){} }
  let armed=false; const go=()=>{ if(!armed) return; ['pointerdown','keydown'].forEach(t=>removeEventListener(t,go,true)); PRINT_CLEAN=null; try{ fn(); }catch(e){} };
  PRINT_CLEAN=()=>{ armed=true; go(); };
  setTimeout(()=>{ armed=true; },1200);
  ['pointerdown','keydown'].forEach(t=>addEventListener(t,go,true));
}
function certPrint(id){
  const el = document.getElementById(id); if(!el) return;
  document.querySelectorAll('.cert-sheet').forEach(x=>x.classList.remove('cert-printing'));
  el.classList.add('cert-printing');
  document.body.classList.add('printing-cert');
  const done = ()=>{ document.body.classList.remove('printing-cert'); el.classList.remove('cert-printing'); };
  printCleanupLater(done);
  setTimeout(()=>{ try{ window.print(); }catch(e){ done(); } }, 60);
}
/* 📊 تقرير الأسبوع: بطاقة مرئية بدل فقرة أرقام.
   الأرقام تصل مع الرسالة في سطر مضغوط نقرؤه ونخفيه — لا نفكّك النص
   العربي، فالتفكيك يكسر بأول تشكيل أو تعديل صياغة. */
function wkParse(body){
  const t=String(body||''); const i=t.indexOf('⟨WK⟩');
  if(i<0) return { d:null, text:t };
  try{ return { d:JSON.parse(t.slice(i+4)), text:t.slice(0,i).trim() }; }
  catch(e){ return { d:null, text:t.slice(0,i).trim() }; }  // فشل القراءة لا يُظهر شيفرة للطالب
}
function wkBar(val,total,cls){
  const p = total>0 ? Math.round(val/total*100) : 0;
  return `<div class="wk-bar"><span class="${cls}" style="width:${p}%"></span></div>`;
}
function wkStat(icon,label,val,total,cls,note){
  return `<div class="wk-stat">
    <div class="wk-stat-top"><span>${icon} ${esc(label)}</span><b>${val}${total!==null?` / ${total}`:''}</b></div>
    ${total!==null?wkBar(val,total,cls):''}
    ${note?`<small>${esc(note)}</small>`:''}</div>`;
}
/* 📊 تقرير الأسبوع — بطاقة مختصرة قابلة للفعل:
   حكم الأسبوع ← ثلاث دوائر (مشاركة/واجبات/أنشطة) ← ما لوحظ ← خطوة واحدة بزر يفتحها.
   الحكم يُحسب من الأرقام المرسلة نفسها فقط، ولا يظهر إن لم تُرصد أرقام. */
function wkDay(iso){ try{ return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn',{day:'numeric',month:'short',timeZone:'Asia/Riyadh'}).format(new Date(iso+'T12:00:00+03:00')); }catch(e){ return ''; } }
function wkRing(label,val,total,color,sub){
  const p = total>0 ? Math.round(val/total*100) : 0;
  return `<div class="wk2-ring"><div class="wk2-c" style="--p:${p};--c:${color}"><b>${p}%</b></div>
    <span class="wk2-rl">${esc(label)}</span><small>${esc(sub)}</small></div>`;
}
function weeklyCardHTML(m, isNew, acts){
  const parsed = wkParse(m.body);
  const d = m.wk || parsed.d, text = parsed.text;
  if(!d) return `<div class="wk2"><div class="wk2-top"><div class="wk2-ic">📊</div><div class="wk2-h"><b>${esc(m.title||'تقرير أسبوعك')}</b></div>${isNew?'<span class="priority-badge">جديد</span>':''}</div>
      <p class="wk2-plain">${esc(text)}</p></div>`;
  const att = (d.sh||0)+(d.ab||0)+(d.ms||0), hwDen = (d.dn||0)+(d.un||0), ac = d.ac||0;
  const rings = [], rates = [];
  if(att){ rings.push(wkRing('المشاركة', d.sh||0, att, '#1B9C6B', `${d.sh||0} من ${att}${d.ab?` · غياب ${d.ab}`:''}`)); rates.push((d.sh||0)/att); }
  if(hwDen||d.ex){ rings.push(wkRing('الواجبات', d.dn||0, hwDen||0, '#2F6FDB', `${d.dn||0} من ${hwDen}${d.ex?` · ${d.ex} بعذر`:''}`)); if(hwDen) rates.push((d.dn||0)/hwDen); }
  if(ac){ rings.push(wkRing('الأنشطة', d.sb||0, ac, '#7A4FD1', `${d.sb||0} من ${ac}`)); rates.push((d.sb||0)/ac); }
  const md = d.md && typeof d.md==='object' ? d.md : null, mdTot = md ? (md.s||0)+((md.m||[]).length) : 0;
  if(mdTot){ rings.push(wkRing('مدرستي', md.s||0, mdTot, '#E07A1F', `${md.s||0} من ${mdTot}`)); rates.push((md.s||0)/mdTot); }
  let verdict = '';
  if(rates.length){
    let lv = rates.reduce((a,b)=>a+b,0)/rates.length >= .85 ? 0 : rates.reduce((a,b)=>a+b,0)/rates.length >= .65 ? 1 : 2;
    if((d.ng||[]).length >= 2 && lv < 2) lv++;                     // ملاحظتان سلبيتان تخفضان الحكم درجة
    verdict = [['great','🌟 أسبوع ممتاز — استمر'],['good','👍 أسبوع جيد — خطوة وتصبح ممتازًا'],['focus','💪 أسبوعك يحتاج تركيزًا — تقدر عليها']][lv];
  }
  // الخطوة: إن كانت نشاطًا مفتوحًا فالزر يفتحه مباشرة (نفس آلية فتح الأنشطة في التنبيهات)
  const openName = (d.op||[])[0] || '';
  const openAct = openName && Array.isArray(acts) ? acts.find(h => !h.done && String(h.t||'').trim() === String(openName).trim()) : null;
  const range = d.f && d.t ? `${wkDay(d.f)} – ${wkDay(d.t)}` : '';
  return `<div class="wk2">
    <div class="wk2-top"><div class="wk2-ic">📊</div>
      <div class="wk2-h"><b>تقرير أسبوعك</b>${range?`<small>${esc(range)}</small>`:''}</div>
      ${isNew?'<span class="priority-badge">جديد</span>':''}</div>
    ${verdict?`<div class="wk2-verdict ${verdict[0]}">${verdict[1]}</div>`:''}
    ${rings.length?`<div class="wk2-rings n${rings.length}">${rings.join('')}</div>`:''}
    ${(d.ps&&d.ps.length)?`<div class="wk2-chips"><span class="wk2-cl good">🌟 أحسنت في</span>${d.ps.map(x=>`<span class="wk2-chip good">${esc(x)}</span>`).join('')}</div>`:''}
    ${(d.ng&&d.ng.length)?`<div class="wk2-chips"><span class="wk2-cl warn">📌 انتبه إلى</span>${d.ng.map(x=>`<span class="wk2-chip warn">${esc(x)}</span>`).join('')}</div>`:''}
    ${md&&(md.m||[]).length?`<div class="wk2-chips"><span class="wk2-cl warn">📱 لم تحل في مدرستي</span>${md.m.slice(0,4).map(x=>`<span class="wk2-chip warn">${esc(x)}</span>`).join('')}</div>`:''}
    ${md&&(md.o||[]).length?`<div class="wk2-chips"><span class="wk2-cl">⏳ مفتوح الآن في مدرستي</span>${md.o.slice(0,3).map(o=>`<span class="wk2-chip">${esc(o.t)}${o.d&&o.d>Date.now()?` · ${esc(madCloseText(o.d))}`:' · أُغلق'}</span>`).join('')}</div>`:''}
    ${d.st?`<div class="wk2-step"><div><span>🎯 خطوتك القادمة</span><b>${esc(d.st)}</b></div>
      ${openAct?`<button type="button" class="wk2-go" data-activity-id="${esc(openAct.id)}">ابدأ النشاط ←</button>`:''}</div>`:''}
  </div>`;
}
/* 📝 بطاقة الاختبار: التاريخ واليوم، والموعد، والدرجة، والصفحات، والمحتوى، وعدّاد الأيام */
function examCardHTML(m, isNew){
  const x=m.ex||{}, d=String(x.d||m.examDate||'').slice(0,10);
  const t=Date.parse(d+'T12:00:00+03:00'), today=Date.parse(new Date(Date.now()+3*3600000).toISOString().slice(0,10)+'T12:00:00+03:00');
  const left=t?Math.round((t-today)/864e5):null;
  const when=left==null?'':left<0?'انتهى':left===0?'اليوم':left===1?'غدًا':left===2?'بعد يومين':`بعد ${left} ${left<=10?'أيام':'يومًا'}`;
  const dl=(()=>{try{return new Intl.DateTimeFormat('ar-SA-u-ca-gregory',{weekday:'long',day:'numeric',month:'long'}).format(new Date(d+'T12:00:00'))}catch(e){return d}})();
  const row=(i,k,v)=>v?`<div class="exm-row"><span>${i} ${k}</span><b>${esc(v)}</b></div>`:'';
  const pr = m.priority==='urgent'?'urgent':m.priority==='important'?'important':'';
  return `<div class="exm ${pr} ${left!=null&&left<=1&&left>=0?'soon':''}">
    <div class="exm-top"><div class="exm-ic">📝</div><div class="exm-h"><b>${esc(m.title||'اختبار')}</b>${x.tp?`<small>${esc(x.tp)}</small>`:''}</div>
      </div>
    <div class="exm-tags">${pr?`<span class="exm-pr">${pr==='urgent'?'🚨 عاجل':'⭐ مهم'}</span>`:''}${when?`<span class="exm-left">${when}</span>`:''}${isNew?'<span class="priority-badge">جديد</span>':''}</div>
    <div class="exm-grid">${row('📅','التاريخ',dl)}${row('⏰','الموعد',x.tm)}${row('🎯','الدرجة',x.mk)}${row('📖','الصفحات',x.pg)}</div>
    ${x.n?`<p class="exm-note">📝 ${esc(x.n)}</p>`:''}
  </div>`;
}
function msgCardHTML(m, isNew, acts){
  if(String(m.type||'')==='weekly') return weeklyCardHTML(m, isNew, acts);
  if(m.ex || (String(m.type||'')==='exam' && m.examDate)) return examCardHTML(m, isNew);
  if(String(m.type||'')==='cert') return certCardHTML(m, isNew);
  if(isThanksMsg(m)) return thanksCardHTML(m, isNew);
  const pr = MSG_RANK[m.priority]!==undefined ? m.priority : 'normal';
  const badge = pr==='urgent' ? 'عاجل' : pr==='important' ? 'مهم' : '';
  const date = m.examDate ? String(m.examDate).slice(0,10) : '';
  return `<div class="space-notice ${pr}">
    <div class="ni">${MSG_ICON[m.type] || '💬'}</div>
    <div style="min-width:0">
      <b>${esc(m.title||'رسالة من المعلم')}${badge?`<span class="priority-badge">${badge}</span>`:''}${isNew?'<span class="priority-badge">جديد</span>':''}</b>
      <p>${esc(m.body||'')}${date?`<br><strong class="exam-date-line">📅 تاريخ الاختبار: ${esc(date)}</strong>`:''}</p>
    </div></div>`;
}

/* 💬 عرض الرسائل في الرابط المباشر (شاشة ما قبل الحل) */
async function showDirectMessages(nm){
  const box = $('pre-msgs'); if(!box) return;
  const msgs = await fetchMessages(nm);
  if(msgs === null){
    box.classList.remove('hide');
    box.innerHTML = `<div class="sheet" style="margin-top:.9rem">
      <div class="muted center" style="font-size:.85rem">تعذّر تحميل رسائل معلمك —
        <button class="btn ghost sm" id="msg-retry" style="font-size:.82rem">إعادة المحاولة</button></div></div>`;
    const b=$('msg-retry'); if(b) b.onclick=()=>showDirectMessages(nm);
    return;
  }
  // نفس حالة الحذف المستخدمة في مركز التنبيهات يجب أن تُحترم هنا أيضًا.
  // هذه الشاشة كانت تعيد جلب الرسائل مباشرة، فتتجاهل الحذف وتعيد عرضها.
  const noticeStoreKey='hwapp_deleted_notices_v1';
  let localDeleted=new Set();
  try{
    const store=JSON.parse(localStorage.getItem(noticeStoreKey)||'{}')||{};
    localDeleted=new Set(Array.isArray(store[String(nm||'').trim()]) ? store[String(nm||'').trim()].map(String) : []);
  }catch(e){}
  const serverDeleted=await fetchNoticeState(nm);
  const deleted=serverDeleted || localDeleted;
  if(serverDeleted){
    localDeleted.forEach(k=>{ if(!serverDeleted.has(k)) dismissNoticeServer(nm,k).catch(()=>{}); serverDeleted.add(k); });
  }
  const directVisible=msgs.filter(m=>!deleted.has(`msg:${m.id}`) && m.type!=='weekly' && msgActive(m));
  if(!directVisible.length){ box.classList.add('hide'); box.innerHTML=''; return; }
  const seen = new Set(seenMsgIds());
  const sorted = directVisible.slice().sort((a,b)=>msgTime(b)-msgTime(a));
  const fresh = sorted.filter(m=>!seen.has(m.id)).length;
  box.classList.remove('hide');
  box.innerHTML = `<div class="sheet" style="margin-top:.9rem">
    <b style="font-size:.95rem">💬 من معلمك${fresh?` <span class="priority-badge">${fresh} جديد</span>`:''}</b>
    <div style="display:grid;gap:.5rem;margin-top:.6rem">${sorted.map(m=>msgCardHTML(m,!seen.has(m.id))).join('')}</div>
  </div>`;
  markMsgsSeen(sorted.map(m=>m.id));
}

async function loadStudentSpace(nm, rows){
  const box = $('gate-space');
  if(!box) return;
  box.classList.remove('hide');
  { const mr=$('my-report-panel'); if(mr) mr.classList.remove('hide'); }   // 📄 «تقريري» بعد الدخول فقط
  { const gs=$('gate-store'); if(gs) gs.classList.remove('hide'); }        // 🛒 المتجر بعد الدخول فقط
  { const aa=$('all-activities-panel'); if(aa) aa.classList.remove('hide'); }   // 📚 «جميع أنشطتي» بعد الدخول فقط
  // الاسم في عنصر مستقل: «الاسم الملوّن» يلوّن الاسم فقط (كان التدرّج يطمس رمز 👋)
  { const g=$('space-greeting'); g.textContent='أهلاً '; const n=document.createElement('span'); n.className='sg-nm'; n.textContent=nm; g.append(n,' 👋'); }
  try{ ptOnLogin(); }catch(e){}
  try{ annPortalLoad(); }catch(e){}
  try{ myPlanLoad(); }catch(e){}
  try{ myCertsLoad(); }catch(e){}
  try{ myAskLoad(); }catch(e){}
  const list = Array.isArray(rows) ? rows : [];
  // 🧭 المهمة الأوضح: لا نخلط النشاط العلاجي مع التدريب، ونفضّل المهمة
  // المفتوحة الأقرب موعدًا. النشاط العلاجي يظهر هنا كمسار تطوير واضح.
  // المهمة القادمة تشمل أيضًا النشاط المكتمل الذي ما زالت له صلاحية إعادة تسليم/محاولة.
  // لا نعتبر h.done سببًا لإخفاء مهمة قابلة للإجراء، لأن صلاحية المعلم أو بطاقة الإعادة
  // تجعلها مهمة فعلية الآن.
  const isActionable = h=>{
    const teacherRetry = Number(h.extra || h.extraAttempts || 0) > 0;
    const purchasedRetry = !!h.done && Number(MYPERKS.retry || 0) > 0;
    const projectResubmit = h.kind === 'files' && String(h.reviewStatus||'').toLowerCase() === 'rejected' && Number(h.resubmitUntil||0) > Date.now();
    const open = !h.done && !(h.due && h.due < todayISO());
    if(window.__startGate === false && startGated(h) && !h.done) return false;      // 🔒 قبل اختباري البداية
    return teacherRetry || purchasedRetry || projectResubmit || open;
  };
  const open = list.filter(isActionable);
  const sortedOpen = open.slice().sort((a,b)=>{
    const actionScore=h=>{
      const teacher=Number(h.extra || h.extraAttempts || 0)>0;
      const project=h.kind==='files' && String(h.reviewStatus||'').toLowerCase()==='rejected' && Number(h.resubmitUntil||0)>Date.now();
      const retry=!!h.done && Number(MYPERKS.retry || 0)>0;
      return (teacher||project||retry)?0:1;
    };
    // 🧭 قبل اختباري البداية: «مهمتك الآن» = اكتشف طريقة تعلمك، ثم اعرف مستواك
    const startScore=h=>h.done?2:String(h.kind||'')==='style'?0:String(h.kind||'')==='diag'?1:2;
    return startScore(a)-startScore(b) || actionScore(a)-actionScore(b) || String(a.due||'9999').localeCompare(String(b.due||'9999'));
  });
  const next = sortedOpen[0] || null;
  const nextTitle = $('space-next');
  const nextMeta = $('space-next-meta');
  const nextAction = $('space-next-action');
  if(next){
    const isRemedial=!!next.remedial;
    const teacherRetry = Number(next.extra || next.extraAttempts || 0) > 0;
    const purchasedRetry = !!next.done && Number(MYPERKS.retry || 0) > 0;
    const projectResubmit = next.kind === 'files' && String(next.reviewStatus||'').toLowerCase() === 'rejected' && Number(next.resubmitUntil||0) > Date.now();
    const startKind = !next.done && ['style','diag'].includes(String(next.kind||'')) ? String(next.kind) : '';
    const nextIcon = startKind==='style' ? '🧠' : startKind==='diag' ? '🔍' : isRemedial ? '🩹'
      : projectResubmit ? '🔁'
      : teacherRetry ? '🔓'
      : purchasedRetry ? '🔁'
      : next.kind==='reading' ? '📖'
      : next.kind==='files' ? '🧪'
      : next.kind==='game' ? '🎮'
      : '✏️';
    if($('space-next-icon')) $('space-next-icon').textContent = nextIcon;
    if(nextTitle) nextTitle.textContent = next.t || 'نشاط تعليمي';
    if(nextMeta) nextMeta.textContent = startKind==='style'
      ? '🧠 اختبار البداية الأول · بعده «اعرف مستواك» ثم تُفتح الأنشطة والألعاب'
      : startKind==='diag'
      ? '🔍 اختبار البداية الثاني · بعده تُفتح الأنشطة والألعاب'
      : isRemedial
      ? '🩹 نشاط علاجي · مراجعة المهارات التي تحتاج إلى تعزيز'
      : projectResubmit
        ? '🔁 إعادة تسليم المشروع · يحتاج إلى تحسين ثم إعادة التسليم'
        : teacherRetry
          ? '🔓 إعادة تسليم · سمح لك المعلم بمحاولة إضافية'
          : purchasedRetry
            ? '🔁 إعادة محاولة · يمكنك تحسين نتيجتك'
            : next.kind==='reading'
              ? '📖 فهم قرائي · اقرأ، افهم، ثم أجب وطبّق'
              : next.kind==='files'
                ? '🧪 مهمة تطبيقية · نفّذها ثم سلّمها'
                : next.kind==='game'
                  ? '🎮 تحدٍ تعليمي · أنجزه الآن'
                  : '✏️ تدريب وممارسة · ابدأ لإكمال مهمتك الحالية';
    if(nextAction){ nextAction.classList.remove('hide'); nextAction.textContent = startKind ? 'ابدأ الاختبار ←' : isRemedial ? 'ابدأ التطوير ←' : projectResubmit ? 'أعد التسليم ←' : teacherRetry ? 'أعد التسليم ←' : purchasedRetry ? 'أعد المحاولة ←' : 'ابدأ ←'; }
  }else{
    if($('space-next-icon')) $('space-next-icon').textContent = '✓';
    if(nextTitle) nextTitle.textContent = 'لا توجد مهمة مفتوحة الآن 🎉';
    if(nextMeta) nextMeta.textContent = 'أكملت المهام المتاحة أو لا توجد مهام حالية.';
    if(nextAction){ nextAction.classList.add('hide'); nextAction.textContent=''; }
  }
  { const dn=list.filter(h=>h.done).length, pc=list.length?Math.round(dn*100/list.length):0;
    $('space-progress').textContent = `${dn} من ${list.length}`;
    const pb=$('space-progress-bar'); if(pb) pb.style.width=pc+'%'; const pp=$('space-progress-pct'); if(pp) pp.textContent=pc+'%'; }
  $('space-next-card').onclick = ()=>{
    if(!next) return;
    // النشاط العلاجي مستبعد عمدًا من القائمة العامة، لذلك نفتح مسار الرحلة
    // مباشرة بدل البحث عنه في gate-list.
    if(next.remedial){
      const ws=$('journey-workspace');
      if(ws) ws.classList.add('hide');
      openJourneyLearning(nm, [next], ['remedial']);
      return;
    }
    if(openGameActivity(next.id)) return;
    const b=document.querySelector(`#gate-list .hw-item[data-id="${CSS.escape(next.id)}"]`);
    if(b) b.click();
    else toast('تعذّر فتح النشاط، حدّث الصفحة','bad');
  };

  const notices=[];
  list.forEach(h=>{
    const late=h.due && h.due < todayISO() && !h.done;
    if(h.reviewPending) notices.push({i:'🔎',t:`مراجعة مطلوبة: «${h.t||'النشاط'}»`,p:`${rtReviewText(h)} ${rtTaskLine(h,true)}`,tone:'review',reviewTask:h.id});
    if(late) notices.push({i:'⚠️',t:'نشاط متأخر',p:`لم يتم تسليم «${h.t||'النشاط'}».`,tone:'late',activityId:h.id});
    else if(!h.done && h.due){
      const d=(new Date(h.due+'T23:59:59')-new Date())/86400000;
      if(d>=0 && d<=1.5) notices.push({i:'⏰',t:'اقترب موعد التسليم',p:`«${h.t||'النشاط'}» يغلق ${h.due}.`,tone:'due',activityId:h.id});
    }
  });
  const msgs = await fetchMessages(nm);
  if(msgs === null){
    notices.unshift({i:'⚠️',t:'تعذّر تحميل رسائل معلمك',p:'تحقّق من الإنترنت وأعد فتح الصفحة.',priority:'important'});
  }else{
    const seen = new Set(seenMsgIds());
    // 📊 التقارير الأسبوعية تُعرض في «تقريري»؛ هنا سطر قصير فقط حين يصل تقرير جديد
    WEEKLY_MSGS = msgs.filter(m=>m.type==='weekly').sort((a,b)=>msgTime(b)-msgTime(a));
    try{ myRepWeeklyBadge(WEEKLY_MSGS.some(m=>!seen.has(m.id))); }catch(e){}
    const newWk = WEEKLY_MSGS.find(m=>!seen.has(m.id));
    if(newWk) notices.push({ i:'📊', t:'وصل تقرير أسبوعك', p:'ملخص أسبوعك: مشاركتك وواجباتك وأنشطتك وخطوتك القادمة — افتحه من «📄 تقريري ← 📊 تقرير الأسبوع».', id:newWk.id, isNew:true, at:msgTime(newWk), priority:'normal', openReport:'week' });
    // 📄 تقرير الفترة: تقرير رسمي بالدرجات (منفصل عن الأسبوعي) — تنبيه واحد لكل فترة
    SREP_MSGS = msgs.filter(m=>m.type==='srep').sort((a,b)=>msgTime(b)-msgTime(a));
    try{ myRepPeriodBadge(SREP_MSGS.some(m=>!seen.has(m.id))); }catch(e){}
    const newSr = SREP_MSGS.find(m=>!seen.has(m.id));
    if(newSr) notices.push({ i:'📄', t:newSr.title||'وصلك تقرير الفترة', p:`${newSr.body||''} — تقريرك الرسمي بالدرجات، افتحه من «📄 تقريري ← 📄 تقرير الفترة» ويمكنك طباعته.`, id:newSr.id, isNew:true, at:msgTime(newSr), priority:'important', openReport:'period' });
    // 📩 ردود المعلم على أسئلة الطالب مكانها «محادثاتك» (تُبرز الرد الجديد هناك) — لا تتكرر هنا
    msgs.filter(m=>m.type!=='weekly' && m.type!=='srep' && m.type!=='reply' && msgActive(m)).forEach(m=>{
      notices.push({
        i: MSG_ICON[m.type] || '💬',
        t: m.title||'رسالة من المعلم', p: m.body||'',
        // التقرير والشهادة تُرسمان بطاقةً كاملة هنا لا سطرًا مختصرًا:
        // هذه القائمة هي ما يراه الطالب أولًا، فلا معنى لإحالته إلى مكان آخر.
        html: (m.type==='weekly'||m.type==='cert'||m.type==='exam'||isThanksMsg(m)) ? msgCardHTML(m, !seen.has(m.id), list) : '',
        extra: m.examDate ? `📅 تاريخ الاختبار: ${String(m.examDate).slice(0,10)}` : '',
        id: m.id, isNew: !seen.has(m.id), at: msgTime(m),
        priority: MSG_RANK[m.priority]!==undefined ? m.priority : 'normal'
      });
    });
    markMsgsSeen(msgs.filter(m=>m.type!=='weekly').map(m=>m.id));
  }
  notices.sort((a,b)=>(a.id&&b.id) ? msgOrder(a,b) : (a.id?-1:b.id?1:(MSG_RANK[a.priority]??2)-(MSG_RANK[b.priority]??2)));
  // الرسائل لا تُزاحَم: تُعرض كاملة، ثم تنبيهات الأنشطة بعدها
  const msgNotices = notices.filter(n=>n.id);
  const rest = notices.filter(n=>!n.id);
  const NOTICE_DELETED_KEY = 'hwapp_deleted_notices_v1';
  const noticeStudentKey = String(nm||'').trim();
  const deletedNoticeStore = ()=>{ try{return JSON.parse(localStorage.getItem(NOTICE_DELETED_KEY)||'{}')||{};}catch(e){return {};} };
  const localDeletedNoticeKeys = new Set((deletedNoticeStore()[noticeStudentKey]||[]).map(String));
  const serverDeletedNoticeKeys = await fetchNoticeState(nm);
  const deletedNoticeKeys = serverDeletedNoticeKeys || localDeletedNoticeKeys;
  try{ repSeenSync(serverDeletedNoticeKeys); }catch(e){}
  // عند نجاح الاتصال بالخادم يصبح الخادم هو المصدر الرئيسي، مع ضمّ القديم المحلي حتى لا تعود حذوفات سابقة.
  if(serverDeletedNoticeKeys){
    localDeletedNoticeKeys.forEach(k=>{
      if(!serverDeletedNoticeKeys.has(k)) dismissNoticeServer(nm,k).catch(()=>{});
      serverDeletedNoticeKeys.add(k);
    });
  }
  const noticeKey = n => String(n.id ? `msg:${n.id}` : `activity:${n.activityId||''}:${n.tone||n.priority||n.t||''}`);
  const saveDeletedNotice = key => {
    try{
      const store=deletedNoticeStore();
      const arr=Array.isArray(store[noticeStudentKey])?store[noticeStudentKey].map(String):[];
      if(!arr.includes(String(key))) arr.push(String(key));
      store[noticeStudentKey]=arr.slice(-300);
      localStorage.setItem(NOTICE_DELETED_KEY,JSON.stringify(store));
    }catch(e){}
  };
  let allNotices = msgNotices.concat(rest).filter(n=>!deletedNoticeKeys.has(noticeKey(n)) && !(n.openReport && n.id && REP_SEEN_SRV.has(String(n.id))));
  const summary = $('space-notice-summary');
  if(summary){
    // العدادات مرتبطة بالقائمة الحالية، لذلك ينخفض الرقم لحظيًا عند الحذف.
    const kindOf = n => n.id ? 'messages' : (['review','late','due'].includes(n.tone) ? 'action' : 'updates');
    const noticeCounts = ()=>{
      const messages=allNotices.filter(n=>kindOf(n)==='messages').length;
      const action=allNotices.filter(n=>kindOf(n)==='action').length;
      const updates=allNotices.filter(n=>kindOf(n)==='updates').length;
      const fresh=allNotices.filter(n=>n.id && n.isNew).length;
      return {messages,action,updates,fresh,total:allNotices.length};
    };
    const setNoticeCounts = ()=>{
      const c=noticeCounts();
      const labels={all:`الكل (${c.total})`,action:`يحتاج إجراء (${c.action})`,messages:`الرسائل (${c.messages})`,updates:`التحديثات (${c.updates})`};
      summary.querySelectorAll('.notice-filter').forEach(tab=>{ const k=tab.dataset.filter||'all'; if(labels[k]!==undefined) tab.textContent=labels[k]; });
      $('space-unread').textContent=c.fresh ? `${c.fresh} جديد` : '';
      $('space-unread').classList.toggle('hide',!c.fresh);
      return c;
    };
    const renderNotice = n=>{
      if(n.html) return `<div class="space-notice rich">${n.html}
        <button type="button" class="notice-delete" data-delete-notice="${esc(noticeKey(n))}" aria-label="حذف التنبيه" title="حذف التنبيه">🗑️</button></div>`;
      const badge=n.priority==='urgent'?'عاجل':n.priority==='important'?'مهم':n.isNew?'جديد':'';
      const actionable = !!(n.activityId || n.reviewTask || n.openReport);
      const key=noticeKey(n);
      return `<div class="space-notice ${n.priority||'normal'}${actionable?' notice-actionable':''}" ${n.reviewTask?`data-review-task="${esc(n.reviewTask)}"`:n.openReport?`data-open-report="${esc(n.openReport===true?'week':n.openReport)}"`:actionable?`data-activity-id="${esc(n.activityId)}"`:''}>
        <div class="ni">${n.i}</div>
        <div style="min-width:0;flex:1">
          <b>${esc(n.t)}${badge?`<span class="priority-badge">${badge}</span>`:''}</b>
          <p>${esc(n.p)}${n.extra?`<br><strong class="exam-date-line">${esc(n.extra)}</strong>`:''}</p>
          ${actionable?`<span class="notice-action-hint">${n.reviewTask?'ابدأ مهمة التصحيح ←':n.openReport?'افتح التقرير ←':'فتح النشاط ←'}</span>`:''}
        </div>
        <button type="button" class="notice-delete" data-delete-notice="${esc(key)}" aria-label="حذف التنبيه" title="حذف التنبيه">🗑️</button>
      </div>`;
    };
    const c=noticeCounts();
    const filters=[
      ['all',`الكل (${c.total})`],
      ['action',`يحتاج إجراء (${c.action})`],
      ['messages',`الرسائل (${c.messages})`],
      ['updates',`التحديثات (${c.updates})`]
    ];
    const rows=allNotices.map((n,i)=>`<div class="notice-inline-row" data-notice-index="${i}" data-notice-kind="${kindOf(n)}">${renderNotice(n)}</div>`).join('');
    summary.innerHTML = allNotices.length ? `<div class="notice-filter-bar" role="tablist" aria-label="فرز التنبيهات">${filters.map(([k,label],i)=>`<button type="button" class="notice-filter ${i===0?'active':''}" data-filter="${k}" title="اضغط مرة للفرز، واضغط مرة ثانية لعرض/إخفاء بقية التنبيهات">${label}</button>`).join('')}</div><div class="notice-inline-list">${rows}</div>` : '<div class="space-empty">لا توجد تنبيهات جديدة</div>';
    const listEl=summary.querySelector('.notice-inline-list');
    let expanded=false;
    let activeFilter='all';
    const openNoticeActivity = async (id)=>{
      const b=document.querySelector(`#gate-list .hw-item[data-id="${CSS.escape(String(id))}"]`);
      if(b){
        b.closest('details')?.setAttribute('open','');   // قد يكون داخل مجموعة مطوية
        b.scrollIntoView({block:'center',behavior:'smooth'});
        b.click();
        return;
      }
      const h=list.find(x=>String(x.id)===String(id));
      if(h?.remedial){
        try{ location.hash=h.id; location.reload(); }catch(e){ toast('تعذّر فتح النشاط','bad'); }
        return;
      }
      if(openGameActivity(id)) return;
      toast('تعذّر فتح النشاط حاليًا، حاول تحديث الصفحة','bad');
    };
    const applyView=()=>{
      const rowsEls=listEl ? [...listEl.querySelectorAll('[data-notice-index]')] : [];
      const matching=rowsEls.filter(row=>activeFilter==='all'||row.dataset.noticeKind===activeFilter);
      rowsEls.forEach(row=>row.classList.add('hide'));
      const visible=expanded ? matching : matching.slice(0,3);
      visible.forEach(row=>row.classList.remove('hide'));
      // زر واضح بدل الضغط مرتين على التصنيف
      let more=listEl?.querySelector('.notice-more');
      if(listEl && !more){ more=document.createElement('button'); more.type='button'; more.className='btn ghost notice-more';
        more.onclick=()=>{ expanded=!expanded; applyView(); }; listEl.appendChild(more); }
      if(more){ const hidden=matching.length-3; more.classList.toggle('hide', hidden<=0);
        more.textContent = expanded ? 'إخفاء الأقدم ▴' : `عرض كل التنبيهات (${matching.length}) ▾`; }
      let empty=listEl?.querySelector('.notice-filter-empty');
      if(listEl && !empty){
        empty=document.createElement('div');
        empty.className='space-empty notice-filter-empty';
        empty.textContent='لا توجد تنبيهات في هذا التصنيف';
        listEl.appendChild(empty);
      }
      if(empty) empty.classList.toggle('hide', matching.length>0);
    };
    summary.querySelectorAll('.notice-filter').forEach(tab=>tab.onclick=()=>{
      const nextFilter=tab.dataset.filter||'all';
      const sameFilter=activeFilter===nextFilter;
      summary.querySelectorAll('.notice-filter').forEach(x=>x.classList.remove('active'));
      tab.classList.add('active');
      activeFilter=nextFilter;
      // ضغطة أولى: فرز وعرض مختصر. ضغطة ثانية على نفس الزر: عرض/إخفاء بقية التنبيهات.
      expanded = sameFilter ? !expanded : false;
      applyView();
    });
    summary.addEventListener('click',e=>{
      const del=e.target.closest('[data-delete-notice]');
      if(del){
        e.preventDefault();
        e.stopPropagation();
        const key=del.dataset.deleteNotice;
        deletedNoticeKeys.add(String(key));
        saveDeletedNotice(key);
        const removedIndex=allNotices.findIndex(n=>noticeKey(n)===String(key));
        if(removedIndex>=0) allNotices.splice(removedIndex,1);
        const row=del.closest('.notice-inline-row');
        if(row) row.remove();
        // تحديث أرقام الفرز والعداد فورًا، لأن إبقاء الرقم القديم حتى إعادة التحميل تصرف بشري غير مفيد.
        setNoticeCounts();
        if(!allNotices.length){
          summary.innerHTML='<div class="space-empty">لا توجد تنبيهات جديدة</div>';
          return;
        }
        applyView();
        // الحذف يُحفظ على الخادم حتى لا يعود التنبيه عند فتح متصفح أو جهاز آخر.
        dismissNoticeServer(nm,key).then(ok=>{ if(!ok) toast('تم إخفاء التنبيه على هذا الجهاز، وتعذّر مزامنته الآن','bad'); });
        return;
      }
      const rt=e.target.closest('[data-review-task]');
      if(rt){ openReviewTask(rt.dataset.reviewTask, nm); return; }
      const orp=e.target.closest('[data-open-report]');
      if(orp){ myRepOpen(orp.dataset.openReport); return; }
      const card=e.target.closest('[data-activity-id]');
      if(card) openNoticeActivity(card.dataset.activityId);
    });
    if(listEl) applyView();
  }
}
/* 🧠 نتيجة أنماط التعلم: تُحفظ محليًا لكل طالب حتى تبقى متاحة داخل الرحلة. */
const JOURNEY_STYLE_KEY = 'hwapp_journey_style_v1';
function journeyStyleStore(){
  try{ return JSON.parse(localStorage.getItem(JOURNEY_STYLE_KEY)||'{}') || {}; }catch(e){ return {}; }
}
function journeyStyleGet(nm){
  const all=journeyStyleStore();
  return all[String(nm||'').trim()] || null;
}
function journeyStyleSet(nm, result){
  try{
    const all=journeyStyleStore();
    all[String(nm||'').trim()] = result;
    localStorage.setItem(JOURNEY_STYLE_KEY, JSON.stringify(all));
  }catch(e){}
}
function openJourneyStyleReport(nm){
  const r=journeyStyleGet(nm);
  if(!r || !r.rows || !r.rows.length){ toast('لا يتوفر تقرير أنماط التعلم لهذا الطالب بعد','bad'); return; }
  const icons={'بصري':'👁️','سمعي':'👂','حركي':'✋','قرائي/كتابي':'📖'};
  const rows=r.rows.map(([k,pct])=>`<div style="display:flex;align-items:center;gap:.65rem;padding:.65rem 0;border-bottom:1px solid var(--rule)"><span style="font-size:1.35rem">${icons[k]||'🧠'}</span><div style="flex:1"><b>${esc(k)}</b><div style="height:7px;background:var(--rule);border-radius:99px;overflow:hidden;margin-top:.35rem"><i style="display:block;width:${pct}%;height:100%;background:var(--tick);border-radius:99px"></i></div></div><b style="min-width:42px;text-align:left">${pct}%</b></div>`).join('');
  const top=r.top||r.rows[0][0];
  const box=document.createElement('div');
  box.style.cssText='position:fixed;inset:0;z-index:90;background:rgba(22,35,58,.48);display:flex;align-items:center;justify-content:center;padding:1rem';
  box.innerHTML=`<div class="sheet" style="max-width:430px;width:100%;max-height:86vh;overflow:auto">
    <button class="btn ghost" data-close style="float:left;width:auto;padding:.35rem .7rem">إغلاق</button>
    <div class="center" style="padding:.3rem 0 .8rem"><div style="font-size:2rem">🧠</div><h3 style="margin:.2rem 0">تقرير طريقة تعلمك</h3><p class="muted" style="margin:0;font-size:.84rem">تميل أكثر إلى <b>${esc(top)}</b></p></div>
    ${rows}
    <p class="muted" style="font-size:.78rem;line-height:1.7;margin:.8rem 0 0">هذا التقرير مؤشر لتفضيلاتك في التعلم، وليس حكمًا ثابتًا عليك أو درجة نجاح.</p>
  </div>`;
  document.body.appendChild(box);
  box.querySelector('[data-close]').onclick=()=>box.remove();
  box.onclick=e=>{ if(e.target===box) box.remove(); };
}

/* 🗺️ رسم رحلة الطالب اعتمادًا على حالة الأنشطة الحالية فقط. لا تغيّر درجات أو تسليمات. */
/* 🔬 «طبّق وجرّب» يجمع المشاريع (files) وتجارب المختبر الافتراضي (lab) */
function isApplyRow(h){ const k=String(h&&h.kind||''); return k==='files' || k==='lab'; }
function openLabRow(id){ location.href='lab/?hw='+encodeURIComponent(id); }
function openJourneyLearning(nm, rows, filterKinds){
  const ws=$('journey-workspace'), content=$('journey-workspace-content');
  if(!ws || !content) return;
  const allowedKinds = Array.isArray(filterKinds) && filterKinds.length ? filterKinds.map(String) : null;
  const kindOf = h => h && h.remedial ? 'remedial' : String(h?.kind || 'normal');
  const list=(Array.isArray(rows)?rows:[]).filter(h=>!['style','diag'].includes(kindOf(h)) && (!allowedKinds || allowedKinds.includes(kindOf(h))));
  if(!list.length){ toast(allowedKinds && allowedKinds.includes('files') ? 'لا توجد تجارب أو مشاريع منشورة حاليًا' : 'لا توجد أنشطة تعليمية متاحة الآن','bad'); return; }

  const typeMap={
    remedial:{icon:'🩹',title:'أنشطة علاجية',desc:'مراجعة المهارات التي تحتاج إلى تعزيز'},
    normal:{icon:'✏️',title:'تدريب',desc:'أنشطة التدريب والممارسة'},
    reading:{icon:'📖',title:'فهم قرائي',desc:'قراءة وفهم وربط واستنتاج'},
    files:{icon:'🧪',title:'تطبيق ومشاريع',desc:'تجارب ومشروعات وتسليمات'},
    lab:{icon:'🔬',title:'المختبر الافتراضي',desc:'جرّب بيدك، لاحظ، ثم فسّر'},
    game:{icon:'🎮',title:'تحديات وألعاب',desc:'تعلم بطريقة تفاعلية'}
  };
  const groups={};
  list.forEach(h=>{
    const k=typeMap[kindOf(h)]?kindOf(h):'normal';
    if(!groups[k]) groups[k]=[];
    groups[k].push(h);
  });
  const order=['remedial','reading','normal','lab','files','game'];
  const sorted=[];
  // 🗓️ المسار زمني داخل كل قسم: الأقدم أولًا والأحدث في آخره (كالخطوات)
  const chrono=(a,b)=>(gateTs(a)||Number(a.subAt)||0)-(gateTs(b)||Number(b.subAt)||0);
  Object.values(groups).forEach(g=>g.sort(chrono));
  order.forEach(k=>{ if(groups[k]) sorted.push([k,groups[k]]); });
  Object.keys(groups).forEach(k=>{ if(!order.includes(k)) sorted.push([k,groups[k]]); });

  const today=todayISO();
  const isLate=h=>!h.done && !!h.due && h.due < today;
  const hasTeacherRetry=h=>Number(h.extra || h.extraAttempts || 0) > 0;
  const hasPurchasedRetry=h=>!!h.done && Number(MYPERKS.retry || 0) > 0;
  const projectResubmit=h=>h.kind==='files' && String(h.reviewStatus||'').toLowerCase()==='rejected' && Number(h.resubmitUntil||0)>Date.now();
  const canOpenPending=h=>{
    // النشاط المكتمل لا يختفي إذا كانت له إعادة تسليم/محاولة متاحة.
    if(hasTeacherRetry(h) || hasPurchasedRetry(h) || projectResubmit(h)) return true;
    return !h.done && !isLate(h);
  };

  // النشاطات غير المنجزة + المكتملة التي ما زالت لها صلاحية إجراء فعلي.
  const pending=list.filter(canOpenPending).sort(chrono);   // الخطوة التالية: أقدم ما لم يُنجز
  const locked=list.filter(h=>!h.done && !canOpenPending(h));
  const next=pending[0]||null;
  const done=list.filter(h=>!!h.done).length;
  const pct=Math.round(done/Math.max(1,list.length)*100);

  content.innerHTML=`
    <div class="jw-head">
      <div>
        <span class="jw-kicker">🚀 مسار التعلم</span>
        <h3>خطوتك التالية واضحة</h3>
        <p class="muted">نقترح لك المتاح الآن، ونحافظ على فرص إعادة التسليم والمحاولة إذا كانت لديك.</p>
      </div>
      <button type="button" class="btn ghost jw-close" id="journey-workspace-close">إغلاق</button>
    </div>

    ${next ? `<div class="jw-next">
      <div class="jw-next-label">🎯 مهمتك الآن</div>
      <div class="jw-next-title">${esc(next.t||'نشاط تعليمي')}</div>
      <div class="jw-next-reason">${kindOf(next)==='remedial'?'🩹 هذا نشاط علاجي مخصص لمراجعة المهارات التي تحتاج إلى تعزيز.':kindOf(next)==='lab'?'🔬 تجربة في المختبر الافتراضي: نفّذها بنفسك، ولاحظ، ثم فسّر ما حدث.':kindOf(next)==='files'?'🧪 هذه مهمة تطبيقية تحتاج إلى تنفيذها وتسليمها.':kindOf(next)==='reading'?'📖 هذه مهمة فهم قرائي: اقرأ، افهم، ثم أجب وطبّق.':kindOf(next)==='game'?'🎮 هذا تحدٍ تعليمي، أنجزه لتحصل على تجربة تعلم تفاعلية.':'✏️ هذا نشاط تدريب وممارسة، ابدأ به لإكمال خطوتك الحالية.'}</div>
      <div class="jw-next-meta">${hasTeacherRetry(next)?'🔓 لديك صلاحية إعادة التسليم':projectResubmit(next)?'🔁 لديك فرصة لإعادة التسليم':`متاح الآن · لديك ${pending.length} ${pending.length===1?'مهمة متاحة':'مهام متاحة'}`}</div>
      <button type="button" class="btn tick jw-next-btn" id="journey-next-btn">${hasTeacherRetry(next)?'🔓 إعادة التسليم':projectResubmit(next)?'🔁 إعادة التسليم':kindOf(next)==='remedial'?'🎯 ابدأ التطوير':'🚀 ابدأ النشاط الآن'}</button>
    </div>` : `<div class="jw-next" style="border-color:rgba(27,156,107,.35)">
      <div class="jw-next-label">${locked.length?'📌 لا توجد مهمة مفتوحة الآن':'🎉 أحسنت'}</div>
      <div class="jw-next-title">${locked.length?'لا توجد أنشطة متاحة حاليًا. تحقق من مواعيدها أو الصلاحيات الممنوحة لك.':'أكملت جميع الأنشطة التعليمية المتاحة'}</div>
      <div class="jw-next-meta">إنجازك الحالي ${done} من ${list.length} · ${pct}%</div>
    </div>`}

    <div class="jw-section-title"><b>📚 أنشطة رحلتك</b><span class="jw-count">${done}/${list.length} مكتملة · ${pct}%</span></div>
    <div class="jw-groups">
      ${sorted.map(([k,items])=>{
        const meta=typeMap[k]||{icon:'📘',title:'أنشطة',desc:''};
        const d=items.filter(x=>x.done).length;
        return `<div class="jw-group">
          <div class="jw-group-head" aria-label="قسم ${esc(meta.title)}"><div class="jw-group-icon">${meta.icon}</div><div class="jw-group-title"><span class="jw-group-label">قسم</span><strong>${meta.title}</strong><div class="jw-group-desc">${meta.desc}</div></div><span class="jw-group-count">${d}/${items.length}</span></div>
          <div class="jw-items">${items.map(h=>{
            const isNext=next && String(next.id)===String(h.id);
            const late=isLate(h), teacher=hasTeacherRetry(h), retry=hasPurchasedRetry(h), project=projectResubmit(h);
            const disabled=late && !teacher && !retry && !project;
            let state='', metaText='', icon=meta.icon;
            if(h.done && retry){ state='🔁 إعادة محاولة'; metaText='لديك بطاقة إعادة محاولة'; icon='🔁'; }
            else if(project){ state='🔁 إعادة التسليم'; metaText='لديك مهلة لإعادة تسليم المشروع'; icon='🔁'; }
            else if(teacher){ state='🔓 إعادة التسليم'; metaText='سمح المعلم بمحاولة إضافية'; icon='🔓'; }
            else if(h.done){ state='مكتمل ✓'; metaText='تم الإنجاز'; icon='✓'; }
            else if(late){ state='مغلق'; metaText='فات موعده'; icon='⏰'; }
            else if(isNext){ state='ابدأ الآن ←'; metaText='👈 ابدأ من هنا · الخطوة 1'; }
            else { const pIdx=pending.findIndex(x=>String(x.id)===String(h.id)); state=pIdx>=0?`الخطوة ${pIdx+1}`:'فتح'; metaText=pIdx>=0?'متاح · بعد إنهاء خطوتك الحالية':'متاح الآن'; }
            const dueText=h.due ? (late ? ' · أُغلق '+esc(h.due) : ' · يُغلق '+esc(h.due)) : '';
            return `<button type="button" class="jw-item ${h.done?'done':''} ${late?'late':''} ${isNext?'current':''} ${(!isNext&&!h.done&&!disabled)?'later':''} ${disabled?'disabled':''}" data-jw-id="${esc(h.id)}" ${disabled?'disabled':''}>
              <span class="jw-item-icon">${icon}</span>
              <span class="jw-item-body"><span class="jw-item-title">${esc(h.t||'نشاط')}</span><span class="jw-item-meta">${metaText}${dueText}</span></span>
              <span class="jw-item-state">${state}</span>
            </button>`;
          }).join('')}</div>
        </div>`;
      }).join('')}
    </div>
    ${locked.length ? `<div class="jw-footnote">🔒 <b>${locked.length} نشاط${locked.length===1?' غير متاح':'ات غير متاحة'} حاليًا</b> بسبب انتهاء الموعد وعدم وجود صلاحية إعادة تسليم. إذا منحك المعلم صلاحية إضافية سيظهر النشاط هنا كـ «إعادة تسليم» تلقائيًا.</div>` : ''}
    <div class="jw-footnote">💡 <b>كيف يعمل المسار؟</b> النشاط المتاح يظهر لك كمهمة تالية، بينما صلاحية المعلم وبطاقات إعادة المحاولة تفتح المسار من جديد دون تغيير حالة التسليم الأصلية حتى تنفذ الإجراء فعليًا.</div>
  `;

  // مسار مستقل بملء الشاشة حتى لا يضيع بين بطاقات الصفحة الرئيسية.
  mqGoFull(false);
  ws.classList.add('journey-page');
  ws.classList.remove('hide');
  $('journey-workspace-close').onclick=()=>{
    ws.classList.remove('journey-page','gm-full');
    ws.classList.add('hide');
    try{ mqGoFull(false); }catch(e){}
  };
  const openId=id=>{
    const lr=list.find(x=>String(x.id)===String(id));
    if(lr && String(lr.kind||'')==='lab'){ openLabRow(id); return; }
    const b=document.querySelector(`#gate-list .hw-item[data-id="${CSS.escape(id)}"]`);
    if(b){ ws.classList.add('hide'); b.click(); return; }
    const h=list.find(x=>String(x.id)===String(id));
    if(h && h.remedial){
      // لا يوجد في gate-list عمدًا، لأنه يظهر فقط داخل مسار التطوير.
      try{ location.hash=h.id; location.reload(); }catch(e){ toast('تعذّر فتح النشاط العلاجي','bad'); }
      return;
    }
    if(openGameActivity(id)) return;
    toast('تعذّر فتح النشاط من القائمة الحالية','bad');
  };
  content.querySelectorAll('[data-jw-id]').forEach(el=>el.onclick=async()=>{
    const id=el.getAttribute('data-jw-id');
    const h=list.find(x=>String(x.id)===String(id));
    if(!h) return;
    if(isLate(h) && !hasTeacherRetry(h) && !hasPurchasedRetry(h) && !projectResubmit(h)){
      toast('فات موعد إغلاق هذا النشاط ولا توجد صلاحية إعادة تسليم حالية','bad');
      return;
    }
    openId(id);
  });
  const nextBtn=$('journey-next-btn');
  if(nextBtn && next) nextBtn.onclick=()=>openId(next.id);
}

/* 🎮 مركز الألعاب: القالب مدمج داخل البوابة، ولا يعتمد على ملف ألعاب خارجي. */
/* ═══════════ 🎮 ألعاب النشاط: النشاط الواحد قد يحمل أكثر من لعبة ═══════════
   التوافق للخلف مضمون: الروابط القديمة ترسل g/game ككائن مفرد، والجديدة ترسل gs كمصفوفة. */
function gamesOf(h){
  if(!h) return [];
  const raw = Array.isArray(h.gs) ? h.gs : (Array.isArray(h.games) ? h.games : null);
  const list = raw ? raw : [h.game || h.g].filter(Boolean);
  return list.filter(g => g && typeof g==='object' && g.type && Array.isArray(g.data));
}

/* كل ما عدا «كشف الكلمات» يعمل على أسئلة اختيار من متعدد */
const GAME_KINDS = {
  memory:      { icon:'🎴', label:'كشف الكلمات',      mcq:false, max:8,
                 brief:'اكشف بطاقتين في كل مرة وابحث عن الكلمتين المتطابقتين.' },
  lock:        { icon:'🔐', label:'افتح القفل',        mcq:true,  max:8,
                 brief:'كل إجابة صحيحة تكشف رقمًا من الرمز حتى ينفتح القفل.' },
  millionaire: { icon:'🧗', label:'قفزة الصخور',       mcq:true,  max:8,
                 brief:'صخور عائمة فوق الهاوية. اقفز على الصخرة الصحيحة — والخاطئة تُسقطك.' },
  timeattack:  { icon:'🎈', label:'صيد البالونات',     mcq:true,  max:12,
                 brief:'الخيارات بالونات تصعد وتهرب. فرقع البالون الصحيح قبل أن يفلت.' },
  survival:    { icon:'🧺', label:'سلة المحصول',       mcq:true,  max:10,
                 brief:'الخيارات تتساقط. حرّك السلة والتقط الصحيح قبل أن يرتطم بالأرض.' },
  million:     { icon:'💰', label:'من سيربح المليون',   mcq:true,  max:10,
                 brief:'سلّم جوائز ونقاط أمان وثلاث وسائل مساعدة. اقفل إجابتك النهائية… وانتبه للوقت.' },
  whack:       { icon:'🔨', label:'اضرب الخُلد',        mcq:true,  max:10,
                 brief:'الخيارات تطلّ من جحورها لحظة ثم تختفي. اضرب الصحيح وهو ظاهر قبل أن يغيب.' },
  jumper: { icon:'🍄', label:'قفزة البطل', mcq:true, max:10,
    brief:'تحرّك واقفز لتضرب لوحة إجابتك: اضغط قصيرًا لتقفز فوق الجرثومة، وثبّت الزر للقفزة الكبيرة التي تضرب اللوحة.' },
  invaders: { icon:'👾', label:'غزاة الفضاء', mcq:true, max:10,
    brief:'الغزاة يحملون الإجابات. صوّب سفينتك وأطلق على الصحيح، وتفادَ قنابلهم.' },
  claw: { icon:'🕹️', label:'آلة المخلب', mcq:true, max:10,
    brief:'حرّك المخلب فوق كبسولة إجابتك ثم أنزله لتلتقطها.' },
};
/* لعبة الرهان حُذفت: الرهان سلوك لا نريد تعليمه للطالب.
   بياناتها أسئلة اختيار عادية، فتُحوَّل إلى «اضرب الخُلد» بدل أن تختفي من النشاط. */
const GAME_TYPE_ALIAS = { confidence:'whack' };
function gameTypeKey(t){
  const k=String(t||'').toLowerCase();
  return GAME_TYPE_ALIAS[k] || k;
}
function gameKind(t){ return GAME_KINDS[gameTypeKey(t)] || GAME_KINDS.memory; }
function isMcqGame(t){ return !!gameKind(t).mcq; }

function memoryWordsOfGame(g){
  if(!g || gameTypeKey(g.type)!=='memory') return [];
  return g.data.map(x=>String(x??'').trim()).filter(Boolean)
          .filter((x,i,a)=>a.indexOf(x)===i).slice(0,8);
}

function lockQuestionsOfGame(g){
  if(!g || !isMcqGame(g.type)) return [];
  return g.data.map((item,index)=>{
    if(!item || typeof item!=='object') return null;
    const q=String(item.q ?? item.question ?? item.text ?? '').trim();
    const options=Array.isArray(item.o) ? item.o : Array.isArray(item.options) ? item.options : [];
    const cleanOptions=options.map(x=>String(x??'').trim()).filter(Boolean).slice(0,4);
    if(!q || cleanOptions.length<2) return null;
    const rawAnswer=item.a ?? item.answer ?? item.correct;
    let answer=Number(rawAnswer);
    if(!Number.isInteger(answer) && typeof rawAnswer==='string'){
      answer=cleanOptions.findIndex(x=>x===rawAnswer.trim());
    }
    if(!Number.isInteger(answer) || answer<0 || answer>=cleanOptions.length) return null;
    return {q,options:cleanOptions,answer,index};
  }).filter(Boolean).slice(0, gameKind(g.type).max);
}

/* كل لعبة قابلة للعب تُعطى مفتاحًا فريدًا.
   اللعبة الأولى تحتفظ بمعرّف النشاط نفسه حتى لا تنكسر سجلات الخادم القديمة. */
function playableGames(h){
  if(!h) return [];
  return gamesOf(h).map((g,i)=>{
    const raw=gameTypeKey(g.type);
    const type=GAME_KINDS[raw]?raw:'memory';
    const words=memoryWordsOfGame(g);
    const questions=lockQuestionsOfGame(g);
    const ok = isMcqGame(type) ? questions.length>=2 : words.length>=2;
    if(!ok) return null;
    return {
      row:h, game:g, type, index:i,
      key: i===0 ? String(h.id) : String(h.id)+'-g'+i,
      words, questions,
      label: gameKind(type).label
    };
  }).filter(Boolean);
}

/* توافق مع بقية الكود القديم */
function gameDataOf(h){ const e=playableGames(h).find(x=>x.type==='memory'); return e?e.words:[]; }
function lockGameDataOf(h){ const e=playableGames(h).find(x=>isMcqGame(x.type)); return e?e.questions:[]; }
function isGameRow(h){ return playableGames(h).length>0; }
/* «نشاط ألعاب خالص»: لا أسئلة فيه. النشاط العادي المرفق به لعبة يبقى في قائمة الأنشطة
   وتظهر لعبته في قسم الألعاب أيضًا — كان يختفي بأسئلته كلها. */
/* 🗂️ ترتيب «جميع أنشطتي»: ثلاث مجموعات واضحة بدل قائمة مختلطة
   ① مطلوبة الآن (الأقرب إغلاقًا أولًا) ② سلّمتها ③ فات موعدها — والأحدث نشرًا أولًا داخل كل مجموعة */
const GATE_DAY=864e5;
function gateTs(h){ return Number(h.at)||(h.due?Date.parse(h.due+'T00:00:00')-7*GATE_DAY:0); }
function gateIsNew(h){ const a=Number(h.at)||0; return !h.done && a>0 && Date.now()-a<3*GATE_DAY; }
function gatePubLabel(h){
  const a=Number(h.at)||0; if(!a) return '';
  const d0=new Date(); d0.setHours(0,0,0,0); const d=new Date(a); d.setHours(0,0,0,0);
  const n=Math.round((d0-d)/GATE_DAY);
  const txt=n<=0?'اليوم':n===1?'أمس':n===2?'قبل يومين':n<=10?`قبل ${n} أيام`:new Date(a).toLocaleDateString('ar-SA-u-ca-gregory',{day:'numeric',month:'long'});
  return `🕒 نُشر ${txt} · `;
}
function gateActionable(h, t){
  if(Number(h.extra||h.extraAttempts||0)>0) return true;
  if(h.kind==='files'&&String(h.reviewStatus||'').toLowerCase()==='rejected'&&Number(h.resubmitUntil||0)>Date.now()) return true;
  return !h.done && !(h.due && h.due < t);
}
function gateGroups(rows, card){
  const t=todayISO(), tsOf=h=>gateTs(h)||Number(h.subAt)||0, newest=(a,b)=>tsOf(b)-tsOf(a);
  const todo=rows.filter(h=>gateActionable(h,t)).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||newest(a,b));
  const done=rows.filter(h=>!gateActionable(h,t)&&h.done).sort(newest);
  const late=rows.filter(h=>!gateActionable(h,t)&&!h.done).sort(newest);
  const sec=(cls,icon,title,list,hint,fold)=>{ if(!list.length) return '';
    const head=`<span class="gl-t">${icon} ${title}</span><span class="gl-n">${list.length}</span>${hint?`<small class="gl-h">${hint}</small>`:''}`;
    const body=`<div class="gl-list">${list.map(card).join('')}</div>`;
    return fold?`<details class="gl-sec ${cls}" ${list.length<=4?'open':''}><summary>${head}</summary>${body}</details>`:`<section class="gl-sec ${cls}"><div class="gl-head">${head}</div>${body}</section>`; };
  return sec('gl-todo','📌','مطلوبة منك الآن',todo,'الأقرب إغلاقًا أولًا',false)
    + (todo.length?'':'<div class="gl-empty">🎉 لا يوجد نشاط مطلوب منك الآن</div>')
    + sec('gl-done','✅','سلّمتها',done,'الأحدث أولًا',true)
    + sec('gl-late','⏰','فات موعدها',late,'',true);
}
function isPureGameRow(h){
  if(!isGameRow(h)) return false;
  if(String(h.kind||'')==='game' || String(h.kind||'')==='games') return true;
  return !(Number(h.n)>0);
}
function countGames(rows){ return (Array.isArray(rows)?rows:[]).reduce((n,h)=>n+playableGames(h).length,0); }
/* نص «المطلوب» بعدده، ظاهر كتنبيه */
function jsPendingText(n,one,many,v1,vN,extra='',cta='ابدأ الآن'){
  const head = n===1 ? `${one} واحد${one.endsWith('ة')?'ة':''} ${v1}` : n===2 ? `${one==='نشاط'?'نشاطان':one==='لعبة'?'لعبتان':one==='تجربة'?'تجربتان':'2 '+many} ${vN}` : `${n} ${many} ${vN}`;
  return `⚠️ ${head}${extra} — ${cta}`;
}
/* الألعاب التي لم تُلعب بعد (الملعوبة لا تُحسب «متاحة») */
function countUnplayedGames(rows){ return (Array.isArray(rows)?rows:[]).reduce((n,h)=>n+playableGames(h).filter(e=>!gamePlayedInfo(e)).length,0); }

/* 🔒 «مرة واحدة لكل لعبة»: الخادم يفرضها عبر مفتاح اللعبة،
   وهذه نسخة محلية لإقفال البطاقة فورًا على هذا الجهاز. */
const GPLAY_KEY='hw_gplayed_v1';
function gPlayedMap(){ try{ return JSON.parse(localStorage.getItem(GPLAY_KEY)||'{}')||{}; }catch(e){ return {}; } }
function gPlayedSet(key,score){
  try{ const m=gPlayedMap(); m[String(myName||'')+'|'+key]={s:score,at:Date.now()};
       localStorage.setItem(GPLAY_KEY,JSON.stringify(m)); }catch(e){}
}
function gamePlayedInfo(entry){
  if(!entry) return null;
  const row=entry.row||{};
  // الخادم أولًا: خريطة gamesPlayed تصل من /mine وتغطي كل الألعاب.
  // وجودها يعني أن الخادم قرر — فلا نرجع للذاكرة المحلية، وإلا بقيت
  // اللعبة مقفلة على الجهاز بعد أن سمح المعلم بإعادة التسليم.
  if(row.gamesPlayed && typeof row.gamesPlayed==='object'){
    const srv=row.gamesPlayed[entry.key];
    return srv && srv.played ? {score:srv.score} : null;
  }
  if(Number(row.extra||0)>0) return null;
  if(entry.index===0 && row.gamePlayed) return {score:row.gameScore};
  const l=gPlayedMap()[String(myName||'')+'|'+entry.key];
  return l ? {score:l.s} : null;
}
/* محاولة سابقة يمكن إعادتها: صلاحية معلم أو إعادة فتح من الخادم */
function gameRetryInfo(entry){
  const srv=entry && entry.row && entry.row.gamesPlayed && entry.row.gamesPlayed[entry.key];
  if(srv && srv.retry) return {score:srv.score};
  return null;
}
/* 🎟️ شريط الصلاحية في صفحة الألعاب: كل صلاحية أو بطاقة = لعبة واحدة يختارها الطالب */
function gamesRetryBanner(entries){
  const rows=[...new Set(entries.map(e=>e.row))].filter(r=>Number(r.extra||0)>0);
  const cards=Number(MYPERKS.retry||0);
  const parts=[];
  if(rows.length){ const n=rows.reduce((s,r)=>s+Number(r.extra||0),0);
    parts.push(`🔓 سمح لك المعلم ${n===1?'بإعادة واحدة':`بـ ${n} إعادات`} — ${n===1?'تُستخدم للعبة واحدة تختارها':'كل إعادة للعبة واحدة'}، وبعدها تُقفل بقية الألعاب.`); }
  if(cards && entries.some(e=>gamePlayedInfo(e))) parts.push(`🎟️ لديك ${cards===1?'بطاقة إعادة واحدة':cards+' بطاقات إعادة'} — كل بطاقة تعيد فتح لعبة واحدة لعبتها. اضغط اللعبة التي تريدها.`);
  return parts.length ? `<div class="games-retry-note">${parts.map(x=>`<p>${x}</p>`).join('')}</div>` : '';
}
/* بطاقة المتجر على لعبة بعينها: تُفتح هذه اللعبة وحدها */
async function gameUseRetryCard(e, nm, rows){
  const n=Number(MYPERKS.retry||0);
  const go=await ask({ icon:'🎟️', title:'إعادة هذه اللعبة ببطاقة', yes:'استخدم البطاقة', no:'ليس الآن',
    msg:`تُستخدم بطاقة واحدة (لديك ${n}) لإعادة فتح هذه اللعبة فقط، لا بقية الألعاب. تُحتسب المحاولة الجديدة، ويُضاف لرصيدك الفرق فقط إن تحسّنت نتيجتك.` });
  if(!go) return;
  try{
    const r=await storeFetch((API||'').replace(/\/+$/,'')+'/use',{ method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ name:nm||myName, sid:mySid||'', card:'retry', hw:String(e.row.id), game:e.key }) });
    const j=await r.json();
    if(!r.ok || !j.ok){ toast(j&&j.error==='none'?'لا تملك بطاقة إعادة':j&&j.error==='already_open'?'هذه اللعبة مفتوحة للإعادة أصلًا':'تعذّر استخدام البطاقة','bad'); return; }
    if(j.perks) MYPERKS=j.perks;
    const prev=gamePlayedInfo(e);
    if(!e.row.gamesPlayed || typeof e.row.gamesPlayed!=='object') e.row.gamesPlayed={};
    e.row.gamesPlayed[e.key]={ played:false, retry:true, reset:true, score:prev?prev.score:null };
    try{ const m=gPlayedMap(); delete m[String(myName||'')+'|'+e.key]; localStorage.setItem(GPLAY_KEY,JSON.stringify(m)); }catch(_){}
    toast('🎟️ فُتحت هذه اللعبة للإعادة','good');
    openJourneyGames(nm||myName, rows);
  }catch(err){ toast('تعذّر الاتصال — حاول لاحقًا','bad'); }
}

function markGamePlayed(entry, score, j){
  if(!entry) return;
  gPlayedSet(entry.key, score);
  const row=entry.row;
  if(!row) return;
  if(!row.gamesPlayed || typeof row.gamesPlayed!=='object') row.gamesPlayed={};
  row.gamesPlayed[entry.key]={played:true,score};
  if(entry.index===0){ row.gamePlayed=true; row.gameScore=score; }
  if(j && j.retried){
    // صلاحية واحدة = لعبة واحدة. نفدت الصلاحية؟ تعود بقية الألعاب مقفلة (عدا ما فُتح ببطاقة لعبة بعينها)
    row.extra=Math.max(0,Number(j.extraLeft)||0);
    if(!row.extra) playableGames(row).forEach(e=>{
      if(e.key===entry.key) return;
      const cur=row.gamesPlayed[e.key];
      if(cur && cur.retry && !cur.reset) row.gamesPlayed[e.key]={played:true,score:cur.score};
    });
    row.done=true;
  }
}

/* 🎮 نشاط الألعاب الخالص لا يظهر في «جميع أنشطتي» (له صفحة الألعاب)،
   فكل زر كان يبحث عنه هناك لا يجد شيئًا — ومنها «مهمتك الآن». هنا نفتح صفحة الألعاب
   مباشرة ونُبرز لعبة هذا النشاط. يعيد true إن تولّى الفتح. */
function openGameActivity(id){
  const rows=window.__journeyRows||[];
  const h=rows.find(x=>String(x.id)===String(id));
  if(!h || h.remedial || !isPureGameRow(h)) return false;
  openJourneyGames(myName, rows.filter(x=>isGameRow(x) && !x.remedial));
  setTimeout(()=>{
    const entries=window.__gameEntries||[];
    let n=entries.findIndex(e=>String(e.row.id)===String(h.id) && !gamePlayedInfo(e));
    if(n<0) n=entries.findIndex(e=>String(e.row.id)===String(h.id));
    const el=n>=0 ? document.querySelector(`[data-game-n="${n}"]`) : null;
    if(!el) return;
    el.scrollIntoView({block:'center',behavior:'smooth'});
    el.classList.add('game-card-focus');
    setTimeout(()=>el.classList.remove('game-card-focus'),2600);
  },80);
  return true;
}

function openJourneyGames(nm, rows){
  // 🔒 من أي مدخل (الرحلة، رابط إشعار): لا ألعاب قبل اختباري البداية
  if(window.__startGate===false){ toast('🔒 الألعاب تُفتح بعد إكمال اختباري البداية: «اكتشف طريقة تعلمك» ثم «اعرف مستواك»','bad'); return; }
  const ws=$('journey-workspace'), content=$('journey-workspace-content');
  if(!ws || !content) return;
  mqStop();
  mqGoFull(false);
  // 🎮 الألعاب تفتح كصفحة مستقلة كاملة، مثل بقية مسارات التعلم،
  // حتى لا تختلط بطاقات الألعاب بمحتوى الصفحة الرئيسية.
  ws.classList.add('journey-page');
  const entries=[];
  (Array.isArray(rows)?rows:[]).forEach(h=>playableGames(h).forEach(e=>entries.push(e)));
  if(!entries.length){ toast('لا توجد ألعاب منشورة لك حاليًا','bad'); return; }
  window.__gameEntries=entries;

  content.innerHTML=`
    <div class="jw-head">
      <div>
        <span class="jw-kicker">🎮 الألعاب</span>
        <h3>العب وتعلّم</h3>
        <p class="muted">اختر لعبة متاحة لك، ثم ثبّت مهارتك باللعب.</p>
      </div>
      <button type="button" class="btn ghost jw-close" id="games-workspace-close">إغلاق</button>
    </div>
    ${gamesRetryBanner(entries)}
    <div class="game-list">
      ${entries.map((e,n)=>{
        const info=gamePlayedInfo(e);
        const played=!!info;
        const cardOK=played && Number(MYPERKS.retry||0)>0;
        const k=gameKind(e.type);
        const icon=k.icon;
        const sameRow=playableGames(e.row).length>1;
        const base=String(e.row.t||e.label);
        const title=sameRow ? `${base} — ${e.label}` : base;
        const cnt=isMcqGame(e.type)?e.questions.length:e.words.length;
        const detail={
          memory:`${cnt} كلمات · ${cnt*2} بطاقة`,
          lock:`${cnt} أسئلة · رمز من ${cnt} أرقام`,
          millionaire:`${cnt} قفزات · صخور عائمة`,
          timeattack:`${cnt} جولة · بالونات تهرب`,
          survival:`${cnt} جولة · سلة و٣ محاولات`,
          million:`${cnt} مستويات · ٣ وسائل مساعدة`,
          whack:`${cnt} جولة · جحور تظهر وتختفي`
        }[e.type]||`${cnt} عناصر`;
        const retry=!played && gameRetryInfo(e);
        const meta=played
          ? `لعبتها · نتيجتك ${info.score==null?'—':info.score} من 50 📖`
          : retry
            ? `🔓 إعادة محاولة متاحة · نتيجتك السابقة ${retry.score} من 50`
            : `${k.label} · ${detail}`;
        return `<button type="button" class="game-card${played?' game-card-done':''}" data-game-n="${n}" ${played&&!cardOK?'disabled':''}>
          <span class="game-icon">${played?'✅':icon}</span>
          <span class="game-body">
            <span class="game-title">${esc(title)}</span>
            <span class="game-meta">${meta}</span>
          </span>
          <span style="font-size:.78rem;color:${played&&!cardOK?'var(--ink-soft)':'var(--tick)'};font-weight:900">${cardOK?'🎟️ أعد اللعب ببطاقة':played?'انتهت':retry?'أعد المحاولة ›':'العب ›'}</span>
        </button>`;
      }).join('')}
    </div>`;
  ws.classList.remove('hide');
  $('games-workspace-close').onclick=()=>{
    mqGoFull(false);
    ws.classList.remove('journey-page','gm-full');
    ws.classList.add('hide');
  };

  content.querySelectorAll('[data-game-n]').forEach(el=>{
    el.onclick=async ()=>{
      const e=entries[Number(el.getAttribute('data-game-n'))];
      if(!e) return;
      if(gamePlayedInfo(e)){
        if(Number(MYPERKS.retry||0)>0){ await gameUseRetryCard(e, nm, rows); return; }
        toast('لعبت هذه اللعبة من قبل — محاولة واحدة فقط','bad'); return;
      }
      const k=gameKind(e.type);
      // نافذة التأكيد يجب أن تظهر فوق صفحة الألعاب المستقلة، لا خلفها.
      const retry=gameRetryInfo(e);
      const go=await ask(retry ? {
        icon:'🔓',
        title:'إعادة المحاولة',
        msg:`${k.brief} نتيجتك السابقة ${retry.score} من 50. تُحتسب المحاولة الجديدة، ويُضاف لرصيدك الفرق فقط إن تحسّنت نتيجتك.`,
        yes:'أعد المحاولة',
        no:'ليس الآن'
      } : {
        icon:k.icon,
        title:'محاولة واحدة فقط',
        msg:k.brief+' تُلعب مرة واحدة، وتُضاف نقاطك لرصيد المتجر.',
        yes:'ابدأ اللعب',
        no:'ليس الآن'
      });
      if(!go) return;
      if(e.type==='lock') renderStudentLockGame(e);
      else if(isMcqGame(e.type)) renderMcqGame(e);
      else renderStudentMemoryGame(e);
    };
  });
}

/* 🔊 صوت اللعبة: مؤثرات مولّدة داخل المتصفح (تعمل دون إنترنت، بلا ملفات صوتية).
   مهم لشاشات المدرسة على Windows حيث قد لا تتوفر شبكة. */
/* احتياط لمتصفحات iOS القديمة التي تتجاهل touch-action:
   نمنع النقرة الثانية من توليد تكبير، دون أن نُضيع النقرة نفسها. */
(function preventDoubleTapZoom(){
  let last=0;
  document.addEventListener('touchend',e=>{
    const now=Date.now();
    const tag=(e.target&&e.target.tagName)||'';
    if(now-last<=320 && e.cancelable && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag)){
      e.preventDefault();                       // يمنع التكبير
      const hit=e.target&&e.target.closest&&e.target.closest('button,[role=button],.game-card,.jw-item');
      if(hit) hit.click();                      // ونعيد إطلاق النقرة يدويًا حتى لا تضيع
    }
    last=now;
  },{passive:false});
})();

const GameSound = (function(){
  const KEY='gs_sound_on';
  let ctx=null, on=true;
  try{ on = localStorage.getItem(KEY)!=='0'; }catch(e){}

  function ac(){
    if(ctx) return ctx;
    try{ ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ ctx=null; }
    return ctx;
  }
  // سياسة المتصفح تمنع الصوت قبل أول تفاعل — نستأنف السياق بعد أول لمسة
  function unlock(){ const c=ac(); if(c && c.state==='suspended'){ c.resume().catch(()=>{}); } }

  // نغمة واحدة بمظروف بسيط لتفادي الطقطقة
  function tone(freq, start, dur, type, vol){
    const c=ac(); if(!c) return;
    const t0=c.currentTime+start;
    const osc=c.createOscillator(), g=c.createGain();
    osc.type=type||'sine'; osc.frequency.setValueAtTime(freq,t0);
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(vol||0.18,t0+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t0); osc.stop(t0+dur+0.02);
  }

  const SFX={
    flip: ()=>tone(520,0,0.10,'triangle',0.14),
    match:()=>{ tone(660,0,0.14,'sine',0.18); tone(990,0.10,0.20,'sine',0.18); },
    miss: ()=>{ tone(200,0,0.16,'sawtooth',0.10); tone(150,0.10,0.20,'sawtooth',0.10); },
    win:  ()=>{ [523,659,784,1047].forEach((f,i)=>tone(f,i*0.13,0.24,'triangle',0.17)); }
  };

  return {
    get on(){ return on; },
    unlock,
    sfx(name){ if(!on) return; unlock(); (SFX[name]||(()=>{}))(); },
    toggle(){
      on=!on;
      try{ localStorage.setItem(KEY, on?'1':'0'); }catch(e){}
      if(on) unlock();
      return on;
    }
  };
})();

let studentMemoryState = null;
function renderStudentMemoryGame(entry){
  mqStop();
  mqGoFull(true);
  const ws=$('journey-workspace'), content=$('journey-workspace-content');
  const h=entry && entry.row;
  const words=(entry && entry.words) || [];
  if(!ws || !content || words.length<2){ toast('تعذّر فتح اللعبة لأن محتواها غير مكتمل','bad'); return; }

  const deck=[];
  words.forEach((word,i)=>{
    deck.push({key:i+'a',word,pair:i});
    deck.push({key:i+'b',word,pair:i});
  });
  for(let i=deck.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [deck[i],deck[j]]=[deck[j],deck[i]];
  }
  studentMemoryState={entry,key:entry.key,title:String(h.t||'كشف الكلمات'),deck,open:[],matched:new Set(),moves:0,locked:false,startedAt:Date.now()};

  content.innerHTML=`
    <div class="jw-head">
      <div>
        <span class="jw-kicker">🎴 كشف الكلمات</span>
        <h3>${esc(h.t||'كشف الكلمات')}</h3>
        <p class="muted">اكشف بطاقتين في كل مرة وحاول العثور على الكلمتين المتطابقتين.</p>
      </div>
      <div style="display:flex;gap:.4rem;align-items:center">
        <button type="button" class="btn ghost jw-close" id="memory-sound" title="الصوت" aria-pressed="${GameSound.on?'true':'false'}" style="min-width:2.4rem">${GameSound.on?'🔊':'🔇'}</button>
        <button type="button" class="btn ghost jw-close" id="memory-back">الألعاب</button>
      </div>
    </div>
    <div class="game-play">
      <div id="game-memory-board" class="game-memory"></div>
      <div id="game-memory-status" class="game-memory-status">الأزواج المكتشفة: 0 من ${words.length} · المحاولات: 0</div>
    </div>`;
  ws.classList.remove('hide');
  $('memory-back').onclick=()=>openJourneyGames(myName, (window.__journeyRows||[]));
  const soundBtn=$('memory-sound');
  if(soundBtn) soundBtn.onclick=()=>{ const s=GameSound.toggle(); soundBtn.textContent=s?'🔊':'🔇'; soundBtn.setAttribute('aria-pressed',s?'true':'false'); if(s) GameSound.sfx('flip'); };
  renderStudentMemoryBoard();
}

function renderStudentMemoryBoard(){
  const st=studentMemoryState, board=$('game-memory-board'), status=$('game-memory-status');
  if(!st || !board) return;
  board.innerHTML=st.deck.map((c,i)=>{
    const open=st.open.includes(i), matched=st.matched.has(i);
    return `<button type="button" class="game-memory-card ${open?'revealed':''} ${matched?'matched':''}" data-memory-index="${i}" ${matched?'disabled':''}>
      ${open||matched ? esc(c.word) : '<span class="gm-back">?</span>'}
    </button>`;
  }).join('');
  if(status) status.textContent=`الأزواج المكتشفة: ${st.matched.size/2} من ${st.deck.length/2} · المحاولات: ${st.moves}`;
  board.querySelectorAll('[data-memory-index]').forEach(el=>el.onclick=()=>studentMemoryFlip(Number(el.getAttribute('data-memory-index'))));
}

function studentMemoryFlip(index){
  const st=studentMemoryState;
  if(!st || st.locked || st.matched.has(index) || st.open.includes(index)) return;
  st.open.push(index);
  GameSound.sfx('flip');
  renderStudentMemoryBoard();
  if(st.open.length<2) return;

  st.moves++;
  st.locked=true;
  const [a,b]=st.open;
  const same=st.deck[a].pair===st.deck[b].pair;
  setTimeout(()=>{
    if(same){
      GameSound.sfx('match');
      st.matched.add(a); st.matched.add(b);
      st.open=[];
      st.locked=false;
      renderStudentMemoryBoard();
      if(st.matched.size===st.deck.length) renderStudentMemoryDone();
    }else{
      GameSound.sfx('miss');
      st.open=[];
      st.locked=false;
      renderStudentMemoryBoard();
    }
  }, same ? 350 : 850);
}

function renderStudentMemoryDone(){
  const st=studentMemoryState, box=$('game-memory-board');
  if(!st || !box) return;
  GameSound.sfx('win');
  const status=$('game-memory-status');
  const pairs=st.deck.length/2;
  const secs=Math.max(1, Math.round((Date.now()-(st.startedAt||Date.now()))/1000));
  // النتيجة = كفاءة (أقل محاولات أفضل) + سرعة (وقت أقل أفضل)، مجموعهما ≤ 50
  const eff = Math.max(0, Math.min(1, pairs/Math.max(pairs, st.moves)));           // مثالي = عدد المحاولات يساوي عدد الأزواج
  const fast = secs<=pairs*4 ? 1 : secs>=pairs*12 ? 0 : (pairs*12-secs)/(pairs*8); // هدف زمني يتناسب مع عدد البطاقات
  const score = Math.max(0, Math.min(50, Math.round(30*eff + 20*fast)));
  box.innerHTML=`<div class="game-memory-result" style="grid-column:1/-1">
    <b>🎉 أحسنت! اكتملت اللعبة</b>
    <span>عثرت على ${pairs} أزواج في ${st.moves} محاولة · ${secs} ثانية</span>
    <div id="gm-award" style="margin-top:.55rem;font-weight:900;color:var(--tick)">نتيجتك: ${score} / 50 📖<br><span style="font-weight:600;font-size:.78rem;color:var(--ink-soft)">جارٍ إضافة النقاط لرصيدك…</span></div>
    <button type="button" class="btn ghost" id="memory-back2" style="margin-top:.7rem">عودة للألعاب</button>
  </div>`;
  if(status) status.textContent='أكملت كشف الكلمات بنجاح';
  $('memory-back2').onclick=()=>openJourneyGames(myName, (window.__journeyRows||[]));
  awardMemoryGame(st.key, score, secs, st.moves).then(j=>{
    const el=$('gm-award'); if(!el) return;
    if(!j){
      el.innerHTML=`نتيجتك: ${score} / 50 📖<br><span style="font-weight:600;font-size:.78rem;color:var(--pen)">تعذّر الاتصال — لم تُضف النقاط. أبلغ معلمك.</span>`;
      return;
    }
    // 🔒 أقفل هذه اللعبة تحديدًا (لا النشاط كله) فورًا عند العودة
    try{ markGamePlayed(st.entry, (j.score!=null?j.score:score), j); }catch(e){}
    if(j.retried){ el.innerHTML = `نتيجتك الجديدة ${j.score} من 50 · السابقة ${j.prevScore??'—'}<br><span style="font-weight:600;font-size:.78rem;color:var(--ink-soft)">${j.gain>0?`تحسّنت! أُضيفت ${j.gain} نقطة لرصيدك (رصيدك ${j.pts})`:'لم تتجاوز نتيجتك السابقة، فلا نقاط إضافية — التسليم الجديد مسجّل.'}</span>`; return; }
    el.innerHTML = j.already
      ? `نتيجتك السابقة: ${j.score} / 50 📖<br><span style="font-weight:600;font-size:.78rem;color:var(--ink-soft)">لعبتها من قبل — لا تُضاف النقاط مرتين.</span>`
      : `أُضيفت ${j.gain} نقطة لرصيد المتجر 📖<br><span style="font-weight:600;font-size:.78rem;color:var(--ink-soft)">رصيدك الآن ${j.pts} · محاولة واحدة فقط لكل لعبة</span>`;
  });
}

/* 📖 منح نقاط اللعبة عبر الخادم — الرصيد مصدره الخادم، فالإضافة المحلية تُمحى عند أول تحديث.
   الخادم يفرض السقف (50) ويمنح فرق التحسّن فقط، فلا يزرع اللعب المتكرر نقاطاً. */
/* 📖 تحديث كل واجهات الرصيد فورًا بعد تغيّر النقاط.
   الرصيد يظهر في أربعة مواضع (رأس البوابة، حالة المتجر، ما قبل البدء، والمتجر نفسه)
   وكان تحديث موضع واحد يترك الباقي بأرقام قديمة حتى تحديث الصفحة. */
function syncBalanceUI(){
  const v = MYPTS;
  try{ nmApply(); }catch(e){}
  try{ const pb=$('pre-bal'); if(pb) pb.textContent = v + ' 📖'; }catch(e){}
  try{
    const gb=$('gate-bal'); const el=gb && gb.querySelector('.bal');
    if(el) el.textContent = v + ' 📖';
  }catch(e){}
  try{
    const gs=$('gate-store-status');
    if(gs && !gs.textContent.includes('اكتب اسم')) gs.textContent = `رصيدك الحالي ${v} نقطة — اختر بطاقة من المتجر`;
  }catch(e){}
  // أعد رسم المتجر المفتوح حتى تُفعَّل أزرار الشراء بالرصيد الجديد
  try{
    ['gate-store-box','pre-store','store-box'].forEach(id=>{
      const box=$(id);
      if(!box || box.classList.contains('hide') || !box.innerHTML.trim()) return;
      // store-box يُرسم بلا وسيط ليبقى حاجب اختبارات القياس (بلا نقاط ولا بطاقات) عاملاً
      if(id==='store-box') renderStore(); else renderStore(id);
    });
  }catch(e){}
}

let studentLockState=null;

function lockDigitForQuestion(item,index){
  return String((((item.answer+1)*7)+(index+1)*3)%10);
}

function renderStudentLockGame(entry){
  mqStop();
  mqGoFull(true);
  const ws=$('journey-workspace'), content=$('journey-workspace-content');
  const h=entry && entry.row;
  const questions=(entry && entry.questions) || [];
  if(!ws || !content || questions.length<2){
    toast('تعذّر فتح لعبة افتح القفل لأن محتواها غير مكتمل','bad');
    return;
  }
  studentLockState={
    entry,
    key:entry.key,
    title:String(h.t||'افتح القفل'),
    questions,
    index:0,
    code:questions.map((q,i)=>lockDigitForQuestion(q,i)),
    revealed:[],
    attempts:0,
    correct:0,
    locked:false,
    startedAt:Date.now()
  };

  content.innerHTML=`
    <div class="jw-head">
      <div>
        <span class="jw-kicker">🔐 افتح القفل</span>
        <h3>${esc(studentLockState.title)}</h3>
        <p class="muted">كل إجابة صحيحة تكشف رقمًا من الرمز. أكمل الرمز كاملًا ليُفتح الصندوق.</p>
      </div>
      <button type="button" class="btn ghost jw-close" id="lock-back">الألعاب</button>
    </div>
    <div class="game-play game-lock">
      <div class="game-lock-top">
        <strong id="lock-step">السؤال 1 من ${questions.length}</strong>
        <span id="lock-score" class="muted">⭐ 0</span>
      </div>
      <div class="lk-vault" id="lock-vault">
        <div class="lk-rays"></div>
        <div class="lk-chest" id="lock-chest">
          <div class="lk-lid"><span class="lk-hinge"></span></div>
          <div class="lk-body"><span class="lk-pad" id="lock-pad">🔒</span></div>
          <div class="lk-loot" id="lock-loot"></div>
        </div>
      </div>
      <div class="game-lock-code" id="lock-code"></div>
      <div class="game-lock-progress"><i id="lock-progress"></i></div>
      <div id="lock-question"></div>
      <div id="lock-feedback" class="game-lock-feedback"></div>
    </div>`;
  ws.classList.remove('hide');
  $('lock-back').onclick=()=>openJourneyGames(myName,(window.__journeyRows||[]));
  renderStudentLockQuestion();
}

function renderStudentLockQuestion(){
  const st=studentLockState;
  if(!st) return;
  const question=st.questions[st.index];
  const code=$('lock-code'), qbox=$('lock-question');
  const step=$('lock-step'), progress=$('lock-progress'), feedback=$('lock-feedback');
  if(!question || !code || !qbox) return;

  code.innerHTML=st.code.map((digit,i)=>{
    const open=st.revealed.includes(i);
    return `<span class="game-lock-digit${open?' open':''}">${open?digit:'?'}</span>`;
  }).join('');
  if(step) step.textContent=`السؤال ${st.index+1} من ${st.questions.length}`;
  if(progress) progress.style.width=`${Math.round(st.index/st.questions.length*100)}%`;
  if(feedback) feedback.textContent='';

  qbox.innerHTML=`
    <div class="game-lock-question">
      <div class="lk-num">🔑 جزء ${st.index+1} من الرمز</div>
      <div class="lk-q">${esc(question.q)}</div>
      <div class="game-lock-options">
        ${question.options.map((option,i)=>`
          <button type="button" class="game-lock-option" data-lock-option="${i}">${esc(option)}</button>
        `).join('')}
      </div>
    </div>`;
  qbox.querySelectorAll('[data-lock-option]').forEach(btn=>{
    btn.onclick=()=>studentLockAnswer(Number(btn.getAttribute('data-lock-option')));
  });
}

function studentLockAnswer(choice){
  const st=studentLockState;
  if(!st || st.locked) return;
  const question=st.questions[st.index];
  if(!question) return;

  st.attempts++;
  (st.log||(st.log=[])).push({q:question.q, c:question.options[choice]??''});
  const buttons=[...document.querySelectorAll('[data-lock-option]')];
  buttons.forEach(btn=>btn.disabled=true);
  const selected=buttons[choice];
  const correct=choice===question.answer;

  if(correct){
    st.correct++;
    st.revealed.push(st.index);
    if(selected) selected.classList.add('correct');
    GameSound.sfx('match');
    lockChestNudge();   // الصندوق يهتزّ مع كل رقم يُكشف
    const left=st.questions.length-st.revealed.length;
    $('lock-feedback').textContent = left
      ? `🎉 صحيح! انكشف رقم — بقي ${left} ${left===1?'رقم':'أرقام'} لفتح الصندوق.`
      : '🎉 اكتمل الرمز!';
    $('lock-feedback').style.color='var(--tick)';
  }else{
    if(selected) selected.classList.add('wrong');
    const right=buttons[question.answer];
    if(right) right.classList.add('correct');
    GameSound.sfx('miss');
    $('lock-feedback').textContent='إجابة غير صحيحة — الصندوق يحتاج الرمز كاملًا.';
    $('lock-feedback').style.color='var(--pen)';
  }

  st.locked=true;
  setTimeout(()=>{
    st.locked=false;
    st.index++;
    if(st.index>=st.questions.length) renderStudentLockDone();
    else renderStudentLockQuestion();
  },correct?650:1050);
}

function lockChestNudge(){
  const c=$('lock-chest');
  if(!c) return;
  c.classList.remove('nudge');
  void c.offsetWidth;
  c.classList.add('nudge');
}

function renderStudentLockDone(){
  const st=studentLockState, box=$('lock-question');
  if(!st || !box) return;
  GameSound.sfx('win');
  const code=$('lock-code'), progress=$('lock-progress');
  if(code) code.innerHTML=st.code.map(d=>`<span class="game-lock-digit open">${d}</span>`).join('');
  if(progress) progress.style.width='100%';

  const secs=Math.max(1,Math.round((Date.now()-(st.startedAt||Date.now()))/1000));
  const total=st.questions.length;
  const accuracy=st.correct/Math.max(1,st.attempts);
  const speed=Math.max(0,Math.min(1,1-secs/(total*12)));
  const perfect=st.correct===total;
  /* 🎁 الصندوق لا يُفتح إلا برمز كامل، و١٠ نقاط من الخمسين محجوزة لهذا الإتقان. */
  const base=Math.max(0,Math.min(40,Math.round(30*accuracy+10*speed)));
  const score=Math.min(50, base + (perfect?10:0));

  const prize=String((st.entry && st.entry.game && st.entry.game.prize) || '').trim();
  const chest=$('lock-chest'), loot=$('lock-loot'), pad=$('lock-pad'), vault=$('lock-vault');
  if(perfect){
    if(pad) pad.textContent='🔓';
    if(loot) loot.innerHTML=`<span class="lk-gift">🎁</span>`;
    if(vault) vault.classList.add('open');
    if(chest) chest.classList.add('open');
  }else{
    if(chest) chest.classList.add('shut');
  }

  box.innerHTML=`
    <div class="game-lock-result ${perfect?'':'dim'}">
      <b>${perfect?'🎉 انفتح الصندوق!':'🔒 الصندوق لم يُفتح'}</b>
      <span>${st.correct} من ${total} إجابات صحيحة · ${secs} ثانية</span>
      ${perfect
        ? `<div class="lk-prize">${esc(prize||'أحسنت! أتقنت الرمز كاملًا — هذا الصندوق لك.')}</div>
           <div class="lk-bonus">+10 نقاط مكافأة الإتقان 🏅</div>`
        : `<div class="lk-prize dim">ينقصك ${total-st.correct} ${total-st.correct===1?'رقم':'أرقام'} من الرمز.
            الصندوق يُفتح بالرمز كاملًا فقط — ومعه ١٠ نقاط إضافية.</div>`}
      <div id="lock-award" style="margin-top:.55rem;font-weight:900;color:var(--tick)">
        نتيجتك: ${score} / 50 📖<br>
        <span style="font-weight:600;font-size:.78rem;color:var(--ink-soft)">جارٍ إضافة النقاط لرصيدك…</span>
      </div>
      <button type="button" class="btn ghost" id="lock-back2" style="margin-top:.7rem">عودة للألعاب</button>
    </div>`;
  $('lock-back2').onclick=()=>openJourneyGames(myName,(window.__journeyRows||[]));

  awardMemoryGame(st.key,score,secs,st.attempts,st.log).then(j=>{
    const el=$('lock-award');
    if(!el) return;
    if(!j){
      el.innerHTML=`نتيجتك: ${score} / 50 📖<br><span style="font-weight:600;font-size:.78rem;color:var(--pen)">تعذّر الاتصال — لم تُضف النقاط. أبلغ معلمك.</span>`;
      return;
    }
    try{ markGamePlayed(st.entry, (j.score!=null?j.score:score), j); }catch(e){}
    if(j.retried){ el.innerHTML = `نتيجتك الجديدة ${j.score} من 50 · السابقة ${j.prevScore??'—'}<br><span style="font-weight:600;font-size:.78rem;color:var(--ink-soft)">${j.gain>0?`تحسّنت! أُضيفت ${j.gain} نقطة لرصيدك (رصيدك ${j.pts})`:'لم تتجاوز نتيجتك السابقة، فلا نقاط إضافية — التسليم الجديد مسجّل.'}</span>`; return; }
    el.innerHTML=j.already
      ? `نتيجتك السابقة: ${j.score} / 50 📖<br><span style="font-weight:600;font-size:.78rem;color:var(--ink-soft)">لعبتها من قبل — لا تُضاف النقاط مرتين.</span>`
      : `أُضيفت ${j.gain} نقطة لرصيد المتجر 📖<br><span style="font-weight:600;font-size:.78rem;color:var(--ink-soft)">رصيدك الآن ${j.pts} · محاولة واحدة فقط لكل لعبة</span>`;
  });
}


/* ═══════════ 🎮 ألعاب الاختيار من متعدد ═══════════
   البنك واحد، لكن لكل لعبة مشهد وفعل مختلف:
   بالونات تهرب · متسلّق ينزلق · برج يتصدّع · خُلد يطلّ ويغيب.
   لا شيء منها «صندوق أسئلة» — الإجابة فعل داخل المشهد. */
let mqState=null;

/* 🖥️ اللعب يأخذ الشاشة كاملة: البطاقة الضيقة كانت تخنق المشهد */
let __mqScrollY=0;
function mqGoFull(on){
  const ws=document.getElementById('journey-workspace');
  if(!ws) return;
  const already=ws.classList.contains('gm-full');
  if(on===!!already) return;
  if(on){
    /* 🔝 قفل الخلفية يفقد موضع التمرير فترجع الصفحة للأعلى عند الخروج.
       نحفظ الموضع ونثبّت الجسم مكانه، ثم نعيده كما كان. */
    __mqScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    document.body.style.top = (-__mqScrollY)+'px';
    document.body.classList.add('gm-playing');
    ws.classList.add('gm-full');
    ws.scrollTop = 0;
  }else{
    ws.classList.remove('gm-full');
    document.body.classList.remove('gm-playing');
    document.body.style.top = '';
    window.scrollTo(0, __mqScrollY);
  }
}
/* أي خروج غير متوقع (إغلاق اللوحة · رجوع المتصفح) لا يترك الصفحة مقفلة */
window.addEventListener('pageshow',()=>{ try{ mqGoFull(false); }catch(e){} });
function mqIsFull(){
  return !!document.getElementById('journey-workspace')?.classList.contains('gm-full');
}
/* ارتفاع الملعب يتبع الشاشة لا رقمًا ثابتًا */
function mqStageHeight(){
  const h=window.innerHeight||700, w=window.innerWidth||420;
  if(mqIsFull()) return Math.max(280,Math.min(460,Math.round(h*0.52)));
  return w<440?215:255;
}

function mqStop(){
  if(!mqState) return;
  if(mqState.timer){ clearInterval(mqState.timer); mqState.timer=null; }
  if(mqState.qTimer){ clearTimeout(mqState.qTimer); mqState.qTimer=null; }
  if(mqState.tick){ clearInterval(mqState.tick); mqState.tick=null; }
  if(mqState.moleTimer){ clearInterval(mqState.moleTimer); mqState.moleTimer=null; }
  if(mqState.loop){ clearInterval(mqState.loop); mqState.loop=null; }
}

function renderMcqGame(entry){
  const ws=$('journey-workspace'), content=$('journey-workspace-content');
  mqGoFull(true);
  const h=entry && entry.row;
  const qs=(entry && entry.questions) || [];
  if(!ws || !content || qs.length<2){ toast('تعذّر فتح اللعبة لأن محتواها غير مكتمل','bad'); return; }
  mqStop();

  const k=gameKind(entry.type);
  mqState={
    entry, key:entry.key, type:entry.type, qs,
    i:0, correct:0, answered:0, lives:3, streak:0, bestStreak:0,
    helps:{fifty:1,skip:1,time:1}, timeExtended:null, sel:null, tower:[],
    timer:null, qTimer:null, tick:null, moleTimer:null, loop:null, fall:[], basketX:42, levels:0,
    locked:false, over:false, startedAt:Date.now()
  };

  content.innerHTML=`
    <div class="jw-head">
      <div>
        <span class="jw-kicker">${k.icon} ${esc(k.label)}</span>
        <h3>${esc(h.t||k.label)}</h3>
        <p class="muted">${esc(k.brief)}</p>
      </div>
      <div style="display:flex;gap:.4rem;align-items:center">
        <button type="button" class="btn ghost jw-close" id="mq-sound" title="الصوت"
          aria-pressed="${GameSound.on?'true':'false'}" style="min-width:2.4rem">${GameSound.on?'🔊':'🔇'}</button>
        <button type="button" class="btn ghost jw-close" id="mq-back">الألعاب</button>
      </div>
    </div>
    <div class="game-play mq-wrap">
      <div class="mq-top" id="mq-top"></div>
      <div id="mq-scene"></div>
      <div class="mq-feedback" id="mq-feedback"></div>
    </div>`;
  ws.classList.remove('hide');
  $('mq-back').onclick=()=>{ mqStop(); openJourneyGames(myName,(window.__journeyRows||[])); };
  const sndBtn=$('mq-sound');
  if(sndBtn) sndBtn.onclick=()=>{ const on=GameSound.toggle(); sndBtn.textContent=on?'🔊':'🔇';
    sndBtn.setAttribute('aria-pressed',on?'true':'false'); if(on) GameSound.sfx('flip'); };

  mqRender();
}

function mqTop(){
  const st=mqState, box=$('mq-top');
  if(!st||!box) return;
  const total=st.qs.length;
  if(st.type==='timeattack'){
    box.innerHTML=`<b>🎈 ${Math.min(st.i+1,total)} من ${total}</b>
      <span>✔️ ${st.correct}</span>
      <span class="${st.streak>=3?'mq-hot':''}">🔥 تتابع ${st.streak}</span>`;
  }else if(st.type==='millionaire'){
    box.innerHTML=`<b>🧗 القفزة ${Math.min(st.i+1,total)} من ${total}</b>
      <span>ارتفاعك ${st.correct}</span>
      <span>سقطة واحدة تنهي الجولة</span>`;
  }else if(st.type==='million'){
    const safe=msSecured(st);
    box.innerHTML=`<b>💰 المستوى ${Math.min(st.correct+1,msLevels(st))} من ${msLevels(st)}</b>
      <span>🛡️ مضمون: ${msValue(st,safe)} نقطة</span>
      <span>🎟️ مساعدات: ${Object.values(st.helps).filter(Boolean).length}</span>`;
  }else if(st.type==='survival'){
    const sup=[0,1,2].map(n=>n<st.lives?'🧺':'💔').join('');
    box.innerHTML=`<b class="mq-supports">${sup}</b>
      <span>التقطت ${st.correct} من ${total}</span>`;
  }else{
    box.innerHTML=`<b>🔨 ${Math.min(st.i+1,total)} من ${total}</b>
      <span>✔️ ${st.correct}</span>
      <span class="${st.streak>=3?'mq-hot':''}">🔥 تتابع ${st.streak}</span>`;
  }
}

function mqAsk(q,st){
  return `<div class="mq-ask"><small>السؤال ${st.i+1} من ${st.qs.length}</small>${esc(q.q)}</div>`;
}

function mqRender(){
  const st=mqState;
  if(!st || st.over) return;
  const q=st.qs[st.i];
  if(!q){ mqFinish('أكملت كل الأسئلة'); return; }
  st.locked=false;
  if(st.qTimer){ clearTimeout(st.qTimer); st.qTimer=null; }
  if(st.tick){ clearInterval(st.tick); st.tick=null; }
  if(st.moleTimer){ clearInterval(st.moleTimer); st.moleTimer=null; }
  if(st.loop){ clearInterval(st.loop); st.loop=null; }
  const fb=$('mq-feedback'); if(fb) fb.textContent='';
  mqTop();
  const scene=$('mq-scene');
  if(!scene) return;
  ({timeattack:mqSceneBalloons, millionaire:mqSceneClimb, jumper:mqSceneArcade, invaders:mqSceneArcade, claw:mqSceneArcade,
    survival:mqSceneCatch, whack:mqSceneWhack,
    million:mqSceneMillion}[st.type]||mqSceneBalloons)(scene,q,st);
}

/* ═══════════ 🕹️ محرك الأركيد v2 (المسابقة المباشرة + اللعب الفردي) ═══════════
   رسومات بكسل حقيقية: المشهد بنصف دقة الشاشة ويُكبَّر ×2 بلا تنعيم؛ الشخصيات خرائط بكسل بإطارات حركة
   (شخصيات أصلية: روبوت 🤖 وجرثومة 🦠 وحشرات فضائية). عمق بطبقات متوازية، واهتزاز الشاشة، وشرر وغبار،
   وتجمّد لحظي عند الإصابة، وأصوات ريترو مولَّدة (تحترم كتم الصوت)، وافتتاح «استعد… انطلق!».
   المنطق كما هو: الاختيار فعل مقصود، والقفل يمنعه، وonPick(رقم الخيار) مرة واحدة. */
const ARCADE_GAMES = {
  jumper:   { icon: '🍄', label: 'قفزة البطل',  act: 'قفز',   hint: 'اضغط قصيرًا للقفز فوق الجرثومة، وثبّت للقفزة الكبيرة' },
  invaders: { icon: '👾', label: 'غزاة الفضاء', act: 'إطلاق', hint: 'صوّب وأطلق على غازي إجابتك' },
  claw:     { icon: '🕹️', label: 'آلة المخلب',  act: 'إنزال', hint: 'حرّك المخلب وأنزله على كبسولة إجابتك' }
};
/* 🔊 أصوات ريترو مولَّدة (موجات مربعة وضجيج) */
const Chip = (() => {
  let c = null, nb = null;
  const ac = () => { if(!c){ try{ c = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ c = null; } } if(c && c.state === 'suspended') c.resume().catch(() => {}); return c; };
  const on = () => { try{ return typeof GameSound === 'undefined' || GameSound.on; }catch(e){ return true; } };
  function sq(f0, f1, dur, type, vol, at){ const a = ac(); if(!a) return; const t = a.currentTime + (at || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f0, t); if(f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02); }
  function noise(dur, vol, at){ const a = ac(); if(!a) return; if(!nb){ nb = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate); const d = nb.getChannelData(0); for(let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = a.currentTime + (at || 0), s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(200, t + dur);
    s.buffer = nb; g.gain.setValueAtTime(vol || 0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(a.destination); s.start(t); s.stop(t + dur); }
  const S = {
    jump: () => sq(260, 720, 0.16), coin: () => { sq(988, 0, 0.07); sq(1319, 0, 0.22, 'square', 0.05, 0.07); }, bump: () => sq(140, 90, 0.08, 'square', 0.07),
    laser: () => sq(1200, 180, 0.12, 'square', 0.04), boom: () => { noise(0.35, 0.14); sq(140, 40, 0.3, 'triangle', 0.08); }, hurt: () => sq(500, 90, 0.3, 'sawtooth', 0.05),
    drop: () => sq(700, 240, 0.35, 'triangle', 0.05), grab: () => { sq(523, 0, 0.08); sq(784, 0, 0.14, 'square', 0.05, 0.08); }, stomp: () => { sq(300, 120, 0.1); noise(0.08, 0.06); },
    ready: () => sq(440, 0, 0.12, 'square', 0.04), go: () => { [523, 659, 784, 1047].forEach((f, i) => sq(f, 0, 0.09, 'square', 0.045, i * 0.07)); },
    select: () => { [659, 880, 1175].forEach((f, i) => sq(f, 0, 0.1, 'square', 0.05, i * 0.06)); }, deny: () => sq(180, 150, 0.12, 'square', 0.05)
  };
  return { play(n){ if(!on()) return; try{ (S[n] || (() => {}))(); }catch(e){} }, unlock(){ ac(); } };
})();
/* خرائط البكسل: كل حرف لون من اللوحة، والنقطة شفافة */
const PAL = { K: '#1B1B2F', W: '#F4F4F8', G: '#9AA3B5', D: '#5B6378', C: '#38E8FF', c: '#0F8FB3', O: '#FF9F1C', B: '#3A6FF7', b: '#2446A8', R: '#FF4D6D', r: '#B3203D',
  Y: '#FFD23F', y: '#C98A00', N: '#8B4A1C', n: '#5C2E0E', L: '#7CE85A', l: '#2F9E3A', P: '#C77DFF', p: '#7B2CBF', M: '#FF7AC6', m: '#B8307A', H: '#FFFFFF' };
const SPR = {
  botStand: ['.......O........','.......K........','....KKKKKKK.....','...KWWWWWWWK....','...KWCCWCCWK....','...KWCcWCcWK....','...KWWWWWWWK....','....KKKKKKK.....',
             '...KBBBBBBBK....','..KBWBBBBBWBK...','..KBBBOOBBBBK...','...KBBBBBBBK....','....KKKKKKK.....','....KG...GK.....','....KG...GK.....','...KKK...KKK....'],
  botRun1:  ['.......O........','.......K........','....KKKKKKK.....','...KWWWWWWWK....','...KWWCCWCCK....','...KWWCcWCcK....','...KWWWWWWWK....','....KKKKKKK.....',
             '...KBBBBBBBK....','..KBBBBBBBWBK...','..KWBBOOBBBBK...','...KBBBBBBBK....','....KKKKKKK.....','...KG.....GK....','..KKG......GK...','..KK.......KK...'],
  botRun2:  ['.......O........','.......K........','....KKKKKKK.....','...KWWWWWWWK....','...KWWCCWCCK....','...KWWCcWCcK....','...KWWWWWWWK....','....KKKKKKK.....',
             '...KBBBBBBBK....','..KBWBBBBBBBK...','..KBBBOOBBBWK...','...KBBBBBBBK....','....KKKKKKK.....','.....KGGK.......','.....KGGK.......','....KKKKK.......'],
  botJump:  ['.......O........','..K....K....K...','..KKKKKKKKKKK...','...KWWWWWWWK....','...KWCCWCCWK....','...KWCHWCHWK....','...KWWWWWWWK....','....KKKKKKK.....',
             '...KBBBBBBBK....','...KBBBBBBBK....','...KBBBOOBBK....','...KBBBBBBBK....','....KKKKKKK.....','...KGK...KGK....','..KKK.....KKK...','................'],
  germ1:    ['................','.L....L....L....','..L..LLL..L.....','...LLLLLLLLL....','..LLHKLLLHKLL...','.LLLKKLLLKKLLL..','.LLLLLLLLLLLLL..','LLLLLKKKKLLLLLL.','.LLLLLKKLLLLLL..','..llLLLLLLLll...','...ll.ll.ll.....'],
  germ2:    ['................','................','..L...L...L.....','...LLLLLLLLL....','..LLHKLLLHKLL...','.LLLKKLLLKKLLL..','LLLLLLLLLLLLLLL.','LLLLLKKKKLLLLLL.','LLLLLLKKLLLLLLL.','.llLLLLLLLLLll..','..ll.ll.ll.ll...'],
  germFlat: ['................','................','................','................','................','................','................','.L.L.L.L.L.L.L..','LLLLLLLLLLLLLLL.','LKKLLLLLLLLKKLL.','.llllllllllll...'],
  coin1: ['..KKKK..','.KYYYYK.','KYYHYYyK','KYHYYYyK','KYHYYYyK','KYYYYYyK','.KyyyyK.','..KKKK..'],
  coin2: ['...KK...','..KYYK..','..KYHK..','..KYHK..','..KYHK..','..KYyK..','..KyyK..','...KK...'],
  bug1: ['...K......K.....','....K....K......','...KPPPPPPK.....','..KPPPPPPPPK....','.KPPHKPPHKPPK...','.KPPKKPPKKPPK...','KPPPPPPPPPPPPK..','KPpPPPPPPPPpPK..','KP.KpPPPPpK.PK..','...K.K..K.K.....','..K........K....','................'],
  bug2: ['...K......K.....','....K....K......','...KPPPPPPK.....','..KPPPPPPPPK....','.KPPHKPPHKPPK...','.KPPKKPPKKPPK...','KPPPPPPPPPPPPK..','KPpPPPPPPPPpPK..','.K.KpPPPPpK.K...','..K.K....K.K....','.K..........K...','................'],
  ship: ['.......KK.......','......KCCK......','......KWWK......','.....KWWWWK.....','....KWBWWBWK....','...KWWBBBBWWK...','..KRWWWWWWWWRK..','.KRRWKWWWWKWRRK.','.KRRK.KWWK.KRRK.','..KK...KK...KK..'],
  boss: ["......Y...Y...Y.......", "......YY.YYY.YY.......", "......YYYYYYYYY.......", "....KKKKKKKKKKKKK.....", "...KPPPPPPPPPPPPPK....", "..KPPPPPPPPPPPPPPPK...", ".KPPHHHPPPPPPPHHHPPK..", ".KPHHKRHPPPPPHKRHHPK..", ".KPHHKKHPPPPPHKKHHPK..", ".KPPHHHPPPPPPPHHHPPK..", "KPPPPPPPPPPPPPPPPPPPK.", "KPPPPKKKKKKKKKKKPPPPK.", "KPPPKWKWKWKWKWKWKPPPK.", "KPPPKKKKKKKKKKKKKPPPK.", ".KppPPPPPPPPPPPPPppK..", "..KppppPPPPPPPppppK...", "...KKppppppppppKK.....", ".....KKK.....KKK......"],
  capA: ['....KKKKKK....','..KKRRRRRRKK..','.KRRHHRRRRRRK.','.KRHRRRRRRRRK.','KRRRRRRRRRRRRK','KKKKKKKKKKKKKK','KWWWWWWWWWWWWK','KWWWWWWWWWWGWK','.KWWWWWWWWWGK.','.KWWWWWWWGGGK.','..KKWWWWWWKK..','....KKKKKK....']
};
const _sprCache = new Map();
function sprCanvas(name, tint){
  const key = name + '|' + (tint ? JSON.stringify(tint) : ''); if(_sprCache.has(key)) return _sprCache.get(key);   // لكل تلوين نسخته
  const rows = SPR[name], h = rows.length, w = rows[0].length, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  rows.forEach((row, yy) => [...row].forEach((ch, xx) => { if(ch === '.') return; let col = PAL[ch]; if(tint && tint[ch]) col = tint[ch]; x.fillStyle = col; x.fillRect(xx, yy, 1, 1); }));
  _sprCache.set(key, c); return c;
}
function arcadeMount(host, cfg){
  const G = cfg.game, n = cfg.options.length, now = cfg.now || (() => Date.now()), active = cfg.active || (() => true);
  host.innerHTML = `<div class="arc"><div class="arc-screen"><canvas class="arc-cv"></canvas></div>
    <div class="arc-pad"><button type="button" class="arc-b arc-dir" data-k="L" aria-label="يسار">◀</button><button type="button" class="arc-b arc-a" data-k="A">${ARCADE_GAMES[G].act}</button><button type="button" class="arc-b arc-dir" data-k="R" aria-label="يمين">▶</button></div>
    <div class="arc-hint">${ARCADE_GAMES[G].hint}</div></div>`;
  const cv = host.querySelector('canvas'), hintEl = host.querySelector('.arc-hint');
  const PW = Math.floor(Math.max(260, Math.min(460, host.clientWidth || 360)) / 2), PH = Math.round(Math.max(125, Math.min(180, PW * 0.74)));
  const W = PW * 2, H = PH * 2, dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pix = document.createElement('canvas'); pix.width = PW; pix.height = PH; const p = pix.getContext('2d'); p.imageSmoothingEnabled = false;
  const R = (c, X, Y, w, h) => { p.fillStyle = c; p.fillRect(Math.round(X), Math.round(Y), w, h); };
  const spr = (name, X, Y, flip, tint) => { const c = sprCanvas(name, tint); if(flip){ p.save(); p.translate(Math.round(X) + c.width, Math.round(Y)); p.scale(-1, 1); p.drawImage(c, 0, 0); p.restore(); } else p.drawImage(c, Math.round(X), Math.round(Y)); };
  const keys = { L: 0, R: 0, A: 0 }; let tapFull = false, actQ = 0, tx = null, stopped = false, picked = -1, stun = 0, last = 0, flash = 0, shakeT = 0, shakeM = 0, freeze = 0, t0 = now();
  const parts = [], floaters = [];
  const order = [...Array(n).keys()]; for(let i = n - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const slotX = i => PW * (i + 0.5) / n, locked = () => now() < (cfg.lockUntil || 0);
  const shake = (m, ms) => { shakeM = Math.max(shakeM, m); shakeT = Math.max(shakeT, ms); };
  const burst = (X, Y, cols, k, sp, life, grav) => { for(let i = 0; i < k && parts.length < 160; i++){ const a = Math.random() * Math.PI * 2, v = (0.4 + Math.random()) * (sp || 1);
    parts.push({ x: X, y: Y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (grav ? 0.8 : 0), t: life || 500, l: life || 500, c: cols[i % cols.length], g: grav || 0 }); } };
  const buzz = ms => { try{ navigator.vibrate && navigator.vibrate(ms); }catch(e){} };
  const pick = (opt, X, Y) => { if(picked >= 0 || !active()) return; picked = opt; flash = 380; freeze = 90; shake(3, 220); Chip.play('select'); buzz(30);
    floaters.push({ x: X, y: Y, t: 900, s: '✓' }); try{ cfg.onPick(opt); }catch(e){} };
  // ── التحكم
  host.querySelectorAll('.arc-b').forEach(b => { const k = b.dataset.k;
    const on = e => { e.preventDefault(); Chip.unlock(); if(k === 'A'){ actQ++; keys.A = 1; tapFull = false; } else keys[k] = 1; b.classList.add('on'); };
    const off = () => { keys[k] = 0; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, off)); });
  const kd = e => { if(e.key === 'ArrowLeft'){ keys.L = 1; e.preventDefault(); } else if(e.key === 'ArrowRight'){ keys.R = 1; e.preventDefault(); } else if(e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter'){ if(!e.repeat){ actQ++; keys.A = 1; tapFull = false; } e.preventDefault(); } };
  const ku = e => { if(e.key === 'ArrowLeft') keys.L = 0; if(e.key === 'ArrowRight') keys.R = 0; if(e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') keys.A = 0; };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  let down = null;
  const px = e => { const b = cv.getBoundingClientRect(); return (e.clientX - b.left) / b.width * PW; };
  cv.addEventListener('pointerdown', e => { Chip.unlock(); try{ cv.setPointerCapture(e.pointerId); }catch(_){} down = { t: performance.now(), x: e.clientX }; tx = px(e); });
  cv.addEventListener('pointermove', e => { if(down) tx = px(e); });
  cv.addEventListener('pointerup', e => { if(down && performance.now() - down.t < 220 && Math.abs(e.clientX - down.x) < 10){ actQ++; tapFull = true; } down = null; tx = null; });   // نقرة الشاشة = قفزة كاملة
  const move = (cur, spd, lo, hi) => { let v = cur; if(tx !== null) v += Math.max(-spd, Math.min(spd, tx - cur)); if(keys.L) v -= spd; if(keys.R) v += spd; return Math.max(lo, Math.min(hi, v)); };
  // ── حالة كل لعبة
  const S = {}, labels = [];
  const ground = PH - 22;
  const panelW = Math.min(64, PW / n - 8), panelY = Math.max(24, ground - 64);   // بعد ثابت عن الأرض — لا نسبة من ارتفاع الشاشة
  const JUMPV = Math.sqrt(2 * 0.32 * ((ground - 16) - (panelY + 14) + 14));      // القفزة تتجاوز أسفل اللوحة بـ14 بكسل على أي شاشة
  const HOP = 22;                                                                    // القفزة القصيرة: ارتفاعها الكلي ≈22 بكسل — تعبر الجرثومة ولا تبلغ اللوحات
  const capX = i => { const span = PW - 62; return ((i * span / n + span / (2 * n) + S.belt) % span) + 18; };   // تباعد متساوٍ على طول السير: لا تتراكب كبسولتان
  if(G === 'jumper') Object.assign(S, { hx: PW / 2 - 8, hy: ground - 16, vy: 0, face: 1, bump: {}, coins: [], mob: { x: 12, d: 1, dead: 0 }, run: 0, air: false, sq: 0 });
  if(G === 'invaders') Object.assign(S, { sx: PW / 2, shots: [], bombs: [], march: 0, ay: 18, cd: 0, alive: order.map(() => 1), hitT: {}, rings: [] });
  if(G === 'claw') Object.assign(S, { cx: PW / 2, cy: 20, st: 'idle', hold: -1, belt: 0, open: 1, chute: null });
  const stars = [...Array(60)].map((_, i) => ({ x: (i * 37.7) % PW, y: (i * 53.3) % PH, z: 1 + i % 3 }));
  const clouds = [...Array(4)].map((_, i) => ({ x: i * PW / 3.2, y: 8 + (i % 2) * 12, w: 22 + (i % 3) * 6 }));
  function drawJumperBg(t){
    const bands = ['#6FB7FF', '#7FC1FF', '#90CBFF', '#A3D5FF', '#B8DFFF']; bands.forEach((c, i) => R(c, 0, i * (PH / 5), PW, PH / 5 + 1));
    R('#FFF6C9', PW - 34, 10, 12, 12); R('#FFE58A', PW - 32, 12, 8, 8);
    clouds.forEach(c => { c.x = (c.x + 0.05) % (PW + 40); const cx = c.x - 30; R('#FFFFFF', cx, c.y + 4, c.w, 6); R('#FFFFFF', cx + 4, c.y, c.w - 10, 5); R('#DDEFFF', cx, c.y + 9, c.w, 1); });
    for(let i = 0; i < PW; i += 1){ const h1 = 14 + Math.sin(i * 0.045) * 6 + Math.sin(i * 0.11) * 3; R('#7FB58A', i, ground - 10 - h1, 1, h1 + 10); }
    for(let i = 0; i < PW; i += 1){ const h2 = 6 + Math.sin(i * 0.08 + 2) * 4; R('#4E9A5B', i, ground - h2, 1, h2); }
    for(let gx = 0; gx < PW; gx += 8){ R('#C8742F', gx, ground, 8, PH - ground); R('#F0A55A', gx, ground, 8, 2); R('#8E4A17', gx + 7, ground + 2, 1, PH - ground); R('#8E4A17', gx, ground + 9, 8, 1);
      R('#6FD04F', gx, ground - 1, 8, 2); if(gx % 16 === 0) R('#9BEA6C', gx + 2, ground - 2, 2, 1); }
  }
  function step(dt){
    const t = now(), lk = locked(), sl = stun > 0 ? 0.35 : 1; if(stun > 0) stun -= dt; if(flash > 0) flash -= dt; if(shakeT > 0){ shakeT -= dt; if(shakeT <= 0) shakeM = 0; }
    let act = actQ > 0; actQ = 0; labels.length = 0;
    if(G === 'jumper'){
      drawJumperBg(t);
      const onG = S.hy >= ground - 16 - 0.1;
      const oldX = S.hx; S.hx = move(S.hx, 1.7 * sl * dt / 16, 2, PW - 18); const mv = S.hx - oldX; if(mv < -0.05) S.face = -1; if(mv > 0.05) S.face = 1; if(Math.abs(mv) > 0.05) S.run += dt;
      if(act && onG && stun <= 0){ S.vy = -JUMPV; S.air = true; S.cut = !tapFull; S.jy0 = S.hy; Chip.play('jump'); burst(S.hx + 8, ground, ['#E7C79A', '#FFFFFF'], 6, 0.6, 300); }
      if(S.air && S.cut && !keys.A && S.vy < 0){                                     // أُفلت الزر مبكرًا: قفزة قصيرة بارتفاع كلي ثابت
        const rem = Math.max(1, HOP - (S.jy0 - S.hy)), vmax = Math.sqrt(2 * 0.32 * rem); if(S.vy < -vmax) S.vy = -vmax; S.cut = false; }
      const prevHy = S.hy; S.vy += 0.32 * dt / 16; S.hy += S.vy * dt / 16;
      if(S.hy >= ground - 16){ if(S.air){ S.sq = 120; burst(S.hx + 8, ground, ['#E7C79A', '#FFFFFF'], 5, 0.5, 260); } S.hy = ground - 16; S.vy = 0; S.air = false; }
      if(S.sq > 0) S.sq -= dt;
      order.forEach((opt, i) => { const bx = slotX(i) - panelW / 2, bumpN = S.bump[i] > 0 ? Math.sin((S.bump[i] / 160) * Math.PI) * 4 : 0, by = panelY - bumpN; if(S.bump[i] > 0) S.bump[i] -= dt;
        const used = picked === opt, base = used ? '#8C6A43' : lk ? '#A08C5A' : '#FFC83D', hi = used ? '#B08D63' : lk ? '#C4B27E' : '#FFE9A0', lo = used ? '#5C4128' : '#B97A00';
        R('#1B1B2F', bx - 1, by - 1, panelW + 2, 16); R(base, bx, by, panelW, 14); R(hi, bx, by, panelW, 2); R(lo, bx, by + 12, panelW, 2);
        for(const rx of [bx + 2, bx + panelW - 4]) for(const ry of [by + 3, by + 9]) R(lo, rx, ry, 2, 2);
        if(!used && !lk){ const tw = (Math.floor(t / 90) + i * 7) % 40; if(tw < panelW) R('#FFFFFF', bx + tw, by + 2, 2, 1); }
        if(S.vy < 0 && prevHy > by + 13.5 && S.hy <= by + 14 && S.hx + 13 > bx && S.hx + 3 < bx + panelW){   // لحظة عبور الرأس لأسفل اللوحة
          S.vy = 1.2; S.hy = by + 15; S.bump[i] = 160; burst(slotX(i), by + 14, ['#FFE9A0', '#B97A00'], 6, 0.9, 380, 0.05);
          if(!lk && picked < 0){ S.coins.push({ x: slotX(i) - 4, y: by - 8, vy: -2.6, t: 700 }); Chip.play('coin'); pick(opt, slotX(i), by - 6); } else Chip.play(lk ? 'deny' : 'bump'); }
        labels.push({ t: cfg.options[opt], x: slotX(i), y: by + 7, w: panelW, c: '#3A2400', on: used }); });
      S.coins.forEach(c => { c.vy += 0.12 * dt / 16; c.y += c.vy * dt / 16; c.t -= dt; spr(Math.floor(t / 80) % 2 ? 'coin1' : 'coin2', c.x, c.y); }); S.coins = S.coins.filter(c => c.t > 0);
      const m = S.mob;
      if(!lk){ if(m.dead > 0){ m.dead -= dt; spr('germFlat', m.x, ground - 11); if(m.dead <= 0){ m.x = S.hx > PW / 2 ? 6 : PW - 22; m.d = S.hx > PW / 2 ? 1 : -1; } }
        else { m.x += m.d * 0.55 * dt / 16; if(m.x < 2 || m.x > PW - 18) m.d *= -1; spr(Math.floor(t / 180) % 2 ? 'germ1' : 'germ2', m.x, ground - 11, m.d < 0);
          const hit = S.hx + 13 > m.x + 2 && S.hx + 3 < m.x + 14 && S.hy + 16 > ground - 9;
          if(hit){ if(S.vy > 0.6 && S.hy + 16 < ground - 3){ m.dead = 2200; S.vy = -3.6; Chip.play('stomp'); shake(2, 120); burst(m.x + 8, ground - 6, ['#7CE85A', '#2F9E3A', '#FFFFFF'], 12, 1.2, 420, 0.06); floaters.push({ x: m.x + 8, y: ground - 20, t: 700, s: '💥' }); }
            else if(stun <= 0){ stun = 900; S.vy = -2.4; S.hx += S.hx < m.x ? -14 : 14; Chip.play('hurt'); shake(4, 260); buzz(60); burst(S.hx + 8, S.hy + 8, ['#FF4D6D', '#FFFFFF'], 10, 1.1, 350); } } } }
      const blink = stun > 0 && Math.floor(stun / 80) % 2;
      if(!blink){ const f = S.air ? 'botJump' : Math.abs(keys.L - keys.R) || (tx !== null && Math.abs(tx - S.hx - 8) > 2) ? (Math.floor(S.run / 110) % 2 ? 'botRun1' : 'botRun2') : 'botStand';
        if(S.sq > 0){ p.save(); p.translate(Math.round(S.hx) + 8, Math.round(S.hy) + 16); p.scale(1.15, 0.85); p.translate(-8, -16); spr(f, 0, 0, S.face < 0); p.restore(); } else spr(f, S.hx, S.hy, S.face < 0); }
    }
    if(G === 'invaders'){
      R('#070B1E', 0, 0, PW, PH); R('#0D1433', 0, PH * 0.55, PW, PH * 0.45);
      stars.forEach(st => { st.y = (st.y + dt * 0.012 * st.z) % PH; R(st.z === 3 ? '#FFFFFF' : st.z === 2 ? '#9FB3FF' : '#4B5A8C', st.x, st.y, st.z === 3 ? 2 : 1, 1); });
      R('#1E2A5A', PW * 0.72, 16, 22, 22); R('#2B3A78', PW * 0.72 + 3, 19, 8, 6); R('#16204A', PW * 0.72 + 12, 28, 6, 5);
      S.march += dt * 0.002; if(!lk) S.ay = Math.min(PH * 0.42, S.ay + dt * 0.0011);
      const off = Math.sin(S.march) * 14, fr = Math.floor(t / 380) % 2, ax = i => slotX(i) + off - 8;
      order.forEach((opt, i) => { if(!S.alive[i]) return; const X = ax(i), Y = S.ay + Math.sin(t / 300 + i) * 1.5;
        const tint = picked === opt ? { P: '#38E8FF', p: '#0F8FB3' } : [{}, { P: '#FF7AC6', p: '#B8307A' }, { P: '#7CE85A', p: '#2F9E3A' }, { P: '#FFB23F', p: '#C97000' }][i % 4];
        if(S.hitT[i] > 0){ S.hitT[i] -= dt; spr(fr ? 'bug1' : 'bug2', X, Y, false, { P: '#FFFFFF', p: '#FFFFFF', K: '#FFFFFF' }); } else spr(fr ? 'bug1' : 'bug2', X, Y, false, tint);
        if(lk){ p.globalAlpha = 0.35 + 0.2 * Math.sin(t / 120); p.strokeStyle = '#38E8FF'; p.beginPath(); p.arc(X + 7, Y + 6, 11, 0, 7); p.stroke(); p.globalAlpha = 1; }
        labels.push({ t: cfg.options[opt], x: X + 7, y: Y + 19, w: PW / n - 4, c: '#FFFFFF', on: picked === opt, dark: 1 }); });
      S.sx = move(S.sx, 2 * sl * dt / 16, 9, PW - 9); S.cd -= dt;
      if(act){ if(S.cd <= 0 && stun <= 0 && picked < 0){ S.shots.push({ x: S.sx, y: PH - 18 }); S.cd = 300; Chip.play('laser'); S.muzzle = 70; } }
      S.shots.forEach(sh => { sh.y -= dt * 0.2; R('#FFFFFF', sh.x, sh.y, 1, 5); R('#38E8FF', sh.x - 1, sh.y + 1, 3, 3);
        order.forEach((opt, i) => { const X = ax(i); if(S.alive[i] && sh.y <= S.ay + 12 && sh.y >= S.ay - 2 && sh.x >= X && sh.x <= X + 15){ sh.y = -99;
          if(lk){ burst(sh.x, S.ay + 14, ['#38E8FF', '#FFFFFF'], 6, 0.8, 220); Chip.play('deny'); S.hitT[i] = 60; }
          else { S.alive[i] = 0; S.rings.push({ x: X + 7, y: S.ay + 6, t: 450 }); burst(X + 7, S.ay + 6, ['#FFD23F', '#FF9F1C', '#FFFFFF', '#FF4D6D'], 26, 1.6, 600); Chip.play('boom'); pick(opt, X + 7, S.ay - 4); } } }); });
      S.shots = S.shots.filter(sh => sh.y > -6);
      if(!lk && picked < 0 && Math.random() < dt * 0.001){ const i = Math.floor(Math.random() * n); if(S.alive[i]) S.bombs.push({ x: ax(i) + 7, y: S.ay + 12 }); }
      S.bombs.forEach(b => { b.y += dt * 0.055; const on_ = Math.floor(t / 90) % 2; R(on_ ? '#FF4D6D' : '#FFD23F', b.x - 1, b.y, 3, 3); R('#FFFFFF', b.x, b.y + 1, 1, 1);
        if(b.y > PH - 20 && b.y < PH - 8 && Math.abs(b.x - S.sx) < 7 && stun <= 0){ stun = 900; b.y = PH + 9; Chip.play('hurt'); shake(4, 260); buzz(60); burst(S.sx, PH - 12, ['#FF4D6D', '#FFD23F', '#FFFFFF'], 14, 1.2, 380); } });
      S.bombs = S.bombs.filter(b => b.y < PH);
      S.rings.forEach(r => { r.t -= dt; const rad = (450 - r.t) / 18; p.strokeStyle = `rgba(255,210,63,${r.t / 450})`; p.beginPath(); p.arc(r.x, r.y, rad, 0, 7); p.stroke(); }); S.rings = S.rings.filter(r => r.t > 0);
      if(!(stun > 0 && Math.floor(stun / 80) % 2)){ spr('ship', S.sx - 8, PH - 20); const fl = Math.floor(t / 60) % 3; R(fl ? '#FF9F1C' : '#FFD23F', S.sx - 1, PH - 10, 2, 2 + fl); if(S.muzzle > 0){ S.muzzle -= dt; R('#FFFFFF', S.sx - 2, PH - 23, 4, 3); } }
      R('#2F9E3A', 0, PH - 3, PW, 1);
    }
    if(G === 'claw'){
      R('#2A0F3D', 0, 0, PW, PH); R('#FF7AC6', 2, 2, PW - 4, PH - 4); R('#3B1457', 5, 12, PW - 10, PH - 16);
      for(let i = 0; i < 16; i++){ const lit = (Math.floor(t / 120) + i) % 4 === 0; R(lit ? '#FFF6C9' : '#B8307A', 6 + i * ((PW - 12) / 16), 5, 3, 3); }
      R('#4B1D6B', 5, 12, PW - 10, 2);
      const floor = PH - 20; R('#1E0A2C', 5, floor + 8, PW - 10, 8);
      if(S.st === 'idle' && !lk) S.belt = (S.belt + dt * 0.012) % (PW - 62);   // السير بعيد عن فتحة الجوائز
      for(let bx = 0; bx < PW - 10; bx += 6) R('#5B2A7A', 5 + ((bx + S.belt * 2) % (PW - 10)), floor + 10, 3, 2);
      R('#C4C4D6', 5, 16, PW - 10, 2); R('#8A8AA0', 5, 18, PW - 10, 1);
      R('#6B2F8F', PW - 26, floor - 6, 20, 14); R('#1E0A2C', PW - 24, floor - 4, 16, 10);
      if(S.st === 'idle'){ S.cx = move(S.cx, 1.6 * dt / 16, 14, PW - 14); if(act){ if(lk){ Chip.play('deny'); S.denyT = 400; } else if(picked < 0){ S.st = 'down'; S.open = 1; Chip.play('drop'); } } }
      if(S.st === 'down'){ S.cy += dt * 0.075; if(S.cy >= floor - 14){ S.cy = floor - 14; S.st = 'grab'; S.gt = 220;
        order.forEach((opt, i) => { if(S.hold < 0 && Math.abs(capX(i) - S.cx) < 8) S.hold = i; }); } }
      if(S.st === 'grab'){ S.gt -= dt; S.open = Math.max(0, S.gt / 220); if(S.gt <= 0){ S.st = 'up'; Chip.play(S.hold >= 0 ? 'grab' : 'deny'); if(S.hold >= 0) shake(1, 100); } }
      if(S.st === 'up'){ S.cy -= dt * 0.065; if(S.cy <= 20){ S.cy = 20; S.st = 'idle'; S.open = 1; if(S.hold >= 0){ const opt = order[S.hold]; S.chute = { i: S.hold, x: S.cx - 7, y: 26, vx: (PW - 17 - S.cx) / 25, t: 600 }; pick(opt, S.cx, 30); S.hold = -2; } } }
      order.forEach((opt, i) => { let X = capX(i) - 7, Y = floor - 10;
        if(S.hold === i){ X = S.cx - 7; Y = S.cy + 9; } else if(S.hold === -2 && S.chute && S.chute.i === i){ const c = S.chute; c.t -= dt; c.x += c.vx * dt / 16; c.y = Math.min(floor - 4, c.y + dt * 0.08); X = c.x; Y = c.y; }
        const tint = picked === opt ? { R: '#38E8FF', r: '#0F8FB3' } : [{}, { R: '#7CE85A' }, { R: '#FFD23F' }, { R: '#C77DFF' }][i % 4];
        spr('capA', X, Y, false, tint);
        labels.push({ t: cfg.options[opt], x: X + 7, y: Y - 7, w: Math.min(56, PW / n + 4), c: '#FFFFFF', on: picked === opt, dark: 1 }); });
      const cx = Math.round(S.cx), cy = Math.round(S.cy);
      R('#E6E6F0', cx - 6, 14, 12, 5); R('#8A8AA0', cx - 6, 18, 12, 1); R('#C4C4D6', cx, 19, 1, cy - 19);
      R('#E6E6F0', cx - 4, cy, 9, 3); const o = Math.round(S.open * 3);
      R('#E6E6F0', cx - 5 - o, cy + 3, 2, 6); R('#E6E6F0', cx + 4 + o, cy + 3, 2, 6); R('#E6E6F0', cx - 4 - o, cy + 9, 2, 1); R('#E6E6F0', cx + 3 + o, cy + 9, 2, 1); R('#FF4D6D', cx - 1, cy + 1, 3, 1);
      p.globalAlpha = 0.12; R('#FFFFFF', 10, 20, 3, PH - 44); R('#FFFFFF', 15, 20, 1, PH - 44); p.globalAlpha = 1;
    }
    // الجسيمات والنصوص الطائرة
    parts.forEach(q => { q.t -= dt; q.vy += (q.g || 0) * dt / 16; q.x += q.vx * dt / 16; q.y += q.vy * dt / 16; p.globalAlpha = Math.max(0, q.t / q.l); R(q.c, q.x, q.y, q.l > 450 ? 2 : 1, q.l > 450 ? 2 : 1); p.globalAlpha = 1; });
    for(let i = parts.length - 1; i >= 0; i--) if(parts[i].t <= 0) parts.splice(i, 1);
    // التكبير ×2 مع الاهتزاز
    const sx = shakeM ? (Math.random() * 2 - 1) * shakeM : 0, sy = shakeM ? (Math.random() * 2 - 1) * shakeM : 0;
    x.imageSmoothingEnabled = false; x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.drawImage(pix, sx * 2, sy * 2, W, H);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    labels.forEach(l => { const maxW = l.w * 2 - 8; let f = 14; x.font = `900 ${f}px system-ui,sans-serif`;
      while(x.measureText(l.t).width > maxW && f > 10){ f--; x.font = `900 ${f}px system-ui,sans-serif`; }
      let tt = l.t; if(x.measureText(tt).width > maxW){ while(tt.length > 1 && x.measureText(tt + '…').width > maxW) tt = tt.slice(0, -1); tt += '…'; }
      const X = l.x * 2 + sx * 2, Y = l.y * 2 + sy * 2;
      if(l.dark || l.on){ const w = x.measureText(tt).width + 10; x.fillStyle = l.on ? 'rgba(15,143,179,.95)' : 'rgba(10,8,30,.72)'; x.beginPath(); x.roundRect ? x.roundRect(X - w / 2, Y - 10, w, 20, 6) : x.rect(X - w / 2, Y - 10, w, 20); x.fill(); }
      x.lineWidth = 3; x.strokeStyle = l.dark || l.on ? 'rgba(0,0,0,.65)' : 'rgba(255,255,255,.7)'; x.strokeText(tt, X, Y + 1); x.fillStyle = l.on ? '#FFFFFF' : l.c; x.fillText(tt, X, Y + 1); });
    floaters.forEach(f => { f.t -= dt; x.globalAlpha = Math.max(0, Math.min(1, f.t / 400)); x.font = '900 22px system-ui,sans-serif'; x.lineWidth = 4; x.strokeStyle = '#1B1B2F';
      const Y = f.y * 2 - (900 - f.t) * 0.05; x.strokeText(f.s, f.x * 2, Y); x.fillStyle = '#FFD23F'; x.fillText(f.s, f.x * 2, Y); x.globalAlpha = 1; });
    for(let i = floaters.length - 1; i >= 0; i--) if(floaters[i].t <= 0) floaters.splice(i, 1);
    // خطوط شاشة CRT خفيفة
    x.fillStyle = 'rgba(0,0,0,.07)'; for(let yy = 0; yy < H; yy += 4) x.fillRect(0, yy, W, 2);
    // الافتتاح: «استعد… انطلق!» (أثناء القفل في المسابقة، أو أول لحظة في الفردي)
    const lockLeft = (cfg.lockUntil || 0) - t, intro = 900 - (t - t0);
    if(lk || intro > 0){ const txt = lk ? (lockLeft > 1000 ? 'استعد!' : 'انطلق!') : (intro > 400 ? 'استعد!' : 'انطلق!'); x.fillStyle = 'rgba(10,8,30,.45)'; x.fillRect(0, H / 2 - 30, W, 60);
      const pulse = 1 + 0.06 * Math.sin(t / 90); x.save(); x.translate(W / 2, H / 2); x.scale(pulse, pulse); x.font = '900 30px system-ui,sans-serif'; x.lineWidth = 6; x.strokeStyle = '#1B1B2F'; x.strokeText(txt, 0, 1); x.fillStyle = txt === 'انطلق!' ? '#7CE85A' : '#FFD23F'; x.fillText(txt, 0, 1); x.restore();
      if(lk){ x.font = '800 13px system-ui,sans-serif'; x.fillStyle = '#FFFFFF'; x.fillText(`اقرأ السؤال… ${Math.ceil(lockLeft / 1000)}`, W / 2, H / 2 + 22); }
      if(!S._rd){ S._rd = 1; Chip.play('ready'); } } else if(S._rd === 1){ S._rd = 2; Chip.play('go'); }
    if(flash > 0){ x.fillStyle = `rgba(255,255,255,${(flash / 380) * 0.4})`; x.fillRect(0, 0, W, H); }
    const h = picked >= 0 ? '✓ تم اختيار إجابتك' : stun > 0 ? '💥 أُصبت! انتظر لحظة' : S.denyT > 0 && lk ? '🔒 انتظر حتى تُفتح' : ARCADE_GAMES[G].hint; if(S.denyT > 0) S.denyT -= dt;
    if(hintEl.textContent !== h) hintEl.textContent = h;
  }
  const loop = ts => { if(stopped || !document.body.contains(cv) || !active()){ removeEventListener('keydown', kd); removeEventListener('keyup', ku); return; }
    let dt = Math.min(40, ts - (last || ts)); last = ts; if(freeze > 0){ freeze -= dt; dt = 0.001; } step(dt); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  return { stop(){ stopped = true; }, get picked(){ return picked; },
    dbg: () => ({ order, S, PW, PH, stun,
      ctrlX: G === 'jumper' ? S.hx + 8 : G === 'invaders' ? S.sx : S.cx,
      targetX: opt => { const i = order.indexOf(opt); return G === 'jumper' ? slotX(i) : G === 'invaders' ? slotX(i) + Math.sin(S.march) * 14 - 1 : capX(i); } }) };   // dbg للاختبار فقط (قراءة)
}

/* 📵 داخل مساحات اللعب: لا تحديد نص ولا قائمة (احتياط إن تجاهل المتصفح التنسيق) */
const PLAY_ZONES = '.arc, #mq-scene, .lvr, .lvs, .lvb-sky, #live-room .live-wrap';
['selectstart', 'contextmenu'].forEach(ev => document.addEventListener(ev, e => { if(e.target && e.target.closest && e.target.closest(PLAY_ZONES)) e.preventDefault(); }, { capture: true }));
document.addEventListener('pointerdown', e => { if(e.target && e.target.closest && e.target.closest(PLAY_ZONES)){ try{ const s = window.getSelection(); if(s && !s.isCollapsed) s.removeAllRanges(); }catch(_){} } }, { capture: true, passive: true });

/* 🕹️ مشهد أركيد في اللعب الفردي: المحرك نفسه، والإجابة تمر بـ mqAnswer (السجل والتصحيح كالبقية) */
function mqSceneArcade(scene, q, st){
  const life = Math.max(9000, 14000 - st.i * 300), qi = st.i;
  scene.innerHTML = `${mqAsk(q, st)}<div class="mq-fuse" style="margin-top:.5rem"><i id="mq-fuse" style="width:100%"></i></div><div id="mq-arc" style="margin-top:.5rem"></div>`;
  st.arc = arcadeMount($('mq-arc'), { game: st.type, options: q.options, onPick: i => setTimeout(() => mqAnswer(i, null), 450),
    active: () => mqState === st && !st.over && st.i === qi && !st.locked });
  mqFuse(st, life, () => mqAnswer(-1, null));
}

/* ══ فتيل الوقت: مشترك بين كل المشاهد ══ */
function mqFuse(st,life,onEnd){
  const started=Date.now(), fuse=$('mq-fuse');
  st.tick=setInterval(()=>{
    const left=Math.max(0,1-(Date.now()-started)/life);
    if(fuse){ fuse.style.width=(left*100)+'%'; fuse.classList.toggle('hot',left<.3); }
  },120);
  st.qTimer=setTimeout(onEnd,life);
}

/* ══ 🎈 صيد البالونات: الخيارات تصعد وتهرب ══ */
function mqSceneBalloons(scene,q,st){
  const COLORS=['#F6A6B2','#9FD3F0','#F7D08A','#A9E0BC'];
  const order=shuffle(q.options.map((o,i)=>({o,i})));
  const life=Math.max(5200, 8200-st.i*180);
  const H=mqStageHeight();
  scene.innerHTML=`
    ${mqAsk(q,st)}
    <div class="mq-fuse" style="margin-top:.5rem"><i id="mq-fuse" style="width:100%"></i></div>
    <div class="mq-sky" id="mq-sky" style="margin-top:.5rem;height:${H}px;--rise:-${H+120}px">
      <span class="mq-cloud" style="top:14%;animation-duration:17s">☁️</span>
      <span class="mq-cloud" style="top:52%;animation-duration:23s;animation-delay:-6s">☁️</span>
      ${order.map((x,n)=>`
        <button type="button" class="mq-balloon" data-mq="${x.i}"
          style="left:${4+n*24}%;animation-duration:${(life+n*420)/1000}s;animation-delay:${n*.18}s">
          <span class="bd" style="background:${COLORS[n%4]}">${esc(x.o)}</span><i></i>
        </button>`).join('')}
    </div>`;
  scene.querySelectorAll('[data-mq]').forEach(b=>b.onclick=()=>mqAnswer(Number(b.getAttribute('data-mq')),b));
  mqFuse(st,life,()=>mqAnswer(-1,null));
}

/* ══ 🧗 قفزة الصخور: الخيارات صخور عائمة فوق الهاوية، والقافز ينتقل إليها ══ */
const MQ_SLOTS=[{l:4,r:.30},{l:54,r:.47},{l:6,r:.64},{l:52,r:.82}];
function mqSceneClimb(scene,q,st){
  const H=mqStageHeight();
  const spots=shuffle(MQ_SLOTS.map((p,n)=>({l:p.l,b:Math.round(H*p.r),n})));
  const opts=q.options.map((o,i)=>({o,i}));
  scene.innerHTML=`
    <div class="mq-cliff" id="mq-cliff" style="height:${H}px">
      <span class="mq-peak">🏁 الدرجة ${st.correct+1}</span>
      <div class="mq-abyss"></div>
      ${opts.map((x,i)=>{
        const p=spots[i];
        return `<button type="button" class="mq-plat" data-mq="${x.i}"
          style="left:${p.l}%;bottom:${p.b}px;animation-duration:${(2.4+i*.5).toFixed(1)}s;animation-delay:-${(i*.6).toFixed(1)}s">
          ${esc(x.o)}</button>`;
      }).join('')}
      <div class="mq-ledge"></div>
      <div class="mq-jumper" id="mq-jumper" style="left:38%;bottom:16px">🧗</div>
    </div>
    <div class="mq-helps" style="margin-top:.45rem">
      <button type="button" class="mq-help" ${st.helps.fifty?'':'disabled'} onclick="mqUseFifty()">✂️ فتّت صخرتين</button>
      <button type="button" class="mq-help" ${st.helps.skip?'':'disabled'} onclick="mqUseSkip()">🪢 حبل النجاة</button>
    </div>
    ${mqAsk(q,st)}
    <div class="mq-fuse" style="margin-top:.45rem"><i id="mq-fuse" style="width:100%"></i></div>`;

  scene.querySelectorAll('[data-mq]').forEach(b=>b.onclick=()=>{
    if(!mqState || mqState.locked) return;
    const j=$('mq-jumper');
    if(j){                       // القفزة نفسها: ينتقل إلى الصخرة التي لمسها
      j.classList.add('jump');
      j.style.left=b.style.left;
      j.style.bottom=(parseInt(b.style.bottom,10)+24)+'px';
      setTimeout(()=>j.classList.remove('jump'),420);
    }
    b.classList.add('landed');
    setTimeout(()=>mqAnswer(Number(b.getAttribute('data-mq')),b),330);
  });
  mqFuse(st,Math.max(6000,9500-st.i*250),()=>mqAnswer(-1,null));
}

/* ══ 🧺 سلة المحصول: الخيارات تتساقط وتحرّك السلة لالتقاط الصحيح ══ */
const MQ_CATCH_W=17;
function mqSceneCatch(scene,q,st){
  const fruits=['🍎','🍋','🍇','🍑'];
  const order=shuffle(q.options.map((o,i)=>({o,i})));
  const speed=1.85+st.i*0.16;
  const FH=mqStageHeight();
  st.fieldH=FH; st.catchY=FH-54;
  scene.innerHTML=`
    ${mqAsk(q,st)}
    <div class="mq-catch" id="mq-catch" style="margin-top:.5rem;height:${FH}px">
      ${order.map((x,n)=>`
        <div class="mq-falling" data-mq="${x.i}" style="left:${6+n*23}%;transform:translateY(-60px)">
          <span class="fr">${fruits[n%4]}</span><span class="tx">${esc(x.o)}</span>
        </div>`).join('')}
      <div class="mq-basket" id="mq-basket" style="left:42%">🧺</div>
    </div>
    <p class="muted" style="font-size:.74rem;text-align:center;margin:.35rem 0 0">حرّك إصبعك داخل الملعب لتحريك السلة</p>`;

  const field=$('mq-catch'), basket=$('mq-basket');
  st.basketX=42;
  const moveTo=pct=>{ st.basketX=Math.max(2,Math.min(84,pct)); if(basket) basket.style.left=st.basketX+'%'; };
  const fromEvent=e=>{
    const r=field.getBoundingClientRect();
    if(!r.width) return;
    moveTo(((e.clientX-r.left)/r.width)*100-8);
  };
  field.addEventListener('pointerdown',e=>{ field.setPointerCapture?.(e.pointerId); fromEvent(e); });
  field.addEventListener('pointermove',e=>{ if(e.buttons||e.pointerType==='touch') fromEvent(e); });

  st.fall=[...field.querySelectorAll('[data-mq]')].map((el,n)=>({
    el, i:Number(el.getAttribute('data-mq')),
    x:6+n*23, y:(-50-n*62)*(FH/255), v:(speed+Math.random()*0.45)*(FH/255), done:false
  }));

  st.loop=setInterval(()=>{
    const cur=mqState;
    if(!cur || cur.locked || cur.over) return;
    let alive=0;
    cur.fall.forEach(f=>{
      if(f.done) return;
      f.y+=f.v*2.2;
      f.el.style.transform='translateY('+f.y+'px)';
      if(f.y>=cur.catchY && f.y<=cur.catchY+30 && Math.abs(f.x-cur.basketX)<=MQ_CATCH_W){
        f.done=true;
        f.el.classList.add('caught');
        mqAnswer(f.i,f.el);
        return;
      }
      if(f.y>cur.fieldH-6){ f.done=true; f.el.classList.add('missed'); }
      else alive++;
    });
    if(!alive && !cur.locked) mqAnswer(-1,null);   // سقط كل شيء ولم تلتقط
  },40);
}

/* ══ 💰 من سيربح المليون: سلّم جوائز · نقاط أمان · ثلاث وسائل مساعدة ══ */
const MS_LETTERS=['أ','ب','ج','د'];
const MS_TIME=30;

/* نقاط الأمان: ثلث السلّم وثلثاه — عندها لا يخسر الطالب ما بلغه */
function msMilestones(total){
  return [Math.max(1,Math.round(total/3)), Math.max(2,Math.round(total*2/3))];
}
function msLevels(st){ return st.levels || st.qs.length; }
function msValue(st,level){
  return Math.round(50*level/Math.max(1,msLevels(st)));
}
function msSecured(st){
  const ms=msMilestones(msLevels(st));
  let secured=0;
  ms.forEach(m=>{ if(st.correct>=m) secured=m; });
  return st.correct>=msLevels(st) ? msLevels(st) : secured;
}

function mqSceneMillion(scene,q,st){
  if(!st.levels) st.levels=st.qs.length;      // عدد المستويات يُثبَّت من البداية
  const total=st.levels, ms=msMilestones(total);
  st.sel=null;
  if(st.timeExtended!==st.i) st.timeLeft=MS_TIME;

  const ladder=Array.from({length:total},(_,n)=>total-1-n).map(n=>{
    const state=n<st.correct?'done':(n===st.i?'now':'');
    const safe=ms.includes(n+1)?' safe':'';
    return `<div class="ms-rung ${state}${safe}"><b>${n+1}</b><span>${Math.round(50*(n+1)/total)}</span></div>`;
  }).join('');

  scene.innerHTML=`
    <div class="ms-stage">
      <div class="ms-main">
        <div class="ms-bar">
          <div class="ms-clock" id="ms-clock">⏱️ <b>${st.timeLeft}</b></div>
          <div class="ms-helps">
            <button type="button" class="ms-help" id="ms-h1" ${st.helps.fifty?'':'disabled'} onclick="msFifty()">٥٠:٥٠</button>
            <button type="button" class="ms-help" id="ms-h2" ${st.helps.time?'':'disabled'} onclick="msMoreTime()">⏳ +٢٠</button>
            <button type="button" class="ms-help" id="ms-h3" ${st.helps.skip?'':'disabled'} onclick="msSkip()">⏭️ تبديل</button>
          </div>
        </div>
        <div class="ms-q">${esc(q.q)}</div>
        <div class="ms-opts" id="ms-opts">
          ${q.options.map((o,i)=>`
            <button type="button" class="ms-opt" data-mq="${i}" onclick="msSelect(${i})">
              <span class="ms-ltr">${MS_LETTERS[i]}</span><span class="ms-tx">${esc(o)}</span>
            </button>`).join('')}
        </div>
        <div class="ms-lock" id="ms-lock"></div>
      </div>
      <div class="ms-ladder">${ladder}</div>
    </div>`;

  // على الجوال يصير السلّم شريطًا أفقيًا — نُظهر المستوى الحالي فيه تلقائيًا
  const nowRung=scene.querySelector('.ms-rung.now');
  if(nowRung && nowRung.scrollIntoView) {
    try{ nowRung.scrollIntoView({block:'nearest',inline:'center'}); }catch(e){}
  }

  st.tick=setInterval(()=>{
    const cur=mqState;
    if(!cur||cur.locked||cur.over) return;
    cur.timeLeft--;
    const c=$('ms-clock');
    if(c){ c.innerHTML='⏱️ <b>'+cur.timeLeft+'</b>'; c.classList.toggle('hot',cur.timeLeft<=5); }
    if(cur.timeLeft<=5 && cur.timeLeft>0) GameSound.sfx('flip');
    if(cur.timeLeft<=0) mqAnswer(-1,null);
  },1000);
}

function msSelect(i){
  const st=mqState;
  if(!st||st.locked) return;
  st.sel=i;
  document.querySelectorAll('.ms-opt').forEach(b=>
    b.classList.toggle('sel',Number(b.getAttribute('data-mq'))===i));
  const box=$('ms-lock');
  if(box) box.innerHTML=`<button type="button" class="ms-final" onclick="msConfirm()">هل هذه إجابتك النهائية؟ · اقفلها</button>`;
  GameSound.sfx('flip');
}

function msConfirm(){
  const st=mqState;
  if(!st||st.locked||st.sel==null) return;
  st.locked=true;                       // لحظة التشويق قبل الكشف
  if(st.tick){ clearInterval(st.tick); st.tick=null; }
  document.querySelectorAll('.ms-opt').forEach(b=>{
    b.disabled=true;
    if(Number(b.getAttribute('data-mq'))!==st.sel) b.classList.add('dimmed');
  });
  const box=$('ms-lock');
  if(box) box.innerHTML=`<span class="ms-wait">القفل على الإجابة…</span>`;
  setTimeout(()=>{ const cur=mqState; if(!cur||cur.over) return; cur.locked=false; mqAnswer(cur.sel,null); },1200);
}

function msFifty(){
  const st=mqState;
  if(!st||st.locked||!st.helps.fifty) return;
  st.helps.fifty=0;
  const q=st.qs[st.i];
  const wrong=q.options.map((_,i)=>i).filter(i=>i!==q.answer);
  shuffle(wrong).slice(0,Math.max(0,wrong.length-1)).forEach(i=>{
    const b=document.querySelector(`.ms-opt[data-mq="${i}"]`);
    if(b){ b.disabled=true; b.classList.add('gone'); }
  });
  const h=$('ms-h1'); if(h) h.disabled=true;
  mqTop();
}

function msMoreTime(){
  const st=mqState;
  if(!st||st.locked||!st.helps.time) return;
  st.helps.time=0;
  st.timeLeft+=20;
  st.timeExtended=st.i;
  const c=$('ms-clock');
  if(c){ c.innerHTML='⏱️ <b>'+st.timeLeft+'</b>'; c.classList.remove('hot'); c.classList.add('boost');
         setTimeout(()=>c.classList.remove('boost'),600); }
  const h=$('ms-h2'); if(h) h.disabled=true;
  const fb=$('mq-feedback');
  if(fb){ fb.textContent='⏳ أُضيفت ٢٠ ثانية'; fb.style.color='var(--tick)'; setTimeout(()=>{ if(fb) fb.textContent=''; },1400); }
  mqTop();
}

/* تبديل السؤال: ينتقل لسؤال جديد في المستوى نفسه — لا يرفع المستوى ولا يُنهي الجولة */
function msSkip(){
  const st=mqState;
  if(!st||st.locked||!st.helps.skip) return;
  st.helps.skip=0;
  if(st.tick){ clearInterval(st.tick); st.tick=null; }
  st.qs.splice(st.i,1);
  if(!st.qs.length || st.i>=st.qs.length){ mqFinish('نفدت الأسئلة'); return; }
  st.timeExtended=null;
  mqRender();
}

/* ══ 🔨 اضرب الخُلد: الخيارات تطلّ لحظة ثم تختفي ══ */
function mqSceneWhack(scene,q,st){
  const order=shuffle(q.options.map((o,i)=>({o,i})));
  const life=Math.max(6500,10500-st.i*300);
  scene.innerHTML=`
    ${mqAsk(q,st)}
    <div class="mq-fuse" style="margin-top:.45rem"><i id="mq-fuse" style="width:100%"></i></div>
    <div class="mq-field" id="mq-field" style="margin-top:.5rem">
      ${order.map(x=>`
        <div class="mq-hole">
          <button type="button" class="mq-mole" data-mq="${x.i}"><span>${esc(x.o)}</span></button>
          <span class="mq-dirt"></span>
        </div>`).join('')}
    </div>`;

  const moles=[...scene.querySelectorAll('.mq-mole')];
  moles.forEach(m=>m.onclick=()=>{
    if(!m.classList.contains('up')) return;          // لا تُحتسب ضربة على جحر فارغ
    m.classList.add('hit');
    mqAnswer(Number(m.getAttribute('data-mq')),m);
  });

  // إطلالات عشوائية غير متزامنة، مع ضمان ظهور واحد على الأقل دائمًا
  const bob=()=>{
    if(!mqState || mqState.locked || mqState.over) return;
    moles.forEach(m=>{ if(Math.random()<.45) m.classList.toggle('up'); });
    if(!moles.some(m=>m.classList.contains('up'))){
      moles[Math.floor(Math.random()*moles.length)].classList.add('up');
    }
  };
  moles.slice(0,2).forEach(m=>m.classList.add('up'));
  st.moleTimer=setInterval(bob,620);
  mqFuse(st,life,()=>mqAnswer(-1,null));
}

/* ══ وسيلتا المساعدة في السلّم ══ */
function mqUseFifty(){
  const st=mqState;
  if(!st || st.locked || !st.helps.fifty) return;
  const q=st.qs[st.i];
  const wrong=q.options.map((_,i)=>i).filter(i=>i!==q.answer);
  st.helps.fifty=0;
  shuffle(wrong).slice(0,Math.max(0,wrong.length-1)).forEach(i=>{
    const b=document.querySelector(`.mq-plat[data-mq="${i}"]`);
    if(b){ b.disabled=true; b.classList.add('crumble'); }
  });
  document.querySelectorAll('.mq-help')[0].disabled=true;
}
function mqUseSkip(){
  const st=mqState;
  if(!st || st.locked || !st.helps.skip) return;
  st.helps.skip=0;
  st.i++;
  if(st.i>=st.qs.length) mqFinish('أكملت السلّم');
  else mqRender();
}

/* ══ الإجابة: ردّ الفعل داخل المشهد نفسه ══ */
function mqAnswer(choice, el){
  const st=mqState;
  if(!st || st.locked || st.over) return;
  const q=st.qs[st.i];
  if(!q) return;
  st.locked=true;
  if(st.qTimer){ clearTimeout(st.qTimer); st.qTimer=null; }
  if(st.tick){ clearInterval(st.tick); st.tick=null; }
  if(st.moleTimer){ clearInterval(st.moleTimer); st.moleTimer=null; }
  if(st.loop){ clearInterval(st.loop); st.loop=null; }

  const escaped=choice===-1;
  const right=!escaped && choice===q.answer;
  st.answered++;
  (st.log||(st.log=[])).push({q:q.q, c:escaped?'':(q.options[choice]??'')});
  if(right){ st.correct++; st.streak++; if(st.streak>st.bestStreak) st.bestStreak=st.streak; GameSound.sfx('match'); }
  else { st.streak=0; GameSound.sfx('miss'); }

  let wait=850, stop=false, reason='';
  const missMsg={timeattack:'🎈 هربت الإجابة! كانت: ',millionaire:'⏳ نفد الوقت وعدت للحافة! الصحيحة: ',
                 million:'⏳ نفد الوقت! الصحيحة: ',
                 survival:'🍂 ارتطم المحصول بالأرض! الصحيحة: ',whack:'⏳ غاب الخُلد! الصحيح: '}[st.type]||'⏳ نفد الوقت! الصحيحة: ';
  let note=escaped?missMsg+q.options[q.answer]
        :right?'✅ إجابة صحيحة'
        :'❌ الإجابة الصحيحة: '+q.options[q.answer];

  if(st.type==='timeattack'){
    document.querySelectorAll('.mq-balloon').forEach(b=>{
      const i=Number(b.getAttribute('data-mq'));
      b.disabled=true;
      b.style.animationPlayState='paused';
      if(i===choice) b.classList.add('pop');
      else if(i!==q.answer) b.classList.add('gone');
    });
    if(right && st.streak>=3) note+=` · 🔥 تتابع ${st.streak}`;
    wait=700;
  }
  else if(st.type==='millionaire'){
    document.querySelectorAll('.mq-plat').forEach(b=>{
      const i=Number(b.getAttribute('data-mq'));
      b.disabled=true; b.style.animation='none';
      if(i===q.answer) b.classList.add('correct');
      else if(i===choice) b.classList.add('wrong');
    });
    const j=$('mq-jumper');
    if(right){ if(j) j.classList.add('cheer'); wait=850; }
    else if(escaped){
      // نفاد الوقت: تفتّت الصخرة تحته فيعود إلى الحافة، والجولة مستمرة
      if(j){ j.style.left='38%'; j.style.bottom='16px'; }
      wait=950;
    }
    else{
      const plat=document.querySelector(`.mq-plat[data-mq="${choice}"]`);
      if(plat) plat.classList.add('crumble');
      if(j){ j.classList.add('fall'); j.style.bottom='-60px'; }
      note+=' · تفتّتت الصخرة تحتك!';
      stop=true; reason='سقطت عند القفزة '+(st.correct+1); wait=1300;
    }
  }
  else if(st.type==='million'){
    document.querySelectorAll('.ms-opt').forEach(b=>{
      const i=Number(b.getAttribute('data-mq'));
      b.disabled=true; b.classList.remove('dimmed');
      if(i===q.answer) b.classList.add('right');
      else if(i===choice) b.classList.add('bad');
    });
    const box=$('ms-lock'); if(box) box.innerHTML='';
    if(right){ note='✅ إجابة صحيحة! ارتقيت مستوى'; wait=1200; }
    else{
      const secured=msSecured(st);
      note=escaped?'⏳ نفد الوقت! الصحيحة: '+q.options[q.answer]
                  :'❌ الإجابة الصحيحة: '+q.options[q.answer];
      note+=` · تخرج بـ ${msValue(st,secured)} نقطة مضمونة`;
      stop=true; reason=(escaped?'نفد الوقت عند المستوى ':'توقفت عند المستوى ')+Math.min(st.correct+1,msLevels(st));
      wait=1600;
    }
  }
  else if(st.type==='survival'){
    if(st.loop){ clearInterval(st.loop); st.loop=null; }
    const basket=$('mq-basket');
    document.querySelectorAll('.mq-falling').forEach(b=>{
      const i=Number(b.getAttribute('data-mq'));
      if(i===q.answer) b.classList.add('correct');
      else if(i===choice) b.classList.add('wrong');
    });
    if(right){ if(basket) basket.classList.add('full'); wait=800; }
    else{
      st.lives--;
      if(basket) basket.classList.add('shake');
      note+=escaped
        ? (st.lives>0?` · ضاع المحصول · بقي ${st.lives} سلال`:' · ضاعت آخر سلة')
        : (st.lives>0?` · التقطت الثمرة الخطأ · بقي ${st.lives} سلال`:' · انكسرت آخر سلة');
      if(st.lives<=0){ stop=true; reason='نفدت سلالك'; }
      wait=950;
    }
  }
  else{
    if(st.moleTimer){ clearInterval(st.moleTimer); st.moleTimer=null; }
    document.querySelectorAll('.mq-mole').forEach(b=>{
      const i=Number(b.getAttribute('data-mq'));
      b.disabled=true; b.classList.add('up');
      if(i===q.answer) b.classList.add('correct');
      else if(i===choice) b.classList.add('wrong');
    });
    if(right && st.streak>=3) note+=` · 🔥 تتابع ${st.streak}`;
    wait=800;
  }

  const fb=$('mq-feedback');
  if(fb){ fb.textContent=note; fb.style.color=right?'var(--tick)':'var(--pen)'; }
  mqTop();

  setTimeout(()=>{
    const cur=mqState;
    if(!cur || cur.over) return;
    if(stop){ mqFinish(reason); return; }
    cur.i++;
    if(cur.i>=cur.qs.length) mqFinish('أكملت كل الأسئلة');
    else mqRender();
  },wait);
}

function mqScore(st){
  const total=st.qs.length;
  // في «من سيربح المليون» يُحتسب ما ضمنه الطالب عند نقطة الأمان
  if(st.type==='million'){
    const levels=msLevels(st);
    const lvl = st.correct>=levels ? levels : msSecured(st);
    return Math.max(0,Math.min(50,Math.round(50*lvl/Math.max(1,levels))));
  }
  return Math.max(0,Math.min(50,Math.round(50*st.correct/Math.max(1,total))));
}

function mqFinish(reason){
  const st=mqState;
  if(!st || st.over) return;
  st.over=true;
  mqStop();
  GameSound.sfx('win');
  const secs=Math.max(1,Math.round((Date.now()-(st.startedAt||Date.now()))/1000));
  const score=mqScore(st);
  const total=st.qs.length;
  if(st.type==='million' && st.correct>=msLevels(st)) reason='ربحت المليون! 🏆';
  const line={
    millionaire:`قفزت ${st.correct} صخرة من ${total}`,
    timeattack:`فرقعت ${st.correct} بالونًا صحيحًا من ${total} · أطول تتابع ${st.bestStreak}`,
    survival:`التقطت ${st.correct} من ${total} · ${3-st.lives} سلال مكسورة`,
    million:`بلغت المستوى ${st.correct} من ${msLevels(st)} · المضمون ${msValue(st,st.correct>=msLevels(st)?msLevels(st):msSecured(st))} نقطة`,
    whack:`أصبت ${st.correct} من ${total} · أطول تتابع ${st.bestStreak}`
  }[st.type]||`${st.correct} من ${total}`;

  const top=$('mq-top'); if(top) top.innerHTML='';
  const fb=$('mq-feedback'); if(fb) fb.textContent='';
  const scene=$('mq-scene');
  if(scene) scene.innerHTML=`
    <div class="game-lock-result">
      <b>${gameKind(st.type).icon} ${esc(reason)}</b>
      <span>${esc(line)} · ${secs} ثانية</span>
      <div id="mq-award" style="margin-top:.55rem;font-weight:900;color:var(--tick)">
        نتيجتك: ${score} / 50 📖<br>
        <span style="font-weight:600;font-size:.78rem;color:var(--ink-soft)">جارٍ إضافة النقاط لرصيدك…</span>
      </div>
      <button type="button" class="btn ghost" id="mq-back2" style="margin-top:.7rem">عودة للألعاب</button>
    </div>`;
  const b2=$('mq-back2');
  if(b2) b2.onclick=()=>openJourneyGames(myName,(window.__journeyRows||[]));

  awardMemoryGame(st.key,score,secs,st.answered,st.log).then(j=>{
    const el=$('mq-award');
    if(!el) return;
    if(!j){
      el.innerHTML=`نتيجتك: ${score} / 50 📖<br><span style="font-weight:600;font-size:.78rem;color:var(--pen)">تعذّر الاتصال — لم تُضف النقاط. أبلغ معلمك.</span>`;
      return;
    }
    try{ markGamePlayed(st.entry,(j.score!=null?j.score:score), j); }catch(e){}
    if(j.retried){ el.innerHTML = `نتيجتك الجديدة ${j.score} من 50 · السابقة ${j.prevScore??'—'}<br><span style="font-weight:600;font-size:.78rem;color:var(--ink-soft)">${j.gain>0?`تحسّنت! أُضيفت ${j.gain} نقطة لرصيدك (رصيدك ${j.pts})`:'لم تتجاوز نتيجتك السابقة، فلا نقاط إضافية — التسليم الجديد مسجّل.'}</span>`; return; }
    el.innerHTML=j.already
      ? `نتيجتك السابقة: ${j.score} / 50 📖<br><span style="font-weight:600;font-size:.78rem;color:var(--ink-soft)">لعبتها من قبل — لا تُضاف النقاط مرتين.</span>`
      : `أُضيفت ${j.gain} نقطة لرصيد المتجر 📖<br><span style="font-weight:600;font-size:.78rem;color:var(--ink-soft)">رصيدك الآن ${j.pts} · محاولة واحدة فقط لكل لعبة</span>`;
  });
}

async function awardMemoryGame(gameId, score, secs, moves, log){
  const nm = String(myName||'').trim();
  if((!nm && !mySid) || !gameId) return null;   // بلا هوية → لا منح (معاينة/رابط دون اسم)
  const api = String(API||'').replace(/\/+$/,'');
  if(!api) return null;
  try{
    const r = await fetch(api + '/game-award', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name:nm, sid:mySid||'', game:String(gameId||''), pts:score, secs:secs||0, moves:moves||0,
        ...(Array.isArray(log) ? { log: log.slice(0,80) } : {}) }) });
    const j = await r.json();
    if(j && j.ok){
      if(typeof j.pts==='number') MYPTS = j.pts;
      // حدّث كل واجهات الرصيد فورًا — بلا حاجة لتحديث الصفحة
      syncBalanceUI();
      return j;
    }
    if(j && j.error==='unverifiable_game'){
      toast('هذه اللعبة تحتاج تحديثًا أمنيًا قبل منح النقاط.','bad');
      return null;
    }
  }catch(e){}
  return null;
}


/* 🗺️ رسم رحلة الطالب اعتمادًا على حالة الأنشطة الحالية فقط. لا تغيّر درجات أو تسليمات. */
function loadStudentJourney(rows){
  const box=$('student-journey'); if(!box) return;
  const list=Array.isArray(rows)?rows:[];
  const styleRows=list.filter(h=>String(h.kind||'')==='style');
  const diagRows=list.filter(h=>String(h.kind||'')==='diag');
  const kindOf = h => h && h.remedial ? 'remedial' : isPureGameRow(h) ? 'game' : String(h?.kind || 'normal');
  const remedialRows=list.filter(h=>kindOf(h)==='remedial');
  // قسم الألعاب يجمع كل لعبة منشورة، سواء في نشاط ألعاب أو مرفقة بنشاط عادي
  const gameRows=list.filter(h=>isGameRow(h) && !h.remedial);
  const learningRows=list.filter(h=>!['style','diag','remedial','game'].includes(kindOf(h)));
  const styleResult=journeyStyleGet(myName);
  const styleDone=styleRows.length>0 && (styleRows.every(h=>!!h.done) || !!styleResult);
  const diagDone=diagRows.length>0 && diagRows.every(h=>!!h.done);
  // بوابة البداية: التعلم والتجارب والألعاب تُفتح بعد اختباري البداية — متى نُشرا.
  // بلا اختبارات بداية منشورة لا يبقى شيء مقفلًا بلا ما يُكمَل.
  const startRequired=styleRows.length>0 || diagRows.length>0;
  const startDone=startRequired ? ((styleRows.length ? styleDone : true) && (diagRows.length ? diagDone : true)) : true;
  window.__startGate=startDone; startGateSave(startDone);
  const learningDone=startDone && learningRows.length>0 && learningRows.every(h=>!!h.done);
  const steps=[
    {key:'style',icon:'🧠',title:'اكتشف طريقة تعلمك',note:styleRows.length?(styleDone?(styleResult?'تم الإكمال · تقرير طريقة تعلمك متاح':'تم إكمال الاختبار'):'اختبار أنماط التعلم متاح لك الآن'):'بانتظار نشر اختبار أنماط التعلم',done:styleDone,available:styleRows.length>0,current:!styleDone&&styleRows.length>0,target:styleRows[0]},
    {key:'diag',icon:'🔍',title:'اعرف مستواك',note:diagRows.length?(diagDone?'تم إكمال الاختبار التشخيصي':(styleDone?'الاختبار التشخيصي متاح لك الآن':'أكمل اكتشاف طريقة تعلمك أولًا')):'بانتظار نشر الاختبار التشخيصي',done:diagDone,available:diagRows.length>0&&styleDone,current:styleDone&&!diagDone&&diagRows.length>0,target:diagRows[0]},
    {key:'learning',icon:'🚀',title:'ابدأ رحلة التعلم',pending:startDone?learningRows.filter(h=>!isApplyRow(h)&&!h.done).length:0,note:!startDone?'تُفتح بعد إكمال اختباري البداية':learningRows.filter(h=>!isApplyRow(h)).length?(learningDone?'أكملت أنشطة التعلم والفهم المتاحة':jsPendingText(learningRows.filter(h=>!isApplyRow(h)&&!h.done).length,'نشاط','أنشطة','لم يُحل','لم تُحل')):'ستظهر هنا أنشطة التعلم والفهم عند نشرها',done:learningDone,available:startDone&&learningRows.some(h=>!isApplyRow(h)),current:startDone&&!learningDone&&learningRows.some(h=>!isApplyRow(h)),target:null},
    {key:'apply',icon:'🧪',title:'طبّق وجرّب',pending:startDone?learningRows.filter(h=>isApplyRow(h)&&!h.done).length:0,note:!startDone?'تُفتح بعد إكمال اختباري البداية':(learningRows.filter(h=>isApplyRow(h)).length ? (learningRows.filter(h=>isApplyRow(h)).every(h=>h.done)?'أكملت التجارب والمشاريع المتاحة':jsPendingText(learningRows.filter(h=>isApplyRow(h)&&!h.done).length,'تجربة','تجارب','لم تُسلَّم','لم تُسلَّم')) : 'ستظهر هنا التجارب والمشاريع عند نشرها'),done:startDone&&learningRows.some(h=>isApplyRow(h))&&learningRows.filter(h=>isApplyRow(h)).every(h=>h.done),available:startDone&&learningRows.some(h=>isApplyRow(h)),current:startDone&&learningRows.some(h=>isApplyRow(h)&&!h.done)},
    {key:'games',icon:'🎮',title:'الألعاب',pending:startDone?countUnplayedGames(gameRows):0,note:!gameRows.length?'ستظهر هنا الألعاب عند نشرها':!startDone?'تُفتح بعد إكمال اختباري البداية':countUnplayedGames(gameRows)?jsPendingText(countUnplayedGames(gameRows),'لعبة','ألعاب','لم تلعبها بعد','لم تلعبها بعد',` (من ${countGames(gameRows)})`,'العب الآن'):`لعبت كل الألعاب المتاحة (${countGames(gameRows)}) ✓`,done:startDone&&gameRows.length>0&&countGames(gameRows)>0&&countUnplayedGames(gameRows)===0,available:startDone&&gameRows.length>0,current:false,target:gameRows[0]},
    {key:'develop',icon:'🎯',title:'طوّر مستواك',pending:remedialRows.filter(h=>!h.done).length,note:remedialRows.length?(remedialRows.every(h=>!!h.done)?'أكملت الأنشطة العلاجية المتاحة':'لديك أنشطة علاجية لتعزيز المهارات التي تحتاج إلى مراجعة'):'ستظهر هنا الأنشطة العلاجية عند نشرها',done:remedialRows.length>0&&remedialRows.every(h=>!!h.done),available:remedialRows.length>0,current:remedialRows.some(h=>!h.done),target:remedialRows.find(h=>!h.done)||remedialRows[0]}
  ];
  // نسبة الرحلة تحسب المراحل التي أصبحت فعلية فقط، حتى لا تقل النسبة
  // بسبب مراحل مستقبلية لم تُستخدم في البوابة بعد.
  const activeSteps=steps.filter(x=>x.available || x.done);
  const doneCount=activeSteps.filter(x=>x.done).length;
  const pct=activeSteps.length ? Math.round(doneCount/activeSteps.length*100) : 0;
  $('journey-percent').textContent=pct+'%';
  $('journey-progress-fill').style.width=pct+'%';
  const current=steps.find(x=>x.current);
  $('journey-sub').textContent=current?`الخطوة الحالية: ${current.title}`:doneCount===steps.length?'أكملت رحلة البداية، أحسنت. واصل التقدم.':doneCount?'أحسنت، واصل تقدمك في الرحلة.':'ابدأ من الخطوة الأولى لبناء رحلتك التعليمية.';
  $('journey-steps').innerHTML=steps.map((x,i)=>{
    const state=x.done?'مكتملة ✓':x.current?'ابدأ الآن':x.available?'متاحة':'قريبًا';
    const cls=x.done?'done':x.current?'current':!x.available?'wait':'';
    const styleReport=x.key==='style'&&x.done&&!!journeyStyleGet(myName);
    const learningOpen=x.key==='learning'&&x.available;
    const applyOpen=x.key==='apply'&&x.available;
    const developOpen=x.key==='develop'&&x.available;
    const gamesOpen=x.key==='games'&&x.available;
    const clickable=styleReport||learningOpen||applyOpen||gamesOpen||developOpen||!!x.target&&(x.current||x.available);
    const attrs=styleReport?'data-journey-style-report="1"':learningOpen?'data-journey-learning="1"':applyOpen?'data-journey-apply="1"':gamesOpen?'data-journey-games="1"':developOpen?'data-journey-develop="1"':(clickable?`data-journey-id="${esc(x.target.id||'')}"`:'');
    const stateText=styleReport?'📊 عرض التقرير':learningOpen?'📚 عرض الأنشطة':applyOpen?'🧪 عرض التجارب':gamesOpen?'🎴 عرض الألعاب':developOpen?'🩹 عرض الأنشطة العلاجية':state;
    const reportHint=styleReport?'<span style="display:block;margin-top:.25rem;color:var(--tick);font-size:.76rem;font-weight:700">نتيجتك محفوظة • اضغط لعرض التقرير</span>':'';
    const pend=!x.done&&x.available&&Number(x.pending)>0;
  return `<div class="journey-step ${cls}${pend?' pending':''}" ${attrs}><div class="js-icon">${x.done?'✓':x.icon}${pend?`<b class="js-badge">${Number(x.pending)}</b>`:''}</div><div class="js-body"><span class="js-title">${i+1}. ${esc(x.title)}</span><span class="js-note">${esc(x.note)}</span>${reportHint}</div><span class="js-state">${stateText}</span></div>`;
  }).join('');
  $('journey-steps').querySelectorAll('[data-journey-style-report]').forEach(el=>el.onclick=()=>openJourneyStyleReport(myName));
  $('journey-steps').querySelectorAll('[data-journey-learning]').forEach(el=>el.onclick=()=>openJourneyLearning(myName, learningRows, ['reading','normal','game']));
  $('journey-steps').querySelectorAll('[data-journey-apply]').forEach(el=>el.onclick=()=>openJourneyLearning(myName, learningRows, ['files','lab']));
  $('journey-steps').querySelectorAll('[data-journey-games]').forEach(el=>el.onclick=()=>openJourneyGames(myName, gameRows));
  $('journey-steps').querySelectorAll('[data-journey-develop]').forEach(el=>el.onclick=()=>openJourneyLearning(myName, remedialRows, ['remedial']));
  $('journey-steps').querySelectorAll('[data-journey-id]').forEach(el=>el.onclick=()=>{
    const id=el.getAttribute('data-journey-id');
    if(openGameActivity(id)) return;
    const b=document.querySelector(`#gate-list .hw-item[data-id="${CSS.escape(id)}"]`);
    if(b) b.click();
  });
  box.classList.remove('hide');
}

function setAllActivitiesOpen(open, scroll=false){
  const panel=$('all-activities-panel');
  const list=$('gate-list');
  const btn=$('all-activities-toggle');
  if(!panel || !list || !btn) return;
  panel.classList.toggle('open', !!open);
  list.classList.toggle('hide', !open);
  btn.setAttribute('aria-expanded', open?'true':'false');
  if(scroll) panel.scrollIntoView({behavior:'smooth',block:'start'});
}

function updateAllActivitiesSummary(rows){
  const count=$('all-activities-count');
  if(!count) return;
  const list=Array.isArray(rows)?rows:[];
  const pending=list.filter(h=>!h.done && !(h.due && h.due<todayISO())).length;
  const done=list.filter(h=>!!h.done).length;
  count.textContent=list.length
    ? `${pending ? pending+' غير مكتمل' : 'اكتملت الأنشطة المتاحة'} · ${done}/${list.length} مكتملة`
    : 'لا توجد أنشطة منشورة حاليًا';
}

async function gateLoad(nm, opts){
  const restored = !!(opts && opts.restored);
  myName = String(nm || '').trim();
  setTimeout(() => { try{ spAfterGateLoad(); }catch(e){} }, 0);   // 📲 بطاقة التنبيهات

  const allToggle=$('all-activities-toggle');
  if(allToggle && !allToggle.dataset.bound){
    allToggle.dataset.bound='1';
    allToggle.setAttribute('aria-expanded','false');
    allToggle.onclick=()=>{
      const open=!$('all-activities-panel')?.classList.contains('open');
      setAllActivitiesOpen(open, open);
    };
  }
  setAllActivitiesOpen(false);

  const api = (API || '').replace(/\/+$/,'');
  $('gate-list').innerHTML =
    '<p class="muted center">جارٍ تحميل نشاطاتك…</p>';

  let studentData = { pts:0, perks:{} };

  try{
    const m = await (
      await fetch(api + '/me?name=' + encodeURIComponent(nm) + idQS())
    ).json();

    // 🪪 الطالب المحفوظ في هذا المتصفح لم يعد في الكشف (حذفه المعلم):
    // ننسى الهوية بدل عرض بيانات صاحبها لم يعد موجودًا. شرط `restored`
    // يقصر هذا على الدخول التلقائي — الاسم المكتوب يدويًا له مساره.
    // وشرط `m.ok` يعني أننا سمعنا من الخادم فعلًا: انقطاع الشبكة يرمي
    // استثناءً ولا يصل هنا، فلا يُطرد طالب لمجرد ضعف الاتصال.
    if(restored && m.ok && m.known === false && !m.ambiguous){
      try{ localStorage.removeItem(NAME_KEY); localStorage.removeItem(SID_KEY); }catch(e){}
      mySid = ''; myName = ''; MYPTS = 0; MYPERKS = {};
      resetGateToNameForm();
      $('gate-list').innerHTML =
        '<p class="muted center">لم يعد هذا الاسم في كشف الفصل. اكتب اسمك للمتابعة.</p>';
      return;
    }

    if(m.ok){
      studentData.pts = Number(m.pts || 0);
      studentData.perks = m.perks || {};

      MYPTS = studentData.pts;
      MYPERKS = studentData.perks;
      try{ nmApply(); }catch(e){}
      MYTITLE = m.title || '';

      $('gate-bal').innerHTML = `
        <div class="sheet center" style="padding:.8rem">
          <span class="muted" style="font-size:.85rem">رصيدك</span>
          <span class="bal" style="font-size:1.3rem;margin-inline-start:.4rem">
            ${studentData.pts} 📖
          </span>
          ${MYTITLE ? `<div style="margin-top:.35rem;font-size:.92rem;font-weight:700">${titleLabel(MYTITLE)}</div>` : ''}
        </div>`;

      const toggle = $('gate-store-toggle');
      const status = $('gate-store-status');

      if(toggle) toggle.disabled = false;
      if(status){
        status.textContent =
          `رصيدك الحالي ${studentData.pts} نقطة — اختر بطاقة من المتجر`;
      }
    }
  }catch(e){
    const status = $('gate-store-status');
    if(status) status.textContent = 'تعذّر تحميل بيانات الطالب';
  }

  // 🏁 الصدارة تُحمَّل على التوازي ولا يُنتظر انتهاؤها.
  // حسابها في الخادم يمرّ على كل زميل × كل نشاط، وكان انتظارها يحبس «/mine»
  // فيبقى الطالب أمام «جارٍ تحميل نشاطاتك…» بلا سبب. الصندوق يملأ نفسه لاحقًا.
  (async () => {
   try{
    const b = await (
      await fetch(api + '/board?name=' + encodeURIComponent(nm))
    ).json();

    if(b.ok && b.total > 1){
      const medal = ['🥇','🥈','🥉'];

      $('gate-board').innerHTML = `
        <div class="sheet" style="padding:.85rem 1rem">
          <div class="center muted" style="font-size:.82rem;margin-bottom:.5rem">
            🏆 صدارة ${b.cls ? esc(b.cls) : 'فصلك'}
            <div style="font-size:.72rem;opacity:.85">حسب الدرجات</div>
          </div>

          ${(b.top||[]).map((r,i)=>`
            <div style="display:flex;gap:.5rem;align-items:center;padding:.28rem 0;
              ${r.name===nm?'font-weight:700;color:var(--tick)':''}">
              <span>${medal[i]||''}</span>
              <span style="flex:1"><span class="${nmCls(r.glow)}">${esc(r.name)}</span>${r.title?` <span style="font-size:.88rem" title="لقب">${titleLabel(r.title)}</span>`:''}</span>
              <span class="muted">${r.pts}${r.max?'<span style="opacity:.7">/'+r.max+'</span>':''}</span>
            </div>
          `).join('')}

          <div style="border-top:1px solid var(--rule);margin-top:.45rem;
            padding-top:.45rem;text-align:center;font-size:.88rem">
            ترتيبك <b style="color:var(--ink)">${b.myRank}</b> من ${b.total}
            ${b.myMax ? `<span class="muted" style="font-size:.8rem"> · درجاتك ${b.myPts}/${b.myMax}</span>` : ''}
          </div>
        </div>`;
    }
   }catch(e){}
  })();

  try{
    const j = await (
      await fetch(api + '/mine?name=' + encodeURIComponent(nm) + idQS())
    ).json();

    if(!j.ok) throw new Error('mine failed');

    window.__journeyRows=j.rows;
    loadStudentJourney(j.rows);
    await loadStudentSpace(nm, j.rows);

    // 🩹 الأنشطة العلاجية لها مسار مستقل داخل «🎯 طوّر مستواك»،
    // لذلك لا تظهر في قائمة «جميع أنشطتي» ولا تختلط مع التدريب العادي.
    // 🎮 الألعاب لها شاشة مستقلة داخل «الألعاب» ولا تُعامل كواجبات عادية.
    // قديمةً كانت اللعبة تُحفظ داخل p.g بينما يبقى kind=normal، فتدخل هنا
    // كأنها نشاط بلا أسئلة وتظهر للطالب كبطاقة/ملف فارغ في «جميع أنشطتي».
    const activityRows = j.rows.filter(h=>!h.remedial && !isPureGameRow(h));
    updateAllActivitiesSummary(activityRows);

    if(!activityRows.length){
      $('gate-list').innerHTML =
        '<div class="sheet center"><p class="muted">لا توجد أنشطة تعليمية عليك حالياً 🎉</p></div>';
      return;
    }

    const t = todayISO();

    const reviewRows = activityRows.filter(h=>h.reviewPending);
    const reviewBox = reviewRows.length ? `
      <div class="sheet" style="margin-bottom:1rem;border:1px solid rgba(200,138,46,.35);background:rgba(200,138,46,.06)">
        <div style="display:flex;gap:.8rem;align-items:flex-start">
          <div style="font-size:1.45rem">🔎</div>
          <div style="flex:1">
            <b style="display:block;margin-bottom:.25rem">لديك مراجعة مطلوبة من المعلم</b>
            ${reviewRows.map(h=>`<div class="rt-card">
              <b>«${esc(h.t || 'النشاط')}»</b>
              <div class="rt-why">${esc(rtReviewText(h))}</div>
              <div class="rt-task">${rtTaskLine(h)}</div>
              <button class="btn tick rt-go" type="button" onclick="openReviewTask('${esc(h.id)}','${esc(nm)}')">${(h.review&&h.review.wrong===0)?'✓ قرأت الملاحظة وسأتأنّى':'🔎 ابدأ مهمة التصحيح'}</button>
            </div>`).join('')}
          </div>
        </div>
      </div>` : '';

    // 🔎 المراجعة المطلوبة من المعلم تظهر في الصفحة الرئيسية (مساحة الطالب) لا داخل «جميع أنشطتي»
    { const sr = $('space-review'); if(sr) sr.innerHTML = reviewBox.replace('margin-bottom:1rem','margin:0 0 .9rem'); }
    $('gate-list').innerHTML = (document.getElementById('space-review') ? '' : reviewBox) + gateGroups(activityRows, h=>{
    if(window.__startGate === false && startGated(h) && !h.done){
      return `
      <button type="button" class="hw-item hw-locked" data-id="${esc(h.id)}" data-start-locked="1">
        <span class="hw-tag" style="background:#EEF2F7;color:#64748B">🔒 بعد اختباري البداية</span>
        <b>${esc(h.t)}</b>
        <span class="hw-meta">${START_GATE_MSG}</span>
      </button>`;
    }
      const late = h.due && h.due < t && !h.done;
      const gameRow = isGameRow(h);
      const KI = { style:'🧠', diag:'🔍' };
      const kicon = gameRow ? '🎮' : (KI[h.kind] || '');
      const isProject = h.kind === 'files';
      // المشروع بلا مهام: لا «مراجعة أخطاء» ولا بطاقات إعادة/مراجعة مبكرة — حالته هي قرار المعلم
      const canReview = h.done && !isProject && (h.kind === 'style' || h.kind === 'diag' || !h.due || h.due < t);
      const extraAttempts = Number(h.extra || h.extraAttempts || 0);
      // صلاحية المعلم تفتح النشاط سواء سبق للطالب التسليم أم فات الموعد بلا تسليم.
      const canTeacherRetry = extraAttempts > 0;
      const canRetry = h.done && !isProject && h.kind !== 'style' && Number(MYPERKS.retry || 0) > 0;

      // 🔁 مشروع مرفوض مع مهلة إعادة تسليم ما زالت سارية.
      const projectResubmitUntil = Number(h.resubmitUntil || 0);
      const canProjectResubmit =
        h.kind === 'files' &&
        String(h.reviewStatus || '').toLowerCase() === 'rejected' &&
        projectResubmitUntil > Date.now();

      let tag;

      if(canProjectResubmit){
        tag = `<span class="hw-tag"
          style="background:rgba(214,69,91,.12);color:var(--pen)">
          ❌ مرفوض · إعادة التسليم
        </span>`;
      }else if(canTeacherRetry){
        tag = `<span class="hw-tag"
          style="background:rgba(27,156,107,.15);color:var(--tick)">
          🔓 إعادة تسليم
        </span>`;
      }else if(canRetry){
        tag = `<span class="hw-tag"
          style="background:rgba(214,69,91,.12);color:var(--pen)">
          🔁 إعادة محاولة
        </span>`;
      }else if(h.done){
        const rs = String(h.reviewStatus || 'pending').toLowerCase();
        const doneText = isProject
          ? (rs === 'accepted' ? '✅ قُبل المشروع' : rs === 'rejected' ? '❌ مرفوض' : '📎 قيد المراجعة')
          : h.kind === 'style' ? '✓ اكتمل'
          : `سُلّم ${h.correct}/${h.total}`;
        const doneColor = isProject && rs === 'rejected' ? 'background:rgba(214,69,91,.12);color:var(--pen)'
          : isProject && rs !== 'accepted' ? 'background:rgba(46,107,184,.12);color:#2E6BB8'
          : 'background:rgba(27,156,107,.15);color:var(--tick)';
        tag = `<span class="hw-tag"
          style="${doneColor}">
          ${doneText}
        </span>`;
      }else if(late){
        tag = `<span class="hw-tag"
          style="background:rgba(214,69,91,.12);color:var(--pen)">
          فات موعده
        </span>`;
      }else{
        tag = `<span class="hw-tag"
          style="background:rgba(200,138,46,.15);color:#C88A2E">
          مطلوب
        </span>`;
      }

      let action = '';

      if(canProjectResubmit){
        action = `<span class="hw-meta"
          style="display:block;margin-top:.25rem;color:var(--pen)">
          🔁 اضغط لإعادة تسليم المشروع · متاح حتى ${new Date(projectResubmitUntil).toLocaleString('ar-SA')}
        </span>`;
      }else if(canTeacherRetry){
        action = `<span class="hw-meta"
          style="display:block;margin-top:.25rem;color:var(--tick)">
          🔓 سمح المعلم بمحاولة إضافية — اضغط لفتح النشاط
          ${extraAttempts > 1 ? ` (متبقي ${extraAttempts})` : ''}
        </span>`;
      }else if(canRetry){
        action = `<span class="hw-meta"
          style="display:block;margin-top:.25rem;color:var(--pen)">
          🔁 لديك بطاقة إعادة محاولة — اضغط لإعادة الحل
        </span>`;
      }else if(h.done && isProject){
        const rs = String(h.reviewStatus || 'pending').toLowerCase();
        action = `<span class="hw-meta" style="display:block;margin-top:.25rem;color:${rs==='rejected'?'var(--pen)':rs==='accepted'?'var(--tick)':'var(--ink-soft)'}">
          ${rs === 'accepted' ? '✅ اعتمد المعلم مشروعك'
            : rs === 'rejected' ? '❌ رفض المعلم المشروع' + (h.reviewReason ? ' — اضغط لقراءة السبب' : '')
            : '🕐 وصل مشروعك للمعلم وينتظر المراجعة'}
        </span>`;
      }else if(h.done){
        const canEarly = !canReview && Number(MYPERKS.early || 0) > 0;
        action = `<span class="hw-meta"
          style="display:block;margin-top:.25rem;
          color:${canReview?'var(--tick)':canEarly?'#C88A2E':'var(--ink-soft)' }">
          ${canReview ? (h.kind==='style' ? '🧠 اضغط لعرض تقريرك'
             : h.kind==='diag' ? '🔍 اضغط لعرض تقريرك'
             : '📖 اضغط لمراجعة أخطائك')
            : canEarly ? '🔓 لديك «مراجعة مبكرة» — اضغط لفتح أخطائك الآن'
            : '📖 المراجعة تُفتح بعد موعد الإغلاق'}
        </span>`;
      }

      return `
        <button type="button" class="hw-item${h.done?' done':''}${late?' late':''}"
          data-id="${esc(h.id)}"
          data-title="${esc(h.t||'')}"
          data-kind="${esc(h.kind||'normal')}"
          data-rev="${canReview?'1':''}"
          data-extra="${canTeacherRetry?'1':''}"
          data-retry="${canRetry?'1':''}"
          data-project-resubmit="${canProjectResubmit?'1':''}"
          ${late && !canTeacherRetry && !canRetry ? 'disabled' : ''}>
          ${tag}
          <b>${kicon ? kicon + ' ' : ''}${esc(h.t)}${gateIsNew(h) ? ' <span class="hw-new">🆕 جديد</span>' : ''}</b>
          <span class="hw-meta">${gatePubLabel(h)}
            ${h.kind==='files' ? '📎 تسليم صور أو PDF أو فيديو' : `${h.n} مهمة${h.kind === 'style' ? ' · اختبار أنماط تعلّم'
                       : h.kind === 'diag' ? ' · اختبار تشخيصي'
                       : ` · ${h.pts} نقطة`}`}
            ${h.due ? ' · يُغلق ' + esc(h.due) : ''}
          </span>
          ${action}
        </button>`;
    });

    $('gate-list').querySelectorAll('.hw-item').forEach(b=>{
      b.onclick = async ()=>{
        const hwId = b.dataset.id;
      if(b.dataset.startLocked === '1'){ note(START_GATE_MSG + '\n\nتجدهما في أعلى «رحلتك التعليمية».', 'ابدأ باختباري البداية', '🔒'); return; }
        // 🔬 المختبر يتحقق بنفسه من التسليم والمحاولة الإضافية على الخادم
        if(b.dataset.kind === 'lab' && b.dataset.retry !== '1'){ openLabRow(hwId); return; }

        if(b.dataset.projectResubmit === '1'){
          // افتح المشروع المرفوض مباشرة بعد تنظيف علامة التسليم المحلية.
          try{ localStorage.removeItem('hwdone_' + hwId + '__' + nm); }catch(e){}
          location.hash = hwId;
          location.reload();
          return;
        }

        if(b.dataset.extra === '1'){
          // أزل القفل المحلي وإلا ظهرت شاشة «سبق أن سلّمت» ولزم ضغطتان
          try{ localStorage.removeItem('hwdone_' + hwId + '__' + nm); }catch(e){}
          location.hash = hwId;
          location.reload();
          return;
        }

        if(b.dataset.retry === '1'){
          await startRetryFromGate(hwId, nm);
          return;
        }

        // 📎 المشروع المُسلَّم: حالته من المعلم، لا شاشة «مراجعة الأخطاء» لنشاط بلا مهام
        if(b.dataset.kind === 'files' && b.classList.contains('done')){
          const row = (window.__journeyRows || []).find(x => String(x.id) === String(hwId)) || {};
          const rs = String(row.reviewStatus || 'pending').toLowerCase();
          if(rs === 'accepted') note('اعتمد المعلم مشروعك. أحسنت!', 'مشروع مقبول', '✅');
          else if(rs === 'rejected') note((row.reviewReason ? `سبب الرفض: ${row.reviewReason}\n\n` : '') + 'انتهت مهلة إعادة التسليم. اطلب من معلمك السماح بإعادة التسليم إن احتجت.', 'رفض المعلم المشروع', '❌');
          else note('وصل مشروعك للمعلم، وستظهر هنا نتيجة مراجعته.', 'قيد المراجعة', '🕐');
          return;
        }

        // 🔓 مراجعة مبكرة ببطاقة
        if(b.dataset.rev !== '1' && b.classList.contains('done') && Number(MYPERKS.early||0) > 0){
          if(await useEarlyReview(hwId, nm)){
            if(b.dataset.kind === 'style' || b.dataset.kind === 'diag'){
              await openMeasureReport(hwId, nm, b.dataset.kind);
            }else{
              openReview(hwId, nm, b.dataset.title || '');
            }
          }
          return;
        }
        if(b.dataset.rev === '1'){
          // 🧠🔍 الأنماط والتشخيصي يعرضان تقرير القياس بعد التسليم،
          // أما النشاط العادي فيبقى على شاشة مراجعة الأخطاء المعتادة.
          if(b.dataset.kind === 'style' || b.dataset.kind === 'diag'){
            await openMeasureReport(hwId, nm, b.dataset.kind);
          }else{
            openReview(hwId, nm, b.dataset.title || '');
          }
          return;
        }

        if(b.classList.contains('done')){
          note(
            'ستُفتح مراجعة أخطائك بعد انتهاء موعد الإغلاق.',
            'نشاط مُسلّم',
            '📖'
          );
          return;
        }

        location.hash = hwId;
        location.reload();
      };
    });

    const storeBox = $('gate-store-box');
    if(storeBox && !storeBox.classList.contains('hide')){
      renderStore('gate-store-box');
    }
  }catch(e){
    $('gate-list').innerHTML =
      '<div class="sheet center"><p class="muted">تعذّر تحميل النشاطات — حاول لاحقاً</p></div>';
  }
}

/* 📖 مراجعة نشاط سُلّم — تُفتح بعد الموعد */
async function openReview(hwId, nm, hwTitle){
  const api = (API||'').replace(/\/+$/,'');
  $('gate-list').insertAdjacentHTML('afterbegin','<p class="muted center" id="rev-load">جارٍ فتح المراجعة…</p>');
  let j;
  try{
    j = await (await fetch(`${api}/review?hw=${encodeURIComponent(hwId)}&name=${encodeURIComponent(nm)}${idQS()}`)).json();
  }catch(e){ toast('تعذّر الاتصال','bad'); }
  const ld = $('rev-load'); if(ld) ld.remove();
  if(!j || !j.ok){ toast('تعذّر فتح المراجعة','bad'); return; }
  if(!j.open){ note('ستُفتح بعد ' + (j.due||'موعد الإغلاق') + '.', 'المراجعة مغلقة', '🔒'); return; }

  const marks = String(j.d||'').split('');
  const body = (j.q||[]).map((q,i)=>{
    const ok = marks[i] === '1';
    const k = q.t||'q';
    const title = k==='a' ? (q.h||'رتّب الحروف') : k==='s' ? 'رتّب الجملة' : k==='m' ? 'وصّل' : (q.q||'');
    const right = k==='q' ? q.o[q.a] : k==='tf' ? (q.a?'صح':'خطأ') : k==='f' ? q.a
                : k==='a' ? q.w : k==='s' ? q.s
                : (q.p||[]).map(p=>`${p[0]} ← ${p[1]}`).join(' · ');
    let mine = '—';
    const a = j.ans ? j.ans[i] : null;
    if(a !== null && a !== undefined){
      if(k==='q') mine = q.o[a];
      else if(k==='tf') mine = a===true?'صح':a===false?'خطأ':'—';
      else if(k==='f') mine = a;
      else if(k==='a') mine = Array.isArray(a)?a.join(''):'—';
      else if(k==='s') mine = Array.isArray(a)?a.join(' '):'—';
      else if(k==='m') mine = (q.p||[]).map((p,x)=>`${p[0]} ← ${(a&&a[x])||'—'}`).join(' · ');
    }
    return `<div class="sheet" style="border-inline-start:4px solid ${ok?'var(--tick)':'var(--pen)'};padding:.85rem 1rem">
      <div class="muted" style="font-size:.75rem;margin-bottom:.25rem">${i+1}. ${KINDS[k]||''} ${ok?'✓':'✗'}</div>
      <div style="font-weight:700;margin-bottom:.35rem">${esc(title)}</div>
      ${ok?'':`<div style="font-size:.9rem;color:var(--pen)">إجابتك: ${esc(mine)}</div>`}
      <div style="font-size:.9rem;color:var(--tick)">الصحيح: ${esc(right)}</div>
    </div>`;
  }).join('');

  WS_DATA = { nm, j, hw: {
    t:  j.t   || hwTitle || (HW && HW.t) || 'نشاط',
    cls: j.cls || (HW && HW.cls) || '',
    mx: j.mx  || (HW && HW.mx) || 0 } };

  /* 🎯 المراجعة تُعرض أعلى الصفحة وحدها (بلا تمرير لأسفل)، و«رجوع» يعيدك لمكانك في القائمة دون إعادة تحميل */
  REV_BACK_Y = document.getElementById('rev-view') ? REV_BACK_Y : window.scrollY;
  let rv = document.getElementById('rev-view');
  if(!rv){ rv = document.createElement('div'); rv.id = 'rev-view'; $('s-gate').prepend(rv); }
  document.body.classList.add('rev-mode');
  rv.innerHTML = `
    <div class="print-head">
      <div style="font-weight:700;font-size:1.1rem">${esc(nm)}</div>
      <div style="font-size:.9rem">النتيجة: ${j.correct} من ${j.total} · ${j.pts} نقطة</div>
    </div>
    <div class="sheet center">
      <h3 style="margin-bottom:.2rem">مراجعة أخطائك</h3>
      <div class="score" style="font-size:2rem">${j.correct}/${j.total}</div>
      <p class="muted" style="margin:0">درجتك ${j.correct} من ${j.total} · ${j.pts} نقطة للمتجر</p>
      <div class="nav" style="margin-top:.7rem">
        <button class="btn ghost" onclick="closeReview()">← رجوع</button>
        <button class="btn tick" onclick="printWorksheet()">🖨️ طباعة ورقة العمل</button>
      </div>
    </div>${body}
    <div class="nav" style="margin-top:.4rem"><button class="btn ghost" onclick="closeReview()">← رجوع إلى أنشطتي</button></div>`;
  window.scrollTo(0,0);
}
let REV_BACK_Y = 0;
function closeReview(){
  const rv = document.getElementById('rev-view'); if(rv) rv.remove();
  document.body.classList.remove('rev-mode');
  WS_DATA = null;
  requestAnimationFrame(()=>window.scrollTo(0, REV_BACK_Y||0));
}

/* 🖨️ ورقة عمل للطباعة — مرتّبة ومضغوطة */
let WS_DATA = null;
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

// يوزّع البطاقات على جدول بعمودين (يعمل في سفاري iOS)
function wsGrid(cards, single){
  if(single || cards.length < 3)
    return `<table class="ws-grid single"><tbody>${
      cards.map(c=>`<tr><td>${c}</td></tr>`).join('')}</tbody></table>`;
  const rows = [];
  for(let i=0; i<cards.length; i+=2)
    rows.push(`<tr><td>${cards[i]}</td><td>${cards[i+1] || '&nbsp;'}</td></tr>`);
  return `<table class="ws-grid"><tbody>${rows.join('')}</tbody></table>`;
}

function printWorksheet(){
  if(!WS_DATA){ window.print(); return; }
  const { nm, j, hw } = WS_DATA;
  const marks = String(j.d||'').split('');
  const wrong = [];
  const items = (j.q||[]).map((q,i)=>{
    const ok = marks[i] === '1';
    if(!ok) wrong.push(i+1);
    const k = q.t||'q';
    const title = k==='a' ? (q.h||'رتّب الحروف')
                : k==='s' ? 'رتّب الجملة'
                : k==='m' ? 'وصّل بين العمودين'
                : (q.q||'');
    const right = k==='q' ? (q.o||[])[q.a] : k==='tf' ? (q.a?'صح':'خطأ')
                : k==='f' ? q.a : k==='a' ? q.w : k==='s' ? q.s
                : (q.p||[]).map(x=>x[0]+' ← '+x[1]).join(' · ');
    let mine = '—';
    const a = j.ans ? j.ans[i] : null;
    if(a !== null && a !== undefined){
      if(k==='q') mine = (q.o||[])[a];
      else if(k==='tf') mine = a===true?'صح':a===false?'خطأ':'—';
      else if(k==='f') mine = a;
      else if(k==='a') mine = Array.isArray(a)?a.join(''):'—';
      else if(k==='s') mine = Array.isArray(a)?a.join(' '):'—';
      else if(k==='m') mine = (q.p||[]).map((p,x)=>p[0]+' ← '+((a&&a[x])||'—')).join(' · ');
    }
    return { i, ok, title, right, mine };
  });

  const pct = j.total ? Math.round(j.correct/j.total*100) : 0;
  const dt = new Date();
  const today = `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`;
  const bad = items.filter(x=>!x.ok);
  const good = items.filter(x=>x.ok);

  const mx = hw.mx || 0;
  const grade = mx ? Math.round(mx * j.correct / Math.max(1, j.total)) : null;
  const msg = pct === 100 ? 'إتقان كامل — أحسنت! 🌟'
            : pct >= 80 ? 'أداء ممتاز — راجع الأخطاء القليلة لتصل للكمال.'
            : pct >= 60 ? 'أداء جيد — ركّز على المهام المعلّمة بالأحمر.'
            : 'راجع الدرس مع معلمك، وابدأ بالمهام الحمراء.';
  const goodPct = j.total ? (good.length / j.total * 100) : 0;

  document.getElementById('ws').innerHTML = `
    <div class="ws-cover">
      <div class="ttl">
        <div class="kicker">وزارة التعليم · ورقة مراجعة</div>
        <b>${esc(hw.t || 'نشاط')}</b>
        <span>${esc(nm)}${hw.cls ? ' — ' + esc(hw.cls) : ''}</span>
      </div>
      <div class="ws-logo">${MOE_LOGO}</div>
      <div class="ws-ring"><b>${pct}%</b><span>${j.correct}/${j.total}</span></div>
    </div>

    <div class="ws-info">
      <div class="wide" title="${esc(nm)}">الطالب<b>${esc(nm)}</b></div>
      ${hw.cls ? `<div class="wide" title="${esc(hw.cls)}">الفصل<b>${esc(hw.cls)}</b></div>` : ''}
      <div class="num">التاريخ<b>${today}</b></div>
      <div class="num">صحيح<b style="color:#0E5B4E">${good.length}</b></div>
      <div class="num">مراجعة<b style="color:${bad.length?'#B3261E':'#0E5B4E'}">${bad.length}</b></div>
      ${grade!==null ? `<div class="num">الدرجة<b>${grade}/${mx}</b></div>` : ''}
    </div>

    <div class="ws-bar">
      <i class="g" style="width:${goodPct}%"></i>
      <i class="b" style="width:${100-goodPct}%"></i>
    </div>

    <div class="ws-note">
      <b>ملاحظة:</b> ${esc(msg)}
      ${wrong.length ? `<br>المهام التي تحتاج مراجعة: <b>${wrong.join('، ')}</b>` : ''}
    </div>

    ${bad.length ? `
      <div class="ws-sec bad"><span class="pill">${bad.length}</span> راجع هذه المهام</div>
      ${wsGrid(bad.map(x=>`<div class="ws-q bad">
          <span class="n">${x.i+1}</span>
          <span class="bd"><span class="qt">${esc(x.title)}</span>
            <span class="ln mine">إجابتك: ${esc(x.mine)}</span>
            <span class="ln right">الصحيح: ${esc(x.right)}</span></span>
        </div>`), bad.length < 3)}` : `<div class="ws-perfect">🎉 لا أخطاء — إجابات كاملة</div>`}

    ${good.length ? `
      <div class="ws-sec ok"><span class="pill">${good.length}</span> إجابات صحيحة</div>
      ${wsGrid(good.map(x=>`<div class="ws-q">
          <span class="n">${x.i+1}</span>
          <span class="bd"><span class="qt">${esc(x.title)}</span>
            <span class="ln right">${esc(x.right)}</span></span>
        </div>`), false)}` : ''}

    <div class="ws-foot">
      <span>توقيع ولي الأمر: ................................</span>
      <span><b>${esc(hw.t||'')}</b>${hw.cls?' · '+esc(hw.cls):''}</span>
    </div>`;
  window.print();
}

/* 👥 جهاز واحد لعدة طلاب: زر تبديل الطالب في شاشة القفل */
function showSwitchOnLocked(lk){
  const box = document.getElementById('retry-box');
  if(!box) return;
  box.insertAdjacentHTML('beforebegin', `
    <div style="margin-top:1rem">
      <button class="btn ghost" id="locked-switch">👥 أنا طالب آخر — تغيير الاسم</button>
    </div>`);
  const b = document.getElementById('locked-switch');
  if(b) b.onclick = async ()=>{
    if(!await ask({ icon:'👥', title:'طالب آخر؟',
      msg:`هذا الجهاز مسجّل باسم ${lk}.\nهل أنت طالب مختلف تحل من نفس الجهاز؟`,
      yes:'نعم، أنا طالب آخر', no:'رجوع' })) return;
    try{ localStorage.removeItem(NAME_KEY); localStorage.removeItem(SID_KEY); }catch(e){}
  mySid = '';
    location.reload();
  };
}

/* 🔁 إعادة المحاولة: تفك القفل لمن اشتراها */
async function offerRetry(){
  const api = ((HW && HW.api) || API || '').replace(/\/+$/,'');
  const nm = lockedName();
  if(!api || !nm) return;
  try{
    const r = await fetch(api + '/me?name=' + encodeURIComponent(nm) + idQS());
    const j = await r.json();
    if(!j.ok || !(j.perks && j.perks.retry > 0)) return;
    MYPTS = j.pts || 0; MYPERKS = j.perks;
    $('retry-box').classList.remove('hide');
    $('retry-btn').textContent = '🔁 استخدام بطاقة إعادة المحاولة ×' + j.perks.retry;
  }catch(e){}
}

document.addEventListener('DOMContentLoaded', ()=>{});

async function doRetry(){
  const api = ((HW && HW.api) || API || '').replace(/\/+$/,'');
  const nm = lockedName();
  try{
    const r = await storeFetch(api + '/use', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name: nm, sid: mySid||'', card:'retry', hw: HW.id }) });
    const j = await r.json();
    if(!j.ok){ toast(storeErrText(j, 'لا تملك بطاقة إعادة محاولة'),'bad'); return; }
    try{ localStorage.removeItem(doneKey(nm)); }catch(e){}
    await note('تُحتسب لك الدرجة الأعلى بين المحاولتين.', 'يمكنك الحل من جديد ✅', '🔁');
    location.reload();
  }catch(e){ toast('تعذّر الاتصال','bad'); }
}

/* 💡 التلميح: يستبعد خياراً خاطئاً أو يضع أول عنصر صحيح */

async function useHint(){
  if(HW.kind === 'style' || HW.kind === 'diag'){
    toast('البطاقات لا تعمل في اختبارات القياس','bad'); return;
  }
  if(!(MYPERKS.hint > 0)){ toast('لا تملك بطاقة تلميح','bad'); return; }
  const q = HW.q[idx], k = q.t||'q';
  if(k==='tf'){ toast('التلميح لا يعمل في صح/خطأ','bad'); return; }

  const api = ((HW && HW.api) || API || '').replace(/\/+$/,'');
  try{
    const r = await storeFetch(api + '/use', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name: myName, sid: mySid||'', card:'hint', hw: HW.id }) });
    const j = await r.json();
    if(!j.ok){ toast(storeErrText(j, 'لا تملك بطاقة تلميح'),'bad'); return; }
    MYPERKS = j.perks || {};
  }catch(e){ toast('تعذّر الاتصال','bad'); return; }

  if(k==='q'){
    const bad = q.o.map((_,i)=>i).filter(i=>i!==q.a && !(hintUsed[idx]||[]).includes(i));
    if(bad.length){ hintUsed[idx] = (hintUsed[idx]||[]).concat(bad[Math.floor(Math.random()*bad.length)]); }
  }
  else if(k==='f'){
    const first = String(q.a||'').trim().charAt(0);
    note('الإجابة تبدأ بحرف: ' + first, 'تلميح', '💡');
  }
  else if(k==='a' || k==='s'){
    const st = built[idx];
    const target = k==='a' ? String(q.w||'').replace(/\s/g,'').split('')
                           : String(q.s||'').trim().split(/\s+/);
    const cur = ans[idx] || [];
    const pos = cur.length;                      // العنصر التالي المطلوب
    if(pos < target.length){
      const want = target[pos];
      const used = {}; cur.forEach(i=>used[i]=1);
      for(let i=0;i<st.pool.length;i++){
        if(st.pool[i]===want && !used[i]){ ans[idx] = cur.concat(i); break; }
      }
    }
  }
  else if(k==='m'){
    const st = built[idx];
    const map = Object.assign({}, ans[idx]||{});
    for(let i=0;i<(q.p||[]).length;i++){
      if(map[i]===undefined){ map[i] = st.right.findIndex(r=>r.i===i); break; }
    }
    ans[idx] = map;
  }
  render();
  updateHintBtn();
}

function updateHintBtn(){
  const b = $('hint-btn');
  const q = HW.q[idx]||{}, k = q.t || 'q';
  const noHelp = (HW.kind === 'style' || HW.kind === 'diag');   // 🚫 لا مساعدة في الاختبارات
  const has = !noHelp && MYPERKS.hint > 0;
  if(has && k!=='tf'){ b.classList.remove('hide'); b.textContent = '💡 تلميح ×' + MYPERKS.hint; }
  else b.classList.add('hide');
  // ✂️ يظهر فقط في سؤال اختيار من متعدد بقي فيه خياران خاطئان على الأقل
  const f = $('fifty-btn'); if(!f) return;
  if(!noHelp && MYPERKS.fifty > 0 && fiftyLeft(q).length >= 2){ f.classList.remove('hide'); f.textContent = '✂️ حذف إجابتين ×' + MYPERKS.fifty; }
  else f.classList.add('hide');
}
function fiftyLeft(q){
  if(!q || (q.t||'q')!=='q' || !Array.isArray(q.o)) return [];
  return q.o.map((_,i)=>i).filter(i=>i!==q.a && !(hintUsed[idx]||[]).includes(i));
}
/* ✂️ حذف إجابتين: يستبعد خيارين خاطئين من السؤال الحالي */
async function useFifty(){
  if(HW.kind === 'style' || HW.kind === 'diag'){ toast('البطاقات لا تعمل في اختبارات القياس','bad'); return; }
  const q = HW.q[idx], bad = fiftyLeft(q);
  if(bad.length < 2){ toast('تعمل في سؤال اختيار من متعدد فيه خياران خاطئان على الأقل','bad'); return; }
  if(!(MYPERKS.fifty > 0)){ toast('لا تملك بطاقة حذف إجابتين','bad'); return; }
  const api = ((HW && HW.api) || API || '').replace(/\/+$/,'');
  try{
    const r = await storeFetch(api + '/use', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name: myName, sid: mySid||'', card:'fifty', hw: HW.id }) });
    const j = await r.json();
    if(!j.ok){ toast(storeErrText(j, 'لا تملك بطاقة حذف إجابتين'),'bad'); return; }
    MYPERKS = j.perks || {};
  }catch(e){ toast('تعذّر الاتصال','bad'); return; }
  const pick = bad.slice().sort(()=>Math.random()-.5).slice(0,2);
  hintUsed[idx] = (hintUsed[idx]||[]).concat(pick);
  render();
  updateHintBtn();
}

function ready(){
  const q = HW.q[idx], k = q.t||'q', a = ans[idx];
  if(k==='q'||k==='tf') return a!==null;
  if(k==='f') return typeof a==='string' && a.trim().length>0;
  if(k==='a') return Array.isArray(a) && a.length===String(q.w||'').replace(/\s/g,'').length;
  if(k==='s') return Array.isArray(a) && a.length===String(q.s||'').trim().split(/\s+/).length;
  if(k==='m') return a && Object.keys(a).length===(q.p||[]).length;
  return a!==null;
}



/* ═══════════════════════════════════════════════════════════════════
   📖 عُدّة الفهم القرائي المشتركة — نسخة مطابقة في بوابة الطالب ولوحة المعلم.
   أي تعديل هنا يُنسخ للملفين حتى تبقى الفقرات وورقة الطباعة واحدة.
   ═══════════════════════════════════════════════════════════════════ */
const RDK_STAGES = [
  ['pre',    '1', 'قبل القراءة',   'أجب قبل قراءة النص: توقّع من العنوان وما تعرفه.'],
  ['during', '2', 'أثناء القراءة', 'ارجع إلى النص وابحث عن الدليل.'],
  ['post',   '3', 'بعد القراءة',   'استنتج وحلّل ما فهمته من النص.'],
  ['apply',  '4', 'التطبيق',       'انقل ما فهمته إلى موقف جديد.']
];
function rdkEsc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function rdkNorm(s){
  return String(s ?? '').replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function rdkIsFormula(line){ return /[=＝]/.test(line) && line.split(/\s+/).length <= 24; }
function rdkIsHeading(line){
  const t = String(line || '').trim();
  if(!t || t.length > 60 || /[=＝]/.test(t) || /[.؟?!:؛،,…]$/.test(t)) return false;
  return t.split(/\s+/).length <= 7;
}

/* بنية النص: عناوين فرعية + معادلات + فقرات مرقّمة.
   نص PDF يأتي غالبًا بعنوان فرعي في سطر مستقل فوق فقرته؛ دمجه في الفقرة كان
   يُخرج «مفهوم السرعة تخيّل أنك…». العنوان والمعادلة لا يأخذان رقم فقرة. */
function rdkBlocks(text, title){
  const t = String(text || '').replace(/\r/g, '').trim();
  if(!t) return [];
  let chunks = t.split(/\n\s*\n+/);
  if(chunks.length === 1 && /\n/.test(t)) chunks = t.split(/\n+/);   // نص قديم: سطر = فقرة
  const out = []; let n = 0;
  chunks.forEach((chunk, ci) => {
    const lines = chunk.split('\n').map(x => x.trim()).filter(Boolean);
    let buf = [];
    const flush = () => { if(buf.length){ out.push({type: 'p', n: ++n, text: buf.join(' ')}); buf = []; } };
    lines.forEach((ln, li) => {
      if(rdkIsFormula(ln)){ flush(); out.push({type: 'formula', text: ln}); return; }
      const headingPlace = li < lines.length - 1 || (lines.length === 1 && ci < chunks.length - 1);
      if(!buf.length && headingPlace && rdkIsHeading(ln)){ out.push({type: 'h', text: ln}); return; }
      buf.push(ln);
    });
    flush();
  });
  const tn = rdkNorm(title);
  if(out[0] && out[0].type === 'h' && tn && rdkNorm(out[0].text) === tn) out.shift();   // العنوان مكررًا في أول النص
  return out;
}
function rdkParagraphs(text){ return rdkBlocks(text).filter(b => b.type === 'p').map(b => b.text); }

/* الترقيم القديم (قبل التعرف على العناوين) — لأنشطة حُفظ دليلها به */
function rdkParagraphsLegacy(text){
  const t = String(text || '').replace(/\r/g, '').trim();
  if(!t) return [];
  let parts = t.split(/\n\s*\n+/).map(x => x.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if(parts.length === 1 && /\n/.test(t)) parts = t.split(/\n+/).map(x => x.trim()).filter(Boolean);
  return parts;
}
/* رقم فقرة الدليل بالترقيم الحالي. الأنشطة الجديدة (pv=2) مباشرة،
   والقديمة تُطابَق بالكلمات مع فقرتها الأصلية حتى لا يُوجَّه الطالب لفقرة خاطئة. */
function rdkEvFor(reading, ev, paras){
  ev = Number(ev);
  if(!(ev >= 1)) return 0;
  if(Number(reading && reading.pv) === 2) return ev <= paras.length ? ev : 0;
  const src = rdkParagraphsLegacy(reading && reading.text)[ev - 1];
  if(!src) return 0;
  const sw = new Set(rdkNorm(src).split(' ').filter(w => w.length > 2));
  let best = 0, bi = 0;
  paras.forEach((p, i) => {
    const pw = rdkNorm(p).split(' ').filter(w => w.length > 2);
    if(!pw.length || !sw.size) return;
    const score = pw.filter(w => sw.has(w)).length / Math.min(pw.length, sw.size);
    if(score > best){ best = score; bi = i + 1; }
  });
  return best >= 0.5 ? bi : 0;
}

/* أكمل الفراغ: السؤال لا يُعرض أبدًا وفيه الإجابة. */
function rdkMaskBlank(q){
  const s = String((q && q.q) || '');
  if(!q || (q.t || 'q') !== 'f' || /_{3,}/.test(s)) return s;
  const a = String(q.a || '').trim();
  return a && s.includes(a) ? s.replace(a, '________') : s;
}

/* خلط ثابت: الورقة نفسها تُطبع بالترتيب نفسه كل مرة */
function rdkShuffle(arr, seedText){
  const out = arr.slice();
  let h = 2166136261;
  for(const ch of String(seedText || '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  for(let i = out.length - 1; i > 0; i--){
    h = Math.imul(h ^ (h >>> 13), 1103515245) + 12345 >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  if(out.length > 1 && out.every((x, i) => x === arr[i])) out.push(out.shift());
  return out;
}

function rdkStemHTML(text){
  return rdkEsc(text).replace(/_{3,}/g, '<span class="rdk-blank"></span>');
}

function rdkQuestionHTML(q, n, answers, paras, reading){
  const k = q.t || 'q';
  const L = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
  let stem = '', body = '', key = '';
  if(k === 'q'){
    const o = Array.isArray(q.o) ? q.o : [];
    const two = o.length && o.every(x => String(x).length <= 30);
    stem = rdkStemHTML(q.q);
    body = `<ol class="rdk-opts${two ? ' two' : ''}">${o.map((x, i) =>
      `<li class="${answers && i === q.a ? 'ok' : ''}"><span class="rdk-box"></span><b>${L[i] || i + 1})</b> ${rdkEsc(x)}</li>`).join('')}</ol>`;
    key = o[q.a];
  } else if(k === 'tf'){
    stem = rdkStemHTML(q.q);
    body = `<div class="rdk-tf"><span class="${answers && q.a === true ? 'ok' : ''}"><i class="rdk-box"></i> صح</span>
      <span class="${answers && q.a === false ? 'ok' : ''}"><i class="rdk-box"></i> خطأ</span></div>`;
    key = q.a ? 'صح' : 'خطأ';
  } else if(k === 'f'){
    const masked = rdkMaskBlank(q);
    stem = rdkStemHTML(masked);
    if(!/_{3,}/.test(masked)) body = '<div class="rdk-line"></div>';
    key = q.a;
  } else if(k === 'a'){
    const letters = Array.from(String(q.w || '').replace(/\s+/g, ''));
    stem = rdkEsc(q.h || 'رتّب الحروف لتكوين الكلمة');
    body = `<div class="rdk-letters">${rdkShuffle(letters, q.w).map(x => `<span>${rdkEsc(x)}</span>`).join('')}</div><div class="rdk-line"></div>`;
    key = q.w;
  } else if(k === 's'){
    const words = String(q.s || '').trim().split(/\s+/);
    stem = 'رتّب الكلمات لتكوين جملة صحيحة';
    body = `<div class="rdk-letters words">${rdkShuffle(words, q.s).map(x => `<span>${rdkEsc(x)}</span>`).join('')}</div><div class="rdk-line"></div>`;
    key = q.s;
  } else if(k === 'm'){
    const p = Array.isArray(q.p) ? q.p : [];
    const right = rdkShuffle(p.map(x => x[1]), JSON.stringify(p));
    stem = 'صِل كل عبارة بما يناسبها بكتابة الرقم بين القوسين';
    body = `<table class="rdk-match"><tbody>${p.map((pr, i) =>
      `<tr><td><b>${i + 1}.</b> ${rdkEsc(pr[0])}</td><td>(<span class="rdk-mnum">${answers ? p.findIndex(x => x[1] === right[i]) + 1 : ''}</span>) ${rdkEsc(right[i])}</td></tr>`).join('')}</tbody></table>`;
    key = '';
  } else {
    stem = rdkStemHTML(q.q || '');
    body = '<div class="rdk-line"></div>';
  }
  const ev = rdkEvFor(reading, q.ev, paras);
  const keyLine = answers && (key || ev || q.sk)
    ? `<div class="rdk-key">${key ? `✓ ${rdkEsc(key)}` : ''}${ev ? `<span>الدليل: الفقرة ${ev}</span>` : ''}${q.sk ? `<span>${rdkEsc(q.sk)}</span>` : ''}</div>` : '';
  return `<div class="rdk-q"><div class="rdk-qh"><span class="rdk-n">${n}</span><div class="rdk-qt">${stem}</div></div>${body}${keyLine}</div>`;
}

/* ورقة A4 كاملة: أسئلة قبل القراءة ← النص ← الكلمات ← بقية المراحل */
function rdkWorksheetHTML(act, opts){
  const answers = !!(opts && opts.answers);
  const reading = (act && act.reading) || {};
  const blocks = rdkBlocks(reading.text, act.title);
  const paras = blocks.filter(b => b.type === 'p').map(b => b.text);
  const qs = Array.isArray(act.q) ? act.q : [];
  const vocab = Array.isArray(reading.vocab) ? reading.vocab.filter(v => v && v.w) : [];
  const groups = {pre: [], during: [], post: [], apply: []};
  qs.forEach(q => (groups[RDK_STAGES.some(s => s[0] === q.stage) ? q.stage : 'during']).push(q));
  let n = 0;
  const section = ([id, icon, title, hint]) => groups[id].length
    ? `<section class="rdk-stage"><div class="rdk-sec"><span class="rdk-si">${icon}</span><b>${title}</b><small>${hint}</small></div>
        ${groups[id].map(q => rdkQuestionHTML(q, ++n, answers, paras, reading)).join('')}</section>` : '';
  const title = rdkEsc(act.title || 'نشاط فهم قرائي');
  const meta = [act.subject, act.cls].filter(Boolean).map(rdkEsc).join(' — ');
  return `<article class="rdk" dir="rtl">
    <header class="rdk-head">
      ${act.logo ? `<div class="rdk-logo">${act.logo}</div>` : ''}
      <div class="rdk-ttl"><span>ورقة عمل — الفهم القرائي${answers ? ' — نموذج الإجابة' : ''}</span><h1>${title}</h1>${meta ? `<small>${meta}</small>` : ''}</div>
    </header>
    <div class="rdk-info">
      <div>اسم الطالب<b>${rdkEsc(act.studentName || '')}</b></div>
      <div>الفصل<b>${rdkEsc(act.cls || '')}</b></div>
      <div>التاريخ<b></b></div>
      <div>الدرجة<b class="rdk-score">/ ${qs.length}</b></div>
    </div>
    ${section(RDK_STAGES[0])}
    ${blocks.length ? `<section class="rdk-passage">
      <div class="rdk-sec"><span class="rdk-si rdk-si-text">النص</span><b>النص القرائي</b><small>الأرقام تشير إلى الفقرات.</small></div>
      <h2 class="rdk-ptitle">${title}</h2>
      ${blocks.map(b => b.type === 'h' ? `<h3 class="rdk-sub">${rdkEsc(b.text)}</h3>`
        : b.type === 'formula' ? `<div class="rdk-formula">${rdkEsc(b.text)}</div>`
        : `<p><span class="rdk-pn">${b.n}</span>${rdkEsc(b.text)}</p>`).join('')}
    </section>` : ''}
    ${vocab.length ? `<div class="rdk-vocab"><b>كلمات مفتاحية</b><dl>${vocab.map(v =>
      `<div><dt>${rdkEsc(v.w)}</dt><dd>${rdkEsc(v.m || '')}</dd></div>`).join('')}</dl></div>` : ''}
    ${RDK_STAGES.slice(1).map(section).join('')}
    <footer class="rdk-foot"><span>${title}</span><span>${answers ? 'نموذج الإجابة — للمعلم' : 'اقرأ بتمعّن، وارجع إلى النص قبل أن تجيب.'}</span></footer>
  </article>`;
}
/* ═══ نهاية عُدّة الفهم القرائي المشتركة ═══ */


/* ═══ 📖 لوحة النص القرائي للطالب ═══
   • قبل القراءة: النص مخفي — السؤال مبني على العنوان والخبرة.
   • بعدها: النص في صندوق قابل للتمرير بطول محدود، فيبقى السؤال ظاهرًا.
   • لا يُعاد بناء النص عند كل ضغطة إجابة، فلا يقفز موضع القراءة.
   • زر «ارجع إلى الفقرة» يفتح الفقرة التي فيها الدليل ويبرزها. */
const RDX_FS_KEY = 'rdx_font_step_v1';
const RDX_FS = [0.92, 1.02, 1.14, 1.28];
function rdxFontStep(){ try{ const v = parseInt(localStorage.getItem(RDX_FS_KEY), 10); return v >= 0 && v < RDX_FS.length ? v : 1; }catch(e){ return 1; } }
function rdxCollapsedKey(){ return 'rdx_collapsed_' + ((HW && (HW.id || HW.sid)) || 'x'); }
function rdxIsCollapsed(){ try{ return localStorage.getItem(rdxCollapsedKey()) === '1'; }catch(e){ return false; } }

function rdxMode(reading, q){
  if(!reading || !String(reading.text || '').trim()) return 'none';
  const hasLater = Array.isArray(HW.q) && HW.q.some(x => x && x.stage && x.stage !== 'pre');
  return (q && q.stage === 'pre' && hasLater) ? 'locked' : 'open';
}

function rdxHTML(reading, q, mode){
  const title = esc(HW.t || 'النص القرائي');
  if(mode === 'locked'){
    return `<div class="rdx-locked" role="note"><span class="rdx-locked-ic">🎯</span>
      <div><b>قبل القراءة — النص لم يُفتح بعد</b>
      <span>عنوان النص: «${title}». أجب اعتمادًا على العنوان وما تعرفه، وسيظهر النص عندما تصل إلى «أثناء القراءة».</span></div></div>`;
  }
  const blocks = rdkBlocks(reading.text, HW.t);
  const paras = blocks.filter(b => b.type === 'p').map(b => b.text);
  const vocab = Array.isArray(reading.vocab) ? reading.vocab.filter(v => v && v.w) : [];
  const ev = rdkEvFor(reading, q && q.ev, paras);
  const collapsed = rdxIsCollapsed();
  return `<section class="rdx${collapsed ? ' collapsed' : ''}" aria-label="النص القرائي">
      <div class="rdx-bar">
        <b>📖 النص القرائي</b><small>${paras.length} فقرات</small>
        <span class="rdx-sp"></span>
        <button type="button" class="rdx-tool" data-rdx="smaller" aria-label="تصغير الخط">أ−</button>
        <button type="button" class="rdx-tool" data-rdx="bigger" aria-label="تكبير الخط">أ+</button>
        <button type="button" class="rdx-tool" data-rdx="print" aria-label="طباعة النص والأسئلة">🖨️</button>
        <button type="button" class="rdx-tool rdx-toggle" data-rdx="toggle" aria-expanded="${!collapsed}">${collapsed ? 'إظهار النص' : 'إخفاء'}</button>
      </div>
      <div class="rdx-body" style="--rdx-fs:${RDX_FS[rdxFontStep()]}rem">
        <h3 class="rdx-title">${title}</h3>
        ${blocks.map(b => b.type === 'h' ? `<h4 class="rdx-sub">${esc(b.text)}</h4>`
          : b.type === 'formula' ? `<div class="rdx-formula">${esc(b.text)}</div>`
          : `<p class="rdx-p" data-p="${b.n}"><span class="rdx-n">${b.n}</span>${esc(b.text)}</p>`).join('')}
        ${vocab.length ? `<details class="rdx-vocab"><summary>📚 كلمات مفتاحية (${vocab.length})</summary><dl>${vocab.map(v =>
          `<div><dt>${esc(v.w)}</dt><dd>${esc(v.m || '')}</dd></div>`).join('')}</dl></details>` : ''}
      </div>
    </section>
    ${ev ? `<button type="button" class="rdx-ev" data-rdx="ev" data-ev="${ev}">🔎 الدليل في الفقرة ${ev} — اضغط للرجوع إليها</button>` : ''}`;
}

function rdxPrint(){
  const reading = HW && (HW.reading || HW.rt);
  const ws = document.getElementById('ws');
  if(!reading || !ws) return;
  ws.innerHTML = rdkWorksheetHTML({
    title: HW.t, cls: HW.cls || '', reading, q: HW.q || [],
    studentName: String(myName || (typeof lockedName === 'function' ? lockedName() : '') || ''),
    logo: typeof MOE_LOGO !== 'undefined' ? MOE_LOGO : ''
  }, { answers: false });
  window.print();
}

function rdxOnClick(e){
  const btn = e.target.closest('[data-rdx]');
  if(!btn) return;
  const box = document.getElementById('reading-passage-box');
  const sec = box && box.querySelector('.rdx');
  const body = sec && sec.querySelector('.rdx-body');
  const act = btn.dataset.rdx;
  if(act === 'print'){ rdxPrint(); return; }
  if(!sec || !body) return;
  if(act === 'smaller' || act === 'bigger'){
    const step = Math.max(0, Math.min(RDX_FS.length - 1, rdxFontStep() + (act === 'bigger' ? 1 : -1)));
    try{ localStorage.setItem(RDX_FS_KEY, String(step)); }catch(_){}
    body.style.setProperty('--rdx-fs', RDX_FS[step] + 'rem');
    return;
  }
  const setCollapsed = c => {
    sec.classList.toggle('collapsed', c);
    try{ localStorage.setItem(rdxCollapsedKey(), c ? '1' : '0'); }catch(_){}
    const t = sec.querySelector('.rdx-toggle');
    if(t){ t.textContent = c ? 'إظهار النص' : 'إخفاء'; t.setAttribute('aria-expanded', String(!c)); }
  };
  if(act === 'toggle'){ setCollapsed(!sec.classList.contains('collapsed')); return; }
  if(act === 'ev'){
    setCollapsed(false);
    const p = body.querySelector(`.rdx-p[data-p="${btn.dataset.ev}"]`);
    if(!p) return;
    sec.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    body.scrollTop = Math.max(0, p.offsetTop - body.offsetTop - 8);
    p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash');
    setTimeout(() => p.classList.remove('flash'), 2600);
  }
}

function renderReadingPanel(reading, q){
  const box = document.getElementById('reading-passage-box');
  if(!box) return;
  const mode = rdxMode(reading, q);
  const key = mode === 'none' ? 'none' : `${(HW && (HW.id || HW.sid)) || ''}|${mode}|${mode === 'open' ? (q && q.ev) || '' : ''}`;
  if(box.dataset.rdxKey === key) return;   // نفس الحالة: لا نعيد البناء فيبقى موضع القراءة
  const oldBody = box.querySelector('.rdx-body');
  const keepScroll = oldBody ? oldBody.scrollTop : 0;
  box.innerHTML = mode === 'none' ? '' : rdxHTML(reading, q, mode);
  box.dataset.rdxKey = key;
  box.onclick = rdxOnClick;
  const nb = box.querySelector('.rdx-body');
  if(nb && keepScroll) nb.scrollTop = keepScroll;
}

const READING_STAGES = {
  pre: { icon:'🎯', title:'قبل القراءة', short:'تهيئة وتوقع' },
  during: { icon:'📖', title:'أثناء القراءة', short:'دليل وفهم' },
  post: { icon:'🧠', title:'بعد القراءة', short:'استنتاج وتحليل' },
  apply: { icon:'🔬', title:'التطبيق', short:'نقل الفهم' }
};
const READING_STAGE_ORDER = ['pre','during','post','apply'];

function readingStageGroups(){
  const groups = {pre:[], during:[], post:[], apply:[]};
  if(!HW || !Array.isArray(HW.q)) return groups;
  HW.q.forEach((q,i)=>{
    const stage = READING_STAGE_ORDER.includes(q.stage) ? q.stage : 'during';
    groups[stage].push(i);
  });
  return groups;
}

function readingStageDone(stage, groups){
  return groups[stage].length > 0 &&
    groups[stage].every(i => ans[i] !== null && ans[i] !== undefined);
}

function readingStagePercent(stage, groups){
  const items = groups[stage];
  if(!items.length) return null;
  const correct = items.reduce((n,i)=>n+(grade(HW.q[i],ans[i],built[i])?1:0),0);
  return Math.round(correct/items.length*100);
}

function renderReadingJourney(){
  const host=$('reading-journey');
  const panel=$('reading-stage-panel');
  if(!host || !panel || !HW || HW.kind!=='reading'){
    if(host) host.classList.remove('visible');
    if(panel) panel.classList.remove('visible');
    return;
  }

  const groups=readingStageGroups();
  const current=readingCurrentStageName();
  const currentIndex=READING_STAGE_ORDER.indexOf(current);
  const completedCount=READING_STAGE_ORDER.filter(s=>readingStageDone(s,groups)).length;
  const availableCount=READING_STAGE_ORDER.filter(s=>groups[s].length).length;
  const journeyPercent=Math.round((completedCount/Math.max(1,availableCount))*100);

  host.classList.add('visible');
  host.innerHTML=`
    <div class="reading-journey-title">
      <div>
        <strong>📚 خريطة الفهم القرائي</strong>
        <small>رحلتك: من التهيئة إلى تطبيق ما فهمته</small>
      </div>
      <span class="reading-journey-percent">${journeyPercent}%</span>
    </div>
    <div class="reading-journey-line">
      ${READING_STAGE_ORDER.map((stage,i)=>{
        const info=READING_STAGES[stage];
        const has=groups[stage].length>0;
        const done=readingStageDone(stage,groups);
        const currentClass=stage===current?' current':'';
        const doneClass=done?' done':'';
        const locked=!has || i>currentIndex?' locked':'';
        const status=done?'✓':has?(i+1):'—';
        return `<button type="button" class="reading-step${currentClass}${doneClass}${locked}"
          data-reading-jump="${stage}" ${(!has||i>currentIndex)?'disabled':''}>
          <span class="reading-step-circle">${done?status:info.icon}</span>
          <strong>${info.title}</strong>
          <small>${info.short}</small>
        </button>`;
      }).join('')}
    </div>`;

  panel.classList.add('visible');
  const info=READING_STAGES[current];
  const total=groups[current].length;
  const answered=groups[current].filter(i=>ans[i]!==null&&ans[i]!==undefined).length;
  panel.innerHTML=`
    <span class="stage-icon">${info.icon}</span>
    <div>
      <strong>أنت الآن في: ${info.title}</strong>
      <small>${info.short} · أنجزت ${answered} من ${total} مهام في هذه المحطة.</small>
    </div>`;

  host.querySelectorAll('[data-reading-jump]').forEach(btn=>{
    btn.onclick=()=>{
      const stage=btn.dataset.readingJump;
      const first=groups[stage][0];
      if(first===undefined) return;
      idx=first;
      render();
      toTop(true);
    };
  });
}

function readingCurrentStageName(){
  const q=HW && HW.q ? HW.q[idx] : null;
  return q && READING_STAGE_ORDER.includes(q.stage) ? q.stage : 'during';
}

function isReadingActivity(){ return !!(HW && HW.kind === 'reading'); }

function render(){
  if(PACE.cur !== idx) paceEnter(idx);
  const q = HW.q[idx], k = q.t||'q', B = $('q-body');
  const reading = HW && HW.kind === 'reading' ? (HW.reading || HW.rt || null) : null;
  const stageLabels = {pre:'🎯 قبل القراءة',during:'📖 أثناء القراءة',post:'🧠 بعد القراءة',apply:'🔬 التطبيق'};
  if (HW && HW.kind === 'reading') renderReadingJourney();
  const stageBox = $('reading-stage');
  renderReadingPanel(reading, q);
  if(stageBox) stageBox.textContent = isReadingActivity() ? '' : (stageLabels[q.stage] || '');
  $('q-kind').textContent = KINDS[k] || '';
  // 🩹 تذكير المفهوم في المهمة العلاجية الشخصية (لا يكشف الإجابة)
  { let tipBox=$('rem-tip'); if(!tipBox){ const kb=$('q-kind'); const sh=kb&&kb.closest('.sheet'); if(sh){ sh.insertAdjacentHTML('afterbegin','<div id="rem-tip" class="rem-tip hide"></div>'); tipBox=$('rem-tip'); } }
    if(tipBox){ const tip = HW && HW.personalRemedial && q.tip ? String(q.tip) : ''; tipBox.textContent = tip ? '💡 تذكير: ' + tip : ''; tipBox.classList.toggle('hide', !tip); } }
  $('bar-count').textContent = `${idx+1}/${HW.q.length}`;
  $('prog-i').style.width = (idx/HW.q.length*100)+'%';
  $('q-text').textContent = k==='a' ? (q.h || 'رتّب الحروف لتكوين الكلمة')
                          : k==='s' ? 'رتّب الكلمات لتكوين جملة صحيحة'
                          : k==='m' ? 'اضغط كلمة من اليمين ثم ما يقابلها'
                          : k==='f' ? rdkMaskBlank(q)
                          : (q.q || '');

  if(k==='q'){
    const gone = hintUsed[idx] || [];
    B.innerHTML = (q.o||[]).map((o,i)=> gone.includes(i) ? ''
      : `<button class="opt${ans[idx]===i?' sel':''}" data-i="${i}">${esc(o)}</button>`).join('');
    [...B.children].forEach(b=>b.onclick=()=>{ ans[idx]=+b.dataset.i; render(); });
  }
  else if(k==='tf'){
    B.innerHTML = `<div class="tf">
      <button data-v="1" class="${ans[idx]===true?'sel':''}">&#10003; صح</button>
      <button data-v="0" class="${ans[idx]===false?'sel':''}">&#10007; خطأ</button></div>`;
    [...B.querySelectorAll('button')].forEach(b=>b.onclick=()=>{ ans[idx]=b.dataset.v==='1'; render(); });
  }
  else if(k==='f'){
    B.innerHTML = `<input class="inp" id="fill-in" placeholder="اكتب الإجابة" value="${esc(ans[idx]||'')}">`;
    const el = $('fill-in');
    el.oninput = ()=>{ ans[idx]=el.value; $('q-next').disabled = !ready() || paceLeftMs() > 0; };
    setTimeout(()=>el.focus(),50);
  }
  else if(k==='a' || k==='s'){
    const st = built[idx];
    const chosen = ans[idx] || [];
    const used = {}; chosen.forEach(i=>used[i]=1);
    B.innerHTML = `<div class="slots">${
      chosen.length ? chosen.map(i=>`<span class="slot">${esc(st.pool[i])}</span>`).join('')
                    : '<span class="muted">اضغط بالترتيب</span>'}</div>
      <div class="chips">${st.pool.map((t,i)=>
        `<button class="chip" data-i="${i}" ${used[i]?'disabled':''}>${esc(t)}</button>`).join('')}</div>
      <button class="btn ghost" style="margin-top:.7rem" id="undo">تراجع</button>`;
    [...B.querySelectorAll('.chip')].forEach(b=>b.onclick=()=>{
      ans[idx] = (ans[idx]||[]).concat(+b.dataset.i); render();
    });
    $('undo').onclick = ()=>{ ans[idx]=(ans[idx]||[]).slice(0,-1); render(); };
  }
  else if(k==='m'){
    const st = built[idx];
    const map = ans[idx] || {};
    B.innerHTML = `<div class="pairs">
      <div>${(q.p||[]).map((p,i)=>
        `<button class="pair-btn ${map[i]!==undefined?'done':(st.pick===i?'sel':'')}" data-l="${i}">${esc(p[0])}</button>`).join('')}</div>
      <div>${st.right.map((r,j)=>{
        const taken = Object.values(map).indexOf(j)!==-1;
        return `<button class="pair-btn ${taken?'done':''}" data-r="${j}" ${taken?'disabled':''}>${esc(r.t)}</button>`;
      }).join('')}</div></div>
      <button class="btn ghost" style="margin-top:.6rem" id="undo">مسح المحاولة</button>`;
    [...B.querySelectorAll('[data-l]')].forEach(b=>b.onclick=()=>{
      const i=+b.dataset.l; if(map[i]!==undefined) return;
      st.pick = st.pick===i ? null : i; render();
    });
    [...B.querySelectorAll('[data-r]')].forEach(b=>b.onclick=()=>{
      if(st.pick===null || st.pick===undefined) return;
      const m = Object.assign({}, map); m[st.pick] = +b.dataset.r;
      ans[idx]=m; st.pick=null; render();
    });
    $('undo').onclick = ()=>{ ans[idx]=null; st.pick=null; render(); };
  }

  updateHintBtn();
  $('q-prev').disabled = idx===0;
  $('q-next').textContent = idx===HW.q.length-1 ? 'إنهاء وتسليم' : 'التالي';
  $('q-next').disabled = !ready();
  paceTick();
}

$('q-prev').onclick = ()=>{ if(idx>0){ idx--; render(); toTop(true); } };
$('q-next').onclick = ()=>{ if(!ready() || paceLeftMs() > 0) return; if(idx<HW.q.length-1){ idx++; render(); toTop(true); } else finish(); };

// 🧠 اختبار أنماط التعلّم: لا صواب ولا خطأ
const isStyleHW = () => (HW && HW.kind) === 'style';

function grade(q, a, st){
  if(isStyleHW()) return a !== null && a !== undefined;   // يكفي أن يجيب
  const k = q.t||'q';
  if(k==='q')  return a===q.a;
  if(k==='tf') return a===!!q.a;
  if(k==='f')  return norm(a)===norm(q.a);
  if(k==='a')  return (a||[]).map(i=>st.pool[i]).join('') === String(q.w||'').replace(/\s/g,'');
  if(k==='s')  return (a||[]).map(i=>st.pool[i]).join(' ') === String(q.s||'').trim().replace(/\s+/g,' ');
  if(k==='m'){
    const pairs = q.p||[];
    return pairs.every((p,i)=> a && st.right[a[i]] && st.right[a[i]].i === i);
  }
  return false;
}

// نص الإجابة الصحيحة لعرضها في المراجعة
function rightAnswer(q){
  const k=q.t||'q';
  if(k==='q')  return q.o[q.a];
  if(k==='tf') return q.a ? 'صح' : 'خطأ';
  if(k==='f')  return q.a;
  if(k==='a')  return q.w;
  if(k==='s')  return q.s;
  if(k==='m')  return (q.p||[]).map(p=>`${p[0]} ← ${p[1]}`).join(' · ');
  return '';
}
// ما اختاره الطالب
function myAnswer(q, a, st){
  const k=q.t||'q';
  try{
    if(k==='q')  return (a===null||a===undefined) ? '—' : q.o[a];
    if(k==='tf') return a===true ? 'صح' : a===false ? 'خطأ' : '—';
    if(k==='f')  return a || '—';
    if(k==='a')  return (a||[]).map(i=>st.pool[i]).join('') || '—';
    if(k==='s')  return (a||[]).map(i=>st.pool[i]).join(' ') || '—';
    if(k==='m')  return (q.p||[]).map((p,i)=>`${p[0]} ← ${(a&&st.right[a[i]])?st.right[a[i]].t:'—'}`).join(' · ');
  }catch(e){}
  return '—';
}

/* 🔒 هل يجوز كشف الإجابات الآن؟
   قبل موعد الإغلاق لا تُكشف: أول طالب يسلّم كان يحصل على إجابات الفصل كاملة،
   وكانت بطاقة «مراجعة مبكرة» تبيع ما يأخذه الجميع مجانًا. الخادم (/review)
   يطبّق القاعدة نفسها، فتتطابق الشاشتان. */
function reviewOpenNow(){
  const d = String((typeof HW!=='undefined' && HW && HW.d) || '').trim();
  if(!d) return true;                        // نشاط بلا موعد إغلاق: لا شيء نحجبه
  return d < new Date().toISOString().slice(0,10);
}
function renderReviewLocked(marks){
  const wrong = marks.filter(m=>!m).length;
  const can = Number(MYPERKS && MYPERKS.early || 0) > 0;
  $('review').innerHTML = `<div style="margin-top:1.2rem">
    <div class="sheet center" style="padding:1.1rem 1rem">
      <div style="font-size:1.7rem">🔒</div>
      <h3 style="margin:.35rem 0 .25rem">تُفتح مراجعة أخطائك بعد ${esc(HW.d)}</h3>
      <p class="muted" style="margin:0;font-size:.87rem;line-height:1.7">
        ${wrong ? `لديك ${wrong} ${wrong===1?'إجابة تحتاج':'إجابات تحتاج'} مراجعة.`
                : 'كل إجاباتك صحيحة 🎉'}<br>
        الإجابات الصحيحة تظهر بعد إغلاق النشاط، حتى لا تصل لزملائك قبل حلّه.</p>
      ${can ? `<button class="btn" id="rv-early" style="margin-top:.8rem">🔓 استخدم «مراجعة مبكرة» ×${MYPERKS.early}</button>` : ''}
    </div></div>`;
  const b = $('rv-early');
  if(b) b.onclick = async ()=>{
    b.disabled = true;
    if(await useEarlyReview(HW.id, myName)) renderReview(marks);
    else b.disabled = false;
  };
}
function renderReview(marks){
  const wrong = marks.filter(m=>!m).length;
  const head = wrong
    ? `<h3 style="margin-bottom:.2rem">راجع أخطاءك (${wrong})</h3>
       <p class="muted" style="margin:0 0 .8rem">اقرأ الإجابة الصحيحة جيداً — قد تأتيك في الاختبار.</p>`
    : `<h3 style="margin-bottom:.8rem">ممتاز! كل إجاباتك صحيحة 🎉</h3>`;
  const items = HW.q.map((q,i)=>{
    const ok = marks[i];
    const label = KINDS[q.t||'q'] || '';
    const title = (q.t==='a') ? (q.h||'رتّب الحروف') : (q.t==='s') ? 'رتّب الجملة'
                : (q.t==='m') ? 'وصّل' : (q.q||'');
    return `<div class="sheet" style="border-inline-start:4px solid ${ok?'var(--tick)':'var(--pen)'};padding:.85rem 1rem">
      <div class="muted" style="font-size:.75rem;margin-bottom:.25rem">${i+1}. ${label} ${ok?'✓':'✗'}</div>
      <div style="font-weight:700;margin-bottom:.35rem">${esc(title)}</div>
      ${ok ? '' : `<div style="font-size:.9rem;color:var(--pen)">إجابتك: ${esc(myAnswer(q, ans[i], built[i]))}</div>`}
      <div style="font-size:.9rem;color:var(--tick)">الصحيح: ${esc(rightAnswer(q))}</div>
    </div>`;
  }).join('');
  $('review').innerHTML = `<div style="margin-top:1.2rem">${head}${items}</div>`;
}

function makeCode(hwId, si, correct, total){
  const b36=(n,w)=>n.toString(36).toUpperCase().padStart(w,'0');
  const body = String(hwId||'0000').toUpperCase().slice(0,4).padStart(4,'0')+b36(si,2)+b36(correct,2)+b36(total,2);
  let h=7; for(const ch of body+(HW.k||'')) h=(h*31+ch.charCodeAt(0))%1296;
  return (body+b36(h,2)).match(/.{1,4}/g).join('-');
}

async function finish(){
  const marks = HW.q.map((q,i)=>grade(q, ans[i], built[i]));
  const correct = marks.filter(Boolean).length;
  const total = HW.q.length;
  const pts = Math.round((HW.p||0)*correct/total);

  hide('s-quiz'); show('s-done');
  $('done-name').textContent = myName;
  // 🧠 أنماط التعلّم: أظهر نمطه لا درجته
  if(isStyleHW()){
    const TAGS = ['بصري','سمعي','حركي','قرائي/كتابي'];
    const ICO  = { 'بصري':'👁️','سمعي':'👂','حركي':'✋','قرائي/كتابي':'📖' };
    const tally = {};
    HW.q.forEach((q,i)=>{
      const pick = ans[i];
      if(pick === null || pick === undefined) return;
      const tag = (q.tags && q.tags[pick]) || TAGS[pick];
      if(tag) tally[tag] = (tally[tag]||0) + 1;
    });
    const rows = Object.entries(tally).sort((a,b)=>b[1]-a[1]);
    const sum  = rows.reduce((n,x)=>n+x[1],0) || 1;
    const top  = rows.length ? rows[0][0] : '';
    const styleRowsForJourney = rows.map(([k,c])=>[k, Math.round(c/sum*100)]);
    journeyStyleSet(myName, { top, rows: styleRowsForJourney, completedAt:new Date().toISOString() });
    try{
      const journeyBox=$('student-journey');
      if(journeyBox && !journeyBox.classList.contains('hide')){
        const jr=[...(Array.isArray(window.__journeyRows)?window.__journeyRows:[])];
        const idx=jr.findIndex(h=>String(h.id)===String(HW.id));
        if(idx>=0) jr[idx].done=true; else jr.push({...HW,done:true});
        window.__journeyRows=jr;
        loadStudentJourney(jr);
      }
    }catch(e){}
    $('done-score').style.fontSize = '2.2rem';
    $('done-score').textContent = `${ICO[top]||''} ${top}`;
    $('done-line').innerHTML = rows.map(([k,c])=>
      `${ICO[k]||''} ${esc(k)} ${Math.round(c/sum*100)}%`).join(' · ')
      + '<br><span style="font-size:.85rem">هذي طريقتك المفضّلة في التعلّم</span>';
  } else {
    $('done-score').textContent = `${correct}/${total}`;
  const gMax = HW.mx || total;
  const myGrade = Math.round(gMax * correct / Math.max(1,total));   // لا تسمّه grade — يحجب دالة التصحيح
  $('done-line').textContent = HW.kind === 'diag'
    ? `أجبت ${correct} من ${total} — شكراً، هذا يساعد معلمك على تحديد مستواك 🔍`
    : (pts ? `درجتك ${myGrade} من ${gMax} · ${pts} نقطة للمتجر` : 'راجع الدرس وحاول مرة أخرى');
  }
  if(!isStyleHW()){
    if(reviewOpenNow()) renderReview(marks);
    else renderReviewLocked(marks);
  }
  // 🔒 علامة القفل تُكتب بعد أن يؤكد الخادم الاستلام (لا قبلها) — وإلا حُجب الطالب ولم تصل إجاباته
  const detail = marks.map(m=>m?'1':'0').join('');

  const api = ((HW && HW.api) || API || '').replace(/\/+$/,'');
  if(api){
    const s = $('sent-line');
    const trySend = async () => {
    s.textContent = 'جارٍ التسليم…';
    for(let n=1;n<=3;n++){
      try{
        const r = await fetch(api+'/submit',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({hw:HW.id,name:myName,sid:mySid||'',correct,total,pts,d:detail,dev:devId(),
            secs: startedAt ? Math.round((Date.now()-startedAt)/1000) : 0,
            ans: HW.q.map((q,i)=>{
              const k=q.t||'q', st=built[i], a=ans[i];
              if(k==='a'||k==='s') return (a||[]).map(x=>st.pool[x]);
              if(k==='m') return (q.p||[]).map((p,x)=>(a&&st.right[a[x]])?st.right[a[x]].t:null);
              return a;
            })})});
        const j = await r.json();
        // نشاط محذوف أو رابط قديم: خطأ نهائي لا يُصلحه تكرار المحاولة،
        // والطالب يستحق سببًا واضحًا بدل «تعذّر الاتصال».
        if(r.status===404 || (j && j.noActivity)){
          s.textContent = 'هذا النشاط لم يعد متاحًا — أخبر معلمك ولا تعد الحل';
          show('code-wrap');
          $('done-code').textContent = makeCode(HW.id, me, correct, total);
          return;
        }
        if(r.status===429 && j && j.error==='too_fast'){
          const w = Math.max(1000, Number(j.waitMs)||3000);
          s.textContent = `⏳ أسرعت قليلًا — يُسلَّم تلقائيًا بعد ${Math.ceil(w/1000)} ثوانٍ…`;
          await new Promise(res=>setTimeout(res, w));
          n--; continue;                                   // لا تُحسب محاولة فاشلة
        }
        if(r.status===409 || (j && j.ambiguous)){
          s.textContent = 'يوجد أكثر من طالب بهذا الاسم — افتح البوابة الرئيسية واختر اسمك';
          return;
        }
        if(!r.ok||!j.ok) throw 0;
        markDone(myName);           // ✅ وصل للخادم — الآن فقط يُقفل على هذا الجهاز
        hide('code-wrap');
        s.textContent = j.already ? 'نشاطك مُسلّم مسبقاً ✅' : (HW && HW.personalRemedial ? 'سُجّلت محاولتك ✅' : 'وصلت نتيجتك للمعلم ✅');
        // 🩹 العلاج التلقائي: رسالة واضحة ولطيفة بلا إحراج
        if(j.remedial){
          const R=j.remedial, msg = R.status==='created' ? '🩹 جهّزنا لك مهمة تعزيز قصيرة بأسئلة جديدة على ما أخطأت فيه. تجدها في «🎯 طوّر مستواك». لا تؤثر في درجتك.'
            : R.status==='mastered' ? '🌟 أحسنت! أتقنت المهارة التي كانت تحتاج تعزيزًا.'
            : R.status==='retry' ? '💪 قريب! جهّزنا لك محاولة ثانية بأسئلة مختلفة في «🎯 طوّر مستواك».'
            : R.status==='escalated' ? '🤝 معلمك سيساعدك في هذه المهارة بنفسه.' : '';
          if(msg) $('done-line').textContent = msg;
        }
        if(j.mult === 2){
          $('done-line').textContent = `⭐ نقاط مضاعفة! حصلت على ${pts*2} نقطة بدل ${pts}`;
        }
        loadStore();
        offerMore(myName);          // 📚 أخبره ببقية أنشطته
        return;
      }catch(e){ if(n<3) await new Promise(r=>setTimeout(r,900*n)); }
    }
    // لم يصل: لا قفل على الجهاز، وزر لإعادة الإرسال بالإجابات نفسها (لا يحتاج الحل من جديد)
    s.innerHTML = 'تعذّر الاتصال — لم تصل إجاباتك بعد. <button type="button" id="resend-btn" class="btn" style="margin-top:.5rem;width:100%">🔄 أعد الإرسال</button>'
      + '<span style="display:block;font-size:.8rem;margin-top:.35rem">تأكد من الإنترنت ثم اضغط. إن استمر الخطأ أرِ معلمك الرمز بالأسفل.</span>';
    const rb = document.getElementById('resend-btn'); if(rb) rb.onclick = () => { rb.disabled = true; trySend(); };
    show('code-wrap');
    $('done-code').textContent = makeCode(HW.id, me, correct, total);
    };
    await trySend();
    return;
  }
  markDone(myName);                 // بلا خادم: القفل المحلي هو الوحيد المتاح
  show('code-wrap');
  $('done-code').textContent = makeCode(HW.id, me, correct, total);
}

/* 📖 متجر النشاطات — رصيد الطالب وبطاقاته */
// مرتّبة من الأغلى إلى الأرخص
const CARDS = [
  { id:'exam3',   name:'رفع الاختبار +3', price:1000, ic:'🏆', teacher:false, examBonus:3,
    d:'ترفع درجة الاختبارات 3 درجات إذا كان المتبقي المسموح لك يكفي' },
  { id:'exam2',   name:'رفع الاختبار +2', price:750,  ic:'🥈', teacher:false, examBonus:2,
    d:'ترفع درجة الاختبارات درجتين إذا كان المتبقي المسموح لك يكفي' },
  { id:'exam1',   name:'رفع الاختبار +1', price:450,  ic:'🥉', teacher:false, examBonus:1,
    d:'ترفع درجة الاختبارات درجة واحدة إذا كان المتبقي المسموح لك يكفي' },
  { id:'exam05',  name:'رفع الاختبار +0.5', price:250, ic:'⭐', teacher:false, examBonus:.5,
    d:'ترفع درجة الاختبارات نصف درجة إذا كان المتبقي المسموح لك يكفي' },
  { id:'hwforgive', name:'مسح خصم واجب الفصل', price:500, ic:'📘', mad:true,
    d:'تمسح خصم واجب فصل رُصد عليك «لم ينجز» بعد أسبوع السماح — تختار الواجب قبل الدفع' },
  { id:'madforgive', name:'مسح خصم مدرستي', price:500, ic:'🧽', mad:true,
    d:'تمسح خصم واجب في منصة مدرستي أُغلق ولم تحله — تختار الواجب قبل الدفع' },
  { id:'cert', name:'شهادة شكر وتقدير', price:600, ic:'🏅',
    d:'شهادة رسمية باسمك بنص معلمك وتوقيعه — تظهر فورًا في «شهاداتي» لتحفظها أو تطبعها' },
  { id:'avatars', name:'رموز حصرية', price:250, ic:'🐉', once:true,
    d:'12 صورة رمزية ذهبية لا يملكها غيرك: 🐉🦄👑🧙🥷🪐 — تختارها من «🎨 مظهري»' },
  { id:'title',  name:'لقب في الصدارة',   price:200, ic:'🎖️',
    d:'لقب بأيقونة يظهر بجانب اسمك' },
  { id:'dbl',    name:'نقاط مضاعفة',      price:150, ic:'⭐',
    d:'نشاطك القادم بنقاط ×2 — تُستخدم تلقائياً' },
  { id:'thanks', name:'رسالة شكر للأهل',  price:300, ic:'💌', teacher:true,
    d:'رسالة من معلمك لولي أمرك' },
  { id:'retry',  name:'إعادة محاولة',     price:80,  ic:'🔁',
    d:'تعيد حل نشاط سلّمته — تُحتسب الأعلى' },
  { id:'early',  name:'مراجعة مبكرة',     price:60,  ic:'🔓',
    d:'افتح أخطاءك قبل موعد الإغلاق' },
  { id:'fifty',  name:'حذف إجابتين',      price:40,  ic:'✂️',
    d:'في سؤال الاختيار من متعدد: يحذف خيارين خاطئين' },
  { id:'hint',   name:'تلميح',            price:30,  ic:'💡',
    d:'مساعدة في مهمة صعبة أثناء الحل' },
  { id:'ticket', name:'تذكرة مسابقة',     shop:'تذكرتا مسابقة (2 بسعر 1)', price:50,  ic:'🎟️',
    d:'دخولان لمسابقتين مباشرتين بسعر دخول واحد — الثانية مجانًا، وتُستخدم تلقائيًا بدل الرسوم' },
  { id:'theme_gold', name:'مظهر ذهبي حصري', price:250, ic:'✨', once:true,
    d:'خلفية ذهبية لامعة لصفحتك — لك دائمًا من «🎨 مظهري»' },
  { id:'theme_diamond', name:'مظهر ماسي حصري', price:250, ic:'💎', once:true,
    d:'خلفية ماسية متلألئة لصفحتك — لك دائمًا من «🎨 مظهري»' },
  { id:'frame', name:'إطار الصورة', price:200, ic:'🖼️', once:true,
    d:'إطار متحرك حول صورتك: ذهبي أو ناري أو قوس قزح — تختاره من «🎨 مظهري»' },
  { id:'namecolor', name:'اسم ملوّن', price:300, ic:'🌈', once:true,
    d:'اسمك بألوان لامعة في الصدارة ونتائج المسابقات وترحيب صفحتك' },
  { id:'theme_saudi', name:'مظهر اليوم الوطني ٩٦', price:250, ic:'🇸🇦', once:true,
    d:'لوحة القصر الطيني والنخيل وأبراج الرياض بالأخضر والذهبي، وشريط «اليوم الوطني السعودي ٩٦» — لك دائمًا من «🎨 مظهري»' },
  { id:'theme_spaceweek', name:'مظهر أسبوع الفضاء', price:250, ic:'🚀', once:true,
    d:'سماء ليلية بكوكب وشريط «أسبوع الفضاء العالمي» — لك دائمًا من «🎨 مظهري»' }
].sort((a,b)=>b.price-a.price);
// 🗂️ فئات المتجر — كل بطاقة في فئة واحدة، وداخل الفئة من الأغلى للأرخص
const SHOP_CATS = [
  { ic:'🎓', t:'درجاتك', d:'ترفع درجة الاختبارات أو تمسح خصم واجب', ids:['exam3','exam2','exam1','exam05','hwforgive','madforgive'] },
  { ic:'🧩', t:'مساعدات الأنشطة', d:'تساعدك أثناء الحل وبعده', ids:['dbl','retry','early','fifty','hint','ticket'] },
  { ic:'🎨', t:'مظهرك وتميّزك', d:'لك دائمًا — تُشترى مرة واحدة', ids:['namecolor','avatars','theme_gold','theme_diamond','theme_saudi','theme_spaceweek','frame','title'] },
  { ic:'🏅', t:'تكريمك', d:'شهادة باسمك ورسالة شكر لأهلك', ids:['cert','thanks'] }
];

// 🏅 الألقاب المتاحة — لكل لقب أيقونته
const TITLES = [
  { id:'scholar', ic:'📚', name:'الباحث' },
  { id:'steady',  ic:'🧭', name:'المثابر' },
  { id:'star',    ic:'🌟', name:'النجم' },
  { id:'falcon',  ic:'🦅', name:'الصقر' },
  { id:'lion',    ic:'🦁', name:'الأسد' },
  { id:'rocket',  ic:'🚀', name:'الطموح' },
  { id:'brain',   ic:'🧠', name:'العقل' },
  { id:'flame',   ic:'🔥', name:'المتوهّج' }
];
const titleInfo = id => TITLES.find(t=>t.id===id) || null;
const titleLabel = id => { const t = titleInfo(id); return t ? t.ic + ' ' + t.name : ''; };
const cardInfo = id => CARDS.find(x=>x.id===id) || { ic:'🎫', name:id };

let EXAM_SHOP_POLICY={enabled:true,available:true,reason:'',startAt:0,endAt:0,maxPerStudent:3,remaining:3};
let EXAM_SHOP_REMAINING=0;
let EXAM_SHOP_HAS_SCORE=false;
/* لا يُعرض «المتبقي» قبل جلب درجات الطالب الفعلية (كانت القيمة الافتراضية 3 تظهر قبلها) */
let EXAM_SHOP_LOADED=false, EXAM_SHOP_LOADING=null;
function examCardOf(id){ return CARDS.find(c=>c.id===id && c.examBonus) || null; }
function examShopMessage(){
  const p=EXAM_SHOP_POLICY||{}; if(p.enabled===false) return '🔒 شراء درجات الاختبارات مغلق حاليًا من المعلم.';
  const now=Date.now(); if(p.startAt&&now<p.startAt) return `⏳ تتاح شراء درجات الاختبارات في ${new Date(p.startAt).toLocaleString('ar-SA')}.`;
  if(p.endAt&&now>p.endAt) return `⛔ انتهت فترة شراء درجات الاختبارات في ${new Date(p.endAt).toLocaleString('ar-SA')}.`;
  if(Number(p.maxPerStudent)<=0) return '🔒 لا توجد درجات مسموحة لك حاليًا.';
  return `🎓 المسموح لك حاليًا حتى ${p.maxPerStudent} درجة، ويطبق الخادم هذا الحد عند الشراء.`;
}
async function fetchExamBonusOptions(){
  const api = ((HW && HW.api) || API || '').replace(/\/+$/,'');
  const nm = String(myName || lockedName() || '').trim();
  if(!api || !nm) return [];
  try{
    EXAM_SHOP_LOADED = false;
    const r = await fetch(api + '/exam-options?name=' + encodeURIComponent(nm) + idQS() + '&_=' + Date.now(), {cache:'no-store'});
    const j = await r.json();
    if(j && j.policy) EXAM_SHOP_POLICY=j.policy;
    const ex=(j && j.ok && Array.isArray(j.exams) && j.exams.length) ? j.exams[0] : null;
    EXAM_SHOP_HAS_SCORE=!!(j && j.hasExam);
    EXAM_SHOP_REMAINING=ex ? Number(ex.remaining||0) : Number(j?.policy?.remaining ?? (j?.policy?.maxPerStudent ?? 0));
    if(!Number.isFinite(EXAM_SHOP_REMAINING)) EXAM_SHOP_REMAINING=0;
    EXAM_SHOP_REMAINING=Math.max(0,Math.min(20,EXAM_SHOP_REMAINING));
    if(EXAM_SHOP_POLICY) EXAM_SHOP_POLICY.remaining=EXAM_SHOP_REMAINING;
    EXAM_SHOP_LOADED = !!(j && j.ok);
    return j && j.ok && Array.isArray(j.exams) ? j.exams : [];
  }catch(e){ return []; }
}
async function useExamBonus(cardId, target){
  const c=examCardOf(cardId); if(!c) return;
  const exams=await fetchExamBonusOptions();
  if(!exams.length){
    await note(EXAM_SHOP_POLICY?.reason || examShopMessage() + '\nإذا كانت الإتاحة مفتوحة، فتأكد أولًا من وجود درجة اختبار مرصودة لك.','لا يوجد اختبار متاح','🎓');
    return;
  }
  const ex=exams[0];
  const api=((HW&&HW.api)||API||'').replace(/\/+$/,'');
  if(Number(ex.remaining)<c.examBonus){ toast(`المتاح لك حاليًا ${ex.remaining} درجة فقط، وهذه البطاقة تضيف ${c.examBonus}.`,'bad'); return; }
  const ok=await ask({icon:c.ic,title:'تأكيد استخدام البطاقة',msg:`سيُضاف ${c.examBonus} درجة مباشرة إلى درجة الاختبارات في ${ex.label||'هذه الفترة'} .\nدرجتك الحالية: ${ex.score}/20\nالدرجة بعد الإضافة: ${Math.min(20,Number(ex.score)+c.examBonus).toFixed(2).replace(/\.00$/,'')}/20`,yes:'استخدم البطاقة',no:'إلغاء'});
  if(!ok) return;
  try{
    const r=await storeFetch(api+'/use-exam-bonus',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:String(myName||lockedName()||'').trim(),sid:mySid||'',card:cardId,semester:ex.semester,period:ex.period})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.ok){ toast(j.error==='limit'?`المتاح لك ${j.remaining??0} درجة فقط`:storeErrText(j,'تعذّر استخدام البطاقة'),'bad'); return; }
    MYPERKS=j.perks||MYPERKS; MYPTS=Number(j.pts??MYPTS); syncBalanceUI();
    await note(`تمت إضافة ${j.added} درجة مباشرة إلى درجة الاختبارات.\nدرجتك الآن: ${j.score}/20\nالمتبقي لك: ${j.remaining} درجة.`,`تم رفع درجة الاختبار مباشرة ✅`,c.ic);
    if(target==='pre-store') await loadStore(true); else renderStore(target);
  }catch(e){ toast('تعذّر الاتصال — البطاقة لم تُستهلك','bad'); }
}

// 🎓 شراء بطاقة الاختبار = خصم النقاط + رفع الدرجة في العملية نفسها.
async function buyExamBonusDirect(card, target){
  const exams=await fetchExamBonusOptions();
  if(!exams.length){
    await note(EXAM_SHOP_POLICY?.reason || examShopMessage() + '\nإذا كانت الإتاحة مفتوحة، فتأكد أولًا من وجود درجة اختبار مرصودة لك.','لا توجد درجة اختبار متاحة','🎓');
    return;
  }
  const ex=exams[0];
  if(Number(ex.remaining)<Number(card.examBonus)){
    await note(`درجتك الحالية ${ex.score}/20، وقد استخدمت ${ex.bonus||0} من أصل الحد المسموح له. المتبقي ${ex.remaining} درجة، لذلك بطاقة ${card.examBonus} درجة غير متاحة لك حاليًا.`,'الحد المتبقي أقل من قيمة البطاقة','⚠️');
    return;
  }
  const after=Math.min(20,Number(ex.score)+Number(card.examBonus));
  const ok=await ask({icon:card.ic,title:'شراء ورفع الدرجة مباشرة',msg:`${card.name}\n\nدرجتك الحالية: ${ex.score}/20\nالزيادة: +${card.examBonus}\nستصبح: ${String(after).replace(/\.00$/,'')}/20\n\nالسعر: ${card.price} نقطة\nرصيدك بعد الشراء: ${MYPTS-card.price} نقطة`,yes:'شراء وإضافة الدرجة',no:'إلغاء'});
  if(!ok) return;
  const api=((HW&&HW.api)||API||'').replace(/\/+$/,'');
  try{
    const r=await storeFetch(api+'/buy-exam-bonus',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:String(myName||lockedName()||'').trim(),sid:mySid||'',card:card.id})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.ok){
      const msg=j.error==='low'?`رصيدك لا يكفي. رصيدك الحالي ${j.pts??MYPTS} نقطة.`:
        (j.error==='window'||j.error==='closed')?(j.reason||'شراء درجات الاختبارات غير متاح حاليًا.'):
        j.error==='noexam'?'لا توجد درجة اختبار متاحة حاليًا.':
        j.error==='limit'?`المتاح للرفع ${j.remaining??0} درجة فقط.`:
        storeErrText(j,'تعذّر إتمام الشراء، ولم تُخصم النقاط.');
      toast(msg,'bad');
      MYPTS=Number(j.pts??MYPTS); syncBalanceUI(); renderStore(target); return;
    }
    MYPTS=Number(j.pts??MYPTS); MYPERKS=j.perks||MYPERKS; syncBalanceUI();
    await note(`تم شراء البطاقة بـ ${card.price} نقطة.\nتمت إضافة +${j.added} درجة مباشرة إلى درجة الاختبارات.\nدرجتك الآن: ${j.score}/20\nالمتبقي من سقف الرفع: ${j.remaining} درجة.`,`تمت ترقية درجة الاختبار 🎓`,card.ic);
    if(target==='pre-store') await loadStore(true); else renderStore(target);
  }catch(e){ toast('تعذّر الاتصال — لم يتم خصم النقاط ولم تُرفع الدرجة','bad'); }
}

async function loadStore(pre){
  const api = ((HW && HW.api) || API || '').replace(/\/+$/,'');
  if(!api) return;
  try{
    const r = await fetch(api + '/me?name=' + encodeURIComponent(myName) + idQS());
    const j = await r.json();
    if(!j.ok) return;
    MYPTS = j.pts || 0; MYPERKS = j.perks || {}; MYTITLE = j.title || MYTITLE;
  }catch(e){}
  try{ await fetchExamBonusOptions(); }catch(e){}
  if(pre){
    $('pre-bal').textContent = MYPTS + ' 📖';
    const own = Object.keys(MYPERKS).filter(k=>MYPERKS[k]>0);
    $('pre-perks').textContent = own.length
      ? 'بطاقاتك: ' + own.map(k=>{const c=cardInfo(k);
          return c.ic+' '+c.name+(MYPERKS[k]>1?' ×'+MYPERKS[k]:'');}).join(' · ')
      : 'لا تملك بطاقات بعد';
    if(!$('pre-store').classList.contains('hide')) renderStore('pre-store');
  } else renderStore();
}

function renderStore(target){
  const owned = Object.keys(MYPERKS).filter(k=>MYPERKS[k]>0);
  const box = $(target || 'store-box');
  // 🚫 لا متجر داخل اختبارات القياس — لا نقاط ولا مساعدات
  if(!target && (HW.kind === 'style' || HW.kind === 'diag')){
    box.innerHTML = `<div class="sheet center" style="margin-top:1.2rem">
      <div style="font-size:1.6rem">${HW.kind==='style'?'🧠':'🔍'}</div>
      <p class="muted" style="margin:.4rem 0 0;font-size:.88rem">
        ${HW.kind==='style' ? 'اختبار أنماط تعلّم — بلا نقاط ولا بطاقات'
                            : 'اختبار تشخيصي — بلا نقاط ولا بطاقات'}</p></div>`;
    return;
  }
  const examCards=CARDS.filter(c=>c.examBonus);
  // ⏳ قبل جلب درجات الطالب لا نعرض رقمًا: نجلبها ثم نعيد الرسم (مرة واحدة في كل جلب)
  if(examCards.length && !EXAM_SHOP_LOADED && !EXAM_SHOP_LOADING){
    EXAM_SHOP_LOADING = fetchExamBonusOptions().catch(()=>{}).finally(()=>{ EXAM_SHOP_LOADING = null; if(EXAM_SHOP_LOADED) renderStore(target); });
  }
  const examKnown = EXAM_SHOP_LOADED;
  const examRemaining=examKnown ? Math.max(0,Number(EXAM_SHOP_REMAINING)||0) : 0;
  const examAvailable=examKnown && EXAM_SHOP_POLICY?.available!==false && examRemaining>0;
  const examNotice=!examKnown ? '⏳ جارٍ التحقق من درجاتك…' : (EXAM_SHOP_POLICY?.reason||(!EXAM_SHOP_HAS_SCORE && examAvailable ? '🎓 الحد المسموح محفوظ لك، وتُحدد الدرجات المتبقية بعد ظهور درجة الاختبار.' : (examRemaining<=0 && EXAM_SHOP_HAS_SCORE ? '🎓 استخدمت كامل الحد المسموح لرفع درجة الاختبار.' : examShopMessage())));
  const cardBtn=c=>{
          const remainingEnough=!c.examBonus || examRemaining>=Number(c.examBonus);
          const ownedOnce = c.once && MYPERKS[c.id] > 0;
          const can = !ownedOnce && (MYPTS >= c.price || (c.mad && MYPERKS[c.id] > 0)) && (!c.examBonus || (examAvailable && remainingEnough));
          const examLine=c.examBonus ? (!examKnown ? '⏳ جارٍ التحقق…' : (examRemaining<=0 && EXAM_SHOP_HAS_SCORE) ? 'استخدمت كامل الحد' : remainingEnough && examAvailable ? `المتاح لك الآن ${String(examRemaining).replace(/\.0$/,'')} درجة` : (examAvailable ? `المتبقي ${String(examRemaining).replace(/\.0$/,'')} درجة · البطاقة تحتاج ${c.examBonus}` : 'غير متاح حاليًا')) : '';
          return `<button data-c="${c.id}" data-p="${c.price}" ${can?'':'disabled'}>
            ${c.ic} ${esc(c.shop||c.name)}
            <span style="display:block;font-size:.74rem;font-weight:500;color:var(--ink-soft);line-height:1.4;margin-top:.15rem">${esc(c.d||'')}</span>
            ${c.examBonus?`<span style="display:block;font-size:.7rem;font-weight:800;margin-top:.2rem">${esc(examLine)}</span>`:''}
            <span class="p">${ownedOnce ? '✓ تملكه' : c.price + ' نقطة'}</span></button>`;
        };
  box.innerHTML = `
    <div class="sheet" style="margin-top:1.2rem">
      ${examCards.length?`<div style="margin-bottom:.7rem;padding:.65rem .75rem;border-radius:10px;background:${!examKnown?'#EEF2F7':examAvailable?'#E4F4EC':'#FFF1F2'};font-size:.8rem;line-height:1.6">${esc(examNotice)}${examKnown?`<br><b>المتبقي لك: ${String(examRemaining).replace(/\.0$/,'')} درجة</b>`:''}</div>`:''}
      <div class="center">
        <div class="muted" style="font-size:.85rem">رصيدك من نقاط النشاط</div>
        <div class="bal">${MYPTS} 📖</div>
      </div>
      ${owned.length ? `<div class="muted center" style="font-size:.82rem;margin-top:.5rem">
        بطاقاتك: ${owned.map(k=>{const c=cardInfo(k);
        return c.ic+' '+esc(c.name)+(MYPERKS[k]>1?' ×'+MYPERKS[k]:'');}).join(' · ')}</div>` : ''}
      ${owned.filter(k=>examCardOf(k)).map(k=>{const c=examCardOf(k);return `<div class="exam-bonus-owned"><div class="exam-bonus-owned-head"><span>${c.ic} لديك بطاقة «${esc(c.name)}» ×${MYPERKS[k]}</span><span>${c.examBonus} درجة</span></div><button type="button" class="exam-bonus-use" data-use-exam-card="${c.id}">🎓 استخدم بطاقة قديمة لرفع درجة الاختبارات</button></div>`;}).join('')}
      <div class="shop">
        ${SHOP_CATS.map(cat=>{ const list=CARDS.filter(c=>cat.ids.includes(c.id)); if(!list.length) return '';
          return `<div class="shop-cat"><b>${cat.ic} ${esc(cat.t)}</b><small>${esc(cat.d)}</small></div>` + list.map(cardBtn).join('');
        }).join('')}
      </div>
      <p class="muted center" style="font-size:.78rem;margin:.6rem 0 0">
        💡🔁⭐ تعمل فوراً بنفسك · 🎓 بطاقات الاختبار تُستخدم على درجة الاختبارات</p>
    </div>`;
  box.querySelectorAll('.shop button').forEach(b=>b.onclick=()=>buyCard(b, target));
  box.querySelectorAll('[data-use-exam-card]').forEach(b=>b.onclick=()=>useExamBonus(b.dataset.useExamCard, target));
}

async function buyCard(btn, target){
  const id = btn.dataset.c, price = +btn.dataset.p;
  const c = CARDS.find(x=>x.id===id);
  if(c && c.examBonus){ await buyExamBonusDirect(c, target); return; }
  if(c && c.mad){ await madForgivePick(target, c.id); return; }
  const okBuy = await ask({ icon:c.ic, title:'تأكيد الشراء',
    msg:`"${c.shop||c.name}" مقابل ${price} نقطة.\nرصيدك بعدها: ${MYPTS - price}`,
    yes:'اشترِ', no:'إلغاء' });
  if(!okBuy) return;
  const api = ((HW && HW.api) || API || '').replace(/\/+$/,'');
  btn.disabled = true;
  try{
    const r = await storeFetch(api + '/buy', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name: String(myName || lockedName() || '').trim(), sid: mySid||'', card: id }) });
    const j = await r.json();
    if(!j.ok){ toast(j.error==='low' ? 'رصيدك لا يكفي' : j.error==='owned' ? 'تملك هذه البطاقة من قبل' : storeErrText(j, 'تعذّر إتمام الشراء — لم يُخصم شيء'),'bad'); MYPTS = j.pts ?? MYPTS; renderStore(target); return; }
    MYPTS = j.pts; MYPERKS = j.perks || MYPERKS;
    if(target==='pre-store'){
      await loadStore(true);
    }else if(target==='gate-store-box'){
      renderStore('gate-store-box');
      await gateLoad(String(myName || lockedName() || '').trim());
    }else{
      renderStore(target);
    }
    if(id === 'title'){ await pickTitle(); return; }
    if(id === 'cert'){ await myCertsLoad(); if(j.certId && MY_CERTS.some(x=>x.id===j.certId)){ toast('🏅 مبروك! صدرت شهادتك — احفظها أو اطبعها','good'); myCertOpen(j.certId); }
      else note('صدرت شهادتك — تجدها في «🏅 شهاداتي» في صفحتك.', 'تم الشراء ✅', '🏅'); return; }
    if(c.examBonus){
      await useExamBonus(id, target);
      return;
    }
    const after = {
      hint:   'اضغط زر «تلميح» أثناء حل المهام.',
      fifty:  'في سؤال الاختيار من متعدد اضغط زر «✂️ حذف إجابتين».',
      retry:  'افتح النشاط الذي سلّمته وستجد زر إعادة المحاولة.',
      dbl:    'ستُضاعف نقاط نشاطك القادم تلقائياً.',
      thanks: 'وصل طلبك لمعلمك — سيرسل الرسالة لولي أمرك.',
      ticket: 'لديك الآن تذكرتان إضافيتان 🎟️🎟️ — تُستخدم واحدة تلقائيًا بدل رسوم الدخول في كل مسابقة مباشرة تسجّل فيها.',
      theme_gold: 'افتح «🎨 مظهري» واختر «ذهبي ✨» من الخلفيات.',
      theme_diamond: 'افتح «🎨 مظهري» واختر «ماسي 💎» من الخلفيات.',
      theme_saudi: 'افتح «🎨 مظهري» واختر «اليوم الوطني ٩٦» من الخلفيات.',
      frame: 'افتح «🎨 مظهري» واختر إطارك من «🖼️ إطار الصورة».',
      namecolor: 'صار اسمك ملوّنًا في الصدارة ونتائج المسابقات وترحيب صفحتك 🌈',
      avatars: 'افتح «🎨 مظهري» واختر رمزك من «✨ رموز حصرية».',
      theme_spaceweek: 'افتح «🎨 مظهري» واختر «أسبوع الفضاء» من الخلفيات.',
      early:  'افتح النشاط الذي سلّمته واضغط «مراجعة مبكرة».'
    };
    note(after[id] || '', `تم شراء "${c.name}" ✅`, c.ic);
  }catch(e){ toast('تعذّر الاتصال — حاول لاحقاً','bad'); renderStore(target); }
}

/* 🧽📘 بطاقتا «مسح خصم مدرستي» و«مسح خصم واجب الفصل»: يختار الطالب الواجب المخصوم أولًا، ثم يدفع — فلا تُشترى بطاقة بلا فائدة */
const FORGIVE_KINDS = {
  madforgive: { path:'/mad-forgive', ic:'🧽', title:'مسح خصم مدرستي', intro:'اختر الواجب الذي أُغلق ولم تحله ليُمسح خصمه (0.5) من درجتك',
    none:'لا يوجد عليك خصم في واجبات مدرستي هذه الفترة 👏 — لم يُخصم شيء.', where:'درجة مدرستي' },
  hwforgive:  { path:'/hw-forgive', ic:'📘', title:'مسح خصم واجب الفصل', intro:'اختر واجب الفصل المرصود عليك «لم ينجز» ليُمسح خصمه (0.5) من درجتك',
    none:'لا يوجد عليك خصم في واجبات الفصل هذه الفترة 👏 — لم يُخصم شيء.', where:'درجة واجبات الفصل' }
};
async function madForgivePick(target, card){
  const K = FORGIVE_KINDS[card] || FORGIVE_KINDS.madforgive, cardId = FORGIVE_KINDS[card] ? card : 'madforgive';
  const api = ((HW && HW.api) || API || '').replace(/\/+$/,'');
  const nm = String(myName || lockedName() || '').trim();
  const post = body => storeFetch(api + K.path, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ name: nm, sid: mySid||'', ...body }) }).then(r=>r.json());
  let j; try{ j = await post({ op:'list' }); }catch(e){ toast('تعذّر الاتصال — حاول لاحقاً','bad'); return; }
  if(!j.ok){ toast(storeErrText(j, 'تعذّر جلب واجباتك'),'bad'); return; }
  MYPTS = j.pts ?? MYPTS;
  const owned = j.owned > 0, price = j.price || 500;
  const day = t => t ? new Date(t).toLocaleDateString('ar-SA-u-ca-gregory-nu-arab',{ weekday:'long', day:'numeric', month:'numeric', timeZone:'Asia/Riyadh' }) : '';
  // واجب الفصل يُعرف بتاريخه: «واجب الأحد ١٢/١٠»
  const label = x => x.date ? 'واجب ' + day(Date.parse(x.date + 'T12:00:00+03:00')) : x.title;
  const sub = x => x.date ? 'مرصود: لم ينجز' : 'أُغلق ' + day(x.dueAt);
  const empty = !j.linked ? 'حسابك غير مربوط بمنصة مدرستي بعد — اطلب من معلمك ربطه.'
    : !j.open ? 'الفترة الحالية مغلقة — لا يمكن تعديل خصومها الآن.'
    : K.none;
  const box = document.createElement('div');
  box.id = 'madfg-pick';
  box.style.cssText = 'position:fixed;inset:0;z-index:60;background:rgba(22,35,58,.5);display:flex;align-items:center;justify-content:center;padding:1rem';
  box.innerHTML = `
    <div class="sheet" style="max-width:440px;width:100%;max-height:86vh;overflow:auto">
      <h3 class="center" style="margin:.2rem 0 .1rem">${K.ic} ${K.title}</h3>
      <p class="muted center" style="font-size:.84rem;margin:0 0 .7rem;line-height:1.6">${K.intro}
        <br><b>${owned ? `ستُستخدم بطاقتك ${K.ic}` : `السعر ${price} نقطة · رصيدك ${MYPTS} 📖`}</b></p>
      ${(j.items||[]).length ? `<div class="madfg-list">${j.items.map(x=>`<button type="button" class="madfg-it" data-k="${esc(x.key)}" ${owned||MYPTS>=price?'':'disabled'}>
          <span class="madfg-x">−0.5</span><span class="madfg-t"><b>${esc(label(x))}</b><small>${esc(sub(x))}</small></span><span class="madfg-go">امسح</span></button>`).join('')}</div>
        ${!owned && MYPTS<price ? `<p class="center" style="color:#B42318;font-size:.82rem;margin:.6rem 0 0">رصيدك لا يكفي — تحتاج ${price-MYPTS} نقطة أخرى</p>` : ''}`
        : `<div class="center muted" style="padding:1rem .5rem;font-size:.9rem;line-height:1.7">${empty}</div>`}
      ${(j.forgiven||[]).length ? `<div class="muted" style="font-size:.78rem;margin-top:.7rem">✓ مُسح سابقًا: ${j.forgiven.map(x=>esc(label(x))).join(' · ')}</div>` : ''}
      <button type="button" class="btn ghost" data-close style="width:100%;margin-top:.8rem">إغلاق</button>
    </div>`;
  document.body.appendChild(box);
  box.querySelector('[data-close]').onclick = ()=>box.remove();
  box.onclick = e=>{ if(e.target===box) box.remove(); };
  box.querySelectorAll('[data-k]').forEach(b=>b.onclick = async ()=>{
    const it = j.items.find(x=>x.key===b.dataset.k); if(!it) return;
    box.remove();
    const ok = await ask({ icon:K.ic, title:'تأكيد المسح',
      msg:`يُمسح خصم «${label(it)}» من ${K.where}.\n${owned ? `تُستخدم بطاقتك ${K.ic}` : `يُخصم ${price} نقطة — رصيدك بعدها: ${MYPTS - price}`}`,
      yes:'امسح الخصم', no:'إلغاء' });
    if(!ok) return;
    try{
      const r = await post({ op:'use', key: it.key });
      if(!r.ok){ MYPTS = r.pts ?? MYPTS;
        toast(r.error==='low' ? 'رصيدك لا يكفي' : r.error==='already' ? 'مُسح خصم هذا الواجب من قبل' : r.error==='not_missed' ? 'هذا الواجب لم يعد مخصومًا عليك — لم يُخصم شيء' : r.error==='period_closed' ? 'الفترة الحالية مغلقة — لم يُخصم شيء' : storeErrText(r, 'تعذّر المسح — لم يُخصم شيء'),'bad');
        renderStore(target); return; }
      MYPTS = r.pts; MYPERKS = r.perks || MYPERKS;
      if(target==='pre-store') await loadStore(true);
      else if(target==='gate-store-box'){ renderStore('gate-store-box'); await gateLoad(nm); }
      else renderStore(target);
      note(`مُسح خصم «${label(it)}» — صار محتسبًا لك بلا خصم في ${K.where}.`, 'تم المسح ✅', K.ic);
    }catch(e){ toast('تعذّر الاتصال — حاول لاحقاً','bad'); }
  });
}

/* 🏅 اختيار اللقب بعد شرائه */
async function pickTitle(){
  const nm = String(myName || lockedName() || '').trim();
  const api = ((HW && HW.api) || API || '').replace(/\/+$/,'');
  const box = document.createElement('div');
  box.id = 'title-pick';
  box.style.cssText = 'position:fixed;inset:0;z-index:60;background:rgba(22,35,58,.5);display:flex;align-items:center;justify-content:center;padding:1rem';
  box.innerHTML = `
    <div class="sheet" style="max-width:420px;width:100%;max-height:86vh;overflow:auto">
      <h3 class="center" style="margin:.2rem 0 .1rem">🏅 اختر لقبك</h3>
      <p class="muted center" style="font-size:.84rem;margin:0 0 .8rem">سيظهر بجانب اسمك في الصدارة</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
        ${TITLES.map(t=>`<button class="btn ghost" data-t="${t.id}"
          style="display:flex;flex-direction:column;gap:.15rem;padding:.75rem .4rem;font-size:.9rem">
          <span style="font-size:1.5rem">${t.ic}</span>${esc(t.name)}</button>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(box);
  box.querySelectorAll('[data-t]').forEach(b=>b.onclick = async ()=>{
    const tid = b.dataset.t;
    box.remove();
    try{
      const r = await storeFetch(api + '/title', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name: nm, sid: mySid||'', title: tid }) });
      const j = await r.json();
      if(!j.ok){ toast(storeErrText(j, 'تعذّر حفظ اللقب'),'bad'); return; }
      MYPERKS = j.perks || MYPERKS;
      MYTITLE = tid;
      note(`صار لقبك ${titleLabel(tid)} — يظهر في الصدارة.`, 'تم اختيار لقبك ✅', '🏅');
      if(typeof gateLoad === 'function' && nm) gateLoad(nm);
    }catch(e){ toast('تعذّر الاتصال','bad'); }
  });
}

/* 🔓 فتح المراجعة مبكراً ببطاقة */
async function useEarlyReview(hwId, nm){
  const api = (API||'').replace(/\/+$/,'');
  const ok = await ask({ icon:'🔓', title:'مراجعة مبكرة',
    msg:'استخدم بطاقة «مراجعة مبكرة» لترى أخطاءك الآن بدل انتظار موعد الإغلاق؟',
    yes:'افتحها', no:'إلغاء' });
  if(!ok) return false;
  try{
    const r = await storeFetch(api + '/unlock-review', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name: nm, sid: mySid||'', hw: hwId }) });
    const j = await r.json();
    if(!j.ok){ toast(j.error==='nocard' ? 'لا تملك البطاقة' : 'تعذّر الفتح','bad'); return false; }
    MYPERKS = j.perks || MYPERKS;
    return true;
  }catch(e){ toast('تعذّر الاتصال','bad'); return false; }
}

let MYTITLE = '';

/* 📚 هل بقي عليه أنشطة؟ — تخدم شاشة الانتهاء وشاشة «سبق أن سلّمت» */
async function offerMore(nm, where){
  const ids = where === 'empty'
    ? { box:'emp-more', line:'emp-line', btn:'emp-btn' }
    : { box:'more-box', line:'more-line', btn:'more-btn' };
  const box = $(ids.box); if(!box) return;
  const api = ((HW && HW.api) || API || '').replace(/\/+$/,'');
  const goto = ()=>{ location.hash = ''; location.href = location.pathname; };

  if(!api){ box.classList.remove('hide');
    $(ids.line).textContent = 'اطّلع على بقية أنشطتك.';
    $(ids.btn).onclick = goto; return; }

  try{
    const j = await (await fetch(api + '/mine?name=' + encodeURIComponent(nm) + idQS())).json();
    if(!j.ok) return;
    const today = todayISO();
    const left = (j.rows||[]).filter(h =>
      !h.done && String(h.id) !== String(HW && HW.id) && (!h.due || h.due >= today));
    box.classList.remove('hide');
    if(left.length){
      const names = left.slice(0,3).map(h=>`«${h.t}»`).join(' · ');
      $(ids.line).innerHTML =
        `<b style="color:var(--pen)">بقي عليك ${left.length===1?'نشاط واحد':left.length===2?'نشاطان':left.length+' أنشطة'}</b><br>` +
        `<span style="font-size:.85rem">${esc(names)}${left.length>3?' وغيرها':''}</span>`;
      $(ids.btn).textContent = `📚 حلّها الآن (${left.length})`;
      $(ids.btn).className = 'btn tick';
    }else{
      $(ids.line).textContent = '🎉 أكملت كل أنشطتك — أحسنت!';
      $(ids.btn).textContent = '📚 أنشطتي';
      $(ids.btn).className = 'btn ghost';
    }
    $(ids.btn).onclick = goto;
  }catch(e){}
}

$('hint-btn').onclick = ()=> useHint();
$('fifty-btn').onclick = ()=> useFifty();
$('retry-btn').onclick = ()=> doRetry();

$('copy-btn').onclick = async ()=>{
  try{ await navigator.clipboard.writeText($('done-code').textContent); $('copy-btn').textContent='نُسخ ✅'; }
  catch{ $('copy-btn').textContent='حدّده وانسخه'; }
};

/* ═══════════ 📲 تنبيهات الطالب: نشاط جديد · رسالة من المعلم ═══════════
   الاشتراك مرتبط بالطالب عبر جلسته (الرمز السري) — لا يستطيع أحد تسجيل جهازه باسم غيره. */
const SP_SID = 'sp_push_sid_v1';
const spApi = p => (API || '').replace(/\/+$/, '') + p;
function spSupported(){ return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function spIsIOS(){ return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function spStandalone(){ try{ return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }catch(e){ return false; } }
function spOnFor(){ try{ return localStorage.getItem(SP_SID) || ''; }catch(e){ return ''; } }
function spKey(b64){ const s = String(b64).replace(/-/g,'+').replace(/_/g,'/'); return Uint8Array.from(atob(s + '==='.slice((s.length+3)%4)), c => c.charCodeAt(0)); }
async function spReg(){ return navigator.serviceWorker.register('./sw.js?api=' + encodeURIComponent(API || '')); }
async function spCurrentSub(){ try{ const r = await navigator.serviceWorker.getRegistration('./'); return r ? await r.pushManager.getSubscription() : null; }catch(e){ return null; } }

async function spEnable(){
  if(!mySid){ toast('اكتب اسمك أولًا','bad'); return; }
  if(spIsIOS() && !spStandalone()){ spRender(true); return; }
  if(!spSupported()){ toast('هذا المتصفح لا يدعم التنبيهات','bad'); return; }
  try{
    const perm = await Notification.requestPermission();
    if(perm !== 'granted'){ toast('لم تسمح بالتنبيهات — يمكنك السماح بها من إعدادات الجوال','bad'); spRender(); return; }
    const pk = await (await fetch(spApi('/push/public-key'), { cache:'no-store' })).json();
    if(!pk.configured || !pk.publicKey){ toast('التنبيهات غير متاحة بعد — أخبر معلمك','bad'); return; }
    const reg = await spReg(); await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:spKey(pk.publicKey) });
    const r = await storeFetch(spApi('/push/student/subscribe'), { method:'POST', body:JSON.stringify({ subscription:sub.toJSON() }) });
    const j = await r.json().catch(() => ({}));
    if(!j.ok){ toast(j.error === 'auth_cancel' ? 'أُلغي التفعيل — يلزم رمزك السري مرة واحدة' : 'تعذّر تفعيل التنبيهات','bad'); spRender(); return; }
    localStorage.setItem(SP_SID, mySid);
    toast('🔔 فُعّلت التنبيهات — سيصلك كل نشاط جديد ورسائل معلمك','good');
    spRender();
    storeFetch(spApi('/push/student/test'), { method:'POST', body:'{}' }).catch(() => {});   // تأكيد فوري أنها تعمل
  }catch(e){ toast('تعذّر تفعيل التنبيهات','bad'); spRender(); }
}
async function spDisable(){
  const sub = await spCurrentSub();
  if(sub){
    try{ await fetch(spApi('/push/student/unsubscribe'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ endpoint:sub.endpoint }) }); }catch(e){}
    try{ await sub.unsubscribe(); }catch(e){}
  }
  try{ localStorage.removeItem(SP_SID); }catch(e){}
  toast('أُوقفت التنبيهات على هذا الجهاز'); spRender();
}
function spRender(showIosSteps){
  const box = $('sp-push'); if(!box) return;
  const chip = $('sp-chip');
  if(!mySid){ box.classList.add('hide'); if(chip) chip.classList.add('hide'); return; }
  box.classList.remove('hide');
  const on = spOnFor() === mySid;
  // 🔔 مفعّلة: سطر صغير فقط — التفاصيل وزر الإيقاف عند الضغط على ⚙️
  if(!on) window.__spOpen=false;                 // بعد الإيقاف: التفعيل القادم يعود سطرًا صغيرًا
  box.classList.toggle('sp-compact', on && !window.__spOpen);
  box.classList.toggle('sp-off', !on);
  if(chip) chip.classList.toggle('hide', !(on && !window.__spOpen));
  if(on && !window.__spOpen){ box.innerHTML = ''; box.classList.add('hide'); return; }
  const iosNeedsHome = spIsIOS() && !spStandalone();
  const denied = ('Notification' in window) && Notification.permission === 'denied';
  const steps = `<ol class="sp-steps">
      <li>افتح هذه الصفحة في <b>Safari</b>.</li>
      <li>اضغط زر المشاركة <b>⬆️</b> أسفل الشاشة.</li>
      <li>اختر <b>«إضافة إلى الشاشة الرئيسية»</b> ثم «إضافة».</li>
      <li>افتح «أنشطتي» من الأيقونة الجديدة واضغط «فعّل التنبيهات».</li></ol>`;
  const whyHTML = `<details class="sp-why">
      <summary>${on ? '💡 كيف تستفيد من التنبيهات؟' : '💡 لماذا أفعّلها؟ ⌄'}</summary>
      <ul>
        <li><b>ابدأ مبكرًا:</b> حلّ النشاط يوم وصوله وهو قصير وسهل، بدل أن تتراكم الأنشطة قبل الموعد النهائي.</li>
        <li><b>ضغطة واحدة:</b> اضغط التنبيه فيفتح لك النشاط مباشرة، بلا بحث عنه.</li>
        <li><b>لا تفوتك رسالة:</b> مواعيد الاختبارات وتنبيهات معلمك وتقرير الفترة تصلك حتى والتطبيق مغلق.</li>
        <li><b>عادة ثابتة:</b> اختر وقتًا يوميًا بعد المدرسة، وحين يصل التنبيه أضفه لمهام ذلك الوقت — الانتظام يرفع نقاطك ومستواك.</li>
      </ul>
      <p class="sp-small">لن يصلك إلا ما يخصك: أنشطتك ورسائل معلمك وتقريرك فقط. يمكنك الإيقاف في أي وقت.</p>
    </details>`;
  // 🔕 غير مفعّلة: صف مضغوط (العنوان + زر فعّل)، والشرح عند الطلب — مهمة لكن لا تزاحم الصفحة
  if(!on){
    box.innerHTML = `<div class="sp-row"><span class="sp-ic2">🔔</span><span class="sp-tx"><b>فعّل التنبيهات على جوالك</b><small>يصلك النشاط الجديد ورسائل معلمك وتقريرك لحظة وصولها</small></span><button type="button" class="sp-on" onclick="spEnable()">فعّل</button></div>
      ${iosNeedsHome || showIosSteps ? `<div class="sp-note">على iPhone تعمل التنبيهات من أيقونة الشاشة الرئيسية فقط:${steps}</div>` : ''}
      ${denied ? '<div class="sp-note">التنبيهات محظورة لهذا الموقع — اسمح بها من إعدادات الجوال ثم اضغط «فعّل».</div>' : ''}
      ${whyHTML}`;
    return;
  }
  box.innerHTML = `
    <div class="sp-head">
      <span class="sp-ic">${on ? '🔔' : '📲'}</span>
      <div style="min-width:0;flex:1"><b>${on ? 'التنبيهات مفعّلة على هذا الجوال' : 'فعّل التنبيهات على جوالك'}</b>
        <small>${on ? 'يصلك كل نشاط جديد ورسالة من معلمك وتقريرك فورًا' : 'اعرف بالنشاط الجديد ورسائل معلمك وتقريرك لحظة وصولها'}</small></div>
    </div>
    ${!on && (iosNeedsHome || showIosSteps) ? `<div class="sp-note">على iPhone تعمل التنبيهات من أيقونة الشاشة الرئيسية فقط:${steps}</div>` : ''}
    ${denied && !on ? '<div class="sp-note">التنبيهات محظورة لهذا الموقع — اسمح بها من إعدادات الجوال ثم اضغط «فعّل».</div>' : ''}
    ${whyHTML}
    <div class="sp-actions">
      ${on ? `<button class="btn ghost sm" onclick="spDisable()">إيقاف التنبيهات</button><button class="btn ghost sm" onclick="window.__spOpen=false;spRender()">إخفاء</button>`
           : `<button class="btn tick" onclick="spEnable()">🔔 فعّل التنبيهات</button>`}
    </div>`;
}
/* الجهاز انتقل لطالب آخر: لا تستمر تنبيهات الأول على جوال الثاني */
(function(){
  const orig = setMySid;
  setMySid = function(id){
    const before = spOnFor();
    orig(id);
    if(before && before !== String(id || '')){
      spCurrentSub().then(sub => {
        if(sub) fetch(spApi('/push/student/unsubscribe'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ endpoint:sub.endpoint }) }).catch(() => {});
      });
      try{ localStorage.removeItem(SP_SID); }catch(e){}
    }
    spRender();
  };
})();
/* التنبيه حُذف من الجوال (مسح البيانات أو إلغاء السماح): أعِد الزر بدل أن يظن الطالب أنه يعمل */
async function spVerify(){
  if(!spOnFor() || !spSupported()) return;
  const sub = await spCurrentSub();
  if(!sub || Notification.permission !== 'granted'){ try{ localStorage.removeItem(SP_SID); }catch(e){} spRender(); }
}
/* فتح تنبيه رسالة: ./?open=notices → اذهب للتنبيهات بعد تحميل المساحة */
let spOpenNotices = false, spOpenReport = false, spOpenAsk = false;
try{ const q = new URLSearchParams(location.search), o = q.get('open'); spOpenNotices = o === 'notices'; spOpenAsk = o === 'ask'; spOpenReport = o === 'report' ? (q.get('tab') === 'period' ? 'period' : q.get('tab') === 'week' ? 'week' : true) : false; }catch(e){}
/* ═══════════ 🎮 المسابقة الجماعية المباشرة — واجهة الطالب ═══════════
   الخادم وحده يقرر: الدخول والخصم، السؤال الحالي، صحة الإجابة، النقاط، الترتيب.
   الواجهة تعرض ما يعيده فقط، وتحسب العدّادات بساعة الخادم (فرق الساعة من كل رد) لا بساعة الجوال.
   الطلبات عند حدود المراحل + كل 4 ث على الأكثر (حدود الخطة المجانية). */
const LIVE = { games: [], cur: null, st: null, off: 0, poll: 0, tick: 0, busy: false, mine: {}, auto: {}, openTimer: 0 };
const LIVE_JOINED_KEY = 'live_joined_v1';
/* 🔔 فتح من إشعار: ./?live=<id> — مسجّل؟ إلى الغرفة. غير مسجّل؟ تُبرز بطاقته. */
let LIVE_FROM_NOTIF = (() => { try{ const v = new URLSearchParams(location.search).get('live'); if(v) history.replaceState(null, '', location.pathname + location.hash); return v || ''; }catch(e){ return ''; } })();
function liveApi(){ return ((HW && HW.api) || API || '').replace(/\/+$/, ''); }
function liveNow(){ return Date.now() + LIVE.off; }
function liveJoined(){ try{ return JSON.parse(localStorage.getItem(LIVE_JOINED_KEY) || '{}') || {}; }catch(e){ return {}; } }
function liveMarkJoined(id){ try{ const o = liveJoined(); o[id] = Date.now(); localStorage.setItem(LIVE_JOINED_KEY, JSON.stringify(o)); }catch(e){} }
function liveClock(ms){ try{ return new Date(ms).toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' }); }catch(e){ return ''; } }
function liveLeft(ms){ const s = Math.max(0, Math.ceil(ms / 1000)); const m = Math.floor(s / 60); return m ? `${m}:${String(s % 60).padStart(2, '0')}` : String(s); }
function liveSync(serverNow, sentAt){ if(Number(serverNow) > 0){ const rtt = Date.now() - (sentAt || Date.now()); LIVE.off = Number(serverNow) + rtt / 2 - Date.now(); } }

/* ── البطاقة في الصفحة الرئيسية ── */
async function liveLoadOpen(){
  if(!mySid) return;
  try{
    const t0 = Date.now(), j = await (await fetch(liveApi() + '/live/open?sid=' + encodeURIComponent(mySid))).json();
    if(!j || !j.ok) return;
    liveSync(j.now, t0); LIVE.games = j.games || [];
  }catch(e){ return; }
  liveRenderCard();
  if(LIVE_FROM_NOTIF){
    const want = LIVE_FROM_NOTIF, gg = LIVE.games.find(x => x.id === want); LIVE_FROM_NOTIF = '';
    if(gg && (liveJoined()[gg.id] || gg.status === 'FINISHED')){ LIVE.auto[gg.id] = 1; liveOpenRoom(gg.id); }
    else if(gg){ const c = $('live-card'); if(c){ c.scrollIntoView({ behavior: 'smooth', block: 'center' }); c.classList.add('live-flash'); setTimeout(() => c.classList.remove('live-flash'), 2400); } }
  }
  const jn = liveJoined();
  const g = LIVE.games.find(x => jn[x.id] && (x.status === 'WAITING' || x.status === 'LIVE'));
  const curDone = !LIVE.cur || (LIVE.st && LIVE.st.phase && ['FINISHED', 'CANCELLED'].includes(LIVE.st.phase.status));
  if(g && g.id !== LIVE.cur && curDone && !LIVE.auto[g.id]){ LIVE.auto[g.id] = 1; liveOpenRoom(g.id); }   // جارية/بدأت: إليها (حتى من نتائج سابقة)
  clearTimeout(LIVE.openTimer);
  if(LIVE.games.length) LIVE.openTimer = setTimeout(liveLoadOpen, 20000);
}
/* بطاقات المسابقات: كل مسابقة لم تنتهِ لها بطاقة (الجارية أولًا)، والمنتهية التي لعبتها سطر «نتائج» صغير —
   فلا تحجب مسابقة منتهية التي تليها */
const LIVE_ORDER = { LIVE: 0, WAITING: 1, REGISTRATION: 2, SCHEDULED: 3 };
function liveActiveGames(){ return LIVE.games.filter(x => x.status !== 'FINISHED').sort((a, b) => (LIVE_ORDER[a.status] ?? 9) - (LIVE_ORDER[b.status] ?? 9) || a.startAt - b.startAt); }
function liveCardHTML(g, joined, now){
  const prizes = (g.prizes || []).filter(Boolean).map((p, i) => `${['🥇','🥈','🥉'][i] || '🏅'} ${p}`).join(' · ');
  let btn = '';
  if(g.status === 'FINISHED') btn = `<button class="btn" onclick="liveOpenRoom('${esc(g.id)}')">🏁 النتائج</button>`;
  else if(joined) btn = `<button class="btn tick" onclick="liveOpenRoom('${esc(g.id)}')">🎮 ادخل غرفة المسابقة</button>`;
  else if(g.status === 'REGISTRATION') btn = `<button class="btn tick" onclick="liveJoin('${esc(g.id)}')">${g.fee ? (MYPERKS.ticket > 0 ? `🎟️ ادخل بتذكرتك (بدل ${g.fee} نقطة)` : `دخول المسابقة −${g.fee} نقطة`) : 'دخول المسابقة (مجاني)'}</button>`;
  else btn = g.status === 'LIVE'
    ? `<div class="live-closed live-on">🟢 المسابقة جارية الآن · انتهى التسجيل</div>`
    : `<div class="live-closed">⏳ انتهى التسجيل · تبدأ بعد <b data-live-to="${g.startAt}"></b></div>`;
  return `<div class="live-card">
    <div class="live-badge"><i></i> ${g.status === 'LIVE' ? 'جارية الآن' : 'مسابقة مباشرة'}</div>
    <h3>${esc(g.title)}</h3>
    <div class="live-facts">
      <span>💰 ${g.fee ? `الدخول: ${g.fee} نقطة` : 'الدخول مجاني'}</span>
      <span>⏰ تبدأ ${liveClock(g.startAt)}</span>
      <span>👥 ${g.players}${g.maxPlayers ? ` / ${g.maxPlayers}` : ''} لاعبًا</span>
    </div>
    ${prizes ? `<div class="live-prizes">🎁 الجوائز: ${prizes}</div>` : ''}
    ${g.status === 'REGISTRATION' && !joined ? `<div class="live-soon">يُغلق التسجيل بعد <b data-live-to="${g.regClose}">${liveLeft(g.regClose - now)}</b></div>` : ''}
    ${btn}
  </div>`;
}
function liveRenderCard(){
  const box = $('live-card'); if(!box) return;
  const jn = liveJoined(), now = liveNow();
  const act = liveActiveGames().slice(0, 2), done = LIVE.games.filter(x => x.status === 'FINISHED' && jn[x.id]);
  if(!act.length && !done.length){ box.innerHTML = ''; box.classList.add('hide'); return; }
  box.classList.remove('hide');
  box.innerHTML = act.map(g => liveCardHTML(g, !!jn[g.id], now)).join('')
    + (done.length ? `<div class="live-done">${done.map(g => `<button type="button" onclick="liveOpenRoom('${esc(g.id)}')">🏁 نتائج «${esc(g.title)}»</button>`).join('')}</div>` : '');
  liveStartTick();
}
async function liveJoin(id){
  const g = LIVE.games.find(x => x.id === id); if(!g) return;
  const useTicket = g.fee && MYPERKS.ticket > 0;
  if(g.fee && !(await ask(useTicket ? { icon: '🎟️', title: g.title, yes: 'ادخل بالتذكرة', no: 'ليس الآن',
    msg: `ستُستخدم تذكرة مسابقة واحدة بدل ${g.fee} نقطة (لديك ${MYPERKS.ticket}). تُعاد لك إذا أُلغيت المسابقة.` }
    : { icon: '🎮', title: g.title, yes: `ادخل −${g.fee}`, no: 'ليس الآن',
    msg: `سيُخصم ${g.fee} نقطة من رصيدك (${MYPTS}). تُعاد لك فقط إذا أُلغيت المسابقة قبل بدايتها.` }))) return;
  let j = {};
  try{ const r = await storeFetch(liveApi() + '/live/join', { body: JSON.stringify({ game: id }) }); j = await r.json().catch(() => ({})); }
  catch(e){ toast('تعذّر الاتصال — لم يُخصم شيء، حاول مجددًا', 'bad'); return; }
  if(!j.ok){
    const m = { insufficient: `رصيدك ${j.bal ?? MYPTS} لا يكفي — الدخول ${g.fee} نقطة`, registration_closed: 'انتهى التسجيل', full: 'اكتمل عدد اللاعبين', not_allowed: 'هذه المسابقة ليست لفصلك', auth_cancel: '' }[j.error];
    if(m !== '') toast(m || 'تعذّر الدخول', 'bad'); return;
  }
  if(typeof j.bal === 'number'){ MYPTS = j.bal; try{ syncBalanceUI(); }catch(e){} }
  if(j.perks) MYPERKS = j.perks;
  liveMarkJoined(id);
  toast(j.already ? '✅ أنت مسجّل في المسابقة' : j.ticket ? '✅ تم تسجيلك بالتذكرة 🎟️' : (g.fee ? `✅ تم تسجيلك · خُصم ${g.fee} نقطة` : '✅ تم تسجيلك'), 'good');
  g.players += j.already ? 0 : 1; liveRenderCard();
  liveOpenRoom(id);
}

/* 🎈 شكل «صيد البالونات»: الخيارات بالونات تطير من أسفل السماء إلى أعلاها بسرعات مختلفة، وكل بالون
   يخرج يعود من الأسفل حتى نهاية الوقت — التحدي تصويب وسرعة، ولا يضيع خيار يعرفه الطالب نهائيًا.
   بعد الإجابة وفي الكشف تستقر في أماكن ظاهرة. مواقعها ثابتة لكل طالب وسؤال (بذرة من اللعبة والطالب والسؤال) ومختلفة
   بين الطلاب، فلا يُنقل «مكان» الإجابة من زميل. الضغط يرسل رقم الخيار نفسه — التصحيح في الخادم. */
const LIVE_BALLOON_COLORS = ['#F6A6B2','#9FD3F0','#F7D08A','#A9E0BC','#D7B8F3','#FBC4A0'];
function liveSeed(str){ let h = 2166136261; for(const c of String(str)){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
function liveBalloonsHTML(Q, k, picked, answered, rev){
  const rnd = liveSeed(`${LIVE.cur}|${mySid}|${k}`), n = Q.o.length;
  const cols = [...Array(n).keys()]; for(let i = n - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [cols[i], cols[j]] = [cols[j], cols[i]]; }
  const settled = answered || !!rev;                       // بعد الإجابة أو في الكشف: تستقر
  const w = 100 / n;
  const speeds = [...Array(n)].map((_, i) => 3.2 + (i / Math.max(1, n - 1)) * 2.8);      // 3.2 ث … 6 ث (متفاوتة)
  for(let i = n - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [speeds[i], speeds[j]] = [speeds[j], speeds[i]]; }
  return `<div class="lvb-sky${settled ? ' settled' : ' flying'}">
    <span class="lvb-cloud" style="top:12%">☁️</span><span class="lvb-cloud" style="top:48%;animation-delay:-7s">☁️</span>
    ${Q.o.map((o, i) => {
      const col = cols[i], top = 8 + rnd() * 34, delay = (rnd() * 0.5).toFixed(2), bob = (2.2 + rnd() * 1.4).toFixed(2);
      let cls = 'lvb';
      if(rev){ if(i === rev.correct) cls += ' right'; else if(rev.mine && rev.mine.choice === i) cls += ' wrong popped'; else cls += ' gone'; }
      else if(picked === i) cls += ' popped mine'; else if(answered) cls += ' gone';
      const tag = rev && i === rev.correct ? '<em>✓ الصحيحة</em>' : (picked === i && !rev) ? '<em>💥 اخترته</em>' : (rev && rev.mine && rev.mine.choice === i) ? '<em>✗ اخترته</em>' : '';
      const dur = speeds[i], off = -(rnd() * dur).toFixed(2), sw = (1.6 + rnd() * 1.2).toFixed(2);
      const pos = settled ? `top:${top.toFixed(1)}%;--d:${delay}s;--bob:${bob}s` : `--dur:${dur.toFixed(2)}s;--off:${off}s;--sw:${sw}s`;
      return `<button type="button" class="${cls}" ${answered || rev ? 'disabled' : ''} onclick="liveBalloonPop(this,${i})"
        style="left:calc(${col * w}% + ${w * 0.08}%);width:${w * 0.84}%;${pos}">
        <span class="lvb-sw"><span class="bd" style="background:${LIVE_BALLOON_COLORS[col % LIVE_BALLOON_COLORS.length]}">${esc(o)}</span><i></i>${tag}</span></button>`;
    }).join('')}
  </div>`;
}
function liveBalloonPop(btn, i){ if(btn.disabled) return; btn.disabled = true; btn.classList.add('popping'); setTimeout(() => liveAnswer(i), 180); }

/* 🚀 سباق الصواريخ: الطالب يقود صاروخه بإصبعه (أو الأسهم) ويطير عبر بوابة إجابته.
   البوابات مقفلة أول ثانيتين (قراءة السؤال)، وتنزل في موجات بترتيب عشوائي حتى نهاية الوقت.
   الكويكب يبطئ الصاروخ ثانية ولا يُسقط الإجابة. المرور عبر بوابة يرسل رقم الخيار — التصحيح في الخادم.
   اللعبة ترسم في لوحة ثابتة لا تُعاد مع تحديثات الخادم (حالتها في LIVE_RK طوال السؤال). */
const LIVE_RK = { q: -1, raf: 0, cv: null, S: null, answered: false };
function liveRocketHTML(k){ return `<div class="lvr"><canvas id="lvr-cv" data-q="${k}" aria-label="قُد الصاروخ إلى بوابة الإجابة"></canvas><div class="lvr-hint" id="lvr-hint">اسحب بإصبعك لتقود الصاروخ</div></div>`; }
function liveRocketStart(Q, k, qStart, qEnd, answered){
  const cv = $('lvr-cv'); if(!cv) return;
  if(LIVE_RK.q === k && LIVE_RK.cv === cv){ if(answered) LIVE_RK.answered = true; return; }
  cancelAnimationFrame(LIVE_RK.raf);
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.max(260, Math.min(460, cv.parentElement.clientWidth || 360));
  const H = Math.round(Math.min(430, Math.max(300, (window.innerHeight || 700) * 0.46)));
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = Q.o.length, laneW = W / n, lockUntil = qStart + 2000;
  const spd = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) ? 0.55 : 1;
  const S = { r: { x: W / 2, y: H - 54, tx: W / 2 }, gates: [], ast: [], stun: 0, last: 0, keys: {}, picked: -1 };
  LIVE_RK.q = k; LIVE_RK.cv = cv; LIVE_RK.S = S; LIVE_RK.answered = !!answered;
  const stars = [...Array(34)].map((_, i) => ({ x: (i * 53) % W, s: 1 + i % 3 }));
  const spawn = () => { const ord = [...Array(n).keys()]; for(let i = n - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [ord[i], ord[j]] = [ord[j], ord[i]]; } S.gates.push({ y: -46, ord }); };
  const toX = e => { const b = cv.getBoundingClientRect(); return (e.clientX - b.left) * (W / b.width); };
  cv.onpointerdown = e => { try{ cv.setPointerCapture(e.pointerId); }catch(_){} S.r.tx = toX(e); };
  cv.onpointermove = e => { if(e.buttons || e.pointerType === 'touch') S.r.tx = toX(e); };
  const kd = e => { if(e.key === 'ArrowRight'){ S.keys.R = 1; e.preventDefault(); } if(e.key === 'ArrowLeft'){ S.keys.L = 1; e.preventDefault(); } };
  const ku = e => { if(e.key === 'ArrowRight') S.keys.R = 0; if(e.key === 'ArrowLeft') S.keys.L = 0; };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  const fit = (t, w) => { let f = 14; x.font = `800 ${f}px system-ui,sans-serif`; while(x.measureText(t).width > w - 8 && f > 10){ f--; x.font = `800 ${f}px system-ui,sans-serif`; }
    if(x.measureText(t).width <= w - 8) return t; let s = t; while(s.length > 1 && x.measureText(s + '…').width > w - 8) s = s.slice(0, -1); return s + '…'; };
  const hint = t => { const h = $('lvr-hint'); if(h && h.textContent !== t) h.textContent = t; };
  const frame = now => {
    if(!document.body.contains(cv) || LIVE_RK.q !== k){ removeEventListener('keydown', kd); removeEventListener('keyup', ku); return; }
    const dt = Math.min(40, now - (S.last || now)); S.last = now; const t = liveNow();
    if(S.keys.R) S.r.tx += 6; if(S.keys.L) S.r.tx -= 6; S.r.tx = Math.max(18, Math.min(W - 18, S.r.tx));
    const slow = S.stun > 0 ? 0.25 : 1; S.r.x += (S.r.tx - S.r.x) * 0.25 * slow; if(S.stun > 0) S.stun -= dt;
    const open = t >= lockUntil && t < qEnd && !LIVE_RK.answered;
    if(open && (!S.gates.length || S.gates[S.gates.length - 1].y > H * 0.4)) spawn();
    S.gates.forEach(g => g.y += dt * 0.085 * spd * slow);
    if(open){ for(const g of S.gates){ if(!g.hit && g.y + 32 >= S.r.y - 18 && g.y <= S.r.y){
      g.hit = true; const lane = Math.max(0, Math.min(n - 1, Math.floor(S.r.x / laneW))); const choice = g.ord[lane];
      LIVE_RK.answered = true; S.picked = choice; S.hitGate = g; liveAnswer(choice); break; } } }
    S.gates = S.gates.filter(g => g.y < H + 40);
    if(!LIVE_RK.answered && t < qEnd && t >= lockUntil - 800 && Math.random() < dt * 0.0017 * spd) S.ast.push({ x: 16 + Math.random() * (W - 32), y: -16, r: 7 + Math.random() * 8, v: (0.1 + Math.random() * 0.1) * spd });
    for(const a of S.ast){ a.y += a.v * dt * slow; if(S.stun <= 0 && Math.hypot(a.x - S.r.x, a.y - S.r.y) < a.r + 11){ S.stun = 1000; a.hit = true; } }
    S.ast = S.ast.filter(a => a.y < H + 24 && !a.hit);
    x.fillStyle = '#0B1437'; x.fillRect(0, 0, W, H); x.fillStyle = 'rgba(181,212,244,.75)';
    stars.forEach((s, i) => { x.fillRect(s.x, (i * 97 + now * 0.04 * s.s * spd) % H, s.s, s.s); });
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    S.gates.forEach(g => g.ord.forEach((opt, i) => { const x0 = i * laneW + 4, w = laneW - 8;
      x.fillStyle = g === S.hitGate && opt === S.picked ? '#2E6BB8' : '#534AB7'; x.beginPath(); x.roundRect ? x.roundRect(x0, g.y, w, 34, 8) : x.rect(x0, g.y, w, 34); x.fill();
      x.fillStyle = '#FFFFFF'; x.fillText(fit(String(Q.o[opt]), w), x0 + w / 2, g.y + 17); }));
    x.fillStyle = '#8A8FA3'; S.ast.forEach(a => { x.beginPath(); x.arc(a.x, a.y, a.r, 0, 7); x.fill(); });
    x.save(); x.translate(S.r.x, S.r.y); if(S.stun > 0 && Math.floor(S.stun / 90) % 2) x.globalAlpha = 0.35;
    x.fillStyle = '#E6F1FB'; x.beginPath(); x.moveTo(0, -24); x.lineTo(12, 10); x.lineTo(-12, 10); x.closePath(); x.fill();
    x.fillStyle = '#378ADD'; x.beginPath(); x.arc(0, -5, 4.5, 0, 7); x.fill();
    x.fillStyle = '#EF9F27'; x.beginPath(); x.moveTo(-6, 10); x.lineTo(0, 20 + Math.random() * 7); x.lineTo(6, 10); x.closePath(); x.fill(); x.restore();
    if(t < lockUntil){ x.fillStyle = 'rgba(11,20,55,.55)'; x.fillRect(0, 0, W, H); x.fillStyle = '#FFFFFF'; x.font = '800 17px system-ui,sans-serif'; x.fillText(`اقرأ السؤال… البوابات بعد ${Math.ceil((lockUntil - t) / 1000)}`, W / 2, H / 2); }
    hint(LIVE_RK.answered ? '✓ تم استلام إجابتك — بانتظار انتهاء الوقت' : S.stun > 0 ? '💥 اصطدام! تباطأ صاروخك ثانية' : t >= qEnd ? '⌛ انتهى الوقت' : 'اسحب بإصبعك وطِر عبر بوابة الإجابة الصحيحة');
    LIVE_RK.raf = requestAnimationFrame(frame);
  };
  LIVE_RK.raf = requestAnimationFrame(frame);
}
/* السباق في لحظة الكشف: الخمسة الأوائل وصاروخك، وحركتك في الترتيب */
function liveRaceHTML(race){
  if(!race) return '';
  const lead = Math.max(1, race.lead), pos = sc => Math.round(Math.max(0, sc) / lead * 86);
  const sk = (LIVE.st && LIVE.st.game && LIVE.st.game.skin) || 'rocket';
  const ico = { rocket: '🚀', shapes: '⭐', jumper: '🤖', invaders: '🛸', claw: '🎁', boss: '⚔️' }[sk] || '🚀', goal = sk === 'rocket' ? '🪐 المريخ' : sk === 'boss' ? '⚔️ الأكثر ضررًا' : '🏁 خط النهاية';
  const row = (p, i, me) => `<div class="lvr-row${me ? ' me' : ''}"><span class="lvr-nm">${i}. ${esc(me && !p.name ? 'أنت' : p.name)}${me ? ' <small>(أنت)</small>' : ''}</span><div class="lvr-track"><i class="${ico === '🚀' ? '' : 'up'}" style="--p:${pos(p.score)}%">${ico}</i></div><b>${p.score}</b></div>`;
  const rows = race.top.map((p, i) => row(p, i + 1, p.me)).join('');
  const m = race.me, inTop = race.top.some(p => p.me);
  const mine = m && !inTop ? `<div class="lvr-gap">…</div>${row({ name: '', score: m.score }, m.rank, true)}` : '';
  let move = '';
  if(m && m.prevRank){ const d = m.prevRank - m.rank; move = d > 0 ? `⬆️ تقدّمت ${d} ${d === 1 ? 'مركزًا' : d <= 10 ? 'مراكز' : 'مركزًا'}` : d < 0 ? `تراجعت ${-d} — عوّضها في القادم` : 'حافظت على مركزك'; }
  return `<div class="lvr-race"><div class="lvr-mars">${goal}</div>${rows}${mine}
    ${m ? `<div class="lvr-rank">أنت في المركز <b>${m.rank}</b> من ${race.n}${move ? ` · ${move}` : ''}</div>` : ''}
    ${race.ahead ? `<div class="lvr-ahead">${race.ahead.gap > 0 ? `تحتاج <b>${race.ahead.gap + 1}</b> نقطة لتتجاوز ${esc(race.ahead.name)}` : `متعادل مع ${esc(race.ahead.name)} — كن أسرع!`}</div>` : ''}</div>`;
}

/* 🎨 تحدي الأشكال: أربعة أشكال ملوّنة كبيرة — الطالب يسحب شكل إجابته للأعلى ويرميه نحو الشاشة.
   الرمي فعل حركي مقصود (لا نقرة عابرة)، ثم يُرسل رقم الخيار للخادم كالمعتاد. */
const LIVE_SHAPES = [['▲', '#7B2CBF'], ['★', '#0FA3B1'], ['●', '#F77F00'], ['◆', '#E5386D'], ['⬟', '#2E6BB8'], ['✚', '#2F9E3A']];
function liveShapesHTML(Q, k, answered){
  if(answered) return `<div class="lvs-done"><span>🚀</span><b>رُمي شكلك!</b><small>انظر للشاشة وانتظر النتيجة</small></div>`;
  return `<div class="lvs" id="lvs" data-q="${k}"><div class="lvs-grid${Q.o.length <= 2 ? ' two' : ''}">${Q.o.map((o, i) => { const [sh, col] = LIVE_SHAPES[i % LIVE_SHAPES.length];
    return `<div class="lvs-tile" data-i="${i}" style="--c:${col}"><span class="lvs-sh">${sh}</span><b>${esc(o)}</b></div>`; }).join('')}</div>
    <div class="lvs-hint" id="lvs-hint">اسحب شكل إجابتك للأعلى وارمِه 🚀</div></div>`;
}
function liveShapesBind(k){
  const box = $('lvs'); if(!box || box.dataset.bound === String(k)) return; box.dataset.bound = String(k);
  let drag = null;
  const hint = (txt) => { const h = $('lvs-hint'); if(h){ h.textContent = txt; h.classList.remove('wig'); void h.offsetWidth; h.classList.add('wig'); } };
  box.querySelectorAll('.lvs-tile').forEach(tile => {
    tile.addEventListener('pointerdown', e => { if(box.dataset.thrown) return; e.preventDefault(); try{ tile.setPointerCapture(e.pointerId); }catch(_){} try{ Chip.unlock(); }catch(_){}
      drag = { tile, y0: e.clientY, t0: performance.now(), dy: 0 }; tile.classList.add('drag'); });
    tile.addEventListener('pointermove', e => { if(!drag || drag.tile !== tile) return; drag.dy = Math.min(0, e.clientY - drag.y0);
      tile.style.transform = `translateY(${drag.dy}px) scale(${1 + Math.min(0.12, -drag.dy / 900)}) rotate(${drag.dy / 30}deg)`; });
    const end = () => { if(!drag || drag.tile !== tile) return; const d = drag; drag = null; tile.classList.remove('drag');
      const v = -d.dy / Math.max(1, performance.now() - d.t0);          // سرعة الرمي
      if(d.dy < -70 || (d.dy < -30 && v > 0.6)){
        box.dataset.thrown = '1'; tile.classList.add('thrown'); box.querySelectorAll('.lvs-tile').forEach(x => { if(x !== tile) x.classList.add('dim'); });
        try{ Chip.play('laser'); navigator.vibrate && navigator.vibrate(25); }catch(_){}
        setTimeout(() => liveAnswer(Number(tile.dataset.i)), 280);
      } else { tile.style.transform = ''; hint(d.dy > -8 ? 'لا تكتفِ بالضغط — اسحبه للأعلى وارمِه! ⬆️' : 'أقوى! اسحبه لأعلى أكثر ⬆️'); } };
    tile.addEventListener('pointerup', end); tile.addEventListener('pointercancel', end);
  });
}

/* 👹 وحش الزعيم (تعاوني اونلاين): الجميع يضربون وحشًا واحدًا بشريط صحة مشترك.
   الإجابة تُرمى نحو الوحش (حركة تحدي الأشكال)، وضربات الزملاء تظهر لحظيًا («⚡ خالد -85»).
   الإطار ثابت (لا يُعاد مع التحديثات)، والأرقام والحركة تُحدَّث بـ liveBossUpdate. */
const LIVE_BOSS = { lastAt: 0, game: '' };
function liveBossPanel(){
  return `<div class="lvboss"><div class="lvboss-stage"><canvas id="lvboss-cv" width="22" height="18"></canvas><div class="lvboss-fx" id="lvboss-fx"></div></div>
    <div class="lvboss-hp"><i id="lvboss-bar"></i><span id="lvboss-txt"></span></div>
    <div class="lvboss-feed" id="lvboss-feed">⚔️ اضربوه معًا — كل إجابة صحيحة ضربة</div></div>`;
}
function liveBossUpdate(s){
  const B = s && s.boss; if(!B) return;
  const cv = $('lvboss-cv'); if(cv && !cv.dataset.drawn){ const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(sprCanvas('boss'), 0, 0); cv.dataset.drawn = '1'; }
  const hp = Math.max(0, B.max - B.dmg), pct = Math.round(hp / Math.max(1, B.max) * 100);
  const bar = $('lvboss-bar'), txt = $('lvboss-txt');
  if(bar){ bar.style.width = pct + '%'; bar.classList.toggle('low', pct < 30); }
  if(txt) txt.textContent = hp > 0 ? `❤️ ${hp} / ${B.max}` : '💀 هُزم الوحش!';
  const L = B.last, gid = s.game && s.game.id;
  if(LIVE_BOSS.game !== gid){ LIVE_BOSS.game = gid; LIVE_BOSS.lastAt = L ? L.at : 0; return; }   // لحظة فتح الشاشة: ما قبلها ليس «ضربة جديدة»
  if(L && L.at && L.at !== LIVE_BOSS.lastAt){
    LIVE_BOSS.lastAt = L.at;
    {
      const fx = $('lvboss-fx'), st = document.querySelector('.lvboss-stage');
      if(fx){ const d = document.createElement('b'); d.textContent = `-${L.dmg}`; d.style.left = (25 + Math.random() * 50) + '%'; fx.appendChild(d); setTimeout(() => d.remove(), 1100); }
      if(st){ st.classList.remove('hit'); void st.offsetWidth; st.classList.add('hit'); }
      const fd = $('lvboss-feed'); if(fd){ fd.textContent = `⚡ ${L.name} ضرب الوحش −${L.dmg}`; fd.classList.remove('pop'); void fd.offsetWidth; fd.classList.add('pop'); }
      try{ Chip.play('boom'); }catch(_){}
    }
  }
}

/* 🕹️ أشكال الأركيد في المسابقة: لوحة ثابتة لا تُعاد مع تحديثات الخادم، والاختيار يُرسل للخادم */
const LIVE_ARCADE = ['jumper', 'invaders', 'claw'];
const LIVE_ARC = { q: -1, host: null };
function liveArcadeHTML(k, answered){ return answered ? `<div class="lvr-hint" style="margin:1rem 0">✓ تم استلام إجابتك — بانتظار انتهاء الوقت</div>` : `<div class="lva" id="lva-host" data-q="${k}"></div>`; }
function liveArcadeStart(skin, Q, k, qStart, qEnd){
  const host = $('lva-host'); if(!host) return;
  if(LIVE_ARC.q === k && LIVE_ARC.host === host) return;
  LIVE_ARC.q = k; LIVE_ARC.host = host;
  LIVE_ARC.ctl = arcadeMount(host, { game: skin, options: Q.o, lockUntil: qStart + 2000, now: liveNow,
    onPick: i => liveAnswer(i), active: () => !!LIVE.cur && LIVE_ARC.q === k && liveNow() < qEnd + 300 });
}

/* في نتائج مسابقة: إن كانت هناك مسابقة تالية تُعرض بزر الانتقال إليها */
function liveNextPromo(curId){
  const n = liveActiveGames().find(x => x.id !== curId); if(!n) return '';
  const joined = !!liveJoined()[n.id];
  const act = joined || n.status === 'LIVE' || n.status === 'WAITING' ? `liveOpenRoom('${esc(n.id)}')` : `liveCloseRoom();setTimeout(()=>{const c=$('live-card');if(c)c.scrollIntoView({behavior:'smooth',block:'center'})},300)`;
  return `<button type="button" class="live-next" onclick="${act}"><span>🔴 التالية: <b>${esc(n.title)}</b></span><small>${n.status === 'LIVE' ? 'جارية الآن' : `تبدأ ${liveClock(n.startAt)}`} — ${joined ? 'ادخل غرفتها ←' : n.status === 'REGISTRATION' ? 'سجّل الآن ←' : 'انتقل إليها ←'}</small></button>`;
}

/* ── الغرفة: انتظار · أسئلة · نتائج ── */
function liveOpenRoom(id){
  let el = $('live-room');
  if(!el){ el = document.createElement('div'); el.id = 'live-room'; el.className = 'live-room'; document.body.appendChild(el); }
  el.classList.remove('hide'); document.body.classList.add('live-open');
  LIVE.cur = id; LIVE.st = null; LIVE.lastHtml = '';           // كل كتابة مباشرة تُسقط «آخر رسم» — وإلا لا يُرسم ما يطابقه
  el.innerHTML = '<div class="live-wrap"><p class="muted" style="text-align:center;margin-top:30vh">⏳ جارٍ الاتصال…</p></div>';
  livePoll(); liveStartTick();
}
function liveCloseRoom(){
  LIVE.cur = null; LIVE.lastHtml = ''; clearTimeout(LIVE.poll);
  const el = $('live-room'); if(el) el.classList.add('hide'); document.body.classList.remove('live-open');
  liveLoadOpen();
}
async function livePoll(){
  clearTimeout(LIVE.poll); const id = LIVE.cur; if(!id) return;
  let j = null, err = '';
  try{
    const t0 = Date.now();
    const r = await storeFetch(liveApi() + '/live/state', { body: JSON.stringify({ game: id }) });
    j = await r.json().catch(() => null);
    if(r.status === 401){ err = 'auth'; } else if(j && j.ok){ liveSync(j.now, t0); } else err = (j && j.error) || 'net';
  }catch(e){ err = 'net'; }
  if(id !== LIVE.cur) return;
  if(err === 'auth'){ liveRender({ authNeeded: true }); return; }                        // لا نطلب الرمز كل ثانية
  if(err){ LIVE.offline = true; liveRender(); LIVE.poll = setTimeout(livePoll, 2000); return; }
  LIVE.offline = false; LIVE.st = j;
  if(j.phase && j.phase.status === 'LIVE' && j.question){ const k = j.question.i; if(j.my && j.my.answered && LIVE.mine[k] === undefined) LIVE.mine[k] = -1; }
  liveRender();
  // الطلب التالي: عند حد المرحلة القادمة، أو بعد 4 ث على الأكثر
  const ph = j.phase || {}, now = liveNow();
  let next = 4000;
  if(ph.status === 'REGISTRATION') next = Math.min(4000, Math.max(300, j.game.regClose - now + 200));
  else if(ph.status === 'WAITING') next = Math.min(4000, Math.max(250, j.game.startAt - now + 200));
  else if(ph.status === 'LIVE') next = Math.min(j.game && j.game.skin === 'boss' && ph.phase === 'question' ? 1500 : 4000, Math.max(250, (ph.phase === 'question' ? ph.qEnd : ph.nextAt) - now + 200));   // الوحش: ضربات الزملاء لحظيًا
  else if(ph.status === 'FINISHED' || ph.status === 'CANCELLED') { next = 0; if(ph.status === 'FINISHED') setTimeout(() => { try{ gateLoad(myName, { restored: true }); }catch(e){} }, 3000); }
  if(next) LIVE.poll = setTimeout(livePoll, next);
}
async function liveAnswer(choice){
  const s = LIVE.st; if(!s || !s.question || LIVE.busy) return;
  const q = s.question.i; if(LIVE.mine[q] !== undefined || (s.my && s.my.answered)) return;
  LIVE.busy = true; LIVE.mine[q] = choice; liveRender();
  let j = {};
  try{ const r = await storeFetch(liveApi() + '/live/answer', { body: JSON.stringify({ game: LIVE.cur, q, choice }) }); j = await r.json().catch(() => ({})); }
  catch(e){ j = { error: 'net' }; }
  LIVE.busy = false;
  if(j.ok || j.error === 'already_answered'){ if(s.my) s.my.answered = true; }
  else { delete LIVE.mine[q]; if(LIVE_RK.q === q && j.error !== 'closed') LIVE_RK.answered = false;
    if(LIVE_ARC.q === q && j.error !== 'closed'){ LIVE_ARC.q = -1; LIVE.lastHtml = ''; setTimeout(liveRender, 50); }   // فشل الإرسال: لعبة جديدة للمحاولة
    toast(j.error === 'closed' ? 'انتهى وقت السؤال' : j.error === 'net' ? 'تعذّر الإرسال — أعد المحاولة بسرعة' : 'لم تُقبل الإجابة', 'bad'); }
  liveRender();
}
function liveRender(extra){
  const el = $('live-room'); if(!el || !LIVE.cur) return;
  const s = LIVE.st, now = liveNow();
  const top = `<div class="live-top"><button class="live-x" onclick="liveCloseRoom()" aria-label="إغلاق">✕</button><b>${esc((s && s.game && s.game.title) || 'المسابقة')}</b>${LIVE.offline ? '<span class="live-net">🟡 إعادة الاتصال…</span>' : ''}</div>`;
  if(extra && extra.authNeeded){ LIVE.lastHtml = ''; el.innerHTML = `<div class="live-wrap">${top}<div class="live-center"><p>🔐 أدخل رمزك للمتابعة في المسابقة</p><button class="btn tick" onclick="livePoll()">إدخال الرمز</button></div></div>`; return; }
  if(!s){ return; }
  const ph = s.phase || {}, g = s.game || {};
  let body = '';
  if(ph.status === 'CANCELLED'){
    body = `<div class="live-center"><div class="live-big">🚫</div><h2>أُلغيت المسابقة</h2>${g.cancelReason === 'min' ? `<p>لم يكتمل العدد المطلوب للبدء (${g.minPlayers} طلاب على الأقل).</p>` : ''}<p class="muted">${g.fee ? `أُعيدت رسوم الدخول (${g.fee} نقطة) إلى رصيدك.` : ''}</p><button class="btn" onclick="liveCloseRoom()">رجوع</button></div>`;
  } else if(ph.status === 'REGISTRATION' || ph.status === 'WAITING' || ph.status === 'SCHEDULED'){
    body = `<div class="live-center">
      ${s.joined ? `<div class="live-ok">✅ تم تسجيلك${g.fee ? ` · 💰 خُصم ${g.fee} نقطة` : ''}</div>` : ''}
      <p class="muted">⏳ تبدأ المسابقة بعد</p>
      <div class="live-count" data-live-to="${g.startAt}"></div>
      <p><b>👥 ${s.players}${g.maxPlayers ? ` / ${g.maxPlayers}` : ''}</b> لاعبًا · ${g.n} ${g.n > 10 ? 'سؤالًا' : 'أسئلة'}</p>
      ${g.minPlayers && s.players < g.minPlayers && ph.status !== 'SCHEDULED' ? `<p class="live-min">👥 ينقصنا <b>${g.minPlayers - s.players === 1 ? 'لاعب واحد' : g.minPlayers - s.players === 2 ? 'لاعبان' : (g.minPlayers - s.players) + ' لاعبين'}</b> لتبدأ المسابقة — ادعُ زملاءك!${g.extends ? ' (مُدّد التسجيل)' : ''}</p>` : ''}
      <div class="live-roster">${(s.roster || []).map(p => `<span class="${p.online ? 'on' : ''}">${p.online ? '🟢' : '🟡'} ${esc(p.name)}</span>`).join('')}</div>
    </div>`;
  } else if(ph.status === 'LIVE' && !s.joined){
    body = `<div class="live-center"><div class="live-big">🎮</div><h2>المسابقة جارية</h2><p class="muted">لم تسجّل فيها قبل البداية.</p><button class="btn" onclick="liveCloseRoom()">رجوع</button></div>`;
  } else if(ph.status === 'LIVE' && s.question){
    const Q = s.question, k = Q.i, picked = LIVE.mine[k], answered = !!(s.my && s.my.answered) || picked !== undefined;
    const rev = ph.phase === 'reveal' ? s.reveal : null;
    const opts = Q.o.map((o, i) => {
      let cls = 'live-opt';
      if(rev){ if(i === rev.correct) cls += ' right'; else if(rev.mine && rev.mine.choice === i) cls += ' wrong'; }
      else if(picked === i) cls += ' picked';
      return `<button class="${cls}" ${answered || rev ? 'disabled' : ''} onclick="liveAnswer(${i})"><span>${['أ','ب','ج','د','هـ','و'][i]}</span>${esc(o)}</button>`;
    }).join('');
    const status = rev
      ? (rev.mine ? (rev.mine.correct ? `<div class="live-res good">✅ إجابة صحيحة <b>+${rev.mine.pts}</b> نقطة</div>` : `<div class="live-res bad">❌ إجابة خاطئة · 0</div>`) : `<div class="live-res bad">⌛ لم تُجب · 0</div>`)
        + `<p class="muted">${k + 1 < g.n ? 'السؤال التالي بعد' : 'النتائج بعد'} <b data-live-to="${ph.nextAt}"></b></p>`
      : (answered ? `<div class="live-res wait">✓ تم استلام إجابتك — بانتظار انتهاء الوقت</div>` : '');
    body = `<div class="live-q">
      <div class="live-qhead"><span>السؤال ${k + 1} / ${g.n}</span><span class="live-score">⭐ ${s.my ? s.my.score : 0}</span></div>
      ${rev ? '' : `<div class="live-timer" data-live-to="${ph.qEnd}" data-live-dur="${g.qMs}"></div>`}
      <h2 class="live-qt">${esc(Q.q)}</h2>
      ${g.skin === 'balloons' ? liveBalloonsHTML(Q, k, picked, answered, rev) : g.skin === 'rocket' ? (rev ? liveRaceHTML(s.race) : liveRocketHTML(k))
        : LIVE_ARCADE.includes(g.skin) ? (rev ? liveRaceHTML(s.race) : liveArcadeHTML(k, !!(s.my && s.my.answered) && LIVE_ARC.q !== k))
        : g.skin === 'shapes' ? (rev ? liveRaceHTML(s.race) : liveShapesHTML(Q, k, answered))
        : g.skin === 'boss' ? liveBossPanel() + (rev ? liveRaceHTML(s.race) : liveShapesHTML(Q, k, answered)) : `<div class="live-opts">${opts}</div>`}
      ${(g.skin === 'rocket' || g.skin === 'shapes' || g.skin === 'boss' || LIVE_ARCADE.includes(g.skin)) && !rev ? '' : status}
      ${rev && s.my && s.my.streak >= 2 ? `<div class="live-streak">🔥 ${s.my.streak} إجابات صحيحة متتالية!</div>` : ''}
    </div>`;
  } else if(ph.status === 'FINISHED' && s.results){
    const B = s.results.board || [], me = B.find(x => x.me), medal = ['🥇','🥈','🥉'];
    const bossEnd = g.skin === 'boss' && s.boss ? (s.boss.dmg >= s.boss.max ? `<div class="lvboss-end win">🏆 هزمتم الوحش معًا! <small>${s.boss.hits} ضربة من الفريق</small></div>` : `<div class="lvboss-end">👹 نجا الوحش — بقي له ${s.boss.max - s.boss.dmg} <small>اقتربتم! ${s.boss.hits} ضربة من الفريق</small></div>`) : '';
    body = `<div class="live-res-wrap">
      <h2 style="text-align:center">🏁 النتائج النهائية</h2>${bossEnd}
      ${me ? `<div class="live-me">مركزك <b>${me.rank}</b> من ${B.length} · ${me.score} نقطة · ${me.correct} / ${s.results.n} صحيحة${me.prize ? `<br>🎁 <b>+${me.prize}</b> نقطة أُضيفت لرصيدك` : ''}</div>` : ''}
      <div class="live-podium">${B.slice(0, 3).map((x, i) => `<div class="p${i + 1}${x.me ? ' me' : ''}"><span>${medal[i]}</span><b class="${nmCls(x.glow)}">${esc(x.name)}</b><small>${x.score} نقطة${x.prize ? ` · 🎁 ${x.prize}` : ''}</small></div>`).join('')}</div>
      <ol class="live-board" start="4">${B.slice(3).map(x => `<li class="${x.me ? 'me' : ''}"><span class="${nmCls(x.glow)}">${esc(x.name)}</span><b>${x.score}</b></li>`).join('')}</ol>
      ${liveNextPromo(g.id)}
      <button class="btn" style="width:100%;margin-top:.8rem" onclick="liveCloseRoom()">رجوع</button>
    </div>`;
  } else {
    body = `<div class="live-center"><p class="muted">⏳ جارٍ التحديث…</p></div>`;
  }
  const html = `<div class="live-wrap">${top}${body}</div>`;
  if(html !== LIVE.lastHtml || !el.firstChild){ el.innerHTML = html; LIVE.lastHtml = html; }
  liveStartTick();
  if(s && s.joined && s.game && s.game.skin === 'rocket' && s.phase && s.phase.status === 'LIVE' && s.phase.phase === 'question' && s.question)
    liveRocketStart(s.question, s.question.i, s.phase.qStart, s.phase.qEnd, !!(s.my && s.my.answered) || LIVE.mine[s.question.i] !== undefined);
  if(s && s.joined && s.game && (s.game.skin === 'shapes' || s.game.skin === 'boss') && s.phase && s.phase.status === 'LIVE' && s.phase.phase === 'question' && s.question) liveShapesBind(s.question.i);
  if(s && s.game && s.game.skin === 'boss') liveBossUpdate(s);
  if(s && s.joined && s.game && LIVE_ARCADE.includes(s.game.skin) && s.phase && s.phase.status === 'LIVE' && s.phase.phase === 'question' && s.question)
    liveArcadeStart(s.game.skin, s.question, s.question.i, s.phase.qStart, s.phase.qEnd);
}
/* عدّاد محلي بساعة الخادم: يحدّث الأرقام فقط (لا يعيد رسم الأزرار) */
function liveStartTick(){
  liveTickOnce();                                          // يملأ العدّادات فور الرسم (النص لا يدخل في مقارنة الرسم)
  if(LIVE.tick) return;
  LIVE.tick = setInterval(() => { if(!liveTickOnce()){ clearInterval(LIVE.tick); LIVE.tick = 0; } }, 250);
}
function liveTickOnce(){
  {
    const now = liveNow(); let any = false;
    document.querySelectorAll('[data-live-to]').forEach(e => {
      any = true; const to = Number(e.dataset.liveTo), left = to - now; e.textContent = liveLeft(left);
      if(e.dataset.liveDur){ const f = Math.max(0, Math.min(1, left / Number(e.dataset.liveDur))); e.style.setProperty('--f', f); e.classList.toggle('low', left < 3500); }
    });
    return any;
  }
}

function spAfterGateLoad(){
  try{ liveLoadOpen(); }catch(e){}
  spRender(); spVerify().catch(() => {});
  /* فتح إشعار التقرير: ./?open=report → افتح «تقريري» مباشرة (يُطلب الرمز السري إن لزم كالعادة) */
  if(spOpenReport){
    const _t = spOpenReport; spOpenReport = false;
    const tab = _t === true ? '' : _t;
    try{ const u = new URL(location.href); u.searchParams.delete('open'); u.searchParams.delete('tab'); history.replaceState(null, '', u.pathname + u.search + u.hash); }catch(e){}
    setTimeout(() => { if(typeof myRepOpen === 'function') myRepOpen(tab); }, 900);
  }
  /* إشعار رد المعلم: ./?open=ask → افتح «محادثاتك» */
  if(spOpenAsk){
    spOpenAsk = false;
    try{ const u = new URL(location.href); u.searchParams.delete('open'); history.replaceState(null, '', u.pathname + u.search + u.hash); }catch(e){}
    setTimeout(() => { try{ ASK_UI.open = true; askRender(); }catch(e){} const n = document.getElementById('space-ask'); if(n) n.scrollIntoView({ behavior:'smooth', block:'start' }); }, 1500);
  }
  if(spOpenNotices){
    spOpenNotices = false;
    try{ const u = new URL(location.href); u.searchParams.delete('open'); history.replaceState(null, '', u.pathname + u.search + u.hash); }catch(e){}
    setTimeout(() => { const n = document.querySelector('.space-notices'); if(n) n.scrollIntoView({ behavior:'smooth', block:'start' }); }, 1200);
  }
}

