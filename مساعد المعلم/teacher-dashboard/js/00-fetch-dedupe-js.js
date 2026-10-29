/* ⚡ طلب واحد بدل عدة طلبات متطابقة في نفس اللحظة.
   أجزاء مختلفة من اللوحة تطلب الشيء نفسه عند الفتح (الدرجات مرتين، اللقطة مرتين، جوالات أولياء الأمور 6 مرات…)
   قبل أن يعود أول رد. هنا: إن كان طلب GET مطابق للخادم ما زال في الطريق، يأخذ الطالب الثاني نسخة من الرد نفسه.
   - للقراءة (GET) من الخادم فقط — لا الحفظ ولا ملفات اللوحة نفسها
   - لا تخزين: بمجرد وصول الرد يُنسى، والطلب التالي يذهب للخادم كالعادة (لا بيانات قديمة)
   - ‎_=‎ (كاسر التخزين) لا يميّز طلبًا عن آخر */
(function(){
  if(typeof window.fetch !== 'function' || window.__fetchDedupe) return;
  const F = window.fetch.bind(window), live = new Map();
  window.__fetchDedupe = true;
  window.fetch = function(input, init){
    try{
      const isReq = typeof Request !== 'undefined' && input instanceof Request;
      const m = String((init && init.method) || (isReq && input.method) || 'GET').toUpperCase();
      if(m !== 'GET' || isReq || (init && (init.body || init.signal))) return F(input, init);
      const u = new URL(String(input), location.href);
      if(u.origin === location.origin) return F(input, init);
      u.searchParams.delete('_');
      const k = u.href;
      let p = live.get(k);
      if(!p){
        p = F(input, init); live.set(k, p);
        const done = () => { if(live.get(k) === p) live.delete(k); };
        p.then(done, done);
      }
      return p.then(r => r.clone());
    }catch(e){ return F(input, init); }
  };
})();
