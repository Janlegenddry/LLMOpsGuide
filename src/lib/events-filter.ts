import { eventPhase, type EventTiming } from './events-time.ts';
export const emptyEventsFilter={query:'',view:'all',phase:'all'};
const normalize=(value:string)=>value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,'');
export function matchesEvent(record:EventTiming&{search:string;scope:string;watchable:boolean},filter:typeof emptyEventsFilter,now=new Date()) {
  const phase=eventPhase(record,now);
  const viewMatches=filter.view==='all'||(filter.view==='local'&&record.scope==='local')||(filter.view==='watch'&&record.watchable)||(filter.view==='archive'&&['ended','cancelled'].includes(phase));
  return viewMatches&&(filter.phase==='all'||phase===filter.phase)&&filter.query.trim().split(/\s+/).every(word=>normalize(record.search).includes(normalize(word)));
}
export function readEventsFilter(params:URLSearchParams) {
  const view=params.get('view')||'all',phase=params.get('phase')||'all';
  return {query:params.get('query')||'',view:['all','local','watch','archive'].includes(view)?view:'all',phase:['all','upcoming','ongoing','ended','cancelled'].includes(phase)?phase:'all'};
}
export function writeEventsFilter(url:URL,filter:typeof emptyEventsFilter) {
  const next=new URL(url);for(const key of ['query','view','phase']as const){const value=filter[key].trim();value&&value!=='all'?next.searchParams.set(key,value):next.searchParams.delete(key);}return next;
}
