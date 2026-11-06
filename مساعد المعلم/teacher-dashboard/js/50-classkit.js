/* ═══════════ 🧰 أدوات الحصة — داخل «الرصد» (زر واحد في شريطه، والأدوات في لوحة فوقه لا تمس صفحة الرصد) ═══════════
   🎯 مين يجاوب: اختيار عشوائي من الحاضرين، بلا تكرار حتى يمر الجميع (لكل فصل في اليوم)، ورصد مشاركته بلمسة.
   ⏱️ مؤقت: دقائق جاهزة أو مخصّصة، عدّ تنازلي كبير، وتنبيه بصوت واهتزاز — ويبقى ظاهرًا صغيرًا إن أُغلقت اللوحة.
   👥 مجموعات: عشوائية أو متوازنة بالمستوى (توزيع الأفعى)، من الحاضرين فقط.
   ويستدعيها «مساعدي» بالكلام أيضًا («مين يجاوب؟»، «شغّل مؤقت ٥ دقايق»، «قسّم أول ١ أربع مجموعات»). */
const CK = { tab: 'pick', cls: '', last: '', spin: 0, groups: null, gN: 4, gMode: 'mix', tEnd: 0, tLeft: 0, tTotal: 0, tRun: false, tInt: 0 };
const ckCls = () => CK.cls || (typeof qrCls === 'function' ? qrCls() : '') || '';
function ckRoster(cls) {   // الحاضرون (الغائب اليوم لا يُختار)
  const d = typeof ctToday === 'function' ? ctToday() : '', P = (typeof CT_DATA !== 'undefined' && CT_DATA && CT_DATA.participation && CT_DATA.participation[d]) || {};
  return (typeof ctRoster === 'function' ? ctRoster(cls) : []).filter(s => !/^غائب/.test(String((P[String(s.id)] || {}).status || '')));
}
const ckKey = cls => 'ck_picked_' + (typeof ctToday === 'function' ? ctToday() : '') + '_' + cls;
function ckPicked(cls) { try { return new Set(JSON.parse(localStorage.getItem(ckKey(cls)) || '[]')); } catch (e) { return new Set(); } }
function ckSavePicked(cls, S) { try { localStorage.setItem(ckKey(cls), JSON.stringify([...S])); } catch (e) {} }

