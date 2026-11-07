/* 🧪 اختبارات الصفحات في متصفح حقيقي، متصلة بالخادم الحقيقي (worker.js) محليًا */
import { createRequire } from 'node:module';
import { loadWorker, newEnv, caller, serveWorker, serveStatic, suite, eq, ok, TOKEN } from './harness.mjs';
const require = createRequire(import.meta.url);

export default async function run() {
  const S = suite('الصفحات');
  let chromium; try { ({ chromium } = require('playwright')); } catch { S.res.push([false, 'Playwright غير مثبت — تُخطّى اختبارات الصفحات']); return S; }
  const W = await loadWorker(), env = newEnv(), call = caller(W, env);
  await call('/publish', { method: 'POST', body: { t: TOKEN, id: 'act1', silent: true, payload: { t: 'نشاط الاختبار', kind: 'normal', s: ['s1', 's2'], p: 10, q: [{ t: 'q', q: 'سؤال؟', o: ['أ', 'ب'], a: 0 }] } } });
  const WP = 18802, SP = 18801, wsrv = await serveWorker(W, env, WP), ssrv = await serveStatic(SP), base = 'http://localhost:' + SP;
  env.SITE_HOSTS = 'localhost:' + SP; env.SITE_TEST_BASE = base;   // /site في الاختبار: الموقع المحلي بدل *.pages.dev
  const b = await chromium.launch();
  const newCtx = async (opts = {}) => { const ctx = await b.newContext({ viewport: { width: 1200, height: 850 }, ...opts }); const reqs = [];
    await ctx.route(/workers\.dev/, async r => { const u = new URL(r.request().url()); if (ctx.offline) return r.abort('internetdisconnected').catch(() => {}); reqs.push({ u: u.pathname + u.search, h: r.request().headers()['x-teacher-token'] || '' });
      try { await r.fulfill({ response: await r.fetch({ url: 'http://localhost:' + WP + u.pathname + u.search }) }); } catch { try { await r.abort(); } catch {} } });   // الصفحة أُغلقت أثناء الطلب: لا يُسقط التشغيل
    ctx.reqs = reqs; return ctx; };
  /* اللوحة جاهزة وبيانات الفصل محمّلة: إن لم تحمّلها «اليوم» بعد، تُطلب من أدوات الفصل (ولو فشلت يظهر السبب) */
  const dashReady = async p => {
    await p.waitForFunction(() => typeof ctGo === 'function' && typeof qrPaint === 'function', null, { timeout: 15000 });
    try { await p.waitForFunction(() => typeof CT_DATA !== 'undefined' && CT_DATA, null, { timeout: 6000 }); return; } catch {}
    await p.evaluate(() => ctGo('records'));
    try { await p.waitForFunction(() => typeof CT_DATA !== 'undefined' && CT_DATA, null, { timeout: 20000 }); }
    catch { throw new Error('بيانات الفصل لم تُحمّل: ' + await p.evaluate(() => [String(localStorage.getItem('hwapp_tok_v1') || '').slice(0, 4), (document.querySelector('#ct-body') || {}).innerText].join(' | ').slice(0, 200))); } };
  const watch = p => { const e = []; p.on('pageerror', x => e.push(x.message)); p.on('dialog', d => d.accept()); return e; };
  try {
    // ── لوحة التحكم ──
    { const ctx = await newCtx(), p = await ctx.newPage(), errs = watch(p);
      await S.t('لوحة التحكم تفتح بلا أخطاء برمجية', async () => {
        await p.goto(base + '/teacher-dashboard/'); await p.evaluate(t => localStorage.setItem('hwapp_tok_v1', t), TOKEN); await p.reload(); await p.waitForTimeout(5000);
        eq(errs, [], 'أخطاء'); });
      await S.t('كلمة السر تُستبدل بجلسة الجهاز', async () => { ok(String(await p.evaluate(() => localStorage.getItem('hwapp_tok_v1'))).startsWith('ts1.'), 'ما زالت كلمة السر محفوظة'); });
      await S.t('🗂️ القائمة بالأقسام: عناوين ثابتة، «+N» يُظهر المخفي، والتخصيص داخل القائمة (مفتاح + سحب)', async () => {
        const pins = () => p.evaluate(() => (JSON.parse(localStorage.getItem('simp_pins_v1') || 'null') || { pins: [] }).pins);
        const old = await p.evaluate(() => localStorage.getItem('simp_pins_v1'));
        ok(await p.evaluate(() => ['teach', 'students', 'exams', 'reports', 'contact'].every(k => document.querySelector(`#simp-nav [data-simp-gh="${k}"]`))), 'عناوين الأقسام');
        const hid = await p.evaluate(() => document.querySelector('#simp-nav [data-simp-hid="exams"]').textContent.trim()); ok(/^\+\d+$/.test(hid), 'الرقم ' + hid);
        await p.evaluate(() => document.querySelector('#simp-nav [data-simp-hid="exams"]').click());
        ok(await p.evaluate(() => !!document.querySelector('#simp-nav .simp-temp[data-simp-pin="nafs"]')), 'لم يظهر المخفي');
        await p.evaluate(() => document.querySelector('.simp-cust-row .simp-customize:not(.simp-settings)').click());
        ok(await p.evaluate(() => document.querySelectorAll('#simp-nav .simp-edit-row').length >= 18), 'وضع التخصيص');
        await p.evaluate(() => document.querySelector('[data-simp-edit="nafs"] .simp-tog').click());
        ok((await pins()).includes('nafs'), 'التشغيل لم يُحفظ');
        await p.evaluate(() => document.querySelector('[data-simp-edit="classtools:exams"] .simp-tog').click());
        await p.evaluate(() => document.querySelector('[data-simp-edit="classtools:exams"] .simp-tog').click());   // صار بعد نافس
        const h = await (await p.$('[data-simp-edit="classtools:exams"] .simp-drag')).boundingBox(), t = await (await p.$('[data-simp-edit="nafs"]')).boundingBox();
        await p.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await p.mouse.down(); await p.mouse.move(h.x + h.width / 2, t.y + 3, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200);
        const q = await pins(); ok(q.indexOf('classtools:exams') < q.indexOf('nafs'), 'السحب لم يرتّب: ' + q.join(','));
        await p.evaluate(() => document.querySelector('.simp-cust-row .simp-customize.done').click());
        ok(await p.evaluate(() => !document.querySelector('#simp-nav .simp-edit-row') && !!document.querySelector('#simp-nav [data-simp-pin="nafs"]:not(.simp-temp)')), 'بعد «تم»');
        await p.evaluate(o => { if (o) localStorage.setItem('simp_pins_v1', o); else localStorage.removeItem('simp_pins_v1'); }, old); eq(errs, [], 'أخطاء'); });
      await S.t('🔀 شكل القائمة: المعلم يختار «قائمة واحدة» (القديم) أو «بالأقسام» ويُحفظ', async () => {
        await p.evaluate(() => document.querySelector('.simp-cust-row .simp-customize:not(.simp-settings)').click());
        await p.evaluate(() => document.querySelector('#simp-nav [data-simp-style="flat"]').click());
        ok(await p.evaluate(() => !document.querySelector('#simp-nav [data-simp-gh]') && /صفحاتك/.test(document.getElementById('simp-pins').textContent)
          && getComputedStyle(document.querySelector('#simp-nav [data-simp-more]')).display !== 'none' && localStorage.getItem('simp_style_v1') === 'flat'), 'القديم');
        await p.evaluate(() => document.querySelector('.simp-cust-row .simp-customize:not(.simp-settings)').click());
        ok(await p.evaluate(() => document.getElementById('simp-sheet').classList.contains('on') && !!document.querySelector('#simp-sheet [data-simp-style="sections"]')), 'ورقة التخصيص القديمة فيها الاختيار');
        await p.evaluate(() => document.querySelector('#simp-sheet [data-simp-style="sections"]').click());
        ok(await p.evaluate(() => !!document.querySelector('#simp-nav [data-simp-gh="exams"]') && !!document.querySelector('#simp-nav .simp-edit-row')), 'رجع للأقسام');
        await p.evaluate(() => document.querySelector('.simp-cust-row .simp-customize.done').click()); eq(errs, [], 'أخطاء'); });
      await S.t('🧪 «اختبار الاتصال» يختبر المزوّد المختار وحده ويُظهر خطأه الحقيقي مع شرح (لا ينجح بمزوّد آخر)', async () => {
        await p.route(/generativelanguage\.googleapis\.com/, r => r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }) }));
        await p.route(/api\.anthropic\.com/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: '{}' }] }) }));
        await p.waitForFunction(() => typeof aiSettingsTest === 'function', null, { timeout: 15000 });
        const msg = await p.evaluate(async () => { const keep = {}; ['ai_provider_v1', 'aikeys_gemini', 'aikeys_claude'].forEach(k => keep[k] = localStorage.getItem(k));
          localStorage.setItem('ai_provider_v1', 'gemini'); localStorage.setItem('aikeys_gemini', JSON.stringify([{ key: 'AIzaTEST0000000000' }])); localStorage.setItem('aikeys_claude', JSON.stringify([{ key: 'sk-ant-TEST000000' }]));
          let out = ''; const orig = window.aiSettingsMsg; window.aiSettingsMsg = t => { out = t; };
          try { await aiSettingsTest(); } finally { window.aiSettingsMsg = orig; Object.entries(keep).forEach(([k, v]) => v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v)); }
          return out; });
        await p.unroute(/generativelanguage\.googleapis\.com/); await p.unroute(/api\.anthropic\.com/);
        ok(/فشل Google Gemini/.test(msg) && /API key not valid/.test(msg) && /المفتاح غير صحيح/.test(msg), msg); eq(errs, [], 'أخطاء'); });
      await S.t('🤖 موديلات المزوّدات محدَّثة: الافتراضي الجديد وملاحظة السعر، والموديل الملغى يعود للافتراضي', async () => {
        const r = await p.evaluate(() => { const P = READING_AI_PROVIDERS, keep = localStorage.getItem('ai_provider_v1');
          localStorage.setItem('ai_provider_v1', 'gemini'); aiSettingsRender(); const opts = [...document.querySelectorAll('#ai-settings-model option')].map(o => o.textContent);
          if (keep == null) localStorage.removeItem('ai_provider_v1'); else localStorage.setItem('ai_provider_v1', keep); aiSettingsRender();
          return { g: P.gemini.defaultModel, c: P.claude.models, o: P.openai.defaultModel, opts, ret: AI_RETIRED_MODELS.includes('claude-sonnet-5') && AI_RETIRED_MODELS.includes('gpt-6-sol'),
            dup: Object.values(P).some(c => c.models.some(m => AI_RETIRED_MODELS.includes(m))) }; });
        eq(r.g, 'gemini-3.8-flash'); ok(r.c.includes('claude-sonnet-5-5') && r.c.includes('claude-haiku-5-5'), 'Claude'); eq(r.o, 'gpt-6.1-sol');
        ok(r.opts.some(t => /gemini-3\.8-flash — مجاني/.test(t)) && r.opts.some(t => /gemini-4-argon — .*مدفوع/.test(t)), r.opts.join(' | '));
        ok(r.ret, 'الملغاة'); ok(!r.dup, 'موديل في القائمة وفي الملغاة معًا'); eq(errs, [], 'أخطاء'); });
      await S.t('🔄 «تحديث قائمة الموديلات»: يجلب موديلات المفتاح من المزوّد، يضيف الجديد ويعلّم غير المتاح، ولا يرسل temperature للأجيال الحديثة', async () => {
        const gen = ['generateContent'];
        await p.route(/generativelanguage\.googleapis\.com\/v1beta\/models\?/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ models: [
          { name: 'models/gemini-3.8-flash', supportedGenerationMethods: gen }, { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: gen }, { name: 'models/gemini-4-argon', supportedGenerationMethods: gen },
          { name: 'models/gemini-4.1-flash', supportedGenerationMethods: gen }, { name: 'models/gemini-3.8-flash-tts', supportedGenerationMethods: gen }, { name: 'models/text-embedding-005', supportedGenerationMethods: ['embedContent'] }] }) }));
        await p.waitForFunction(() => typeof aiModelsSync === 'function' && typeof aiNoTemp === 'function', null, { timeout: 15000 });
        const r = await p.evaluate(async () => { const keep = {}; ['ai_provider_v1', 'aikeys_gemini', 'ai_models_live_gemini'].forEach(k => keep[k] = localStorage.getItem(k));
          localStorage.setItem('ai_provider_v1', 'gemini'); localStorage.setItem('aikeys_gemini', JSON.stringify([{ key: 'AIzaTEST0000000000' }])); aiSettingsRender();
          await aiModelsSync(); const opts = [...document.querySelectorAll('#ai-settings-model option')].map(o => o.textContent), st = document.getElementById('ai-models-sync-st').textContent;
          Object.entries(keep).forEach(([k, v]) => v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v)); aiSettingsRender();
          return { opts, st, nt: [aiNoTemp('gemini', 'gemini-4.1-flash'), aiNoTemp('openai', 'gpt-6.2-sol'), aiNoTemp('openrouter', 'anthropic/claude-sonnet-6'), aiNoTemp('groq', 'llama-3.3-70b-versatile')] }; });
        await p.unroute(/generativelanguage\.googleapis\.com\/v1beta\/models\?/);
        ok(r.opts.some(t => /^gemini-4\.1-flash/.test(t)), 'الجديد: ' + r.opts.join(' | ')); ok(!r.opts.some(t => /tts|embedding/.test(t)), 'دخل غير النصي');
        ok(r.opts.some(t => /gemini-3\.1-pro-preview — ⚠️/.test(t)), 'غير المتاح'); ok(/آخر تحديث/.test(r.st), r.st); eq(r.nt, [true, true, true, false]); eq(errs, [], 'أخطاء'); });
      await S.t('🔑 لا «حفظ/تحديث كلمة المرور» من المتصفح: لا حقل type=password، والسر يظهر نقاطًا وزر الإظهار يعمل', async () => {
        await p.evaluate(() => goTab('data')); await p.waitForTimeout(300);
        const r = await p.evaluate(() => { const t = document.getElementById('api-tok'), k = document.getElementById('ai-settings-new-key'), sec = e => getComputedStyle(e).webkitTextSecurity;
          const a = [document.querySelectorAll('input[type=password]').length, t.type, sec(t), sec(k), t.autocomplete];
          const btn = t.nextElementSibling; btn.click(); a.push(sec(t)); btn.click(); a.push(sec(t)); return a; });
        await p.evaluate(() => goTab('dashboard'));
        eq(r, [0, 'text', 'disc', 'disc', 'off', 'none', 'disc']); eq(errs, [], 'أخطاء'); });
      await S.t('🤖 مع كل طلب ذكاء اصطناعي: شريط يوضح المزوّد والموديل، والتحويل وسببه، ومن أنجز — وآخر استخدام في الإعدادات', async () => {
        await p.route(/generativelanguage\.googleapis\.com/, r => r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { code: 429, message: 'You exceeded your current quota, please check your plan and billing details.' } }) }));
        await p.route(/api\.anthropic\.com/, async r => { await new Promise(x => setTimeout(x, 700)); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: '{"ok":1}' }] }) }); });
        const r = await p.evaluate(async () => { const keep = {}; ['ai_provider_v1', 'aikeys_gemini', 'aikeys_claude', 'ai_last_used'].forEach(k => keep[k] = localStorage.getItem(k));
          localStorage.setItem('ai_provider_v1', 'gemini'); localStorage.setItem('aikeys_gemini', JSON.stringify([{ key: 'AIzaTEST0000000000' }])); localStorage.setItem('aikeys_claude', JSON.stringify([{ key: 'sk-ant-TEST000000' }]));
          const seen = []; const mo = new MutationObserver(() => { const e = document.getElementById('ai-use'); if (e) seen.push(e.textContent.replace(/\s+/g, ' ').trim()); });
          mo.observe(document.body, { childList: true, subtree: true, characterData: true });
          const out = await readingAICall('gemini', 'gemini-3.8-flash', 'x', new AbortController().signal); await new Promise(x => setTimeout(x, 50)); mo.disconnect();
          aiSettingsRender(); const last = (document.getElementById('ai-last-used') || {}).textContent || '';
          Object.entries(keep).forEach(([k, v]) => v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v)); aiSettingsRender();
          return { out, seen: [...new Set(seen)], last }; });
        await p.unroute(/generativelanguage\.googleapis\.com/); await p.unroute(/api\.anthropic\.com/);
        const all = r.seen.join(' | ');
        ok(/Google Gemini · gemini-3\.8-flash — يعمل/.test(all), 'بداية: ' + all); ok(/تعذّر Google Gemini · gemini-3\.8-flash \(الرصيد أو الحصة\)/.test(all), 'السبب: ' + all);
        ok(/Google Gemini تعذّر \(الرصيد أو الحصة\) — يعمل الآن Claude/.test(all), 'التحويل: ' + all); ok(/أُنجز بـ Claude \(Anthropic\) · claude-opus-5-5 \(بدل Google Gemini\)/.test(all), 'النهاية: ' + all);
        ok(/آخر استخدام: Claude/.test(r.last), r.last); eq(errs, [], 'أخطاء'); });
      await S.t('🎯 مزوّد لكل مهمة: PDF بمزوّد والأسئلة بآخر، ومزوّد بلا مفتاح يعود للأساسي، والخلفية على الموديل الاقتصادي', async () => {
        const r = await p.evaluate(() => { const keep = {}; ['ai_provider_v1', 'aikeys_gemini', 'aikeys_claude', 'ai_routes_v1', 'ai_model_claude'].forEach(k => keep[k] = localStorage.getItem(k));
          localStorage.setItem('ai_provider_v1', 'gemini'); localStorage.setItem('aikeys_gemini', JSON.stringify([{ key: 'AIzaTEST0000000000' }])); localStorage.setItem('aikeys_claude', JSON.stringify([{ key: 'sk-ant-TEST000000' }]));
          localStorage.removeItem('ai_routes_v1'); aiSettingsRender();
          const out = { rows: document.querySelectorAll('#ai-routes .ai-route-row').length, def: aiRoute('pdf') };
          aiRouteSet('pdf', 'p', 'claude'); aiRouteSet('pdf', 'm', 'claude-sonnet-5-5'); aiRouteSet('background', 'p', 'openai');
          out.pdf = aiRoute('pdf'); out.q = aiRoute('questions'); out.bg = aiRoute('background'); out.tw = aiRouteTwin();
          out.ui = document.querySelector('#ai-routes [data-ai-route="pdf"] select').value; out.warn = !!document.querySelector('#ai-routes [data-ai-route="background"] .ai-route-warn');
          Object.entries(keep).forEach(([k, v]) => v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v)); aiSettingsRender(); return out; });
        eq(r.rows, 5, 'المهام'); eq([r.def.p, r.def.custom], ['gemini', false]); eq([r.pdf.p, r.pdf.m, r.pdf.custom], ['claude', 'claude-sonnet-5-5', true]);
        eq(r.q.p, 'gemini', 'الأسئلة على الأساسي'); eq(r.bg.p, 'gemini', 'بلا مفتاح ⇒ الأساسي'); eq(r.tw.m, 'gemini-3.8-flash', 'الخلفية الاقتصادية'); eq(r.ui, 'claude'); ok(r.warn, 'تنبيه بلا مفتاح'); eq(errs, [], 'أخطاء'); });
      await S.t('🔌 ربط Claude: إنشاء الرابط من الإعدادات يعمل مع خادم MCP، والإيقاف يقطعه', async () => {
        await p.evaluate(() => goTab('data'));
        await p.evaluate(() => mcpLoad()); await p.waitForSelector('#mcp-box button', { state: 'attached' });
        await p.evaluate(() => mcpLoad('create')); await p.waitForSelector('#mcp-url', { state: 'attached', timeout: 8000 });
        const url = await p.$eval('#mcp-url', e => e.value); ok(/\/mcp\/[a-z0-9]{20,}$/.test(url), url);
        const r = await p.evaluate(async u => (await (await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) })).json()).result.tools.length, url);
        eq(r, 14, 'الأدوات'); p.once('dialog', d => d.accept());
        await p.evaluate(() => { window.askConfirm = async () => true; return mcpLoad('revoke'); }); await p.waitForTimeout(300);
        eq(await p.evaluate(async u => (await fetch(u, { method: 'POST', body: '{}' })).status, url), 404, 'بعد الإيقاف');
        await p.evaluate(() => goTab('dashboard')); eq(errs, [], 'أخطاء'); });
      await S.t('✨ مساعدي: «مين الغايب اليوم» فوري من السجل بلا ذكاء، وغيره: يختار الذكاء أداة تُحسب على الجهاز ثم يجيب بمصدره', async () => {
        await p.waitForFunction(() => typeof asstOpen === 'function' && typeof ASST_TOOLS === 'object', null, { timeout: 15000 });
        ok(await p.$('#asst-btn'), 'زر مساعدي');
        const on0 = await p.evaluate(() => { const b = document.getElementById('asst-btn'), c = document.getElementById('asst-on-tg'), vis = () => !!(b.offsetWidth || b.offsetHeight);
          const r = { def: localStorage.getItem('asst_on'), hidden: !vis(), tg: c && c.checked }; asstOnSet(true); r.shown = vis() && c.checked; asstOnSet(false); r.off = !vis() && !c.checked; asstOnSet(true); return r; });
        eq(on0, { def: null, hidden: true, tg: false, shown: true, off: true }, 'مساعدي مقفول افتراضيًا ويُفعَّل من الإعدادات');
        const bodies = [];
        await p.route(/generativelanguage\.googleapis\.com/, async r => { const b = r.request().postData() || ''; bodies.push(b); const first = bodies.length === 1;
          r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: first ? '{"calls":[{"tool":"ranking","args":{"by":"total","order":"desc","n":3}}]}' : '{"answer":"الأعلى **طالب س**"}' }] } }] }) }); });
        const r = await p.evaluate(async () => { const keep = {}; ['ai_provider_v1', 'aikeys_gemini', 'ai_routes_v1'].forEach(k => keep[k] = localStorage.getItem(k));
          localStorage.setItem('ai_provider_v1', 'gemini'); localStorage.setItem('aikeys_gemini', JSON.stringify([{ key: 'AIzaTEST0000000000' }])); localStorage.removeItem('ai_routes_v1');
          if (typeof ctLoad === 'function' && !CT_DATA) { try { await ctLoad(); } catch (e) {} }
          const D = CT_DATA || (CT_DATA = {}); D.participation = D.participation || {}; const d = ctToday(), keepDay = D.participation[d]; const s0 = STUDENTS[0];
          D.participation[d] = { [s0.id]: { status: 'غائب', at: Date.now() } };
          asstOpen(); ASST.msgs = []; await asstAsk('مين الغايب اليوم؟'); const fast = ASST.msgs[1];
          await asstAsk('مين الأعلى في الفترة؟'); const ai = ASST.msgs[3];
          if (keepDay === undefined) delete D.participation[d]; else D.participation[d] = keepDay;
          const open = document.getElementById('asst-panel').classList.contains('on'); asstClose(); ASST.msgs = [];
          Object.entries(keep).forEach(([k, v]) => v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v));
          return { fast: fast.html, fsrc: fast.src, ai: ai.html, asrc: ai.src, name: s0.name, open }; });
        await p.unroute(/generativelanguage\.googleapis\.com/);
        ok(r.open, 'اللوحة'); ok(r.fast.includes(r.name) && /غاب اليوم/.test(r.fast), r.fast); ok(r.fsrc.some(x => /فوري بلا ذكاء/.test(x)), 'فوري');
        eq(bodies.length, 2, 'طلبا ذكاء فقط للسؤال الثاني'); ok(/ranking/.test(bodies[0]) && /نتائج الأدوات/.test(bodies[1]), 'خطوتا الأداة والجواب');
        ok(/<b>طالب س<\/b>/.test(r.ai), r.ai); ok(r.asrc.some(x => /درجات الفترة/.test(x)) && r.asrc.some(x => /Google Gemini · gemini-3\.8-flash/.test(x)), r.asrc.join(' | ')); eq(errs, [], 'أخطاء'); });
      await S.t('✨ مساعدي — الأوامر: بطاقة تأكيد ولا يُكتب شيء قبل «نفّذ»، ثم الرصد بطابور الرصد السريع و«تراجع»؛ ملخص الصباح؛ ومسودة ولي الأمر بلا معرّف للمزوّد', async () => {
        const bodies = []; let plan = '';
        try { await p.exposeFunction('__plan', v => { plan = v; }); } catch (e) {}
        await p.route(/generativelanguage\.googleapis\.com/, async r => { const b = r.request().postData() || ''; bodies.push(b);
          const txt = /نتائج الأدوات/.test(b) ? '{"answer":"هذه مسودة","draft":"السلام عليكم ورحمة الله، نود إفادتكم…"}' : plan;
          r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: txt }] } }] }) }); });
        const r = await p.evaluate(async () => { const keep = {}; ['ai_provider_v1', 'aikeys_gemini', 'ai_routes_v1', 'asst_brief_seen'].forEach(k => keep[k] = localStorage.getItem(k));
          localStorage.setItem('ai_provider_v1', 'gemini'); localStorage.setItem('aikeys_gemini', JSON.stringify([{ key: 'AIzaTEST0000000000' }])); localStorage.removeItem('ai_routes_v1');
          if (!CT_DATA) { try { await ctLoad(); } catch (e) {} } const D = CT_DATA, d = ctToday(), s1 = STUDENTS[1], s0 = STUDENTS[0];
          const before = ((D.participation || {})[d] || {})[s1.id]; asstOpen(); ASST.msgs = [];
          window.__plan('{"calls":[{"tool":"record_attendance","args":{"students":["' + s1.name + '"],"status":"غائب"}}]}');
          await asstAsk('سجّل ' + s1.name + ' غايب'); const m = ASST.msgs[ASST.msgs.length - 1], card = m.cards && m.cards[0]; const st0 = card && card.state;
          const pre = ((D.participation || {})[d] || {})[s1.id]; const i = ASST.msgs.indexOf(m);
          asstAct(i, 0, 'do'); const after = (D.participation[d] || {})[s1.id], outbox = JSON.parse(localStorage.getItem('ct_outbox_v1') || '[]').some(o => o.sid === String(s1.id) && o.v === 'غائب');
          asstAct(i, 0, 'undo'); const undone = (D.participation[d] || {})[s1.id];
          const days = ['2020-02-02', '2020-02-03', '2020-02-04']; days.forEach(x => { D.participation[x] = D.participation[x] || {}; D.participation[x][s0.id] = { status: 'غائب', at: 1 }; });
          const brief = (await asstBrief()).map(x => x.t).join(' | '); days.forEach(x => delete D.participation[x][s0.id]);
          window.__plan('{"calls":[{"tool":"parent_message","args":{"student":"' + s0.name + '","topic":"الغياب"}}]}');
          await asstAsk('اكتب رسالة لولي أمر ' + s0.name + ' عن غيابه'); const dm = ASST.msgs[ASST.msgs.length - 1], dc = dm.cards && dm.cards[0];
          const html = document.getElementById('asst-msgs').innerHTML; asstClose(); ASST.msgs = [];
          Object.entries(keep).forEach(([k, v]) => v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v));
          return { card: card && card.action, st: st0, items: card && card.items.length, preSame: JSON.stringify(pre) === JSON.stringify(before), after: after && after.status, undone: undone ? undone.status : '', outbox, brief, s0: s0.name.split(' ')[0], draft: dc && dc.text, ta: /asst-draft/.test(html), ids: [String(s0.id), String(s1.id)] }; });
        await p.unroute(/generativelanguage\.googleapis\.com/);
        eq([r.card, r.st, r.items], ['record', 'ask', 1], 'بطاقة التأكيد'); ok(r.preSame, 'كُتب قبل «نفّذ»'); eq(r.after, 'غائب', 'الرصد'); ok(r.outbox, 'طابور الرصد'); eq(r.undone, '', 'التراجع');
        ok(/غابوا آخر ٣ حصص/.test(r.brief) && r.brief.includes(r.s0), 'الملخص: ' + r.brief);
        ok(/^السلام عليكم/.test(r.draft || '') && r.ta, 'المسودة'); const last = bodies[bodies.length - 1];
        ok(!r.ids.some(id => last.includes('"' + id + '"')) && !/"_id"/.test(last), 'وصل معرّف للمزوّد'); eq(errs, [], 'أخطاء'); });
      await S.t('💰 مساعدي: «كم نقاط فلان» = رصيد نقاط المكافآت فورًا بلا ذكاء (وليس درجة)، وأداة points للترتيب، والملخص فيه الرصيد', async () => {
        let ai = 0; await p.route(/generativelanguage\.googleapis\.com/, r => { ai++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"answer":"50"}' }] } }] }) }); });
        const r = await p.evaluate(async () => { const s0 = STUDENTS[0], s1 = STUDENTS[1], k0 = s0.points, k1 = s1.points; s0.points = 7; s1.points = 12;
          try { asstOpen(); ASST.msgs = []; await asstAsk('كم نقاط ' + s0.name + '؟'); const m = ASST.msgs[ASST.msgs.length - 1];
            const rank = await ASST_TOOLS.points.run({}), sum = await ASST_TOOLS.student_summary.run({ student: s0.name }); asstClose(); ASST.msgs = [];
            return { html: m.html, src: m.src.join(' '), top: rank.students[0].reward_points, sum: sum.reward_points }; }
          finally { s0.points = k0; s1.points = k1; } });
        await p.unroute(/generativelanguage\.googleapis\.com/);
        ok(/<b>7<\/b> نقطة/.test(r.html) && /فوري/.test(r.src), r.html); eq(ai, 0, 'استُدعي الذكاء'); eq([r.top, r.sum], [12, 7], 'الأداة والملخص'); eq(errs, [], 'أخطاء'); });
      await S.t('🛠️ مساعدي — أوامر إضافية بتأكيد وتراجع: نقاط (إضافة/خصم)، درجة نشاط يدوية، اختبار جديد في الدفتر، رسالة للطلاب بمعاينة كاملة', async () => {
        let plan = '', posted = null; try { await p.exposeFunction('__plan3', v => { plan = v; }); } catch (e) {}
        await p.route(/generativelanguage\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: plan }] } }] }) }));
        await p.route(/\/messages$/, r => { if (r.request().method() !== 'POST') return r.fallback(); posted = JSON.parse(r.request().postData() || '{}'); r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"count":1,"requested":1}' }); });
        const r = await p.evaluate(async () => { const keep = {}; ['ai_provider_v1', 'aikeys_gemini', 'ai_routes_v1'].forEach(k => keep[k] = localStorage.getItem(k));
          localStorage.setItem('ai_provider_v1', 'gemini'); localStorage.setItem('aikeys_gemini', JSON.stringify([{ key: 'AIzaTEST0000000000' }])); localStorage.removeItem('ai_routes_v1');
          if (!CT_DATA) { try { await ctLoad(); } catch (e) {} } const s0 = STUDENTS[0], k0 = s0.points, out = {}; s0.points = 10; asstOpen(); ASST.msgs = [];
          const last = () => { const m = ASST.msgs[ASST.msgs.length - 1]; return [m, ASST.msgs.indexOf(m)]; };
          window.__plan3(JSON.stringify({ calls: [{ tool: 'adjust_points', args: { students: [s0.name], delta: 5, reason: 'مشاركة' } }] })); await asstAsk('زد نقاطه ٥');
          let [m, i] = last(); out.pc = [m.cards[0].action, s0.points]; asstAct(i, 0, 'do'); await new Promise(z => setTimeout(z, 1500)); out.p1 = s0.points; asstAct(i, 0, 'undo'); await new Promise(z => setTimeout(z, 300)); out.p2 = s0.points;
          const h = { id: 'hwAS1', sid: 'pubAS1', title: 'نشاط المساعد التجريبي', max: 10, qs: [{ t: 'tf', q: 'x', a: true }], subs: {}, published: true, at: Date.now() }; HW.push(h);
          window.__plan3(JSON.stringify({ calls: [{ tool: 'grade_activity', args: { activity: 'المساعد التجريبي', scores: [{ student: s0.name, score: 8 }] } }] })); await asstAsk('ارصد له ٨');
          [m, i] = last(); out.gc = [m.cards[0].action, m.cards[0].items[0].prev]; asstAct(i, 0, 'do'); out.g1 = (h.subs[s0.id] || {}).manualGrade; asstAct(i, 0, 'undo'); out.g2 = h.subs[s0.id] === undefined; HW.splice(HW.indexOf(h), 1); save(K.hw, HW);
          const { sem, per } = ctSemActive(), b0 = ctBook(CT_DATA, sem, per), n0 = b0.tests.length;
          window.__plan3(JSON.stringify({ calls: [{ tool: 'add_exam_test', args: { title: 'اختبار قصير تجريبي للمساعد', max: 10 } }] })); await asstAsk('أضف اختبار');
          [m, i] = last(); asstAct(i, 0, 'do'); out.t1 = ctBook(CT_DATA, sem, per).tests.length - n0; asstAct(i, 0, 'undo'); out.t2 = ctBook(CT_DATA, sem, per).tests.length - n0;
          window.__plan3(JSON.stringify({ calls: [{ tool: 'send_message', args: { to: 'students', students: [s0.name], title: 'تذكير', body: 'لا تنس الواجب' } }] })); await asstAsk('أرسل له رسالة');
          [m, i] = last(); out.mc = [m.cards[0].action, m.cards[0].count, /asst-msgprev/.test(document.getElementById('asst-msgs').innerHTML)]; out.before = window.__posted; asstAct(i, 0, 'do'); await new Promise(z => setTimeout(z, 800)); out.ms = [m.cards[0].state, m.cards[0].res];
          asstClose(); ASST.msgs = []; s0.points = k0; Object.entries(keep).forEach(([k, v]) => v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v)); out.sid = String(s0.id); return out; });
        await p.unroute(/generativelanguage\.googleapis\.com/); await p.unroute(/\/messages$/);
        eq(r.pc, ['points', 10], 'بطاقة النقاط قبل التأكيد'); eq([r.p1, r.p2], [15, 10], 'النقاط والتراجع');
        eq(r.gc, ['grade', 'لم يسلّم'], 'بطاقة الدرجة'); eq([r.g1, r.g2], [8, true], 'الدرجة والتراجع'); eq([r.t1, r.t2], [1, 0], 'الاختبار والتراجع');
        eq(r.mc, ['msg', 1, true], 'معاينة الرسالة'); eq(r.ms[0], 'done', r.ms[1]); eq([posted && posted.audience, posted && posted.recipients[0].id, posted && posted.title], ['students', r.sid, 'تذكير'], 'ما أُرسل'); eq(errs, [], 'أخطاء'); });
      await S.t('🧩 مساعدي — الدفعة الثالثة: «الكل ما عدا»، موعد نشاط، محاولة إضافية، نسخ نشاط، رسائل الطلاب والرد، مسودات أولياء الأمور، تذكير، اختصار، ذاكرة، مقارنة فصول، إعلان اختبار، وضع المحادثة', async () => {
        let plan = ''; try { await p.exposeFunction('__plan4', v => { plan = v; }); } catch (e) {}
        await p.route(/generativelanguage\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: /نتائج الأدوات/.test(r.request().postData() || '') ? '{"answer":"تم"}' : plan }] } }] }) }));
        const r = await p.evaluate(async () => { const keep = {}; ['ai_provider_v1', 'aikeys_gemini', 'ai_routes_v1', 'asst_sc_v1', 'asst_hist_v1', 'asst_conv'].forEach(k => keep[k] = localStorage.getItem(k));
          localStorage.setItem('ai_provider_v1', 'gemini'); localStorage.setItem('aikeys_gemini', JSON.stringify([{ key: 'AIzaTEST0000000000' }])); localStorage.removeItem('ai_routes_v1'); localStorage.removeItem('asst_sc_v1');
          if (!CT_DATA) { try { await ctLoad(); } catch (e) {} } const S = STUDENTS, s0 = S[0], s1 = S[1], cls = s0.cls, out = {}; asstOpen(); ASST.msgs = [];
          const P = {}, of = window.fetch, al = window.asksLoad; window.__P = P; window.asksLoad = async () => { ASKS = [{ id: 'q1', name: s0.name, cls, cat: 'lesson', text: 'ما معنى الخلية؟', status: 'open', at: Date.now() }]; };
          window.fetch = (u, o) => { const m = String(u).match(/\/(extra-attempt-bulk|ask-reply|messages)(\?|$)/); if (m && o && o.method === 'POST') { P[m[1]] = JSON.parse(o.body || '{}'); return Promise.resolve(new Response(JSON.stringify({ ok: true, count: 1, item: { id: 'q1', status: 'done' } }))); } return of(u, o); };
          const ask = async (calls, q) => { await window.__plan4(JSON.stringify({ calls })); await asstAsk(q || 'أمر'); const m = ASST.msgs[ASST.msgs.length - 1]; return [m, ASST.msgs.indexOf(m)]; };
          let [m, i] = await ask([{ tool: 'record_attendance', args: { students: ['الكل'], cls, except: [s1.name], status: 'شارك' } }]);
          out.except = m.cards[0].items.map(x => x.name).includes(s1.name) === false && m.cards[0].items.some(x => x.name === s0.name);
          [m] = await ask([{ tool: 'behavior_note', args: { students: ['الكل'], cls, type: 'positive', note: 'تميز' } }]); out.behAll = m.cards[0].items.length === S.filter(x => x.cls === cls).length;
          const h = { id: 'hwAS3', sid: 'pubAS3', title: 'نشاط الدفعة الثالثة', due: '2026-01-01', max: 10, qs: [{ t: 'tf', q: 'س', a: true }], subs: {}, published: true, at: Date.now() }; HW.push(h);
          const pub = window.publishHwSilently; let pubs = 0; window.publishHwSilently = async x => { pubs++; };
          [m, i] = await ask([{ tool: 'activity_due', args: { activity: 'الدفعة الثالثة', due: '2026-12-20' } }]); asstAct(i, 0, 'do'); await new Promise(z => setTimeout(z, 200)); out.due = [h.due, pubs, m.cards[0].state];
          asstAct(i, 0, 'undo'); await new Promise(z => setTimeout(z, 200)); out.dueUndo = [h.due, pubs]; window.publishHwSilently = pub;
          [m, i] = await ask([{ tool: 'extra_attempt', args: { activity: 'الدفعة الثالثة', students: [s0.name] } }]); asstAct(i, 0, 'do'); await new Promise(z => setTimeout(z, 600)); out.retry = [m.cards[0].state, (h.extraAttempts || {})[s0.id]];
          const n0 = HW.length; [m, i] = await ask([{ tool: 'copy_activity', args: { activity: 'الدفعة الثالثة', cls: S[2].cls } }]); asstAct(i, 0, 'do'); const cp = HW[HW.length - 1];
          out.copy = [HW.length - n0, cp.cls, !!cp.sid, !!cp.published, (cp.qs || []).length, Object.keys(cp.subs || {}).length]; HW.splice(HW.indexOf(cp), 1); HW.splice(HW.indexOf(h), 1); save(K.hw, HW); try { closeModal(); } catch (e) {} asstOpen();
          const sm = await ASST_TOOLS.student_messages.run({}); out.msgs = [sm.open, sm.messages[0] && sm.messages[0].text];
          [m, i] = await ask([{ tool: 'reply_student', args: { student: s0.name, reply: 'هي وحدة بناء الكائن الحي' } }]); asstAct(i, 0, 'do'); await new Promise(z => setTimeout(z, 600)); out.reply = m.cards[0].state;
          const D = CT_DATA; const days = ['2026-11-01', '2026-11-02', '2026-11-03']; days.forEach(x => { D.participation[x] = D.participation[x] || {}; D.participation[x][s0.id] = { status: 'غائب', at: 1 }; });
          [m] = await ask([{ tool: 'parent_drafts', args: { reason: 'absence', min: 3, days: 3650 } }]); days.forEach(x => delete D.participation[x][s0.id]); out.drafts = m.cards[0] && [m.cards[0].action, m.cards[0].items.some(x => x.name === s0.name && /تغيّب 3/.test(x.text))];
          const r0 = (D.reminders || []).length; [m, i] = await ask([{ tool: 'reminder', args: { title: 'تصحيح اختبار أول 2', date: 'بكرة', time: '16:30' } }]); asstAct(i, 0, 'do'); const rr = (D.reminders || []).slice(-1)[0];
          out.rem = [(D.reminders || []).length - r0, rr && rr.hm || rr && rr.at.hm, rr && rr.repeat]; asstAct(i, 0, 'undo'); out.remUndo = (D.reminders || []).length - r0;
          [m, i] = await ask([{ tool: 'shortcut', args: { name: 'بداية الحصة', command: 'مين الغايب اليوم؟' } }]); asstAct(i, 0, 'do'); out.sc = !!asstShortcuts()['بداية الحصة'] && /⚡ بداية الحصة/.test(document.querySelector('#asst-panel .asst-sugg').textContent);
          await asstAsk('بداية الحصة'); const fm = ASST.msgs[ASST.msgs.length - 1]; out.scRun = fm.src.join(' ');
          const cc = await ASST_TOOLS.compare_classes.run({ classes: asstClsList() }); out.cmp = cc.classes ? cc.classes.length : cc.error;
          [m, i] = await ask([{ tool: 'send_message', args: { to: 'class', cls, type: 'exam', title: 'اختبار الفترة', body: 'راجعوا الدرس', exam_date: '2026-12-20', pages: '20-40' } }]); asstAct(i, 0, 'do'); await new Promise(z => setTimeout(z, 600)); out.exam = m.cards[0].state;
          asstPaint(); const nMsgs = ASST.msgs.length; ASST.msgs = []; asstLoadHist(); out.mem = [ASST.msgs.length === nMsgs, ASST.msgs.every(x => !(x.cards || []).some(c => c.state === 'ask' && !['draft', 'drafts'].includes(c.action)))];
          asstForget(); out.forgot = localStorage.getItem('asst_hist_v1');
          const go = HWV.go, mute = HWV.mute; let gos = 0; HWV.go = o => { gos++; o.on = true; return true; }; HWV.mute = o => { if (o) o.on = false; };
          out.conv = [!!document.getElementById('asst-conv'), typeof asstConvToggle]; HWV.go = go; HWV.mute = mute;
          window.fetch = of; window.asksLoad = al; out.P = P; asstClose(); ASST.msgs = []; Object.entries(keep).forEach(([k, v]) => v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v)); return out; });
        await p.unroute(/generativelanguage\.googleapis\.com/); const P = r.P;
        ok(r.except, '«الكل ما عدا»'); ok(r.behAll, 'سلوك للفصل كامل'); eq(r.due, ['2026-12-20', 1, 'done'], 'الموعد'); eq(r.dueUndo, ['2026-01-01', 2], 'تراجع الموعد');
        eq(r.retry, ['done', 1], 'محاولة إضافية'); eq(P['extra-attempt-bulk'] && P['extra-attempt-bulk'].hwId, 'pubAS3', 'طلب المحاولة'); eq(r.copy, [1, r.copy[1], false, false, 1, 0], 'نسخ النشاط'); ok(r.copy[1], 'فصل النسخة');
        eq(r.msgs, [1, 'ما معنى الخلية؟'], 'رسائل الطلاب'); eq(r.reply, 'done', 'الرد'); eq(P['ask-reply'] && P['ask-reply'].reply, 'هي وحدة بناء الكائن الحي', 'نص الرد');
        eq(r.drafts, ['drafts', true], 'مسودات أولياء الأمور'); eq(r.rem, [1, '16:30', 'once'], 'التذكير'); eq(r.remUndo, 0, 'تراجع التذكير');
        ok(r.sc, 'حفظ الاختصار'); ok(/فوري/.test(r.scRun), 'تشغيل الاختصار: ' + r.scRun); ok(typeof r.cmp === 'number' && r.cmp >= 2, 'المقارنة: ' + r.cmp);
        eq(r.exam, 'done', 'إعلان الاختبار'); eq([P.messages && P.messages.type, P.messages && P.messages.examDate, /⟨EX⟩/.test(P.messages && P.messages.body || '')], ['exam', '2026-12-20', true], 'جسم الإعلان');
        eq(r.mem, [true, true], 'الذاكرة'); eq(r.forgot, null, 'انسَ'); eq(r.conv, [false, 'undefined'], 'زر وضع المحادثة أُزيل'); eq(errs, [], 'أخطاء'); });
      await S.t('🧭 مساعدي — التنقّل: كل صفحة في قائمته موجودة فعلًا في اللوحة، «افتح الجدول» يفتح الجدول فورًا بلا ذكاء، والاسم غير المعروف لا يُخمَّن', async () => {
        let ai = 0; await p.route(/generativelanguage\.googleapis\.com/, r => { ai++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"answer":"ما لقيت"}' }] } }] }) }); });
        const r = await p.evaluate(async () => { const keep = {}; ['ai_provider_v1', 'aikeys_gemini', 'asst_hist_v1'].forEach(k => keep[k] = localStorage.getItem(k));
          localStorage.setItem('ai_provider_v1', 'gemini'); localStorage.setItem('aikeys_gemini', JSON.stringify([{ key: 'AIzaTEST0000000000' }]));
          const missing = Object.entries(ASST_PAGES).filter(([k, P]) => P[0]).filter(([k, P]) => { const g = P[0]; if (g.startsWith('ct:')) return !CT_TABS.some(x => x[0] === g.slice(3));
            const [tab, view] = g.split(':'); return !document.querySelector(view ? `.tab[data-tab="${tab}"][data-view="${view}"]` : `.tab[data-tab="${tab}"]`); }).map(([k]) => k);
          const M = {}; ['افتح الجدول', 'افتح جدول الحصص', 'افتح المتجر', 'افتح ملف الفصل', 'افتح الحضور', 'روح للإعدادات', 'افتح نافس', 'افتح دفتر الاختبارات', 'افتح المسابقات', 'افتح شي ما له وجود'].forEach(q => { M[q] = asstPageMatch(q); });
          const bad = await ASST_TOOLS.open_page.run({ page: 'schedule_x', query: 'صفحة الطيران' }), fix = await ASST_TOOLS.open_page.run({ page: 'analysis', query: 'الجدول' });
          asstOpen(); ASST.msgs = []; await asstAsk('افتح الجدول'); await new Promise(z => setTimeout(z, 1500));
          const opened = [CT_TAB, document.getElementById('p-classtools').classList.contains('on'), ASST.msgs[1] && ASST.msgs[1].src.join(' ')];
          ASST.msgs = []; asstClose(); try { goTab('dashboard'); } catch (e) {} Object.entries(keep).forEach(([k, v]) => v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v));
          return { missing, M, bad: !!bad.error, fix: fix.page, opened }; });
        await p.unroute(/generativelanguage\.googleapis\.com/);
        eq(r.missing, [], 'صفحات غير موجودة في اللوحة');
        eq(r.M, { 'افتح الجدول': 'schedule', 'افتح جدول الحصص': 'schedule', 'افتح المتجر': 'exam_shop', 'افتح ملف الفصل': 'classfile', 'افتح الحضور': 'records', 'روح للإعدادات': 'settings', 'افتح نافس': 'nafs', 'افتح دفتر الاختبارات': 'exams', 'افتح المسابقات': 'live', 'افتح شي ما له وجود': '' }, 'المطابقة');
        ok(r.bad, 'خمّن صفحة غير موجودة'); eq(r.fix, 'schedule', 'تصحيح اختيار الذكاء من query'); eq(r.opened.slice(0, 2), ['schedule', true], 'فتح الجدول'); ok(/فوري/.test(r.opened[2]), 'بلا ذكاء'); eq(ai, 0, 'استُدعي الذكاء'); eq(errs, [], 'أخطاء'); });
      await S.t('🍎 محرّك الصوت (HWV): iPhone يبدأ جملة جديدة في الخانة نفسها ⇒ تصل كلماتها (لا تُبتلع)، والإضافة لنفس الجملة تعطي الجديد فقط؛ ووضع المحادثة لا يفتح جلسة بلا لمسة', async () => {
        const r = await p.evaluate(async () => { const rec = HWV.instance(false), st = rec.start; rec.start = () => {}; const got = [];
          const R = (t, f) => Object.assign([{ transcript: t }], { isFinal: !!f }), ev = (i, list) => ({ resultIndex: i, results: list });
          const o = { on: false, onText: (t, f) => got.push(t + (f ? '|F' : '')) };
          try { HWV.go(o); rec.onresult(ev(0, [R('مين الغايب اليوم في أول واحد', true)]));
            HWV.mute(o); rec.onresult(ev(0, [R('مين الغايب اليوم في أول واحد وكلام أثناء الكتم', false)]));   // مكتوم: يُستهلك
            HWV.go(o); rec.onresult(ev(0, [R('مرحبا', false)])); rec.onresult(ev(0, [R('مرحبا يا مساعد', true)]));
            rec.onresult(ev(0, [R('مرحبا يا مساعد كيف حالك', true)])); HWV.mute(o); }
          finally { rec.start = st; }
          const ios = HWV.ios, d = Object.getOwnPropertyDescriptor(HWV, 'active'); HWV.ios = true; Object.defineProperty(HWV, 'active', { get: () => false, configurable: true });
          asstOpen(); ASST_MIC = null; asstMic(true); await new Promise(z => setTimeout(z, 30));
          const wait = [ASST_MIC === null, !!ASST.waitTap];
          HWV.ios = ios; Object.defineProperty(HWV, 'active', d); ASST.waitTap = 0; asstClose();
          return { got, wait }; });
        eq(r.got, ['مين الغايب اليوم في أول واحد|F', 'مرحبا', 'مرحبا يا مساعد|F', 'كيف حالك|F'], 'الكلمات بعد الجملة الجديدة'); eq(r.wait, [true, true], 'بلا لمسة'); eq(errs, [], 'أخطاء'); });
      await S.t('🎙️ مساعدي على iPhone: تسجيل الصوت ثم تفريغه بمفتاح Groq (Whisper) أو Gemini — يتوقف وحده بعد السكوت، ويعمل مرة بعد مرة، ولا يستعمل التعرّف المدمج', async () => {
        const r = await p.evaluate(async () => { const keep = {}; ['asst_stt', 'groq_api_keys', 'aikeys_gemini', 'asst_conv'].forEach(k => keep[k] = localStorage.getItem(k));
          localStorage.setItem('asst_stt', 'on'); localStorage.setItem('groq_api_keys', JSON.stringify([{ key: 'gsk_TEST0000000000' }])); localStorage.removeItem('asst_conv');
          const gum = navigator.mediaDevices.getUserMedia, of = window.fetch, ask = window.asstAsk, sent = [], posts = []; let gums = 0, hwv = 0; const go = HWV.go; HWV.go = () => { hwv++; return true; };
          const acs = []; navigator.mediaDevices.getUserMedia = async () => { gums++; const ac = new AudioContext(); acs.push(ac); const osc = ac.createOscillator(), g = ac.createGain(), dst = ac.createMediaStreamDestination(); osc.frequency.value = 220; osc.connect(g); g.connect(dst); osc.start();
            g.gain.setValueAtTime(0.0005, ac.currentTime); g.gain.setValueAtTime(0.6, ac.currentTime + 0.6); g.gain.setValueAtTime(0.0005, ac.currentTime + 1.6); return dst.stream; };
          window.fetch = async (u, o) => { if (/audio\/transcriptions/.test(String(u))) { const f = o.body; posts.push({ u: String(u), model: f.get('model'), lang: f.get('language'), type: f.get('file').type, size: f.get('file').size, auth: o.headers.Authorization }); return new Response(JSON.stringify({ text: 'مين الغايب اليوم' + posts.length })); } return of(u, o); };
          window.asstAsk = q => { sent.push(q); };
          try { asstOpen(); const until = async f => { for (let k = 0; k < 120 && !f(); k++) await new Promise(z => setTimeout(z, 100)); };
            asstMic(); await until(() => sent.length >= 1); const live1 = ASST_STT.on;
            asstMic(); await until(() => sent.length >= 2);
            const w = asstWav([new Float32Array(48000)], 48000), hdr = new TextDecoder().decode(new Uint8Array(await w.slice(0, 4).arrayBuffer()));
            return { sent, posts, gums, hwv, live1, wav: [hdr, w.size] }; }
          finally { acs.forEach(x => x.close().catch(() => {})); try { ASST_STT.ctx && ASST_STT.ctx.close(); ASST_STT.ctx = null; } catch (e) {} navigator.mediaDevices.getUserMedia = gum; window.fetch = of; window.asstAsk = ask; HWV.go = go; asstClose(); Object.entries(keep).forEach(([k, v]) => v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v)); } });
        eq(r.sent, ['مين الغايب اليوم1', 'مين الغايب اليوم2'], 'وصل الكلام مرتين'); eq([r.gums, r.hwv, r.live1], [2, 0, false], 'تسجيل جديد كل مرة بلا التعرّف المدمج');
        eq(r.posts.map(x => [x.model, x.lang, x.type, x.auth]), [['whisper-large-v3-turbo', 'ar', 'audio/wav', 'Bearer gsk_TEST0000000000'], ['whisper-large-v3-turbo', 'ar', 'audio/wav', 'Bearer gsk_TEST0000000000']], 'طلب التفريغ');
        ok(r.posts[0].size > 20000 && r.posts[0].size < 200000, 'حجم التسجيل ' + r.posts[0].size); eq(r.wav, ['RIFF', 44 + 32000], 'WAV 16k'); eq(errs, [], 'أخطاء'); });
      await S.t('🎙️ المحادثة الحية (Gemini Live، تجريبية): يتصل بالنموذج ويرجع للبديل إن رُفض، يرسل صوت الميكروفون PCM 16k، ينفّذ أدوات القراءة فقط ويرد عليها بلا معرّفات، يشغّل الصوت ويكتب المحادثة، وينهي كل شيء', async () => {
        const r = await p.evaluate(async () => { const keep = {}; ['aikeys_gemini', 'asst_hist_v1', 'live_note', 'live_on', 'live_voice'].forEach(k => keep[k] = localStorage.getItem(k)); localStorage.setItem('aikeys_gemini', JSON.stringify([{ key: 'AIzaLIVE000000' }])); localStorage.setItem('live_note', '1');
          localStorage.removeItem('live_on'); localStorage.removeItem('live_voice'); const tg = document.getElementById('live-on-tg'); const def = { sup: liveSup(), tg: tg && tg.checked }; asstOpen(); def.btn = !!document.getElementById('asst-livebtn'); asstClose(); liveOnSet(true);
          const W0 = window.WebSocket, gum = navigator.mediaDevices.getUserMedia, socks = [], acs = [];
          class FW { constructor(u) { this.u = u; this.sent = []; this.readyState = 0; socks.push(this); setTimeout(() => { this.readyState = 1; this.onopen && this.onopen(); }, 10); }
            send(x) { const j = JSON.parse(x); this.sent.push(j); if (j.setup) setTimeout(() => { if (/3\.8/.test(j.setup.model)) { this.readyState = 3; this.onclose && this.onclose({ code: 1008, reason: 'model not found' }); } else this.emit({ setupComplete: {} }); }, 10); }
            emit(j) { this.onmessage && this.onmessage({ data: JSON.stringify(j) }); } close() { this.readyState = 3; this.onclose && this.onclose({ code: 1000 }); } }
          window.WebSocket = FW;
          navigator.mediaDevices.getUserMedia = async () => { const ac = new AudioContext(); acs.push(ac); const o = ac.createOscillator(), d = ac.createMediaStreamDestination(); o.connect(d); o.start(); return d.stream; };
          const W = ms => new Promise(z => setTimeout(z, ms));
          try { asstOpen(); ASST.msgs = []; const btn = !!document.getElementById('asst-livebtn'); liveToggle(); await W(1200);
            const ws = socks[socks.length - 1], setup = ws.sent[0].setup, audio = ws.sent.filter(x => x.realtimeInput);
            const tools = setup.tools[0].functionDeclarations.map(f => f.name), hasAct = setup.tools[0].functionDeclarations.some(f => (ASST_TOOLS[f.name] || {}).act);
            ws.emit({ serverContent: { inputTranscription: { text: 'مين الغايب ' } } }); ws.emit({ serverContent: { inputTranscription: { text: 'اليوم؟' } } });
            ws.emit({ toolCall: { functionCalls: [{ id: 'c1', name: 'attendance_day', args: {} }, { id: 'c2', name: 'record_attendance', args: { students: [STUDENTS[0].name], status: 'غائب' } }] } }); await W(300);
            const tr = ws.sent.find(x => x.toolResponse), resp = tr && tr.toolResponse.functionResponses;
            const cm = ASST.msgs.find(m => m.cards && m.cards.length), card = cm ? [cm.cards[0].action, cm.cards[0].state, /بطاقة تأكيد/.test(resp[1].response.result)] : null; ASST.msgs = ASST.msgs.filter(m => !m.cards);
            const nt = ws.sent.length; ws.emit({ toolCall: { functionCalls: [{ id: 'n1', name: 'open_page', args: { page: 'schedule' } }] } }); await W(1200);
            const nr = ws.sent.slice(nt).find(x => x.toolResponse), nav = { tab: CT_TAB, ct: document.getElementById('p-classtools').classList.contains('on'), panel: document.getElementById('asst-panel').classList.contains('on'), live: LIVE.on, pulse: document.getElementById('asst-btn').classList.contains('live-on'), opened: !!(nr && /opened/.test(nr.toolResponse.functionResponses[0].response.result)), cards: ASST.msgs.filter(m => m.cards && m.cards.some(c => c.action === 'nav')).length };
            asstOpen(); try { goTab('dashboard'); } catch (e) {} asstOpen();
            ws.emit({ serverContent: { inputTranscription: { text: 'افتح مدرستي.' } } }); ws.emit({ serverContent: { outputTranscription: { text: 'فتحت لك صفحة مدرستي.' } } }); await W(800);
            const local = { madrasati: document.getElementById('p-madrasati').classList.contains('on'), panel: document.getElementById('asst-panel').classList.contains('on'), live: LIVE.on };
            ws.emit({ serverContent: { turnComplete: true } }); asstOpen(); try { goTab('dashboard'); } catch (e) {} asstOpen(); ASST.msgs = ASST.msgs.filter(m => !/مدرستي/.test(m.text || ''));
            ws.emit({ serverContent: { inputTranscription: { text: 'Ateho Mohammedia' } } }); ws.emit({ serverContent: { outputTranscription: { text: 'ما سمعتك زين' } } }); const latin = ASST.msgs.some(m => m.me && /ما انكتب بالعربي/.test(m.html)); ws.emit({ serverContent: { turnComplete: true } });
            ASST.msgs = ASST.msgs.filter(m => !/Ateho|ما سمعتك/.test(m.text || ''));
            ws.emit({ serverContent: { outputTranscription: { text: 'ما فيه غياب اليوم.' }, modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: btoa(String.fromCharCode(...new Uint8Array(4800))) } }] } } });
            const speaking = LIVE.state, msgs = ASST.msgs.map(m => (m.me ? 'M:' : 'B:') + m.text);
            const k0 = ws.sent.filter(x => x.realtimeInput).length; await W(400); const duringSpeak = ws.sent.filter(x => x.realtimeInput).length - k0;
            liveCut(); ws.emit({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: btoa(String.fromCharCode(...new Uint8Array(4800))) } }] } } }); const afterCut = [LIVE.srcs.length, LIVE.state];
            const k1 = ws.sent.filter(x => x.realtimeInput).length; await W(400); const resumed = ws.sent.filter(x => x.realtimeInput).length - k1;
            ws.emit({ serverContent: { turnComplete: true } }); liveToggle(); await W(50);
            const ctx1 = window.__c1 = LIVE.ctx; const n0 = socks.length; liveToggle(); await W(900); const ws2 = socks[socks.length - 1], ctx2 = LIVE.ctx;
            const second = { newCtx: !!ctx2 && ctx2 !== ctx1, audio: ws2.sent.filter(x => x.realtimeInput).length, on: LIVE.on }; liveToggle(); await W(50);
            let silent = 0; navigator.mediaDevices.getUserMedia = async () => { silent++; const ac = new AudioContext(); acs.push(ac); return ac.createMediaStreamDestination().stream; };
            ASST_MLOG.length = 0; liveToggle(); await W(9000); const sil = { gums: silent, retried: ASST_MLOG.some(x => /أعيد الميكروفون/.test(x)), off: !LIVE.on };
            return { def, btn, langs: socks.slice(0, 4).map(x => [((((x.sent[0] || {}).setup || {}).generationConfig || {}).speechConfig || {}).languageCode || null, ((((x.sent[0] || {}).setup || {}).inputAudioTranscription || {}).languageCodes || [])[0] || null]), voice: setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, arOnly: /بالعربية دائمًا/.test(setup.systemInstruction.parts[0].text), models: socks.slice(0, 4).map(x => (x.sent[0] || {}).setup && x.sent[0].setup.model), key: /key=AIzaLIVE000000/.test(ws.u), audio: audio.length, mime: audio[0] && audio[0].realtimeInput.audio.mimeType, tools, hasAct, sys: /بطاقة/.test(setup.systemInstruction.parts[0].text) && /لا تقل أبدًا إنك نفّذت/.test(setup.systemInstruction.parts[0].text), scoresSchema: ((setup.tools[0].functionDeclarations.find(f => f.name === 'record_exam_score').parameters.properties.scores || {}).items || {}).type, card, latin,
              resp: resp && resp.map(x => [x.id, /error/.test(x.response.result)]), noIds: resp && !STUDENTS.some(s => resp[0].response.result.includes('"' + s.id + '"')), speaking, msgs, nav, local, duringSpeak, afterCut, resumed, after: [LIVE.on, !!LIVE.stream, ws.readyState], second, sil }; }
          finally { window.WebSocket = W0; navigator.mediaDevices.getUserMedia = gum; acs.forEach(a => a.close().catch(() => {})); try { LIVE.ctx && LIVE.ctx.close(); LIVE.ctx = null; } catch (e) {} asstClose(); ASST.msgs = []; Object.entries(keep).forEach(([k, v]) => v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v)); } });
        eq(r.def, { sup: false, tg: false, btn: false }, 'مقفولة افتراضيًا'); ok(r.btn, 'زر المحادثة الحية'); eq(r.models, ['models/gemini-3.8-live', 'models/gemini-3.8-live', 'models/gemini-3.8-live', 'models/gemini-3.1-flash-live-preview'], 'النموذج والبديل'); eq(r.langs, [['ar-XA', 'ar'], ['ar-XA', null], [null, null], ['ar-XA', 'ar']], 'العربية (وإعادة بأقل إن رُفضت)'); eq(r.voice, 'Charon', 'صوت رجل افتراضيًا'); ok(r.arOnly, 'تعليمات اللغة'); ok(r.key, 'المفتاح');
        ok(r.audio >= 3, 'صوت الميكروفون: ' + r.audio); eq(r.mime, 'audio/pcm;rate=16000', 'صيغة الصوت'); ok(r.tools.includes('attendance_day') && r.tools.includes('record_attendance') && r.tools.includes('adjust_points') && r.hasAct, 'كل الأدوات'); ok(r.sys, 'تعليمات البطاقات'); eq(r.scoresSchema, 'OBJECT', 'مخطط الدرجات');
        eq(r.resp, [['c1', false], ['c2', false]], 'الرد على الأدوات'); eq(r.card, ['record', 'ask', true], 'بطاقة التأكيد من المحادثة الحية'); ok(r.latin, 'النسخ اللاتيني'); ok(r.noIds, 'وصل معرّف طالب'); eq(r.speaking, 'speak', 'تشغيل الصوت'); eq(r.local, { madrasati: true, panel: false, live: true }, '«افتح مدرستي» بالكلام يُفتح محليًا ولو لم يستدعِ Gemini الأداة'); eq(r.nav, { tab: 'schedule', ct: true, panel: false, live: true, pulse: true, opened: true, cards: 0 }, 'فتح صفحة من المحادثة الحية فورًا والمحادثة مستمرة'); eq(r.duringSpeak, 0, 'أرسل الميكروفون وهو يتكلم (صدى)'); eq(r.afterCut, [0, 'listen'], '✋ قاطعه'); ok(r.resumed >= 2, 'عاد الميكروفون بعد المقاطعة: ' + r.resumed);
        eq(r.msgs, ['M:مين الغايب اليوم؟', 'B:ما فيه غياب اليوم.'], 'نص المحادثة'); eq(r.after, [false, false, 3], 'الإنهاء'); ok(r.second.newCtx && r.second.audio >= 3, 'الجلسة الثانية: ' + JSON.stringify(r.second)); eq(r.sil, { gums: 2, retried: true, off: true }, 'صمت تام ← إعادة مرة ثم إيقاف'); eq(errs, [], 'أخطاء'); });
      await S.t('🧪 مساعدي — فحص شامل: كل أداة تعمل بلا أخطاء، كل أمر له بطاقة ترسم، كل أداة معرَّفة للمحادثة الحية بمخطط صحيح، والأمر الكلامي بلا أداة يمر بمساعدي العادي', async () => {
        const r = await p.evaluate(async () => { if (!CT_DATA) { try { await ctLoad(); } catch (e) {} } const s0 = STUDENTS[0], cls = s0.cls, rc = window.readingAICall;
          window.readingAICall = async () => JSON.stringify({ questions: [{ t: 'tf', q: 'س', a: true }] });
          const H = { id: 'hwAUD', sid: 'pubAUD', title: 'نشاط الفحص الشامل', due: '2026-12-01', max: 10, qs: [{ t: 'tf', q: 'س١', a: true }, { t: 'tf', q: 'س٢', a: false }], subs: { [s0.id]: { correct: 1, total: 2, d: '10' } }, published: true, at: Date.now() }; HW.push(H);
          const A = { student: s0.name, students: [s0.name], cls, activity: 'الفحص الشامل', test: 'آخر', day: 'اليوم', topic: 'الخلية', status: 'غائب', type: 'positive', note: 'تميز', delta: 2, scores: [{ student: s0.name, score: 5 }],
            title: 'تذكير فحص', body: 'نص', to: 'students', due: 'بكرة', page: 'home', name: 'اختصار فحص', command: 'مين الغايب اليوم؟', reply: 'تمام', max: 10, reason: 'absence', classes: asstClsList(), date: 'بكرة', time: '10:00', by: 'total' };
          const bad = [], cards = [], acts = new Set();
          for (const [k, t] of Object.entries(ASST_TOOLS)) { let res; try { res = await t.run({ ...A }); } catch (e) { bad.push(k + ': ' + e.message); continue; }
            if (!res || typeof res !== 'object') { bad.push(k + ': لا نتيجة'); continue; }
            try { t.src({ ...A }); } catch (e) { bad.push(k + ' src: ' + e.message); }
            if (t.act && res.action) { acts.add(res.action); if (!ASST_ACTS.includes(res.action)) bad.push(k + ': action خارج القائمة ' + res.action);
              const h = asstCardHTML({ ...res, state: 'ask' }, 0, 0); if (!/asst-card/.test(h) || h.replace(/<[^>]+>/g, '').trim().length < 3) cards.push(k); } }
          HW.splice(HW.indexOf(H), 1); window.readingAICall = rc; try { ckStop(); ckClose(); } catch (e) {}
          const decl = liveTools(), types = new Set(['STRING', 'NUMBER', 'BOOLEAN', 'ARRAY', 'OBJECT']), dbad = [];
          decl.forEach(f => { if (!f.name || !f.description) dbad.push(f.name); Object.entries((f.parameters || {}).properties || {}).forEach(([n, v]) => { if (!types.has(v.type) || (v.type === 'ARRAY' && !v.items)) dbad.push(f.name + '.' + n); }); });
          const sent = [], ask = window.asstAsk; window.asstAsk = (q, o) => sent.push([q, !!(o && o.live)]); const on = LIVE.on; LIVE.on = true;
          LIVE.said = 'سجّل ' + s0.name + ' غايب'; LIVE.acted = false; LIVE.navd = false; liveLocalAct();
          LIVE.said = 'مين الغايب اليوم؟'; LIVE.acted = false; liveLocalAct(); LIVE.said = 'زيد ' + s0.name + ' خمس نقاط'; LIVE.acted = true; liveLocalAct();
          LIVE.on = on; LIVE.said = ''; window.asstAsk = ask;
          return { bad, cards, dbad, n: [decl.length, Object.keys(ASST_TOOLS).length], acts: [...acts].sort(), sent }; });
        eq(r.bad, [], 'أدوات فيها خطأ'); eq(r.cards, [], 'بطاقات لا ترسم'); eq(r.dbad, [], 'تعريفات المحادثة الحية'); eq(r.n[0], r.n[1] + 1, 'كل الأدوات في المحادثة الحية (+ confirm_card)');
        ok(r.acts.length >= 15, 'الأوامر المجرَّبة: ' + r.acts.join(','));
        eq(r.sent.length, 1, 'الأمر بلا أداة يمر بمساعدي مرة واحدة فقط (لا للأسئلة ولا إن استُدعيت الأداة)'); eq(r.sent[0][1], true, 'بلا فقاعة مكررة ولا صوت'); eq(errs, [], 'أخطاء'); });
      await S.t('🧰 أدوات الحصة في «الرصد»: زر واحد في شريطه لا يغيّر شيئًا آخر، «مين يجاوب» بلا تكرار ولا يختار الغائب، مجموعات متوازنة من الحاضرين، مؤقت ينبّه ويبقى صغيرًا، و«مين يجاوب؟» بالكلام بلا ذكاء', async () => {
        let ai = 0; await p.route(/generativelanguage\.googleapis\.com/, r => { ai++; r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
        const r = await p.evaluate(async () => { if (!CT_DATA) { try { await ctLoad(); } catch (e) {} } const W = ms => new Promise(z => setTimeout(z, ms));
          window._ctRcCls = 'أول 1'; window._ctRcClsUser = 1; window._ctRcView = 'day'; ctGo('records'); for (let k = 0; k < 40 && !document.querySelector('#qr-root .qr-bar'); k++) await W(200); const bar = document.querySelector('.qr-bar'), kit = document.getElementById('qr-kit'), others = bar ? [...bar.children].filter(x => x.id !== 'qr-kit').length : -1;
          const cls = qrCls() || STUDENTS[0].cls, R = ctRoster(cls), d = ctToday(), keep = JSON.stringify(((CT_DATA.participation || {})[d]) || {});
          CT_DATA.participation = CT_DATA.participation || {}; CT_DATA.participation[d] = CT_DATA.participation[d] || {}; const ab = R[0]; CT_DATA.participation[d][ab.id] = { status: 'غائب', at: 1 };
          ckSavePicked(cls, new Set()); kit && kit.click(); await W(100); const opened = document.getElementById('ck').classList.contains('on');
          const seen = []; for (let i = 0; i < R.length - 1; i++) seen.push(String(ckPick(cls).id)); await W(900);
          const pick = { noAbsent: !seen.includes(String(ab.id)), unique: new Set(seen).size === seen.length, all: seen.length === R.length - 1 };
          const G = ckGroups(2, 'mix', cls); const grp = { n: G.length === Math.min(2, R.length - 1), total: G.reduce((t, g) => t + g.length, 0), even: Math.max(...G.map(g => g.length)) - Math.min(...G.map(g => g.length)) <= 1, noAbsent: !G.flat().some(s => s.id === ab.id) };
          let rang = 0; const rg = window.ckRing; window.ckRing = () => { rang++; }; ckTimer(1); ckClose(); await W(400); const pill = !!document.getElementById('ck-pill'); await W(1200); window.ckRing = rg;
          ckOpen('pick', cls); ckClose();
          asstOpen(); ASST.msgs = []; await asstAsk('مين يجاوب؟'); const m = ASST.msgs[ASST.msgs.length - 1], voice = { name: R.some(s => m.text && m.text.includes(s.name)), ck: document.getElementById('ck').classList.contains('on'), src: m.src.join(' ') };
          ckClose(); asstClose(); ASST.msgs = []; CT_DATA.participation[d] = JSON.parse(keep); ckSavePicked(cls, new Set()); try { goTab('dashboard'); } catch (e) {}
          return { bar: !!bar, kit: !!kit, others, opened, pick, grp, rang, pill, voice, n: R.length }; });
        await p.unroute(/generativelanguage\.googleapis\.com/);
        ok(r.bar && r.kit && r.opened, 'زر أدوات الحصة'); eq(r.others, 3, 'شريط الرصد: البحث والمايك والتاريخ كما هي'); eq(r.pick, { noAbsent: true, unique: true, all: true }, 'مين يجاوب');
        eq(r.grp, { n: true, total: r.n - 1, even: true, noAbsent: true }, 'المجموعات'); eq([r.pill, r.rang], [true, 1], 'المؤقت'); ok(r.voice.name && r.voice.ck && /فوري/.test(r.voice.src), 'بالكلام: ' + JSON.stringify(r.voice)); eq(errs, [], 'أخطاء'); });
      await S.t('🆕 مساعدي — الدفعة الخامسة: الأحق بالمتابعة، ملخص الأسبوع، تحضير درس، تقارير الفترة لأولياء الأمور، تصدير، بحث الرسائل، اقتراح مسودة بعد رصد الغياب، و«نفّذ» بالصوت في المحادثة الحية (لا للرسائل)', async () => {
        const r = await p.evaluate(async () => { if (!CT_DATA) { try { await ctLoad(); } catch (e) {} } const s0 = STUDENTS[0], cls = s0.cls, D = CT_DATA, out = {}, rc = window.readingAICall, ex = window.exportGrades, al = window.asksLoad;
          const days = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']; D.participation = D.participation || {}; days.forEach(d => { D.participation[d] = D.participation[d] || {}; D.participation[d][s0.id] = { status: 'غائب', at: 1 }; });
          const risk = await ASST_TOOLS.at_risk.run({ days: 3650 }); out.risk = (risk.students || []).some(x => x.name === s0.name);
          const wk = await ASST_TOOLS.weekly_report.run({ cls }); out.week = !!(wk && wk.cls && Array.isArray(wk.activities_due_this_week));
          window.readingAICall = async () => JSON.stringify({ objectives: ['يعرّف الخلية'], warmup: 'سؤال', steps: [{ min: 10, do: 'شرح' }], exit_ticket: ['ما الخلية؟'], homework: 'رسم', materials: ['مجهر'] });
          const lp = await ASST_TOOLS.lesson_plan.run({ topic: 'الخلية' }); out.plan = [lp.objectives && lp.objectives.length, lp.minutes];
          const pr = await ASST_TOOLS.period_reports.run({ cls }); out.reports = [pr.action, pr.reason, pr.items.length === STUDENTS.filter(x => x.cls === cls).length, /السلام عليكم/.test(pr.items[0].text)];
          let exp = 0; window.exportGrades = async () => { exp++; }; const eg = await ASST_TOOLS.export_grades.run({ cls }); out.exp = [exp, !!eg.exported]; try { goTab('dashboard'); } catch (e) {}
          window.asksLoad = async () => { ASKS = [{ id: 'q9', name: s0.name, cls, text: 'متى الاختبار القصير؟', status: 'open', at: 1 }, { id: 'q8', name: 'x', text: 'سؤال آخر', status: 'done', at: 1 }]; };
          const sm = await ASST_TOOLS.search_messages.run({ query: 'الاختبار' }); out.search = sm.found;
          // اقتراح بعد رصد الغياب
          const cl = window.ctLoad; window.ctLoad = async () => CT_DATA;   // تزامن الخلفية لا يمسح الغيابات المحقونة أثناء الاختبار
          const D5 = CT_DATA; D5.participation = D5.participation || {}; days.forEach(d => { D5.participation[d] = D5.participation[d] || {}; D5.participation[d][s0.id] = { status: 'غائب', at: 1 }; });   // فتح اللوحة قد يستبدل CT_DATA؛ نحقن في الحالي
          asstOpen(); ASST.msgs = []; const rec = await ASST_TOOLS.record_attendance.run({ students: [s0.name], status: 'غائب' }); try { localStorage.setItem('asst_brief_seen', asstToday()); } catch (e) {} ASST.msgs.push({ html: 'x', cards: [{ ...rec, state: 'ask' }] }); const ri = ASST.msgs.length - 1; asstAct(ri, 0, 'do'); await new Promise(z => setTimeout(z, 1200));
          const hint = ASST.msgs.find(m => /3 غيابات/.test(m.html || '')); out.hint = !!(hint && hint.cards[0].action === 'drafts'); asstAct(ri, 0, 'undo'); window.ctLoad = cl;
          // «نفّذ» بالصوت
          ASST.msgs = []; const pts = await ASST_TOOLS.adjust_points.run({ students: [s0.name], delta: 3 }), k0 = s0.points; ASST.msgs.push({ html: 'x', cards: [{ ...pts, state: 'ask' }] }); const pi = ASST.msgs.length - 1;
          LIVE.said = 'كم نقاطه'; const no1 = liveConfirm(); LIVE.said = 'تمام نفّذ'; const yes = liveConfirm(); await new Promise(z => setTimeout(z, 600)); const after = ASST.msgs[pi].cards[0].state;
          asstAct(pi, 0, 'undo'); const msg = await ASST_TOOLS.send_message.run({ to: 'students', students: [s0.name], title: 't', body: 'b' }); ASST.msgs.push({ html: 'x', cards: [{ ...msg, state: 'ask' }] }); const no2 = liveConfirm();
          out.voice = [!!no1.error, yes.done, after, !!no2.error]; LIVE.said = ''; s0.points = k0;
          [D, CT_DATA].forEach(X => days.forEach(d => { if (X && X.participation && X.participation[d]) delete X.participation[d][s0.id]; })); window.readingAICall = rc; window.exportGrades = ex; window.asksLoad = al; asstClose(); ASST.msgs = []; return out; });
        eq(r, { risk: true, week: true, plan: [1, 45], reports: ['drafts', 'report', true, true], exp: [1, true], search: 1, hint: true, voice: [true, 'points', 'done', true] }, 'الدفعة الخامسة'); eq(errs, [], 'أخطاء'); });
      await S.t('🆕 مساعدي — الدفعة السادسة: الواجب اليومي، ما ينتظر المراجعة، المستويات، سجل طالب، إحصاء الأنشطة، المشاريع، المتجر، مرشّحو الشهادات، تعيين مسؤول بتأكيد، وتذكير أسبوعي متكرر', async () => {
        const r = await p.evaluate(async () => { if (!CT_DATA) { try { await ctLoad(); } catch (e) {} } const S = STUDENTS, s0 = S[0], s1 = S[1], cls = s0.cls, D = CT_DATA, out = {}, d = asstToday();
          D.homework = D.homework || {}; const h0 = D.homework[d]; D.homework[d] = { [s0.id]: { status: 'أنجز', at: 1 }, [s1.id]: { status: 'لم ينجز', at: 1 } };
          const hw = await ASST_TOOLS.homework_day.run({}); out.hw = [hw.done >= 1, hw.not_done.some(x => x.name === s1.name), hw.recorded >= 2];
          const fh = { id: 'hwAS6', sid: 'pubAS6', kind: 'files', title: 'رفع ملف الدفعة السادسة', max: 10, subs: { [s0.id]: { at: Date.now(), files: [{ n: 'a.pdf' }] } }, published: true, at: Date.now() }; HW.push(fh);
          const pP = PROJECTS_DATA, pS = STORE_PURCHASES; PROJECTS_DATA = [{ title: 'مشروع البيئة', studentName: s0.name, reviewStatus: 'pending', at: 1 }, { title: 'مشروع البيئة', studentName: s1.name, at: 1 }];
          const pr = await ASST_TOOLS.pending_reviews.run({}); out.pending = [pr.file_activities.some(x => x.activity === fh.title && x.pending === 1), pr.projects[0] && pr.projects[0].pending];
          const ps = await ASST_TOOLS.projects_status.run({ project: 'البيئة' }); out.proj = [ps.projects[0].submitted, ps.projects[0].pending];
          const lv = await ASST_TOOLS.levels_overview.run({ cls }); out.levels = !!(lv.levels && lv.levels.reduce((n, x) => n + x.count, 0) > 0);
          const tl = await ASST_TOOLS.student_timeline.run({ student: s0.name }); out.timeline = [tl.name, tl.last_submissions.some(x => x.title === fh.title)];
          const as = await ASST_TOOLS.activity_stats.run({}); out.stats = Array.isArray(as.activities);
          STORE_PURCHASES = [{ name: s0.name, kind: 'exam-bonus', price: 30, add: 2, at: Date.now() }, { name: s1.name, card: 'hwforgive', kind: 'purchase', price: 10, hwTitle: 'واجب الخلية', at: Date.now() - 1000 }];
          const sp = await ASST_TOOLS.store_purchases.run({}); out.store = [sp.count, sp.spent, /درجة/.test(sp.purchases[0].item), /واجب الخلية/.test(sp.purchases[1].item) && !/عنصر/.test(sp.purchases[1].item)];
          const cc = await ASST_TOOLS.certificate_candidates.run({ cls }); out.cert = Array.isArray(cc.candidates);
          asstOpen(); ASST.msgs = []; const du = await ASST_TOOLS.assign_duty.run({ student: s0.name, title: 'مسؤول السبورة' }); ASST.msgs.push({ html: 'x', cards: [{ ...du, state: 'ask' }] }); const di = ASST.msgs.length - 1; asstPaint();
          const card = /مسؤول السبورة/.test(document.getElementById('asst-msgs').innerHTML); asstAct(di, 0, 'do'); await new Promise(z => setTimeout(z, 600));
          const role = (CT_DATA.roles || []).find(x => x && x.active && x.title === 'مسؤول السبورة' && x.cls === cls); out.duty = [du.action, card, ASST.msgs[di].cards[0].state, role && String(role.studentId) === String(s0.id)];
          const rm = await ASST_TOOLS.reminder.run({ title: 'تحضير الدرس', time: '07:00', weekly: ['الأحد', 'الثلاثاء'] }), ev = await ASST_TOOLS.reminder.run({ title: 'x', time: '07:00', weekly: ['كل يوم'] });
          out.weekly = [rm.days, rm.weeklyLabel, ev.days.length];
          if (role) await ctSave(D2 => { D2.roles = (D2.roles || []).filter(x => x.title !== 'مسؤول السبورة'); });
          HW.splice(HW.indexOf(fh), 1); if (h0) D.homework[d] = h0; else delete D.homework[d]; PROJECTS_DATA = pP || []; STORE_PURCHASES = pS || []; asstClose(); ASST.msgs = []; return out; });
        eq(r, { hw: [true, true, true], pending: [true, 1], proj: [2, 1], levels: true, timeline: [r.timeline[0], true], stats: true, store: [2, 40, true, true], cert: true, duty: ['duty', true, 'done', true], weekly: [[0, 2], 'كل الأحد والثلاثاء', 5] }, 'الدفعة السادسة'); eq(errs, [], 'أخطاء'); });
      await S.t('🆕 مساعدي — الدفعة السابعة: مجموع الواجب والمشاركة، أيام لم تُرصد، سجل التواصل، الملاحظات الخاصة، مقارنة طالبين، وتسجيل تواصل/ملاحظة بتأكيد وتراجع، وإنهاء مهمة', async () => {
        const r = await p.evaluate(async () => { if (!CT_DATA) { try { await ctLoad(); } catch (e) {} } const S = STUDENTS, s0 = S[0], s1 = S[1], cls = s0.cls, D = CT_DATA, out = {}, d = asstToday();
          const cl = window.ctLoad; window.ctLoad = async () => CT_DATA; D.homework = D.homework || {}; D.participation = D.participation || {};
          const h0 = D.homework[d], p0 = D.participation[d]; D.homework[d] = { [s0.id]: { status: 'لم ينجز', at: 1 } }; D.participation[d] = { [s0.id]: { status: 'شارك', at: 1 }, [s1.id]: { status: 'لم يشارك', at: 1 } };
          const ht = await ASST_TOOLS.homework_totals.run({ cls }); out.hwt = ht.students.some(x => x.name === s0.name && x.not_done >= 1);
          const pt = await ASST_TOOLS.participation_totals.run({ cls, order: 'desc', n: 50 }); out.part = pt.students.find(x => x.name === s0.name).participated >= 1 && pt.students.find(x => x.name === s1.name).not_participated >= 1;
          const ud = await ASST_TOOLS.unrecorded_days.run({ cls, days: 7 }); out.unrec = [ud.classes.length, ud.classes[0].attendance_not_recorded.includes(d), ud.classes[0].attendance_not_recorded.every(x => new Date(x + 'T00:00:00Z').getUTCDay() <= 4)];
          const cs = await ASST_TOOLS.compare_students.run({ students: [s0.name, s1.name] }); out.cmp = cs.students.map(x => x.name);
          asstOpen(); ASST.msgs = []; const push = c => { ASST.msgs.push({ html: 'x', cards: [{ ...c, state: 'ask' }] }); asstPaint(); return ASST.msgs.length - 1; }, wait = ms => new Promise(z => setTimeout(z, ms));
          const lc = await ASST_TOOLS.log_contact.run({ students: [s0.name], channel: 'واتساب', reason: 'غياب', result: 'وعد بالمتابعة' }); const ci = push(lc); const card = /وعد بالمتابعة/.test(document.getElementById('asst-msgs').innerHTML);
          asstAct(ci, 0, 'do'); await wait(600); const cl1 = await ASST_TOOLS.contacts_log.run({ student: s0.name }); out.contact = [lc.channel, lc.reason, card, ASST.msgs[ci].cards[0].state, cl1.contacts.some(x => x.result === 'وعد بالمتابعة')];
          asstAct(ci, 0, 'undo'); await wait(600); out.contactUndo = [ASST.msgs[ci].cards[0].state, (await ASST_TOOLS.contacts_log.run({ student: s0.name })).contacts.some(x => x.result === 'وعد بالمتابعة')];
          const nt = await ASST_TOOLS.add_note.run({ student: s0.name, text: 'يحتاج الجلوس في الأمام' }); const ni = push(nt); asstAct(ni, 0, 'do'); await wait(600);
          const sn = await ASST_TOOLS.student_notes.run({ student: s0.name }); out.note = [nt.items.length, sn.notes.some(x => x.text === 'يحتاج الجلوس في الأمام')]; asstAct(ni, 0, 'undo'); await wait(600);
          const du = await ASST_TOOLS.assign_duty.run({ student: s1.name, title: 'مسؤول النظافة' }), di = push(du); asstAct(di, 0, 'do'); await wait(600);
          const ed = await ASST_TOOLS.end_duty.run({ student: s1.name, title: 'النظافة' }), ei = push(ed); asstAct(ei, 0, 'do'); await wait(600);
          out.end = [ed.action, ed.name, ASST.msgs[ei].cards[0].state, (CT_DATA.roles || []).some(x => x && x.active && x.title === 'مسؤول النظافة')];
          await ctSave(D2 => { D2.roles = (D2.roles || []).filter(x => x.title !== 'مسؤول النظافة'); });
          if (h0) D.homework[d] = h0; else delete D.homework[d]; if (p0) D.participation[d] = p0; else delete D.participation[d]; window.ctLoad = cl; asstClose(); ASST.msgs = []; return out; });
        eq(r, { hwt: true, part: true, unrec: [1, false, true], cmp: [r.cmp[0], r.cmp[1]], contact: ['واتساب', 'غياب متكرر', true, 'done', true], contactUndo: ['undone', false], note: [1, true], end: ['enddty', r.end[1], 'done', false] }, 'الدفعة السابعة');
        eq(r.cmp.length === 2 && r.cmp.every(Boolean) && r.end[1] !== '—', true, 'أسماء'); eq(errs, [], 'أخطاء'); });
      await S.t('🎤 مساعدي: الميكروفون مثل «الرصد بالصوت» — ضغطة تفتح الاستماع ويبقى مفتوحًا، كل جملة تُرسل بعد سكوت قصير بلا كتم بينها، وضغطة ثانية توقف؛ وعلى iPhone لا يُلمس الصوت والاستماع مفتوح', async () => {
        const r = await p.evaluate(async () => { const go = HWV.go, mute = HWV.mute, ask = asstAsk; let owner = null, gos = 0, mutes = 0; const sent = [];
          HWV.go = o => { gos++; owner = o; o.on = true; return true; }; HWV.mute = o => { mutes++; if (o) o.on = false; }; window.asstAsk = q => { sent.push(q); };
          try { asstOpen(); const W = ms => new Promise(z => setTimeout(z, ms));
            asstMic(); owner.onText('مين الغايب', false); owner.onText('مين الغايب اليوم', true); await W(600); const early = sent.length; await W(900);
            owner.onText('أضعف مهارة', true); await W(1500); owner.onText('افتح دفتر', false);
            const mid = { on: document.getElementById('asst-mic').classList.contains('on') && !!ASST_MIC, mutes, gos, ownerOn: owner.on };
            asstMic(); const stopped = { mic: !!ASST_MIC, mutes };
            const ios0 = HWV.ios, d0 = Object.getOwnPropertyDescriptor(HWV, 'active'); let cancels = 0, speaks = 0, plays = 0; const sc = speechSynthesis.cancel.bind(speechSynthesis), sp = speechSynthesis.speak.bind(speechSynthesis);
            speechSynthesis.cancel = () => { cancels++; }; speechSynthesis.speak = () => { speaks++; }; const tts = localStorage.getItem('asst_tts'); localStorage.setItem('asst_tts', '1');
            HWV.ios = true; Object.defineProperty(HWV, 'active', { get: () => true, configurable: true }); ASST_AUDIO = { play: () => { plays++; return Promise.resolve(); }, pause() {}, paused: true };
            asstMic(); asstAudioUnlock(); asstSpeakStop(); await asstSpeak('مرحبا يا معلم'); await W(30); const live = document.getElementById('asst-live').textContent; asstMic();
            const iosR = { cancels, speaks, plays, live: /أسمعك/.test(live) }; HWV.ios = ios0; Object.defineProperty(HWV, 'active', d0); speechSynthesis.cancel = sc; speechSynthesis.speak = sp; ASST_AUDIO = null; if (tts == null) localStorage.removeItem('asst_tts'); else localStorage.setItem('asst_tts', tts);
            asstClose(); return { sent, early, mid, stopped, iosR, left: !!ASST_MIC }; }
          finally { HWV.go = go; HWV.mute = mute; window.asstAsk = ask; } });
        eq(r.early, 0, 'أرسل قبل السكوت'); eq(r.sent, ['مين الغايب اليوم', 'أضعف مهارة', 'افتح دفتر'], 'ما أُرسل (والأخير عند الإيقاف)');
        eq(r.mid, { on: true, mutes: 0, gos: 1, ownerOn: true }, 'الاستماع بقي مفتوحًا بين الجمل بلا كتم ولا إعادة فتح'); eq(r.stopped, { mic: false, mutes: 1 }, 'الإيقاف');
        eq(r.iosR, { cancels: 0, speaks: 0, plays: 0, live: true }, 'iPhone: لا يُلمس الصوت والاستماع مفتوح'); eq(r.left, false, 'بقي مفتوحًا بعد الإغلاق'); eq(errs, [], 'أخطاء'); });
      await S.t('✨ مساعدي — صلاحيات موسّعة: دفتر الاختبارات، تحليل أسئلة التصحيح الآلي، المهارات، رصد درجة بتأكيد وتراجع، مسودة نشاط غير منشورة، التنقّل، والخطوات المتعددة', async () => {
        let plan = '', qgen = 0; try { await p.exposeFunction('__plan2', v => { plan = v; }); } catch (e) {}
        await p.route(/generativelanguage\.googleapis\.com/, async r => { const b = r.request().postData() || ''; let txt = plan;
          if (/أسئلة لنشاط طلاب/.test(b)) { qgen++; txt = JSON.stringify({ questions: [{ t: 'q', q: 'ما وحدة بناء الكائن الحي؟', o: ['الخلية', 'النسيج', 'العضو', 'الجهاز'], a: 0 }, { t: 'tf', q: 'للخلية النباتية جدار خلوي', a: true }, { t: 'q', q: 'سؤال ناقص', o: ['أ'], a: 0 }] }); }
          else if (/نتائج الأدوات/.test(b)) txt = '{"answer":"تم"}';
          r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: txt }] } }] }) }); });
        await p.route(/\/omr\/(papers\/full|get)\?/, r => { const u = r.request().url();
          if (/papers\/full/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, papers: [{ sid: 'S1', tpl: 'T1', model: 0, ch: [0, 1, 2] }, { sid: 'S2', tpl: 'T1', model: 0, ch: [0, 0, -1] }, { sid: 'S3', tpl: 'T1', model: 0, ch: [0, 1, 2] }] }) });
          r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, template: { models: [{ questions: [{ q: 'س1', key: 0 }, { q: 'س2', key: 1 }, { q: 'س3', key: 2, o: ['أول', 'ثاني', 'ثالث'] }] }] } }) }); });
        const r = await p.evaluate(async () => { const keep = {}; ['ai_provider_v1', 'aikeys_gemini', 'ai_routes_v1', 'ct_outbox_v1'].forEach(k => keep[k] = localStorage.getItem(k));
          localStorage.setItem('ai_provider_v1', 'gemini'); localStorage.setItem('aikeys_gemini', JSON.stringify([{ key: 'AIzaTEST0000000000' }])); localStorage.removeItem('ai_routes_v1');
          if (!CT_DATA) { try { await ctLoad(); } catch (e) {} } const { sem, per } = ctSemActive(), b = ctBook(CT_DATA, sem, per), s = STUDENTS.slice(0, 3), keepBook = JSON.stringify(b);
          const ids0 = s.map(x => x.id); s.forEach((x, n) => { x.__id = x.id; }); b.tests.push({ id: 'exAS1', title: 'اختبار الفترة الأولى', max: 20 });
          b.scores[s[0].id] = { exAS1: { score: 17, at: 1 } }; b.scores[s[1].id] = { exAS1: { absent: true, at: 1 } };
          const out = {}; out.sp = asstSP({}); out.due = [asstDue('الخميس'), asstDue('بكرة'), asstDue('2026-12-01'), asstDue('كلام')];
          const sc = await ASST_TOOLS.exam_scores.run({ test: 'الفترة الأولى' }); out.scores = [sc.scores && sc.scores.length, sc.absent && sc.absent.length, sc.max];
          // تحليل الأسئلة: الأوراق بمعرّفات الطلاب الحقيقية
          const realIds = { S1: s[0].id, S2: s[1].id, S3: s[2].id }; const of = window.fetch; window.fetch = (u, o) => of(String(u), o).then(async res => { if (!/papers\/full/.test(String(u))) return res; const j = await res.json(); j.papers.forEach(pp => pp.sid = realIds[pp.sid]); return new Response(JSON.stringify(j)); });
          const it = await ASST_TOOLS.exam_items.run({ test: 'الفترة الأولى' }), q2 = await ASST_TOOLS.exam_items.run({ test: 'الفترة الأولى', question: '٢' }); window.fetch = of;
          out.items = [it.papers, it.hardest_first && it.hardest_first[0].no, it.hardest_first && it.hardest_first[0].correct_pct]; out.q2 = [q2.question && q2.question[0].wrong.map(w => w.name + ':' + w.chose).join(), q2.question && q2.question[0].correct_pct];
          out.q3blank = ((await (async () => { window.fetch = (u, o) => of(String(u), o).then(async res => { if (!/papers\/full/.test(String(u))) return res; const j = await res.json(); j.papers.forEach(pp => pp.sid = realIds[pp.sid]); return new Response(JSON.stringify(j)); }); const x = await ASST_TOOLS.exam_items.run({ test: 'آخر', question: 3 }); window.fetch = of; return x; })()).question || [{}])[0];
          const sk = await ASST_TOOLS.skills.run({}); out.skills = !!(sk && (sk.skills || sk.error));
          // رصد درجة: بطاقة ← لا كتابة ← نفّذ ← تراجع
          asstOpen(); ASST.msgs = [];
          window.__plan2(JSON.stringify({ calls: [{ tool: 'record_exam_score', args: { test: 'اختبار الفترة الأولى', scores: [{ student: s[0].name, score: '١٨' }, { student: s[2].name, score: 25 }, { student: 'اسم غير موجود أبدا', score: 3 }] } }] }));
          await asstAsk('سجّل لهم درجات اختبار الفترة الأولى'); const m = ASST.msgs[ASST.msgs.length - 1], c = m.cards && m.cards[0], i = ASST.msgs.indexOf(m);
          out.card = c && [c.action, c.items.length, c.items[0].score, c.items[1].score, c.items[1].over, c.unresolved.length, c.state];
          out.pre = b.scores[s[0].id].exAS1.score; asstAct(i, 0, 'do');
          out.after = [b.scores[s[0].id].exAS1.score, b.scores[s[2].id].exAS1.score]; out.outbox = JSON.parse(localStorage.getItem('ct_outbox_v1') || '[]').some(o => o.k === 'exb' && o.book && o.book.tests.some(t => t.id === 'exAS1'));
          asstAct(i, 0, 'undo'); const b2 = ctBook(CT_DATA, sem, per); out.undone = [b2.scores[s[0].id].exAS1.score, !!b2.scores[s[2].id].exAS1.del];
          // مسودة نشاط: لا تُنشر
          const hw0 = HW.length; window.__plan2('{"calls":[{"tool":"create_activity","args":{"topic":"الخلية","n":10,"cls":"' + (s[0].cls || '') + '","due":"الخميس"}}]}');
          await asstAsk('سوّ نشاط عن الخلية'); const am = ASST.msgs[ASST.msgs.length - 1], ac = am.cards && am.cards[0], ai = ASST.msgs.indexOf(am);
          out.act = ac && [ac.action, ac.count, ac.due === asstDue('الخميس'), HW.length === hw0]; asstAct(ai, 0, 'do'); const h = HW[HW.length - 1];
          out.draft = [HW.length - hw0, h.title, h.qs.length, !!h.sid, !!h.published, h.cls === (s[0].cls || ''), h.due === asstDue('الخميس')]; HW.splice(HW.indexOf(h), 1); save(K.hw, HW); closeModal();
          // خطوات متعددة مرقّمة
          asstOpen(); window.__plan2(JSON.stringify({ calls: [{ tool: 'behavior_note', args: { students: [s[0].name], type: 'positive', note: 'تميز' } }, { tool: 'record_exam_score', args: { test: 'آخر', scores: [{ student: s[1].name, score: 10 }] } }, { tool: 'open_page', args: { page: 'exams' } }] }));
          await asstAsk('سجل له تميز وارصد درجة الثاني وافتح الدفتر'); const mm = ASST.msgs[ASST.msgs.length - 1]; out.steps = (mm.cards || []).map(x => x.action + '|' + x._step + '|' + x.state).join(',');
          out.stepsHtml = (document.getElementById('asst-msgs').innerHTML.match(/الخطوة \d من \d/g) || []).length;
          // تنقّل فوري بلا ذكاء
          await asstAsk('افتح ملف ' + s[2].name); const nm = ASST.msgs[ASST.msgs.length - 1]; await new Promise(z => setTimeout(z, 1200));
          out.nav = [nm.cards && nm.cards[0].action, nm.cards && nm.cards[0].state, nm.src.join(' '), true, String(window._ctPfSid) === String(s[2].id), document.getElementById('asst-panel').classList.contains('on')];
          asstClose(); ASST.msgs = []; try { closeModal(); } catch (e) {}
          const B = JSON.parse(keepBook), b3 = ctBook(CT_DATA, sem, per); b3.tests = B.tests; b3.scores = B.scores;
          Object.entries(keep).forEach(([k, v]) => v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v));
          return out; });
        await p.unroute(/generativelanguage\.googleapis\.com/); await p.unroute(/\/omr\/(papers\/full|get)\?/);
        ok(r.due[0] && r.due[1] && r.due[2] === '2026-12-01' && r.due[3] === '', 'المواعيد: ' + r.due);
        eq(r.scores, [1, 1, 20], 'درجات الاختبار'); eq(r.items, [3, 2, 67], 'تحليل الأسئلة'); eq(r.q2[1], 67, 'نسبة س2'); ok(/أ$/.test(r.q2[0]), 'من أخطأ في س2: ' + r.q2[0]);
        eq((r.q3blank.blank || []).length, 1, 'من ترك س3'); ok(r.skills, 'المهارات');
        eq(r.card, ['exam', 2, 18, 20, 25, 1, 'ask'], 'بطاقة الدرجات'); eq(r.pre, 17, 'كُتب قبل التأكيد'); eq(r.after, [18, 20], 'الرصد'); ok(r.outbox, 'طابور الدفتر'); eq(r.undone, [17, true], 'التراجع');
        eq(r.act, ['activity', 2, true, true], 'بطاقة النشاط'); eq(r.draft, [1, 'الخلية', 2, false, false, true, true], 'المسودة');
        eq(r.steps, 'behavior|1 من 3|ask,exam|2 من 3|ask,nav|3 من 3|ask', 'الخطوات'); eq(r.stepsHtml, 3, 'ترقيم الخطوات');
        eq(r.nav.slice(0, 2), ['nav', 'done'], 'التنقّل'); ok(/فوري/.test(r.nav[2]) && r.nav[3] && r.nav[4] && !r.nav[5], 'افتح ملف: ' + r.nav); eq(errs, [], 'أخطاء'); });
      await S.t('🔊 مساعدي يقرأ بصوت ElevenLabs عبر الخادم (k=asst)، ويعود لصوت الجهاز إن لم يُفعَّل', async () => {
        const urls = []; let mode = 200;
        await p.route(/workers\.dev\/tts\?/, r => { urls.push(r.request().url()); r.fulfill(mode === 200 ? { status: 200, contentType: 'audio/mpeg', body: Buffer.from([0]) } : { status: 404, contentType: 'application/json', body: '{"error":"tts_off"}' }); });
        const r = await p.evaluate(async () => { const k = localStorage.getItem('asst_tts'); localStorage.setItem('asst_tts', '1');
          const def = !asstElOn() && !document.getElementById('asst-el-tg').checked; window.__defOff = def; localStorage.setItem('asst_el_on', '1'); let dev = 0; const sp = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = u => { dev++; };
          ASST_EL = null; await asstSpeak('غاب اليوم **طالبان** من أول ١'); const el = ASST_EL, d1 = dev;
          window.__mode404 && window.__mode404(); return { el, d1, k, def }; });
        mode = 404; const r2 = await p.evaluate(async () => { let dev = 0; speechSynthesis.speak = u => { dev++; }; ASST_EL = null; await asstSpeak('مرحبا يا معلم'); const out = { el: ASST_EL, dev };
          speechSynthesis.cancel(); return out; });
        mode = 200; const n0 = urls.length;
        const r3 = await p.evaluate(async () => { const c = document.getElementById('asst-el-tg'); const vis = !!c; if (c) { c.checked = false; c.dispatchEvent(new Event('change')); }
          let dev = 0; speechSynthesis.speak = u => { dev++; }; await asstSpeak('مرحبا يا معلم'); const off = localStorage.getItem('asst_el_on');
          if (c) { c.checked = true; c.dispatchEvent(new Event('change')); } speechSynthesis.cancel(); return { vis, dev, off }; });
        eq([r3.vis, r3.dev, r3.off, urls.length - n0], [true, 1, null, 0], 'المفتاح المقفول: صوت الجهاز بلا طلب للخادم'); ok(r.def, 'ElevenLabs مقفول افتراضيًا');
        await p.evaluate(() => localStorage.removeItem('asst_el_on'));
        await p.evaluate(k => { if (k == null) localStorage.removeItem('asst_tts'); else localStorage.setItem('asst_tts', k); }, r.k);
        await p.unroute(/workers\.dev\/tts\?/);
        ok(urls.length >= 1 && /k=asst/.test(urls[0]) && decodeURIComponent(urls[0]).includes('غاب اليوم طالبان'), urls[0]); eq([r.el, r.d1], [true, 0], 'ElevenLabs'); eq([r2.el, r2.dev], [false, 1], 'صوت الجهاز'); eq(errs, [], 'أخطاء'); });
      await S.t('⚙️ زر الإعدادات بجانب «تخصيص القائمة» يفتح الإعدادات', async () => {
        ok(await p.evaluate(() => { const r = document.querySelector('#simp-nav .simp-cust-row'); return !!(r && r.querySelector('[data-simp-settings]') && /تخصيص القائمة/.test(r.textContent)); }), 'الزر بجانب التخصيص');
        await p.evaluate(() => document.querySelector('#simp-nav [data-simp-settings]').click()); await p.waitForTimeout(400);
        ok(await p.evaluate(() => document.getElementById('p-data').classList.contains('on')), 'لم تُفتح الإعدادات');
        await p.evaluate(() => goTab('dashboard')); eq(errs, [], 'أخطاء'); });
      await S.t('📱 أجهزة الطلاب: القائمة تُحمَّل بجلسة المعلم وتفرز وتعدّ', async () => {
        await fetch('http://localhost:' + WP + '/mine?name=x&sid=s1&av=1.0.9&dm=app&os=iphone'); await fetch('http://localhost:' + WP + '/mine?name=x&sid=s2');
        await p.evaluate(() => appDevLoad()); try { await p.waitForSelector('#appdev-box .appdev-row', { timeout: 8000, state: 'attached' }); } catch { throw new Error('الصندوق: ' + await p.evaluate(() => (document.getElementById('appdev-box') || {}).textContent)); }
        const r = await p.evaluate(() => ({ n: document.querySelectorAll('#appdev-box .appdev-row').length, first: document.querySelector('#appdev-box .appdev-row').className,
          chips: [...document.querySelectorAll('#appdev-box .appdev-chip')].map(x => x.textContent).join('|') }));
        ok(r.n >= 3, 'عدد الطلاب ' + r.n); ok(/old/.test(r.first), 'القديمة أولًا: ' + r.first); ok(/تطبيق 1/.test(r.chips) && /قديمة 1/.test(r.chips), r.chips);
        await fetch('http://localhost:' + WP + '/mine?name=x&sid=s1&dv=cccccccccccccccccccc'); await fetch('http://localhost:' + WP + '/mine?name=x&sid=s2&dv=cccccccccccccccccccc');
        await p.evaluate(() => shareLoad()); await p.waitForSelector('#share-box .share-card', { timeout: 8000, state: 'attached' });
        ok(/نفس الفصل/.test(await p.evaluate(() => document.querySelector('#share-box .share-card').textContent)), 'نفس الفصل');
        await p.evaluate(() => { APPDEV.f = 'app'; appDevPaint(); }); eq(await p.evaluate(() => document.querySelectorAll('#appdev-box .appdev-row').length), 1, 'فرز التطبيق');
        eq(errs, [], 'أخطاء'); });
      await S.t('لا كلمة سر ولا جلسة داخل أي رابط', async () => {
        ctx.reqs.length = 0; await p.reload(); await p.waitForTimeout(5000);
        const leak = ctx.reqs.filter(x => /[?&]t=(test-secret-123|ts1\.)/.test(x.u)); eq(leak.map(x => x.u), [], 'روابط مكشوفة'); ok(ctx.reqs.length > 5, 'طلبات قليلة'); });
      // ── بوابة المعلم أُلغيت: روابطها القديمة تُحوَّل للوحة ──
      await S.t('رابط البوابة القديم يفتح لوحة التحكم', async () => {
        const q = await ctx.newPage(), e2 = watch(q); await q.goto(base + '/teacher-dashboard/portal/'); await q.waitForURL(/teacher-dashboard\/(#.*)?$/, { timeout: 8000 });
        await q.waitForFunction(() => typeof ctGo === 'function', null, { timeout: 15000 }); eq(e2, [], 'أخطاء'); await q.close(); });
      await S.t('«✋ الرصد» يفتح وضع الحصة: الرصد فقط بلا قوائم', async () => {
        await p.click('#portal-link-btn'); await p.waitForSelector('#qr-root', { timeout: 15000 });
        eq(await p.evaluate(() => [CT_TAB, document.body.classList.contains('fm'), getComputedStyle(document.querySelector('.masthead')).display, document.querySelectorAll('#fm-bot button').length]), ['records', true, 'none', 3]); });
      await S.t('وضع الحصة: الاختبارات من الشريط السفلي، ويبقى بعد إعادة الفتح', async () => {
        await p.click('#fm-bot button:nth-child(2)'); await p.waitForSelector('#tpx-box', { timeout: 15000 }); eq(await p.evaluate(() => CT_TAB), 'exams');
        await p.reload(); await p.waitForFunction(() => typeof FM !== 'undefined' && FM.on && CT_TAB === 'exams', null, { timeout: 20000 }); });
      await S.t('وضع الحصة: لوحة «جدول اليوم» تعرض الحصص بأوقاتها وحالتها، والاختيار منها يغيّر الفصل', async () => {
        await p.waitForFunction(() => typeof CT_DATA !== 'undefined' && CT_DATA, null, { timeout: 20000 });
        const r = await p.evaluate(() => { const k0 = window.tdKsaNow, sc0 = CT_DATA.schedule, f0 = window._fmCls;
          try { window.tdKsaNow = () => ({ ...k0(), dow: 0, min: 8 * 60 + 5 }); CT_DATA.schedule = { grid: { '0': { '1': 'أول 2', '3': 'أول 1' } } }; window._fmCls = 'أول 2';
            const d = document.createElement('div'); d.innerHTML = fmSheetHTML(); const t = document.createElement('div'); t.innerHTML = fmBarHTML();
            return [d.querySelector('.fms-h b').textContent, [...d.querySelectorAll('.fms-l')].map(x => [x.className.replace('fms-l ', ''), x.querySelector('b').textContent, x.querySelector('small').textContent, x.querySelector('.fms-p').textContent]), t.querySelector('small').textContent, !!t.querySelector('select')]; }
          finally { window.tdKsaNow = k0; CT_DATA.schedule = sc0; window._fmCls = f0; } });
        eq(r[0], 'جدول اليوم'); eq(r[1], [['done on', 'أول 2', '07:00 – 07:45', 'انتهت'], ['next', 'أول 1', '08:30 – 09:15', 'بعد 25 د']]); eq(r[2], 'الحصة 1 · 07:00 – 07:45 · انتهت'); eq(r[3], false, 'بقيت قائمة الاختيار القديمة');
        await p.click('#fm-top .fm-t'); await p.waitForSelector('#fm-sheet.on .fms-box', { timeout: 5000 });
        const c = await p.evaluate(() => { const b = [...document.querySelectorAll('#fm-sheet .fms-chips button, #fm-sheet .fms-l')].find(x => !x.classList.contains('on')); return b && b.textContent.match(/أول \d/)[0]; });
        await p.evaluate(c => [...document.querySelectorAll('#fm-sheet button')].find(x => x.textContent.includes(c) && !x.classList.contains('on')).click(), c);
        await p.waitForTimeout(500); eq(await p.evaluate(() => [!!document.getElementById('fm-sheet'), window._fmCls]), [false, c], 'لم يتغيّر الفصل');
        await p.click('#fm-top .fm-t'); await p.waitForSelector('#fm-sheet .fms-dim'); await p.keyboard.press('Escape'); eq(await p.evaluate(() => !!document.getElementById('fm-sheet')), false, 'Escape لا يغلق'); });
      await S.t('وضع الحصة: «✕ خروج» يعيد اللوحة كاملة', async () => {
        await p.click('#fm-top .fm-x'); await p.waitForTimeout(500);
        eq(await p.evaluate(() => [document.body.classList.contains('fm'), localStorage.getItem('hw_focus_v1'), !!document.getElementById('fm-bot'), getComputedStyle(document.querySelector('.masthead')).display]), [false, null, false, 'block']); eq(errs, [], 'أخطاء'); });
      await ctx.close(); }
    // ── ✋ الرصد السريع داخل لوحة التحكم ──
    { await env.HW.put('teacher:classroom', JSON.stringify({ participation: { '2020-01-01': { s2: { status: 'شارك', at: 1 } } } }));
      const ctx = await newCtx({ viewport: { width: 390, height: 844 } }); let p = await ctx.newPage(), errs = watch(p);
      const srv = async () => JSON.parse(await env.HW.get('teacher:classroom') || '{}');
      const open = async () => { await dashReady(p);
        await p.evaluate(() => { window._ctRcCls = 'أول 1'; window._ctRcClsUser = 1; window._ctRcView = 'day'; ctGo('records'); }); await p.waitForSelector('#qr-root .qr-row', { timeout: 8000 }); };
      await p.goto(base + '/teacher-dashboard/'); await p.evaluate(t => localStorage.setItem('hwapp_tok_v1', t), TOKEN); await p.reload(); await open();
      const d = await p.evaluate(() => ctToday());
      await S.t('الرصد السريع: لمسة واحدة تظهر فورًا وتصل للخادم', async () => {
        await p.click('#qr-root .qr-row[data-sid=s1] .c.g'); ok(await p.$('#qr-root .qr-row[data-sid=s1] .c.g.on'), 'لم تظهر فورًا');
        await p.waitForTimeout(2500); eq(((((await srv()).participation || {})[d] || {}).s1 || {}).status, 'شارك');
        ok(((await srv()).participation || {})['2020-01-01'], 'ضاع رصد قديم'); eq(await p.$eval('#qr-sync', e => e.textContent.trim()), '✓ محفوظ'); eq(errs, [], 'أخطاء'); });
      await S.t('الرصد السريع: الغائب «معذور» في الواجب، والتراجع يعيده', async () => {
        await p.click('#qr-root .qr-row[data-sid=s2] .c.r'); await p.waitForTimeout(2200);
        let sv = await srv(); eq(sv.participation[d].s2.status, 'غائب'); eq(sv.homework[d].s2.status, 'معذور');
        await p.click('.qr-st button'); await p.waitForTimeout(2200); sv = await srv();
        eq(sv.participation[d].s2.status, ''); eq(sv.homework[d].s2.status, ''); });
      await S.t('الرصد السريع: «الباقي شارك» لا يغيّر من رُصد', async () => {
        await p.click('#qr-root .qr-row[data-sid=s1] .c.y'); await p.click('.qr-all'); await p.waitForTimeout(2200); const sv = await srv();
        eq(sv.participation[d].s1.status, 'لم يشارك'); eq(sv.participation[d].s2.status, 'شارك'); });
      await S.t('الرصد السريع: ملاحظة سلوك من القوالب', async () => {
        await p.click('.qr-mode button:nth-child(3)'); await p.click('#qr-root .qr-row[data-sid=s1] .c.g'); await p.click('.qr-bpick .bh-chip.p'); await p.waitForTimeout(2200);
        const b = ((await srv()).behavior || []).filter(x => x.studentId === 's1' && x.date === d); eq(b.length, 1); eq(b[0].type, 'positive'); });
      await S.t('زر «ارصدها» في «اليوم» يفتح صفحة الرصد للفصل', async () => {
        await p.evaluate(() => { window._ctRcCls = ''; goTab('today'); }); await p.waitForTimeout(800);
        await p.evaluate(() => tdQuick('أول 1')); await p.waitForSelector('#qr-root .qr-row', { timeout: 8000 });
        eq(await p.evaluate(() => [CT_TAB, qrCls(), !!document.querySelector('#modal.show, #modal.on')]), ['records', 'أول 1', false]); });
      await S.t('الرصد السريع بلا شبكة ثم إغلاق وفتح: يبقى ويُرسل', async () => {
        await p.click('.qr-mode button:nth-child(2)'); ctx.offline = true;
        await p.click('#qr-root .qr-row[data-sid=s1] .c.r'); await p.waitForTimeout(1800);
        ok(/بانتظار/.test(await p.$eval('#qr-sync', e => e.textContent)), 'لا تنبيه «بانتظار الإرسال»');
        await p.close(); ctx.offline = false; p = await ctx.newPage(); errs = watch(p); await p.goto(base + '/teacher-dashboard/'); await open(); await p.waitForTimeout(6000);
        eq(((((await srv()).homework || {})[d] || {}).s1 || {}).status, 'لم ينجز', 'لم يصل للخادم');
        eq(await p.evaluate(() => localStorage.getItem('ct_outbox_v1')), null, 'الطابور لم يُفرغ'); eq(errs, [], 'أخطاء'); });
      await ctx.close(); }
    // ── 📝 رصد الاختبارات + 📷 التصحيح الآلي داخل لوحة التحكم ──
    { await env.HW.put('teacher:classroom', JSON.stringify({ examBooks: { '1': { '1': { tests: [{ id: 't1', title: 'قصير 1', max: 10 }, { id: 't2', title: 'قصير 2', max: 10 }], scores: { s2: { t1: { score: 6, at: 1 } } } } } } }));
      await env.HW.put('omr:index', JSON.stringify([{ id: 'tp1', title: 'ورقي 1', n: 10, models: 1, at: 1 }]));
      await env.HW.put('omr:t:tp1', JSON.stringify({ id: 'tp1', title: 'ورقي 1', models: [{ letter: 'أ', questions: [] }] }));
      const ctx = await newCtx({ viewport: { width: 390, height: 844 } }); let p = await ctx.newPage(), errs = watch(p);
      const book = async () => (JSON.parse(await env.HW.get('teacher:classroom') || '{}').examBooks || {})['1']['1'];
      const open = async () => { await dashReady(p);
        await p.evaluate(() => { window._ctExCls = 'أول 1'; window._ctExMode = 'rec'; ctGo('exams'); }); await p.waitForSelector('#exam-list .ex-row', { timeout: 15000 }); };
      await p.goto(base + '/teacher-dashboard/'); await p.evaluate(t => localStorage.setItem('hwapp_tok_v1', t), TOKEN); await p.reload(); await open();
      await S.t('الاختبارات: لوحة الأرقام ترصد وتصل للخادم ولا تمس غيرها', async () => {
        await p.click('#exam-list [data-ex-cell=s1]'); for (const k of ['8', '.', '5', 'next']) await p.click(`#ex-kb [data-k="${k}"]`);
        await p.waitForTimeout(2500); const b = await book(); eq(b.scores.s1.t1.score, 8.5); eq(b.scores.s2.t1.score, 6); eq(b.tests.length, 2); eq(errs, [], 'أخطاء'); });
      await S.t('الاختبارات: «غائب» و💯', async () => {
        await p.click('#ex-kb [data-k="abs"]').catch(() => {}); await p.evaluate(() => exKbClose(false));
        await p.click('#exam-list [data-ex-full=s1]'); await p.waitForTimeout(2200); eq((await book()).scores.s1.t1.score, 10); });
      await S.t('الاختبارات: إضافة اختبار من «الإعداد» تصل للخادم', async () => {
        await p.click('#ex-setup-btn'); await p.click('#exam-add-test'); await p.waitForTimeout(2200); eq((await book()).tests.length, 3); });
      await S.t('الاختبارات بلا شبكة ثم إغلاق وفتح: الدرجة تبقى وتُرسل', async () => {
        ctx.offline = true; await p.evaluate(() => exPick('t2')); await p.click('#exam-list [data-ex-cell=s2]');
        for (const k of ['7', 'x']) await p.click(`#ex-kb [data-k="${k}"]`); await p.waitForTimeout(1500);
        ok(/بانتظار/.test(await p.$eval('#qr-sync', e => e.textContent)), 'لا تنبيه «بانتظار الإرسال»');
        await p.close(); ctx.offline = false; p = await ctx.newPage(); errs = watch(p); await p.goto(base + '/teacher-dashboard/'); await open(); await p.waitForTimeout(6000);
        eq(((await book()).scores.s2.t2 || {}).score, 7, 'لم تصل'); eq((await book()).scores.s1.t1.score, 10, 'ضاعت درجة سابقة'); });
      await S.t('التصحيح الآلي: يفتح فوق اللوحة ويعرض الاختبار الورقي ويُغلق', async () => {
        await p.click('#omr-open'); await p.waitForSelector('#omr-tpl', { timeout: 8000 });
        ok(await p.evaluate(() => { const r = document.querySelector('.omr-top').getBoundingClientRect(); return document.elementFromPoint(r.left + 30, r.top + 20).closest('.omr-sheet') !== null; }), 'الشريط مغطّى');
        await p.click('#omr-go'); await p.waitForSelector('.omr-tile', { timeout: 5000 });
        await p.evaluate(() => omrClose()); ok(await p.evaluate(() => !document.getElementById('omr-sheet')), 'لم تُغلق'); eq(errs, [], 'أخطاء'); });
      await S.t('التصحيح الآلي: الورقة شبكة إجابات، و🔍 يكبّر المعلّق وينتقل للتالي (والأرقام من لوحة المفاتيح)', async () => {
        await p.evaluate(async () => { await omrOpen();
          const keys = [0, 2, 1, 0, 3, 2], st = ['ok', 'ok', 'blank', 'ok', 'faint', 'ok'];
          OMRUI.tpl = { id: 'tp', models: [{ letter: 'أ', total: 6, questions: keys.map((k, i) => ({ boxes: [{}, {}, {}, {}], key: k, q: 'سؤال ' + (i + 1) })) }], total: 6, mark: 1 };
          OMRUI.sheets = [{ id: 'g1', model: 0, at: 1, saved: false, noCode: true, name: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', manual: '',
            answers: keys.map((k, i) => ({ t: 'mc', key: k, status: st[i], pick: k, final: st[i] === 'ok' ? (i === 3 ? 2 : k) : null })) }];
          OMRUI.openId = 'g1'; OMRUI.zoom = null; omrMatchRender(); });
        const g = await p.evaluate(() => [document.querySelectorAll('#mc-g1 .omr-gq').length, document.querySelectorAll('#mc-g1 .omr-gq.w').length,
          document.querySelectorAll('#mc-g1 .omr-gr.ok').length, document.querySelectorAll('#mc-g1 .omr-gr.no').length,
          !!document.querySelector('#mc-g1 .omr-stuhd') && document.querySelector('#mc-g1 .omr-stuhd').compareDocumentPosition(document.querySelector('#mc-g1 .omr-grid')) === 4]);
        eq(g, [6, 2, 3, 1, true], 'الشبكة');
        const vis = () => p.evaluate(() => [...document.querySelectorAll('#mc-g1 .omr-sbtn')].filter(b => b.offsetParent).map(b => b.firstChild.textContent.trim()));
        eq(await vis(), [], 'الأسماء ظاهرة بلا بحث');
        await p.fill('#omr-q', 'الأول'); eq(await vis(), ['طالب الأول'], 'البحث (وسم مختصر)');
        await p.fill('#omr-q', ''); await p.evaluate(() => omrMatchFilter()); eq(await vis(), [], 'بعد مسح البحث');
        await p.click('#mc-g1 .omr-gq.w .omr-gz'); await p.waitForSelector('#omr-zoom');
        eq(await p.evaluate(() => OMRUI.zoom.i), 2, 'أول معلّق'); await p.keyboard.press('2'); await p.waitForTimeout(200);
        eq(await p.evaluate(() => [OMRUI.sheets[0].answers[2].final, OMRUI.zoom && OMRUI.zoom.i]), [1, 4], 'انتقل للتالي');
        await p.keyboard.press('0'); await p.waitForTimeout(200);
        eq(await p.evaluate(() => [OMRUI.sheets[0].answers[4].final, OMRUI.zoom, !!document.getElementById('omr-zoom')]), [-1, null, false], 'أُغلق بعد آخر معلّق');
        await p.evaluate(() => document.querySelector('#mc-g1 .omr-gq:nth-child(4) .omr-go button:nth-child(1)').click()); await p.waitForTimeout(150);
        eq(await p.evaluate(() => OMRUI.sheets[0].answers[3].final), 0, 'تعديل إجابة مقروءة من الشبكة');
        await p.evaluate(() => { OMRUI.sheets = []; omrClose(); }); eq(errs, [], 'أخطاء'); });
      await S.t('عرض الورقة المصححة: تفتح فوق الصفحة كلها بتنسيقها (لا نصًا في أسفل الصفحة)', async () => {
        const r = await p.evaluate(() => { EXPAP.sids = new Map([['s1', { name: 'أ', cls: 'أول 1', score: 1, max: 2 }]]); EXPAP.test = 'none'; exPaperOpen('s1');
          const v = document.querySelector('body > .omr-full'); if (!v) return null; const cs = getComputedStyle(v), b = v.getBoundingClientRect();
          const out = [v.classList.contains('tpx'), cs.position, Math.round(b.width) >= innerWidth - 2, Math.round(b.height) >= innerHeight - 2]; v.remove(); return out; });
        eq(r, [true, 'fixed', true, true]); });
      await S.t('الاختبارات: وضع «جدول» ما زال يعمل', async () => {
        await p.evaluate(() => ctExModeSet('table')); await p.waitForSelector('.ct-sc', { timeout: 5000 });
        eq(await p.$$eval('.ct-sc', x => x.length) >= 4, true); await p.evaluate(() => ctExModeSet('rec')); });
      await ctx.close(); }
    // ── 🗓️ الجدول وتنبيه الحصص والتذكيرات داخل لوحة التحكم ──
    { const grid = {}; for (let d = 0; d < 7; d++) grid[String(d)] = { '2': 'أول 1' };
      await env.HW.put('teacher:classroom', JSON.stringify({ schedule: { dur: 45, gap: 0, count: 7, breakAfter: 3, breakLen: 30, prayAfter: 6, prayLen: 20, presets: { summer: '07:00', winter: '07:15' }, active: 'summer', auto: false, fix: {}, grid, sessions: {} },
        participation: { '2020-01-01': { s1: { status: 'غائب', at: 1 } } } }));
      const ctx = await newCtx({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(), errs = watch(p);
      const cr = async () => JSON.parse(await env.HW.get('teacher:classroom') || '{}'), kv = async k => JSON.parse(await env.HW.get(k) || 'null');
      await p.goto(base + '/teacher-dashboard/'); await p.evaluate(t => localStorage.setItem('hwapp_tok_v1', t), TOKEN); await p.reload();
      await dashReady(p);
      await p.evaluate(() => ctGo('schedule')); await p.waitForSelector('#sch-grid .sc-wr', { timeout: 15000 });
      await S.t('الجدول: شاشة البوابة داخل اللوحة بلا تكرار لوحة الأوقات القديمة', async () => {
        eq(await p.$$eval('.st-panel', x => x.length), 0, 'لوحة الأوقات القديمة ما زالت'); const wkend = await p.evaluate(() => [5, 6].includes(new Date().getDay()));   // الجمعة والسبت عطلة: لا حصص «اليوم» أصلًا
        ok(wkend ? await p.$('#sc-day') : await p.$('#sc-day .sc-r'), wkend ? 'لا لوحة اليوم' : 'لا حصص اليوم'); eq(errs, [], 'أخطاء'); });
      await S.t('الجدول: تغيير فصل خانة من «الأسبوع كامل» يصل للخادم ولا يمس الرصد', async () => {
        await p.click('[data-sc-view=week]'); await p.click('#sc-full [data-sc-cell="1|3"]'); await p.click('#sc-pick-l [data-sc-set="أول 2"]');
        await p.waitForTimeout(2500); const c = await cr(); eq(c.schedule.grid['1']['3'], 'أول 2'); eq(c.schedule.grid['1']['2'], 'أول 1'); eq(c.participation['2020-01-01'].s1.status, 'غائب'); });
      await S.t('الجدول: الأوقات من ⚙️ تصل للخادم', async () => {
        await p.click('#sc-set-btn'); await p.fill('#sch-dur', '40'); await p.dispatchEvent('#sch-dur', 'change'); await p.waitForTimeout(2500);
        eq((await cr()).schedule.dur, 40); await p.evaluate(() => scSet(false)); });
      await S.t('تنبيه الحصص: التفعيل يرسل جدول الأسبوع للخادم', async () => {
        await p.evaluate(() => ppEnable()); await p.waitForTimeout(1500); const A = await kv('lesson:alarms');
        ok(A && A.items && A.items.some(x => x.cls === 'أول 2' && x.p === 3 && x.dow === 1), 'لم تصل الحصص: ' + JSON.stringify(A && A.items && A.items.slice(0, 2))); });
      await S.t('تذكيرات «اليوم» تُرسل مواعيدها للخادم بعد الحفظ', async () => {
        await p.evaluate(() => { rmgOpen(); rmgEdit(); RMG.title = 'تذكير الاختبار'; RMG.days = [0, 1, 2, 3, 4]; RMG.repeat = 'weekly'; RMG.at = { t: 'time', hm: '10:00' }; });
        await p.evaluate(() => rmgSave()); await p.waitForTimeout(3500); const A = await kv('tasks:alarms');
        ok(A && A.items && A.items.some(x => x.title === 'تذكير الاختبار'), 'لم تصل: ' + JSON.stringify(A)); await p.evaluate(() => closeModal()); });
      await S.t('الضغط على تنبيه الحصة يفتح رصد فصلها في اللوحة', async () => {
        const d = await p.evaluate(() => ctToday()); await p.goto(base + `/teacher-dashboard/portal/?lesson=${d}.2`);   // رابط تنبيه قديم (البوابة) ⇒ اللوحة
        await p.waitForSelector('#qr-root .qr-row', { timeout: 20000 }); eq(await p.evaluate(() => [CT_TAB, qrCls()]), ['records', 'أول 1']); eq(errs, [], 'أخطاء'); });
      await ctx.close(); }
    // ── المرحلة 4: سلوك لعدة طلاب · فترة السماح · رسائل الحصة ──
    { const day = k => new Date(Date.now() + 3 * 36e5 - k * 864e5).toISOString().slice(0, 10);
      await env.HW.put('teacher:classroom', JSON.stringify({ homework: { [day(2)]: { s1: { status: 'لم ينجز', at: 1 } }, [day(20)]: { s2: { status: 'لم ينجز', at: 1 } } } }));
      const ctx = await newCtx({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(), errs = watch(p);
      const cr = async () => JSON.parse(await env.HW.get('teacher:classroom') || '{}');
      await p.goto(base + '/teacher-dashboard/'); await p.evaluate(t => localStorage.setItem('hwapp_tok_v1', t), TOKEN); await p.reload();
      await dashReady(p);
      await p.evaluate(() => { window._ctRcCls = 'أول 1'; window._ctRcClsUser = 1; window._ctRcView = 'day'; ctGo('records'); }); await p.waitForSelector('#qr-root .qr-row', { timeout: 20000 });
      await S.t('فترة السماح: يظهر من لم ينجز حديثًا فقط، و«سامحه» تصل للخادم', async () => {
        await p.click('.qr-mode button:nth-child(2)'); const names = await p.$$eval('.qr-gr b', x => x.map(e => e.textContent));
        eq(names, ['طالب الاختبار الأول'], 'القائمة'); await p.click('.qr-gr .btn.ghost'); await p.waitForTimeout(2500);
        const h = (await cr()).homework[day(2)].s1; eq([h.status, h.forgiven], ['معذور', true]); eq(await p.$$eval('.qr-gr', x => x.length), 0); });
      await S.t('السلوك: سلوك واحد لعدة طلاب', async () => {
        await p.click('.qr-mode button:nth-child(3)'); await p.click('.qr-mbtn'); await p.click('#qr-root .qr-row[data-sid=s1] .nm'); await p.click('#qr-root .qr-row[data-sid=s2] .nm');
        await p.click('.qr-bpick .bh-chip.p'); await p.waitForTimeout(2500);
        const b = ((await cr()).behavior || []).filter(x => x.date === day(0)); eq(b.map(x => x.studentId).sort(), ['s1', 's2']); ok(new Set(b.map(x => x.id)).size === 2, 'معرّف مكرر'); });
      await S.t('رسائل الحصة: تُرسل للطالب في بوابته', async () => {
        ctx.reqs.length = 0; await p.evaluate(() => { window._ctMsCls = 'أول 1'; ctGo('messages'); }); await p.waitForSelector('#ms-list [data-ms-open=s2]', { timeout: 15000 });
        await p.click('#ms-list [data-ms-open=s2]'); await p.click('#ms-chips [data-msk=participation]'); await p.click('[data-ms-act=send]');
        ok(await p.$eval('#ms-undo', e => !e.hidden), 'لا شريط تراجع'); await p.waitForTimeout(7000);
        ok(ctx.reqs.some(x => x.u.startsWith('/messages')), 'لم يُرسل'); const r = await call('/messages?sid=s2&name=' + encodeURIComponent('طالب الاختبار الثاني'));
        ok(JSON.stringify(r.j).includes('مشاركتك'), 'لم تصل للطالب: ' + JSON.stringify(r.j).slice(0, 200)); eq(errs, [], 'أخطاء'); });
      await ctx.close(); }
    // ── طلبات الفتح: لا تكرار، ولا ملف طالب مخفي يُفتح ──
    { const ctx = await newCtx({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(), errs = watch(p);
      await S.t('فتح اللوحة: /version و/reports و/asks مرة واحدة، ولا /pins (ملف الطالب المخفي لا يُفتح)', async () => {
        await p.goto(base + '/teacher-dashboard/'); await p.evaluate(t => localStorage.setItem('hwapp_tok_v1', t), TOKEN); await p.reload(); await dashReady(p); await p.waitForTimeout(2500);   // جلسة الجهاز جاهزة
        ctx.reqs.length = 0; await p.reload(); await dashReady(p); await p.waitForTimeout(3000);
        const n = k => ctx.reqs.filter(x => x.u.split('?')[0] === k).length;
        eq([n('/version'), n('/reports'), n('/asks'), n('/pins')], [1, 1, 1, 0], 'عدد الطلبات: ' + ctx.reqs.map(x => x.u.split('?')[0]).join(' '));
        await p.evaluate(() => goTab('students')); await p.waitForFunction(() => document.querySelector('#student-center-detail .stc-file'), null, { timeout: 15000 });
        eq(errs, [], 'أخطاء'); });
      await ctx.close(); }
    // ── 👤 ملف الطالب: بياناته تُجهَّز في الخلفية (والفترة السابقة)، وتعذّر الخادم يُعاد وحده ──
    { const ctx = await newCtx({ viewport: { width: 390, height: 844 } }); let fails = 0, rep = 0, slow = 0;
      await ctx.route(/workers\.dev\/(reports|academic)/, async r => { const u = new URL(r.request().url());
        try { if (u.pathname === '/reports') { rep++; if (fails) return r.fulfill({ status: 500, body: '{}' }); await new Promise(x => setTimeout(x, slow || 1500)); }
          const resp = await r.fetch({ url: 'http://localhost:' + WP + u.pathname + u.search });
          if (u.pathname === '/academic') { const j = await resp.json(); const a = j.academic = j.academic || {}; a.currentSemester = 1; a.semesters = { ...(a.semesters || {}), 1: { ...((a.semesters || {})[1] || {}), status: 'active', activePeriod: 2 } }; return r.fulfill({ response: resp, body: JSON.stringify(j) }); }
          await r.fulfill({ response: resp }); } catch { try { await r.abort(); } catch {} } });
      const p = await ctx.newPage(), errs = watch(p);
      const pfReady = () => p.waitForFunction(() => { const f = document.querySelector('#student-center-detail .stc-file'); return f && f.style.display !== 'none' && f.querySelector('#ct-pf'); }, null, { timeout: 30000 });
      const warn = () => p.evaluate(() => !!document.querySelector('#student-center-detail .stc-file:not([style*="none"]) .ct-warn'));
      await S.t('ملف الطالب: الفترة الحالية والسابقة تُجهَّزان في الخلفية، فيفتح فورًا', async () => {
        await p.goto(base + '/teacher-dashboard/'); await p.evaluate(t => localStorage.setItem('hwapp_tok_v1', t), TOKEN); await p.reload(); await dashReady(p);
        await p.waitForFunction(() => typeof CT_PREV !== 'undefined' && CT_PREV && CT_GRADES, null, { timeout: 20000 });
        const n = rep, t0 = Date.now(); await p.evaluate(() => goTab('students')); await pfReady();
        ok(Date.now() - t0 < 1200, 'فتح الملف انتظر الخادم: ' + (Date.now() - t0) + ' م.ث'); eq(rep, n, 'طلب /reports جديد عند الفتح'); eq(await warn(), false, 'تحذير الخادم'); });
      await S.t('ملف الطالب: كل تبويب (الشامل، الأنشطة، التقارير، الخط الزمني، التواصل، النقاط) يرسم محتواه', async () => {
        const empty = [];
        for (const sub of ['overview', 'acts', 'report', 'period', 'timeline', 'contacts', 'points']) {
          await p.evaluate(sub => { window._ctPfSub = sub; renderStudentCenterDetail(1); }, sub);
          try { await p.waitForFunction(() => { const f = [...document.querySelectorAll('#student-center-detail .stc-file')].pop(); const e = f && f.querySelector('#ct-pf'); return f && f.style.display !== 'none' && e && e.innerText.trim().length > 20; }, null, { timeout: 6000 }); }
          catch { empty.push(sub); } }
        eq(empty, [], 'تبويبات فارغة'); await p.evaluate(() => { window._ctPfSub = 'overview'; renderStudentCenterDetail(1); }); eq(errs, [], 'أخطاء'); });
      await S.t('ملف الطالب: المزامنة في الخلفية لا تعيد رسمه إلا إن تغيّرت بيانات الطالب نفسه', async () => {
        await p.evaluate(() => { window._ctPfSub = 'period'; renderStudentCenterDetail(1); }); await pfReady(); await p.waitForTimeout(800);
        const mark = () => p.evaluate(() => { const f = [...document.querySelectorAll('#student-center-detail .stc-file')].pop(); return !!(f && f.dataset.mk); });
        await p.evaluate(() => { [...document.querySelectorAll('#student-center-detail .stc-file')].pop().dataset.mk = '1'; renderStudentsCenter(); renderStudentsCenter(); });
        await p.waitForTimeout(1200); eq(await mark(), true, 'أُعيد رسم الملف بلا تغيير');
        await p.evaluate(() => { const s = byId(STUDENT_CENTER_SELECTED); s.points = (Number(s.points) || 0) + 7; renderStudentsCenter(); });
        await p.waitForFunction(() => { const f = [...document.querySelectorAll('#student-center-detail .stc-file')].pop(); return f && !f.dataset.mk && f.style.display !== 'none'; }, null, { timeout: 15000 });
        await p.evaluate(() => { window._ctPfSub = 'overview'; renderStudentCenterDetail(1); }); eq(errs, [], 'أخطاء'); });
      await S.t('ملف الطالب: تعذّر الخادم يُعاد تلقائيًا ويختفي التحذير عند نجاحه', async () => {
        await p.evaluate(() => goTab('dashboard')); fails = 1; await p.evaluate(async () => { await caches.delete('ct-grades-v1'); CT_GRADES = null; CT_PREV = null; STC_SHOWN = ''; REPORT_BUNDLE_CACHE.clear(); COMP_GRADES_CACHE.clear(); goTab('students'); });   // بلا نسخة جهاز ولا ذاكرة: فشل حقيقي
        await p.waitForFunction(() => document.querySelector('#student-center-detail .stc-file:not([style*="none"]) .ct-warn'), null, { timeout: 30000 });
        fails = 0; await p.waitForFunction(() => !document.querySelector('#student-center-detail .stc-file:not([style*="none"]) .ct-warn'), null, { timeout: 20000 });
        eq(errs, [], 'أخطاء'); });
      await S.t('ملف الطالب: بعد إعادة فتح التطبيق يُعرض فورًا من نسخة الجهاز والخادم بطيء، ثم يُحدَّث', async () => {
        await p.waitForTimeout(1500); slow = 8000; const n = rep; await p.reload(); await p.waitForFunction(() => typeof goTab === 'function' && typeof ctEnsureGrades === 'function', null, { timeout: 15000 });
        const t0 = Date.now(); await p.evaluate(() => goTab('students')); await pfReady();
        ok(Date.now() - t0 < 2500, 'انتظر الخادم البطيء: ' + (Date.now() - t0) + ' م.ث'); eq(await warn(), false, 'تحذير');
        eq(await p.evaluate(async () => (await (await caches.open('ct-grades-v1')).keys()).map(r => r.url.split('/').pop()).sort()), ['1-1', '1-2'], 'نسخة الفترتين على الجهاز');
        slow = 0; ok(rep > n, 'لم يُحدَّث من الخادم في الخلفية'); eq(errs, [], 'أخطاء'); });
      await ctx.close(); }
    // ── 📝 درجة اختبار مرصودة لم تصل للخادم: تقرير الفترة ينبّه ويرسلها بضغطة ──
    { const ctx = await newCtx({ viewport: { width: 390, height: 844 } }); let block = false;
      await ctx.route(/workers\.dev\/classroom/, async r => { if (block && r.request().method() === 'POST') return r.fulfill({ status: 500, body: '{"error":"boom"}' }); return r.fallback(); });
      const p = await ctx.newPage(), errs = watch(p);
      await S.t('تقرير الفترة: درجة اختبار على الجهاز لم تصل للخادم ⇒ تنبيه بالسبب و«أرسلها الآن» يرسلها', async () => {
        await p.goto(base + '/teacher-dashboard/'); await p.evaluate(t => localStorage.setItem('hwapp_tok_v1', t), TOKEN); await p.reload(); await dashReady(p);
        await p.waitForFunction(() => window.LZ_READY, null, { timeout: 20000 });
        await p.evaluate(async () => { const { sem, per } = ctExamSP(); await ctSave(d => { const b = ctBookW(d, sem, per); if (!b.tests.some(t => t.id === 'tsync')) b.tests.push({ id: 'tsync', title: 'اختبار المزامنة', max: 10 }); }); });
        block = true;
        await p.evaluate(() => { const { sem, per } = ctExamSP(); const b = CT_DATA.examBooks[String(sem)][String(per)]; (b.scores.s1 = b.scores.s1 || {}).tsync = { score: 9, at: Date.now() }; qrDo({ k: 'exb', sem: String(sem), per: String(per), book: JSON.parse(JSON.stringify(b)) }); });
        await p.waitForTimeout(2500);
        await p.evaluate(() => { window._ctPfSub = 'period'; ctOpenProfile('s1', 'period'); });
        await p.waitForFunction(() => /لم تصل للخادم/.test(document.body.innerText), null, { timeout: 20000 });
        ok(await p.evaluate(() => /اختبار المزامنة/.test(document.querySelector('.ct-warn').innerText) && /500/.test(document.querySelector('.ct-warn').innerText)), 'التنبيه بلا اسم الاختبار أو السبب');
        block = false; await p.click('text=أرسلها الآن');
        await p.waitForFunction(() => !/لم تصل للخادم/.test(document.body.innerText) && /9 \/ 10/.test(document.body.innerText), null, { timeout: 20000 });
        await p.evaluate(() => { window._ctPfSub = 'overview'; }); eq(errs, [], 'أخطاء'); });
      await S.t('تقرير الفترة: اختبار حُذف على الجهاز ولم يصل حذفه ⇒ تنبيه، و«أرسلها الآن» يحذفه من الخادم', async () => {
        const { sem, per } = await p.evaluate(() => ctExamSP());
        const srvHas = async () => { const b = (JSON.parse(await env.HW.get('teacher:classroom')).examBooks[String(sem)] || {})[String(per)] || {}; return (b.tests || []).some(t => t.id === 'tsync'); };
        ok(await srvHas(), 'الاختبار ليس في الخادم أصلًا');
        block = true;
        await p.evaluate(() => { const { sem, per } = ctExamSP(); const b = CT_DATA.examBooks[String(sem)][String(per)]; b.tests = b.tests.filter(t => t.id !== 'tsync');
          b.delTests = (b.delTests || []).concat([{ id: 'tsync', at: Date.now() }]); qrDo({ k: 'exb', sem: String(sem), per: String(per), book: JSON.parse(JSON.stringify(b)) }); });
        await p.waitForTimeout(2500); ok(await srvHas(), 'وصل رغم الحجب');
        await p.evaluate(() => { window._ctPfSub = 'period'; ctOpenProfile('s1', 'period'); });
        await p.waitForFunction(() => /لم يصل حذفه للخادم/.test(document.body.innerText) && /اختبار المزامنة/.test((document.querySelector('.ct-warn') || {}).innerText || ''), null, { timeout: 20000 });
        block = false; await p.click('text=أرسلها الآن');
        await p.waitForFunction(() => !/لم يصل حذفه/.test(document.body.innerText), null, { timeout: 20000 });
        ok(!(await srvHas()), 'لم يُحذف من الخادم'); await p.evaluate(() => { window._ctPfSub = 'overview'; }); eq(errs, [], 'أخطاء'); });
      await S.t('نسخة قديمة من الخادم (تخزين Cloudflare المتأخر) لا تعيد اختبارًا محذوفًا ولا تُسقط درجة — والجهاز يصلحها وحده', async () => {
        const { sem, per } = await p.evaluate(() => ctExamSP());
        const book = async () => (JSON.parse(await env.HW.get('teacher:classroom')).examBooks[String(sem)] || {})[String(per)] || {};
        await p.evaluate(async () => { const { sem, per } = ctExamSP(); await ctSave(d => { const b = ctBookW(d, sem, per); if (!b.tests.some(t => t.id === 'tkeep')) b.tests.unshift({ id: 'tkeep', title: 'اختبار باقٍ', max: 10 }); }); });
        // الخادم يرجع لنسخة قديمة: الاختبار المحذوف فيه بلا سجل حذفه، وبلا الدرجة الأخيرة
        const cr = JSON.parse(await env.HW.get('teacher:classroom')), bk = cr.examBooks[String(sem)][String(per)];
        await p.evaluate(() => { const { sem, per } = ctExamSP(); const b = CT_DATA.examBooks[String(sem)][String(per)]; (b.scores.s2 = b.scores.s2 || {})[b.tests[0].id] = { score: 6, at: Date.now() }; qrDo({ k: 'exb', sem: String(sem), per: String(per), book: JSON.parse(JSON.stringify(b)) }); });
        await p.waitForFunction(() => !qrOut().length, null, { timeout: 15000 });
        const t0 = (await book()).tests[0].id; eq(((await book()).scores.s2 || {})[t0]?.score, 6, 'لم تصل الدرجة');
        bk.tests.push({ id: 'tsync', title: 'اختبار المزامنة', max: 10 }); delete bk.delTests; if (bk.scores.s2) delete bk.scores.s2[t0];
        await env.HW.put('teacher:classroom', JSON.stringify(cr));
        await p.evaluate(() => qrDo({ k: 'set', f: 'msgFlags', v: (CT_DATA.msgFlags || {}) }));   // أي حفظ آخر يُبنى على النسخة القديمة
        await p.waitForFunction(() => !qrOut().length, null, { timeout: 15000 }); await p.waitForTimeout(1500);
        await p.waitForFunction(() => !qrOut().length, null, { timeout: 15000 });
        const b2 = await book(); ok(!b2.tests.some(t => t.id === 'tsync'), 'عاد الاختبار المحذوف'); eq((b2.scores.s2 || {})[t0]?.score, 6, 'سقطت الدرجة');
        eq(errs, [], 'أخطاء'); });
      await ctx.close(); }
    // ── 🖥️ وضع الحصة على الكمبيوتر: القائمة الجانبية لا تغطي شريط الفصل ──
    { const ctx = await newCtx({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage(), errs = watch(p);
      await S.t('تطبيق الآيفون: الأيقونات وشاشات البداية موجودة، وكل صورة بمقاس جهازها بالضبط', async () => {
        await p.goto(base + '/teacher-dashboard/');
        const r = await p.evaluate(async () => { const out = [];
          for (const l of document.querySelectorAll('link[rel="apple-touch-icon"],link[rel="apple-touch-startup-image"]')) {
            const im = new Image(); im.src = l.href; const ok = await new Promise(x => { im.onload = () => x(true); im.onerror = () => x(false); });
            const m = /device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)/.exec(l.media || ''), sz = /(\d+)x\1/.exec(l.sizes ? l.sizes.value : '');
            out.push([l.getAttribute('href'), ok && (m ? im.naturalWidth === m[1] * m[3] && im.naturalHeight === m[2] * m[3] : sz ? im.naturalWidth === +sz[1] : true)]); }
          return out; });
        ok(r.filter(x => /startup/.test(x[0]) || /splash/.test(x[0])).length >= 12, 'شاشات البداية: ' + r.length);
        eq(r.filter(x => !x[1]), [], 'صور مفقودة أو بمقاس خطأ'); });
      await S.t('الشريط العلوي على الكمبيوتر: بلا اسم مكرر، وبحدود المحتوى نفسها، والفترة المخفية تبقى مخفية', async () => {
        await p.goto(base + '/teacher-dashboard/'); await p.evaluate(t => localStorage.setItem('hwapp_tok_v1', t), TOKEN); await p.reload(); await dashReady(p);
        const r = await p.evaluate(() => { const R = s => { const e = document.querySelector(s).getBoundingClientRect(); return [Math.round(e.left), Math.round(e.right)]; };
          const v = document.getElementById('vsp-btn'); v.style.display = 'none'; const hid = getComputedStyle(v).display; v.style.display = ''; const shown = getComputedStyle(v).display; v.style.display = 'none';
          return [getComputedStyle(document.querySelector('.masthead .brand')).display, JSON.stringify(R('.masthead-in')) === JSON.stringify(R('main.wrap')), hid, shown]; });
        eq(r, ['none', true, 'none', 'flex']); eq(errs, [], 'أخطاء'); });
      await S.t('وضع الحصة على الكمبيوتر: اسم الفصل ظاهر (القائمة الجانبية مخفية ولا تحجز مكانًا)', async () => {
        await p.evaluate(() => fmEnter()); await p.waitForSelector('#fm-top .fm-t', { timeout: 10000 });
        const r = await p.evaluate(() => { const t = document.querySelector('#fm-top .fm-t').getBoundingClientRect(), el = document.elementFromPoint(t.right - 12, t.top + t.height / 2);
          return [!!(el && el.closest('#fm-top')), getComputedStyle(document.getElementById('main-nav')).display, getComputedStyle(document.body).paddingRight]; });
        eq(r, [true, 'none', '0px']); await p.evaluate(() => fmExit()); await p.waitForTimeout(300);
        ok(await p.evaluate(() => getComputedStyle(document.getElementById('main-nav')).display !== 'none'), 'القائمة لم تعد بعد الخروج'); eq(errs, [], 'أخطاء'); });
      await ctx.close(); }
    // ── 🛰️ عامل الخدمة: موقع اللوحة لا يرد مباشرة (تطبيق الآيفون على بعض شبكات الواي فاي) ⇒ الصفحة وملفاتها عبر الخادم ──
    { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' }); const log = []; let cut = false, oldWorker = false;
      await ctx.route(u => /workers\.dev$/.test(u.hostname), async r => { const u = new URL(r.request().url()); if (u.pathname === '/site') log.push(decodeURIComponent(u.search));
        if (oldWorker && u.pathname === '/site') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"service":"homework","paths":["/publish"]}' }).catch(() => {});   // خادم قديم لا يعرف /site
        try { await r.fulfill({ response: await r.fetch({ url: 'http://localhost:' + WP + u.pathname + u.search }) }); } catch { try { await r.abort(); } catch {} } });
      await ctx.route(new RegExp('localhost:' + SP + '/teacher-dashboard/'), async r => { if (cut) { try { await r.abort('timedout'); } catch {} return; } await r.fallback(); });
      const p = await ctx.newPage(), errs = watch(p);
      await S.t('عامل الخدمة: الموقع لا يرد مباشرة ⇒ الصفحة وملفاتها تُجلب عبر الخادم، واللوحة تفتح', async () => {
        await p.goto(base + '/teacher-dashboard/'); await p.evaluate(t => localStorage.setItem('hwapp_tok_v1', t), TOKEN); await p.reload();
        await p.waitForFunction(() => typeof getApi === 'function' && getApi(), null, { timeout: 30000 });
        await p.evaluate(async () => { await navigator.serviceWorker.register('./sw.js?api=' + encodeURIComponent(getApi().replace(/\/+$/, '')), { scope: './' }); await navigator.serviceWorker.ready; });
        await p.reload(); await p.waitForTimeout(2500); ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'عامل الخدمة لا يتحكم');
        cut = true; log.length = 0; await p.reload({ timeout: 60000 }); await p.waitForTimeout(9000);
        ok(await p.evaluate(() => typeof goTab === 'function'), 'اللوحة لم تفتح');
        ok(log.some(x => /p=\/teacher-dashboard\/(index\.html)?$/.test(x)), 'الصفحة لم تُجلب عبر الخادم: ' + JSON.stringify(log.slice(0, 4)));
        cut = false; eq(errs, [], 'أخطاء'); });
      await S.t('عامل الخدمة: خادم قديم يردّ بقائمة JSON ⇒ لا تُعرض ولا تُحفظ مكان اللوحة (تفتح من المحفوظة)', async () => {
        cut = true; oldWorker = true; await p.reload({ timeout: 60000 }); await p.waitForTimeout(8000);
        ok(!/"service":"homework"/.test(await p.evaluate(() => document.body.innerText.slice(0, 500))), 'عُرضت قائمة الخادم');
        ok(await p.evaluate(() => typeof goTab === 'function'), 'اللوحة لم تفتح');
        cut = false; oldWorker = false; await p.reload(); await p.waitForTimeout(2500);
        ok(await p.evaluate(async () => /<html[\s>]/i.test(await (await (await caches.open('dash-static-v3')).match(new URL('index.html', location.href).href)).text())), 'حُفظ غير صفحة');
        eq(errs, [], 'أخطاء'); });
      await ctx.close(); }
    // ── 📱 زر «تحديث الآن»: فحص علق (تطبيق iPhone بعد الاستئناف) يُعاد بعد المهلة فيظهر الزر بلا تغيير الشبكة ──
    { const ctx = await newCtx({ viewport: { width: 390, height: 844 } }); let armed = 0, failAll = false, newer = false;
      let failSite = false;
      await ctx.route(/\/site\?h=/, async r => { if (failSite) { try { await r.abort('connectionreset'); } catch {} return; } await r.fallback(); });
      await ctx.route(/teacher-dashboard\/\?_sw=/, async r => {
        if (failAll) { try { await r.abort('connectionreset'); } catch {} return; }
        if (!armed && !newer) { try { await r.continue(); } catch {} return; }
        if (armed && armed++ === 1) { await new Promise(x => setTimeout(x, 14000)); try { await r.abort(); } catch {} return; }   // الأول يعلق
        if (!armed) newer = false;   // الإصدار الأحدث يُقدَّم مرة واحدة (بعدها الموقع «محدَّث»)
        const res = await r.fetch(); const html = (await res.text()).replace(/(js\/08\.js\?v=)[0-9a-f]{8}/, '$1deadbeef');
        try { await r.fulfill({ response: res, body: html }); } catch {} });
      // شاشة التحديث تظهر لحظة ثم يُعاد التحميل: نسجّل ظهورها فيما يبقى بعد إعادة التحميل
      await ctx.addInitScript(() => { new MutationObserver(() => { if (document.getElementById('upd-ov') && !window.__sawOv) { window.__sawOv = 1; try { sessionStorage.setItem('saw_ov', String(Number(sessionStorage.getItem('saw_ov') || 0) + 1)); } catch {} } }).observe(document, { childList: true, subtree: true }); });
      const sawOv = async (min, ms) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (Number(await p.evaluate(() => sessionStorage.getItem('saw_ov') || 0)) >= min) return true; } catch {} await new Promise(x => setTimeout(x, 150)); } return false; };
      const p = await ctx.newPage(), errs = watch(p);
      await S.t('زر «تحديث الآن»: فحص الإصدار العالق يُلغى بعد مهلة ويُعاد، فيظهر الزر (لا يحتاج إطفاء الواي فاي)', async () => {
        await p.goto(base + '/teacher-dashboard/'); await p.evaluate(t => localStorage.setItem('hwapp_tok_v1', t), TOKEN); await p.reload(); await dashReady(p);
        await p.evaluate(() => { const i = [...document.querySelectorAll('input')].find(x => x.offsetParent && /^(search|text|)$/.test(x.getAttribute('type') || '')); i.focus(); });   // وسط عمل: لا يُعاد التحميل
        armed = 1; failSite = true; await p.evaluate(() => dispatchEvent(new Event('online')));   // الطريق عبر الخادم معطّل هنا: نختبر إعادة المحاولة المباشرة
        await p.waitForTimeout(4000); ok(!(await p.$('#dash-upd')), 'ظهر قبل الأوان');
        await p.waitForSelector('#dash-upd', { timeout: 20000 }); ok(armed >= 3, 'لم يُعد الفحص'); failSite = false;
        ok(await p.evaluate(() => /الإصدار v\d+\.\d+\.\d+/.test(document.querySelector('#main-nav [data-appver]').textContent) && /يوجد إصدار أحدث/.test(document.querySelector('#main-nav [data-appver]').textContent)), 'رقم الإصدار وحالته'); eq(errs, [], 'أخطاء'); });
      await S.t('لازم آخر نسخة — وسط عمل: شريط «تحديث مطلوب» بلا ✕ ولا يقطع، و«تحديث الآن» يحدّث', async () => {
        ok(await p.evaluate(() => !document.querySelector('#dash-upd [aria-label="لاحقًا"]') && /تحديث مطلوب/.test(document.getElementById('dash-upd').textContent) && !document.getElementById('upd-ov')), 'الشريط');
        armed = 0; await p.evaluate(() => sessionStorage.setItem('saw_ov', '0')); await p.evaluate(() => document.querySelector('#dash-upd button').click());
        ok(await sawOv(1, 8000), 'لم تظهر شاشة التحديث'); await p.waitForTimeout(1500);
        await p.waitForFunction(() => !document.getElementById('upd-ov') && typeof goTab === 'function', null, { timeout: 30000 }); eq(errs, [], 'أخطاء'); });
      await S.t('«إجبار كل الأجهزة»: لا يعلق إن لم يرد الموقع (واي فاي البيت) ولا يمسح المحفوظ', async () => {
        await p.waitForFunction(() => typeof APPUPD === 'object' && typeof goTab === 'function', null, { timeout: 30000 });
        await p.evaluate(async () => { await (await caches.open('keep-me')).put('/x', new Response('1')); window.__old = 1;
          Object.defineProperty(navigator.serviceWorker, 'getRegistrations', { configurable: true, value: async () => [{ update: () => new Promise(() => {}) }] });
          APPUPD.mark(Date.now()); APPUPD.apply(); });
        const t = Date.now(); await p.waitForFunction(() => !window.__old && typeof goTab === 'function', null, { timeout: 15000 });
        ok(Date.now() - t < 12000, 'طال ' + (Date.now() - t)); ok(await p.evaluate(() => caches.has('keep-me')), 'مُسح المحفوظ'); eq(errs, [], 'أخطاء'); });
      await S.t('لازم آخر نسخة — عند الفتح: إصدار أحدث ⇒ شاشة «جارٍ تحديث التطبيق» ثم يُفتح عليه وحده', async () => {
        ok(/جارٍ تحديث التطبيق/.test(await p.evaluate(() => { updOverlay('مساعد المعلم'); const t = document.getElementById('upd-ov').textContent; document.getElementById('upd-ov').remove(); return t; })), 'نص الشاشة');
        await p.evaluate(() => { sessionStorage.removeItem('upd_auto'); sessionStorage.setItem('saw_ov', '0'); }); newer = true; await p.goto(base + '/teacher-dashboard/');
        ok(await sawOv(1, 20000), 'لم تظهر شاشة التحديث عند الفتح'); newer = false; await p.waitForTimeout(2000);
        await p.waitForFunction(() => !document.getElementById('upd-ov') && typeof goTab === 'function', null, { timeout: 30000 });
        eq(await p.evaluate(() => JSON.parse(sessionStorage.getItem('upd_auto')).n), 1, 'أُعيد الفتح مرة واحدة'); eq(errs, [], 'أخطاء'); });
      await S.t('لازم آخر نسخة — لا دوامة: إن بقي الإصدار القديم بعد محاولتين يظهر الشريط بدل إعادة التحميل', async () => {
        newer = true; await p.evaluate(() => sessionStorage.setItem('upd_auto', JSON.stringify({ n: 2, at: Date.now() }))); await p.goto(base + '/teacher-dashboard/'); await dashReady(p);
        await p.waitForSelector('#dash-upd', { timeout: 20000 }); ok(!(await p.$('#upd-ov')), 'أعاد التحميل رغم المحاولتين'); newer = false; eq(errs, [], 'أخطاء'); });
      await S.t('رقم الإصدار: «اضغط للتحقق» ← «أحدث إصدار» حين لا جديد، ويظهر في «المزيد»', async () => {
        armed = 0; newer = false; await p.evaluate(() => sessionStorage.removeItem('upd_auto')); await p.goto(base + '/teacher-dashboard/'); await dashReady(p);
        await p.evaluate(() => window.appVerCheck()); await p.waitForFunction(() => /أحدث إصدار/.test(document.querySelector('#main-nav [data-appver]').textContent), null, { timeout: 15000 });
        await p.evaluate(() => document.querySelector('[data-simp-more]').click()); await p.waitForTimeout(300);
        ok(await p.evaluate(() => /الإصدار .*أحدث إصدار/.test((document.querySelector('.simp-sh-ver') || {}).textContent || '')), 'في «المزيد»'); eq(errs, [], 'أخطاء'); });
      await S.t('رقم الإصدار: الموقع لا يرد مباشرة ⇒ يُتحقق عبر الخادم؛ وإن فشل الاثنان «تعذّر التحقق»', async () => {
        failAll = true; await p.evaluate(() => window.appVerCheck());
        await p.waitForFunction(() => /أحدث إصدار/.test(document.querySelector('#main-nav [data-appver]').textContent), null, { timeout: 15000 });
        eq(await p.evaluate(() => APPVER.via), 'server', 'الموقع لا يرد مباشرة: يجب أن يُتحقق عبر الخادم');
        failSite = true; await p.evaluate(() => window.appVerCheck());
        await p.waitForFunction(() => /تعذّر التحقق/.test(document.querySelector('#main-nav [data-appver]').textContent), null, { timeout: 25000 });
        ok(!/خادم البيانات/.test(await p.evaluate(() => document.querySelector('#main-nav [data-appver]').textContent)), 'التشخيص المؤقت ما زال ظاهرًا'); failAll = false; failSite = false; eq(errs, [], 'أخطاء'); });
      await ctx.close(); }
    // ── ⏳ التحميل المؤجَّل: زر يُضغط قبل وصول الجزء المؤجَّل يعمل بعد وصوله ──
    { const ctx = await newCtx({ viewport: { width: 390, height: 844 } }); await ctx.route(/-lazy\.js|30-noor-export/, async r => { await new Promise(x => setTimeout(x, 9000)); try { await r.continue(); } catch {} });
      const p = await ctx.newPage(), errs = watch(p);
      await S.t('التحميل المؤجَّل: زر قبل وصول الجزء يعمل بعده، وكل البدائل المؤقتة تُستبدل', async () => {
        await p.goto(base + '/teacher-dashboard/'); await p.evaluate(t => localStorage.setItem('hwapp_tok_v1', t), TOKEN); await p.reload(); await dashReady(p);
        eq(await p.evaluate(() => [!!window.LZ_READY, String(window.noorExportOpen).includes('lzLoad')]), [false, true], 'الجزء وصل قبل الضغط');
        await p.evaluate(() => { goTab('reports'); noorExportOpen(); }); await p.waitForFunction(() => window.LZ_READY, null, { timeout: 20000 }); await p.waitForTimeout(600);
        ok(await p.evaluate(() => /نظام نور/.test((document.querySelector('#modal, .modal') || {}).innerText || '')), 'لم تُفتح نافذة نور');
        eq(await p.evaluate(() => LZ_STUBS.filter(n => typeof window[n] !== 'function' || String(window[n]).includes('lzLoad'))), [], 'بدائل لم تُستبدل'); eq(errs, [], 'أخطاء'); });
      await ctx.close(); }
    // ── ⚡ سرعة التنقل: الاختبارات تعيد استخدام القياس، ونافس يرسم أسئلة القسم المفتوح فقط ──
    { const ctx = await newCtx(); const p = await ctx.newPage(), errs = watch(p);
      await S.t('الاختبارات: الفتح الثاني يعيد القياس المحفوظ والورقة نفسها · نافس: أسئلة القسم تُرسم عند فتحه', async () => {
        await p.goto(base + '/teacher-dashboard/'); await p.evaluate(t => localStorage.setItem('hwapp_tok_v1', t), TOKEN); await p.reload(); await dashReady(p);
        await p.evaluate(() => document.fonts.ready); await p.evaluate(() => goTab('exam')); await p.waitForTimeout(800);
        const a = await p.evaluate(() => [document.getElementById('exam-paper').innerHTML, EX_MEASURE_CACHE.size]);
        await p.evaluate(() => goTab('dashboard')); await p.evaluate(() => goTab('exam')); await p.waitForTimeout(800);
        const b = await p.evaluate(() => [document.getElementById('exam-paper').innerHTML, EX_MEASURE_CACHE.size]);
        ok(a[0].length > 200 && a[0] === b[0], 'الورقة تغيّرت بين الفتحين'); ok(a[1] > 0 && b[1] === a[1], 'القياس لم يُحفظ/أُعيد: ' + a[1] + ' → ' + b[1]);
        await p.evaluate(() => goTab('nafs')); await p.waitForSelector('#nafs-root details', { timeout: 15000 });
        const r = await p.evaluate(() => { const D = [...document.querySelectorAll('#nafs-root .nafs-sec details')], c = D.find(d => !d.open);
          const closedEmpty = D.filter(d => !d.open).every(d => !d.querySelector('.nafs-qs').childElementCount); c.open = true; return new Promise(ok => setTimeout(() => ok([closedEmpty, c.querySelector('.nafs-qs').childElementCount]), 100)); });
        ok(r[0], 'أقسام مغلقة فيها أسئلة مرسومة'); ok(r[1] > 0, 'فتح القسم لم يرسم أسئلته'); eq(errs, [], 'أخطاء'); });
      await ctx.close(); }
    // ── 🎤 البحث بالصوت في خانات البحث عن طالب ──
    { const ctx = await newCtx({ viewport: { width: 390, height: 844 } });
      // 🍎 محاكاة iPhone: بعد إغلاق أي جلسة، أي كائن تعرّف جديد لا يصله صوت؛ والنص يطول في نتيجة واحدة غير نهائية
      await ctx.addInitScript(() => { window.__made = 0; window.__deaf = false; window.__live = null;
        class FakeSR extends EventTarget { constructor() { super(); window.__made++; this.on = false; this.deaf = window.__deaf; this.text = ''; }
          _fire(type, props) { const e = new Event(type); Object.assign(e, props || {}); const h = this['on' + type]; this.dispatchEvent(e); if (h) h.call(this, e); }
          start() { if (this.on) { const e = new Error('already'); e.name = 'InvalidStateError'; throw e; } this.on = true; this.text = ''; window.__live = this; setTimeout(() => this._fire('start'), 10); }
          stop() { if (!this.on) return; this.on = false; window.__deaf = true; setTimeout(() => this._fire('end'), 20); } abort() { this.stop(); }
          say(t) { if (!this.on || this.deaf) return false; this.text = (this.text + ' ' + t).trim(); const res = [{ transcript: this.text }]; res.isFinal = false; this._fire('result', { resultIndex: 0, results: [res] }); return true; } }
        window.SpeechRecognition = window.webkitSpeechRecognition = FakeSR; window.__say = t => !!(window.__live && window.__live.say(t)); });
      const p = await ctx.newPage(), errs = watch(p);
      await S.t('البحث بالصوت: ميكروفون في خانات البحث عن طالب (لا في «الرصد»)، والاسم المنطوق يُكتب ويصفّي', async () => {
        await p.goto(base + '/teacher-dashboard/'); await p.evaluate(t => localStorage.setItem('hwapp_tok_v1', t), TOKEN); await p.reload(); await dashReady(p);
        eq(await p.evaluate(() => ['th-q', 'students-center-search', 'wk-search', 'projects-search'].map(id => !!document.querySelector('#' + id + ' + .vs-mic'))), [true, true, true, true], 'خانات بلا ميكروفون');
        await p.evaluate(() => goTab('students')); await p.waitForTimeout(600); await p.click('#students-center-search + .vs-mic'); await p.waitForTimeout(100); await p.evaluate(() => window.__say('ابحث عن الاختبار الثاني.')); await p.waitForTimeout(1700);
        eq(await p.evaluate(() => document.getElementById('students-center-search').value), 'الاختبار الثاني', 'لم يُكتب الاسم');
        ok(await p.evaluate(() => [...document.querySelectorAll('.student-list-item')].every(e => e.textContent.includes('الثاني'))), 'لم تُصفَّ القائمة');
        // المرة الثانية والثالثة (كانت لا تعمل على iPhone: جلسة جديدة صمّاء) — والرصد بالصوت بينهما على الكائن نفسه
        for (const say of ['الاختبار الأول', 'الاختبار الثاني']) { await p.click('#students-center-search + .vs-mic'); await p.waitForTimeout(100); ok(await p.evaluate(t => window.__say(t), say), 'الميكروفون لا يسمع في المرة التالية'); await p.waitForTimeout(1700);
          eq(await p.evaluate(() => document.getElementById('students-center-search').value), say, 'لم يُكتب الاسم في المرة التالية'); }
        eq(await p.evaluate(() => window.__made), 1, 'أُنشئ أكثر من كائن تعرّف');
        // 🔎 المطابقة الذكية (كل خانات البحث): همزات وحروف مخفية وعبد الله/عبدالله و«ال» وخطأ حرف في الطويلة وأي ترتيب — بلا خلط «احمد/محمد»
        const N = ['أحمد بن صالح الغامدي', 'محمد عبدالله العتيبي', 'حمد سالم الحربي', 'عبد الرحمن فهد الشهراني', 'سالم بن محمد القحطاني'];
        const M = await p.evaluate(N => [['احمد\u200f'], ['حمد'], ['عبدالرحمن'], ['الشهرنى'], ['القحطانى سالم'], ['عتيبي'], ['ابن صالح']].map(([q]) => N.filter(n => stuMatch(q, n)).length ? N.filter(n => stuMatch(q, n)).map(n => N.indexOf(n)) : []), N);
        eq(M, [[0], [2], [3], [3], [4], [1], [0]], 'المطابقة الذكية');
        await p.evaluate(() => goTab('dashboard')); await p.fill('#th-q', 'الإختبار الثانى'); await p.waitForTimeout(300);
        ok(await p.evaluate(() => document.getElementById('th-res').innerText.includes('طالب الاختبار الثاني')), 'بحث «اليوم» لم يجد الاسم بهمزة/ياء مختلفة');
        await p.evaluate(() => { window._ctRcCls = 'أول 1'; window._ctRcClsUser = 1; window._ctRcView = 'day'; ctGo('records'); }); await p.waitForSelector('#qr-q', { timeout: 15000 });
        eq(await p.evaluate(() => !!document.querySelector('#qr-q + .vs-mic, #qr-q').closest('.vs-wrap')), false, 'ميكروفون بحث أُضيف لخانة الرصد'); eq(errs, [], 'أخطاء'); });
      await ctx.close(); }
    // ── كل الصفحات تفتح بلا أخطاء (يحمي من حذف دالة ما زالت مستخدمة) ──
    { const ctx = await newCtx(); const p = await ctx.newPage(), errs = watch(p);
      await S.t('كل صفحات اللوحة وأدوات الفصل وملف الطالب تفتح بلا أخطاء برمجية', async () => {
        await p.goto(base + '/teacher-dashboard/'); await p.evaluate(t => localStorage.setItem('hwapp_tok_v1', t), TOKEN); await p.reload(); await dashReady(p);
        for (const t of 'dashboard data hw madrasati plans students walls classtools exam exam-shop grades live messages nafs projects reports analysis compan comprehensive diag styles weekly'.split(' ')) { await p.evaluate(t => goTab(t), t); await p.waitForTimeout(400); }
        for (const t of 'records classfile exams messages reminders schedule'.split(' ')) { await p.evaluate(t => ctGo(t), t); await p.waitForTimeout(700); }
        await p.evaluate(() => openStudentProfile('s1')); await p.waitForTimeout(700); await p.evaluate(() => studentReport('s2')); await p.waitForTimeout(700);
        eq(errs, [], 'أخطاء'); });
      await ctx.close(); }
    // ── ✨ التصميم العصري وثيمات «مظهر التطبيق» ──
    { const ctx = await newCtx({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(), errs = watch(p);
      const navBg = async th => { await p.goto(base + '/teacher-dashboard/'); await p.evaluate(([t, th]) => { localStorage.setItem('hwapp_tok_v1', t); if (th) localStorage.setItem('oasis_theme_v1', JSON.stringify(th)); else localStorage.removeItem('oasis_theme_v1'); }, [TOKEN, th]);
        await p.reload(); await p.waitForFunction(() => typeof ctGo === 'function', null, { timeout: 15000 }); await p.waitForTimeout(800);
        const r = await p.evaluate(() => [JSON.parse(localStorage.getItem('oasis_theme_v1') || '{}').name || 'modern', document.documentElement.style.getPropertyValue('--app-nav-bg'), localStorage.getItem('oasis_theme_v1')]); if (process.env.THDBG) console.log('THDBG', JSON.stringify(th), r[2]); return r.slice(0, 2); };
      await S.t('الأيقونات: الشريط السفلي وأزرار الرصد بأيقونات خطية لا إيموجي', async () => {
        await navBg(null); await p.waitForTimeout(500);
        const nb = await p.evaluate(() => [...document.querySelectorAll('#simp-bottomnav .simp-bic')].map(e => [!!e.querySelector('svg.ico'), e.textContent.trim()]));
        ok(nb.length >= 4 && nb.every(([sv, t]) => sv && !t), 'الشريط السفلي: ' + JSON.stringify(nb));
        await p.click('#simp-bottomnav button:nth-child(3)'); await p.waitForTimeout(600); await p.click('#simp-bottomnav button:nth-child(1)'); await p.waitForTimeout(600);   // الشريط يُعاد بناؤه بعد التنقل
        await p.evaluate(() => goTab('hw')); await p.waitForTimeout(800);
        const chips = await p.evaluate(() => [...document.querySelectorAll('#simp-strip .simp-chip')].map(e => [!!e.querySelector('svg.ico'), e.textContent.trim().slice(0, 2)]));
        ok(chips.length >= 2 && chips.every(([sv, t]) => sv && t !== '•'), 'أزرار الأقسام: ' + JSON.stringify(chips));
        const nb2 = await p.evaluate(() => [...document.querySelectorAll('#simp-bottomnav .simp-bic')].map(e => !!e.querySelector('svg.ico'))); ok(nb2.length >= 4 && nb2.every(Boolean), 'اختفت بعد التنقل: ' + JSON.stringify(nb2));
        await p.evaluate(() => { window._ctRcCls = 'أول 1'; window._ctRcClsUser = 1; window._ctRcView = 'day'; ctGo('records'); }); await p.waitForSelector('#qr-root .qr-row .c svg.ico', { timeout: 15000 });
        eq(await p.$$eval('#qr-root .qr-row[data-sid=s1] .c', b => b.map(x => x.textContent.trim())), ['', '', ''], 'بقي إيموجي في أزرار الرصد'); });
      await S.t('الأيقونات موحّدة: الوسوم وأزرار البطاقات ووسط السطر خطية، والقوائم المنسدلة بلا إيموجي، ومحتوى الرسائل كما هو', async () => {
        const r = await p.evaluate(async () => {
          const box = document.createElement('div'); box.id = 'ico-t';
          box.innerHTML = '<span class="pill">🎯 تدريب</span><button class="btn">🩹</button><span class="act-kind">📖 فهم قرائي</span><span>0/3 · 📎 سُلّم</span>'
            + '<select><option value="reading">📖 فهم قرائي</option></select><div class="msg-body"><span>🎯 رسالة طالب</span></div>';
          document.querySelector('.wrap').appendChild(box); await new Promise(x => setTimeout(x, 150));
          const emo = el => /\p{Extended_Pictographic}/u.test(el.textContent), q = s => box.querySelector(s);
          const out = [[...box.querySelectorAll('.pill,.btn,.act-kind,span:not(.msg-body span)')].filter(e => !e.closest('.msg-body') && !e.closest('svg')).map(e => !emo(e) && !!e.querySelector('svg.ico')),
            [q('option').textContent.trim(), q('select').value], emo(q('.msg-body'))];
          box.remove(); return out; });
        ok(r[0].length >= 4 && r[0].every(Boolean), 'بقي إيموجي: ' + JSON.stringify(r[0]));
        eq(r[1], ['فهم قرائي', 'reading'], 'القائمة المنسدلة'); eq(r[2], true, 'غيّر محتوى رسالة'); eq(errs, [], 'أخطاء'); });
      await S.t('الفتح: الشكل الجديد من أول رسم — ألوان الثيم، والتنقل الجديد بآخر شكل، والأيقونات في الصفحة نفسها، ولا شريط قديم', async () => {
        // ثيم مخصص at:0 ⇒ لا يُرفع للخادم فلا يؤثر في اختبارات الثيم بعده
        await p.goto(base + '/teacher-dashboard/'); await p.waitForTimeout(1500);   // يُحفظ آخر شكل للتنقل
        await p.evaluate(t => { localStorage.setItem('hwapp_tok_v1', t); localStorage.setItem('oasis_theme_v1', JSON.stringify({ name: 'custom', at: 0, vars: { '--app-nav-bg': '#224466', '--paper': '#FAF0E6' } })); }, TOKEN);
        await p.route(/\.js(\?|$)/, async r => { if (/workers\.dev/.test(r.request().url())) return r.fallback(); await new Promise(x => setTimeout(x, 2500)); try { await r.continue(); } catch {} });   // كل السكربتات متأخرة: ما يُرى هو الصفحة نفسها
        await p.reload({ waitUntil: 'commit' }); await p.waitForSelector('#simp-bottomnav', { state: 'attached' });
        const early = await p.evaluate(() => [typeof goTab, document.documentElement.style.getPropertyValue('--app-nav-bg'), document.body.classList.contains('simp-nav'), document.querySelectorAll('#simp-bottomnav button').length >= 4,
          !!document.querySelector('.mobile-nav, #mobile-nav'), !!document.querySelector('#main-nav .tab svg.ico')]);
        eq(early, ['undefined', '#224466', true, true, false, true], 'قبل تحميل أي سكربت');
        await p.unroute(/\.js(\?|$)/); await p.waitForFunction(() => typeof goTab === 'function', null, { timeout: 20000 }); await p.waitForTimeout(800);
        await p.click('#simp-bottomnav button:nth-child(2)'); await p.waitForTimeout(500); eq(await p.evaluate(() => (document.querySelector('.panel.on') || {}).id), 'p-hw', 'أزرار الشريط لا تعمل بعد الربط');
        await p.evaluate(() => localStorage.removeItem('oasis_theme_v1')); eq(errs, [], 'أخطاء'); });
      await S.t('الثيم: بلا اختيار سابق ⇒ «عصري»', async () => { eq((await navBg(null))[1], '#FFFFFF'); });
      await S.t('الثيم: ثيم جاهز اختير قبل التصميم الجديد ينتقل مرة واحدة إلى «عصري»', async () => { eq((await navBg({ name: 'oasis', at: 1700000000000, vars: { '--app-nav-bg': '#123332' } }))[0], 'modern'); });
      await S.t('الثيم: ثيم جاهز اختير بعده يبقى، والألوان المخصصة تبقى', async () => {
        eq(await navBg({ name: 'oasis', at: Date.now() + 5000, vars: { '--app-nav-bg': '#123332' } }), ['oasis', '#123332']);
        eq(await navBg({ name: 'custom', at: Date.now() + 5000, vars: { '--app-nav-bg': '#445566' } }), ['custom', '#445566']); eq(errs, [], 'أخطاء'); });
      await S.t('الثيم: بطاقة «اليوم» تتبع لون تمييز الثيم (لا أخضر ثابت)، ولو كان محفوظًا من قبل', async () => {
        const hero = () => p.evaluate(() => { const h = document.createElement('div'); h.className = 'td-hero'; document.body.appendChild(h); const c = getComputedStyle(h).backgroundColor; h.remove(); return [c, document.documentElement.style.getPropertyValue('--m-hero')]; });
        await navBg({ name: 'custom', at: Date.now() + 5000, vars: { '--app-nav-bg': '#16233A', '--ui-accent': '#3A5F8F', '--m-hero': '#0F9D74' } });
        eq(await hero(), ['rgb(58, 95, 143)', ''], 'مخصص'); await navBg({ name: 'modern', at: Date.now() + 9000, vars: {} }); eq((await hero())[0], 'rgb(15, 157, 116)', 'عصري'); eq(errs, [], 'أخطاء'); });
      await ctx.close(); }
    // ── بوابة الطالب ──
    { const ctx = await newCtx({ viewport: { width: 390, height: 800 } }), p = await ctx.newPage(), errs = watch(p);
      await S.t('بوابة الطالب: الرئيسية بلا أخطاء', async () => { await p.goto(base + '/student-portal/index.html'); await p.waitForTimeout(3000); eq(errs, [], 'أخطاء'); });
      await S.t('بوابة الطالب: رقم التنبيهات الجديدة على زر 🔔 ويختفي بعد فتحها', async () => {
        const rows = n => [...Array(n)].map((_, i) => ({ id: 'bl' + i, t: 'نشاط ' + i, reviewPending: true }));
        const st = () => p.evaluate(() => { const b = document.getElementById('hs-notes-bdg'); return b ? (b.hidden ? '' : b.textContent) : 'x'; });
        await p.evaluate(async r => { localStorage.removeItem('hwapp_seen_notices_v1'); await loadStudentSpace('طالب البالون', r); }, rows(2)); await p.waitForTimeout(500);
        eq(await st(), '2', 'رقم بعد الدخول');
        await p.click('.hs-nav [data-nav="notes"]'); await p.waitForTimeout(1700); eq(await st(), '', 'يختفي بعد الفتح');
        await p.evaluate(async r => loadStudentSpace('طالب البالون', r), rows(3)); await p.waitForTimeout(500); eq(await st(), '1', 'الجديد فقط');
        eq(errs, [], 'أخطاء');
      });
      await S.t('بوابة الطالب: رابط النشاط يجلبه من الخادم', async () => {
        ctx.reqs.length = 0; await p.goto('about:blank'); await p.goto(base + '/student-portal/index.html#act1'); await p.waitForTimeout(4000);
        ok(ctx.reqs.some(x => x.u.startsWith('/hw?') && x.u.includes('act1')), 'لم يُطلب النشاط'); eq(errs, [], 'أخطاء');
        ok(ctx.reqs.every(x => !x.h), 'طلب الطالب يحمل ترويسة معلم!'); });
      await S.t('بوابة الطالب: لا تحديث تلقائي وسط النشاط', async () => {
        await p.evaluate(() => { window.__m = 1; APPUPD.mark(); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
        await p.waitForTimeout(1500); ok(await p.evaluate(() => window.__m === 1).catch(() => false), 'أُعيد تحميل الصفحة وسط النشاط');
        ok(await p.evaluate(() => /تحديث مطلوب/.test((document.getElementById('sp-upd') || {}).textContent || '') && document.querySelectorAll('#sp-upd button').length === 1 && !document.getElementById('upd-ov')), 'شريط «تحديث مطلوب» بلا ✕'); });
      await ctx.close(); }
    // ── بوابة الطالب: مقدمة تطبيق الآيفون وصور البداية ──
    for (const app of [true, false]) {
      const ctx = await newCtx({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
      if (app) await ctx.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); window.__intro = []; new MutationObserver(() => { const e = document.getElementById('boot-intro'); if (e && e.style.display === 'flex' && !window.__intro.length) window.__intro.push(Date.now()); }).observe(document, { subtree: true, attributes: true, childList: true }); });
      const p = await ctx.newPage(), errs = watch(p);
      await S.t(app ? 'بوابة الطالب: مقدمة تطبيق الآيفون تظهر بالأيقونة وتختفي بعد جاهزية البوابة' : 'بوابة الطالب: لا مقدمة في المتصفح العادي، وصور البداية موجودة بمقاس كل جهاز', async () => {
        await p.goto(base + '/student-portal/index.html'); await p.waitForTimeout(2500);
        eq(await p.evaluate(() => [!!document.getElementById('boot-intro'), (window.__intro || []).length]), [false, app ? 1 : 0]);
        if (!app) { const r = await p.evaluate(async () => { const out = []; for (const l of document.querySelectorAll('link[rel="apple-touch-startup-image"]')) { const im = new Image(); im.src = l.href; const ok = await new Promise(x => { im.onload = () => x(true); im.onerror = () => x(false); });
            const m = /device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)/.exec(l.media); out.push([l.getAttribute('href'), ok && im.naturalWidth === m[1] * m[3] && im.naturalHeight === m[2] * m[3]]); } return out; });
          ok(r.length >= 12, 'صور البداية: ' + r.length); eq(r.filter(x => !x[1]), [], 'صور مفقودة أو بمقاس خطأ'); }
        eq(errs, [], 'أخطاء'); });
      await ctx.close(); }
    // ── بوابة الطالب: رقم الإصدار و«لازم آخر نسخة» ──
    { const ctx = await newCtx({ viewport: { width: 390, height: 800 } }); let newer = false;
      await ctx.route(/student-portal\/(index\.html)?\?_sw=/, async r => { if (!newer) { try { await r.continue(); } catch {} return; }
        newer = false; const res = await r.fetch(); const html = (await res.text()).replace(/(js\/06\.js\?v=)[0-9a-f]{8}/, '$1deadbeef'); try { await r.fulfill({ response: res, body: html }); } catch {} });
      await ctx.addInitScript(() => { new MutationObserver(() => { if (document.getElementById('upd-ov') && !window.__sawOv) { window.__sawOv = 1; try { sessionStorage.setItem('saw_ov', String(Number(sessionStorage.getItem('saw_ov') || 0) + 1)); } catch {} } }).observe(document, { childList: true, subtree: true }); });
      const p = await ctx.newPage(), errs = watch(p);
      const sawOv = async (min, ms) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (Number(await p.evaluate(() => sessionStorage.getItem('saw_ov') || 0)) >= min) return true; } catch {} await new Promise(x => setTimeout(x, 150)); } return false; };
      await S.t('بوابة الطالب: رقم الإصدار في السطر الأخير، والتحقق ⇒ «أحدث إصدار»', async () => {
        await p.goto(base + '/student-portal/index.html'); await p.waitForTimeout(1500);
        await p.evaluate(() => window.appVerCheck()); await p.waitForFunction(() => /الإصدار v\d+\.\d+\.\d+.*أحدث إصدار/.test((document.querySelector('#app-developer-credit [data-appver]') || {}).textContent || ''), null, { timeout: 15000 }); eq(errs, [], 'أخطاء'); });
      await S.t('بوابة الطالب: إصدار أحدث عند الفتح ⇒ شاشة «جارٍ تحديث التطبيق» بأيقونة البوابة، ثم تُفتح عليه', async () => {
        ok(await p.evaluate(() => { updOverlay('أنشطتي'); const o = document.getElementById('upd-ov'), t = /أنشطتي[\s\S]*جارٍ تحديث التطبيق/.test(o.textContent) && !!o.querySelector('img[src^="data:image/png"]'); o.remove(); return t; }), 'الشاشة');
        await p.evaluate(() => { sessionStorage.removeItem('upd_auto'); sessionStorage.setItem('saw_ov', '0'); }); newer = true; await p.goto(base + '/student-portal/index.html');
        ok(await sawOv(1, 20000), 'لم تظهر شاشة التحديث'); newer = false; await p.waitForTimeout(2500);
        ok(await p.evaluate(() => !document.getElementById('upd-ov') && typeof APPUPD === 'object'), 'لم تُفتح بعد التحديث'); eq(errs, [], 'أخطاء'); });
      await ctx.close(); }
    // ── المختبر ──
    { const ctx = await newCtx(), p = await ctx.newPage(), errs = watch(p);
      await S.t('المختبر: تجربة المخاليط + المرشد + «ما عرفت»', async () => {
        await p.goto(base + '/student-portal/lab/index.html'); await p.evaluate(() => localStorage.setItem('lab:student', JSON.stringify('طالب'))); await p.reload(); await p.waitForTimeout(800);
        await p.click('[data-topic=mixtures]'); await p.waitForTimeout(1500);
        ok(await p.$('#gtext'), 'لا مرشد'); await p.click('.ghelp'); await p.waitForTimeout(800);
        ok(await p.$eval('.ghint', e => e.textContent.length > 5), 'لا تلميح'); eq(errs, [], 'أخطاء'); });
      await S.t('المختبر: كل التجارب تفتح بلا أخطاء', async () => {
        const ids = await p.evaluate(() => TOPICS.filter(t => t.ready).map(t => t.id)); const bad = [];
        for (const id of ids) { errs.length = 0; await p.evaluate(() => go('home')); await p.waitForTimeout(200); await p.click(`[data-topic=${id}]`); await p.waitForTimeout(700); if (errs.length) bad.push(id + ': ' + errs[0]); }
        eq(bad, [], 'تجارب فيها أخطاء'); ok(ids.length >= 5, 'تجارب قليلة: ' + ids.length); });
      await ctx.close(); }
  } finally { await b.close(); wsrv.close(); ssrv.close(); }
  return S;
}
