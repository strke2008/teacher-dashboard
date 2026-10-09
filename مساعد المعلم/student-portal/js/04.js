/* 📚 مدرستي تُغلق الواجب في موعده (لا سماح فيها): نص «يُغلق اليوم 11:59 م / غدًا / الأحد 12/10» بتوقيت السعودية */
function madCloseText(dueAt){
  if(!dueAt) return '';
  const tz={timeZone:'Asia/Riyadh'}, d=new Date(dueAt), now=new Date();
  const key=x=>x.toLocaleDateString('en-CA',tz);
  const diff=Math.round((Date.parse(key(d))-Date.parse(key(now)))/864e5);
  const time=d.toLocaleTimeString('ar-SA',{...tz,hour:'numeric',minute:'2-digit'});
  const day=diff===0?'اليوم':diff===1?'غدًا':d.toLocaleDateString('ar-SA-u-ca-gregory',{...tz,weekday:'long',day:'numeric',month:'numeric'});
  return `يُغلق ${day} الساعة ${time}`;
}
