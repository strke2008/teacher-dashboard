/* 🧩 ترتيب صفحة اليوم — لكل جهاز ترتيبه (الكمبيوتر غير الجوال) */
const TL_KEY='dash_today_layout_v1';
const TL_NAMES={tasks:'✅ مهام اليوم',asks:'💬 رسائل الطلاب',week:'📅 هذا الأسبوع',alerts:'🔔 التنبيهات والطلبات',follow:'👥 يحتاجون متابعتك',recent:'🕐 آخر التسليمات',hw:'📚 حالة الأنشطة',stats:'📊 أرقام عامة'};
/* العرض من 12 عمودًا؛ الصف يمتلئ بالترتيب نفسه (لا قفز للبطاقات لسد الفراغ)، وبطاقات الصف الواحد بطول واحد */
const TL_DEF={order:['stats','tasks','asks','week','follow','alerts','recent','hw'],w:{stats:12,tasks:4,asks:4,week:4,follow:6,alerts:6,recent:6,hw:6},hide:{}};   // الافتراضي: ترتيب المعلم المختار
const TL_W=[[3,'¼'],[4,'⅓'],[6,'½'],[8,'⅔'],[9,'¾'],[12,'كامل']];
/* الطول — [المفتاح، الاسم، أقصى ارتفاع، عدد آخر التسليمات]؛ أو رقم بالبكسل عند السحب من زاوية البطاقة */
const TL_H=[['a','تلقائي','none',7],['s','قصير','200px',5],['m','متوسط','320px',7],['l','طويل','560px',15],['x','بلا حد','none',40]];
function tlHDef(k){ return k==='tasks'||k==='asks'||k==='week'?'a':'m'; }
function tlHOf(c,k){ const v=c.h[k]; if(typeof v==='number'&&v>0) return {key:'px',css:v+'px',rows:Math.max(3,Math.round(v/62))}; const t=TL_H.find(x=>x[0]===(v||tlHDef(k)))||TL_H[2]; return {key:t[0],css:t[2],rows:t[3]}; }
function tlRows(k){ return tlHOf(tlGet(),k).rows; }
let TL_ON=false;
function tlGet(){ let c=null; try{ c=JSON.parse(localStorage.getItem(TL_KEY)||'null'); }catch(e){}
  c=c&&typeof c==='object'?c:{}; const o=(Array.isArray(c.order)?c.order:[]).filter(k=>TL_DEF.order.includes(k));
  // بطاقة جديدة لم تكن في ترتيب المعلم المحفوظ: تُضاف بعد سابقتها في الترتيب الافتراضي (لا في الآخر)
  TL_DEF.order.forEach((k,i)=>{ if(o.includes(k)) return; let at=o.length; for(let j=i-1;j>=0;j--){ const p=o.indexOf(TL_DEF.order[j]); if(p>=0){ at=p+1; break; } } o.splice(at,0,k); });
  // الترتيب المحفوظ قبل نظام الـ12 عمودًا كانت أعراضه من 6
  // (الأعراض القديمة كانت تُخلّف فراغات في الصفوف؛ نبدأ بالأعراض الجديدة المتناسقة ونحفظ الترتيب والإخفاء)
  const w={}; if(c.u===12) Object.entries(c.w||{}).forEach(([k,v])=>{ v=Number(v)||0; if(v>0) w[k]=Math.min(12,Math.max(2,v)); });
  return {u:12,order:o,w:{...TL_DEF.w,...w},h:{...(c.h||{})},hide:{...(c.hide||{})}}; }