function ckOpen(tab, cls) {
  if (tab) CK.tab = tab; if (cls) CK.cls = cls; else if (!CK.cls) CK.cls = ckCls();
  let o = document.getElementById('ck'); if (!o) { o = document.createElement('div'); o.id = 'ck'; o.className = 'ck no-print'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'أدوات الحصة'); document.body.appendChild(o);
    o.addEventListener('click', e => { if (e.target === o) ckClose(); }); }
  o.classList.add('on'); ckPaint();
}
function ckClose() { const o = document.getElementById('ck'); if (o) o.classList.remove('on'); CK.cls = ''; ckPill(); }
function ckPaint() {
  const o = document.getElementById('ck'); if (!o || !o.classList.contains('on')) return; const cls = ckCls(), R = ckRoster(cls);
  const tabs = [['pick', '🎯 مين يجاوب'], ['timer', '⏱️ مؤقت'], ['groups', '👥 مجموعات']];
  let body = '';
  if (CK.tab === 'pick') { const P = ckPicked(cls), left = R.filter(s => !P.has(String(s.id))).length, s = R.find(x => String(x.id) === CK.last);
    body = `<div class="ck-big ${CK.spin ? 'spin' : ''}" id="ck-name">${s ? esc(s.name) : '<span class="ck-hint">اضغط «اختر» 🎯</span>'}</div>
      <div class="ck-meta">${R.length ? `بقي ${left} من ${R.length} حاضر لم يُختاروا اليوم` : 'لا طلاب حاضرون في هذا الفصل'}</div>
      <div class="ck-row"><button type="button" class="btn tick ck-go" onclick="ckPick()" ${R.length ? '' : 'disabled'}>🎯 اختر</button>${P.size ? '<button type="button" class="btn ghost sm" onclick="ckResetPicked()">↺ من جديد</button>' : ''}</div>
      ${s && typeof qrSet === 'function' ? `<div class="ck-row ck-rec"><span>ارصد له:</span><button type="button" class="btn sm tick" onclick="ckRec('شارك')">✅ شارك</button><button type="button" class="btn sm ghost" onclick="ckRec('لم يشارك')">✋ لم يشارك</button></div>` : ''}`; }
  else if (CK.tab === 'timer') { const left = ckLeft();
    body = `<div class="ck-big ck-time ${CK.tRun && left <= 10 ? 'warn' : ''} ${CK.tEnd && !left && CK.tTotal ? 'done' : ''}" id="ck-time">${ckFmt(left || (CK.tRun ? 0 : CK.tTotal))}</div>
      <div class="ck-row">${[1, 2, 3, 5, 10, 15].map(m => `<button type="button" class="btn sm ${CK.tTotal === m * 60 ? 'tick' : 'ghost'}" onclick="ckTimer(${m * 60})">${m} د</button>`).join('')}</div>
      <div class="ck-row">${CK.tTotal ? (CK.tRun ? '<button type="button" class="btn ghost" onclick="ckPause()">⏸ إيقاف مؤقت</button>' : `<button type="button" class="btn tick" onclick="ckResume()">▶ ${CK.tLeft && CK.tLeft < CK.tTotal ? 'كمّل' : 'ابدأ'}</button>`) + '<button type="button" class="btn ghost sm" onclick="ckStop()">↺ إعادة</button>' : '<span class="ck-hint">اختر المدة</span>'}</div>`; }
  else { const G = CK.groups && CK.groups.cls === cls ? CK.groups.list : null;
    body = `<div class="ck-row">عدد المجموعات: ${[2, 3, 4, 5, 6].map(n => `<button type="button" class="btn sm ${CK.gN === n ? 'tick' : 'ghost'}" onclick="CK.gN=${n};ckGroups()">${n}</button>`).join('')}</div>
      <div class="ck-row"><button type="button" class="btn sm ${CK.gMode === 'mix' ? 'tick' : 'ghost'}" onclick="CK.gMode='mix';ckGroups()">⚖️ متوازنة بالمستوى</button><button type="button" class="btn sm ${CK.gMode === 'rand' ? 'tick' : 'ghost'}" onclick="CK.gMode='rand';ckGroups()">🔄 عشوائية</button></div>
      ${G ? `<div class="ck-groups">${G.map((g, i) => `<div class="ck-g"><b>المجموعة ${i + 1} <small>(${g.length})</small></b>${g.map(s => `<span>${esc(s.name)}</span>`).join('')}</div>`).join('')}</div>
        <div class="ck-row"><button type="button" class="btn ghost sm" onclick="ckGroups()">🔄 وزّع من جديد</button><button type="button" class="btn ghost sm" onclick="ckGroupsCopy()">📋 نسخ</button></div>` : `<div class="ck-hint">${R.length ? 'اختر العدد لتظهر المجموعات' : 'لا طلاب حاضرون'}</div>`}`; }
  o.innerHTML = `<div class="ck-box"><div class="ck-h"><b>🧰 أدوات الحصة</b><span class="ck-cls">${esc(cls || 'كل الفصول')}</span><button type="button" class="ck-x" onclick="ckClose()" aria-label="إغلاق">✕</button></div>
    <div class="ck-tabs">${tabs.map(([k, l]) => `<button type="button" class="${CK.tab === k ? 'on' : ''}" onclick="CK.tab='${k}';ckPaint()">${l}</button>`).join('')}</div><div class="ck-b">${body}</div></div>`;
}
/* 🎯 الاختيار */
function ckPick(cls) {
  cls = cls || ckCls(); const R = ckRoster(cls); if (!R.length) return null; let P = ckPicked(cls); let pool = R.filter(s => !P.has(String(s.id)));
  if (!pool.length) { P = new Set(); pool = R; }
  const s = pool[Math.floor(Math.random() * pool.length)]; P.add(String(s.id)); ckSavePicked(cls, P); CK.last = String(s.id);
  const e = document.getElementById('ck-name'); if (e && CK.tab === 'pick') { CK.spin = 1; let n = 0; const roll = setInterval(() => { e.textContent = R[Math.floor(Math.random() * R.length)].name; if (++n > 9) { clearInterval(roll); CK.spin = 0; ckPaint(); } }, 70); }
  else ckPaint();
  try { navigator.vibrate && navigator.vibrate(30); } catch (e) {}
  return s;
}
function ckResetPicked() { ckSavePicked(ckCls(), new Set()); CK.last = ''; ckPaint(); }
function ckRec(st) { if (!CK.last || typeof qrSet !== 'function') return; qrSet('participation', CK.last, st); toast('✓ ' + st, 'good'); }
/* ⏱️ المؤقت */
const ckFmt = s => { s = Math.max(0, Math.round(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const ckLeft = () => CK.tRun ? Math.max(0, (CK.tEnd - Date.now()) / 1000) : CK.tLeft;
function ckTimer(sec) { CK.tTotal = sec; CK.tLeft = sec; CK.tRun = false; ckResume(); }
function ckResume() { if (!CK.tTotal) return; CK.tEnd = Date.now() + (CK.tLeft || CK.tTotal) * 1000; CK.tRun = true; clearInterval(CK.tInt); CK.tInt = setInterval(ckTick, 250); ckPaint(); ckPill(); }
function ckPause() { CK.tLeft = ckLeft(); CK.tRun = false; clearInterval(CK.tInt); ckPaint(); ckPill(); }
function ckStop() { CK.tRun = false; CK.tLeft = CK.tTotal; CK.tEnd = 0; clearInterval(CK.tInt); ckPaint(); ckPill(); }
function ckTick() {
  const left = ckLeft(), e = document.getElementById('ck-time'); if (e) { e.textContent = ckFmt(left); e.classList.toggle('warn', left <= 10); }
  const p = document.getElementById('ck-pill'); if (p) p.querySelector('b').textContent = ckFmt(left);
  if (left <= 0) { CK.tRun = false; CK.tLeft = 0; clearInterval(CK.tInt); ckRing(); ckPaint(); ckPill(true); }
}
function ckRing() {   // تنبيه: ثلاث نغمات + اهتزاز (بلا ملفات)
  try { navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 500]); } catch (e) {}
  try { const C = new (window.AudioContext || window.webkitAudioContext)(); [0, 0.35, 0.7].forEach((t, i) => { const o = C.createOscillator(), g = C.createGain(); o.frequency.value = i === 2 ? 1046 : 880; o.connect(g); g.connect(C.destination);
    g.gain.setValueAtTime(0.0001, C.currentTime + t); g.gain.exponentialRampToValueAtTime(0.4, C.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, C.currentTime + t + 0.3); o.start(C.currentTime + t); o.stop(C.currentTime + t + 0.32); });
    setTimeout(() => C.close().catch(() => {}), 1500); } catch (e) {}
  toast('⏱️ انتهى الوقت!', 'good');
}
function ckPill(ended) {   // المؤقت صغيرًا في الزاوية إن أُغلقت اللوحة
  let p = document.getElementById('ck-pill'); const open = document.getElementById('ck') && document.getElementById('ck').classList.contains('on');
  if ((!CK.tRun && !ended) || open) { if (p) p.remove(); return; }
  if (!p) { p = document.createElement('button'); p.type = 'button'; p.id = 'ck-pill'; p.className = 'ck-pill no-print'; p.onclick = () => ckOpen('timer'); document.body.appendChild(p); }
  p.classList.toggle('done', !!ended); p.innerHTML = `⏱️ <b>${ckFmt(ckLeft())}</b>`; if (ended) setTimeout(() => { const q = document.getElementById('ck-pill'); if (q && !CK.tRun) q.remove(); }, 8000);
}
/* 👥 المجموعات */
function ckGroups(n, mode, cls) {
  cls = cls || ckCls(); n = Math.max(2, Math.min(10, Number(n) || CK.gN)); mode = mode || CK.gMode; CK.gN = n; CK.gMode = mode;
  const R = ckRoster(cls).slice(), rate = s => { try { const g = typeof ctG === 'function' ? ctG(s.id) : {}; return Number((g.level || {}).rate); } catch (e) { return NaN; } };
  for (let i = R.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [R[i], R[j]] = [R[j], R[i]]; }
  if (mode === 'mix') R.sort((a, b) => (Number.isFinite(rate(b)) ? rate(b) : 50) - (Number.isFinite(rate(a)) ? rate(a) : 50));
  const G = Array.from({ length: Math.min(n, Math.max(1, R.length)) }, () => []);
  R.forEach((s, i) => { const r = Math.floor(i / G.length), c = i % G.length; G[mode === 'mix' && r % 2 ? G.length - 1 - c : c].push(s); });   // توزيع الأفعى: قوي/ضعيف في كل مجموعة
  CK.groups = { cls, list: G }; ckPaint(); return G;
}
function ckGroupsCopy() { const G = CK.groups && CK.groups.list; if (!G) return; const t = G.map((g, i) => `المجموعة ${i + 1}: ` + g.map(s => s.name).join('، ')).join('\n');
  try { navigator.clipboard.writeText(t).then(() => toast('📋 نُسخت المجموعات', 'good')); } catch (e) {} }
