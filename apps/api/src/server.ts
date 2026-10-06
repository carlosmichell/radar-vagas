import { buildApp } from './app.js';
import { createSupabaseAuthVerifier } from './auth.js';
import { createPostgresJobsRepository } from './jobs/postgres-repository.js';
import { createPostgresRolesRepository } from './roles.js';

const port = Number(process.env.API_PORT ?? 3333);
const host = process.env.API_HOST ?? '127.0.0.1';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL must be set to start the API.');

const repository = createPostgresJobsRepository(databaseUrl);
const rolesRepository = createPostgresRolesRepository(databaseUrl);
const app = buildApp(
  { logger: true },
  {
    repository,
    ingestionToken: process.env.INGESTION_TOKEN,
    authVerifier: createSupabaseAuthVerifier(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY,
    ),
    rolesRepository,
  },
);

app.addHook('onClose', () => repository.close?.());
app.addHook('onClose', () => rolesRepository.close?.());

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
