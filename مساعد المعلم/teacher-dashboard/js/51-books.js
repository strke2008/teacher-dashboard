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
  if (BK.tab === 'bank') { el.innerHTML = bkProgHTML() + bkTabsHTML() + '<div id="qb-root"></div>'; qbRender(); return; }
  if (!QB.list) qbLoad().then(() => { const tb = document.querySelector('.bk-tabs'); if (tb) tb.outerHTML = bkTabsHTML(); }).catch(() => {});
  el.innerHTML = bkProgHTML() + bkTabsHTML() + `<div class="bk-case" role="list" aria-label="كتبك">${L.map(b => `<button type="button" class="bk-slot" role="listitem" onclick="bkOpen('${esc(b.id)}')" aria-label="${esc(b.title)}">
      ${bkCoverHTML(b)}<span class="bk-cap"><b>${esc(b.title)}</b><small>${(b.lessons || []).length ? (b.lessons || []).length + ' درس' : b.pagesCount + ' صفحة'}</small></span></button>`).join('')}
    <label class="bk-slot bk-slot-add"><span class="bk-book bk-add-book"><b>＋</b><small>${L.length ? 'أضف كتابًا' : 'أضف أول كتاب'}</small></span><span class="bk-cap"><small>PDF</small></span><input type="file" accept="application/pdf,.pdf" hidden onchange="bkAdd(this)"></label></div>
    ${L.length ? '' : '<p class="bk-hint">ارفع كتاب المادة (PDF) مرة واحدة، وبعدها اختر الدرس متى ما احتجته لتوليد نشاط أو نص قرائي أو من «مساعدي».</p>'}`;
  bkCoverFix();
}
/* 🖼️ الغلاف: صورة الصفحة الأولى من الخادم، وإلا غلاف مرسوم بلون المادة */
function bkCoverHTML(b, big) {
  const warn = b.ocrPending ? `<i class="bk-badge" title="${b.ocrPending} صفحة لم تُقرأ بعد">📄</i>` : (b.lessons || []).length ? '' : '<i class="bk-badge" title="لا فهرس دروس بعد">!</i>';
  if (b.coverAt) return `<span class="bk-book has-img${big ? ' big' : ''}"><img src="${esc(getApi() + '/book-cover?id=' + encodeURIComponent(b.id) + '&v=' + b.coverAt + '&t=' + encodeURIComponent(getTok()))}" alt="" loading="lazy" onerror="this.parentNode.classList.remove('has-img');this.remove()">${bkDrawnCover(b)}${warn}</span>`;
  return `<span class="bk-book${big ? ' big' : ''}">${bkDrawnCover(b)}${warn}</span>`;
}
function bkDrawnCover(b) { return `<span class="bk-drawn" style="--h:${bkHue(b.subject || b.title)}"><span class="bk-d-band"></span><b>${esc((b.subject || b.title || 'كتاب').slice(0, 16))}</b><small>${esc(b.grade || '')}</small><em>${esc(b.term ? 'الفصل ' + b.term : '')}</em></span>`; }
async function bkMakeCover(id, pdf) {
  const page = await pdf.getPage(1), v = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: 360 / v.width }), cv = document.createElement('canvas');
  cv.width = Math.round(vp.width); cv.height = Math.round(vp.height); const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise; let q = .8, d = cv.toDataURL('image/jpeg', q); while (d.length > 380000 && q > .3) d = cv.toDataURL('image/jpeg', q -= .15); cv.width = cv.height = 1;
  await libApi('/book-save', { meta: { id }, cover: d });
}
/* الكتب المرفوعة قبل الأغلفة: تُصنع أغلفتها في الخلفية من ملفاتها على الخادم (مرة لكل كتاب) */
async function bkCoverFix() {
  if (BK.coverBusy) return; const todo = (BK.list || []).filter(b => b.pdf && !b.coverAt && !(BK.coverTried || (BK.coverTried = {}))[b.id]); if (!todo.length) return;
  BK.coverBusy = true; try { for (const b of todo) { BK.coverTried[b.id] = 1; try { await bkMakeCover(b.id, await bkDoc(b.id)); } catch (e) { console.warn('bkCoverFix', b.id, e); } } await bkLoad(true); } catch (e) {} finally { BK.coverBusy = false; }
  if (!BK.open && !BK.busy) bkRender();
}
const bkHue = s => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
function bkProgHTML() { const B = BK.busy; if (!B) return ''; const pc = B.of ? Math.round(B.n / B.of * 100) : 0;
  return `<div class="bk-prog" id="bk-prog"><b>${esc(B.label)}</b><div class="bk-bar"><i style="width:${pc}%"></i></div><small>${esc(B.sub || '')}</small>${B.stop ? `<button type="button" class="btn ghost sm" onclick="BK.busy&&(BK.busy.cancel=true)">إيقاف</button>` : ''}</div>`; }
