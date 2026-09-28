import { KEEP_TERMS, SKIP_TERMS } from './config.js';
import type { Job } from './sources/types.js';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = (term: string) => new RegExp(`\\b${escape(term)}\\b`, 'i');

const keep = KEEP_TERMS.map(pattern);
const skip = SKIP_TERMS.map(pattern);

export function filterJobs(jobs: Job[]): Job[] {
  return jobs.filter((job) => keep.some((p) => p.test(job.title)) && !skip.some((p) => p.test(job.title)));
}
