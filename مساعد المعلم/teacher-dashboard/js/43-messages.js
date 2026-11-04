/* ═══════════ 💌 رسائل الحصة للطلاب — منقول من بوابة المعلم إلى لوحة التحكم ═══════════
   نُقل آليًا من بوابة المعلم كما هو داخل نطاق مغلق، وتوصيلاته في «43-messages-shim» أعلى الملف وأسفله — التعديل من الآن هنا مباشرة.
   يُحمَّل عند أول فتح لـ«رسائل الحصة». */
(function(){
/* ───────────── 43-messages-shim: توصيل نص البوابة ببيانات اللوحة ─────────────
   الإرسال نفسه كما في البوابة (POST /messages للطالب)، و«تم التواصل» و«لاحقًا» يُحفظان عبر طابور اللوحة */
const TPX4 = window.TPX4 = window.TPX4 || { cls: '', msid: '' };
const $ = id => id === 'cls' ? { value: TPX4.cls } : document.getElementById(id);
function TPX_STU(){ return (Array.isArray(STUDENTS) ? STUDENTS : []).map(s => s && String(s.id) === s.id ? s : { ...s, id: String(s && s.id) }); }
function list(cls){ return TPX_STU().filter(s => !cls || String(s.cls || '').trim() === cls).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar')); }
function save(){
  if (!CT_DATA) return; const ops = [];
  if (CT_DATA.msgFlags) ops.push({ k: 'set', f: 'msgFlags', v: JSON.parse(JSON.stringify(CT_DATA.msgFlags)) });
  if (Array.isArray(CT_DATA.msgq)) ops.push({ k: 'set', f: 'msgq', v: JSON.parse(JSON.stringify(CT_DATA.msgq)) });
  qrDo(ops);
}
async function loadGrades(){ try { await ctEnsureGrades(true); } catch (e) {} try { renderMsgList(); } catch (e) {} }
const OMR_STREAMS = { get size(){ return (window.OMR_STREAMS && window.OMR_STREAMS.size) || 0; } };
function omrKillStreams(){ try { window.omrKillStreams && window.omrKillStreams(); } catch (e) {} }
/* الحصة الحالية لفصل الطالب من جدول اللوحة (لـ«اليوم … في الحصة …» في نص الرسالة) */
function ctxResolve(){ const k = tdKsaNow(), sc = (CT_DATA && CT_DATA.schedule) || {}, g = (sc.grid || {})[String(k.dow)] || {};
  return { dow: k.dow, now: k.min, T: tdTimes(sc), clsOf: n => String(g[String(n)] || '').trim() }; }

/* ───────────── نص البوابة ───────────── */
const VR_SUP = window.SpeechRecognition || window.webkitSpeechRecognition || null;
function vrNorm(t){
  return String(t||'')
    // الأرقام العربية (٨) والفارسية تُكتب ٨ ⟵ 8، والفاصلة العشرية بين رقمين تبقى (٧٫٥ ⟵ 7.5)
    .replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c))
    .replace(/(\d)\s*[٫.,،]\s*(\d)/g,'$1\u0001$2')
    .replace(/[\u064B-\u0652\u0640]/g,'')
    .replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/[ىئ]/g,'ي').replace(/ؤ/g,'و')
    .replace(/[^\u0621-\u064A0-9\s\u0001]/g,' ')
    .replace(/\u0001/g,'.')
    .replace(/\s+/g,' ').trim();
}
const VR_SKIP = new Set(['بن','بنت','ابن','ال','آل','the','الطالب','طالب','يا','ترا','تري']);
/* 🔗 «عبد» تُنطق منفصلة وتُكتب في الكشف موصولة (عبد الرحمن ⟷ عبدالرحمن)،
   فكانت المطابقة تفشل. نصل السابقة بما بعدها في الطرفين قبل المقارنة.
   وكذلك «أبو» و«أم» في الكنى. «عبد» لم تعد كلمة مُهمَلة. */
const VR_JOIN = new Set(['عبد','ابو','أبو','ام','بو']);
function vrTokens(t){
  const raw = vrNorm(t).split(' ').filter(Boolean);
  const out = [];
  for(let i=0;i<raw.length;i++){
    if(VR_JOIN.has(raw[i]) && raw[i+1]){ out.push(raw[i]+raw[i+1]); i++; continue; }
    out.push(raw[i]);
  }
  return out.filter(x => x && !VR_SKIP.has(x));
}
/* مقارنة كلمتين مع تجاهل «ال» التعريف على أي من الطرفين */
function vrBare(w){ return w.length>3 && w.startsWith('ال') ? w.slice(2) : w; }
function vrEq(a,b){
  const x = vrBare(a), y = vrBare(b);
  return x===y || (x.length>=3 && y.startsWith(x)) || (y.length>=3 && x.startsWith(y));
}
/* 🔤 خطأ حرف واحد من التعرف الصوتي (الرضوانى ⟵ رضوان) — للأسماء فقط، وللكلمات الطويلة */
function vrLev1(a,b){
  if(a===b) return true; const la=a.length, lb=b.length; if(Math.abs(la-lb)>1) return false;
  let i=0,j=0,d=0;
  while(i<la&&j<lb){ if(a[i]===b[j]){i++;j++;continue} if(++d>1) return false; if(la>lb)i++; else if(lb>la)j++; else{i++;j++;} }
  return d+(la-i)+(lb-j)<=1;
}
function vrNear(a,b){ const x=vrBare(a), y=vrBare(b); return vrEq(a,b) || (x.length>=4 && y.length>=4 && vrLev1(x,y)); }
/* 🗣️ صيغ كلمة الحالة: «المشارك/مشاركين/ومشارك/مشاركه» = «مشارك». بلا تقريب حرفي هنا
   حتى لا يُفهم اسم مثل «مشاري» على أنه «مشارك». */
function vrKw(w){
  let x=String(w||'');
  if(x.length>4 && x.startsWith('وال')) x=x.slice(3); else if(x.length>3 && x.startsWith('ال')) x=x.slice(2); else if(x.length>4 && x.startsWith('و')) x=x.slice(1);
  if(x.length>5 && /(ين|ون|ات)$/.test(x)) x=x.slice(0,-2); else if(x.length>4 && /ه$/.test(x)) x=x.slice(0,-1);
  return x;
}
function vrKwEq(tok,w){ return !!tok && (tok===w || vrKw(tok)===vrKw(w)); }

/* أنواع الرصد — مأخوذة من الحالات الموجودة أصلًا، لا أنواع مخترعة */
const VR_KINDS = [
  { ph:['لم يحل الواجب','ما حل الواجب','لم يحل','ما حل','لم ينجز الواجب',
        'لم ينجز','ما انجز','ماانجز','لم ينجزه','ماحل','ما سوى الواجب','ما سوا الواجب','ماسوى الواجب','ما جاب الواجب',
        'ما سلم الواجب','لم يسلم الواجب','نسي الواجب','ناسي الواجب','بدون واجب','ما سوى','ما جاب'],   m:'homework', st:'لم ينجز'  },
  { ph:['لم يشارك','ما شارك','مايشارك','ما يشارك','لم يشترك','ماشارك','مو مشارك','ما اشترك','غير مشارك'], m:'participation', st:'لم يشارك' },
  { ph:['حل الواجب','انجز الواجب','سلم الواجب','سوى الواجب','جاب الواجب','حال الواجب','حلال الواجب'],  m:'homework', st:'أنجز' },
  { ph:['غائب','غياب','غايب','غائبه','ما حضر','ماحضر','لم يحضر','مو موجود'],   m:'participation', st:'غائب'     },
  { ph:['معذور','عذر'],                             m:'homework',      st:'معذور'    },
  { ph:['مشاركه','مشارك','شارك','اشترك','يشارك','تشارك','متفاعل'],   m:'participation', st:'شارك'     },
  { ph:['واجب','انجز','الواجب','نجز'],              m:'homework',      st:'أنجز'     }
];

/* قوالب السلوك الموجودة في النظام + ما أضافه المعلم */
function vrBehaviors(){
  const out = [];
  try{
    for(const [t,n] of BHV_POS) out.push({title:t, note:n, type:'positive'});
    for(const [t,n] of BHV_NEG) out.push({title:t, note:n, type:'negative'});
    for(const x of (CT_DATA.behaviorTemplates||[])) if(x && x.title) out.push({title:x.title, note:x.note||'', type:x.type||'negative'});
  }catch(e){}
  return out;
}

/* 📋 كل عبارات الأنواع في قائمة واحدة مرتّبة من الأطول للأقصر، حتى تسبق
   «لم يحل الواجب» عبارةَ «الواجب»، و«مشاركة فعالة» كلمةَ «مشاركة». */
function vrPhrases(){
  const out = vrMsgUnified().slice();   // الرسائل ضمن الرصد الموحّد
  const direct = new Set();
  VR_KINDS.forEach(k => k.ph.forEach(p => {
    const t = vrTokens(p); if(t.length){ out.push({ t, kind:{ type:'status', m:k.m, st:k.st } }); t.forEach(w=>direct.add(w)); }
  }));
  const behs = vrBehaviors();
  for(const b of behs){
    const t = vrTokens(b.title);
    if(t.length) out.push({ t, kind:{ type:'behavior', beh:b } });
  }
  // الكلمة المميّزة الواحدة («تميز» ⟵ «إنجاز متميز») بشرط ألا تطابق إلا قالبًا واحدًا
  const uniq = new Map();
  for(const b of behs) for(const w of vrTokens(b.title)){
    if(w.length<4 || direct.has(w)) continue;
    if(!uniq.has(w)) uniq.set(w, new Set());
    uniq.get(w).add(b.title);
  }
  for(const [w, titles] of uniq){
    if(titles.size !== 1) continue;
    const b = behs.find(x => x.title === [...titles][0]);
    if(b) out.push({ t:[w], kind:{ type:'behavior', beh:b }, loose:true });
  }
  return out.sort((a,b)=> b.t.length - a.t.length);
}

/* يقطّع الكلام إلى أوامر متتابعة: «تركي محمد مشارك عادل علي مشارك …».
   كل عبارة نوعٍ تُنهي أمرًا وتبدأ الذي بعده. */
