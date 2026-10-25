/* ═══ 📥 طابور الرسائل: مركز إرسال واحد ═══
   يُجهَّز بالصوت في بوابة المعلم ويُزامَن عبر /classroom،
   ويُرسل من هنا بالمسار نفسه الذي ترسل به أي رسالة (/messages).
   الإزالة توسم x:1 ولا تحذف، وإلا أعادها اتحاد الخادم. */
let MSGQ_DASH = [];
let MSGQ_ERR = false;
const MSGQ_TITLES = { cert:'🏅 شهادة تقدير', participation:'شكرًا لمشاركتك',
               achievement:'إنجاز متميز', improvement:'تحسّن ملحوظ',
               cooperation:'تعاون والتزام', behavior:'ملاحظة سلوكية',
               support:'يحتاج متابعة', skill:'تعزيز مهارة', late:'ملاحظة تأخر' };
async function msgqLoad(){
  const api=getApi(), tok=getTok(), box=document.getElementById('msgq-sheet');
  if(!api||!tok||!box) return;
  try{
    const r=await fetch(api.replace(/\/+$/,'')+'/classroom?t='+encodeURIComponent(tok));
    const j=await r.json();
    MSGQ_DASH = (j&&j.ok&&j.data&&Array.isArray(j.data.msgq)) ? j.data.msgq.filter(m=>m&&!m.x) : [];
    MSGQ_ERR = !(j&&j.ok);
  }catch(e){ MSGQ_DASH = []; MSGQ_ERR = true; }
  box.style.display = (MSGQ_DASH.length || MSGQ_ERR) ? '' : 'none';
  msgqRender();
}
function msgqRender(){
  const L=document.getElementById('msgq-list'); if(!L) return;
  if(!MSGQ_DASH.length){
    L.innerHTML = MSGQ_ERR
      ? '<div class="sub">تعذّر تحميل الطابور — تحقق من الاتصال ثم <button class="btn sm" id="msgq-refresh">إعادة المحاولة</button></div>'
      : '<div class="sub">لا رسائل في الطابور.</div>';
    return;
  }
  L.innerHTML = MSGQ_DASH.map((m,i)=>`
    <div class="msgq-row">
      <div class="msgq-main"><b>${esc(m.name||'(بلا اسم)')}</b>
        <span class="sub">${MSGQ_TITLES[m.k]||'رسالة'}${(()=>{const d=m.at?new Date(m.at):null;return (d&&!isNaN(d))?' · '+d.toLocaleDateString('ar-SA-u-ca-gregory',{day:'numeric',month:'short'}):''})()}</span>
        <span class="sub">${esc(m.text||'').slice(0,150)}</span></div>
      <div class="msgq-acts">
        <button class="btn" data-mqcopy="${i}">📋 نسخ</button>
        <button class="btn" data-mqsend="${i}">📨 إرسال</button>
        <button class="btn" data-mqdel="${i}">إزالة</button>
      </div>
    </div>`).join('') +
    `<div class="msgq-foot">
       <button class="btn" id="msgq-copy-all">📋 نسخ الكل (${MSGQ_DASH.length})</button>
       <button class="btn tick" id="msgq-send-all">📨 إرسال الكل (${MSGQ_DASH.length})</button>
     </div>`;
  L.querySelectorAll('[data-mqsend]').forEach(b=>b.onclick=()=>msgqSend([+b.dataset.mqsend]));
  L.querySelectorAll('[data-mqdel]').forEach(b=>b.onclick=()=>msgqDrop([+b.dataset.mqdel]));
  L.querySelectorAll('[data-mqcopy]').forEach(b=>b.onclick=()=>msgqCopy([+b.dataset.mqcopy]));
  const all=document.getElementById('msgq-send-all');
  if(all) all.onclick=async()=>{ if(await askConfirm(`إرسال كل رسائل الطابور (${MSGQ_DASH.length})؟`,{title:'إرسال الكل'})) msgqSend(MSGQ_DASH.map((_,i)=>i)); };
  const cpa=document.getElementById('msgq-copy-all');
  if(cpa) cpa.onclick=()=>msgqCopy(MSGQ_DASH.map((_,i)=>i));
}
/* 📋 النسخ للواتساب: لا يُزيل من الطابور — قد تنسخ لوليّ الأمر
   ثم ترسلها للطالب أيضًا. الإزالة قرارك وحدك. */
