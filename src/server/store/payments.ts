/**
 * Aplicação de estados de pagamento — idempotente e tolerante a eventos repetidos, fora de ordem
 * e atrasados. Regras (tests/payments.test.ts):
 *  - Webhook autenticado → registrado UMA vez (inbox) → estado reconsultado no provedor → aplicado.
 *  - Identificador, valor, moeda e recebedor conferidos contra o pedido; divergência vai para a
 *    fila de exceções sem efeitos.
 *  - Baixa de estoque única (flag stock_committed + índice único em stock_movement).
 *  - Pagamento aprovado após expiração: tenta alocar de novo; se impossível → "em_resolucao".
 *  - Estorno não repõe estoque físico automaticamente.
 *  - O retorno do navegador NUNCA marca pagamento como aprovado.
 */
import { and, eq, sql } from "drizzle-orm";
import type { DB, Tx } from "@/db";
import { event, exceptionCase, order, orderItem, payment, refund, registration, stockMovement, webhookInbox } from "@/db/schema";
import { audit } from "../audit";
import { enqueue } from "../jobs";
import { promoteWaitlist } from "../registrations";
import type { PaymentProvider, ProviderPaymentState } from "./providers";

type PStatus = ProviderPaymentState["status"];
const ALLOWED: Record<PStatus, PStatus[]> = {
  pendente: ["aprovado", "recusado", "expirado"],
  recusado: ["aprovado", "expirado"],
  expirado: ["aprovado"],
  aprovado: ["estornado", "estornado_parcial", "chargeback"],
  estornado_parcial: ["estornado", "chargeback", "estornado_parcial"],
  estornado: [],
  chargeback: [],
};
export const canTransition = (from: PStatus, to: PStatus) => from === to ? false : ALLOWED[from].includes(to);

export type ApplyResult = "aplicado" | "sem_mudanca" | "obsoleto" | "transicao_invalida" | "divergente" | "desconhecido";

async function openException(tx: Tx, kind: string, detail: string, ids: { orderId?: string; registrationId?: string }) {
  await tx.insert(exceptionCase).values({ kind, detail, orderId: ids.orderId ?? null, registrationId: ids.registrationId ?? null });
  await enqueue(tx, "alerta.operacional", { kind, orderId: ids.orderId ?? null }, { dedupeKey: `alerta:${kind}:${ids.orderId ?? ids.registrationId}` });
}

/** Baixa definitiva do estoque reservado (ou nova alocação, se a reserva já expirou). */
async function commitStock(tx: Tx, o: typeof order.$inferSelect): Promise<boolean> {
  if (o.stockCommitted) return true;
  const items = await tx.select().from(orderItem).where(eq(orderItem.orderId, o.id));
  const ok = await tx.transaction(async (sp) => { // savepoint: tudo ou nada
    for (const it of items) {
      if (!it.variantId) continue;
      const res = o.reservationReleased
        ? await sp.execute(sql`update product_variant set stock_on_hand = stock_on_hand - ${it.quantity}
            where id = ${it.variantId} and stock_on_hand - stock_reserved >= ${it.quantity} returning id`)
        : await sp.execute(sql`update product_variant set stock_on_hand = stock_on_hand - ${it.quantity}, stock_reserved = stock_reserved - ${it.quantity}
            where id = ${it.variantId} and stock_reserved >= ${it.quantity} and stock_on_hand >= ${it.quantity} returning id`);
      if (res.length === 0) { sp.rollback(); }
      await sp.insert(stockMovement).values({ variantId: it.variantId, kind: "baixa_venda", quantity: -it.quantity, orderId: o.id });
    }
    return true;
  }).catch((e) => { if (e?.constructor?.name === "TransactionRollbackError") return false; throw e; });
  if (ok) await tx.update(order).set({ stockCommitted: true, reservationReleased: true }).where(eq(order.id, o.id));
  return ok;
}

