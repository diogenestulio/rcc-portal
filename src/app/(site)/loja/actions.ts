"use server";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { cartItem } from "@/db/schema";
import { env } from "@/lib/env";
import { checkout, CheckoutError, getOrCreateCart, setCartItem } from "@/server/store/checkout";
import { getProvider } from "@/server/store/provider-factory";
import { readCartToken, writeCartToken } from "@/server/store/cart-cookie";
import { checkRate, RateLimitError } from "@/server/ratelimit";

const lojaOn = () => { if (!env.STORE_ENABLED) redirect("/loja"); };

export async function adicionar(fd: FormData) {
  lojaOn();
  const variantId = String(fd.get("variante") ?? "");
  const qtd = Math.min(20, Math.max(1, Number(fd.get("quantidade") ?? 1) | 0));
  const slug = String(fd.get("slug") ?? "").slice(0, 80);
  const c = await getOrCreateCart(db, await readCartToken());
  await writeCartToken(c.token);
  const [atual] = await db.select({ q: cartItem.quantity }).from(cartItem).where(and(eq(cartItem.cartId, c.id), eq(cartItem.variantId, variantId)));
  try { await setCartItem(db, c.id, variantId, Math.min(20, (atual?.q ?? 0) + qtd)); }
  catch (e) { if (e instanceof CheckoutError) redirect(`/loja/${encodeURIComponent(slug)}?erro=indisponivel`); throw e; }
  redirect("/carrinho?ok=adicionado");
}

export async function alterarQuantidade(fd: FormData) {
  lojaOn();
  const token = await readCartToken();
  if (!token) redirect("/carrinho");
  const c = await getOrCreateCart(db, token);
  const qtd = Math.min(20, Math.max(0, Number(fd.get("quantidade") ?? 0) | 0));
  try { await setCartItem(db, c.id, String(fd.get("variante") ?? ""), qtd); }
  catch (e) { if (!(e instanceof CheckoutError)) throw e; }
  redirect("/carrinho");
}

export async function finalizar(fd: FormData) {
  lojaOn();
  const token = await readCartToken();
  if (!token) redirect("/carrinho");
  const back = (code: string) => redirect(`/carrinho?erro=${code}#finalizar`);
  const nome = String(fd.get("nome") ?? "").trim(), email = String(fd.get("email") ?? "").trim();
  if (nome.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) back("dados");
  const entrega = String(fd.get("entrega") ?? "");
  let url: string | null;
  try {
    await checkRate("checkout", 10, 600);
    const r = await checkout(db, getProvider(), {
      cartToken: token, customerName: nome, customerEmail: email, customerPhone: String(fd.get("telefone") ?? "").trim().slice(0, 30) || undefined,
      shipping: entrega === "retirada" ? { method: "retirada" } : { method: "entrega", cep: String(fd.get("cep") ?? "").replace(/\D/g, "").slice(0, 8) },
      idempotencyKey: String(fd.get("chave") ?? "").slice(0, 64) || randomUUID(), appUrl: env.APP_URL, pickupEnabled: env.STORE_PICKUP_ENABLED,
    });
    url = r.checkoutUrl ?? `/pedido/${r.order.publicToken}`;
  } catch (e) {
    if (e instanceof RateLimitError) back("limite");
    if (e instanceof CheckoutError) back(e.code);
    throw e;
  }
  redirect(url!);
}
