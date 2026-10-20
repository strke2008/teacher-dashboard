/* ═══ 📢 إعلانات المعلم في الصفحة الرئيسية للطالب (صورة · فيديو · PDF) ═══ */
const ANN_SEEN_KEY='ann_seen_v1';
function annApi(){return ((typeof HW!=='undefined'&&HW&&HW.api)||API||'').replace(/\/+$/,'')}
function annFileUrl(a,i,dl){const q=new URLSearchParams({a:a.id,f:String(i),sid:String(mySid||''),name:String(myName||lockedName()||'').trim()});if(dl)q.set('dl','1');return annApi()+'/ann-file?'+q.toString()}
function annSeen(){try{return new Set(JSON.parse(localStorage.getItem(ANN_SEEN_KEY)||'[]'))}catch(e){return new Set()}}
function annMarkSeen(ids){try{const s=annSeen();ids.forEach(x=>s.add(x));localStorage.setItem(ANN_SEEN_KEY,JSON.stringify([...s].slice(-200)))}catch(e){}}
async function annPortalLoad(){
  const box=document.getElementById('space-ann');if(!box)return;
  const sid=String(mySid||''),name=String(myName||lockedName()||'').trim();if(!sid&&!name){box.innerHTML='';return}
  let rows=[];
  try{const r=await fetch(annApi()+'/ann-mine?'+new URLSearchParams({sid,name}).toString(),{cache:'no-store'});const j=await r.json();rows=(j&&j.rows)||[]}catch(e){}
  if(String(mySid||'')!==sid)return;
  if(!rows.length){box.innerHTML='';return}
  const seen=annSeen(),fresh=rows.filter(a=>!seen.has(a.id)).length;
  const card=(a,i)=>{const isNew=!seen.has(a.id);
    const imgs=a.files.filter(f=>f.kind==='image'),vids=a.files.filter(f=>f.kind==='video'),pdfs=a.files.filter(f=>f.kind==='pdf');
    return `<article class="ann-card ${isNew?'is-new':''}" ${i>=3?'data-more hidden':''}>
      <div class="ann-h"><b>${esc(a.title||'إعلان')}</b>${isNew?'<span class="ann-new">جديد</span>':''}<small>${new Date(a.at).toLocaleDateString('ar-SA',{day:'numeric',month:'long'})}</small></div>
      ${a.until?`<div class="ann-until">⏳ متاح حتى ${new Date(a.until).toLocaleString('ar-SA-u-ca-gregory',{weekday:'long',day:'numeric',month:'numeric',hour:'numeric',minute:'2-digit'})}</div>`:''}
      ${a.body?`<div class="ann-b">${annLinkify(a.body)}</div>`:''}
      ${imgs.length?`<div class="ann-imgs n${Math.min(imgs.length,3)}">${imgs.map(f=>`<button type="button" class="ann-img" onclick="annZoom('${annFileUrl(a,f.i)}')" aria-label="تكبير الصورة"><img loading="lazy" src="${annFileUrl(a,f.i)}" alt="${esc(f.name)}"></button>`).join('')}</div>`:''}
      ${vids.map(f=>`<video class="ann-vid" controls playsinline preload="metadata" src="${annFileUrl(a,f.i)}"></video>`).join('')}
      ${pdfs.map(f=>`<div class="ann-pdf"><span>📄</span><div><b>${esc(f.name)}</b><small>${f.size<1048576?Math.max(1,Math.round(f.size/1024))+' KB':(f.size/1048576).toFixed(1)+' MB'}</small></div>
        <a class="btn ghost" href="${annFileUrl(a,f.i)}" target="_blank" rel="noopener">فتح</a><a class="btn ghost" href="${annFileUrl(a,f.i,1)}">تنزيل</a></div>`).join('')}
    </article>`};
  box.innerHTML=`<section class="ann-sec"><div class="ann-sec-h"><b>📢 إعلانات معلمك</b>${fresh?`<span class="ann-new">${fresh} جديد</span>`:''}</div>
    ${rows.map(card).join('')}
    ${rows.length>3?`<button type="button" class="btn ghost ann-more" onclick="this.parentElement.querySelectorAll('[data-more]').forEach(x=>x.hidden=false);this.remove()">عرض كل الإعلانات (${rows.length})</button>`:''}</section>`;
  setTimeout(()=>annMarkSeen(rows.slice(0,3).map(a=>a.id)),2500);
}
/* الروابط في نص الإعلان قابلة للضغط — يُهرَّب النص أولًا ثم تُحوَّل الروابط فقط (لا HTML من المصدر) */
function annLinkify(text){
  const safe=esc(String(text||''));
  return safe.replace(/(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/g,m=>{
    const trail=(m.match(/[.,،؛:!?)\]]+$/)||[''])[0], u=trail?m.slice(0,-trail.length):m;
    const href=(/^www\./i.test(u)?'https://':'')+u.replace(/&amp;/g,'&');
    const L=annLinkInfo(href);
    return `<a class="ann-btn" href="${esc(href)}" target="_blank" rel="noopener noreferrer"><span class="ann-btn-ic">${L.ic}</span><span class="ann-btn-tx"><b>${esc(L.t)}</b><small>${esc(L.sub)}</small></span><span class="ann-btn-go">فتح ←</span></a>${trail}`;
  }).replace(/(<\/a>[.,،؛:!?)\]]*)\n/g,'$1');   // الزر سطر مستقل: لا سطر فارغ بعده
}
/* 🔘 الرابط زرّ واضح بدل نص طويل مُرمَّز: اسم الملف من الرابط نفسه (مفكوك الترميز) ونوعه وأيقونته والموقع */
const ANN_EXT={ pptx:['📊','عرض PowerPoint'], ppt:['📊','عرض PowerPoint'], docx:['📄','مستند Word'], doc:['📄','مستند Word'], pdf:['📕','ملف PDF'],
  xlsx:['📗','ملف Excel'], xls:['📗','ملف Excel'], mp4:['🎬','فيديو'], mov:['🎬','فيديو'], mp3:['🎧','ملف صوتي'], jpg:['🖼️','صورة'], jpeg:['🖼️','صورة'], png:['🖼️','صورة'], zip:['🗜️','ملف مضغوط'] };
