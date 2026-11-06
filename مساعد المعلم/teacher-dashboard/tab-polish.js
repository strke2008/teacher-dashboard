/* تحسينات فحص التبويبات — الدفعة 1 (مرافق tab-polish.css).
   طبقة إضافة فقط، لا تغيّر أي كود أصلي ولا أي وظيفة.
   1) حقل كلمة سر الخادم يُخفى بنقاط (بلا type=password حتى لا يعرض المتصفح حفظها) مع زر إظهار/إخفاء.
   2) ارتفاع الرأس الثابت يُقاس حيًا ليجلس شريط تبويبات الإعدادات أسفله.
   3) جدول نتائج نافس يُغلَّف بحاوية تمرير أفقي عند كل إعادة رسم. */
(function(){
  /* 1) كلمة سر الخادم: إخفاء + زر إظهار */
  function maskToken(){
    try{
      var input=document.getElementById('api-tok');
      if(!input) return;
      // نقاط بلا type=password: كان المتصفح يعرض «تحديث كلمة المرور» ويأخذ عنوان الخادم اسم مستخدم
      input.setAttribute('type','text'); input.classList.add('no-pwsave');
      ['autocomplete','off','autocapitalize','off','autocorrect','off','spellcheck','false','data-lpignore','true','data-1p-ignore','','data-bwignore',''].forEach(function(v,i,a){ if(i%2===0) input.setAttribute(v,a[i+1]); });
      if(input.nextElementSibling && input.nextElementSibling.classList.contains('api-tok-toggle')) return;
      var btn=document.createElement('button');
      btn.type='button';
      btn.className='btn ghost sm api-tok-toggle';
      btn.textContent='👁️ إظهار';
      btn.addEventListener('click',function(){
        var show=input.classList.contains('no-pwsave');
        input.classList.toggle('no-pwsave',!show);
        btn.textContent=show?'🙈 إخفاء':'👁️ إظهار';
      });
      input.insertAdjacentElement('afterend',btn);
    }catch(e){}
  }

  /* 2) ارتفاع الرأس الثابت */
  function measureMasthead(){
    try{
      var m=document.querySelector('.masthead');
      if(!m) return;
      document.documentElement.style.setProperty('--masthead-h',(m.offsetHeight+8)+'px');
    }catch(e){}
  }

  /* 3) تغليف جدول نتائج نافس */
  function wrapNafsTables(root){
    try{
      var tables=(root||document).querySelectorAll('table.nafs-res');
      tables.forEach(function(t){
        if(t.parentElement && t.parentElement.classList.contains('nafs-res-wrap')) return;
        var wrap=document.createElement('div');
        wrap.className='nafs-res-wrap';
        t.parentNode.insertBefore(wrap,t);
        wrap.appendChild(t);
      });
    }catch(e){}
  }
  function observeNafs(){
    try{
      var root=document.getElementById('nafs-root');
      if(!root) return;
      wrapNafsTables(root);
      var obs=new MutationObserver(function(){ wrapNafsTables(root); });
      obs.observe(root,{childList:true,subtree:true});
    }catch(e){}
  }

  function init(){
    maskToken();
    measureMasthead();
    observeNafs();
    window.addEventListener('resize',measureMasthead);
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
  }else{
    init();
  }
})();
