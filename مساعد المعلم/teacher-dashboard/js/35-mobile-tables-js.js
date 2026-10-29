/* 📱 نسخة الجوال للجداول العريضة في كل اللوحة (نفس فكرة الكشف المضغوط):
   - الجدول يُسحب بالعرض داخل إطاره بدل تصغير الصفحة كلها حتى لا تُقرأ (كان التقرير يُصغَّر حتى 32%)
   - عمود الاسم ثابت أثناء السحب
   - لمس الصف يفتح ورقة بتفاصيله: عنوان كل عمود وقيمته
   لا يغيّر أي حساب ولا الطباعة ولا الكمبيوتر: يعمل فقط على شاشة الجوال (≤700px). */
(function(){
  const MQ = window.matchMedia('(max-width:700px)');
  const SKIP = '.cm-t, .nf-fig-t, .cm-sheet table, .no-mt';
  const isMob = () => MQ.matches && !/\bprinting-/.test(document.body.className);
  const txt = el => String((el && (el.innerText || el.textContent)) || '').replace(/\s+/g, ' ').trim();

  function headers(tb){
    const hr = tb.tHead ? [...tb.tHead.rows] : [];
    const row = hr.length ? hr[hr.length - 1] : null;
    const first = hr.length ? hr[0] : null;
    // عناوين مركّبة (صفّان): نستعمل الصف الأخير إن كان عدده يطابق الخلايا، وإلا الأول
    const pick = r => r ? [...r.cells].flatMap(c => Array(Math.max(1, c.colSpan || 1)).fill(txt(c))) : [];
    const a = pick(row), b = pick(first);
    return a.length >= b.length ? a : b;
  }
  function nameCol(h){
    let k = h.findIndex(t => /الطالب|اسم/.test(t));
    if(k < 0) k = /^(م|#|ت)$/.test(h[0] || '') ? 1 : 0;
    return k;
  }
  function wide(tb){
    const n = Math.max(0, ...[...tb.rows].slice(0, 3).map(r => r.cells.length));
    const par = tb.parentElement;
    return n >= 5 || (par && tb.scrollWidth > par.clientWidth + 4);
  }
  // العمود الثابت يحتاج خلفية معتمة بلون صفّه الفعلي (وإلا ظهرت الأرقام من تحته أثناء السحب)
  function solidBg(el){
    const stop = el.closest('table'); if(!stop) return null;
    for(let x = el; x && x !== stop.parentElement; x = x.parentElement){   // داخل الجدول فقط
      const cs = getComputedStyle(x), b = cs.backgroundColor;
      if(cs.backgroundImage && cs.backgroundImage !== 'none') return { img: cs.backgroundImage, col: b };   // عنوان بتدرّج لوني
      if(b && b !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(b)) return { col: b };
    }
    return null;
  }
  function pin(c){
    c.classList.add('mt-nm'); const b = solidBg(c); if(!b) return;
    if(b.img){ c.style.backgroundImage = b.img; if(b.col && !/,\s*0\)$/.test(b.col)) c.style.backgroundColor = b.col; else c.style.backgroundColor = '#16233a'; return; }
    if(!/rgba\(.*,\s*0?\.\d+\)$/.test(b.col)) c.style.backgroundColor = b.col;
  }
  function enhance(tb){
    if(tb.dataset.mt || tb.closest(SKIP) || tb.matches(SKIP) || !tb.offsetParent) return;
    if(!tb.tBodies.length || !wide(tb)) return;
    tb.dataset.mt = '1';
    const par = tb.parentElement, ov = par ? getComputedStyle(par).overflowX : 'visible';
    if(!(ov === 'auto' || ov === 'scroll')){
      const w = document.createElement('div'); w.className = 'mt-wrap';
      par.insertBefore(w, tb); w.appendChild(tb);
    }
    tb.classList.add('mt-on');
    const h = headers(tb), k = nameCol(h);
    tb.dataset.mtk = k;
    const mark = r => { const c = r.cells[k]; if(c && r.cells.length >= h.length - 1) pin(c); };
    // جدول له أعمدة ثابتة من قبل (مثل كشف الدرجات): لا نضيف تثبيتًا ثانيًا يتعارض معها
    const own = [...(tb.rows[0] || {cells:[]}).cells].some(c => getComputedStyle(c).position === 'sticky');
    if(own){ tb.dataset.mtown = '1'; return; }
    [...tb.rows].forEach(mark);
  }
  function scan(){
    if(!isMob()) return;
    const before = document.querySelectorAll('table.mt-on').length;
    document.querySelectorAll('.panel.on table, .modal table, #modal table, .ov table').forEach(tb => { try{ enhance(tb); }catch(e){} });
    // صفوف تُضاف لاحقًا لجدول معالج (تحديث جزئي)
    document.querySelectorAll('table.mt-on:not([data-mtown])').forEach(tb => { const k = +tb.dataset.mtk || 0; [...tb.rows].forEach(r => { const c = r.cells[k]; if(c && !c.classList.contains('mt-nm') && r.cells.length > k + 2) pin(c); }); });
    // صار الجدول يُسحب داخل إطاره ⇒ لا داعي لتصغير التقرير كله
    if(document.querySelectorAll('table.mt-on').length !== before && typeof fitReportsToWidth === 'function') try{ fitReportsToWidth(); }catch(e){}
  }
  let T = 0; const later = () => { clearTimeout(T); T = setTimeout(scan, 120); };
  new MutationObserver(later).observe(document.documentElement, { childList:true, subtree:true });
  MQ.addEventListener ? MQ.addEventListener('change', later) : MQ.addListener(later);
  document.addEventListener('DOMContentLoaded', later); later();

  // 👆 لمس الصف ⇒ ورقة التفاصيل (لا تتدخل في الأزرار والحقول والروابط داخل الصف)
  document.addEventListener('click', e => {
    if(!isMob()) return;
    const tr = e.target.closest && e.target.closest('table.mt-on tbody tr'); if(!tr) return;
    if(e.target.closest('a,button,input,select,textarea,label,summary,[onclick],[contenteditable]')) return;
    const tb = tr.closest('table'), h = headers(tb), k = +tb.dataset.mtk || 0;
    const cells = [...tr.cells]; if(cells.length < 3) return;
    const title = txt(cells[k]) || txt(cells[0]);
    const rows = []; let i = 0;
    cells.forEach(c => { const span = Math.max(1, c.colSpan || 1), lab = h[i] || ''; i += span;
      if(c === cells[k] || /^(م|#)$/.test(lab)) return;
      // أزرار الإجراء (＋ خطة، تعديل…) ليست قيمة تُعرض — تبقى في الجدول
      const cl = c.cloneNode(true); cl.querySelectorAll('button,select,input,textarea').forEach(x => x.remove());
      let v = txt(cl); if(!v) return; rows.push([lab, v]); });
    if(!rows.length) return;
    document.getElementById('cm-sheet')?.remove();
    const esc2 = s => String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
    const v = document.createElement('div'); v.id = 'cm-sheet'; v.className = 'cm-veil'; v.onclick = ev => { if(ev.target === v) v.remove(); };
    v.innerHTML = `<div class="cm-sheet" role="dialog" aria-label="${esc2(title)}"><div class="cm-grab"></div>
      <div class="cm-sh"><div><b>${esc2(title)}</b></div></div>
      ${rows.map(([l, x]) => `<div class="cm-row"><span>${esc2(l || '—')}</span><div><b>${esc2(x)}</b></div></div>`).join('')}
      <button type="button" class="btn ghost" style="width:100%;margin-top:.7rem" onclick="document.getElementById('cm-sheet').remove()">إغلاق</button></div>`;
    document.body.appendChild(v);
  });
})();
