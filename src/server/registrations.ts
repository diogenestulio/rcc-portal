/**
 * Inscrições em eventos.
 *  - Reserva atômica: a linha do evento é travada (FOR UPDATE) e as vagas são contadas dentro
 *    da mesma transação — inscrições simultâneas nunca excedem a capacidade.
 *  - Evento gratuito: confirmação imediata após persistir. Evento pago: reserva com expiração;
 *    só confirma quando o pagamento é validado no servidor (ver store/payments.ts).
 *  - Duplicidade: mesmo e-mail + mesmo nome normalizado no mesmo evento é bloqueado; mesmo e-mail
 *    com outro nome é permitido (famílias costumam compartilhar e-mail).
 *  - Comprovante/QR: token opaco, sem CPF/e-mail.
 */
import { and, eq, sql } from "drizzle-orm";
import type { DB, Tx } from "@/db";
import { event, order, registration, ticketBatch } from "@/db/schema";
import { audit } from "./audit";
import { enqueue } from "./jobs";
import { opaqueToken } from "./tokens";

export class RegistrationError extends Error {
  constructor(public code: "nao_encontrado" | "fechada" | "esgotado" | "duplicada" | "invalida", msg: string) { super(msg); }
}

export const normalizeName = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Ocupação que conta contra a capacidade: confirmadas + reservas ainda válidas. */
async function occupied(tx: Tx, eventId: string, now: Date, batchId?: string | null) {
  const rows = await tx.execute<{ n: number }>(sql`
    select count(*)::int as n from registration
    where event_id = ${eventId}
      ${batchId ? sql`and batch_id = ${batchId}` : sql``}
      and (status in ('confirmada', 'em_resolucao') or (status = 'reservada' and hold_expires_at > ${now.toISOString()}::timestamptz))`);
  return rows[0].n;
}

export type RegistrationWindow = "nao_aplica" | "em_breve" | "abertas" | "encerradas" | "esgotadas";

export function registrationWindow(ev: Pick<typeof event.$inferSelect, "registrationEnabled" | "registrationOpensAt" | "registrationClosesAt" | "status" | "capacity" | "waitlistEnabled">, occupiedCount: number, now = new Date()): RegistrationWindow {
  if (!ev.registrationEnabled) return "nao_aplica";
  if (ev.status === "cancelado") return "encerradas";
  if (ev.registrationOpensAt && now < ev.registrationOpensAt) return "em_breve";
  if (ev.registrationClosesAt && now >= ev.registrationClosesAt) return "encerradas";
  if (ev.capacity != null && occupiedCount >= ev.capacity && !ev.waitlistEnabled) return "esgotadas";
  return "abertas";
}

export type RegisterInput = { eventId: string; batchId?: string | null; fullName: string; email: string; phone?: string | null; idempotencyKey: string };

