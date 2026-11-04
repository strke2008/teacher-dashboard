/* ═══════════ ✋ الرصد السريع داخل اللوحة (منقول من بوابة المعلم) ═══════════
   صفحة «السجلات والحضور ← اليوم»: لمسة واحدة لكل طالب (مشاركة/واجب/سلوك)، بحث، رصد بالصوت، «الباقي شارك»، وتراجع.
   📶 لا يضيع رصد: كل لمسة تظهر فورًا وتُحفظ في «طابور» على الجهاز (ct_outbox_v1)، ثم تُرسل في الخلفية:
      أحدث نسخة من الخادم ← تطبيق الطابور ← حفظ — والخادم يدمج كل رصد بوقته (الأحدث يفوز).
      لا تُزال من الطابور إلا بعد تأكيد الخادم؛ وتُعاد المحاولة عند عودة الشبكة والعودة للتطبيق وكل 30 ث.
   البيانات بالشكل نفسه الذي تكتبه البوابة (participation/homework/behavior) — فالدرجات والتقارير لا تتغير. */
const QR = { mode: 'participation', q: '', undo: [], open: '', busy: false, multi: false, sel: new Set() };
const QR_OUT = 'ct_outbox_v1';
const QR_P = [['شارك', '✅', 'g', 'شارك'], ['لم يشارك', '✋', 'y', 'لم يشارك'], ['غائب', '🚫', 'r', 'غائب']];
const QR_H = [['أنجز', '📗', 'g', 'أنجز'], ['لم ينجز', '📕', 'r', 'لم ينجز'], ['معذور', '🕊️', 'y', 'معذور']];

function qrOut() { try { const L = JSON.parse(localStorage.getItem(QR_OUT) || '[]'); return Array.isArray(L) ? L : []; } catch (e) { return []; } }
function qrOutSet(L) { try { if (L.length) localStorage.setItem(QR_OUT, JSON.stringify(L.slice(-2000))); else localStorage.removeItem(QR_OUT); } catch (e) {} }
const qrId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* تطبيق عملية على نسخة بيانات — نفس قواعد البوابة (الغائب «معذور» في واجب يومه، وإلغاء الغياب يعيد ما كان) */
function qrApply(D, op) {
  if (!D || !op) return;
  if (op.k === 'st') {
    D[op.m] = D[op.m] || {}; D[op.m][op.d] = D[op.m][op.d] || {};
    const prev = D[op.m][op.d][op.sid]; if (prev && (Number(prev.at) || 0) > op.at) return;   // أحدث منه موجود: لا يُرجع للخلف
    D[op.m][op.d][op.sid] = { status: op.v, at: op.at, ...(op.x && typeof op.x === 'object' ? op.x : {}) };   // x: forgiven/prev («سامحه»/«سلّمه»)
    if (op.m === 'participation') {
      D.homework = D.homework || {}; D.homework[op.d] = D.homework[op.d] || {};
      const h = D.homework[op.d][op.sid], hs = String(h && h.status || '');
      if (op.v === 'غائب' || op.v === 'غائب بعذر') { if (!hs || hs === 'لم ينجز') D.homework[op.d][op.sid] = { status: 'معذور', at: op.at, auto: true, prev: hs }; }
      else if (h && h.auto) D.homework[op.d][op.sid] = { status: h.prev || '', at: op.at };
    }
  } else if (op.k === 'beh') {
    D.behavior = Array.isArray(D.behavior) ? D.behavior : [];
    if (!D.behavior.some(x => x && String(x.id) === String(op.item.id))) D.behavior.unshift({ ...op.item });
  } else if (op.k === 'behdel') {
    const x = (D.behavior || []).find(b => b && String(b.id) === String(op.id)); if (x && (Number(x.at) || 0) <= op.at) { x.deleted = true; x.at = op.at; }
  } else if (op.k === 'exb') {                                 // 📝 دفتر اختبارات فترة (من «رصد الاختبارات»): دمج مثل الخادم تمامًا
    D.examBooks = D.examBooks && typeof D.examBooks === 'object' ? D.examBooks : {};
    const S = D.examBooks[op.sem] = D.examBooks[op.sem] && typeof D.examBooks[op.sem] === 'object' ? D.examBooks[op.sem] : {};
    S[op.per] = qrMergeBook(S[op.per], op.book);
  } else if (op.k === 'set') {                                 // حقل يُرسل كاملًا (الخادم يأخذ الوارد كما هو): msgFlags · msgq
    if (['msgFlags', 'msgq'].includes(op.f)) D[op.f] = op.v;
  } else if (op.k === 'sch') { D.schedule = op.v;            // 🗓️ الجدول والتذكيرات: يُرسلان كاملين كما في البوابة (الخادم يأخذ الوارد كما هو)
  } else if (op.k === 'rem') { D.reminders = op.v;
  } else if (op.k === 'tpl') {
    D.behaviorTemplates = Array.isArray(D.behaviorTemplates) ? D.behaviorTemplates : [];
    if (!D.behaviorTemplates.some(t => t && t.title === op.item.title && (t.type || 'negative') === op.item.type)) D.behaviorTemplates = [op.item, ...D.behaviorTemplates].slice(0, 500);
  }
}
/* نسخة من mergeExamBooks في worker.js لدفتر واحد: الدرجة الأحدث تفوز، والاختبار المحذوف لا يعود */
function qrMergeBook(ab, bb) {
  ab = ab && typeof ab === 'object' ? ab : {}; bb = bb && typeof bb === 'object' ? bb : {};
  if (ab === bb) return ab;
  const delT = new Map();
  for (const d of [...(Array.isArray(ab.delTests) ? ab.delTests : []), ...(Array.isArray(bb.delTests) ? bb.delTests : [])]) if (d && d.id) { const k = String(d.id); if (!delT.has(k) || (Number(d.at) || 0) > delT.get(k)) delT.set(k, Number(d.at) || 0); }
  const tm = new Map(); for (const t of [...(Array.isArray(ab.tests) ? ab.tests : []), ...(Array.isArray(bb.tests) ? bb.tests : [])]) if (t && t.id && !delT.has(String(t.id))) tm.set(String(t.id), t);
  const order = [...(Array.isArray(bb.tests) ? bb.tests : []), ...(Array.isArray(ab.tests) ? ab.tests : [])].map(t => t && String(t.id)).filter((v, i, a) => v && a.indexOf(v) === i && tm.has(v));
  const scores = {}, add = src => { for (const sid of Object.keys(src || {})) { const by = src[sid] && typeof src[sid] === 'object' ? src[sid] : {}; scores[sid] = scores[sid] || {};
    for (const tid of Object.keys(by)) { const inc = by[tid], prev = scores[sid][tid]; if (prev == null || (Number(inc && inc.at) || 0) >= (Number(prev && prev.at) || 0)) scores[sid][tid] = inc; } } };
  add(ab.scores); add(bb.scores);
  return { ...ab, ...bb, tests: order.map(k => tm.get(k)).slice(0, 100), scores, ...(delT.size ? { delTests: [...delT].map(([id, at]) => ({ id, at })).slice(-200) } : {}) };
}
/* كل قراءة للخادم تُظهر ما في الطابور فوقها — فلا «يرجع» رصدٌ لم يُرسل بعد */
if (typeof ctLoad === 'function') { const _ctLoad = ctLoad; ctLoad = async function () { const D = await _ctLoad(); qrOut().forEach(op => qrApply(D, op)); return D; }; }

