'use strict';
/* ⏳ الجزء المؤجَّل من js/32-nafs-js.js — يُحمَّل في الخلفية بعد ظهور اللوحة (js/46-lazy.js) ولا يُذكر في index.html كسكربت.
   فيه فقط دوال تُستدعى من الأزرار (نصوص onclick)؛ وما يحتاجه الفتح أو أي ملف آخر بالاسم بقي في js/32-nafs-js.js.
   الفاصل يحسبه tests/lazy-split (اختبار «سلامة التقسيم»): لا تنادِ دالة من هنا مباشرة في ملف آخر — ضعها في الملف الأصلي. */

function nafsTerm(n) { NAFS.term = n === 2 ? 2 : 1; NAFS.open = ''; try { localStorage.setItem('nafs_term_v1', String(NAFS.term)); } catch (e) {} nafsRender(); }
function nafsPick(id, on) { if (on) NAFS.pick.add(id); else NAFS.pick.delete(id); nafsRender(); }

/* ✍️ نشاط للطلاب: أسئلة الأقسام المختارة التي تُصحَّح آليًا، كل سؤال بناتج تعلمه وشكله */
function nafsMakeActivity() {
  const secs = nafsPicked(), ids = new Set(secs.map(s => s.id)), qs = NAFS_BANK.filter(q => ids.has(q.s) && nafsAuto(q) && nafsIn(q)).map(nafsToQ);
  if (!qs.length) return;
  const title = 'نافس — ' + (secs.length === nafsSecs().length ? `علوم ${NAFS_TERMS[NAFS.term].replace('الدراسي ', '')} (شامل)` : secs.length > 2 ? `علوم ${NAFS_TERMS[NAFS.term].replace('الدراسي ', '')} (${secs.length} أقسام)` : secs.map(s => s.title).join(' + '));
  // مسودة نافس لم تُنشر بالأقسام نفسها: تُفتح هي بدل إنشاء نسخة مكررة عند كل ضغطة
  const key = secs.map(s => s.id).sort().join();
  const draft = HW.find(x => x && Array.isArray(x.nafs) && !hwEverPublished(x) && x.nafs.slice().sort().join() === key);
  if (draft) { draft.qs = qs; save(K.hw, HW); toast(`✍️ لديك مسودة «${draft.title}» لم تُنشر — فتحناها لك بدل إنشاء نسخة جديدة`, 'good'); try { goTab('hw'); } catch (e) {} setTimeout(() => { try { openHwForm(draft.id); } catch (e) {} }, 350); return; }
  const h = { id: uid(), title, cls: '', clsList: [], due: '', pts: 30, max: 20, kind: 'normal', noGrade: true, nafs: secs.map(s => s.id), nfMode: 'train', nfSec: 90, qs, subs: {}, at: Date.now() };
  HW.push(h); save(K.hw, HW);
  toast(`✍️ أُنشئ «${title}» بـ ${qs.length} سؤال — حدّد الفصل وموعد الإغلاق ثم انشره`, 'good');
  try { goTab('hw'); } catch (e) {}
  setTimeout(() => { try { openHwForm(h.id); } catch (e) {} }, 350);
}
function nafsFormTerm(n) { NAFS_F.term = n === 2 ? 2 : 1; NAFS_F.pick = new Set(NAFS_SECTIONS.filter(s => s.term === NAFS_F.term).map(s => s.id)); nafsFormRefresh(); }
function nafsFormPick(id, on) { if (on) NAFS_F.pick.add(id); else NAFS_F.pick.delete(id); nafsFormRefresh(); }

/* 🖨️ ورقة مطبوعة (كل الأسئلة بأشكالها) أو نموذج الإجابة
   - ترويسة الطالب: اسم بسطر كتابة عريض + الفصل + التاريخ + الدرجة من مجموع الأسئلة
   - الخيارات القصيرة في ٤ أعمدة، والطويلة في عمودين أو عمود — توفّر الورق
   - الشكل المكرر في سؤالين متتاليين يُطبع مرة واحدة · ناتج التعلم يظهر في نموذج الإجابة فقط
   - نموذج الإجابة يبدأ بجدول إجابات سريع للتصحيح */
