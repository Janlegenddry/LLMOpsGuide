export type LibraryFilter = { query: string; domain: string; type: string; topic: string; state: string };
export const emptyLibraryFilter: LibraryFilter = { query: '', domain: 'all', type: 'all', topic: 'all', state: 'all' };
export const normalizeSearch = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');
export function matchesLibrary(record: { search: string; domain: string; type: string; topics: string[]; state: string }, filter: LibraryFilter): boolean {
  return (filter.domain === 'all' || filter.domain === record.domain) &&
    (filter.type === 'all' || filter.type === record.type) &&
    (filter.topic === 'all' || record.topics.includes(filter.topic)) &&
    (filter.state === 'all' || record.state === filter.state) &&
    filter.query.trim().split(/\s+/).every(word => normalizeSearch(record.search).includes(normalizeSearch(word)));
}
export function readLibraryFilter(params: URLSearchParams, options: Record<string, string[]>): LibraryFilter {
  const filter = { ...emptyLibraryFilter, query: params.get('query') || '' };
  for (const key of ['domain', 'type', 'topic', 'state'] as const) {
    const value = params.get(key) || 'all'; filter[key] = options[key]?.includes(value) ? value : 'all';
  }
  return filter;
}
export function writeLibraryFilter(url: URL, filter: LibraryFilter): URL {
  const next = new URL(url);
  for (const [key, raw] of Object.entries(filter)) {
    const value = key === 'query' ? raw.trim() : raw;
    value && value !== 'all' ? next.searchParams.set(key, value) : next.searchParams.delete(key);
  }
  return next;
}
