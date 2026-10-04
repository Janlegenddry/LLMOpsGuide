import data from './content/knowledge.json';
import { validateKnowledge } from './lib/knowledge-store.mjs';
import { resolve } from 'node:path';
export { knowledgeHref } from './lib/library-taxonomy';

export type KnowledgeRecord = {
  schemaVersion: number; id: string; title: string; summary: string; institution: string;
  publishedAt: string | null; addedAt: string; domain: string; topics: string[]; keywords: string[]; format: 'PDF' | 'HTML';
  source: { title: string; url: string }; readUrl: string; downloadUrl?: string;
  publicationApproved: true; containsPrivateData: false; distribution: 'link-only' | 'redistributable';
};
export const knowledge: KnowledgeRecord[] = validateKnowledge(data, { publicRoot: resolve('public') });
