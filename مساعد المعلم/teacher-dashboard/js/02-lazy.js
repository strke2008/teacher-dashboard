'use strict';
/* ⏳ الجزء المؤجَّل من js/02.js — يُحمَّل في الخلفية بعد ظهور اللوحة (js/46-lazy.js) ولا يُذكر في index.html كسكربت.
   فيه فقط دوال تُستدعى من الأزرار (نصوص onclick)؛ وما يحتاجه الفتح أو أي ملف آخر بالاسم بقي في js/02.js.
   الفاصل يحسبه tests/lazy-split (اختبار «سلامة التقسيم»): لا تنادِ دالة من هنا مباشرة في ملف آخر — ضعها في الملف الأصلي. */

let LOG      = load(K.log, []);
/* استيراد الأسماء من نسخة تطبيق الألعاب */
let pendingGamesImport = null;

function importFromGames(ev){
  const file=ev.target.files?.[0];
  ev.target.value='';
  if(!file) return;

  const reader=new FileReader();

  reader.onerror=()=>toast('تعذر قراءة ملف JSON','bad');

  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);
      const records=extractGameStudentRecords(data);

      if(!records.length){
        toast('لم أجد طلابًا صالحين في الملف','bad');
        return;
      }

      const existingKeys=new Set((STUDENTS||[]).map(s=>normalizeStudentKey(s.name)));
      const seenKeys=new Set();
      const pending=[];
      const duplicates=[];
      const missingClass=[];

      records.forEach(record=>{
        const name=String(record.name||'').trim();
        if(!name) return;

        const key=normalizeStudentKey(name);
        if(!key) return;

        const className=String(
          record.className ||
          (
            record.grade && record.section
              ? `${record.grade} - ${record.section}`
              : (record.grade||record.section)
          ) ||
          data.currentClass ||
          ''
        ).trim();

        if(existingKeys.has(key) || seenKeys.has(key)){
          duplicates.push(name);
          return;
        }

        seenKeys.add(key);
        if(!className) missingClass.push(name);

        pending.push({
          name,
          className,
          grade:String(record.grade||'').trim(),
          section:String(record.section||'').trim()
        });
      });

      if(!pending.length){
        toast('لا توجد أسماء جديدة للاستيراد','bad');
        return;
      }

      openGamesImportReview(pending,duplicates,missingClass);
    }catch(error){
      console.error(error);
      toast('ملف JSON غير صالح أو غير متوافق مع الملف','bad');
    }
  };

  reader.readAsText(file,'utf-8');
}


function normalizeStudentKey(value){
  return String(value||'')
    .trim()
    .replace(/\s+/g,' ')
    .replace(/[أإآ]/g,'ا')
    .replace(/ة/g,'ه')
    .replace(/ى/g,'ي')
    .toLowerCase();
}

function extractGameStudentRecords(data){
  const records=[];
  const visited=new Set();

  const nameKeys=[
    'name','studentName','student_name','fullName','full_name',
    'student','اسم','اسم الطالب','اسم_الطالب'
  ];

  const gradeKeys=[
    'grade','level','schoolClass','gradeName','grade_name',
    'صف','الصف','المرحلة'
  ];

  const sectionKeys=[
    'section','sectionName','section_name','division','group',
    'classroom','شعبة','الشعبه','المجموعة','المجموعه','الفصل'
  ];

  function firstValue(obj,keys){
    if(!obj || typeof obj!=='object') return '';
    for(const key of keys){
      if(Object.prototype.hasOwnProperty.call(obj,key)){
        const value=obj[key];
        if(typeof value==='string' || typeof value==='number'){
          const text=String(value).trim();
          if(text) return text;
        }
      }
    }
    return '';
  }

  /*
   * الملف يحتوي على مصدرين:
   * students = بيانات الأسماء.
   * studentClasses = الربط الفعلي بين اسم الطالب والفصل.
   * نستخدم studentClasses أولاً لأنه المصدر الأدق في هذا النوع من التصدير.
   */
  const classByStudent=new Map();
  const studentClasses=data && typeof data==='object' ? data.studentClasses : null;

  if(studentClasses && typeof studentClasses==='object' && !Array.isArray(studentClasses)){
    Object.entries(studentClasses).forEach(([className,names])=>{
      if(!Array.isArray(names)) return;
      const cls=String(className||'').trim();
      if(!cls) return;

      names.forEach(name=>{
        const key=normalizeStudentKey(name);
        if(key) classByStudent.set(key,cls);
      });
    });
  }

  const defaultClass=String(data?.currentClass||'').trim();

  function visit(node,inheritedGrade='',inheritedSection=''){
    if(!node || typeof node!=='object') return;
    if(visited.has(node)) return;
    visited.add(node);

    if(Array.isArray(node)){
      node.forEach(item=>visit(item,inheritedGrade,inheritedSection));
      return;
    }

    const ownGrade=firstValue(node,gradeKeys);
    const ownSection=firstValue(node,sectionKeys);
    const grade=ownGrade||inheritedGrade;
    const section=ownSection||inheritedSection;
    const name=firstValue(node,nameKeys);

    if(name){
      const key=normalizeStudentKey(name);
      const mappedClass=classByStudent.get(key)||defaultClass;
      records.push({
        name,
        grade,
        section,
        className:mappedClass
      });
    }

    Object.entries(node).forEach(([key,value])=>{
      if(
        nameKeys.includes(key) ||
        gradeKeys.includes(key) ||
        sectionKeys.includes(key) ||
        key==='studentClasses'
      ){
        return;
      }

      if(value && typeof value==='object'){
        visit(value,grade,section);
      }
    });
  }

  visit(data);

  const unique=new Map();

  records.forEach(record=>{
    const key=normalizeStudentKey(record.name);
    if(!key) return;

    const current=unique.get(key);

    if(!current){
      unique.set(key,{...record});
      return;
    }

    if(!current.grade && record.grade) current.grade=record.grade;
    if(!current.section && record.section) current.section=record.section;
    if(!current.className && record.className) current.className=record.className;
  });

  return [...unique.values()];
}


function openGamesImportReview(pending,duplicates,missingClass){
  const veil=document.createElement('div');
  veil.className='veil on';
  veil.id='games-import-review';

  const modal=document.createElement('div');
  modal.className='modal';

  const rows=pending.map((student,index)=>{
    const classText=student.className||'غير محدد';
    return `
      <label class="ruled" style="display:block;cursor:pointer">
        <div class="row">
          <input type="checkbox" data-import-index="${index}" checked
                 style="width:18px;height:18px;flex:none">
          <span class="name">${esc(student.name)}</span>
          <span class="pill ${student.className?'quiet':'due'}">${esc(classText)}</span>
        </div>
      </label>`;
  }).join('');

  modal.innerHTML=`
    <h2>مراجعة استيراد الطلاب</h2>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.8rem">
      <span class="pill pts">جديد: ${pending.length}</span>
      ${duplicates.length?`<span class="pill due">مكرر/موجود: ${duplicates.length}</span>`:''}
      ${missingClass.length?`<span class="pill due">بدون صف: ${missingClass.length}</span>`:''}
    </div>
    <p style="margin:0 0 .8rem;color:var(--ink-soft);font-size:.86rem">
      لن تتم إضافة أي طالب حتى تضغط «تأكيد الاستيراد». تم التعرف على الصف/الفصل
      تلقائيًا متى كان موجودًا في ملف JSON.
    </p>
    <div style="display:flex;gap:.4rem;margin-bottom:.7rem">
      <button class="btn ghost sm" type="button" id="games-select-all">تحديد الكل</button>
      <button class="btn ghost sm" type="button" id="games-clear-all">إلغاء الكل</button>
    </div>
    <div id="games-import-list" style="max-height:48vh;overflow:auto">${rows}</div>
    <div class="modal-foot">
      <button class="btn ghost" type="button" id="games-cancel">إلغاء</button>
      <button class="btn tick" type="button" id="games-confirm">تأكيد الاستيراد</button>
    </div>`;

  veil.appendChild(modal);
  document.body.appendChild(veil);

  const close=()=>{
    veil.remove();
  };

  modal.querySelector('#games-cancel').onclick=close;

  modal.querySelector('#games-select-all').onclick=()=>{
    modal.querySelectorAll('[data-import-index]').forEach(input=>input.checked=true);
  };

  modal.querySelector('#games-clear-all').onclick=()=>{
    modal.querySelectorAll('[data-import-index]').forEach(input=>input.checked=false);
  };

  modal.querySelector('#games-confirm').onclick=async()=>{
    const selected=[...modal.querySelectorAll('[data-import-index]:checked')]
      .map(input=>pending[Number(input.dataset.importIndex)])
      .filter(Boolean);

    if(!selected.length){
      toast('حدد طالبًا واحدًا على الأقل','bad');
      return;
    }

    try{
      const existingKeys=new Set(
        (STUDENTS||[]).map(student =>
          `${normalizeStudentKey(student.name)}|${normalizeStudentKey(student.cls||'')}`
        )
      );

      const studentsToAdd=[];

      selected.forEach(student=>{
        const cls=String(student.className||'').trim();
        const key=`${normalizeStudentKey(student.name)}|${normalizeStudentKey(cls)}`;

        if(existingKeys.has(key)) return;

        existingKeys.add(key);
        studentsToAdd.push({
          id:uid(),
          name:student.name,
          cls,
          points:0
        });
      });

      if(!studentsToAdd.length){
        close();
        toast('كل الطلاب المحددين موجودون مسبقاً','bad');
        return;
      }

      STUDENTS.push(...studentsToAdd);
      save(K.st,STUDENTS);
      close();
      renderAll();
      toast(`تم استيراد ${studentsToAdd.length} طالب بنجاح`,'good');
    }catch(error){
      console.error(error);
      toast('تعذر حفظ الطلاب المستوردين','bad');
    }
  };
}
let COMP_GRADES_LOADING = new Map();

async function startPeriod2FromDashboard(){
  const semester=Number(document.getElementById('comp-semester')?.value||DASH_ACADEMIC?.currentSemester||1)===2?2:1;
  const sem=(DASH_ACADEMIC?.semesters||{})[String(semester)]||{};
  if(sem.status==='closed' || Number(sem.activePeriod)===2) return;
  const p1End=String((sem.periods||{})['1']?.end||'');
  const ok=await askConfirm((p1End&&p1End<ctToday()?`سيتم إغلاق الفترة الأولى وحفظ درجاتها كنسخة نهائية، محسوبة حتى ${p1End.replace(/-/g,'/')} كما حددت في الإعدادات. وكل ما نُشر أو رُصد بعد هذا التاريخ يدخل في الفترة الثانية. هل تريد المتابعة؟`:'سيتم إغلاق الفترة الأولى وحفظ درجاتها الحالية كنسخة نهائية، ثم تصبح الفترة الثانية هي الفترة النشطة للرصد. لا تحتاج إلى تحديد تاريخ. هل تريد المتابعة؟'),{title:'بدء الفترة الثانية',yes:'🔒 إغلاق الأولى وبدء الثانية',no:'إلغاء',danger:true});
  if(!ok)return;
  const btn=document.getElementById('dashboard-academic-action'); if(btn)btn.disabled=true;
  try{ await postDashboardAcademic({action:'start_period2',semester,year:String(DASH_ACADEMIC?.year||'')}); }
  catch(e){ if(btn)btn.disabled=false; console.error('start period 2:',e); const st=document.getElementById('dashboard-academic-status'); if(st)st.textContent='تعذّر تنفيذ الانتقال: '+(e.message||'خطأ غير معروف'); }
}

async function startSemester2FromDashboard(){
  const s1=(DASH_ACADEMIC?.semesters||{})['1']||{};
  // الخادم يغلق الفصل الأول بنفسه إن كان في فترته الثانية — كان الزر لا يفعل شيئًا لأنه يشترط أن يكون مغلقًا مسبقًا
  if(!(s1.status==='closed'||(s1.status!=='not_started'&&Number(s1.activePeriod)===2))) return;
  const ok=await askConfirm('سيتم اعتماد درجات الفصل الأول وإغلاقه، ثم بدء الفصل الدراسي الثاني بالفترة الأولى. بيانات الفصل الأول ستبقى محفوظة في الأرشيف ولن تختلط بالرصد الجديد. هل تريد المتابعة؟',{title:'بدء الفصل الدراسي الثاني',yes:'🔒 إغلاق الأول وبدء الثاني',no:'إلغاء',danger:true});
  if(!ok)return;
  const btn=document.getElementById('dashboard-academic-action'); if(btn)btn.disabled=true;
  try{ await postDashboardAcademic({action:'start_semester2',semester:2,year:String(DASH_ACADEMIC?.year||'')}); }
  catch(e){ if(btn)btn.disabled=false; console.error('start semester 2:',e); const st=document.getElementById('dashboard-academic-status'); if(st)st.textContent='تعذّر بدء الفصل الثاني: '+(e.message||'خطأ غير معروف'); }
}

async function finishYearFromDashboard(mode='archive'){
  const s2=(DASH_ACADEMIC?.semesters||{})['2']||{};
  if(s2.status==='closed' || Number(s2.activePeriod)!==2) return;
  const isDelete=mode==='delete';
  const msg=isDelete?'سيتم إنهاء السنة الدراسية وحذف بيانات الرصد والاختبارات الحالية نهائيًا. هذا الإجراء لا يمكن التراجع عنه. هل تريد المتابعة؟':'سيتم إنهاء السنة الدراسية وأرشفة درجات الفصلين وبيانات الرصد، ثم تهيئة النظام لسنة دراسية جديدة. هل تريد المتابعة؟';
  const ok=await askConfirm(msg,{title:isDelete?'حذف بيانات السنة وإنهاؤها':'إنهاء السنة وأرشفتها',yes:isDelete?'🗑️ إنهاء وحذف':'🏁 إنهاء وأرشفة',no:'إلغاء',danger:true});
  if(!ok)return;
  const newYear=window.prompt('أدخل السنة الدراسية الجديدة، أو اتركها فارغة لإكمالها لاحقًا:',String(DASH_ACADEMIC?.year||''));
  if(newYear===null)return;
  const btns=[document.getElementById('dashboard-year-archive'),document.getElementById('dashboard-year-delete'),document.getElementById('dashboard-academic-action')]; btns.forEach(b=>{if(b)b.disabled=true});
  try{ await postDashboardAcademic({action:'end_year',semester:2,mode:isDelete?'delete':'archive',newYear:String(newYear||'').trim()}); }
  catch(e){ btns.forEach(b=>{if(b)b.disabled=false}); console.error('end year:',e); const st=document.getElementById('dashboard-academic-status'); if(st)st.textContent='تعذّر إنهاء السنة: '+(e.message||'خطأ غير معروف'); }
}

async function runDashboardAcademicAction(){
  const semester=Number(document.getElementById('comp-semester')?.value||DASH_ACADEMIC?.currentSemester||1)===2?2:1;
  const sem=(DASH_ACADEMIC?.semesters||{})[String(semester)]||{};
  const active=Number(sem.activePeriod)===2?2:1;
  const s1=(DASH_ACADEMIC?.semesters||{})['1']||{};
  if(semester===1 && sem.status!=='closed' && active===1) return startPeriod2FromDashboard();
  if(semester===1 && sem.status!=='closed' && active===2) return startSemester2FromDashboard();
  if(semester===2 && sem.status==='not_started' && s1.status==='closed') return startSemester2FromDashboard();
  if(semester===2 && sem.status!=='closed' && active===1) return startPeriod2FromDashboard();
  if(semester===2 && sem.status!=='closed' && active===2) return finishYearFromDashboard('archive');
}
function hwToggleGrade(id){
  const h=HW.find(x=>x.id===id); if(!h) return;
  h.noGrade=!h.noGrade; if(h.published) h.dirty=true;
  save(K.hw,HW); renderHw();
  toast((h.noGrade?'🎯 صار تدريبًا — لا يدخل درجة الأنشطة':'📊 صار يدخل في درجة الأنشطة')+(h.published?' · أعد نشره ليظهر للطلاب':''),'good');
}
function twinStop(){TWIN_STOP=true;TWIN_Q.length=0;try{TWIN_AC&&TWIN_AC.abort()}catch(e){}autoRemStatus()}
function twinSetAuto(on){try{localStorage.setItem(TWIN_AUTO_KEY,on?'1':'0')}catch(e){}toast(on?'سيُجهَّز كل نشاط جديد تلقائيًا عند نشره':'أُوقف التجهيز التلقائي — لن يُستهلك رصيد إلا بضغطك');autoRemStatus()}
let TWIN_PICK=null;
function twinBackfillRun(){closeModal();const ids=TWIN_PICK;TWIN_PICK=null;HW.filter(h=>twinNeeded(h)&&(!ids||ids.includes(h.id))).slice(0,20).forEach(twinQueue)}
function twinOne(id){twinBackfill([id])}
/* تشغيل/إيقاف العلاج التلقائي لنشاط: يُعاد نشره بالعلامة فيلتزم بها الخادم */
async function remToggle(id,on){
  const h=HW.find(x=>x.id===id);if(!h)return;
  h.noRem=!on;save(K.hw,HW);autoRemStatus();
  try{await publishHwSilently(h);toast(on?`فُعّل العلاج التلقائي لـ «${h.title}»`:`أُوقف العلاج التلقائي لـ «${h.title}» — لن تُفتح له مهام علاجية`)}
  catch(e){toast('تعذّر تحديث النشاط في الخادم — حاول مرة أخرى','bad')}
}
/* قبل أي استهلاك: كم نشاطًا، كم سؤالًا، كم طلبًا، وبأي نموذج */
function twinBackfill(ids){
  if(!REM_ON){toast('العلاج التلقائي موقوف — فعّله أولًا من المفتاح أعلى القسم','bad');return}
  TWIN_PICK=Array.isArray(ids)?ids:null;
  const list=HW.filter(h=>twinNeeded(h)&&(!TWIN_PICK||TWIN_PICK.includes(h.id))).slice(0,20);if(!list.length){toast('لا يوجد ما يحتاج تجهيزًا');return}
  const p=readingAIPickProvider(),cfg=READING_AI_PROVIDERS[p]||{},calls=list.reduce((t,h)=>t+twinCalls(h),0),qn=list.reduce((t,h)=>t+twinQCount(h),0);
  openModal(`<h2>🧩 تجهيز الأسئلة البديلة</h2>
    <p class="muted" style="font-size:.88rem;margin:.3rem 0 .7rem">سيولّد الذكاء الاصطناعي سؤالين بديلين وتذكيرًا لكل سؤال، لاستخدامها في المهام العلاجية فقط.</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-bottom:.7rem">
      <div class="kpi-box"><span class="muted">أنشطة</span><b>${list.length}</b></div><div class="kpi-box"><span class="muted">أسئلة</span><b>${qn}</b></div><div class="kpi-box"><span class="muted">طلبات للذكاء</span><b>${calls}</b></div></div>
    <div class="muted" style="font-size:.84rem">المزوّد: <b>${planEsc(cfg.name||p)}</b> · النموذج: <b>${planEsc(twinModel(p))}</b> (نموذج اقتصادي سريع لهذه المهمة)</div>
    <ul style="font-size:.84rem;margin:.5rem 0;padding-inline-start:1.1rem;max-height:160px;overflow:auto">${list.map(h=>`<li>${planEsc(h.title||'نشاط')} — ${twinQCount(h)} سؤال (${twinCalls(h)} طلب)</li>`).join('')}</ul>
    <div class="muted" style="font-size:.8rem">تستطيع الإيقاف في أي لحظة، وما اكتمل يبقى محفوظًا. يتوقف تلقائيًا عند أي خطأ في المفتاح أو الرصيد.</div>
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn tick" onclick="twinBackfillRun()">ابدأ التجهيز</button></div>`);
}
/* 👁️ دليل الناتج: الأسئلة البديلة المحفوظة فعلًا في الخادم */
async function twinPreview(id){
  const h=HW.find(x=>x.id===id);if(!h)return;
  openModal('<h2>جارٍ التحميل…</h2>');
  let tw=null;try{const r=await fetch(getApi().replace(/\/+$/,'')+'/twins?t='+encodeURIComponent(getTok())+'&hw='+encodeURIComponent(h.sid));const j=await r.json();tw=j&&j.twins}catch(e){}
  if(!tw||!Array.isArray(tw.items)||!tw.items.length){openModal(`<h2>لا توجد أسئلة محفوظة</h2><p class="muted">لم تُحفظ أسئلة بديلة لهذا النشاط في الخادم بعد.</p><div class="modal-foot"><button class="btn" onclick="closeModal()">إغلاق</button></div>`);return}
  const qtxt=a=>a.t==='tf'?`${planEsc(a.q)} <b>(${a.a?'صح':'خطأ'})</b>`:a.t==='f'?`${planEsc(a.q)} <b>(${planEsc(a.a)})</b>`:`${planEsc(a.q)}<div class="muted" style="font-size:.8rem">${(a.o||[]).map((o,i)=>i===a.a?`<b style="color:var(--tick)">✓ ${planEsc(o)}</b>`:planEsc(o)).join(' · ')}</div>`;
  openModal(`<h2>🧩 الأسئلة البديلة — ${planEsc(h.title||'')}</h2>
    <p class="muted" style="font-size:.82rem;margin:.2rem 0 .6rem">${tw.items.length} سؤالًا أصليًا لها بدائل · حُفظت ${new Date(tw.at).toLocaleString('ar-SA')}</p>
    <div style="max-height:60vh;overflow:auto;display:grid;gap:.6rem">${tw.items.map(it=>{const o=(h.qs||[])[it.i]||{};return `<div class="dx-box"><div style="font-size:.82rem"><b>السؤال ${it.i+1}:</b> ${planEsc(o.q||'')}</div>
      ${it.tip?`<div style="font-size:.8rem;margin:.3rem 0;color:#7A5212">💡 ${planEsc(it.tip)}</div>`:''}
      ${it.alts.map((a,k)=>`<div style="font-size:.84rem;margin-top:.3rem">بديل ${k+1}: ${qtxt(a)}</div>`).join('')}</div>`}).join('')}</div>
    <div class="modal-foot"><button class="btn" onclick="closeModal()">إغلاق</button></div>`);
}
async function remSetEnabled(on){
  try{const r=await fetch(getApi().replace(/\/+$/,'')+'/rem-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),enabled:!!on})});
    const j=await r.json();if(!j||!j.ok)throw 0;REM_ON=!!j.enabled;
    if(!REM_ON)twinStop();
    toast(REM_ON?'🤖 فُعّل العلاج التلقائي':'⏸ أُوقف العلاج التلقائي — لن تُفتح مهام علاجية جديدة');
  }catch(e){toast(r404Hint(),'bad')}
  renderAutoRem();
}
function r404Hint(){return 'تعذّر حفظ الإعداد في الخادم — تأكد من رفع worker.js الأخير'}
function remPlanFor(remId){
  const x=(REM_ROWS||[]).find(r=>String(r.id)===String(remId)); if(!x) return;
  if(!(STUDENTS||[]).some(s=>String(s.id)===String(x.sid))){ toast('الطالب غير موجود في الكشف الحالي','bad'); return; }
  const pl=remActivePlan(x.sid); if(pl){ openPlanForm(pl.id); toast('له خطة قائمة — حدّثها بدل إنشاء خطة جديدة'); return; }
  openPlanForm('');
  const sel=document.getElementById('pf-student'); if(!sel) return;
  sel.value=String(x.sid); showDiagnosis(sel.value,true);
  const tries=(x.attempts||[]).map((a,i)=>a.rate!=null?`م${i+1} ${a.rate}%`:`م${i+1} لم يحل`).join(' · ');
  const why=`أخفق مرتين في المهمة العلاجية لـ«${x.srcTitle||x.reason||'النشاط'}» (قبل ${x.before!=null?x.before+'%':'—'}${tries?' · '+tries:''})`;
  const rs=document.getElementById('pf-reason'); if(rs) rs.value=why+(rs.value?' — '+rs.value:'');
  const act=`جلسة فردية قصيرة لمراجعة أخطائه في «${x.srcTitle||'النشاط'}» قبل أي مهمة جديدة`;
  window._pfActions=[act,...(window._pfActions||[]).filter(a=>a!==act)]; renderPlanActions();
}
async function remClean(){
  const all=REM_ROWS||[], op=remOpenPlanIds(), can=remCleanable(all);
  const inPlan=all.filter(x=>x.status==='mastered'&&x.planId&&op.has(String(x.planId))).length, esc=all.filter(x=>x.status==='escalated').length;
  if(!can.length){toast('لا مهام منتهية قابلة للحذف');return}
  const ok=await askConfirm(`تُحذف ${can.length} ${can.length===1?'مهمة علاجية أتقنها الطالب':'مهام علاجية أتقنها الطلاب'}: تختفي من بوابات الطلاب ومن هذا السجل، وتُحذف إجاباتهم فيها. نقاطهم تبقى.${inPlan?`\n\nتبقى ${inPlan} لأنها تتبع خطة مفتوحة — نتيجتها تقيس الخطة؛ تُحذف بعد إنهاء الخطة.`:''}${esc?`\nتبقى ${esc} «يحتاج تدخلك» حتى تتصرّف فيها.`:''}\nالمفتوحة التي لم تُحل لا تُحذف.`,{title:'حذف المهام العلاجية المنتهية؟',yes:'🧹 احذف',no:'إلغاء',danger:true});
  if(!ok)return;
  try{const r=await fetch(getApi().replace(/\/+$/,'')+'/rem-clean',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok()})});
    const j=await r.json().catch(()=>({}));
    if(r.status===404&&!j.ok)throw new Error('ارفع worker.js الأخير');
    if(!j.ok)throw new Error(j.error||'تعذّر الحذف');
    toast(`🧹 حُذفت ${j.deleted} ${j.deleted===1?'مهمة':'مهام'}${j.keptPlan?` · بقيت ${j.keptPlan} لخطط مفتوحة`:''}`,'good');
    await renderAutoRem();
  }catch(e){toast(e.message||'تعذّر الحذف','bad')}
}
async function remExtend(id){
  const x=(REM_ROWS||[]).find(r=>String(r.id)===String(id));
  try{
    const r=await fetch(getApi().replace(/\/+$/,'')+'/rem-extend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),id,days:7})});
    const j=await r.json().catch(()=>({}));
    if(r.status===404&&!j.error) throw new Error('ارفع worker.js الأخير');
    if(!j.ok) throw new Error(j.error==='already_done'?'حلّها الطالب بالفعل':j.error==='task_expired'?'انتهت صلاحية المهمة على الخادم — أرسل له مهمة جديدة من الخطة':j.error==='not_open'?'المهمة لم تعد مفتوحة':j.error==='not_found'?'ارفع worker.js الأخير':(j.error||'تعذّر التمديد'));
    if(x){ const a=(x.attempts||[])[(x.attempts||[]).length-1]; if(a) a.due=j.due; }
    toast(`🔓 فُتحت المهمة${x&&x.name?' لـ'+x.name:''} حتى ${j.due}`,'good');
    try{ renderAutoRem(); }catch(e){} try{ renderPlans(true); }catch(e){}
  }catch(e){ toast(e.message||'تعذّر التمديد','bad'); }
}
/* 🔁 جولة جديدة (مهمة تحقق): src = plan:<id>:<n> — الخادم يقبل مهمة واحدة لكل مصدر */
function planNextRound(p){let n=1;planRemRows(p).forEach(x=>{const m=/^plan:[^:]+:(\d+)$/.exec(String(x.src||''));n=Math.max(n,m?+m[1]:1)});return n+1}
/* يسأل الخادم: أي أنشطة ستُبنى منها المهمة وتنقصها أسئلة بديلة؟ ثم يجهّزها بمفتاح الذكاء الاصطناعي وينتظر انتهاءها.
   يعيد سطرًا يُعرض في نتيجة الإرسال (أو '' إن لم يلزم شيء). */
async function planEnsureTwins(planId,sids){
  let need=[];
  try{const r=await fetch(getApi().replace(/\/+$/,'')+'/plan-twins-need',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),planId,sids})});
    const j=await r.json();if(j&&j.ok&&Array.isArray(j.need))need=j.need}catch(e){return ''}   // خادم قديم: يُرسل كما كان
  if(!need.length) return '';
  let list=need.map(x=>HW.find(h=>String(h.sid)===String(x.hw))).filter(h=>h&&Array.isArray(h.qs)&&h.qs.length);
  // 🧭 أنشطة نافس: بدائلها من البنك فورًا، والباقي بالذكاء الاصطناعي كما هو
  const nf=list.filter(h=>typeof hwIsNafs==='function'&&hwIsNafs(h));
  let nfNote='';
  if(nf.length){ const ok=(await Promise.all(nf.map(h=>nafsTwinsSave(h)))).filter(Boolean).length;
    nfNote=ok?`🧭 جُهّزت أسئلة بديلة من بنك نافس لـ${ok} ${ok===1?'نشاط':'أنشطة'}. `:''; list=list.filter(h=>!nf.includes(h)); }
  if(!list.length) return nfNote;
  if(!twinHasKey()) return nfNote+`⚠️ ${list.length} ${list.length===1?'نشاط':'أنشطة'} بلا أسئلة بديلة (${list.map(h=>'«'+planEsc(h.title)+'»').join('، ')}) ولا يوجد مفتاح ذكاء اصطناعي لتجهيزها — أضفه من ⚙️ الإعدادات.`;
  if(TWIN_BUSY){ openModal('<h2>🧩 تجهيز الأسئلة البديلة</h2><p class="muted">تجهيز آخر قيد التشغيل — ننتظره…</p>'); for(let i=0;i<480&&TWIN_BUSY;i++) await new Promise(r=>setTimeout(r,500)); }
  // يُعاد التجهيز حتى للنشاط المجهَّز جزئيًا (سؤال لم يُولَّد له بديل)
  list.forEach(h=>{ delete h.twinsHash; try{REM_TWINS&&REM_TWINS.delete(String(h.sid))}catch(e){} });
  const queued=list.filter(h=>twinEligible(h)); queued.forEach(twinQueue);
  const t0=Date.now();
  while((TWIN_BUSY||TWIN_Q.length)&&Date.now()-t0<6*60000){
    openModal(`<h2>🧩 تجهيز الأسئلة البديلة قبل الإرسال</h2>
      <p style="font-size:.9rem;line-height:1.9">المهمة ستُبنى من أخطائه في ${queued.length} ${queued.length===1?'نشاط':'أنشطة'} بلا أسئلة بديلة. نجهّزها الآن بالذكاء الاصطناعي حتى تكون أسئلة المهمة <b>جديدة لم يرها</b> فتُحتسب في القياس.</p>
      <div class="pdl-prog"><b class="pdl-cnt">${planEsc(TWIN_NOW||'…')}</b><small>نجح ${TWIN_OK} · المتبقي ${TWIN_Q.length+(TWIN_CUR?1:0)} — لا تغلق الصفحة</small></div>`);
    await new Promise(r=>setTimeout(r,700));
  }
  const fail=queued.filter(h=>!twinReady(h)), skipped=list.length-queued.length;
  return nfNote+(fail.length||skipped
    ? `⚠️ جُهّزت الأسئلة البديلة لـ${queued.length-fail.length} من ${list.length} ${list.length===1?'نشاط':'أنشطة'}${TWIN_ERR?` — ${planEsc(TWIN_ERR)}`:''}`
    : `🧩 جُهّزت الأسئلة البديلة تلقائيًا لـ${list.length} ${list.length===1?'نشاط':'أنشطة'} قبل الإرسال.`);
}
async function planSendRemedial(id,verify){
  const p=(PLAN_DATA&&PLAN_DATA.plans||[]).find(x=>x.id===id);if(!p)return;
  const rows=planRemRows(p),ids=planMemberIds(p).filter(Boolean),sent=new Set(rows.map(x=>String(x.sid)));
  const busy=new Set(rows.filter(x=>x.status==='open'||x.status==='retry').map(x=>String(x.sid)));
  let todo=ids.filter(i=>!sent.has(i)), round=0;
  if(!todo.length||verify){ todo=ids.filter(i=>!busy.has(i)); round=planNextRound(p);
    if(!todo.length){toast('لديهم مهمة علاجية مفتوحة لم تُحل بعد — انتظر حلّها');return} }
  window._planRound=round;
  openModal(`<h2>🩹 ${round?'إرسال مهمة تحقق':'إرسال مهمة علاجية'}</h2>
    ${round?`<p class="plan-note" style="font-size:.85rem">مهمة جديدة (الجولة ${round}) لقياس الإتقان بعد التدريس: حتى <b>3 أسئلة بديلة لكل مهارة</b> من أخطائه — صياغة جديدة لا يعرف إجابتها. نتيجتها تُحتسب في قياس الأثر وتحسم الخطة.</p>`:''}
    <p style="font-size:.9rem;line-height:1.9">سيصل ${p.group?`لكل عضو من ${todo.length} طلاب`:'للطالب'} في بوابته «🎯 طوّر مستواك» مهمة شخصية من <b>أخطائه هو</b> ${Array.isArray(p.skills)&&p.skills.length?`في المهارات المستهدفة وحدها (${p.skills.map(planEsc).join('، ')})، موزّعة بينها`:'في أضعف نشاطين له (لم تُحدَّد للخطة مهارة مفقودة)'}، بأسئلة بديلة وتذكير بالمفهوم.</p>
    <ul style="font-size:.84rem;color:var(--ink-soft);line-height:1.9;margin:.3rem 0 .6rem;padding-inline-start:1.1rem">
      <li>لا تؤثر في درجته؛ نقاط متجر فقط.</li><li>إتقان 80% يغلقها، وإلا تأتيه محاولة ثانية بأسئلة مختلفة.</li>
      <li>نتيجتها تظهر في هذه الخطة، ويُعلَّم إجراء «${PLAN_REM_ACTION}» منفَّذًا عندما يحلها.</li>
      <li>أسئلتها <b>بديلة جديدة</b> لا يعرف إجابتها؛ ما ينقص منها يُجهَّز تلقائيًا بالذكاء الاصطناعي قبل الإرسال (مرة واحدة لكل نشاط).</li></ul>
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn tick" onclick="planSendRemedialGo('${planEsc(id)}')">أرسل</button></div>`);
}
async function planSendRemedialGo(id){
  const p=(PLAN_DATA&&PLAN_DATA.plans||[]).find(x=>x.id===id);if(!p)return;
  const round=window._planRound||0, rows=planRemRows(p);
  const busy=new Set(rows.filter(x=>x.status==='open'||x.status==='retry').map(x=>String(x.sid)));
  const sent=new Set(rows.map(x=>String(x.sid))),todo=round?planMemberIds(p).filter(i=>i&&!busy.has(i)):planMemberIds(p).filter(i=>i&&!sent.has(i));
  // 🧩 قبل الإرسال: جهّز الأسئلة البديلة الناقصة في الأنشطة التي ستُبنى منها المهمة — بدونها يأتيه السؤال الأصلي فلا تُحتسب
  const twinNote=await planEnsureTwins(id,todo);
  openModal('<h2>جارٍ الإرسال…</h2>');
  let j=null;
  try{const r=await fetch(getApi().replace(/\/+$/,'')+'/plan-remedial',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),planId:id,sids:todo,...(round?{round}:{})})});j=await r.json();
    if(r.status===404||!j||(!j.ok&&/not found/i.test(String(j.error||''))))throw new Error('ارفع worker.js الأخير ثم أعد المحاولة');
    if(!j.ok)throw new Error(j.error||'تعذّر الإرسال');}
  catch(e){openModal(`<h2>تعذّر الإرسال</h2><p class="muted">${planEsc(e.message||e)}</p><div class="modal-foot"><button class="btn" onclick="closeModal()">إغلاق</button></div>`);return}
  const res=j.results||[],ok=res.filter(x=>x.ok),bad=res.filter(x=>!x.ok);
  // أضف الإجراء إلى الخطة إن لم يكن فيها، ليُعلَّم لاحقًا عند الحل
  if(ok.length){try{const raw=(window._classroomData&&window._classroomData.plans||[]).find(x=>x.id===id);
    if(!raw||!(raw.actions||[]).some(a=>a.text===PLAN_REM_ACTION)) await savePlans(all=>all.map(x=>x.id===id&&!(x.actions||[]).some(a=>a.text===PLAN_REM_ACTION)?{...x,actions:[...(x.actions||[]),{text:PLAN_REM_ACTION,done:false}]}:x));}catch(e){}}
  openModal(`<h2>${ok.length?'✅ أُرسلت المهمة':'لم تُرسل أي مهمة'}</h2>
    ${ok.length?`<p style="font-size:.9rem">وصلت ${ok.length===1?'لـ':'إلى'} ${ok.map(x=>planEsc(x.name)).join('، ')} في «🎯 طوّر مستواك».</p>`:''}
    ${twinNote?`<p class="plan-note" style="font-size:.84rem">${twinNote}</p>`:''}
    ${ok.some(x=>x.fb)?`<p class="plan-warn" style="font-size:.84rem">⚠️ ${ok.filter(x=>x.fb).map(x=>planEsc(x.name)).join('، ')}: بعض الأسئلة هي السؤال الأصلي نفسه بخيارات مرتبة من جديد (لا توجد له أسئلة بديلة) — تدريب مفيد، لكنها <b>لا تُحتسب في قياس الأثر</b>. جهّز «🧩 الأسئلة البديلة» لأنشطة هذه المهارات قبل المهمة القادمة.</p>`:''}
    ${bad.length?`<ul style="font-size:.85rem;color:var(--ink-soft)">${bad.map(x=>`<li>${planEsc(x.name||x.sid)}: ${planEsc(x.reason)}</li>`).join('')}</ul>`:''}
    <div class="modal-foot"><button class="btn" onclick="closeModal()">تم</button></div>`);
  await renderAutoRem();renderPlans(true);
}
const PLAN_TEACHER_ACTIONS=['مجموعة صغيرة مع المعلم 10 دقائق مرتين أسبوعيًا','التواصل مع ولي الأمر لمتابعة المذاكرة في المنزل'];
const addDays=(d,n)=>{const t=Date.parse(String(d)+'T00:00:00Z');return t?new Date(t+n*86400000).toISOString().slice(0,10):''};
async function planDecide(id,decision){
  const p=(PLAN_DATA&&PLAN_DATA.plans||[]).find(x=>x.id===id);if(!p)return;
  const D=PLAN_DECISIONS[decision];if(!D)return;
  if(!confirm(`${D.icon} ${D.t}\n\n${D.d}`))return;
  const t=p.timing||{},today=new Date().toISOString().slice(0,10); let newRound=t.round||1, sendTask=false;
  const apply=r=>{
  const snap={at:today,decision,label:D.t,verdict:p.verdict,gain:p.gain,after:p.after&&p.after.measured?p.after.rate:null,round:t.round||1};
  r.history=[...(r.history||[]),snap];
  const base=today>(t.due||today)?today:(t.due||today);
  sendTask=false;
  if(decision==='close_success'){r.status='done';r.endDate=today;r.outcome='نجحت الخطة'}
  else if(decision==='refer'){r.status='done';r.endDate=today;r.outcome='أُحيل للمرشد الطلابي وأُبلغ ولي الأمر'}
  else{
    const add=decision==='extend_measure'?7:14;
    r.dueDate=addDays(base,add);r.round=(t.round||1)+1;sendTask=decision!=='change';
    if(decision==='change'){r.interventionChanged=true;
      PLAN_TEACHER_ACTIONS.forEach(a=>{if(!(r.actions||[]).some(x=>x.text===a))r.actions.push({text:a,done:false})})}
  }
  newRound=r.round||newRound; };
  try{await savePlans(all=>{ const r=all.find(x=>x.id===id); if(r) apply(r); return all; })}catch(e){toast('تعذّر حفظ القرار','bad');return}
  toast(`${D.icon} ${D.t}`);
  if(sendTask){try{const sids=planMemberIds(p).filter(Boolean);
    const rs=await fetch(getApi().replace(/\/+$/,'')+'/plan-remedial',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),planId:id,sids,round:newRound})});
    const j=await rs.json();const ok=(j.results||[]).filter(x=>x.ok).length;if(ok)toast(`🩹 أُرسلت مهمة علاجية جديدة لـ ${ok} ${ok===1?'طالب':'طلاب'}`)}catch(e){}}
  renderPlans(true);
}
/* ✏️ تعديل إعلان منشور: العنوان والنص والفصول والمرفقات (حذف/إضافة) — يبقى تاريخه ووقت ظهوره كما هو */
let ANN_ED=null;
function annEditOpen(id){
  const a=ANN_ROWS.find(x=>x.id===id); if(!a) return;
  ANN_ED={ id, drop:new Set(), add:[] };
  const cls=[...new Set((STUDENTS||[]).map(s=>String(s.cls||s.className||'')).filter(Boolean))].sort((x,y)=>x.localeCompare(y,'ar')), on=new Set(a.classes||[]);
  openModal(`<h2>✏️ تعديل الإعلان</h2><p class="muted" style="margin:-.2rem 0 .8rem;font-size:.84rem">يتحدّث عند الطلاب فورًا، ويبقى تاريخه ووقت ظهوره كما هو.</p>
    <div class="field"><label>العنوان</label><input class="inp" id="ae-title" maxlength="140" value="${esc(a.title||'')}"></div>
    <div class="field"><label>النص</label><textarea class="inp" id="ae-body" rows="5" maxlength="3000">${esc(a.body||'')}</textarea><small class="ann-hint">🔘 الرابط يظهر للطلاب زرًّا. لتسميته اكتب الاسم ثم الرابط في السطر نفسه: <code>وثيقة المسابقة https://…</code></small></div>
    <div class="field"><label>يظهر لـ</label><div class="ann-cls" id="ae-classes"><label class="ann-chip"><input type="checkbox" value="" ${on.size?'':'checked'}> كل الطلاب</label>${cls.map(c=>`<label class="ann-chip"><input type="checkbox" value="${esc(c)}" ${on.has(c)?'checked':''}> ${esc(c)}</label>`).join('')}</div></div>
    <div class="field"><label>المرفقات</label><div id="ae-files" class="ae-files"></div>
      <label class="btn ghost sm" style="margin-top:.4rem">📎 إضافة مرفق<input type="file" id="ae-add" accept="image/*,video/mp4,video/webm,video/quicktime,application/pdf,.ppt,.pptx,.ppsx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" multiple hidden></label></div>
    <div class="ann-progress hide" id="ae-progress"><i></i><span></span></div>
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn tick" id="ae-save" onclick="annEditSave()">💾 حفظ التعديل</button></div>`);
  const box=document.getElementById('ae-classes');
  box.addEventListener('change',e=>{const all=box.querySelector('input[value=""]');if(e.target===all&&all.checked)box.querySelectorAll('input:not([value=""])').forEach(x=>x.checked=false);else if(e.target!==all&&e.target.checked)all.checked=false;
    if(![...box.querySelectorAll('input')].some(x=>x.checked))all.checked=true});
  document.getElementById('ae-add').addEventListener('change',e=>{
    for(const f of e.target.files){const k=annKindOf(f.type,f.name);
      if(!k){toast(`«${f.name}» نوع غير مدعوم — صورة أو فيديو أو PDF أو PowerPoint فقط`,'bad');continue}
      if(f.size>ANN_LIM[k]*1048576){toast(`«${f.name}» أكبر من ${ANN_LIM[k]}MB`,'bad');continue}
      ANN_ED.add.push(f)}
    e.target.value=''; annEditFiles(); });
  annEditFiles();
}
function annEditFiles(){
  const a=ANN_ROWS.find(x=>x.id===ANN_ED.id), el=document.getElementById('ae-files'); if(!a||!el) return;
  const old=(a.files||[]).map((f,i)=>`<span class="ann-file ${ANN_ED.drop.has(i)?'gone':''}">${annIcon(f.kind)} ${esc(f.name)}${ANN_ED.drop.has(i)?' <small>سيُحذف</small>':''}<button type="button" onclick="ANN_ED.drop.has(${i})?ANN_ED.drop.delete(${i}):ANN_ED.drop.add(${i});annEditFiles()" title="${ANN_ED.drop.has(i)?'تراجع':'حذف'}">${ANN_ED.drop.has(i)?'↩️':'✕'}</button></span>`);
  const neu=ANN_ED.add.map((f,i)=>`<span class="ann-file new">${annIcon(annKindOf(f.type,f.name))} ${esc(f.name)} <small>جديد · ${annMB(f.size)}</small><button type="button" onclick="ANN_ED.add.splice(${i},1);annEditFiles()">✕</button></span>`);
  el.innerHTML=old.concat(neu).join('')||'<span class="muted" style="font-size:.84rem">لا مرفقات.</span>';
}
function annEditSave(){
  const a=ANN_ROWS.find(x=>x.id===ANN_ED.id); if(!a) return;
  const title=document.getElementById('ae-title').value.trim(), body=document.getElementById('ae-body').value.trim();
  const left=(a.files||[]).length-ANN_ED.drop.size+ANN_ED.add.length;
  if(!title&&!body&&!left){toast('اكتب عنوانًا أو أبقِ مرفقًا','bad');return}
  if(left>6){toast('الحد 6 مرفقات','bad');return}
  const classes=[...document.querySelectorAll('#ae-classes input:checked')].map(x=>x.value).filter(Boolean);
  const fd=new FormData(); fd.append('t',getTok()); fd.append('id',a.id); fd.append('title',title); fd.append('body',body); fd.append('classes',JSON.stringify(classes)); fd.append('remove',JSON.stringify([...ANN_ED.drop]));
  ANN_ED.add.forEach(f=>fd.append('files',f,f.name));
  const pr=document.getElementById('ae-progress'), btn=document.getElementById('ae-save'); btn.disabled=true; if(ANN_ED.add.length) pr.classList.remove('hide');
  const xhr=new XMLHttpRequest(); xhr.open('POST',getApi().replace(/\/+$/,'')+'/ann-edit');
  xhr.upload.onprogress=e=>{if(e.lengthComputable){const p=Math.round(e.loaded/e.total*100);pr.querySelector('i').style.width=p+'%';pr.querySelector('span').textContent=`جارٍ الرفع ${p}%`}};
  xhr.onload=()=>{btn.disabled=false; pr.classList.add('hide'); let j={}; try{j=JSON.parse(xhr.responseText)}catch(e){}
    if(xhr.status===404&&!j.error){toast('ارفع worker.js الأخير ثم أعد المحاولة','bad');return}
    if(!j.ok){toast(j.error==='too_big'?`«${j.name}» أكبر من المسموح`:j.error==='bad_type'?`«${j.name}» نوع غير مدعوم`:j.error==='too_many'?'الحد 6 مرفقات':'تعذّر حفظ التعديل','bad');return}
    closeModal(); toast('✏️ عُدّل الإعلان — تحدّث عند الطلاب','good'); annLoad(); };
  xhr.onerror=()=>{btn.disabled=false; pr.classList.add('hide'); toast('انقطع الاتصال','bad')};
  xhr.send(fd);
}
async function annTimePost(id,from,until,msg){
  try{const r=await fetch(getApi().replace(/\/+$/,'')+'/ann-time',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),id,from:from||0,until:until||0})});
    if(r.status===404){toast('ارفع worker.js الأخير ثم أعد المحاولة','bad');return}
    const j=await r.json();if(!j.ok)throw new Error(j.error);toast(msg,'good');annLoad()}
  catch(e){toast(String(e.message)==='until_before_from'?'وقت الاختفاء يجب أن يكون بعد وقت الظهور':'تعذّر حفظ الوقت','bad')}
}
function annTimeSet(id,what){
  const a=ANN_ROWS.find(x=>x.id===id);if(!a)return;const now=Date.now();
  if(what==='hide') annTimePost(id,a.showFrom&&a.showFrom<now?a.showFrom:0,now,'⏹️ أُخفي الإعلان عن الطلاب');
  else annTimePost(id,0,a.showUntil&&a.showUntil>now?a.showUntil:0,'▶️ ظهر الإعلان للطلاب الآن');
}
function annTimeSave(id){
  const ins=document.querySelectorAll(`#ann-ed-${CSS.escape(id)} input`),from=annMs(ins[0].value),until=annMs(ins[1].value);
  if(until&&until<=(from||Date.now())){toast('وقت الاختفاء يجب أن يكون بعد وقت الظهور','bad');return}
  annTimePost(id,from,until,'⏰ حُفظ وقت الظهور');
}
async function annDelete(id){
  if(!(await askConfirm('سيُحذف الإعلان وملفاته من بوابة الطلاب نهائيًا.',{title:'حذف الإعلان؟',yes:'احذف',no:'رجوع'})))return;
  try{const r=await fetch(getApi().replace(/\/+$/,'')+'/ann-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),id})});const j=await r.json();if(!j.ok)throw 0;toast('حُذف الإعلان');annLoad()}
  catch(e){toast('تعذّر الحذف','bad')}
}
function skillSetAuto(on){try{localStorage.setItem(SKILL_AUTO_KEY,on?'1':'0')}catch(e){}toast(on?'🏷️ سيُصنَّف كل نشاط جديد تلقائيًا عند نشره':'أُوقف التصنيف التلقائي — صنّف يدويًا متى شئت');autoRemStatus()}

/* ═══ ✉️ رسالة لولي الأمر: عند بدء الخطة أو نتيجتها ═══ */
function planParentMsg(id){
  const p=(PLAN_DATA&&PLAN_DATA.plans||[]).find(x=>x.id===id);if(!p)return;
  const names=p.group?(p.members||[]).map(m=>m.name):[p.name];
  const subj=rcGet('subject')||'العلوم', teacher=rcGet('teacher')||'معلم المادة', fmt=d=>String(d||'').replace(/-/g,'/');
  const goal=Array.isArray(p.skills)&&p.skills.length?p.skills.join('، '):String(p.reason||'').split(' — ').slice(1).join(' — ')||String(p.reason||'');
  const done=p.status==='done';
  const one=n=>done
    ? `السلام عليكم، ولي أمر الطالب ${n}،\n\nانتهت الخطة العلاجية لابنكم في مادة ${subj}.\n📊 النتيجة: ${p.outcome||p.verdict}${p.before&&p.after&&p.before.measured&&p.after.measured?` — من ${p.before.rate}% إلى ${p.after.rate}%`:''}.\n${p.outcome&&/نجحت/.test(p.outcome)?'شكرًا لمتابعتكم، ونأمل المحافظة على هذا المستوى.':'نأمل التواصل معنا لمتابعة الخطوات القادمة.'}\n\n${teacher}`
    : `السلام عليكم، ولي أمر الطالب ${n}،\n\nبدأنا خطة علاجية لابنكم في مادة ${subj} لمدة ${p.timing&&p.timing.days||14} يومًا (حتى ${fmt(p.timing&&p.timing.due)}).\n🎯 الهدف: ${goal}\n📱 المطلوب: متابعة حلّه للمهمة العلاجية في بوابة الطالب «🎯 طوّر مستواك»، ومراجعة الدرس معه في المنزل.\n\nنشكر تعاونكم.\n${teacher}`;
  const text=names.map(one).join('\n\n— — —\n\n')+(typeof parFooter==='function'?parFooter():'');
  openModal(`<h2>✉️ رسالة لولي الأمر — ${done?'نتيجة الخطة':'بدء الخطة'}</h2>
    <textarea class="inp" id="plan-pm" rows="12" style="width:100%;line-height:1.8">${planEsc(text)}</textarea>
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إغلاق</button>
      <button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('plan-pm').value).then(()=>toast('📋 نُسخت الرسالة','good'))">📋 نسخ</button>
      <a class="btn tick" target="_blank" rel="noopener" onclick="this.href='https://wa.me/?text='+encodeURIComponent(document.getElementById('plan-pm').value)">واتساب</a></div>`);
}

/* ═══ 📊 تقرير إجمالي للخطط العلاجية (شاهد للأداء الوظيفي وزيارة المشرف) ═══ */
function printPlansSummary(){
  const all=(PLAN_DATA&&PLAN_DATA.plans)||[];if(!all.length){toast('لا توجد خطط','bad');return}
  ensureLogo();
  let box=document.getElementById('plan-print');if(!box){box=document.createElement('div');box.id='plan-print';box.className='rep';document.body.appendChild(box)}
  const students=all.reduce((t,p)=>t+(p.size||1),0), done=all.filter(p=>p.status==='done'), active=all.length-done.length;
  const success=done.filter(p=>/نجحت/.test(p.outcome||'')).length, referred=done.filter(p=>/أُحيل/.test(p.outcome||'')).length;
  const gains=all.filter(p=>p.gain!=null).map(p=>p.gain), avgG=gains.length?Math.round(gains.reduce((a,b)=>a+b,0)/gains.length):null;
  const improved=all.filter(p=>p.verdict==='تحسّن').length, bySkill=all.filter(p=>p.basis==='skills').length;
  const sure=all.filter(p=>p.verdict==='تحسّن'&&p.confidence&&p.confidence.level!=='weak').length;
  const nets=all.filter(p=>p.net!=null).map(p=>p.net), avgNet=nets.length?Math.round(nets.reduce((a,b)=>a+b,0)/nets.length):null;
  const confTxt=c=>!c?'—':c.level==='strong'?'مؤكد':c.level==='likely'?'مرجّح':'غير مؤكد';
  const pat={};all.forEach(p=>{const k=String(p.reason||'').split(' — ')[0]||'غير محدد';pat[k]=(pat[k]||0)+1});
  const dt=new Date(),today=`${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`;
  const pc=(a,b)=>b?Math.round(a/b*100)+'%':'—';
  box.innerHTML=`<div class="rep-page plan-doc">${repHead('ملخص الخطط العلاجية','تقرير إجمالي')}
    <div class="rep-in">
      <div class="rep-info"><div>المادة<b>${esc(rcGet('subject')||'العلوم')}</b></div><div>المعلم<b>${esc(rcGet('teacher')||'')}</b></div><div>تاريخ التقرير<b>${today}</b></div><div>عدد الخطط<b>${all.length}</b></div>
        <div>الطلاب المستفيدون<b>${students}</b></div><div>منتهية / جارية<b>${done.length} / ${active}</b></div><div>نسبة النجاح (من المنتهية)<b>${pc(success,done.length)}</b></div><div>متوسط التحسّن<b>${avgG==null?'—':(avgG>0?'+':'')+avgG+' نقطة'}</b></div></div>
      <div class="rep-sec">أولًا: الأثر</div>
      <div class="rep-box"><table class="rt"><thead><tr><th>تحسّن</th><th>تحسّن مؤكد إحصائيًا</th><th>متوسط الأثر الصافي</th><th>نجحت وأُغلقت</th><th>أُحيلت للمرشد</th><th>قيست بالمهارة نفسها</th></tr></thead>
        <tbody><tr><td>${improved} (${pc(improved,all.length)})</td><td>${sure}</td><td>${avgNet==null?'—':planSigned(avgNet)+' نقطة'}</td><td>${success}</td><td>${referred}</td><td>${bySkill} من ${all.length}</td></tr></tbody></table>
        <div class="plan-note">القياس من إجابات الطلاب الفعلية: خط الأساس آخر 30 يومًا قبل كل خطة، والأنشطة العلاجية مستبعدة لأنها تدريب على الأسئلة نفسها. يُحكم بالتحسّن عند فرق 5 نقاط فأكثر،
          و«مؤكد إحصائيًا» إذا تجاوز هامش الصدفة لعدد الأسئلة (ثقة 80% فأكثر). الأثر الصافي = تغيّر الطالب − تغيّر زملائه في الفصل خلال الفترة نفسها.</div></div>
      <div class="rep-sec">ثانيًا: أنماط التعثّر</div>
      <div class="rep-box"><table class="rt"><thead><tr><th>النمط</th><th>عدد الخطط</th></tr></thead><tbody>${Object.entries(pat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td style="text-align:start">${planEsc(k)}</td><td>${v}</td></tr>`).join('')}</tbody></table></div>
      <div class="rep-sec">ثالثًا: تفاصيل الخطط</div>
      <div class="rep-box"><table class="rt"><thead><tr><th>م</th><th>الطالب / المجموعة</th><th>الفصل</th><th>البدء</th><th>قبل</th><th>بعد</th><th>الفرق</th><th>الدلالة</th><th>الأثر الصافي</th><th>النتيجة</th></tr></thead><tbody>
        ${all.map((p,i)=>`<tr><td>${i+1}</td><td style="text-align:start">${planEsc(p.name)}</td><td>${planEsc(p.cls||'')}</td><td>${planEsc(String(p.startDate||'').replace(/-/g,'/'))}</td>
          <td>${p.before&&p.before.measured?p.before.rate+'%':'—'}</td><td>${p.after&&p.after.measured?p.after.rate+'%':'—'}</td><td>${p.gain==null?'—':(p.gain>0?'+':'')+p.gain}</td><td>${confTxt(p.confidence)}</td><td>${planSigned(p.net)}</td><td>${planEsc(p.status==='done'?(p.outcome||'منتهية'):p.verdict)}</td></tr>`).join('')}</tbody></table></div>
      <div class="plan-sign"><div>معلم المادة<b>${esc(rcGet('teacher')||'')}</b><span>التوقيع: ....................</span></div>
        <div>المرشد الطلابي<b>${esc(rcGet('counselor')||'')||'&nbsp;'}</b><span>التوقيع: ....................</span></div>
        <div>مدير المدرسة<b>${esc(rcGet('principal')||'')}</b><span>التوقيع: ....................</span></div></div>
    </div></div>`;
  unifiedA4Print({bodyClass:'printing-plans',title:'ملخص الخطط العلاجية',selector:'#plan-print',orientation:'portrait',margin:'8mm'});
}
function vspLabel(sp){ return `${sp.sem===2?'الفصل الثاني':'الفصل الأول'} · ${sp.per===2?'الفترة الثانية':'الفترة الأولى'}`; }
/* ═══ 📊 تقرير مختصر بالرسوم للمستويات والمهارات (صفحة A4 واحدة للطباعة/PDF) ═══
   الألوان حالة لا فئات: أتقن/متقن أخضر · قريب ذهبي · يحتاج دعم/لم يتقن أحمر · لم يُقَس رمادي — ومع كل لون رقمه واسمه
   (لا يُعتمد على اللون وحده). الحدود: المستوى من MASTERY (85/70)، والمهارة من SKILL_TARGET_UI/SKILL_GAP_UI (80/60). */
const LVR_C={ok:'#2E9E6B',mid:'#D49A1E',weak:'#D6455B',un:'#9AA8B8'};
function lvrDonut(parts,center,sub){
  const tot=parts.reduce((a,p)=>a+p.n,0)||1, r=62, C=2*Math.PI*r; let off=0;
  const segs=parts.filter(p=>p.n).map(p=>{ const len=p.n/tot*C, gap=parts.filter(x=>x.n).length>1?2:0;
    const el=`<circle cx="80" cy="80" r="${r}" fill="none" stroke="${p.c}" stroke-width="24" stroke-dasharray="${Math.max(0,len-gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"/>`; off+=len; return el; }).join('');
  return `<div class="lvr-donut"><svg viewBox="0 0 160 160" width="150" height="150" aria-hidden="true"><circle cx="80" cy="80" r="${r}" fill="none" stroke="#EEF2F7" stroke-width="24"/>${segs}</svg>
    <div class="lvr-dc"><b>${center}</b><small>${sub}</small></div></div>`;
}
function lvrStack(parts){ const tot=parts.reduce((a,p)=>a+p.n,0);
  return `<div class="lvr-stack">${tot?parts.filter(p=>p.n).map(p=>`<i style="flex:${p.n};background:${p.c}" title="${p.l} ${p.n}">${p.n/tot>=.05?p.n:''}</i>`).join(''):'<i style="flex:1;background:#EEF2F7"></i>'}</div>`; }
/* اختيار المهارات قبل التقرير: كل المهارات تُطيل الصفحة، فيختار المعلم ما يعرضه (افتراضيًا الأضعف حتى 8) */
const LVR_MAX_FIT=10;
async function ctLvReportPick(cls){
  try{ await ctEnsureGrades(false); }catch(e){}
  if(!CT_GRADES){ toast('تعذّر تحميل الدرجات','bad'); return; }
  const {R}=ctSkillRows(ctRoster(cls||''));
  if(!R.length) return ctLvReport(cls,[]);
  const prev=(window._lvrSel&&window._lvrSel[cls||'*'])||null;
  const on=k=>prev?prev.includes(k):R.findIndex(r=>r.k===k)<8;
  const tag={reteach:'⚠️ إعادة شرح',group:'👥 جماعية',one:'👤 فردية',ok:'✅ متمكّن',none:'—'};
  openModal(`<h2>📊 تقرير مختصر — اختر المهارات</h2>
    <p class="muted" style="font-size:.84rem;margin:.2rem 0 .6rem">المهارات مرتبة من الأضعف. ${R.length>LVR_MAX_FIT?`لتبقى في صفحة واحدة اختر ${LVR_MAX_FIT} مهارات أو أقل.`:''}</p>
    <div class="row" style="gap:.35rem;flex-wrap:wrap;margin-bottom:.5rem">
      <button class="btn ghost sm" onclick="lvrPickSet('weak5')">الأضعف 5</button>
      <button class="btn ghost sm" onclick="lvrPickSet('act')">ما يحتاج قرارًا</button>
      <button class="btn ghost sm" onclick="lvrPickSet('all')">الكل</button>
      <button class="btn ghost sm" onclick="lvrPickSet('none')">إلغاء الكل</button>
      <span id="lvr-cnt" class="chip ghost" style="margin-inline-start:auto"></span></div>
    <div class="lvr-pick">${R.map((r,i)=>`<label class="lvr-pk ${r.act}"><input type="checkbox" class="lvr-sk-cb" value="${esc(r.k)}" data-i="${i}" data-act="${r.act}" ${on(r.k)?'checked':''} onchange="lvrPickCount()">
      <span class="lvr-pk-n">${esc(r.k)}</span><b>${r.avg==null?'—':r.avg+'%'}</b><small>${tag[r.act]}</small></label>`).join('')}</div>
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn tick" onclick="lvrPickGo(${JSON.stringify(String(cls||'')).replace(/"/g,'&quot;')})">🖨️ إنشاء التقرير</button></div>`);
  lvrPickCount();
}
function lvrPickSet(m){ document.querySelectorAll('.lvr-sk-cb').forEach(cb=>{ cb.checked=m==='all'?true:m==='none'?false:m==='weak5'?Number(cb.dataset.i)<5:['reteach','group','one'].includes(cb.dataset.act); }); lvrPickCount(); }
function lvrPickCount(){ const n=document.querySelectorAll('.lvr-sk-cb:checked').length, el=document.getElementById('lvr-cnt'); if(el){ el.textContent=`${n} مختارة${n>LVR_MAX_FIT?' · قد يتجاوز صفحة':''}`; el.className='chip '+(n>LVR_MAX_FIT?'warn':'ghost'); } }
function lvrPickGo(cls){
  const sel=[...document.querySelectorAll('.lvr-sk-cb:checked')].map(cb=>cb.value);
  window._lvrSel=window._lvrSel||{}; window._lvrSel[cls||'*']=sel;
  closeModal(); ctLvReport(cls,sel);
}
async function ctLvReport(cls,only){
  try{ await ctEnsureGrades(false); }catch(e){}
  if(!CT_GRADES){ toast('تعذّر تحميل الدرجات','bad'); return; }
  const {sem,per}=ctSem(), roster=ctRoster(cls||''), M=CT_GRADES.mastery||{excellent:85,near:70};
  const L=roster.map(s=>({s,l:ctG(s.id).level||{measured:false},tr:ctG(s.id).trend}));
  const meas=L.filter(x=>x.l.measured), c=st=>meas.filter(x=>x.l.status===st).length, un=L.length-meas.length;
  const cor=meas.reduce((a,x)=>a+(x.l.correct||0),0), tot=meas.reduce((a,x)=>a+(x.l.total||0),0), avg=tot?Math.round(cor/tot*100):null;
  const pct=n=>meas.length?Math.round(n/meas.length*100):0;
  const lvParts=[{l:'متقن',n:c('متقن'),c:LVR_C.ok},{l:'قريب من الإتقان',n:c('قريب من الإتقان'),c:LVR_C.mid},{l:'يحتاج دعم',n:c('يحتاج دعم'),c:LVR_C.weak},{l:'لم يُقَس بعد',n:un,c:LVR_C.un}];
  const RA=ctSkillRows(roster).R, R=Array.isArray(only)?RA.filter(r=>only.includes(r.k)):RA;
  const cmp=!cls?ctClasses().map(k=>{ const r=ctRoster(k).map(s=>ctG(s.id).level||{}).filter(l=>l.measured); const t=r.reduce((a,l)=>a+(l.total||0),0), co=r.reduce((a,l)=>a+(l.correct||0),0);
    return {k,n:r.length,avg:t?Math.round(co/t*100):null,parts:[{l:'متقن',n:r.filter(l=>l.status==='متقن').length,c:LVR_C.ok},{l:'قريب',n:r.filter(l=>l.status==='قريب من الإتقان').length,c:LVR_C.mid},{l:'يحتاج دعم',n:r.filter(l=>l.status==='يحتاج دعم').length,c:LVR_C.weak}]}; }).filter(x=>x.n):[];
  const need=meas.filter(x=>x.l.status==='يحتاج دعم').sort((a,b)=>a.l.rate-b.l.rate);
  const down=meas.filter(x=>x.tr&&x.tr.measurable&&x.tr.change<=-10).sort((a,b)=>a.tr.change-b.tr.change);
  const up=meas.filter(x=>x.tr&&x.tr.measurable&&x.tr.change>=10);
  const first=n=>String(n||'').split(' ').slice(0,3).join(' ');
  const actTxt={reteach:'⚠️ إعادة شرح للفصل',group:'👥 خطة جماعية',one:'👤 خطة فردية',ok:'✅ متمكّن',none:'—'};
  const reteach=R.filter(r=>r.act==='reteach'), grp=R.filter(r=>r.act==='group'||r.act==='one'), okS=R.filter(r=>r.act==='ok');
  const concl=[];
  if(avg!=null) concl.push(`متوسط الإتقان ${avg}%، و${pct(c('متقن')+c('قريب من الإتقان'))}% من الطلاب المقيسين في مستوى «متقن» أو «قريب من الإتقان».`);
  { const RM=R.filter(r=>r.avg!=null);   // المقيسة فقط
    if(RM.length) concl.push(`أضعف مهارة «${RM[0].k}» (${RM[0].avg}%)${RM.length>1?`، وأقواها «${RM[RM.length-1].k}» (${RM[RM.length-1].avg}%)`:''}.`); }
  if(reteach.length) concl.push(`${reteach.length===1?'مهارة':reteach.length+' مهارات'} لم يتقنها أكثر الفصل (${reteach.map(r=>'«'+r.k+'»').join('، ')}): يُعاد شرحها للفصل كله قبل الخطط الفردية.`);
  if(grp.length) concl.push(`${grp.length} ${grp.length===1?'مهارة تحتاج':'مهارات تحتاج'} علاجًا لمجموعة محددة من الطلاب.`);
  if(need.length) concl.push(`${need.length} ${need.length===1?'طالب يحتاج':'طلاب يحتاجون'} دعمًا${down.length?`، و${down.length} يتراجعون (10 نقاط فأكثر)`:''}.`);
  if(un) concl.push(`${un} لم يُقَس مستواهم بعد (لم يحلّوا أي نشاط في الفترة).`);
  const dt=new Date(), today=`${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`;
  const leg=parts=>`<div class="lvr-leg">${parts.map(p=>`<span><i style="background:${p.c}"></i>${p.l} <b>${p.n}</b></span>`).join('')}</div>`;
  ensureLogo();
  let box=document.getElementById('plan-print'); if(!box){ box=document.createElement('div'); box.id='plan-print'; box.className='rep'; document.body.appendChild(box); }
  box.innerHTML=`<div class="rep-page plan-doc lvr">${repHead('المستويات والمهارات','تقرير مختصر')}
    <div class="rep-in">
      <div class="rep-info"><div>المادة<b>${esc(rcGet('subject')||'العلوم')}</b></div><div>الفصل<b>${esc(cls||'كل الفصول')}</b></div><div>الفترة<b>${sem===1?'الفصل الأول':'الفصل الثاني'} · ${per===1?'الأولى':'الثانية'}</b></div><div>تاريخ التقرير<b>${today}</b></div>
        <div>عدد الطلاب<b>${L.length}</b></div><div>قيس مستواهم<b>${meas.length}</b></div><div>متوسط الإتقان<b>${avg==null?'—':avg+'%'}</b></div><div>المهارات المعروضة<b>${R.length===RA.length?R.length:`${R.length} من ${RA.length}`}</b></div></div>
      <div class="lvr-row">
        <div class="rep-box lvr-card"><div class="lvr-h">توزيع الطلاب على المستويات</div>
          <div class="lvr-dwrap">${lvrDonut(lvParts,avg==null?'—':avg+'%','متوسط الإتقان')}${leg(lvParts)}</div>
          <div class="lvr-note">متقن ${M.excellent}% فأكثر · قريب ${M.near}–${M.excellent-1}% · يحتاج دعم أقل من ${M.near}%</div></div>
        <div class="rep-box lvr-card"><div class="lvr-h">${cmp.length>1?'مقارنة الفصول':'اتجاه المستوى خلال الفترة'}</div>
          ${cmp.length>1?`<div class="lvr-bars">${cmp.map(x=>`<div class="lvr-br"><span class="lvr-bn">${esc(x.k)}</span>${lvrStack(x.parts)}<b>${x.avg==null?'—':x.avg+'%'}</b></div>`).join('')}</div>${leg([{l:'متقن',n:'',c:LVR_C.ok},{l:'قريب',n:'',c:LVR_C.mid},{l:'يحتاج دعم',n:'',c:LVR_C.weak}])}<div class="lvr-note">الرقم بجانب الشريط: متوسط إتقان الفصل · داخل الشريط: عدد الطلاب</div>`
          :`<div class="lvr-trend"><div><b style="color:${LVR_C.ok}">${up.length}</b><span>▲ تحسّنوا 10 نقاط فأكثر</span></div><div><b style="color:${LVR_C.weak}">${down.length}</b><span>▼ تراجعوا 10 نقاط فأكثر</span></div><div><b>${meas.length-up.length-down.length}</b><span>● مستقرون</span></div></div><div class="lvr-note">الاتجاه: أول أنشطة الفترة مقابل آخرها</div>`}</div>
      </div>
      ${R.length?`<div class="rep-sec">المهارات: كم طالبًا أتقن كل مهارة؟ (من الأضعف${R.length<RA.length?` · ${R.length} مهارات مختارة من ${RA.length}`:''})</div>
      <div class="rep-box"><div class="lvr-sk">${R.map(r=>`<div class="lvr-skr"><span class="lvr-skn">${esc(r.k)}</span>${lvrStack([{l:'أتقن',n:r.ok.length,c:LVR_C.ok},{l:'قريب',n:r.mid.length,c:LVR_C.mid},{l:'لم يتقن',n:r.weak.length,c:LVR_C.weak}])}<b class="lvr-ska">${r.avg==null?'—':r.avg+'%'}</b><span class="lvr-act ${r.act}">${actTxt[r.act]}</span></div>`).join('')}</div>
        ${leg([{l:`أتقن ${SKILL_TARGET_UI}%+`,n:'',c:LVR_C.ok},{l:`قريب ${SKILL_GAP_UI}–${SKILL_TARGET_UI-1}%`,n:'',c:LVR_C.mid},{l:`لم يتقن أقل من ${SKILL_GAP_UI}%`,n:'',c:LVR_C.weak}])}
        <div class="lvr-note">داخل الشريط: عدد الطلاب · النسبة: متوسط الفصل في المهارة · القرار: إعادة شرح إذا لم يتقنها 3 طلاب فأكثر وكانوا 30% من الفصل فأكثر</div></div>`:''}
      <div class="lvr-row">
        <div class="rep-box lvr-card"><div class="lvr-h">يحتاجون دعمًا (${need.length})</div>
          ${need.length?`<div class="lvr-names">${need.slice(0,14).map(x=>`<span>${esc(first(x.s.name))} <b>${x.l.rate}%</b></span>`).join('')}${need.length>14?`<span>+${need.length-14}</span>`:''}</div>`:'<div class="lvr-note">لا يوجد — كل الطلاب المقيسين فوق حد الدعم.</div>'}
          ${down.length?`<div class="lvr-h" style="margin-top:.4rem">يتراجعون (${down.length})</div><div class="lvr-names">${down.slice(0,8).map(x=>`<span>${esc(first(x.s.name))} <b>${x.tr.change}</b></span>`).join('')}</div>`:''}</div>
        <div class="rep-box lvr-card"><div class="lvr-h">الخلاصة والتوصيات</div><ul class="lvr-ul">${concl.map(t=>`<li>${esc(t)}</li>`).join('')||'<li>لا توجد بيانات كافية بعد.</li>'}</ul></div>
      </div>
      <div class="plan-sign"><div>معلم المادة<b>${esc(rcGet('teacher')||'')}</b><span>التوقيع: ....................</span></div>
        <div>المشرف التربوي<b>&nbsp;</b><span>التوقيع: ....................</span></div>
        <div>مدير المدرسة<b>${esc(rcGet('principal')||'')}</b><span>التوقيع: ....................</span></div></div>
    </div></div>`;
  unifiedA4Print({bodyClass:'printing-plans',title:'تقرير المستويات والمهارات',selector:'#plan-print',orientation:'portrait',margin:'8mm'});
}
async function ctPlanFor(sid,rate){
  goTab('plans');
  setTimeout(()=>{ try{ planFromCandidate(sid,`مستوى «يحتاج دعم» — الإتقان ${rate}%`); }catch(e){ openPlanForm(); } },700);
}
/* 🛡️ الحفظ في دفتر فترة: يُتحقق من حالتها في نسخة الخادم الحديثة (ctSave يجلبها قبل التعديل) — جهاز آخر قد يكون أغلق الفترة
   وهذه الصفحة ما زالت تراها مفتوحة، فكانت الدرجات تُكتب في فترة مغلقة (لقطتها ثابتة) ولا تصل للفترة الجارية */
function ctBookW(d,sem,per){
  const a=d&&d.academic&&typeof d.academic==='object'?d.academic:null, S=a&&a.semesters&&a.semesters[String(sem)];
  if(S&&(S.status==='closed'||(S.periodStatus||{})[String(per)]==='closed'||(Number(per)===1&&Number(S.activePeriod)===2))){ const e=new Error('period_closed'); e.code='period_closed'; throw e; }
  return ctBook(d,sem,per);
}
async function ctPeriodMoved(e){
  if(!(e&&e.code==='period_closed')) return false;
  try{ await loadDashboardAcademic(true); }catch(_){}
  window._ctExSem=''; window._ctExPer=''; CT_DATA=null; CT_GRADES=null;
  try{ COMP_GRADES=null; COMP_GRADES_CACHE.clear(); COMP_GRADES_LOADED_AT.clear(); }catch(_){}
  toast('🔒 هذه الفترة أُغلقت (من جهاز آخر) — لم يُحفظ شيء. حدّثت الصفحة على الفترة الجارية، أعد الإدخال.','bad');
  renderClassTools(true); return true;
}
function ctExModeSet(v){ window._ctExMode=v; try{ localStorage.setItem('ct_ex_mode_v1',v); }catch(e){} renderClassTools(); }
async function ctExamMutate(fn,ok){
  if(CT_BUSY) return;
  const {sem,per,closed}=ctExamSP(); if(closed){ toast('🔒 الفترة مغلقة — درجاتها من لقطة الإغلاق ولا تُعدَّل','bad'); return; }
  CT_BUSY=true;
  try{ await ctSave(d=>fn(ctBookW(d,sem,per))); if(ok) toast(ok,'good'); }catch(e){ if(await ctPeriodMoved(e)){ CT_BUSY=false; return; } toast('تعذّر الحفظ — تحقق من الاتصال','bad'); }
  CT_BUSY=false; renderClassTools();
}
function ctExamAdd(){ ctExamMutate(b=>{ b.tests.push({id:'ex'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),title:'اختبار '+(b.tests.length+1),max:10,date:ctToday(),at:Date.now()}); },'أُضيف اختبار'); }
function ctExamEdit(id,field,value){
  ctExamMutate(b=>{ const t=b.tests.find(x=>String(x.id)===String(id)); if(!t) return;
    if(field==='title') t.title=String(value||'').trim()||'اختبار';
    else if(field==='date'){ const v=String(value||''); t.date=/^\d{4}-\d{2}-\d{2}$/.test(v)?v:''; }
    else { const m=Math.max(1,Math.min(100,Number(value))); if(Number.isFinite(m)) t.max=m; }
    t.at=Date.now(); });
}
async function ctExamDel(id){
  const {sem,per}=ctExamSP(), b=ctBook(JSON.parse(JSON.stringify(CT_DATA)),sem,per);
  if(b.tests.length<=1){ toast('يجب إبقاء اختبار واحد على الأقل','bad'); return; }
  if(!(await askConfirm('تُحذف درجات هذا الاختبار لكل الطلاب أيضًا، ولا يمكن التراجع.',{title:'حذف الاختبار؟',yes:'احذف',no:'إبقاء',danger:true}))) return;
  ctExamMutate(b=>{ b.tests=b.tests.filter(x=>String(x.id)!==String(id)); for(const sid of Object.keys(b.scores||{})) if(b.scores[sid]) delete b.scores[sid][String(id)];
    b.delTests=(Array.isArray(b.delTests)?b.delTests:[]).concat([{id:String(id),at:Date.now()}]).slice(-200); },'حُذف الاختبار');
}
/* 🕘 سجل تعديل درجات الاختبارات: كل تغيير يُحفظ (قبل ← بعد) في دفتر الفترة نفسه على الخادم،
   فيُعرف ما كانت عليه الدرجة ويُرجَع إليها بضغطة. آخر 300 تعديل لكل فترة، وآخر 3 لكل خانة تظهر في تلميحها. */
const CT_EXLOG_MAX=300;
function ctExamLogPush(b,e){ b.log=Array.isArray(b.log)?b.log:[]; b.log.unshift(e); if(b.log.length>CT_EXLOG_MAX) b.log.length=CT_EXLOG_MAX; }
function ctExamHistory(){
  const {sem,per,closed}=ctExamSP(), b=ctBook(JSON.parse(JSON.stringify(CT_DATA)),sem,per);
  const nm=sid=>{ const s=(STUDENTS||[]).find(x=>String(x.id)===String(sid)); return s?s.name:'طالب'; };
  const tt=tid=>{ const t=b.tests.find(x=>String(x.id)===String(tid)); return t?(t.title||'اختبار'):'اختبار محذوف'; };
  const L=(b.log||[]).slice(0,60);
  openModal(`<h3 style="margin:0 0 .3rem">🕘 سجل تعديل درجات الاختبارات</h3>
    <div class="muted" style="font-size:.8rem;margin-bottom:.7rem">الفصل ${sem===1?'الأول':'الثاني'} · الفترة ${per===1?'الأولى':'الثانية'} — الأحدث أولًا. «↩️ إرجاع» يعيد الدرجة لما كانت عليه قبل التعديل.</div>
    <div class="exh-list">${L.length?L.map((e,i)=>`<div class="exh-row"><div class="exh-main"><b>${esc(nm(e.sid))}</b><small>${esc(tt(e.tid))} · ${esc(ctExamWhen(e.at))}</small></div>
      <div class="exh-ch"><span class="exh-old">${esc(ctExamFmt(e.from))}</span><i>←</i><span class="exh-new">${esc(ctExamFmt(e.to))}</span></div>
      ${closed||!b.tests.some(t=>String(t.id)===e.tid)?'':`<button class="btn ghost sm" type="button" onclick="ctExamRevert('${esc(e.sid)}','${esc(e.tid)}',${e.from===null?'null':Number(e.from)})">↩️ إرجاع ${esc(ctExamFmt(e.from))}</button>`}</div>`).join('')
      :'<div class="muted" style="padding:.6rem 0">لا تعديلات مسجّلة بعد — يبدأ التسجيل من الآن مع كل تعديل.</div>'}</div>
    <div class="exh-bk"><b>🔎 تعديل قبل بدء السجل؟</b><div class="muted" style="font-size:.78rem;margin:.2rem 0 .5rem">نقارن الدرجات الحالية بالنسخ الاحتياطية في الخادم (تلقائية كل جمعة + اليدوية) ونعرض كل خانة اختلفت.</div>
      <button class="btn sm" type="button" onclick="ctExamFromBackups(this)">🔎 قارن بالنسخ الاحتياطية</button><div id="exh-bk-out"></div></div>
    <div class="row" style="justify-content:flex-end;margin-top:.8rem"><button class="btn ghost" type="button" onclick="closeModal()">إغلاق</button></div>`);
}
async function ctExamRevert(sid,tid,v){
  const {sem,per,closed}=ctExamSP(); if(closed) return;
  const label=v===null?'فارغة':v;
  if(!(await askConfirm(`تُعاد الدرجة إلى ${label}. ويُسجَّل هذا الإرجاع أيضًا في السجل.`,{title:'إرجاع الدرجة؟',yes:'أرجعها',no:'إلغاء'}))) return;
  try{
    await ctSave(d=>{ const b=ctBookW(d,sem,per), t=b.tests.find(x=>String(x.id)===String(tid)); if(!t) return;
      const bucket=b.scores[String(sid)]=b.scores[String(sid)]||{}, pv=bucket[String(tid)], cur=pv&&typeof pv==='object'?Number(pv.score):Number(pv);
      const from=Number.isFinite(cur)?cur:null; if(from===v) return;
      ctExamLogPush(b,{sid:String(sid),tid:String(tid),from,to:v,at:Date.now(),undo:1});
      if(v===null){ bucket[String(tid)]={del:true,at:Date.now()}; }   // علامة حذف بطابع (لا تعيدها نسخة قديمة)
      else bucket[String(tid)]={score:Math.max(0,Math.min(Number(t.max)||0,v)),at:Date.now()}; });
    toast('أُرجعت الدرجة ✓','good'); renderClassTools(); ctExamHistory();
  }catch(e){ if(await ctPeriodMoved(e)) return; toast('تعذّر الحفظ — تحقق من الاتصال','bad'); }
}
async function ctExamFromBackups(btn){
  const out=document.getElementById('exh-bk-out'); if(!out) return;
  const api=bkApi(), tok=getTok(); if(!api||!tok){ out.innerHTML='<p class="muted">اضبط عنوان الخادم وكلمة السر أولًا.</p>'; return; }
  if(btn) btn.disabled=true; out.innerHTML='<p class="muted">جارٍ قراءة النسخ…</p>';
  const {sem,per,closed}=ctExamSP(), cur=ctBook(JSON.parse(JSON.stringify(CT_DATA)),sem,per);
  const val=(bk,sid,tid)=>{ const v=bk.scores&&bk.scores[sid]&&bk.scores[sid][tid]; const n=v&&typeof v==='object'?Number(v.score):Number(v); return Number.isFinite(n)?n:null; };
  const nm=sid=>{ const s=(STUDENTS||[]).find(x=>String(x.id)===String(sid)); return s?s.name:'طالب'; };
  const groups=[];
  try{
    const j=await (await fetch(api+'/backup/list?t='+encodeURIComponent(tok),{cache:'no-store'})).json(); if(!j.ok) throw 0;
    for(const x of (j.list||[]).slice(0,5)){
      try{
        const snap=await (await fetch(api+'/backup/get?id='+encodeURIComponent(x.id)+'&t='+encodeURIComponent(tok),{cache:'no-store'})).json();
        const cr=JSON.parse((snap.keys||{})['teacher:classroom']||'{}'), bk=ctBook(cr,sem,per), diffs=[];
        for(const t of cur.tests){ const tid=String(t.id);
          const sids=new Set([...Object.keys(cur.scores||{}),...Object.keys(bk.scores||{})]);
          for(const sid of sids){ const a=val(bk,sid,tid), c=val(cur,sid,tid); if(a!==c && (STUDENTS||[]).some(s=>String(s.id)===sid)) diffs.push({sid,tid,old:a,now:c,title:t.title||'اختبار'}); } }
        groups.push({x,diffs});
      }catch(e){ groups.push({x,err:1}); }
    }
  }catch(e){ out.innerHTML='<p class="muted">تعذّر قراءة النسخ الاحتياطية.</p>'; if(btn) btn.disabled=false; return; }
  if(btn) btn.disabled=false;
  if(!groups.length){ out.innerHTML='<p class="muted">لا توجد نسخ احتياطية في الخادم بعد.</p>'; return; }
  out.innerHTML=groups.map(g=>`<div class="exh-g"><div class="exh-gh">📦 ${esc(bkDate(g.x.at))} <small>${esc(BK_KIND[g.x.kind]||g.x.kind)}</small></div>
    ${g.err?'<div class="muted">تعذّرت قراءتها.</div>':g.diffs.length?g.diffs.slice(0,40).map(d=>`<div class="exh-row"><div class="exh-main"><b>${esc(nm(d.sid))}</b><small>${esc(d.title)}</small></div>
      <div class="exh-ch"><span class="exh-old" title="في النسخة">${esc(ctExamFmt(d.old))}</span><i>←</i><span class="exh-new" title="الآن">${esc(ctExamFmt(d.now))}</span></div>
      ${closed?'':`<button class="btn ghost sm" type="button" onclick="ctExamRevert('${esc(d.sid)}','${esc(d.tid)}',${d.old===null?'null':d.old})">↩️ إرجاع ${esc(ctExamFmt(d.old))}</button>`}</div>`).join('')
      :'<div class="muted">لا اختلاف عن الدرجات الحالية.</div>'}</div>`).join('');
}

/* الدرجة: تُحفظ مباشرة دون إعادة رسم الجدول حتى لا يفقد المعلم مكانه أثناء الرصد */
async function ctExamScore(sid,tid,el){
  const {sem,per,closed}=ctExamSP(), n=String(el.value).trim(); if(closed){ toast('🔒 الفترة مغلقة — درجاتها من لقطة الإغلاق ولا تُعدَّل','bad'); renderClassTools(); return; }
  el.classList.add('saving');
  try{
    await ctSave(d=>{ const b=ctBookW(d,sem,per), t=b.tests.find(x=>String(x.id)===String(tid)); if(!t) return;
      const bucket=b.scores[String(sid)]=b.scores[String(sid)]||{};
      const pv=bucket[String(tid)], before=pv&&typeof pv==='object'?Number(pv.score):Number(pv), from=Number.isFinite(before)?before:null;
      const nv=n===''?null:Math.max(0,Math.min(Number(t.max)||0,Number(examAr2En(n))));
      if(from!==nv && !(nv!==null&&!Number.isFinite(nv))) ctExamLogPush(b,{sid:String(sid),tid:String(tid),from,to:nv,at:Date.now()});
      if(n===''){ bucket[String(tid)]={del:true,at:Date.now()}; }
      else { const v=Math.max(0,Math.min(Number(t.max)||0,Number(examAr2En(n)))); if(Number.isFinite(v)){ bucket[String(tid)]={score:v,at:Date.now()}; el.value=v; } } });
    el.classList.remove('saving'); el.classList.add('saved'); setTimeout(()=>el.classList.remove('saved'),900);
    // تحديث مجموع الطالب في صفّه فقط
    const b=ctBook(JSON.parse(JSON.stringify(CT_DATA)),sem,per), mx=b.tests.reduce((t,x)=>t+Math.max(0,Number(x.max)||0),0), by=b.scores[String(sid)]||{};
    const vals=b.tests.map(t=>{const v=by[String(t.id)];const n=v&&typeof v==='object'?Number(v.score):Number(v);return Number.isFinite(n)?Math.min(Number(t.max)||0,n):null}).filter(v=>v!==null);
    const r=vals.reduce((a,v)=>a+v,0), row=el.closest('tr');
    if(row){ const a=row.querySelector('.ct-raw'), z=row.querySelector('.ct-20'); if(a) a.textContent=vals.length?r:'—'; if(z) z.innerHTML=vals.length&&mx>0?`<b>${+(r/mx*20).toFixed(2)}</b>`:'—'; }
  }catch(e){ el.classList.remove('saving'); if(await ctPeriodMoved(e)) return; el.classList.add('err'); toast('تعذّر حفظ الدرجة','bad'); try{ const b=ctBook(JSON.parse(JSON.stringify(CT_DATA)),sem,per), by=(b.scores||{})[String(sid)]||{}, v=by[String(tid)]; el.value=(v&&typeof v==='object')?(v.score??''):((v??'')===''? '':v); }catch(_){} }
}
async function ctSetStatus(m,sid,v){
  const d=window._ctRcD||ctToday();
  try{
    await ctSave(D=>{
      D[m]=D[m]||{}; D[m][d]=D[m][d]||{};
      D[m][d][String(sid)]={status:v,at:Date.now()};
      // كما في البوابة: الغائب «معذور» في واجب يومه تلقائيًا، وإلغاء الغياب يعيد ما كان
      if(m==='participation'){
        D.homework=D.homework||{}; D.homework[d]=D.homework[d]||{};
        const h=D.homework[d][String(sid)], hs=String(h&&h.status||'');
        if(v==='غائب'||v==='غائب بعذر'){ if(!hs||hs==='لم ينجز') D.homework[d][String(sid)]={status:'معذور',at:Date.now(),auto:true,prev:hs}; }
        else if(h&&h.auto) D.homework[d][String(sid)]={status:h.prev||'',at:Date.now()};
      }
    });
    toast('حُفظ','good');
  }catch(e){ toast('تعذّر الحفظ — تحقق من الاتصال','bad'); }
  renderClassTools();
}
async function ctBehDel(id){
  if(!(await askConfirm('تُحذف الملاحظة من سجل الطالب ودرجة السلوك.',{title:'حذف الملاحظة؟',yes:'احذف',no:'إبقاء',danger:true}))) return;
  try{ await ctSave(D=>{ const x=(D.behavior||[]).find(b=>String(b.id)===String(id)); if(x){ x.deleted=true; x.at=Date.now(); } }); toast('حُذفت الملاحظة','good'); }
  catch(e){ toast('تعذّر الحذف','bad'); }
  renderClassTools();
}
async function ctCertAdd(){
  if(window._ctCeBusy) return;
  const sid=document.getElementById('ct-ce-st')?.value, reason=String(document.getElementById('ct-ce-reason')?.value||'').trim()||'التميز والمشاركة الفاعلة';
  if(!sid){ toast('اختر الطالب','bad'); return; }
  const rec={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),studentId:sid,reason,date:ctToday(),at:Date.now()};
  const _btn=document.querySelector('button[onclick="ctCertAdd()"]');
  window._ctCeBusy=true; if(_btn)_btn.disabled=true;
  try{ await ctSave(D=>{ D.certificates=Array.isArray(D.certificates)?D.certificates:[]; D.certificates.unshift(rec); }); toast('🏅 صدرت الشهادة','good'); }
  catch(e){ toast('تعذّر الحفظ','bad'); window._ctCeBusy=false; if(_btn)_btn.disabled=false; return; }
  window._ctCeBusy=false;
  renderClassTools(); ctCertPrint([rec.id]);
}
async function ctCertDel(id){
  if(!(await askConfirm('تُحذف الشهادة من السجل.',{title:'حذف الشهادة؟',yes:'احذف',no:'إبقاء',danger:true}))) return;
  try{ await ctSave(D=>{ const x=(D.certificates||[]).find(c=>String(c.id)===String(id)); if(x){ x.deleted=true; x.at=Date.now(); } }); window._ctCeSel.delete(String(id)); }
  catch(e){ toast('تعذّر الحذف','bad'); }
  renderClassTools();
}
/* 🇸🇦 تصميم الوزارة: خلفية «شكر وتقدير» الرسمية (أُزيل منها النص النموذجي) ويُطبع فوقها النص في مواضعه */
const CT_CERT_BG='cert-bg.jpg?v=1';   // 🖼️ خلفية شهادة الوزارة: ملف مستقل (كانت ~220KB داخل هذا الملف تُحمَّل مع كل فتح للوحة)
function ctCertSetTpl(v){ window._ctCeTpl=v; try{ localStorage.setItem('ct_cert_tpl_v1',v); }catch(e){} renderClassTools(); }
function ctCertMoeSettings(){
  const c=ctMoeCfg(), f=(id,l,v,ph)=>`<label style="display:block;margin-top:.5rem;font-size:.84rem;font-weight:600">${l}<input class="inp" id="${id}" value="${esc(v)}" placeholder="${esc(ph||'')}" style="width:100%"></label>`;
  openModal(`<h2>⚙️ نص شهادة الشكر والتقدير</h2>
    <p class="muted" style="font-size:.8rem">يمكن استخدام: {المدرسة} {المادة} {المعلم} {المدير} {الفصل} — تُملأ من الإعدادات تلقائيًا. السطر الأول بعد الاسم هو سبب التكريم.</p>
    ${f('cm-pre','العبارة قبل الاسم',c.pre)}${f('cm-dua','سطر الدعاء بعد السبب',c.dua)}
    <div class="grid2">${f('cm-rt','لقب التوقيع الأيمن',c.rTitle,'اختياري')}${f('cm-rn','اسم التوقيع الأيمن',c.rName,'اختياري')}${f('cm-lt','لقب التوقيع الأيسر',c.lTitle)}${f('cm-ln','اسم التوقيع الأيسر',c.lName)}</div>
    <div class="modal-foot"><button class="btn ghost" onclick="try{localStorage.removeItem(CT_MOE_KEY)}catch(e){};closeModal();toast('أُعيد النص الافتراضي');ctCertTplPush()">النص الافتراضي</button><button class="btn tick" onclick="ctCertMoeSave()">حفظ</button></div>`);
}
function ctCertMoeSave(){
  const v=id=>String(document.getElementById(id)?.value||'').trim();
  try{ localStorage.setItem(CT_MOE_KEY,JSON.stringify({pre:v('cm-pre'),dua:v('cm-dua'),rTitle:v('cm-rt'),rName:v('cm-rn'),lTitle:v('cm-lt'),lName:v('cm-ln')})); }catch(e){}
  closeModal(); toast('حُفظ نص الشهادة','good'); ctCertTplPush();
}
function ctCertCls(cls){ return String(cls||'').trim(); }
/* كل سطر في سطر واحد: يُصغَّر خطه حتى يتسع مكانه مهما كان خط الجهاز أعرض */
function ctFitCert(root){
  if(!root) return;
  const host=root.closest('#plan-print')||root, hidden=getComputedStyle(host).display==='none';
  const keep=host.getAttribute('style')||'';
  if(hidden) host.setAttribute('style',keep+';display:block!important;position:absolute!important;left:-20000px!important;top:0!important;visibility:hidden!important');
  root.querySelectorAll('[data-fit]').forEach(el=>{
    el.style.fontSize=''; let fs=parseFloat(getComputedStyle(el).fontSize)||16, n=0;
    while(el.scrollWidth>el.clientWidth+1&&fs>8&&n++<40){ fs*=0.95; el.style.fontSize=fs+'px'; }
  });
  if(hidden) host.setAttribute('style',keep);
}
function ctCertMoeHTML(c){
  const s=(STUDENTS||[]).find(a=>String(a.id)===String(c.studentId))||{}, k=ctMoeCfg();
  const reason=String(c.reason||'التميز والمشاركة الفاعلة').trim();
  return `<div class="ct-moe"><img class="ct-moe-bg" src="${CT_CERT_BG}" alt="">
    <div class="ct-moe-pre" data-fit>${esc(ctMoeFill(k.pre,s))}</div>
    <div class="ct-moe-name"><span data-fit>${esc(s.name||'')}</span></div>
    <div class="ct-moe-body"><div data-fit>وذلك نظير ${esc(reason)}</div><div data-fit>${esc(ctMoeFill(k.dua,s))}</div>
      <div class="ct-moe-date" data-fit>${ctCertCls(s.cls)?`الفصل ${esc(ctCertCls(s.cls))} · `:''}${esc(ctCertDateLine(c.date))}</div></div>
    <div class="ct-moe-sig r"><b data-fit>${esc(ctMoeFill(k.rTitle,s))}</b><span data-fit>${esc(ctMoeFill(k.rName,s))}</span></div>
    <div class="ct-moe-sig l"><b data-fit>${esc(ctMoeFill(k.lTitle,s))}</b><span data-fit>${esc(ctMoeFill(k.lName,s))}</span></div>
  </div>`;
}
/* 📤 إرسال الشهادة إلى بوابة الطالب: يُحفظ نصّها النهائي معها (المدرسة والمعلم والمدير من إعداداتك)
   فيراها الطالب كما تطبعها أنت تمامًا، ويحفظها صورة أو يطبعها بنفسه. */
async function ctCertShare(ids,on=true){
  ids=(ids||[...(window._ctCeSel||[])]).map(String);
  { const _vc=ctValidCls(window._ctCeCls,true); const _vs=new Set(((CT_DATA&&CT_DATA.certificates)||[]).filter(x=>x&&!x.deleted).map(x=>({x,s:(STUDENTS||[]).find(a=>String(a.id)===String(x.studentId))})).filter(r=>r.s&&(!_vc||String(r.s.cls||'')===_vc)).map(r=>String(r.x.id))); ids=ids.filter(id=>_vs.has(id)); }
  if(!ids.length){ toast('حدّد شهادة أولًا','bad'); return; }
  const k=ctMoeCfg();
  try{
    await ctSave(D=>{ (D.certificates||[]).forEach(c=>{ if(!c||!ids.includes(String(c.id))) return;
      if(!on){ delete c.shared; return; }
      const s=(STUDENTS||[]).find(a=>String(a.id)===String(c.studentId))||{};
      c.shared={ at:Date.now(), name:s.name||'', cls:ctCertCls(s.cls), pre:ctMoeFill(k.pre,s), reason:String(c.reason||'التميز والمشاركة الفاعلة'),
        dua:ctMoeFill(k.dua,s), date:ctCertDateLine(c.date), rTitle:ctMoeFill(k.rTitle,s), rName:ctMoeFill(k.rName,s), lTitle:ctMoeFill(k.lTitle,s), lName:ctMoeFill(k.lName,s) }; }); });
    toast(on?`📤 أُرسلت ${ids.length===1?'الشهادة':ids.length+' شهادات'} إلى بوابة الطالب`:'↩️ سُحبت من بوابة الطالب','good');
  }catch(e){ toast('تعذّر الإرسال — تحقق من الاتصال','bad'); }
  renderClassTools();
}
function ctCertPrint(ids){
  ids=ids||[...(window._ctCeSel||[])];
  const all=(CT_DATA&&CT_DATA.certificates)||[], recs=ids.map(id=>all.find(c=>String(c.id)===String(id))).filter(Boolean);
  recs.sort((a,b)=>(Number(b.at)||0)-(Number(a.at)||0));
  if(!recs.length){ toast('حدّد شهادة للطباعة','bad'); return; }
  if(ctCertTpl()==='moe'){
    if(!window._ctCertBgOk){ const im=new Image(); im.onload=()=>{ window._ctCertBgOk=1; ctCertPrint(ids); }; im.onerror=()=>{ window._ctCertBgOk=1; ctCertPrint(ids); }; im.src=CT_CERT_BG; return; }   // الخلفية تُحمَّل قبل الطباعة
    let box=document.getElementById('plan-print'); if(!box){ box=document.createElement('div'); box.id='plan-print'; box.className='rep'; document.body.appendChild(box); }
    box.innerHTML=recs.map(ctCertMoeHTML).join('');
    box.querySelectorAll('.ct-moe').forEach(ctFitCert);
    // قواعد طباعة في آخر الصفحة تفرض «عموديًا»؛ هذه تُلحق بعدها لتتقدّم عليها، وتُزال بعد الطباعة
    document.getElementById('ct-cert-page')?.remove();
    const st=document.createElement('style'); st.id='ct-cert-page';
    st.textContent='@media print{@page{size:A4 landscape!important;margin:0!important}}';
    document.body.appendChild(st);
    const rm=()=>{ st.remove(); window.removeEventListener('afterprint',rm); };
    window.addEventListener('afterprint',rm); setTimeout(rm,60000);
    unifiedA4Print({bodyClass:'printing-cert',title:'شهادات شكر وتقدير',selector:'#plan-print',orientation:'landscape',margin:'0'});
    return;
  }
  ensureLogo();
  let box=document.getElementById('plan-print'); if(!box){ box=document.createElement('div'); box.id='plan-print'; box.className='rep'; document.body.appendChild(box); }
  box.innerHTML=recs.map(c=>{ const s=(STUDENTS||[]).find(a=>String(a.id)===String(c.studentId))||{};
    return `<div class="rep-page plan-doc ct-cert t-${esc(ctCertTpl())}">${repHead('شهادة تقدير','')}
      <div class="ct-cert-in"><div class="ct-cert-t">شهادة شكر وتقدير</div>
        <p>تتقدم إدارة المدرسة ومعلم مادة ${esc(rcGet('subject')||'العلوم')} بالشكر والتقدير للطالب</p>
        <div class="ct-cert-n">${esc(s.name||'')}</div>
        <p>${s.cls?`بالفصل ${esc(s.cls)} — `:''}وذلك لـ <b>${esc(c.reason||'التميز')}</b></p>
        <p>متمنين له دوام التوفيق والنجاح.</p>
        <div class="muted" style="margin-top:1rem">التاريخ: ${esc(String(c.date||'').replace(/-/g,'/'))}</div></div>
      <div class="plan-sign"><div>معلم المادة<b>${esc(rcGet('teacher')||'')}</b><span>التوقيع: ....................</span></div>
        <div>مدير المدرسة<b>${esc(rcGet('principal')||'')}</b><span>التوقيع: ....................</span></div></div></div>`; }).join('');
  unifiedA4Print({bodyClass:'printing-plans',title:'شهادات تقدير',selector:'#plan-print',orientation:'portrait',margin:'8mm'});
}
/* خطة فردية من «حسب الطالب»: يُختار الطالب في النموذج فتُملأ فجواته تلقائيًا */
function ctPlanStudent(sid){
  goTab('plans');
  setTimeout(()=>{ try{ openPlanForm(); const sel=document.getElementById('pf-student'); if(sel){ sel.value=String(sid); sel.dispatchEvent(new Event('change',{bubbles:true})); } }catch(e){ console.warn(e); } },700);
}
function ctGroupPlan(skill,ids){
  goTab('plans');
  setTimeout(()=>{ try{
    openPlanForm();
    const cb=document.getElementById('pf-group'); if(cb) cb.checked=true;
    window._pfMembers=ids.slice(); renderPlanMembers();
    window._pfSkills=[skill]; renderPlanSkills();
    const rs=document.getElementById('pf-reason'); if(rs) rs.value=`فجوة في الفهم — ضعف مشترك في مهارة «${skill}»`;
  }catch(e){ console.warn(e); } },700);
}
function ctExamPaste(tid){
  const {sem,per}=ctExamSP(), cls=ctValidCls(window._ctExCls), b=ctBook(JSON.parse(JSON.stringify(CT_DATA)),sem,per), t=b.tests.find(x=>String(x.id)===String(tid));
  if(!t) return;
  openModal(`<h2>📋 لصق درجات «${esc(t.title||'اختبار')}»</h2>
    <p class="muted" style="font-size:.84rem;line-height:1.8">الصق من Excel أو Google Sheets بإحدى طريقتين:<br>
      • <b>عمود الدرجات وحده</b> بترتيب أسماء الفصل ${esc(cls)} كما في الجدول (سطر لكل طالب، والسطر الفارغ يُترك).<br>
      • <b>عمودان: الاسم ثم الدرجة</b> — يُطابَق الاسم تلقائيًا بأي ترتيب.</p>
    <textarea id="ct-paste" class="inp" rows="10" style="width:100%;font-family:inherit" placeholder="8&#10;9.5&#10;7"></textarea>
    <div id="ct-paste-prev" class="muted" style="font-size:.8rem;margin-top:.4rem"></div>
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn" onclick="ctExamPastePreview('${esc(tid)}')">معاينة</button><button class="btn tick" onclick="ctExamPasteApply('${esc(tid)}')">حفظ الدرجات</button></div>`);
}
function ctExamPasteParse(tid){
  const {sem,per}=ctExamSP(), cls=ctValidCls(window._ctExCls), roster=ctRoster(cls);
  const b=ctBook(JSON.parse(JSON.stringify(CT_DATA)),sem,per), t=b.tests.find(x=>String(x.id)===String(tid)), mx=Number(t&&t.max)||10;
  const lines=String(document.getElementById('ct-paste')?.value||'').split(/\r?\n/);
  while(lines.length&&!lines[lines.length-1].trim()) lines.pop();
  const norm=v=>rdNormAr(String(v||''));
  const out=[], bad=[];
  const named=lines.some(l=>/[\t,;]/.test(l)&&/[؀-ۿa-z]/i.test(l));
  lines.forEach((l,i)=>{
    if(named){
      const parts=l.split(/\t|;|,(?=\s*[\d٠-٩.])/).map(x=>x.trim()).filter(Boolean); if(parts.length<2){ if(l.trim()) bad.push(l.trim()); return; }
      const name=parts.find(p=>/[؀-ۿa-z]/i.test(p))||'', num=parts.find(p=>/^[\d٠-٩.,٫]+$/.test(p));
      const s=roster.find(x=>norm(x.name)===norm(name))||roster.find(x=>norm(x.name).includes(norm(name))||norm(name).includes(norm(x.name)));
      const v=Number(examAr2En(num||'').replace(',','.'));
      if(!s||!Number.isFinite(v)) bad.push(l.trim()); else out.push({s,v:Math.max(0,Math.min(mx,v))});
    }else{
      const raw=l.trim(); if(!raw) return; const s=roster[i]; const v=Number(examAr2En(raw).replace(',','.'));
      if(!s||!Number.isFinite(v)) bad.push(raw); else out.push({s,v:Math.max(0,Math.min(mx,v))});
    }
  });
  return { out, bad, named, mx };
}
function ctExamPastePreview(tid){
  const R=ctExamPasteParse(tid), el=document.getElementById('ct-paste-prev'); if(!el) return;
  el.innerHTML=`${R.named?'طريقة: الاسم والدرجة':'طريقة: الترتيب'} · ستُحفظ ${R.out.length} درجة${R.bad.length?` · <span style="color:#B4232F">لم تُفهم ${R.bad.length}: ${R.bad.slice(0,4).map(esc).join('، ')}</span>`:''}<br>${R.out.slice(0,8).map(x=>`${esc(x.s.name)}: <b>${x.v}</b>`).join(' · ')}${R.out.length>8?' …':''}`;
}
async function ctExamPasteApply(tid){
  const R=ctExamPasteParse(tid); if(!R.out.length){ ctExamPastePreview(tid); toast('لم أجد درجات صالحة','bad'); return; }
  const {sem,per,closed}=ctExamSP(); if(closed){ toast('🔒 الفترة مغلقة — درجاتها من لقطة الإغلاق ولا تُعدَّل','bad'); return; }
  try{ await ctSave(d=>{ const b=ctBookW(d,sem,per); R.out.forEach(x=>{ const k=String(x.s.id); b.scores[k]=b.scores[k]||{}; b.scores[k][String(tid)]={score:x.v,at:Date.now()}; }); });
    closeModal(); toast(`📋 حُفظت ${R.out.length} درجة${R.bad.length?` · تُرك ${R.bad.length} سطرًا`:''}`,'good'); }
  catch(e){ if(await ctPeriodMoved(e)){ closeModal(); return; } toast('تعذّر الحفظ','bad'); }
  renderClassTools();
}
function ctExamExport(){
  const {sem,per}=ctExamSP(), cls=ctValidCls(window._ctExCls), roster=ctRoster(cls), b=ctBook(JSON.parse(JSON.stringify(CT_DATA)),sem,per);
  const mx=b.tests.reduce((t,x)=>t+Math.max(0,Number(x.max)||0),0);
  const cell=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const rows=[['الطالب','الفصل',...b.tests.map(t=>`${t.title||'اختبار'} (من ${t.max})`),'المجموع','من 20']];
  roster.forEach(s=>{ const by=b.scores[String(s.id)]||{}; let r=0,has=false;
    const vals=b.tests.map(t=>{const v=by[String(t.id)];const n=v&&typeof v==='object'?Number(v.score):Number(v);if(Number.isFinite(n)){has=true;r+=Math.min(Number(t.max)||0,n);return n}return ''});
    rows.push([s.name,s.cls||'',...vals,has?r:'',has&&mx>0?+(r/mx*20).toFixed(2):'']); });
  const blob=new Blob(['﻿'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`دفتر-الاختبارات-${cls||'كل الفصول'}-ف${sem}-${per}.csv`; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
async function fuUndo(sid,type){
  try{ await ctSave(D=>{ const o=D.followups&&D.followups[String(sid)]; if(o) delete o[type]; }); }catch(e){ toast('تعذّر الحفظ','bad'); }
  try{ thDraw(); }catch(e){}
}
async function ctAllPresent(){
  const cls=ctValidCls(window._ctRcCls), d=window._ctRcD||ctToday(), D=CT_DATA||{};
  const ids=ctRoster(cls).filter(s=>!ctStatus(D,'participation',d,s.id)).map(s=>String(s.id));
  if(!ids.length){ toast('كل الطلاب مرصودون في هذا اليوم'); return; }
  try{ await ctSave(X=>{ X.participation=X.participation||{}; X.participation[d]=X.participation[d]||{}; ids.forEach(id=>{ if(!X.participation[d][id]) X.participation[d][id]={status:'شارك',at:Date.now()}; }); });
    toast(`✅ رُصد «شارك» لـ ${ids.length} طالبًا — عدّل الاستثناءات`,'good'); }
  catch(e){ toast('تعذّر الحفظ','bad'); }
  renderClassTools();
}
async function ctCertQuick(sid,reason){
  const rec={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),studentId:String(sid),reason,date:ctToday(),at:Date.now()};
  try{ await ctSave(D=>{ D.certificates=Array.isArray(D.certificates)?D.certificates:[]; D.certificates.unshift(rec); }); toast('🏅 صدرت الشهادة','good'); }
  catch(e){ toast('تعذّر الحفظ','bad'); return; }
  window._ctCeSel=window._ctCeSel||new Set(); window._ctCeSel.add(rec.id); renderClassTools();
}
function ctCertMsg(id){
  const c=((CT_DATA&&CT_DATA.certificates)||[]).find(x=>String(x.id)===String(id)); if(!c) return;
  const s=(STUDENTS||[]).find(a=>String(a.id)===String(c.studentId))||{};
  const txt=`السلام عليكم، ولي أمر الطالب ${s.name||''}،\n\nيسعدنا إبلاغكم بحصول ابنكم على شهادة شكر وتقدير في مادة ${rcGet('subject')||'العلوم'}، وذلك لـ${c.reason||'تميّزه'}.\nنشكر متابعتكم، ونتمنى له دوام التوفيق.\n\n${rcGet('teacher')||'معلم المادة'}`;
  try{ navigator.clipboard.writeText(txt).then(()=>toast('📋 نُسخت الرسالة — الصقها في واتساب أو مدرستي','good'),()=>openModal(`<h2>رسالة ولي الأمر</h2><textarea class="inp" rows="8" style="width:100%">${esc(txt)}</textarea><div class="modal-foot"><button class="btn" onclick="closeModal()">إغلاق</button></div>`)); }
  catch(e){ openModal(`<h2>رسالة ولي الأمر</h2><textarea class="inp" rows="8" style="width:100%">${esc(txt)}</textarea><div class="modal-foot"><button class="btn" onclick="closeModal()">إغلاق</button></div>`); }
}
function ctPfStep(d){
  const r=ctRoster(ctValidCls(window._ctPfCls)), i=r.findIndex(s=>String(s.id)===String(window._ctPfSid));
  const n=r[(i+d+r.length)%r.length]; if(n){ window._ctPfSid=String(n.id); renderClassTools(); }
}
async function sfPaperOpen(test){
  const p=(SFPP.list||[]).find(x=>x.test===test), sid=SFPP.sid; if(!p) return;
  const v=document.createElement('div'); v.className='opv-veil'; v.innerHTML='<div class="opv-box" style="width:min(760px,100%)"><p class="muted" style="padding:2rem;text-align:center">⏳ جارٍ فتح الورقة…</p></div>';
  v.onclick=e=>{ if(e.target===v||e.target.closest('.sfpp-x')) v.remove(); }; document.body.appendChild(v);
  try{
    const r=await omrApiCall(`/omr/papers/img?test=${encodeURIComponent(test)}&sid=${encodeURIComponent(sid)}`), M=r.marks||[], bad=M.map((m,i)=>m===1?0:i+1).filter(Boolean);
    v.querySelector('.opv-box').innerHTML=`<div class="opv-head"><div><b>📄 ${esc(p.title)}</b><small>${p.score} من ${p.max}${M.length?` · صحيح ${p.right} من ${p.n}`:''} · ${p.pub?'منشورة للطالب':'غير منشورة للطالب بعد'}</small></div>
        <button type="button" class="btn sm" onclick="sfPaperPrint(this)">🖨️ طباعة</button><button type="button" class="btn sm sfpp-x">✕ إغلاق</button></div>
      <div class="sfpp-img"><img src="${r.img}" alt="ورقة الاختبار">${(r.keyBoxes||[]).map(b=>`<i style="left:${b[0]*100}%;top:${b[1]*100}%;width:${b[2]*100}%;height:${b[3]*100}%"></i>`).join('')}</div>
      ${M.length?`<div class="sfpp-qs">${M.map((m,i)=>`<span class="${m===1?'ok':'no'}"><b>${i+1}</b>${m===1?'✓':'✗'}</span>`).join('')}</div>`:''}
      <p class="muted" style="font-size:.82rem;margin:.5rem 0 0">${bad.length?`أخطأ في ${bad.length===1?'السؤال':'الأسئلة'}: ${bad.join('، ')}.`:'كل الإجابات صحيحة.'}${(r.keyBoxes||[]).length?' الإطار الأخضر المتقطع = الإجابة الصحيحة (يظهر لك فقط).':''}</p>`;
  }catch(e){ v.querySelector('.opv-box').innerHTML='<p class="muted" style="padding:2rem;text-align:center">تعذّر فتح الورقة — يحتاج اتصالًا بالخادم.</p><button type="button" class="btn sm sfpp-x">إغلاق</button>'; }
}
function sfPaperPrint(btn){
  const img=btn.closest('.opv-box').querySelector('.sfpp-img img'); if(!img) return;
  const w=window.open('','_blank'); if(!w){ toast('اسمح بالنوافذ المنبثقة للطباعة','bad'); return; }
  w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>ورقة الاختبار</title><style>@page{size:A4;margin:0}html,body{margin:0}img{width:100%;display:block}</style></head><body><img src="${img.src}" onload="setTimeout(()=>{print()},200)"></body></html>`); w.document.close();
}
function ctProfilePrint(){
  const sid=window._ctPfSid; if(!sid) return; ensureLogo();
  let box=document.getElementById('plan-print'); if(!box){ box=document.createElement('div'); box.id='plan-print'; box.className='rep'; document.body.appendChild(box); }
  box.innerHTML=`<div class="rep-page plan-doc ct-pf-print">${repHead('ملف الطالب الشامل','تقرير')}<div class="rep-in">${ctProfileBody(sid)}
    <div class="plan-note">البيانات من سجلات المعلم الفعلية وإجابات الطالب في الأنشطة خلال الفترة الحالية.</div>
    <div class="plan-sign"><div>معلم المادة<b>${esc(rcGet('teacher')||'')}</b><span>التوقيع: ....................</span></div>
      <div>المرشد الطلابي<b>${esc(rcGet('counselor')||'')||'&nbsp;'}</b><span>التوقيع: ....................</span></div>
      <div>ولي الأمر<b>&nbsp;</b><span>التوقيع: ....................</span></div></div></div></div>`;
  unifiedA4Print({bodyClass:'printing-plans',title:'ملف الطالب',selector:'#plan-print',orientation:'portrait',margin:'8mm'});
}
function planSkillToggle(el){
  const set=new Set(window._pfSkills||[]);
  if(el.checked){ if(set.size>=PLAN_SKILL_MAX){ el.checked=false; toast(`الحد ${PLAN_SKILL_MAX} مهارات للخطة — ركّز على الأهم`,'bad'); return } set.add(el.value) }
  else set.delete(el.value);
  window._pfSkills=[...set]; planSkillActsSync(el.value,el.checked); renderPlanSkills(); planReasonSync();
}
function planSkillAdd(){
  const inp=document.getElementById('pf-skill-new'); const v=String(inp&&inp.value||'').trim().slice(0,80); if(!v) return;
  if(!planIsOutcome(v)){ toast('اختر ناتجًا من نواتج نافس','bad'); return; }
  const cur=window._pfSkills||[];
  if(!cur.includes(v)){ if(cur.length>=PLAN_SKILL_MAX){ toast(`الحد ${PLAN_SKILL_MAX} مهارات للخطة — ألغِ واحدة أولًا`,'bad'); return } cur.push(v); planSkillActsSync(v,true) }
  window._pfSkills=cur; renderPlanSkills(); planReasonSync();
}
function togglePlanGroup(){
  const on=document.getElementById('pf-group')?.checked;
  if(on&&!(window._pfMembers||[]).length){
    const sel=document.getElementById('pf-student');
    window._pfMembers=sel&&sel.value?[String(sel.value)]:[];
  }
  renderPlanMembers();
}
/* التحديد الجماعي يطبَّق على الظاهر فقط (بعد فلتر الفصل والبحث) */
function planMemBulk(mode){
  const set=new Set((window._pfMembers||[]).map(String));
  const cand=new Set(((PLAN_DATA&&PLAN_DATA.planCandidates)||[]).map(x=>String(x.id||x.studentId||'')));
  const visible=[...document.querySelectorAll('#pf-mem-grid .mem-item')].filter(el=>el.style.display!=='none').map(el=>String(el.dataset.id||'')).filter(Boolean);
  if(mode==='all') visible.forEach(id=>set.add(id));
  else if(mode==='none') visible.forEach(id=>set.delete(id));
  else if(mode==='cand'){ visible.forEach(id=>set.delete(id)); visible.filter(id=>cand.has(id)).forEach(id=>set.add(id)); }
  window._pfMembers=[...set]; renderPlanMembers();
}
function togglePlanMember(id){
  id=String(id); const set=new Set((window._pfMembers||[]).map(String));
  if(set.has(id)) set.delete(id); else set.add(id);
  window._pfMembers=[...set]; renderPlanMembers();
}
function planFromGroup(key){
  const g=((PLAN_DATA&&PLAN_DATA.planGroups)||[]).find(x=>x.key===key); if(!g) return;
  openPlanForm();
  const cb=document.getElementById('pf-group'); if(cb) cb.checked=true;
  window._pfMembers=(g.members||[]).map(m=>String(m.id));
  renderPlanMembers();
  const rs=document.getElementById('pf-reason'); if(rs) rs.value=g.kind==='skill'?`فجوة في المهارات — ${(g.skills||[]).join('، ')} (متوسط المجموعة ${g.avgRate}%)`:(g.label||'');
  window._pfSkills=Array.isArray(g.skills)?g.skills.slice():[]; window._pfPattern=g.kind==='skill'?'gap':'';
  window._pfActions=(g.actions||[]).slice(); renderPlanActions(); renderPlanSkills();
}
function addPlanAction(t){ t=String(t||'').trim(); if(!t) return; window._pfActions=window._pfActions||[]; if(!window._pfActions.includes(t)) window._pfActions.push(t); renderPlanActions(); }
function removePlanAction(i){ (window._pfActions||[]).splice(i,1); renderPlanActions(); }
async function submitPlan(){
  const isGroup=!!document.getElementById('pf-group')?.checked;
  const members=(window._pfMembers||[]).map(String);
  const sid=document.getElementById('pf-student').value;
  const start=document.getElementById('pf-start').value;
  const acts=(window._pfActions||[]);
  if(isGroup&&members.length<2){ toast('اختر طالبين على الأقل للخطة الجماعية','bad'); return }
  if(!isGroup&&!sid){ toast('اختر الطالب','bad'); return }
  if(!start){ toast('حدد تاريخ البدء','bad'); return }
  if(!acts.length){ toast('أضف إجراءً علاجيًا واحدًا على الأقل','bad'); return }
  // 🎯 الخطة العلاجية تُبنى على مهارة مفقودة؛ خطط الغياب والتسليم والسلوك مستثناة لأن أساسها مؤشر آخر
  const ms=(document.getElementById('pf-measure')||{}).value||'auto', pat=window._pfPattern||'';
  if(!(window._pfSkills||[]).length&&(ms==='academic'||(ms==='auto'&&!['absence','unsubmitted','behavior'].includes(pat)))){
    if(!(await askConfirm('الخطة العلاجية تُبنى على مهارة مفقودة محددة، فيُقاس أثرها عليها وتُبنى المهمة العلاجية منها. بدونها تكون الخطة عامة ويُقاس أثرها على كل الأنشطة.',{title:'لم تحدد مهارة مفقودة',yes:'احفظها عامة',no:'سأحدد المهارة'}))) return;
  }
  const dur=parseInt((document.getElementById('pf-dur')||{}).value,10)||14;
  // تُقرأ قيم النموذج الآن، وتُدمج مع «أحدث نسخة من الخطة في الخادم» لحظة الحفظ (لا لقطة معروضة قديمة)
  const F={ end:document.getElementById('pf-end').value||'', reason:document.getElementById('pf-reason').value||'', notes:document.getElementById('pf-notes').value||'',
    skills:(window._pfSkills||[]).slice(0,6), measure:(document.getElementById('pf-measure')||{}).value||'auto' };
  const newId=planEditId||('pl'+Date.now().toString(36)); let rec=null;
  const build=prev=>({
  // createdAt: ما سلّمه الطالب يوم البدء قبل إنشاء الخطة يُحسب قبليًا لا أثرًا لها
    ...(prev||{}), id: newId, createdAt: (prev&&prev.createdAt)||(prev?0:Date.now()),
    durationDays: dur, dueDate: (prev&&prev.dueDate&&prev.startDate===start&&prev.durationDays===dur)?prev.dueDate:addDays(start,dur),
    studentId: isGroup?'':sid, studentIds: isGroup?members:undefined, startDate:start,
    endDate:F.end, reason:F.reason, notes:F.notes,
    status:(prev&&prev.status)||'active',
    actions:acts.map(t=>{const old=prev&&(prev.actions||[]).find(a=>a.text===t);return {text:t,done:!!(old&&old.done)}}), at:Date.now(),
    skills:F.skills, measure:F.measure, pattern:window._pfPattern||(prev&&prev.pattern)||'' });
  const sendNow=!planEditId&&!!document.getElementById('pf-send')?.checked;
  try{ await savePlans(all=>{ const prev=planEditId?all.find(p=>p.id===planEditId):null; rec=build(prev);
      if(sendNow&&!rec.actions.some(a=>a.text===PLAN_REM_ACTION))rec.actions.push({text:PLAN_REM_ACTION,done:false});
      return prev?all.map(p=>p.id===planEditId?rec:p):[rec,...all]; });
    closePlanForm(); toast('حُفظت الخطة'); }
  catch(e){ toast('تعذّر الحفظ — تحقق من الاتصال','bad'); return }
  if(sendNow){
    try{const ids=isGroup?members:[sid];
      const r=await fetch(getApi().replace(/\/+$/,'')+'/plan-remedial',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),planId:rec.id,sids:ids})});
      const j=await r.json();const ok=(j.results||[]).filter(x=>x.ok),bad=(j.results||[]).filter(x=>!x.ok);
      if(ok.length)toast(`🩹 وصلت المهمة العلاجية إلى ${ok.length===1?ok[0].name:ok.length+' طلاب'}`);
      else if(bad.length)toast(`لم تُرسل المهمة: ${bad[0].reason}`,'bad');
    }catch(e){toast('حُفظت الخطة، لكن تعذّر إرسال المهمة — أرسلها من زر الخطة','bad')}
    try{await renderAutoRem()}catch(e){}
  }
  renderPlans(true);
}
async function deletePlan(id){
  if(!(await askConfirm('لا يمكن التراجع بعد الحذف.',{title:'حذف الخطة نهائيًا؟',yes:'احذف',no:'إبقاء',danger:true}))) return;
  try{ await savePlans(all=>all.filter(p=>p.id!==id)); closePlanForm(); toast('حُذفت الخطة'); renderPlans(true); }
  catch(e){ toast('تعذّر الحذف','bad') }
}
async function togglePlanAction(id,i){
  const shown=(PLAN_DATA&&PLAN_DATA.plans||[]).find(x=>x.id===id), was=!!(shown&&shown.actions&&shown.actions[i]&&shown.actions[i].done);
  try{ await savePlans(all=>{ const p=all.find(x=>x.id===id); if(p&&p.actions[i]){ p.actions[i].done=!was; p.actions[i].doneAt=!was?Date.now():0; } return all; }); renderPlans(true) }   // تاريخ التنفيذ يُطبع في ورقة الطالب
  catch(e){ toast('تعذّر التحديث','bad') }
}
async function closePlan(id,status){
  const live=(PLAN_DATA&&PLAN_DATA.plans||[]).find(x=>x.id===id); if(!live) return;
  let patch=null;
  if(status==='done'){
    // 🏁 الإنهاء اليدوي يحفظ النتيجة لحظتها (قبل ← بعد) — كانت تُغلق «منتهية» بلا نتيجة ولا أثر في سجلها
    const today=new Date().toISOString().slice(0,10), left=(live.timing&&live.timing.skillsLeft)||[];
    const met=live.verdict==='تحسّن'&&!left.length&&live.after&&live.after.measured&&live.after.rate>=SKILL_TARGET_UI;
    const outcome=met?'نجحت الخطة':live.verdict==='تحسّن'?'أُنهيت بتحسّن دون بلوغ الهدف':live.after&&live.after.measured?`أُنهيت — ${live.verdict||'بلا فرق'}`:'أُنهيت قبل قياس أثرها';
    const sum=`${live.before&&live.before.measured?live.before.rate+'%':'—'} ← ${live.after&&live.after.measured?live.after.rate+'%':'—'}${live.gain!=null?` (${planSigned(live.gain)})`:''}`;
    if(!(await askConfirm(`النتيجة الآن: ${sum}\n${live.verdict||''}${left.length?`\nلم تبلغ الهدف: ${left.map(x=>x.skill).join('، ')}`:''}\n\nتُحفظ «${outcome}» في سجل الخطة.`,{title:'إنهاء الخطة؟',yes:'✔ إنهاء',no:'إلغاء'}))) return;
    patch=p=>{ p.outcome=p.outcome||outcome; if(!p.endDate) p.endDate=today;
      p.history=[...(p.history||[]),{at:today,decision:'manual_close',label:'أنهاها المعلم',verdict:live.verdict,gain:live.gain,after:live.after&&live.after.measured?live.after.rate:null,round:(live.timing&&live.timing.round)||1}]; };
  } else patch=p=>{ delete p.outcome; p.endDate=undefined; };
  try{ await savePlans(all=>{ const p=all.find(x=>x.id===id); if(p){ patch(p); p.status=status; } return all; });
    // تختفي فورًا من القائمة المعروضة دون انتظار إعادة الحساب
    if(PLAN_DATA&&Array.isArray(PLAN_DATA.plans)){ const q=PLAN_DATA.plans.find(x=>x.id===id); if(q) q.status=status; }
    renderPlans(true); toast(status==='done'?'أُنهيت الخطة':'أُعيد فتح الخطة') }catch(e){ toast('تعذّر التحديث','bad') }
}
function planToggleOpen(id,on){if(on)window._planOpen.add(id);else window._planOpen.delete(id)}
async function pqReteach(cls,skill){
  try{ await pqReteachPost(cls+'|'+skill); }catch(e){ toast('تعذّر الحفظ — تحقق من الاتصال وأعد المحاولة','bad'); return; }
  toast('✓ سُجّلت إعادة الشرح — تختفي من القائمة أسبوعين على كل أجهزتك، ثم تعود إن بقي الضعف','good'); renderPlanCandidates(); }
async function pqCheckpoint(id){
  const p=(PLAN_DATA&&PLAN_DATA.plans||[]).find(x=>x.id===id); if(!p) return; const r=(p.timing&&p.timing.round)||1, today=new Date().toISOString().slice(0,10), adv=pqAdvice(p);
  try{ await savePlans(all=>{ const x=all.find(y=>y.id===id); if(x) x.history=[...(x.history||[]),{at:today,decision:'checkpoint',label:'نقطة فحص اليوم السابع',verdict:p.verdict,gain:p.gain,after:p.after&&p.after.measured?p.after.rate:null,round:r,advice:adv.t}]; return all; });
    toast('✓ سُجّلت نقطة الفحص','good'); renderPlans(true); }catch(e){ toast('تعذّر الحفظ','bad'); }
}
function pqGo(id){ const el=document.getElementById('pc-'+id); if(!el){ let reset=false; const st=document.getElementById('plan-status'); if(st&&st.value!==''){ st.value=''; reset=true; } if(PLAN_SUM_F){ PLAN_SUM_F=''; reset=true; } const pc=document.getElementById('plan-class'); if(pc&&pc.value){ pc.value=''; reset=true; } if(reset){ renderPlans(false).then(()=>setTimeout(()=>pqGo(id),300)); } return; }
  el.scrollIntoView({behavior:'smooth',block:'center'}); el.classList.add('pq-flash'); setTimeout(()=>el.classList.remove('pq-flash'),1600); }
function pqOpenSet(t,on){ try{ const o=JSON.parse(localStorage.getItem(PQ_OPEN_KEY)||'{}'); o[t]=on?1:0; localStorage.setItem(PQ_OPEN_KEY,JSON.stringify(o)); }catch(e){} }
function planFromCandidate(sid,reason){
  openPlanForm();
  const sel=document.getElementById('pf-student'); if(sel) sel.value=sid;
  showDiagnosis(sid,true);
  const rs=document.getElementById('pf-reason'); if(rs&&!rs.value) rs.value=reason||'';
}
function planSumFilter(k){ PLAN_SUM_F=(PLAN_SUM_F===k?'':k); renderPlans(false); }
/* 🔗 من تنبيه «صفحة اليوم» إلى الخطط المقصودة مباشرة (تنتظر قرارك · تنتهي خلال 3 أيام) */
function plansGo(k){ PLAN_SUM_F=k||''; const sel=document.getElementById('plan-class'); if(sel) sel.value=''; goTab('plans');
  setTimeout(()=>{ try{ document.querySelector('.plan-sum')?.scrollIntoView({behavior:'smooth',block:'start'}); }catch(e){} },400); }
/* 📄 ورقة «خطتي العلاجية» للطالب — ما المطلوب منه، بلغته هو، ومربعات «تمّ» يؤشّر عليها المعلم.
   تُطبع نسختين (للطالب ولملف المعلم) فتكون مستندًا يثبت تنفيذ الخطة. المنفَّذ من الإجراءات يُطبع ✓ بتاريخه،
   فطباعتها في نهاية الخطة تُخرج سجل التنفيذ مكتملًا. الخطة الجماعية: ورقة لكل طالب. */
const PSH_TEACHER_ONLY=/ولي الأمر|إجلاسه|إسناده إلى زميل|التحقق من تسليمه|مقابلة فردية قصيرة لمعرفة|ثقته بنفسه/;
function pshTask(text){
  const t=String(text||'').trim().replace(/نافس:\s*/g,''), q=(t.match(/«[^»]+»/)||[''])[0];
  const R=[
    [/^تأسيس «/,()=>[`احضر جلسة شرح لمهارة ${q} من البداية بأمثلة جديدة مع معلمك`,'في الفصل']],
    [/^تدريب متدرّج على «/,()=>[`تدرّب على ${q} خطوة خطوة من السهل إلى الأصعب، ويتحقق معلمك بعد كل خطوة`,'في الفصل']],
    [/^دعم «/,()=>[`راجع أخطاءك في ${q} مع معلمك، ثم حلّ مثالًا معه`,'في الفصل']],
    [/^ورقة تدريب قصيرة على «/,()=>[`أكمل ورقة تدريب قصيرة على ${q} (5 أسئلة) وصحّحها مع معلمك`,'ورقة']],
    [/^حل المهمة العلاجية المرسلة/,()=>['حلّ المهمة العلاجية المرسلة إلى بوابتك (أسئلة من أخطائك أنت)','البوابة']],
    [/^إعادة حل/,()=>[t.replace(/^إعادة حل/,'أعد حلّ').replace(/أخطائه/g,'أخطائك'),'البوابة']],
    [/^جلسة فردية قصيرة لمراجعة أخطائه/,()=>[`احضر جلسة فردية قصيرة مع معلمك لمراجعة أخطائك في ${q||'النشاط'}`,'في الفصل']],
    [/^مراجعة المفاهيم الأساسية/,()=>['راجع المفاهيم الأساسية للوحدة مع معلمك (10 دقائق أسبوعيًا)','في الفصل']],
    [/^إعادة حل الأنشطة التي أخطأ فيها/,()=>['أعد حل الأنشطة التي أخطأت فيها بعد أن يشرحها لك معلمك','البوابة']],
    [/^تكليف بورقة تدريب إضافية/,()=>['أكمل ورقة تدريب إضافية كل أسبوع وسلّمها لمعلمك','ورقة']],
    [/^تجزئة المهمة/,()=>['نفّذ المهمة على خطوات صغيرة، واعرض كل خطوة على معلمك قبل التالية','في الفصل']],
    [/^تكليفه بتلخيص الدرس/,()=>['لخّص الدرس شفهيًا لمعلمك في نهاية الحصة','في الفصل']],
    [/^تعويض ما فاته/,()=>['احضر حصة إضافية قصيرة لتعويض ما فاتك من دروس هذه المهارات','في الفصل']],
    [/^تدريبه على أسئلة بنمط الاختبار/,()=>['تدرّب على أسئلة بنمط الاختبار في هذه المهارات','ورقة']],
  ];
  for(const [re,f] of R) if(re.test(t)) return f();
  // صياغة عامة: من الغائب إلى المخاطَب
  return [t.replace(/أخطائه/g,'أخطائك').replace(/\bمعه\b/g,'معك').replace(/\bله\b/g,'لك').replace(/مستواه/g,'مستواك'),'في الفصل'];
}
function pshDate(ms){ const d=new Date(ms); return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`; }
function pshPage(p,who){
  const E=planEsc, start=Date.parse(String(p.startDate||'')+'T00:00:00')||Date.now();
  const dur=Number(p.durationDays)||Math.max(7,Math.round(((Date.parse(String(p.endDate||'')+'T00:00:00')||start+14*864e5)-start)/864e5))||14;
  const end=Date.parse(String(p.endDate||'')+'T00:00:00')||start+dur*864e5;
  const ymd=ms=>{const d=new Date(ms);return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`};
  const acts=(p.actions||[]).filter(a=>a&&a.text);
  const mine=acts.filter(a=>!PSH_TEACHER_ONLY.test(a.text)), teach=acts.filter(a=>PSH_TEACHER_ONLY.test(a.text));
  const n=mine.length+1, due=i=>pshDate(start+Math.round((i+1)*(end-start)/n));
  /* 🎯 لكل مهارة: «الآن» = الأنشطة منذ بدء الخطة (سؤالان فأكثر)، وإلا نتيجة المهمة العلاجية 🩹، وإلا قياس ما قبل الخطة */
  const mItems=who.m&&who.m.skill&&Array.isArray(who.m.skill.items)?who.m.skill.items:null;
  const remBy=planRemSkillsFor(p,who.sid);
  const goals=(mItems?(Array.isArray(p.skills)?p.skills:[]).map(k=>{const x=mItems.find(y=>y.skill===k)||{};
      return {skill:k,before:x.before?x.before.rate:null,after:x.after&&x.after.total>=2?x.after.rate:null};}):planGoalRows(p))
    .map(g=>({...g,rem:remBy[g.skill]!=null?remBy[g.skill]:null}));
  const first=String(who.name||'').trim().split(/\s+/)[0]||'';
  const done=p.status==='done';
  const rows=mine.map((a,i)=>{const [tx,tag]=pshTask(a.text);return `<tr><td class="n">${i+1}</td><td>${E(tx)} <span class="psh-tag">${tag}</span></td><td class="d">${due(i)}</td>
      <td class="c">${a.done?'<span class="psh-box on">✓</span>':'<span class="psh-box"></span>'}</td><td class="d">${a.done&&a.doneAt?pshDate(a.doneAt):'..../....'}</td></tr>`}).join('');
  const verify=`<tr><td class="n">${n}</td><td>${goals.length?'اختبار قصير للتحقق من وصولك إلى الهدف في '+(goals.length===1?'المهارة':'المهارات'):'اختبار قصير للتحقق من تحسّن مستواك'} <span class="psh-tag">تحقق</span></td><td class="d">${pshDate(end)}</td>
      <td class="c">${done?'<span class="psh-box on">✓</span>':'<span class="psh-box"></span>'}</td><td class="d">..../....</td></tr>`;
  const bar=(v,c)=>`<span class="psh-bar"><i style="width:${Math.max(3,v==null?0:v)}%;background:${c}"></i><u></u></span>`;
  return `<div class="rep-page plan-doc psh">${repHead('ورقة الطالب — تُحفظ في ملف الإنجاز','خطتي العلاجية')}
    <div class="rep-in">
      <div class="rep-info psh-info"><div>اسم الطالب<b>${E(who.name||'')}</b></div><div>الصف<b>${E(who.cls||p.cls||'')}</b></div>
        <div>مدة الخطة · حالتها<b>${dur===7?'أسبوع':dur===14?'أسبوعان':dur===21?'ثلاثة أسابيع':dur===28?'أربعة أسابيع':dur+' يومًا'} · <span class="psh-stv">${done?'منتهية':'جارية'} (ج${E(p.round||1)})</span></b></div><div>من — إلى<b>${ymd(start)} — ${ymd(end)}</b></div></div>
      <div class="rep-sec">① لماذا هذه الخطة؟</div>
      <div class="rep-box psh-why">عزيزي ${E(first)}، ${goals.length?`أظهرت إجاباتك في الأنشطة والاختبارات أنك تحتاج دعمًا في ${goals.length===1?'المهارة التالية':'المهارات التالية'}. هذه الخطة صُمّمت لك وحدك لتصل إلى <b>${SKILL_TARGET_UI}%</b> في كل مهارة — ومعلمك معك خطوة بخطوة.`
          :`هذه الخطة صُمّمت لك وحدك لتحسين مستواك${p.reason?`: ${E(String(p.reason).split(' — ')[0])}`:''} — ومعلمك معك خطوة بخطوة.`}
        ${goals.length?`${goals.map(g=>{const fromRem=g.after==null&&g.rem!=null, now=g.after!=null?g.after:fromRem?g.rem:g.before;const c=now==null?'#9AA6B2':now>=SKILL_TARGET_UI?'#1B9C6B':now>=40?'#E0A100':'#D6455B';
            const was=(g.after!=null||fromRem)&&g.before!=null&&g.before!==now?` <small class="w">كنت ${g.before}%</small>`:'';
            return `<div class="psh-sk"><span>🎯 ${E(g.skill)}${was}</span>${bar(now,c)}<em>الآن ${now==null?'—':now+'%'}${fromRem?'<small title="من المهمة العلاجية">🩹</small>':''}</em><em class="t">الهدف ${SKILL_TARGET_UI}%</em></div>`}).join('')}
          ${goals.some(g=>g.after==null&&g.rem!=null)?`<div class="psh-note">🩹 = نتيجتك في المهمة العلاجية. يتأكد معلمك من وصولك للهدف بنشاط جديد في هذه المهارات.</div>`:''}`:''}</div>
      <div class="rep-sec">② المطلوب منك — نفّذها بالترتيب، ويؤشّر معلمك على كل ما تُنجزه</div>
      <div class="rep-box"><table class="rt psh-t"><thead><tr><th>م</th><th style="text-align:start">المهمة</th><th>آخر موعد</th><th>تمّ ✓</th><th>تاريخ الإنجاز</th></tr></thead><tbody>${rows}${verify}</tbody></table>
        ${teach.length?`<div class="psh-teach"><b>وسيقوم معلمك بـ:</b> ${teach.map(a=>E(a.text)).join(' · ')}</div>`:''}</div>
      <div class="rep-sec">③ كيف أعرف أني نجحت؟</div>
      <div class="psh-goal"><div><b>✅ تنجح الخطة</b> عندما تصل إلى ${SKILL_TARGET_UI}% فأكثر${goals.length?' في كل مهارة':''}، فتُغلق ويُسجَّل ذلك في ملفك.</div>
        <div><b>🔁 إن لم تصل بعد</b> نراجع معًا ما صعب عليك ونبدأ جولة ثانية بأساليب مختلفة — لا عقوبة، بل فرصة.</div></div>
      <div class="psh-tip">💡 ابدأ بالمهمة الأولى اليوم، واسأل معلمك عن أي سؤال قبل أن تنتقل للتالي.</div>
      <div class="rep-sec">④ متابعة المعلم</div>
      <div class="rep-box"><table class="rt psh-f"><thead><tr><th style="width:18%">التاريخ</th><th>ما تمّ / ملاحظة المعلم</th><th style="width:20%">توقيع المعلم</th></tr></thead><tbody><tr><td>&nbsp;</td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td></tr></tbody></table></div>
      <div class="plan-sign"><div>الطالب<b>${E(who.name||'')}</b><span>التوقيع: ....................</span></div>
        <div>ولي الأمر — اطّلعت<b>&nbsp;</b><span>الاسم والتوقيع: ....................</span></div>
        <div>معلم المادة<b>${E(rcGet('teacher')||'')}</b><span>التوقيع: ....................</span></div></div>
    </div></div>`;
}
async function printPlanSheet(id){
  const p=(PLAN_DATA&&PLAN_DATA.plans||[]).find(x=>x.id===id); if(!p){ toast('الخطة غير موجودة','bad'); return; }
  // نتائج المهام العلاجية تظهر في الورقة — تُجلب إن لم تُحمَّل بعد
  if(!REM_ROWS.length){ try{ const r=await fetch(getApi().replace(/\/+$/,'')+'/remedials?t='+encodeURIComponent(getTok())); const j=await r.json(); if(j&&Array.isArray(j.rows)) REM_ROWS=j.rows; }catch(e){} }
  ensureLogo();
  let box=document.getElementById('plan-print'); if(!box){ box=document.createElement('div'); box.id='plan-print'; box.className='rep'; document.body.appendChild(box); }
  const m0=Array.isArray(p.members)&&p.members[0];
  const who=p.group&&Array.isArray(p.members)&&p.members.length?p.members.map(m=>({name:m.name,cls:m.cls||p.cls,sid:String(m.studentId||''),m}))
    :[{name:p.name,cls:p.cls,sid:String(p.studentId||(m0&&m0.studentId)||''),m:m0||null}];
  box.innerHTML=who.map(w=>pshPage(p,w)).join('');
  unifiedA4Print({bodyClass:'printing-plans',title:`خطتي العلاجية — ${p.name||''}`,selector:'#plan-print',orientation:'portrait',margin:'8mm'});
}
/* 📝 ورقة تدريب علاجية مطبوعة على مهارة من الخطة — من أسئلة أنشطتك المصنّفة بهذه المهارة.
   الأولوية: سؤال «بديل» (توأم) لسؤال أخطأ فيه الطالب ← بديل لأي سؤال ← سؤال أخطأ فيه ← غيره.
   البدائل أسئلة جديدة بالفكرة نفسها، فلا يعيد الطالب حفظ ما رآه. وصفحة مستقلة بالإجابات للمعلم. */
const DRILL={plan:null,skill:'',n:5,key:true,cache:null};
async function drillPool(p,skill){
  const api=getApi().replace(/\/+$/,''), tok=encodeURIComponent(getTok());
  if(!DRILL.cache){ const j=await (await fetch(`${api}/skills-maps?t=${tok}`)).json(); if(!j||!j.ok) throw new Error('maps'); DRILL.cache={maps:j.maps||{},twins:{}}; if(j.alias&&typeof SKILL_ALIAS!=='undefined') SKILL_ALIAS=j.alias; }
  const M=DRILL.cache.maps, sids=(p.group?(p.members||[]).map(m=>String(m.studentId)):[String(p.studentId)]);
  // مهارة السؤال: تصنيف الخادم، وإلا المكتوبة على السؤال نفسه (أنشطة نافس والتشخيصي)
  const C=typeof skCanon==='function'?skCanon:(x=>String(x).trim());
  const hits=[]; (HW||[]).forEach(h=>{ if(!h||h.remedial) return;
    const m=(h.sid&&M[h.sid])||(Array.isArray(h.qs)&&h.qs.some(q=>q&&q.skill)?Object.fromEntries(h.qs.map((q,i)=>[i,q&&q.skill]).filter(x=>x[1])):null); if(!m) return;
    Object.entries(m).forEach(([i,sk])=>{ if(C(sk)!==C(skill)) return; const q=(h.qs||[])[+i]; if(!q||!['q','tf','f',undefined].includes(q.t)) return;
      const wrong=sids.some(sid=>{const d=String(h.subs&&h.subs[sid]&&h.subs[sid].d||''); return d.length>+i&&d[+i]==='0'}); hits.push({h,i:+i,q,wrong}); }); });
  const need=[...new Set(hits.map(x=>x.h.sid).filter(Boolean))].filter(sid=>!(sid in DRILL.cache.twins));
  await Promise.all(need.map(async sid=>{ try{ const j=await (await fetch(`${api}/twins?hw=${encodeURIComponent(sid)}&t=${tok}`)).json(); DRILL.cache.twins[sid]=(j&&j.twins&&j.twins.items)||[]; }catch(e){ DRILL.cache.twins[sid]=[]; } }));
  // شكل السؤال يُطبع معه: صورته، أو جدوله/رسمه البياني (fig) — وما تعذّر رسم شكله لا يُطبع، فلا يُفهم بدونه
  const img=x=>{ const u=String(x&&x.img||''); return /^(nafs\/[\w.-]+\.(webp|png|jpe?g)|https:\/\/\S+)$/i.test(u)?u:''; };
  const norm=x=>({t:x.t==='tf'?'tf':x.t==='f'?'f':'q',q:String(x.q||'').trim(),o:Array.isArray(x.o)?x.o.map(v=>String(v||'').trim()).filter(Boolean):[],a:x.a,img:img(x),fig:x&&x.fig&&typeof nfFigClean==='function'?nfFigClean(x.fig):null});
  const out=[], seen=new Set(), add=(x,src,tier)=>{const n=norm(x); if(!n.q||(x&&x.fig&&!n.img&&!n.fig)) return; if(n.t==='q'&&(n.o.length<2||!(Number(n.a)>=0&&Number(n.a)<n.o.length))) return; const k=rdNormAr?rdNormAr(n.q):n.q; if(seen.has(k)) return; seen.add(k); out.push({...n,src,tier,r:Math.random()});};
  hits.forEach(x=>{ (DRILL.cache.twins[x.h.sid]||[]).filter(t=>t.i===x.i).forEach(t=>(t.alts||[]).forEach(a=>add(a,x.h.title,x.wrong?0:1))); });
  hits.forEach(x=>add(x.q,x.h.title,x.wrong?2:3));
  // 🧭 ناتج من نواتج نافس: أسئلة بنك نافس عليه (تُصحَّح آليًا) تكمّل الورقة
  if(typeof NAFS_BANK!=='undefined'&&typeof nafsOutOfSkill==='function'){ const o=nafsOutOfSkill(C(skill));
    if(o) NAFS_BANK.filter(q=>q.o===o.id&&nafsAuto(q)&&(typeof nafsIn!=='function'||nafsIn(q))).forEach(q=>add(nafsToQ(q),'بنك نافس',4)); }
  return out.sort((a,b)=>a.tier-b.tier||a.r-b.r);
}
async function planDrillOpen(id){
  const p=(PLAN_DATA&&PLAN_DATA.plans||[]).find(x=>x.id===id); if(!p) return;
  const sk=(Array.isArray(p.skills)?p.skills:[]).filter(Boolean);
  if(!sk.length){ toast('حدّد مهارة مستهدفة في الخطة أولًا (✏️ تعديل) — الورقة تُبنى من أسئلة هذه المهارة','bad'); return; }
  DRILL.plan=id; if(!sk.includes(DRILL.skill)) DRILL.skill=sk[0];
  openModal(`<h2>📝 ورقة تدريب — ${planEsc(p.name)}</h2>
    <p class="muted" style="font-size:.84rem;margin:.2rem 0 .7rem">أسئلة مطبوعة على مهارة واحدة من أنشطتك المصنّفة: البديلة أولًا (أسئلة جديدة بالفكرة نفسها) ومما أخطأ فيه الطالب، وصفحة إجابات لك.</p>
    <label style="font-weight:700;font-size:.85rem">المهارة</label>
    <div class="drill-sk">${sk.map(s=>`<button type="button" class="btn ${s===DRILL.skill?'tick':'ghost'} sm" onclick="DRILL.skill=${planEsc(JSON.stringify(s))};planDrillOpen('${planEsc(id)}')">🎯 ${planDisp(s)}</button>`).join('')}</div>
    <div class="row" style="gap:.6rem;align-items:center;margin-top:.7rem;flex-wrap:wrap"><label style="font-weight:700;font-size:.85rem">عدد الأسئلة</label>
      ${[5,8,10].map(n=>`<button type="button" class="btn ${DRILL.n===n?'tick':'ghost'} sm" onclick="DRILL.n=${n};planDrillOpen('${planEsc(id)}')">${n}</button>`).join('')}
      <label style="display:flex;gap:.35rem;align-items:center;font-size:.85rem;margin-inline-start:auto"><input type="checkbox" id="drill-key" ${DRILL.key?'checked':''} onchange="DRILL.key=this.checked"> صفحة الإجابات للمعلم</label></div>
    <div id="drill-avail" class="muted" style="font-size:.84rem;margin-top:.7rem">⏳ جارٍ جمع أسئلة «${planDisp(DRILL.skill)}»…</div>
    <div class="modal-foot"><button class="btn tick" id="drill-go" type="button" disabled onclick="planDrillPrint()">🖨️ اطبع ورقة التدريب</button><button class="btn ghost" type="button" onclick="closeModal()">إغلاق</button></div>`);
  try{ const pool=await drillPool(p,DRILL.skill); DRILL.pool=pool;
    const el=document.getElementById('drill-avail'), go=document.getElementById('drill-go'); if(!el) return;
    const tw=pool.filter(x=>x.tier<2).length, wr=pool.filter(x=>x.tier===0||x.tier===2).length;
    if(!pool.length){ el.innerHTML='⚠️ لا أسئلة مصنّفة بهذه المهارة في أنشطتك المنشورة بعد. صنّف مهارات الأسئلة من «🤖 العلاج التلقائي ← تصنيف مهارات الأسئلة»، أو انشر نشاطًا عليها.'; return; }
    const qn=n=>n===1?'سؤال واحد':n===2?'سؤالان':n<=10?n+' أسئلة':n+' سؤالًا';
    el.innerHTML=`✓ متاح <b>${qn(pool.length)}</b> (${tw} بديل جديد${wr?` · ${wr} مرتبط بما أخطأ فيه`:''}) — ستُطبع <b>${Math.min(DRILL.n,pool.length)}</b>${pool.length<DRILL.n?' (كل المتاح)':''}.`;
    if(go) go.disabled=false;
  }catch(e){ const el=document.getElementById('drill-avail'); if(el) el.textContent='تعذّر الاتصال بالخادم — حاول مرة أخرى.'; }
}
function drillPage(p,who,qs,skill){
  const E=planEsc, L=['أ','ب','ج','د','هـ','و'], d=new Date(), ymd=`${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  const body=qs.map((x,k)=>`<div class="drl-q"><div class="drl-qt"><b>${k+1}</b><span>${E(x.q)}</span></div>${x.img?`<img class="drl-img" src="${E(x.img)}" alt="">`:''}${x.fig&&typeof nfFigHTML==='function'?`<div class="drl-fig">${nfFigHTML(x.fig)}</div>`:''}
    ${x.t==='tf'?'<div class="drl-tf"><span>( &nbsp; ) صح</span><span>( &nbsp; ) خطأ</span></div>'
     :x.t==='f'?'<div class="drl-f">الإجابة: ...............................................................</div>'
     :`<div class="drl-o ${x.o.some(o=>o.length>28)?'one':''}">${x.o.map((o,i)=>`<span><i>${L[i]}</i>${E(o)}</span>`).join('')}</div>`}</div>`).join('');
  return `<div class="rep-page plan-doc drl">${repHead('ورقة تدريب علاجية',`تدريب على «${planSkName(skill)}»`)}
    <div class="rep-in">
      <div class="rep-info"><div>اسم الطالب<b>${E(who.name||'')}</b></div><div>الصف<b>${E(who.cls||p.cls||'')}</b></div><div>التاريخ<b>${ymd}</b></div><div>الدرجة<b>........ / ${qs.length}</b></div></div>
      <div class="drl-ins">✏️ أجب عن الأسئلة التالية: ضع دائرة حول رمز الإجابة الصحيحة، أو علامة ( ✓ ) أمام «صح» أو «خطأ». حاول وحدك أولًا، ثم صحّحها مع معلمك.</div>
      <div class="rep-box drl-box">${body}</div>
      <div class="plan-sign"><div>الطالب<b>${E(who.name||'')}</b><span>التوقيع: ....................</span></div><div>صحّحها مع المعلم<b>&nbsp;</b><span>التاريخ: ..../..../........</span></div><div>معلم المادة<b>${E(rcGet('teacher')||'')}</b><span>التوقيع: ....................</span></div></div>
    </div></div>`;
}
function drillKeyPage(p,qs,skill){
  const E=planEsc, L=['أ','ب','ج','د','هـ','و'];
  return `<div class="rep-page plan-doc drl">${repHead('للمعلم — لا تُعطى للطالب','مفتاح إجابات ورقة التدريب')}
    <div class="rep-in"><div class="drl-ins">«${E(planSkName(skill))}» · ${E(p.name||'')} · ${qs.length} أسئلة</div>
      <div class="rep-box"><table class="rt"><thead><tr><th>م</th><th style="text-align:start">السؤال</th><th>الإجابة</th><th>من نشاط</th></tr></thead><tbody>
      ${qs.map((x,k)=>`<tr><td>${k+1}</td><td style="text-align:start">${E(x.q.length>90?x.q.slice(0,90)+'…':x.q)}</td><td><b>${x.t==='tf'?(x.a===true||x.a==='true'?'صح':'خطأ'):x.t==='f'?E(x.a):`${L[+x.a]}) ${E(x.o[+x.a]||'')}`}</b></td><td class="muted">${E(x.src||'')}${x.tier<2?' · بديل':''}</td></tr>`).join('')}
      </tbody></table></div></div></div>`;
}
function planDrillPrint(){
  const p=(PLAN_DATA&&PLAN_DATA.plans||[]).find(x=>x.id===DRILL.plan); if(!p||!DRILL.pool||!DRILL.pool.length) return;
  const qs=DRILL.pool.slice(0,DRILL.n);
  ensureLogo();
  let box=document.getElementById('plan-print'); if(!box){ box=document.createElement('div'); box.id='plan-print'; box.className='rep'; document.body.appendChild(box); }
  const who=p.group&&Array.isArray(p.members)&&p.members.length?p.members.map(m=>({name:m.name,cls:m.cls||p.cls})):[{name:p.name,cls:p.cls}];
  box.innerHTML=who.map(w=>drillPage(p,w,qs,DRILL.skill)).join('')+(DRILL.key?drillKeyPage(p,qs,DRILL.skill):'');
  closeModal();
  unifiedA4Print({bodyClass:'printing-plans',title:`ورقة تدريب — ${planSkName(DRILL.skill)}`,selector:'#plan-print',orientation:'portrait',margin:'8mm'});
}
/* id: طباعة خطة واحدة فقط؛ بدونه تُطبع الخطط الظاهرة حسب الفلاتر */
async function printPlans(id){
  const rows=id?(PLAN_DATA&&PLAN_DATA.plans||[]).filter(p=>p.id===id):planFiltered();
  if(!rows.length){ toast('لا توجد خطط للطباعة','bad'); return }
  if(!REM_ROWS.length){ try{ const r=await fetch(getApi().replace(/\/+$/,'')+'/remedials?t='+encodeURIComponent(getTok())); const j=await r.json(); if(j&&Array.isArray(j.rows)) REM_ROWS=j.rows; }catch(e){} }
  ensureLogo();
  let box=document.getElementById('plan-print');
  if(!box){ box=document.createElement('div'); box.id='plan-print'; box.className='rep'; document.body.appendChild(box); }
  const dt=new Date(), today=`${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`;
  const pct=m=>m&&m.measured&&m.rate!=null?m.rate+'%':'—';
  const diff=g=>g==null?'—':((g>0?'+':'')+g+' نقطة');
  const detail=m=>m&&m.measured&&m.total?`<small>${m.correct} من ${m.total} ${m.acts?`سؤالًا في ${m.acts} نشاط`:''}</small>`:'';
  const exDet=m=>m&&m.measured&&m.tests?`<small>${m.tests} ${m.tests===1?'اختبار':'اختبارات'}</small>`:'';
  const page=p=>{
    const ex=p.exam||null, c=p.context||{}, acts=Array.isArray(p.actions)?p.actions:[];
    return `<div class="rep-page plan-doc">
    ${repHead(`${p.group?'خطة جماعية':'خطة فردية'} — ${p.name||''}`,'خطة علاجية')}
    <div class="rep-in">
      <div class="rep-info">
        <div>${p.group?'المجموعة':'الطالب'}<b>${planEsc(p.group?`${p.size} طلاب`:p.name)}</b></div>
        <div>الفصل<b>${planEsc(p.cls||'—')}</b></div>
        <div>المادة<b>${esc(rcGet('subject')||'العلوم')}</b></div>
        <div>تاريخ التقرير<b>${today}</b></div>
        <div>بداية الخطة<b>${planEsc(String(p.startDate||'—').replace(/-/g,'/'))}</b></div>
        <div>${p.endDate?'تاريخ الإغلاق':'تنتهي المدة'}<b>${planEsc(p.endDate?String(p.endDate).replace(/-/g,'/'):(p.timing&&p.timing.due?String(p.timing.due).replace(/-/g,'/')+` (${p.timing.days} يومًا)`:'جارية'))}</b></div>
        <div>حالة الخطة<b>${p.status==='done'?planEsc(p.outcome||'منتهية'):(p.timing&&p.timing.expired?'انتهت المدة — بانتظار القرار':'جارية'+(p.timing&&p.timing.round>1?` (الجولة ${p.timing.round})`:''))}</b></div>
        <div>الحكم على الأثر<b>${planEsc(p.verdict||'—')}</b></div>
      </div>
      <div class="rep-sec">أولًا: تحديد الفجوات في المهارات والأهداف</div>
      ${Array.isArray(p.skills)&&p.skills.length?`<div class="rep-box"><table class="rt"><thead><tr><th style="width:30px">م</th><th>المهارة المفقودة</th><th>مستواه قبل</th><th>الهدف</th><th>الإجراءات</th><th>أداة القياس</th><th>مستواه بعد</th></tr></thead><tbody>
        ${planGoalRows(p).map((g,i)=>{const ax=acts.filter(a=>String(a.text).includes(`«${g.skill}»`));return `<tr><td>${i+1}</td><td style="text-align:start"><b>${planDisp(g.skill)}</b></td>
          <td>${g.before!=null?g.before+'%'+(g.beforeX?`<small>${g.beforeX.correct} من ${g.beforeX.total}</small>`:''):'—'}</td><td>${SKILL_TARGET_UI}% فأكثر</td>
          <td style="text-align:start;font-size:.78em">${ax.length?ax.map(a=>planEsc(String(a.text).replace(/^[^:]+:\s*/,''))).join('<br>'):'—'}</td>
          <td style="font-size:.8em">أسئلة المهارة في الأنشطة والمهمة العلاجية</td>
          <td>${g.after!=null?`${g.after}%${g.afterX?`<small>${g.afterX.correct} من ${g.afterX.total}</small>`:''}${g.met?'<small>✔ بلغ الهدف</small>':''}`:'لم يُقَس بعد'}</td></tr>`}).join('')}
      </tbody></table>
      <div class="plan-note"><b>سبب الخطة:</b> ${planEsc(p.reason||'—')}</div></div>`
      :`<div class="rep-box plan-txt"><b>سبب الخطة:</b> ${planEsc(p.reason||'—')}<br><span style="color:#8a5a00">لم تُحدَّد مهارة مفقودة لهذه الخطة.</span></div>`}
      <div class="rep-sec">ثانيًا: الإجراءات العلاجية</div>
      <div class="rep-box"><table class="rt"><thead><tr><th style="width:36px">م</th><th>الإجراء</th><th style="width:110px">التنفيذ</th></tr></thead><tbody>
        ${acts.length?acts.map((a,i)=>`<tr><td>${i+1}</td><td style="text-align:start">${planDisp(a.text)}</td><td>${a.done?'✔ نُفِّذ':'لم يُنفَّذ'}</td></tr>`).join(''):'<tr><td colspan="3">لا توجد إجراءات مسجّلة</td></tr>'}
      </tbody></table>
      <div class="plan-note">نُفِّذ ${p.actionsDone||0} من ${p.actionsTotal||0} إجراء</div></div>
      <div class="rep-sec">ثالثًا: قياس الأثر في عناصر التقييم (من السجلات الفعلية)</div>
      <div class="rep-box"><table class="rt"><thead><tr><th>أداة القياس</th><th>قبل الخطة</th><th>بعد الخطة</th><th>الفرق</th><th>الحكم</th></tr></thead><tbody>
        <tr><td><b>${planMainLabel(p).replace(/^\S+\s/,'')}</b>${p.mainBy&&p.mainBy!=='academic'?'<small>أساس الحكم</small>':''}</td><td>${pct(p.before)}${p.group?'':detail(p.before)}</td><td>${pct(p.after)}${p.group?'':detail(p.after)}</td><td>${diff(p.gain)}</td><td>${planEsc(p.verdict||'—')}</td></tr>
        ${p.academic?`<tr><td><b>التحصيل (${p.academic.basis==='skills'?'المهارات':'الأنشطة'})</b></td><td>${pct(p.academic.before)}${detail(p.academic.before)}</td><td>${pct(p.academic.after)}${detail(p.academic.after)}</td><td>${diff(p.academic.gain)}</td><td>${planEsc(p.academic.verdict||'—')}</td></tr>`:''}
        ${planConductRows(p).filter(x=>x.key!==p.mainBy).map(x=>`<tr><td><b>${planEsc(x.label)}</b></td><td>${x.before.total?x.before.rate+'%<small>'+x.before.correct+' من '+x.before.total+'</small>':'—'}</td><td>${x.after.total?x.after.rate+'%<small>'+x.after.correct+' من '+x.after.total+'</small>':'—'}</td><td>${diff(x.gain)}</td><td>${planEsc(x.verdict)}</td></tr>`).join('')}
        ${ex?`<tr><td><b>الاختبارات</b></td><td>${pct(ex.before)}${exDet(ex.before)}</td><td>${pct(ex.after)}${exDet(ex.after)}</td><td>${diff(ex.gain)}</td><td>${planEsc(ex.verdict||'—')}</td></tr>`:''}
      </tbody></table>
      ${p.group?`<table class="rt" style="margin-top:.6rem"><thead><tr><th>الطالب</th><th>الأنشطة قبل</th><th>الأنشطة بعد</th><th>الاختبارات قبل</th><th>الاختبارات بعد</th><th>الحكم</th></tr></thead><tbody>
        ${(p.members||[]).map(m=>`<tr><td style="text-align:start">${planEsc(m.name)}</td><td>${pct(m.before)}</td><td>${pct(m.after)}</td><td>${pct(m.exam&&m.exam.before)}</td><td>${pct(m.exam&&m.exam.after)}</td><td>${planEsc(m.verdict||'—')}</td></tr>`).join('')}
      </tbody></table><div class="plan-note">تحسّن ${p.improved||0} · تراجع ${p.declined||0} · لم يُقَس ${p.unmeasured||0}</div>`:''}
      ${p.confidence||p.peers?`<table class="rt" style="margin-top:.6rem"><tbody>
        ${p.confidence?`<tr><td style="width:150px"><b>دلالة الفرق</b></td><td style="text-align:start">${planEsc(p.confidence.label)} — الفرق الحقيقي بثقة 95% بين ${planSigned(p.confidence.lo)} و${planSigned(p.confidence.hi)} نقطة (${p.confidence.nBefore} ${planEsc(p.mainUnit||'سؤالًا')} قبل، ${p.confidence.nAfter} بعد)</td></tr>`:''}
        ${p.peers?`<tr><td><b>المقارنة بالفصل</b></td><td style="text-align:start">${planEsc(planPeerText(p))}</td></tr>`:''}
        ${planBaseText(p)?`<tr><td><b>فترة خط الأساس</b></td><td style="text-align:start">${planEsc(planBaseText(p))}</td></tr>`:''}
      </tbody></table>`:''}
      ${p.caution?`<div class="plan-warn">⚠️ ${planEsc(p.caution)}</div>`:''}
      ${ex&&ex.undated?`<div class="plan-note">📅 ${ex.undated} ${ex.undated===1?'اختبار بلا تاريخ لم يُحتسب':'اختبارات بلا تاريخ لم تُحتسب'} في المقارنة (لا يُعرف أكان قبل الخطة أم بعدها).</div>`:''}
      <div class="plan-note"><b>منهجية القياس:</b> النسب من إجابات الطالب الفعلية المسجّلة آليًا لا من التقدير. خط الأساس آخر 30 يومًا قبل الخطة (أو كل ما قبلها إن قلّ عن 10 أسئلة).
        في المهارات المستهدفة يُحتسب بعد البدء كل سؤال جديد على المهارة: الأنشطة العادية والأسئلة البديلة في المهمة العلاجية (صياغة جديدة موازية)، أما السؤال الأصلي المعاد بخيارات مرتبة من جديد فلا يُحتسب لأنه يقيس التذكّر لا الفهم. ${p.basis==='skills'?'القياس على أسئلة المهارات المستهدفة وحدها. ':''}
        يُحكم بالتحسّن عند فرق 5 نقاط فأكثر، ويُبيَّن هل الفرق أكبر من هامش الصدفة لعدد الأسئلة، ويُقارَن بتغيّر زملائه في الفصل خلال الفترة نفسها.
        ${p.mainBy&&p.mainBy!=='academic'?`الحكم على هذه الخطة بمؤشر «${planEsc(p.measureLabel)}» لأنه سبب إنشائها، وبقية العناصر أدلة مساندة. `:''}الواجبات والمشاركة والحضور والسلوك من سجلات المعلم اليومية؛ الغياب بعذر والواجب «معذور» لا يُحسبان على الطالب.</div></div>
      ${(()=>{const tl=planTimelineHTML(p);return tl?`<div class="rep-sec">مسار الخطة — المقارنة قبل وبعد لكل مهارة، وما تغيّر بعد كل خطوة</div><div class="rep-box">${tl}</div>`:''})()}
      ${(()=>{const nf=typeof planNafsHTML==='function'?planNafsHTML(p):'';return nf?`<div class="rep-sec">🧭 نواتج تعلم نافس المستهدفة — قبل الخطة وبعدها</div><div class="rep-box">${nf}</div>`:''})()}
      ${p.group?'':`<div class="rep-sec">رابعًا: سياق التنفيذ خلال الخطة</div>
      <div class="rep-box"><table class="rt"><thead><tr><th>نسبة الحضور</th><th>أيام الغياب</th><th>واجبات مُسلّمة</th><th>واجبات غير مُسلّمة</th><th>أنشطة بعد البدء</th></tr></thead><tbody>
        <tr><td>${c.attendanceRate!=null?c.attendanceRate+'%':'—'}</td><td>${c.missedDays||0}</td><td>${c.hwDone||0}</td><td>${c.hwMissed||0}</td><td>${((p.academic?p.academic.after:p.after)||{}).acts||0}</td></tr></tbody></table></div>`}
      ${Array.isArray(p.history)&&p.history.length?`<div class="rep-sec">سجل القرارات بعد انتهاء المدة</div><div class="rep-box"><table class="rt"><thead><tr><th>التاريخ</th><th>الجولة</th><th>الأثر وقتها</th><th>القرار</th></tr></thead><tbody>
        ${p.history.map(x=>`<tr><td>${planEsc(String(x.at||'').replace(/-/g,'/'))}</td><td>${x.round||1}</td><td>${planEsc(x.verdict||'—')}${x.gain!=null?` (${x.gain>0?'+':''}${x.gain})`:''}</td><td style="text-align:start">${planEsc(x.label||'')}</td></tr>`).join('')}</tbody></table></div>`:''}
      ${p.notes?`<div class="rep-sec">${p.group?'رابعًا':'خامسًا'}: ملاحظات المعلم</div><div class="rep-box plan-txt">${planEsc(p.notes)}</div>`:''}
      <div class="plan-sign">
        <div>معلم المادة<b>${esc(rcGet('teacher')||'')}</b><span>التوقيع: ....................</span></div>
        <div>المرشد الطلابي<b>${esc(rcGet('counselor')||'')||'&nbsp;'}</b><span>التوقيع: ....................</span></div>
        <div>مدير المدرسة<b>${esc(rcGet('principal')||'')}</b><span>التوقيع: ....................</span></div>
      </div>
    </div></div>`;
  };
  box.innerHTML=rows.map(page).join('');
  unifiedA4Print({bodyClass:'printing-plans',title:'الخطط العلاجية',selector:'#plan-print',orientation:'portrait',margin:'8mm'});
}
function compMobOfficial(id){ const t=document.getElementById(id||'comp-table'); if(!t) return; t.classList.toggle('cm-official');
  const m=t.querySelector('.comp-mob'); if(m) m.classList.toggle('cm-hide',t.classList.contains('cm-official'));
  const b=t.querySelector('.cm-offbar button'); if(b) b.textContent=t.classList.contains('cm-official')?'📱 العرض المختصر':'🖨️ الكشف الرسمي'; }
function compMobOpen(i){
  const r=COMP_MOB[i]; if(!r) return; document.getElementById('cm-sheet')?.remove();
  const row=(l,v,n)=>`<div class="cm-row"><span>${l}</span><div><b>${v}</b>${n?`<small>${n}</small>`:''}</div></div>`;
  const f=(v,m)=>v==null?'<span class="cm-warn">لم يُرصد بعد</span>':`${Math.round(v*10)/10}/${m}`;
  const v=document.createElement('div'); v.id='cm-sheet'; v.className='cm-veil'; v.onclick=e=>{ if(e.target===v) v.remove(); };
  v.innerHTML=`<div class="cm-sheet" role="dialog" aria-label="تفاصيل ${esc(r.name)}"><div class="cm-grab"></div>
    <div class="cm-sh"><div><b>${esc(r.name)}</b><small>${esc(r.cls)}</small></div><div class="cm-big ${COMP_MOB_LV[r.level]||''}"><b>${Math.round(r.total*10)/10}</b><small>من 60 · ${esc(r.level)}</small></div></div>
    ${row('المشاركة',f(r.p,10),r.np)}${row('الواجب',f(r.h,10),r.nh)}${row('السلوك',f(r.b,10),r.nb)}${row('الأنشطة والمهام',f(r.a,10),r.na)}${row('الاختبار',f(r.ex,20),'')}
    ${r.unrec.length?`<div class="cm-note">⚠️ مجموع مؤقت — لم يُرصد: ${esc(r.unrec.join('، '))}</div>`:''}
    <button type="button" class="btn ghost" style="width:100%;margin-top:.7rem" onclick="document.getElementById('cm-sheet').remove()">إغلاق</button></div>`;
  document.body.appendChild(v);
}
const WK_DAYS = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
async function wkAutoSet(on){
  const cb=document.getElementById('wkauto-on'), api=getApi(), tok=getTok();
  try{
    const r=await fetch(api.replace(/\/+$/,'')+'/weekly-auto',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:tok,on:!!on})});
    const j=await r.json(); if(!j.ok) throw 0;
    cb.checked=!!j.on; wkAutoLast(j);
    toast(j.on?'✓ سيصل الطلابَ تقريرُ أسبوعهم كل أحد صباحًا':'أُوقف الإرسال التلقائي', 'good');
  }catch(e){ cb.checked=!on; toast('تعذّر الحفظ — تحقق من الاتصال','bad'); }
}
function wkMobOpen(i){
  const x=WK_MOB[i]; if(!x) return; document.getElementById('cm-sheet')?.remove();
  const row=(l,v,nt)=>`<div class="cm-row"><span>${l}</span><div><b>${v}</b>${nt?`<small>${nt}</small>`:''}</div></div>`;
  const dn=d=>{ try{ return new Date(d+'T12:00:00').toLocaleDateString('ar-SA-u-ca-gregory',{weekday:'long'}); }catch(e){ return d; } };
  const v=document.createElement('div'); v.id='cm-sheet'; v.className='cm-veil'; v.onclick=e=>{ if(e.target===v) v.remove(); };
  v.innerHTML=`<div class="cm-sheet" role="dialog" aria-label="تفاصيل ${esc(x.s.name||'')}"><div class="cm-grab"></div>
    <div class="cm-sh"><div><b>${esc(x.s.name||'')}</b><small>${esc(String(x.s.cls||x.s.className||x.s.class||''))} · هذا الأسبوع</small></div><div class="cm-big"><b>${x.nothing?'—':x.flag?'🚩':'✅'}</b><small>${x.nothing?'لم يُرصد':x.flag?'يحتاج انتباهًا':'لا ملاحظات'}</small></div></div>
    ${row('المشاركة',`شارك ${x.shared} · لم يشارك ${x.missed}`,x.missed>=2?'⚠️ لم يشارك مرتين فأكثر':'')}
    ${row('الحضور',x.absent?`غائب ${x.absent}`:'لا غياب','')}
    ${row('الواجب',`أنجز ${x.done} · لم ينجز ${x.undone}${x.excused?` · معذور ${x.excused}`:''}`,x.undone>=2?'⚠️ لم ينجز مرتين فأكثر':'')}
    ${row('السلوك',(x.bh.pos||x.bh.neg)?`🟢 ${x.bh.pos} · 🔴 ${x.bh.neg}`:'لا ملاحظات',(x.bh.labels||[]).map(([d,l,pos])=>`${pos?'🟢':'🔴'} ${esc(l)} — ${esc(dn(d))}`).join('<br>'))}
    <button type="button" class="btn ghost" style="width:100%;margin-top:.7rem" onclick="document.getElementById('cm-sheet').remove()">إغلاق</button></div>`;
  document.body.appendChild(v);
}

function printWeekly(){
  unifiedA4Print({
    bodyClass:'printing-weekly',
    title:'الكشف الأسبوعي',
    selector:'#wk-table',
    orientation:'landscape',
    margin:'7mm'
  });
}
function setCaMode(m){
  const value = m === 'brief' ? 'brief' : 'full';
  localStorage.setItem(K_CAMODE, value);
  syncCaModeButtons(value);
  renderCompAnalysis();
}

/* 🖨️ تحليل الأنشطة كان يطبع بـ window.print() مباشرة: تبقى قشرة التطبيق
   في تدفّق الطباعة فيرث التقرير عرض الشاشة ويُقصّ من الجانبين. نعزله كما
   تُعزل بقية التقارير: نُخفي كل شيء ونُثبّت جسم التقرير على الورقة. */
function printAnalysisReport(){
  clearReportZoom();          // الورقة بالمقاس الكامل دائمًا
  const box=document.getElementById('an-body');
  if(!box||!box.innerHTML.trim()){ toast('لا توجد بيانات للطباعة','bad'); return; }
  ensureLogo();
  const old=document.title; document.title='تحليل نتائج الأنشطة';
  document.body.classList.add('printing-analysis');
  const done=()=>{document.body.classList.remove('printing-analysis');document.title=old;window.removeEventListener('afterprint',done)};
  window.addEventListener('afterprint',done);
  setTimeout(()=>printThen(done),150);
}

function printCompAnalysis(){
  clearReportZoom();          // الورقة بالمقاس الكامل دائمًا
  const box=document.getElementById('ca-body');
  if(!box||!box.innerHTML.trim()){ toast('لا توجد بيانات للطباعة','bad'); return; }
  ensureLogo();
  const old=document.title; document.title='تحليل الكشف الشامل';
  document.body.classList.add('printing-compan');
  const done=()=>{document.body.classList.remove('printing-compan');document.title=old;window.removeEventListener('afterprint',done)};
  window.addEventListener('afterprint',done);
  setTimeout(()=>printThen(done),150);
}

function clearExamHeaderSaved(){
  try{ localStorage.removeItem(K_EXAM_HEADER); }catch(e){}
  toast('تم مسح بيانات الترويسة المحفوظة','good');
}

function examSourceChanged(){
  const src = document.getElementById('ex-src')?.value || 'hw';
  const hw = document.getElementById('ex-hw-wrap'), js = document.getElementById('ex-json-wrap');
  const ai = document.getElementById('ex-ai-wrap');
  const hwBank=document.getElementById('ex-hw-bank'), jsonBank=document.getElementById('ex-json-bank');

  if(hw) hw.style.display = src==='hw' ? '' : 'none';
  if(js) js.style.display = src==='json' ? '' : 'none';
  if(ai) ai.style.display = src==='ai' ? '' : 'none';

  if(hwBank){
    hwBank.style.display = src==='hw' && examHwIds().length ? '' : 'none';
    if(src==='hw') renderExamHwBank();
  }
  if(jsonBank){
    jsonBank.style.display = (src==='json' || src==='ai') ? '' : 'none';
    if(src==='json' || src==='ai') renderExamJsonBank();
  }

  // تحديث حالة مصدر الذكاء دون خلطه مع بنك JSON المستورد.
  if(src==='ai'){
    const all=examJsonBankAll();
    const selected=all.filter(x=>x.selected!==false).length;
    const count=document.getElementById('ex-ai-count');
    const status=document.getElementById('ex-ai-status');
    if(count) count.textContent = all.length ? `${selected} محدد من ${all.length}` : 'لم يتم التوليد';
    if(status) status.textContent = all.length
      ? `تم توليد ${all.length} سؤالًا. حدّد الفقرات التي تريدها في الاختبار من البنك أدناه.`
      : 'لم يتم توليد أسئلة بعد. استخدم الزر أعلاه لفتح المولد.';
  }

  examBuild();
}
function examBankViewSet(bank, v){ const el = document.getElementById(bank === 'hw' ? 'ex-hw-bank-view' : 'ex-bank-view'); if(el) el.value = v; if(bank === 'hw') renderExamHwBank(); else renderExamJsonBank(); }
function examBankShowModel(bank, m){
  const v = document.getElementById(bank === 'hw' ? 'ex-hw-bank-view' : 'ex-bank-view'); if(!v) return;
  const val = 'm' + m; v.value = [...v.options].some(o => o.value === val) ? (v.value === val ? 'all' : val) : 'all';   // ضغطة ثانية: عودة لكل البنك
  if(bank === 'hw') renderExamHwBank(); else renderExamJsonBank();
}
function toggleExamHwQuestion(index, checked){
  const all=examHwBankAll();
  if(all[index]) all[index].selected=!!checked;
  renderExamHwBank();
  examBuild();
}
function examHwBankSelectAll(value){
  const q=(document.getElementById('ex-hw-bank-search')?.value||'').trim().toLowerCase();
  const f=document.getElementById('ex-hw-bank-filter')?.value||'all';
  examHwBankAll().forEach(x=>{
    const type=x.kind==='tf'?'tf':'mc', txt=String(x.q||'').toLowerCase();
    if((f==='all'||f===type)&&(!q||txt.includes(q))) x.selected=!!value;
  });
  renderExamHwBank(); examBuild();
}
function toggleExamJsonQuestion(index, checked){
  const all=examJsonBankAll();
  if(all[index]) all[index].selected=!!checked;
  renderExamJsonBank();
  examBuild();
}
function examBankSelectAll(value){
  const q=(document.getElementById('ex-bank-search')?.value||'').trim().toLowerCase();
  const f=document.getElementById('ex-bank-filter')?.value||'all';
  examJsonBankAll().forEach(x=>{
    const type=x.kind==='tf'?'tf':'mc', txt=String(x.q||'').toLowerCase();
    if((f==='all'||f===type)&&(!q||txt.includes(q))) x.selected=!!value;
  });
  renderExamJsonBank(); examBuild();
}
function exportExamAIBank(){
  const mc=(EXAM_JSON_BANK.mc||[]);
  const tf=(EXAM_JSON_BANK.tf||[]);
  if(!mc.length&&!tf.length){
    toast('ولّد الأسئلة أولًا ثم احفظ بنك الأسئلة.','bad');
    return;
  }

  // حفظ بنك مولد الذكاء بصيغة يمكن استيرادها لاحقًا من مصدر «ملف JSON».
  const quiz=mc.map(q=>({q:examJsonText(q.q),opts:(q.o||[]).map(examJsonText),answer:examJsonText(q.o?.[q.a] ?? q.a)}));
  const truefalse=tf.map(q=>({q:toArabicIndicDigits(q.q),answer:!!q.a}));
  // الصفحة الثانية كما هي الآن في الحقول (بعد أي تعديل يدوي)، فيعود كل شيء عند استيراد الملف
  const val=id=>document.getElementById(id)?.value||'';
  const fillblank=examParseFill(val('ex-fill-txt')).map(x=>({q:x.q,answer:x.a}));
  const mp=examParseMatch(val('ex-match-txt')).pairs.map(x=>[x.a,x.b]);
  const essay=examLines(val('ex-open-txt')).map(q=>({q}));
  const payload={
    quiz,
    truefalse,
    ...(fillblank.length?{fillblank}:{}),
    ...(mp.length?{match:[{pairs:mp}]}:{}),
    ...(essay.length?{essay}:{}),
    meta:{
      source:'مولد الأسئلة بالذكاء',
      label:EXAM_JSON_BANK.label||'بنك أسئلة مولد الذكاء',
      exportedAt:new Date().toISOString(),
      version:1
    }
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='بنك-أسئلة-مولد-الذكاء.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast(`تم حفظ ${mc.length+tf.length} سؤالًا في ملف JSON`,'good');
}

function exportExamJson(selectedOnly){
  const bank=selectedOnly?examJsonSelected():{mc:EXAM_JSON_BANK.mc||[],tf:EXAM_JSON_BANK.tf||[]};
  const quiz=bank.mc.map(q=>({q:examJsonText(q.q),opts:q.o.map(examJsonText),answer:examJsonText(q.o[q.a]??q.a)}));
  const truefalse=bank.tf.map(q=>({q:q.q,answer:!!q.a}));
  // أكمل الفراغ والتوصيل كما هما في حقول الاختبار (الصفحة الثانية) — كانت لا تُصدَّر فتضيع عند الاستيراد للأنشطة
  const val=id=>document.getElementById(id)?.value||'';
  const fillblank=examParseFill(val('ex-fill-txt')).filter(x=>x.a).map(x=>({q:examJsonText(x.q),answer:examJsonText(x.a)}));
  const mp=examParseMatch(val('ex-match-txt')).pairs.map(x=>[examJsonText(x.a),examJsonText(x.b)]);
  if(!quiz.length&&!truefalse.length&&!fillblank.length&&!mp.length){toast('لا توجد أسئلة للتصدير','bad');return;}
  const payload={quiz,truefalse,...(fillblank.length?{fillblank}:{}),...(mp.length?{match:[{pairs:mp}]}:{}),meta:{source:EXAM_JSON_BANK.label||'أسئلة الاختبار',exportedAt:new Date().toISOString()}};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=(selectedOnly?'الأسئلة-المحددة':'بنك-الأسئلة')+'.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast(`تم تصدير ${quiz.length+truefalse.length+fillblank.length} سؤال${mp.length?` و${mp.length} زوج توصيل`:''}`,'good');
}

/* يقبل صيغة مولّد الكليشة {quiz,truefalse} وصيغة تصدير المنصة {questions:[{t}]} */
function examNormalizeSource(raw){
  const mc = [], tf = [];
  const pushMc = (q, opts, ans) => {
    const o = (Array.isArray(opts)?opts:[]).map(x=>String(x??'').trim()).filter(Boolean).slice(0,4);
    const text = String(q??'').trim();
    if(!text || o.length < 2) return;
    // النص أولًا: إجابة مثل "6" نصٌّ لا فهرس، وكان يُقرأ رقمًا فتُقلب الإجابة
    const raw = String(ans ?? '').trim();
    let a = o.findIndex(x => x === raw);
    if(a < 0){
      const n = typeof ans === 'number' ? ans : (raw !== '' && /^\d+$/.test(raw) ? Number(raw) : NaN);
      a = Number.isInteger(n) ? n : 0;
    }
    if(a < 0 || a >= o.length) a = 0;
    mc.push({ q:text, o, a });
  };
  const pushTf = (q, ans) => {
    const text = String(q??'').trim();
    if(!text) return;
    tf.push({ q:text, a: ans === true || ans === 'true' || ans === 1 || ans === '1' || ans === 'صح' });
  };

  (Array.isArray(raw?.quiz) ? raw.quiz : []).forEach(x => pushMc(x.q ?? x.question, x.opts ?? x.options ?? x.o, x.a ?? x.answer));
  (Array.isArray(raw?.truefalse) ? raw.truefalse : []).forEach(x => pushTf(x.q ?? x.question, x.a ?? x.answer));
  (Array.isArray(raw?.questions) ? raw.questions : []).forEach(x => {
    const t = String(x?.t || x?.type || '').toLowerCase();
    if(t==='q' || t==='quiz' || t==='mcq') pushMc(x.q, x.o ?? x.opts ?? x.options, x.a ?? x.answer);
    else if(t==='tf' || t==='truefalse') pushTf(x.q, x.a ?? x.answer);
  });
  if(Array.isArray(raw)) raw.forEach(x => {
    const t = String(x?.t || x?.type || '').toLowerCase();
    if(t==='tf' || t==='truefalse') pushTf(x.q, x.a ?? x.answer);
    else pushMc(x.q ?? x.question, x.o ?? x.opts ?? x.options, x.a ?? x.answer);
  });
  return { mc, tf };
}

/* 📚 بنك JSON من ملف أو أكثر: «اختر» يستبدل البنك، و«دمج» يضيف إليه.
   المكرر (نفس نص السؤال بعد تطبيع الحروف) يُحذف، ويبقى ما حددته أو ثبّتّه لنموذج. */
function examReadFile(f){ return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result || '')); r.onerror = () => rej(r.error); r.readAsText(f, 'utf-8'); }); }
function examQKey(q){ return (q.kind === 'tf' ? 'tf' : 'mc') + '|' + rdNormAr(q.q); }
/* يدمج الوصل/الفراغ/«أجب» مع ما في الحقول (بلا تكرار) أو يستبدلها */
function examMergeExtras(list, append){
  const cur = id => append ? examLines(document.getElementById(id)?.value || '') : [];
  const merge = (id, key) => { const out = cur(id), seen = new Set(out.map(rdNormAr)); list.forEach(ex => (ex[key] || []).forEach(l => { const k = rdNormAr(l); if(!seen.has(k)){ seen.add(k); out.push(l); } })); return out; };
  const ex = { match:merge('ex-match-txt','match'), fill:merge('ex-fill-txt','fill'), open:merge('ex-open-txt','open') };
  if(ex.match.length || ex.fill.length || ex.open.length) examApplyExtras(ex, true);
  return ex;
}
async function examLoadJson(ev, append){
  const files = [...(ev.target.files || [])];
  ev.target.value = '';
  if(!files.length) return;
  const base = append && (EXAM_JSON_BANK.mc.length || EXAM_JSON_BANK.tf.length || (EXAM_JSON_BANK.raws||[]).length)
    ? { mc:EXAM_JSON_BANK.mc.slice(), tf:EXAM_JSON_BANK.tf.slice(), raws:(EXAM_JSON_BANK.raws || (EXAM_JSON_BANK.raw ? [{ name:EXAM_JSON_BANK.label || 'ملف', raw:EXAM_JSON_BANK.raw }] : [])).slice(), files:(EXAM_JSON_BANK.files || [EXAM_JSON_BANK.label]).filter(Boolean) }
    : { mc:[], tf:[], raws:[], files:[] };
  const seen = new Set([...base.mc, ...base.tf].map(examQKey));
  let addMc = 0, addTf = 0, dup = 0; const bad = [], exList = [];
  for(const f of files){
    try{
      const raw = JSON.parse(await examReadFile(f));
      const { mc, tf } = examNormalizeSource(raw);
      let ex = { match:[], fill:[], open:[] }; try{ ex = examExtrasFromRaw(raw); }catch(e){}
      if(!mc.length && !tf.length && !ex.match.length && !ex.fill.length && !ex.open.length) throw new Error('لا أسئلة صالحة');
      mc.forEach(q => { q.kind = 'mc'; q.selected = true; q.src = f.name; const k = examQKey(q); if(seen.has(k)){ dup++; return; } seen.add(k); base.mc.push(q); addMc++; });
      tf.forEach(q => { q.kind = 'tf'; q.selected = true; q.src = f.name; const k = examQKey(q); if(seen.has(k)){ dup++; return; } seen.add(k); base.tf.push(q); addTf++; });
      exList.push(ex); base.raws.push({ name:f.name, raw }); if(!base.files.includes(f.name)) base.files.push(f.name);
    }catch(e){ console.error('examLoadJson:', f.name, e); bad.push(f.name); }
  }
  if(!base.mc.length && !base.tf.length && !exList.length){ toast(bad.length ? `تعذّر قراءة: ${bad.join('، ')}` : 'لم أجد أسئلة في الملفات', 'bad'); return; }
  base.mc.forEach((q, i) => { q.id = `mc-${i}`; }); base.tf.forEach((q, i) => { q.id = `tf-${i}`; });
  const label = base.files.join(' + ');
  EXAM_JSON_BANK = { mc:base.mc, tf:base.tf, label, raw:null, raws:base.raws, files:base.files, multi:base.files.length > 1 };
  EXAM_SRC = { mc:base.mc.slice(), tf:base.tf.slice(), label };
  const X = examMergeExtras(exList, append);
  const use = document.getElementById('ex-use-selected'); if(use) use.checked = true;
  renderExamJsonBank();
  const t = document.getElementById('ex-title'); if(t && !t.value.trim()) t.value = 'اختبار قصير';
  examBuild(true);
  toast(`${append ? 'دُمج' : 'حُمّل'} ${files.length - bad.length} ملف: +${addMc} اختيار و+${addTf} صح/خطأ`
    + (dup ? ` · تُجوهل ${dup} مكرر` : '') + (bad.length ? ` · تعذّر: ${bad.join('، ')}` : '')
    + ` · البنك الآن ${base.mc.length} اختيار و${base.tf.length} صح/خطأ` + ((X.match.length || X.fill.length || X.open.length) ? ` + ${X.match.length} وصل و${X.fill.length} فراغ و${X.open.length} «أجب»` : ''), bad.length ? 'bad' : 'good');
}
/* إزالة ملف من البنك المدمج (أسئلته فقط؛ أسطر الحقول النصية تبقى) */
function examJsonRemoveFile(name){
  const keep = q => q.src !== name;
  EXAM_JSON_BANK.mc = EXAM_JSON_BANK.mc.filter(keep); EXAM_JSON_BANK.tf = EXAM_JSON_BANK.tf.filter(keep);
  EXAM_JSON_BANK.raws = (EXAM_JSON_BANK.raws || []).filter(r => r.name !== name);
  EXAM_JSON_BANK.files = (EXAM_JSON_BANK.files || []).filter(f => f !== name);
  EXAM_JSON_BANK.multi = EXAM_JSON_BANK.files.length > 1; EXAM_JSON_BANK.label = EXAM_JSON_BANK.files.join(' + ');
  EXAM_SRC = { mc:EXAM_JSON_BANK.mc.slice(), tf:EXAM_JSON_BANK.tf.slice(), label:EXAM_JSON_BANK.label };
  renderExamJsonBank(); examBuild(true); toast(`أُزيلت أسئلة «${name}» من البنك`);
}
function examJsonExtras(){
  const rs = EXAM_JSON_BANK.raws;
  if(Array.isArray(rs) && rs.length){
    const out = { fill:[], match:[], open:[] };
    rs.forEach(r => { try{ const e = examExtrasFromRaw(r.raw); ['fill','match','open'].forEach(k => out[k].push(...e[k])); }catch(_){} });
    return out;
  }
  return examExtrasFromRaw(EXAM_JSON_BANK.raw);
}
function examHwSet(ids){
  const el = document.getElementById('ex-hw'); if(el) el.value = ids.join(',');
  try{ examAutoExtras(); }catch(e){}
  examHwRenderPick(); syncExamHwBank(); examBuild();
}
function examHwToggle(id, on){
  const ids = examHwIds().filter(x => x !== String(id));
  if(on) ids.push(String(id));
  examHwSet(ids);
}
/* 💾 أسئلة الأنشطة المحددة كملف JSON بصيغة تصدير الأنشطة نفسها: يُستورد مباشرة في نشاط جديد بـ«📥 استيراد JSON»
   (نشاط مراجعة). الاختيار والصح/خطأ: المحدد في البنك فقط. الفراغ والتوصيل والترتيب والكلمات: كلها. والمكرر يدخل مرة */
function examHwExportJson(){
  const acts = examHwActs(); if(!acts.length){ toast('اختر نشاطًا أو أكثر أولًا','bad'); return; }
  const pick = new Map(examHwBankAll().map(x => [x.key, x.selected !== false]));
  const seen = new Set(), qs = []; let dup = 0;
  const N = v => rdNormAr(String(v ?? ''));
  const keyOf = q => q.t === 'q' ? 'mc|' + N(q.q) + '|' + q.o.map(N).sort().join('|')
    : q.t === 'tf' ? 'tf|' + N(q.q) : q.t === 'f' ? 'f|' + N(q.q) : q.t === 'a' ? 'a|' + N(q.w)
    : q.t === 's' ? 's|' + N(q.s) : q.t === 'm' ? 'm|' + q.p.map(p => N(p[0]) + '=' + N(p[1])).sort().join('|') : '';
  acts.forEach(h => (h.qs || []).forEach((q, i) => {
    if(!q || !['q','tf','f','a','s','m'].includes(q.t)) return;
    if(q.t === 'q' || q.t === 'tf'){ const k = String(h.id) + '|' + i; if(pick.has(k) && !pick.get(k)) return;
      const e = EXAM_HW_EDITS.get(k); if(e) q = { ...q, q:e.q, ...(e.o ? { o:e.o } : {}), a:q.t === 'tf' ? e.a === true : e.a }; }   // ✏️ بتعديل المعلم
    let x;
    if(q.t === 'q'){ const o = (q.o || []).map(v => String(v || '')).filter(Boolean).slice(0, 4); if(!q.q || o.length < 2) return; const a = Number(q.a) || 0; x = { t:'q', q:String(q.q), o, a: a >= 0 && a < o.length ? a : 0 }; }
    else if(q.t === 'tf'){ if(!q.q) return; x = { t:'tf', q:String(q.q), a:q.a === true }; }
    else if(q.t === 'f'){ if(!q.q || q.a == null) return; x = { t:'f', q:String(q.q), a:String(q.a) }; }
    else if(q.t === 'a'){ if(!q.w) return; x = { t:'a', w:String(q.w), h:String(q.h || '') }; }
    else if(q.t === 's'){ if(!q.s) return; x = { t:'s', s:String(q.s) }; }
    else { const p = (q.p || []).map((v, k) => [v, k]).filter(([v, k]) => Array.isArray(v) && v[0] && v[1] && !EXAM_HW_MPOFF.has(String(h.id) + '|' + i + '|' + k)).map(([v]) => [String(v[0]), String(v[1])]); if(p.length < 2) return; x = { t:'m', p }; }
    const k = keyOf(x); if(seen.has(k)){ dup++; return; } seen.add(k); qs.push(x);
  }));
  if(!qs.length){ toast('لا توجد أسئلة محددة للحفظ','bad'); return; }
  const title = 'مراجعة: ' + acts.map(h => h.title || 'نشاط').join(' + ');
  const payload = { app:'activity-book', version:3, exportedAt:new Date().toISOString(), title, kind:'normal', points:0, max:qs.length, questions:qs, game:null, meta:{ review:true, from:acts.map(h => h.title || 'نشاط') } };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = (title.replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 80) || 'مراجعة') + '.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`💾 حُفظ ${qs.length} سؤال من ${acts.length} ${acts.length === 1 ? 'نشاط' : 'أنشطة'}${dup ? ` · 🔁 ${dup} مكرر لم يُضف` : ''} — للنشر: نشاط جديد ← 📥 استيراد JSON`, 'good');
}
function examHwSimOpen(){
  const G = examHwSimGroups(); window._exSimG = G;
  if(!G.length){ window._exSimPend = null; toast('لا توجد أسئلة متشابهة بين الأنشطة المحددة 👍', 'good'); return; }
  const KL = { mc:'اختيار', tf:'صح/خطأ', mp:'وصل' };
  const row = (x, gi, i) => `<label class="exsim-row ${x.on ? '' : 'off'}"><input type="checkbox" ${x.on ? 'checked' : ''} data-g="${gi}" data-i="${i}" onchange="this.closest('.exsim-row').classList.toggle('off',!this.checked)">
      <span class="exsim-t"><span class="exsim-tags"><b class="exsim-k ${x.kind}">${KL[x.kind]}</b><small>📚 ${esc(x.src)}</small>${x.edited ? '<small class="exq-tag2">✏️ معدّل</small>' : ''}</span>
      ${x.kind === 'mp' ? `${escExamText(x.q)} <b class="exsim-ar">⟵</b> ${escExamText(x.ans)}` : escExamText(x.q)}${x.kind !== 'mp' ? `<button type="button" class="exq-ed" onclick="event.preventDefault();event.stopPropagation();examSimEdit(${gi},${i})">✏️ تعديل</button>` : ''}
      ${x.kind === 'mc' ? `<span class="exsim-ans">✓ ${escExamText(x.ans)}</span>` : x.kind === 'tf' ? `<span class="exsim-ans ${x.tf ? '' : 'no'}">${x.tf ? '✓ صح' : '✗ خطأ'}</span>` : ''}</span></label>`;
  const n = G.reduce((t, g) => t + g.length, 0);
  openModal(`<h2>🔁 الأسئلة المتشابهة</h2>
    <p class="muted" style="margin:.2rem 0 .7rem;font-size:.86rem">${G.length} ${G.length === 1 ? 'مجموعة' : 'مجموعات'} (${n} سؤالًا) تسأل عن الفكرة نفسها بصيغة أخرى أو بنوع آخر. أبقِ ✓ على ما تريده واترك الباقي — المستبعد لا يدخل الاختبار ولا ملف JSON.</p>
    <div class="row" style="gap:.4rem;flex-wrap:wrap;margin-bottom:.6rem"><button type="button" class="btn ghost sm" onclick="examHwSimQuick('first')">أبقِ الأول من كل مجموعة</button><button type="button" class="btn ghost sm" onclick="examHwSimQuick('all')">أبقِ الكل</button></div>
    <div class="exsim-list">${G.map((g, gi) => `<div class="exsim-g"><div class="exsim-gh">مجموعة ${gi + 1} <small>· تشابه ${Math.round(Math.max(...g.map(x => x.sc)) * 100)}٪</small></div>${g.map((x, i) => row(x, gi, i)).join('')}</div>`).join('')}</div>
    <div class="row" style="gap:.5rem;margin-top:.8rem"><button type="button" class="btn primary" onclick="examHwSimApply()">✓ تطبيق</button><button type="button" class="btn ghost" onclick="closeModal()">إلغاء</button></div>`);
  const P = window._exSimPend; window._exSimPend = null;                 // اختيارات لم تُطبَّق قبل فتح «تعديل»
  if(P) document.querySelectorAll('.exsim-list input[data-g]').forEach(c => { const x = (G[+c.dataset.g] || [])[+c.dataset.i]; if(x && x.key in P){ c.checked = P[x.key]; c.closest('.exsim-row').classList.toggle('off', !c.checked); } });
}
function examSimEdit(gi, i){
  const G = window._exSimG || [], x = (G[gi] || [])[i]; if(!x) return;
  const P = {}; document.querySelectorAll('.exsim-list input[data-g]').forEach(c => { const y = (G[+c.dataset.g] || [])[+c.dataset.i]; if(y) P[y.key] = c.checked; });
  window._exSimPend = P;
  const all = examHwBankAll(), idx = all.findIndex(b => b.key === x.key); if(idx < 0) return;
  examQEdit('hw', idx, 'sim');
}
/* 📏 الأسئلة الطويلة: تُقاس كما تُطبع فعلًا (كل النماذج، بالحجم الحقيقي) — سؤال في ٣ أسطر فأكثر، أو خيار يلتف لسطرين،
   أو عبارة صح/خطأ في سطرين. تُعرض مع السبب، والمعلم يقرر: يبقيه، أو يستبعده، أو يختصره هنا */
function examLongNorm(t){ return rdNormAr(examAr2En(String(t ?? ''))).replace(/[^\p{L}\p{N}]+/gu, ''); }
function examLongScan(bank){
  const items = examBankItems(bank).filter(x => x.selected !== false), byQ = new Map();
  items.forEach(x => { const k = (x.kind === 'tf' ? 'tf|' : 'mc|') + examLongNorm(x.q); if(!byQ.has(k)) byQ.set(k, x); });
  // عدد الأسطر الفعلي: مواضع أسطر النص نفسه (لا ارتفاع العنصر، فالحشو والمحاذاة لا تُحسب سطرًا)
  const lines = el => { if(!el || !el.textContent.trim()) return 0; const r = document.createRange(); r.selectNodeContents(el);
    const tops = [...r.getClientRects()].filter(b => b.width > 1).map(b => b.top).sort((a, b) => a - b), fs = parseFloat(getComputedStyle(el).fontSize) || 12;
    let n = 0, last = -1e9; tops.forEach(t => { if(t - last > fs * 0.6){ n++; last = t; } }); return n; };
  const keyEl = document.getElementById('ex-key'), sel = document.getElementById('ex-model'), pv = document.getElementById('exw-prev');
  const keep = { key: !!keyEl?.checked, model: sel ? sel.value : '0', z: pv ? pv.style.getPropertyValue('--exz') : '' };
  const found = new Map(), notes = new Set(), add = (x, why) => { if(!x) return; const f = found.get(x) || { x, why:new Set() }; f.why.add(why); found.set(x, f); };
  window._exzLock = true; if(pv) pv.style.setProperty('--exz', '1');
  try{
    if(keyEl) keyEl.checked = false;
    for(let m = 0; m < examModelCount(); m++){
      if(sel) sel.value = String(m);
      examBuild(true);
      const paper = document.getElementById('exam-paper'); if(window._exSample) break;
      paper.querySelectorAll('.exam-page[data-fit]').forEach(() => notes.add('fit'));
      if(paper.querySelector('.ex-sec.ex-cols')) notes.add('cols');
      paper.querySelectorAll('.ex-q').forEach(q => {
        const t = q.querySelector('.ex-qt span:last-child'), x = byQ.get('mc|' + examLongNorm(t && t.textContent));
        const n = lines(t); if(n >= 3) add(x, `السؤال في ${n} أسطر`);
        q.querySelectorAll('.ex-opt > span:last-child').forEach(o => { if(lines(o) >= 2) add(x, `خيار يلتف لسطرين: «${o.textContent.trim().slice(0, 40)}»`); });
      });
      paper.querySelectorAll('.ex-tf').forEach(q => {
        const t = [...q.children].find(c => c.tagName === 'SPAN' && !c.classList.contains('ex-num') && !c.classList.contains('ex-tf-c'));
        const x = byQ.get('tf|' + examLongNorm(t && t.textContent)), n = lines(t); if(n >= 2) add(x, n === 2 ? 'العبارة في سطرين' : `العبارة في ${n} أسطر`);
      });
    }
  } finally {
    window._exzLock = false; if(pv){ if(keep.z) pv.style.setProperty('--exz', keep.z); else pv.style.removeProperty('--exz'); }
    if(keyEl) keyEl.checked = keep.key; if(sel) sel.value = keep.model; examBuild(true);
  }
  return { list:[...found.values()].map(f => ({ x:f.x, why:[...f.why] })), notes };
}
function examLongOpen(bank){
  const R = examLongScan(bank); window._exLong = { bank, list:R.list };
  if(window._exSample){ toast('اختر الأسئلة أولًا', 'bad'); return; }
  const tip = [R.notes.has('cols') ? 'الورقة لم تتسع بعمود واحد فقُسّمت فقرات إلى عمودين' : '', R.notes.has('fit') ? 'وصُغّرت المسافات والخط لتتسع' : ''].filter(Boolean).join('، ');
  if(!R.list.length){ window._exLongPend = null; toast('لا توجد أسئلة طويلة تلتف في الورقة 👍' + (tip ? ' — ' + tip : ''), 'good'); return; }
  const row = (it, i) => { const x = it.x, mc = x.kind !== 'tf';
    return `<div class="exsim-row exlong-row" data-i="${i}">
      <span class="exsim-t"><span class="exsim-tags"><b class="exsim-k ${mc ? '' : 'tf'}">${mc ? 'اختيار' : 'صح/خطأ'}</b>${x.src ? `<small>📚 ${esc(x.src)}</small>` : ''}<small>· ${String(x.q || '').length} حرفًا</small></span>
        <span class="exlong-q">${escExamText(x.q)}</span>${mc ? `<span class="exlong-o">${(x.o || []).map((o, j) => `<span class="${j === x.a ? 'ok' : ''}">${escExamText(o)}</span>`).join('')}</span>` : ''}
        <span class="exlong-why">${it.why.map(w => `<i>${esc(w)}</i>`).join('')}</span>
        <span class="exlong-ed" hidden><textarea class="inp" rows="2" data-f="q">${esc(x.q)}</textarea>${mc ? (x.o || []).map((o, j) => `<input class="inp" data-f="o${j}" value="${esc(o)}" aria-label="الخيار ${j + 1}">`).join('') : ''}</span></span>
      <span class="exlong-act"><select class="inp" aria-label="الإجراء" onchange="examLongAct(this)"><option value="keep">أبقِه</option><option value="off">استبعده</option></select><button type="button" class="exq-ed" onclick="examLongEdit(${i})">✏️ تعديل</button></span></div>`; };
  openModal(`<h2>📏 الأسئلة الطويلة</h2>
    <p class="muted" style="margin:.2rem 0 .7rem;font-size:.86rem">${R.list.length} ${R.list.length === 1 ? 'سؤال يلتف' : 'أسئلة تلتف'} في الورقة كما تُطبع${examModelCount() > 1 ? ' (كل النماذج)' : ''}${tip ? ` — ${tip}` : ''}. لكلٍّ منها: أبقِه، أو استبعده، أو «✏️ تعديل» لاختصاره (يتغير في الاختبار فقط، لا في النشاط).</p>
    <div class="row" style="gap:.4rem;flex-wrap:wrap;margin-bottom:.6rem"><button type="button" class="btn ghost sm" onclick="examLongAll('off')">استبعد الكل</button><button type="button" class="btn ghost sm" onclick="examLongAll('keep')">أبقِ الكل</button></div>
    <div class="exsim-list">${R.list.map(row).join('')}</div>
    <div class="row" style="gap:.5rem;margin-top:.8rem"><button type="button" class="btn primary" onclick="examLongApply()">✓ تطبيق</button><button type="button" class="btn ghost" onclick="closeModal()">إلغاء</button></div>`);
  const P = window._exLongPend; window._exLongPend = null;
  if(P) document.querySelectorAll('.exlong-row').forEach(r => { const it = R.list[+r.dataset.i], v = it && P.get(it.x); if(v){ const s2 = r.querySelector('select'); s2.value = v; examLongAct(s2); } });
}
function examLongEdit(i){
  const L = window._exLong, it = L && L.list[i]; if(!it) return;
  const P = new Map(); document.querySelectorAll('.exlong-row').forEach(r => { const y = L.list[+r.dataset.i]; if(y) P.set(y.x, r.querySelector('select').value); });
  window._exLongPend = P;
  const idx = examBankItems(L.bank).indexOf(it.x); if(idx < 0) return;
  examQEdit(L.bank, idx, 'long');
}
function examLongAct(s){ const r = s.closest('.exlong-row'); r.classList.toggle('off', s.value === 'off'); r.querySelector('.exlong-ed').hidden = s.value !== 'edit'; if(s.value === 'edit') r.querySelector('.exlong-ed textarea').focus(); }
function examLongAll(v){ document.querySelectorAll('.exlong-row select').forEach(s => { s.value = v; examLongAct(s); }); }
function examLongApply(){
  const L = window._exLong; if(!L) return; let off = 0, ed = 0;
  document.querySelectorAll('.exlong-row').forEach(r => { const it = L.list[+r.dataset.i]; if(!it) return; const x = it.x, v = r.querySelector('select').value;
    if(v === 'off'){ x.selected = false; off++; return; }
    if(v === 'edit'){ const q = r.querySelector('[data-f=q]').value.trim(); if(!q) return;
      const o = x.kind !== 'tf' ? (x.o || []).map((ov, j) => (r.querySelector(`[data-f=o${j}]`)?.value || '').trim() || ov) : null;
      if(q !== x.q || (o && o.some((v2, j) => v2 !== x.o[j]))){ ed++; examQApplyEdit(x, { q, o, a:x.a }); if(L.bank === 'hw' && x.key) EXAM_HW_EDITS.set(x.key, { q, o, a:x.a }); } } });
  closeModal(); examBankRerender(L.bank);
  toast(off || ed ? `📏 ${[off ? `استُبعد ${off}` : '', ed ? `اختُصر ${ed}` : ''].filter(Boolean).join(' و')} — المعاينة تحدّثت` : 'لم يتغير شيء', 'good');
}
function examQEdit(bank, idx, back){
  const x = examBankItems(bank)[idx]; if(!x) return; const mc = x.kind !== 'tf';
  window._exQE = { bank, idx, back };
  openModal(`<h2>✏️ تعديل السؤال</h2>
    <p class="muted" style="margin:.2rem 0 .7rem;font-size:.84rem">يتغير في هذا الاختبار فقط — النشاط${bank === 'json' ? '/الملف' : ''} الأصلي يبقى كما هو.${x.edited ? ' <b>هذا السؤال معدّل من قبل.</b>' : ''}</p>
    <div class="field"><label>نص ${mc ? 'السؤال' : 'العبارة'}</label><textarea class="inp" id="exq-q" rows="3" style="font-family:inherit">${esc(x.q)}</textarea></div>
    ${mc ? `<div class="field"><label>الخيارات <span class="muted" style="font-weight:400">(● بجانب الإجابة الصحيحة · امسح نص خيار لحذفه)</span></label>
      <div class="exq-opts">${x.o.map((o, j) => `<label class="exq-opt"><input type="radio" name="exq-a" value="${j}" ${j === x.a ? 'checked' : ''} aria-label="الإجابة الصحيحة"><b>${['أ','ب','ج','د'][j]}</b><input class="inp" id="exq-o${j}" value="${esc(o)}"></label>`).join('')}</div></div>`
    : `<div class="field"><label>الإجابة الصحيحة</label><div class="row" style="gap:1rem"><label><input type="radio" name="exq-a" value="1" ${x.a ? 'checked' : ''}> صح</label><label><input type="radio" name="exq-a" value="0" ${x.a ? '' : 'checked'}> خطأ</label></div></div>`}
    <div class="row" style="gap:.5rem;flex-wrap:wrap;margin-top:.8rem">
      <button type="button" class="btn primary" onclick="examQSave()">💾 حفظ</button>
      <button type="button" class="btn ghost" onclick="examQOff()">${x.selected === false ? '↩️ أعِده للاختبار' : '🚫 استبعده من الاختبار'}</button>
      ${x.edited && x._orig ? '<button type="button" class="btn ghost" onclick="examQRevert()">↺ إرجاع الأصل</button>' : ''}
      <button type="button" class="btn ghost" onclick="examQBack()">${back ? '↩️ رجوع' : 'إلغاء'}</button></div>`);
  setTimeout(() => document.getElementById('exq-q')?.focus(), 50);
  // ✨ اقتراحات الذكاء: تُدرج قبل أزرار الحفظ (طويل ← صياغة أقصر، متشابه ← بديل)
  const longWhy = (EX_LONG_CACHE.get(x) || {}).why || '', sims = examQSimilars(bank, x);
  document.querySelector('#exq-q')?.closest('.field')?.parentElement?.querySelector(':scope > .row:last-child')?.insertAdjacentHTML('beforebegin',
    `<div class="exq-ai"><div class="row" style="gap:.4rem;flex-wrap:wrap;align-items:center">
      <button type="button" class="ai-btn" onclick="examQSuggest('short')"><span class="ai-mark">✦</span> ${longWhy ? 'اقترح صياغة أقصر' : 'اقترح صياغة أوضح'}</button>
      ${sims.length ? `<button type="button" class="ai-btn" onclick="examQSuggest('alt')"><span class="ai-mark">✦</span> اقترح بديلًا غير متشابه</button>` : ''}
      <span class="muted" style="font-size:.74rem">${[longWhy ? '📏 ' + esc(longWhy) : '', sims.length ? `🔁 يشبه ${sims.length} ${sims.length === 1 ? 'سؤالًا' : 'أسئلة'} في الاختبار` : ''].filter(Boolean).join(' · ')}</span></div>
      <div id="exq-sug"></div></div>`);
}
/* بعد الحفظ أو الإلغاء: يعود المعلم إلى النافذة التي فتح منها التعديل (المتشابهة/الطويلة) بما اختاره فيها */
function examQBack(){ const E = window._exQE || {}; closeModal(); if(E.back === 'sim') examHwSimOpen(); else if(E.back === 'long') examLongOpen(E.bank); }
/* أسئلة الاختبار المحددة الشبيهة بهذا السؤال */
function examQSimilars(bank, x){ return examBankItems(bank).filter(y => y !== x && y.selected !== false && exSimClash(x, y)); }
/* ✨ يطلب من الذكاء ٣ اقتراحات: «short» صياغة أقصر/أوضح بالمعنى والإجابة نفسيهما، و«alt» سؤال بديل من الدرس نفسه
   يقيس فكرة أخرى غير ما في الشبيه وبقية أسئلة الاختبار. الاقتراح يملأ الحقول فقط — الحفظ بيد المعلم */
async function examQSuggest(kind){
  const E = window._exQE, x = E && examBankItems(E.bank)[E.idx], box = document.getElementById('exq-sug'); if(!x || !box) return;
  const mc = x.kind !== 'tf', nO = mc ? x.o.length : 0;
  const cur = { q:(document.getElementById('exq-q')?.value || x.q).trim(), ...(mc ? { o:x.o.map((_, j) => (document.getElementById('exq-o' + j)?.value || '').trim()), a:Number(document.querySelector('input[name=exq-a]:checked')?.value ?? x.a) } : { a:document.querySelector('input[name=exq-a]:checked')?.value === '1' }) };
  const subj = (document.getElementById('ex-subject')?.value || 'العلوم').trim(), grade = (document.getElementById('ex-grade')?.value || '').trim();
  const shape = mc ? `{"suggestions":[{"q":"نص السؤال","o":[${Array.from({length:nO}, (_, j) => `"خيار ${j + 1}"`).join(',')}],"a":رقم_الخيار_الصحيح_من_0}]}` : `{"suggestions":[{"q":"نص العبارة","a":true}]}`;
  const others = examBankItems(E.bank).filter(y => y !== x && y.selected !== false).map(y => '- ' + y.q).slice(0, 60).join('\n');
  const prompt = kind === 'short'
    ? `أنت معلم ${subj}${grade ? ' للصف ' + grade : ''} تراجع سؤال اختبار ورقي. اكتب ٣ صياغات أقصر وأوضح للسؤال نفسه بالعربية الفصحى السليمة.
الشروط: المعنى نفسه والإجابة الصحيحة نفسها${mc ? ` (الخيار رقم ${cur.a} من 0 يبقى هو الصحيح وفي موضعه)، و${nO} خيارات بالترتيب نفسه، كل خيار قصير (٢٥ حرفًا أو أقل إن أمكن)، والخيارات الخاطئة تبقى خاطئة ومعقولة` : ` (العبارة تبقى ${cur.a ? 'صحيحة' : 'خاطئة'})`}، ونص ${mc ? 'السؤال' : 'العبارة'} سطر واحد (٧٠ حرفًا أو أقل إن أمكن)، بلا حذف لمعلومة يتوقف عليها الحل.
السؤال الحالي: ${JSON.stringify(cur)}
أخرج JSON فقط بهذا الشكل: ${shape}`
    : `أنت معلم ${subj}${grade ? ' للصف ' + grade : ''}. هذا سؤال في اختبار ورقي يشبه أسئلة أخرى فيه:
السؤال: ${JSON.stringify(cur)}
الشبيه به: ${examQSimilars(E.bank, x).map(y => y.q).join(' | ')}
اكتب ٣ أسئلة بديلة من الدرس نفسه ${mc ? `(اختيار من متعدد بـ${nO} خيارات، خيار واحد صحيح)` : '(صح أو خطأ)'} يقيس كل منها فكرة أو مهارة أخرى لا يسألها الشبيه ولا أي سؤال من أسئلة الاختبار التالية، بالعربية الفصحى، قصيرة (سطر واحد)، ومناسبة للصف.
أسئلة الاختبار:
${others}
أخرج JSON فقط بهذا الشكل: ${shape}`;
  box.innerHTML = '<div class="muted" style="font-size:.82rem;padding:.4rem 0">⏳ جارٍ التفكير…</div>';
  try{
    const prov = readingAIPickProvider(), model = readingAIModels()[prov];
    const raw = await readingAICall(prov, model, prompt, new AbortController().signal);
    let d; try{ d = readingAIParseObject(raw); }catch(e){ d = JSON.parse(aiRepairJson(String(raw).replace(/^[^{]*/, '').replace(/[^}]*$/, ''))); }
    const L = (Array.isArray(d && d.suggestions) ? d.suggestions : Array.isArray(d) ? d : []).map(s => mc
      ? { q:String(s.q || '').trim(), o:(Array.isArray(s.o) ? s.o : []).map(v => String(v ?? '').trim()), a:Number(s.a) }
      : { q:String(s.q || '').trim(), a:s.a === true || s.a === 'true' || s.a === 'صح' })
      .filter(s => s.q && (!mc || (s.o.length === nO && s.o.every(Boolean) && Number.isInteger(s.a) && s.a >= 0 && s.a < nO)))
      .filter(s => kind !== 'short' || !mc || s.a === cur.a).slice(0, 3);
    if(!L.length){ box.innerHTML = '<div class="muted" style="font-size:.82rem;padding:.4rem 0">لم تصل اقتراحات صالحة — جرّب مرة أخرى.</div>'; return; }
    window._exQSug = L;
    const LT = ['أ','ب','ج','د'];
    box.innerHTML = `<div class="exq-sugs">${L.map((s, i) => `<div class="exq-sug"><div class="exq-sug-t"><b>${esc(s.q)}</b>
        ${mc ? `<span class="exq-sug-o">${s.o.map((o, j) => `<span class="${j === s.a ? 'ok' : ''}">${LT[j]}) ${esc(o)}</span>`).join('')}</span>` : `<span class="exq-sug-o"><span class="ok">${s.a ? '✓ صح' : '✗ خطأ'}</span></span>`}
        ${kind === 'alt' && examQSimilars(E.bank, { ...x, ...s, kind:x.kind }).length ? '<small class="exq-warn">⚠️ ما زال يشبه سؤالًا في الاختبار</small>' : ''}</div>
        <button type="button" class="btn ghost sm" onclick="examQUseSug(${i})">استخدمه</button></div>`).join('')}</div>
      <div class="muted" style="font-size:.74rem;margin-top:.3rem">«استخدمه» يملأ الحقول أعلاه — راجعها ثم اضغط «💾 حفظ». ${kind === 'alt' ? 'البديل قد يغيّر الإجابة الصحيحة.' : ''}</div>`;
  }catch(e){ box.innerHTML = `<div class="exq-warn" style="font-size:.82rem;padding:.4rem 0">⚠️ ${esc(e && e.message || 'تعذّر الاتصال بالذكاء')}</div>`; }
}
function examQUseSug(i){
  const s = (window._exQSug || [])[i]; if(!s) return;
  const q = document.getElementById('exq-q'); if(q) q.value = s.q;
  if(Array.isArray(s.o)) s.o.forEach((o, j) => { const el = document.getElementById('exq-o' + j); if(el) el.value = o; });
  const v = Array.isArray(s.o) ? String(s.a) : (s.a ? '1' : '0');
  const r = document.querySelector(`input[name=exq-a][value="${v}"]`); if(r) r.checked = true;
  q?.focus(); toast('✦ وُضع الاقتراح في الحقول — راجعه ثم اضغط «💾 حفظ»', 'good');
}
function examQDone(msg){ const E = window._exQE; closeModal(); examBankRerender(E.bank); toast(msg, 'good'); if(E.back) examQBack(); }
function examQSave(){
  const E = window._exQE, x = E && examBankItems(E.bank)[E.idx]; if(!x) return;
  const q = (document.getElementById('exq-q')?.value || '').trim(); if(!q){ toast('اكتب نص السؤال', 'bad'); return; }
  const pick = document.querySelector('input[name=exq-a]:checked'); let a = pick ? Number(pick.value) : x.a, o = null;
  if(x.kind !== 'tf'){
    const raw = x.o.map((_, j) => (document.getElementById('exq-o' + j)?.value || '').trim());
    if(!raw[a]){ toast('الإجابة الصحيحة لا يصح أن تكون فارغة', 'bad'); return; }
    if(raw.filter(Boolean).length < 2){ toast('السؤال يحتاج خيارين على الأقل', 'bad'); return; }
    a = raw.slice(0, a).filter(Boolean).length; o = raw.filter(Boolean);          // الخيار الفارغ يُحذف
  } else a = a === 1;
  const same = q === x.q && a === x.a && (!o || (o.length === x.o.length && o.every((v, j) => v === x.o[j])));
  if(same){ examQBack(); return; }
  const e = { q, ...(o ? { o } : {}), a };
  examQApplyEdit(x, e); if(E.bank === 'hw' && x.key) EXAM_HW_EDITS.set(x.key, e);
  examQDone('✏️ عُدّل السؤال — المعاينة تحدّثت');
}
function examQOff(){
  const E = window._exQE, x = E && examBankItems(E.bank)[E.idx]; if(!x) return;
  x.selected = x.selected === false; examQDone(x.selected ? '↩️ أُعيد السؤال للاختبار' : '🚫 استُبعد السؤال من الاختبار');
}
function examQRevert(){
  const E = window._exQE, x = E && examBankItems(E.bank)[E.idx]; if(!x || !x._orig) return;
  x.q = x._orig.q; if(x._orig.o) x.o = x._orig.o.slice(); x.a = x._orig.a; delete x.edited; delete x._orig; try{ EX_SIM_TOK.delete(x); }catch(e){}
  if(E.bank === 'hw' && x.key) EXAM_HW_EDITS.delete(x.key);
  examQDone('↺ أُعيد السؤال كما في الأصل');
}
function examHwSimQuick(mode){
  document.querySelectorAll('.exsim-list input[data-g]').forEach(c => { c.checked = mode === 'all' || c.dataset.i === '0'; c.closest('.exsim-row').classList.toggle('off', !c.checked); });
}
function examHwSimApply(){
  const G = window._exSimG || [], bank = new Map(examHwBankAll().map(x => [x.key, x])); let off = 0;
  document.querySelectorAll('.exsim-list input[data-g]').forEach(c => { const x = (G[+c.dataset.g] || [])[+c.dataset.i]; if(!x) return;
    if(!c.checked) off++;
    if(x.kind === 'mp'){ if(c.checked) EXAM_HW_MPOFF.delete(x.key); else EXAM_HW_MPOFF.add(x.key); }
    else { const b = bank.get(x.key); if(b) b.selected = c.checked; } });
  closeModal(); renderExamHwBank(); examBuild();
  toast(off ? `🔁 استُبعد ${off} ${off === 1 ? 'سؤال متشابه' : 'أسئلة متشابهة'} — لا تدخل الاختبار ولا ملف JSON` : 'أُبقيت كل الأسئلة', 'good');
}

const EX_FONTS = {
  trad:   `"Traditional Arabic","Simplified Arabic","Sakkal Majalla","Noto Naskh Arabic","Times New Roman",serif`,
  naskh:  `"Noto Naskh Arabic","Traditional Arabic","Scheherazade New",serif`,
  modern: `"Tajawal","Readex Pro",Tahoma,sans-serif`
};
/* الخط التقليدي يرسم أصغر من غيره بفارق ملحوظ، فيُعوَّض بمقاس أعلى */
const EX_SCALE = { trad:{s:1.18,m:1.30,l:1.44}, naskh:{s:0.96,m:1.06,l:1.18}, modern:{s:0.9,m:1.0,l:1.1} };

function examAIProxyCleanup(){
  try{ __normalAIAbort?.abort(); }catch(e){}
  const i=Array.isArray(HW)?HW.findIndex(x=>x&&x.__examProxy):-1;
  if(i>=0) HW.splice(i,1);
  EXAM_AI_ACTIVE_PROXY=null;
  document.getElementById('normal-ai-modal')?.remove();
  document.getElementById('exam-ai-modal')?.remove();
  AI_STAGE=null;
}

/*
   الاختبار الورقي يستخدم نفس مولّد الأنشطة العادية حرفيًا:
   نفس الواجهة، نفس normalAIGenerate، نفس normalAIBuildPrompt،
   نفس readingAICall، نفس parsing/normalization والقواعد المحفوظة.
   الفرق الوحيد أن الناتج لا يُحفظ كنشاط؛ يُسلَّم لبنك الاختبار الورقي.
*/
function openExamAIGenerator(){
  examAIProxyCleanup();
  const prefs=normalAIGetPrefs(), meta=prefs.meta||{};
  const subject=(document.getElementById('ex-subject')?.value||meta['qg-subjectInput']||rcGet('subject')||'علوم').trim();
  const grade=(document.getElementById('ex-grade')?.value||meta['qg-gradeSelect']||'الأول').trim();
  const term=meta['qg-termSelect']||'الأول';
  const stage=meta['qg-stageSelect']||'متوسط';
  const diff=meta['qg-diffSelect']||'medium';
  const topic=meta['qg-topicInput']||'';
  const tpl=examTpl();
  const T4=tpl==='t4', FL=T4?examFlexLayout():null, cntT=k=>FL?FL.reduce((a,pg)=>a+pg.filter(x=>x.t===k).reduce((b,x)=>b+x.n,0),0):0;
  const T1=tpl==='t1'||tpl==='t5';   // القالب ٥ يختار أعداده مثل ١
  const nmc=T4?Math.min(40,cntT('mc')):T1?Math.max(0,Math.min(20,Number(document.getElementById('ex-nmc')?.value)||5)):5;
  const ntf=T4?Math.min(40,cntT('tf')):T1?Math.max(0,Math.min(20,Number(document.getElementById('ex-ntf')?.value)||5)):5;
  // القالبان ٢ و٣: وصل (سؤال واحد بـ٥ أزواج) + أكمل الفراغ ٥ (قالب ٢) أو «أجب عن كل مما يلي» بدرجات القالب (قالب ٣)
  // القالب ٤: الأعداد من تصميم الصفحات
  const nfill=T4?cntT('fill'):tpl==='t2'?EX_N:0, nmatch=T4?cntT('match'):tpl==='t1'?0:tpl==='t5'?Math.max(0,Math.min(6,Number(document.getElementById('ex-nmt')?.value)||0)):EX_N;   // الوصل هنا = عدد الأزواج (يُولَّد سؤالًا واحدًا بها)
  let essayMarks=T4?FL.flat().filter(x=>x.t==='open').flatMap(x=>Array(x.n).fill(x.m)):[];
  // عدة نماذج: كل نموذج يأخذ حصته من البنك بلا تكرار، فنولّد اختيارًا وصح/خطأ بعدد النماذج (حتى ٤٠)
  const models=Math.max(1,Math.min(6,Number(document.getElementById('ex-model-count')?.value)||1));
  const perMc=nmc, perTf=ntf;
  const big=!!document.getElementById('ex-ai-big')?.checked;   // 📦 بنك موسّع: الحد الأقصى لكل نوع مطلوب
  const genMc=big?(perMc?40:0):Math.min(40,perMc*models), genTf=big?(perTf?40:0):Math.min(40,perTf*models);
  // الوصل والفراغ و«أجب»: نسخة مختلفة لكل نموذج (تُكتب في الحقول بالتتابع: أ ثم ب…)
  const genFill=Math.min(40,nfill*models), genMatch=Math.min(40,nmatch*models);
  const genEssay=essayMarks.length?Array.from({length:models},()=>essayMarks).flat().slice(0,24):[];
  if(tpl==='t3'){
    essayMarks=examParseMarks(document.getElementById('ex-open-marks')?.value);
    if(!essayMarks.length) essayMarks=examSplitMarks(Number(examAr2En(document.getElementById('ex-open-total')?.value))||5, Number(document.getElementById('ex-open-n')?.value)||3);
    essayMarks=essayMarks.slice(0,EX_OPEN_MAX);
  }
  if(!nmc&&!ntf&&!nfill&&!nmatch&&!essayMarks.length){ toast('حدّد عددًا أكبر من صفر للأسئلة في إعدادات الاختبار.','bad'); return; }

  const id='__exam_ai_proxy__'+Date.now().toString(36);
  const proxy={
    id,
    title:(document.getElementById('ex-title')?.value||'اختبار ورقي').trim(),
    kind:'normal', qs:[], games:[], published:false,
    __examProxy:true,
    __examExtra: (tpl==='t1' && models===1) ? null : { tpl, matchPairs:tpl==='t1'?0:(T4?genMatch:EX_N*models), essayMarks:genEssay, fill:nfill>0, models }
  };
  HW.push(proxy);
  // مرجع مستقل عن HW لأن المزامنة الخلفية قد تعيد بناء HW أثناء انتظار مزود الذكاء.
  EXAM_AI_ACTIVE_PROXY=proxy;

  openNormalAIGenerator(id);
  const modal=document.getElementById('normal-ai-modal');
  if(!modal){
    EXAM_AI_ACTIVE_PROXY=null;
    const i=Array.isArray(HW)?HW.findIndex(x=>x&&x.id===id):-1;
    if(i>=0) HW.splice(i,1);
    return;
  }
  modal.style.display='flex';
  modal.classList.add('on');

  // ضبط مولّد الأنشطة على متطلبات الاختبار الورقي فقط.
  const setVal=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v;};
  const check=(id,v)=>{const e=document.getElementById(id);if(e)e.checked=!!v;};
  setVal('nai-topic',topic);
  setVal('nai-subject',subject);
  setVal('nai-stage',stage);
  document.getElementById('nai-stage')?.dispatchEvent(new Event('change'));
  setVal('nai-grade',grade);
  setVal('nai-term',term);
  setVal('nai-diff',diff);
  setVal('nai-content','');

  // الاختبار الورقي يحتاج MC + TF فقط. بقية الأنواع تختفي بدل أن نتركها تعبث بالكمية.
  Object.keys(NAI_BANK_LABELS).forEach(k=>{
    const row=document.getElementById('nai-row-'+k);
    const cb=document.getElementById('nai-'+k);
    const n=document.getElementById('nai-count-'+k);
    const wanted=k==='quiz'?genMc:k==='truefalse'?genTf:k==='fillblank'?genFill:k==='match'?(tpl==='t1'?0:T4?genMatch:EX_N*models):0;
    if(n) n.max=String(naiMaxCount());
    const shown=(k==='quiz'&&(!T4||nmc>0))||(k==='truefalse'&&(!T4||ntf>0))||(k==='fillblank'&&nfill>0)||(k==='match'&&nmatch>0);
    if(n)n.value=wanted;
    if(cb)cb.checked=wanted>0;
    if(row){row.classList.toggle('on',wanted>0);row.style.display=shown?'':'none';}
    const lab=row?.querySelector('label span');
    if(lab && k==='match') lab.textContent = nmatch>0 ? 'وصّل (عدد الأزواج)' : NAI_BANK_LABELS.match;
  });
  check('nai-game-on',false);
  const gameBox=document.getElementById('nai-game-box'); if(gameBox)gameBox.style.display='none';
  const gameStep=gameBox?.closest('.nai-step'); if(gameStep)gameStep.style.display='none';
  const head=modal.querySelector('.reading-ai-head h3');
  if(head) head.innerHTML='توليد أسئلة الاختبار الورقي بالذكاء <span style="font-size:.68rem;font-weight:700;opacity:.5">نفس مولّد الأنشطة العادية</span>';
  const note=modal.querySelector('.reading-ai-note');
  if(note) note.textContent='يستخدم هذا الاختبار نفس آلية مولّد الأنشطة العادية وإعداداته وقواعده. الناتج سيُدخل في بنك الاختبار فقط.'
    + (tpl==='t1' ? '' : ' رقم الوصل هو عدد الأزواج في سؤال الوصل.')
    + (big ? ` 📦 بنك موسّع: يُولَّد ${[genMc?genMc+' اختيار':'',genTf?genTf+' صح/خطأ':''].filter(Boolean).join(' و')} — يستغرق وقتًا أطول، وبعدها توزّعها على النماذج من البنك (تلقائيًا أو بنفسك).` : '')
    + (!big && models>1 ? ` الاختبار ${models} نماذج، لذلك يُولَّد ${genMc?genMc+' اختيار':''}${genMc&&genTf?' و':''}${genTf?genTf+' صح/خطأ':''} ليأخذ كل نموذج أسئلة مختلفة${(perMc*models>40||perTf*models>40)?' (الحد ٤٠، فقد تتكرر بعض الأسئلة بين النماذج)':''}.` : '')
    + (models>1 && (genFill||genEssay.length||nmatch) ? ` الوصل والفراغ و«أجب» تُولَّد أيضًا بعدد النماذج لتختلف بينها.` : '')
    + (genEssay.length ? ` وسيُولَّد أيضًا ${genEssay.length} أسئلة «أجب عن كل مما يلي» بدرجات: ${genEssay.join('، ')} (من إعداد القالب ${T4?'٤':'٣'}).` : '');
  const title=modal.querySelector('.reading-ai-head');
  if(title) title.setAttribute('data-exam-proxy','1');
  naiCtxSummary();

  // استبدال نصوص الخطوات بما يناسب الاختبار دون تغيير آلية التوليد.
  const steps=modal.querySelectorAll('.nai-step');
  if(steps[0]){
    const h=steps[0].querySelector('h4');
    if(h) h.innerHTML='<span class="n">1</span> محتوى الدرس <span class="hint">أساس جودة أسئلة الاختبار</span>';
  }
  if(steps[1]){
    const h=steps[1].querySelector('h4');
    const hint = T4 ? 'حسب تصميم الصفحات' : tpl==='t2' ? 'اختيار + صح/خطأ + وصل + أكمل الفراغ' : tpl==='t3' ? 'اختيار + صح/خطأ + وصل + أجب عن كل مما يلي' : 'اختيار متعدد + صح/خطأ';
    if(h) h.innerHTML=`<span class="n">2</span> بنك الاختبار <span class="hint">${hint}</span>`;
  }
  const foot=modal.querySelector('#nai-foot');
  if(foot) foot.querySelector('#nai-generate')?.setAttribute('onclick',`naiRun('${id}')`);
  setTimeout(()=>document.getElementById('nai-content')?.focus(),80);
}

/* عند تصدير JSON نحول الرمز الداخلي مرة أخرى إلى رمز الأس الأصلي */
function examJsonText(value){
  return String(value == null ? '' : value)
    .replace(/\\\\uE000٠\\\\uE001/g,'⁰')
    .replace(/\\\\uE000١\\\\uE001/g,'¹')
    .replace(/\\\\uE000٢\\\\uE001/g,'²')
    .replace(/\\\\uE000٣\\\\uE001/g,'³')
    .replace(/\\\\uE000٤\\\\uE001/g,'⁴')
    .replace(/\\\\uE000٥\\\\uE001/g,'⁵')
    .replace(/\\\\uE000٦\\\\uE001/g,'⁶')
    .replace(/\\\\uE000٧\\\\uE001/g,'⁷')
    .replace(/\\\\uE000٨\\\\uE001/g,'⁸')
    .replace(/\\\\uE000٩\\\\uE001/g,'⁹')
    .replace(/\uE000٠\uE001/g,'⁰')
    .replace(/\uE000١\uE001/g,'¹')
    .replace(/\uE000٢\uE001/g,'²')
    .replace(/\uE000٣\uE001/g,'³')
    .replace(/\uE000٤\uE001/g,'⁴')
    .replace(/\uE000٥\uE001/g,'⁵')
    .replace(/\uE000٦\uE001/g,'⁶')
    .replace(/\uE000٧\uE001/g,'⁷')
    .replace(/\uE000٨\uE001/g,'⁸')
    .replace(/\uE000٩\uE001/g,'⁹');
}


function examAIApplyFromNormal(){
  const st = AI_STAGE;
  const proxy = (Array.isArray(HW)?HW.find(x=>x && x.__examProxy):null) || EXAM_AI_ACTIVE_PROXY;
  const validStage = st && Array.isArray(st.bank);
  const validProxy = proxy && (!st || st.id===proxy.id);

  // لا نعتمد على وجود الـ proxy وحده؛ أثناء التوليد قد يتغير/يُحذف،
  // بينما الناتج الفعلي محفوظ في AI_STAGE.
  if(!validStage && !validProxy){
    toast('لا يوجد ناتج جاهز للاعتماد.','bad');
    return;
  }

  const bank = validStage ? st.bank : (Array.isArray(proxy?.bank) ? proxy.bank : []);
  const mc = bank.filter(q=>q && (q.t==='q'||q.t==='quiz'||q.type==='mc'||q.type==='mcq'))
    .map(q=>({
      q:String(q.q ?? q.question ?? '').trim(),
      o:(Array.isArray(q.o)?q.o:(Array.isArray(q.opts)?q.opts:q.options)).map(x=>String(x??'').trim()).filter(Boolean).slice(0,4),
      a:q.a ?? q.answer,
      kind:'mc',
      selected:true
    }))
    .filter(q=>q.q && q.o.length>=2)
    .map(q=>{
      const raw=String(q.a??'').trim();
      let a=q.o.findIndex(x=>x===raw);
      if(a<0 && /^\d+$/.test(raw)) a=Number(raw);
      if(!Number.isInteger(a)||a<0||a>=q.o.length) a=0;
      return {...q,a};
    });

  const tf = bank.filter(q=>q && (q.t==='tf'||q.t==='truefalse'||q.type==='tf'||q.type==='truefalse'))
    .map(q=>({
      q:String(q.q ?? q.question ?? '').trim(),
      a:q.a ?? q.answer,
      kind:'tf',
      selected:true
    }))
    .filter(q=>q.q)
    .map(q=>({...q,a:q.a===true||q.a==='true'||q.a===1||q.a==='1'||q.a==='صح'}));

  const extraRaw=bank.filter(q=>q && (q.t==='f'||q.t==='m'||q.t==='e'));
  // القالب ٤ قد يخلو من الاختيار والصح/خطأ (وصل/فراغ/مقالي فقط) — يكفي وجود أي نوع صالح
  if(!mc.length&&!tf.length&&!extraRaw.length){
    toast('تم التوليد لكن لم يتم العثور على أسئلة صالحة للاعتماد.','bad');
    return;
  }

  const label='مولد الذكاء — '+(document.getElementById('ex-title')?.value||'اختبار ورقي');
  EXAM_JSON_BANK={mc,tf,label,raw:extraRaw.length?extraRaw:null};
  EXAM_SRC={mc:mc.slice(),tf:tf.slice(),label};

  const src=document.getElementById('ex-src');
  if(src) src.value='ai';

  // ضمان أن بنك AI هو الذي يُعرض ويُستخدم كمصدر للاختبار.
  examSourceChanged();
  renderExamJsonBank();
  const ex=examExtrasFromRaw(extraRaw);
  if(ex.match.length||ex.fill.length||ex.open.length) examApplyExtras(ex,true);
  examBuild(true);

  const count=document.getElementById('ex-ai-count');
  const status=document.getElementById('ex-ai-status');
  const total=mc.length+tf.length+ex.fill.length+ex.open.length+(ex.match.length?1:0);
  if(count) count.textContent=`${total} سؤالًا جاهزًا`;
  if(status) status.textContent=`تم اعتماد ${mc.length+tf.length} سؤال اختيار وصح/خطأ في بنك مولد الذكاء`
    + (ex.match.length?` · ${ex.match.length} أزواج وصل`:'') + (ex.fill.length?` · ${ex.fill.length} أكمل الفراغ`:'') + (ex.open.length?` · ${ex.open.length} أجب عن كل مما يلي`:'')
    + (ex.match.length||ex.fill.length||ex.open.length?' (في حقول الصفحة الثانية، ويمكنك تعديلها).':'') + ' حدّد ما تريد إدخاله في الاختبار.';

  examAIProxyCleanup();
  toast(`تم اعتماد ${total} سؤالًا في بنك الاختبار`,'good');
}
function examBankRerender(bank){ if(bank === 'hw') renderExamHwBank(); else renderExamJsonBank(); examBuild(); }
function examSetModel(bank, idx, v){
  const x = examBankItems(bank)[idx]; if(!x) return;
  v = Number(v); if(v >= 0){ x.model = v; x.selected = true; } else delete x.model;
  examBankRerender(bank);
}
/* ⚖️ توزيع تلقائي ظاهر: كل نوع يُقسَّم بالتساوي (بعد خلط ثابت) فيرى المعلم ويعدّل */
/* ⚖️ التوزيع التلقائي يشمل كل الأنواع: الاختيار والصح/خطأ (بخلط) + أسطر الوصل/الفراغ/«أجب» (بالتناوب فتتوزع موضوعات الدرس) */
function examXAuto(n){
  const P = {};
  examXTypes().forEach(t => examXItems(t).forEach((it, i) => { P[examXKey(t, it)] = i % n; }));
  examXSavePins(P);
}
function examModelsAuto(bank){
  const n = examModelCount(); if(n < 2){ toast('اختر أكثر من نموذج أولًا','bad'); return; }
  const all = examBankItems(bank).filter(x => x.selected !== false), { nmc, ntf } = examNeed();
  const mc = all.filter(x => x.kind !== 'tf'), tf = all.filter(x => x.kind === 'tf');
  // كل نموذج يأخذ حاجته على الأقل، والزائد يُقسَّم بالتساوي — ولا يجتمع سؤالان متشابهان في نموذج
  const { M } = examSpreadAll(mc, tf, nmc, ntf, n, 'auto|' + Date.now(), { pins:false, fill:false, balance:true, capMc: Math.max(nmc, Math.ceil(mc.length / n)), capTf: Math.max(ntf, Math.ceil(tf.length / n)) });
  all.forEach(x => { delete x.model; });
  M.forEach((m, i) => [...m.mc, ...m.tf].forEach(x => { x.model = i; }));
  examXAuto(n);
  examBankRerender(bank); const short = Math.max(0, nmc * n - mc.length) + Math.max(0, ntf * n - tf.length);
  toast(short ? `⚖️ وُزّعت بلا أسئلة متشابهة في نموذج واحد — البنك ينقصه ${short} ${short === 1 ? 'سؤال' : 'أسئلة'} فتُكمَّل النماذج بأسئلة مشتركة بينها` : '⚖️ وُزّعت كل الأنواع على النماذج بالتساوي وبلا أسئلة متشابهة في نموذج واحد — عدّل ما تريد', short ? 'warn' : 'good');
}
function examModelsClear(bank){ examBankItems(bank).forEach(x => { delete x.model; }); examXSavePins({}); examBankRerender(bank); }
function examXSet(t, i, v){
  const it = examXItems(t)[i]; if(it === undefined) return;
  const P = examXPins(), k = examXKey(t, it); v = Number(v);
  if(v >= 0) P[k] = v; else delete P[k];
  examXSavePins(P);
  try{ renderExamHwBank(); renderExamJsonBank(); }catch(e){}
  examBuild(true);
}

/* ══════════════ 💾 حفظ الاختبارات الورقية ══════════════ */
const K_SAVED_PAPER_EXAMS = 'hwapp_saved_paper_exams_v1';
const EXAM_CONFIG_IDS = [
  'ex-title','ex-subject','ex-grade','ex-time','ex-date','ex-office','ex-dept','ex-school','ex-teacher',
  'ex-nmc','ex-ntf','ex-nmt','ex-mark','ex-font','ex-size','ex-logo-size','ex-model-count','ex-model',
  'ex-tpl','ex-match-txt','ex-fill-txt','ex-open-txt','ex-open-n','ex-open-total','ex-open-marks','ex-open-lines','ex-fill-extra','ex-flex','ex-extra-pins'
];
const EXAM_CHECK_IDS = ['ex-omr-marks','ex-show-subject','ex-show-grade','ex-show-time','ex-show-date','ex-show-office','ex-show-dept','ex-show-school','ex-key','ex-shuffle','ex-hindi','ex-use-selected','ex-fill-bank'];

function readSavedPaperExams(){
  try{
    const v=JSON.parse(localStorage.getItem(K_SAVED_PAPER_EXAMS)||'[]');
    return Array.isArray(v)?v:[];
  }catch(e){ return []; }
}
function writeSavedPaperExams(v){
  try{ localStorage.setItem(K_SAVED_PAPER_EXAMS,JSON.stringify(v)); return true; }
  catch(e){ toast('تعذر حفظ الاختبار — مساحة التخزين ممتلئة.','bad'); return false; }
}
function cloneExamQuestions(arr){
  return (Array.isArray(arr)?arr:[]).map(q=>JSON.parse(JSON.stringify(q)));
}
function currentPaperExamPayload(){
  const val=id=>document.getElementById(id)?.value ?? '';
  const checked=id=>!!document.getElementById(id)?.checked;
  const src=document.getElementById('ex-src')?.value||'hw';
  let bank;
  if(src==='hw') bank={mc:cloneExamQuestions(EXAM_HW_BANK.mc),tf:cloneExamQuestions(EXAM_HW_BANK.tf),label:EXAM_HW_BANK.title||''};
  else bank={mc:cloneExamQuestions(EXAM_JSON_BANK.mc),tf:cloneExamQuestions(EXAM_JSON_BANK.tf),label:EXAM_JSON_BANK.label||''};
  return {
    id:'pex_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7),
    title:String(val('ex-title')||'اختبار ورقي').trim(),
    savedAt:new Date().toISOString(),
    source:src,
    config:Object.fromEntries(EXAM_CONFIG_IDS.map(id=>[id,val(id)])),
    checks:Object.fromEntries(EXAM_CHECK_IDS.map(id=>[id,checked(id)])),
    bank
  };
}
/* ═══ 📷 التصحيح الآلي: «خريطة الإجابة» من الورقة المرسومة نفسها ═══
   الورقة لا تتغير. نقيس موقع كل مربع بالمليمتر من الصفحة الأولى كما رسمها examBuild،
   ونقرأ مفتاح الإجابة من نسخة «نموذج الإجابة» لكل نموذج، ثم نرسلها للخادم لتقرأها بوابة المعلم. */
function omrMeasure(pageEl){
  const page=pageEl||document.querySelector('#exam-paper .exam-page'); if(!page) return null;
  const pr=page.getBoundingClientRect(), k=210/pr.width;          // مم لكل بكسل (يصمد لأي تكبير في المعاينة)
  const R=el=>{ const r=el.getBoundingClientRect(); return [ +((r.left-pr.left)*k).toFixed(2), +((r.top-pr.top)*k).toFixed(2), +(r.width*k).toFixed(2), +(r.height*k).toFixed(2) ]; };
  const anchors=[...page.querySelectorAll('.ex-sec, .ex-title, .ex-student')].map(R).filter(r=>r[2]>8&&r[3]>5);
  const questions=[];
  page.querySelectorAll('.ex-q, .ex-tf, .ex-amtq').forEach(q=>{
    const mc=q.classList.contains('ex-q'), mt=q.classList.contains('ex-amtq');
    const cells=[...q.querySelectorAll(mc?'.ex-opt':mt?'.ex-amto':'.ex-tf-c')];
    const boxes=cells.map(c=>c.querySelector('.ex-box')).filter(Boolean).map(R);
    const key=cells.findIndex(c=>c.classList.contains('key'));
    // 📝 نص السؤال وخياراته: ليُبنى العلاج من الأسئلة التي أخطأ فيها الطالب بعد التصحيح الآلي
    const tx=e=>String(e&&e.textContent||'').replace(/\s+/g,' ').trim().slice(0,600);
    const qt=mc?tx(q.querySelector('.ex-qt span:last-child')):mt?tx(q.querySelector('.ex-amt-t')):tx([...q.children].find(c=>c.tagName==='SPAN'&&!c.classList.contains('ex-num')&&!c.classList.contains('ex-tf-c')));
    // الوصل: خيارات السؤال = عبارات العمود الأول بترتيبها (رقم المربع)
    const opts=mc?cells.map(c=>tx(c.querySelector('span:last-child'))):mt?[...(q.closest('.ex-sec')||page).querySelectorAll('.ex-amt-c1t')].map(tx):[];
    const qm=Number(q.dataset.m);                                     // درجة السؤال في المصمَّم (لكل قسم درجته)
    if(boxes.length>=2 && key>=0) questions.push({ t:mc?'mc':mt?'mt':'tf', boxes, key, ...(qm>0?{m:qm}:{}), ...(qt?{q:qt}:{}), ...((mc||mt)&&opts.length===boxes.length&&opts.every(Boolean)?{o:opts}:{}) });
  });
  const allQ=document.querySelectorAll('#exam-paper .ex-q, #exam-paper .ex-tf, #exam-paper .ex-amtq').length;
  const ptag=page.querySelector(':scope > .ex-ptag');                    // وسم الصفحة (٢ فما بعد): يعرف به الجوال أي صفحة صوّرها
  const cells=[...page.querySelectorAll('.ex-mcode i')];
  const mcode=cells.length>1 ? { cells:cells.map(R), on:cells.findIndex(c=>c.classList.contains('on')) } : null;   // رمز النموذج
  const sc=[...page.querySelectorAll('.ex-scode i')];
  const scode=sc.length===20 ? { cells:sc.map(R) } : null;              // رمز الطالب في أوراق الأسماء
  const fid=[...page.querySelectorAll(':scope > .ex-fid')].map(R);   // علامات الزوايا: أعلى اليسار، أعلى اليمين، أسفل اليمين، أسفل اليسار (المفرّغة)
  return { anchors, questions, mcode, ...(fid.length===4?{marks:fid}:{}), ...(scode?{scode}:{}), ...(ptag?{tag:R(ptag)}:{}), skipped: allQ-questions.length, pageH:+(pr.height*k).toFixed(1) };
}
/* ⚙️ إدارة التصحيح الآلي: كل الاختبارات المجهّزة للجوال (حذف/إخفاء/إعادة تسمية) وإعدادات التصوير في البوابة.
   الإعدادات تُحفظ في الخادم وتقرؤها بوابة المعلم عند فتح التصحيح الآلي. */
const OMRM = { list:[], cfg:{}, sel:new Set(), busy:false };
async function omrManage(){
  if(!getApi()||!getTok()){ toast('اضبط عنوان الخادم وكلمة السر أولًا','bad'); return; }
  openModal(`<div class="omrm"><h3>⚙️ إعدادات التصحيح الآلي</h3><p class="muted">جارٍ التحميل…</p></div>`);
  try{ const [j,pp]=await Promise.all([omrApiCall('/omr/list'), omrApiCall('/omr/papers').catch(()=>({tests:[]}))]); OMRM.list=j.templates||[]; OMRM.cfg=j.settings||{}; OMRM.papers=pp.tests||[]; OMRM.sel=new Set(); }
  catch(e){ document.querySelector('#modal .omrm').innerHTML='<h3>⚙️ إعدادات التصحيح الآلي</h3><p class="muted">تعذّر الاتصال بالخادم.</p>'; return; }
  // اختبارات جُهّزت قبل حفظ الخصائص في القائمة: نقرأ قالبها مرة لمعرفة علامات الزوايا وأوراق الأسماء
  await Promise.all(OMRM.list.filter(t=>t.marks===undefined).map(async t=>{ try{ const g=await omrApiCall('/omr/get?id='+encodeURIComponent(t.id)); const ms=g.template.models||[]; t.marks=ms.every(m=>!!m.marks); t.named=ms.every(m=>!!m.scode); }catch(e){} }));
  omrManageRender();
}
function omrManageRender(){
  const box=document.querySelector('#modal .omrm'); if(!box) return;
  const c=OMRM.cfg, L=OMRM.list, now=Date.now();
  const d=t=>t?new Date(t).toLocaleDateString('ar-SA-u-ca-gregory',{day:'numeric',month:'numeric',year:'numeric'}):'—';
  const tg=(k,on,lab,sub)=>`<label class="omrm-set"><span><b>${lab}</b><small>${sub}</small></span><input type="checkbox" class="omrm-sw" ${on?'checked':''} onchange="omrManageSet('${k}',this.checked)"></label>`;
  const vis=L.filter(t=>!t.hidden).length;
  box.innerHTML=`<h3>⚙️ إعدادات التصحيح الآلي</h3>
    <div class="omrm-sec"><h4>📷 التصوير («دفتر الاختبارات ← 📱 رصد ← بالكاميرا»)</h4>
      <label class="omrm-set"><span><b>🎯 دقة القراءة</b><small>«أدق» يجمع 3 لقطات لكل ورقة فتقلّ الأسئلة غير الواضحة (نحو ثانية ونصف للورقة)</small></span>
        <select class="inp omrm-sel" onchange="omrManageSet('frames',Number(this.value))"><option value="3" ${c.frames!==1?'selected':''}>أدق — 3 لقطات</option><option value="1" ${c.frames===1?'selected':''}>أسرع — لقطة واحدة</option></select></label>
      ${tg('beep',c.beep!==false,'🔔 صوت عند إضافة ورقة','نغمة عالية = أُضيفت، منخفضة = مكررة — مفيد والجوال مثبّت')}
      ${tg('glareWait',c.glareWait!==false,'✨ الانتظار عند لمعة الضوء','ينتظر ثانيتين لتحرّك الجوال، والأسئلة تحت اللمعة تُعرض للتأكيد دائمًا')}
      <label class="omrm-set"><span><b>☑️☑️ إذا ظلّل الطالب خيارين</b><small>«للمراجعة» يعرض السؤال لتختار بنفسك · «خطأ مباشرة» يحسبه خطأ ويُعلَّم الخياران بالأحمر على ورقته</small></span>
        <select class="inp omrm-sel" onchange="omrManageSet('double',this.value)"><option value="review" ${c.double!=='wrong'?'selected':''}>تُعرض لي للمراجعة</option><option value="wrong" ${c.double==='wrong'?'selected':''}>تُحسب خطأ مباشرة</option></select></label>
      ${tg('autoSave',!!c.autoSave,'💾 رصد أوراق الأسماء تلقائيًا','ورقة عُرف صاحبها وكل أسئلتها واضحة تُرصد فورًا بلا مراجعة (لا تستبدل درجة مرصودة)')}
    </div>
    <div class="omrm-sec"><h4>📄 أوراق الاختبار للطلاب وأولياء الأمور</h4>
      <p class="muted" style="font-size:.78rem;margin:0 0 .5rem">بعد الرصد تُحفظ صورة ورقة كل طالب وعليها ختم بدرجته. لا يراها أحد حتى تنشرها — ثم تظهر للطالب في بوابته ولولي أمره في تقرير المتابعة.</p>
      ${(OMRM.papers||[]).length?`<div class="omrm-list">${OMRM.papers.map(t=>{ const cl=Object.keys(t.byCls||{}).sort((a,b)=>a.localeCompare(b,'ar')), on=c=>t.pub||(t.pubCls||[]).includes(c), anyOn=t.pub||(t.pubCls||[]).length, allOn=cl.length&&cl.every(on);
        return `<div class="omrm-row" style="flex-wrap:wrap"><div class="omrm-main"><b>${esc(t.title)}</b><small>${t.n} ${t.n===1?'ورقة':'أوراق'} · آخرها ${d(t.at)}</small>
          <span class="omrm-chips">${allOn?'<i class="ok">📢 منشورة للجميع</i>':anyOn?'<i class="ok">📢 منشورة لبعض الفصول</i>':'<i>🔒 غير منشورة</i>'}${anyOn&&t.key?'<i class="ok">✅ الإجابات الصحيحة ظاهرة</i>':''}</span></div>
        <div class="omrm-acts" style="flex-wrap:wrap;justify-content:flex-end">
          <button class="btn ghost sm" type="button" onclick="omrPapersPreview('${esc(t.test)}')">👁️ معاينة</button>
          ${anyOn?`<button class="btn ghost sm omrm-undo" type="button" title="تختفي الأوراق من بوابة الطلاب وتقارير أولياء الأمور فورًا — يمكن نشرها مرة أخرى" onclick="omrPapersPub('${esc(t.test)}',{pub:false})">↩️ تراجع عن النشر</button>`:''}
          ${anyOn?`<button class="btn ghost sm" type="button" title="تظهر الإجابة الصحيحة بإطار أخضر متقطع عند كل سؤال أخطأ فيه — أظهرها بعد أن تنتهي كل الفصول من الاختبار" onclick="omrPapersPub('${esc(t.test)}',{key:${!t.key}})">${t.key?'إخفاء الإجابات':'✅ إظهار الإجابات'}</button>`:''}
          <button class="btn ghost sm" type="button" title="حذف صور أوراق هذا الاختبار" onclick="omrPapersDel('${esc(t.test)}')">🗑️</button></div>
        <div class="omrm-cls"><span class="muted">النشر حسب الفصل:</span>
          ${cl.map(c=>`<button type="button" class="omrm-clsb${on(c)?' on':''}" title="${on(c)?'منشورة لهذا الفصل — اضغط لإيقافها':'اضغط لنشرها لهذا الفصل فقط'}" onclick='omrPapersPub(${JSON.stringify(t.test)},{pub:${!on(c)},cls:${JSON.stringify(c)},all:${JSON.stringify(cl)}})'>${on(c)?'📢':'🔒'} ${esc(c||'بلا فصل')} <small>${t.byCls[c]}</small>${on(c)?' <b class="omrm-x" aria-label="تراجع">✕</b>':''}</button>`).join('')}
          ${cl.length>1?`<button type="button" class="omrm-clsb all" onclick="omrPapersPub('${esc(t.test)}',{pub:${!allOn}})">${allOn?'إيقاف الكل':'📢 نشر للجميع'}</button>`:''}</div></div>`; }).join('')}</div>`
        :'<p class="muted" style="font-size:.8rem">لا أوراق بعد — تُحفظ تلقائيًا عند رصد الدرجات من التصحيح الآلي («دفتر الاختبارات ← 📱 رصد ← بالكاميرا»).</p>'}
      <p class="muted" style="font-size:.74rem;margin-top:.45rem">تُحذف أوراق الفصل الدراسي تلقائيًا عند أول تصحيح في الفصل التالي.</p>
    </div>
    <div class="omrm-sec"><h4>🗂️ الاختبارات المجهّزة <span class="muted">(${L.length} · ظاهر في الجوال ${vis})</span></h4>
      ${L.length?`<div class="omrm-bulk"><button class="btn ghost sm" type="button" onclick="omrManageSelOld()">تحديد الأقدم من 30 يومًا</button>
        <button class="btn ghost sm" type="button" onclick="omrManageSelAll()">${OMRM.sel.size===L.length?'إلغاء التحديد':'تحديد الكل'}</button>
        <button class="btn danger sm" type="button" ${OMRM.sel.size?'':'disabled'} onclick="omrManageDel([...OMRM.sel])">🗑️ حذف المحدد (${OMRM.sel.size})</button></div>`:'<p class="muted">لا توجد اختبارات مجهّزة بعد — من «📷 تجهيز للتصحيح الآلي».</p>'}
      <div class="omrm-list">${L.map(t=>{ const old=now-(t.at||0)>30*864e5;
        return `<div class="omrm-row${t.hidden?' off':''}"><input type="checkbox" ${OMRM.sel.has(t.id)?'checked':''} onchange="omrManageSel('${esc(t.id)}',this.checked)" aria-label="تحديد">
          <div class="omrm-main"><b>${esc(t.title)}</b>
            <small>جُهّز ${d(t.at)}${old?' · قديم':''} · ${t.n} سؤالًا${t.models>1?` · ${t.models} نماذج`:''}${t.total?` · من ${t.total}`:''}</small>
            <span class="omrm-chips">${t.marks?'<i class="ok">⬛ علامات الزوايا</i>':t.marks===false?'<i class="warn" title="اطبعه من جديد بعد «تجهيز للتصحيح الآلي» ليقرأ أي مقاس طباعة">⚠️ بلا علامات زوايا</i>':''}${t.named?'<i class="ok">🧾 أوراق أسماء</i>':''}${t.hidden?'<i>🙈 مخفي في الجوال</i>':''}</span></div>
          <div class="omrm-acts"><button class="btn ghost sm" type="button" title="إعادة تسمية" onclick="omrManageRename('${esc(t.id)}')">✏️</button>
            <button class="btn ghost sm" type="button" title="${t.hidden?'إظهار في الجوال':'إخفاء من الجوال'}" onclick="omrManageHide('${esc(t.id)}',${!t.hidden})">${t.hidden?'👁️':'🙈'}</button>
            <button class="btn ghost sm" type="button" title="حذف" onclick="omrManageDel(['${esc(t.id)}'])">🗑️</button></div></div>`; }).join('')}</div>
      <p class="muted" style="font-size:.76rem;margin-top:.5rem">الحذف يمسح خريطة الإجابة فقط — الدرجات المرصودة لا تتأثر. الإخفاء يُبقيه محفوظًا ويخفيه من قائمة الجوال.</p>
    </div>
    <div class="row" style="justify-content:flex-end"><button class="btn tick" type="button" onclick="closeModal()">تم</button></div>`;
}
async function omrManageSet(k,v){
  const prev={...OMRM.cfg}; OMRM.cfg[k]=v;
  try{ const j=await omrApiCall('/omr/settings',{settings:OMRM.cfg}); OMRM.cfg=j.settings; toast('✓ حُفظ الإعداد','good'); }
  catch(e){ OMRM.cfg=prev; toast('تعذّر الحفظ','bad'); }
  omrManageRender();
}
async function omrPapersPub(test,ch){
  const t0=(OMRM.papers||[]).find(x=>x.test===test), before=t0?{pub:!!t0.pub,pubCls:[...(t0.pubCls||[])],key:!!t0.key}:null;
  try{ const j=await omrApiCall('/omr/papers/pub',{test,...ch}); const t=(OMRM.papers||[]).find(x=>x.test===test); if(t){ t.pub=j.pub; t.pubCls=j.pubCls||[]; t.key=j.key; }
    const who=ch.cls!==undefined?`فصل ${ch.cls}`:'الجميع';
    const msg=ch.pub===true?`📢 نُشرت لـ${who} — تظهر لطلابه وأولياء أمورهم`:ch.pub===false?`↩️ أُلغي النشر لـ${who} — لم تعد ظاهرة`:ch.key?'✅ الإجابات الصحيحة ظاهرة':'أُخفيت الإجابات الصحيحة';
    if(before && !ch._undo) omrUndoBar(msg, ()=>omrPapersRestore(test,before)); else toast(msg,'good');
    return j; }
  catch(e){ toast('تعذّر التعديل','bad'); }
  omrManageRender();
}
/* 👁️ معاينة الأوراق قبل النشر: كل ورقة باسم صاحبها وختمها، مع تنبيه إن تغيّرت الدرجة المرصودة بعد الختم */
async function omrPapersPreview(test){
  const v=document.createElement('div'); v.className='opv-veil'; v.innerHTML='<div class="opv-box"><p class="muted" style="padding:2rem;text-align:center">جارٍ تحميل الأوراق…</p></div>'; document.body.appendChild(v);
  const close=()=>{ v.remove(); omrManageRender(); }; v.onclick=e=>{ if(e.target===v) close(); };
  const onUndo=async ev=>{ if(!v.isConnected){ document.removeEventListener('omr-pub-changed',onUndo); return; } if(ev.detail.test!==test) return; const t=(OMRM.papers||[]).find(x=>x.test===test); if(t){ j.pub=t.pub; j.pubCls=t.pubCls; j.key=t.key; } render(); };
  document.addEventListener('omr-pub-changed',onUndo);
  let j; try{ j=await omrApiCall('/omr/papers/list?test='+encodeURIComponent(test)); }catch(e){ v.querySelector('.opv-box').innerHTML='<p class="muted" style="padding:2rem">تعذّر التحميل.</p>'; return; }
  const P=j.papers||[], CL=[...new Set(P.map(x=>x.cls))].sort((a,b)=>a.localeCompare(b,'ar'));
  let F=CL.length>1?(window.__opvCls&&CL.includes(window.__opvCls)?window.__opvCls:CL[0]):'';   // فصل واحد في كل مرة: تُراجع ثم تُنشر
  const isOn=c=>j.pub||(j.pubCls||[]).includes(c);
  const render=()=>{ const V=P.map((x,i)=>[x,i]).filter(([x])=>!F||x.cls===F), diff=V.filter(([x])=>x.now!=null&&Math.abs(x.now-x.score)>1e-9);
    v.querySelector('.opv-box').innerHTML=`<div class="opv-head"><div><b>👁️ معاينة أوراق «${esc(j.title)}»</b><small>${F?`فصل ${esc(F)} · `:''}${V.length} ${V.length===1?'ورقة':'أوراق'} · ${F?(isOn(F)?'📢 منشورة لهذا الفصل':'🔒 لم تُنشر لهذا الفصل'):(j.pub?'📢 منشورة':'🔒 لم تُنشر بعد')}</small></div>
      ${F?(isOn(F)?`<button class="btn ghost" type="button" id="opv-pub" data-on="1">↩️ تراجع عن نشر فصل ${esc(F)}</button>`:`<button class="btn tick" type="button" id="opv-pub">📢 نشر فصل ${esc(F)} (${V.length})</button>`)
        :(j.pub||(j.pubCls||[]).length?`<button class="btn ghost" type="button" id="opv-unpub">↩️ تراجع عن النشر</button>`:`<button class="btn tick" type="button" id="opv-pub">📢 نشر الكل (${P.length})</button>`)}<button class="btn ghost" type="button" id="opv-x">إغلاق</button></div>
    ${CL.length>1?`<div class="opv-tabs">${CL.map(c=>`<button type="button" class="opv-tab${c===F?' on':''}" data-cls="${esc(c)}">${isOn(c)?'📢':'🔒'} ${esc(c||'بلا فصل')} <small>${P.filter(x=>x.cls===c).length}</small></button>`).join('')}<button type="button" class="opv-tab${!F?' on':''}" data-cls="">الكل <small>${P.length}</small></button></div>`:''}
    ${diff.length?`<p class="opv-warn">⚠️ ${diff.length} ${diff.length===1?'ورقة':'أوراق'} درجة ختمها غير الدرجة المرصودة الآن (عُدّلت بعد التصحيح). احذفها أو أعد تصحيحها قبل النشر.</p>`:''}
    <div class="opv-grid">${V.map(([x,i])=>`<div class="opv-card${x.now!=null&&Math.abs(x.now-x.score)>1e-9?' bad':''}" data-i="${i}">
        <div class="opv-img" data-open="${i}"><span class="muted">…</span></div>
        <div class="opv-meta"><b>${esc(x.name||'طالب')}</b><small>${esc(x.cls)}${x.n?` · الصحيح ${x.right} من ${x.n}`:''}</small>
          <span class="opv-sc">الختم: ${x.score} / ${x.max}${x.now!=null&&Math.abs(x.now-x.score)>1e-9?` · <i>المرصودة الآن ${x.now}</i>`:''}</span></div>
        <button class="btn ghost sm" type="button" data-del="${i}" title="تُحذف الورقة ودرجته في هذا الاختبار">🗑️ حذف الورقة والدرجة</button></div>`).join('')||'<p class="muted">لا أوراق.</p>'}</div>`;
    v.querySelector('#opv-x').onclick=close;
    v.querySelectorAll('[data-cls]').forEach(b=>b.onclick=()=>{ F=b.dataset.cls; window.__opvCls=F; render(); });
    const ub=v.querySelector('#opv-unpub'); if(ub) ub.onclick=async()=>{ const r=await omrPapersPub(test,{pub:false}); if(r){ j.pub=r.pub; j.pubCls=r.pubCls||[]; } render(); };
    const pb=v.querySelector('#opv-pub'); if(pb) pb.onclick=async()=>{ const r=await omrPapersPub(test,F?{pub:!pb.dataset.on,cls:F,all:CL}:{pub:true}); if(r){ j.pub=r.pub; j.pubCls=r.pubCls||[]; } render(); };
    v.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{ const x=P[+b.dataset.del]; if(!(await askConfirm(`حذف ورقة ${x.name||'الطالب'} ودرجته في هذا الاختبار؟ تُحذف صورتها ولا تُنشر، وتُمسح الدرجة ليُعاد تصحيحه.`,{title:'حذف الورقة والدرجة',yes:'احذف',no:'إلغاء',danger:true}))) return;
      try{ await omrApiCall('/omr/papers/delete',{test,sid:x.sid});
        // الدرجة تُمسح معها (علامة حذف بطابع زمني في كل دفتر فيه هذا الاختبار)
        try{ await ctSave(d=>{ const B=d.examBooks||{}; for(const sm of Object.keys(B)) for(const pr of Object.keys(B[sm]||{})){ const bk=B[sm][pr]; if(bk&&Array.isArray(bk.tests)&&bk.tests.some(t=>String(t.id)===String(test))){ bk.scores=bk.scores||{}; const k=String(x.sid); bk.scores[k]=bk.scores[k]||{}; bk.scores[k][String(test)]={del:true,at:Date.now()}; } } }); }catch(e){} P.splice(+b.dataset.del,1); const t=(OMRM.papers||[]).find(y=>y.test===test); if(t) t.n=P.length; toast('✓ استُبعدت','good'); render(); }catch(e){ toast('تعذّر الحذف','bad'); } });
    v.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{ const x=P[+b.dataset.open]; if(!x.img) return;
      const o=document.createElement('div'); o.className='opv-full'; o.onclick=()=>o.remove();
      o.innerHTML=`<div class="opv-fimg"><img src="${x.img}" alt="">${(x.keyBoxes||[]).map(k=>`<i style="left:${k[0]*100}%;top:${k[1]*100}%;width:${k[2]*100}%;height:${k[3]*100}%"></i>`).join('')}</div><span>${esc(x.name)} · ${x.score} / ${x.max}${j.key?' · الإطار المتقطع = الإجابة الصحيحة (ظاهرة للطلاب)':''} — اضغط للإغلاق</span>`;
      document.body.appendChild(o); });
    load(); };
  // الصور واحدة بعد الأخرى (كل صورة ~120 ك.ب) — تظهر البطاقات فورًا
  let busy=false; const load=async()=>{ if(busy) return; busy=true;
    for(let i=0;i<P.length;i++){ const x=P[i]; if(!v.isConnected) break;
      if(!x.img){ try{ const r=await omrApiCall(`/omr/papers/img?test=${encodeURIComponent(test)}&sid=${encodeURIComponent(x.sid)}`); x.img=r.img; x.keyBoxes=r.keyBoxes; }catch(e){ x.img=''; } }
      const box=v.querySelector(`[data-open="${i}"]`); if(box&&x.img) box.innerHTML=`<img src="${x.img}" alt="">`; }
    busy=false; };
  render();
}
/* ↩️ شريط «تراجع» بعد أي نشر/إلغاء/إظهار إجابات: يعيد الحالة السابقة كما كانت بالضبط (10 ثوانٍ) */
function omrUndoBar(msg, undo){
  document.getElementById('omr-undo')?.remove();
  const b=document.createElement('div'); b.id='omr-undo'; b.className='omr-undo';
  b.innerHTML=`<span>${esc(msg)}</span><button type="button" class="btn sm">↩️ تراجع</button><button type="button" class="omr-undo-x" aria-label="إغلاق">✕</button>`;
  const kill=()=>{ clearTimeout(b._t); b.remove(); };
  b.querySelector('.btn').onclick=async()=>{ kill(); await undo(); };
  b.querySelector('.omr-undo-x').onclick=kill;
  document.body.appendChild(b); b._t=setTimeout(kill,10000);
}
async function omrPapersRestore(test, st){
  try{ await omrApiCall('/omr/papers/pub',{test,pub:false});                                 // صفر ثم الحالة السابقة
    let j=null; if(st.pub) j=await omrApiCall('/omr/papers/pub',{test,pub:true});
    else for(const c of st.pubCls) j=await omrApiCall('/omr/papers/pub',{test,pub:true,cls:c,all:[]});
    j=await omrApiCall('/omr/papers/pub',{test,key:st.key});
    const t=(OMRM.papers||[]).find(x=>x.test===test); if(t){ t.pub=j.pub; t.pubCls=j.pubCls||[]; t.key=j.key; }
    toast('↩️ أُعيدت الحالة السابقة','good');
  }catch(e){ toast('تعذّر التراجع','bad'); }
  omrManageRender(); document.dispatchEvent(new CustomEvent('omr-pub-changed',{detail:{test}}));
}
async function omrPapersDel(test){
  const t=(OMRM.papers||[]).find(x=>x.test===test); if(!t) return;
  if(!(await askConfirm(`حذف صور أوراق «${t.title}» (${t.n})؟ الدرجات المرصودة لا تتأثر.`,{title:'حذف الأوراق',yes:'احذف',no:'إلغاء',danger:true}))) return;
  try{ await omrApiCall('/omr/papers/delete',{test}); OMRM.papers=OMRM.papers.filter(x=>x.test!==test); toast('✓ حُذفت','good'); }catch(e){ toast('تعذّر الحذف','bad'); }
  omrManageRender();
}
function omrManageSel(id,on){ on?OMRM.sel.add(id):OMRM.sel.delete(id); omrManageRender(); }
function omrManageSelAll(){ OMRM.sel = OMRM.sel.size===OMRM.list.length ? new Set() : new Set(OMRM.list.map(t=>t.id)); omrManageRender(); }
function omrManageSelOld(){ const now=Date.now(); OMRM.sel=new Set(OMRM.list.filter(t=>now-(t.at||0)>30*864e5).map(t=>t.id)); if(!OMRM.sel.size) toast('لا اختبارات أقدم من 30 يومًا'); omrManageRender(); }
async function omrManageDel(ids){
  if(!ids.length) return;
  const one=ids.length===1 ? OMRM.list.find(t=>t.id===ids[0]) : null;
  if(!(await askConfirm(one?`حذف «${one.title}» من التصحيح الآلي؟ لن تُقرأ أوراقه المطبوعة بعد الحذف.`:`حذف ${ids.length} اختبارات من التصحيح الآلي؟ لن تُقرأ أوراقها المطبوعة بعد الحذف.`,{title:'حذف',yes:'احذف',no:'إلغاء',danger:true}))) return;
  try{ await omrApiCall('/omr/delete',{ids}); OMRM.list=OMRM.list.filter(t=>!ids.includes(t.id)); ids.forEach(i=>OMRM.sel.delete(i)); toast(`✓ حُذف ${ids.length}`,'good'); }
  catch(e){ toast('تعذّر الحذف','bad'); }
  omrManageRender();
}
async function omrManageHide(id,hidden){
  try{ const j=await omrApiCall('/omr/update',{id,hidden}); const t=OMRM.list.find(x=>x.id===id); if(t) t.hidden=j.template.hidden; toast(hidden?'أُخفي من قائمة الجوال':'ظاهر في الجوال','good'); }
  catch(e){ toast('تعذّر التعديل','bad'); }
  omrManageRender();
}
function omrManageRename(id){
  const t=OMRM.list.find(x=>x.id===id); if(!t) return;
  const row=[...document.querySelectorAll('#modal .omrm-row')].find(r=>r.querySelector(`[onclick*="omrManageRename('${CSS.escape(id)}')"]`)); const main=row&&row.querySelector('.omrm-main b'); if(!main) return;
  main.outerHTML=`<span class="omrm-ren"><input class="inp" value="${esc(t.title)}" maxlength="120"><button class="btn tick sm" type="button">حفظ</button></span>`;
  const w=row.querySelector('.omrm-ren'), inp=w.querySelector('input'); inp.focus(); inp.select();
  const go=async()=>{ const v=inp.value.trim(); if(!v||v===t.title){ omrManageRender(); return; }
    try{ await omrApiCall('/omr/update',{id,title:v}); t.title=v; toast('✓ تغيّر الاسم','good'); }catch(e){ toast('تعذّر التعديل','bad'); } omrManageRender(); };
  w.querySelector('button').onclick=go; inp.onkeydown=e=>{ if(e.key==='Enter') go(); if(e.key==='Escape') omrManageRender(); };
}
async function omrSendTemplate(){
  const box=document.getElementById('exam-paper');
  if(!box || !box.querySelector('.ex-sec')){ toast('أنشئ الاختبار أولًا','bad'); return; }
  if(window._exSample){ toast('اختر الأسئلة أولًا — المعاينة الآن شكل القالب فقط','bad'); return; }
  if(!examOmrOn()){ toast('فعّل «📷 للتصحيح الآلي بالجوال» في القالب المصمَّم واطبع الورقة بعلاماتها أولًا','bad'); return; }
  const api=getApi(), tok=getTok();
  if(!api||!tok){ toast('اضبط عنوان الخادم وكلمة السر أولًا','bad'); return; }
  const keyEl=document.getElementById('ex-key'), modelSel=document.getElementById('ex-model');
  const keep={ key:!!(keyEl&&keyEl.checked), model:modelSel?modelSel.value:'0' };
  const count=Math.max(1, Number(document.getElementById('ex-model-count')?.value)||1);
  const models=[];
  // 📏 القياس بالحجم الحقيقي: المعاينة مصغّرة لتتسع لعمودها، والتصغير قد يغيّر التفاف السطور فتختلف المواقع عن الورقة المطبوعة
  const pv=document.getElementById('exw-prev'), pvz=pv?pv.style.getPropertyValue('--exz'):'';
  if(pv) pv.style.setProperty('--exz','1'); window._exzLock=true;
  try{
    if(keyEl) keyEl.checked=true;
    for(let m=0;m<count;m++){
      if(modelSel) modelSel.value=String(m);
      examBuild(true);
      const M=omrMeasure(); if(!M) throw new Error('measure');
      // 📄📄 الصفحات التالية التي فيها مربعات (القالب المصمَّم): لكل منها خريطتها ووسمها، وتُقرأ وتُضم لورقة الطالب
      const pgs=[...document.querySelectorAll('#exam-paper .exam-page')].slice(1).filter(pg=>pg.querySelector(':scope > .ex-ptag'));
      const more=pgs.map(pg=>{ const X=omrMeasure(pg); return X && X.tag && X.marks && X.questions.length ? { page:Number(pg.querySelector(':scope > .ex-ptag').dataset.pg)||2, anchors:X.anchors, questions:X.questions, marks:X.marks, tag:X.tag } : null; }).filter(Boolean);
      if(more.length){ M.more=more; M.skipped=Math.max(0, M.skipped-more.reduce((t,x)=>t+x.questions.length,0)); }
      const st=document.getElementById('ex-status')?.textContent||'', mt=/المجموع\s+([\d.]+)/.exec(st);
      models.push({ letter: count>1 ? examModelLetter(m) : '', ...M, total: mt ? Number(mt[1]) : 0 });   // مجموع كل نموذج (قد تختلف الأسئلة بين النماذج)
    }
  }catch(e){ toast('تعذّر قياس ورقة الاختبار','bad'); return; }
  finally{
    if(keyEl) keyEl.checked=keep.key;
    if(modelSel) modelSel.value=keep.model;
    window._exzLock=false; if(pv){ if(pvz) pv.style.setProperty('--exz',pvz); else pv.style.removeProperty('--exz'); }
    examBuild(true);
  }
  const mark=examMarkVal();
  const n=models[0].questions.length+(models[0].more||[]).reduce((t,x)=>t+x.questions.length,0);
  const autoPts=+models[0].questions.concat(...(models[0].more||[]).map(p=>p.questions)).reduce((t,q)=>t+(q.m||mark),0).toFixed(2);   // لكل سؤال درجته
  if(!models[0].questions.length){ toast('لا توجد أسئلة اختيار أو صح/خطأ في الصفحة الأولى','bad'); return; }
  const title=String(document.getElementById('ex-title')?.value||'اختبار قصير').trim();
  const total=(()=>{ const s=document.getElementById('ex-status')?.textContent||''; const m=/المجموع\s+([\d.]+)/.exec(s); return m?Number(m[1]):autoPts; })();
  // 🔖 النسخة = بصمة مفتاح الإجابة ومواقع المربعات. تعديل الاختبار بعد طباعته يصنع نسخة جديدة بجانب القديمة
  // (كانت تُستبدل بصمت فتُصحَّح الأوراق المطبوعة قبل التعديل بمفتاح الإجابة الجديد)
  const sig=JSON.stringify([title, mark, models.map(x=>x.questions.concat(...(x.more||[]).map(p=>p.questions)).map(q=>[q.t,q.key,q.boxes.map(r=>r.map(v=>Math.round(v))),...(q.m?[q.m]:[])]))]);
  let h=5381; for(let i=0;i<sig.length;i++) h=((h<<5)+h+sig.charCodeAt(i))|0;
  let th=5381; for(let i=0;i<title.length;i++) th=((th<<5)+th+title.charCodeAt(i))|0;   // اختبار غير محفوظ: أساسه عنوانه
  const ver=(h>>>0).toString(36).slice(0,6), base=String(window.__LOADED_PAPER_EXAM_ID||('x'+(th>>>0).toString(36))).replace(/[^A-Za-z0-9_-]/g,'').slice(0,30)||'x';
  let prevVers=[]; try{ const L=await (await fetch(api.replace(/\/+$/,'')+'/omr/list?t='+encodeURIComponent(tok))).json(); prevVers=(L.templates||[]).filter(e=>String(e.id).startsWith(base+'-v')&&e.id!==base+'-v'+ver); }catch(e){}
  const vn=prevVers.length?` (نسخة ${prevVers.length+1})`:'';
  const tpl={ id: base+'-v'+ver, title: title+vn, mark, total, autoTotal:autoPts, models, at:Date.now() };
  try{
    const r=await fetch(api.replace(/\/+$/,'')+'/omr/template',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:tok,template:tpl})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.ok) throw new Error(j.error||('HTTP '+r.status));
    const skipped=models[0].skipped;
    toast(`${prevVers.length?`🔖 نسخة جديدة${vn} — تغيّر الاختبار، والأوراق المطبوعة قبله تُصحَّح بنسختها السابقة · `:''}📷 جاهز للتصحيح الآلي: ${n} سؤالًا${count>1?` · ${count} نماذج`:''}${models[0].more?` · ${models[0].more.length+1===2?'صفحتان':models[0].more.length+1+' صفحات'} تُصوَّر كلٌّ منها`:''}${skipped?` · ${skipped} ${models[0].more?'بلا مربعات':'خارج الصفحة الأولى'} تُصحَّح يدويًا`:''}${tpl.total>tpl.autoTotal?` · الجزء الآلي ${tpl.autoTotal} من ${tpl.total}`:''}`,'good');
  }catch(e){ toast('تعذّر الإرسال: '+(e.message||''),'bad'); }
}

function saveCurrentPaperExam(){
  const box=document.getElementById('exam-paper');
  if(!box || !box.querySelector('.ex-sec')){ toast('أنشئ الاختبار أولًا ثم احفظه.','bad'); return; }
  const payload=currentPaperExamPayload();
  const all=readSavedPaperExams();
  // إذا كان الاختبار المحمّل يحمل معرفًا، نحدّثه بدل إنشاء نسخة ثانية.
  const existingId=window.__LOADED_PAPER_EXAM_ID||'';
  if(existingId){
    const i=all.findIndex(x=>x&&x.id===existingId);
    if(i>=0){ payload.id=existingId; all[i]=payload; }
    else all.unshift(payload);
  }else all.unshift(payload);
  if(all.length>50) all.length=50;
  writeSavedPaperExams(all);                       // نسخة احتياطية على الجهاز (تُستخدم إن تعذّر الخادم)
  window.__LOADED_PAPER_EXAM_ID=payload.id;
  const st=document.getElementById('exam-save-status');
  if(st) st.textContent='⏳ جارٍ الحفظ على الخادم…';
  paperExamPush(payload).then(ok=>{
    if(ok){ paperExamMarkCloud(payload.id); if(st) st.textContent='☁️ محفوظ على الخادم — يظهر في كل أجهزتك'; toast('☁️ حُفظ الاختبار على الخادم','good'); }
    else { if(st) st.textContent='💾 محفوظ على هذا الجهاز فقط — تعذّر الاتصال بالخادم، وسيُرفع تلقائيًا عند فتح «الاختبارات المحفوظة»'; toast('حُفظ على الجهاز، وتعذّر الخادم الآن','bad'); }
  });
}
/* ☁️ الخادم هو الأصل: /paper-exams (قائمة، جلب، حفظ، حذف) — والجهاز نسخة احتياطية */
async function paperExamApi(method, q, body){
  const api=(getApi()||'').replace(/\/+$/,''), tok=getTok();
  if(!api||!tok) throw new Error('no server');
  const url=api+'/paper-exams'+(method==='GET'?'?t='+encodeURIComponent(tok)+(q||''):'');
  const r=await fetch(url, method==='GET'?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:tok,...body})});
  const j=await r.json().catch(()=>null);
  if(!r.ok||!j||!j.ok) throw new Error((j&&j.error)||('HTTP '+r.status));
  return j;
}
async function paperExamPush(exam){ try{ await paperExamApi('POST','',{exam}); return true; }catch(e){ console.warn('paperExamPush',e); return false; } }
function paperExamMarkCloud(id){ const all=readSavedPaperExams(); const x=all.find(e=>e&&e.id===id); if(x){ x.cloud=true; writeSavedPaperExams(all); } }
function applySavedPaperExam(exam){
  if(!exam) return;
  const cfg=exam.config||{}, checks=exam.checks||{};
  EXAM_CONFIG_IDS.forEach(id=>{ const el=document.getElementById(id); if(el&&Object.prototype.hasOwnProperty.call(cfg,id)) el.value=String(cfg[id]??''); });
  EXAM_CHECK_IDS.forEach(id=>{ const el=document.getElementById(id); if(el&&Object.prototype.hasOwnProperty.call(checks,id)) el.checked=!!checks[id]; });
  // «النموذج الحالي»: خياراته تُبنى من عدد النماذج المحفوظ ثم يُختار المحفوظ — كان يُعيَّن قبل بنائها فيبقى فارغًا
  { const sel=document.getElementById('ex-model'), cnt=Math.max(1,Math.min(6,Number(document.getElementById('ex-model-count')?.value)||1));
    if(sel){ sel.innerHTML=Array.from({length:cnt},(_,i)=>`<option value="${i}">نموذج (${examModelLetter(i)})</option>`).join('');
      sel.value=String(Math.max(0,Math.min(cnt-1,Number(cfg['ex-model'])||0))); sel.disabled=cnt===1; try{ syncExamPrintAllButton(); }catch(e){} } }
  ['ex-nmc','ex-ntf'].forEach(id=>{ const el=document.getElementById(id); if(el) delete el.dataset.keep; });   // القيم المحمّلة هي الأصل
  if(!Object.prototype.hasOwnProperty.call(checks,'ex-omr-marks')){ const om=document.getElementById('ex-omr-marks'); if(om) om.checked=true; }   // محفوظ قبل الخيار: كما كان (بعلامات)
  examTplMigrate(Object.prototype.hasOwnProperty.call(cfg,'ex-tpl') ? cfg['ex-tpl'] : 't1');   // اختبار محفوظ قبل القوالب أو على قالب أُلغي
  examTplSyncUI();
  const src=document.getElementById('ex-src');
  if(src) src.value=(exam.source==='hw'||exam.source==='json'||exam.source==='ai')?exam.source:'json';
  const b=exam.bank||{mc:[],tf:[],label:''};
  // الاختبار المحفوظ مستقل عن النشاط أو ملف JSON الأصلي، لذلك نعيده كبنك داخلي.
  EXAM_JSON_BANK={mc:cloneExamQuestions(b.mc),tf:cloneExamQuestions(b.tf),label:String(b.label||'اختبار محفوظ'),raw:null};
  EXAM_SRC={mc:cloneExamQuestions(b.mc),tf:cloneExamQuestions(b.tf),label:String(b.label||'اختبار محفوظ')};
  EXAM_HW_BANK={id:'',title:'',mc:[],tf:[]};
  if(src) src.value='json';
  const use=document.getElementById('ex-use-selected'); if(use) use.checked=true;
  renderExamJsonBank();
  examSourceChanged();
  window.__LOADED_PAPER_EXAM_ID=exam.id||'';
  const st=document.getElementById('exam-save-status'); if(st) st.textContent='✓ تم تحميل اختبار محفوظ';
  toast('تم تحميل الاختبار المحفوظ','good');
  examBuild(true);
}
async function deleteSavedPaperExam(id){
  if(typeof askConfirm==='function' && !(await askConfirm('يُحذف من الخادم ومن هذا الجهاز، ولا يمكن التراجع.',{title:'حذف الاختبار المحفوظ؟',yes:'احذف',no:'إبقاء',danger:true}))) return;
  let cloudOk=true;
  try{ await paperExamApi('POST','',{del:id}); }catch(e){ cloudOk=false; }
  writeSavedPaperExams(readSavedPaperExams().filter(x=>x&&x.id!==id));
  openSavedPaperExams();
  toast(cloudOk?'تم حذف الاختبار المحفوظ':'حُذف من الجهاز، وتعذّر الوصول للخادم — قد يعود عند الفتح القادم', cloudOk?'good':'bad');
}
async function openSavedPaperExamById(id){
  let ex=null;
  try{ ex=(await paperExamApi('GET','&id='+encodeURIComponent(id))).exam; }catch(e){}
  if(!ex) ex=readSavedPaperExams().find(e=>e&&e.id===id);
  if(!ex){ toast('تعذّر فتح الاختبار — تحقق من الاتصال','bad'); return; }
  applySavedPaperExam(ex);
  document.getElementById('saved-paper-exams-modal')?.classList.remove('on');
}
async function openSavedPaperExams(){
  let veil=document.getElementById('saved-paper-exams-modal');
  if(!veil){
    veil=document.createElement('div'); veil.id='saved-paper-exams-modal'; veil.className='veil'; document.body.appendChild(veil);
  }
  veil.classList.add('on');
  const head=note=>`<div class="sheet-head"><div><h2>📂 الاختبارات الورقية المحفوظة</h2><div class="muted" style="font-size:.78rem">${note}</div></div><span class="spacer"></span><button class="btn ghost sm" onclick="document.getElementById('saved-paper-exams-modal').classList.remove('on')">إغلاق</button></div>`;
  veil.innerHTML=`<div class="modal" style="width:min(720px,100%)">${head('⏳ جارٍ جلب الاختبارات من الخادم…')}</div>`;
  const local=readSavedPaperExams();
  let server=null;
  try{ server=(await paperExamApi('GET','')).list; }catch(e){}
  // اختبارات محفوظة على هذا الجهاز فقط (قبل الخادم أو أثناء انقطاعه): تُرفع تلقائيًا
  let uploaded=0;
  if(server){
    const onServer=new Set(server.map(x=>x.id));
    for(const ex of local.filter(x=>x&&x.id&&!onServer.has(x.id))){
      if(await paperExamPush(ex)){ uploaded++; server.unshift({id:ex.id,title:ex.title,savedAt:ex.savedAt,mc:ex.bank?.mc?.length||0,tf:ex.bank?.tf?.length||0}); ex.cloud=true; }
    }
    if(uploaded) writeSavedPaperExams(local);
  }
  const list=server
    ? server.slice().sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt))).map(x=>({...x,where:'cloud'}))
    : local.map(x=>({id:x.id,title:x.title,savedAt:x.savedAt,mc:x.bank?.mc?.length||0,tf:x.bank?.tf?.length||0,where:'local'}));
  const fmt=d=>{try{return new Date(d).toLocaleString('ar-SA',{dateStyle:'medium',timeStyle:'short'});}catch(e){return String(d||'');}};
  const q=v=>String(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const note=server
    ? `☁️ محفوظة على الخادم وتظهر في كل أجهزتك، وتشمل الأسئلة والإعدادات والترويسة.${uploaded?` رُفع الآن ${uploaded} اختبار كان على هذا الجهاز فقط.`:''}`
    : '⚠️ تعذّر الاتصال بالخادم — تُعرض النسخ المحفوظة على هذا الجهاز فقط.';
  veil.innerHTML=`<div class="modal" style="width:min(720px,100%)">${head(note)}
    ${list.length?`<div style="display:flex;flex-direction:column;gap:.55rem">${list.map(x=>`<div class="ruled" style="padding:.75rem 1rem"><div class="row"><div class="name">${esc(x.title||'اختبار ورقي')}<div class="muted" style="font-size:.72rem">${x.where==='cloud'?'☁️':'💻'} ${fmt(x.savedAt)} · ${x.mc||0} اختيار + ${x.tf||0} صح/خطأ</div></div><button class="btn tick sm" onclick="openSavedPaperExamById('${q(x.id)}')">فتح</button><button class="btn ghost sm" onclick="deleteSavedPaperExam('${q(x.id)}')">حذف</button></div></div>`).join('')}</div>`:`<div class="empty"><span class="big">📂</span>لا توجد اختبارات محفوظة حتى الآن.</div>`}
  </div>`;
}
function examTplMigrate(old){
  const tp = document.getElementById('ex-tpl'); if(!tp) return;
  const val = id => document.getElementById(id)?.value || '', set = (id, v) => { const e = document.getElementById(id); if(e) e.value = v; };
  if(old === 't4' || old === 't5'){ tp.value = old; return; }
  if(old === 't2' || old === 't3'){
    const m = Math.max(0.25, Number(examAr2En(val('ex-mark'))) || 1), p1 = [{ t:'mc', n:5, m }, { t:'tf', n:5, m }], p2 = [{ t:'match', n:5, m }];
    if(old === 't2') p2.push({ t:'fill', n:5, m });
    else {
      // درجات «أجب» قد تختلف بين الأسئلة (٢، ٢، ١): كل مجموعة متتالية بدرجة واحدة قسمٌ بدرجته
      const n = Math.max(1, Math.min(EX_OPEN_MAX, Number(val('ex-open-n')) || 3));
      let ms = examParseMarks(val('ex-open-marks')).slice(0, n); if(ms.length < n) ms = examSplitMarks(Number(examAr2En(val('ex-open-total'))) || 5, n);
      const l = Number(val('ex-open-lines')) || 0;
      ms.forEach(x => { const last = p2[p2.length - 1]; if(last.t === 'open' && last.m === x) last.n++; else p2.push({ t:'open', n:1, m:Math.max(0.25, x), ...(l ? { l } : {}) }); });
    }
    tp.value = 't4'; set('ex-flex', JSON.stringify([p1, p2]));
    return;
  }
  tp.value = 't5'; set('ex-nmt', '0');                 // t1 أو اختبار قديم بلا قالب
}
function examOpenNTotalChanged(){
  const n = Number(document.getElementById('ex-open-n')?.value) || 1;
  const tot = Number(examAr2En(document.getElementById('ex-open-total')?.value)) || 0;
  const m = document.getElementById('ex-open-marks'); if(m) m.value = examSplitMarks(tot, n).join(', ');
  examBuild();
}
function examOpenMarksChanged(){
  const ms = examParseMarks(document.getElementById('ex-open-marks')?.value);
  if(ms.length){
    const n = document.getElementById('ex-open-n'), t = document.getElementById('ex-open-total');
    if(n) n.value = Math.min(EX_OPEN_MAX, ms.length);
    if(t) t.value = +ms.slice(0, EX_OPEN_MAX).reduce((a, b) => a + b, 0).toFixed(2);
  }
  examBuild();
}
function examFlexSave(L){
  L = examFlexClean(L) || JSON.parse(JSON.stringify(EX_FLEX_DEFAULT));
  const el = document.getElementById('ex-flex'); if(el) el.value = JSON.stringify(L);
  try{ localStorage.setItem(EX_FLEX_KEY, JSON.stringify(L)); }catch(e){}
  examBuild(true);
}
function examFlexEdit(pi, si, field, v){
  const L = examFlexLayout(), x = L[pi] && L[pi][si]; if(!x) return;
  if(field === 't'){ x.t = v; x.n = Math.min(x.n, EX_FLEX_TYPES[v].max); if(v === 'open' && x.m < 2) x.m = 2; }
  else x[field] = Number(examAr2En(v));
  examFlexSave(L);
}
function examFlexAct(act, pi, si){
  const L = examFlexLayout();
  if(act === 'addPage'){ if(L.length >= 6){ toast('الحد ٦ صفحات','bad'); return; } L.push([{t:'mc',n:5,m:1}]); }
  else if(act === 'delPage'){ if(L.length <= 1){ toast('الاختبار يحتاج صفحة واحدة على الأقل','bad'); return; } L.splice(pi, 1); }
  else if(act === 'addSec'){ if(L[pi].length >= 6){ toast('الحد ٦ أقسام في الصفحة','bad'); return; } L[pi].push({t:'tf',n:5,m:1}); }
  else if(act === 'delSec'){ L[pi].splice(si, 1); if(!L[pi].length) L.splice(pi, 1); if(!L.length) L.push([{t:'mc',n:5,m:1}]); }
  else if(act === 'up' || act === 'down'){
    // التحريك داخل الصفحة، وعند الحافة ينتقل القسم إلى الصفحة المجاورة
    const sec = L[pi][si], d = act === 'up' ? -1 : 1, j = si + d;
    if(j >= 0 && j < L[pi].length){ L[pi][si] = L[pi][j]; L[pi][j] = sec; }
    else if(L[pi + d]){ L[pi].splice(si, 1); if(d < 0) L[pi + d].push(sec); else L[pi + d].unshift(sec); if(!L[pi].length) L.splice(pi, 1); }
  }
  else if(act === 'reset') L.splice(0, L.length, ...JSON.parse(JSON.stringify(EX_FLEX_DEFAULT)));
  else if(act === 'preset'){ const P = EX_FLEX_PRESETS[pi]; if(!P) return; L.splice(0, L.length, ...JSON.parse(JSON.stringify(P.L))); toast('📐 ' + P.hint + ' — عدّل ما تريد', 'good'); }
  examFlexSave(L);
}
function examTplChanged(){ examTplSyncUI(); examBuild(true); }

/* سحب أسئلة الوصل/الفراغ الموجودة أصلًا: من نشاط (t:'f' و t:'m') أو من ملف JSON (fillblank / match) */
function examExtrasFromRaw(raw){
  const fill = [], match = [], open = [];
  const addOpen = q => { q = String(q ?? '').trim(); if(q) open.push(q); };
  const addFill = (q, a) => { q = String(q ?? '').trim(); if(q) fill.push(q + ' | ' + String(a ?? '').trim()); };
  const addPairs = ps => (Array.isArray(ps) ? ps : []).forEach(p => {
    const a = Array.isArray(p) ? p[0] : p?.a, b = Array.isArray(p) ? p[1] : p?.b;
    if(a && b) match.push(String(a).trim() + ' | ' + String(b).trim());
  });
  const scan = x => {
    if(!x || typeof x !== 'object') return;
    const ty = String(x.type || x.t || '').toLowerCase();
    if(ty === 'fillblank' || ty === 'f') addFill(x.q, x.answer ?? x.a);
    else if(ty === 'match' || ty === 'm') addPairs(x.pairs || x.p);
    else if(ty === 'essay' || ty === 'e') addOpen(x.q ?? x.question);
  };
  if(Array.isArray(raw)) raw.forEach(scan);
  ['fillblank','fill'].forEach(k => (Array.isArray(raw?.[k]) ? raw[k] : []).forEach(x => addFill(x.q ?? x.question, x.answer ?? x.a)));
  (Array.isArray(raw?.match) ? raw.match : []).forEach(x => addPairs(x.pairs || x.p || [x]));
  (Array.isArray(raw?.essay) ? raw.essay : []).forEach(x => addOpen(typeof x === 'string' ? x : (x?.q ?? x?.question)));
  (Array.isArray(raw?.questions) ? raw.questions : []).forEach(scan);
  return { fill, match, open };
}
function examExtrasFromActivity(){
  const acts = examHwActs();
  return examExtrasFromRaw(acts.length ? { questions:acts.flatMap(h => (h.qs || []).filter(Boolean)) } : null);
}
function examApplyExtras(ex, quiet){
  const set = (id, arr) => { const el = document.getElementById(id); if(el && arr.length){ el.value = arr.join('\n'); el.dataset.auto = el.value; } };
  set('ex-match-txt', ex.match); set('ex-fill-txt', ex.fill); set('ex-open-txt', ex.open || []);
  if(!quiet) toast(`تم سحب ${ex.match.length} زوج وصل و${ex.fill.length} سؤال أكمل الفراغ` + ((ex.open||[]).length ? ` و${ex.open.length} سؤال «أجب»` : ''), ex.match.length || ex.fill.length || (ex.open||[]).length ? 'good' : 'bad');
  examBuild(true);
}
/* الوصل والفراغ و«أجب» تُسحب تلقائيًا من النشاط المحدد. ما كتبه المعلم بيده لا يُستبدل:
   الحقل يُحدَّث فقط إن كان فارغًا أو ما زال كما سُحب آخر مرة (dataset.auto) */
function examAutoExtras(){
  if((document.getElementById('ex-src')?.value || 'hw') !== 'hw') return;
  const ex = examExtrasFromActivity();
  [['ex-match-txt', ex.match], ['ex-fill-txt', ex.fill], ['ex-open-txt', ex.open || []]].forEach(([id, arr]) => {
    const el = document.getElementById(id); if(!el) return;
    if(el.value.trim() && el.value !== el.dataset.auto) return;          // نص المعلم
    el.value = arr.join('\n'); el.dataset.auto = el.value;
  });
}
function examPullExtras(){
  const src = document.getElementById('ex-src')?.value || 'hw';
  const ex = src === 'hw' ? examExtrasFromActivity() : examJsonExtras();
  if(!ex.match.length && !ex.fill.length && !ex.open.length){ toast(src === 'ai' ? 'لم يُولَّد وصل أو فراغ بعد — اختر القالب «المصمَّم» بأقسام وصل أو فراغ ثم ولّد من جديد' : 'لا توجد أسئلة وصل أو أكمل الفراغ في هذا المصدر', 'bad'); return; }
  examApplyExtras(ex);
}
function examXSavePins(P){ const el = document.getElementById('ex-extra-pins'); if(el) el.value = JSON.stringify(P); }
function examStepClick(d){      // يُحفظ ما يفتحه المعلم ويطويه بيده فقط (لا الفتح الافتراضي)
  setTimeout(() => { try{ const o = JSON.parse(localStorage.getItem(K_EXS_OPEN) || '{}'); o[d.dataset.k] = d.open; localStorage.setItem(K_EXS_OPEN, JSON.stringify(o)); }catch(e){} examPrevZoom(); }, 0);
}

function printExam(){
  const box = document.getElementById('exam-paper');
  if(window._exSample){ toast('اختر الأسئلة أولًا — المعاينة الآن شكل القالب فقط','bad'); return; }
  if(!box || !box.querySelector('.ex-sec')){ toast('لا توجد فقرات للطباعة','bad'); return; }
  unifiedA4Print({
    bodyClass: 'printing-exam',
    title: (document.getElementById('ex-title')?.value || 'اختبار') ,
    selector: '#exam-paper',
    orientation: 'portrait',
    margin: '0'
  });
}
function omrStuBits(salt, id){ const h = omrStuHash(salt, id), b = []; for(let i = 0; i < 16; i++) b.push((h >> i) & 1); for(let i = 0; i < 3; i++) b.push((salt >> i) & 1); b.push(b.reduce((t, x) => t + x, 0) % 2); return b; }
function examNamedChanged(){
  const on = examNamed(), sel = document.getElementById('ex-named-cls'), btn = document.getElementById('ex-print-named');
  if(sel){ sel.style.display = on ? '' : 'none';
    if(on && !sel.options.length){ const cl = [...new Set(STUDENTS.map(s => s.cls).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'ar'));
      sel.innerHTML = cl.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('') + (cl.length > 1 ? '<option value="">كل الفصول</option>' : ''); } }
  if(btn) btn.style.display = on ? '' : 'none';
  examBuild(true);
}
async function printNamedExams(){
  const box = document.getElementById('exam-paper');
  if(window._exSample){ toast('اختر الأسئلة أولًا — المعاينة الآن شكل القالب فقط','bad'); return; }
  if(!box || !box.querySelector('.ex-sec')){ toast('لا توجد فقرات للطباعة','bad'); return; }
  // القالب في الخادم يجب أن يعرف مكان رمز الاسم: نجهّزه تلقائيًا قبل الطباعة (كان يُنسى فلا تُربط الأوراق بأسمائها)
  if(getApi() && getTok()){ try{ await omrSendTemplate(); }catch(e){} }
  const cls = document.getElementById('ex-named-cls')?.value || '';
  const L = STUDENTS.filter(s => s && s.id && s.name && (!cls || s.cls === cls)).sort((a, b) => String(a.cls||'').localeCompare(String(b.cls||''), 'ar') || String(a.name).localeCompare(String(b.name), 'ar'));
  if(!L.length){ toast('لا طلاب في هذا الفصل','bad'); return; }
  let salt = 0; for(; salt < 8; salt++){ const seen = new Set(L.map(s => omrStuHash(salt, s.id))); if(seen.size === L.length) break; }
  if(salt === 8){ toast('تعذّر توليد رموز مميزة — اطبع كل فصل وحده','bad'); return; }
  const count = Math.max(1, Math.min(6, Number(document.getElementById('ex-model-count')?.value) || 1));
  const sel = document.getElementById('ex-model'), keyEl = document.getElementById('ex-key');
  const keep = { model: sel ? sel.value : '0', key: !!(keyEl && keyEl.checked) }, originalHtml = box.innerHTML;
  const models = [];
  try{ if(keyEl) keyEl.checked = false;
    for(let m = 0; m < count; m++){ if(sel) sel.value = String(m); examBuild(true); models.push(box.innerHTML); } }
  catch(e){ box.innerHTML = originalHtml; toast('تعذّر تجهيز الأوراق','bad'); return; }
  finally{ if(sel) sel.value = keep.model; if(keyEl) keyEl.checked = keep.key; }
  // النماذج تتناوب على الطلاب (أ، ب، ج…) فلا يجلس متجاوران بالنموذج نفسه
  box.innerHTML = L.map((s, i) => { const t = document.createElement('div'); t.innerHTML = models[i % count];
    const bits = omrStuBits(salt, s.id);
    t.querySelectorAll('.ex-nm').forEach(e => e.textContent = s.name);
    t.querySelectorAll('.ex-ncls').forEach(e => e.textContent = s.cls || '');
    t.querySelectorAll('.ex-scode').forEach(e => [...e.children].forEach((c, k) => c.classList.toggle('on', !!bits[k])));
    return t.innerHTML; }).join('');
  toast(`تم تجهيز ${L.length} ورقة بأسماء الطلاب${count > 1 ? ' — النماذج متناوبة' : ''}`,'good');
  const restore = () => { box.innerHTML = originalHtml; examBuild(true); window.removeEventListener('afterprint', restore); };
  window.addEventListener('afterprint', restore);
  // 📁 اسم الملف المحفوظ (عنوان الصفحة) يحمل الفصل: «اختبار قصير - أوراق الأسماء - فصل 1-2» — و«/» لا تصلح في أسماء الملفات
  const clsName = cls ? 'فصل ' + String(cls).replace(/[\\/:*?"<>|]+/g, '-').trim() : 'كل الفصول';
  unifiedA4Print({ bodyClass:'printing-exam', title:(document.getElementById('ex-title')?.value || 'اختبار') + ' - أوراق الأسماء - ' + clsName, selector:'#exam-paper', orientation:'portrait', margin:'0' });
}
function printAllExamModels(){
  const box = document.getElementById('exam-paper');
  if(window._exSample){ toast('اختر الأسئلة أولًا — المعاينة الآن شكل القالب فقط','bad'); return; }
  const count = Math.max(1, Math.min(6, Number(document.getElementById('ex-model-count')?.value) || 1));
  const sel = document.getElementById('ex-model');
  if(!box || !box.querySelector('.ex-sec')){ toast('لا توجد فقرات للطباعة','bad'); return; }
  if(count <= 1){ printExam(); return; }

  const originalIndex = sel ? Math.max(0, Math.min(count - 1, Number(sel.value) || 0)) : 0;
  const originalHtml = box.innerHTML;
  const pages = [];

  try{
    for(let i=0;i<count;i++){
      if(sel) sel.value = String(i);
      examBuild(true);
      const html = box.innerHTML.trim();
      if(html) pages.push(html);
    }
  }catch(e){
    box.innerHTML = originalHtml;
    if(sel) sel.value = String(originalIndex);
    console.error(e);
    toast('تعذر تجهيز جميع النماذج للطباعة','bad');
    return;
  }

  if(!pages.length){
    box.innerHTML = originalHtml;
    if(sel) sel.value = String(originalIndex);
    toast('لا توجد نماذج للطباعة','bad');
    return;
  }

  box.innerHTML = pages.join('');
  toast(`تم تجهيز ${count} نماذج للطباعة دفعة واحدة`,'good');

  const restore = ()=>{
    box.innerHTML = originalHtml;
    if(sel){ sel.value = String(originalIndex); }
    examBuild(true);
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);

  unifiedA4Print({
    bodyClass: 'printing-exam',
    title: (document.getElementById('ex-title')?.value || 'اختبار') + ' - جميع النماذج',
    selector: '#exam-paper',
    orientation: 'portrait',
    margin: '0'
  });
}

function printGrades(){
  // 🏷️ الكشف كان يُطبع بلا ترويسة رسمية: نضيف الترويسة الموحّدة (تظهر في الطباعة فقط)
  const gt=document.getElementById('g-table');
  if(gt){ gt.querySelector('.g-print-head')?.remove(); const cls=document.getElementById('g-class')?.value||'';
    const d=document.createElement('div'); d.className='g-print-head'; d.innerHTML=repHead(cls&&cls!=='__all__'?'الفصل '+cls:'جميع الفصول','كشف درجات الأنشطة'); gt.prepend(d); }
  unifiedA4Print({
    bodyClass:'printing-grades',
    title:'كشف درجات الأنشطة',
    selector:'#g-table',
    orientation:'landscape',
    margin:'7mm'
  });
}

function printComprehensive(){
  const cls=String(document.getElementById('comp-class')?.value||'');
  unifiedA4Print({
    bodyClass:'printing-comprehensive',
    title:`الكشف الشامل لأعمال السنة${cls?' - '+cls:''}`,
    selector:'#comp-table',
    orientation:'portrait',
    margin:'7mm'
  });
}


function clearSearch(){
  const box = document.getElementById('students-center-search') || document.getElementById('st-search');
  if(box){ box.value = ''; (typeof renderStudentsCenter==='function'?renderStudentsCenter():renderStudents()); box.focus(); }
}
function stSort(k){
  if(STSORT.key === k) STSORT.dir = STSORT.dir === 'desc' ? 'asc' : 'desc';
  else { STSORT.key = k; STSORT.dir = (k==='name'||k==='cls') ? 'asc' : 'desc'; }
  renderStudents();
}

function award(id, n) {
  const s = byId(id); if (!s) return;
  s.points = Math.max(0, (s.points || 0) + n);
  save(K.st, STUDENTS); renderStudents(); updateMeta();
  // زامن الخادم ليرى الطالب رصيده الصحيح
  const api = getApi(), tok = getTok();
  if(api && tok){
    fetch(api + '/adjust', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ t: tok, name: s.name, delta: n }) }).catch(()=>{});
  }
}

function refreshCurrentViewAfterStudentChange(){
  // ⚡ تحديث أخف: نعيد رسم الواجهة الحالية فقط.
  // لا نعيد Dashboard / الدرجات / التحليل ما لم تكن هي الصفحة الظاهرة.
  const candidates = [
    ['students-list', renderStudents],
    ['students-center', renderStudentsCenter],
    ['grades-list', renderGrades],
    ['analysis', renderAnalysis],
    ['dashboard', renderDashboard],
    ['hw-list', renderHw]
  ];

  let updated = false;
  for(const [id, fn] of candidates){
    const el = document.getElementById(id);
    if(el && el.offsetParent !== null){
      try { fn(); updated = true; } catch(e) {
        console.error('student view refresh:', e);
      }
    }
  }

  // بعض الصفحات قد لا تحمل معرف الحاوية مباشرة، لذلك نحافظ على
  // التحديث الآمن للبيانات الوصفية فقط.
  if(!updated){
    try { updateMeta(); } catch(e) {}
  }
}
function refreshCurrentStudentViewImmediate(){
  const panel=document.getElementById('p-students');
  if(panel && panel.classList.contains('on')){
    renderStudentsCenter();
    const box=document.getElementById('students-center-list');
    if(box) void box.offsetHeight;
    return;
  }
  const active=document.querySelector('.panel.on');
  if(!active) return;
  try{
    if(active.id==='p-dashboard') renderDashboard();
    else if(active.id==='p-grades') renderGrades();
    else if(active.id==='p-analysis') renderAnalysis();
    else if(active.id==='p-hw') renderHw();
  }catch(e){ console.error('refreshCurrentStudentViewImmediate:',e); }
}

function patchStudentCenterNow(student, action='add'){
  const panel=document.getElementById('p-students');
  const box=document.getElementById('students-center-list');
  if(!panel || !box || !panel.classList.contains('on') || !student) return false;

  try{
    if(action==='delete'){
      const target=[...box.querySelectorAll('.student-list-item')].find(el =>
        el.dataset.studentId === String(student.id)
      );
      if(target) target.remove();
      void box.offsetHeight;
      return true;
    }

    // Prevent duplicates.
    const existing=[...box.querySelectorAll('.student-list-item')].find(el =>
      el.dataset.studentId === String(student.id)
    );
    if(existing) return true;

    const empty=box.querySelector('.feature-empty');
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='student-list-item';
    btn.dataset.studentId=String(student.id);
    btn.setAttribute('onclick', `selectStudentCenter('${esc(student.id)}',false)`);
    btn.innerHTML=`<span class="student-list-avatar">${esc(initials(student.name))}</span>
      <span class="student-list-main"><b>${esc(student.name)}</b>
      <small>${esc(student.cls||'بدون فصل')} · 0/0 تسليم</small></span>
      <span class="student-list-score good">0%</span>`;
    if(empty) box.innerHTML='';
    box.prepend(btn);

    const count=document.getElementById('students-center-count');
    if(count) count.textContent=`${STUDENTS.length} طالب`;

    // Force style/layout calculation so the browser commits the new DOM state.
    void btn.offsetHeight;
    return true;
  }catch(e){
    console.error('patchStudentCenterNow:',e);
    return false;
  }
}


function openStudentForm(id) {
  const s = id ? byId(id) : null;
  openModal(`
    <h2>${s ? 'تعديل طالب' : 'طالب جديد'}</h2>
    <div class="field"><label>الاسم</label>
      <input class="inp" id="f-name" value="${s ? esc(s.name) : ''}" placeholder="الاسم الكامل"></div>
    <div class="field"><label>الفصل</label>
      <input class="inp" id="f-cls" value="${s ? esc(s.cls || '') : ''}" placeholder="مثال: أول ١" list="cls-opts">
      <datalist id="cls-opts">${classes().map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn" onclick="saveStudent('${id || ''}')">حفظ</button>
    </div>`);
  setTimeout(() => document.getElementById('f-name').focus(), 60);
}

async function saveStudent(id) {
  const nameEl=document.getElementById('f-name');
  const clsEl=document.getElementById('f-cls');
  const name=nameEl ? nameEl.value.trim() : '';
  const cls=clsEl ? clsEl.value.trim() : '';
  if(!name){ toast('اكتب اسم الطالب','bad'); return; }

  if(!id && STUDENTS.some(s=>normAr(s.name)===normAr(name) && normAr(s.cls||'')===normAr(cls))){
    toast('الطالب موجود مسبقًا في هذا الفصل','bad');
    return;
  }

  if(id){
    const s=byId(id);
    if(!s){ toast('تعذر العثور على الطالب','bad'); return; }
    s.name=name;
    s.cls=cls;
  }else{
    STUDENTS.push({id:uid(),name,cls,points:0});
  }

  save(K.st,STUDENTS);
  closeModal();

  // ⚡ عند الإضافة: أضف العنصر نفسه مباشرة إلى القائمة الظاهرة.
  // لا نعيد بناء القائمة كاملة في نفس لحظة الضغط، حتى لا يتأخر ظهور الاسم.
  const changedStudent = id ? byId(id) : STUDENTS[STUDENTS.length - 1];
  if(!id && changedStudent){
    patchStudentCenterNow(changedStudent, 'add');
    // أولاً يظهر الاسم فورًا، ثم نعيد تطبيق الفرز/الفلاتر بعد الرسم.
    void document.getElementById('students-center-list')?.offsetHeight;
    setTimeout(() => {
      const panel=document.getElementById('p-students');
      if(panel && panel.classList.contains('on')) renderStudentsCenter();
    }, 0);
  }else{
    refreshCurrentStudentViewImmediate();
  }

  updateMeta();
  toast(id?'حُفظ التعديل':'أُضيف الطالب','good');

  // ☁️ المزامنة مع الخادم في الخلفية.
  const api=getApi(), tok=getTok();
  if(api && tok){
    beginLocalMutation();
    pushStateNow()
      .catch(error => {
        toast('تم الحفظ محليًا، لكن تعذر رفع التعديل للخادم','bad');
        console.error('saveStudent sync:',error);
      })
      .finally(() => endLocalMutation());
  }
}

function delStudent(id) {
  const s = byId(id); if (!s) return;
  openModal(`<h2>حذف ${esc(s.name)}؟</h2>
    <p style="color:var(--ink-soft)">يُحذف رصيده وبطاقاته. لا يمكن التراجع.</p>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إبقاء</button>
      <button class="btn pen" onclick="doDelStudent('${id}')">حذف</button>
    </div>`);
}
async function doDelStudent(id) {
  const st = byId(id);
  const nm = st ? st.name : '';
  if(!st){ closeModal(); return; }

  // احذف محليًا أولًا حتى يختفي الطالب فورًا من الواجهة.
  STUDENTS = STUDENTS.filter(s => s.id !== id);
  delete PERKS[id];
  HW.forEach(h => { if (h.subs) delete h.subs[id]; });
  if(String(STUDENT_CENTER_SELECTED)===String(id)) STUDENT_CENTER_SELECTED=null;

  save(K.st, STUDENTS);
  save(K.perks, PERKS);
  save(K.hw, HW);
  closeModal();

  // ⚡ احذف العنصر من القائمة مباشرة.
  patchStudentCenterNow(st, 'delete');
  const studentsBox=document.getElementById('students-center-list');
  if(studentsBox) void studentsBox.offsetHeight;
  updateMeta();

  // ☁️ الحذف من الخادم — المزامنة موقوفة حتى ينتهي
  beginLocalMutation();
  try{
    const done = await removeFromServer([nm], [id]);
    // ادفع اللقطة المحدَّثة كي لا يعود عند أي مزامنة لاحقة
    if(done) { try{ await pushStateNow(); }catch(e){} }
  } finally {
    endLocalMutation();
  }
}

/* 🚫 إزالة أسماء من الأنشطة المنشورة على الخادم */
async function removeFromServer(names, ids){
  const api = getApi(), tok = getTok();
  if (!api || !tok) { toast('حُذف من هذا الجهاز فقط — اضبط الخادم للحذف النهائي', 'bad'); return false; }
  try {
    const r = await fetch(api + '/removestudent', { method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ t: tok, names, ids: ids || [] }) });
    const j = await r.json();
    syncAbsorbSavedAt(j);   // 🔑 لا تعارض وهمي بعد هذه العملية
    if(j.ok){
      toast(names.length === 1 ? 'حُذف الطالب نهائياً من الخادم'
                               : `حُذف ${names.length} طالب نهائياً`, 'good');
    } else {
      toast('⚠️ حُذف من هذا الجهاز — لم يُحذف من الخادم', 'bad');
    }
    renderStudentsCenter();
    renderDashboard();
    return !!j.ok;
  } catch(e) {
    toast('⚠️ حُذف من هذا الجهاز — تعذّر الاتصال بالخادم', 'bad');
    return false;
  }
}

// 🗑️ حذف كل الطلاب المعروضين (يحترم فلتر الفصل)
function delMany() {
  // القائمة المعروضة فعلًا في مركز الطلاب (م2): filtered() يطابق بمنطق «كل كلمة» المختلف عن عرض القائمة
  const shown = Array.isArray(window.STC_LIST) ? window.STC_LIST : null;
  const list = shown
    ? shown.map(id => STUDENTS.find(s => String(s.id) === String(id))).filter(Boolean)
    : filtered();
  if (!list.length) { toast('لا يوجد طلاب لحذفهم'); return; }
  const clsEl = document.getElementById('students-center-class') || document.getElementById('class-filter');
  const cls = clsEl ? clsEl.value : '';
  const where = (!cls || cls === '__all__') ? 'كل الفصول' : `فصل "${cls}"`;
  const box = document.getElementById('students-center-search') || document.getElementById('st-search');
  const qRaw = box ? box.value.trim() : '';
  const ids = list.map(s => s.id);
  openModal(`<h2>حذف ${list.length} طالب؟</h2>
    <p style="color:var(--ink-soft)">سيُحذف ${list.length} طالبًا${qRaw ? ` مطابقًا للبحث «${esc(qRaw)}»` : ''} من ${esc(where)} مع أرصدتهم وبطاقاتهم وتسليماتهم.
    لا يمكن التراجع — صدّر نسخة احتياطية أولاً.</p>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn pen" onclick="doDelMany('${ids.join(',')}')">نعم، احذفهم</button>
    </div>`);
}

async function doDelMany(idsStr) {
  const ids = String(idsStr).split(',').filter(Boolean);
  const set = {}; ids.forEach(i => set[i] = 1);
  const names = STUDENTS.filter(s => set[s.id]).map(s => s.name);
  STUDENTS = STUDENTS.filter(s => !set[s.id]);
  ids.forEach(i => { delete PERKS[i]; });
  HW.forEach(h => { if (h.subs) ids.forEach(i => { delete h.subs[i]; }); });
  save(K.st, STUDENTS); save(K.perks, PERKS); save(K.hw, HW);
  closeModal(); renderAll();
  if (!names.length) { toast(`حُذف ${ids.length} طالب`); return; }
  beginLocalMutation();
  try {
    const done = await removeFromServer(names, ids);
    if(done) { try{ await pushStateNow(); }catch(e){} }
  } finally { endLocalMutation(); }
}


async function importStudentsFile(ev){
  const f = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if(!f) return;
  const ext = (f.name.split('.').pop()||'').toLowerCase();
  if(!['xlsx','xls'].includes(ext)){
    toast('هذا المكان مخصص لملفات Excel فقط (.xlsx / .xls). لملفات JSON استخدم قسم استيراد JSON.','bad');
    return;
  }
  toast('جارٍ قراءة ملف Excel…');
  try{
    let records = [];
    if(ext === 'xlsx' || ext === 'xls'){
      records = await readExcelStudentRecords(f);
      const fallbackClass = String((document.getElementById('imp-cls')||{}).value || '')
        .replace(/\s+/g,' ').trim();
      if(fallbackClass){
        records = records.map(record => ({
          name: record.name,
          cls: String(record.cls||'').trim() || fallbackClass
        }));
      }
    } else if(ext === 'pdf'){
      records = (await readPdfNames(f)).map(name=>({name, cls:''}));
    } else if(ext === 'json'){
      records = (await readJsonNames(f)).map(name=>({name, cls:''}));
    } else {
      records = readTextNames(await f.text()).map(name=>({name, cls:''}));
    }

    const seen = new Set();
    const out = [];
    records.forEach(record=>{
      const name = String(record.name||'').replace(/\s+/g,' ').trim();
      const cls = String(record.cls||'').replace(/\s+/g,' ').trim();
      const key = normAr(name);
      if(!key || seen.has(key)) return;
      seen.add(key);
      out.push({name, cls});
    });

    if(!out.length){
      toast('لم أجد أسماء في الملف — جرّب اللصق المباشر','bad');
      return;
    }
    reviewImportedNames(out, f.name);
  }catch(e){
    console.error(e);
    const msg = e && e.message === 'net'
      ? 'تعذّر تحميل قارئ الملف — تحقق من الإنترنت'
      : 'تعذّرت قراءة الملف — جرّب حفظه بصيغة CSV أو الصق الأسماء';
    toast(msg, 'bad');
  }
}

/* 🔤 PDF العربي يخزّن الحروف منفصلة ومعكوسة —
   نعيد بناء السطر من إحداثيات كل حرف (يمين ← يسار) */
function arFix(str){
  // حوّل أشكال العرض (FE70-FEFF / FB50-FDFF) إلى حروف عادية
  try { return String(str||'').normalize('NFKC'); } catch(e){ return String(str||''); }
}

function buildRtlLine(items){
  // الأبعد يميناً أولاً
  const sorted = items.slice().sort((a,b)=> b.x - a.x);
  // متوسط عرض الحرف لتقدير فاصل الكلمة
  const widths = sorted.map(i=>i.w).filter(w=>w>0).sort((a,b)=>a-b);
  const med = widths.length ? widths[Math.floor(widths.length/2)] : 6;
  let out = '';
  for(let i=0;i<sorted.length;i++){
    const cur = sorted[i];
    out += arFix(cur.s);
    const nxt = sorted[i+1];
    if(nxt){
      // الفجوة = المسافة بين نهاية التالي (يساراً) وبداية الحالي
      const gap = cur.x - (nxt.x + nxt.w);
      if(gap > med * 0.6) out += ' ';
    }
  }
  return out.replace(/\s+/g,' ').trim();
}

async function readPdfNames(file){
  await loadLib('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
                ()=> typeof pdfjsLib !== 'undefined');
  try{ pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; }catch(e){}
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const lines = [];
  for(let p=1; p<=pdf.numPages; p++){
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const rows = {};
    tc.items.forEach(it=>{
      const tr = it.transform || [];
      const y = Math.round(tr[5] || 0);
      const key = Math.round(y / 3) * 3;          // اجمع المتقارب في سطر واحد
      (rows[key] = rows[key] || []).push({
        s: it.str, x: tr[4] || 0, w: it.width || 0
      });
    });
    Object.keys(rows).sort((a,b)=>b-a)
      .forEach(k => lines.push(buildRtlLine(rows[k])));
  }
  return lines.map(cleanNameLine).filter(looksLikeName);
}

async function readJsonNames(file){
  const d = JSON.parse(await file.text());
  const out = [];
  const walk = v => {
    if(!v) return;
    if(Array.isArray(v)) return v.forEach(walk);
    if(typeof v === 'object'){
      if(typeof v.name === 'string' && looksLikeName(v.name)) out.push(v.name);
      return Object.values(v).forEach(walk);
    }
  };
  walk(d);
  return out;
}

// ينظّف السطر: يزيل الترقيم والسجل المدني والفواصل
function cleanNameLine(line){
  let t = String(line||'')
    // ترقيم أول السطر — عربي أو هندي
    .replace(/^[\s\u0660-\u0669\d]+\s*[-.):\t\u060C]?\s*/, '')
    .replace(/[\d\u0660-\u0669]{6,}/g, '')       // أرقام هوية (عربية أو هندية)
    .replace(/[|\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

function readTextNames(txt){
  return String(txt||'').split(/\r?\n/)
    .map(l=>{
      const cells = l.split(/[\t,;]/).map(x=>x.trim()).filter(Boolean);
      if(cells.length > 1){
        const hit = cells.find(looksLikeName);
        return hit ? cleanNameLine(hit) : '';
      }
      return cleanNameLine(l);
    })
    .filter(looksLikeName);
}

/* 👁️ مراجعة قبل الإضافة — لا استيراد أعمى */
let IMPORT_BUFFER = [];
function reviewImportedNames(records, fileName){
  IMPORT_BUFFER = records;

  const fallbackCls = (document.getElementById('imp-cls')||{}).value || '';
  const detectedClasses = [...new Set(
    records.map(x=>String(x.cls||'').trim()).filter(Boolean)
  )];

  const dup = records.filter(r =>
    STUDENTS.some(s => normAr(s.name) === normAr(r.name))
  );

  const rows = records.map((r,i)=>`
    <div class="ruled" style="padding:.55rem .8rem">
      <div class="row">
        <span class="name">${esc(r.name)}</span>
        <span class="pill ${r.cls?'quiet':'due'}">${esc(r.cls || 'الصف غير محدد')}</span>
        <button class="btn ghost sm" type="button" onclick="editImportedClass(${i})">تعديل</button>
      </div>
    </div>`).join('');

  openModal(`
    <h2>📥 مراجعة الأسماء والصف</h2>
    <p style="color:var(--ink-soft);font-size:.86rem;margin:.15rem 0 .7rem">
      من «${esc(fileName)}» — وجدت <b>${records.length}</b> اسماً
      ${detectedClasses.length
        ? ` · تم التعرف تلقائياً على: <b>${esc(detectedClasses.join('، '))}</b>`
        : ' · لم أجد الصف تلقائياً'}
      ${dup.length ? ` · <b style="color:#C88A2E">${dup.length} مكرر</b> سيُتجاهل` : ''}
    </p>
    <div class="field">
      <label>صف افتراضي للأسماء التي لا يوجد لها صف</label>
      <input class="inp" id="imp-cls2" value="${esc(fallbackCls)}"
        placeholder="مثال: الأول المتوسط - 2">
    </div>
    <div class="field" style="margin:0">
      <label>الأسماء والصفوف المكتشفة</label>
      <div id="imp-list" style="max-height:48vh;overflow:auto">${rows}</div>
    </div>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn" onclick="confirmImportNames()">أضف الطلاب</button>
    </div>`);
}

function editImportedClass(index){
  const record=IMPORT_BUFFER[index];
  if(!record) return;
  const value=prompt('اكتب الصف/الفصل لهذا الطالب:',record.cls||'');
  if(value===null) return;
  record.cls=value.trim();
  reviewImportedNames(IMPORT_BUFFER,'الملف الحالي');
}

function confirmImportNames(){
  const fallback=(document.getElementById('imp-cls2')||{}).value || '';
  const records=IMPORT_BUFFER.map(r=>({
    name:String(r.name||'').trim(),
    cls:String(r.cls||'').trim() || fallback.trim()
  })).filter(r=>r.name);

  if(!records.length){toast('لا أسماء','bad');return;}

  let added=0,skipped=0;
  const seen=new Set();

  records.forEach(record=>{
    const key=normAr(record.name);
    if(!key || seen.has(key)){
      skipped++;
      return;
    }
    if(STUDENTS.some(s=>normAr(s.name)===key)){
      skipped++;
      return;
    }
    seen.add(key);
    STUDENTS.push({
      id:uid(),
      name:record.name,
      cls:record.cls,
      points:0
    });
    added++;
  });

  save(K.st,STUDENTS);
  closeModal();
  renderAll();
  toast(
    added
      ? `أُضيف ${added} طالب${skipped?` · تُجوهل ${skipped} مكرر`:''}`
      : 'كل الأسماء موجودة مسبقاً',
    added?'good':'bad'
  );
}

function openBulkAdd() {
  openModal(`
    <h2>إضافة دفعة</h2>
    <div class="field"><label>الفصل</label>
      <input class="inp" id="b-cls" placeholder="مثال: أول ١"></div>
    <div class="field"><label>الأسماء — اسم في كل سطر، أو الصق عموداً من إكسل</label>
      <textarea class="inp" id="b-names" rows="8" placeholder="محمد أحمد الفرحان&#10;عبدالله سالم القحطاني&#10;&#10;أو الصق من إكسل مباشرة (يتجاهل الأرقام والأعمدة الزائدة)"></textarea>
      <span style="font-size:.78rem;color:var(--ink-soft);margin-top:.25rem;display:block">
        يتعرّف على اللصق من إكسل: يتجاهل عمود «م» والأعمدة الأخرى ويأخذ الأسماء فقط</span></div>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn" onclick="saveBulk()">إضافة</button>
    </div>`);
}
function saveBulk() {
  const cls = document.getElementById('b-cls').value.trim();
  const raw = document.getElementById('b-names').value;
  const names = raw.split('\n').map(line=>{
    let t = line.trim(); if(!t) return '';
    // لصق من إكسل: أعمدة مفصولة بـ Tab → خذ أطول عمود عربي
    if(t.indexOf('\t') !== -1){
      const cols = t.split('\t').map(c=>c.trim()).filter(Boolean);
      const arabic = cols.filter(c=>/[\u0600-\u06FF]/.test(c) && c.split(/\s+/).length >= 2);
      t = (arabic.sort((a,b)=>b.length-a.length)[0]) || cols[0] || '';
    }
    t = t.replace(/^\s*\d+\s*[-.．)]?\s*/, '');   // احذف الترقيم في أول السطر
    return t.trim();
  }).filter(x=>x && /[\u0600-\u06FF]/.test(x));
  if (!names.length) { toast('اكتب اسماً واحداً على الأقل', 'bad'); return; }
  let added = 0;
  names.forEach(n => {
    if (STUDENTS.some(s => s.name === n && s.cls === cls)) return;
    STUDENTS.push({ id: uid(), name: n, cls, points: 0 }); added++;
  });
  save(K.st, STUDENTS); closeModal();
  refreshCurrentViewAfterStudentChange();
  updateMeta();
  toast(`أُضيف ${added} طالب`, 'good');
}

function hwPickKind(v){
  const sel=document.getElementById('h-kind');
  // نشاط نافس جديد: تدريب بلا درجة افتراضيًا (ويعود الاحتساب عند اختيار نوع آخر)
  if(sel && sel.dataset.new==='1' && (v==='nafs') !== (sel.value==='nafs')){ const g=document.getElementById('h-grade'); if(g) g.checked = v!=='nafs'; }
  if(sel) sel.value=v;
  document.querySelectorAll('.kind-tile').forEach(b=>
    b.setAttribute('aria-pressed', b.dataset.kind===v ? 'true' : 'false'));
  hwKindChanged();
}

/* 📋 قوالب الصياغة: فعل واحد واضح · ما يُسلَّم بالعدد · معيار قبول قابل للفحص. */
const BRIEF_TEMPLATES = {
  science: { brief:'نفّذ التجربة في المنزل، وصوّر لحظة حدوث التغير، واشرح في سطرين ما الذي لاحظته.',
             deliver:'صورة واحدة + سطران شرحًا · أو مقطع لا يتجاوز 45 ثانية',
             accept:'ظهر التغير في الصورة أو المقطع، وذكرتَ دليلاً واحدًا على حدوثه' },
  observe: { brief:'ابحث عن مثال لهذه الظاهرة حولك، وصوّره، واشرح علاقته بما درسناه.',
             deliver:'صورة واحدة + سطران يربطان المثال بالدرس',
             accept:'المثال حقيقي من محيطك، والربط بالدرس مذكور بوضوح' },
  build:   { brief:'اصنع نموذجًا بسيطًا يمثّل ما درسناه من خامات متوفرة في البيت، وصوّره.',
             deliver:'صورتان: النموذج كاملاً، وأنت تشرحه · أو مقطع 45 ثانية',
             accept:'النموذج من صنعك، وأجزاؤه الرئيسة ظاهرة ومسمّاة' }
};
async function briefTemplate(k){
  const t = BRIEF_TEMPLATES[k]; if(!t) return;
  const ids=['h-brief','h-deliver','h-accept'], vals=[t.brief,t.deliver,t.accept];
  const filled = ids.some(id=>(document.getElementById(id)?.value||'').trim());
  // نسأل مرة واحدة عن الحقول الثلاثة لا ثلاث مرات
  if(filled && !(await askConfirm('سيُستبدل ما كتبتَه في حقول المهمة بنص القالب.',
      {title:'استبدال بالقالب؟', yes:'استبدل', no:'إبقاء ما كتبت'}))) return;
  ids.forEach((id,i)=>{ const e=document.getElementById(id); if(e) e.value=vals[i]; });
}
function illusSet(k){
  const inp=document.getElementById('h-illus'); if(inp) inp.value=(illusImg(k)||illusSvg(k))?k:'';
  illusPrev();
}
async function projTemplate(i){
  const sel=document.getElementById('h-proj-tpl'), t=PROJ_TEMPLATES[Number(i)];
  if(!t || i===''){ return; }
  const ids=['h-title','h-brief','h-deliver','h-accept'], vals=[t.t,t.b,t.v,t.a];
  const filled=ids.some(id=>(document.getElementById(id)?.value||'').trim());
  if(filled && !(await askConfirm('سيُستبدل العنوان وحقول المهمة بنص المشروع الجاهز.',{title:'استبدال بالمشروع؟',yes:'استبدل',no:'إبقاء ما كتبت'}))){ if(sel) sel.value=''; return; }
  ids.forEach((id,k)=>{ const e=document.getElementById(id); if(e) e.value=vals[k]; });
  illusSet(t.il||'');
  const pg=document.getElementById('h-project-grade'); if(pg) pg.checked=true;
  const due=document.getElementById('h-due');
  if(due && !due.value){ const d=new Date(); d.setDate(d.getDate()+t.n); due.value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  if(sel) sel.value='';
  toast('✓ عُبّئ المشروع — اختر الفصل ثم احفظ','good');
}
const READING_DEMO_TEMPLATE = {
  title: 'كيف تتكيف الكائنات الحية مع بيئاتها؟',
  text: `تعيش الكائنات الحية في بيئات مختلفة، ولكل بيئة ظروفها الخاصة من حيث درجة الحرارة والماء والغذاء. لذلك تمتلك الكائنات الحية صفات تساعدها على البقاء في بيئاتها.

فعلى سبيل المثال، يمتلك الجمل أقدامًا عريضة تساعده على المشي فوق الرمال، كما يستطيع تحمل العطش لفترة طويلة. أما الدب القطبي فيعيش في بيئة شديدة البرودة، ويمتلك طبقة سميكة من الدهون تساعد جسمه على الاحتفاظ بالحرارة.

وتسمى الصفات التي تساعد الكائن الحي على البقاء والتكاثر في بيئته التكيفات. وقد يكون التكيف في شكل الجسم، أو في طريقة الحصول على الغذاء، أو في السلوك.`,
  stages: ['pre','during','post','apply'],
  requireAttachment: false,
  max: 20,
  pts: 50,
  qs: [
    {t:'q', stage:'pre', q:'من عنوان النص، ما الذي تتوقع أن يتحدث عنه النص؟', o:['طرق تكيف الكائنات الحية مع بيئاتها','أنواع الصخور','دورة الماء','طبقات الأرض'], a:0},
    {t:'f', stage:'pre', q:'أتوقع أن تختلف صفات الكائنات الحية لأن ________.', a:'البيئات تختلف في ظروفها'},
    {t:'q', stage:'during', q:'لماذا يمتلك الجمل أقدامًا عريضة؟', o:['ليساعِده ذلك على المشي فوق الرمال','ليساعِده على السباحة','ليحافظ على حرارة جسمه','ليحصل على الغذاء'], a:0},
    {t:'q', stage:'during', q:'ما العلاقة بين البيئة وصفات الكائن الحي كما وردت في النص؟', o:['البيئة لا تؤثر في صفات الكائنات','صفات الكائن تساعده على البقاء في بيئته','جميع الكائنات تمتلك الصفات نفسها','الكائن يغير البيئة حتى يستطيع البقاء'], a:1},
    {t:'f', stage:'during', q:'يمتلك الدب القطبي طبقة سميكة من الدهون تساعده على ________.', a:'الاحتفاظ بالحرارة'},
    {t:'q', stage:'post', q:'إذا عاش حيوان في بيئة شديدة البرودة، فأي صفة ستكون أكثر فائدة له؟', o:['طبقة عازلة تساعد على الاحتفاظ بالحرارة','أقدام طويلة جدًا','جلد رقيق جدًا','فقدان الماء بسرعة'], a:0},
    {t:'q', stage:'post', q:'ما المقصود بالتكيف اعتمادًا على النص؟', o:['صفة تساعد الكائن الحي على البقاء والتكاثر في بيئته','انتقال الحيوان من مكان إلى آخر','تغير درجة حرارة البيئة','حصول الحيوان على الغذاء فقط'], a:0},
    {t:'f', stage:'post', q:'إذا كان حيوان يعيش في بيئة شديدة الجفاف ولديه قدرة عالية على الاحتفاظ بالماء، فهذا يدل على أنه متكيف مع ________.', a:'البيئة الجافة'},
    {t:'a', stage:'apply', w:'التكيف', h:'صفة تساعد الكائن الحي على البقاء في بيئته'},
    {t:'f', stage:'apply', q:'اختر كائنًا حيًا، ثم اذكر تكيفًا واحدًا لديه يساعده على البقاء: ________.', a:'إجابة الطالب'},
  ]
};

function readingDemoTemplate(){
  const title=document.getElementById('h-title');
  const kind=document.getElementById('h-kind');
  if(kind) { kind.value='reading'; hwKindChanged(); }
  if(title) title.value=READING_DEMO_TEMPLATE.title;
  const text=document.getElementById('h-reading-text'); if(text) text.value=READING_DEMO_TEMPLATE.text;
  document.querySelectorAll('#h-reading-wrap .rd-stage').forEach(e=>e.checked=READING_DEMO_TEMPLATE.stages.includes(e.value));
  const att=document.getElementById('h-reading-attach'); if(att) att.checked=READING_DEMO_TEMPLATE.requireAttachment;
  const max=document.getElementById('h-max'); if(max) max.value=READING_DEMO_TEMPLATE.max;
  const pts=document.getElementById('h-pts'); if(pts) pts.value=READING_DEMO_TEMPLATE.pts;
  window.__readingDemoQs = READING_DEMO_TEMPLATE.qs.map(q=>JSON.parse(JSON.stringify(q)));
  toast('تمت تعبئة قالب الفهم القرائي التجريبي. احفظ النشاط ثم افتح «المهام» لمراجعة الأسئلة.', 'good');
}

function openReadingTemplateHelp(){
  openModal(`
    <h2>📖 كيف سيظهر القالب للطالب؟</h2>
    <div class="sheet" style="line-height:1.9">
      <p><b>1. 🎯 قبل القراءة</b><br>سؤال توقع وتنشيط المعرفة السابقة.</p>
      <p><b>2. 📖 أثناء القراءة</b><br>النص القرائي ثم أسئلة مباشرة لفهم المعلومات والعلاقات.</p>
      <p><b>3. 🧠 بعد القراءة</b><br>أسئلة استنتاج وتحليل وربط.</p>
      <p><b>4. 🔬 التطبيق</b><br>مهمة قصيرة تستخدم فيها ما فهمه الطالب في موقف جديد.</p>
      <p class="muted">الطالب ينتقل سؤالًا سؤالًا، ويظهر له اسم المرحلة أعلى كل سؤال مع شريط التقدم.</p>
    </div>
    <div class="modal-foot"><button class="btn" onclick="closeModal()">فهمت</button></div>`);
}
function hwClsPickerRead(id){
  const box=document.getElementById(id); if(!box) return { cls:'', clsList:[] };
  const picked=[...box.querySelectorAll('input:not([data-all]):checked')].map(c=>c.value);
  const all=classes();
  if(!picked.length || (all.length>1 && picked.length===all.length)) return { cls:'', clsList:[] };      // الكل
  if(picked.length===1) return { cls:picked[0], clsList:[] };                                             // فصل واحد: كما كان
  return { cls:'', clsList:picked };                                                                       // عدة فصول
}

function saveHw(id) {
  let title = document.getElementById('h-title').value.trim();
  const { cls, clsList } = hwClsPickerRead('h-cls');
  const due = document.getElementById('h-due').value;
  const pickedKind = (document.getElementById('h-kind')||{}).value || 'normal';
  // 🧭 نافس: أسئلة الأقسام المختارة من بنك نافس، ثم يُحفظ النشاط «عاديًا» بقائمة أقسامه
  let nafsSel = null;
  if(pickedKind==='nafs'){
    nafsSel = typeof nafsFormRead==='function' ? nafsFormRead() : null;
    if(!nafsSel || !nafsSel.secs.length){ toast('اختر قسمًا واحدًا على الأقل من أقسام نافس', 'bad'); return; }
    if(!nafsSel.qs.length){ toast('لا أسئلة تُصحَّح آليًا في الأقسام المختارة', 'bad'); return; }
    if(!title) title = nafsSel.title;
    const old = id && HW.find(x=>x.id===id);
    const same = old && Array.isArray(old.nafs) && old.nafs.slice().sort().join()===nafsSel.secs.slice().sort().join();
    if(old && !same && Object.keys(old.subs||{}).length){ toast('حلّ طلاب هذا النشاط — لا يمكن تغيير أقسام نافس الآن. أنشئ نشاط نافس جديدًا.', 'bad'); return; }
    // الأقسام نفسها: إن لم يحلّه أحد تُحدَّث أسئلته من البنك (فتدخل الأسئلة المولّدة أو المضافة بعده)، وإلا تبقى كما هي
    if(same && Object.keys(old.subs||{}).length){ nafsSel.keep = true;
      const have=new Set((old.qs||[]).map(q=>q&&q.nafs)), fresh=nafsSel.qs.filter(q=>!have.has(q.nafs)).length;
      if(fresh) toast(`حلّ طلاب هذا النشاط فبقيت أسئلته كما هي — ${fresh} ${fresh===1?'سؤال جديد':'أسئلة جديدة'} في البنك تدخل في نشاط نافس جديد`,'warn'); }
  }
  const kind = pickedKind==='nafs' ? 'normal' : pickedKind;
  const pts = (kind==='normal' || kind==='reading' || kind==='lab') ? Math.max(1, +document.getElementById('h-pts').value || 50) : 0;
  const max = (kind==='normal' || kind==='reading' || kind==='lab') ? Math.max(1, +document.getElementById('h-max').value || 20) : 0;
  let lab = null;
  if(kind==='lab'){
    const ltopic=(document.getElementById('h-lab-topic')||{}).value||'mixtures';
    const la=ltopic==='mixtures'?((document.getElementById('h-lab-a')||{}).value||''):'', lb=ltopic==='mixtures'?((document.getElementById('h-lab-b')||{}).value||''):'';
    if((la && !lb) || (!la && lb)){ toast('اختر المادتين معًا، أو اتركهما فارغين للاختيار الحر', 'bad'); return; }
    if(la && la===lb){ toast('اختر مادتين مختلفتين', 'bad'); return; }
    lab = { topic:(document.getElementById('h-lab-topic')||{}).value||'mixtures', pair: la ? [la, lb] : null };
  }
  const projectGraded = kind==='files' ? !!document.getElementById('h-project-grade')?.checked : false;
  const noGrade = GRADE_KINDS.includes(kind) && !document.getElementById('h-grade')?.checked;
  // 📋 وصف المهمة — لنشاط الملفات فقط، والأنشطة القديمة تبقى كما هي
  const brief   = kind==='files' ? (document.getElementById('h-brief')?.value||'').trim()   : '';
  const illus   = kind==='files' ? (document.getElementById('h-illus')?.value||'') : '';
  const deliver = kind==='files' ? (document.getElementById('h-deliver')?.value||'').trim() : '';
  const accept  = kind==='files' ? (document.getElementById('h-accept')?.value||'').trim()  : '';
  const reading = kind==='reading' ? {
    text: (document.getElementById('h-reading-text')?.value||'').trim(),
    stages: [...document.querySelectorAll('#h-reading-wrap .rd-stage:checked')].map(e=>e.value),
    requireAttachment: !!document.getElementById('h-reading-attach')?.checked,
    pv: Array.isArray(window.__readingAIQs) ? 2 : ((((id && HW.find(x=>x.id===id))||{}).reading||{}).pv || 0),
    vocab: (window.__readingAIMeta && Array.isArray(window.__readingAIMeta.vocab))
      ? window.__readingAIMeta.vocab
      : ((id && ((HW.find(x=>x.id===id)||{}).reading||{}).vocab) || [])
  } : null;
  if (!title) { toast('اكتب عنوان النشاط', 'bad'); return; }
  if (kind==='reading' && !reading.text) { toast('اكتب النص القرائي أولاً', 'bad'); return; }
  if (kind==='reading' && !reading.stages.length) { toast('اختر مرحلة واحدة على الأقل', 'bad'); return; }
  if (id) {
    const h = HW.find(x => x.id === id);
    Object.assign(h, { title, cls, clsList, due, pts, max, kind, noGrade, projectGraded, brief, illus, deliver, accept, reading, lab });
    if(nafsSel){ h.nafs = nafsSel.secs; h.nfMode = nafsSel.mode; h.nfSec = nafsSel.sec; if(!nafsSel.keep) h.qs = nafsSel.qs; }
    else if(pickedKind!=='nafs' && Array.isArray(h.nafs)) delete h.nafs;   // غيّر المعلم النوع: تبقى الأسئلة ويزول وسم نافس
    if(kind==='reading' && Array.isArray(window.__readingAIQs)){
      h.qs = window.__readingAIQs.map(q=>JSON.parse(JSON.stringify(q)));
      delete window.__readingAIQs; delete window.__readingAIMeta;
    }
    if(h.published) h.dirty = true;
  } else {
    const newH = { id: uid(), title, cls, clsList, due, pts, max, kind, noGrade, projectGraded, brief, illus, deliver, accept, reading, lab, subs: {}, at: Date.now() };
    if(kind==='games') newH.game = {type:'memory', data:[]};
    if(nafsSel){ newH.nafs = nafsSel.secs; newH.nfMode = nafsSel.mode; newH.nfSec = nafsSel.sec; newH.qs = nafsSel.qs; }
    if(kind==='reading' && Array.isArray(window.__readingDemoQs)){ newH.qs = window.__readingDemoQs.map(q=>JSON.parse(JSON.stringify(q))); delete window.__readingDemoQs; }
    if(kind==='reading' && Array.isArray(window.__readingAIQs)){ newH.qs = window.__readingAIQs.map(q=>JSON.parse(JSON.stringify(q))); delete window.__readingAIQs; delete window.__readingAIMeta; }
    HW.push(newH);
  }
  save(K.hw, HW); closeModal(); renderHw();
  toast(id ? 'حُفظ التعديل' : 'أُنشئ النشاط', 'good');
}

/* 🩹 نشاط علاجي: يجمع المهام التي أخطأ فيها الفصل */
function remedialHw(id){
  const h = HW.find(x=>x.id===id); if(!h) return;
  const qs = h.qs || [];
  const pool = hwPool(h);

  // نسبة الخطأ لكل مهمة
  const wrong = qs.map(()=>0), tot = qs.map(()=>0);
  Object.entries(h.subs||{}).forEach(([sid,v])=>{
    if(!pool.some(x=>x.id===sid)) return;
    const d = String(v.d||''); if(d.length !== qs.length) return;
    for(let i=0;i<qs.length;i++){ tot[i]++; if(d[i]==='0') wrong[i]++; }
  });
  const ranked = qs.map((q,i)=>({ q, i, pct: tot[i] ? Math.round(wrong[i]/tot[i]*100) : 0, n:tot[i] }))
                   .filter(x=>x.n>0 && x.pct>0)
                   .sort((a,b)=>b.pct-a.pct);

  if(!ranked.length){ toast('لا أخطاء في هذا النشاط — لا حاجة لعلاجي', 'good'); return; }

  openModal(`
    <h2>🩹 نشاط علاجي من «${esc(h.title)}»</h2>
    <p style="color:var(--ink-soft);font-size:.86rem;margin:.2rem 0 .8rem">
      يجمع المهام التي أخطأ فيها طلابك. اختر حد الخطأ:</p>
    <div class="field"><label>ضمّ المهام التي أخطأ فيها أكثر من</label>
      <select class="inp" id="rm-th" onchange="rmPreview('${id}')">
        <option value="25">25% من الطلاب</option>
        <option value="50" selected>50% من الطلاب</option>
        <option value="75">75% من الطلاب</option>
        <option value="0">أي نسبة (كل ما فيه خطأ)</option>
      </select></div>
    <div class="field"><label>عنوان النشاط العلاجي</label>
      <input class="inp" id="rm-title" value="مراجعة — ${esc(h.title)}"></div>
    <div class="field" style="margin:0"><label>موعد الإغلاق</label>
      <input class="inp" type="date" id="rm-due"></div>
    <div id="rm-prev" class="muted" style="font-size:.85rem;margin-top:.7rem"></div>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn tick" onclick="doRemedial('${id}')">أنشئ</button>
    </div>`);
  rmPreview(id);
}

function rmRanked(h){
  const qs = h.qs || [];
  const pool = hwPool(h);
  const wrong = qs.map(()=>0), tot = qs.map(()=>0);
  Object.entries(h.subs||{}).forEach(([sid,v])=>{
    if(!pool.some(x=>x.id===sid)) return;
    const d = String(v.d||''); if(d.length !== qs.length) return;
    for(let i=0;i<qs.length;i++){ tot[i]++; if(d[i]==='0') wrong[i]++; }
  });
  return qs.map((q,i)=>({ q, i, pct: tot[i] ? Math.round(wrong[i]/tot[i]*100) : 0, n:tot[i] }))
           .filter(x=>x.n>0 && x.pct>0).sort((a,b)=>b.pct-a.pct);
}

function rmPreview(id){
  const h = HW.find(x=>x.id===id); if(!h) return;
  const th = +document.getElementById('rm-th').value;
  const picked = rmRanked(h).filter(x=>x.pct > th);
  const el = document.getElementById('rm-prev');
  el.innerHTML = picked.length
    ? `سيضم <b style="color:var(--tick)">${picked.length}</b> مهمة:<br>` +
      picked.slice(0,5).map(x=>`• ${esc(String(x.q.q || x.q.w || 'مهمة').slice(0,40))} <b style="color:var(--pen)">${x.pct}%</b>`).join('<br>') +
      (picked.length>5 ? `<br>… و${picked.length-5} أخرى` : '')
    : '<b style="color:var(--pen)">لا مهام تتجاوز هذا الحد — جرّب نسبة أقل</b>';
}

function doRemedial(id){
  const h = HW.find(x=>x.id===id); if(!h) return;
  const th = +document.getElementById('rm-th').value;
  const picked = rmRanked(h).filter(x=>x.pct > th);
  if(!picked.length){ toast('لا مهام تتجاوز هذا الحد', 'bad'); return; }
  const title = document.getElementById('rm-title').value.trim() || ('مراجعة — ' + h.title);
  const due = document.getElementById('rm-due').value;
  HW.push({ id: uid(), title, cls: h.cls, due, pts: h.pts, max: h.max || 20,
            qs: JSON.parse(JSON.stringify(picked.map(x=>x.q))), subs: {}, at: Date.now(), remedial: true });
  save(K.hw, HW); closeModal(); renderHw();
  toast(`أُنشئ نشاط علاجي بـ ${picked.length} مهمة`, 'good');
}

/* ⧉ نسخ نشاط بمهامه إلى فصل آخر */
function dupHw(id){
  const h = HW.find(x=>x.id===id); if(!h) return;
  const cls = classes();
  openModal(`
    <h2>نسخ «${esc(h.title)}»</h2>
    <p style="color:var(--ink-soft);font-size:.86rem;margin:.2rem 0 .8rem">
      تُنسخ المهام (${(h.qs||[]).length}) والدرجة والنقاط. التسليمات لا تُنسخ.</p>
    <div class="field"><label>عنوان النسخة</label>
      <input class="inp" id="dp-title" value="${esc(h.title)}"></div>
    <div class="field"><label>الفصل</label>
      ${hwClsPickerHTML(h,'dp-cls')}</div>
    <div class="field" style="margin:0"><label>موعد الإغلاق</label>
      <input class="inp" type="date" id="dp-due"></div>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn tick" onclick="doDupHw('${id}')">انسخ</button>
    </div>`);
}
function doDupHw(id){
  const h = HW.find(x=>x.id===id); if(!h) return;
  const title = document.getElementById('dp-title').value.trim() || h.title;
  const { cls, clsList } = hwClsPickerRead('dp-cls');
  const due = document.getElementById('dp-due').value;
  HW.push({ id: uid(), title, cls, clsList, due, pts: h.pts, max: h.max || 20,
            qs: JSON.parse(JSON.stringify(h.qs || [])), subs: {}, at: Date.now() });
  save(K.hw, HW); closeModal(); renderHw();
  toast(`نُسخ «${title}»` + ((cls||clsList.length)?` إلى ${cls||clsList.join('، ')}`:''), 'good');
}

function delHw(id) {
  const h = HW.find(x => x.id === id); if (!h) return;
  const isProject = h.kind === 'files';
  const title = isProject ? `حذف المشروع "${esc(h.title)}"؟` : `حذف "${esc(h.title)}"؟`;
  const note = isProject
    ? 'سيُحذف المشروع من النظام، وستُحذف معه جميع تسليمات الطلاب والملفات المرفوعة المرتبطة به.'
    : 'النقاط الممنوحة تبقى مع الطلاب.';
  openModal(`<h2>${title}</h2>
    <p style="color:var(--ink-soft)">${note}</p>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إبقاء</button>
      <button class="btn pen" onclick="doDelHw('${id}')">${isProject ? 'حذف المشروع' : 'حذف'}</button>
    </div>`);
}
async function doDelHw(id) {
  const h = HW.find(x => x.id === id);
  const sid = h && h.sid;            // وجود sid ⇒ له نسخة على الخادم
  HW = HW.filter(x => x.id !== id);
  save(K.hw, HW); closeModal(); renderHw();

  const api = getApi(), tok = getTok();
  if (!sid || !api || !tok) { toast('حُذف النشاط'); return; }

  // 🗑️ احذفه من الخادم — المزامنة موقوفة حتى ينتهي
  beginLocalMutation();
  try {
    const r = await fetch(`${api}/unpublish?t=${encodeURIComponent(tok)}`
      + `&id=${encodeURIComponent(sid)}&local=${encodeURIComponent(id)}`);
    const j = await r.json();
    syncAbsorbSavedAt(j);   // 🔑 لا تعارض وهمي بعد هذه العملية
    if (j.ok) {
      try { await pushStateNow(); } catch(e) {}
      toast('حُذف النشاط نهائياً واختفى عن الطلاب', 'good');
    } else {
      toast('⚠️ حُذف من هذا الجهاز — لم يُحذف من الخادم', 'bad');
    }
  } catch(e) {
    toast('⚠️ حُذف من هذا الجهاز — تعذّر الاتصال بالخادم', 'bad');
  } finally {
    endLocalMutation();
  }
}


/* 🔎 مهمة التصحيح من تقرير النشاط: من نتيجته أقل من 50% أو أنهى بسرعة مريبة.
   الطالب يعيد حل أخطائه فقط بمهلة قراءة يفرضها الخادم، وتظهر نتيجته هنا وتصلك إشعارًا. */
const RT_LOW_PCT = 50;
/* 🚪 خرج من صفحة النشاط أثناء الحل (يرسله جهاز الطالب): يُعرض إن تجاوزت مدته 10 ث أو تكرر 3 مرات */
function awayOf(v){ const a=v&&v.away; if(!a||!a.n) return null; const secs=Number(a.secs)||0; return (secs>=10||a.n>=3)?{n:a.n,secs,r:Number(a.r)||0,q:Array.isArray(a.q)?a.q:[],ok:(Array.isArray(a.q)?a.q:[]).filter(i=>String(v.d||'')[i]==='1').length}:null; }
function awayLabel(a){ const m=Math.floor(a.secs/60), s=a.secs%60; return `🚪 خرج ${a.n===1?'مرة':a.n===2?'مرتين':a.n+' مرات'} · ${m?m+' د ':''}${s} ث${a.r?` · 🔁 أُعيدت أسئلته ${a.r===1?'مرة':a.r===2?'مرتين':a.r+' مرات'}`:''}`; }
function rtCandidates(h, subs){
  const pol = activityKindPolicy(h);
  if(!pol.score || h.kind==='files') return [];
  return subs.map(([sid,v])=>{
    const tot = Number(v.total)||0, pct = tot ? Math.round((Number(v.correct)||0)*100/tot) : null;
    const fast = isSuspiciouslyFast(h,v), low = pct!==null && pct < RT_LOW_PCT, away = awayOf(v);
    return { sid, s:byId(sid), pct, fast, low, away, secs:Number(v.secs)||0 };
  }).filter(x=>x.s && (x.fast || x.low || x.away)).sort((a,b)=>(a.pct??101)-(b.pct??101));
}
function rtCandidatesHTML(h, subs){
  const list = rtCandidates(h, subs);
  if(!list.length) return '';
  return `<div class="rep-sec" style="display:flex;align-items:center;justify-content:center;gap:.6rem"><span>🔎 يحتاجون متابعة (${list.length})</span></div>
    <div class="rep-box rt-box" style="padding:.4rem .6rem;margin-bottom:.7rem">
      <p class="muted" style="font-size:.76rem;margin:.1rem 0 .4rem">🔎 مهمة التصحيح: يعيد الطالب حل أخطائه فقط، سؤالًا سؤالًا بمهلة قراءة.${list.some(x=>x.away)?' 🔍 مهمة التحقق (لمن 🚪 خرج من الصفحة أثناء الحل): يعيد الأسئلة التي أصابها وهو خارجها دون رؤية إجابته — فإن أخطأها الآن فدرجته لم تكن من حلّه. تُرسل تلقائيًا إن خرج 10 ث فأكثر وأصاب وهو خارجها.':''} وتظهر النتيجة هنا.</p>
      ${list.map(x=>`<div class="rt-row" id="rt-row-${esc(x.sid)}">
        <div class="rt-who"><b>${esc(x.s.name)}</b>
          <span class="rt-tags">${x.pct!==null?`<span class="pill" style="background:${x.low?'rgba(214,69,91,.1)':'rgba(27,156,107,.1)'};color:${x.low?'var(--pen)':'var(--tick)'}">${x.pct}%</span>`:''}${x.fast?`<span class="pill" style="background:rgba(200,138,46,.12);color:#9A6512">⚡ ${x.secs}ث</span>`:''}${x.away?`<span class="pill" style="background:rgba(214,69,91,.1);color:var(--pen)" title="${x.away.q.length?'كان خارج الصفحة أثناء الأسئلة: '+x.away.q.map(i=>i+1).join('، ')+' — أصاب منها '+x.away.ok:''}">${awayLabel(x.away)}${x.away.q.length?` · أصاب ${x.away.ok} من ${x.away.q.length} وهو خارجها`:''}</span>`:''}</span>
          <small class="rt-st" id="rt-st-${esc(x.sid)}">…</small></div>
        <button class="btn sm" type="button" id="rt-btn-${esc(x.sid)}" data-rs="${x.fast?'fast':x.away?'away':'low'}" onclick="this.disabled=true;sendFastReviewRequest('${esc(x.sid)}','${esc(h.id)}','${x.fast?'fast':x.away?'away':'low'}')">${!x.fast&&x.away?'🔍 مهمة تحقق':'🔎 مهمة تصحيح'}</button>
      </div>`).join('')}
    </div>`;
}
async function rtStatusLoad(localId){
  const h = HW.find(x=>String(x.id)===String(localId)); if(!h) return;
  if(!document.querySelector('.rt-box')) return;
  const api=getApi(), tok=getTok(); if(!api||!tok) return;
  let st = {};
  try{
    const r = await fetch(api.replace(/\/+$/,'')+'/review-status?t='+encodeURIComponent(tok)+'&hw='+encodeURIComponent(h.sid||h.id)+'&_='+Date.now());
    const j = await r.json(); if(j && j.ok) st = j.status||{}; else throw 0;
  }catch(e){ document.querySelectorAll('.rt-st').forEach(el=>{ if(el.textContent==='…') el.textContent=''; }); return; }
  document.querySelectorAll('.rt-row').forEach(row=>{
    const sid = row.id.slice(7), x = st[sid], el = document.getElementById('rt-st-'+sid), btn = document.getElementById('rt-btn-'+sid);
    if(!el || !btn) return;
    btn.disabled = false; el.className = 'rt-st';
    if(x && x.pending){ el.textContent='⏳ أُرسلت — بانتظار الطالب'; el.classList.add('wait'); btn.textContent='إعادة الإرسال'; }
    else if(x && x.done){
      const d = x.done, mins = Math.max(1, Math.round((Number(d.secs)||0)/60));
      el.textContent = d.reason==='away' ? `🔍 تحقّق: أصاب ${d.fixed} من ${d.auto} حين أعادها دون خروج${d.auto&&d.fixed/d.auto<0.5?' — نتيجته الأصلية لا تعكس مستواه':''}`
        : d.wrong ? `✅ صحّح ${d.fixed} من ${d.auto}${d.wrong>d.auto?` · اطّلع على ${d.wrong-d.auto}`:''} · ${mins} د` : '✅ أكّد أنه سيتأنّى';
      el.classList.add(d.wrong && d.fixed < d.auto ? 'part' : 'ok'); btn.textContent='مهمة جديدة';
    } else { el.textContent='لم تُرسل بعد'; btn.textContent=btn.dataset.rs==='away'?'🔍 مهمة تحقق':'🔎 مهمة تصحيح'; }
  });
}

/* 🔬 تقرير المختبر: المفاهيم التي تحتاج تعزيزًا على مستوى الفصل، ثم تفاصيل كل طالب */
function labReportHTML(h, subs, byId){
  const rows=subs.filter(([,v])=>v && v.lab);
  if(!rows.length) return `<div class="rep-sec"><span>🔬 تقارير التجربة</span></div><div class="rep-box" style="padding:.6rem"><p class="muted" style="text-align:center">لم تصل تقارير تفصيلية بعد. اضغط 🔄 لتحديث النتائج.</p></div>`;
  const need={}, parts={};
  rows.forEach(([,v])=>{
    (v.lab.reinforce||[]).forEach(c=>need[c]=(need[c]||0)+1);
    (v.lab.parts||[]).forEach(p=>{ const k=p[0]; if(!parts[k]) parts[k]={got:0,max:0}; parts[k].got+=Number(p[1])||0; parts[k].max+=Number(p[2])||0; });
  });
  const needList=Object.entries(need).sort((a,b)=>b[1]-a[1]);
  const partList=Object.entries(parts).map(([k,x])=>[k,Math.round(x.got/Math.max(1,x.max)*100)]).sort((a,b)=>a[1]-b[1]);
  const col=p=>p>=75?'var(--tick)':p>=50?'#C88A2E':'var(--pen)';
  return `
  <div class="rep-sec"><span>🔬 أين يحتاج الفصل إلى دعم؟</span></div>
  <div class="rep-box" style="padding:.6rem">
    ${needList.length?needList.map(([c,n])=>`<div class="row" style="gap:.5rem;padding:.3rem .2rem"><span style="flex:1;font-weight:700;font-size:.87rem">${esc(c)}</span><span class="pill due" style="font-size:.74rem">${n} من ${rows.length}</span></div>`).join(''):'<p class="muted" style="text-align:center">أتقن جميع الطلاب المفاهيم من أول محاولة.</p>'}
    <div style="margin-top:.5rem;border-top:1px solid var(--rule);padding-top:.4rem">
      ${partList.map(([k,p])=>`<div class="row" style="gap:.5rem;font-size:.82rem;padding:.15rem .2rem"><span style="flex:1">${esc(k)}</span><b style="color:${col(p)}">${p}%</b></div>`).join('')}
    </div>
  </div>
  <div class="rep-sec"><span>🧪 تفاصيل كل طالب</span></div>
  <div class="rep-box" style="padding:.4rem">
    ${rows.sort((a,b)=>(a[1].lab.score||0)-(b[1].lab.score||0)).map(([sid,v])=>{
      const L=v.lab, st=byId(sid);
      return `<details style="border-bottom:1px solid var(--rule);padding:.45rem .2rem">
        <summary style="cursor:pointer;display:flex;gap:.5rem;align-items:center"><b style="flex:1">${esc(st.name||v.name||'')}</b>
          <span class="pill quiet" style="font-size:.74rem">${esc((L.names||[]).join(' + '))}</span>
          <span class="pill" style="font-size:.74rem;color:${col(L.score||0)}">${esc(activityGradeLabel(h,v))}</span></summary>
        <div style="font-size:.82rem;line-height:1.85;margin-top:.35rem">
          <div><b>النتيجة:</b> ${esc(L.result||'')}</div>
          <div><b>${esc((L.practical&&L.practical.label)||'الفصل العملي')}:</b> ${(L.practical?L.practical.done:L.sepDone)?'✓ ':'✗ '}${esc((L.practical&&L.practical.text)||(L.sepDone?'اكتمل':'لم يكتمل'))}</div>
          ${(L.steps||[]).length?`<div><b>${['friction','work','machines','newton3','physchg','chemchg'].includes(L.topic)?'القياسات والحسابات':'الخطوات'}:</b> ${L.steps.map(esc).join('، ')}</div>`:''}
          <div><b>الإجابات:</b> ${(L.answers||[]).map((a,i)=>`${i===3?'التطبيق':'س'+(i+1)} ${a.ok?'✓':'✗'}${a.n>1?` (${a.n} محاولات)`:''}`).join(' · ')}</div>
          ${(L.reinforce||[]).length?`<div><b style="color:var(--pen)">يحتاج تعزيزًا:</b> ${L.reinforce.map(esc).join('، ')}</div>`:''}
          ${(L.mistakes||[]).length?`<div><b>أخطاؤه أثناء التجربة:</b><br>${L.mistakes.map(esc).join('<br>')}</div>`:''}
        </div></details>`;
    }).join('')}
  </div>`;
}
function openReport(id){
  const h = HW.find(x=>x.id===id); if(!h) return;
  const qs = h.qs || [];
  const pool = hwPool(h);
  const subs = Object.entries(h.subs || {}).filter(([sid])=>byId(sid));
  if(!subs.length){ toast('لا توجد تسليمات بعد', 'bad'); return; }

  const hMax = h.max || 20;

  // ── إحصاء لكل مهمة: من أخطأ فيها ──
  const perQ = qs.map(()=>({ ok:0, no:0, wrongNames:[] }));
  let totalSecs = 0, secsN = 0, lateN = 0;
  subs.forEach(([sid,v])=>{
    const st = byId(sid);
    const d = String(v.d||'');
    if(v.secs){ totalSecs += v.secs; secsN++; }
    if(h.due && v.at && new Date(v.at).toISOString().slice(0,10) > h.due) lateN++;
    if(d.length !== qs.length) return;
    for(let i=0;i<qs.length;i++){
      if(d[i]==='1') perQ[i].ok++;
      else { perQ[i].no++; perQ[i].wrongNames.push(st.name); }
    }
  });

  const withD = subs.filter(([,v])=>String(v.d||'').length === qs.length).length;
  const ranked = perQ.map((x,i)=>({ i, q:qs[i], ...x, n:x.ok+x.no,
                   pct: (x.ok+x.no) ? Math.round(x.ok/(x.ok+x.no)*100) : 0 }))
                 .filter(x=>x.n>0).sort((a,b)=>a.pct-b.pct);

  // إحصائيات عامة
  const grades = subs.map(([,v])=>activityGrade(h,v)).filter(v=>Number.isFinite(v));
  const avg = grades.length ? Math.round(grades.reduce((a,b)=>a+b,0)/grades.length) : 0;
  const notYet = pool.filter(s=>!(h.subs||{})[s.id]);
  const avgSecs = secsN ? Math.round(totalSecs/secsN) : 0;
  const fastN = subs.filter(([,v])=>isSuspiciouslyFast(h,v)).length;

  // أجهزة مشتركة داخل هذا النشاط
  const byDev = {};
  subs.forEach(([sid,v])=>{ if(!v.dev) return; (byDev[v.dev]=byDev[v.dev]||[]).push(byId(sid).name); });
  const shared = Object.values(byDev).filter(a=>a.length>1);

  const col = p => p>=75 ? 'var(--tick)' : p>=50 ? '#C88A2E' : 'var(--pen)';

  openModal(`
    <div class="activity-report-head">
      <div class="activity-report-heading">
        <span class="activity-report-kicker">📊 تقرير النشاط</span>
        <h2>${esc(h.title)}</h2>
    <p style="color:var(--ink-soft);font-size:.85rem;margin:.15rem 0 .8rem">
      ${esc(hwClsLabel(h))} · ${h.kind==='files' ? '📎 تسليم ملفات' : h.kind==='lab' ? esc(labSummary(h)) : `${qs.length} مهمة`} · ${h.kind==='files' && h.projectGraded ? `من ${hMax} درجة بعد الاعتماد` : `من ${hMax} درجة`}</p>
      </div>
      ${qs.length&&h.kind!=='files'&&h.kind!=='lab'&&h.kind!=='style'?`<button class="btn sm no-print" type="button" onclick="openItemAnalysis('${esc(h.id)}')" title="الصعوبة والتمييز وتحليل البدائل والثبات">🔬 تحليل الفقرات</button>`:''}
      <span class="activity-report-close-hint">تفصيل الأداء</span>
    </div>

    <div class="astat" style="grid-template-columns:repeat(4,1fr);margin-bottom:.8rem">
      <div><b>${subs.length}/${pool.length}</b><span>سلّم</span></div>
      <div><b style="color:${col(Math.round(avg/hMax*100))}">${avg}</b><span>متوسط الدرجة</span></div>
      <div><b style="color:${lateN?'#C88A2E':'var(--tick)'}">${lateN}</b><span>متأخر</span></div>
      <div><b>${avgSecs?Math.floor(avgSecs/60)+'د '+(avgSecs%60)+'ث':'—'}</b><span>متوسط الوقت</span></div>
    </div>

    ${shared.length ? `<div class="sheet" style="background:rgba(214,69,91,.07);border:1.5px solid var(--pen);padding:.6rem .8rem;margin-bottom:.7rem">
      <b style="color:var(--pen);font-size:.88rem">🚩 جهاز واحد لأكثر من طالب</b>
      ${shared.map(a=>`<div style="font-size:.84rem;margin-top:.2rem">${esc(a.join(' · '))}</div>`).join('')}
    </div>` : ''}
    ${fastN ? `<div style="background:rgba(200,138,46,.1);border-radius:10px;padding:.5rem .8rem;margin-bottom:.7rem;font-size:.85rem">
      ⚡ <b>${fastN}</b> طالب أنهى بسرعة مريبة (أقل من ${activityKindPolicy(h).rule||'الحد المعقول'})</div>` : ''}

    ${rtCandidatesHTML(h, subs)}

    ${h.kind==='lab' ? labReportHTML(h, subs, byId) : ''}
    ${h.kind==='files' ? `
    <div class="rep-sec" style="display:flex;align-items:center;justify-content:center;gap:.6rem">
      <span>📎 الأعمال المرفوعة</span>
    </div>
    <div class="rep-box" style="padding:.6rem">
      ${subs.map(([sid,v])=>{
        const st=byId(sid); const files=Array.isArray(v.files)?v.files:[];
        const links=files.map((f,i)=>{
          const href=getApi()+'/file-download?hw='+encodeURIComponent(h.sid||h.id)+'&sid='+encodeURIComponent(st.id||sid)+'&name='+encodeURIComponent(st.name)+'&key='+encodeURIComponent(f.key)+'&'+(window.hwFileAuth?hwFileAuth():'t='+encodeURIComponent(getTok()));
          return `<a href="${href}" target="_blank" rel="noopener" class="btn ghost sm" style="text-decoration:none">${f.type==='application/pdf'?'📄':String(f.type||'').startsWith('video/')?'🎥':'🖼️'} ${esc(f.name||('ملف '+(i+1)))}</a>`;
        }).join(' ');
        return `<div style="padding:.55rem .2rem;border-bottom:1px solid var(--rule)"><b>${esc(st.name)}</b><div style="margin-top:.4rem;display:flex;gap:.35rem;flex-wrap:wrap">${links||'<span class="muted">لا توجد مرفقات</span>'}</div></div>`;
      }).join('')}
    </div>` : ''}

    <div class="rep-sec" style="display:flex;align-items:center;justify-content:center;gap:.6rem">
      <span>${h.kind==='files'?'ملخص النشاط':'المهام — اضغط المهمة لترى من أخطأ'}</span>
      <button onclick="toggleAllQn()" style="background:rgba(255,255,255,.2);border:none;color:#fff;
        border-radius:8px;padding:.15rem .55rem;font-family:inherit;font-size:.74rem;cursor:pointer">▾ الكل</button>
    </div>
    <div class="rep-box" style="padding:.5rem">
      ${h.kind==='files' ? '<p class="muted" style="text-align:center">هذا نشاط تسليم ملفات — راجع المرفقات أعلاه.</p>' : h.kind==='lab' ? '<p class="muted" style="text-align:center">تجربة مختبر — التفاصيل لكل طالب أعلاه.</p>' : ranked.length ? ranked.map(x=>{
        const k = x.q.t||'q';
        const title = k==='a' ? ('رتّب: '+(x.q.w||'')) : k==='s' ? ('رتّب جملة: '+String(x.q.s||'').slice(0,30))
                    : k==='m' ? ('وصّل: '+(((x.q.p||[])[0]||[''])[0])) : (x.q.q||'');
        const right = k==='q' ? (x.q.o||[])[x.q.a] : k==='tf' ? (x.q.a?'صح':'خطأ')
                    : k==='f' ? x.q.a : k==='a' ? x.q.w : k==='s' ? x.q.s
                    : (x.q.p||[]).map(p=>p[0]+' ← '+p[1]).join(' · ');
        const hasW = x.wrongNames.length > 0;
        return `<div style="border-bottom:1px solid var(--rule)">
          <div class="row activity-q-row" style="gap:.5rem;padding:.45rem .3rem;${hasW?'cursor:pointer':''}"
               ${hasW?`onclick="toggleQn(${x.i})"`:''}>
            <span style="color:var(--ink-soft);font-size:.76rem;min-width:1.2rem">${x.i+1}.</span>
            <span style="flex:1;font-size:.87rem;font-weight:700">${hasW?`<span id="qn-a-${x.i}" style="color:var(--ink-soft);font-size:.74rem">▸</span> `:''}${esc(title)}</span>
            ${hasW?`<span class="pill due" style="font-size:.72rem">${x.no} أخطأ</span>`:''}
            <span style="width:56px;height:6px;background:var(--rule);border-radius:99px;overflow:hidden">
              <i style="display:block;height:100%;width:${x.pct}%;background:${col(x.pct)}"></i></span>
            <b style="color:${col(x.pct)};min-width:2.6rem;text-align:end">${x.pct}%</b>
          </div>
          ${hasW ? `<div id="qn-${x.i}" class="hide" style="padding:.1rem .3rem .55rem 1.9rem;background:#F7F9FC">
            <div style="font-size:.79rem;color:var(--tick);margin-bottom:.3rem">الصحيح: ${esc(right)}</div>
            <div style="display:flex;flex-wrap:wrap;gap:.3rem">
              ${x.wrongNames.map(nm=>`<span class="pill" style="background:rgba(214,69,91,.1);color:var(--pen);font-size:.76rem">${esc(nm)}</span>`).join('')}
            </div>
          </div>` : ''}
        </div>`;
      }).join('') : '<p class="muted">لا تفاصيل — تسليمات قديمة.</p>'}}
      ${withD < subs.length ? `<p class="muted" style="font-size:.78rem;margin:.5rem 0 0">${subs.length-withD} تسليم بلا تفاصيل</p>` : ''}
    </div>

    ${notYet.length ? `
    <div class="rep-sec" style="margin-top:.8rem;cursor:pointer" onclick="toggleLate()">
      <span id="late-arrow">▸</span> لم يسلّموا (${notYet.length}) — اضغط لعرض الأسماء
    </div>
    <div id="late-box" class="hide rep-box" style="padding:.6rem">
      <div style="display:flex;flex-wrap:wrap;gap:.3rem">
        ${notYet.map(s=>`<span class="pill" style="background:rgba(214,69,91,.1);color:var(--pen);font-size:.76rem">${esc(s.name)}</span>`).join('')}
      </div>
      <button class="btn ghost sm" style="margin-top:.55rem" onclick="copyLate('${id}')">نسخ الأسماء</button>
    </div>` : `<div style="text-align:center;color:var(--tick);font-weight:700;margin-top:.8rem">🎉 سلّم الجميع</div>`}

    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إغلاق</button>
      ${ranked.some(x=>x.pct<100) ? `<button class="btn" onclick="closeModal();remedialHw('${id}')">🩹 نشاط علاجي</button>` : ''}
    </div>`);
  const reportModal = document.getElementById('modal');
  rtStatusLoad(id);
  if(reportModal) reportModal.classList.add('activity-report-modal');
}

/* ▸ إظهار أسماء من لم يسلّم */
function toggleLate(){
  const box = document.getElementById('late-box');
  const arr = document.getElementById('late-arrow');
  if(!box) return;
  const hidden = box.classList.toggle('hide');
  if(arr) arr.textContent = hidden ? '▸' : '▾';
}

/* ▸ إظهار أسماء من أخطأ في مهمة */
function toggleQn(i){
  const box = document.getElementById('qn-'+i);
  const arr = document.getElementById('qn-a-'+i);
  if(!box) return;
  const hidden = box.classList.toggle('hide');
  if(arr) arr.textContent = hidden ? '▸' : '▾';
}
function toggleAllQn(){
  const boxes = document.querySelectorAll('[id^="qn-"]:not([id^="qn-a-"])');
  const anyHidden = [...boxes].some(b=>b.classList.contains('hide'));
  boxes.forEach(b=>{
    b.classList.toggle('hide', !anyHidden);
    const a = document.getElementById('qn-a-' + b.id.slice(3));
    if(a) a.textContent = anyHidden ? '▾' : '▸';
  });
}

function copyLate(id){
  const h = HW.find(x=>x.id===id); if(!h) return;
  const pool = hwPool(h);
  const late = pool.filter(s=>!(h.subs||{})[s.id]).map(s=>s.name);
  if(!late.length){ toast('سلّم الجميع','good'); return; }
  const txt = `لم يسلّموا «${h.title}»:\n` + late.map((n,i)=>`${i+1}. ${n}`).join('\n');
  navigator.clipboard.writeText(txt)
    .then(()=>toast(`نُسخ ${late.length} اسم`,'good')).catch(()=>toast('تعذّر النسخ','bad'));
}
function saveSite(){ localStorage.setItem(K_SITE, document.getElementById('site-url').value.trim()); }
/* 🧭 كان يفتح بوابة المعلم — البوابة صارت داخل اللوحة: يفتح «✋ الرصد» (السجلات والحضور ← اليوم) على الحصة الحالية */
function openPortal(){ try{ closeModal(); }catch(e){} if(typeof fmEnter==='function'){ window._fmCls=''; fmEnter('r'); return; } window._ctRcView='day'; window._ctRcD=ctToday(); window._ctRcClsUser=0; window._qrScroll=1; ctGo('records'); }   // 🎯 وضع الحصة (js/44-focus-mode.js)
function saveApi(){
  localStorage.setItem(K_API, document.getElementById('api-url').value.trim().replace(/\/+$/,''));
  localStorage.setItem(K_TOK, document.getElementById('api-tok').value.trim());
}
function qRowKeep(r){ try{ return r && r.dataset.x ? JSON.parse(r.dataset.x) : {}; }catch(e){ return {}; } }
function qRowSkApply(r,o){ const s=r&&r.querySelector('.f-sk'); if(!s) return o;
  if(s.value){ o.skill=s.value; delete o.skRaw; } else delete o.skill; return o; }
/* ＋ خطة من التقرير التشخيصي: الطلاب الذين تنقصهم المهارة، والمهارة هدف الخطة */
async function planFromDiag(hid,skill){
  const cls=(document.getElementById('dg-class')||{}).value||'__all__';
  const D=diagBuild(hid,cls); const sk=D&&D.skills.find(x=>x.skill===skill); if(!sk||!sk.miss.length) return;
  try{ if(!PLAN_DATA){ const AS=planSP(); PLAN_DATA=await loadServerGrades(false,AS.sem,AS.per); } }catch(e){}
  const ids=sk.miss.map(r=>String(r.s.id));
  openPlanForm();
  if(ids.length>1){ const cb=document.getElementById('pf-group'); if(cb) cb.checked=true; window._pfMembers=ids; }
  else { const sel=document.getElementById('pf-student'); if(sel){ sel.value=ids[0]; window._pfSid=ids[0]; } }
  window._pfSkills=[skill]; window._pfPattern='gap';
  const rate=Math.round(sk.miss.reduce((n,r)=>n+r.skills[skill].rate,0)/sk.miss.length);
  window._pfActions=[...skActions(skill,rate),...(ids.length>1?[`مناقشة الأخطاء الشائعة في «${skill}» مع المجموعة`]:[])];
  const rs=document.getElementById('pf-reason'); if(rs) rs.value=`فجوة في المهارات — ${skill} (${ids.length>1?'متوسط المجموعة ':''}${rate}% في «${D.h.title}»)`;
  renderPlanMembers(); renderPlanActions(); renderPlanSkills();
}

function setDiagMode(mode){
  const value = mode === 'brief' ? 'brief' : 'full';
  localStorage.setItem(K_DIAGMODE, value);
  syncReportModeButtons('diag', value);
  renderDiagPanel();
}

function setStylesMode(mode){
  const value = mode === 'brief' ? 'brief' : 'full';
  localStorage.setItem(K_STYLEMODE, value);
  syncReportModeButtons('styles', value);
  renderStylesPanel();
}

/* 📊 تقرير أنماط التعلّم للفصل */
function openStylesReport(id){
  const h = HW.find(x=>x.id===id); if(!h) return;
  const pool = hwPool(h);
  const rows = [];
  const counts = Object.fromEntries(STYLE_ORDER.map(k=>[k,0]));
  pool.forEach(s=>{
    const t = styleTally(h, s.id);
    if(!t) return;
    rows.push({ s, ...t });
    counts[t.top] = (counts[t.top]||0) + 1;
  });
  if(!rows.length){ toast('لا توجد إجابات بعد','bad'); return; }

  const order = STYLE_ORDER.slice();
  Object.keys(counts).forEach(k=>{ if(order.indexOf(k)<0) order.push(k); });
  const n = rows.length;
  // النمط الغالب = الأكثر طلابًا (لا أول نمط في الترتيب الثابت)
  const topK = order.reduce((b,k)=>(counts[k]||0)>(counts[b]||0)?k:b, order[0]);

  openModal(`
    <h2>🧠 أنماط التعلّم — ${esc(h.title)}</h2>
    <p style="color:var(--ink-soft);font-size:.85rem;margin:.15rem 0 .8rem">
      ${esc(hwClsLabel(h))} · أجاب <b>${n}</b> من ${pool.length} طالباً</p>

    <div class="rep-sec">توزيع الفصل</div>
    <div class="rep-box" style="padding:.65rem">
      ${order.map(k=>{
        const c = counts[k], pct = Math.round(c/n*100);
        const col = STYLE_COLOR[k] || '#5A6B84';
        return `<div class="hb" style="margin-bottom:.45rem">
          <span class="nm">${STYLE_ICON[k]||'🏷️'} ${esc(k)}</span>
          <span class="tr"><i style="width:${Math.max(pct,2)}%;background:${col}"></i></span>
          <span class="vv" style="color:${col}">${pct}%</span>
          <span class="muted" style="font-size:.76rem;min-width:2.8rem;text-align:end">${c} طالب</span>
        </div>`;
      }).join('')}
      <div style="margin-top:.6rem;padding-top:.5rem;border-top:1px solid var(--rule);font-size:.86rem">
        <b>النمط الغالب: ${STYLE_ICON[topK]||'🏷️'} ${esc(topK)}</b>
        <span class="muted"> — راعِ ذلك في تخطيط دروسك.</span>
      </div>
    </div>

    <div class="rep-sec" style="margin-top:.8rem">نمط كل طالب</div>
    <div class="rep-box" style="padding:.4rem;max-height:40vh;overflow:auto">
      ${rows.slice().sort((a,b)=>a.s.name.localeCompare(b.s.name,'ar')).map(r=>{
        const col = STYLE_COLOR[r.top] || '#5A6B84';
        return `<div class="ruled" style="padding:.42rem .6rem">
          <div class="row" style="gap:.5rem">
            <span class="name" style="flex:1;font-size:.9rem">${esc(r.s.name)}</span>
            ${r.s.cls?`<span class="pill quiet" style="font-size:.72rem">${esc(r.s.cls)}</span>`:''}
            <b style="color:${col};font-size:.88rem">${STYLE_ICON[r.top]||'🏷️'} ${esc(r.top)}</b>
            <span class="muted" style="font-size:.76rem">${r.topPct}%</span>
          </div>
          <div class="muted" style="font-size:.74rem;margin-top:.15rem">
            ${r.rows.map(([k,c])=>`${esc(k)} ${Math.round(c/r.total*100)}%`).join(' · ')}</div>
        </div>`;
      }).join('')}
    </div>

    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إغلاق</button>
    </div>`);
}

function isStylesJson(d){
  if(!d || !Array.isArray(d.quiz) || !d.quiz.length) return false;
  // يحمل خريطة الأنماط أو حقل type في كل سؤال
  if(d.learningStyles && typeof d.learningStyles === 'object') return true;
  const types = new Set(d.quiz.map(x=>x && x.type).filter(Boolean));
  return ['visual','auditory','kinesthetic'].every(k=>types.has(k));
}

function convertStylesJson(d){
  const out = [];
  (d.quiz||[]).forEach(x=>{
    const o = Array.isArray(x.opts) ? x.opts.filter(Boolean) : [];
    if(!x.q || o.length < 2) return;
    // لا خلط — الترتيب هو ما يحدد النمط
    out.push({ t:'q', q:x.q, o, a:0, tags: STYLE_ORDER.slice(0, o.length) });
  });
  return out;
}

function normalizeImportedQuestions(arr, kind){
  if(!Array.isArray(arr)) return [];
  const out=[];
  for(const x of arr){
    if(!x || typeof x!=='object') continue;
    if(x.t==='q' && x.q && Array.isArray(x.o) && x.o.filter(Boolean).length>=2){
      const o=x.o.map(String).filter(Boolean).slice(0,4);
      if(kind==='style') out.push({t:'q',q:String(x.q),o,a:0,tags:STYLE_ORDER.slice(0,o.length)});
      else { const ai=Math.max(0,Math.min(o.length-1,Number.isFinite(Number(x.a))?Number(x.a):0)); out.push(Object.assign({t:'q',q:String(x.q),o,a:ai}, kind==='diag'?impDiagSk(x):{}) ); }
    } else if(x.t==='tf' && x.q){ out.push(Object.assign({t:'tf',q:String(x.q),a:impBool(x.a ?? x.answer)}, kind==='diag'?impDiagSk(x):{}) ); }
    else if(x.t==='f' && x.q && x.a!=null){ out.push(Object.assign({t:'f',q:String(x.q),a:String(x.a)}, kind==='diag'?impDiagSk(x):{}) ); }
    else if(x.t==='a' && x.w){ out.push({t:'a',w:String(x.w),h:String(x.h||'')}); }
    else if(x.t==='s' && x.s){ out.push({t:'s',s:String(x.s)}); }
    else if(x.t==='m' && Array.isArray(x.p) && x.p.filter(p=>Array.isArray(p)&&p.length>=2&&p[0]&&p[1]).length>=2){ out.push({t:'m',p:x.p.filter(p=>Array.isArray(p)&&p.length>=2&&p[0]&&p[1]).map(p=>[String(p[0]),String(p[1])])}); }
  }
  return out;
}
/* إجابة صح/خطأ بأي صيغة: true · "true" · 1 · "صح" … — تصدير الاختبار الورقي يكتبها في answer لا في a */
function impBool(v){
  if(v===true||v===1) return true;
  const t=String(v??'').trim().toLowerCase();
  return ['true','1','صح','صحيح','صحيحة','t','✓','✔','yes','نعم'].includes(t);
}
/* موضع الإجابة الصحيحة في الخيارات: نص الخيار، أو رقمه، أو حرفه (أ ب ج د / A B C D) */
function impAnswerIndex(o, v){
  if(v==null||v==='') return -1;
  const norm=x=>String(x??'').replace(/[\u064B-\u0652\u0640]/g,'').replace(/\s+/g,' ').trim();
  const byText=o.findIndex(x=>norm(x)===norm(v)); if(byText>=0) return byText;
  if(typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<o.length) return v;
  const t=String(v).trim(), L=['أ','ب','ج','د'].indexOf(t), E=['a','b','c','d'].indexOf(t.toLowerCase());
  if(L>=0&&L<o.length) return L; if(E>=0&&E<o.length) return E;
  if(/^\d+$/.test(t)&&+t<o.length) return +t;
  return -1;
}
function convertGamesJson(d){
  const pools = { q:[], tf:[], f:[], a:[], s:[], m:[] };
  const skipped = [];
  const arr = k => Array.isArray(d[k]) ? d[k] : [];
  let noKey = 0;
  arr('fillblank').forEach(x=>{ const q=String(x&&(x.q??x.question)||'').trim(), a=String(x&&(x.answer??x.a)||'').trim(); if(q&&a) pools.f.push({ t:'f', q, a }); });

  arr('quiz').forEach(x=>{
    const o = Array.isArray(x.opts) ? x.opts.filter(Boolean) : Array.isArray(x.o) ? x.o.filter(Boolean) : [];
    if(!x.q || o.length<2) return;
    let ai = impAnswerIndex(o, x.a ?? x.answer ?? x.correct);
    if(ai < 0){ ai = 0; noKey++; }
    const sh = shuffleOpts(o, ai);
    pools.q.push({ t:'q', q:x.q, o:sh.o, a:sh.a });
  });

  arr('truefalse').forEach(x=>{ if(x.q) pools.tf.push({ t:'tf', q:x.q, a: impBool(x.a ?? x.answer) }); });
  arr('anagram').forEach(x=>{ if(x.w) pools.a.push({ t:'a', w:String(x.w), h:x.hint||'' }); });
  arr('sentence').forEach(x=>{
    const s = x.sentence || x.s || '';
    if(s && String(s).trim().split(/\s+/).length >= 2) pools.s.push({ t:'s', s:String(s) });
  });

  // صيغتان: [{a,b}] من مولد الألعاب، و[{pairs:[[a,b],…]}] من تصدير الاختبار الورقي
  const pairs = arr('match').flatMap(x=>Array.isArray(x&&x.pairs) ? x.pairs.filter(p=>Array.isArray(p)&&p[0]&&p[1]).map(p=>[String(p[0]),String(p[1])])
    : (x&&x.a&&x.b) ? [[String(x.a),String(x.b)]] : []);
  // مجموعات من 3، ولا يبقى زوج وحيد: 4 ← 2+2 · 7 ← 3+2+2
  for(let i=0;i<pairs.length;){
    const left=pairs.length-i, take=left===4?2:Math.min(3,left);
    const chunk = pairs.slice(i, i+take); i+=take;
    if(chunk.length >= 2) pools.m.push({ t:'m', p:chunk });
  }

  const fbNoAns=arr('fillblank').length-pools.f.length; if(fbNoAns>0) skipped.push(`${fbNoAns} فراغ بلا إجابة`);
  if(d.classify && d.classify.buckets) skipped.push('التصنيف');
  if(noKey) skipped.push(`${noKey} سؤال اختيار بلا إجابة صحيحة معروفة (اعتُمد الخيار الأول — راجعها)`);
  if(Array.isArray(d.memory) && d.memory.length) skipped.push('الذاكرة');
  return { pools, skipped };
}

let IMP = null;   // نتيجة التحويل بانتظار اختيار المعلم

function importQs(ev, id){
  const f = ev.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = e => {
    try{
      const d = JSON.parse(e.target.result);

      const h = HW.find(x=>x.id===id);
      if(!h){ toast('النشاط غير موجود','bad'); return; }
      const hKind = String(h.kind||'normal').toLowerCase();
      const gamesTarget = isGamesKind(h);

      // 📦 ملفات JSON المصدّرة من البوابة نفسها (v1/v2/v3): تُستورد مباشرة بلا AI
      if((Array.isArray(d.questions) || d.game) && (d.version>=1 || d.kind)){
        const importedKind = String(d.kind||'').toLowerCase();
        const family = k => (k==='games'||k==='game') ? 'normal' : (k||'normal');
        if(importedKind && family(importedKind) !== family(hKind)){
          toast(`هذا الملف من نوع ${importedKind} ولا يطابق النشاط الحالي`, 'bad'); return;
        }
        const qs = normalizeImportedQuestions(d.questions||[], gamesTarget ? 'normal' : h.kind);
        let game = null;
        if(d.game && d.game.type && Array.isArray(d.game.data) && d.game.data.length>=gameMeta(d.game.type).min){
          game = {type:normalizeGameType(d.game.type), data:d.game.data, source:'json'};
        }else if(gamesTarget && qs.length){
          // الملف بنك أسئلة فقط ← أعد بناء اللعبة الأولى منه
          try{
            const t = normalizeGameType(activityGames(h)[0]?.type||'memory');
            game = {type:t, data:buildGameFromQuestionBank(t, qs, gameMeta(t).max), source:'json-bank'};
          }catch(err){ game = null; }
        }
        if(!qs.length && !game){ toast('ملف JSON لا يحتوي محتوى صالحًا لهذا النشاط', 'bad'); return; }

        const patch = {dropDraft:true};
        if(qs.length) patch.qs = qs;
        if(game){
          const list = activityGames(h).map(g=>({type:g.type,data:(g.data||[]).slice()}));
          if(list.length) list[0] = {type:game.type,data:game.data};
          else list.push({type:game.type,data:game.data});
          patch.games = list;
        }
        if(h.kind==='style' || h.kind==='diag'){ h.pts=0; h.max=0; }
        commitActivityContent(id, patch).then(res=>{
          renderHw();
          if(!res.ok){ toast(res.error||'تعذّر حفظ المستورد','bad'); return; }
          closeModal();
          toast(`تم استيراد ${qs.length} سؤالًا${game?` و${gameTypeLabel(game.type)} (${game.data.length})`:''} دون استهلاك توكن`, 'good');
        });
        ev.target.value=''; return;
      }

      // 🧠 ملف أنماط التعلّم القديم/المصدر من مولدات خارجية
      if(isStylesJson(d)){
        const qs = convertStylesJson(d);
        h.kind = 'style'; h.pts = 0; h.max = 0;
        commitActivityContent(id, {qs, dropDraft:true}).then(res=>{
          renderHw();
          if(!res.ok){ toast(res.error||'تعذّر الحفظ','bad'); return; }
          closeModal();
          toast(`استُورد ${qs.length} سؤال أنماط تعلّم دون استهلاك توكن`, 'good');
        });
        ev.target.value = ''; return;
      }

      const { pools, skipped } = convertGamesJson(d);
      const total = Object.values(pools).reduce((n,p)=>n+p.length,0);
      if(!total){ toast('لم أجد مهام قابلة للتحويل في هذا الملف', 'bad'); return; }
      IMP = { pools, skipped, id };
      showImportPicker();
    }catch(err){ console.error('importQs:',err); toast('الملف غير صالح — اختر ملف أسئلة مُصدّراً من الألعاب', 'bad'); }
    ev.target.value = '';
  };
  r.readAsText(f);
}

function showImportPicker(){
  const P = IMP.pools;
  const rows = Object.keys(QT).filter(k=>P[k] && P[k].length).map(k=>`
    <div class="row" style="gap:.5rem;margin-bottom:.45rem">
      <label class="row" style="gap:.4rem;flex:1;min-width:130px">
        <input type="checkbox" class="imp-on" data-k="${k}" checked style="width:19px;height:19px;accent-color:#1B9C6B">
        <b>${QT[k]}</b>
      </label>
      <span class="pill quiet">متاح ${P[k].length}</span>
      <input class="inp imp-n" data-k="${k}" type="number" min="1" max="${P[k].length}"
             value="${P[k].length}" style="width:74px;text-align:center">
    </div>`).join('');
  openModal(`
    <h2>اختر ما تريد استيراده</h2>
    <p style="color:var(--ink-soft);font-size:.85rem;margin:.2rem 0 .9rem">
      حدّد الأنواع وعدد المهام من كل نوع. تُختار عشوائياً من المتاح.</p>
    ${rows}
    <label class="row" style="gap:.4rem;margin-top:.7rem;padding-top:.7rem;border-top:1px solid var(--rule)">
      <input type="checkbox" id="imp-replace" style="width:19px;height:19px;accent-color:#D6455B">
      استبدل المهام الحالية بدل الإضافة إليها
    </label>
    ${IMP.skipped.length ? `<p style="color:var(--ink-soft);font-size:.8rem;margin:.6rem 0 0">غير مدعوم: ${IMP.skipped.join(' · ')}</p>` : ''}
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn tick" onclick="doImport()">استيراد</button>
    </div>`);
}

function doImport(){
  if(!IMP) return;
  const h = HW.find(x=>x.id===IMP.id); if(!h) return;
  const picked = [];
  document.querySelectorAll('.imp-on').forEach(cb=>{
    if(!cb.checked) return;
    const k = cb.dataset.k;
    const nEl = document.querySelector(`.imp-n[data-k="${k}"]`);
    const want = Math.max(1, Math.min(+nEl.value || 1, IMP.pools[k].length));
    const shuffled = IMP.pools[k].slice().sort(()=>Math.random()-0.5);
    picked.push(...shuffled.slice(0, want));
  });
  if(!picked.length){ toast('لم تختر أي نوع', 'bad'); return; }
  const replace = document.getElementById('imp-replace').checked;
  h.qs = replace ? picked : (h.qs||[]).concat(picked); if(h.published) h.dirty = true;
  save(K.hw, HW);
  const id = IMP.id; IMP = null;
  openQs(id); renderHw();
  toast(`${replace?'استُبدلت بـ':'أُضيفت'} ${picked.length} مهمة`, 'good');
}

function addQ(kind){
  const box = document.getElementById('qs-box');
  if(box.querySelector('p')) box.innerHTML='';
  const i = box.querySelectorAll('[data-q]').length;
  const blank = { t:kind, q:'', o:['','','',''], a:kind==='tf'?true:0, w:'', h:'', s:'', p:[['',''],['',''],['','']] };
  box.insertAdjacentHTML('beforeend', qRow(blank, i));
}

function exportQsJson(id){
  const qsPush=(r,x)=>qs.push(qRowSkApply(r,Object.assign(qRowKeep(r),x)));
  const h = HW.find(x=>x.id===id); if(!h) return;
  const rows = [...document.querySelectorAll('#qs-box [data-q]')];
  let qs = [];

  if(rows.length){
    // المحرر مفتوح: صدّر ما يراه المعلم الآن
    rows.forEach(r=>{
      const k = r.dataset.k;
      const val = sel => { const e=r.querySelector(sel); return e ? e.value.trim() : ''; };
      const stage = QS_KIND==='reading' ? (r.querySelector('.f-stage')?.value || 'during') : null;
      const picked = r.querySelector('input[type=radio]:checked');
      if(k==='q'){
        const q = val('.f-q');
        const o = [...r.querySelectorAll('.f-o')].map(x=>x.value.trim()).filter(Boolean);
        if(!q || o.length<2) return;
        if(QS_KIND==='style'){
          const TAGS=['بصري','سمعي','حركي','قرائي/كتابي'];
          qsPush(r,Object.assign({t:'q',q,o,a:0,tags:TAGS.slice(0,o.length)}, QS_KIND==='reading'?readingRowExtra(r,stage):{}));
        }else{
          qsPush(r,Object.assign({t:'q',q,o,a:Math.min(picked?+picked.value:0,o.length-1)}, QS_KIND==='reading'?readingRowExtra(r,stage):{}));
        }
      }
      else if(k==='tf'){ const q=val('.f-q'); if(!q) return; qsPush(r,Object.assign({t:'tf',q,a:picked ? picked.value==='1' : true}, QS_KIND==='reading'?readingRowExtra(r,stage):{})); }
      else if(k==='f'){ const q=val('.f-q'), a=val('.f-a'); if(!q || !a) return; qsPush(r,Object.assign({t:'f',q,a}, QS_KIND==='reading'?readingRowExtra(r,stage):{})); }
      else if(k==='a'){ const w=val('.f-w'); if(!w) return; qsPush(r,Object.assign({t:'a',w,h:val('.f-h')}, QS_KIND==='reading'?readingRowExtra(r,stage):{})); }
      else if(k==='s'){ const ss=val('.f-s'); if(!ss || ss.split(/\s+/).length<2) return; qsPush(r,Object.assign({t:'s',s:ss}, QS_KIND==='reading'?readingRowExtra(r,stage):{})); }
      else if(k==='m'){
        const L=[...r.querySelectorAll('.f-l')].map(x=>x.value.trim());
        const R=[...r.querySelectorAll('.f-r')].map(x=>x.value.trim());
        const p=L.map((l,j)=>[l,R[j]||'']).filter(x=>x[0]&&x[1]);
        if(p.length<2) return;
        qsPush(r,Object.assign({t:'m',p}, QS_KIND==='reading'?readingRowExtra(r,stage):{}));
      }
    });
  }else{
    // المحرر مغلق: صدّر المحفوظ فعلاً (كان التصدير يفشل هنا)
    qs = Array.isArray(h.qs) ? JSON.parse(JSON.stringify(h.qs)) : [];
  }

  const game = (h.game && h.game.type && Array.isArray(h.game.data) && h.game.data.length)
    ? {type:h.game.type, data:h.game.data} : null;

  if(!qs.length && !game){ toast('لا يوجد محتوى مكتمل للتصدير','bad'); return; }

  const payload={
    app:'activity-book',
    version:3,
    exportedAt:new Date().toISOString(),
    title:h.title||'',
    kind:h.kind||'normal',
    points:h.pts||0,
    max:h.max||qs.length,
    questions:qs,
    game
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const safe=String(h.title||'questions').replace(/[\\/:*?"<>|]+/g,'_').trim()||'questions';
  a.href=url; a.download=`${safe}_questions.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast(`تم حفظ ${qs.length} سؤال${game?` + ${gameTypeLabel(game.type)}`:''} كملف JSON`,'good');
}

function gameEditorTypeChanged(id){
  const type=normalizeGameType(document.getElementById('game-type')?.value||'memory');
  if(GAME_EDIT && gameEditEntry() && gameEditEntry().type!==type){
    // تغيير النوع يعني محتوى مختلفًا تمامًا، فلا نخلط بيانات النوعين
    gameEditEntry().type=type;
    gameEditEntry().data=[];
    renderGameEditor();
    return;
  }
  const memory=document.getElementById('game-memory-editor');
  const mcq=document.getElementById('game-lock-editor');
  if(memory) memory.style.display=isMcqGameType(type)?'none':'';
  if(mcq) mcq.style.display=isMcqGameType(type)?'':'none';
  const hint=document.getElementById('game-type-hint');
  if(hint) hint.textContent=gameMeta(type).hint||'';
  updateStudentGameCount();
}

function addStudentGameWordRow(){
  const box=document.getElementById('game-memory-rows'); if(!box) return;
  const n=box.querySelectorAll('.game-word-row').length+1;
  const row=document.createElement('div');
  row.className='row game-word-row';
  row.style.cssText='gap:.45rem;margin-bottom:.4rem';
  row.innerHTML=`<span class="pill quiet" style="min-width:2.2rem;justify-content:center">${n}</span>
    <input class="inp game-word" placeholder="كلمة أو مصطلح" style="flex:1">
    <button class="btn ghost sm" type="button">حذف</button>`;
  row.querySelector('button').onclick=()=>{row.remove();updateStudentGameCount();};
  box.appendChild(row);
  row.querySelector('input')?.focus();
  updateStudentGameCount();
}

/* يلتقط ما في الشاشة الآن ويثبّته في اللعبة المحددة قبل أي تبديل */
function gameEditCapture(){
  const e=gameEditEntry(); if(!e) return;
  const typeEl=document.getElementById('game-type');
  if(typeEl) e.type=normalizeGameType(typeEl.value||e.type);
  const prizeEl=document.getElementById('game-prize');
  if(prizeEl && e.type==='lock') e.prize=prizeEl.value.trim().slice(0,160);
  if(e.type!=='lock') delete e.prize;
  if(isMcqGameType(e.type)){
    e.data=[...document.querySelectorAll('#game-lock-rows .game-lock-row')].map(row=>{
      const q=row.querySelector('.game-lock-q')?.value.trim()||'';
      const o=[...row.querySelectorAll('.game-lock-opt')].map(x=>x.value.trim()).filter(Boolean).slice(0,4);
      const picked=row.querySelector('input[type=radio]:checked');
      return {q,o,a:picked?Number(picked.value):0};
    }).filter(x=>x.q && x.o.length>=2 && Number.isInteger(x.a) && x.a>=0 && x.a<x.o.length)
      .slice(0,gameMeta(e.type).max);
  }else{
    const words=[...document.querySelectorAll('#game-memory-rows .game-word')].map(x=>x.value.trim()).filter(Boolean);
    e.data=[...new Set(words)].slice(0,gameMeta('memory').max);
  }
}

function gameEditSelect(i){ gameEditCapture(); GAME_EDIT.idx=i; renderGameEditor(); }
function gameEditAdd(){
  gameEditCapture();
  if(GAME_EDIT.list.length>=MAX_GAMES_PER_ACTIVITY){ toast(`الحد ${MAX_GAMES_PER_ACTIVITY} ألعاب للنشاط الواحد`,'bad'); return; }
  GAME_EDIT.list.push({type:'memory',data:[]});
  GAME_EDIT.idx=GAME_EDIT.list.length-1;
  renderGameEditor();
}
function gameEditRemove(i){
  if(GAME_EDIT.list.length<=1){ toast('لا يمكن حذف اللعبة الوحيدة — احذف النشاط بدلًا من ذلك','bad'); return; }
  gameEditCapture();
  GAME_EDIT.list.splice(i,1);
  if(GAME_EDIT.idx>=GAME_EDIT.list.length) GAME_EDIT.idx=GAME_EDIT.list.length-1;
  renderGameEditor();
}

/* تحويل نشاط عادي إلى نشاط ألعاب: البنك يبقى مصدرًا للألعاب ولا يُحذف،
   لكن الطالب لن يراه نشاط أسئلة بعد الآن. */
async function convertToGamesActivity(id){
  const h=HW.find(x=>x.id===id); if(!h) return;
  if(GAME_EDIT && GAME_EDIT.id===id) gameEditCapture();
  const ok=await askConfirm(
    `سيرى الطالب ${activityGames(h).length} ألعاب فقط، ولن تظهر الأسئلة كنشاط مستقل. الأسئلة تبقى محفوظة كمصدر للألعاب.`,
    { title:'تحويله إلى نشاط ألعاب؟', yes:'حوّله', no:'إبقاء النوع الحالي' });
  if(!ok) return;
  const res=await commitActivityContent(id,{kind:'games'});
  renderHw();
  if(!res.ok){ toast(res.error||'تعذّر التحويل','bad'); return; }
  let msg='تم تحويله إلى نشاط ألعاب';
  if(h.published){
    const done=await refreshPublishedActivity(id);
    renderHw();
    msg += done===true ? ' · وتم تحديثه عند الطلاب'
         : done===false ? ' · ⚠️ اضغط «أعد النشر» ليصل الطلاب' : '';
  }
  closeModal();
  toast(msg,'good');
}

/* إعادة بناء اللعبة المحددة من البنك المحفوظ — بلا استهلاك توكن */
function rebuildGameFromBank(id){
  const h=HW.find(x=>x.id===id); if(!h || !GAME_EDIT) return;
  const type=normalizeGameType(document.getElementById('game-type')?.value||gameEditEntry()?.type||'memory');
  try{
    const data=buildGameFromQuestionBank(type, h.qs||[], gameMeta(type).max);
    const e=gameEditEntry();
    e.type=type; e.data=data;
    renderGameEditor();
    toast(`تم بناء ${data.length} عنصرًا من البنك — راجعها ثم احفظ`,'good');
  }catch(e){
    toast((e&&e.message)||'تعذّر بناء اللعبة من البنك','bad');
  }
}

/* إعادة بناء اللعبة من البنك المحفوظ — بلا استهلاك توكن */

/* عدد أسئلة الاختيار في الملف قد يفوق حد اللعبة — نقصّه عند حدّ نوعها */
function exportStudentGameJson(id){
  const h=HW.find(x=>x.id===id); if(!h) return;
  if(GAME_EDIT && GAME_EDIT.id===id) gameEditCapture();
  const list=(GAME_EDIT && GAME_EDIT.id===id ? GAME_EDIT.list : activityGames(h))
    .filter(gameEntryReady)
    .map(g=>({type:normalizeGameType(g.type), data:g.data, prize:g.prize}));

  if(!list.length){ toast('أكمل محتوى لعبة واحدة على الأقل قبل التصدير','bad'); return; }

  /* نصدّر بنك الأسئلة مع الألعاب حتى يمكن إعادة بناء أي لعبة من الملف نفسه */
  const payload={
    app:'activity-book', type:'student_game', version:3,
    exportedAt:new Date().toISOString(),
    title:h.title||'', kind:h.kind||'normal',
    questions:(h.qs||[]).filter(q=>q&&q.t),
    game:list[0],
    games:list
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  const safe=String(h.title||'لعبة').replace(/[\\/:*?"<>|]+/g,'_').trim()||'لعبة';
  a.href=url;a.download=`${safe}_games.json`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast(`تم تصدير ${list.length} لعبة كملف JSON`,'good');
}

/* يقرأ أي ملف: تصدير البوابة (v1/v2/v3) أو ملف الألعاب التعليمية،
   ويستخرج منه كلمات كشف الكلمات وأسئلة القفل معًا، ثم يملأ المحرر المفتوح. */
function collectGameContentFromJson(root){
  const words=[]; const lockQs=[]; const bank=[]; const seen=new Set();
  const pushWord=v=>{ const s=String(v??'').trim(); if(s) words.push(s); };
  const pushLock=(q,o,a)=>{
    const opts=(Array.isArray(o)?o:[]).map(x=>String(x??'').trim()).filter(Boolean).slice(0,4);
    const qq=String(q??'').trim();
    if(!qq||opts.length<2) return;
    let ai=Number(a);
    if(!Number.isInteger(ai)||ai<0||ai>=opts.length) ai=0;
    lockQs.push({q:qq,o:opts,a:ai});
  };
  const readQuestion=x=>{
    if(!x||typeof x!=='object') return;
    const t=String(x.t||x.type||'').toLowerCase();
    if(t==='memory'){ pushWord(x.word??x.w??x.term??x.text); return; }
    if(t==='q'||t==='quiz'||t==='mcq'){
      const o=Array.isArray(x.o)?x.o:(Array.isArray(x.opts)?x.opts:[]);
      let a=x.a;
      if(typeof a==='string'){ const i=o.map(v=>String(v)).indexOf(a); a=i<0?0:i; }
      if(!Number.isInteger(Number(a)) && typeof x.answer!=='undefined'){
        const i=o.map(v=>String(v)).indexOf(String(x.answer)); a=i<0?0:i;
      }
      pushLock(x.q, o, a);
      bank.push({t:'q',q:String(x.q||'').trim(),o:o.map(v=>String(v).trim()),a:Number(a)||0});
    }
  };
  const visit=(node,depth)=>{
    if(!node||typeof node!=='object'||depth>10||seen.has(node)) return;
    seen.add(node);
    if(Array.isArray(node)){ node.forEach(v=>visit(v,depth+1)); return; }
    if(Array.isArray(node.memory)) node.memory.forEach(v=>pushWord(typeof v==='string'?v:(v&&(v.word??v.w??v.term??v.text))));
    if(node.game && typeof node.game==='object' && Array.isArray(node.game.data)){
      const gt=String(node.game.type||'').toLowerCase();
      if(gt==='memory') node.game.data.forEach(v=>pushWord(typeof v==='string'?v:(v&&(v.word??v.w))));
      if(gt==='lock') node.game.data.forEach(v=>pushLock(v&&v.q, v&&v.o, v&&v.a));
    }
    if(Array.isArray(node.questions)) node.questions.forEach(readQuestion);
    if(Array.isArray(node.quiz)) node.quiz.forEach(readQuestion);
    for(const [k,v] of Object.entries(node)){
      if(['memory','game','questions','quiz'].includes(k)) continue;
      if(v&&typeof v==='object') visit(v,depth+1);
    }
  };
  visit(root,0);
  const seenQ=new Set();
  const lock=lockQs.filter(x=>{ const k=x.q+'|'+x.o.join('~'); if(seenQ.has(k)) return false; seenQ.add(k); return true; });
  return {
    words:[...new Set(words.filter(Boolean))].slice(0,20),
    lock:lock.slice(0,10),
    bank
  };
}

function importStudentGameJson(ev,id){
  const file=ev.target.files?.[0]; if(!file) return;
  const input=ev.target; input.value='';
  const reader=new FileReader();

  reader.onload=()=>{
    try{
      if(!GAME_EDIT || GAME_EDIT.id!==id) throw new Error('نافذة الألعاب غير مفتوحة.');
      const root=JSON.parse(String(reader.result||''));
      gameEditCapture();

      // ملف يحمل عدة ألعاب جاهزة → أضفها كما هي
      const rawList=Array.isArray(root.games)?root.games
                   :(root.game?[root.game]:[]);
      const ready=rawList
        .filter(g=>g && g.type && Array.isArray(g.data))
        .map(g=>({type:normalizeGameType(g.type),data:g.data}))
        .filter(gameEntryReady);

      if(ready.length){
        const cur=gameEditEntry();
        cur.type=ready[0].type; cur.data=ready[0].data.slice();
        let added=0;
        ready.slice(1).forEach(g=>{
          if(GAME_EDIT.list.length>=MAX_GAMES_PER_ACTIVITY) return;
          GAME_EDIT.list.push({type:g.type,data:g.data.slice()}); added++;
        });
        renderGameEditor();
        toast(`تم استيراد ${ready.length} لعبة${added?` (أُضيفت ${added} لعبة جديدة)`:''} — راجعها ثم احفظ`,'good');
        return;
      }

      // وإلا: استخرج المحتوى من أي ملف (بنك أسئلة أو ملف الألعاب التعليمية)
      const found=collectGameContentFromJson(root);
      const cur=gameEditEntry();
      let type=normalizeGameType(cur.type);
      if(isMcqGameType(type) && found.lock.length<2 && found.words.length>=2) type='memory';
      if(!isMcqGameType(type) && found.words.length<2 && found.lock.length>=2) type='lock';

      if(isMcqGameType(type)){
        if(found.lock.length<2) throw new Error('لم أجد أسئلة اختيار من متعدد صالحة في الملف.');
        cur.type=type; cur.data=found.lock.slice(0,gameMeta(type).max);
      }else{
        let words=found.words;
        if(words.length<2 && found.bank.length){
          words=[...new Set(found.bank.map(q=>String(q.o?.[q.a]||'').trim()).filter(Boolean))];
        }
        if(words.length<2) throw new Error('لم أجد كلمات أو إجابات صالحة لبناء كشف الكلمات.');
        cur.type='memory'; cur.data=words.slice(0,gameMeta('memory').max);
      }
      renderGameEditor();
      toast(`تم استيراد ${cur.data.length} عنصرًا — راجعها ثم احفظ`,'good');
    }catch(e){
      console.error('importStudentGameJson:',e);
      toast(e?.message||'الملف غير صالح','bad');
    }
  };

  reader.readAsText(file,'utf-8');
}


async function saveStudentGameSettings(id){
  const h=HW.find(x=>x.id===id);
  if(!h || !GAME_EDIT){ toast('نافذة الألعاب غير مفتوحة','bad'); return; }

  gameEditCapture();
  const list=GAME_EDIT.list.filter(g=>g && Array.isArray(g.data) && g.data.length);
  const bad=list.find(g=>!gameEntryReady(g));
  if(bad){ toast(`${gameTypeLabel(bad.type)}: ${gameMeta(bad.type).min} عناصر على الأقل`,'bad'); return; }
  if(!list.length){ toast('أضف محتوى للعبة واحدة على الأقل','bad'); return; }

  const btn=[...document.querySelectorAll('#veil .modal-foot button')]
    .find(b=>b.textContent.includes('حفظ الألعاب'));
  if(btn){ btn.disabled=true; btn.textContent='جارٍ الحفظ…'; }

  /* نشاط عادي مرفق به ألعاب يبقى عاديًا؛ لا نحوّله إلى «ألعاب» فنلغي أسئلته */
  const res=await commitActivityContent(id,{
    games:list.map(g=>({type:g.type,data:g.data,prize:g.prize,source:'manual'})),
    kind:isGamesKind(h)?'games':undefined
  });

  if(!res.ok){
    renderHw();
    toast(res.error||'تعذّر حفظ الألعاب','bad');
    if(btn){ btn.disabled=false; btn.textContent='حفظ الألعاب'; }
    return;
  }

  GAME_EDIT=null;
  closeModal();
  renderHw();
  let msg = list.length>1
    ? `تم حفظ ${list.length} ألعاب`
    : `تم حفظ ${gameTypeLabel(list[0].type)}`;
  if(!res.synced) msg += ' على الجهاز — المزامنة لاحقًا';
  if(h.published){
    const done=await refreshPublishedActivity(id);
    renderHw();
    msg += done===true ? ' · تم تحديثها عند الطلاب'
         : done===false ? ' · ⚠️ لم تُحدَّث عند الطلاب، اضغط «أعد النشر»' : '';
  }
  toast(msg,'good');
}

async function saveQs(id){
  const skm=[], qsPush=(r,x)=>{ qs.push(qRowSkApply(r,Object.assign(qRowKeep(r),x))); const e=r.querySelector('.f-skm'); skm.push(e&&!e.disabled?e.value:null); };
  const h = HW.find(x=>x.id===id);
  if(!h) return;

  const qs = [];
  [...document.querySelectorAll('#qs-box [data-q]')].forEach(r=>{
    const k = r.dataset.k;
    const val = sel => {
      const e = r.querySelector(sel);
      return e ? e.value.trim() : '';
    };
    const stage = QS_KIND==='reading'
      ? (r.querySelector('.f-stage')?.value || 'during')
      : null;
    const picked = r.querySelector('input[type=radio]:checked');

    if(k==='q'){
      const q = val('.f-q');
      const o = [...r.querySelectorAll('.f-o')].map(x=>x.value.trim()).filter(Boolean);
      if(!q || o.length<2) return;
      if(QS_KIND==='style'){
        const tags=['بصري','سمعي','حركي','قرائي/كتابي'];
        qsPush(r,Object.assign({t:'q',q,o,a:0,tags:tags.slice(0,o.length)},QS_KIND==='reading'?readingRowExtra(r,stage):{}));
      }else{
        qsPush(r,Object.assign({t:'q',q,o,a:Math.min(picked?+picked.value:0,o.length-1)},QS_KIND==='reading'?readingRowExtra(r,stage):{}));
      }
    }else if(k==='tf'){
      const q=val('.f-q'); if(!q) return;
      qsPush(r,Object.assign({t:'tf',q,a:picked ? picked.value==='1' : true},QS_KIND==='reading'?readingRowExtra(r,stage):{}));
    }else if(k==='f'){
      const q=val('.f-q'),a=val('.f-a'); if(!q||!a) return;
      qsPush(r,Object.assign({t:'f',q,a},QS_KIND==='reading'?readingRowExtra(r,stage):{}));
    }else if(k==='a'){
      const w=val('.f-w'); if(!w) return;
      qsPush(r,Object.assign({t:'a',w,h:val('.f-h')},QS_KIND==='reading'?readingRowExtra(r,stage):{}));
    }else if(k==='s'){
      const s=val('.f-s'); if(!s||s.split(/\s+/).length<2) return;
      qsPush(r,Object.assign({t:'s',s},QS_KIND==='reading'?readingRowExtra(r,stage):{}));
    }else if(k==='m'){
      const left=[...r.querySelectorAll('.f-l')].map(x=>x.value.trim());
      const right=[...r.querySelectorAll('.f-r')].map(x=>x.value.trim());
      const pairs=left.map((l,j)=>[l,right[j]||'']).filter(x=>x[0]&&x[1]);
      if(pairs.length<2) return;
      qsPush(r,Object.assign({t:'m',p:pairs},QS_KIND==='reading'?readingRowExtra(r,stage):{}));
    }
  });

  if(!qs.length){
    toast('لم تُحفظ أي مهمة — أكمل الحقول المطلوبة','bad');
    return;
  }

  // نقطة الحفظ الموحّدة: كتابة محلية ← تحقق ← مزامنة ← تحديث النشر إن كان منشورًا
  const res = await commitActivityContent(id, {qs, dropDraft:true});
  renderHw();
  if(!res.ok){ toast(res.error||'تعذّر تثبيت الأسئلة','bad'); return; }

  closeModal();
  // 🎯 نواتج الأسئلة كما راجعها المعلم: تُحفظ «يدوية» فلا يغيّرها التصنيف الآلي لاحقًا
  if(QS_SKH&&QS_SKMAP&&skm.some(v=>v!==null)){
    try{ const map={}; skm.forEach((v,i)=>{ if(v) map[i]=v; });
      const r=await fetch(getApi().replace(/\/+$/,'')+'/skills',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),hw:QS_SKH,hash:twinHash(h),map,manual:true})});
      if(r.ok){ const all=qs.every((q,i)=>!['q','tf','f'].includes(q.t||'q')||skm[i]); if(all){ h.skillsHash=twinHash(h); save(K.hw,HW); } }
    }catch(e){}
  }
  QS_SKH='';
  let msg = res.synced
    ? `تم حفظ ${qs.length} مهمة ومزامنتها بنجاح`
    : `تم حفظ ${qs.length} مهمة على الجهاز — المزامنة ستتم لاحقًا`;
  if(h.published){
    const done = await refreshPublishedActivity(id);
    renderHw();
    msg += done===true ? ' · تم تحديثها عند الطلاب'
         : done===false ? ' · ⚠️ لم تُحدَّث عند الطلاب، اضغط «أعد النشر»' : '';
  }
  toast(msg,'good');
}
// يحوّل النص إلى base64 آمن للروابط (للرابط البديل عند فشل النشر)
function strToB64(s){
  const bytes = new TextEncoder().encode(s);
  let bin=''; bytes.forEach(b=>bin+=String.fromCharCode(b));
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function toggleHwSelection(id, checked){
  if(checked) HW_REPUBLISH_SELECTED.add(id);
  else HW_REPUBLISH_SELECTED.delete(id);
  renderHw();
}

function toggleAllHwSelection(checked){
  const filter = (document.getElementById('hw-filter') || {}).value || 'all';
  // نفس القائمة المعروضة في renderHw تمامًا: فلتر النوع + فلتر الحالة (م1)
  const hwKind = (document.getElementById('hw-kind-filter') || {}).value || '';
  const kindOf = h => h.remedial ? 'remedial' : (isGamesKind && isGamesKind(h) ? 'games' : (h.kind || 'normal'));
  const today = new Date();
  HW.forEach(h=>{
    if(!h || h.__examProxy) return;
    if(hwKind && kindOf(h) !== hwKind) return;
    const overdue = h.due && new Date(h.due+'T23:59:59') < today;
    let visible = true;
    if(filter==='draft') visible=!h.published;
    else if(filter==='dirty') visible=!!h.dirty;
    else if(filter==='open') visible=!!h.published && !h.dirty && !overdue;
    else if(filter==='overdue') visible=!!overdue && !!h.published;
    else if(filter==='empty') visible = (h.kind === 'files' || h.kind === 'lab') ? false : !activityReady(h);
    if(visible){
      if(checked) HW_REPUBLISH_SELECTED.add(h.id);
      else HW_REPUBLISH_SELECTED.delete(h.id);
    }
  });
  renderHw();
}

function publishContentCount(h){
  if(!h) return 0;
  if(h.kind==='files' || h.kind==='lab') return 0;
  const gCount=activityGames(h).filter(gameEntryReady).reduce((n,g)=>n+g.data.length,0);
  if((h.kind==='games' || h.kind==='game')) return gCount;
  const qCount=Array.isArray(h.qs) ? h.qs.length : 0;
  return qCount || gCount;
}

async function republishSelectedHw(){
  const items=HW.filter(h=>HW_REPUBLISH_SELECTED.has(h.id) && h.published && activityReady(h));
  if(!items.length){ toast('حدد نشاطاً واحداً على الأقل','bad'); return; }
  await republishHwBatch(items);
}


function deleteSelectedHw(){
  const items=HW.filter(h=>HW_REPUBLISH_SELECTED.has(h.id));
  if(!items.length){ toast('حدد نشاطاً واحداً على الأقل','bad'); return; }
  openModal(`<h2>حذف ${items.length} نشاط؟</h2>
    <p style="color:var(--ink-soft)">سيتم حذف الأنشطة المحددة من جهازك ومن الخادم، وستختفي عن الطلاب. لا يمكن التراجع عن هذا الإجراء.</p>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn pen" onclick="doDeleteSelectedHw()">حذف الأنشطة</button>
    </div>`);
}

async function doDeleteSelectedHw(){
  const items=HW.filter(h=>HW_REPUBLISH_SELECTED.has(h.id));
  if(!items.length){ closeModal(); return; }
  const api=getApi(), tok=getTok();
  if(!api || !tok){ closeModal(); toast('اضبط عنوان الخادم وكلمة السر أولاً','bad'); return; }
  closeModal();
  openModal(`<h2>جارٍ حذف الأنشطة…</h2><p id="delete-hw-progress" style="color:var(--ink-soft)">0 من ${items.length}</p>`);
  let ok=0, failed=0;
  beginLocalMutation();
  try{
    for(let i=0;i<items.length;i++){
      const h=items[i];
      const progress=document.getElementById('delete-hw-progress');
      if(progress) progress.textContent=`جارٍ حذف: ${h.title} (${i+1} من ${items.length})`;
      try{
        if(h.sid){
          const r=await fetch(`${api}/unpublish?t=${encodeURIComponent(tok)}&id=${encodeURIComponent(h.sid)}&local=${encodeURIComponent(h.id)}`);
          const j=await r.json();
          syncAbsorbSavedAt(j);   // 🔑 لا تعارض وهمي بعد هذه العملية
          if(r.status===401) throw new Error('unauthorized');
          if(!r.ok || !j.ok) throw new Error('delete');
        }
        HW=HW.filter(x=>x.id!==h.id);
        HW_REPUBLISH_SELECTED.delete(h.id);
        ok++;
        save(K.hw,HW);
      }catch(e){
        console.error('deleteSelectedHw:',h.id,e);
        failed++;
        if(e.message==='unauthorized'){ closeModal(); toast('كلمة السر غير صحيحة','bad'); return; }
      }
    }
    try{ await pushStateNow(); }catch(e){}
  }finally{
    endLocalMutation();
  }
  closeModal();
  renderHw();
  if(ok && !failed) toast(`تم حذف ${ok} نشاطاً`,'good');
  else if(ok) toast(`تم حذف ${ok} نشاطاً وتعذر حذف ${failed}`,'bad');
  else toast('تعذر حذف الأنشطة المحددة','bad');
}

async function republishHwBatch(items){
  const api=getApi(), tok=getTok();
  if(!api || !tok){ toast('اضبط عنوان الخادم وكلمة السر أولاً','bad'); return; }
  openModal(`<h2>جارٍ إعادة نشر الأنشطة…</h2><p id="republish-progress" style="color:var(--ink-soft)">0 من ${items.length}</p>`);
  let ok=0, failed=0;
  for(let i=0;i<items.length;i++){
    const h=items[i];
    const progress=document.getElementById('republish-progress');
    if(progress) progress.textContent=`جارٍ إعادة نشر: ${h.title} (${i+1} من ${items.length})`;
    try{
      await publishHwSilently(h);
      HW_REPUBLISH_SELECTED.delete(h.id);
      ok++;
      save(K.hw,HW);
    }catch(e){
      console.error('republish:',h.id,e);
      failed++;
      if(e.message==='unauthorized'){
        closeModal(); toast('كلمة السر غير صحيحة','bad'); return;
      }
    }
  }
  save(K.hw,HW);
  closeModal();
  renderHw();
  if(ok && !failed) toast(`تمت إعادة نشر ${ok} رابطاً`,'good');
  else if(ok) toast(`تمت إعادة نشر ${ok} رابطاً وتعذر إعادة نشر ${failed}`,'bad');
  else toast('تعذرت إعادة نشر الأنشطة','bad');
}

let PUBLISH_BUSY = false;
async function openLink(id){
  // 🔒 امنع أي نشر متوازٍ، وأوقف مزامنة /state أثناء دورة النشر نفسها.
  // النشر و /state يكتبان نفس النشاط، وتشغيلهما بالتوازي كان سببًا مباشرًا
  // لاختفاء النشاط أو ظهور نسخة ثانية بعد حل تعارض المزامنة.
  if(PUBLISH_BUSY){ toast('جارٍ النشر… انتظر لحظة','bad'); return; }
  const h = HW.find(x=>x.id===id); if(!h) return;
  if(!activityReady(h)){ toast(activityEmptyMsg(h), 'bad'); if(isGamesKind(h)) openStudentGameSettings(id); else openQs(id); return; }

  // ⛔ لا تنشر ألعابًا يحذفها خادم قديم بصمت
  const gl=activityGames(h).filter(gameEntryReady);
  const needsNewServer = gl.length>1 || gl.some(g=>g.type!=='memory');
  if(needsNewServer && await checkServerGames()===false){
    const go=await askConfirm(
      'الخادم المنشور نسخة قديمة: سيصل الطالب «كشف الكلمات» فقط وتُحذف بقية الألعاب بصمت. انشر ملف الـWorker الجديد أولًا.',
      { title:'⛔ الخادم لا يدعم هذه الألعاب', yes:'انشر رغم ذلك', no:'إيقاف', danger:true });
    if(!go) return;
  }
  const site = getSite();
  if(!site){ toast('ضع عنوان صفحة الطالب في تبويب البيانات', 'bad'); return; }

  PUBLISH_BUSY = true;
  beginLocalMutation();
  clearTimeout(_pushT);
  _syncGeneration++;

  try{
    hwShortId(h);
    const pool = (hwPool(h));
    h.roster = pool.map(s=>s.id);
    save(K.hw, HW);

    const payload = Object.assign(buildPublishPayload(h), {
      pg: h.kind === 'files' && !!h.projectGraded
    });
    const api = getApi(), tok = getTok();
    const base = site.replace(/\/+$/,'');
    const longUrl = base + '/#h=' + strToB64(JSON.stringify(payload));

    // بدون خادم: الرابط الطويل فقط، مع إبقاء الحفظ المحلي.
    if(!api || !tok){
      showLinkModal(longUrl, pool.length, publishContentCount(h), false);
      return;
    }

    openModal('<h2>جارٍ نشر النشاط…</h2><p style="color:var(--ink-soft)">يتم النشر ثم تثبيت حالة المزامنة.</p>');
    const r = await fetch(api.replace(/\/+$/,'') + '/publish', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ t: tok, id: h.sid, payload })
    });

    let j = null;
    try{ j = await r.json(); }catch(e){}
    if(r.status === 401){ throw new Error('unauthorized'); }
    if(!r.ok || !j || !j.ok){
      throw new Error('publish');
    }

    // ثبّت نتيجة النشر محليًا قبل إعادة تشغيل المزامنة.
    h.published = true;
    delete h.dirty;
    if(!h.firstPub) h.firstPub = (h.publishedAt && hwAssignedAt(h)) || Date.now();   // نشاط قديم بلا firstPub: وقته الأبكر المعروف لا يوم إعادة النشر
    h.publishedAt = Date.now();
    save(K.hw, HW);
    try{ if(REM_ON&&twinAuto()) twinQueue(h); }catch(e){}
    try{ skillQueue(h); }catch(e){}

    // إذا أعاد /publish ختم الحالة، امتصّه حتى لا ينتج 409 وهمي في /state.
    syncAbsorbSavedAt(j);

    // نجاح /publish هو نجاح نشر النشاط نفسه. مزامنة دفتر المعلم خطوة لاحقة؛
    // لا يجوز أن تحوّل تعثرها إلى رسالة «تعذّر النشر» بعد أن صار النشاط منشورًا.
    // ⚡ الرابط يظهر فور نجاح النشر، والمزامنة تكمل في الخلفية (كان المعلم ينتظرها).
    renderHw();
    showLinkModal(base + '/#' + h.sid, pool.length, publishContentCount(h), true);
    pushStateNow().catch(stateErr=>{
      console.warn('publish activity: state sync after publish failed:', stateErr);
      toast('تم نشر النشاط على الخادم، لكن تعذر تحديث دفتر المزامنة مؤقتًا','bad');
    });
  }catch(e){
    closeModal();
    if(e && e.message === 'unauthorized'){
      toast('كلمة السر غير صحيحة','bad');
    }else{
      toast('تعذّر النشر — لم يتم اعتباره منشورًا','bad');
      console.error('publish activity:', e);
    }
  }finally{
    endLocalMutation();
    PUBLISH_BUSY = false;
  }
}

function showLinkModal(url, students, count, short){
  openModal(`
    <h2>رابط الطالب</h2>
    <p style="color:var(--ink-soft);font-size:.86rem;margin:.2rem 0 .8rem">
      ${students} طالب · ${count ? count+' مهمة' : '📎 تسليم صور أو PDF'}${short ? ' · <b style="color:var(--tick)">منشور على الخادم</b>' : ''}
    </p>
    <textarea class="inp" id="lnk" rows="${short?2:4}" readonly
      style="font-size:${short?'1rem':'.72rem'};direction:ltr;text-align:center;font-weight:${short?'700':'400'}">${esc(url)}</textarea>
    ${short ? '' : '<p style="color:var(--pen);font-size:.8rem;margin:.5rem 0 0">رابط طويل — اضبط عنوان الخادم وكلمة السر في تبويب البيانات لتحصل على رابط قصير.</p>'}
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إغلاق</button>
      <button class="btn tick" onclick="copyLink()">نسخ الرابط</button>
    </div>`);
}
function copyLink(){
  const el = document.getElementById('lnk');
  el.select(); el.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(el.value)
    .then(()=>toast('نُسخ الرابط','good'))
    .catch(()=>{ document.execCommand('copy'); toast('نُسخ الرابط','good'); });
}

/* ═══════════════ 💬 رسائل جاهزة للأنشطة ═══════════════ */
function activityShareLink(h){
  const site=getSite().replace(/\/+$/,'');
  if(!site) return '';
  hwShortId(h);
  return `${site}/#${h.sid}`;
}

function activityMessage(h){
  const link=activityShareLink(h);
  const title=String(h.title||'النشاط').trim();
  const cls=hwClasses(h).join('، ');
  const classText=cls ? `طلاب ${cls}` : 'أبنائنا الطلاب';

  if(h.kind==='diag'){
    return `السلام عليكم ورحمة الله وبركاته 🌷\n\nأولياء الأمور الكرام،\nنأمل من ${classText} الدخول على الرابط المرفق وأداء الاختبار التشخيصي لمادة العلوم.\n\n🎯 يهدف الاختبار إلى التعرف على مستوى الطلاب في المهارات والمفاهيم العلمية الأساسية، ومساعدتنا في تحديد الجوانب التي تحتاج إلى تعزيز ومراجعة.\n\n📝 الاختبار التشخيصي: ${title}\n\n🔗 ${link}\n\nشاكرين لكم تعاونكم ودعمكم لأبنائكم 🌹`;
  }

  if(h.kind==='style'){
    return `السلام عليكم ورحمة الله وبركاته 🌷\n\nأبنائي الطلاب،\nأرجو الدخول على الرابط المرفق وأداء اختبار أنماط التعلّم في مادة العلوم بهدوء وعناية، واختيار الإجابات التي تعبّر عنكم بشكل صادق.\n\n🧠 اختبار أنماط التعلّم: ${title}\n\n🔗 ${link}\n\nمع تمنياتي لكم بالتوفيق 🌹`;
  }

  if(h.kind==='files'){
    return `السلام عليكم ورحمة الله وبركاته 🌷\n\nأبنائي الطلاب،\nأرجو تنفيذ المشروع أو التجربة العلمية المطلوبة، ثم الدخول على الرابط المرفق ورفع صور تنفيذكم بوضوح.\n\n🔬 المشروع / التجربة: ${title}\n\n📸 احرصوا على أن تكون الصور واضحة وتُظهر تنفيذ العمل وخطواته.\n\n🔗 ${link}\n\nمع تمنياتي لكم بالتوفيق والاستفادة 🌹`;
  }

  return `السلام عليكم ورحمة الله وبركاته 🌷\n\nأبنائي الطلاب،\nأرجو الدخول على الرابط المرفق وحل أسئلة النشاط، والذي يتضمن تطبيقًا ومراجعة لما تم دراسته في مادة العلوم.\n\n📚 النشاط: ${title}\n\n🔗 ${link}\n\nمع تمنياتي لكم بالتوفيق والنجاح 🌹`;
}

async function copyActivityMessage(btn){
  const message=btn?.getAttribute('data-message') || '';
  if(!message){ toast('لا توجد رسالة للنسخ','bad'); return; }
  let copied=false;
  try{
    if(navigator.clipboard?.writeText){ await navigator.clipboard.writeText(message); copied=true; }
  }catch(_){ }
  if(!copied){
    try{
      const area=document.createElement('textarea');
      area.value=message; area.setAttribute('readonly','');
      area.style.position='fixed'; area.style.left='-9999px'; area.style.top='0';
      document.body.appendChild(area); area.focus(); area.select();
      area.setSelectionRange(0,area.value.length);
      copied=document.execCommand('copy'); area.remove();
    }catch(_){ }
  }
  if(copied){
    toast('تم نسخ الرسالة الجاهزة','good');
    const old=btn.innerHTML; btn.innerHTML='✅ تم النسخ';
    setTimeout(()=>{ if(btn.isConnected) btn.innerHTML=old; },1200);
  }else toast('تعذّر نسخ الرسالة، حاول مرة أخرى','bad');
}

function openActivityMessage(id){
  const h=HW.find(x=>x.id===id);
  if(!h) return;
  if(!h.published){
    toast('انشر النشاط أولاً ثم انسخ الرسالة','bad');
    return;
  }
  const message=activityMessage(h);
  openModal(`
    <h2>💬 رسالة جاهزة للإرسال</h2>
    <p style="color:var(--ink-soft);font-size:.84rem;margin:.2rem 0 .7rem">${esc(h.title)} · ${esc(hwClsLabel(h))}</p>
    <textarea class="thanks-message" id="activity-share-message" readonly>${esc(message)}</textarea>
    <div class="modal-foot">
      <button class="btn primary" type="button" data-message="${esc(message)}" onclick="copyActivityMessage(this)">📋 نسخ الرسالة</button>
      <button class="btn ghost" type="button" onclick="closeModal()">إغلاق</button>
    </div>`);
}
function espDateMs(v){ if(!v) return 0; const t=new Date(v).getTime(); return Number.isFinite(t)?t:0; }
async function saveExamShopPolicy(){
  const api=getApi(),tok=getTok();if(!api||!tok){toast('اضبط عنوان الخادم وكلمة السر أولًا','bad');return;}
  if(!ESP_LOADED){loadExamShopPolicy(false);toast('إعدادات المتجر لم تُحمَّل من الخادم بعد — جرّب الحفظ مجددًا بعد اكتمال التحميل','bad');return;}
  const sem=espSemester();
  const startAt=espDateMs(document.getElementById('esp-start')?.value),endAt=espDateMs(document.getElementById('esp-end')?.value); if(startAt&&endAt&&endAt<=startAt){toast('موعد الانتهاء يجب أن يكون بعد موعد البداية','bad');return;}
  const students={...(EXAM_SHOP_POLICY.students||{})};
  const liveIds=new Set((Array.isArray(STUDENTS)?STUDENTS:[]).map(s=>String(s.id||'')).filter(Boolean));
  if(liveIds.size) Object.keys(students).forEach(k=>{ if(!liveIds.has(k)) delete students[k]; });
  document.querySelectorAll('[data-esp-sid]').forEach(el=>{const sid=el.dataset.espSid;if(!sid) return;const v=el.value;if(v==='') delete students[sid]; else {const n=Number(v);if(!Number.isFinite(n)) delete students[sid]; else students[sid]=Math.round(Math.min(20,Math.max(0,n))*2)/2;}});
  const body={t:tok,semester:sem,enabled:document.getElementById('esp-enabled')?.value!=='0',maxPerStudent:Math.min(20,Math.max(0,Number(document.getElementById('esp-max')?.value)||0)),startAt,endAt,students};
  try{const r=await fetch(`${api}/exam-shop-policy`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok||!j.ok){toast(j.error==='bad_window'?'موعد الإتاحة غير صحيح':'تعذّر حفظ الإعدادات','bad');return;}EXAM_SHOP_POLICY=j.policy;renderExamShopStatus();renderExamShopStudents();toast(`تم حفظ إعدادات الفصل الدراسي ${sem} ✅`,'good');}catch(e){toast('تعذّر الاتصال بالخادم','bad');}
}
/* ↩️ مشتريات رفع الاختبار التي تجاوزت 20 فلم تُضف درجة: يسترجع المعلم نقاط الجزء الضائع (الخادم يحسبها من سجل الشراء) */
let EBW_ROWS=null;
async function ebwLoad(){
  const box=document.getElementById('ebw-box'); if(!box) return; const api=getApi(),tok=getTok(); if(!api||!tok){toast('اضبط عنوان الخادم وكلمة السر أولًا','bad');return;}
  box.textContent='⏳ جارٍ الفحص…';
  try{ const j=await (await fetch(`${api.replace(/\/+$/,'')}/exam-bonus-waste?t=${encodeURIComponent(tok)}&_=${Date.now()}`,{cache:'no-store'})).json(); if(!j.ok) throw new Error(j.error||''); EBW_ROWS=j.rows||[]; ebwRender(); }
  catch(e){ box.textContent=/unauthorized|not found|404/.test(String(e.message))?'انشر worker.js الأخير أولًا.':'تعذّر الفحص — تحقق من الاتصال.'; }
}
function ebwRender(){
  const box=document.getElementById('ebw-box'); if(!box||!EBW_ROWS) return;
  if(!EBW_ROWS.length){ box.innerHTML='✅ لا توجد مشتريات ضائعة — كل بطاقة اشتراها طالب أضافت درجة فعلًا.'; return; }
  const n=v=>String(Math.round(Number(v)*100)/100);
  box.innerHTML=`<div style="display:grid;gap:.45rem">${EBW_ROWS.map((r,i)=>`<div class="exam-shop-student"><div><b>${esc(r.name)}</b><small>${esc(r.cls||'')} · الفصل ${r.semester} · الفترة ${r.period} · درجته ${n(r.base)}/20 + بطاقات ${n(r.bonus)} ⇒ ضاع ${n(r.over)} درجة</small></div>
    ${(()=>{const gone=!(STUDENTS||[]).some(s=>String(s.id||'')===String(r.sid||''));const bad=gone||!(Number(r.refund)>0);return `<button class="btn tick sm" type="button" ${bad?`disabled title="${gone?'الطالب غير موجود الآن':'لا يوجد مبلغ للاسترجاع'}"`:''} onclick="ebwRefund(${i})">↩️ استرجع ${r.refund} نقطة</button>`;})()}</div>`).join('')}</div>`;
}
async function ebwRefund(i){
  const r=EBW_ROWS&&EBW_ROWS[i]; if(!r) return;
  if(!(Number(r.refund)>0)){toast('لا يوجد مبلغ للاسترجاع','bad');return;}
  if(!(STUDENTS||[]).some(s=>String(s.id||'')===String(r.sid||''))){toast('الطالب غير موجود الآن','bad');return;}
  if(!confirm(`استرجاع ${r.refund} نقطة إلى ${r.name}؟\nتُحذف من بطاقاته الـ${String(r.over)} درجة الزائدة عن 20 (لم تكن تُحسب أصلًا).`)) return;
  try{ const j=await (await fetch(`${getApi().replace(/\/+$/,'')}/exam-bonus-refund`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),sid:r.sid,semester:r.semester,period:r.period})})).json();
    if(!j.ok) throw new Error(j.error||''); toast(`↩️ رجعت ${j.refund} نقطة إلى ${r.name} — رصيده الآن ${j.bal}`,'good'); EBW_ROWS.splice(i,1); ebwRender();
  }catch(e){ toast(String(e.message)==='nothing'?'لا يوجد ما يُسترجع — ربما استُرجع من قبل':'تعذّر الاسترجاع','bad'); ebwLoad(); }
}
function clearExamShopWindow(){if(document.getElementById('esp-enabled'))document.getElementById('esp-enabled').value='1';if(document.getElementById('esp-start'))document.getElementById('esp-start').value='';if(document.getElementById('esp-end'))document.getElementById('esp-end').value='';saveExamShopPolicy();}
function setAllExamShopStudentsToDefault(){if(!confirm(`إزالة جميع الحدود الخاصة لطلاب الفصل الدراسي ${espSemester()}؟`))return;EXAM_SHOP_POLICY.students={};document.querySelectorAll('[data-esp-sid]').forEach(el=>el.value='');renderExamShopStudents();saveExamShopPolicy();}
function openAllStorePurchases(){
  const list=Array.isArray(STORE_PURCHASES)?STORE_PURCHASES:[];
  const exam=list.filter(q=>q && q.kind==='exam-bonus');
  const totalSpent=list.reduce((n,q)=>n+(Number(q?.price)||0),0);
  const totalAdded=exam.reduce((n,q)=>n+(Number(q?.add)||0),0);
  const freshCount=list.filter(isStorePurchaseNew).length;
  openModal(`<h2>🛒 سجل عمليات شراء الطلاب</h2>
    <p style="color:var(--ink-soft);font-size:.82rem;margin:.2rem 0 .7rem">كل العمليات التي وصلت من متجر الطلاب${freshCount?` — منها ${freshCount} لم تُراجع`:''}.</p>
    <div class="store-purchase-stats">
      <div class="store-purchase-stat"><b>${list.length}</b><small>عملية شراء</small></div>
      <div class="store-purchase-stat"><b>${totalSpent.toLocaleString('ar-SA')}</b><small>نقطة مصروفة (كل المشتريات)</small></div>
      <div class="store-purchase-stat"><b>${gRoundStore(totalAdded)}</b><small>درجات مضافة (بطاقات رفع الاختبار)</small></div>
    </div>
    <div class="store-purchase-list" style="max-height:52vh">${list.length?list.map(q=>storePurchaseRowHTML(q,true)).join(''):`<div class="store-purchase-empty">لا توجد عمليات شراء.</div>`}</div>
    <div class="modal-foot">${freshCount?`<button class="btn tick" type="button" onclick="closeModal();markStorePurchasesSeen()">✓ تمت المراجعة</button>`:''}<button class="btn ghost" type="button" onclick="closeModal()">إغلاق</button></div>`);
}
function markStorePurchasesSeen(){
  const list=Array.isArray(STORE_PURCHASES)?STORE_PURCHASES:[];
  const newest=list.reduce((m,q)=>Math.max(m,Number(q?.at)||0),0);
  if(!newest){ renderStorePurchases(); return; }
  // ختم واحد فقط: نحذف الأختام الأقدم حتى لا تتراكم في حالة المزامنة
  Object.keys(DISMISSED_ALERTS).forEach(k=>{
    if(k.startsWith(SHOP_REVIEW_PREFIX) && k!==SHOP_REVIEW_PREFIX+newest){ delete DISMISSED_ALERTS[k]; delete _dismissedAlertPending[k]; }
  });
  const key=SHOP_REVIEW_PREFIX+newest;
  DISMISSED_ALERTS[key]=Date.now();
  _dismissedAlertPending[key]=true;
  uiSave(K_ALERTS_UI.dismissed, DISMISSED_ALERTS);
  pushState();   // ☁️ تختفي على كل أجهزتك
  renderStorePurchases();
  toast('تمت مراجعة عمليات الشراء ✓','good');
}


function previewThanksMessage(btn){
  const message = btn?.getAttribute('data-message') || '';

  if(!message){
    toast('لا توجد رسالة للعرض','bad');
    return;
  }

  const studentName =
    btn.closest('.attention-request')
      ?.querySelector('.attention-request-person b')
      ?.textContent
      ?.trim() || 'الطالب';

  openModal(`
    <h2>💌 رسالة الشكر — ${esc(studentName)}</h2>
    <p class="muted" style="font-size:.8rem;margin:.1rem 0 .5rem">أوصلها بالطريقة الأسهل لك: لمساحة الطالب في البوابة، أو انسخها لواتساب ولي الأمر — ثم «✓ تم» لإنهاء الطلب وتسجيلها في ملفه.</p>
    <div class="thanks-preview-inner thanks-modal-preview"></div>
    <div class="modal-foot">
      <button class="btn primary" onclick="copyThanksMessage(this)" data-message="${esc(message)}">📋 نسخ الرسالة</button>
    ${btn.dataset.sid ? `<button class="btn tick${thanksPortalAt(btn.dataset.key) ? ' tp-sent' : ''}" onclick="sendThanksToPortal(this)" data-message="${esc(message)}" data-sid="${esc(btn.dataset.sid)}" data-name="${esc(btn.dataset.name || '')}" data-key="${esc(btn.dataset.key || '')}">${thanksPortalLabel(btn.dataset.key, true)}</button>` : ''}
    ${btn.dataset.key ? `<button class="btn tick" onclick="doResolveReq('${esc(btn.dataset.key)}','sent')" title="يُزيل الطلب ويسجّل الرسالة في ملف الطالب">✓ تم — أنهِ الطلب</button>` : ''}
      <button class="btn ghost" onclick="closeModal()">إغلاق</button>
    </div>
  `);

  const preview = document.querySelector('.thanks-modal-preview');
  if(preview){
    preview.textContent = message;
  }
}
async function sendThanksToPortal(btn){
  const message = btn?.dataset.message || '', sid = btn?.dataset.sid || '', name = btn?.dataset.name || 'الطالب', key = btn?.dataset.key || '';
  if(!message || !sid){ toast('تعذّر تحديد الطالب', 'bad'); return; }
  const api = getApi(), tok = getTok(); if(!api || !tok){ toast('تحقق من إعدادات الاتصال', 'bad'); return; }
  if(thanksPortalAt(key) && !(await askConfirm(`أرسلت رسالة الشكر لمساحة ${name} من قبل. ترسلها مرة أخرى؟`, { title: 'إرسال مرة أخرى؟', yes: 'أرسل مجددًا', no: 'رجوع' }))) return;
  const label = btn.textContent; btn.disabled = true; btn.textContent = 'جارٍ الإرسال…';
  try{
    const r = await fetch(api.replace(/\/+$/, '') + '/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ t: tok, audience: 'students', title: '💌 رسالة شكر من معلمك', body: message, type: 'thanks', priority: 'important', recipients: [{ id: String(sid), name: String(name) }], reqKey: key || '' }) });
    const j = await r.json().catch(() => ({}));
    if(!r.ok || !j.ok) throw new Error(j.error || ('http_' + r.status));
    if(key){ const m = thanksPortalMap(); m[key] = Date.now(); try{ localStorage.setItem(TP_SENT_KEY, JSON.stringify(m)); }catch(e){} const q=(REQS||[]).find(x=>x.key===key); if(q){ q.portalAt=Date.now(); save(K.reqs, REQS); } }
    toast(`📨 وصلت رسالة الشكر إلى مساحة ${name} — اضغط «✓ تم» لإنهاء الطلب`, 'good'); try{ renderReqs(); }catch(e){}
    btn.disabled = false; btn.classList.add('tp-sent'); btn.textContent = thanksPortalLabel(key, btn.classList.contains('tick'));
    if(btn.classList.contains('tick')) btn.textContent = thanksPortalLabel(key);
    document.querySelectorAll('.attention-request-actions button[data-key]').forEach(b => { if(b.dataset.key === key && (b.getAttribute('onclick') || '').startsWith('sendThanksToPortal')){ b.classList.add('tp-sent'); b.textContent = thanksPortalLabel(key); } });
  }catch(e){ btn.disabled = false; btn.textContent = label; toast('تعذّر الإرسال — تحقق من الاتصال وحاول مجددًا', 'bad'); }
}

async function copyThanksMessage(btn){
  const message = btn?.getAttribute('data-message') || '';

  if(!message){
    toast('لا توجد رسالة للنسخ','bad');
    return;
  }

  let copied = false;

  try{
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(message);
      copied = true;
    }
  }catch(_){}

  if(!copied){
    try{
      const area = document.createElement('textarea');
      area.value = message;
      area.setAttribute('readonly','');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      area.style.top = '0';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.focus();
      area.select();
      area.setSelectionRange(0, area.value.length);
      copied = document.execCommand('copy');
      area.remove();
    }catch(_){}
  }

  if(copied){
    toast('تم نسخ رسالة الشكر باسم الطالب','good');

    const old = btn.innerHTML;
    btn.innerHTML = '✅ تم النسخ';

    setTimeout(()=>{
      if(btn.isConnected) btn.innerHTML = old;
    },1200);
  }else{
    toast('تعذّر نسخ الرسالة، حاول مرة أخرى','bad');
  }
}
function addThanks(name, cls, status){
  const list = thanksLog();
  list.push({ name, cls: cls||'', status, at: Date.now() });
  if(Array.isArray(THX_SERVER)) THX_SERVER = list; else save(K.thanks, list.slice(-2000));
  return list;
}

// ✅ نافذة تأكيد تمنع الضغط بالخطأ
function resolveReq(key, status){
  const q = REQS.find(x=>x.key===key);
  const name = q ? String(q.name||'').trim() : '';
  const sent = status !== 'skipped';
  openModal(`
    <h2>${sent ? '💌 تأكيد الإرسال' : '⏭️ تخطّي الطلب'}</h2>
    <p style="color:var(--ink-soft)">${sent
      ? `هل أرسلت رسالة الشكر لولي أمر <b>${esc(name)}</b>؟<br>سيُسجَّل ذلك في ملفه.`
      : `سيُسجَّل في ملف <b>${esc(name)}</b> أن رسالته <b style="color:var(--pen)">لم تُرسل</b>.`}</p>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">رجوع</button>
      <button class="btn ${sent?'tick':'pen'}" onclick="doResolveReq('${esc(key)}','${sent?'sent':'skipped'}')">
        ${sent ? 'نعم، أرسلتها' : 'سجّله كغير مُرسل'}</button>
    </div>`);
}

async function doResolveReq(key, status){
  closeModal();
  const api = getApi(), tok = getTok();
  const q = REQS.find(x=>x.key===key);
  const name = q ? String(q.name||'').trim() : '';
  const st = name ? (STUDENTS.find(x=>x.name===name) || STUDENTS.find(x=>normAr(x.name)===normAr(name))) : null;
  const sent = status !== 'skipped';
  try{
    const r = await fetch(`${api}/resolve?t=${encodeURIComponent(tok)}&key=${encodeURIComponent(key)}&status=${sent?'sent':'skipped'}&name=${encodeURIComponent(name)}&cls=${encodeURIComponent(st ? st.cls||'' : '')}`);
    const j = await r.json();
    if(!j.ok) throw 0;
    addThanks(name, st ? st.cls : '', sent ? 'sent' : 'skipped');
    REQS = REQS.filter(x=>x.key!==key);
    save(K.reqs, REQS);
    renderReqs(); updateReqBadge();
    toast(sent ? `سُجّلت رسالة ${name} كمُرسَلة ✓` : `سُجّل طلب ${name} كغير مُرسل`, sent?'good':'bad');
  }catch(e){ toast('تعذّر التنفيذ','bad'); }
}

/* 🔑 امتصاص الختم من أي عملية تعدّل حالة المعلم على الخادم مباشرة
   (/unpublish · /removestudent · /cleanup · /recover-activities).
   هذه المسارات ترفع ختم الخادم دون علم اللوحة، فيصطدم أول حفظ بعدها
   بتعارض وهمي ويظهر إشعار الدمج بلا سبب حقيقي. القاعدة (SYNC_BASE_STATE)
   تبقى كما هي — إنها ما زالت السلف المشترك، وسيُعاد ضبطها عند أول حفظ ناجح. */
function syncAbsorbSavedAt(j){
  const at = Number(j && j.savedAt) || 0;
  if(!at || at <= STATE_BASE_SAVED_AT) return;
  syncSaveBase(SYNC_BASE_STATE || syncStatePayload(), at);
}


async function restoreActivitiesFromServer(){
  if(_localMutationInFlight){ toast('انتظر انتهاء العملية الحالية','bad'); return; }
  const api=getApi(), tok=getTok();
  if(!api || !tok){ toast('لم يتم ضبط اتصال الخادم بعد','bad'); return; }
  if(!(await askConfirm('سيُبحث عن الأنشطة المنشورة على الخادم وغير الموجودة في دفترك، ثم تُعاد.\n\nالتسليمات لن تُحذف.',{title:'استعادة الأنشطة؟',yes:'ابدأ',no:'إلغاء'}))) return;
  toast('جاري البحث عن الأنشطة المفقودة…');
  try{
    const r=await fetch(`${api.replace(/\/+$/,'')}/recover-activities?t=${encodeURIComponent(tok)}`);
    const j=await r.json();
    syncAbsorbSavedAt(j);   // 🔑 لا تعارض وهمي بعد هذه العملية
    if(r.status===401){ toast('كلمة السر غير صحيحة','bad'); return; }
    if(!r.ok || !j.ok) throw new Error('recover failed');
    const ok=await pullState();
    if(!ok) throw new Error('pull failed');
    const filter=document.getElementById('hw-filter');
    if(filter) filter.value='all';
    renderHw();
    toast(j.count ? `✅ تم استرجاع ${j.count} نشاط مفقود مع الحفاظ على تسليماته` : '✅ لم توجد أنشطة مفقودة؛ البيانات متزامنة','good');
  }catch(e){
    console.error('restoreActivitiesFromServer:',e);
    toast('تعذّرت استعادة الأنشطة من الخادم','bad');
  }
}

let _gClassInit = false;

// يبني صفوف الكشف: طالب × نشاط
/* ✍️ تعديل درجة يدوياً */
function editGrade(sid, hid){
  const st = byId(sid), h = HW.find(x=>x.id===hid);
  if(!st || !h) return;
  const hMax = h.max || 20;
  const v = (h.subs||{})[sid];
  const auto = v ? Math.round(hMax * (v.correct||0) / Math.max(1, v.total||1)) : 0;
  const cur = v ? (v.manualGrade !== undefined ? v.manualGrade : auto) : '';
  openModal(`
    <h2>${esc(st.name)}</h2>
    <p style="color:var(--ink-soft);font-size:.86rem;margin:.15rem 0 .8rem">${esc(h.title)}</p>
    ${v ? `<p style="font-size:.85rem;margin:0 0 .7rem">
      حلّ <b>${v.correct}</b> من <b>${v.total}</b> مهمة · الدرجة المحسوبة <b>${auto}</b> من ${hMax}
      ${v.manualGrade !== undefined ? '<br><span style="color:#C88A2E">✍️ معدّلة يدوياً حالياً</span>' : ''}</p>`
      : '<p style="color:var(--pen);font-size:.85rem;margin:0 0 .7rem">لم يسلّم — الرصد هنا يدوي (ورقي أو استثناء)</p>'}
    <div class="field" style="margin:0"><label>الدرجة من ${hMax}</label>
      <input class="inp" type="number" id="eg-val" min="0" max="${hMax}" value="${cur}"
             style="text-align:center;font-size:1.2rem"></div>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      ${v && v.manualGrade !== undefined ? `<button class="btn ghost" onclick="resetGrade('${sid}','${hid}')">↺ الدرجة المحسوبة</button>` : ''}
      <button class="btn tick" onclick="saveGrade('${sid}','${hid}')">حفظ</button>
    </div>`);
  setTimeout(()=>{ const e=document.getElementById('eg-val'); if(e){ e.focus(); e.select(); } },70);
}

function saveGrade(sid, hid){
  const h = HW.find(x=>x.id===hid); if(!h) return;
  const hMax = h.max || 20;
  const val = Math.max(0, Math.min(hMax, +document.getElementById('eg-val').value || 0));
  h.subs = h.subs || {};
  const v = h.subs[sid];
  if(v){ v.manualGrade = val; }
  else {
    // رصد يدوي لمن لم يسلّم
    h.subs[sid] = { manual:true, manualGrade:val, correct:0, total:(h.qs||[]).length||1,
                    pts:0, d:'', at:Date.now() };
  }
  save(K.hw, HW); closeModal(); renderGrades(); renderStudents();
  toast(`رُصدت ${val} من ${hMax}`, 'good');
}

function resetGrade(sid, hid){
  const h = HW.find(x=>x.id===hid); if(!h) return;
  const v = (h.subs||{})[sid];
  if(v) delete v.manualGrade;
  save(K.hw, HW); closeModal(); renderGrades(); renderStudents();
  toast('رجعت للدرجة المحسوبة');
}

/* ▸ توسيع تفاصيل مهام نشاط داخل تقرير الطالب */
function toggleAllQd(){
  const boxes = document.querySelectorAll('[id^="qd-"]');
  const anyHidden = [...boxes].some(b=>b.classList.contains('hide'));
  boxes.forEach(b=>{
    b.classList.toggle('hide', !anyHidden);
    const a = document.getElementById('qa-' + b.id.slice(3));
    if(a) a.textContent = anyHidden ? '▾' : '▸';
  });
}

function toggleQd(hid){
  const box = document.getElementById('qd-'+hid);
  const arr = document.getElementById('qa-'+hid);
  if(!box) return;
  const open = box.classList.toggle('hide');
  if(arr) arr.textContent = open ? '▸' : '▾';
}

let PIN_ON = false;
async function loadPinMode(){
  const api = getApi(), tok = getTok();
  if(!api || !tok) return false;
  try{
    const j = await (await fetch(`${api}/pinmode?t=${encodeURIComponent(tok)}`)).json();
    PIN_ON = !!(j.ok && j.enabled);
  }catch(e){}
  return PIN_ON;
}

async function setPinMode(on){
  const api = getApi(), tok = getTok();
  if(!api || !tok){ toast('اضبط الخادم أولاً','bad'); return; }
  try{
    const j = await (await fetch(`${api}/pinmode?t=${encodeURIComponent(tok)}&on=${on?1:0}`)).json();
    if(!j.ok) throw 0;
    PIN_ON = !!j.enabled;
    openPins();
    toast(PIN_ON ? 'فُعّل الرمز السري — سيُطلب من الطلاب' : 'أُطفئ الرمز — الدخول بالاسم فقط',
          PIN_ON ? 'good' : 'bad');
  }catch(e){ toast('تعذّر التغيير','bad'); }
}

/* ⚡ الفتح الفوري.
   كان الزر ينتظر طلبين كاملين من الخادم قبل أن يفتح شيئًا — فالبطء كان
   شبكةً لا حسابًا. الآن تُفتح النافذة فورًا بما هو محفوظ، ويُحدَّث
   المحتوى حين تصل الرموز، مع إبقاء بحثك ومرشّحاتك كما تركتها. */
function openPinsQuick(){
  openPins(PINS && Object.keys(PINS).length ? '' : 'جارٍ تحميل الرموز…');
  Promise.all([loadPins(true), loadPinMode()]).then(()=>{
    if(!document.getElementById('pin-list')) return;   // أغلقتَها قبل الوصول
    const keep = {};
    for(const id of ['pin-search','pin-class','pin-status','pin-sort']){
      const e=document.getElementById(id); if(e) keep[id]=e.value;
    }
    openPins();
    for(const id in keep){ const e=document.getElementById(id); if(e) e.value=keep[id]; }
    renderPinList();
  }).catch(()=>{});
}
function openPins(note){
  const list = STUDENTS.slice().sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  const has = list.filter(s=>pinOf(s.name)).length;
  openModal(`
    <h2>🔐 رموز الطلاب</h2>${note?`<div class="muted" style="margin:-.4rem 0 .6rem;font-size:.8rem">${esc(note)}</div>`:''}

    <div class="sheet" style="padding:.7rem .9rem;margin:.4rem 0 .7rem;
      background:${PIN_ON?'rgba(27,156,107,.08)':'#F7F9FC'};
      border:1.5px solid ${PIN_ON?'var(--tick)':'var(--rule)'}">
      <div class="row" style="gap:.6rem">
        <div style="flex:1">
          <b style="color:${PIN_ON?'var(--tick)':'var(--ink-soft)'}">
            ${PIN_ON ? '🔒 نظام الرمز مُفعَّل' : '🔓 نظام الرمز مُطفأ'}</b>
          <div class="muted" style="font-size:.82rem;margin-top:.2rem">
            ${PIN_ON
              ? 'الطالب يختار رمزه أول دخول، ويُطلب منه في كل جهاز جديد.'
              : 'الدخول بالاسم الثلاثي فقط — فعّله متى شئت بلا تعديل ملفات.'}</div>
        </div>
        <button class="btn ${PIN_ON?'ghost':'tick'} sm" onclick="setPinMode(${PIN_ON?'false':'true'})">
          ${PIN_ON ? 'إطفاء' : 'تفعيل'}</button>
      </div>
    </div>

    <p style="color:var(--ink-soft);font-size:.86rem;margin:.15rem 0 .7rem">
      سجّل <b>${has}</b> من ${list.length} طالباً.</p>
    <div class="row" style="gap:.4rem;flex-wrap:wrap;margin-bottom:.5rem">
      <select class="inp" id="pin-class" style="width:auto;min-width:120px" onchange="renderPinList()">
        <option value="__all__">كل الفصول</option>
        ${classes().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}
      </select>
      <select class="inp" id="pin-status" style="width:auto;min-width:120px" onchange="renderPinList()">
        <option value="all">الكل</option>
        <option value="has">سجّل رمزه</option>
        <option value="none">لم يسجّل</option>
      </select>
      <select class="inp" id="pin-sort" style="width:auto;min-width:110px" onchange="renderPinList()">
        <option value="name">الاسم</option>
        <option value="cls">الفصل</option>
        <option value="status">الحالة</option>
      </select>
      <input class="inp" id="pin-search" placeholder="🔍 ابحث بالاسم" style="flex:1;min-width:130px" oninput="renderPinList()">
    </div>
    <div id="pin-count" class="muted" style="font-size:.8rem;margin-bottom:.3rem"></div>
    <div id="pin-list" style="max-height:48vh;overflow:auto"></div>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إغلاق</button>
      <button class="btn" onclick="loadPins().then(()=>{renderPinList()})">🔄 تحديث</button>
    </div>`);
  renderPinList();
}

function renderPinList(){
  const box = document.getElementById('pin-list'); if(!box) return;
  const val = id => { const e = document.getElementById(id); return e ? e.value : ''; };
  const q   = normAr(val('pin-search'));
  const cls = val('pin-class') || '__all__';
  const stt = val('pin-status') || 'all';
  const srt = val('pin-sort') || 'name';

  let list = STUDENTS.slice();
  if(cls !== '__all__') list = list.filter(s => s.cls === cls);
  if(stt === 'has')  list = list.filter(s => !!pinOf(s.name));
  if(stt === 'none') list = list.filter(s => !pinOf(s.name));
  if(q){ const w = q.split(' ').filter(Boolean);
    list = list.filter(s=>{ const h = normAr(s.name); return w.every(x=>h.indexOf(x)!==-1); }); }

  list.sort((a,b)=>{
    if(srt === 'cls'){
      const c = String(a.cls||'').localeCompare(String(b.cls||''),'ar');
      return c || a.name.localeCompare(b.name,'ar');
    }
    if(srt === 'status'){
      const d = (pinOf(b.name)?1:0) - (pinOf(a.name)?1:0);
      return d || a.name.localeCompare(b.name,'ar');
    }
    return a.name.localeCompare(b.name,'ar');
  });

  const cnt = document.getElementById('pin-count');
  if(cnt){
    const has = list.filter(s=>pinOf(s.name)).length;
    cnt.textContent = list.length
      ? `${list.length} طالب · ${has} سجّل · ${list.length-has} لم يسجّل`
      : '';
  }

  box.innerHTML = list.length ? list.map(s=>{
    const pin = pinOf(s.name);
    return `<div class="ruled" style="padding:.5rem .8rem"><div class="row" style="gap:.5rem">
      <span class="name" style="flex:1;font-size:.92rem">${esc(s.name)}</span>
      ${s.cls?`<span class="pill quiet" style="font-size:.74rem">${esc(s.cls)}</span>`:''}
      ${pin
        ? `<b style="font-family:monospace;font-size:1.05rem;letter-spacing:.15rem;color:var(--tick)">${esc(pin)}</b>
           <button class="btn ghost sm" onclick="resetPin('${esc(s.name)}')" title="تصفير الرمز">↺</button>`
        : `<span class="muted" style="font-size:.8rem">لم يسجّل بعد</span>`}
    </div></div>`;
  }).join('') : '<p class="muted center">لا نتائج</p>';
}

async function resetPin(name){
  const api = getApi(), tok = getTok();
  if(!api || !tok){ toast('اضبط الخادم أولاً','bad'); return; }
  try{
    const st = STUDENTS.find(s => normAr(s.name) === normAr(name));
    const sid = st ? String(st.id || '').trim() : '';
    const qs = sid
      ? `sid=${encodeURIComponent(sid)}&name=${encodeURIComponent(name)}`
      : `name=${encodeURIComponent(name)}`;
    const j = await (await fetch(`${api}/resetpin?t=${encodeURIComponent(tok)}&${qs}`)).json();
    if(!j.ok) throw 0;
    if(sid) delete PINS[sid];
    delete PINS[name];
    Object.keys(PINS).forEach(k=>{ if(normAr(k)===normAr(name)) delete PINS[k]; });
    renderPinList();
    toast(`صُفّر رمز ${name} — سيختار رمزاً جديداً`,'good');
  }catch(e){ toast('تعذّر التصفير','bad'); }
}

/* 🖨️ طباعة تقرير الطالب — بترويسة رسمية */
function printStudentReport(sid){
  const st = byId(sid); if(!st) return;
  const hws = gradedHW().filter(h => hwFor(h, st.cls)).slice().sort((a,b)=>(a.at||0)-(b.at||0));

  let got=0, max=0, done=0, late=0;
  const skill = {};
  const rows = hws.map(h=>{
    const hMax = h.max || 20; max += hMax;
    const v = (h.subs||{})[st.id];
    if(!v) return { h, hMax, done:false };
    done++;
    const g = Math.round(hMax * (v.correct||0) / Math.max(1, v.total||1));
    got += g;
    const isLate = h.due && v.at && new Date(v.at).toISOString().slice(0,10) > h.due;
    if(isLate) late++;
    const d = String(v.d||''), qs = h.qs||[];
    if(d.length === qs.length) qs.forEach((q,i)=>{
      const k = q.t||'q';
      skill[k] = skill[k] || {n:0, ok:0};
      skill[k].n++; if(d[i]==='1') skill[k].ok++;
    });
    return { h, hMax, done:true, g, v, late:isLate,
             pct: Math.round((v.correct||0)/Math.max(1,v.total||1)*100) };
  });

  const pct  = max ? Math.round(got/max*100) : 0;
  const band = BANDS.find(b=>pct >= b.min) || BANDS[BANDS.length-1];

  // متوسط الفصل
  const mates = STUDENTS.filter(x=>x.cls===st.cls);
  let clsSum=0, clsN=0;
  mates.forEach(m=>{
    let g=0, mx=0, any=false;
    hws.forEach(h=>{ const hM=h.max||20; const v=(h.subs||{})[m.id];
      mx+=hM; if(v){ any=true; g+=Math.round(hM*(v.correct||0)/Math.max(1,v.total||1)); } });
    if(any && mx){ clsSum += Math.round(g/mx*100); clsN++; }
  });
  const clsAvg = clsN ? Math.round(clsSum/clsN) : 0;
  const gap = pct - clsAvg;

  // المؤشرات التشخيصية والأنماط
  const diagRows = [];
  diagHW().filter(h=>hwFor(h, st.cls)).forEach(h=>{
    const v=(h.subs||{})[st.id]; if(!v) return;
    const p=Math.round((v.correct||0)/Math.max(1,v.total||1)*100);
    const lv = typeof diagBand==='function' ? diagBand(p)
             : { name: p>=80?'متمكّن':p>=60?'يحتاج مراجعة':p>=40?'يحتاج دعمًا':'يحتاج تأسيسًا',
                 color: p>=80?'#1B9C6B':p>=60?'#2E6BB8':p>=40?'#C88A2E':'#B4232F', act:'' };
    diagRows.push({ h, p, correct:v.correct||0, total:v.total||0, lv });
  });
  let styleRow = null;
  styleHW().filter(h=>hwFor(h, st.cls)).forEach(h=>{
    const t = styleTally(h, st.id);
    if(t && !styleRow) styleRow = { h, t };
  });

  const dt = new Date();
  const today = `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`;

  const box = document.getElementById('print-report');
  box.innerHTML = `
    <div class="rep-page">
      ${repHead('(تقرير طالب)', 'تقرير أداء الطالب')}
      <div class="rep-in">
        <div class="rep-info">
          <div>الطالب<b>${esc(st.name)}</b></div>
          <div>الفصل<b>${esc(st.cls || '—')}</b></div>
          <div>المادة<b>${esc(rcGet('subject') || 'العلوم')}</b></div>
          <div>التاريخ<b>${today}</b></div>
        </div>


        <div class="rep-sec">ملخّص الأداء</div>
        <div class="rep-box">
          <table class="rt"><tbody>
            <tr><td style="text-align:start">الدرجة المحصّلة</td><td><b>${got}</b> من ${max}</td>
                <td style="text-align:start">نسبة التحصيل</td>
                <td style="background:${band.color};color:#fff;font-weight:700">${pct}% · ${band.name.replace(/ـ/g,'')}</td></tr>
            <tr><td style="text-align:start">الأنشطة المسلّمة</td><td><b>${done}</b> من ${hws.length}</td>
                <td style="text-align:start">التسليم المتأخر</td><td><b>${late}</b></td></tr>
            ${clsN>1 ? `<tr><td style="text-align:start">متوسط الفصل</td><td><b>${clsAvg}%</b></td>
                <td style="text-align:start">موقعه من فصله</td>
                <td style="color:${gap>=5?'#1B9C6B':gap<=-5?'#B4232F':'#5A6B84'};font-weight:700">
                  ${gap>0?'أعلى بـ '+gap+'%':gap<0?'أدنى بـ '+Math.abs(gap)+'%':'مطابق للمتوسط'}</td></tr>` : ''}
          </tbody></table>
        </div>

        ${(diagRows.length || styleRow) ? `
        <div class="rep-sec">المؤشرات التشخيصية</div>
        <div class="rep-box">
          <table class="rt"><thead><tr><th>المؤشر</th><th>النتيجة</th><th>الدلالة</th></tr></thead><tbody>
            ${diagRows.map(r=>`<tr>
              <td style="text-align:start">🔍 ${esc(r.h.title)}</td>
              <td>${r.correct}/${r.total} · ${r.p}%</td>
              <td style="background:${r.lv.color};color:#fff;font-weight:700">${r.lv.name}</td></tr>`).join('')}
            ${styleRow ? `<tr>
              <td style="text-align:start">${STYLE_ICON[styleRow.t.top]||'🧠'} ${esc(styleRow.h.title)}</td>
              <td>${styleRow.t.rows.map(([k,c])=>`${esc(k)} ${Math.round(c/styleRow.t.total*100)}%`).join(' · ')}</td>
              <td style="background:${STYLE_COLOR[styleRow.t.top]||'#5A6B84'};color:#fff;font-weight:700">${esc(styleRow.t.top)}</td></tr>` : ''}
          </tbody></table>
          ${styleRow && STYLE_TIP[styleRow.t.top] ? `<div style="margin-top:.45rem;font-size:.88rem">
            <b>توصية:</b> ${esc(STYLE_TIP[styleRow.t.top])}</div>` : ''}
        </div>` : ''}

        <div class="rep-sec">تفصيل الأنشطة</div>
        <div class="rep-box">
          <table class="rt"><thead><tr>
            <th style="width:34px">م</th><th style="text-align:start">النشاط</th>
            <th>المهام</th><th>الدرجة</th><th>النسبة</th><th>التاريخ</th>
          </tr></thead><tbody>
            ${rows.map((r,i)=>{
              if(!r.done) return `<tr>
                <td>${i+1}</td><td style="text-align:start">${esc(r.h.title)}</td>
                <td>—</td><td>0 / ${r.hMax}</td>
                <td style="color:#B4232F;font-weight:700">لم يسلّم</td><td>—</td></tr>`;
              const c = r.pct>=75?'#1B9C6B':r.pct>=50?'#C88A2E':'#B4232F';
              return `<tr>
                <td>${i+1}</td><td style="text-align:start">${esc(r.h.title)}${r.late?' ⏰':''}</td>
                <td>${r.v.correct}/${r.v.total}</td>
                <td><b>${r.g}</b> / ${r.hMax}</td>
                <td style="color:${c};font-weight:700">${r.pct}%</td>
                <td style="font-size:.9em">${r.v.at?fmtDate(r.v.at):'—'}</td></tr>`;
            }).join('')}
          </tbody></table>
        </div>

        ${Object.keys(skill).length ? `
        <div class="rep-sec">أداؤه حسب نوع السؤال</div>
        <div class="rep-box">
          ${Object.entries(skill).map(([k,v])=>{
            const p = Math.round(v.ok/v.n*100);
            const c = p>=75?'#1B9C6B':p>=50?'#C88A2E':'#B4232F';
            return `<div class="hb" style="margin-bottom:.35rem">
              <span class="nm">${KIND_NAME[k]||k}</span>
              <span class="tr"><i style="width:${Math.max(p,2)}%;background:${c}"></i></span>
              <span class="vv" style="color:${c}">${p}%</span>
              <span class="muted" style="font-size:.78rem;min-width:3.4rem;text-align:end">${v.ok}/${v.n}</span>
            </div>`;
          }).join('')}
        </div>` : ''}

        <div class="rep-sec">ملاحظات المعلم</div>
        <div class="rep-box" style="min-height:70px">
          <div style="border-bottom:1px dotted #BBB;height:22px"></div>
          <div style="border-bottom:1px dotted #BBB;height:22px"></div>
        </div>

        <div class="rep-foot">
          <div>المعلم: <b>${esc(rcGet('teacher') || '—')}</b></div>
          <div>ولي الأمر: <b>....................</b></div>
          <div>مدير المدرسة: <b>${esc(rcGet('principal') || '—')}</b></div>
        </div>
      </div>
    </div>`;

  document.body.classList.add('printing-student');
  const done2 = ()=>{
    document.body.classList.remove('printing-student');
    box.innerHTML = '';
    window.removeEventListener('afterprint', done2);
  };
  window.addEventListener('afterprint', done2);
  setTimeout(()=>printThen(done2),120);
}
function gSort(key){
  if(GSORT.key === key) GSORT.dir = GSORT.dir === 'desc' ? 'asc' : 'desc';
  else { GSORT.key = key; GSORT.dir = (key === 'name') ? 'asc' : 'desc'; }
  renderGrades();
}


let GSELECTED = new Set();

// يبني مصفوفة نصية للتصدير والنسخ
function gMatrix(){
  const { hws, rows } = gData();
  const head = ['الطالب','الفصل', ...hws.map(h=>h.title), 'الدرجة','من','النسبة %','عدد المسلّم'];
  const body = rows.map(r=>[
    r.s.name, r.s.cls||'',
    ...r.cells.map(c=> c.done ? String(c.pts) : ''),
    String(r.got), String(r.max), String(r.pct), `${r.done}/${hws.length}`
  ]);
  return { head, body };
}

function copyGrades(){
  const { head, body } = gMatrix();
  if(!body.length){ toast('لا بيانات للنسخ','bad'); return; }
  const txt = [head.join('\t'), ...body.map(r=>r.join('\t'))].join('\n');
  navigator.clipboard.writeText(txt)
    .then(()=>toast('نُسخ — الصقه في إكسل مباشرة','good'))
    .catch(()=>toast('تعذّر النسخ','bad'));
}


function chooseClassActivityPrint(){
  const classSel=document.getElementById('g-class');
  const hwSel=document.getElementById('g-hw');
  const cls=classSel ? classSel.value : '__all__';
  const hid=hwSel ? hwSel.value : '__all__';

  if(!cls || cls==='__all__'){
    toast('اختر فصلًا محددًا أولًا للطباعة','bad');
    return;
  }
  if(!hid || hid==='__all__'){
    toast('اختر نشاطًا محددًا أولًا للطباعة','bad');
    return;
  }

  openModal(`
    <div style="text-align:center">
      <div style="font-size:2rem;margin-bottom:.35rem">🖨️</div>
      <h2 style="margin-bottom:.35rem">ماذا تريد أن تطبع؟</h2>
      <p style="color:var(--ink-soft);font-size:.82rem;margin:.2rem 0 1rem">
        ${esc(cls)} · ${esc((HW.find(x=>x.id===hid)||{}).title||'النشاط')}
      </p>

      <div class="print-choice-grid">
        <button type="button" class="print-choice" onclick="closeModal();printClassActivityReport('names')">
          <span class="print-choice-icon">👥</span>
          <b>كشف الأسماء فقط</b>
          <small>صفحة واحدة · الأسماء + حالة التسليم + الدرجة</small>
        </button>

        <button type="button" class="print-choice featured" onclick="closeModal();printClassActivityReport('full')">
          <span class="print-choice-icon">📊</span>
          <b>التقرير + الرسم البياني</b>
          <small>ملخص الفصل + مؤشرات التسليم + كشف الأسماء</small>
        </button>
      </div>

      <div class="modal-foot">
        <button class="btn ghost" type="button" onclick="closeModal()">إلغاء</button>
      </div>
    </div>
  `);
}

function printClassActivityReport(mode='full'){
  const classSel=document.getElementById('g-class');
  const hwSel=document.getElementById('g-hw');
  const cls=classSel ? classSel.value : '__all__';
  const hid=hwSel ? hwSel.value : '__all__';
  if(!cls || cls==='__all__'){
    toast('اختر فصلًا محددًا أولًا للطباعة','bad');
    return;
  }
  if(!hid || hid==='__all__'){
    toast('اختر نشاطًا محددًا أولًا للطباعة','bad');
    return;
  }

  const h=HW.find(x=>x.id===hid);
  if(!h){ toast('تعذر العثور على النشاط','bad'); return; }

  const students=STUDENTS.filter(s=>s.cls===cls)
    .slice()
    .sort((a,b)=>a.name.localeCompare(b.name,'ar'));

  const submitted=[];
  const missing=[];
  students.forEach(s=>{
    const v=(h.subs||{})[s.id];
    if(v) submitted.push({s,v});
    else missing.push(s);
  });

  const total=students.length;
  const doneN=submitted.length;
  const missN=missing.length;
  const donePct=total ? Math.round(doneN/total*100) : 0;
  const missPct=total ? Math.round(missN/total*100) : 0;

  let gradeSum=0, gradeCount=0, gradeMax=(h.max||20);
  submitted.forEach(({v})=>{
    const grade = v.manualGrade !== undefined
      ? Number(v.manualGrade)
      : Math.round(gradeMax*(v.correct||0)/Math.max(1,v.total||1));
    if(Number.isFinite(grade)){ gradeSum += grade; gradeCount++; }
  });
  const avgGrade=gradeCount ? Math.round((gradeSum/gradeCount)*10)/10 : 0;

  const now=new Date();
  const today=`${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`;
  const due=h.due ? h.due.replace(/-/g,'/') : 'غير محدد';
  const teacher = typeof rcGet==='function' ? (rcGet('teacher') || '—') : '—';
  const school = typeof rcGet==='function' ? (rcGet('school') || 'المدرسة') : 'المدرسة';
  const dept = typeof rcGet==='function' ? (rcGet('dept') || 'الإدارة العامة للتعليم') : 'الإدارة العامة للتعليم';
  const subject = typeof rcGet==='function' ? (rcGet('subject') || 'المادة') : 'المادة';
  const period = typeof rcGet==='function' ? (rcGet('period') || '') : '';

  const logo = window.__MOE_LOGO || '';

  /* 🧾 كشف الطباعة: ترتيب جميع الطلاب أبجديًا حسب الاسم، مع بقاء حالة التسليم مستقلة */
  const tableRows = students.map((s,i)=>{
    const v=(h.subs||{})[s.id];
    const done = !!v;
    let grade = null;
    if(done){
      grade = v.manualGrade !== undefined
        ? Number(v.manualGrade)
        : Math.round(gradeMax*(v.correct||0)/Math.max(1,v.total||1));
    }
    return `
      <tr>
        <td>${i+1}</td>
        <td class="name">${esc(s.name)}</td>
        <td><span class="class-print-status ${done?'done':'missing'}">${done?'✓ تم التسليم':'✕ لم يسلم'}</span></td>
        <td class="class-print-grade">${done && Number.isFinite(grade)?grade.toFixed(grade%1?1:0):'—'}</td>
        <td>${gradeMax.toFixed(gradeMax%1?1:0)}</td>
      </tr>`;
  }).join('');

  const box=document.getElementById('class-activity-print-report');
  if(!box) return;

  box.innerHTML=`
    ${mode==='full' ? `
    <!-- الصفحة الأولى: ملخص -->
    <div class="class-print-page">
      <div class="class-print-wrap">
        <div class="class-print-top">
          <div class="class-print-school">
            <span>${esc(dept)}</span>
            <span>${esc(school)}</span>
            <span class="soft">${esc(subject)}</span>
          </div>
          <div class="class-print-logo">${logo}</div>
          <div class="class-print-badge">واجب</div>
        </div>

        <div class="class-print-titleband">
          <div class="class-print-title">${esc(h.title)}</div>
          <div class="class-print-sub">${esc(cls)}${period ? ` · ${esc(period)}` : ''} · ${today}</div>
        </div>

        <div class="class-print-kicker">📋 ملخص متابعة التسليم</div>

        <div class="class-print-statrow">
          <div class="class-print-stat blue"><b>${total}</b><span>إجمالي الطلاب</span></div>
          <div class="class-print-stat green"><b>${doneN}</b><span>سلّموا (${donePct}%)</span></div>
          <div class="class-print-stat red"><b>${missN}</b><span>لم يسلّموا (${missPct}%)</span></div>
        </div>

        <div class="class-print-bodygrid">
          <section class="class-print-card">
            <h3>البيانات التفصيلية</h3>
            <table class="class-print-table">
              <tr><td class="label">الفصل</td><td class="val">${esc(cls)}</td></tr>
              <tr><td class="label">النشاط</td><td class="val">${esc(h.title)}</td></tr>
              <tr><td class="label">موعد التسليم</td><td class="val">${esc(due)}</td></tr>
              <tr><td class="label">تاريخ الطباعة</td><td class="val">${today}</td></tr>
              <tr><td class="label">متوسط درجة المسلّمين</td><td class="val">${avgGrade} / ${gradeMax}</td></tr>
            </table>
          </section>

          <section class="class-print-card">
            <h3>مؤشر التسليم</h3>
            <div class="class-print-donutrow">
              <div>
                <div class="class-print-donut" style="--p:${donePct}%">
                  <div><strong>${donePct}%</strong><span>تم التسليم</span></div>
                </div>
              </div>
              <div>
                <div class="class-print-donut red" style="--p:${missPct}%">
                  <div><strong>${missPct}%</strong><span>لم يسلّم</span></div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section class="class-print-card" style="margin-top:11px;">
          <h3>عدد الطلاب حسب الحالة</h3>
          <div class="class-print-barwrap">
            <div class="class-print-barrow">
              <div class="class-print-barlabel">تم التسليم</div>
              <div class="class-print-bar green"><i style="width:${donePct}%"></i></div>
              <div class="class-print-bar-num">${doneN}</div>
            </div>
            <div class="class-print-barrow">
              <div class="class-print-barlabel">لم يسلّم</div>
              <div class="class-print-bar red"><i style="width:${missPct}%"></i></div>
              <div class="class-print-bar-num">${missN}</div>
            </div>
          </div>
        </section>

        <div class="class-print-foot">
          <div>معلم / ة المادة: <b>${esc(teacher)}</b></div>
          <div>مدير / ة المدرسة: <b>............................</b></div>
        </div>
        <div class="class-print-note">كشف متابعة أسبوعي · يُطبع للفصل المحدد والنشاط المحدد فقط</div>
      </div>
    </div>

    ` : ''}
    <!-- الصفحة الثانية: الكشف -->
    <div class="class-print-page">
      <div class="class-print-wrap">
        <div class="class-print-top">
          <div class="class-print-school">
            <span>${esc(dept)}</span>
            <span>${esc(school)}</span>
            <span class="soft">${esc(subject)}</span>
          </div>
          <div class="class-print-logo">${logo}</div>
          <div class="class-print-badge">كشف متابعة</div>
        </div>

        <div class="class-print-detail-head">
          <div class="class-print-detail-title">${esc(h.title)}</div>
          <div class="class-print-sub" style="text-align:center;margin-top:2px;">الفصل: ${esc(cls)} · تاريخ التقرير: ${today}</div>
        </div>

        <div class="class-print-detail-meta">
          <div>إجمالي الطلاب<b>${total}</b></div>
          <div>تم التسليم<b>${doneN}</b></div>
          <div>لم يسلّم<b>${missN}</b></div>
          <div>نسبة التسليم<b>${donePct}%</b></div>
        </div>

        <table class="class-print-listtable">
          <thead>
            <tr>
              <th style="width:34px">#</th>
              <th>اسم الطالب</th>
              <th style="width:120px">الحالة</th>
              <th style="width:72px">الدرجة</th>
              <th style="width:58px">من</th>
            </tr>
          </thead>
          <tbody>${tableRows || `
            <tr><td colspan="5">لا يوجد طلاب في هذا الفصل.</td></tr>`}</tbody>
        </table>

        <div class="class-print-footer-note">
          <div>معلم / ة المادة: <b>${esc(teacher)}</b></div>
          <div>مدير / ة المدرسة: <b>............................</b></div>
        </div>
      </div>
    </div>
  `;

  const __oldDocumentTitle = document.title;
  const __safePart = value => String(value || '')
    .replace(/[\\/:*?"<>|]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
  /* اسم ملف PDF المقترح: اسم النشاط - الصف */
  document.title = `${__safePart(h.title) || 'كشف متابعة'} - ${__safePart(cls) || 'الفصل'}`;

  document.body.classList.add('printing-class-activity');
  const done=()=>{
    document.body.classList.remove('printing-class-activity');
    box.innerHTML='';
    document.title = __oldDocumentTitle;
    window.removeEventListener('afterprint',done);
  };
  window.addEventListener('afterprint',done);
  setTimeout(()=>printThen(done),180);
}

function exportGrades(){
  const { head, body } = gMatrix();
  if(!body.length){ toast('لا بيانات للتصدير','bad'); return; }
  const esc2 = v => `"${String(v).replace(/"/g,'""')}"`;
  const csv = [head.map(esc2).join(','), ...body.map(r=>r.map(esc2).join(','))].join('\r\n');
  const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8' });   // BOM ليقرأ إكسل العربية
  const sel = document.getElementById('g-class');
  const cls = (sel && sel.value !== '__all__') ? sel.value : 'كل_الفصول';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `كشف_الدرجات_${cls}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
  toast('صُدّر الكشف','good');
}
function setAnMode(m){
  localStorage.setItem(K_ANMODE, m);
  document.querySelectorAll('.an-mode:not([data-ca])').forEach(b=>b.classList.toggle('on', b.dataset.m===m));
  renderAnalysis();
}

function toggleRepCfg(){
  const b = document.getElementById('rep-cfg');
  b.style.display = b.style.display === 'none' ? '' : 'none';
}
function syncCls(sel){
  const a = document.getElementById('an-class');
  if(a) a.value = sel.value;
  renderAnalysis();
}
async function bkSaveBlob(res, fallbackName){
  const blob=await res.blob(); const cd=res.headers.get('content-disposition')||''; const m=/filename="([^"]+)"/.exec(cd);
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=(m&&m[1])||fallbackName; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
async function backupDownloadFull(){
  const api=bkApi(), tok=getTok(); if(!api||!tok){ toast('اضبط عنوان الخادم وكلمة السر أولًا','bad'); return; }
  try{
    const r=await fetch(api+'/backup/full?t='+encodeURIComponent(tok)); if(!r.ok) throw 0;
    await bkSaveBlob(r, 'muallim-backup.json');
    localStorage.setItem(K_BK, String(Date.now())); renderBackupWarn();
    toast('⬇️ نُزّلت نسخة كاملة — احفظها في مكان آمن (iCloud أو Google Drive)','good');
  }catch(e){ toast('تعذّر تنزيل النسخة — تحقق من الاتصال','bad'); }
}
async function backupDownload(id){
  try{ const r=await fetch(bkApi()+'/backup/get?t='+encodeURIComponent(getTok())+'&id='+encodeURIComponent(id)); if(!r.ok) throw 0; await bkSaveBlob(r,'muallim-backup-'+id.slice(0,10)+'.json'); }
  catch(e){ toast('تعذّر تنزيل النسخة','bad'); }
}
async function backupNow(){
  try{ const j=await (await fetch(bkApi()+'/backup/now',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok()})})).json();
    if(!j.ok) throw new Error(j.error||''); toast(`📸 حُفظت نسخة في الخادم (${(j.item&&j.item.students)||0} طالب)`,'good'); backupLoad();
  }catch(e){ toast('تعذّر أخذ النسخة'+(e.message==='backup_too_large'?' — البيانات أكبر من حد الخادم':''),'bad'); }
}
async function backupDoRestore(payload, label){
  if(!(await askConfirm(`ستُستبدل بيانات الخادم الحالية بنسخة ${label}. تُؤخذ نسخة من الحال الآن قبلها، فيمكنك التراجع من هذه القائمة.`,{title:'استعادة نسخة؟',yes:'استعد',no:'إلغاء'}))) return;
  try{
    const j=await (await fetch(bkApi()+'/backup/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),...payload})})).json();
    if(!j.ok) throw new Error(j.error||'');
    // النسخة المحلية قديمة الآن: تُمسح لتُسحب المستعادة من الخادم (ولا تُرسل القديمة فوقها)
    try{ localStorage.removeItem(K.st); localStorage.removeItem(K.hw); }catch(e){}
    toast('↩️ استُعيدت النسخة — تُحدَّث الصفحة','good');
    setTimeout(()=>location.reload(),900);
  }catch(e){ toast('تعذّرت الاستعادة'+(e.message==='bad_backup'?' — الملف ليس نسخة من هذه المنصة':''),'bad'); }
}
function backupRestoreId(id, label){ return backupDoRestore({id}, label); }
function backupRestoreFile(ev){
  const f=ev.target.files[0]; ev.target.value=''; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ let d=null; try{ d=JSON.parse(r.result); }catch(e){}
    if(!d || d.kind!=='server-backup'){ toast('الملف ليس نسخة كاملة من هذه المنصة. للنسخ القديمة استخدم «استيراد» في الإعدادات.','bad'); return; }
    backupDoRestore({data:d}, 'الملف «'+f.name+'»'); };
  r.readAsText(f);
}
function snoozeBackup(){
  // أجّل 3 أيام
  localStorage.setItem(K_BK, String(Date.now() - 4*86400000));
  renderBackupWarn();
  toast('سأذكّرك بعد 3 أيام');
}

function exportAll() {
  const blob = new Blob([JSON.stringify({
    app: 'homework', v: 1, at: new Date().toISOString(),
    students: STUDENTS, assignments: HW, log: LOG, perks: PERKS, repcfg: REPCFG
  }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `دفتر_الأنشطة_${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  localStorage.setItem(K_BK, String(Date.now()));
  renderBackupWarn();
  toast('صُدّرت النسخة', 'good');
}

function importAll(ev) {
  const f = ev.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = e => {
    try {
      const d = JSON.parse(e.target.result);
      if (!d || !Array.isArray(d.students)) throw 0;
      STUDENTS = d.students; HW = (d.assignments || []).filter(h => h && !h.__examProxy); LOG = d.log || []; PERKS = d.perks || {};
      if(d.repcfg){ REPCFG = d.repcfg; save(K_RC, REPCFG); loadRepCfg(); }
      save(K.st, STUDENTS); save(K.hw, HW); save(K.log, LOG); save(K.perks, PERKS);
      renderAll(); toast(`استُوردت نسخة فيها ${STUDENTS.length} طالب`, 'good');
    } catch { toast('الملف غير صالح — اختر نسخة صدّرها هذا التطبيق', 'bad'); }
    ev.target.value = '';
  };
  r.readAsText(f);
}


// 🧹 تنظيف بقايا الطلاب والأنشطة القديمة من الخادم
function cleanupServer(){
  const api = getApi(), tok = getTok();
  if(!api || !tok){ toast('اضبط عنوان الخادم وكلمة السر أولاً','bad'); return; }
  openModal(`<h2>تنظيف البيانات القديمة؟</h2>
    <p style="color:var(--ink-soft)">سيبحث الخادم عن بيانات طلاب محذوفين وتسليمات لأنشطة لم تعد موجودة، ثم يحذف البيانات اليتيمة فقط.<br>الطلاب والأنشطة الحالية تبقى كما هي.</p>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn tick" onclick="doCleanupServer()">ابدأ التنظيف</button>
    </div>`);
}
async function doCleanupServer(){
  const api = getApi(), tok = getTok();
  closeModal(); toast('جارٍ فحص وتنظيف الخادم…');
  try{
    // 1) جرّب تنظيف الخادم الأصلي أولاً.
    const r = await fetch(`${api}/cleanup?t=${encodeURIComponent(tok)}&_=${Date.now()}`, {cache:'no-store'});
    let j = null;
    try { j = await r.json(); } catch(e) {}
    syncAbsorbSavedAt(j);   // 🔑 لا تعارض وهمي بعد هذه العملية
    if(r.status === 401){ toast('كلمة السر غير صحيحة','bad'); return; }
    if(!r.ok || !j || !j.ok){
      throw new Error(j && j.message ? j.message : 'cleanup endpoint failed');
    }

    let deleted = (j.deletedStudentKeys||0) + (j.deletedSubmissionKeys||0) + (j.deletedRequestKeys||0);

    // 2) حماية إضافية: افحص كل نشاط منشور واحذف سجلات التسليم التي
    //    لم يعد اسم صاحبها موجوداً في كشف الطلاب الحالي.
    const staleNames = new Set();
    const published = HW.filter(h => h && h.sid);
    for(const h of published){
      try{
        const rr = await fetch(`${api}/results?hw=${encodeURIComponent(h.sid)}&t=${encodeURIComponent(tok)}&_=${Date.now()}`, {cache:'no-store'});
        if(!rr.ok) continue;
        const jj = await rr.json();
        if(!jj.ok) continue;
        for(const row of (jj.rows || [])){
          const nm = String(row?.name || '').trim();
          if(!nm) continue;
          const current = STUDENTS.some(s => String(s.name || '').trim() === nm);
          if(!current) staleNames.add(nm);
        }
      }catch(e){
        console.warn('cleanup results check failed:', h.id, e);
      }
    }

    // الحذف عبر نفس واجهة حذف الطالب المستخدمة في التطبيق.
    // لا نمرر IDs لأن هذه السجلات تحديداً تخص طلاباً لم يعودوا في الكشف.
    if(staleNames.size){
      const names = [...staleNames];
      try{
        const rr = await fetch(api + '/removestudent', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({t:tok, names, ids:[]})
        });
        const jj = await rr.json();
        syncAbsorbSavedAt(jj);   // 🔑 لا تعارض وهمي بعد هذه العملية
        if(jj.ok){
          deleted += names.length;
        }else{
          console.warn('stale submission cleanup rejected:', jj);
        }
      }catch(e){
        console.warn('stale submission cleanup failed:', e);
      }
    }

    toast(`اكتمل التنظيف: حُذفت ${deleted} بيانات قديمة` + (staleNames.size ? ` (${staleNames.size} اسمًا غير موجود في الكشف)` : ''), 'good');
    await pullState();
    await pullAll(true);
  }catch(e){
    console.error('cleanupServer:', e);
    toast('تعذّر تنظيف الخادم — تحقق من الاتصال والصلاحيات','bad');
  }
}

// 🔎 فحص بيانات طالب محذوف/معاد إضافته
let DELETED_STUDENT_SCAN = null;
async function inspectDeletedStudent(){
  const api=getApi(), tok=getTok();
  const name=(document.getElementById('deleted-student-name')?.value||'').trim();
  const box=document.getElementById('deleted-student-result');
  if(!api || !tok){ toast('اضبط عنوان الخادم وكلمة السر أولاً','bad'); return; }
  if(!name){ toast('اكتب اسم الطالب أولاً','bad'); return; }
  if(box) box.innerHTML='<span style="color:var(--ink-soft)">جارٍ الفحص…</span>';
  try{
    const r=await fetch(`${api}/student-data?name=${encodeURIComponent(name)}&t=${encodeURIComponent(tok)}&_=${Date.now()}`,{cache:'no-store'});
    const j=await r.json();
    if(r.status===401) throw new Error('unauthorized');
    if(!r.ok || !j.ok) throw new Error(j.error||'scan failed');
    DELETED_STUDENT_SCAN=j;
    const c=j.counts||{};
    const rows=[
      ['التسليمات القديمة',c.submissions||0],['أفضل الدرجات',c.bestScores||0],
      ['المحاولات الإضافية',c.extraAttempts||0],['المراجعات',c.reviews||0],
      ['بيانات المرفقات',c.fileMetadata||0],['طلبات المتجر',c.requests||0]
    ];
    const total=j.total||0;
    box.innerHTML=`<div style="border:1px solid var(--rule);border-radius:12px;padding:.75rem;background:var(--surface-2,rgba(0,0,0,.02))">
      <b>نتيجة الفحص: ${esc(j.name)}</b>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.4rem;margin-top:.6rem">
        ${rows.map(x=>`<div class="pill" style="justify-content:space-between"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')}
      </div>
      <p style="margin:.65rem 0 0;color:var(--ink-soft);font-size:.82rem">إجمالي السجلات التي يمكن تنظيفها: <b>${total}</b>${j.current?' — الطالب موجود حاليًا في الكشف، وسيبقى الطالب نفسه دون حذف.':''}</p>
      ${total?`<div class="modal-foot" style="padding-top:.7rem;margin-top:.7rem;border-top:1px solid var(--rule)">
        <button class="btn pen" type="button" onclick="purgeDeletedStudent()">🧹 حذف التسليمات والبيانات القديمة</button>
      </div>`:''}
    </div>`;
  }catch(e){
    console.error('inspectDeletedStudent:',e);
    if(box) box.innerHTML='<span style="color:var(--pen)">تعذّر فحص بيانات الطالب. تحقق من الخادم وكلمة السر.</span>';
  }
}
async function purgeDeletedStudent(){
  const api=getApi(), tok=getTok();
  const scan=DELETED_STUDENT_SCAN;
  if(!api || !tok || !scan?.name){ toast('افحص الطالب أولاً','bad'); return; }
  openModal(`<h2>تنظيف بيانات «${esc(scan.name)}»؟</h2>
    <p style="color:var(--ink-soft)">سيتم حذف التسليمات القديمة ودرجاتها والمراجعات والمرفقات المرتبطة بهذا الاسم من الخادم. ${scan.current?'الطالب الحالي سيبقى في الكشف ولن تُحذف بيانات حسابه الحالية.':'الطالب غير موجود حاليًا في الكشف.'}</p>
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn pen" onclick="doPurgeDeletedStudent()">حذف البيانات القديمة</button></div>`);
}
async function doPurgeDeletedStudent(){
  const api=getApi(), tok=getTok(), name=DELETED_STUDENT_SCAN?.name;
  closeModal();
  if(!api || !tok || !name) return;
  toast('جارٍ تنظيف بيانات الطالب…');
  try{
    const r=await fetch(api+'/student-cleanup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:tok,name})});
    const j=await r.json();
    if(!r.ok || !j.ok) throw new Error(j.error||'cleanup failed');
    const local=STUDENTS.find(s=>String(s.name||'').trim()===name);
    if(local){
      HW.forEach(h=>{
        if(h?.subs) delete h.subs[local.id];
        if(h?.extraAttempts) delete h.extraAttempts[local.id];
      });
      save(K.hw,HW);
    }
    DELETED_STUDENT_SCAN=null;
    const box=document.getElementById('deleted-student-result'); if(box) box.innerHTML='<p class="muted">✅ تم تنظيف بيانات الطالب المحذوف.</p>';
    await pullState();
    await pullAll(true);
    renderAll();
    toast(`تم تنظيف ${j.deleted||0} سجلًا وحذف ${j.filesDeleted||0} ملفًا مرتبطًا`,'good');
  }catch(e){
    console.error('doPurgeDeletedStudent:',e);
    toast('تعذّر تنظيف بيانات الطالب','bad');
  }
}

// 🧹 مسح بيانات الطلاب على الخادم (للتجارب)
function wipeServer(all){
  const api = getApi(), tok = getTok();
  if(!api || !tok){ toast('اضبط عنوان الخادم وكلمة السر أولاً','bad'); return; }
  openModal(`<h2>${all ? 'مسح كل شيء؟' : 'مسح بيانات الطلاب؟'}</h2>
    <p style="color:var(--ink-soft)">${all
      ? 'يُمسح كل شيء من <b>الخادم والمتصفح معاً</b>: الطلاب والأنشطة والروابط والأرصدة والتسليمات.<br>الروابط المنشورة لن تعمل بعدها.'
      : 'تُمسح أرصدة الطلاب وبطاقاتهم وتسليماتهم وطلباتهم. الأنشطة المنشورة تبقى.'}
    <br>لا يمكن التراجع — صدّر نسخة احتياطية أولاً.</p>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn pen" onclick="doWipeServer(${all?'true':'false'})">امسح</button>
    </div>`);
}
async function doWipeServer(all){
  const api = getApi(), tok = getTok();
  closeModal(); toast('جارٍ المسح…');
  try{
    const r = await fetch(`${api}/wipe?t=${encodeURIComponent(tok)}${all?'&all=1':''}`);
    if(r.status === 401){ toast('كلمة السر غير صحيحة','bad'); return; }
    const j = await r.json();
    if(!j.ok) throw 0;
    if(all){
      // 🛑 أوقف الرفع التلقائي وإلا رجعت البيانات للخادم فور الحفظ
      _pulling = true;
      clearTimeout(_pushT);
      STUDENTS = []; HW = []; PERKS = {}; REQS = []; save(K.reqs, REQS);
      // امسح تخزين المتصفح كاملاً عدا إعدادات الاتصال
      [K.st, K.hw, K.perks, K.log].forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });
      if(j.wipedAt) localStorage.setItem(K_SEEN, String(j.wipedAt));
      renderAll(); renderReqs();
      setTimeout(()=>{ _pulling = false; }, 8000);
      toast(`مُسح كل شيء (${j.removed} سجلاً) — الخادم والمتصفح`, 'good');
    } else {
      STUDENTS.forEach(s=>s.points = 0);
      HW.forEach(h=>h.subs = {});
      REQS = []; save(K.reqs, REQS);
      save(K.st, STUDENTS); save(K.hw, HW);
      renderAll(); renderReqs();
      toast(`مُسح ${j.removed} سجلاً — الأنشطة باقية`, 'good');
    }
  }catch(e){ toast('تعذّر الاتصال بالخادم','bad'); }
}

let UI_GOALS = load(K_UI.goals, []);


function openMissingStudents(activityId, cls){
  const h=HW.find(x=>x.id===activityId);
  if(!h){
    toast('تعذر العثور على النشاط','bad');
    return;
  }

  const scope=hwPool(h);
  const missing=scope.filter(s=>{
    if(cls && (s.cls||'بدون فصل')!==cls) return false;
    return !(h.subs&&h.subs[s.id]);
  });

  const title=cls ? `الطلاب المتأخرون — ${cls}` : 'جميع الطلاب المتأخرين';

  const pending=missing.filter(s=>!hasExtraAttempt(h,s.id));

  const rows=missing.length ? missing.map((s,i)=>`
    <div class="missing-student-row">
      <span class="missing-student-number">${i+1}</span>
      <div class="missing-student-data">
        <b>${esc(s.name)}</b>
        <small>${esc(s.cls||'بدون فصل')}</small>
      </div>
      <div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;justify-content:flex-end">
        <button type="button" class="btn ghost sm" onclick="closeModal();openStudentProfile('${esc(s.id)}')">فتح الملف</button>
        ${hasExtraAttempt(h,s.id)
          ? `<span class="sa-retry sent" title="تم إرسال صلاحية إعادة التسليم لهذا الطالب">✓ تم السماح</span>`
          : `<button type="button" class="btn sm tick" onclick="grantExtraAttemptFromMissing('${esc(s.id)}','${esc(h.id)}','${esc(cls||'')}')">🔓 إعادة</button>`}
      </div>
    </div>
  `).join('') : `
    <div class="alert-empty">
      <span>🎉</span>
      <span>لا يوجد طلاب متأخرون في هذا الفصل.</span>
    </div>`;

  openModal(`
    <div class="missing-summary-head">
      <div>
        <h2>${esc(title)}</h2>
        <p>نشاط «${esc(h.title)}»</p>
      </div>
      <span class="pill due">${missing.length} طالب</span>
    </div>

    ${missing.length ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap;margin:.65rem 0">
      <span style="font-size:.78rem;color:var(--ink-soft)">اختر الإجراء المطلوب لكل طالب أو اسمح للجميع دفعة واحدة.</span>
      ${pending.length ? `<button type="button" class="btn sm tick" onclick="grantExtraAttemptBulkForScope('${esc(h.id)}','${esc(cls||'')}')">👥 السماح للجميع (${pending.length})</button>` : `<span class="sa-retry sent" title="تم السماح لجميع الطلاب المتأخرين في هذا الفصل">✓ تم السماح للجميع</span>`}
    </div>` : ''}

    <div class="missing-student-list">
      ${rows}
    </div>

    <div class="modal-foot">
      <button class="btn" type="button" onclick="closeModal()">إغلاق</button>
    </div>`);
  const currentModal=document.getElementById('modal');
  if(currentModal){
    currentModal.dataset.missingHw=String(h.id);
    currentModal.dataset.missingClass=String(cls||'');
  }
}


async function grantExtraAttemptFromMissing(studentId, hwId, cls){
  await grantExtraAttempt(studentId, hwId);
  // أبقِ نفس نافذة الفصل مفتوحة، ولا نحولها إلى قائمة جميع المتأخرين.
  openMissingStudents(hwId, cls||'');
}

function openAlertStudentList(alertKey){
  const alert=dashboardAlerts().find(a=>a.key===alertKey);
  if(!alert){
    toast('تعذر العثور على قائمة الطلاب','bad');
    return;
  }

  const students=Array.isArray(alert.students) ? alert.students : [];
  if(!students.length){
    toast('لا توجد قائمة طلاب لهذه الحالة','bad');
    return;
  }

  const rows=students.map((s,i)=>`
    <div class="missing-student-row alert-student-list-row">
      <span class="missing-student-number">${i+1}</span>
      <div class="missing-student-data">
        <b>${esc(s.name||'طالب')}</b>
        <small>${esc(s.cls||'بدون فصل')}${s.secs ? ` • ${Number(s.secs)} ثانية` : ''}</small>
      </div>
      <button type="button" class="btn ghost sm" onclick="closeModal();openStudentProfile('${esc(s.id)}')">فتح الملف</button>
    </div>
  `).join('');

  openModal(`
    <div class="missing-summary-head">
      <div>
        <h2>اختيار الطالب</h2>
        <p>${esc(alert.title||'الطلاب المرتبطون بهذه الحالة')}</p>
      </div>
      <span class="pill due">${students.length} ${students.length===1?'طالب':'طلاب'}</span>
    </div>

    <div class="missing-student-list">
      ${rows}
    </div>

    <div class="modal-foot">
      <button class="btn" type="button" onclick="closeModal()">إغلاق</button>
    </div>`);
}

function openMissingSummary(activityId){
  const h=HW.find(x=>x.id===activityId);
  if(!h){
    toast('تعذر العثور على النشاط', 'bad');
    return;
  }

  const scope=hwPool(h);
  const missing=scope.filter(s=>!(h.subs&&h.subs[s.id]));
  const submitted=scope.length-missing.length;
  const submittedPct=scope.length ? Math.round((submitted/scope.length)*100) : 0;

  const byClass={};
  missing.forEach(s=>{
    const cls=s.cls||'بدون فصل';
    if(!byClass[cls]) byClass[cls]=[];
    byClass[cls].push(s);
  });

  const classRows=Object.entries(byClass)
    .sort((a,b)=>b[1].length-a[1].length)
    .map(([cls,students])=>{
      const classTotal=STUDENTS.filter(s=>(s.cls||'بدون فصل')===cls).length || students.length;
      const missingPct=classTotal ? Math.round((students.length/classTotal)*100) : 0;
      return `
        <div class="missing-class-row">
          <div class="missing-class-main">
            <b>${esc(cls)}</b>
            <span>${students.length} لم يسلّموا</span>
          </div>
          <div class="missing-class-meter">
            <i style="width:${Math.min(100,missingPct)}%"></i>
          </div>
          <strong>${missingPct}%</strong>
          <button class="btn ghost sm" type="button" onclick="openMissingStudents('${esc(h.id)}','${esc(cls)}')">عرض الطلاب</button>
        </div>`;
    }).join('');

  openModal(`
    <div class="missing-summary-head">
      <div>
        <h2>متابعة المتأخرين</h2>
        <p>نشاط «${esc(h.title)}»</p>
      </div>
      <span class="pill due">${missing.length} طالب</span>
    </div>

    <div class="missing-kpis">
      <div><b>${missing.length}</b><span>لم يسلّموا</span></div>
      <div><b>${submittedPct}%</b><span>نسبة التسليم</span></div>
      <div><b>${Object.keys(byClass).length}</b><span>فصول تحتاج متابعة</span></div>
    </div>

    <div class="missing-progress">
      <div class="missing-progress-head">
        <span>التسليم الحالي</span>
        <b>${submitted} من ${scope.length}</b>
      </div>
      <div class="progress-track"><i style="width:${submittedPct}%"></i></div>
    </div>

    ${missing.length ? `
    <div style="display:flex;justify-content:flex-end;margin:.7rem 0 .55rem">
      <button type="button" class="btn sm tick" onclick="grantExtraAttemptAllClasses('${esc(h.id)}')">
        👥 السماح لجميع الفصول (${missing.filter(s=>!hasExtraAttempt(h,s.id)).length})
      </button>
    </div>` : ''}

    <div class="missing-class-list">
      ${classRows || '<div class="feature-empty">لا يوجد طلاب متأخرون.</div>'}
    </div>

    <div class="modal-foot">
      <button class="btn ghost" type="button" onclick="closeModal()">إغلاق</button>
    </div>`);
}

async function grantExtraAttemptAllClasses(hwId){
  const h=HW.find(x=>String(x.id)===String(hwId));
  if(!h) return;

  const scope=hwPool(h);
  const missing=scope.filter(s=>!(h.subs&&h.subs[s.id]));
  const pending=missing.filter(s=>!hasExtraAttempt(h,s.id));

  if(!pending.length){
    toast('تم السماح لجميع الطلاب المتأخرين بالفعل','good');
    return;
  }

  // السماح على مستوى جميع الفصول للنشاط نفسه، ثم إعادة فتح نفس نافذة المتابعة.
  await grantExtraAttemptsForStudents(h,pending.map(s=>s.id));
  openMissingSummary(hwId);
}

function openBulkExtraAttempt(hwId){
  const h=HW.find(x=>String(x.id)===String(hwId));
  if(!h) return;

  const studentsForHw=STUDENTS.filter(s=>hwFor(h, s.cls));
  const missing=studentsForHw.filter(s=>!(h.subs&&h.subs[s.id]));
  if(!missing.length){
    toast('لا يوجد طلاب لم يسلّموا هذا النشاط','good');
    return;
  }

  const cls=hwClasses(h).length ? hwClsLabel(h) : 'عدة فصول';
  openModal(`
    <h2>🔓 السماح بإعادة التسليم</h2>
    <p style="margin:-.3rem 0 .9rem;color:var(--ink-soft);font-size:.82rem">
      <b>${esc(h.title)}</b><br>
      ${esc(cls)} · ${missing.length} ${missing.length===1?'طالب لم يسلّم':'طلاب لم يسلّموا'}
    </p>

    <div class="extra-attempt-info">
      <div><span>الخيار الأول</span><b>السماح للجميع (${missing.length})</b></div>
      <div><span>الخيار الثاني</span><b>اختيار طلاب محددين</b></div>
    </div>

    <div style="display:grid;gap:.55rem;margin-top:1rem">
      <button class="btn tick" type="button" onclick="grantExtraAttemptBulk('${esc(h.id)}','all')">
        👥 السماح لجميع من لم يسلّموا (${missing.length})
      </button>
      <button class="btn ghost" type="button" onclick="openSelectBulkExtraAttempt('${esc(h.id)}')">
        👤 اختيار طلاب محددين
      </button>
    </div>

    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إلغاء</button>
    </div>
  `);
}

function openSelectBulkExtraAttempt(hwId){
  const h=HW.find(x=>String(x.id)===String(hwId));
  if(!h) return;

  const missing=STUDENTS.filter(s=>(hwFor(h, s.cls)) && !(h.subs&&h.subs[s.id]));
  if(!missing.length){
    toast('لا يوجد طلاب لم يسلّموا هذا النشاط','good');
    return;
  }

  openModal(`
    <h2>👤 اختيار الطلاب</h2>
    <p style="margin:-.3rem 0 .7rem;color:var(--ink-soft);font-size:.82rem">
      اختر الطلاب الذين تريد السماح لهم بإعادة التسليم.
    </p>
    <div style="display:flex;gap:.45rem;flex-wrap:wrap;margin-bottom:.65rem">
      <button class="btn ghost sm" type="button" onclick="toggleBulkExtraStudents(true)">تحديد الكل</button>
      <button class="btn ghost sm" type="button" onclick="toggleBulkExtraStudents(false)">إلغاء التحديد</button>
    </div>
    <div id="bulk-extra-student-list" style="max-height:45vh;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:.35rem">
      ${missing.map(s=>`
        <label style="display:flex;align-items:center;gap:.6rem;padding:.55rem .45rem;border-bottom:1px solid var(--line);cursor:pointer">
          <input class="bulk-extra-student" type="checkbox" value="${esc(s.id)}">
          <span>${esc(s.name)}</span>
        </label>`).join('')}
    </div>
    <div class="modal-foot">
      <button class="btn ghost" type="button" onclick="openBulkExtraAttempt('${esc(h.id)}')">رجوع</button>
      <button class="btn tick" type="button" onclick="grantSelectedExtraAttempts('${esc(h.id)}')">🔓 السماح للمحددين</button>
    </div>
  `);
}

function toggleBulkExtraStudents(checked){
  document.querySelectorAll('.bulk-extra-student').forEach(el=>{el.checked=checked;});
}

async function grantExtraAttemptBulkForScope(hwId, cls){
  const h=HW.find(x=>String(x.id)===String(hwId));
  if(!h) return;
  const missing=STUDENTS.filter(s=>
    (hwFor(h, s.cls)) &&
    (!cls || (s.cls||'بدون فصل')===cls) &&
    !(h.subs&&h.subs[s.id])
  );
  // لا نعيد إرسال الصلاحية لمن سبق السماح له بها.
  const pending=missing.filter(s=>!hasExtraAttempt(h,s.id));
  await grantExtraAttemptsForStudents(h, pending.map(s=>s.id), true);
}

async function grantExtraAttemptBulk(hwId, mode){
  const h=HW.find(x=>String(x.id)===String(hwId));
  if(!h) return;
  const ids=mode==='all'
    ? STUDENTS.filter(s=>(hwFor(h, s.cls)) && !(h.subs&&h.subs[s.id])).map(s=>s.id)
    : [];
  await grantExtraAttemptsForStudents(h,ids);
}

async function grantSelectedExtraAttempts(hwId){
  const h=HW.find(x=>String(x.id)===String(hwId));
  if(!h) return;
  const ids=[...document.querySelectorAll('.bulk-extra-student:checked')].map(el=>el.value);
  if(!ids.length){
    toast('اختر طالبًا واحدًا على الأقل','bad');
    return;
  }
  await grantExtraAttemptsForStudents(h,ids);
}

async function grantExtraAttemptsForStudents(h,studentIds,keepModalOpen=false){
  const api=getApi(), tok=getTok();
  if(!api || !tok){
    toast('اضبط عنوان الخادم وكلمة السر أولاً','bad');
    return;
  }

  const unique=[...new Set(studentIds.map(String))];
  if(!unique.length){
    toast('لا يوجد طلاب يحتاجون إعادة التسليم','good');
    return;
  }

  const students=unique.map(id=>byId(id)).filter(Boolean);
  if(!students.length){
    toast('تعذر العثور على الطلاب المحددين','bad');
    return;
  }

  try{
    // إرسال جماعي واحد للخادم، بدل عشرات الطلبات المنفصلة التي قد يفشل بعضها.
    const r=await fetch(api+'/extra-attempt-bulk',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        t:tok,
        name:students[0]?.name || '',
        names:students.map(s=>s.name),
        hwId:h.sid || h.id,
        assignmentId:h.sid || h.id,
        extraAttempts:1
      })
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok || !j.ok) throw new Error(j.error || 'extra-attempt-bulk failed');

    // إذا أكد الخادم نجاح الطلب الجماعي، فكل الأسماء المرسلة عولجت بنجاح.
    // لا نعتمد على مطابقة الأسماء في رد الخادم لتحديث الأيقونات محليًا،
    // لأن بعض الأسماء العربية قد تحتوي اختلافات Unicode/مسافات خفية فتظل
    // الصلاحية محفوظة على الخادم بينما تبقى الأيقونة قديمة في النافذة.
    h.extraAttempts=h.extraAttempts||{};
    let ok=0;
    students.forEach(s=>{
      h.extraAttempts[s.id]=(h.extraAttempts[s.id]||0)+1;
      ok++;
    });
    save(K.hw,HW);

    renderNextActions();
    renderStudentCenterDetail();
    renderStudentsCenter();
    renderGrades();
    renderAnalysis();
    pullExtraAttemptStatus();
    markFollowupHandledMany(students.map(s=>s.id));
    renderDashboard();

    if(keepModalOpen){
      // أعد رسم نفس قائمة الفصل/النطاق من خلال بيانات الواجهة الحالية.
      // لا نغلق النافذة ولا نحولها إلى «جميع المتأخرين».
      const modal= document.querySelector('.modal');
      if(modal){
        const scopeCls = modal.dataset.missingClass || '';
        const scopeHw = modal.dataset.missingHw || h.id;
        openMissingStudents(scopeHw, scopeCls);
      }
    }else{
      closeModal();
    }

    if(ok<students.length){
      toast(`تم السماح لـ ${ok} طالب، وتعذر تحديث ${students.length-ok}`,'bad');
    }else{
      toast(`تم السماح لـ ${ok} ${ok===1?'طالب':'طلاب'} بإعادة التسليم ✓`,'good');
    }
  }catch(e){
    console.error('grantExtraAttemptsForStudents:',e);
    toast('تعذر تنفيذ عملية السماح','bad');
  }
}

function markFollowupHandledMany(studentIds){
  let changed=false;
  [...new Set(studentIds.map(String))].forEach(id=>{
    const s=byId(id);
    if(!s) return;
    const key=followupCaseKey(s);
    if(!key || s.followupHandledKey===key) return;
    s.followupHandledKey=key;
    changed=true;
  });
  if(changed){
    save(K.st,STUDENTS);
    pushState();
  }
}

function openFollowupAllStudents(){
  const rest=Array.isArray(window.__followupAll) ? window.__followupAll : [];
  if(!rest.length){ toast('لا يوجد طلاب يحتاجون متابعة الآن','good'); return; }
  const open=rest.filter(x=>!isFollowupHandled(x.s)).length;

  openModal(`
    <div class="missing-summary-head">
      <div>
        <h2>👥 جميع الطلاب المتأخرين</h2>
        <p>${open ? `${open} لم تُتابعهم بعد (في الأعلى)، ثم من أرسلت لهم تذكيرًا.` : 'أرسلت تذكيرًا لهم جميعًا. يعود الطالب للمتابعة إذا تأخر في نشاط جديد.'}</p>
      </div>
      <span class="pill due">${rest.length} طالب</span>
    </div>
    <div class="feature-list" style="max-height:55vh;overflow:auto">
      ${rest.map((x,i)=>{
        const count=x.missing;
        return `
          <div class="feature-item student-row-click" onclick="openStudentProfile('${esc(x.s.id)}')">
            <span class="avatar" style="width:38px;height:38px;font-size:.78rem">${esc(initials(x.s.name))}</span>
            <div class="fi-main">
              <div class="fi-title">${i+1}. ${esc(x.s.name)}</div>
              <div class="fi-sub">${esc(x.s.cls||'بدون فصل')} · ${count} ${count===1?'نشاط لم يسلّمه':'أنشطة لم يسلّمها'}${isFollowupHandled(x.s)?` · <b style="color:var(--tick)">✓ تمت متابعته${remStudentSummary(x.s)?` (${remStudentSummary(x.s)})`:''}</b>`:''}</div>
            </div>
            <span class="followup-count">${count}</span>
            <span class="followup-arrow">‹</span>
          </div>`;
      }).join('')}
    </div>
    <div class="modal-foot">
      <button class="btn ghost" type="button" onclick="closeModal()">إغلاق</button>
    </div>`);
}

async function openRecentProjectSubmission(hwId, studentId){
  const h=HW.find(x=>String(x?.id||x?.sid)===String(hwId));
  const st=byId(studentId);
  const v=h?.subs?.[studentId];
  if(!h || !st || !v || h.kind!=='files'){ toast('تعذّر فتح تسليم المشروع','bad'); return; }
  const files=Array.isArray(v.files)?v.files:[];
  if(!files.length){ toast('لا توجد ملفات مرفوعة لهذا المشروع','bad'); return; }

  // استخدم نفس سجل «تبويب المشاريع» عند فتح التسليم من لوحة التحكم.
  // هذا يمنع اختلاف معرّف المشروع المحلي عن معرّف المشروع الذي يفهمه الخادم.
  if(!PROJECTS_LOADED){
    try{ await loadProjects(false); }catch(_){}
  }

  const projectIds=[h.sid,h.id].map(x=>String(x||'')).filter(Boolean);
  const sid=String(st.id||studentId||'');
  const at=String(v.at||0);

  const projectRow=(PROJECTS_DATA||[]).find(x=>{
    const xid=String(x?.projectId||x?.project?.sid||x?.project?.id||'');
    const xsid=String(x?.studentId||x?.student?.sid||x?.student?.id||'');
    return projectIds.includes(xid) &&
           xsid===sid &&
           String(x?.at||0)===at;
  }) || (PROJECTS_DATA||[]).find(x=>{
    const xid=String(x?.projectId||x?.project?.sid||x?.project?.id||'');
    const xsid=String(x?.studentId||x?.student?.sid||x?.student?.id||'');
    return projectIds.includes(xid) && xsid===sid;
  });

  if(projectRow){
    window.__visibleProjects=[projectRow];
  }else{
    // احتياط للتسليمات التي لم تُدرج في PROJECTS_DATA بعد.
    window.__visibleProjects=[{
      project:h, student:st, projectId:h.sid||h.id, studentId:sid,
      title:h.title, studentName:st.name, cls:st.cls||'', at:v.at||0, files,
      reviewStatus:String(v.reviewStatus||'pending').toLowerCase(),
      reviewReason:v.reviewReason||'', resubmitUntil:Number(v.resubmitUntil)||0,
      fromDashboard:true
    }];
  }

  openProjectViewer(0);
}

/* 📚 واجبات مدرستي غير المحلولة لطالب (للتذكير). مهلة قصيرة: إن تعذّر، يُرسل التذكير بدونها */
async function madUnsolvedFor(sid){
  try{
    const j = await Promise.race([madApi('/madrasati/student',{sid:String(sid)}), new Promise((_,no)=>setTimeout(()=>no(new Error('timeout')),4000))]);
    return j && j.linked ? madOpenOnly(j.unsolved||[]) : [];
  }catch(e){ return []; }
}
async function openStudentReminder(id){
  const s=byId(id);
  if(!s) return;
  const missing=getStudentMissingActivities(s);
  const mad=await madUnsolvedFor(s.id); try{ if(typeof madKeysLoad==='function') await madKeysLoad(); }catch(e){}
  const soon=remSoonActivities(s);
  let paper=[]; try{ paper=remPaperMissed(s, await loadComprehensiveClassroom(false)); }catch(e){}

  if(!missing.length && !mad.length && !soon.length && !paper.length){
    toast('لا أنشطة متأخرة أو قريبة، ولا واجب ورقي ناقص، ولا واجبات مدرستي غير محلولة لهذا الطالب','good');
    return;
  }

  const {parent:message, student:studentMsg}=remCompose(s,{missing,soon,paper,mad});

  openModal(`
    <h2>📨 إرسال تذكير</h2>
    <div style="margin:.35rem 0 .7rem;color:var(--ink-soft);font-size:.84rem">
      ${esc(s.name)} · ${esc(s.cls||'بدون فصل')}${missing.length?` · ${missing.length} ${missing.length===1?'نشاط متأخر':'أنشطة متأخرة'}`:''}${soon.length?` · ${soon.length} ينتهي قريبًا`:''}${paper.length?` · واجب ورقي ناقص ${paper.length}`:''}${mad.length?` · ${mad.length} ${mad.length===1?'واجب مدرستي':'واجبات مدرستي'}`:''}
    </div>
    <div class="rem-history" id="rem-history">${remHistoryHTML(s)}</div>
    <div class="rem-sec">
      <div class="rem-h"><b>📲 إلى الطالب</b><small>تصله في «أنشطتي» وتنبيهًا على جواله إن فعّل التنبيهات</small></div>
      <textarea class="rem-area" id="student-reminder-student" aria-label="نص رسالة الطالب">${esc(studentMsg)}</textarea>
      <button class="btn primary rem-btn" id="rem-send" type="button" onclick="sendStudentReminder('${esc(s.id)}')">📨 إرسال للطالب</button>
      <div class="rem-status" id="rem-status"></div>
    </div>
    <div class="rem-sec">
      <div class="rem-h"><b>👨‍👩‍👦 إلى ولي الأمر</b><small>انسخها أو افتح واتساب مباشرة</small></div>
      <textarea class="rem-area" id="student-reminder-message" aria-label="نص رسالة ولي الأمر">${esc(message)}</textarea>
      <div class="rem-row">
        <button class="btn ghost rem-btn" type="button" onclick="copyStudentReminder('${esc(s.id)}')">📋 نسخ الرسالة</button>
        <button class="btn ghost rem-btn" type="button" onclick="whatsappStudentReminder('${esc(s.id)}',this)">💬 فتح واتساب</button>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إغلاق</button>
    </div>
  `);
}
/* ضغطة أولى على قناة أُرسل عبرها خلال 48 ساعة: تنبيه بدل الإرسال؛ الضغطة الثانية ترسل */
const REM_ARMED = {};
function remGuard(id, ch, btn){
  const s = byId(id), last = remLast(s, ch), k = id + '|' + ch;
  if(!last || Date.now() - last.at > REM_GUARD_MS || REM_ARMED[k]){ delete REM_ARMED[k]; return true; }
  REM_ARMED[k] = true;
  if(btn){ btn.dataset.orig = btn.dataset.orig || btn.textContent; btn.textContent = `⚠️ أُرسل ${remAgo(last.at)} — اضغط مرة أخرى للتأكيد`; btn.classList.add('rem-armed'); }
  toast(`أرسلت له تذكيرًا ${remAgo(last.at)} عبر هذه القناة`, 'bad');
  return false;
}

async function sendStudentReminder(id){
  const s=byId(id), area=document.getElementById('student-reminder-student'), btn=document.getElementById('rem-send'), st=document.getElementById('rem-status');
  if(!s || !area) return;
  const body=String(area.value||'').trim();
  if(!body){ toast('اكتب نص الرسالة أولًا','bad'); return; }
  if(!remGuard(id,'student',btn)) return;
  const api=getApi(), tok=getTok();
  if(!api || !tok){ toast('اضبط عنوان الخادم وكلمة السر أولًا','bad'); return; }
  btn.disabled=true; btn.textContent='جارٍ الإرسال…'; if(st){ st.className='rem-status'; st.textContent=''; }
  try{
    const r=await fetch(api.replace(/\/+$/,'')+'/messages',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ t:tok, audience:'students', title:'تذكير: أنشطة لم تُسلَّم', body, type:'activity', priority:'important',
        recipients:[{ id:String(s.id), name:String(s.name||'') }] })});
    const j=await r.json().catch(()=>({}));
    if(!r.ok || !j.ok) throw new Error(j.error==='not delivered' ? 'الطالب غير موجود على الخادم — زامن الطلاب' : (j.error||('HTTP '+r.status)));
    remLogAdd(id,'student');
    markFollowupHandled(id);
    renderDashboard();
    btn.textContent='✓ أُرسلت للطالب'; btn.classList.remove('rem-armed');
    if(st){ st.className='rem-status ok'; st.textContent='وصلت إلى «أنشطتي»، ويصله تنبيه على جواله إن كان مفعّلًا.'; }
    toast(`أُرسل التذكير إلى ${s.name}`,'good');
  }catch(e){
    btn.disabled=false; btn.textContent='📨 إرسال للطالب';
    if(st){ st.className='rem-status bad'; st.textContent='لم يُرسل: '+(e.message||'تعذّر الاتصال'); }
  }
}
/* 💬 واتساب: لا يوجد رقم ولي أمر محفوظ، فيُفتح واتساب والرسالة جاهزة لتختار المحادثة */
function whatsappStudentReminder(id, btn){
  const area=document.getElementById('student-reminder-message'); if(!area) return;
  if(!remGuard(id,'parent',btn)) return;
  if(btn){ btn.textContent=btn.dataset.orig||btn.textContent; btn.classList.remove('rem-armed'); }
  remLogAdd(id,'parent','whatsapp');
  const url=parWaUrl(id, area.value||'');
  const w=window.open(url,'_blank','noopener');
  if(!w) location.href=url;
  markFollowupHandled(id);
  renderDashboard();
}

async function copyStudentReminder(id){
  const area=document.getElementById('student-reminder-message');
  if(!area) return;
  const message=area.value||'';
  let copied=false;

  try{
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(message);
      copied=true;
    }
  }catch(_){}

  if(!copied){
    try{
      area.focus();
      area.select();
      area.setSelectionRange(0,area.value.length);
      copied=document.execCommand('copy');
    }catch(_){}
  }

  if(copied){
    remLogAdd(id,'parent','copy');
    markFollowupHandled(id);
    renderDashboard();
    toast('تم نسخ رسالة التذكير','good');
  }else toast('تعذّر نسخ الرسالة، حاول مرة أخرى','bad');
}


function openStudentOverdue(studentId){
  const s=byId(studentId);
  if(!s) return;

  const missing=getStudentMissingActivities(s);
  if(!missing.length){
    toast('لا توجد أنشطة متأخرة لهذا الطالب','good');
    return;
  }

  const rows=missing.map(h=>`
    <div class="feature-item">
      <span class="fi-icon">⏰</span>
      <div class="fi-main">
        <div class="fi-title">${esc(h.title)}</div>
        <div class="fi-sub">موعد التسليم: ${esc(fmtDate(h.due+'T00:00:00'))}</div>
      </div>
      <b style="color:var(--pen)">متأخر</b>
    </div>`).join('');

  openModal(`
    <h2>📋 الأنشطة المتأخرة</h2>
    <div style="margin:.35rem 0 .8rem;color:var(--ink-soft);font-size:.84rem">
      ${esc(s.name)} · ${esc(s.cls||'بدون فصل')} · ${missing.length} ${missing.length===1?'نشاط':'أنشطة'}
    </div>
    <div class="feature-list" style="max-height:430px;overflow:auto">${rows}</div>
    <div class="modal-foot">
      <button class="btn ghost" type="button" onclick="closeModal();openStudentProfile('${esc(s.id)}')">العودة لملف الطالب</button>
      <button class="btn" type="button" onclick="closeModal()">إغلاق</button>
    </div>
  `);
}

function openStudentRetryChooser(studentId){
  const s=byId(studentId);
  if(!s) return;

  const activities=(studentStats(s).acts||[]).filter(h=>{
    if(!hwFor(h, s.cls)) return false;
    return true;
  });

  if(!activities.length){
    toast('لا توجد أنشطة لهذا الطالب','bad');
    return;
  }

  const rows=activities.map(h=>{
    const v=h.subs&&h.subs[s.id];
    const hasExtra=hasExtraAttempt(h,s.id);
    const status=v ? 'تم التسليم' : 'لم يسلّم';
    const extra=hasExtra ? ` · سُمح سابقًا ${Number(h.extraAttempts[s.id])} مرة` : '';
    return `
      <div class="feature-item">
        <span class="fi-icon">${v?'📘':'⏰'}</span>
        <div class="fi-main">
          <div class="fi-title">${esc(h.title)}</div>
          <div class="fi-sub">${status}${extra}</div>
        </div>
        <button class="btn ${hasExtra?'ghost':'tick'} sm" type="button"
          onclick="openGrantExtraAttempt('${esc(s.id)}','${esc(h.id)}')">
          ${hasExtra?'🔓 سماح مرة أخرى':'🔓 السماح'}
        </button>
      </div>`;
  }).join('');

  openModal(`
    <h2>🔓 السماح بإعادة التسليم</h2>
    <div style="margin:.35rem 0 .8rem;color:var(--ink-soft);font-size:.84rem">
      ${esc(s.name)} · اختر النشاط الذي تريد منحه محاولة إضافية.
    </div>
    <div class="feature-list" style="max-height:430px;overflow:auto">${rows}</div>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal();openStudentProfile('${esc(s.id)}')">العودة لملف الطالب</button>
      <button class="btn" onclick="closeModal()">إغلاق</button>
    </div>
  `);
}

function badgesHtml(studentId){
  const list=studentId ? studentBadges(byId(studentId)) : STUDENTS.flatMap(s=>studentBadges(s).filter(b=>b.unlocked));
  if(studentId){
    return `<div class="badge-grid">${list.map(b=>`<div class="badge ${b.unlocked?'unlocked':''}"><span class="bi">${b.ic}</span><b>${b.name}</b><span>${b.desc}</span></div>`).join('')}</div>`;
  }
  const counts={};
  STUDENTS.forEach(s=>studentBadges(s).forEach(b=>{if(b.unlocked) counts[b.id]=(counts[b.id]||0)+1;}));
  const defs=studentBadges(STUDENTS[0]||{});
  return `<div class="badge-grid">${defs.map(b=>`<div class="badge ${counts[b.id]?'unlocked':''}"><span class="bi">${b.ic}</span><b>${b.name}</b><span>${counts[b.id]||0} طالب</span></div>`).join('')}</div>`;
}

function openBadges(studentId){
  openModal(`<h2>🏆 ${studentId ? 'إنجازات الطالب' : 'إنجازات الطلاب'}</h2>${badgesHtml(studentId)}
    <div class="modal-foot"><button class="btn" onclick="closeModal()">إغلاق</button></div>`);
}

async function sendFastReviewRequest(studentId, hwId, reason){
  reason = reason==='low' ? 'low' : reason==='away' ? 'away' : 'fast';
  const s=byId(studentId), h=HW.find(x=>String(x.id)===String(hwId));
  if(!s||!h) return;
  const api=getApi(), tok=getTok();
  if(!api || !tok){ toast('اضبط عنوان الخادم وكلمة السر أولاً','bad'); return; }
  try{
    const r=await fetch(api+'/review-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:tok,name:s.name,studentId:s.id,hwId:(h.sid||h.id),assignmentId:(h.sid||h.id),localId:h.id,reason})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok || !j.ok) throw new Error(j.detail || j.error || `HTTP ${r.status}`);
    dismissAlert(alertKey(['fast-student',h.id,s.id]));
    toast(`تم إرسال ${reason==='away'?'مهمة تحقق':'مهمة تصحيح'} إلى ${s.name} ✓ — يصلك إشعار بنتيجتها`,'good');
    rtStatusLoad(h.id);   // حدّث الحالة في تقرير النشاط إن كان مفتوحًا
  }catch(e){ console.error(e); toast(`تعذّر إرسال طلب المراجعة: ${e.message || 'خطأ غير معروف'}`,'bad'); const b=document.getElementById('rt-btn-'+studentId); if(b) b.disabled=false; }
}


function getStudentClassValue(s){
  const direct = String(s?.cls || s?.className || s?.class || '').trim();
  if(direct) return direct;
  const grade = String(s?.grade || '').trim();
  const section = String(s?.section || '').trim();
  if(grade && section) return `${grade} - ${section}`;
  return grade || section || '';
}

function populateStudentSearchClasses(){
  const menu=document.getElementById('feature-student-class-menu');
  const trigger=document.getElementById('feature-student-class-trigger');
  if(!menu||!trigger) return;

  const classes=[...new Set(
    (Array.isArray(STUDENTS)?STUDENTS:[])
      .map(getStudentClassValue)
      .filter(Boolean)
  )].sort((a,b)=>a.localeCompare(b,'ar',{numeric:true,sensitivity:'base'}));

  const current=String(window._studentSearchClass||'').trim();
  const options=[''].concat(classes);

  menu.innerHTML=options.map(cls=>{
    const label=cls ? `📚 ${esc(cls)}` : '📚 كل الفصول';
    const active=cls===current ? ' active' : '';
    return `<button type="button" class="student-class-option${active}" onclick="selectStudentSearchClass('${esc(cls)}')">${label}${cls===current?' ✓':''}</button>`;
  }).join('');

  trigger.innerHTML=`📚 ${current ? esc(current) : 'اختر الفصل: الكل'} <span class="student-class-chevron">⌄</span>`;
}


function selectStudentSearchClass(cls){
  window._studentSearchClass=String(cls||'').trim();
  populateStudentSearchClasses();
  const menu=document.getElementById('feature-student-class-menu');
  const trigger=document.getElementById('feature-student-class-trigger');
  if(menu) menu.hidden=true;
  if(trigger) trigger.setAttribute('aria-expanded','false');
  renderFeatureStudentSearch();
}


function renderFeatureStudentSearch(){
  const selectedClass = String(window._studentSearchClass || '').trim();
  const box=document.getElementById('feature-student-search');
  const out=document.getElementById('feature-student-results');
  if(!box||!out) return;
  const q=normAr(box.value);
  const filter=window._studentSearchFilter||'all';

  let list=STUDENTS.filter(s=>{
    const studentClass = getStudentClassValue(s);
    const queryText = normAr(`${s.name || ''} ${studentClass}`);
    return (!q || queryText.includes(q)) && (!selectedClass || studentClass === selectedClass);
  }).map(s=>{
    const st=studentStats(s);
    const missing=Math.max(0,st.acts.length-st.done);
    return {s,st,missing};
  });

  if(filter==='needs') list=list.filter(x=>x.missing>0);
  if(filter==='low') list=list.filter(x=>x.st.pct<70);

  list=list.slice(0,30);

  out.innerHTML=list.map(x=>{
    const s=x.s, st=x.st, missing=x.missing;
    const studentClass=getStudentClassValue(s);
    const state = missing>0 ? `${missing} ${missing===1?'نشاط متأخر':'أنشطة تحتاج متابعة'}` : 'مكتمل';
    return `<div class="student-search-card">
      <div class="student-search-main" onclick="openStudentProfile('${esc(s.id)}')">
        <span class="avatar">${esc(initials(s.name))}</span>
        <div class="fi-main">
          <div class="fi-title">${esc(s.name)}</div>
          <div class="fi-sub">${esc(studentClass||'بدون فصل')} · ${state}</div>
          <div class="student-search-kpis">
            <span>📊 ${st.pct}% إنجاز</span>
            <span>📚 ${st.done}/${st.acts.length} أنشطة</span>
            <span>⭐ ${s.points||0} نقطة</span>
          </div>
        </div>
      </div>
      <div class="student-search-actions">
        <button class="btn ghost sm" type="button" onclick="openStudentProfile('${esc(s.id)}')">👤 ملف الطالب</button>
        ${missing>0 ? `<button class="btn sm" type="button" onclick="openStudentReminder('${esc(s.id)}')">📨 تذكير</button>` : ''}
      </div>
    </div>`;
  }).join('') || '<div class="feature-empty">لا يوجد طالب مطابق لهذه الشروط.</div>';
}

function openQuickStudent(){
  openStudentForm();
}

function openGoals(){
  const completed=UI_GOALS.filter(g=>g.done).length;
  openModal(`<h2>🎯 أهداف المعلم</h2>
    <div class="goal-card" style="margin-bottom:.7rem">
      <div class="goal-row"><div class="goal-info"><b>هدف أسبوعي للفصل</b><span>إكمال الأنشطة بنسبة 80%</span></div><button class="btn ghost sm" onclick="createDefaultGoal()">تفعيل</button></div>
    </div>
    <div id="goal-list">${renderGoalsHtml()}</div>
    <div class="modal-foot"><button class="btn" onclick="closeModal()">إغلاق</button></div>`);
}

function renderGoalsHtml(){
  if(!UI_GOALS.length) return '<div class="feature-empty">لا توجد أهداف مخصصة. فعّل هدفًا من الأعلى.</div>';
  return UI_GOALS.map(g=>{
    const current=g.type==='completion' ? pct(activityStats().reduce((n,x)=>n+x.done,0),activityStats().reduce((n,x)=>n+x.total,0)) : STUDENTS.reduce((n,s)=>n+(s.points||0),0);
    const value=Math.min(g.target,current), p=pct(value,g.target);
    return `<div class="goal-card" style="margin-bottom:.55rem"><div class="goal-row"><div class="goal-info"><b>${esc(g.title)}</b><span>${value} / ${g.target}</span></div><b>${p}%</b></div><div class="progress-track" style="margin-top:.55rem"><i style="width:${p}%"></i></div></div>`;
  }).join('');
}

function createDefaultGoal(){
  if(!UI_GOALS.some(g=>g.id==='weekly')){
    UI_GOALS.push({id:'weekly',type:'completion',title:'إكمال أنشطة الفصل',target:80,done:false});
    uiSave(K_UI.goals,UI_GOALS);
  }
  openGoals();
}


function toggleUiTheme(){
  UI_THEME=UI_THEME==='dark'?'light':'dark';
  uiSave(K_UI.theme,UI_THEME);
  applyUiTheme();
}

function backToReportsHub(){
  __reportsHubActive=false;
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));
  document.getElementById('p-reports-main')?.classList.add('on');
  document.querySelectorAll('.tab,.mobile-nav button[data-tab]').forEach(x=>x.classList.toggle('on',x.dataset.tab==='grades'));
  document.querySelectorAll('.report-switch-btn').forEach(btn=>{
    const m=(btn.getAttribute('onclick')||'').match(/switchReportView\('([^']+)'\)/);
    if(m){ btn.classList.remove('on'); btn.setAttribute('aria-selected','false'); }
  });
}

function switchReportView(view){
  const valid=new Set(['grades','analysis','diag','styles']);
  if(view==='comprehensive' || view==='weekly' || view==='compan'){
    __reportsHubActive=true;
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));
    const id=view==='weekly'?'p-weekly':view==='compan'?'p-compan':'p-comprehensive';
    document.getElementById(id)?.classList.add('on');
    document.querySelectorAll('.tab,.mobile-nav button[data-tab]').forEach(x=>x.classList.toggle('on',x.dataset.tab==='reports'));
    if(view==='weekly') renderWeekly(false);
    else if(view==='compan') renderCompAnalysis(false);
    else renderComprehensive(false);
    document.querySelectorAll('.report-switch-btn').forEach(btn=>{
      const m=(btn.getAttribute('onclick')||'').match(/switchReportView\('([^']+)'\)/);
      if(m){ btn.classList.toggle('on',m[1]===view); btn.setAttribute('aria-selected',m[1]===view?'true':'false'); }
    });
    return;
  }
  if(!valid.has(view)) view='grades';
  const grades=document.getElementById('p-grades');
  const mainReports=document.getElementById('p-reports-main');
  const analysis=document.getElementById('p-analysis');
  const styles=document.getElementById('p-styles');
  const diag=document.getElementById('p-diag');
  document.getElementById('p-reports')?.classList.remove('on');
  mainReports?.classList.remove('on');
  document.getElementById('p-comprehensive')?.classList.remove('on');
  document.getElementById('p-weekly')?.classList.remove('on');
  document.getElementById('p-compan')?.classList.remove('on');
  grades?.classList.toggle('on',view==='grades');
  analysis?.classList.toggle('on',view==='analysis');
  styles?.classList.toggle('on',view==='styles');
  diag?.classList.toggle('on',view==='diag');
  [grades,analysis,styles,diag].forEach(p=>p?.classList.toggle('report-view-hidden',!p.classList.contains('on')));
  document.querySelectorAll('.tab,.mobile-nav button[data-tab]').forEach(x=>x.classList.toggle('on',x.dataset.tab==='grades'));
  document.querySelectorAll('.report-switch-btn').forEach(btn=>{
    const m=(btn.getAttribute('onclick')||'').match(/switchReportView\('([^']+)'\)/);
    if(m){ btn.classList.toggle('on',m[1]===view); btn.setAttribute('aria-selected',m[1]===view?'true':'false'); }
  });
  if(view==='grades') renderGrades();
  else if(view==='analysis'){ anFillClasses(); anFillHw(); renderAnalysis(); }
  else if(view==='diag') renderDiagPanel();
  else if(view==='styles') renderStylesPanel();
}
function toggleScDir(){
  SC_DIR = SC_DIR === 'desc' ? 'asc' : 'desc';
  const b = document.getElementById('sc-dir');
  if(b){ b.textContent = SC_DIR === 'desc' ? '↓' : '↑';
         b.title = SC_DIR === 'desc' ? 'الأعلى أولاً — اضغط للعكس' : 'الأدنى أولاً — اضغط للعكس'; }
  renderStudentsCenter();
}

function selectStudentCenter(id,rerender=true){
  const s=byId(id); if(!s) return;
  STUDENT_CENTER_SELECTED=id;
  if(rerender) renderStudentsCenter();
  else {
    renderStudentCenterDetail(1);
    document.querySelectorAll('.student-list-item').forEach(el=>el.classList.remove('selected'));
    const target=[...document.querySelectorAll('.student-list-item')].find(el=>el.getAttribute('onclick')?.includes(`'${id}'`));
    if(target) target.classList.add('selected');
  }
  // 📱 الجوال: الملف بملء الشاشة وزر «القائمة» يعيد إليها
  if(stcMobile()){ stcPanel()?.classList.add('stc-open'); window.scrollTo({top:0}); }
}

let POINTS_TARGET = null;
function openAddStudentPoints(studentId){
  const s=byId(studentId);
  if(!s) return;
  POINTS_TARGET = s.id;

  openModal(`
    <h2>＋ إضافة نقاط للطالب</h2>
    <p style="margin:-.35rem 0 1rem;color:var(--ink-soft);font-size:.82rem">
      ${esc(s.name)} · الرصيد الحالي <b>${s.points||0}</b> نقطة
    </p>

    <div class="field">
      <label>عدد النقاط</label>
      <input class="inp" id="student-points-amount" type="number" min="1" max="1000" step="1"
             value="5" inputmode="numeric" autofocus>
    </div>

    <div class="points-quick">
      <button class="btn ghost sm" onclick="setStudentPointsAmount(1)">+1</button>
      <button class="btn ghost sm" onclick="setStudentPointsAmount(5)">+5</button>
      <button class="btn ghost sm" onclick="setStudentPointsAmount(10)">+10</button>
      <button class="btn ghost sm" onclick="setStudentPointsAmount(20)">+20</button>
      <button class="btn ghost sm" onclick="setStudentPointsAmount(50)">+50</button>
      <button class="btn ghost sm" onclick="setStudentPointsAmount(100)">+100</button>
      <button class="btn ghost sm" onclick="setStudentPointsAmount(500)">+500</button>
    </div>

    <div class="points-preview">
      الرصيد بعد الإضافة:
      <b id="student-points-preview">${(s.points||0)+5}</b> نقطة
    </div>

    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn tick" onclick="addStudentPoints('${esc(s.id)}')">إضافة النقاط</button>
    </div>
  `);

  const inp=document.getElementById('student-points-amount');
  if(inp) inp.addEventListener('input', updateStudentPointsPreview);
}

function setStudentPointsAmount(value){
  const inp=document.getElementById('student-points-amount');
  if(!inp) return;
  inp.value=value;
  updateStudentPointsPreview();
  inp.focus();
}

function updateStudentPointsPreview(){
  const s=byId(POINTS_TARGET || STUDENT_CENTER_SELECTED);
  const inp=document.getElementById('student-points-amount');
  const out=document.getElementById('student-points-preview');
  if(!s||!inp||!out) return;
  const amount=Math.max(1,Math.min(1000,parseInt(inp.value,10)||0));
  out.textContent=(s.points||0)+amount;
}

/* 🎁 مكافأة جماعية: نقاط لكل الطلاب أو لفصل — عبر /adjust-bulk على دفعات (20 طالبًا)،
   ويُعتمد رصيد كل طالب كما يعيده الخادم (مثل الإضافة الفردية) */
function bulkPointsTargets(scope){ return STUDENTS.filter(s=>s && s.id && (!scope || String(s.cls||'')===scope)); }
/* المستهدفون حسب الاختيار: الكل، أو فصل، أو طلاب محددون (فائزو مسابقة خارجية مثلًا) */
const BP={ mode:'all', cls:'', picked:new Set(), q:'', fcls:'' };
function bpTargets(){ return BP.mode==='pick' ? STUDENTS.filter(s=>s&&s.id&&BP.picked.has(String(s.id))) : bulkPointsTargets(BP.mode==='cls'?BP.cls:''); }
function openBulkPoints(){
  const cls=classes(), cur=(document.getElementById('students-center-class')||{}).value||'';
  BP.mode='all'; BP.cls=cur||cls[0]||''; BP.picked=new Set(); BP.q=''; BP.fcls='';
  openModal(`<div class="bp2"><h2>🎁 مكافأة نقاط</h2>
    <p class="muted" style="margin:.2rem 0 .8rem">تُضاف النقاط لرصيد الطالب مباشرة، وتصله <b>بطاقة تهنئة</b> في بوابته مع إشعار.</p>
    <div class="field"><label>عدد النقاط لكل طالب</label>
      <div class="bp2-amt"><input class="inp" id="bp-amount" type="number" min="1" max="1000" value="50" inputmode="numeric" oninput="bulkPointsSummary()">
        ${[10,25,50,100].map(v=>`<button type="button" class="bp2-chip" onclick="document.getElementById('bp-amount').value=${v};bulkPointsSummary()">${v}</button>`).join('')}</div></div>
    <div class="field"><label>لمن؟</label>
      <div class="bp2-seg">${[['all',`👥 كل الطلاب (${bulkPointsTargets('').length})`],['cls','🏫 فصل'],['pick','🎯 طلاب محددون']].map(([k,t])=>`<button type="button" data-bpm="${k}" class="${k===BP.mode?'on':''}" onclick="bpMode('${k}')">${t}</button>`).join('')}</div>
      <div id="bp-cls-box" class="hide" style="margin-top:.5rem"><select class="inp" id="bp-scope" onchange="BP.cls=this.value;bulkPointsSummary()">
        ${cls.map(c=>`<option value="${esc(c)}" ${c===BP.cls?'selected':''}>${esc(c)} (${bulkPointsTargets(c).length})</option>`).join('')}</select></div>
      <div id="bp-pick-box" class="hide bp2-pick">
        <div class="bp2-tools"><input class="inp" id="bp-q" placeholder="🔍 ابحث باسم الطالب" oninput="BP.q=this.value;bpList()">
          <select class="inp" id="bp-fcls" onchange="BP.fcls=this.value;bpList()"><option value="">كل الفصول</option>${cls.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></div>
        <div id="bp-chosen" class="bp2-chosen"></div>
        <div id="bp-list" class="bp2-list"></div></div></div>
    <div class="field"><label>سبب المكافأة <small class="muted">(يظهر في بطاقة الطالب)</small></label>
      <input class="inp" id="bp-reason" maxlength="80" placeholder="مثال: الفوز في مسابقة الأولمبياد العلمي"></div>
    <div class="field"><label>رسالة للطالب <small class="muted">(اختياري)</small></label>
      <textarea class="inp" id="bp-note" maxlength="300" rows="2" placeholder="مثال: أحسنت! فخور بإنجازك 🌟"></textarea></div>
    <label class="bp2-ann"><input type="checkbox" id="bp-announce" checked> 🎉 أرسل بطاقة تهنئة للطالب في بوابته (مع إشعار)</label>
    <div id="bp-progress" class="bp-progress hide"><div class="bp-bar"><i id="bp-bar-i"></i></div><small id="bp-progress-t"></small></div>
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn tick" id="bp-go" onclick="runBulkPoints()"></button></div></div>`);
  bulkPointsSummary();
}
function bpMode(k){ BP.mode=k; document.querySelectorAll('[data-bpm]').forEach(b=>b.classList.toggle('on',b.dataset.bpm===k));
  document.getElementById('bp-cls-box').classList.toggle('hide',k!=='cls'); document.getElementById('bp-pick-box').classList.toggle('hide',k!=='pick');
  if(k==='pick'){ bpList(); setTimeout(()=>document.getElementById('bp-q')?.focus(),50); } bulkPointsSummary(); }
function bpList(){
  const box=document.getElementById('bp-list'), ch=document.getElementById('bp-chosen'); if(!box) return;
  const q=normAr(BP.q||''), L=STUDENTS.filter(s=>s&&s.id&&(!BP.fcls||String(s.cls||'')===BP.fcls)&&(!q||stuMatch(BP.q,s.name))).sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar'));
  box.innerHTML=L.slice(0,200).map(s=>`<label class="bp2-row ${BP.picked.has(String(s.id))?'on':''}"><input type="checkbox" ${BP.picked.has(String(s.id))?'checked':''} onchange="bpToggle('${esc(String(s.id))}',this.checked)"><span>${esc(s.name)}</span><small>${esc(s.cls||'')}</small></label>`).join('')||'<div class="muted" style="padding:.6rem">لا نتائج</div>';
  const P=STUDENTS.filter(s=>s&&BP.picked.has(String(s.id)));
  ch.innerHTML=P.length?P.map(s=>`<button type="button" class="bp2-tag" onclick="bpToggle('${esc(String(s.id))}',false)" title="إزالة">${esc(String(s.name).split(' ').slice(0,2).join(' '))} ✕</button>`).join(''):'<span class="muted" style="font-size:.8rem">لم تختر أحدًا بعد — حدّد الفائزين من القائمة</span>';
}
function bpToggle(id,on){ if(on) BP.picked.add(String(id)); else BP.picked.delete(String(id)); bpList(); bulkPointsSummary(); }
function bulkPointsSummary(){
  const n=parseInt((document.getElementById('bp-amount')||{}).value,10);
  const k=bpTargets().length, b=document.getElementById('bp-go'); if(!b) return;
  const ok=Number.isInteger(n) && n>=1 && n<=1000 && k>0;
  b.disabled=!ok; b.textContent=ok ? `🎁 إضافة ${n} نقطة لـ ${k===2?'طالبين':`${k} ${k===1?'طالب':k<=10?'طلاب':'طالبًا'}`}` : (k? 'أدخل من 1 إلى 1000 نقطة' : 'اختر الطلاب أولًا');
}
async function runBulkPoints(){
  const n=parseInt(document.getElementById('bp-amount').value,10);
  const list=bpTargets(); if(!list.length || !(n>=1 && n<=1000)) return;
  const reason=String(document.getElementById('bp-reason')?.value||'').trim(), note=String(document.getElementById('bp-note')?.value||'').trim(), announce=!!document.getElementById('bp-announce')?.checked;
  const api=getApi(), tok=getTok();
  const btn=document.getElementById('bp-go'), prog=document.getElementById('bp-progress'), bar=document.getElementById('bp-bar-i'), pt=document.getElementById('bp-progress-t');
  btn.disabled=true; document.querySelectorAll('.bp2 input,.bp2 select,.bp2 textarea,.bp2 .bp2-seg button,.bp2 .bp2-chip').forEach(x=>x.disabled=true); prog.classList.remove('hide');
  let ok=0; const failed=[];
  if(!api || !tok){                                   // وضع محلي فقط (بلا خادم)
    list.forEach(s=>{ s.points=Number(s.points||0)+n; }); ok=list.length;
  } else {
    for(let i=0;i<list.length;i+=20){
      const chunk=list.slice(i,i+20);
      pt.textContent=`جارٍ الإضافة… ${Math.min(i+chunk.length,list.length)} من ${list.length}`; bar.style.width=Math.round(i/list.length*100)+'%';
      try{
        const r=await fetch(api.replace(/\/+$/,'')+'/adjust-bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:tok,delta:n,reason,note,announce,students:chunk.map(s=>({sid:s.id,name:s.name}))})});
        const j=await r.json().catch(()=>({}));
        if(!r.ok || !j.ok) throw new Error(j.error||('http_'+r.status));
        for(const d of j.done||[]){ const s=chunk.find(x=>String(x.id)===String(d.sid)) || chunk.find(x=>x.name===d.name); if(s){ s.points=Number(d.pts); ok++; } }
        for(const f of j.failed||[]){ const s=chunk.find(x=>String(x.id)===String(f.sid)) || chunk.find(x=>x.name===f.name); failed.push(s ? s.name : (f.name||f.sid)); }
      }catch(e){ chunk.forEach(s=>failed.push(s.name)); }
    }
  }
  bar.style.width='100%';
  save(K.st,STUDENTS); try{ renderStudentsCenter(); }catch(e){} updateMeta();
  pt.innerHTML = failed.length ? `✓ أُضيفت لـ ${ok} · <b style="color:#B42318">تعذّر ${failed.length}: ${esc(failed.slice(0,6).join('، '))}${failed.length>6?' …':''}</b> — أعد المحاولة لهم من ملف كل طالب` : `✓ أُضيفت ${n} نقطة لـ ${ok} ${ok===1?'طالب':'طالبًا'}`;
  btn.textContent='تم'; btn.disabled=false; btn.onclick=closeModal;
  toast(failed.length ? `أُضيفت لـ ${ok} وتعذّر ${failed.length}` : `🎁 أُضيفت ${n} نقطة لـ ${ok} ${ok===1?'طالب':'طالبًا'}`, failed.length ? 'bad' : 'good');
}
const LV_SKINS = [['classic', '🎯 كلاسيكي', 1], ['shapes', '🎨 تحدي الأشكال (مثل كاهوت — مع شاشة العرض)', 1], ['boss', '👹 وحش الزعيم (تعاوني اونلاين من البيت)', 1], ['balloons', '🎈 صيد البالونات', 1], ['rocket', '🚀 سباق الصواريخ', 1], ['jumper', '🍄 قفزة البطل (أركيد)', 1], ['invaders', '👾 غزاة الفضاء (أركيد)', 1], ['claw', '🕹️ آلة المخلب (أركيد)', 1]];
const lvNow = () => Date.now() + LVT.off;
function lvLeft(ms){ const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h} س ${m} د` : m ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s} ث`; }
/* 👥 حالة الحد الأدنى في المراقبة: كم ينقص، وماذا سيحدث عند الإغلاق، أو لماذا أُلغيت */
function lvMinNote(g, ph, n){
  if(!g.minPlayers) return '';
  if(ph.status === 'CANCELLED' && g.cancelReason === 'min') return `<div class="lv-min bad">🚫 أُلغيت تلقائيًا لعدم اكتمال العدد (الحد الأدنى ${g.minPlayers})${g.fee ? ' — أُعيدت الرسوم للطلاب' : ''}</div>`;
  if(!['SCHEDULED','REGISTRATION','WAITING'].includes(ph.status)) return '';
  const short = g.minPlayers - n, ext = g.extends ? ` · مُدّد التسجيل ${g.extends === 1 ? 'مرة' : g.extends + ' مرات'}` : '';
  if(short <= 0) return `<div class="lv-min ok">✅ اكتمل الحد الأدنى (${n} من ${g.minPlayers})${ext}</div>`;
  const left = (g.maxExtends ?? 2) - (g.extends || 0);
  const what = g.minAction === 'cancel' || left <= 0 ? '🚫 ستُلغى وتُعاد الرسوم' : `⏳ سيُمدّد التسجيل 5 دقائق (متبقٍ ${left} ${left === 1 ? 'تمديد' : 'تمديدات'})`;
  return `<div class="lv-min warn">👥 ينقص ${short === 1 ? 'طالب واحد' : short === 2 ? 'طالبان' : short + ' طلاب'} للحد الأدنى (${n} من ${g.minPlayers})${ext} — إن لم يكتمل عند إغلاق التسجيل: ${what}</div>`;
}
function lvDailyActs(){ return HW.filter(h => h && (h.published || h.sid) && !['nafs', 'style'].includes(h.kind || 'normal') && !(h.nafs && h.nafs.length))
  .map(h => ({ h, id: lvActId(h), n: lvBankOf(h).filter(q => !/<img|\[صورة|!\[/.test(q.q)).length })).filter(x => x.id && x.n); }
function lvdTimeRow(t){ return `<span class="lvd-t"><input class="inp" type="time" value="${esc(t)}"><button type="button" class="btn ghost sm" title="حذف" onclick="lvdTimeDel(this)">✕</button></span>`; }
function lvdTimeAdd(){ const box = document.getElementById('lvd-times'); if(!box) return; const n = box.querySelectorAll('.lvd-t').length;
  if(n >= 4){ toast('أقصى حد 4 مواعيد في اليوم', 'bad'); return; }
  const last = [...box.querySelectorAll('input')].map(i => i.value).filter(Boolean).sort().pop() || '16:00';
  const [h, m] = last.split(':').map(Number), nx = `${String(Math.min(23, h + 4)).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
  box.insertAdjacentHTML('beforeend', lvdTimeRow(nx)); }
function lvdTimeDel(b){ const box = document.getElementById('lvd-times'); if(box && box.querySelectorAll('.lvd-t').length > 1) b.closest('.lvd-t').remove(); else toast('يلزم موعد واحد على الأقل', 'bad'); }
function lvDailyOpen(){
  const D = LVD || {}, P = lvPrefs(), pv = (id, d) => (P && P.v && P.v[id] !== undefined ? P.v[id] : d);
  const known = new Set(classes()), cl = (D.classes || []).filter(c => known.has(c));
  const days = D.days && D.days.length ? D.days : [0, 1, 2, 3, 4], { bank, acts } = lvDailyBank();
  openModal(`<h2>🔁 المسابقة اليومية التلقائية</h2>
    <p class="muted" style="margin:.2rem 0 .8rem">ينشئها الخادم بنفسه في الموعد كل يوم تختاره — حتى ولوحتك مغلقة. الأسئلة عشوائية من <b>كل أنشطتك المنشورة</b> (اختيار من متعدد وصح/خطأ، بلا صور ولا نافس)، ولا يتكرر سؤال خلال 7 أيام ما دام في البنك غيره.</p>
    <label class="lvd-sw"><input type="checkbox" id="lvd-on" ${D.on ? 'checked' : ''}> <b>تشغيل المسابقة اليومية</b></label>
    <div class="field"><label>الأيام</label><div class="lvd-days">${LV_DOW.map((d, i) => `<label><input type="checkbox" value="${i}" ${days.includes(i) ? 'checked' : ''}> ${d}</label>`).join('')}</div></div>
    <div class="field"><label>⏰ مواعيد البداية في اليوم <small class="muted">(حتى 4 — مسابقة مستقلة لكل موعد، بأسئلة مختلفة)</small></label>
      <div class="lvd-times" id="lvd-times">${lvDailyTimes(D).map(lvdTimeRow).join('')}</div>
      <button type="button" class="btn ghost sm" style="margin-top:.4rem" onclick="lvdTimeAdd()">＋ موعد آخر</button>
      <label class="lv-shuf" style="margin:.5rem 0 0"><input type="checkbox" id="lvd-once" ${D.onePerDay === false ? '' : 'checked'}> 👤 الطالب يلعب موعدًا واحدًا فقط في اليوم <small class="muted">(يختار الأنسب له — لا تتضاعف نقاطه وجوائزه)</small></label></div>
    <div class="field"><label>اسم المسابقة</label><input class="inp" id="lvd-title" value="${esc(D.title || 'التحدي اليومي 🔥')}" maxlength="80"></div>
    <div class="field"><label>الفصول</label>${hwClsPickerHTML({ clsList: cl.length > 1 ? cl : [], cls: cl.length === 1 ? cl[0] : '' }, 'lvd-cls')}</div>
    <div class="lv-grid">
      <div class="field"><label>يُفتح التسجيل قبلها (دقيقة)</label><input class="inp" type="number" id="lvd-regopen" value="${D.regOpenMin || 30}" min="1" max="600"></div>
      <div class="field"><label>عدد الأسئلة</label><input class="inp" type="number" id="lvd-n" value="${D.n || 10}" min="1" max="50"></div>
      <div class="field"><label>ثوانٍ لكل سؤال</label><input class="inp" type="number" id="lvd-qsec" value="${D.qSec || pv('lv-qsec', 20)}" min="5" max="120"></div>
      <div class="field"><label>رسوم الدخول (نقطة)</label><input class="inp" type="number" id="lvd-fee" value="${D.fee ?? pv('lv-fee', 0)}" min="0" max="10000"></div>
      <div class="field"><label>👥 الحد الأدنى للطلاب</label><input class="inp" type="number" id="lvd-min" value="${D.minPlayers ?? pv('lv-min', 3)}" min="0" max="50"></div>
      <div class="field"><label>شكل المسابقة</label><select class="inp" id="lvd-skin">${LV_SKINS.map(([k, l, on]) => `<option value="${k}" ${on ? '' : 'disabled'} ${(D.skin || pv('lv-skin', 'classic')) === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>🎁 الجوائز</label><div class="lv-prizes">
      ${[0, 1, 2].map(i => `<span>${['🥇','🥈','🥉'][i]} <input class="inp" type="number" id="lvd-p${i + 1}" value="${(D.prizes || [])[i] ?? pv('lv-p' + (i + 1), [150, 100, 50][i])}" min="0" max="10000"></span>`).join('')}</div></div>
    <label class="lv-shuf" style="margin:.1rem 0 .6rem"><input type="checkbox" id="lvd-notify" ${D.notify === false ? '' : 'checked'}> 🔔 إشعار الطلاب تلقائيًا (فتح التسجيل وقبل البداية)</label>
    <div class="field"><label>📚 مصدر الأسئلة</label>
      <div class="lvd-src">
        <label class="${D.src === 'pick' ? '' : 'on'}"><input type="radio" name="lvd-src" value="auto" ${D.src === 'pick' ? '' : 'checked'} onchange="lvdSrc()"><b>⚡ تلقائي</b><small>من كل أنشطتك المنشورة، ويضاف كل نشاط جديد تنشره</small></label>
        <label class="${D.src === 'pick' ? 'on' : ''}"><input type="radio" name="lvd-src" value="pick" ${D.src === 'pick' ? 'checked' : ''} onchange="lvdSrc()"><b>🎯 أنشطة أحددها</b><small>مثل دروس الوحدة الحالية فقط — النشاط الجديد لا يُضاف إلا إذا حددته</small></label>
      </div>
      <div id="lvd-picks" class="lvd-picks" style="${D.src === 'pick' ? '' : 'display:none'}">
        <div class="lvd-picks-bar"><input class="inp" id="lvd-pq" placeholder="🔎 ابحث عن نشاط…" oninput="lvdPickFilter()"><button type="button" class="btn ghost sm" onclick="lvdPickAll(true)">تحديد الكل</button><button type="button" class="btn ghost sm" onclick="lvdPickAll(false)">إلغاء</button></div>
        <div class="lvd-picks-list">${lvDailyActs().map(x => `<label data-t="${esc(x.h.title || '')}"><input type="checkbox" value="${esc(x.id)}" ${(D.srcIds || []).map(String).includes(x.id) ? 'checked' : ''} onchange="lvdBankNote()"><span>${esc(x.h.title || 'نشاط')}</span><small>${x.n} ${x.n > 10 ? 'سؤالًا' : 'أسئلة'}</small></label>`).join('') || '<div class="muted">لا أنشطة فيها أسئلة اختيار من متعدد أو صح/خطأ.</div>'}</div></div></div>
    <div class="lvd-bank" id="lvd-bank">📚 بنك الأسئلة الآن: <b>${bank.length}</b> سؤالًا من <b>${acts}</b> ${acts > 10 ? 'نشاطًا' : 'أنشطة'} — يتحدّث تلقائيًا كلما نشرت نشاطًا جديدًا وفتحت هذه الصفحة.</div>
    ${D.lastId ? `<p class="muted" style="font-size:.8rem;margin:.4rem 0 0">آخر مسابقة يومية أُنشئت ${esc(D.last || '')}.</p>` : ''}
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn tick" id="lvd-go" onclick="lvDailySave()">حفظ</button></div>`);
  lvdBankNote();
}
function lvdSrcRead(){ const src = (document.querySelector('input[name="lvd-src"]:checked') || {}).value === 'pick' ? 'pick' : 'auto';
  return { src, srcIds: [...document.querySelectorAll('#lvd-picks input[type=checkbox]:checked')].map(x => x.value) }; }
function lvdSrc(){ const { src } = lvdSrcRead(); const p = document.getElementById('lvd-picks'); if(p) p.style.display = src === 'pick' ? '' : 'none';
  document.querySelectorAll('.lvd-src label').forEach(l => l.classList.toggle('on', l.querySelector('input').checked)); lvdBankNote(); }
function lvdBankNote(){ const el = document.getElementById('lvd-bank'); if(!el) return; const S = lvdSrcRead(), { bank, acts } = lvDailyBank(S);
  el.innerHTML = S.src === 'pick' ? `🎯 بنك الأسئلة من الأنشطة المحددة: <b>${bank.length}</b> سؤالًا من <b>${acts}</b> ${acts > 10 ? 'نشاطًا' : 'أنشطة'}${bank.length && bank.length < 20 ? ' — <b>قليل</b>: ستتكرر الأسئلة كثيرًا، حدّد أنشطة أكثر' : ''}.`
    : `📚 بنك الأسئلة الآن: <b>${bank.length}</b> سؤالًا من <b>${acts}</b> ${acts > 10 ? 'نشاطًا' : 'أنشطة'} — يتحدّث تلقائيًا كلما نشرت نشاطًا جديدًا وفتحت هذه الصفحة.`; }
function lvdPickFilter(){ const q = String((document.getElementById('lvd-pq') || {}).value || '').trim(); document.querySelectorAll('.lvd-picks-list label').forEach(l => { l.style.display = !q || (l.dataset.t || '').includes(q) ? '' : 'none'; }); }
function lvdPickAll(on){ document.querySelectorAll('.lvd-picks-list label').forEach(l => { if(l.style.display !== 'none') l.querySelector('input').checked = on; }); lvdBankNote(); }
async function lvDailySave(){
  const v = id => (document.getElementById(id) || {}).value, num = (id, d) => { const n = parseInt(v(id), 10); return Number.isFinite(n) ? n : d; };
  const days = [...document.querySelectorAll('.lvd-days input:checked')].map(x => +x.value), on = !!document.getElementById('lvd-on')?.checked;
  const SRC = lvdSrcRead(), { bank, acts } = lvDailyBank(SRC);
  if(on && SRC.src === 'pick' && !SRC.srcIds.length){ toast('حدّد نشاطًا واحدًا على الأقل، أو اختر «تلقائي»', 'bad'); return; }
  if(on && !days.length){ toast('اختر يومًا واحدًا على الأقل', 'bad'); return; }
  const tms = [...new Set([...document.querySelectorAll('#lvd-times input')].map(i => i.value).filter(Boolean))].sort();
  if(on && !tms.length){ toast('حدّد موعدًا واحدًا على الأقل', 'bad'); return; }
  // تسجيل الموعد يُفتح قبله بمدة؛ إن كانت أطول من الفارق بين موعدين تتداخل فترتا التسجيل (مسموح، لكن نبّه)
  const gap = tms.slice(1).map((t, i) => { const a = tms[i].split(':').map(Number), b = t.split(':').map(Number); return (b[0] * 60 + b[1]) - (a[0] * 60 + a[1]); });
  if(on && gap.some(g => g < 30)){ toast('اجعل بين كل موعدين نصف ساعة على الأقل', 'bad'); return; }
  if(on && !bank.length){ toast('لا توجد أسئلة اختيار من متعدد أو صح/خطأ في أنشطتك المنشورة', 'bad'); return; }
  const { clsList, cls } = hwClsPickerRead('lvd-cls');
  const cfg = { on, days, title: String(v('lvd-title') || '').trim() || 'التحدي اليومي 🔥', times: [...new Set([...document.querySelectorAll('#lvd-times input')].map(i => i.value).filter(Boolean))].sort(), onePerDay: !!document.getElementById('lvd-once')?.checked, regOpenMin: num('lvd-regopen', 30), regCloseMin: 1,
    n: num('lvd-n', 10), qSec: num('lvd-qsec', 20), revealSec: 4, fee: num('lvd-fee', 0), prizes: [num('lvd-p1', 0), num('lvd-p2', 0), num('lvd-p3', 0)],
    minPlayers: num('lvd-min', 0), minAction: 'extend', skin: v('lvd-skin') || 'classic', notify: !!document.getElementById('lvd-notify')?.checked,
    classes: clsList.length ? clsList : (cls ? [cls] : []), src: SRC.src, srcIds: SRC.srcIds };
  const go = document.getElementById('lvd-go'); if(go){ go.disabled = true; go.textContent = 'جارٍ الحفظ…'; }
  try{ const j = await lvPost('/live/daily', { op: 'set', cfg, bank, acts }); LVD = j.daily || {}; try{ localStorage.setItem('lvd_sig', lvDailySig(bank)); }catch(e){}
    closeModal(); lvDailyBar(); toast(on ? `🔁 المسابقة اليومية مفعّلة${LVD.next ? ' — القادمة ' + lvWhen(LVD.next) : ''}` : 'أُوقفت المسابقة اليومية', 'good');
  }catch(e){ if(go){ go.disabled = false; go.textContent = 'حفظ'; } toast('تعذّر الحفظ: ' + (LV_ERR[e.message] || (/not_found|404|auth/.test(e.message) ? 'انشر worker.js الأخير' : e.message)), 'bad'); }
}
function lvDefaultStart(){
  const d = new Date(lvNow() + 30 * 60000); d.setSeconds(0, 0); const m = d.getMinutes(); d.setMinutes(m <= 30 ? 30 : 60);
  const p = n => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
}
/* 💾 آخر إعدادات مسابقة: تُحفظ عند كل إنشاء ناجح وتُعبّأ في التالية (عدا الموعد ومصدر الأسئلة) */
const LV_PREFS_KEY = 'lv_create_prefs_v1';
const LV_PREF_FIELDS = ['lv-title','lv-regopen','lv-regclose','lv-n','lv-qsec','lv-fee','lv-max','lv-min','lv-minact','lv-p1','lv-p2','lv-p3','lv-smax','lv-smin','lv-rsec','lv-skin'];
const LV_PREF_CHECKS = ['lv-notify','lv-shuffle'];
function lvPrefs(){ try{ return JSON.parse(localStorage.getItem(LV_PREFS_KEY) || 'null'); }catch(e){ return null; } }
function lvSavePrefs(){
  const o = { v: {}, c: {}, classes: [] };
  LV_PREF_FIELDS.forEach(id => { const e = document.getElementById(id); if(e) o.v[id] = e.value; });
  LV_PREF_CHECKS.forEach(id => { const e = document.getElementById(id); if(e) o.c[id] = !!e.checked; });
  const { cls, clsList } = hwClsPickerRead('lv-cls'); o.classes = clsList.length ? clsList : (cls ? [cls] : []);
  try{ localStorage.setItem(LV_PREFS_KEY, JSON.stringify(o)); }catch(e){}
}
function lvApplyPrefs(P){
  if(!P) return;
  for(const [id, v] of Object.entries(P.v || {})){
    const e = document.getElementById(id); if(!e || v === undefined || v === null) continue;
    if(e.tagName === 'SELECT'){ const o = [...e.options].find(x => x.value === v && !x.disabled); if(o) e.value = v; } else e.value = v;
  }
  for(const [id, v] of Object.entries(P.c || {})){ const e = document.getElementById(id); if(e) e.checked = !!v; }
}
function lvResetPrefs(){ try{ localStorage.removeItem(LV_PREFS_KEY); }catch(e){} openLiveCreate(); toast('↺ عادت القيم الافتراضية', 'good'); }
function openLiveCreate(){
  const acts = HW.map(h => ({ h, n: lvBankOf(h).length })).filter(x => x.n > 0);
  const st = lvDefaultStart(), PREFS = lvPrefs();
  const known = new Set(classes()), savedCls = ((PREFS && PREFS.classes) || []).filter(c => known.has(c));
  openModal(`<h2>🎮 مسابقة مباشرة جديدة</h2>
    <p class="muted" style="margin:.2rem 0 .8rem">${PREFS ? `💾 بإعداداتك من آخر مسابقة — <a href="#" onclick="event.preventDefault();lvResetPrefs()">↺ القيم الافتراضية</a>` : 'قالب «مراجعة ما قبل الاختبار» — كل القيم قابلة للتعديل، وتُحفظ لمرتك القادمة.'}</p>
    <div class="field"><label>اسم المسابقة</label><input class="inp" id="lv-title" value="تحدي العلوم 🔥" maxlength="80"></div>
    <div class="field"><label>الفصول</label>${hwClsPickerHTML({ clsList: savedCls.length > 1 ? savedCls : [], cls: savedCls.length === 1 ? savedCls[0] : '' }, 'lv-cls')}</div>
    <div class="lv-grid">
      <div class="field"><label>اليوم</label><input class="inp" type="date" id="lv-date" value="${st.date}"></div>
      <div class="field"><label>وقت البداية</label><input class="inp" type="time" id="lv-time" value="${st.time}"></div>
      <div class="field"><label>يُفتح التسجيل قبلها (دقيقة)</label><input class="inp" type="number" id="lv-regopen" value="15" min="1" max="1440"></div>
      <div class="field"><label>يُغلق التسجيل قبلها (دقيقة)</label><input class="inp" type="number" id="lv-regclose" value="1" min="0" max="60"></div>
      <div class="field"><label>عدد الأسئلة</label><input class="inp" type="number" id="lv-n" value="10" min="1" max="50" oninput="lvSrcSummary()"></div>
      <div class="field"><label>ثوانٍ لكل سؤال</label><input class="inp" type="number" id="lv-qsec" value="20" min="5" max="120"></div>
      <div class="field"><label>رسوم الدخول (نقطة)</label><input class="inp" type="number" id="lv-fee" value="50" min="0" max="10000"></div>
      <div class="field"><label>الحد الأقصى للاعبين (0 = بلا حد)</label><input class="inp" type="number" id="lv-max" value="0" min="0" max="500"></div>
      <div class="field"><label>👥 الحد الأدنى للطلاب (0 = بلا حد)</label><input class="inp" type="number" id="lv-min" value="3" min="0" max="50"></div>
      <div class="field"><label>إن لم يكتمل العدد عند إغلاق التسجيل</label><select class="inp" id="lv-minact">
        <option value="extend">⏳ مدّد التسجيل ثم ألغِ</option>
        <option value="cancel">🚫 ألغِ وأرجع الرسوم</option></select></div>
    </div>
    <p class="muted" style="font-size:.76rem;margin:-.3rem 0 .7rem">«مدّد التسجيل»: يُمدّد 5 دقائق حتى مرتين ويُنبَّه الطلاب، ثم تُلغى إن لم يكتمل العدد. عند الإلغاء تُعاد رسوم الدخول تلقائيًا.</p>
    <div class="field"><label>🎁 الجوائز من رصيد المتجر</label><div class="lv-prizes">
      <span>🥇 <input class="inp" type="number" id="lv-p1" value="150" min="0" max="10000"></span><span>🥈 <input class="inp" type="number" id="lv-p2" value="100" min="0" max="10000"></span><span>🥉 <input class="inp" type="number" id="lv-p3" value="50" min="0" max="10000"></span></div></div>
    <label class="lv-shuf" style="margin:.1rem 0 .7rem"><input type="checkbox" id="lv-notify" checked> 🔔 إشعار الطلاب تلقائيًا: عند فتح التسجيل، وقبل إغلاقه بـ5 دقائق لمن لم يسجّل، وقبل البداية بدقيقة للمسجّلين</label>
    <details class="lv-adv"><summary>إعدادات متقدمة</summary><div class="lv-grid">
      <div class="field"><label>نقاط الإجابة الأسرع</label><input class="inp" type="number" id="lv-smax" value="100" min="1" max="1000"></div>
      <div class="field"><label>نقاط الإجابة الأبطأ</label><input class="inp" type="number" id="lv-smin" value="70" min="0" max="1000"></div>
      <div class="field"><label>ثوانٍ لعرض الإجابة</label><input class="inp" type="number" id="lv-rsec" value="4" min="2" max="15"></div>
      <div class="field"><label>شكل المسابقة عند الطالب</label><select class="inp" id="lv-skin">${LV_SKINS.map(([k, l, on]) => `<option value="${k}" ${on ? '' : 'disabled'}>${l}</option>`).join('')}</select></div>
    </div></details>
    <div class="field"><label>📚 مصدر الأسئلة (اختيار من متعدد وصح/خطأ من أنشطتك)</label>
      ${acts.length ? `<div class="lv-src">${acts.map(x => `<label><input type="checkbox" value="${esc(x.h.id)}" onchange="lvSrcSummary()"> ${esc(x.h.title || 'نشاط')} <small>(${x.n})</small></label>`).join('')}</div>
        <label class="lv-shuf"><input type="checkbox" id="lv-shuffle" checked> 🔀 اختيار عشوائي وخلط الترتيب</label>
        <div class="muted" id="lv-src-sum" style="font-size:.82rem;margin-top:.3rem"></div>`
        : '<p class="muted">لا توجد أنشطة فيها أسئلة اختيار من متعدد أو صح/خطأ.</p>'}</div>
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn tick" id="lv-go" onclick="lvCreate()">إنشاء المسابقة</button></div>`);
  lvApplyPrefs(PREFS);
  lvSrcSummary();
}
function lvPicked(){
  const ids = [...document.querySelectorAll('.lv-src input:checked')].map(c => c.value), seen = new Set(), bank = [];
  for(const id of ids){ for(const q of lvBankOf(HW.find(h => String(h.id) === id))){ const k = q.q.replace(/\s+/g, ' '); if(!seen.has(k)){ seen.add(k); bank.push(q); } } }
  return { ids, bank };
}
function lvSrcSummary(){
  const el = document.getElementById('lv-src-sum'), go = document.getElementById('lv-go'); if(!el) return;
  const { bank } = lvPicked(), n = parseInt(document.getElementById('lv-n').value, 10) || 0;
  el.textContent = bank.length ? `مختار: ${bank.length} سؤالًا — ${bank.length >= n ? `ستُستخدم ${n}` : `ستُستخدم ${bank.length} فقط (أقل من العدد المطلوب)`}` : 'اختر نشاطًا واحدًا على الأقل';
  if(go) go.disabled = !bank.length;
}
async function lvCreate(){
  const v = id => (document.getElementById(id) || {}).value, num = (id, d) => { const n = parseInt(v(id), 10); return Number.isFinite(n) ? n : d; };
  const { ids, bank } = lvPicked(); if(!bank.length){ toast('اختر مصدر الأسئلة', 'bad'); return; }
  const n = Math.max(1, Math.min(50, num('lv-n', 10)));
  let qs = bank.slice();
  if(document.getElementById('lv-shuffle')?.checked){ for(let i = qs.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [qs[i], qs[j]] = [qs[j], qs[i]]; } }
  qs = qs.slice(0, n);
  const startAt = new Date(`${v('lv-date')}T${v('lv-time')}`).getTime();
  if(!(startAt > lvNow() + 60000)){ toast('وقت البداية يجب أن يكون بعد دقيقة على الأقل', 'bad'); return; }
  const regOpen = Math.max(lvNow(), startAt - num('lv-regopen', 15) * 60000), regClose = Math.max(regOpen, startAt - num('lv-regclose', 1) * 60000);
  const { clsList, cls } = hwClsPickerRead('lv-cls');
  const payload = { title: String(v('lv-title') || 'مسابقة').trim(), classes: clsList.length ? clsList : (cls ? [cls] : []), questions: qs,
    fee: num('lv-fee', 0), prizes: [num('lv-p1', 0), num('lv-p2', 0), num('lv-p3', 0)], maxPlayers: num('lv-max', 0),
    minPlayers: Math.max(0, num('lv-min', 0)), minAction: v('lv-minact') === 'cancel' ? 'cancel' : 'extend',
    qSec: num('lv-qsec', 20), revealSec: num('lv-rsec', 4), scoring: { max: num('lv-smax', 100), min: num('lv-smin', 70) },
    regOpen, regClose, startAt, skin: v('lv-skin') || 'classic', notify: !!document.getElementById('lv-notify')?.checked, source: ids.map(id => (HW.find(h => String(h.id) === id) || {}).title).filter(Boolean).join('، ').slice(0, 120) };
  const go = document.getElementById('lv-go'); go.disabled = true; go.textContent = 'جارٍ الإنشاء…';
  try{
    const j = await lvPost('/live/create', payload);
    lvSavePrefs();                                        // للمسابقة القادمة
    toast(`🎮 أُنشئت «${payload.title}» — تبدأ ${lvWhen(startAt)}`, 'good');
    closeModal(); await liveTLoad(); lvMonitor(j.id);
  }catch(e){ go.disabled = false; go.textContent = 'إنشاء المسابقة'; toast('تعذّر الإنشاء: ' + (LV_ERR[e.message] || e.message), 'bad'); }
}
/* 🔔 حالة إشعارات المسابقة: ما أُرسل ولمن، أو سبب عدم الإرسال — بدل التخمين */
const LV_NT_KIND = { open: '🔴 فتح التسجيل', closing: '⏳ قبل إغلاق التسجيل', start: '🎮 قبل البداية', manual: '📣 تذكير يدوي' };
function lvNotifyHTML(j){
  const N = j.notify, g = j.game, ph = j.phase || {};
  let rows = [], warn = '';
  if(!N) warn = '⚠️ الخادم المنشور لا يعرف إشعارات المسابقات — ارفع ملف worker.js الأخير';
  else if(!N.enabled) warn = '🔕 الإشعارات مطفأة لهذه المسابقة (من خيار الإنشاء)';
  else if(!N.push) warn = '⚠️ الإشعارات غير مُعدّة في الخادم (مفاتيح VAPID)';
  else {
    rows = (N.log || []).map(x => {
      const got = x.delivered ?? x.devices, failed = x.delivered !== undefined ? x.devices - x.delivered : 0;
      return `<li><b>${LV_NT_KIND[x.kind] || x.kind}</b> <span>${lvTime(x.at)}</span> · ${x.devices
        ? `وصل <b>${got}</b> ${got === 1 ? 'جهاز' : 'أجهزة'} من ${x.targets} ${x.targets === 1 ? 'طالب' : 'طالبًا'}${failed > 0 ? ` <em>· رُفض ${failed}</em>` : ''}`
        : `<em>لم يصل لأحد — لم يفعّل أيٌّ من ${x.targets} ${x.targets === 1 ? 'طالب' : 'طالبًا'} التنبيهات</em>`}</li>`; });
    const has = k => (N.log || []).some(x => x.kind === k);
    if(ph.status === 'SCHEDULED') rows.push(`<li class="muted">⏳ يُرسل «فتح التسجيل» تلقائيًا عند ${lvTime(g.regOpen)}</li>`);
    else if(ph.status === 'REGISTRATION' && !has('open')) rows.push('<li class="muted">⏳ يُرسل «فتح التسجيل» خلال دقيقة (مع مؤقت الخادم)</li>');
  }
  const issue = !!warn || (N && (N.log || []).some(x => !x.devices || (x.delivered !== undefined && x.delivered < x.devices)));
  return `<details class="lv-pl lv-nt" ${issue ? 'open' : ''}><summary>🔔 الإشعارات${N && N.log && N.log.length ? ` (${N.log.length})` : ''}${issue ? ' ⚠️' : ''}</summary>
    ${warn ? `<p class="lv-nt-warn">${warn}</p>` : `<ul>${rows.join('') || '<li class="muted">لا شيء بعد.</li>'}</ul>`}</details>`;
}
/* 📺 شاشة العرض (البروجكتر) — تُفتح من مراقبة أي مسابقة. السؤال والعدّاد ونجوم الإجابات الواصلة،
   ثم التوزيع والإجابة الصحيحة والمتصدرون، ثم منصة التتويج. الإجابة الصحيحة لا تظهر قبل انتهاء السؤال
   (الطلاب ينظرون للشاشة)، والنجوم بلون واحد (لا تكشف ما اختاره أحد). */
const LVH = { id: null, timer: 0, tick: 0, seen: new Set(), lastAns: 0, off: 0, key: '' };
const LVH_SH = [['▲', '#7B2CBF'], ['★', '#0FA3B1'], ['●', '#F77F00'], ['◆', '#E5386D'], ['⬟', '#2E6BB8'], ['✚', '#2F9E3A']];
const lvhNow = () => Date.now() + LVH.off;
function lvHostOpen(id){
  LVH.id = id; LVH.seen = new Set(); LVH.lastAns = 0; LVH.key = '';
  let el = document.getElementById('lv-host'); if(!el){ el = document.createElement('div'); el.id = 'lv-host'; document.body.appendChild(el); }
  el.innerHTML = `<div class="lvh-bar"><button type="button" onclick="lvHostFull()" title="ملء الشاشة">⛶</button><button type="button" onclick="lvHostClose()" title="إغلاق">✕</button></div><div class="lvh-in" id="lvh-in"><p class="lvh-wait">جارٍ الاتصال…</p></div><div class="lvh-fx" id="lvh-fx"></div>`;
  el.classList.add('on'); document.body.classList.add('lvh-open'); lvHostTick();
  clearInterval(LVH.tick); LVH.tick = setInterval(() => { document.querySelectorAll('#lv-host [data-to]').forEach(e => { const s = Math.max(0, Math.ceil((Number(e.dataset.to) - lvhNow()) / 1000)); const m = Math.floor(s / 60); e.textContent = m ? `${m}:${String(s % 60).padStart(2, '0')}` : s; }); }, 250);
}
function lvHostFull(){ const el = document.getElementById('lv-host'); try{ (el.requestFullscreen || el.webkitRequestFullscreen).call(el); }catch(e){} }
function lvHostClose(){ LVH.id = null; clearTimeout(LVH.timer); clearInterval(LVH.tick); const el = document.getElementById('lv-host'); if(el) el.classList.remove('on'); document.body.classList.remove('lvh-open'); try{ if(document.fullscreenElement) document.exitFullscreen(); }catch(e){} }
async function lvHostTick(){
  clearTimeout(LVH.timer); if(!LVH.id) return;
  let j; try{ const t0 = Date.now(); j = await lvPost('/live/monitor', { game: LVH.id }); LVH.off = j.now + (Date.now() - t0) / 2 - Date.now(); }
  catch(e){ LVH.timer = setTimeout(lvHostTick, 2000); return; }
  if(!LVH.id) return;
  lvHostRender(j);
  const st = j.phase.status; if(st !== 'FINISHED' && st !== 'CANCELLED') LVH.timer = setTimeout(lvHostTick, st === 'LIVE' ? 1000 : 2000);
}
function lvhStars(k){ const fx = document.getElementById('lvh-fx'); if(!fx) return; for(let i = 0; i < Math.min(k, 12); i++){ const s = document.createElement('i'); s.textContent = '⭐';
  s.style.left = (8 + Math.random() * 84) + '%'; s.style.animationDelay = (i * 0.08) + 's'; fx.appendChild(s); setTimeout(() => s.remove(), 1800); } }
function lvhConfetti(){ const fx = document.getElementById('lvh-fx'); if(!fx) return; const cols = ['#FFD23F', '#7B2CBF', '#0FA3B1', '#F77F00', '#E5386D', '#7CE85A'];
  for(let i = 0; i < 90; i++){ const c = document.createElement('b'); c.style.left = Math.random() * 100 + '%'; c.style.background = cols[i % cols.length]; c.style.animationDelay = (Math.random() * 1.5) + 's'; c.style.animationDuration = (2.4 + Math.random() * 1.6) + 's'; fx.appendChild(c); setTimeout(() => c.remove(), 5000); } }
function lvHostRender(j){
  const box = document.getElementById('lvh-in'); if(!box) return;
  const g = j.game, ph = j.phase || {}, P = j.players || [], st = ph.status, cur = j.current;
  const key = st + '|' + (ph.q ?? '') + '|' + (ph.phase || '');
  const fresh = key !== LVH.key; LVH.key = key;
  if(st === 'SCHEDULED' || st === 'REGISTRATION' || st === 'WAITING'){
    const newOnes = P.filter(p => !LVH.seen.has(p.name)); newOnes.forEach(p => LVH.seen.add(p.name));
    if(fresh) box.innerHTML = `<div class="lvh-lobby"><div class="lvh-kick">🎮 مسابقة مباشرة</div><h1>${esc(g.title)}</h1>
      <p class="lvh-join">ادخلوا الآن من <b>بوابة الطالب</b> ← بطاقة المسابقة</p>
      <div class="lvh-count"><span>تبدأ بعد</span><b data-to="${g.startAt}"></b></div>
      <div class="lvh-pc"><b id="lvh-pc">${P.length}</b> لاعبًا</div><div class="lvh-names" id="lvh-names"></div></div>`;
    const pc = document.getElementById('lvh-pc'); if(pc) pc.textContent = P.length;
    const nm = document.getElementById('lvh-names'); if(nm) (fresh ? P : newOnes).forEach(p => { const s = document.createElement('span'); s.textContent = String(p.name).split(' ')[0]; nm.appendChild(s); });
    return;
  }
  if(st === 'LIVE' && cur){
    const n = g.n, tiles = (showA) => cur.o.map((o, i) => { const [sh, col] = LVH_SH[i % LVH_SH.length], ok = showA && i === cur.a;
      const cnt = showA && j.dist ? (j.dist[i] || 0) : 0, max = showA && j.dist ? Math.max(1, ...Object.values(j.dist)) : 1;
      return `<div class="lvh-opt${showA ? (ok ? ' ok' : ' no') : ''}" style="--c:${col}"><span class="sh">${sh}</span><b>${esc(o)}</b>${showA ? `<i class="bar" style="--h:${Math.round(cnt / max * 100)}%"></i><em>${cnt}</em>${ok ? '<span class="tick">✓</span>' : ''}` : ''}</div>`; }).join('');
    if(ph.phase === 'question'){
      if(fresh){ LVH.lastAns = j.answeredNow || 0;
        box.innerHTML = `<div class="lvh-top"><span>السؤال ${ph.q + 1} / ${n}</span><span class="lvh-timer" data-to="${ph.qEnd}"></span><span>✍️ <b id="lvh-ans">${j.answeredNow || 0}</b> / ${P.length}</span></div>
          <h1 class="lvh-q">${esc(cur.q)}</h1><div class="lvh-opts n${cur.o.length}">${tiles(false)}</div>`; }
      const a = j.answeredNow || 0, el = document.getElementById('lvh-ans'); if(el) el.textContent = a;
      if(a > LVH.lastAns){ lvhStars(a - LVH.lastAns); LVH.lastAns = a; }
    } else if(fresh){
      const top = (j.top || []), lead = Math.max(1, ...top.map(x => x.score));
      box.innerHTML = `<div class="lvh-top"><span>السؤال ${ph.q + 1} / ${n}</span><span>الإجابة الصحيحة</span><span>التالي بعد <b data-to="${ph.nextAt}"></b></span></div>
        <h1 class="lvh-q sm">${esc(cur.q)}</h1><div class="lvh-opts n${cur.o.length} rev">${tiles(true)}</div>
        ${top.length ? `<div class="lvh-top5">${top.map((x, i) => `<div><span>${i + 1}. ${esc(x.name)}</span><i style="--w:${Math.round(x.score / lead * 100)}%"></i><b>${x.score}</b></div>`).join('')}</div>` : ''}`;
    }
    return;
  }
  if(st === 'FINISHED' && fresh){
    const B = (j.results && j.results.board) || [];
    box.innerHTML = `<div class="lvh-final"><h1>🏁 ${esc(g.title)}</h1><div class="lvh-pod">${[1, 0, 2].map(i => B[i] ? `<div class="p${i + 1}"><span>${['🥇','🥈','🥉'][i]}</span><b>${esc(B[i].name)}</b><small>${B[i].score} نقطة</small><i></i></div>` : '<div></div>').join('')}</div>
      ${B.length > 3 ? `<div class="lvh-rest">${B.slice(3, 10).map(r => `<span>${r.rank}. ${esc(r.name)} · ${r.score}</span>`).join('')}</div>` : ''}</div>`;
    lvhConfetti(); return;
  }
  if(st === 'CANCELLED' && fresh) box.innerHTML = `<div class="lvh-lobby"><h1>🚫 أُلغيت المسابقة</h1></div>`;
}

/* ── المراقبة الحية ── */
function lvMonitor(id){ LVT.monId = id; openModal(`<div id="lv-mon"><h2>🎮 المسابقة</h2><p class="muted">جارٍ التحميل…</p></div>`); lvMonRefresh(); }
async function lvMonRefresh(){
  clearTimeout(LVT.monTimer);
  const box = document.getElementById('lv-mon'); if(!box || !LVT.monId) return;          // النافذة أُغلقت: تتوقف المتابعة
  let j;
  try{ const t0 = Date.now(); j = await lvPost('/live/monitor', { game: LVT.monId }); LVT.off = j.now + (Date.now() - t0) / 2 - Date.now(); }
  catch(e){ box.insertAdjacentHTML('beforeend', ''); LVT.monTimer = setTimeout(lvMonRefresh, 5000); return; }
  if(!document.getElementById('lv-mon')) return;
  const g = j.game, ph = j.phase || {}, now = lvNow(), P = j.players || [];
  const on = P.filter(p => p.online).length, off = P.length - on;
  const eligible = STUDENTS.filter(s => !(g.classes || []).length || g.classes.includes(String(s.cls || '')));
  const joinedNames = new Set(P.map(p => p.name)), notIn = eligible.filter(s => !joinedNames.has(s.name));
  const next = ph.status === 'REGISTRATION' ? ['يُغلق التسجيل بعد', g.regClose] : ph.status === 'WAITING' ? ['تبدأ بعد', g.startAt] : ph.status === 'SCHEDULED' ? ['يُفتح التسجيل بعد', g.regOpen]
    : ph.status === 'LIVE' ? [ph.phase === 'question' ? 'ينتهي السؤال بعد' : 'السؤال التالي بعد', ph.phase === 'question' ? ph.qEnd : ph.nextAt] : null;
  const canCancel = ['SCHEDULED', 'REGISTRATION', 'WAITING'].includes(ph.status);
  const cur = j.current;
  const openState = [...box.querySelectorAll('details')].map(d => d.open);        // لا تنطوي القوائم مع كل تحديث
  box.innerHTML = `<div class="lv-mon-h"><h2>🎮 ${esc(g.title)}</h2>${lvChip(ph.status)}</div>
    <p class="muted" style="margin:.1rem 0 .7rem">${lvWhen(g.startAt)} · ${g.n} ${g.n > 10 ? 'سؤالًا' : 'أسئلة'} · ${g.fee ? g.fee + ' نقطة' : 'مجانية'}${next ? ` · ${next[0]} <b>${lvLeft(next[1] - now)}</b>` : ''}</p>
    ${lvMinNote(g, ph, P.length)}
    <div class="lv-kpis">
      <div><b>${P.length}${g.maxPlayers ? '/' + g.maxPlayers : ''}</b><small>👥 المشاركون${g.minPlayers ? ` · الحد الأدنى ${g.minPlayers}` : ''}</small></div>
      <div><b>${j.paid}</b><small>💰 دفعوا</small></div>
      <div><b>${on}</b><small>🟢 متصل</small></div>
      <div><b>${off}</b><small>🟡 منقطع</small></div>
      <div><b>${notIn.length}</b><small>🚶 لم يدخلوا</small></div>
    </div>
    ${ph.status === 'LIVE' && cur ? `<div class="lv-cur"><div class="lv-cur-h"><b>السؤال ${ph.q + 1} / ${g.n}</b><span>✍️ أجاب ${j.answeredNow} من ${P.length}</span></div>
      <div class="lv-bar"><i style="width:${P.length ? Math.round(j.answeredNow / P.length * 100) : 0}%"></i></div>
      <p>${esc(cur.q)}</p><ol>${cur.o.map((o, i) => `<li class="${i === cur.a ? 'ok' : ''}">${esc(o)}${i === cur.a ? ' ✓' : ''}</li>`).join('')}</ol></div>` : ''}
    ${ph.status === 'FINISHED' && j.results ? `<div class="lv-res"><h3>🏁 النتائج</h3><ol>${j.results.board.map(r => `<li><span>${['🥇','🥈','🥉'][r.rank - 1] || r.rank + '.'} ${esc(r.name)} <small>${esc(r.cls || '')}</small></span><b>${r.score}</b>${r.prize ? `<em>🎁 ${r.prize}</em>` : ''}</li>`).join('')}</ol></div>` : ''}
    ${ph.status === 'CANCELLED' ? `<p class="lv-cancel-note">🚫 أُلغيت${j.refunded ? ` — أُعيدت الرسوم لـ ${j.refunded} ${j.refunded === 1 ? 'طالب' : 'طالبًا'}` : ''}${j.paid > j.refunded ? ` · <b>بقي ${j.paid - j.refunded} بلا استرداد</b> — اضغط «إكمال الاسترداد»` : ''}</p>` : ''}
    ${lvNotifyHTML(j)}
    <details class="lv-pl" ${P.length && P.length <= 40 ? 'open' : ''}><summary>👥 اللاعبون (${P.length})</summary><div>${P.map(p => `<span class="${p.online ? 'on' : ''}">${p.online ? '🟢' : '🟡'} ${esc(p.name)}${p.online ? '' : ` <small>منذ ${lvLeft(now - p.lastSeen)}</small>`}</span>`).join('') || '<p class="muted">لم يدخل أحد بعد.</p>'}</div></details>
    ${notIn.length && ph.status !== 'FINISHED' ? `<details class="lv-pl"><summary>🚶 لم يدخلوا (${notIn.length})</summary><div>${notIn.map(s => `<span>${esc(s.name)}</span>`).join('')}</div></details>` : ''}
    <div class="modal-foot">
      ${ph.status !== 'CANCELLED' ? `<button class="btn tick" onclick="lvHostOpen('${esc(g.id)}')">📺 شاشة العرض</button>` : ''}
      ${ph.status === 'REGISTRATION' && notIn.length ? `<button class="btn" onclick="lvNotify('${esc(g.id)}')">📣 ذكّر من لم يسجّل (${notIn.length})</button>` : ''}
      ${canCancel || (ph.status === 'CANCELLED' && j.paid > j.refunded) ? `<button class="btn ghost" style="color:#B42318" onclick="lvCancel('${esc(g.id)}')">${ph.status === 'CANCELLED' ? '↩️ إكمال الاسترداد' : '🚫 إلغاء واسترداد الرسوم'}</button>` : ''}
      ${ph.status !== 'LIVE' ? `<button class="btn ghost" onclick="lvDelete('${esc(g.id)}')">🗑 حذف</button>` : ''}
      <button class="btn" onclick="LVT.monId=null;closeModal();liveTLoad()">إغلاق</button></div>`;
  if(openState.length) box.querySelectorAll('details').forEach((d, i) => { if(openState[i] !== undefined) d.open = openState[i]; });
  const every = ph.status === 'LIVE' ? 3000 : (ph.status === 'FINISHED' || ph.status === 'CANCELLED') ? 0 : 5000;
  if(every) LVT.monTimer = setTimeout(lvMonRefresh, every);
}
/* 🗑 حذف مسابقة من القائمة (سجل النقاط يبقى). الخادم يرفض أثناء اللعب أو قبل استرداد الرسوم. */
async function lvDelete(id){
  const g = LVT.games.find(x => x.id === id) || {};
  const paidOpen = ['SCHEDULED', 'REGISTRATION', 'WAITING'].includes(g.status) && g.fee > 0 && g.players > 0;
  if(paidOpen){ toast('دفع طلاب رسوم هذه المسابقة — ألغِها أولًا لتُعاد رسومهم، ثم احذفها', 'bad'); return; }
  const msg = g.status === 'FINISHED' ? 'تختفي من القائمة. تُصرف الجوائز أولًا إن لم تُصرف، ويبقى سجل النقاط محفوظًا.' : 'تختفي من القائمة ومن بطاقة الطلاب. يبقى سجل النقاط محفوظًا.';
  if(!(await askConfirm(msg, { title: `حذف «${g.title || 'المسابقة'}»؟`, yes: 'احذف', no: 'رجوع' }))) return;
  try{
    await lvPost('/live/delete', { game: id });
    toast('🗑 حُذفت المسابقة', 'good');
    if(LVT.monId === id){ LVT.monId = null; closeModal(); }
  }catch(e){
    toast(e.message === 'refund_first' ? 'بها رسوم لم تُسترد — ألغِها أولًا لتُعاد رسوم الطلاب' : e.message === 'is_live' ? 'لا يمكن حذف مسابقة جارية الآن' : 'تعذّر الحذف', 'bad');
  }
  liveTLoad();
}
/* 📣 تذكير يدوي لمن لم يسجّل — يصل لمن فعّل الإشعارات منهم (الخادم يحدّه بمرة كل 5 دقائق) */
async function lvNotify(id){
  try{
    const j = await lvPost('/live/notify', { game: id });
    toast(j.devices ? `📣 وصل التذكير إلى ${j.delivered ?? j.devices} ${(j.delivered ?? j.devices) === 1 ? 'جهاز' : 'أجهزة'} (من ${j.targets} لم يسجّلوا)` : `لا أحد ممن لم يسجّلوا (${j.targets}) فعّل الإشعارات`, j.devices ? 'good' : 'bad');
  }catch(e){
    const w = e.j && e.j.waitSec;
    toast(e.message === 'too_soon' ? `أرسلت تذكيرًا قبل قليل — يمكنك الإرسال مجددًا بعد ${Math.ceil(w / 60)} دقيقة` : e.message === 'push_not_configured' ? 'الإشعارات غير مُعدّة في الخادم' : e.message === 'not_registration' ? 'التسجيل غير مفتوح الآن' : 'تعذّر الإرسال', 'bad');
  }
}
/* 🗑 حذف كل السابقة (المنتهية والملغاة) — كل واحدة بمسار الحذف نفسه في الخادم: تُصرف جوائز المنتهية أولًا،
   والملغاة التي بقيت لها رسوم لم تُسترد تُستثنى. سجل النقاط يبقى. القائمة تُعاد حتى لا يبقى شيء (تعرض آخر 20 فقط). */
async function lvDeleteAllPast(){
  const past = () => LVT.games.filter(g => g.status === 'FINISHED' || g.status === 'CANCELLED');
  const n0 = past().length; if(!n0) return;
  if(!(await askConfirm(`تُحذف المسابقات المنتهية والملغاة من القائمة. تُصرف جوائز المنتهية أولًا إن لم تُصرف، ويبقى سجل النقاط محفوظًا.`, { title: `حذف كل السابقة (${n0})؟`, yes: 'احذف الكل', no: 'رجوع' }))) return;
  let done = 0; const kept = [], tried = new Set();
  const btn = document.querySelector('.lv-delall'); if(btn){ btn.disabled = true; btn.textContent = '… جارٍ الحذف'; }
  for(let round = 0; round < 10; round++){
    const list = past().filter(g => !tried.has(g.id)); if(!list.length) break;
    for(const g of list){ tried.add(g.id);
      try{ await lvPost('/live/delete', { game: g.id }); done++; }
      catch(e){ kept.push(`${g.title}${e.message === 'refund_first' ? ' (رسوم لم تُسترد)' : ''}`); }
      if(btn) btn.textContent = `… حُذف ${done}`; }
    await liveTLoad();                                      // تظهر أقدم من العشرين إن وُجدت
  }
  await liveTLoad();
  toast(kept.length ? `🗑 حُذف ${done} — بقي ${kept.length}: ${kept.slice(0, 3).join('، ')}` : `🗑 حُذفت ${done} ${done === 1 ? 'مسابقة' : 'مسابقات'}`, kept.length ? 'bad' : 'good');
}
async function lvCancel(id){
  if(!(await askConfirm('تُلغى المسابقة وتُعاد رسوم الدخول لكل من دفع. لا يمكن التراجع عن الإلغاء.', { title: 'إلغاء المسابقة؟', yes: 'ألغِ واسترد', no: 'رجوع' }))) return;
  let total = 0;
  try{
    for(let i = 0; i < 20; i++){                          // دفعات (حد استعلامات الخادم) حتى لا يبقى أحد
      const j = await lvPost('/live/cancel', { game: id }); total += j.refunded;
      if(!j.remaining) break;
    }
    toast(`🚫 أُلغيت${total ? ` وأُعيدت الرسوم لـ ${total} ${total === 1 ? 'طالب' : 'طالبًا'}` : ''}`, 'good');
  }catch(e){ toast('تعذّر الإلغاء: ' + (LV_ERR[e.message] || e.message), 'bad'); }
  LVT.monId = id; lvMonRefresh(); liveTLoad();
}

async function addStudentPoints(studentId){
  const s=byId(studentId);
  const inp=document.getElementById('student-points-amount');
  if(!s||!inp) return;

  const amount=parseInt(inp.value,10);
  if(!Number.isInteger(amount)||amount<1||amount>1000){
    toast('أدخل عدد نقاط من 1 إلى 1000','bad');
    return;
  }

  const oldPoints=Number(s.points||0);
  const api=getApi(), tok=getTok();

  // إذا كان الخادم مضبوطًا، اجعله مصدر الرصيد الحقيقي أولًا.
  if(api&&tok){
    try{
      const r=await fetch(api+'/adjust',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({t:tok,name:s.name,sid:s.id,delta:amount})
      });
      const j=await r.json().catch(()=>({}));
      if(!r.ok || !j.ok) throw new Error(j.error || 'adjust failed');

      // اعتمد القيمة التي رجع بها الخادم، لا عملية جمع محلية قد تكون قديمة.
      s.points=Number(j.pts);
      save(K.st,STUDENTS);
      renderStudentsCenter();
      updateMeta();
      closeModal();
      toast(`${s.name}: تمت إضافة +${amount} نقطة ✓`,'good');
      return;
    }catch(e){
      toast('تعذرت إضافة النقاط إلى رصيد الطالب على الخادم، ولم يتم احتسابها','bad');
      return;
    }
  }

  // وضع محلي فقط عند عدم وجود خادم مضبوط.
  s.points=oldPoints+amount;
  save(K.st,STUDENTS);
  renderStudentsCenter();
  updateMeta();
  closeModal();
  toast(`${s.name}: تمت إضافة +${amount} نقطة ✓`,'good');
}

function openGrantExtraAttempt(studentId, hwId){
  const s=byId(studentId);
  const h=HW.find(x=>String(x.id)===String(hwId));
  if(!s||!h) return;

  const current=h.subs&&h.subs[s.id];
  const hasCurrent=!!current;

  openModal(`
    <h2>🔓 السماح بإعادة التسليم</h2>
    <p style="margin:-.3rem 0 .9rem;color:var(--ink-soft);font-size:.82rem">
      <b>${esc(s.name)}</b><br>
      النشاط: ${esc(h.title)}
    </p>

    <div class="extra-attempt-info">
      <div><span>حالة الطالب في هذا النشاط</span><b>${hasCurrent?'سبق أن سلّم':'لا يوجد تسليم حالي'}</b></div>
      <div><span>الصلاحية</span><b>إعادة التسليم مرة واحدة</b></div>
    </div>

    <p style="font-size:.78rem;line-height:1.8;margin:.8rem 0;color:var(--ink-soft)">
      هذا إجراء طوارئ للمعلم. سيتم السماح للطالب بفتح النشاط وحله مرة أخرى،
      دون حذف التسليم السابق. إذا كانت النتيجة الجديدة أفضل، يحتفظ النظام بالأفضل.
    </p>

    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn tick" onclick="grantExtraAttempt('${esc(s.id)}','${esc(h.id)}')">السماح الآن</button>
    </div>
  `);
}


async function grantExtraAttempt(studentId, hwId){
  const s=byId(studentId);
  const h=HW.find(x=>String(x.id)===String(hwId));
  if(!s||!h) return;

  const api=getApi(), tok=getTok();
  if(!api || !tok){
    toast('اضبط عنوان الخادم وكلمة السر أولاً','bad');
    return;
  }

  try{
    const r=await fetch(api+'/extra-attempt',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        t:tok,
        name:s.name,
        hwId:h.sid || h.id,
        assignmentId:h.sid || h.id,
        studentId:s.id,
        extraAttempts:1
      })
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok || !j.ok) throw new Error(j.error || 'extra-attempt failed');

    // نسخة محلية للواجهة فقط بعد تأكيد الخادم.
    h.extraAttempts=h.extraAttempts||{};
    h.extraAttempts[s.id]=(h.extraAttempts[s.id]||0)+1;
    save(K.hw,HW);

    closeModal();
    renderStudentCenterDetail();
    renderStudentsCenter();
    renderGrades();
    renderAnalysis();
    pullExtraAttemptStatus();
    markFollowupHandled(studentId);
    renderDashboard();

    toast(`تم السماح لـ ${s.name} بإعادة التسليم ✓`,'good');
  }catch(e){
    console.error('grantExtraAttempt:',e);
    toast('لم تُمنح الصلاحية — لم يؤكد الخادم العملية','bad');
  }
}

function hasExtraAttempt(h, studentId){
  return Number(h?.extraAttempts?.[studentId] || 0) > 0;
}
async function parEdit(sid){
  const x=(PARENTS||{})[sid]||{};
  const v=prompt('جوال ولي الأمر (مثل 05xxxxxxxx) — اتركه فارغًا للحذف:', x.p?parFmt(x.p):''); if(v===null) return;
  const pn=prompt('اسم ولي الأمر (اختياري):', x.pn||''); if(pn===null) return;
  try{ const r=await fetch(getApi().replace(/\/+$/,'')+'/parent-phones',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:getTok(),op:'set',sid,phone:v,pn})});
    const j=await r.json(); if(!j.ok) throw new Error(j.error||'');
    PARENTS=PARENTS||{}; if(j.parent) PARENTS[sid]=j.parent; else delete PARENTS[sid];
    const b=document.getElementById('par-box'); if(b&&b.dataset.sid===sid) b.innerHTML=parBoxHTML(sid);
    toast(j.parent?'✓ حُفظ جوال ولي الأمر':'حُذف الجوال','good');
  }catch(e){ toast(/not_found|404/.test(String(e.message))?'انشر worker.js الأخير':'تعذّر الحفظ — تأكد من الرقم (يبدأ بـ 05)','bad'); }
}
function stcStep(d){
  const L=window.STC_LIST||[]; if(!L.length) return;
  const i=L.indexOf(String(STUDENT_CENTER_SELECTED)), n=L[(i+d+L.length)%L.length];
  selectStudentCenter(n,false);
  const it=[...document.querySelectorAll('.student-list-item')].find(e=>e.getAttribute('onclick')?.includes(`'${n}'`));
  if(it&&!stcMobile()) it.scrollIntoView({block:'nearest'});
}
function stcBack(){
  stcPanel()?.classList.remove('stc-open');
  const it=document.querySelector('.student-list-item.selected'); if(it) it.scrollIntoView({block:'center'});
}
// من حسّن؟ درجة الأنشطة بلحظة الإغلاق الأصلية مقابلها بعد امتداد الفرصة
function impGains(sem,per){
  const I=impOf(sem,per); if(!I) return [];
  const t0={...I.term}; delete t0.improve;
  return (Array.isArray(STUDENTS)?STUDENTS:[]).map(s=>{ const acts=compActivitiesForStudent(s,I.term); if(!acts.length) return null;
    const a=compSubmissionCount(acts,s,t0), b=compSubmissionCount(acts,s,I.term); if(b<=a) return null;
    return { s, n:acts.length, a, b, g0:Math.round(a/acts.length*100)/10, g1:Math.round(b/acts.length*100)/10 }; }).filter(Boolean).sort((x,y)=>(y.b-y.a)-(x.b-x.a));
}
async function impOpen(sem,per){
  const I=impOf(sem,per), lbl=vspLabel({sem,per});
  const def=new Date(Date.now()+3*3600000+7*864e5).toISOString().slice(0,10), min=new Date(Date.now()+3*3600000).toISOString().slice(0,10);
  const draw=()=>{ const I=impOf(sem,per), G=impGains(sem,per);
    openModal(`<h2>🔓 فرصة تحسين — ${esc(lbl)}</h2>
      <p class="muted" style="font-size:.86rem;line-height:1.8;margin:.1rem 0 .7rem">تفتح للطلاب مدة يسلّمون فيها <b>أنشطة ${esc(lbl)} التي لم يسلّموها</b>، فتُحسب لدرجة الأنشطة فيها. تظهر لهم في البوابة بموعد نهاية الفرصة.<br>
      ✓ الدرجة لا تنقص أبدًا · 🔒 المشاركة والواجبات والسلوك والاختبارات تبقى مقفلة · بعد انتهائها تثبت النتيجة الجديدة في الكشوف وصفحة ولي الأمر.</p>
      ${I&&I.on?`<div class="imp-state on">🔓 مفتوحة حتى نهاية <b>${impDayLabel(I.day)}</b></div>`:I?`<div class="imp-state">انتهت آخر فرصة في ${impDayLabel(I.day)}</div>`:''}
      <div class="row" style="gap:.5rem;align-items:flex-end;flex-wrap:wrap;margin:.7rem 0">
        <label class="field" style="margin:0;flex:1;min-width:170px"><span>${I&&I.on?'تمديد حتى':'مفتوحة حتى نهاية يوم'}</span><input class="inp" type="date" id="imp-until" min="${min}" value="${I&&I.on?I.day:def}"></label>
        <button class="btn tick" type="button" id="imp-go">${I&&I.on?'💾 حفظ الموعد':'🔓 افتح الفرصة'}</button>
        ${I&&I.on?'<button class="btn ghost" type="button" id="imp-stop">⏹️ إنهاء الآن</button>':''}
      </div>
      ${I?`<h3 style="margin:.9rem 0 .4rem;font-size:.98rem">📈 من حسّن درجته (${G.length})</h3>
        ${G.length?`<div class="imp-list">${G.map(x=>`<div class="imp-row"><b>${esc(x.s.name)}</b><span class="muted">${esc(x.s.cls||'')}</span><span>سلّم ${x.b-x.a} ${x.b-x.a>2?'أنشطة':x.b-x.a===2?'نشاطين':'نشاطًا'}</span><span class="imp-g">${x.g0} ← <b>${x.g1}</b> / 10</span></div>`).join('')}</div>`:'<p class="muted">لم يسلّم أحد بعد — تظهر هنا التسليمات الجديدة (اضغط 🔄 في الأنشطة لجلب آخرها).</p>'}`:''}
      <div class="modal-foot"><button class="btn ghost" type="button" onclick="closeModal()">إغلاق</button></div>`);
    const send=async(body,msg)=>{ try{ await postDashboardAcademic({action:'improve',semester:sem,period:per,...body}); toast(msg,'good'); try{ vspDraw(); }catch(e){} try{ await ctEnsureGrades(true); }catch(e){} draw(); }
      catch(e){ toast(e.message==='until_past'?'اختر تاريخًا من اليوم فصاعدًا':e.message==='too_long'?'أقصى مدة 60 يومًا':'تعذّر الحفظ: '+e.message,'bad'); } };
    document.getElementById('imp-go').onclick=()=>{ const v=document.getElementById('imp-until').value; if(!v) return toast('اختر تاريخ النهاية','bad');
      send({until:v}, `🔓 فرصة التحسين مفتوحة حتى ${impDayLabel(v)} — تظهر للطلاب في البوابة`); };
    const st=document.getElementById('imp-stop'); if(st) st.onclick=()=>{ if(confirm('إنهاء فرصة التحسين الآن؟ ما سُلّم قبل الآن يبقى محسوبًا.')) send({stop:true},'⏹️ انتهت فرصة التحسين — ما سُلّم خلالها محسوب'); };
  };
  try{ if(typeof pullAll==='function') pullAll(true); }catch(e){}
  draw();
}
function vspOpen(){
  const L=vspList(), cur=ctSem();
  if(L.length<2){ toast('لا توجد فترة مغلقة للعرض بعد'); return; }
  openModal(`<h2>📅 الفترة المعروضة</h2>
    <p class="muted" style="font-size:.86rem;margin:.1rem 0 .8rem">اختر الفترة التي تريد رؤية بياناتها في كل اللوحة: الكشوف، ملف الفصل والأوائل، المستويات، تقارير الطلاب. الرصد الجديد يبقى على الفترة الجارية دائمًا.</p>
    <div class="vsp-list">${L.map(x=>`<button type="button" class="vsp-opt ${x.sem===cur.sem&&x.per===cur.per?'on':''}" onclick="vspSet(${x.active?0:`{sem:${x.sem},per:${x.per}}`})">
      <b>${vspLabel(x)}</b><small>${x.active?'● الفترة الجارية':(impOf(x.sem,x.per)&&impOf(x.sem,x.per).on?'🔓 مغلقة — فرصة التحسين مفتوحة':'🔒 مغلقة — بياناتها كما أُغلقت')}</small></button>`).join('')}</div>
    ${L.filter(x=>x.closed).map(x=>`<button type="button" class="btn ghost sm" style="margin-top:.5rem" onclick="impOpen(${x.sem},${x.per})">🔓 فرصة تحسين ${vspLabel(x)}</button>`).join(' ')}
    <div class="modal-foot"><button class="btn ghost" type="button" onclick="closeModal()">إغلاق</button></div>`);
}
/* والعكس: تغيير الفترة من أي كشف يغيّرها في اللوحة كلها */
function vspFromSelect(semId, perId){
  const sp={ sem:Number(document.getElementById(semId)?.value)===2?2:1, per:Number(document.getElementById(perId)?.value)===2?2:1 }, a=ctSemActive();
  if(!vspList().length){ // الإعدادات الأكاديمية لم تُحمَّل بعد: السلوك القديم
    if(semId==='ca-semester') return kashfSP(); if(semId==='madr-sem') return madRegisterLoad(); return renderComprehensive(); }
  if(sp.sem===a.sem&&sp.per===a.per) return vspSet(0);
  if(vspList().some(x=>x.sem===sp.sem&&x.per===sp.per)) return vspSet(sp);
  toast('هذه الفترة لم تبدأ بعد','bad'); vspSyncSelects();
}
async function vspSet(sp){
  try{ if(sp) localStorage.setItem(VSP_KEY,JSON.stringify(sp)); else localStorage.removeItem(VSP_KEY); }catch(e){}
  closeModal(); const now=ctSem();
  // كل ما يتبع الفترة يُعاد تحميله: درجات الفصل، والمقارنة بالفترة السابقة، وقوائم الكشف الشامل وسجل مدرستي
  CT_GRADES=null; try{ CT_PREV=null; }catch(e){}
  vspSyncSelects(); vspDraw(); toast(now.viewing?`👁️ تعرض الآن ${vspLabel(now)}`:'↩️ عدت للفترة الحالية','good');
  try{ await ctEnsureGrades(true); }catch(e){}
  const on=id=>document.getElementById(id)?.classList.contains('on');
  try{ if(document.getElementById('ct-body')) await renderClassTools(); }catch(e){}
  try{ if(on('p-dashboard')) renderTodayHub(true); }catch(e){}
  const vis=id=>{ const el=document.getElementById(id); return !!(el&&el.offsetParent); };
  try{ if(document.getElementById('comp-semester')) renderComprehensive(true); }catch(e){}
  try{ if(vis('ca-body')) renderCompAnalysis(true); }catch(e){}
  try{ if(vis('madr-sem')&&typeof madRegisterLoad==='function') madRegisterLoad(); }catch(e){}
  try{ if(typeof renderAll==='function') renderAll(); }catch(e){}
}