import type { IncomingJob, JobListFilters, JobStatus, JobsSummary, StoredJob } from '@radar-vagas/contracts';

export type { JobsSummary, StoredJob } from '@radar-vagas/contracts';

export interface JobsRepository {
  list(filters: JobListFilters): Promise<StoredJob[]>;
  summary(): Promise<JobsSummary>;
  upsert(incomingJobs: IncomingJob[]): Promise<number>;
  updateStatus(id: string, status: JobStatus): Promise<StoredJob | undefined>;
  close?(): Promise<void>;
}
