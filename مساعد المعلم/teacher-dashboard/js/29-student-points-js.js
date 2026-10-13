'use strict';
/* 👤 ملف الطالب: الرقم السري في رأس الملف · وتبويب «🪙 سجل النقاط» يشرح كل حركة في رصيده
   (كم حصل بعد كل نشاط، ولماذا لم يحصل على نقاط أحيانًا). */

/* ── 🔐 الرقم السري: يُجلب مرة في الجلسة (قائمة الرموز ثقيلة على الخادم) ثم يُقرأ من الذاكرة ── */
let PF_PINS_STATE = '';            // '' لم يُجلب · 'loading' · 'ok' · 'err'
function pfPinChip(sid){
  const s = (STUDENTS||[]).find(x=>String(x.id)===String(sid)); if(!s) return '';
  if(PF_PINS_STATE==='' ){ PF_PINS_STATE='loading'; loadPins(true).then(()=>{ PF_PINS_STATE='ok'; pfPinFill(); }).catch(()=>{ PF_PINS_STATE='err'; pfPinFill(); }); }
  return `<span class="pf-pin" id="pf-pin" data-sid="${esc(String(sid))}">${pfPinInner(s)}</span>`;
}
function pfPinInner(s){
  if(PF_PINS_STATE==='loading') return '🔐 الرقم السري: <span class="muted">…</span>';
  const pin = typeof pinOf==='function' ? pinOf(s.name) : '';
  if(pin) return `🔐 الرقم السري: <b dir="ltr">${esc(pin)}</b><button type="button" class="pf-pin-copy" title="نسخ" onclick="pfPinCopy('${esc(pin)}')">⧉</button>`;
  if(PF_PINS_STATE==='err') return '🔐 <span class="muted">تعذّر جلب الرقم</span> <button type="button" class="pf-pin-copy" title="إعادة المحاولة" onclick="PF_PINS_STATE=\'\';renderClassTools()">↻</button>';
  return '🔐 <span class="muted">لم يسجّل رقمًا سريًا بعد</span>';
}
function pfPinFill(){ const el=document.getElementById('pf-pin'); if(!el) return; const s=(STUDENTS||[]).find(x=>String(x.id)===el.dataset.sid); if(s) el.innerHTML=pfPinInner(s); }
function pfPinCopy(pin){ try{ navigator.clipboard.writeText(pin).then(()=>toast('نُسخ الرقم السري','good'),()=>{}); }catch(e){} }

/* ── 🪙 سجل النقاط ── */
if(typeof CT_PF_SUBS!=='undefined' && !CT_PF_SUBS.some(x=>x[0]==='points')) CT_PF_SUBS.splice(Math.max(0,CT_PF_SUBS.length-1),0,['points','🪙 سجل النقاط']);

