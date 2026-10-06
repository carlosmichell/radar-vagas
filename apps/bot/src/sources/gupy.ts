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
    workplaceType: formatWorkplaceType(raw.workplaceType),
    technology: detectTechnology(raw.name),
    url: raw.jobUrl,
    source: 'gupy',
    publishedAt: raw.publishedDate,
  };
}

function detectTechnology(title: string): string | undefined {
  const technologies = [
    ['React', /\breact(?:\.js)?\b/i],
    ['Next.js', /\bnext(?:\.js)?\b/i],
    ['TypeScript', /\btypescript\b/i],
    ['JavaScript', /\bjavascript\b/i],
    ['Vue.js', /\bvue(?:\.js)?\b/i],
    ['Angular', /\bangular\b/i],
    ['Node.js', /\bnode(?:\.js)?\b/i],
    ['Python', /\bpython\b/i],
    ['Java', /\bjava\b/i],
    ['C#', /\bc#\b/i],
  ] as const;

  return technologies.find(([, pattern]) => pattern.test(title))?.[0];
}

function formatLocation(raw: GupyJob): string {
  if (raw.workplaceType === 'remote') return 'Remoto';
  return [raw.city, raw.state].filter(Boolean).join(' - ') || 'Não informado';
}

function formatWorkplaceType(value: string): string {
  if (value === 'remote') return 'remote';
  if (value === 'hybrid') return 'hybrid';
  if (value === 'on-site' || value === 'onsite') return 'on_site';
  return 'not_informed';
}
