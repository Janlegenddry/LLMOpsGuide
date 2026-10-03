type SearchRecord = { search: string; kind: string; month: string; topics: string[] };
type Filter = { query: string; kind: string; month: string; topic: string };
export function matchesRadar(record: SearchRecord, filter: Filter): boolean {
  const normalize = (text: string) => text.toLocaleLowerCase().replace(/\s+/g, '');
  return (!filter.query || normalize(record.search).includes(normalize(filter.query))) &&
    (filter.kind === 'all' || record.kind === filter.kind) &&
    (filter.month === 'all' || record.month === filter.month) &&
    (filter.topic === 'all' || record.topics.includes(filter.topic));
}