async function onApproved(tx: Tx, o: typeof order.$inferSelect, now: Date) {
  if (o.kind === "inscricao") {
    const [r] = await tx.select().from(registration).where(eq(registration.orderId, o.id)).for("update");
    if (!r) { await openException(tx, "inscricao_sem_registro", "Pagamento aprovado sem inscrição vinculada.", { orderId: o.id }); return; }
    if (r.status === "confirmada") return;
    let seatOk = r.status === "reservada" && (!r.holdExpiresAt || r.holdExpiresAt > now);
    if (!seatOk && (r.status === "reservada" || r.status === "expirada")) {
      // Reserva expirou: tenta alocar vaga de novo, com a linha do evento travada.
      const [ev] = await tx.select().from(event).where(eq(event.id, r.eventId)).for("update");
      const [{ n }] = await tx.execute<{ n: number }>(sql`select count(*)::int as n from registration where event_id = ${r.eventId} and id <> ${r.id}
        and (status in ('confirmada','em_resolucao') or (status = 'reservada' and hold_expires_at > ${now.toISOString()}::timestamptz))`);
      seatOk = ev.capacity == null || n < ev.capacity;
    }
    if (seatOk) {
      await tx.update(registration).set({ status: "confirmada", confirmedAt: now, holdExpiresAt: null }).where(eq(registration.id, r.id));
      await tx.update(order).set({ status: "pago", updatedAt: now }).where(eq(order.id, o.id));
      await enqueue(tx, "email.inscricao", { registrationId: r.id, template: "confirmada" }, { dedupeKey: `email:conf:${r.id}` });
    } else {
      await tx.update(registration).set({ status: "em_resolucao" }).where(eq(registration.id, r.id));
      await tx.update(order).set({ status: "em_resolucao", updatedAt: now }).where(eq(order.id, o.id));
      await openException(tx, "pagamento_tardio_sem_vaga", "Pagamento aprovado após expirar a reserva e sem vaga disponível: decidir vaga extra ou reembolso.", { orderId: o.id, registrationId: r.id });
    }
    return;
  }
  const ok = await commitStock(tx, o);
  if (ok) {
    await tx.update(order).set({ status: "pago", updatedAt: now }).where(eq(order.id, o.id));
    await enqueue(tx, "email.pedido", { orderId: o.id, template: "pago" }, { dedupeKey: `email:pago:${o.id}` });
  } else {
    await tx.update(order).set({ status: "em_resolucao", updatedAt: now }).where(eq(order.id, o.id));
    await openException(tx, "pagamento_tardio_sem_estoque", "Pagamento aprovado após expirar a reserva e sem estoque: decidir reposição ou reembolso. Não prometer entrega.", { orderId: o.id });
  }
}

export async function applyProviderState(db: DB, provider: PaymentProvider, providerPaymentId: string, expectedReceiver: string, now = new Date()): Promise<ApplyResult> {
  const st = await provider.fetchPayment(providerPaymentId); // fora da transação
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(payment).where(and(eq(payment.provider, provider.name), eq(payment.providerPaymentId, providerPaymentId))).for("update");
    if (!p) return "desconhecido";
    const [o] = await tx.select().from(order).where(eq(order.id, p.orderId)).for("update");
    if (st.orderRef !== o.id || st.amountCents !== p.amountCents || st.amountCents !== o.totalCents || st.currency !== "BRL" || st.receiverId !== expectedReceiver) {
      await openException(tx, "pagamento_divergente", `Divergência (ref/valor/moeda/recebedor) no pagamento ${p.id}.`, { orderId: o.id });
      await audit(tx, { action: "pagamento.divergente", resourceType: "payment", resourceId: p.id, result: "negado" });
      return "divergente";
    }
    if (p.providerStateAt && st.stateAt.getTime() < p.providerStateAt.getTime()) return "obsoleto";
    const refundedChanged = st.refundedCents !== p.refundedCents;
    if (st.status === p.status && !refundedChanged) return "sem_mudanca";
    if (st.status !== p.status && !canTransition(p.status as PStatus, st.status)) {
      await audit(tx, { action: "pagamento.transicao_invalida", resourceType: "payment", resourceId: p.id, result: "negado", detail: { de: p.status, para: st.status } });
      return "transicao_invalida";
    }
    await tx.update(payment).set({ status: st.status, refundedCents: st.refundedCents, providerStateAt: st.stateAt, method: st.method ?? p.method,
      approvedAt: st.status === "aprovado" ? now : p.approvedAt, updatedAt: now }).where(eq(payment.id, p.id));
    await tx.update(order).set({ paymentStatus: st.status, updatedAt: now }).where(eq(order.id, o.id));

    if (st.status === "aprovado") await onApproved(tx, o, now);
    if (st.status === "estornado" && o.kind === "inscricao") {
      const [r] = await tx.update(registration).set({ status: "cancelada", cancelledAt: now }).where(and(eq(registration.orderId, o.id), sql`${registration.status} <> 'cancelada'`)).returning();
      if (r) await enqueue(tx, "inscricao.promover_espera", { eventId: r.eventId }, { dedupeKey: `espera:${r.eventId}` });
    }
    if (st.status === "chargeback") await openException(tx, "chargeback", "Contestação aberta pelo pagador.", { orderId: o.id });
    await audit(tx, { action: `pagamento.${st.status}`, resourceType: "payment", resourceId: p.id, detail: { pedido: o.id, valorCents: st.amountCents, estornadoCents: st.refundedCents } });
    return "aplicado";
  });
}

