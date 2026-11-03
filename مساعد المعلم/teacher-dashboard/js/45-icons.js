/* ═══════════ ✨ التصميم العصري — المرحلة 3: أيقونات خطية بدل الإيموجي ═══════════
   في «هيكل» اللوحة فقط: القوائم، شريطا التنقل، عناوين الصفحات وأقسامها، أزرار الرصد ووضع الحصة.
   محتوى الطلاب والرسائل والشهادات يبقى بإيموجيه. الأيقونة بلون النص (currentColor) فتتبع أي ثيم.
   يعمل بتبديل الإيموجي في أول النص فقط — لا يغيّر أي زر ولا وظيفته. */
(function(){
  const P = {
    home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    clip:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
    folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    game:'<rect x="2.5" y="7" width="19" height="11" rx="4"/><path d="M7 11v3M5.5 12.5h3M15 12h.01M18 13.5h.01"/>',
    book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
    users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a5 5 0 0 1 3.5 6"/>',
    records:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    steth:'<path d="M6 3v6a5 5 0 0 0 10 0V3"/><path d="M11 14v2a5 5 0 0 0 10 0v-2"/><circle cx="21" cy="12" r="1.5"/>',
    medal:'<circle cx="12" cy="15" r="5"/><path d="M8.5 11 6 3h4l2 5 2-5h4l-2.5 8"/>',
    pen:'<path d="M14 4l6 6L9 21H3v-6z"/><path d="M12.5 5.5l6 6"/>',
    printer:'<path d="M7 8V3h10v5"/><rect x="3" y="8" width="18" height="9" rx="2"/><path d="M7 14h10v7H7z"/>',
    compass:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    report:'<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>',
    chart:'<path d="M4 20V4M4 20h16"/><rect x="7" y="11" width="3" height="6"/><rect x="12" y="7" width="3" height="10"/><rect x="17" y="13" width="3" height="4"/>',
    trend:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    school:'<path d="M3 10l9-5 9 5-9 5z"/><path d="M7 12v5c3 2 7 2 10 0v-5"/>',
    receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    msg:'<path d="M4 5h16v11H8l-4 4z"/>',
    wall:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v6M15 10v5M9 15v5"/>',
    award:'<circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/>',
    grad:'<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c4 3 8 3 12 0v-5M22 9v6"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    hand:'<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8a8 8 0 0 0 16 0v-3a2 2 0 0 0-4 0"/>',
    star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    alert:'<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    minus:'<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
    ban:'<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    bookok:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 10l2 2 4-4"/>',
    bookx:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M10 7l4 4M14 7l-4 4"/>',
    feather:'<path d="M20 4c-8 0-14 6-14 14v2"/><path d="M20 4c0 8-5 12-11 12M6 16h8"/>',
    refresh:'<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>',
    inbox:'<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 2h6l1-2h5"/>',
    alarm:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M19 3l3 3"/>',
    bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    puzzle:'<path d="M10 4a2 2 0 0 1 4 0v2h4v4h2a2 2 0 0 1 0 4h-2v4h-4v-2a2 2 0 0 0-4 0v2H6v-4H4a2 2 0 0 1 0-4h2V6h4z"/>',
    moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    tools:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    task:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12l2.5 2.5L16 9.5"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    save:'<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
    bot:'<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 17h6"/>',
    lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    send:'<path d="M21 3 3 10l7 3 3 7z"/><path d="M10 13l4-4"/>',
    pin:'<path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/>',
    phone:'<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/>'
  };
  const E = {'🏠':'home','⌂':'home','📋':'clip','📁':'folder','📂':'folder','🗂️':'records','🗂':'records','🎮':'game','📚':'book','👥':'users','🩺':'steth','🎖️':'medal','🎖':'medal',
    '📝':'pen','✏️':'pen','✍️':'pen','🖨️':'printer','🖨':'printer','🧭':'compass','📑':'report','📄':'report','📊':'chart','📈':'trend','🏫':'school','🧾':'receipt','💬':'msg','🧱':'wall',
    '🏅':'award','🎓':'grad','⚙️':'gear','⚙':'gear','✋':'hand','⭐':'star','🌟':'star','⚠️':'alert','⚠':'alert','💌':'mail','📨':'send','📷':'camera','🎤':'mic','🔍':'search','🔎':'search',
    '📅':'cal','🗓️':'cal','🗓':'cal','✅':'check','🚫':'ban','📗':'bookok','📕':'bookx','🕊️':'feather','🕊':'feather','🔄':'refresh','📥':'inbox','⏰':'alarm','🔔':'bell','🧩':'puzzle',
    '🌙':'moon','🙋':'user','🧰':'tools','🎯':'target','✅️':'check','🕘':'clock','⛔':'ban','📌':'pin','🎓':'grad','🔗':'link','💾':'save','🤖':'bot','🔒':'lock','📱':'phone','👤':'user'};
  /* في أزرار الرصد: ✋ تعني «لم يشارك» (لا «المشاركة») */
  const CHIP = {'✅':'check','✋':'minus','🚫':'ban','📗':'bookok','📕':'bookx','🕊️':'feather','🕊':'feather','🌟':'star','⚠️':'alert'};
  const svg = n => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[n]}</svg>`;
  window.icoSVG = n => P[n] ? svg(n) : '';
  const SEL = ['#simp-bottomnav .simp-bic', '.simp-chip', '.app-nav-icon', '.mnav-icon', '#portal-link-btn', '.panel > .sheet-head h2', '.td-head h2', '#ct-title',
    '#ct-nav .btn', '.ct-seg button', '.qr-mode button', '.qr-ic', '.qr-s', '#fm-bot i', '.td-kpi span', '.td-card-h > b', '.sheet-head h2', '.set-tabs button', '.ct-tools > .btn', '.td-head .btn', '.td-hero-t > b', '.td-hero-go', '.td-abs > b', '.td-link', '.td-task .td-ic', '.qr-all', '.askf-pin', '.askf-mode'].join(',');
  const LEAD = /^(\s*)(\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*|⌂|•••)\s*/u;
  function firstText(el){ const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n = w.nextNode();
    while (n) { if (n.nodeType === 1) { if (n.tagName === 'svg' || n.tagName === 'INPUT') return null; } else if (n.nodeValue.trim()) return n; n = w.nextNode(); } return null; }
  function iconize(el, map){
    if (el.querySelector(':scope > svg.ico, :scope > * > svg.ico')) return;
    const t = firstText(el); if (!t) return; const m = LEAD.exec(t.nodeValue); if (!m) return;
    const name = m[2] === '•••' ? 'more' : (map[m[2]] || map[m[2].replace(/️/g, '')]); if (!name || !P[name]) return;
    const span = document.createElement('span'); span.innerHTML = svg(name); const ic = span.firstChild;
    if (!el.hasAttribute('data-emo')) el.setAttribute('data-emo', m[2]);   // من يقرأ الإيموجي من هذا العنصر (مثل الشريط السفلي) يجده
    t.parentNode.insertBefore(ic, t); t.nodeValue = t.nodeValue.slice(m[0].length);
    if (t.nodeValue && !/^\s/.test(t.nodeValue) && !el.matches('.simp-bic,.app-nav-icon,.mnav-icon,#fm-bot i,.qr-ic,.qr-row .c')) t.nodeValue = ' ' + t.nodeValue;
  }
  let q = 0;
  function run(){ q = 0; try {
    document.querySelectorAll(SEL).forEach(el => iconize(el, E));
    document.querySelectorAll('.qr-row .c').forEach(el => iconize(el, CHIP));
  } catch (e) {} }
  const kick = () => { if (!q) q = requestAnimationFrame(run); };
  new MutationObserver(kick).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kick); else kick();
})();
