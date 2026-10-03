import data from './content/radar.json';
import { mergeRecords, kindNames, topics } from './lib/radar-store.mjs';
export { basisNames } from './lib/radar-report.mjs';
export { sourceName, sourceReviewLabel } from './lib/radar-sources.mjs';

export type ReportBasis = 'official' | 'author' | 'inference' | 'pending';
type Provenance = { basis: ReportBasis; sourceIndices: number[] };
export type ReportDiagram = Provenance & { type: 'diagram'; title: string; caption: string; presentation?: { kind: string; panels: { title: string; tone: string; nodeIds: string[] }[] }; nodes: { id: string; label: string; detail: string; column: number; row: number; shortLabel?: string; subtitle?: string; tone?: string }[]; edges: { from: string; to: string; label: string; shortLabel?: string }[] };
export type ReportBars = Provenance & { type: 'bars'; title: string; caption: string; unit: string; layout?: 'rank-timeline' | 'token-cost'; series: { label: string; segments: { label: string; value: number }[]; rankTimes?: number[]; deliveredTokens?: number }[] };
export type ReportBlock =
  | (Provenance & { type: 'paragraph'; text: string })
  | (Provenance & { type: 'callout'; title: string; text: string })
  | (Provenance & { type: 'code'; language: string; text: string })
  | (Provenance & { type: 'list'; items: string[] })
  | { type: 'table'; caption: string; columns: string[]; rows: (Provenance & { cells: string[] })[] }
  | ReportDiagram | ReportBars;
export type RadarReport = { version: 1; scope: string; sections: { id: string; title: string; blocks: ReportBlock[] }[] };

export type RadarRecord = {
  schemaVersion: number; id: string; kind: 'release' | 'analysis' | 'reading';
  title: string; summary: string; publishedAt: string; reviewedAt: string; topics: string[];
  visibility: string; containsPrivateData: boolean;
  sources: { title: string; url: string; publishedAt?: string; accessedAt?: string; review?: { category: 'paper' | 'community' | 'blog' | 'news'; publisher: string; status: 'attributed' | 'unverified'; note: string; peerReview?: 'preprint' | 'peer-reviewed' | 'unknown' } }[];
  claims: { status: 'confirmed' | 'inference' | 'pending'; text: string; sourceIndices: number[] }[];
  questions: string[]; related: { title: string; path: string }[];
  diagram?: { title: string; steps: { label: string; detail: string }[] };
  example?: { title: string; text: string };
  report?: RadarReport;
};
export const radar: RadarRecord[] = mergeRecords(data, []).records;
export { kindNames, topics };
export const statusNames = { confirmed: '已确认事实', inference: '推测', pending: '待验证' };
export const radarHref = (id: string) => `/radar/${id}/`;
