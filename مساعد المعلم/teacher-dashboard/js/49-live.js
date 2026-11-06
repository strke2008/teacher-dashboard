/* ═══════════ 🎙️ «محادثة حية» مع مساعدي — Gemini Live (نسخة تجريبية: قراءة فقط) ═══════════
   صوت ↔ صوت مباشرة عبر WebSocket: الميكروفون بـ getUserMedia (لا التعرّف المدمج في سفاري — فلا تجمّد على iPhone)،
   والرد صوت من Gemini نفسه، ويسمع ويتكلم في الوقت نفسه (كتم الصدى من المتصفح).
   الأدوات: أدوات القراءة نفسها في «مساعدي» (الغياب، الدرجات، المهارات، الاختبارات…) تُحسب في جهازك، ويُرسل للمزوّد ما يلزم فقط
   بلا معرّفات (asstStrip). لا تنفيذ في هذه النسخة: أوامر الرصد والرسائل تبقى في «مساعدي» المكتوب ببطاقة التأكيد.
   مقفولة افتراضيًا: زر 🎙️ يظهر في رأس «مساعدي» فقط إن وُجد مفتاح Gemini. */
const LIVE = { ws: null, ctx: null, stream: null, src: null, node: null, on: false, state: '', play: 0, srcs: [], me: null, bot: null, model: '', tried: [], t0: 0 };
const LIVE_MODELS = ['gemini-3.8-live', 'gemini-3.1-flash-live-preview'];
const liveKey = () => { try { return typeof readingAIGetKey === 'function' ? readingAIGetKey('gemini') : ''; } catch (e) { return ''; } };
const liveSup = () => !!(liveKey() && window.WebSocket && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext));

/* أدوات القراءة فقط ← تعريفات دوال لـ Gemini (الوسائط تُستخرج من وصف كل أداة «args: {…}») */
const LIVE_NUM = ['n', 'days', 'question', 'sem', 'per', 'min'], LIVE_BOOL = ['all', 'print'];
function liveTools() {
  return Object.entries(ASST_TOOLS).filter(([k, t]) => !t.act).map(([name, t]) => {
    const d = String(t.d || ''), m = d.match(/args:\s*\{([^}]*)\}/), props = {};
    (m ? m[1] : '').replace(/\b([a-z_]+)\??:/g, (_, a) => { props[a] = LIVE_NUM.includes(a) ? { type: 'NUMBER' } : LIVE_BOOL.includes(a) ? { type: 'BOOLEAN' } : a === 'classes' ? { type: 'ARRAY', items: { type: 'STRING' } } : { type: 'STRING' }; return ''; });
    return { name, description: d.slice(0, 900), behavior: 'BLOCKING', ...(Object.keys(props).length ? { parameters: { type: 'OBJECT', properties: props } } : {}) };
  });
}
function liveSystem() {
  return `${asstIntro()}
أنت في «محادثة حية» صوتية مع المعلم: أجب بالعربية بصوت طبيعي ودود وبإيجاز (جملتان أو ثلاث)، واذكر الأرقام والأسماء بوضوح.
استخدم الأدوات للأسئلة عن طلابه وبياناته، ولا تخترع أسماء أو أرقامًا. «النقاط» = رصيد نقاط المكافآت (أداة points)، وهي غير الدرجات.
هذه نسخة تجريبية للقراءة فقط: إن طلب رصدًا أو تعديلًا أو إرسال رسالة فقل له إن التنفيذ متاح الآن بالكتابة أو المايك في «مساعدي» ببطاقة تأكيد، وسيضاف للمحادثة الحية لاحقًا.`;
}

