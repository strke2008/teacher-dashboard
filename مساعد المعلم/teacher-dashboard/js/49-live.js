/* ═══════════ 🎙️ «محادثة حية» مع مساعدي — Gemini Live (نسخة تجريبية: قراءة فقط) ═══════════
   صوت ↔ صوت مباشرة عبر WebSocket: الميكروفون بـ getUserMedia (لا التعرّف المدمج في سفاري — فلا تجمّد على iPhone)،
   والرد صوت من Gemini نفسه، ويسمع ويتكلم في الوقت نفسه (كتم الصدى من المتصفح).
   الأدوات: أدوات القراءة نفسها في «مساعدي» (الغياب، الدرجات، المهارات، الاختبارات…) تُحسب في جهازك، ويُرسل للمزوّد ما يلزم فقط
   بلا معرّفات (asstStrip). لا تنفيذ في هذه النسخة: أوامر الرصد والرسائل تبقى في «مساعدي» المكتوب ببطاقة التأكيد.
   مقفولة افتراضيًا: زر 🎙️ يظهر في رأس «مساعدي» فقط إن وُجد مفتاح Gemini. */
const LIVE = { lang: true, lv: 2, ws: null, ctx: null, stream: null, src: null, node: null, on: false, state: '', play: 0, srcs: [], me: null, bot: null, model: '', tried: [], t0: 0 };
const LIVE_MODELS = ['gemini-3.8-live', 'gemini-3.1-flash-live-preview'];
const liveKey = () => { try { return typeof readingAIGetKey === 'function' ? readingAIGetKey('gemini') : ''; } catch (e) { return ''; } };
/* 🗣️ أصوات Gemini الجاهزة — الافتراضي صوت رجل */
const LIVE_VOICES = [['Charon', 'رجل — هادئ وواضح'], ['Orus', 'رجل — حازم'], ['Iapetus', 'رجل — صافٍ'], ['Algieba', 'رجل — ناعم'], ['Puck', 'رجل — حيوي'], ['Fenrir', 'رجل — متحمس'], ['Kore', 'امرأة — واثقة'], ['Aoede', 'امرأة — خفيفة'], ['Leda', 'امرأة — شابة'], ['Zephyr', 'امرأة — مشرقة']];
const liveVoice = () => { try { return localStorage.getItem('live_voice') || 'Charon'; } catch (e) { return 'Charon'; } };
function liveVoiceSet(v) { try { localStorage.setItem('live_voice', v); } catch (e) {} toast('🎙️ الصوت: ' + ((LIVE_VOICES.find(x => x[0] === v) || [])[1] || v) + (LIVE.on ? ' — يتغيّر من المحادثة الجاية' : ''), 'good'); }
/* مقفولة افتراضيًا: تُفعَّل من ⚙️ الإعدادات ← الذكاء الاصطناعي ← «🎙️ المحادثة الحية» */
const liveOn = () => { try { return localStorage.getItem('live_on') === '1'; } catch (e) { return false; } };
function liveOnSet(on) { try { if (on) localStorage.setItem('live_on', '1'); else localStorage.removeItem('live_on'); } catch (e) {} if (!on && (LIVE.on || LIVE.state)) liveStop();
  const p = document.getElementById('asst-panel'); if (p) p.remove();   // يُبنى رأس «مساعدي» من جديد عند فتحه بالزر الصحيح
  try { toast(on ? '🎙️ فُعّلت المحادثة الحية — زرها في رأس «مساعدي»' : '🎙️ أُقفلت المحادثة الحية', 'good'); } catch (e) {} }
(function liveOnInit() { const go = () => { const c = document.getElementById('live-on-tg'); if (c) c.checked = liveOn(); const v = document.getElementById('live-voice'); if (v) { v.innerHTML = LIVE_VOICES.map(([k, l]) => `<option value="${k}">${l} (${k})</option>`).join(''); v.value = liveVoice(); } }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go(); })();
const liveSup = () => !!(liveOn() && liveKey() && window.WebSocket && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext));

