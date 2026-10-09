# Radar de Vagas

A personal full-stack TypeScript project that collects junior front-end jobs from Gupy, filters them, sends Telegram alerts, and displays them in a responsive dashboard.

The repository is organized as an npm workspace for the bot, API, dashboard, and their shared contracts.

## What you can do

- Explore recent jobs without registering an email/password account. Supabase creates an anonymous visitor session behind the scenes.
- Search by title or company and filter by workplace model and publication date.
- Open the original posting and, as an administrator, track application status.
- Receive new matching opportunities through Telegram.

The dashboard supports a read-only visitor role. The API sends visitors job
details and the total count, but never personal tracking statuses or application
metrics. It also rejects status filters from visitors. Only administrators can
view and change application statuses.

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

The bot reads job data embedded in Gupy search pages, applies the filters in
`apps/bot/src/config.ts`, and synchronizes matching jobs with the API when
configured. It sends newly found jobs to Telegram and keeps a local record of
notified IDs to avoid repeat alerts. The API stores jobs in Postgres and serves
the dashboard; the browser does not query the database directly.

## Requirements

- Node.js 22.12 or newer
- npm 10 or newer
- A Supabase project with Postgres and Auth for the dashboard

## Running locally

Install dependencies and create your local environment file:

```bash
npm install
cp .env.example .env
```

Fill in `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, and their `VITE_*` equivalents in `.env`. Enable
anonymous sign-ins in Supabase Auth to use the visitor button. Then apply the
existing database migrations:

```bash
npm run db:migrate --workspace=@radar-vagas/api
```

Start the API and web app in separate terminals:

```bash
npm run api:dev
```

```bash
npm run web:dev
```

Open `http://localhost:5173`. The API health endpoint is available at
`http://localhost:3333/health`.

Locally, Vite proxies `/api` to the API. It also prints a network URL you can
open on a phone connected to the same Wi-Fi. Keep `VITE_API_URL` empty for this
setup; the API itself remains bound to `127.0.0.1` by default.

## Database

The API stores job data in Supabase Postgres. Use `DATABASE_URL` for runtime
connections and `MIGRATION_DATABASE_URL` for migrations. Prefer a direct
connection for migrations; if direct IPv6 is unavailable, the Supabase session
pooler (port 5432) can be used for both. Generate a new migration only after
changing the schema:

```bash
npm run db:generate --workspace=@radar-vagas/api
```

Apply the generated migration with the `db:migrate` command shown above.

## Dashboard authentication

The dashboard uses Supabase Auth. Set `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` for the API, and their `VITE_*` equivalents for the
browser. The API verifies each bearer token with Supabase Auth and reads the
user's application role from `public.user_roles`. Accounts without a role row
are viewers. Only `admin` receives tracking data or can change job statuses.

There is no public sign-up form. Create an email/password administrator user in
Supabase Auth, then assign the role using the Supabase SQL Editor (replace the
example email):

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'admin@example.com'
on conflict (user_id) do update set role = excluded.role;
```

The `jobs` and `user_roles` tables have RLS enabled with no browser policies.
The browser accesses jobs through the API, which enforces authentication and
authorization. Configure the dashboard URL in Supabase Auth's URL settings so
email confirmation links return to the app.

For the visitor button to work in a deployed dashboard, enable anonymous sign-in
in the Supabase Auth project. Visitor sessions remain read-only in the API.
Before exposing anonymous sign-in publicly, configure CAPTCHA or Turnstile in
Supabase Auth to limit automated account creation.

## Before publishing

- The GitHub Actions workflow runs only the bot; deploy the API and web app separately.
- If the web host proxies `/api` to the backend, leave `VITE_API_URL` empty. Otherwise set it to the public API base URL.
- Set `WEB_ORIGIN` to the exact public dashboard origin and use HTTPS for the dashboard, API, and Supabase connection.
- Keep `INGESTION_TOKEN`, database URLs, and Telegram credentials in server-side secrets. Only public Supabase configuration and the API URL belong in `VITE_*` variables.
- Configure the dashboard host to serve the React app on direct visits to `/login` and to send appropriate browser security headers. The API already sends no-store and basic protective headers.
- Verify visitor access, administrator status changes, and the responsive layout on the deployed URL.

## Bot to API synchronization

The bot sends Telegram alerts and can also synchronize all filtered jobs with
the API. Set `API_URL` and `INGESTION_TOKEN` together, both locally and as
GitHub Actions secrets, before using synchronization:

```bash
API_URL=https://your-api.example.com
INGESTION_TOKEN=replace-with-a-long-random-secret
```

For a local test, set `API_URL=http://localhost:3333` and use the same
`INGESTION_TOKEN` in the API and bot environment. Leave both variables empty to
run the bot without API synchronization. Keep the token private: it authorizes
the bot-only `POST /internal/jobs` endpoint and must never appear in `VITE_*`
variables.

## Telegram setup

1. Open a conversation with **@BotFather**, create a bot, and copy its token.
2. Put the token in `TELEGRAM_BOT_TOKEN` in `.env`.
3. Send a message to your new bot.
4. Run `npm run chatid` and copy the result to `TELEGRAM_CHAT_ID` in `.env`.
5. Run `npm start`.

Without those Telegram variables, `npm start` prints matching jobs instead of
sending alerts. Those jobs are not marked as notified, so later runs can still
send them once Telegram is configured.

## Available commands

```bash
npm start          # Run the bot
npm run chatid     # Retrieve the Telegram chat ID
npm run api:dev    # Start the API with file watching
npm run api:start  # Start the API
npm run db:migrate --workspace=@radar-vagas/api # Apply database migrations
npm run web:dev    # Start the web development server
npm run web:build  # Create the production web build
npm run lint       # Lint workspaces with a lint script
npm test           # Run API and bot tests
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
- Supabase Auth and Postgres
- Drizzle ORM
- Telegram Bot API
- GitHub Actions
