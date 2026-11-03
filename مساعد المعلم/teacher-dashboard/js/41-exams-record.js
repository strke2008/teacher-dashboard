/* ═══════════ 📝 رصد الاختبارات + 📷 التصحيح الآلي — منقول من بوابة المعلم إلى لوحة التحكم ═══════════
   نُقل آليًا من بوابة المعلم كما هو داخل نطاق مغلق، وتوصيلاته في «41-exams-shim» أعلى الملف وأسفله — التعديل من الآن هنا مباشرة.
   يُحمَّل عند أول فتح لـ«رصد الاختبارات» (لا يثقل فتح اللوحة). */
(function(){
/* ───────────── 41-exams-shim: توصيل نص البوابة ببيانات اللوحة ─────────────
   البيانات: CT_DATA (نفس كائن الفصل) · الفترة: ctExamSP() · الحفظ: طابور اللوحة (ct_outbox_v1) فلا يضيع رصد دون شبكة */
const TPX = window.TPX = window.TPX || { cls: '' };
const $ = id => id === 'cls' ? { value: TPX.cls } : document.getElementById(id);
function TPX_STU(){ return (Array.isArray(STUDENTS) ? STUDENTS : []).map(s => s && String(s.id) === s.id ? s : { ...s, id: String(s && s.id) }); }
function list(cls){ return TPX_STU().filter(s => !cls || String(s.cls || '').trim() === cls).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar')); }
function classes(){ return ctClasses(); }
function ensure(){ if (!CT_DATA || typeof CT_DATA !== 'object') CT_DATA = {}; if (!CT_DATA.examBooks || typeof CT_DATA.examBooks !== 'object') CT_DATA.examBooks = {}; }
function gradeOf(){ return null; }   // اللوحة تحسب النهائي من الدفتر نفسه (مع درجات الزيادة)
function academicSem(){ const s = (((typeof DASH_ACADEMIC !== 'undefined' && DASH_ACADEMIC) || {}).semesters || {})[ctExamSP().sem] || {}; return { status: 'open', periodStatus: {}, periods: {}, activePeriod: 1, ...s }; }
function academicClosed(){ return !!ctExamSP().closed; }
function academicLockMsg(){ return academicSem().status === 'closed' ? 'الفصل مغلق.' : '🔒 هذه الفترة مغلقة — للعرض فقط.'; }
function academicPeriod(){ return (academicSem().periods || {})[String(ctExamSP().per)] || {}; }
/* 💾 حفظ: لقطة من دفتر الفترة إلى الطابور — الخادم يدمج كل درجة بوقتها (الأحدث يفوز) */
async function save(){ ensure(); const { sem, per } = ctExamSP(), b = ((CT_DATA.examBooks || {})[String(sem)] || {})[String(per)]; if (!b) return; qrDo({ k: 'exb', sem: String(sem), per: String(per), book: JSON.parse(JSON.stringify(b)) }); }

/* ───────────── نص البوابة ───────────── */
const VR_SUP = window.SpeechRecognition || window.webkitSpeechRecognition || null;
function vrMatch(nameToks){
  if(!nameToks.length) return { hits:[], scope:'' };
  const inCls = list($('cls')?.value || '');
  const test = arr => arr.filter(s => {
    const st = vrTokens(s.name);
    return nameToks.every(n => st.some(x => vrEq(x,n)));
  });
  // من يبدأ اسمه بما نُطق أولى ممن يحمله في وسط اسمه: «محمد» تعني محمد بن…
  // لا «سعود بن عبدالعزيز بن محمد». نضيّق فقط إن وُجد من يبدأ به.
  const prefer = arr => {
    const head = nameToks[0];
    const first = arr.filter(s => { const st = vrTokens(s.name); return st[0] && vrEq(st[0], head); });
    return first.length ? first : arr;
  };
  // تقريب خطأ الحرف الواحد: فقط إن لم يطابق أحد تمامًا
  const near = arr => arr.filter(s => { const st = vrTokens(s.name); return nameToks.every(n => st.some(x => vrNear(x,n))); });
  let hits = test(inCls);
  if(hits.length) return { hits: prefer(hits), scope:'cls' };
  hits = near(inCls);
  if(hits.length) return { hits: prefer(hits), scope:'cls' };
  const all = Array.isArray(TPX_STU())?TPX_STU():[];
  hits = test(all); if(!hits.length) hits = near(all);
  return { hits: hits.length ? prefer(hits) : hits, scope: hits.length ? 'all' : '' };
}

function vrSay(t){ const l=$('vr-live'); if(l && t) l.innerHTML = t; }
/* 🎙️ واجهة صوت موحّدة لكل الأماكن (الرصد · السلوك · الرسائل · الاختبارات):
   زر البدء ⟵ شريط استماع (ما يُسمع لحظيًا + إيقاف) · بطاقة لكل رصد مع تراجع خاص بها */
function vbOn(p, on){ if(on){ const bar=$(p+'-bar'), st=$(p+'-stop'); if(bar && st && !bar.querySelector('.vb-v')){ const v=document.createElement('small'); v.className='vb-v'; v.textContent=VB_VER; st.before(v); } } const bar=$(p+'-bar'), btn=$(p+'-btn'); if(bar) bar.hidden=!on; if(btn) btn.hidden=!!on; }
function vbLive(p, html){ const l=$(p+'-live'); if(l) l.innerHTML=html; }
function vbInterim(p, r){ if(r && !r.isFinal){ const t=String(r[0]?.transcript||'').trim(); if(t) vbLive(p, `🎙️ <b>«${esc(t)}»</b>`); return true; } return false; }
function vbCard(boxId, {label, cls, name, heard, undo, flash}){
  const e=$(boxId); if(!e) return;
  const c=document.createElement('div'); c.className='vr-card '+(cls||'g');
  c.innerHTML=`<span class="vr-st">${esc(label)}</span><div class="vr-nm">${esc(name)}${heard?`<small>سمعت: «${esc(heard)}»</small>`:''}</div>`;
  if(undo){ const u=document.createElement('button'); u.type='button'; u.className='vr-u'; u.textContent='↩︎ تراجع';
    u.onclick=async()=>{ if(await undo()===false) return; c.classList.add('undone'); u.remove(); }; c.appendChild(u); }
  e.prepend(c); [...e.children].slice(2).forEach(k=>k.remove());
  if(flash) setTimeout(()=>{ const row=document.querySelector(flash); if(row){ row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); } },60);
}
/* 🎙️ محرّك استماع واحد لكل الأماكن — على طريقة النسخة التي كانت تعمل على iPhone:
   جملة واحدة في كل جولة (continuous=false)، وعند انتهائها نعيد تشغيل الكائن نفسه.
   • النص اللحظي (interim) على Android والكمبيوتر فقط: على iPhone يُبقي الجملة مفتوحة فلا تُعتمد،
     فيبدو أنه سمعك مرة ثم توقف.
   • إن رفض الجهاز إعادة الاستماع يظهر «⏸️ تابِع» بدل صمت مخادع.
   • محرّك واحد يعمل في كل لحظة: بدء أي استماع يوقف الآخر.
   • سجل أحداث مختصر: اضغط على شريط الاستماع لعرضه (للتشخيص). */
const VB_VER = 'صوت ١٠';
const VB_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/* 🍎 iPhone — جلسة استماع واحدة للصفحة كلها، مشتركة بين الرصد والسلوك والرسائل والاختبارات.
   ثبت من سجل الأحداث على جهاز المعلم:
   • الجلسة التي تُعاد تلقائيًا (بلا لمسة) تبدأ ولا يصلها صوت.
   • وبعد إغلاق الجلسة، جلسة جديدة في الصفحة نفسها لا يصلها صوت حتى يُعاد فتح المتصفح.
   لذا: جلسة مستمرة واحدة تبدأ بلمستك، و«إيقاف» يكتمها فقط (دقيقتان) بدل إغلاقها؛
   فإن فتحت الصوت مجددًا خلالها يكمل فورًا. بعدها تُغلق، ويُعاد تشغيل الكائن نفسه عند الحاجة.
   النص فيها يطول مع كلامك: نعتمد الجديد منه بعد سكوتك 1.3 ث (بعدّ الكلمات — iPhone يعدّل ما قبله). */
const VBI = { rec:null, active:false, owner:null, n:{}, idleT:0, offT:0, pend:null, err:'', endedAt:0 };
const vbiWords = t => vrNorm(t).split(' ').filter(Boolean);
function vbiCommit(i, t, why){
  const E = VBI.owner, w = vbiWords(t), n = VBI.n[i] || 0;
  if(w.length <= n) return; VBI.n[i] = w.length; VBI.pend = null;
  if(!E || !E.on) return;                       // مكتوم: يُستهلك ولا يُرصد
  const f = w.slice(n).join(' '); E.L(why + ' «' + f + '»'); E.worked = true; E.fire(f);
}
function vbiRec(fresh){
  if(VBI.rec && !fresh) return VBI.rec;
  const r = new VR_SUP();
  r.lang = 'ar-SA'; r.interimResults = true; r.maxAlternatives = 1; r.continuous = true;
  r.onstart = () => { VBI.active = true; VBI.n = {}; VBI.err = ''; VBI.owner && VBI.owner.L('start'); };
  r.onresult = ev => {
    if(VBI.rec !== r) return;
    const E = VBI.owner, from = typeof ev.resultIndex === 'number' ? ev.resultIndex : 0;
    for(let i = from; i < ev.results.length; i++){
      const res = ev.results[i]; if(!res) continue;
      const t = String(res[0]?.transcript||'').trim(); if(!t) continue;
      if(!E || !E.on){ VBI.n[i] = vbiWords(t).length; continue; }      // مكتوم
      if(res.isFinal){ clearTimeout(VBI.idleT); vbiCommit(i, t, 'final'); continue; }
      const w = vbiWords(t), n = VBI.n[i] || 0;
      if(w.length > n){ vbLive(E.p, `🎙️ <b>«${esc(w.slice(n).join(' '))}»</b>`); VBI.pend = { i, t }; }
      clearTimeout(VBI.idleT);
      VBI.idleT = setTimeout(() => { if(VBI.pend){ const q = VBI.pend; vbiCommit(q.i, q.t, 'pause'); } }, 1300);
    }
  };
  r.onerror = e => { const err = (e && e.error) || '?', E = VBI.owner; E && E.L('error ' + err);
    if(err === 'audio-capture') VBI.err = err;      // الميكروفون مشغول: الكائن قد يعلق ⟵ نصنع جديدًا عند «تابِع»
    if((err === 'not-allowed' || err === 'service-not-allowed') && E && E.on && !E.worked) E.fatal(); };
  r.onend = () => {
    if(VBI.rec !== r) return;
    VBI.active = false; VBI.endedAt = Date.now(); clearTimeout(VBI.idleT);
    const E = VBI.owner; E && E.L('end');
    if(VBI.pend){ const q = VBI.pend; vbiCommit(q.i, q.t, 'end'); }
    VBI.pend = null;
    if(E && E.on) E.pauseUI(VBI.err === 'audio-capture' ? '🎤 الميكروفون كان مشغولًا' : '');   // إعادة بلا لمسة = جلسة صمّاء ⟵ «تابِع»
  };
  VBI.rec = r; return r;
}
function vbiGo(E){                                  // تُستدعى داخل لمستك
  clearTimeout(VBI.offT);
  if(VBI.owner && VBI.owner !== E && VBI.owner.on) VBI.owner.stopAll();
  VBI.owner = E;
  if(VBI.active){ E.L('live'); return; }            // الجلسة تعمل (مكتومة): نكمل فورًا
  try{ if(typeof omrKillStreams === 'function' && OMR_STREAMS && OMR_STREAMS.size) omrKillStreams(); }catch(e){}   // الكاميرا تنافس الميكروفون
  // بعد «audio-capture» قد يعلق الكائن نفسه: نبدأ بكائن جديد
  const fresh = VBI.err === 'audio-capture'; VBI.err = '';
  try{ vbiRec(fresh).start(); E.L(fresh ? 'go-new' : 'go'); }
  catch(e){ E.L('go-fail ' + (e && e.message || ''));
    try{ vbiRec(true).start(); E.L('go-new'); }catch(x){ E.L('go-fail2'); E.pauseUI(); } }
}
function vbiMute(E){
  E.L('stop'); clearTimeout(VBI.idleT); VBI.pend = null;
  clearTimeout(VBI.offT);
  VBI.offT = setTimeout(() => { if(!(VBI.owner && VBI.owner.on) && VBI.active){ try{ VBI.rec.stop(); }catch(e){} } }, 600000);   // ١٠ دقائق
}
document.addEventListener('visibilitychange', () => {   // مغادرة التطبيق: إغلاق حقيقي للميكروفون
  if(document.hidden && VBI.active && !(VBI.owner && VBI.owner.on)){ clearTimeout(VBI.offT); try{ VBI.rec.stop(); }catch(e){} }
});
const VB_ENGINES = {};
function vbEngine(p, { onFinal, pick, onFatal, onStop }){
  const E = { p, on:false, rec:null, restartT:0, idleT:0, pend:'', last:'', lastAt:0, fails:0, worked:false, log:[] };
  const L = x => { E.log.push(new Date().toTimeString().slice(0,8) + ' ' + x); if(E.log.length > 20) E.log.shift(); };
  const fire = t => { t = String(t||'').trim(); if(!t) return; const now = Date.now();
    if(t === E.last && now - E.lastAt < 1500) return;
    E.last = t; E.lastAt = now; try{ onFinal(t); }catch(e){ L('handle-err ' + e.message); } };
  function make(){
    const r = new VR_SUP();
    r.lang = 'ar-SA'; r.interimResults = true; r.maxAlternatives = 3; r.continuous = false;
    r.onstart = () => { L('start'); E.fails = 0; E.audioErr = 0; };
    r.onresult = ev => {
      if(E.rec !== r) return;
      const res = ev.results[ev.results.length-1]; if(!res) return;
      const t = String(res[0]?.transcript||'').trim();
      if(!res.isFinal){ if(t){ E.pend = t; vbLive(p, `🎙️ <b>«${esc(t)}»</b>`); } return; }
      E.pend = ''; E.worked = true; L('final «' + t + '»');
      fire(pick ? pick(res) : t);
    };
    r.onerror = e => {
      const err = (e && e.error) || '?'; L('error ' + err);
      if(err === 'audio-capture'){ E.audioErr = (E.audioErr||0) + 1; if(E.audioErr >= 2){ E.audioErr = 0; pause('🎤 الميكروفون مشغول'); } return; }
      if(err === 'not-allowed' || err === 'service-not-allowed'){
        if(E.worked){ pause(); return; }            // كان يعمل ثم رُفضت الإعادة: «تابِع» بلمسة
        E.on = false; clearTimeout(E.restartT);
        try{ onFatal && onFatal('تعذّر استخدام الميكروفون — لم يُسمح بالإذن. فعّله من إعدادات المتصفح.'); }catch(x){}
      }
    };
    r.onend = () => {
      L('end');
      if(E.rec !== r) return;
      if(E.pend && typeof E.pend === 'string'){ const t = E.pend; E.pend = ''; E.worked = true; fire(t); }   // جملة لحظية لم تُعتمد
      if(!E.on) return;
      clearTimeout(E.restartT);
      E.restartT = setTimeout(() => {
        if(!E.on || E.rec !== r) return;
        try{ r.start(); L('restart'); }
        catch(err){ L('restart-fail ' + (err && err.message || ''));
          if(++E.fails >= 3) return pause();
          try{ const n = make(); E.rec = n; n.start(); L('new'); }catch(x){ pause(); } }
      }, 250);
    };
    return r;
  }
  E.L = L; E.fire = fire;
  E.fatal = () => { E.on = false; try{ onFatal && onFatal('تعذّر استخدام الميكروفون — لم يُسمح بالإذن. فعّله من إعدادات المتصفح.'); }catch(x){} };
  E.pauseUI = (why) => { L('paused');
    vbLive(p, `⏸️ ${why || 'توقف الاستماع'} <button type="button" class="vb-resume" onclick="VB_ENGINES['${p}'].resume()">▶︎ تابِع</button>`);
    try{ navigator.vibrate && navigator.vibrate(60); }catch(e){} };
  function pause(why){
    clearTimeout(E.restartT); L('paused');
    const r = E.rec; E.rec = null; try{ r && r.abort && r.abort(); }catch(e){}
    vbLive(p, `⏸️ ${why || 'توقف الاستماع'} <button type="button" class="vb-resume" onclick="VB_ENGINES['${p}'].resume()">▶︎ تابِع</button>`);
    try{ navigator.vibrate && navigator.vibrate(60); }catch(e){}
  }
  function go(){ E.fails = 0; E.pend = ''; let r; try{ r = make(); }catch(e){ return pause(); }
    E.rec = r; try{ r.start(); L('go'); }catch(e){ L('go-fail ' + (e && e.message || '')); pause(); } }
  E.start = () => {
    for(const k in VB_ENGINES) if(k !== p && VB_ENGINES[k].on) VB_ENGINES[k].stopAll();
    E.on = true; E.worked = false;
    if(VB_IOS) return vbiGo(E);                     // iPhone: الجلسة المشتركة
    go();                                           // داخل لمستك
  };
  E.resume = () => { if(!E.on) return; vbLive(p, '🎙️ أستمع…'); if(VB_IOS) return vbiGo(E); go(); };
  E.stop = () => {
    if(VB_IOS){ E.on = false; vbiMute(E); return; }
    E.on = false; E.pend = ''; clearTimeout(E.restartT); clearTimeout(E.idleT); L('stop');
    const r = E.rec; E.rec = null; try{ r && (r.abort ? r.abort() : r.stop()); }catch(e){}
  };
  E.stopAll = () => { E.stop(); try{ onStop && onStop(); }catch(e){} };
  VB_ENGINES[p] = E;
  return E;
}
/* 🩺 الضغط على شريط الاستماع يعرض آخر أحداث الميكروفون — إن تكرر الانقطاع صوّرها وأرسلها */
document.addEventListener('click', e => {
  const live = e.target.closest('.vb-live'); if(!live || e.target.closest('.vb-resume')) return;
  const p = (live.id || '').replace(/-live$/, ''), E = VB_ENGINES[p]; if(!E) return;
  askConfirm(VB_VER + (VB_IOS?' · iOS':'') + '\n' + (E.log.join('\n') || 'لا أحداث بعد'), { title:'🩺 أحداث الميكروفون', yes:'حسنًا', no:null }).then(()=>{});
});
const fmt=v=>Number.isInteger(Number(v))?String(v):Number(v).toFixed(1);
function examBook(){
  ensure();
  const root=CT_DATA.examBooks[String(ctExamSP().sem)]=CT_DATA.examBooks[String(ctExamSP().sem)]||{};
  const b=root[String(ctExamSP().per)]=root[String(ctExamSP().per)]||{tests:[],scores:{}};
  b.tests=Array.isArray(b.tests)?b.tests:[];
  b.scores=b.scores&&typeof b.scores==='object'?b.scores:{};
  return b;
}
function examTestId(){return 'ex'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function examMaxTotal(){return examBook().tests.reduce((t,x)=>t+Math.max(0,Number(x.max)||0),0)}
function examStudentRawTotal(sid){
  const b=examBook(), by=b.scores[String(sid)]&&typeof b.scores[String(sid)]==='object'?b.scores[String(sid)]:{};
  return b.tests.reduce((sum,t)=>{const v=by[String(t.id)];const sc=v&&typeof v==='object'?Number(v.score):Number(v);return sum+(Number.isFinite(sc)?Math.max(0,Math.min(Number(t.max)||0,sc)):0)},0);
}
function examFor(sid){
  /* المصدر المعتمد لعرض الرصد هو نتيجة /grades المحسوبة في Worker.
     هذا مهم خصوصًا لدرجات الزيادة المشتراة من الطالب: الكشف الشامل
     يقرأ النتيجة المحسوبة من الخادم، فلا يجوز أن تعرض بوابة المعلم
     الدرجة الأساسية القديمة وتجاهل الزيادة. */
  const serverExam=gradeOf(sid)?.exam;
  if(serverExam && serverExam.measured && Number.isFinite(Number(serverExam.score))){
    return Number(Number(serverExam.score).toFixed(2));
  }

  /* fallback مؤقت قبل وصول /grades، للحفاظ على الرصد الفوري أثناء التحرير */
  const b=examBook(), max=examMaxTotal();
  if(!b.tests.length||max<=0)return null;
  const has=Object.prototype.hasOwnProperty.call(b.scores,String(sid));
  if(!has)return null;
  const base=Number((examStudentRawTotal(sid)/max*20).toFixed(2));
  const root=CT_DATA.examBonuses&&typeof CT_DATA.examBonuses==='object'?CT_DATA.examBonuses:{};
  const sem=root[String(ctExamSP().sem)]&&typeof root[String(ctExamSP().sem)]==='object'?root[String(ctExamSP().sem)]:{};
  const per=sem[String(ctExamSP().per)]&&typeof sem[String(ctExamSP().per)]==='object'?sem[String(ctExamSP().per)]:{};
  const entry=per[String(sid)];
  const bonus=Number(entry&&typeof entry==='object'?entry.points:entry)||0;
  return Number(Math.min(20,base+Math.max(0,Math.min(20,bonus))).toFixed(2));
}

/* ═══════════ 🎤 رصد درجات الاختبارات بالصوت ═══════════
   نفس محرك التعرف الموجود في «الرصد»، لكن مخرجه هنا هو درجة رقمية.
   الاستخدام: اختر اختبارًا ثم قل:
   «سعيد محمد 6 ضاري عبدالله 9 كنان 7 علي محمد سعيد 5 فهد الهاجري 8»
*/
let examVrRec=null, examVrOn=false;

const EXAM_NUMS = new Map([
  /* تطبيع النطق العربي: vrNorm يحوّل «ة» إلى «ه»، لذلك ندعم
     الصيغ الفصحى والصيغ التي قد يعيدها Safari كما تُنطق. */
  ['صفر',0],
  ['واحد',1],['اثنين',2],['اثنان',2],
  ['ثلاثة',3],['ثلاثه',3],['ثلاث',3],
  ['أربعة',4],['اربعة',4],['أربعه',4],['اربعه',4],['أربع',4],
  ['خمسة',5],['خمسه',5],['خمس',5],
  ['ستة',6],['سته',6],['ست',6],
  ['سبعة',7],['سبعه',7],['سبع',7],
  ['ثمانية',8],['ثمانيه',8],['ثماني',8],['ثمان',8],
  ['تسعة',9],['تسعه',9],['تسع',9],
  ['عشرة',10],['عشره',10],['عشر',10],

  /* 11-19: صيغ عربية + صيغ النطق السريع/العامي التي قد يحولها
     التعرف الصوتي إلى كلمة واحدة مثل «احدعش» و«اثنعش». */
  ['احد عشر',11],['أحد عشر',11],['احدعشر',11],['احدعش',11],['أحدعش',11],
  ['اثنا عشر',12],['اثني عشر',12],['اثنا عشر',12],['اثناعشر',12],['اثنعشر',12],['اثنعش',12],['اثناعش',12],
  ['ثلاثة عشر',13],['ثلاثه عشر',13],['ثلاث عشر',13],['ثلاثةعشر',13],['ثلاثهعشر',13],
  ['ثلاثعشر',13],['ثلاثعش',13],['ثلطعش',13],['ثلثعش',13],['ثلطعشر',13],['ثلثعشر',13],
  ['أربعة عشر',14],['اربعة عشر',14],['أربعه عشر',14],['اربعه عشر',14],
  ['اربعةعشر',14],['اربعهعشر',14],['اربععشر',14],['ارباطعش',14],['ارباعش',14],
  ['خمسة عشر',15],['خمسه عشر',15],['خمس عشر',15],['خمسةعشر',15],['خمسهعشر',15],
  ['خمسعشر',15],['خمصطعش',15],['خمصعش',15],['خمستعش',15],
  ['ستة عشر',16],['سته عشر',16],['ست عشر',16],['ستةعشر',16],['ستهعشر',16],
  ['ستعشر',16],['سطعش',16],['ستعش',16],
  ['سبعة عشر',17],['سبعه عشر',17],['سبع عشر',17],['سبعةعشر',17],['سبعهعشر',17],
  ['سبععشر',17],['صباطعش',17],['سبعطعش',17],['سبعتعش',17],
  ['ثمانية عشر',18],['ثمانيه عشر',18],['ثماني عشر',18],['ثمان عشر',18],
  ['ثمانيةعشر',18],['ثمانيهعشر',18],['ثمانعشر',18],['ثمنطعش',18],['ثمانطعش',18],
  ['ثمنعش',18],['ثمانعش',18],
  ['تسعة عشر',19],['تسعه عشر',19],['تسع عشر',19],['تسعةعشر',19],['تسعهعشر',19],
  ['تسععشر',19],['تساطعش',19],['تساعش',19],['تسعتعش',19],

  ['عشرون',20],['عشرين',20],
  ['ثلاثون',30],['أربعون',40],['خمسون',50],['ستون',60],
  ['سبعون',70],['ثمانون',80],['تسعون',90],['مائة',100],['مية',100]
]);

function examVrNumToken(t){
  const n=vrNorm(t);
  if(EXAM_NUMS.has(n)) return EXAM_NUMS.get(n);

  /* صيغ إضافية شائعة جدًا في نتائج التعرف الصوتي. */
  const aliases = {
    'ثلاثه':3,'اربعه':4,'أربعه':4,'خمسه':5,'سته':6,
    'سبعه':7,'ثمانيه':8,'تسعه':9,'عشره':10,
    'احدعش':11,'اثنعش':12,'اثناعش':12,
    'ثلطعش':13,'ثلثعش':13,'ثلاثطعش':13,
    'ارباطعش':14,'اربعطعش':14,'ارباعش':14,
    'خمصطعش':15,'خمستعش':15,'خمسطعش':15,
    'سطعش':16,'ستعش':16,
    'صباطعش':17,'سبعطعش':17,'سبعتعش':17,
    'ثمنطعش':18,'ثمانطعش':18,'ثمنعش':18,
    'تساطعش':19,'تساعش':19,'تسعتعش':19,
    'عشرين':20,'عشرون':20
  };
  if(Object.prototype.hasOwnProperty.call(aliases,n)) return aliases[n];

  const ar=String(t||'').replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c));
  if(/^\d+(?:[.,]\d+)?$/.test(ar)) return Number(ar.replace(',','.'));
  const m=n.match(/^(\d+(?:[.,]\d+)?)$/);
  return m ? Number(m[1].replace(',','.')) : null;
}

function examVrNumberAt(toks,i){
  // افحص أولًا العبارات متعددة الكلمات، ثم الكلمة المفردة.
  // هذا يمنع «احد عشر» من أن تُفسّر كـ 1 ثم كلمة منفصلة.
  const a=vrNorm(toks[i]||'');
  const b=vrNorm(toks[i+1]||'');
  const phrase=(a+' '+b).trim();
  if(EXAM_NUMS.has(phrase)) return {value:EXAM_NUMS.get(phrase),used:2};

  // Arabic speech may produce «عشرة ونصف» or «خمسة فاصلة خمسة».
  let n=examVrNumToken(toks[i]);
  if(n==null) return null;
  let used=1;
  const next=vrNorm(toks[i+1]||'');
  if(next==='ونصف'||next==='ونص') { n+=0.5; used=2; }
  else if(next==='فاصله'||next==='فاصلة'){
    const d=examVrNumToken(toks[i+2]);
    if(d!=null){ n += d/10; used=3; }
  }
  return {value:n,used};
}

function examVrSegments(text){
  const toks=vrTokens(text), out=[];
  let buf=[];
  for(let i=0;i<toks.length;){
    const num=examVrNumberAt(toks,i);
    if(num){
      if(buf.length) out.push({name:buf,score:num.value});
      buf=[]; i+=num.used;
      if(toks[i]==='من' && examVrNumberAt(toks,i+1)) i+=1+examVrNumberAt(toks,i+1).used;   // «٨ من ١٠»
      continue;
    }
    // «الدرجة 8» / «درجته 8» ليست جزءًا من الاسم.
    if(['درجه','درجة','درجته','الدرجه','الدرجة'].includes(toks[i])) { i++; continue; }
    buf.push(toks[i]); i++;
  }
  if(buf.length) out.push({name:buf,score:null});
  return out;
}

function examVrSay(t){const e=$('exam-vr-status');if(e)e.innerHTML=t}
function examVrLog(t){ examVrSay(esc(t)); }
function examVrStop(){
  examVrOn=false; exEng.stop();
  const b=$('exam-vr-btn');if(b){b.textContent='🎤 رصد الاختبارات بالصوت';b.classList.remove('bad')}
  examVrSay(''); vbOn('exv', false);
  const w=$('ex-voice'); if(w) w.hidden=true; $('ex-voice-btn')?.classList.remove('on');
}
let exHold=null;   // «زياد المالكي» … «ثمانية»: الاسم وحده يُضم إليه ما يُقال بعده خلال ٨ ث
async function examVrHandle(text){
  if(exHold && Date.now()-exHold.at<8000){ const j=exHold.t+' '+text; if(examVrSegments(j).some(sg=>sg.score!=null)) text=j; }
  exHold=null;
  const heard=String(text||'').trim().slice(0,80);
  const testId=$('exam-vr-test')?.value||'';
  const b=examBook();
  const test=b.tests.find(t=>String(t.id)===String(testId));
  if(!test){examVrSay('اختر الاختبار أولًا.');return}
  const segs=examVrSegments(text);
  if(!segs.length){examVrSay('لم أتعرف على الاسم والدرجة.');return}
  let done=0, problems=[];
  for(const sg of segs){
    const hit=vrMatch(sg.name);
    if(hit.hits.length!==1){
      problems.push(sg.name.join(' ')+(hit.hits.length?' (أكثر من طالب)':' (غير موجود)'));
      continue;
    }
    if(sg.score==null){ if(segs.length===1) exHold={t:sg.name.join(' '),at:Date.now()}; problems.push(hit.hits[0].name+' (قل الدرجة)');continue}
    const max=Number(test.max)||0;
    const score=Math.max(0,Math.min(max,sg.score));
    if(score!==sg.score) examVrLog(`⚠️ ${hit.hits[0].name}: حُدّدت الدرجة إلى ${fmt(score)} من ${fmt(max)}`);
    const st=hit.hits[0], prev=exVal(st.id,test);
    await setExamScore(st.id,test.id,String(score),true);
    vbCard('exam-vr-log',{ label:`📝 ${fmt(score)} / ${fmt(max)}`, cls:'g', name:st.name, heard,
      flash:`#exam-list [data-ex-row="${CSS.escape(st.id)}"]`,
      undo: async()=>{ await setExamScore(st.id,test.id,prev,true); toast('تم التراجع'); } });
    done++;
  }
  examVrSay(problems.length?`⚠️ تعذّر: ${esc(problems.join('، '))}`:'');
  vbLive('exv', done?`✓ سُجّل ${done} — 🎙️ أستمع…`:'🎙️ أستمع…');
}
const exEng = vbEngine('exv', {
  pick: r => { let bestT=String(r[0]?.transcript||''),bestN=-1;
    for(let i=0;i<r.length;i++){ const t=String(r[i].transcript||'').trim(); if(!t) continue;
      const n=examVrSegments(t).filter(sg=>sg.score!=null&&vrMatch(sg.name).hits.length===1).length;
      if(n>bestN){bestN=n;bestT=t} }
    return bestT; },
  onFinal: t => examVrHandle(t),
  onFatal: m => { examVrStop(); toast(m); },
  onStop: () => examVrStop()
});
function examVrStart(){
  if(!VR_SUP)return;
  const testId=$('exam-vr-test')?.value||'', b=examBook();
  const test=b.tests.find(t=>String(t.id)===String(testId));
  if(!test){examVrSay('اختر الاختبار أولًا.');return}
  examVrOn=true;
  vbOn('exv', true); examVrSay(''); vbLive('exv',`🎙️ أستمع… ${esc(test.title||'الاختبار')} · من ${fmt(test.max)}`);
  exEng.start();
}

function examVrRenderTests(){
  const sel=$('exam-vr-test'); if(!sel)return;
  const b=examBook(),cur=sel.value;
  sel.innerHTML=b.tests.map((t,i)=>`<option value="${esc(t.id)}">${esc(t.title||('اختبار '+(i+1)))} · من ${fmt(t.max)}</option>`).join('');
  if([...sel.options].some(o=>o.value===cur))sel.value=cur;
}
function examVrInit(){
  const wrap=$('exam-vr-wrap'),btn=$('exam-vr-btn');
  if(!wrap||!btn)return;
  if(!VR_SUP){return}
  wrap.style.display='block';
  btn.addEventListener('click',e=>{e.preventDefault();examVrOn?examVrStop():examVrStart()});
  const x=$('exv-stop'); if(x) x.onclick=()=>examVrStop();
}

function renderExamConfig(){
  const b=examBook(),locked=academicClosed(),max=examMaxTotal();
  if($('exam-config-summary'))$('exam-config-summary').innerHTML=`<span>عدد الاختبارات: <b>${b.tests.length}</b></span><span>إجمالي الدرجات الأصلية: <b>${fmt(max)}</b></span><span>النتيجة النهائية: <b>من 20</b></span>`;
  if($('exam-test-list'))$('exam-test-list').innerHTML=b.tests.map((t,i)=>`<div class="exam-test-row"><input type="text" value="${esc(t.title||('اختبار '+(i+1)))}" maxlength="80" data-exam-test-title="${esc(t.id)}" ${locked?'disabled':''}><input type="number" min="1" step="0.5" value="${Number(t.max)||10}" aria-label="الدرجة القصوى" data-exam-test-max="${esc(t.id)}" ${locked?'disabled':''}><input type="date" value="${esc(t.date||'')}" aria-label="تاريخ الاختبار" title="تاريخ إجراء الاختبار — تعتمد عليه الخطط العلاجية في القياس القبلي والبعدي" data-exam-test-date="${esc(t.id)}" ${locked?'disabled':''}><button class="btn ghost exam-covers" type="button" data-exam-covers="${esc(t.id)}" title="الأنشطة التي يغطيها الاختبار — يعتمد عليها العلاج التلقائي">📚 ${Array.isArray(t.covers)&&t.covers.length?t.covers.length+' أنشطة':'يغطي…'}</button><button class="btn bad" type="button" data-exam-delete="${esc(t.id)}" ${locked?'disabled':''}>×</button></div>`).join('')||'<div class="empty" style="padding:12px">لم تتم إضافة اختبارات بعد. أضف أول اختبار ثم ابدأ الرصد.</div>';
  if($('exam-add-test'))$('exam-add-test').disabled=locked;
  examVrRenderTests();
  if($('exam-vr-test'))$('exam-vr-test').disabled=locked;
}
async function addExamTest(){
  if(academicClosed()){toast(academicLockMsg());return}
  if(examVrOn)examVrStop();
  const b=examBook(),n=b.tests.length+1;
  b.tests.push({id:examTestId(),title:`اختبار ${n}`,max:10,date:new Date(Date.now()+3*3600000).toISOString().slice(0,10),at:Date.now()});
  renderExamConfig();renderExamGrades();await save();toast('تمت إضافة الاختبار');
}
async function updateExamTest(id,field,value){
  if(academicClosed())return;
  const b=examBook(),t=b.tests.find(x=>String(x.id)===String(id));if(!t)return;
  if(field==='title')t.title=String(value||'').trim()||'اختبار';
  else if(field==='date'){const v=String(value||'');t.date=/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v)?v:'';}
  else {const max=Math.max(1,Math.min(100,Number(value)));if(!Number.isFinite(max))return;t.max=max;}
  t.at=Date.now();renderExamConfig();renderExamGrades();await save();
}
/* 📚 ربط الاختبار بالأنشطة التي يغطيها: عليه يبني العلاج التلقائي مهمة الطالب الضعيف في الاختبار */
async function examCoversPick(id){
  const b=examBook(),t=b.tests.find(x=>String(x.id)===String(id));if(!t)return;
  let rows=[];
  try{const r=await fetch(ctApi()+'/activity-list?t='+encodeURIComponent(getTok()));const j=await r.json();rows=j.rows||[]}catch(e){}
  if(!rows.length){toast('لا توجد أنشطة منشورة أو تعذّر الاتصال.');return}
  const sel=new Set((Array.isArray(t.covers)?t.covers:[]).map(String));
  const ov=document.createElement('div');ov.className='cov-ov';
  ov.innerHTML=`<div class="cov-box" role="dialog" aria-modal="true"><h3>📚 الأنشطة التي يغطيها «${esc(t.title||'الاختبار')}»</h3>
    <p>الطالب الذي يحصل على أقل من 60% في هذا الاختبار يحصل تلقائيًا على مهمة علاجية من أخطائه في هذه الأنشطة.</p>
    <div class="cov-list">${rows.map(a=>`<label><input type="checkbox" value="${esc(a.id)}" ${sel.has(a.id)?'checked':''}> <span>${esc(a.title)}${a.cls?` <small style="opacity:.7">— ${esc(a.cls)}</small>`:''}</span></label>`).join('')}</div>
    <div class="cov-foot"><button class="btn" type="button" data-cov-save>حفظ</button><button class="btn ghost" type="button" data-cov-x>إلغاء</button></div></div>`;
  document.body.appendChild(ov);
  const close=()=>ov.remove();
  ov.addEventListener('click',e=>{if(e.target===ov||e.target.closest('[data-cov-x]'))close()});
  ov.querySelector('[data-cov-save]').onclick=async()=>{
    t.covers=[...ov.querySelectorAll('input:checked')].map(x=>x.value).slice(0,40);t.at=Date.now();
    close();renderExamConfig();await save();toast('تم ربط الاختبار بالأنشطة');
  };
}
async function deleteExamTest(id){
  if(academicClosed()){toast(academicLockMsg());return}
  if(examVrOn)examVrStop();
  const b=examBook();if(b.tests.length<=1){toast('يجب إبقاء اختبار واحد على الأقل.');return}
  b.tests=b.tests.filter(x=>String(x.id)!==String(id));
  for(const sid of Object.keys(b.scores||{})){if(b.scores[sid])delete b.scores[sid][String(id)];}
  b.delTests=(Array.isArray(b.delTests)?b.delTests:[]).concat([{id:String(id),at:Date.now()}]).slice(-200);
  renderExamConfig();renderExamGrades();await save();toast('تم حذف الاختبار');
}
/* درجة مرصودة فعلًا (لا علامة حذف): رقم أو {score} أو غائب */
function exHas(sid,testId){const v=(examBook().scores[String(sid)]||{})[String(testId)];return v!=null&&!(typeof v==='object'&&v.del);}
async function setExamScore(sid,testId,value,quiet,extra){
  if(academicClosed()){toast(academicSem().status==='closed'?'الفصل مغلق. افتحه للضرورة أولًا.':academicLockMsg());renderExamGrades();return}
  const b=examBook(),t=b.tests.find(x=>String(x.id)===String(testId));if(!t)return;
  const n=String(value).trim(), bucket=b.scores[String(sid)]=b.scores[String(sid)]||{};
  if(n===''){bucket[String(testId)]={del:true,at:Date.now()};}   // 🗑️ علامة حذف بطابع: لا تعيدها نسخة قديمة من جهاز آخر
  // 🚫 غائب: علامة فقط — لا درجة (تُحتسب كدرجة لم تُرصد حتى تُرصد له درجة)، لكنه لا يُعدّ «لم يُرصد»
  else if(n==='غ'||n==='غائب'){bucket[String(testId)]={absent:true,at:Date.now()};}
  else{const score=Math.max(0,Math.min(Number(t.max)||0,Number(n)));if(!Number.isFinite(score))return;bucket[String(testId)]={score,at:Date.now(),...(extra&&typeof extra==='object'?extra:{})};}
  renderExamGrades();
  await save();if(!quiet)toast('تم حفظ الدرجة');
}
/* 📝 من لم يُرصد له: يُحسب من الدرجات الخام لكل اختبار (خانة فارغة = لم يُرصد).
   فلتر: الكل · لم يُرصد · مكتمل، ولأي اختبار أو اختبار بعينه. */