export async function register(db: DB, input: RegisterInput, now = new Date()) {
  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  const email = input.email.trim().toLowerCase();
  if (fullName.length < 3 || fullName.length > 120) throw new RegistrationError("invalida", "Informe o nome completo.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw new RegistrationError("invalida", "E-mail inválido.");

  return db.transaction(async (tx) => {
    // Idempotência: reenvio do mesmo formulário devolve a mesma inscrição.
    const [prior] = await tx.select().from(registration).where(eq(registration.idempotencyKey, input.idempotencyKey));
    if (prior) return prior;

    const [ev] = await tx.select().from(event).where(eq(event.id, input.eventId)).for("update");
    if (!ev || ev.publication !== "publicado") throw new RegistrationError("nao_encontrado", "Evento não encontrado.");
    let batch: typeof ticketBatch.$inferSelect | undefined;
    if (input.batchId) {
      [batch] = await tx.select().from(ticketBatch).where(and(eq(ticketBatch.id, input.batchId), eq(ticketBatch.eventId, ev.id)));
      if (!batch) throw new RegistrationError("invalida", "Lote inválido.");
      if ((batch.salesStartAt && now < batch.salesStartAt) || (batch.salesEndAt && now >= batch.salesEndAt)) throw new RegistrationError("fechada", "Este lote não está à venda.");
    }
    const occ = await occupied(tx, ev.id, now);
    const win = registrationWindow(ev, occ, now);
    if (win !== "abertas") throw new RegistrationError(win === "esgotadas" ? "esgotado" : "fechada", win === "esgotadas" ? "Vagas esgotadas." : "Inscrições não estão abertas.");

    const dupes = await tx.select({ fullName: registration.fullName }).from(registration).where(and(
      eq(registration.eventId, ev.id), eq(registration.email, email),
      sql`${registration.status} in ('confirmada','reservada','lista_espera','em_resolucao')`));
    if (dupes.some((d) => normalizeName(d.fullName) === normalizeName(fullName))) throw new RegistrationError("duplicada", "Já existe uma inscrição com este nome e e-mail.");

    const eventFull = ev.capacity != null && occ >= ev.capacity;
    const batchFull = batch?.capacity != null && (await occupied(tx, ev.id, now, batch.id)) >= batch.capacity;
    if (batchFull && !eventFull) throw new RegistrationError("esgotado", "Este lote esgotou; escolha outro.");
    const price = batch?.priceCents ?? 0;
    const base = { eventId: ev.id, batchId: batch?.id ?? null, fullName, email, phone: input.phone?.trim() || null, priceCents: price, publicToken: opaqueToken(), idempotencyKey: input.idempotencyKey };

    if (eventFull) {
      // Só chega aqui com lista de espera habilitada.
      const [{ pos }] = await tx.execute<{ pos: number }>(sql`select coalesce(max(waitlist_position), 0)::int + 1 as pos from registration where event_id = ${ev.id} and status = 'lista_espera'`);
      const [r] = await tx.insert(registration).values({ ...base, status: "lista_espera", waitlistPosition: pos }).returning();
      await enqueue(tx, "email.inscricao", { registrationId: r.id, template: "lista_espera" }, { dedupeKey: `email:lista:${r.id}` });
      return r;
    }
    if (price === 0) {
      const [r] = await tx.insert(registration).values({ ...base, status: "confirmada", confirmedAt: now }).returning();
      await enqueue(tx, "email.inscricao", { registrationId: r.id, template: "confirmada" }, { dedupeKey: `email:conf:${r.id}` });
      return r;
    }
    const hold = new Date(now.getTime() + ev.holdMinutes * 60_000);
    const [o] = await tx.insert(order).values({
      publicToken: opaqueToken(), kind: "inscricao", status: "aguardando_pagamento", customerName: fullName, customerEmail: email,
      subtotalCents: price, totalCents: price, reservationExpiresAt: hold,
    }).returning();
    const [r] = await tx.insert(registration).values({ ...base, status: "reservada", holdExpiresAt: hold, orderId: o.id }).returning();
    return r;
  });
}

/** Libera reservas vencidas e promove a lista de espera. Idempotente. */
export async function expireHolds(db: DB, now = new Date()) {
  const expired = await db.execute<{ id: string; event_id: string }>(sql`
    update registration set status = 'expirada' where status = 'reservada' and hold_expires_at <= ${now.toISOString()}::timestamptz
    returning id, event_id`);
  const events = [...new Set(expired.map((r) => r.event_id))];
  for (const id of events) await promoteWaitlist(db, id, now);
  return expired.length;
}

export async function promoteWaitlist(db: DB, eventId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [ev] = await tx.select().from(event).where(eq(event.id, eventId)).for("update");
    if (!ev || ev.capacity == null) return 0;
    let free = ev.capacity - (await occupied(tx, ev.id, now));
    let promoted = 0;
    while (free > 0) {
      const [next] = await tx.execute<{ id: string; price_cents: number }>(sql`
        select id, price_cents from registration where event_id = ${ev.id} and status = 'lista_espera' order by waitlist_position limit 1 for update skip locked`);
      if (!next) break;
      if (next.price_cents === 0) {
        await tx.update(registration).set({ status: "confirmada", confirmedAt: now, waitlistPosition: null }).where(eq(registration.id, next.id));
        await enqueue(tx, "email.inscricao", { registrationId: next.id, template: "confirmada" }, { dedupeKey: `email:conf:${next.id}` });
      } else {
        const hold = new Date(now.getTime() + ev.holdMinutes * 60_000);
        await tx.update(registration).set({ status: "reservada", holdExpiresAt: hold, waitlistPosition: null }).where(eq(registration.id, next.id));
        await enqueue(tx, "email.inscricao", { registrationId: next.id, template: "vaga_liberada" }, { dedupeKey: `email:vaga:${next.id}` });
      }
      free--; promoted++;
    }
    return promoted;
  });
}

export async function cancelRegistration(db: DB, publicToken: string, actorId: string | null, now = new Date()) {
  const [r] = await db.update(registration).set({ status: "cancelada", cancelledAt: now })
    .where(and(eq(registration.publicToken, publicToken), sql`${registration.status} in ('confirmada','reservada','lista_espera')`)).returning();
  if (!r) throw new RegistrationError("nao_encontrado", "Inscrição não encontrada ou já cancelada.");
  await audit(db, { actorId, action: "inscricao.cancelar", resourceType: "registration", resourceId: r.id });
  // Reembolso de inscrição paga segue a política do evento: vai para a fila de exceções/operador.
  await promoteWaitlist(db, r.eventId, now);
  return r;
}

export type CheckinResult = { ok: true; name: string } | { ok: false; reason: "invalido" | "ja_utilizado" | "nao_confirmada" | "outro_evento" };

/** Check-in validado no servidor, com uso único garantido por UPDATE condicional. */
export async function checkIn(db: DB, eventId: string, token: string, operatorId: string): Promise<CheckinResult> {
  const done = await db.update(registration).set({ checkedInAt: new Date(), checkedInBy: operatorId })
    .where(and(eq(registration.publicToken, token), eq(registration.eventId, eventId), eq(registration.status, "confirmada"), sql`${registration.checkedInAt} is null`))
    .returning({ id: registration.id, fullName: registration.fullName });
  if (done[0]) {
    await audit(db, { actorId: operatorId, action: "inscricao.checkin", resourceType: "registration", resourceId: done[0].id });
    return { ok: true, name: done[0].fullName };
  }
  const [r] = await db.select().from(registration).where(eq(registration.publicToken, token));
  if (!r) return { ok: false, reason: "invalido" };
  if (r.eventId !== eventId) return { ok: false, reason: "outro_evento" };
  if (r.checkedInAt) return { ok: false, reason: "ja_utilizado" };
  return { ok: false, reason: "nao_confirmada" };
}