/* 🔊 تشغيل PCM 24 كيلوهرتز بالتتابع */
function livePlay(b64) {
  const C = LIVE.ctx; if (!C) return; const bin = atob(b64), n = bin.length >> 1, f = new Float32Array(n);
  for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v >= 32768) v -= 65536; f[i] = v / 32768; }
  const buf = C.createBuffer(1, n, 24000); buf.copyToChannel ? buf.copyToChannel(f, 0) : buf.getChannelData(0).set(f);
  const s = C.createBufferSource(); s.buffer = buf; s.connect(C.destination); const at = Math.max(C.currentTime + 0.03, LIVE.play); s.start(at); LIVE.play = at + buf.duration;
  LIVE.srcs.push(s); s.onended = () => { LIVE.srcs = LIVE.srcs.filter(x => x !== s); if (!LIVE.srcs.length && LIVE.on) liveSet('listen'); }; liveSet('speak');
}
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
  const L = { connect: '⏳ أتصل بـ Gemini Live…', listen: '🎙️ <b>محادثة حية</b> — تكلّم، أسمعك', speak: '🔊 <b>محادثة حية</b> — أتكلم… (قاطعني متى شئت)', tool: '🔎 <b>محادثة حية</b> — أبحث في بياناتك…' };
  e.hidden = false; e.innerHTML = `<span class="dot"></span> ${L[st] || ''}${extra ? ' · ' + extra : ''} <button type="button" class="btn sm ghost" onclick="liveStop()">⏹ إنهاء</button>`;
}
function liveMsg(who, t) {   // النص المكتوب للمحادثة (من النسخ الحي) — يبقى في سجل «مساعدي»
  if (!t) return; const k = who === 'me' ? 'me' : 'bot';
  if (!LIVE[k]) { LIVE[k] = who === 'me' ? { me: 1, html: '', text: '' } : { html: '', text: '', src: ['🎙️ محادثة حية · ' + LIVE.model] }; ASST.msgs.push(LIVE[k]); }
  LIVE[k].text += t; LIVE[k].html = (who === 'me' ? '🎙️ ' : '') + asstEsc(LIVE[k].text); asstPaint();
}