function msgqCopy(idx){
  const st=document.getElementById('msgq-status');
  const parts=idx.map(i=>MSGQ_DASH[i]).filter(Boolean)
    .map(m=>`${m.name||''}\n${m.text||''}`);
  if(!parts.length) return;
  const txt=parts.join('\n\n———\n\n');
  const done=()=>{ if(st) st.textContent=`نُسخت ${parts.length} رسالة — تبقى في الطابور حتى تُزيلها.`; };
  try{
    navigator.clipboard.writeText(txt).then(done).catch(()=>{
      const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta);
      ta.select(); try{document.execCommand('copy');}catch(e){} ta.remove(); done();
    });
  }catch(e){
    const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta);
    ta.select(); try{document.execCommand('copy');}catch(e2){} ta.remove(); done();
  }
}
async function msgqSend(idx){
  const api=getApi(), tok=getTok(), st=document.getElementById('msgq-status');
  if(!api||!tok){ if(st) st.textContent='تحقق من إعدادات الاتصال.'; return; }
  let ok=0, fail=0; const sent=[]; const failedNames=[];
  const L=document.getElementById('msgq-list');
  if(L) L.querySelectorAll('[data-mqsend],#msgq-send-all').forEach(b=>b.disabled=true);
  for(const i of idx){
    const m=MSGQ_DASH[i]; if(!m) continue;
    // العنوان يتبع النوع: «رسالة من المعلم» على شهادة تقدير عنوان مضلِّل
    // نوع مستقل للشهادة: بوابة الطالب ترسمها بطاقةً قابلة للطباعة
    // بدل التقاطها من نص العنوان — التخمين من النص يكسر بأول تعديل.
    const b={ t:tok, audience:'students', title:(m.title||MSGQ_TITLES[m.k]||'رسالة من المعلم'),
              body:m.text||'', type:(m.k==='cert'?'cert':'note'), priority:'normal',
              recipients:[{id:m.id,name:m.name}] };
    try{
      const r=await fetch(api.replace(/\/+$/,'')+'/messages',{method:'POST',
        headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
      const j=await r.json().catch(()=>({}));
      if(r.ok&&j.ok){ ok++; sent.push(i); } else { fail++; failedNames.push(m.name||'(بلا اسم)'); }
    }catch(e){ fail++; failedNames.push(m.name||'(بلا اسم)'); }
  }
  let dropOk=true;
  if(sent.length) dropOk=await msgqDrop(sent, true);
  if(st) st.textContent = `أُرسلت ${ok}` + (fail?` · تعذّرت ${fail}: ${failedNames.slice(0,5).join('، ')}${fail>5?` و${fail-5} آخرون`:''}`:'') + ((sent.length&&!dropOk)?' · تعذّرت إزالتها من الطابور — ستظل ظاهرة حتى تُزال يدويًا':'');
  await msgqLoad();
}
async function msgqDrop(idx, quiet){
  const api=getApi(), tok=getTok();
  // عدد النسخ المطلوب إسقاطها من كل مفتاح (م5): المفتاح وحده لا يميّز رسالتين متطابقتين
  // لنفس الطالب، فإسقاط «كل مطابق» كان يحذف الثانية دون إرسالها
  const need=new Map();
  idx.map(i=>MSGQ_DASH[i]).filter(Boolean).forEach(m=>{
    const k=m.id+'|'+m.k+'|'+(m.text||'');
    need.set(k,(need.get(k)||0)+1);
  });
  if(!need.size) return true;
  const failNote=()=>{ const st=document.getElementById('msgq-status'); if(st) st.textContent='تعذّرت إزالة الرسالة — تحقق من الاتصال وحاول مجددًا.'; };
  if(!quiet && !(await askConfirm(idx.length>1?`إزالة ${idx.length} رسائل من الطابور؟`:'إزالة هذه الرسالة من الطابور؟',{title:'إزالة من الطابور'}))) return false;
  try{
    const r=await fetch(api.replace(/\/+$/,'')+'/classroom?t='+encodeURIComponent(tok));
    const j=await r.json();
    if(!j.ok||!j.data){ if(!quiet) failNote(); return false; }
    const d=j.data;
    d.msgq = (Array.isArray(d.msgq)?d.msgq:[]).map(m =>{
      const k=m.id+'|'+m.k+'|'+(m.text||'');
      if((need.get(k)||0)>0){ need.set(k,need.get(k)-1); return Object.assign({},m,{x:1,at:Date.now()}); }
      return m;
    });
    const pr=await fetch(api.replace(/\/+$/,'')+'/classroom',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({t:tok,data:d,clientAt:Date.now()})});
    if(!pr.ok){ if(!quiet) failNote(); return false; }
  }catch(e){ if(!quiet) failNote(); return false; }
  if(!quiet) await msgqLoad();
  return true;
}
document.addEventListener('click',e=>{
  const b=e.target.closest('#msgq-refresh'); if(b){ e.preventDefault(); msgqLoad(); }
});