function annLinkInfo(href){
  let U; try{ U=new URL(href); }catch(e){ return { ic:'🔗', t:'فتح الرابط', sub:'' }; }
  const host=U.hostname.replace(/^www\./,''), seg=U.pathname.split('/').filter(Boolean).pop()||'';
  let name=''; try{ name=decodeURIComponent(seg); }catch(e){ name=seg; }
  const m=/\.([a-z0-9]{2,5})$/i.exec(name), ext=m?m[1].toLowerCase():'';
  if(ANN_EXT[ext]){ const t=name.slice(0,-(ext.length+1)).replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim(); return { ic:ANN_EXT[ext][0], t:t||ANN_EXT[ext][1], sub:`${ANN_EXT[ext][1]} · ${host}` }; }
  if(/(^|\.)youtube\.com$|^youtu\.be$/.test(host)) return { ic:'▶️', t:'مشاهدة الفيديو', sub:'يوتيوب' };
  if(/docs\.google\.com$/.test(host)&&/\/forms\//.test(U.pathname)||/^forms\.gle$/.test(host)) return { ic:'📝', t:'فتح النموذج', sub:'نماذج Google' };
  if(/docs\.google\.com$|drive\.google\.com$/.test(host)) return { ic:'📁', t:'فتح الملف', sub:'Google Drive' };
  return { ic:'🔗', t:'فتح الرابط', sub:host };
}
function annZoom(src){
  const ov=document.createElement('div');ov.className='ann-zoom';ov.innerHTML=`<img src="${src}" alt=""><button type="button" aria-label="إغلاق">✕</button>`;
  ov.onclick=()=>ov.remove();document.body.appendChild(ov);
}