function tlSet(c){ try{ localStorage.setItem(TL_KEY,JSON.stringify(c)); }catch(e){} tlApply(); }
function tlApply(){
  const B=document.getElementById('td-board'); if(!B) return; const c=tlGet();
  let top=B.querySelector('.tl-top'); if(!top){ top=document.createElement('div'); top.className='tl-top'; B.prepend(top); }
  top.innerHTML=`<span>🧩 <b>وضع الترتيب</b> — اسحب البطاقة من ⠿ إلى مكانها، وغيّر حجمها بسحب الزاوية <b>◢</b> (يسار أسفل البطاقة) أو بالأزرار. الأول يظهر يمينًا ثم يسارًا ثم الصف التالي، وبطاقات الصف الواحد بطول واحد.</span>
    <button class="btn ghost sm" onclick="tlReset()">↩️ الترتيب الافتراضي</button><button class="btn tick sm" onclick="tlEdit(false)">✓ تم</button>`;
  c.order.forEach(k=>{ const el=B.querySelector(`:scope>[data-blk="${k}"]`); if(!el) return; B.appendChild(el);
    const w=c.w[k]||4, hh=tlHOf(c,k); el.style.setProperty('--w',w); el.dataset.w=w; el.classList.toggle('tl-wide',w>=8);
    el.style.setProperty('--h',hh.css); el.dataset.h=hh.key; el.classList.toggle('tl-hidden',!!c.hide[k]); });
  tlDecorate();
}
function tlDecorate(){
  const B=document.getElementById('td-board'); if(!B) return; const c=tlGet();
  B.classList.toggle('tl-on',TL_ON);
  B.querySelectorAll(':scope>.td-blk').forEach(el=>{
    const k=el.dataset.blk, host=el.tagName==='DETAILS'?(el.querySelector(':scope>summary')||el):el; let bar=host.querySelector(':scope>.tl-bar');   // في البطاقة المطوية لا يظهر إلا عنوانها
    let rs=el.querySelector(':scope>.tl-rs');
    if(!TL_ON){ if(bar) bar.remove(); if(rs) rs.remove(); return; }
    if(!bar){ bar=document.createElement('div'); bar.className='tl-bar'; host.prepend(bar); }
    if(!rs){ rs=document.createElement('span'); rs.className='tl-rs'; rs.title='اسحب لتغيير العرض والطول'; rs.textContent='◢'; el.appendChild(rs); }
    const hk=tlHOf(c,k).key;
    const html=`<b class="tl-h" title="اسحب من هنا لنقل البطاقة">⠿ ${TL_NAMES[k]||k}</b><button title="قبل (يمين/أعلى)" onclick="event.preventDefault();event.stopPropagation();tlMove('${k}',-1)">⬆️</button><button title="بعد (يسار/أسفل)" onclick="event.preventDefault();event.stopPropagation();tlMove('${k}',1)">⬇️</button>
      <span class="tl-w">${TL_W.map(([v,l])=>`<button class="${Number(c.w[k])===v?'on':''}" title="العرض" onclick="event.preventDefault();event.stopPropagation();tlWidth('${k}',${v})">${l}</button>`).join('')}</span>
      <span class="tl-w tl-hh">↕ ${TL_H.map(([v,l])=>`<button class="${hk===v?'on':''}" title="الطول" onclick="event.preventDefault();event.stopPropagation();tlHeight('${k}','${v}')">${l}</button>`).join('')}${hk==='px'?`<button class="on" title="طول مخصّص بالسحب">${parseInt(c.h[k])}px</button>`:''}</span>
      <button title="${c.hide[k]?'إظهار':'إخفاء'}" onclick="event.preventDefault();event.stopPropagation();tlHide('${k}')">${c.hide[k]?'👁 إظهار':'🙈 إخفاء'}</button>`;
    if(bar._h!==html){ bar.innerHTML=html; bar._h=html; }   // لا نعيد بناء المقبض أثناء السحب (يُلغي السحب)
  });
}
function tlEdit(on){ TL_ON=on===undefined?!TL_ON:!!on; const b=document.getElementById('tl-btn'); if(b) b.textContent=TL_ON?'✓ إنهاء الترتيب':'🧩 ترتيب';
  tlApply(); if(TL_ON) document.getElementById('td-board')?.scrollIntoView({block:'start',behavior:'smooth'}); }
