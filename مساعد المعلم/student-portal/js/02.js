/* ═══════════════════════════════════════════════════════════════
   🎨 تخصيص مظهري — مظهر شخصي لكل طالب (المظهر فقط)
   يُحفظ في الخادم مربوطًا بجلسة الطالب الموقّعة، ونسخة على الجهاز مفتاحها رقم الطالب.
   لا يغيّر أي محتوى أو ترتيب أو وظيفة؛ وطالب بلا تفضيلات يرى البوابة كما هي.
   ═══════════════════════════════════════════════════════════════ */
const PT={
  AV:['🧑‍🔬','🧪','🔭','🚀','🧠','🦉','🦁','🐬','🦊','🐼','🐢','🌍','⚡','🌟','🎨','⚽','🎮','🏆',
     // ✨ 18–29 رموز حصرية — تُفتح ببطاقة «رموز حصرية» من المتجر
     '🐉','🦄','👑','🧙','🦸','🥷','🧑‍🚀','🦅','🪐','🌋','💎','🐺'],
  AV_X:18,
  ACC:{navy:'كحلي',teal:'فيروزي',violet:'بنفسجي',rose:'وردي',orange:'برتقالي',emerald:'زمردي',sky:'سماوي',gold:'ذهبي'},
  TH:{classic:'كلاسيكي',aurora:'شفق',ocean:'محيط',meadow:'حديقة',sunset:'غروب',galaxy:'فضاء',lab:'دفتر المختبر',candy:'حلوى',saudi:'اليوم الوطني ٩٦',spaceweek:'أسبوع الفضاء',gold:'ذهبي ✨',diamond:'ماسي 💎'},
  CARDS:{soft:'ناعمة',glass:'زجاجية',outline:'محددة',bold:'بارزة'},
  BTN:{round:'مستديرة',pill:'كبسولة',sharp:'حادة',gradient:'متدرّجة'},
  FRAME:{none:'بلا إطار',gold:'ذهبي',fire:'ناري',rainbow:'قوس قزح'},
  NC:{rainbow:'قوس قزح',gold:'ذهبي',fire:'ناري',ocean:'محيطي',emerald:'زمردي',royal:'ملكي',off:'عادي (بلا لون)'},
  HEX:{navy:'#16233A',teal:'#0E8C8F',violet:'#6A47E8',rose:'#D63B72',orange:'#DD640C',emerald:'#11935A',sky:'#1976D2',gold:'#A97C08'}
};
const PT_LOCKED=['gold','diamond','saudi','spaceweek'];   // ✨ مظاهر حصرية: تُفتح بشرائها من المتجر
const PT_DEF={av:{t:'e',v:0},accent:'violet',theme:'aurora',cards:'glass',btn:'pill'};
let PT_CUR=null;
function ptKey(){return 'pt_prefs_'+(String(mySid||'')||'x')}
function ptClean(o){
  if(!o||typeof o!=='object')return null;
  const pick=(v,set,d)=>Object.prototype.hasOwnProperty.call(set,v)?v:d;
  let av={t:'e',v:0};
  if(o.av&&o.av.t==='i'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(String(o.av.v||''))&&String(o.av.v).length<=70000)av={t:'i',v:String(o.av.v)};
  else if(o.av&&o.av.t==='e'){const n=parseInt(o.av.v,10);if(n>=0&&n<PT.AV.length)av={t:'e',v:n}}
  return {av,accent:pick(o.accent,PT.ACC,'navy'),theme:pick(o.theme,PT.TH,'classic'),cards:pick(o.cards,PT.CARDS,'soft'),btn:pick(o.btn,PT.BTN,'round'),frame:pick(o.frame,PT.FRAME,'none'),nc:pick(o.nc,PT.NC,'rainbow')};
}
function ptAvatarHTML(av){
  if(av&&av.t==='i'&&av.v)return `<img src="${av.v}" alt="صورتي">`;
  return (av&&PT.AV[av.v])||'🎓';
}
/* 🌈 الاسم الملوّن: لمن اشترى البطاقة، باللون الذي اختاره (أو بلا لون إن اختار «عادي») */
function nmStyle(){ const own=typeof MYPERKS!=='undefined'&&MYPERKS&&MYPERKS.namecolor>0; const nc=(PT_CUR&&PT_CUR.nc)||'rainbow'; return own&&nc!=='off'?nc:''; }
function nmApply(){ const v=nmStyle(), r=document.documentElement; if(v) r.setAttribute('data-nm-glow',v); else r.removeAttribute('data-nm-glow');
  const n=document.querySelector('#space-greeting .sg-nm'); if(n) n.className='sg-nm '+nmCls(v); }
