/* 🧱 حوائط الإبداع — إدارة المعلم (تبويب «رسائل الطلاب»): إنشاء/تعديل/حذف، وفتح الحائط بأدوات الاعتماد والعرض */
const WALL_ENV={ teacher:true,
  api:()=>getApi().replace(/\/+$/,''),
  who:()=>'&t='+encodeURIComponent(getTok()),
  post:async(path,body)=>{ const r=await fetch(WALL_ENV.api()+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,t:getTok()})}); return r.json().catch(()=>({})); },
  compress:null,
  toast:(m,k)=>toast(m,k) };
let WALL_ADMIN=[];
/* 🧱 منشورات تنتظر الاعتماد ⇒ سطر في «مهام اليوم» (لا يعتمد المعلم على إشعار الجوال وحده) */
let TD_WALLS=null;
async function tdWallsLoad(){
  if(!getApi()||!getTok()) return;
  try{ const r=await fetch(WALL_ENV.api()+'/walls?t='+encodeURIComponent(getTok())+'&_='+Date.now(),{cache:'no-store'}); const j=await r.json();
    if(j&&j.ok){ TD_WALLS=(j.rows||[]).filter(w=>w.pending>0).map(w=>({id:w.id,title:w.title,emoji:w.emoji,pending:w.pending})); if(typeof thDraw==='function') thDraw(); } }catch(e){}
}
async function wallAdminLoad(){
  const box=document.getElementById('wall-admin-list'); if(!box||!getApi()||!getTok()) return;
  let j=null; try{ const r=await fetch(WALL_ENV.api()+'/walls?t='+encodeURIComponent(getTok())+'&_='+Date.now(),{cache:'no-store'}); j=await r.json(); }catch(e){}
  if(!j||!j.ok){ box.innerHTML=`<div class="muted">${j&&j.error==='no_db'?'الحوائط تحتاج قاعدة D1 مربوطة بالخادم باسم DB':'تعذّر جلب الحوائط — تحقق من الاتصال'}</div>`; return; }
  WALL_ADMIN=j.rows||[]; voteLinkRow();
  TD_WALLS=WALL_ADMIN.filter(w=>w.pending>0).map(w=>({id:w.id,title:w.title,emoji:w.emoji,pending:w.pending})); if(typeof thDraw==='function') try{ thDraw(); }catch(e){}
  box.innerHTML=WALL_ADMIN.length?`<div class="walls-list">${WALL_ADMIN.map(w=>{ const c=WALL_COLORS[w.color]||WALL_COLORS.sky;
    return `<div class="wall-tile${w.color==='night'?' dark':''}" style="--wbg:${c[0]};--wac:${c[1]};cursor:default">
      ${w.pending?`<span class="new">${w.pending} ينتظر</span>`:''}<span class="e">${esc(w.emoji)}</span><b>${esc(w.title)}</b>
      <small>${w.count} منشور · ${w.draft?'مسودة':w.open?'النشر مفتوح':'🔒 مغلق'} · ${(w.classes||[]).length?esc(w.classes.join('، ')):'كل الفصول'}</small>
      <div class="row" style="gap:.3rem;margin-top:.4rem;flex-wrap:wrap"><button class="btn tick sm" type="button" onclick="wallOpen('${esc(w.id)}')">فتح</button>
        <button class="btn ghost sm" type="button" onclick="wallEdit('${esc(w.id)}')">تعديل</button>
        <button class="btn ghost sm" type="button" onclick="wallToggleOpen('${esc(w.id)}')">${w.open?'🔒 إغلاق النشر':'🔓 فتح النشر'}</button>
        <button class="btn ghost sm" type="button" onclick="wallPubOpen('${esc(w.id)}')">${w.pub?'🌐 الرابط العام ✓':'🌐 رابط للعامة'}</button>
        <button class="btn ghost sm" type="button" onclick="wallRemove('${esc(w.id)}')">حذف</button></div></div>`; }).join('')}</div>`
    :'<div class="feature-empty">لا حوائط بعد — أنشئ حائطًا لمناسبة أو تجربة ويشارك فيه طلابك 🌿</div>';
}
/* 🌐 رابط للعامة: صفحة عرض فقط للأعمال المعتمدة (لأولياء الأمور وحساب المدرسة…) — بلا نشر ولا إعجاب، والأسماء حسب اختيارك */
async function wallPubOpen(id){
  if(!WALL_ADMIN.find(x=>x.id===id)) await wallAdminLoad();
  const w=WALL_ADMIN.find(x=>x.id===id); if(!w) return toast('تعذّر جلب الحائط','bad');
  const url=w.pub?WALL_ENV.api()+'/w/'+w.pub:'', nm=w.pubNames||'first';
  const box=wallSheet(`<h3>🌐 رابط الحائط للعامة — ${esc(w.title)}</h3>
    <div class="muted">من يفتح الرابط يرى الأعمال <b>المعتمدة فقط</b> — بلا تسجيل دخول، ولا يستطيع النشر أو الإعجاب. يصلح لأولياء الأمور وحساب المدرسة.</div>
    <label>أسماء الطلاب في الصفحة العامة<select id="wp-names">
      <option value="first" ${nm==='first'?'selected':''}>الاسم الأول فقط (مستحسن)</option>
      <option value="none" ${nm==='none'?'selected':''}>بلا أسماء</option>
      <option value="full" ${nm==='full'?'selected':''}>الاسم كاملًا</option></select></label>
    ${url?`<input type="text" id="wp-url" dir="ltr" readonly value="${esc(url)}" onclick="this.select()">
      <div class="wcp-acts" style="justify-content:flex-start;flex-wrap:wrap">
        <button type="button" class="wall-btn main" id="wp-copy">📋 نسخ الرابط</button>
        <a class="wall-btn" href="${esc(url)}" target="_blank" rel="noopener">👁️ معاينة</a>
        <a class="wall-btn" href="https://wa.me/?text=${encodeURIComponent((w.emoji||'🧱')+' '+w.title+'\n'+url)}" target="_blank" rel="noopener">واتساب</a></div>
      <div class="wcp-acts" style="justify-content:space-between"><button type="button" class="wall-btn" id="wp-off">⛔ إيقاف الرابط</button><button type="button" class="wall-btn" id="wp-renew" title="الرابط القديم يتوقف">🔄 رابط جديد</button></div>`
    :`<div class="wcp-acts"><button type="button" class="wall-btn" onclick="document.getElementById('wall-comp').remove()">إلغاء</button><button type="button" class="wall-btn main" id="wp-on">🌐 أنشئ الرابط</button></div>`}`);
  const go=async(body,msg)=>{ const j=await WALL_ENV.post('/wall-pub',{wall:id,names:box.querySelector('#wp-names').value,...body}).catch(()=>null);
    if(!j||!j.ok) return toast((j&&j.error)||'تعذّر — ارفع worker.js الأخير','bad');
    w.pub=j.pub||undefined; w.pubNames=j.names; if(msg) toast(msg,'good'); wallAdminLoad(); if(j.pub) wallPubOpen(id); else box.remove(); };
  box.querySelector('#wp-on')?.addEventListener('click',()=>go({on:true},'✅ أُنشئ الرابط العام'));
  box.querySelector('#wp-off')?.addEventListener('click',()=>{ if(confirm('إيقاف الرابط؟ من معه الرابط لن يرى الحائط.')) go({on:false},'⛔ أُوقف الرابط العام'); });
  box.querySelector('#wp-renew')?.addEventListener('click',()=>{ if(confirm('رابط جديد؟ الرابط القديم يتوقف عن العمل.')) go({on:true,renew:true},'🔄 رابط جديد جاهز'); });
  box.querySelector('#wp-names').addEventListener('change',()=>{ if(w.pub) go({on:true},'✓ حُفظ اختيار الأسماء'); });
  box.querySelector('#wp-copy')?.addEventListener('click',async()=>{ try{ await navigator.clipboard.writeText(url); toast('📋 نُسخ الرابط','good'); }catch(e){ const i=box.querySelector('#wp-url'); i.select(); document.execCommand('copy'); toast('📋 نُسخ الرابط','good'); } });
}
function wallClassesAll(){ return [...new Set((Array.isArray(STUDENTS)?STUDENTS:[]).map(s=>String(s.cls||'').trim()).filter(Boolean))].sort(); }
function wallEdit(id){
  const w=WALL_ADMIN.find(x=>x.id===id)||{title:'',desc:'',emoji:'🧱',color:'sky',classes:[],approval:true,open:true,likes:true,maxPosts:3};
  const cls=wallClassesAll();
  openModal(`<h2>${id?'تعديل الحائط':'🧱 حائط جديد'}</h2>
    <div class="field"><label>العنوان</label><input class="inp" id="wl-title" maxlength="120" value="${esc(w.title)}" placeholder="مثال: أسبوع الفضاء 🚀"></div>
    <div class="field"><label>الوصف أو المطلوب (اختياري)</label><textarea class="inp" id="wl-desc" rows="2" maxlength="600" placeholder="مثال: صمّم صاروخًا من مواد بسيطة وصوّره، واكتب كيف يعمل">${esc(w.desc||'')}</textarea></div>
    <div class="field"><label>الرمز</label><div class="row" style="gap:.3rem;flex-wrap:wrap" id="wl-emo">${WALL_EMOJIS.map(e=>`<button type="button" class="btn ${e===w.emoji?'tick':'ghost'} sm" data-e="${e}" onclick="document.querySelectorAll('#wl-emo button').forEach(b=>b.className='btn ghost sm');this.className='btn tick sm'">${e}</button>`).join('')}</div></div>
    <div class="field"><label>اللون</label><div class="row" style="gap:.35rem;flex-wrap:wrap" id="wl-col">${Object.entries(WALL_COLORS).map(([k,c])=>`<button type="button" data-c="${k}" title="${k}" style="width:34px;height:34px;border-radius:50%;background:${c[0]};border:3px solid ${k===w.color?c[1]:'#cbd5e1'};cursor:pointer" onclick="document.querySelectorAll('#wl-col button').forEach(b=>b.style.borderColor='#cbd5e1');this.style.borderColor='${c[1]}';this.dataset.on=1;document.querySelectorAll('#wl-col button').forEach(b=>{ if(b!==this) delete b.dataset.on; })" ${k===w.color?'data-on="1"':''}></button>`).join('')}</div></div>
    <div class="field"><label>لمن؟ <small class="muted">(بلا اختيار = كل الفصول)</small></label><div class="row" style="gap:.4rem;flex-wrap:wrap">${cls.map(c=>`<label class="chip" style="cursor:pointer"><input type="checkbox" class="wl-cls" value="${esc(c)}" ${(w.classes||[]).includes(c)?'checked':''}> ${esc(c)}</label>`).join('')||'<span class="muted">لا فصول في الكشف</span>'}</div></div>
    <div class="field" style="display:flex;flex-direction:column;gap:.35rem">
      <label><input type="checkbox" id="wl-appr" ${w.approval!==false?'checked':''}> 🛡️ المنشور يظهر للطلاب بعد اعتمادي</label>
      <label><input type="checkbox" id="wl-open" ${w.open!==false?'checked':''}> 🔓 النشر مفتوح</label>
      <label><input type="checkbox" id="wl-likes" ${w.likes!==false?'checked':''}> ❤️ الإعجابات</label>
      <label>عدد المنشورات لكل طالب <input type="number" class="inp" id="wl-max" min="1" max="20" value="${w.maxPosts||3}" style="width:80px;display:inline-block"></label>
      ${id?'':'<label><input type="checkbox" id="wl-notify" checked> 🔔 أرسل إشعارًا للطلاب</label>'}
    </div>
    <div class="modal-foot"><button class="btn ghost" type="button" onclick="closeModal()">إلغاء</button><button class="btn tick" type="button" id="wl-save" onclick="wallSave('${esc(id||'')}')">${id?'حفظ':'إنشاء الحائط'}</button></div>`);
}
async function wallSave(id){
  const v=x=>document.getElementById(x);
  const wall={ id:id||undefined, title:v('wl-title').value.trim(), desc:v('wl-desc').value.trim(),
    emoji:(document.querySelector('#wl-emo .tick')||{}).dataset?.e||'🧱', color:(document.querySelector('#wl-col [data-on]')||{}).dataset?.c||'sky',
    classes:[...document.querySelectorAll('.wl-cls:checked')].map(x=>x.value), approval:v('wl-appr').checked, open:v('wl-open').checked, likes:v('wl-likes').checked, maxPosts:Number(v('wl-max').value)||3 };
  if(!wall.title) return toast('اكتب عنوان الحائط','bad');
  v('wl-save').disabled=true;
  const j=await WALL_ENV.post('/wall-save',{wall,notify:!id&&!!(v('wl-notify')&&v('wl-notify').checked)}).catch(()=>null);
  if(!j||!j.ok){ v('wl-save').disabled=false; return toast((j&&j.error)||'تعذّر الحفظ','bad'); }
  closeModal(); toast(id?'✅ حُفظ الحائط':'✅ أُنشئ الحائط — يظهر للطلاب في بوابتهم','good'); wallAdminLoad();
}
async function wallToggleOpen(id){
  const w=WALL_ADMIN.find(x=>x.id===id); if(!w) return;
  const j=await WALL_ENV.post('/wall-save',{wall:{...w,open:!w.open}}).catch(()=>null);
  if(!j||!j.ok) return toast('تعذّر التنفيذ','bad'); wallAdminLoad();
}
async function wallRemove(id){
  const w=WALL_ADMIN.find(x=>x.id===id); if(!w) return;
  if(!confirm(`حذف حائط «${w.title}» نهائيًا مع كل منشوراته (${w.count}) وملفاتها؟`)) return;
  const j=await WALL_ENV.post('/wall-delete',{id}).catch(()=>null);
  if(!j||!j.ok) return toast('تعذّر الحذف','bad'); toast('حُذف الحائط','good'); wallAdminLoad();
}

