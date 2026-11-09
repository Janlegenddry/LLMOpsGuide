import { emptyJobsFilter, jobFilterKeys, effectiveJobStatus, matchesJob, readJobsFilter, writeJobsFilter } from '../lib/jobs-filter.ts';
export function mountJobsIndex(root: HTMLElement) {
  const query=root.querySelector<HTMLInputElement>('#jobs-query');
  const selects=Object.fromEntries(jobFilterKeys.map(key=>[key,root.querySelector<HTMLSelectElement>(`#jobs-${key}`)]));
  const options=Object.fromEntries(Object.entries(selects).map(([key,select])=>[key,[...(select?.options||[])].map(o=>o.value)]));
  const records=[...root.querySelectorAll<HTMLElement>('[data-job-record]')];
  const count=root.querySelector<HTMLElement>('#jobs-count'),empty=root.querySelector<HTMLElement>('#jobs-empty'),reset=root.querySelector<HTMLButtonElement>('#jobs-reset');
  for(const record of records) {
    const status=effectiveJobStatus(record.dataset.status||'',record.dataset.verifiedAt||'');
    record.dataset.status=status;
    if(status==='review' && record.dataset.originalStatus==='open') {const label=record.querySelector<HTMLElement>('[data-job-status]');if(label)label.textContent='待复核 · 超过 30 天';}
  }
  const restore=()=>{const filter=readJobsFilter(new URLSearchParams(location.search),options);if(query)query.value=filter.query;for(const key of jobFilterKeys)if(selects[key])selects[key]!.value=filter[key];};
  function render(write=true) {
    const filter={...emptyJobsFilter,query:query?.value||''};for(const key of jobFilterKeys)filter[key]=selects[key]?.value||'all';
    let visible=0;
    for(const record of records) {record.hidden=!matchesJob({search:record.dataset.search||'',category:record.dataset.category||'',locations:JSON.parse(record.dataset.locations||'[]'),status:record.dataset.status||'',priority:record.dataset.priority||'',sourceType:record.dataset.sourceType||''},filter);if(!record.hidden)visible++;}
    if(count)count.textContent=`${visible} 个岗位`;
    if(empty)empty.hidden=visible>0;
    if(reset)reset.hidden=!Object.entries(filter).some(([k,v])=>k==='query'?v.trim():v!=='all');
    if(write)history.replaceState(null,'',writeJobsFilter(new URL(location.href),filter));
  }
  query?.addEventListener('input',()=>render());
  Object.values(selects).forEach(select=>select?.addEventListener('change',()=>render()));
  root.querySelector('form')?.addEventListener('submit',event=>{event.preventDefault();render();});
  reset?.addEventListener('click',()=>{if(query)query.value='';Object.values(selects).forEach(s=>{if(s)s.value='all';});render();query?.focus();});
  window.addEventListener('popstate',()=>{restore();render(false);});
  window.addEventListener('pageshow',()=>{restore();render(false);});
  restore();render(false);
}
