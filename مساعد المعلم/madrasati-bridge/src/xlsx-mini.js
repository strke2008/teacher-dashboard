/* 📥 كاتب Excel صغير (xlsx) داخل الإضافة — بلا مكتبات خارجية (إضافات Chrome لا تحمّل سكربتات من الإنترنت).
   ملف zip «مخزَّن» (بلا ضغط) فيه أوراق بنصوص مضمّنة. يُنشأ في المتصفح ويُنزَّل مباشرة: لا يُرسل لأي خادم. */
(() => {
  'use strict';
  if (window.MBXlsx) return;
  const enc = new TextEncoder();
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {   // [{name, data:Uint8Array}] ⇒ Uint8Array
    const parts = [], cen = []; let off = 0;
    for (const f of files) {
      const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint32(14, crc, true); h.setUint32(18, sz, true); h.setUint32(22, sz, true); h.setUint16(26, nm.length, true);
      parts.push(new Uint8Array(h.buffer), nm, f.data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint32(16, crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      cen.push(new Uint8Array(c.buffer), nm);
      off += 30 + nm.length + sz;
    }
    const cenLen = cen.reduce((a, x) => a + x.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cenLen, true); e.setUint32(16, off, true);
    const all = [...parts, ...cen, new Uint8Array(e.buffer)], out = new Uint8Array(all.reduce((a, x) => a + x.length, 0));
    let p = 0; for (const x of all) { out.set(x, p); p += x.length; }
    return out;
  }
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const col = n => { let s = ''; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  // كل الخلايا نصوص (حتى الجوال: لا تضيع الصفر في أوله)
  const sheetXml = rows => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews><sheetData>${
    rows.map((r, i) => `<row r="${i + 1}">${(r || []).map((v, j) => v === '' || v == null ? '' : `<c r="${col(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
  function build(sheets) {   // [{name, rows:[[...]]}] ⇒ Blob
    const used = new Set();
    const names = sheets.map((s, i) => { let n = String(s.name || `ورقة ${i + 1}`).replace(/[\[\]:*?\/\\]/g, '-').slice(0, 31) || `ورقة ${i + 1}`; let k = n, x = 2; while (used.has(k)) k = n.slice(0, 28) + ' ' + x++; used.add(k); return k; });
    const F = (name, s) => ({ name, data: enc.encode(s) });
    const files = [
      F('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`),
      F('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
      F('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`),
      F('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`),
      ...sheets.map((s, i) => F(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows))),
    ];
    return new Blob([zip(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function download(blob, filename) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  window.MBXlsx = { build, download };
})();
