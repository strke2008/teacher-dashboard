

/* ═══════════════ منظومة AI مستقلة للوحة المعلم ═══════════════
   متوافقة عمداً مع مفاتيح/نماذج تطبيق الألعاب التعليمية.
*/
const READING_AI_PROVIDERS = {
  // 🔄 محدَّث سبتمبر 2026 من الوثائق الرسمية لكل مزوّد
  groq:{name:'Groq',compat:'openai',baseUrl:'https://api.groq.com/openai/v1/chat/completions',models:['openai/gpt-oss-120b','openai/gpt-oss-20b','qwen/qwen3.8-27b','llama-3.3-70b-versatile','llama-3.1-8b-instant'],defaultModel:'openai/gpt-oss-120b',keyHint:'gsk_...',tokenParam:'max_tokens',reasoningModels:['openai/gpt-oss-120b','openai/gpt-oss-20b'],maxTokens:4000},
  openai:{name:'OpenAI (GPT)',compat:'openai',baseUrl:'https://api.openai.com/v1/chat/completions',models:['gpt-6.1-sol','gpt-6-astra','gpt-6.1-terra','gpt-6-luna','gpt-5.6-sol'],defaultModel:'gpt-6.1-sol',keyHint:'sk-...',tokenParam:'max_completion_tokens',reasoningModels:['gpt-6.1-sol','gpt-6-astra','gpt-6.1-terra','gpt-6-luna','gpt-5.6-sol'],maxTokens:16000},
  openrouter:{name:'OpenRouter (بوّابة)',compat:'openai',baseUrl:'https://openrouter.ai/api/v1/chat/completions',models:['anthropic/claude-sonnet-5.5','anthropic/claude-opus-5.5','anthropic/claude-haiku-5.5','anthropic/claude-fable-5.1','openai/gpt-6.1-sol','openai/gpt-6-astra','openai/gpt-6-luna','google/gemini-4-argon','google/gemini-3.8-flash','qwen/qwen3.7-max','deepseek/deepseek-v4-flash','deepseek/deepseek-v4-pro','x-ai/grok-4','meta-llama/llama-3.3-70b-instruct'],defaultModel:'anthropic/claude-sonnet-5.5',keyHint:'sk-or-...',reasoningModels:['anthropic/claude-sonnet-5.5','anthropic/claude-opus-5.5','anthropic/claude-haiku-5.5','anthropic/claude-fable-5.1','openai/gpt-6.1-sol','openai/gpt-6-astra','openai/gpt-6-luna','google/gemini-4-argon','google/gemini-3.8-flash','deepseek/deepseek-v4-pro','deepseek/deepseek-v4-flash'],maxTokens:16000},
  claude:{name:'Claude (Anthropic)',compat:'claude',baseUrl:'https://api.anthropic.com/v1/messages',models:['claude-opus-5-5','claude-sonnet-5-5','claude-haiku-5-5','claude-fable-5-1'],defaultModel:'claude-opus-5-5',keyHint:'sk-ant-...',maxTokens:8000},
  gemini:{name:'Google Gemini',compat:'gemini',baseUrl:'https://generativelanguage.googleapis.com/v1beta/models',models:['gemini-3.8-flash','gemini-3.5-flash-lite','gemini-4-argon','gemini-3.1-pro-preview'],defaultModel:'gemini-3.8-flash',keyHint:'AIza...',reasoningModels:['gemini-3.8-flash','gemini-3.5-flash-lite','gemini-4-argon','gemini-3.1-pro-preview'],maxTokens:16000}
};
/* Claude Opus 4.7 وما بعده (ومنه 5.5 وSonnet 5 وFable 5.1) يرفض temperature غير الافتراضية بخطأ 400 — نرسلها لـ Haiku 4.5 فقط */
function claudeSamplingOK(m){ return /claude-(haiku-4-5|sonnet-4-[56]|opus-4-[156]|3)/.test(String(m||'')); }
/* Gemini 3.x: temperature مهملة — لا تُرسل */
function geminiSamplingOK(m){ return !aiNoTemp('gemini',m); }
/* بعد التحديث: من اختار سابقًا من القائمة موديلًا أُزيل منها يعود للافتراضي الجديد.
   الموديل المخصص (يُكتب يدويًا) لا يُمس — يُحفظ في المفتاح نفسه، فنقيّد الترحيل بهذه المعرّفات فقط */
const AI_RETIRED_MODELS = ["anthropic/claude-fable-5", "anthropic/claude-opus-4.8", "anthropic/claude-opus-5", "anthropic/claude-sonnet-4.6", "anthropic/claude-sonnet-5", "claude-fable-5", "claude-haiku-4-5-20251001", "claude-opus-4-8", "claude-opus-5", "claude-sonnet-4-6", "claude-sonnet-5", "gemini-2.5-flash", "gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash", "google/gemini-3.5-flash", "google/gemini-3.6-flash", "google/gemini-3.7-flash", "gpt-4o-mini", "gpt-5.5", "gpt-5.6-luna", "gpt-5.6-terra", "gpt-6-sol", "openai/gpt-5.5", "openai/gpt-5.6-terra", "openai/gpt-6-sol", "qwen/qwen3.6-27b"];
(function aiMigrateSavedModels(){ try{ for(const p of Object.keys(READING_AI_PROVIDERS)){ const k='ai_model_'+p, v=localStorage.getItem(k); if(v && AI_RETIRED_MODELS.includes(v)) localStorage.removeItem(k); } }catch(e){} })();

