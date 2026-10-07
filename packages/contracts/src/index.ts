export const jobStatusValues = ['new', 'saved', 'applied', 'discarded'] as const;
export type JobStatus = (typeof jobStatusValues)[number];

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

export interface JobDto extends Omit<IncomingJob, 'workplaceType' | 'technology' | 'publishedAt'> {
  workplaceType: string;
  technology: string | null;
  publishedAt: string | null;
  discoveredAt: string;
  lastSeenAt: string;
  status: JobStatus;
}

export interface StoredJob extends Omit<JobDto, 'publishedAt' | 'discoveredAt' | 'lastSeenAt'> {
  publishedAt: Date | null;
  discoveredAt: Date;
  lastSeenAt: Date;
}

export interface JobListFilters {
  query?: string;
  status?: JobStatus;
  workplaceType?: string;
  technology?: string;
  maxAgeDays?: number;
  limit?: number;
}

export type JobsSummary = { total: number } & Record<JobStatus, number>;