function ptsDate(at){ try{ return new Date(at).toLocaleString('ar-SA-u-ca-gregory',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}); }catch(e){ return ''; } }
/* سطر واحد مفهوم لكل حركة: ماذا حدث، وكم أضيف، ولماذا */
function ptsExplain(e){
  const g=Number(e.gain)||0, t=e.t?`«${esc(e.t)}»`:'', mult=Number(e.mult)>1?' · ×٢ بطاقة مضاعفة':'';
  if(e.dup) return { ic:'⛔', what:`${e.k==='lab'?'مختبر':'نشاط'} ${t}`, res:'تسليم مكرر', why:'سبق أن سلّم هذا النشاط ولا توجد له محاولة إضافية، فلم يُحتسب التسليم الجديد.', tone:'bad' };
  if(e.k==='hw'){
    const res=`${e.c} من ${e.n} صحيحة`;
    if(g>0) return { ic:'📝', what:`نشاط ${t}`, res, why:(e.re&&Number(e.best)>0?`إعادة: أُضيف الفرق فوق أفضل محاولة سابقة (${e.best})`:`${e.pts} من ${e.max} نقطة`)+mult, tone:'good' };
    if(!(Number(e.max)>0)) return { ic:'📝', what:`نشاط ${t}`, res, why:'النشاط بلا نقاط متجر (نقاطه ٠).', tone:'' };
    if(!(Number(e.pts)>0)) return { ic:'📝', what:`نشاط ${t}`, res, why:'لم يُجب عن أي سؤال صحيحًا، فلا نقاط.', tone:'bad' };
    return { ic:'📝', what:`نشاط ${t}`, res, why:`سبق أن حصل على ${e.best} في محاولة سابقة، والنقاط تُضاف للزيادة على أفضل محاولة فقط.`, tone:'warn' };
  }
  if(e.k==='lab'){
    const res=`${Math.round(Number(e.score)||0)}%`;
    if(g>0) return { ic:'🔬', what:`مختبر ${t}`, res, why:(e.re&&Number(e.best)>0?`إعادة: أُضيف الفرق فوق أفضل محاولة (${e.best})`:`${e.pts} من ${e.max} نقطة`)+mult, tone:'good' };
    if(!(Number(e.pts)>0)) return { ic:'🔬', what:`مختبر ${t}`, res, why:Number(e.max)>0?'نتيجته لم تبلغ نقطة واحدة.':'المختبر بلا نقاط متجر.', tone:'bad' };
    return { ic:'🔬', what:`مختبر ${t}`, res, why:`سبق أن حصل على ${e.best}، والنقاط للزيادة فقط.`, tone:'warn' };
  }
  if(e.k==='game'){
    const res=`${e.score} من ${e.max||50}`;
    if(g>0) return { ic:'🎮', what:`لعبة ${t}`, res, why:e.re&&Number(e.best)>0?`إعادة: أُضيف الفرق فوق نتيجته السابقة (${e.best})`:'نقاط اللعبة', tone:'good' };
    return { ic:'🎮', what:`لعبة ${t}`, res, why:Number(e.score)>0?`نتيجته السابقة (${e.best}) أعلى أو مساوية، فلا زيادة.`:'نتيجته ٠ في اللعبة.', tone:'warn' };
  }
  if(e.k==='adj') return { ic:g>=0?'🎁':'➖', what:g>=0?'إضافة من المعلم':'خصم من المعلم', res:'', why:esc(e.why||''), tone:g>=0?'good':'bad' };
  if(e.k==='bonus') return { ic:'🎁', what:'مكافأة جماعية', res:'', why:esc(e.why||''), tone:'good' };
  if(e.k==='shop') return { ic:'🛒', what:'شراء', res:'', why:esc(e.why||''), tone:'' };
  if(e.k==='live') return { ic:'🏆', what:'المسابقة المباشرة', res:'', why:esc(e.why||''), tone:g>=0?'good':'' };
  return { ic:'•', what:esc(e.k||''), res:'', why:esc(e.why||''), tone:'' };
}
/* الأنشطة التي سلّمها قبل بدء السجل: النقاط المتوقعة من الدرجة (للمقارنة بما يقوله الطالب) */
function ptsBefore(sid, since){
  const out=[];
  (HW||[]).forEach(h=>{ const v=h&&h.subs&&h.subs[String(sid)]; if(!v||!v.at||(since&&Number(v.at)>=since)) return;
    if(h.kind==='files'||h.kind==='games'||h.kind==='style'||h.kind==='diag') return;
    const n=Number(v.total)||0, c=Number(v.correct)||0, p=Number(h.pts)||0;
    out.push({ at:Number(v.at), t:h.title, res:n?`${c} من ${n}`:'—', exp:n?Math.round(p*c/n):0, max:p });
  });
  return out.sort((a,b)=>b.at-a.at);
}
async function sfPoints(el,sid){
  el.innerHTML='<div class="muted" style="padding:1rem">⏳ جارٍ تحميل سجل النقاط…</div>';
  let j=null;
  try{ const api=(getApi()||'').replace(/\/+$/,''); const r=await fetch(`${api}/points-log?t=${encodeURIComponent(getTok())}&sid=${encodeURIComponent(sid)}&_=${Date.now()}`,{cache:'no-store'}); j=await r.json(); if(!r.ok||!j.ok) throw new Error(j&&j.error||'http'); }
  catch(e){ if(String(window._ctPfSid)===String(sid)) el.innerHTML=`<div class="ct-warn">تعذّر تحميل سجل النقاط${e.message==='http'||/not found/i.test(e.message)?' — انشر آخر نسخة من الخادم (worker.js) لتفعيله':' — تحقق من الاتصال'}.</div>`; return; }
  if(String(window._ctPfSid)!==String(sid)) return;
  const log=j.log||[], since=log.length?Math.min(...log.map(e=>Number(e.at)||Date.now())):0, before=ptsBefore(sid,since);
  const zero=log.filter(e=>(e.k==='hw'||e.k==='lab'||e.k==='game')&&!(Number(e.gain)>0)).length;
  const rows=log.map(e=>{ const x=ptsExplain(e), g=Number(e.gain)||0;
    return `<tr class="pts-${x.tone}"><td class="pts-d">${esc(ptsDate(e.at))}</td><td>${x.ic} ${x.what}${x.res?`<small>${esc(x.res)}</small>`:''}</td>
      <td class="pts-g">${g>0?'+'+g:g<0?String(g):'0'}</td><td class="pts-w">${x.why}</td><td class="pts-b">${e.bal!=null?esc(String(e.bal)):'—'}</td></tr>`; }).join('');
  el.innerHTML=`<div class="pts-head"><div class="pts-bal"><span>الرصيد الحالي</span><b>${esc(String(j.bal))}</b><small>نقطة</small></div>
      <div class="pts-sum">${log.length?`${log.length} حركة مسجّلة${zero?` · <b class="pts-zero">${zero} تسليم بلا نقاط</b> (السبب بجانب كل واحد)`:''}`:'لا حركات مسجّلة بعد.'}</div></div>
    <p class="muted" style="font-size:.8rem;margin:.3rem 0 .6rem">قاعدة النقاط: نقاط النشاط × (الإجابات الصحيحة ÷ عدد الأسئلة). عند الإعادة تُضاف الزيادة على أفضل محاولة سابقة فقط، والتسليم المكرر بلا محاولة إضافية لا يُحتسب.</p>
    ${log.length?`<div class="pts-wrap"><table class="pts-tbl"><thead><tr><th>الوقت</th><th>الحركة</th><th>النقاط</th><th>التوضيح</th><th>الرصيد بعدها</th></tr></thead><tbody>${rows}</tbody></table></div>`:''}
    ${before.length?`<details class="pts-before" ${log.length?'':'open'}><summary>📚 أنشطة سلّمها قبل بدء السجل (${before.length}) — النقاط المتوقعة من درجته</summary>
      <div class="pts-wrap"><table class="pts-tbl"><thead><tr><th>التسليم</th><th>النشاط</th><th>الدرجة</th><th>النقاط المتوقعة</th></tr></thead><tbody>
      ${before.map(b=>`<tr><td class="pts-d">${esc(ptsDate(b.at))}</td><td>📝 «${esc(b.t)}»</td><td>${esc(b.res)}</td><td class="pts-g">${b.exp} / ${b.max}</td></tr>`).join('')}</tbody></table></div>
      <p class="muted" style="font-size:.76rem;margin:.4rem 0 0">تقدير من الدرجة المسجلة على هذا الجهاز؛ لا يشمل بطاقات المضاعفة ولا قاعدة «الزيادة فقط» عند الإعادة.</p></details>`:''}`;
}
