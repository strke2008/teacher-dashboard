/* ═══════════ 🎙️ «محادثة حية» مع مساعدي — Gemini Live (نسخة تجريبية: قراءة فقط) ═══════════
   صوت ↔ صوت مباشرة عبر WebSocket: الميكروفون بـ getUserMedia (لا التعرّف المدمج في سفاري — فلا تجمّد على iPhone)،
   والرد صوت من Gemini نفسه، ويسمع ويتكلم في الوقت نفسه (كتم الصدى من المتصفح).
   الأدوات: أدوات القراءة نفسها في «مساعدي» (الغياب، الدرجات، المهارات، الاختبارات…) تُحسب في جهازك، ويُرسل للمزوّد ما يلزم فقط
   بلا معرّفات (asstStrip). لا تنفيذ في هذه النسخة: أوامر الرصد والرسائل تبقى في «مساعدي» المكتوب ببطاقة التأكيد.
   مقفولة افتراضيًا: زر 🎙️ يظهر في رأس «مساعدي» فقط إن وُجد مفتاح Gemini. */
const LIVE = { lang: true, lv: 2, ws: null, ctx: null, stream: null, src: null, node: null, on: false, state: '', play: 0, srcs: [], me: null, bot: null, model: '', tried: [], t0: 0 };
const LIVE_MODELS = ['gemini-3.8-live', 'gemini-3.1-flash-live-preview'];
/* 🔀 المزوّد: Gemini Live (WebSocket) أو GPT Realtime من OpenAI (WebRTC — js/53-live-openai.js)، بمفتاح الإعدادات نفسه */
const liveProv = () => { try { return localStorage.getItem('live_prov') === 'openai' ? 'openai' : 'gemini'; } catch (e) { return 'gemini'; } };
const liveKey = () => { try { return typeof readingAIGetKey === 'function' ? readingAIGetKey(liveProv()) : ''; } catch (e) { return ''; } };
const LIVE_OA_MODELS = [['gpt-realtime-2.1', 'GPT Realtime 2.1 — الأقوى'], ['gpt-realtime-2.1-mini', 'GPT Realtime 2.1 mini — أرخص وأسرع'], ['gpt-realtime', 'GPT Realtime — الإصدار الأول']];
const LIVE_OA_VOICES = [['cedar', 'رجل — طبيعي ودافئ'], ['ash', 'رجل — واضح'], ['echo', 'رجل — هادئ'], ['ballad', 'رجل — ناعم'], ['verse', 'رجل — معبّر'], ['marin', 'امرأة — طبيعية'], ['coral', 'امرأة — دافئة'], ['sage', 'امرأة — هادئة'], ['shimmer', 'امرأة — مشرقة'], ['alloy', 'محايد']];
const LIVE_GM_MODELS = [['gemini-3.8-live', 'Gemini 3.8 Live — الأحدث'], ['gemini-3.1-flash-live-preview', 'Gemini 3.1 Flash Live — أسرع']];
const liveGmModel = () => { try { const m = localStorage.getItem('live_model_gm'); return LIVE_MODELS.includes(m) ? m : LIVE_MODELS[0]; } catch (e) { return LIVE_MODELS[0]; } };
const liveOaModel = () => { try { return localStorage.getItem('live_model_oa') || LIVE_OA_MODELS[0][0]; } catch (e) { return LIVE_OA_MODELS[0][0]; } };
/* 🗣️ أصوات Gemini الجاهزة — الافتراضي صوت رجل */
const LIVE_VOICES = [['Charon', 'رجل — هادئ وواضح'], ['Orus', 'رجل — حازم'], ['Iapetus', 'رجل — صافٍ'], ['Algieba', 'رجل — ناعم'], ['Puck', 'رجل — حيوي'], ['Fenrir', 'رجل — متحمس'], ['Kore', 'امرأة — واثقة'], ['Aoede', 'امرأة — خفيفة'], ['Leda', 'امرأة — شابة'], ['Zephyr', 'امرأة — مشرقة']];
const liveVoices = () => liveProv() === 'openai' ? LIVE_OA_VOICES : LIVE_VOICES;
const liveVoice = () => { const oa = liveProv() === 'openai'; try { return localStorage.getItem(oa ? 'live_voice_oa' : 'live_voice') || (oa ? 'cedar' : 'Charon'); } catch (e) { return oa ? 'cedar' : 'Charon'; } };
function liveVoiceSet(v) { try { localStorage.setItem(liveProv() === 'openai' ? 'live_voice_oa' : 'live_voice', v); } catch (e) {} toast('🎙️ الصوت: ' + ((liveVoices().find(x => x[0] === v) || [])[1] || v) + (LIVE.on ? ' — يتغيّر من المحادثة الجاية' : ''), 'good'); }
function liveProvSet(v) { if (LIVE.on || LIVE.state) liveStop(); try { localStorage.setItem('live_prov', v === 'openai' ? 'openai' : 'gemini'); } catch (e) {} liveSettingsPaint(); const p = document.getElementById('asst-panel'); if (p) p.remove();
  toast('🎙️ المحادثة الحية: ' + (liveProv() === 'openai' ? 'GPT Realtime — يحتاج مفتاح OpenAI' : 'Gemini Live — يحتاج مفتاح Gemini'), 'good'); }