function vrSegments(text){ return vrSegmentsBy(text, vrPhrases()); }
function vrSegmentsBy(text, PH){
  const toks = vrTokens(text);
  const segs = [];
  let buf = [];
  for(let i=0;i<toks.length;){
    let hit = null;
    for(const p of PH){
      if(p.t.every((w,j)=> p.loose ? (toks[i+j] && (toks[i+j].includes(w)||w.includes(toks[i+j]))) : vrKwEq(toks[i+j],w))){ hit=p; break; }
    }
    if(hit){
      if(buf.length) segs.push({ name:buf, kind:hit.kind });
      buf = []; i += hit.t.length;
      continue;                       // نوع بلا اسم قبله: يُهمَل بدل الرصد على الخطأ
    }
    buf.push(toks[i]); i++;
  }
  if(buf.length) segs.push({ name:buf, kind:null });
  return segs;
}

/* 💌 عبارات الرسائل: مبنية من POS_MSGS و NEG_MSGS الموجودتين + مرادفات
   دارجة. لا نص جديد — msg(k,s) نفسها هي التي تكتب الرسالة. */
/* 🔀 عبارات الرسائل للرصد الصوتي الموحّد.
   كلمة «رسالة» إلزامية قبل النوع، لأن أغلب الكلمات مشتركة بين السلوك
   والرسائل (تعاون · تأخر · تحسن ملحوظ · إنجاز متميز). فبلا هذه الكلمة
   يصير «محمد تعاون» أمرًا لا يُعرف مقصده — والتخمين هنا يفسد السجل. */
const VR_MSG_LEAD = ['رساله','رسايل','رسائل'];
function vrMsgUnified(){
  const out = [], seen = new Set();
  const push = (toks,k)=>{
    for(const lead of VR_MSG_LEAD){
      const t = [lead, ...toks], key = t.join(' ');
      if(seen.has(key)) continue; seen.add(key);
      out.push({ t, kind:{ type:'msg', k } });
    }
  };
  const from = arr => { try{ for(const [lbl,k] of arr){ const t = vrTokens(lbl); if(t.length) push(t,k); } }catch(e){} };
  from(typeof POS_MSGS!=='undefined'?POS_MSGS:[]);
  from(typeof NEG_MSGS!=='undefined'?NEG_MSGS:[]);
  for(const [w,k] of VR_MSG_ALIAS){ const t = vrTokens(w); if(t.length) push(t,k); }
  return out;
}
const VR_MSG_ALIAS = [
  ['شكر','participation'], ['شكرا','participation'], ['اشكر','participation'],
  ['تميز','achievement'], ['متميز','achievement'],
  ['تحسن','improvement'], ['تعاون','cooperation'],
  ['سلوك','behavior'], ['سلوكيه','behavior'],
  ['متابعه','support'], ['مهاره','skill'], ['تاخر','late']
];
function vrMsgPhrases(){
  const out = [];
  const add = (label,k)=>{ const t = vrTokens(label);if(t.length) out.push({ t, kind:{ type:'msg', k } }); };
  try{ for(const [lbl,k] of POS_MSGS) add(lbl,k); }catch(e){}
  try{ for(const [lbl,k] of NEG_MSGS) add(lbl,k); }catch(e){}
  for(const [w,k] of VR_MSG_ALIAS){ const t = vrTokens(w); if(t.length) out.push({ t, kind:{ type:'msg', k } }); }
  return out.sort((a,b)=> b.t.length - a.t.length);
}

/* يفصل نوع الرصد عن الاسم. يُعيد {kind, rest} — kind=null إن لم يُفهم النوع */
function vrParse(text){
  let toks = vrTokens(text);
  if(!toks.length) return { kind:null, rest:[] };
  // «رسالة» تحسم القصد: لا نمرّ على قوالب السلوك أصلًا، فأغلب الكلمات مشتركة.
  if(toks.some(w => VR_MSG_LEAD.includes(w))){
    for(const p of vrMsgUnified().sort((a,b)=> b.t.length - a.t.length)){
      for(let i=0;i<toks.length;i++){
        if(p.t.every((w,j)=> toks[i+j]===w)){
          const rest = toks.slice(0,i).concat(toks.slice(i+p.t.length));
          return { kind:p.kind, rest };
        }
      }
    }
    // قال «رسالة» ولم يذكر نوعًا مفهومًا: لا نخمّن
    return { kind:null, rest:toks.filter(w=>!VR_MSG_LEAD.includes(w)), msgLead:true };
  }

  // ١) السلوك أولًا: عباراته أطول، ولو بدأنا بالكلمات المفردة لابتلعت «مشاركة فعالة»
  let best = null;
  for(const b of vrBehaviors()){
    const bt = vrTokens(b.title);
    if(!bt.length) continue;
    const hit = bt.filter(x => toks.some(y => y===x || (x.length>=4 && y.length>=4 && (x.includes(y)||y.includes(x)))));
    if(hit.length === bt.length && (!best || bt.length > best.len)){
      best = { kind:{ type:'behavior', beh:b }, used:hit, len:bt.length };
    }
  }
  // كلمة واحدة مميّزة تكفي إن لم يطابقها إلا قالب واحد — «تميز» ⟵ «إنجاز متميز».
  // شرط التفرّد يمنع التخمين: لو طابقت قالبين تُركت للمسار التالي.
  // ولا يُلجأ إليها إن كانت الكلمة نفسها حالةً مباشرة: «مشاركة» رصدُ مشاركة،
  // لا القالب «مشاركة فعالة». الأولوية للحالة الصريحة دائمًا.
  const directWords = new Set();
  VR_KINDS.forEach(k => k.ph.forEach(p => vrTokens(p).forEach(w => directWords.add(w))));
  if(!best && !toks.some(y => directWords.has(y))){
    const cands = [];
    for(const b of vrBehaviors()){
      const bt = vrTokens(b.title);
      const hit = bt.filter(x => x.length>=4 && toks.some(y => y.length>=4 && (x.includes(y)||y.includes(x))));
      if(hit.length) cands.push({b, hit});
    }
    if(cands.length === 1){
      const {b, hit} = cands[0];
      best = { kind:{ type:'behavior', beh:b }, used:hit, len:hit.length };
    }
  }
  if(best){
    const used = new Set(best.used);
    return { kind:best.kind,
             rest: toks.filter(y => !best.used.some(x => y===x || (x.length>=4 && y.length>=4 && (x.includes(y)||y.includes(x))))) };
  }

  // ٢) الحالات المباشرة — الأطول أولًا («لم يشارك» قبل «شارك»)
  const flat = [];
  VR_KINDS.forEach(k => k.ph.forEach(p => flat.push({p, k})));
  flat.sort((a,b)=> vrTokens(b.p).length - vrTokens(a.p).length);
  for(const {p,k} of flat){
    const pt = vrTokens(p);
    if(!pt.length) continue;
    let i = toks.findIndex((_,ix)=> pt.every((w,j)=> vrKwEq(toks[ix+j],w)));
    if(i<0 && pt.length===1) i = toks.findIndex(y => vrKwEq(y,pt[0]));
    if(i>=0){
      const rest = toks.slice(0,i).concat(toks.slice(i+pt.length));
      return { kind:{ type:'status', m:k.m, st:k.st }, rest };
    }
  }
  // ٣) كلمة «سلوك» وحدها: الطالب معروف والنوع لا
  const si = toks.findIndex(y => y==='سلوك' || y==='ملاحظه' || y==='مخالفه');
  if(si>=0) return { kind:null, rest: toks.filter((_,i)=>i!==si), askBeh:true };
  return { kind:null, rest: toks };
}

