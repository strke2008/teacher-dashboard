'use strict';
/* ═════════ 🎯 المهارات = نواتج تعلم نافس ═════════
   بدل أن يخترع التصنيف بالذكاء الاصطناعي اسم مهارة جديدًا لكل نشاط (فتتفرّق الإجابات على مئات الأسماء
   ولا تكفي لقياس الخطة)، صارت القائمة الرسمية هي نواتج نافس للفصل الدراسي (NAFS_SECTIONS).
   • التصنيف عند النشر يختار من القائمة؛ وما لا يناسبه أي ناتج يُكتب «خارج: …» ويبقى باسمه.
   • المهارات القديمة تُطابَق مرة واحدة بالناتج المقابل (جدول skill-alias في الخادم) — بلا إعادة تصنيف،
     فتلتقي إجاباتها السابقة مع الناتج، وتبقى الخطط القديمة تُقاس عليه. */
let SKILL_ALIAS = {};
const SKA = { rows: [], busy: false, only: false };
function skOutcomes(term) {
  if (typeof NAFS_SECTIONS === 'undefined') return [];
  const t = term || ((typeof ctSem === 'function' && ctSem().sem) || 1);
  return NAFS_SECTIONS.filter(s => s.term === t).flatMap(s => s.outcomes.map(([id, short, text]) => ({ id, short, text, sec: s.title, term: s.term, key: NAFS_SK + short })));
}
function skAllOutcomes() { const t = (typeof ctSem === 'function' && ctSem().sem) || 1; return skOutcomes(t).concat(skOutcomes(t === 1 ? 2 : 1)); }
function skNorm(s) {
  return String(s || '').replace(/^نافس:\s*/, '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[«»"'().،,:؛\-–]/g, ' ').split(/\s+/).map(w => w.replace(/^(وال|بال|كال|فال|لل|ال)/, '')).filter(w => w.length > 1)
    .map(w => SK_STEM[w] || w).join(' ').trim();
}
/* جموع ومترادفات شائعة في أسماء المهارات ← مفرد واحد، حتى يلتقي «النموذج» و«النماذج» */
const SK_STEM = { نماذج: 'نموذج', نموذجي: 'نموذج', قوانين: 'قانون', متغيرات: 'متغير', مخاليط: 'مخلوط', صخور: 'صخر', معادن: 'معدن', ملاحظات: 'ملاحظه',
  تنبو: 'توقع', تنبؤ: 'توقع', توقعات: 'توقع', استدلال: 'ملاحظه', تصنيفات: 'تصنيف', فرع: 'فروع', وفروع: 'فروع', قوي: 'قوه', نظريه: 'تفسير', تفسيرات: 'تفسير', فرضيه: 'تفسير' };
const SK_WEAK = new Set(['علمي', 'علميه', 'علم', 'مفهوم', 'تعريف', 'انواع', 'نوع', 'حساب', 'خصائص', 'قوه', 'تصنيف', 'استخدام']);   // كلمات عامة لا تكفي وحدها للمطابقة
function skCanon(s) { const k = String(s || '').trim(), v = SKILL_ALIAS[k]; return v && v !== '__off__' ? v : k; }
const skIsOutcome = k => typeof nafsIsSkill === 'function' && nafsIsSkill(k);
/* 🔒 قائمة مغلقة: اسم أعاده الذكاء الاصطناعي ← الناتج الرسمي (نصًا، أو بأقرب تطابق قوي في الكلمات)، وإلا «بلا مهارة».
   لا يُنشأ اسم مهارة جديد خارج نواتج نافس — كان «خارج: …» يفرّق إجابات المهارة الواحدة على أسماء متعددة */
