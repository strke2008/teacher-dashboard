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
function asstCardName(q) { try { if (typeof storeCardLabel === 'function') return storeCardLabel(q); } catch (e) {} return String(q.card || q.title || 'بطاقة'); }
const asstFrom = (days, def) => new Date(Date.now() + 3 * 3600e3 - Math.max(1, Math.min(365, Number(days) || def)) * 864e5).toISOString().slice(0, 10);
function asstCount(M, from) { const c = {}; Object.entries(M || {}).forEach(([d, P]) => { if (d < from) return; Object.entries(P || {}).forEach(([id, v]) => { const st = v && (typeof v === 'string' ? v : v.status); if (st) { const o = c[id] || (c[id] = {}); o[st] = (o[st] || 0) + 1; } }); }); return c; }

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
  parent_message: { act: 1, d: 'كتابة مسودة رسالة لولي أمر طالب (المعلم يراجعها ويرسلها بنفسه). args: {student, topic:"موضوع الرسالة", message?:"نص الرسالة إن كتبته"}', src: a => '✉️ مسودة رسالة — ' + (a._name || a.student || ''),
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
  reminder: { act: 1, d: 'تذكير شخصي للمعلم يظهر في «مهام اليوم» وإشعاراته في موعده (بتأكيد وتراجع). args: {title, date?:"اليوم"|"بكرة"|"الخميس"|"YYYY-MM-DD", time?:"HH:MM" (24 ساعة), weekly?:["الأحد","الثلاثاء"…] أو ["كل يوم"] لتذكير أسبوعي متكرر}', src: () => '⏰ تجهيز تذكير',
    async run(a) { const title = String(a.title || '').trim().slice(0, 80); if (!title) return { error: 'اكتب نص التذكير' }; const date = asstDue(a.date || 'اليوم') || asstToday();
      const tm = String(a.time || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).match(/^(\d{1,2})(?::(\d{2}))?$/), hm = tm ? String(Math.min(23, +tm[1])).padStart(2, '0') + ':' + (tm[2] || '00') : '07:00';
      let days = null; if (a.weekly) { const W = Array.isArray(a.weekly) ? a.weekly : [a.weekly], N = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map(x => asstTok(x)[0]);
        days = W.some(x => /كل\s*يوم|يومي/.test(String(x))) ? [0, 1, 2, 3, 4] : [...new Set(W.map(x => N.findIndex(n => asstTok(String(x).replace(/^يوم\s+/, ''))[0] === n || asstTok(String(x))[0] === n.replace(/^ال/, ''))).filter(i => i >= 0))].sort(); if (!days.length) days = null; }
      return { action: 'rem', title, date, hm, ...(days ? { days, weeklyLabel: days.length === 5 && days.join() === '0,1,2,3,4' ? 'كل يوم دراسي' : 'كل ' + days.map(i => ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][i]).join(' و') } : {}) }; } },
  shortcut: { act: 1, d: 'حفظ اختصار: اسم قصير يشغّل أمرًا كاملًا متعدد الخطوات عند كتابته (أو حذفه إن كان command فارغًا). args: {name:"بداية الحصة", command:"الأمر كاملًا كما يكتبه المعلم"}', src: () => '⚡ اختصار',
    async run(a) { const name = String(a.name || '').trim().slice(0, 40), command = String(a.command || '').trim().slice(0, 400); if (!name) return { error: 'سمِّ الاختصار' }; return { action: 'shortcut', name, command, had: !!asstShortcuts()[name] }; } },
  /* ── 🆕 الدفعة الرابعة: الجدول · المهام · الخطط · الشهادات · التذكيرات · مهام اليوم · أسئلة نشاط · الحوائط · قائمة فصل ── */
  schedule: { d: 'جدول حصص المعلم ليوم: الحصص وأوقاتها وفصل كل حصة. args: {day?:"اليوم"|"بكرة"|"الأحد"…|"YYYY-MM-DD"}', src: a => '🗓️ الجدول — ' + (a.day || 'اليوم'),
    async run(a) { const D = await asstClassroom(), sc = D.schedule || {}, date = asstDue(a.day || 'اليوم') || asstToday(), dow = new Date(date + 'T12:00:00Z').getUTCDay();
      const T = typeof tdTimes === 'function' ? tdTimes(sc) : [], g = (sc.grid || {})[String(dow)] || {};
      const L = T.map(t => ({ period: t.n, from: t.s, to: t.e, cls: String(g[String(t.n)] || '').trim() || 'فراغ' }));
      return { date, day: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][dow], periods: L.filter(x => x.cls !== 'فراغ').length ? L : [], note: Object.keys(g).length ? '' : 'لا حصص مسجلة لهذا اليوم في الجدول' }; } },
  duties: { d: 'مهام الطلاب ومسؤولياتهم الحالية (مسؤول رصد الواجبات…). args: {cls?}', src: () => '🎖️ مهام الطلاب',
    async run(a) { const D = await asstClassroom(), cls = asstCls(a.cls), byId = new Map(asstStudents().map(s => [String(s.id), s]));
      return { duties: (Array.isArray(D.roles) ? D.roles : []).filter(r => r && r.active && (!cls || r.cls === cls)).map(r => ({ title: r.title, cls: r.cls || '', student: (byId.get(String(r.studentId)) || {}).name || '—' })) }; } },
  plans: { d: 'الخطط العلاجية المفتوحة (لمن، والمهارة أو السبب، وموعد الانتهاء). args: {student?, cls?}', src: () => '🩺 الخطط العلاجية',
    async run(a) { const G = await asstGrades(), P = ((typeof PLAN_DATA !== 'undefined' && PLAN_DATA && PLAN_DATA.plans) || (G && G.plans) || []), byId = new Map(asstStudents().map(s => [String(s.id), s])), cls = asstCls(a.cls);
      const one = a.student ? asstFindStudent(a.student)[0] : null;
      const L = P.filter(p => p && p.status !== 'done').map(p => { const mem = p.group ? (p.members || []).map(m => byId.get(String(m.studentId))).filter(Boolean) : [byId.get(String(p.studentId))].filter(Boolean);
        return { who: mem.map(s => s.name), cls: [...new Set(mem.map(s => s.cls || ''))].join('، '), about: String(p.skill || p.reason || p.title || '').slice(0, 80), due: p.dueDate || '', _ids: mem.map(s => String(s.id)) }; })
        .filter(x => (!one || x._ids.includes(String(one.id))) && (!cls || x.cls.includes(cls)));
      return { open: L.length, plans: L.slice(0, 25), note: P.length ? '' : 'افتح صفحة «الخطط العلاجية» مرة لتُحمَّل الخطط' }; } },
  certificates_list: { d: 'الشهادات الصادرة (لمن ولماذا ومتى). args: {student?, days?}', src: () => '🏅 الشهادات',
    async run(a) { const D = await asstClassroom(), byId = new Map(asstStudents().map(s => [String(s.id), s])), one = a.student ? asstFindStudent(a.student)[0] : null, from = a.days ? new Date(Date.now() + 3 * 3600e3 - Number(a.days) * 864e5).toISOString().slice(0, 10) : '';
      const L = (Array.isArray(D.certificates) ? D.certificates : []).filter(c => c && (!one || String(c.studentId) === String(one.id)) && (!from || String(c.date || '') >= from));
      return { total: L.length, certificates: L.slice(0, 30).map(c => ({ name: (byId.get(String(c.studentId)) || {}).name || '—', reason: c.reason || '', date: c.date || '' })) }; } },
  reminders_list: { d: 'تذكيرات المعلم المحفوظة (اليوم أو كلها). args: {today?:true}', src: () => '⏰ تذكيراتي',
    async run(a) { const D = await asstClassroom(), R = Array.isArray(D.reminders) ? D.reminders : [];
      if (a.today && typeof tdRemToday === 'function') return { today: tdRemToday().map(x => ({ title: typeof tdRemTitle === 'function' ? tdRemTitle(x.r) : x.r.title, at: x.hm, done: !!x.done })) };
      return { reminders: R.filter(r => r && !r.paused).map(r => ({ title: r.title || (r.kind === 'duty' ? 'تذكير مسؤول الواجبات' : 'تذكير'), when: r.repeat === 'once' ? r.date : 'أسبوعي', at: (r.at || {}).hm || (r.at && r.at.t === 'period' ? 'الحصة ' + r.at.p : r.at && r.at.cls ? 'حصة ' + r.at.cls : '') })) }; } },
  today_tasks: { d: 'مهام اليوم والتنبيهات كما في صفحة «اليوم» (رسائل أولياء أمور مقترحة، أنشطة انتهى موعدها، تذكيرات…). args: {}', src: () => '📌 مهام اليوم',
    async run() { let L = []; try { L = typeof tdTasks === 'function' ? tdTasks() : []; } catch (e) {} return { tasks: L.slice(0, 25).map(x => String(x.t || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean) }; } },
  activity_questions: { d: 'تحليل أسئلة نشاط إلكتروني: نسبة الإجابة الصحيحة لكل سؤال والأصعب أولًا. args: {activity, n?}', src: a => '📊 أسئلة «' + (a._title || a.activity || '') + '»',
    async run(a) { const m = asstFindAct(a.activity); if (m.length !== 1) return { error: m.length ? 'أكثر من نشاط يطابق' : 'لم أجد النشاط', matches: m.slice(0, 8).map(h => h.title) };
      const h = m[0], qs = h.qs || [], ok = qs.map(() => 0), tot = qs.map(() => 0); a._title = h.title;
      Object.values(h.subs || {}).forEach(v => { const d = String(v && v.d || ''); if (d.length !== qs.length) return; for (let i = 0; i < qs.length; i++) { tot[i]++; if (d[i] === '1') ok[i]++; } });
      const L = qs.map((q, i) => ({ no: i + 1, q: String(q.q || q.w || 'مهمة').slice(0, 90), answered: tot[i], correct_pct: tot[i] ? Math.round(ok[i] / tot[i] * 100) : null })).filter(x => x.answered).sort((x, y) => x.correct_pct - y.correct_pct);
      return { title: h.title, questions: qs.length, hardest_first: L.slice(0, Math.max(3, Math.min(30, Number(a.n) || 8))), note: L.length ? '' : 'لا توجد تفاصيل إجابات محفوظة لهذا النشاط' }; } },
  walls_pending: { d: 'منشورات حوائط الإبداع التي تنتظر اعتماد المعلم. args: {}', src: () => '🧱 الحوائط',
    async run() { const W = typeof TD_WALLS !== 'undefined' && Array.isArray(TD_WALLS) ? TD_WALLS : null; if (!W) return { note: 'افتح «حائط الإبداع» مرة لتُحمَّل' }; return { walls: W.map(w => ({ title: w.title, pending: w.pending })) }; } },
  class_list: { d: 'قائمة طلاب فصل وعددهم، أو عدد الطلاب في كل الفصول. args: {cls?}', src: a => '👥 ' + (a.cls || 'الفصول'),
    async run(a) { const cls = asstCls(a.cls); if (a.cls && !cls) return { error: 'لم أجد الفصل', classes: asstClsList() };
      if (!cls) return { classes: asstClsList().map(c => ({ cls: c, students: asstStudents().filter(s => String(s.cls || '') === c).length })), total: asstStudents().length };
      const L = asstStudents().filter(s => String(s.cls || '') === cls).map(s => s.name).sort((x, y) => x.localeCompare(y, 'ar')); return { cls, count: L.length, students: L }; } },
  reminder_done: { act: 1, d: 'تعليم تذكير من تذكيرات اليوم «تم» (بتأكيد). args: {title:"جزء من نص التذكير"}', src: () => '⏰ تجهيز «تم»',
    async run(a) { await asstClassroom(); const T = typeof tdRemToday === 'function' ? tdRemToday() : [], t = asstTok(a.title || ''), m = T.filter(x => !x.done && t.length && t.every(w => asstTok(typeof tdRemTitle === 'function' ? tdRemTitle(x.r) : x.r.title || '').some(y => y.includes(w))));
      if (m.length !== 1) return { error: m.length ? 'أكثر من تذكير يطابق' : 'لم أجد تذكيرًا مفتوحًا اليوم بهذا النص', today: T.filter(x => !x.done).map(x => typeof tdRemTitle === 'function' ? tdRemTitle(x.r) : x.r.title) };
      return { action: 'remdone', title: typeof tdRemTitle === 'function' ? tdRemTitle(m[0].r) : m[0].r.title, at: m[0].hm, _rid: m[0].r.id }; } },
  /* ── 🆕 الدفعة الخامسة: المعرّضون للخطر · تقرير الأسبوع · مقارنة فترتين · تحضير درس · تقارير أولياء الأمور · تصدير · بحث الرسائل ── */
  at_risk: { d: 'الطلاب الأحق بالمتابعة: يجمع الغياب (30 يومًا) والأنشطة الناقصة والملاحظات السلبية (14 يومًا) وانخفاض المستوى، مرتبين مع السبب. args: {cls?, n?}', src: () => '🚩 الأحق بالمتابعة',
    async run(a) { const cls = asstCls(a.cls), G = await asstGrades(), gm = new Map(((G && G.students) || []).map(g => [String(g.id), g]));
      const ab = (await ASST_TOOLS.absence_totals.run({ cls, days: 30, n: 500 })).students || [], mw = (await ASST_TOOLS.missing_work.run({ cls, n: 500 })).students || [], bn = (await ASST_TOOLS.behavior_notes.run({ cls, days: 14 })).notes || [];
      const key = x => x.name + '|' + x.cls, S = {}; const add = (x, pts, why) => { const k = key(x), o = S[k] || (S[k] = { name: x.name, cls: x.cls, score: 0, why: [] }); o.score += pts; o.why.push(why); };
      ab.forEach(x => { const n = x.absent + x.excused; if (n >= 2) add(x, n * 2, `غاب ${n}`); }); mw.forEach(x => { if (x.missing >= 2) add(x, x.missing * 1.5, `لم يسلّم ${x.missing} أنشطة`); });
      const neg = {}; bn.filter(x => x.type === 'سلبي').forEach(x => { const k = key(x); neg[k] = (neg[k] || 0) + 1; }); Object.entries(neg).forEach(([k, n]) => { const [name, c] = k.split('|'); if (n >= 2) add({ name, cls: c }, n * 1.5, `${n} ملاحظات سلبية`); });
      asstStudents().filter(s => !cls || String(s.cls || '') === cls).forEach(s => { const g = gm.get(String(s.id)); if (!g) return; const t = g.trend || {}, l = g.level || {};
        if (t.measurable && Number(t.change) <= -10) add({ name: s.name, cls: s.cls || '' }, Math.abs(t.change) / 5, `نزل مستواه ${Math.abs(Math.round(t.change))}%`); if (Number(l.rate) > 0 && Number(l.rate) < 50) add({ name: s.name, cls: s.cls || '' }, 3, `مستواه ${Math.round(l.rate)}%`); });
      const L = Object.values(S).sort((x, y) => y.score - x.score).slice(0, Math.max(1, Math.min(30, Number(a.n) || 8))).map(({ name, cls, why }) => ({ name, cls, reasons: why.join('، ') }));
      return { cls: cls || 'كل الفصول', students: L, note: L.length ? 'مرتبون من الأحق بالمتابعة' : 'لا أحد يستدعي المتابعة الآن' }; } },
  weekly_report: { d: 'ملخص الأسبوع (آخر 7 أيام) لفصل أو للكل: الغياب، تسليم الأنشطة التي انتهت فيه، المتميزون سلوكًا، الأكثر نقصًا، وأضعف المهارات. args: {cls?}', src: a => '🗓️ ملخص الأسبوع' + (a.cls ? ' — ' + a.cls : ''),
    async run(a) { const cls = asstCls(a.cls), from = new Date(Date.now() + 3 * 3600e3 - 7 * 864e5).toISOString().slice(0, 10), pool = asstStudents().filter(s => !cls || String(s.cls || '') === cls);
      const ab = (await ASST_TOOLS.absence_totals.run({ cls, days: 7, n: 10 })).students || [];
      const acts = asstActs().filter(h => h.due && h.due >= from && h.due <= asstToday() && !h.noGrade).map(h => { const P = asstPool(h).filter(s => !cls || String(s.cls || '') === cls); return { title: h.title, submitted: P.filter(s => asstSub(h, s)).length, of: P.length }; }).filter(x => x.of);
      const bn = (await ASST_TOOLS.behavior_notes.run({ cls, days: 7 })).notes || [], pos = {}; bn.filter(x => x.type === 'إيجابي').forEach(x => { pos[x.name] = (pos[x.name] || 0) + 1; });
      const sk = await ASST_TOOLS.skills.run({ cls, n: 3 });
      return { cls: cls || 'كل الفصول', from, students: pool.length, most_absent: ab.slice(0, 5), activities_due_this_week: acts, top_positive: Object.entries(pos).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([n, c]) => n + ' (' + c + ')'), weakest_skills: (sk.skills || []).map(x => x.skill + ' ' + x.rate + '%') }; } },
  compare_periods: { d: 'مقارنة طالب بين الفترة الأولى والثانية من الفصل الحالي (المشاركة، الواجبات، السلوك، الاختبار، الغياب، المستوى): تحسّن أم نزل. args: {student}', src: a => '📈 فترتان — ' + (a._name || a.student || ''),
    async run(a) { const m = asstFindStudent(a.student); if (m.length !== 1) return { error: m.length ? 'أكثر من طالب يطابق' : 'لم أجد الطالب' }; const s = m[0]; a._name = s.name; if (typeof loadServerGrades !== 'function') return { error: 'غير متاح' };
      const { sem } = asstSP({}), keep = [typeof COMP_GRADES !== 'undefined' ? COMP_GRADES : null, typeof COMP_GRADES_PERIOD !== 'undefined' ? COMP_GRADES_PERIOD : null, typeof COMP_GRADES_SEMESTER !== 'undefined' ? COMP_GRADES_SEMESTER : null], out = {};
      try { for (const per of [1, 2]) { const g = ((await loadServerGrades(false, sem, per)).map || {})[String(s.id)]; if (!g) continue; const P = g.participation || {}, Hm = g.homework || {}, B = g.behavior || {}, E = g.exam || {}, A = g.attendance || {}, L = g.level || {};
        out['period_' + per] = { participation: P.score, homework: Hm.score, behavior: B.score, exam: E.measured ? E.score + '/' + E.max : 'لم يُقس', absent: A.absent, level: L.label ? L.label + ' ' + Math.round(L.rate || 0) + '%' : undefined }; } }
      catch (e) { return { error: 'تعذّر جلب الفترتين — تحقق من الاتصال' }; }
      finally { try { if (keep[0]) { COMP_GRADES = keep[0]; COMP_GRADES_PERIOD = keep[1]; COMP_GRADES_SEMESTER = keep[2]; } } catch (e) {} }
      return { name: s.name, cls: s.cls || '', semester: sem, ...out, note: Object.keys(out).length < 2 ? 'إحدى الفترتين بلا بيانات بعد' : '' }; } },
  lesson_plan: { d: 'تحضير درس: أهداف، تهيئة، خطوات الشرح مع أنشطة صفية، تقويم ختامي (سؤال الخروج)، وواجب مقترح. args: {topic, cls?, minutes?:مدة الحصة (افتراضي 45)}', src: a => '📝 تحضير «' + (a.topic || '') + '»',
    async run(a) { const topic = String(a.topic || '').trim().slice(0, 200); if (!topic) return { error: 'حدّد موضوع الدرس' }; const min = Math.max(20, Math.min(120, Number(a.minutes) || 45));
      const R = typeof aiRoute === 'function' ? aiRoute('questions') : { p: raiProvider(), m: readingAIModels()[raiProvider()] };
      const j = aiSafeJson(await readingAICall(R.p, R.m, `أنت معلم علوم سعودي خبير. حضّر درسًا عن «${topic}» لحصة مدتها ${min} دقيقة${a.cls ? ' لطلاب ' + asstCls(a.cls) : ''}، بالعربية الفصحى المبسطة، عمليًا وقابلًا للتنفيذ في الفصل.
أخرج JSON فقط: {"objectives":["هدف قابل للقياس",...3-4],"warmup":"تهيئة قصيرة (سؤال أو موقف)","steps":[{"min":دقائق,"do":"ما يفعله المعلم والطلاب"}...4-6],"exit_ticket":["سؤال ختامي",...2-3],"homework":"واجب قصير مقترح","materials":["أداة"...]}`, new AbortController().signal)) || {};
      if (!Array.isArray(j.objectives) || !Array.isArray(j.steps)) return { error: 'لم يصل تحضير صالح — جرّب مرة أخرى' };
      return { topic, minutes: min, ...j, tip: 'يمكنك قول: «سوّ نشاط عن ' + topic + '» لإنشاء مسودة نشاط من الدرس' }; } },
  period_reports: { act: 1, d: 'مسودات تقرير الفترة لأولياء أمور فصل (درجات الطالب ومستواه وغيابه، لكل طالب رسالة يرسلها المعلم بنفسه من واتساب). args: {cls}', src: () => '✉️ تقارير الفترة',
    async run(a) { const cls = asstCls(a.cls); if (!cls) return { error: 'حدّد الفصل', classes: asstClsList() }; const G = await asstGrades(); if (!G) return { error: 'درجات الفترة غير متاحة الآن' };
      const gm = new Map((G.students || []).map(g => [String(g.id), g])), subj = (typeof rcGet === 'function' && rcGet('subject')) || 'المادة', { label } = asstSP({});
      const items = asstStudents().filter(s => String(s.cls || '') === cls).map(s => { const g = gm.get(String(s.id)) || {}, P = g.participation || {}, Hm = g.homework || {}, B = g.behavior || {}, E = g.exam || {}, A = g.attendance || {}, L = g.level || {};
        const lines = [typeof P.score === 'number' && `• المشاركة: ${P.score}`, typeof Hm.score === 'number' && `• الواجبات: ${Hm.score}`, typeof B.score === 'number' && `• السلوك: ${B.score}`, E.measured && `• الاختبار: ${E.score} من ${E.max}`, typeof A.absent === 'number' && `• الغياب: ${A.absent}${A.excused ? ' (بعذر ' + A.excused + ')' : ''}`, L.label && `• المستوى العام: ${L.label}`].filter(Boolean);
        return { name: s.name, cls, n: L.label || '', _id: String(s.id), text: `السلام عليكم ورحمة الله، ولي أمر الطالب ${s.name}،\n\nنفيدكم بملخص مستوى ابنكم في مادة ${subj} — ${label}:\n${lines.join('\n') || '• لا توجد بيانات كافية بعد'}\n\nشاكرين متابعتكم وتعاونكم.\nمعلم المادة` }; });
      return { action: 'drafts', reason: 'report', items }; } },
  export_grades: { d: 'تصدير كشف درجات الأنشطة إلى ملف إكسل (CSV) لفصل أو للكل — يُنزَّل فورًا. args: {cls?}', src: () => '⬇️ تصدير الدرجات',
    async run(a) { const cls = asstCls(a.cls); try { goTab('grades'); const s = document.getElementById('g-class'); if (s) { if (typeof gFillClasses === 'function') gFillClasses(); s.value = cls && [...s.options].some(o => o.value === cls) ? cls : '__all__'; renderGrades(); }
        await window.exportGrades(); } catch (e) { return { error: 'تعذّر التصدير' }; } return { exported: cls || 'كل الفصول', say: '⬇️ نزّلت ملف درجات ' + (cls || 'كل الفصول') }; } },
  search_messages: { d: 'بحث في رسائل الطلاب للمعلم («راسل معلمك») وردوده بكلمة. args: {query}', src: a => '🔎 بحث «' + (a.query || '') + '»',
    async run(a) { const q = asstTok(a.query || ''); if (!q.length) return { error: 'اكتب كلمة البحث' }; try { if (typeof asksLoad === 'function') await asksLoad(); } catch (e) {}
      const R = (typeof ASKS !== 'undefined' && Array.isArray(ASKS) ? ASKS : []).filter(x => x && q.every(w => asstTok((x.text || '') + ' ' + (x.reply || '') + ' ' + (x.hwTitle || '')).some(t => t.includes(w))));
      return { found: R.length, messages: R.slice(0, 15).map(x => ({ name: x.name || '', cls: x.cls || '', text: String(x.text || '').slice(0, 200), reply: x.reply ? String(x.reply).slice(0, 120) : undefined, status: x.status === 'open' ? 'تنتظر ردك' : 'مغلقة' })) }; } },
  /* ── 🆕 الدفعة السادسة: الواجب اليومي · ما ينتظر التصحيح · المستويات · سجل طالب · إحصاء الأنشطة · المشاريع · المتجر · مرشّحو الشهادات · تعيين مسؤول ── */
  homework_day: { d: 'رصد الواجب في يوم: من أنجز ومن لم ينجز ومن معذور (افتراضي اليوم). args: {date?:"اليوم"|"أمس"|"YYYY-MM-DD", cls?}', src: a => '📚 الواجب — ' + (a.date || 'اليوم'),
    async run(a) { const D = await asstClassroom(), date = asstDate(a.date), cls = asstCls(a.cls), H = (D.homework || {})[date] || {}, pool = asstStudents().filter(s => !cls || String(s.cls || '') === cls);
      const st = s => { const v = H[String(s.id)]; return String(v && (typeof v === 'string' ? v : v.status) || ''); }, by = x => pool.filter(s => st(s) === x).map(s => ({ name: s.name, cls: s.cls || '' }));
      return { date, cls: cls || 'كل الفصول', recorded: pool.filter(st).length, of: pool.length, done: by('أنجز').length, not_done: by('لم ينجز'), excused: by('معذور') }; } },
  pending_reviews: { d: 'ما ينتظر تصحيحك أو مراجعتك: تسليمات الأنشطة بالملفات، ومشاريع الطلاب بانتظار المراجعة. args: {}', src: () => '🗂️ بانتظار المراجعة',
    async run() { const files = []; asstActs().filter(h => h.kind === 'files').forEach(h => { const n = Object.values(h.subs || {}).filter(v => v && String(v.reviewStatus || 'pending').toLowerCase() === 'pending' && v.manualGrade === undefined).length; if (n) files.push({ activity: h.title, pending: n }); });
      const P = typeof PROJECTS_DATA !== 'undefined' && Array.isArray(PROJECTS_DATA) ? PROJECTS_DATA : [], proj = {}; P.filter(x => x && String(x.reviewStatus || '') === 'pending').forEach(x => { const k = x.title || 'مشروع'; proj[k] = (proj[k] || 0) + 1; });
      return { file_activities: files, projects: Object.entries(proj).map(([title, pending]) => ({ title, pending })), note: P.length || (typeof PROJECTS_LOADED !== 'undefined' && PROJECTS_LOADED) ? '' : 'افتح «المشاريع» مرة لتُحمَّل المشاريع' }; } },
  levels_overview: { d: 'توزيع الطلاب على المستويات (متقدم/متمكن/…/يحتاج دعمًا) في فصل أو للكل، مع الأسماء. args: {cls?}', src: () => '📊 المستويات',
    async run(a) { const G = await asstGrades(); if (!G) return { error: 'درجات الفترة غير متاحة الآن' }; const cls = asstCls(a.cls), by = {};
      (G.students || []).filter(g => !cls || String(g.cls || '') === cls).forEach(g => { const l = (g.level || {}).label || 'بلا قياس'; (by[l] = by[l] || []).push(g.name); });
      return { cls: cls || 'كل الفصول', levels: Object.entries(by).map(([level, names]) => ({ level, count: names.length, students: names.slice(0, 40) })).sort((x, y) => y.count - x.count) }; } },
  student_timeline: { d: 'سجل طالب الأخير: آخر تسليماته وتواريخها، وغيابه، وملاحظات سلوكه، ونقاطه، وآخر درجة اختبار. args: {student, days?:30}', src: a => '🕘 سجل ' + (a._name || a.student || ''),
    async run(a) { const m = asstFindStudent(a.student); if (m.length !== 1) return { error: m.length ? 'أكثر من طالب يطابق' : 'لم أجد الطالب', matches: m.slice(0, 8).map(s => s.name + ' — ' + (s.cls || '')) }; const s = m[0]; a._name = s.name;
      const days = Math.max(1, Math.min(180, Number(a.days) || 30)), from = new Date(Date.now() + 3 * 3600e3 - days * 864e5).toISOString().slice(0, 10), D = await asstClassroom(), day = t => t ? new Date(Number(t) + 3 * 3600e3).toISOString().slice(0, 10) : '';
      const subs = asstActs().map(h => ({ h, v: asstSub(h, s) })).filter(o => o.v).map(o => ({ title: o.h.title, at: day(o.v.at), score: Number(o.v.total) ? `${o.v.correct || 0}/${o.v.total}` : (o.v.manualGrade !== undefined ? String(o.v.manualGrade) : '—') })).filter(x => !x.at || x.at >= from).sort((x, y) => String(y.at).localeCompare(String(x.at))).slice(0, 12);
      const abs = Object.entries(D.participation || {}).filter(([d, P]) => d >= from && P && P[String(s.id)] && ABSENT.includes(P[String(s.id)].status || P[String(s.id)])).map(([d]) => d).sort().reverse();
      const beh = (await ASST_TOOLS.behavior_notes.run({ student: s.name, days })).notes || [], ex = await ASST_TOOLS.exam_scores.run({ student: s.name });
      return { name: s.name, cls: s.cls || '', reward_points: Number(s.points) || 0, last_submissions: subs, absences: abs, behavior: beh.slice(0, 8), exams: ex.tests || [] }; } },
  activity_stats: { d: 'إحصاء الأنشطة المنشورة: نسبة التسليم ومتوسط الدرجة لكل نشاط، الأضعف أولًا. args: {cls?, n?}', src: () => '📈 إحصاء الأنشطة',
    async run(a) { const cls = asstCls(a.cls); const L = asstActs().filter(h => !h.noGrade).map(h => { const P = asstPool(h).filter(s => !cls || String(s.cls || '') === cls); if (!P.length) return null; const got = P.map(s => asstSub(h, s)).filter(Boolean), pc = got.map(asstPct).filter(x => x != null);
        return { title: h.title, due: h.due || '', submitted_pct: Math.round(got.length / P.length * 100), average_pct: pc.length ? Math.round(pc.reduce((n, x) => n + x, 0) / pc.length) : null, of: P.length }; }).filter(Boolean);
      return { cls: cls || 'كل الفصول', activities: L.sort((x, y) => (x.average_pct ?? 101) - (y.average_pct ?? 101) || x.submitted_pct - y.submitted_pct).slice(0, Math.max(3, Math.min(40, Number(a.n) || 10))) }; } },
  projects_status: { d: 'مشاريع الطلاب: كم سلّم في كل مشروع، وكم بانتظار المراجعة أو مرفوض، أو تسليمات طالب. args: {project?, student?}', src: () => '📁 المشاريع',
    async run(a) { const P = typeof PROJECTS_DATA !== 'undefined' && Array.isArray(PROJECTS_DATA) ? PROJECTS_DATA : []; if (!P.length) return { note: 'لا مشاريع محمّلة — افتح «المشاريع» مرة' };
      const t = asstTok(a.project || ''), q = asstTok(a.student || ''), L = P.filter(x => x && (!t.length || t.every(w => asstTok(x.title || '').some(y => y.includes(w)))) && (!q.length || q.every(w => asstTok(x.studentName || '').some(y => y.startsWith(w)))));
      const by = {}; L.forEach(x => { const o = by[x.title || 'مشروع'] || (by[x.title || 'مشروع'] = { submitted: 0, pending: 0, rejected: 0, students: [] }); o.submitted++; const r = String(x.reviewStatus || 'accepted'); if (r === 'pending') o.pending++; if (r === 'rejected') o.rejected++; if (o.students.length < 30) o.students.push(x.studentName + (r === 'accepted' ? '' : r === 'pending' ? ' (بانتظار المراجعة)' : ' (مرفوض)')); });
      return { projects: Object.entries(by).map(([title, o]) => ({ title, ...o })) }; } },
  store_purchases: { d: 'آخر عمليات الشراء من متجر الدرجات للطلاب (من اشترى ماذا وبكم نقطة). args: {days?:14}', src: () => '🛒 المتجر',
    async run(a) { const L = typeof STORE_PURCHASES !== 'undefined' && Array.isArray(STORE_PURCHASES) ? STORE_PURCHASES : [], since = Date.now() - Math.max(1, Math.min(365, Number(a.days) || 14)) * 864e5;
      const R = L.filter(q => q && Number(q.at || 0) >= since); return { count: R.length, spent: R.reduce((n, q) => n + (Number(q.price) || 0), 0), purchases: R.slice(0, 30).map(q => ({ student: q.name || '', item: q.kind === 'exam-bonus' ? `+${q.add || ''} درجة في اختبار الفترة ${q.period || 1}` : asstCardName(q), price: Number(q.price) || 0, date: q.at ? new Date(Number(q.at) + 3 * 3600e3).toISOString().slice(0, 10) : '' })) }; } },
  certificate_candidates: { d: 'مرشّحون لشهادة شكر: الأعلى في الفترة ممن لم يأخذ شهادة في آخر 30 يومًا. args: {cls?, n?}', src: () => '🏅 مرشّحو الشهادات',
    async run(a) { const r = await ASST_TOOLS.ranking.run({ cls: a.cls, by: 'total', n: 60 }); if (r.error) return r; const D = await asstClassroom(), from = new Date(Date.now() + 3 * 3600e3 - 30 * 864e5).toISOString().slice(0, 10);
      const had = new Set((Array.isArray(D.certificates) ? D.certificates : []).filter(c => c && String(c.date || '') >= from).map(c => String(c.studentId))), byName = new Map(asstStudents().map(s => [s.name + '|' + (s.cls || ''), s]));
      return { cls: r.cls, candidates: r.students.filter(x => { const s = byName.get(x.name + '|' + x.cls); return s && !had.has(String(s.id)); }).slice(0, Math.max(1, Math.min(20, Number(a.n) || 5))), tip: 'قل «اصدر شهادة لفلان» لإصدارها' }; } },
  assign_duty: { act: 1, d: 'تعيين طالب في مهمة/مسؤولية في فصله (مثل «مسؤول رصد الواجبات») — يحل محل المسؤول السابق للمهمة نفسها في الفصل (بتأكيد). args: {student, title?:"مسؤول رصد الواجبات"}', src: () => '🎖️ تجهيز مسؤول',
    async run(a) { const m = asstFindStudent(a.student); if (m.length !== 1) return { error: m.length ? 'أكثر من طالب يطابق' : 'لم أجد الطالب', matches: m.slice(0, 8).map(s => s.name + ' — ' + (s.cls || '')) }; const s = m[0], title = String(a.title || 'مسؤول رصد الواجبات').trim().slice(0, 60), D = await asstClassroom();
      const prev = (Array.isArray(D.roles) ? D.roles : []).find(r => r && r.active && r.cls === s.cls && r.title === title), byId = new Map(asstStudents().map(x => [String(x.id), x]));
      return { action: 'duty', title, cls: s.cls || '', name: s.name, prev: prev ? (byId.get(String(prev.studentId)) || {}).name || '' : '', _sid: String(s.id) }; } },
  /* ── 🆕 الدفعة السابعة: مجاميع الواجب والمشاركة · أيام لم تُرصد · سجل التواصل · الملاحظات الخاصة · مقارنة طالبين · تسجيل تواصل · ملاحظة خاصة · إنهاء مهمة ── */
  homework_totals: { d: 'أكثر الطلاب عدم إنجاز للواجب خلال مدة (مجموع «لم ينجز»). args: {cls?, days?:30, n?}', src: a => '📕 الواجب — آخر ' + (Number(a.days) || 30) + ' يوم',
    async run(a) { const D = await asstClassroom(), from = asstFrom(a.days, 30), cls = asstCls(a.cls), c = asstCount(D.homework, from);
      const rows = asstStudents().filter(s => (!cls || String(s.cls || '') === cls) && c[s.id]).map(s => ({ name: s.name, cls: s.cls || '', not_done: c[s.id]['لم ينجز'] || 0, done: c[s.id]['أنجز'] || 0, excused: c[s.id]['معذور'] || 0 })).filter(x => x.not_done).sort((x, y) => y.not_done - x.not_done || x.done - y.done);
      return { from, cls: cls || 'كل الفصول', students: rows.slice(0, Math.max(1, Math.min(50, Number(a.n) || 10))) }; } },
  participation_totals: { d: 'مجموع المشاركة لكل طالب خلال مدة: الأقل مشاركة (order:"asc" افتراضي) أو الأكثر (desc). args: {cls?, days?:30, order?, n?}', src: () => '✋ مجموع المشاركة',
    async run(a) { const D = await asstClassroom(), from = asstFrom(a.days, 30), cls = asstCls(a.cls), c = asstCount(D.participation, from), desc = a.order === 'desc';
      const rows = asstStudents().filter(s => !cls || String(s.cls || '') === cls).map(s => { const o = c[s.id] || {}; return { name: s.name, cls: s.cls || '', participated: o['شارك'] || 0, not_participated: o['لم يشارك'] || 0 }; })
        .sort((x, y) => desc ? y.participated - x.participated : x.participated - y.participated || y.not_participated - x.not_participated);
      return { from, cls: cls || 'كل الفصول', order: desc ? 'الأكثر مشاركة' : 'الأقل مشاركة', students: rows.slice(0, Math.max(1, Math.min(50, Number(a.n) || 10))) }; } },
  unrecorded_days: { d: 'أيام الدراسة (الأحد–الخميس) الأخيرة التي لم يُرصد فيها حضور/مشاركة أو واجب لفصل. args: {cls?, days?:14}', src: () => '🗓️ أيام لم تُرصد',
    async run(a) { const D = await asstClassroom(), n = Math.max(1, Math.min(60, Number(a.days) || 14)), L = a.cls ? [asstCls(a.cls)].filter(Boolean) : asstClsList(), out = [];
      const has = (M, d, ids) => { const P = (M || {})[d] || {}; return Object.keys(P).some(id => ids.has(String(id))); };
      for (const cls of L) { const ids = new Set(asstStudents().filter(s => String(s.cls || '') === cls).map(s => String(s.id))), att = [], hw = [];
        for (let k = 0; k < n; k++) { const t = new Date(Date.now() + 3 * 3600e3 - k * 864e5), d = t.toISOString().slice(0, 10); if (t.getUTCDay() > 4) continue; if (!has(D.participation, d, ids)) att.push(d); if (!has(D.homework, d, ids)) hw.push(d); }
        out.push({ cls, attendance_not_recorded: att, homework_not_recorded: hw }); }
      return { days: n, classes: out, note: 'قد تكون بعض الأيام إجازة أو بلا حصة لهذا الفصل' }; } },
  contacts_log: { d: 'سجل التواصل مع أولياء الأمور (الوسيلة والسبب والنتيجة) لطالب أو للكل. args: {student?, days?:60}', src: () => '📞 سجل التواصل',
    async run(a) { const D = await asstClassroom(), from = asstFrom(a.days, 60), byId = new Map(asstStudents().map(s => [String(s.id), s])); let one = null;
      if (a.student) { const m = asstFindStudent(a.student); if (m.length !== 1) return { error: m.length ? 'أكثر من طالب يطابق' : 'لم أجد الطالب' }; one = m[0]; }
      const L = (Array.isArray(D.contacts) ? D.contacts : []).filter(x => x && !x.deleted && (!one || String(x.studentId) === String(one.id)) && String(x.date || '') >= from).sort((p, q) => String(q.date).localeCompare(String(p.date)));
      return { from, total: L.length, contacts: L.slice(0, 30).map(x => ({ name: (byId.get(String(x.studentId)) || {}).name || '—', date: x.date || '', channel: x.channel || '', reason: x.reason || '', result: x.result || '' })) }; } },
  student_notes: { d: 'ملاحظاتك الخاصة عن طالب (لا يراها الطالب). args: {student}', src: a => '🗒️ ملاحظات ' + (a._name || a.student || ''),
    async run(a) { const m = asstFindStudent(a.student); if (m.length !== 1) return { error: m.length ? 'أكثر من طالب يطابق' : 'لم أجد الطالب', matches: m.slice(0, 8).map(s => s.name + ' — ' + (s.cls || '')) }; const s = m[0], D = await asstClassroom(); a._name = s.name;
      return { name: s.name, notes: (Array.isArray(D.notes) ? D.notes : []).filter(x => x && !x.deleted && String(x.studentId) === String(s.id)).sort((p, q) => (q.at || 0) - (p.at || 0)).slice(0, 20).map(x => ({ text: x.text, date: x.at ? new Date(Number(x.at) + 3 * 3600e3).toISOString().slice(0, 10) : '' })) }; } },
  compare_students: { d: 'مقارنة طالبين أو أكثر جنبًا إلى جنب (المشاركة والواجبات والسلوك والاختبار والحضور والمستوى والنقاط). args: {students:["اسم","اسم"]}', src: () => '⚖️ مقارنة طلاب',
    async run(a) { const L = (Array.isArray(a.students) ? a.students : String(a.students || '').split(/[،,]| و/)).map(x => String(x).trim()).filter(Boolean).slice(0, 5); if (L.length < 2) return { error: 'اذكر طالبين على الأقل' };
      const out = []; for (const q of L) { const r = await ASST_TOOLS.student_summary.run({ student: q }); out.push(r.error ? { query: q, ...r } : r); } return { students: out }; } },
  log_contact: { act: 1, d: 'تسجيل تواصل تم مع ولي أمر طالب أو أكثر في سجل التواصل (بتأكيد وتراجع). args: {students:["اسم"], channel?:"واتساب"|"اتصال هاتفي"|"رسالة نصية"|"مقابلة حضورية"|"عبر المرشد الطلابي", reason?:"تذكير بأنشطة متأخرة"|"غياب متكرر"|"ملاحظة سلوكية"|"ضعف في المستوى"|"خطة علاجية"|"شكر وتقدير"|"تحسّن ملحوظ"|"أخرى", result?:"ما اتُّفق عليه", date?}', src: () => '📞 تسجيل تواصل',
    async run(a) { const r = asstResolve(a.students || a.student, asstCls(a.cls)), CH = ['واتساب', 'اتصال هاتفي', 'رسالة نصية', 'مقابلة حضورية', 'عبر المرشد الطلابي'], RS = ['تذكير بأنشطة متأخرة', 'غياب متكرر', 'ملاحظة سلوكية', 'ضعف في المستوى', 'خطة علاجية', 'شكر وتقدير', 'تحسّن ملحوظ', 'أخرى'];
      const pick = (L, v, d) => { v = String(v || '').trim(); return L.find(x => x === v) || L.find(x => v && (x.includes(v) || v.includes(x.replace(/^(اتصال|رسالة) /, '')))) || (v && d === 'أخرى' ? v.slice(0, 60) : d); };
      return { action: 'contact', channel: pick(CH, a.channel, 'اتصال هاتفي'), reason: pick(RS, a.reason, 'أخرى'), result: String(a.result || '').slice(0, 300), date: asstDate(a.date), items: r.items.map(x => ({ name: x.name, cls: x.cls || '', _id: String(x.id) })), unresolved: r.bad }; } },
  add_note: { act: 1, d: 'إضافة ملاحظة خاصة عن طالب (تظهر لك فقط ولا تصل للطالب) — بتأكيد وتراجع. args: {student, text}', src: () => '🗒️ ملاحظة خاصة',
    async run(a) { const r = asstResolve([a.student || (a.students || [])[0]].filter(Boolean), asstCls(a.cls)), t = String(a.text || a.note || '').trim().slice(0, 500); if (!t) return { error: 'ما نص الملاحظة؟' };
      return { action: 'note', text: t, items: r.items.slice(0, 1).map(x => ({ name: x.name, cls: x.cls || '', _id: String(x.id) })), unresolved: r.bad }; } },
  end_duty: { act: 1, d: 'إنهاء مهمة/مسؤولية طالب الحالية (بتأكيد). args: {student?, title?, cls?}', src: () => '🎖️ إنهاء مهمة',
    async run(a) { const D = await asstClassroom(), byId = new Map(asstStudents().map(s => [String(s.id), s])), cls = asstCls(a.cls), t = asstTok(a.title || ''); let sid = '';
      if (a.student) { const m = asstFindStudent(a.student); if (m.length !== 1) return { error: m.length ? 'أكثر من طالب يطابق' : 'لم أجد الطالب' }; sid = String(m[0].id); }
      const L = (Array.isArray(D.roles) ? D.roles : []).filter(r => r && r.active && (!sid || String(r.studentId) === sid) && (!cls || r.cls === cls) && (!t.length || t.every(w => asstTok(r.title || '').some(y => y.includes(w)))));
      if (!L.length) return { error: 'لا توجد مهمة حالية تطابق' }; if (L.length > 1) return { error: 'أكثر من مهمة تطابق — حدّد', matches: L.map(r => r.title + ' — ' + r.cls + ' — ' + ((byId.get(String(r.studentId)) || {}).name || '')) };
      return { action: 'enddty', title: L[0].title, cls: L[0].cls || '', name: (byId.get(String(L[0].studentId)) || {}).name || '—', _rid: String(L[0].id) }; } },
  /* ── 🆕 الدفعة الثامنة: الحصة القادمة · لمحة فصل · المتأخرون في التسليم · اتجاه الدرجات · ملخص السلوك · طلبات الطلاب · تعديل الجدول ── */
  next_class: { d: 'الحصة الحالية أو القادمة اليوم (رقمها ووقتها وفصلها) مع لمحة عن الفصل: غياب الحصة الماضية والأنشطة المفتوحة. args: {}', src: () => '⏭️ الحصة القادمة',
    async run() { const sc = await ASST_TOOLS.schedule.run({ day: 'اليوم' }), now = new Date(Date.now() + 3 * 3600e3).toISOString().slice(11, 16), P = (sc.periods || []).filter(x => x.cls !== 'فراغ');
      if (!P.length) return { now, note: 'لا حصص لك اليوم في الجدول' }; const cur = P.find(x => x.from <= now && now < x.to), nx = P.find(x => x.from > now), p = cur || nx;
      if (!p) return { now, note: 'انتهت حصصك اليوم', last: P[P.length - 1] }; const snap = await ASST_TOOLS.class_snapshot.run({ cls: p.cls });
      return { now, state: cur ? 'الحصة الحالية' : 'الحصة القادمة', period: p.period, from: p.from, to: p.to, cls: p.cls, remaining_today: P.filter(x => x.from > p.from).length, class: snap }; } },
  class_snapshot: { d: 'لمحة سريعة عن فصل: عدد الطلاب، غياب اليوم، من لم ينجز الواجب اليوم، الأنشطة المفتوحة ونسبة تسليمها، متوسط الأنشطة، والمسؤولون. args: {cls}', src: a => '🔎 لمحة ' + (a.cls || ''),
    async run(a) { const cls = asstCls(a.cls); if (!cls) return { error: 'حدّد الفصل', classes: asstClsList() }; const D = await asstClassroom(), d = asstToday(), S = asstStudents().filter(s => String(s.cls || '') === cls), byId = new Map(S.map(s => [String(s.id), s]));
      const st = (M, id) => { const v = ((M || {})[d] || {})[id]; return v && (typeof v === 'string' ? v : v.status) || ''; }, open = [], pc = [];
      asstActs().forEach(h => { const P = asstPool(h).filter(s => String(s.cls || '') === cls); if (!P.length) return; const got = P.map(s => asstSub(h, s)).filter(Boolean); got.map(asstPct).filter(x => x != null).forEach(x => pc.push(x)); if (h.due && h.due >= d) open.push({ title: h.title, due: h.due, submitted: got.length, of: P.length }); });
      return { cls, students: S.length, absent_today: S.filter(s => ABSENT.includes(st(D.participation, String(s.id)))).map(s => s.name), homework_not_done_today: S.filter(s => st(D.homework, String(s.id)) === 'لم ينجز').map(s => s.name),
        open_activities: open.slice(0, 10), activities_average_pct: pc.length ? Math.round(pc.reduce((n, x) => n + x, 0) / pc.length) : null, duties: (Array.isArray(D.roles) ? D.roles : []).filter(r => r && r.active && r.cls === cls).map(r => ({ title: r.title, student: (byId.get(String(r.studentId)) || {}).name || '—' })) }; } },
  late_submissions: { d: 'من سلّم نشاطًا بعد موعده (ومتى)، ومن لم يسلّم بعد انتهاء الموعد. args: {activity:"جزء من العنوان" أو "آخر", cls?}', src: a => '⏰ المتأخرون — ' + (a._title || a.activity || ''),
    async run(a) { const m = asstFindAct(a.activity); if (m.length !== 1) return { error: m.length ? 'أكثر من نشاط يطابق' : 'لم أجد النشاط', matches: (m.length ? m : asstActs().slice(-10)).slice(0, 8).map(h => h.title) }; const h = m[0], cls = asstCls(a.cls); a._title = h.title;
      if (!h.due) return { title: h.title, note: 'لا موعد تسليم لهذا النشاط' }; const day = t => new Date(Number(t) + 3 * 3600e3).toISOString().slice(0, 10), P = asstPool(h).filter(s => !cls || String(s.cls || '') === cls);
      const late = P.map(s => ({ s, v: asstSub(h, s) })).filter(o => o.v && o.v.at && day(o.v.at) > h.due).map(o => ({ name: o.s.name, cls: o.s.cls || '', submitted: day(o.v.at), days_late: Math.round((Date.parse(day(o.v.at)) - Date.parse(h.due)) / 864e5) }));
      return { title: h.title, due: h.due, late: late.sort((x, y) => y.days_late - x.days_late), not_submitted: asstToday() > h.due ? P.filter(s => !asstSub(h, s)).map(s => s.name) : [], due_passed: asstToday() > h.due }; } },
  score_trend: { d: 'اتجاه مستوى الطلاب في الأنشطة: من تحسّن ومن تراجع (متوسط آخر 3 أنشطة مقابل الثلاثة قبلها). args: {cls?, student?, n?}', src: () => '📉 اتجاه الدرجات',
    async run(a) { const cls = asstCls(a.cls), L = asstActs().filter(h => !h.noGrade).slice().sort((x, y) => String(x.due || '').localeCompare(String(y.due || '')) || (x.at || 0) - (y.at || 0)); let pool = asstStudents().filter(s => !cls || String(s.cls || '') === cls);
      if (a.student) { pool = asstFindStudent(a.student); if (pool.length !== 1) return { error: pool.length ? 'أكثر من طالب يطابق' : 'لم أجد الطالب' }; }
      const avg = x => x.length ? Math.round(x.reduce((n, y) => n + y, 0) / x.length) : null, rows = pool.map(s => { const v = L.filter(h => asstPool(h).some(p => String(p.id) === String(s.id))).map(h => asstPct(asstSub(h, s) || {})).filter(x => x != null);
        const now = avg(v.slice(-3)), before = avg(v.slice(-6, -3)); return { name: s.name, cls: s.cls || '', recent_pct: now, before_pct: before, change: now != null && before != null ? now - before : null }; }).filter(r => r.change != null);
      const k = Math.max(1, Math.min(20, Number(a.n) || 5)); if (a.student) return rows[0] || { name: pool[0].name, note: 'لا تكفي الأنشطة للمقارنة (يلزم 4 على الأقل)' };
      return { cls: cls || 'كل الفصول', improved: rows.filter(r => r.change > 0).sort((x, y) => y.change - x.change).slice(0, k), declined: rows.filter(r => r.change < 0).sort((x, y) => x.change - y.change).slice(0, k) }; } },
  behavior_summary: { d: 'ملخص السلوك لفصل أو للكل خلال مدة: عدد الملاحظات الإيجابية والسلبية، وأكثر الطلاب تميزًا، وأكثرهم ملاحظات سلبية، وأكثر الأسباب. args: {cls?, days?:30}', src: () => '⭐ ملخص السلوك',
    async run(a) { const L = (await ASST_TOOLS.behavior_notes.run({ cls: a.cls, days: a.days || 30 })).notes || [], cnt = (t, k) => { const o = {}; L.filter(x => x.type === t).forEach(x => { o[x[k]] = (o[x[k]] || 0) + 1; }); return Object.entries(o).sort((p, q) => q[1] - p[1]).slice(0, 5).map(([v, n]) => ({ [k === 'name' ? 'name' : 'note']: v, count: n })); };
      return { days: Number(a.days) || 30, positive: L.filter(x => x.type === 'إيجابي').length, negative: L.filter(x => x.type === 'سلبي').length, top_positive: cnt('إيجابي', 'name'), top_negative: cnt('سلبي', 'name'), common_positive: cnt('إيجابي', 'note'), common_negative: cnt('سلبي', 'note'), note: L.length >= 40 ? 'محسوب من آخر 40 ملاحظة' : '' }; } },
  pending_requests: { d: 'طلبات الطلاب من المتجر التي تنتظر تنفيذك أنت (مثل رسالة شكر للأهل). args: {}', src: () => '📥 طلبات الطلاب',
    async run() { const R = typeof REQS !== 'undefined' && Array.isArray(REQS) ? REQS : []; return { count: R.length, requests: R.slice(0, 30).map(q => ({ student: q.name || '', request: asstCardName(q), date: q.at ? new Date(Number(q.at) + 3 * 3600e3).toISOString().slice(0, 10) : '' })), tip: R.length ? 'تُنفَّذ من «المتجر» في اللوحة' : '' }; } },
  set_schedule: { act: 1, d: 'تعديل الجدول: وضع فصل في حصة يوم معيّن، أو تفريغها (cls:"فراغ") — بتأكيد وتراجع. args: {day:"الأحد"…, period:رقم الحصة, cls}', src: () => '🗓️ تعديل الجدول',
    async run(a) { const N = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'], q = asstTok(String(a.day || '').replace(/^يوم\s+/, ''))[0] || '', dow = N.findIndex(n => { const t = asstTok(n)[0]; return t === q || t.replace(/^ال/, '') === q.replace(/^ال/, ''); });
      if (dow < 0) return { error: 'حدّد اليوم (الأحد إلى الخميس)' }; const D = await asstClassroom(), T = typeof tdTimes === 'function' ? tdTimes(D.schedule || {}) : [], per = Number(String(a.period ?? '').replace(/[٠-٩]/g, x => '٠١٢٣٤٥٦٧٨٩'.indexOf(x)));
      if (!T.some(t => t.n === per)) return { error: 'رقم الحصة غير موجود في جدولك', periods: T.map(t => t.n) }; const empty = /^(فراغ|فاضي|فاضيه|لا شيء|احذف)$/.test(String(a.cls || '').trim()), cls = empty ? '' : asstCls(a.cls);
      if (!empty && !cls) return { error: 'لم أعرف الفصل', classes: asstClsList() }; const prev = String((((D.schedule || {}).grid || {})[String(dow)] || {})[String(per)] || '').trim();
      return { action: 'sched', dayName: N[dow], period: per, cls, prev, _dow: String(dow) }; } },
  /* ── 🧰 أدوات الحصة (آمنة — تُفتح فورًا فوق الرصد) ── */
  pick_student: { d: 'اختيار طالب عشوائي ليجاوب (من الحاضرين، بلا تكرار حتى يمر الجميع اليوم) ويُعرض اسمه كبيرًا. args: {cls?}', src: () => '🎯 مين يجاوب',
    async run(a) { if (typeof ckPick !== 'function') return { error: 'أدوات الحصة غير محمّلة' }; await asstClassroom(); const cls = asstCls(a.cls) || ckCls(); CK.cls = cls; CK.tab = 'pick'; ckOpen('pick', cls);
      const s = ckPick(cls); return s ? { picked: s.name, cls: s.cls || '', say: '🎯 ' + s.name } : { error: 'لا طلاب حاضرون في ' + (cls || 'الفصل') }; } },
  class_timer: { d: 'تشغيل مؤقت للحصة بالدقائق (عدّ تنازلي كبير وتنبيه عند الانتهاء). args: {minutes}', src: () => '⏱️ مؤقت',
    async run(a) { if (typeof ckTimer !== 'function') return { error: 'أدوات الحصة غير محمّلة' }; const m = Number(String(a.minutes ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
      if (!(m > 0 && m <= 120)) return { error: 'حدّد المدة بالدقائق (1–120)' }; ckOpen('timer'); ckTimer(Math.round(m * 60)); return { started: m + ' دقيقة', say: '⏱️ بدأ مؤقت ' + m + ' دقيقة' }; } },
  make_groups: { d: 'تقسيم طلاب فصل (الحاضرين) إلى مجموعات: متوازنة بالمستوى أو عشوائية، وتُعرض على الشاشة. args: {cls?, n?:عدد المجموعات, mode?:"balanced"|"random"}', src: () => '👥 مجموعات',
    async run(a) { if (typeof ckGroups !== 'function') return { error: 'أدوات الحصة غير محمّلة' }; await asstClassroom(); try { await asstGrades(); } catch (e) {} const cls = asstCls(a.cls) || ckCls(); CK.cls = cls; ckOpen('groups', cls);
      const G = ckGroups(Number(a.n) || 4, a.mode === 'random' ? 'rand' : 'mix', cls); return { cls: cls || 'كل الفصول', groups: G.map((g, i) => ({ group: i + 1, students: g.map(s => s.name) })), say: '👥 ' + G.length + ' مجموعات لـ' + (cls || 'الفصل') }; } },
  open_page: { act: 1, get d() { return 'فتح صفحة في اللوحة أو طباعة كشف. page واحد من هذه بالضبط (ولا تختر الأقرب إن لم يطابق — اترك page فارغًا وضع اسم الصفحة كما قاله المعلم في query): ' + Object.entries(ASST_PAGES).map(([k, P]) => k + '=' + P[1].replace(/^\S+\s/, '')).join('، ') + '. student وreport يحتاجان student؛ activity يحتاج activity؛ exams يقبل sem/per/cls؛ grades يقبل cls وprint:true للطباعة. args: {page, query?, student?, activity?, cls?, sem?, per?, print?}'; }, src: () => '🧭 تنقّل',
    async run(a) { let pg = String(a.page || '').trim(); if (!ASST_PAGES[pg] || a.query) { const m = asstPageMatch(a.query || a.page); if (m) pg = m; else if (!ASST_PAGES[pg]) pg = ''; }
      const P = ASST_PAGES[pg]; if (!P) return { error: 'ما لقيت صفحة بهذا الاسم: «' + (a.query || a.page || '') + '»', pages: Object.values(ASST_PAGES).filter(x => x[2]).map(x => x[1]) };
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
/* 🧭 كل صفحات اللوحة كما في القائمة الجانبية + أقسام أدوات الفصل — مع أسمائها الشائعة. لا تخمين: ما لا يطابق يُرفض ويُعرض ما يوجد */
const ASST_PAGES = {
  home: ['dashboard', '🏠 اليوم', 'اليوم|الرئيسية|الصفحة الرئيسية|الرئيسيه|الهوم'], activities: ['hw', '📋 الأنشطة', 'الأنشطة|الانشطة|الواجبات|النشاطات'],
  projects: ['projects', '📁 المشاريع', 'المشاريع|مشاريع الطلاب'], live: ['live', '🎮 المسابقات المباشرة', 'المسابقات المباشرة|المسابقات|المسابقة|الحصة المباشرة|اللايف'],
  madrasati: ['madrasati', '📚 مدرستي', 'مدرستي|منصة مدرستي'], students: ['students', '👥 الطلاب', 'الطلاب|قائمة الطلاب|طلابي'],
  records: ['classtools:records', '🗂️ السجلات والحضور', 'السجلات|الحضور|الغياب|التحضير|سجل الحضور|الرصد|السجلات والحضور'],
  schedule: ['ct:schedule', '🗓️ الجدول والتذكيرات', 'الجدول|جدول الحصص|جدولي|الحصص|التذكيرات'], class_msgs: ['ct:messages', '💌 رسائل الحصة', 'رسائل الحصة'],
  plans: ['plans', '🩺 الخطط العلاجية', 'الخطط العلاجية|الخطط|العلاج|الخطة العلاجية'], duties: ['classtools:duties', '🎖️ مهام الطلاب', 'مهام الطلاب|المهام|المسؤوليات|مسؤوليات الطلاب'],
  exams: ['classtools:exams', '📝 دفتر الاختبارات', 'دفتر الاختبارات|الدفتر|درجات الاختبارات|رصد الاختبارات|الاختبارات'],
  paper_exams: ['exam', '🖨️ الاختبار الورقي', 'الاختبار الورقي|الاختبارات الورقية|التصحيح الآلي|طباعة اختبار|الورقي'],
  nafs: ['nafs', '🧭 نافس ونواتج التعلم', 'نافس|نواتج التعلم|نافس ونواتج التعلم'], reports: ['reports', '📑 الكشوف', 'الكشوف|الكشف|كشوف الدرجات'],
  grades: ['grades', '📊 تقارير الأنشطة', 'تقارير الأنشطة|درجات الأنشطة|تقرير الأنشطة|كشف الدرجات'],
  analysis: ['classtools:analysis', '📈 المستويات والمهارات', 'المستويات والمهارات'], levels: ['ct:levels', '📊 المستويات', 'المستويات|مستويات الطلاب'],
  skills: ['ct:skills', '🧭 خريطة المهارات', 'خريطة المهارات|المهارات'], classfile: ['classtools:classfile', '🏫 ملف الفصل', 'ملف الفصل'],
  portfolio: ['classtools:portfolio', '🧾 ملف الإنجاز', 'ملف الإنجاز|ملف الانجاز|الإنجاز'], messages: ['messages', '💬 رسائل الطلاب', 'رسائل الطلاب|الرسائل|راسل معلمك'],
  walls: ['walls', '🧱 حائط الإبداع', 'حائط الإبداع|الحائط|الحوائط|حائط الابداع'], certs: ['classtools:certs', '🏅 الشهادات', 'الشهادات|شهادات الشكر'],
  exam_shop: ['exam-shop', '🎓 متجر الدرجات', 'متجر الدرجات|المتجر'], settings: ['data', '⚙️ الإعدادات', 'الإعدادات|الاعدادات|الضبط'],
  ai_settings: ['data', '🤖 إعدادات الذكاء الاصطناعي', 'إعدادات الذكاء|إعدادات الذكاء الاصطناعي|مفاتيح الذكاء|الذكاء الاصطناعي'],
  student: [null, '👤 ملف الطالب', ''], report: [null, '🖨️ تقرير الطالب', ''], activity: ['hw', '📋 نشاط', ''] };
const asstPgTok = t => asstTok(t).filter(w => !['الي', 'علي', 'في', 'لي'].includes(w)).map(w => w.length > 4 ? w.replace(/^لل/, '') : w).map(w => w.length > 3 ? w.replace(/^(ال|بال|وال)/, '') : w);
function asstPageMatch(q) {   // ← مفتاح الصفحة أو '' (المطابقة الكاملة أولًا، ثم الأطول)
  const t = asstPgTok(String(q || '').replace(/^\s*(افتح|إفتح|فتح|افتحي|روح|ودّني|ودني|خذني|اعرض)\s+(لي\s+)?(صفحة|صفحه|قسم|شاشة|شاشه|تبويب)?\s*/, '').replace(/[؟?.!]+$/, ''));
  if (!t.length) return ''; let best = '', bl = 0;
  for (const [k, P] of Object.entries(ASST_PAGES)) for (const v of (P[2] || '').split('|').filter(Boolean)) { const w = asstPgTok(v);
    if (w.join(' ') === t.join(' ')) return k; if (w.length <= t.length && w.every(x => t.includes(x)) && w.length > bl && t.length - w.length <= 1) { best = k; bl = w.length; } }
  return best;
}
function asstGo(c, keepLive) {
  asstClose(keepLive);
  try {
    if (c.page === 'student') { ctOpenProfile(c._sid); return; }
    if (c.page === 'remedial') { goTab('hw'); setTimeout(() => { try { window.remedialHw(c._hid); } catch (e) {} }, 400); return; }
    if (c.page === 'plan') { if (c._sid) window.ctPlanStudent(c._sid); else window.ctGroupPlan(c._skill, c._ids); return; }
    if (c.page === 'report') { window.printStudentReport(c._sid); return; }
    if (c.page === 'activity') { goTab('hw'); setTimeout(() => { try { openHwForm(c._hid); } catch (e) {} }, 350); return; }
    if (c.page === 'exams') { window._ctExSem = String(c.sem || ''); window._ctExPer = String(c.per || ''); if (c.cls) window._ctExCls = c.cls; }
    const G = ASST_PAGES[c.page][0];
    if (G.startsWith('ct:')) { if (typeof ctGo === 'function') ctGo(G.slice(3)); }
    else goTab(G);
    if (c.page === 'ai_settings') setTimeout(() => { try { document.getElementById('ai-settings-provider').closest('.sheet').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }, 300);
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
/* 🗣️ «وضع المحادثة» أُزيل: المايك صار يسمع باستمرار (مثل الرصد)، وللمحادثة بالصوت «🎙️ المحادثة الحية» */
const asstConvOn = () => false;
function asstConvNext() { if (ASST_MIC) return; const p = document.getElementById('asst-panel'); if (asstConvOn() && p && p.classList.contains('on') && !ASST_MIC && !ASST_STT.on && !ASST_STT.busy && !ASST.busy) asstMic(true); }

/* ── تشغيل سؤال ── */
function asstFast(q) {   // ⚡ بلا ذكاء: «مين الغايب اليوم» و«افتح ملف فلان»
  const t = String(q || ''), pf = t.match(/^\s*(?:افتح|إفتح|فتح|افتحي|ودّني|ودني|روح)\s+(?:لي\s+)?ملف\s+(?:الطالب\s+)?(.+?)\s*[؟?.!]*\s*$/);
  if (pf && !/^(ال)?فصل(\s|$)/.test(pf[1])) return { tool: 'open_page', args: { page: 'student', student: pf[1] } };
  { const pm = /^\s*(افتح|إفتح|فتح|افتحي|روح|ودّني|ودني|خذني)\s/.test(t) ? asstPageMatch(t) : ''; if (pm) return { tool: 'open_page', args: { page: pm } }; }
  if (/^\s*(مين|من|منو)\s+(يجاوب|يجيب|يحل|يقرأ|يقرا|يطلع)|^\s*(اختر|اختار)\s+(طالب|احد)/.test(t)) return { tool: 'pick_student', args: {} };
  { const tm = t.match(/(?:مؤقت|تايمر)\s*(?:ل|لمدة)?\s*([0-9٠-٩]+)\s*(?:د|دق|دقيقة|دقايق|دقائق)?/); if (tm) return { tool: 'class_timer', args: { minutes: tm[1] } }; }
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
async function asstAsk(q, opt) {   // opt.live: من المحادثة الحية — بلا فقاعة سؤال مكررة وبلا قراءة صوتية (Gemini يتكلم)
  opt = opt || {}; q = String(q || '').trim(); if (!q || ASST.busy) return; if (!opt.live) { asstSpeakStop(); asstAudioUnlock(); }
  if (/^طريقة (المايك|الميكروفون)$/.test(q)) { let o = ''; try { o = localStorage.getItem('asst_stt') === 'on' ? '' : 'on'; if (o) localStorage.setItem('asst_stt', 'on'); else localStorage.removeItem('asst_stt'); } catch (e) {} asstMicStop();
    ASST.msgs.push({ me: 1, html: asstEsc(q) }, { html: o ? (asstSttProv() ? '🎙️ الطريقة الآن: <b>تسجيل ثم تفريغ</b> بمفتاح ' + asstEsc(asstSttProv()) + ' — اكتب «طريقة المايك» للرجوع' : '⚠️ تحتاج مفتاح Groq أو OpenAI أو Gemini لهذه الطريقة') : '🎤 الطريقة الآن: <b>مثل الرصد بالصوت</b> (استماع مستمر حتى الإيقاف)', src: [] }); asstPaint(); return; }
  if (/^(سجل|سجلّ) (المايك|الميكروفون)$/.test(q)) { ASST.msgs.push({ me: 1, html: asstEsc(q) }, { html: '<b>🩺 أحداث الميكروفون</b><br>' + (window.HWV ? `iPhone: ${HWV.ios ? 'نعم' : 'لا'} · الطريقة: ${asstUseStt() ? 'تسجيل + تفريغ (' + asstSttProv() + ')' : 'مثل الرصد (استماع مستمر)'} · الجلسة: ${HWV.active ? 'مفتوحة' : 'مقفلة'}<br>` : '') + (ASST_MLOG.map(asstEsc).join('<br>') || 'لا أحداث بعد'), src: [] }); asstPaint(); return; }
  { const S = asstShortcuts(), k = Object.keys(S).find(n => asstTok(n).join(' ') === asstTok(q.replace(/[؟?.!]+$/, '')).join(' ')); if (k) { ASST.msgs.push({ me: 1, html: '⚡ ' + asstEsc(k) }); q = S[k]; } }
  ASST.busy = true; if (!opt.live) ASST.msgs.push({ me: 1, html: asstEsc(q) }); const bot = { html: '<i class="asst-dots"><b></b><b></b><b></b></i>', src: [] }; ASST.msgs.push(bot); asstPaint();
  try {
    const fast = asstFast(q);
    if (fast) { const r = await ASST_TOOLS[fast.tool].run(fast.args); bot.src = [ASST_TOOLS[fast.tool].src(fast.args), '⚡ فوري بلا ذكاء'];
      if (fast.tool === 'open_page') { if (r.error) { bot.html = '⚠️ ' + asstEsc(r.error) + (r.matches ? '<br>' + r.matches.map(asstEsc).join('<br>') : ''); return; } bot.cards = [{ ...r, state: 'ask' }]; bot.text = 'فتحت لك ' + r.label + (r.name ? ' — ' + r.name : ''); bot.html = asstMd(bot.text); bot._auto = 1; return; }
      if (fast.tool === 'points') { bot.text = `رصيد ${r.name}: ${r.reward_points} نقطة`; bot.html = `رصيد <b>${asstEsc(r.name)}</b> <small>(${asstEsc(r.cls)})</small>: <b>${r.reward_points}</b> نقطة`; return; }
      if (r && (r.say || r.error)) { bot.text = r.say || r.error; bot.html = asstEsc(bot.text); return; }
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
اختر الأدوات التي تكفي للجواب (غالبًا واحدة أو اثنتان). «النقاط» = رصيد نقاط المكافآت (أداة points للعرض وadjust_points للإضافة والخصم)، وهي غير «الدرجات». «الكل … ما عدا فلان» = students:["الكل"] مع cls وexcept، وإن ذُكرت حالة للمستثنين فخطوة ثانية لهم. عند عرض رسائل الطلاب اقترح ردًا قصيرًا لكل رسالة. لديك أدوات تنفيذ واسعة (كلها بتأكيد المعلم) — استخدمها ولا تعتذر ما دامت أداة تغطي الطلب. لكن لا تخمّن: إن لم تطابق أداة أو صفحة الطلب بالضبط فلا تختر الأقرب، بل أخرج {"answer":"..."} توضح فيه ما فهمته وما المتاح. إن طلب المعلم تنفيذ شيء (رصد غياب/مشاركة/واجب، درجة اختبار، ملاحظة سلوك، تذكير، رسالة لولي أمر، مسودة نشاط، فتح صفحة أو طباعة) فاستخدم أداة التجهيز المناسبة — لن يُنفَّذ شيء إلا بعد تأكيده.
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
    if (draft) draft.text = String(ans.draft || draft.text || '');
    bot.text = String(ans.answer || ''); bot.html = asstMd(bot.text || (draft ? 'هذه المسودة — عدّلها كما تشاء:' : 'لم يصل جواب — جرّب مرة أخرى')); bot.src.push(asstUsed());
  } catch (e) { bot.html = '⚠️ ' + asstEsc(e && e.message || 'تعذّر'); bot.err = 1; }
  finally { ASST.busy = false; bot.src = bot.src.filter(Boolean); if (opt.live) { bot.src.push('🎙️ من المحادثة الحية'); asstPaint(); return; } asstPaint(); if (bot._auto) { delete bot._auto; setTimeout(() => asstAct(ASST.msgs.indexOf(bot), 0, 'do'), 600); } else if (!bot.err && ASST_MIC && !(window.HWV && HWV.ios) && asstTtsOn()) { const c = ASST_MIC; c.owner.on = false; asstSpeak(bot.text || bot.html).then(() => { if (ASST_MIC === c) HWV.go(c.owner); }); }
    else if (!bot.err) asstSpeak(bot.text || bot.html).then(asstConvNext, asstConvNext); else asstConvNext();
    if (ASST.queue) { const q2 = ASST.queue; ASST.queue = ''; setTimeout(() => asstAsk(q2), 50); } asstLive(); }
}
function asstUsed() { try { const j = JSON.parse(localStorage.getItem('ai_last_used') || 'null'); if (!j) return ''; const c = (typeof READING_AI_PROVIDERS !== 'undefined' && READING_AI_PROVIDERS[j.p]) || { name: j.p }; return '🤖 ' + c.name + ' · ' + j.m; } catch (e) { return ''; } }

/* ── بطاقات التأكيد: لا شيء يُكتب قبل «نفّذ» — والرصد يمر بطابور الرصد السريع نفسه (يحفظ بلا إنترنت ويُزامَن) ── */
const asstDay = d => !d ? '' : /^\d{4}-\d{2}-\d{2}$/.test(d) ? (d === asstToday() ? 'اليوم' : (typeof fmtExamDate === 'function' ? fmtExamDate(d) : d)) : String(d);
const ASST_ACTS = ['record', 'behavior', 'remind', 'draft', 'exam', 'activity', 'nav', 'points', 'grade', 'msg', 'test', 'cert', 'due', 'retry', 'reply', 'drafts', 'rem', 'shortcut', 'remdone', 'duty', 'contact', 'note', 'enddty', 'sched'];
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
/* 💡 بعد رصد غياب: من بلغ غيابه 3 فأكثر في 30 يومًا تُقترح له مسودة لولي أمره (بطاقة جديدة، لا يُرسل شيء) */
async function asstAbsenceHint(c) {
  try { const names = new Set(c.items.map(x => x.name)), r = await ASST_TOOLS.parent_drafts.run({ reason: 'absence', min: 3, days: 30 }); if (!r || r.error) return;
    const items = r.items.filter(x => names.has(x.name)); if (!items.length) return;
    ASST.msgs.push({ html: `💡 ${items.length === 1 ? 'هذا الطالب بلغ' : 'هؤلاء بلغوا'} 3 غيابات أو أكثر هذا الشهر — مسودة لولي الأمر جاهزة إن أردت:`, cards: [{ ...r, items, state: 'ask' }], src: ['💡 اقتراح بعد الرصد'] }); asstPaint(); } catch (e) {}
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
  else if (c.action === 'drafts') h += `<b>✉️ ${c.items.length} مسودة لأولياء الأمور — ${c.reason === 'missing' ? 'أنشطة لم تُسلَّم' : c.reason === 'report' ? 'تقرير الفترة' : 'غياب'}</b><div class="asst-meta">راجع كل رسالة وأرسلها بنفسك من واتساب</div>`
    + c.items.map((x, n) => `<div class="asst-pd"><b>${asstEsc(x.name)}</b><small>${asstEsc(x.cls)} · ${x.n}</small><textarea class="asst-draft" rows="4" oninput="ASST.msgs[${i}].cards[${j}].items[${n}].text=this.value">${asstEsc(x.text)}</textarea><button type="button" class="btn sm tick" onclick="asstAct(${i},${j},'wa:${n}')">💬 واتساب${x.sent ? ' ✓' : ''}</button></div>`).join('');
  else if (c.action === 'rem') h += `<b>⏰ ذكّرني: «${asstEsc(c.title)}»</b><div class="asst-meta">${c.days ? asstEsc(c.weeklyLabel) : asstEsc(asstDay(c.date))} · الساعة <bdi>${asstEsc(c.hm)}</bdi> — يظهر في «مهام اليوم»</div>`
    + (c.state === 'ask' ? btn('do', '✓ أضف التذكير', 'tick') + btn('no', 'إلغاء') : done ? `<span class="asst-ok">✓ أُضيف</span>${btn('undo', '↩ تراجع')}` : `<span class="asst-off">${c.state === 'undone' ? '↩ حُذف' : 'أُلغي'}</span>`);
  else if (c.action === 'contact' || c.action === 'note') h += (c.action === 'contact' ? `<b>📞 تواصل مع ولي الأمر — ${asstEsc(c.channel)}</b><div class="asst-meta">${asstEsc(c.reason)} · ${asstEsc(asstDay(c.date))}${c.result ? ' — ' + asstEsc(c.result) : ''}</div>` : `<b>🗒️ ملاحظة خاصة</b><div class="asst-msgprev">${asstEsc(c.text)}</div>`) + names(c.items) + bad
    + (c.state === 'ask' && c.items.length ? btn('do', '✓ سجّل', 'tick') + btn('no', 'إلغاء') : c.state === 'busy' ? '<span class="asst-meta">جارٍ الحفظ…</span>' : done ? `<span class="asst-ok">✓ سُجّل</span>${btn('undo', '↩ تراجع')}` : `<span class="asst-off">${c.state === 'undone' ? '↩ أُلغي التسجيل' : 'أُلغي'}</span>`);
  else if (c.action === 'enddty') h += `<b>🎖️ إنهاء «${asstEsc(c.title)}» — ${asstEsc(c.cls)}</b><div class="asst-meta">${asstEsc(c.name)}</div>` + (c.state === 'ask' ? btn('do', '✓ أنهِ المهمة', 'tick') + btn('no', 'إلغاء') : c.state === 'busy' ? '<span class="asst-meta">جارٍ الحفظ…</span>' : done ? '<span class="asst-ok">✓ أُنهيت</span>' : '<span class="asst-off">أُلغي</span>');
  else if (c.action === 'sched') h += `<b>🗓️ ${asstEsc(c.dayName)} — الحصة ${c.period}: <span class="asst-sc">${c.cls ? asstEsc(c.cls) : 'فراغ'}</span></b><div class="asst-meta">${c.prev ? 'كانت: ' + asstEsc(c.prev) : 'كانت فراغًا'}</div>`
    + (c.state === 'ask' ? btn('do', '✓ عدّل الجدول', 'tick') + btn('no', 'إلغاء') : done ? `<span class="asst-ok">✓ عُدّل</span>${btn('undo', '↩ تراجع')}` : `<span class="asst-off">${c.state === 'undone' ? '↩ أُرجع كما كان' : 'أُلغي'}</span>`);
  else if (c.action === 'duty') h += `<b>🎖️ ${asstEsc(c.title)} — ${asstEsc(c.cls)}</b><div class="asst-meta">${asstEsc(c.name)}${c.prev ? ' بدل ' + asstEsc(c.prev) : ''}</div>` + (c.state === 'ask' ? btn('do', '✓ عيّنه', 'tick') + btn('no', 'إلغاء') : c.state === 'busy' ? '<span class="asst-meta">جارٍ الحفظ…</span>' : done ? '<span class="asst-ok">✓ تم التعيين</span>' : '<span class="asst-off">أُلغي</span>');
  else if (c.action === 'remdone') h += `<b>⏰ «${asstEsc(c.title)}» (${asstEsc(c.at || '')}) ← ✓ تمّ</b>` + (c.state === 'ask' ? btn('do', '✓ علّمه تمّ', 'tick') + btn('no', 'إلغاء') : done ? '<span class="asst-ok">✓ تمّ</span>' : '<span class="asst-off">أُلغي</span>');
  else if (c.action === 'shortcut') h += c.command ? `<b>⚡ اختصار «${asstEsc(c.name)}»${c.had ? ' (يستبدل القديم)' : ''}</b><div class="asst-msgprev">${asstEsc(c.command)}</div><div class="asst-meta">اكتب «${asstEsc(c.name)}» أو اضغطه من الأزرار السريعة فيُنفَّذ هذا الأمر</div>`
      + (c.state === 'ask' ? btn('do', '✓ احفظ', 'tick') + btn('no', 'إلغاء') : done ? '<span class="asst-ok">✓ حُفظ</span>' : '<span class="asst-off">أُلغي</span>')
    : `<b>⚡ حذف الاختصار «${asstEsc(c.name)}»</b>` + (c.state === 'ask' ? btn('do', '🗑️ احذف', 'tick') + btn('no', 'إلغاء') : done ? '<span class="asst-ok">✓ حُذف</span>' : '<span class="asst-off">أُلغي</span>');
  return `<div class="asst-card ${c.state}">${h}</div>`;
}
function asstAct(i, j, k) {
  const c = ASST.msgs[i] && ASST.msgs[i].cards && ASST.msgs[i].cards[j]; if (!c) return;
  if (k === 'no') c.state = 'no';
  else if (c.action === 'record' && k === 'do' && c.state === 'ask') { qrDo(c.items.map(x => ({ k: 'st', m: c.m, d: c.date, sid: x._id, v: c.status })), `✓ رُصد ${ASST_ST[c.status] || c.status} لـ ${c.items.length}`); c.state = 'done'; if (c.status === 'غائب') setTimeout(() => asstAbsenceHint(c), 300); }
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
    D.reminders.push({ id: c._rid, kind: '', title: c.title, repeat: c.days ? 'weekly' : 'once', days: c.days || [], date: c.date, at: { t: 'time', hm: c.hm }, lead: 0 }); qrDo({ k: 'rem', v: JSON.parse(JSON.stringify(D.reminders)) }); try { thDraw(); } catch (e) {} c.state = 'done'; toast('⏰ أُضيف التذكير', 'good'); }
  else if (c.action === 'rem' && k === 'undo' && c.state === 'done') { const D = CT_DATA || {}; D.reminders = (D.reminders || []).filter(x => x && x.id !== c._rid); qrDo({ k: 'rem', v: JSON.parse(JSON.stringify(D.reminders)) }); try { thDraw(); } catch (e) {} c.state = 'undone'; }
  else if ((c.action === 'contact' || c.action === 'note') && (k === 'do' && c.state === 'ask' || k === 'undo' && c.state === 'done')) { const col = c.action === 'contact' ? 'contacts' : 'notes'; c.state = 'busy'; asstPaint();
    if (k === 'do') c._ids = c.items.map(() => Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    ctSave(D => { D[col] = Array.isArray(D[col]) ? D[col] : []; if (k === 'undo') { const ids = new Set(c._ids || []); D[col] = D[col].filter(x => !(x && ids.has(String(x.id)))); return; }
      c.items.forEach((x, n) => D[col].push(col === 'contacts' ? { id: c._ids[n], studentId: x._id, date: c.date, channel: c.channel, reason: c.reason, result: c.result, at: Date.now() + n } : { id: c._ids[n], studentId: x._id, text: c.text, at: Date.now() + n })); })
      .then(() => { c.state = k === 'do' ? 'done' : 'undone'; if (k === 'do') toast(col === 'contacts' ? '📞 سُجّل التواصل' : '🗒️ أُضيفت الملاحظة', 'good'); }, () => { c.state = k === 'do' ? 'ask' : 'done'; toast('تعذّر الحفظ', 'bad'); }).finally(asstPaint); return; }
  else if (c.action === 'enddty' && k === 'do' && c.state === 'ask') { c.state = 'busy'; asstPaint(); ctSave(D => { const r = (Array.isArray(D.roles) ? D.roles : []).find(x => x && String(x.id) === c._rid); if (r) { r.active = false; r.to = asstToday(); } })
    .then(() => { c.state = 'done'; toast('أُنهيت المهمة', 'good'); }, () => { c.state = 'ask'; toast('تعذّر الحفظ', 'bad'); }).finally(asstPaint); return; }
  else if (c.action === 'sched' && (k === 'do' && c.state === 'ask' || k === 'undo' && c.state === 'done')) { const D = CT_DATA || (CT_DATA = {}); D.schedule = D.schedule && typeof D.schedule === 'object' ? D.schedule : {}; const g = D.schedule.grid = D.schedule.grid && typeof D.schedule.grid === 'object' ? D.schedule.grid : {}, row = g[c._dow] = g[c._dow] || {}, v = k === 'do' ? c.cls : c.prev;
    if (v) row[String(c.period)] = v; else delete row[String(c.period)]; qrDo({ k: 'sch', v: JSON.parse(JSON.stringify(D.schedule)) }); try { thDraw(); } catch (e) {} c.state = k === 'do' ? 'done' : 'undone'; if (k === 'do') toast('🗓️ عُدّل الجدول', 'good'); }
  else if (c.action === 'duty' && k === 'do' && c.state === 'ask') { c.state = 'busy'; asstPaint(); ctSave(D => { const d = asstToday(); D.roles = Array.isArray(D.roles) ? D.roles : []; D.roles.forEach(r => { if (r && r.active && r.cls === c.cls && r.title === c.title) { r.active = false; r.to = d; } }); D.roles.unshift({ id: Date.now().toString(36), cls: c.cls, title: c.title, studentId: c._sid, from: d, to: '', active: true }); })
    .then(() => { c.state = 'done'; toast('🎖️ عُيّن ' + c.name, 'good'); }, () => { c.state = 'ask'; toast('تعذّر الحفظ', 'bad'); }).finally(asstPaint); return; }
  else if (c.action === 'remdone' && k === 'do' && c.state === 'ask') { c.state = 'done'; try { tdRemDone(c._rid); } catch (e) {} }
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
function asstLive() { const e = document.getElementById('asst-live'); if (!e) return; if (typeof LIVE !== 'undefined' && (LIVE.on || LIVE.state === 'connect')) return; const conv = asstConvOn();
  e.innerHTML = ASST_STT.busy ? '⏳ أفرّغ كلامك…' : ASST_STT.on ? `<span class="dot"></span> ${conv ? '🗣️ وضع المحادثة — ' : ''}${ASST_STT.heard ? 'أسمعك… أرسل لحالي لما تسكت' : 'تكلّم الحين…'} أو اضغط 🎤 للإرسال` : ASST_MIC ? `<span class="dot"></span> ${ASST.busy ? 'أجهّز الجواب… وأنا أسمعك' : 'أسمعك — كل جملة أرسلها لما تسكت، وأظل أسمع'}. للإيقاف اضغط 🎤`
    : conv && ASST.waitTap ? '👆 اضغط 🎤 لتكمل المحادثة — الآيفون يحتاج لمسة بعد ما يقفل السماع' : conv ? '🗣️ وضع المحادثة مفتوح: اضغط 🎤 مرة وحدة وتكلم — أرد وأرجع أسمعك لحالي. للإيقاف اضغط 🗣️' : '';
  const mb = document.getElementById('asst-mic'); if (mb) mb.classList.toggle('nudge', !!(conv && ASST.waitTap && !ASST_MIC));
  e.hidden = !e.innerHTML; }
const ASST_MLOG = [];
function asstMicLog(x) { ASST_MLOG.push(new Date().toTimeString().slice(0, 8) + ' ' + x); if (ASST_MLOG.length > 40) ASST_MLOG.shift(); }
function asstMicStop() { if (ASST_STT.on) asstSttStop(false); const c = ASST_MIC; if (!c) return; ASST_MIC = null; clearTimeout(c.t); try { HWV.mute(c.owner); } catch (e) {} const b = document.getElementById('asst-mic'); if (b) b.classList.remove('on'); asstLive(); }
/* 🎙️ على iPhone: التعرّف المدمج (Web Speech) يعطي جلسة واحدة حيّة للصفحة — تتجمّد بعد السكوت، وكل جلسة بعدها صمّاء (ثبت من «سجل المايك»).
   البديل الجذري: تسجيل الصوت نفسه من الميكروفون (يعمل كل مرة)، ثم تفريغه بمفتاح الذكاء الذي عندك: Groq (Whisper) أو OpenAI أو Gemini.
   يتوقف التسجيل وحده بعد سكوتك ثانية ونصف، أو بضغطة 🎤. الصوت يُرسل لمزوّدك فقط مثل نص السؤال تمامًا، ولا يُحفظ. */
const ASST_STT = { ctx: null, stream: null, node: null, src: null, buf: [], on: false, busy: false, heard: false, t0: 0, loud: 0, floor: [], thr: 0.02, auto: false };
function asstSttProv() { for (const p of ['groq', 'openai', 'gemini']) { try { if (readingAIGetKey(p)) return p; } catch (e) {} } return ''; }
function asstUseStt() { let o = ''; try { o = localStorage.getItem('asst_stt') || ''; } catch (e) {} if (o === 'off') return false;
  return o === 'on' && !!asstSttProv() && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
async function asstSttMic(auto) {
  const S = ASST_STT; if (S.busy) return;
  if (S.on) { asstSttStop(true); return; }   // ضغطة ثانية: أرسل الآن
  if (!auto) { try { if (!S.ctx) S.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    if (asstTtsOn() && window.speechSynthesis) { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {} }   // يفتح القراءة الصوتية لاحقًا (iPhone يشترط لمسة)
    asstAudioUnlock(); }
  try { if (!S.ctx) S.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (S.ctx.state === 'suspended') await S.ctx.resume();
    S.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { asstMicLog('stt: ' + (e && e.name || e)); if (auto) { ASST.waitTap = 1; asstLive(); return; } toast(e && e.name === 'NotAllowedError' ? 'اسمح للمتصفح باستخدام الميكروفون' : 'تعذّر تشغيل الميكروفون', 'bad'); return; }
  S.src = S.ctx.createMediaStreamSource(S.stream); S.node = S.ctx.createScriptProcessor(4096, 1, 1);
  Object.assign(S, { buf: [], heard: false, t0: Date.now(), loud: Date.now(), floor: [], thr: 0.02, on: true, auto: !!auto }); ASST.waitTap = 0;
  S.node.onaudioprocess = e => { if (!S.on) return; const d = e.inputBuffer.getChannelData(0); S.buf.push(new Float32Array(d));
    let q = 0; for (let i = 0; i < d.length; i += 2) q += d[i] * d[i]; const rms = Math.sqrt(q / (d.length / 2)), now = Date.now();
    if (S.floor.length < 4) { S.floor.push(rms); S.thr = Math.max(0.012, Math.min(0.08, (S.floor.reduce((a, b) => a + b, 0) / S.floor.length) * 2.5)); return; }   // ضجيج المكان أول ثلث ثانية
    if (rms > S.thr) { S.loud = now; if (!S.heard) { S.heard = true; asstMicLog('stt: بدأ الكلام'); asstLive(); } }
    if (S.heard && now - S.loud > 1500) asstSttStop(true); else if (!S.heard && now - S.t0 > (S.auto ? 12000 : 10000)) asstSttStop(false); else if (now - S.t0 > 45000) asstSttStop(true); };
  S.src.connect(S.node); S.node.connect(S.ctx.destination);
  const b = document.getElementById('asst-mic'); if (b) b.classList.add('on'); asstMicLog('stt: يسجّل (' + asstSttProv() + ')' + (auto ? ' تلقائي' : '')); asstLive();
}
async function asstSttStop(send) {
  const S = ASST_STT; if (!S.on) return; S.on = false;
  try { S.node.onaudioprocess = null; S.node.disconnect(); S.src.disconnect(); } catch (e) {} try { S.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
  const b = document.getElementById('asst-mic'); if (b) b.classList.remove('on');
  if (!send || !S.heard) { asstMicLog('stt: توقف بلا كلام'); if (S.auto && asstConvOn()) ASST.waitTap = 1; asstLive(); return; }
  S.busy = true; asstLive(); const i = document.getElementById('asst-q'); if (i) i.placeholder = '⏳ أفرّغ كلامك…';
  try { const t = (await asstTranscribe(asstWav(S.buf, S.ctx.sampleRate))).trim(); asstMicLog('stt: نص ' + t.length);
    S.busy = false; if (i) i.placeholder = 'اسأل عن طلابك…'; asstLive();
    if (t && /[\p{L}]/u.test(t)) asstAsk(t); else { toast('ما وصلني كلام واضح — جرّب مرة ثانية'); asstConvNext(); } }
  catch (e) { S.busy = false; if (i) i.placeholder = 'اسأل عن طلابك…'; asstLive(); asstMicLog('stt: خطأ ' + (e && e.message)); toast('تعذّر تفريغ الكلام: ' + (e && e.message || ''), 'bad'); }
}
/* PCM ← WAV أحادي 16 كيلوهرتز (صغير ومقبول عند كل المزوّدين) */
function asstWav(chunks, sr) {
  const n = chunks.reduce((t, c) => t + c.length, 0), all = new Float32Array(n); let o = 0; chunks.forEach(c => { all.set(c, o); o += c.length; });
  const r = sr / 16000, m = Math.floor(n / r), pcm = new Int16Array(m);
  for (let k = 0; k < m; k++) { const a = Math.floor(k * r), z = Math.min(n, Math.floor((k + 1) * r)); let s = 0; for (let j = a; j < z; j++) s += all[j]; const v = Math.max(-1, Math.min(1, s / Math.max(1, z - a))); pcm[k] = v < 0 ? v * 0x8000 : v * 0x7fff; }
  const buf = new ArrayBuffer(44 + pcm.length * 2), dv = new DataView(buf), w = (p, s) => { for (let k = 0; k < s.length; k++) dv.setUint8(p + k, s.charCodeAt(k)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, pcm.length * 2, true);
  new Int16Array(buf, 44).set(pcm); return new Blob([buf], { type: 'audio/wav' });
}
async function asstTranscribe(wav) {
  const p = asstSttProv(), key = readingAIGetKey(p); if (!p) throw new Error('لا يوجد مفتاح Groq أو OpenAI أو Gemini');
  if (p === 'gemini') { const b64 = await new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1] || ''); fr.onerror = no; fr.readAsDataURL(wav); });
    let m = ''; try { m = (typeof aiRoute === 'function' ? aiRoute('assistant') : {}).p === 'gemini' ? aiRoute('assistant').m : ''; } catch (e) {} m = m || 'gemini-3.5-flash-lite';
    const r = await fetch(`${READING_AI_PROVIDERS.gemini.baseUrl}/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'فرّغ هذا التسجيل الصوتي حرفيًا كما قيل (عربي وقد يتخلله إنجليزي). أخرج النص فقط بلا أي تعليق. وإن لم يكن فيه كلام فأخرج نصًا فارغًا.' }, { inline_data: { mime_type: 'audio/wav', data: b64 } }] }] }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error && j.error.message || 'Gemini ' + r.status).slice(0, 120));
    return ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(x => x.text || '').join(' '); }
  const url = p === 'groq' ? 'https://api.groq.com/openai/v1/audio/transcriptions' : 'https://api.openai.com/v1/audio/transcriptions';
  const models = p === 'groq' ? ['whisper-large-v3-turbo', 'whisper-large-v3'] : ['gpt-4o-mini-transcribe', 'whisper-1']; let last = '';
  for (const model of models) { const f = new FormData(); f.append('file', wav, 'speech.wav'); f.append('model', model); f.append('language', 'ar'); f.append('response_format', 'json');
    const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: f }), j = await r.json().catch(() => ({}));
    if (r.ok) return String(j.text || ''); last = (j.error && j.error.message || (p + ' ' + r.status)).slice(0, 120); if (![400, 404].includes(r.status)) break; }
  throw new Error(last);
}
/* سجل أحداث الصوت نفسه (هل يصل صوت؟ متى انتهت الجلسة؟) — يظهر بـ«سجل المايك» */
let ASST_RECHOOK = null;
function asstRecHook() { try { const r = HWV.instance(false); if (!r || r === ASST_RECHOOK) return; ASST_RECHOOK = r;
  ['start', 'end', 'audiostart', 'audioend', 'speechstart', 'speechend', 'nomatch'].forEach(ev => r.addEventListener(ev, () => { asstMicLog('rec:' + ev); if (ev === 'start') ASST.recFinal = 0; if (ev === 'end') ASST.recFinal = 0; }));
  r.addEventListener('error', e => asstMicLog('rec:error ' + (e && e.error))); r.addEventListener('result', e => { try { const x = e.results[e.results.length - 1]; ASST.recFinal = x.isFinal ? 1 : 0; asstMicLog(`rec:result #${e.resultIndex}/${e.results.length} ${String(x[0].transcript).trim().split(/\s+/).length}w${x.isFinal ? ' final' : ''}`); } catch (er) {} });
  HWV.onReset = i => asstMicLog('reset خانة ' + i); } catch (e) {} }
/* 🎤 مثل «الرصد بالصوت» تمامًا (يعمل دائمًا على iPhone): ضغطة تفتح الاستماع ويبقى مفتوحًا حتى ضغطة الإيقاف —
   كل جملة (بعد سكوت قصير) تُرسل سؤالًا والاستماع مستمر. لا كتم ولا إعادة فتح بين الأسئلة (هذا ما كان يجمّد iPhone) */
function asstMic(auto) {
  if (asstUseStt()) return asstSttMic(auto === true);
  if (!window.HWV || !HWV.sup) { toast('الكلام غير مدعوم في هذا المتصفح', 'bad'); return; }
  if (ASST_MIC) { if (auto === true) return; const c = ASST_MIC; c.flush(); asstMicStop(); asstMicLog('tap: إيقاف'); return; }   // ضغطة الإيقاف (ويُرسل ما قيل)
  if (auto === true && HWV.ios && !HWV.active) { asstMicLog('auto: الجلسة مقفلة ← تنتظر لمسة'); ASST.waitTap = 1; asstLive(); return; }
  ASST.waitTap = 0;
  if (!(window.HWV && HWV.ios && HWV.active)) { asstSpeakStop(); asstAudioUnlock(); }
  const i = document.getElementById('asst-q'), b = document.getElementById('asst-mic'), c = { done: '', pend: '', t: 0 };
  const show = () => { if (i) i.value = (c.done + ' ' + c.pend).replace(/\s+/g, ' ').trim(); };
  c.flush = () => { clearTimeout(c.t); const t = (c.done + ' ' + c.pend).replace(/\s+/g, ' ').trim(); c.done = c.pend = ''; if (i) i.value = ''; if (!t) return; asstMicLog('send ' + t.length);
    if (ASST.busy) ASST.queue = ((ASST.queue || '') + ' ' + t).trim(); else asstAsk(t); };
  c.owner = { on: false,
    onText: (t, final) => { c.heard = 1; clearTimeout(c.t); if (final) { c.done += ' ' + t; c.pend = ''; c.t = setTimeout(c.flush, 1200); } else c.pend = t; show(); asstLive(); },
    onStop: why => { asstMicLog('stop:' + (why || '')); if (ASST_MIC === c) { c.flush(); asstMicStop(); if (why === 'ended') { ASST.waitTap = 1; asstLive(); } } },
    onError: err => { asstMicLog('err:' + err); if (err === 'not-allowed' || err === 'service-not-allowed') { toast('اسمح للمتصفح باستخدام الميكروفون', 'bad'); asstMicStop(); } } };
  ASST_MIC = c; if (b) b.classList.add('on'); asstMicLog((auto === true ? 'auto ' : 'tap ') + 'go active=' + HWV.active);
  setTimeout(asstLive, 0);
  const ok = HWV.go(c.owner); asstRecHook();
  if (!ok) { asstMicStop(); toast('تعذّر تشغيل الميكروفون — أغلق المتصفح وافتحه ثم حاول', 'bad'); }
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
const ASST_SUGG = ['☀️ ملخص اليوم', 'وش جدولي اليوم؟', 'مين الغايب اليوم؟', 'مين أعلى درجة في آخر نشاط؟', 'مين ما سلّم آخر نشاط؟', 'أضعف ٥ طلاب في الفترة', 'أضعف المهارات في فصولي', 'متوسط آخر اختبار', 'أكثر الطلاب غيابًا هذا الشهر', 'مين ما سوّى الواجب اليوم؟', 'وش ينتظر تصحيحي؟', 'مين أستحق شهادة شكر؟', 'مين أقل الطلاب مشاركة هالشهر؟', 'أيام ما رصدتها', 'وش حصتي الجاية؟', 'مين تحسّن ومين تراجع؟'];
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
      <button type="button" class="asst-clear" id="asst-tts" onclick="asstTtsToggle()" title="قراءة الأجوبة بصوت" aria-label="قراءة الأجوبة بصوت">${asstTtsOn() ? '🔊' : '🔇'}</button>${typeof liveSup === 'function' && liveSup() ? '<button type="button" id="asst-livebtn" onclick="liveToggle()" title="محادثة حية بالصوت (Gemini Live — تجريبية)" aria-label="محادثة حية">🎙️</button>' : ''}<button type="button" onclick="asstForget()" title="محادثة جديدة (ينسى المحادثة السابقة)" aria-label="محادثة جديدة">↺</button><button type="button" class="asst-x" onclick="asstClose()" aria-label="إغلاق">✕</button></div>
      <div class="asst-msgs" id="asst-msgs" aria-live="polite"></div>
      <div class="asst-sugg">${asstSuggHTML()}</div>
      <div class="asst-live" id="asst-live" hidden></div>
      <form class="asst-in" onsubmit="event.preventDefault();const i=document.getElementById('asst-q');asstAsk(i.value);i.value=''"><textarea id="asst-q" rows="1" placeholder="اسأل عن طلابك…" autocomplete="off"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();this.form.requestSubmit()}"></textarea>${ASST_SR || (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ? '<button type="button" id="asst-mic" class="asst-mic" onclick="asstMic()" title="تكلّم" aria-label="تكلّم">🎤</button>' : ''}<button type="submit" id="asst-send" class="btn tick sm">إرسال</button></form>`;
    document.body.appendChild(p);
    p.addEventListener('keydown', e => { if (e.key === 'Escape') asstClose(); });
  }
  asstLoadHist(); p.classList.add('on'); document.body.classList.add('asst-open'); asstPaint(); asstLive();
  let seen = ''; try { seen = localStorage.getItem('asst_brief_seen') || ''; } catch (e) {}
  if (seen !== asstToday() && !ASST.msgs.length) asstShowBrief();
  const b = document.getElementById('asst-btn'); if (b) b.classList.remove('has-brief');
  setTimeout(() => { try { document.getElementById('asst-q').focus(); } catch (e) {} }, 60);
}
function asstClose(keepLive) { if (!keepLive) { asstSpeakStop(); asstMicStop(); try { if (typeof liveStop === 'function' && (LIVE.on || LIVE.state)) liveStop(); } catch (e) {} } const p = document.getElementById('asst-panel'); if (p) p.classList.remove('on'); document.body.classList.remove('asst-open'); }

async function asstShowBrief() { try { localStorage.setItem('asst_brief_seen', asstToday()); } catch (e) {} const m = { html: '<i class="asst-dots"><b></b><b></b><b></b></i>', src: [] }; ASST.msgs.push(m); asstPaint();
  try { Object.assign(m, asstBriefMsg(await asstBrief())); } catch (e) { m.html = '⚠️ تعذّر تجهيز الملخص'; } asstPaint(); }