/* أدوات القراءة فقط ← تعريفات دوال لـ Gemini (الوسائط تُستخرج من وصف كل أداة «args: {…}») */
const LIVE_NUM = ['n', 'days', 'question', 'sem', 'per', 'min', 'delta', 'max'], LIVE_BOOL = ['all', 'print', 'close'], LIVE_ARR = ['classes', 'students', 'except'];
function liveTools() {
  return Object.entries(ASST_TOOLS).map(([name, t]) => {
    const d = String(t.d || ''), m = d.match(/args:\s*\{([\s\S]*)\}/), props = {};
    (m ? m[1] : '').replace(/\b([a-z_]+)\??:/g, (_, a) => { if (props[a]) return '';
      props[a] = LIVE_NUM.includes(a) ? { type: 'NUMBER' } : LIVE_BOOL.includes(a) ? { type: 'BOOLEAN' } : LIVE_ARR.includes(a) ? { type: 'ARRAY', items: { type: 'STRING' } }
        : a === 'scores' ? { type: 'ARRAY', items: { type: 'OBJECT', properties: { student: { type: 'STRING' }, score: { type: 'STRING' } } } } : { type: 'STRING' }; return ''; });
    if (props.scores) { delete props.student; delete props.score; }
    return { name, description: ((t.act ? '(تجهيز فقط: يظهر للمعلم بطاقة تأكيد ولا يُنفَّذ إلا بضغطته) ' : '') + d).slice(0, 900), behavior: 'BLOCKING', ...(Object.keys(props).length ? { parameters: { type: 'OBJECT', properties: props } } : {}) };
  });
}
function liveSystem() {
  return `🗣️ اللغة: تكلّم بالعربية دائمًا (لهجة خليجية مهذبة أو فصحى مبسطة) مهما كانت لغة ما تسمعه أو ما يظهر في النسخ — لا تردّ أبدًا بالإسبانية أو الإنجليزية أو غيرها.
المعلم يتكلم بالعربية فقط: إن سمعت كلامًا غير واضح أو كلمات بلغة أخرى فهي غالبًا ضجيج أو خطأ سماع — قل باختصار «ما سمعتك زين، عيدها؟» بالعربية ولا تجب عنها.
${asstIntro()}
أنت في «محادثة حية» صوتية مع المعلم: أجب بالعربية بصوت طبيعي ودود وبإيجاز (جملتان أو ثلاث)، واذكر الأرقام والأسماء بوضوح.
استخدم الأدوات للأسئلة عن طلابه وبياناته، ولا تخترع أسماء أو أرقامًا. «النقاط» = رصيد نقاط المكافآت (أداة points)، وهي غير الدرجات.
تقدر تجهّز كل أوامر «مساعدي» (رصد، درجات، نقاط، رسائل، تذكيرات، فتح صفحات…) بأدوات التجهيز: كل أمر يظهر للمعلم ببطاقة على الشاشة ولا يُنفَّذ إلا إذا ضغط «نفّذ» بنفسه — فقل له بإيجاز ماذا جهّزت واطلب منه يراجع البطاقة ويضغط. لا تقل أبدًا إنك نفّذت. ولا تقل «جهّزت» إلا بعد أن تستدعي أداة التجهيز فعلًا وتصلك نتيجتها — إن لم تستدعها فلم يظهر شيء.
فتح الصفحات (open_page) يُنفَّذ فورًا بلا بطاقة: استدعِ open_page وقل «فتحتها لك».
في رسالة ولي الأمر (parent_message) اكتب نص الرسالة كاملًا في message بالعربية الفصحى المبسطة، يبدأ بـ«السلام عليكم ورحمة الله» وينتهي بـ«معلم المادة».
تذكير أخير: ردك بالعربية فقط.`;
}

