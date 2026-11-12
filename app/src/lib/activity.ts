export interface LearningActivity { id: string; kind: 'lesson' | 'challenge'; date: string }
export const tehranDate = (date=new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export function activityBuckets(activity: LearningActivity[], period:'week'|'month', now=new Date()) {
  const count=period==='week'?7:4, width=period==='week'?1:7;
  return Array.from({length:count},(_,index)=>{
    const offset=(count-1-index)*width;
    const dates=Array.from({length:width},(_,day)=>tehranDate(new Date(now.getTime()-(offset+day)*86400000)));
    const label=period==='week'?new Intl.DateTimeFormat('fa-IR',{weekday:'narrow',timeZone:'Asia/Tehran'}).format(new Date(now.getTime()-offset*86400000)):`هفتهٔ ${(index+1).toLocaleString('fa-IR')}`;
    return {label,count:activity.filter(a=>a.kind==='lesson'&&dates.includes(a.date)).length};
  });
}
