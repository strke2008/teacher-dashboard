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
        eq(await p.$$eval('.st-panel', x => x.length), 0, 'لوحة الأوقات القديمة ما زالت'); ok(await p.$('#sc-day .sc-r'), 'لا حصص اليوم'); eq(errs, [], 'أخطاء'); });
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
      await S.t('الفتح: ألوان الثيم قبل أول رسم، وشاشة البداية تختفي بعد اكتمال الواجهة', async () => {
        await p.goto(base + '/teacher-dashboard/'); await p.evaluate(t => { localStorage.setItem('hwapp_tok_v1', t); localStorage.setItem('oasis_theme_v1', JSON.stringify({ name: 'custom', at: Date.now(), vars: { '--app-nav-bg': '#224466', '--paper': '#FAF0E6' } })); }, TOKEN);
        await p.route('**/theme-picker.js*', async r => { await new Promise(x => setTimeout(x, 2500)); try { await r.continue(); } catch {} });
        await p.reload({ waitUntil: 'commit' }); await p.waitForSelector('body', { state: 'attached' });
        const early = await p.evaluate(() => [document.documentElement.classList.contains('boot'), document.documentElement.style.getPropertyValue('--app-nav-bg')]);
        eq(early, [true, '#224466'], 'قبل تحميل theme-picker');
        await p.waitForFunction(() => !document.documentElement.classList.contains('boot'), null, { timeout: 15000 }); await p.unroute('**/theme-picker.js*');
        ok(await p.evaluate(() => !!document.getElementById('simp-bottomnav')), 'الشريط السفلي لم يكتمل عند إخفاء شاشة البداية'); eq(errs, [], 'أخطاء'); });
      await S.t('الثيم: بلا اختيار سابق ⇒ «عصري»', async () => { eq((await navBg(null))[1], '#FFFFFF'); });
      await S.t('الثيم: ثيم جاهز اختير قبل التصميم الجديد ينتقل مرة واحدة إلى «عصري»', async () => { eq((await navBg({ name: 'oasis', at: 1700000000000, vars: { '--app-nav-bg': '#123332' } }))[0], 'modern'); });
      await S.t('الثيم: ثيم جاهز اختير بعده يبقى، والألوان المخصصة تبقى', async () => {
        eq(await navBg({ name: 'oasis', at: Date.now() + 5000, vars: { '--app-nav-bg': '#123332' } }), ['oasis', '#123332']);
        eq(await navBg({ name: 'custom', at: Date.now() + 5000, vars: { '--app-nav-bg': '#445566' } }), ['custom', '#445566']); eq(errs, [], 'أخطاء'); });
      await ctx.close(); }
    // ── بوابة الطالب ──
    { const ctx = await newCtx({ viewport: { width: 390, height: 800 } }), p = await ctx.newPage(), errs = watch(p);
      await S.t('بوابة الطالب: الرئيسية بلا أخطاء', async () => { await p.goto(base + '/student-portal/index.html'); await p.waitForTimeout(3000); eq(errs, [], 'أخطاء'); });
      await S.t('بوابة الطالب: رابط النشاط يجلبه من الخادم', async () => {
        ctx.reqs.length = 0; await p.goto('about:blank'); await p.goto(base + '/student-portal/index.html#act1'); await p.waitForTimeout(4000);
        ok(ctx.reqs.some(x => x.u.startsWith('/hw?') && x.u.includes('act1')), 'لم يُطلب النشاط'); eq(errs, [], 'أخطاء');
        ok(ctx.reqs.every(x => !x.h), 'طلب الطالب يحمل ترويسة معلم!'); });
      await S.t('بوابة الطالب: لا تحديث تلقائي وسط النشاط', async () => {
        await p.evaluate(() => { window.__m = 1; APPUPD.mark(); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
        await p.waitForTimeout(1500); ok(await p.evaluate(() => window.__m === 1).catch(() => false), 'أُعيد تحميل الصفحة وسط النشاط'); });
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
