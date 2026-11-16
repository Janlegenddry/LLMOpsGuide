import { isIP } from 'node:net';
export const eventFormatNames={'in-person':'线下',online:'线上',hybrid:'线上＋线下'};
export const eventScopeNames={local:'本地线下',online:'公开线上',archive:'已结束归档'};
export const registrationNames={qr:'官方页扫码报名',link:'官方报名入口',closed:'报名已结束',unconfirmed:'报名待确认'};
const fail=message=>{throw new Error(`AI Infra 活动：${message}`);};
const text=(value,name,max=1000)=>{
  if(typeof value!=='string'||!value.trim()||value.length>max||/[<>\u0000-\u001f]|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN .*PRIVATE KEY/.test(value))fail(`${name} 必须为公开纯文本`);
  return value.trim();
};
const exact=(obj,keys,name)=>{if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(obj,k)))fail(`${name} 字段不完整或包含未知字段`);};
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const instant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&date(value.slice(0,10))&&Number.isFinite(Date.parse(value))&&Number(value.slice(11,13))<24&&Number(value.slice(14,16))<60;
export function publicEventURL(value) {
  let url;try{url=new URL(text(value,'链接',1600));}catch{fail('必须是公开 HTTPS 链接');}
  const host=url.hostname;
  if(url.protocol!=='https:'||url.username||url.password||url.port||isIP(host.replace(/^\[|\]$/g,''))||!host.includes('.')||/(?:^|\.)(localhost|local|internal|intranet|test|invalid|onion|nip\.io|sslip\.io|localtest\.me|lvh\.me)$/.test(host))fail('链接不允许凭证、IP、内网或非 HTTPS');
  const allowed=new Set(['id','eventid','event_id','lang','format','isdark','title']),seen=new Set();
  for(const [key,val]of url.searchParams){if(!allowed.has(key.toLowerCase())||seen.has(key.toLowerCase())||!/^[\p{L}\p{N} _./:-]{1,160}$/u.test(val))fail('链接包含非公开标识或展示参数');seen.add(key.toLowerCase());}
  if(url.hash&&!/^#[A-Za-z][A-Za-z0-9_-]{0,100}$/.test(url.hash))fail('链接锚点不得包含身份或访问参数');
  return url.href;
}
function validateMedia(item,name) {
  exact(item,['status','url','publicAccess','note'],name);
  if(!['unconfirmed','pending','available'].includes(item.status)||typeof item.publicAccess!=='boolean')fail(`${name} 状态无效`);
  if(item.status==='available'?(item.url===null||item.publicAccess!==true):(item.url!==null||item.publicAccess!==false))fail(`${name} 可观看状态必须有已核验的公开入口；未知不能填链接`);
  return {...item,url:item.url===null?null:publicEventURL(item.url),note:text(item.note,name)};
}
export function validateEvents(raw, now=new Date()) {
  if(!Array.isArray(raw)||raw.length>1000)fail('必须为最多1000条的数组');
  const ids=new Set(),urls=new Set();
  return raw.map(item=>{
    exact(item,['schemaVersion','id','title','organizer','scope','region','scopeNote','archiveExceptionApproved','status','startDate','endDate','startAt','endAt','timeZone','format','city','venue','address','summary','topics','officialUrl','agendaUrl','registration','livestream','replay','sources','verifiedAt','publicationApproved','containsPrivateData'],'活动');
    if(item.schemaVersion!==1||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id)||item.id.length>100||ids.has(item.id))fail('稳定ID无效或重复');ids.add(item.id);
    if(item.publicationApproved!==true||item.containsPrivateData!==false)fail('仅可发布已授权且不含私人资料的活动');
    if(!Object.hasOwn(eventScopeNames,item.scope)||!Object.hasOwn(eventFormatNames,item.format)||!['scheduled','cancelled'].includes(item.status)||typeof item.archiveExceptionApproved!=='boolean')fail('范围、参与方式或活动状态无效');
    if(!date(item.startDate)||!date(item.endDate)||item.endDate<item.startDate||!date(item.verifiedAt)||item.verifiedAt>now.toISOString().slice(0,10))fail('日期无效；活动日与核验日分别记录');
    if(typeof item.timeZone!=='string'||!(item.timeZone==='UTC'||/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(item.timeZone)))fail('必须使用明确的IANA时区');
    let formatter;try{formatter=new Intl.DateTimeFormat('en-CA',{timeZone:item.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});}catch{fail('时区无效');}
    for(const [key,day]of [['startAt',item.startDate],['endAt',item.endDate]])if(item[key]!==null){
      if(!instant(item[key]))fail('公开时刻必须有明确UTC偏移；未知填null');
      const parts=formatter.formatToParts(new Date(item[key])),part=t=>parts.find(p=>p.type===t).value;
      if(`${part('year')}-${part('month')}-${part('day')}`!==day||`${part('hour')}:${part('minute')}`!==item[key].slice(11,16))fail('时刻、当地日期与时区不一致');
    }
    if(item.startAt&&item.endAt&&Date.parse(item.endAt)<=Date.parse(item.startAt))fail('结束时刻必须晚于开始');
    const record={...item};
    for(const key of ['title','organizer','scopeNote','city','venue','summary'])record[key]=text(item[key],key,key==='summary'?1000:300);
    record.address=item.address===null?null:text(item.address,'地址');
    if(!Array.isArray(item.topics)||!item.topics.length||item.topics.length>12)fail('主题须有1–12项');record.topics=[...new Set(item.topics.map(v=>text(v,'主题',100)))];
    record.officialUrl=publicEventURL(item.officialUrl);if(urls.has(record.officialUrl))fail('同一官方活动请更新原ID');urls.add(record.officialUrl);
    record.agendaUrl=item.agendaUrl===null?null:publicEventURL(item.agendaUrl);
    exact(item.registration,['status','url','deadline','note'],'报名');
    if(!Object.hasOwn(registrationNames,item.registration.status)||(!['closed','unconfirmed'].includes(item.registration.status)&&item.registration.url===null))fail('报名状态与入口不一致');
    const deadline=item.registration.deadline;
    if(deadline!==null&&!date(deadline)&&!instant(deadline))fail('报名截止未知须为null，已知须为真实日期或带偏移的时刻');
    record.registration={...item.registration,url:item.registration.url===null?null:publicEventURL(item.registration.url),note:text(item.registration.note,'报名说明')};
    record.livestream=validateMedia(item.livestream,'直播');record.replay=validateMedia(item.replay,'回放');
    const localCities={hangzhou:'杭州',shenzhen:'深圳',shanghai:'上海'};
    if(item.scope==='local'){
      if(!['hangzhou','hangzhou-nearby','shenzhen','shanghai'].includes(item.region)||item.format==='online'||item.archiveExceptionApproved)fail('本地线下仅杭州、杭州周边、深圳、上海');
      if(item.region!=='hangzhou-nearby'&&record.city!==localCities[item.region])fail('本地城市与收录区域不一致');
    }else if(item.scope==='online'){
      if(item.region!==null||item.format==='in-person'||!record.livestream.publicAccess||record.livestream.status!=='available'||item.archiveExceptionApproved)fail('地区不限须已核验公开直播，不能用会场转播或待发布回放代替');
    }else{
      const parts=formatter.formatToParts(now),part=t=>parts.find(p=>p.type===t).value;
      const today=`${part('year')}-${part('month')}-${part('day')}`;
      const ended=item.endAt?Date.parse(item.endAt)<=now.getTime():item.endDate<today;
      if(item.region!==null||!item.archiveExceptionApproved||!ended)fail('国际归档例外须明确授权且已按当地时间结束');
    }
    if(!Array.isArray(item.sources)||!item.sources.length||item.sources.length>8)fail('须保留1–8个官方证据链接');
    record.sources=item.sources.map(source=>{exact(source,['title','url'],'来源');return {title:text(source.title,'来源标题',200),url:publicEventURL(source.url)};});
    if(!record.sources.some(s=>s.url===record.officialUrl))fail('来源须包含官方活动页');
    return record;
  }).sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.id.localeCompare(b.id));
}
