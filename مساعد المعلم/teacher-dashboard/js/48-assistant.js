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
const asstStrip = o => JSON.parse(JSON.stringify(o, (k, v) => (k[0] === '_' ? undefined : v)));   // لا معرّفات ولا قيم داخلية للمزوّد
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
  q = String(q || '').trim(); if (!q || ASST.busy) return; asstSpeakStop(); asstAudioUnlock();
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
اختر أداة أو أداتين تكفيان للجواب. إن طلب المعلم تنفيذ شيء (رصد غياب/مشاركة/واجب، ملاحظة سلوك، تذكير، رسالة لولي أمر) فاستخدم أداة التجهيز المناسبة — لن يُنفَّذ شيء إلا بعد تأكيده.
أخرج JSON فقط: {"calls":[{"tool":"اسم","args":{...}}]}
وإن كان السؤال لا يحتاج بيانات (تحية أو سؤال عام) أخرج {"answer":"ردّك"}.`, new AbortController().signal)) || {};
    if (plan.answer && !(Array.isArray(plan.calls) && plan.calls.length)) { bot.html = asstMd(plan.answer); bot.text = plan.answer; bot.src = [asstUsed()]; return; }
    const calls = (Array.isArray(plan.calls) ? plan.calls : []).filter(c => c && ASST_TOOLS[c.tool]).slice(0, 3);
    if (!calls.length) throw new Error('ما فهمت السؤال — جرّب صياغة أوضح، مثل: «مين أعلى درجة في آخر نشاط؟»');
    const results = []; for (const c of calls) { const a = c.args && typeof c.args === 'object' ? c.args : {}; results.push({ tool: c.tool, result: await ASST_TOOLS[c.tool].run(a) }); bot.src.push(ASST_TOOLS[c.tool].src(a)); }
    bot.cards = results.map(r => r.result).filter(r => r && ['record', 'behavior', 'remind', 'draft'].includes(r.action)).map(r => ({ ...r, state: 'ask' }));
    const info = results.filter(r => !(r.result && ['record', 'behavior', 'remind'].includes(r.result.action))), draft = bot.cards.find(c => c.action === 'draft');
    if (!info.length) { bot.text = bot.cards.length ? 'راجع ثم اضغط «نفّذ»:' : 'لم أجد ما أجهّزه.'; bot.html = asstMd(bot.text); return; }
    const ans = aiSafeJson(await readingAICall(R.p, R.m, `${asstIntro()}