/* مطابقة الاسم مع طلاب الفصل الحالي (نفس list() المستعملة في الرصد اليدوي) */
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
if(window.HWV) HWV.onTakeover(() => { if(VBI.owner && VBI.owner.on){ try{ VBI.owner.stopAll(); }catch(e){} } });
const vbiWords = t => vrNorm(t).split(' ').filter(Boolean);
function vbiCommit(i, t, why){
  const E = VBI.owner, w = vbiWords(t), n = VBI.n[i] || 0;
  if(w.length <= n) return; VBI.n[i] = w.length; VBI.pend = null;
  if(!E || !E.on) return;                       // مكتوم: يُستهلك ولا يُرصد
  const f = w.slice(n).join(' '); E.L(why + ' «' + f + '»'); E.worked = true; E.fire(f);
}
function vbiRec(fresh){
  // الكائن نفسه لكل الموقع (محرّك الصوت الموحّد HWV): جلسة جديدة على iPhone لا يصلها صوت
  const r = window.HWV ? HWV.adopt(fresh) : ((VBI.rec && !fresh) ? VBI.rec : new VR_SUP());
  if(!window.HWV && r === VBI.rec) return r;
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
  if(window.HWV) vbiRec(false);                      // يركّب معالجاته على الكائن المشترك (قد يكون البحث بالصوت استعمله)
  if(window.HWV ? HWV.active : VBI.active){ VBI.active = true; E.L('live'); return; }            // الجلسة تعمل (مكتومة): نكمل فورًا
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
  if(window.HWV){ HWV.release(); return; }
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
function copyText(t){if(navigator.clipboard&&window.isSecureContext)return navigator.clipboard.writeText(t);const ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy')}catch(e){}ta.remove();return Promise.resolve()}
function copyCustomMessage(){const s=studentForMessage();if(!s){toast('اختر طالبًا أولًا');return}const t=($('custom-msg').value||'').replaceAll('{الطالب}',firstName(s.name)).replaceAll('{الاسم الكامل}',s.name).replaceAll('{الفصل}',s.cls||'بدون فصل');if(!t.trim()){toast('اكتب الرسالة أولًا');return}copyText(t).then(()=>{$('message-preview').textContent=t;toast('تم نسخ الرسالة')}).catch(()=>toast('تعذر النسخ'))}
const POS_MSGS=[['🌟 مشاركة إيجابية','participation'],['📚 إنجاز الواجب','homework'],['🏆 إنجاز متميز','achievement'],['🌱 تحسن ملحوظ','improvement'],['🤝 تعاون والتزام','cooperation'],['🧪 تميز في العلوم','science']];
const NEG_MSGS=[['⚠️ ملاحظة سلوكية','behavior'],['📚 عدم إنجاز الواجب','homework_neg'],['⏰ تأخر','late'],['📝 يحتاج متابعة دراسية','support'],['🎯 يحتاج تعزيز مهارة','skill']];
let alertSuggest='';
function alertsList(){return (CT_GRADES&&CT_GRADES.alerts)||[]}
async function markMessaged(map){
 CT_DATA.msgFlags=CT_DATA.msgFlags||{};
 Object.entries(map||{}).forEach(([k,v])=>{CT_DATA.msgFlags[k]=Math.max(Number(CT_DATA.msgFlags[k])||0,Number(v)||0)});
 await save(); await loadGrades();
 toast('أُزيل من القائمة حتى تتكرر 3 مرات جديدة');
}
function renderAlerts(){
 try{ renderMsgList(); msSheet(); }catch(e){}
 const box=$('alerts-sheet');if(!box)return;
 const cls=$('cls')?.value||'';
 const ids=new Set(list(cls).map(s=>s.id));
 const A=alertsList().filter(a=>ids.has(a.studentId));
 const badge=$('msg-badge');
 if(badge){ if(A.length){badge.hidden=false;badge.textContent=A.length}else{badge.hidden=true} }
 if(!A.length){box.style.display='none';return}
 box.style.display='';
 $('alerts-count').textContent=`${A.length} — الأحدث أولًا`;
 $('alerts-list').innerHTML=A.map(a=>
  `<div class="alert-row ${a.tone==='positive'?'pos':'neg'}"><div class="student-top"><div class="grow"><div class="student-name">${esc(a.name)}</div><div class="muted">${a.tone==='positive'?'🌟':'⚠️'} ${esc(a.reason)}${a.date?' · آخرها '+esc(a.date):''}</div></div></div><div class="mini-actions"><button class="btn sm ${a.tone==='positive'?'tick':'bad'}" data-alert-open="${esc(a.studentId)}|${esc(a.suggest)}">✍️ اكتب الرسالة</button><button class="btn sm" data-alert-done="${esc(JSON.stringify(a.dismiss||{[a.key]:a.count}))}">تم الإرسال</button></div></div>`
 ).join('');
}
function studentForMessage(){return TPX_STU().find(s=>s.id===TPX4.msid)||null}
function fillMessageSearch(){
 const q=String($('m-search')?.value||'').trim(),cls=$('cls')?.value||'';
 const pool=list(cls),out=q?pool.filter(s=>s.name.includes(q)).slice(0,8):[];
 $('m-results').innerHTML=q?out.map(s=>`<button class="search-result ${TPX4.msid===s.id?'active':''}" data-pickmsg="${esc(s.id)}"><div class="grow"><b>${esc(s.name)}</b><div class="muted">${esc(s.cls||'بدون فصل')}</div></div></button>`).join('')||'<div class="empty" style="padding:14px">لا نتائج.</div>':'';
 const s=studentForMessage();
 $('m-selected').innerHTML=s?`<div class="quick-student"><div class="student-top"><div class="grow"><div class="quick-name">${esc(s.name)}</div><div class="muted">${esc(s.cls||'بدون فصل')}</div></div><button class="btn sm" data-clearmsg="1">تغيير</button></div></div>`:'';
}
function selectMessageStudent(id){TPX4.msid=id;const s=studentForMessage();if(s)$('m-search').value=s.name;$('m-results').innerHTML='';fillMessageSearch();renderMessages()}
function clearMessageStudent(){TPX4.msid='';alertSuggest='';$('m-search').value='';fillMessageSearch();renderMessages()}
/* الاسم الأول فقط. «عبد» و«أبو» و«أم» تُوصل بما بعدها وإلا صار النداء خاطئًا:
   «عبد الرحمن يوسف» ← «عبد الرحمن» لا «عبد». */
const NAME_PREFIX=['عبد','عبدال','أبو','ابو','أم','ام','بن','ابن'];
function firstName(full){
 const t=String(full||'').trim().split(/\s+/).filter(Boolean);
 if(!t.length)return '';
 if(NAME_PREFIX.includes(t[0])&&t[1])return t[0]+' '+t[1];
 return t[0];
}
/* 📅 توثيق اليوم والحصة: «… اليوم الأحد في الحصة الرابعة». w غير مُمرَّر ⟵ تلقائي من الجدول */
function msg(k,s,w){
 const n=firstName(s.name);
 if(w===undefined) w=msWhenAuto(s);
 const ord=w&&w.p?(CTX_ORD[w.p]||w.p):'', D=w?` اليوم ${w.day}`:'', P=ord?` في الحصة ${ord}`:'';
 const M={
  participation:`أشكر ابنكم ${n} على مشاركته الفاعلة في مادة العلوم${D}${P}.`,
  homework:`أشكر ابنكم ${n} على التزامه بإنجاز واجب مادة العلوم${D}${P}.`,
  achievement:`أشكر ابنكم ${n} على أدائه المتميز في مادة العلوم${D}${P}.`,
  improvement:`ألاحظ تحسنًا واضحًا في مستوى ابنكم ${n} في مادة العلوم${D}${P}.`,
  cooperation:`أشكر ابنكم ${n} على تعاونه والتزامه داخل ${ord?`الحصة ${ord}`:'الحصة'}${D}.`,
  science:`أشكر ابنكم ${n} على اهتمامه وحرصه في مادة العلوم${D}${P}.`,
  behavior:`أرجو متابعة ابنكم ${n}، فقد صدرت منه ملاحظة سلوكية في مادة العلوم${D}${P}.`,
  homework_neg:`لم ينجز ابنكم ${n} واجب مادة العلوم${D?` المطلوب${D}${P}`:''}، وأرجو متابعته.`,
  late:`تأخر ابنكم ${n} عن ${ord?`الحصة ${ord} (العلوم)`:'حصة العلوم'}${D}، وأرجو تنبيهه على الالتزام بالوقت.`,
  support:`يحتاج ابنكم ${n} إلى متابعة إضافية في مادة العلوم.`,
  skill:`يحتاج ابنكم ${n} إلى مزيد من التدريب على مهارات مادة العلوم.`
 };
 return M[k]||M.behavior;
}
function renderMessages(){
 try{ renderMsgList(); msSheet(); }catch(e){}
 const s=studentForMessage();
 const render=(arr,id)=>$(id).innerHTML=arr.map(([t,k])=>`<div class="template-card${alertSuggest===k?' suggested':''}"><b style="font-size:.85rem">${esc(t)}</b>${s?`<div class="muted" style="margin-top:4px;line-height:1.6">${esc(msg(k,s))}</div>`:''}<div class="mini-actions" style="margin-top:7px"><button class="btn sm tick" data-msg="${esc(k)}">📋 نسخ</button><button class="btn sm" data-msgq="${esc(k)}">📨 للمركز</button></div></div>`).join('');
 render(POS_MSGS,'positive-msgs');render(NEG_MSGS,'negative-msgs');
 $('message-preview').textContent=s?`النص يظهر تحت كل قالب باسم ${firstName(s.name)}. اضغط «نسخ» لأخذه.`:'اختر طالبًا أولًا لتظهر الرسائل باسمه.';
}
/* ═══════════ 💌 الرسائل بالصوت ═══════════
   «سعد القحطاني شكر · تركي الشمري تأخر» ⟵ تُجهَّز رسالة لكل واحد.
   لا إرسال: البوابة أصلًا تنسخ النص للحافظة، ونحن نلتزم بذلك.
   ═════════════════════════════════════════ */
const MSGQ_KEY = 'teacher_msgq_v1';
let MSGQ = [];
try{ MSGQ = JSON.parse(localStorage.getItem(MSGQ_KEY)||'[]') || []; }catch(e){ MSGQ = []; }
/* 🔄 الطابور يُزامَن عبر الخادم ليصير مركزًا واحدًا: تُجهّزه بصوتك من الجوال
   وترسله من لوحة التحكم. النسخة المحلية تبقى ذاكرة مؤقتة للعمل بلا شبكة. */
function msgqPull(){
  try{
    if(!Array.isArray(CT_DATA.msgq)) return;
    const seen = new Set(MSGQ.map(m=>m.id+'|'+m.k));
    for(const it of CT_DATA.msgq) if(it && it.id && it.k && !seen.has(it.id+'|'+it.k)) MSGQ.push(it);
  }catch(e){}
}
/* قائمة عمل خاصة بك على هذا الجهاز — لا تُرفع للخادم ولا تُخلَط ببيانات الرصد */
function msgqSave(){
  try{ localStorage.setItem(MSGQ_KEY, JSON.stringify(MSGQ.slice(-200))); }catch(e){}
  try{ CT_DATA.msgq = MSGQ.slice(-200).map(m => Object.assign({at:Date.now()}, m)); save(); }catch(e){}
  try{ renderMsgList(); if(!$('mq-sheet').hidden) mqRender(); }catch(e){}
}
/* الإزالة توسم x:1 بدل الحذف — الحذف وحده يعيده اتحاد الخادم. */
function msgqRemove(i){
  const it = MSGQ[i]; if(!it) return;
  MSGQ.splice(i,1);
  try{
    CT_DATA.msgq = (Array.isArray(CT_DATA.msgq)?CT_DATA.msgq:[]).filter(m=>!(m.id===it.id&&m.k===it.k));
    CT_DATA.msgq.push({ id:it.id, k:it.k, name:it.name, x:1, at:Date.now() });
  }catch(e){}
  msgqSave();
}
const MSG_LABEL = k => {
  try{
    for(const [lbl,kk] of POS_MSGS) if(kk===k) return lbl;
    for(const [lbl,kk] of NEG_MSGS) if(kk===k) return lbl;
  }catch(e){}
  return 'رسالة';
};

function mvRender(){
  const box = $('mv-list'); if(!box) return;
  if(!MSGQ.length){ box.innerHTML=''; return; }
  /* 📍 مركز الإرسال صار لوحة التحكم: النسخ للواتساب أو الإرسال لبوابة الطالب.
     الجوال للتجهيز بالصوت فقط — فلا ازدواج ولا رسالة تُرسل مرتين. */
  box.innerHTML = `<div class="mv-ready">
      <b>${MSGQ.length} رسالة جاهزة</b>
      <span>تُرسل من لوحة التحكم: رسائل الطلاب ← الطابور من بوابة المعلم.</span>
      <button class="btn sm" type="button" id="mv-clear">مسح القائمة</button>
    </div>`;
  const c = $('mv-clear');
  if(c) c.onclick = async ()=>{
    if(!(await askConfirm('ستُزال كل الرسائل التي جهّزتها ولم تُرسل بعد.',{title:'مسح القائمة؟',yes:'امسح',no:'إبقاء',danger:true}))) return;
    for(let i=MSGQ.length-1;i>=0;i--) msgqRemove(i);
    mvRender();
  };
  return;
  const groups = new Map();                       // نوع الرسالة → عناصره
  MSGQ.forEach((m,i)=>{ if(!groups.has(m.k)) groups.set(m.k,[]); groups.get(m.k).push({...m,i}); });

  box.innerHTML = `<div class="actions" style="margin-bottom:8px">
      <button class="btn tick wide" type="button" id="mv-copy-all">📋 نسخ الكل (${MSGQ.length})</button>
      <button class="btn sm" type="button" id="mv-clear">مسح القائمة</button></div>`
    + [...groups.entries()].map(([k,items])=>`
      <div class="sheet" style="margin-bottom:9px;padding:10px">
        <div class="section-head" style="margin-bottom:6px">
          <h3 style="font-size:.86rem">${esc(MSG_LABEL(k))}</h3><span class="count">${items.length}</span></div>
        <div class="muted" style="font-size:.8rem;line-height:1.8;margin-bottom:7px">${items.map(x=>esc(x.name)).join(' · ')}</div>
        <div class="actions" style="margin-bottom:7px">
          <button class="btn sm" type="button" data-mvgroup="${esc(k)}">📋 نسخ هذه المجموعة (${items.length})</button></div>
        ${items.map(x=>`<div class="msg" style="margin-bottom:6px">
            <b style="font-size:.82rem">${esc(x.name)}</b>
            <div class="muted" style="margin:4px 0 6px;line-height:1.7">${esc(x.text)}</div>
            <button class="btn sm" type="button" data-mvcopy="${x.i}">📋 نسخ</button>
            <button class="btn sm" type="button" data-mvdel="${x.i}">حذف</button></div>`).join('')}
      </div>`).join('');

  const copyMany = arr => copyText(arr.map(m=>m.text).join('\n\n'))
    .then(()=>toast(`تم نسخ ${arr.length} رسالة`)).catch(()=>toast('تعذر النسخ'));
  $('mv-copy-all').onclick = ()=> copyMany(MSGQ);
  $('mv-clear').onclick = ()=>{ MSGQ=[]; msgqSave(); mvRender(); toast('مُسحت القائمة'); };
  box.querySelectorAll('[data-mvgroup]').forEach(b=> b.onclick = ()=> copyMany(groups.get(b.dataset.mvgroup)||[]));
  box.querySelectorAll('[data-mvcopy]').forEach(b=> b.onclick = ()=>
    copyText(MSGQ[+b.dataset.mvcopy].text).then(()=>toast('تم نسخ الرسالة')).catch(()=>toast('تعذر النسخ')));
  box.querySelectorAll('[data-mvdel]').forEach(b=> b.onclick = ()=>{
    msgqRemove(+b.dataset.mvdel); mvRender(); });
}

/* في صفحة الرسائل كلمة «رسالة» زائدة: «تركي رسالة شكر» = «تركي شكر» */
function mvClean(t){ return vrNorm(t).split(' ').filter(w=>w && !VR_MSG_LEAD.includes(w)).join(' '); }
function mvHandle(text){
  const heard=String(text||'').trim().slice(0,80);
  text=mvClean(text);
  const segs = vrSegmentsBy(text, vrMsgPhrases());
  if(!segs.length){ $('mv-status').textContent='لم أتعرف على الأمر، حاول مرة أخرى'; return; }
  let added = 0; const problems = [];
  for(const sg of segs){
    const { hits } = vrMatch(sg.name);
    if(hits.length !== 1){ problems.push(sg.name.join(' ') + (hits.length?' (أكثر من طالب)':' (غير موجود)')); continue; }
    if(!sg.kind){ problems.push(hits[0].name + ' (بلا نوع رسالة)'); continue; }
    const st = hits[0];
    const k=sg.kind.k;
    if(!msIsNeg(k)){   // 🌟 إيجابية ⟵ تُرسل للطالب (بعد 5 ثوانٍ قابلة للتراجع)
      if(msSentToday(st.id).some(x=>x.k===k)||msPending(st.id,k)){ problems.push(st.name + ' (أُرسلت اليوم)'); continue; }
      const P=msSend([{s:st,k,body:msgStu(k,st)}]);
      vbCard('mv-cards', { label:'📨 '+MSG_LABEL(k), cls:'b', name:st.name, heard,
        undo: async()=>{ if(msCancel(P)) return; toast('أُرسلت فعلًا — لا يمكن التراجع'); return false; } });
      added++; continue; }
    if(MSGQ.some(m => m.id===st.id && m.k===k)){ problems.push(st.name + ' (في لاحقًا سلفًا)'); continue; }
    const item={ id: st.id, name: st.name, k, text: msg(k, st), stu: msgStu(k, st), at: Date.now() };   // ⚠️ متابعة ⟵ «لاحقًا» لتنسخها لوليّ الأمر
    MSGQ.push(item);
    vbCard('mv-cards', { label:'🕘 '+MSG_LABEL(k), cls:'b', name:st.name, heard,
      undo: async()=>{ const i=MSGQ.indexOf(item); if(i<0){ toast('حُذفت مسبقًا'); return false; } msgqRemove(i); mvRender(); toast('أُزيلت الرسالة'); } });
    added++;
  }
  msgqSave();
  mvRender();
  $('mv-status').innerHTML = problems.length ? `⚠️ تعذّر: ${esc(problems.join('، '))}` : '';
  vbLive('mv', added ? `✓ ${added} — 🎙️ أستمع…` : '🎙️ أستمع…');
}

let mvRec = null, mvOn = false;
function mvStop(){
  mvOn = false; mvEng.stop();
  const b=$('mv-btn'); if(b){ b.textContent='🎤 رسائل بالصوت'; b.classList.remove('bad'); }
  vbOn('mv', false);
  const w=$('ms-voice'); if(w){ w.hidden=true; $('ms-voice-btn')?.classList.remove('on'); }
}
const mvEng = vbEngine('mv', {
  pick: r => { let bestT = String(r[0]?.transcript||''), bestN = -1;
    for(let i=0;i<r.length;i++){ const t = String(r[i].transcript||'').trim(); if(!t) continue;
      const n = vrSegmentsBy(mvClean(t), vrMsgPhrases()).filter(sg=> sg.kind && vrMatch(sg.name).hits.length===1).length;
      if(n > bestN){ bestN = n; bestT = t; } }
    return bestT; },
  onFinal: t => mvHandle(t),
  onFatal: m => { mvStop(); $('mv-status').textContent = m; },
  onStop: () => mvStop()
});
function mvStart(){
  if(!VR_SUP) return;
  mvOn = true;
  vbOn('mv', true); vbLive('mv','🎙️ أستمع… قل اسم الطالب ثم نوع الرسالة'); $('mv-status').innerHTML='';
  const w=$('ms-voice'); if(w){ w.hidden=false; $('ms-voice-btn')?.classList.add('on'); }
  mvEng.start();
}

function mvInit(){
  const w=$('mv-wrap'), b=$('mv-btn');
  mvRender();                                     // ما جهّزته سابقًا يظهر ولو أُغلق المتصفح
  if(!w || !b || !VR_SUP) return;                 // غير مدعوم: تبقى الرسائل يدوية كما هي
  w.style.display='block';
  b.addEventListener('click', e=>{ e.preventDefault(); mvOn ? mvStop() : mvStart(); });
  const x=$('mv-stop'); if(x) x.onclick=()=>mvStop();
}

/* 📨 قالب يدوي ⟶ مركز الرسائل.
   كانت القوالب تنسخ للحافظة فقط بينما الصوت والشهادة يدخلان المركز —
   فيصير مصدر الرسالة هو ما يقرر أين تنتهي، وهذا لا معنى له. */
function queueMessage(k){
  const s = studentForMessage();
  if(!s){ toast('اختر طالبًا أولًا'); return; }
  const body = msg(k, s);
  const i = MSGQ.findIndex(m => m.id===s.id && m.k===k);
  if(i>=0){ MSGQ[i].text = body; toast('حُدّثت في المركز'); }
  else { MSGQ.push({ id:s.id, name:s.name, k, text:body }); toast('أُضيفت إلى المركز'); }
  msgqSave();
  if(typeof mvRender==='function') mvRender();
}
/* ═══════════ 💌 صفحة الرسائل: قائمة ⟵ نافذة الطالب ═══════════ */
let MS_TAB='pos', MS_K='', MS_MULTI=false, MS_MS=false, MS_ALERT=false; const MS_SEL=new Set();
const msAlerts=()=>{ const ids=new Set(list($('cls')?.value||'').map(s=>s.id)); return alertsList().filter(a=>ids.has(a.studentId)); };
const msReady=sid=>MSGQ.filter(m=>m&&m.id===sid).length;
function msShort(n){ const p=String(n||'').split(' ').filter(w=>w&&w!=='بن'); return p.length>2?p[0]+' '+p[p.length-1]:p.join(' '); }
function renderMsgList(){
  const box=$('ms-list'); if(!box) return;
  const A=msAlerts(), alertIds=new Set(A.map(a=>a.studentId));
  const al=$('ms-alert'); if(al){ al.hidden=!A.length; $('ms-alert-t').textContent=`🔔 ${A.length} ${A.length===1?'يحتاج':'يحتاجون'} رسالة`; $('ms-alert-btn').textContent=MS_ALERT?'↩︎ الكل':'اعرضهم'; }
  if(!A.length) MS_ALERT=false;
  const q=String($('ms-q')?.value||'').trim(); let L=list($('cls')?.value||''); if(MS_ALERT) L=L.filter(s=>alertIds.has(s.id)); if(q) L=L.filter(s=>stuMatch(q,s.name));
  box.innerHTML=L.map((s,i)=>{ const r=msReady(s.id);
    return `<button type="button" class="bh-r${MS_MULTI&&MS_SEL.has(s.id)?' pick':''}${TPX4.msid===s.id&&!$('ms-sheet').hidden?' sel':''}" data-ms-open="${esc(s.id)}">${MS_MULTI?`<span class="mk">${MS_SEL.has(s.id)?'✓':''}</span>`:''}<i>${i+1}</i><span class="n">${esc(s.name)}</span><span class="bh-cnt">${msSentToday(s.id).length?'<span class="m2-tag ok">✓ أُرسلت اليوم</span>':''}${r?`<span class="m2-tag lt">🕘 ${r>1?r+' ':''}لاحقًا</span>`:''}${alertIds.has(s.id)?'<span class="m2-tag nd">🔔</span>':''}</span></button>`; }).join('')||'<div class="empty">لا يوجد طلاب مطابقون.</div>';
  const n=MSGQ.length, b=$('mq-badge'); if(b){ b.hidden=!n; b.textContent=n; }
  msMbar();
}
function msMbar(){ const b=$('ms-mbar'); if(!b) return; const n=MS_SEL.size;
  b.hidden=!(MS_MULTI&&n&&$('ms-sheet').hidden&&!!document.getElementById('ms-list'));
  $('ms-mgo').textContent=n===1?'جهّز رسالة لطالب واحد':n===2?'جهّز رسالة لطالبين':`جهّز رسالة لـ ${n} طلاب`; }
function msMulti(on){ MS_MULTI=!!on; if(!on){ MS_SEL.clear(); MS_MS=false; }
  $('ms-multi-btn')?.classList.toggle('on',MS_MULTI); $('ms-mode').hidden=!MS_MULTI; $('ms-hint').hidden=MS_MULTI; renderMsgList(); }
function msOpen(sid){ const s=TPX_STU().find(x=>x.id===String(sid)); if(!s) return; TPX4.msid=s.id; MS_MS=false; MS_WHEN='auto';
  const a=msAlerts().find(x=>x.studentId===s.id); MS_K=a&&a.suggest?a.suggest:''; MS_TAB=MS_K&&NEG_MSGS.some(([,k])=>k===MS_K)?'neg':'pos';
  $('ms-sheet').hidden=false; document.body.classList.add('bh-on'); msSheet(); renderMsgList(); }
function msOpenMulti(){ if(!MS_SEL.size) return; MS_MS=true; TPX4.msid=''; MS_K=''; MS_TAB='pos'; MS_WHEN='auto'; $('ms-sheet').hidden=false; document.body.classList.add('bh-on'); msSheet(); msMbar(); }
function msClose(){ $('ms-sheet').hidden=true; document.body.classList.remove('bh-on'); if(!MS_MS) TPX4.msid=''; MS_MS=false; renderMsgList(); }
function msTargets(){ return MS_MS?[...MS_SEL].map(id=>TPX_STU().find(x=>x.id===id)).filter(Boolean):[TPX_STU().find(x=>x.id===TPX4.msid)].filter(Boolean); }
/* 💬 صياغة موجّهة للطالب نفسه — تصل لبوابته. (msg() تبقى صياغة وليّ الأمر للنسخ) */
function msgStu(k,s,w){
 const n=firstName(s.name);
 if(w===undefined) w=msWhenAuto(s);
 const M={
  participation:`أحسنت يا ${n} 🌟 مشاركتك اليوم في حصة العلوم كانت رائعة، استمر!`,
  homework:`شكرًا يا ${n} 📚 على التزامك بإنجاز واجب العلوم، هذا ما أتوقعه منك.`,
  achievement:`أداء متميز يا ${n} 🏆 فخور بما قدّمته في مادة العلوم.`,
  improvement:`ألاحظ تحسّنك الواضح يا ${n} 🌱 في مادة العلوم، واصل على هذا المستوى.`,
  cooperation:`شكرًا يا ${n} 🤝 على تعاونك والتزامك داخل الحصة.`,
  science:`أعجبني اهتمامك وحرصك في مادة العلوم يا ${n} 🧪 استمر.`,
  behavior:`${n}، لاحظت عليك اليوم سلوكًا لا يليق بك في حصة العلوم، وأنا واثق أنك ستتجاوزه 👍`,
  homework_neg:`${n}، لم تنجز واجب العلوم 📚 أرجو أن تنجزه في أقرب وقت.`,
  late:`${n}، لاحظت تأخرك عن حصة العلوم أكثر من مرة ⏰ أنتظرك في الموعد 👍`,
  support:`${n}، تحتاج إلى مزيد من المتابعة في مادة العلوم 📝 لا تتردد في سؤالي عن أي شيء.`,
  skill:`${n}، أنصحك بمزيد من التدريب على مهارات العلوم 🎯 وأنا معك.`
 };
 if(!M[k]) return '';
 return M[k] + (w&&!MS_NOWHEN.includes(k) ? `\n📅 ${w.day}${w.p?` · الحصة ${CTX_ORD[w.p]||w.p}`:''}` : '');
}
/* 📅 اليوم والحصة */
const MS_NOWHEN=['support','skill'];   // حالة عامة لا حدث في حصة
let MS_WHEN='auto';
const msDayName=()=>{ try{ return new Date().toLocaleDateString('ar-SA',{weekday:'long',timeZone:'Asia/Riyadh'}); }catch(e){ return ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][new Date().getDay()]; } };
function msPeriodsFor(cls){ try{ const r=ctxResolve(); if(r.dow<0||r.dow>4) return []; const c=String(cls||'').trim();
  return r.T.filter(t=>r.clsOf(t.n)===c).map(t=>({n:t.n,started:r.now>=t.sm-5})); }catch(e){ return []; } }
/* الحصة الحالية لفصل الطالب، وإلا آخر حصة له اليوم بدأت فعلًا */
function msAutoP(s){ const st=msPeriodsFor(s&&s.cls).filter(x=>x.started); return st.length?st[st.length-1].n:0; }
function msWhenAuto(s){ return { day:msDayName(), p:msAutoP(s) }; }
function msWhen(s){ if(MS_WHEN==='none') return null; const day=msDayName();
  if(MS_WHEN==='day') return {day,p:0}; if(MS_WHEN.startsWith('p:')) return {day,p:+MS_WHEN.slice(2)}; return msWhenAuto(s); }
function msWhenOpts(T){
  const day=msDayName(), ords=n=>CTX_ORD[n]||n, s0=T[0];
  const same=T.every(x=>String(x.cls||'')===String(s0.cls||'')), ap=msAutoP(s0);
  const o=[['auto', same ? (ap?`اليوم ${day} · الحصة ${ords(ap)}`:`اليوم ${day}`) : `اليوم ${day} · حصة كل طالب`]];
  if(same) msPeriodsFor(s0.cls).forEach(x=>{ if(x.n!==ap) o.push(['p:'+x.n,`اليوم ${day} · الحصة ${ords(x.n)}`]); });
  if(ap||!same) o.push(['day',`اليوم ${day} فقط`]);
  o.push(['none','بدون يوم ولا حصة']);
  return o;
}
const msIsNeg=k=>NEG_MSGS.some(([,x])=>x===k);
const msCustom=s=>($('custom-msg').value||'').replaceAll('{الطالب}',firstName(s.name)).replaceAll('{الاسم الكامل}',s.name).replaceAll('{الفصل}',s.cls||'').trim();
/* النص الظاهر في النافذة: الإيجابية والمخصصة للطالب، المتابعة لوليّ الأمر */
function msText(s){ if(MS_TAB==='custom') return msCustom(s); if(!MS_K) return ''; return msIsNeg(MS_K)?msg(MS_K,s,msWhen(s)):msgStu(MS_K,s,msWhen(s)); }
/* ✓ سجل ما أُرسل (على هذا الجهاز) — يمنع إرسال نفس الرسالة مرتين في اليوم */
const MS_SENT_KEY='teacher_msgsent_v1';
let MS_SENT=[]; try{ MS_SENT=JSON.parse(localStorage.getItem(MS_SENT_KEY)||'[]')||[]; }catch(e){ MS_SENT=[]; }
const msDay=t=>new Date(t+3*36e5).toISOString().slice(0,10);
function msSentToday(sid){ const d=msDay(Date.now()); return MS_SENT.filter(x=>x.id===sid&&msDay(x.at)===d); }
function msSentAdd(id,k){ MS_SENT.push({id,k,at:Date.now()}); MS_SENT=MS_SENT.filter(x=>Date.now()-x.at<30*864e5).slice(-400); try{ localStorage.setItem(MS_SENT_KEY,JSON.stringify(MS_SENT)); }catch(e){} }
const msLbl=k=>k==='custom'?'✏️ رسالة من معلمك':k==='cert'?'🏅 شهادة تقدير':MSG_LABEL(k);
/* 📨 الإرسال المؤجل 5 ثوانٍ: تراجع حقيقي — لا يخرج شيء قبل انتهاء المهلة */
const MS_PEND=new Set(); let MS_LAST=null;
function msSend(items, label){
  items=items.filter(x=>x&&x.s&&x.body); if(!items.length) return null;
  const P={items, left:5, label: label||(items.length>1?`✓ أُرسلت لـ ${items.length} طلاب`:`✓ أُرسلت ل${msShort(items[0].s.name)}`)};
  P.tick=setInterval(()=>{ P.left--; if(MS_LAST===P) msUndoBar(); if(P.left<=0) msFlush(P); },1000);
  MS_PEND.add(P); MS_LAST=P; msUndoBar(); renderMsgList(); return P;
}
function msUndoBar(){ const b=$('ms-undo'); if(!b) return; const P=MS_LAST;
  if(!P||!MS_PEND.has(P)){ b.hidden=true; return; }
  b.hidden=false; $('ms-undo-t').textContent=P.label; $('ms-undo-b').textContent=`↩︎ تراجع ${P.left}`; }
function msCancel(P){ if(!P||!MS_PEND.has(P)) return false; clearInterval(P.tick); MS_PEND.delete(P); if(MS_LAST===P) MS_LAST=null; msUndoBar(); renderMsgList(); toast('↩︎ أُلغي الإرسال'); return true; }
async function msFlush(P){
  if(!MS_PEND.has(P)) return; clearInterval(P.tick); MS_PEND.delete(P); msUndoBar();
  let fail=0;
  for(const it of P.items){
    const b={ t:getTok(), audience:'students', title:it.title||msLbl(it.k), body:it.body, type:it.k==='cert'?'cert':'note', priority:'normal', recipients:[{id:it.s.id,name:it.s.name}] };
    let ok=false;
    try{ const r=await fetch(ctApi()+'/messages',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}); const j=await r.json().catch(()=>({})); ok=r.ok&&j.ok; }catch(e){}
    if(ok){ msSentAdd(it.s.id,it.k); const i=MSGQ.findIndex(m=>m.id===it.s.id&&m.k===it.k); if(i>=0) msgqRemove(i); }
    else { fail++; if(!MSGQ.some(m=>m.id===it.s.id&&m.k===it.k)) MSGQ.push({id:it.s.id,name:it.s.name,k:it.k,text:it.body}); }
  }
  if(fail){ msgqSave(); toast(`⚠️ تعذّر إرسال ${fail} — حُفظت في 🕘 لاحقًا`); }
  renderMsgList(); try{ msSheet(); if(!$('mq-sheet').hidden) mqRender(); }catch(e){}
}
function msFlushAll(){ [...MS_PEND].forEach(P=>{ P.left=0; msFlush(P); }); }
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') msFlushAll(); });
window.addEventListener('pagehide',msFlushAll);
const msPending=(sid,k)=>[...MS_PEND].some(P=>P.items.some(x=>x.s.id===sid&&(k==null||x.k===k)));
/* قبل الإرسال: نفس الرسالة أُرسلت اليوم؟ */
async function msDupOk(T,k){ const d=T.filter(s=>msSentToday(s.id).some(x=>x.k===k)||msPending(s.id,k)); if(!d.length) return true;
  return askConfirm(d.length===1?`أُرسلت ل${msShort(d[0].name)} نفس الرسالة اليوم.`:`${d.length} منهم أُرسلت لهم نفس الرسالة اليوم.`,{title:'إرسال مرة ثانية؟',yes:'أرسل',no:'إلغاء'}); }
