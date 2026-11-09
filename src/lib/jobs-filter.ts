export const jobFilterKeys = ['category','location','status','priority','sourceType'] as const;
export type JobsFilter = { query: string; category: string; location: string; status: string; priority: string; sourceType: string };
export const emptyJobsFilter: JobsFilter = { query:'', category:'all', location:'all', status:'all', priority:'all', sourceType:'all' };
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,'');
export function effectiveJobStatus(status: string, verifiedAt: string, today = new Date().toISOString().slice(0,10)) {
  return status === 'open' && Date.parse(today)-Date.parse(verifiedAt) > 30*86400000 ? 'review' : status;
}
export function matchesJob(record: { search: string; category: string; locations: string[]; status: string; priority: string; sourceType: string }, filter: JobsFilter) {
  return jobFilterKeys.every(key => filter[key] === 'all' || (key === 'location' ? record.locations.includes(filter.location) : record[key] === filter[key])) && filter.query.trim().split(/\s+/).every(word => normalize(record.search).includes(normalize(word)));
}
export function readJobsFilter(params: URLSearchParams, options: Record<string,string[]>): JobsFilter {
  const filter={...emptyJobsFilter,query:params.get('query')||''};
  for(const key of jobFilterKeys) {const value=params.get(key)||'all';filter[key]=options[key]?.includes(value)?value:'all';}
  return filter;
}
export function writeJobsFilter(url: URL, filter: JobsFilter) {
  const next=new URL(url);
  for(const [key,raw] of Object.entries(filter)) {const value=key==='query'?raw.trim():raw;value&&value!=='all'?next.searchParams.set(key,value):next.searchParams.delete(key);}
  return next;
}
