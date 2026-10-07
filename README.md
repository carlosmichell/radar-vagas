# Job Radar

A Node.js and TypeScript automation that finds junior front-end jobs on Gupy, filters them by role and seniority, and sends new opportunities to Telegram.

The repository is organized as an npm workspace for the bot, API, dashboard, and their shared contracts.

## Repository structure

```text
apps/
  api/        HTTP API for the dashboard
  bot/        Scheduled job collector and Telegram notifier
  web/        React dashboard
packages/
  contracts/  Types and status values shared by the apps
```

## How it works

Gupy does not expose a public job-search API, so the bot reads the job data embedded in the search page HTML. It then applies the filters from `apps/bot/src/config.ts`, ignores jobs that were already processed, and sends the remaining jobs to Telegram.

## Requirements

- Node.js 22.12 or newer
- npm 10 or newer

## Running locally

Install all workspace dependencies:

```bash
npm install
```

Run the bot:

```bash
npm start
```

Without `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`, the bot runs in dry-run mode and prints the jobs to the terminal.

Run the web dashboard:

```bash
npm run web:dev
```

Run the API in development mode:

```bash
npm run api:dev
```

The initial health endpoint is available at `http://localhost:3333/health`.

When both are running locally, Vite proxies `/api` to the API. This makes the
dashboard work from another device on the same network without embedding a
local IP address in the React code.

## Database

The API stores job data in Supabase Postgres. Set `DATABASE_URL` to the runtime connection string and `MIGRATION_DATABASE_URL` to a direct connection string. If direct IPv6 is unavailable, use the Supabase Session pooler (port 5432) for both.

```bash
npm run db:generate --workspace=@radar-vagas/api
npm run db:migrate --workspace=@radar-vagas/api
```

## Dashboard authentication

The dashboard uses Supabase Auth. Set `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` for the API, and their `VITE_*` equivalents for the
browser. The API verifies each bearer token with Supabase Auth and reads the
user's application role from `public.user_roles`. Accounts without a role row
are viewers. Only `admin` can change job statuses.

After the administrator signs up, promote that account using the Supabase SQL
Editor (replace the example email):

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'admin@example.com'
on conflict (user_id) do update set role = excluded.role;
```

The `jobs` and `user_roles` tables have RLS enabled with no browser policies.
The browser accesses jobs through the API, which enforces authentication and
authorization. Configure the dashboard URL in Supabase Auth's URL settings so
email confirmation links return to the app.

## Bot to API synchronization

The bot continues to send Telegram alerts and also attempts to synchronize all
filtered jobs with the API. Set these variables locally and as GitHub Actions
secrets before the scheduled workflow can populate the database:

```bash
API_URL=https://your-api.example.com
INGESTION_TOKEN=replace-with-a-long-random-secret
```

For a local test, `API_URL=http://localhost:3333` is sufficient. Keep
`INGESTION_TOKEN` private: it authorizes the bot-only `POST /internal/jobs`
endpoint and must never be exposed through `VITE_*` variables.

## Telegram setup

1. Open a conversation with **@BotFather**, create a bot, and copy its token.
2. Send a message to your new bot.
3. Run `npm run chatid` to retrieve your chat ID.
4. Copy `.env.example` to `.env` and fill in both values.

## Available commands

```bash
npm start          # Run the bot
npm run chatid     # Retrieve the Telegram chat ID
npm run api:dev    # Start the API with file watching
npm run api:start  # Start the API
npm run db:migrate # Apply database migrations
npm run web:dev    # Start the web development server
npm run web:build  # Create the production web build
npm run lint       # Lint every workspace
npm test           # Test every workspace
npm run typecheck  # Type-check every workspace
```

## Daily automation

The workflow at `.github/workflows/radar.yml` runs every day at 12:00 UTC, which is 09:00 in Brasília (UTC-3). It can also be triggered manually from GitHub Actions.

Add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `API_URL`, and `INGESTION_TOKEN`
under **Settings > Secrets and variables > Actions** in the GitHub repository.

## Current stack

- Node.js
- TypeScript
- React
- Vite
- Tailwind CSS
- Fastify
- Native Fetch API
- Telegram Bot API
- GitHub Actions
