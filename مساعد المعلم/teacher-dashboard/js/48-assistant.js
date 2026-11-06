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
  /* ── أوامر: تُجهَّز فقط، ولا تُنفَّذ إلا بعد ضغط المعلم «نفّذ» في بطاقة التأكيد ── */
  record_attendance: { act: 1, d: 'تجهيز رصد (لا يُنفَّذ إلا بتأكيد المعلم) للحضور أو المشاركة أو الواجب. args: {students:["اسم",...] أو ["الكل"] مع cls, status:"غائب"|"غائب بعذر"|"شارك"|"لم يشارك"|"أنجز"|"لم ينجز"|"معذور", date?:"اليوم"|"أمس"|"YYYY-MM-DD", cls?}', src: () => '📝 تجهيز رصد',
    async run(a) { const st = String(a.status || 'غائب'), m = ['أنجز', 'لم ينجز', 'معذور'].includes(st) ? 'homework' : 'participation';
      if (!['غائب', 'غائب بعذر', 'شارك', 'لم يشارك', 'أنجز', 'لم ينجز', 'معذور'].includes(st)) return { error: 'حالة غير معروفة: ' + st };
      const date = asstDate(a.date), cls = asstCls(a.cls), r = asstResolve(a.students, cls), D = await asstClassroom();
      return { action: 'record', m, status: st, date, items: r.items.map(x => ({ name: x.name, cls: x.cls || '', _id: String(x.id), _prev: (((D[m] || {})[date] || {})[String(x.id)] || {}).status || '' })), unresolved: r.bad }; } },
  behavior_note: { act: 1, d: 'تجهيز ملاحظة سلوك (لا تُنفَّذ إلا بتأكيد المعلم). args: {students:["اسم",...], type:"positive"|"negative", note:"نص قصير"}', src: () => '⭐ تجهيز ملاحظة سلوك',
    async run(a) { const r = asstResolve(a.students || a.student); return { action: 'behavior', type: a.type === 'negative' ? 'negative' : 'positive', note: String(a.note || '').slice(0, 120) || (a.type === 'negative' ? 'ملاحظة سلبية' : 'تميّز'), date: asstToday(),
      items: r.items.map(x => ({ name: x.name, cls: x.cls || '', _id: String(x.id) })), unresolved: r.bad }; } },
  remind_missing: { act: 1, d: 'تجهيز تذكير لمن لم يسلّم نشاطًا (يفتح شاشة التذكير الجماعي للمراجعة والإرسال). args: {activity:"جزء من العنوان" أو "آخر"}', src: () => '📨 تجهيز تذكير',
    async run(a) { const m = asstFindAct(a.activity); if (!m.length) return { error: 'لم أجد النشاط' }; if (m.length > 1) return { error: 'أكثر من نشاط يطابق', matches: m.slice(0, 8).map(h => h.title) };
      const h = m[0], miss = asstPool(h).filter(s => !asstSub(h, s)).length; return { action: 'remind', title: h.title, missing: miss, _hid: String(h.id) }; } },
  parent_message: { act: 1, d: 'كتابة مسودة رسالة لولي أمر طالب (المعلم يراجعها ويرسلها بنفسه). args: {student, topic:"موضوع الرسالة"}', src: a => '✉️ مسودة رسالة — ' + (a._name || a.student || ''),
    async run(a) { const s0 = await ASST_TOOLS.student_summary.run({ student: a.student }); if (s0.error) return s0; a._name = s0.name; const st = asstFindStudent(s0.name)[0];
      return { action: 'draft', topic: String(a.topic || 'متابعة مستوى الطالب'), student: s0, _id: st ? String(st.id) : '' }; } },
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
  open_page: { act: 1, d: 'فتح صفحة في اللوحة أو طباعة كشف. args: {page:"student"(ملف طالب، مع student)|"exams"(دفتر الاختبارات، مع sem/per/cls)|"records"(الحضور والسجلات)|"analysis"(المستويات وخريطة المهارات)|"grades"(كشف الدرجات، مع cls و print:true للطباعة)|"activities"|"students"|"home"|"nafs"|"plans"|"reports"|"messages"|"certs"|"paper_exams"|"settings", student?, cls?, sem?, per?, print?:true|false}', src: () => '🧭 تنقّل',
    async run(a) { const pg = String(a.page || '').trim(), P = ASST_PAGES[pg]; if (!P) return { error: 'صفحة غير معروفة: ' + pg, pages: Object.keys(ASST_PAGES) };
      const r = { action: 'nav', page: pg, label: P[1], cls: asstCls(a.cls), print: !!a.print && pg === 'grades' };
      if (pg === 'student') { const m = asstFindStudent(a.student); if (m.length !== 1) return m.length ? { error: 'أكثر من طالب يطابق', matches: m.slice(0, 8).map(s => s.name + ' — ' + (s.cls || '')) } : { error: 'لم أجد الطالب' }; r.name = m[0].name; r.cls = m[0].cls || ''; r._sid = String(m[0].id); }
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
const ASST_PAGES = { home: ['dashboard', '🏠 الرئيسية'], activities: ['hw', '📋 الأنشطة'], students: ['students', '👥 الطلاب'], student: [null, '👤 ملف الطالب'], records: ['classtools:records', '🗂️ السجلات والحضور'],
  exams: ['classtools:exams', '📝 دفتر الاختبارات'], analysis: ['classtools:analysis', '📈 المستويات والمهارات'], grades: ['grades', '📊 كشف الدرجات'], nafs: ['nafs', '🧭 نافس'], plans: ['plans', '🩺 الخطط العلاجية'],
  reports: ['reports', '📑 التقارير'], messages: ['messages', '💬 الرسائل'], certs: ['classtools:certs', '🏅 الشهادات'], paper_exams: ['exam', '🖨️ الاختبارات الورقية'], settings: ['data', '⚙️ الإعدادات'] };
function asstGo(c) {
  asstClose();
  try {
    if (c.page === 'student') { ctOpenProfile(c._sid); return; }
    if (c.page === 'exams') { window._ctExSem = String(c.sem || ''); window._ctExPer = String(c.per || ''); if (c.cls) window._ctExCls = c.cls; }
    goTab(ASST_PAGES[c.page][0]);
    if (c.page === 'exams' && typeof renderClassTools === 'function') renderClassTools();
    if (c.page === 'grades') { const s = document.getElementById('g-class'); if (s) { if (typeof gFillClasses === 'function') gFillClasses(); s.value = c.cls && [...s.options].some(o => o.value === c.cls) ? c.cls : '__all__'; renderGrades(); }
      if (c.print) setTimeout(() => { try { window.printGrades(); } catch (e) { toast('تعذّرت الطباعة', 'bad'); } }, 400); }
  } catch (e) { toast('تعذّر فتح الصفحة', 'bad'); }
}
function asstMakeDraft(c) {
  if (c._hid && typeof HW !== 'undefined' && HW.some(h => h && h.id === c._hid)) { asstClose(); try { goTab('hw'); } catch (e) {} setTimeout(() => { try { openHwForm(c._hid); } catch (e) {} }, 350); return; }
  const h = { id: uid(), title: c.title, cls: c.cls || '', clsList: [], due: c.due || '', pts: 30, max: 20, kind: 'normal', qs: c._qs, subs: {}, at: Date.now() };
  HW.push(h); save(K.hw, HW); c._hid = h.id;
  toast(`✍️ أُنشئت مسودة «${c.title}» بـ ${c._qs.length} سؤال — راجعها ثم انشرها`, 'good');
  asstClose(); try { goTab('hw'); } catch (e) {} setTimeout(() => { try { openHwForm(h.id); } catch (e) {} }, 350);
}
const asstStrip = o => JSON.parse(JSON.stringify(o, (k, v) => (k[0] === '_' ? undefined : v)));   // لا معرّفات ولا قيم داخلية للمزوّد
const asstIntro = () => `أنت «مساعدي» داخل لوحة معلم سعودي. اليوم ${asstToday()}. الفصول: ${asstClsList().join('، ') || '—'}. آخر الأنشطة: ${asstActs().slice(-12).map(h => '«' + h.title + '»').join('، ') || '—'}.`;

/* ── تشغيل سؤال ── */
function asstFast(q) {   // ⚡ بلا ذكاء: «مين الغايب اليوم» و«افتح ملف فلان»
  const t = String(q || ''), pf = t.match(/^\s*(?:افتح|إفتح|فتح|افتحي|ودّني|ودني|روح)\s+(?:لي\s+)?ملف\s+(?:الطالب\s+)?(.+?)\s*[؟?.!]*\s*$/);
  if (pf && !/^(ال)?فصل(\s|$)/.test(pf[1])) return { tool: 'open_page', args: { page: 'student', student: pf[1] } }; if (!/(غايب|غائب|غياب|غابو|غابوا|الغائبين|الحضور)/.test(t)) return null;
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
  ASST.busy = true; ASST.msgs.push({ me: 1, html: asstEsc(q) }); const bot = { html: '<i class="asst-dots"><b></b><b></b><b></b></i>', src: [] }; ASST.msgs.push(bot); asstPaint();
  try {
    const fast = asstFast(q);
    if (fast) { const r = await ASST_TOOLS[fast.tool].run(fast.args); bot.src = [ASST_TOOLS[fast.tool].src(fast.args), '⚡ فوري بلا ذكاء'];
      if (fast.tool === 'open_page') { if (r.error) { bot.html = '⚠️ ' + asstEsc(r.error) + (r.matches ? '<br>' + r.matches.map(asstEsc).join('<br>') : ''); return; } bot.cards = [{ ...r, state: 'ask' }]; bot.text = 'فتحت لك ' + r.label + (r.name ? ' — ' + r.name : ''); bot.html = asstMd(bot.text); bot._auto = 1; return; }
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
اختر الأدوات التي تكفي للجواب (غالبًا واحدة أو اثنتان). إن طلب المعلم تنفيذ شيء (رصد غياب/مشاركة/واجب، درجة اختبار، ملاحظة سلوك، تذكير، رسالة لولي أمر، مسودة نشاط، فتح صفحة أو طباعة) فاستخدم أداة التجهيز المناسبة — لن يُنفَّذ شيء إلا بعد تأكيده.
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
أجب المعلم بالعربية بإيجاز ودقة من هذه النتائج فقط — لا تخترع أسماء أو أرقامًا. استخدم **عريض** للأهم وقائمة بـ «- » عند الحاجة. إن كانت القائمة طويلة اذكر أهمها والعدد. إن كان في النتائج error فاشرحه واقترح صياغة.
${draft ? 'واكتب في draft رسالة مهذبة قصيرة لولي أمر الطالب بالعربية الفصحى المبسطة عن الموضوع، مبنية على بياناته فقط، تبدأ بـ «السلام عليكم ورحمة الله» وتنتهي بتوقيع «معلم المادة».\nأخرج JSON فقط: {"answer":"...","draft":"..."}' : 'أخرج JSON فقط: {"answer":"..."}'}`, new AbortController().signal)) || {};
    if (draft) draft.text = String(ans.draft || '');
    bot.text = String(ans.answer || ''); bot.html = asstMd(bot.text || (draft ? 'هذه المسودة — عدّلها كما تشاء:' : 'لم يصل جواب — جرّب مرة أخرى')); bot.src.push(asstUsed());
  } catch (e) { bot.html = '⚠️ ' + asstEsc(e && e.message || 'تعذّر'); bot.err = 1; }
  finally { ASST.busy = false; bot.src = bot.src.filter(Boolean); asstPaint(); if (bot._auto) { delete bot._auto; setTimeout(() => asstAct(ASST.msgs.indexOf(bot), 0, 'do'), 600); } else if (!bot.err) asstSpeak(bot.text || bot.html); }
}
function asstUsed() { try { const j = JSON.parse(localStorage.getItem('ai_last_used') || 'null'); if (!j) return ''; const c = (typeof READING_AI_PROVIDERS !== 'undefined' && READING_AI_PROVIDERS[j.p]) || { name: j.p }; return '🤖 ' + c.name + ' · ' + j.m; } catch (e) { return ''; } }

/* ── بطاقات التأكيد: لا شيء يُكتب قبل «نفّذ» — والرصد يمر بطابور الرصد السريع نفسه (يحفظ بلا إنترنت ويُزامَن) ── */
const ASST_ACTS = ['record', 'behavior', 'remind', 'draft', 'exam', 'activity', 'nav'];
/* درجات الاختبار: تُكتب في دفتر الفترة نفسه ثم لقطة الدفتر إلى الطابور (مثل «رصد الاختبارات» تمامًا) — والوقت الأحدث يفوز في الدمج */
function asstExamWrite(c, f) {
  const b = typeof ctBook === 'function' ? ctBook(CT_DATA || (CT_DATA = {}), c.sem, c.per) : null; if (!b) return; const now = Date.now();
  c.items.forEach(x => { const bk = b.scores[x._id] = b.scores[x._id] && typeof b.scores[x._id] === 'object' ? b.scores[x._id] : {}; bk[c._tid] = { ...f(x), at: now }; });
  qrDo({ k: 'exb', sem: String(c.sem), per: String(c.per), book: JSON.parse(JSON.stringify(b)) });
  try { const p = document.getElementById('p-classtools'); if (p && p.classList.contains('on') && typeof renderClassTools === 'function') renderClassTools(); } catch (e) {}
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
  else if (c.action === 'activity') h += `<b>✍️ مسودة نشاط «${asstEsc(c.title)}»</b><div class="asst-meta">${c.count} سؤال · ${c.cls ? asstEsc(c.cls) : 'الفصل يُحدَّد في النموذج'} · ${c.due ? 'الموعد ' + asstEsc(c.due) : 'بلا موعد'} — <b>لن تُنشر</b>: تُفتح لتراجعها وتنشرها بنفسك</div><ol class="asst-qs">${c.preview.map(q => `<li>${asstEsc(q)}</li>`).join('')}${c.count > c.preview.length ? '<li class="more">…</li>' : ''}</ol>`
    + (off ? '<span class="asst-off">أُلغيت</span>' : done ? `<span class="asst-ok">✓ أُنشئت مسودة (غير منشورة)</span>${btn('do', '✍️ افتحها')}` : btn('do', '✍️ أنشئ المسودة وافتحها', 'tick') + btn('no', 'إلغاء'));
  else if (c.action === 'nav') h += `<b>🧭 ${asstEsc(c.label)}${c.name ? ' — ' + asstEsc(c.name) : ''}${c.cls && !c.name ? ' — ' + asstEsc(c.cls) : ''}${c.period ? ' <small>' + asstEsc(c.period) + '</small>' : ''}${c.print ? ' · 🖨️ طباعة' : ''}</b>`
    + (off ? '<span class="asst-off">أُلغي</span>' : btn('do', done ? '↗ افتح مرة أخرى' : c.print ? '🖨️ افتح واطبع' : '↗ افتح', done ? '' : 'tick') + (done ? '' : btn('no', 'إلغاء')));
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
  else if (c.action === 'draft' && k === 'copy') { try { navigator.clipboard.writeText(c.text || '').then(() => toast('📋 نُسخت الرسالة', 'good')); } catch (e) {} return; }
  else if (c.action === 'draft' && k === 'wa') { const u = typeof parWaUrl === 'function' && c._id ? parWaUrl(c._id, c.text || '') : 'https://wa.me/?text=' + encodeURIComponent(c.text || ''); window.open(u, '_blank', 'noopener'); return; }
  asstPaint();
}

/* ── 🎤 الصوت: تتكلم بدل الكتابة، و🔊 يقرأ الجواب ── */
const ASST_SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let asstRec = null;
function asstMic() {
  if (!ASST_SR) { toast('الكلام غير مدعوم في هذا المتصفح', 'bad'); return; }
  if (asstRec) { try { asstRec.stop(); } catch (e) {} return; }
  const i = document.getElementById('asst-q'), b = document.getElementById('asst-mic'); let txt = '';
  try { speechSynthesis.cancel(); } catch (e) {}
  asstRec = new ASST_SR(); asstRec.lang = 'ar-SA'; asstRec.interimResults = true; asstRec.continuous = false;
  asstRec.onresult = e => { txt = [...e.results].map(r => r[0].transcript).join(' '); if (i) i.value = txt; };
  asstRec.onerror = e => { if (e && e.error === 'not-allowed') toast('اسمح للمتصفح باستخدام الميكروفون', 'bad'); };
  asstRec.onend = () => { asstRec = null; if (b) b.classList.remove('on'); if (txt.trim()) { asstAsk(txt); if (i) i.value = ''; } };
  if (b) b.classList.add('on'); try { asstRec.start(); } catch (e) { asstRec = null; if (b) b.classList.remove('on'); }
}
const asstTtsOn = () => { try { return localStorage.getItem('asst_tts') === '1'; } catch (e) { return false; } };
function asstTtsToggle() { try { localStorage.setItem('asst_tts', asstTtsOn() ? '0' : '1'); } catch (e) {} asstSpeakStop(); asstAudioUnlock(); const b = document.getElementById('asst-tts'); if (b) { b.textContent = asstTtsOn() ? '🔊' : '🔇'; b.title = asstTtsOn() ? 'قراءة الأجوبة بصوت: مفعّلة' : 'قراءة الأجوبة بصوت: متوقفة'; } }
/* 🔊 القراءة بصوت ElevenLabs عبر الخادم (المفتاح في Cloudflare فقط، وبسقف يومي) — وإن تعذّر فصوت الجهاز */
let ASST_AUDIO = null, ASST_SAY = 0, ASST_EL = null;   // ASST_EL: null لم يُجرَّب · false غير مفعّل في الخادم
const ASST_SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
function asstAudioUnlock() {   // يُستدعى من ضغطة المعلم: iPhone لا يشغّل صوتًا يبدأ بعد انتظار الجواب إلا إن «فُتح» العنصر بلمسة
  if (!asstTtsOn()) return; try { if (!ASST_AUDIO) ASST_AUDIO = new Audio(); ASST_AUDIO.src = ASST_SILENT; ASST_AUDIO.play().catch(() => {}); } catch (e) {}
}
/* ⚙️ مفتاح «صوت ElevenLabs» في إعدادات الذكاء الاصطناعي — مقفول افتراضيًا (صوت الجهاز)، ولا يعمل إلا إذا فتحه المعلم */
const asstElOn = () => { try { return localStorage.getItem('asst_el_on') === '1'; } catch (e) { return false; } };
function asstElSet(on) { try { if (on) localStorage.setItem('asst_el_on', '1'); else localStorage.removeItem('asst_el_on'); localStorage.removeItem('asst_el_off'); } catch (e) {} ASST_EL = null; asstSpeakStop();
  try { toast(on ? '🔊 مساعدي يقرأ بصوت ElevenLabs' : '🔊 مساعدي يقرأ بصوت جهازك', 'good'); } catch (e) {} }
(function asstElInit() { const go = () => { const c = document.getElementById('asst-el-tg'); if (c) c.checked = asstElOn(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go(); })();
function asstSpeakStop() { ASST_SAY++; try { speechSynthesis.cancel(); } catch (e) {} try { if (ASST_AUDIO) ASST_AUDIO.pause(); } catch (e) {} }
function asstSpeakDevice(txt) {
  if (!window.speechSynthesis) return;
  try { const u = new SpeechSynthesisUtterance(txt.slice(0, 600)); u.lang = 'ar-SA'; const v = speechSynthesis.getVoices().find(x => /^ar/i.test(x.lang)); if (v) u.voice = v; speechSynthesis.speak(u); } catch (e) {}
}
async function asstSpeak(t) {
  if (!asstTtsOn()) return;
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
  asstSpeakDevice(txt);   // احتياطي: صوت الجهاز
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
  try { if (localStorage.getItem('asst_brief_seen') === asstToday()) return; } catch (e) {}
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
  box.scrollTop = box.scrollHeight;
  const send = document.getElementById('asst-send'); if (send) send.disabled = ASST.busy;
}
function asstOpen() {
  let p = document.getElementById('asst-panel');
  if (!p) {
    p = document.createElement('div'); p.id = 'asst-panel'; p.className = 'no-print'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'مساعدي');
    p.innerHTML = `<div class="asst-head"><span class="asst-ic">✨</span><div><b>مساعدي</b><small>لا ينفّذ شيئًا إلا بعد تأكيدك</small></div>
      <button type="button" class="asst-clear" id="asst-tts" onclick="asstTtsToggle()" title="قراءة الأجوبة بصوت" aria-label="قراءة الأجوبة بصوت">${asstTtsOn() ? '🔊' : '🔇'}</button><button type="button" onclick="ASST.msgs=[];asstPaint()" title="محادثة جديدة" aria-label="محادثة جديدة">↺</button><button type="button" class="asst-x" onclick="asstClose()" aria-label="إغلاق">✕</button></div>
      <div class="asst-msgs" id="asst-msgs" aria-live="polite"></div>
      <div class="asst-sugg">${ASST_SUGG.map(s => `<button type="button" onclick="${s[0] === '☀' ? 'asstShowBrief()' : 'asstAsk(this.textContent)'}">${asstEsc(s)}</button>`).join('')}</div>
      <form class="asst-in" onsubmit="event.preventDefault();const i=document.getElementById('asst-q');asstAsk(i.value);i.value=''"><textarea id="asst-q" rows="1" placeholder="اسأل عن طلابك…" autocomplete="off"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();this.form.requestSubmit()}"></textarea>${ASST_SR ? '<button type="button" id="asst-mic" class="asst-mic" onclick="asstMic()" title="تكلّم" aria-label="تكلّم">🎤</button>' : ''}<button type="submit" id="asst-send" class="btn tick sm">إرسال</button></form>`;
    document.body.appendChild(p);
    p.addEventListener('keydown', e => { if (e.key === 'Escape') asstClose(); });
  }
  p.classList.add('on'); document.body.classList.add('asst-open'); asstPaint();
  let seen = ''; try { seen = localStorage.getItem('asst_brief_seen') || ''; } catch (e) {}
  if (seen !== asstToday() && !ASST.msgs.length) asstShowBrief();
  const b = document.getElementById('asst-btn'); if (b) b.classList.remove('has-brief');
  setTimeout(() => { try { document.getElementById('asst-q').focus(); } catch (e) {} }, 60);
}
function asstClose() { asstSpeakStop(); const p = document.getElementById('asst-panel'); if (p) p.classList.remove('on'); document.body.classList.remove('asst-open'); }

async function asstShowBrief() { try { localStorage.setItem('asst_brief_seen', asstToday()); } catch (e) {} const m = { html: '<i class="asst-dots"><b></b><b></b><b></b></i>', src: [] }; ASST.msgs.push(m); asstPaint();
  try { Object.assign(m, asstBriefMsg(await asstBrief())); } catch (e) { m.html = '⚠️ تعذّر تجهيز الملخص'; } asstPaint(); }