function msDone(){ const multi=MS_MS; msClose(); if(multi) msMulti(false); }
async function msAct(a){
  const T=msTargets(); if(!T.length) return;
  const k=MS_TAB==='custom'?'custom':MS_K; if(!k||(MS_TAB==='custom'&&!msCustom(T[0]))){ toast('اكتب الرسالة أولًا'); return; }
  if(a==='send'||a==='sendneg'){
    const body=s=>MS_TAB==='custom'?msCustom(s):msgStu(k,s,msWhen(s));
    if(a==='sendneg' && !(await askConfirm(`تصل ${T.length>1?'لكل طالب':'للطالب'} في بوابته:\n«${body(T[0])}»`,{title:'إرسال للطالب؟',yes:'📨 أرسل',no:'إلغاء'}))) return;
    if(!(await msDupOk(T,k))) return;
    msSend(T.map(s=>({s,k,body:body(s)}))); msDone(); return; }
  if(a==='copy'||a==='copyp'){ const txt=T.map(s=>msText(s)).filter(Boolean);
    copyText(txt.join('\n\n')).then(()=>toast(a==='copyp'?(T.length>1?`📋 نُسخت ${txt.length} رسائل لأولياء الأمور`:'📋 نُسخت — الصقها لوليّ الأمر'):(T.length>1?`تم نسخ ${txt.length} رسائل`:'تم نسخ الرسالة'))).catch(()=>toast('تعذر النسخ')); return; }
  if(a==='later'){ let n=0;
    for(const s of T){ const b=msText(s); if(!b) continue; const stu=MS_TAB==='custom'?b:msgStu(k,s,msWhen(s)), at=Date.now();
      const i=MSGQ.findIndex(m=>m.id===s.id&&m.k===k); if(i>=0) Object.assign(MSGQ[i],{text:b,stu,at}); else MSGQ.push({id:s.id,name:s.name,k,text:b,stu,at}); n++; }
    msgqSave(); if(typeof mvRender==='function') mvRender(); msDone();
    toast(n>1?`🕘 حُفظت ${n} رسائل في «لاحقًا»`:'🕘 حُفظت في «لاحقًا»'); }
}
function msCopy(){ return msAct('copy'); }
function msQueue(){ return msAct('later'); }
function msSheet(){
  if($('ms-sheet').hidden) return;
  const T=msTargets(); if(!T.length) return;
  if(MS_MS){ $('ms-sh-name').textContent=`${T.length} ${T.length===2?'طالبان':'طلاب'}: ${T.slice(0,4).map(x=>msShort(x.name)).join(' · ')}${T.length>4?' …':''}`; $('ms-sh-cls').textContent='تُكتب الرسالة باسم كل طالب'; $('ms-sh-cnt').innerHTML=''; $('ms-why').innerHTML=''; }
  else { const s=T[0], r=msReady(s.id), a=msAlerts().find(x=>x.studentId===s.id), sent=msSentToday(s.id);
    $('ms-sh-name').textContent=s.name; $('ms-sh-cls').textContent=s.cls||''; $('ms-sh-cnt').innerHTML=(sent.length?`<span class="m2-tag ok">✓ ${sent.length>1?sent.length+' ':''}اليوم</span>`:'')+(r?`<span class="m2-tag lt">🕘 ${r}</span>`:'');
    $('ms-why').innerHTML=a?`<div class="ms-why ${a.tone==='positive'?'g':'r'}"><span>🔔 ${esc(a.reason)}${a.date?` · آخرها ${esc(a.date)}`:''}</span><button type="button" data-alert-done="${esc(JSON.stringify(a.dismiss||{[a.key]:a.count}))}">✓ تم التواصل</button></div>`:''; }
  document.querySelectorAll('[data-ms-tab]').forEach(b=>b.classList.toggle('on',b.dataset.msTab===MS_TAB));
  $('ms-custom').hidden=MS_TAB!=='custom';
  const arr=MS_TAB==='pos'?POS_MSGS:MS_TAB==='neg'?NEG_MSGS:[];
  $('ms-chips').innerHTML=arr.map(([t,k])=>`<button type="button" class="bh-chip ${MS_TAB==='pos'?'g':'r'}${MS_K===k?' on':''}" data-msk="${esc(k)}">${esc(t)}</button>`).join('');
  const t=msText(T[0]), show=!!t, neg=MS_TAB==='neg', N=T.length, many=N>1, fn=msShort(T[0].name).split(' ')[0];
  $('ms-prev').hidden=!show; $('ms-act').hidden=!show; $('ms-alt').hidden=!(show&&neg);
  const ww=$('ms-when-w'); ww.hidden=!(show&&MS_TAB!=='custom'&&!MS_NOWHEN.includes(MS_K));
  if(!ww.hidden){ const o=msWhenOpts(T); if(!o.some(([v])=>v===MS_WHEN)) MS_WHEN='auto';
    $('ms-when').innerHTML=o.map(([v,l])=>`<option value="${v}"${v===MS_WHEN?' selected':''}>${esc(l)}</option>`).join(''); }
  $('ms-prev').classList.toggle('par',neg);
  if(!show) return;
  $('ms-prev-h').textContent=(neg?'👨‍👩‍👦 لوليّ الأمر':'💬 تصل للطالب في بوابته مع إشعار')+(many?` · مثال: ${msShort(T[0].name)}`:'');
  $('ms-prev-t').textContent=t;
  $('ms-act').innerHTML=neg
    ? `<button type="button" class="b" data-ms-act="copyp">📋 نسخ لوليّ الأمر${many?` (${N})`:''}</button><button type="button" class="s" data-ms-act="sendneg">📨 للطالب</button><button type="button" class="s" data-ms-act="later">🕘 لاحقًا</button>`
    : `<button type="button" class="p" data-ms-act="send">📨 ${many?`أرسل للـ${N}`:`أرسل ل${esc(fn)}`}</button><button type="button" class="s" data-ms-act="later">🕘 لاحقًا</button><button type="button" class="s" data-ms-act="copy">📋 نسخ</button>`;
  if(neg) $('ms-alt').textContent=`«📨 للطالب» يرسل له بصيغة موجّهة له بعد تأكيد: «${msgStu(MS_K,T[0])}»`;
}
/* 🕘 قائمة «لاحقًا» */
function mqItemBody(m){ if(m.stu) return m.stu; const s=TPX_STU().find(x=>x.id===m.id)||{id:m.id,name:m.name}; return (m.k&&msgStu(m.k,s,null))||m.text||''; }
/* رسالة أُجّلت لغير يومها: «اليوم الأحد» ⟵ «يوم الأحد 12/4» حتى يبقى التوثيق صحيحًا */
function mqText(m){ let t=m.text||''; if(m.at && msDay(m.at)!==msDay(Date.now())){ const d=new Date(m.at+3*36e5); t=t.replace(/اليوم (الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت)/,(x,dn)=>`يوم ${dn} ${d.getUTCDate()}/${d.getUTCMonth()+1}`); } return t; }
function mqRender(){ const box=$('mq-list'); if(!box) return;
  box.innerHTML=MSGQ.length?MSGQ.map((m,i)=>`<div class="mq-r${msIsNeg(m.k)?' neg':''}"><div class="t"><b>${esc(msShort(m.name))}</b> — ${esc(m.k==='custom'?'✏️ مخصصة':msLbl(m.k))}<small>${esc(mqText(m))}</small></div><button type="button" class="beh-del" data-mq-send="${i}" title="${msIsNeg(m.k)?'إرسال للطالب بصيغة موجّهة له':'إرسال للطالب'}" aria-label="إرسال">📨</button><button type="button" class="beh-del" data-mq-copy="${i}" aria-label="نسخ">📋</button><button type="button" class="beh-del" data-mq-del="${i}" aria-label="حذف">🗑</button></div>`).join(''):'<div class="empty">لا توجد رسائل مؤجلة.</div>';
  $('mq-foot').hidden=!MSGQ.length; $('mq-sendall').textContent=`📨 أرسل الكل للطلاب (${MSGQ.length})`; }