/* 💰 ملاحظة بجانب كل موديل في القائمة: ما يعمل بلا رصيد، والأرخص، والمدفوع فقط (نوفمبر 2026) */
const AI_MODEL_NOTES={
  'gemini-3.8-flash':'مجاني بحدود يومية — الأنسب','gemini-3.5-flash-lite':'مجاني — الأسرع والأخف','gemini-4-argon':'الأقوى — مدفوع فقط (يحتاج فوترة)','gemini-3.1-pro-preview':'مدفوع — تجريبي',
  'openai/gpt-oss-120b':'مجاني بحدود — الأقوى في Groq','openai/gpt-oss-20b':'مجاني بحدود — أسرع','qwen/qwen3.8-27b':'مجاني بحدود','llama-3.3-70b-versatile':'مجاني بحدود','llama-3.1-8b-instant':'مجاني — الأسرع، للمهام البسيطة',
  'claude-opus-5-5':'الأقوى — الأغلى','claude-sonnet-5-5':'متوازن — أرخص من Opus','claude-haiku-5-5':'الأرخص والأسرع','claude-fable-5-1':'',
  'gpt-6.1-sol':'الأحدث — قوي','gpt-6-astra':'الأقوى — الأغلى','gpt-6.1-terra':'متوازن','gpt-6-luna':'الأرخص','gpt-5.6-sol':'جيل سابق',
  'anthropic/claude-haiku-5.5':'الأرخص من Claude','google/gemini-3.8-flash':'رخيص جدًا','deepseek/deepseek-v4-flash':'رخيص جدًا','openai/gpt-6-luna':'رخيص'};
const AI_KEY_URLS={groq:'https://console.groq.com/keys',openai:'https://platform.openai.com/api-keys',openrouter:'https://openrouter.ai/keys',claude:'https://console.anthropic.com/settings/keys',gemini:'https://aistudio.google.com/app/apikey'};
function raiProvider(){try{const p=localStorage.getItem('ai_provider_v1')||localStorage.getItem('selected_api_provider')||'gemini';return READING_AI_PROVIDERS[p]?p:'gemini'}catch{return 'gemini'}}
function raiKeys(p){try{return JSON.parse(localStorage.getItem(p==='groq'?'groq_api_keys':'aikeys_'+p)||'[]')}catch{return []}}
function raiIdxKey(p){return p==='groq'?'groq_active_key_index':'aiidx_'+p}
function raiSaveKeys(p,arr){localStorage.setItem(p==='groq'?'groq_api_keys':'aikeys_'+p,JSON.stringify(arr));if(p==='groq'){const i=Number(localStorage.getItem(raiIdxKey(p))||0);if(arr[i])localStorage.setItem('groq_api_key',arr[i].key);else localStorage.removeItem('groq_api_key')}}
function raiActiveKey(p){const a=raiKeys(p);if(!a.length)return '';let i=Number(localStorage.getItem(raiIdxKey(p))||0);if(!Number.isFinite(i))i=0;for(let n=0;n<a.length;n++){const k=a[(i+n)%a.length];if(k&&!k.exhausted)return k.key}return p==='groq'?(localStorage.getItem('groq_api_key')||''):''}
function raiRotateKey(p,current){const a=raiKeys(p);if(a.length<=1)return false;let cur=a.findIndex(k=>k.key===current);if(cur<0)cur=0;a[cur].exhausted=true;a[cur].exhaustedAt=Date.now();for(let n=1;n<=a.length;n++){const j=(cur+n)%a.length;if(a[j]&&!a[j].exhausted){localStorage.setItem(raiIdxKey(p),String(j));raiSaveKeys(p,a);return a[j].key}}raiSaveKeys(p,a);return false}
function aiSettingsRender(){
  const ps=document.getElementById('ai-settings-provider'), ms=document.getElementById('ai-settings-model');if(!ps||!ms)return;
  const cur=raiProvider();ps.innerHTML=Object.entries(READING_AI_PROVIDERS).map(([id,c])=>`<option value="${id}" ${id===cur?'selected':''}>${c.name}</option>`).join('');
  const c=READING_AI_PROVIDERS[cur], saved=localStorage.getItem('ai_model_'+cur)||c.defaultModel;
  const live=aiLive(cur), liveIds=live&&new Set(live.ids||[]);
  const note=m=>{ if(liveIds&&liveIds.size&&!liveIds.has(m)) return '⚠️ غير متاح لمفتاحك الآن'; return AI_MODEL_NOTES[m]||''; };
  const extra=live?(live.models||[]).filter(x=>!c.models.includes(x.id)):[];
  ms.innerHTML=c.models.map(m=>`<option value="${esc(m)}" ${m===saved?'selected':''}>${esc(m)}${note(m)?' — '+note(m):''}</option>`).join('')
    +(extra.length?`<optgroup label="🆕 من المزوّد (${extra.length})">${extra.map(x=>`<option value="${esc(x.id)}" ${x.id===saved?'selected':''}>${esc(x.id)}${x.free?' — مجاني':''}${AI_MODEL_NOTES[x.id]?' — '+AI_MODEL_NOTES[x.id]:''}</option>`).join('')}</optgroup>`:'')+'<option value="__custom__">✏️ موديل مخصص…</option>';
  const custom=(c.models.includes(saved)||extra.some(x=>x.id===saved))?'':saved;
  { const st=document.getElementById('ai-models-sync-st'); if(st) st.textContent=live?('آخر تحديث: '+new Date(live.at).toLocaleDateString('ar-SA',{day:'numeric',month:'long'})+(extra.length?' · '+extra.length+' موديل إضافي':' · لا جديد')):'القائمة من آخر تحديث للوحة — اضغط ليجلب المزوّد أحدث موديلاته لمفتاحك'; }document.getElementById('ai-settings-custom-model').value=custom;
  const temp=localStorage.getItem('ai_temperature_v1')??'.3',tok=localStorage.getItem('ai_max_tokens_v1')??'12000',lang=localStorage.getItem('ai_language_v1')||'ar',diff=localStorage.getItem('ai_difficulty_v1')||'medium';
  document.getElementById('ai-settings-temp').value=temp;document.getElementById('ai-settings-tokens').value=tok;document.getElementById('ai-settings-lang').value=lang;document.getElementById('ai-settings-diff').value=diff;
  document.getElementById('ai-settings-key-title').textContent='مفاتيح '+c.name;document.getElementById('ai-settings-key-hint').textContent=(c.keyHint||'API key')+' — تُحفظ في هذا المتصفح فقط، ويمكن التبديل تلقائياً عند 401/429 أو تعطل المزوّد.';
  const l=document.getElementById('ai-settings-getkey');l.href=AI_KEY_URLS[cur]||'#';l.style.display=AI_KEY_URLS[cur]?'inline-flex':'none';
  const list=document.getElementById('ai-settings-keys-list'),a=raiKeys(cur),idx=Number(localStorage.getItem(raiIdxKey(cur))||0),active=raiActiveKey(cur);
  list.innerHTML=a.length?a.map((k,i)=>{const on=k.key===active&&!k.exhausted;const masked=k.key.length>12?k.key.slice(0,6)+'••••••'+k.key.slice(-4):'••••••••';return `<div style="display:flex;gap:.45rem;align-items:center;border:1px solid var(--rule);border-radius:10px;padding:.5rem;margin:.35rem 0;flex-wrap:wrap"><b style="min-width:70px">${esc(k.label||('مفتاح '+(i+1)))}</b><code style="flex:1;min-width:160px">${esc(masked)}</code><span class="pill" style="font-size:.72rem">${k.exhausted?'⛔ مستنفد':on?'✅ نشط':'⏸ غير نشط'}</span><button class="btn ghost sm" type="button" onclick="aiSettingsActivateKey(${i})">تفعيل</button><button class="btn ghost sm" type="button" onclick="aiSettingsRemoveKey(${i})">حذف</button></div>`}).join(''):'<div class="muted" style="text-align:center;padding:.5rem">لا توجد مفاتيح محفوظة لهذا المزوّد.</div>';
  try{ aiRoutesRender(); }catch(e){}
  const ready=!!active;const st=document.getElementById('ai-settings-status');st.textContent=ready?'جاهز':'غير مُعد';
  { let lu=document.getElementById('ai-last-used'); if(!lu&&ms.closest('.row')){ lu=document.createElement('div'); lu.id='ai-last-used'; lu.className='muted'; lu.style.cssText='font-size:.78rem;margin-top:.45rem'; ms.closest('.row').insertAdjacentElement('afterend',lu); } if(lu) lu.textContent=aiLastUsedText(); }st.style.color=ready?'var(--tick)':'var(--pen)';
}
setTimeout(aiSettingsRender,0);

