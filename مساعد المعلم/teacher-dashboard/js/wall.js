/* 🧱 حوائط الإبداع — ملف مشترك بين بوابة الطالب ولوحة المعلم (نسخة متطابقة في المجلدين).
   كل تطبيق يعرّف WALL_ENV قبل الاستخدام:
     teacher: هل الواجهة للمعلم (اعتماد/إخفاء/تثبيت/عرض)
     api(): عنوان الخادم · who(): معاملات الهوية في الرابط (sid/name أو t)
     post(path, body): طلب كتابة موثَّق (جلسة الطالب أو كلمة سر المعلم) ← JSON
     compress(file): ضغط الصورة قبل الرفع (اختياري) · toast(msg, kind) */
const WALL = { cur: null, data: null, timer: 0, busy: false, proj: false, sending: false };
const WALL_COLORS = { sky: ['#dbeafe', '#2563eb'], mint: ['#d1fae5', '#059669'], sun: ['#fef3c7', '#d97706'], rose: ['#ffe4e6', '#e11d48'],
  lilac: ['#ede9fe', '#7c3aed'], peach: ['#ffedd5', '#ea580c'], sand: ['#f5efe0', '#a16207'], night: ['#1e293b', '#38bdf8'] };
const WALL_CARD = ['#fef9c3', '#dcfce7', '#dbeafe', '#fce7f3', '#ede9fe', '#ffedd5', '#ccfbf1', '#fee2e2'];
const WALL_EMOJIS = ['🧱', '🚀', '🇸🇦', '👩‍🏫', '🎈', '🔬', '🌍', '🎨', '📚', '💡', '🏆', '🌙'];