/* ═══ 🏆 موقع المسابقة: ربط مرة واحدة، ثم «أرسل للمسابقة» من أي منشور في الحائط ═══ */
let VOTE_LINK=null;
async function voteLinkGet(force){
  if(VOTE_LINK&&!force) return VOTE_LINK;
  try{ const r=await fetch(WALL_ENV.api()+'/vote-link?t='+encodeURIComponent(getTok())+'&_='+Date.now(),{cache:'no-store'}); VOTE_LINK=await r.json(); }catch(e){ VOTE_LINK=null; }
  return VOTE_LINK||{};
}
async function voteLinkRow(){
  const el=document.getElementById('vote-link-row'); if(!el) return;
  const v=await voteLinkGet(true);
  el.innerHTML=v.linked?`🏆 مرتبط بموقع المسابقة: <b dir="ltr">${esc(v.url.replace(/^https:\/\//,''))}</b> · <a href="#" onclick="voteLinkForm(voteLinkRow);return false">تغيير</a> · <a href="#" onclick="voteUnlink();return false">فك الربط</a>
      <br>📱 <a href="#" onclick="votersImport();return false">طلاب المدرسة للتصويت بجوال ولي الأمر</a> <span id="voters-count"></span>`
    :`🏆 اربط موقع المسابقة لترسل له أفضل الأعمال من الحائط بضغطة — <a href="#" onclick="voteLinkForm(voteLinkRow);return false">ربط</a>`;
  if(v.linked) votersCount();
}
/* 📱 طلاب المدرسة كلها (حتى من لا تدرّسهم) للتصويت بجوال ولي الأمر — بملفات مدرستي نفسها التي تستورد بها طلابك.
   لا تُحفظ في مساعد المعلم: تُرسل لموقع المسابقة مباشرة، وهو يحفظ بصمة الرقم لا الرقم. */
