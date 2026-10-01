# Job Radar

A Node.js and TypeScript automation that finds junior front-end jobs on Gupy, filters them by role and seniority, and sends new opportunities to Telegram.

The repository is organized as an npm workspace so the bot and the upcoming web dashboard can evolve independently while remaining part of the same product.

## Repository structure

```text
apps/
  bot/        Scheduled job collector and Telegram notifier
```

The React dashboard will be added later under `apps/web`.

## How it works

Gupy does not expose a public job-search API, so the bot reads the job data embedded in the search page HTML. It then applies the filters from `apps/bot/src/config.ts`, ignores jobs that were already processed, and sends the remaining jobs to Telegram.

## Requirements

- Node.js 22 or newer
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

## Telegram setup

1. Open a conversation with **@BotFather**, create a bot, and copy its token.
2. Send a message to your new bot.
3. Run `npm run chatid` to retrieve your chat ID.
4. Copy `.env.example` to `.env` and fill in both values.

## Available commands

```bash
npm start          # Run the bot
npm run chatid     # Retrieve the Telegram chat ID
npm run typecheck  # Type-check every workspace
```

## Daily automation

The workflow at `.github/workflows/radar.yml` runs every day at 12:00 UTC, which is 09:00 in Brasília (UTC-3). It can also be triggered manually from GitHub Actions.

Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` under **Settings > Secrets and variables > Actions** in the GitHub repository.

## Current stack

- Node.js
- TypeScript
- Native Fetch API
- Telegram Bot API
- GitHub Actions
