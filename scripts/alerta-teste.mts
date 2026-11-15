/**
 * Envia uma mensagem de TESTE ao Telegram configurado (TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID).
 * Uso local: npx tsx scripts/alerta-teste.mts
 * Homologação: docker compose exec worker node scripts/alerta-teste.mjs
 */
import "dotenv/config";
import { sendTelegram, telegramEnabled } from "../src/server/alerts";
import { instituicaoProvisoria as INST } from "../src/config/instituicao";

const tg = { token: process.env.TELEGRAM_BOT_TOKEN, chatId: process.env.TELEGRAM_CHAT_ID };
if (!telegramEnabled(tg)) { console.error("Telegram não configurado: preencha TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no .env."); process.exit(1); }
try {
  await sendTelegram(tg, `🔔 [${INST.nomePublico} · ${process.env.APP_ENV ?? "development"}] Mensagem de teste dos alertas. Se você recebeu isto, o monitoramento consegue avisar este chat.`);
  console.log("Mensagem de teste enviada.");
} catch (e) {
  console.error("Falha ao enviar:", (e as Error).message);
  process.exit(1);
}