let examFilter={mode:'all',test:''};
function examMissingTests(sid){
  const b=examBook(),by=b.scores[String(sid)]&&typeof b.scores[String(sid)]==='object'?b.scores[String(sid)]:{};
  return b.tests.filter(t=>{const v=by[String(t.id)];if(v&&typeof v==='object'&&v.absent)return false;const sc=v&&typeof v==='object'?v.score:v;return sc==null||sc===''||!Number.isFinite(Number(sc))});
}
function examIsMissing(sid){const miss=examMissingTests(sid);return examFilter.test?miss.some(t=>String(t.id)===examFilter.test):miss.length>0}
function setExamFilter(mode,test){examFilter={mode:mode||examFilter.mode,test:test==null?examFilter.test:test};renderExamGrades();}
/* الاختبار الظاهر: يُختار من الأزرار أعلى الصفحة، وتعمل عليه القائمة ولوحة الأرقام والفلتر */
let EX_CUR='';
function exCurTest(){const b=examBook();let t=b.tests.find(x=>String(x.id)===EX_CUR);
  if(!t){t=b.tests.find(x=>list($('cls')?.value||'').some(s=>examMissingTests(s.id).some(m=>m.id===x.id)))||b.tests[b.tests.length-1];EX_CUR=t?String(t.id):'';}
  return t||null;}
function exPick(id){EX_CUR=String(id);examFilter.test=EX_CUR;if($('exam-vr-test'))$('exam-vr-test').value=EX_CUR;exKbClose(false);renderExamGrades();}
function exVal(sid,t){const v=((examBook().scores[String(sid)]||{})[String(t.id)]);if(v&&typeof v==='object'&&v.absent)return 'غ';const sc=v&&typeof v==='object'?v.score:v;return sc==null||sc===''||!Number.isFinite(Number(sc))?'':String(Number(sc));}
/* 📄 أوراق التصحيح الآلي المحفوظة لهذا الاختبار: بجانب اسم صاحبها أيقونة تفتح ورقته بالختم */
const EXPAP={test:'',sids:new Map(),busy:false,at:0};
async function exPapersLoad(test){
  if(!test||EXPAP.busy||(EXPAP.test===test&&Date.now()-EXPAP.at<60000)) return;
  EXPAP.busy=true;
  try{ const j=await (await fetch(`${ctApi()}/omr/papers/list?t=${encodeURIComponent(getTok())}&test=${encodeURIComponent(test)}`)).json();
    EXPAP.test=test; EXPAP.at=Date.now(); EXPAP.pub=!!j.pub; EXPAP.pubCls=j.pubCls||[];
    EXPAP.sids=new Map((j.papers||[]).map(x=>[String(x.sid),x])); }catch(e){}
  EXPAP.busy=false;
  if(EXPAP.sids.size) renderExamGrades();
}
async function exPaperOpen(sid){
  const x=EXPAP.sids.get(String(sid)); if(!x) return;
  const v=document.createElement('div'); v.className='omr-full'; v.onclick=e=>{ if(e.target===v||e.target.closest('[data-x]')) v.remove(); };
  v.innerHTML='<span>جارٍ فتح الورقة…</span>'; document.body.appendChild(v);
  try{ const j=await (await fetch(`${ctApi()}/omr/papers/img?t=${encodeURIComponent(getTok())}&test=${encodeURIComponent(EXPAP.test)}&sid=${encodeURIComponent(sid)}`)).json(); if(!j.ok) throw 0;
    const on=EXPAP.pub||EXPAP.pubCls.includes(x.cls), diff=x.now!=null&&Math.abs(x.now-x.score)>1e-9;
    v.innerHTML=`<img src="${j.img}" alt="ورقة ${esc(x.name)}"><span>${esc(x.name)} · الختم ${x.score} / ${x.max}${diff?` · ⚠️ المرصودة الآن ${x.now}`:''} · ${on?'📢 منشورة لولي الأمر':'🔒 لم تُنشر بعد'}</span>
      <div class="exp-acts"><button type="button" class="btn" data-x>إغلاق</button><button type="button" class="btn exp-del" data-del>🗑️ حذف الورقة نهائيًا</button></div>`;
    v.querySelector('[data-del]').onclick=async()=>{
      if(!(await askConfirm(`حذف ورقة ${x.name} ودرجته في هذا الاختبار نهائيًا؟ تختفي الورقة من بوابته وتقرير ولي أمره، وتُمسح الدرجة ليُعاد تصحيحه.`,{title:'حذف الورقة والدرجة',yes:'احذف نهائيًا',no:'إلغاء'}))) return;
      try{ const r=await (await fetch(`${ctApi()}/omr/papers/delete`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),test:EXPAP.test,sid:String(sid)})})).json(); if(!r.ok) throw 0;
        EXPAP.sids.delete(String(sid)); v.remove();
        try{ for(const sh of await OMRDB.all()) if(String(sh.sid) === String(sid) && String(sh.key || '').split('|')[1] === String(EXPAP.test)){ await OMRDB.del(sh.id); if(OMRUI.sheets) OMRUI.sheets = OMRUI.sheets.filter(x => x.id !== sh.id); } }catch(e){}   // ونسختها في دفعة الجوال
        if(exHas(sid,EXPAP.test)) await setExamScore(String(sid),EXPAP.test,'',true);              // الدرجة تُمسح معها
        toast('🗑️ حُذفت الورقة والدرجة'); renderExamGrades(); }catch(e){ toast('تعذّر الحذف — تحقق من الاتصال'); } };
  }catch(e){ v.innerHTML='<span>تعذّر فتح الورقة</span><div class="exp-acts"><button type="button" class="btn" data-x>إغلاق</button></div>'; }
}

/* ═══ 🔑 مفتاح الإجابة وإعادة التصحيح · 📊 تحليل الأسئلة — للأوراق المصححة آليًا في الاختبار الظاهر ═══ */
const EXK = { test:'', papers:[], tpls:{}, sel:'', draft:{}, open:-1 };
function exPanel(title, sub){ let v = $('exa-panel'); if(!v){ v = document.createElement('div'); v.id = 'exa-panel'; v.className = 'exa-panel'; document.body.appendChild(v); }
  v.innerHTML = `<div class="exa-h"><div><b>${title}</b><small>${sub || ''}</small></div><button type="button" class="exa-x" onclick="exPanelClose()">إغلاق</button></div><div class="exa-b" id="exa-b"><p class="exa-note">جارٍ التحميل…</p></div>`;
  v.classList.add('on'); document.body.style.overflow = 'hidden'; return $('exa-b'); }
function exPanelClose(){ const v = $('exa-panel'); if(v) v.classList.remove('on'); document.body.style.overflow = ''; }
async function exkLoad(){
  const t = exCurTest(); if(!t) throw 0; EXK.test = String(t.id);
  const j = await (await fetch(`${ctApi()}/omr/papers/full?t=${encodeURIComponent(getTok())}&test=${encodeURIComponent(EXK.test)}`)).json(); if(!j.ok) throw 0;
  EXK.papers = j.papers || []; EXK.tpls = {};
  for(const id of [...new Set(EXK.papers.filter(p => p.tpl).map(p => p.tpl))]){ const g = await (await fetch(omrApi('/omr/get?t=' + encodeURIComponent(getTok()) + '&id=' + encodeURIComponent(id)))).json(); if(g.ok) EXK.tpls[id] = g.template; }
  return t;
}
const exkLab = (q, k) => k < 0 ? '—' : q.t === 'tf' ? (k === 0 ? 'صح' : 'خطأ') : q.t === 'mt' ? String(k + 1) : ['أ','ب','ج','د','هـ','و'][k];
function exkScore(p, M, keys){ const cur = p.ch.reduce((t, c, i) => t + (M.questions[i] && c === (keys[i] ?? M.questions[i].key) ? (Number(M.questions[i].m) || p.mark || 1) : 0), 0) + (p.man || 0);
  return p.tot && Math.abs(p.tot - p.max) > 1e-9 ? +(cur / p.tot * p.max).toFixed(2) : +cur.toFixed(2); }
async function exKeyOpen(){
  const t = exCurTest(), body = exPanel('🔑 مفتاح الإجابة', esc(t ? t.title : ''));
  try{ await exkLoad(); }catch(e){ body.innerHTML = '<p class="exa-note">تعذّر التحميل — تحقق من الاتصال</p>'; return; }
  const groups = []; EXK.papers.filter(p => p.tpl && EXK.tpls[p.tpl]).forEach(p => { const k = p.tpl + ':' + (p.model || 0); if(!groups.includes(k)) groups.push(k); });
  EXK.groups = groups; EXK.sel = groups.includes(EXK.sel) ? EXK.sel : groups[0] || ''; EXK.draft = {}; EXK.open = -1;
  exkRender();
}
function exkRender(){
  const body = $('exa-b'); if(!body) return;
  const old = EXK.papers.filter(p => !p.tpl).length;
  if(!EXK.sel){ body.innerHTML = `<p class="exa-note">أوراق هذا الاختبار صُوّرت قبل تحديث «إعادة التصحيح» فلا تحمل اختيارات الطلاب — الأوراق الجديدة تدعمه.${old ? ` (${old} ورقة)` : ''}</p>`; return; }
  const [tid, mi] = EXK.sel.split(':'), T = EXK.tpls[tid], M = { questions: omrQs(T.models[+mi]) }, P = EXK.papers.filter(p => p.tpl === tid && (p.model || 0) === +mi);
  const tabs = EXK.groups.length > 1 ? `<div class="exa-tabs">${EXK.groups.map(g => { const [a, b] = g.split(':'); return `<button type="button" class="${g === EXK.sel ? 'on' : ''}" onclick="EXK.sel='${g}';EXK.draft={};EXK.open=-1;exkRender()">نموذج (${esc(EXK.tpls[a].models[+b].letter || +b + 1)})</button>`; }).join('')}</div>` : '';
  const grid = M.questions.map((q, i) => { const d = EXK.draft[i], ch = d !== undefined && d !== q.key;
    return `<button type="button" class="exk-q${ch ? ' ch' : ''}${EXK.open === i ? ' op' : ''}" onclick="EXK.open=EXK.open===${i}?-1:${i};exkRender()"><small>س${i + 1}</small><b>${ch ? `${exkLab(q, q.key)} ← ${exkLab(q, d)}` : exkLab(q, q.key)}</b></button>`; }).join('');
  const oq = EXK.open >= 0 ? M.questions[EXK.open] : null;
  const pick = oq ? `<div class="exa-card exk-pick"><b>س${EXK.open + 1}: الإجابة الصحيحة</b>${oq.q ? `<small class="exa-qt">${esc(String(oq.q).slice(0, 160))}</small>` : ''}
    <div class="exk-opts">${oq.boxes.map((_, k) => `<button type="button" class="${(EXK.draft[EXK.open] ?? oq.key) === k ? 'on' : ''}" onclick="EXK.draft[${EXK.open}]=${k};exkRender()">${exkLab(oq, k)}${Array.isArray(oq.o) && oq.o[k] ? `<small>${esc(String(oq.o[k]).slice(0, 40))}</small>` : ''}</button>`).join('')}</div></div>` : '';
  const keys = {}; Object.entries(EXK.draft).forEach(([i, v]) => { if(M.questions[i] && v !== M.questions[i].key) keys[i] = v; });
  const diffs = Object.keys(keys).length ? P.map(p => ({ p, a: p.score, b: exkScore(p, M, keys) })).filter(x => Math.abs(x.a - x.b) > 1e-9) : [];
  const nk = Object.keys(keys).length;
  body.innerHTML = `${tabs}<div class="exa-card"><b>اضغط السؤال لتغيير إجابته الصحيحة</b><div class="exk-grid">${grid}</div></div>${pick}
    ${nk ? `<div class="exa-card exk-pre"><b>♻️ إعادة حساب ${P.length} ${P.length === 1 ? 'ورقة' : 'أوراق'}</b><small>${Object.entries(keys).map(([i, v]) => `س${+i + 1}: الصحيح الآن «${exkLab(M.questions[i], v)}» بدل «${exkLab(M.questions[i], M.questions[i].key)}»`).join(' · ')} — ${diffs.length ? `تتغير ${diffs.length} ${diffs.length === 1 ? 'درجة' : 'درجات'}:` : 'لا تتغير أي درجة'}</small>
      ${diffs.slice(0, 40).map(x => `<div class="exk-d"><span>${esc(x.p.name || '—')}</span><span><b>${x.a}</b> ← <i class="${x.b > x.a ? 'up' : 'dn'}">${x.b}</i></span></div>`).join('')}
      <button type="button" class="btn primary wide" onclick="exkApply()">✓ أعد الحساب وحدّث الرصد</button>
      <p class="exa-note">يُعدَّل مفتاح التصحيح في الجوال وتُحدَّث الدرجات والختم على الأوراق. إن كان الخطأ في بنك الأسئلة فعدّله في لوحة التحكم أيضًا حتى لا يعود عند إعادة التجهيز.</p></div>` : ''}
    ${old ? `<p class="exa-note">${old} ${old === 1 ? 'ورقة صُوّرت' : 'أوراق صُوّرت'} قبل التحديث لا تُعاد تلقائيًا.</p>` : ''}`;
}
async function exkApply(){
  const [tid, mi] = EXK.sel.split(':'), T = EXK.tpls[tid], M = { questions: omrQs(T.models[+mi]) };
  const keys = {}; Object.entries(EXK.draft).forEach(([i, v]) => { if(M.questions[i] && v !== M.questions[i].key) keys[i] = v; });
  if(!Object.keys(keys).length) return;
  const body = $('exa-b'); body.innerHTML = '<p class="exa-note">جارٍ إعادة التصحيح…</p>';
  try{
    const j = await (await fetch(omrApi('/omr/regrade'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ t: getTok(), tpl: tid, model: +mi, keys }) })).json(); if(!j.ok) throw 0;
    const newKeys = j.keys || M.questions.map(q => q.key), oldKeys = M.questions.map(q => q.key);
    M.questions.forEach((q, i) => { q.key = newKeys[i]; });
    // نسخة الجوال من القالب ودفعة الأوراق غير المحفوظة: المفتاح الجديد
    if(OMRUI.tpl && OMRUI.tpl.id === tid && OMRUI.tpl.models[+mi]) omrQs(OMRUI.tpl.models[+mi]).forEach((q, i) => { q.key = newKeys[i]; });
    (OMRUI.sheets || []).filter(sh => !sh.saved && sh.model === +mi && sh.key && sh.key.startsWith(tid + '|')).forEach(sh => { sh.answers.forEach((a, i) => { if(newKeys[i] !== undefined) a.key = newKeys[i]; }); OMRDB.put(sh); });
    // الدرجات في الدفتر المحلي (الخادم حدّثها بطابع أحدث)
    const b = examBook();
    for(const c of j.changed || []){ const by = b.scores[String(c.sid)] = b.scores[String(c.sid)] || {}, cell = by[String(c.test)]; if(cell && typeof cell === 'object' && !cell.del) by[String(c.test)] = { ...cell, score: c.now, at: Date.now() }; }
    // صور الأوراق: كل ورقة تغيّر صواب سؤال فيها تُعاد رسمها من الصفحة بلا ختم
    const flip = EXK.papers.filter(p => p.tpl === tid && (p.model || 0) === +mi && Object.keys(keys).some(i => (p.ch[i] === newKeys[i]) !== (p.ch[i] === oldKeys[i])));
    let n = 0; body.innerHTML = `<p class="exa-note">جارٍ تحديث صور الأوراق… <b id="exk-n">0</b> / ${flip.length}</p>`;
    for(const p of flip){ await exkRestamp(p, M); n++; const e = $('exk-n'); if(e) e.textContent = n; }
    EXPAP.at = 0; renderExamGrades();
    body.innerHTML = `<div class="exa-card"><b>✓ أُعيد التصحيح</b><small>تغيرت ${(j.changed || []).length} ${(j.changed || []).length === 1 ? 'درجة' : 'درجات'} · حُدّثت ${n} ${n === 1 ? 'صورة ورقة' : 'صور أوراق'}</small></div>`;
    toast('✓ أُعيد التصحيح بالمفتاح الجديد'); await exkLoad(); EXK.draft = {}; setTimeout(exkRender, 1400);
  }catch(e){ body.innerHTML = '<p class="exa-note">تعذّرت إعادة التصحيح — تحقق من الاتصال وأعد المحاولة</p>'; }
}
async function exkRestamp(p, M){
  try{
    const j = await (await fetch(`${ctApi()}/omr/papers/img?t=${encodeURIComponent(getTok())}&test=${encodeURIComponent(EXK.test)}&sid=${encodeURIComponent(p.sid)}&part=base`)).json(); if(!j.ok) return;
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = j.base; });
    const W = 1000, kp = W / 210, Hh = Math.round(297 * kp), c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d'); x.drawImage(im, 0, 0, W, Hh);
    const val = exkScore({ ...p, ch: j.ch }, M, {});
    const answers = (j.ch || []).map((f, i) => ({ final: f, key: M.questions[i] ? M.questions[i].key : -1, pick: j.pa && j.pa[i] ? j.pa[i][0] : -1, alt: j.pa && j.pa[i] ? j.pa[i][1] : -1,
      boxes: ((j.qb || [])[i] || []).map(r => ({ r, dx: 0, dy: 0 })) }));
    omrPaperDraw(x, kp, answers, val, p.max);
    await fetch(omrApi('/omr/paper/img'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ t: getTok(), sid: String(p.sid), test: EXK.test, img: c.toDataURL('image/jpeg', .7) }) });
  }catch(e){}
}
/* 📊 تحليل الأسئلة: من اختيارات الطلاب المحفوظة في أوراقهم. السؤال نفسه في نماذج مختلفة يُجمع بنصه */
const EXA = { sort:'hard' };
async function exAnaOpen(){
  const t = exCurTest(), body = exPanel('📊 تحليل الأسئلة', esc(t ? t.title : ''));
  try{ await exkLoad(); }catch(e){ body.innerHTML = '<p class="exa-note">تعذّر التحميل — تحقق من الاتصال</p>'; return; }
  exaRender();
}
function exaData(){
  const Q = new Map(), P = EXK.papers.filter(p => p.tpl && EXK.tpls[p.tpl] && Array.isArray(p.ch));
  P.forEach(p => { const M0 = EXK.tpls[p.tpl].models[p.model || 0]; if(!M0) return; const M = { questions: omrQs(M0) };
    M.questions.forEach((q, i) => { const k = q.q ? 'q:' + String(q.q).replace(/\s+/g, ' ').trim() : `i:${p.tpl}:${p.model || 0}:${i}`;
      let e = Q.get(k); if(!e){ e = { k, q, no: i + 1, n: 0, ok: 0, opt: new Map(), blank: 0, at: [] }; Q.set(k, e); }
      if(!e.at.some(x => x.tpl === p.tpl && x.m === (p.model || 0))) e.at.push({ tpl: p.tpl, m: p.model || 0, i });
      const c = p.ch[i]; e.n++; if(c === q.key) e.ok++;
      if(c < 0){ e.blank++; return; }
      const lab = Array.isArray(q.o) && q.o[c] ? String(q.o[c]) : exkLab(q, c), isKey = c === q.key;
      const o = e.opt.get(lab) || { lab, short: exkLab(q, c), n: 0, key: isKey }; o.n++; o.key = o.key || isKey; e.opt.set(lab, o); }); });
  const L = [...Q.values()].filter(e => e.n).map(e => ({ ...e, pct: Math.round(e.ok / e.n * 100), opts: [...e.opt.values()].sort((a, b) => b.n - a.n) }));
  return { L, P, old: EXK.papers.length - P.length };
}
function exaRender(){
  const body = $('exa-b'); if(!body) return;
  const { L, P, old } = exaData();
  if(!L.length){ body.innerHTML = `<p class="exa-note">لا توجد أوراق تحمل اختيارات الطلاب بعد${old ? ` — ${old} ${old === 1 ? 'ورقة صُوّرت' : 'أوراق صُوّرت'} قبل التحديث` : ''}. الأوراق المصوّرة من الآن تظهر هنا.</p>`; return; }
  const avg = P.length ? +(P.reduce((t, p) => t + (Number(p.score) || 0), 0) / P.length).toFixed(1) : 0, mx = P[0] ? P[0].max : 0;
  const hard = L.filter(e => e.n >= Math.min(3, P.length)).sort((a, b) => a.pct - b.pct).slice(0, 3).filter(e => e.pct < 80);
  const mis = hard.map(e => { const w = e.opts.find(o => !o.key); return w && w.n >= 2 && w.n >= (e.n - e.ok) * 0.3 ? { e, w } : null; }).filter(Boolean)[0];
  const who = new Set(); hard.forEach(e => P.forEach(p => { const a = e.at.find(x => x.tpl === p.tpl && x.m === (p.model || 0)); if(a && p.ch[a.i] !== omrQs(EXK.tpls[p.tpl].models[p.model || 0])[a.i].key) who.add(p.sid); }));
  const col = v => v < 50 ? 'r' : v < 75 ? 'a' : 'g';
  const list = (EXA.sort === 'hard' ? L.slice().sort((a, b) => a.pct - b.pct) : L.slice().sort((a, b) => a.no - b.no));
  body.innerHTML = `<p class="exa-note" style="margin-top:0">${P.length} ${P.length === 1 ? 'ورقة' : 'أوراق'} · المتوسط ${avg} من ${mx}${old ? ` · ${old} ${old === 1 ? 'ورقة قديمة' : 'أوراق قديمة'} خارج التحليل` : ''}</p>
    ${hard.length ? `<div class="exa-top3"><b>🔻 أصعب ${hard.length === 1 ? 'سؤال' : hard.length + ' أسئلة'}</b>
      <small>${hard.map(e => `س${e.no} ${e.pct}٪`).join(' · ')}</small>
      ${mis ? `<small class="exa-mis">💡 في س${mis.e.no} اختار ${mis.w.n} ${mis.w.n <= 10 ? 'طلاب' : 'طالبًا'} «${esc(mis.w.lab.slice(0, 60))}» — أكثر إجابة خاطئة شيوعًا</small>` : ''}
      ${who.size ? `<button type="button" class="btn wide exa-rem" onclick="exaRemedial()">🩹 مهمة علاجية منها لـ${who.size} ${who.size <= 10 ? 'طلاب' : 'طالبًا'} أخطؤوا فيها</button>` : ''}</div>` : '<div class="exa-card"><b>👍 لا أسئلة صعبة</b><small>كل الأسئلة أجاب عنها 80٪ فأكثر</small></div>'}
    <div class="exa-card"><div class="exa-row"><b>كل الأسئلة</b><button type="button" class="exa-sort" onclick="EXA.sort=EXA.sort==='hard'?'no':'hard';exaRender()">${EXA.sort === 'hard' ? 'الأصعب أولًا ▾' : 'بالترتيب ▾'}</button></div>
      ${list.map(e => `<div class="exa-q"><div class="exa-row"><span class="exa-qt">س${e.no}: ${esc(String(e.q.q || '').slice(0, 90)) || '—'}</span><b class="exa-p ${col(e.pct)}">${e.pct}٪</b></div>
        <div class="exa-bar"><i class="${col(e.pct)}" style="width:${e.pct}%"></i></div>
        <div class="exa-opts">${e.opts.map((o, j) => `<span class="${o.key ? 'k' : j === e.opts.findIndex(x => !x.key) && o.n >= 2 ? 'w' : ''}" title="${esc(o.lab)}">${esc(o.short)}: ${o.n}${o.key ? ' ✓' : ''}</span>`).join('')}${e.blank ? `<span>فارغ: ${e.blank}</span>` : ''}</div></div>`).join('')}</div>`;
  EXA.hard = hard;
}
async function exaRemedial(){
  const hard = EXA.hard || []; if(!hard.length) return;
  if(!(await askConfirm(`تُرسل لكل طالب أخطأ في ${hard.length === 1 ? 'هذا السؤال' : 'هذه الأسئلة'} مهمة علاجية في بوابته من الأسئلة نفسها وبدائلها — مهمة واحدة لكل طالب في هذا الاختبار.`, { title:'إرسال مهمة علاجية؟', yes:'أرسل', no:'إلغاء' }))) return;
  try{ const items = hard.flatMap(e => e.at.map(a => ({ tpl: a.tpl, m: a.m, i: a.i })));
    const j = await (await fetch(omrApi('/omr/remedial'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ t: getTok(), test: EXK.test, items }) })).json(); if(!j.ok) throw 0;
    toast(j.made ? `🩹 أُرسلت ${j.made} ${j.made === 1 ? 'مهمة علاجية' : 'مهام علاجية'}${j.skipped ? ` · ${j.skipped} لديهم مهمة لهذا الاختبار` : ''}` : (j.skipped ? 'لديهم مهام علاجية لهذا الاختبار من قبل' : 'لا طلاب يحتاجونها'));
  }catch(e){ toast('تعذّر الإرسال — تحقق من الاتصال'); }
}
document.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('[data-ex-paper]'); if(b){ e.preventDefault(); e.stopPropagation(); exPaperOpen(b.dataset.exPaper); } },true);
function renderExamGrades(){
  const cls=$('cls')?.value||'',q=String($('exam-search')?.value||'').trim(),b=examBook(),max=examMaxTotal(),t=exCurTest(),locked=academicClosed();
  if(t) exPapersLoad(String(t.id));
  examFilter.test=t?String(t.id):'';
  const base=list(cls).filter(s=>!q||s.name.includes(q));
  const rows=!t||examFilter.mode!=='missing'?base:base.filter(s=>examIsMissing(s.id));
  if($('ex-chips'))$('ex-chips').innerHTML=b.tests.map(x=>`<button type="button" class="${t&&String(t.id)===String(x.id)?'on':''}" onclick="exPick('${esc(String(x.id))}')">${esc(x.title)} · من ${fmt(x.max)}</button>`).join('')+(locked?'':'<button type="button" class="add" onclick="addExamTest()">＋ اختبار</button>');
  if($('ex-miss-btn')){$('ex-miss-btn').classList.toggle('on',examFilter.mode==='missing');$('ex-miss-btn').textContent=examFilter.mode==='missing'?'↩︎ الكل':'⚠️ لم يُرصد فقط';}
  const all=list(cls), vals=t?all.map(s=>exVal(s.id,t)):[], done=vals.filter(v=>v!=='').length, nums=vals.filter(v=>v!==''&&v!=='غ').map(Number), abs=vals.filter(v=>v==='غ').length;
  if($('exam-kpis'))$('exam-kpis').innerHTML=t?`<span>رُصد<b>${done} / ${all.length}</b></span><span>المتوسط<b>${nums.length?fmt(Math.round(nums.reduce((a,c)=>a+c,0)/nums.length*10)/10):'—'}<small> / ${fmt(t.max)}</small></b></span><span>الغائبون<b>${abs}</b></span>`:'';
  // 📷 اختبار له أوراق مصححة آليًا: مفتاح الإجابة (إعادة التصحيح) وتحليل الأسئلة
  if($('ex-omr-tools')){ const has=t&&EXPAP.test===String(t.id)&&EXPAP.sids.size; $('ex-omr-tools').innerHTML=has?`<button type="button" onclick="exKeyOpen()">🔑 مفتاح الإجابة</button><button type="button" onclick="exAnaOpen()">📊 تحليل الأسئلة</button>`:''; }
  if($('exam-count'))$('exam-count').textContent=`${rows.length} طالب`;
  const tr=academicPeriod();
  if($('exam-term-note'))$('exam-term-note').textContent=`${ctExamSP().sem===1?'الفصل الدراسي الأول':'الفصل الدراسي الثاني'} · ${ctExamSP().per===1?'الفترة الأولى':'الفترة الثانية'}${tr.start&&tr.end?`: ${tr.start} إلى ${tr.end}`:''} · ${locked?'🔒 الفصل مغلق':'🔓 الفصل مفتوح'} · ${b.tests.length?`${b.tests.length} اختبار · مجموع خام ${fmt(max)} → نهائي من 20`:'لم تُضف اختبارات بعد'}`;
  if($('exam-rules'))$('exam-rules').textContent=b.tests.length?`النهائي من 20 يُحسب نسبيًا: مجموع درجة الطالب في كل الاختبارات ÷ مجموع الدرجات القصوى لكل الاختبارات × 20. مثال: اختباران 10+10 = مجموع من 20، ثلاثة اختبارات 10+10+10 = مجموع من 30 ثم يُحوّل نسبيًا إلى 20، واختبار واحد من 10 يُحوّل ×2 إلى 20. الغائب يُعامل كمن لم تُرصد درجته حتى تُرصد له درجة.`:'أضف اختبارًا واحدًا أو أكثر. النظام يحوّل مجموع الاختبارات في هذه الفترة إلى 20 تلقائيًا.';
  if(!t){ if($('exam-list'))$('exam-list').innerHTML='<div class="empty">أضف اختبارًا من «＋ اختبار» لتبدأ الرصد.</div>'; return; }
  if($('exam-list'))$('exam-list').innerHTML=rows.map((s,i)=>{const v=exVal(s.id,t), final=examFor(s.id), cur=EXKB.sid===String(s.id);
    const shown=cur?(EXKB.buf===''?'':EXKB.buf):v;
    const pap=EXPAP.test===String(t.id)&&EXPAP.sids.has(String(s.id));
    return `<div class="ex-row${cur?' cur':''}" data-ex-row="${esc(s.id)}"><div class="ex-nm"${pap?` data-ex-paper="${esc(s.id)}" role="button" title="عرض ورقته المصححة"`:''}><i>${i+1}</i><span>${pap?'<b class="ex-pap">📄</b>':''}${esc(s.name)}${b.tests.length>1||final!=null?`<small>النهائي ${final==null?'—':fmt(final)} / 20</small>`:''}</span></div>
      <button type="button" class="ex-cell${cur?' f':shown==='غ'?' ab':shown!==''?' ok':''}" data-ex-cell="${esc(s.id)}" ${locked?'disabled':''} aria-label="درجة ${esc(s.name)}">${shown==='غ'?'غائب':esc(shown)}${cur?'<em class="ex-caret"></em>':''}</button>
      <button type="button" class="ex-full" data-ex-full="${esc(s.id)}" ${locked?'disabled':''} title="درجة كاملة (${fmt(t.max)})" aria-label="درجة كاملة">💯</button></div>`;}).join('')||`<div class="empty">${examFilter.mode==='missing'?'✓ رُصد الجميع في هذا الاختبار':'لا يوجد طلاب مطابقون.'}</div>`;
}
/* ⌨️ لوحة أرقام الاختبارات: سطران فقط، والطالب الحالي يُرفع فوقها دائمًا */
const EXKB={sid:'',buf:'',orig:''};
function exKbEl(){let k=$('ex-kb');if(k)return k;k=document.createElement('div');k.id='ex-kb';k.hidden=true;
  k.innerHTML=`<div class="exk-h">✏️ <b id="exk-name"></b><span id="exk-max"></span><button type="button" class="exk-x" data-k="x" aria-label="إغلاق اللوحة">✕</button></div>
  <div class="exk-d">${[1,2,3,4,5,6,7,8,9,0].map(n=>`<button type="button" data-k="${n}">${n}</button>`).join('')}</div>
  <div class="exk-e"><button type="button" data-k=".">.</button><button type="button" data-k="del" aria-label="مسح">⌫</button><button type="button" class="ab" data-k="abs">غائب</button><button type="button" class="nx" data-k="next" id="exk-next">التالي ⬇️</button></div>`;
  k.addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(b)exKbKey(b.dataset.k)});
  document.body.appendChild(k);return k;}
function exRowsSids(){return [...document.querySelectorAll('#exam-list [data-ex-row]')].map(x=>x.dataset.exRow);}
function exKbOpen(sid){
  const t=exCurTest();if(!t||academicClosed())return;
  const s=TPX_STU().find(x=>x.id===String(sid));if(!s)return;
  EXKB.sid=String(sid);EXKB.orig=exVal(sid,t);EXKB.buf=EXKB.orig==='غ'?'':EXKB.orig;
  const k=exKbEl();k.hidden=false;document.body.classList.add('ex-kb-on');
  $('exk-name').textContent=s.name;$('exk-max').textContent='من '+fmt(t.max);
  const ids=exRowsSids(),nx=ids[ids.indexOf(EXKB.sid)+1],ns=nx&&TPX_STU().find(x=>x.id===nx);
  $('exk-next').textContent=ns?'التالي ⬇️':'حفظ ✓';
  renderExamGrades();exKbScroll();
}
function exKbScroll(){const r=document.querySelector(`#exam-list [data-ex-row="${CSS.escape(EXKB.sid)}"]`),k=$('ex-kb');if(!r||!k)return;
  const kt=k.getBoundingClientRect().top,rb=r.getBoundingClientRect().bottom,hd=document.querySelector('header'),top=(hd?hd.offsetHeight:0)+8;
  if(rb>kt-10||r.getBoundingClientRect().top<top)window.scrollBy({top:rb-(kt-12),behavior:'smooth'});}
async function exKbCommit(){
  const t=exCurTest();if(!t||!EXKB.sid)return true;
  const v=EXKB.buf;if(v===EXKB.orig||(v===''&&EXKB.orig==='غ'))return true;
  if(v!==''&&Number(v)>Number(t.max)){toast(`الدرجة أعلى من القصوى (${fmt(t.max)})`);return false;}
  if(v===''&&EXKB.orig===''){return true;}
  await setExamScore(EXKB.sid,t.id,v,true);return true;
}
function exKbClose(commit){
  const go=async()=>{if(commit&&!(await exKbCommit()))return;EXKB.sid='';EXKB.buf='';const k=$('ex-kb');if(k)k.hidden=true;document.body.classList.remove('ex-kb-on');renderExamGrades();};
  if(!EXKB.sid){const k=$('ex-kb');if(k)k.hidden=true;document.body.classList.remove('ex-kb-on');return;}
  go();
}
async function exKbKey(k){
  if(!EXKB.sid)return;
  if(k==='x'){exKbClose(true);return}
  const ids=exRowsSids(),next=ids[ids.indexOf(EXKB.sid)+1]||'';
  if(k==='next'){if(!(await exKbCommit()))return;if(next)exKbOpen(next);else{exKbClose(false);toast('✓ انتهى الرصد');}return}
  if(k==='abs'){const t=exCurTest();await setExamScore(EXKB.sid,t.id,'غ',true);if(next)exKbOpen(next);else exKbClose(false);return}
  if(k==='del')EXKB.buf=EXKB.buf.slice(0,-1);
  else if(k==='.'){if(!EXKB.buf.includes('.'))EXKB.buf=(EXKB.buf||'0')+'.';}
  else if(/^\d$/.test(k)){if(EXKB.buf.replace('.','').length<4)EXKB.buf=(EXKB.buf==='0'&&k!=='.'?'':EXKB.buf)+k;}
  const t=exCurTest();if(t&&EXKB.buf!==''&&Number(EXKB.buf)>Number(t.max))toast(`أعلى من القصوى (${fmt(t.max)})`);
  const c=document.querySelector(`#exam-list [data-ex-cell="${CSS.escape(EXKB.sid)}"]`);if(c)c.innerHTML=esc(EXKB.buf)+'<em class="ex-caret"></em>';
}
document.addEventListener('keydown',e=>{if(!EXKB.sid||e.target.closest('input,textarea,select'))return;
  const m=e.key==='Enter'?'next':e.key==='Backspace'?'del':e.key==='Escape'?'x':/^[0-9.]$/.test(e.key)?e.key:/^[٠-٩]$/.test(e.key)?String('٠١٢٣٤٥٦٧٨٩'.indexOf(e.key)):'';
  if(m){e.preventDefault();exKbKey(m);}});
/* ═══════════ 📷 محرّك التصحيح الآلي (OMR) — JavaScript خالص بلا مكتبات ═══════════
   المدخل: صورة (ImageData) + «خريطة الإجابة» لنموذج (مواقع المربعات بالمليمتر + المفتاح).
   الخطوات: رمادي ← اكتشاف الورقة (أكبر مساحة فاتحة) ← تحويل منظوري مم→بكسل
            ← محاذاة متدرجة (الصفحة ← القسم ← السؤال ← المربع) ← قياس امتلاء كل مربع ← قرار.
   لا يُخمّن: ما ليس واضحًا يُعاد «يحتاج مراجعة». */
