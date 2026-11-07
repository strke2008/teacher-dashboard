/* 🗃️ بنك الأسئلة — مرجع دائم في الخادم يبقى للسنوات القادمة (لا يُمسح مع نهاية السنة).
   - كل أسئلة يعتمدها المعلم في نشاط (مولّدة بالذكاء أو مكتوبة أو مستوردة) تُحفظ فيه تلقائيًا بلا تكرار —
     عدا أسئلة الفهم القرائي (مربوطة بنصها) وأنماط التعلّم (بلا إجابة صحيحة) والتشخيصي (عن مناهج سابقة) —
     تحت موضوعها: درس الكتاب إن جاء النشاط من «مكتبة الكتب»، وإلا عنوان النشاط.
   - منه يُنشأ نشاط بلا ذكاء (كل أسئلة الموضوع أو المحدد منها أو عشوائيًا)، ويُنزَّل ملفًا على الجهاز ويُستورد.
   - ملف التنزيل فيه «questions» بصيغة الأنشطة، فيُفتح أيضًا في «الاختبار الورقي». */
const QB = { list: null, total: 0, open: '', topic: null, sel: new Set(), q: '' };
const QB_T = { q: 'اختيار', tf: 'صح/خطأ', f: 'أكمل', a: 'حروف', s: 'جملة', m: 'وصّل' };

async function qbLoad(force) {
  if (QB.list && !force) return QB.list;
  const j = await libApi('/qbank'); QB.list = j.topics || []; QB.total = j.total || 0; return QB.list;
}
/* حفظ تلقائي عند اعتماد أسئلة نشاط (من commitActivityContent) */
async function qbAutoAdd(h, qs) {
  try {
    if (h && (h.kind === 'diag' || h.kind === 'style')) return tplAutoSave(h, qs);   // 🧪 اختبار ثابت للصف، لا أسئلة في البنك
    if (!h || h.__examProxy || h.kind === 'style' || h.kind === 'reading' || h.kind === 'diag' ||   // أنماط التعلّم بلا إجابة صحيحة، والفهم القرائي مربوط بنصه، والتشخيصي عن مناهج سابقة
         !Array.isArray(qs) || !qs.length || !getApi() || !getTok()) return;
    let topic; const s = h.src || {};
    if (s.book && s.lesson) { const b = (typeof bkBook === 'function' && bkBook(s.book)) || {}; topic = { topic: s.lesson, lesson: s.lesson, book: b.title || s.bookTitle || '', subject: b.subject || '', grade: b.grade || '' }; }
    else topic = { topic: String(h.title || '').trim() || 'بلا عنوان', subject: (typeof rcGet === 'function' && rcGet('subject')) || '' };
    if (!topic.book && s.lesson) topic.topic = s.lesson;
    const r = await libApi('/qbank-add', { topic, qs, src: String(h.title || '').slice(0, 120) });
    if (r.added) { QB.list = null; toast(`🗃️ حُفظ ${r.added} سؤالًا في بنك الأسئلة`, 'good'); if (BK.tab === 'bank') qbRender(); }
  } catch (e) { console.warn('qbAutoAdd', e); }
}

