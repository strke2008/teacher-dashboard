/* ⏳ الجزء المؤجَّل من js/wall-admin.js — يُحمَّل في الخلفية بعد ظهور اللوحة (js/46-lazy.js) ولا يُذكر في index.html كسكربت.
   فيه فقط دوال تُستدعى من الأزرار (نصوص onclick)؛ وما يحتاجه الفتح أو أي ملف آخر بالاسم بقي في js/wall-admin.js.
   الفاصل يحسبه tests/lazy-split (اختبار «سلامة التقسيم»): لا تنادِ دالة من هنا مباشرة في ملف آخر — ضعها في الملف الأصلي. */

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
async function wallShareProject(index){
  const x=(window.__visibleProjects||[])[index]; if(!x) return;
  if(!WALL_ADMIN.length){ try{ await wallAdminLoad(); }catch(e){} }
  const files=Array.isArray(x.files)?x.files:[], done=await wallSharedGet(x);
  const box=wallSheet(`<h3>🧱 اعرضه في حائط — ${esc(x.studentName||'')}</h3>
    ${done.length?`<div class="wall-st pend">⚠️ هذا العمل منشور مسبقًا في: ${done.map(r=>`«${esc(wallTitleE(r))}»`).join('، ')} — انشره مرة أخرى فقط إن أردت حائطًا آخر</div>`:''}
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
    box.remove(); toast('🧱 نُشر العمل في الحائط','good'); wallAdminLoad(); wallSharedMark(index);
  };
}
