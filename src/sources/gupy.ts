import type { Job, JobSource } from './types.js';

const SEARCH_URL = 'https://portal.gupy.io/job-search/term=';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface GupyJob {
  id: number;
  name: string;
  careerPageName: string;
  city: string;
  state: string;
  workplaceType: string;
  jobUrl: string;
  publishedDate: string;
}

export function createGupySource(queries: string[]): JobSource {
  return {
    name: 'gupy',
    async fetchJobs() {
      const raw = (await Promise.all(queries.map(search))).flat();
      const jobs = new Map<number, Job>();
      for (const job of raw) jobs.set(job.id, mapJob(job));
      return [...jobs.values()];
    },
  };
}

async function search(query: string): Promise<GupyJob[]> {
  const response = await fetch(SEARCH_URL + encodeURIComponent(query), {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok) throw new Error(`Gupy ${response.status} em "${query}"`);
  return parseJobs(await response.text());
}

function parseJobs(html: string): GupyJob[] {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!match) return [];
  return JSON.parse(match[1]).props?.pageProps?.initialJobList?.data ?? [];
}

function mapJob(raw: GupyJob): Job {
  return {
    id: `gupy:${raw.id}`,
    title: raw.name.trim(),
    company: raw.careerPageName,
    location: formatLocation(raw),
    url: raw.jobUrl,
    source: 'gupy',
    publishedAt: raw.publishedDate,
  };
}

function formatLocation(raw: GupyJob): string {
  if (raw.workplaceType === 'remote') return 'Remoto';
  return [raw.city, raw.state].filter(Boolean).join(' - ') || 'Não informado';
}