function mqOpen(on){ $('mq-sheet').hidden=!on; document.body.classList.toggle('bh-on',!!on); if(on) mqRender(); }
async function mqSend(idx){
  const L=idx.map(i=>MSGQ[i]).filter(Boolean); if(!L.length) return;
  if(L.some(m=>msIsNeg(m.k)) && !(await askConfirm('رسائل المتابعة تصل للطالب بصيغة موجّهة له (لا صيغة وليّ الأمر).',{title:`إرسال ${L.length>1?L.length+' رسائل':'الرسالة'} للطلاب؟`,yes:'📨 أرسل',no:'إلغاء'}))) return;
  const items=L.map(m=>({s:TPX_STU().find(x=>x.id===m.id)||{id:m.id,name:m.name},k:m.k,body:mqItemBody(m),title:m.k==='cert'?'🏅 شهادة تقدير':''}));
  // تُزال من «لاحقًا» عند نجاح الإرسال فعلًا (msFlush)، والتراجع يبقيها
  msSend(items); mqRender(); }

function useMessage(k){const s=studentForMessage();if(!s){toast('اختر طالبًا أولًا');return}const t=msg(k,s);$('message-preview').textContent=t;copyText(t).then(()=>toast('تم نسخ الرسالة')).catch(()=>toast('تعذر النسخ'))}

