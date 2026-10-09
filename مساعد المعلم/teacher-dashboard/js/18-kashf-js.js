/* ═══ 📑 الكشوف: صفحة واحدة بتبويبين (الأسبوعي · الشامل) و«الجدول | التحليل» داخل الشامل.
   تفتح على آخر كشف استخدمته، ويُحمل الفصل المختار عند التنقل بينها. ═══ */
const KASHF_KEY='dash_kashf_v1', KASHF_SEL={weekly:'wk-class',comprehensive:'comp-class',compan:'ca-class'};
document.addEventListener('change',e=>{ const id=e.target&&e.target.id; if(Object.values(KASHF_SEL).includes(id)) window._kashfCls=e.target.value; },true);
function kashfMark(v){
  document.querySelectorAll('[data-kmain]').forEach(b=>b.classList.toggle('on',(v==='weekly')===(b.dataset.kmain==='weekly')));
  document.querySelectorAll('[data-ksub]').forEach(b=>b.classList.toggle('on',b.dataset.ksub===v));
}
function kashfSyncSP(v){ // التحليل يتبع فلاتر الكشف نفسها
  const cs=document.getElementById('comp-semester'), cp=document.getElementById('comp-period');
  const as=document.getElementById('ca-semester'), ap=document.getElementById('ca-period');
  if(v==='compan'&&cs&&as){ as.value=cs.value; ap.value=cp.value; }
}
function kashfSP(){
  const cs=document.getElementById('comp-semester'), cp=document.getElementById('comp-period');
  cs.value=document.getElementById('ca-semester').value; cp.value=document.getElementById('ca-period').value;
  renderCompAnalysis(true);
}
function kashfCarry(v){
  const c=window._kashfCls; if(c==null) return false;
  const sel=document.getElementById(KASHF_SEL[v]); if(!sel) return false;
  if(sel.value===c) return true;
  if([...sel.options].some(o=>o.value===c)){ sel.value=c; return true; }
  return false;
}
/* نافذة «تقارير الأسبوع» تُعاد بناؤها إذا تغيّر الفصل أو الأسبوع وهي مفتوحة — كي لا تُرسل بيانات قديمة */
function wrPanelOpen(){ const p=document.getElementById('wr-panel'); return !!(p&&p.style.display!=='none'&&p.innerHTML.trim()); }
document.addEventListener('change',e=>{ if(e.target&&e.target.id==='wk-class'&&wrPanelOpen()) setTimeout(wrOpen,250); });
(function(){ const _ws=window.weekShift; if(typeof _ws!=='function') return;
  window.weekShift=function(){ const r=_ws.apply(this,arguments); if(wrPanelOpen()) setTimeout(wrOpen,350); return r; }; })();
function kashfGo(v){
  if(!v){ try{ v=localStorage.getItem(KASHF_KEY)||'weekly'; }catch(e){ v='weekly'; } }
  if(!KASHF_SEL[v]) v='weekly';
  try{ localStorage.setItem(KASHF_KEY,v); }catch(e){}
  closeModal&&closeModal();
  kashfSyncSP(v);
  const preset=kashfCarry(v);
  openDedicatedReport(v);
  kashfMark(v);
  // أول زيارة: قائمة الفصول تُملأ أثناء الرسم، فنطبّق الفصل بعده ونعيد الرسم مرة واحدة
  if(!preset&&window._kashfCls!=null) setTimeout(()=>{ if(kashfCarry(v)){ v==='weekly'?renderWeekly(false):v==='compan'?renderCompAnalysis(false):renderComprehensive(false); } },350);
}
