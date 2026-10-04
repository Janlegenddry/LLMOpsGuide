import { entries } from './data';
import { radar, radarHref } from './radar';
import { knowledge } from './knowledge';
import { libraryDomains, libraryTypes } from './lib/library-taxonomy';
export { libraryDomains, libraryTypes, libraryStates } from './lib/library-taxonomy';
export type LibraryItem = {
  id: string; title: string; description: string; href: string; domain: string;
  type: keyof typeof libraryTypes; state: 'organized' | 'unread'; topics: string[];
  keywords: string[]; updated: string | null; dateLabel: string; institution?: string;
};
export const library: LibraryItem[] = [
  ...entries.map(entry => ({ id: `article:${entry.href}`, title: entry.title, description: entry.description, href: entry.href, domain: entry.domain || 'ai-infra', type: 'article' as const, state: 'organized' as const, topics: entry.topics || [entry.section], keywords: entry.keywords || [], updated: entry.updated || null, dateLabel: '更新' })),
  ...radar.map(record => ({ id: `radar:${record.id}`, title: record.title, description: record.summary, href: radarHref(record.id), domain: 'ai-infra', type: record.report ? 'report' as const : 'note' as const, state: record.report ? 'organized' as const : 'unread' as const, topics: record.topics, keywords: [], updated: record.reviewedAt, dateLabel: '核对' })),
  ...knowledge.map(record => ({ id: `whitepaper:${record.id}`, title: record.title, description: record.summary, href: record.readUrl, domain: record.domain, type: 'whitepaper' as const, state: 'unread' as const, topics: record.topics, keywords: record.keywords, updated: record.addedAt, dateLabel: '收录', institution: record.institution })),
].sort((a, b) => (b.updated || '').localeCompare(a.updated || '') || a.title.localeCompare(b.title, 'zh-CN'));
for (const item of library) if (!libraryDomains.some(domain => domain.id === item.domain)) throw new Error(`未知知识领域：${item.domain}`);
export const libraryTopics = [...new Set(library.flatMap(item => item.topics))].sort((a,b) => a.localeCompare(b,'zh-CN'));
export const librarySearch = (item: LibraryItem) => `${item.title} ${item.description} ${item.keywords.join(' ')} ${item.topics.join(' ')} ${item.institution || ''} ${libraryDomains.find(d => d.id === item.domain)?.title || ''} ${libraryTypes[item.type]}`;