/* 🔊 تشغيل PCM 24 كيلوهرتز بالتتابع */
function livePlay(b64) {
  const C = LIVE.ctx; if (!C) return; const bin = atob(b64), n = bin.length >> 1, f = new Float32Array(n);
  for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v >= 32768) v -= 65536; f[i] = v / 32768; }
  const buf = C.createBuffer(1, n, 24000); buf.copyToChannel ? buf.copyToChannel(f, 0) : buf.getChannelData(0).set(f);
  const s = C.createBufferSource(); s.buffer = buf; s.connect(C.destination); const at = Math.max(C.currentTime + 0.03, LIVE.play); s.start(at); LIVE.play = at + buf.duration;
  LIVE.srcs.push(s); s.onended = () => { LIVE.srcs = LIVE.srcs.filter(x => x !== s); if (!LIVE.srcs.length) { LIVE.quiet = Date.now() + 450; if (LIVE.on) liveSet('listen'); } }; if (LIVE.state !== 'speak') liveSet('speak');
}
function liveCut() { LIVE.cut = true; liveHush(); LIVE.quiet = 0; asstMicLog('live: قاطعته'); if (LIVE.on) liveSet('listen'); }   // يتجاهل بقية جوابه حتى نهاية الدور، ويعود الميكروفون فورًا
function liveHush() { LIVE.srcs.forEach(s => { try { s.stop(); } catch (e) {} }); LIVE.srcs = []; LIVE.play = 0; }
/* 🎤 الميكروفون ← PCM 16 كيلوهرتز (base64) */
function liveB64(f32, sr) {
  const r = sr / 16000, m = Math.floor(f32.length / r), u8 = new Uint8Array(m * 2);
  for (let k = 0; k < m; k++) { const v = Math.max(-1, Math.min(1, f32[Math.floor(k * r)])), x = v < 0 ? v * 0x8000 : v * 0x7fff; u8[2 * k] = x & 255; u8[2 * k + 1] = (x >> 8) & 255; }
  let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s);
}

function liveSet(st, extra) {
  LIVE.state = st; const e = document.getElementById('asst-live'), b = document.getElementById('asst-livebtn');
  if (b) b.classList.toggle('on', LIVE.on || st === 'connect');
  if (!e) return; if (!LIVE.on && st !== 'connect') { if (typeof asstLive === 'function') asstLive(); return; }
  const L = { connect: '⏳ أتصل بـ Gemini Live…', listen: '🎙️ <b>محادثة حية</b> — تكلّم، أسمعك', speak: '🔊 <b>محادثة حية</b> — أتكلم… <button type="button" class="btn sm ghost" onclick="liveCut()">✋ قاطعه</button>', tool: '🔎 <b>محادثة حية</b> — أبحث في بياناتك…' };
  e.hidden = false; e.innerHTML = `<span class="dot"></span> ${L[st] || ''}${extra ? ' · ' + extra : ''} <button type="button" class="btn sm ghost" onclick="liveStop()">⏹ إنهاء</button>`;
}
/* نسخ كلام المعلم طلع بحروف لاتينية (Gemini أخطأ لغة النسخ وفهم الصوت نفسه): نوضّح بدل نص مشوّه */
function liveFixMe(m) { if (!m || m.fixed) return; const t = String(m.text || ''); if (!/[\u0600-\u06FF]/.test(t) && /[A-Za-z\u00C0-\u024F]/.test(t)) { m.fixed = 1; m.html = '🎙️ <i>(كلامك ما انكتب بالعربي — Gemini فهمه من الصوت)</i> <small class="asst-latin">' + asstEsc(t) + '</small>'; asstPaint(); } }
function liveMsg(who, t) {   // النص المكتوب للمحادثة (من النسخ الحي) — يبقى في سجل «مساعدي»
  if (!t) return; const k = who === 'me' ? 'me' : 'bot';
  if (!LIVE[k]) { LIVE[k] = who === 'me' ? { me: 1, html: '', text: '' } : { html: '', text: '', src: ['🎙️ محادثة حية · ' + LIVE.model] }; ASST.msgs.push(LIVE[k]); }
  LIVE[k].text += t; LIVE[k].html = (who === 'me' ? '🎙️ ' : '') + asstEsc(LIVE[k].text); asstPaint();
}

