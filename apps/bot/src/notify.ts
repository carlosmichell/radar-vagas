import type { Job } from './sources/types.js';

const JOBS_PER_MESSAGE = 8;

export async function sendJobs(jobs: Job[]): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('Telegram não configurado. Vagas encontradas:\n');
    for (const job of jobs) print(job);
    return false;
  }

  for (let i = 0; i < jobs.length; i += JOBS_PER_MESSAGE) {
    await sendMessage(token, chatId, jobs.slice(i, i + JOBS_PER_MESSAGE));
  }
  return true;
}

async function sendMessage(token: string, chatId: string, jobs: Job[]) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatJobsMessage(jobs),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) throw new Error(`Telegram ${response.status}: ${await response.text()}`);
}

export function formatJobsMessage(jobs: Job[]): string {
  return (
    '<b>Radar de Vagas</b>\n\n' +
    jobs
      .map(
        (job) => {
          const safeUrl = safeJobUrl(job.url);
          return `<b>${escape(job.title)}</b>\n` +
            `${escape(job.company)} · ${escape(job.location)}\n` +
            (safeUrl ? `<a href="${escape(safeUrl)}">Ver vaga</a>` : 'Link indisponível');
        },
      )
      .join('\n\n')
  );
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeJobUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function print(job: Job): void {
  console.log(`• ${job.title}\n  ${job.company} · ${job.location}\n  ${job.url}`);
}
