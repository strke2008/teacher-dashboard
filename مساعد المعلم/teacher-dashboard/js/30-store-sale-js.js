'use strict';
/* 🏷️ تخفيضات المتجر: نسبة خصم على كل البطاقات لمناسبة، حتى وقت اختياري.
   الخادم يحفظها (/store-sale) ويحسب السعر المخفّض عند كل شراء؛ هنا الضبط والمعاينة فقط. */
let SALE_CUR = null;
let SALE_DIRTY = false;
const SALE_SAMPLE = [['🏆 رفع الاختبار +3', 1000], ['🏆 رفع الاختبار +2', 750], ['🏆 رفع الاختبار +1', 450], ['🏆 رفع الاختبار +0.5', 250], ['🏅 شهادة شكر', 600], ['🌈 اسم ملوّن', 300], ['⭐ نقاط مضاعفة', 150], ['💡 تلميح', 30]];
const salePx = (p, pct) => pct ? Math.max(1, Math.round(p * (100 - pct) / 100)) : p;
function saleApi(){ return (getApi() || '').replace(/\/+$/, ''); }
function saleFmt(t){ try{ return new Date(t).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { weekday:'long', day:'numeric', month:'long', hour:'numeric', minute:'2-digit' }); }catch(e){ return ''; } }
function saleLocalInput(t){ const d = new Date(t - new Date(t).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); }
function saleRenderStatus(){
  const el = document.getElementById('sale-status'), stop = document.getElementById('sale-stop'); if(!el) return;
  const s = SALE_CUR;
  const expired = !!(s && s.until && s.until <= Date.now());
  const active = s && !expired;
  el.className = 'sale-status' + (active ? ' on' : '');
  el.innerHTML = expired ? '⌛ انتهى التخفيض — الأسعار عادية.' : s ? `🟢 <b>مفعّل الآن: خصم ${s.pct}%</b>${s.title ? ` — ${esc(s.title)}` : ''}${s.until ? ` · ينتهي ${esc(saleFmt(s.until))}` : ' · حتى توقفه'}` : '⚪ لا يوجد تخفيض حاليًا — الأسعار عادية.';
  if(stop) stop.disabled = !active;
}
function salePreview(){
  const pct = Math.round(Number((document.getElementById('sale-pct') || {}).value) || 0), box = document.getElementById('sale-preview'); if(!box) return;
  const ok = pct >= 5 && pct <= 90;
  document.querySelectorAll('#sale-pcts button').forEach(b => b.classList.toggle('on', Number(b.dataset.p) === pct));
  box.innerHTML = ok ? SALE_SAMPLE.map(([n, p]) => `<span>${n}<b><s>${p}</s> ${salePx(p, pct)}</b></span>`).join('') : '<span class="muted">أدخل نسبة من 5 إلى 90</span>';
}
async function saleLoad(){
  const pc = document.getElementById('sale-pcts');
  if(pc && !pc.dataset.done){ pc.dataset.done = '1';
    pc.innerHTML = [10, 15, 20, 25, 50].map(p => `<button type="button" data-p="${p}" onclick="document.getElementById('sale-pct').value=${p};SALE_DIRTY=true;salePreview()">${p}%</button>`).join('');
    if(!saleLoad._bound){ saleLoad._bound = true;
      ['sale-pct','sale-title','sale-until'].forEach(id=>{ const el=document.getElementById(id); if(el) el.addEventListener('input',()=>{ SALE_DIRTY=true; }); }); } }
  salePreview();
  const api = saleApi(); if(!api){ const el = document.getElementById('sale-status'); if(el) el.textContent = 'اضبط الخادم أولًا.'; return; }
  const stop = document.getElementById('sale-stop'); if(stop) stop.disabled = true;
  let j = null, failed = false;
  try{ const r = await fetch(api + '/store-sale?_=' + Date.now(), { cache: 'no-store' }); j = await r.json().catch(()=>null); if(!r.ok) throw new Error('http'); }
  catch(e){ failed = true; }
  if(failed || !j){ const el = document.getElementById('sale-status'); if(el) el.textContent = 'تعذّرت قراءة حالة التخفيض — تحقق من الاتصال.'; return; }
  if(!j.ok){ const el = document.getElementById('sale-status');
    if(el) el.textContent = (j.error === 'not found') ? 'انشر آخر نسخة من الخادم (worker.js) لعرض التخفيض.' : 'تعذّر قراءة حالة التخفيض — خطأ من الخادم.';
    return; }
  SALE_CUR = j.sale || null;
  if(SALE_CUR && !SALE_DIRTY){ const p = document.getElementById('sale-pct'), t = document.getElementById('sale-title'), u = document.getElementById('sale-until');
    if(p) p.value = SALE_CUR.pct; if(t) t.value = SALE_CUR.title || ''; if(u) u.value = SALE_CUR.until ? saleLocalInput(SALE_CUR.until) : ''; salePreview(); }
  saleRenderStatus();
}
async function salePost(body){
  const r = await fetch(saleApi() + '/store-sale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: getTok(), ...body }) });
  const j = await r.json().catch(() => ({})); if(!r.ok || !j.ok) { const e = new Error(j.error || 'http'); throw e; } return j;
}
async function saleSave(){
  const pct = Math.round(Number(document.getElementById('sale-pct').value) || 0), title = (document.getElementById('sale-title').value || '').trim();
  const uv = document.getElementById('sale-until').value, until = uv ? new Date(uv).getTime() : 0;
  if(!(pct >= 5 && pct <= 90)){ toast('نسبة الخصم من 5% إلى 90%', 'bad'); return; }
  if(until && until <= Date.now()){ toast('وقت الانتهاء في الماضي', 'bad'); return; }
  if(!(await askConfirm(`خصم ${pct}% على كل بطاقات المتجر${title ? ` (${title})` : ''}${until ? `، حتى ${saleFmt(until)}` : '، حتى توقفه'}. يظهر للطلاب فورًا.`, { title: 'تفعيل التخفيض؟', yes: '🏷️ فعّل', no: 'إلغاء' }))) return;
  try{ const j = await salePost({ pct, title, until }); SALE_CUR = j.sale; SALE_DIRTY = false; saleRenderStatus(); toast(`🏷️ فُعّل خصم ${pct}% في المتجر`, 'good'); }
  catch(e){ toast(e.message === 'unauthorized' ? 'كلمة السر غير صحيحة' : e.message === 'past' ? 'وقت الانتهاء في الماضي' : 'تعذّر الحفظ — انشر آخر نسخة من الخادم', 'bad'); }
}
async function saleStop(){
  if(!SALE_CUR) return;
  if(!(await askConfirm('تعود أسعار المتجر إلى طبيعتها فورًا.', { title: 'إيقاف التخفيض؟', yes: 'أوقف', no: 'إلغاء', danger: true }))) return;
  try{ await salePost({ pct: 0 }); SALE_CUR = null; SALE_DIRTY = false; saleRenderStatus(); toast('أُوقف التخفيض — الأسعار عادية', 'good'); }
  catch(e){ toast('تعذّر الإيقاف', 'bad'); }
}