function liveModelSet(v) { try { localStorage.setItem(liveProv() === 'openai' ? 'live_model_oa' : 'live_model_gm', v); } catch (e) {} toast('🎙️ النموذج: ' + v + (LIVE.on ? ' — من المحادثة الجاية' : ''), 'good'); }
function liveSettingsPaint() {
  const c = document.getElementById('live-on-tg'); if (c) c.checked = liveOn(); const oa = liveProv() === 'openai';
  const pr = document.getElementById('live-prov'); if (pr) pr.value = liveProv();
  const v = document.getElementById('live-voice'); if (v) { v.innerHTML = liveVoices().map(([k, l]) => `<option value="${k}">${l} (${k})</option>`).join(''); v.value = liveVoice(); }
  const m = document.getElementById('live-model'); if (m) { m.innerHTML = (oa ? LIVE_OA_MODELS : LIVE_GM_MODELS).map(([k, l]) => `<option value="${k}">${l}</option>`).join(''); m.value = oa ? liveOaModel() : liveGmModel(); }   // النماذج تتبع المزوّد المختار
}
/* مقفولة افتراضيًا: تُفعَّل من ⚙️ الإعدادات ← الذكاء الاصطناعي ← «🎙️ المحادثة الحية» */
const liveOn = () => { try { return localStorage.getItem('live_on') === '1'; } catch (e) { return false; } };
function liveOnSet(on) { try { if (on) localStorage.setItem('live_on', '1'); else localStorage.removeItem('live_on'); } catch (e) {} if (!on && (LIVE.on || LIVE.state)) liveStop();
  const p = document.getElementById('asst-panel'); if (p) p.remove();   // يُبنى رأس «مساعدي» من جديد عند فتحه بالزر الصحيح
  try { toast(on ? '🎙️ فُعّلت المحادثة الحية — زرها في رأس «مساعدي»' : '🎙️ أُقفلت المحادثة الحية', 'good'); } catch (e) {} }
(function liveOnInit() { const go = () => liveSettingsPaint(); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go(); })();
const liveSup = () => !!(liveOn() && liveKey() && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (liveProv() === 'openai' ? window.RTCPeerConnection : window.WebSocket && (window.AudioContext || window.webkitAudioContext)));