/* ── الصفحة (تبويب داخل «مكتبة الكتب») ── */
function bkTabsHTML() { return `<div class="bk-tabs" role="tablist"><button type="button" role="tab" aria-selected="${BK.tab !== 'bank'}" class="${BK.tab !== 'bank' ? 'on' : ''}" onclick="BK.tab='books';bkRender()">📚 الكتب</button><button type="button" role="tab" aria-selected="${BK.tab === 'bank'}" class="${BK.tab === 'bank' ? 'on' : ''}" onclick="BK.tab='bank';bkRender()">🗃️ بنك الأسئلة${QB.list ? ` <small>${QB.total}</small>` : ''}</button></div>`; }
async function qbRender(force) {
  const el = document.getElementById('qb-root'); if (!el) return;
  if (!QB.list || force) { el.innerHTML = '<div class="bk-empty">⏳ جارٍ التحميل…</div>'; try { await qbLoad(true); } catch (e) { el.innerHTML = `<div class="bk-empty">⚠️ ${esc(e.message)}</div>`; return; } const tb = document.querySelector('.bk-tabs'); if (tb) tb.outerHTML = bkTabsHTML(); }
  if (QB.open) return qbTopicRender(el);
  const n = s => String(s || '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي'), q = n(QB.q).trim();
  const L = QB.list.filter(t => !q || n([t.topic, t.lesson, t.book, t.subject, t.grade].join(' ')).includes(q)), groups = {};
  L.forEach(t => { const g = t.book || t.subject || 'موضوعات أخرى'; (groups[g] = groups[g] || []).push(t); });
  el.innerHTML = `<div class="qb-bar"><input class="inp" type="search" placeholder="🔎 ابحث عن درس أو موضوع…" value="${esc(QB.q)}" oninput="QB.q=this.value;clearTimeout(QB.t);QB.t=setTimeout(()=>{qbRender();const i=document.querySelector('.qb-bar input');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}},250)">
      <button type="button" class="btn ghost sm" onclick="qbExport()">⬇️ تنزيل البنك</button><label class="btn ghost sm">⬆️ استيراد<input type="file" accept=".json,application/json" hidden onchange="qbImport(this)"></label></div>
    ${QB.q ? '' : tplListHTML()}<p class="qb-sum">${QB.total} سؤالًا في ${QB.list.length} موضوعًا — تُحفظ هنا تلقائيًا كل أسئلة تعتمدها في نشاط، وتبقى للسنوات القادمة.</p>
    ${L.length ? Object.entries(groups).map(([g, T]) => `<div class="qb-group"><div class="qb-gt">${esc(g)}</div>${T.map(t => `<button type="button" class="qb-topic" onclick="qbOpen('${esc(t.id)}')">
      <span class="qb-tt"><b>${esc(t.lesson || t.topic)}</b><small>${Object.entries(t.types || {}).map(([k, v]) => `<i>${esc(QB_T[k] || k)} ${v}</i>`).join('')}</small></span><span class="qb-n">${t.n}<small>سؤال</small></span></button>`).join('')}</div>`).join('')
    : `<div class="bk-empty"><div class="bk-empty-ic">🗃️</div><b>${QB.q ? 'لا نتائج' : 'البنك فارغ'}</b><p>${QB.q ? '' : 'كل أسئلة تعتمدها في نشاط من الآن تُحفظ هنا تلقائيًا تحت درسها، فتستعملها لاحقًا بلا ذكاء. ويمكنك استيراد ملف أسئلة سابق.'}</p></div>`}`;
}
async function qbOpen(id) { QB.open = id; QB.topic = null; QB.sel = new Set(); const el = document.getElementById('qb-root'); if (el) el.innerHTML = '<div class="bk-empty">⏳</div>';
  try { QB.topic = (await libApi('/qbank-topic?id=' + encodeURIComponent(id))).topic; } catch (e) { toast(e.message, 'bad'); QB.open = ''; } qbRender(); }
function qbQHTML(q) {
  const ans = q.t === 'q' ? (q.o || []).map((o, i) => `<li class="${i === q.a ? 'ok' : ''}">${esc(o)}</li>`).join('') : q.t === 'tf' ? `<li class="ok">${q.a ? 'صح' : 'خطأ'}</li>` : q.t === 'm' ? (q.p || []).map(p => `<li>${esc(p[0])} ← ${esc(p[1])}</li>`).join('') : q.a != null ? `<li class="ok">${esc(Array.isArray(q.a) ? q.a.join(' / ') : q.a)}</li>` : '';
  return `<span class="qb-qt">${esc(QB_T[q.t] || q.t)}</span><b>${esc(q.q || (q.t === 'm' ? 'وصّل' : ''))}</b>${ans ? `<ul>${ans}</ul>` : ''}${q.from ? `<small>من: ${esc(q.from)}</small>` : ''}`;
}
function qbTopicRender(el) {
  const T = QB.topic; if (!T) { QB.open = ''; return qbRender(); } const n = QB.sel.size;
  el.innerHTML = `<div class="bk-head"><button type="button" class="btn ghost sm" onclick="QB.open='';qbRender()">→ البنك</button><div class="bk-title"><b>${esc(T.lesson || T.topic)}</b><small>${esc([T.book, T.subject, T.grade].filter((x, i) => x && (i === 0 || !String(T.book || '').includes(x))).join(' · '))} · ${T.qs.length} سؤال</small></div></div>
    <div class="qb-acts"><button type="button" class="btn sm" onclick="qbMake()">✦ نشاط ${n ? 'من المحدد (' + n + ')' : 'من كل الأسئلة'}</button>
      <button type="button" class="btn ghost sm" onclick="qbRandom()">🎲 اختر 10 عشوائيًا</button><button type="button" class="btn ghost sm" onclick="qbSelAll()">${n === T.qs.length ? 'إلغاء التحديد' : 'تحديد الكل'}</button>
      <button type="button" class="btn ghost sm" onclick="qbExport(['${esc(T.id)}'])">⬇️ تنزيل</button>${n ? `<button type="button" class="btn ghost sm qb-del" onclick="qbDelSel()">🗑️ حذف المحدد</button>` : ''}</div>
    <div class="qb-list">${T.qs.map(q => `<label class="qb-q${QB.sel.has(q.h) ? ' on' : ''}"><input type="checkbox" ${QB.sel.has(q.h) ? 'checked' : ''} onchange="qbSel('${esc(q.h)}',this.checked)"><span>${qbQHTML(q)}</span></label>`).join('')}</div>`;
}
function qbSel(h, on) { if (on) QB.sel.add(h); else QB.sel.delete(h); qbRender(); }
function qbSelAll() { const T = QB.topic; if (!T) return; QB.sel = QB.sel.size === T.qs.length ? new Set() : new Set(T.qs.map(q => q.h)); qbRender(); }
function qbRandom(k) { const T = QB.topic; if (!T) return; const a = T.qs.map(q => q.h); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } QB.sel = new Set(a.slice(0, k || 10)); qbRender(); }
async function qbDelSel() { const T = QB.topic; if (!T || !QB.sel.size || !confirm(`حذف ${QB.sel.size} سؤالًا من البنك نهائيًا؟`)) return;
  try { const r = await libApi('/qbank-del', { id: T.id, hs: [...QB.sel] }); toast(`حُذف ${r.removed}`, 'good'); QB.sel = new Set(); QB.list = null; if (r.n) await qbOpen(T.id); else { QB.open = ''; qbRender(true); } } catch (e) { toast(e.message, 'bad'); } }
