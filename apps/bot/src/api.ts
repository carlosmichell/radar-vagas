import type { Job } from './sources/types.js';

export async function syncJobsWithApi(jobs: Job[]): Promise<boolean> {
  const apiUrl = process.env.API_URL?.replace(/\/$/, '');
  const ingestionToken = process.env.INGESTION_TOKEN;

  if (!apiUrl && !ingestionToken) {
    console.log('API não configurada; sincronização com o dashboard ignorada.');
    return false;
  }

  if (!apiUrl || !ingestionToken) {
    throw new Error('API_URL and INGESTION_TOKEN must be set together.');
  }

  const response = await fetch(`${apiUrl}/internal/jobs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ingestionToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobs }),
  });

  if (!response.ok) throw new Error(`API ${response.status}: ${await response.text()}`);
  const { processed } = (await response.json()) as { processed: number };
  console.log(`✓ ${processed} vagas sincronizadas com o dashboard`);
  return true;
}
