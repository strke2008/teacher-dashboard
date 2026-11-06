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
  student_summary: { d: 'ملخص طالب في الفترة الحالية: رصيد نقاط المكافآت (reward_points) والمشاركة والواجبات والسلوك والاختبار والحضور والمستوى والأنشطة الناقصة. args: {student}', src: a => '👤 ملف ' + (a._name || a.student || 'الطالب'),
    async run(a) { const m = asstFindStudent(a.student); if (!m.length) return { error: 'لم أجد الطالب' }; if (m.length > 1) return { error: 'أكثر من طالب يطابق', matches: m.slice(0, 8).map(s => s.name + ' — ' + (s.cls || '')) };
      const s = m[0]; a._name = s.name; const G = await asstGrades(), g = G && (G.students || []).find(x => String(x.id) === String(s.id)) || {};
      const mw = await ASST_TOOLS.missing_work.run({ student: s.name });
      const pick = (o, k) => { const r = {}; k.forEach(x => { if (o && o[x] !== undefined) r[x] = o[x]; }); return r; };
      return { name: s.name, cls: s.cls || '', reward_points: Number(s.points) || 0, participation: pick(g.participation, ['score', 'yes', 'no', 'absent']), homework: pick(g.homework, ['score', 'done', 'missed']), behavior: pick(g.behavior, ['score', 'pos', 'neg']),
        exam: pick(g.exam, ['score', 'max', 'measured']), attendance: pick(g.attendance, ['absent', 'excused', 'late', 'days', 'rate']), level: pick(g.level, ['label', 'rate']), missing_activities: mw.missing || [] }; } },
  behavior_notes: { d: 'ملاحظات السلوك الإيجابية والسلبية. args: {student?, cls?, days?:افتراضي 14}', src: () => '⭐ ملاحظات السلوك',
    async run(a) { const D = await asstClassroom(), days = Math.max(1, Math.min(365, Number(a.days) || 14)), from = new Date(Date.now() + 3 * 3600e3 - days * 864e5).toISOString().slice(0, 10), cls = asstCls(a.cls);
      let ids = null; if (a.student) { const m = asstFindStudent(a.student); if (m.length !== 1) return { error: m.length ? 'أكثر من طالب' : 'لم أجد الطالب' }; ids = new Set([String(m[0].id)]); }
      const byId = new Map(asstStudents().map(s => [String(s.id), s]));
      const L = (Array.isArray(D.behavior) ? D.behavior : []).filter(x => x && !x.deleted && String(x.date || '') >= from).map(x => ({ s: byId.get(String(x.studentId || x.sid || '')), x })).filter(o => o.s && (!ids || ids.has(String(o.s.id))) && (!cls || String(o.s.cls || '') === cls))
        .sort((p, q) => String(q.x.date).localeCompare(String(p.x.date))).slice(0, 40).map(({ s, x }) => ({ name: s.name, cls: s.cls || '', date: x.date, type: x.type === 'positive' ? 'إيجابي' : 'سلبي', note: String(x.category || x.note || '').slice(0, 80) }));
      return { from, notes: L }; } },
  /* ── أوامر: تُجهَّز فقط، ولا تُنفَّذ إلا بعد ضغط المعلم «نفّذ» في بطاقة التأكيد ── */
  record_attendance: { act: 1, d: 'تجهيز رصد (لا يُنفَّذ إلا بتأكيد المعلم) للحضور أو المشاركة أو الواجب. args: {students:["اسم",...] أو ["الكل"] مع cls, except?:["اسم",...] (يُستثنون من «الكل»), status:"غائب"|"غائب بعذر"|"شارك"|"لم يشارك"|"أنجز"|"لم ينجز"|"معذور", date?:"اليوم"|"أمس"|"YYYY-MM-DD", cls?}', src: () => '📝 تجهيز رصد',
    async run(a) { const st = String(a.status || 'غائب'), m = ['أنجز', 'لم ينجز', 'معذور'].includes(st) ? 'homework' : 'participation';
      if (!['غائب', 'غائب بعذر', 'شارك', 'لم يشارك', 'أنجز', 'لم ينجز', 'معذور'].includes(st)) return { error: 'حالة غير معروفة: ' + st };
      const date = asstDate(a.date), cls = asstCls(a.cls), r = asstResolve(a.students, cls), D = await asstClassroom();
      if (a.except) { const ex = asstResolve(a.except, cls), skip = new Set(ex.items.map(x => String(x.id))); r.items = r.items.filter(x => !skip.has(String(x.id))); r.bad = r.bad.concat(ex.bad); }
      return { action: 'record', m, status: st, date, items: r.items.map(x => ({ name: x.name, cls: x.cls || '', _id: String(x.id), _prev: (((D[m] || {})[date] || {})[String(x.id)] || {}).status || '' })), unresolved: r.bad }; } },
  behavior_note: { act: 1, d: 'تجهيز ملاحظة سلوك (لا تُنفَّذ إلا بتأكيد المعلم). args: {students:["اسم",...] أو ["الكل"] مع cls, cls?, type:"positive"|"negative", note:"نص قصير"}', src: () => '⭐ تجهيز ملاحظة سلوك',
    async run(a) { const r = asstResolve(a.students || a.student, asstCls(a.cls)); return { action: 'behavior', type: a.type === 'negative' ? 'negative' : 'positive', note: String(a.note || '').slice(0, 120) || (a.type === 'negative' ? 'ملاحظة سلبية' : 'تميّز'), date: asstToday(),
      items: r.items.map(x => ({ name: x.name, cls: x.cls || '', _id: String(x.id) })), unresolved: r.bad }; } },
  remind_missing: { act: 1, d: 'تجهيز تذكير لمن لم يسلّم نشاطًا (يفتح شاشة التذكير الجماعي للمراجعة والإرسال). args: {activity:"جزء من العنوان" أو "آخر"}', src: () => '📨 تجهيز تذكير',
    async run(a) { const m = asstFindAct(a.activity); if (!m.length) return { error: 'لم أجد النشاط' }; if (m.length > 1) return { error: 'أكثر من نشاط يطابق', matches: m.slice(0, 8).map(h => h.title) };
      const h = m[0], miss = asstPool(h).filter(s => !asstSub(h, s)).length; return { action: 'remind', title: h.title, missing: miss, _hid: String(h.id) }; } },
  parent_message: { act: 1, d: 'كتابة مسودة رسالة لولي أمر طالب (المعلم يراجعها ويرسلها بنفسه). args: {student, topic:"موضوع الرسالة"}', src: a => '✉️ مسودة رسالة — ' + (a._name || a.student || ''),
    async run(a) { const s0 = await ASST_TOOLS.student_summary.run({ student: a.student }); if (s0.error) return s0; a._name = s0.name; const st = asstFindStudent(s0.name)[0];
      return { action: 'draft', topic: String(a.topic || 'متابعة مستوى الطالب'), student: s0, _id: st ? String(st.id) : '' }; } },
  points: { d: 'رصيد «النقاط» (نقاط المكافآت/المتجر — ليست درجات): رصيد طالب، أو ترتيب الطلاب بالنقاط في فصل. args: {student?, cls?, order?:"desc"|"asc", n?}', src: () => '💰 نقاط الطلاب',
    async run(a) { if (a.student) { const m = asstFindStudent(a.student); if (m.length !== 1) return m.length ? { error: 'أكثر من طالب يطابق', matches: m.slice(0, 8).map(s => s.name + ' — ' + (s.cls || '')) } : { error: 'لم أجد الطالب' };
        return { name: m[0].name, cls: m[0].cls || '', reward_points: Number(m[0].points) || 0, note: 'نقاط المكافآت (رصيد المتجر)، وليست درجة' }; }
      const cls = asstCls(a.cls), asc = a.order === 'asc', L = asstStudents().filter(s => !cls || String(s.cls || '') === cls).map(s => ({ name: s.name, cls: s.cls || '', reward_points: Number(s.points) || 0 })).sort((x, y) => asc ? x.reward_points - y.reward_points : y.reward_points - x.reward_points);
      return { cls: cls || 'كل الفصول', total: L.reduce((n, x) => n + x.reward_points, 0), students: L.slice(0, Math.max(1, Math.min(50, Number(a.n) || 10))) }; } },
  /* ── 📝 الاختبارات والتصحيح الآلي والمهارات (قراءة) ── */
  exam_scores: { d: 'دفتر الاختبارات: قائمة الاختبارات ومتوسطاتها، أو درجات اختبار معيّن (الأعلى/الأقل/الغائب/من لم يُرصد له)، أو درجات طالب في كل الاختبارات. args: {test?:"جزء من العنوان" أو "آخر", student?, cls?, sem?:1|2, per?:1|2 (افتراضي الفترة الحالية)}', src: a => '📝 دفتر الاختبارات' + (a._title ? ' — ' + a._title : ''),
    async run(a) { const { sem, per, label } = asstSP(a), b = await asstBook(sem, per), cls = asstCls(a.cls); if (!b.tests.length) return { period: label, error: 'لا توجد اختبارات في دفتر هذه الفترة' };
      const pool = asstStudents().filter(s => !cls || String(s.cls || '') === cls), val = (s, t) => asstExV(b, s.id, t.id);
      if (a.student) { const m = asstFindStudent(a.student); if (m.length !== 1) return m.length ? { error: 'أكثر من طالب يطابق', matches: m.slice(0, 8).map(s => s.name + ' — ' + (s.cls || '')) } : { error: 'لم أجد الطالب' };
        const s = m[0]; return { period: label, name: s.name, cls: s.cls || '', tests: b.tests.map(t => ({ title: t.title, max: Number(t.max) || 0, score: val(s, t) ?? 'لم يُرصد' })) }; }
      if (a.test) { const f = asstFindTest(b, a.test); if (f.error) return { period: label, ...f }; const t = f.t; a._title = t.title;
        const rows = pool.map(s => ({ name: s.name, cls: s.cls || '', v: val(s, t) })), sc = rows.filter(r => typeof r.v === 'number').sort((x, y) => y.v - x.v);
        return { period: label, test: t.title, max: Number(t.max) || 0, average: sc.length ? Math.round(sc.reduce((n, r) => n + r.v, 0) / sc.length * 10) / 10 : null, scores: sc.map(r => ({ name: r.name, cls: r.cls, score: r.v })), absent: rows.filter(r => r.v === 'غ').map(r => r.name), not_recorded: rows.filter(r => r.v == null).map(r => r.name) }; }
      return { period: label, cls: cls || 'كل الفصول', tests: b.tests.map(t => { const v = pool.map(s => val(s, t)).filter(x => typeof x === 'number'); return { title: t.title, max: Number(t.max) || 0, recorded: v.length, of: pool.length, average: v.length ? Math.round(v.reduce((n, x) => n + x, 0) / v.length * 10) / 10 : null }; }) }; } },
  exam_items: { d: 'تحليل أسئلة اختبار مصحَّح آليًا (📷 التصحيح الآلي): نسبة الإجابة الصحيحة لكل سؤال والأصعب أولًا، أو لسؤال رقم معيّن: من أخطأ فيه وماذا اختار ومن تركه. args: {test:"جزء من العنوان" أو "آخر", question?:رقم السؤال, cls?}', src: a => '📷 تحليل أسئلة «' + (a._title || a.test || '') + '»',
    async run(a) { const f = await asstFindTestAny(a.test, a); if (f.error) return f; const t = f.t, cls = asstCls(a.cls); a._title = t.title;
      let P = [], T = {}; try { const j = await (await fetch(`${ctApi()}/omr/papers/full?t=${encodeURIComponent(getTok())}&test=${encodeURIComponent(String(t.id))}`)).json(); if (!j.ok) throw 0; P = (j.papers || []).filter(p => p.tpl && Array.isArray(p.ch));
        for (const id of [...new Set(P.map(p => p.tpl))]) { const g = await (await fetch(`${ctApi()}/omr/get?t=${encodeURIComponent(getTok())}&id=${encodeURIComponent(id)}`)).json(); if (g.ok) T[id] = g.template; } } catch (e) { return { error: 'تعذّر تحميل أوراق التصحيح الآلي — تحقق من الاتصال' }; }
      const byId = new Map(asstStudents().map(s => [String(s.id), s])); P = P.filter(p => T[p.tpl] && (!cls || String((byId.get(String(p.sid)) || {}).cls || '') === cls));
      if (!P.length) return { test: t.title, error: 'لا توجد أوراق مصححة آليًا لهذا الاختبار' + (cls ? ' في ' + cls : '') };
      const Q = new Map(); P.forEach(p => { const qs = asstOmrQs(T[p.tpl].models && T[p.tpl].models[p.model || 0]), s = byId.get(String(p.sid)), nm = s ? s.name : (p.name || '—');
        qs.forEach((q, i) => { const k = q.q ? 'q:' + String(q.q).replace(/\s+/g, ' ').trim() : `i:${p.tpl}:${p.model || 0}:${i}`; let e = Q.get(k); if (!e) Q.set(k, e = { no: i + 1, text: String(q.q || '').slice(0, 90), key: asstOmrLab(q, q.key), n: 0, ok: 0, wrong: [], blank: [], opt: {} });
          const c = p.ch[i]; e.n++; if (c === q.key) e.ok++; else if (c < 0 || c == null) e.blank.push(nm); else { const l = asstOmrLab(q, c); e.wrong.push({ name: nm, chose: l }); e.opt[l] = (e.opt[l] || 0) + 1; } }); });
      const L = [...Q.values()].map(e => ({ ...e, pct: Math.round(e.ok / e.n * 100) }));
      if (a.question) { const no = Number(String(a.question).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))), hit = L.filter(e => e.no === no); if (!hit.length) return { test: t.title, error: 'لا يوجد سؤال بهذا الرقم', questions: L.length };
        return { test: t.title, papers: P.length, question: hit.map(e => ({ no: e.no, text: e.text, correct_answer: e.key, correct_pct: e.pct, answered: e.n, wrong: e.wrong, blank: e.blank })) }; }
      return { test: t.title, papers: P.length, average_pct: Math.round(L.reduce((n, e) => n + e.pct, 0) / L.length), hardest_first: L.sort((x, y) => x.pct - y.pct).slice(0, Math.max(3, Math.min(40, Number(a.n) || 10))).map(e => ({ no: e.no, text: e.text, correct_pct: e.pct, correct_answer: e.key, most_chosen_wrong: Object.entries(e.opt).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([l, n]) => l + ' (' + n + ')').join('، '), wrong_count: e.wrong.length, blank_count: e.blank.length })) }; } },
  skills: { d: 'خريطة المهارات ونواتج التعلم (ومنها نواتج نافس): أضعف المهارات في فصل ومن يحتاج دعمًا فيها، أو مهارات طالب من الأضعف. args: {cls?, student?, n?}', src: a => '🧭 خريطة المهارات' + (a._name ? ' — ' + a._name : ''),
    async run(a) { const G = await asstGrades(); if (!G || typeof ctSk !== 'function') return { error: 'خريطة المهارات غير متاحة الآن' }; const n = Math.max(1, Math.min(30, Number(a.n) || 8));
      if (a.student) { const m = asstFindStudent(a.student); if (m.length !== 1) return { error: m.length ? 'أكثر من طالب يطابق' : 'لم أجد الطالب' }; const s = m[0]; a._name = s.name;
        const sk = Object.entries(ctSk(s.id) || {}).map(([k, v]) => ({ skill: k, rate: v.rate, questions: v.t })).sort((x, y) => x.rate - y.rate); return { name: s.name, cls: s.cls || '', skills: sk.slice(0, n * 2), note: sk.length ? 'دون 60% = تحتاج دعمًا' : 'لا بيانات مهارات كافية لهذا الطالب بعد' }; }
      const cls = asstCls(a.cls), agg = {}; asstStudents().filter(s => !cls || String(s.cls || '') === cls).forEach(s => Object.entries(ctSk(s.id) || {}).forEach(([k, v]) => { const o = agg[k] || (agg[k] = { c: 0, t: 0, of: 0, weak: [] }); o.c += Number(v.c) || 0; o.t += Number(v.t) || 0; o.of++; if (v.rate < 60) o.weak.push({ name: s.name, rate: v.rate }); }));
      const L = Object.entries(agg).filter(([, o]) => o.t).map(([k, o]) => ({ skill: k, rate: Math.round(o.c / o.t * 100), students: o.of, weak_count: o.weak.length, weak: o.weak.sort((x, y) => x.rate - y.rate).slice(0, 10).map(w => w.name + ' ' + w.rate + '%') })).sort((x, y) => x.rate - y.rate);
      return { cls: cls || 'كل الفصول', skills: L.slice(0, n), total_skills: L.length, note: L.length ? 'الأضعف أولًا · weak = دون 60%' : 'لا بيانات مهارات كافية بعد' }; } },
  /* ── أوامر جديدة: درجة اختبار · مسودة نشاط · تنقّل ── */
  record_exam_score: { act: 1, d: 'تجهيز رصد درجات اختبار في دفتر الاختبارات (لا يُنفَّذ إلا بتأكيد المعلم، ويمكن التراجع). args: {test:"جزء من عنوان الاختبار", scores:[{"student":"اسم","score":رقم أو "غ" للغائب}], sem?, per?}', src: a => '📝 تجهيز رصد «' + (a._title || a.test || '') + '»',
    async run(a) { const { sem, per, label } = asstSP(a); if (typeof qrPerClosed === 'function' && qrPerClosed(sem, per)) return { error: '🔒 ' + label + ' مغلقة — لا يُرصد فيها' };
      const b = await asstBook(sem, per), f = asstFindTest(b, a.test); if (f.error) return { period: label, ...f }; const t = f.t, max = Number(t.max) || 0; a._title = t.title;
      const L = Array.isArray(a.scores) ? a.scores : [{ student: a.student, score: a.score }], items = [], bad = [], seen = new Set();
      for (const x of L) { const q = String(x && x.student || '').trim(), m = asstFindStudent(q); if (m.length !== 1) { bad.push({ q, matches: m.slice(0, 5).map(s => s.name + ' — ' + (s.cls || '')) }); continue; }
        const s = m[0], raw = String(x.score ?? '').trim().replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace('٫', '.'), absent = /^(غ|غائب|غايب)$/.test(raw), v = Number(raw);
        if (!absent && (raw === '' || !Number.isFinite(v))) { bad.push({ q: q + ': «' + raw + '» ليست درجة', matches: [] }); continue; } if (seen.has(s.id)) continue; seen.add(s.id);
        const prev = (b.scores[String(s.id)] || {})[String(t.id)]; items.push({ name: s.name, cls: s.cls || '', score: absent ? 'غ' : Math.max(0, Math.min(max, v)), over: !absent && v > max ? v : undefined, prev: asstExV(b, s.id, t.id) ?? '', _id: String(s.id), _prev: prev ? JSON.parse(JSON.stringify(prev)) : null }); }
      return { action: 'exam', sem, per, period: label, test: t.title, max, _tid: String(t.id), items, unresolved: bad }; } },
  create_activity: { act: 1, d: 'إنشاء مسودة نشاط أسئلة بالذكاء (لا تُنشر — تُفتح للمعلم يراجعها وينشرها بنفسه). args: {topic:"الموضوع", n?:عدد الأسئلة (افتراضي 10), cls?, due?:"YYYY-MM-DD"|"الخميس"|"بكرة", type?:"mcq"|"tf"|"mixed", title?}', src: a => '✍️ مسودة نشاط — ' + (a.topic || ''),
    async run(a) { const topic = String(a.topic || a.title || '').trim().slice(0, 200); if (!topic) return { error: 'حدّد موضوع النشاط' }; const n = Math.max(3, Math.min(30, Number(a.n) || 10)), cls = asstCls(a.cls), due = asstDue(a.due), type = ['mcq', 'tf'].includes(a.type) ? a.type : 'mixed';
      const R = typeof aiRoute === 'function' ? aiRoute('questions') : { p: raiProvider(), m: readingAIModels()[raiProvider()] };
      const raw = await readingAICall(R.p, R.m, `اكتب ${n} أسئلة لنشاط طلاب بالعربية الفصحى عن: «${topic}». ${type === 'mcq' ? 'كلها اختيار من متعدد بأربعة خيارات.' : type === 'tf' ? 'كلها صح أو خطأ.' : 'أغلبها اختيار من متعدد بأربعة خيارات وبعضها صح أو خطأ.'}
دقيقة علميًا، واضحة، متدرجة من السهل إلى الأصعب، خيارات معقولة بلا «كل ما سبق»، وتوزّع موضع الإجابة الصحيحة.
أخرج JSON فقط: {"questions":[{"t":"q","q":"نص السؤال","o":["خيار","خيار","خيار","خيار"],"a":رقم الخيار الصحيح من 0},{"t":"tf","q":"عبارة","a":true}]}`, new AbortController().signal);
      const arr = (aiSafeJson(raw) || {}).questions, qs = (Array.isArray(arr) ? arr : []).map(x => { if (!x || !String(x.q || '').trim()) return null; const q = String(x.q).trim();
        if (x.t === 'tf') return { t: 'tf', q, a: x.a === true || x.a === 'true' || x.a === 'صح' };
        const o = (Array.isArray(x.o) ? x.o : []).map(v => String(v ?? '').trim()).filter(Boolean).slice(0, 4), ai = Number(x.a); return o.length >= 2 && Number.isInteger(ai) && ai >= 0 && ai < o.length ? { t: 'q', q, o, a: ai } : null; }).filter(Boolean).slice(0, n);
      if (!qs.length) return { error: 'لم تصل أسئلة صالحة من الذكاء — جرّب مرة أخرى' };
      return { action: 'activity', title: String(a.title || topic).slice(0, 80), cls, due, count: qs.length, preview: qs.slice(0, 3).map(q => q.q), _qs: qs }; } },
  /* ── أوامر إضافية: نقاط · درجة نشاط · رسالة للطلاب · اختبار جديد في الدفتر · شهادة ── */
  adjust_points: { act: 1, d: 'تجهيز إضافة أو خصم نقاط مكافآت (لا يُنفَّذ إلا بتأكيد المعلم، ويمكن التراجع). args: {students:["اسم",...] أو ["الكل"] مع cls, delta:رقم موجب للإضافة وسالب للخصم, reason?, cls?}', src: () => '💰 تجهيز نقاط',
    async run(a) { const d = Math.round(Number(String(a.delta ?? a.points ?? '').replace(/[٠-٩]/g, x => '٠١٢٣٤٥٦٧٨٩'.indexOf(x)))); if (!Number.isFinite(d) || !d || Math.abs(d) > 1000) return { error: 'حدّد عدد النقاط (من 1 إلى 1000، وسالب للخصم)' };
      const r = asstResolve(a.students || a.student, asstCls(a.cls)); return { action: 'points', delta: d, reason: String(a.reason || '').slice(0, 80), items: r.items.map(x => ({ name: x.name, cls: x.cls || '', before: Number(x.points) || 0, _id: x.id })), unresolved: r.bad }; } },
  grade_activity: { act: 1, d: 'تجهيز رصد أو تعديل درجة طالب في نشاط يدويًا (بتأكيد وتراجع). args: {activity:"جزء من العنوان" أو "آخر", scores:[{"student":"اسم","score":رقم}]}', src: a => '✍️ تجهيز درجات «' + (a._title || a.activity || '') + '»',
    async run(a) { const m = asstFindAct(a.activity); if (!m.length) return { error: 'لم أجد النشاط' }; if (m.length > 1) return { error: 'أكثر من نشاط يطابق', matches: m.slice(0, 8).map(h => h.title) };
      const h = m[0], max = Number(h.max) || 20, L = Array.isArray(a.scores) ? a.scores : [{ student: a.student, score: a.score }], items = [], bad = []; a._title = h.title;
      for (const x of L) { const q = String(x && x.student || '').trim(), f = asstFindStudent(q); if (f.length !== 1) { bad.push({ q, matches: f.slice(0, 5).map(s => s.name + ' — ' + (s.cls || '')) }); continue; }
        const st = f[0], v = Number(String(x.score ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))); if (!Number.isFinite(v)) { bad.push({ q: q + ': ليست درجة', matches: [] }); continue; }
        const key = h.subs && h.subs[st.name] && !h.subs[st.id] ? st.name : st.id, sub = (h.subs || {})[key], auto = sub ? Math.round(max * (sub.correct || 0) / Math.max(1, sub.total || 1)) : null;
        items.push({ name: st.name, cls: st.cls || '', score: Math.max(0, Math.min(max, v)), over: v > max ? v : undefined, prev: sub ? (sub.manualGrade ?? auto) : 'لم يسلّم', _key: key, _prev: sub ? JSON.parse(JSON.stringify(sub)) : null }); }
      return { action: 'grade', title: h.title, max, _hid: h.id, items, unresolved: bad }; } },
  send_message: { act: 1, d: 'تجهيز رسالة تظهر للطلاب في بوابتهم (تُعرض كاملة ولا تُرسل إلا بتأكيد المعلم). args: {to:"all"|"class"|"students", cls?:"فصل" (مع class), students?:["اسم",...], title, body, type?:"message"|"warning"|"achievement"|"activity"|"exam" (exam = إعلان موعد اختبار يظهر في شريط الأسبوع؛ مع exam_date, time?, pages?, topics?, mark?), priority?:"normal"|"important"|"urgent"}', src: () => '💬 تجهيز رسالة للطلاب',
    async run(a) { const title = String(a.title || '').trim().slice(0, 120), body = String(a.body || '').trim().slice(0, 1000), exam = a.type === 'exam';
      if (!title || (!body && !exam)) return { error: 'الرسالة تحتاج عنوانًا ونصًا' }; const examDate = exam ? asstDue(a.exam_date || a.date) : ''; if (exam && !examDate) return { error: 'حدّد تاريخ الاختبار' };
      const ex = exam ? { d: examDate, tm: String(a.time || ''), mk: String(a.mark || ''), pg: String(a.pages || ''), tp: String(a.topics || ''), n: body } : null;
      let to = ['all', 'class', 'students'].includes(a.to) ? a.to : (a.students ? 'students' : a.cls ? 'class' : 'all'), cls = asstCls(a.cls), r = { items: [], bad: [] };
      if (to === 'class' && !cls) return { error: 'لم أجد الفصل: ' + (a.cls || '') };
      if (to === 'students') { r = asstResolve(a.students || a.student); if (!r.items.length) return { error: 'لم أحدّد أي طالب', unresolved: r.bad }; }
      const n = to === 'all' ? asstStudents().length : to === 'class' ? asstStudents().filter(s => String(s.cls || '') === cls).length : r.items.length;
      return { action: 'msg', to, cls, title, body, type: ['message', 'warning', 'achievement', 'activity', 'exam'].includes(a.type) ? a.type : 'message', examDate, ex, priority: ['important', 'urgent'].includes(a.priority) ? a.priority : 'normal', count: n,
        items: r.items.map(x => ({ name: x.name, cls: x.cls || '', _id: String(x.id) })), unresolved: r.bad }; } },
  add_exam_test: { act: 1, d: 'تجهيز إضافة اختبار جديد إلى دفتر الاختبارات (بتأكيد وتراجع). args: {title, max:الدرجة العظمى, sem?, per?}', src: () => '📝 تجهيز اختبار جديد',
    async run(a) { const { sem, per, label } = asstSP(a); if (typeof qrPerClosed === 'function' && qrPerClosed(sem, per)) return { error: '🔒 ' + label + ' مغلقة' };
      const title = String(a.title || '').trim().slice(0, 80), max = Number(String(a.max ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))); if (!title) return { error: 'اكتب عنوان الاختبار' }; if (!(max > 0 && max <= 200)) return { error: 'حدّد الدرجة العظمى (1–200)' };
      const b = await asstBook(sem, per); if (b.tests.some(t => asstTok(t.title).join(' ') === asstTok(title).join(' '))) return { error: 'يوجد اختبار بهذا العنوان في ' + label };
      return { action: 'test', sem, per, period: label, title, max }; } },
  certificate: { act: 1, d: 'تجهيز إصدار شهادة شكر وتقدير لطالب أو أكثر (بتأكيد وتراجع). args: {students:["اسم",...], reason:"سبب التكريم"}', src: () => '🏅 تجهيز شهادة',
    async run(a) { const r = asstResolve(a.students || a.student); return { action: 'cert', reason: String(a.reason || 'التميّز').slice(0, 80), items: r.items.map(x => ({ name: x.name, cls: x.cls || '', _id: String(x.id) })), unresolved: r.bad }; } },
  /* ── 🆕 الدفعة الثالثة: أنشطة · خطط · مقارنة · تواصل · تذكيرات · اختصارات ── */
  activity_due: { act: 1, d: 'تجهيز تغيير موعد إغلاق نشاط منشور أو تمديده (يُعاد نشره بالموعد الجديد، بتأكيد وتراجع). args: {activity, due:"YYYY-MM-DD"|"الأحد"|"بكرة"}', src: a => '📅 تجهيز موعد «' + (a._title || a.activity || '') + '»',
    async run(a) { const m = asstFindAct(a.activity); if (!m.length) return { error: 'لم أجد النشاط' }; if (m.length > 1) return { error: 'أكثر من نشاط يطابق', matches: m.slice(0, 8).map(h => h.title) };
      const h = m[0], due = asstDue(a.due); a._title = h.title; if (!due) return { error: 'لم أفهم الموعد: ' + (a.due || '') }; return { action: 'due', title: h.title, from: h.due || '', due, _hid: h.id }; } },
  extra_attempt: { act: 1, d: 'تجهيز محاولة إضافية لطالب أو أكثر في نشاط (بتأكيد). args: {activity, students:["اسم",...]}', src: a => '🔁 تجهيز محاولة إضافية',
    async run(a) { const m = asstFindAct(a.activity); if (!m.length) return { error: 'لم أجد النشاط' }; if (m.length > 1) return { error: 'أكثر من نشاط يطابق', matches: m.slice(0, 8).map(h => h.title) };
      const r = asstResolve(a.students || a.student); return { action: 'retry', title: m[0].title, _hid: m[0].id, items: r.items.map(x => ({ name: x.name, cls: x.cls || '', _id: x.id })), unresolved: r.bad }; } },
  copy_activity: { act: 1, d: 'نسخ نشاط كمسودة غير منشورة لفصل آخر (تُفتح للمراجعة والنشر). args: {activity, cls?, due?}', src: () => '📄 تجهيز نسخة نشاط',
    async run(a) { const m = asstFindAct(a.activity); if (!m.length) return { error: 'لم أجد النشاط' }; if (m.length > 1) return { error: 'أكثر من نشاط يطابق', matches: m.slice(0, 8).map(h => h.title) };
      const h = m[0], cls = asstCls(a.cls); if (a.cls && !cls) return { error: 'لم أجد الفصل: ' + a.cls }; return { action: 'activity', copy: 1, title: h.title + (cls ? ' — ' + cls : ' (نسخة)'), cls, due: asstDue(a.due), count: (h.qs || []).length, preview: (h.qs || []).slice(0, 3).map(q => String(q.q || q.w || 'مهمة').slice(0, 90)), _src: h.id }; } },
  remedial: { act: 1, d: 'نشاط علاجي من نشاط سابق (يفتح شاشة «نشاط علاجي» الجاهزة: تختار الأسئلة الأكثر خطأ ولمن). args: {activity}', src: () => '🩹 نشاط علاجي',
    async run(a) { const m = asstFindAct(a.activity); if (m.length !== 1) return { error: m.length ? 'أكثر من نشاط يطابق' : 'لم أجد النشاط', matches: m.slice(0, 8).map(h => h.title) }; return { action: 'nav', page: 'remedial', label: '🩹 نشاط علاجي', name: m[0].title, _hid: m[0].id }; } },
  remedial_plan: { act: 1, d: 'خطة علاجية: لطالب، أو لمجموعة الضعاف في مهارة (تفتح نموذج الخطة جاهزًا للمراجعة). args: {student?} أو {skill:"جزء من اسم المهارة", cls?}', src: () => '🩺 خطة علاجية',
    async run(a) { if (a.student) { const m = asstFindStudent(a.student); if (m.length !== 1) return { error: m.length ? 'أكثر من طالب يطابق' : 'لم أجد الطالب' }; return { action: 'nav', page: 'plan', label: '🩺 خطة علاجية', name: m[0].name, _sid: String(m[0].id) }; }
      const sk = await ASST_TOOLS.skills.run({ cls: a.cls, n: 99 }); if (sk.error) return sk; const t = asstTok(a.skill || ''), hit = (sk.skills || []).filter(x => t.length ? t.every(w => asstTok(x.skill).some(y => y.includes(w))) : true);
      if (!hit.length) return { error: 'لم أجد المهارة', skills: (sk.skills || []).slice(0, 10).map(x => x.skill) }; const s0 = hit[0], cls = asstCls(a.cls);
      const ids = asstStudents().filter(s => !cls || String(s.cls || '') === cls).filter(s => { const v = (typeof ctSk === 'function' ? ctSk(s.id) : {})[s0.skill]; return v && v.rate < 60; }).map(s => String(s.id));
      if (!ids.length) return { error: 'لا يوجد طلاب دون 60% في «' + s0.skill + '»' }; return { action: 'nav', page: 'plan', label: '🩺 خطة جماعية', name: s0.skill + ' (' + ids.length + ' طالب)', _skill: s0.skill, _ids: ids }; } },
  compare_classes: { d: 'مقارنة فصلين أو أكثر: عدد الطلاب، متوسط الاختبارات، نسبة تسليم الأنشطة، الغياب آخر 30 يومًا، وأضعف المهارات. args: {classes:["أول 1","أول 2"]}', src: () => '⚖️ مقارنة الفصول',
    async run(a) { const L = (Array.isArray(a.classes) && a.classes.length ? a.classes : asstClsList()).map(asstCls).filter(Boolean); if (L.length < 2) return { error: 'حدّد فصلين على الأقل', classes: asstClsList() };
      const { sem, per } = asstSP({}), b = await asstBook(sem, per), D = await asstClassroom(), from = new Date(Date.now() + 3 * 3600e3 - 30 * 864e5).toISOString().slice(0, 10);
      const out = []; for (const cls of L) { const S = asstStudents().filter(s => String(s.cls || '') === cls), ids = new Set(S.map(s => String(s.id)));
        const ex = []; b.tests.forEach(t => S.forEach(s => { const v = asstExV(b, s.id, t.id); if (typeof v === 'number') ex.push(v / Math.max(1, Number(t.max) || 1) * 100); }));
        let due = 0, got = 0; asstActs().filter(h => !h.noGrade).forEach(h => asstPool(h).forEach(s => { if (ids.has(String(s.id))) { due++; if (asstSub(h, s)) got++; } }));
        let abs = 0; Object.entries(D.participation || {}).forEach(([d, P]) => { if (d >= from) Object.entries(P || {}).forEach(([id, v]) => { if (ids.has(String(id)) && v && ABSENT.includes(v.status)) abs++; }); });
        const sk = await ASST_TOOLS.skills.run({ cls, n: 3 });
        out.push({ cls, students: S.length, exam_avg_pct: ex.length ? Math.round(ex.reduce((n, x) => n + x, 0) / ex.length) : null, submission_pct: due ? Math.round(got / due * 100) : null, absences_30d: abs, weakest_skills: (sk.skills || []).map(x => x.skill + ' ' + x.rate + '%') }); }
      return { classes: out }; } },
  student_messages: { d: 'رسائل الطلاب للمعلم («راسل معلمك»): المفتوحة التي تنتظر ردًا (الأحدث أولًا). args: {all?:true للمغلقة أيضًا}', src: () => '💬 رسائل الطلاب',
    async run(a) { try { if (typeof asksLoad === 'function') await asksLoad(); } catch (e) {} const R = typeof ASKS !== 'undefined' && Array.isArray(ASKS) ? ASKS : null; if (!R) return { error: 'تعذّر جلب الرسائل' };
      const L = R.filter(x => x && x.kind !== 't' && (a.all || x.status === 'open')).slice(0, 15); return { open: R.filter(x => x && x.status === 'open').length, messages: L.map((x, n) => ({ n: n + 1, name: x.name || '', cls: x.cls || '', about: (typeof ASK_CATS !== 'undefined' && ASK_CATS[x.cat]) || x.cat || '', activity: x.hwTitle || undefined, text: String(x.text || '').slice(0, 300), status: x.status === 'open' ? 'تنتظر ردك' : 'مغلقة', reply: x.reply || undefined })) }; } },
  reply_student: { act: 1, d: 'تجهيز رد على رسالة طالب (يصله في تنبيهاته بعد تأكيد المعلم). args: {student:"اسم صاحب الرسالة", reply:"نص الرد", close?:true لإغلاقها بعد الرد}', src: () => '📩 تجهيز رد',
    async run(a) { try { if (typeof asksLoad === 'function' && (typeof ASKS === 'undefined' || !ASKS)) await asksLoad(); } catch (e) {} const R = (typeof ASKS !== 'undefined' && ASKS || []).filter(x => x && x.status === 'open');
      const t = asstTok(a.student || ''), m = R.filter(x => t.length && t.every((w, i) => asstTok(x.name || '').some(y => y.startsWith(w)))); if (!m.length) return { error: 'لا توجد رسالة مفتوحة من هذا الطالب' };
      const x = m[0], reply = String(a.reply || '').trim().slice(0, 800); if (!reply) return { error: 'اكتب نص الرد' }; return { action: 'reply', name: x.name, q: String(x.text || '').slice(0, 200), reply, close: !!a.close, _aid: x.id }; } },
  parent_drafts: { act: 1, d: 'مسودات رسائل لأولياء أمور مجموعة طلاب دفعة واحدة (كثيرو الغياب أو من لم يسلّموا)، يرسلها المعلم بنفسه من واتساب. args: {reason:"absence"|"missing", min?:الحد الأدنى (افتراضي 3), cls?, days?:30}', src: () => '✉️ مسودات أولياء الأمور',
    async run(a) { const min = Math.max(1, Number(a.min) || 3), reason = a.reason === 'missing' ? 'missing' : 'absence', subj = (typeof rcGet === 'function' && rcGet('subject')) || 'المادة';
      const L = reason === 'missing' ? (await ASST_TOOLS.missing_work.run({ cls: a.cls, n: 50 })).students.filter(x => x.missing >= min).map(x => ({ ...x, n: x.missing }))
        : (await ASST_TOOLS.absence_totals.run({ cls: a.cls, days: a.days || 30, n: 50 })).students.map(x => ({ ...x, n: x.absent + x.excused })).filter(x => x.n >= min);
      if (!L.length) return { error: 'لا يوجد طلاب ينطبق عليهم الشرط' };
      const txt = x => `السلام عليكم ورحمة الله، ولي أمر الطالب ${x.name}،\n\nنود إفادتكم بأن ابنكم ${reason === 'missing' ? `لم يسلّم ${x.n} من أنشطة ${subj}` : `تغيّب ${x.n} ${x.n <= 10 ? 'أيام/حصص' : 'يومًا/حصة'} خلال الفترة الأخيرة`}، ونأمل متابعته وحثّه على ${reason === 'missing' ? 'إكمالها' : 'الانتظام'}.\nشاكرين تعاونكم.\nمعلم المادة`;
      return { action: 'drafts', reason, items: L.map(x => { const s = asstFindStudent(x.name).find(y => String(y.cls || '') === x.cls) || asstFindStudent(x.name)[0]; return { name: x.name, cls: x.cls, n: x.n, text: txt(x), _id: s ? String(s.id) : '' }; }) }; } },
  reminder: { act: 1, d: 'تذكير شخصي للمعلم يظهر في «مهام اليوم» وإشعاراته في موعده (بتأكيد وتراجع). args: {title, date?:"اليوم"|"بكرة"|"الخميس"|"YYYY-MM-DD", time?:"HH:MM" (24 ساعة)}', src: () => '⏰ تجهيز تذكير',
    async run(a) { const title = String(a.title || '').trim().slice(0, 80); if (!title) return { error: 'اكتب نص التذكير' }; const date = asstDue(a.date || 'اليوم') || asstToday();
      const tm = String(a.time || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).match(/^(\d{1,2})(?::(\d{2}))?$/), hm = tm ? String(Math.min(23, +tm[1])).padStart(2, '0') + ':' + (tm[2] || '00') : '07:00';
      return { action: 'rem', title, date, hm }; } },
  shortcut: { act: 1, d: 'حفظ اختصار: اسم قصير يشغّل أمرًا كاملًا متعدد الخطوات عند كتابته (أو حذفه إن كان command فارغًا). args: {name:"بداية الحصة", command:"الأمر كاملًا كما يكتبه المعلم"}', src: () => '⚡ اختصار',
    async run(a) { const name = String(a.name || '').trim().slice(0, 40), command = String(a.command || '').trim().slice(0, 400); if (!name) return { error: 'سمِّ الاختصار' }; return { action: 'shortcut', name, command, had: !!asstShortcuts()[name] }; } },
  open_page: { act: 1, d: 'فتح صفحة في اللوحة أو طباعة كشف. args: {page:"student"(ملف طالب، مع student)|"report"(طباعة تقرير أنشطة طالب، مع student)|"activity"(فتح نموذج نشاط لتعديله أو نشره، مع activity)|"exams"(دفتر الاختبارات، مع sem/per/cls)|"records"(الحضور والسجلات)|"analysis"(المستويات وخريطة المهارات)|"grades"(كشف الدرجات، مع cls و print:true للطباعة)|"activities"|"students"|"home"|"nafs"|"plans"|"reports"|"messages"|"certs"|"paper_exams"|"settings", student?, cls?, sem?, per?, print?:true|false}', src: () => '🧭 تنقّل',
    async run(a) { const pg = String(a.page || '').trim(), P = ASST_PAGES[pg]; if (!P) return { error: 'صفحة غير معروفة: ' + pg, pages: Object.keys(ASST_PAGES) };
      const r = { action: 'nav', page: pg, label: P[1], cls: asstCls(a.cls), print: !!a.print && pg === 'grades' };
      if (pg === 'student' || pg === 'report') { const m = asstFindStudent(a.student); if (m.length !== 1) return m.length ? { error: 'أكثر من طالب يطابق', matches: m.slice(0, 8).map(s => s.name + ' — ' + (s.cls || '')) } : { error: 'لم أجد الطالب' }; r.name = m[0].name; r.cls = m[0].cls || ''; r._sid = String(m[0].id); }
      if (pg === 'activity') { const t = asstTok(a.activity || ''), all = (typeof HW !== 'undefined' && Array.isArray(HW) ? HW : []).filter(h => h && h.id), m = /^(آخر|اخر)$/.test(String(a.activity || '').trim()) ? all.slice(-1) : all.filter(h => t.length && t.every(w => asstTok(h.title || '').some(x => x.includes(w))));
        if (m.length !== 1) return { error: m.length ? 'أكثر من نشاط يطابق' : 'لم أجد النشاط', matches: m.slice(0, 8).map(h => h.title) }; r.name = m[0].title; r._hid = m[0].id; }
      if (pg === 'exams') { const sp = asstSP(a); r.sem = sp.sem; r.per = sp.per; r.period = sp.label; }
      return r; } },
};
/* أسماء ← طلاب: «الكل» مع فصل = الفصل كله، والاسم المتكرر يُترك للمعلم يحدّده */
function asstResolve(list, cls) {
  const L = (Array.isArray(list) ? list : String(list || '').split(/[,،]| و /)).map(x => String(x || '').trim()).filter(Boolean), items = [], bad = [], seen = new Set();
  for (const q of L) {
    if (/^(الكل|كل الفصل|الجميع|كلهم)$/.test(q)) { asstStudents().filter(s => !cls || String(s.cls || '') === cls).forEach(s => { if (!seen.has(s.id)) { seen.add(s.id); items.push(s); } }); continue; }
    const m = asstFindStudent(q).filter(s => !cls || String(s.cls || '') === cls);
    if (m.length === 1) { if (!seen.has(m[0].id)) { seen.add(m[0].id); items.push(m[0]); } } else bad.push({ q, matches: m.slice(0, 5).map(s => s.name + ' — ' + (s.cls || '')) });
  }
  return { items, bad };
}
function asstDate(v) { v = String(v || '').trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v; if (/^(أمس|امس|البارحه|البارحة)$/.test(v)) return new Date(Date.now() + 3 * 3600e3 - 864e5).toISOString().slice(0, 10); return asstToday(); }
/* 📝 دفتر الاختبارات: الفترة (الجارية افتراضيًا) · الدرجة (رقم أو «غ» أو null) · البحث عن اختبار بعنوانه */
function asstSP(a) { const A = typeof ctSemActive === 'function' ? ctSemActive() : { sem: 1, per: 1 }, n = v => Number(String(v ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const sem = [1, 2].includes(n(a && a.sem)) ? n(a.sem) : A.sem, per = [1, 2].includes(n(a && a.per)) ? n(a.per) : A.per;
  return { sem, per, label: `الفصل ${sem === 2 ? 'الثاني' : 'الأول'} — الفترة ${per === 2 ? 'الثانية' : 'الأولى'}` }; }
async function asstBook(sem, per) { const D = await asstClassroom(); if (typeof ctBook === 'function') return ctBook(D, sem, per); const b = ((D.examBooks || {})[String(sem)] || {})[String(per)] || {}; return { tests: Array.isArray(b.tests) ? b.tests : [], scores: b.scores || {} }; }
function asstExV(b, sid, tid) { const v = ((b.scores || {})[String(sid)] || {})[String(tid)]; if (v == null || v === '') return null; if (typeof v === 'object') { if (v.del) return null; if (v.absent) return 'غ'; } const n = Number(typeof v === 'object' ? v.score : v); return Number.isFinite(n) ? n : null; }
function asstFindTest(b, q) {
  const T = b.tests || [], s0 = String(q || '').trim(); if (!T.length) return { error: 'لا توجد اختبارات في دفتر هذه الفترة' };
  if (!s0 || /^(آخر|اخر|الأخير|الاخير|last)$/i.test(s0)) return { t: T[T.length - 1] };
  const t = asstTok(s0), m = T.filter(x => String(x.id) === s0 || (t.length && t.every(w => asstTok(x.title || '').some(r => r.includes(w)))));
  return m.length === 1 ? { t: m[0] } : m.length ? { error: 'أكثر من اختبار يطابق', matches: m.map(x => x.title) } : { error: 'لم أجد اختبارًا بهذا العنوان', tests: T.map(x => x.title) };
}
async function asstFindTestAny(q, a) {   // الفترة المطلوبة/الجارية أولًا، ثم بقية الفترات
  const f = asstFindTest(await asstBook(asstSP(a).sem, asstSP(a).per), q); if (f.t || (a && (a.sem || a.per))) return f;
  for (const sem of [1, 2]) for (const per of [1, 2]) { const D = await asstClassroom(), b = ((D.examBooks || {})[String(sem)] || {})[String(per)]; if (b && Array.isArray(b.tests) && b.tests.length) { const g = asstFindTest(b, q); if (g.t) return g; } }
  return f;
}
const asstOmrQs = M => !M ? [] : (M.questions || []).concat(...(M.more || []).map(p => p.questions || []));
const asstOmrLab = (q, k) => { if (k == null || k < 0) return '—'; const l = q.t === 'tf' ? (k === 0 ? 'صح' : 'خطأ') : q.t === 'mt' ? String(k + 1) : (['أ', 'ب', 'ج', 'د', 'هـ', 'و'][k] || String(k + 1)); return Array.isArray(q.o) && q.o[k] ? l + ') ' + String(q.o[k]).slice(0, 40) : l; };
/* 📅 موعد نشاط: تاريخ، أو «بكرة/بعد بكرة»، أو اسم يوم (أقرب يوم قادم) */
function asstDue(v) { v = String(v || '').trim(); if (!v) return ''; if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const base = new Date(asstToday() + 'T12:00:00Z'), add = d => new Date(base.getTime() + d * 864e5).toISOString().slice(0, 10);
  if (/^(اليوم)$/.test(v)) return add(0); if (/^(بكرة|بكره|غدا|غدًا|غداً)$/.test(v)) return add(1); if (/^بعد ?بكر[ةه]$/.test(v)) return add(2);
  const D = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map(x => asstTok(x)[0]), i = D.findIndex(x => asstTok(v.replace(/^يوم\s+/, ''))[0] === x || asstTok(v)[0] === x.replace(/^ال/, ''));
  if (i < 0) return ''; let d = (i - base.getUTCDay() + 7) % 7; if (!d) d = 7; return add(d); }
/* 🧭 الصفحات التي يفتحها المساعد */
const ASST_PAGES = { home: ['dashboard', '🏠 الرئيسية'], report: [null, '🖨️ تقرير الطالب'], activity: ['hw', '📋 نشاط'], live: ['live', '🎮 الحصص المباشرة'], activities: ['hw', '📋 الأنشطة'], students: ['students', '👥 الطلاب'], student: [null, '👤 ملف الطالب'], records: ['classtools:records', '🗂️ السجلات والحضور'],
  exams: ['classtools:exams', '📝 دفتر الاختبارات'], analysis: ['classtools:analysis', '📈 المستويات والمهارات'], grades: ['grades', '📊 كشف الدرجات'], nafs: ['nafs', '🧭 نافس'], plans: ['plans', '🩺 الخطط العلاجية'],
  reports: ['reports', '📑 التقارير'], messages: ['messages', '💬 الرسائل'], certs: ['classtools:certs', '🏅 الشهادات'], paper_exams: ['exam', '🖨️ الاختبارات الورقية'], settings: ['data', '⚙️ الإعدادات'] };
function asstGo(c) {
  asstClose();
  try {
    if (c.page === 'student') { ctOpenProfile(c._sid); return; }
    if (c.page === 'remedial') { goTab('hw'); setTimeout(() => { try { window.remedialHw(c._hid); } catch (e) {} }, 400); return; }
    if (c.page === 'plan') { if (c._sid) window.ctPlanStudent(c._sid); else window.ctGroupPlan(c._skill, c._ids); return; }
    if (c.page === 'report') { window.printStudentReport(c._sid); return; }
    if (c.page === 'activity') { goTab('hw'); setTimeout(() => { try { openHwForm(c._hid); } catch (e) {} }, 350); return; }
    if (c.page === 'exams') { window._ctExSem = String(c.sem || ''); window._ctExPer = String(c.per || ''); if (c.cls) window._ctExCls = c.cls; }
    goTab(ASST_PAGES[c.page][0]);
    if (c.page === 'exams' && typeof renderClassTools === 'function') renderClassTools();
    if (c.page === 'grades') { const s = document.getElementById('g-class'); if (s) { if (typeof gFillClasses === 'function') gFillClasses(); s.value = c.cls && [...s.options].some(o => o.value === c.cls) ? c.cls : '__all__'; renderGrades(); }
      if (c.print) setTimeout(() => { try { window.printGrades(); } catch (e) { toast('تعذّرت الطباعة', 'bad'); } }, 400); }
  } catch (e) { toast('تعذّر فتح الصفحة', 'bad'); }
}
function asstMakeDraft(c) {
  if (c._hid && typeof HW !== 'undefined' && HW.some(h => h && h.id === c._hid)) { asstClose(); try { goTab('hw'); } catch (e) {} setTimeout(() => { try { openHwForm(c._hid); } catch (e) {} }, 350); return; }
  let h; if (c._src) { const o = (HW || []).find(x => x.id === c._src); if (!o) { toast('النشاط الأصلي غير موجود', 'bad'); return; }
    h = JSON.parse(JSON.stringify(o)); ['sid', 'published', 'publishedAt', 'subs', 'extraAttempts', 'pubHash', 'lastPub'].forEach(k => delete h[k]); Object.assign(h, { id: uid(), title: c.title, cls: c.cls || '', clsList: c.cls ? [] : (o.clsList || []), due: c.due || '', subs: {}, at: Date.now() }); }
  else h = { id: uid(), title: c.title, cls: c.cls || '', clsList: [], due: c.due || '', pts: 30, max: 20, kind: 'normal', qs: c._qs, subs: {}, at: Date.now() };
  HW.push(h); save(K.hw, HW); c._hid = h.id;
  toast(`✍️ أُنشئت مسودة «${c.title}» بـ ${(h.qs || []).length} سؤال — راجعها ثم انشرها`, 'good');
  asstClose(); try { goTab('hw'); } catch (e) {} setTimeout(() => { try { openHwForm(h.id); } catch (e) {} }, 350);
}
const asstStrip = o => JSON.parse(JSON.stringify(o, (k, v) => (k[0] === '_' ? undefined : v)));   // لا معرّفات ولا قيم داخلية للمزوّد
const asstIntro = () => `أنت «مساعدي» داخل لوحة معلم سعودي. اليوم ${asstToday()}. الفصول: ${asstClsList().join('، ') || '—'}. آخر الأنشطة: ${asstActs().slice(-12).map(h => '«' + h.title + '»').join('، ') || '—'}.`;

/* ⚡ الاختصارات: اسم ← أمر كامل (محفوظة في الجهاز) */
function asstShortcuts() { try { const o = JSON.parse(localStorage.getItem('asst_sc_v1') || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
function asstSuggPaint() { const b = document.querySelector('#asst-panel .asst-sugg'); if (b) b.innerHTML = asstSuggHTML(); }
function asstSuggHTML() { return Object.keys(asstShortcuts()).map(n => `<button type="button" class="sc" onclick="asstAsk(this.dataset.n)" data-n="${asstEsc(n)}">⚡ ${asstEsc(n)}</button>`).join('') + ASST_SUGG.map(s => `<button type="button" onclick="${s[0] === '☀' ? 'asstShowBrief()' : 'asstAsk(this.textContent)'}">${asstEsc(s)}</button>`).join(''); }
/* 🧠 ذاكرة المحادثة: تبقى بعد إغلاق الصفحة (في هذا الجهاز فقط، آخر 40 رسالة) — «↺» ينسى */
function asstSave() { try { if (!ASST.msgs.length) { localStorage.removeItem('asst_hist_v1'); return; } localStorage.setItem('asst_hist_v1', JSON.stringify(ASST.msgs.filter(m => !m.err && !/asst-dots/.test(m.html || '')).slice(-40).map(m => ({ ...m, cards: (m.cards || []).map(c => ({ ...c, _qs: undefined, state: ['ask', 'busy', 'fail'].includes(c.state) && !['draft', 'drafts'].includes(c.action) ? 'no' : c.state })) })))); } catch (e) {} }
function asstLoadHist() { try { const L = JSON.parse(localStorage.getItem('asst_hist_v1') || '[]'); if (Array.isArray(L) && !ASST.msgs.length) ASST.msgs = L; } catch (e) {} }
function asstForget() { ASST.msgs = []; try { localStorage.removeItem('asst_hist_v1'); } catch (e) {} asstPaint(); }
/* 🗣️ وضع المحادثة: بعد كل جواب (وبعد قراءته إن كانت القراءة مفعّلة) يعود الميكروفون يسمعك بلا ضغطة */
const asstConvOn = () => { try { return localStorage.getItem('asst_conv') === '1'; } catch (e) { return false; } };
function asstConvToggle() { const on = !asstConvOn(); try { if (on) localStorage.setItem('asst_conv', '1'); else localStorage.removeItem('asst_conv'); } catch (e) {} const b = document.getElementById('asst-conv'); if (b) b.classList.toggle('on', on);
  toast(on ? '🗣️ وضع المحادثة: تكلّم الحين — أرد وأرجع أسمعك لحالي' : '🗣️ أُقفل وضع المحادثة', 'good'); setTimeout(asstLive, 0); if (on && !ASST_MIC && !ASST.busy) asstMic(); else if (!on) asstMicStop(); }
function asstConvNext() { const p = document.getElementById('asst-panel'); if (asstConvOn() && p && p.classList.contains('on') && !ASST_MIC && !ASST.busy) asstMic(); }

/* ── تشغيل سؤال ── */
function asstFast(q) {   // ⚡ بلا ذكاء: «مين الغايب اليوم» و«افتح ملف فلان»
  const t = String(q || ''), pf = t.match(/^\s*(?:افتح|إفتح|فتح|افتحي|ودّني|ودني|روح)\s+(?:لي\s+)?ملف\s+(?:الطالب\s+)?(.+?)\s*[؟?.!]*\s*$/);
  if (pf && !/^(ال)?فصل(\s|$)/.test(pf[1])) return { tool: 'open_page', args: { page: 'student', student: pf[1] } };
  const pp = t.match(/^\s*(?:كم\s+)?(?:نقاط|رصيد(?:\s+نقاط)?)\s+(?:الطالب\s+)?(.+?)(?:\s+كم)?\s*[؟?.!]*\s*$/);
  if (pp && asstFindStudent(pp[1]).length === 1) return { tool: 'points', args: { student: pp[1] } }; if (!/(غايب|غائب|غياب|غابو|غابوا|الغائبين|الحضور)/.test(t)) return null;
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
  q = String(q || '').trim(); if (!q || ASST.busy) return; asstSpeakStop(); asstAudioUnlock();
  if (/^(سجل|سجلّ) (المايك|الميكروفون)$/.test(q)) { ASST.msgs.push({ me: 1, html: asstEsc(q) }, { html: '<b>🩺 أحداث الميكروفون</b><br>' + (window.HWV ? `iPhone: ${HWV.ios ? 'نعم' : 'لا'} · الجلسة: ${HWV.active ? 'مفتوحة' : 'مقفلة'}<br>` : '') + (ASST_MLOG.map(asstEsc).join('<br>') || 'لا أحداث بعد'), src: [] }); asstPaint(); return; }
  { const S = asstShortcuts(), k = Object.keys(S).find(n => asstTok(n).join(' ') === asstTok(q.replace(/[؟?.!]+$/, '')).join(' ')); if (k) { ASST.msgs.push({ me: 1, html: '⚡ ' + asstEsc(k) }); q = S[k]; } }
  ASST.busy = true; ASST.msgs.push({ me: 1, html: asstEsc(q) }); const bot = { html: '<i class="asst-dots"><b></b><b></b><b></b></i>', src: [] }; ASST.msgs.push(bot); asstPaint();
  try {
    const fast = asstFast(q);
    if (fast) { const r = await ASST_TOOLS[fast.tool].run(fast.args); bot.src = [ASST_TOOLS[fast.tool].src(fast.args), '⚡ فوري بلا ذكاء'];
      if (fast.tool === 'open_page') { if (r.error) { bot.html = '⚠️ ' + asstEsc(r.error) + (r.matches ? '<br>' + r.matches.map(asstEsc).join('<br>') : ''); return; } bot.cards = [{ ...r, state: 'ask' }]; bot.text = 'فتحت لك ' + r.label + (r.name ? ' — ' + r.name : ''); bot.html = asstMd(bot.text); bot._auto = 1; return; }
      if (fast.tool === 'points') { bot.text = `رصيد ${r.name}: ${r.reward_points} نقطة`; bot.html = `رصيد <b>${asstEsc(r.name)}</b> <small>(${asstEsc(r.cls)})</small>: <b>${r.reward_points}</b> نقطة`; return; }
      bot.html = asstRenderFast(r); return; }
    if (typeof readingAICall !== 'function') throw new Error('الذكاء الاصطناعي غير محمّل');
    const R = typeof aiRoute === 'function' ? aiRoute('assistant') : { p: raiProvider(), m: readingAIModels()[raiProvider()] };
    if (!readingAIGetKey(R.p)) throw new Error('أضف مفتاح ذكاء اصطناعي من ⚙️ الإعدادات ← الذكاء الاصطناعي');
    const hist = ASST.msgs.slice(-8, -2).map(m => (m.me ? 'المعلم: ' : 'المساعد: ') + String(m.text || m.html || '').replace(/<[^>]+>/g, ' ').slice(0, 300)).join('\n');
    const tools = Object.entries(ASST_TOOLS).map(([k, t]) => `- ${k}: ${t.d}`).join('\n');
    const plan = aiSafeJson(await readingAICall(R.p, R.m, `${asstIntro()}
الأدوات المتاحة (تُحسب من بيانات المعلم):
${tools}
${hist ? 'المحادثة السابقة:\n' + hist + '\n' : ''}سؤال المعلم: ${q}
اختر الأدوات التي تكفي للجواب (غالبًا واحدة أو اثنتان). «النقاط» = رصيد نقاط المكافآت (أداة points للعرض وadjust_points للإضافة والخصم)، وهي غير «الدرجات». «الكل … ما عدا فلان» = students:["الكل"] مع cls وexcept، وإن ذُكرت حالة للمستثنين فخطوة ثانية لهم. عند عرض رسائل الطلاب اقترح ردًا قصيرًا لكل رسالة. لديك أدوات تنفيذ واسعة (كلها بتأكيد المعلم) — استخدمها ولا تعتذر ما دامت أداة تغطي الطلب. إن طلب المعلم تنفيذ شيء (رصد غياب/مشاركة/واجب، درجة اختبار، ملاحظة سلوك، تذكير، رسالة لولي أمر، مسودة نشاط، فتح صفحة أو طباعة) فاستخدم أداة التجهيز المناسبة — لن يُنفَّذ شيء إلا بعد تأكيده.
إن طلب عدة مهام في رسالة واحدة فأخرج خطوة لكل مهمة بترتيبها (حتى 6 خطوات)، وكل خطوة تنفيذية تظهر له ببطاقة تأكيد مستقلة.
أخرج JSON فقط: {"calls":[{"tool":"اسم","args":{...}}]}
وإن كان السؤال لا يحتاج بيانات (تحية أو سؤال عام) أخرج {"answer":"ردّك"}.`, new AbortController().signal)) || {};
    if (plan.answer && !(Array.isArray(plan.calls) && plan.calls.length)) { bot.html = asstMd(plan.answer); bot.text = plan.answer; bot.src = [asstUsed()]; return; }
    const calls = (Array.isArray(plan.calls) ? plan.calls : []).filter(c => c && ASST_TOOLS[c.tool]).slice(0, 6);
    if (!calls.length) throw new Error('ما فهمت السؤال — جرّب صياغة أوضح، مثل: «مين أعلى درجة في آخر نشاط؟»');
    const results = []; for (const c of calls) { const a = c.args && typeof c.args === 'object' ? c.args : {}; results.push({ tool: c.tool, result: await ASST_TOOLS[c.tool].run(a) }); bot.src.push(ASST_TOOLS[c.tool].src(a)); }
    bot.cards = results.map(r => r.result).filter(r => r && ASST_ACTS.includes(r.action)).map(r => ({ ...r, state: 'ask' }));
    if (bot.cards.length > 1) bot.cards.forEach((c, k) => { c._step = (k + 1) + ' من ' + bot.cards.length; });
    const info = results.filter(r => !(r.result && ASST_ACTS.includes(r.result.action) && r.result.action !== 'draft')), draft = bot.cards.find(c => c.action === 'draft');
    if (!info.length) { const only = bot.cards.length === 1 && calls.length === 1 && bot.cards[0].action === 'nav';
      bot.text = only ? 'فتحت لك ' + bot.cards[0].label + (bot.cards[0].name ? ' — ' + bot.cards[0].name : '') : bot.cards.length > 1 ? `جهّزت ${bot.cards.length} خطوات — راجع كل خطوة واضغط «نفّذ»:` : bot.cards.length ? 'راجع ثم اضغط «نفّذ»:' : 'لم أجد ما أجهّزه.'; bot.html = asstMd(bot.text);
      if (only) { bot._auto = 1; } return; }
    const ans = aiSafeJson(await readingAICall(R.p, R.m, `${asstIntro()}
سؤال المعلم: ${q}
نتائج الأدوات من بياناته:
${JSON.stringify(asstStrip(info)).slice(0, 14000)}
أجب المعلم بالعربية بإيجاز ودقة من هذه النتائج فقط — لا تخترع أسماء أو أرقامًا. reward_points هي «النقاط» (مكافآت)، ولا تسمِّ أي درجة نقاطًا. استخدم **عريض** للأهم وقائمة بـ «- » عند الحاجة. إن كانت القائمة طويلة اذكر أهمها والعدد. إن كان في النتائج error فاشرحه واقترح صياغة.
${draft ? 'واكتب في draft رسالة مهذبة قصيرة لولي أمر الطالب بالعربية الفصحى المبسطة عن الموضوع، مبنية على بياناته فقط، تبدأ بـ «السلام عليكم ورحمة الله» وتنتهي بتوقيع «معلم المادة».\nأخرج JSON فقط: {"answer":"...","draft":"..."}' : 'أخرج JSON فقط: {"answer":"..."}'}`, new AbortController().signal)) || {};
    if (draft) draft.text = String(ans.draft || '');
    bot.text = String(ans.answer || ''); bot.html = asstMd(bot.text || (draft ? 'هذه المسودة — عدّلها كما تشاء:' : 'لم يصل جواب — جرّب مرة أخرى')); bot.src.push(asstUsed());
  } catch (e) { bot.html = '⚠️ ' + asstEsc(e && e.message || 'تعذّر'); bot.err = 1; }
  finally { ASST.busy = false; bot.src = bot.src.filter(Boolean); asstPaint(); if (bot._auto) { delete bot._auto; setTimeout(() => asstAct(ASST.msgs.indexOf(bot), 0, 'do'), 600); } else if (!bot.err) asstSpeak(bot.text || bot.html).then(asstConvNext, asstConvNext); else asstConvNext(); }
}
function asstUsed() { try { const j = JSON.parse(localStorage.getItem('ai_last_used') || 'null'); if (!j) return ''; const c = (typeof READING_AI_PROVIDERS !== 'undefined' && READING_AI_PROVIDERS[j.p]) || { name: j.p }; return '🤖 ' + c.name + ' · ' + j.m; } catch (e) { return ''; } }

/* ── بطاقات التأكيد: لا شيء يُكتب قبل «نفّذ» — والرصد يمر بطابور الرصد السريع نفسه (يحفظ بلا إنترنت ويُزامَن) ── */
const asstDay = d => !d ? '' : /^\d{4}-\d{2}-\d{2}$/.test(d) ? (d === asstToday() ? 'اليوم' : (typeof fmtExamDate === 'function' ? fmtExamDate(d) : d)) : String(d);
const ASST_ACTS = ['record', 'behavior', 'remind', 'draft', 'exam', 'activity', 'nav', 'points', 'grade', 'msg', 'test', 'cert', 'due', 'retry', 'reply', 'drafts', 'rem', 'shortcut'];
/* درجات الاختبار: تُكتب في دفتر الفترة نفسه ثم لقطة الدفتر إلى الطابور (مثل «رصد الاختبارات» تمامًا) — والوقت الأحدث يفوز في الدمج */
function asstExamWrite(c, f) {
  const b = typeof ctBook === 'function' ? ctBook(CT_DATA || (CT_DATA = {}), c.sem, c.per) : null; if (!b) return; const now = Date.now();
  c.items.forEach(x => { const bk = b.scores[x._id] = b.scores[x._id] && typeof b.scores[x._id] === 'object' ? b.scores[x._id] : {}; bk[c._tid] = { ...f(x), at: now }; });
  qrDo({ k: 'exb', sem: String(c.sem), per: String(c.per), book: JSON.parse(JSON.stringify(b)) });
  try { const p = document.getElementById('p-classtools'); if (p && p.classList.contains('on') && typeof renderClassTools === 'function') renderClassTools(); } catch (e) {}
}
async function asstDueSet(c, k) {
  const h = (HW || []).find(x => x.id === c._hid); if (!h) { toast('النشاط غير موجود', 'bad'); return; } const prev = c.state; c.state = 'busy'; asstPaint();
  h.due = k === 'do' ? c.due : c.from; try { save(K.hw, HW); if (h.published || h.sid) await publishHwSilently(h); save(K.hw, HW); try { renderHw(); } catch (e) {} c.state = k === 'do' ? 'done' : 'undone'; toast(k === 'do' ? '📅 تغيّر الموعد ونُشر' : '↩ رجع الموعد', 'good'); }
  catch (e) { h.due = k === 'do' ? c.from : c.due; save(K.hw, HW); c.state = prev; toast('تعذّر إعادة النشر — تحقق من الاتصال', 'bad'); }
  asstPaint();
}
async function asstRetry(c) {
  const h = (HW || []).find(x => x.id === c._hid); if (!h) return; c.state = 'busy'; asstPaint();
  try { const j = await (await fetch(getApi().replace(/\/+$/, '') + '/extra-attempt-bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: getTok(), name: c.items[0].name, names: c.items.map(x => x.name), hwId: h.sid || h.id, assignmentId: h.sid || h.id, extraAttempts: 1 }) })).json().catch(() => ({}));
    if (!j.ok) throw new Error(j.error || 'تعذّر'); h.extraAttempts = h.extraAttempts || {}; c.items.forEach(x => { h.extraAttempts[x._id] = (h.extraAttempts[x._id] || 0) + 1; }); save(K.hw, HW); c.state = 'done'; toast('🔁 مُنحت المحاولة', 'good'); }
  catch (e) { c.state = 'fail'; c.res = e.message; }
  asstPaint();
}
async function asstReply(c) {
  c.state = 'busy'; asstPaint();
  try { const j = await (await fetch(getApi().replace(/\/+$/, '') + '/ask-reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: getTok(), id: c._aid, reply: c.reply }) })).json().catch(() => ({}));
    if (!j.ok) throw new Error(j.error || 'تعذّر'); if (typeof ASKS !== 'undefined' && Array.isArray(ASKS)) { const n = ASKS.findIndex(x => x.id === c._aid); if (n >= 0 && j.item) ASKS[n] = j.item; }
    if (c.close) await fetch(getApi().replace(/\/+$/, '') + '/ask-reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: getTok(), id: c._aid, close: true }) }).catch(() => {});
    try { askCardRender(); thDraw(); } catch (e) {} c.state = 'done'; }
  catch (e) { c.state = 'fail'; c.res = e.message; }
  asstPaint();
}
async function asstSendMsg(c, i) {
  c.state = 'busy'; asstPaint();
  try { let body = c.body; if (c.type === 'exam' && c.ex) { const x = c.ex, L = [`📅 التاريخ: ${typeof fmtExamDate === 'function' ? fmtExamDate(x.d) : x.d}`, x.tm && `⏰ الموعد: ${x.tm}`, x.mk && `🎯 الدرجة: ${x.mk}`, x.pg && `📖 الصفحات: ${x.pg}`, x.tp && `📚 المحتوى: ${x.tp}`, x.n && `📝 ${x.n}`].filter(Boolean); body = typeof buildExamBody === 'function' ? buildExamBody(L, x) : L.join('\n'); }
    const b = { t: getTok(), audience: c.to, title: c.title, body, type: c.type, priority: c.priority, examDate: c.examDate || '' };
    if (c.to === 'class') b.classNames = [c.cls]; if (c.to === 'students') b.recipients = c.items.map(x => ({ id: x._id, name: x.name }));
    const j = await (await fetch(getApi().replace(/\/+$/, '') + '/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })).json().catch(() => ({}));
    if (!j.ok) throw new Error(j.error === 'not delivered' ? 'لم تصل إلى أي طالب' : (j.error || 'تعذّر الإرسال'));
    c.state = 'done'; c.res = `أُرسلت إلى ${j.count || 0} طالب` + (j.skipped && j.skipped.length ? ` · لم تصل إلى ${j.skipped.length}` : ''); try { msgqLoad(); } catch (e) {} }
  catch (e) { c.state = 'fail'; c.res = e.message; }
  asstPaint();
}
async function asstCert(c, i, k) {
  c.state = 'busy'; asstPaint();
  try { if (k === 'do') { c._ids = c.items.map(() => Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
      await ctSave(D => { D.certificates = Array.isArray(D.certificates) ? D.certificates : []; c.items.forEach((x, n) => D.certificates.unshift({ id: c._ids[n], studentId: x._id, reason: c.reason, date: asstToday(), at: Date.now() + n })); }); c.state = 'done'; toast('🏅 صدرت الشهادة', 'good'); }
    else { const ids = new Set(c._ids || []); await ctSave(D => { D.certificates = (Array.isArray(D.certificates) ? D.certificates : []).filter(x => !ids.has(String(x.id))); }); c.state = 'undone'; } }
  catch (e) { c.state = k === 'do' ? 'ask' : 'done'; toast('تعذّر الحفظ', 'bad'); }
  asstPaint();
}
const ASST_ST = { 'غائب': '🚫 غياب', 'غائب بعذر': '🚫 غياب بعذر', 'شارك': '✅ شارك', 'لم يشارك': '✋ لم يشارك', 'أنجز': '📗 أنجز الواجب', 'لم ينجز': '📕 لم ينجز الواجب', 'معذور': '🕊️ معذور في الواجب' };
function asstCardHTML(c, i, j) {
  const btn = (k, t, cls) => `<button type="button" class="btn ${cls || 'ghost'} sm" onclick="asstAct(${i},${j},'${k}')">${t}</button>`;
  const names = L => `<ul class="asst-names">${L.map(x => `<li>${asstEsc(x.name)}<small>${asstEsc(x.cls)}</small></li>`).join('')}</ul>`;
  const bad = c.unresolved && c.unresolved.length ? `<div class="asst-bad">⚠️ لم أحدّد: ${c.unresolved.map(u => `«${asstEsc(u.q)}»${u.matches.length ? ' (' + u.matches.map(asstEsc).join('، ') + ')' : ''}`).join(' · ')} — اكتب الاسم أطول</div>` : '';
  const done = c.state === 'done', off = c.state === 'no' || c.state === 'undone';
  let h = c._step ? `<div class="asst-step">الخطوة ${asstEsc(c._step)}</div>` : '';
  if (c.action === 'record') h += `<b>📝 ${asstEsc(ASST_ST[c.status] || c.status)} · ${c.date === asstToday() ? 'اليوم' : asstEsc(c.date)}</b>${names(c.items)}${bad}`
    + (c.state === 'ask' && c.items.length ? btn('do', `✓ نفّذ (${c.items.length})`, 'tick') + btn('no', 'إلغاء') : done ? `<span class="asst-ok">✓ رُصد</span>${btn('undo', '↩ تراجع')}` : `<span class="asst-off">${c.state === 'undone' ? '↩ تُراجع عنه' : 'أُلغي'}</span>`);
  else if (c.action === 'behavior') h += `<b>${c.type === 'positive' ? '🌟' : '⚠️'} ملاحظة ${c.type === 'positive' ? 'إيجابية' : 'سلبية'}: «${asstEsc(c.note)}»</b>${names(c.items)}${bad}`
    + (c.state === 'ask' && c.items.length ? btn('do', '✓ نفّذ', 'tick') + btn('no', 'إلغاء') : done ? `<span class="asst-ok">✓ سُجّلت</span>${btn('undo', '↩ تراجع')}` : `<span class="asst-off">${c.state === 'undone' ? '↩ تُراجع عنها' : 'أُلغيت'}</span>`);
  else if (c.action === 'remind') h += `<b>📨 تذكير «${asstEsc(c.title)}»</b><div class="asst-meta">${c.missing} لم يسلّموا — تراجع القائمة والرسالة ثم ترسل من شاشة التذكير الجماعي</div>` + (off ? '<span class="asst-off">أُلغي</span>' : btn('do', '📨 افتح التذكير الجماعي', 'tick') + (done ? '' : btn('no', 'إلغاء')));
  else if (c.action === 'draft') h += `<b>✉️ مسودة لولي أمر ${asstEsc(c.student && c.student.name || '')}</b><textarea class="asst-draft" rows="7" oninput="ASST.msgs[${i}].cards[${j}].text=this.value">${asstEsc(c.text || '')}</textarea>`
    + btn('copy', '📋 نسخ', 'tick') + btn('wa', '💬 واتساب');
  else if (c.action === 'exam') h += `<b>📝 ${asstEsc(c.test)} <small>(من ${c.max}) · ${asstEsc(c.period)}</small></b><ul class="asst-names">${c.items.map(x => `<li>${asstEsc(x.name)}<small>${asstEsc(x.cls)}</small><b class="asst-sc">${x.score === 'غ' ? 'غائب' : x.score}</b>${x.prev !== '' && x.prev !== x.score ? `<small class="asst-was">(كانت ${x.prev === 'غ' ? 'غائب' : asstEsc(x.prev)})</small>` : ''}${x.over != null ? `<small class="asst-bad">⚠️ ${x.over} أكبر من ${c.max}</small>` : ''}</li>`).join('')}</ul>${bad}`
    + (c.state === 'ask' && c.items.length ? btn('do', `✓ ارصد (${c.items.length})`, 'tick') + btn('no', 'إلغاء') : done ? `<span class="asst-ok">✓ رُصدت</span>${btn('undo', '↩ تراجع')}` : `<span class="asst-off">${c.state === 'undone' ? '↩ تُراجع عنها' : 'أُلغي'}</span>`);
  else if (c.action === 'activity') h += `<b>${c.copy ? '📄 نسخة' : '✍️ مسودة'} نشاط «${asstEsc(c.title)}»</b><div class="asst-meta">${c.count} سؤال · ${c.cls ? asstEsc(c.cls) : 'الفصل يُحدَّد في النموذج'} · ${c.due ? 'الموعد ' + asstEsc(asstDay(c.due)) : 'بلا موعد'} — <b>لن تُنشر</b>: تُفتح لتراجعها وتنشرها بنفسك</div><ol class="asst-qs">${c.preview.map(q => `<li>${asstEsc(q)}</li>`).join('')}${c.count > c.preview.length ? '<li class="more">…</li>' : ''}</ol>`
    + (off ? '<span class="asst-off">أُلغيت</span>' : done ? `<span class="asst-ok">✓ أُنشئت مسودة (غير منشورة)</span>${btn('do', '✍️ افتحها')}` : btn('do', '✍️ أنشئ المسودة وافتحها', 'tick') + btn('no', 'إلغاء'));
  else if (c.action === 'nav') h += `<b>🧭 ${asstEsc(c.label)}${c.name ? ' — ' + asstEsc(c.name) : ''}${c.cls && !c.name ? ' — ' + asstEsc(c.cls) : ''}${c.period ? ' <small>' + asstEsc(c.period) + '</small>' : ''}${c.print ? ' · 🖨️ طباعة' : ''}</b>`
    + (off ? '<span class="asst-off">أُلغي</span>' : btn('do', done ? '↗ افتح مرة أخرى' : c.print ? '🖨️ افتح واطبع' : '↗ افتح', done ? '' : 'tick') + (done ? '' : btn('no', 'إلغاء')));
  else if (c.action === 'points') h += `<b>💰 ${c.delta > 0 ? 'إضافة' : 'خصم'} ${Math.abs(c.delta)} نقطة${c.reason ? ' — ' + asstEsc(c.reason) : ''}</b><ul class="asst-names">${c.items.map(x => `<li>${asstEsc(x.name)}<small>${asstEsc(x.cls)}</small><b class="asst-sc">${x.before} ← ${Math.max(0, x.before + c.delta)}</b></li>`).join('')}</ul>${bad}`
    + (c.state === 'ask' && c.items.length ? btn('do', `✓ نفّذ (${c.items.length})`, 'tick') + btn('no', 'إلغاء') : done ? `<span class="asst-ok">✓ تم</span>${btn('undo', '↩ تراجع')}` : `<span class="asst-off">${c.state === 'undone' ? '↩ تُراجع عنه' : 'أُلغي'}</span>`);
  else if (c.action === 'grade') h += `<b>✍️ ${asstEsc(c.title)} <small>(من ${c.max})</small></b><ul class="asst-names">${c.items.map(x => `<li>${asstEsc(x.name)}<small>${asstEsc(x.cls)}</small><b class="asst-sc">${x.score}</b><small>(كانت ${asstEsc(x.prev)})</small>${x.over != null ? `<small class="asst-bad">⚠️ ${x.over} أكبر من ${c.max}</small>` : ''}</li>`).join('')}</ul>${bad}`
    + (c.state === 'ask' && c.items.length ? btn('do', `✓ ارصد (${c.items.length})`, 'tick') + btn('no', 'إلغاء') : done ? `<span class="asst-ok">✓ رُصدت</span>${btn('undo', '↩ تراجع')}` : `<span class="asst-off">${c.state === 'undone' ? '↩ تُراجع عنها' : 'أُلغي'}</span>`);
  else if (c.action === 'msg') h += `<b>💬 رسالة إلى ${c.to === 'all' ? 'كل الطلاب' : c.to === 'class' ? 'فصل ' + asstEsc(c.cls) : c.items.map(x => asstEsc(x.name)).join('، ')} <small>(${c.count} طالب${c.priority !== 'normal' ? ' · ' + (c.priority === 'urgent' ? 'عاجلة' : 'مهمة') : ''})</small></b>
      <div class="asst-msgprev"><b>${c.type === 'exam' ? '📅 ' : ''}${asstEsc(c.title)}</b>${c.ex ? `<div>📅 ${asstEsc(asstDay(c.ex.d))}${c.ex.tm ? ' · ⏰ ' + asstEsc(c.ex.tm) : ''}${c.ex.pg ? ' · 📖 ' + asstEsc(c.ex.pg) : ''}${c.ex.tp ? ' · 📚 ' + asstEsc(c.ex.tp) : ''}${c.ex.mk ? ' · 🎯 ' + asstEsc(c.ex.mk) : ''}</div>` : ''}<div>${asstMd(c.body)}</div></div>${bad}`
    + (c.state === 'ask' ? btn('do', '📨 أرسل للطلاب', 'tick') + btn('no', 'إلغاء') : c.state === 'busy' ? '<span class="asst-meta">جارٍ الإرسال…</span>' : done ? `<span class="asst-ok">✓ ${asstEsc(c.res || 'أُرسلت')}</span>` : c.state === 'fail' ? `<span class="asst-bad">⚠️ ${asstEsc(c.res || 'تعذّر الإرسال')}</span>${btn('do', 'أعد المحاولة')}` : '<span class="asst-off">أُلغيت</span>');
  else if (c.action === 'test') h += `<b>📝 اختبار جديد: «${asstEsc(c.title)}» من ${c.max}</b><div class="asst-meta">${asstEsc(c.period)}</div>`
    + (c.state === 'ask' ? btn('do', '✓ أضف للدفتر', 'tick') + btn('no', 'إلغاء') : done ? `<span class="asst-ok">✓ أُضيف</span>${btn('undo', '↩ تراجع')}` : `<span class="asst-off">${c.state === 'undone' ? '↩ حُذف' : 'أُلغي'}</span>`);
  else if (c.action === 'cert') h += `<b>🏅 شهادة شكر — ${asstEsc(c.reason)}</b>${names(c.items)}${bad}`
    + (c.state === 'ask' && c.items.length ? btn('do', `✓ أصدر (${c.items.length})`, 'tick') + btn('no', 'إلغاء') : c.state === 'busy' ? '<span class="asst-meta">جارٍ الحفظ…</span>' : done ? `<span class="asst-ok">✓ صدرت</span>${btn('undo', '↩ تراجع')}` : `<span class="asst-off">${c.state === 'undone' ? '↩ أُلغيت الشهادة' : 'أُلغي'}</span>`);
  else if (c.action === 'due') h += `<b>📅 «${asstEsc(c.title)}»: الموعد ${c.from ? asstEsc(asstDay(c.from)) + ' ← ' : ''}<span class="asst-sc">${asstEsc(asstDay(c.due))}</span></b><div class="asst-meta">يُعاد نشره بالموعد الجديد</div>`
    + (c.state === 'ask' ? btn('do', '✓ غيّر الموعد', 'tick') + btn('no', 'إلغاء') : c.state === 'busy' ? '<span class="asst-meta">جارٍ إعادة النشر…</span>' : done ? `<span class="asst-ok">✓ تغيّر ونُشر</span>${btn('undo', '↩ تراجع')}` : c.state === 'fail' ? `<span class="asst-bad">⚠️ ${asstEsc(c.res || 'تعذّر')}</span>` : `<span class="asst-off">${c.state === 'undone' ? '↩ رجع الموعد' : 'أُلغي'}</span>`);
  else if (c.action === 'retry') h += `<b>🔁 محاولة إضافية في «${asstEsc(c.title)}»</b>${names(c.items)}${bad}`
    + (c.state === 'ask' && c.items.length ? btn('do', `✓ امنح (${c.items.length})`, 'tick') + btn('no', 'إلغاء') : c.state === 'busy' ? '<span class="asst-meta">جارٍ…</span>' : done ? '<span class="asst-ok">✓ مُنحت</span>' : c.state === 'fail' ? `<span class="asst-bad">⚠️ ${asstEsc(c.res || 'تعذّر')}</span>` : '<span class="asst-off">أُلغي</span>');
  else if (c.action === 'reply') h += `<b>📩 رد على ${asstEsc(c.name)}</b><div class="asst-msgprev"><small>سؤاله: ${asstEsc(c.q)}</small><textarea class="asst-draft" rows="3" oninput="ASST.msgs[${i}].cards[${j}].reply=this.value" ${c.state === 'ask' ? '' : 'disabled'}>${asstEsc(c.reply)}</textarea></div>`
    + (c.state === 'ask' ? btn('do', c.close ? '📩 أرسل وأغلق' : '📩 أرسل الرد', 'tick') + btn('no', 'إلغاء') : c.state === 'busy' ? '<span class="asst-meta">جارٍ الإرسال…</span>' : done ? '<span class="asst-ok">✓ وصل ردك للطالب</span>' : c.state === 'fail' ? `<span class="asst-bad">⚠️ ${asstEsc(c.res || 'تعذّر')}</span>` : '<span class="asst-off">أُلغي</span>');
  else if (c.action === 'drafts') h += `<b>✉️ ${c.items.length} مسودة لأولياء الأمور — ${c.reason === 'missing' ? 'أنشطة لم تُسلَّم' : 'غياب'}</b><div class="asst-meta">راجع كل رسالة وأرسلها بنفسك من واتساب</div>`
    + c.items.map((x, n) => `<div class="asst-pd"><b>${asstEsc(x.name)}</b><small>${asstEsc(x.cls)} · ${x.n}</small><textarea class="asst-draft" rows="4" oninput="ASST.msgs[${i}].cards[${j}].items[${n}].text=this.value">${asstEsc(x.text)}</textarea><button type="button" class="btn sm tick" onclick="asstAct(${i},${j},'wa:${n}')">💬 واتساب${x.sent ? ' ✓' : ''}</button></div>`).join('');
  else if (c.action === 'rem') h += `<b>⏰ ذكّرني: «${asstEsc(c.title)}»</b><div class="asst-meta">${asstEsc(asstDay(c.date))} · الساعة <bdi>${asstEsc(c.hm)}</bdi> — يظهر في «مهام اليوم»</div>`
    + (c.state === 'ask' ? btn('do', '✓ أضف التذكير', 'tick') + btn('no', 'إلغاء') : done ? `<span class="asst-ok">✓ أُضيف</span>${btn('undo', '↩ تراجع')}` : `<span class="asst-off">${c.state === 'undone' ? '↩ حُذف' : 'أُلغي'}</span>`);
  else if (c.action === 'shortcut') h += c.command ? `<b>⚡ اختصار «${asstEsc(c.name)}»${c.had ? ' (يستبدل القديم)' : ''}</b><div class="asst-msgprev">${asstEsc(c.command)}</div><div class="asst-meta">اكتب «${asstEsc(c.name)}» أو اضغطه من الأزرار السريعة فيُنفَّذ هذا الأمر</div>`
      + (c.state === 'ask' ? btn('do', '✓ احفظ', 'tick') + btn('no', 'إلغاء') : done ? '<span class="asst-ok">✓ حُفظ</span>' : '<span class="asst-off">أُلغي</span>')
    : `<b>⚡ حذف الاختصار «${asstEsc(c.name)}»</b>` + (c.state === 'ask' ? btn('do', '🗑️ احذف', 'tick') + btn('no', 'إلغاء') : done ? '<span class="asst-ok">✓ حُذف</span>' : '<span class="asst-off">أُلغي</span>');
  return `<div class="asst-card ${c.state}">${h}</div>`;
}
function asstAct(i, j, k) {
  const c = ASST.msgs[i] && ASST.msgs[i].cards && ASST.msgs[i].cards[j]; if (!c) return;
  if (k === 'no') c.state = 'no';
  else if (c.action === 'record' && k === 'do' && c.state === 'ask') { qrDo(c.items.map(x => ({ k: 'st', m: c.m, d: c.date, sid: x._id, v: c.status })), `✓ رُصد ${ASST_ST[c.status] || c.status} لـ ${c.items.length}`); c.state = 'done'; }
  else if (c.action === 'record' && k === 'undo' && c.state === 'done') { qrDo(c.items.map(x => ({ k: 'st', m: c.m, d: c.date, sid: x._id, v: x._prev })), '↩ تراجعت عن الرصد'); c.state = 'undone'; }
  else if (c.action === 'behavior' && k === 'do' && c.state === 'ask') { const now = Date.now(); c._ids = c.items.map((x, n) => qrId());
    qrDo(c.items.map((x, n) => ({ k: 'beh', item: { id: c._ids[n], studentId: x._id, type: c.type, category: c.note, note: '', date: c.date, at: now + n } })), (c.type === 'positive' ? '🌟' : '⚠️') + ' سُجّلت الملاحظة'); c.state = 'done'; }
  else if (c.action === 'behavior' && k === 'undo' && c.state === 'done') { qrDo((c._ids || []).map(id => ({ k: 'behdel', id })), '↩ حُذفت الملاحظة'); c.state = 'undone'; }
  else if (c.action === 'remind' && k === 'do') { c.state = 'done'; asstClose(); try { BR.cls = ''; BR.act = c._hid; BR.only = null; openBulkReminder(); } catch (e) { toast('تعذّر فتح التذكير الجماعي', 'bad'); } }
  else if (c.action === 'exam' && k === 'do' && c.state === 'ask') { asstExamWrite(c, x => x.score === 'غ' ? { absent: true } : { score: x.score }); c.state = 'done'; toast(`✓ رُصدت «${c.test}» لـ ${c.items.length}`, 'good'); }
  else if (c.action === 'exam' && k === 'undo' && c.state === 'done') { asstExamWrite(c, x => x._prev && !x._prev.del ? { ...x._prev } : { del: true }); c.state = 'undone'; toast('↩ تراجعت عن رصد الدرجات'); }
  else if (c.action === 'activity' && k === 'do' && c.state !== 'no') { c.state = 'done'; asstPaint(); asstMakeDraft(c); return; }
  else if (c.action === 'nav' && k === 'do' && c.state !== 'no') { c.state = 'done'; asstPaint(); asstGo(c); return; }
  else if (c.action === 'points' && (k === 'do' && c.state === 'ask' || k === 'undo' && c.state === 'done')) { const n = k === 'do' ? c.delta : -c.delta;
    c.items.forEach(x => { try { window.award(x._id, n); } catch (e) {} }); c.state = k === 'do' ? 'done' : 'undone'; toast(k === 'do' ? `💰 ${c.delta > 0 ? '+' : ''}${c.delta} لـ ${c.items.length}` : '↩ تراجعت عن النقاط', 'good'); }
  else if (c.action === 'grade' && (k === 'do' && c.state === 'ask' || k === 'undo' && c.state === 'done')) { const h = (HW || []).find(x => x.id === c._hid); if (!h) { toast('النشاط غير موجود', 'bad'); return; } h.subs = h.subs || {};
    c.items.forEach(x => { if (k === 'do') { const v = h.subs[x._key]; if (v) v.manualGrade = x.score; else h.subs[x._key] = { manual: true, manualGrade: x.score, correct: 0, total: (h.qs || []).length || 1, pts: 0, d: '', at: Date.now() }; }
      else { if (x._prev) h.subs[x._key] = JSON.parse(JSON.stringify(x._prev)); else delete h.subs[x._key]; } });
    save(K.hw, HW); try { renderGrades(); } catch (e) {} try { renderStudents(); } catch (e) {} c.state = k === 'do' ? 'done' : 'undone'; toast(k === 'do' ? '✍️ رُصدت الدرجات' : '↩ رجعت الدرجات', 'good'); }
  else if (c.action === 'msg' && k === 'do' && (c.state === 'ask' || c.state === 'fail')) { asstSendMsg(c, i); }
  else if (c.action === 'test' && k === 'do' && c.state === 'ask') { const b = ctBook(CT_DATA || (CT_DATA = {}), c.sem, c.per); c._tid = 'ex' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    b.tests.push({ id: c._tid, title: c.title, max: c.max, date: asstToday() }); asstExamWrite({ ...c, items: [] }, () => ({})); c.state = 'done'; toast('📝 أُضيف «' + c.title + '»', 'good'); }
  else if (c.action === 'test' && k === 'undo' && c.state === 'done') { const b = ctBook(CT_DATA, c.sem, c.per); if (Object.values(b.scores).some(o => o && o[c._tid] && !o[c._tid].del)) { toast('رُصدت درجات فيه — احذفه من الدفتر نفسه', 'bad'); return; }
    b.tests = b.tests.filter(t => t.id !== c._tid); (b.delTests = Array.isArray(b.delTests) ? b.delTests : []).push({ id: c._tid, at: Date.now() }); asstExamWrite({ ...c, items: [] }, () => ({})); c.state = 'undone'; }
  else if (c.action === 'cert' && (k === 'do' && c.state === 'ask' || k === 'undo' && c.state === 'done')) { asstCert(c, i, k); return; }
  else if (c.action === 'due' && (k === 'do' && c.state === 'ask' || k === 'undo' && c.state === 'done')) { asstDueSet(c, k); return; }
  else if (c.action === 'retry' && k === 'do' && (c.state === 'ask' || c.state === 'fail')) { asstRetry(c); return; }
  else if (c.action === 'reply' && k === 'do' && (c.state === 'ask' || c.state === 'fail')) { asstReply(c); return; }
  else if (c.action === 'drafts' && /^wa:\d+$/.test(k)) { const x = c.items[+k.slice(3)]; if (!x) return; x.sent = 1; const u = typeof parWaUrl === 'function' && x._id ? parWaUrl(x._id, x.text) : 'https://wa.me/?text=' + encodeURIComponent(x.text); window.open(u, '_blank', 'noopener'); }
  else if (c.action === 'rem' && k === 'do' && c.state === 'ask') { const D = CT_DATA || (CT_DATA = {}); D.reminders = Array.isArray(D.reminders) ? D.reminders : []; c._rid = 'r' + Date.now().toString(36);
    D.reminders.push({ id: c._rid, kind: '', title: c.title, repeat: 'once', days: [], date: c.date, at: { t: 'time', hm: c.hm }, lead: 0 }); qrDo({ k: 'rem', v: JSON.parse(JSON.stringify(D.reminders)) }); try { thDraw(); } catch (e) {} c.state = 'done'; toast('⏰ أُضيف التذكير', 'good'); }
  else if (c.action === 'rem' && k === 'undo' && c.state === 'done') { const D = CT_DATA || {}; D.reminders = (D.reminders || []).filter(x => x && x.id !== c._rid); qrDo({ k: 'rem', v: JSON.parse(JSON.stringify(D.reminders)) }); try { thDraw(); } catch (e) {} c.state = 'undone'; }
  else if (c.action === 'shortcut' && k === 'do' && c.state === 'ask') { const S = asstShortcuts(); if (c.command) S[c.name] = c.command; else delete S[c.name]; try { localStorage.setItem('asst_sc_v1', JSON.stringify(S)); } catch (e) {} c.state = 'done'; asstSuggPaint(); }
  else if (c.action === 'draft' && k === 'copy') { try { navigator.clipboard.writeText(c.text || '').then(() => toast('📋 نُسخت الرسالة', 'good')); } catch (e) {} return; }
  else if (c.action === 'draft' && k === 'wa') { const u = typeof parWaUrl === 'function' && c._id ? parWaUrl(c._id, c.text || '') : 'https://wa.me/?text=' + encodeURIComponent(c.text || ''); window.open(u, '_blank', 'noopener'); return; }
  asstPaint();
}

/* ── 🎤 الصوت: تتكلم بدل الكتابة، و🔊 يقرأ الجواب ── */
const ASST_SR = window.SpeechRecognition || window.webkitSpeechRecognition;
/* 🎤 عبر محرّك الصوت الموحّد (HWV): على iPhone جلسة الاستماع الثانية في الصفحة نفسها لا يصلها صوت،
   فنتشارك الجلسة نفسها مع البحث والرصد بالصوت — «إيقاف» يكتمها فقط، والضغطة التالية تكمل فورًا */
let ASST_MIC = null;
/* شريط الحالة تحت الخانة: يوضّح أنه يسمع ومتى يرسل، ووضع المحادثة */
function asstLive() { const e = document.getElementById('asst-live'); if (!e) return; const conv = asstConvOn();
  e.innerHTML = ASST_MIC ? `<span class="dot"></span> ${conv ? '🗣️ وضع المحادثة — ' : ''}أسمعك… أرسل لحالي بعد سكوتك ثانيتين، أو اضغط 🎤 للإرسال الآن`
    : conv ? '🗣️ وضع المحادثة مفتوح: اضغط 🎤 مرة وحدة وتكلم — أرد وأرجع أسمعك لحالي. للإيقاف اضغط 🗣️' : '';
  e.hidden = !e.innerHTML; }
const ASST_MLOG = [];
function asstMicLog(x) { ASST_MLOG.push(new Date().toTimeString().slice(0, 8) + ' ' + x); if (ASST_MLOG.length > 40) ASST_MLOG.shift(); }
function asstMicStop() { const c = ASST_MIC; if (!c) return; ASST_MIC = null; clearTimeout(c.t); try { HWV.mute(c.owner); } catch (e) {} const b = document.getElementById('asst-mic'); if (b) b.classList.remove('on'); asstLive(); }
function asstMicSend() { const c = ASST_MIC; if (!c) return; const t = (c.done + ' ' + c.pend).replace(/\s+/g, ' ').trim(); asstMicLog('send ' + t.length); asstMicStop(); const i = document.getElementById('asst-q'); if (i) i.value = ''; if (t) asstAsk(t); }
function asstMic() {
  if (!window.HWV || !HWV.sup) { toast('الكلام غير مدعوم في هذا المتصفح', 'bad'); return; }
  if (ASST_MIC) { asstMicSend(); return; }   // ضغطة ثانية: أرسل ما قيل
  if (!(window.HWV && HWV.ios && HWV.active)) { asstSpeakStop(); asstAudioUnlock(); }
  const i = document.getElementById('asst-q'), b = document.getElementById('asst-mic'), c = { done: '', pend: '', t: 0 };
  const show = () => { if (i) i.value = (c.done + ' ' + c.pend).replace(/\s+/g, ' ').trim(); };
  c.owner = { on: false,
    onText: (t, final) => { clearTimeout(c.t); if (final) { c.done += ' ' + t; c.pend = ''; c.t = setTimeout(asstMicSend, 1800); } else c.pend = t; show(); asstLive(); },
    onStop: why => { asstMicLog('stop:' + (why || '')); if (ASST_MIC === c) { if ((c.done + c.pend).trim()) asstMicSend(); else asstMicStop(); } },
    onError: err => { asstMicLog('err:' + err); if (err === 'not-allowed' || err === 'service-not-allowed') { toast('اسمح للمتصفح باستخدام الميكروفون', 'bad'); asstMicStop(); } } };
  ASST_MIC = c; if (b) b.classList.add('on'); asstMicLog('go active=' + HWV.active);
  setTimeout(asstLive, 0);
  if (!HWV.go(c.owner)) { asstMicStop(); toast('تعذّر تشغيل الميكروفون — أغلق المتصفح وافتحه ثم حاول', 'bad'); }
}
const asstTtsOn = () => { try { return localStorage.getItem('asst_tts') === '1'; } catch (e) { return false; } };
function asstTtsToggle() { try { localStorage.setItem('asst_tts', asstTtsOn() ? '0' : '1'); } catch (e) {} asstSpeakStop(); asstAudioUnlock(); const b = document.getElementById('asst-tts'); if (b) { b.textContent = asstTtsOn() ? '🔊' : '🔇'; b.title = asstTtsOn() ? 'قراءة الأجوبة بصوت: مفعّلة' : 'قراءة الأجوبة بصوت: متوقفة'; } }
/* 🔊 القراءة بصوت ElevenLabs عبر الخادم (المفتاح في Cloudflare فقط، وبسقف يومي) — وإن تعذّر فصوت الجهاز */
let ASST_AUDIO = null, ASST_SAY = 0, ASST_EL = null;   // ASST_EL: null لم يُجرَّب · false غير مفعّل في الخادم
const ASST_SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
/* 🍎 iPhone: أي تشغيل/إيقاف صوت (حتى صوت صامت أو speechSynthesis.cancel) وجلسة الميكروفون مفتوحة يجعلها صمّاء — فيسمع أول مرة فقط.
   لذا ما دامت جلسة الاستماع حيّة على iPhone: لا نلمس الصوت ولا نقرأ الجواب بصوت (يظهر مكتوبًا) */
const asstMicLive = () => !!(window.HWV && HWV.ios && (HWV.active || ASST_MIC));
function asstAudioUnlock() {   // يُستدعى من ضغطة المعلم: iPhone لا يشغّل صوتًا يبدأ بعد انتظار الجواب إلا إن «فُتح» العنصر بلمسة
  if (!asstTtsOn() || asstMicLive()) return; try { if (!ASST_AUDIO) ASST_AUDIO = new Audio(); ASST_AUDIO.src = ASST_SILENT; ASST_AUDIO.play().catch(() => {}); } catch (e) {}
}
/* ⚙️ مفتاح «صوت ElevenLabs» في إعدادات الذكاء الاصطناعي — مقفول افتراضيًا (صوت الجهاز)، ولا يعمل إلا إذا فتحه المعلم */
const asstElOn = () => { try { return localStorage.getItem('asst_el_on') === '1'; } catch (e) { return false; } };
function asstElSet(on) { try { if (on) localStorage.setItem('asst_el_on', '1'); else localStorage.removeItem('asst_el_on'); localStorage.removeItem('asst_el_off'); } catch (e) {} ASST_EL = null; asstSpeakStop();
  try { toast(on ? '🔊 مساعدي يقرأ بصوت ElevenLabs' : '🔊 مساعدي يقرأ بصوت جهازك', 'good'); } catch (e) {} }
/* ✨ «مساعدي» مقفول افتراضيًا: لا زر ولا تنبيه حتى يفعّله المعلم من ⚙️ الإعدادات ← الذكاء الاصطناعي */
const asstOn = () => { try { return localStorage.getItem('asst_on') === '1'; } catch (e) { return false; } };
function asstOnApply() { const b = document.getElementById('asst-btn'), c = document.getElementById('asst-on-tg'), on = asstOn(); if (b) b.hidden = !on; if (c) c.checked = on; }
function asstOnSet(on) { try { if (on) localStorage.setItem('asst_on', '1'); else localStorage.removeItem('asst_on'); } catch (e) {} if (!on) asstClose(); asstOnApply();
  try { toast(on ? '✨ فُعّل «مساعدي» — زره في الشريط العلوي' : '✨ أُقفل «مساعدي»', 'good'); } catch (e) {} if (on) asstBriefDot().catch(() => {}); }
(function asstElInit() { const go = () => { const c = document.getElementById('asst-el-tg'); if (c) c.checked = asstElOn(); asstOnApply(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go(); })();
function asstSpeakStop() { ASST_SAY++; try { if (window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel(); } catch (e) {} try { if (ASST_AUDIO && !ASST_AUDIO.paused) ASST_AUDIO.pause(); } catch (e) {} }
function asstSpeakDevice(txt) {
  if (!window.speechSynthesis) return;
  return new Promise(res => { try { const u = new SpeechSynthesisUtterance(txt.slice(0, 600)); u.lang = 'ar-SA'; const v = speechSynthesis.getVoices().find(x => /^ar/i.test(x.lang)); if (v) u.voice = v; u.onend = u.onerror = res; speechSynthesis.speak(u); setTimeout(res, 30000); } catch (e) { res(); } });
}
async function asstSpeak(t) {
  if (!asstTtsOn()) return;
  if (asstMicLive()) { if (!ASST.micTtsNote) { ASST.micTtsNote = 1; toast('🍎 على iPhone لا يُقرأ الجواب بصوت بعد استخدام الميكروفون (يُوقف السماع) — يظهر مكتوبًا', 'warn'); } return; }
  asstSpeakStop(); const my = ASST_SAY;
  const txt = String(t || '').replace(/<[^>]+>/g, ' ').replace(/\*\*/g, '').replace(/[•\-]\s/g, '، ').replace(/\s+/g, ' ').trim().slice(0, 1200); if (!txt) return;
  let api = ''; try { api = String(getApi() || '').replace(/\/+$/, ''); } catch (e) {}
  if (api && ASST_EL !== false && asstElOn()) {
    const parts = []; let rest = txt; while (rest) { let cut = rest.length <= 380 ? rest.length : Math.max(rest.lastIndexOf('،', 380), rest.lastIndexOf('.', 380), rest.lastIndexOf(' ', 380)); if (cut < 40) cut = 380; parts.push(rest.slice(0, cut + 1).trim()); rest = rest.slice(cut + 1).trim(); }
    try {
      for (const p of parts.filter(x => /[\u0600-\u06FF]/.test(x))) {
        if (my !== ASST_SAY) return;
        const r = await fetch(api + '/tts?k=asst&t=' + encodeURIComponent(p));
        if (!r.ok) { if (r.status === 404) ASST_EL = false; throw new Error('tts ' + r.status); }
        const url = URL.createObjectURL(await r.blob()); if (my !== ASST_SAY) return;
        if (!ASST_AUDIO) ASST_AUDIO = new Audio();
        await new Promise(res => { ASST_AUDIO.onended = res; ASST_AUDIO.onerror = res; ASST_AUDIO.src = url; ASST_AUDIO.play().catch(res); });
        URL.revokeObjectURL(url);
      }
      ASST_EL = true; return;
    } catch (e) { if (my !== ASST_SAY) return; }
  }
  return asstSpeakDevice(txt);   // احتياطي: صوت الجهاز
}

/* ── ☀️ ملخص الصباح: يُحسب من بياناتك بلا ذكاء — نقطة على ✨ مرة في اليوم، ويظهر أول ما تفتح المساعد ── */
async function asstBrief() {
  const D = await asstClassroom(), today = asstToday(), P = D.participation || {}, items = [];
  const days = Object.keys(P).filter(d => d <= today).sort().reverse();
  const streak = asstStudents().filter(s => { const rec = days.filter(d => P[d] && P[d][String(s.id)]).slice(0, 3); return rec.length === 3 && rec.every(d => ABSENT.includes(P[d][String(s.id)].status)); });
  if (streak.length) items.push({ t: `🚫 <b>${streak.length}</b> غابوا آخر ٣ حصص مرصودة: ${streak.slice(0, 4).map(s => asstEsc(s.name.split(' ').slice(0, 2).join(' '))).join('، ')}${streak.length > 4 ? '…' : ''}`, q: 'مين أكثر الطلاب غيابًا هذا الشهر؟' });
  const pub = asstActs().filter(h => typeof remPublished !== 'function' || remPublished(h));
  const dueToday = pub.filter(h => h.due === today);
  dueToday.forEach(h => { const n = asstPool(h).filter(s => !asstSub(h, s)).length; if (n) items.push({ t: `⏰ «${asstEsc(h.title)}» موعده اليوم — <b>${n}</b> لم يسلّموا`, q: `مين ما سلّم ${h.title}؟` }); });
  let late = 0; const lateSt = new Set(); pub.filter(h => h.due && h.due < today && !h.noGrade && h.kind !== 'games').forEach(h => asstPool(h).forEach(s => { if (!asstSub(h, s)) { late++; lateSt.add(s.id); } }));
  if (late) items.push({ t: `📋 <b>${lateSt.size}</b> طالب عندهم أنشطة متأخرة (${late} تسليم)`, q: 'مين أكثر الطلاب ما سلّموا؟' });
  let rev = 0; asstActs().filter(h => h.kind === 'files').forEach(h => Object.values(h.subs || {}).forEach(v => { if (v && String(v.reviewStatus || '') === 'pending') rev++; }));
  if (rev) items.push({ t: `📂 <b>${rev}</b> تسليم ملف ينتظر مراجعتك`, q: '' });
  const G = (typeof CT_GRADES !== 'undefined' && CT_GRADES) || null;
  if (G && Array.isArray(G.students)) { const dn = G.students.filter(g => g.trend && g.trend.measurable && g.trend.change <= -15).sort((a, b) => a.trend.change - b.trend.change);
    if (dn.length) items.push({ t: `📉 <b>${dn.length}</b> مستواهم ينزل: ${dn.slice(0, 3).map(g => asstEsc(String(g.name).split(' ').slice(0, 2).join(' '))).join('، ')}`, q: 'أضعف ٥ طلاب في الفترة' }); }
  return items;
}
function asstBriefMsg(items) {
  return { brief: 1, html: items.length ? `<b>☀️ ملخص اليوم</b><ul class="asst-brief">${items.map(x => `<li>${x.t}${x.q ? ` <button type="button" onclick="asstAsk(${asstEsc(JSON.stringify(x.q))})">التفاصيل</button>` : ''}</li>`).join('')}</ul>` : '☀️ لا شيء يحتاج انتباهك اليوم ✓', src: ['⚡ من بياناتك بلا ذكاء'] };
}
async function asstBriefDot() {   // نقطة على ✨ مرة في اليوم إن وُجد ما يستحق
  if (!asstOn()) return; try { if (localStorage.getItem('asst_brief_seen') === asstToday()) return; } catch (e) {}
  if (!asstActs().length && !asstStudents().length) return;
  const n = (await asstBrief()).length, b = document.getElementById('asst-btn'); if (b && n) { b.dataset.brief = String(n); b.classList.add('has-brief'); }
}
setTimeout(() => { asstBriefDot().catch(() => {}); }, 9000);

/* ── الواجهة ── */
const ASST_SUGG = ['☀️ ملخص اليوم', 'مين الغايب اليوم؟', 'مين أعلى درجة في آخر نشاط؟', 'مين ما سلّم آخر نشاط؟', 'أضعف ٥ طلاب في الفترة', 'أضعف المهارات في فصولي', 'متوسط آخر اختبار', 'أكثر الطلاب غيابًا هذا الشهر'];
function asstPaint() {
  const box = document.getElementById('asst-msgs'); if (!box) return;
  box.innerHTML = ASST.msgs.length ? ASST.msgs.map(m => m.me ? `<div class="asst-me">${m.html}</div>`
    : `<div class="asst-bot${m.err ? ' err' : ''}">${m.html}${(m.cards || []).map((c, j) => asstCardHTML(c, ASST.msgs.indexOf(m), j)).join('')}${m.src && m.src.length ? `<div class="asst-src">${m.src.map(s => `<span>${asstEsc(s)}</span>`).join('')}</div>` : ''}</div>`).join('')
    : `<div class="asst-hello"><b>✨ أهلًا!</b>اسألني عن طلابك: الغياب، والدرجات، ومن سلّم ومن لم يسلّم، وملخص أي طالب.<small>وأجهّز لك: رصد غياب، ملاحظة سلوك، تذكير، رسالة لولي أمر — ولا أنفّذ شيئًا إلا بعد ضغطك «نفّذ». 🎤 تكلّم بدل الكتابة.</small></div>`;
  box.scrollTop = box.scrollHeight; if (!ASST.busy) asstSave();
  const send = document.getElementById('asst-send'); if (send) send.disabled = ASST.busy;
}
function asstOpen() {
  let p = document.getElementById('asst-panel');
  if (!p) {
    p = document.createElement('div'); p.id = 'asst-panel'; p.className = 'no-print'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'مساعدي');
    p.innerHTML = `<div class="asst-head"><span class="asst-ic">✨</span><div><b>مساعدي</b><small>لا ينفّذ شيئًا إلا بعد تأكيدك</small></div>
      <button type="button" class="asst-clear" id="asst-tts" onclick="asstTtsToggle()" title="قراءة الأجوبة بصوت" aria-label="قراءة الأجوبة بصوت">${asstTtsOn() ? '🔊' : '🔇'}</button><button type="button" id="asst-conv" class="${asstConvOn() ? 'on' : ''}" onclick="asstConvToggle()" title="وضع المحادثة: يسمعك بعد كل جواب" aria-label="وضع المحادثة">🗣️</button><button type="button" onclick="asstForget()" title="محادثة جديدة (ينسى المحادثة السابقة)" aria-label="محادثة جديدة">↺</button><button type="button" class="asst-x" onclick="asstClose()" aria-label="إغلاق">✕</button></div>
      <div class="asst-msgs" id="asst-msgs" aria-live="polite"></div>
      <div class="asst-sugg">${asstSuggHTML()}</div>
      <div class="asst-live" id="asst-live" hidden></div>
      <form class="asst-in" onsubmit="event.preventDefault();const i=document.getElementById('asst-q');asstAsk(i.value);i.value=''"><textarea id="asst-q" rows="1" placeholder="اسأل عن طلابك…" autocomplete="off"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();this.form.requestSubmit()}"></textarea>${ASST_SR ? '<button type="button" id="asst-mic" class="asst-mic" onclick="asstMic()" title="تكلّم" aria-label="تكلّم">🎤</button>' : ''}<button type="submit" id="asst-send" class="btn tick sm">إرسال</button></form>`;
    document.body.appendChild(p);
    p.addEventListener('keydown', e => { if (e.key === 'Escape') asstClose(); });
  }
  asstLoadHist(); p.classList.add('on'); document.body.classList.add('asst-open'); asstPaint(); asstLive();
  let seen = ''; try { seen = localStorage.getItem('asst_brief_seen') || ''; } catch (e) {}
  if (seen !== asstToday() && !ASST.msgs.length) asstShowBrief();
  const b = document.getElementById('asst-btn'); if (b) b.classList.remove('has-brief');
  setTimeout(() => { try { document.getElementById('asst-q').focus(); } catch (e) {} }, 60);
}
function asstClose() { asstSpeakStop(); asstMicStop(); const p = document.getElementById('asst-panel'); if (p) p.classList.remove('on'); document.body.classList.remove('asst-open'); }

async function asstShowBrief() { try { localStorage.setItem('asst_brief_seen', asstToday()); } catch (e) {} const m = { html: '<i class="asst-dots"><b></b><b></b><b></b></i>', src: [] }; ASST.msgs.push(m); asstPaint();
  try { Object.assign(m, asstBriefMsg(await asstBrief())); } catch (e) { m.html = '⚠️ تعذّر تجهيز الملخص'; } asstPaint(); }
