# Radar de Vagas

Automação em Node + TypeScript que busca vagas de front-end júnior na Gupy, filtra por área e senioridade, e envia as novidades no Telegram.

Criei para parar de entrar em sites de emprego várias vezes ao dia.

## Como funciona

A Gupy não expõe uma API pública de busca, então o script acessa a página de resultados e extrai os dados que ela já embute no HTML. Depois aplica os filtros de `src/config.ts`, descarta vagas já enviadas e manda o resto pro Telegram.

## Rodando

```bash
npm install
npm start
```

Sem `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` o script roda em dry-run e só lista as vagas no terminal.

## Configuração do Telegram

1. Fale com o **@BotFather**, crie um bot e copie o token.
2. Abra uma conversa com o bot e mande uma mensagem.
3. Rode `npm run chatid` para descobrir seu chat id.
4. Copie `.env.example` para `.env` e preencha os valores.

## Automação diária

O repositório já tem um workflow do GitHub Actions (`radar.yml`) que roda todo dia às 9h UTC. Basta cadastrar `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` nos *Settings > Secrets and variables > Actions* do repositório.

## Stack

Node · TypeScript · fetch nativo · Telegram Bot API
