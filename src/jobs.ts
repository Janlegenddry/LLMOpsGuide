import data from './content/jobs.json';
import { validateJobs } from './lib/jobs-store.mjs';
export { jobCategoryNames, jobPriorityNames, jobStatusNames, jobSourceNames } from './lib/jobs-store.mjs';
export type JobRecord = {
  schemaVersion: number; id: string; company: string; title: string; locations: string[];
  category: 'inference'|'sre'|'platform'|'training'|'kernel'; level: string; summary: string; skills: string[];
  url: string; sourceName: string; sourceType: 'official'|'board'|'community'; status: 'open'|'review'|'closed';
  statusNote: string; verifiedAt: string; postedAt: string|null; priority: 'strong'|'related'|'stretch';
  matchReasons: string[]; gaps: string[]; publicationApproved: boolean; containsPrivateData: boolean;
};
export const jobs: JobRecord[] = validateJobs(data);
