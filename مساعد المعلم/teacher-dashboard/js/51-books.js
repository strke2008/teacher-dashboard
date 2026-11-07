/* 📚 مكتبة الكتب الدراسية — يُرفع الكتاب مرة واحدة، فيُحفظ نص كل صفحة وفهرس دروسه في الخادم (للمعلم فقط).
   بعدها يُختار الدرس من القائمة عند توليد نشاط أو نص قرائي أو من «مساعدي»، ويُرسل للذكاء نص صفحات الدرس وحده.
   - الصفحات ذات النص السليم تُقرأ مجانًا من طبقة النص في PDF.
   - الكتاب المصوّر (أو الصفحات التالفة الترميز) تُقرأ بالذكاء صفحةً صفحة، وتُحفظ على دفعات؛ ويمكن إكمالها لاحقًا بإعادة اختيار الملف.
   - فهرس الدروس يستخرجه الذكاء من أول أسطر كل صفحة (بأرقام صفحات الملف نفسه)، ويراجعه المعلم ويعدّله. */
const BK = { list: null, open: '', busy: null, pages: {}, edit: null };
const BK_PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';

async function libApi(path, body) {
  const api = getApi(), t = getTok(); if (!api || !t) throw new Error('اربط الخادم من الإعدادات أولًا');
  const r = body ? await fetch(api + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t, ...body }) })
    : await fetch(api + path + (path.includes('?') ? '&' : '?') + 't=' + encodeURIComponent(t));
  const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) throw new Error(j.error === 'unauthorized' ? 'رمز المعلم غير صحيح' : (j.error || 'تعذّر الاتصال بالخادم')); return j;
}
async function bkLoad(force) {
  if (BK.list && !force) return BK.list;
  try { BK.list = (await libApi('/books')).books || []; } catch (e) { if (!BK.list) BK.list = []; throw e; }
  return BK.list;
}
const bkBook = id => (BK.list || []).find(b => b.id === id);
async function bkPages(id, from, to) {
  const k = id + ':' + from + ':' + to; if (BK.pages[k]) return BK.pages[k];
  const j = await libApi(`/book?id=${encodeURIComponent(id)}&from=${from}&to=${to}`); return (BK.pages[k] = j.pages || []);
}
async function bkLessonText(id, L) { const P = await bkPages(id, L.from, Math.max(L.from, L.to)); return P.map(x => String(x || '').trim()).filter(Boolean).join('\n\n'); }

/* ── الصفحة ── */
async function bkRender(force) {
  const el = document.getElementById('bk-root'); if (!el) return;
  if (!BK.list || force) { if (!BK.list) el.innerHTML = '<div class="bk-empty">⏳ جارٍ التحميل…</div>'; try { await bkLoad(true); } catch (e) { el.innerHTML = `<div class="bk-empty">⚠️ ${esc(e.message)}</div>`; return; } }
  if (BK.open && bkBook(BK.open)) { el.innerHTML = bkBookHTML(bkBook(BK.open)); return; }
  BK.open = ''; const L = BK.list;
  el.innerHTML = bkProgHTML() + (L.length ? `<div class="bk-grid">${L.map(b => `<button type="button" class="bk-card" onclick="bkOpen('${esc(b.id)}')">
      <span class="bk-cover" style="--h:${bkHue(b.subject || b.title)}"><b>${esc((b.subject || b.title || '').slice(0, 14))}</b><small>${esc(b.grade || '')}</small></span>
      <span class="bk-info"><b>${esc(b.title)}</b><small>${b.pagesCount || 0} صفحة · ${(b.lessons || []).length} درس</small>
      ${b.ocrPending ? `<span class="bk-warn">📷 ${b.ocrPending} صفحة لم تُقرأ بعد</span>` : (b.lessons || []).length ? '' : '<span class="bk-warn">لا فهرس دروس بعد</span>'}</span></button>`).join('')}</div>`
    : `<div class="bk-empty"><div class="bk-empty-ic">📚</div><b>مكتبتك فارغة</b><p>ارفع كتاب المادة (PDF) مرة واحدة، وبعدها اختر الدرس متى ما احتجته لتوليد نشاط أو نص قرائي أو من «مساعدي».</p></div>`);
}
const bkHue = s => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
function bkProgHTML() { const B = BK.busy; if (!B) return ''; const pc = B.of ? Math.round(B.n / B.of * 100) : 0;
  return `<div class="bk-prog" id="bk-prog"><b>${esc(B.label)}</b><div class="bk-bar"><i style="width:${pc}%"></i></div><small>${esc(B.sub || '')}</small>${B.stop ? `<button type="button" class="btn ghost sm" onclick="BK.busy&&(BK.busy.cancel=true)">إيقاف</button>` : ''}</div>`; }
