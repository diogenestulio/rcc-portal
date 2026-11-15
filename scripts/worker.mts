/**
 * Worker de tarefas duráveis e agendadas (processo separado do Next.js — ADR-007).
 * - Fila `job` em PostgreSQL com SKIP LOCKED (pode haver mais de um worker).
 * - Rotinas periódicas: expirar reservas/pedidos, publicar agendados, conciliar pagamentos,
 *   importar agenda Google (se configurado), expurgar pedidos de oração.
 * - Monitoramento: verificações a cada minuto com alertas por Telegram (src/server/alerts.ts).
 * Uso: npm run worker   (em produção: serviço systemd/container com reinício automático)
 */
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { hostname } from "node:os";
import * as schema from "../src/db/schema";
import { runJobsOnce, type JobHandler } from "../src/server/jobs";
import { expireHolds, promoteWaitlist } from "../src/server/registrations";
import { expireOrders, reconcile, applyProviderState } from "../src/server/store/payments";
import { SimulatedProvider } from "../src/server/store/providers";
import { publishDue } from "../src/server/content";
import { purgeExpiredPrayers } from "../src/server/prayer";
import { GoogleHttpCalendarApi, importFromGoogle, projectEventToGoogle } from "../src/server/calendar/google";
import type { DB } from "../src/db";
import { emailHandlers } from "../src/server/mail-jobs";
import { instituicaoProvisoria as INST } from "../src/config/instituicao";
import { AlertTracker, collectChecks, sendTelegram, telegramEnabled, type Check } from "../src/server/alerts";

const env = process.env;
const client = postgres(env.DATABASE_URL!, { max: 4 });
const db = drizzle(client, { schema }) as unknown as DB;
const workerId = `${hostname()}:${process.pid}`;
const log = (nivel: string, evento: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), nivel, evento, worker: workerId, ...extra }));

const provider = env.PAYMENTS_PROVIDER === "simulado" && env.APP_ENV === "development" ? new SimulatedProvider(db, env.APP_SIGNING_KEY!) : null;
const receiver = provider ? "recebedor-dev" : env.PAYMENT_RECEIVER_ID ?? "__nao_configurado__";
const gcal = env.GOOGLE_CALENDAR_MODE !== "off" && env.GOOGLE_CALENDAR_ID && env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH
  ? new GoogleHttpCalendarApi(env.GOOGLE_CALENDAR_ID, env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH) : null;

const tg = { token: env.TELEGRAM_BOT_TOKEN, chatId: env.TELEGRAM_CHAT_ID };
const rotulo = `[${INST.nomePublico} · ${env.APP_ENV ?? "development"}]`;
const alerts = new AlertTracker(rotulo, Number(env.ALERT_REPEAT_HOURS ?? 6) * 3600_000);
const titles = new Map<string, string>();

/** Verificações + envio. Falha ao enviar não derruba o ciclo: o aviso é tentado de novo no próximo minuto. */
async function monitor(withAudit: boolean) {
  let checks: Check[];
  try {
    checks = await collectChecks(db, {
      audit: withAudit,
      healthUrl: env.HEALTH_URL || undefined,
      publicUrl: env.MONITOR_PUBLIC_URL || undefined,
      expectBackup: env.ALERT_EXPECT_BACKUP === "true",
    });
    checks.push({ key: "banco", title: "banco de dados inacessível para o worker", ok: true });
  } catch (e) {
    checks = [{ key: "banco", title: "banco de dados inacessível para o worker", ok: false, detail: String((e as Error).message ?? e).slice(0, 160) }];
  }
  for (const c of checks) titles.set(c.key, c.title);
  for (const o of alerts.plan(checks)) {
    log(o.kind === "resolvido" ? "info" : "alerta", `alerta.${o.kind}`, { chave: o.key });
    if (!telegramEnabled(tg)) { alerts.markSent(o, titles.get(o.key) ?? o.key); continue; }
    try { await sendTelegram(tg, o.text); alerts.markSent(o, titles.get(o.key) ?? o.key); }
    catch (e) { log("erro", "telegram_falhou", { chave: o.key, erro: String((e as Error).message ?? e).slice(0, 200) }); }
  }
}

