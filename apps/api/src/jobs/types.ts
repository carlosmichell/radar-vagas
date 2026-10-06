import type { JobStatus } from '../db/schema.js';

export interface IncomingJob {
  id: string;
  title: string;
  company: string;
  location: string;
  workplaceType?: string;
  technology?: string;
  url: string;
  source: string;
  publishedAt?: string;
}

export interface JobListFilters {
  query?: string;
  status?: JobStatus;
  workplaceType?: string;
  technology?: string;
  maxAgeDays?: number;
  limit?: number;
}

export interface StoredJob {
  id: string;
  title: string;
  company: string;
  location: string;
  workplaceType: string;
  technology: string | null;
  url: string;
  source: string;
  publishedAt: Date | null;
  discoveredAt: Date;
  lastSeenAt: Date;
  status: JobStatus;
}

export interface JobsSummary {
  total: number;
  new: number;
  saved: number;
  applied: number;
  discarded: number;
}

export interface JobsRepository {
  list(filters: JobListFilters): Promise<StoredJob[]>;
  summary(): Promise<JobsSummary>;
  upsert(incomingJobs: IncomingJob[]): Promise<number>;
  updateStatus(id: string, status: JobStatus): Promise<StoredJob | undefined>;
  close?(): Promise<void>;
}
