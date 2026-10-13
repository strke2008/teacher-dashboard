'use strict';
/* ⬇️ تحميل مشاريع الطلاب: ملف واحد · ملفات طالب واحد · كل المعروض (بعد التصفية) في ملف ZIP واحد.
   الملفات تُجلب من /file-download (يسمح الخادم بذلك للوحة) ثم تُجمع هنا في المتصفح بلا ضغط
   — الصور والفيديو وPDF مضغوطة أصلًا، فالتخزين المباشر أسرع ولا يكبر الحجم. */

/* ── كاتب ZIP بسيط (طريقة STORE) مع أسماء عربية (UTF-8) ── */
const PDL_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function pdlCrc32(u8){ let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = PDL_CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function pdlDosTime(d){ return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() }; }
function pdlZip(entries){                       // entries: [{name, data:Uint8Array, at}]
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const e of entries){
    const nm = enc.encode(e.name), crc = pdlCrc32(e.data), sz = e.data.length, dt = pdlDosTime(new Date(e.at || Date.now()));
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, dt.time, true); h.setUint16(12, dt.date, true); h.setUint32(14, crc, true); h.setUint32(18, sz, true); h.setUint32(22, sz, true);
    h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), nm, e.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, dt.time, true); c.setUint16(14, dt.date, true); c.setUint32(16, crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true);
    c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + sz;
  }
  const cdSize = central.reduce((n, p) => n + p.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}

/* ── أسماء الملفات والحفظ ── */
function pdlSafe(s, max = 60){ return String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) || 'ملف'; }
function pdlExt(f){ const m = String(f && f.name || '').match(/\.([a-z0-9]{1,5})$/i); if (m) return '.' + m[1].toLowerCase();
  const t = String(f && f.type || ''); return t === 'application/pdf' ? '.pdf' : t.startsWith('image/') ? '.' + (t.split('/')[1] || 'jpg').replace('jpeg', 'jpg') : t.startsWith('video/') ? '.mp4' : ''; }