const handlers: Record<string, JobHandler> = {
  // E-mails transacionais: modelos e envio em src/server/mail.ts (SMTP de qualquer provedor).
  ...emailHandlers(db, { SMTP_URL: env.SMTP_URL, MAIL_FROM: env.MAIL_FROM ?? `${INST.nomePublico} <nao-responda@exemplo.invalid>`, APP_ENV: env.APP_ENV ?? "development", EMAIL_DIR: env.EMAIL_DIR, APP_URL: env.APP_URL! }, INST.nomePublico),
  // Alertas operacionais: conteúdo mínimo, sem dados pessoais nem textos de oração.
  "alerta.operacional": async (p) => {
    log("alerta", "operacional", { tipo: p.kind });
    // Só o tipo da exceção (ex.: pagamento tardio); o detalhe fica no painel, em Loja → Exceções.
    if (telegramEnabled(tg)) await sendTelegram(tg, `⚠️ ${rotulo} — exceção operacional: ${String(p.kind).slice(0, 60)}. Ver o painel (Loja → Exceções).`);
  },
  "alerta.intercessores": async () => { log("info", "novos_pedidos_de_oracao"); },
  "inscricao.promover_espera": async (p) => { await promoteWaitlist(db, String(p.eventId)); },
  "pagamento.sincronizar": async (p) => { if (provider) await applyProviderState(db, provider, String(p.providerPaymentId), receiver); },
  "gcal.projetar": async (p) => { if (!gcal) throw new Error("Google Calendar não configurado"); await projectEventToGoogle(db, gcal, String(p.eventId), env.APP_URL!); },
};

let last15 = 0, lastDaily = 0, lastMonitor = 0, lastAudit = 0, stopping = false;
async function tick() {
  const now = Date.now();
  try {
    const n = await runJobsOnce(db, handlers, workerId);
    const holds = await expireHolds(db);
    const orders = await expireOrders(db);
    const pub = await publishDue(db);
    if (n || holds || orders || pub) log("info", "ciclo", { jobs: n, reservasExpiradas: holds, pedidosExpirados: orders, publicados: pub });
    if (now - last15 > 15 * 60_000) {
      last15 = now;
      if (provider) log("info", "conciliacao", await reconcile(db, provider, receiver));
      if (gcal && env.GOOGLE_CALENDAR_MODE === "google_to_cms") {
        try { log("info", "agenda_importada", await importFromGoogle(db, gcal, env.INSTITUTION_TIMEZONE)); }
        catch (e) { log("erro", "agenda_falhou", { erro: String(e).slice(0, 200) }); }
      }
    }
    if (now - lastDaily > 24 * 3600_000) {
      lastDaily = now;
      log("info", "expurgo_oracao", { removidos: await purgeExpiredPrayers(db) });
    }
  } catch (e) {
    log("erro", "ciclo_falhou", { erro: String(e).slice(0, 300) });
  }
  if (now - lastMonitor >= 60_000) {
    lastMonitor = now;
    const withAudit = now - lastAudit >= 3600_000;
    if (withAudit) lastAudit = now;
    await monitor(withAudit).catch((e) => log("erro", "monitor_falhou", { erro: String(e).slice(0, 200) }));
  }
  if (!stopping) setTimeout(tick, 10_000);
}

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, async () => { stopping = true; log("info", "encerrando"); await client.end({ timeout: 5 }); process.exit(0); });
log("info", "iniciado", { pagamentos: provider ? "simulado" : "off", agenda: env.GOOGLE_CALENDAR_MODE ?? "off", telegram: telegramEnabled(tg) });
tick();
