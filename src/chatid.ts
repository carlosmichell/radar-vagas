const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('Configure TELEGRAM_BOT_TOKEN no .env');

interface Update {
  update_id: number;
  message?: { chat: { id: number }; from?: { first_name?: string }; text?: string };
}

async function getUpdates(offset: number, timeout: number): Promise<Update[]> {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=${timeout}`,
  );
  const data = await response.json();
  if (!data.ok) throw new Error(JSON.stringify(data));
  return data.result;
}

console.log('Mande uma mensagem para o seu bot no Telegram. Aguardando...\n');

const previous = await getUpdates(0, 0);
let offset = previous.length ? previous[previous.length - 1].update_id + 1 : 0;

for (let i = 0; i < 4; i++) {
  const updates = await getUpdates(offset, 30);
  for (const update of updates) {
    offset = update.update_id + 1;
    if (update.message) {
      console.log(`\nTELEGRAM_CHAT_ID=${update.message.chat.id}`);
      process.exit(0);
    }
  }
}

console.log('Nenhuma mensagem recebida.');
process.exit(1);