/* 🩺 شرح عربي لأشهر أخطاء المزوّدات (يظهر مع رسالة المزوّد الأصلية في «اختبار الاتصال») */
function aiErrHint(e){ const m=String(e?.message||''), s=Number(e?.status)||0;
  if(/API key not valid|API_KEY_INVALID|invalid x-api-key|Incorrect API key|invalid_api_key/i.test(m)||s===401) return 'المفتاح غير صحيح أو محذوف — انسخه من جديد من صفحة المفاتيح.';
  if(/referer|referrer|HTTP_REFERRER|API_KEY_HTTP_REFERRER_BLOCKED/i.test(m)) return 'المفتاح مقيَّد بمواقع معيّنة — في Google Cloud ← Credentials أضف عنوان لوحتك للمواقع المسموحة، أو أزل التقييد.';
  if(/SERVICE_DISABLED|has not been used|is disabled/i.test(m)) return 'واجهة Gemini غير مفعّلة في مشروع المفتاح — أنشئ المفتاح من Google AI Studio مباشرة.';
  if(/location is not supported|User location/i.test(m)) return 'الخدمة غير متاحة من موقعك الحالي.';
  if(s===429||/quota|RESOURCE_EXHAUSTED|rate limit/i.test(m)) return 'انتهت الحصة أو تجاوزت عدد الطلبات المسموح — انتظر قليلًا، أو أضف مفتاحًا آخر، أو فعّل الفوترة.';
  if(s===404||/not found|is not supported for generateContent|does not exist/i.test(m)) return 'اسم الموديل غير متاح لهذا المفتاح — اختر موديلًا آخر من القائمة.';
  if(s===403||/permission|PERMISSION_DENIED/i.test(m)) return 'المفتاح لا يملك صلاحية — تأكد أنه من نفس الحساب وأن المشروع مفعّل.';
  if(s>=500) return 'خادم المزوّد مشغول أو متعطل مؤقتًا — جرّب بعد قليل.';
  if(/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'تعذّر الوصول للمزوّد من هذه الشبكة.';
  return ''; }
/* 🤖 «من يعمل الآن؟» — شريط صغير أسفل الشاشة مع كل طلب ذكاء اصطناعي في أي مكان بالتطبيق:
   المزوّد والموديل أثناء العمل، والتحويل لمزوّد آخر وسببه، ومن أنجز في النهاية. آخر استخدام يُحفظ ويظهر في الإعدادات. */
function aiErrShort(e){ const m=String(e?.message||''), s=Number(e?.status)||0;
  if(s===429||/quota|RESOURCE_EXHAUSTED|rate limit|credit|balance|billing|insufficient/i.test(m)) return 'الرصيد أو الحصة';
  if(s===401||/api key|x-api-key|invalid_api_key/i.test(m)) return 'المفتاح';
  if(s===402||s===403) return 'الرصيد أو الصلاحية';
  if(s===404) return 'الموديل غير متاح'; if(s>=500) return 'المزوّد مشغول'; if(/fetch|network/i.test(m)) return 'الشبكة'; return 'خطأ'; }
let AI_USE_T=0;
function aiUse(state,p,m,e,via){ try{
  const c=READING_AI_PROVIDERS[p]||{name:p}, who=`<b>${esc(c.name)}</b> · <code>${esc(m||'')}</code>`;
  let el=document.getElementById('ai-use'); if(!el){ el=document.createElement('div'); el.id='ai-use'; el.className='no-print'; el.setAttribute('role','status'); el.setAttribute('aria-live','polite'); document.body.appendChild(el); }
  clearTimeout(AI_USE_T); el.className='no-print on '+state;
  const from=via&&via.from&&via.from!==p?(READING_AI_PROVIDERS[via.from]||{name:via.from}).name:'';
  el.innerHTML = (state==='run'?'<i class="ai-use-spin"></i>':'')+'<span class="ai-use-t">'+(state==='run' ? (from?`⤵️ ${esc(from)} تعذّر (${esc(via.why||'خطأ')}) — يعمل الآن ${who}…`:`🤖 ${who} — يعمل…`)
    : state==='err' ? `⚠️ تعذّر ${who} (${aiErrShort(e)})`
    : `✓ أُنجز بـ ${who}${from?' (بدل '+esc(from)+')':''}`)+'</span>';
  if(state==='ok'||state==='err'){ try{ localStorage.setItem('ai_last_used',JSON.stringify({p,m,at:Date.now(),ok:state==='ok'})); }catch(x){}
    AI_USE_T=setTimeout(()=>{ el.classList.remove('on'); },state==='ok'?6000:9000); }
}catch(x){} }
function aiLastUsedText(){ try{ const j=JSON.parse(localStorage.getItem('ai_last_used')||'null'); if(!j) return '';
  const c=READING_AI_PROVIDERS[j.p]||{name:j.p}, min=Math.round((Date.now()-j.at)/60000);
  return (j.ok?'آخر استخدام: ':'آخر محاولة فاشلة: ')+c.name+' · '+j.m+' — '+(min<1?'الآن':min<60?'قبل '+min+' د':min<1440?'قبل '+Math.round(min/60)+' س':'قبل '+Math.round(min/1440)+' يوم'); }catch(e){ return ''; } }

/* 🔄 القائمة المجلوبة من المزوّد (زر «تحديث قائمة الموديلات») — محفوظة على هذا الجهاز */
function aiLive(p){ try{ const j=JSON.parse(localStorage.getItem('ai_models_live_'+p)||'null'); return j&&Array.isArray(j.models)?j:null; }catch(e){ return null; } }
/* موديل جديد لا نعرفه: أجيال الاستدلال الحديثة ترفض temperature بخطأ 400، فلا نرسلها لها */
function aiNoTemp(p,m){ m=String(m||''); const c=READING_AI_PROVIDERS[p]||{};
  if(Array.isArray(c.reasoningModels)&&c.reasoningModels.includes(m)) return true;
  if(p==='gemini') return /gemini-([3-9]|\d{2})/.test(m);
  if(p==='openai'||p==='openrouter') return /(^|\/)(gpt-([5-9]|\d{2})|o\d)|anthropic\/claude-|google\/gemini-([3-9]|\d{2})|deepseek-v([4-9]|\d{2})|deepseek-r/.test(m);
  return false; }
/* 🎯 مزوّد لكل مهمة (اختياري): قراءة PDF بمزوّد، وتوليد الأسئلة بآخر… الافتراضي «الأساسي».
   مهمة اختير لها مزوّد بلا مفتاح ⇒ تعود للأساسي. والتحويل الاحتياطي عند التعذّر كما هو. */
const AI_TASKS=[['pdf','📄 قراءة PDF والصور','استخراج نص الكتاب وتنظيمه'],['questions','📝 توليد الأسئلة والأنشطة','الأنشطة والقراءة واقتراح أسئلة الاختبار والتشخيص'],['nafs','🧭 أسئلة نافس','توليد أسئلة نافس ونواتج التعلم'],['background','🔁 المهام الخلفية','النسخ العلاجية وربط المهارات — تعمل وحدها'],['assistant','✨ مساعدي','أسئلتك عن طلابك داخل اللوحة']];
function aiRoutes(){ try{ return JSON.parse(localStorage.getItem('ai_routes_v1')||'{}')||{}; }catch(e){ return {}; } }
function aiRoute(task){ const r=aiRoutes()[task];
  if(r&&r.p&&READING_AI_PROVIDERS[r.p]&&readingAIGetKey(r.p)) return {p:r.p,m:r.m||readingAIModels()[r.p],custom:true};
  const p=raiProvider(); return {p,m:readingAIModels()[p],custom:false}; }
function aiRouteTwin(){ const r=aiRoute('background'); return r.custom?r:{p:r.p,m:twinModel(r.p),custom:false}; }   // الخلفية: الموديل الاقتصادي ما لم يُختر غيره
function aiModelOptionsHTML(p,saved){ const c=READING_AI_PROVIDERS[p], live=aiLive(p), liveIds=live&&new Set(live.ids||[]);
  const note=m=>{ if(liveIds&&liveIds.size&&!liveIds.has(m)) return '⚠️ غير متاح لمفتاحك الآن'; return AI_MODEL_NOTES[m]||''; };
  const extra=live?(live.models||[]).filter(x=>!c.models.includes(x.id)):[];
  const all=c.models.concat(extra.map(x=>x.id)); if(saved&&!all.includes(saved)) all.push(saved);
  return all.map(m=>`<option value="${esc(m)}" ${m===saved?'selected':''}>${esc(m)}${note(m)?' — '+note(m):''}</option>`).join(''); }
function aiRoutesRender(){ const box=document.getElementById('ai-routes'); if(!box) return;
  const R=aiRoutes(), prim=raiProvider(), pn=READING_AI_PROVIDERS[prim].name, open=box.querySelector('details')?.open ?? Object.keys(R).length>0;
  box.innerHTML=`<details ${open?'open':''}><summary><b>🎯 مزوّد لكل مهمة</b> <span class="muted">(اختياري — مثلًا PDF بمزوّد والأسئلة بآخر)</span></summary>
    <div class="ai-routes-list">${AI_TASKS.map(([k,t,d])=>{ const r=R[k]||{}, has=r.p&&readingAIGetKey(r.p);
      return `<div class="ai-route-row" data-ai-route="${k}"><div class="ai-route-t"><b>${t}</b><small class="muted">${d}</small></div>
        <select class="inp" onchange="aiRouteSet('${k}','p',this.value)" aria-label="مزوّد ${t}"><option value="">الأساسي (${esc(pn)})</option>${Object.entries(READING_AI_PROVIDERS).map(([id,c])=>`<option value="${id}" ${r.p===id?'selected':''} ${readingAIGetKey(id)?'':'disabled'}>${esc(c.name)}${readingAIGetKey(id)?'':' — بلا مفتاح'}</option>`).join('')}</select>
        ${r.p?`<select class="inp" onchange="aiRouteSet('${k}','m',this.value)" aria-label="موديل ${t}">${aiModelOptionsHTML(r.p,r.m||readingAIModels()[r.p])}</select>`:`<span class="ai-route-m muted">${k==='background'?'الموديل الاقتصادي تلقائيًا':'نفس الموديل الأساسي'}</span>`}
        ${r.p&&!has?'<small class="ai-route-warn">⚠️ لا مفتاح لهذا المزوّد — يُستخدم الأساسي</small>':''}</div>`; }).join('')}</div></details>`; }
function aiRouteSet(task,field,v){ const R=aiRoutes(); const r=R[task]||{};
  if(field==='p'){ if(!v) delete R[task]; else R[task]={p:v,m:readingAIModels()[v]}; } else { r.m=v; R[task]=r; }
  try{ localStorage.setItem('ai_routes_v1',JSON.stringify(R)); }catch(e){} aiRoutesRender(); }
function readingAIPickProvider(){ return raiProvider(); }
function readingAIModels(){ const out={};Object.keys(READING_AI_PROVIDERS).forEach(p=>out[p]=localStorage.getItem('ai_model_'+p)||READING_AI_PROVIDERS[p].defaultModel);return out; }
function readingAIGetKey(provider){ return raiActiveKey(provider||raiProvider()); }
function readingAIConfig(provider){ return READING_AI_PROVIDERS[provider]||READING_AI_PROVIDERS.gemini; }

/* image (اختياري): {type:'image/jpeg', b64} — يُرسل مع النص للنماذج التي ترى الصور (توليد أسئلة من صورة يرفعها المعلم) */
async function readingAICall(provider, model, systemText, signal, image, opts){
  provider=provider||raiProvider();
  const cfg=readingAIConfig(provider);
  let current=readingAIGetKey(provider);
  if(!current) throw new Error('لا يوجد مفتاح متاح لـ '+cfg.name+'. افتح ⚙️ إعدادات الذكاء الاصطناعي وأضف مفتاحاً.');
  const temp=Math.max(0,Math.min(2,Number(localStorage.getItem('ai_temperature_v1')??'.3')));
  const maxTok=Math.max(500,Number(localStorage.getItem('ai_max_tokens_v1')||12000));
  const request=async(p,key)=>{
    const c=readingAIConfig(p), m=(p===provider?model:(localStorage.getItem('ai_model_'+p)||c.defaultModel));
    if(c.compat==='gemini'){
      const r=await fetch(c.baseUrl+'/'+encodeURIComponent(m)+':generateContent?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[...(image?[{inline_data:{mime_type:image.type,data:image.b64}}]:[]),{text:systemText}]}],generationConfig:{...(geminiSamplingOK(m)?{temperature:temp}:{}),maxOutputTokens:Math.min(maxTok,c.maxTokens||maxTok),responseMimeType:'application/json'}}),signal});
      const d=await r.json();if(!r.ok){const e=new Error(d.error?.message||('خطأ '+r.status));e.status=r.status;throw e}return d.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')||'';
    }
    if(c.compat==='claude'){
      const r=await fetch(c.baseUrl,{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:m,max_tokens:Math.min(maxTok,c.maxTokens||maxTok),...(claudeSamplingOK(m)?{temperature:temp}:{}),system:'أخرج JSON فقط.',messages:[{role:'user',content:image?[{type:'image',source:{type:'base64',media_type:image.type,data:image.b64}},{type:'text',text:systemText}]:systemText}]}),signal});
      const d=await r.json();if(!r.ok){const e=new Error(d.error?.message||('خطأ '+r.status));e.status=r.status;throw e}return d.content?.map(x=>x.text||'').join('')||'';
    }
    const body={model:m,messages:[{role:'system',content:'أخرج JSON صالحاً فقط دون markdown أو شرح.'},{role:'user',content:image?[{type:'image_url',image_url:{url:`data:${image.type};base64,${image.b64}`}},{type:'text',text:systemText}]:systemText}],temperature:temp,max_tokens:Math.min(maxTok,c.maxTokens||maxTok)};
    const reasoning=aiNoTemp(p,m);if(c.tokenParam&&c.tokenParam!=='max_tokens'){body[c.tokenParam]=body.max_tokens;delete body.max_tokens}if(reasoning)delete body.temperature;if(reasoning&&p==='groq'&&/gpt-oss/.test(m))body.reasoning_effort='low';
    const r=await fetch(c.baseUrl,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify(body),signal});const d=await r.json();if(!r.ok){const e=new Error(d.error?.message||('خطأ '+r.status));e.status=r.status;throw e}return d.choices?.[0]?.message?.content||'';
  };
  const req0=request;   // كل محاولة تُعلن مزوّدها وموديلها
  const requestShown=async(p,key)=>{ const c=readingAIConfig(p), m=(p===provider?model:(localStorage.getItem('ai_model_'+p)||c.defaultModel));
    const via=p!==provider?{from:provider,why:aiErrShort(firstErr)}:null;
    aiUse('run',p,m,null,via); try{ const out=await req0(p,key); aiUse('ok',p,m,null,via); return out; }catch(e){ if(e?.name!=='AbortError') aiUse('err',p,m,e); throw e; } };
  let firstErr;   // خطأ المزوّد المختار نفسه — كان يضيع فيظهر «فشلت جميع المحاولات» أو ينجح الاختبار بمزوّد آخر
  try{return await requestShown(provider,current)}catch(e){if(e?.name==='AbortError')throw e;firstErr=e;if(e?.status===401||e?.status===429){const next=raiRotateKey(provider,current);if(next){try{return await requestShown(provider,next)}catch(e2){if(e2?.name==='AbortError')throw e2;firstErr=e2}}}}
  if(opts&&opts.noFallback) throw firstErr||new Error('فشل الطلب');
  // احتياطي تلقائي بين المزوّدات التي لديها مفاتيح، كما في الألعاب.
  const order=[provider,'gemini','claude','openai','openrouter','groq'].filter((p,i,a)=>a.indexOf(p)===i);
  let lastErr;
  for(const p of order){if(p===provider)continue;const k=readingAIGetKey(p);if(!k)continue;try{return await requestShown(p,k)}catch(e){if(e?.name==='AbortError')throw e;lastErr=e}}
  throw firstErr||lastErr||new Error('فشلت جميع محاولات الذكاء الاصطناعي');
}

