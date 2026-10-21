'use strict';
/* 🏛️ تصدير «الكشف الشامل لأعمال السنة» إلى نظام نور (40 + 20 = 60) مع جبر الكسر.
   مصدر واحد للحقيقة: نفس ما يعرضه renderComprehensive() — درجات الخادم (loadServerGrades) للمشاركة
   والواجب والسلوك والاختبار، ودرجة الأنشطة من compActivitiesForStudent/compSubmissionCount بحدود الفترة نفسها.
   الطالب الذي لم تصل بياناته من الخادم لا يُصدَّر ولا يُرصد (الصفر في نور يعني «رسب»). */
const NOOR_ROUND_KEY = 'noor_exp_round_v1', NOOR_VIEW_KEY = 'noor_exp_view_v1', NOOR_FILL_KEY = 'noor_exp_fill_v1';
const NOOR_ROUNDS = [['ceil', 'جبر الكسر للأعلى (لصالح الطالب)'], ['round', 'تقريب لأقرب عدد صحيح'], ['half', 'تقريب لأقرب نصف درجة'], ['raw', 'بدون تقريب (أعشار الكشف)']];
const NX = { sem: 1, per: 1, cls: '', round: 'ceil', view: '40_20', fill: 'both', rows: [], missing: [], busy: false, label: '' };
function nxGet(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
function nxSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

/* جبر الكسر: تُنظَّف الكسور العائمة أولًا (38.0000001 ← 38.0) ثم يُطبَّق الوضع، ولا يتجاوز السقف */
function noorRound(v, max, mode) {
  const clean = Math.round((Number(v) || 0) * 10) / 10;
  const r = mode === 'ceil' ? Math.ceil(clean) : mode === 'round' ? Math.round(clean) : mode === 'half' ? Math.round(clean * 2) / 2 : clean;
  return Math.max(0, Math.min(max, r));
}
const nxFmt = v => (Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, ''));

