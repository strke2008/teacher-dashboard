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
  const editable = i => i && !i.disabled && !i.readOnly && /^(text|number|tel|)$/i.test(i.type || '') && visible(i);
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
  function match(name, idx, used) {
    const t = norm(name).split(' ').filter(Boolean); if (t.length < 2) return null;
    let best = null, bs = 0, tie = false;
    for (const x of idx) { if (used.has(x)) continue; const s = score(t, x.t);
      if (s > bs) { best = x; bs = s; tie = false; } else if (s && s === bs) tie = true; }
    return bs && !tie ? best : null;
  }
  function setVal(inp, v) {
    const proto = Object.getPrototypeOf(inp), d = Object.getOwnPropertyDescriptor(proto, 'value');
    if (d && d.set) d.set.call(inp, v); else inp.value = v;
    for (const ev of ['input', 'change', 'blur']) inp.dispatchEvent(new Event(ev, { bubbles: true }));
    inp.style.background = '#E6F7EE';
  }
  const fmt = v => (v == null || v === '' ? '' : String(Math.round(Number(v) * 100) / 100));
  function fill(sheet, mode) {
    mode = ['both', 'work40', 'exam20'].includes(mode) ? mode : 'both';
    const idx = indexSheet(Array.isArray(sheet && sheet.rows) ? sheet.rows : []), used = new Set();
    let filled = 0, rowsSeen = 0, ambiguous = 0;
    for (const doc of (isTop ? docsOf(document) : [document])) {
      for (const tr of doc.querySelectorAll('tr')) {
        const inputs = [...tr.querySelectorAll('input')].filter(editable);
        if (!inputs.length) continue;
        const name = rowName(tr); if (!name) continue;
        rowsSeen++;
        const m = match(name, idx, used);
        if (!m) { ambiguous++; continue; }
        used.add(m);
        const w = fmt(m.r.work40), e = fmt(m.r.exam20);
        if (mode === 'both') { if (w !== '') setVal(inputs[0], w); if (inputs[1] && e !== '') setVal(inputs[1], e); }
        else if (mode === 'work40') { if (w !== '') setVal(inputs[0], w); }
        else { if (e === '') continue; setVal(inputs.length >= 2 ? inputs[1] : inputs[0], e); }   // اختبار لم يُرصد: لا يُكتب صفرًا
        filled++;
      }
    }
    const unmatched = idx.filter(x => !used.has(x)).map(x => x.r.name);
    return { filled, rowsSeen, unmatched, ambiguous };
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
    if (st) st.textContent = r.filled ? `✅ عُبّئت درجات ${r.filled} طالب${r.unmatched && r.unmatched.length ? ` · لم يُطابَق ${r.unmatched.length}` : ''} — راجعها ثم احفظ من نور` : '⚠️ لم أجد صفوف طلاب بخانات إدخال في هذه الصفحة — افتح صفحة رصد الدرجات أولًا';
    if (st && r.unmatched && r.unmatched.length) st.title = 'لم يُطابَق: ' + r.unmatched.join('، ');
  }
  async function showBar() {
    if (!isTop || bar) return;
    let sheet = null; try { sheet = (await chrome.storage.local.get('mb_noor_grades')).mb_noor_grades; } catch (_) {}
    if (!sheet || !Array.isArray(sheet.rows) || !sheet.rows.length) return;
    bar = document.createElement('div');
    bar.setAttribute('dir', 'rtl');
    bar.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147483647;background:#16233A;color:#fff;border-radius:14px;padding:10px 14px;box-shadow:0 10px 30px rgba(0,0,0,.3);font:600 13px Tahoma,Arial,sans-serif;display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:min(96vw,760px)';
    const when = sheet.at ? new Date(sheet.at).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
    bar.innerHTML = `<span>🏛️ كشف مساعد المعلم: <b>${sheet.rows.length}</b> طالب${sheet.cls ? ' · ' + String(sheet.cls).replace(/[<>&]/g, '') : ''}${sheet.label ? ' · ' + String(sheet.label).replace(/[<>&]/g, '') : ''}${when ? ' · ' + when : ''}</span>
      <select class="mbn-mode" style="border-radius:8px;padding:4px 6px;font:inherit;color:#16233A">
        <option value="both">الخانتان: أعمال السنة 40 ثم الاختبار 20</option>
        <option value="work40">أعمال السنة (40) فقط</option>
        <option value="exam20">الاختبار (20) فقط</option></select>
      <button type="button" class="mbn-go" style="background:#1B9C6B;color:#fff;border:0;border-radius:9px;padding:6px 12px;font:inherit;cursor:pointer">✍️ تعبئة الدرجات الآن</button>
      <button type="button" class="mbn-x" title="إخفاء" style="background:transparent;color:#fff;border:0;font-size:16px;cursor:pointer">✕</button>
      <span class="mbn-st" style="flex-basis:100%;font-weight:500;font-size:12px;opacity:.9">راجع الدرجات بعد التعبئة ثم اضغط «حفظ» في نور — الإضافة لا تحفظ عنك.</span>`;
    bar.querySelector('.mbn-go').onclick = () => toastBar(fill(sheet, bar.querySelector('.mbn-mode').value));
    bar.querySelector('.mbn-x').onclick = () => { bar.remove(); bar = null; };
    document.body.appendChild(bar);
  }
  if (isTop) {
    if (document.body) showBar(); else document.addEventListener('DOMContentLoaded', showBar, { once: true });
    try { chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.mb_noor_grades) { if (bar) { bar.remove(); bar = null; } showBar(); } }); } catch (_) {}
  }
})();
