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
    await ctx.route(/workers\.dev/, async r => { const u = new URL(r.request().url()); if (ctx.offline) return r.abort('internetdisconnected'); reqs.push({ u: u.pathname + u.search, h: r.request().headers()['x-teacher-token'] || '' });
      try { r.fulfill({ response: await r.fetch({ url: 'http://localhost:' + WP + u.pathname + u.search }) }); } catch { r.abort(); } });
    ctx.reqs = reqs; return ctx; };
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
      // ── بوابة المعلم ──
      await S.t('بوابة المعلم تفتح بنفس الدخول بلا أخطاء', async () => {
        const q = await ctx.newPage(), e2 = watch(q); await q.goto(base + '/teacher-dashboard/portal/'); await q.waitForTimeout(5000);
        ok(await q.evaluate(() => !!window.__portalBooted && !document.getElementById('gate').classList.contains('show')), 'لم تفتح'); eq(e2, [], 'أخطاء'); });
      await S.t('بوابة المعلم: «المستويات ↗» تفتح أدوات الفصل في اللوحة (لا تكرار)', async () => {
        const q = await ctx.newPage(), e3 = watch(q); await q.goto(base + '/teacher-dashboard/portal/'); await q.waitForTimeout(3500);
        await q.evaluate(() => openTeacherPanel('students')); await q.waitForTimeout(300);
        const tabs = await q.$$eval('#students .subtabs button', bs => bs.map(b => b.textContent.trim())); ok(tabs.includes('المستويات ↗') && tabs.includes('المهام ↗'), 'الأزرار: ' + tabs.join('،'));
        await q.click('#students .subtabs [data-dash=levels]'); await q.waitForURL(/teacher-dashboard\/(\?|$)/, { timeout: 8000 }); await q.waitForTimeout(3500);
        ok(await q.evaluate(() => typeof CT_TAB !== 'undefined' && CT_TAB === 'levels' && !!document.querySelector('#p-classtools.on')), 'لم تُفتح المستويات في اللوحة'); eq(e3, [], 'أخطاء'); });
      await ctx.close(); }
    // ── 📶 الرصد بلا شبكة لا يضيع ──
    { await env.HW.put('teacher:classroom', JSON.stringify({ participation: { '2020-01-01': { s2: { status: 'شارك', at: 1 } } } }));
      const ctx = await newCtx({ viewport: { width: 390, height: 800 } }); let p = await ctx.newPage(); watch(p);
      await p.goto(base + '/teacher-dashboard/portal/'); await p.evaluate(t => localStorage.setItem('hwapp_tok_v1', t), TOKEN); await p.reload(); await p.waitForTimeout(4000);
      const d = await p.evaluate(() => today()), srv = async () => JSON.parse(await env.HW.get('teacher:classroom') || '{}');
      await S.t('رصد بلا شبكة ثم إغلاق التطبيق وفتحه: يصل للخادم ولا يضيع', async () => {
        ctx.offline = true; await p.evaluate(() => quickSet('participation', 's1', 'شارك')); await p.waitForTimeout(2500);
        ok(/لم يُرسل/.test(await p.$eval('#save-text', e => e.textContent)), 'لا تنبيه «لم يُرسل»');
        await p.close(); ctx.offline = false; p = await ctx.newPage(); watch(p); await p.goto(base + '/teacher-dashboard/portal/'); await p.waitForTimeout(6000);
        ok(await p.evaluate(d => !!((data.participation || {})[d] || {}).s1, d), 'ضاع من الجهاز'); const sv = await srv();
        ok(((sv.participation || {})[d] || {}).s1, 'لم يصل للخادم'); ok(((sv.participation || {})['2020-01-01'] || {}).s2, 'ضاع رصد قديم من الخادم'); });
      await S.t('رصد بلا شبكة ثم عودتها والتطبيق مفتوح: يُرسل وحده', async () => {
        ctx.offline = true; await p.evaluate(() => quickSet('participation', 's2', 'شارك')); await p.waitForTimeout(2500);
        ctx.offline = false; await p.evaluate(() => dispatchEvent(new Event('online'))); await p.waitForTimeout(4000);
        ok((((await srv()).participation || {})[d] || {}).s2, 'لم يُرسل بعد عودة الشبكة'); eq(await p.$eval('#save-text', e => e.textContent), 'محفوظ'); });
      await ctx.close(); }
    // ── ✋ الرصد السريع داخل لوحة التحكم ──
    { await env.HW.put('teacher:classroom', JSON.stringify({ participation: { '2020-01-01': { s2: { status: 'شارك', at: 1 } } } }));
      const ctx = await newCtx({ viewport: { width: 390, height: 844 } }); let p = await ctx.newPage(), errs = watch(p);
      const srv = async () => JSON.parse(await env.HW.get('teacher:classroom') || '{}');
      const open = async () => { await p.waitForFunction(() => typeof CT_DATA !== 'undefined' && CT_DATA && typeof qrPaint === 'function', null, { timeout: 15000 });
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
      const open = async () => { await p.waitForFunction(() => typeof CT_DATA !== 'undefined' && CT_DATA && typeof ctExams === 'function', null, { timeout: 15000 });
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
