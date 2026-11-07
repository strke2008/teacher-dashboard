/* ═══════════ 🎙️ «محادثة حية» مع مساعدي — GPT Realtime من OpenAI (تجريبية) ═══════════
   بديل Gemini Live بنفس الأدوات وبطاقات التأكيد والنسخ المكتوب (js/49-live.js): المزوّد يُختار من ⚙️ الإعدادات.
   الاتصال WebRTC: المتصفح نفسه يلغي صدى صوت المساعد (فلا يقاطع نفسه على مكبّر الجوال)، والصوت يصل مباشرة بلا تحويل PCM.
   مفتاح OpenAI من إعدادات الذكاء في اللوحة (مثل Gemini) ← نطلب منه مفتاحًا مؤقتًا لهذه الجلسة فقط (client_secrets)،
   والمفتاح المؤقت وحده يستعمل لتبادل الاتصال (calls). الأحداث (الأدوات والنسخ) على قناة البيانات «oai-events». */
const LIVE_OA = 'https://api.openai.com/v1/realtime';

/* تعريفات أدوات «مساعدي» بصيغة OpenAI (JSON Schema بأنواع صغيرة) من تعريفات Gemini نفسها */
function liveOSchema(x) { if (Array.isArray(x)) return x.map(liveOSchema); if (!x || typeof x !== 'object') return x; const o = {};
  Object.entries(x).forEach(([k, v]) => { o[k] = k === 'type' && typeof v === 'string' ? v.toLowerCase() : liveOSchema(v); }); return o; }
function liveOTools() { return liveTools().map(t => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters ? liveOSchema(t.parameters) : { type: 'object', properties: {} } })); }
function liveOSession(tr) {
  return { type: 'realtime', instructions: liveSystem(), tools: liveOTools(), tool_choice: 'auto',
    audio: { input: { ...(tr ? { transcription: tr } : {}), turn_detection: { type: 'semantic_vad' } }, output: { voice: liveVoice() } } };
}
const LIVE_OA_TR = [{ model: 'gpt-4o-mini-transcribe', language: 'ar' }, { model: 'whisper-1', language: 'ar' }, null];   // نسخ كلام المعلم: بالعربية، وإن رُفض نجرّب الأبسط

/* مفتاح مؤقت للجلسة (المفتاح الحقيقي لا يصل الاتصال الصوتي) */
async function liveOToken(model) {
  const r = await fetch(LIVE_OA + '/client_secrets', { method: 'POST', headers: { Authorization: 'Bearer ' + liveKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ session: { type: 'realtime', model, instructions: liveSystem(), audio: { output: { voice: liveVoice() } } } }) });
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (!r.ok) throw Object.assign(new Error((j.error && j.error.message) || ('خطأ ' + r.status)), { status: r.status });
  const k = j.value || (j.client_secret && j.client_secret.value); if (!k) throw new Error('لم يصل مفتاح الجلسة'); return k;
}