function nafsPrint(key) {
  const secs = nafsPicked(); if (!secs.length) return;
  ensureLogo();
  let box = document.getElementById('plan-print'); if (!box) { box = document.createElement('div'); box.id = 'plan-print'; box.className = 'rep'; document.body.appendChild(box); }
  const all = secs.flatMap(s => NAFS_BANK.filter(q => q.s === s.id && nafsIn(q)));
  const total = all.length;
  let n = 0, prevImg = '';
  const optCols = q => { const m = Math.max(...q.op.map(o => String(o).length)); return m <= 16 ? 4 : m <= 42 ? 2 : 1; };
  const qHTML = q => { n++;
    const img = (q.img && q.img === prevImg ? '<div class="nfp-same">↑ الشكل في السؤال السابق</div>' : q.img ? `<img src="${nafsImg(q)}" alt="">` : '') + (q.fig ? nfFigHTML(q.fig) : '');
    prevImg = q.img || '';
    const body = q.t === 'q' ? `<ol class="nfp-o c${optCols(q)}">${q.op.map((o, j) => `<li class="${key && j === q.a ? 'ok' : ''}"><i></i>${L4[j] || j + 1}) ${esc(o)}</li>`).join('')}</ol>`
      : q.t === 'tf' ? `<div class="nfp-tf"><span class="${key && q.a ? 'ok' : ''}"><i></i> صح</span><span class="${key && !q.a ? 'ok' : ''}"><i></i> خطأ</span></div>`
      : q.t === 'f' ? `<div class="nfp-fill">الإجابة: <span class="nfp-box">${key ? `<b class="nfp-ans">${esc(q.a)}</b>` : ''}</span></div>`
      : `${key ? `<div class="nfp-key">${esc(q.key || '').replace(/\n/g, '<br>')}</div>` : '<div class="nfp-line"></div><div class="nfp-line"></div><div class="nfp-line"></div>'}`;
    return `<div class="nfp-q"><div class="nfp-qh"><b>${n}</b><span>${esc(q.q).replace(/\n/g, '<br>')}</span></div>${img}${body}
      ${key && q.note ? `<div class="nfp-note">${esc(q.note)}</div>` : ''}${key ? `<small class="nfp-out">🎯 ${esc((NAFS_OUT[q.o]||{}).short||'ناتج غير معروف')} · ${q.k === 'off' ? 'مفتاح رسمي' : q.k === 'add' ? 'سؤال إضافي' : q.k === 'ai' ? 'مولّد بالذكاء الاصطناعي' : 'مفتاح مقترح'}</small>` : ''}</div>`; };
  const keyGrid = key ? `<div class="nfp-grid">${all.map((q, i) => `<span><b>${i + 1}</b>${q.t === 'q' ? (L4[q.a] || q.a + 1) : q.t === 'tf' ? (q.a ? 'صح' : 'خطأ') : q.t === 'f' ? esc(q.a) : '✎'}</span>`).join('')}</div>
      <div class="nfp-hint">✎ = سؤال مقالي، نموذج إجابته في موضعه أدناه.</div>` : '';
  box.innerHTML = `<div class="rep-page nfp">${repHead(key ? 'نموذج الإجابة — للمعلم' : 'تدريب على الاختبارات الوطنية', key ? 'نافس — نموذج الإجابة' : 'اختبار نافس — علوم')}
    <div class="rep-in">${key ? keyGrid : `<div class="nfp-id">
        <div class="nfp-name"><span>اسم الطالب</span><i></i></div>
        <div><span>الفصل</span><i></i></div>
        <div><span>التاريخ</span><i></i></div>
        <div class="nfp-score"><span>الدرجة</span><i></i><em>من ${total}</em></div>
      </div>`}
    ${secs.map(s => `<div class="nfp-sec">${s.ic} ${esc(s.title)}<small>${NAFS_BANK.filter(q => q.s === s.id && nafsIn(q)).length} سؤال</small></div><div class="nfp-qs">${NAFS_BANK.filter(q => q.s === s.id && nafsIn(q)).map(qHTML).join('')}</div>`).join('')}
    <div class="nfp-end">— انتهت الأسئلة — راجع إجاباتك قبل التسليم ✓</div></div></div>`;
  unifiedA4Print({ bodyClass: 'printing-plans', title: key ? 'نافس — نموذج الإجابة' : 'اختبار نافس — علوم', selector: '#plan-print', orientation: 'portrait', margin: '8mm' });
}
/* ③ من تبويب نافس: خطة لمن يحتاجون دعمًا في ناتج */
function nafsPlanFor(outId) {
  const o = NAFS_OUT[outId]; if (!o) return;
  const cls = NAFS.cls || '', roster = (STUDENTS || []).filter(s => !cls || String(s.cls || '') === cls), ids = new Set(roster.map(s => String(s.id)));
  const weak = [];
  ids.forEach(id => { const r = nafsStudentOutcomes(id)[outId]; const p = r && nafsPct(r.b); if (p != null && p < 60) weak.push({ id, p }); });
  if (!weak.length) { toast('لا طلاب دون 60% في هذا الناتج', 'good'); return; }
  try { goTab('plans'); } catch (e) {}
  setTimeout(() => {
    openPlanForm();
    const k = NAFS_SK + o.short, avg = Math.round(weak.reduce((t, x) => t + x.p, 0) / weak.length);
    if (weak.length > 1) { const cb = document.getElementById('pf-group'); if (cb) cb.checked = true; window._pfMembers = weak.map(x => x.id); }
    else { const sel = document.getElementById('pf-student'); if (sel) sel.value = weak[0].id; window._pfSid = weak[0].id; }
    window._pfSkills = [k]; window._pfPattern = 'gap'; window._pfActions = skActions(k, avg);
    const rs = document.getElementById('pf-reason'); if (rs) rs.value = `فجوة في ناتج تعلم نافس — ${o.short} (${weak.length > 1 ? 'متوسط المجموعة' : 'إتقانه'} ${avg}%)`;
    renderPlanMembers(); renderPlanActions(); renderPlanSkills();
  }, 350);
}
function nafsToggleQ(id, on) { if (on) NAFS_CUS.ex.delete(id); else NAFS_CUS.ex.add(id); nafsCusSave(); nafsRender(); }
function nafsSelAll(sec, on) { NAFS_BANK.filter(q => q.s === sec).forEach(q => { if (on) NAFS_CUS.ex.delete(q.id); else NAFS_CUS.ex.add(q.id); }); NAFS.open = sec; nafsCusSave(); nafsRender(); }
async function nafsDelQ(id) {
  if (!(await askConfirm('سيُحذف هذا السؤال المولّد من بنك نافس (الأنشطة المنشورة به لا تتأثر).', { title: 'حذف السؤال؟', yes: '🗑️ حذف', no: 'إلغاء', danger: true }))) return;
  const x = NAFS_BANK.find(q => q.id === id); NAFS.open = x ? x.s : NAFS.open;
  NAFS_CUS.items = NAFS_CUS.items.filter(q => q.id !== id); NAFS_CUS.ex.delete(id);
  const i = NAFS_BANK.findIndex(q => q.id === id); if (i >= 0) NAFS_BANK.splice(i, 1);
  nafsCusSave(); nafsRender();
}

