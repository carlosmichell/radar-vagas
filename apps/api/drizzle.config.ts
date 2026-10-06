import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { fileURLToPath } from 'node:url';

dotenv.config({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
});

if (!process.env.MIGRATION_DATABASE_URL) {
  throw new Error('MIGRATION_DATABASE_URL must be set to run database migrations.');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.MIGRATION_DATABASE_URL,
  },
});