const OMR = (() => {
  const PAPER = { w: 210, h: 297 };
  const FRAME = [4.5, 4.5, 201, 287];     // .exam-page::before { inset:4.5mm } — إطار مطبوع حول الصفحة كلها

  /* الرمادي للحبر الداكن والرصاص، والتشبع اللوني (أقصى−أدنى قناة) لأقلام الألوان:
     الطباعة والورق رماديان (تشبع ≈ 9)، والقلم الأحمر/الأزرق ملوّن (≈ 25–60) ولو كان فاتحًا. */
  function gray(img) {
    const { data, width: w, height: h } = img, g = new Float32Array(w * h), c = new Float32Array(w * h);
    for (let i = 0, j = 0; i < g.length; i++, j += 4) {
      const r = data[j], gg = data[j + 1], b = data[j + 2];
      g[i] = 0.299 * r + 0.587 * gg + 0.114 * b;
      c[i] = Math.max(r, gg, b) - Math.min(r, gg, b);
    }
    return { g, c, w, h };
  }
  function downscale(G, maxSide) {
    const f = Math.min(1, maxSide / Math.max(G.w, G.h)), w = Math.max(1, Math.round(G.w * f)), h = Math.max(1, Math.round(G.h * f));
    const out = new Float32Array(w * h), sx = G.w / w, sy = G.h / h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * sx), y0 = Math.floor(y * sy), x1 = Math.min(G.w, Math.floor((x + 1) * sx)), y1 = Math.min(G.h, Math.floor((y + 1) * sy));
      let s = 0, n = 0; for (let yy = y0; yy < Math.max(y1, y0 + 1); yy++) for (let xx = x0; xx < Math.max(x1, x0 + 1); xx++) { s += G.g[yy * G.w + xx]; n++; }
      out[y * w + x] = s / n;
    }
    return { g: out, w, h, f: w / G.w };
  }
  function boxBlur(G, r) {
    const { w, h } = G, a = G.g, t = new Float32Array(w * h), o = new Float32Array(w * h);
    for (let y = 0; y < h; y++) { let s = 0; const row = y * w;
      for (let x = -r; x <= r; x++) s += a[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) { t[row + x] = s / (2 * r + 1); s += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)]; } }
    for (let x = 0; x < w; x++) { let s = 0;
      for (let y = -r; y <= r; y++) s += t[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) { o[y * w + x] = s / (2 * r + 1); s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
    return { g: o, w, h, f: G.f };
  }
  function otsu(a) {
    const hist = new Float64Array(256); for (const v of a) hist[Math.max(0, Math.min(255, v | 0))]++;
    const n = a.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sB = 0, wB = 0, best = 0, th = 127;
    for (let i = 0; i < 256; i++) { wB += hist[i]; if (!wB) continue; const wF = n - wB; if (!wF) break; sB += i * hist[i];
      const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if (v > best) { best = v; th = i; } }
    return th;
  }
  /* الورقة = أكبر مكوّن فاتح متصل؛ زواياها أطراف الإسقاطات (x+y) و(x−y) */
  function findPaper(G, opts = {}) {
    const S = boxBlur(downscale(G, 640), 5), { w, h } = S, thHi = otsu(S.g);
    let sb = 0, nb = 0, sf = 0, nf = 0; for (const v of S.g) { if (v > thHi) { sf += v; nf++; } else { sb += v; nb++; } }
    const mB = nb ? sb / nb : 0, mF = nf ? sf / nf : 255;
    const th = opts.hiOnly ? thHi : mB + 0.38 * (mF - mB);   // حد النمو: أفتح بوضوح من الخلفية
    const lab = new Int32Array(w * h), q = new Int32Array(w * h); let best = { n: 0, id: 0 }, id = 0;
    for (let i = 0; i < w * h; i++) {
      if (lab[i] || S.g[i] <= th) continue; id++; let qh = 0, qt = 0, n = 0; q[qt++] = i; lab[i] = id;
      while (qh < qt) { const p = q[qh++]; n++; const x = p % w, y = (p / w) | 0;
        if (x > 0 && !lab[p - 1] && S.g[p - 1] > th) { lab[p - 1] = id; q[qt++] = p - 1; }
        if (x < w - 1 && !lab[p + 1] && S.g[p + 1] > th) { lab[p + 1] = id; q[qt++] = p + 1; }
        if (y > 0 && !lab[p - w] && S.g[p - w] > th) { lab[p - w] = id; q[qt++] = p - w; }
        if (y < h - 1 && !lab[p + w] && S.g[p + w] > th) { lab[p + w] = id; q[qt++] = p + w; } }
      if (n > best.n) best = { n, id };
    }
    if (best.n < 0.12 * w * h) return null;
    // الخلفية فاتحة فالتصقت بالورقة (المكوّن يلامس أغلب إطار الصورة): ارجع للعتبة العليا
    let touch = 0; for (let x = 0; x < w; x++) { if (lab[x] === best.id) touch++; if (lab[(h - 1) * w + x] === best.id) touch++; }
    for (let y = 0; y < h; y++) { if (lab[y * w] === best.id) touch++; if (lab[y * w + w - 1] === best.id) touch++; }
    if (touch > 0.35 * 2 * (w + h) && !opts.hiOnly) return findPaper(G, { hiOnly: true });
    let tl = [0, 0, 1e9], br = [0, 0, -1e9], tr = [0, 0, -1e9], bl = [0, 0, 1e9];
    for (let i = 0; i < w * h; i++) { if (lab[i] !== best.id) continue; const x = i % w, y = (i / w) | 0, s = x + y, d = x - y;
      if (s < tl[2]) tl = [x, y, s]; if (s > br[2]) br = [x, y, s]; if (d > tr[2]) tr = [x, y, d]; if (d < bl[2]) bl = [x, y, d]; }
    const k = 1 / S.f, P = c => [(c[0] + 0.5) * k, (c[1] + 0.5) * k];
    const quad = [P(tl), P(tr), P(br), P(bl)];
    const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const wT = len(quad[0], quad[1]), wB = len(quad[3], quad[2]), hL = len(quad[0], quad[3]), hR = len(quad[1], quad[2]);
    if (Math.min(wT, wB, hL, hR) < 0.2 * Math.min(G.w, G.h)) return null;
    return { quad, area: best.n / (w * h) };
  }
  /* تنقيح حواف الورقة: لكل ضلع نقاط كثيرة، ولكل نقطة أقوى انتقال «فاتح داخل ← داكن خارج» على العمودي،
     ثم خط مطابق بالمربعات الصغرى مع استبعاد الشاذ، والزوايا = تقاطع الأضلاع. */
  function refineQuad(G, quad) {
    const c = quad.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);
    const R = Math.max(8, Math.round(0.035 * Math.min(G.w, G.h)));
    const lines = [];
    for (let e = 0; e < 4; e++) {
      const A = quad[e], B = quad[(e + 1) % 4];
      const tx = B[0] - A[0], ty = B[1] - A[1], L = Math.hypot(tx, ty); let nx = -ty / L, ny = tx / L;
      const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      if ((mid[0] - c[0]) * nx + (mid[1] - c[1]) * ny < 0) { nx = -nx; ny = -ny; }   // العمودي للخارج
      const pts = [];
      for (let k = 0; k < 48; k++) {
        const t = 0.08 + 0.84 * k / 47, px = A[0] + tx * t, py = A[1] + ty * t;
        let best = -1e9, bs = 0;
        for (let sft = -R; sft <= R; sft++) {
          const inS = (d) => sample(G, px + nx * (sft - d) - ty / L * 0, py + ny * (sft - d));
          const g = (inS(3) + inS(2)) - (inS(-2) + inS(-3));   // داخل − خارج
          if (g > best) { best = g; bs = sft; }
        }
        if (best > 25) pts.push([px + nx * bs, py + ny * bs]);
      }
      if (pts.length < 10) return quad;
      lines.push(fitLine(pts));
    }
    const out = [];
    for (let i = 0; i < 4; i++) { const p = intersect(lines[(i + 3) % 4], lines[i]); if (!p) return quad; out.push(p); }
    // سلامة: الزوايا المنقحة قريبة من الأولية
    for (let i = 0; i < 4; i++) if (Math.hypot(out[i][0] - quad[i][0], out[i][1] - quad[i][1]) > 3 * R) return quad;
    return out;
  }
  function fitLine(pts) {
    let P = pts;
    for (let it = 0; it < 3; it++) {
      const mx = P.reduce((a, p) => a + p[0], 0) / P.length, my = P.reduce((a, p) => a + p[1], 0) / P.length;
      let sxx = 0, syy = 0, sxy = 0; for (const [x, y] of P) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
      const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), dx = Math.cos(ang), dy = Math.sin(ang);
      const res = P.map(([x, y]) => Math.abs(-(x - mx) * dy + (y - my) * dx));
      const med = res.slice().sort((a, b) => a - b)[res.length >> 1];
      const keep = P.filter((_, i) => res[i] <= Math.max(1.5, med * 2.5));
      if (it === 2 || keep.length < 8) return { mx, my, dx, dy };
      P = keep;
    }
  }
  function intersect(a, b) {
    const d = a.dx * b.dy - a.dy * b.dx; if (Math.abs(d) < 1e-6) return null;
    const t = ((b.mx - a.mx) * b.dy - (b.my - a.my) * b.dx) / d; return [a.mx + a.dx * t, a.my + a.dy * t];
  }
  /* 🖼️ السطح فاتح (الورقة لا تتميز عنه بالسطوع): نبحث عن الإطار المطبوع نفسه.
     حبر = أغمق من محيطه المباشر (تباين محلي، لا سطوع مطلق) ← مكوّنات متصلة ←
     الإطار هو المكوّن الكبير الذي تقع بكسلاته على أضلاع رباعي (خط مغلق)، لا نص ولا ملمس سطح. */
  function findFrame(G) {
    // الدقة الكاملة (حتى 1600): خط الإطار (0.26 مم) يذوب في الورق عند التصغير
    const S = downscale(G, 1600), { w, h } = S, B = boxBlur(S, 7);
    const ink = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (S.g[i] < B.g[i] * 0.94) ink[i] = 1;
    const m = new Uint8Array(w * h);                                   // تمديد بكسل واحد يصل انقطاعات الخط الرفيع
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (ink[i] || ink[i - 1] || ink[i + 1] || ink[i - w] || ink[i + w]) m[i] = 1;
    }
    const lab = new Int32Array(w * h), q = new Int32Array(w * h); let id = 0, best = null; const cands = [];
    const diag = Math.hypot(w, h);
    for (let i0 = 0; i0 < w * h; i0++) {
      if (!m[i0] || lab[i0]) continue; id++;
      let qh = 0, qt = 0; q[qt++] = i0; lab[i0] = id;
      let x0 = w, x1 = 0, y0 = h, y1 = 0;
      while (qh < qt) { const p = q[qh++], x = p % w, y = (p / w) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const n = yy * w + xx; if (m[n] && !lab[n]) { lab[n] = id; q[qt++] = n; } } }
      if (x1 - x0 < 0.3 * w || y1 - y0 < 0.3 * h) continue;
      // زوايا المكوّن بأطراف الإسقاطات، ثم نسبة بكسلاته القريبة من أضلاع الرباعي
      let tl = [0, 0, 1e9], br = [0, 0, -1e9], tr = [0, 0, -1e9], bl = [0, 0, 1e9];
      for (let k = 0; k < qt; k++) { const p = q[k], x = p % w, y = (p / w) | 0, s1 = x + y, d1 = x - y;
        if (s1 < tl[2]) tl = [x, y, s1]; if (s1 > br[2]) br = [x, y, s1]; if (d1 > tr[2]) tr = [x, y, d1]; if (d1 < bl[2]) bl = [x, y, d1]; }
      const quad = [tl, tr, br, bl].map(c => [c[0], c[1]]);
      const tol = Math.max(3, 0.012 * diag); let near = 0;
      const segD = (px, py, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy || 1;
        const t = Math.max(0, Math.min(1, ((px - a[0]) * vx + (py - a[1]) * vy) / L)); return Math.hypot(px - a[0] - t * vx, py - a[1] - t * vy); };
      for (let k = 0; k < qt; k += 2) { const p = q[k], x = p % w, y = (p / w) | 0;
        if (Math.min(segD(x, y, quad[0], quad[1]), segD(x, y, quad[1], quad[2]), segD(x, y, quad[2], quad[3]), segD(x, y, quad[3], quad[0])) <= tol) near++; }
      const ratio = near / Math.ceil(qt / 2);
      const area = Math.abs((quad[2][0] - quad[0][0]) * (quad[3][1] - quad[1][1]) - (quad[3][0] - quad[1][0]) * (quad[2][1] - quad[0][1])) / 2;
      if (ratio >= 0.8) cands.push({ quad, area, ratio, id });
    }
    // إطار الصفحة يحيط بكل حبر الورقة تقريبًا؛ مربع قسم الأسئلة (مستطيل مغلق أيضًا) يحيط بنصفه فقط
    const inQuad = (px, py, Q) => { let s0 = 0; for (let e = 0; e < 4; e++) { const a = Q[e], b = Q[(e + 1) % 4], c = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]); if (c !== 0) { if (!s0) s0 = Math.sign(c); else if (Math.sign(c) !== s0) return false; } } return true; };
    for (const c of cands.sort((a, b) => b.area - a.area)) {
      let inside = 0, total = 0;
      for (let i = 0; i < w * h; i += 7) { if (!ink[i] || lab[i] === c.id) continue; total++; if (inQuad(i % w, (i / w) | 0, c.quad)) inside++; }
      // الحبر خارج الإطار يشمل ملمس السطح؛ نطلب أغلب الحبر «القريب» داخله: نقيس داخل الإطار الموسّع قليلًا
      const cx = c.quad.reduce((s1, p) => s1 + p[0], 0) / 4, cy = c.quad.reduce((s1, p) => s1 + p[1], 0) / 4;
      const grown = c.quad.map(([x, y]) => [cx + (x - cx) * 1.35, cy + (y - cy) * 1.35]);
      let near = 0; for (let i = 0; i < w * h; i += 7) { if (!ink[i] || lab[i] === c.id) continue; if (inQuad(i % w, (i / w) | 0, grown)) near++; }
      if (!near || inside / near >= 0.8) { best = c; break; }
    }
    if (!best) return null;
    const k = 1 / S.f;
    return { quad: best.quad.map(([x, y]) => [(x + 0.5) * k, (y + 0.5) * k]), rect: FRAME, frame: true, area: best.area / (w * h) };
  }
  /* ⬛ علامات الزوايا المطبوعة (أربعة مربعات سوداء، أسفل اليسار مفرّغ): مراكزها تعطي الورقة بدقة
     ولو طُبعت مصغّرة («ملاءمة الصفحة») أو قُصّت حافتها أو التصقت بسطح فاتح.
     marks: مستطيلاتها بالمم بالترتيب: أعلى اليسار، أعلى اليمين، أسفل اليمين، أسفل اليسار. */
  function findMarks(G, marks, M, lim, blurFor) {
    // blurFor: قصّة من صورة أكبر تأخذ نصف قطر التنعيم نفسه الذي للصورة كاملة (وإلا اختلف حكم «داكن نسبةً لما حوله»)
    const S = downscale(G, lim || 1200), { w, h } = S, B = boxBlur(S, Math.max(6, Math.round((blurFor || Math.max(w, h)) / 60)));
    const dark = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (B.g[i] > 35 && S.g[i] < B.g[i] * 0.62) dark[i] = 1;
    const lab = new Int32Array(w * h), q = new Int32Array(w * h), C = [], maxS = 0.09 * Math.max(w, h);
    let id = 0;
    for (let i0 = 0; i0 < w * h; i0++) {
      if (!dark[i0] || lab[i0]) continue; id++;
      let qh = 0, qt = 0, x0 = w, x1 = 0, y0 = h, y1 = 0, sx = 0, sy = 0, big = false; q[qt++] = i0; lab[i0] = id;
      while (qh < qt) { const p = q[qh++], x = p % w, y = (p / w) | 0; sx += x; sy += y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x1 - x0 > maxS || y1 - y0 > maxS) big = true;
        if (x > 0 && dark[p - 1] && !lab[p - 1]) { lab[p - 1] = id; q[qt++] = p - 1; }
        if (x < w - 1 && dark[p + 1] && !lab[p + 1]) { lab[p + 1] = id; q[qt++] = p + 1; }
        if (y > 0 && dark[p - w] && !lab[p - w]) { lab[p - w] = id; q[qt++] = p - w; }
        if (y < h - 1 && dark[p + w] && !lab[p + w]) { lab[p + w] = id; q[qt++] = p + w; } }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      if (big || qt < 12 || bw < 4 || bh < 4 || bw / bh > 2.2 || bh / bw > 2.2 || qt / (bw * bh) < 0.5) continue;
      // شكل العلامة نفسها: حلقة داكنة على ٠٫٣٨ من ضلعها (بين فتحة المفرّغة وحافتها)، ومحيط فاتح معزول حولها (لا حروف ولا خطوط ملاصقة).
      // مربع الإجابة الفارغ (حدّ رفيع) داخله فاتح فيُرفض، والمظلَّل عادةً تلاصقه حروف الخيار.
      const cx = sx / qt, cy = sy / qt, hf = (bw + bh) / 4, at = (dx, dy) => sample(S, cx + dx, cy + dy);
      const ring = [], out = [];
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; ring.push(at(Math.cos(a) * hf * 0.76, Math.sin(a) * hf * 0.76)); }
      for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; out.push(at(Math.cos(a) * hf * 2, Math.sin(a) * hf * 2)); }
      const med = v => v.slice().sort((x, y) => x - y)[v.length >> 1], ink = med(ring), paper = med(out);
      if (ring.filter(v => v > ink + 0.45 * (paper - ink)).length > 1 || paper - ink < 0.35 * paper) continue;   // عيّنة واحدة على حافة مغبّشة مسموحة
      const mid = ink + 0.55 * (paper - ink);
      if (out.filter(v => v > mid).length < 14) continue;
      const c0 = (at(0, 0) + at(1, 0) + at(-1, 0) + at(0, 1) + at(0, -1)) / 5;
      C.push({ x: cx, y: cy, s: 2 * hf, hollow: c0 > mid });
    }
    findMarks.cands = C.length <= 400 ? C.map(c => [(c.x + 0.5) / S.f, (c.y + 0.5) / S.f]) : [];   // للتوجيه الحي: أي زاوية ظاهرة
    if (C.length < 4 || C.length > 4000) return null;
    // لكل زاوية في الصورة: أبعد المرشحين في اتجاهها، ثم أفضل رباعي يحقق شكل العلامات
    const dirs = [c => -(c.x + c.y), c => c.x - c.y, c => c.x + c.y, c => c.y - c.x];
    const top = dirs.map(f => C.slice().sort((a, b) => f(b) - f(a)).slice(0, 6));
    const mc = marks.map(r => [r[0] + r[2] / 2, r[1] + r[3] / 2]), mmW = mc[1][0] - mc[0][0], mmH = mc[3][1] - mc[0][1], mSide = (marks[0][2] + marks[1][2] + marks[2][2]) / 3;
    const L = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const ok = [];
    for (const a of top[0]) for (const b of top[1]) for (const c of top[2]) for (const d of top[3]) {
      const Q = [a, b, c, d]; if (new Set(Q).size < 4) continue;
      const hl = Q.map((p, i) => p.hollow ? i : -1).filter(i => i >= 0); if (hl.length !== 1) continue;
      const ss = Q.map(p => p.s); if (Math.max(...ss) > 2.2 * Math.min(...ss)) continue;
      let conv = true; for (let i = 0; i < 4; i++) { const p = Q[i], n = Q[(i + 1) % 4], m = Q[(i + 2) % 4]; if ((n.x - p.x) * (m.y - n.y) - (n.y - p.y) * (m.x - n.x) <= 0) { conv = false; break; } }
      if (!conv) continue;
      const rot = (hl[0] + 1) % 4, O = [0, 1, 2, 3].map(i => Q[(i + rot) % 4]);   // بترتيب الورقة (المفرّغة = أسفل اليسار)
      const pw = (L(O[0], O[1]) + L(O[3], O[2])) / 2, ph = (L(O[0], O[3]) + L(O[1], O[2])) / 2;
      const ar = (ph / pw) / (mmH / mmW); if (ar < 0.72 || ar > 1.35) continue;
      const exp = mSide * pw / mmW, ms = ss.reduce((x, y) => x + y, 0) / 4; if (ms < 0.55 * exp || ms > 1.6 * exp) continue;
      ok.push({ O, area: pw * ph });
    }
    // التحقق الأخير: إطارات الأقسام والعنوان من القالب تقع حيث تقول العلامات (لا نثق بأربع بقع تشبه العلامات)
    const k = 1 / S.f, rect = [mc[0][0], mc[0][1], mmW, mmH], src = [[rect[0], rect[1]], [rect[0] + mmW, rect[1]], [rect[0] + mmW, rect[1] + mmH], [rect[0], rect[1] + mmH]];
    // 📄📄 الاختبار متعدد الصفحات: الصورة قد تكون أي صفحة منه، فتُقبل إن طابقت إطاراتُ أيٍّ منها (كانت الصفحة الأولى وحدها تُختبر
    // فتُرفض الثانية إن اختلف تخطيطها، وتُقرأ كأنها الأولى)
    const pageSet = P => P && P.anchors && P.anchors.length ? { lines: [].concat(...P.anchors.map(r => outlinePts(r, 2))), boxes: (P.questions || []).flatMap(q => q.boxes.map(r => outlinePts(r, 1))) } : null;
    const sets = (M ? [M].concat(Array.isArray(M.more) ? M.more : []) : []).map(pageSet).filter(Boolean);
    for (const c of ok.sort((a, b) => b.area - a.area).slice(0, 4)) {
      const quad = c.O.map(p => [(p.x + 0.5) * k, (p.y + 0.5) * k]);
      if (sets.length) { const Hq = homography(src, quad); let best = -Infinity;
        for (const st of sets) { best = Math.max(best, searchSet(G, Hq, st, 1.5, 1.5, 0.5, 0.9).s); if (best >= 14) break; }
        findMarks.last = best; if (best < 14) continue; }
      return { quad, rect, marks: true, area: c.area / (w * h) };
    }
    return null;
  }
  /* تحويل منظوري: 4 نقاط مصدر (مم) ← 4 نقاط هدف (بكسل) */
  function homography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) { const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
    for (let c = 0; c < 8; c++) { let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = 0; r < 8; r++) { if (r === c) continue; const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; } }
    const hm = b.map((v, i) => v / A[i][i]); hm.push(1); return hm;
  }
  const apply = (H, x, y) => { const d = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / d, (H[3] * x + H[4] * y + H[5]) / d]; };
  function sample(G, x, y) {
    if (x < 0 || y < 0 || x >= G.w - 1 || y >= G.h - 1) return 255;
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * G.w + x0, a = G.g;
    return a[i] * (1 - fx) * (1 - fy) + a[i + 1] * fx * (1 - fy) + a[i + G.w] * (1 - fx) * fy + a[i + G.w + 1] * fx * fy;
  }
  function sampleC(G, x, y) {
    if (x < 0 || y < 0 || x >= G.w - 1 || y >= G.h - 1) return 0;
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * G.w + x0, a = G.c;
    return a[i] * (1 - fx) * (1 - fy) + a[i + 1] * fx * (1 - fy) + a[i + G.w] * (1 - fx) * fy + a[i + G.w + 1] * fx * fy;
  }
  /* نقاط على محيط مستطيل (مم) للمحاذاة: الخط الداكن مقابل ما حوله مباشرة */
  function outlinePts(r, step) {
    const [x, y, w, h] = r, pts = [];
    const nW = Math.max(3, Math.round(w / step)), nH = Math.max(3, Math.round(h / step));
    for (let i = 0; i <= nW; i++) { const X = x + w * i / nW; pts.push([X, y, 0, -1, 0], [X, y + h, 0, 1, 1]); }
    for (let i = 1; i < nH; i++) { const Y = y + h * i / nH; pts.push([x, Y, -1, 0, 2], [x + w, Y, 1, 0, 3]); }
    return pts;
  }
  /* تباين الحافة: داكن على الخط، فاتح خارجه بـ o مم */
  function onLine(G, H, x, y, nx, ny) {
    let m = 255;
    for (const t of [-0.3, 0, 0.3]) { const p = apply(H, x + nx * t, y + ny * t); const v = sample(G, p[0], p[1]); if (v < m) m = v; }
    return m;
  }
  function edgeScore(G, H, pts, dx, dy, o) {
    let s = 0;
    for (const [x, y, nx, ny] of pts) {
      const out = apply(H, x + dx + nx * o, y + dy + ny * o);
      s += sample(G, out[0], out[1]) - onLine(G, H, x + dx, y + dy, nx, ny);
    }
    return s / pts.length;
  }
  function boxScore(G, H, pts, dx, dy, o) {
    const s = [0, 0, 0, 0], n = [0, 0, 0, 0];
    for (const [x, y, nx, ny, e] of pts) {
      const out = apply(H, x + dx + nx * o, y + dy + ny * o);
      s[e] += sample(G, out[0], out[1]) - onLine(G, H, x + dx, y + dy, nx, ny); n[e]++;
    }
    return Math.min(s[0] / n[0], s[1] / n[1], s[2] / n[2], s[3] / n[3]);
  }
  /* بحث بإزاحة لمجموعة: خطوط الإطارات (متوسط) + مربعات (كل مربع بأضعف أضلاعه)
     نافذة أفقية وعمودية مستقلتان: فرق الطباعة أفقيًا ضئيل، وعموديًا يصل 3.5 مم */
  function searchSet(G, H, set, rx, ry, step, o, base = [0, 0]) {
    let best = { s: -1e9, dx: base[0], dy: base[1] };
    const [y0, y1] = Array.isArray(ry) ? ry : [-ry, ry];   // نافذة عمودية غير متماثلة ممكنة
    for (let dy = y0; dy <= y1 + 1e-9; dy += step) for (let dx = -rx; dx <= rx + 1e-9; dx += step) {
      const X = base[0] + dx, Y = base[1] + dy;
      let sc = 0, w = 0;
      if (set.lines && set.lines.length) { sc += edgeScore(G, H, set.lines, X, Y, o) * 0.5; w += 0.5; }
      if (set.boxes && set.boxes.length) { let b = 0; for (const p of set.boxes) b += set.strict ? boxScore(G, H, p, X, Y, o) : edgeScore(G, H, p, X, Y, o); sc += b / set.boxes.length; w += 1; }
      sc /= w;
      if (sc > best.s) best = { s: sc, dx: X, dy: Y };
    }
    return best;
  }
  function searchShift(G, H, pts, range, step, o, base = [0, 0]) {
    let best = { s: -1e9, dx: base[0], dy: base[1] };
    for (let dy = -range; dy <= range + 1e-9; dy += step) for (let dx = -range; dx <= range + 1e-9; dx += step) {
      const s = edgeScore(G, H, pts, base[0] + dx, base[1] + dy, o); if (s > best.s) best = { s, dx: base[0] + dx, dy: base[1] + dy };
    }
    return best;
  }
  /* محاذاة الصفحة: تجربة الاتجاهات الأربعة + إزاحة ومقياس، باختيار أعلى تباين للحواف */
  function alignPage(G, quad, M, scan, extra, rect, fixed) {
    const allPts = [].concat(...M.anchors.map(r => outlinePts(r, 1.5)), ...M.questions.flatMap(q => q.boxes.map(r => outlinePts(r, 0.8))));
    const set = { lines: [].concat(...M.anchors.map(r => outlinePts(r, 1.5))), boxes: M.questions.flatMap(q => q.boxes.map(r => outlinePts(r, 0.8))).concat(extra ? extra.cells.map(r => outlinePts(r, 0.5)) : []) };
    const R = rect || [0, 0, PAPER.w, PAPER.h];
    const corners = [[R[0], R[1]], [R[0] + R[2], R[1]], [R[0] + R[2], R[1] + R[3]], [R[0], R[1] + R[3]]];
    let best = null;
    // علامات الزوايا: الاتجاه والمقياس معروفان، والمحتوى طُبع معها فلا إزاحة طباعة تُذكر
    const rots = fixed ? [0] : scan ? [0, 2] : [0, 1, 2, 3], angs = scan && !fixed ? [-1.5, -1, -0.5, 0, 0.5, 1, 1.5] : [0], scs = fixed ? [1] : scan ? [1, 0.985] : [1, 0.985, 0.97];
    const RY = fixed ? [-1.5, 1.5] : [-4.5, 1.5], RX = fixed ? 1.5 : 2.5;
    const Hof = (rot, ang, s) => {
      const dst = [0, 1, 2, 3].map(i => quad[(i + rot) % 4]);
      const ca = Math.cos(ang * Math.PI / 180), sa = Math.sin(ang * Math.PI / 180);
      const src = corners.map(([x, y]) => { const u = (x - PAPER.w / 2) * s, v = (y - PAPER.h / 2) * s; return [u * ca - v * sa + PAPER.w / 2, u * sa + v * ca + PAPER.h / 2]; });
      return homography(src, dst);
    };
    // ١) الاتجاه أولًا (مقارنة سريعة بلا دوران)، ٢) ثم الدوران والمقياس لذلك الاتجاه وحده
    let rot = 0, rb = -1e9;
    if (rots.length > 1) for (const r of rots) { const q = searchSet(G, Hof(r, 0, 1), set, RX, RY, 1, 0.9); if (q.s > rb) { rb = q.s; rot = r; } }
    for (const ang of angs) for (const s of scs) {
      const H = Hof(rot, ang, s);
      // الطباعة تُزيح المحتوى لأعلى دائمًا (−1.5…−3.5 مم مقيسة) ⇒ نافذة عمودية غير متماثلة تمنع الانزلاق صفًا لأسفل
      const r = searchSet(G, H, set, RX, RY, 0.5, 0.9);
      if (!best || r.s > best.s) best = { ...r, H, rot, sc: s };
    }
    // تنقيح دقيق حول الأفضل
    const fine = searchSet(G, best.H, set, 1, 1, 0.25, 0.9, [best.dx, best.dy]);
    return { H: best.H, dx: fine.dx, dy: fine.dy, score: fine.s, rot: best.rot };
  }
  /* قياس امتلاء المربع: عينات داخلية مقابل إضاءة محلية */
  function boxFill(G, H, r, dx, dy, darkOnly) {
    const [x, y, w, h] = r, ins = Math.min(w, h) * 0.22, N = 7;
    // الإضاءة المحلية: أفتح عيّنات حلقة واسعة حول المربع (الورق)، لا تتأثر بالحبر
    const ring = [];
    for (let i = 0; i < 24; i++) { const a = i / 24 * 2 * Math.PI, R = Math.max(w, h) * 0.5 + 2.2;
      const p = apply(H, x + w / 2 + Math.cos(a) * R + dx, y + h / 2 + Math.sin(a) * R + dy); ring.push(sample(G, p[0], p[1])); }
    ring.sort((a, b) => b - a); const paper = Math.max(40, ring[Math.floor(ring.length * 0.2)]);
    // تشبع الورق المحلي (أساس المقارنة للقلم الملوّن)
    const ringC = [];
    for (let i = 0; i < 16; i++) { const a = i / 16 * 2 * Math.PI, R = Math.max(w, h) * 0.5 + 2.4;
      const p = apply(H, x + w / 2 + Math.cos(a) * R + dx, y + h / 2 + Math.sin(a) * R + dy); ringC.push(sampleC(G, p[0], p[1])); }
    ringC.sort((a, b) => a - b); const paperC = ringC[Math.floor(ringC.length * 0.3)];
    const colored = (p) => { const v = sample(G, p[0], p[1]), cc = sampleC(G, p[0], p[1]); return cc - paperC > 13 && (paper - v) / paper > 0.06; };
    let dark = 0, sum = 0, col = 0;
    for (let iy = 0; iy < N; iy++) for (let ix = 0; ix < N; ix++) {
      const px = x + ins + (w - 2 * ins) * ix / (N - 1) + dx, py = y + ins + (h - 2 * ins) * iy / (N - 1) + dy;
      const p = apply(H, px, py), v = sample(G, p[0], p[1]); const d = Math.max(0, (paper - v) / paper);
      sum += d; if (d > 0.32) dark++; if (colored(p)) col++;
    }
    // حزام حول المربع (0.3–1.6 مم): علامة القلم الملوّن كثيرًا ما تبدأ داخل المربع وتمتد خارجه
    let band = 0, bandN = 0;
    for (const m of [0.3, 0.8, 1.3]) for (let i = 0; i < 28; i++) {
      const t = i / 28, X0 = x - m, Y0 = y - m, W0 = w + 2 * m, H0 = h + 2 * m, per = t * 4;
      const [qx, qy] = per < 1 ? [X0 + W0 * per, Y0] : per < 2 ? [X0 + W0, Y0 + H0 * (per - 1)] : per < 3 ? [X0 + W0 * (3 - per), Y0 + H0] : [X0, Y0 + H0 * (4 - per)];
      bandN++; if (colored(apply(H, qx + dx, qy + dy))) band++;
    }
    const colorFill = col / (N * N) + 0.6 * band / bandN;
    if (darkOnly) return { fill: dark / (N * N), ink: sum / (N * N), paper, color: 0 };
    return { fill: Math.max(dark / (N * N), colorFill), ink: sum / (N * N), paper, color: +colorFill.toFixed(3) };
  }
  const T = { blank: 0.07, mark: 0.14, rival: 0.45, second: 0.105, align: 6, alignSure: 3.5, tilt: 0.6, warp: 3,
    eraseTop: 0.28, eraseMax: 0.22, eraseRatio: 0.4, faintMin: 0.09, faintRel: 0.2, ctrl: 8 };
  /* استقامة الالتقاط: نسبة الضلع الأقصر إلى مقابله (أعلى/أسفل ويمين/يسار) — 1 = الجوال موازٍ للورقة */
  function tiltOf(q) { if (!Array.isArray(q) || q.length !== 4) return 1; const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const t = d(q[0], q[1]), b = d(q[3], q[2]), l = d(q[0], q[3]), r = d(q[1], q[2]); return Math.min(Math.min(t, b) / (Math.max(t, b) || 1), Math.min(l, r) / (Math.max(l, r) || 1)); }
  function decide(fills, ctx) {
    const idx = fills.map((f, i) => [f.fill + f.ink * 0.5, i]).sort((a, b) => b[0] - a[0]);
    const [top, second] = [idx[0], idx[1] || [0, -1]];
    if (top[0] < T.blank) return { status: 'blank', pick: -1 };
    // 🧽 أثر مسح: علامة واضحة وبجانبها أثر رمادي خفيف (أقل من 40% منها ودون 0.22) — الطالب غيّر إجابته بالممحاة.
    // تظليلان حقيقيان يتقاربان (≥ 0.35 كلاهما في القياس) فيبقيان للمراجعة، وكذلك الشطب بالقلم (أغمق من العلامة نفسها)
    if (top[0] >= T.eraseTop && second[0] < T.eraseMax && second[0] <= top[0] * T.eraseRatio) return { status: 'ok', pick: top[1], erased: second[1] };
    // مربعان: أي ثانٍ بلغ حد العلامة، أو قريب من الأول — للمراجعة مهما كانت النسبة
    // مربعان معلّمان: الثاني قد يضعف كثيرًا في صورة خافتة/مغبّشة (علامة ✓ رفيعة) — أي أثر واضح فيه يكفي للمراجعة
    if (second[0] >= T.mark || second[0] >= T.second || (second[0] >= T.blank && second[0] >= top[0] * T.rival)) return { status: 'multi', pick: top[1], alt: second[1] };
    // ✏️ تظليل خفيف (قلم رصاص): يُقبل إن كان هذا أسلوب الطالب في ورقته كلها (ctx.m = وسيط علاماته الواضحة)
    // وبقية مربعات السؤال نظيفة — أثر عابر على ورقة علاماتها قوية يبقى للمراجعة
    if (top[0] < T.mark) return ctx && ctx.m && top[0] >= T.faintMin && second[0] <= top[0] * 0.3 && top[0] >= ctx.m * T.faintRel
      ? { status: 'ok', pick: top[1], light: true } : { status: 'faint', pick: top[1] };
    return { status: 'ok', pick: top[1] };
  }
  /* أي صفحة هذه؟ مربع الوسم ممتلئ في موضع صفحة تالية = هي (الأولى بلا وسم). من العلامات الأربع وحدها (لا محاذاة محتوى) */
  function pageOf(pr, M) {
    const f = pr && pr.found; if (!f || !(f.marks || f.flat) || !Array.isArray(M.more)) return null;
    const R = f.rect || [0, 0, PAPER.w, PAPER.h], H0 = homography([[R[0], R[1]], [R[0] + R[2], R[1]], [R[0] + R[2], R[1] + R[3]], [R[0], R[1] + R[3]]], f.quad);
    let best = null;
    for (const pg of M.more) { if (!pg.tag) continue; const v = boxFill(pr.G, H0, pg.tag, 0, 0, true).fill; if (v >= 0.5 && (!best || v > best.v)) best = { pg, v }; }
    return best ? best.pg : null;
  }
  /* مستوى تظليل الطالب في الورقة: وسيط أقوى مربع في الأسئلة المحسومة (3 فأكثر)، ثم يُعاد الحكم على الخفيف به */
  function refineSheet(answers) {
    // كل علامة نظيفة تُحسب (الخفيفة أيضًا): طالب يظلل بالرصاص في كل الورقة مستواه منخفض فتُقبل علاماته
    const clean = a => { if (!Array.isArray(a.fills) || a.status === 'unaligned') return 0; const f = a.fills.slice().sort((x, y) => y - x); return f[0] >= T.faintMin && (f[1] || 0) <= f[0] * 0.3 ? f[0] : 0; };
    const tops = answers.map(clean).filter(Boolean).sort((x, y) => x - y);
    if (tops.length < 3) return answers;
    const m = tops[Math.floor(tops.length / 2)];
    return answers.map(a => a.status === 'faint' && Array.isArray(a.fills) ? { ...a, ...decide(a.fills.map(v => ({ fill: v, ink: 0 })), { m }) } : a);
  }
  /* رمز النموذج: مربعات مطبوعة صغيرة، واحد منها مظلل بالكامل. ثقة عالية فقط: وإلا null (اختيار يدوي) */
  function readCode(G, P, M) {
    if (!M.mcode || !Array.isArray(M.mcode.cells) || M.mcode.cells.length < 2) return null;
    const cells = M.mcode.cells;
    const base = searchShift(G, P.H, cells.flatMap(r => outlinePts(r, 0.4)), 1.5, 0.25, 0.6, [P.dx, P.dy]);
    const f = cells.map(r => { const b = searchShift(G, P.H, outlinePts(r, 0.35), 0.4, 0.2, 0.5, [base.dx, base.dy]); return boxFill(G, P.H, r, b.dx, b.dy, true).fill; });   // رمز مطبوع: الظلمة داخل المربع فقط (حدود الشارة الخضراء ليست حبرًا)
    const ord = f.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    readCode.last = f.map(v => +v.toFixed(2));
    return (ord[0][0] >= 0.55 && ord[1][0] <= 0.25) ? ord[0][1] : null;
  }
  /* 🧾 رمز الطالب (أوراق الأسماء): 20 مربعًا مطبوعًا. نطلب أن تُرى حدود المربعات فعلًا (ورقة بلا رمز ⇒ null)
     وكل مربع واضح: ممتلئ أو فارغ — أي مربع بين بين ⇒ null (ربط يدوي، لا تخمين) */
  function readSCode(G, P, M, sure) {
    if (!M.scode || !Array.isArray(M.scode.cells) || M.scode.cells.length !== 20) return null;
    const cells = M.scode.cells;
    const base = searchShift(G, P.H, cells.flatMap(r => outlinePts(r, 0.4)), 1.5, 0.25, 0.5, [P.dx, P.dy]);
    let frame = 0; const v = [];
    for (const r of cells) {
      frame += boxScore(G, P.H, outlinePts(r, 0.35), base.dx, base.dy, 0.45);
      // مركز المربع فقط (5 نقاط): الحواف المتلاصقة بين المربعات لا تدخل في القياس
      const cx = r[0] + r[2] / 2 + base.dx, cy = r[1] + r[3] / 2 + base.dy, d = Math.min(r[2], r[3]) * 0.18;
      let t = 0; for (const [ox, oy] of [[0, 0], [-d, -d], [d, -d], [-d, d], [d, d]]) { const p = apply(P.H, cx + ox, cy + oy); t += sample(G, p[0], p[1]); }
      v.push(t / 5);
    }
    // الفصل بين الممتلئ والفارغ: أكبر فجوة بين القيم المرتبة (الطباعة نفسها: فجوة واضحة)، وإلا لا قراءة
    const sv = v.slice().sort((a, b) => a - b); let gi = 0, gap = -1;
    for (let k = 0; k < sv.length - 1; k++) if (sv[k + 1] - sv[k] > gap) { gap = sv[k + 1] - sv[k]; gi = k; }
    const range = sv[sv.length - 1] - sv[0], thr = (sv[gi] + sv[gi + 1]) / 2;
    const bits = v.map(x => x < thr ? 1 : 0);
    readSCode.last = { frame: +(frame / cells.length).toFixed(1), gap: +(gap / (range || 1)).toFixed(2), range: Math.round(range), bits: bits.join('') };
    // هندسة مضبوطة (علامات/صفحة مقوّمة): لا نشترط رؤية إطارات المربعات الصغيرة (تذوب في صورة ناعمة) — يكفي فصل واضح
    // بين الممتلئ والفارغ، ثم التكافؤ وتطابق واحد بالضبط في قائمة الطلاب
    if ((!sure && frame / cells.length < 6) || range < 35 || gap < 0.35 * range) return null;
    return bits;
  }
  /* القراءة الكاملة لنموذج */
  /* الهندسة: الصورة ← الورقة (أو مسح ضوئي) ← الزوايا. مشتركة بين قراءة الرمز وقراءة الإجابات */
  function prepareFrame(G) {
    const fr = findFrame(G); if (!fr) return null;
    const edge = 0.012 * Math.max(G.w, G.h);
    if (fr.quad.some(([x, y]) => x < edge || y < edge || x > G.w - 1 - edge || y > G.h - 1 - edge)) return { error: 'cut', quad: fr.quad };
    return { G, found: fr };
  }
  function prepare(img, o = {}) {
    const G = img.g ? img : gray(img);
    if (o.marks && !o.noMarks) { const mk = findMarks(G, o.marks, o.model); if (mk) return { G, found: mk }; }
    const p = preparePaper(G, o);
    if (!p.error) return p;
    const f = prepareFrame(G);                                // سطح فاتح: الإطار المطبوع بديل الحافة
    if (f && !f.error) return f;
    if (f && f.error === 'cut') return f;                      // الإطار المطبوع نفسه يلامس الحافة: الورقة مقصوصة فعلًا
    if (p.error === 'cut' && p.area > 0.9) return { error: 'no_paper' };   // سطح فاتح يملأ الصورة ولا إطار: لا ورقة
    return p;
  }
  function preparePaper(G, o = {}) {
    const found = findPaper(G);
    if (!found) return { error: 'no_paper' };
    const aspect = G.h / G.w;
    const imgC = [[0, 0], [G.w - 1, 0], [G.w - 1, G.h - 1], [0, G.h - 1]], tol = 0.03 * Math.max(G.w, G.h);
    const atCorners = found.quad.filter((q, i) => Math.hypot(q[0] - imgC[i][0], q[1] - imgC[i][1]) < tol).length;
    if (!o.noScan && found.area > 0.65 && atCorners >= 3 && aspect > 1.3 && aspect < 1.53) { found.quad = imgC; found.scan = true; }
    const edge = 0.012 * Math.max(G.w, G.h);
    if (!found.scan && found.quad.some(([x, y]) => x < edge || y < edge || x > G.w - 1 - edge || y > G.h - 1 - edge)) return { error: 'cut', quad: found.quad, area: found.area };   // الزوايا تُعاد للرسم فقط
    if (!found.scan) found.quad = refineQuad(G, found.quad);
    return { G, found };
  }
  /* 🔢 رمز النموذج أولًا: محاذاة على العنوان وخانة الاسم فقط (متطابقان في كل النماذج)،
     فلا تفشل قراءة الرمز لأن تخطيط أسئلة نموذج آخر مختلف */
  function code(img, M, o = {}) {
    const pr = o.prep || prepare(img, { ...o, marks: M.marks, model: M }); if (pr.error) return { ok: false, error: pr.error, quad: pr.quad };
    if (!M.mcode || !M.mcode.cells) return { ok: true, code: null, prep: pr };
    const qTop = Math.min(...M.questions.flatMap(q => q.boxes.map(b => b[1])));
    const head = M.anchors.filter(a => a[1] + a[3] < qTop - 3);
    const at = p => { const P = alignPage(p.G, p.found.quad, { anchors: head, questions: [] }, !!p.found.scan, { cells: M.mcode.cells }, p.found.rect, !!p.found.marks); return readCode(p.G, P, M); };
    let c = at(pr);
    if (c === null && pr.found.marks) { const p2 = prepare(pr.G, { ...o, noMarks: true }); if (!p2.error) { const c2 = at(p2); if (c2 !== null) return { ok: true, code: c2, prep: p2 }; } }
    if (c === null && !pr.found.frame) { const f = prepareFrame(pr.G); if (f && !f.error) { const c2 = at(f); if (c2 !== null) return { ok: true, code: c2, prep: f }; } }
    return { ok: true, code: c, prep: pr };
  }
  function read(img, M, opts = {}) {
    const t0 = opts.t0 || Date.now();
    const pr = opts.prep || prepare(img, { ...opts, marks: M.marks, model: M });
    if (pr.error) return { ok: false, error: pr.error };
    const G = pr.G, found = pr.found;
    // 📐 ميل شديد جدًا (الضلع البعيد أقل من 60% من القريب): المربعات البعيدة تصغر حتى لا تُقرأ بثقة. الميل المعتاد
    // (حتى 30°) لا يضر: هندسة العلامات الأربع تقوّمه بدقة
    if (!found.scan && !opts.noTilt) { const tl = tiltOf(found.quad); if (tl < T.tilt) return { ok: false, error: 'tilt', tilt: +tl.toFixed(3), quad: found.quad }; }
    // 📄📄 اختبار من عدة صفحات: وسم الصفحة (مربع أسود بجانب رقمها) يُقرأ من هندسة العلامات نفسها — الصفحة الثانية تُقرأ بخريطتها
    if (Array.isArray(M.more) && M.more.length && !opts.page) { const pg = pageOf(pr, M); if (pg) { const r2 = read(null, { ...pg, mcode: null }, { ...opts, prep: pr, page: pg.page, t0 }); return r2.ok ? { ...r2, page: pg.page } : { ...r2, page: pg.page }; } }
    const P = alignPage(G, found.quad, M, !!found.scan, null, found.rect, !!found.marks);
    const retryFrame = (why) => {
      if (found.marks) {                                               // العلامات لم تكفِ (نادر): الطريقة القديمة بحافة الورقة أو إطارها
        const p2 = prepare(G, { ...opts, noMarks: true }); if (p2.error) return why;
        const r2 = read(null, M, { ...opts, prep: p2, t0 }); return r2.ok ? r2 : why;
      }
      if (found.frame || opts.noFrameRetry) return why;               // حتى «المسح»: طاولة بيضاء تلتحم بالورقة فتبدو كمسح ضوئي
      const f = prepareFrame(G); if (!f || f.error) return why;
      const r2 = read(null, M, { ...opts, prep: f, noFrameRetry: true, t0 });
      return r2.ok ? r2 : why;
    };
    if (P.score < (opts.minPage ?? 12)) return retryFrame({ ok: false, error: 'weak_align', score: P.score });
    const code = readCode(G, P, M);                        // رمز النموذج يُقرأ قبل الأسئلة ويُعاد حتى لو رُفضت القراءة
    // المحاذاة المتدرجة: كل قسم بإطاره ومربعاته، ثم كل سؤال، ثم كل مربع
    const secs = M.anchors.filter(a => M.questions.some(q => q.boxes.some(b => b[1] >= a[1] && b[1] <= a[1] + a[3])));
    const secShift = new Map();
    for (const a of secs) {
      const inside = M.questions.filter(q => q.boxes.some(b => b[1] >= a[1] && b[1] <= a[1] + a[3]));
      const r = searchSet(G, P.H, { lines: outlinePts(a, 1.5), boxes: inside.flatMap(q => q.boxes.map(r => outlinePts(r, 0.8))) }, 1.5, 2.5, 0.25, 0.9, [P.dx, P.dy]);   // مجموع النوافذ < نصف صف صح/خطأ (9.6 مم): لا انزلاق لصف مجاور
      secShift.set(a, [r.dx, r.dy]);
    }
    // 📐 الورقة غير مستوية أو الصورة مشوهة: مع علامات الزوايا تطابق الأقسام هندستها (تصحيح ≈ 0–2 مم حتى بميل 30°).
    // تصحيح أكبر يعني أن منتصف الصفحة ابتعد عنها، فقد تُقرأ مربعات صف مجاور بثقة — نرفض بدل أن نصحح إجابة خاطئة
    if ((found.marks || found.flat) && !opts.noGate) { const warp = Math.max(0, ...[...secShift.values()].map(([x, y]) => Math.max(Math.abs(x), Math.abs(y))));
      if (warp > T.warp) return { ok: false, error: 'warp', warp, code }; }
    // 🗺️ خريطة تصحيح ناعمة للورقة المنحنية/المطوية: إزاحة كل سؤال تُقدَّر من مربعاته الواضحة (نافذة ±2.5 مم)،
    // ثم سطح من الدرجة الثانية يمر بها (بلا الشاذ) — فيتبع انحناء الورقة بين الأسئلة بدل إزاحة واحدة لكل قسم
    const secOf = q => secs.find(a => q.boxes.some(b => b[1] >= a[1] && b[1] <= a[1] + a[3]));
    const qCen = q => [q.boxes.reduce((t, b) => t + b[0] + b[2] / 2, 0) / q.boxes.length, q.boxes.reduce((t, b) => t + b[1] + b[3] / 2, 0) / q.boxes.length];
    const field = (() => { if (opts.noField) return null;
      const C = [];
      M.questions.forEach(q => { const sec = secOf(q), b0 = sec ? secShift.get(sec) : [P.dx, P.dy];
        const r = searchSet(G, P.H, { boxes: q.boxes.map(rr => outlinePts(rr, 0.6)), strict: true }, 2.5, 2.5, 0.5, 0.8, b0);
        if (r.s >= T.ctrl) { const [x, y] = qCen(q); C.push({ x, y, dx: r.dx, dy: r.dy, w: Math.min(r.s, 60) }); } });
      if (C.length < 6) return null;
      // ورقة مستوية (أو منظور فقط): إزاحات الأسئلة متقاربة — يبقى المسار القديم كما هو بلا خريطة
      const spread = k => { const v = C.map(p => p[k]).sort((a, b) => a - b); return v[Math.floor(v.length * 0.9)] - v[Math.floor(v.length * 0.1)]; };
      if (Math.max(spread('dx'), spread('dy')) < 0.8) return null;
      const feat = (x, y) => { const u = (x - 105) / 105, v = (y - 148) / 148; return C.length >= 12 ? [1, u, v, u * v, u * u, v * v] : [1, u, v]; };
      const fit = (pts, k) => { const n = feat(0, 0).length, A = Array.from({ length: n }, () => Array(n + 1).fill(0));
        for (const p of pts) { const f = feat(p.x, p.y); for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) A[i][j] += p.w * f[i] * f[j]; A[i][n] += p.w * f[i] * p[k]; } }
        for (let i = 0; i < n; i++) A[i][i] += 1e-6;
        for (let c = 0; c < n; c++) { let m = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r; [A[c], A[m]] = [A[m], A[c]];
          for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let j = c; j <= n; j++) A[r][j] -= f * A[c][j]; } }
        return A.map((row, i) => row[n] / row[i]); };
      const ev = (cf, x, y) => feat(x, y).reduce((t, f, i) => t + f * cf[i], 0);
      let cx = fit(C, 'dx'), cy = fit(C, 'dy');
      const good = C.filter(p => Math.hypot(ev(cx, p.x, p.y) - p.dx, ev(cy, p.x, p.y) - p.dy) <= 1);   // الشاذ (صف مجاور) يُستبعد ثم يُعاد الحساب
      if (good.length >= 6) { cx = fit(good, 'dx'); cy = fit(good, 'dy'); }
      return (x, y) => [ev(cx, x, y), ev(cy, x, y)]; })();
    const answers = M.questions.map((q, qi) => {
      const sec = secOf(q);
      const base = field ? field(...qCen(q)) : sec ? secShift.get(sec) : [P.dx, P.dy];
      // السؤال والمربع: المعيار الصارم (أضعف أضلاع المربع) في نوافذ صغيرة
      // المربع ±1 مم: دوران متبقٍّ يُزيح عمودَي الخيارات قليلًا؛ المعيار الصارم يمنع الالتقاط على الحروف
      // من الخريطة ومن إزاحة القسم: يُعتمد الأوضح تطابقًا مع إطارات المربعات (الورقة المستوية لا تخسر شيئًا)
      const qset = { boxes: q.boxes.map(r => outlinePts(r, 0.6)), strict: true }, secB = sec ? secShift.get(sec) : [P.dx, P.dy];
      const qs = [base].concat(field ? [secB] : []).map(b0 => searchSet(G, P.H, qset, 1, 1, 0.25, 0.8, b0)).reduce((a, b) => b.s > a.s ? b : a);
      const fills = q.boxes.map(r => { const b = searchSet(G, P.H, { boxes: [outlinePts(r, 0.5)], strict: true }, 1, 1, 0.25, 0.7, [qs.dx, qs.dy]); return { ...boxFill(G, P.H, r, b.dx, b.dy), dx: b.dx, dy: b.dy, align: b.s }; });
      const d = decide(fills);
      const align = Math.min(...fills.map(f => f.align));
      // الهندسة مضبوطة (علامات الزوايا أو صفحة قوّمناها بأنفسنا): خطوط المربع الباهتة في فيديو ناعم تكفي بحد أدنى أقل
      // (المربع في مكانه ≈ 4–9، والإزاحة الخاطئة ≈ −2…2)
      const dd = align < (opts.alignT ?? (found.marks || found.flat ? T.alignSure : T.align)) ? { status: 'unaligned', pick: -1 } : d;   // لا نرى إطار المربع حيث نتوقعه: لا قراءة واثقة
      return { i: qi, t: q.t, key: q.key, ...dd, align: +align.toFixed(1), fills: fills.map(f => +(f.fill + f.ink * 0.5).toFixed(3)), boxes: q.boxes.map((r, k) => ({ r, dx: fills[k].dx, dy: fills[k].dy })) };
    });
    answers.splice(0, answers.length, ...refineSheet(answers));
    // أكثر من سؤال لا يُرى إطاره = هندسة الصورة خاطئة في جزء من الورقة (ظل/انحناء): لا نثق بالبقية
    const unaligned = answers.filter(a => a.status === 'unaligned').length;
    // بعلامات الزوايا الهندسة مضبوطة من الطباعة نفسها: مربع خطوطه باهتة في الصورة (فيديو ناعم/بعيد) لا يعني صورة خاطئة —
    // يُعرض سؤاله للتأكيد بدل رفض الورقة كلها. نرفض فقط إن غاب أكثر من 40% منها
    const gate = found.marks || found.flat ? unaligned > Math.max(1, answers.length * 0.4) : unaligned >= 2;
    if (gate && !opts.noGate) return retryFrame({ ok: false, error: 'uneven', unaligned, code });
    const correct = answers.filter(a => a.status === 'ok' && a.pick === a.key).length;
    const review = answers.filter(a => a.status !== 'ok').length;
    return { ok: true, code, scode: readSCode(G, P, M, !!(found.marks || found.flat)), answers, correct, review, H: P.H, quad: found.quad, pageScore: +P.score.toFixed(1), ms: Date.now() - t0, dbg: { via: found.marks ? 'marks' : found.frame ? 'frame' : found.scan ? 'scan' : 'paper', dx: P.dx, dy: P.dy, rot: P.rot, secs: [...secShift.values()] } };
  }
  return { read, code, prepare, prepareFrame, findFrame, findMarks, gray, findPaper, homography, apply, T, tiltOf, pageOf, _t: { readCode, readSCode, alignPage, searchSet, outlinePts, boxScore, edgeScore, decide, refineSheet } };
})();

