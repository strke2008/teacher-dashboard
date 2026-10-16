/* 👪 جوالات أولياء الأمور — صفحة «معلومات الطلاب» في مدرستي (SchoolManagmentReports/StudentInfo).
   لا يُقرأ شيء تلقائيًا: يظهر زر، وبضغطة المعلم تُقرأ الأعمدة (الاسم · الفصل · ولي الأمر · جواله) وتُرسل لخادمه
   ليطابقها بأسماء طلابه. أرقام الطلاب أنفسهم وبريدهم لا تُرسل. */
(() => {
  'use strict';
  if (window.__MB_PARENTS__) return; window.__MB_PARENTS__ = true;
  const isPage = () => /\/SchoolManagmentReports\/StudentInfo\//i.test(location.pathname);
  const txt = el => String(el && el.textContent || '').replace(/\s+/g, ' ').trim();
  function readTable() {
    const rows = [];
    for (const t of document.querySelectorAll('table')) {
      const head = [...t.querySelectorAll('thead th, tr:first-child th')].map(txt);
      const iName = head.findIndex(h => /اسم الطالب/.test(h)), iPh = head.findIndex(h => /جوال ولي الأمر/.test(h));
      if (iName < 0 || iPh < 0) continue;
      const iPar = head.findIndex(h => /^ولي الأمر$/.test(h)), iCls = head.findIndex(h => /^الفصل$/.test(h));
      for (const tr of t.querySelectorAll('tbody tr')) {
        const c = tr.querySelectorAll('td'); if (c.length <= Math.max(iName, iPh)) continue;
        const name = txt(c[iName]), phone = txt(c[iPh]).replace(/\D/g, '');
        if (name && phone) rows.push({ name, phone, parent: iPar >= 0 ? txt(c[iPar]) : '', cls: iCls >= 0 ? txt(c[iCls]) : '' });
      }
    }
    return rows;
  }
  function toast(msg, ok) {
    let d = document.getElementById('mb-par-toast'); if (!d) { d = document.createElement('div'); d.id = 'mb-par-toast'; document.body.appendChild(d); }
    d.style.cssText = `position:fixed;z-index:2147483647;bottom:84px;left:20px;max-width:420px;background:${ok ? '#13734F' : '#B4232F'};color:#fff;padding:12px 16px;border-radius:14px;font:600 14px/1.7 Tahoma,Arial;box-shadow:0 10px 30px rgba(0,0,0,.25);direction:rtl;white-space:pre-line`;
    d.textContent = msg; clearTimeout(d._t); d._t = setTimeout(() => d.remove(), 12000);
  }
  function mount() {
    if (!isPage() || !document.body || document.getElementById('mb-par-btn')) return;
    const b = document.createElement('button'); b.id = 'mb-par-btn'; b.type = 'button';
    b.textContent = '📱 أرسل جوالات أولياء الأمور لمساعد المعلم';
    b.style.cssText = 'position:fixed;z-index:2147483646;bottom:24px;left:20px;border:0;border-radius:99px;padding:12px 18px;background:#1F5FC8;color:#fff;font:700 14px Tahoma,Arial;cursor:pointer;box-shadow:0 8px 22px rgba(31,95,200,.35);direction:rtl';
    b.onclick = () => {
      const rows = readTable();
      if (!rows.length) { toast('لم أجد جدولًا فيه «اسم الطالب» و«جوال ولي الأمر» — اضغط «بحث» لعرض الطلاب أولًا'); return; }
      if (!confirm(`سيُرسل ${rows.length} اسمًا مع جوال ولي الأمر إلى خادم مساعد المعلم ليطابقها بطلابك.\n(أرقام الطلاب وبريدهم لا تُرسل)\n\nمتابعة؟`)) return;
      b.disabled = true; b.textContent = '⏳ جارٍ الإرسال…';
      chrome.runtime.sendMessage({ type: 'mb:parentPhones', rows }, r => {
        void chrome.runtime.lastError; b.disabled = false; b.textContent = '📱 أرسل جوالات أولياء الأمور لمساعد المعلم';
        if (!r || !r.ok) { toast('تعذّر الإرسال: ' + ((r && r.error) || 'افتح مساعد المعلم مرة ليصل الإضافة عنوان الخادم وكلمة السر')); return; }
        const um = (r.unmatched || []).length, am = (r.ambiguous || []).length;
        toast(`✓ طُوبق ${r.matched} طالبًا — المجموع عندك الآن ${r.total}` + (um ? `\nلم يُعثر في كشفك على ${um}: ${r.unmatched.slice(0, 6).join('، ')}${um > 6 ? '…' : ''}` : '') + (am ? `\nأسماء متشابهة لم تُحسم (${am}) — أدخلها يدويًا من ملف الطالب` : ''), true);
      });
    };
    document.body.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  setInterval(mount, 2000);
})();
