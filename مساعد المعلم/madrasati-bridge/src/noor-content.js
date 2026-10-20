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
  function score(a, b) {             // a,b: مصفوفتا أجزاء الاسم
    if (a.join(' ') === b.join(' ')) return 100;
    if (a[0] !== b[0] || a[a.length - 1] !== b[b.length - 1]) return 0;
    const midA = a.slice(1, -1), midB = new Set(b.slice(1, -1));
    return 10 + midA.filter(x => midB.has(x)).length;
  }
  // يرجع {m} عند التطابق، أو {why} بسبب الرفض: none (ليس في الكشف) · tie (أكثر من طالب بالاسم نفسه)
  function match(name, idx, used) {
    const t = norm(name).split(' ').filter(Boolean); if (t.length < 2) return { why: 'none' };
    let bs = 0, top = [];
    for (const x of idx) { if (used.has(x)) continue; const s = score(t, x.t);
      if (s > bs) { bs = s; top = [x]; } else if (s && s === bs) top.push(x); }
    if (!bs) return { why: 'none' };
    // الاسم مكرر في الكشف (طالب أُدخل مرتين) بدرجات متطابقة: لا التباس في الدرجة فيُعبّأ
    const same = top.every(x => fmt(x.r.work40) === fmt(top[0].r.work40) && fmt(x.r.exam20) === fmt(top[0].r.exam20));
    if (top.length > 1 && !same) return { why: 'tie', n: top.length };
    return { m: top[0], also: top.slice(1) };
  }
  // يُعلَّم الصف الذي لم يُعبّأ بإطار أحمر وسبب يظهر عند الوقوف عليه
  const WHY = { none: 'الاسم غير موجود في كشف مساعد المعلم', tie: 'أكثر من طالب بهذا الاسم في الكشف بدرجات مختلفة', empty: 'لا درجة له في الكشف', locked: 'خانته مقفلة في نور' };
  function markRow(tr, why) {
    if (why) { tr.style.outline = '2px solid #D6455B'; tr.style.outlineOffset = '-2px'; tr.title = '⚠️ مساعد المعلم: ' + WHY[why]; tr.dataset.mbWhy = why; }
    else if (tr.dataset.mbWhy) { tr.style.outline = ''; tr.title = ''; delete tr.dataset.mbWhy; }
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
    const under = (inp, hs) => { const p = pos.get(inp.closest('td,th')); return p && hs.some(h => p.c >= h.c && p.c < h.c + h.cs); };
    const fields = [...tr.querySelectorAll('input')].filter(isField);
    const w = fields.filter(i => under(i, heads.work)), e = fields.filter(i => under(i, heads.exam));
    return { work: w.length === 1 ? w[0] : null, exam: e.length === 1 ? e[0] : null, unknown: false, multi: w.length > 1 || e.length > 1 };
  }
  function fill(sheet, mode) {
    mode = ['both', 'work40', 'exam20'].includes(mode) ? mode : 'both';
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
        if (!m) { ambiguous++; missed.push({ name, why: mm.why }); markRow(tr, mm.why); continue; }
        used.add(m); (mm.also || []).forEach(x => used.add(x));
        const targets = gradeInputs(tr);
        if (targets.unknown) { noCols++; continue; }
        if (targets.multi) multiCols++;
        const w = fmt(m.r.work40), e = fmt(m.r.exam20);
        let rowFilled = false, rowLocked = false;
        const put = (inp, val) => {
          if (!inp || val === '') return;
          if (!editable(inp)) { locked++; rowLocked = true; return; }
          setVal(inp, val); fields++; rowFilled = true;
        };
        if (mode === 'both') { put(targets.work, w); put(targets.exam, e); }
        else if (mode === 'work40') put(targets.work, w);
        else put(targets.exam, e);
        if (rowFilled) filled++;
        else { const why = rowLocked ? 'locked' : 'empty'; missed.push({ name, why }); }
        markRow(tr, rowFilled ? '' : (rowLocked ? 'locked' : 'empty'));
      }
    }
    const unmatched = idx.filter(x => !used.has(x)).map(x => x.r.name);
    return { filled, fields, rowsSeen, unmatched, ambiguous, locked, noCols, multiCols, missed: missed.slice(0, 60) };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (!msg || msg.type !== 'mb:noorFill') return false;
    const r = fill(msg.payload || {}, (msg.payload && msg.payload.mode) || 'both');
    if (isTop || r.filled) { reply(r); toastBar(r); }   // الإطار الفرعي يرد فقط إن عبّأ شيئًا
    return false;
  });

  /* ── الشريط العائم (الإطار العلوي فقط) ── */
  let bar = null;
  function toastBar(r) {
    if (!bar) return;
    const st = bar.querySelector('.mbn-st');
    const warn = [r.locked ? `🔒 ${r.locked} خانة مقفلة في نور لم تُكتب` : '', r.multiCols ? '⚠️ بعض الصفوف فيها أكثر من خانة تحت العمود نفسه فتُركت' : ''].filter(Boolean).join(' · ');
    if (st && !r.filled && r.noCols) { st.textContent = '⚠️ لم أتعرف على عمودي «أعمال السنة» و«التقويمات التحريرية» في هذا الجدول — لم يُكتب شيء حتى لا تنعكس الدرجات. أرسل صورة الجدول للمطوّر.'; return; }
    if (st) st.textContent = (warn ? warn + ' — ' : '') + (r.filled ? `✅ عُبّئت ${r.fields || 0} خانة درجات لـ ${r.filled} طالب${r.unmatched && r.unmatched.length ? ` · ${r.unmatched.length} من الكشف ليسوا في هذه الصفحة` : ''} — راجعها ثم احفظ من نور` : `⚠️ لم تُعبّأ أي درجة (صفوف مفحوصة: ${r.rowsSeen || 0}). تأكد أنك داخل جدول رصد الدرجات وأن الكشف المصدّر يحتوي درجات.`);
    if (st && r.unmatched && r.unmatched.length) st.title = 'في الكشف ولم يُعثر عليهم في هذه الصفحة: ' + r.unmatched.join('، ');
    // طلاب هذه الصفحة الذين لم تُعبّأ درجاتهم — بالاسم والسبب (والصف نفسه بإطار أحمر)
    let box = bar && bar.querySelector('.mbn-miss'); if (box) box.remove();
    if (bar && r.missed && r.missed.length) {
      box = document.createElement('div'); box.className = 'mbn-miss';
      box.style.cssText = 'flex-basis:100%;background:#3A1E28;border-radius:8px;padding:5px 8px;font-weight:500;font-size:11px;line-height:1.5;max-height:110px;overflow:auto';
      const short = { none: 'غير موجود في الكشف', tie: 'اسم مكرر في الكشف', empty: 'بلا درجة في الكشف', locked: 'خانة مقفلة' };
      box.textContent = `🔴 لم تُعبّأ درجات ${r.missed.length} في هذه الصفحة (بإطار أحمر): ` + r.missed.map(x => `${x.name.split(' ').filter(w => w !== 'بن').slice(0, 2).join(' ')} — ${short[x.why]}`).join(' · ');
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
      <button type="button" class="mbn-go" style="background:#1B9C6B;color:#fff;border:0;border-radius:8px;padding:5px 9px;font:inherit;cursor:pointer;white-space:nowrap">✍️ تعبئة الدرجات الآن</button>
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
    bar.querySelector('.mbn-go').onclick = () => toastBar(fill(sheet, bar.querySelector('.mbn-mode').value));
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
    try { chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.mb_noor_grades) { if (bar) { bar.remove(); bar = null; } showBar(); } }); } catch (_) {}
  }
})();