/* ═══════════ 📷 المصحّح الآلي — واجهة بوابة المعلم ═══════════
   وجّه الكاميرا على ورقة الإجابة: تُكتشف الورقة وتُقرأ المربعات وتظهر الدرجة فورًا،
   وما ليس واضحًا يظهر أصفر لتحسمه بلمسة. الدرجة تُرصد في نظام رصد الاختبارات نفسه (setExamScore).
   الصور لا تُرفع لأي مكان: كل المعالجة على الجوال. */
const OMRUI = { tpl:null, model:0, auto:false, testId:'', cls:'', stream:null, timer:0, busy:false, last:null, stable:0, result:null, sid:'', frozen:null };
const OMR_MSG = { no_paper:'ضع الورقة كاملة داخل الإطار', cut:'ابتعد قليلًا — الورقة مقصوصة من الإطار',
  weak_align:'الورقة غير واضحة — أعد المسح أو قرّب الجوال', uneven:'مربعات الإجابة غير واضحة — قرّب الجوال أو زد الإضاءة أو افرد الورقة',
  no_code:'لم يُقرأ رمز النموذج بجانب العنوان — قرّب الجوال، أو اختر النموذج يدويًا',
  tilt:'📐 الجوال مائل كثيرًا — اجعله فوق الورقة مباشرة',
  warp:'📄 الورقة غير مستوية — افردها على سطح مستوٍ وصوّر من فوقها مباشرة',
  page_alone:'📄📄 هذه صفحة تالية — صوّر الصفحة الأولى للطالب قبلها' };
const omrApi = p => ctApi().replace(/\/+$/,'') + p;
/* مجموع النموذج المختار نفسه: النماذج قد تحمل أسئلة مختلفة العدد */
/* أسئلة النموذج كلها بترتيب الورقة: الصفحة الأولى ثم التالية */
const omrQs = M => !M ? [] : M.questions.concat(...(M.more || []).map(p => p.questions || []));
/* درجة كل سؤال: القالب المصمَّم يحمل درجة لكل قسم، وغيره درجة موحدة */
const omrQm = (q, T = OMRUI.tpl) => Number(q && q.m) || Number(T && T.mark) || 1;
/* نقاط الإجابات الصحيحة ومجموعها الأقصى بحسب أسئلة نموذج الورقة */
function omrPts(answers, mi = OMRUI.model){
  const qs = omrQs(OMRUI.tpl.models[mi] || OMRUI.tpl.models[0]); let ok = 0, max = 0;
  answers.forEach((a, i) => { const w = omrQm(qs[i]); max += w; if(a.final !== null && a.final !== undefined && a.final === a.key) ok += w; });
  return { ok: +ok.toFixed(2), max: +max.toFixed(2) };
}
function omrTotals(mi = OMRUI.model){
  const T = OMRUI.tpl, M = T.models[mi], auto = +omrQs(M).reduce((t, q) => t + omrQm(q, T), 0).toFixed(2);
  return { auto, total: Number(M.total) || (mi === 0 ? Number(T.total) : 0) || auto };
}
/* ✍️ الجزء اليدوي (مقالي/فراغات/أسئلة خارج الصفحة الأولى): المعلم يكتب درجته فتُرصد الدرجة كاملة —
   كان «تصوير الفصل» يحفظ الجزء الآلي وحده كأنه الدرجة كلها (8 من 20 لطالب يستحق أكثر) */
