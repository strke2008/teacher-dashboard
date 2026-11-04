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
    chev:'<path d="M6 9l6 6 6-6"/>',
    x:'<path d="M6 6l12 12M18 6L6 18"/>',
    trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4"/>',
    eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    download:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload:'<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    scale:'<path d="M12 4v16M7 20h10M5 8h14M5 8l-3 6a3 3 0 0 0 6 0zM19 8l-3 6a3 3 0 0 0 6 0z"/>',
    brain:'<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h0a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3 2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>',
    mega:'<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M17 9a4 4 0 0 1 0 6M7 14l1 6h3l-1-5"/>',
    tag:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
    trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    gift:'<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8S10 3 7.5 4.5 9 8 12 8zM12 8s2-5 4.5-3.5S15 8 12 8z"/>',
    key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
    down:'<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
    call:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    clipx:'<path d="M21 11l-9 9a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8"/>',
    cart:'<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l3 12h11l2-8H6"/>',
    undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    palette:'<path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.5-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    broom:'<path d="M14 3l-4 9M6 14h10l2 7H4z"/>',
    phone:'<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/>',
    /* توحيد الأيقونات: ما بقي إيموجي في الوسوم والتلميحات وأزرار البطاقات */
    bandage:'<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M10 10h.01M14 14h.01M10 14h.01M14 10h.01"/>',
    bookopen:'<path d="M2.5 5.5C5 4.5 8.5 4.5 12 6.5c3.5-2 7-2 9.5-1V19c-2.5-1-6-1-9.5 1-3.5-2-7-2-9.5-1z"/><path d="M12 6.5V20"/>',
    flask:'<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.5 14h9"/>',
    coin:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 9.5h3.75a1.75 1.75 0 0 1 0 3.5h-2.5a1.75 1.75 0 0 0 0 3.5h3.75"/>',
    bulb:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    cloud:'<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4.3 4.3 0 0 1-.5 8.5z"/>',
    coffee:'<path d="M4 9h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3"/>',
    leaf:'<path d="M5 19C5 10 10 5 20 4c-1 10-6 15-15 15z"/><path d="M5 19l8-8"/>',
    walk:'<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6 3 3v3M9 12l2-4.5 3 1.5 2 3M11 7.5l-3 2-1 3"/>',
    belloff:'<path d="M6 16V11a6 6 0 0 1 9.5-4.9M18 11v5l1.5 2H8M10 21h4M3 3l18 18"/>',
    cards:'<rect x="3" y="6" width="12" height="15" rx="2"/><path d="M9 3h10a2 2 0 0 1 2 2v12"/>',
    timer:'<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V10M10 2.5h4M18.5 6.5l1.5-1.5"/>',
    mosque:'<path d="M4 21V12a8 8 0 0 1 16 0v9z"/><path d="M12 4V2M9 21v-4a3 3 0 0 1 6 0v4"/>',
    sparkle:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    dotg:'<circle cx="12" cy="12" r="5.5" fill="#22C55E" stroke="none"/>',
    doty:'<circle cx="12" cy="12" r="5.5" fill="#EAB308" stroke="none"/>',
    doto:'<circle cx="12" cy="12" r="5.5" fill="#F97316" stroke="none"/>',
    dotr:'<circle cx="12" cy="12" r="5.5" fill="#EF4444" stroke="none"/>',
    dotw:'<circle cx="12" cy="12" r="5"/>',
    skip:'<path d="M5 5l9 7-9 7z"/><path d="M18 5v14"/>'
  };
  const E = {'🏠':'home','⌂':'home','📋':'clip','📁':'folder','📂':'folder','🗂️':'records','🗂':'records','🎮':'game','📚':'book','👥':'users','🩺':'steth','🎖️':'medal','🎖':'medal',
    '📝':'pen','✏️':'pen','✍️':'pen','🖨️':'printer','🖨':'printer','🧭':'compass','📑':'report','📄':'report','📊':'chart','📈':'trend','🏫':'school','🧾':'receipt','💬':'msg','🧱':'wall',
    '🏅':'award','🎓':'grad','⚙️':'gear','⚙':'gear','✋':'hand','⭐':'star','🌟':'star','⚠️':'alert','⚠':'alert','💌':'mail','📨':'send','📷':'camera','🎤':'mic','🔍':'search','🔎':'search',
    '📅':'cal','🗓️':'cal','🗓':'cal','✅':'check','🚫':'ban','📗':'bookok','📕':'bookx','🕊️':'feather','🕊':'feather','🔄':'refresh','📥':'inbox','⏰':'alarm','🔔':'bell','🧩':'puzzle',
    '🌙':'moon','🙋':'user','🧰':'tools','🎯':'target','✅️':'check','🕘':'clock','☑️':'task','☑':'task','⛔':'ban','📌':'pin','🎓':'grad','🔗':'link','💾':'save','🤖':'bot','🔒':'lock','📱':'phone','👤':'user',
    '🏆':'trophy','👁':'eye','👁️':'eye','⬇️':'download','⬇':'download','📤':'upload','⚖️':'scale','⚖':'scale','🧠':'brain','📢':'mega','🏷️':'tag','🏷':'tag','🕐':'clock','🗑️':'trash','🗑':'trash',
    '🎁':'gift','🔐':'lock','📜':'report','🧹':'broom','🔑':'key','📒':'book','🆘':'alert','🚨':'alert','🔻':'down','🔺':'trend','📞':'call','🗳️':'task','🗳':'task','📎':'clipx','🛒':'cart',
    '↩️':'undo','↩':'undo','🎨':'palette','👪':'users','➕':'plus','🔬':'flask','💡':'bulb',
    '🩹':'bandage','📖':'bookopen','🧪':'flask','🪙':'coin','☁️':'cloud','☁':'cloud','☕':'coffee','🌿':'leaf','🚶':'walk','🔕':'belloff','🎴':'cards',
    '⏱️':'timer','⏱':'timer','⏲️':'timer','⏲':'timer','⌛':'timer','⏳':'timer','🕌':'mosque','🌈':'sparkle','✨':'sparkle','❌':'x','✖️':'x','✉️':'mail','✉':'mail','📉':'down',
    '🕓':'clock','🕒':'clock','🕑':'clock','🔘':'dotw','⚪':'dotw','🟢':'dotg','🟡':'doty','🟠':'doto','🔴':'dotr','📃':'report','🗒️':'report','🗒':'report','📆':'cal','🏁':'task','⏭️':'skip','⏭':'skip'};
  /* في أزرار الرصد: ✋ تعني «لم يشارك» (لا «المشاركة») */
  const CHIP = {'✅':'check','✋':'minus','🚫':'ban','📗':'bookok','📕':'bookx','🕊️':'feather','🕊':'feather','🌟':'star','⚠️':'alert'};
  const svg = n => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[n]}</svg>`;
  window.icoSVG = n => P[n] ? svg(n) : '';
  /* إيموجي ← أيقونته مباشرة (للتنقل الذي يُبنى بالسكربت: يُرسم بالأيقونة من البداية بلا انتظار المراقب) */
  window.icoFor = e => { const k = String(e || '').trim(); const n = k === '•••' ? 'more' : (E[k] || E[k.replace(/️/g, '')]); return n && P[n] ? svg(n) : ''; };
  /* «هيكل» الصفحات: الأزرار والعناوين والقوائم والوسوم — لا محتوى الطلاب ولا الرسائل ولا المتجر */
  const SEL = ['#simp-bottomnav .simp-bic', '.simp-chip', '.app-nav-icon', '.mnav-icon', '#fm-bot i', '.td-kpi span', '.td-task .td-ic', '.qr-ic', '.qr-s', '.askf-ic',
    'button', 'summary', 'h1', 'h2', 'h3', 'h4', 'legend', 'label', '.chip', '.stat-icon', '.report-hub-icon', '.td-link', 'b', '.td-hero-t > b',
    /* توحيد كامل: الوسوم (نوع النشاط، منشور، تدريب…)، أيقونات البطاقات والملف، والتلميحات والحالات أول السطر */
    '.pill', '.act-kind', '.a-icon', '.td-ic', '.pf-ti', '.par-ic', '.pf-pin', '.td-now', '.ct-today', '.td-empty', '.simp-grp-title', '.sc-brk', '.ni',
    '.madb-pill', '.sale-status', '.exam-shop-status', '.thm-note', 'small', 'span', 'div.muted', '.sheet.muted', '.badge', '.tag', '.ann-hint'].join(',');
  const SKIP = '.nafs-ic, .nafs-q, .wall-post, .wall-card, .ask-msg, .askf-msg, .askf-thread, .msg-body, .store-item, .ms-prev, .m2-prev, .pm-card p, [contenteditable], textarea, [data-noico]';
  const LEAD = /^(\s*)(\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*|⌂|•••)\s*/u;
  function firstText(el){ const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n = w.nextNode();
    while (n) { if (n.nodeType === 1) { if (n.tagName === 'svg') return null; } else if (n.nodeValue.trim()) return n; n = w.nextNode(); } return null; }   // (مربع اختيار قبل النص في label لا يمنع)
  function iconize(el, map){
    if (el.querySelector(':scope > svg.ico, :scope > * > svg.ico')) return;
    const t = firstText(el); if (!t) return; const m = LEAD.exec(t.nodeValue); if (!m) return;
    const name = m[2] === '•••' ? 'more' : (map[m[2]] || map[m[2].replace(/️/g, '')]); if (!name || !P[name]) return;
    const span = document.createElement('span'); span.innerHTML = svg(name); const ic = span.firstChild;
    for (const x of [el, t.parentNode]) if (x && x.nodeType === 1 && !x.hasAttribute('data-emo')) x.setAttribute('data-emo', m[2]);   // على العنصر وعلى حاوية الإيموجي نفسها   // من يقرأ الإيموجي من هذا العنصر (مثل الشريط السفلي) يجده
    t.parentNode.insertBefore(ic, t); t.nodeValue = t.nodeValue.slice(m[0].length);
    if (t.nodeValue && !/^\s/.test(t.nodeValue) && !el.matches('.simp-bic,.app-nav-icon,.mnav-icon,#fm-bot i,.qr-ic,.qr-row .c')) t.nodeValue = ' ' + t.nodeValue;
  }
  /* إيموجي في وسط السطر (مثل «0/3 · 📎 سُلّم» و«الفصل 1 · 🟢 الشراء متاح»): نصوص العنصر المباشرة فقط، والمعروف منها فقط */
  const ANY = /(\p{Extended_Pictographic}️?)/u;
  function inline(el){
    for (const t of [...el.childNodes]) { if (t.nodeType !== 3 || !ANY.test(t.nodeValue)) continue;
      const parts = t.nodeValue.split(/(\p{Extended_Pictographic}️?)/u); if (parts.length < 3) continue;
      if (!parts.some((x, i) => i % 2 && (E[x] || E[x.replace(/️/g, '')]))) continue;
      const frag = document.createDocumentFragment();
      parts.forEach((x, i) => { const n = i % 2 ? (E[x] || E[x.replace(/️/g, '')]) : null;
        if (n && P[n]) { const sp = document.createElement('span'); sp.innerHTML = svg(n); frag.appendChild(sp.firstChild); } else if (x) frag.appendChild(document.createTextNode(x)); });
      el.replaceChild(frag, t); }
  }
  /* أول مرة: مسح كامل. بعدها: ما أُضيف أو تغيّر فقط (لا مسح للصفحة كلها مع كل تغيير) */
  /* القائمة المنسدلة (select) لا تعرض رسمًا أصلًا: يُحذف الإيموجي من أول نص الخيار فقط (value لا تتغير) */
  const opt = el => { const t = el.firstChild; if (!t || t.nodeType !== 3) return; const m = LEAD.exec(t.nodeValue); if (!m || m[2] === '•••') return; if (!el.hasAttribute('data-emo')) el.setAttribute('data-emo', m[2]); t.nodeValue = m[1] + t.nodeValue.slice(m[0].length); };
  const one = el => { try { if (el.tagName === 'OPTION') { if (!el.closest(SKIP)) opt(el); } else if (el.matches('.qr-row .c')) iconize(el, CHIP); else if (el.matches(SEL) && !el.closest(SKIP)) { iconize(el, E); inline(el); } } catch (e) {} };
  const scan = root => { if (root.nodeType !== 1) return; one(root); root.querySelectorAll(SEL + ',.qr-row .c,option').forEach(one); };
  let q = 0; const pend = new Set();
  function flush(){ q = 0; const L = [...pend]; pend.clear(); for (const n of L) if (n.isConnected) scan(n); }
  new MutationObserver(recs => { for (const r of recs) { if (r.type === 'childList') { r.addedNodes.forEach(n => { if (n.nodeType === 1) pend.add(n); }); if (r.target.nodeType === 1) { const c = r.target.closest(SEL); if (c) pend.add(c); } } }   // (target: نص تغيّر داخل زر/عنوان)
    if (pend.size && !q) q = requestAnimationFrame(flush); }).observe(document.documentElement, { childList: true, subtree: true });
  const first = () => scan(document.body);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', first); else first();
})();
