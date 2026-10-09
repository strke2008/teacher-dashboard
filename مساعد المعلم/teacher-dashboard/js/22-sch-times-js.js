/* ═══ ⏰ أوقات الحصص في لوحة التحكم — نفس حقول بوابة المعلم وحدودها، وتُحفظ في الجدول نفسه على الخادم ═══ */
function schH12(m){ m=((m%1440)+1440)%1440; const h=Math.floor(m/60), mi=m%60; return `${((h+11)%12)+1}:${String(mi).padStart(2,'0')}`; }
function schDefaultsD(){ return {dur:45,gap:0,count:7,breakAfter:3,breakLen:30,prayAfter:6,prayLen:20,presets:{summer:'07:00',winter:'07:15'},active:'summer',auto:false,fix:{},grid:{},sessions:{}}; }
function schNorm(x){ const d=schDefaultsD(), s=(x&&typeof x==='object')?x:d;
  ['dur','gap','count','breakAfter','breakLen','prayAfter','prayLen'].forEach(k=>{ if(typeof s[k]!=='number') s[k]=d[k]; });
  s.presets=Object.assign({},d.presets,s.presets||{}); if(s.active!=='summer'&&s.active!=='winter') s.active='summer';
  s.fix=s.fix||{}; s.grid=s.grid||{}; s.sessions=s.sessions||{}; return s; }
