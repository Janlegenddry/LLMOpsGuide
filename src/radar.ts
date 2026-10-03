import data from './content/radar.json';
import { mergeRecords, kindNames, topics } from './lib/radar-store.mjs';

export type RadarRecord = {
  schemaVersion: number; id: string; kind: 'release' | 'analysis' | 'reading';
  title: string; summary: string; publishedAt: string; reviewedAt: string; topics: string[];
  visibility: string; containsPrivateData: boolean;
  sources: { title: string; url: string; publishedAt: string }[];
  claims: { status: 'confirmed' | 'inference' | 'pending'; text: string; sourceIndices: number[] }[];
  questions: string[]; related: { title: string; path: string }[];
  diagram?: { title: string; steps: { label: string; detail: string }[] };
  example?: { title: string; text: string };
};
export const radar: RadarRecord[] = mergeRecords(data, []).records;
export { kindNames, topics };
export const statusNames = { confirmed: '已确认事实', inference: '推测', pending: '待验证' };
export const radarHref = (id: string) => `/radar/${id}/`;
