/* 🧱 حوائط الإبداع — إدارة المعلم (تبويب «رسائل الطلاب»): إنشاء/تعديل/حذف، وفتح الحائط بأدوات الاعتماد والعرض */
const WALL_ENV={ teacher:true,
  api:()=>getApi().replace(/\/+$/,''),
  who:()=>'&t='+encodeURIComponent(getTok()),
  post:async(path,body)=>{ const r=await fetch(WALL_ENV.api()+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,t:getTok()})}); return r.json().catch(()=>({})); },
  compress:null,
  toast:(m,k)=>toast(m,k) };
let WALL_ADMIN=[];
async function wallAdminLoad(){
  const box=document.getElementById('wall-admin-list'); if(!box||!getApi()||!getTok()) return;
  let j=null; try{ const r=await fetch(WALL_ENV.api()+'/walls?t='+encodeURIComponent(getTok())+'&_='+Date.now(),{cache:'no-store'}); j=await r.json(); }catch(e){}
  if(!j||!j.ok){ box.innerHTML=`<div class="muted">${j&&j.error==='no_db'?'الحوائط تحتاج قاعدة D1 مربوطة بالخادم باسم DB':'تعذّر جلب الحوائط — تحقق من الاتصال'}</div>`; return; }
  WALL_ADMIN=j.rows||[];
  box.innerHTML=WALL_ADMIN.length?`<div class="walls-list">${WALL_ADMIN.map(w=>{ const c=WALL_COLORS[w.color]||WALL_COLORS.sky;
    return `<div class="wall-tile${w.color==='night'?' dark':''}" style="--wbg:${c[0]};--wac:${c[1]};cursor:default">
      ${w.pending?`<span class="new">${w.pending} ينتظر</span>`:''}<span class="e">${esc(w.emoji)}</span><b>${esc(w.title)}</b>
      <small>${w.count} منشور · ${w.draft?'مسودة':w.open?'النشر مفتوح':'🔒 مغلق'} · ${(w.classes||[]).length?esc(w.classes.join('، ')):'كل الفصول'}</small>
      <div class="row" style="gap:.3rem;margin-top:.4rem;flex-wrap:wrap"><button class="btn tick sm" type="button" onclick="wallOpen('${esc(w.id)}')">فتح</button>
        <button class="btn ghost sm" type="button" onclick="wallEdit('${esc(w.id)}')">تعديل</button>
        <button class="btn ghost sm" type="button" onclick="wallToggleOpen('${esc(w.id)}')">${w.open?'🔒 إغلاق النشر':'🔓 فتح النشر'}</button>
        <button class="btn ghost sm" type="button" onclick="wallRemove('${esc(w.id)}')">حذف</button></div></div>`; }).join('')}</div>`
    :'<div class="feature-empty">لا حوائط بعد — أنشئ حائطًا لمناسبة أو تجربة ويشارك فيه طلابك 🌿</div>';
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
