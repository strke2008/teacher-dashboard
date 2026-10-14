'use strict';
/* 🧭 نافس في بوابة الطالب — التدريب والمحاكاة وخريطة النواتج
   🎯 تدريب (الافتراضي): «تحقّق» بعد كل سؤال ← ✓/✗ مع الإجابة الصحيحة وتوضيحها، ومحاولة ثانية إن أخطأ
      (يُشطب الخيار الخطأ). المُرسل للخادم هو أول جواب لكل سؤال فيبقى القياس صادقًا.
   ⏱️ محاكاة: مؤقت للاختبار كله وبلا تغذية حتى التسليم، والتسليم تلقائي عند انتهاء الوقت.
   في الوضعين: المراجعة تُفتح فور التسليم، وبطاقة نتيجة حسب النواتج، و«تدرّب على أخطائك» أو «أعد التدريب»
   — جولات تدريب محلية لا تُرسل ولا تغيّر الدرجة.
   🗺️ خريطة نواتجي في خانة «نافس»: إتقانه لكل ناتج من أول تسليم في كل نشاط نافس، و«تدرّب» على الناتج. */
const NF = { on: false, mode: 'train', st: {}, first: {}, struck: {}, fb: {}, practice: false, lastQ: null, lastMarks: null, deadline: 0, timer: 0, rows: null };
const nfIs = h => !!(h && !h.remedial && !h.personalRemedial && Array.isArray(h.q) && (Number(h.nf) === 1 || h.q.some(q => q && q.nafs)));
const nfTrain = () => NF.on && NF.mode === 'train';
const nfShort = k => String(k || '').replace(/^نافس:\s*/, '').trim() || 'أسئلة عامة';
const nfClone = v => v == null ? v : JSON.parse(JSON.stringify(v));

/* ── بدء الحل ── */
const _nfStartSolving = startSolving;
startSolving = function () {
  NF.on = nfIs(HW); NF.mode = HW && HW.nm === 'sim' && !NF.practice ? 'sim' : 'train';
  NF.st = {}; NF.first = {}; NF.struck = {}; NF.fb = {};
  if (NF.on) idx = 0;      // جولة تدريب جديدة تبدأ من أول سؤال
  _nfStartSolving();
  nfTimerStart();
};
/* جولة التدريب لا تبدأ قياس الزمن في الخادم (لا تسليم بعدها) */
const _nfPaceStart = paceStartServer;
paceStartServer = function () { if (NF.practice) return; return _nfPaceStart(); };

/* ── عرض السؤال: الخيارات المشطوبة، قفل السؤال بعد حسمه، صندوق التغذية ── */
function nfBox() {
  let b = $('nf-fb');
  if (!b) { const body = $('q-body'); if (!body) return null; body.insertAdjacentHTML('afterend', '<div id="nf-fb" class="hide"></div>'); b = $('nf-fb'); }
  return b;
}
const _nfRender = render;
render = function () { _nfRender(); try { nfDecorate(); } catch (e) { console.warn('nf', e); } };
function nfDecorate() {
  const box = nfBox(); if (!box) return;
  if (!NF.on || !HW || !HW.q || !HW.q[idx]) { box.className = 'hide'; box.innerHTML = ''; return; }
  const q = HW.q[idx], k = q.t || 'q', st = NF.st[idx], B = $('q-body');
  (NF.struck[idx] || []).forEach(i => { const b = B.querySelector(`.opt[data-i="${i}"]`); if (b) { b.disabled = true; b.classList.add('nf-x'); } });
  if (!nfTrain()) { box.className = 'hide'; box.innerHTML = ''; return; }
  if (st === 'done') {
    B.querySelectorAll('button,input').forEach(e => { e.disabled = true; });
    if (k === 'q') {
      const ok = B.querySelector(`.opt[data-i="${q.a}"]`); if (ok) ok.classList.add('nf-ok');
      if (ans[idx] !== q.a && ans[idx] != null) { const bad = B.querySelector(`.opt[data-i="${ans[idx]}"]`); if (bad) bad.classList.add('nf-bad'); }
    } else if (k === 'tf') {
      const ok = B.querySelector(`[data-v="${q.a ? 1 : 0}"]`); if (ok) ok.classList.add('nf-ok');
      if (ans[idx] !== !!q.a) { const bad = B.querySelector(`[data-v="${ans[idx] ? 1 : 0}"]`); if (bad) bad.classList.add('nf-bad'); }
    }
    box.className = 'nf-fb ' + (NF.fb[idx] && NF.fb[idx].ok ? 'ok' : 'bad'); box.innerHTML = NF.fb[idx] ? NF.fb[idx].html : '';
    return;
  }
  const concept = q.nfo || (q.skill ? 'هذا السؤال يقيس: ' + nfShort(q.skill) : '');
  if (st === 'tried1') {
    box.className = 'nf-fb try';
    box.innerHTML = `<b>✗ ليست الإجابة الصحيحة — فكّر مرة أخرى</b>${concept ? `<div class="nf-concept">💡 ${esc(concept)}</div>` : ''}<small>لديك محاولة ثانية. ${k === 'q' ? 'شطبنا اختيارك السابق.' : ''}</small>`;
    return;
  }
  box.className = 'nf-fb idle';
  box.innerHTML = concept ? `<button type="button" class="nf-cbtn" onclick="this.nextElementSibling.classList.toggle('hide')">💡 ذكّرني بالمفهوم</button><div class="nf-concept hide">${esc(concept)}</div>` : '';
}
function nfFeedback(q, ok, second) {
  const head = ok ? (second ? '👍 أحسنت — صحيحة في المحاولة الثانية' : '✅ إجابة صحيحة!') : `❌ الإجابة الصحيحة: <b>${esc(rightAnswer(q))}</b>`;
  return { ok, html: `<b>${head}</b>${q.nfn ? `<div class="nf-note">ℹ️ ${esc(q.nfn)}</div>` : ''}${q.nfo ? `<div class="nf-concept">🎯 ${esc(q.nfo)}</div>` : ''}` };
}