function omrManualMax(mi){ const tt = omrTotals(mi); return Math.max(0, +(tt.total - tt.auto).toFixed(2)); }
function omrManualOk(v, mi){ const mx = omrManualMax(mi); if(!mx) return true; const n = Number(v); return v !== '' && v !== null && v !== undefined && Number.isFinite(n) && n >= 0 && n <= mx + 1e-9; }
function omrManualHTML(id, val, mi, on){
  const mx = omrManualMax(mi); if(!mx) return '';
  return `<label class="omr-manual"><span>✍️ درجة الجزء اليدوي <small>(من ${mx} — المقالي وما خارج المسح)</small></span>
    <input class="inp" type="number" inputmode="decimal" min="0" max="${mx}" step="0.25" id="${id}" value="${val ?? ''}" placeholder="0 – ${mx}" oninput="${on}"></label>`;
}
function omrScoreOf(res){
  const tt = omrTotals();
  const n = res.answers.filter(a => a.final === a.key).length;
  return { n, raw: omrPts(res.answers, res.model ?? OMRUI.model).ok, total: tt.auto };
}
function omrTest(){ return examBook().tests.find(t => String(t.id)===String(OMRUI.testId)) || null; }
function omrNextStudent(){
  const b = examBook(), L = list(OMRUI.cls);
  const s = L.find(x => !exHas(x.id, OMRUI.testId));
  return s ? s.id : (L[0] && L[0].id) || '';
}
async function omrOpen(){
  document.getElementById('omr-sheet')?.remove();
  const el = document.createElement('div'); el.id = 'omr-sheet'; el.className = 'omr-sheet';
  el.innerHTML = `<div class="omr-top"><button class="omr-x" onclick="omrClose()" aria-label="إغلاق">✕</button><b>📷 التصحيح الآلي</b><span></span></div><div class="omr-body" id="omr-body"><p class="omr-note">جارٍ جلب الاختبارات…</p></div>`;
  document.body.appendChild(el); document.body.style.overflow='hidden';
  let list_ = [];
  try{ const j = await (await fetch(omrApi('/omr/list?t='+encodeURIComponent(getTok())))).json(); list_ = (j.templates||[]).filter(t => !t.hidden); OMRUI.cfg = j.settings || {}; }catch(e){}   // المخفية من «إعدادات التصحيح الآلي» في اللوحة لا تظهر
  const tests = examBook().tests;
  if(!list_.length){ $('omr-body').innerHTML = `<div class="omr-card"><b>لا توجد اختبارات جاهزة للتصحيح الآلي</b><p class="omr-note">من «الاختبار الورقي» في اللوحة ← أنشئ الاختبار ثم اضغط «📷 تجهيز للتصحيح الآلي».</p></div>`; return; }
  if(!tests.length){ $('omr-body').innerHTML = `<div class="omr-card"><b>أضف اختبارًا في «رصد الاختبارات» أولًا</b><p class="omr-note">الدرجة تُرصد في عمود اختبار من هذه الفترة.</p></div>`; return; }
  const saved = (()=>{ try{ return JSON.parse(localStorage.getItem('omr_last_v1')||'{}'); }catch(e){ return {}; } })();
  const cls = TPX.cls || classes()[0] || '';
  $('omr-body').innerHTML = `<div class="omr-card">
    <label>الاختبار الورقي<select class="inp" id="omr-tpl">${list_.map(x=>`<option value="${esc(x.id)}" ${x.id===saved.tpl?'selected':''}>${esc(x.title)} · ${x.n} سؤالًا${x.models>1?` · ${x.models} نماذج`:''}${x.at?` · جُهّز ${new Date(x.at).toLocaleDateString('ar-SA-u-ca-gregory',{day:'numeric',month:'numeric'})}`:''}</option>`).join('')}</select></label>
    <label id="omr-model-wrap" style="display:none">النموذج<select class="inp" id="omr-model"></select></label>
    <label>يُرصد في<select class="inp" id="omr-test">${tests.map(t=>`<option value="${esc(t.id)}" ${String(t.id)===saved.test?'selected':''}>${esc(t.title)} (من ${t.max})</option>`).join('')}</select></label>
    <label>الفصل<select class="inp" id="omr-cls">${classes().map(c=>`<option ${c===cls?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
    <p class="omr-note">لحذف الاختبارات القديمة أو إخفائها وضبط التصوير: لوحة التحكم ← الاختبار الورقي ← <b>⚙️ إعدادات التصحيح الآلي</b>.</p>
    <p class="omr-note">اطلب من الطلاب وضع ✓ أو التظليل <b>داخل المربع</b>. الأوراق الجديدة فيها ⬛ مربعات سوداء في زواياها تُقرأ بأي مقاس طباعة؛ الأقدم منها: اطبعها بالحجم الفعلي (100%).</p>
    <button class="btn primary wide" id="omr-go" type="button">📷 ابدأ المسح</button></div>`;
  const loadModels = async () => {
    const id = $('omr-tpl').value;
    try{ const j = await (await fetch(omrApi('/omr/get?t='+encodeURIComponent(getTok())+'&id='+encodeURIComponent(id)))).json(); OMRUI.tpl = j.template; }catch(e){ OMRUI.tpl = null; }
    const ms = OMRUI.tpl ? OMRUI.tpl.models : [];
    const canAuto = ms.length > 1 && ms.every(m => m.mcode && m.mcode.cells && m.mcode.cells.length > 1);
    $('omr-model').innerHTML = (canAuto ? '<option value="auto">تلقائي — من رمز النموذج على الورقة</option>' : '')
      + ms.map((m,i)=>`<option value="${i}">نموذج ${esc(m.letter||String(i+1))}</option>`).join('');
    $('omr-model-wrap').style.display = ms.length > 1 ? '' : 'none';
  };
  $('omr-tpl').onchange = loadModels; await loadModels();
  $('omr-go').onclick = () => {
    if(!OMRUI.tpl){ toast('تعذّر جلب الاختبار'); return; }
    OMRUI.auto = $('omr-model').value === 'auto'; OMRUI.model = OMRUI.auto ? 0 : (Number($('omr-model').value)||0); OMRUI.testId = $('omr-test').value; OMRUI.cls = $('omr-cls').value;
    try{ localStorage.setItem('omr_last_v1', JSON.stringify({ tpl:OMRUI.tpl.id, test:OMRUI.testId })); }catch(e){}
    OMRUI.sid = omrNextStudent();
    omrScan();
  };
}
function omrStudentsSelect(){
  const b = examBook();
  const L = list(OMRUI.cls), ext = OMRUI.sid && !L.some(s => s.id === OMRUI.sid) ? list('').filter(s => s.id === OMRUI.sid) : [];   // ورقة باسم طالب من فصل آخر
  return `<select class="inp omr-stu" id="omr-stu">${ext.concat(L).map(s=>{ const done = exHas(s.id, OMRUI.testId);
    return `<option value="${esc(s.id)}" ${s.id===OMRUI.sid?'selected':''}>${done?'✓ ':''}${esc(s.name)}${ext.includes(s)?' · '+esc(s.cls||''):''}</option>`; }).join('')}</select>`;
}
async function omrScan(){
  omrStopLoop(); omrKillStreams(); OMRUI.camGen = (OMRUI.camGen || 0) + 1;   // شاشة الخيارات لا تستخدم الكاميرا
  OMRUI.queue = []; OMRUI.qi = 0; OMRUI.skipped = []; OMRUI.savedN = 0;
  let bp = '1'; try{ bp = localStorage.getItem('omr_batch') ?? '1'; }catch(e){}
  OMRUI.batch = bp === '1';
  const multi = !!(OMRUI.tpl && OMRUI.tpl.models.some(m => m.more && m.more.length));
  if(multi) OMRUI.batch = true;          // 📄📄 اختبار من عدة صفحات: تُضم الصفحات في الدفعة (كل صفحة تتبع صفحتها الأولى)
  await omrBatchLoad();
  $('omr-body').innerHTML = `
    <label class="omr-batch-tg"><span><b>📚 تصوير الفصل ثم ربط الأسماء</b><small>صوّر الأوراق كلها متتالية، ثم اربط كل ورقة بصاحبها من اسمه المكتوب</small></span>
      <input type="checkbox" class="omr-switch" id="omr-batch" ${OMRUI.batch?'checked':''} ${multi?'disabled':''} onchange="omrBatchToggle(this.checked)"></label>
    ${multi ? `<p class="omr-note omr-hintline">📄📄 هذا الاختبار من ${1 + Math.max(...OMRUI.tpl.models.map(m => (m.more || []).length))} صفحات تُصحَّح كلها: صوّر لكل طالب الصفحة الأولى ثم الثانية، وتُضم وحدها إلى ورقته.</p>` : ''}
    <button class="btn primary wide omr-match-btn" id="omr-match-btn" type="button" onclick="omrMatch()" style="display:none"></button>
    <div class="omr-stu-row" ${OMRUI.batch?'style="display:none"':''}>${omrStudentsSelect()}</div>
    <div class="omr-pick" id="omr-pick">
      <div class="omr-tiles">
        <button class="tile c-teal omr-tile wide2" type="button" onclick="omrStartCamera()"><span class="ic">⚡</span><b>تصوير تلقائي</b><span>ثبّت الجوال وضع الأوراق فوق بعض — يلتقط كل ورقة وحده</span></button>
        <button class="tile c-accent omr-tile" type="button" onclick="omrStartCamera(true)"><span class="ic">📄</span><b>مسح ورقة</b><span>ماسح داخل التطبيق: يلتقط الورقة ويقوّمها مثل ماسح المستندات</span></button>
        <button class="tile c-violet omr-tile" type="button" onclick="omrScanGuide()"><span class="ic">🗂️</span><b>ملف المسح</b><span>من ماسح الآيفون أو ملف PDF</span></button>
      </div>
      <label class="omr-alt">أو التقط صورة بكاميرا الجوال العادية<input type="file" accept="image/*" capture="environment" hidden onchange="omrPhoto(this)"></label>
      <details class="omr-how"><summary>نصائح التصوير والمسح</summary>
        <p style="margin:4px 0"><b>التصوير:</b> من الأعلى قدر الإمكان، والمربعات السوداء الأربعة في زوايا الورقة داخل الصورة — يعمل على أي سطح، ولو كان طرف الورقة خارجها قليلًا. تجنّب ظلّ يدك أو الجوال فوق المربعات.</p>
        <p style="margin:4px 0 2px"><b>المسح لفصل كامل:</b></p>
        <ol><li>افتح تطبيق <b>الملفات</b> ← ⋯ أعلى الشاشة ← <b>مسح المستندات</b> (أو من <b>الملاحظات</b> ← 📎 ← مسح المستندات).</li>
          <li>امسح أوراق الطلاب متتالية — الماسح يلتقطها تلقائيًا ويقصّها ويعدّلها.</li>
          <li>احفظ الملف، ثم ارجع هنا واضغط «مسح ضوئي أو صورة» واختره.</li></ol></details>
    </div>
    <div class="omr-cam" style="display:none"><video id="omr-video" playsinline muted autoplay></video><canvas id="omr-pv" class="omr-ov"></canvas><span class="omr-diag" id="omr-diag"></span><button type="button" class="omr-torch" id="omr-torch" hidden onclick="omrTorch()">🔦 الفلاش</button><button type="button" class="omr-shutter" id="omr-shutter" hidden onclick="OMRUI.forceShot=true" aria-label="التقط الآن"></button></div>
    <canvas id="omr-canvas" hidden></canvas>
    <div class="omr-status" id="omr-status"></div>
    <div id="omr-result"></div>
    <div class="omr-actions" style="display:none"><button class="btn ghost" type="button" onclick="omrStopCamera()">⏹ إيقاف الكاميرا</button>
      <button class="btn ghost" type="button" onclick="omrClose(true)">تغيير الاختبار</button>
      <button class="btn primary omr-act-match" id="omr-act-match" type="button" onclick="omrMatch()" style="display:none"></button></div>`;
  $('omr-stu').onchange = e => { OMRUI.sid = e.target.value; };
  omrBatchCounter();

}
/* 📸 التصوير: كاميرا الآيفون الأصلية (صورة كاملة الدقة بتركيزها التلقائي) — لا بث فيديو.
   المحرك يكتشف الورقة ويقوّمها بنفسه كما يفعل الماسح. */
function omrShootBtn(label, sub){
  return `<label class="btn primary omr-big">${label}${sub?`<small>${sub}</small>`:''}
    <input type="file" accept="image/*" capture="environment" hidden onchange="omrPhoto(this)"></label>`;
}
function omrPhoto(inp){ const f = inp.files && inp.files[0]; inp.value = ''; if(f) omrLoadFiles([f], true); }
/* 📄 طابور الأوراق: PDF (كل صفحة ورقة) أو صور — يُرسم كل عنصر عند دوره فقط (ذاكرة الجوال) */
/* 📄 ماسح المستندات: الموقع لا يستطيع تشغيل ماسح الآيفون بنفسه، فنشرح الخطوات ثم يُختار الملف الناتج.
   الماسح يلتقط بدقة الكاميرا الكاملة ويقصّ ويقوّم، ويلتقط الأوراق تلقائيًا واحدة بعد أخرى */
function omrScanGuide(){
  const st = $('omr-status'); if(st) st.textContent = '';
  $('omr-result').innerHTML = `<div class="omr-res omr-guide-card">
    <b style="font-size:1rem">📄 تصوير الفصل بماسح المستندات</b>
    <ol class="omr-steps">
      <li>افتح تطبيق <b>الملفات</b> ← <b>⋯</b> أعلى الشاشة ← <b>مسح المستندات</b><small>أو من <b>الملاحظات</b> ← 📎 ← مسح المستندات</small></li>
      <li>اختر من الأعلى فلتر <b>ملوّن</b> أو <b>تدرّج رمادي</b> — لا «أبيض وأسود»<small>«أبيض وأسود» قد يمسح التظليل الخفيف بالرصاص</small></li>
      <li>ضع الأوراق واحدة بعد الأخرى — الماسح يلتقط كل ورقة وحده عند ثباتها</li>
      <li>اضغط <b>حفظ</b> (ملف PDF واحد لكل الفصل)، ثم ارجع هنا</li>
    </ol>
    <label class="btn primary wide omr-big">📂 اختر ملف المسح<small>PDF أو صور — يُقرأ كل الصفحات</small>
      <input type="file" accept="application/pdf,image/*" multiple hidden onchange="const f=[...this.files];this.value='';if(f.length)omrLoadFiles(f)"></label>
  </div>`;
  try{ $('omr-result').scrollIntoView({ block:'start', behavior:'smooth' }); }catch(e){}
}
async function omrLoadFiles(files, photo){
  OMRUI.photoMode = !!photo; if(!photo) OMRUI.dupN = 0;
  const st = $('omr-status'); st.textContent = 'جارٍ فتح الملف…';
  const q = [];
  try{
    for(const f of files){
      if(/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)){
        const lib = await omrPdfLib();
        const pdf = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
        for(let n = 1; n <= pdf.numPages; n++) q.push({ pdf, n });
      } else q.push({ file: f });
    }
  }catch(err){ st.textContent = 'تعذّر فتح الملف — تأكد أنه PDF أو صورة'; return; }
  if(!q.length){ st.textContent = 'لا صفحات في الملف'; return; }
  omrStopCamera(); OMRUI.queue = q; OMRUI.qi = 0; OMRUI.skipped = []; if(!photo) OMRUI.savedN = 0;
  OMRUI.fileFrom = (OMRUI.sheets || []).length;                                   // أوراق هذا الملف: تُعرض كلها بعد القراءة
  const pk = $('omr-pick'); if(pk) pk.style.display = 'none';
  omrQueueNext();
}
let OMR_PDFJS = null;
function omrPdfLib(){
  if(OMR_PDFJS) return OMR_PDFJS;
  const base = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
  OMR_PDFJS = new Promise((res, rej) => {
    if(window.pdfjsLib) { window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js'; return res(window.pdfjsLib); }
    const s = document.createElement('script'); s.src = base + 'pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js'; res(window.pdfjsLib); };
    s.onerror = () => { OMR_PDFJS = null; rej(new Error('pdfjs')); };
    document.head.appendChild(s);
  });
  return OMR_PDFJS;
}
async function omrQueueNext(){
  const st = $('omr-status'), q = OMRUI.queue;
  $('omr-result').innerHTML = ''; OMRUI.result = null;
  if(OMRUI.qi >= q.length){ omrQueueDone(); return; }
  const it = q[OMRUI.qi];
  st.textContent = OMRUI.photoMode ? 'جارٍ قراءة الورقة…' : `ورقة ${OMRUI.qi+1} من ${q.length} — جارٍ القراءة…`;
  try{
    let src;
    if(it.pdf){
      const page = await it.pdf.getPage(it.n), v1 = page.getViewport({ scale:1 });
      const vp = page.getViewport({ scale: 1600 / Math.max(v1.width, v1.height) });     // الضلع الأطول 1600 (حد القراءة نفسه)
      src = document.createElement('canvas'); src.width = Math.round(vp.width); src.height = Math.round(vp.height);
      await page.render({ canvasContext: src.getContext('2d'), viewport: vp }).promise;
    } else src = await createImageBitmap(it.file, { imageOrientation:'from-image' });
    omrProcess(src, src.width, src.height, true);
  }catch(err){ omrPageFailed('تعذّر فتح هذه الصفحة'); }
}
function omrPageFailed(msg){
  const q = OMRUI.queue, st = $('omr-status');
  if(OMRUI.batch && q && q.length && !OMRUI.photoMode){ OMRUI.skipped.push(OMRUI.qi + 1); OMRUI.qi++; omrQueueNext(); return; }
  if(OMRUI.photoMode){
    st.textContent = '📸 ' + msg;
    $('omr-result').innerHTML = `<div class="omr-res omr-dark">${omrShootBtn('📸 أعد التصوير', 'الورقة كاملة، من الأعلى، مع هامش صغير')}${OMRUI.lastSingle ? omrManualBtn() : ''}</div>`;
    return;
  }
  st.textContent = `ورقة ${OMRUI.qi+1} من ${q.length}: ${msg}`;
  $('omr-result').innerHTML = `<div class="omr-res"><p class="omr-note" style="color:#5A6B84">تجاوزها وأعد مسحها لاحقًا — تظهر في القائمة عند الانتهاء.</p>
    <div class="omr-row"><button class="btn primary" type="button" onclick="omrSkip()">⏭ التالية</button><button class="btn ghost" type="button" onclick="omrQueueNext()">↻ إعادة المحاولة</button></div>${OMRUI.lastSingle ? omrManualBtn() : ''}</div>`;
}
/* ✋ تحديد الزوايا يدويًا (كما في ماسح المستندات): إن لم تُكتشف الورقة يضع المعلم أربع دوائر على المربعات السوداء الأربعة.
   كل دائرة تلتصق بأقرب مربع قريب منها، والاتجاه يُعرف من المربع المفرّغ — فلا يهم بأي ترتيب تُوضع */
function omrManualBtn(){ return `<button class="btn ghost wide omr-man-btn" type="button" onclick="omrManualOpen()">✋ حدّد الزوايا بيدك<small>ضع ٤ دوائر على المربعات السوداء في أركان الورقة</small></button>`; }
function omrManualOpen(again){
  const img = OMRUI.lastSingle; if(!img) return;
  const M = OMRUI.tpl.models[OMRUI.auto ? 0 : OMRUI.model], G = OMR.gray(img);
  try{ OMR.findMarks(G, M.marks, M); }catch(e){}
  const C = (OMR.findMarks.cands || []).slice(), W = img.width, H = img.height;
  // البداية: أقرب مرشح لكل ركن من الصورة، وإلا نقطة داخل الركن
  const corners = [[0, 0], [W, 0], [W, H], [0, H]];
  const pts = (again && OMRUI.manPts) || corners.map(([cx, cy]) => { let b = null, bd = 1e9; C.forEach(([x, y]) => { const d = Math.hypot(x - cx, y - cy); if(d < bd){ bd = d; b = [x, y]; } });
    return b && bd < Math.max(W, H) * 0.35 ? b : [cx ? W * 0.9 : W * 0.1, cy ? H * 0.9 : H * 0.1]; });
  OMRUI.manPts = pts.map(p => p.slice()); OMRUI.manG = G; OMRUI.manC = C;
  const st = $('omr-status'); if(st && !again) st.textContent = '✋ اسحب كل دائرة إلى مربع أسود في ركن الورقة';
  $('omr-result').innerHTML = `<div class="omr-res omr-man">
    <div class="omr-man-wrap" id="omr-man-wrap"><canvas id="omr-man-cv" width="${W}" height="${H}"></canvas><svg class="omr-man-svg" id="omr-man-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"></svg>
      ${OMRUI.manPts.map((_, i) => `<span class="omr-man-h" data-i="${i}"></span>`).join('')}</div>
    <p class="omr-note">ضع كل دائرة فوق مربع أسود (الأربعة في أركان الورقة) — تلتصق بالمربع إذا قرّبتها منه.</p>
    <div class="omr-row"><button class="btn primary" type="button" onclick="omrManualRead()">✓ اقرأ الورقة</button>
      ${OMRUI.queue && OMRUI.queue.length > 1 && !OMRUI.photoMode ? '<button class="btn ghost" type="button" onclick="omrSkip()">⏭ تخطَّ</button>' : omrShootBtn('📸 صورة أخرى', '')}</div></div>`;
  $('omr-man-cv').getContext('2d').putImageData(img, 0, 0);
  const wrap = $('omr-man-wrap'), hs = [...wrap.querySelectorAll('.omr-man-h')];
  const draw = () => { hs.forEach((h, i) => { const [x, y] = OMRUI.manPts[i]; h.style.left = (x / W * 100) + '%'; h.style.top = (y / H * 100) + '%'; });
    const P = omrManualOrder(OMRUI.manPts); $('omr-man-svg').innerHTML = `<polygon points="${P.map(p => p.join(',')).join(' ')}" />`; };
  let drag = -1;
  const at = e => { const r = wrap.getBoundingClientRect(); return [Math.max(0, Math.min(W, (e.clientX - r.left) / r.width * W)), Math.max(0, Math.min(H, (e.clientY - r.top) / r.height * H))]; };
  hs.forEach((h, i) => h.addEventListener('pointerdown', e => { drag = i; h.setPointerCapture(e.pointerId); h.classList.add('on'); e.preventDefault(); }));
  wrap.addEventListener('pointermove', e => { if(drag < 0) return; OMRUI.manPts[drag] = at(e); draw(); });
  const up = () => { if(drag < 0) return; const h = hs[drag]; h.classList.remove('on');
    // التصاق: أقرب مربع أسود مرشَّح ضمن مسافة قصيرة
    const [x, y] = OMRUI.manPts[drag]; let b = null, bd = Math.max(W, H) * 0.05; (OMRUI.manC || []).forEach(([cx, cy]) => { const d = Math.hypot(cx - x, cy - y); if(d < bd){ bd = d; b = [cx, cy]; } });
    if(b){ OMRUI.manPts[drag] = b; h.classList.add('snap'); setTimeout(() => h.classList.remove('snap'), 400); } drag = -1; draw(); };
  wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up);
  draw();
  try{ wrap.scrollIntoView({ block:'center', behavior:'smooth' }); }catch(e){}
}
/* ترتيب الورقة: أعلى اليسار، أعلى اليمين، أسفل اليمين، أسفل اليسار (المفرّغ) — باتجاه عقارب الساعة في الصورة */
function omrManualOrder(pts){
  const cx = pts.reduce((t, p) => t + p[0], 0) / 4, cy = pts.reduce((t, p) => t + p[1], 0) / 4;
  let P = pts.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));   // من أعلى اليسار باتجاه عقارب الساعة (y للأسفل)
  const G = OMRUI.manG, M = OMRUI.tpl.models[OMRUI.auto ? 0 : OMRUI.model];
  let hollow = -1;
  if(G && M && M.marks){
    const side = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]) / Math.max(1, (M.marks[1][0] - M.marks[0][0])) * M.marks[0][2];   // ضلع المربع بالبكسل
    const smp = (x, y) => { const X = Math.round(x), Y = Math.round(y); return X >= 0 && Y >= 0 && X < G.w && Y < G.h ? G.g[Y * G.w + X] : 255; };
    const hol = P.map(([x, y]) => { const c = smp(x, y), ink = [0, 1, 2, 3].map(k => smp(x + Math.cos(k * 1.571 + .785) * side * .38, y + Math.sin(k * 1.571 + .785) * side * .38)).sort((a, b) => a - b)[1]; return c - ink; });
    const hi = hol.map((v, i) => [v, i]).filter(([v]) => v > 45);
    if(hi.length === 1) hollow = hi[0][1];
  }
  if(hollow < 0){ const k = P.map((p, i) => [p[0] + p[1], i]).sort((a, b) => a[0] - b[0])[0][1]; P = P.slice(k).concat(P.slice(0, k)); return P; }   // بلا مفرّغ واضح: الورقة قائمة
  const k = (hollow + 1) % 4; return P.slice(k).concat(P.slice(0, k));
}
function omrManualRead(){
  const img = OMRUI.lastSingle; if(!img || !OMRUI.manPts) return;
  const M = OMRUI.tpl.models[OMRUI.auto ? 0 : OMRUI.model], mc = M.marks.map(r => [r[0] + r[2] / 2, r[1] + r[3] / 2]);
  const quad = omrManualOrder(OMRUI.manPts), rect = [mc[0][0], mc[0][1], mc[1][0] - mc[0][0], mc[3][1] - mc[0][1]];
  const st = $('omr-status'); if(st) st.textContent = 'جارٍ القراءة…';
  omrProcess(null, img.width, img.height, true, { img, prep: { G: OMRUI.manG || OMR.gray(img), found: { quad, rect, marks: true, manual: true } } });
}
function omrSkip(){ OMRUI.skipped.push(OMRUI.qi + 1); OMRUI.qi++; omrQueueNext(); }
function omrQueueDone(){
  if(OMRUI.batch && !OMRUI.photoMode){
    const n = OMRUI.queue.length, sk = OMRUI.skipped, got = OMRUI.sheets.length, dup = OMRUI.dupN || 0;
    $('omr-status').textContent = `✓ انتهى الملف: في الدفعة ${got} ${got===1?'ورقة':'أوراق'}`;
    const added = OMRUI.sheets.slice(OMRUI.fileFrom || 0);
    $('omr-result').innerHTML = `<div class="omr-res">${sk.length ? `<p class="omr-note" style="color:var(--amber-ink)"><b>لم تُقرأ ${sk.length}:</b> الصفحات ${sk.join('، ')} — أعد مسحها أو صوّرها.</p>` : ''}
      ${dup ? `<p class="omr-note">${dup} ${dup===1?'صفحة مكررة لم تُضف':'صفحات مكررة لم تُضف'} (مصوّرة مسبقًا في الدفعة).</p>` : ''}
      <button class="btn primary wide" type="button" onclick="omrMatch()">🔗 راجع واربط الأوراق بالطلاب (${got})</button></div>
      ${added.length ? `<p class="omr-note" style="margin:12px 2px 0">👀 ما قُرئ من كل صفحة — اضغط الصورة لتكبيرها:</p>${added.map((sh, k) => omrBatchMini(sh, false, 'bim-' + k)).join('')}` : ''}`;
    added.forEach((sh, k) => omrBatchCardDraw(sh, 'bim-' + k));
    OMRUI.queue = []; return;
  }
  if(OMRUI.photoMode){
    const nx = list(OMRUI.cls).find(s => s.id === OMRUI.sid);
    $('omr-status').textContent = OMRUI.savedN ? `✓ حُفظت ${OMRUI.savedN} ${OMRUI.savedN===1?'ورقة':'أوراق'} في هذه الجلسة` : 'اختر طريقة المسح';
    $('omr-result').innerHTML = `<div class="omr-res omr-dark">${omrShootBtn(`📸 صوّر ورقة ${esc(nx ? nx.name.split(' ')[0] : 'الطالب التالي')}`, nx ? esc(nx.name) : '')}
      <div class="omr-row"><label class="btn ghost omr-file-btn">📄 ملف PDF<input type="file" accept="application/pdf,image/*" multiple hidden onchange="omrLoadFiles([...this.files]);this.value=''"></label>
        <button class="btn ghost" type="button" onclick="omrClose()">إنهاء</button></div></div>`;
    OMRUI.queue = []; return;
  }
  const n = OMRUI.queue.length, sk = OMRUI.skipped;
  $('omr-status').textContent = `✓ انتهت الأوراق: حُفظ ${OMRUI.savedN} من ${n}`;
  $('omr-result').innerHTML = `<div class="omr-res">${sk.length ? `<p class="omr-note" style="color:#9A6512"><b>لم تُقرأ ${sk.length}:</b> الأوراق رقم ${sk.join('، ')} في الملف — أعد مسحها أو ارصدها يدويًا.</p>` : '<p class="omr-note" style="color:#137A53">قُرئت كل الأوراق.</p>'}
    <div class="omr-row"><label class="btn primary">📄 ملف آخر<input type="file" accept="application/pdf,image/*" multiple hidden onchange="omrLoadFiles([...this.files]);this.value=''"></label>
      <button class="btn ghost" type="button" onclick="omrClose()">إنهاء</button></div></div>`;
  OMRUI.queue = [];
}
/* 🎥 الكاميرا الحيّة: عند الطلب فقط، وبإطار طولي (الورقة طولية؛ الإطار المربع كان يقصّها) */
/* 📐 سفاري الآيفون يختار مقاس الفيديو من قائمته ولا يلتزم بالطلب، فنجرّب صيغًا حتى يخرج فيديو طولي
   (نتحقق من الأبعاد الفعلية بعد التشغيل)، ونحفظ الصيغة الناجحة لتبدأ بها المرات القادمة.
   إن لم تنجح أي صيغة نعود لأعلى دقة عرضية مع «ضع الورقة بالعرض». */
const OMR_CAM_TRIES = [
  { facingMode:{ ideal:'environment' } },                                                    // ص1: افتراضي (في الآيفون 480×640 — منخفض)
  { facingMode:{ ideal:'environment' }, width:{ ideal:1080 }, height:{ ideal:1920 } },
  { facingMode:{ ideal:'environment' }, width:{ ideal:1440 }, height:{ ideal:1920 } },
  { facingMode:{ ideal:'environment' }, width:{ ideal:3024 }, height:{ ideal:4032 } },
  { facingMode:{ ideal:'environment' }, width:{ ideal:1920 }, height:{ ideal:1080 } },      // مقاسات سفاري العرضية: قد تُدار إلى طولي
  { facingMode:{ ideal:'environment' }, width:{ ideal:1920 }, height:{ ideal:1440 } },
  { facingMode:{ ideal:'environment' }, width:{ ideal:3840 }, height:{ ideal:2160 } },
  { facingMode:{ ideal:'environment' }, height:{ ideal:1920 } },
  { facingMode:{ ideal:'environment' }, width:{ ideal:1920 } },
  { facingMode:{ ideal:'environment' }, aspectRatio:{ exact:0.75 } }
];
const OMR_CAM_ORDER = [4, 5, 6, 1, 2, 3, 7, 8, 9, 0];
const OMR_MIN_SIDE = 1080;          // أقل جانب قصير يكفي لقراءة المربعات
/* 📷 كل بث كاميرا يُفتح يُسجَّل هنا، والإغلاق يشمله مهما كان مساره — لا تبقى الكاميرا مفتوحة (النقطة الخضراء) */
const OMR_STREAMS = new Set();
function omrKillStreams(){
  for(const s of OMR_STREAMS){ try{ s.getTracks().forEach(t => t.stop()); }catch(e){} }
  OMR_STREAMS.clear(); OMRUI.stream = null;
  const v = document.getElementById('omr-video'); if(v){ try{ v.pause(); }catch(e){} v.srcObject = null; }
}
async function omrOpenStream(c){
  const s = await navigator.mediaDevices.getUserMedia({ video:c, audio:false });
  OMR_STREAMS.add(s);
  s.getTracks().forEach(t => { const st = t.stop.bind(t); t.stop = () => { st(); if(s.getTracks().every(x => x.readyState === 'ended')) OMR_STREAMS.delete(s); }; });
  const v = $('omr-video'); v.srcObject = s; await v.play().catch(()=>{});
  for(let i = 0; i < 40 && !v.videoWidth; i++) await new Promise(r => setTimeout(r, 50));   // الأبعاد الفعلية بعد بدء البث
  return { s, w: v.videoWidth, h: v.videoHeight };
}
async function omrStartCamera(scan){
  OMRUI.scanMode = !!scan; OMRUI.forceShot = false;
  try{ const AC = window.AudioContext || window.webkitAudioContext; if(AC && !OMRUI.ac) OMRUI.ac = new AC(); if(OMRUI.ac && OMRUI.ac.resume) OMRUI.ac.resume(); }catch(e){}   // صوت التأكيد يحتاج لمسة المستخدم
  if(OMRUI.starting) return;                                   // ضغطة ثانية أثناء التشغيل: لا بث ثانٍ
  OMRUI.starting = true;
  try{ await omrStartCameraRun(); } finally { OMRUI.starting = false; }
}
async function omrStartCameraRun(){
  omrKillStreams();
  const gen = OMRUI.camGen = (OMRUI.camGen || 0) + 1;
  const alive = () => OMRUI.camGen === gen && document.getElementById('omr-video');
  const st = $('omr-status'); st.textContent = 'جارٍ تشغيل الكاميرا…';
  const portraitScreen = window.innerHeight >= window.innerWidth;
  let saved = -1; try{ const sv = localStorage.getItem('omr_cam_try'); if(sv !== null && /^\d+$/.test(sv)) saved = Number(sv); }catch(e){}   // Number(null)=0 كان يبدأ بالصيغة المنخفضة دائمًا
  // الماسح: أعلى دقة أولًا (الورقة تُقصّ من اللقطة الكاملة فكل بكسل يفيد)
  // أعلى دقة أولًا في الوضعين: الورقة تُقصّ من اللقطة الكاملة، وفيديو 1080 ناعم تختفي فيه خطوط المربعات الرفيعة
  const order = OMRUI.scanMode ? [3, 6, 2, 5, 4, 1, 7, 8, 9, 0] : [6, 3, ...(saved >= 0 && saved < OMR_CAM_TRIES.length ? [saved] : []), ...OMR_CAM_ORDER].filter((v, i, a) => a.indexOf(v) === i);
  const need = 1440;
  // بث واحد في كل لحظة. المقبول فورًا: طولي بجانب قصير ≥ 1080. وإلا نختار من المجرَّب:
  // طولي ≥ 900، ثم عرضي ≥ 1080 (مع «ضع الورقة بالعرض»)، ثم الأعلى دقة — الدقة أهم من الاتجاه.
  let best = null; const seen = [];
  for(const k of order){
    let r; try{ r = await omrOpenStream(OMR_CAM_TRIES[k]); }catch(e){ continue; }
    if(!alive()){ omrKillStreams(); return; }                   // أُغلقت الشاشة أثناء التجربة
    const portrait = r.h > r.w || !portraitScreen, short = Math.min(r.w, r.h);
    if(portrait && short >= need){ best = { ...r, k }; break; }
    seen.push({ k, w: r.w, h: r.h, portrait, short });
    r.s.getTracks().forEach(t => t.stop());
  }
  if(!best && seen.length){
    const pick = seen.filter(x => x.portrait && x.short >= 900).sort((a, b) => b.w * b.h - a.w * a.h)[0]
              || seen.filter(x => !x.portrait && x.short >= OMR_MIN_SIDE).sort((a, b) => b.w * b.h - a.w * a.h)[0]
              || seen.slice().sort((a, b) => b.w * b.h - a.w * a.h)[0];
    try{ const r = await omrOpenStream(OMR_CAM_TRIES[pick.k]); best = { ...r, k: pick.k }; }catch(e){}
  }
  if(!alive()){ omrKillStreams(); return; }
  if(!best){ st.textContent = 'تعذّر تشغيل الكاميرا — استخدم «📸 تصوير ورقة»'; return; }
  const v = $('omr-video'); if(v.srcObject !== best.s){ v.srcObject = best.s; await v.play().catch(()=>{}); }
  OMRUI.stream = best.s; OMRUI.camTry = best.k; OMRUI.lowRes = Math.min(best.w, best.h) < 900;
  // 🔦 الفلاش: يظهر الزر فقط إن سمح به المتصفح (أندرويد غالبًا؛ سفاري الآيفون لا يسمح)
  OMRUI.torch = false; try{ const tr = best.s.getVideoTracks()[0], cp = tr && tr.getCapabilities ? tr.getCapabilities() : {}; const tb = $('omr-torch'); if(tb){ tb.hidden = !cp.torch; tb.classList.remove('on'); } }catch(e){}
  if(!OMRUI.scanMode) try{ localStorage.setItem('omr_cam_try', String(best.k)); }catch(e){}
  const sb = $('omr-shutter'); if(sb) sb.hidden = !OMRUI.scanMode;
  $('omr-pick').style.display = 'none'; $('omr-result').innerHTML = ''; OMRUI.photoMode = false; OMRUI.queue = [];
  omrStartLoop();
}
async function omrTorch(){
  const tr = OMRUI.stream && OMRUI.stream.getVideoTracks ? OMRUI.stream.getVideoTracks()[0] : null; if(!tr) return;
  try{ await tr.applyConstraints({ advanced: [{ torch: !OMRUI.torch }] }); OMRUI.torch = !OMRUI.torch; const b = $('omr-torch'); if(b) b.classList.toggle('on', OMRUI.torch); }
  catch(e){ toast('الفلاش غير متاح في هذا المتصفح'); }
}
function omrStopCamera(){
  omrStopLoop(); omrKillStreams(); OMRUI.camGen = (OMRUI.camGen || 0) + 1;       // يُلغي أي تشغيل جارٍ لم يكتمل
  OMRUI.waitSwap = false; OMRUI.savedSig = null; OMRUI.liveSig = null;
  document.querySelectorAll('#omr-sheet .omr-cam, #omr-sheet .omr-actions').forEach(e => e.style.display = 'none');
  const ob = $('omr-body'); if(ob) ob.classList.remove('cam-on');
  const pk = $('omr-pick'); if(pk) pk.style.display = '';
}
function omrStartLoop(){
  if(!OMRUI.stream) return; omrCamVisible(true); omrStopLoop();
  OMRUI.last = null; OMRUI.stable = 0; OMRUI.qprev = null; OMRUI.still = 0;
  OMRUI.timer = setInterval(omrTick, 250); OMRUI.raf = requestAnimationFrame(omrPaint);
  try{ document.querySelector('#omr-sheet .omr-cam').scrollIntoView({ block:'start' }); }catch(e){}      // الكاميرا أول الشاشة دائمًا
  const st=$('omr-status'); if(st) st.textContent = OMRUI.waitSwap ? 'بدّل الورقة بورقة الطالب التالي' : 'وجّه الجوال على ورقة الإجابة كاملة';
}
function omrStopLoop(){ clearInterval(OMRUI.timer); OMRUI.timer = 0; omrDrawQuad(null); cancelAnimationFrame(OMRUI.raf); OMRUI.raf = 0; }
/* 🖼️ المعاينة = ما يحلله المحرك حرفيًا: نرسم الإطار نفسه (نفس drawImage ونفس الأبعاد) ثم حدود الورقة
   بنفس الإحداثيات — لا يمكن أن ينفصل ما تراه عمّا يُقرأ. أخضر = جاهز، برتقالي = يحتاج تعديلًا. */
function omrPaint(){
  OMRUI.raf = requestAnimationFrame(omrPaint);
  const cv = $('omr-pv'), v = $('omr-video'); if(!cv || !v || !v.videoWidth) return;
  const box = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const W = Math.round(box.width * dpr), H = Math.round(box.height * dpr);
  if(cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; }
  const x = cv.getContext('2d'), vw = v.videoWidth, vh = v.videoHeight;
  const cam = cv.parentElement, ar = `${vw} / ${vh}`; if(cam && cam.style.aspectRatio !== ar) cam.style.aspectRatio = ar;   // الصندوق بشكل صورة الكاميرا: أكبر معاينة ممكنة
  const s = Math.min(W / vw, H / vh), ox = (W - vw * s) / 2, oy = (H - vh * s) / 2;
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  x.drawImage(v, 0, 0, vw, vh, ox, oy, vw * s, vh * s);
  const q = OMRUI.curQuad;
  if(q && OMRUI.curDims && OMRUI.curDims[0] === vw && OMRUI.curDims[1] === vh){
    const ok = OMRUI.curOk;
    const wait = OMRUI.curWait;                                                  // أزرق = قُرئت وتنتظر الورقة التالية (ليس خطأ)
    x.lineWidth = 4 * dpr; x.strokeStyle = wait ? '#3B82F6' : ok ? '#22C55E' : '#F59E0B'; x.fillStyle = wait ? 'rgba(59,130,246,.10)' : ok ? 'rgba(34,197,94,.15)' : 'rgba(245,158,11,.12)';
    x.beginPath(); q.forEach(([px, py], k) => { const X = ox + px * s, Y = oy + py * s; k ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.closePath(); x.fill(); x.stroke();
  }
  const same = OMRUI.curDims && OMRUI.curDims[0] === vw && OMRUI.curDims[1] === vh;
  // ⏳ «ثبّت الجوال»: حلقة تمتلئ مع جمع اللقطات (كما في ماسح المستندات) — في وسط الورقة المكتشفة
  if(same && q && OMRUI.curOk && OMRUI.curProg > 0){ const cx = ox + q.reduce((t, p) => t + p[0], 0) / 4 * s, cy = oy + q.reduce((t, p) => t + p[1], 0) / 4 * s, R = 30 * dpr;
    x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fillStyle = 'rgba(15,23,42,.55)'; x.fill(); x.lineWidth = 6 * dpr; x.strokeStyle = 'rgba(255,255,255,.3)'; x.stroke();
    x.beginPath(); x.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, OMRUI.curProg)); x.strokeStyle = '#22C55E'; x.lineCap = 'round'; x.stroke(); x.lineCap = 'butt';
    x.font = `800 ${11 * dpr}px system-ui,sans-serif`; x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ثبّت', cx, cy); }
  // نقاط الزوايا: خضراء = المربع الأسود ظاهر، حمراء = غائب أو مظلَّل
  if(same && OMRUI.curDots) OMRUI.curDots.forEach(([px, py, ok]) => { const X = ox + px * s, Y = oy + py * s, R = 9 * dpr;
    x.beginPath(); x.arc(X, Y, R, 0, 7); x.fillStyle = ok ? '#22C55E' : 'rgba(239,68,68,.25)'; x.fill(); x.lineWidth = 3 * dpr; x.strokeStyle = ok ? '#fff' : '#EF4444'; x.stroke(); });
  if(same && OMRUI.curGlare){ const [gx, gy] = OMRUI.curGlare; x.beginPath(); x.arc(ox + gx * s, oy + gy * s, 34 * dpr, 0, 7); x.setLineDash([6 * dpr, 5 * dpr]); x.lineWidth = 3 * dpr; x.strokeStyle = '#FACC15'; x.stroke(); x.setLineDash([]); }
  if(OMRUI.curHint){                                                              // التنبيه على الصورة نفسها: يُرى والعين على الورقة
    x.font = `700 ${13 * dpr}px system-ui,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    const t = OMRUI.curHint, tw = Math.min(W - 16 * dpr, x.measureText(t).width + 24 * dpr), th = 32 * dpr, bx = (W - tw) / 2, by = H - th - 34 * dpr;   // أسفل الصورة: لا يتقاطع مع زر الفلاش
    x.fillStyle = 'rgba(15,23,42,.78)'; x.beginPath(); if(x.roundRect) x.roundRect(bx, by, tw, th, 12 * dpr); else x.rect(bx, by, tw, th); x.fill();
    x.fillStyle = '#fff'; x.fillText(t, W / 2, by + th / 2, tw - 16 * dpr);
  }
}
function omrDrawQuad(q, ok, dims, wait){ OMRUI.curQuad = q; OMRUI.curOk = !!ok; OMRUI.curDims = dims || null; OMRUI.curWait = !!wait; }
function omrTick(){
  const v = $('omr-video'); if(!v || OMRUI.busy || v.readyState < 2 || !v.videoWidth) return;
  const vw = v.videoWidth, vh = v.videoHeight, k = Math.min(1, 640 / Math.max(vw, vh));
  const c = OMRUI.small || (OMRUI.small = document.createElement('canvas'));
  c.width = Math.round(vw * k); c.height = Math.round(vh * k);
  const x = c.getContext('2d', { willReadFrequently:true }); x.drawImage(v, 0, 0, c.width, c.height);
  // ⬛ ورقة بعلامات زوايا: نتتبّع العلامات نفسها (تعمل ولو طرف الورقة خارج الصورة أو السطح فاتح أو الطباعة مصغّرة)
  const MM = OMRUI.tpl && OMRUI.tpl.models[OMRUI.auto ? 0 : OMRUI.model], MK = MM && MM.marks;
  let pr = null, sc = k;
  if(MK){
    const tryMk = (cv, kk) => { const G = OMR.gray(cv.getContext('2d', { willReadFrequently:true }).getImageData(0, 0, cv.width, cv.height)); OMR.findMarks.cands = []; const f = OMR.findMarks(G, MK, MM, Math.max(cv.width, cv.height)); OMRUI.mkC = { c: OMR.findMarks.cands || [], s: kk }; if(f){ pr = { G, found: f }; sc = kk; } };
    // 🔭 ورقة بعيدة: في نسخة ٦٤٠ يصير المربع الأسود ٢–٣ بكسل فلا يُعرف، فتُلتقط حواف البلاط بدل الورقة.
    // ثلاث دقّات (٦٤٠ ← ١١٠٠ ← ١٦٠٠): تبدأ بالتي نجحت آخر مرة، وإن لم تُوجد العلامات تُجرَّب دقّة أخرى في الفحص نفسه —
    // فتُكتشف الورقة البعيدة خلال لحظة بلا تحريك الجوال، والقريبة تبقى على الصغيرة السريعة
    // ⚡ لا تعليق للمعاينة: الدقة العالية تُقرأ حول الورقة فقط بعد العثور عليها (تتبّع)، والبحث الواسع موزّع على الفحوص
    const TIERS = [640, 1100, 1600], tick = OMRUI.mkTick = (OMRUI.mkTick || 0) + 1;
    const tryTier = (t, roi) => { if(!t){ tryMk(c, k); return; }
      const kk = Math.min(1, TIERS[t] / Math.max(vw, vh)), cv = t === 1 ? (OMRUI.mid || (OMRUI.mid = document.createElement('canvas'))) : (OMRUI.big || (OMRUI.big = document.createElement('canvas')));
      if(roi){                                                                    // قصّ ما حول الورقة فقط بالدقة العالية
        const bx = Math.max(0, roi[0]), by = Math.max(0, roi[1]), bw = Math.min(vw, roi[2]) - bx, bh = Math.min(vh, roi[3]) - by; if(bw < 40 || bh < 40) return;
        cv.width = Math.round(bw * kk); cv.height = Math.round(bh * kk); cv.getContext('2d', { willReadFrequently:true }).drawImage(v, bx, by, bw, bh, 0, 0, cv.width, cv.height);
        const G = OMR.gray(cv.getContext('2d', { willReadFrequently:true }).getImageData(0, 0, cv.width, cv.height)); OMR.findMarks.cands = []; const f = OMR.findMarks(G, MK, MM, Math.max(cv.width, cv.height), Math.round(Math.max(vw, vh) * kk));
        const ox = bx * kk, oy = by * kk; OMRUI.mkC = { c: (OMR.findMarks.cands || []).map(([a, b]) => [a + ox, b + oy]), s: kk };
        if(f){ pr = { G: null, found: { ...f, quad: f.quad.map(([a, b]) => [a + ox, b + oy]) } }; sc = kk; }
        return; }
      cv.width = Math.round(vw * kk); cv.height = Math.round(vh * kk); cv.getContext('2d', { willReadFrequently:true }).drawImage(v, 0, 0, cv.width, cv.height); tryMk(cv, kk); };
    const t0 = OMRUI.mkTier || 0;
    if(t0 && OMRUI.mkROI) tryTier(t0, OMRUI.mkROI);                               // متابعة الورقة في مكانها
    if(!pr){
      // بحث موزّع: الصغيرة دائمًا، و١١٠٠ كل فحصين، و١٦٠٠ كل أربعة — يجد الورقة البعيدة خلال ثانية تقريبًا بلا ثقل على المعاينة
      tryTier(0); if(pr) OMRUI.mkTier = 0;
      else { const t1 = tick % 4 === 0 ? 2 : tick % 2 === 0 ? 1 : -1; if(t1 > 0 && t1 !== t0){ tryTier(t1); if(pr) OMRUI.mkTier = t1; } }
      if(!pr) OMRUI.mkROI = null;
    }
    // وُجدت في دقّة عالية والورقة اقتربت؟ كل عاشر فحص يُجرَّب الأصغر الأسرع
    else if(t0 && tick % 10 === 0){ const keep = pr, ksc = sc; pr = null; tryTier(0); if(pr){ OMRUI.mkTier = 0; OMRUI.mkROI = null; } else { pr = keep; sc = ksc; } }
    if(pr && (OMRUI.mkTier || 0) > 0){                                            // منطقة المتابعة: حول الورقة مع هامش ربعها
      const Q = pr.found.quad.map(([a, b]) => [a / sc, b / sc]), xs = Q.map(p => p[0]), ys = Q.map(p => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), mx = (x1 - x0) * .25 + 40, my = (y1 - y0) * .25 + 40;
      OMRUI.mkROI = [x0 - mx, y0 - my, x1 + mx, y1 + my];
    }
  }
  // ⚡ البحث عن حواف الورقة/الإطار احتياطٌ حين لا تُرى العلامات، وهو أثقل جزء في الفحص (٥٠–١٢٠ مللي ثانية) — كان يُجرى في كل فحص
  // فتتقطّع المعاينة. مع اختبار بعلامات: كل فحصين، ونسخة ١٦٠٠ كل أربعة. يُعاد استعمال نتيجة سابقة فقط إن كانت «لم توجد» (للإرشاد)،
  // لا إطارًا وُجد — فلا تُلتقط ورقة بزوايا قديمة
  const ft = OMRUI.fbTick = (OMRUI.fbTick || 0) + 1, fb = OMRUI.fbPr;
  if(!pr && MK && ft % 2 === 1 && fb && fb.pr.error){ pr = fb.pr; sc = fb.sc; }
  else if(!pr){
    pr = OMR.prepare(x.getImageData(0, 0, c.width, c.height), { noScan:true });
    if(pr.error && (!MK || ft % 4 === 0)){
    // سطح فاتح: الإطار المطبوع رفيع ويختفي عند التصغير — نبحث عنه في نسخة أكبر
    const k2 = Math.min(1, 1600 / Math.max(vw, vh)), c2 = OMRUI.mid || (OMRUI.mid = document.createElement('canvas'));
    c2.width = Math.round(vw * k2); c2.height = Math.round(vh * k2);
    const x2 = c2.getContext('2d', { willReadFrequently:true }); x2.drawImage(v, 0, 0, c2.width, c2.height);
    const f = OMR.prepareFrame(OMR.gray(x2.getImageData(0, 0, c2.width, c2.height)));
    if(f && !f.error){ pr = f; sc = k2; } else if(f && f.error === 'cut'){ pr = f; sc = k2; }
  }
    OMRUI.fbPr = { pr, sc };
  }

  const st = $('omr-status');
  const land = vw > vh, dg = $('omr-diag'); if(dg) dg.textContent = `${vw}×${vh} · ${land ? 'عرضي' : 'طولي'} · ص${(OMRUI.camTry ?? -1) + 1}`;
  // 🎯 توجيه حي: نقطة على كل زاوية (خضراء = المربع الأسود ظاهر)، وتنبيه للزاوية الغائبة
  OMRUI.curDots = null; OMRUI.curHint = ''; OMRUI.curGlare = null;
  if(MK && !pr.error){
    const R = pr.found.marks ? pr.found.rect : (pr.found.rect || [0, 0, 210, 297]);
    const Hm = OMR.homography([[R[0], R[1]], [R[0] + R[2], R[1]], [R[0] + R[2], R[1] + R[3]], [R[0], R[1] + R[3]]], pr.found.quad);
    const exp = MK.map(m => OMR.apply(Hm, m[0] + m[2] / 2, m[1] + m[3] / 2).map(v => v / sc));
    const cands = OMRUI.mkC ? OMRUI.mkC.c.map(([a, b]) => [a / OMRUI.mkC.s, b / OMRUI.mkC.s]) : [], tol = 0.035 * Math.hypot(vw, vh);
    OMRUI.curDots = exp.map(e => [e[0], e[1], !!pr.found.marks || cands.some(c => Math.hypot(c[0] - e[0], c[1] - e[1]) < tol)]);
    const miss = OMRUI.curDots.filter(d => !d[2]).map(d => `${d[1] < vh / 2 ? 'أعلى' : 'أسفل'} ${d[0] < vw / 2 ? 'اليسار' : 'اليمين'}`);
    if(miss.length && miss.length < 4) OMRUI.curHint = `⬛ المربع الأسود ${miss.join(' و')} غير ظاهر — أدخله في الصورة أو أبعد الظل عنه`;
  }
  // الورقة غابت عن الإطار = بُدّلت: يُسمح بالتقاط جديد
  if(pr.error){
    if(OMRUI.waitSwap) OMRUI.waitSwap = false;
    OMRUI.qprev = null; OMRUI.still = 0; OMRUI.stable = 0; OMRUI.acc = []; OMRUI.shHist = []; OMRUI.glareN = 0;
    omrDrawQuad(pr.quad ? pr.quad.map(([a, b]) => [a / sc, b / sc]) : null, false, [vw, vh]);      // زوايا هذه اللحظة فقط
    if(st) st.textContent = MK
      ? (land ? 'ضع الورقة بالعرض — والمربعات السوداء الأربعة في زواياها داخل الصورة' : 'خلّ المربعات السوداء الأربعة في زوايا الورقة داخل الصورة')
      : pr.error === 'cut'
      ? (land ? 'ضع الورقة بالعرض، أو ابتعد قليلًا — طرفها خارج الصورة' : OMR_MSG.cut)
      : (land ? 'ضع الورقة بالعرض داخل الصورة — الكاميرا عرضية' : 'وجّه الجوال على ورقة الإجابة كاملة');
    return;
  }
  // الإطار المعروض: حدود الصفحة كاملة محسوبة من العلامات (لا مراكز العلامات)
  const fq = pr.found.marks ? (() => { const R = pr.found.rect, H = OMR.homography([[R[0], R[1]], [R[0] + R[2], R[1]], [R[0] + R[2], R[1] + R[3]], [R[0], R[1] + R[3]]], pr.found.quad); return [[0, 0], [210, 0], [210, 297], [0, 297]].map(([a, b]) => OMR.apply(H, a, b)); })() : pr.found.quad;
  const q = fq.map(([a, b]) => [a / sc, b / sc]);
  const diag = Math.hypot(vw, vh);
  const move = OMRUI.qprev ? Math.max(...q.map((p, i) => Math.hypot(p[0] - OMRUI.qprev[i][0], p[1] - OMRUI.qprev[i][1]))) / diag : 1;
  if(OMRUI.waitSwap && move > 0.15 && OMRUI.qprev) OMRUI.waitSwap = false;       // الورقة تحرّكت كثيرًا = ورقة أخرى
  OMRUI.qprev = q; OMRUI.still = move < 0.012 ? OMRUI.still + 1 : 0;
  if(!OMRUI.still){ OMRUI.acc = []; OMRUI.shHist = []; }                         // تحرّك: القراءات المجمّعة والوضوح يبدآن من جديد
  // 📐 الجوال مائل بقوة: لا التقاط (الورقة المقوّمة تُقرأ لاحقًا كأنها مستقيمة فلا يُكشف الميل بعدها)
  const tiltQ = OMR.tiltOf(pr.found.quad);
  if(tiltQ < OMR.T.tilt){ OMRUI.acc = []; OMRUI.shHist = []; OMRUI.stable = 0; OMRUI.scanGeo = null;
    omrDrawQuad(q, false, [vw, vh]); if(st) st.textContent = OMR_MSG.tilt; return; }
  omrDrawQuad(q, !OMRUI.waitSwap, [vw, vh], OMRUI.waitSwap);
  OMRUI.scanGeo = { rect: pr.found.rect || [0, 0, 210, 297], quad: pr.found.quad.map(([a, b]) => [a / sc, b / sc]), marks: !!pr.found.marks };   // للقص من اللقطة الكاملة
  if(OMRUI.forceShot && !OMRUI.waitSwap){ if(st) st.textContent = 'جارٍ القراءة…'; omrProcess(v, vw, vh, false); return; }   // زر الالتقاط: بلا انتظار والوضوح: على النسخة الصغيرة، داخل الورقة فقط (بإحداثيات الصفحة بالمم)
  const Gs = sc === k && pr.G ? pr.G : OMR.gray(x.getImageData(0, 0, c.width, c.height));
  const Rp = pr.found.rect || [0, 0, 210, 297];
  const Hp = OMR.homography([[Rp[0], Rp[1]], [Rp[0] + Rp[2], Rp[1]], [Rp[0] + Rp[2], Rp[1] + Rp[3]], [Rp[0], Rp[1] + Rp[3]]], pr.found.quad.map(([a, b]) => [a * k / sc, b * k / sc]));
  const gq = omrPageQuality(Gs, Hp);
  if(gq.glare){ OMRUI.curGlare = [gq.glare[0] / k, gq.glare[1] / k]; OMRUI.curHint = '✨ لمعة ضوء على الورقة — ميّل الجوال قليلًا أو غيّر مكانه'; }
  OMRUI.glareN = gq.glare ? (OMRUI.glareN || 0) + 1 : 0; OMRUI.glareMm = gq.glareMm;
  if(OMRUI.lowRes && st && !OMRUI.waitSwap){ st.textContent = 'دقة الكاميرا منخفضة لقراءة المربعات — استخدم «📸 تصوير ورقة»'; }
  if(OMRUI.waitSwap){
    if(st && !OMRUI.dupSheet) st.textContent = OMRUI.batch ? `✓ في الدفعة ${OMRUI.sheets.length} — ضع الورقة التالية فوقها` : 'بدّل الورقة بورقة الطالب التالي';
    // ورقة وُضعت فوق السابقة بلا غياب: قراءة كل ~1.5 ث، وتُقبل فقط إن اختلفت في إجابتين على الأقل
    OMRUI.swapTick = (OMRUI.swapTick || 0) + 1;
    if(OMRUI.still >= 2 && OMRUI.swapTick % 6 === 0) omrProcess(v, vw, vh, false);
    return;
  }
  if(OMRUI.lowRes) return;                                                      // لا قراءة بدقة لا تكفي
  if(OMRUI.still < 2){ if(st) st.textContent = 'ثبّت الجوال…'; return; }
  if(gq.glare && OMRUI.glareN < 8 && !(OMRUI.cfg && OMRUI.cfg.glareWait === false)){ if(st) st.textContent = 'لمعة ضوء فوق الورقة — ميّل الجوال قليلًا'; return; }   // بعد ثانيتين نقرأ على أي حال
  // 🔍 أوضح لقطة: لا نقرأ لقطة أقل حدة بوضوح من أفضل لقطة في الثانيتين الأخيرتين (اهتزاز أو تركيز لم يكتمل)
  const sh = OMRUI.shHist || (OMRUI.shHist = []); sh.push(gq.sharp); if(sh.length > 8) sh.shift();
  if(sh.length < 3 || gq.sharp < 0.85 * Math.max(...sh)){ if(st) st.textContent = 'ثبّت الجوال… يضبط الوضوح'; return; }
  if(st) st.textContent = 'جارٍ القراءة…';
  omrProcess(v, vw, vh, false);                                                   // الورقة ثابتة: قراءة كاملة بالدقة الكاملة
}
/* 📄 تقويم الورقة كماسح المستندات: من اللقطة بدقتها الكاملة (لا المصغّرة) إلى صفحة مستوية 6.4 بكسل/مم
   مع هامش 4 مم حولها — المربعات أكبر بالبكسل والقارئ يجد العلامات في صفحة مستقيمة */
