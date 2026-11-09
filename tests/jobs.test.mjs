import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateJobs, publicJobURL } from '../src/lib/jobs-store.mjs';
import { emptyJobsFilter, matchesJob, readJobsFilter, writeJobsFilter, effectiveJobStatus } from '../src/lib/jobs-filter.ts';
import { mountJobsIndex } from '../src/scripts/jobs-index.ts';
const job=()=>({schemaVersion:1,id:'test-role',company:'Example',title:'AI Infra Engineer',locations:['深圳','北京'],category:'sre',level:'3 年以上',summary:'测试样例，不是公开岗位。',skills:['SGLang','GPU'],url:'https://careers.example.com/jobs/test',sourceName:'官方招聘',sourceType:'official',status:'open',statusNote:'公开页面提供申请入口。',verifiedAt:'2026-11-09',postedAt:null,priority:'strong',matchReasons:['关注推理稳定性。'],gaps:['核对系统工程经验。'],publicationApproved:true,containsPrivateData:false});
test('jobs schema requires public scope, unique sources, exact dates and explicit unknown publication dates',()=>{
  assert.equal(validateJobs([job()]).length,1);
  for(const edit of [r=>r.schemaVersion=2,r=>r.id='../x',r=>r.publicationApproved=false,r=>r.containsPrivateData=true,r=>r.privateNotes='secret',r=>r.verifiedAt='2026-02-30',r=>r.verifiedAt='2099-01-01',r=>delete r.postedAt,r=>r.postedAt='2026-11-10',r=>r.status='hiring',r=>r.priority='best',r=>r.category='general',r=>r.sourceType='unknown',r=>r.locations=[],r=>r.gaps=[],r=>r.summary='<script>alert(1)</script>']) {const item=job();edit(item);assert.throws(()=>validateJobs([item]));}
  assert.throws(()=>validateJobs([job(),job()]));assert.throws(()=>validateJobs([job(),{...job(),id:'different'}]));
  assert.ok(validateJobs(JSON.parse(readFileSync(new URL('../src/content/jobs.json',import.meta.url),'utf8'))));
});
test('public jobs reject non-public or credential-bearing links, allow only stable public job IDs',()=>{
  assert.equal(publicJobURL('https://careers.tencent.com/en-us/jobdesc.html?postId=123'),'https://careers.tencent.com/en-us/jobdesc.html?postId=123');
  for(const url of ['http://example.com/jobs','javascript:alert(1)','https://user:pass@example.com/jobs','https://127.0.0.1/jobs','https://[::1]/jobs','https://internal/jobs','https://a.internal/jobs','https://a.nip.io/jobs','https://example.com:99/jobs','https://example.com/jobs?token=123','https://example.com/jobs?redirect=private','https://example.com/jobs?id=1&id=2'])assert.throws(()=>publicJobURL(url),url);
});
test('job search combines Unicode terms, cities, skills and independent filters; stale open roles need review',()=>{
  const record={search:'SGLang GPU Cache 缓存',locations:['深圳','北京'],category:'sre',status:'open',priority:'strong',sourceType:'official'};
  assert.ok(matchesJob(record,{...emptyJobsFilter,query:' ｓｇｌａｎｇ GPU 缓存 ',location:'北京',priority:'strong'}));
  for(const patch of [{query:'missing'},{location:'上海'},{status:'closed'},{priority:'stretch'},{sourceType:'community'},{category:'training'}])assert.equal(matchesJob(record,{...emptyJobsFilter,...patch}),false);
  assert.equal(effectiveJobStatus('open','2026-10-10','2026-11-09'),'open');assert.equal(effectiveJobStatus('open','2026-10-09','2026-11-09'),'review');assert.equal(effectiveJobStatus('closed','2020-01-01','2026-11-09'),'closed');
  const filter=readJobsFilter(new URLSearchParams('query=GPU&location=北京&status=bogus'),{location:['北京']});assert.equal(filter.location,'北京');assert.equal(filter.status,'all');
  const url=writeJobsFilter(new URL('https://example.com/LLMOpsGuide/jobs/?keep=1#top'),filter);assert.equal(url.searchParams.get('query'),'GPU');assert.equal(url.hash,'#top');assert.equal(writeJobsFilter(url,emptyJobsFilter).search,'?keep=1');
});
test('jobs controller restores URL, filters, clears focus, survives repeated actions and page history',()=>{
  class Element extends EventTarget {value='';hidden=false;textContent='';dataset={};options=[];focused=false;focus(){this.focused=true;}querySelector(){return null;}}
  const input=new Element(),count=new Element(),empty=new Element(),reset=new Element(),form=new Element();
  const nodes={'#jobs-query':input,'#jobs-count':count,'#jobs-empty':empty,'#jobs-reset':reset,form};
  for(const [key,values]of Object.entries({category:['all','sre','training'],location:['all','北京','深圳'],status:['all','open','review','closed'],priority:['all','strong','related','stretch'],sourceType:['all','official','community']})){const select=new Element();select.value='all';select.options=values.map(value=>({value}));nodes[`#jobs-${key}`]=select;}
  const records=[{search:'GPU SGLang',locations:['北京'],category:'sre',status:'open',priority:'strong',sourceType:'official'},{search:'Training',locations:['深圳'],category:'training',status:'review',priority:'stretch',sourceType:'official'}].map(data=>{const r=new Element();r.dataset={...data,locations:JSON.stringify(data.locations),verifiedAt:new Date().toISOString().slice(0,10),originalStatus:data.status};return r;});
  const root={querySelector:key=>nodes[key],querySelectorAll:()=>records};const saved=Object.fromEntries(['window','location','history'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  try {
    globalThis.window=new EventTarget();globalThis.location=new URL('https://example.com/LLMOpsGuide/jobs/?query=GPU&location=北京');globalThis.history={replaceState(_s,_t,url){globalThis.location=new URL(url);}};
    mountJobsIndex(root);assert.equal(input.value,'GPU');assert.equal(count.textContent,'1 个岗位');assert.ok(records[1].hidden);
    input.value='absent';input.dispatchEvent(new Event('input'));assert.equal(count.textContent,'0 个岗位');assert.equal(empty.hidden,false);
    reset.dispatchEvent(new Event('click'));reset.dispatchEvent(new Event('click'));assert.equal(count.textContent,'2 个岗位');assert.ok(input.focused);assert.equal(location.search,'');
    globalThis.location=new URL('https://example.com/LLMOpsGuide/jobs/?category=training');window.dispatchEvent(new Event('popstate'));assert.equal(count.textContent,'1 个岗位');assert.ok(records[0].hidden);
    globalThis.location=new URL('https://example.com/LLMOpsGuide/jobs/?sourceType=community');window.dispatchEvent(new Event('pageshow'));assert.equal(count.textContent,'0 个岗位');
    const event=new Event('submit',{cancelable:true});form.dispatchEvent(event);assert.ok(event.defaultPrevented);
  } finally {for(const [key,descriptor]of Object.entries(saved)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