/* صنف الاسم في الصدارة والمسابقات (الخادم يعيد اسم اللون، والقديم يعيد true = قوس قزح) */
function nmCls(g){ return g ? 'nm-glow'+(typeof g==='string'&&g!=='rainbow'?' nm-'+g:'') : ''; }
function ptApply(p){
  const r=document.documentElement;PT_CUR=p||null; try{ nmApply(); }catch(e){}
  // ⚡ آخر مظهر يُحفظ على الجهاز ليُطبَّق في أول لحظة عند الفتح التالي (قبل تحميل البرمجة والاتصال بالخادم)
  try{ if(p) localStorage.setItem('pt_last',JSON.stringify({a:p.accent,t:p.theme,c:p.cards,b:p.btn,f:p.frame||'none'})); else localStorage.removeItem('pt_last'); }catch(e){}
  const meta=document.querySelector('meta[name="theme-color"]');
  if(!p){['pt','ptAccent','ptTheme','ptCards','ptBtn','ptFrame'].forEach(k=>delete r.dataset[k]);
    const a=document.querySelector('.student-space-head .avatar');if(a)a.textContent='🎓';if(meta)meta.content='#16233A';return}
  r.dataset.pt='1';r.dataset.ptAccent=p.accent;r.dataset.ptTheme=p.theme;r.dataset.ptCards=p.cards;r.dataset.ptBtn=p.btn;r.dataset.ptFrame=p.frame||'none';
  const a=document.querySelector('.student-space-head .avatar');if(a)a.innerHTML=ptAvatarHTML(p.av);
  if(meta)meta.content=p.theme==='galaxy'?'#0D1331':p.theme==='spaceweek'?'#0A1638':p.theme==='saudi'?'#00653A':p.theme==='gold'?'#7A5A00':p.theme==='diamond'?'#1E3A6E':(PT.HEX[p.accent]||'#16233A');
}
function ptApi(){return ((typeof HW!=='undefined'&&HW&&HW.api)||API||'').replace(/\/+$/,'')}
function ptLocal(){try{return ptClean(JSON.parse(localStorage.getItem(ptKey())||'null'))}catch(e){return null}}
function ptStoreLocal(p){try{if(p)localStorage.setItem(ptKey(),JSON.stringify(p));else localStorage.removeItem(ptKey())}catch(e){}}
/* عند دخول الطالب: نطبّق نسخة الجهاز فورًا، ثم نتحقق من نسخة الخادم */
async function ptOnLogin(){
  const sid=String(mySid||'');
  ptApply(sid?ptLocal():null);
  if(!sid)return;
  const tok=getStoreSession();if(!tok)return;
  try{
    const r=await fetch(ptApi()+'/prefs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:tok,op:'get'})});
    const j=await r.json();
    if(!j||!j.ok||String(mySid||'')!==sid)return;
    const p=ptClean(j.prefs);ptStoreLocal(p);ptApply(p);
  }catch(e){}
}
function ptReset(){ptApply(null)}

/* ── لوحة «إعداداتي» ── */
function ptOpen(){
  if(document.getElementById('pt-ov'))return;
  let d=JSON.parse(JSON.stringify(PT_CUR||PT_DEF)); if(!d.frame) d.frame='none'; if(!d.nc) d.nc='rainbow';
  const ncOwn=MYPERKS.namecolor>0;
  const nm=String(myName||lockedName()||'').trim().split(/\s+/)[0]||'';
  const ov=document.createElement('div');ov.className='pt-overlay';ov.id='pt-ov';
  ov.innerHTML=`<div class="pt-panel" role="dialog" aria-modal="true" aria-labelledby="pt-title" tabindex="-1">
    <div class="pt-top"><h2 id="pt-title">⚙️ إعداداتي<small>تخصيص مظهري: غيّر الشكل كما تحب، ويبقى المحتوى كما هو.</small></h2><button class="pt-x" id="pt-x" aria-label="إغلاق">✕</button></div>
    <div class="pt-body">
      <div class="pt-pv-wrap"><h3>👀 معاينة مباشرة</h3>
        <div class="pt-preview" id="pt-pv">
          <div class="pv-head"><div class="pt-av" id="pv-av"></div><div style="min-width:0"><b>أهلاً <span id="pv-nm">${esc(nm)}</span> 👋</b><span>هكذا ستبدو بوابتك</span></div></div>
          <div class="pv-card"><b>🎯 مهمتك الآن</b><p>تجربة قوة الاحتكاك في المختبر الافتراضي</p><button class="pv-btn" type="button">🚀 ابدأ الآن</button></div>
          <div class="pv-card"><div class="pv-row"><b>📚 إنجازي</b><span class="pv-chip">٦٢٪</span></div><span class="pv-bar"><i></i></span></div>
        </div></div>
      <div style="display:grid;gap:1rem;min-width:0">
        <section class="pt-sec"><h3>🧑‍🎓 صورتي الرمزية</h3><p class="pt-hint">اختر رمزًا أو ارفع صورة. الصورة تظهر لك فقط.</p>
          <div class="pt-grid pt-av-grid" id="pt-avs">${PT.AV.slice(0,PT.AV_X).map((e,i)=>`<button type="button" class="pt-av-opt" data-av="${i}" aria-label="رمز ${i+1}">${e}</button>`).join('')}</div>
          <div class="pt-avx-h">✨ رموز حصرية ${MYPERKS.avatars>0?'<small>لك دائمًا</small>':'<small>🔒 تُفتح ببطاقة «رموز حصرية» من المتجر</small>'}</div>
          <div class="pt-grid pt-av-grid">${PT.AV.slice(PT.AV_X).map((e,j)=>{ const i=PT.AV_X+j, lock=!(MYPERKS.avatars>0);
            return `<button type="button" class="pt-av-opt pt-av-x${lock?' pt-lock':''}" ${lock?'data-lockav="1"':`data-av="${i}"`} aria-label="رمز حصري ${j+1}">${e}</button>`; }).join('')}</div>
          <div class="pt-up"><label>📷 رفع صورة<input type="file" id="pt-file" accept="image/*" hidden></label><span id="pt-upnote" class="muted" style="font-size:.76rem;align-self:center"></span></div></section>
        <section class="pt-sec"><h3>🖼️ إطار الصورة</h3><p class="pt-hint">${MYPERKS.frame>0?'إطار متحرك حول صورتك الرمزية.':'🔒 يُفتح ببطاقة «إطار الصورة» من المتجر.'}</p>
          <div class="pt-grid pt-fr-grid">${Object.entries(PT.FRAME).map(([k,t])=>{ const lock=k!=='none'&&!(MYPERKS.frame>0); return `<button type="button" class="pt-fr${lock?' pt-lock':''}" data-v="${k}" ${lock?'data-lockf="1"':'data-g="frame"'}><span class="pt-av pt-fr-demo" data-fr="${k}">🙂</span>${t}${lock?'<small>🔒</small>':''}</button>`; }).join('')}</div></section>
        <section class="pt-sec"><h3>🌈 لون اسمك</h3><p class="pt-hint">${ncOwn?'يظهر اسمك بهذا اللون في الصدارة ونتائج المسابقات وترحيب صفحتك. اختر «عادي» لإيقافه.':'🔒 يُفتح ببطاقة «اسم ملوّن» من المتجر.'}</p>
          <div class="pt-grid pt-nc-grid">${Object.entries(PT.NC).map(([k,t])=>{ const lock=!ncOwn&&k!=='off'; return `<button type="button" class="pt-nc${lock?' pt-lock':''}" data-v="${k}" ${lock?'data-locknc="1"':'data-g="nc"'}><b class="${k==='off'?'':nmCls(k)}">${esc(nm||'اسمك')}</b><small>${t}${lock?' 🔒':''}</small></button>`; }).join('')}</div></section>
        <section class="pt-sec"><h3>🎨 اللون الأساسي</h3><p class="pt-hint">لون الأزرار والترويسة وشريط التقدم.</p>
          <div class="pt-grid pt-sw-grid">${Object.entries(PT.ACC).map(([k,t])=>`<button type="button" class="pt-sw" data-v="${k}" data-g="accent"><i></i>${t}</button>`).join('')}</div></section>
        <section class="pt-sec"><h3>🖼️ الثيم والخلفية</h3><p class="pt-hint">خلفية بوابتك كلها.</p>
          <div class="pt-grid pt-th-grid">${Object.entries(PT.TH).map(([k,t])=>{ const lock=PT_LOCKED.includes(k)&&!(MYPERKS['theme_'+k]>0); return `<button type="button" class="pt-th${lock?' pt-lock':''}" data-v="${k}" ${lock?'data-lock="1"':'data-g="theme"'}><span class="pt-th-bg"></span>${t}${lock?'<small>🔒 من المتجر</small>':''}</button>`; }).join('')}</div></section>
        <section class="pt-sec"><h3>🃏 نمط البطاقات</h3>
          <div class="pt-grid pt-st-grid">${Object.entries(PT.CARDS).map(([k,t])=>`<button type="button" class="pt-st" data-v="${k}" data-g="cards"><span class="demo-card" style="${{soft:'border-radius:9px;box-shadow:0 3px 8px rgba(0,0,0,.12)',glass:'border-radius:9px;background:rgba(255,255,255,.6);border:1px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.1)',outline:'border-radius:9px;border:2px solid var(--acc-soft)',bold:'border-radius:12px;border-top:4px solid var(--acc);box-shadow:0 5px 12px rgba(0,0,0,.16)'}[k]}"></span>${t}</button>`).join('')}</div></section>
        <section class="pt-sec"><h3>🔘 نمط الأزرار</h3>
          <div class="pt-grid pt-st-grid">${Object.entries(PT.BTN).map(([k,t])=>`<button type="button" class="pt-st" data-v="${k}" data-g="btn"><span class="demo-btn" style="${{round:'border-radius:7px',pill:'border-radius:99px',sharp:'border-radius:2px',gradient:'border-radius:8px;background:linear-gradient(135deg,var(--acc),var(--acc-2));box-shadow:0 3px 8px var(--acc-soft)'}[k]}"></span>${t}</button>`).join('')}</div></section>
      </div>
    </div>
    <div class="pt-actions"><button class="btn tick" id="pt-save" type="button">💾 حفظ مظهري</button><button class="btn ghost" id="pt-cancel" type="button">إلغاء</button><button class="btn pt-reset" id="pt-def" type="button">↺ المظهر الافتراضي</button></div>
  </div>`;
  document.body.appendChild(ov);
  const prevOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const panel=ov.querySelector('.pt-panel');
  const sync=()=>{
    const pv=document.getElementById('pt-pv');
    Object.assign(pv.dataset,{ptAccent:d.accent,ptTheme:d.theme,ptCards:d.cards,ptBtn:d.btn,ptFrame:d.frame||'none'});
    panel.dataset.ptAccent=d.accent;
    document.getElementById('pv-av').innerHTML=ptAvatarHTML(d.av);
    { const nb=document.getElementById('pv-nm'); if(nb) nb.className=ncOwn&&d.nc!=='off'?nmCls(d.nc):''; }
    ov.querySelectorAll('[data-g]').forEach(b=>b.setAttribute('aria-pressed',String(d[b.dataset.g]===b.dataset.v)));
    ov.querySelectorAll('[data-av]').forEach(b=>b.setAttribute('aria-pressed',String(d.av.t==='e'&&String(d.av.v)===b.dataset.av)));
  };
  ov.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{d[b.dataset.g]=b.dataset.v;sync()});
  ov.querySelectorAll('[data-lock]').forEach(b=>b.onclick=()=>toast('✨ مظهر حصري — اشترِه من «متجر النشاطات» ثم اختره هنا'));
  ov.querySelectorAll('[data-lockf]').forEach(b=>b.onclick=()=>toast('🖼️ الإطارات تُفتح ببطاقة «إطار الصورة» من «متجر النشاطات»'));
  ov.querySelectorAll('[data-locknc]').forEach(b=>b.onclick=()=>toast('🌈 ألوان الاسم تُفتح ببطاقة «اسم ملوّن» من «متجر النشاطات»'));
  ov.querySelectorAll('[data-lockav]').forEach(b=>b.onclick=()=>toast('✨ رمز حصري — اشترِ بطاقة «رموز حصرية» من «متجر النشاطات»'));
  ov.querySelectorAll('[data-av]').forEach(b=>b.onclick=()=>{d.av={t:'e',v:+b.dataset.av};document.getElementById('pt-upnote').textContent='';sync()});
  document.getElementById('pt-file').onchange=e=>{
    const f=e.target.files&&e.target.files[0];if(!f)return;const note=document.getElementById('pt-upnote');
    if(!/^image\//.test(f.type)){note.textContent='اختر ملف صورة.';return}
    note.textContent='جارٍ تجهيز الصورة…';
    const img=new Image(),url=URL.createObjectURL(f);
    img.onload=()=>{
      const out=(size,q)=>{const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');
        const s=Math.min(img.width,img.height);x.fillStyle='#fff';x.fillRect(0,0,size,size);
        x.drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,size,size);return c.toDataURL('image/jpeg',q)};
      let v=out(160,.82);if(v.length>60000)v=out(128,.7);if(v.length>60000)v=out(96,.6);
      URL.revokeObjectURL(url);d.av={t:'i',v};note.textContent='✓ تم اختيار صورتك';sync();
    };
    img.onerror=()=>{note.textContent='تعذّر قراءة الصورة.';URL.revokeObjectURL(url)};
    img.src=url;
  };
  const close=()=>{ov.classList.remove('on');document.body.style.overflow=prevOverflow;document.removeEventListener('keydown',onKey);setTimeout(()=>ov.remove(),260)};
  const onKey=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',onKey);
  document.getElementById('pt-x').onclick=close;document.getElementById('pt-cancel').onclick=close;
  ov.addEventListener('click',e=>{if(e.target===ov)close()});
  const save=async p=>{
    panel.classList.add('pt-saving');
    try{
      const r=await storeFetch(ptApi()+'/prefs',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({op:'set',prefs:p,name:String(myName||lockedName()||'').trim(),sid:mySid||''})});
      const j=await r.json();
      if(!j.ok){panel.classList.remove('pt-saving');if(j.error!=='auth_cancel')toast('تعذّر حفظ المظهر، حاول مرة أخرى','bad');return}
      const c=ptClean(j.prefs);ptStoreLocal(c);ptApply(c);close();
      toast(c?'تم حفظ مظهرك ✓':'رجعت بوابتك إلى المظهر الافتراضي');
    }catch(e){panel.classList.remove('pt-saving');toast('تعذّر الاتصال بالخادم','bad')}
  };
  document.getElementById('pt-save').onclick=()=>save(d);
  document.getElementById('pt-def').onclick=()=>save(null);
  sync();requestAnimationFrame(()=>{ov.classList.add('on');panel.focus()});
}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#pt-open');if(b){e.preventDefault();ptOpen()}});