function bkProg(o) { BK.busy = o ? Object.assign(BK.busy || {}, o) : null; const el = document.getElementById('bk-prog'); if (el && BK.busy) el.outerHTML = bkProgHTML(); else bkRender(); }

function bkBookHTML(b) {
  const L = b.lessons || [], units = []; L.forEach((l, i) => { const u = l.unit || ''; let g = units.find(x => x.u === u); if (!g) units.push(g = { u, items: [] }); g.items.push([l, i]); });
  return `${bkProgHTML()}<div class="bk-head"><button type="button" class="btn ghost sm" onclick="BK.open='';bkRender()">→ المكتبة</button>
    <div class="bk-title"><b>${esc(b.title)}</b><small>${esc([b.subject, b.grade].filter(Boolean).join(' · '))} · ${b.pagesCount || 0} صفحة</small></div>
    <div class="bk-acts"><button type="button" class="btn ghost sm" onclick="bkEditMeta('${esc(b.id)}')">✏️ البيانات</button><button type="button" class="btn ghost sm" onclick="bkDel('${esc(b.id)}')">🗑️</button></div></div>
    ${b.ocrPending ? `<div class="bk-note">📷 ${b.ocrPending} صفحة مصوّرة لم تُقرأ بعد — <label class="bk-link">أكمل قراءتها (اختر ملف الكتاب نفسه)<input type="file" accept="application/pdf,.pdf" hidden onchange="bkResume('${esc(b.id)}',this)"></label></div>` : ''}
    <div class="bk-sec"><b>📑 الدروس (${L.length})</b><span><button type="button" class="ai-btn sm quiet" onclick="bkIndex('${esc(b.id)}')"><span class="ai-mark">✦</span> ${L.length ? 'أعد استخراج الفهرس' : 'استخرج الفهرس بالذكاء'}</button>
      <button type="button" class="btn ghost sm" onclick="bkEditIndex('${esc(b.id)}')">✏️ تعديل الفهرس</button></span></div>
    ${L.length ? units.map(g => `<div class="bk-unit">${g.u ? `<div class="bk-unit-t">${esc(g.u)}</div>` : ''}${g.items.map(([l, i]) => `<div class="bk-lesson"><span class="bk-lt"><b>${esc(l.title)}</b><small>ص ${l.from}${l.to > l.from ? '–' + l.to : ''}</small></span>
      <button type="button" class="btn ghost sm" onclick="bkPreview('${esc(b.id)}',${i})">👁️ النص</button><button type="button" class="ai-btn sm" onclick="bkMakeActivity('${esc(b.id)}',${i})"><span class="ai-mark">✦</span> نشاط منه</button></div>`).join('')}</div>`).join('')
    : '<div class="bk-empty sm">لم يُستخرج فهرس الدروس بعد — اضغط «استخرج الفهرس بالذكاء» أو أضفه يدويًا.</div>'}`;
}
async function bkOpen(id) { BK.open = id; bkRender(); }