function bkProg(o) { BK.busy = o ? Object.assign(BK.busy || {}, o) : null; const el = document.getElementById('bk-prog'); if (el && BK.busy) el.outerHTML = bkProgHTML(); else bkRender(); }

function bkBookHTML(b) {
  const L = b.lessons || [], units = []; L.forEach((l, i) => { const u = l.unit || ''; let g = units.find(x => x.u === u); if (!g) units.push(g = { u, items: [] }); g.items.push([l, i]); });
  return `${bkProgHTML()}<div class="bk-head"><button type="button" class="btn ghost sm" onclick="BK.open='';bkRender()">→ المكتبة</button>
    <div class="bk-hcover" onclick="bkView('${esc(b.id)}')" title="تصفّح الكتاب">${bkCoverHTML(b, 1)}</div><div class="bk-title"><b>${esc(b.title)}</b><small>${esc([b.subject, b.grade].filter(Boolean).join(' · '))} · ${b.pagesCount || 0} صفحة</small></div>
    <div class="bk-acts"><button type="button" class="btn sm bk-read" onclick="bkView('${esc(b.id)}')">📖 تصفّح الكتاب</button><button type="button" class="btn ghost sm" onclick="bkEditMeta('${esc(b.id)}')">✏️ البيانات</button><button type="button" class="btn ghost sm" onclick="bkDel('${esc(b.id)}')">🗑️</button></div></div>
    ${b.pdf ? '' : `<div class="bk-note bk-note-i">📖 لتصفّح الكتاب بصفحاته الأصلية (الصور والأشكال) — <label class="bk-link">أرفق ملف الكتاب نفسه<input type="file" accept="application/pdf,.pdf" hidden onchange="bkAttachPdf('${esc(b.id)}',this)"></label>. وإلى ذلك الحين يُتصفَّح نصّه.</div>`}
    ${b.ocrPending ? `<div class="bk-note bk-read-note"><span>📄 ${b.ocrPending >= (b.pagesCount || 0) ? 'لم تُقرأ صفحات الكتاب بعد' : b.ocrPending + ' صفحة لم تُقرأ بعد'} — قراءتها تلزم للأنشطة والدروس و«مساعدي» (التصفّح لا يحتاجها).</span>
      ${b.pdf ? `<button type="button" class="ai-btn sm bk-readbtn" onclick="bkRead('${esc(b.id)}')"><span class="ai-mark">📄</span> ${b.ocrPending >= (b.pagesCount || 0) ? 'اقرأ صفحات الكتاب' : 'أكمل قراءة الصفحات'}</button>` : `<label class="bk-link">اقرأها (اختر ملف الكتاب نفسه)<input type="file" accept="application/pdf,.pdf" hidden onchange="bkResume('${esc(b.id)}',this)"></label>`}</div>` : ''}
    <div class="bk-sec"><b>📑 الدروس (${L.length})</b><span><button type="button" class="ai-btn sm${L.length || (b.pagesCount && b.ocrPending >= b.pagesCount) ? ' quiet' : ''} bk-idx" onclick="bkIndex('${esc(b.id)}')"><span class="ai-mark">✦</span> ${L.length ? 'أعد استخراج الفهرس' : 'استخرج الفهرس بالذكاء'}</button>
      <button type="button" class="btn ghost sm" onclick="bkEditIndex('${esc(b.id)}')">✏️ تعديل الفهرس</button></span></div>
    ${L.length ? units.map(g => `<div class="bk-unit">${g.u ? `<div class="bk-unit-t">${esc(g.u)}</div>` : ''}${g.items.map(([l, i]) => `<div class="bk-lesson"><span class="bk-lt"><b>${esc(l.title)}</b><small>ص ${l.from}${l.to > l.from ? '–' + l.to : ''}</small></span>
      <button type="button" class="btn ghost sm" onclick="bkView('${esc(b.id)}',${l.from})" aria-label="تصفّح الدرس في الكتاب" title="تصفّح الدرس في الكتاب">📖</button><button type="button" class="btn ghost sm" onclick="bkPreview('${esc(b.id)}',${i})">👁️ النص</button><button type="button" class="ai-btn sm" onclick="bkMakeActivity('${esc(b.id)}',${i})"><span class="ai-mark">✦</span> نشاط منه</button></div>`).join('')}</div>`).join('')
    : `<div class="bk-empty sm">${b.pagesCount && b.ocrPending >= b.pagesCount ? 'اقرأ صفحات الكتاب أولًا، ثم استخرج فهرس الدروس.' : 'لم يُستخرج فهرس الدروس بعد — اضغط «استخرج الفهرس بالذكاء» أو أضفه يدويًا.'}</div>`}`;
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
    const pdf = await bkPdf(file), N = pdf.numPages, title = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 100);
    /* الرفع فقط: الملف والغلاف وعدد الصفحات — قراءة الصفحات واستخراج الدروس بطلب المعلم من صفحة الكتاب */
    const j = await libApi('/book-save', { meta: { title, lessons: [] }, pages: Array(N).fill('') }); id = j.meta.id; await bkLoad(true); BK.open = id;
    if (BK.coverTried) BK.coverTried[id] = 1; else BK.coverTried = { [id]: 1 }; await bkMakeCover(id, pdf).catch(e => console.warn('cover', e));
    await bkUploadPdf(id, file).catch(e => toast('📖 لم يُرفع ملف الكتاب (' + (e.message || e) + ') — يمكنك إرفاقه لاحقًا من صفحة الكتاب', 'bad'));
    bkProg(null); toast('📚 رُفع الكتاب — اقرأ صفحاته واستخرج دروسه متى شئت من صفحته', 'good');
  } catch (e) { console.error('bkAdd', e); bkProg(null); toast('تعذّر: ' + (e.message || e), 'bad'); if (id) { try { await bkLoad(true); } catch (x) {} bkRender(); } }
}
async function bkResume(id, input) {
  const file = input && input.files && input.files[0]; if (input) input.value = ''; if (!file || BK.busy) return;
  try { bkProg({ label: '📖 فتح الملف…', n: 0, of: 1 }); const pdf = await bkPdf(file), b = bkBook(id);
    if (b && b.pagesCount && pdf.numPages !== b.pagesCount) throw new Error(`عدد صفحات الملف (${pdf.numPages}) لا يطابق الكتاب (${b.pagesCount}) — اختر الملف نفسه`);
    await bkReadPages(id, pdf);
    bkProg(null); toast('✓ اكتملت قراءة الصفحات', 'good');
  } catch (e) { bkProg(null); toast(e.message || 'تعذّر', 'bad'); }
}
/* 📄 قراءة صفحات الكتاب (بطلب المعلم): من ملفه على الخادم، وإلا يُطلب اختيار الملف */
async function bkRead(id) {
  const b = bkBook(id); if (!b || BK.busy) return; if (!b.pdf) { toast('اختر ملف الكتاب نفسه من الرابط في صفحته', 'bad'); return; }
  try { bkProg({ label: '📖 فتح الكتاب من مكتبتك…', n: 0, of: 1 }); await bkReadPages(id, await bkDoc(id)); bkProg(null); toast('✓ قُرئت صفحات الكتاب — استخرج فهرس الدروس متى شئت', 'good'); }
  catch (e) { bkProg(null); toast(e.message || 'تعذّرت القراءة', 'bad'); }
}
async function bkReadPages(id, pdf) {
  await lzLoad(); const N = pdf.numPages; Object.keys(BK.pages).filter(k => k.startsWith(id + ':')).forEach(k => delete BK.pages[k]);
  const all = await bkPages(id, 1, N); delete BK.pages[id + ':1:' + N]; const todo = all.map((t, i) => t === '' ? i + 1 : 0).filter(Boolean); if (!todo.length) return;
  const got = {}, st = {}; let n = 0;
  for (const p of todo) { const tc = await (await pdf.getPage(p)).getTextContent(); got[p] = String(window.normalAIBuildPdfPageText(tc.items) || '').replace(/\u00AD/g, '').trim(); st[p] = bkPageOk(got[p]);
    if (++n % 5 === 0 || n === todo.length) bkProg({ label: '📄 قراءة نص الصفحات', n, of: todo.length, sub: `صفحة ${n} من ${todo.length}` }); }
  const scanned = todo.filter(p => st[p] !== 'ok').length / todo.length >= .4, patch = {}, ocr = [];
  todo.forEach(p => { if (st[p] === 'ok') patch[p] = got[p]; else if (st[p] === 'bad' || scanned) ocr.push(p); else patch[p] = got[p] || ' '; });
  const keys = Object.keys(patch); for (let i = 0; i < keys.length; i += 60) await libApi('/book-save', { meta: { id }, patch: Object.fromEntries(keys.slice(i, i + 60).map(k => [k, patch[k]])) });
  await bkLoad(true); if (ocr.length) await bkOcr(id, pdf, ocr);
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
  if (b.pagesCount && b.ocrPending >= b.pagesCount) { toast('اقرأ صفحات الكتاب أولًا (زر «اقرأ صفحات الكتاب»)، ثم استخرج الفهرس', 'bad'); return; }
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
/* ✦ نشاط من درس: يختار المعلم نوع النشاط أولًا، ثم يُفتح مولّده ونص الدرس جاهز فيه */
const BK_ACT_KINDS = ['normal', 'reading', 'games', 'diag'];
function bkMakeActivity(id, i) {
  const b = bkBook(id), l = b && (b.lessons || [])[i]; if (!l) return; const K = (typeof HW_KINDS !== 'undefined' ? HW_KINDS : []).filter(k => BK_ACT_KINDS.includes(k.v));
  const how = { normal: 'يولّد الأسئلة من نص الدرس', reading: 'نص الدرس يصير النص القرائي', games: 'بنك أسئلة ولعبة من الدرس', diag: 'يقيس ما يلزم قبل الدرس' };
  openModal(`<h2>✦ نشاط من «${esc(l.title)}»</h2><p class="bk-mmeta">${esc(b.title)} · ص ${l.from}${l.to > l.from ? '–' + l.to : ''} — اختر نوع النشاط:</p>
    <div class="kind-tiles bk-kinds">${K.map(k => `<button type="button" class="kind-tile" data-kind="${k.v}" onclick="bkMakeAs('${esc(id)}',${i},'${k.v}')"><span class="ki">${k.ic}</span><b>${esc(k.t)}</b><small>${esc(how[k.v] || k.d)}</small></button>`).join('')}</div>
    <div id="bk-qb-hint"></div><div class="modal-foot"><button type="button" class="btn ghost" onclick="closeModal()">إلغاء</button></div>`);
  qbForLesson(b.title, l.title).then(t => { const el = document.getElementById('bk-qb-hint'); if (el && t && t.n) el.innerHTML = `<div class="qb-hint">🗃️ في بنك الأسئلة <b>${t.n}</b> سؤالًا لهذا الدرس — <button type="button" class="btn sm" onclick="qbMakeTopic('${esc(t.id)}')">نشاط منها بلا ذكاء</button> <button type="button" class="btn ghost sm" onclick="closeModal();goTab('books');BK.tab='bank';QB.open='${esc(t.id)}';bkRender()">اختر منها</button></div>`; });
}
async function bkMakeAs(id, i, kind) {
  const b = bkBook(id), l = b && (b.lessons || [])[i]; if (!l || !BK_ACT_KINDS.includes(kind)) return; let t = '';
  try { t = await bkLessonText(id, l); } catch (e) { toast(e.message, 'bad'); return; } if (!t.trim()) { toast('لا نص في صفحات هذا الدرس بعد', 'bad'); return; }
  closeModal(); try { bkViewClose(); } catch (e) {}
  const label = `📚 ${l.title} — ${b.title} (ص ${l.from}${l.to > l.from ? '–' + l.to : ''})`, wait = ms => new Promise(z => setTimeout(z, ms));
  const h = { id: uid(), title: l.title, cls: '', clsList: [], due: '', pts: 30, max: 20, kind, qs: [], subs: {}, at: Date.now(), src: { book: id, bookTitle: b.title, lesson: l.title } };
  HW.push(h); save(K.hw, HW); goTab('hw'); await wait(300);
  try { openHwForm(h.id); hwKindChanged(); } catch (e) {} await wait(250);
  try {
    if (kind === 'reading') { bkFill('h-reading-text', t, label, 'h-reading-pdf-status'); const el = document.getElementById('h-reading-wrap'); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    else if (kind === 'diag') { await lzLoad(); window.openDiagnosticAIGenerator(h.id); await wait(150); const sc = document.getElementById('diag-ai-scope'); if (sc) { sc.value = 'unit'; window.diagAIScopeChanged(); }
      const tp = document.getElementById('diag-ai-topic'); if (tp) tp.value = l.title; bkFill('diag-ai-content', t, label, 'diag-ai-source-note'); }
    else { openNormalAIGenerator(h.id); await wait(150); bkFill('nai-content', t, label, 'nai-pdf-status'); }
  } catch (e) { console.warn('bkMakeAs', e); }
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

/* ── 📖 ملف الكتاب: رفع على أجزاء (10MB) إلى الخادم ليُتصفَّح من أي جهاز ── */
async function bkUploadPdf(id, file) {
  const api = getApi(), t = getTok(); if (!api || !t) throw new Error('الخادم غير مربوط');
  const st = await libApi('/book-pdf/start', { id, size: file.size }), P = st.partSize || 10485760, N = Math.ceil(file.size / P), parts = [];
  try {
    for (let n = 1; n <= N; n++) { const blob = await file.slice((n - 1) * P, Math.min(file.size, n * P)).arrayBuffer(); let j = null;
      for (let k = 0; k < 3 && !(j && j.ok); k++) { try { const r = await fetch(`${api}/book-pdf/part?t=${encodeURIComponent(t)}&u=${encodeURIComponent(st.uploadId)}&n=${n}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: blob }); j = await r.json(); } catch (e) { j = null; } if (!(j && j.ok)) await new Promise(z => setTimeout(z, 1500 * (k + 1))); }
      if (!(j && j.ok)) throw new Error('انقطع الرفع'); parts.push({ partNumber: j.partNumber, etag: j.etag });
      bkProg({ label: '☁️ رفع ملف الكتاب للتصفّح من أي جهاز', n, of: N, sub: `${Math.round(Math.min(file.size, n * P) / 1048576)} من ${Math.max(1, Math.round(file.size / 1048576))} ميجابايت` }); }
    await libApi('/book-pdf/done', { u: st.uploadId, parts }); delete BK.docs[id]; await bkLoad(true);
  } catch (e) { libApi('/book-pdf/abort', { u: st.uploadId }).catch(() => {}); throw e; }
}
async function bkAttachPdf(id, input) {
  const file = input && input.files && input.files[0]; if (input) input.value = ''; if (!file || BK.busy) return; const b = bkBook(id);
  try { bkProg({ label: '📖 فتح الملف…', n: 0, of: 1 }); const pdf = await bkPdf(file);
    if (b && b.pagesCount && pdf.numPages !== b.pagesCount) throw new Error(`عدد صفحات الملف (${pdf.numPages}) لا يطابق الكتاب (${b.pagesCount}) — اختر الملف نفسه`);
    if (!(b && b.coverAt)) await bkMakeCover(id, pdf).catch(() => {}); await bkUploadPdf(id, file); bkProg(null); toast('📖 جاهز للتصفّح من أي جهاز', 'good'); } catch (e) { bkProg(null); toast(e.message || 'تعذّر', 'bad'); }
}

/* ── 📖 قارئ الكتاب: صفحة بصفحة، سحب يمين/يسار مثل الكتاب العربي، تكبير، قفز لدرس، ويتذكّر آخر صفحة ── */
BK.docs = {};
const BV = { id: '', n: 1, of: 1, z: 1, pdf: null, text: false, task: null, seq: 0 };
async function bkDoc(id) {
  if (BK.docs[id]) return BK.docs[id];
  await loadLib(BK_PDFJS, () => typeof pdfjsLib !== 'undefined'); pdfjsLib.GlobalWorkerOptions.workerSrc = BK_PDFJS.replace('pdf.min.js', 'pdf.worker.min.js');
  const u = `${getApi()}/book-pdf?id=${encodeURIComponent(id)}&t=${encodeURIComponent(getTok())}`;
  BK.docs[id] = pdfjsLib.getDocument({ url: u, disableAutoFetch: true, disableStream: true, rangeChunkSize: 524288 }).promise.catch(e => { delete BK.docs[id]; throw e; });
  return BK.docs[id];
}
async function bkView(id, page) {
  try { await bkLoad(); } catch (e) {} const b = bkBook(id); if (!b) return;
  let last = 0; try { last = +localStorage.getItem('bk_pg_' + id) || 0; } catch (e) {}
  Object.assign(BV, { id, of: b.pagesCount || 1, n: Math.max(1, Math.min(b.pagesCount || 1, +page || last || 1)), z: 1, pdf: null, text: !b.pdf });
  let el = document.getElementById('bk-viewer'); if (!el) { el = document.createElement('div'); el.id = 'bk-viewer'; el.className = 'bkv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); document.body.appendChild(el); }
  const L = b.lessons || [];
  el.innerHTML = `<div class="bkv-top"><button type="button" class="bkv-x" onclick="bkViewClose()" aria-label="إغلاق">✕</button><div class="bkv-t"><b>${esc(b.title)}</b><small id="bkv-ls"></small></div>
      <button type="button" class="bkv-ib" onclick="bkZoom(-1)" aria-label="تصغير">−</button><button type="button" class="bkv-ib" onclick="bkZoom(1)" aria-label="تكبير">+</button></div>
    ${L.length ? `<div class="bkv-jump"><select id="bkv-sel" onchange="bkGo(+this.value)" aria-label="انتقل إلى درس"><option value="">📑 انتقل إلى درس…</option>${L.map(l => `<option value="${l.from}">${esc((l.unit ? l.unit + ' — ' : '') + l.title)} (ص ${l.from})</option>`).join('')}</select></div>` : ''}
    ${BV.text ? '<div class="bkv-note">نسخة نصية — أرفق ملف الكتاب من صفحته لتتصفّح الصفحات الأصلية بصورها</div>' : ''}
    <div class="bkv-stage" id="bkv-stage"><div class="bkv-page" id="bkv-page"></div></div>
    <div class="bkv-bar"><button type="button" class="bkv-nb" onclick="bkGo(BV.n-1)" aria-label="الصفحة السابقة">▶ السابقة</button>
      <label class="bkv-pn">ص <input id="bkv-n" type="number" inputmode="numeric" min="1" max="${BV.of}" value="${BV.n}" onchange="bkGo(+this.value)"> / ${BV.of}</label>
      <button type="button" class="bkv-nb" onclick="bkGo(BV.n+1)" aria-label="الصفحة التالية">التالية ◀</button></div>
    <div class="bkv-act" id="bkv-act"></div>`;
  el.classList.add('on'); document.body.classList.add('bkv-open');
  const st = document.getElementById('bkv-stage'); let x0 = 0, y0 = 0, t0 = 0;
  st.addEventListener('touchstart', e => { if (e.touches.length !== 1) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now(); }, { passive: true });
  st.addEventListener('touchend', e => { const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; if (BV.z > 1 || Date.now() - t0 > 700 || Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * .6) return; bkGo(BV.n + (dx > 0 ? 1 : -1)); }, { passive: true });
  st.addEventListener('dblclick', () => bkZoom(BV.z > 1 ? -9 : 1));
  if (!BV.text) { document.getElementById('bkv-page').innerHTML = '<div class="bkv-load">⏳ جارٍ فتح الكتاب…</div>'; try { BV.pdf = await bkDoc(id); } catch (e) { BV.text = true; toast('تعذّر فتح ملف الكتاب — يُعرض نصّه', 'bad'); } }
  bkGo(BV.n);
}
function bkViewClose() { const el = document.getElementById('bk-viewer'); if (el) { el.classList.remove('on'); el.innerHTML = ''; } document.body.classList.remove('bkv-open'); BV.id = ''; try { BV.task && BV.task.cancel(); } catch (e) {} }
function bkZoom(d) { BV.z = d < -1 ? 1 : Math.max(1, Math.min(3, Math.round((BV.z + d * .5) * 2) / 2)); bkGo(BV.n, true); }
async function bkGo(n, keep) {
  if (!BV.id || !(n >= 1 && n <= BV.of)) return; const b = bkBook(BV.id), seq = ++BV.seq, pg = document.getElementById('bkv-page'), st = document.getElementById('bkv-stage'); if (!pg) return;
  if (n !== BV.n && !keep) BV.z = 1; BV.n = n; try { localStorage.setItem('bk_pg_' + BV.id, String(n)); } catch (e) {}
  const ni = document.getElementById('bkv-n'); if (ni) ni.value = n; const L = (b && b.lessons || []), cur = L.find(l => n >= l.from && n <= l.to), li = cur ? L.indexOf(cur) : -1;
  const ls = document.getElementById('bkv-ls'); if (ls) ls.textContent = cur ? (cur.unit ? cur.unit + ' · ' : '') + cur.title : ''; const sel = document.getElementById('bkv-sel'); if (sel) sel.value = '';
  const ac = document.getElementById('bkv-act'); if (ac) ac.innerHTML = cur ? `<button type="button" class="ai-btn sm" onclick="bkViewClose();bkMakeActivity('${esc(BV.id)}',${li})"><span class="ai-mark">✦</span> نشاط من «${esc(cur.title)}»</button>` : '';
  if (BV.text || !BV.pdf) { pg.className = 'bkv-page bkv-txt'; pg.style.fontSize = BV.z + 'rem'; pg.textContent = '⏳'; try { const t = (await bkPages(BV.id, n, n))[0]; if (seq === BV.seq) pg.textContent = String(t || '').trim() || '(صفحة بلا نص — قد تكون صورًا أو لم تُقرأ بعد)'; } catch (e) { if (seq === BV.seq) pg.textContent = '⚠️ ' + e.message; } if (!keep) st.scrollTo(0, 0); return; }
  try { try { BV.task && BV.task.cancel(); } catch (e) {} const page = await BV.pdf.getPage(n); if (seq !== BV.seq) return;
    const v1 = page.getViewport({ scale: 1 }), W = Math.max(200, st.clientWidth - 16), H = Math.max(200, st.clientHeight - 16), sc = Math.min(W / v1.width, H / v1.height) * BV.z, vp = page.getViewport({ scale: sc }), dpr = Math.min(3, window.devicePixelRatio || 1);
    const cv = document.createElement('canvas'); cv.width = Math.floor(vp.width * dpr); cv.height = Math.floor(vp.height * dpr); cv.style.width = Math.floor(vp.width) + 'px'; cv.style.height = Math.floor(vp.height) + 'px'; cv.setAttribute('aria-label', 'صفحة ' + n);
    BV.task = page.render({ canvasContext: cv.getContext('2d'), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null }); await BV.task.promise; if (seq !== BV.seq) return;
    pg.className = 'bkv-page'; pg.innerHTML = ''; pg.appendChild(cv); if (!keep) st.scrollTo(0, 0);
    if (n < BV.of) BV.pdf.getPage(n + 1).catch(() => {});   // تجهيز التالية
  } catch (e) { if (e && e.name === 'RenderingCancelledException') return; if (seq === BV.seq) pg.innerHTML = `<div class="bkv-load">⚠️ تعذّر عرض الصفحة — ${esc(e.message || '')}</div>`; }
}
document.addEventListener('keydown', e => { if (!BV.id || /INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || '')) return; if (e.key === 'Escape') bkViewClose(); else if (e.key === 'ArrowLeft') bkGo(BV.n + 1); else if (e.key === 'ArrowRight') bkGo(BV.n - 1); });