سؤال المعلم: ${q}
نتائج الأدوات من بياناته:
${JSON.stringify(asstStrip(info)).slice(0, 14000)}
أجب المعلم بالعربية بإيجاز ودقة من هذه النتائج فقط — لا تخترع أسماء أو أرقامًا. استخدم **عريض** للأهم وقائمة بـ «- » عند الحاجة. إن كانت القائمة طويلة اذكر أهمها والعدد. إن كان في النتائج error فاشرحه واقترح صياغة.
${draft ? 'واكتب في draft رسالة مهذبة قصيرة لولي أمر الطالب بالعربية الفصحى المبسطة عن الموضوع، مبنية على بياناته فقط، تبدأ بـ «السلام عليكم ورحمة الله» وتنتهي بتوقيع «معلم المادة».\nأخرج JSON فقط: {"answer":"...","draft":"..."}' : 'أخرج JSON فقط: {"answer":"..."}'}`, new AbortController().signal)) || {};
    if (draft) draft.text = String(ans.draft || '');
    bot.text = String(ans.answer || ''); bot.html = asstMd(bot.text || (draft ? 'هذه المسودة — عدّلها كما تشاء:' : 'لم يصل جواب — جرّب مرة أخرى')); bot.src.push(asstUsed());
  } catch (e) { bot.html = '⚠️ ' + asstEsc(e && e.message || 'تعذّر'); bot.err = 1; }
  finally { ASST.busy = false; bot.src = bot.src.filter(Boolean); asstPaint(); if (!bot.err) asstSpeak(bot.text || bot.html); }
}
function asstUsed() { try { const j = JSON.parse(localStorage.getItem('ai_last_used') || 'null'); if (!j) return ''; const c = (typeof READING_AI_PROVIDERS !== 'undefined' && READING_AI_PROVIDERS[j.p]) || { name: j.p }; return '🤖 ' + c.name + ' · ' + j.m; } catch (e) { return ''; } }

/* ── بطاقات التأكيد: لا شيء يُكتب قبل «نفّذ» — والرصد يمر بطابور الرصد السريع نفسه (يحفظ بلا إنترنت ويُزامَن) ── */
const ASST_ST = { 'غائب': '🚫 غياب', 'غائب بعذر': '🚫 غياب بعذر', 'شارك': '✅ شارك', 'لم يشارك': '✋ لم يشارك', 'أنجز': '📗 أنجز الواجب', 'لم ينجز': '📕 لم ينجز الواجب', 'معذور': '🕊️ معذور في الواجب' };
function asstCardHTML(c, i, j) {
  const btn = (k, t, cls) => `<button type="button" class="btn ${cls || 'ghost'} sm" onclick="asstAct(${i},${j},'${k}')">${t}</button>`;
  const names = L => `<ul class="asst-names">${L.map(x => `<li>${asstEsc(x.name)}<small>${asstEsc(x.cls)}</small></li>`).join('')}</ul>`;
  const bad = c.unresolved && c.unresolved.length ? `<div class="asst-bad">⚠️ لم أحدّد: ${c.unresolved.map(u => `«${asstEsc(u.q)}»${u.matches.length ? ' (' + u.matches.map(asstEsc).join('، ') + ')' : ''}`).join(' · ')} — اكتب الاسم أطول</div>` : '';
  const done = c.state === 'done', off = c.state === 'no' || c.state === 'undone';
  let h = '';
  if (c.action === 'record') h = `<b>📝 ${asstEsc(ASST_ST[c.status] || c.status)} · ${c.date === asstToday() ? 'اليوم' : asstEsc(c.date)}</b>${names(c.items)}${bad}`
    + (c.state === 'ask' && c.items.length ? btn('do', `✓ نفّذ (${c.items.length})`, 'tick') + btn('no', 'إلغاء') : done ? `<span class="asst-ok">✓ رُصد</span>${btn('undo', '↩ تراجع')}` : `<span class="asst-off">${c.state === 'undone' ? '↩ تُراجع عنه' : 'أُلغي'}</span>`);
  else if (c.action === 'behavior') h = `<b>${c.type === 'positive' ? '🌟' : '⚠️'} ملاحظة ${c.type === 'positive' ? 'إيجابية' : 'سلبية'}: «${asstEsc(c.note)}»</b>${names(c.items)}${bad}`
    + (c.state === 'ask' && c.items.length ? btn('do', '✓ نفّذ', 'tick') + btn('no', 'إلغاء') : done ? `<span class="asst-ok">✓ سُجّلت</span>${btn('undo', '↩ تراجع')}` : `<span class="asst-off">${c.state === 'undone' ? '↩ تُراجع عنها' : 'أُلغيت'}</span>`);
  else if (c.action === 'remind') h = `<b>📨 تذكير «${asstEsc(c.title)}»</b><div class="asst-meta">${c.missing} لم يسلّموا — تراجع القائمة والرسالة ثم ترسل من شاشة التذكير الجماعي</div>` + (off ? '<span class="asst-off">أُلغي</span>' : btn('do', '📨 افتح التذكير الجماعي', 'tick') + (done ? '' : btn('no', 'إلغاء')));
  else if (c.action === 'draft') h = `<b>✉️ مسودة لولي أمر ${asstEsc(c.student && c.student.name || '')}</b><textarea class="asst-draft" rows="7" oninput="ASST.msgs[${i}].cards[${j}].text=this.value">${asstEsc(c.text || '')}</textarea>`
    + btn('copy', '📋 نسخ', 'tick') + btn('wa', '💬 واتساب');
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
const ASST_SUGG = ['☀️ ملخص اليوم', 'مين الغايب اليوم؟', 'مين أعلى درجة في آخر نشاط؟', 'مين ما سلّم آخر نشاط؟', 'أضعف ٥ طلاب في الفترة', 'أكثر الطلاب غيابًا هذا الشهر'];
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