/* ── «تحقّق» قبل «التالي» في وضع التدريب ── */
function nfGate() {
  if (!nfTrain() || !ready() || paceLeftMs() > 0) return false;
  const st = NF.st[idx]; if (st === 'done') return false;
  const q = HW.q[idx], k = q.t || 'q', ok = grade(q, ans[idx], built[idx]);
  if (st === undefined) NF.first[idx] = nfClone(ans[idx]);      // أول جواب = المحتسب
  const left = k === 'q' ? (q.o || []).length - (NF.struck[idx] || []).length - (hintUsed[idx] || []).length : 0;
  if (st === undefined && !ok && ((k === 'q' && left > 2) || k === 'f')) {
    if (k === 'q') { (NF.struck[idx] = NF.struck[idx] || []).push(ans[idx]); ans[idx] = null; }
    NF.st[idx] = 'tried1'; render(); return true;
  }
  NF.st[idx] = 'done'; NF.fb[idx] = nfFeedback(q, ok, st === 'tried1'); render(); return true;
}
{ const nb = $('q-next'), orig = nb && nb.onclick; if (nb && orig) nb.onclick = e => { if (nfGate()) return; return orig(e); }; }
const _nfPaceTick = paceTick;
paceTick = function () {
  _nfPaceTick();
  const b = $('q-next');
  if (b && nfTrain() && HW && HW.q && NF.st[idx] !== 'done' && paceLeftMs() <= 0) b.textContent = NF.st[idx] === 'tried1' ? '✓ تحقّق مرة أخرى' : '✓ تحقّق من إجابتك';
};

/* ── مؤقت المحاكاة ── */
function nfTimerStart() {
  nfTimerStop();
  let t = $('nf-timer');
  if (!(NF.on && NF.mode === 'sim')) { if (t) t.classList.add('hide'); return; }
  if (!t) { const p = document.querySelector('#s-quiz .prog'); if (p) { p.insertAdjacentHTML('beforebegin', '<div id="nf-timer" class="nf-timer"></div>'); t = $('nf-timer'); } }
  NF.deadline = Date.now() + Math.max(30, Number(HW.nt) || 90) * HW.q.length * 1000;
  const tick = () => {
    const left = Math.max(0, NF.deadline - Date.now()), m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
    if (t) { t.classList.remove('hide'); t.classList.toggle('low', left < 60000); t.textContent = `⏱️ الوقت المتبقي ${m}:${String(s).padStart(2, '0')} · محاكاة نافس`; }
    if (!left) { nfTimerStop(); if (!$('s-quiz').classList.contains('hide')) { toast('⏰ انتهى الوقت — سُلّمت إجاباتك', 'bad'); finish(); } }
  };
  tick(); NF.timer = setInterval(tick, 1000);
}
function nfTimerStop() { clearInterval(NF.timer); NF.timer = 0; const t = $('nf-timer'); if (t) t.classList.add('hide'); }

