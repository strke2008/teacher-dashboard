/* 🧪 اختبارات الخادم: رحلة الطالب أولًا (الأهم)، ثم دخول المعلم والإشعارات والأوراق */
import { loadWorker, newEnv, caller, suite, eq, ok, TOKEN } from './harness.mjs';

export default async function run() {
  const S = suite('الخادم');
  const W = await loadWorker(), env = newEnv(), call = caller(W, env);
  const ACT = { t: 'نشاط اختبار', kind: 'normal', s: ['s1', 's2'], cm: {}, p: 10,
    q: [{ t: 'q', q: 'سؤال اختيار', o: ['أ', 'ب', 'ج'], a: 1 }, { t: 'tf', q: 'صح أم خطأ', a: true }, { t: 'f', q: 'عاصمة السعودية الرياض', a: 'الرياض' }] };

  // ── 👩‍🎓 الطالب ──
  await S.t('المعلم ينشر نشاطًا', async () => { const r = await call('/publish', { method: 'POST', body: { t: TOKEN, id: 'act1', payload: ACT, silent: true } }); eq(r.s, 200, 'publish'); });
  await S.t('📱 أجهزة الطلاب: الإصدار وتطبيق/متصفح يُسجَّلان من /mine، والقديمة «old»، وللمعلم فقط', async () => {
    const E = newEnv(), C = caller(W, E), ws = []; const job = { waitUntil: p => ws.push(p) };
    const mine = async (q, ua) => { await W.fetch(new Request('https://w.test/mine?' + q, { headers: { 'user-agent': ua } }), E, job); await Promise.all(ws.splice(0)); };
    await mine('name=x&sid=s1&av=1.0.4&dm=app&os=iphone', 'Mozilla iPhone');
    await mine('name=x&sid=s2', 'Mozilla (Linux; Android 14)');
    eq((await C('/app/devices', { method: 'POST', body: { t: 'خطأ' } })).s, 401, 'بلا كلمة سر');
    const r = await C('/app/devices', { method: 'POST', body: { t: TOKEN } }); eq(r.s, 200);
    const by = Object.fromEntries(r.j.list.map(x => [x.id, x]));
    eq([by.s1.v, by.s1.m, by.s1.os], ['1.0.4', 'app', 'iphone'], 'الجديدة');
    eq([by.s2.v, by.s2.os], ['old', 'android'], 'القديمة');
    eq(by.s3.v, '', 'لم يفتح'); ok(!JSON.stringify(r.j).includes('session'), 'لا جلسات');
  });
  await S.t('🕵️ جهاز دخل منه أكثر من طالب يظهر للمعلم، وجهاز طالب واحد لا يظهر', async () => {
    const E = newEnv(), C = caller(W, E), ws = []; const job = { waitUntil: p => ws.push(p) };
    const mine = async q => { await W.fetch(new Request('https://w.test/mine?name=x&os=iphone&dm=app&' + q), E, job); await Promise.all(ws.splice(0)); };
    const A = 'aaaaaaaaaaaaaaaaaaaa', B = 'bbbbbbbbbbbbbbbbbbbb';
    await mine('sid=s1&dv=' + A); await mine('sid=s2&dv=' + A); await mine('sid=s1&dv=' + A); await mine('sid=s3&dv=' + B); await mine('sid=s3&dv=' + B);
    eq((await C('/app/shared', { method: 'POST', body: { t: 'خطأ' } })).s, 401, 'بلا كلمة سر');
    const r = await C('/app/shared', { method: 'POST', body: { t: TOKEN } }); eq(r.s, 200);
    eq(r.j.list.length, 1, 'جهاز واحد مشترك'); eq(r.j.list[0].students.map(x => x.id).sort(), ['s1', 's2']); eq(r.j.list[0].sw, 2, 'مرات التبديل');
    ok(!JSON.stringify(r.j).includes(A), 'المعرّف الكامل لا يُكشف');
  });
  await S.t('⚡ النشر سريع: لا يعيد قراءة كل الأنشطة، وأسماء النشاط الجديد تدخل الفهرس', async () => {
    const E = newEnv(), C = caller(W, E);
    for (let i = 0; i < 30; i++) await E.HW.put('hw:old' + i, JSON.stringify({ t: 'قديم', s: ['قديم ' + i] }));
    eq((await C('/publish', { method: 'POST', body: { t: TOKEN, id: 'p0', payload: { ...ACT, s: ['أول'] }, silent: true } })).s, 200, 'أول نشر يبني الفهرس');
    ok(JSON.parse(await E.HW.get('idx:names')).includes('قديم 7'), 'البناء الكامل أول مرة');
    const g = E.HW.get.bind(E.HW); let reads = 0; E.HW.get = (k, t) => { if (String(k).startsWith('hw:old')) reads++; return g(k, t); };
    eq((await C('/publish', { method: 'POST', body: { t: TOKEN, id: 'p1', payload: { ...ACT, s: ['زائر جديد'] }, silent: true } })).s, 200, 'نشر');
    E.HW.get = g; eq(reads, 0, 'قراءات الأنشطة القديمة');
    ok(JSON.parse(await E.HW.get('idx:names')).includes('زائر جديد'), 'الاسم الجديد في الفهرس');
  });
  await S.t('الطالب يفتح النشاط — بلا إجابات صحيحة', async () => {
    const r = await call('/hw?id=act1'); eq(r.s, 200); eq(r.j.q.length, 3);
    ok(r.j.q.every(q => !('a' in q)), 'الإجابة الصحيحة ظهرت للطالب!'); ok(!String(r.j.q[2].q).includes('الرياض'), 'جواب أكمل الفراغ ظاهر في السؤال');
  });
  await S.t('الطالب يبدأ النشاط', async () => { const r = await call('/start', { method: 'POST', body: { hw: 'act1', sid: 's1', name: 'طالب الاختبار الأول' } }); eq(r.s, 200); eq(r.j.ok, true); });
  await S.t('تسليم أسرع من المعقول يُرفض (حماية من الغش)', async () => {
    const r = await call('/submit', { method: 'POST', body: { hw: 'act1', sid: 's1', name: 'طالب الاختبار الأول', ans: [1, false, 'الرياض'] } }); eq(r.s, 429); eq(r.j.error, 'too_fast');
    await env.HW.put('t0:act1:s1', String(Date.now() - 120000));   // كأنه بدأ قبل دقيقتين
  });
  await S.t('تسليم الطالب يُصحَّح في الخادم (2 من 3)', async () => {
    const r = await call('/submit', { method: 'POST', body: { hw: 'act1', sid: 's1', name: 'طالب الاختبار الأول', ans: [1, false, 'الرياض'], total: 3, correct: 3 } });
    eq(r.s, 200, JSON.stringify(r.j)); eq((r.j.marks || []).map(Boolean), [true, false, true], 'تصحيح الأسئلة');
  });
  await S.t('درجة المتصفح لا يُوثق بها (أرسل 3/3 والخادم يحسب 2/3)', async () => {
    const r = await call('/submit', { method: 'POST', body: { hw: 'act1', sid: 's1', name: 'طالب الاختبار الأول', ans: [1, false, 'الرياض'], correct: 3 } });
    ok(r.s === 200 || r.s === 409, 'status ' + r.s); ok(!r.j.marks || r.j.marks.filter(Boolean).length === 2, 'الدرجة تغيّرت');
  });
  await S.t('طالب خارج النشاط يُرفض', async () => { const r = await call('/submit', { method: 'POST', body: { hw: 'act1', sid: 's3', name: 'طالب من فصل آخر', ans: [1, true, 'x'] } }); eq(r.s, 403); });
  await S.t('اسم غير موجود يُرفض', async () => { const r = await call('/submit', { method: 'POST', body: { hw: 'act1', name: 'شخص غريب', ans: [1, true, 'x'] } }); ok(r.s === 403 || r.s === 409, 'status ' + r.s); });
  await S.t('إجابات ناقصة تُرفض', async () => { const r = await call('/submit', { method: 'POST', body: { hw: 'act1', sid: 's2', name: 'طالب الاختبار الثاني', ans: [1] } }); eq(r.s, 400); });
  await S.t('طلب الطالب لا يتأثر بنظام دخول المعلم', async () => { const r = await call('/student-report/mine', { method: 'POST', body: { session: 'x' } }); eq(r.s, 401); eq(r.j.error, 'auth'); });
  await S.t('ورقة اختبار غير منشورة لا يراها الطالب', async () => {
    await call('/omr/paper', { method: 'POST', body: { t: TOKEN, sid: 's1', test: 'ex1', title: 'اختبار', score: 8, max: 10, marks: [1, 0], img: 'data:image/jpeg;base64,AAAA', sem: 1 } });
    const r = await call('/omr/papers/of?sid=s1&t=' + TOKEN); eq(r.j.papers.length, 1); eq(r.j.papers[0].pub, false);
  });

  // ── 🔐 المعلم ──
  await S.t('بلا كلمة سر: مرفوض', async () => { eq((await call('/omr/papers/of?sid=s1')).s, 401); });
  await S.t('كلمة السر في الترويسة', async () => { eq((await call('/omr/papers/of?sid=s1', { headers: { 'X-Teacher-Token': TOKEN } })).s, 200); });
  let T = '', T2 = '', id2 = '';
  await S.t('دخول جهاز ← جلسة خاصة به', async () => { const r = await call('/auth/login', { method: 'POST', body: { password: TOKEN, label: 'اختبار' } }); eq(r.s, 200); ok(String(r.j.token).startsWith('ts1.'), 'token'); T = r.j.token; });
  await S.t('كلمة سر خاطئة عند الدخول', async () => { eq((await call('/auth/login', { method: 'POST', body: { password: 'x' } })).s, 401); });
  await S.t('الجلسة تعمل: ترويسة، وجسم JSON، ورفع ملفات', async () => {
    eq((await call('/omr/papers/of?sid=s1', { headers: { 'X-Teacher-Token': T } })).s, 200, 'header');
    eq((await call('/push/prefs', { method: 'POST', headers: { 'X-Teacher-Token': T }, body: { t: T } })).s, 200, 'json');
    const fd = new FormData(); fd.set('t', T); fd.set('title', 'x');
    eq((await call('/ann', { method: 'POST', headers: { 'X-Teacher-Token': T }, body: fd, raw: true })).s, 200, 'multipart');
  });
  await S.t('إضافة مدرستي: الجلسة في الجسم بلا ترويسة', async () => { eq((await call('/parent-phones', { method: 'POST', body: { t: T } })).s, 200); });
  await S.t('جلسة مزيفة مرفوضة', async () => { eq((await call('/omr/papers/of?sid=s1', { headers: { 'X-Teacher-Token': 'ts1.aa.bb' } })).s, 401); });
  await S.t('إلغاء جهاز يوقفه وحده', async () => {
    const r = await call('/auth/login', { method: 'POST', body: { password: TOKEN, label: 'ثاني', temp: true } }); T2 = r.j.token; id2 = r.j.id;
    eq((await call('/auth/revoke', { method: 'POST', headers: { 'X-Teacher-Token': T }, body: { t: T, id: id2 } })).s, 200);
    eq((await call('/omr/papers/of?sid=s1', { headers: { 'X-Teacher-Token': T2 } })).s, 401, 'الملغى');
    eq((await call('/omr/papers/of?sid=s1', { headers: { 'X-Teacher-Token': T } })).s, 200, 'الباقي');
  });
  await S.t('مفتاح العرض: للملفات فقط', async () => {
    const vk = (await call('/auth/viewkey', { headers: { 'X-Teacher-Token': T } })).j.vk; ok(vk, 'vk');
    ok((await call('/file-download?hw=a&sid=s1&key=k&vk=' + vk)).s !== 401, 'الملفات');
    eq((await call('/omr/papers/of?sid=s1&vk=' + vk)).s, 401, 'غير الملفات');
  });

  // ── 🔔 الإشعارات والتحديث ──
  await S.t('تفضيلات الإشعارات تُحفظ وتُنظَّف', async () => {
    const r = await call('/push/prefs', { method: 'POST', body: { t: TOKEN, prefs: { on: { act: false, bogus: false }, quiet: { on: true, from: 21, to: 99 } } } });
    eq(r.j.prefs.on.act, false); eq(r.j.prefs.on.lesson, true); ok(!('bogus' in r.j.prefs.on)); eq(r.j.prefs.quiet.to, 23);
  });
  await S.t('/version يعلن الميزات', async () => { const j = (await call('/version')).j; ok(j.hdrAuth && j.tsess, 'flags'); });
  await S.t('إجبار التحديث للمعلم فقط', async () => {
    eq((await call('/app/force', { method: 'POST', body: {} })).s, 401);
    eq((await call('/app/force', { method: 'POST', body: { t: TOKEN } })).s, 200); ok((await call('/version')).j.force > 0);
  });
  await S.t('درجة الورقة الممسوحة تُكمل الدفتر في التقرير (خانة فارغة فقط — لا تلمس درجة ولا حذفًا مقصودًا)', async () => {
    const cr = JSON.parse(await env.HW.get('teacher:classroom') || '{}');
    cr.examBooks = { 1: { 1: { tests: [{ id: 'pz1', title: 'ورقي 1', max: 10 }, { id: 'pz2', title: 'ورقي 2', max: 10 }, { id: 'pz3', title: 'ورقي 3', max: 10 }],
      scores: { s1: { pz2: { score: 4, at: 5 }, pz3: { del: true, at: Date.now() } } } } } };
    await env.HW.put('teacher:classroom', JSON.stringify(cr));
    for (const [test, score] of [['pz1', 9], ['pz2', 8], ['pz3', 7]]) eq((await call('/omr/paper', { method: 'POST', body: { t: TOKEN, sid: 's1', test, title: test, score, max: 10, marks: [1], img: 'data:image/jpeg;base64,AAAA', sem: 1 } })).s, 200);
    const r = await call('/student-report/preview', { method: 'POST', body: { t: TOKEN, semester: 1, period: 1, sid: 's1' } });
    eq(r.j.report.exam.tests.map(t => [t.id, t.score]), [['pz1', 9], ['pz2', 4], ['pz3', null]]);
    const g = await call('/grades?t=' + TOKEN + '&semester=1&period=1'); ok(g.j.students.find(x => x.id === 's1').exam.measured, 'الدرجات لا تحسب درجة الورقة');
    ok(!JSON.stringify(JSON.parse(await env.HW.get('teacher:classroom')).examBooks).includes('fromPaper'), 'كُتب في التخزين');
  });
  await S.t('سرعة: التقرير لا يقرأ الأوراق (صورها كبيرة) — الدرجة من الفهرس، والأوراق القديمة تُكمَّل فيه مرة واحدة', async () => {
    const idx = JSON.parse(await env.HW.get('omrp:idx')); for (const e of Object.values(idx)) delete e.sc;   // فهرس قديم بلا درجات
    await env.HW.put('omrp:idx', JSON.stringify(idx));
    const get0 = env.HW.get.bind(env.HW); let reads = 0; env.HW.get = k => { if (/^omrp:s/.test(k)) reads++; return get0(k); };
    try {
      const rep = async () => (await call('/student-report/preview', { method: 'POST', body: { t: TOKEN, semester: 1, period: 1, sid: 's1' } })).j.report.exam.tests.map(t => [t.id, t.score]);
      eq(await rep(), [['pz1', 9], ['pz2', 4], ['pz3', null]], 'الأولى'); ok(reads > 0, 'لم يكمل الفهرس');
      reads = 0; eq(await rep(), [['pz1', 9], ['pz2', 4], ['pz3', null]], 'الثانية'); eq(reads, 0, 'قرأ الأوراق مرة أخرى');
    } finally { env.HW.get = get0; }
  });
  await S.t('اختبار محذوف من الدفتر: تختفي ورقته من ملف الطالب ولا تُفتح، وتعود إن أُعيد', async () => {
    const before = (await call('/omr/papers/of?sid=s1&t=' + TOKEN)).j.papers.map(p => p.test); ok(before.includes('pz3'), 'قبل الحذف');
    const cr = JSON.parse(await env.HW.get('teacher:classroom'));
    const bk = cr.examBooks[1][1]; bk.tests = bk.tests.filter(t => t.id !== 'pz3'); bk.delTests = [{ id: 'pz3', at: Date.now() }];
    await env.HW.put('teacher:classroom', JSON.stringify(cr));
    const after = (await call('/omr/papers/of?sid=s1&t=' + TOKEN)).j.papers.map(p => p.test);
    ok(!after.includes('pz3') && after.includes('pz1'), 'بعد الحذف: ' + after);
    bk.tests.push({ id: 'pz3', title: 'ورقي 3', max: 10 }); await env.HW.put('teacher:classroom', JSON.stringify(cr));
    ok((await call('/omr/papers/of?sid=s1&t=' + TOKEN)).j.papers.some(p => p.test === 'pz3'), 'أُعيد');
  });
  await S.t('/site: مواقعنا فقط (لا وسيط مفتوح) ولا خروج من الموقع', async () => {
    eq((await call('/site?h=evil.example.com&p=/teacher-dashboard/')).s, 400, 'موقع غريب');
    eq((await call('/site?h=homwork.pages.dev&p=/teacher-dashboard/../x')).s, 400, 'خروج من المجلد');
    ok((await call('/site?h=mosaed.pages.dev&p=/')).s !== 400, 'اللوحة في جذر الموقع مرفوضة');
  });
  await S.t('صوت المختبر بلا مفتاح: صامت بلا خطأ', async () => { eq((await call('/tts?t=' + encodeURIComponent('مرحبا'))).s, 404); });
  await S.t('🔌 MCP لـ Claude: رابط سري للمعلم، والأدوات تقرأ الفصول والأنشطة والنتائج وتقرير الطالب، بلا معرّفات الطلاب', async () => {
    eq((await call('/mcp-key', { method: 'POST', body: { t: 'خطأ', action: 'create' } })).s, 401, 'بلا كلمة سر');
    eq((await call('/mcp/abc', { method: 'POST', body: { jsonrpc: '2.0', id: 1, method: 'initialize' } })).s, 404, 'بلا رابط');
    const k = (await call('/mcp-key', { method: 'POST', body: { t: TOKEN, action: 'create' } })).j.key; ok(k && k.length >= 20, 'المفتاح');
    const old = await env.HW.get('tstate:main'), st0 = JSON.parse(old);
    await env.HW.put('tstate:main', JSON.stringify({ ...st0, assignments: [{ sid: 'act1', title: 'نشاط اختبار', kind: 'normal', cls: 'أول 1', published: true, publishedAt: Date.now() }] }));
    const rpc = async (id, method, params) => (await call('/mcp/' + k, { method: 'POST', body: { jsonrpc: '2.0', id, method, params } })).j;
    try {
      const init = await rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
      eq(init.result.protocolVersion, '2025-06-18'); ok(init.result.capabilities.tools, 'tools');
      eq((await call('/mcp/' + k, { method: 'POST', body: { jsonrpc: '2.0', method: 'notifications/initialized' } })).s, 202, 'إشعار');
      const names = (await rpc(2, 'tools/list')).result.tools.map(t => t.name); eq(names, ['list_classes', 'list_activities', 'activity_results', 'student_report']);
      const tool = async (n, a) => (await rpc(3, 'tools/call', { name: n, arguments: a || {} })).result.structuredContent;
      const cl = await tool('list_classes'); eq(cl.total, 3); eq(cl.classes.map(c => c.cls + ':' + c.count), ['أول 1:2', 'أول 2:1']);
      eq((await tool('list_classes', { cls: 'أول 1' })).students.length, 2);
      const la = await tool('list_activities'); eq(la.activities[0].title, 'نشاط اختبار'); eq([la.activities[0].submitted, la.activities[0].of], [1, 2]);
      const ar = await tool('activity_results', { activity: 'اختبار' }); eq(ar.submitted.map(x => x.name + ' ' + x.score), ['طالب الاختبار الأول 2/3']); eq(ar.not_submitted.map(x => x.name), ['طالب الاختبار الثاني']);
      const sr = await tool('student_report', { student: 'طالب الاختبار الأول' }); eq(sr.name, 'طالب الاختبار الأول'); ok(sr.participation && 'absent' in sr.participation, 'المشاركة');
      ok((await tool('student_report', { student: 'طالب' })).matches, 'الاسم المتكرر يطلب التحديد');
      const all = JSON.stringify([cl, la, ar, sr]); ok(!/"s1"|"s2"|"s3"/.test(all), 'ظهر معرّف طالب');
      eq((await rpc(9, 'nope')).error.code, -32601);
    } finally { await env.HW.put('tstate:main', old); }
    await call('/mcp-key', { method: 'POST', body: { t: TOKEN, action: 'revoke' } });
    eq((await call('/mcp/' + k, { method: 'POST', body: { jsonrpc: '2.0', id: 1, method: 'ping' } })).s, 404, 'بعد الإلغاء');
  });
  return S;
}