async function liveStart() {
  if (LIVE.on || LIVE.state === 'connect') return; if (!liveSup()) { toast('المحادثة الحية تحتاج مفتاح Gemini (⚙️ الإعدادات ← الذكاء الاصطناعي)', 'bad'); return; }
  try { asstMicStop(); asstSpeakStop(); } catch (e) {}
  /* 🍎 iPhone: (1) جلسة الميكروفون العادي (HWV) تبقى ممسكة بالميكروفون في الخلفية (النقطة البرتقالية) فلا يصل المحادثة الحية شيء — نوقفها.
     (2) سياق الصوت نفسه بعد إيقاف ميكروفون الجلسة السابقة يمرّر صمتًا للجلسة التالية — فسياق جديد لكل جلسة (داخل لمستك) ويُغلق في نهايتها */
  try { if (window.HWV && HWV.active) { asstMicLog('live: أوقفت جلسة المايك العادي'); HWV.instance(false).stop(); } } catch (e) {}
  try { if (LIVE.ctx) LIVE.ctx.close().catch(() => {}); } catch (e) {}
  try { LIVE.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (LIVE.ctx.state !== 'running') await LIVE.ctx.resume(); } catch (e) {}
  asstMicLog('live: سياق ' + (LIVE.ctx && LIVE.ctx.state) + ' ' + (LIVE.ctx && LIVE.ctx.sampleRate));
  try { if (!localStorage.getItem('live_note')) { localStorage.setItem('live_note', '1'); toast('🎙️ تجريبية: الصوت يُحسب من رصيد Gemini بسعر أعلى من النص — أنهِ المحادثة بزر ⏹', 'warn'); } } catch (e) {}
  liveSet('connect'); LIVE.tried = []; LIVE.lv = 2; liveConnect(LIVE_MODELS[0]);
}
function liveConnect(model) {
  LIVE.model = model; LIVE.tried.push(model); let ready = false; asstMicLog('live: اتصال ' + model + ' · عربي ' + LIVE.lv);
  const ws = LIVE.ws = new WebSocket('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=' + encodeURIComponent(liveKey()));
  ws.onopen = () => ws.send(JSON.stringify({ setup: { model: 'models/' + model,
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { ...(LIVE.lv >= 1 ? { languageCode: 'ar-XA' } : {}), voiceConfig: { prebuiltVoiceConfig: { voiceName: liveVoice() } } } },
    systemInstruction: { parts: [{ text: liveSystem() }] }, tools: [{ functionDeclarations: liveTools() }], inputAudioTranscription: LIVE.lv >= 2 ? { languageCodes: ['ar'] } : {}, outputAudioTranscription: {} } }));
  ws.onmessage = async ev => { let j; try { j = JSON.parse(typeof ev.data === 'string' ? ev.data : await (ev.data.text ? ev.data.text() : new Response(ev.data).text())); } catch (e) { return; }
    if (j.setupComplete) { ready = true; asstMicLog('live: جاهز'); await liveMic(); return; }
    const sc = j.serverContent;
    if (sc) { if (sc.interrupted) { asstMicLog('live: Gemini قال «قوطعت»'); liveHush(); LIVE.cut = false; LIVE.quiet = Date.now() + 300; }
      if (sc.inputTranscription && sc.inputTranscription.text && !LIVE.me) asstMicLog('live: سمعك «' + String(sc.inputTranscription.text).slice(0, 30) + '»');
      if (((sc.modelTurn || {}).parts || []).some(p => p.inlineData) && !LIVE.lg) { LIVE.lg = 1; asstMicLog('live: بدأ يرد بصوت' + (LIVE.cut ? ' (مقطوع بزر ✋)' : '')); }
      if (sc.inputTranscription && sc.inputTranscription.text) { LIVE.bot = null; liveMsg('me', sc.inputTranscription.text); }
      if ((sc.outputTranscription && sc.outputTranscription.text) || sc.turnComplete) liveFixMe(LIVE.me);
      if (sc.outputTranscription && sc.outputTranscription.text) { LIVE.me = null; liveMsg('bot', sc.outputTranscription.text); }
      if (!LIVE.cut) ((sc.modelTurn || {}).parts || []).forEach(p => { if (p.inlineData && /audio/.test(p.inlineData.mimeType || '')) livePlay(p.inlineData.data); });
      if (sc.turnComplete) { asstMicLog('live: انتهى رده · كُتم الميكروفون ' + (LIVE.muted || 0) + ' مرة'); LIVE.lg = 0; LIVE.muted = 0; LIVE.cut = false; LIVE.me = LIVE.bot = null; try { asstSave(); } catch (e) {} } }
    if (j.toolCall) { asstMicLog('live: أداة ' + (j.toolCall.functionCalls || []).map(c => c.name).join('، ')); liveTool(j.toolCall.functionCalls || []); }
    if (j.error || j.setupError) asstMicLog('live: خطأ ' + JSON.stringify(j.error || j.setupError).slice(0, 80));
    if (j.goAway) liveSet(LIVE.state, 'الجلسة توشك على الانتهاء'); };
  ws.onclose = ev => { asstMicLog('live: أُغلق ' + ev.code + (ev.reason ? ' ' + String(ev.reason).slice(0, 60) : '')); if (LIVE.ws !== ws) return;
    if (!ready) { if (LIVE.lv > 0 && LIVE.state === 'connect') { LIVE.lv--; LIVE.tried.pop(); liveConnect(model); return; }   // لا يقبل إعداد اللغة: نعيد بأقل منه (النسخ ← الصوت ← بلا)
      const next = LIVE_MODELS.find(m => !LIVE.tried.includes(m)); if (next && LIVE.state === 'connect') { LIVE.lv = 2; liveConnect(next); return; }
      liveEnd(); toast('تعذّر الاتصال بـ Gemini Live' + (ev.reason ? ': ' + String(ev.reason).slice(0, 120) : ''), 'bad'); return; }
    liveEnd(); if (ev.code !== 1000) toast('انتهت المحادثة الحية' + (ev.reason ? ': ' + String(ev.reason).slice(0, 120) : ''), 'warn'); };
  ws.onerror = () => {};
}
async function liveMic(again) {
  try { LIVE.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { asstMicLog('live: ميكروفون ' + (e && e.name)); liveStop(); toast(e && e.name === 'NotAllowedError' ? 'اسمح للمتصفح باستخدام الميكروفون' : 'تعذّر تشغيل الميكروفون', 'bad'); return; }
  const C = LIVE.ctx; if (C.state !== 'running') { try { await C.resume(); } catch (e) {} }
  LIVE.src = C.createMediaStreamSource(LIVE.stream); LIVE.node = C.createScriptProcessor(4096, 1, 1); let frames = 0, loud = 0;
  try { LIVE.stream.getAudioTracks()[0].onended = () => asstMicLog('live: انتهى مسار الميكروفون'); } catch (e) {}
  /* 🔇 لا نُرسل الميكروفون وهو يتكلم (ونصف ثانية بعده): مكبّر الجوال يرجع صوته للميكروفون فيحسبه Gemini مقاطعة ويقطع جملته — للمقاطعة زر ✋ */
  LIVE.node.onaudioprocess = e => { if (!LIVE.on || !LIVE.ws || LIVE.ws.readyState !== 1) return; if (LIVE.srcs.length || Date.now() < (LIVE.quiet || 0)) { LIVE.muted = (LIVE.muted || 0) + 1; return; } const d = e.inputBuffer.getChannelData(0);
    if (frames < 60) { frames++; let m = 0; for (let k = 0; k < d.length; k += 8) m = Math.max(m, Math.abs(d[k])); if (m > 1e-4) loud++;
      if (frames === 40) { asstMicLog(`live: صوت ${loud}/40 · سياق ${C.state}`); if (!loud) { liveSilent(again); return; } } }   // ~3 ثوانٍ صمت تام = الميكروفون لا يصل
    if (LIVE.ws) LIVE.ws.send(JSON.stringify({ realtimeInput: { audio: { data: liveB64(d, C.sampleRate), mimeType: 'audio/pcm;rate=16000' } } })); };
  LIVE.src.connect(LIVE.node); LIVE.node.connect(C.destination); LIVE.on = true; LIVE.t0 = Date.now(); liveSet('listen'); asstMicLog('live: يستمع' + (again ? ' (محاولة ثانية)' : ''));
}
async function liveSilent(again) {   // صمت تام: نعيد الميكروفون مرة واحدة بسياق جديد، وإلا نوضّح السبب
  try { LIVE.node.onaudioprocess = null; LIVE.node.disconnect(); LIVE.src.disconnect(); LIVE.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
  if (!again) { try { LIVE.ctx.close().catch(() => {}); LIVE.ctx = new (window.AudioContext || window.webkitAudioContext)(); await LIVE.ctx.resume(); } catch (e) {} asstMicLog('live: صمت تام ← أعيد الميكروفون'); return liveMic(true); }
  liveStop(); toast('الميكروفون ما يوصل صوت — أغلق سفاري وافتحه، أو أغلق أي تطبيق يستخدم الميكروفون', 'bad');
}
async function liveTool(calls) {
  liveSet('tool'); const out = [];
  for (const c of calls) { const t = ASST_TOOLS[c.name]; let res;
    try { const a = c.args && typeof c.args === 'object' ? { ...c.args } : {}; if (!t) res = { error: 'أداة غير معروفة' };
      else { const r = await t.run(a); res = asstStrip(r);
        if (t.act && r && r.action === 'nav') {   // 🧭 فتح صفحة: آمن، يُنفَّذ فورًا والمحادثة مستمرة (اللوحة تُصغَّر وزر «مساعدي» يومض)
          asstMicLog('live: فتح ' + r.page); asstGo(r, true); liveBtnPulse(); res = { opened: r.label + (r.name ? ' — ' + r.name : ''), note: 'فُتحت الصفحة فعلًا أمام المعلم. أخبره بإيجاز أنها انفتحت.' }; }
        else if (t.act && r && ASST_ACTS.includes(r.action)) {   // بطاقة تأكيد على الشاشة — لا تنفيذ إلا بضغطة المعلم
          const card = { ...r, state: 'ask' }; if (card.action === 'draft') card.text = String(a.message || ''); LIVE.me = null;
          ASST.msgs.push({ html: '🎙️ جهّزت لك — راجع واضغط «نفّذ»:', cards: [card], src: [t.src(a), '🎙️ محادثة حية'].filter(Boolean) }); LIVE.bot = null; asstPaint();
          res = { prepared: res, note: 'ظهرت للمعلم بطاقة تأكيد على الشاشة ولم يُنفَّذ شيء بعد. أخبره بإيجاز بما جهّزته واطلب منه يضغط «نفّذ».' }; } } }
    catch (e) { res = { error: 'تعذّر' }; }
    let s = JSON.stringify(res); if (s.length > 9000) s = s.slice(0, 9000); out.push({ id: c.id, name: c.name, response: { result: s } });
    const m = LIVE.bot || null; if (m && t) { m.src = (m.src || []).concat(t.src(c.args || {})).filter(Boolean); } }
  try { LIVE.ws.send(JSON.stringify({ toolResponse: { functionResponses: out } })); } catch (e) {}
  if (LIVE.on) liveSet('listen');
}
function liveEnd() {
  LIVE.on = false; const ws = LIVE.ws; LIVE.ws = null; try { if (ws && ws.readyState < 2) ws.close(1000); } catch (e) {}
  try { LIVE.node && (LIVE.node.onaudioprocess = null, LIVE.node.disconnect()); LIVE.src && LIVE.src.disconnect(); } catch (e) {}
  try { LIVE.stream && LIVE.stream.getTracks().forEach(t => t.stop()); } catch (e) {} LIVE.stream = LIVE.node = LIVE.src = null; liveHush(); LIVE.me = LIVE.bot = null;
  try { if (LIVE.ctx) LIVE.ctx.close().catch(() => {}); } catch (e) {} LIVE.ctx = null;
  LIVE.state = ''; liveSet(''); liveBtnPulse(); try { asstSave(); } catch (e) {}
}
function liveBtnPulse() { const b = document.getElementById('asst-btn'); if (b) b.classList.toggle('live-on', !!(LIVE.on || LIVE.state === 'connect')); }
function liveStop() { liveEnd(); liveBtnPulse(); }
function liveToggle() { if (LIVE.on || LIVE.state === 'connect') liveStop(); else liveStart(); }
