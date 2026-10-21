/* 🏛️ نظام نور: تعبئة درجات «الكشف الشامل» المصدَّرة من مساعد المعلم.
   - يطابق اسم الطالب في كل صف (<tr> فيه خانات إدخال) مع الكشف بأسماء مطبَّعة:
     الأول + العائلة إلزاميًا، والأب/الجد يرجّحان — فلا يُخلط الثلاثي بالرباعي. الاسم الملتبس لا يُعبّأ.
   - أوضاع: both (الأولى 40 · الثانية 20) · work40 · exam20.
   - يطلق input/change/blur بعد كل خانة (صفحات ASP.NET) ويلوّنها بالأخضر الفاتح.
   - الإطار العلوي يعبّئ نفسه وكل إطار فرعي من الأصل نفسه؛ الإطار من أصل آخر يعبّئ نفسه فقط. */
(() => {
  'use strict';
  if (window.__MB_NOOR__) return; window.__MB_NOOR__ = true;
  const norm = s => (globalThis.MB && MB.normalizeArabicName ? MB.normalizeArabicName(s) : String(s || '').trim());
  const isTop = window.top === window;
  let topSameOrigin = false;
  try { topSameOrigin = !isTop && !!window.top.document; } catch (_) { topSameOrigin = false; }
  // الإطار الفرعي من الأصل نفسه يتولاه الإطار العلوي
  if (!isTop && topSameOrigin) return;

  function docsOf(root) {
    const out = [root];
    for (const f of root.querySelectorAll('iframe,frame')) {
      try { const d = f.contentDocument; if (d && d.documentElement) out.push(...docsOf(d)); } catch (_) {}
    }
    return out;
  }
  const visible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const isField = i => i && /^(text|number|tel|)$/i.test(i.type || '') && visible(i);
  // الخانة المقفلة في نور (معتمدة/معفى/محسوبة) لا تُكتب: نور لا يرسلها عند الحفظ، فتظهر معبّأة وهي لم تُحفظ
  const editable = i => isField(i) && !i.disabled && !i.readOnly;
  function rowName(tr) {
    let best = '';
    for (const td of tr.querySelectorAll('td,th')) {
      if (td.querySelector('input,select,textarea')) continue;
      const t = (td.innerText || td.textContent || '').replace(/\s+/g, ' ').trim();
      const ar = (t.match(/[؀-ۿ]/g) || []).length;
      if (ar >= 6 && t.split(' ').length >= 2 && t.length > best.length) best = t;
    }
    return best;
  }
  function indexSheet(rows) {
    return rows.map(r => { const n = norm(r.name); return { r, n, t: n.split(' ').filter(Boolean) }; }).filter(x => x.t.length);
  }
  // كلمات القصير كلها بترتيبها داخل الطويل؟ (نور يزيد القبيلة آخر الاسم: «آل ضيف الله القحطاني»)
  function inOrder(short, long) { let j = 0; for (const w of long) if (w === short[j]) j++; return j === short.length; }
  function score(a, b) {             // a,b: مصفوفتا أجزاء الاسم
    if (a.join(' ') === b.join(' ')) return 100;
    if (a[0] !== b[0]) return 0;
    if (a[a.length - 1] === b[b.length - 1]) {
      const midA = a.slice(1, -1), midB = new Set(b.slice(1, -1));
      return 10 + midA.filter(x => midB.has(x)).length;
    }
    // الاسم الأقصر (3 كلمات فأكثر) موجود كاملًا وبترتيبه في الأطول — أضعف من تطابق الأول والأخير، ويُرفض عند التعادل
    const [sh, lg] = a.length <= b.length ? [a, b] : [b, a];
    return sh.length >= 3 && inOrder(sh, lg) ? 5 + sh.length / 10 : 0;
  }
  // يرجع {m} عند التطابق، أو {why} بسبب الرفض: none (ليس في الكشف) · tie (أكثر من طالب بالاسم نفسه)
  /* 🔗 ربط يدوي محفوظ: اسم نور (مطبَّع) ← اسم الكشف (مطبَّع). يُحفظ عند اختيار المعلم أو تأكيده مطابقة تقريبية */
  let ALIAS = {};
  const aliasLoad = async () => { try { ALIAS = (await chrome.storage.local.get('mb_noor_alias')).mb_noor_alias || {}; } catch (_) { ALIAS = {}; } };
  const aliasSave = () => { try { chrome.storage.local.set({ mb_noor_alias: ALIAS }); } catch (_) {} };
  aliasLoad();
  function match(name, idx, used) {
    // الربط اليدوي أولًا — ولا يأخذ غيرُه طالبًا مربوطًا إلا بتطابق تام
    const an = ALIAS[norm(name)];
    if (an) { const x = idx.find(y => y.n === an && !used.has(y)); if (x) return { m: x, also: [], exact: true, alias: true }; }
    const reserved = new Set(Object.values(ALIAS));
    const t = norm(name).split(' ').filter(Boolean); if (t.length < 2) return { why: 'none' };
    let bs = 0, top = [];
    for (const x of idx) { if (used.has(x)) continue; const s = score(t, x.t);
      if (s < 100 && reserved.has(x.n)) continue;
      if (s > bs) { bs = s; top = [x]; } else if (s && s === bs) top.push(x); }
    if (!bs) {
      // أقرب اسم في الكشف (الاسم الأول نفسه وأكثر كلمات مشتركة) — تلميح للمعلم ليصحّح الاسم في مساعد المعلم
      let hint = null, hs = 1;
      for (const x of idx) { if (used.has(x) || x.t[0] !== t[0]) continue; const c = x.t.filter(w => t.includes(w)).length; if (c > hs) { hs = c; hint = x; } }
      return { why: 'none', hint: hint ? hint.r.name : '' };
    }
    // الاسم مكرر في الكشف (طالب أُدخل مرتين) بدرجات متطابقة: لا التباس في الدرجة فيُعبّأ
    const same = top.every(x => fmt(x.r.work40) === fmt(top[0].r.work40) && fmt(x.r.exam20) === fmt(top[0].r.exam20));
    if (top.length > 1 && !same) return { why: 'tie', n: top.length };
    return { m: top[0], also: top.slice(1), exact: bs === 100 };
  }
  // يُعلَّم الصف الذي لم يُعبّأ بإطار أحمر وسبب يظهر عند الوقوف عليه
  const WHY = { none: 'الاسم غير موجود في كشف مساعد المعلم', tie: 'أكثر من طالب بهذا الاسم في الكشف بدرجات مختلفة', empty: 'لا درجة له في الكشف', nocell: 'لم أجد خانته تحت عمود الدرجة', locked: 'خانته مقفلة في نور' };
  function markRow(tr, why) {
    if (why) { tr.style.outline = '2px solid #D6455B'; tr.style.outlineOffset = '-2px'; tr.title = '⚠️ مساعد المعلم: ' + WHY[why]; tr.dataset.mbWhy = why; }
    else if (tr.dataset.mbWhy || tr.dataset.mbPv) { tr.style.outline = ''; tr.title = ''; delete tr.dataset.mbWhy; delete tr.dataset.mbPv; }
  }
  function setVal(inp, v) {
    const proto = Object.getPrototypeOf(inp), d = Object.getOwnPropertyDescriptor(proto, 'value');
    if (d && d.set) d.set.call(inp, v); else inp.value = v;
    for (const ev of ['input', 'change', 'blur']) inp.dispatchEvent(new Event(ev, { bubbles: true }));
    inp.style.background = '#E6F7EE';
  }
  const fmt = v => (v == null || v === '' ? '' : String(Math.round(Number(v) * 100) / 100));
  // «التقويمات التحريرية» فيها «ال» قبل الكلمة الثانية — بدونها لا يُعرف العمود أبدًا
  const WORK_RE = /مهام\s*(?:ال)?أدائية|مشاركة\s*و\s*(?:ال)?تفاعل/, EXAM_RE = /تقويمات\s*(?:ال)?تحريرية|اختبارات\s*(?:ال)?تحريرية/;
  // شبكة أعمدة الجدول مع colspan/rowspan: كل خلية ← رقم عمودها الفعلي (الرؤوس ذات المستويين تزيح الترقيم)
  const gridCache = new WeakMap();
  function grid(table) {
    if (gridCache.has(table)) return gridCache.get(table);
    const pos = new Map(), taken = [];
    [...table.rows].forEach((row, r) => {
      let c = 0;
      for (const cell of row.cells) {
        while (taken[r] && taken[r][c]) c++;
        const cs = Math.max(1, cell.colSpan || 1), rs = Math.max(1, cell.rowSpan || 1);
        pos.set(cell, { c, cs });
        for (let y = r; y < r + rs; y++) { taken[y] = taken[y] || []; for (let x = c; x < c + cs; x++) taken[y][x] = 1; }
        c += cs;
      }
    });
    const heads = { work: [], exam: [] };
    for (const [cell, p] of pos) {
      // عنوان العمود في نور قد يحوي خانة «للكل» وقائمة «-- الكل --»: يُقرأ نصه بدونها
      let t;
      if (cell.querySelector('input,select,textarea')) { const c = cell.cloneNode(true); c.querySelectorAll('input,select,textarea,option').forEach(x => x.remove()); t = c.textContent; }
      else t = cell.innerText || cell.textContent;
      t = String(t || '').replace(/\s+/g, ' ').trim();
      if (!t) continue;
      if (t.length > 80) continue;
      if (EXAM_RE.test(t)) heads.exam.push(p); else if (WORK_RE.test(t)) heads.work.push(p);
    }
    const g = { pos, heads }; gridCache.set(table, g); return g;
  }
  // يحدد خانتي «أعمال السنة» و«الاختبار» من عناوين الأعمدة فقط — لا تخمين بالترتيب:
  // إن لم يُعرف العمود، أو طابقه أكثر من خانة، تُترك الخانة فارغة ويُبلَّغ المعلم
  function gradeInputs(tr) {
    const table = tr.closest('table'); if (!table) return { work: null, exam: null, unknown: true };
    const { pos, heads } = grid(table);
    if (!heads.work.length || !heads.exam.length) return { work: null, exam: null, unknown: true };
    // نور يضع الخانة وقائمة «حاضر» داخل جدول صغير في الخلية: العمود هو عمود خلية الصف نفسه، لا خلية الجدول الداخلي
    const cellOf = inp => { let c = inp.closest('td,th'); while (c && c.parentElement !== tr) c = c.parentElement && c.parentElement.closest('td,th'); return c; };
    const under = (inp, hs) => { const p = pos.get(cellOf(inp)); return p && hs.some(h => p.c >= h.c && p.c < h.c + h.cs); };
    const fields = [...tr.querySelectorAll('input')].filter(isField);
    const w = fields.filter(i => under(i, heads.work)), e = fields.filter(i => under(i, heads.exam));
    return { work: w.length === 1 ? w[0] : null, exam: e.length === 1 ? e[0] : null, unknown: false, multi: w.length > 1 || e.length > 1 };
  }
  /* opts.dry: خطة بلا كتابة (للمعاينة) · opts.only: Set صفوف وافق عليها المعلم — لا يُكتب غيرها */
  function fill(sheet, mode, opts = {}) {
    mode = ['both', 'work40', 'exam20'].includes(mode) ? mode : 'both';
    const plan = [], seenCls = [];
    const idx = indexSheet(Array.isArray(sheet && sheet.rows) ? sheet.rows : []), used = new Set();
    let filled = 0, rowsSeen = 0, ambiguous = 0, fields = 0, locked = 0, noCols = 0, multiCols = 0;
    const missed = [];
    for (const doc of (isTop ? docsOf(document) : [document])) {
      for (const tr of doc.querySelectorAll('tr')) {
        const inputs = [...tr.querySelectorAll('input')].filter(isField);
        if (!inputs.length) continue;
        // صف العناوين (فيه خانة «للكل») ليس طالبًا
        if (!tr.querySelector('td') || EXAM_RE.test(tr.textContent || '') || WORK_RE.test(tr.textContent || '')) continue;
        const name = rowName(tr); if (!name) continue;
        rowsSeen++;
        const mm = match(name, idx, used), m = mm.m;
        if (!m) { ambiguous++; missed.push({ name, why: mm.why, hint: mm.hint || '' });
          if (opts.dry) { plan.push({ tr, name, why: mm.why, hint: mm.hint || '' }); continue; }
          markRow(tr, mm.why); if (mm.hint) tr.title += ' — أقرب اسم في الكشف: ' + mm.hint; continue; }
        used.add(m); (mm.also || []).forEach(x => used.add(x)); seenCls.push(m.r.cls || '');
        const targets = gradeInputs(tr);
        if (targets.unknown) { noCols++; continue; }
        if (targets.multi) multiCols++;
        const w = fmt(m.r.work40), e = fmt(m.r.exam20);
        const wantW = mode !== 'exam20' && w !== '', wantE = mode !== 'work40' && e !== '';
        if (opts.dry) {
          const lk = (wantW && targets.work && !editable(targets.work)) || (wantE && targets.exam && !editable(targets.exam));
          const nc = (wantW && !targets.work) || (wantE && !targets.exam);
          const why = !wantW && !wantE ? 'empty' : lk ? 'locked' : nc ? 'nocell' : '';
          plan.push({ tr, name, sheetName: m.r.name, sheetN: m.n, cls: m.r.cls || '', exact: !!mm.exact, alias: !!mm.alias, w: wantW ? w : '', e: wantE ? e : '', why,
            oldW: targets.work ? targets.work.value : '', oldE: targets.exam ? targets.exam.value : '' });
          continue;
        }
        if (opts.only && !opts.only.has(tr)) { markRow(tr, ''); continue; }
        let rowFilled = false, rowLocked = false;
        const put = (inp, val) => {
          if (!inp || val === '') return;
          if (!editable(inp)) { locked++; rowLocked = true; return; }
          if (opts.undo) opts.undo.push({ inp, old: inp.value, bg: inp.style.background });
          setVal(inp, val); fields++; rowFilled = true;
        };
        if (mode === 'both') { put(targets.work, w); put(targets.exam, e); }
        else if (mode === 'work40') put(targets.work, w);
        else put(targets.exam, e);
        if (rowFilled) filled++;
        const noCell = (mode !== 'exam20' && w !== '' && !targets.work) || (mode !== 'work40' && e !== '' && !targets.exam);
        const why = rowLocked ? 'locked' : noCell ? 'nocell' : 'empty';
        if (!rowFilled) missed.push({ name, why });
        markRow(tr, rowFilled ? '' : why);
      }
    }
    const unmatched = idx.filter(x => !used.has(x)).map(x => x.r.name);
    // 🏫 فصل الصفحة = الأكثر بين المطابَقين؛ ومن الكشف: طلاب هذا الفصل الذين لم يظهروا في الصفحة
    const cnt = {}; seenCls.forEach(c => { if (c) cnt[c] = (cnt[c] || 0) + 1; });
    const cls = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || '';
    const free = idx.filter(x => !used.has(x));
    const clsMissing = cls ? free.filter(x => (x.r.cls || '') === cls).map(x => x.r.name) : [];
    if (opts.dry) return { plan, rowsSeen, noCols, unmatched, cls, clsMissing, free };
    return { filled, fields, rowsSeen, unmatched, ambiguous, locked, noCols, multiCols, missed: missed.slice(0, 60), cls, clsMissing };
  }

  /* ═════ 🎨 الواجهة: زر صغير أسفل الصفحة ← لوحة جانبية بخطوات (Shadow DOM: لا تتأثر بتنسيق نور ولا تؤثر فيه) ═════ */
  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ST = { exact: ['جاهز', 'ok'], alias: ['مربوط', 'link'], approx: ['يحتاج تأكيد', 'warn'], none: ['غير موجود في الكشف', 'bad'], tie: ['اسم مكرر بدرجات مختلفة', 'bad'],
    nocell: ['لم أجد خانته', 'bad'], locked: ['خانة مقفلة في نور', 'mute'], empty: ['بلا درجة في الكشف', 'mute'] };
  const MODES = [['both', 'الخانتان', '40 + 20'], ['work40', 'أعمال السنة', '40'], ['exam20', 'الاختبار', '20']];
  const CSS = `
  :host{all:initial}
  *{box-sizing:border-box;font-family:"Segoe UI",Tahoma,Arial,sans-serif}
  .w{--ink:#0F1B2D;--mut:#5B6B82;--line:#E3E8EF;--bg:#F5F7FA;--card:#fff;--pri:#0F766E;--pri2:#0B5F59;--ok:#15803D;--okb:#E8F6EE;--warn:#B45309;--warnb:#FEF5E2;
    --bad:#B91C1C;--badb:#FDEDEE;--link:#1D4ED8;--linkb:#EBF1FF;--mute:#64748B;--muteb:#F1F4F8;color:var(--ink);direction:rtl;font-size:13.5px;line-height:1.5}
  button{font:inherit;cursor:pointer}
  .fab{position:fixed;left:20px;bottom:20px;z-index:2147483646;display:flex;align-items:center;gap:10px;padding:10px 16px 10px 12px;border:0;border-radius:999px;
    background:var(--pri);color:#fff;box-shadow:0 10px 30px rgba(15,118,110,.35);font-weight:700;font-size:14px;transition:transform .15s}
  .fab:hover{transform:translateY(-2px)}.fab i{font-style:normal;background:rgba(255,255,255,.2);border-radius:999px;padding:1px 9px;font-size:12px}
  .pane{position:fixed;left:16px;top:16px;bottom:16px;width:min(430px,calc(100vw - 32px));z-index:2147483647;display:flex;flex-direction:column;background:var(--bg);
    border-radius:20px;box-shadow:0 24px 70px rgba(15,27,45,.28),0 0 0 1px rgba(15,27,45,.06);overflow:hidden}
  .pane.anim{animation:in .18s ease-out}
  @keyframes in{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}
  .hd{background:linear-gradient(135deg,#0F766E,#115E59);color:#fff;padding:16px 18px 14px}
  .hd-top{display:flex;align-items:center;gap:10px}.logo{width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,.16);display:grid;place-content:center;font-size:20px}
  .hd h1{margin:0;font-size:16px;font-weight:800}.hd p{margin:1px 0 0;font-size:12px;opacity:.85}
  .x{margin-inline-start:auto;width:34px;height:34px;border-radius:10px;border:0;background:rgba(255,255,255,.14);color:#fff;font-size:18px}
  .x:hover{background:rgba(255,255,255,.26)}
  .meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.meta span{background:rgba(255,255,255,.14);border-radius:999px;padding:3px 10px;font-size:11.5px}
  .meta .old{background:#FDE68A;color:#78350F;font-weight:700}
  .bd{flex:1;overflow:auto;padding:14px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;margin-bottom:12px}
  .lbl{display:flex;align-items:center;gap:8px;font-weight:800;font-size:13px;margin-bottom:10px}.lbl b{width:22px;height:22px;border-radius:50%;background:var(--pri);color:#fff;display:grid;place-content:center;font-size:12px}
  .seg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;background:var(--bg);padding:4px;border-radius:12px}
  .seg button{border:0;background:transparent;border-radius:9px;padding:8px 4px;color:var(--mut);font-weight:700;font-size:12.5px;line-height:1.25}
  .seg button small{display:block;font-weight:500;font-size:11px;opacity:.8}
  .seg button.on{background:#fff;color:var(--pri);box-shadow:0 1px 3px rgba(15,27,45,.12)}
  select.cls{width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:#fff;font:inherit;color:var(--ink)}
  .hint{font-size:12px;color:var(--mut);margin-top:6px}
  .tgts{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px}
  .tgt{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:9px 11px;border-radius:12px;border:1.5px solid var(--line);background:#fff;text-align:right;color:var(--ink)}
  .tgt b{font-size:14px}.tgt small{font-size:10.5px;color:var(--mut);line-height:1.5}.tgt:hover{border-color:var(--pri)}
  .tgt.on{border-color:var(--ok);background:var(--okb)}.tgt.on b{color:var(--ok)}.tgt.go{border-color:var(--pri);box-shadow:0 0 0 3px rgba(15,118,110,.15);animation:mbpulse 1.2s infinite}
  @keyframes mbpulse{50%{box-shadow:0 0 0 6px rgba(15,118,110,.05)}}
  details.man{margin-top:10px;border-top:1px dashed var(--line);padding-top:8px}details.man summary{cursor:pointer;font-size:12px;color:var(--mut);font-weight:700}
  .fld{margin-top:9px}.fld>span{display:block;font-size:11.5px;font-weight:800;color:var(--mut);margin-bottom:5px}
  .secs{display:flex;flex-wrap:wrap;gap:8px}.sec-b{width:40px;height:40px;border-radius:50%;border:1.5px solid var(--line);background:#fff;font-weight:800;font-size:14px;color:var(--ink)}
  .sec-b:hover{border-color:var(--pri)}.sec-b.on{background:var(--pri);border-color:var(--pri);color:#fff;box-shadow:0 3px 10px rgba(15,118,110,.3)}
  .pri{width:100%;border:0;border-radius:12px;padding:12px;background:var(--pri);color:#fff;font-weight:800;font-size:14px}
  .pri:hover{background:var(--pri2)}.pri:disabled{opacity:.45;cursor:default}
  .sec{border:1px solid var(--line);background:#fff;border-radius:12px;padding:11px 14px;font-weight:700;color:var(--ink)}
  .tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px}
  .tile{border:1px solid var(--line);background:#fff;border-radius:12px;padding:8px 4px;text-align:center}
  .tile b{display:block;font-size:19px;line-height:1.2}.tile span{font-size:11px;color:var(--mut);font-weight:700}
  .tile.on{border-color:currentColor;box-shadow:inset 0 0 0 1px currentColor}
  .tile.all{color:var(--ink)}.tile.ok{color:var(--ok)}.tile.warn{color:var(--warn)}.tile.bad{color:var(--bad)}
  .bar{display:flex;gap:6px;align-items:center;margin-bottom:8px}
  .q{flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:10px;font:inherit;background:#fff}
  .lnk{border:0;background:none;color:var(--pri);font-weight:700;font-size:12px;padding:4px 6px;border-radius:8px}.lnk:hover{background:#E6F4F2}
  .note{border-radius:12px;padding:9px 11px;font-size:12px;margin-bottom:10px}.note.warn{background:var(--warnb);color:#78350F}.note.info{background:#EEF2F7;color:#334155}
  .note summary{cursor:pointer;font-weight:700}
  .row{display:grid;grid-template-columns:22px 1fr auto;gap:10px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px 12px;margin-bottom:6px;border-inline-start:4px solid var(--c)}
  .row{--c:var(--line)}.row.ok{--c:#86D3A6}.row.link{--c:#93B4F5}.row.warn{--c:#F2C46B}.row.bad{--c:#F1A5AC}.row.mute{--c:#CBD5E1;opacity:.75}
  .row input[type=checkbox]{width:18px;height:18px;accent-color:var(--pri);margin:0}
  .nm{font-weight:700;cursor:pointer;overflow-wrap:anywhere}.nm:hover{color:var(--pri)}
  .sub{font-size:11.5px;color:var(--mut);margin-top:1px}.sub.link{color:var(--link)}.sub.warn{color:var(--warn)}
  .st{display:inline-block;margin-top:4px;font-size:11px;font-weight:700;border-radius:999px;padding:1px 8px}
  .st.ok{background:var(--okb);color:var(--ok)}.st.link{background:var(--linkb);color:var(--link)}.st.warn{background:var(--warnb);color:var(--warn)}.st.bad{background:var(--badb);color:var(--bad)}.st.mute{background:var(--muteb);color:var(--mute)}
  .gr{display:flex;gap:5px}.g{min-width:46px;text-align:center;background:var(--bg);border-radius:10px;padding:4px 6px}
  .g small{display:block;font-size:10px;color:var(--mut);font-weight:700}.g b{font-size:15px}.g em{display:block;font-style:normal;font-size:10px;color:var(--warn)}
  .pick{margin-top:6px;width:100%;padding:5px 7px;border:1px dashed #9DB3D9;border-radius:9px;background:#F7FAFF;font:inherit;font-size:12px;color:var(--link)}
  .unl{border:0;background:none;color:var(--bad);font-size:11px;padding:0;margin-inline-start:6px;text-decoration:underline}
  .ft{padding:12px 14px;background:#fff;border-top:1px solid var(--line);display:flex;gap:8px}
  .ft .pri{flex:1}
  .done{text-align:center;padding:22px 14px}.done .big{font-size:42px;line-height:1}.done h2{margin:8px 0 4px;font-size:18px}.done p{margin:0;color:var(--mut);font-size:12.5px}
  .kp{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:14px 0 4px}.kp div{background:var(--bg);border-radius:12px;padding:8px}.kp b{display:block;font-size:18px}.kp span{font-size:11px;color:var(--mut)}
  .save{display:flex;gap:8px;align-items:flex-start;background:#FFFBEB;border:1px solid #FDE68A;color:#78350F;border-radius:12px;padding:10px 12px;font-size:12.5px;font-weight:700;margin-top:12px;text-align:start}
  .miss{font-size:12px;margin:0;padding:0;list-style:none}.miss li{display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px dashed var(--line)}.miss li:last-child{border:0}
  .empty{text-align:center;color:var(--mut);padding:18px 8px;font-size:12.5px}
  .ver{font-size:10.5px;opacity:.7}`;

  const ui = { host: null, root: null, open: false, sheet: null, mode: 'both', view: 'home', r: null, sel: new Map(), filter: 'all', q: '', res: null, targets: [], fields: [], going: '' };
  const kindOf = x => x.why ? x.why : x.alias ? 'alias' : x.exact ? 'exact' : 'approx';
  const grp = k => ({ exact: 'ok', alias: 'ok', approx: 'warn', none: 'bad', tie: 'bad', nocell: 'bad', locked: 'mute', empty: 'mute' })[k];
  const ver = () => { try { return chrome.runtime.getManifest().version; } catch (_) { return ''; } };
  // اللوحة مفتوحة على شاشة عريضة: تُزاح صفحة نور يسارًا بعرضها فلا تغطي أعمدة الدرجات
  let pushed = null;
  function pushPage(on) {
    const b = document.body; if (!b) return;
    if (on && window.innerWidth >= 1100) { if (pushed == null) pushed = b.style.marginLeft; b.style.marginLeft = 'calc(min(430px, 100vw - 32px) + 28px)'; }
    else if (pushed != null) { b.style.marginLeft = pushed; pushed = null; }
  }
  function clearMarks() { if (ui.r) ui.r.plan.forEach(x => { if (x.tr.dataset.mbPv) markRow(x.tr, ''); }); }
  function markPlan() {
    clearMarks();
    ui.r.plan.forEach(x => { const k = kindOf(x), g = grp(k); if (g === 'ok') return;
      x.tr.style.outline = `2px ${g === 'warn' ? 'dashed #D49A1E' : 'solid #D6455B'}`; x.tr.style.outlineOffset = '-2px'; x.tr.dataset.mbPv = k; });
  }
  /* 🧭 حقول اختيار الصفحة في نور: الفصل الدراسي، الفترة، الصف، الفصل (الشعبة: أزرار دائرية 1…6).
     كل حقل يُوحَّد إلى { type:'select'|'btns', sel?, items:[{label, key, el, on}] } حيث key رقم (1، 2…) */
  const ccTxt = el => String((el && (el.innerText || el.textContent)) || '').replace(/\s+/g, ' ').trim();
  const AD = s => String(s || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const SEP = '[\\s\\-–—/*:()،,]';
  const ORDRX = ['أول|اول|أولى|اولى', 'ثاني|ثانية|ثانيه', 'ثالث|ثالثة|ثالثه', 'رابع|رابعة', 'خامس|خامسة', 'سادس|سادسة'].map(w => new RegExp(`(^|${SEP})(ال)?(${w})(?=${SEP}|$)`));
  const ORDW = t => { t = AD(t); for (let i = 0; i < ORDRX.length; i++) if (ORDRX[i].test(t)) return i + 1; return 0; };
  const ORD = t => { const m = String(t || '').match(/الفترة\s*(\S+)/); return m ? (ORDW(m[1]) || +AD(m[1]) || 0) : 0; };
  const ORDN = ['', 'الأولى', 'الثانية', 'الثالثة'], ORDM = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'];
  const QA = q => docsOf(document).flatMap(d => [...d.querySelectorAll(q)]).filter(el => !(ui.host && ui.host.contains(el)));
  const after = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  const FL = /^\*?\s*(السنة\s*الدراسية|القسم|الفصل\s*الدراسي|الفترة(\s*التقويمية)?|الصف|الفصل|الشعبة|المادة|المرحلة|الحلقة|المدرسة|نوع\s*\S+)\s*\*?\s*:?$/;
  const secKey = t => { t = AD(t).trim(); const m = t.match(/^(\d{1,2})$/) || t.match(/^\d\s*[/\-]\s*(\d{1,2})$/) || t.match(/^شعبة\s*(\d{1,2})$/); return m ? +m[1] : 0; };
  // السنة الحالية بالهجري (أم القرى) لاختيار «1447-1448» تلقائيًا إن لم تُختر
  const hijriNow = () => { try { return parseInt(AD(new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric' }).format(new Date())), 10) || 0; } catch (_) { return 0; } };
  const yearKey = t => { const m = AD(t).match(/(1[34]\d\d)/); return m ? +m[1] : 0; };
  // «الفصل الأول - الدور الأول»: الترتيب من الكلمة بعد «الفصل» لا من «الدور»
  const semKey = t => { const m = AD(t).match(/الفصل\s*(?:الدراسي\s*)?([^\s\-–—]+)/); return m ? ORDW(m[1]) : ORDW(String(t).split(/[-–—]/)[0]); };
  const FIELDS = [
    { k: 'year', name: 'السنة الدراسية', rx: /^\*?\s*السنة\s*الدراسية\s*\*?\s*:?$/, key: yearKey, fb: t => /^1[34]\d\d\s*[-/]\s*1[34]\d\d$/.test(AD(t).trim()) },
    { k: 'sem', name: 'الفصل الدراسي', rx: /^\*?\s*الفصل\s*الدراسي\s*\*?\s*:?$/, key: semKey, fb: t => /الفصل\s*الدراسي|^الفصل\s+(ال)?(أول|اول|ثاني|ثالث)$/.test(t) },
    { k: 'per', name: 'الفترة', rx: /^\*?\s*الفترة(\s*التقويمية)?\s*\*?\s*:?$/, key: t => /الفترة/.test(t) ? ORD(t) : ORDW(t), fb: t => /الفترة/.test(t) },
    { k: 'grade', name: 'الصف', rx: /^\*?\s*الصف\s*\*?\s*:?$/, key: ORDW, fb: t => /المتوسط|الابتدائي|الثانوي/.test(t) && !/الفصل|الفترة/.test(t) },
    { k: 'sec', name: 'الفصل', rx: /^\*?\s*(الفصل|الشعبة)\s*\*?\s*:?$/, key: secKey, btns: true, fb: t => !!secKey(t) }];
  const FBY = Object.fromEntries(FIELDS.map(f => [f.k, f]));
  function isOn(el) {
    const r = el.type === 'radio' ? el : el.querySelector && el.querySelector('input[type=radio]'); if (r && r.checked) return true;
    if ((el.getAttribute('aria-checked') || el.getAttribute('aria-pressed') || el.getAttribute('aria-selected')) === 'true') return true;
    return /(^|[\s_-])(active|selected|checked|current)([\s_-]|$)/i.test(String(el.className || ''));
  }
  const fromSel = (sel, F) => { const items = [...sel.options].map(o => ({ label: ccTxt(o), key: F.key(ccTxt(o)), el: o, on: o.selected })).filter(x => x.key);
    return items.length ? { type: 'select', sel, items } : null; };
  function findField(F) {
    const labs = QA('label,span,td,th,div,b,strong,p,legend').filter(el => el.children.length <= 2 && FL.test(ccTxt(el)));
    // العنصر يتبع هذا العنوان مباشرة: لا عنوان حقل آخر بينهما
    const owns = (lb, el) => after(lb, el) && !labs.some(o => o !== lb && !o.contains(lb) && !lb.contains(o) && !o.contains(el) && after(lb, o) && after(o, el));
    for (const lb of labs.filter(el => F.rx.test(ccTxt(el)))) {
      let box = lb.parentElement;
      for (let up = 0; box && up < 5; up++, box = box.parentElement) {
        const sel = [...box.querySelectorAll('select')].find(x => owns(lb, x) && x.options.length > 1);
        if (sel) { const f = fromSel(sel, F); if (f) return f; }
        if (!F.btns && F.k !== 'per') continue;
        const txt = el => ccTxt(el) || (el.type === 'radio' ? ccTxt(el.labels && el.labels[0]) || el.value : '');
        const by = new Map();
        for (const el of box.querySelectorAll('input[type=radio],button,a,label,li,span,div')) {
          if (el === lb || lb.contains(el) || !owns(lb, el)) continue; const k = F.key(txt(el)); if (!k) continue;
          if (!by.has(k) || by.get(k).contains(el)) by.set(k, el);
        }
        if (by.size >= 2 && by.size <= 15) {
          const items = [...by.entries()].sort((a, b) => a[0] - b[0]).map(([key, el]) => ({ label: txt(el), key, el }));
          let on = items.filter(x => isOn(x.el));
          if (on.length !== 1) { const bg = items.map(x => (x.el.ownerDocument.defaultView || window).getComputedStyle(x.el).backgroundColor), cnt = {}; bg.forEach(c => cnt[c] = (cnt[c] || 0) + 1);
            const odd = items.filter((x, k) => cnt[bg[k]] === 1); on = odd.length === 1 ? odd : []; }
          items.forEach(x => { x.on = on.includes(x) });
          return { type: 'btns', items };
        }
      }
    }
    // احتياط: قائمة خياراتها تدل على الحقل نفسه
    for (const sel of QA('select')) { const opts = [...sel.options].map(ccTxt); if (opts.filter(F.fb).length >= 2 && !(F.k === 'sec' && opts.some(t => /المتوسط|الابتدائي|الثانوي|الفترة|الدراسي/.test(t)))) { const f = fromSel(sel, F); if (f) return f; } }
    return null;
  }
  const curKey = pk => ((pk && pk.items.find(x => x.on)) || {}).key || 0;
  function setField(pk, it) {
    if (pk.type === 'select') { pk.sel.value = it.el.value; ['input', 'change'].forEach(e => pk.sel.dispatchEvent(new Event(e, { bubbles: true }))); return; }
    const r = it.el.type === 'radio' ? it.el : (it.el.querySelector && it.el.querySelector('input[type=radio]')) || it.el; r.click();
  }
  const findClassPicker = () => findField(FBY.sec), findPeriodPicker = () => findField(FBY.per);

  /* 🎯 من الكشف المصدَّر: الفصل الدراسي والفترة من عنوانه، والصف والشعبة من اسم الفصل («أول 2»، «1/2»، «الأول المتوسط 3»…) */
  function parseCls(cls) {
    const t = AD(cls).replace(/\s+/g, ' ').trim(); let m = t.match(/^(\d)\s*[/\-_]\s*(\d{1,2})$/);
    if (m) return { grade: +m[1], sec: +m[2], stage: '' };
    const stage = /متوسط/.test(t) ? 'المتوسط' : /ابتدا/.test(t) ? 'الابتدائي' : /ثانو/.test(t) ? 'الثانوي' : '';
    const g = ORDW(t), nums = t.match(/\d{1,2}/g) || [];
    if (g) return { grade: g, sec: nums.length ? +nums[nums.length - 1] : 0, stage };
    if (nums.length >= 2) return { grade: +nums[0], sec: +nums[nums.length - 1], stage };
    return { grade: 0, sec: nums.length ? +nums[0] : 0, stage };
  }
  function sheetTargets(S) {
    if (!S || !Array.isArray(S.rows)) return [];
    const L = String(S.label || ''), sem = +S.sem || ORDW((L.match(/الفصل\s*(?:الدراسي\s*)?(\S+)/) || [])[1]), per = +S.per || ORD(L);
    const list = S.cls && S.cls !== 'كل الفصول' ? [S.cls] : [...new Set(S.rows.map(r => String(r.cls || '').trim()).filter(Boolean))];
    return list.map(cls => ({ cls, sem, per, ...parseCls(cls), n: S.rows.filter(r => String(r.cls || '').trim() === cls).length }))
      .filter(x => x.grade || x.sec).sort((a, b) => a.grade - b.grade || a.sec - b.sec);
  }
  const pickItem = (pk, k, want, stage) => { const c = pk.items.filter(x => x.key === want);
    return (k === 'grade' && stage && c.find(x => x.label.includes(stage))) || (k === 'sem' && c.find(x => !/الدور\s*(ال)?ثاني/.test(x.label))) || c[0] || null; };
  // السنة: تُترك كما اختارها المعلم، وإلا فالسنة التي تضم السنة الهجرية الحالية (1447-1448 ← 1448)
  function wantYear(pk) { const ks = pk.items.map(x => x.key), h = hijriNow();
    const both = pk.items.map(x => (AD(x.label).match(/1[34]\d\d/g) || []).map(Number));
    const i = both.findIndex(a => a[1] === h), j = both.findIndex(a => a[0] === h);
    return i >= 0 ? ks[i] : j >= 0 ? ks[j] : Math.max(...ks); }
  // حالة الصفحة الحالية مقابل الهدف: لكل حقل ✓ أو ✗ أو «غير ظاهر»
  function pageState(t) { return FIELDS.filter(F => F.k === 'year' || t[F.k]).map(F => { const pk = findField(F), cur = curKey(pk);
    if (F.k === 'year') return { F, pk, want: cur || (pk ? wantYear(pk) : 0), cur, ok: !pk || !!cur };
    return { F, pk, want: t[F.k], cur, ok: !!pk && cur === t[F.k] }; }); }

  /* الانتقال التلقائي: يضبط الحقول بالترتيب، وكل تغيير قد يعيد تحميل صفحة نور — فالحالة تُحفظ ويُستأنف بعد التحميل */
  const GK = 'mb_noor_goto';
  const gGet = async () => { try { return (await chrome.storage.local.get(GK))[GK] || null; } catch (_) { return null; } };
  const gSet = g => { try { chrome.storage.local.set({ [GK]: g }); } catch (_) {} };
  let gTimer = 0;
  const gLater = ms => { clearTimeout(gTimer); gTimer = setTimeout(gotoStep, ms); };
  async function gotoStart(t) { gSet({ t, at: Date.now(), n: 0, w: 0 }); ui.going = t.cls; ui.msg = `⏳ ينتقل إلى صفحة ${t.cls} في نور…`; render(); gotoStep(); }
  async function gotoStep() {
    const g = await gGet(); if (!g || !g.t) { ui.going = ''; return; }
    const stop = msg => { gSet(null); ui.going = ''; ui.msg = msg; if (ui.view !== 'home') ui.view = 'home'; render(); };
    if (Date.now() - g.at > 150000 || g.n > 20) return stop('⚠️ لم يكتمل الانتقال تلقائيًا — أكمل الاختيار في نور ثم اعرض المعاينة.');
    ui.going = g.t.cls; ui.open = true;
    for (const st of pageState(g.t)) {
      const busy = st.pk && st.pk.type === 'select' && st.pk.sel.disabled;
      if (!st.pk || busy) { if (st.F.k !== 'per' && st.F.k !== 'year' && g.w < 10) { g.w++; gSet(g); ui.msg = `⏳ ينتظر تحميل «${st.F.name}» في نور…`; render(); gLater(1000); return; } continue; }
      if (st.ok) continue;
      const it = pickItem(st.pk, st.F.k, st.want, g.t.stage);
      if (!it) return stop(`⚠️ لم أجد «${st.F.name} ${st.F.k === 'sec' ? st.want : st.F.k === 'per' ? ORDN[st.want] || st.want : ORDM[st.want] || st.want}» في نور — اختره يدويًا.`);
      g.n++; g.searched = false; g.secClicked = st.F.k === 'sec'; g.w = 0; gSet(g); ui.msg = `⏳ يختار ${st.F.name}: ${it.label}…`; render();
      setField(st.pk, it); gLater(1300); return;
    }
    // الحقول مضبوطة: هل ظهر طلاب هذا الفصل؟
    const r = ui.sheet ? fill(ui.sheet, ui.mode, { dry: true }) : null;
    if (r && r.plan.length && (!r.cls || r.cls === g.t.cls)) { gSet(null); ui.going = ''; ensureUI(); ui.open = true; doPreview(); return; }
    if (!g.searched) { const b = QA('button,input[type=submit],input[type=button],a').find(b => visible(b) && /^(بحث|ابحث|عرض|استعراض|عرض الطلاب|بحث عن الطلاب)$/.test(ccTxt(b) || String(b.value || '').trim()));
      if (b) { g.searched = true; g.n++; gSet(g); ui.msg = '⏳ يعرض طلاب الفصل…'; render(); b.click(); gLater(1500); return; } }
    // نور الجديد بلا زر بحث: الطلاب يظهرون بالضغط على زر الفصل (وقد يكون ملوّنًا مسبقًا دون تحميل)
    if (!g.secClicked) { const st = pageState(g.t).find(x => x.F.k === 'sec' && x.pk), it = st && pickItem(st.pk, 'sec', st.want);
      if (it) { g.secClicked = true; g.n++; gSet(g); ui.msg = '⏳ يحمّل طلاب الفصل…'; render(); setField(st.pk, it); gLater(1500); return; } }
    if ((g.w2 || 0) < 10) { g.w2 = (g.w2 || 0) + 1; gSet(g); ui.msg = '⏳ ينتظر ظهور الطلاب…'; render(); gLater(1200); return; }
    stop(`ضُبطت الصفحة في نور على ${g.t.cls}، لكن لم يظهر جدول طلابه بعد — اضغط زر الفصل في نور ثم «اعرض المعاينة».`);
  }

  function ensureUI() {
    if (ui.host && document.documentElement.contains(ui.host)) return;
    ui.host = document.createElement('div'); ui.host.id = 'mb-noor-ui';
    ui.root = ui.host.attachShadow({ mode: 'open' });
    ui.root.innerHTML = `<style>${CSS}</style><div class="w"></div>`;
    (document.body || document.documentElement).appendChild(ui.host);
    ui.root.addEventListener('click', onClick); ui.root.addEventListener('change', onChange); ui.root.addEventListener('input', onInput);
  }
  function runPlan() {
    ui.r = fill(ui.sheet, ui.mode, { dry: true });
    const keep = ui.sel; ui.sel = new Map();
    ui.r.plan.forEach(x => { const k = kindOf(x); ui.sel.set(x.tr, !x.why && (keep.has(x.tr) ? keep.get(x.tr) : (k === 'exact' || k === 'alias'))); });
    if (ui.r.plan.length) markPlan();
  }
  function counts() {
    const P = ui.r ? ui.r.plan : [], c = { all: P.length, ok: 0, warn: 0, bad: 0, mute: 0 };
    P.forEach(x => c[grp(kindOf(x))]++); return c;
  }
  function rowHTML(x, i) {
    const k = kindOf(x), g = grp(k), can = !x.why, on = ui.sel.get(x.tr);
    const old = (v, o) => o !== '' && o !== v ? `<em>كان ${esc(o)}</em>` : '';
    const grades = can || k === 'locked' || k === 'nocell'
      ? `<div class="gr">${ui.mode !== 'exam20' ? `<div class="g"><small>40</small><b>${esc(x.w || '—')}</b>${old(x.w, x.oldW)}</div>` : ''}${ui.mode !== 'work40' ? `<div class="g"><small>20</small><b>${esc(x.e || '—')}</b>${old(x.e, x.oldE)}</div>` : ''}</div>` : '<div></div>';
    const showSheet = x.sheetName && norm(x.sheetName) !== norm(x.name);
    const cands = (k === 'none' || k === 'tie' || k === 'approx') ? (() => { const t = norm(x.name).split(' ');
      return ui.r.free.map(c => ({ c, s: (c.r.cls === ui.r.cls ? 10 : 0) + c.t.filter(w => t.includes(w)).length + (c.t[0] === t[0] ? 3 : 0) })).sort((a, b) => b.s - a.s).slice(0, 40).map(o => o.c); })() : [];
    return `<div class="row ${g}" data-i="${i}">
      <input type="checkbox" class="ck" ${can ? '' : 'disabled'} ${can && on ? 'checked' : ''} aria-label="تحديد">
      <div><div class="nm" data-go="${i}">${esc(x.name)}</div>
        ${showSheet ? `<div class="sub ${x.alias ? 'link' : 'warn'}">في الكشف: ${esc(x.sheetName)}${x.alias ? `<button class="unl" data-unlink="${i}">فك الربط</button>` : ''}</div>` : ''}
        ${x.hint && !cands.length ? `<div class="sub">أقرب اسم: ${esc(x.hint)}</div>` : ''}
        <span class="st ${g === 'ok' && k === 'alias' ? 'link' : g}">${k === 'alias' ? '🔗 ' : ''}${ST[k][0]}</span>
        ${cands.length ? `<select class="pick" data-pick="${i}"><option value="">🔗 ${k === 'approx' ? 'ليس هو؟ اربطه بطالب آخر' : 'اربطه بطالب من الكشف'}…</option>${cands.map(c => `<option value="${esc(c.n)}">${esc(c.r.name)}${c.r.cls ? ' — ' + esc(c.r.cls) : ''}</option>`).join('')}</select>` : ''}</div>
      ${grades}</div>`;
  }
  function render() {
    if (!ui.root) return;
    const w = ui.root.querySelector('.w'), S = ui.sheet || { rows: [] };
    const prevBd = w.querySelector('.bd'), scroll = prevBd && ui.lastView === ui.view ? prevBd.scrollTop : 0; ui.lastView = ui.view;
    const n = (S.rows || []).length, age = S.at ? Date.now() - S.at : 0;
    const when = S.at ? new Date(S.at).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
    pushPage(ui.open);
    if (!ui.open) { w.innerHTML = `<button class="fab" data-act="open">🏛️ رصد مساعد المعلم <i>${n} طالب</i></button>`; return; }
    const head = `<div class="hd"><div class="hd-top"><div class="logo">🏛️</div><div><h1>رصد الدرجات في نور</h1><p>من كشف مساعد المعلم <span class="ver">· v${esc(ver())}</span></p></div>
        <button class="x" data-act="close" title="تصغير">–</button></div>
      <div class="meta"><span>📄 ${n} طالب</span>${S.label ? `<span>${esc(S.label)}</span>` : ''}${S.cls ? `<span>${esc(S.cls)}</span>` : ''}${when ? `<span class="${age > 2 * 864e5 ? 'old' : ''}">${age > 2 * 864e5 ? '⚠️ صُدّر ' + esc(when) + ' — صدّره من جديد' : '🕒 ' + esc(when)}</span>` : ''}</div></div>`;
    let body = '', foot = '';
    if (ui.view === 'home') {
      const T = ui.targets = sheetTargets(S), want = ORD(S.label);
      const F = ui.fields = FIELDS.map(f => ({ f, pk: findField(f) })).filter(x => x.pk);
      const pp = (F.find(x => x.f.k === 'per') || {}).pk, have = curKey(pp);
      const states = T.map(t => pageState(t)), here = states.map(st => st.length && st.every(x => x.ok || !x.pk) && st.some(x => x.ok));
      const manual = F.length ? F.map(({ f, pk }) => `<div class="fld"><span>${f.name}</span>${pk.type === 'btns'
          ? `<div class="${f.k === 'sec' ? 'secs' : 'seg'}">${pk.items.map((x, n) => `<button class="${f.k === 'sec' ? 'sec-b ' : ''}${x.on ? 'on' : ''}" data-fld="${f.k}:${n}">${esc(x.label)}</button>`).join('')}</div>`
          : `<select class="cls" data-fsel="${f.k}">${[...pk.sel.options].map(o => `<option value="${esc(o.value)}" ${o.selected ? 'selected' : ''}>${esc(ccTxt(o))}</option>`).join('')}</select>`}</div>`).join('') : '';
      const perWarn = want && have && want !== have ? `<div class="note warn" style="margin:8px 0 0">⚠️ الدرجات المصدَّرة للفترة <b>${ORDN[want]}</b> لكن نور على الفترة <b>${ORDN[have]}</b>.</div>` : '';
      body = `<div class="card"><div class="lbl"><b>1</b>ماذا تكتب؟</div>
          <div class="seg">${MODES.map(([k, t, s]) => `<button data-mode="${k}" class="${ui.mode === k ? 'on' : ''}">${t}<small>${s}</small></button>`).join('')}</div></div>
        ${T.length || F.length ? `<div class="card"><div class="lbl"><b>2</b>${T.length ? 'انتقل لصفحة الفصل في نور' : 'الصفحة في نور'}</div>
          ${T.length ? `<div class="tgts">${T.map((t, i) => `<button class="tgt ${here[i] ? 'on' : ''} ${ui.going === t.cls ? 'go' : ''}" data-goto="${i}"><b>${here[i] ? '✓ ' : ''}${esc(t.cls)}</b>
              <small>${[t.sem ? 'ف' + ['', '1', '2', '3'][t.sem] : '', t.per ? 'الفترة ' + ORDN[t.per] : '', t.grade ? 'الصف ' + ORDM[t.grade] : '', t.sec ? 'الفصل ' + t.sec : ''].filter(Boolean).join(' · ')} · ${t.n} طالب</small></button>`).join('')}</div>
            <div class="hint">اضغط الفصل: يختار الجسر <b>الفصل الدراسي والفترة والصف والفصل</b> في نور بنفسه، ثم يعرض الطلاب ويفتح المعاينة.</div>
            ${manual ? `<details class="man"><summary>اختيار يدوي</summary>${manual}</details>` : ''}` : manual}
          ${perWarn}</div>` : want ? `<div class="note info" style="margin:0 0 10px">📅 الدرجات المصدَّرة للفترة <b>${ORDN[want]}</b> — تأكد أن نور على نفس الفترة.</div>` : ''}
        <div class="card"><div class="lbl"><b>${T.length || F.length ? 3 : 2}</b>راجع قبل الكتابة</div><div class="hint" style="margin:0 0 10px">تُعرض درجات كل طالب في هذه الصفحة وحالته، ولا يُكتب شيء قبل موافقتك.</div>
          <button class="pri" data-act="preview">👁️ اعرض المعاينة</button>${ui.msg ? `<div class="note warn" style="margin:10px 0 0">${esc(ui.msg)}</div>` : ''}</div>`;
    } else if (ui.view === 'preview') {
      const c = counts(), F = ui.filter, q = norm(ui.q);
      const list = ui.r.plan.map((x, i) => [x, i]).filter(([x]) => (F === 'all' || grp(kindOf(x)) === F) && (!q || norm(x.name).includes(q)));
      const selN = ui.r.plan.filter(x => !x.why && ui.sel.get(x.tr)).length;
      body = `<div class="tiles">${[['all', 'الكل', c.all], ['ok', 'جاهز', c.ok], ['warn', 'يحتاج تأكيد', c.warn], ['bad', 'لم يُطابَق', c.bad]].map(([k, t, v]) => `<button class="tile ${k} ${F === k ? 'on' : ''}" data-filter="${k}"><b>${v}</b><span>${t}</span></button>`).join('')}</div>
        ${c.warn ? `<div class="note warn">🟡 <b>${c.warn}</b> مطابقة تقريبية غير محددة — قارن الاسمين وحدّد الصحيح بنفسك (يُحفظ ربطه للمرات القادمة).</div>` : ''}
        ${ui.r.cls ? `<div class="note info">${ui.r.clsMissing.length ? `<details><summary>🏫 ${esc(ui.r.cls)} · ${ui.r.clsMissing.length} من الكشف لم يظهروا في الصفحة</summary><div style="margin-top:6px">${ui.r.clsMissing.map(esc).join('، ')}<div class="hint">إن كان أحدهم باسم مختلف في نور فاربطه من القائمة تحت اسمه.</div></div></details>` : `🏫 ${esc(ui.r.cls)} · كل طلاب الفصل في الكشف ظاهرون هنا ✓`}</div>` : ''}
        <div class="bar"><input class="q" placeholder="🔎 ابحث عن طالب…" value="${esc(ui.q)}"><button class="lnk" data-act="all">تحديد الكل</button><button class="lnk" data-act="none">إلغاء</button></div>
        ${list.length ? list.map(([x, i]) => rowHTML(x, i)).join('') : '<div class="empty">لا طلاب في هذا التصنيف.</div>'}`;
      foot = `<div class="ft"><button class="sec" data-act="back">رجوع</button><button class="pri" data-act="write" ${selN ? '' : 'disabled'}>✍️ اكتب درجات ${selN} طالب</button></div>`;
    } else {
      const R = ui.res || {}, miss = R.missed || [];
      body = `<div class="card done"><div class="big">${R.filled ? '✅' : '⚠️'}</div><h2>${R.filled ? `كُتبت درجات ${R.filled} طالب` : 'لم يُكتب شيء'}</h2><p>${R.fields || 0} خانة في هذه الصفحة</p>
          <div class="kp"><div><b>${R.filled || 0}</b><span>كُتب</span></div><div><b>${R.skipped > 0 ? R.skipped : 0}</b><span>تركتهم</span></div><div><b>${miss.length}</b><span>لم يُكتب</span></div></div>
          ${R.filled ? `<div class="save">💾 <span>راجع الدرجات في الجدول ثم اضغط <u>«حفظ»</u> في نور — الإضافة لا تحفظ عنك.</span></div>` : ''}</div>
        ${miss.length ? `<div class="card"><div class="lbl">🔴 لم تُكتب درجاتهم (بإطار أحمر في الصفحة)</div><ul class="miss">${miss.map(m => `<li><span>${esc(m.name)}</span><span class="st ${m.why === 'locked' || m.why === 'empty' ? 'mute' : 'bad'}">${esc(ST[m.why] ? ST[m.why][0] : m.why)}</span></li>`).join('')}</ul></div>` : ''}`;
      foot = `<div class="ft">${R.undo && R.undo.length ? `<button class="sec" data-act="undo">↩️ تراجع (${R.undo.length})</button>` : ''}<button class="pri" data-act="again">👁️ معاينة جديدة</button></div>`;
    }
    const anim = ui.justOpened; ui.justOpened = false;
    w.innerHTML = `<div class="pane${anim ? ' anim' : ''}" role="dialog" aria-label="رصد الدرجات في نور">${head}<div class="bd">${body}</div>${foot}</div>`;
    const bd = w.querySelector('.bd'); if (bd && scroll) bd.scrollTop = scroll;
    if (ui.view === 'preview' && ui.focusQ) { const qi = w.querySelector('.q'); qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
  }
  function doPreview() {
    ui.msg = ''; runPlan();
    if (!ui.r.plan.length) { ui.msg = ui.r.noCols ? 'لم أتعرف على عمودي «أعمال السنة» و«التقويمات التحريرية» في هذه الصفحة — لم يُكتب شيء حتى لا تنعكس الدرجات.' : 'لم أجد جدول رصد بخانات درجات في هذه الصفحة — افتح صفحة رصد الدرجات أولًا.'; ui.view = 'home'; }
    else { ui.view = 'preview'; ui.filter = 'all'; ui.q = ''; }
    render();
  }
  function onClick(ev) {
    const t = ev.target.closest('button,[data-go]'); if (!t) return;
    const a = t.dataset.act;
    if (a === 'open') { ui.open = true; ui.justOpened = true; render(); return; }
    if (a === 'close') { ui.open = false; clearMarks(); ui.view = ui.view === 'done' ? 'done' : 'home'; render(); return; }
    if (t.dataset.mode) { ui.mode = t.dataset.mode; render(); return; }
    if (t.dataset.goto != null) { const tg = (ui.targets || [])[+t.dataset.goto]; if (tg) gotoStart(tg); return; }
    if (t.dataset.fld) { const [k, n] = t.dataset.fld.split(':'), x = (ui.fields || []).find(y => y.f.k === k), it = x && x.pk.items[+n]; if (!it) return;
      setField(x.pk, it); ui.msg = `تم اختيار ${x.f.name}: ${it.label} في نور — اضغط «بحث/عرض» في نور إن لزم، ثم اعرض المعاينة.`; setTimeout(render, 400); return; }
    if (a === 'preview' || a === 'again') { doPreview(); return; }
    if (a === 'back') { clearMarks(); ui.view = 'home'; render(); return; }
    if (t.dataset.filter) { ui.filter = t.dataset.filter; render(); return; }
    if (a === 'all' || a === 'none') { ui.r.plan.forEach(x => { if (!x.why) ui.sel.set(x.tr, a === 'all'); }); render(); return; }
    if (t.dataset.go != null) { const x = ui.r.plan[+t.dataset.go]; x.tr.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const o = x.tr.style.boxShadow; x.tr.style.boxShadow = 'inset 0 0 0 3px #0F766E'; setTimeout(() => { x.tr.style.boxShadow = o; }, 1600); return; }
    if (t.dataset.unlink != null) { const x = ui.r.plan[+t.dataset.unlink]; delete ALIAS[norm(x.name)]; aliasSave(); runPlan(); render(); return; }
    if (a === 'write') {
      const picked = ui.r.plan.filter(x => !x.why && ui.sel.get(x.tr)), only = new Set(picked.map(x => x.tr));
      // المطابقة التقريبية التي أكّدها المعلم تُحفظ ربطًا، فتظهر «مربوط» في المرة القادمة
      let learned = 0; picked.forEach(x => { if (kindOf(x) === 'approx' && x.sheetN) { ALIAS[norm(x.name)] = x.sheetN; learned++; } }); if (learned) aliasSave();
      const valid = ui.r.plan.filter(x => !x.why).length; clearMarks();
      const undo = [], res = fill(ui.sheet, ui.mode, { only, undo }); res.skipped = valid - only.size; res.undo = undo;
      ui.res = res; ui.view = 'done'; render(); return;
    }
    if (a === 'undo') { const R = ui.res; R.undo.slice().reverse().forEach(u => { setVal(u.inp, u.old); u.inp.style.background = u.bg; });
      document.querySelectorAll('tr[data-mb-why]').forEach(tr => markRow(tr, '')); ui.res = { ...R, undo: [], filled: 0, fields: 0, missed: [], undone: R.undo.length };
      ui.view = 'home'; ui.msg = `↩️ أُعيدت ${R.undo.length} خانة إلى ما كانت عليه.`; render(); return; }
  }
  function onChange(ev) {
    const t = ev.target;
    if (t.classList.contains('ck')) { const x = ui.r.plan[+t.closest('.row').dataset.i]; ui.sel.set(x.tr, t.checked); render(); return; }
    if (t.dataset.pick != null && t.value) { const x = ui.r.plan[+t.dataset.pick]; ALIAS[norm(x.name)] = t.value; aliasSave(); ui.sel.set(x.tr, true); runPlan(); render(); return; }
    if (t.dataset.fsel) { const x = (ui.fields || []).find(y => y.f.k === t.dataset.fsel); if (!x) return; x.pk.sel.value = t.value; ['input', 'change'].forEach(e => x.pk.sel.dispatchEvent(new Event(e, { bubbles: true })));
      ui.msg = `تم اختيار ${x.f.name} في نور — انتظر تحديث الصفحة ثم اعرض المعاينة.`; setTimeout(render, 400); }
  }
  function onInput(ev) { if (ev.target.classList.contains('q')) { ui.q = ev.target.value; ui.focusQ = true; render(); ui.focusQ = false; } }
  async function loadSheet() { try { ui.sheet = (await chrome.storage.local.get('mb_noor_grades')).mb_noor_grades || null; } catch (_) { ui.sheet = null; } }
  async function showUI() {
    await loadSheet();
    if (!ui.sheet || !Array.isArray(ui.sheet.rows) || !ui.sheet.rows.length) { if (ui.host) ui.host.remove(); ui.host = null; return; }
    if (['both', 'work40', 'exam20'].includes(ui.sheet.mode)) ui.mode = ui.sheet.mode;
    ensureUI(); render();
    if (await gGet()) gotoStep();
  }

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (!msg || msg.type !== 'mb:noorFill') return false;
    // من لوحة المعلم: تُفتح اللوحة على المعاينة ولا يُكتب شيء قبل موافقة المعلم
    ui.sheet = msg.payload || {}; if (['both', 'work40', 'exam20'].includes(ui.sheet.mode)) ui.mode = ui.sheet.mode;
    const P = fill(ui.sheet, ui.mode, { dry: true });
    if (P.plan.length) { ensureUI(); if (!ui.open) ui.justOpened = true; ui.open = true; doPreview(); }
    const c = P.plan.length ? counts() : { ok: 0, warn: 0 };
    if (isTop || P.plan.length) reply({ preview: P.plan.length, ready: c.ok, approx: c.warn, rowsSeen: P.rowsSeen });
    return false;
  });
  if (isTop) {
    if (document.body) showUI(); else document.addEventListener('DOMContentLoaded', showUI, { once: true });
    try { chrome.storage.onChanged.addListener((ch, area) => { if (area !== 'local') return; if (ch.mb_noor_alias) ALIAS = ch.mb_noor_alias.newValue || {};
      if (ch.mb_noor_grades) { ui.view = 'home'; clearMarks(); ui.r = null; showUI(); } }); } catch (_) {}
  }
})();
