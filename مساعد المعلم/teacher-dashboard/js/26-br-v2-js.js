/* 💬 رسالة ولي الأمر من التذكير الجماعي — النص المبني من حالة الطالب (remCompose.parent) */
async function brParent(id,how){
  const r=(BR.rows||[]).find(x=>String(x.s.id)===String(id)); if(!r) return; const t=r.pmsg;
  if(how==='wa') parWaOpen(r.s.id,t);
  else { try{ await navigator.clipboard.writeText(t); toast('📋 نُسخت رسالة ولي الأمر','good'); }catch(e){ prompt('انسخ الرسالة:',t); } }
  remLogAdd(r.s.id,'parent','bulk');
  try{ await ctSave(D=>{ D.contacts=Array.isArray(D.contacts)?D.contacts:[]; D.contacts.push({id:v2Id(),studentId:String(r.s.id),date:ctToday(),channel:how==='wa'?'واتساب':'رسالة نصية',reason:'تذكير بالأنشطة المتأخرة',result:'',at:Date.now()}); }); }catch(e){}
  brRender();
}