/* ── السجلات ── */
const CTX_ORD = ['','الأولى','الثانية','الثالثة','الرابعة','الخامسة','السادسة','السابعة','الثامنة'];
const ctxOrd = n => CTX_ORD[n] || String(n);

/* ───────────── تصدير لأزرار الصفحة (onclick) ───────────── */
if(typeof window.VR_SUP==='undefined') window.VR_SUP=VR_SUP;
if(typeof window.vrNorm==='undefined') window.vrNorm=vrNorm;
if(typeof window.VR_SKIP==='undefined') window.VR_SKIP=VR_SKIP;
if(typeof window.VR_JOIN==='undefined') window.VR_JOIN=VR_JOIN;
if(typeof window.vrTokens==='undefined') window.vrTokens=vrTokens;
if(typeof window.vrBare==='undefined') window.vrBare=vrBare;
if(typeof window.vrEq==='undefined') window.vrEq=vrEq;
if(typeof window.vrLev1==='undefined') window.vrLev1=vrLev1;
if(typeof window.vrNear==='undefined') window.vrNear=vrNear;
if(typeof window.vrKw==='undefined') window.vrKw=vrKw;
if(typeof window.vrKwEq==='undefined') window.vrKwEq=vrKwEq;
if(typeof window.VR_KINDS==='undefined') window.VR_KINDS=VR_KINDS;
if(typeof window.vrBehaviors==='undefined') window.vrBehaviors=vrBehaviors;
if(typeof window.vrPhrases==='undefined') window.vrPhrases=vrPhrases;
if(typeof window.vrSegments==='undefined') window.vrSegments=vrSegments;
if(typeof window.vrSegmentsBy==='undefined') window.vrSegmentsBy=vrSegmentsBy;
if(typeof window.VR_MSG_LEAD==='undefined') window.VR_MSG_LEAD=VR_MSG_LEAD;
if(typeof window.vrMsgUnified==='undefined') window.vrMsgUnified=vrMsgUnified;
if(typeof window.VR_MSG_ALIAS==='undefined') window.VR_MSG_ALIAS=VR_MSG_ALIAS;
if(typeof window.vrMsgPhrases==='undefined') window.vrMsgPhrases=vrMsgPhrases;
if(typeof window.vrParse==='undefined') window.vrParse=vrParse;
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
if(typeof window.copyText==='undefined') window.copyText=copyText;
if(typeof window.copyCustomMessage==='undefined') window.copyCustomMessage=copyCustomMessage;
if(typeof window.POS_MSGS==='undefined') window.POS_MSGS=POS_MSGS;
if(typeof window.NEG_MSGS==='undefined') window.NEG_MSGS=NEG_MSGS;
if(typeof window.alertSuggest==='undefined') window.alertSuggest=alertSuggest;
if(typeof window.alertsList==='undefined') window.alertsList=alertsList;
if(typeof window.markMessaged==='undefined') window.markMessaged=markMessaged;
if(typeof window.renderAlerts==='undefined') window.renderAlerts=renderAlerts;
if(typeof window.studentForMessage==='undefined') window.studentForMessage=studentForMessage;
if(typeof window.fillMessageSearch==='undefined') window.fillMessageSearch=fillMessageSearch;
if(typeof window.selectMessageStudent==='undefined') window.selectMessageStudent=selectMessageStudent;
if(typeof window.clearMessageStudent==='undefined') window.clearMessageStudent=clearMessageStudent;
if(typeof window.NAME_PREFIX==='undefined') window.NAME_PREFIX=NAME_PREFIX;
if(typeof window.firstName==='undefined') window.firstName=firstName;
if(typeof window.msg==='undefined') window.msg=msg;
if(typeof window.renderMessages==='undefined') window.renderMessages=renderMessages;
if(typeof window.MSGQ_KEY==='undefined') window.MSGQ_KEY=MSGQ_KEY;
if(typeof window.MSGQ==='undefined') window.MSGQ=MSGQ;
if(typeof window.msgqPull==='undefined') window.msgqPull=msgqPull;
if(typeof window.msgqSave==='undefined') window.msgqSave=msgqSave;
if(typeof window.msgqRemove==='undefined') window.msgqRemove=msgqRemove;
if(typeof window.MSG_LABEL==='undefined') window.MSG_LABEL=MSG_LABEL;
if(typeof window.mvRender==='undefined') window.mvRender=mvRender;
if(typeof window.mvClean==='undefined') window.mvClean=mvClean;
if(typeof window.mvHandle==='undefined') window.mvHandle=mvHandle;
if(typeof window.mvRec==='undefined') window.mvRec=mvRec;
if(typeof window.mvOn==='undefined') window.mvOn=mvOn;
if(typeof window.mvStop==='undefined') window.mvStop=mvStop;
if(typeof window.mvEng==='undefined') window.mvEng=mvEng;
if(typeof window.mvStart==='undefined') window.mvStart=mvStart;
if(typeof window.mvInit==='undefined') window.mvInit=mvInit;
if(typeof window.queueMessage==='undefined') window.queueMessage=queueMessage;
if(typeof window.MS_TAB==='undefined') window.MS_TAB=MS_TAB;
if(typeof window.MS_K==='undefined') window.MS_K=MS_K;
if(typeof window.MS_MULTI==='undefined') window.MS_MULTI=MS_MULTI;
if(typeof window.MS_MS==='undefined') window.MS_MS=MS_MS;
if(typeof window.MS_ALERT==='undefined') window.MS_ALERT=MS_ALERT;
if(typeof window.MS_SEL==='undefined') window.MS_SEL=MS_SEL;
if(typeof window.msAlerts==='undefined') window.msAlerts=msAlerts;
if(typeof window.msReady==='undefined') window.msReady=msReady;
if(typeof window.msShort==='undefined') window.msShort=msShort;
if(typeof window.renderMsgList==='undefined') window.renderMsgList=renderMsgList;
if(typeof window.msMbar==='undefined') window.msMbar=msMbar;
if(typeof window.msMulti==='undefined') window.msMulti=msMulti;
if(typeof window.msOpen==='undefined') window.msOpen=msOpen;
if(typeof window.msOpenMulti==='undefined') window.msOpenMulti=msOpenMulti;
if(typeof window.msClose==='undefined') window.msClose=msClose;
if(typeof window.msTargets==='undefined') window.msTargets=msTargets;
if(typeof window.msgStu==='undefined') window.msgStu=msgStu;
if(typeof window.MS_NOWHEN==='undefined') window.MS_NOWHEN=MS_NOWHEN;
if(typeof window.MS_WHEN==='undefined') window.MS_WHEN=MS_WHEN;
if(typeof window.msDayName==='undefined') window.msDayName=msDayName;
if(typeof window.msPeriodsFor==='undefined') window.msPeriodsFor=msPeriodsFor;
if(typeof window.msAutoP==='undefined') window.msAutoP=msAutoP;
if(typeof window.msWhenAuto==='undefined') window.msWhenAuto=msWhenAuto;
if(typeof window.msWhen==='undefined') window.msWhen=msWhen;
if(typeof window.msWhenOpts==='undefined') window.msWhenOpts=msWhenOpts;
if(typeof window.msIsNeg==='undefined') window.msIsNeg=msIsNeg;
if(typeof window.msCustom==='undefined') window.msCustom=msCustom;
if(typeof window.msText==='undefined') window.msText=msText;
if(typeof window.MS_SENT_KEY==='undefined') window.MS_SENT_KEY=MS_SENT_KEY;
if(typeof window.MS_SENT==='undefined') window.MS_SENT=MS_SENT;
if(typeof window.msDay==='undefined') window.msDay=msDay;
if(typeof window.msSentToday==='undefined') window.msSentToday=msSentToday;
if(typeof window.msSentAdd==='undefined') window.msSentAdd=msSentAdd;
if(typeof window.msLbl==='undefined') window.msLbl=msLbl;
if(typeof window.MS_PEND==='undefined') window.MS_PEND=MS_PEND;
if(typeof window.MS_LAST==='undefined') window.MS_LAST=MS_LAST;
if(typeof window.msSend==='undefined') window.msSend=msSend;
if(typeof window.msUndoBar==='undefined') window.msUndoBar=msUndoBar;
if(typeof window.msCancel==='undefined') window.msCancel=msCancel;
if(typeof window.msFlush==='undefined') window.msFlush=msFlush;
if(typeof window.msFlushAll==='undefined') window.msFlushAll=msFlushAll;
if(typeof window.msPending==='undefined') window.msPending=msPending;
if(typeof window.msDupOk==='undefined') window.msDupOk=msDupOk;
if(typeof window.msDone==='undefined') window.msDone=msDone;
if(typeof window.msAct==='undefined') window.msAct=msAct;
if(typeof window.msCopy==='undefined') window.msCopy=msCopy;
if(typeof window.msQueue==='undefined') window.msQueue=msQueue;
if(typeof window.msSheet==='undefined') window.msSheet=msSheet;
if(typeof window.mqItemBody==='undefined') window.mqItemBody=mqItemBody;
if(typeof window.mqText==='undefined') window.mqText=mqText;
if(typeof window.mqRender==='undefined') window.mqRender=mqRender;
if(typeof window.mqOpen==='undefined') window.mqOpen=mqOpen;
if(typeof window.mqSend==='undefined') window.mqSend=mqSend;
if(typeof window.useMessage==='undefined') window.useMessage=useMessage;
if(typeof window.CTX_ORD==='undefined') window.CTX_ORD=CTX_ORD;
if(typeof window.ctxOrd==='undefined') window.ctxOrd=ctxOrd;
/* ───────────── 43-messages-shim: الصفحة وربطها ───────────── */
function tpx4HTML(){ return `
  <div class="rd-head"><h1>رسائل الحصة</h1>
    <button type="button" class="rd-ic bh-logb" id="mq-btn" title="رسائل لاحقًا" aria-label="رسائل لاحقًا">🕘<em id="mq-badge" hidden></em></button>
    <button type="button" class="rd-ic" id="ms-multi-btn" title="رسالة لعدة طلاب" aria-label="تحديد عدة طلاب">☑️</button>
    <button type="button" class="rd-ic" id="ms-search-btn" title="بحث داخل الفصل" aria-label="بحث داخل الفصل">🔍</button>
    <button type="button" class="rd-ic" id="ms-voice-btn" title="رسائل بالصوت" aria-label="رسائل بالصوت">🎤</button></div>
  <div class="vb" id="ms-voice" hidden>
    <div id="mv-wrap" style="margin-top:10px;display:none">
      <button class="btn" id="mv-btn" type="button" style="width:100%;min-height:52px;font-size:1rem;font-weight:700">🎤 رسائل بالصوت</button>
      <div class="vb-bar" id="mv-bar" hidden><span class="vb-dot"></span><div class="vb-live" id="mv-live">أستمع…</div><button type="button" class="vb-stop" id="mv-stop">⏹️ إيقاف</button></div>
      <div class="vr-hint">قل اسم الطالب ثم نوع الرسالة</div>
      <div id="mv-status" class="muted" style="margin-top:6px;font-size:.8rem;line-height:1.7"></div>
      <div class="vr-cards" id="mv-cards"></div>
    </div>
  </div>
  <div id="ms-search" hidden><div class="search"><span class="search-icon">🔍</span><input class="inp" id="ms-q" autocomplete="off" placeholder="ابحث عن طالب…"></div></div>
  <div class="m2-alert" id="ms-alert" hidden><b id="ms-alert-t"></b><button type="button" id="ms-alert-btn">اعرضهم</button></div>
  <div class="bh-mode" id="ms-mode" hidden><b>☑️ رسالة لعدة طلاب — اضغط على الطلاب</b><button type="button" id="ms-all">تحديد الكل</button><button type="button" id="ms-mcancel">إلغاء</button></div>
  <div class="bh-hint" id="ms-hint">اضغط الطالب لكتابة رسالة <small>· ✓ أُرسلت اليوم · 🕘 لاحقًا · 🔔 يحتاج</small></div>
  <div id="ms-list" class="bh-list"></div>
  <div hidden><div class="sheet" id="alerts-sheet" style="display:none"><span id="alerts-count"></span><div id="alerts-list"></div></div>
    <input id="m-search"><div id="m-results"></div><div id="m-selected"></div><div id="positive-msgs"></div><div id="negative-msgs"></div>
    <div id="message-preview"></div><div id="mv-list"></div></div>`; }
