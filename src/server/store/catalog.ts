/**
 * Catálogo, estoque e operação de pedidos (painel). Regras (tests/catalog.test.ts):
 *  - Dinheiro digitado ("39,90", "R$ 1.234,50") vira centavos inteiros; nunca ponto flutuante.
 *  - Estoque só muda por movimentação registrada (entrada/ajuste/devolução) e nunca fica abaixo do
 *    que está reservado em carrinhos/pedidos em andamento.
 *  - Entrega segue etapas válidas e só começa com pagamento aprovado.
 *  - Leitura pública mostra apenas produtos ativos com variantes ativas.
 */
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { DB } from "@/db";
import { exceptionCase, order, orderItem, payment, product, productVariant, stockMovement } from "@/db/schema";
import { assertCan, type Subject } from "../authz";
import { audit } from "../audit";

export class CatalogError extends Error {}

/** "39,90" | "39.90" | "R$ 1.234,50" | "40" → centavos. Lança se inválido. */
export function parseBRL(input: string): number {
  const s = input.replace(/R\$|\s/g, "").trim();
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(s)) throw new CatalogError(`Valor inválido: “${input}”. Use, por exemplo, 39,90.`);
  let norm = s;
  if (/,\d{1,2}$/.test(s)) norm = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) norm = s.replace(/\./g, "");
  const [int, dec = ""] = norm.split(".");
  const cents = Number(int) * 100 + Number((dec + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents > 10_000_000_00) throw new CatalogError("Valor fora do limite.");
  return cents;
}
export const centsToInput = (c: number) => `${Math.floor(c / 100)},${String(c % 100).padStart(2, "0")}`;