async function votersCount(){
  const el=document.getElementById('voters-count'); if(!el) return;
  try{ const r=await fetch(WALL_ENV.api()+'/vote-voters?t='+encodeURIComponent(getTok())+'&_='+Date.now(),{cache:'no-store'}); const j=await r.json();
    el.textContent=j&&j.ok?(j.total?`— ${j.total} طالبًا في ${j.classes.length} فصول`:'— لا قائمة بعد'):''; }catch(e){}
}
function votersImport(){
  const inp=document.createElement('input'); inp.type='file'; inp.multiple=true; inp.accept='.xlsx,.xls';
  inp.onchange=async()=>{
    const files=[...inp.files]; if(!files.length) return;
    toast('جارٍ قراءة الملفات…');
    let rows=[]; const bad=[];
    for(const f of files){ try{ const r=await readExcelStudentRecords(f,{phones:true}); rows=rows.concat(r); if(!r.some(x=>x.phone)) bad.push(f.name); }catch(e){ bad.push(f.name); } }
    const seen=new Set(); rows=rows.filter(r=>{ const k=normAr(r.name)+'|'+r.cls; if(seen.has(k)) return false; seen.add(k); return true; });
    const ok=rows.filter(r=>r.phone&&r.cls), noPh=rows.filter(r=>!r.phone), noCls=rows.filter(r=>r.phone&&!r.cls);
    const byCls={}; ok.forEach(r=>{ byCls[r.cls]=(byCls[r.cls]||0)+1; });
    const box=wallSheet(`<h3>📱 طلاب المدرسة للتصويت</h3>
      <div class="muted">يدخل الطالب في موقع المسابقة باختيار فصله وكتابة جوال ولي أمره — صوت واحد لكل طالب. لا تُحفظ في مساعد المعلم، وموقع المسابقة يحفظ بصمة الرقم لا الرقم نفسه.</div>
      <div><b>${ok.length}</b> طالبًا جاهزًا في <b>${Object.keys(byCls).length}</b> فصول:</div>
      <div style="max-height:180px;overflow:auto;font-size:.88rem;line-height:1.9">${Object.entries(byCls).sort().map(([c,n])=>`• ${esc(c)} — ${n}`).join('<br>')||'—'}</div>
      ${noPh.length?`<div class="wall-st pend">⚠️ ${noPh.length} بلا جوال في الملف (لن يُضافوا): ${esc(noPh.slice(0,5).map(r=>r.name).join('، '))}${noPh.length>5?'…':''}</div>`:''}
      ${noCls.length?`<div class="wall-st pend">⚠️ ${noCls.length} بلا فصل في الملف (لن يُضافوا)</div>`:''}
      ${bad.length?`<div class="wall-st pend">⚠️ ملفات بلا عمود جوال: ${esc(bad.join('، '))}</div>`:''}
      <label style="flex-direction:row;align-items:center;font-weight:600"><input type="checkbox" id="vv-rep"> استبدال القائمة السابقة كلها (بدلًا من الإضافة إليها)</label>
      <div class="wcp-acts"><button type="button" class="wall-btn" onclick="document.getElementById('wall-comp').remove()">إلغاء</button><button type="button" class="wall-btn main" id="vv-go" ${ok.length?'':'disabled'}>إرسال لموقع المسابقة</button></div>`);
    box.querySelector('#vv-go').onclick=async()=>{
      const go=box.querySelector('#vv-go'); go.disabled=true; go.textContent='⏳ جارٍ الإرسال…';
      const j=await WALL_ENV.post('/vote-voters',{rows:ok.map(r=>({name:r.name,cls:r.cls,phone:r.phone})),replace:box.querySelector('#vv-rep').checked}).catch(()=>null);
      if(j&&j.error==='vote_auth'){ box.remove(); toast('انتهت جلسة موقع المسابقة — اربط من جديد','bad'); return voteLinkForm(votersImport); }
      if(!j||!j.ok){ go.disabled=false; go.textContent='إرسال لموقع المسابقة'; return toast((j&&j.error)||'تعذّر الإرسال','bad'); }
      box.remove(); toast(`✅ أُضيف ${j.added} طالبًا — المجموع في موقع المسابقة ${j.total}`,'good'); votersCount();
    };
  };
  inp.click();
}
/* 🗳️ إعلان التصويت الجاهز: يملأ نموذج الإعلان بنص وزر يفتح التصويت من البوابة (يدخل الطالب بحسابه تلقائيًا) — المعلم يراجعه ثم ينشره */
async function annVoteTemplate(){
  const v=await voteLinkGet(true);
  if(!v||!v.linked){ toast('اربط موقع المسابقة أولًا','bad'); return voteLinkForm(annVoteTemplate); }
  const portal=(()=>{ try{ return (localStorage.getItem(K_SITE)||SITE_URL||'').trim().replace(/\/+$/,''); }catch(e){ return ''; } })();
  const go=portal?portal+'/?open=vote':String(v.url||'').replace(/\/+$/,'')+'/';
  const t=document.getElementById('ann-title'), b=document.getElementById('ann-body'); if(!t||!b) return;
  if((t.value.trim()||b.value.trim())&&!confirm('سيُستبدل العنوان والنص المكتوبان بإعلان التصويت. متابعة؟')) return;
  t.value='🗳️ التصويت مفتوح — اختر أفضل عمل!';
  b.value=`شاهد أعمال زملائك في المسابقة وصوّت للعمل الذي أعجبك 🏆
• تدخل بحساب البوابة تلقائيًا — لا تحتاج رمزًا جديدًا
• لك صوت واحد فقط، وصوتك سرّي
[ادخل صفحة التصويت](${go})`;
  t.scrollIntoView({behavior:'smooth',block:'center'}); toast('🗳️ جهّزت إعلان التصويت — راجعه ثم اضغط «انشر الإعلان»','good');
}
async function voteUnlink(){ if(!confirm('فك الربط بموقع المسابقة؟')) return; await WALL_ENV.post('/vote-link',{unlink:true}); VOTE_LINK=null; voteLinkRow(); }
function voteLinkForm(after){
  const v=VOTE_LINK||{};
  const box=wallSheet(`<h3>🏆 ربط موقع المسابقة</h3>
    <label>رابط موقع المسابقة<input type="text" id="vl-url" dir="ltr" placeholder="https://…" value="${esc(v.url||'')}"></label>
    <label>كلمة مرور لوحة تحكم المسابقة<input type="password" id="vl-pw" autocomplete="off"></label>
    <div class="muted">تُستخدم مرة واحدة للدخول ولا تُحفظ — يُحفظ رمز الجلسة فقط. لو غيّرت كلمة المرور هناك اربط من جديد.</div>
    <div class="wcp-acts"><button type="button" class="wall-btn" onclick="document.getElementById('wall-comp').remove()">إلغاء</button><button type="button" class="wall-btn main" id="vl-go">ربط</button></div>`);
  box.querySelector('#vl-go').onclick=async()=>{
    const go=box.querySelector('#vl-go'); go.disabled=true; go.textContent='جارٍ الربط…';
    const portal=(()=>{ try{ return (localStorage.getItem(K_SITE)||SITE_URL||'').trim(); }catch(e){ return ''; } })();   // 🎓 رابط بوابة الطالب: زر «ادخل بحساب البوابة» في موقع المسابقة
    const j=await WALL_ENV.post('/vote-link',{url:box.querySelector('#vl-url').value.trim(),password:box.querySelector('#vl-pw').value,portal}).catch(()=>null);
    if(!j||!j.ok){ go.disabled=false; go.textContent='ربط'; return toast((j&&j.error)||'تعذّر الربط','bad'); }
    VOTE_LINK=j; box.remove(); toast('✅ تم الربط بموقع المسابقة','good'); if(after) after();
  };
}
// غلاف العمل في المسابقة: الصورة نفسها مصغّرة، أو لقطة من الفيديو، أو بطاقة بالنص — JPEG أقل من 1.7MB
async function wallCover(p){
  const c=document.createElement('canvas'), g=c.getContext('2d'), MAX=1280;
  const out=()=>{ let q=.86, d=c.toDataURL('image/jpeg',q); while(d.length>1700000&&q>.35){ q-=.12; d=c.toDataURL('image/jpeg',q); } return d; };
  const fit=(w,h)=>{ const s=Math.min(1,MAX/Math.max(w,h)); c.width=Math.max(1,Math.round(w*s)); c.height=Math.max(1,Math.round(h*s)); };
  const img=(p.files||[]).find(f=>f.kind==='image'), vid=(p.files||[]).find(f=>f.kind==='video');
  if(img){ try{ const el=await new Promise((res,rej)=>{ const i=new Image(); i.crossOrigin='anonymous'; i.onload=()=>res(i); i.onerror=rej; i.src=wallFileUrl(p,img.i); }); fit(el.naturalWidth,el.naturalHeight); g.drawImage(el,0,0,c.width,c.height); return out(); }catch(e){} }
  if(vid){ try{ const v=document.createElement('video'); v.crossOrigin='anonymous'; v.muted=true; v.playsInline=true; v.preload='auto'; v.src=wallFileUrl(p,vid.i);
      await new Promise((res,rej)=>{ v.onloadeddata=res; v.onerror=rej; setTimeout(()=>rej(new Error('t')),20000); });
      v.currentTime=Math.min(1.5,(v.duration||3)/3); await new Promise(res=>{ v.onseeked=res; setTimeout(res,6000); });
      if(v.videoWidth){ fit(v.videoWidth,v.videoHeight); g.drawImage(v,0,0,c.width,c.height); return out(); } }catch(e){} }
  // بطاقة نصية بألوان الحائط
  const w=WALL.data.wall, col=WALL_COLORS[w.color]||WALL_COLORS.sky; c.width=1200; c.height=900;
  const gr=g.createLinearGradient(0,0,1200,900); gr.addColorStop(0,col[1]); gr.addColorStop(1,col[0]); g.fillStyle=gr; g.fillRect(0,0,1200,900);
  g.fillStyle='rgba(255,255,255,.92)'; g.beginPath(); g.roundRect?g.roundRect(70,150,1060,650,40):g.rect(70,150,1060,650); g.fill();
  g.direction='rtl'; g.textAlign='center'; g.fillStyle='#fff'; g.font='bold 64px sans-serif'; g.fillText(`${w.emoji} ${w.title}`.slice(0,40),600,105);
  g.fillStyle='#1e293b'; g.font='bold 46px sans-serif';
  const words=String(p.text||p.link||'').split(/\s+/), lines=[]; let ln='';
  for(const wd of words){ const t=ln?ln+' '+wd:wd; if(g.measureText(t).width>960&&ln){ lines.push(ln); ln=wd; } else ln=t; } if(ln) lines.push(ln);
  lines.slice(0,8).forEach((l,i)=>g.fillText(l,600,250+i*68));
  g.font='38px sans-serif'; g.fillStyle='#475569'; g.fillText(`— ${p.name||''}`,600,760);
  return out();
}
async function wallVoteSend(id){
  const p=WALL.data&&WALL.data.posts.find(x=>x.id===id); if(!p) return;
  const v=await voteLinkGet(); if(!v.linked) return voteLinkForm(()=>wallVoteSend(id));
  const w=WALL.data.wall, f=(p.files||[]), media=f.find(x=>x.kind==='video')?'الفيديو':f.find(x=>x.kind==='pdf')?'ملف PDF':p.link?'الرابط':'';
  const first=String(p.text||'').split('\n')[0].trim();
  const box=wallSheet(`<h3>🏆 أرسل للمسابقة</h3>
    ${p.voted?'<div class="wall-st pend">أُرسل هذا العمل من قبل — الإرسال مرة ثانية يضيفه نسخة جديدة</div>':''}
    <label>عنوان العمل<input type="text" id="vs-title" maxlength="80" value="${esc((first||w.title).slice(0,80))}"></label>
    <label>اسم الطالب<input type="text" id="vs-name" maxlength="80" value="${esc(p.byTeacher?'':p.name)}"></label>
    <label>الفصل<input type="text" id="vs-cls" maxlength="60" value="${esc(p.cls||'')}"></label>
    <div class="muted">يُرسل: صورة غلاف${media?' + '+media:''} إلى <b dir="ltr">${esc(v.url.replace(/^https:\/\//,''))}</b> — ويظهر هناك مع بقية الأعمال للتصويت</div>
    <div id="vs-st" class="muted"></div>
    <div class="wcp-acts"><button type="button" class="wall-btn" onclick="document.getElementById('wall-comp').remove()">إلغاء</button><button type="button" class="wall-btn main" id="vs-go">إرسال 🏆</button></div>`);
  box.querySelector('#vs-go').onclick=async()=>{
    const go=box.querySelector('#vs-go'), st=box.querySelector('#vs-st'); go.disabled=true;
    st.textContent='⏳ تجهيز صورة الغلاف…'; const cover=await wallCover(p).catch(()=>'');
    if(!cover){ go.disabled=false; st.textContent=''; return toast('تعذّر تجهيز صورة الغلاف','bad'); }
    st.textContent=media==='الفيديو'?'⏳ نقل الفيديو لموقع المسابقة… (قد يأخذ دقيقة للفيديو الكبير)':'⏳ جارٍ الإرسال…';
    const j=await WALL_ENV.post('/vote-send',{post:id,cover,title:box.querySelector('#vs-title').value.trim(),student:box.querySelector('#vs-name').value.trim(),cls:box.querySelector('#vs-cls').value.trim()}).catch(()=>null);
    if(j&&j.error==='vote_auth'){ box.remove(); toast('انتهت جلسة موقع المسابقة — اربط من جديد','bad'); return voteLinkForm(()=>wallVoteSend(id)); }
    if(!j||!j.ok){ go.disabled=false; st.textContent=''; return toast((j&&j.error)||'تعذّر الإرسال','bad'); }
    box.remove(); toast('🏆 وصل العمل لموقع المسابقة','good'); WALL.data._sig=''; wallLoad();
  };
}
/* ═══ 🧱 مشروع طالب أعجبك ⇒ اعرضه في حائط ليشاهده الجميع (الملفات تُنسخ، وتسليمه الأصلي لا يتغير) ═══ */
async function wallShareProject(index){
  const x=(window.__visibleProjects||[])[index]; if(!x) return;
  if(!WALL_ADMIN.length){ try{ await wallAdminLoad(); }catch(e){} }
  const files=Array.isArray(x.files)?x.files:[];
  const box=wallSheet(`<h3>🧱 اعرضه في حائط — ${esc(x.studentName||'')}</h3>
    <label>الحائط<select id="ws-wall">${WALL_ADMIN.map(w=>`<option value="${esc(w.id)}">${esc(w.emoji)} ${esc(w.title)}${(w.classes||[]).length?' ('+esc(w.classes.join('، '))+')':' (كل الفصول)'}</option>`).join('')}<option value="__new">＋ حائط جديد…</option></select></label>
    <label id="ws-new-l" style="display:none">عنوان الحائط الجديد<input type="text" id="ws-new" maxlength="120" value="${esc(x.title||'')} — أعمال مميزة"></label>
    <label>كلمة تظهر مع العمل<textarea id="ws-text" rows="2" maxlength="1000" style="border:2px solid #cbd5e1;border-radius:12px;padding:.5rem;font:inherit">⭐ عمل مميز: ${esc(x.title||'')} — ${esc(x.studentName||'')}</textarea></label>
    ${files.length?`<div class="muted">الملفات:</div>${files.map((f,i)=>`<label style="flex-direction:row;align-items:center;font-weight:600"><input type="checkbox" class="ws-f" value="${i}" ${i<4?'checked':''}> ${projectIsVideo(f)?'🎥':f.type==='application/pdf'?'📄':'🖼️'} ${esc(f.name||'ملف')}</label>`).join('')}`:''}
    <div class="muted">يظهر في الحائط باسم الطالب مباشرة (بلا انتظار اعتماد). الملفات تُنسخ، فتسليمه الأصلي يبقى كما هو.</div>
    <div class="wcp-acts"><button type="button" class="wall-btn" onclick="document.getElementById('wall-comp').remove()">إلغاء</button><button type="button" class="wall-btn main" id="ws-go">انشر في الحائط</button></div>`);
  const sel=box.querySelector('#ws-wall'); const syncNew=()=>{ box.querySelector('#ws-new-l').style.display=sel.value==='__new'?'':'none'; }; sel.onchange=syncNew; if(!WALL_ADMIN.length) sel.value='__new'; syncNew();
  box.querySelector('#ws-go').onclick=async()=>{
    const go=box.querySelector('#ws-go'); go.disabled=true; go.textContent='⏳ جارٍ النشر…';
    let wall=sel.value;
    if(wall==='__new'){ const t=box.querySelector('#ws-new').value.trim(); if(!t){ go.disabled=false; go.textContent='انشر في الحائط'; return toast('اكتب عنوان الحائط','bad'); }
      const r=await WALL_ENV.post('/wall-save',{wall:{title:t,emoji:'🏆',color:'sun',classes:[],approval:true,open:false,likes:true,maxPosts:3}}).catch(()=>null);
      if(!r||!r.ok){ go.disabled=false; go.textContent='انشر في الحائط'; return toast('تعذّر إنشاء الحائط','bad'); } wall=r.id; }
    const st=x.student||{};
    const j=await WALL_ENV.post('/wall-share',{wall,hw:String(x.project&&(x.project.sid||x.project.id)||''),sid:String(st.sid||st.id||st.studentId||''),name:String(st.name||x.studentName||''),
      text:box.querySelector('#ws-text').value.trim(),files:[...box.querySelectorAll('.ws-f:checked')].map(i=>Number(i.value))}).catch(()=>null);
    if(!j||!j.ok){ go.disabled=false; go.textContent='انشر في الحائط'; return toast('تعذّر النشر في الحائط','bad'); }
    box.remove(); toast('🧱 نُشر العمل في الحائط','good'); wallAdminLoad();
  };
}