const OMR_FLAT = { kp: 6.4, m: 4 };                                           // بكسل/مم، وهامش حول الصفحة بالمم
function omrFlatten(src, w, h, geo, out){
  const fc = OMRUI.fullCv || (OMRUI.fullCv = document.createElement('canvas')); fc.width = w; fc.height = h;
  const fx = fc.getContext('2d', { willReadFrequently:true }); fx.drawImage(src, 0, 0, w, h);
  const S = fx.getImageData(0, 0, w, h).data, R = geo.rect;
  const H = OMR.homography([[R[0], R[1]], [R[0] + R[2], R[1]], [R[0] + R[2], R[1] + R[3]], [R[0], R[1] + R[3]]], geo.quad);
  const kp = OMR_FLAT.kp, X0 = -OMR_FLAT.m, Y0 = -OMR_FLAT.m, cw = Math.round((210 + 2 * OMR_FLAT.m) * kp), ch = Math.round((297 + 2 * OMR_FLAT.m) * kp);
  out.width = cw; out.height = ch; const ox = out.getContext('2d', { willReadFrequently:true }), D = ox.createImageData(cw, ch), d = D.data;
  for(let v = 0; v < ch; v++){
    const my = Y0 + v / kp;
    let nx = H[0] * X0 + H[1] * my + H[2], ny = H[3] * X0 + H[4] * my + H[5], dd = H[6] * X0 + H[7] * my + H[8];
    const sx = H[0] / kp, sy = H[3] / kp, sd = H[6] / kp;                       // خطّي في u: جمع بدل ضرب لكل بكسل
    for(let u = 0, o = v * cw * 4; u < cw; u++, o += 4, nx += sx, ny += sy, dd += sd){
      const X = nx / dd, Y = ny / dd;
      if(X < 0 || Y < 0 || X >= w - 1 || Y >= h - 1){ d[o] = d[o + 1] = d[o + 2] = 128; d[o + 3] = 255; continue; }
      const x0 = X | 0, y0 = Y | 0, ax = X - x0, ay = Y - y0, i = (y0 * w + x0) * 4, j = i + w * 4;
      for(let ch2 = 0; ch2 < 3; ch2++){
        const a = S[i + ch2] + (S[i + 4 + ch2] - S[i + ch2]) * ax, b = S[j + ch2] + (S[j + 4 + ch2] - S[j + ch2]) * ax;
        d[o + ch2] = a + (b - a) * ay;
      }
      d[o + 3] = 255;
    }
  }
  ox.putImageData(D, 0, 0);
  return D;
}
/* جودة اللقطة داخل الورقة: الحدّة (متوسط مربع التدرّج) واللمعة (بقعة أفتح بوضوح من بياض الورق) */
function omrPageQuality(G, H){
  const vals = [], pts = [], mm = [];
  for(let y = 40; y <= 285; y += 6) for(let x = 12; x <= 198; x += 6){
    const p = OMR.apply(H, x, y), X = Math.round(p[0]), Y = Math.round(p[1]);
    if(X < 1 || Y < 1 || X >= G.w - 1 || Y >= G.h - 1) continue; vals.push(G.g[Y * G.w + X]); pts.push([X, Y]); mm.push([x, y]);
  }
  let glare = null, glareMm = null;
  if(vals.length > 50){
    const med = vals.slice().sort((a, b) => a - b)[vals.length >> 1];
    if(med < 228){ const hot = pts.map((p, i) => i).filter(i => vals[i] > Math.max(med + 22, 236));
      if(hot.length >= 6){ glare = [hot.reduce((t, i) => t + pts[i][0], 0) / hot.length, hot.reduce((t, i) => t + pts[i][1], 0) / hot.length]; glareMm = hot.map(i => mm[i]); } }
  }
  const P = [[0, 0], [210, 0], [210, 297], [0, 297]].map(([a, b]) => OMR.apply(H, a, b));
  const x0 = Math.max(1, Math.min(...P.map(p => p[0])) | 0), x1 = Math.min(G.w - 2, Math.max(...P.map(p => p[0])) | 0);
  const y0 = Math.max(1, Math.min(...P.map(p => p[1])) | 0), y1 = Math.min(G.h - 2, Math.max(...P.map(p => p[1])) | 0);
  let s = 0, n = 0;
  for(let y = y0; y < y1; y += 2) for(let x = x0; x < x1; x += 2){ const i = y * G.w + x, gx = G.g[i + 1] - G.g[i - 1], gy = G.g[i + G.w] - G.g[i - G.w]; s += gx * gx + gy * gy; n++; }
  return { sharp: n ? s / n : 0, glare, glareMm };
}
/* 🧮 دمج عدة لقطات للورقة نفسها: متوسط امتلاء كل مربع ثم القرار — العلامة الباهتة التي تظهر وتختفي بين اللقطات تستقر */
function omrFuse(rs){
  const last = rs[rs.length - 1];
  const answers = last.answers.map((a, i) => {
    const ok = rs.map(r => r.answers[i]).filter(x => x.status !== 'unaligned' && x.fills && x.fills.length === a.fills.length);
    if(ok.length < Math.ceil(rs.length / 2)) return a;
    const avg = a.fills.map((_, k) => +(ok.reduce((t, x) => t + x.fills[k], 0) / ok.length).toFixed(3));
    const d = OMR._t.decide(avg.map(v => ({ fill: v, ink: 0 })));
    return { ...a, ...d, alt: d.alt, erased: d.erased, light: d.light, fills: avg };
  });
  return { ...last, answers: OMR._t.refineSheet(answers), fused: rs.length };
}
function omrProcess(src, w, h, single, preset){
  OMRUI.busy = true;
  try{
    let img; const c = $('omr-canvas'), T = OMRUI.tpl;
    let flatPrep = null;
    if(preset){                                                                    // ✋ زوايا حدّدها المعلم بيده
      img = preset.img; c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(img, 0, 0); flatPrep = preset.prep;
    }
    else if(!single && OMRUI.stream && OMRUI.scanGeo){
      img = omrFlatten(src, w, h, OMRUI.scanGeo, c);                                // 📄 الورقة مقوّمة من اللقطة الكاملة
      // موضع الصفحة في الصورة المقوّمة معروف (صنعناها): لا نعيد اكتشافه. كانت إعادة البحث تفشل في صورة ناعمة
      // فتُعامَل كمسح ضوئي حوافه حواف الورقة — والهامش 4 مم يُزيح كل المربعات فتُرفض الورقة
      const G = OMR.gray(img), M0 = T.models[OMRUI.auto ? 0 : OMRUI.model], mk = M0 && M0.marks ? OMR.findMarks(G, M0.marks, M0) : null;
      const P = (x, y) => [(x + OMR_FLAT.m) * OMR_FLAT.kp, (y + OMR_FLAT.m) * OMR_FLAT.kp];
      flatPrep = mk ? { G, found: mk } : { G, found: { quad: [P(0, 0), P(210, 0), P(210, 297), P(0, 297)], rect: [0, 0, 210, 297], marks: OMRUI.scanGeo.marks, flat: true } };
    }
    else { const k = Math.min(1, 1600/Math.max(w,h)), cw = Math.round(w*k), ch = Math.round(h*k);
      c.width = cw; c.height = ch; const x = c.getContext('2d', { willReadFrequently:true }); x.drawImage(src, 0, 0, cw, ch); img = x.getImageData(0,0,cw,ch); }
    if(single && !preset) OMRUI.lastSingle = img;                                 // لتحديد الزوايا يدويًا إن تعذّر الاكتشاف
    let r;
    // 🔢 النموذج آليًا: الرمز أولًا (محاذاة على العنوان وحده)، ثم القراءة بخريطة النموذج المكتشف
    if(OMRUI.auto){
      const cr = OMR.code(img, T.models[0], { noScan: !single, prep: flatPrep });
      if(!cr.ok) r = { ok:false, error:cr.error };
      else if((cr.code === null || cr.code === undefined) && OMR.pageOf(cr.prep, T.models[0])){
        // 📄📄 صفحة تالية (لا رمز نموذج فيها): نموذجها نموذج الصفحة الأولى التي تنتظرها في الدفعة
        const w = omrPageTarget(); if(!w) r = { ok:false, error:'page_alone' }; else { OMRUI.model = w.model; r = OMR.read(img, T.models[w.model], { prep: cr.prep }); } }
      else if(cr.code === null || cr.code === undefined || !T.models[cr.code]) r = { ok:false, error:'no_code' };   // لا تصحيح بمفتاح غير مؤكد
      else { OMRUI.model = cr.code; r = OMR.read(img, T.models[cr.code], { prep: cr.prep }); }
    } else r = OMR.read(img, T.models[OMRUI.model], { noScan: !single, ...(flatPrep ? { prep: flatPrep } : {}) });
    if(preset && !r.ok){ const st0 = $('omr-status'); if(st0) st0.textContent = '✋ ' + (OMR_MSG[r.error] || 'لم تُقرأ') + ' — تأكد أن كل دائرة على مربع أسود'; omrManualOpen(true); return; }
    OMRUI.lastPrep = flatPrep;                                                     // للتشخيص
    const st = $('omr-status');
    if(!r.ok){
      OMRUI.stable = 0; OMRUI.curProg = 0;
      if(single && OMRUI.queue && OMRUI.queue.length){ omrPageFailed(OMR_MSG[r.error] || 'لم تُقرأ'); return; }
      if(st) st.textContent = (single ? '📸 ' : '') + (OMR_MSG[r.error] || 'أعد المحاولة');
      return; }
    let sig = OMRUI.model + ':' + r.answers.map(a => a.status==='ok' ? a.pick : a.status[0]).join(',');   // بصمة القراءة
    if(!single){
      if(OMRUI.savedSig){
        const a = OMRUI.savedSig.split(':'), b = sig.split(':'), pa = (a[1]||'').split(','), pb = (b[1]||'').split(',');
        const diff = a[0] !== b[0] ? 99 : pa.reduce((n, v, i) => n + (/^\d+$/.test(v) && /^\d+$/.test(pb[i]||'') && v !== pb[i] ? 1 : 0), 0);
        // نفس الإجابات تقريبًا لا تكفي للحكم بأنها الورقة نفسها (طالبان متفوقان، أو أسئلة كثيرة غير واضحة):
        // نقارن صورة الورقة كلها (الاسم والخط والعلامات) بآخر ورقة أُضيفت
        const prev = OMRUI.lastPv, same = diff < 1 && (!prev || omrPvDiff(prev.pv, omrPageVec(r)) <= OMR_PV_SAME);
        if(same){ OMRUI.waitSwap = true; if(st) st.textContent = OMRUI.batch ? `✓ الورقة ${OMRUI.sheets.length} في الدفعة — ضع الورقة التالية فوقها` : 'هذه الورقة حُفظت — بدّلها بورقة الطالب التالي'; return; }
        OMRUI.waitSwap = false; OMRUI.savedSig = null;                     // ورقة مختلفة فعلًا
      }
      // ثلاث لقطات للورقة نفسها ثم الدمج. إجابة واضحة تغيّرت بين لقطتين = ورقة أخرى أو اهتزاز: نبدأ من جديد
      const acc = OMRUI.acc || (OMRUI.acc = []);
      if(acc.length && (acc[0].m !== OMRUI.model || r.answers.some((a, i) => a.status === 'ok' && acc.some(p => p.r.answers[i] && p.r.answers[i].status === 'ok' && p.r.answers[i].pick !== a.pick)))) acc.length = 0;
      acc.push({ r, m: OMRUI.model });
      const force = OMRUI.forceShot; OMRUI.forceShot = false;
      // ⚡ لقطة واضحة تمامًا (كل سؤال علامة قوية وبقية مربعاته نظيفة، ولا لمعة) تكفي وحدها — الدمج لا يضيف لها شيئًا.
      // ما فيه شك يُجمع من 3 لقطات كالسابق (أو لقطة واحدة إن اختار المعلم «أسرع» في اللوحة)
      const clear = q => q.answers.length && q.answers.every(a => { if(a.status !== 'ok' || !Array.isArray(a.fills)) return false; const f = a.fills.slice().sort((x, y) => y - x); return f[0] >= 0.2 && (f[1] || 0) <= 0.06; });
      const need = OMRUI.cfg && OMRUI.cfg.frames === 1 ? 1 : (acc.length === 1 && clear(r) && !(OMRUI.glareMm && OMRUI.glareMm.length)) ? 1 : 3;   // من إعدادات اللوحة: أدق (3) أو أسرع (1)
      if(acc.length < need && !force){ OMRUI.curProg = acc.length / need; if(st) st.textContent = `جارٍ القراءة… ${acc.length} من ${need}`; return; }
      OMRUI.curProg = 0;
      r = omrFuse(acc.map(p => p.r)); OMRUI.acc = [];
      // قرأنا رغم اللمعة: كل سؤال تقع مربعاته تحتها يُعرض للتأكيد بدل أن يُصحَّح (اللمعة قد تمسح علامة الطالب)
      if(OMRUI.glareMm && OMRUI.glareMm.length) r.answers = r.answers.map(a => (a.boxes || []).some(b => OMRUI.glareMm.some(([gx, gy]) => Math.abs(gx - (b.r[0] + b.r[2] / 2)) < 7 && Math.abs(gy - (b.r[1] + b.r[3] / 2)) < 7)) ? { ...a, status: 'glare' } : a);
      sig = OMRUI.model + ':' + r.answers.map(a => a.status==='ok' ? a.pick : a.status[0]).join(',');
      OMRUI.last = sig; OMRUI.liveSig = sig;
    }
    if(OMRUI.batch){ omrBatchAdd(r, c, img, sig, single); return; }      // 🗂️ الدفعة: أضف واستمر
    omrStopLoop();
    OMRUI.frozen = c.toDataURL('image/jpeg', 0.7);
    r.answers.forEach(a => { a.final = omrFinalOf(a); });
    { const who = omrStudentOf(r.scode); if(who){ OMRUI.sid = who.id; omrRefreshStudents(); OMRUI.autoWho = true; } else OMRUI.autoWho = false; }   // 🧾 ورقة باسمه
    OMRUI.result = r; omrShowResult();
  } finally { OMRUI.busy = false; }
}
function omrCamVisible(on){
  document.querySelectorAll('#omr-sheet .omr-cam, #omr-sheet .omr-actions').forEach(e => e.style.display = on ? '' : 'none');
  const b = $('omr-body'); if(b) b.classList.toggle('cam-on', !!on);       // الكاميرا تعمل: تختفي العناصر فوقها فتبقى أول الشاشة
}
function omrShowResult(){
  const r = OMRUI.result, T = OMRUI.tpl, L = ['أ','ب','ج','د','هـ','و'];
  omrCamVisible(false);                                  // النتيجة مكان الكاميرا: تُرى فورًا بلا تمرير
  const pending = r.answers.filter(a => a.final === null).length;
  const sc = omrScoreOf(r), test = omrTest();
  const tt = omrTotals(), partial = tt.total > tt.auto + 1e-9;
  const scaled = test && !partial && Math.abs(tt.total - test.max) > 1e-9 ? +(sc.raw / tt.total * test.max).toFixed(2) : null;
  const who = list('').find(s => s.id === OMRUI.sid);
  const ml = T.models.length > 1 ? `نموذج (${T.models[OMRUI.model].letter||OMRUI.model+1})${OMRUI.auto?' — عُرف تلقائيًا':''} · ` : '';
  const qn = !OMRUI.photoMode && OMRUI.queue && OMRUI.queue.length ? `ورقة ${OMRUI.qi+1} من ${OMRUI.queue.length} · ` : '';
  $('omr-status').textContent = qn + ml + (pending ? `⚠️ ${pending} ${pending===1?'سؤال يحتاج':'أسئلة تحتاج'} تأكيدك — اضغطه واختر ما كتبه الطالب` : '✓ قُرئت الورقة');
  const body = $('omr-body'); if(body) body.scrollTop = 0;
  $('omr-result').innerHTML = `<div class="omr-res">
    <div class="omr-score"><b>${pending?'؟':sc.raw}</b><span>/ ${sc.total}</span>${scaled!==null&&!pending?`<small>تُرصد ${scaled} من ${test.max}</small>`:''}</div>
    <div class="omr-qs">${r.answers.map((a,i)=>{ const st = a.final===null ? 'rev' : a.final===a.key ? 'ok' : 'no';
      const lab = a.final===-2 ? 'مزدوجة' : a.t==='tf' ? (a.final===0?'صح':a.final===1?'خطأ':a.final===-1?'فارغ':'?') : (a.final===-1?'فارغ':a.final===null?'?':a.t==='mt'?String(a.final+1):L[a.final]);
      return `<button type="button" class="omr-q ${st}" onclick="omrFix(${i})"><i>${i+1}</i>${lab}</button>`; }).join('')}</div>
    <div id="omr-fix"></div>
    ${partial?`<p class="omr-note">قُرئ الجزء الآلي (${tt.auto} من ${tt.total}) — اكتب درجة الجزء اليدوي لتُرصد الدرجة كاملة.</p>${omrManualHTML('omr-manual', OMRUI.manual ?? '', OMRUI.model, "OMRUI.manual=this.value;const b=document.getElementById('omr-save');if(b)b.disabled=!omrManualOk(this.value)||!!document.querySelector('.omr-q.rev')")}`:''}
    <div class="omr-row">
      <button class="btn primary" type="button" id="omr-save" ${pending||(partial&&!omrManualOk(OMRUI.manual))||!who?'disabled':''} onclick="omrSave()">💾 حفظ لـ ${esc(who?who.name:'—')}</button>
      ${OMRUI.photoMode ? `<label class="btn ghost omr-file-btn">↻ أعد التصوير<input type="file" accept="image/*" capture="environment" hidden onchange="omrPhoto(this)"></label>` : OMRUI.queue && OMRUI.queue.length ? `<button class="btn ghost" type="button" onclick="omrSkip()">⏭ تخطي الورقة</button>` : `<button class="btn ghost" type="button" onclick="omrRescan()">↻ إعادة المسح</button>`}</div></div>`;
}
function omrFix(i){
  const a = OMRUI.result.answers[i], L = ['أ','ب','ج','د','هـ','و'], n = OMRUI.tpl.models[OMRUI.model].questions[i].boxes.length;
  const opts = a.t==='tf' ? [[0,'صح'],[1,'خطأ']] : Array.from({length:n},(_,k)=>[k,a.t==='mt'?String(k+1):L[k]]);   // الوصل: أرقام العمود الأول
  const why = { multi:'مربعان معلّمان', faint:'علامة باهتة', blank:'لم يُعلَّم شيء', unaligned:'لم يتضح المربع', glare:'لمعة ضوء فوقه' }[a.status] || '';
  const qq = OMRUI.tpl.models[OMRUI.model].questions[i].q;
  $('omr-fix').innerHTML = `<div class="omr-fixbox"><b>السؤال ${i+1}${why?` — ${why}`:''}</b>${qq ? `<small class="omr-qtxt">${esc(String(qq).slice(0, 90))}</small>` : ''}
    <div class="omr-crop" id="omr-crop-box"></div>
    <div class="omr-opts">${opts.map(([v,l])=>`<button type="button" class="btn ${a.final===v?'primary':'ghost'}" onclick="omrSet(${i},${v})">${l}</button>`).join('')}
      <button type="button" class="btn ${a.final===-1?'primary':'ghost'}" onclick="omrSet(${i},-1)">فارغ</button></div></div>`;
  omrCrop(i);
}
/* قصاصة السؤال من الصورة المجمّدة: موضع مربعاته عبر التحويل المنظوري نفسه */
function omrCrop(i){
  const r = OMRUI.result, a = r.answers[i], box = $('omr-crop-box'); if(!box || !a.boxes) return;
  omrRowCrop(box, OMRUI.frozen, r.H, 1, a, i);
}
/* ✂️ قصاصة السؤال: السطر كاملًا بعرض الورقة (نص السؤال ورقمه ومربعاته)، والسؤال المقصود مؤطَّر وما حوله باهت —
   كانت القصاصة تُكبَّر على المربعات وحدها فتظهر صفوف صح/خطأ متشابهة بلا رقم ولا نص، ولا يُعرف أيها المقصود */
function omrRowCrop(box, src, H, fs, a, qi){
  const mc = a.t === 'mc', bs = a.boxes.map(b => [b.r[0] + b.dx, b.r[1] + b.dy, b.r[2], b.r[3]]);
  const top = Math.min(...bs.map(b => b[1])), bot = Math.max(...bs.map(b => b[1] + b[3]));
  const l = Math.min(...bs.map(b => b[0])), r = Math.max(...bs.map(b => b[0] + b[2]));
  // الاختيار: خياراته على عرض الورقة. صح/خطأ والوصل: مكبَّرة على المربعات وعناوينها (نص السؤال مكتوب فوق القصاصة)
  // نص الخيار يقع يسار مربعه (عربي): نترك له مكانًا يسار أبعد مربع، ونقص الباقي فيكبر المعروض
  const rx0 = mc ? Math.max(5, l - 40) : Math.max(5, l - 11), rx1 = mc ? Math.min(205, r + 9) : Math.min(205, r + 16);
  const qy0 = top - (mc ? 2.6 : 1.8), qy1 = bot + (mc ? 5 : 1.8), ry0 = qy0 - (mc ? 1.5 : 4.5), ry1 = qy1 + (mc ? 1.5 : 4.5);   // نص الخيار قد يلتف لسطرين تحت مربعه
  const P = (x, y) => OMR.apply(H, x, y).map(v => v * fs);
  // الاختيار العريض (4 خيارات في سطر): نصفان فوق بعض (أ ب ثم ج د) ليكبر النص
  const sx = bs.map(b => [b[0], b[0] + b[2]]).sort((a, b) => b[0] - a[0]);
  const segs = mc && r - l > 110 && sx.length >= 3 ? (() => { const sp = sx[Math.ceil(sx.length / 2)][1] + 1.2; return [[sp, rx1], [rx0, sp + 1]]; })() : [[rx0, rx1]];
  const im = new Image();
  im.onload = () => {
    const dpr = window.devicePixelRatio || 1, bw = (box.clientWidth || 320), W = Math.round(bw * dpr);
    const parts = segs.map(([a, b]) => {
      const C = [P(a, ry0), P(b, ry0), P(b, ry1), P(a, ry1)];
      const x0 = Math.max(0, Math.min(...C.map(p => p[0]))), x1 = Math.min(im.naturalWidth, Math.max(...C.map(p => p[0])));
      const y0 = Math.max(0, Math.min(...C.map(p => p[1]))), y1 = Math.min(im.naturalHeight, Math.max(...C.map(p => p[1])));
      const k = W / Math.max(1, x1 - x0); return { a, b, x0, x1, y0, y1, k, h: Math.round((y1 - y0) * k) };
    });
    if(parts.some(q => q.x1 - q.x0 < 10 || q.y1 - q.y0 < 5)) return;
    const gap = parts.length > 1 ? Math.round(6 * dpr) : 0;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = parts.reduce((t, q) => t + q.h, 0) + gap * (parts.length - 1);
    cv.style.width = '100%'; cv.style.display = 'block';
    const x = cv.getContext('2d'); x.fillStyle = '#E6ECF4'; x.fillRect(0, 0, cv.width, cv.height);
    const poly = (pts) => { x.beginPath(); pts.forEach((p, j) => j ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); };
    let oy = 0;
    parts.forEach((q, pi) => {
      x.save(); x.beginPath(); x.rect(0, oy, W, q.h); x.clip(); x.translate(0, oy);
      x.drawImage(im, q.x0, q.y0, q.x1 - q.x0, q.y1 - q.y0, 0, 0, W, q.h);
      const T = (X, Y) => { const p = P(X, Y); return [(p[0] - q.x0) * q.k, (p[1] - q.y0) * q.k]; };
      const Q = [T(q.a + .6, qy0), T(q.b - .6, qy0), T(q.b - .6, qy1), T(q.a + .6, qy1)];
      // ما خارج السؤال باهت
      x.beginPath(); x.rect(0, 0, W, q.h); Q.slice().reverse().forEach((p, j) => j ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath();
      x.fillStyle = 'rgba(255,255,255,.62)'; x.fill('evenodd');
      x.lineWidth = 2.5 * dpr; x.strokeStyle = '#C88A2E'; poly(Q); x.stroke();
      // المربعات: إطار رفيع متقطع بعيد عنها قليلًا — لا يغطي علامة الطالب
      x.lineWidth = 1.4 * dpr; x.strokeStyle = 'rgba(224,162,31,.9)'; x.setLineDash([4 * dpr, 3 * dpr]);
      bs.forEach(b => { poly([T(b[0] - 1.6, b[1] - 1.6), T(b[0] + b[2] + 1.6, b[1] - 1.6), T(b[0] + b[2] + 1.6, b[1] + b[3] + 1.6), T(b[0] - 1.6, b[1] + b[3] + 1.6)]); x.stroke(); });
      x.setLineDash([]);
      if(pi === 0 && !mc){                                                        // رقم السؤال فوق إطار سطره (في الجزء الباهت) — لا على الإجابة
        const room = Q[1][1] - 3 * dpr, fz = Math.min(14 * dpr, room / 1.4);
        if(fz >= 8 * dpr){
          x.font = `800 ${fz}px system-ui,sans-serif`; const lab = 'س' + (qi + 1), tw = x.measureText(lab).width + fz * 0.9, th = fz * 1.3;
          const bx = Math.min(W - tw - 3 * dpr, Q[1][0] - tw - 4 * dpr), by = Q[1][1] - th - 1.5 * dpr;
          x.fillStyle = '#C88A2E'; x.beginPath(); if(x.roundRect) x.roundRect(bx, by, tw, th, th / 2); else x.rect(bx, by, tw, th); x.fill();
          x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(lab, bx + tw / 2, by + th / 2 + 1);
        }
      }
      x.restore(); oy += q.h + gap;
    });
    box.innerHTML = ''; box.style.height = ''; box.appendChild(cv);
    box.onclick = () => { const o = document.createElement('div'); o.className = 'omr-full'; o.onclick = () => o.remove(); o.innerHTML = `<img src="${cv.toDataURL('image/jpeg', .9)}" alt=""><span>اضغط للإغلاق</span>`; document.body.appendChild(o); };
  };
  im.src = src;
}
/* الحكم الأولي لكل سؤال: الواضح كما قُرئ، وتظليل خيارين حسب إعداد اللوحة (للمراجعة، أو −2 = «مزدوجة» تُحسب خطأ) */
function omrFinalOf(a){ return a.status === 'ok' ? a.pick : (a.status === 'multi' && a.pick >= 0 && OMRUI.cfg && OMRUI.cfg.double === 'wrong') ? -2 : null; }
function omrSet(i, v){ OMRUI.result.answers[i].final = v; omrShowResult(); if(OMRUI.result.answers.some(a=>a.final===null)) { const j = OMRUI.result.answers.findIndex(a=>a.final===null); omrFix(j); } }
function omrWrongOf(answers, model){
  if(!OMRUI.tpl || !OMRUI.tpl.id || !Array.isArray(answers)) return null;
  const w = answers.map((a, i) => a && a.final !== null && a.final !== a.key ? i : -1).filter(i => i >= 0);
  return { om: { t: OMRUI.tpl.id, m: Number(model) || 0, w } };
}
async function omrSave(){
  const r = OMRUI.result, T = OMRUI.tpl, test = omrTest(); if(!test || !OMRUI.sid) return;
  const sc = omrScoreOf(r), tt = omrTotals();
  const man = omrManualMax() ? Number(($('omr-manual') || {}).value) : 0;
  if(omrManualMax() && !omrManualOk(($('omr-manual') || {}).value)){ toast('اكتب درجة الجزء اليدوي أولًا'); return; }
  const raw = +(sc.raw + man).toFixed(2), val = Math.abs(tt.total - test.max) > 1e-9 ? +(raw / tt.total * test.max).toFixed(2) : raw;
  const b = examBook(), prev = exHas(OMRUI.sid, OMRUI.testId) ? true : undefined;
  if(prev !== undefined && !(await askConfirm('لهذا الطالب درجة مرصودة في هذا الاختبار. استبدالها بالقراءة الجديدة؟', { title:'استبدال الدرجة؟', yes:'استبدل', no:'إلغاء' }))) return;
  // 📷 الأسئلة التي أخطأ فيها تُحفظ مع الدرجة: منها تُبنى المهمة العلاجية للاختبار
  await setExamScore(OMRUI.sid, OMRUI.testId, String(val), false, omrWrongOf(r.answers, OMRUI.model));
  omrUploadPaper(OMRUI.sid, OMRUI.frozen, r.H, 1, r.answers.map(a => ({ ...a })), val, { model: OMRUI.model, man });
  const who = list('').find(s=>s.id===OMRUI.sid);
  toast(`✓ ${who?who.name:''}: ${val} من ${test.max}`);
  OMRUI.sid = omrNextStudent(); OMRUI.savedN = (OMRUI.savedN||0) + 1; OMRUI.manual = '';
  if(OMRUI.stream){ OMRUI.waitSwap = true; OMRUI.savedSig = OMRUI.liveSig || null; }   // لا يُعاد التقاط الورقة نفسها لطالب آخر
  omrRefreshStudents();
  if(OMRUI.queue && OMRUI.queue.length){ OMRUI.qi++; omrQueueNext(); } else omrRescan();
}
function omrRefreshStudents(){ const row=document.querySelector('.omr-stu-row'); if(row) row.innerHTML = omrStudentsSelect(); const sel=$('omr-stu'); if(sel) sel.onchange=e=>{OMRUI.sid=e.target.value; if(OMRUI.result) omrShowResult();}; }
function omrRescan(){ $('omr-result').innerHTML=''; OMRUI.result=null; omrRefreshStudents(); if(OMRUI.stream) omrStartLoop(); else { const st=$('omr-status'); if(st) st.textContent='اختر طريقة المسح'; } }
/* ═══════════ 🗂️ تصوير الفصل ثم ربط الأسماء ═══════════
   التصوير متواصل بلا اختيار طالب؛ لكل ورقة: شريط الاسم مقوّمًا ومكبّرًا + الإجابات والنموذج.
   ثم «ربط الأوراق»: المعلم يقرأ الاسم بعينه ويختار الطالب، وتُحفظ الدرجة فورًا.
   الأوراق محفوظة في الجوال (IndexedDB) فلا تضيع بإغلاق التطبيق، ولا تُرفع لأي خادم. */
const OMRDB = {
  db: null,
  open(){ return this.db || (this.db = new Promise((res, rej) => { const q = indexedDB.open('omr_batch', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('sheets', { keyPath:'id' }); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); })); },
  async tx(mode, fn){ try{ const db = await this.open(); return await new Promise((res, rej) => { const t = db.transaction('sheets', mode), st = t.objectStore('sheets'); let out; const r = fn(st); if(r) r.onsuccess = () => { out = r.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); }); }catch(e){ return null; } },
  put(s){ return this.tx('readwrite', st => st.put(s)); },
  del(id){ return this.tx('readwrite', st => st.delete(id)); },
  async all(){ return (await this.tx('readonly', st => st.getAll())) || []; }
};
function omrBatchKey(){ return `${OMRUI.tpl && OMRUI.tpl.id}|${OMRUI.testId}|${OMRUI.cls}`; }
async function omrBatchLoad(){
  // 🧹 الأوراق المرصودة تبقى في الجوال فقط لكشف إعادة تصوير الورقة نفسها: تُحذف إن حُذفت درجتها (من البوابة أو اللوحة)
  // أو مرّ عليها 12 ساعة (صورتها المصححة محفوظة في الخادم) — كانت تبقى فيُطلب حذفها يدويًا كل مرة
  const all = await OMRDB.all(), old = Date.now() - 12 * 3600e3, keep = [];
  for(const s of all){ const tid = String(s.key || '').split('|')[1] || '';
    if(s.saved && (Number(s.at) < old || (s.sid && tid && !exHas(s.sid, tid)))){ await OMRDB.del(s.id); continue; }
    if(s.key === omrBatchKey()) keep.push(s); }
  OMRUI.sheets = keep.sort((a, b) => a.at - b.at);
}
/* شريط الاسم: من خانة «اسم الطالب» في خريطة الإجابة، مقوّمًا عبر التحويل نفسه المستخدم في القراءة */
function omrStudentBox(M){
  const qTop = Math.min(...M.questions.flatMap(q => q.boxes.map(b => b[1])));
  return M.anchors.find(a => a[2] > 150 && a[3] < 16 && a[1] > 30 && a[1] < qTop && a[0] < 30) || [9, 56, 192, 11];
}
function omrNameStrip(r, img, M){
  const b = omrStudentBox(M), dx = (r.dbg && r.dbg.dx) || 0, dy = (r.dbg && r.dbg.dy) || 0;
  const x0 = b[0] + b[2] * 0.36, x1 = b[0] + b[2] + 1, y0 = b[1] - 4, y1 = b[1] + b[3] + 1.5;
  const W = 900, s = W / (x1 - x0), Hh = Math.round((y1 - y0) * s);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
  const out = cv.getContext('2d').createImageData(W, Hh), src = img.data, iw = img.width, ih = img.height;
  const vec = new Array(96 * 12).fill(0), cnt = new Array(96 * 12).fill(0);
  for(let v = 0; v < Hh; v++) for(let u = 0; u < W; u++){
    // الاتجاه العربي: يمين الشريط = يمين الورقة
    const p = OMR.apply(r.H, x0 + u / s + dx, y0 + v / s + dy), px = Math.round(p[0]), py = Math.round(p[1]), o = (v * W + u) * 4;
    if(px < 0 || py < 0 || px >= iw || py >= ih){ out.data[o] = out.data[o+1] = out.data[o+2] = 240; out.data[o+3] = 255; continue; }
    const i = (py * iw + px) * 4; out.data[o] = src[i]; out.data[o+1] = src[i+1]; out.data[o+2] = src[i+2]; out.data[o+3] = 255;
    const k = Math.floor(v / Hh * 12) * 96 + Math.floor(u / W * 96); vec[k] += 0.299 * src[i] + 0.587 * src[i+1] + 0.114 * src[i+2]; cnt[k]++;
  }
  cv.getContext('2d').putImageData(out, 0, 0);
  return { url: cv.toDataURL('image/jpeg', 0.8), vec: vec.map((v, k) => Math.round(v / (cnt[k] || 1))) };
}
/* نفس الورقة مرتين؟ إجابات شبه متطابقة + شريط اسم شبه متطابق (طالبان بدرجة كاملة لا يُعدّان تكرارًا) */
/* 🧾 أوراق الأسماء: الرمز المقروء ← الطالب. نفس البصمة التي تطبعها اللوحة (omrStuHash)، والمطابقة من قائمة الفصل
   الحالي فقط؛ تطابق واحد بالضبط وإلا لا ربط تلقائي */
function omrStuHash(salt, id){ let h = 0x811c9dc5; const s = salt + ':' + id; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0) & 0xffff; }
function omrStudentOf(bits){
  if(!bits || bits.length !== 20 || bits.reduce((t, x) => t + x, 0) % 2) return null;      // التكافؤ: مربع واحد مقروء خطأ ⇒ لا ربط
  let h = 0; for(let i = 0; i < 16; i++) h |= bits[i] << i;
  const salt = bits[16] | (bits[17] << 1) | (bits[18] << 2);
  // الفصل المختار أولًا، ثم كل الطلاب (ورقة من فصل آخر في الدفعة)
  for(const L of [list(OMRUI.cls), list('')]){ const m = L.filter(x => omrStuHash(salt, x.id) === h); if(m.length === 1) return m[0]; if(m.length > 1) return null; }
  return null;
}
/* 🧾 بصمة الورقة: امتلاء كل مربع (مقيس نسبةً لإضاءة الورق حوله، فلا يتأثر بالظل ولا الزاوية).
   الورقة نفسها مصوّرة مرتين ⇒ 0–2 مربعات تختلف؛ ورقة طالب آخر ⇒ 5 فأكثر ولو اختار الإجابات نفسها
   (خط كل طالب وطريقة تظليله تختلف). شريط الاسم لا يُعتمد: يتغير مع الإضاءة. */
