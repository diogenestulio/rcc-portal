// Catálogo e operação da loja: dinheiro sem ponto flutuante, estoque nunca abaixo do reservado,
// publicação só com variante, etapas de entrega só após pagamento, permissões.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { makeDb, makeUser, reset, subject, g } from "./helpers";
import { advanceFulfillment, CatalogError, moveStock, parseBRL, publicCatalog, publicProduct, resolveException, saveProduct, saveVariant } from "@/server/store/catalog";
import { checkout, getOrCreateCart, setCartItem } from "@/server/store/checkout";
import { SimulatedProvider } from "@/server/store/providers";
import { applyProviderState } from "@/server/store/payments";
import { ForbiddenError } from "@/server/authz";
import { exceptionCase, order, payment, productVariant, stockMovement } from "@/db/schema";

const { db, client } = makeDb();
afterAll(() => client.end());
beforeEach(() => reset(db));
const op = async () => subject(await makeUser(db), [g("operador_loja")]);

describe("dinheiro", () => {
  it("converte formatos brasileiros para centavos inteiros", () => {
    expect(parseBRL("39,90")).toBe(3990);
    expect(parseBRL("R$ 1.234,50")).toBe(123450);
    expect(parseBRL("40")).toBe(4000);
    expect(parseBRL("0,1")).toBe(10);
    expect(parseBRL("19.99")).toBe(1999);
    expect(parseBRL("1.000")).toBe(100000);
    expect(parseBRL("0,29")).toBe(29); // 0.29*100 em ponto flutuante daria 28,999…
    for (const bad of ["", "abc", "-5", "1,234", "12,345", "1.2.3"]) expect(() => parseBRL(bad)).toThrow(CatalogError);
  });
});

describe("catálogo", () => {
  it("produto só é publicado com variante ativa; vitrine mostra preço mínimo e disponibilidade", async () => {
    const s = await op();
    const id = await saveProduct(db, s, null, { name: "Terço de madeira", slug: "terco-madeira", category: "Artigos religiosos" });
    await expect(saveProduct(db, s, id, { name: "Terço de madeira", slug: "terco-madeira", active: true })).rejects.toThrow(/variante ativa/);
    const v1 = await saveVariant(db, s, id, null, { sku: "terco-mad-p", label: "Pequeno", price: "15,00" });
    await saveVariant(db, s, id, null, { sku: "TERCO-MAD-G", label: "Grande", price: "29,90" });
    await saveProduct(db, s, id, { name: "Terço de madeira", slug: "terco-madeira", category: "Artigos religiosos", active: true });
    let cat = await publicCatalog(db, {});
    expect(cat).toEqual([expect.objectContaining({ slug: "terco-madeira", fromCents: 1500, available: false })]);
    await moveStock(db, s, v1, "entrada", 10, "Compra inicial");
    cat = await publicCatalog(db, { categoria: "Artigos religiosos", q: "terço" });
    expect(cat[0].available).toBe(true);
    expect((await publicProduct(db, "terco-madeira"))?.variants[0]).toMatchObject({ sku: "TERCO-MAD-P", disponivel: 10 });
    await expect(saveVariant(db, s, id, null, { sku: "TERCO-MAD-P", label: "Outro", price: "1,00" })).rejects.toThrow(/já existe/i);
  });

  it("estoque nunca fica abaixo do reservado; ajuste exige motivo; tudo registrado", async () => {
    const s = await op();
    const pid = await saveProduct(db, s, null, { name: "Livro de cantos", slug: "livro-cantos" });
    const vid = await saveVariant(db, s, pid, null, { sku: "LIVRO-CANTOS", label: "Único", price: "35,00" });
    await saveProduct(db, s, pid, { name: "Livro de cantos", slug: "livro-cantos", active: true });
    await moveStock(db, s, vid, "entrada", 3, "Doação");
    const pv = new SimulatedProvider(db, "segredo-teste");
    const c = await getOrCreateCart(db, null);
    await setCartItem(db, c.id, vid, 2);
    await checkout(db, pv, { cartToken: c.token, customerName: "Comprador Teste", customerEmail: "c@teste.invalid", shipping: { method: "retirada" }, idempotencyKey: "k", appUrl: "http://x", pickupEnabled: true });
    await expect(moveStock(db, s, vid, "ajuste", -2, "Inventário")).rejects.toThrow(/abaixo do que está reservado/);
    await expect(moveStock(db, s, vid, "ajuste", -1, "")).rejects.toThrow(/motivo/);
    expect(await moveStock(db, s, vid, "ajuste", -1, "Exemplar danificado")).toBe(2);
    await expect(moveStock(db, s, vid, "entrada", -1, "x")).rejects.toThrow(/positivas/);
    expect(await db.select().from(stockMovement).where(eq(stockMovement.variantId, vid))).toHaveLength(2);
  });

  it("entrega só depois do pagamento e em etapas válidas; exceção exige decisão descrita", async () => {
    const s = await op();
    const pid = await saveProduct(db, s, null, { name: "Camiseta RCC", slug: "camiseta" });
    const vid = await saveVariant(db, s, pid, null, { sku: "CAMISETA-M", label: "M", price: "45,00" });
    await saveProduct(db, s, pid, { name: "Camiseta RCC", slug: "camiseta", active: true });
    await moveStock(db, s, vid, "entrada", 5, "Lote 1");
    const pv = new SimulatedProvider(db, "segredo-teste");
    const c = await getOrCreateCart(db, null);
    await setCartItem(db, c.id, vid, 1);
    const { order: o } = await checkout(db, pv, { cartToken: c.token, customerName: "Comprador Teste", customerEmail: "c@teste.invalid", shipping: { method: "retirada" }, idempotencyKey: "k2", appUrl: "http://x", pickupEnabled: true });
    await expect(advanceFulfillment(db, s, o.id, "separando")).rejects.toThrow(/pagamento aprovado/);
    const [p] = await db.select().from(payment).where(eq(payment.orderId, o.id));
    await pv.setState(p.providerPaymentId!, { status: "aprovado" });
    await applyProviderState(db, pv, p.providerPaymentId!, "recebedor-dev");
    await expect(advanceFulfillment(db, s, o.id, "entregue")).rejects.toThrow(/Etapa inválida/);
    await advanceFulfillment(db, s, o.id, "separando");
    await advanceFulfillment(db, s, o.id, "retirado");
    expect((await db.select().from(order).where(eq(order.id, o.id)))[0]).toMatchObject({ status: "concluido", fulfillmentStatus: "retirado" });
    expect((await db.select().from(productVariant).where(eq(productVariant.id, vid)))[0]).toMatchObject({ stockOnHand: 4, stockReserved: 0 });
    const [ex] = await db.insert(exceptionCase).values({ kind: "teste", detail: "x", orderId: o.id }).returning();
    await expect(resolveException(db, s, ex.id, "ok")).rejects.toThrow(/Descreva/);
    await resolveException(db, s, ex.id, "Reembolso integral feito no provedor");
    await expect(resolveException(db, s, ex.id, "de novo, tentando")).rejects.toThrow(/já resolvida/);
  });

  it("editor não mexe na loja", async () => {
    const editor = subject(await makeUser(db), [g("editor")]);
    await expect(saveProduct(db, editor, null, { name: "Xxx", slug: "xxx" })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