/* ترميم أخطاء JSON الشائعة من نماذج الذكاء، مع احترام النصوص الموجودة بين علامات التنصيص:
   قيمة نصية بلا تنصيص ("answer": زمن)، علامات تنصيص ذكية “…”، فواصل زائدة قبل } أو ]. */
function aiRepairJson(src){
  const s=String(src).replace(/[\u201C\u201D\u201E\u201F\u2033]/g,'"');
  let out='', i=0;
  const n=s.length, isStop=c=>c===','||c==='}'||c===']'||c==='\n'||c==='\r';
  while(i<n){
    const c=s[i];
    if(c==='"'){                                 // نص صحيح: انسخه كما هو
      let j=i+1;
      while(j<n && s[j]!=='"'){ if(s[j]==='\\') j++; j++; }
      out+=s.slice(i,j+1); i=j+1; continue;
    }
    if('{}[]:,'.includes(c) || /\s/.test(c)){ out+=c; i++; continue; }
    let j=i; while(j<n && !isStop(s[j])) j++;        // قيمة عارية حتى الفاصل التالي
    const tok=s.slice(i,j).trim();
    out+= /^(true|false|null|-?\d+(\.\d+)?([eE][+-]?\d+)?)$/.test(tok) ? tok : JSON.stringify(tok);
    out+=s.slice(i,j).match(/\s*$/)[0];
    i=j;
  }
  return out.replace(/,(\s*[}\]])/g,'$1');
}