function qrDo(ops, label) {
  ops = (Array.isArray(ops) ? ops : [ops]).map(o => ({ id: qrId(), at: Date.now(), ...o }));
  if (!ops.length) return;
  CT_DATA = CT_DATA || {}; let L = qrOut();
  ops.forEach(o => { if (o.k === 'exb') L = L.filter(x => !(x.k === 'exb' && x.sem === o.sem && x.per === o.per)); if (o.k === 'sch' || o.k === 'rem') L = L.filter(x => x.k !== o.k); if (o.k === 'set') L = L.filter(x => !(x.k === 'set' && x.f === o.f)); });   // لقطة الدفتر الأحدث تشمل ما قبلها
  ops.forEach(o => { qrApply(CT_DATA, o); L.push(o); });
  qrOutSet(L); try { window._classroomData = CT_DATA; COMP_GRADES = null; } catch (e) {}
  qrPaint(); qrFlushSoon();
  if (label) toast(label, 'good');
}
let qrT = 0; function qrFlushSoon(ms) { clearTimeout(qrT); qrT = setTimeout(qrFlush, ms || 700); }
async function qrFlush() {
  const L = qrOut(); if (!L.length || QR.busy || !getApi() || !getTok()) { qrStatus(); return; }
  if (navigator.onLine === false) { qrStatus(); return; }
  QR.busy = true; qrStatus();
  try {
    const fresh = await ctLoad();                                // يشمل الطابور كله
    const r = await fetch(ctApi() + '/classroom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: getTok(), data: fresh, clientAt: Date.now() }) });
    if (!r.ok) throw new Error('save ' + r.status);
    const sent = new Set(L.map(o => o.id)), rest = qrOut().filter(o => !sent.has(o.id));
    qrOutSet(rest); rest.forEach(o => qrApply(fresh, o));
    CT_DATA = fresh; try { window._classroomData = fresh; COMP_GRADES = null; if (typeof tdCacheSave === 'function') tdCacheSave(); } catch (e) {}
  } catch (e) {}
  QR.busy = false; qrStatus(); qrPaint();
  if (qrOut().length) qrFlushSoon(20000);
}
addEventListener('online', () => qrFlushSoon(800));
document.addEventListener('visibilitychange', () => { if (!document.hidden) qrFlushSoon(1200); });
setInterval(() => { if (qrOut().length) qrFlush(); }, 30000);
setTimeout(() => { if (qrOut().length) qrFlush(); }, 4000);

function qrStatus() {
  const n = qrOut().length, e = document.getElementById('qr-sync');
  if (!e) return;
  e.className = 'qr-sync ' + (n ? 'p' : 'ok');
  e.textContent = n ? (QR.busy ? `⏳ جارٍ إرسال ${n}…` : `⏳ ${n} بانتظار الإرسال — تُرسل وحدها`) : '✓ محفوظ';
}

/* ── الحصة الحالية من الجدول ── */
function qrLesson() {
  try {
    const D = CT_DATA || {}, k = tdKsaNow(); if (!(k.dow >= 0 && k.dow <= 4)) return null;
    const sc = D.schedule || {}, g = (sc.grid || {})[String(k.dow)] || {}, T = tdTimes(sc).filter(t => g[String(t.n)]);
    const cur = T.find(t => k.min >= t.sm && k.min < t.em), next = T.find(t => t.sm > k.min);
    const t = cur || next; return t ? { ...t, cls: g[String(t.n)], now: !!cur } : null;
  } catch (e) { return null; }
}
const QR_ORD = ['', 'الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة'];

/* ── الصفحة ── */
function qrCls() { return ctValidCls(window._ctRcCls); }
function qrDay() { return window._ctRcD || ctToday(); }
function qrSt(m, sid) { const r = CT_DATA && CT_DATA[m] && CT_DATA[m][qrDay()] && CT_DATA[m][qrDay()][String(sid)]; return String((r && (typeof r === 'string' ? r : r.status)) || ''); }
function qrBehOf(sid) { const d = qrDay(); return ((CT_DATA && CT_DATA.behavior) || []).filter(x => x && !x.deleted && x.date === d && String(x.studentId) === String(sid)); }
function qrDayHTML() {
  const L = qrLesson(), cls = qrCls(), mine = L && L.cls === cls;
  const lesson = L ? `<div class="qr-lesson"><span class="dot">${L.now ? '🟢' : '⏭️'}</span><div><b>الحصة ${QR_ORD[L.n] || L.n} · <bdi>${esc(L.cls)}</bdi></b><small>${L.now ? 'جارية الآن' : 'القادمة'} · ${L.s} – ${L.e} · من جدولك</small></div>
      ${mine ? '' : `<button type="button" class="x" onclick="window._ctRcCls='${esc(L.cls)}';window._ctRcClsUser=1;window._ctRcD=ctToday();renderClassTools()">ارصدها</button>`}</div>` : '';
  return `${lesson}<div id="qr-root" class="qr"></div>`;
}
function qrRowsHTML() {
  const cls = qrCls(), roster = ctRoster(cls), m = QR.mode, q = QR.q.trim();
  const opts = m === 'homework' ? QR_H : QR_P, show = s => !q || String(s.name).includes(q);
  const wk = s => { const t0 = Date.now() - 7 * 864e5, L = ((CT_DATA && CT_DATA.behavior) || []).filter(x => x && !x.deleted && String(x.studentId) === String(s.id) && (Number(x.at) || Date.parse(x.date || '') || 0) >= t0);
    const p = L.filter(x => x.type === 'positive').length, n = L.length - p; return p || n ? `<small class="qr-wk">${p ? `🌟 ${p}` : ''}${p && n ? ' · ' : ''}${n ? `⚠️ ${n}` : ''} <i>آخر ٧ أيام</i></small>` : ''; };
  const sub = s => { if (m === 'behavior' && !qrBehOf(s.id).length) return wk(s); const b = qrBehOf(s.id); return b.length ? `<small>${b.slice(0, 2).map(x => (x.type === 'positive' ? '🌟 ' : '⚠️ ') + esc(String(x.category || '').replace(/^[^\p{L}]+/u, ''))).join(' · ')}${b.length > 2 ? ` +${b.length - 2}` : ''}</small>` : ''; };
  return roster.map(s => {
    const id = String(s.id), v = qrSt(m === 'behavior' ? 'participation' : m, id);
    if (m === 'behavior' && QR.multi) { const on = QR.sel.has(id);
      return `<div class="qr-row qr-pick ${on ? 'done on' : ''}" data-sid="${esc(id)}" ${show(s) ? '' : 'hidden'}><button type="button" class="nm" onclick="qrPick('${esc(id)}')"><span class="qr-mk">${on ? '✓' : ''}</span>${esc(s.name)}${sub(s)}</button></div>`; }
    const btns = m === 'behavior'
      ? `<button type="button" class="c g on" title="إيجابي" onclick="qrBehOpen('${esc(id)}')">🌟</button><button type="button" class="c r on" title="ملاحظة" onclick="qrBehOpen('${esc(id)}')">⚠️</button>`
      : opts.map(([val, ic, c, l]) => `<button type="button" class="c ${c} ${v === val ? 'on' : ''}" title="${l}" aria-pressed="${v === val}" onclick="qrSet('${m}','${esc(id)}','${val}')">${ic}</button>`).join('');
    return `<div class="qr-row ${v ? 'done' : ''}" data-sid="${esc(id)}" ${show(s) ? '' : 'hidden'}><button type="button" class="nm" onclick="qrStudent('${esc(id)}')">${esc(s.name)}${sub(s)}</button>${btns}</div>
      ${QR.open === id ? `<div class="qr-bpick">${bhvPickerHTML(id, 'qr')}</div>` : ''}`;
  }).join('') || '<div class="feature-empty" style="padding:1rem">لا طلاب في هذا الفصل.</div>';
}
function qrPaint() {
  const root = document.getElementById('qr-root'); if (!root) return;
  const cls = qrCls(), roster = ctRoster(cls), m = QR.mode, d = qrDay();
  const cnt = (mm, v) => roster.filter(s => qrSt(mm, s.id) === v).length;
  const none = roster.filter(s => !qrSt(m === 'behavior' ? 'participation' : m, s.id)).length;
  const counters = m === 'homework'
    ? [['g', cnt('homework', 'أنجز'), 'أنجز'], ['r', cnt('homework', 'لم ينجز'), 'لم ينجز'], ['a', cnt('homework', 'معذور'), 'معذور'], ['n', none, 'بلا رصد']]
    : m === 'behavior'
      ? [['g', roster.reduce((a, s) => a + qrBehOf(s.id).filter(x => x.type === 'positive').length, 0), 'إيجابية'], ['r', roster.reduce((a, s) => a + qrBehOf(s.id).filter(x => x.type !== 'positive').length, 0), 'ملاحظات']]
      : [['g', cnt('participation', 'شارك'), 'شارك'], ['r', cnt('participation', 'لم يشارك'), 'لم يشارك'], ['a', cnt('participation', 'غائب') + cnt('participation', 'غائب بعذر'), 'غائب'], ['n', none, 'بلا رصد']];
  const sc = root.querySelector('.qr-list') ? root.querySelector('.qr-list').scrollTop : 0;
  root.innerHTML = `
    <div class="qr-bar"><label class="qr-s">🔍<input id="qr-q" type="search" placeholder="ابحث عن طالب لرصده…" value="${esc(QR.q)}" oninput="qrSearch(this.value)" autocomplete="off"></label>
      ${QRV.sup ? `<button type="button" class="qr-ic ${QRV.on ? 'on' : ''}" id="qr-mic" onclick="qrVoiceToggle()" title="رصد بالصوت">${QRV.on ? '⏹️' : '🎤'}</button>` : ''}
      <label class="qr-ic qr-date" title="التاريخ">📅<input type="date" value="${esc(d)}" onchange="window._ctRcD=this.value;renderClassTools()"></label></div>
    ${QRV.on || QRV.msg ? `<div class="qr-vlive" id="qr-vlive">${QRV.msg || '🎙️ أستمع… قل اسم الطالب ثم الحالة — ويمكن عدة طلاب في جملة واحدة'}</div>` : ''}
    <div class="qr-mode">${[['participation', '✋ المشاركة'], ['homework', '📚 الواجب'], ['behavior', '⭐ السلوك']].map(([k, l]) => `<button type="button" class="${m === k ? 'on' : ''}" onclick="QR.mode='${k}';QR.open='';QR.multi=false;QR.sel.clear();qrPaint()">${l}</button>`).join('')}</div>
    <div class="qr-cnt" style="grid-template-columns:repeat(${counters.length},1fr)">${counters.map(([c, n, l]) => `<div class="${c}"><b>${n}</b><small>${l}</small></div>`).join('')}</div>
    <div class="qr-st"><span id="qr-sync" class="qr-sync"></span>${QR.undo.length ? `<button type="button" onclick="qrUndo()">↩️ تراجع</button>` : ''}</div>
    ${d !== ctToday() ? `<div class="qr-old">📅 ترصد ليوم ${esc(d)} — ليس اليوم</div>` : ''}
    ${m === 'behavior' ? qrMultiBarHTML() : ''}
    <div class="qr-list">${qrRowsHTML()}</div>
    <div class="qr-foot">
      ${m !== 'behavior' && none ? `<button type="button" class="qr-all" onclick="qrRest()">${m === 'homework' ? `📗 الباقي (${none}): أنجز` : `✅ الباقي (${none}): شارك`}<small>من رصدته يبقى كما هو${m === 'participation' ? ' — والغائب يبقى غائبًا' : ''}</small></button>` : ''}
    </div>
    ${m === 'behavior' ? qrBehDayHTML() : ''}${m === 'homework' ? qrGraceHTML() : ''}`;
  const l = root.querySelector('.qr-list'); if (l) l.scrollTop = sc;
  if (window._qrScroll) { window._qrScroll = 0; setTimeout(() => { const t = document.querySelector('.qr-lesson') || root; t.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 120); }   // قادم من «ارصدها»: مباشرة للأسماء
  qrStatus();
}
function qrBehDayHTML() {
  const roster = ctRoster(qrCls()), d = qrDay();
  const beh = ((CT_DATA && CT_DATA.behavior) || []).filter(x => x && !x.deleted && x.date === d && roster.some(s => String(s.id) === String(x.studentId)));
  return `<div class="ct-card" style="margin-top:.7rem"><b>📝 ملاحظات السلوك في هذا اليوم (${beh.length})</b>
    ${beh.map(x => { const s = roster.find(a => String(a.id) === String(x.studentId)); return `<div class="ct-beh"><span>${x.type === 'positive' ? '🌟' : '⚠️'} <b>${esc(s ? s.name : '')}</b> — ${esc([x.category, x.note].filter(Boolean).join(' — '))}</span><button type="button" class="btn ghost sm" onclick="qrBehDel('${esc(String(x.id))}')">حذف</button></div>`; }).join('') || '<div class="muted" style="font-size:.8rem">لا ملاحظات بعد.</div>'}</div>`;
}

/* ── الأفعال ── */
function qrSet(m, sid, v) {
  const cur = qrSt(m, sid), nv = cur === v ? '' : v, s = (STUDENTS || []).find(x => String(x.id) === String(sid));
  QR.undo.push([{ k: 'st', m, d: qrDay(), sid: String(sid), v: cur }]); QR.undo = QR.undo.slice(-30);
  qrDo({ k: 'st', m, d: qrDay(), sid: String(sid), v: nv });
  if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) {}
  return s;
}
function qrRest() {
  const m = QR.mode === 'homework' ? 'homework' : 'participation', v = m === 'homework' ? 'أنجز' : 'شارك';
  const todo = ctRoster(qrCls()).filter(s => !qrSt(m, s.id)); if (!todo.length) return;
  QR.undo.push(todo.map(s => ({ k: 'st', m, d: qrDay(), sid: String(s.id), v: '' })));
  qrDo(todo.map(s => ({ k: 'st', m, d: qrDay(), sid: String(s.id), v })), `✓ ${todo.length} ${v}`);
}
function qrUndo() {
  const last = QR.undo.pop(); if (!last) return;
  qrDo(last.map(o => o.k === 'behdel' ? o : { ...o }), '↩️ تم التراجع');
}
function qrSearch(v) {
  QR.q = String(v || ''); const q = QR.q.trim();
  document.querySelectorAll('#qr-root .qr-row').forEach(r => { const n = r.querySelector('.nm')?.textContent || ''; r.hidden = !!q && !n.includes(q); });
}
function qrStudent(sid) { if (QR.mode === 'behavior') return qrBehOpen(sid); if (typeof ctOpenProfile === 'function') ctOpenProfile(sid); }
function qrBehOpen(sid) { QR.open = QR.open === sid ? '' : sid; qrPaint(); const r = document.querySelector(`#qr-root .qr-row[data-sid="${CSS.escape(sid)}"]`); if (r) r.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
function qrBehAdd(sid, type, cat, note) {
  const ids = sid === '*' ? [...QR.sel] : [String(sid)]; if (!ids.length) return;
  const now = Date.now(), its = ids.map((id, i) => ({ id: qrId(), studentId: id, type, category: cat, note: note || '', date: qrDay(), at: now + i }));
  QR.undo.push(its.map(it => ({ k: 'behdel', id: it.id }))); QR.open = ''; if (sid === '*') { QR.multi = false; QR.sel.clear(); }
  const nm = String(cat).replace(/^[^\p{L}]+/u, '');
  qrDo(its.map(item => ({ k: 'beh', item })), `${type === 'positive' ? '🌟' : '⚠️'} سُجّلت «${nm}»${its.length > 1 ? ` لـ ${its.length} طلاب` : ''}`);
}
/* ☑️ سلوك واحد لعدة طلاب (كما في البوابة): حدّدهم ثم اختر السلوك مرة واحدة */
function qrMulti(on) { QR.multi = !!on; QR.sel.clear(); QR.open = ''; qrPaint(); }
function qrPick(id) { QR.sel.has(id) ? QR.sel.delete(id) : QR.sel.add(id); qrPaint(); }
function qrPickAll() { const q = QR.q.trim(); ctRoster(qrCls()).filter(s => !q || String(s.name).includes(q)).forEach(s => QR.sel.add(String(s.id))); qrPaint(); }
function qrMultiBarHTML() {
  if (!QR.multi) return `<button type="button" class="qr-mbtn" onclick="qrMulti(true)">☑️ سلوك لعدة طلاب</button>`;
  const n = QR.sel.size;
  return `<div class="qr-mbar"><b>☑️ ${n ? `${n} ${n === 1 ? 'طالب' : n === 2 ? 'طالبان' : 'طلاب'} — اختر السلوك` : 'اضغط على الطلاب لتحديدهم'}</b><button type="button" onclick="qrPickAll()">تحديد الكل</button><button type="button" onclick="qrMulti(false)">إلغاء</button></div>
    ${n ? `<div class="qr-bpick">${bhvPickerHTML('*', 'qr')}</div>` : ''}`;
}
/* ⏳ مهلة الواجبات (كما في البوابة): «لم ينجز» لا يُخصم إلا بعد أيام السماح — «سامحه» تجعله معذورًا، و«سلّمه» تجعله أنجز */
function qrGraceDays() { const r = (typeof CT_GRADES !== 'undefined' && CT_GRADES && CT_GRADES.rules) || {}; return Number(r.graceDays) || 7; }
function qrGraceItems() {
  const H = (CT_DATA && CT_DATA.homework) || {}, G = qrGraceDays(), roster = ctRoster(qrCls()), out = [];
  for (const d of Object.keys(H)) { const age = Math.floor((Date.parse(ctToday() + 'T00:00:00Z') - Date.parse(d + 'T00:00:00Z')) / 864e5), left = G - age; if (!(left > 0)) continue;
    for (const s of roster) { const r = H[d] && H[d][String(s.id)]; if (r && String(r.status || '') === 'لم ينجز') out.push({ s, d, left }); } }
  return out.sort((a, b) => a.left - b.left || String(a.s.name).localeCompare(String(b.s.name), 'ar'));
}
function qrGraceHTML() {
  const L = qrGraceItems(); if (!L.length) return '';
  return `<div class="ct-card qr-grace"><b>⏳ في فترة السماح (${L.length})</b><small class="muted">«لم ينجز» لا يُخصم قبل ${qrGraceDays()} أيام — إن سلّم متأخرًا أو له عذر:</small>
    ${L.map(x => `<div class="qr-gr"><span><b>${esc(x.s.name)}</b><small>${esc(x.d)} · يُخصم بعد ${x.left} ${x.left === 1 ? 'يوم' : 'أيام'}</small></span>
      <button type="button" class="btn ghost sm" onclick="qrForgive('${esc(String(x.s.id))}','${esc(x.d)}','معذور')">🕊️ سامحه</button><button type="button" class="btn sm" onclick="qrForgive('${esc(String(x.s.id))}','${esc(x.d)}','أنجز')">✓ سلّمه</button></div>`).join('')}</div>`;
}
function qrForgive(sid, d, st) {
  QR.undo.push([{ k: 'st', m: 'homework', d, sid: String(sid), v: 'لم ينجز' }]);
  qrDo({ k: 'st', m: 'homework', d, sid: String(sid), v: st, x: { forgiven: true, prev: 'لم ينجز' } }, st === 'معذور' ? '🕊️ سُومح' : '✓ سُجّل أنه سلّم');
}
function qrBehDel(id) { qrDo({ k: 'behdel', id: String(id) }, 'حُذفت الملاحظة'); }

/* ═══════════ 🎤 الرصد بالصوت — محرّك الفهم منقول كما هو من البوابة ═══════════ */
const QRV = { sup: !!(window.SpeechRecognition || window.webkitSpeechRecognition), on: false, owner: null, msg: '' };
function vrNorm(t){
  return String(t||'').toLowerCase()
    .replace(/[ً-ْٰـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي')
    .replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
}
const VR_SKIP = new Set(['بن','بنت','ابن','ال','آل','the','الطالب','طالب','يا','ترا','تري']);
const VR_JOIN = new Set(['عبد','ابو','أبو','ام','بو']);
function vrTokens(t){
  const raw = vrNorm(t).split(' ').filter(Boolean), out = [];
  for(let i=0;i<raw.length;i++){ const w = raw[i];
    if(VR_JOIN.has(w) && raw[i+1]){ out.push(w + raw[i+1]); i++; continue; }
    if(!VR_SKIP.has(w)) out.push(w); }
  return out;
}
function vrBare(w){ return w.length>3 && w.startsWith('ال') ? w.slice(2) : w; }
function vrEq(a,b){ if(!a||!b) return false; if(a===b) return true; const x=vrBare(a), y=vrBare(b); return x===y; }
function vrLev1(a,b){ if(Math.abs(a.length-b.length)>1) return false; let i=0,j=0,e=0; while(i<a.length&&j<b.length){ if(a[i]===b[j]){i++;j++;continue} if(++e>1) return false; if(a.length>b.length) i++; else if(b.length>a.length) j++; else {i++;j++} } return e+(a.length-i)+(b.length-j)<=1; }
function vrNear(a,b){ const x=vrBare(a), y=vrBare(b); return vrEq(a,b) || (x.length>=4 && y.length>=4 && vrLev1(x,y)); }
function vrKw(w){ return vrBare(String(w||'')).replace(/^(و|ف)(?=.{3,})/,''); }
function vrKwEq(tok,w){ return !!tok && (tok===w || vrKw(tok)===vrKw(w)); }
const VR_KINDS = [
  { ph:['لم يحل الواجب','ما حل الواجب','لم يحل','ما حل','لم ينجز الواجب','لم ينجز','ما انجز','ماانجز','لم ينجزه','ماحل','ما سوى الواجب','ما سوا الواجب','ماسوى الواجب','ما جاب الواجب','ما سلم الواجب','لم يسلم الواجب','نسي الواجب','ناسي الواجب','بدون واجب','ما سوى','ما جاب'], m:'homework', st:'لم ينجز' },
  { ph:['لم يشارك','ما شارك','مايشارك','ما يشارك','لم يشترك','ماشارك','مو مشارك','ما اشترك','غير مشارك'], m:'participation', st:'لم يشارك' },
  { ph:['حل الواجب','انجز الواجب','سلم الواجب','سوى الواجب','جاب الواجب','حال الواجب','حلال الواجب'], m:'homework', st:'أنجز' },
  { ph:['غائب','غياب','غايب','غائبه','ما حضر','ماحضر','لم يحضر','مو موجود'], m:'participation', st:'غائب' },
  { ph:['معذور','عذر'], m:'homework', st:'معذور' },
  { ph:['مشاركه','مشارك','شارك','اشترك','يشارك','تشارك','متفاعل'], m:'participation', st:'شارك' },
  { ph:['واجب','انجز','الواجب','نجز'], m:'homework', st:'أنجز' }
];
function vrBehaviors(){
  const out = [];
  try{ for(const [t,n] of BHV_POS) out.push({title:t, note:n, type:'positive'}); for(const [t,n] of BHV_NEG) out.push({title:t, note:n, type:'negative'});
    for(const x of bhvTemplates()) out.push({title:x.title, note:x.note||'', type:x.type||'negative'}); }catch(e){}
  return out;
}
function vrPhrases(){
  const out = [], direct = new Set();
  VR_KINDS.forEach(k => k.ph.forEach(p => { const t = vrTokens(p); if(t.length){ out.push({ t, kind:{ type:'status', m:k.m, st:k.st } }); t.forEach(w=>direct.add(w)); } }));
  const behs = vrBehaviors();
  for(const b of behs){ const t = vrTokens(b.title); if(t.length) out.push({ t, kind:{ type:'behavior', beh:b } }); }
  const uniq = new Map();
  for(const b of behs) for(const w of vrTokens(b.title)){ if(w.length<4 || direct.has(w)) continue; if(!uniq.has(w)) uniq.set(w, new Set()); uniq.get(w).add(b.title); }
  for(const [w, titles] of uniq){ if(titles.size !== 1) continue; const b = behs.find(x => x.title === [...titles][0]); if(b) out.push({ t:[w], kind:{ type:'behavior', beh:b }, loose:true }); }
  return out.sort((a,b)=> b.t.length - a.t.length);
}
function vrSegments(text){
  const toks = vrTokens(text), PH = vrPhrases(), segs = []; let buf = [];
  for(let i=0;i<toks.length;){
    let hit = null;
    for(const p of PH){ if(p.t.every((w,j)=> p.loose ? (toks[i+j] && (toks[i+j].includes(w)||w.includes(toks[i+j]))) : vrKwEq(toks[i+j],w))){ hit=p; break; } }
    if(hit){ if(buf.length) segs.push({ name:buf, kind:hit.kind }); buf = []; i += hit.t.length; continue; }
    buf.push(toks[i]); i++;
  }
  if(buf.length) segs.push({ name:buf, kind:null });
  return segs;
}
function vrMatch(nameToks){
  if(!nameToks.length) return { hits:[], scope:'' };
  const inCls = ctRoster(qrCls());
  const test = arr => arr.filter(s => { const st = vrTokens(s.name); return nameToks.every(n => st.some(x => vrEq(x,n))); });
  const prefer = arr => { const head = nameToks[0]; const first = arr.filter(s => { const st = vrTokens(s.name); return st[0] && vrEq(st[0], head); }); return first.length ? first : arr; };
  const near = arr => arr.filter(s => { const st = vrTokens(s.name); return nameToks.every(n => st.some(x => vrNear(x,n))); });
  let hits = test(inCls); if(hits.length) return { hits: prefer(hits), scope:'cls' };
  hits = near(inCls); if(hits.length) return { hits: prefer(hits), scope:'cls' };
  const all = Array.isArray(STUDENTS) ? STUDENTS : [];
  hits = test(all); if(!hits.length) hits = near(all);
  return { hits: hits.length ? prefer(hits) : hits, scope: hits.length ? 'all' : '' };
}
function qrVoiceSay(html) { QRV.msg = html; const e = document.getElementById('qr-vlive'); if (e) e.innerHTML = html; else qrPaint(); }
function qrVoiceApply(st, kind) {
  const sid = String(st.id);
  if (kind.type === 'behavior') { const it = { id: qrId(), studentId: sid, type: kind.beh.type, category: kind.beh.title, note: kind.beh.note || '', date: qrDay(), at: Date.now() }; QR.undo.push([{ k: 'behdel', id: it.id }]); qrDo({ k: 'beh', item: it }); return `${kind.beh.type === 'positive' ? '🌟' : '⚠️'} ${esc(st.name)}: ${esc(kind.beh.title)}`; }
  QR.undo.push([{ k: 'st', m: kind.m, d: qrDay(), sid, v: qrSt(kind.m, sid) }]);
  qrDo({ k: 'st', m: kind.m, d: qrDay(), sid, v: kind.st }); return `✓ ${esc(st.name)}: ${esc(kind.st)}`;
}
function qrVoiceHandle(text) {
  const segs = vrSegments(text); if (!segs.length) { qrVoiceSay(`لم أفهم «${esc(text)}» — حاول مرة أخرى`); return; }
  const done = [], ask = [];
  for (const sg of segs) {
    const { hits } = vrMatch(sg.name), nm = sg.name.join(' ');
    if (!hits.length) { ask.push(`❓ لم أجد «${esc(nm)}»`); continue; }
    if (!sg.kind) { ask.push(`❓ «${esc(hits[0].name)}» — قل الحالة بعد الاسم`); continue; }
    if (hits.length > 1) { ask.push(`❓ «${esc(nm)}»: ${hits.slice(0, 4).map(h => `<button type="button" class="btn sm" onclick="qrVoicePick('${esc(String(h.id))}','${esc(encodeURIComponent(JSON.stringify(sg.kind)))}',this)">${esc(h.name)}</button>`).join(' ')}`); continue; }
    done.push(qrVoiceApply(hits[0], sg.kind));
  }
  qrVoiceSay(`<div>🎙️ «${esc(text)}»</div>${done.map(x => `<div>${x}</div>`).join('')}${ask.map(x => `<div>${x}</div>`).join('')}`);
}
function qrVoicePick(sid, kindEnc, btn) {
  const st = (STUDENTS || []).find(x => String(x.id) === sid); if (!st) return;
  const r = qrVoiceApply(st, JSON.parse(decodeURIComponent(kindEnc))); if (btn && btn.parentElement) btn.parentElement.innerHTML = r;
}
function qrVoiceToggle() {
  // عبر محرّك الصوت الموحّد (HWV): جلسة واحدة للصفحة كلها — كانت جلسة جديدة كل مرة، فعلى iPhone يسمع أول مرة فقط
  if (QRV.on) { QRV.on = false; if (window.HWV && QRV.owner) HWV.mute(QRV.owner); QRV.msg = ''; qrPaint(); return; }
  if (!window.HWV || !HWV.sup) { toast('الرصد بالصوت غير مدعوم في هذا المتصفح', 'bad'); return; }
  const o = QRV.owner = { on: false,
    onText: (t, final) => { if (final) qrVoiceHandle(t); else { const e = document.getElementById('qr-vlive'); if (e) e.innerHTML = `🎙️ <b>«${esc(t)}»</b>`; } },
    onStop: why => { if (QRV.owner !== o) return; QRV.on = false; QRV.msg = why === 'ended' ? '⏸️ توقف الاستماع — اضغط 🎤 للمتابعة' : ''; qrPaint(); },
    onError: err => { if (err === 'not-allowed' || err === 'service-not-allowed') { QRV.on = false; HWV.mute(o); toast('اسمح باستخدام الميكروفون من إعدادات المتصفح', 'bad'); qrPaint(); } } };
  QRV.on = true; QRV.msg = ''; qrPaint();
  if (!HWV.go(o)) { QRV.on = false; toast('تعذّر تشغيل الميكروفون — أغلق المتصفح وافتحه ثم حاول', 'bad'); qrPaint(); }
}