function omrPageVec(r){ return r.answers.flatMap(a => (a.fills || []).map(f => Math.round(f * 100))); }
function omrPvDiff(a, b){ if(!a || !b || a.length !== b.length) return 999; let n = 0; for(let i = 0; i < a.length; i++) if(Math.abs(a[i] - b[i]) > 12) n++; return n; }
function omrStripDiff(a, b){ if(!a || !b || a.length !== b.length) return 999; let n = 0; for(let i = 0; i < a.length; i++) if(Math.abs(a[i] - b[i]) > 28) n++; return n; }
const OMR_PV_SAME = 2, OMR_NAME_SAME = 3;     // الاسم: للأوراق القديمة في الدفعة (قبل البصمة) فقط
function omrIsDup(sh){
  return OMRUI.sheets.find(o => {
    if(o.sid && sh.sid) return String(o.sid) === String(sh.sid);        // 🧾 ورقتا أسماء: رمز الطالب يحسم — طالبان مختلفان ليسا تكرارًا ولو تشابهت الإجابات (أو كانتا فارغتين)
    if(o.model !== sh.model) return false;
    const diff = o.answers.reduce((n, a, i) => n + (a.status === 'ok' && sh.answers[i].status === 'ok' && a.pick !== sh.answers[i].pick ? 1 : 0), 0);
    if(diff >= 1) return false;
    if(o.pv && sh.pv) return omrPvDiff(o.pv, sh.pv) <= OMR_PV_SAME;     // امتلاء المربعات نفسه = علامات القلم نفسها
    if(!o.vec || o.vec.length !== sh.vec.length) return false;
    // الاسم جزء صغير من الشريط: متوسط الشريط لا يميّز اسمين. نعدّ الخلايا المختلفة بوضوح (حبر هنا لا هناك)
    return omrStripDiff(o.vec, sh.vec) <= OMR_NAME_SAME;
  });
}
/* 📄📄 الصفحة التالية تُضم لآخر ورقة في الدفعة تنتظرها (التصوير بالترتيب: ١ ثم ٢ لكل طالب) */
function omrPageTarget(page){ const S = (OMRUI.sheets || []).filter(s => !s.saved && s.answers.some(a => a.status === 'nopage' && (!page || a.pg === page))); return S.length ? S[S.length - 1] : null; }
function omrPagePlaceholders(M, from){ let i = from; return (M.more || []).flatMap(pg => pg.questions.map(q => ({ i: i++, t: q.t, key: q.key, status: 'nopage', pick: -1, final: null, pg: pg.page, boxes: null }))); }
function omrBatchAddPage(r, c, sig){
  const sh = omrPageTarget(r.page), st = $('omr-status');
  if(!sh){ omrBeep(false); if(st) st.textContent = OMR_MSG.page_alone; if(OMRUI.stream){ OMRUI.waitSwap = true; OMRUI.savedSig = sig; } return; }
  const k = Math.min(1, 1100 / Math.max(c.width, c.height)), sm = document.createElement('canvas');
  sm.width = Math.round(c.width * k); sm.height = Math.round(c.height * k); sm.getContext('2d').drawImage(c, 0, 0, sm.width, sm.height);
  sh.pages = sh.pages || {}; sh.pages[r.page] = { H: r.H, fs: k, img: sm.toDataURL('image/jpeg', 0.6) };
  let j = 0; sh.answers = sh.answers.map(a => { if(a.status !== 'nopage' || a.pg !== r.page) return a; const b = r.answers[j++]; if(!b) return a;
    const x = { i: a.i, t: b.t, key: b.key, status: b.status, pick: b.pick, ...(b.alt >= 0 ? { alt: b.alt } : {}), boxes: b.boxes, pg: r.page, ...(Array.isArray(b.fills) ? { fills: b.fills } : {}) }; x.final = omrFinalOf(x); return x; });
  OMRDB.put(sh); omrBeep(true); omrBatchCounter();
  const who = sh.sid ? list('').find(x => String(x.id) === String(sh.sid)) : null;
  if(st) st.textContent = `✓ الصفحة ${r.page} ضُمّت إلى ${who ? who.name : 'الورقة ' + (OMRUI.sheets.indexOf(sh) + 1)} — ضع الورقة التالية`;
  if(sh.autoSave && !sh.answers.some(a => a.final === null)) omrAutoSave(sh);
  if(OMRUI.stream){ OMRUI.waitSwap = true; OMRUI.savedSig = sig; if(OMRUI.scanMode) omrScanPause(sh, false); }
}
function omrBatchAdd(r, c, img, sig, single){
  if(r.page > 1) return omrBatchAddPage(r, c, sig);
  const M = OMRUI.tpl.models[OMRUI.model], strip = omrNameStrip(r, img, M);
  const k = Math.min(1, 1100 / Math.max(c.width, c.height)), sm = document.createElement('canvas');
  sm.width = Math.round(c.width * k); sm.height = Math.round(c.height * k); sm.getContext('2d').drawImage(c, 0, 0, sm.width, sm.height);
  const sh = { id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), key: omrBatchKey(), at: Date.now(), model: OMRUI.model,
    answers: r.answers.map(a => ({ i: a.i, t: a.t, key: a.key, status: a.status, pick: a.pick, ...(a.alt >= 0 ? { alt: a.alt } : {}), final: omrFinalOf(a), boxes: a.boxes, ...(Array.isArray(a.fills) ? { fills: a.fills } : {}) })).concat(omrPagePlaceholders(M, r.answers.length)),
    H: r.H, fs: k, img: sm.toDataURL('image/jpeg', 0.6), name: strip.url, vec: strip.vec, pv: omrPageVec(r), sid: null, saved: false };
  const who = omrStudentOf(r.scode); if(who){ sh.sid = who.id; sh.autoSid = true; }      // 🧾 ورقة باسمه: رُبطت وحدها
  else if(M.scode) sh.noCode = true;                                                  // اختبار بأوراق أسماء لكن الرمز لم يُقرأ
  sh.autoSave = !!(who && OMRUI.cfg && OMRUI.cfg.autoSave);
  const st = $('omr-status');
  OMRUI.lastPv = { pv: sh.pv, vec: sh.vec };
  if(omrIsDup(sh)){
    // تبدو نفس ورقة مضافة: لا تُضاف تلقائيًا، لكن المعلم يرى الصورة ويقدر يضيفها بلمسة إن كانت ورقة أخرى
    OMRUI.dupN = (OMRUI.dupN || 0) + 1; OMRUI.dupSheet = sh; omrBeep(false);
    if(OMRUI.stream && OMRUI.scanMode){ OMRUI.waitSwap = true; OMRUI.savedSig = sig; omrScanPause(sh, true); return; }
    if(OMRUI.stream){ OMRUI.waitSwap = true; OMRUI.savedSig = sig; if(st) st.textContent = 'تبدو نفس ورقة مصوّرة — ضع الورقة التالية فوقها'; $('omr-result').innerHTML = omrBatchMini(sh, true); omrBatchCardDraw(sh); return; }
    if(single) omrBatchAfterSingle(true, sh);
    return;
  }
  OMRUI.dupSheet = null; OMRUI.sheets.push(sh); OMRDB.put(sh); omrBeep(true);
  if(sh.autoSave) omrAutoSave(sh);
  omrBatchCounter();
  if(OMRUI.stream && OMRUI.scanMode){ OMRUI.waitSwap = true; OMRUI.savedSig = sig; omrScanPause(sh, false); return; }
  if(OMRUI.stream){ OMRUI.waitSwap = true; OMRUI.savedSig = sig; if(st) st.textContent = `✓ الورقة ${OMRUI.sheets.length} في الدفعة — ضع الورقة التالية فوقها`; $('omr-result').innerHTML = omrBatchMini(sh); omrBatchCardDraw(sh); return; }
  if(single) omrBatchAfterSingle(false, sh);
}
/* 📄 الماسح: بعد كل ورقة تظهر صفحتها المقوّمة كاملة وعليها ما قُرئ، ثم «مسح التالية» (الكاميرا تبقى مفتوحة) */
function omrScanPause(sh, dup){
  omrStopLoop(); omrCamVisible(false);
  const n = OMRUI.sheets.length, st = $('omr-status');
  if(st) st.textContent = dup ? '⚠️ تبدو نفس ورقة مصوّرة — لم تُضف' : `✓ مُسحت الورقة ${n}`;
  const acts = `${dup ? `<button class="btn ghost omr-big2" type="button" onclick="omrBatchForce()">➕ ورقة طالب آخر — أضفها</button>` : ''}
    <button class="btn primary omr-big" type="button" onclick="omrScanNext()">📄 مسح الورقة التالية<small>في الدفعة ${n} ${n === 1 ? 'ورقة' : 'أوراق'}</small></button>
    ${n ? `<button class="btn ghost omr-big2" type="button" onclick="omrMatch()">✅ انتهيت — راجع واربط الأوراق (${n})</button>` : ''}`;
  $('omr-result').innerHTML = omrBatchCard(sh, acts, dup); omrBatchCardDraw(sh);
  try{ $('omr-body').scrollTop = 0; }catch(e){}
}
function omrScanNext(){ $('omr-result').innerHTML = ''; OMRUI.dupSheet = null; omrStartLoop(); }
/* 🔔 تأكيد بلا نظر للشاشة (الجوال مثبّت والمعلم يبدّل الأوراق): نغمة عالية = أُضيفت، منخفضة = مكررة */
function omrBeep(ok){
  if(OMRUI.cfg && OMRUI.cfg.beep === false) return;
  try{ if(navigator.vibrate) navigator.vibrate(ok ? 60 : [40, 60, 40]); }catch(e){}
  try{ const A = OMRUI.ac; if(!A) return; if(A.resume) A.resume();
    const o = A.createOscillator(), g = A.createGain(); o.frequency.value = ok ? 880 : 300; g.gain.setValueAtTime(0.09, A.currentTime); g.gain.exponentialRampToValueAtTime(0.001, A.currentTime + (ok ? 0.16 : 0.3));
    o.connect(g); g.connect(A.destination); o.start(); o.stop(A.currentTime + (ok ? 0.16 : 0.3)); }catch(e){}
}
/* ➕ ليست نفس الورقة (طالبان بالإجابات نفسها ولا اسم مكتوب): أضفها رغم التشابه */
function omrBatchForce(){
  const sh = OMRUI.dupSheet; if(!sh) return; OMRUI.dupSheet = null;
  if(!OMRUI.sheets.some(x => x.id === sh.id)){ OMRUI.sheets.push(sh); OMRDB.put(sh); }
  omrBatchCounter(); omrBeep(true);
  const st = $('omr-status'); if(st) st.textContent = `✓ أُضيفت — الورقة ${OMRUI.sheets.length} في الدفعة`;
  if(OMRUI.stream && OMRUI.scanMode) omrScanPause(sh, false);
  else if(OMRUI.stream){ $('omr-result').innerHTML = omrBatchMini(sh); omrBatchCardDraw(sh); }
  else omrBatchAfterSingle(false, sh);
}
/* بطاقة مصغّرة تحت الكاميرا: الكاميرا تبقى ظاهرة كاملة أثناء تبديل الأوراق */
function omrWhoLine(sh){ const w = sh.sid ? list('').find(x => String(x.id) === String(sh.sid)) : null; return w ? `<span class="omr-who">🧾 ${esc(w.name)}</span>` : ''; }
function omrBatchMini(sh, dup, id = 'omr-bimg'){
  const A = sh.answers, P = omrPts(A, sh.model ?? OMRUI.model);
  const pend = A.filter(a => a.final === null).length;
  return `<div class="omr-mini ${dup ? 'dup' : ''}" id="mini-${sh.id}"><canvas class="omr-mthumb" id="${id}" onclick="omrBatchCardFull('${id}')" aria-label="صورة الورقة — اضغط للتكبير"></canvas>
    <div class="omr-minfo">${dup ? `<b>⚠️ تبدو نفس ورقة مصوّرة — لم تُضف</b><small>إن كانت ورقة طالب آخر أضفها:</small>
        <button class="btn primary" type="button" onclick="omrBatchForce()">➕ ورقة أخرى — أضفها</button>`
      : `<b>✓ الورقة ${OMRUI.sheets.indexOf(sh) + 1}: ${P.ok} من ${P.max}${pend ? ' مبدئيًا' : ''}</b>${omrWhoLine(sh)}
        <small>${pend ? `⚠️ ${pend} غير ${pend === 1 ? 'واضح' : 'واضحة'} — تُحسم عند الربط` : 'كل الإجابات واضحة'} · اضغط الصورة لتكبيرها</small>
        <button class="btn ghost" type="button" onclick="omrBatchUndo('${sh.id}')">🗑 غير صحيحة؟ احذفها</button>`}</div></div>`;
}
/* 👀 ما قرأه الجوال من الورقة المضافة: الصورة نفسها وعليها المربع الذي اختاره الطالب في كل سؤال، وإجاباته بالأرقام —
   ليتأكد المعلم أن التصوير صحيح قبل الورقة التالية (كان يظهر «أُضيفت» فقط) */
function omrBatchCard(sh, actions, dup){
  const L = ['أ','ب','ج','د','هـ','و'], A = sh.answers;
  const pend = A.filter(a => a.final === null).length, P = omrPts(A, sh.model ?? OMRUI.model);
  return `<div class="omr-res omr-bcard">
    <div class="omr-bhead"><b>${dup ? '⚠️ تبدو نفس ورقة مصوّرة من قبل — لم تُضف' : `الورقة ${OMRUI.sheets.indexOf(sh) + 1}: ${P.ok} من ${P.max}${pend ? ' مبدئيًا' : ''}`}</b>
      ${dup ? '' : omrWhoLine(sh)}<small>${dup ? 'إن كانت ورقة طالب آخر (نفس الإجابات ونفس طريقة التظليل) اضغط «➕ أضفها» تحت' : pend ? `⚠️ ${pend} ${pend === 1 ? 'سؤال غير واضح' : 'أسئلة غير واضحة'} — تحسمها عند ربط الأسماء` : '✓ كل الإجابات واضحة'}</small></div>
    <canvas class="omr-bimg" id="omr-bimg" onclick="omrBatchCardFull()" aria-label="صورة الورقة وعليها ما قُرئ"></canvas>
    <div class="omr-blegend"><span><i style="background:#16A34A"></i>صحيحة</span><span><i style="background:#DC2626"></i>خاطئة</span><span><i style="background:#F59E0B"></i>تحتاج تأكيدك</span><span>اضغط الصورة لتكبيرها</span></div>
    <div class="omr-qs">${A.map((a, i) => { const st = a.final === null ? 'rev' : a.final === a.key ? 'ok' : 'no';
      const lab = a.final === null ? '?' : a.final === -2 ? 'مزدوجة' : a.final === -1 ? 'فارغ' : a.t === 'tf' ? (a.final === 0 ? 'صح' : 'خطأ') : a.t === 'mt' ? String(a.final + 1) : L[a.final];
      return `<span class="omr-q ${st}"><i>${i + 1}</i>${lab}</span>`; }).join('')}</div>
    ${actions || ''}
    ${dup ? '' : `<button class="btn ghost" type="button" onclick="omrBatchUndo('${sh.id}')">🗑 الصورة غير صحيحة — احذفها وأعد التصوير</button>`}</div>`;
}
function omrBatchCardDraw(sh, id = 'omr-bimg'){
  const cv = $(id); if(!cv) return;
  const im = new Image(); im.onload = () => {
    // قصّ الصورة على الورقة وحدها (المربعات أكبر وأوضح)
    const PG = [[0, 0], [210, 0], [210, 297], [0, 297]].map(([X, Y]) => OMR.apply(sh.H, X, Y).map(v => v * sh.fs));
    const pad = 8, x0 = Math.max(0, Math.min(...PG.map(p => p[0])) - pad), y0 = Math.max(0, Math.min(...PG.map(p => p[1])) - pad);
    const x1 = Math.min(im.naturalWidth, Math.max(...PG.map(p => p[0])) + pad), y1 = Math.min(im.naturalHeight, Math.max(...PG.map(p => p[1])) + pad);
    const ok = x1 - x0 > 50 && y1 - y0 > 50, ox = ok ? x0 : 0, oy = ok ? y0 : 0;
    cv.width = Math.round(ok ? x1 - x0 : im.naturalWidth); cv.height = Math.round(ok ? y1 - y0 : im.naturalHeight);
    const x = cv.getContext('2d'); x.drawImage(im, -ox, -oy);
    const P = (X, Y) => OMR.apply(sh.H, X, Y).map((v, j) => v * sh.fs - (j ? oy : ox));
    sh.answers.forEach(a => { if(!a.boxes || a.pg > 1) return;                     // أسئلة الصفحات التالية ليست على صورة الصفحة الأولى
      const show = a.final === null || a.final === -2 ? (a.pick >= 0 ? [a.pick].concat(a.alt >= 0 ? [a.alt] : []) : a.boxes.map((_, k) => k)) : a.final >= 0 ? [a.final] : [];
      const col = a.final === null ? '#F59E0B' : a.final === a.key ? '#16A34A' : '#DC2626';
      x.setLineDash(a.final === null && a.pick < 0 ? [5, 4] : []);                 // فارغ: إطار متقطع خفيف
      show.forEach(k => { const b = a.boxes[k]; if(!b) return; const [bx, by, bw, bh] = b.r, m = 1.1;
        const q = [P(bx + b.dx - m, by + b.dy - m), P(bx + bw + b.dx + m, by + b.dy - m), P(bx + bw + b.dx + m, by + bh + b.dy + m), P(bx + b.dx - m, by + bh + b.dy + m)];
        x.lineWidth = Math.max(2, cv.width / 260); x.strokeStyle = col; x.beginPath(); q.forEach((p, j) => j ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.stroke(); });
      // الإجابة الصحيحة حين أخطأ الطالب: إطار متقطع أخضر
      x.setLineDash([]);
      if(a.final !== null && a.final !== a.key && a.boxes[a.key]){ const b = a.boxes[a.key], [bx, by, bw, bh] = b.r, m = 1.1;
        const q = [P(bx + b.dx - m, by + b.dy - m), P(bx + bw + b.dx + m, by + b.dy - m), P(bx + bw + b.dx + m, by + bh + b.dy + m), P(bx + b.dx - m, by + bh + b.dy + m)];
        x.setLineDash([6, 5]); x.strokeStyle = '#16A34A'; x.beginPath(); q.forEach((p, j) => j ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.stroke(); x.setLineDash([]); }
    });
  };
  im.src = sh.img;
}
function omrBatchCardFull(id = 'omr-bimg'){
  const cv = $(id); if(!cv || !cv.width) return;
  const o = document.createElement('div'); o.className = 'omr-full'; o.onclick = () => o.remove();
  o.innerHTML = `<img src="${cv.toDataURL('image/jpeg', 0.85)}" alt=""><span>اضغط للإغلاق</span>`; document.body.appendChild(o);
}
async function omrBatchUndo(id){
  OMRUI.sheets = OMRUI.sheets.filter(x => x.id !== id); try{ OMRDB.del(id); }catch(e){}
  omrBatchCounter();
  const n = OMRUI.sheets.length;
  // قائمة صفحات ملف المسح: نحذف بطاقة الصفحة وحدها وتبقى البقية
  const card = $('mini-' + id); if(card && !OMRUI.stream && document.querySelectorAll('#omr-result .omr-mini').length > 1){ card.remove(); $('omr-status').textContent = `حُذفت — في الدفعة ${n} ${n===1?'ورقة':'أوراق'}`; return; }
  $('omr-status').textContent = 'حُذفت — صوّر الورقة من جديد';
  if(OMRUI.stream){ OMRUI.waitSwap = false; OMRUI.savedSig = null; OMRUI.lastPv = null; OMRUI.last = null; OMRUI.stable = 0; $('omr-result').innerHTML = ''; if(OMRUI.scanMode) omrStartLoop(); return; }
  $('omr-result').innerHTML = `<div class="omr-res omr-dark">${omrShootBtn('📸 صوّر الورقة من جديد', `في الدفعة ${n} ${n===1?'ورقة':'أوراق'}`)}
    ${n ? `<button class="btn ghost omr-big2" type="button" onclick="omrMatch()">🔗 ربط الأوراق بالطلاب (${n})</button>` : ''}</div>`;
}
function omrBatchAfterSingle(dup, sh){
  if(OMRUI.queue && OMRUI.queue.length && !OMRUI.photoMode){ OMRUI.qi++; omrQueueNext(); return; }   // ملف PDF: الصفحة التالية مباشرة
  const n = OMRUI.sheets.length;
  $('omr-status').textContent = dup ? '⚠️ تبدو نفس ورقة مصوّرة — لم تُضف' : `✓ أُضيفت الورقة ${n}`;
  const acts = `${dup ? `<button class="btn ghost omr-big2" type="button" onclick="omrBatchForce()">➕ ورقة طالب آخر — أضفها</button>` : ''}${omrShootBtn('📸 الورقة التالية', `في الدفعة ${n} ${n===1?'ورقة':'أوراق'}`)}
    ${n ? `<button class="btn ghost omr-big2" type="button" onclick="omrMatch()">🔗 ربط الأوراق بالطلاب (${n})</button>` : ''}`;
  $('omr-result').innerHTML = sh ? omrBatchCard(sh, acts, dup) : `<div class="omr-res omr-dark">${acts}</div>`;
  if(sh) omrBatchCardDraw(sh);
  OMRUI.queue = [];
}
function omrBatchCounter(){
  const b = $('omr-match-btn'), n = OMRUI.sheets.length, left = OMRUI.sheets.filter(s => !s.saved).length;
  if(b){ b.style.display = n ? '' : 'none'; b.textContent = left ? `🔗 ربط الأوراق بالطلاب (${left}${left === n ? '' : ' من ' + n})` : `✓ الأوراق المرصودة (${n})`; }
  const am = $('omr-act-match'); if(am){ am.style.display = OMRUI.batch && n ? '' : 'none'; am.textContent = `✅ انتهيت — راجع واربط الأوراق (${n})`; }
}
/* ——— شاشة الربط ——— */
function omrNorm(s){ return String(s||'').replace(/[أإآا]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[ًٌٍَُِّْـ]/g,'').replace(/\s+/g,' ').trim(); }
async function omrMatch(){
  omrStopCamera(); OMRUI.queue = []; OMRUI.photoMode = false;
  if(!OMRUI.sheets) await omrBatchLoad();
  OMRUI.openId = (OMRUI.sheets.find(s => !s.saved) || {}).id || null;
  omrMatchRender();
}
function omrSheetScore(s){
  const tt = omrTotals(s.model), raw = omrPts(s.answers, s.model).ok;
  const needMan = omrManualMax(s.model) > 0, manOk = omrManualOk(s.manual, s.model);
  return { raw, auto: tt.auto, total: tt.total, pending: s.answers.filter(a => a.final === null).length,
    needMan, manOk, full: +(raw + (needMan && manOk ? Number(s.manual) : 0)).toFixed(2) };
}
function omrSheetManual(id, v){ const s = OMRUI.sheets.find(x => x.id === id); if(!s) return; s.manual = v; OMRDB.put(s); }
function omrMatchRender(){
  const S = OMRUI.sheets, done = S.filter(s => s.saved).length, T = OMRUI.tpl;
  const used = new Set(S.filter(s => s.sid).map(s => String(s.sid)));
  const order = S.slice().sort((a, b) => (a.saved - b.saved) || (a.at - b.at));
  $('omr-body').innerHTML = `
    <div class="omr-mhead"><b>🔗 ربط الأوراق</b><span>${done} من ${S.length} محفوظة</span></div>
    ${(() => { const rd = S.filter(x => !x.saved && x.sid && !x.answers.some(a => a.final === null) && omrManualOk(x.manual, x.model)).length;
      return rd ? `<button class="btn primary wide omr-saveall" type="button" onclick="omrSaveReady()">💾 حفظ الأوراق المربوطة المكتملة (${rd})</button>` : ''; })()}
    ${(() => { const n = S.filter(x => !x.saved).reduce((t, x) => t + x.answers.filter(a => a.final === null && a.status !== 'nopage').length, 0);
      return n ? `<button class="btn wide omr-revbtn" type="button" onclick="omrRevOpen()">🔍 مراجعة المعلّق (${n}) — سؤالًا سؤالًا في شاشة واحدة</button>` : ''; })()}
    <div class="omr-row"><button class="btn ghost" type="button" onclick="omrBackToCapture()">➕ تصوير المزيد</button>
      <button class="btn ghost" type="button" onclick="omrBatchClear()">${done===S.length && S.length ? '✓ إنهاء وحذف الصور' : '🗑️ حذف الدفعة'}</button></div>
    ${S.length ? '' : '<p class="omr-note" style="text-align:center;margin-top:18px">لا أوراق بعد — صوّر أوراق الفصل أولًا.</p>'}
    ${S.length && !T.models.some(m => m.scode) ? '<p class="omr-note omr-hintline">🧾 للربط بالاسم تلقائيًا: في لوحة التحكم فعّل «ورقة باسم كل طالب» ثم اطبع «أوراق الأسماء» — هذا الاختبار جُهّز بدونها.</p>' : ''}
    <div class="omr-mlist">${order.map(s => {
      const sc = omrSheetScore(s), who = s.sid ? list('').find(x => String(x.id) === String(s.sid)) : null, open = OMRUI.openId === s.id;
      const ml = T.models.length > 1 ? ` · نموذج (${esc(T.models[s.model].letter || s.model+1)})` : '';
      return `<div class="omr-mc${s.saved ? ' saved' : ''}${open ? ' open' : ''}" id="mc-${s.id}">
        <button type="button" class="omr-mtop" onclick="omrMatchOpen('${s.id}')">
          <img class="omr-name" src="${s.name}" alt="شريط الاسم">
          <span class="omr-mline"><b>${sc.pending ? '؟' : sc.raw}</b> / ${sc.auto}${sc.needMan ? (sc.manOk ? ` + ✍️ ${Number(s.manual)} = <b>${sc.full}</b> / ${sc.total}` : ` · <i class="omr-pend">✍️ الجزء اليدوي</i>`) : ''}${ml}${s.answers.some(a => a.status === 'nopage') ? ` · <i class="omr-pend">📄 صفحة ناقصة</i>` : ''}${sc.pending - s.answers.filter(a => a.status === 'nopage').length > 0 ? ` · <i class="omr-pend">⚠️ ${sc.pending - s.answers.filter(a => a.status === 'nopage').length} للتأكيد</i>` : ''}${s.saved ? ` · <i class="omr-ok">✓ ${esc(who ? who.name : '')}</i>` : who ? ` · ${s.autoSid ? '🧾 ' : ''}${esc(who.name)}` : s.noCode ? ' · <i class="omr-pend">🧾 رمز الاسم لم يُقرأ — اختر الطالب</i>' : ''}</span>
        </button>
        ${open && !s.saved ? omrMatchBody(s, used) : ''}
      </div>`; }).join('')}</div>`;
  const s = S.find(x => x.id === OMRUI.openId && !x.saved);
  if(s){ s.answers.forEach((a, i) => { if(a.final === null) omrSheetCrop(s, i); }); const q = $('omr-q'); if(q && !s.answers.some(a => a.final === null)) q.focus({ preventScroll:true }); }
}
function omrMatchBody(s, used){
  const L = ['أ','ب','ج','د','هـ','و'], M = OMRUI.tpl.models[s.model];
  const why = { multi:'مربعان معلّمان', faint:'علامة باهتة', blank:'لم يُعلَّم شيء', unaligned:'لم يتضح المربع', glare:'لمعة ضوء فوقه' };
  const pend = s.answers.map((a, i) => ({ a, i })).filter(x => x.a.final === null && x.a.status !== 'nopage');
  const missP = [...new Set(s.answers.filter(a => a.status === 'nopage').map(a => a.pg))];
  const b = examBook();
  // الفصل المختار أولًا؛ وطلاب الفصول الأخرى مخفيون ويظهرون بالبحث (ورقة طالب من فصل آخر في الدفعة)، والمربوط من فصل آخر ظاهر دائمًا
  const free = x => !used.has(String(x.id)) || String(x.id) === String(s.sid);
  const studs = list(OMRUI.cls).filter(free).concat(OMRUI.cls ? list('').filter(x => x.cls !== OMRUI.cls && free(x)).map(x => ({ ...x, other: true })) : []);
  return `<div class="omr-mbody">
    ${missP.map(pg => `<div class="omr-fixbox omr-misspg"><b>📄 الصفحة ${pg} لم تُصوَّر</b><small class="omr-qtxt">صوّرها الآن («➕ تصوير المزيد») فتُضم لهذه الورقة، أو احسبها بلا إجابة إن لم يحلّها الطالب.</small>
      <div class="omr-opts"><button type="button" class="btn ghost" onclick="omrPageBlank('${s.id}',${pg})">احسب الصفحة ${pg} بلا إجابة</button></div></div>`).join('')}
    ${pend.map(({ a, i }) => { const n = M.questions[i].boxes.length, opts = a.t === 'tf' ? [[0,'صح'],[1,'خطأ']] : Array.from({ length:n }, (_, k) => [k, a.t === 'mt' ? String(k+1) : L[k]]);
      const qt = M.questions[i].q ? esc(String(M.questions[i].q).slice(0, 90)) : '';
      return `<div class="omr-fixbox"><b>السؤال ${i+1} — ${why[a.status] || ''}</b>${qt ? `<small class="omr-qtxt">${qt}</small>` : ''}<div class="omr-crop" id="crop-${s.id}-${i}"></div>
        <div class="omr-opts">${opts.map(([v, l]) => `<button type="button" class="btn ghost" onclick="omrSheetSet('${s.id}',${i},${v})">${l}</button>`).join('')}
        <button type="button" class="btn ghost" onclick="omrSheetSet('${s.id}',${i},-1)">فارغ</button></div></div>`; }).join('')}
    ${omrManualHTML('man-' + s.id, s.manual ?? '', s.model, `omrSheetManual('${s.id}',this.value)`)}
    ${omrManualMax(s.model) && s.sid ? `<button type="button" class="btn primary" onclick="omrMatchPick('${s.id}','${esc(String(s.sid))}')">💾 حفظ الدرجة كاملة</button>` : ''}
    <input class="inp omr-q" id="omr-q" placeholder="ابحث باسم الطالب…" oninput="omrMatchFilter('${s.id}')" autocomplete="off">
    <div class="omr-slist" id="omr-slist">${studs.map(x => { const has = exHas(x.id, OMRUI.testId);
      const on = String(x.id) === String(s.sid);
      return `<button type="button" class="omr-sbtn${on ? ' on' : ''}${x.other ? ' oth' : ''}" data-n="${esc(omrNorm(x.name))}"${x.other && !on ? ' style="display:none"' : ''} onclick="omrMatchPick('${s.id}','${esc(x.id)}')">${esc(x.name)}${x.other ? ` <small>· ${esc(x.cls || '')}</small>` : ''}${has ? ' <small>· مرصود</small>' : ''}</button>`; }).join('')}</div>
    ${OMRUI.cls ? '<small class="omr-note" style="display:block;margin-top:4px">طالب من فصل آخر؟ اكتب اسمه في البحث.</small>' : ''}
    <div class="omr-row"><button class="btn ghost" type="button" onclick="omrSheetView('${s.id}')">🖼️ الورقة كاملة</button>
      <button class="btn ghost" type="button" onclick="omrSheetDelete('${s.id}')">🗑️ حذف الورقة</button></div>
  </div>`;
}
/* 🔍 مراجعة المعلّق: كل الأسئلة غير المحسومة في الدفعة، واحدًا واحدًا — المقترح بالأخضر، والضغط يحسمه وينتقل للتالي.
   الورقة التي اكتملت وهي مربوطة بطالب تُرصد فورًا كما في «ربط الأوراق» */
const OMRQ = { items:[], pos:0, hist:[] };
const OMR_WHY = { multi:'☑️☑️ تظليل خيارين', faint:'✏️ تظليل باهت', blank:'⬜ لم يُعلَّم شيء', unaligned:'🔲 لم يتضح المربع', glare:'✨ لمعة ضوء فوقه' };
function omrRevItems(){ const out = []; OMRUI.sheets.filter(s => !s.saved).sort((a, b) => a.at - b.at).forEach(s => s.answers.forEach((a, i) => { if(a.final === null && a.status !== 'nopage') out.push({ id:s.id, i }); })); return out; }
function omrRevOpen(){ OMRQ.items = omrRevItems(); OMRQ.pos = 0; OMRQ.hist = []; OMRQ.total = OMRQ.items.length; if(!OMRQ.items.length){ omrMatchRender(); return; } omrRevRender(); }
function omrRevRender(){
  const it = OMRQ.items[0], body = $('omr-body'); if(!body) return;
  if(!it){ omrMatchRender(); toast('✓ حُسمت كل الأسئلة المعلّقة'); return; }
  const s = OMRUI.sheets.find(x => x.id === it.id), a = s && s.answers[it.i]; if(!s || !a || a.final !== null){ OMRQ.items.shift(); return omrRevRender(); }
  const L = ['أ','ب','ج','د','هـ','و'], M = OMRUI.tpl.models[s.model], n = M.questions[it.i].boxes.length;
  const opts = a.t === 'tf' ? [[0,'صح'],[1,'خطأ']] : Array.from({ length:n }, (_, k) => [k, a.t === 'mt' ? String(k + 1) : L[k]]);
  // المقترح: الباهت/اللمعة = ما قُرئ؛ «لم يُعلَّم» = أثر خفيف جدًا إن تميّز مربع عن البقية بوضوح، وإلا «فارغ»؛ المزدوجة: لا اقتراح
  const trace = (() => { if(a.status !== 'blank' || !Array.isArray(a.fills)) return -1; const o = a.fills.map((v, k) => [v, k]).sort((x, y) => y[0] - x[0]);
    return o[0][0] >= 0.02 && o[0][0] >= 2 * Math.max(0.004, (o[1] || [0])[0]) ? o[0][1] : -1; })();
  const sug = a.status === 'faint' || a.status === 'glare' || a.status === 'unaligned' ? a.pick : a.status === 'blank' ? (trace >= 0 ? trace : -1) : -9;
  const who = s.sid ? list('').find(x => String(x.id) === String(s.sid)) : null, no = OMRUI.sheets.indexOf(s) + 1;
  const done = OMRQ.total - OMRQ.items.length, qt = M.questions[it.i].q ? esc(String(M.questions[it.i].q).slice(0, 110)) : '';
  const next = OMRQ.items.slice(1, 3).map(x => { const ss = OMRUI.sheets.find(y => y.id === x.id), aa = ss && ss.answers[x.i], w = ss && ss.sid ? list('').find(y => String(y.id) === String(ss.sid)) : null;
    return aa ? `<div class="omr-rnext"><div class="omr-crop" id="rq-${x.id}-${x.i}"></div><small>${esc(w ? w.name : 'ورقة ' + (OMRUI.sheets.indexOf(ss) + 1))} · س${x.i + 1} · ${OMR_WHY[aa.status] || ''}</small></div>` : ''; }).join('');
  body.innerHTML = `<div class="omr-mhead"><b>🔍 مراجعة المعلّق</b><span>${done + 1} من ${OMRQ.total}</span></div>
    <div class="omr-rprog"><i style="width:${Math.round(done / OMRQ.total * 100)}%"></i></div>
    <div class="omr-fixbox omr-rcur"><div class="omr-rwho"><b>${esc(who ? who.name : 'ورقة ' + no)}</b><span class="omr-rq">س${it.i + 1}</span></div>
      ${qt ? `<small class="omr-qtxt">${qt}</small>` : ''}
      <div class="omr-crop" id="rq-${s.id}-${it.i}"></div>
      <div class="omr-rwhy">${trace >= 0 ? '🔍 أثر خفيف جدًا على مربع واحد — تأكد من الصورة' : (OMR_WHY[a.status] || 'غير واضح')}${sug >= 0 ? ' — المقترح بالأخضر' : ''}</div>
      <div class="omr-opts omr-ropts">${opts.map(([v, l]) => `<button type="button" class="btn ${v === sug ? 'omr-sug' : 'ghost'}" onclick="omrRevSet(${v})">${l}</button>`).join('')}</div>
      <div class="omr-opts"><button type="button" class="btn ${sug === -1 ? 'omr-sug' : 'ghost'}" onclick="omrRevSet(-1)">⬜ فارغ (لم يجب)</button>${a.status === 'multi' ? `<button type="button" class="btn ghost" onclick="omrRevSet(-2)">☑️☑️ إجابتان — خطأ</button>` : ''}</div>
    </div>
    ${next ? `<p class="omr-note" style="margin:10px 2px 4px">التالي:</p>${next}` : ''}
    <div class="omr-row"><button class="btn ghost" type="button" onclick="omrRevBack()" ${OMRQ.hist.length ? '' : 'disabled'}>↩︎ السابق</button><button class="btn ghost" type="button" onclick="omrMatchRender()">✓ إنهاء المراجعة</button></div>`;
  [it, ...OMRQ.items.slice(1, 3)].forEach(x => { const ss = OMRUI.sheets.find(y => y.id === x.id), bx = $(`rq-${x.id}-${x.i}`); if(ss && bx && ss.answers[x.i].boxes){ const pi = omrPageImg(ss, ss.answers[x.i]); omrRowCrop(bx, pi.img, pi.H, pi.fs, ss.answers[x.i], x.i); } });
}
async function omrRevSet(v){
  const it = OMRQ.items[0]; if(!it) return; const s = OMRUI.sheets.find(x => x.id === it.id); if(!s) return;
  s.answers[it.i].final = v; OMRDB.put(s); OMRQ.hist.push(it); OMRQ.items.shift();
  if(s.sid && !s.answers.some(a => a.final === null) && omrManualOk(s.manual, s.model)) await omrSheetSave(s);   // اكتملت الورقة: تُرصد
  omrRevRender();
}
function omrRevBack(){
  const it = OMRQ.hist.pop(); if(!it) return; const s = OMRUI.sheets.find(x => x.id === it.id);
  if(!s || s.saved){ toast('رُصدت هذه الورقة — عدّلها من «ربط الأوراق»'); omrRevRender(); return; }
  s.answers[it.i].final = null; OMRDB.put(s); OMRQ.items.unshift(it); omrRevRender();
}
function omrMatchOpen(id){ OMRUI.openId = OMRUI.openId === id ? null : id; omrMatchRender(); const el = $('mc-' + id); if(el) el.scrollIntoView({ block:'start', behavior:'smooth' }); }
function omrMatchFilter(){ const q = omrNorm($('omr-q').value); document.querySelectorAll('#omr-slist .omr-sbtn').forEach(b => { b.style.display = (q ? b.dataset.n.includes(q) && (!b.classList.contains('oth') || q.length >= 2) : !b.classList.contains('oth') || b.classList.contains('on')) ? '' : 'none'; }); }
function omrSheetSet(id, i, v){ const s = OMRUI.sheets.find(x => x.id === id); if(!s) return; s.answers[i].final = v; OMRDB.put(s); if(s.sid && !s.answers.some(a => a.final === null) && omrManualOk(s.manual, s.model)) omrSheetSave(s); else omrMatchRender(); }
/* 📄 ورقة الطالب المصححة للطالب وولي أمره: الصفحة مقوّمة (A4 مستقيمة) وعليها إطار أخضر/أحمر حول ما اختاره،
   وختم أحمر بالدرجة المرصودة بجانب عنوان الاختبار. الإجابة الصحيحة لا تُرسم: تُحفظ مواقعها فقط وتظهر إن سمح المعلم */
const OMR_AR = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]).replace('.', '٫');
function omrStampDraw(x, kp, val, max){
  const w = 32 * kp, h = 12.5 * kp, cx = 26 * kp, cy = 49.3 * kp;
  const oc = document.createElement('canvas'); oc.width = Math.ceil(w + 8); oc.height = Math.ceil(h + 8);
  const o = oc.getContext('2d'), red = '#C8102E', F = `"Readex Pro",Tajawal,system-ui,sans-serif`;
  o.translate(4, 4); o.strokeStyle = red; o.fillStyle = red; o.lineJoin = 'round';
  const rr = (X, Y, W, H, R) => { o.beginPath(); if(o.roundRect) o.roundRect(X, Y, W, H, R); else o.rect(X, Y, W, H); };
  o.lineWidth = .85 * kp; rr(0, 0, w, h, 1.6 * kp); o.stroke();
  o.lineWidth = .28 * kp; rr(1.3 * kp, 1.3 * kp, w - 2.6 * kp, h - 2.6 * kp, 1 * kp); o.stroke();
  const div = w * .62; o.lineWidth = .35 * kp; o.beginPath(); o.moveTo(div, 2.4 * kp); o.lineTo(div, h - 2.4 * kp); o.stroke();
  o.textAlign = 'center'; o.textBaseline = 'middle';
  o.font = `700 ${3.1 * kp}px ${F}`; o.fillText('الدرجة', (div + w) / 2, h * .38);
  const d = new Date(); o.font = `700 ${1.7 * kp}px ${F}`; o.fillText(OMR_AR(`${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`), (div + w) / 2, h * .72);
  o.font = `700 ${6 * kp}px ${F}`; o.direction = 'rtl'; o.fillText(`${OMR_AR(+(+val).toFixed(2))} / ${OMR_AR(max)}`, div / 2, h * .54);
  // حبر الختم: نقاط فارغة صغيرة وحواف غير منتظمة
  o.globalCompositeOperation = 'destination-out';
  for(let i = 0; i < 120; i++){ o.globalAlpha = .15 + Math.random() * .4; o.beginPath(); o.arc(Math.random() * w, Math.random() * h, (.08 + Math.random() * .22) * kp, 0, 7); o.fill(); }   // خفيفة: لا تُشوّه الأرقام
  x.save(); x.translate(cx, cy); x.rotate(-5 * Math.PI / 180); x.globalAlpha = .9; x.globalCompositeOperation = 'multiply';
  x.drawImage(oc, -oc.width / 2, -oc.height / 2); x.restore();
}
async function omrPaperImage(src, H, fs, answers, val, max){
  const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const sc = document.createElement('canvas'); sc.width = im.naturalWidth; sc.height = im.naturalHeight;
  const sx = sc.getContext('2d', { willReadFrequently:true }); sx.drawImage(im, 0, 0); const S = sx.getImageData(0, 0, sc.width, sc.height).data, sw = sc.width, sh = sc.height;
  const W = 1000, kp = W / 210, Hh = Math.round(297 * kp), out = document.createElement('canvas'); out.width = W; out.height = Hh;
  const x = out.getContext('2d'), D = x.createImageData(W, Hh), d = D.data;
  for(let v = 0; v < Hh; v++) for(let u = 0, o = v * W * 4; u < W; u++, o += 4){
    const p = OMR.apply(H, u / kp, v / kp), X = p[0] * fs, Y = p[1] * fs;
    if(X < 0 || Y < 0 || X >= sw - 1 || Y >= sh - 1){ d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = 255; continue; }
    const x0 = X | 0, y0 = Y | 0, ax = X - x0, ay = Y - y0, i = (y0 * sw + x0) * 4, j = i + sw * 4;
    for(let c = 0; c < 3; c++){ const a = S[i + c] + (S[i + 4 + c] - S[i + c]) * ax, b = S[j + c] + (S[j + 4 + c] - S[j + c]) * ax; d[o + c] = a + (b - a) * ay; }
    d[o + 3] = 255;
  }
  omrWhiten(D);                                                                   // 📄 كالماسح: خلفية بيضاء بلا ظل
  x.putImageData(D, 0, 0);
  const base = out.toDataURL('image/jpeg', .6);
  const qb = answers.map(a => a.pg > 1 ? [] : (a.boxes || []).map(b => [b.r[0] + b.dx, b.r[1] + b.dy, b.r[2], b.r[3]].map(v => +v.toFixed(2))));
  const D2 = omrPaperDraw(x, kp, answers, val, max);
  return { img: out.toDataURL('image/jpeg', .7), marks: D2.marks, keyBoxes: D2.keyBoxes, base, qb };
}
/* 📄 تنظيف الصفحة كماسح المستندات: إضاءة الورق تُقدَّر لكل منطقة (أفتح ما فيها — الورق لا الحبر)، ثم تُقسم الصورة عليها
   فيختفي الظل وتدرّج الإضاءة والصفرة وتبقى الكتابة والتظليل والألوان بقوتها. للعرض والحفظ فقط — القراءة تتم قبل هذا */