function tlMove(k,d){ const c=tlGet(), i=c.order.indexOf(k), j=i+d; if(i<0||j<0||j>=c.order.length) return; [c.order[i],c.order[j]]=[c.order[j],c.order[i]]; tlSet(c); }
function tlWidth(k,v){ const c=tlGet(); c.w[k]=v; tlSet(c); }
function tlHeight(k,v){ const c=tlGet(); c.h[k]=v; tlSet(c); if(k==='recent'){ try{ renderDashboard(); }catch(e){} } }
function tlHide(k){ const c=tlGet(); if(c.hide[k]) delete c.hide[k]; else c.hide[k]=true; tlSet(c); }
async function tlReset(){ try{ localStorage.removeItem(TL_KEY); }catch(e){} tlApply(); toast('↩️ عاد الترتيب الافتراضي','good'); }
(function(){
  const B=document.getElementById('td-board'); if(!B) return; let drag=null;
  // في وضع الترتيب لا تُفتح/تُطوى البطاقات بالنقر على عناوينها
  B.addEventListener('click',e=>{ if(TL_ON&&e.target.closest('summary')&&!e.target.closest('.tl-bar')) e.preventDefault(); },true);
  // سحب بالمؤشر (فأرة أو إصبع): من مقبض ⠿ في شريط البطاقة إلى مكانها الجديد
  let tgt=null, after=false;
  const clear=()=>B.querySelectorAll('.tl-drag,.tl-over').forEach(x=>x.classList.remove('tl-drag','tl-over'));
  // ◢ تغيير الحجم بالسحب: أفقيًا بالأعمدة (يلتصق بها)، وعموديًا بالبكسل
  let rsz=null;
  B.addEventListener('pointerdown',e=>{ if(!TL_ON) return; const g=e.target.closest('.tl-rs'); if(!g) return; const el=g.closest('#td-board>.td-blk'); if(!el) return;
    e.preventDefault(); e.stopPropagation(); const cs=getComputedStyle(B), gap=parseFloat(cs.columnGap)||12, col=(B.clientWidth-11*gap)/12;
    const box=el.tagName==='DETAILS'?el.querySelector(':scope>:not(summary):not(.tl-rs)'):(el.querySelector(':scope>:not(.tl-bar):not(.tl-rs)')||el);
    rsz={el,k:el.dataset.blk,x:e.clientX,y:e.clientY,w0:el.getBoundingClientRect().width,h0:box?box.getBoundingClientRect().height:200,step:col+gap,gap,w:Number(el.dataset.w)||4,h:null};
    el.classList.add('tl-sizing'); B.classList.add('tl-sizing-on'); try{ g.setPointerCapture(e.pointerId); }catch(_){} },true);
  B.addEventListener('pointermove',e=>{ if(!rsz) return;
    const rtl=getComputedStyle(B).direction==='rtl', dx=rtl?rsz.x-e.clientX:e.clientX-rsz.x;
    const w=Math.max(2,Math.min(12,Math.round((rsz.w0+dx+rsz.gap)/rsz.step))); const h=Math.max(120,Math.min(1400,Math.round((rsz.h0+e.clientY-rsz.y)/10)*10));
    if(w!==rsz.w){ rsz.w=w; rsz.el.style.setProperty('--w',w); rsz.el.dataset.w=w; rsz.el.classList.toggle('tl-wide',w>=8); }
    if(Math.abs(e.clientY-rsz.y)>4){ rsz.h=h; rsz.el.style.setProperty('--h',h+'px'); rsz.el.dataset.h='px'; }
    rsz.el.dataset.sz=`${w}/12 · ${rsz.h?rsz.h+'px':'الطول كما هو'}`; },true);
  const rszEnd=()=>{ if(!rsz) return; const {k,w,h,el}=rsz; rsz=null; el.classList.remove('tl-sizing'); B.classList.remove('tl-sizing-on'); delete el.dataset.sz;
    const c=tlGet(); c.w[k]=w; if(h) c.h[k]=h; tlSet(c); if(k==='recent'&&h){ try{ renderDashboard(); }catch(e){} } };
  B.addEventListener('pointerup',rszEnd,true); B.addEventListener('pointercancel',rszEnd,true);
  B.addEventListener('pointerdown',e=>{ if(!TL_ON) return; const h=e.target.closest('.tl-h'); if(!h) return; const el=h.closest('#td-board>.td-blk'); if(!el) return;
    e.preventDefault(); drag=el.dataset.blk; tgt=null; el.classList.add('tl-drag'); try{ h.setPointerCapture(e.pointerId); }catch(_){} });
  B.addEventListener('pointermove',e=>{ if(!drag) return; const u=document.elementFromPoint(e.clientX,e.clientY), el=u&&u.closest('#td-board>.td-blk');
    B.querySelectorAll('.tl-over').forEach(x=>x.classList.remove('tl-over')); tgt=null;
    if(!el||el.dataset.blk===drag) return; const r=el.getBoundingClientRect();
    after=e.clientY>r.top+r.height*.66||(e.clientY>=r.top+r.height*.34&&e.clientX<r.left+r.width/2);   // RTL: أسفلها أو نصفها الأيسر = بعدها
    tgt=el.dataset.blk; el.classList.add('tl-over');
    if(e.clientY<60) window.scrollBy(0,-18); else if(e.clientY>innerHeight-60) window.scrollBy(0,18); });
  const end=()=>{ if(!drag) return; const k=drag, t=tgt; drag=null; tgt=null; clear(); if(!t) return;
    const c=tlGet(); c.order.splice(c.order.indexOf(k),1); const to=c.order.indexOf(t); c.order.splice(after?to+1:to,0,k); tlSet(c); };
  B.addEventListener('pointerup',end); B.addEventListener('pointercancel',()=>{ drag=null; tgt=null; clear(); });
  tlApply();
  // على الشاشة الواسعة تُفتح البطاقات التفصيلية تلقائيًا؛ على الجوال تبقى مطوية
  try{ if(window.matchMedia('(min-width:1000px)').matches) B.querySelectorAll(':scope>details.td-blk').forEach(d=>d.open=true); }catch(e){}
})();