const qbClean = q => { const x = JSON.parse(JSON.stringify(q)); ['h', 'at', 'from'].forEach(k => delete x[k]); return x; };
/* نشاط من البنك بلا ذكاء: مسودة غير منشورة تُفتح في محرر الأسئلة للمراجعة */
function qbMakeFrom(T, qs) {
  if (!qs.length) return; const h = { id: uid(), title: T.lesson || T.topic, cls: '', clsList: [], due: '', pts: 30, max: 20, kind: 'normal', qs: qs.map(qbClean), subs: {}, at: Date.now() };
  HW.push(h); save(K.hw, HW); closeModal(); goTab('hw'); setTimeout(() => { try { openQs(h.id); } catch (e) {} }, 350); toast(`✍️ مسودة «${h.title}» بـ ${qs.length} سؤال من البنك — راجعها ثم انشرها`, 'good');
}
function qbMake() { const T = QB.topic; if (!T) return; qbMakeFrom(T, QB.sel.size ? T.qs.filter(q => QB.sel.has(q.h)) : T.qs); }
async function qbMakeTopic(id) { try { const T = (await libApi('/qbank-topic?id=' + encodeURIComponent(id))).topic; qbMakeFrom(T, T.qs); } catch (e) { toast(e.message, 'bad'); } }
/* أسئلة البنك لدرس من الكتاب (لنافذة «نشاط من الدرس») */
async function qbForLesson(book, lesson) { try { await qbLoad(); } catch (e) { return null; } const n = s => String(s || '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
  return (QB.list || []).find(t => n(t.lesson) === n(lesson) && (!t.book || n(t.book) === n(book))) || (QB.list || []).find(t => !t.book && n(t.topic) === n(lesson)) || null; }

/* ── التنزيل والاستيراد ── */
async function qbExport(ids) {
  try { await qbLoad(); const L = (QB.list || []).filter(t => !ids || ids.includes(t.id)); if (!L.length && ids) return; toast('⏳ تجهيز الملف…');
    const topics = []; for (const t of L) { const T = (await libApi('/qbank-topic?id=' + encodeURIComponent(t.id))).topic; topics.push({ topic: T.topic, subject: T.subject, grade: T.grade, book: T.book, lesson: T.lesson, qs: T.qs.map(qbClean) }); }
    let templates = []; if (!ids) { try { for (const t of await tplLoad(true)) { const T = (await libApi('/tpl-get?id=' + encodeURIComponent(t.id))).tpl; templates.push({ kind: T.kind, grade: T.grade, subject: T.subject, title: T.title, qs: T.qs }); } } catch (e) {} }
    const data = { app: 'مساعد المعلم', kind: 'qbank', v: 1, exportedAt: new Date().toISOString(), topics, ...(templates.length ? { templates } : {}), questions: topics.flatMap(t => t.qs) };
    const name = (ids && ids.length === 1 ? 'أسئلة-' + (topics[0].lesson || topics[0].topic) : 'بنك-الأسئلة') + '-' + new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10) + '.json';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })); a.download = name.replace(/[\\/:*?"<>|]+/g, '_'); document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); toast(`⬇️ نُزّل ${data.questions.length} سؤالًا — الملف يُستورد هنا ويُفتح في «الاختبار الورقي» أيضًا`, 'good');
  } catch (e) { toast('تعذّر التنزيل: ' + e.message, 'bad'); }
}
async function qbImport(input) {
  const f = input && input.files && input.files[0]; if (input) input.value = ''; if (!f) return;
  try { const raw = JSON.parse(await f.text()); let topics = [];
    if (raw && Array.isArray(raw.topics)) topics = raw.topics.filter(t => t && Array.isArray(t.qs));
    else { let qs = Array.isArray(raw) ? raw : Array.isArray(raw && raw.questions) ? raw.questions : [];
      if (!qs.length && raw && (Array.isArray(raw.quiz) || Array.isArray(raw.truefalse))) { await lzLoad(); const N = window.examNormalizeSource(raw); qs = N.mc.map(x => ({ t: 'q', q: x.q, o: x.o, a: x.a })).concat(N.tf.map(x => ({ t: 'tf', q: x.q, a: x.a }))); }
      topics = [{ topic: String(raw && (raw.title || raw.topic) || f.name.replace(/\.json$/i, '')).slice(0, 120), qs }]; }
    let added = 0, dup = 0; for (const t of topics) { for (let i = 0; i < t.qs.length; i += 200) { const r = await libApi('/qbank-add', { topic: t, qs: t.qs.slice(i, i + 200), src: 'استيراد: ' + f.name.slice(0, 80) }); added += r.added; dup += r.dup; } }
    let tp = 0; for (const T of (raw && Array.isArray(raw.templates) ? raw.templates : [])) { try { await libApi('/tpl-save', T); tp++; } catch (e) {} } if (tp) TPL.list = null;
    if (!added && !dup && !tp) throw new Error('لا أسئلة صالحة في الملف'); toast(`⬆️ أُضيف ${added} سؤالًا${dup ? ` (و${dup} موجودة مسبقًا)` : ''}${tp ? ` و${tp} اختبارات ثابتة` : ''}`, 'good'); QB.open = ''; qbRender(true);
  } catch (e) { toast('تعذّر الاستيراد: ' + (e.message || e), 'bad'); }
}