async function liveStart() {
  if (LIVE.on || LIVE.state === 'connect') return; if (!liveSup()) { toast('المحادثة الحية تحتاج مفتاح Gemini (⚙️ الإعدادات ← الذكاء الاصطناعي)', 'bad'); return; }
  try { asstMicStop(); asstSpeakStop(); } catch (e) {}
  try { LIVE.ctx = LIVE.ctx || new (window.AudioContext || window.webkitAudioContext)(); if (LIVE.ctx.state === 'suspended') await LIVE.ctx.resume(); } catch (e) {}
  try { if (!localStorage.getItem('live_note')) { localStorage.setItem('live_note', '1'); toast('🎙️ تجريبية: الصوت يُحسب من رصيد Gemini بسعر أعلى من النص — أنهِ المحادثة بزر ⏹', 'warn'); } } catch (e) {}
  liveSet('connect'); LIVE.tried = []; liveConnect(LIVE_MODELS[0]);
}
function liveConnect(model) {
  LIVE.model = model; LIVE.tried.push(model); let ready = false;
  const ws = LIVE.ws = new WebSocket('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=' + encodeURIComponent(liveKey()));
  ws.onopen = () => ws.send(JSON.stringify({ setup: { model: 'models/' + model,
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: localStorage.getItem('live_voice') || 'Kore' } } } },
    systemInstruction: { parts: [{ text: liveSystem() }] }, tools: [{ functionDeclarations: liveTools() }], inputAudioTranscription: {}, outputAudioTranscription: {} } }));
  ws.onmessage = async ev => { let j; try { j = JSON.parse(typeof ev.data === 'string' ? ev.data : await (ev.data.text ? ev.data.text() : new Response(ev.data).text())); } catch (e) { return; }
    if (j.setupComplete) { ready = true; await liveMic(); return; }
    const sc = j.serverContent;
    if (sc) { if (sc.interrupted) liveHush();
      if (sc.inputTranscription && sc.inputTranscription.text) { LIVE.bot = null; liveMsg('me', sc.inputTranscription.text); }
      if (sc.outputTranscription && sc.outputTranscription.text) { LIVE.me = null; liveMsg('bot', sc.outputTranscription.text); }
      ((sc.modelTurn || {}).parts || []).forEach(p => { if (p.inlineData && /audio/.test(p.inlineData.mimeType || '')) livePlay(p.inlineData.data); });
      if (sc.turnComplete) { LIVE.me = LIVE.bot = null; try { asstSave(); } catch (e) {} } }
    if (j.toolCall) liveTool(j.toolCall.functionCalls || []);
    if (j.goAway) liveSet(LIVE.state, 'الجلسة توشك على الانتهاء'); };
  ws.onclose = ev => { if (LIVE.ws !== ws) return;
    if (!ready) { const next = LIVE_MODELS.find(m => !LIVE.tried.includes(m)); if (next && LIVE.state === 'connect') { liveConnect(next); return; }
      liveEnd(); toast('تعذّر الاتصال بـ Gemini Live' + (ev.reason ? ': ' + String(ev.reason).slice(0, 120) : ''), 'bad'); return; }
    liveEnd(); if (ev.code !== 1000) toast('انتهت المحادثة الحية' + (ev.reason ? ': ' + String(ev.reason).slice(0, 120) : ''), 'warn'); };
  ws.onerror = () => {};
}
async function liveMic() {
  try { LIVE.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { liveStop(); toast(e && e.name === 'NotAllowedError' ? 'اسمح للمتصفح باستخدام الميكروفون' : 'تعذّر تشغيل الميكروفون', 'bad'); return; }
  const C = LIVE.ctx; LIVE.src = C.createMediaStreamSource(LIVE.stream); LIVE.node = C.createScriptProcessor(4096, 1, 1);
  LIVE.node.onaudioprocess = e => { if (!LIVE.on || !LIVE.ws || LIVE.ws.readyState !== 1) return;
    LIVE.ws.send(JSON.stringify({ realtimeInput: { audio: { data: liveB64(e.inputBuffer.getChannelData(0), C.sampleRate), mimeType: 'audio/pcm;rate=16000' } } })); };
  LIVE.src.connect(LIVE.node); LIVE.node.connect(C.destination); LIVE.on = true; LIVE.t0 = Date.now(); liveSet('listen');
}
async function liveTool(calls) {
  liveSet('tool'); const out = [];
  for (const c of calls) { const t = ASST_TOOLS[c.name]; let res;
    try { res = !t || t.act ? { error: 'هذه الأداة غير متاحة في المحادثة الحية' } : asstStrip(await t.run(c.args && typeof c.args === 'object' ? { ...c.args } : {})); } catch (e) { res = { error: 'تعذّر' }; }
    let s = JSON.stringify(res); if (s.length > 9000) s = s.slice(0, 9000); out.push({ id: c.id, name: c.name, response: { result: s } });
    const m = LIVE.bot || null; if (m && t) { m.src = (m.src || []).concat(t.src(c.args || {})).filter(Boolean); } }
  try { LIVE.ws.send(JSON.stringify({ toolResponse: { functionResponses: out } })); } catch (e) {}
  if (LIVE.on) liveSet('listen');
}
function liveEnd() {
  LIVE.on = false; const ws = LIVE.ws; LIVE.ws = null; try { if (ws && ws.readyState < 2) ws.close(1000); } catch (e) {}
  try { LIVE.node && (LIVE.node.onaudioprocess = null, LIVE.node.disconnect()); LIVE.src && LIVE.src.disconnect(); } catch (e) {}
  try { LIVE.stream && LIVE.stream.getTracks().forEach(t => t.stop()); } catch (e) {} LIVE.stream = LIVE.node = LIVE.src = null; liveHush(); LIVE.me = LIVE.bot = null;
  LIVE.state = ''; liveSet(''); try { asstSave(); } catch (e) {}
}
function liveStop() { liveEnd(); }
function liveToggle() { if (LIVE.on || LIVE.state === 'connect') liveStop(); else liveStart(); }
