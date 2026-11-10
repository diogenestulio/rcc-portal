/**
 * Carrinho e checkout.
 *  - Preço, desconto, frete e total são SEMPRE recalculados no servidor a partir do banco.
 *  - Estoque reservado por UPDATE condicional (stock_on_hand - stock_reserved >= q): duas compras
 *    da última unidade resultam em no máximo uma reserva.
 *  - Nenhuma transação fica aberta durante a chamada ao provedor.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { cart, cartItem, order, orderItem, payment, product, productVariant } from "@/db/schema";
import { opaqueToken } from "../tokens";
import type { PaymentProvider } from "./providers";
import { audit } from "../audit";

export class CheckoutError extends Error {
  constructor(public code: "carrinho_vazio" | "indisponivel" | "sem_estoque" | "frete_indisponivel" | "invalido" | "loja_desativada", msg: string) { super(msg); }
}

export const formatBRL = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export async function getOrCreateCart(db: DB, token?: string | null) {
  if (token) {
    const [c] = await db.select().from(cart).where(and(eq(cart.token, token), sql`${cart.expiresAt} > now()`));
    if (c) return c;
  }
  const [c] = await db.insert(cart).values({ token: opaqueToken(24), expiresAt: new Date(Date.now() + 30 * 86_400_000) }).returning();
  return c;
}

export async function setCartItem(db: DB, cartId: string, variantId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 20) throw new CheckoutError("invalido", "Quantidade inválida.");
  if (quantity === 0) { await db.delete(cartItem).where(and(eq(cartItem.cartId, cartId), eq(cartItem.variantId, variantId))); return; }
  const [v] = await db.select({ id: productVariant.id }).from(productVariant).innerJoin(product, eq(product.id, productVariant.productId))
    .where(and(eq(productVariant.id, variantId), eq(productVariant.active, true), eq(product.active, true)));
  if (!v) throw new CheckoutError("indisponivel", "Produto indisponível.");
  await db.insert(cartItem).values({ cartId, variantId, quantity }).onConflictDoUpdate({ target: [cartItem.cartId, cartItem.variantId], set: { quantity } });
}

export type Pricing = { lines: { variantId: string; sku: string; productName: string; variantLabel: string; unitPriceCents: number; quantity: number; lineCents: number }[]; subtotalCents: number; discountCents: number; shippingCents: number; totalCents: number };

export async function priceCart(db: DB, cartId: string): Promise<Pricing> {
  const rows = await db.select({
    variantId: productVariant.id, sku: productVariant.sku, variantLabel: productVariant.label, unitPriceCents: productVariant.priceCents,
    quantity: cartItem.quantity, productName: product.name, active: sql<boolean>`${product.active} and ${productVariant.active}`,
  }).from(cartItem).innerJoin(productVariant, eq(productVariant.id, cartItem.variantId)).innerJoin(product, eq(product.id, productVariant.productId))
    .where(eq(cartItem.cartId, cartId));
  const lines = rows.filter((r) => r.active).map((r) => ({ ...r, lineCents: r.unitPriceCents * r.quantity }));
  const subtotalCents = lines.reduce((a, l) => a + l.lineCents, 0);
  return { lines, subtotalCents, discountCents: 0, shippingCents: 0, totalCents: subtotalCents };
}

export type ShippingChoice = { method: "retirada" } | { method: "entrega"; cep: string };

export async function checkout(db: DB, provider: PaymentProvider | null, input: {
  cartToken: string; customerName: string; customerEmail: string; customerPhone?: string; shipping: ShippingChoice;
  idempotencyKey: string; appUrl: string; pickupEnabled: boolean; holdMinutes?: number;
}, now = new Date()) {
  if (!provider) throw new CheckoutError("loja_desativada", "Pagamentos ainda não estão ativos.");
  const [c] = await db.select().from(cart).where(eq(cart.token, input.cartToken));
  if (!c) throw new CheckoutError("carrinho_vazio", "Carrinho não encontrado.");
  // Idempotência do envio
  const [prior] = await db.select().from(order).where(eq(order.idempotencyKey, input.idempotencyKey));
  if (prior) return { order: prior, checkoutUrl: null as string | null };

  const pricing = await priceCart(db, c.id);
  if (pricing.lines.length === 0) throw new CheckoutError("carrinho_vazio", "Seu carrinho está vazio.");
  const shippingCents = 0; // retirada local; entrega depende de transportadora (bloqueada)
  if (input.shipping.method === "retirada") {
    if (!input.pickupEnabled) throw new CheckoutError("invalido", "Retirada local não disponível.");
  } else {
    // Nenhuma transportadora configurada: nunca inventamos frete grátis.
    throw new CheckoutError("frete_indisponivel", "Cálculo de frete indisponível no momento. Tente novamente mais tarde.");
  }
  const total = pricing.subtotalCents - pricing.discountCents + shippingCents;
  const expiresAt = new Date(now.getTime() + (input.holdMinutes ?? 30) * 60_000);

  // 1) Transação curta: pedido + itens (fotografia) + reservas de estoque.
  const created = await db.transaction(async (tx) => {
    const [o] = await tx.insert(order).values({
      publicToken: opaqueToken(), status: "aguardando_pagamento", customerName: input.customerName.trim(), customerEmail: input.customerEmail.trim().toLowerCase(),
      customerPhone: input.customerPhone ?? null, subtotalCents: pricing.subtotalCents, discountCents: pricing.discountCents, shippingCents,
      totalCents: total, reservationExpiresAt: expiresAt, idempotencyKey: input.idempotencyKey,
    }).returning();
    for (const l of pricing.lines) {
      const res = await tx.execute(sql`update product_variant set stock_reserved = stock_reserved + ${l.quantity}
        where id = ${l.variantId} and stock_on_hand - stock_reserved >= ${l.quantity} returning id`);
      if (res.length === 0) throw new CheckoutError("sem_estoque", `Sem estoque suficiente de “${l.productName} – ${l.variantLabel}”.`);
      await tx.insert(orderItem).values({ orderId: o.id, variantId: l.variantId, sku: l.sku, productName: l.productName, variantLabel: l.variantLabel, unitPriceCents: l.unitPriceCents, quantity: l.quantity });
    }
    await tx.delete(cartItem).where(eq(cartItem.cartId, c.id));
    return o;
  });

  // 2) Fora da transação: cria a cobrança no provedor (checkout hospedado).
  const co = await provider.createCheckout({ orderRef: created.id, amountCents: total, description: `Pedido ${created.id.slice(0, 8)}`, returnUrl: `${input.appUrl}/pedido/${created.publicToken}`, expiresAt });
  await db.insert(payment).values({ orderId: created.id, provider: provider.name, providerPaymentId: co.providerPaymentId, amountCents: total });
  await audit(db, { action: "pedido.criar", resourceType: "order", resourceId: created.id, detail: { totalCents: total } });
  return { order: created, checkoutUrl: co.checkoutUrl };
}

export async function orderItemsFor(db: DB, orderIds: string[]) {
  if (orderIds.length === 0) return [];
  return db.select().from(orderItem).where(inArray(orderItem.orderId, orderIds));
}
