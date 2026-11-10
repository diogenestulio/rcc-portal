/**
 * Pedidos de oração — privados por padrão.
 *  - Sem busca, sem analytics, sem logs do texto, sem notificação com o texto integral.
 *  - Exclusão automática após RETENTION_DAYS (job diário). Prazo PROPOSTO, a validar (LGPD).
 *  - Somente papel `intercessor` lê (o administrador técnico NÃO lê por padrão).
 */
import { desc, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { prayerRequest } from "@/db/schema";
import { assertCan, type Subject } from "./authz";
import { audit } from "./audit";
import { enqueue } from "./jobs";

export const RETENTION_DAYS = 60;

export async function submitPrayer(db: DB, input: { firstName?: string; intention: string; wantsContact?: boolean; contact?: string }, now = new Date()) {
  const intention = input.intention.trim();
  if (intention.length < 3 || intention.length > 1500) throw new Error("Escreva sua intenção (até 1500 caracteres).");
  const [r] = await db.insert(prayerRequest).values({
    firstName: input.firstName?.trim().slice(0, 60) || null, intention,
    wantsContact: !!input.wantsContact, contact: input.wantsContact ? input.contact?.trim().slice(0, 120) || null : null,
    deleteAfter: new Date(now.getTime() + RETENTION_DAYS * 86_400_000),
  }).returning({ id: prayerRequest.id });
  // Notificação SEM o texto da intenção.
  await enqueue(db, "alerta.intercessores", { novos: true }, { dedupeKey: "alerta:intercessores" });
  return r.id;
}

export async function listPrayers(db: DB, s: Subject, limit = 50) {
  assertCan(s, "oracao.ler");
  await audit(db, { actorId: s.userId, action: "oracao.listar", resourceType: "prayer_request" });
  return db.select().from(prayerRequest).orderBy(desc(prayerRequest.createdAt)).limit(limit);
}

export async function purgeExpiredPrayers(db: DB, now = new Date()) {
  const r = await db.execute(sql`delete from prayer_request where delete_after <= ${now.toISOString()}::timestamptz returning id`);
  if (r.length) await audit(db, { action: "oracao.expurgo", resourceType: "prayer_request", detail: { quantidade: r.length } });
  return r.length;
}