/* ── الرفع والقراءة ── */
function bkPageOk(t) {
  if (/�/.test(t)) return 'bad'; const ar = (t.match(/[؀-ۿ]/g) || []).length, la = (t.match(/[A-Za-z]/g) || []).length;
  if (ar < 25 && la < 40) return 'thin';
  if (ar >= 25 && la / (ar + la) > .35) return 'bad';
  if (ar > 400 && (t.match(/لا/g) || []).length / ar * 1000 < 1) return 'bad';
  return 'ok';
}
async function bkPdf(file) {
  await loadLib(BK_PDFJS, () => typeof pdfjsLib !== 'undefined');
  pdfjsLib.GlobalWorkerOptions.workerSrc = BK_PDFJS.replace('pdf.min.js', 'pdf.worker.min.js');
  return pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
}
async function bkAdd(input) {
  const file = input && input.files && input.files[0]; if (input) input.value = ''; if (!file) return;
  if (BK.busy) { toast('انتظر حتى تنتهي العملية الحالية', 'bad'); return; }
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { toast('اختر ملف PDF', 'bad'); return; }
  let id = '';
  try {
    bkProg({ label: '📖 جارٍ فتح الكتاب…', n: 0, of: 1 });
    await lzLoad(); const pdf = await bkPdf(file), N = pdf.numPages, pages = [], st = [];
    for (let p = 1; p <= N; p++) { const tc = await (await pdf.getPage(p)).getTextContent(); const t = String(window.normalAIBuildPdfPageText(tc.items) || '').replace(/­/g, '').trim(); pages.push(t); st.push(bkPageOk(t));
      if (p % 5 === 0 || p === N) bkProg({ label: '📖 قراءة نص الكتاب', n: p, of: N, sub: `صفحة ${p} من ${N}` }); }
    const scanned = st.filter(x => x !== 'ok').length / N >= .4;
    const final = pages.map((t, i) => st[i] === 'ok' ? t : st[i] === 'bad' || scanned ? '' : (t || ' '));
    const title = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 100);
    bkProg({ label: '☁️ حفظ الكتاب في مكتبتك…', n: N, of: N, sub: '' });
    const j = await libApi('/book-save', { meta: { title, lessons: [] }, pages: final }); id = j.meta.id; await bkLoad(true); BK.open = id;
    const todo = final.map((t, i) => t === '' ? i + 1 : 0).filter(Boolean);
    if (todo.length) await bkOcr(id, pdf, todo);
    await bkIndex(id, true);
    bkProg(null); toast('📚 أُضيف الكتاب — راجع فهرس الدروس', 'good');
  } catch (e) { console.error('bkAdd', e); bkProg(null); toast('تعذّر: ' + (e.message || e), 'bad'); if (id) { try { await bkLoad(true); } catch (x) {} bkRender(); } }
}
async function bkResume(id, input) {
  const file = input && input.files && input.files[0]; if (input) input.value = ''; if (!file || BK.busy) return;
  try { bkProg({ label: '📖 فتح الملف…', n: 0, of: 1 }); const pdf = await bkPdf(file), b = bkBook(id);
    if (b && b.pagesCount && pdf.numPages !== b.pagesCount) throw new Error(`عدد صفحات الملف (${pdf.numPages}) لا يطابق الكتاب (${b.pagesCount}) — اختر الملف نفسه`);
    const all = await bkPages(id, 1, pdf.numPages); delete BK.pages[id + ':1:' + pdf.numPages];
    const todo = all.map((t, i) => t === '' ? i + 1 : 0).filter(Boolean); if (todo.length) await bkOcr(id, pdf, todo);
    if (!(bkBook(id).lessons || []).length) await bkIndex(id, true); bkProg(null); toast('✓ اكتملت قراءة الصفحات', 'good');
  } catch (e) { bkProg(null); toast(e.message || 'تعذّر', 'bad'); }
}
/* قراءة الصفحات المصوّرة بالذكاء: صفحة في كل طلب، طلبان معًا، والحفظ كل 4 صفحات حتى لا يضيع شيء لو انقطع */
async function bkOcr(id, pdf, todo) {
  const R = aiRoute('pdf'); if (!readingAIGetKey(R.p) && !['gemini', 'openai', 'claude', 'openrouter'].some(p => readingAIGetKey(p))) { toast(`📷 ${todo.length} صفحة مصوّرة تحتاج مفتاح ذكاء يقرأ الصور (Gemini أو OpenAI أو Claude) — يمكنك إكمالها لاحقًا`, 'bad'); return; }
  const prompt = 'هذه صورة صفحة من كتاب مدرسي سعودي. اقرأ النص العربي الظاهر فيها بدقة من اليمين لليسار بترتيب القراءة الطبيعي (الأعمدة بالترتيب)، مع العناوين والفقرات والمصطلحات والتعريفات والأسئلة كما هي. لا تضف شيئًا غير ظاهر ولا تشرح. تجاهل رقم الصفحة وترويسة الكتاب. أعد JSON فقط: {"text":"نص الصفحة"} — وإن لم يكن فيها نص فأعد {"text":""}.';
  let done = 0, patch = {}; const q = todo.slice(); BK.busy = Object.assign(BK.busy || {}, { stop: true, cancel: false });
  const flush = async () => { if (!Object.keys(patch).length) return; const p = patch; patch = {}; await libApi('/book-save', { meta: { id }, patch: p }); };
  const one = async n => { const page = await pdf.getPage(n), v0 = page.getViewport({ scale: 1 }), sc = Math.min(2, 1400 / v0.width), vp = page.getViewport({ scale: sc }), cv = document.createElement('canvas');
    cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height); await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; const b64 = cv.toDataURL('image/jpeg', .85).split(',')[1]; cv.width = cv.height = 1;
    const raw = await readingAICall(R.p, R.m, prompt, null, { type: 'image/jpeg', b64 }); let t = ''; try { const j = aiSafeJson(raw); t = String(j && j.text != null ? j.text : raw); } catch (e) { t = String(raw || ''); }
    return t.replace(/```(?:json|text)?/g, '').replace(/�/g, '').trim() || ' '; };
  const worker = async () => { while (q.length && !(BK.busy && BK.busy.cancel)) { const n = q.shift(); try { patch[n] = await one(n); } catch (e) { console.warn('bkOcr', n, e); }
    done++; bkProg({ label: '📷 الذكاء يقرأ الصفحات المصوّرة', n: done, of: todo.length, sub: `${done} من ${todo.length} — تُحفظ أولًا بأول`, stop: true }); if (Object.keys(patch).length >= 4) await flush(); } };
  try { await Promise.all([worker(), worker()]); } finally { await flush().catch(() => {}); if (BK.busy) BK.busy.stop = false; Object.keys(BK.pages).filter(k => k.startsWith(id + ':')).forEach(k => delete BK.pages[k]); await bkLoad(true).catch(() => {}); }
}
/* فهرس الدروس بالذكاء: أول أسطر كل صفحة برقم صفحة الملف */
async function bkIndex(id, quiet) {
  const b = bkBook(id); if (!b) return;
  if (!quiet && (b.lessons || []).length && !confirm('استبدال فهرس الدروس الحالي بفهرس جديد يستخرجه الذكاء؟')) return;
  try { bkProg({ label: '✦ الذكاء يستخرج فهرس الدروس…', n: 1, of: 2, sub: 'من عناوين الصفحات' });
    const P = await bkPages(id, 1, b.pagesCount || 1), lines = P.map((t, i) => `ص${i + 1}: ${String(t || '').trim() ? String(t).trim().split('\n').slice(0, 3).join(' / ').slice(0, 170) : '(بلا نص)'}`).join('\n');
    const R = aiRoute('questions'), raw = await readingAICall(R.p, R.m, `أمامك أول أسطر كل صفحة من كتاب مدرسي (ص رقم = رقم صفحة الملف). استخرج دروس الكتاب بالترتيب: لكل درس عنوانه، والوحدة أو الفصل الذي يتبعه، وأول صفحة وآخر صفحة له بأرقام «ص» المعطاة هنا (لا أرقام الطباعة داخل النص). الدرس يمتد حتى الصفحة التي قبل الدرس التالي. تجاهل الغلاف والفهرس والمقدمة. إن كانت صفحات مراجعة أو تقويم في آخر الوحدة فألحقها بآخر درس.
أعد JSON فقط: {"subject":"المادة","grade":"الصف","lessons":[{"unit":"الوحدة/الفصل","title":"عنوان الدرس","from":رقم,"to":رقم}]}

${lines}`);
    const j = aiSafeJson(raw) || {}, N = b.pagesCount || P.length;
    let L = (Array.isArray(j.lessons) ? j.lessons : []).map(l => ({ unit: String(l.unit || '').trim(), title: String(l.title || '').trim(), from: Math.max(1, Math.min(N, parseInt(l.from, 10) || 0)), to: parseInt(l.to, 10) || 0 })).filter(l => l.title && l.from).sort((x, y) => x.from - y.from);
    L = L.map((l, i) => { const cap = L[i + 1] ? Math.max(l.from, L[i + 1].from - 1) : N; return { ...l, to: l.to >= l.from && l.to <= cap ? l.to : cap }; });
    if (!L.length) throw new Error('لم يجد الذكاء دروسًا — أضف الفهرس يدويًا');
    const sub = b.subject || String(j.subject || '').trim().slice(0, 60), gr = b.grade || String(j.grade || '').trim().slice(0, 60), nice = !/[\u0600-\u06FF]/.test(b.title || '') && sub ? sub + (gr ? ' — ' + gr : '') : undefined;
    await libApi('/book-save', { meta: { id, lessons: L, subject: sub, grade: gr, ...(nice ? { title: nice } : {}) } }); await bkLoad(true);
    if (!quiet) { bkProg(null); toast(`✓ ${L.length} درس — راجعها`, 'good'); } else bkRender();
  } catch (e) { if (!quiet) { bkProg(null); toast(e.message || 'تعذّر استخراج الفهرس', 'bad'); } else { BK.busy = null; toast('الفهرس: ' + (e.message || 'تعذّر') + ' — يمكنك إعادة المحاولة', 'bad'); bkRender(); } }
}

/* ── المعاينة والتعديل ── */
async function bkPreview(id, i) {
  const b = bkBook(id), l = b && (b.lessons || [])[i]; if (!l) return;
  openModal(`<h2>📖 ${esc(l.title)}</h2><p class="bk-mmeta">${esc(b.title)} · ص ${l.from}${l.to > l.from ? '–' + l.to : ''}</p><div class="bk-text" id="bk-text">⏳ جارٍ التحميل…</div>
    <div class="modal-foot"><button type="button" class="ai-btn" onclick="closeModal();bkMakeActivity('${esc(id)}',${i})"><span class="ai-mark">✦</span> نشاط من هذا الدرس</button><button type="button" class="btn ghost" onclick="closeModal()">إغلاق</button></div>`);
  try { const t = await bkLessonText(id, l), el = document.getElementById('bk-text'); if (el) el.textContent = t || '(لا نص في هذه الصفحات — قد تكون مصوّرة لم تُقرأ بعد)'; }
  catch (e) { const el = document.getElementById('bk-text'); if (el) el.textContent = '⚠️ ' + e.message; }
}
function bkEditMeta(id) {
  const b = bkBook(id); if (!b) return; const f = (k, l, ph) => `<label class="field"><span>${l}</span><input class="inp" id="bkm-${k}" value="${esc(b[k] || '')}" placeholder="${ph}" maxlength="100"></label>`;
  openModal(`<h2>✏️ بيانات الكتاب</h2>${f('title', 'العنوان', 'علوم — الفصل الدراسي الأول')}${f('subject', 'المادة', 'علوم')}${f('grade', 'الصف', 'أول متوسط')}${f('term', 'الفصل الدراسي', 'الأول')}
    <div class="modal-foot"><button type="button" class="btn tick" onclick="bkSaveMeta('${esc(id)}')">حفظ</button><button type="button" class="btn ghost" onclick="closeModal()">إلغاء</button></div>`);
}
async function bkSaveMeta(id) { const g = k => (document.getElementById('bkm-' + k) || {}).value || ''; try { await libApi('/book-save', { meta: { id, title: g('title').trim() || 'كتاب', subject: g('subject').trim(), grade: g('grade').trim(), term: g('term').trim() } }); closeModal(); await bkLoad(true); bkRender(); toast('✓ حُفظ', 'good'); } catch (e) { toast(e.message, 'bad'); } }
function bkEditIndex(id) {
  const b = bkBook(id); if (!b) return; BK.edit = { id, rows: JSON.parse(JSON.stringify(b.lessons || [])) }; if (!BK.edit.rows.length) BK.edit.rows.push({ unit: '', title: '', from: 1, to: 1 });
  openModal(`<h2>✏️ فهرس الدروس</h2><p class="bk-mmeta">أرقام الصفحات هي صفحات ملف PDF (من 1 إلى ${b.pagesCount || '؟'})</p><div class="bk-ed" id="bk-ed"></div>
    <button type="button" class="btn ghost sm" onclick="bkEdRow(-1)">＋ درس</button>
    <div class="modal-foot"><button type="button" class="btn tick" onclick="bkSaveIndex()">حفظ الفهرس</button><button type="button" class="btn ghost" onclick="closeModal()">إلغاء</button></div>`); bkEdPaint();
}
function bkEdPaint() { const el = document.getElementById('bk-ed'); if (!el || !BK.edit) return;
  el.innerHTML = `<div class="bk-ed-h"><span>الوحدة</span><span>الدرس</span><span>من</span><span>إلى</span><span></span></div>` + BK.edit.rows.map((r, i) => `<div class="bk-ed-r">
    <label><small>الوحدة</small><input class="inp" value="${esc(r.unit)}" oninput="BK.edit.rows[${i}].unit=this.value" placeholder="الوحدة"></label><label><small>الدرس</small><input class="inp" value="${esc(r.title)}" oninput="BK.edit.rows[${i}].title=this.value" placeholder="عنوان الدرس"></label>
    <label><small>من ص</small><input class="inp" type="number" min="1" value="${r.from}" oninput="BK.edit.rows[${i}].from=+this.value"></label><label><small>إلى ص</small><input class="inp" type="number" min="1" value="${r.to}" oninput="BK.edit.rows[${i}].to=+this.value"></label>
    <button type="button" class="bk-x" onclick="bkEdRow(${i})" aria-label="حذف">✕</button></div>`).join(''); }
function bkEdRow(i) { if (!BK.edit) return; const R = BK.edit.rows; if (i < 0) { const l = R[R.length - 1] || { to: 0 }; R.push({ unit: l.unit || '', title: '', from: (l.to || 0) + 1, to: (l.to || 0) + 1 }); } else R.splice(i, 1); bkEdPaint(); }
async function bkSaveIndex() { const E = BK.edit; if (!E) return; const L = E.rows.map(r => ({ unit: String(r.unit || '').trim(), title: String(r.title || '').trim(), from: Math.max(1, +r.from || 1), to: Math.max(+r.from || 1, +r.to || +r.from || 1) })).filter(r => r.title).sort((x, y) => x.from - y.from);
  try { await libApi('/book-save', { meta: { id: E.id, lessons: L } }); BK.edit = null; closeModal(); await bkLoad(true); bkRender(); toast(`✓ حُفظ الفهرس (${L.length} درس)`, 'good'); } catch (e) { toast(e.message, 'bad'); } }
async function bkDel(id) { const b = bkBook(id); if (!b || !confirm(`حذف «${b.title}» من مكتبتك؟ (لا يؤثر على الأنشطة التي وُلّدت منه)`)) return;
  try { await libApi('/book-del', { id }); BK.open = ''; await bkLoad(true); bkRender(); toast('حُذف الكتاب', 'good'); } catch (e) { toast(e.message, 'bad'); } }

/* ── الربط: نشاط من درس، واختيار درس داخل مولّد الأسئلة والنص القرائي ── */
async function bkMakeActivity(id, i) {
  const b = bkBook(id), l = b && (b.lessons || [])[i]; if (!l) return; let t = '';
  try { t = await bkLessonText(id, l); } catch (e) { toast(e.message, 'bad'); return; } if (!t.trim()) { toast('لا نص في صفحات هذا الدرس بعد', 'bad'); return; }
  const h = { id: uid(), title: l.title, cls: '', clsList: [], due: '', pts: 30, max: 20, kind: 'normal', qs: [], subs: {}, at: Date.now(), src: { book: id, lesson: l.title } };
  HW.push(h); save(K.hw, HW); goTab('hw');
  setTimeout(() => { try { openHwForm(h.id); } catch (e) {} setTimeout(() => { try { openNormalAIGenerator(h.id); } catch (e) {} setTimeout(() => bkFill('nai-content', t, `📚 ${l.title} — ${b.title} (ص ${l.from}${l.to > l.from ? '–' + l.to : ''})`, 'nai-pdf-status'), 150); }, 250); }, 300);
}
function bkFill(target, text, label, statusId) {
  const a = document.getElementById(target); if (!a) return; a.value = text; a.dispatchEvent(new Event('input', { bubbles: true }));
  const s = statusId && document.getElementById(statusId); if (s) s.textContent = '✅ ' + label + ` (${text.length.toLocaleString('ar-SA')} حرف)`;
}
async function bkPick(target, statusId) {
  const host = document.getElementById(target + '-bk'); if (!host) return; if (host.innerHTML) { host.innerHTML = ''; return; }
  host.innerHTML = '<div class="bk-pick">⏳ مكتبة الكتب…</div>';
  try { await bkLoad(); } catch (e) { host.innerHTML = `<div class="bk-pick">⚠️ ${esc(e.message)}</div>`; return; }
  const L = (BK.list || []).filter(b => (b.lessons || []).length);
  if (!L.length) { host.innerHTML = `<div class="bk-pick">لا كتب بفهرس دروس بعد — <a href="#" onclick="goTab('books');return false">افتح مكتبة الكتب</a> وارفع الكتاب مرة واحدة.</div>`; return; }
  const last = (() => { try { return JSON.parse(localStorage.getItem('bk_last') || '{}'); } catch (e) { return {}; } })(), b0 = L.find(b => b.id === last.b) || L[0];
  host.innerHTML = `<div class="bk-pick"><select class="inp" id="${target}-bkb" onchange="bkPickLessons('${target}')">${L.map(b => `<option value="${esc(b.id)}" ${b === b0 ? 'selected' : ''}>${esc(b.title)}</option>`).join('')}</select>
    <select class="inp" id="${target}-bkl"></select><button type="button" class="btn tick sm" onclick="bkPickUse('${target}','${statusId || ''}')">استخدم الدرس</button></div>`;
  bkPickLessons(target, last.i);
}
function bkPickLessons(target, sel) { const b = bkBook((document.getElementById(target + '-bkb') || {}).value), el = document.getElementById(target + '-bkl'); if (!b || !el) return;
  el.innerHTML = (b.lessons || []).map((l, i) => `<option value="${i}" ${+sel === i ? 'selected' : ''}>${esc((l.unit ? l.unit + ' — ' : '') + l.title)}</option>`).join(''); }
async function bkPickUse(target, statusId) {
  const id = (document.getElementById(target + '-bkb') || {}).value, i = +(document.getElementById(target + '-bkl') || {}).value, b = bkBook(id), l = b && (b.lessons || [])[i]; if (!l) return;
  try { const t = await bkLessonText(id, l); if (!t.trim()) { toast('لا نص في صفحات هذا الدرس بعد', 'bad'); return; }
    bkFill(target, t, `📚 ${l.title} (ص ${l.from}${l.to > l.from ? '–' + l.to : ''})`, statusId); try { localStorage.setItem('bk_last', JSON.stringify({ b: id, i })); } catch (e) {}
    const host = document.getElementById(target + '-bk'); if (host) host.innerHTML = ''; } catch (e) { toast(e.message, 'bad'); }
}
/* لـ«مساعدي»: البحث عن درس بالاسم في كل الكتب */
async function bkFindLesson(q, book) {
  await bkLoad(); const n = s => String(s || '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/^ال|\sال/g, ' ').replace(/\s+/g, ' ').trim();
  const w = n(q).split(' ').filter(x => x.length > 1), bw = n(book).split(' ').filter(x => x.length > 1), out = [];
  (BK.list || []).filter(b => !bw.length || bw.every(x => n(b.title + ' ' + b.subject + ' ' + b.grade).includes(x))).forEach(b => (b.lessons || []).forEach((l, i) => { const t = n(l.title + ' ' + l.unit); if (w.length && w.every(x => t.includes(x))) out.push({ b, l, i, exact: n(l.title) === n(q) }); }));
  const ex = out.filter(o => o.exact); return ex.length ? ex : out;
}
