import { QUERIES } from './config.js';
import { syncJobsWithApi } from './api.js';
import { filterJobs } from './filter.js';
import { sendJobs } from './notify.js';
import { createGupySource } from './sources/gupy.js';
import { loadSeenIds, saveSeenIds } from './store.js';

const sources = [createGupySource(QUERIES)];

async function main() {
  console.log('Radar de Vagas — buscando...\n');

  const allJobs = [];
  for (const source of sources) {
    try {
      const jobs = await source.fetchJobs();
      console.log(`✓ ${source.name}: ${jobs.length} vagas`);
      allJobs.push(...jobs);
    } catch (error) {
      console.error(`✗ ${source.name}:`, error);
    }
  }

  const filtered = filterJobs(allJobs);
  console.log(`→ ${filtered.length} após filtro`);

  try {
    await syncJobsWithApi(filtered);
  } catch (error) {
    console.error('Falha ao sincronizar com a API:', error);
  }

  const seen = await loadSeenIds();
  const newJobs = filtered.filter((job) => !seen.has(job.id));

  if (newJobs.length === 0) {
    console.log('→ nenhuma vaga nova');
    return;
  }

  console.log(`→ ${newJobs.length} novas`);
  const sent = await sendJobs(newJobs);

  if (sent) {
    for (const job of newJobs) seen.add(job.id);
    await saveSeenIds(seen);
    console.log('✓ enviado');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