/* أدوات القراءة فقط ← تعريفات دوال لـ Gemini (الوسائط تُستخرج من وصف كل أداة «args: {…}») */
const LIVE_NUM = ['n', 'days', 'question', 'sem', 'per', 'min', 'delta', 'max'], LIVE_BOOL = ['all', 'print', 'close'], LIVE_ARR = ['classes', 'students', 'except'];
function liveTools() {
  return [{ name: 'confirm_card', description: 'تنفيذ آخر بطاقة تأكيد معروضة على الشاشة — استدعها فقط إذا قال المعلم الآن صراحة «نفّذ» أو «أكّد». الرسائل للطلاب والردود والمحاولات الإضافية لا تُنفَّذ بالصوت (تحتاج لمسة).', behavior: 'BLOCKING' }].concat(Object.entries(ASST_TOOLS).map(([name, t]) => {
    const d = String(t.d || ''), m = d.match(/args:\s*\{([\s\S]*)\}/), props = {};
    (m ? m[1] : '').replace(/\b([a-z_]+)\??:/g, (_, a) => { if (props[a]) return '';
      props[a] = LIVE_NUM.includes(a) ? { type: 'NUMBER' } : LIVE_BOOL.includes(a) ? { type: 'BOOLEAN' } : LIVE_ARR.includes(a) ? { type: 'ARRAY', items: { type: 'STRING' } }
        : a === 'scores' ? { type: 'ARRAY', items: { type: 'OBJECT', properties: { student: { type: 'STRING' }, score: { type: 'STRING' } } } } : { type: 'STRING' }; return ''; });
    if (props.scores) { delete props.student; delete props.score; }
    return { name, description: ((t.act ? '(تجهيز فقط: يظهر للمعلم بطاقة تأكيد ولا يُنفَّذ إلا بضغطته) ' : '') + d).slice(0, 900), behavior: 'BLOCKING', ...(Object.keys(props).length ? { parameters: { type: 'OBJECT', properties: props } } : {}) };
  }));
}
function liveSystem() {
  return `🗣️ اللغة: تكلّم بالعربية دائمًا (لهجة خليجية مهذبة أو فصحى مبسطة) مهما كانت لغة ما تسمعه أو ما يظهر في النسخ — لا تردّ أبدًا بالإسبانية أو الإنجليزية أو غيرها.
المعلم يتكلم بالعربية فقط: إن سمعت كلامًا غير واضح أو كلمات بلغة أخرى فهي غالبًا ضجيج أو خطأ سماع — قل باختصار «ما سمعتك زين، عيدها؟» بالعربية ولا تجب عنها.
${asstIntro()}
أنت في «محادثة حية» صوتية مع المعلم: أجب بالعربية بصوت طبيعي ودود وبإيجاز (جملتان أو ثلاث)، واذكر الأرقام والأسماء بوضوح.
استخدم الأدوات للأسئلة عن طلابه وبياناته، ولا تخترع أسماء أو أرقامًا. «النقاط» = رصيد نقاط المكافآت (أداة points)، وهي غير الدرجات.
تقدر تجهّز كل أوامر «مساعدي» (رصد، درجات، نقاط، رسائل، تذكيرات، فتح صفحات…) بأدوات التجهيز: كل أمر يظهر للمعلم ببطاقة على الشاشة ولا يُنفَّذ إلا إذا ضغط «نفّذ» بنفسه — فقل له بإيجاز ماذا جهّزت واطلب منه يراجع البطاقة ويضغط. لا تقل أبدًا إنك نفّذت إلا بعد confirm_card ناجحة. ولا تقل «جهّزت» إلا بعد أن تستدعي أداة التجهيز فعلًا وتصلك نتيجتها — إن لم تستدعها فلم يظهر شيء.
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
function liveCut() { if (LIVE.pc && typeof liveOCut === 'function') return liveOCut(); LIVE.cut = true; liveHush(); LIVE.quiet = 0; asstMicLog('live: قاطعته'); if (LIVE.on) liveSet('listen'); }   // يتجاهل بقية جوابه حتى نهاية الدور، ويعود الميكروفون فورًا
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
  const L = { connect: '⏳ أتصل بـ ' + (liveProv() === 'openai' ? 'GPT Realtime' : 'Gemini Live') + '…', listen: '🎙️ <b>محادثة حية</b> — تكلّم، أسمعك', speak: '🔊 <b>محادثة حية</b> — أتكلم… <button type="button" class="btn sm ghost" onclick="liveCut()">✋ قاطعه</button>', tool: '🔎 <b>محادثة حية</b> — أبحث في بياناتك…' };
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
  if (LIVE.on || LIVE.state === 'connect') return; if (!liveSup()) { toast('المحادثة الحية تحتاج مفتاح ' + (liveProv() === 'openai' ? 'OpenAI' : 'Gemini') + ' (⚙️ الإعدادات ← الذكاء الاصطناعي)', 'bad'); return; }
  if (liveProv() === 'openai') return liveOStart();
  try { asstMicStop(); asstSpeakStop(); } catch (e) {}
  /* 🍎 iPhone: (1) جلسة الميكروفون العادي (HWV) تبقى ممسكة بالميكروفون في الخلفية (النقطة البرتقالية) فلا يصل المحادثة الحية شيء — نوقفها.
     (2) سياق الصوت نفسه بعد إيقاف ميكروفون الجلسة السابقة يمرّر صمتًا للجلسة التالية — فسياق جديد لكل جلسة (داخل لمستك) ويُغلق في نهايتها */
  try { if (window.HWV && HWV.active) { asstMicLog('live: أوقفت جلسة المايك العادي'); HWV.instance(false).stop(); } } catch (e) {}
  try { if (LIVE.ctx) LIVE.ctx.close().catch(() => {}); } catch (e) {}
  try { LIVE.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (LIVE.ctx.state !== 'running') await LIVE.ctx.resume(); } catch (e) {}
  asstMicLog('live: سياق ' + (LIVE.ctx && LIVE.ctx.state) + ' ' + (LIVE.ctx && LIVE.ctx.sampleRate));
  try { if (!localStorage.getItem('live_note')) { localStorage.setItem('live_note', '1'); toast('🎙️ تجريبية: الصوت يُحسب من رصيد Gemini بسعر أعلى من النص — أنهِ المحادثة بزر ⏹', 'warn'); } } catch (e) {}
  liveSet('connect'); LIVE.tried = []; LIVE.lv = 2; liveConnect(liveGmModel());   // النموذج المختار أولًا، والآخر بديل إن رُفض
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
      if (sc.inputTranscription && sc.inputTranscription.text) { if (!LIVE.me) { LIVE.said = ''; LIVE.navd = false; LIVE.acted = false; } LIVE.bot = null; liveMsg('me', sc.inputTranscription.text); LIVE.said = (LIVE.said || '') + sc.inputTranscription.text; }
      if ((sc.outputTranscription && sc.outputTranscription.text) || sc.turnComplete) liveLocalNav();
      if ((sc.outputTranscription && sc.outputTranscription.text) || sc.turnComplete) liveFixMe(LIVE.me);
      if (sc.outputTranscription && sc.outputTranscription.text) { LIVE.me = null; liveMsg('bot', sc.outputTranscription.text); }
      if (!LIVE.cut) ((sc.modelTurn || {}).parts || []).forEach(p => { if (p.inlineData && /audio/.test(p.inlineData.mimeType || '')) livePlay(p.inlineData.data); });
      if (sc.turnComplete) { liveLocalAct(); LIVE.said = ''; LIVE.navd = false; LIVE.acted = false; asstMicLog('live: انتهى رده · كُتم الميكروفون ' + (LIVE.muted || 0) + ' مرة'); LIVE.lg = 0; LIVE.muted = 0; LIVE.cut = false; LIVE.me = LIVE.bot = null; try { asstSave(); } catch (e) {} } }
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
/* تشغيل أدوات المحادثة الحية (مشترك بين Gemini وGPT): calls = [{id, name, args}] ← [{id, name, result:نص}] */
async function liveRunTools(calls) {
  liveSet('tool'); const out = [];
  for (const c of calls) { const t = ASST_TOOLS[c.name]; let res;
    if (c.name === 'confirm_card') { out.push({ id: c.id, name: c.name, result: JSON.stringify(liveConfirm()) }); continue; }
    try { const a = c.args && typeof c.args === 'object' ? { ...c.args } : {}; if (!t) res = { error: 'أداة غير معروفة' };
      else { const r = await t.run(a); res = asstStrip(r);
        if (t.act && r && r.action === 'nav') {   // 🧭 فتح صفحة: آمن، يُنفَّذ فورًا والمحادثة مستمرة (اللوحة تُصغَّر وزر «مساعدي» يومض)
          asstMicLog('live: فتح ' + r.page); if (!LIVE.navd) asstGo(r, true); LIVE.navd = true; liveBtnPulse(); res = { opened: r.label + (r.name ? ' — ' + r.name : ''), note: 'فُتحت الصفحة فعلًا أمام المعلم. أخبره بإيجاز أنها انفتحت.' }; }
        else if (t.act && r && ASST_ACTS.includes(r.action)) {   // بطاقة تأكيد على الشاشة — لا تنفيذ إلا بضغطة المعلم
          LIVE.acted = true; const card = { ...r, state: 'ask' }; if (card.action === 'draft') card.text = String(a.message || ''); LIVE.me = null;
          ASST.msgs.push({ html: '🎙️ جهّزت لك — راجع واضغط «نفّذ»:', cards: [card], src: [t.src(a), '🎙️ محادثة حية'].filter(Boolean) }); LIVE.bot = null; asstPaint();
          res = { prepared: res, note: 'ظهرت للمعلم بطاقة تأكيد على الشاشة ولم يُنفَّذ شيء بعد. أخبره بإيجاز بما جهّزته واطلب منه يضغط «نفّذ».' }; } } }
    catch (e) { res = { error: 'تعذّر' }; }
    let s = JSON.stringify(res); if (s.length > 9000) s = s.slice(0, 9000); out.push({ id: c.id, name: c.name, result: s });
    const m = LIVE.bot || null; if (m && t) { m.src = (m.src || []).concat(t.src(c.args || {})).filter(Boolean); } }
  return out;
}
async function liveTool(calls) {
  const out = await liveRunTools(calls);
  try { LIVE.ws.send(JSON.stringify({ toolResponse: { functionResponses: out.map(o => ({ id: o.id, name: o.name, response: { result: o.result } })) } })); } catch (e) {}
  if (LIVE.on) liveSet('listen');
}
function liveEnd() {
  if ((LIVE.pc || LIVE.au) && typeof liveOEnd === 'function') liveOEnd();   // GPT Realtime: WebRTC
  LIVE.on = false; const ws = LIVE.ws; LIVE.ws = null; try { if (ws && ws.readyState < 2) ws.close(1000); } catch (e) {}
  try { LIVE.node && (LIVE.node.onaudioprocess = null, LIVE.node.disconnect()); LIVE.src && LIVE.src.disconnect(); } catch (e) {}
  try { LIVE.stream && LIVE.stream.getTracks().forEach(t => t.stop()); } catch (e) {} LIVE.stream = LIVE.node = LIVE.src = null; liveHush(); LIVE.me = LIVE.bot = null;
  try { if (LIVE.ctx) LIVE.ctx.close().catch(() => {}); } catch (e) {} LIVE.ctx = null;
  LIVE.state = ''; liveSet(''); liveBtnPulse(); try { asstSave(); } catch (e) {}
}
/* 🧭 «افتح …» بكلامك يُفتح محليًا فورًا (نفس مطابقة الكتابة والمايك) — لا نعتمد على أن يستدعي Gemini الأداة (قد يقول «فتحتها» بلا استدعاء) */
/* 🛟 أمر بكلامك (سجّل/ارصد/زد/أرسل/ذكّرني…) ولم يستدعِ Gemini أداة التجهيز: نمرّر الجملة نفسها لمسار «مساعدي» العادي (المزوّد المعتاد) فتظهر بطاقة التأكيد */
/* ✅ «نفّذ» بالصوت: آخر بطاقة معروضة تُنفَّذ — بشرط أن يقولها المعلم في جملته الآن، وليست من النوع الذي لا رجعة فيه */
const LIVE_YES = /(^|\s)(نفذ|نفّذ|نفذها|نفّذها|أكد|أكّد|اكد|أكدها|اعتمد|اعتمدها)(\s|$|[.!،])/;
const LIVE_NOVOICE = ['msg', 'reply', 'retry', 'draft', 'drafts', 'activity', 'remind'];
function liveConfirm() {
  if (!LIVE_YES.test(String(LIVE.said || ''))) return { error: 'لا يُنفَّذ إلا إذا قال المعلم «نفّذ» بنفسه' };
  for (let i = ASST.msgs.length - 1; i >= 0; i--) { const cs = ASST.msgs[i].cards || []; for (let j = cs.length - 1; j >= 0; j--) { const c = cs[j]; if (c.state !== 'ask') continue;
    if (LIVE_NOVOICE.includes(c.action)) return { error: 'هذه البطاقة (' + c.action + ') لا تُنفَّذ بالصوت — اطلب من المعلم يضغط «نفّذ» بنفسه' };
    asstMicLog('live: نفّذ بالصوت ' + c.action); LIVE.acted = true; asstAct(i, j, 'do'); return { done: c.action, note: 'نُفّذت البطاقة. أخبره بإيجاز، وأن زر «تراجع» متاح على البطاقة.' }; } }
  return { error: 'لا توجد بطاقة تنتظر التأكيد' };
}
const LIVE_CMD = /^\s*(?:لو سمحت\s+|ممكن\s+|يا مساعد\s+)?(?:سجل|سجّل|ارصد|إرصد|رصد|زيد|زد|زود|زوّد|اعط|أعط|اعطي|أعطي|اخصم|خصم|انقص|أرسل|ارسل|راسل|ذكرني|ذكّرني|ذكر|ذكّر|اصدر|أصدر|طلع شهادة|مدد|مدّد|مد|انسخ|سوّ|سو|سوي|سوّي|اكتب|جهز|جهّز|أضف|اضف|ضيف|غيّر|غير|رد على|ردّ على|علّم|علم|امنح|اعتمد)(?:\s|$)/;
function liveLocalAct() {
  const t = String(LIVE.said || '').trim(); if (!t || LIVE.acted || LIVE.navd || !LIVE.on) return;
  if (/^\s*(?:تمام\s+|طيب\s+|إيه\s+|ايه\s+)?(نفذ|نفّذ|نفذها|نفّذها|أكد|أكّد|اكد|اعتمد)/.test(t)) { LIVE.acted = true; const r = liveConfirm(); asstMicLog('live: نفّذ محلي ' + (r.done || r.error)); if (r.error) toast(r.error, 'warn'); return; }
  if (!LIVE_CMD.test(t)) return;
  LIVE.acted = true; asstMicLog('live: أمر بلا أداة ← مساعدي العادي'); try { asstAsk(t, { live: true }); } catch (e) {}
}
async function liveLocalNav() {
  const t = String(LIVE.said || '').trim(); if (!t || LIVE.navd || !LIVE.on) return; const f = typeof asstFast === 'function' ? asstFast(t) : null;
  if (!f || f.tool !== 'open_page') return; LIVE.navd = true; const r = await ASST_TOOLS.open_page.run(f.args); if (r.error) { asstMicLog('live: افتح — ' + r.error); return; }
  asstMicLog('live: فتح محلي ' + r.page); asstGo(r, true); liveBtnPulse();
}
function liveBtnPulse() { const b = document.getElementById('asst-btn'); if (b) b.classList.toggle('live-on', !!(LIVE.on || LIVE.state === 'connect')); }
function liveStop() { liveEnd(); liveBtnPulse(); }
function liveToggle() { if (LIVE.on || LIVE.state === 'connect') liveStop(); else liveStart(); }
