import type { IncomingJob } from '@radar-vagas/contracts';

export type Job = IncomingJob;

export interface JobSource {
  name: string;
  fetchJobs(): Promise<Job[]>;
}
