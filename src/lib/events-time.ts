export type EventTiming = {startDate:string;endDate:string;startAt:string|null;endAt:string|null;timeZone:string;status:string};
export type EventPhase = 'upcoming'|'ongoing'|'ended'|'cancelled';
export const eventPhaseNames = {upcoming:'即将举行',ongoing:'活动日期内',ended:'已结束',cancelled:'已取消'};
export function localEventDate(timeZone:string, now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=(type:string)=>parts.find(p=>p.type===type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function eventPhase(event:EventTiming, now=new Date()):EventPhase {
  if(event.status==='cancelled')return 'cancelled';
  const today=localEventDate(event.timeZone,now);
  if(event.endAt ? now.getTime()>=Date.parse(event.endAt) : today>event.endDate)return 'ended';
  if(event.startAt ? now.getTime()<Date.parse(event.startAt) : today<event.startDate)return 'upcoming';
  return 'ongoing';
}
const dayNumber=(date:string)=>Date.parse(date+'T00:00:00Z')/86400000;
function duration(target:string,now:Date) {
  const minutes=Math.max(1,Math.ceil((Date.parse(target)-now.getTime())/60000));
  const days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),rest=minutes%60;
  return `${days?`${days} 天 `:''}${hours?`${hours} 小时 `:''}${rest||(!days&&!hours)?`${rest} 分钟`:''}`.trim();
}
export function eventCountdown(event:EventTiming,now=new Date()) {
  const phase=eventPhase(event,now);
  if(phase==='cancelled')return '活动已取消';
  if(phase==='ended')return '活动已结束';
  if(phase==='ongoing')return event.startAt&&event.endAt?'活动进行中':event.startDate===event.endDate?'活动当天':'活动日期内';
  if(event.startAt)return `距开始 ${duration(event.startAt,now)}`;
  return `距活动 ${Math.max(0,dayNumber(event.startDate)-dayNumber(localEventDate(event.timeZone,now)))} 天（当地日期）`;
}
export function registrationCountdown(event:EventTiming,registration:{status:string;deadline:string|null},now=new Date()) {
  if(event.status==='cancelled')return '活动已取消';
  if(registration.status==='closed')return '报名已结束';
  if(!registration.deadline)return '报名截止未确认';
  if(registration.deadline.length===10) {
    const days=dayNumber(registration.deadline)-dayNumber(localEventDate(event.timeZone,now));
    return days<0?'报名截止已过':days===0?'报名截止当天（当地日期）':`距报名截止 ${days} 天（当地日期）`;
  }
  return now.getTime()>=Date.parse(registration.deadline)?'报名截止已过':`距报名截止 ${duration(registration.deadline,now)}`;
}
