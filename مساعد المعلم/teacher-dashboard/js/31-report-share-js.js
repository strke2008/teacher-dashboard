'use strict';
/* 📤 مشاركة تقرير الفترة PDF (واتساب لولي الأمر أو المرشد…)
   الملف يُرسم من التقرير نفسه (html2canvas + jsPDF، كما في بوابة الطالب) ثم يُفتح نافذة المشاركة في الجهاز
   فيظهر واتساب ضمن الخيارات. حيث لا تدعم المتصفحات مشاركة الملفات (بعض أجهزة الكمبيوتر) يُحفظ الملف ليُرفق يدويًا. */
const RSH_LIBS={ h2c:'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js', pdf:'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js' };
const _rshLoaded={};
function rshLoad(src){
  return _rshLoaded[src] || (_rshLoaded[src]=new Promise((ok,no)=>{ const s=document.createElement('script'); s.src=src; s.async=true;
    s.onload=()=>ok(); s.onerror=()=>{ delete _rshLoaded[src]; no(new Error('load')); }; document.head.appendChild(s); }));
}
async function rshMakePdf(r){
  await Promise.all([rshLoad(RSH_LIBS.h2c), rshLoad(RSH_LIBS.pdf)]);
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
      pdf.addImage(part.toDataURL('image/jpeg',0.9),'JPEG',M,M,W,h/pxPerMm);
    }
    const name=('تقرير '+(r.name||'الطالب')+' - '+(r.label||'')).replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,90)+'.pdf';
    return new File([pdf.output('blob')], name, { type:'application/pdf' });
  } finally { host.remove(); }
}
async function reportShare(r){
  if(!r){ toast('افتح معاينة التقرير أولًا','bad'); return; }
  const first=String(r.name||'').trim().split(/\s+/)[0]||'';
  const text=`تقرير ${r.label||'الفترة'} للطالب ${r.name||''}${rcGet&&rcGet('subject')?` — مادة ${rcGet('subject')}`:''}`;
  openModal(`<h2>📤 مشاركة تقرير ${esc(first)}</h2>
    <p class="muted" id="rsh-msg" style="font-size:.9rem">جارٍ تجهيز ملف PDF…</p>
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إغلاق</button><button class="btn tick" id="rsh-go" disabled>⏳ لحظات…</button></div>`);
  let file=null;
  try{ file=await rshMakePdf(r); }
  catch(e){ const m=document.getElementById('rsh-msg'); if(m) m.textContent='تعذّر تجهيز الملف — تحقق من الإنترنت ثم حاول مرة أخرى.'; return; }
  const go=document.getElementById('rsh-go'), msg=document.getElementById('rsh-msg'); if(!go) return;   // أُغلقت النافذة
  const canFiles=!!(navigator.canShare && navigator.canShare({ files:[file] }));
  msg.innerHTML=canFiles
    ? `الملف جاهز (${Math.max(1,Math.round(file.size/1024))} ك.ب). اضغط <b>«مشاركة»</b> ثم اختر <b>واتساب</b> وحدّد ولي الأمر أو المرشد.`
    : `الملف جاهز. هذا المتصفح لا يشارك الملفات مباشرة: اضغط <b>«حفظ الملف»</b> ثم أرفقه في واتساب (📎 مستند) — أو افتح الصفحة من الجوال لمشاركته مباشرة.`;
  go.disabled=false; go.textContent=canFiles?'📤 مشاركة':'⬇️ حفظ الملف';
  // المشاركة تُستدعى مباشرة من ضغطة الزر — الآيفون يرفضها إن جاءت بعد انتظار
  go.onclick=async()=>{
    if(canFiles){
      try{ await navigator.share({ files:[file], title:file.name, text }); closeModal(); toast('📤 أُرسل التقرير','good'); }
      catch(e){ if(e && e.name!=='AbortError') msg.textContent='تعذّرت المشاركة — حاول مرة أخرى.'; }
      return;
    }
    const url=URL.createObjectURL(file), a=document.createElement('a');
    a.href=url; a.download=file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    msg.innerHTML='⬇️ حُفظ الملف في «التنزيلات». افتح واتساب ← المحادثة ← 📎 ← مستند، واختر الملف.';
  };
}