function wallEsc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function wallToast(m, k) { try { (WALL_ENV.toast || window.toast)(m, k); } catch (e) { alert(m); } }
function wallHash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
function wallAgo(t) { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'الآن' : m < 60 ? `قبل ${m} د` : m < 1440 ? `قبل ${Math.round(m / 60)} س` : `قبل ${Math.round(m / 1440)} يوم`; }
function wallSize(n) { return n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
function wallYt(link) { const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/.exec(String(link || '')); return m ? m[1] : ''; }
function wallFileUrl(p, i) { return `${WALL_ENV.api()}/wall-file?p=${encodeURIComponent(p.id)}&f=${i}${WALL_ENV.who()}`; }
async function wallGetJ(path) { try { const r = await fetch(WALL_ENV.api() + path + WALL_ENV.who() + '&_=' + Date.now(), { cache: 'no-store' }); return await r.json(); } catch (e) { return null; } }
// آخر زيارة لكل حائط (لعلامة «جديد») — على هذا الجهاز
function wallSeenGet() { try { return JSON.parse(localStorage.getItem('wall_seen_v1') || '{}') || {}; } catch (e) { return {}; } }
function wallSeenSet(id, t) { try { const s = wallSeenGet(); s[id] = t; localStorage.setItem('wall_seen_v1', JSON.stringify(s)); } catch (e) {} }

/* ═══ الحائط مفتوحًا: طبقة بملء الشاشة، تتحدّث كل 8 ثوانٍ ما دامت ظاهرة ═══ */
async function wallOpen(id) {
  WALL.cur = id; WALL.data = null;
  let ov = document.getElementById('wall-ov');
  if (!ov) { ov = document.createElement('div'); ov.id = 'wall-ov'; ov.className = 'wall-ov'; ov.setAttribute('role', 'dialog'); document.body.appendChild(ov); }
  ov.innerHTML = '<div class="wall-load">⏳ جارٍ فتح الحائط…</div>';
  document.documentElement.classList.add('wall-on');
  await wallLoad();
  clearInterval(WALL.timer);
  WALL.timer = setInterval(() => { if (!document.hidden && WALL.cur && !WALL.sending && !document.getElementById('wall-comp')) wallLoad(); }, 8000);
}
function wallClose() {
  clearInterval(WALL.timer); WALL.cur = null; WALL.data = null;
  if (document.fullscreenElement) try { document.exitFullscreen(); } catch (e) {}
  document.getElementById('wall-ov')?.remove(); document.documentElement.classList.remove('wall-on', 'wall-proj');
  try { if (typeof wallsLoad === 'function') wallsLoad(); } catch (e) {}
  try { if (typeof wallAdminLoad === 'function') wallAdminLoad(); } catch (e) {}
}
async function wallLoad() {
  const id = WALL.cur; if (!id) return;
  const j = await wallGetJ('/wall?id=' + encodeURIComponent(id));
  if (WALL.cur !== id) return;
  if (!j || !j.ok) { if (!WALL.data) document.getElementById('wall-ov').innerHTML = `<div class="wall-load">تعذّر فتح الحائط <button type="button" class="wall-btn" onclick="wallClose()">رجوع</button></div>`; return; }
  const sig = JSON.stringify(j);
  if (WALL.data && WALL.data._sig === sig) return;
  j._sig = sig; WALL.data = j;
  wallSeenSet(id, Date.now());
  wallRender();
}
function wallRender() {
  const ov = document.getElementById('wall-ov'), d = WALL.data; if (!ov || !d) return;
  const w = d.wall, T = !!WALL_ENV.teacher, col = WALL_COLORS[w.color] || WALL_COLORS.sky;
  const canPost = T || (w.open && d.mine < w.maxPosts);
  const pend = T ? d.posts.filter(p => p.status === 'pending').length : 0;
  const scroll = ov.querySelector('.wall-body')?.scrollTop || 0;
  ov.style.setProperty('--wbg', col[0]); ov.style.setProperty('--wac', col[1]); ov.classList.toggle('dark', w.color === 'night');
  ov.innerHTML = `
    <header class="wall-top">
      <button type="button" class="wall-x" onclick="wallClose()" aria-label="رجوع">→</button>
      <div class="wall-ttl"><h2>${wallEsc(w.emoji)} ${wallEsc(w.title)}</h2>${w.desc ? `<p>${wallEsc(w.desc)}</p>` : ''}
        <div class="wall-chips"><span>📝 ${d.posts.filter(p => p.status === 'ok').length} منشور</span>${!w.open ? '<span>🔒 النشر مغلق</span>' : ''}${T && pend ? `<span class="warn">⏳ ${pend} ينتظر اعتمادك</span>` : ''}${T && w.draft ? '<span class="warn">مسودة — لا يراها الطلاب</span>' : ''}</div></div>
      <div class="wall-acts">
        ${canPost ? `<button type="button" class="wall-btn main" onclick="wallCompose()">＋ ${T ? 'أضف منشورًا' : 'أضف إبداعك'}</button>` : ''}
        ${T ? `<button type="button" class="wall-btn" onclick="wallProjector()" title="عرض على البروجكتر">📽️ عرض</button>` : ''}
      </div>
    </header>
    <div class="wall-body">
      ${!T && w.open && d.mine >= w.maxPosts ? `<div class="wall-note">نشرت ${d.mine} من ${w.maxPosts} — الحد لهذا الحائط. تقدر تحذف منشورًا لتضيف غيره.</div>` : ''}
      ${!T && w.approval && w.open ? '<div class="wall-note soft">🛡️ منشورك يظهر لزملائك بعد اعتماد المعلم.</div>' : ''}
      ${d.posts.length ? `<div class="wall-grid">${d.posts.map(wallCardHTML).join('')}</div>`
        : `<div class="wall-empty"><div>${wallEsc(w.emoji)}</div><b>الحائط ينتظر أول إبداع</b><span>${canPost ? 'كن أول من ينشر!' : ''}</span></div>`}
    </div>`;
  const body = ov.querySelector('.wall-body'); if (body) body.scrollTop = scroll;
}
function wallCardHTML(p) {
  const T = !!WALL_ENV.teacher, w = WALL.data.wall;
  const bg = p.byTeacher ? '#e0f2fe' : WALL_CARD[wallHash(p.id) % WALL_CARD.length];
  const av = p.byTeacher ? '🎓' : wallEsc((p.name || '؟').trim().charAt(0));
  const yt = wallYt(p.link);
  const media = (p.files || []).map(f => {
    const u = wallFileUrl(p, f.i);
    if (f.kind === 'image') return `<a class="wall-img" href="${wallEsc(u)}" target="_blank" rel="noopener"><img loading="lazy" src="${wallEsc(u)}" alt=""></a>`;
    if (f.kind === 'video') return `<video class="wall-vid" src="${wallEsc(u)}" controls playsinline preload="metadata"></video>`;
    return `<a class="wall-file" href="${wallEsc(u)}" target="_blank" rel="noopener"><b>${f.kind === 'pdf' ? 'PDF' : '📎'}</b><span>${wallEsc(f.name)}<small>${wallSize(f.size || 0)} · اضغط للفتح</small></span></a>`;
  }).join('');
  const link = !p.link ? '' : yt
    ? `<a class="wall-yt" href="${wallEsc(p.link)}" target="_blank" rel="noopener"><img loading="lazy" src="https://img.youtube.com/vi/${yt}/hqdefault.jpg" alt=""><i>▶</i></a>`
    : `<a class="wall-link" href="${wallEsc(p.link)}" target="_blank" rel="noopener">🔗 ${wallEsc(p.link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60))}</a>`;
  const state = p.status === 'pending' ? `<div class="wall-st pend">⏳ ${T ? 'ينتظر اعتمادك' : 'ينتظر اعتماد المعلم — لا يراه زملاؤك بعد'}</div>`
    : p.status === 'hidden' ? '<div class="wall-st hid">🙈 مخفي عن الطلاب</div>' : '';
  const mod = !T ? '' : `<div class="wall-mod">
      ${p.status !== 'ok' ? `<button type="button" class="ok" onclick="wallModerate('${p.id}','approve')">✓ ${p.status === 'pending' ? 'اعتماد' : 'إظهار'}</button>` : `<button type="button" onclick="wallModerate('${p.id}','hide')">🙈 إخفاء</button>`}
      <button type="button" onclick="wallModerate('${p.id}','${p.pinned ? 'unpin' : 'pin'}')">${p.pinned ? '📌 إلغاء التثبيت' : '📌 تثبيت'}</button>
      <button type="button" class="del" onclick="wallDelete('${p.id}')">🗑️</button></div>`;
  return `<article class="wcard${p.status !== 'ok' ? ' dim' : ''}${p.pinned ? ' pin' : ''}" style="--cbg:${bg}" id="wc-${wallEsc(p.id)}">
    ${p.pinned ? '<span class="wall-pin" title="مثبّت">📌</span>' : ''}
    <div class="wc-h"><span class="wc-av" style="--h:${wallHash(p.name) % 360}">${av}</span><div><b>${wallEsc(p.byTeacher ? 'المعلم' : p.name)}</b><small>${T && p.cls ? wallEsc(p.cls) + ' · ' : ''}${wallAgo(p.at)}</small></div>
      ${p.mine && !T ? `<button type="button" class="wc-del" onclick="wallDelete('${p.id}')" title="حذف منشوري" aria-label="حذف منشوري">🗑️</button>` : ''}</div>
    ${state}${media}${link}${p.text ? `<p class="wc-t">${wallEsc(p.text)}</p>` : ''}
    <div class="wc-f">${w.likes !== false && p.status === 'ok' ? `<button type="button" class="wc-like${p.liked ? ' on' : ''}" onclick="wallLike('${p.id}',this)" aria-label="إعجاب">${p.liked ? '❤️' : '🤍'} <span>${p.likes || ''}</span></button>` : '<span></span>'}</div>
    ${mod}</article>`;
}
async function wallLike(id, btn) {
  const p = WALL.data && WALL.data.posts.find(x => x.id === id); if (!p || btn.disabled) return;
  btn.disabled = true;
  p.liked = !p.liked; p.likes = Math.max(0, (p.likes || 0) + (p.liked ? 1 : -1));   // فوري، ثم يُصحَّح من الخادم
  btn.classList.toggle('on', p.liked); btn.innerHTML = `${p.liked ? '❤️' : '🤍'} <span>${p.likes || ''}</span>`;
  const j = await WALL_ENV.post('/wall-like', { post: id }).catch(() => null);
  if (j && j.ok) { p.liked = j.liked; p.likes = j.likes; } else { p.liked = !p.liked; p.likes = Math.max(0, p.likes + (p.liked ? 1 : -1)); }
  btn.classList.toggle('on', p.liked); btn.innerHTML = `${p.liked ? '❤️' : '🤍'} <span>${p.likes || ''}</span>`; btn.disabled = false;
}
async function wallDelete(id) {
  if (!confirm(WALL_ENV.teacher ? 'حذف هذا المنشور نهائيًا مع ملفاته؟' : 'حذف منشورك؟')) return;
  const j = await WALL_ENV.post('/wall-del', { post: id }).catch(() => null);
  if (!j || !j.ok) return wallToast('تعذّر الحذف', 'bad');
  WALL.data.posts = WALL.data.posts.filter(p => p.id !== id); if (!WALL_ENV.teacher) WALL.data.mine = Math.max(0, WALL.data.mine - 1);
  WALL.data._sig = ''; wallRender();
}
async function wallModerate(id, action) {
  const j = await WALL_ENV.post('/wall-mod', { post: id, action }).catch(() => null);
  if (!j || !j.ok) return wallToast('تعذّر التنفيذ', 'bad');
  WALL.data._sig = ''; await wallLoad();
}
/* 📽️ وضع العرض: ملء الشاشة وبطاقات أكبر بلا أزرار الإدارة — للبروجكتر في الفصل */
function wallProjector() {
  const on = !document.documentElement.classList.contains('wall-proj');
  document.documentElement.classList.toggle('wall-proj', on);
  try { if (on) document.getElementById('wall-ov').requestFullscreen?.(); else if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.documentElement.classList.remove('wall-proj'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && WALL.cur && !document.getElementById('wall-comp') && !document.fullscreenElement) wallClose(); });

/* ═══ إضافة منشور: نص · صور/فيديو/PDF (حتى 4) · رابط (يوتيوب يظهر بصورته) ═══ */
const WALL_COMP = { files: [] };
function wallCompose() {
  if (document.getElementById('wall-comp')) return;
  WALL_COMP.files = [];
  const box = document.createElement('div'); box.id = 'wall-comp'; box.className = 'wall-comp';
  box.innerHTML = `<div class="wc-sheet">
    <h3>＋ ${WALL_ENV.teacher ? 'منشور جديد' : 'شارك إبداعك'} — ${wallEsc(WALL.data.wall.title)}</h3>
    <textarea id="wcp-t" rows="4" maxlength="1000" placeholder="اكتب فكرتك أو وصف عملك…"></textarea>
    <input id="wcp-l" type="url" inputmode="url" maxlength="400" placeholder="رابط (اختياري) — مثل فيديو يوتيوب" dir="ltr">
    <div class="wcp-files"><button type="button" class="wall-btn" onclick="document.getElementById('wcp-f').click()">📎 صور / فيديو / PDF</button>
      <input id="wcp-f" type="file" multiple accept="image/*,video/*,application/pdf,.pdf" hidden><span class="wcp-hint">حتى 4 ملفات · الفيديو حتى 300MB</span></div>
    <div id="wcp-list" class="wcp-list"></div>
    <div id="wcp-prog" class="wcp-prog hide"><i></i><span></span></div>
    <div class="wcp-acts"><button type="button" class="wall-btn" onclick="wallComposeClose()">إلغاء</button><button type="button" class="wall-btn main" id="wcp-go" onclick="wallSend()">نشر ✓</button></div>
  </div>`;
  document.getElementById('wall-ov').appendChild(box);
  document.getElementById('wcp-f').onchange = e => { wallPick(e.target.files); e.target.value = ''; };
  setTimeout(() => document.getElementById('wcp-t')?.focus(), 50);
}
function wallComposeClose() { if (WALL.sending) return; document.getElementById('wall-comp')?.remove(); }
function wallPick(list) {
  for (const f of list) {
    if (WALL_COMP.files.length >= 4) { wallToast('حتى 4 ملفات للمنشور', 'bad'); break; }
    const t = String(f.type || ''), ok = t.startsWith('image/') || t.startsWith('video/') || t === 'application/pdf' || /\.(pdf|mp4|mov|m4v|webm|jpe?g|png|webp|gif|heic)$/i.test(f.name);
    if (!ok) { wallToast('المسموح صور أو فيديو أو PDF', 'bad'); continue; }
    const vid = t.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(f.name);
    if (f.size > (vid ? 300 : 20) * 1048576) { wallToast(`${f.name}: أكبر من ${vid ? 300 : 20}MB`, 'bad'); continue; }
    WALL_COMP.files.push(f);
  }
  document.getElementById('wcp-list').innerHTML = WALL_COMP.files.map((f, i) => `<span class="wcp-chip">${String(f.type).startsWith('image/') ? '🖼️' : String(f.type).startsWith('video/') ? '🎥' : '📄'} ${wallEsc(f.name)} <small>${wallSize(f.size)}</small><button type="button" onclick="WALL_COMP.files.splice(${i},1);wallPick([])" aria-label="إزالة">×</button></span>`).join('');
}
// رفع ملف على أجزاء 10MB مباشرة إلى R2 (نفس مسار تسليم المشاريع)، كل جزء يُعاد حتى 3 مرات
async function wallUpload(f, onBytes) {
  const st = await WALL_ENV.post('/file-up/start', { wall: WALL.cur, fname: f.name, type: f.type || '', size: f.size });
  if (!st || !st.ok) throw new Error((st && st.error) || 'upload');
  const api = WALL_ENV.api(), ps = st.partSize || 10485760, parts = [];
  try {
    for (let n = 1, off = 0; off < f.size; n++, off += ps) {
      const chunk = f.slice(off, Math.min(f.size, off + ps)); let j = null;
      for (let t = 0; t < 3 && !(j && j.ok); t++) {
        if (t) await new Promise(r => setTimeout(r, 1500 * t));
        try { const r = await fetch(`${api}/file-up/part?u=${encodeURIComponent(st.uploadId)}&n=${n}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: chunk }); j = await r.json().catch(() => null); } catch (e) { j = null; }
      }
      if (!(j && j.ok)) throw new Error('upload');
      parts.push({ partNumber: j.partNumber, etag: j.etag }); onBytes(chunk.size);
    }
    const d = await fetch(api + '/file-up/done', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ u: st.uploadId, parts }) }).then(r => r.json()).catch(() => ({}));
    if (!d.ok) throw new Error(d.error || 'upload');
    return st.uploadId;
  } catch (e) { fetch(api + '/file-up/abort', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ u: st.uploadId }) }).catch(() => {}); throw e; }
}
async function wallSend() {
  if (WALL.sending) return;
  const text = document.getElementById('wcp-t').value.trim(), link = document.getElementById('wcp-l').value.trim();
  if (!text && !link && !WALL_COMP.files.length) return wallToast('اكتب شيئًا أو أرفق ملفًا', 'bad');
  if (link && !/^https?:\/\/\S+$/i.test(link)) return wallToast('الرابط يبدأ بـ https://', 'bad');
  const go = document.getElementById('wcp-go'), prog = document.getElementById('wcp-prog');
  WALL.sending = true; go.disabled = true;
  try {
    const files = [];
    for (const f of WALL_COMP.files) files.push(WALL_ENV.compress ? await WALL_ENV.compress(f) : f);
    const total = files.reduce((a, f) => a + f.size, 0); let done = 0; const pre = [];
    if (files.length) prog.classList.remove('hide');
    for (const f of files) pre.push(await wallUpload(f, n => { done += n; prog.querySelector('i').style.width = Math.round(done / total * 100) + '%'; prog.querySelector('span').textContent = `${wallSize(done)} من ${wallSize(total)}`; }));
    const j = await WALL_ENV.post('/wall-post', { wall: WALL.cur, text, link, pre });
    if (!j || !j.ok) {
      const e = j && j.error;
      throw new Error(e === 'max_posts' ? `وصلت للحد (${j.max} منشورات) لهذا الحائط` : e === 'wall_closed' ? 'أغلق المعلم النشر في هذا الحائط' : e === 'auth_cancel' ? 'أدخل رمزك السري لتنشر' : 'تعذّر النشر — حاول مرة أخرى');
    }
    WALL.sending = false; document.getElementById('wall-comp')?.remove();
    wallToast(j.status === 'pending' ? '✅ وصل منشورك — يظهر لزملائك بعد اعتماد المعلم' : '✅ نُشر إبداعك على الحائط', 'good');
    WALL.data._sig = ''; await wallLoad();
  } catch (e) {
    wallToast(e.message && !/^upload|^[a-z_]+$/.test(e.message) ? e.message : 'تعذّر رفع الملف — تحقق من الإنترنت', 'bad');
  } finally { WALL.sending = false; if (go) go.disabled = false; }
}
