// Casos de aceite 6, 8, 9 e 10: última unidade, webhook duplicado/atrasado, retorno do navegador,
// reembolso, reserva expirada e pagamento tardio.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeDb, makeEvent, reset } from "./helpers";
import { checkout, getOrCreateCart, setCartItem, CheckoutError } from "@/server/store/checkout";
import { SimulatedProvider, WebhookAuthError } from "@/server/store/providers";
import { applyProviderState, expireOrders, handleWebhook, reconcile, requestRefund } from "@/server/store/payments";
import { register } from "@/server/registrations";
import { exceptionCase, order, payment, product, productVariant, registration, stockMovement, ticketBatch } from "@/db/schema";
import { eq } from "drizzle-orm";

const { db, client } = makeDb(20);
afterAll(() => client.end());
beforeEach(() => reset(db));

const RECEIVER = "recebedor-dev";
const provider = () => new SimulatedProvider(db, "segredo-webhook-teste");
const appUrl = "http://localhost:3000";

async function variant(stock = 1, price = 3990) {
  const [p] = await db.insert(product).values({ slug: `p-${Math.random().toString(36).slice(2)}`, name: "Terço de madeira", active: true }).returning();
  const [v] = await db.insert(productVariant).values({ productId: p.id, sku: `SKU-${Math.random().toString(36).slice(2)}`, label: "Único", priceCents: price, stockOnHand: stock }).returning();
  return v;
}
async function cartWith(variantId: string, q = 1) {
  const c = await getOrCreateCart(db, null);
  await setCartItem(db, c.id, variantId, q);
  return c;
}
const buy = (pv: SimulatedProvider, cartToken: string, key: string) => checkout(db, pv, { cartToken, customerName: "Comprador Teste", customerEmail: "c@teste.invalid", shipping: { method: "retirada" }, idempotencyKey: key, appUrl, pickupEnabled: true });
async function sendWebhook(pv: SimulatedProvider, eventId: string, paymentId: string, tsOffset = 0) {
  const body = JSON.stringify({ id: eventId, payment_id: paymentId });
  const ts = Math.floor(Date.now() / 1000) + tsOffset;
  const h = new Headers({ "x-sim-timestamp": String(ts), "x-sim-signature": pv.sign(body, ts) });
  return handleWebhook(db, pv, h, body, RECEIVER);
}
const v0 = async (id: string) => (await db.select().from(productVariant).where(eq(productVariant.id, id)))[0];

