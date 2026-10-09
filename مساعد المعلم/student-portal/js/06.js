/* ═══ 📄 تقرير الطالب — عرض وطباعة (نسخة مطابقة في لوحة المعلم وبوابة الطالب) ═══ */
function srpEsc(v){ return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
/* 📚 مدرستي في التقرير: «حل 6 من 8 (75%)»، وأسماء ما لم يُحل، وما زال ضمن مهلة الحل.
   التقارير القديمة (بلا counted) تبقى بعرضها السابق. */
function srpMadTxt(md){
  if(md.counted===undefined) return `حل ${md.solved} · لم يحل ${md.missed}`;
  const base = md.counted ? `حل ${md.solved} من ${md.counted}${md.pct!=null?` (${md.pct}%)`:''}` : 'لا واجبات منتهية بعد';
  return base + (md.inGrace ? ` · ${md.inGrace} ضمن مهلة الحل` : '') + (md.forgiven ? ` · ${md.forgiven} مُسح ببطاقة` : '');
}
function srpMadList(md){
  const miss = Array.isArray(md.missedList) ? md.missedList : [], pend = Array.isArray(md.pendingList) ? md.pendingList : [], fg = Array.isArray(md.forgivenList) ? md.forgivenList : [];
  if(!md.linked || (!miss.length && !pend.length && !fg.length)) return '';
  const e = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  return `<tr class="srp-madlist"><td colspan="3">${miss.length ? `<div><b>لم يُحل:</b> ${miss.map(e).join('، ')}</div>` : ''}${fg.length ? `<div><b>🧽 مُسح خصمه ببطاقة:</b> ${fg.map(e).join('، ')}</div>` : ''}${pend.length ? `<div><b>ما زال مفتوحًا في المنصة:</b> ${pend.map(p => `${e(p.title)} (${p.dueAt ? madCloseText(p.dueAt) : `${p.daysLeft} ${p.daysLeft === 1 ? 'يوم' : p.daysLeft === 2 ? 'يومان' : 'أيام'}`})`).join('، ')}</div>` : ''}</td></tr>`;
}
function srpNum(v){ if(v==null||v==='') return '—'; const n=Number(v); return Number.isInteger(n)?String(n):n.toFixed(1).replace(/\.0$/,''); }
function srpDate(d){ try{ const t=typeof d==='number'?d:Date.parse(d+'T12:00:00+03:00'); return new Date(t).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Riyadh'}); }catch(_){ return String(d||''); } }
function srpShortDate(d){ try{ return new Date(Date.parse(d+'T12:00:00+03:00')).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn',{day:'numeric',month:'short',timeZone:'Asia/Riyadh'}); }catch(_){ return String(d||''); } }
function srpHTML(r){
  if(!r) return '';
  // measured=false: الدرجة افتراضية لا مرصودة، فلا يُمنح مستوى (لا «ممتاز» لمشاركة لم تُرصد)
  const tile=(label,score,max,sub,kind,icon,measured)=>{ const pct=score==null?0:Math.max(0,Math.min(100,Math.round(Number(score)*100/max)));
    const lv=(score==null||measured===false)?null:pct>=90?['ممتاز','lv-a']:pct>=75?['جيد جدًا','lv-b']:pct>=60?['جيد','lv-c']:['يحتاج متابعة','lv-d'];
    return `<div class="srp-tile ${kind||''}"><span class="srp-tl"><em class="srp-ic">${icon||''}</em>${label}${lv?`<em class="srp-lv ${lv[1]}">${lv[0]}</em>`:''}</span><div class="srp-tv"><b>${srpNum(score)}</b><small>/ ${max}</small></div>
      <i class="srp-meter"><i style="width:${pct}%"></i></i><span class="srp-ts">${sub}</span></div>`; };
  const p=r.participation||{}, h=r.homework||{}, b=r.behavior||{}, e=r.exam||{}, ac=r.activities||null;   // ac: تقارير قديمة بلا أنشطة تبقى كما كانت
  const cp=h.classPart, md=h.madrasati;
  const notes=(b.notes||[]);
  const tests=(e.tests||[]);
  return `<article class="srp" dir="rtl" lang="ar">
    <header class="srp-head">
      ${(()=>{ const lg=(typeof MOE_LOGO!=='undefined'&&MOE_LOGO)||window.__MOE_LOGO||''; return lg?`<div class="srp-logo">${lg}</div>`:''; })()}
      <div class="srp-brand"><span class="srp-kicker">تقرير الطالب</span><h1>${srpEsc(r.label||'')}</h1>
        <span class="srp-range">${r.range&&r.range.start?`من ${srpEsc(srpDate(r.range.start))} إلى ${srpEsc(srpDate(r.range.end))}`:''}${r.year?` · العام ${srpEsc(r.year)}`:''}</span></div>
      <div class="srp-who"><b>${srpEsc(r.name||'')}</b><span>${srpEsc(r.cls||'')}</span></div>
    </header>
    <section class="srp-tiles${ac?' n5':''}">
      ${tile('المشاركة',p.score,p.max||10,p.measured?`شارك ${p.yes} · لم يشارك ${p.no}`:'لم تُرصد بعد','k-part','⭐',!!p.measured)}
      ${tile('الواجبات',h.score,h.max||10,cp&&md?`الفصل ${srpNum(cp.score)} · مدرستي ${srpNum(md.score)}`:'','k-hw','📚',!!((cp&&(Number(cp.done)+Number(cp.missed))>0)||(md&&md.linked)))}
      ${tile('السلوك',b.score,b.max||10,notes.length?`${b.pos||0} إيجابي · ${b.neg||0} ملاحظة`:'منضبط','k-beh','👍')}
      ${ac?tile('الأنشطة',ac.score,ac.max||10,ac.measured?`سلّم ${ac.done} من ${ac.n} نشاط`:'لا أنشطة مطلوبة','k-act','🧩',!!ac.measured):''}
      ${tile('الاختبارات الفترية',e.measured?e.score:null,e.max||20,e.measured?`${tests.filter(t=>t.score!=null).length} من ${tests.length} اختبار`:'لم تُرصد بعد','k-ex','📝',!!e.measured)}
    </section>
    <section class="srp-grid">
      <div class="srp-card k-hw"><h2><em class="srp-ic">📚</em>الواجبات</h2>
        <table class="srp-t"><tbody>
          ${cp?`<tr><th>واجبات الفصل</th><td>سُلّم ${cp.done} · لم يُسلَّم ${cp.missed}${Number(cp.forgiven)>0?` · 🧽 مُسح ${cp.forgiven}`:''}</td><td class="srp-s">${srpNum(cp.score)} / ${cp.max}</td></tr>`:''}
          ${md?`<tr><th>واجبات منصة مدرستي</th><td>${md.linked?srpMadTxt(md):'—'}</td><td class="srp-s">${srpNum(md.score)} / ${md.max}</td></tr>${srpMadList(md)}`:''}
          <tr class="srp-sum"><th>المجموع</th><td></td><td class="srp-s">${srpNum(h.score)} / ${h.max||10}</td></tr>
        </tbody></table></div>
      <div class="srp-card k-ex"><h2><em class="srp-ic">📝</em>الاختبارات الفترية</h2>
        ${tests.length?`<table class="srp-t"><tbody>${tests.map(t=>`<tr><th>${srpEsc(t.title)}</th><td class="srp-s">${t.score==null?'<span class="srp-na">لم يُرصد</span>':`${srpNum(t.score)} / ${srpNum(t.max)}`}</td></tr>`).join('')}
          <tr class="srp-sum"><th>الدرجة من 20</th><td class="srp-s">${e.measured?srpNum(e.score):'—'} / ${e.max||20}</td></tr></tbody></table>`
          :'<p class="srp-empty">لا توجد اختبارات مسجّلة لهذه الفترة.</p>'}</div>
    </section>
    <section class="srp-card srp-beh k-beh"><h2><em class="srp-ic">👍</em>الملاحظات السلوكية</h2>
      ${notes.length?`<ul class="srp-notes">${notes.map(n=>`<li class="${n.type==='positive'?'pos':'neg'}"><span class="srp-nd">${srpEsc(srpShortDate(n.date))}</span>
        <span class="srp-nt">${n.type==='positive'?'إيجابية':'ملاحظة'}</span><span class="srp-nx">${srpEsc(n.category)}${n.category&&n.note?' — ':''}${srpEsc(n.note)}</span></li>`).join('')}</ul>`
        :'<p class="srp-empty">لا توجد ملاحظات سلوكية خلال هذه الفترة.</p>'}
    </section>
    ${r.teacherNote?`<section class="srp-note"><h2><em class="srp-ic">💬</em>ملاحظة المعلم</h2><p>${srpEsc(r.teacherNote)}</p></section>`:''}
    <footer class="srp-foot"><span>صدر في ${srpEsc(srpDate(r.publishedAt||Date.now()))}</span><span>مساعد المعلم</span></footer>
  </article>`;
}
/* ═══ 🖨️ تقرير الطالب — قالب الطباعة الرسمي (A4) ═══
   الشاشة تبقى بعرض srpHTML. الطباعة وملف PDF يستخدمان هذا القالب: ترويسة واضحة، مجموع بارز،
   بطاقة لكل مجال بلونه، تفاصيل مرتّبة في قوائم، «خطوتك القادمة»، وتوقيع ولي الأمر. */
const SRX_CSS = `
.srx{direction:rtl;font-family:'Readex Pro','Tajawal','Segoe UI',Tahoma,sans-serif;color:#16233A;background:#fff;width:100%;font-size:10pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.srx *{box-sizing:border-box;letter-spacing:0}
.srx-head{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:4mm;background:#0E5B4E;color:#fff;border-radius:4mm;padding:3mm 4.5mm}
.srx-logo{width:21mm;height:21mm;margin:-2mm 0}.srx-logo svg{width:100%;height:100%;display:block}.srx-logo svg [class^="moe-st"]{fill:#fff!important}
.srx-kick{display:inline-block;background:rgba(243,210,122,.2);color:#F3D27A;font-weight:800;font-size:8.5pt;border-radius:99px;padding:.3mm 3mm}
.srx-title{margin:1mm 0 .4mm;font-size:13.5pt;font-weight:800;line-height:1.3;color:#fff}
.srx-range{font-size:8.5pt;color:rgba(255,255,255,.85)}
.srx-who{background:#fff;color:#16233A;border-radius:3mm;padding:2.2mm 3.5mm;min-width:50mm;max-width:64mm;display:grid;gap:.6mm}
.srx-who small{font-size:7.5pt;color:#5A6B84;font-weight:700}.srx-who b{font-size:12pt;font-weight:800;line-height:1.35}.srx-who span{font-size:9pt;color:#0E5B4E;font-weight:800}
.srx-sum{display:grid;grid-template-columns:44mm 1fr;gap:4mm;margin-top:4mm;align-items:stretch}
.srx-total{border:1.4px solid #0E5B4E;border-radius:4mm;display:grid;place-items:center;align-content:center;gap:1.5mm;padding:3mm;text-align:center;background:#F2F8F6}
.srx-ring{width:30mm;height:30mm;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#0E5B4E calc(var(--p)*1%),#DCE8E5 0)}
.srx-ring>div{width:23mm;height:23mm;border-radius:50%;background:#fff;display:grid;place-items:center;align-content:center}
.srx-ring b{font-size:17pt;font-weight:800;line-height:1}.srx-ring small{font-size:8pt;color:#5A6B84}
.srx-total>span{font-size:9pt;font-weight:800;color:#0E5B4E}
.srx-tiles{display:grid;grid-template-columns:repeat(var(--n),1fr);gap:2.5mm}
.srx-tile{border:1px solid #DDE4EE;border-top:2mm solid var(--c);border-radius:3mm;padding:2.5mm 3mm;display:grid;gap:1.2mm;align-content:start;background:#fff}
.srx-tl{display:flex;align-items:center;gap:1.5mm;font-weight:800;font-size:9pt}.srx-tl i{font-style:normal;width:6mm;height:6mm;border-radius:1.6mm;background:var(--w);display:grid;place-items:center;font-size:8.5pt}
.srx-tv{display:flex;align-items:baseline;gap:1mm}.srx-tv b{font-size:18pt;font-weight:800;color:var(--c);line-height:1}.srx-tv small{font-size:8.5pt;color:#5A6B84}
.srx-bar{height:1.6mm;border-radius:99px;background:var(--w);overflow:hidden}.srx-bar i{display:block;height:100%;background:var(--c);border-radius:99px}
.srx-lv{justify-self:start;font-size:7.5pt;font-weight:800;border-radius:99px;padding:.2mm 2.2mm}
.srx-lv.a{background:#E3F5EC;color:#137A53}.srx-lv.b{background:#E7EFFC;color:#2459B8}.srx-lv.c{background:#FFF3DC;color:#9A6512}.srx-lv.d{background:#FDE7EA;color:#B23346}.srx-lv.n{background:#EEF1F5;color:#5A6B84}
.srx-ts{font-size:7.5pt;color:#5A6B84;line-height:1.4}
.srx-h{display:flex;align-items:center;gap:2mm;margin:4mm 0 2.2mm;font-size:11pt;font-weight:800;color:#0E5B4E}.srx-h::after{content:"";flex:1;height:.3mm;background:#CFE0DC}
.srx-grid{display:grid;grid-template-columns:1fr 1fr;gap:3.5mm;align-items:start}.srx-col{display:grid;gap:3.5mm}
.srx-card{border:1px solid #DDE4EE;border-inline-start:1.5mm solid var(--c);border-radius:3mm;padding:3mm 3.5mm;break-inside:avoid;page-break-inside:avoid;background:#fff}
.srx-card h3{display:flex;align-items:center;gap:1.8mm;margin:0 0 2mm;font-size:10.5pt;font-weight:800;color:var(--c)}.srx-card h3 i{font-style:normal;width:6.5mm;height:6.5mm;border-radius:1.8mm;background:var(--w);display:grid;place-items:center;font-size:9pt}
.srx-row{display:grid;grid-template-columns:1fr auto;gap:2mm;align-items:center;padding:1.6mm 0;border-bottom:1px solid #EDF1F6}
.srx-row:last-child{border-bottom:0}
.srx-row b{font-size:9.5pt}.srx-row small{display:block;font-size:8pt;color:#5A6B84;font-weight:500}
.srx-row em{font-style:normal;font-weight:800;font-size:10pt;white-space:nowrap;font-variant-numeric:tabular-nums}
.srx-row.sum{background:var(--w);border-radius:2mm;padding:1.8mm 2.5mm;margin-top:1.2mm;border:0}.srx-row.sum em{color:var(--c);font-size:11pt}
.srx-mini{height:1.3mm;border-radius:99px;background:#EDF1F6;overflow:hidden;margin-top:.8mm}.srx-mini i{display:block;height:100%;background:var(--c)}
.srx-na{color:#8A97AB;font-weight:600}
.srx-list{margin:2mm 0 0;padding:2mm 2.5mm;border-radius:2mm;font-size:8.5pt}
.srx-list.bad{background:#FDF0F2}.srx-list.warn{background:#FFF6E3}
.srx-list b{display:block;font-size:8.5pt;margin-bottom:.8mm}.srx-list.bad b{color:#B23346}.srx-list.warn b{color:#9A6512}
.srx-list ul{margin:0;padding-inline-start:4.5mm;display:grid;gap:.4mm}.srx-list li{line-height:1.45}.srx-list li small{color:#5A6B84}
.srx-wide{margin-top:3.5mm}
.srx-notes{display:grid;gap:1.4mm}
.srx-note{display:grid;grid-template-columns:14mm 13mm 1fr;gap:2mm;align-items:baseline;padding:1.5mm 2.5mm;border-radius:2mm;font-size:9pt;background:#F6F8FC}
.srx-note.pos{background:#ECF8F2}.srx-note.neg{background:#FDF0F2}.srx-note span:first-child{color:#5A6B84;font-size:8pt}.srx-note.pos span:nth-child(2){color:#137A53;font-weight:800}.srx-note.neg span:nth-child(2){color:#B23346;font-weight:800}
.srx-empty{margin:0;color:#5A6B84;font-size:9pt}
.srx-next{margin-top:3.5mm;border:1.2px dashed #E0A21F;background:#FFFBF0;border-radius:3mm;padding:3mm 4mm;break-inside:avoid}
.srx-next h3{margin:0 0 1.5mm;font-size:10.5pt;color:#9A6512}.srx-next ul{margin:0;padding-inline-start:5mm;display:grid;gap:.8mm;font-size:9.5pt}
.srx-tnote{margin-top:3.5mm;border-inline-start:1.5mm solid #0E5B4E;background:#F2F8F6;border-radius:0 3mm 3mm 0;padding:3mm 4mm;break-inside:avoid}
.srx-tnote h3{margin:0 0 1mm;font-size:10pt;color:#0E5B4E}.srx-tnote p{margin:0;white-space:pre-wrap;font-size:9.5pt}
.srx-sign{display:grid;grid-template-columns:1fr 1fr;gap:10mm;margin-top:5mm;break-inside:avoid}
.srx-sign div{font-size:9pt;font-weight:700;color:#33465E}.srx-sign div span{display:block;margin-top:6mm;border-bottom:1px dotted #8A97AB}
.srx-foot{display:flex;justify-content:space-between;margin-top:5mm;padding-top:2mm;border-top:1px solid #DDE4EE;font-size:7.5pt;color:#5A6B84}
/* 🖥️ العرض على الشاشة (بوابة الطالب ومعاينة المعلم): نفس التصميم، ويتكيّف مع عرض الصندوق لا الشاشة */
@media screen{
  /* ملف PDF للآيفون يُرسم من الشاشة (html2canvas) فيبقى بشكل الورقة */
  :not(.srp-pdf)>.srx{container-type:inline-size;border-radius:18px;padding:14px;box-shadow:0 8px 26px rgba(22,35,58,.10);border:1px solid #E3E9F1;font-size:10.5pt}
  :not(.srp-pdf)>.srx .srx-sign{display:none}
  @container (max-width:820px){
    .srx-sum{grid-template-columns:1fr}
    .srx-total{grid-template-columns:auto 1fr;justify-items:start;text-align:start;gap:4mm}
    .srx-total>span{font-size:11pt}
  }
  @container (max-width:640px){
    .srx-head{grid-template-columns:auto 1fr;gap:3mm}
    .srx-who{grid-column:1/-1;max-width:none;min-width:0}
    .srx-tiles{grid-template-columns:1fr 1fr}
    .srx-tile:last-child:nth-child(odd){grid-column:1/-1}
    .srx-grid{grid-template-columns:1fr}
    .srx-title{font-size:12.5pt}
    .srx-note{grid-template-columns:auto auto 1fr}
  }
}
`;
function srxStyle(){
  if(document.getElementById('srx-style')) return;
  const st=document.createElement('style'); st.id='srx-style'; st.textContent=SRX_CSS; document.head.insertBefore(st, document.getElementById('late-css'));
}
function srxLevel(score,max,measured){
  if(score==null||measured===false) return ['لم يُرصد','n'];
  const p=Number(score)*100/(Number(max)||1);
  return p>=90?['ممتاز','a']:p>=75?['جيد جدًا','b']:p>=60?['جيد','c']:['يحتاج متابعة','d'];
}
function srxHTML(r){
  if(!r) return '';
  srxStyle();
  const E=srpEsc, N=srpNum;
  const p=r.participation||{}, h=r.homework||{}, b=r.behavior||{}, e=r.exam||{}, ac=r.activities||null, cp=h.classPart, md=h.madrasati;
  const notes=b.notes||[], tests=e.tests||[];
  const K={part:['#1B9C6B','#E8F6F0'],hw:['#2F6FDB','#EAF1FC'],beh:['#7A4FD1','#F1ECFB'],act:['#0E8C8C','#E4F4F4'],ex:['#E07A1F','#FDF1E6']};
  const sty=k=>`style="--c:${K[k][0]};--w:${K[k][1]}"`;
  const pct=(s,m)=>s==null?0:Math.max(0,Math.min(100,Math.round(Number(s)*100/(Number(m)||1))));
  const D=[
    {k:'part',ic:'⭐',t:'المشاركة',s:p.score,m:p.max||10,ms:!!p.measured,sub:p.measured?`شارك ${p.yes||0} · لم يشارك ${p.no||0}`:'لم تُرصد بعد'},
    {k:'hw',ic:'📚',t:'الواجبات',s:h.score,m:h.max||10,ms:!!((cp&&(Number(cp.done)+Number(cp.missed))>0)||(md&&md.linked)),sub:cp&&md?`الفصل ${N(cp.score)} · مدرستي ${N(md.score)}`:''},
    {k:'beh',ic:'👍',t:'السلوك',s:b.score,m:b.max||10,ms:true,sub:notes.length?`${b.pos||0} إيجابية · ${b.neg||0} ملاحظة`:'منضبط'},
    ...(ac?[{k:'act',ic:'🧩',t:'الأنشطة',s:ac.score,m:ac.max||10,ms:!!ac.measured,sub:ac.measured?`سلّم ${ac.done} من ${ac.n}`:'لا أنشطة مطلوبة'}]:[]),
    {k:'ex',ic:'📝',t:'الاختبارات',s:e.measured?e.score:null,m:e.max||20,ms:!!e.measured,sub:e.measured?`${tests.filter(t=>t.score!=null).length} من ${tests.length} اختبار`:'لم تُرصد بعد'}
  ];
  const tot=D.reduce((a,x)=>a+(x.s==null?0:Number(x.s)||0),0), totMax=D.reduce((a,x)=>a+x.m,0), totP=pct(tot,totMax);
  const totLv=srxLevel(tot,totMax,true);
  const miss=md&&Array.isArray(md.missedList)?md.missedList:[], pend=md&&Array.isArray(md.pendingList)?md.pendingList:[]; const fgl=md&&Array.isArray(md.forgivenList)?md.forgivenList:[];
  const pendTxt=x=>x.dueAt&&typeof madCloseText==='function'?madCloseText(x.dueAt):(x.daysLeft!=null?`باقي ${x.daysLeft} ${x.daysLeft===1?'يوم':'أيام'}`:'');
  // 🎯 خطوتك القادمة: ما يستطيع الطالب فعله الآن، لا لوم على ما فات
  const next=[];
  if(pend.length) next.push(`حلّ ${pend.length===1?'واجب مدرستي المفتوح':`واجبات مدرستي المفتوحة (${pend.length})`} قبل إغلاقها.`);
  if(cp&&Number(cp.missed)>0) next.push(`سلّم واجبات الفصل المتأخرة (${cp.missed}) لمعلمك.`);
  if(ac&&ac.measured&&Number(ac.n)>Number(ac.done)) next.push(`أكمل أنشطتك في البوابة: ${Number(ac.n)-Number(ac.done)} لم تُسلَّم بعد.`);
  if(p.measured&&Number(p.no)>Number(p.yes)) next.push('ارفع يدك وشارك أكثر في الحصة.');
  const weakEx=tests.filter(t=>t.score!=null&&Number(t.score)<Number(t.max)*.6);
  if(weakEx.length) next.push(`راجع دروس: ${weakEx.map(t=>t.title).join('، ')}.`);
  const praise=totP>=90?'أداء ممتاز — استمر على هذا المستوى 🌟':totP>=75?'أداء جيد جدًا — خطوة صغيرة وتصل للامتياز 💪':totP>=60?'أداء جيد — ركّز على النقاط أدناه لترتفع درجتك':'تحتاج متابعة — ابدأ بالخطوات أدناه وستلاحظ الفرق';
  const logo=(typeof MOE_LOGO!=='undefined'&&MOE_LOGO)||window.__MOE_LOGO||'';
  const range=r.range&&r.range.start?`من ${E(srpDate(r.range.start))} إلى ${E(srpDate(r.range.end))}`:'';
  return `<article class="srx" dir="rtl" lang="ar">
    <header class="srx-head">
      ${logo?`<div class="srx-logo">${logo}</div>`:'<div></div>'}
      <div><span class="srx-kick">تقرير الطالب${r.year?` · ${E(r.year)}`:''}</span><div class="srx-title">${E(r.label||'')}</div>
        <div class="srx-range">${range}</div></div>
      <div class="srx-who"><small>اسم الطالب</small><b>${E(r.name||'')}</b>${r.cls?`<span>الصف: ${E(r.cls)}</span>`:''}</div>
    </header>
    <section class="srx-sum">
      <div class="srx-total"><div class="srx-ring" style="--p:${totP}"><div><b>${N(Math.round(tot*10)/10)}</b><small>من ${totMax}</small></div></div>
        <span>المجموع · ${totLv[0]}</span></div>
      <div class="srx-tiles" style="--n:${D.length}">${D.map(x=>{ const lv=srxLevel(x.s,x.m,x.ms); return `<div class="srx-tile" ${sty(x.k)}>
        <div class="srx-tl"><i>${x.ic}</i>${x.t}</div>
        <div class="srx-tv"><b>${N(x.s)}</b><small>/ ${x.m}</small></div>
        <div class="srx-bar"><i style="width:${pct(x.s,x.m)}%"></i></div>
        <span class="srx-lv ${lv[1]}">${lv[0]}</span>${x.sub?`<span class="srx-ts">${x.sub}</span>`:''}</div>`; }).join('')}</div>
    </section>
    <div class="srx-h">📋 التفاصيل</div>
    <section class="srx-grid">
      <div class="srx-card" ${sty('hw')}><h3><i>📚</i>الواجبات</h3>
        ${cp?`<div class="srx-row"><div><b>واجبات الفصل</b><small>سُلّم ${cp.done} · لم يُسلَّم ${cp.missed}${Number(cp.forgiven)>0?` · 🧽 مُسح ${cp.forgiven}`:''}</small></div><em>${N(cp.score)} / ${cp.max}</em></div>`:''}
        ${md?`<div class="srx-row"><div><b>منصة مدرستي</b><small>${md.linked?srpMadTxt(md):'غير مربوط'}</small></div><em>${N(md.score)} / ${md.max}</em></div>`:''}
        <div class="srx-row sum"><b>مجموع الواجبات</b><em>${N(h.score)} / ${h.max||10}</em></div>
        ${miss.length?`<div class="srx-list bad"><b>✗ لم يُحل في مدرستي (${miss.length})</b><ul>${miss.map(t=>`<li>${E(t)}</li>`).join('')}</ul></div>`:''}
        ${fgl.length?`<div class="srx-list"><b>🧽 مُسح خصمه ببطاقة (${fgl.length})</b><ul>${fgl.map(t=>`<li>${E(t)}</li>`).join('')}</ul></div>`:''}
        ${pend.length?`<div class="srx-list warn"><b>⏳ ما زال مفتوحًا — حلّه الآن (${pend.length})</b><ul>${pend.map(x=>`<li>${E(x.title)}${pendTxt(x)?` <small>· ${E(pendTxt(x))}</small>`:''}</li>`).join('')}</ul></div>`:''}
      </div>
      <div class="srx-col"><div class="srx-card" ${sty('ex')}><h3><i>📝</i>الاختبارات الفترية</h3>
        ${tests.length?tests.map(t=>`<div class="srx-row"><div><b>${E(t.title)}</b>${t.score==null?'':`<div class="srx-mini"><i style="width:${pct(t.score,t.max)}%"></i></div>`}</div><em>${t.score==null?'<span class="srx-na">لم يُرصد</span>':`${N(t.score)} / ${N(t.max)}`}</em></div>`).join('')
          +`<div class="srx-row sum"><b>الدرجة من ${e.max||20}</b><em>${e.measured?N(e.score):'—'} / ${e.max||20}</em></div>`
          :'<p class="srx-empty">لا توجد اختبارات مسجّلة لهذه الفترة.</p>'}
      </div>
      <div class="srx-card" ${sty('beh')}><h3><i>👍</i>الملاحظات السلوكية</h3>
      ${notes.length?`<div class="srx-notes">${notes.map(n=>`<div class="srx-note ${n.type==='positive'?'pos':'neg'}"><span>${E(srpShortDate(n.date))}</span><span>${n.type==='positive'?'إيجابية':'ملاحظة'}</span><span>${E(n.category)}${n.category&&n.note?' — ':''}${E(n.note)}</span></div>`).join('')}</div>`
        :'<p class="srx-empty">✓ لا توجد ملاحظات سلوكية خلال هذه الفترة — أحسنت.</p>'}
      </div></div>
    </section>
    <div class="srx-next"><h3>🎯 ${praise}</h3>${next.length?`<ul>${next.slice(0,4).map(t=>`<li>${E(t)}</li>`).join('')}</ul>`:'<div style="font-size:9.5pt">لا شيء متأخر — حافظ على مستواك.</div>'}</div>
    ${r.teacherNote?`<div class="srx-tnote"><h3>💬 ملاحظة المعلم</h3><p>${E(r.teacherNote)}</p></div>`:''}
    <div class="srx-sign"><div>اطّلع ولي الأمر — الاسم والتوقيع:<span></span></div><div>معلم المادة — التوقيع:<span></span></div></div>
    <footer class="srx-foot"><span>صدر في ${E(srpDate(r.publishedAt||Date.now()))}</span><span>مساعد المعلم</span></footer>
  </article>`;
}
function srpPrintNative(r){
  let host=document.getElementById('srp-print-host');
  if(!host){ host=document.createElement('div'); host.id='srp-print-host'; document.body.appendChild(host); }
  host.innerHTML=srxHTML(r);
  document.documentElement.classList.add('srp-printing');
  const done=()=>{ document.documentElement.classList.remove('srp-printing'); host.innerHTML=''; };
  printCleanupLater(done);
  setTimeout(()=>{ window.print(); }, 60);
}

/* 🖨️ الطباعة: في Safari والمتصفحات = نافذة الطباعة كما هي.
   على iPhone من أيقونة الشاشة الرئيسية لا يعمل window.print() إطلاقًا (قيد من Apple)،
   فيُصنع ملف PDF بنفس شكل الطباعة الرسمي ويُفتح له قائمة المشاركة (فيها «طباعة» و«حفظ في الملفات»). */
function srpIsIOSApp(){
  const ios=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  let sa=false; try{ sa=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true; }catch(e){}
  return ios&&sa;
}
function srpPrint(r){ return srpIsIOSApp() ? srpPdfFlow(r) : srpPrintNative(r); }
const SRP_LIBS={ h2c:'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js', pdf:'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js' };
const _srpLoaded={};
function srpLoad(src){
  return _srpLoaded[src] || (_srpLoaded[src]=new Promise((ok,no)=>{ const s=document.createElement('script'); s.src=src; s.async=true;
    s.onload=()=>ok(); s.onerror=()=>{ delete _srpLoaded[src]; no(new Error('load')); }; document.head.appendChild(s); }));
}
async function srpMakePdf(r){
  await Promise.all([srpLoad(SRP_LIBS.h2c), srpLoad(SRP_LIBS.pdf)]);
  const host=document.createElement('div');
  host.className='srp-pdf';
  host.style.cssText='position:fixed;left:-10000px;top:0;width:703px;background:#fff;pointer-events:none';   // 186mm = عرض الورقة بعد الهوامش
  host.innerHTML=srxHTML(r);
  document.body.appendChild(host);
  try{
    try{ await document.fonts.ready; }catch(e){}
    const canvas=await window.html2canvas(host.firstElementChild,{ scale:2, backgroundColor:'#ffffff', useCORS:true, windowWidth:703, logging:false });
    const { jsPDF }=window.jspdf;
    const pdf=new jsPDF({ unit:'mm', format:'a4', orientation:'portrait' });
    const M=12, W=210-2*M, H=297-2*M, pxPerMm=canvas.width/W, sliceH=Math.floor(H*pxPerMm);
    for(let y=0, first=true; y<canvas.height; y+=sliceH, first=false){
      const h=Math.min(sliceH, canvas.height-y), part=document.createElement('canvas');
      part.width=canvas.width; part.height=h;
      part.getContext('2d').drawImage(canvas,0,y,canvas.width,h,0,0,canvas.width,h);
      if(!first) pdf.addPage();
      pdf.addImage(part.toDataURL('image/jpeg',0.92),'JPEG',M,M,W,h/pxPerMm);
    }
    const name=('تقرير '+(r.name||'الطالب')+' - '+(r.label||'')).replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,90)+'.pdf';
    return new File([pdf.output('blob')], name, { type:'application/pdf' });
  } finally { host.remove(); }
}
async function srpPdfFlow(r){
  document.getElementById('srp-pdf-sheet')?.remove();
  const box=document.createElement('div');
  box.id='srp-pdf-sheet';
  box.style.cssText='position:fixed;inset:0;z-index:80;background:rgba(22,35,58,.55);display:flex;align-items:center;justify-content:center;padding:1rem';
  box.innerHTML=`<div class="sheet" style="max-width:360px;width:100%;text-align:center">
      <h3 style="margin:.2rem 0 .4rem">🖨️ طباعة التقرير</h3>
      <p class="muted" id="srp-pdf-msg" style="font-size:.86rem;margin:0 0 .8rem">جارٍ تجهيز ملف PDF…</p>
      <div style="display:grid;gap:.5rem">
        <button class="btn tick" id="srp-pdf-go" disabled>⏳ لحظات…</button>
        <button class="btn ghost" id="srp-pdf-close">إغلاق</button>
      </div></div>`;
  document.body.appendChild(box);
  const close=()=>box.remove();
  box.querySelector('#srp-pdf-close').onclick=close;
  let file=null;
  try{ file=await srpMakePdf(r); }
  catch(e){ box.querySelector('#srp-pdf-msg').textContent='تعذّر تجهيز الملف — تحقق من الإنترنت ثم حاول مرة أخرى.'; box.querySelector('#srp-pdf-go').textContent='تعذّر التجهيز'; return; }
  const go=box.querySelector('#srp-pdf-go'), msg=box.querySelector('#srp-pdf-msg');
  msg.innerHTML='الملف جاهز. اضغط الزر ثم اختر <b>«طباعة»</b> أو <b>«حفظ في الملفات»</b>.';
  go.disabled=false; go.textContent='🖨️ طباعة أو حفظ PDF';
  // المشاركة تُستدعى مباشرة من ضغطة الزر — iPhone يرفضها إن جاءت بعد انتظار
  go.onclick=async()=>{
    if(navigator.canShare && navigator.canShare({ files:[file] })){
      try{ await navigator.share({ files:[file], title:file.name }); close(); }
      catch(e){ if(e && e.name!=='AbortError') msg.textContent='تعذّرت المشاركة — حاول مرة أخرى.'; }
      return;
    }
    const url=URL.createObjectURL(file), a=document.createElement('a');   // بديل: فتح الملف نفسه (فيه زر المشاركة ثم الطباعة)
    a.href=url; a.download=file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 60000); close();
  };
}

/* 📄 تقريري — يُجلب بجلسة الطالب (رمزه) فقط؛ لا يُرسل الاسم أو المعرف */
const MYREP={ open:false, reports:[], idx:0, wk:0, tab:'', loaded:false };
function myRepWeeklyBadge(on){ const b=document.getElementById('my-report-new'); if(b) b.classList.toggle('hide',!on); myRepTabsSync(); myRepAlertSync(); }
/* 🔴 تنبيه أحمر بارز على «تقريري» ما دام فيه تقرير لم يُفتح */
function myRepAlertSync(){
  const w=!document.getElementById('my-report-new')?.classList.contains('hide'), p=!document.getElementById('my-report-new-p')?.classList.contains('hide');
  const on=w||p, panel=document.getElementById('my-report-panel'), al=document.getElementById('my-report-alert'), t=document.getElementById('my-report-alert-t'), ping=document.getElementById('my-report-ping');
  if(panel) panel.classList.toggle('mr-has-new',on); if(al) al.classList.toggle('hide',!on||MYREP.open); if(ping) ping.classList.toggle('hide',!on);
  if(t) t.textContent=w&&p?'وصلك تقريران جديدان':p?'وصلك تقرير الفترة الجديد':'وصلك تقرير أسبوعك الجديد';
}
function myRepPeriodBadge(on){ const b=document.getElementById('my-report-new-p'); if(b) b.classList.toggle('hide',!on); myRepTabsSync(); myRepAlertSync(); }
/* 👁️ «شاهد التقرير» يُحفظ على الخادم أيضًا (msg:seen:<id> مع حالة التنبيهات)، فلا يعود أحمر في متصفح أو جهاز آخر */
let REP_SEEN_SRV = new Set();
function repSeen(id){ return REP_SEEN_SRV.has(String(id)) || seenMsgIds().includes(id); }
function markRepSeen(ids){
  markMsgsSeen(ids);
  const nm=String(myName||lockedName()||'').trim(); if(!nm) return;
  ids.filter(Boolean).forEach(id=>{ id=String(id); if(REP_SEEN_SRV.has(id)) return; REP_SEEN_SRV.add(id); dismissNoticeServer(nm,'msg:seen:'+id).catch(()=>{}); });
}
function repSeenSync(keys){
  if(!keys) return;
  keys.forEach(k=>{ k=String(k); if(k.startsWith('msg:seen:')) REP_SEEN_SRV.add(k.slice(9)); });
  // ما رآه على هذا الجهاز ولم يصل الخادم بعد (تحديث قديم) يُرفع الآن
  const local=new Set(seenMsgIds());
  const ids=[...(WEEKLY_MSGS||[]),...(SREP_MSGS||[])].map(m=>m.id).filter(id=>local.has(id)&&!REP_SEEN_SRV.has(String(id)));
  if(ids.length) markRepSeen(ids);
  try{ myRepWeeklyBadge(myRepNew('week')); myRepPeriodBadge(myRepNew('period')); }catch(e){}
}
function myRepNew(k){ return ((k==='week'?WEEKLY_MSGS:SREP_MSGS)||[]).some(m=>!repSeen(m.id)); }
/* 📊 تقارير الأسبوع: مكانها هنا (تبقى متاحة بلا ازدحام التنبيهات)، آخر 6 أسابيع */
function myRepWeeklyHTML(){
  const list=(WEEKLY_MSGS||[]).slice(0,6);
  if(!list.length) return '<p class="muted" style="margin:.4rem 0">لم يصلك تقرير أسبوعي بعد.</p>';
  const i=Math.min(MYREP.wk,list.length-1), seen=new Set(seenMsgIds());
  const label=m=>{const d=m.wk||(wkParse(m.body).d)||{};return d.f?wkDay(d.f):String(m.createdAt||'').slice(0,10)};
  return `${list.length>1?`<div class="myrep-tabs">${list.map((m,k)=>`<button type="button" class="myrep-tab ${k===i?'on':''}" onclick="MYREP.wk=${k};myRepWeekly()">${k===0?'آخر أسبوع':'أسبوع '+esc(label(m))}</button>`).join('')}</div>`:''}
    ${weeklyCardHTML(list[i], !seen.has(list[i].id), [])}`;
}
function myRepWeekly(){
  const box=document.getElementById('myrep-weekly'); if(!box) return;
  box.innerHTML=`<p class="myrep-hint">📊 <b>تقرير الأسبوع</b>: ملخص سريع لأسبوع واحد (مشاركتك وواجباتك وأنشطتك) يصلك تلقائيًا كل أسبوع.</p>${myRepWeeklyHTML()}`;
  const list=(WEEKLY_MSGS||[]).slice(0,6); if(list.length){ markRepSeen((WEEKLY_MSGS||[]).map(m=>m.id)); myRepWeeklyBadge(false); }
}
function myRepTabsSync(){
  const bar=document.getElementById('myrep-switch'); if(!bar) return;
  bar.querySelectorAll('[data-rt]').forEach(b=>{ const k=b.dataset.rt; b.classList.toggle('on',k===MYREP.tab); const d=b.querySelector('.myrep-dot'); if(d) d.classList.toggle('hide',k===MYREP.tab||!myRepNew(k)); });
}
function myRepTab(k){
  MYREP.tab=k==='period'?'period':'week';
  const w=document.getElementById('myrep-weekly'), p=document.getElementById('myrep-period'); if(!w||!p) return;
  w.classList.toggle('hide',MYREP.tab!=='week'); p.classList.toggle('hide',MYREP.tab!=='period');
  if(MYREP.tab==='week') myRepWeekly();
  else{ if(!MYREP.loaded) myRepLoadPeriod(); if((SREP_MSGS||[]).length){ markRepSeen(SREP_MSGS.map(m=>m.id)); myRepPeriodBadge(false); } }
  myRepTabsSync();
}
function myRepOpen(tab){
  const panel=document.getElementById('my-report-panel');
  const t=tab==='period'||tab==='week'?tab:(myRepNew('period')&&!myRepNew('week')?'period':MYREP.tab||'week');
  if(!MYREP.open) myRepToggle(t); else myRepTab(t);
  if(panel) panel.scrollIntoView({behavior:'smooth',block:'start'});
}
function myRepRender(){
  const box=document.getElementById('myrep-period'); if(!box) return;
  const hint='<p class="myrep-hint">📄 <b>تقرير الفترة</b>: تقريرك الرسمي بدرجاتك في الفترة كاملة، يرسله معلمك نهاية كل فترة ويمكنك طباعته.</p>';
  if(!MYREP.reports.length){ box.innerHTML=hint+'<p class="muted" style="margin:.4rem 0">لم يُرسل معلمك تقرير فترة بعد.</p>'; return; }
  const r=MYREP.reports[MYREP.idx]||MYREP.reports[0];
  box.innerHTML=`${hint}<div class="myrep-bar">
      ${MYREP.reports.length>1?`<div class="myrep-tabs">${MYREP.reports.map((x,i)=>`<button type="button" class="myrep-tab ${i===MYREP.idx?'on':''}" onclick="MYREP.idx=${i};myRepRender()">${srpEsc(x.label)}</button>`).join('')}</div>`:'<span></span>'}
      <button type="button" class="btn tick" onclick="srpPrint(MYREP.reports[MYREP.idx])">🖨️ طباعة التقرير</button>
    </div>${srxHTML(r)}`;
}
async function myRepLoadPeriod(){
  const pbox=document.getElementById('myrep-period'); if(!pbox) return;
  pbox.innerHTML='<p class="muted center" style="margin:.6rem 0">جارٍ فتح تقرير الفترة…</p>';
  const api=((typeof HW!=='undefined'&&HW&&HW.api)||API||'').replace(/\/+$/,'');
  try{
    const res=await storeFetch(api+'/student-report/mine',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const j=await res.json().catch(()=>({}));
    if(!res.ok||!j.ok){ pbox.innerHTML=`<p class="muted" style="margin:.4rem 0">${j.error==='auth_cancel'?'يلزم رمزك لعرض تقرير الفترة.':'تعذّر فتح تقرير الفترة — حاول لاحقًا.'}</p>`; return; }
    MYREP.reports=j.reports||[]; MYREP.idx=0; MYREP.loaded=true; myRepRender();
  }catch(_){ pbox.innerHTML='<p class="muted" style="margin:.4rem 0">تعذّر الاتصال — تحقق من الإنترنت.</p>'; }
}
async function myRepToggle(tab){
  const box=document.getElementById('my-report-box'), chev=document.getElementById('my-report-chev');
  MYREP.open=!MYREP.open; box.classList.toggle('hide',!MYREP.open); if(chev) chev.textContent=MYREP.open?'⌃':'⌄';
  myRepAlertSync();
  if(!MYREP.open) return;
  MYREP.loaded=false;
  box.innerHTML=`<div class="myrep-switch" id="myrep-switch" role="tablist">
      <button type="button" role="tab" data-rt="week" onclick="myRepTab('week')">📊 تقرير الأسبوع<i class="myrep-dot hide"></i></button>
      <button type="button" role="tab" data-rt="period" onclick="myRepTab('period')">📄 تقرير الفترة<i class="myrep-dot hide"></i></button>
    </div><div id="myrep-weekly"></div><div id="myrep-period" class="hide"></div>`;
  myRepTab(typeof tab==='string'&&tab?tab:(myRepNew('period')&&!myRepNew('week')?'period':'week'));
}

/* ⚡ حفظ البوابة على الجهاز: يُسجَّل sw.js عند كل فتح (لا عند تفعيل التنبيهات فقط)،
   فتُفتح البوابة فورًا من الجهاز، وعند وجود إصدار أحدث يظهر زر «تحديث الآن» */
if('serviceWorker' in navigator && window.isSecureContext){
  addEventListener('load', ()=>setTimeout(()=>{ try{ spReg().catch(()=>{}); }catch(e){} }, 1500));
  navigator.serviceWorker.addEventListener('message', ev=>{
    if(!(ev.data && ev.data.type==='dash-update') || document.getElementById('sp-upd')) return;
    const b=document.createElement('div'); b.id='sp-upd';
    b.style.cssText='position:fixed;inset-inline:12px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:3000;max-width:460px;margin:auto;background:#16233A;color:#fff;border-radius:14px;padding:10px 12px;display:flex;align-items:center;gap:10px;font-weight:700;font-size:.9rem;box-shadow:0 10px 30px rgba(0,0,0,.25)';
    b.innerHTML='<span style="flex:1">🔄 نسخة أحدث من البوابة جاهزة</span><button type="button" style="font:inherit;font-weight:800;border:0;border-radius:10px;padding:7px 12px;background:#1B9C6B;color:#fff;cursor:pointer">تحديث الآن</button><button type="button" aria-label="لاحقًا" style="font:inherit;border:0;background:transparent;color:#9FB2CC;cursor:pointer;font-size:1rem">✕</button>';
    b.children[1].onclick=()=>location.reload(); b.children[2].onclick=()=>b.remove();
    document.body.appendChild(b);
  });
}
