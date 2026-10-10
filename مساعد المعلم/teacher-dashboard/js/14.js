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
  const tile=(label,score,max,sub)=>{ const pct=score==null?0:Math.max(0,Math.min(100,Math.round(Number(score)*100/max)));
    return `<div class="srp-tile"><span class="srp-tl">${label}</span><div class="srp-tv"><b>${srpNum(score)}</b><small>/ ${max}</small></div>
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
      ${tile('المشاركة',p.score,p.max||10,p.measured?`شارك ${p.yes} · لم يشارك ${p.no}`:'لم تُرصد بعد')}
      ${tile('الواجبات',h.score,h.max||10,cp&&md?`الفصل ${srpNum(cp.score)} · مدرستي ${srpNum(md.score)}`:'')}
      ${tile('السلوك',b.score,b.max||10,notes.length?`${b.pos||0} إيجابي · ${b.neg||0} ملاحظة`:'منضبط')}
      ${ac?tile('الأنشطة',ac.score,ac.max||10,ac.measured?`سلّم ${ac.done} من ${ac.n} نشاط`:'لا أنشطة مطلوبة'):''}
      ${tile('الاختبارات الفترية',e.measured?e.score:null,e.max||20,e.measured?`${tests.filter(t=>t.score!=null).length} من ${tests.length} اختبار`:'لم تُرصد بعد')}
    </section>
    <section class="srp-grid">
      <div class="srp-card"><h2>الواجبات</h2>
        <table class="srp-t"><tbody>
          ${cp?`<tr><th>واجبات الفصل</th><td>سُلّم ${cp.done} · لم يُسلَّم ${cp.missed}${Number(cp.forgiven)>0?` · 🧽 مُسح ${cp.forgiven}`:''}</td><td class="srp-s">${srpNum(cp.score)} / ${cp.max}</td></tr>`:''}
          ${md?`<tr><th>واجبات منصة مدرستي</th><td>${md.linked?srpMadTxt(md):'—'}</td><td class="srp-s">${srpNum(md.score)} / ${md.max}</td></tr>${srpMadList(md)}`:''}
          <tr class="srp-sum"><th>المجموع</th><td></td><td class="srp-s">${srpNum(h.score)} / ${h.max||10}</td></tr>
        </tbody></table></div>
      <div class="srp-card"><h2>الاختبارات الفترية</h2>
        ${tests.length?`<table class="srp-t"><tbody>${tests.map(t=>`<tr><th>${srpEsc(t.title)}</th><td class="srp-s">${t.score==null?'<span class="srp-na">لم يُرصد</span>':`${srpNum(t.score)} / ${srpNum(t.max)}`}</td></tr>`).join('')}
          <tr class="srp-sum"><th>الدرجة من 20</th><td class="srp-s">${e.measured?srpNum(e.score):'—'} / ${e.max||20}</td></tr></tbody></table>`
          :'<p class="srp-empty">لا توجد اختبارات مسجّلة لهذه الفترة.</p>'}</div>
    </section>
    <section class="srp-card srp-beh"><h2>الملاحظات السلوكية</h2>
      ${notes.length?`<ul class="srp-notes">${notes.map(n=>`<li class="${n.type==='positive'?'pos':'neg'}"><span class="srp-nd">${srpEsc(srpShortDate(n.date))}</span>
        <span class="srp-nt">${n.type==='positive'?'إيجابية':'ملاحظة'}</span><span class="srp-nx">${srpEsc(n.category)}${n.category&&n.note?' — ':''}${srpEsc(n.note)}</span></li>`).join('')}</ul>`
        :'<p class="srp-empty">لا توجد ملاحظات سلوكية خلال هذه الفترة.</p>'}
    </section>
    ${r.teacherNote?`<section class="srp-note"><h2>ملاحظة المعلم</h2><p>${srpEsc(r.teacherNote)}</p></section>`:''}
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
function srpPrint(r){
  let host=document.getElementById('srp-print-host');
  if(!host){ host=document.createElement('div'); host.id='srp-print-host'; document.body.appendChild(host); }
  host.innerHTML=srxHTML(r);
  document.documentElement.classList.add('srp-printing');
  const done=()=>{ document.documentElement.classList.remove('srp-printing'); host.innerHTML=''; window.removeEventListener('afterprint',done); };
  window.addEventListener('afterprint',done);
  setTimeout(()=>printThen(done),60);
}

/* 📤 تقارير الطلاب — من الكشف الشامل: معاينة، إرسال لبوابة الطالب، سحب */
const SREPD={ sem:1, per:1, cls:'', sent:{}, note:'', fresh:null };
/* حالة الإرسال بعد الإرسال/السحب مباشرة: الخادم قد يعيد النسخة السابقة لدقيقة تقريبًا، فنعتمد آخر حالة أعادها هو نفسه */
function srepKeep(sent){ SREPD.sent=sent||{}; SREPD.fresh={ key:`${SREPD.sem}:${SREPD.per}`, at:Date.now(), sent:SREPD.sent }; }
function srepSel(){ SREPD.sem=Number((document.getElementById('comp-semester')||{}).value)===2?2:1; SREPD.per=Number((document.getElementById('comp-period')||{}).value)===2?2:1; SREPD.cls=(document.getElementById('comp-class')||{}).value||''; }
function srepRoster(){ return STUDENTS.filter(s=>!SREPD.cls||String(s.cls||'')===SREPD.cls).sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar')); }
async function srepOpen(){
  srepSel();
  const fr=SREPD.fresh, useFresh=fr&&fr.key===`${SREPD.sem}:${SREPD.per}`&&Date.now()-fr.at<90000;
  if(useFresh) SREPD.sent=fr.sent;
  else try{ SREPD.sent=(await healthApi('/student-report/status',{semester:SREPD.sem,period:SREPD.per})).sent||{}; }
  catch(e){ toast(e.status===404?'انشر آخر نسخة من الخادم لتفعيل التقارير':'تعذّر تحميل حالة التقارير','bad'); return; }
  const list=srepRoster(), sentN=list.filter(s=>SREPD.sent[s.id]).length;
  const lbl=`${SREPD.sem===2?'الفصل الدراسي الثاني':'الفصل الدراسي الأول'} — ${SREPD.per===2?'الفترة الثانية':'الفترة الأولى'}`;
  openModal(`<h2>📤 تقارير الطلاب</h2>
    <p style="margin:.15rem 0 .7rem;color:var(--ink-soft);font-size:.85rem">${esc(lbl)} · ${esc(SREPD.cls||'كل الفصول')} · أُرسل ${sentN} من ${list.length}</p>
    <label style="font-weight:700;font-size:.85rem">ملاحظة تظهر في تقارير هذه الدفعة <small style="font-weight:400;color:var(--ink-soft)">(اختياري)</small></label>
    <textarea class="inp" id="srep-note" maxlength="400" rows="2" placeholder="مثال: أداء جيد، ركّز على مراجعة وحدة الحركة">${esc(SREPD.note)}</textarea>
    <div class="srepd-list">${list.map(s=>`<div class="srepd-row"><span class="srepd-n">${esc(s.name)}<small>${esc(s.cls||'')}</small></span>
        <span class="srepd-st ${SREPD.sent[s.id]?'on':''}">${SREPD.sent[s.id]?'أُرسل '+esc(fmtDate(SREPD.sent[s.id])):'لم يُرسل'}</span>
        <span class="srepd-acts"><button class="btn ghost sm" type="button" onclick="srepPreview('${esc(s.id)}')">👁️ معاينة</button>
        <button class="btn ${SREPD.sent[s.id]?'ghost':'tick'} sm" type="button" onclick="srepSendOne('${esc(s.id)}')" title="${SREPD.sent[s.id]?'أعد إرسال تقريره بالدرجات الحالية':'أرسل تقريره وحده'}">${SREPD.sent[s.id]?'↻ تحديث':'📤 إرسال'}</button>
        ${SREPD.sent[s.id]?`<button class="btn ghost sm" type="button" onclick="srepWithdrawOne('${esc(s.id)}')" title="اسحب تقريره من بوابته">سحب</button>`:''}</span></div>`).join('')||'<div class="feature-empty">لا طلاب في هذا الفصل.</div>'}</div>
    <div class="modal-foot">
      <button class="btn tick" type="button" onclick="srepSend()" ${list.length?'':'disabled'}>📤 إرسال لـ ${list.length} طالب</button>
      ${sentN?`<button class="btn ghost" type="button" onclick="srepWithdraw()">سحب المُرسل (${sentN})</button>`:''}
      <button class="btn ghost" type="button" onclick="closeModal()">إغلاق</button>
    </div>`);
}
/* 🧩 درجة الأنشطة للتقرير = عمود «الأنشطة» في الكشف حرفيًا: نفس الدالتين ونفس المعادلة */
function srepActsFor(list){
  const out={};
  for(const s of (list||[])){
    const acts=compActivitiesForStudent(s), done=compSubmissionCount(acts,s);
    out[String(s.id)]={ n:acts.length, done, score:acts.length?Math.round(done/acts.length*100)/10:10 };
  }
  return out;
}
async function srepPreview(sid){
  SREPD.note=(document.getElementById('srep-note')||{}).value||SREPD.note;
  try{
    const j=await healthApi('/student-report/preview',{semester:SREPD.sem,period:SREPD.per,sid,note:SREPD.note,
      acts:srepActsFor(srepRoster().filter(s=>String(s.id)===String(sid)))});
    window.__srepPreview=j.report;
    openModal(`<div class="srepd-prev-bar"><button class="btn ghost sm" type="button" onclick="srepOpen()">→ رجوع</button>
        <span style="color:var(--ink-soft);font-size:.82rem">معاينة — هكذا يراه الطالب${SREPD.sent[sid]?' (المُرسل له نسخة سابقة حتى تعيد الإرسال)':''}</span>
        <button class="btn tick sm" type="button" onclick="srpPrint(window.__srepPreview)">🖨️ طباعة</button></div>${srxHTML(j.report)}`);
  }catch(_){ toast('تعذّرت المعاينة','bad'); }
}
async function srepSend(){
  SREPD.note=(document.getElementById('srep-note')||{}).value||'';
  const list=srepRoster();
  if(!(await askConfirm(`يُرسل تقرير الفترة إلى بوابة ${list.length} طالب${list.some(s=>SREPD.sent[s.id])?'، ويستبدل التقارير المرسلة سابقًا لهذه الفترة':''}. يراه كل طالب برمزه فقط.`,{title:'إرسال التقارير؟',yes:'أرسل',no:'إلغاء'}))) return;
  try{
    const j=await healthApi('/student-report/publish',{semester:SREPD.sem,period:SREPD.per,sids:list.map(s=>String(s.id)),note:SREPD.note,acts:srepActsFor(list)});
    if(j.sent) srepKeep(j.sent); else { const now=Date.now(), st={...SREPD.sent}; list.forEach(s=>{ st[s.id]=now; }); srepKeep(st); }
    toast(`📤 أُرسل ${j.published} تقرير`,'good'); srepOpen();
  }catch(e){ toast(e.message==='no_students'?'الطلاب غير موجودين على الخادم — زامن الطلاب أولًا':'تعذّر الإرسال','bad'); }
}
/* 📤 طالب واحد: إرسال تقريره أو تحديثه أو سحبه دون بقية الفصل */
async function srepSendOne(sid){
  SREPD.note=(document.getElementById('srep-note')||{}).value||SREPD.note||'';
  const s=srepRoster().find(x=>String(x.id)===String(sid)); if(!s) return;
  const upd=!!SREPD.sent[s.id];
  if(!(await askConfirm(`${upd?'يُستبدل تقرير':'يُرسل تقرير'} ${s.name} في بوابته بالدرجات الحالية${SREPD.note?'، مع ملاحظة الدفعة':''}.`,{title:upd?'تحديث تقريره؟':'إرسال تقريره؟',yes:upd?'حدّث':'أرسل',no:'إلغاء'}))) return;
  try{
    const j=await healthApi('/student-report/publish',{semester:SREPD.sem,period:SREPD.per,sids:[String(s.id)],note:SREPD.note,acts:srepActsFor([s])});
    if(j.sent) srepKeep(j.sent); else { const st={...SREPD.sent}; st[s.id]=Date.now(); srepKeep(st); }
    toast(`📤 ${upd?'حُدّث':'أُرسل'} تقرير ${s.name}`,'good'); srepOpen();
  }catch(e){ toast(e.message==='no_students'?'الطالب غير موجود على الخادم — زامن الطلاب أولًا':'تعذّر الإرسال','bad'); }
}
async function srepWithdrawOne(sid){
  const s=srepRoster().find(x=>String(x.id)===String(sid)); if(!s) return;
  if(!(await askConfirm(`يُحذف تقرير ${s.name} من بوابته لهذه الفترة.`,{title:'سحب تقريره؟',yes:'اسحب',no:'إلغاء',danger:true}))) return;
  try{ const j=await healthApi('/student-report/unpublish',{semester:SREPD.sem,period:SREPD.per,sids:[String(s.id)]});
    if(j.sent) srepKeep(j.sent); else { const st={...SREPD.sent}; delete st[s.id]; srepKeep(st); }
    toast(`سُحب تقرير ${s.name}`,'good'); srepOpen(); }
  catch(_){ toast('تعذّر السحب','bad'); }
}
async function srepWithdraw(){
  const ids=srepRoster().filter(s=>SREPD.sent[s.id]).map(s=>String(s.id));
  if(!(await askConfirm(`تُحذف ${ids.length} تقارير من بوابة الطلاب لهذه الفترة.`,{title:'سحب التقارير؟',yes:'اسحب',no:'إلغاء',danger:true}))) return;
  try{ const j=await healthApi('/student-report/unpublish',{semester:SREPD.sem,period:SREPD.per,sids:ids});
    if(j.sent) srepKeep(j.sent); else { const st={...SREPD.sent}; ids.forEach(id=>{ delete st[id]; }); srepKeep(st); }
    toast(`سُحبت ${ids.length} تقارير من بوابة الطلاب`,'good'); srepOpen(); }
  catch(_){ toast('تعذّر السحب','bad'); }
}