/* ══ 🧪 الاختبارات الثابتة لكل صف (تشخيصي · أنماط التعلّم): تُحفظ كاملة عند اعتمادها، وتُستعمل كل سنة بلا ذكاء ══ */
const TPL = { list: null, skip: '' };
const TPL_K = { diag: ['🔍', 'تشخيصي'], style: ['🧠', 'أنماط التعلّم'] };
async function tplLoad(force) { if (TPL.list && !force) return TPL.list; TPL.list = (await libApi('/tpl')).list || []; return TPL.list; }
/* الصف من فصول النشاط («أول 1» ← «أول»)، وإلا من إعدادات المادة في مولّد الذكاء */
async function tplGradeOf(h) {
  const L = [...new Set((typeof hwClasses === 'function' ? hwClasses(h) : []).map(c => String(c).replace(/[\d٠-٩]+/g, '').replace(/[\/\\\-–_()]+/g, ' ').replace(/\s+[أ-ي]$/, '').replace(/\s+/g, ' ').trim()).filter(Boolean))];
  if (L.length === 1) return L[0];
  try { await lzLoad(); const m = (window.readingAIGetMeta() || {}).meta || {}; const g = [m['qg-gradeSelect'], m['qg-stageSelect']].filter(Boolean).join(' '); if (g) return g; } catch (e) {}
  return L.join(' و') || 'عام';
}
async function tplAutoSave(h, qs) {
  try { if (TPL.skip && TPL.skip === h.id) { TPL.skip = ''; return; } if (!getApi() || !getTok() || !qs.length) return;
    const grade = await tplGradeOf(h); let subject = ''; if (h.kind === 'diag') { try { await lzLoad(); subject = ((window.readingAIGetMeta() || {}).meta || {})['qg-subjectInput'] || ''; } catch (e) {} subject = subject || (typeof rcGet === 'function' && rcGet('subject')) || ''; }
    const r = await libApi('/tpl-save', { kind: h.kind, grade, subject, title: TPL_K[h.kind][1], qs });
    TPL.list = null; toast(`🧪 حُفظ ${TPL_K[h.kind][1]} للصف «${grade}» (${r.n} سؤال)${r.replaced ? ' بدل السابق' : ''} — تستعمله كل سنة بلا ذكاء`, 'good'); if (BK.tab === 'bank' && !QB.open) qbRender();
  } catch (e) { console.warn('tplAutoSave', e); }
}
function tplListHTML() {
  if (!TPL.list) { tplLoad().then(() => { const el = document.getElementById('tpl-sec'); if (el) el.outerHTML = tplListHTML(); }).catch(() => {}); return '<div id="tpl-sec"></div>'; }
  if (!TPL.list.length) return '<div id="tpl-sec"></div>';
  return `<div id="tpl-sec" class="qb-group tpl-sec"><div class="qb-gt">🧪 اختبارات ثابتة لكل صف <small>تُستعمل كل سنة بلا ذكاء</small></div>${TPL.list.map(t => `<div class="tpl-row"><span class="tpl-ic">${TPL_K[t.kind] ? TPL_K[t.kind][0] : '🧪'}</span>
    <span class="qb-tt"><b>${esc(TPL_K[t.kind] ? TPL_K[t.kind][1] : t.title)} — ${esc(t.grade)}</b><small><i>${t.n} سؤال</i>${t.subject ? `<i>${esc(t.subject)}</i>` : ''}</small></span>
    <button type="button" class="btn sm" onclick="tplUse('${esc(t.id)}')">نشاط منه</button><button type="button" class="btn ghost sm" onclick="tplDel('${esc(t.id)}')" aria-label="حذف">🗑️</button></div>`).join('')}</div>`;
}
async function tplUse(id) {
  try { const T = (await libApi('/tpl-get?id=' + encodeURIComponent(id))).tpl, h = { id: uid(), title: `${T.title} — ${T.grade}`, cls: '', clsList: [], due: '', pts: 0, max: 20, kind: T.kind, qs: JSON.parse(JSON.stringify(T.qs)), subs: {}, at: Date.now() };
    HW.push(h); save(K.hw, HW); goTab('hw'); setTimeout(() => { try { openHwForm(h.id); } catch (e) {} }, 350); toast(`✍️ مسودة «${h.title}» بـ ${T.qs.length} سؤال — حدّد الفصل ثم انشرها`, 'good');
  } catch (e) { toast(e.message, 'bad'); }
}
async function tplDel(id) { const t = (TPL.list || []).find(x => x.id === id); if (!t || !confirm(`حذف «${(TPL_K[t.kind] || [, t.title])[1]} — ${t.grade}» من الاختبارات الثابتة؟`)) return;
  try { await libApi('/tpl-del', { id }); TPL.list = null; toast('حُذف', 'good'); qbRender(); } catch (e) { toast(e.message, 'bad'); } }