const slugOk = (s: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length <= 80;
const skuOk = (s: string) => /^[A-Z0-9][A-Z0-9-]{1,39}$/.test(s);

// ───────── Leitura pública ─────────
export async function publicCatalog(db: DB, f: { categoria?: string; q?: string }) {
  const where: SQL[] = [eq(product.active, true)];
  if (f.categoria) where.push(eq(product.category, f.categoria.slice(0, 60)));
  if (f.q) { const like = `%${f.q.slice(0, 80).replace(/[\\%_]/g, (c) => "\\" + c)}%`; where.push(or(ilike(product.name, like), ilike(product.description, like))!); }
  const prods = await db.select().from(product).where(and(...where)).orderBy(asc(product.name)).limit(200);
  if (!prods.length) return [];
  const vars = await db.select().from(productVariant).where(and(inArray(productVariant.productId, prods.map((p) => p.id)), eq(productVariant.active, true)));
  return prods.map((p) => {
    const vs = vars.filter((v) => v.productId === p.id);
    return { ...p, fromCents: vs.length ? Math.min(...vs.map((v) => v.priceCents)) : null, available: vs.some((v) => v.stockOnHand - v.stockReserved > 0), variants: vs.length };
  }).filter((p) => p.variants > 0);
}

export async function publicCategories(db: DB) {
  const r = await db.execute<{ category: string }>(sql`select distinct category from product where active and category is not null order by category`);
  return r.map((x) => x.category);
}

export async function publicProduct(db: DB, slug: string) {
  const [p] = await db.select().from(product).where(and(eq(product.slug, slug), eq(product.active, true)));
  if (!p) return null;
  const vs = await db.select().from(productVariant).where(and(eq(productVariant.productId, p.id), eq(productVariant.active, true))).orderBy(asc(productVariant.priceCents), asc(productVariant.label));
  if (!vs.length) return null;
  return { p, variants: vs.map((v) => ({ id: v.id, label: v.label, sku: v.sku, priceCents: v.priceCents, disponivel: Math.max(0, v.stockOnHand - v.stockReserved) })) };
}

// ───────── Painel: produtos e variantes ─────────
export type ProductInput = { name: string; slug: string; category?: string | null; description?: string | null; coverMediaId?: string | null; active?: boolean };

export async function saveProduct(db: DB, s: Subject, id: string | null, input: ProductInput) {
  assertCan(s, "loja.produtos");
  const name = input.name.trim();
  if (name.length < 3 || name.length > 160) throw new CatalogError("Nome entre 3 e 160 caracteres.");
  if (!slugOk(input.slug)) throw new CatalogError("Endereço inválido: minúsculas, números e hífens.");
  const values = { name, slug: input.slug, category: input.category?.trim().slice(0, 60) || null, description: input.description?.trim().slice(0, 5000) || null,
    coverMediaId: input.coverMediaId || null, active: !!input.active, updatedAt: new Date() };
  if (values.active && id) {
    const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from product_variant where product_id = ${id} and active`);
    if (n === 0) throw new CatalogError("Cadastre ao menos uma variante ativa antes de publicar o produto.");
  } else if (values.active && !id) throw new CatalogError("Salve o produto, cadastre as variantes e só então publique.");
  try {
    const r = id
      ? await db.update(product).set(values).where(eq(product.id, id)).returning({ id: product.id })
      : await db.insert(product).values(values).returning({ id: product.id });
    if (!r.length) throw new CatalogError("Produto não encontrado.");
    await audit(db, { actorId: s.userId, action: id ? "loja.produto_editar" : "loja.produto_criar", resourceType: "product", resourceId: r[0].id, detail: { ativo: values.active } });
    return r[0].id;
  } catch (e) {
    if ((e as { cause?: { code?: string } })?.cause?.code === "23505") throw new CatalogError("Já existe um produto com este endereço.");
    throw e;
  }
}

export async function saveVariant(db: DB, s: Subject, productId: string, id: string | null, input: { sku: string; label: string; price: string; weightGrams?: number | null; active?: boolean }) {
  assertCan(s, "loja.produtos");
  const sku = input.sku.trim().toUpperCase();
  if (!skuOk(sku)) throw new CatalogError("Código (SKU) inválido: letras maiúsculas, números e hífens (2 a 40).");
  const label = input.label.trim().slice(0, 80);
  if (!label) throw new CatalogError("Informe a variante (ex.: Único, P, M, Azul).");
  const priceCents = parseBRL(input.price);
  const values = { sku, label, priceCents, weightGrams: input.weightGrams ?? null, active: input.active ?? true };
  try {
    const r = id
      ? await db.update(productVariant).set(values).where(and(eq(productVariant.id, id), eq(productVariant.productId, productId))).returning({ id: productVariant.id })
      : await db.insert(productVariant).values({ ...values, productId }).returning({ id: productVariant.id });
    if (!r.length) throw new CatalogError("Variante não encontrada.");
    await audit(db, { actorId: s.userId, action: id ? "loja.variante_editar" : "loja.variante_criar", resourceType: "product_variant", resourceId: r[0].id, detail: { sku, precoCents: priceCents } });
    return r[0].id;
  } catch (e) {
    if ((e as { cause?: { code?: string } })?.cause?.code === "23505") throw new CatalogError("Já existe uma variante com este código (SKU).");
    throw e;
  }
}

/** Entrada (+), ajuste (±, ex.: inventário) ou devolução (+). Nunca abaixo do reservado. */
export async function moveStock(db: DB, s: Subject, variantId: string, kind: "entrada" | "ajuste" | "devolucao", quantity: number, note: string) {
  assertCan(s, "loja.produtos");
  if (!Number.isInteger(quantity) || quantity === 0 || Math.abs(quantity) > 100_000) throw new CatalogError("Quantidade inválida.");
  if (kind !== "ajuste" && quantity < 0) throw new CatalogError("Entrada e devolução precisam ser positivas; para baixar, use ajuste.");
  if (kind === "ajuste" && note.trim().length < 3) throw new CatalogError("Explique o motivo do ajuste (ex.: contagem de inventário).");
  return db.transaction(async (tx) => {
    const r = await tx.execute<{ stock_on_hand: number }>(sql`update product_variant set stock_on_hand = stock_on_hand + ${quantity}
      where id = ${variantId} and stock_on_hand + ${quantity} >= stock_reserved returning stock_on_hand`);
    if (!r.length) throw new CatalogError("O estoque não pode ficar abaixo do que está reservado em pedidos em andamento.");
    await tx.insert(stockMovement).values({ variantId, kind, quantity, note: note.trim().slice(0, 300) || null, actorId: s.userId });
    await audit(tx, { actorId: s.userId, action: "loja.estoque", resourceType: "product_variant", resourceId: variantId, detail: { tipo: kind, quantidade: quantity } });
    return r[0].stock_on_hand;
  });
}

export async function adminProducts(db: DB, s: Subject) {
  assertCan(s, "loja.produtos");
  const prods = await db.select().from(product).orderBy(desc(product.updatedAt));
  const vars = prods.length ? await db.select().from(productVariant).where(inArray(productVariant.productId, prods.map((p) => p.id))).orderBy(asc(productVariant.label)) : [];
  return prods.map((p) => ({ ...p, variants: vars.filter((v) => v.productId === p.id) }));
}

export async function stockHistory(db: DB, s: Subject, productId: string) {
  assertCan(s, "loja.produtos");
  return db.select({ m: stockMovement, sku: productVariant.sku }).from(stockMovement).innerJoin(productVariant, eq(productVariant.id, stockMovement.variantId))
    .where(eq(productVariant.productId, productId)).orderBy(desc(stockMovement.createdAt)).limit(50);
}

// ───────── Painel: pedidos ─────────
const NEXT: Record<string, string[]> = { nao_iniciado: ["separando"], separando: ["enviado", "retirado"], enviado: ["entregue"], entregue: [], retirado: [], devolvido: [] };
export const FULFILLMENT_LABEL: Record<string, string> = { nao_iniciado: "Não iniciado", separando: "Separando", enviado: "Enviado", entregue: "Entregue", retirado: "Retirado", devolvido: "Devolvido" };

export async function adminOrders(db: DB, s: Subject, filtro?: string) {
  assertCan(s, "loja.pedidos");
  const where = filtro && ["aguardando_pagamento", "pago", "em_resolucao", "concluido", "cancelado", "expirado"].includes(filtro) ? eq(order.status, filtro as typeof order.$inferSelect.status) : undefined;
  return db.select().from(order).where(where ? and(eq(order.kind, "loja"), where) : eq(order.kind, "loja")).orderBy(desc(order.createdAt)).limit(200);
}

export async function adminOrder(db: DB, s: Subject, id: string) {
  assertCan(s, "loja.pedidos");
  const [o] = await db.select().from(order).where(eq(order.id, id));
  if (!o) return null;
  const [items, pays, ex] = await Promise.all([
    db.select().from(orderItem).where(eq(orderItem.orderId, id)),
    db.select().from(payment).where(eq(payment.orderId, id)).orderBy(desc(payment.createdAt)),
    db.select().from(exceptionCase).where(eq(exceptionCase.orderId, id)).orderBy(desc(exceptionCase.createdAt)),
  ]);
  return { o, items, pays, ex };
}

export async function advanceFulfillment(db: DB, s: Subject, orderId: string, to: string) {
  assertCan(s, "loja.pedidos");
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(order).where(eq(order.id, orderId)).for("update");
    if (!o) throw new CatalogError("Pedido não encontrado.");
    if (o.status !== "pago" && o.status !== "concluido") throw new CatalogError("Só pedidos com pagamento aprovado entram em separação/entrega.");
    if (!NEXT[o.fulfillmentStatus]?.includes(to)) throw new CatalogError(`Etapa inválida: de “${FULFILLMENT_LABEL[o.fulfillmentStatus]}” não se passa para “${FULFILLMENT_LABEL[to] ?? to}”.`);
    const done = to === "entregue" || to === "retirado";
    await tx.update(order).set({ fulfillmentStatus: to as typeof o.fulfillmentStatus, status: done ? "concluido" : o.status, updatedAt: new Date() }).where(eq(order.id, orderId));
    await audit(tx, { actorId: s.userId, action: "loja.entrega", resourceType: "order", resourceId: orderId, detail: { de: o.fulfillmentStatus, para: to } });
  });
}

export async function resolveException(db: DB, s: Subject, id: string, note: string) {
  assertCan(s, "loja.pedidos");
  if (note.trim().length < 5) throw new CatalogError("Descreva a decisão tomada (ex.: reembolso integral feito no provedor).");
  const r = await db.update(exceptionCase).set({ resolved: true, resolvedBy: s.userId }).where(and(eq(exceptionCase.id, id), eq(exceptionCase.resolved, false))).returning({ id: exceptionCase.id });
  if (!r.length) throw new CatalogError("Exceção não encontrada ou já resolvida.");
  await audit(db, { actorId: s.userId, action: "loja.excecao_resolvida", resourceType: "exception_case", resourceId: id, detail: { decisao: note.trim().slice(0, 300) } });
}