async function schSaveD(mut,msg){
  try{ await ctSave(D=>{ D.schedule=schNorm(D.schedule); mut(D.schedule); }); toast(msg||'حُفظت الأوقات — تظهر في البوابة أيضًا','good'); }
  catch(e){ toast('تعذّر الحفظ','bad'); }
  renderClassTools();
}
function schFieldsSave(){
  const v=id=>document.getElementById(id)?.value, n=(id,lo,hi,def)=>Math.max(lo,Math.min(hi,+v(id)||def));
  schSaveD(s=>{ const b=v('st-base'); if(b) s.presets[s.active]=b;
    s.dur=n('st-dur',20,90,45); s.breakAfter=n('st-ba',1,8,3); s.breakLen=Math.max(0,Math.min(60,+v('st-bl')||0));
    s.count=n('st-count',4,8,7); s.prayAfter=Math.max(0,Math.min(8,+v('st-pa')||0)); s.prayLen=Math.max(0,Math.min(60,+v('st-pl')||0)); });
}
function schPresetD(w){ schSaveD(s=>{ s.active=w; }, w==='winter'?'❄️ التوقيت الشتوي':'☀️ التوقيت الصيفي'); }
function schFixD(n,which,val){ schSaveD(s=>{ const k=String(n); s.fix[k]=s.fix[k]||{}; s.fix[k][which]=val; if(!s.fix[k].s&&!s.fix[k].e) delete s.fix[k]; },'حُفظ وقت الحصة'); }
function schClearFixD(n){ schSaveD(s=>{ delete s.fix[String(n)]; },'أُعيد الوقت المحسوب'); }
function schTimesPanel(){
  const s=schNorm(JSON.parse(JSON.stringify((CT_DATA||{}).schedule||schDefaultsD()))), T=tdTimes(s);
  const f=(id,l,val,attrs)=>`<label>${l}<input class="inp" id="${id}" ${attrs} value="${val}" onchange="schFieldsSave()"></label>`;
  const rows=T.map(t=>{ const fx=!!(s.fix[String(t.n)]&&s.fix[String(t.n)].s);
    const brk=(t.n===s.breakAfter&&s.breakLen>0)?`<div class="st-brk">☕ الفسحة بعد الحصة ${t.n} · ${s.breakLen} دقيقة</div>`:'';
    const pray=(s.prayAfter>0&&t.n===s.prayAfter&&s.prayLen>0)?`<div class="st-brk">🕌 فسحة الصلاة بعد الحصة ${t.n} · ${s.prayLen} دقيقة</div>`:'';
    return `<div class="st-t ${fx?'fixed':''}"><b>الحصة ${t.n}</b><input class="inp" type="time" value="${t.s}" onchange="schFixD(${t.n},'s',this.value)" title="البداية"> – <input class="inp" type="time" value="${t.e}" onchange="schFixD(${t.n},'e',this.value)" title="النهاية">${fx?`<button title="إرجاع الوقت المحسوب" onclick="schClearFixD(${t.n})">↩️</button>`:''}</div>${brk}${pray}`; }).join('');
  // سجل الحصص التي بدأتها من البوابة (آخر 7 أيام فيها حصص)
  const days=Object.keys(s.sessions||{}).sort().reverse().slice(0,7);
  const log=days.map(d=>{ const day=s.sessions[d]||{}; return Object.keys(day).sort((a,b)=>a-b).map(k=>{ const x=day[k]||{};
    return `<div><b>${d===ctToday()?'اليوم':d.slice(5).replace('-','/')} · ${k}</b><span>${esc(x.cls||'')}</span><span>${x.en?(x.skipped?'بلا كتابة':`${x.n||0} مشاركة تلقائية`):'مفتوحة'}</span><span class="muted">${x.en?(x.auto?'أُغلقت تلقائيًا':'أنهيتها'):'—'}</span></div>`; }).join(''); }).join('');
  return `<div class="st-panel"><h4>⏰ أوقات الحصص <small>تُحفظ على الخادم وتظهر في بوابة المعلم والجدول المطبوع وشريط «الآن»</small>
      <span class="ct-seg" style="margin-inline-start:auto"><button type="button" class="${s.active==='summer'?'on':''}" onclick="schPresetD('summer')">☀️ صيفي</button><button type="button" class="${s.active==='winter'?'on':''}" onclick="schPresetD('winter')">❄️ شتوي</button></span></h4>
    <div class="st-fields">
      ${f('st-base',`بداية الحصة الأولى (${s.active==='winter'?'شتوي':'صيفي'})`,s.presets[s.active],'type="time"')}
      ${f('st-dur','مدة الحصة (دقيقة)',s.dur,'type="number" min="20" max="90"')}
      ${f('st-count','عدد الحصص',s.count,'type="number" min="4" max="8"')}
      ${f('st-ba','الفسحة بعد الحصة',s.breakAfter,'type="number" min="1" max="8"')}
      ${f('st-bl','مدة الفسحة (دقيقة)',s.breakLen,'type="number" min="0" max="60"')}
      ${f('st-pa','🕌 فسحة الصلاة بعد الحصة',s.prayAfter,'type="number" min="0" max="8" title="0 = بلا"')}
      ${f('st-pl','مدة فسحة الصلاة',s.prayLen,'type="number" min="0" max="60"')}
    </div>
    <div class="st-times">${rows}</div>
    <div class="muted" style="font-size:.74rem;margin-top:.4rem">غيّر وقت أي حصة مباشرة إن اختلفت عن الحساب (تظهر بلون مميّز) — ↩️ يعيدها للحساب.</div></div>
  <details class="st-panel"><summary style="cursor:pointer;font-weight:800">📜 سجل الحصص <small class="muted">— الحصص التي بدأتها وأنهيتها من بوابة المعلم</small></summary>
    <div class="st-log" style="margin-top:.5rem">${log||'<div class="muted" style="display:block">لم تبدأ حصة من البوابة في الأيام الأخيرة.</div>'}</div></details>`;
}
/* محرر الجدول: لوحة الأوقات أعلاه، والأوقات تحت رؤوس الحصص */
(function(){
  const _cs=ctSchedule;
  ctSchedule=function(box){
    _cs(box);
    const w=document.createElement('div'); w.innerHTML=schTimesPanel();
    box.insertBefore(w, box.firstChild);
    const T=tdTimes(((CT_DATA||{}).schedule)||{});
    box.querySelectorAll('table.ct-sch thead th').forEach((th,i)=>{ const t=T[i-1]; if(i>0&&t) th.insertAdjacentHTML('beforeend',`<small>${schH12(t.sm)} – ${schH12(t.em)}</small>`); });
  };
})();
