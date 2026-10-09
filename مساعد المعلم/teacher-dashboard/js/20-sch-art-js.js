/* ألوان ثابتة لكل فصل (بترتيب الفصول) — الداكن نصه أبيض */
const SCH_PAL=[['#BDEB8F','#14213D'],['#FFD54F','#14213D'],['#FBC5D0','#14213D'],['#C4643C','#fff'],['#CBBDF6','#14213D'],['#2468A8','#fff'],['#8ED8D0','#14213D'],['#F6A96B','#14213D'],['#7E57C2','#fff'],['#9CCC65','#14213D']];
const SCH_SVG={
  leaf:`<svg width="22mm" height="22mm" viewBox="0 0 100 100"><path d="M18 88 C40 70 60 52 88 14" stroke="#3F8F3A" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M40 66 C24 64 14 52 14 40 C30 42 40 52 40 66Z" fill="#5DAA4C"/><path d="M54 50 C40 44 34 30 38 18 C52 24 58 36 54 50Z" fill="#6BBF59"/>
    <path d="M44 62 C58 66 70 60 78 48 C64 44 52 50 44 62Z" fill="#4E9A43"/><path d="M66 36 C76 38 86 32 92 22 C80 18 70 24 66 36Z" fill="#6BBF59"/></svg>`,
  flask:`<svg width="34mm" height="36mm" viewBox="0 -14 120 134">
    <rect x="18" y="92" width="80" height="12" rx="3" fill="#2E5A88"/><rect x="22" y="94" width="72" height="3" fill="#fff" opacity=".7"/>
    <rect x="24" y="80" width="70" height="12" rx="3" fill="#E58A3A"/><rect x="28" y="82" width="62" height="3" fill="#fff" opacity=".7"/>
    <path d="M54 30 L54 52 L36 78 Q34 82 38 82 L82 82 Q86 82 84 78 L66 52 L66 30 Z" fill="#E8F4FA" stroke="#5B7A99" stroke-width="2.5"/>
    <path d="M44 66 L76 66 L84 78 Q86 82 82 82 L38 82 Q34 82 36 78 Z" fill="#7BC77A"/><circle cx="60" cy="74" r="3" fill="#9B6FD0"/><circle cx="70" cy="76" r="2.4" fill="#9B6FD0"/>
    <rect x="51" y="26" width="18" height="6" rx="2" fill="#5B7A99"/>
    <path d="M60 28 C60 18 60 12 60 6" stroke="#3F8F3A" stroke-width="3" fill="none"/>
    <path d="M60 14 C48 14 40 6 40 -2 C52 0 60 6 60 14Z" fill="#5DAA4C"/><path d="M60 10 C72 10 80 2 80 -6 C68 -4 60 2 60 10Z" fill="#6BBF59"/></svg>`,
  atom:`<svg width="12mm" height="12mm" viewBox="0 0 100 100" fill="none" stroke="#2E5A88" stroke-width="4"><ellipse cx="50" cy="50" rx="44" ry="16"/><ellipse cx="50" cy="50" rx="44" ry="16" transform="rotate(60 50 50)"/><ellipse cx="50" cy="50" rx="44" ry="16" transform="rotate(-60 50 50)"/><circle cx="50" cy="50" r="7" fill="#E58A3A" stroke="none"/></svg>`,
  sprout:`<svg width="11mm" height="11mm" viewBox="0 0 100 100"><path d="M50 95 L50 50" stroke="#3F8F3A" stroke-width="5"/><path d="M50 58 C30 58 16 44 14 26 C34 28 48 40 50 58Z" fill="#5DAA4C"/><path d="M50 52 C68 50 82 36 86 18 C66 20 52 32 50 52Z" fill="#6BBF59"/></svg>`
};
function ctSchArtHTML(){
  const s=ctSch(CT_DATA||{}), subj=String(rcGet('subject')||'العلوم').trim(), cellSubj=subj.replace(/^ال/,'');
  const classes=[...new Set([...ctClasses(),...Object.values(s.grid).flatMap(d=>Object.values(d||{})).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'ar',{numeric:true}));
  const col=c=>SCH_PAL[Math.max(0,classes.indexOf(c))%SCH_PAL.length];
  // نخفي أعمدة الحصص الفارغة في نهاية اليوم كله (مثلًا الحصة 8 بلا حصص)
  let n=s.count; while(n>4&&CT_DAYS.every((_,dy)=>!((s.grid[String(dy)]||{})[String(n)]))) n--;
  const cells=[];
  cells.push('<div></div>');
  const TT=(typeof tdTimes==='function')?tdTimes((CT_DATA||{}).schedule||{}):[];
  for(let p=1;p<=n;p++){ const t=TT[p-1]; cells.push(`<div class="sch-h">الحصة<b>${p}</b>${t?`<em class="sch-tm">${schH12(t.sm)} – ${schH12(t.em)}</em>`:''}</div>`); }
  CT_DAYS.forEach((dn,dy)=>{
    cells.push(`<div class="sch-day">${esc(dn.replace(/^ال/,''))}</div>`);
    for(let p=1;p<=n;p++){ const c=(s.grid[String(dy)]||{})[String(p)];
      if(!c){ cells.push('<div class="sch-c e"></div>'); continue; }
      const [bg,fg]=col(c); cells.push(`<div class="sch-c" style="background:${bg};color:${fg}">${esc(cellSubj)}<small>${esc(c)}</small></div>`); }
  });
  return `<div class="sch-art">
    <div class="sch-top">
      <div class="sch-motto r">${SCH_SVG.leaf}<span>العلم<br>نور الحياة</span></div>
      <div class="sch-title">جدول حصص ${esc(subj)}</div>
      <div class="sch-motto l"><span>معًا ..<br>نصنع المستقبل</span>${SCH_SVG.flask}</div>
    </div>
    <div class="sch-grid" style="grid-template-columns:30mm repeat(${n},1fr);grid-template-rows:22mm repeat(5,1fr)">${cells.join('')}</div>
    <div class="sch-foot"><span>بالعلم ... نصنع الفرق</span>${SCH_SVG.atom}<i></i><span>كل حصة .. خطوة نحو عالم أفضل</span>${SCH_SVG.sprout}</div>
  </div>`;
}
/* الطباعة: صفحة A4 أفقية بلا هوامش — نفس آلية شهادات الشكر */
ctSchPrint=function(){
  let box=document.getElementById('plan-print'); if(!box){ box=document.createElement('div'); box.id='plan-print'; box.className='rep'; document.body.appendChild(box); }
  box.innerHTML=ctSchArtHTML();
  document.getElementById('ct-cert-page')?.remove();
  const st=document.createElement('style'); st.id='ct-cert-page';
  st.textContent='@media print{@page{size:A4 landscape!important;margin:0!important}}';
  document.body.appendChild(st);
  const rm=()=>{ st.remove(); window.removeEventListener('afterprint',rm); };
  window.addEventListener('afterprint',rm); setTimeout(rm,60000);
  unifiedA4Print({bodyClass:'printing-cert',title:'جدول الحصص',selector:'#plan-print',orientation:'landscape',margin:'0'});
};
/* معاينة مصغّرة أسفل محرر الجدول */
(function(){
  const _cs=ctSchedule;
  ctSchedule=function(box){
    _cs(box);
    const w=document.createElement('div'); w.className='sch-preview';
    w.innerHTML=`<div class="muted" style="font-size:.8rem;margin:0 0 .4rem">👁️ معاينة الطباعة (A4 أفقي) — تتحدّث مع كل تعديل في الجدول</div><div class="sch-wrap"><div class="sch-scale">${ctSchArtHTML()}</div></div>`;
    box.appendChild(w);
    const fit=()=>{ const sc=w.querySelector('.sch-scale'), wr=w.querySelector('.sch-wrap'); if(!sc||!wr) return;
      const k=Math.min(1,(w.clientWidth-16)/sc.offsetWidth); sc.style.transform=`scale(${k})`; wr.style.height=(sc.offsetHeight*k)+'px'; };
    requestAnimationFrame(fit); setTimeout(fit,150);
  };
})();