/* ✦ نافذة التوليد */
const NAFS_GEN = { sec: '', items: [], busy: false, ac: null, img: null, imgUrl: '' };
function nafsGenOpen(sec) {
  const s = NAFS_SECTIONS.find(x => x.id === sec); if (!s) return;
  if (typeof twinHasKey === 'function' && !twinHasKey()) { toast('أضف مفتاح ذكاء اصطناعي من ⚙️ الإعدادات أولًا', 'bad'); return; }
  NAFS_GEN.sec = sec; NAFS_GEN.items = []; NAFS_GEN.img = null; NAFS_GEN.imgUrl = ''; NAFS.open = sec;
  const cnt = o => NAFS_BANK.filter(q => q.o === o && nafsAuto(q)).length;
  openModal(`<h2>✦ توليد أسئلة نافس — ${s.ic} ${esc(s.title)}</h2>
    <p class="muted" style="font-size:.84rem;margin:.2rem 0 .7rem;line-height:1.8">يكتب الذكاء الاصطناعي أسئلة جديدة بأسلوب نافس على النواتج التي تختارها — بلا شكل، أو مع جدول ورسم بياني يُرسم من بياناته، أو مبنية على صورة ترفعها — ثم تراجعها وتختار ما يُضاف للبنك. لكل سؤال «لماذا؟» يظهر للطالب بعد إجابته.</p>
    <div class="field"><label>نواتج التعلم</label><div class="nafs-gen-outs">${s.outcomes.map(([id, sh]) => `<label><input type="checkbox" class="nafs-gen-o" value="${id}" ${cnt(id) < 4 ? 'checked' : ''}> ${esc(sh)} <small class="muted">(${cnt(id)} سؤال)</small></label>`).join('')}</div></div>
    <div class="grid2"><div class="field"><label>عدد الأسئلة</label><select class="inp" id="nafs-gen-n">${[3, 5, 8, 10].map(n => `<option ${n === 5 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label>النوع</label><select class="inp" id="nafs-gen-t"><option value="q">اختيار من متعدد</option><option value="mix">مزيج (اختيار + صح وخطأ)</option><option value="tf">صح وخطأ</option></select></div></div>
    <div class="field"><label>الشكل</label><select class="inp" id="nafs-gen-f" onchange="document.getElementById('nafs-gen-imgw').style.display=this.value==='img'?'':'none'">
      <option value="none">بلا شكل (نص فقط)</option><option value="data">📊 مع شكل بيانات (جدول أو أعمدة أو منحنى)</option><option value="img">🖼️ من صورة أرفعها (الأسئلة مبنية على الصورة)</option></select></div>
    <div id="nafs-gen-imgw" style="display:none" class="field"><label>الصورة (شكل من الكتاب أو تجربة أو رسم)</label><input type="file" accept="image/*" class="inp" id="nafs-gen-img" onchange="nafsGenImgPrev(this)"><div id="nafs-gen-imgp"></div>
      <small class="muted">تُرسل للذكاء الاصطناعي ليقرأها ويكتب أسئلة عليها، وتُرفق بكل سؤال يُولّد منها. تحتاج نموذجًا يرى الصور (Claude أو Gemini أو OpenAI).</small></div>
    <div id="nafs-gen-out"></div>
    <div class="modal-foot"><button class="btn ghost" onclick="nafsGenStop();closeModal()">إغلاق</button><button class="ai-btn" id="nafs-gen-go" onclick="nafsGenRun()"><span class="ai-mark">✦</span> ولّد الأسئلة</button></div>`);
}
function nafsGenStop() { try { NAFS_GEN.ac && NAFS_GEN.ac.abort(); } catch (e) {} }
function nafsGenPrompt(s, outs, n, type, fmode) {
  const ex = NAFS_BANK.filter(q => outs.includes(q.o) && nafsAuto(q)).slice(0, 14).map(q => '- ' + String(q.q).replace(/\s+/g, ' ').slice(0, 110));
  const types = type === 'tf' ? 'صح وخطأ فقط ("t":"tf" و"a": true أو false)' : type === 'mix' ? 'أغلبها اختيار من متعدد بأربعة خيارات ("t":"q") وبعضها صح وخطأ ("t":"tf")' : 'اختيار من متعدد فقط بأربعة خيارات ("t":"q")';
  return `أنت خبير في بناء أسئلة الاختبارات الوطنية (نافس) والدولية (TIMSS) في العلوم، للصف الأول المتوسط في المملكة العربية السعودية.
القسم: ${s.title} — الدروس: ${s.lessons}
اكتب ${n} أسئلة جديدة موزعة بالتساوي تقريبًا على نواتج التعلم التالية (استخدم معرّف الناتج في الحقل "o"):
${outs.map(o => `- [${o}] ${NAFS_OUT[o].text}`).join('\n')}
الشروط:
- تقيس الفهم والتطبيق والاستدلال لا الحفظ فقط، بسياقات من الحياة اليومية والبيئة السعودية، بأسلوب أسئلة نافس.
${fmode === 'data' ? `- لكل سؤال شكل بيانات في الحقل "fig" لا يُجاب السؤال إلا بقراءته (قراءة قيمة، مقارنة، اتجاه، حساب)، بأحد الأشكال:
  جدول: {"type":"table","title":"...","head":["...","..."],"rows":[["...","..."]]}
  أعمدة: {"type":"bar","title":"...","x":"عنوان المحور الأفقي","y":"عنوان المحور الرأسي مع الوحدة","labels":["..."],"values":[أرقام]}
  منحنى: {"type":"line","title":"...","x":"...","y":"...","series":[{"name":"...","pts":[[س,ص],[س,ص]]}]}
  الأرقام في الشكل يجب أن تطابق الإجابة الصحيحة تمامًا (تحقق من حسابك)، ولا تكرر البيانات داخل نص السؤال بل قل «من الشكل…». نوّع بين الجداول والأعمدة والمنحنيات.`
  : fmode === 'img' ? `- أرفقتُ صورة شكل علمي: اكتب أسئلة لا يُجاب عنها إلا بتأمل ما يظهر في الصورة فعلًا (أشِر إليها بـ«الشكل»)، ولا تفترض تفاصيل غير ظاهرة فيها، ولا تصف الإجابة داخل نص السؤال. إن لم تناسب الصورة الناتج المختار فاختر من النواتج المذكورة الأقرب لما تُظهره.`
  : '- لا تعتمد على شكل أو صورة أو جدول خارج النص؛ إن احتجت بيانات فاكتبها داخل نص السؤال.'}
- إجابة صحيحة واحدة مؤكدة علميًا ومطابقة لمنهج المرحلة، ومشتتات معقولة، ولغة عربية فصيحة واضحة.
- الأنواع: ${types}. في الاختيار من متعدد "op" أربعة خيارات و"a" رقم الصحيح بدءًا من 0.
- "why": سطر واحد للطالب يشرح لماذا الإجابة صحيحة، بلا ذكر رقم الخيار أو حرفه.
- كل سؤال مستقل بذاته: لا تشر إلى «السؤال السابق» أو «المسألة السابقة» أو «الجدول نفسه»، فالأسئلة تُخلط وقد يظهر أي سؤال وحده.
- لا تكرر هذه الأسئلة الموجودة ولا تعيد صياغتها:
${ex.join('\n') || '- (لا يوجد)'}
أخرج JSON فقط بهذا الشكل: {"items":[{"o":"${outs[0]}","t":"q","q":"...","op":["...","...","...","..."],"a":0,"why":"..."${fmode === 'data' ? ',"fig":{"type":"bar","title":"...","x":"...","y":"...","labels":["..."],"values":[1,2]}' : ''}}]}`;
}
function nafsGenClean(it, outs, type, fmode) {
  if (!it || typeof it !== 'object') return null;
  const o = String(it.o || '').trim(), q = String(it.q || '').trim(), why = String(it.why || '').trim().slice(0, 300);
  if (!outs.includes(o) || q.length < 8) return null;
  const t = it.t === 'tf' ? 'tf' : 'q';
  if (type === 'q' && t !== 'q') return null; if (type === 'tf' && t !== 'tf') return null;
  const fig = fmode === 'data' ? nfFigClean(it.fig) : null;
  if (fmode === 'data' && !fig) return null;                                   // سؤال شكل بلا شكل صالح لا يُقبل
  const fx = fig ? { fig } : {};
  if (t === 'tf') { const a = it.a === true || it.a === 'true' ? true : it.a === false || it.a === 'false' ? false : null; return a === null ? null : { t, q, a, o, why, ...fx }; }
  const op = (Array.isArray(it.op) ? it.op : Array.isArray(it.o_list) ? it.o_list : []).map(x => String(x ?? '').trim()).filter(Boolean);
  const a = parseInt(it.a, 10);
  if (op.length < 3 || op.length > 5 || !(a >= 0 && a < op.length) || new Set(op).size !== op.length) return null;
  const order = op.map((_, i) => i).sort(() => Math.random() - .5);          // الصحيح لا يبقى في موضع ثابت
  return { t, q, op: order.map(i => op[i]), a: order.indexOf(a), o, why, ...fx };
}
async function nafsGenRun() {
  if (NAFS_GEN.busy) return;
  const s = NAFS_SECTIONS.find(x => x.id === NAFS_GEN.sec); if (!s) return;
  const outs = [...document.querySelectorAll('.nafs-gen-o:checked')].map(x => x.value);
  if (!outs.length) { toast('اختر ناتجًا واحدًا على الأقل', 'bad'); return; }
  const n = +document.getElementById('nafs-gen-n').value || 5, type = document.getElementById('nafs-gen-t').value, fmode = document.getElementById('nafs-gen-f').value;
  if (fmode === 'img' && !NAFS_GEN.img) { toast('اختر الصورة أولًا', 'bad'); return; }
  const box = document.getElementById('nafs-gen-out'), go = document.getElementById('nafs-gen-go');
  NAFS_GEN.busy = true; if (go) go.disabled = true;
  box.innerHTML = `<div class="nafs-gen-wait">⏳ يكتب الذكاء الاصطناعي ${n} أسئلة… <button type="button" class="btn ghost sm" onclick="nafsGenStop()">إيقاف</button></div>`;
  let items = [];
  try {
    const { p, m: model } = aiRoute('nafs'), ac = new AbortController(); NAFS_GEN.ac = ac; let timer;
    if (fmode === 'img' && !NAFS_GEN.imgUrl) { box.innerHTML = '<div class="nafs-gen-wait">⏳ نرفع الصورة…</div>'; NAFS_GEN.imgUrl = await nafsImgUpload(NAFS_GEN.img); box.innerHTML = `<div class="nafs-gen-wait">⏳ يقرأ الذكاء الاصطناعي الصورة ويكتب ${n} أسئلة… <button type="button" class="btn ghost sm" onclick="nafsGenStop()">إيقاف</button></div>`; }
    const raw = await Promise.race([readingAICall(p, model, nafsGenPrompt(s, outs, n, type, fmode), ac.signal, fmode === 'img' ? NAFS_GEN.img : undefined),
      new Promise((_, rej) => { timer = setTimeout(() => { try { ac.abort(); } catch (e) {} rej(new Error('انتهت المهلة (دقيقتان) دون رد')); }, 120000); })]).finally(() => { clearTimeout(timer); NAFS_GEN.ac = null; });
    const d = aiSafeJson(raw), arr = Array.isArray(d && d.items) ? d.items : Array.isArray(d) ? d : [];
    const seen = new Set(NAFS_BANK.map(q => String(q.q).replace(/\s+/g, ' ').trim()));
    items = arr.map(it => nafsGenClean(it, outs, type, fmode)).filter(Boolean).filter(x => !seen.has(x.q.replace(/\s+/g, ' ').trim()));
    if (fmode === 'img') items.forEach(x => { x.img = NAFS_GEN.imgUrl; });
    if (!items.length) throw new Error('لم يرجع الذكاء الاصطناعي أسئلة صالحة — أعد المحاولة');
  } catch (e) {
    box.innerHTML = `<div class="nafs-gen-err">⚠️ ${esc(e && e.message ? e.message : String(e))}</div>`;
    NAFS_GEN.busy = false; if (go) go.disabled = false; return;
  }
  NAFS_GEN.busy = false; if (go) { go.disabled = false; go.innerHTML = '<span class="ai-mark">✦</span> ولّد غيرها'; }
  NAFS_GEN.items = items;
  box.innerHTML = `<div class="nafs-gen-res"><b>راجع الأسئلة واختر ما يُضاف (${items.length})</b>
    ${items.map((x, i) => `<label class="nafs-gen-q"><input type="checkbox" class="nafs-gen-pick" value="${i}" checked>
      <div><small class="chip ghost">🎯 ${esc(NAFS_OUT[x.o].short)} · ${x.t === 'tf' ? 'صح/خطأ' : 'اختيار'}</small><div class="nafs-q-t">${esc(x.q)}</div>${x.img && i === 0 ? `<img class="nafs-q-img" src="${esc(x.img)}" alt="">` : ''}${x.fig ? nfFigHTML(x.fig) : ''}
      ${x.t === 'q' ? `<ol class="nafs-q-o">${x.op.map((o, j) => `<li class="${j === x.a ? 'ok' : ''}">${L4[j] || j + 1}) ${esc(o)}</li>`).join('')}</ol>` : `<div class="nafs-q-a">✔ ${x.a ? 'صح' : 'خطأ'}</div>`}
      ${x.why ? `<div class="nafs-q-n">💬 لماذا؟ ${esc(x.why)}</div>` : ''}</div></label>`).join('')}
    <button type="button" class="btn tick" style="margin-top:.6rem" onclick="nafsGenAdd()">＋ أضف المحدد إلى بنك نافس</button></div>`;
}
function nafsGenAdd() {
  const picks = [...document.querySelectorAll('.nafs-gen-pick:checked')].map(x => NAFS_GEN.items[+x.value]).filter(Boolean);
  if (!picks.length) { toast('اختر سؤالًا واحدًا على الأقل', 'bad'); return; }
  const base = Date.now().toString(36);
  picks.forEach((x, i) => { const it = { id: 'g' + base + i, s: NAFS_GEN.sec, k: 'ai', at: Date.now(), ...x }; NAFS_CUS.items.push(it); NAFS_BANK.push(it); });
  nafsCusSave(); closeModal(); NAFS.open = NAFS_GEN.sec; nafsRender();
  toast(`✦ أُضيف ${picks.length} ${picks.length === 1 ? 'سؤال' : 'أسئلة'} إلى «${NAFS_SECTIONS.find(s => s.id === NAFS_GEN.sec).title}» — تدخل الاختبار تلقائيًا`, 'good');
}

/* 🖼️ صورة يرفعها المعلم: تُصغَّر على الجهاز (≤ 1200px، JPEG) ثم تُخزَّن في الخادم ويُستخدم رابطها */
function nafsImgPrep(file) {
  return new Promise((res, rej) => {
    if (!file || !/^image\//.test(file.type)) { rej(new Error('اختر ملف صورة')); return; }
    const fr = new FileReader();
    fr.onload = () => { const im = new Image(); im.onload = () => {
        const k = Math.min(1, 1200 / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/jpeg', .85); res({ type: 'image/jpeg', b64: url.split(',')[1], dataUrl: url }); };
      im.onerror = () => rej(new Error('تعذّرت قراءة الصورة')); im.src = fr.result; };
    fr.onerror = () => rej(new Error('تعذّرت قراءة الملف')); fr.readAsDataURL(file);
  });
}
async function nafsImgUpload(img) {
  if (!getApi() || !getTok()) throw new Error('اضبط رابط الخادم ورمز المعلم أولًا');
  const r = await fetch(getApi().replace(/\/+$/, '') + '/nafs-img', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: getTok(), type: img.type, b64: img.b64 }) });
  const j = await r.json().catch(() => null);
  if (r.status === 404 || !j) throw new Error('ارفع worker.js الأخير لحفظ الصور');
  if (!r.ok || !j.ok || !j.url) throw new Error('تعذّر رفع الصورة');
  return j.url;
}
async function nafsGenImgPrev(inp) {
  const box = document.getElementById('nafs-gen-imgp'); NAFS_GEN.img = null; NAFS_GEN.imgUrl = '';
  try { NAFS_GEN.img = await nafsImgPrep(inp.files && inp.files[0]); box.innerHTML = `<img class="nafs-q-img" src="${NAFS_GEN.img.dataUrl}" alt="">`; }
  catch (e) { box.innerHTML = `<div class="nafs-gen-err">⚠️ ${esc(e.message)}</div>`; }
}
function nafsImgAttach(id) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const it = NAFS_CUS.items.find(q => q.id === id); if (!it) return;
    try { toast('⏳ نرفع الصورة…'); const url = await nafsImgUpload(await nafsImgPrep(inp.files[0])); it.img = url; NAFS.open = it.s; nafsCusSave(); nafsRender(); toast('🖼️ أُرفقت الصورة بالسؤال', 'good'); }
    catch (e) { toast(e.message || 'تعذّر رفع الصورة', 'bad'); }
  };
  inp.click();
}
function nafsImgRemove(id) { const it = NAFS_CUS.items.find(q => q.id === id); if (!it) return; delete it.img; NAFS.open = it.s; nafsCusSave(); nafsRender(); }
