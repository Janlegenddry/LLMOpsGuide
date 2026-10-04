import { emptyLibraryFilter, matchesLibrary, readLibraryFilter, writeLibraryFilter } from '../lib/library-filter.ts';
export function mountLibraryIndex(root: HTMLElement) {
  const query = root.querySelector<HTMLInputElement>('#library-query');
  const selects = Object.fromEntries(['domain','type','topic','state'].map(key => [key, root.querySelector<HTMLSelectElement>(`#library-${key}`)]));
  const records = [...root.querySelectorAll<HTMLElement>('[data-library-record]')];
  const count = root.querySelector<HTMLElement>('#library-count'), empty = root.querySelector<HTMLElement>('#library-empty'), reset = root.querySelector<HTMLButtonElement>('#library-reset');
  const fixed = {domain: root.dataset.fixedDomain, type: root.dataset.fixedType};
  const options = Object.fromEntries(Object.entries(selects).map(([key, select]) => [key, [...(select?.options || [])].map(o => o.value)]));
  const restore = () => {
    const filter = readLibraryFilter(new URLSearchParams(location.search),options);
    if (query) query.value = filter.query;
    for (const [key, select] of Object.entries(selects)) if (select) select.value = filter[key as keyof typeof filter];
  };
  function render() {
    const filter = { ...emptyLibraryFilter, query: query?.value || '' };
    for (const key of ['domain','type','topic','state'] as const) filter[key] = selects[key]?.value || 'all';
    let visible = 0;
    for (const record of records) {
      record.hidden = !matchesLibrary({search: record.dataset.search || '', domain: record.dataset.domain || '', type: record.dataset.type || '', state: record.dataset.state || '', topics: JSON.parse(record.dataset.topics || '[]')}, {...filter,domain: fixed.domain || filter.domain,type: fixed.type || filter.type});
      if (!record.hidden) visible++;
    }
    if (count) count.textContent = `${visible} 项内容`;
    if (empty) empty.hidden = visible > 0;
    if (reset) reset.hidden = !Object.entries(filter).some(([key,value]) => key === 'query' ? value.trim() : value !== 'all');
    history.replaceState(null,'',writeLibraryFilter(new URL(location.href),filter));
  }
  query?.addEventListener('input',render);
  Object.values(selects).forEach(select => select?.addEventListener('change',render));
  root.querySelector('form')?.addEventListener('submit',event => {event.preventDefault();render();});
  reset?.addEventListener('click',() => {if(query) query.value='';Object.values(selects).forEach(select => {if(select) select.value='all';});render();query?.focus();});
  window.addEventListener('popstate',() => {restore();render();});
  window.addEventListener('pageshow',() => {restore();render();});
  restore();render();
}
