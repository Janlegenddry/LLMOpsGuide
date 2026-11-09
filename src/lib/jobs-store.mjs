import { isIP } from 'node:net';

export const jobCategoryNames = { inference: '推理引擎与服务', sre: 'AI Infra SRE', platform: 'AI 平台与分布式系统', training: '训练基础设施', kernel: 'GPU 与算子优化' };
export const jobPriorityNames = { strong: '重点关注', related: '方向相关', stretch: '拓展方向' };
export const jobStatusNames = { open: '核验时可申请', review: '待复核', closed: '已结束' };
export const jobSourceNames = { official: '官方招聘', board: '公开招聘平台', community: '公开社区' };
const fail = message => { throw new Error(`社招岗位：${message}`); };
const text = (v, name, max=500) => {
  if(typeof v !== 'string' || !v.trim() || v.length > max || /[<>\u0000-\u001f]|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN .*PRIVATE KEY/.test(v)) fail(`${name} 必须为有效公开文本`);
  return v.trim();
};
const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v && v <= new Date().toISOString().slice(0,10);
export function publicJobURL(value) {
  let url; try { url = new URL(text(value,'来源链接',1200)); } catch { fail('来源必须为公开 HTTPS 链接'); }
  const host=url.hostname;
  if(url.protocol !== 'https:' || url.username || url.password || url.port || isIP(host.replace(/^\[|\]$/g,'')) || !host.includes('.') || /(?:^|\.)(localhost|local|internal|intranet|test|invalid|onion)$/.test(host) || /(?:^|\.)(nip\.io|sslip\.io|localtest\.me|lvh\.me)$/.test(host)) fail('来源不允许凭证、IP、内网地址或非 HTTPS 协议');
  const allowed=new Set(['postid','jobid','job_id','pid','id','gh_jid','positionid']);
  const seen=new Set();
  for(const [key,value] of url.searchParams) {if(!allowed.has(key.toLowerCase()) || seen.has(key.toLowerCase()) || !/^[a-zA-Z0-9_-]{1,160}$/.test(value)) fail('来源只允许公开岗位标识参数');seen.add(key.toLowerCase());}
  return url.href;
}
export function validateJobs(raw) {
  if(!Array.isArray(raw) || raw.length>1000) fail('目录必须为最多 1000 条的数组');
  const ids=new Set(), urls=new Set();
  const allowed=['schemaVersion','id','company','title','locations','category','level','summary','skills','url','sourceName','sourceType','status','statusNote','verifiedAt','postedAt','priority','matchReasons','gaps','publicationApproved','containsPrivateData'];
  return raw.map(item=>{
    if(!item || typeof item!=='object' || Object.keys(item).some(k=>!allowed.includes(k))) fail('包含未知字段');
    if(item.schemaVersion!==1 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id||'') || item.id.length>100 || ids.has(item.id)) fail('稳定 ID 无效或重复');ids.add(item.id);
    if(item.publicationApproved!==true || item.containsPrivateData!==false) fail('仅允许已授权公开且不含私人数据的岗位摘要');
    for(const [key,names] of [['category',jobCategoryNames],['priority',jobPriorityNames],['status',jobStatusNames],['sourceType',jobSourceNames]]) if(!Object.hasOwn(names,item[key]))fail(`${key} 无效`);
    if(!date(item.verifiedAt) || (item.postedAt!==null && !date(item.postedAt)) || (item.postedAt && item.postedAt>item.verifiedAt))fail('核验/发布日无效；未知发布日期须填 null');
    const record={...item};
    for(const key of ['company','title','level','summary','sourceName','statusNote']) record[key]=text(item[key],key,key==='summary'||key==='statusNote'?1000:220);
    for(const key of ['locations','skills','matchReasons','gaps']) {if(!Array.isArray(item[key])||!item[key].length||item[key].length>12)fail(`${key} 必须有 1–12 项`);record[key]=[...new Set(item[key].map(v=>text(v,key)))];}
    record.url=publicJobURL(item.url);if(urls.has(record.url))fail('同一岗位来源重复，请更新原 ID');urls.add(record.url);
    return record;
  }).sort((a,b)=>Object.keys(jobPriorityNames).indexOf(a.priority)-Object.keys(jobPriorityNames).indexOf(b.priority)||b.verifiedAt.localeCompare(a.verifiedAt)||a.id.localeCompare(b.id));
}