function skFromAI(v) {
  let s = String(v || '').trim().replace(/^خارج\s*[:：]\s*/, ''); if (!s || /^(لا شيء|لاشيء|none|-)$/i.test(s)) return '';
  const n = skNorm(s), all = skAllOutcomes(), hit = all.find(o => o.key === s || o.short === s || skNorm(o.short) === n);
  if (hit) return hit.key;
  const c = skCanon(s); if (skIsOutcome(c)) return c;
  return skGuess(s) || '';
}
/* اقتراح محلي بلا ذكاء اصطناعي: أعلى تشابه في الكلمات (≥ النصف) */
function skGuess(name) {
  const a = new Set(skNorm(name).split(' ').filter(Boolean)); if (!a.size) return '';
  let best = '', bs = 0;
  skAllOutcomes().forEach(o => { const b = new Set(skNorm(o.short).split(' ').filter(Boolean)); let i = 0, strong = 0; a.forEach(w => { if (b.has(w)) { i++; if (!SK_WEAK.has(w)) strong++; } });
    if (!strong) return;   // لا مطابقة بكلمة عامة وحدها
    const sc = Math.max(i / Math.max(a.size, b.size), b.size <= 2 ? strong / b.size : 0); if (sc > bs) { bs = sc; best = o.key; } });
  return bs >= 0.5 ? best : '';
}
/* تعليمات التصنيف للذكاء الاصطناعي: قائمة مغلقة من نواتج الفصل الدراسي */
/* تعليمات التصنيف: نواتج الفصلين كلها (النشاط القديم من الفصل الأول يُصنَّف صحيحًا ولو صُنّف في الفصل الثاني)، مجمّعة بالوحدة */
function skOutcomeHint() {
  const o = skAllOutcomes(); if (!o.length) return '';
  const by = {}; o.forEach(x => { (by[x.sec] = by[x.sec] || []).push(x.short); });
  return `\nالمهارة يجب أن تكون أحد نواتج التعلم الرسمية (نافس) التالية فقط — اكتب اسم الناتج حرفيًا كما هو:\n${Object.entries(by).map(([u, L]) => `${u}: ${JSON.stringify(L)}`).join('\n')}\nإن لم يقس السؤالُ أيَّ ناتج منها بوضوح فاكتب «لا شيء» — لا تخترع اسم مهارة.`;
}
function skLegacyNames() {
  const d = (typeof HW !== 'undefined' ? HW : []).filter(h => h && h.kind === 'diag').flatMap(h => (h.qs || []).map(q => String(q && q.skill || '').trim()));
  return [...new Set([...(typeof SKILL_NAMES !== 'undefined' ? SKILL_NAMES : []), ...d])].filter(n => n && !skIsOutcome(n));
}
function skUnmappedCount() { return skLegacyNames().filter(n => !(n in SKILL_ALIAS)).length; }
function skOptionsHTML() {
  const t = (typeof ctSem === 'function' && ctSem().sem) || 1, groups = {};
  skAllOutcomes().forEach(o => { const g = `الفصل ${o.term === 1 ? 'الأول' : 'الثاني'} · ${o.sec}`; (groups[g] = groups[g] || []).push(o); });
  return `<option value="">— خارج النواتج (يبقى باسمه) —</option>` + Object.entries(groups).map(([g, os]) => `<optgroup label="${esc(g)}">${os.map(o => `<option value="${esc(o.key)}">${esc(o.short)}</option>`).join('')}</optgroup>`).join('');
}
async function skAliasOpen() {
  openModal(`<div id="ska-box"><div class="muted" style="padding:1rem">⏳ جارٍ جمع المهارات…</div></div>`);
  try { const j = await (await fetch(getApi().replace(/\/+$/, '') + '/skills-list?t=' + encodeURIComponent(getTok()), { cache: 'no-store' })).json();
    if (j && Array.isArray(j.names)) SKILL_NAMES = j.names.map(String).filter(Boolean); if (j && j.alias) SKILL_ALIAS = j.alias;
  } catch (e) {}
  SKA.rows = skLegacyNames().map(n => ({ n, v: n in SKILL_ALIAS ? (SKILL_ALIAS[n] === '__off__' ? '' : SKILL_ALIAS[n]) : skGuess(n), saved: n in SKILL_ALIAS }))
    .sort((a, b) => a.saved - b.saved || String(a.v).localeCompare(String(b.v), 'ar') || a.n.localeCompare(b.n, 'ar'));
  skAliasRender();
}
function skAliasRender() {
  const box = document.getElementById('ska-box'); if (!box) return;
  const R = SKA.rows, mapped = R.filter(r => r.v).length, opts = skOptionsHTML(), list = SKA.only ? R.filter(r => !r.saved) : R;
  box.innerHTML = `<h2 style="margin:0 0 .3rem">🎯 توحيد المهارات على نواتج نافس</h2>
    <p class="muted" style="font-size:.84rem;line-height:1.8;margin:.1rem 0 .6rem">كل مهارة صنّفها الذكاء الاصطناعي سابقًا تُطابَق بناتج تعلم رسمي، فتُجمع إجاباتها معه في «المستويات والمهارات» وتُقاس عليه الخطط — القديمة منها أيضًا. لا يُعاد تصنيف شيء ولا تضيع إجابة. ما لا يقابله ناتج اتركه «خارج النواتج».</p>
    ${R.length ? `<div class="row" style="gap:.4rem;flex-wrap:wrap;align-items:center;margin-bottom:.5rem">
      <span class="chip ghost">${R.length} مهارة قديمة</span><span class="chip tick">${mapped} مطابَقة</span><span class="chip ghost">${R.length - mapped} خارج النواتج</span>
      ${typeof twinHasKey === 'function' && twinHasKey() ? `<button class="btn sm" id="ska-ai" onclick="skAliasAI()" ${SKA.busy ? 'disabled' : ''}>${SKA.busy ? '⏳ يطابق…' : '🤖 اقترح بالذكاء الاصطناعي'}</button>` : ''}
      <label class="muted" style="font-size:.8rem;margin-inline-start:auto"><input type="checkbox" ${SKA.only ? 'checked' : ''} onchange="SKA.only=this.checked;skAliasRender()"> غير المحفوظة فقط</label></div>
    <div class="ska-list">${list.map(r => { const i = R.indexOf(r); return `<div class="ska-r ${r.v ? 'on' : ''}"><span class="ska-n">${esc(r.n)}${r.saved ? '' : ' <small class="ska-new">جديد</small>'}</span><span class="ska-arr">←</span>
      <select class="inp" onchange="SKA.rows[${i}].v=this.value;this.closest('.ska-r').classList.toggle('on',!!this.value)">${opts.replace(`value="${esc(r.v)}"`, `value="${esc(r.v)}" selected`)}</select></div>`; }).join('') || '<div class="muted" style="padding:.8rem">كل المهارات محفوظة.</div>'}</div>`
    : '<div class="feature-empty">✅ لا توجد مهارات قديمة — كل التصنيفات على نواتج نافس.</div>'}
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إغلاق</button>${R.length ? '<button class="btn tick" onclick="skAliasSave()">💾 حفظ المطابقة</button>' : ''}</div>`;
}
async function skAliasAI() {
  if (SKA.busy) return; SKA.busy = true; skAliasRender();
  const outs = skAllOutcomes(), idx = Object.fromEntries(outs.map(o => [o.id, o.key]));
  try {
    for (let k = 0; k < SKA.rows.length; k += 40) {
      const chunk = SKA.rows.slice(k, k + 40).map((r, j) => ({ i: k + j, s: r.n }));
      const p = readingAIPickProvider(), model = twinModel(p);
      const prompt = `لديك أسماء مهارات علوم (الصف الأول المتوسط) وقائمة نواتج تعلم رسمية. طابق كل مهارة بالناتج الذي تقيسه فعلًا، أو "0" إن لم يقابلها ناتج بوضوح (لا تطابق تخمينًا).
النواتج: ${JSON.stringify(outs.map(o => ({ id: o.id, n: o.short })))}
أخرج JSON فقط: {"m":{"<i>":"<id أو 0>"}}
المهارات: ${JSON.stringify(chunk)}`;
      const d = aiSafeJson(await readingAICall(p, model, prompt, new AbortController().signal)) || {}, m = d.m || {};
      chunk.forEach(c => { const id = String(m[c.i] ?? m[String(c.i)] ?? '').trim(); const r = SKA.rows[c.i]; if (r.saved) return; r.v = id && id !== '0' && idx[id] ? idx[id] : ''; });
      skAliasRender();
    }
    toast('🤖 اقتُرحت المطابقة — راجعها ثم احفظ', 'good');
  } catch (e) { toast('تعذّر الاقتراح: ' + (e && e.message || e), 'bad'); }
  finally { SKA.busy = false; skAliasRender(); }
}
async function skAliasSave() {
  const map = Object.fromEntries(SKA.rows.map(r => [r.n, r.v || '__off__']));   // __off__: «خارج النواتج» محفوظ (لا يعود «جديد»)
  try { const j = await (await fetch(getApi().replace(/\/+$/, '') + '/skill-alias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: getTok(), map }) })).json();
    if (!j || !j.ok) throw new Error(j && j.error || '');
    SKILL_ALIAS = j.alias || {}; closeModal();
    toast(`🎯 حُفظت المطابقة — ${SKA.rows.filter(r => r.v).length} مهارة صارت على نواتج نافس`, 'good');
    try { CT_GRADES = null; if (typeof renderClassTools === 'function' && document.querySelector('.sk-views,.ct-tools')) renderClassTools(); } catch (e) {}
  } catch (e) { toast(/unauthorized|not found|404/.test(String(e && e.message)) ? 'انشر worker.js الأخير أولًا' : 'تعذّر الحفظ — تحقق من الاتصال', 'bad'); }
}