function noorExportOpen() {
  NX.sem = Number(document.getElementById('comp-semester')?.value || 1) === 2 ? 2 : 1;
  NX.per = Number(document.getElementById('comp-period')?.value || 1) === 2 ? 2 : 1;
  NX.cls = String(document.getElementById('comp-class')?.value || '');
  NX.round = nxGet(NOOR_ROUND_KEY, 'ceil'); if (!NOOR_ROUNDS.some(x => x[0] === NX.round)) NX.round = 'ceil';
  NX.view = nxGet(NOOR_VIEW_KEY, '40_20') === 'full' ? 'full' : '40_20';
  NX.fill = ['both', 'work40', 'exam20'].includes(nxGet(NOOR_FILL_KEY, 'both')) ? nxGet(NOOR_FILL_KEY, 'both') : 'both';
  const classes = [...new Set((STUDENTS || []).map(s => String(s.cls || s.className || s.class || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
  openModal(`<div class="noor-exp">
    <h2>🏛️ تصدير الكشف الشامل لنظام نور</h2>
    <p class="muted" style="font-size:.82rem;margin:.1rem 0 .6rem">أعمال السنة (40) = المشاركة 10 + الواجب 10 + السلوك 10 + الأنشطة 10 · الاختبار (20) · المجموع (60) — نفس أرقام الكشف الشامل، ثم معالجة الكسور حسب اختيارك.</p>
    <div class="noor-exp-controls">
      <label>الفصل الدراسي<select class="inp" id="nx-sem" onchange="NX.sem=+this.value;noorExpLoad()"><option value="1" ${NX.sem === 1 ? 'selected' : ''}>الأول</option><option value="2" ${NX.sem === 2 ? 'selected' : ''}>الثاني</option></select></label>
      <label>الفترة<select class="inp" id="nx-per" onchange="NX.per=+this.value;noorExpLoad()"><option value="1" ${NX.per === 1 ? 'selected' : ''}>الأولى</option><option value="2" ${NX.per === 2 ? 'selected' : ''}>الثانية</option></select></label>
      <label>الفصل/الشعبة<select class="inp" id="nx-cls" onchange="NX.cls=this.value;noorExpRender()"><option value="">كل الفصول</option>${classes.map(c => `<option value="${esc(c)}" ${c === NX.cls ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label>الكسور<select class="inp" id="nx-round" onchange="NX.round=this.value;nxSet(NOOR_ROUND_KEY,this.value);noorExpRender()">${NOOR_ROUNDS.map(([k, t]) => `<option value="${k}" ${k === NX.round ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label>العرض<select class="inp" id="nx-view" onchange="NX.view=this.value;nxSet(NOOR_VIEW_KEY,this.value);noorExpRender()"><option value="40_20" ${NX.view === '40_20' ? 'selected' : ''}>قالب نور المختصر (40 · 20)</option><option value="full" ${NX.view === 'full' ? 'selected' : ''}>القالب المفصّل</option></select></label>
    </div>
    <div id="nx-body"><div class="muted" style="padding:1.2rem;text-align:center">⏳ جارٍ تجهيز الكشف…</div></div>
  </div>`);
  const m = document.getElementById('modal'); if (m) m.classList.add('noor-exp-modal');
  noorExpLoad();
}

async function noorExpLoad(force) {
  const body = document.getElementById('nx-body'); if (!body) return;
  body.innerHTML = '<div class="muted" style="padding:1.2rem;text-align:center">⏳ جارٍ جلب درجات الفترة من الخادم…</div>';
  const sem = NX.sem, per = NX.per;
  let G = null;
  try { await loadComprehensiveClassroom(!!force); G = await loadServerGrades(!!force, sem, per); }
  catch (e) { if (document.getElementById('nx-body')) document.getElementById('nx-body').innerHTML = '<div class="ct-warn">تعذّر جلب الدرجات من الخادم — لا يُصدَّر كشف بأرقام غير موثوقة. تحقّق من الاتصال ثم أعد المحاولة.</div>'; return; }
  if (sem !== NX.sem || per !== NX.per) return;      // تغيّر الاختيار أثناء الجلب
  G = G || { map: {}, rules: { max: 10 } };
  NX.G = G;
  NX.label = `${sem === 2 ? 'الفصل الثاني' : 'الفصل الأول'} — ${per === 2 ? 'الفترة الثانية' : 'الفترة الأولى'}`;
  noorExpRender();
}

/* صف الطالب بنفس معادلات الكشف الشامل حرفيًا */
function noorRowFor(s, G) {
  const g = (G.map && G.map[String(s.id || '')]) || null;
  if (!g) return null;
  const p = g.participation || {}, h = g.homework || {}, b = g.behavior || {}, ex = g.exam || {};
  const pS = p.score == null ? 0 : p.score, hS = h.score == null ? 0 : h.score, bS = b.score == null ? 0 : b.score;
  const acts = compActivitiesForStudent(s, G.term), sub = compSubmissionCount(acts, s, G.term);
  const aS = acts.length ? Math.round(sub / acts.length * 100) / 10 : (G.rules && G.rules.max) || 10;
  const eS = ex.score == null ? 0 : Number(ex.score) || 0;
  const work = Math.round((pS + hS + bS + aS) * 10) / 10;
  return { s, name: String(s.name || ''), cls: String(s.cls || s.className || s.class || ''), p: pS, h: hS, b: bS, a: aS, workRaw: work, examRaw: Math.round(eS * 10) / 10, examMeasured: !!ex.measured };
}
function noorRows() {
  const G = NX.G || { map: {} }, mode = NX.round;
  const list = (STUDENTS || []).filter(s => !NX.cls || String(s.cls || s.className || s.class || '').trim() === NX.cls)
    .slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar'));
  const rows = [], missing = [];
  for (const s of list) {
    const r = noorRowFor(s, G);
    if (!r) { missing.push(String(s.name || '')); continue; }
    r.work40 = noorRound(r.workRaw, 40, mode);
    // اختبار لم يُرصد: خانة فارغة لا صفر — لا يُكتب في نور ولا يدخل المجموع والتقدير
    r.exam20 = r.examMeasured ? noorRound(r.examRaw, 20, mode) : null;
    r.total60 = r.exam20 == null ? null : Math.round((r.work40 + r.exam20) * 10) / 10;
    r.level = r.total60 == null ? '' : compAnnualLevel(r.total60);
    r.jabrW = r.work40 > Math.round(r.workRaw * 10) / 10; r.jabrE = r.exam20 != null && r.exam20 > r.examRaw;
    rows.push(r);
  }
  NX.rows = rows; NX.missing = missing;
  return rows;
}

function noorExpRender() {
  const body = document.getElementById('nx-body'); if (!body || !NX.G) return;
  const rows = noorRows(), full = NX.view === 'full', n = rows.length;
  const avg = k => { const v = rows.filter(r => r[k] != null); return v.length ? Math.round(v.reduce((t, r) => t + r[k], 0) / v.length * 10) / 10 : '—'; };
  const noEx = rows.filter(r => r.exam20 == null).length;
  const jabr = rows.filter(r => r.jabrW || r.jabrE).length;
  const tag = (now, raw, on) => on ? ` <span class="noor-jabr-tag" title="قبل معالجة الكسر">قبل الجبر ${nxFmt(raw)} ↗</span>` : '';
  body.innerHTML = `
    ${NX.missing.length ? `<div class="ct-warn" style="margin-bottom:.5rem">⚠️ ${NX.missing.length} ${NX.missing.length === 1 ? 'طالب لم تصل بياناته' : 'طلاب لم تصل بياناتهم'} من الخادم — <b>لن ${NX.missing.length === 1 ? 'يُصدَّر' : 'يُصدَّروا'} ولن ${NX.missing.length === 1 ? 'يُرصد' : 'يُرصدوا'}</b> حتى لا تظهر لهم أصفار في نور: ${NX.missing.slice(0, 8).map(esc).join('، ')}${NX.missing.length > 8 ? '…' : ''}</div>` : ''}
    ${noEx ? `<div class="ct-warn" style="margin-bottom:.5rem;background:rgba(200,138,46,.1)">📝 ${noEx} ${noEx === 1 ? 'طالب لم يُرصد له' : 'طلاب لم يُرصد لهم'} الاختبار — خانة الاختبار تبقى <b>فارغة</b> (لا صفر) ولا تُعبّأ في نور، ويُصدَّر له أعمال السنة فقط.</div>` : ''}
    <div class="noor-exp-kpis">
      <div class="noor-kpi"><span>جاهزون للرصد</span><b>${n}</b></div>
      <div class="noor-kpi ok"><span>شملهم جبر الكسر</span><b>${NX.round === 'raw' ? '—' : jabr}</b></div>
      <div class="noor-kpi"><span>متوسط أعمال السنة</span><b>${avg('work40')}<small>/40</small></b></div>
      <div class="noor-kpi"><span>متوسط الاختبار</span><b>${avg('exam20')}<small>/20</small></b></div>
      <div class="noor-kpi"><span>متوسط المجموع</span><b>${avg('total60')}<small>/60</small></b></div>
    </div>
    <div class="noor-exp-actions">
      <button class="btn tick sm" type="button" onclick="noorExportXlsx()" ${n ? '' : 'disabled'}>⬇️ تصدير Excel لنظام نور</button>
      <button class="btn ghost sm" type="button" onclick="noorExportCsv()" ${n ? '' : 'disabled'}>⬇️ CSV</button>
      <span class="noor-sep"></span>
      <button class="btn ghost sm" type="button" onclick="noorCopy('table')" ${n ? '' : 'disabled'}>📋 نسخ الجدول</button>
      <button class="btn ghost sm" type="button" onclick="noorCopy('w')" ${n ? '' : 'disabled'}>📋 عمود 40</button>
      <button class="btn ghost sm" type="button" onclick="noorCopy('e')" ${n ? '' : 'disabled'}>📋 عمود 20</button>
    </div>
    <div class="noor-exp-actions noor-auto">
      <b>⚡ رصد آلي في صفحة نور:</b>
      <select class="inp sm" id="nx-fill" onchange="NX.fill=this.value;nxSet(NOOR_FILL_KEY,this.value)" style="width:auto">
        <option value="both" ${NX.fill === 'both' ? 'selected' : ''}>الخانتان (40 ثم 20)</option><option value="work40" ${NX.fill === 'work40' ? 'selected' : ''}>أعمال السنة 40 فقط</option><option value="exam20" ${NX.fill === 'exam20' ? 'selected' : ''}>الاختبار 20 فقط</option></select>
      <button class="btn sm" type="button" onclick="noorPush()" ${n ? '' : 'disabled'}>⚡ إرسال لإضافة جسر مدرستي</button>
      <button class="btn ghost sm" type="button" onclick="noorCopyFillCode()" ${n ? '' : 'disabled'} title="كود يُلصق في «Console» صفحة نور — بلا إضافة">📜 نسخ كود التعبئة المباشرة</button>
      <button class="btn ghost sm" type="button" onclick="noorOpenSite()" title="يفتح صفحة إدخال الدرجات في نور (أو تبويب نور المفتوح)">🔗 افتح نور للرصد</button>
      <small class="muted" id="nx-push-st" style="flex-basis:100%"></small>
    </div>
    <div class="noor-exp-table-wrap"><table class="noor-exp-table">
      <thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th>${full ? '<th>المشاركة<small>10</small></th><th>الواجب<small>10</small></th><th>السلوك<small>10</small></th><th>الأنشطة والمهام<small>10</small></th>' : ''}<th>أعمال السنة<small>40</small></th><th>الاختبار<small>20</small></th><th>المجموع<small>60</small></th><th>التقدير</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td class="nm">${esc(r.name)}</td><td>${esc(r.cls)}</td>
        ${full ? `<td>${nxFmt(r.p)}</td><td>${nxFmt(r.h)}</td><td>${nxFmt(r.b)}</td><td>${nxFmt(r.a)}</td>` : ''}
        <td><b>${nxFmt(r.work40)}</b>${tag(r.work40, r.workRaw, r.jabrW)}</td><td>${r.exam20 == null ? '<small class="muted">لم يُرصد</small>' : `<b>${nxFmt(r.exam20)}</b>${tag(r.exam20, r.examRaw, r.jabrE)}`}</td>
        <td>${r.total60 == null ? '—' : `<b>${nxFmt(r.total60)}</b>`}</td><td>${esc(r.level || '—')}</td></tr>`).join('') || `<tr><td colspan="${full ? 11 : 7}" class="muted" style="text-align:center">لا طلاب جاهزون في هذا الاختيار.</td></tr>`}</tbody>
      ${n ? `<tfoot><tr><td></td><td>المتوسط</td><td></td>${full ? `<td>${avg('p')}</td><td>${avg('h')}</td><td>${avg('b')}</td><td>${avg('a')}</td>` : ''}<td>${avg('work40')}</td><td>${avg('exam20')}</td><td>${avg('total60')}</td><td></td></tr></tfoot>` : ''}
    </table></div>
    <p class="muted" style="font-size:.74rem;margin:.5rem 0 0">${NX.label} · ${esc(NX.cls || 'كل الفصول')} · ${esc((NOOR_ROUNDS.find(x => x[0] === NX.round) || [])[1] || '')}. راجع الأرقام قبل الحفظ في نور — نور هو السجل الرسمي.</p>`;
}

/* ── التصدير ── */
function noorFileBase() { return `رصد نور - ${NX.cls || 'كل الفصول'} - ${NX.label}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim(); }
async function noorExportXlsx() {
  const rows = NX.rows; if (!rows.length) return;
  try { await loadLib('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', () => typeof XLSX !== 'undefined'); }
  catch (e) { toast('تعذّر تحميل مكتبة Excel — تحقق من الإنترنت، أو استخدم CSV', 'bad'); return; }
  const a = [['م', 'اسم الطالب', 'الفصل', 'أدوات تقويم متنوعة / أعمال السنة (40)', 'الاختبارات القصيرة / الاختبار (20)', 'المجموع النهائي (60)', 'التقدير']]
    .concat(rows.map((r, i) => [i + 1, r.name, r.cls, r.work40, r.exam20 == null ? '' : r.exam20, r.total60 == null ? '' : r.total60, r.level]));
  const b = [['م', 'اسم الطالب', 'الفصل', 'المشاركة (10)', 'الواجب (10)', 'السلوك (10)', 'الأنشطة والمهام (10)', 'أعمال السنة قبل الجبر', 'أعمال السنة بعد الجبر (40)', 'الاختبار قبل الجبر', 'الاختبار بعد الجبر (20)', 'المجموع (60)', 'التقدير']]
    .concat(rows.map((r, i) => [i + 1, r.name, r.cls, r.p, r.h, r.b, r.a, r.workRaw, r.work40, r.examMeasured ? r.examRaw : '', r.exam20 == null ? '' : r.exam20, r.total60 == null ? '' : r.total60, r.level]));
  const wb = XLSX.utils.book_new();
  const s1 = XLSX.utils.aoa_to_sheet(a), s2 = XLSX.utils.aoa_to_sheet(b);
  s1['!cols'] = [{ wch: 5 }, { wch: 34 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
  s2['!cols'] = [{ wch: 5 }, { wch: 34 }, { wch: 10 }].concat(Array(10).fill({ wch: 13 }));
  XLSX.utils.book_append_sheet(wb, s1, 'رصد نور 40-20');
  XLSX.utils.book_append_sheet(wb, s2, 'التفصيل مع جبر الكسر');
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.writeFile(wb, noorFileBase() + '.xlsx');
  toast(`⬇️ صُدّر كشف ${rows.length} طالب`, 'good');
}
function noorExportCsv() {
  const rows = NX.rows; if (!rows.length) return;
  const q = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [['م', 'اسم الطالب', 'الفصل', 'أعمال السنة (40)', 'الاختبار (20)', 'المجموع (60)', 'التقدير']]
    .concat(rows.map((r, i) => [i + 1, r.name, r.cls, r.work40, r.exam20 == null ? '' : r.exam20, r.total60 == null ? '' : r.total60, r.level])).map(l => l.map(q).join(','));
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob), el = document.createElement('a');
  el.href = url; el.download = noorFileBase() + '.csv'; document.body.appendChild(el); el.click(); el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function noorClip(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg, 'good'); return; } catch (e) {}
  const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast(okMsg, 'good'); } catch (e) { toast('تعذّر النسخ', 'bad'); } ta.remove();
}
function noorCopy(what) {
  const rows = NX.rows; if (!rows.length) return;
  if (what === 'w') return noorClip(rows.map(r => r.work40).join('\n'), `📋 نُسخ عمود أعمال السنة (${rows.length}) بترتيب الجدول`);
  if (what === 'e') return noorClip(rows.map(r => r.exam20 == null ? '' : r.exam20).join('\n'), `📋 نُسخ عمود الاختبار (${rows.length}) بترتيب الجدول`);
  return noorClip(rows.map(r => [r.name, r.work40, r.exam20 == null ? '' : r.exam20, r.total60 == null ? '' : r.total60].join('\t')).join('\n'), `📋 نُسخ الجدول (${rows.length} طالب) — الصقه في Excel`);
}
function noorPayload() {
  return { rows: NX.rows.map(r => ({ name: r.name, cls: r.cls, work40: r.work40, exam20: r.exam20, total60: r.total60 })),
    cls: NX.cls || 'كل الفصول', label: NX.label, sem: NX.sem, per: NX.per, mode: NX.fill, round: NX.round };
}
/* 🏛️ افتح نظام نور للرصد: عبر جسر مدرستي (صفحة إدخال الدرجات مباشرة) وإلا موقع نور */
async function noorOpenSite() {
  // بلا الإضافة: يُفتح الموقع فورًا (داخل نقرة المستخدم فلا يحجبه المتصفح)
  if (typeof MADB === 'undefined' || !MADB.ok || typeof madbCall !== 'function') { window.open('https://noor.moe.gov.sa/Noor/login.aspx', '_blank', 'noopener'); return; }
  const r = await madbCall('noorOpen', {}, 3000).catch(() => null);
  if (r && r.ok) { toast(r.focused ? '🏛️ انتقلت إلى تبويب نور' : '🏛️ فُتحت صفحة إدخال الدرجات في نور', 'good'); return; }
  window.open('https://noor.moe.gov.sa/Noor/login.aspx', '_blank', 'noopener');
}
/* 👥 استيراد أسماء الطلاب من نور (عبر جسر مدرستي): يُطابَق فصل نور (الصف + رقم الفصل) مع فصول المعلم الحالية بأي تسمية */
const NX_ORD = [/(^|[\s\-/])(ال)?(أول|اول|أولى)(?=[\s\-/]|$)/, /(^|[\s\-/])(ال)?(ثاني|ثانية)(?=[\s\-/]|$)/, /(^|[\s\-/])(ال)?(ثالث|ثالثة)(?=[\s\-/]|$)/, /(^|[\s\-/])(ال)?(رابع|رابعة)(?=[\s\-/]|$)/, /(^|[\s\-/])(ال)?(خامس|خامسة)(?=[\s\-/]|$)/, /(^|[\s\-/])(ال)?(سادس|سادسة)(?=[\s\-/]|$)/];
function nxParseCls(c) {
  const t = String(c || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\s+/g, ' ').trim();
  let m = t.match(/^(\d)\s*[/\-_]\s*(\d{1,2})$/); if (m) return { grade: +m[1], sec: +m[2] };
  const g = NX_ORD.findIndex(r => r.test(t)) + 1, nums = t.match(/\d{1,2}/g) || [];
  if (g) return { grade: g, sec: nums.length ? +nums[nums.length - 1] : 0 };
  return nums.length >= 2 ? { grade: +nums[0], sec: +nums[nums.length - 1] } : { grade: 0, sec: nums.length ? +nums[0] : 0 };
}
async function noorRosterImport() {
  const help = msg => openModal(`<h2>🏛️ استيراد الأسماء من نور</h2>
    <p class="muted" style="font-size:.86rem;line-height:1.9;margin:.2rem 0 .8rem">${msg}</p>
    <ol style="font-size:.88rem;line-height:2;margin:0 1.2rem .8rem;padding:0">
      <li>افتح في نور <b>صفحة إدخال الدرجات</b> (واختر السنة والفصل الدراسي)، أو إن كان الرصد مقفلًا: صفحة <b>الطلاب حسب العلاقات التدريسية</b> واضغط «عرض».</li>
      <li>من لوحة «جسر مدرستي» في نور اضغط <b>📥 كل الصفوف والفصول</b> أو <b>📥 اسحب أسماء كل الفصول في هذه الصفحة</b>، وانتظر حتى ينتهي.</li>
      <li>ارجع هنا واضغط <b>استيراد من نور</b> مرة ثانية.</li></ol>
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إغلاق</button><button class="btn" onclick="noorOpenSite()">🔗 افتح نور</button></div>`);
  if (typeof MADB === 'undefined' || !MADB.ok || typeof madbCall !== 'function') return help('هذه الطريقة تحتاج إضافة <b>جسر مدرستي 0.23.0</b> أو أحدث في هذا المتصفح — ثبّتها ثم أعد تحميل الصفحة.');
  const r = await madbCall('noorRoster', {}, 4000).catch(() => null);
  if (!r || !r.ok) return help(r ? '⚠️ ' + esc(r.error || 'تعذّر القراءة') : 'لم تردّ الإضافة — حدّث «جسر مدرستي» إلى 0.23.0 أو أحدث ثم أعد تحميل الصفحة.');
  const classes = (r.classes || []).filter(c => (c.names || []).length);
  if (!classes.length) return help('لا توجد أسماء محفوظة في الجسر بعد.');
  // اسم الفصل: نفس تسمية فصل المعلم الحالي المطابق (الصف + الرقم)، وإلا تسمية نور المختصرة «أول 2»
  const mine = [...new Set((STUDENTS || []).map(s => String(s.cls || '').trim()).filter(Boolean))];
  const mapCls = c => mine.find(x => { const p = nxParseCls(x); return p.grade === c.grade && p.sec === c.sec; }) || c.label;
  const toks = n => normAr(n).split(' ').filter(w => w && !['بن', 'ابن', 'بنت'].includes(w));
  const inOrder = (a, b) => { let j = 0; for (const w of b) if (w === a[j]) j++; return j === a.length; };
  // موجود مسبقًا: نفس الاسم، أو أحدهما جزء مرتب من الآخر (3 أجزاء فأكثر)، أو نفس الأول والأخير في الفصل نفسه
  const exists = (name, cls) => { const t = toks(name); return (STUDENTS || []).some(s => { const u = toks(s.name); if (!u.length) return false;
    if (u.join(' ') === t.join(' ')) return true; const [a, b] = u.length <= t.length ? [u, t] : [t, u];
    if (a.length >= 3 && inOrder(a, b)) return true; return String(s.cls || '').trim() === cls && u[0] === t[0] && u[u.length - 1] === t[t.length - 1]; }); };
  let had = 0; const recs = [];
  classes.sort((a, b) => a.grade - b.grade || a.sec - b.sec).forEach(c => { const cls = mapCls(c); c.names.forEach(name => { if (exists(name, cls)) had++; else recs.push({ name, cls }); }); });
  if (!recs.length) { toast(`كل طلاب نور (${had}) موجودون مسبقًا ✓`, 'good'); return; }
  if (had) toast(`تُجوهل ${had} طالب موجود مسبقًا`, '');
  reviewImportedNames(recs, `نظام نور — ${classes.length} فصل`);
}
async function noorPush() {
  const st = document.getElementById('nx-push-st'); if (!NX.rows.length) return;
  if (st) st.textContent = '⏳ جارٍ الإرسال للإضافة…';
  const r = typeof madbCall === 'function' ? await madbCall('noorPushGrades', noorPayload(), 15000) : null;
  if (!st) return;
  if (!r) { st.innerHTML = '⚠️ لم تردّ إضافة «جسر مدرستي» — ثبّت الإصدار 0.16.5 أو أحدث ثم أعد تحميل الصفحة، أو استخدم «📜 نسخ كود التعبئة المباشرة».'; return; }
  if (!r.ok) { st.textContent = '⚠️ ' + (r.error || 'تعذّر الإرسال'); return; }
  st.innerHTML = r.tabs
    ? (r.preview ? `👁️ فُتحت معاينة في صفحة نور: <b>${r.ready || 0}</b> مطابق${r.approx ? ` · <b>${r.approx}</b> تقريبي يحتاج تأكيدك` : ''} — راجعها هناك ثم اضغط «✍️ اكتب درجات المحددين»، وبعدها «حفظ» في نور.`
      : r.filled ? `✅ عُبّئت درجات <b>${r.filled}</b> طالب في صفحة نور${r.unmatched && r.unmatched.length ? ` · لم يُطابَق ${r.unmatched.length}: ${r.unmatched.slice(0, 6).map(esc).join('، ')}` : ''} — راجعها ثم اضغط «حفظ» في نور.`
      : '📥 حُفظ الكشف في الإضافة، لكن صفحة نور المفتوحة ليست صفحة رصد بخانات — افتح صفحة رصد الدرجات ثم اضغط «✍️ تعبئة الدرجات الآن» في الشريط أسفلها.')
    : r.opened ? `📥 حُفظ كشف ${r.saved} طالب، وفُتحت صفحة إدخال الدرجات في نور — اضغط الفصل في لوحة «رصد الدرجات في نور» هناك، فيضبط الصفحة ويعرض المعاينة.`
    : `📥 حُفظ كشف ${r.saved} طالب في الإضافة. افتح صفحة إدخال الدرجات في نور، واضغط الفصل في لوحة الجسر.`;
}

/* 📜 كود ذاتي التشغيل يُلصق في Console صفحة نور: نفس مطابقة الإضافة (أسماء مطبَّعة، الأول + العائلة إلزاميًا) */
function noorFillScript(data) {
  return `/* مساعد المعلم — تعبئة درجات نور (${data.rows.length} طالب · ${data.label} · ${data.cls}) */
(function(DATA){
  var norm=function(s){return String(s||'').replace(/[\\u064B-\\u065F\\u0670\\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ة(?=\\s|$)/g,'ه')
    .replace(/[^\\u0600-\\u06FFa-zA-Z0-9\\s]/g,' ').replace(/\\s+(بن|ابن|بنت)\\s+/g,' ').replace(/(^|\\s)عبد\\s+(ال)/g,'$1عبد$2').replace(/\\s+/g,' ').trim();};
  var idx=DATA.rows.map(function(r){var n=norm(r.name);return {r:r,t:n.split(' ').filter(Boolean)};});
  var used=[];
  function score(a,b){if(a.join(' ')===b.join(' '))return 100;if(a[0]!==b[0]||a[a.length-1]!==b[b.length-1])return 0;var m=b.slice(1,-1),c=0;a.slice(1,-1).forEach(function(x){if(m.indexOf(x)>=0)c++;});return 10+c;}
  function match(name){var t=norm(name).split(' ').filter(Boolean);if(t.length<2)return null;var best=null,bs=0,tie=false;
    idx.forEach(function(x){if(used.indexOf(x)>=0)return;var s=score(t,x.t);if(s>bs){best=x;bs=s;tie=false;}else if(s&&s===bs)tie=true;});return bs&&!tie?best:null;}
  function docs(root){var out=[root];[].forEach.call(root.querySelectorAll('iframe,frame'),function(f){try{if(f.contentDocument)out=out.concat(docs(f.contentDocument));}catch(e){}});return out;}
  function ok(i){return !i.disabled&&!i.readOnly&&/^(text|number|tel|)$/i.test(i.type||'')&&(i.offsetWidth||i.offsetHeight);}
  function rowName(tr){var best='';[].forEach.call(tr.querySelectorAll('td,th'),function(td){if(td.querySelector('input,select,textarea'))return;var t=(td.innerText||'').replace(/\\s+/g,' ').trim();var ar=(t.match(/[\\u0600-\\u06FF]/g)||[]).length;if(ar>=6&&t.split(' ').length>=2&&t.length>best.length)best=t;});return best;}
  function set(i,v){var d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(i),'value');if(d&&d.set)d.set.call(i,String(v));else i.value=String(v);['input','change','blur'].forEach(function(e){i.dispatchEvent(new Event(e,{bubbles:true}));});i.style.background='#E6F7EE';}
  var mode=DATA.mode||'both',filled=0;
  docs(document).forEach(function(doc){[].forEach.call(doc.querySelectorAll('tr'),function(tr){var ins=[].filter.call(tr.querySelectorAll('input'),ok);if(!ins.length)return;var nm=rowName(tr);if(!nm)return;var m=match(nm);if(!m)return;used.push(m);
    var E=m.r.exam20!=null&&m.r.exam20!=='';if(mode==='both'){set(ins[0],m.r.work40);if(ins[1]&&E)set(ins[1],m.r.exam20);}else if(mode==='work40'){set(ins[0],m.r.work40);}else{if(!E)return;set(ins.length>=2?ins[1]:ins[0],m.r.exam20);}filled++;});});
  var miss=idx.filter(function(x){return used.indexOf(x)<0;}).map(function(x){return x.r.name;});
  alert('مساعد المعلم: عُبّئت درجات '+filled+' طالب'+(miss.length?'\\nلم يُطابَق ('+miss.length+'): '+miss.slice(0,15).join('، '):'')+'\\n\\nراجع الدرجات ثم اضغط «حفظ» في نور.');
})(${JSON.stringify(data)});`;
}
function noorCopyFillCode() {
  if (!NX.rows.length) return;
  noorClip(noorFillScript(noorPayload()), '📜 نُسخ الكود — في صفحة رصد نور: F12 ← Console ← الصق ← Enter');
  const st = document.getElementById('nx-push-st');
  if (st) st.innerHTML = '📜 نُسخ كود التعبئة. افتح صفحة رصد الدرجات في نور ← اضغط <b>F12</b> ← تبويب <b>Console</b> ← الصق ثم <b>Enter</b>. (إن طلب المتصفح كتابة <code>allow pasting</code> فاكتبها أولًا.)';
}