/** Entrada do webhook: autentica, deduplica e aplica. Falha de aplicação vira job de retentativa. */
export async function handleWebhook(db: DB, provider: PaymentProvider, headers: Headers, rawBody: string, expectedReceiver: string, now = new Date()) {
  const signal = provider.verifyWebhook(headers, rawBody, now); // lança WebhookAuthError
  const ins = await db.insert(webhookInbox).values({ provider: provider.name, externalEventId: signal.eventId }).onConflictDoNothing().returning({ id: webhookInbox.id });
  if (ins.length === 0) return { duplicate: true as const };
  try {
    const result = await applyProviderState(db, provider, signal.providerPaymentId, expectedReceiver, now);
    await db.update(webhookInbox).set({ processedAt: new Date(), result }).where(eq(webhookInbox.id, ins[0].id));
    return { duplicate: false as const, result };
  } catch (e) {
    await db.update(webhookInbox).set({ result: `erro: ${String(e).slice(0, 200)}` }).where(eq(webhookInbox.id, ins[0].id));
    await enqueue(db, "pagamento.sincronizar", { provider: provider.name, providerPaymentId: signal.providerPaymentId }, { dedupeKey: `sync:${signal.providerPaymentId}` });
    return { duplicate: false as const, result: "reprocessar" as const };
  }
}

/** Libera reservas de estoque de pedidos não pagos e vencidos. Idempotente. */
export async function expireOrders(db: DB, now = new Date()) {
  const due = await db.select({ id: order.id }).from(order).where(and(eq(order.status, "aguardando_pagamento"), eq(order.kind, "loja"),
    eq(order.stockCommitted, false), eq(order.reservationReleased, false), sql`${order.reservationExpiresAt} <= ${now.toISOString()}::timestamptz`));
  let n = 0;
  for (const { id } of due) {
    await db.transaction(async (tx) => {
      const [o] = await tx.select().from(order).where(eq(order.id, id)).for("update");
      if (o.stockCommitted || o.reservationReleased || o.status !== "aguardando_pagamento") return;
      const items = await tx.select().from(orderItem).where(eq(orderItem.orderId, id));
      for (const it of items) if (it.variantId) await tx.execute(sql`update product_variant set stock_reserved = greatest(0, stock_reserved - ${it.quantity}) where id = ${it.variantId}`);
      await tx.update(order).set({ reservationReleased: true, status: "expirado", updatedAt: now }).where(eq(order.id, id));
      await audit(tx, { action: "pedido.expirar", resourceType: "order", resourceId: id });
      n++;
    });
  }
  return n;
}

/** Reembolso total ou parcial. O estado final chega pelo provedor (webhook/conciliação). */
export async function requestRefund(db: DB, provider: PaymentProvider, actorId: string, orderId: string, amountCents: number, reason: string) {
  const [p] = await db.select().from(payment).where(and(eq(payment.orderId, orderId), sql`${payment.status} in ('aprovado','estornado_parcial')`));
  if (!p) throw new Error("Não há pagamento aprovado para reembolsar.");
  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > p.amountCents - p.refundedCents) throw new Error("Valor de reembolso inválido.");
  const key = `refund:${p.id}:${p.refundedCents}:${amountCents}`;
  const r = await provider.refund(p.providerPaymentId!, amountCents, key);
  await db.insert(refund).values({ paymentId: p.id, providerRefundId: r.providerRefundId, amountCents, reason }).onConflictDoNothing();
  await audit(db, { actorId, action: "pedido.reembolso_solicitado", resourceType: "order", resourceId: orderId, detail: { valorCents: amountCents } });
  return r;
}

/** Conciliação periódica: reconsulta pagamentos pendentes/recentes (pega webhooks perdidos). */
export async function reconcile(db: DB, provider: PaymentProvider, expectedReceiver: string, sinceHours = 72) {
  const rows = await db.select({ id: payment.providerPaymentId }).from(payment).where(and(eq(payment.provider, provider.name),
    sql`${payment.createdAt} > now() - make_interval(hours => ${sinceHours})`, sql`${payment.status} in ('pendente','aprovado','estornado_parcial')`));
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (!r.id) continue;
    try { const res = await applyProviderState(db, provider, r.id, expectedReceiver); out[res] = (out[res] ?? 0) + 1; }
    catch { out.erro = (out.erro ?? 0) + 1; }
  }
  return out;
}

export { promoteWaitlist };
