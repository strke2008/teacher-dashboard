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

  /* ── 👁️ معاينة قبل الكتابة: كل صف بحالته، والمعلم يختار من يُكتب ── */
  let pv = null;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const PVS = { exact: ['✅', 'مطابق', '#E6F7EE', '#0E6B47'], alias: ['🔗', 'مربوط يدويًا', '#EAF1FF', '#1E4FB0'], approx: ['🟡', 'مطابقة تقريبية — تأكد', '#FFF6DB', '#8A6100'],
    none: ['🔴', 'غير موجود في الكشف', '#FFEDEF', '#A3263A'], tie: ['🔴', 'اسم مكرر بدرجات مختلفة', '#FFEDEF', '#A3263A'],
    empty: ['⚪', 'بلا درجة في الكشف', '#F1F4F8', '#55627A'], locked: ['🔒', 'خانة مقفلة في نور', '#F1F4F8', '#55627A'], nocell: ['🔴', 'لم أجد خانته', '#FFEDEF', '#A3263A'] };
  function closePreview() { if (!pv) return; pv.plan.forEach(x => { if (x.tr.dataset.mbPv) markRow(x.tr, ''); }); pv.el.remove(); pv = null; }
  function openPreview(sheet, mode, keep) {
    const pos = pv && pv.el.style.cssText; closePreview();
    const r = fill(sheet, mode, { dry: true });
    if (!r.plan.length) return { preview: 0, rowsSeen: r.rowsSeen, noCols: r.noCols };
    const doc = document, el = doc.createElement('div'); el.setAttribute('dir', 'rtl');
    el.style.cssText = pos || 'position:fixed;top:12px;left:12px;z-index:2147483647;width:min(620px,calc(100vw - 24px));max-height:calc(100vh - 24px);display:flex;flex-direction:column;background:#fff;color:#16233A;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.35);font:500 13px Tahoma,Arial,sans-serif;overflow:hidden';
    const kind = x => x.why ? x.why : x.alias ? 'alias' : x.exact ? 'exact' : 'approx';
    // مرشحو الربط اليدوي: طلاب الكشف غير المطابَقين — فصل الصفحة أولًا ثم الأقرب اسمًا
    const cands = name => { const t = norm(name).split(' '); return r.free.map(x => ({ x, s: (x.r.cls === r.cls ? 10 : 0) + x.t.filter(w => t.includes(w)).length + (x.t[0] === t[0] ? 3 : 0) }))
      .sort((a, b) => b.s - a.s).slice(0, 40).map(o => o.x); };
    const linkSel = x => `<select class="pv-link" style="display:block;margin-top:3px;max-width:100%;font:inherit;font-size:11.5px;border:1px solid #CBD5E1;border-radius:6px;padding:1px 3px">
      <option value="">🔗 اربطه بطالب من الكشف…</option>${cands(x.name).map(c => `<option value="${esc(c.n)}">${esc(c.r.name)}${c.r.cls ? ' — ' + esc(c.r.cls) : ''}</option>`).join('')}</select>`;
    const isDef = x => { const k = kind(x); return k === 'exact' || k === 'alias'; };
    const chk = x => keep && keep.has(x.tr) ? keep.get(x.tr) : isDef(x);
    const n = k => r.plan.filter(x => kind(x) === k).length;
    const val = (v, old) => v === '' ? '<span style="color:#9AA5B5">—</span>' : `<b>${esc(v)}</b>${old !== '' && old !== v ? `<small style="display:block;color:#B4740E;font-weight:500">كان ${esc(old)}</small>` : ''}`;
    el.innerHTML = `<div style="background:#16233A;color:#fff;padding:10px 14px;display:flex;align-items:center;gap:8px">
        <b style="font-size:14px;flex:1">👁️ معاينة الرصد قبل الكتابة</b><button type="button" class="pv-x" style="background:transparent;border:0;color:#fff;font-size:18px;cursor:pointer">✕</button></div>
      <div style="padding:8px 14px;display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid #E5EAF1;font-size:12px">
        ${r.cls ? `<span style="background:#EAF1FF;color:#1E4FB0;border-radius:99px;padding:2px 9px;font-weight:700">🏫 ${esc(r.cls)}</span>` : ''}
        ${['exact', 'alias', 'approx', 'none', 'tie', 'nocell', 'locked', 'empty'].filter(k => n(k)).map(k => `<span style="background:${PVS[k][2]};color:${PVS[k][3]};border-radius:99px;padding:2px 9px;font-weight:700">${PVS[k][0]} ${PVS[k][1].split(' — ')[0]} ${n(k)}</span>`).join('')}
        <span style="flex:1"></span><button type="button" class="pv-all" style="border:1px solid #CBD5E1;background:#fff;border-radius:8px;padding:2px 8px;cursor:pointer;font:inherit">تحديد الكل الصالح</button>
        <button type="button" class="pv-none" style="border:1px solid #CBD5E1;background:#fff;border-radius:8px;padding:2px 8px;cursor:pointer;font:inherit">إلغاء التحديد</button></div>
      ${r.clsMissing.length ? `<div style="margin:8px 14px 0;padding:7px 10px;border-radius:9px;background:#F1F4F8;color:#41516B;font-size:12px">👥 من ${esc(r.cls)} في الكشف ولم يظهروا في هذه الصفحة (${r.clsMissing.length}): ${r.clsMissing.slice(0, 12).map(esc).join('، ')}${r.clsMissing.length > 12 ? '…' : ''} — إن كان أحدهم باسم مختلف في نور فاربطه من القائمة تحت اسمه.</div>` : ''}
      ${n('approx') ? `<div style="margin:8px 14px 0;padding:7px 10px;border-radius:9px;background:#FFF6DB;color:#6B4C00;font-size:12px">🟡 المطابقات التقريبية <b>غير محددة</b>: قارن اسم نور باسم الكشف تحته، وحدّد الصحيح منها بنفسك.</div>` : ''}
      <div style="overflow:auto;flex:1;padding:6px 8px 8px"><table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr style="position:sticky;top:0;background:#F3F6FA;color:#41516B"><th style="padding:6px;width:28px"></th><th style="padding:6px;text-align:right">الطالب في نور</th><th style="padding:6px">40</th><th style="padding:6px">20</th><th style="padding:6px;text-align:right">الحالة</th></tr></thead>
        <tbody>${r.plan.map((x, i) => { const k = kind(x), S = PVS[k], ok = !x.why;
          return `<tr data-i="${i}" style="border-bottom:1px solid #EEF2F6;background:${k === 'exact' ? '#fff' : S[2]}">
            <td style="padding:6px;text-align:center"><input type="checkbox" class="pv-c" ${ok ? '' : 'disabled'} ${ok && chk(x) ? 'checked' : ''} style="width:16px;height:16px;cursor:${ok ? 'pointer' : 'default'}"></td>
            <td style="padding:6px"><a href="#" class="pv-go" style="color:#16233A;font-weight:700;text-decoration:none">${esc(x.name)}</a>
              ${x.sheetName && (!x.exact || x.alias) && norm(x.sheetName) !== norm(x.name) ? `<small style="display:block;color:${x.alias ? '#1E4FB0' : '#6B4C00'}">في الكشف: ${esc(x.sheetName)}</small>` : ''}
              ${x.alias ? `<a href="#" class="pv-unlink" style="font-size:11px;color:#A3263A">فك الربط</a>` : ''}
              ${k === 'none' || k === 'tie' || k === 'approx' ? linkSel(x) : ''}</td>
            <td style="padding:6px;text-align:center">${ok || k === 'locked' || k === 'nocell' ? val(x.w, x.oldW) : ''}</td><td style="padding:6px;text-align:center">${ok || k === 'locked' || k === 'nocell' ? val(x.e, x.oldE) : ''}</td>
            <td style="padding:6px;color:${S[3]};font-weight:700;white-space:nowrap">${S[0]} ${S[1]}</td></tr>`; }).join('')}</tbody></table></div>
      <div style="padding:10px 14px;border-top:1px solid #E5EAF1;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button type="button" class="pv-go-w" style="background:#1B9C6B;color:#fff;border:0;border-radius:9px;padding:8px 14px;font:700 13px Tahoma,Arial,sans-serif;cursor:pointer"></button>
        <button type="button" class="pv-cancel" style="background:#fff;border:1px solid #CBD5E1;border-radius:9px;padding:8px 12px;font:inherit;cursor:pointer">إلغاء</button>
        <small style="color:#55627A;flex:1;min-width:180px">لا يُكتب شيء قبل الضغط على الزر — وبعد الكتابة راجع ثم اضغط «حفظ» في نور.</small></div>`;
    doc.body.appendChild(el);
    pv = { el, plan: r.plan, sheet, mode };
    const relink = () => { const keepM = new Map(boxes.map(b => [r.plan[+b.closest('tr').dataset.i].tr, b.checked])); openPreview(sheet, mode, keepM); };
    el.querySelectorAll('.pv-link').forEach(sl => sl.onchange = () => { if (!sl.value) return; const x = r.plan[+sl.closest('tr').dataset.i];
      ALIAS[norm(x.name)] = sl.value; aliasSave(); const keepM = new Map(boxes.map(b => [r.plan[+b.closest('tr').dataset.i].tr, b.checked])); keepM.set(x.tr, true); openPreview(sheet, mode, keepM); });
    el.querySelectorAll('.pv-unlink').forEach(a => a.onclick = ev => { ev.preventDefault(); const x = r.plan[+a.closest('tr').dataset.i]; delete ALIAS[norm(x.name)]; aliasSave(); relink(); });
    // الصفوف في الصفحة: أصفر للتقريبي وأحمر لما لا يُكتب، وعودتها لحالها عند الإغلاق
    r.plan.forEach(x => { const k = kind(x); if (k !== 'exact' && k !== 'alias') { x.tr.style.outline = `2px ${k === 'approx' ? 'dashed #D49A1E' : 'solid #D6455B'}`; x.tr.style.outlineOffset = '-2px'; x.tr.dataset.mbPv = k; } });
    const boxes = [...el.querySelectorAll('.pv-c')], btn = el.querySelector('.pv-go-w');
    const sync = () => { const c = boxes.filter(b => b.checked).length; btn.textContent = `✍️ اكتب درجات المحددين (${c})`; btn.disabled = !c; btn.style.opacity = c ? '1' : '.5'; };
    boxes.forEach(b => b.addEventListener('change', sync)); sync();
    el.querySelector('.pv-all').onclick = () => { boxes.forEach(b => { if (!b.disabled) b.checked = true; }); sync(); };
    el.querySelector('.pv-none').onclick = () => { boxes.forEach(b => { b.checked = false; }); sync(); };
    el.querySelectorAll('.pv-go').forEach(a => a.onclick = ev => { ev.preventDefault(); const x = r.plan[+a.closest('tr').dataset.i];
      x.tr.scrollIntoView({ block: 'center', behavior: 'smooth' }); const o = x.tr.style.boxShadow; x.tr.style.boxShadow = 'inset 0 0 0 3px #3B82F6'; setTimeout(() => { x.tr.style.boxShadow = o; }, 1600); });
    el.querySelector('.pv-x').onclick = el.querySelector('.pv-cancel').onclick = closePreview;
    btn.onclick = () => {
      const picked = boxes.filter(b => b.checked).map(b => r.plan[+b.closest('tr').dataset.i]), only = new Set(picked.map(x => x.tr));
      // المطابقة التقريبية التي أكّدها المعلم تُحفظ ربطًا، فتظهر «مربوط» في المرة القادمة
      let learned = 0; picked.forEach(x => { if (kind(x) === 'approx' && x.sheetN) { ALIAS[norm(x.name)] = x.sheetN; learned++; } }); if (learned) aliasSave();
      const { sheet: sh, mode: md } = pv; closePreview();
      const undo = []; const res = fill(sh, md, { only, undo }); res.skipped = r.plan.filter(x => !x.why).length - only.size; res.undo = undo; toastBar(res);
    };
    return { preview: r.plan.length, ready: n('exact') + n('alias'), approx: n('approx'), rowsSeen: r.rowsSeen };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (!msg || msg.type !== 'mb:noorFill') return false;
    // من لوحة المعلم: تُفتح المعاينة في صفحة الرصد ولا يُكتب شيء قبل موافقة المعلم
    const r = openPreview(msg.payload || {}, (msg.payload && msg.payload.mode) || 'both');
    if (isTop || r.preview) reply(r);   // الإطار الفرعي يرد فقط إن وجد صفوفًا
    return false;
  });

  /* ── الشريط العائم (الإطار العلوي فقط) ── */
  let bar = null;
  function toastBar(r) {
    if (!bar) return;
    const st = bar.querySelector('.mbn-st');
    const warn = [r.locked ? `🔒 ${r.locked} خانة مقفلة في نور لم تُكتب` : '', r.multiCols ? '⚠️ بعض الصفوف فيها أكثر من خانة تحت العمود نفسه فتُركت' : ''].filter(Boolean).join(' · ');
    if (st && !r.filled && r.noCols) { st.textContent = '⚠️ لم أتعرف على عمودي «أعمال السنة» و«التقويمات التحريرية» في هذا الجدول — لم يُكتب شيء حتى لا تنعكس الدرجات. أرسل صورة الجدول للمطوّر.'; return; }
    if (st) st.textContent = (warn ? warn + ' — ' : '') + (r.filled ? `✅ عُبّئت ${r.fields || 0} خانة درجات لـ ${r.filled} طالب${r.clsMissing && r.clsMissing.length ? ` · ${r.clsMissing.length} من ${r.cls} في الكشف لم يظهروا هنا` : ''}${r.skipped > 0 ? ` · تُرك ${r.skipped} لم تحدّدهم` : ''} — راجعها ثم احفظ من نور` : `⚠️ لم تُعبّأ أي درجة (صفوف مفحوصة: ${r.rowsSeen || 0}). تأكد أنك داخل جدول رصد الدرجات وأن الكشف المصدّر يحتوي درجات.`);
    if (st) st.title = r.clsMissing && r.clsMissing.length ? `من ${r.cls} في الكشف ولم يظهروا في هذه الصفحة: ` + r.clsMissing.join('، ') : '';
    // ↩️ تراجع: يعيد كل خانة كتبتها هذه التعبئة إلى قيمتها السابقة (قبل الضغط على «حفظ» في نور)
    let ub = bar && bar.querySelector('.mbn-undo'); if (ub) ub.remove();
    if (bar && r.undo && r.undo.length) {
      ub = document.createElement('button'); ub.type = 'button'; ub.className = 'mbn-undo'; ub.textContent = `↩️ تراجع (${r.undo.length} خانة)`;
      ub.style.cssText = 'background:#fff;color:#16233A;border:0;border-radius:8px;padding:5px 9px;font:inherit;cursor:pointer;white-space:nowrap';
      ub.onclick = () => { r.undo.slice().reverse().forEach(u => { setVal(u.inp, u.old); u.inp.style.background = u.bg; });
        ub.remove(); const s2 = bar.querySelector('.mbn-st'); if (s2) s2.textContent = `↩️ أُعيدت ${r.undo.length} خانة إلى ما كانت عليه.`; const mb = bar.querySelector('.mbn-miss'); if (mb) mb.remove(); };
      bar.querySelector('.mbn-go').after(ub);
    }
    // طلاب هذه الصفحة الذين لم تُعبّأ درجاتهم — بالاسم والسبب (والصف نفسه بإطار أحمر)
    let box = bar && bar.querySelector('.mbn-miss'); if (box) box.remove();
    if (bar && r.missed && r.missed.length) {
      box = document.createElement('div'); box.className = 'mbn-miss';
      box.style.cssText = 'flex-basis:100%;background:#3A1E28;border-radius:8px;padding:5px 8px;font-weight:500;font-size:11px;line-height:1.5;max-height:110px;overflow:auto';
      const short = { none: 'غير موجود في الكشف', tie: 'اسم مكرر في الكشف', empty: 'بلا درجة في الكشف', nocell: 'لم أجد خانته', locked: 'خانة مقفلة' };
      box.textContent = `🔴 لم تُعبّأ درجات ${r.missed.length} في هذه الصفحة (بإطار أحمر): ` + r.missed.map(x => `${x.name.split(' ').filter(w => w !== 'بن').slice(0, 2).join(' ')} — ${short[x.why]}${x.hint ? ` (أقرب اسم: ${x.hint})` : ''}`).join(' · ');
      bar.appendChild(box);
    }
  }
  async function showBar() {
    if (!isTop || bar) return;
    let sheet = null; try { sheet = (await chrome.storage.local.get('mb_noor_grades')).mb_noor_grades; } catch (_) {}
    if (!sheet || !Array.isArray(sheet.rows) || !sheet.rows.length) return;
    bar = document.createElement('div');
    bar.setAttribute('dir', 'rtl');
    bar.style.cssText = 'position:fixed;left:max(8px, calc(50% - 300px));bottom:12px;z-index:2147483647;background:#16233A;color:#fff;border-radius:12px;padding:7px 9px;box-shadow:0 8px 24px rgba(0,0,0,.28);font:600 12px Tahoma,Arial,sans-serif;display:flex;gap:7px;align-items:center;flex-wrap:wrap;width:max-content;max-width:min(94vw,650px);box-sizing:border-box;';
    const when = sheet.at ? new Date(sheet.at).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
    const safe = v => String(v || '').replace(/[<>&]/g, '');
    // اكتشاف قائمة الفصل الأصلية في نور، إن كانت موجودة في الصفحة الحالية.
    const classSelects = [...document.querySelectorAll('select')].filter(sel => {
      const meta = `${sel.id || ''} ${sel.name || ''} ${sel.getAttribute('aria-label') || ''} ${sel.closest('td,th')?.innerText || ''}`;
      const opts = [...sel.options].map(o => (o.textContent || '').replace(/\s+/g, ' ').trim());
      const allOpts = opts.join(' ');
      // لا تعتبر اختيار الفترة/الدور فصلًا دراسيًا؛ مثل «الفصل الأول - الدور الأول».
      const isTermPicker = opts.some(t => /الفصل\s*(الأول|الثاني|الثالث)\s*[-–—]?\s*الدور\s*(الأول|الثاني)/.test(t)) ||
        (/الدور\s*(الأول|الثاني)/.test(allOpts) && /الفصل\s*(الأول|الثاني)/.test(allOpts));
      const hasClassOption = opts.some(t => /(?:أول|ثاني|ثالث)\s*(?:ابتدائي|متوسط|ثانوي)|\b[1-6]\s*[/\-]\s*[1-6]\b|شعبة\s*\S+/.test(t));
      const classMeta = /class|section|classroom|اسم.?الصف|الشعبة|الفصل الدراسي/i.test(meta);
      return !isTermPicker && (classMeta || hasClassOption);
    }).filter(sel => sel.options.length > 1);
    const classPicker = classSelects[0] || null;
    const classOptions = classPicker ? '' : `<option value="">${safe(sheet.cls || 'الفصل المحدد في الكشف')}</option>`;
    bar.innerHTML = `<span class="mbn-drag" title="اسحب لتحريك الصندوق" style="cursor:move;touch-action:none;user-select:none;flex:1 1 100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;font-size:11px;opacity:.95">⠿ كشف مساعد المعلم: <b>${sheet.rows.length}</b> طالب${sheet.cls ? ' · ' + safe(sheet.cls) : ''}${sheet.label ? ' · ' + safe(sheet.label) : ''}${when ? ' · ' + when : ''} <span style="opacity:.7">(اسحب من هنا) · v${(() => { try { return chrome.runtime.getManifest().version; } catch (_) { return ''; } })()}</span></span>
      <label style="display:flex;gap:5px;align-items:center">الفصل <select class="mbn-class" ${classPicker ? '' : 'disabled'} style="border-radius:7px;padding:3px 5px;font:inherit;color:#16233A;max-width:150px;max-height:30px">${classOptions}</select></label>
      <select class="mbn-mode" style="border-radius:7px;padding:3px 5px;font:inherit;color:#16233A;max-width:220px;max-height:30px">
        <option value="both">الخانتان: أعمال السنة 40 ثم الاختبار 20</option>
        <option value="work40">أعمال السنة (40) فقط</option>
        <option value="exam20">الاختبار (20) فقط</option></select>
      <button type="button" class="mbn-go" style="background:#1B9C6B;color:#fff;border:0;border-radius:8px;padding:5px 9px;font:inherit;cursor:pointer;white-space:nowrap">👁️ معاينة ثم تعبئة</button>
      <button type="button" class="mbn-x" title="إخفاء" style="background:transparent;color:#fff;border:0;font-size:16px;cursor:pointer;padding:2px 5px">✕</button>
      <span class="mbn-st" style="flex-basis:100%;font-weight:500;font-size:10px;opacity:.9;line-height:1.35">راجع الدرجات بعد التعبئة ثم اضغط «حفظ» في نور — الإضافة لا تحفظ عنك.</span>`;
    const classUi = bar.querySelector('.mbn-class');
    if (classPicker && classUi) {
      for (const o of classPicker.options) classUi.add(new Option((o.textContent || '').trim(), o.value));
      classUi.value = classPicker.value;
      classUi.addEventListener('change', () => {
        classPicker.value = classUi.value;
        classPicker.dispatchEvent(new Event('input', { bubbles: true }));
        classPicker.dispatchEvent(new Event('change', { bubbles: true }));
        const st = bar.querySelector('.mbn-st');
        if (st) st.textContent = 'تم اختيار الفصل في نور. انتظر تحديث جدول الطلاب، ثم اضغط «تعبئة الدرجات الآن».';
      });
    }
    bar.querySelector('.mbn-go').onclick = () => { const r = openPreview(sheet, bar.querySelector('.mbn-mode').value); if (!r.preview) toastBar({ filled: 0, rowsSeen: r.rowsSeen, noCols: r.noCols }); };
    bar.querySelector('.mbn-x').onclick = () => { bar.remove(); bar = null; };
    document.body.appendChild(bar);
    // سحب الصندوق لأي مكان في الشاشة باستخدام شريط العنوان، مع تقييده بحدود نافذة المتصفح.
    const dragHandle = bar.querySelector('.mbn-drag');
    if (dragHandle) {
      let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
      dragHandle.addEventListener('pointerdown', ev => {
        if (ev.button !== 0) return;
        dragging = true;
        const rect = bar.getBoundingClientRect();
        startX = ev.clientX; startY = ev.clientY; startLeft = rect.left; startTop = rect.top;
        bar.style.left = `${rect.left}px`; bar.style.top = `${rect.top}px`; bar.style.bottom = 'auto';
        dragHandle.setPointerCapture?.(ev.pointerId);
        ev.preventDefault();
      });
      dragHandle.addEventListener('pointermove', ev => {
        if (!dragging) return;
        const rect = bar.getBoundingClientRect();
        const left = Math.max(0, Math.min(window.innerWidth - rect.width, startLeft + ev.clientX - startX));
        const top = Math.max(0, Math.min(window.innerHeight - rect.height, startTop + ev.clientY - startY));
        bar.style.left = `${left}px`; bar.style.top = `${top}px`;
      });
      const stopDrag = () => { dragging = false; };
      dragHandle.addEventListener('pointerup', stopDrag);
      dragHandle.addEventListener('pointercancel', stopDrag);
    }
  }
  if (isTop) {
    if (document.body) showBar(); else document.addEventListener('DOMContentLoaded', showBar, { once: true });
    try { chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.mb_noor_alias) ALIAS = ch.mb_noor_alias.newValue || {}; if (area === 'local' && ch.mb_noor_grades) { if (bar) { bar.remove(); bar = null; } showBar(); } }); } catch (_) {}
  }
})();