async function liveOStart() {
  try { asstMicStop(); asstSpeakStop(); } catch (e) {}
  try { if (window.HWV && HWV.active) { asstMicLog('live: أوقفت جلسة المايك العادي'); HWV.instance(false).stop(); } } catch (e) {}
  /* 🍎 iPhone: عنصر الصوت يُشغَّل داخل لمستك (وإلا يُمنع التشغيل التلقائي لصوت المساعد لاحقًا) */
  const au = LIVE.au = document.createElement('audio'); au.autoplay = true; au.setAttribute('playsinline', ''); au.hidden = true; document.body.appendChild(au); try { au.play().catch(() => {}); } catch (e) {}
  liveSet('connect'); try { if (!localStorage.getItem('live_note_oa')) { localStorage.setItem('live_note_oa', '1'); toast('🎙️ تجريبية: الصوت يُحسب من رصيد OpenAI بسعر أعلى من النص — أنهِ المحادثة بزر ⏹', 'warn'); } } catch (e) {}
  try { LIVE.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { asstMicLog('live: ميكروفون ' + (e && e.name)); liveStop(); toast(e && e.name === 'NotAllowedError' ? 'اسمح للمتصفح باستخدام الميكروفون' : 'تعذّر تشغيل الميكروفون', 'bad'); return; }
  const models = [liveOaModel()].concat(LIVE_OA_MODELS.map(m => m[0]).filter(m => m !== liveOaModel())); let ek = '', err = null;
  for (const m of models) { if (LIVE.state !== 'connect') return; try { asstMicLog('live: مفتاح جلسة ' + m); ek = await liveOToken(m); LIVE.model = m; break; } catch (e) { err = e; asstMicLog('live: رُفض ' + m + ' · ' + String(e.message).slice(0, 60)); if (e.status === 401 || e.status === 429) break; } }
  if (LIVE.state !== 'connect') return;   // أُنهيت أثناء الاتصال
  if (!ek) { liveStop(); toast('تعذّر الاتصال بـ GPT Realtime' + (err ? ': ' + String(err.message).slice(0, 140) : ''), 'bad'); return; }
  try {
    const pc = LIVE.pc = new RTCPeerConnection(); LIVE.oa = { tr: 0, done: true, deltaMe: false };
    pc.ontrack = e => { if (LIVE.au) LIVE.au.srcObject = e.streams[0]; };
    LIVE.stream.getTracks().forEach(t => pc.addTrack(t, LIVE.stream));
    const dc = LIVE.dc = pc.createDataChannel('oai-events');
    dc.onopen = () => { liveOSend({ type: 'session.update', session: liveOSession(LIVE_OA_TR[0]) }); LIVE.on = true; LIVE.t0 = Date.now(); liveSet('listen'); asstMicLog('live: يستمع (' + LIVE.model + ')'); };
    dc.onmessage = ev => { let j; try { j = JSON.parse(ev.data); } catch (e) { return; } liveOEvent(j); };
    pc.onconnectionstatechange = () => { const s = pc.connectionState; if (LIVE.pc !== pc) return; if (s === 'failed' || s === 'closed') { asstMicLog('live: انقطع ' + s); liveStop(); if (s === 'failed') toast('انقطع الاتصال بـ GPT Realtime', 'warn'); } };
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    const r = await fetch(LIVE_OA + '/calls?model=' + encodeURIComponent(LIVE.model), { method: 'POST', body: offer.sdp, headers: { Authorization: 'Bearer ' + ek, 'Content-Type': 'application/sdp' } });
    if (!r.ok) { let m = ''; try { m = ((await r.json()).error || {}).message || ''; } catch (e) {} throw new Error(m || ('خطأ ' + r.status)); }
    if (LIVE.pc !== pc) return; await pc.setRemoteDescription({ type: 'answer', sdp: await r.text() });
  } catch (e) { asstMicLog('live: فشل الاتصال ' + String(e && e.message).slice(0, 80)); liveStop(); toast('تعذّر الاتصال بـ GPT Realtime: ' + String((e && e.message) || '').slice(0, 140), 'bad'); }
}
function liveOSend(o) { try { if (LIVE.dc && LIVE.dc.readyState === 'open') LIVE.dc.send(JSON.stringify(o)); } catch (e) {} }
/* نهاية دور المعلم: الأوامر التي لم يستدعِ لها النموذج أداة تمر بـ«مساعدي» العادي (كما في Gemini) */
function liveOTurnEnd() { liveLocalAct(); LIVE.said = ''; LIVE.navd = false; LIVE.acted = false; LIVE.me = LIVE.bot = null; LIVE.oa.deltaMe = false; try { asstSave(); } catch (e) {} }

async function liveOEvent(e) {
  const t = e.type || '', O = LIVE.oa || (LIVE.oa = {});
  if (t === 'error') { const m = String((e.error && e.error.message) || ''); asstMicLog('live: خطأ ' + m.slice(0, 90));
    if (/transcri/i.test(m) && O.tr < LIVE_OA_TR.length - 1) { O.tr++; liveOSend({ type: 'session.update', session: liveOSession(LIVE_OA_TR[O.tr]) }); } return; }
  if (t === 'input_audio_buffer.speech_started') { if (O.done) { LIVE.said = ''; LIVE.navd = false; LIVE.acted = false; } LIVE.me = LIVE.bot = null; O.deltaMe = false; return; }
  if (t === 'conversation.item.input_audio_transcription.delta' && e.delta) { O.deltaMe = true; LIVE.bot = null; liveMsg('me', e.delta); LIVE.said = (LIVE.said || '') + e.delta; return; }
  if (t === 'conversation.item.input_audio_transcription.completed') { const tx = String(e.transcript || '');
    if (!O.deltaMe && tx) { LIVE.bot = null; liveMsg('me', tx); LIVE.said = tx; } else if (tx) LIVE.said = tx; O.deltaMe = false; asstMicLog('live: سمعك «' + tx.slice(0, 30) + '»');
    liveLocalNav(); liveFixMe(LIVE.me); if (O.done && O.pendingEnd) { O.pendingEnd = false; liveOTurnEnd(); } return; }
  if (t === 'response.created') { O.done = false; return; }
  if ((t === 'response.output_audio_transcript.delta' || t === 'response.audio_transcript.delta') && e.delta) { liveFixMe(LIVE.me); LIVE.me = null; liveMsg('bot', e.delta); return; }
  if (t === 'output_audio_buffer.started') { liveSet('speak'); return; }
  if (t === 'output_audio_buffer.stopped' || t === 'output_audio_buffer.cleared') { if (LIVE.on) liveSet('listen'); return; }
  if (t === 'response.done') { const R = e.response || {}, calls = (R.output || []).filter(o => o && o.type === 'function_call');
    if (R.status === 'failed') { const m = ((R.status_details || {}).error || {}).message || ''; asstMicLog('live: فشل الرد ' + m.slice(0, 80)); if (m) toast('GPT Realtime: ' + m.slice(0, 140), 'warn'); }
    if (calls.length) { asstMicLog('live: أداة ' + calls.map(c => c.name).join('، '));
      const out = await liveRunTools(calls.map(c => { let a = {}; try { a = JSON.parse(c.arguments || '{}') || {}; } catch (x) {} return { id: c.call_id, name: c.name, args: a }; }));
      out.forEach(o => liveOSend({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: o.id, output: o.result } })); liveOSend({ type: 'response.create' }); if (LIVE.on) liveSet('listen'); return; }
    O.done = true; liveLocalNav(); if (LIVE.said) liveOTurnEnd(); else O.pendingEnd = true;   // النسخ قد يصل بعد الرد: ننتظره لنمرّر الأمر
    return; }
}
function liveOCut() { liveOSend({ type: 'response.cancel' }); liveOSend({ type: 'output_audio_buffer.clear' }); asstMicLog('live: قاطعته'); if (LIVE.on) liveSet('listen'); }
function liveOEnd() {
  const pc = LIVE.pc, dc = LIVE.dc; LIVE.pc = LIVE.dc = null;
  try { dc && dc.close(); } catch (e) {} try { pc && pc.getSenders().forEach(s => { try { s.track && s.track.stop(); } catch (x) {} }); pc && pc.close(); } catch (e) {}
  try { if (LIVE.au) { LIVE.au.srcObject = null; LIVE.au.remove(); } } catch (e) {} LIVE.au = null; LIVE.oa = null;
}
