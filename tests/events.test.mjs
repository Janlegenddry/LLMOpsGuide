import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateEvents, publicEventURL } from '../src/lib/events-store.mjs';
import { eventCountdown, eventPhase, localEventDate, registrationCountdown } from '../src/lib/events-time.ts';
import { emptyEventsFilter, matchesEvent, readEventsFilter, writeEventsFilter } from '../src/lib/events-filter.ts';
import { mountEventsIndex } from '../src/scripts/events-index.ts';
const source=JSON.parse(readFileSync(new URL('../src/content/events.json',import.meta.url),'utf8'));
const fixture=()=>({...structuredClone(source[0]),verifiedAt:'2026-11-01'});
const at=value=>new Date(value);
test('event input keeps unknown times explicit and rejects broken dates, private data, unknown fields and duplicate events',()=>{
  assert.equal(validateEvents(source).length,2);
  assert.equal(validateEvents([{...fixture(),startAt:null,endAt:null}])[0].startAt,null);
  for(const edit of [r=>r.schemaVersion=2,r=>r.id='../bad',r=>r.publicationApproved=false,r=>r.containsPrivateData=true,r=>r.privateNotes='not public',r=>r.startDate='2026-02-30',r=>r.endDate='2026-11-01',r=>r.startAt='2026-11-28T09:00:00',r=>r.startAt='2026-11-28T09:00:00-08:00',r=>r.startAt='2026-11-28T25:00:00+08:00',r=>r.endAt=r.startAt,r=>r.timeZone='CST',r=>r.timeZone='Mars/Olympus',r=>r.verifiedAt='2099-01-01',r=>r.topics=[],r=>r.sources=[],r=>r.summary='<script>bad</script>',r=>delete r.registration.deadline,r=>r.registration.deadline='2026-02-30',r=>r.livestream.url='https://example.com/watch',r=>r.replay.status='available']){const r=fixture();edit(r);assert.throws(()=>validateEvents([r]));}
  assert.throws(()=>validateEvents([fixture(),fixture()]));assert.throws(()=>validateEvents([fixture(),{...fixture(),id:'other-id'}]));
});
test('local, publicly watchable and approved ended exceptions are separate admission rules',()=>{
  const beijing={...fixture(),city:'北京',region:'beijing'};assert.throws(()=>validateEvents([beijing]));
  assert.throws(()=>validateEvents([{...beijing,region:'hangzhou'}]));
  const online={...fixture(),scope:'online',region:null,format:'online',city:'线上',venue:'官方公开直播',address:null};
  assert.throws(()=>validateEvents([online]));
  online.livestream={status:'available',url:'https://example.com/live',publicAccess:true,note:'已核验的公开直播入口。'};
  assert.equal(validateEvents([online])[0].scope,'online');
  const archive={...structuredClone(source[1]),verifiedAt:'2026-11-01'};
  assert.throws(()=>validateEvents([{...archive,archiveExceptionApproved:false}]));
  assert.throws(()=>validateEvents([archive],at('2026-11-14T04:00:00Z')),/按当地时间结束/);
  assert.equal(validateEvents([archive],at('2026-11-14T08:00:00Z'))[0].scope,'archive');
});
test('event URLs accept official presentation links but reject credential, internal, tracking and redirect URLs',()=>{
  assert.equal(publicEventURL(source[0].agendaUrl),source[0].agendaUrl);
  assert.equal(publicEventURL('https://www.sglang.io/summit#agenda'),'https://www.sglang.io/summit#agenda');
  for(const value of ['http://example.com/event','javascript:alert(1)','https://user:pass@example.com/event','https://127.0.0.1/event','https://[::1]/event','https://localhost/event','https://a.internal/event','https://127.0.0.1.nip.io/event','https://example.com:8080/event','https://example.com/event?token=secret','https://example.com/event?redirect=private','https://example.com/event?id=1&id=2','https://example.com/event#token=secret'])assert.throws(()=>publicEventURL(value),value);
});
test('known Shanghai times transition at the exact instant, without negative countdowns',()=>{
  const event=fixture();
  assert.equal(eventCountdown(event,at('2026-11-27T01:00:00Z')),'距开始 1 天');
  assert.equal(eventCountdown(event,at('2026-11-28T00:59:59Z')),'距开始 1 分钟');
  assert.equal(eventPhase(event,at('2026-11-28T01:00:00Z')),'ongoing');
  assert.equal(eventCountdown(event,at('2026-11-28T01:00:00Z')),'活动进行中');
  assert.equal(eventCountdown(event,at('2026-11-28T10:00:00Z')),'活动已结束');
  assert.equal(eventCountdown({...event,status:'cancelled'},at('2026-11-01T00:00:00Z')),'活动已取消');
});
test('date-only countdowns use the local calendar, including Pacific midnight and DST days',()=>{
  const event={...fixture(),startDate:'2026-11-12',endDate:'2026-11-13',startAt:null,endAt:null,timeZone:'America/Los_Angeles'};
  assert.equal(localEventDate(event.timeZone,at('2026-11-12T07:59:59Z')),'2026-11-11');
  assert.equal(eventCountdown(event,at('2026-11-12T07:59:59Z')),'距活动 1 天（当地日期）');
  assert.equal(eventCountdown(event,at('2026-11-12T08:00:00Z')),'活动日期内');
  assert.equal(eventPhase(event,at('2026-11-14T07:59:59Z')),'ongoing');
  assert.equal(eventCountdown(event,at('2026-11-14T08:00:00Z')),'活动已结束');
  const dst={...event,startDate:'2026-11-02',endDate:'2026-11-02'};
  assert.equal(eventCountdown(dst,at('2026-11-01T07:30:00Z')),'距活动 1 天（当地日期）');
  assert.equal(eventCountdown(dst,at('2026-11-02T08:00:00Z')),'活动当天');
});
test('registration deadlines retain unknown, local-day, exact-time, closed and cancelled meanings',()=>{
  const event=fixture();
  assert.equal(registrationCountdown(event,event.registration),'报名截止未确认');
  const registration={status:'link',deadline:'2026-11-27'};
  assert.equal(registrationCountdown(event,registration,at('2026-11-26T15:59:59Z')),'距报名截止 1 天（当地日期）');
  assert.equal(registrationCountdown(event,registration,at('2026-11-26T16:00:00Z')),'报名截止当天（当地日期）');
  assert.equal(registrationCountdown(event,registration,at('2026-11-27T16:00:00Z')),'报名截止已过');
  registration.deadline='2026-11-27T12:00:00+08:00';
  assert.equal(registrationCountdown(event,registration,at('2026-11-27T03:59:00Z')),'距报名截止 1 分钟');
  assert.equal(registrationCountdown(event,registration,at('2026-11-27T04:00:00Z')),'报名截止已过');
  assert.equal(registrationCountdown(event,{status:'closed',deadline:null}),'报名已结束');
  assert.equal(registrationCountdown({...event,status:'cancelled'},registration),'活动已取消');
});
test('events search distinguishes local, watchable and archived; URL restoration validates values',()=>{
  const record={...fixture(),search:'KCD 杭州 SGLang GPU',watchable:false};
  assert.ok(matchesEvent(record,{...emptyEventsFilter,query:' ｓｇｌａｎｇ 杭州 ',view:'local'},at('2026-11-16T00:00:00Z')));
  assert.equal(matchesEvent(record,{...emptyEventsFilter,view:'watch'},at('2026-11-16T00:00:00Z')),false);
  assert.ok(matchesEvent(record,{...emptyEventsFilter,view:'archive'},at('2026-11-29T00:00:00Z')));
  const filter=readEventsFilter(new URLSearchParams('query=GPU&view=archive&phase=bad'));assert.equal(filter.phase,'all');
  const url=writeEventsFilter(new URL('https://example.com/LLMOpsGuide/events/?keep=1#top'),filter);assert.equal(url.searchParams.get('view'),'archive');assert.equal(url.hash,'#top');assert.equal(writeEventsFilter(url,emptyEventsFilter).search,'?keep=1');
});
test('events controller restores filters and history, shows empty states, and refreshes countdowns on its timer',()=>{
  class Element extends EventTarget{value='';hidden=false;textContent='';dataset={};focused=false;focus(){this.focused=true;}querySelector(){return null;}}
  const query=new Element(),view=new Element(),phase=new Element(),count=new Element(),empty=new Element(),reset=new Element(),form=new Element();
  const nodes={'#events-query':query,'#events-view':view,'#events-phase':phase,'#events-count':count,'#events-empty':empty,'#events-reset':reset,form};
  const cards=source.map(event=>{
    const card=new Element(),label=new Element(),clock=new Element(),deadline=new Element();card.querySelector=key=>({'[data-event-phase]':label,'[data-event-countdown]':clock,'[data-registration-countdown]':deadline}[key]);
    card.clock=clock;card.dataset={scope:event.scope,watchable:'false',search:event.title+' '+event.city,timing:JSON.stringify(event),registration:JSON.stringify(event.registration)};return card;
  });
  const root={querySelector:key=>nodes[key],querySelectorAll:()=>cards};
  const saved=Object.fromEntries(['window','location','history','setInterval','clearInterval'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  let tick,cleared=false,now=at('2026-11-16T00:00:00Z'),dispose;
  try{
    globalThis.window=new EventTarget();globalThis.location=new URL('https://example.com/LLMOpsGuide/events/?view=local');globalThis.history={replaceState(_s,_t,url){globalThis.location=new URL(url);}};
    globalThis.setInterval=(fn,ms)=>{assert.equal(ms,60000);tick=fn;return 17;};globalThis.clearInterval=id=>{assert.equal(id,17);cleared=true;};
    dispose=mountEventsIndex(root,{now:()=>now});assert.equal(count.textContent,'1 个活动');assert.equal(view.value,'local');
    view.value='watch';view.dispatchEvent(new Event('change'));assert.equal(count.textContent,'0 个活动');assert.equal(empty.hidden,false);
    reset.dispatchEvent(new Event('click'));assert.equal(count.textContent,'2 个活动');assert.ok(query.focused);assert.equal(location.search,'');
    globalThis.location=new URL('https://example.com/LLMOpsGuide/events/?view=archive');window.dispatchEvent(new Event('popstate'));assert.equal(count.textContent,'1 个活动');
    query.value='不存在';query.dispatchEvent(new Event('input'));assert.equal(count.textContent,'0 个活动');
    reset.dispatchEvent(new Event('click'));now=at('2026-11-29T00:00:00Z');tick();assert.ok(cards.every(c=>c.clock.textContent==='活动已结束'));
    globalThis.location=new URL('https://example.com/LLMOpsGuide/events/?phase=upcoming');window.dispatchEvent(new Event('pageshow'));assert.equal(count.textContent,'0 个活动');
    const submit=new Event('submit',{cancelable:true});form.dispatchEvent(submit);assert.ok(submit.defaultPrevented);
  }finally{dispose?.();for(const[key,descriptor]of Object.entries(saved)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
  assert.ok(cleared);
});