/* ── التسليم: أول جواب يُرسل، المراجعة فورية، بطاقة النواتج، جولات التدريب ── */
const _nfReviewOpen = reviewOpenNow;
reviewOpenNow = function () { return NF.on || _nfReviewOpen(); };
const _nfFinish = finish;
finish = function () {
  if (!NF.on) { const x = $('nf-done'); if (x) x.remove(); return _nfFinish(); }
  nfTimerStop();
  Object.keys(NF.first).forEach(i => { ans[i] = nfClone(NF.first[i]); });
  const marks = HW.q.map((q, i) => grade(q, ans[i], built[i]));
  NF.lastQ = HW.q.slice(); NF.lastMarks = marks;
  if (NF.practice) { nfPracticeDone(marks); return Promise.resolve(); }
  const p = _nfFinish();
  nfDoneCard(marks);
  return p;
};
function nfSkillStats(qs, marks) {
  const by = {};
  qs.forEach((q, i) => { const k = nfShort(q.skill); const o = by[k] || (by[k] = { c: 0, t: 0 }); o.t++; if (marks[i]) o.c++; });
  return Object.entries(by).map(([k, v]) => ({ k, ...v, p: Math.round(v.c / v.t * 100) })).sort((a, b) => a.p - b.p);
}
const nfIcon = p => p >= 80 ? '✅' : p >= 50 ? '↗️' : '⚠️';
function nfDoneCard(marks, practice) {
  let box = $('nf-done');
  // مباشرة تحت بطاقة النتيجة — قبل المتجر والمراجعة
  if (!box) { const anchor = $('store-box') || $('review'); anchor.insertAdjacentHTML('beforebegin', '<div id="nf-done"></div>'); box = $('nf-done'); }
  const rows = nfSkillStats(HW.q, marks), wrong = marks.filter(m => !m).length, weak = rows.filter(r => r.p < 80);
  box.innerHTML = `<div class="sheet nf-card">
    <h3>🧭 نتيجتك حسب نواتج التعلم${practice ? ' <small>(جولة تدريب)</small>' : ''}</h3>
    <div class="nf-rows">${rows.map(r => `<div class="nf-row"><span>${nfIcon(r.p)} ${esc(r.k)}</span><i><b style="width:${r.p}%" class="${r.p >= 80 ? 'g' : r.p >= 50 ? 'y' : 'r'}"></b></i><em>${r.c} من ${r.t}</em></div>`).join('')}</div>
    ${weak.length ? `<p class="nf-focus">🎯 ركّز على: <b>${weak.slice(0, 3).map(r => esc(r.k)).join('، ')}</b></p>` : '<p class="nf-focus">🌟 أتقنت كل النواتج في هذا التدريب!</p>'}
    <div class="nf-acts">
      ${wrong ? `<button type="button" class="btn tick" onclick="nfPractice(true)">🔁 تدرّب على أخطائك (${wrong})</button>` : ''}
      <button type="button" class="btn ghost" onclick="nfPractice(false)">🔄 أعد التدريب كاملًا</button>
      ${practice ? '<button type="button" class="btn ghost" onclick="location.reload()">↩️ رجوع لأنشطتي</button>' : ''}
    </div>
    <small class="muted">جولات التدريب لا تُرسل للمعلم ولا تغيّر درجتك — المحتسب أول تسليم.</small></div>`;
}
function nfShuffleQ(q) {
  if ((q.t || 'q') !== 'q' || !Array.isArray(q.o)) return { ...q };
  const order = shuffle(q.o.map((_, i) => i));
  return { ...q, o: order.map(i => q.o[i]), a: order.indexOf(q.a) };
}
function nfPractice(onlyWrong) {
  const src = NF.lastQ || HW.q, marks = NF.lastMarks || [];
  const set = (onlyWrong ? src.filter((q, i) => !marks[i]) : src).map(nfShuffleQ);
  if (!set.length) return;
  NF.practice = true;
  HW = { ...HW, q: shuffle(set), nm: 'train', nf: 1 };
  hide('s-done'); const x = $('nf-done'); if (x) x.innerHTML = '';
  try { $('bar-title').textContent = '🎯 تدريب نافس'; } catch (e) {}
  startSolving();
}
function nfPracticeDone(marks) {
  const c = marks.filter(Boolean).length, t = HW.q.length;
  hide('s-quiz'); show('s-done');
  $('done-name').textContent = myName || '';
  $('done-score').textContent = `${c}/${t}`;
  $('done-line').textContent = 'جولة تدريب — لا تُرسل للمعلم ولا تؤثر في درجتك';
  $('sent-line').textContent = '';
  try { hide('code-wrap'); } catch (e) {}
  renderReview(marks);
  nfDoneCard(marks, true);
}