describe("loja", () => {
  it("duas compras simultâneas da última unidade: no máximo uma alocação", async () => {
    const pv = provider();
    const v = await variant(1);
    const [c1, c2] = [await cartWith(v.id), await cartWith(v.id)];
    const res = await Promise.allSettled([buy(pv, c1.token, "a"), buy(pv, c2.token, "b")]);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rej = res.find((r): r is PromiseRejectedResult => r.status === "rejected")!;
    expect(rej.reason).toBeInstanceOf(CheckoutError);
    expect(await v0(v.id)).toMatchObject({ stockOnHand: 1, stockReserved: 1 });
  });

  it("preço é recalculado no servidor e fotografado no pedido", async () => {
    const pv = provider();
    const v = await variant(5, 1000);
    const c = await cartWith(v.id, 2);
    await db.update(productVariant).set({ priceCents: 1500 }).where(eq(productVariant.id, v.id));
    const { order: o } = await buy(pv, c.token, "k");
    expect(o.totalCents).toBe(3000);
  });

  it("frete indisponível nunca vira frete grátis", async () => {
    const v = await variant(2);
    const c = await cartWith(v.id);
    await expect(checkout(db, provider(), { cartToken: c.token, customerName: "X Teste", customerEmail: "x@teste.invalid", shipping: { method: "entrega", cep: "78000000" }, idempotencyKey: "f", appUrl, pickupEnabled: true }))
      .rejects.toMatchObject({ code: "frete_indisponivel" });
    expect(await v0(v.id)).toMatchObject({ stockReserved: 0 });
  });

  it("retorno do navegador não aprova: só o estado confirmado no provedor", async () => {
    const pv = provider();
    const v = await variant(1);
    const { order: o } = await buy(pv, (await cartWith(v.id)).token, "k");
    // Visitante volta do checkout: o pedido continua aguardando até o provedor confirmar.
    const [p] = await db.select().from(payment).where(eq(payment.orderId, o.id));
    expect(await applyProviderState(db, pv, p.providerPaymentId!, RECEIVER)).toBe("sem_mudanca");
    expect((await db.select().from(order).where(eq(order.id, o.id)))[0]).toMatchObject({ status: "aguardando_pagamento", paymentStatus: "pendente" });
  });

  it("webhook duplicado, repetido e fora de ordem não duplica baixa nem confirmação", async () => {
    const pv = provider();
    const v = await variant(3);
    const { order: o } = await buy(pv, (await cartWith(v.id, 2)).token, "k");
    const [p] = await db.select().from(payment).where(eq(payment.orderId, o.id));
    await pv.setState(p.providerPaymentId!, { status: "aprovado" });
    const r = await Promise.all([sendWebhook(pv, "ev1", p.providerPaymentId!), sendWebhook(pv, "ev1", p.providerPaymentId!), sendWebhook(pv, "ev2", p.providerPaymentId!)]);
    expect(r.filter((x) => x.duplicate)).toHaveLength(1);
    expect(await v0(v.id)).toMatchObject({ stockOnHand: 1, stockReserved: 0 });
    expect(await db.select().from(stockMovement).where(eq(stockMovement.orderId, o.id))).toHaveLength(1);
    expect((await db.select().from(order).where(eq(order.id, o.id)))[0]).toMatchObject({ status: "pago", stockCommitted: true });
    // Evento antigo chegando depois ("pendente" com stateAt anterior) é descartado
    await pv.setState(p.providerPaymentId!, { status: "pendente", stateAt: new Date(Date.now() - 3_600_000) });
    expect(await applyProviderState(db, pv, p.providerPaymentId!, RECEIVER)).toBe("obsoleto");
    expect((await db.select().from(payment).where(eq(payment.id, p.id)))[0].status).toBe("aprovado");
  });

  it("webhook sem assinatura válida ou fora da janela anti-replay é recusado", async () => {
    const pv = provider();
    const body = JSON.stringify({ id: "x", payment_id: "y" });
    await expect(handleWebhook(db, pv, new Headers({ "x-sim-timestamp": String(Math.floor(Date.now() / 1000)), "x-sim-signature": "00" }), body, RECEIVER)).rejects.toBeInstanceOf(WebhookAuthError);
    await expect(sendWebhook(pv, "old", "y", -3600)).rejects.toBeInstanceOf(WebhookAuthError);
  });

  it("valor ou recebedor divergente vai para exceções sem efeitos", async () => {
    const pv = provider();
    const v = await variant(1);
    const { order: o } = await buy(pv, (await cartWith(v.id)).token, "k");
    const [p] = await db.select().from(payment).where(eq(payment.orderId, o.id));
    await pv.setState(p.providerPaymentId!, { status: "aprovado", amountCents: 1 });
    expect(await applyProviderState(db, pv, p.providerPaymentId!, RECEIVER)).toBe("divergente");
    await pv.setState(p.providerPaymentId!, { status: "aprovado", amountCents: o.totalCents, receiverId: "outro" });
    expect(await applyProviderState(db, pv, p.providerPaymentId!, RECEIVER)).toBe("divergente");
    expect((await v0(v.id)).stockOnHand).toBe(1);
    expect((await db.select().from(exceptionCase)).length).toBeGreaterThanOrEqual(2);
  });

  it("reserva expirada libera estoque; pagamento tardio sem estoque vai para resolução", async () => {
    const pv = provider();
    const v = await variant(1);
    const { order: o1 } = await buy(pv, (await cartWith(v.id)).token, "k1");
    expect(await expireOrders(db, new Date(Date.now() + 31 * 60_000))).toBe(1);
    expect(await expireOrders(db, new Date(Date.now() + 31 * 60_000))).toBe(0);
    expect(await v0(v.id)).toMatchObject({ stockReserved: 0 });
    // Outra pessoa compra e paga a unidade liberada
    const { order: o2 } = await buy(pv, (await cartWith(v.id)).token, "k2");
    const [p2] = await db.select().from(payment).where(eq(payment.orderId, o2.id));
    await pv.setState(p2.providerPaymentId!, { status: "aprovado" });
    await applyProviderState(db, pv, p2.providerPaymentId!, RECEIVER);
    // O primeiro paga tarde: não há estoque → em resolução, sem prometer entrega
    const [p1] = await db.select().from(payment).where(eq(payment.orderId, o1.id));
    await pv.setState(p1.providerPaymentId!, { status: "aprovado" });
    expect(await applyProviderState(db, pv, p1.providerPaymentId!, RECEIVER)).toBe("aplicado");
    expect((await db.select().from(order).where(eq(order.id, o1.id)))[0]).toMatchObject({ status: "em_resolucao", stockCommitted: false });
    expect(await db.select().from(exceptionCase).where(eq(exceptionCase.kind, "pagamento_tardio_sem_estoque"))).toHaveLength(1);
    expect(await v0(v.id)).toMatchObject({ stockOnHand: 0, stockReserved: 0 });
  });

  it("pagamento tardio COM estoque disponível é alocado normalmente", async () => {
    const pv = provider();
    const v = await variant(2);
    const { order: o } = await buy(pv, (await cartWith(v.id)).token, "k");
    await expireOrders(db, new Date(Date.now() + 31 * 60_000));
    const [p] = await db.select().from(payment).where(eq(payment.orderId, o.id));
    await pv.setState(p.providerPaymentId!, { status: "aprovado" });
    await applyProviderState(db, pv, p.providerPaymentId!, RECEIVER);
    expect((await db.select().from(order).where(eq(order.id, o.id)))[0].status).toBe("pago");
    expect(await v0(v.id)).toMatchObject({ stockOnHand: 1, stockReserved: 0 });
  });

  it("reembolso parcial e total não repõem estoque automaticamente; transição inválida é recusada", async () => {
    const pv = provider();
    const v = await variant(2, 5000);
    const { order: o } = await buy(pv, (await cartWith(v.id)).token, "k");
    const [p] = await db.select().from(payment).where(eq(payment.orderId, o.id));
    await pv.setState(p.providerPaymentId!, { status: "aprovado" });
    await applyProviderState(db, pv, p.providerPaymentId!, RECEIVER);
    await requestRefund(db, pv, "operador", o.id, 2000, "avaria");
    await reconcile(db, pv, RECEIVER);
    expect((await db.select().from(payment).where(eq(payment.id, p.id)))[0]).toMatchObject({ status: "estornado_parcial", refundedCents: 2000 });
    await expect(requestRefund(db, pv, "operador", o.id, 3001, "x")).rejects.toThrow(/inválido/);
    await requestRefund(db, pv, "operador", o.id, 3000, "desistência");
    await reconcile(db, pv, RECEIVER);
    expect((await db.select().from(payment).where(eq(payment.id, p.id)))[0]).toMatchObject({ status: "estornado", refundedCents: 5000 });
    expect((await v0(v.id)).stockOnHand).toBe(1);
    await pv.setState(p.providerPaymentId!, { status: "aprovado", refundedCents: 5000 });
    expect(await applyProviderState(db, pv, p.providerPaymentId!, RECEIVER)).toBe("transicao_invalida");
  });

  it("inscrição paga: confirma só com pagamento validado; aprovado após expirar sem vaga vai para resolução", async () => {
    const pv = provider();
    const ev = await makeEvent(db, { capacity: 1, holdMinutes: 10 });
    const [lote] = await db.insert(ticketBatch).values({ eventId: ev.id, name: "Único", priceCents: 8000 }).returning();
    const r = await register(db, { eventId: ev.id, batchId: lote.id, fullName: "Inscrito Teste", email: "i@teste.invalid", idempotencyKey: "i" });
    const co = await pv.createCheckout({ orderRef: r.orderId!, amountCents: 8000 });
    await db.insert(payment).values({ orderId: r.orderId!, provider: "simulado", providerPaymentId: co.providerPaymentId, amountCents: 8000 });
    // expira e outra pessoa ocupa a vaga
    const { expireHolds } = await import("@/server/registrations");
    await expireHolds(db, new Date(Date.now() + 11 * 60_000));
    await db.update(ticketBatch).set({ priceCents: 0 }).where(eq(ticketBatch.id, lote.id));
    await register(db, { eventId: ev.id, batchId: lote.id, fullName: "Outra Pessoa", email: "o@teste.invalid", idempotencyKey: "o" });
    await pv.setState(co.providerPaymentId, { status: "aprovado" });
    await applyProviderState(db, pv, co.providerPaymentId, RECEIVER);
    const [rr] = await db.select().from(registration).where(eq(registration.id, r.id));
    expect(rr.status).toBe("em_resolucao");
    const confirmed = await db.select().from(registration).where(eq(registration.status, "confirmada"));
    expect(confirmed).toHaveLength(1);
  });
});
