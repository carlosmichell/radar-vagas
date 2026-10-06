export interface Job {
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

export interface JobSource {
  name: string;
  fetchJobs(): Promise<Job[]>;
}