/* ── 🗺️ خريطة نواتجي (أعلى خانة «نافس» في الرحلة) ── */
function nfMapStats(rows) {
  const by = {};
  (rows || []).filter(r => Array.isArray(r.nk)).forEach(r => {
    const d = String(r.nd || '');
    r.nk.forEach((k, i) => { if (!k) return; const s = nfShort(k); const o = by[s] || (by[s] = { k, c: 0, t: 0, acts: new Set() }); o.acts.add(r.id);
      if (d[i] === '1' || d[i] === '0') { o.t++; if (d[i] === '1') o.c++; } });
  });
  return Object.entries(by).map(([s, v]) => ({ s, ...v, p: v.t ? Math.round(v.c / v.t * 100) : null }))
    .sort((a, b) => (a.p == null ? 101 : a.p) - (b.p == null ? 101 : b.p));
}
function nfMapHTML(rows) {
  const st = nfMapStats(rows); if (!st.length) return '';
  const done = st.filter(x => x.p != null), mast = done.filter(x => x.p >= 80).length;
  const cls = x => x.p == null ? 'n' : x.p >= 80 ? 'g' : x.p >= 50 ? 'y' : 'r';
  return `<div class="nf-map"><div class="nf-map-h"><b>🗺️ خريطة نواتجي</b><span>${mast} من ${st.length} ناتج متقن</span></div>
    <div class="nf-map-l">${st.map((x, i) => `<button type="button" class="nf-tile ${cls(x)}" onclick="nfPracticeSkill(${i})" title="${esc(x.s)}">
      <b>${esc(x.s)}</b><small>${x.p == null ? 'لم تتدرّب عليه بعد' : `${x.p}% · ${x.c} من ${x.t}`}</small><em>🔁 تدرّب</em></button>`).join('')}</div>
    <small class="muted">🟩 متقن ٨٠٪+ · 🟨 قريب · 🟥 يحتاج تدريبًا · ⬜ لم تتدرّب عليه. اضغط ناتجًا لتتدرّب على أسئلته (لا تُحتسب).</small></div>`;
}
async function nfPracticeSkill(i) {
  const st = nfMapStats(NF.rows)[i]; if (!st) return;
  const api = (API || '').replace(/\/+$/, ''); if (!api) return;
  toast('⏳ نجهّز أسئلة التدريب…');
  const seen = new Set(), qs = []; let base = null;
  for (const id of st.acts) {
    try { const r = await fetch(api + '/hw?id=' + encodeURIComponent(id), { cache: 'no-store' }); if (!r.ok) continue; const h = await r.json(); base = base || h;
      (h.q || []).forEach(q => { if (q && q.skill === st.k && !seen.has(q.nafs || q.q)) { seen.add(q.nafs || q.q); qs.push(q); } }); } catch (e) {}
  }
  if (!qs.length || !base) { toast('تعذّر تحميل الأسئلة — تحقّق من الاتصال', 'bad'); return; }
  NF.practice = true; NF.lastQ = null; NF.lastMarks = null;
  HW = { ...base, id: base.id, t: '🎯 تدريب: ' + st.s, q: shuffle(qs.map(nfShuffleQ)), nf: 1, nm: 'train', p: 0 };
  ['s-gate', 's-pre', 's-done'].forEach(s => { try { hide(s); } catch (e) {} });
  try { $('bar-title').textContent = '🎯 تدريب: ' + st.s; } catch (e) {}
  startSolving();
}
const _nfOpenJL = openJourneyLearning;
openJourneyLearning = function (nm, rows, kinds) {
  const r = _nfOpenJL(nm, rows, kinds);
  if (Array.isArray(kinds) && kinds.length === 1 && kinds[0] === 'nafs') {
    NF.rows = rows;
    const c = $('journey-workspace-content'), html = nfMapHTML(rows);
    if (c && html) c.insertAdjacentHTML('afterbegin', html);
  }
  return r;
};