function tpx4SheetsHTML(){ return `
<div id="ms-sheet" class="tpx" hidden>
  <div class="bh-veil" data-ms-close></div>
  <div class="bh-box" role="dialog" aria-modal="true" aria-labelledby="ms-sh-name">
    <div class="bh-sh-h"><div class="bh-sh-n"><b id="ms-sh-name"></b><small id="ms-sh-cls"></small></div><span class="bh-cnt" id="ms-sh-cnt"></span><button type="button" class="bh-x" data-ms-close aria-label="إغلاق">✕</button></div>
    <div id="ms-why"></div>
    <div class="bh-tabs" role="tablist"><button type="button" class="on g" data-ms-tab="pos">🌟 إيجابية</button><button type="button" class="r" data-ms-tab="neg">⚠️ متابعة</button><button type="button" class="c" data-ms-tab="custom">✏️ مخصصة</button></div>
    <div class="bh-chips" id="ms-chips"></div>
    <label class="ms-when" id="ms-when-w" hidden><span>📅</span><select id="ms-when" aria-label="اليوم والحصة"></select></label>
    <div id="ms-custom" hidden><textarea class="inp" id="custom-msg" rows="3" placeholder="اكتب الرسالة… {الطالب} للاسم الأول، {الاسم الكامل}، {الفصل}"></textarea></div>
    <div class="m2-prev" id="ms-prev" hidden><small id="ms-prev-h">نص الرسالة</small><div id="ms-prev-t"></div></div>
    <div class="m2-act" id="ms-act" hidden></div>
    <div class="m2-alt" id="ms-alt" hidden></div>
  </div>
</div>
<div id="mq-sheet" class="tpx" hidden>
  <div class="bh-veil" data-mq-close></div>
  <div class="bh-box" role="dialog" aria-modal="true" aria-labelledby="mq-title">
    <div class="bh-sh-h"><div class="bh-sh-n"><b id="mq-title">🕘 رسائل لاحقًا</b><small>أرسلها من هنا متى شئت</small></div><button type="button" class="bh-x" data-mq-close aria-label="إغلاق">✕</button></div>
    <div id="mq-list"></div>
    <div class="m2-act" id="mq-foot"><button type="button" class="p" id="mq-sendall"></button><button type="button" class="s" id="mq-clear">مسح القائمة</button></div>
  </div>
</div>
<div class="ms-undo tpx" id="ms-undo" hidden><span id="ms-undo-t"></span><button type="button" id="ms-undo-b">↩︎ تراجع</button></div>
<div class="bh-mbar tpx" id="ms-mbar" hidden><button type="button" class="go" id="ms-mgo"></button><button type="button" class="x" id="ms-mx">إلغاء</button></div>`; }
function tpx4Sheets(){
  if (document.getElementById('ms-sheet')) return;
  const w = document.createElement('div'); w.innerHTML = tpx4SheetsHTML(); [...w.children].forEach(c => document.body.appendChild(c));
  $('ms-chips').addEventListener('click', e => { const c = e.target.closest('[data-msk]'); if (!c) return; MS_K = c.dataset.msk; msSheet(); });
  document.querySelectorAll('[data-ms-tab]').forEach(b => b.onclick = () => { MS_TAB = b.dataset.msTab; if (MS_TAB !== 'custom' && !(MS_TAB === 'pos' ? POS_MSGS : NEG_MSGS).some(([, k]) => k === MS_K)) MS_K = ''; msSheet(); if (MS_TAB === 'custom') $('custom-msg').focus(); });
  $('custom-msg').addEventListener('input', () => msSheet());
  document.querySelectorAll('[data-ms-close]').forEach(b => b.onclick = msClose);
  $('ms-act').addEventListener('click', e => { const b = e.target.closest('[data-ms-act]'); if (b) msAct(b.dataset.msAct); });
  $('ms-why').addEventListener('click', e => { const b = e.target.closest('[data-alert-done]'); if (!b) return; try { markMessaged(JSON.parse(b.dataset.alertDone)).then(() => { try { msSheet(); renderMsgList(); } catch (x) {} }); } catch (x) { toast('تعذّر التحديث'); } });
  $('ms-undo-b').onclick = () => msCancel(MS_LAST);
  $('ms-when').onchange = e => { MS_WHEN = e.target.value; msSheet(); };
  $('mq-sendall').onclick = () => mqSend(MSGQ.map((_, i) => i));
  $('ms-mx').onclick = () => msMulti(false);
  $('ms-mgo').onclick = msOpenMulti;
  document.querySelectorAll('[data-mq-close]').forEach(b => b.onclick = () => mqOpen(false));
  $('mq-list').addEventListener('click', e => { const b = e.target.closest('[data-mq-del],[data-mq-send],[data-mq-copy]'); if (!b) return;
    if (b.dataset.mqSend !== undefined) { mqSend([+b.dataset.mqSend]); return; }
    if (b.dataset.mqCopy !== undefined) { const m = MSGQ[+b.dataset.mqCopy]; if (m) copyText(mqText(m)).then(() => toast('تم نسخ الرسالة')).catch(() => toast('تعذر النسخ')); return; }
    msgqRemove(+b.dataset.mqDel); mqRender(); renderMsgList(); });
  $('mq-clear').onclick = async () => { if (!(await askConfirm('ستُزال كل الرسائل التي جهّزتها ولم تُرسل بعد.', { title: 'مسح القائمة؟', yes: 'امسح', no: 'إلغاء', danger: true }))) return; for (let i = MSGQ.length - 1; i >= 0; i--) msgqRemove(i); mqRender(); renderMsgList(); };
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!$('ms-sheet').hidden) msClose(); if (!$('mq-sheet').hidden) mqOpen(false); });
}
window.tpx4Mount = function(box){
  TPX4.cls = ctValidCls(window._ctMsCls); tpx4Sheets(); box.classList.add('tpx', 'tpx-root'); box.innerHTML = tpx4HTML();
  $('ms-list').addEventListener('click', e => { const r = e.target.closest('[data-ms-open]'); if (!r) return;
    if (MS_MULTI) { const id = r.dataset.msOpen; MS_SEL.has(id) ? MS_SEL.delete(id) : MS_SEL.add(id); renderMsgList(); return; } msOpen(r.dataset.msOpen); });
  $('ms-multi-btn').onclick = () => msMulti(!MS_MULTI);
  $('ms-mcancel').onclick = () => msMulti(false);
  $('ms-all').onclick = () => { const q = String($('ms-q')?.value || '').trim(); list(TPX4.cls).filter(s => !q || stuMatch(q, s.name)).forEach(s => MS_SEL.add(s.id)); renderMsgList(); };
  $('ms-alert-btn').onclick = () => { MS_ALERT = !MS_ALERT; renderMsgList(); };
  $('ms-q').addEventListener('input', renderMsgList);
  $('ms-search-btn').onclick = () => { const w = $('ms-search'); w.hidden = !w.hidden; $('ms-search-btn').classList.toggle('on', !w.hidden); if (!w.hidden) $('ms-q').focus(); else { $('ms-q').value = ''; renderMsgList(); } };
  $('ms-voice-btn').onclick = () => { if (!VR_SUP) { toast('🎤 الرصد الصوتي غير مدعوم في هذا المتصفح'); return; } mvOn ? mvStop() : mvStart(); };
  $('mq-btn').onclick = () => mqOpen(true);
  try { msgqPull(); } catch (e) {}
  renderMsgList(); try { mvInit(); } catch (e) {}
  if (!CT_GRADES) loadGrades();
};

window.TPX4_READY=true;
})();
