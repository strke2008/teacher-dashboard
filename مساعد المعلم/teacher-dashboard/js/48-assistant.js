/* ✨ «مساعدي» — مساعد شخصي داخل اللوحة: يسأله المعلم بالعربي عن طلابه ويجيب من بيانات اللوحة نفسها.
   • قراءة فقط: لا يرصد ولا يحذف ولا يرسل شيئًا.
   • أسئلة الغياب اليومية تُحسب فورًا من السجل بلا ذكاء اصطناعي.
   • غيرها: الذكاء يختار «أداة» من القائمة أدناه، فتُحسب من بيانات الجهاز، ثم يصيغ الجواب.
     لا يُرسل للمزوّد إلا ناتج الأداة اللازم للسؤال (أسماء ودرجات)، لا البيانات كلها.
   • المزوّد/الموديل: مهمة «المساعد» في «مزوّد لكل مهمة» (الافتراضي الأساسي). */
const ASST = { msgs: [], busy: false };
const asstEsc = s => (typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
/* تطبيع الاسم العربي (همزات، تاء مربوطة، «عبد»، «ال» المنفصلة) — للمطابقة بالاسم الأول أو جزء منه */
function asstTok(s) {
  const t = String(s || '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const out = []; for (let i = 0; i < t.length; i++) { if (t[i] === 'عبد' && t[i + 1]) { out.push('عبد' + t[++i]); continue; } if (['بن', 'ابن', 'بنت', 'ال'].includes(t[i])) continue; out.push(t[i]); }
  return out;
}
const asstStudents = () => (typeof STUDENTS !== 'undefined' && Array.isArray(STUDENTS) ? STUDENTS : []).filter(s => s && s.id && s.name);
const asstActs = () => (typeof HW !== 'undefined' && Array.isArray(HW) ? HW : []).filter(h => h && h.sid);
const asstClsList = () => [...new Set(asstStudents().map(s => String(s.cls || '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
function asstCls(q) { q = String(q || '').trim(); if (!q) return ''; const L = asstClsList(); return L.find(c => c === q) || L.find(c => asstTok(c).join(' ') === asstTok(q).join(' ')) || L.find(c => c.includes(q)) || ''; }
function asstFindStudent(q) {
  const t = asstTok(q); if (!t.length) return [];
  const all = asstStudents(), hit = all.filter(s => { const r = asstTok(s.name); return t.every((w, i) => r[i] === w || (i === t.length - 1 && r[i] && r[i].startsWith(w))); });
  const loose = hit.length ? hit : all.filter(s => { const r = asstTok(s.name); return t.every(w => r.includes(w)); });
  return loose;
}
function asstFindAct(q) {
  const acts = asstActs(), s0 = String(q || '').trim();
  if (!s0 || /^(آخر|اخر|الأخير|الاخير|latest|last)$/i.test(s0)) return acts.slice().sort((a, b) => (Number(b.publishedAt || b.at) || 0) - (Number(a.publishedAt || a.at) || 0)).slice(0, 1);
  const byId = acts.filter(h => String(h.sid) === s0); if (byId.length) return byId;
  const t = asstTok(s0); return acts.filter(h => { const r = asstTok(h.title || ''); return t.every(w => r.some(x => x.includes(w))); });
}
const asstActCls = h => (Array.isArray(h.clsList) && h.clsList.length ? h.clsList.map(String) : (h.cls ? [String(h.cls)] : []));
function asstPool(h) { try { if (typeof hwPool === 'function') return hwPool(h); } catch (e) {} const l = asstActCls(h); return asstStudents().filter(s => !l.length || l.includes(String(s.cls || ''))); }
const asstSub = (h, s) => h.subs && (h.subs[s.id] || h.subs[s.name]);
const asstPct = v => { const t = Number(v && v.total) || 0; return t ? Math.round((Number(v.correct) || 0) / t * 100) : null; };
const asstToday = () => (typeof ctToday === 'function' ? ctToday() : new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10));
async function asstClassroom() { if (typeof CT_DATA !== 'undefined' && CT_DATA) return CT_DATA; try { if (typeof ctLoad === 'function') await ctLoad(); } catch (e) {} return (typeof CT_DATA !== 'undefined' && CT_DATA) || window._classroomData || {}; }
async function asstGrades() { try { if (typeof ctEnsureGrades === 'function') return await ctEnsureGrades(); } catch (e) {} return null; }
const ABSENT = ['غائب', 'غائب بعذر'];

/* ── الأدوات: تُنفَّذ على الجهاز ── */
const ASST_TOOLS = {
  attendance_day: { d: 'الحضور والغياب في يوم: من غاب (بعذر أو بدونه) ومن شارك ومن لم يشارك. args: {date?:"YYYY-MM-DD" (افتراضي اليوم), cls?:"اسم الفصل"}', src: a => '📋 سجل الحضور — ' + (a.date || 'اليوم'),
    async run(a) { const D = await asstClassroom(), date = /^\d{4}-\d{2}-\d{2}$/.test(String(a.date || '')) ? a.date : asstToday(), cls = asstCls(a.cls), P = (D.participation || {})[date] || {};
      const rows = asstStudents().filter(s => !cls || String(s.cls || '') === cls).map(s => ({ name: s.name, cls: s.cls || '', status: (P[String(s.id)] || {}).status || '' }));
      const by = st => rows.filter(r => r.status === st).map(({ name, cls }) => ({ name, cls }));
      return { date, cls: cls || 'كل الفصول', recorded: rows.filter(r => r.status).length, of: rows.length, absent: by('غائب'), absent_excused: by('غائب بعذر'), participated: by('شارك').length, not_participated: by('لم يشارك') }; } },
  absence_totals: { d: 'أكثر الطلاب غيابًا خلال مدة. args: {cls?, days?:عدد الأيام الأخيرة (افتراضي 30), n?:العدد}', src: a => '📋 سجل الحضور — آخر ' + (Number(a.days) || 30) + ' يوم',
    async run(a) { const D = await asstClassroom(), days = Math.max(1, Math.min(365, Number(a.days) || 30)), from = new Date(Date.now() + 3 * 3600e3 - days * 864e5).toISOString().slice(0, 10), cls = asstCls(a.cls);
      const cnt = {}; Object.entries(D.participation || {}).forEach(([d, P]) => { if (d < from) return; Object.entries(P || {}).forEach(([id, v]) => { if (v && ABSENT.includes(v.status)) { const c = cnt[id] || (cnt[id] = { a: 0, e: 0 }); v.status === 'غائب' ? c.a++ : c.e++; } }); });
      const rows = asstStudents().filter(s => (!cls || String(s.cls || '') === cls) && cnt[s.id]).map(s => ({ name: s.name, cls: s.cls || '', absent: cnt[s.id].a, excused: cnt[s.id].e })).sort((x, y) => (y.absent + y.excused) - (x.absent + x.excused));
      return { from, cls: cls || 'كل الفصول', students: rows.slice(0, Math.max(1, Math.min(50, Number(a.n) || 10))) }; } },
  list_activities: { d: 'الأنشطة المنشورة الأحدث أولًا مع عدد من سلّم. args: {cls?, n?}', src: () => '📋 الأنشطة المنشورة',
    async run(a) { const cls = asstCls(a.cls); let L = asstActs(); if (cls) L = L.filter(h => { const l = asstActCls(h); return !l.length || l.includes(cls); });
      L = L.sort((x, y) => (Number(y.publishedAt || y.at) || 0) - (Number(x.publishedAt || x.at) || 0)).slice(0, Math.max(1, Math.min(30, Number(a.n) || 10)));
      return { activities: L.map(h => { const pool = asstPool(h); return { title: h.title || 'نشاط', due: h.due || '', classes: asstActCls(h).length ? asstActCls(h) : ['كل الفصول'], submitted: pool.filter(s => asstSub(h, s)).length, of: pool.length }; }) }; } },
  activity_results: { d: 'نتائج نشاط: من سلّم ودرجته مرتبًا من الأعلى، ومن لم يسلّم. args: {activity:"جزء من العنوان" أو "آخر", cls?}', src: a => '📊 نتائج «' + (a._title || a.activity || '') + '»',
    async run(a) { const m = asstFindAct(a.activity); if (!m.length) return { error: 'لم أجد نشاطًا بهذا العنوان', titles: asstActs().slice(-15).map(h => h.title) }; if (m.length > 1) return { error: 'أكثر من نشاط يطابق', matches: m.slice(0, 8).map(h => h.title) };
      const h = m[0], cls = asstCls(a.cls), pool = asstPool(h).filter(s => !cls || String(s.cls || '') === cls); a._title = h.title;
      const done = pool.filter(s => asstSub(h, s)).map(s => { const v = asstSub(h, s); return { name: s.name, cls: s.cls || '', score: Number(v.total) ? `${v.correct || 0}/${v.total}` : (v.files && v.files.length ? 'ملف' : '—'), pct: asstPct(v) }; }).sort((x, y) => (y.pct ?? -1) - (x.pct ?? -1));
      return { title: h.title, due: h.due || '', submitted: done, not_submitted: pool.filter(s => !asstSub(h, s)).map(s => ({ name: s.name, cls: s.cls || '' })) }; } },
  missing_work: { d: 'من لم يسلّم أنشطة: أكثر الطلاب نقصًا، أو قائمة ما لم يسلّمه طالب معيّن. args: {cls?, student?, n?}', src: () => '📋 تسليمات الأنشطة',
    async run(a) { const cls = asstCls(a.cls), acts = asstActs().filter(h => ['normal', 'reading', 'lab', 'files', undefined, ''].includes(h.kind) && !h.noGrade);
      if (a.student) { const m = asstFindStudent(a.student); if (m.length !== 1) return m.length ? { error: 'أكثر من طالب', matches: m.slice(0, 8).map(s => s.name + ' — ' + (s.cls || '')) } : { error: 'لم أجد الطالب' };
        const s = m[0], mine = acts.filter(h => asstPool(h).some(x => x.id === s.id)); return { name: s.name, cls: s.cls || '', of: mine.length, missing: mine.filter(h => !asstSub(h, s)).map(h => ({ title: h.title, due: h.due || '' })) }; }
      const cnt = {}; acts.forEach(h => asstPool(h).forEach(s => { if ((!cls || String(s.cls || '') === cls) && !asstSub(h, s)) cnt[s.id] = (cnt[s.id] || 0) + 1; }));
      return { cls: cls || 'كل الفصول', students: asstStudents().filter(s => cnt[s.id]).map(s => ({ name: s.name, cls: s.cls || '', missing: cnt[s.id] })).sort((x, y) => y.missing - x.missing).slice(0, Math.max(1, Math.min(50, Number(a.n) || 10))) }; } },
  ranking: { d: 'ترتيب الطلاب في الفترة الحالية (الأعلى أو الأضعف). args: {cls?, by:"total"|"exam"|"activities"|"participation"|"homework"|"behavior"|"attendance", order:"desc"|"asc", n?}', src: a => '📈 درجات الفترة — ' + (a.by || 'total'),
    async run(a) { const G = await asstGrades(); if (!G || !Array.isArray(G.students)) return { error: 'درجات الفترة غير متاحة الآن' }; const cls = asstCls(a.cls), by = String(a.by || 'total'), asc = a.order === 'asc';
      const val = g => { const P = g.participation || {}, Hm = g.homework || {}, B = g.behavior || {}, E = g.exam || {}, L = g.level || {}, A = g.attendance || {};
        const f = { participation: P.score, homework: Hm.score, behavior: B.score, exam: E.score, activities: L.rate, attendance: A.rate };
        if (by === 'total') { const xs = [P.score, Hm.score, B.score, E.measured ? E.score : null].filter(v => typeof v === 'number'); return xs.length ? Math.round(xs.reduce((s, v) => s + v, 0) * 10) / 10 : null; } return typeof f[by] === 'number' ? f[by] : null; };
      const rows = G.students.filter(g => !cls || String(g.cls || '') === cls).map(g => ({ name: g.name, cls: g.cls || '', value: val(g) })).filter(r => r.value !== null).sort((x, y) => asc ? x.value - y.value : y.value - x.value);
      return { by, order: asc ? 'الأضعف' : 'الأعلى', cls: cls || 'كل الفصول', note: 'total = مجموع المشاركة والواجبات والسلوك والاختبار', students: rows.slice(0, Math.max(1, Math.min(50, Number(a.n) || 5))) }; } },
  student_summary: { d: 'ملخص طالب في الفترة الحالية: المشاركة والواجبات والسلوك والاختبار والحضور والمستوى والأنشطة الناقصة. args: {student}', src: a => '👤 ملف ' + (a._name || a.student || 'الطالب'),
    async run(a) { const m = asstFindStudent(a.student); if (!m.length) return { error: 'لم أجد الطالب' }; if (m.length > 1) return { error: 'أكثر من طالب يطابق', matches: m.slice(0, 8).map(s => s.name + ' — ' + (s.cls || '')) };
      const s = m[0]; a._name = s.name; const G = await asstGrades(), g = G && (G.students || []).find(x => String(x.id) === String(s.id)) || {};
      const mw = await ASST_TOOLS.missing_work.run({ student: s.name });
      const pick = (o, k) => { const r = {}; k.forEach(x => { if (o && o[x] !== undefined) r[x] = o[x]; }); return r; };
      return { name: s.name, cls: s.cls || '', participation: pick(g.participation, ['score', 'yes', 'no', 'absent']), homework: pick(g.homework, ['score', 'done', 'missed']), behavior: pick(g.behavior, ['score', 'pos', 'neg']),
        exam: pick(g.exam, ['score', 'max', 'measured']), attendance: pick(g.attendance, ['absent', 'excused', 'late', 'days', 'rate']), level: pick(g.level, ['label', 'rate']), missing_activities: mw.missing || [] }; } },
  behavior_notes: { d: 'ملاحظات السلوك الإيجابية والسلبية. args: {student?, cls?, days?:افتراضي 14}', src: () => '⭐ ملاحظات السلوك',
    async run(a) { const D = await asstClassroom(), days = Math.max(1, Math.min(365, Number(a.days) || 14)), from = new Date(Date.now() + 3 * 3600e3 - days * 864e5).toISOString().slice(0, 10), cls = asstCls(a.cls);
      let ids = null; if (a.student) { const m = asstFindStudent(a.student); if (m.length !== 1) return { error: m.length ? 'أكثر من طالب' : 'لم أجد الطالب' }; ids = new Set([String(m[0].id)]); }
      const byId = new Map(asstStudents().map(s => [String(s.id), s]));
      const L = (Array.isArray(D.behavior) ? D.behavior : []).filter(x => x && !x.deleted && String(x.date || '') >= from).map(x => ({ s: byId.get(String(x.studentId || x.sid || '')), x })).filter(o => o.s && (!ids || ids.has(String(o.s.id))) && (!cls || String(o.s.cls || '') === cls))
        .sort((p, q) => String(q.x.date).localeCompare(String(p.x.date))).slice(0, 40).map(({ s, x }) => ({ name: s.name, cls: s.cls || '', date: x.date, type: x.type === 'positive' ? 'إيجابي' : 'سلبي', note: String(x.category || x.note || '').slice(0, 80) }));
      return { from, notes: L }; } },
};
const asstIntro = () => `أنت «مساعدي» داخل لوحة معلم سعودي. اليوم ${asstToday()}. الفصول: ${asstClsList().join('، ') || '—'}. آخر الأنشطة: ${asstActs().slice(-12).map(h => '«' + h.title + '»').join('، ') || '—'}.`;

/* ── تشغيل سؤال ── */
function asstFast(q) {   // ⚡ بلا ذكاء: «مين الغايب اليوم» وما شابه
  const t = String(q || ''); if (!/(غايب|غائب|غياب|غابو|غابوا|الغائبين|الحضور)/.test(t)) return null;
  if (!/(اليوم|الحين|هاليوم)/.test(t) && !/^\s*(مين|من)\s+(ال)?(غايب|غائب)/.test(t)) return null;
  const cls = asstClsList().find(c => t.includes(c)) || ''; return { tool: 'attendance_day', args: { cls } };
}
function asstRenderFast(r) {
  const tab = L => L.length ? `<table>${L.map(x => `<tr><td>${asstEsc(x.name)}</td><td>${asstEsc(x.cls)}</td></tr>`).join('')}</table>` : '';
  if (!r.recorded) return `لم يُرصد حضور ${r.cls === 'كل الفصول' ? '' : 'فصل ' + asstEsc(r.cls) + ' '}في ${r.date === asstToday() ? 'اليوم' : asstEsc(r.date)} بعد.`;
  const n = r.absent.length + r.absent_excused.length;
  return (n ? `غاب ${r.date === asstToday() ? 'اليوم' : asstEsc(r.date)} <b>${n} ${n === 1 ? 'طالب' : n === 2 ? 'طالبان' : n <= 10 ? 'طلاب' : 'طالبًا'}</b>${r.cls === 'كل الفصول' ? '' : ' من ' + asstEsc(r.cls)}:` : `لا غياب ${r.date === asstToday() ? 'اليوم' : ''} ✓`)
    + tab(r.absent) + (r.absent_excused.length ? `<div style="margin-top:.4rem">بعذر:</div>${tab(r.absent_excused)}` : '') + `<div class="asst-meta">رُصد ${r.recorded} من ${r.of}</div>`;
}
function asstMd(s) {   // تنسيق بسيط آمن: **عريض** · أسطر · قوائم
  return asstEsc(String(s || '')).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/^\s*[-•]\s+/gm, '• ').replace(/\n/g, '<br>');
}
async function asstAsk(q) {
  q = String(q || '').trim(); if (!q || ASST.busy) return;
  ASST.busy = true; ASST.msgs.push({ me: 1, html: asstEsc(q) }); const bot = { html: '<i class="asst-dots"><b></b><b></b><b></b></i>', src: [] }; ASST.msgs.push(bot); asstPaint();
  try {
    const fast = asstFast(q);
    if (fast) { const r = await ASST_TOOLS[fast.tool].run(fast.args); bot.html = asstRenderFast(r); bot.src = [ASST_TOOLS[fast.tool].src(fast.args), '⚡ فوري بلا ذكاء']; return; }
    if (typeof readingAICall !== 'function') throw new Error('الذكاء الاصطناعي غير محمّل');
    const R = typeof aiRoute === 'function' ? aiRoute('assistant') : { p: raiProvider(), m: readingAIModels()[raiProvider()] };
    if (!readingAIGetKey(R.p)) throw new Error('أضف مفتاح ذكاء اصطناعي من ⚙️ الإعدادات ← الذكاء الاصطناعي');
    const hist = ASST.msgs.slice(-8, -2).map(m => (m.me ? 'المعلم: ' : 'المساعد: ') + String(m.text || m.html || '').replace(/<[^>]+>/g, ' ').slice(0, 300)).join('\n');
    const tools = Object.entries(ASST_TOOLS).map(([k, t]) => `- ${k}: ${t.d}`).join('\n');
    const plan = aiSafeJson(await readingAICall(R.p, R.m, `${asstIntro()}
الأدوات المتاحة (تُحسب من بيانات المعلم):
${tools}
${hist ? 'المحادثة السابقة:\n' + hist + '\n' : ''}سؤال المعلم: ${q}
اختر أداة أو أداتين تكفيان للجواب. أخرج JSON فقط: {"calls":[{"tool":"اسم","args":{...}}]}
وإن كان السؤال لا يحتاج بيانات (تحية أو سؤال عام) أخرج {"answer":"ردّك"}.`, new AbortController().signal)) || {};
    if (plan.answer && !(Array.isArray(plan.calls) && plan.calls.length)) { bot.html = asstMd(plan.answer); bot.text = plan.answer; bot.src = [asstUsed()]; return; }
    const calls = (Array.isArray(plan.calls) ? plan.calls : []).filter(c => c && ASST_TOOLS[c.tool]).slice(0, 3);
    if (!calls.length) throw new Error('ما فهمت السؤال — جرّب صياغة أوضح، مثل: «مين أعلى درجة في آخر نشاط؟»');
    const results = []; for (const c of calls) { const a = c.args && typeof c.args === 'object' ? c.args : {}; results.push({ tool: c.tool, result: await ASST_TOOLS[c.tool].run(a) }); bot.src.push(ASST_TOOLS[c.tool].src(a)); }
    const ans = aiSafeJson(await readingAICall(R.p, R.m, `${asstIntro()}
سؤال المعلم: ${q}
نتائج الأدوات من بياناته:
${JSON.stringify(results).slice(0, 14000)}
أجب المعلم بالعربية بإيجاز ودقة من هذه النتائج فقط — لا تخترع أسماء أو أرقامًا. استخدم **عريض** للأهم وقائمة بـ «- » عند الحاجة. إن كانت القائمة طويلة اذكر أهمها والعدد. إن كان في النتائج error فاشرحه واقترح صياغة.
أخرج JSON فقط: {"answer":"..."}`, new AbortController().signal)) || {};
    bot.text = String(ans.answer || ''); bot.html = asstMd(bot.text || 'لم يصل جواب — جرّب مرة أخرى'); bot.src.push(asstUsed());
  } catch (e) { bot.html = '⚠️ ' + asstEsc(e && e.message || 'تعذّر'); bot.err = 1; }
  finally { ASST.busy = false; bot.src = bot.src.filter(Boolean); asstPaint(); }
}
function asstUsed() { try { const j = JSON.parse(localStorage.getItem('ai_last_used') || 'null'); if (!j) return ''; const c = (typeof READING_AI_PROVIDERS !== 'undefined' && READING_AI_PROVIDERS[j.p]) || { name: j.p }; return '🤖 ' + c.name + ' · ' + j.m; } catch (e) { return ''; } }

/* ── الواجهة ── */
const ASST_SUGG = ['مين الغايب اليوم؟', 'مين أعلى درجة في آخر نشاط؟', 'مين ما سلّم آخر نشاط؟', 'أضعف ٥ طلاب في الفترة', 'أكثر الطلاب غيابًا هذا الشهر'];
function asstPaint() {
  const box = document.getElementById('asst-msgs'); if (!box) return;
  box.innerHTML = ASST.msgs.length ? ASST.msgs.map(m => m.me ? `<div class="asst-me">${m.html}</div>`
    : `<div class="asst-bot${m.err ? ' err' : ''}">${m.html}${m.src && m.src.length ? `<div class="asst-src">${m.src.map(s => `<span>${asstEsc(s)}</span>`).join('')}</div>` : ''}</div>`).join('')
    : `<div class="asst-hello"><b>✨ أهلًا!</b>اسألني عن طلابك: الغياب، والدرجات، ومن سلّم ومن لم يسلّم، وملخص أي طالب.<small>أقرأ بياناتك فقط — لا أرصد ولا أحذف ولا أرسل شيئًا.</small></div>`;
  box.scrollTop = box.scrollHeight;
  const send = document.getElementById('asst-send'); if (send) send.disabled = ASST.busy;
}
function asstOpen() {
  let p = document.getElementById('asst-panel');
  if (!p) {
    p = document.createElement('div'); p.id = 'asst-panel'; p.className = 'no-print'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'مساعدي');
    p.innerHTML = `<div class="asst-head"><span class="asst-ic">✨</span><div><b>مساعدي</b><small>للقراءة فقط — يقرأ بياناتك ولا يغيّرها</small></div>
      <button type="button" class="asst-clear" onclick="ASST.msgs=[];asstPaint()" title="محادثة جديدة" aria-label="محادثة جديدة">↺</button><button type="button" class="asst-x" onclick="asstClose()" aria-label="إغلاق">✕</button></div>
      <div class="asst-msgs" id="asst-msgs" aria-live="polite"></div>
      <div class="asst-sugg">${ASST_SUGG.map(s => `<button type="button" onclick="asstAsk(this.textContent)">${asstEsc(s)}</button>`).join('')}</div>
      <form class="asst-in" onsubmit="event.preventDefault();const i=document.getElementById('asst-q');asstAsk(i.value);i.value=''"><textarea id="asst-q" rows="1" placeholder="اسأل عن طلابك…" autocomplete="off"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();this.form.requestSubmit()}"></textarea><button type="submit" id="asst-send" class="btn tick sm">إرسال</button></form>`;
    document.body.appendChild(p);
    p.addEventListener('keydown', e => { if (e.key === 'Escape') asstClose(); });
  }
  p.classList.add('on'); document.body.classList.add('asst-open'); asstPaint();
  setTimeout(() => { try { document.getElementById('asst-q').focus(); } catch (e) {} }, 60);
}
function asstClose() { const p = document.getElementById('asst-panel'); if (p) p.classList.remove('on'); document.body.classList.remove('asst-open'); }