function pdlFileName(x, f, i, n){ const base = pdlSafe(String(f && f.name || '').replace(/\.[a-z0-9]{1,5}$/i, ''), 50); return `${n > 1 ? (i + 1) + ' - ' : ''}${base}${pdlExt(f)}`; }
function pdlSave(blob, name){
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function pdlMB(b){ return (b / 1048576).toLocaleString('en-US', { maximumFractionDigits: b < 10485760 ? 1 : 0 }) + ' MB'; }
async function pdlFetch(x, f){
  const r = await fetch(projectFileUrl(x.project, x.student, f), { cache: 'no-store' });
  if (!r.ok) throw new Error('http_' + r.status);
  return new Uint8Array(await r.arrayBuffer());
}

/* ── ⬇️ ملف واحد (من نافذة عرض المشروع) ── */
async function projDownloadFile(index, fi){
  const x = (window.__visibleProjects || [])[index]; const f = x && (x.files || [])[fi]; if (!f) return;
  try { toast('⬇️ جارٍ تحميل الملف…', 'ok'); const data = await pdlFetch(x, f);
    pdlSave(new Blob([data], { type: f.type || 'application/octet-stream' }), `${pdlSafe(x.studentName, 40)} - ${pdlFileName(x, f, fi, (x.files || []).length)}`); }
  catch (e) { toast('تعذّر تحميل الملف — ربما حُذف من الخادم', 'bad'); }
}

/* ── ⬇️ ملفات طالب واحد، أو كل المعروض ── */
let PDL_BUSY = false;
function projDownloadStudent(index){ const x = (window.__visibleProjects || [])[index]; if (x) pdlRun([x], `${pdlSafe(x.studentName, 40)} - ${pdlSafe(x.title, 40)}`); }
async function projDownloadVisible(){
  const rows = (window.__visibleProjects || []).filter(x => Array.isArray(x.files) && x.files.length);
  if (!rows.length) { toast('لا توجد ملفات في المشاريع المعروضة', 'bad'); return; }
  const n = rows.reduce((s, x) => s + x.files.length, 0), size = rows.reduce((s, x) => s + x.files.reduce((t, f) => t + (Number(f.size) || 0), 0), 0);
  const big = size > 300 * 1048576;
  if (!(await askConfirm(`${rows.length} تسليم · ${n} ملف · نحو ${pdlMB(size)}. تُجمع في ملف ZIP واحد مرتّب في مجلدات (المشروع ← الفصل - الطالب).${big ? '\n\n⚠️ الحجم كبير: يُفضَّل التصفية حسب المشروع أو الفصل أولًا، خاصة على الجوال.' : ''}`,
    { title: 'تحميل المشاريع المعروضة؟', yes: '⬇️ حمّل', no: 'إلغاء' }))) return;
  const pf = document.getElementById('projects-project-filter'), pt = pf && pf.value && pf.selectedOptions[0] ? pf.selectedOptions[0].textContent : '';
  pdlRun(rows, `مشاريع الطلاب${pt ? ' - ' + pdlSafe(pt, 40) : ''} - ${new Date().toISOString().slice(0, 10)}`);
}
function pdlProg(done, total, bytes, fail){
  const pct = total ? Math.round(done / total * 100) : 0;
  const m = document.getElementById('modal'); if (m) m.classList.remove('projects-modal');   // قد تكون نافذة عرض المشروع مفتوحة
  openModal(`<h2>⬇️ جارٍ تجهيز ملف التحميل</h2>
    <div class="pdl-prog"><div class="pdl-bar"><i style="width:${pct}%"></i></div>
    <b class="pdl-cnt">${done} / ${total}</b><small>جُلب ${pdlMB(bytes)}${fail ? ` · تعذّر ${fail}` : ''} — لا تغلق الصفحة حتى ينتهي</small></div>`);
}
async function pdlRun(rows, zipName){
  if (PDL_BUSY) { toast('تحميل آخر قيد التجهيز', 'bad'); return; }
  const jobs = []; const multiProject = new Set(rows.map(x => x.projectId)).size > 1, single = rows.length === 1;
  for (const x of rows) {
    const files = Array.isArray(x.files) ? x.files : [];
    const dir = single ? '' : `${multiProject ? pdlSafe(x.title, 50) + '/' : ''}${pdlSafe(String(projectStudentClass(x) || x.cls || 'بلا فصل').replace(/\//g, '-'), 12)} - ${pdlSafe(x.studentName, 50)}/`;
    files.forEach((f, i) => jobs.push({ x, f, name: dir + pdlFileName(x, f, i, files.length) }));
  }
  if (!jobs.length) return;
  /* ملف واحد فقط: يُحفظ كما هو بلا ZIP */
  if (jobs.length === 1) { const i = (window.__visibleProjects || []).indexOf(rows[0]); return projDownloadFile(i, 0); }
  PDL_BUSY = true;
  const out = [], failed = [], used = new Set(); let bytes = 0, done = 0;
  pdlProg(0, jobs.length, 0, 0);
  /* ٣ ملفات معًا: أسرع دون إثقال الجوال */
  let next = 0;
  const worker = async () => { while (next < jobs.length) { const j = jobs[next++];
    try { const data = await pdlFetch(j.x, j.f); bytes += data.length;
      let nm = j.name, k = 2; while (used.has(nm)) nm = j.name.replace(/(\.[a-z0-9]+)?$/i, ` (${k++})$1`); used.add(nm);
      out.push({ name: nm, data, at: Number(j.f.at || j.x.at) || Date.now() }); }
    catch (e) { failed.push(`${j.x.studentName} — ${j.f.name || 'ملف'}`); }
    done++; pdlProg(done, jobs.length, bytes, failed.length); } };
  try {
    await Promise.all([worker(), worker(), worker()]);
    if (!out.length) { closeModal(); toast('تعذّر تحميل الملفات — تحقق من الاتصال', 'bad'); return; }
    if (failed.length) out.push({ name: 'ملفات تعذّر تحميلها.txt', data: new TextEncoder().encode('﻿' + failed.join('\r\n')), at: Date.now() });
    out.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    pdlSave(pdlZip(out), pdlSafe(zipName, 90) + '.zip');
    closeModal();
    toast(failed.length ? `⬇️ حُمّل ${out.length - 1} ملف · تعذّر ${failed.length} (أسماؤها داخل الملف)` : `⬇️ حُمّل ${out.length} ملف في ملف ZIP`, failed.length ? 'bad' : 'good');
  } finally { PDL_BUSY = false; }
}