function omrWhiten(D){
  const W = D.width, H = D.height, d = D.data, C = 24, gw = Math.ceil(W / C), gh = Math.ceil(H / C);
  // لكل لون (أحمر، أخضر، أزرق) خلفيته: فتزول الصفرة وظل المصباح الملوّن مع الظل نفسه (توازن الأبيض)
  const G = [0, 1, 2].map(() => new Float32Array(gw * gh));
  for(let gy = 0; gy < gh; gy++) for(let gx = 0; gx < gw; gx++){
    const v = [], idx = []; for(let y = gy * C; y < Math.min(H, gy * C + C); y += 3) for(let x = gx * C; x < Math.min(W, gx * C + C); x += 3){ const o = (y * W + x) * 4; v.push(d[o] * .3 + d[o + 1] * .59 + d[o + 2] * .11); idx.push(o); }
    const ord = v.map((_, k) => k).sort((a, b) => v[a] - v[b]), top = ord.slice(Math.floor(ord.length * .8));   // أفتح ٢٠٪: الورق لا الحبر
    for(let c = 0; c < 3; c++){ let t = 0; top.forEach(k => t += d[idx[k] + c]); G[c][gy * gw + gx] = top.length ? t / top.length : 255; }
  }
  // الخلية التي يغلب عليها الحبر أغمق من جيرانها: يُؤخذ أفتح ما حولها، ثم تنعيم
  const smooth = g => { const g2 = new Float32Array(g.length);
    for(let y = 0; y < gh; y++) for(let x = 0; x < gw; x++){ let m = 0; for(let j = -1; j <= 1; j++) for(let i = -1; i <= 1; i++){ const X = x + i, Y = y + j; if(X >= 0 && Y >= 0 && X < gw && Y < gh) m = Math.max(m, g[Y * gw + X]); } g2[y * gw + x] = m; }
    for(let y = 0; y < gh; y++) for(let x = 0; x < gw; x++){ let t = 0, n = 0; for(let j = -1; j <= 1; j++) for(let i = -1; i <= 1; i++){ const X = x + i, Y = y + j; if(X >= 0 && Y >= 0 && X < gw && Y < gh){ t += g2[Y * gw + X]; n++; } } g[y * gw + x] = t / n; } };
  G.forEach(smooth);
  for(let y = 0; y < H; y++){ const fy = Math.min(gh - 1.001, Math.max(0, y / C - .5)), y0 = fy | 0, ay = fy - y0;
    for(let x = 0; x < W; x++){ const fx = Math.min(gw - 1.001, Math.max(0, x / C - .5)), x0 = fx | 0, ax = fx - x0, o = (y * W + x) * 4, a = y0 * gw + x0, b = a + gw;
      for(let c = 0; c < 3; c++){ const g = G[c], b0 = g[a] + (g[a + 1] - g[a]) * ax, b1 = g[b] + (g[b + 1] - g[b]) * ax, bg = Math.max(60, b0 + (b1 - b0) * ay);
        let v = d[o + c] * 250 / bg; v = v >= 238 ? 255 : v; d[o + c] = v > 255 ? 255 : v; } } }
}
/* إطارات الإجابات والختم فوق صفحة مقوّمة (عند الرفع، وعند إعادة التصحيح من الصفحة بلا ختم) */
function omrPaperDraw(x, kp, answers, val, max){
  const marks = [], keyBoxes = [];
  answers.forEach(a => {
    const f = a.final, boxes = a.pg > 1 ? [] : (a.boxes || []);                     // صورة الورقة = الصفحة الأولى: أسئلة التالية بلا إطارات
    marks.push(f === null || f === undefined || f < 0 ? ((f === -1 || f === -2) && a.key >= 0 ? 0 : -1) : f === a.key ? 1 : 0);
    // المزدوجة (−2): إطاران أحمران على الخيارين
    for(const k of f === -2 ? [a.pick, a.alt] : (f !== null && f !== undefined && f >= 0 ? [f] : [])){ const b = boxes[k]; if(!b) continue; const [bx, by, bw, bh] = b.r, m = 1.1;
      x.lineWidth = .5 * kp; x.strokeStyle = k === a.key && f !== -2 ? '#16A34A' : '#DC2626';
      x.strokeRect((bx + b.dx - m) * kp, (by + b.dy - m) * kp, (bw + 2 * m) * kp, (bh + 2 * m) * kp); }
    if(f !== a.key && boxes[a.key]){ const b = boxes[a.key], [bx, by, bw, bh] = b.r;
      keyBoxes.push([(bx + b.dx - 1.1) / 210, (by + b.dy - 1.1) / 297, (bw + 2.2) / 210, (bh + 2.2) / 297]); }
  });
  omrStampDraw(x, kp, val, max);
  return { marks, keyBoxes };
}
/* يُرفع بعد الرصد بلا انتظار: فشل الرفع لا يوقف التصحيح (الدرجة محفوظة أصلًا) */
/* الرفع بالتتابع: عدة أوراق معًا كانت تُرفع بالتوازي فيمحو آخرها فهرس ما سبقه في الخادم (📄 لطالب واحد فقط) */
let OMR_UPQ = Promise.resolve();
function omrUploadPaper(...a){ OMR_UPQ = OMR_UPQ.then(() => omrUploadPaper1(...a)).catch(() => {}); return OMR_UPQ; }
async function omrUploadPaper1(sid, src, H, fs, answers, val, meta){
  try{
    const test = omrTest(); if(!test || !src || !H) return;
    const P = await omrPaperImage(src, H, fs || 1, answers, val, test.max);
    // 🔑 لإعادة التصحيح إن عُدّل مفتاح الإجابة: اختيار الطالب في كل سؤال، ومواقع المربعات، والصفحة بلا ختم ولا إطارات
    const mi = Number(meta && meta.model) || 0, tt = omrTotals(mi);
    const re = { tpl: String(OMRUI.tpl.id || ''), model: mi, ch: answers.map(a => a.final === null || a.final === undefined ? -1 : a.final), pa: answers.map(a => a.final === -2 ? [a.pick, a.alt] : 0), man: Number(meta && meta.man) || 0,
      mark: Number(OMRUI.tpl.mark) || 1, tot: tt.total };
    await fetch(omrApi('/omr/paper'), { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ t: getTok(), sid: String(sid), test: String(OMRUI.testId), title: test.title || 'اختبار', score: val, max: test.max, sem: Number(ctExamSP().sem) || 1, ...P, ...re }) });
    EXPAP.at = 0;                                                                   // تظهر أيقونة 📄 بجانب اسمه في الرصد
  }catch(e){}
}
/* 💾 حفظ كل ورقة مربوطة (من رمز الاسم أو يدويًا) وأسئلتها محسومة — الباقي يبقى للمراجعة */
/* 💾 رصد تلقائي (إعداد في اللوحة): ورقة أسماء عُرف صاحبها وكل أسئلتها محسومة والجزء اليدوي لا يلزم —
   بلا نوافذ ولا استبدال: إن كان للطالب درجة مرصودة تبقى الورقة للمراجعة */
async function omrAutoSave(s){
  try{
    if(s.answers.some(a => a.final === null) || omrManualMax(s.model)) return;
    const test = omrTest(); if(!test) return;
    const b = examBook(); if(exHas(s.sid, OMRUI.testId)) return;
    const sc = omrSheetScore(s), val = Math.abs(sc.total - test.max) > 1e-9 ? +(sc.full / sc.total * test.max).toFixed(2) : sc.full;
    await setExamScore(s.sid, OMRUI.testId, String(val), false, omrWrongOf(s.answers, s.model));
    s.saved = true; OMRDB.put(s); omrBatchCounter();
    omrUploadPaper(s.sid, s.img, s.H, s.fs, s.answers, val, { model: s.model, man: 0 });
    const who = list('').find(x => String(x.id) === String(s.sid)); toast(`💾 رُصدت: ${who ? who.name : ''} ${val} من ${test.max}`);
  }catch(e){}
}
async function omrSaveReady(){
  const R = OMRUI.sheets.filter(x => !x.saved && x.sid && !x.answers.some(a => a.final === null) && omrManualOk(x.manual, x.model));
  for(const s of R) await omrSheetSave(s);
  omrMatchRender();
}
async function omrMatchPick(id, sid){
  const s = OMRUI.sheets.find(x => x.id === id); if(!s) return;
  s.sid = sid; OMRDB.put(s);
  if(s.answers.some(a => a.final === null)){ omrMatchRender(); toast('أكمل الأسئلة الصفراء لتُحفظ الدرجة'); return; }
  if(!omrManualOk(s.manual, s.model)){ omrMatchRender(); toast('اكتب درجة الجزء اليدوي لتُحفظ الدرجة كاملة'); setTimeout(() => $('man-' + s.id)?.focus(), 50); return; }
  await omrSheetSave(s);
}
async function omrSheetSave(s){
  const test = omrTest(); if(!test){ toast('عمود الرصد غير موجود'); return; }
  const sc = omrSheetScore(s);
  if(sc.needMan && !sc.manOk){ toast('اكتب درجة الجزء اليدوي أولًا'); return; }   // لا تُحفظ الدرجة الآلية وحدها كأنها الدرجة كلها
  const val = Math.abs(sc.total - test.max) > 1e-9 ? +(sc.full / sc.total * test.max).toFixed(2) : sc.full;
  const b = examBook(), prev = exHas(s.sid, OMRUI.testId) ? true : undefined;
  if(prev !== undefined && !(await askConfirm('لهذا الطالب درجة مرصودة في هذا الاختبار. استبدالها بهذه الورقة؟', { title:'استبدال الدرجة؟', yes:'استبدل', no:'إلغاء' }))){ s.sid = null; OMRDB.put(s); omrMatchRender(); return; }
  await setExamScore(s.sid, OMRUI.testId, String(val), false, omrWrongOf(s.answers, s.model));
  s.saved = true; OMRDB.put(s);
  omrUploadPaper(s.sid, s.img, s.H, s.fs, s.answers, val, { model: s.model, man: omrManualMax(s.model) ? Number(s.manual) || 0 : 0 });   // 📄 ورقته المصححة بالختم
  const who = list('').find(x => String(x.id) === String(s.sid));
  toast(`✓ ${who ? who.name : ''}: ${val} من ${test.max}`);
  OMRUI.openId = (OMRUI.sheets.find(x => !x.saved) || {}).id || null;
  omrMatchRender();
}
/* صورة الصفحة التي فيها السؤال: الأولى، أو صفحة تالية ضُمّت للورقة */
function omrPageImg(s, a){ const p = a && a.pg > 1 && s.pages && s.pages[a.pg]; return p ? p : { img: s.img, H: s.H, fs: s.fs }; }
function omrSheetCrop(s, i){
  const box = $(`crop-${s.id}-${i}`), a = s.answers[i]; if(!box || !a.boxes) return;
  const p = omrPageImg(s, a); omrRowCrop(box, p.img, p.H, p.fs, a, i);
}
/* صفحة لم تُصوَّر: يحسبها المعلم بلا إجابة (لم يحلّها الطالب) أو يصوّرها لتُضم */
function omrPageBlank(id, pg){ const s = OMRUI.sheets.find(x => x.id === id); if(!s) return; s.answers.forEach(a => { if(a.status === 'nopage' && a.pg === pg){ a.final = -1; a.status = 'blank'; } }); OMRDB.put(s);
  if(s.sid && !s.answers.some(a => a.final === null) && omrManualOk(s.manual, s.model)) omrSheetSave(s); else omrMatchRender(); }
function omrSheetView(id){
  const s = OMRUI.sheets.find(x => x.id === id); if(!s) return;
  const o = document.createElement('div'); o.className = 'omr-full'; o.onclick = () => o.remove();
  o.innerHTML = `<img src="${s.img}" alt=""><span>اضغط للإغلاق</span>`; document.body.appendChild(o);
}
async function omrSheetDelete(id){
  if(!(await askConfirm('حذف هذه الورقة من الدفعة؟', { title:'حذف الورقة', yes:'احذف', no:'إلغاء' }))) return;
  OMRUI.sheets = OMRUI.sheets.filter(x => x.id !== id); OMRDB.del(id); OMRUI.openId = (OMRUI.sheets.find(x => !x.saved) || {}).id || null; omrMatchRender();
}
async function omrBatchClear(){
  const left = OMRUI.sheets.filter(s => !s.saved).length;
  if(left && !(await askConfirm(`في الدفعة ${left} ${left===1?'ورقة لم تُربط':'أوراق لم تُربط'}. حذفها يعني إعادة تصويرها.`, { title:'حذف الدفعة؟', yes:'احذف', no:'إلغاء' }))) return;
  for(const s of OMRUI.sheets) await OMRDB.del(s.id);
  OMRUI.sheets = []; omrClose();
}
function omrBackToCapture(){ omrScan(); }

document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'hidden' && (OMRUI.stream || OMR_STREAMS.size || OMRUI.starting)){
    omrStopCamera();
    const st = document.getElementById('omr-status'); if(st) st.textContent = 'أُوقفت الكاميرا عند مغادرة التطبيق — اضغط «⚡ تصوير تلقائي» للمتابعة';
  }
});
function omrBatchToggle(on){
  OMRUI.batch = !!on; try{ localStorage.setItem('omr_batch', on ? '1' : '0'); }catch(e){}
  const row = document.querySelector('.omr-stu-row'); if(row) row.style.display = on ? 'none' : '';
  omrBatchCounter();
}
function omrClose(back){
  omrStopLoop(); omrKillStreams(); OMRUI.camGen = (OMRUI.camGen || 0) + 1;
  OMRUI.queue = [];
  document.getElementById('omr-sheet')?.remove(); document.body.style.overflow='';
  if(back) omrOpen();
  else { try{ renderExamGrades(); }catch(e){} }
}


/* ───────────── تصدير لأزرار الصفحة (onclick) ───────────── */
if(typeof window.VR_SUP==='undefined') window.VR_SUP=VR_SUP;
if(typeof window.vrMatch==='undefined') window.vrMatch=vrMatch;
if(typeof window.vrSay==='undefined') window.vrSay=vrSay;
if(typeof window.vbOn==='undefined') window.vbOn=vbOn;
if(typeof window.vbLive==='undefined') window.vbLive=vbLive;
if(typeof window.vbInterim==='undefined') window.vbInterim=vbInterim;
if(typeof window.vbCard==='undefined') window.vbCard=vbCard;
if(typeof window.VB_VER==='undefined') window.VB_VER=VB_VER;
if(typeof window.VB_IOS==='undefined') window.VB_IOS=VB_IOS;
if(typeof window.VBI==='undefined') window.VBI=VBI;
if(typeof window.vbiWords==='undefined') window.vbiWords=vbiWords;
if(typeof window.vbiCommit==='undefined') window.vbiCommit=vbiCommit;
if(typeof window.vbiRec==='undefined') window.vbiRec=vbiRec;
if(typeof window.vbiGo==='undefined') window.vbiGo=vbiGo;
if(typeof window.vbiMute==='undefined') window.vbiMute=vbiMute;
if(typeof window.VB_ENGINES==='undefined') window.VB_ENGINES=VB_ENGINES;
if(typeof window.vbEngine==='undefined') window.vbEngine=vbEngine;
if(typeof window.fmt==='undefined') window.fmt=fmt;
if(typeof window.examBook==='undefined') window.examBook=examBook;
if(typeof window.examTestId==='undefined') window.examTestId=examTestId;
if(typeof window.examMaxTotal==='undefined') window.examMaxTotal=examMaxTotal;
if(typeof window.examStudentRawTotal==='undefined') window.examStudentRawTotal=examStudentRawTotal;
if(typeof window.examFor==='undefined') window.examFor=examFor;
if(typeof window.examVrRec==='undefined') window.examVrRec=examVrRec;
if(typeof window.examVrOn==='undefined') window.examVrOn=examVrOn;
if(typeof window.EXAM_NUMS==='undefined') window.EXAM_NUMS=EXAM_NUMS;
if(typeof window.examVrNumToken==='undefined') window.examVrNumToken=examVrNumToken;
if(typeof window.examVrNumberAt==='undefined') window.examVrNumberAt=examVrNumberAt;
if(typeof window.examVrSegments==='undefined') window.examVrSegments=examVrSegments;
if(typeof window.examVrSay==='undefined') window.examVrSay=examVrSay;
if(typeof window.examVrLog==='undefined') window.examVrLog=examVrLog;
if(typeof window.examVrStop==='undefined') window.examVrStop=examVrStop;
if(typeof window.exHold==='undefined') window.exHold=exHold;
if(typeof window.examVrHandle==='undefined') window.examVrHandle=examVrHandle;
if(typeof window.exEng==='undefined') window.exEng=exEng;
if(typeof window.examVrStart==='undefined') window.examVrStart=examVrStart;
if(typeof window.examVrRenderTests==='undefined') window.examVrRenderTests=examVrRenderTests;
if(typeof window.examVrInit==='undefined') window.examVrInit=examVrInit;
if(typeof window.renderExamConfig==='undefined') window.renderExamConfig=renderExamConfig;
if(typeof window.addExamTest==='undefined') window.addExamTest=addExamTest;
if(typeof window.updateExamTest==='undefined') window.updateExamTest=updateExamTest;
if(typeof window.examCoversPick==='undefined') window.examCoversPick=examCoversPick;
if(typeof window.deleteExamTest==='undefined') window.deleteExamTest=deleteExamTest;
if(typeof window.exHas==='undefined') window.exHas=exHas;
if(typeof window.setExamScore==='undefined') window.setExamScore=setExamScore;
if(typeof window.examFilter==='undefined') window.examFilter=examFilter;
if(typeof window.examMissingTests==='undefined') window.examMissingTests=examMissingTests;
if(typeof window.examIsMissing==='undefined') window.examIsMissing=examIsMissing;
if(typeof window.setExamFilter==='undefined') window.setExamFilter=setExamFilter;
if(typeof window.EX_CUR==='undefined') window.EX_CUR=EX_CUR;
if(typeof window.exCurTest==='undefined') window.exCurTest=exCurTest;
if(typeof window.exPick==='undefined') window.exPick=exPick;
if(typeof window.exVal==='undefined') window.exVal=exVal;
if(typeof window.EXPAP==='undefined') window.EXPAP=EXPAP;
if(typeof window.exPapersLoad==='undefined') window.exPapersLoad=exPapersLoad;
if(typeof window.exPaperOpen==='undefined') window.exPaperOpen=exPaperOpen;
if(typeof window.EXK==='undefined') window.EXK=EXK;
if(typeof window.exPanel==='undefined') window.exPanel=exPanel;
if(typeof window.exPanelClose==='undefined') window.exPanelClose=exPanelClose;
if(typeof window.exkLoad==='undefined') window.exkLoad=exkLoad;
if(typeof window.exkLab==='undefined') window.exkLab=exkLab;
if(typeof window.exkScore==='undefined') window.exkScore=exkScore;
if(typeof window.exKeyOpen==='undefined') window.exKeyOpen=exKeyOpen;
if(typeof window.exkRender==='undefined') window.exkRender=exkRender;
if(typeof window.exkApply==='undefined') window.exkApply=exkApply;
if(typeof window.exkRestamp==='undefined') window.exkRestamp=exkRestamp;
if(typeof window.EXA==='undefined') window.EXA=EXA;
if(typeof window.exAnaOpen==='undefined') window.exAnaOpen=exAnaOpen;
if(typeof window.exaData==='undefined') window.exaData=exaData;
if(typeof window.exaRender==='undefined') window.exaRender=exaRender;
if(typeof window.exaRemedial==='undefined') window.exaRemedial=exaRemedial;
if(typeof window.renderExamGrades==='undefined') window.renderExamGrades=renderExamGrades;
if(typeof window.EXKB==='undefined') window.EXKB=EXKB;
if(typeof window.exKbEl==='undefined') window.exKbEl=exKbEl;
if(typeof window.exRowsSids==='undefined') window.exRowsSids=exRowsSids;
if(typeof window.exKbOpen==='undefined') window.exKbOpen=exKbOpen;
if(typeof window.exKbScroll==='undefined') window.exKbScroll=exKbScroll;
if(typeof window.exKbCommit==='undefined') window.exKbCommit=exKbCommit;
if(typeof window.exKbClose==='undefined') window.exKbClose=exKbClose;
if(typeof window.exKbKey==='undefined') window.exKbKey=exKbKey;
if(typeof window.OMR==='undefined') window.OMR=OMR;
if(typeof window.OMRUI==='undefined') window.OMRUI=OMRUI;
if(typeof window.OMR_MSG==='undefined') window.OMR_MSG=OMR_MSG;
if(typeof window.omrApi==='undefined') window.omrApi=omrApi;
if(typeof window.omrQs==='undefined') window.omrQs=omrQs;
if(typeof window.omrQm==='undefined') window.omrQm=omrQm;
if(typeof window.omrPts==='undefined') window.omrPts=omrPts;
if(typeof window.omrTotals==='undefined') window.omrTotals=omrTotals;
if(typeof window.omrManualMax==='undefined') window.omrManualMax=omrManualMax;
if(typeof window.omrManualOk==='undefined') window.omrManualOk=omrManualOk;
if(typeof window.omrManualHTML==='undefined') window.omrManualHTML=omrManualHTML;
if(typeof window.omrScoreOf==='undefined') window.omrScoreOf=omrScoreOf;
if(typeof window.omrTest==='undefined') window.omrTest=omrTest;
if(typeof window.omrNextStudent==='undefined') window.omrNextStudent=omrNextStudent;
if(typeof window.omrOpen==='undefined') window.omrOpen=omrOpen;
if(typeof window.omrStudentsSelect==='undefined') window.omrStudentsSelect=omrStudentsSelect;
if(typeof window.omrScan==='undefined') window.omrScan=omrScan;
if(typeof window.omrShootBtn==='undefined') window.omrShootBtn=omrShootBtn;
if(typeof window.omrPhoto==='undefined') window.omrPhoto=omrPhoto;
if(typeof window.omrScanGuide==='undefined') window.omrScanGuide=omrScanGuide;
if(typeof window.omrLoadFiles==='undefined') window.omrLoadFiles=omrLoadFiles;
if(typeof window.OMR_PDFJS==='undefined') window.OMR_PDFJS=OMR_PDFJS;
if(typeof window.omrPdfLib==='undefined') window.omrPdfLib=omrPdfLib;
if(typeof window.omrQueueNext==='undefined') window.omrQueueNext=omrQueueNext;
if(typeof window.omrPageFailed==='undefined') window.omrPageFailed=omrPageFailed;
if(typeof window.omrManualBtn==='undefined') window.omrManualBtn=omrManualBtn;
if(typeof window.omrManualOpen==='undefined') window.omrManualOpen=omrManualOpen;
if(typeof window.omrManualOrder==='undefined') window.omrManualOrder=omrManualOrder;
if(typeof window.omrManualRead==='undefined') window.omrManualRead=omrManualRead;
if(typeof window.omrSkip==='undefined') window.omrSkip=omrSkip;
if(typeof window.omrQueueDone==='undefined') window.omrQueueDone=omrQueueDone;
if(typeof window.OMR_CAM_TRIES==='undefined') window.OMR_CAM_TRIES=OMR_CAM_TRIES;
if(typeof window.OMR_CAM_ORDER==='undefined') window.OMR_CAM_ORDER=OMR_CAM_ORDER;
if(typeof window.OMR_MIN_SIDE==='undefined') window.OMR_MIN_SIDE=OMR_MIN_SIDE;
if(typeof window.OMR_STREAMS==='undefined') window.OMR_STREAMS=OMR_STREAMS;
if(typeof window.omrKillStreams==='undefined') window.omrKillStreams=omrKillStreams;
if(typeof window.omrOpenStream==='undefined') window.omrOpenStream=omrOpenStream;
if(typeof window.omrStartCamera==='undefined') window.omrStartCamera=omrStartCamera;
if(typeof window.omrStartCameraRun==='undefined') window.omrStartCameraRun=omrStartCameraRun;
if(typeof window.omrTorch==='undefined') window.omrTorch=omrTorch;
if(typeof window.omrStopCamera==='undefined') window.omrStopCamera=omrStopCamera;
if(typeof window.omrStartLoop==='undefined') window.omrStartLoop=omrStartLoop;
if(typeof window.omrStopLoop==='undefined') window.omrStopLoop=omrStopLoop;
if(typeof window.omrPaint==='undefined') window.omrPaint=omrPaint;
if(typeof window.omrDrawQuad==='undefined') window.omrDrawQuad=omrDrawQuad;
if(typeof window.omrTick==='undefined') window.omrTick=omrTick;
if(typeof window.OMR_FLAT==='undefined') window.OMR_FLAT=OMR_FLAT;
if(typeof window.omrFlatten==='undefined') window.omrFlatten=omrFlatten;
if(typeof window.omrPageQuality==='undefined') window.omrPageQuality=omrPageQuality;
if(typeof window.omrFuse==='undefined') window.omrFuse=omrFuse;
if(typeof window.omrProcess==='undefined') window.omrProcess=omrProcess;
if(typeof window.omrCamVisible==='undefined') window.omrCamVisible=omrCamVisible;
if(typeof window.omrShowResult==='undefined') window.omrShowResult=omrShowResult;
if(typeof window.omrFix==='undefined') window.omrFix=omrFix;
if(typeof window.omrCrop==='undefined') window.omrCrop=omrCrop;
if(typeof window.omrRowCrop==='undefined') window.omrRowCrop=omrRowCrop;
if(typeof window.omrFinalOf==='undefined') window.omrFinalOf=omrFinalOf;
if(typeof window.omrSet==='undefined') window.omrSet=omrSet;
if(typeof window.omrWrongOf==='undefined') window.omrWrongOf=omrWrongOf;
if(typeof window.omrSave==='undefined') window.omrSave=omrSave;
if(typeof window.omrRefreshStudents==='undefined') window.omrRefreshStudents=omrRefreshStudents;
if(typeof window.omrRescan==='undefined') window.omrRescan=omrRescan;
if(typeof window.OMRDB==='undefined') window.OMRDB=OMRDB;
if(typeof window.omrBatchKey==='undefined') window.omrBatchKey=omrBatchKey;
if(typeof window.omrBatchLoad==='undefined') window.omrBatchLoad=omrBatchLoad;
if(typeof window.omrStudentBox==='undefined') window.omrStudentBox=omrStudentBox;
if(typeof window.omrNameStrip==='undefined') window.omrNameStrip=omrNameStrip;
if(typeof window.omrStudentOf==='undefined') window.omrStudentOf=omrStudentOf;
if(typeof window.omrPageVec==='undefined') window.omrPageVec=omrPageVec;
if(typeof window.omrPvDiff==='undefined') window.omrPvDiff=omrPvDiff;
if(typeof window.omrStripDiff==='undefined') window.omrStripDiff=omrStripDiff;
if(typeof window.OMR_PV_SAME==='undefined') window.OMR_PV_SAME=OMR_PV_SAME;
if(typeof window.OMR_NAME_SAME==='undefined') window.OMR_NAME_SAME=OMR_NAME_SAME;
if(typeof window.omrIsDup==='undefined') window.omrIsDup=omrIsDup;
if(typeof window.omrPageTarget==='undefined') window.omrPageTarget=omrPageTarget;
if(typeof window.omrPagePlaceholders==='undefined') window.omrPagePlaceholders=omrPagePlaceholders;
if(typeof window.omrBatchAddPage==='undefined') window.omrBatchAddPage=omrBatchAddPage;
if(typeof window.omrBatchAdd==='undefined') window.omrBatchAdd=omrBatchAdd;
if(typeof window.omrScanPause==='undefined') window.omrScanPause=omrScanPause;
if(typeof window.omrScanNext==='undefined') window.omrScanNext=omrScanNext;
if(typeof window.omrBeep==='undefined') window.omrBeep=omrBeep;
if(typeof window.omrBatchForce==='undefined') window.omrBatchForce=omrBatchForce;
if(typeof window.omrWhoLine==='undefined') window.omrWhoLine=omrWhoLine;
if(typeof window.omrBatchMini==='undefined') window.omrBatchMini=omrBatchMini;
if(typeof window.omrBatchCard==='undefined') window.omrBatchCard=omrBatchCard;
if(typeof window.omrBatchCardDraw==='undefined') window.omrBatchCardDraw=omrBatchCardDraw;
if(typeof window.omrBatchCardFull==='undefined') window.omrBatchCardFull=omrBatchCardFull;
if(typeof window.omrBatchUndo==='undefined') window.omrBatchUndo=omrBatchUndo;
if(typeof window.omrBatchAfterSingle==='undefined') window.omrBatchAfterSingle=omrBatchAfterSingle;
if(typeof window.omrBatchCounter==='undefined') window.omrBatchCounter=omrBatchCounter;
if(typeof window.omrNorm==='undefined') window.omrNorm=omrNorm;
if(typeof window.omrMatch==='undefined') window.omrMatch=omrMatch;
if(typeof window.omrSheetScore==='undefined') window.omrSheetScore=omrSheetScore;
if(typeof window.omrSheetManual==='undefined') window.omrSheetManual=omrSheetManual;
if(typeof window.omrMatchRender==='undefined') window.omrMatchRender=omrMatchRender;
if(typeof window.omrMatchBody==='undefined') window.omrMatchBody=omrMatchBody;
if(typeof window.OMRQ==='undefined') window.OMRQ=OMRQ;
if(typeof window.OMR_WHY==='undefined') window.OMR_WHY=OMR_WHY;
if(typeof window.omrRevItems==='undefined') window.omrRevItems=omrRevItems;
if(typeof window.omrRevOpen==='undefined') window.omrRevOpen=omrRevOpen;
if(typeof window.omrRevRender==='undefined') window.omrRevRender=omrRevRender;
if(typeof window.omrRevSet==='undefined') window.omrRevSet=omrRevSet;
if(typeof window.omrRevBack==='undefined') window.omrRevBack=omrRevBack;
if(typeof window.omrMatchOpen==='undefined') window.omrMatchOpen=omrMatchOpen;
if(typeof window.omrMatchFilter==='undefined') window.omrMatchFilter=omrMatchFilter;
if(typeof window.omrSheetSet==='undefined') window.omrSheetSet=omrSheetSet;
if(typeof window.OMR_AR==='undefined') window.OMR_AR=OMR_AR;
if(typeof window.omrStampDraw==='undefined') window.omrStampDraw=omrStampDraw;
if(typeof window.omrPaperImage==='undefined') window.omrPaperImage=omrPaperImage;
if(typeof window.omrWhiten==='undefined') window.omrWhiten=omrWhiten;
if(typeof window.omrPaperDraw==='undefined') window.omrPaperDraw=omrPaperDraw;
if(typeof window.OMR_UPQ==='undefined') window.OMR_UPQ=OMR_UPQ;
if(typeof window.omrUploadPaper==='undefined') window.omrUploadPaper=omrUploadPaper;
if(typeof window.omrUploadPaper1==='undefined') window.omrUploadPaper1=omrUploadPaper1;
if(typeof window.omrAutoSave==='undefined') window.omrAutoSave=omrAutoSave;
if(typeof window.omrSaveReady==='undefined') window.omrSaveReady=omrSaveReady;
if(typeof window.omrMatchPick==='undefined') window.omrMatchPick=omrMatchPick;
if(typeof window.omrSheetSave==='undefined') window.omrSheetSave=omrSheetSave;
if(typeof window.omrPageImg==='undefined') window.omrPageImg=omrPageImg;
if(typeof window.omrSheetCrop==='undefined') window.omrSheetCrop=omrSheetCrop;
if(typeof window.omrPageBlank==='undefined') window.omrPageBlank=omrPageBlank;
if(typeof window.omrSheetView==='undefined') window.omrSheetView=omrSheetView;
if(typeof window.omrSheetDelete==='undefined') window.omrSheetDelete=omrSheetDelete;
if(typeof window.omrBatchClear==='undefined') window.omrBatchClear=omrBatchClear;
if(typeof window.omrBackToCapture==='undefined') window.omrBackToCapture=omrBackToCapture;
if(typeof window.omrBatchToggle==='undefined') window.omrBatchToggle=omrBatchToggle;
if(typeof window.omrClose==='undefined') window.omrClose=omrClose;
/* ───────────── 41-exams-shim: الصفحة وربطها ───────────── */
function tpxExamHTML(){
  const per = ctExamSP().per;
  return `<div class="tpx-ex">
  <div class="rd-head"><h1>رصد الاختبارات</h1><span id="qr-sync" class="qr-sync"></span><button type="button" class="rd-pill" id="ex-setup-btn">⚙️ الإعداد</button></div>
  <div class="ex-chips" id="ex-chips"></div>
  <div class="sheet" id="ex-setup" hidden>
    <div class="section-head"><h3>إعداد الاختبارات في هذه الفترة</h3><span class="count">مرن من اختبار واحد إلى عدة اختبارات</span></div>
    <div class="exam-period-tools"><label style="flex:1;min-width:170px">الفترة<select class="inp" id="exam-period"><option value="1" ${per === 1 ? 'selected' : ''}>الفترة الأولى</option><option value="2" ${per === 2 ? 'selected' : ''}>الفترة الثانية</option></select></label></div>
    <div class="exam-book-tools"><div class="exam-summary" id="exam-config-summary"></div><div id="exam-test-list" class="exam-test-list"></div>
      <button class="btn primary wide" id="exam-add-test" type="button">＋ إضافة اختبار</button></div>
    <div class="msg" id="exam-term-note"></div>
  </div>
  <div class="ex-info" id="exam-kpis"></div>
  <div class="ex-omr-tools" id="ex-omr-tools"></div>
  <div class="ex-tools"><button type="button" id="ex-voice-btn">🎤 بالصوت</button><button type="button" id="omr-open" onclick="omrOpen()">📷 بالكاميرا</button><button type="button" id="ex-miss-btn">⚠️ لم يُرصد فقط</button><button type="button" id="ex-search-btn" aria-label="بحث">🔍</button></div>
  <div class="sheet" id="ex-voice" hidden>
    <div id="exam-vr-wrap" style="margin-top:10px;display:none">
      <div class="exam-vr-tools"><label>الرصد الصوتي للاختبار<select class="inp" id="exam-vr-test"></select></label>
        <button class="btn" id="exam-vr-btn" type="button" style="width:100%;min-height:52px;font-size:1rem;font-weight:700">🎤 رصد الاختبارات بالصوت</button></div>
      <div class="vb-bar" id="exv-bar" hidden><span class="vb-dot"></span><div class="vb-live" id="exv-live">أستمع…</div><button type="button" class="vb-stop" id="exv-stop">⏹️ إيقاف</button></div>
      <div class="vr-hint">قل اسم الطالب ثم الدرجة — ويمكن عدة طلاب في نفس النَّفَس</div>
      <div id="exam-vr-status" class="muted" style="margin-top:6px;font-size:.8rem;line-height:1.7"></div>
      <div class="vr-cards" id="exam-vr-log"></div>
    </div>
  </div>
  <div id="ex-search" hidden><div class="search"><span class="search-icon">🔍</span><input class="inp" id="exam-search" autocomplete="off" placeholder="ابحث عن طالب…"></div></div>
  <div hidden><div class="exam-filter" id="exam-filter"></div><span id="exam-count"></span></div>
  <div id="exam-list" class="ex-list"></div>
  <div class="sheet" style="margin-top:12px"><div class="section-head"><h3>طريقة الاحتساب</h3></div><div class="msg" id="exam-rules"></div></div>
</div>`;
}
function tpxBind(box){
  $('exam-period').onchange = () => { window._ctExPer = $('exam-period').value; if (examVrOn) examVrStop(); exKbClose(false); renderClassTools(); };
  $('exam-search').addEventListener('input', renderExamGrades);
  $('ex-setup-btn').onclick = () => { const w = $('ex-setup'); w.hidden = !w.hidden; $('ex-setup-btn').classList.toggle('on', !w.hidden); };
  $('ex-voice-btn').onclick = () => { if (!VR_SUP) { toast('الرصد الصوتي غير مدعوم في هذا المتصفح'); return; }
    if (examVrOn) { examVrStop(); return; }
    if ($('exam-vr-test') && EX_CUR) $('exam-vr-test').value = EX_CUR;
    $('ex-voice').hidden = false; $('ex-voice-btn').classList.add('on'); exKbClose(true); examVrStart(); };
  $('ex-miss-btn').onclick = () => setExamFilter(examFilter.mode === 'missing' ? 'all' : 'missing');
  $('ex-search-btn').onclick = () => { const w = $('ex-search'); w.hidden = !w.hidden; $('ex-search-btn').classList.toggle('on', !w.hidden); if (!w.hidden) $('exam-search').focus(); else { $('exam-search').value = ''; renderExamGrades(); } };
  $('exam-list').addEventListener('click', e => { const c = e.target.closest('[data-ex-cell]'); if (c) { exKbOpen(c.dataset.exCell); return; }
    const f = e.target.closest('[data-ex-full]'); if (f) { const t = exCurTest(); if (t) { if (EXKB.sid === f.dataset.exFull) { EXKB.buf = String(t.max); exKbKey('next'); } else setExamScore(f.dataset.exFull, t.id, String(t.max), true).then(() => toast(`💯 ${fmt(t.max)}`)); } } });
  $('exam-add-test').onclick = addExamTest;
  box.addEventListener('change', e => {
    const title = e.target.closest('[data-exam-test-title]'); if (title) updateExamTest(title.dataset.examTestTitle, 'title', title.value);
    const max = e.target.closest('[data-exam-test-max]'); if (max) updateExamTest(max.dataset.examTestMax, 'max', max.value);
    const ed = e.target.closest('[data-exam-test-date]'); if (ed) updateExamTest(ed.dataset.examTestDate, 'date', ed.value); });
  box.addEventListener('click', e => { const t = e.target.closest('[data-exam-delete],[data-exam-covers]'); if (!t) return; const d = t.dataset;
    if (d.examDelete !== undefined) deleteExamTest(d.examDelete); else if (d.examCovers !== undefined) examCoversPick(d.examCovers); });
}
/* تُستدعى من ctExams (02.js) عند وضع «📱 رصد» */
window.tpxExamsMount = function(box){
  TPX.cls = ctValidCls(window._ctExCls);
  box.classList.add('tpx', 'tpx-root'); box.innerHTML = tpxExamHTML(); tpxBind(box);
  examVrInit(); renderExamConfig(); renderExamGrades(); if (typeof qrStatus === 'function') qrStatus();
};
/* لوحة الأرقام والنوافذ تُضاف لـ body: تحمل .tpx لتلبس تنسيق الصفحة */
new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && /^(ex-kb|omr-sheet|exa-panel)$/.test(n.id) || (n.nodeType === 1 && n.classList && n.classList.contains('cov-ov'))) n.classList.add('tpx'); }).observe(document.body, { childList: true });

window.TPX_READY=true;
})();
