/**
 * Worker de tarefas duráveis e agendadas (processo separado do Next.js — ADR-007).
 * - Fila `job` em PostgreSQL com SKIP LOCKED (pode haver mais de um worker).
 * - Rotinas periódicas: expirar reservas/pedidos, publicar agendados, conciliar pagamentos,
 *   importar agenda Google (se configurado), expurgar pedidos de oração.
 * Uso: npm run worker   (em produção: serviço systemd/container com reinício automático)
 */
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { runJobsOnce, type JobHandler } from "../src/server/jobs";
import { expireHolds, promoteWaitlist } from "../src/server/registrations";
import { expireOrders, reconcile, applyProviderState } from "../src/server/store/payments";
import { SimulatedProvider } from "../src/server/store/providers";
import { publishDue } from "../src/server/content";
import { purgeExpiredPrayers } from "../src/server/prayer";
import { GoogleHttpCalendarApi, importFromGoogle, projectEventToGoogle } from "../src/server/calendar/google";
import type { DB } from "../src/db";

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

/**
 * E-mail: sem SMTP configurado, desenvolvimento e homologação gravam .eml em EMAIL_DIR (para conferência);
 * em produção, falha (o job morre e vira alerta) — nunca finge que enviou.
 */
async function sendMail(to: string, subject: string, text: string) {
  if (!env.SMTP_URL) {
    if (env.APP_ENV === "producao") throw new Error("SMTP não configurado");
    const dir = env.EMAIL_DIR || "storage/emails";
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${Date.now()}-${Math.random().toString(36).slice(2)}.eml`, `To: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return;
  }
  throw new Error("Envio SMTP ainda não implementado: escolher provedor (docs/09-integracoes.md)");
}

const handlers: Record<string, JobHandler> = {
  "email.inscricao": async (p) => {
    const [r] = await db.select({ r: schema.registration, title: schema.event.title }).from(schema.registration)
      .innerJoin(schema.event, eq(schema.event.id, schema.registration.eventId)).where(eq(schema.registration.id, String(p.registrationId)));
    if (!r) return;
    const t = String(p.template);
    const subject = t === "confirmada" ? `Inscrição confirmada — ${r.title}` : t === "lista_espera" ? `Lista de espera — ${r.title}` : `Vaga liberada — ${r.title}`;
    await sendMail(r.r.email, subject, `Olá, ${r.r.fullName.split(" ")[0]}.\n\nSeu comprovante: ${env.APP_URL}/inscricao/${r.r.publicToken}\n\nRCC Arquidiocese de Cuiabá`);
  },
  "email.pedido": async (p) => {
    const [o] = await db.select().from(schema.order).where(eq(schema.order.id, String(p.orderId)));
    if (o) await sendMail(o.customerEmail, "Pagamento confirmado", `Seu pedido: ${env.APP_URL}/pedido/${o.publicToken}`);
  },
  "email.redefinir_senha": async (p) => {
    const [u] = await db.select().from(schema.user).where(eq(schema.user.id, String(p.userId)));
    if (u) await sendMail(u.email, "Redefinição de senha", `Para criar uma nova senha, acesse (válido por 30 minutos):\n${p.url}`);
  },
  // Alertas operacionais: conteúdo mínimo, sem dados pessoais nem textos de oração.
  "alerta.operacional": async (p) => { log("alerta", "operacional", { tipo: p.kind }); },
  "alerta.intercessores": async () => { log("info", "novos_pedidos_de_oracao"); },
  "inscricao.promover_espera": async (p) => { await promoteWaitlist(db, String(p.eventId)); },
  "pagamento.sincronizar": async (p) => { if (provider) await applyProviderState(db, provider, String(p.providerPaymentId), receiver); },
  "gcal.projetar": async (p) => { if (!gcal) throw new Error("Google Calendar não configurado"); await projectEventToGoogle(db, gcal, String(p.eventId), env.APP_URL!); },
};

let last15 = 0, lastDaily = 0, stopping = false;
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
  if (!stopping) setTimeout(tick, 10_000);
}

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, async () => { stopping = true; log("info", "encerrando"); await client.end({ timeout: 5 }); process.exit(0); });
log("info", "iniciado", { pagamentos: provider ? "simulado" : "off", agenda: env.GOOGLE_CALENDAR_MODE ?? "off" });
tick();
