/* ═══════════ 🗓️ الجدول وتنبيه الحصص وتذكيراتي — منقول من بوابة المعلم إلى لوحة التحكم ═══════════
   نُقل آليًا من بوابة المعلم كما هو داخل نطاق مغلق، وتوصيلاته في «42-schedule-shim» أعلى الملف وأسفله — التعديل من الآن هنا مباشرة.
   يُحمَّل عند أول فتح لـ«الجدول» أو «تذكيراتي» أو تنبيه حصة. */
(function(){
/* ───────────── 42-schedule-shim: توصيل نص البوابة ببيانات اللوحة ─────────────
   البيانات: CT_DATA · الحفظ: طابور اللوحة (ct_outbox_v1) — الجدول والتذكيرات يُرسلان كاملين (كما في البوابة)،
   ومشاركة «إنهاء الحصة» تُرسل لكل طالب بوقته فلا تمحو رصدًا أحدث */
const TPX3 = window.TPX3 = window.TPX3 || { cls: '' };
const $ = id => id === 'cls' ? { value: TPX3.cls } : document.getElementById(id);
function TPX_STU(){ return (Array.isArray(STUDENTS) ? STUDENTS : []).map(s => s && String(s.id) === s.id ? s : { ...s, id: String(s && s.id) }); }
function list(cls){ return TPX_STU().filter(s => !cls || String(s.cls || '').trim() === cls).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar')); }
function classes(){ return ctClasses(); }
const TPX3_BOOTED = () => !!(CT_DATA && typeof CT_DATA === 'object' && Object.keys(CT_DATA).length);
let TPX3_OPS = [];
function save(){
  if (!TPX3_BOOTED()) return;
  const ops = TPX3_OPS; TPX3_OPS = [];
  if (CT_DATA.schedule) ops.push({ k: 'sch', v: JSON.parse(JSON.stringify(CT_DATA.schedule)) });
  if (Array.isArray(CT_DATA.reminders)) ops.push({ k: 'rem', v: JSON.parse(JSON.stringify(CT_DATA.reminders)) });
  qrDo(ops);
}
function undoPush(){}
function render(){ try { if (typeof qrPaint === 'function') qrPaint(); } catch (e) {} }
function renderDaily(){ render(); } function renderHome(){} function renderRecords(){}
let ctxOv = null;
function ctxRefresh(){ render(); }
function tpToDash(q){ if (/notifications/.test(q || '')) openSubmissionFromPush({ open: 'notifications' }); }
function openTeacherPanel(p){ if (p === 'reminders') ctGo('reminders'); }

/* ───────────── نص البوابة ───────────── */
/* ═══════════ 🗓️ الجدول والحصص ═══════════
   القاعدة: الحضور هو الأصل والاستثناء هو ما يُرصد.
   تبدأ الحصة بضغطة → ترصد الغائبين ومن تخصم منهم → تنهيها
   فتُكتب «شارك» لمن لم تُسجّل له حالة صريحة.
   الجدول يقترح الفصل ووقت النهاية فقط؛ الحصة لا تُحتسب إلا ببدئك إياها. */
const SCH_DAYS = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];

function schDefaults(){
  return { dur:45, gap:0, count:7, breakAfter:3, breakLen:30,
           prayAfter:6, prayLen:20,   // 🕌 فسحة الصلاة بعد السادسة — صفر يعني بلا
           presets:{summer:'07:00', winter:'07:15'}, active:'summer',
           auto:false,          // 🔴 مطفأ افتراضيًا: لا يُكتب شيء حتى تُشغّله بنفسك
           fix:{}, grid:{}, sessions:{} };
}
function sch(){
  if(!CT_DATA.schedule || typeof CT_DATA.schedule!=='object') CT_DATA.schedule = schDefaults();
  const s = CT_DATA.schedule, d = schDefaults();
  for(const k of ['dur','gap','count','breakAfter','breakLen','prayAfter','prayLen'])
    if(typeof s[k]!=='number') s[k]=d[k];
  s.presets = Object.assign({}, d.presets, s.presets||{});
  if(s.active!=='summer' && s.active!=='winter') s.active='summer';
  if(typeof s.auto!=='boolean') s.auto=false;
  s.fix = s.fix||{}; s.grid = s.grid||{}; s.sessions = s.sessions||{};
  return s;
}
const schHM = t => { const p=String(t||'07:00').split(':'); return (+p[0]||0)*60 + (+p[1]||0); };
const schMM = m => String(Math.floor(((m%1440)+1440)%1440/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');

/* أوقات الحصص محسوبة من: بداية الأولى + المدة + الفسحة بعد حصة معيّنة.
   وأي حصة عدّلتها يدويًا تتجاوز الحساب. */
function schTimes(){
  const s = sch(), base = schHM(s.presets[s.active]), out = [];
  for(let n=1; n<=s.count; n++){
    // كل فسحة تُضاف لمن بعدها فقط، فالفسحتان تتراكمان على الحصص المتأخرة
    let st = base + (n-1)*(s.dur+s.gap)
           + (n>s.breakAfter ? s.breakLen : 0)
           + ((s.prayAfter>0 && n>s.prayAfter) ? s.prayLen : 0);
    let en = st + s.dur;
    const f = s.fix[String(n)];
    if(f && f.s){ st = schHM(f.s); en = f.e ? schHM(f.e) : st + s.dur; }
    out.push({ n, s:schMM(st), e:schMM(en), sm:st, em:en, fixed:!!(f&&f.s) });
  }
  return out;
}
/* الوقت واليوم بتوقيت الرياض دائمًا — لا بإعداد الجهاز. */
function schNowMin(){
  try{
    const p = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());
    return (+p.find(x=>x.type==='hour').value)*60 + (+p.find(x=>x.type==='minute').value);
  }catch(e){ const d=new Date(Date.now()+3*3600*1000); return d.getUTCHours()*60+d.getUTCMinutes(); }
}
function schDow(){
  try{
    const w = new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Riyadh',weekday:'short'}).format(new Date());
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(w);
  }catch(e){ return new Date().getDay(); }
}
/* «الحالية/القادمة» في مكان واحد: بطاقة «الحصة الآن» ومحدد السياق يستعملانها معًا.
   الحالية = من 10 دقائق قبل البداية حتى النهاية (كما كانت في شاشة الجدول تمامًا). */
const SCH_LEAD = 10;
function schFind(now, T){
  T = T || schTimes();
  return { cur: T.find(x => now >= x.sm - SCH_LEAD && now < x.em), next: T.find(x => now < x.sm) };
}
const schToday = () => sch().sessions[ctToday()] || null;
const schOpen  = () => { const d=schToday(); if(!d) return null;
  for(const k of Object.keys(d)) if(d[k] && !d[k].en) return Object.assign({p:+k}, d[k]);
  return null; };

function schSetPreset(which){ const s=sch(); s.active=which; save(); renderSchedule(); }
/* 🔘 مفتاح الرصد التلقائي — الميزة كلها اختيارية.
   وهو مطفأ ما لم تشغّله، فتبقى البوابة كما كانت تمامًا. */
async function schToggleAuto(){
  const s = sch();
  if(!s.auto && !(await askConfirm('عند إنهاء أي حصة ستُكتب «شارك» لكل طالب لم تُسجّل له حالة صريحة في ذلك اليوم.',{title:'تشغيل الرصد التلقائي؟',yes:'شغّله',no:'ليس الآن'}))) return;
  s.auto = !s.auto; save(); renderSchedule();
}
function schSaveFields(){
  const s = sch();
  const b = $('sch-base').value; if(b) s.presets[s.active] = b;
  s.dur        = Math.max(20, Math.min(90, +$('sch-dur').value   || 45));
  s.breakAfter = Math.max(1,  Math.min(8,  +$('sch-ba').value    || 3));
  s.breakLen   = Math.max(0,  Math.min(60, +$('sch-bl').value    || 30));
  s.count      = Math.max(4,  Math.min(8,  +$('sch-count').value || 7));
  s.prayAfter  = Math.max(0,  Math.min(8,  +$('sch-pa').value    || 0));
  s.prayLen    = Math.max(0,  Math.min(60, +$('sch-pl').value    || 0));
  save(); renderSchedule();
}
function schFixTime(n, which, val){
  const s = sch(), k = String(n);
  s.fix[k] = s.fix[k] || {};
  s.fix[k][which] = val;
  if(!s.fix[k].s && !s.fix[k].e) delete s.fix[k];
  save(); renderSchedule();
}
function schClearFix(n){ const s=sch(); delete s.fix[String(n)]; save(); renderSchedule(); }
function schSetCell(day, p, cls){
  const s = sch(); s.grid[String(day)] = s.grid[String(day)] || {};
  if(cls) s.grid[String(day)][String(p)] = cls; else delete s.grid[String(day)][String(p)];
  save(); renderSchedule();
}

/* ── بدء الحصة ── */
async function schStart(p, cls){
  const s = sch(), d = ctToday();
  if(!cls){ toast('اختر الفصل أولًا','bad'); return; }
  const open = schOpen();
  if(open && open.p !== p){ toast(`الحصة ${open.p} ما زالت مفتوحة — أنهها أولًا`,'bad'); return; }
  s.sessions[d] = s.sessions[d] || {};
  if(s.sessions[d][String(p)] && s.sessions[d][String(p)].en){
    if(!(await askConfirm('أُنهيت هذه الحصة اليوم. إعادة فتحها تسمح بتعديل الرصد ثم إنهائها من جديد.',{title:'إعادة فتح الحصة؟',yes:'أعد فتحها',no:'إلغاء'}))) return;
  }
  s.sessions[d][String(p)] = { cls, st:Date.now(), en:0, auto:false, n:0 };
  if(typeof TPX3.cls!=='undefined'){ TPX3.cls = cls; }
  const cs = $('cls'); if(cs && cs.value!==cls){ cs.value = cls; if(typeof render==='function') render(); }
  save(); renderSchedule();
}

/* ── إنهاء الحصة: هنا تُكتب المشاركة ──
   لا تُكتب إلا لمن ليس له حالة صريحة اليوم — رصدك اليدوي لا يُمحى. */
function schEnd(p, auto, write, dateKey){
  const s = sch(), d = dateKey || ctToday(), day = s.sessions[d] || {}, ses = day[String(p)];
  if(!ses || ses.en) return 0;
  // المفتاح مطفأ (أو أنهيتها بلا كتابة): تُقفل الحصة ولا تُمسّ المشاركة إطلاقًا.
  const doWrite = (write===undefined) ? !!s.auto : !!write;
  if(!doWrite){
    ses.en = Date.now(); ses.auto = !!auto; ses.n = 0; ses.skipped = true;
    save(); renderSchedule(); return 0;
  }
  const roster = list(ses.cls), items = [];
  CT_DATA.participation[d] = CT_DATA.participation[d] || {};
  for(const st of roster){
    const cur = CT_DATA.participation[d][st.id];
    const has = cur && String(cur.status||cur||'').trim();
    if(has) continue;
    items.push({ d, id:st.id, prev:cur });
    CT_DATA.participation[d][st.id] = { status:'شارك', at:Date.now(), src:'auto' };
  }
  ses.en = Date.now(); ses.auto = !!auto; ses.n = items.length;
  if(items.length && typeof undoPush==='function'){
    undoPush({ kind:'status', m:'participation', st:'مشاركة تلقائية',
               names:`${items.length} طالبًا · ${ses.cls}`, items });
  }
  save(); renderSchedule();
  schRefreshViews();
  return items.length;
}
/* بعد الكتابة: كانت تستدعي render() غير الموجودة، فتبقى شاشة الرصد تعرض صفرًا */
function schRefreshViews(){
  for(const f of [typeof renderDaily==='function'&&renderDaily, typeof renderHome==='function'&&renderHome,
                  typeof renderRecords==='function'&&renderRecords]){ if(f){ try{ f(); }catch(e){} } }
}
/* الإغلاق التلقائي: لو نسيت الضغط، تُكتب المشاركة عند وقت النهاية المجدول
   وتُوسم «أُغلقت تلقائيًا» كي تعرف أنك نسيت. */
function schAutoClose(){
  if(!TPX3_BOOTED()) return 0;              // لا نكتب على بيانات محلية قبل وصول نسخة الخادم
  const s = sch(), T = schTimes(), nowMs = Date.now();
  const oldest = new Date(nowMs - 14*864e5).toISOString().slice(0,10);
  let closed = 0;
  for(const d of Object.keys(s.sessions||{})){
    const day = s.sessions[d]; if(!day) continue;
    for(const k of Object.keys(day)){
      const ses = day[k]; if(!ses || ses.en) continue;
      const t = T.find(x => x.n === +k);
      if(!t) continue;
      // نهاية الحصة بتوقيت الرياض في يومها. من بدأها في آخر 10 دقائق أو بعد نهايتها
      // (حصة تعويضية) يُمهل مدة حصة كاملة من بدايته — وإلا أُغلقت فورًا قبل أن يرصد الغياب.
      const schedEnd = Date.parse(`${d}T${t.e}:00+03:00`) || 0;
      const started = Number(ses.st) || 0;
      const deadline = started >= schedEnd - 10*60000 ? started + (t.em - t.sm) * 60000 : schedEnd;
      if(nowMs < deadline) continue;
      if(d < oldest){ ses.en = nowMs; ses.auto = true; ses.n = 0; ses.skipped = true; save(); closed++; continue; }
      schEnd(+k, true, undefined, d);
      closed++;
    }
  }
  return closed;
}
/* على iPhone يتوقف المؤقت عند إغلاق التطبيق: نفحص عند الفتح والعودة وقبل عرض الرصد */
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible'){ try{ schAutoClose(); }catch(e){} } });
window.addEventListener('pageshow', ()=>{ try{ schAutoClose(); }catch(e){} });

function schClassOptions(sel){
  const set = [...new Set(TPX_STU().map(s=>s.cls).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  return '<option value="">—</option>' + set.map(c=>`<option value="${esc(c)}"${c===sel?' selected':''}>${esc(c)}</option>`).join('');
}
/* 🎨 لون ثابت لكل فصل (حسب ترتيب الفصول) */
const SC_HUES=[210,145,28,280,350,180,50,250,5,100,320,195];
function scClasses(){ return [...new Set(TPX_STU().map(s=>s.cls).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar')); }
function scHue(c){ const i=scClasses().indexOf(c); return SC_HUES[(i<0?0:i)%SC_HUES.length]; }
const scCC=c=>c?` cc" style="--h:${scHue(c)}`:'';
let SC_PICK=null;
function scPickOpen(dy,n){ const s=sch(), t=schTimes().find(x=>x.n===n); if(!t) return; SC_PICK={dy,n};
  const cur=(s.grid[String(dy)]||{})[String(n)]||'';
  $('sc-pick-t').textContent=`${SCH_DAYS[dy]} · الحصة ${CTX_ORD[n]||n}`; $('sc-pick-s').textContent=`${t.s} – ${t.e}`;
  $('sc-pick-l').innerHTML=scClasses().map(c=>`<button type="button" class="${c===cur?'on':''}${scCC(c)}" data-sc-set="${esc(c)}">${esc(c)}</button>`).join('')+`<button type="button" class="none${cur?'':' on'}" data-sc-set="">— فراغ</button>`;
  $('sc-pick').hidden=false; document.body.classList.add('bh-on'); }
function scPickClose(){ $('sc-pick').hidden=true; document.body.classList.remove('bh-on'); SC_PICK=null; }
let SC_DAY=-1, SC_VIEW=(()=>{ try{ return localStorage.getItem('teacher_sc_view')==='week'?'week':'day'; }catch(e){ return 'day'; } })();
function scSet(on){ $('sc-set').hidden=!on; document.body.classList.toggle('bh-on',!!on); }
function renderSchedule(){
  const s = sch(), T = schTimes(), dow = schDow(), d = ctToday();
  const todayGrid = s.grid[String(dow)] || {};
  const now = schNowMin(), open = schOpen();

  /* بطاقة «الحصة الآن» */
  const nowBox = $('sch-now');
  if(nowBox){
    if(dow < 0 || dow > 4){
      nowBox.innerHTML = `<div class="sch-empty">لا دوام اليوم.</div>`;
    } else if(open){
      const t = T.find(x=>x.n===open.p);
      const late = t && now > t.em;
      nowBox.innerHTML = `
        <div class="sch-live">
          <div class="sch-live-top"><b>الحصة ${open.p} · ${esc(open.cls)}</b><span class="sch-dot"></span></div>
          <div class="sch-live-sub">بدأت ${t?`المجدول ${t.s}–${t.e}`:''} ${late?'· تجاوزت وقتها':''}</div>
          <div class="sch-live-hint">${s.auto
            ? 'ارصد الغائبين ومن تخصم منهم الآن. عند الإنهاء تُكتب «شارك» لمن بقي.'
            : 'الرصد التلقائي مطفأ — الإنهاء يُقفل الحصة فقط ولا يكتب مشاركة.'}</div>
          <button class="btn primary" onclick="schEnd(${open.p},false)">أنهيت الحصة</button>
          ${s.auto ? `<button class="btn tiny" onclick="schEnd(${open.p},false,false)">إنهاء بلا كتابة مشاركة</button>` : ''}
        </div>`;
    } else {
      const { cur, next } = schFind(now, T);
      const pick = cur || next;
      if(!pick){ nowBox.innerHTML = `<div class="sch-empty">انتهى الدوام.</div>`; }
      else{
        const suggested = todayGrid[String(pick.n)] || '';
        const done = (s.sessions[d]||{})[String(pick.n)];
        nowBox.innerHTML = `
          <div class="sch-next">
            <div><b>${cur?'الحصة الحالية':'الحصة القادمة'}: ${pick.n}</b> · ${pick.s}–${pick.e}</div>
            ${done && done.en ? `<div class="sch-live-sub">أُنهيت اليوم · ${done.n} مشاركة</div>` : ''}
            <label class="sch-pick">الفصل
              <select id="sch-start-cls">${schClassOptions(suggested)}</select>
            </label>
            ${suggested ? `<div class="sch-live-sub">مقترح من جدولك: ${esc(suggested)}</div>`
                        : `<div class="sch-live-sub">لا فصل مجدول لهذه الحصة — اختره يدويًا.</div>`}
            <button class="btn primary" onclick="schStart(${pick.n}, $('sch-start-cls').value)">بدأت الحصة</button>
          </div>`;
      }
    }
  }

  /* حقول الأوقات */
  const setv=(id,v)=>{ const e=$(id); if(e && document.activeElement!==e) e.value=v; };
  setv('sch-base', s.presets[s.active]); setv('sch-dur', s.dur);
  setv('sch-ba', s.breakAfter); setv('sch-bl', s.breakLen); setv('sch-count', s.count);
  setv('sch-pa', s.prayAfter); setv('sch-pl', s.prayLen);
  const ab=$('sch-auto-btn'), an=$('sch-auto-note');
  if(ab) ab.classList.toggle('on', !!s.auto);
  if(ab) ab.setAttribute('aria-checked', s.auto?'true':'false');
  if(an) an.textContent = s.auto
    ? 'مُشغَّل — عند إنهاء الحصة تُكتب «شارك» لمن لم تُرصد له حالة.'
    : 'مطفأ — الحصص تُسجَّل للمتابعة فقط، ولا يُكتب أي رصد.';
  const pb=$('sch-p-summer'), pw=$('sch-p-winter');
  if(pb) pb.classList.toggle('on', s.active==='summer');
  if(pw) pw.classList.toggle('on', s.active==='winter');

  const tb = $('sch-times');
  if(tb) tb.innerHTML = T.map(t=>`
    ${t.n===s.breakAfter+1 && s.breakLen>0 ? `<div class="sch-break">☕ الفسحة · ${s.breakLen} دقيقة</div>`:''}
    ${s.prayAfter>0 && t.n===s.prayAfter+1 && s.prayLen>0 ? `<div class="sch-break pray">🕌 فسحة الصلاة · ${s.prayLen} دقيقة</div>`:''}
    <div class="sch-time-row${t.fixed?' fixed':''}">
      <b>الحصة ${t.n}</b>
      <input type="time" value="${t.s}" onchange="schFixTime(${t.n},'s',this.value)">
      <input type="time" value="${t.e}" onchange="schFixTime(${t.n},'e',this.value)">
      ${t.fixed?`<button class="btn tiny" onclick="schClearFix(${t.n})">إرجاع</button>`:'<span></span>'}
    </div>`).join('') + `<div class="hint">الأوقات محسوبة تلقائيًا؛ عدّل أي حصة إن اختلفت.</div>`;

  /* الجدول الأسبوعي: يومًا بيوم */
  if(SC_DAY<0) SC_DAY = (dow>=0&&dow<=4) ? dow : 0;
  const dc=$('sc-days');
  if(dc) dc.innerHTML = SCH_DAYS.map((nm,dy)=>{ const n=T.filter(t=>(s.grid[String(dy)]||{})[String(t.n)]).length;
    return `<button type="button" class="${dy===SC_DAY?'on':''}${dy===dow?' td':''}" data-sc-day="${dy}">${nm}<small>${n?n+' حصص':'—'}</small></button>`; }).join('');
  /* عرض الأسبوع كامل: جدول مختصر للقراءة — الضغط يفتح اليوم للتعديل */
  document.querySelectorAll('[data-sc-view]').forEach(b=>b.classList.toggle('on',b.dataset.scView===SC_VIEW));
  if($('sc-dayview')) $('sc-dayview').hidden=SC_VIEW!=='day';
  if($('sc-weekview')) $('sc-weekview').hidden=SC_VIEW!=='week';
  const fw=$('sc-full');
  if(fw && SC_VIEW==='week'){
    const cur=open?open.p:(schFind(now,T).cur||{}).n;
    fw.innerHTML=`<table><thead><tr><th></th>${T.map(t=>`<th>${t.n}<small>${t.s}</small></th>`).join('')}</tr></thead><tbody>${SCH_DAYS.map((nm,dy)=>{ const gd=s.grid[String(dy)]||{};
      return `<tr class="${dy===dow?'td':''}"><th>${nm}</th>${T.map(t=>{ const c=gd[String(t.n)]||''; return `<td data-sc-cell="${dy}|${t.n}" class="${c?'c':''}${dy===dow&&cur===t.n?' now':''}${scCC(c)}">${c?esc(c):'＋'}</td>`; }).join('')}</tr>`; }).join('')}</tbody></table>`;
    const cnt={}; for(let dy=0;dy<5;dy++) for(const t of T){ const c=(s.grid[String(dy)]||{})[String(t.n)]; if(c) cnt[c]=(cnt[c]||0)+1; }
    fw.innerHTML+=`<div class="sc-sum">${Object.keys(cnt).length?Object.entries(cnt).sort((a,b)=>a[0].localeCompare(b[0],'ar')).map(([c,n])=>`<span class="${scCC(c)}">${esc(c)} <b>${n}</b></span>`).join('')+`<span>المجموع <b>${Object.values(cnt).reduce((a,b)=>a+b,0)}</b> حصة</span>`:'<span>لم تُدخل حصصًا بعد</span>'}</div>`;
  }
  const g = $('sch-grid');
  if(g){ const gd=s.grid[String(SC_DAY)]||{};
    g.innerHTML = T.map(t=>`${t.n===s.breakAfter+1 && s.breakLen>0 ? `<div class="sc-brk">☕ الفسحة</div>`:''}${s.prayAfter>0 && t.n===s.prayAfter+1 && s.prayLen>0 ? `<div class="sc-brk">🕌 الصلاة</div>`:''}
      <label class="sc-wr${gd[String(t.n)]?' has':''}"${gd[String(t.n)]?` style="--h:${scHue(gd[String(t.n)])}"`:''}><b>${t.n}</b><span>الحصة ${CTX_ORD[t.n]||t.n}<small>${t.s} – ${t.e}</small></span>
      <select onchange="schSetCell(${SC_DAY},${t.n},this.value)">${schClassOptions(gd[String(t.n)]||'')}</select></label>`).join(''); }

  /* حصص اليوم: خط زمني */
  const dy0=$('sc-day');
  if(dy0){ const day=s.sessions[d]||{};
    if(dow<0||dow>4){ dy0.innerHTML='<div class="pf-empty">لا دوام اليوم.</div>'; $('sc-day-t').textContent=''; }
    else { const cur=open?open.p:(schFind(now,T).cur||{}).n;
      $('sc-day-t').textContent=SCH_DAYS[dow];
      dy0.innerHTML=T.map(t=>{ const c=todayGrid[String(t.n)]||'', x=day[String(t.n)], isCur=cur===t.n, done=x&&x.en, past=now>=t.em;
        const st = x ? (x.en ? (x.skipped?'✓ أُنهيت بلا كتابة':`✓ ${x.n||0} مشاركة${x.auto?' · أُغلقت تلقائيًا':''}`) : '● مفتوحة الآن') : (isCur&&c?'الآن':past&&c?'لم تُبدأ':'');
        return `${t.n===s.breakAfter+1 && s.breakLen>0 ? `<div class="sc-brk">☕ الفسحة · ${s.breakLen} د</div>`:''}<div class="sc-r${isCur?' cur':''}${done?' done':''}${c?'':' free'}"><b>${isCur?'●':done?'✓':t.n}</b><span>${c?`<i class="cc" style="--h:${scHue(c)}">${esc(c)}</i>`:'فراغ'}<small>${t.s} – ${t.e}</small></span><em class="${x&&!x.en?'g':x&&x.auto?'a':''}">${esc(st)}</em></div>`; }).join(''); }
  }
  /* سطر الحالة */
  const cx=$('sc-ctx'); if(cx){ let pon=false; try{ pon=ppOn(); }catch(e){}
    cx.innerHTML=`<span>⏰ ${s.active==='winter'?'شتوي':'صيفي'} · تبدأ ${esc(s.presets[s.active]||'')} · ${s.count} حصص</span><small>${s.auto?'✍️ رصد تلقائي':'✍️ يدوي'} · ${pon?'🔔 مُفعّل':'🔕'} ⚙️</small>`; }
  try{ ctxRefresh(); }catch(e){}   // أي تعديل في الجدول ينعكس فورًا على محدد السياق
  try{ ppRender(); ppSyncSoon(); }catch(e){}   // وتنبيهات الحصص تتبع الجدول المعدّل
}


const CTX_ORD = ['','الأولى','الثانية','الثالثة','الرابعة','الخامسة','السادسة','السابعة','الثامنة'];
const ctxOrd = n => CTX_ORD[n] || String(n);
/* ═══════════ 🔔 تنبيه بداية الحصة (Web Push) + التحضير التلقائي عند فتح التنبيه ═══════════
   المواعيد تُحسب هنا فقط من نفس المصادر: data.schedule.grid (الفصل) و schTimes() (الوقت)،
   وتُرسل للخادم ليرسل التنبيه في موعده حتى والبوابة مغلقة. لا حساب ثانٍ للأوقات في الخادم. */
const PP_ON = 'tp_push_on_v1', PP_SIG = 'tp_push_sig_v1', PP_OPT = 'tp_push_opt_v1';
const ppApi = p => ctApi().replace(/\/+$/, '') + p;
function ppSupported(){ return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function ppIsIOS(){ return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function ppStandalone(){ try{ return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }catch(e){ return false; } }
function ppOn(){ try{ return localStorage.getItem(PP_ON) === '1'; }catch(e){ return false; } }
function ppOpts(){ try{ return Object.assign({ lead:0, pausedUntil:'' }, JSON.parse(localStorage.getItem(PP_OPT) || '{}')); }catch(e){ return { lead:0, pausedUntil:'' }; } }
function ppSaveOpts(o){ try{ localStorage.setItem(PP_OPT, JSON.stringify(o)); }catch(e){} }
async function ppPost(path, body){
  const r = await fetch(ppApi(path), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ t:getTok(), ...body }) });
  let j = {}; try{ j = await r.json(); }catch(e){}
  return { status:r.status, j };
}
function ppKey(b64){ const s = String(b64).replace(/-/g,'+').replace(/_/g,'/'); return Uint8Array.from(atob(s + '==='.slice((s.length+3)%4)), c => c.charCodeAt(0)); }

/* جدول الأسبوع كما هو في شاشة «الجدول» حرفيًا: كل خلية فيها فصل = تنبيه */
function ppItems(){
  const s = sch(), T = schTimes(), out = [];
  for(let dow = 0; dow <= 4; dow++){
    const g = s.grid[String(dow)] || {};
    for(const t of T){ const c = String(g[String(t.n)] || '').trim(); if(c) out.push({ dow, p:t.n, cls:c, sm:t.sm, em:t.em, s:t.s, e:t.e }); }
  }
  return out;
}
function ppHash(str){ let h = 5381; for(let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
async function ppSync(force){
  if(!ppOn() || !getTok()) return false;
  const o = ppOpts(), items = ppItems(), sig = ppHash(JSON.stringify([items, o.lead, o.pausedUntil]));
  if(!force && localStorage.getItem(PP_SIG) === sig) return true;
  const r = await ppPost('/push/portal/alarms', { items, lead:o.lead, pausedUntil:o.pausedUntil, sig });
  if(r.j && r.j.ok){ try{ localStorage.setItem(PP_SIG, sig); }catch(e){} return true; }
  return false;
}
let ppTimer = 0;
function ppSyncSoon(){ clearTimeout(ppTimer); ppTimer = setTimeout(() => { ppSync().catch(() => {}); }, 1500); }

/* 🔔 تطبيق واحد = اشتراك إشعارات واحد: تنبيه الحصة والتذكيرات تصل على أجهزة «🔔 الإشعارات» في لوحة التحكم.
   هذا المفتاح يرسل جدول الحصص للخادم فقط؛ واشتراك البوابة القديم (إن وُجد) يُلغى حتى لا يصل التنبيه مرتين */
async function ppDashSub(){ try{ const r = await navigator.serviceWorker.getRegistration(new URL('./', location.href).href); const s = r && r.pushManager && await r.pushManager.getSubscription(); return !!s && r.scope === new URL('./', location.href).href; }catch(e){ return false; } }
async function ppDropOld(){ try{ const reg = await navigator.serviceWorker.getRegistration('./portal/'); if(!reg || reg.scope !== new URL('./portal/', location.href).href) return; const sub = await reg.pushManager.getSubscription();
  if(sub){ await ppPost('/push/portal/unsubscribe', { endpoint:sub.endpoint }).catch(() => {}); await sub.unsubscribe().catch(() => {}); } }catch(e){} }
async function ppEnable(){
  try{ localStorage.setItem(PP_ON, '1'); }catch(e){}
  await ppSync(true).catch(() => {}); ppDropOld();
  PP_DASH = await ppDashSub();
  toast(PP_DASH ? '🔔 فُعّل تنبيه بداية الحصة' : '🔔 فُعّل — بقي تفعيل الإشعارات على هذا الجهاز من لوحة التحكم');
  ppRender();
}
var PP_DASH = null;
async function ppDisable(){
  ppDropOld();
  try{ await ppPost('/push/portal/alarms', { items:[], lead:0, pausedUntil:'', sig:'off' }); }catch(e){}   // لا حصص ⇒ لا تنبيه على أي جهاز
  try{ localStorage.removeItem(PP_ON); localStorage.removeItem(PP_SIG); }catch(e){}
  toast('أُوقف تنبيه الحصص على هذا الجهاز'); ppRender();
}
async function ppTest(){
  const r = await ppPost('/push/portal/test', {});
  toast(r.j.ok && r.j.sent ? 'أُرسل تنبيه تجريبي — يصل خلال ثوانٍ' : 'لم يصل لأي جهاز — أعد التفعيل', r.j.ok && r.j.sent ? '' : 'bad');
}
function ppSetLead(v){ const o = ppOpts(); o.lead = Math.max(0, Math.min(15, +v || 0)); ppSaveOpts(o); ppSync(true).catch(() => {}); ppRender(); }
function ppSetPause(v){ const o = ppOpts(); o.pausedUntil = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''; ppSaveOpts(o); ppSync(true).catch(() => {}); ppRender();
  toast(o.pausedUntil ? 'أُوقفت التنبيهات حتى ' + o.pausedUntil : 'استؤنفت التنبيهات'); }
function ppRender(){
  const box = $('pp-card'); if(!box) return;
  const on = ppOn(), o = ppOpts(), n = ppItems().length;
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  let note = '';
  if(on && PP_DASH === null){ ppDashSub().then(v => { PP_DASH = v; if(!v) ppRender(); }); }
  if(on && PP_DASH === false) note = '📲 يصل التنبيه على الأجهزة المفعّل فيها «🔔 الإشعارات» — هذا الجهاز غير مفعّل بعد. <a href="#" onclick="tpToDash(\'?open=notifications\');return false">فعّلها من هنا</a> (ونوعا «بداية الحصة» و«تذكيراتي» هناك).';
  else if(false) note = ppIsIOS() && !ppStandalone() ? '📲 على iPhone: افتح البوابة في Safari ← زر المشاركة ← «إضافة إلى الشاشة الرئيسية»، ثم افتحها من الأيقونة وفعّل التنبيه.' : 'هذا المتصفح لا يدعم الإشعارات.';
  else if(ppIsIOS() && !ppStandalone()) note = '📲 على iPhone تعمل الإشعارات فقط من أيقونة الشاشة الرئيسية: زر المشاركة ← «إضافة إلى الشاشة الرئيسية».';
  else if(perm === 'denied') note = 'الإشعارات محظورة لهذا الموقع — اسمح بها من إعدادات الجهاز ثم أعد التفعيل.';
  const paused = o.pausedUntil && o.pausedUntil >= ctToday();
  box.innerHTML = `
    <div class="sch-switch">
      <div><b>🔔 تنبيه بداية الحصة</b>
        <small>${on ? (paused ? `موقوف حتى ${o.pausedUntil}` : `مُفعّل · ${n} حصة أسبوعيًا من جدولك`) : 'يصلك تنبيه عند بداية كل حصة، وبضغطة عليه يفتح رصد الفصل'}</small></div>
      <button class="sch-toggle${on ? ' on' : ''}" id="pp-btn" role="switch" aria-checked="${on}" onclick="${on ? 'ppDisable()' : 'ppEnable()'}"><span></span></button>
    </div>
    ${note ? `<p class="hint" style="margin:.5rem 0 0">${note}</p>` : ''}
    ${on ? `<div class="pp-row">
      <label>موعد التنبيه <select id="pp-lead" onchange="ppSetLead(this.value)">
        <option value="0"${o.lead == 0 ? ' selected' : ''}>عند بداية الحصة</option>
        <option value="3"${o.lead == 3 ? ' selected' : ''}>قبلها بـ 3 دقائق</option>
        <option value="5"${o.lead == 5 ? ' selected' : ''}>قبلها بـ 5 دقائق</option></select></label>
      <label>إيقاف مؤقت (إجازة) حتى <input type="date" id="pp-pause" value="${paused ? o.pausedUntil : ''}" min="${ctToday()}" onchange="ppSetPause(this.value)"></label>
      ${paused ? '<button class="btn" onclick="ppSetPause(\'\')">استئناف الآن</button>' : ''}
      <button class="btn" onclick="ppTest()">إرسال تنبيه تجريبي</button>
    </div>` : ''}`;
}

/* ── فتح التنبيه = بدء الحصة وتحضيرها تلقائيًا ──
/* ═══════════ ⏰ تذكيراتي — مهام المعلم في يومه الدراسي ═══════════
   تُحفظ في data.reminders (تُزامَن مع الخادم وأجهزة المعلم). المواعيد تُحسب هنا من الجدول نفسه
   (schTimes + grid) وتُرسل للخادم قائمةً مختصرة؛ مؤقت Cloudflare يرسل الإشعار في موعده. */
const REM_DAYS = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
const REM_DUTY = 'مسؤول رصد الواجبات';
let remEditing = null;
function remHM(m){ m = ((m % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mi = m % 60, h12 = ((h + 11) % 12) + 1; return `${h12}:${String(mi).padStart(2,'0')} ${h < 12 ? 'ص' : 'م'}`; }
function remDowOf(date){ return new Date(date + 'T12:00:00Z').getUTCDay(); }
function remDutyName(cls){
  const r = (CT_DATA.roles || []).find(x => x && x.active && x.cls === cls && x.title === REM_DUTY);
  const s = r && TPX_STU().find(x => x.id === r.studentId);
  return s ? s.name.split(' ').slice(0, 2).join(' ') : '';
}
/* العنوان: تذكير رصد الواجبات يقرأ اسم المسؤول الحالي من «المهام» في كل مرة */
function remTitle(r){
  if(r.kind === 'duty'){ const n = remDutyName(r.cls); return n ? `ذكّر ${n} برصد واجبات ${r.cls}` : `ذكّر مسؤول رصد الواجبات · ${r.cls} (لم يُعيَّن)`; }
  return r.title || 'تذكير';
}
/* موعد التذكير في يوم معيّن: عند أول حصة لفصل، أو حصة برقمها، أو ساعة */
function remFire(r, dow){
  const T = schTimes(), g = (sch().grid[String(dow)] || {}), a = r.at || {};
  let t = null, info = '';
  if(a.t === 'class'){ t = T.find(x => String(g[String(x.n)] || '').trim() === a.cls); if(t) info = `الحصة ${t.n} · ${a.cls} — ${remHM(t.sm)}`; }
  else if(a.t === 'period'){ t = T.find(x => x.n === Number(a.p)); if(t){ const c = String(g[String(t.n)] || '').trim(); info = `الحصة ${t.n}${c ? ' · ' + c : ''} — ${remHM(t.sm)}`; } }
  else if(a.t === 'time' && /^\d{1,2}:\d{2}$/.test(a.hm || '')){ const sm = schHM(a.hm); const ld = Number(r.lead) || 0; return { sm, fire: Math.max(0, sm - ld), info: ld ? `الموعد ${remHM(sm)}` : '' }; }
  return t ? { sm: t.sm, fire: Math.max(0, t.sm - (Number(r.lead) || 0)), info } : null;
}
function remWhen(r){
  const a = r.at || {}, lead = Number(r.lead) || 0;
  const when = a.t === 'class' ? `عند حصة ${a.cls}` : a.t === 'period' ? `عند الحصة ${a.p}` : `الساعة ${remHM(schHM(a.hm || '7:00'))}`;
  const days = r.repeat === 'once' ? `مرة واحدة ${r.date}` : (r.days || []).length === 5 ? 'كل يوم دراسي' : 'كل ' + (r.days || []).map(d => REM_DAYS[d]).join(' و');
  return `${days} · ${when}${lead ? ` · قبلها بـ ${lead} د` : ''}`;
}
function remToday(){
  const d = ctToday(), dow = remDowOf(d), out = [];
  for(const r of CT_DATA.reminders || []){
    if(!r || r.paused) continue;
    if(r.repeat === 'once' ? r.date !== d : !(r.days || []).includes(dow)) continue;
    const f = remFire(r, dow); if(!f) continue;
    out.push({ r, ...f, done: !!(r.done && r.done[d]) });
  }
  return out.sort((a, b) => a.fire - b.fire);
}
function remBadge(){
  const b = document.getElementById('rem-badge'); if(!b) return;
  const left = remToday().filter(x => !x.done).length;
  b.hidden = !left; b.textContent = left ? String(left) : '';
  const sub = document.getElementById('rem-tile-sub'); if(sub) sub.textContent = left ? `${left} ${left === 1 ? 'مهمة' : 'مهام'} اليوم` : 'مهامك في يومك الدراسي';
}
/* ——— المزامنة: قائمة مواعيد مختصرة للخادم (لا تُرسل إلا إذا تغيّرت) ——— */
function remItems(){
  const out = [], d0 = ctToday();
  for(const r of CT_DATA.reminders || []){
    if(!r || r.paused) continue;
    const done = Object.keys(r.done || {}).filter(k => r.done[k]).sort().slice(-14), title = remTitle(r);
    if(r.repeat === 'once'){
      if(!r.date || r.date < d0) continue;
      const f = remFire(r, remDowOf(r.date)); if(f) out.push({ id:r.id, date:r.date, fire:f.fire, title, body:f.info, done });
    } else for(const dow of r.days || []){
      const f = remFire(r, dow); if(f) out.push({ id:r.id, dow, fire:f.fire, title, body:f.info, done });
    }
  }
  return out;
}
async function remSync(){
  if(!TPX3_BOOTED() || !getTok()) return false;
  const items = remItems(), sig = ppHash(JSON.stringify(items));
  if(localStorage.getItem('tp_rem_sig_v1') === sig) return true;
  const r = await ppPost('/push/portal/tasks', { items, sig });
  if(r.j && r.j.ok){ try{ localStorage.setItem('tp_rem_sig_v1', sig); }catch(e){} return true; }
  return false;
}
let remTimer = 0;
function remSyncSoon(){ clearTimeout(remTimer); remTimer = setTimeout(() => { remSync().catch(() => {}); }, 1500); }
function remAfterBoot(){
  if(PP_DASH === null && 'serviceWorker' in navigator) ppDashSub().then(v => { PP_DASH = v; try{ renderReminders(); }catch(e){} });
  try{ if(new URLSearchParams(location.search).get('tasks')){ const u = new URL(location.href); u.searchParams.delete('tasks'); history.replaceState(null, '', u.pathname + u.search + u.hash); setTimeout(() => openTeacherPanel('reminders'), 50); } }catch(e){}
  remSyncSoon(); remBadge();
}
/* ——— الشاشة ——— */
function renderReminders(){
  const box = $('rem-card'); if(!box) return;
  const d = ctToday(), T = remToday(), now = schNowMin(), all = (CT_DATA.reminders || []).slice();
  box.innerHTML = `
    <div class="rem-head"><b>⏰ تذكيراتي</b><small>مهامك في يومك الدراسي — يصلك إشعار في موعد كل مهمة</small></div>
    ${PP_DASH === false ? `<div class="rem-warn">🔕 الإشعارات غير مفعّلة على هذا الجهاز، فلن يصلك تنبيه.<button class="btn" type="button" onclick="tpToDash('?open=notifications')">فعّلها الآن</button></div>` : ''}
    <h3 class="rem-h">اليوم · ${REM_DAYS[remDowOf(d)] || ''}</h3>
    ${T.length ? `<div class="rem-list">${T.map(x => `<label class="rem-it${x.done ? ' done' : ''}${!x.done && x.fire <= now ? ' late' : ''}">
        <input type="checkbox" ${x.done ? 'checked' : ''} onchange="remDone('${esc(x.r.id)}')">
        <span><b>${esc(remTitle(x.r))}</b><small>${remHM(x.fire)}${x.info ? ' · ' + esc(x.info) : ''}</small></span></label>`).join('')}</div>`
      : '<p class="hint">لا تذكيرات اليوم.</p>'}
    <div class="rem-actions"><button class="btn primary" type="button" onclick="remEdit()">＋ تذكير جديد</button>
      <button class="btn" type="button" onclick="remEditDuty()">📋 تذكير رصد الواجبات</button></div>
    <div id="rem-form"></div>
    <h3 class="rem-h">كل التذكيرات (${all.length})</h3>
    ${all.length ? `<div class="rem-list">${all.map(r => `<div class="rem-row${r.paused ? ' paused' : ''}">
        <span><b>${esc(remTitle(r))}</b><small>${esc(remWhen(r))}${r.paused ? ' · موقوف' : ''}</small></span>
        <span class="rem-btns"><button type="button" title="تعديل" onclick="remEdit('${esc(r.id)}')">✎</button>
          <button type="button" title="${r.paused ? 'تشغيل' : 'إيقاف'}" onclick="remPause('${esc(r.id)}')">${r.paused ? '▶' : '⏸'}</button>
          <button type="button" title="حذف" onclick="remDelete('${esc(r.id)}')">🗑</button></span></div>`).join('')}</div>`
      : '<p class="hint">لم تضف تذكيرات بعد.</p>'}`;
  if(remEditing) remForm();
}
function remDone(id){
  const r = (CT_DATA.reminders || []).find(x => x.id === id); if(!r) return;
  const d = ctToday(); r.done = r.done || {}; if(r.done[d]) delete r.done[d]; else r.done[d] = true;
  for(const k of Object.keys(r.done)) if(k < new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)) delete r.done[k];
  save(); renderReminders();
}
function remPause(id){ const r = (CT_DATA.reminders || []).find(x => x.id === id); if(!r) return; r.paused = !r.paused; save(); renderReminders(); toast(r.paused ? 'أُوقف التذكير' : 'شُغّل التذكير'); }
async function remDelete(id){
  const r = (CT_DATA.reminders || []).find(x => x.id === id); if(!r) return;
  if(!(await askConfirm(`حذف «${remTitle(r)}»؟`, { title:'حذف التذكير', yes:'احذف', no:'إلغاء' }))) return;
  CT_DATA.reminders = CT_DATA.reminders.filter(x => x.id !== id); save(); renderReminders(); toast('حُذف التذكير');
}
function remClassDays(cls){ const g = sch().grid || {}, out = []; for(let d = 0; d <= 4; d++){ const row = g[String(d)] || {}; if(Object.values(row).some(v => String(v || '').trim() === cls)) out.push(d); } return out; }
function remEdit(id){
  const r = id && (CT_DATA.reminders || []).find(x => x.id === id);
  remEditing = r ? JSON.parse(JSON.stringify(r)) : { id:'', kind:'', title:'', repeat:'weekly', days:[0,1,2,3,4], date:ctToday(), at:{ t:'time', hm:'07:00' }, lead:0 };
  remForm();
}
function remEditDuty(){
  const act = (CT_DATA.roles || []).filter(x => x && x.active && x.title === REM_DUTY);
  const cls = act.length ? act[0].cls : (TPX3.cls || classes()[0] || '');
  if(!act.length) toast('لا يوجد مسؤول رصد واجبات معيّن — عيّنه من «المهام» ليظهر اسمه في التذكير');
  const days = remClassDays(cls);
  remEditing = { id:'', kind:'duty', cls, title:'', repeat:'weekly', days: days.length ? days : [0], date:ctToday(), at:{ t:'class', cls }, lead:0 };
  remForm();
}
function remForm(){
  const f = document.getElementById('rem-form'); if(!f) return;
  const e = remEditing; if(!e){ f.innerHTML = ''; return; }
  const cl = classes(), T = schTimes(), a = e.at || {};
  f.innerHTML = `<div class="rem-form">
    <b>${e.id ? 'تعديل التذكير' : e.kind === 'duty' ? '📋 تذكير رصد الواجبات' : 'تذكير جديد'}</b>
    ${e.kind === 'duty'
      ? `<label>الفصل<select class="inp" onchange="remSetDutyCls(this.value)">${cl.map(c => `<option ${c === e.cls ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
         <p class="hint" style="margin:0">العنوان: <b>${esc(remTitle(e))}</b> — يتبع المسؤول الحالي في «المهام» تلقائيًا.</p>`
      : `<label>المهمة<input class="inp" id="rem-title" value="${esc(e.title)}" placeholder="مثال: ذكّر الطلاب بإحضار دفتر النشاط" oninput="remEditing.title=this.value"></label>`}
    <div class="rem-seg"><button type="button" class="${e.repeat !== 'once' ? 'on' : ''}" onclick="remEditing.repeat='weekly';remForm()">كل أسبوع</button>
      <button type="button" class="${e.repeat === 'once' ? 'on' : ''}" onclick="remEditing.repeat='once';remForm()">مرة واحدة</button></div>
    ${e.repeat === 'once'
      ? `<label>التاريخ<input class="inp" type="date" value="${esc(e.date)}" min="${ctToday()}" onchange="remEditing.date=this.value;remPreview()"></label>`
      : `<div class="rem-days">${REM_DAYS.map((n, d) => `<label><input type="checkbox" ${(e.days || []).includes(d) ? 'checked' : ''} onchange="remToggleDay(${d},this.checked)">${n}</label>`).join('')}</div>`}
    <label>الموعد<select class="inp" onchange="remSetAt(this.value)">
      <option value="class" ${a.t === 'class' ? 'selected' : ''}>عند حصة فصل (من جدولك)</option>
      <option value="period" ${a.t === 'period' ? 'selected' : ''}>عند حصة برقمها</option>
      <option value="time" ${a.t === 'time' ? 'selected' : ''}>ساعة محددة</option></select></label>
    ${a.t === 'class' ? `<label>الفصل<select class="inp" onchange="remEditing.at.cls=this.value;remForm()">${cl.map(c => `<option ${c === a.cls ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>` : ''}
    ${a.t === 'period' ? `<label>الحصة<select class="inp" onchange="remEditing.at.p=+this.value;remPreview()">${T.map(x => `<option value="${x.n}" ${x.n === Number(a.p) ? 'selected' : ''}>الحصة ${x.n} — ${remHM(x.sm)}</option>`).join('')}</select></label>` : ''}
    ${a.t === 'time' ? `<label>الساعة<input class="inp" type="time" value="${esc(a.hm || '07:00')}" onchange="remEditing.at.hm=this.value;remPreview()"></label>` : ''}
    <label>التنبيه<select class="inp" onchange="remEditing.lead=+this.value;remPreview()">${[0,3,5,10,15].map(v => `<option value="${v}" ${Number(e.lead) === v ? 'selected' : ''}>${v ? `قبل الموعد بـ ${v} د` : 'في الموعد'}</option>`).join('')}</select></label>
    <p class="hint" id="rem-preview" style="margin:0"></p>
    <div class="rem-actions"><button class="btn primary" type="button" onclick="remSave()">حفظ</button><button class="btn" type="button" onclick="remEditing=null;remForm()">إلغاء</button></div>
  </div>`;
  remPreview();
  f.scrollIntoView({ block:'nearest', behavior:'smooth' });
}
function remSetDutyCls(c){ remEditing.cls = c; remEditing.at = { t:'class', cls:c }; const d = remClassDays(c); if(d.length) remEditing.days = d; remForm(); }
function remSetAt(v){ const cl = classes(); remEditing.at = v === 'class' ? { t:'class', cls: remEditing.cls || cl[0] || '' } : v === 'period' ? { t:'period', p:1 } : { t:'time', hm:'07:00' }; remForm(); }
function remToggleDay(d, on){ const s = new Set(remEditing.days || []); on ? s.add(d) : s.delete(d); remEditing.days = [...s].sort(); remPreview(); }
/* معاينة: متى سيصل التنبيه فعلًا حسب جدولك — ويكشف الأيام التي لا حصة فيها للفصل */
function remPreview(){
  const p = document.getElementById('rem-preview'), e = remEditing; if(!p || !e) return;
  const days = e.repeat === 'once' ? [remDowOf(e.date || ctToday())] : (e.days || []);
  if(!days.length){ p.textContent = 'اختر يومًا واحدًا على الأقل.'; return; }
  const parts = days.map(d => { const f = remFire(e, d); return `${REM_DAYS[d] || ''}: ${f ? remHM(f.fire) : 'لا حصة لهذا الفصل'}`; });
  p.innerHTML = '🔔 يصلك التنبيه — ' + esc(parts.join(' · '));
}
function remSave(){
  const e = remEditing; if(!e) return;
  if(e.kind !== 'duty' && !String(e.title || '').trim()){ toast('اكتب المهمة'); return; }
  if(e.repeat === 'once' ? !/^\d{4}-\d{2}-\d{2}$/.test(e.date || '') : !(e.days || []).length){ toast(e.repeat === 'once' ? 'اختر التاريخ' : 'اختر يومًا واحدًا على الأقل'); return; }
  if(e.at.t === 'class' && !e.at.cls){ toast('اختر الفصل'); return; }
  const r = { id: e.id || ('r' + Date.now().toString(36)), kind: e.kind || '', cls: e.cls || '', title: String(e.title || '').trim().slice(0, 120),
    repeat: e.repeat === 'once' ? 'once' : 'weekly', days: e.repeat === 'once' ? [] : e.days, date: e.repeat === 'once' ? e.date : '',
    at: e.at, lead: Number(e.lead) || 0, paused: false, done: (e.done || {}) };
  CT_DATA.reminders = (CT_DATA.reminders || []).filter(x => x.id !== r.id).concat([r]);
  remEditing = null; save(); renderReminders(); toast('✓ حُفظ التذكير');
}


/* ───────────── تصدير لأزرار الصفحة (onclick) ───────────── */
if(typeof window.SCH_DAYS==='undefined') window.SCH_DAYS=SCH_DAYS;
if(typeof window.schDefaults==='undefined') window.schDefaults=schDefaults;
if(typeof window.sch==='undefined') window.sch=sch;
if(typeof window.schHM==='undefined') window.schHM=schHM;
if(typeof window.schMM==='undefined') window.schMM=schMM;
if(typeof window.schTimes==='undefined') window.schTimes=schTimes;
if(typeof window.schNowMin==='undefined') window.schNowMin=schNowMin;
if(typeof window.schDow==='undefined') window.schDow=schDow;
if(typeof window.SCH_LEAD==='undefined') window.SCH_LEAD=SCH_LEAD;
if(typeof window.schFind==='undefined') window.schFind=schFind;
if(typeof window.schToday==='undefined') window.schToday=schToday;
if(typeof window.schOpen==='undefined') window.schOpen=schOpen;
if(typeof window.schSetPreset==='undefined') window.schSetPreset=schSetPreset;
if(typeof window.schToggleAuto==='undefined') window.schToggleAuto=schToggleAuto;
if(typeof window.schSaveFields==='undefined') window.schSaveFields=schSaveFields;
if(typeof window.schFixTime==='undefined') window.schFixTime=schFixTime;
if(typeof window.schClearFix==='undefined') window.schClearFix=schClearFix;
if(typeof window.schSetCell==='undefined') window.schSetCell=schSetCell;
if(typeof window.schStart==='undefined') window.schStart=schStart;
if(typeof window.schEnd==='undefined') window.schEnd=schEnd;
if(typeof window.schRefreshViews==='undefined') window.schRefreshViews=schRefreshViews;
if(typeof window.schAutoClose==='undefined') window.schAutoClose=schAutoClose;
if(typeof window.schClassOptions==='undefined') window.schClassOptions=schClassOptions;
if(typeof window.SC_HUES==='undefined') window.SC_HUES=SC_HUES;
if(typeof window.scClasses==='undefined') window.scClasses=scClasses;
if(typeof window.scHue==='undefined') window.scHue=scHue;
if(typeof window.scCC==='undefined') window.scCC=scCC;
if(typeof window.SC_PICK==='undefined') window.SC_PICK=SC_PICK;
if(typeof window.scPickOpen==='undefined') window.scPickOpen=scPickOpen;
if(typeof window.scPickClose==='undefined') window.scPickClose=scPickClose;
if(typeof window.SC_DAY==='undefined') window.SC_DAY=SC_DAY;
if(typeof window.SC_VIEW==='undefined') window.SC_VIEW=SC_VIEW;
if(typeof window.scSet==='undefined') window.scSet=scSet;
if(typeof window.renderSchedule==='undefined') window.renderSchedule=renderSchedule;
if(typeof window.CTX_ORD==='undefined') window.CTX_ORD=CTX_ORD;
if(typeof window.ctxOrd==='undefined') window.ctxOrd=ctxOrd;
if(typeof window.PP_ON==='undefined') window.PP_ON=PP_ON;
if(typeof window.PP_SIG==='undefined') window.PP_SIG=PP_SIG;
if(typeof window.PP_OPT==='undefined') window.PP_OPT=PP_OPT;
if(typeof window.ppApi==='undefined') window.ppApi=ppApi;
if(typeof window.ppSupported==='undefined') window.ppSupported=ppSupported;
if(typeof window.ppIsIOS==='undefined') window.ppIsIOS=ppIsIOS;
if(typeof window.ppStandalone==='undefined') window.ppStandalone=ppStandalone;
if(typeof window.ppOn==='undefined') window.ppOn=ppOn;
if(typeof window.ppOpts==='undefined') window.ppOpts=ppOpts;
if(typeof window.ppSaveOpts==='undefined') window.ppSaveOpts=ppSaveOpts;
if(typeof window.ppPost==='undefined') window.ppPost=ppPost;
if(typeof window.ppKey==='undefined') window.ppKey=ppKey;
if(typeof window.ppItems==='undefined') window.ppItems=ppItems;
if(typeof window.ppHash==='undefined') window.ppHash=ppHash;
if(typeof window.ppSync==='undefined') window.ppSync=ppSync;
if(typeof window.ppTimer==='undefined') window.ppTimer=ppTimer;
if(typeof window.ppSyncSoon==='undefined') window.ppSyncSoon=ppSyncSoon;
if(typeof window.ppDashSub==='undefined') window.ppDashSub=ppDashSub;
if(typeof window.ppDropOld==='undefined') window.ppDropOld=ppDropOld;
if(typeof window.ppEnable==='undefined') window.ppEnable=ppEnable;
if(typeof window.PP_DASH==='undefined') window.PP_DASH=PP_DASH;
if(typeof window.ppDisable==='undefined') window.ppDisable=ppDisable;
if(typeof window.ppTest==='undefined') window.ppTest=ppTest;
if(typeof window.ppSetLead==='undefined') window.ppSetLead=ppSetLead;
if(typeof window.ppSetPause==='undefined') window.ppSetPause=ppSetPause;
if(typeof window.ppRender==='undefined') window.ppRender=ppRender;
if(typeof window.REM_DAYS==='undefined') window.REM_DAYS=REM_DAYS;
if(typeof window.REM_DUTY==='undefined') window.REM_DUTY=REM_DUTY;
if(typeof window.remEditing==='undefined') window.remEditing=remEditing;
if(typeof window.remHM==='undefined') window.remHM=remHM;
if(typeof window.remDowOf==='undefined') window.remDowOf=remDowOf;
if(typeof window.remDutyName==='undefined') window.remDutyName=remDutyName;
if(typeof window.remTitle==='undefined') window.remTitle=remTitle;
if(typeof window.remFire==='undefined') window.remFire=remFire;
if(typeof window.remWhen==='undefined') window.remWhen=remWhen;
if(typeof window.remToday==='undefined') window.remToday=remToday;
if(typeof window.remBadge==='undefined') window.remBadge=remBadge;
if(typeof window.remItems==='undefined') window.remItems=remItems;
if(typeof window.remSync==='undefined') window.remSync=remSync;
if(typeof window.remTimer==='undefined') window.remTimer=remTimer;
if(typeof window.remSyncSoon==='undefined') window.remSyncSoon=remSyncSoon;
if(typeof window.remAfterBoot==='undefined') window.remAfterBoot=remAfterBoot;
if(typeof window.renderReminders==='undefined') window.renderReminders=renderReminders;
if(typeof window.remDone==='undefined') window.remDone=remDone;
if(typeof window.remPause==='undefined') window.remPause=remPause;
if(typeof window.remDelete==='undefined') window.remDelete=remDelete;
if(typeof window.remClassDays==='undefined') window.remClassDays=remClassDays;
if(typeof window.remEdit==='undefined') window.remEdit=remEdit;
if(typeof window.remEditDuty==='undefined') window.remEditDuty=remEditDuty;
if(typeof window.remForm==='undefined') window.remForm=remForm;
if(typeof window.remSetDutyCls==='undefined') window.remSetDutyCls=remSetDutyCls;
if(typeof window.remSetAt==='undefined') window.remSetAt=remSetAt;
if(typeof window.remToggleDay==='undefined') window.remToggleDay=remToggleDay;
if(typeof window.remPreview==='undefined') window.remPreview=remPreview;
if(typeof window.remSave==='undefined') window.remSave=remSave;
/* ───────────── 42-schedule-shim: الصفحات وربطها ───────────── */
function tpx3SchHTML(){ return `
  <div class="rd-head"><h1>الجدول</h1><span id="qr-sync" class="qr-sync"></span>
    <button type="button" class="rd-ic" id="sc-set-btn" title="الأوقات والتنبيهات" aria-label="إعدادات الجدول">⚙️</button></div>
  <button type="button" class="gr-ctx" id="sc-ctx"></button>
  <div class="card sc-now"><div id="sch-now" class="level-table"></div></div>
  <div class="gr-sec"><b>📅 حصص اليوم <small id="sc-day-t"></small></b><div id="sc-day" class="sc-day"></div></div>
  <div class="gr-sec"><div class="sc-wh"><b>🗓️ جدولي الأسبوعي</b><div class="sc-vw" role="tablist"><button type="button" data-sc-view="day">يوم</button><button type="button" data-sc-view="week">الأسبوع كامل</button></div></div>
    <div id="sc-dayview"><div class="sc-days" id="sc-days"></div><div id="sch-grid" class="sc-wk"></div></div>
    <div id="sc-weekview" hidden><div id="sc-full" class="sc-full"></div><div class="bh-hint" style="margin-top:6px">اضغط أي خانة لتغيير فصلها</div></div></div>
  <div style="margin-top:.6rem;text-align:center"><button type="button" class="btn ghost sm" onclick="ctSchPrint()">🖨️ طباعة الجدول</button></div>
  <div hidden><div id="sch-log"></div></div>`; }
function tpx3SheetsHTML(){ return `
<div id="sc-pick" class="tpx" hidden>
  <div class="bh-veil" data-sc-pclose></div>
  <div class="bh-box" role="dialog" aria-modal="true" aria-labelledby="sc-pick-t">
    <div class="bh-sh-h"><div class="bh-sh-n"><b id="sc-pick-t"></b><small id="sc-pick-s"></small></div><button type="button" class="bh-x" data-sc-pclose aria-label="إغلاق">✕</button></div>
    <div class="sc-pl" id="sc-pick-l"></div>
  </div>
</div>
<div id="sc-set" class="tpx" hidden>
  <div class="bh-veil" data-sc-close></div>
  <div class="bh-box" role="dialog" aria-modal="true" aria-labelledby="sc-set-t">
    <div class="bh-sh-h"><div class="bh-sh-n"><b id="sc-set-t">⚙️ الجدول</b><small>الرصد التلقائي · تنبيه الحصص · الأوقات</small></div><button type="button" class="bh-x" data-sc-close aria-label="إغلاق">✕</button></div>
  <div class="card"><div class="sch-switch"><div><b>الرصد التلقائي للمشاركة</b><small id="sch-auto-note"></small></div>
      <button class="sch-toggle" id="sch-auto-btn" onclick="schToggleAuto()" role="switch"><span></span></button></div></div>
  <div class="card" id="pp-card"></div>
  <div class="card"><h3>أوقات الحصص</h3>
    <p class="hint">التوقيت الصيفي والشتوي محفوظان معًا — التبديل بينهما بضغطة، ولا يمسّ الحصص المسجَّلة سابقًا.</p>
    <div class="segmented" style="margin-bottom:10px"><button class="btn" id="sch-p-summer" onclick="schSetPreset('summer')">صيفي</button><button class="btn" id="sch-p-winter" onclick="schSetPreset('winter')">شتوي</button></div>
    <div class="sch-fields">
      <label>بداية الحصة الأولى<input type="time" id="sch-base" onchange="schSaveFields()"></label>
      <label>مدة الحصة (دقيقة)<input type="number" id="sch-dur" min="20" max="90" onchange="schSaveFields()"></label>
      <label>الفسحة بعد الحصة<input type="number" id="sch-ba" min="1" max="7" onchange="schSaveFields()"></label>
      <label>مدة الفسحة (دقيقة)<input type="number" id="sch-bl" min="0" max="60" onchange="schSaveFields()"></label>
      <label>عدد الحصص<input type="number" id="sch-count" min="4" max="8" onchange="schSaveFields()"></label>
      <label>🕌 فسحة الصلاة بعد الحصة<input type="number" id="sch-pa" min="0" max="8" onchange="schSaveFields()"></label>
      <label>مدة فسحة الصلاة<input type="number" id="sch-pl" min="0" max="60" onchange="schSaveFields()"></label>
    </div>
    <div id="sch-times" class="sch-times"></div></div>
  </div>
</div>`; }
function tpx3Sheets(){
  if (document.getElementById('sc-set')) return;
  const w = document.createElement('div'); w.innerHTML = tpx3SheetsHTML(); [...w.children].forEach(c => document.body.appendChild(c));
  document.querySelectorAll('[data-sc-close]').forEach(b => b.onclick = () => scSet(false));
  document.querySelectorAll('[data-sc-pclose]').forEach(b => b.onclick = () => scPickClose());
  $('sc-pick-l').addEventListener('click', e => { const b = e.target.closest('[data-sc-set]'); if (!b || !SC_PICK) return; const { dy, n } = SC_PICK; scPickClose(); schSetCell(dy, n, b.dataset.scSet);
    toast(b.dataset.scSet ? `✓ ${SCH_DAYS[dy]} · الحصة ${n}: ${b.dataset.scSet}` : `✓ ${SCH_DAYS[dy]} · الحصة ${n}: فراغ`); });
}
window.tpx3ScheduleMount = function(box){
  tpx3Sheets(); box.classList.add('tpx', 'tpx-root'); box.innerHTML = tpx3SchHTML();
  $('sc-set-btn').onclick = $('sc-ctx').onclick = () => scSet(true);
  box.querySelectorAll('[data-sc-view]').forEach(b => b.onclick = () => { SC_VIEW = b.dataset.scView; try { localStorage.setItem('teacher_sc_view', SC_VIEW); } catch (e) {} renderSchedule(); });
  $('sc-full').addEventListener('click', e => { const c = e.target.closest('[data-sc-cell]'); if (!c) return; const [dy, n] = c.dataset.scCell.split('|').map(Number); scPickOpen(dy, n); });
  $('sc-days').addEventListener('click', e => { const b = e.target.closest('[data-sc-day]'); if (!b) return; SC_DAY = +b.dataset.scDay; renderSchedule(); });
  try { schAutoClose(); } catch (e) {}
  renderSchedule(); if (typeof qrStatus === 'function') qrStatus();
};
/* 🔔 فتح تنبيه الحصة = رصد فصلها في اللوحة (وإن كان «الرصد التلقائي» مشغّلًا تبدأ الحصة كما في البوابة) */
async function ppLessonOpen(d, p){
  p = +p; if (!TPX3_BOOTED() || !p) return;
  if (d !== ctToday()) { toast('هذا تنبيه حصة من يوم سابق', 'bad'); return; }
  const s = sch(), T = schTimes(), t = T.find(x => x.n === p);
  const cls = String((s.grid[String(schDow())] || {})[String(p)] || '').trim();
  if (!t || !cls) { toast(`الحصة ${p} لم تعد في جدولك اليوم`, 'bad'); return; }
  const open = schOpen(), ses = (s.sessions[d] || {})[String(p)], now = schNowMin();
  if (s.auto && !open && !(ses && ses.en) && now < t.em && now >= t.sm - SCH_LEAD) { await schStart(p, cls); toast(`✅ بدأت الحصة ${ctxOrd(p)} · ${cls}`); }
  if (typeof tdQuick === 'function') tdQuick(cls);
}
window.tpx3LessonOpen = (d, p) => ppLessonOpen(d, p).catch(() => {});
/* ⏰ تذكيرات اللوحة («اليوم» ← مهام اليوم) تُحفظ في data.reminders نفسها: بعد كل حفظ تُرسل مواعيدها للخادم ليصل الإشعار */
['rmgSave','rmgPause','rmgDel'].forEach(n => { const f = window[n]; if (typeof f === 'function' && !f.__tpx3) { const w = async function(...a){ const r = await f.apply(this, a); try { remSyncSoon(); } catch (e) {} return r; }; w.__tpx3 = 1; window[n] = w; } });
/* المزامنة عند التحميل: التنبيهات والتذكيرات تتبع الجدول المحفوظ */
setTimeout(() => { if (!TPX3_BOOTED()) return; try { if (ppOn()) ppSyncSoon(); remSyncSoon(); schAutoClose(); } catch (e) {} }, 1500);

window.TPX3_READY=true;
})();