function rdNormAr(s){
  return String(s??'').replace(/[\u064B-\u0652\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
    .replace(/[.,،؛:!?؟"'«»()\[\]]/g,'').replace(/\s+/g,' ').trim();
}

/* ═══════════════ 🤖 مولّد أسئلة النشاط العادي ═══════════════ */
let __normalAIAbort = null;

function normalAIGetPrefs(){
  let typePrefs={}, meta={}, rules={};
  try{ typePrefs=JSON.parse(localStorage.getItem('qg_type_prefs_v1')||'{}')||{}; }catch{}
  try{ meta=JSON.parse(localStorage.getItem('qg_metadata_v1')||'{}')||{}; }catch{}
  try{ rules=JSON.parse(localStorage.getItem('prompt_rules_v1')||'{}')||{}; }catch{}
  return {typePrefs,meta,rules};
}

function normalAITypeDefaults(){
  // الافتراضي في مولّد النشاط: اختيار متعدد + صح/خطأ فقط.
  // لا نفعّل بقية الأنواع تلقائياً لأنها توسّع النموذج وتزيد مساحة الصفحة.
  return ['quiz','truefalse'];
}


/* ═══════════════ مصدر أسئلة الألعاب — قابل للتوسع ═══════════════ */
/* بناء واحد لكل ألعاب الاختيار من متعدد: تقبل أي سؤال صالح (خياران فأكثر) */
function buildMcqPool(questions, want, max){
  const pool = (questions || []).filter(q =>
    q && q.t === 'q' && Array.isArray(q.o) && q.o.filter(Boolean).length >= 2 &&
    Number.isInteger(Number(q.a)) && Number(q.a) >= 0 && Number(q.a) < q.o.length
  );
  const n = Math.max(2, Math.min(max, Number(want) || max));
  return pool.slice(0, n).map((q, i) => ({ q: q.q, o: q.o.slice(), a: Number(q.a), key: i }));
}

function buildMemoryPool(questions, want, max){
  const explicit = (questions || [])
    .filter(q => q && q.t === 'memory')
    .map(q => String(q.word || '').trim()).filter(Boolean);
  const fromQuiz = (questions || [])
    .filter(q => q && q.t === 'q' && Array.isArray(q.o) && q.o.filter(Boolean).length >= 2)
    .map(q => String(q.o[Number(q.a) || 0] || '').trim()).filter(Boolean);
  const n = Math.max(2, Math.min(max, Number(want) || max));
  return [...new Set([...explicit, ...fromQuiz])].slice(0, n);
}

/* المحوّلات تُشتق من GAME_TYPE_META حتى لا تتفرق الحدود بين ملفين */
const GAME_SOURCE_ADAPTERS = Object.fromEntries(
  Object.entries(GAME_TYPE_META).map(([k, m]) => [k, {
    label: m.label, min: m.min, max: m.max,
    build(questions, context = {}) {
      return m.mcq
        ? buildMcqPool(questions, context.requestedCount, m.max)
        : buildMemoryPool(questions, context.requestedCount, m.max);
    }
  }])
);

function gameAdapter(type) {
  const key = String(type || '').toLowerCase();
  return GAME_SOURCE_ADAPTERS[key] || null;
}


function buildGameFromQuestionBank(type, questions, requestedCount) {
  const adapter = gameAdapter(type);
  if (!adapter) {
    throw new Error(`لا يوجد محوّل أسئلة للعبة "${type}".`);
  }

  const want = Math.min(adapter.max, Math.max(adapter.min, Number(requestedCount) || adapter.max));
  const data = adapter.build(Array.isArray(questions) ? questions : [], { requestedCount: want });

  if (!Array.isArray(data) || data.length < adapter.min) {
    throw new Error(`لا توجد أسئلة كافية لبناء ${adapter.label} — المطلوب ${adapter.min} عناصر على الأقل.`);
  }

  return data.slice(0, want);
}

/* «رهان الرقائق» أُلغيت — الرهان سلوك لا نريد تعليمه. بياناتها أسئلة اختيار
   عادية، فتتحول تلقائيًا إلى «اضرب الخُلد» بدل أن تُفقد من النشاط. */
function normalizeGameType(type) {
  const raw = String(type || '').toLowerCase();
  const key = GAME_TYPE_ALIAS[raw] || raw;
  return GAME_SOURCE_ADAPTERS[key] ? key : 'memory';
}

/* ═══════ 🤖 مولّد محتوى النشاط: بنك أسئلة + محتوى لعبة، بمسار مراجعة ثم اعتماد ═══════ */
const NAI_BANK_LABELS={
  quiz:'اختيار متعدد', truefalse:'صح/خطأ', fillblank:'أكمل الفراغ',
  anagram:'رتّب الحروف', sentence:'رتّب الجملة', match:'وصّل'
};
let AI_STAGE=null;   // { id, bank, game, mode }  ← ناتج معروض لم يُعتمد بعد

function openNormalAIGenerator(id, gameTypeHint, gameSlot){
  const h=HW.find(x=>x.id===id) ||
    (EXAM_AI_ACTIVE_PROXY && EXAM_AI_ACTIVE_PROXY.id===id ? EXAM_AI_ACTIVE_PROXY : null);
  if(!h) return;
  const existingGames=activityGames(h);
  const slotDefault=Number.isInteger(gameSlot)&&gameSlot>=0&&gameSlot<existingGames.length?gameSlot
                   :(existingGames.length?0:-1);
  const prefs=normalAIGetPrefs(), meta=prefs.meta;
  const counts=prefs.typePrefs.counts||{};
  const gamesKind=isGamesKind(h);
  const wantsGame=!!gameTypeHint || gamesKind || existingGames.length>0;
  const gameType=normalizeGameType(gameTypeHint||h.game?.type||'memory');
  const gameCount=Math.max(gameMeta(gameType).min, Math.min(gameMeta(gameType).max,
    Number(counts[gameType]) || (gameType==='lock'?5:6)));
  const defaults=gamesKind?['quiz']:normalAITypeDefaults();
  const defCount=k=>Math.max(0,Math.min(20,Number(counts[k])|| (k==='quiz'?5:k==='truefalse'?5:0)));

  const qtyRow=(k,l)=>{
    const on=defaults.includes(k);
    return `<div class="qty${on?' on':''}" id="nai-row-${k}">
      <label><input type="checkbox" id="nai-${k}" ${on?'checked':''} onchange="naiQtyToggle('${k}')"><span>${l}</span></label>
      <div class="stepper">
        <button type="button" onclick="naiQtyStep('${k}',-1)" aria-label="أقل">−</button>
        <input type="number" min="0" max="20" id="nai-count-${k}" value="${defCount(k)}" oninput="naiQtySync('${k}')">
        <button type="button" onclick="naiQtyStep('${k}',1)" aria-label="أكثر">+</button>
      </div>
    </div>`;
  };

  const d=document.createElement('div');d.className='reading-ai-backdrop';d.id='normal-ai-modal';
  d.innerHTML=`<div class="reading-ai-card">
    <div class="reading-ai-head">
      <div style="font-size:1.5rem">✦</div>
      <h3>${gamesKind?'توليد بنك الأسئلة واللعبة':'توليد أسئلة النشاط'} — ${esc(h.title||'')}
        <span style="font-size:.68rem;font-weight:700;opacity:.5">build v15</span></h3>
    </div>

    <details class="nai-ctx">
      <summary>سياق الدرس <span id="nai-ctx-sum" style="font-weight:600"></span></summary>
      <div class="reading-ai-grid">
        <div class="field"><label>الموضوع / المحور</label><input class="inp" id="nai-topic" value="${esc(meta['qg-topicInput']||'')}" placeholder="مثال: التكيف" oninput="naiCtxSummary()"></div>
        <div class="field"><label>المادة</label><input class="inp" id="nai-subject" value="${esc(meta['qg-subjectInput']||rcGet('subject')||'علوم')}" oninput="naiCtxSummary()"></div>
        <div class="field"><label>المرحلة</label><select class="inp" id="nai-stage" onchange="naiCtxSummary()">${['ابتدائي','متوسط','ثانوي'].map(x=>`<option ${x===(meta['qg-stageSelect']||'متوسط')?'selected':''}>${x}</option>`).join('')}</select></div>
        <div class="field"><label>الصف</label><select class="inp" id="nai-grade" onchange="naiCtxSummary()"></select></div>
        <div class="field"><label>الفصل الدراسي</label><select class="inp" id="nai-term" onchange="naiCtxSummary()">${['الأول','الثاني','الثالث'].map(x=>`<option ${x===(meta['qg-termSelect']||'الأول')?'selected':''}>${x}</option>`).join('')}</select></div>
        <div class="field"><label>الصعوبة</label><select class="inp" id="nai-diff" onchange="naiCtxSummary()"><option value="easy">سهلة</option><option value="medium" selected>متوسطة</option><option value="hard">صعبة</option></select></div>
      </div>
    </details>

    <div class="nai-step">
      <h4><span class="n">1</span> محتوى الدرس <span class="hint">أساس جودة الأسئلة</span></h4>
      <textarea class="inp" id="nai-content" rows="4" placeholder="ألصق ملخص الدرس أو أهم المفاهيم هنا..."></textarea>
      <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-top:.5rem">
        <label class="ai-btn sm quiet" id="nai-pdf-btn" style="cursor:pointer"><span class="ai-mark">📄</span> استخراج من PDF
          <input type="file" accept="application/pdf,.pdf" style="display:none" onchange="normalAIExtractPdfText(this)"></label>
        <span id="nai-pdf-status" style="font-size:.76rem;color:var(--ink-soft)"></span>
      </div>
    </div>

    <div class="nai-step">
      <h4><span class="n">2</span> بنك الأسئلة <span class="hint">النوع وعدده معًا</span></h4>
      <div class="qty-list">${Object.entries(NAI_BANK_LABELS).map(([k,l])=>qtyRow(k,l)).join('')}</div>
    </div>

    <div class="nai-step">
      <h4><span class="n">3</span> لعبة الطالب
        <label class="row" style="margin-inline-start:auto;gap:.4rem;font-size:.78rem;font-weight:700;cursor:pointer">
          <input type="checkbox" id="nai-game-on" ${wantsGame?'checked':''} onchange="naiGameToggle()"> مفعّلة
        </label>
      </h4>
      <div id="nai-game-box" style="display:${wantsGame?'block':'none'}">
        <div class="nai-game">
          <div class="field" style="margin:0"><label>نوع اللعبة</label>
            <select class="inp" id="nai-game-type" onchange="naiGameTypeChanged()">
              ${Object.keys(GAME_TYPE_META).map(k=>`<option value="${k}" ${gameType===k?'selected':''}>${GAME_TYPE_META[k].label}</option>`).join('')}
            </select></div>
          <div class="field" style="margin:0"><label>العدد</label>
            <div class="stepper">
              <button type="button" onclick="naiGameStep(-1)" aria-label="أقل">−</button>
              <input type="number" id="nai-game-count" min="2" max="${gameMeta(gameType).max}" value="${gameCount}">
              <button type="button" onclick="naiGameStep(1)" aria-label="أكثر">+</button>
            </div></div>
        </div>
        ${existingGames.length?`<div class="field" style="margin:.5rem 0 0"><label>وجهة الناتج</label>
          <select class="inp" id="nai-game-slot">
            ${existingGames.map((g,i)=>`<option value="${i}" ${i===slotDefault?'selected':''}>استبدال: ${gameTypeLabel(g.type)} ${i+1} (${(g.data||[]).length})</option>`).join('')}
            ${existingGames.length<MAX_GAMES_PER_ACTIVITY?`<option value="-1" ${slotDefault<0?'selected':''}>➕ أضفها كلعبة جديدة في نفس النشاط</option>`:''}
          </select></div>`:''}
        <div id="nai-game-hint" style="font-size:.75rem;color:var(--ink-soft);margin-top:.45rem"></div>
      </div>
    </div>

    <div class="reading-ai-status" id="nai-status"></div><div class="reading-ai-result" id="nai-result"></div>
    <div class="modal-foot" id="nai-foot">
      <button class="btn ghost" onclick="naiClose()">إلغاء</button>
      <button class="ai-btn solid" id="nai-generate" onclick="naiRun('${id}')"><span class="ai-mark">✦</span> ابدأ التوليد</button>
    </div>
    <p class="reading-ai-note" style="margin:.5rem 0 0">توليد ← مراجعة ← اعتماد وحفظ ← نشر. لا شيء يصل الطالب قبل الاعتماد والنشر.</p>
  </div>`;
  document.body.appendChild(d);
  const stageEl=document.getElementById('nai-stage'),gradeEl=document.getElementById('nai-grade');
  const grades=()=>{const vals=stageEl.value==='ابتدائي'?['الأول','الثاني','الثالث','الرابع','الخامس','السادس']:['الأول','الثاني','الثالث'];gradeEl.innerHTML=vals.map(x=>`<option ${x===(meta['qg-gradeSelect']||'الأول')?'selected':''}>${x}</option>`).join('')};
  stageEl.addEventListener('change',grades);grades();
  const ds=meta['qg-diffSelect'];if(ds&&['easy','medium','hard'].includes(ds))document.getElementById('nai-diff').value=ds;
  naiGameTypeChanged();
  naiCtxSummary();
  setTimeout(()=>document.getElementById('nai-content')?.focus(),80);
}

/* ملخص السياق في سطر واحد: المعلم يراه دون فتح الخانات الست */
function naiCtxSummary(){
  const g=id=>document.getElementById(id)?.value||'';
  const el=document.getElementById('nai-ctx-sum');
  if(!el) return;
  const diff={easy:'سهلة',medium:'متوسطة',hard:'صعبة'}[g('nai-diff')]||'';
  el.textContent='— '+[g('nai-subject'),g('nai-stage'),'الصف '+g('nai-grade'),diff,g('nai-topic')]
    .filter(x=>x&&x!=='الصف ').join(' · ');
}

/* الحد الأعلى للعدد: ٢٠ في النشاط، و٤٠ عند التوليد لاختبار ورقي (القالب ٤ أو عدة نماذج تحتاج أكثر) */
function naiMaxCount(){ return (typeof EXAM_AI_ACTIVE_PROXY!=='undefined' && EXAM_AI_ACTIVE_PROXY) ? 40 : 20; }
function naiGameTypeChanged(){
  const t=normalizeGameType(document.getElementById('nai-game-type')?.value||'memory');
  const cnt=document.getElementById('nai-game-count');
  const hint=document.getElementById('nai-game-hint');
  if(cnt){
    cnt.max=gameMeta(t).max;
    if(Number(cnt.value)>gameMeta(t).max) cnt.value=gameMeta(t).max;
    if(Number(cnt.value)<gameMeta(t).min) cnt.value=gameMeta(t).min;
  }
  const m=gameMeta(t);
  if(hint) hint.textContent = isMcqGameType(t)
    ? `${m.hint} — تُبنى من أسئلة الاختيار من متعدد نفسها (${m.min}–${m.max}).`
    : `${m.hint} — تُولَّد الكلمات مباشرة، وإن نقصت تُكمَّل من الإجابات الصحيحة (حتى ${m.max}).`;
}


/* ═══════════════ 📖 بناء النص القرائي الأساسي من PDF ═══════════════ */
function readingAIParseObject(raw){
  let x=String(raw||'').replace(/```json|```/gi,'').trim();
  const a=x.indexOf('{'), b=x.lastIndexOf('}');
  if(a>=0 && b>a) x=x.slice(a,b+1);
  const d=JSON.parse(x);
  if(!d || !Array.isArray(d.sections)) throw new Error('الناتج المنظم لا يحتوي على أقسام صالحة');
  return d;
}

/* يحفظ رقم فقرة الدليل ومهارة السؤال عند تعديل المهام يدويًا */
function readingRowExtra(r, stage){
  const o={stage};
  const ev=parseInt(r.dataset.ev,10); if(ev>0) o.ev=ev;
  if(r.dataset.sk) o.sk=r.dataset.sk;
  return o;
}

/* ═══ 🤖 مولدات الأنشطة المتبقية: تشخيصي + أنماط تعلم + تجارب ═══ */
function aiSafeJson(raw){
  let t=String(raw||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  const a=t.indexOf('{'), b=t.lastIndexOf('}');
  if(a>=0 && b>a) t=t.slice(a,b+1);
  try{return JSON.parse(t)}catch(e){}
  const aa=t.indexOf('['), bb=t.lastIndexOf(']');
  if(aa>=0 && bb>aa){ try{return JSON.parse(t.slice(aa,bb+1))}catch(e){} }
  throw new Error('استجابة الذكاء ليست JSON صالحًا');
}