/* تلميح داخل محرر أسئلة نشاط تشخيصي/أنماط فارغ: «عندك اختبار محفوظ — استخدمه» */
async function tplHint(hid) {
  const h = HW.find(x => x.id === hid); if (!h || !['diag', 'style'].includes(h.kind) || (h.qs || []).length) return; let L;
  try { L = (await tplLoad(true)).filter(t => t.kind === h.kind); } catch (e) { return; } if (!L.length) return;
  const g = await tplGradeOf(h); L.sort((x, y) => (y.grade === g) - (x.grade === g)); const box = document.getElementById('qs-box'); if (!box || document.getElementById('tpl-hint')) return;
  box.insertAdjacentHTML('beforebegin', `<div class="qb-hint" id="tpl-hint">🧪 عندك ${TPL_K[h.kind][1]} محفوظ — استخدمه بلا ذكاء: ${L.map(t => `<button type="button" class="btn sm" onclick="tplApply('${esc(hid)}','${esc(t.id)}')">${esc(t.grade)} (${t.n})</button>`).join(' ')}</div>`);
}
async function tplApply(hid, id) {
  try { const T = (await libApi('/tpl-get?id=' + encodeURIComponent(id))).tpl; TPL.skip = hid; const r = await commitActivityContent(hid, { qs: JSON.parse(JSON.stringify(T.qs)), dropDraft: true });
    if (!r.ok) throw new Error(r.error || 'تعذّر الحفظ'); toast(`🧪 وُضعت ${T.qs.length} سؤالًا من «${T.grade}»`, 'good'); openQs(hid); } catch (e) { TPL.skip = ''; toast(e.message, 'bad'); }
}
