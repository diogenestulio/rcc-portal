"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireAdmin } from "@/server/session";
import { ForbiddenError } from "@/server/authz";
import { advanceFulfillment, CatalogError, moveStock, parseBRL, resolveException, saveProduct, saveVariant } from "@/server/store/catalog";
import { requestRefund } from "@/server/store/payments";
import { getProvider } from "@/server/store/provider-factory";

const msg = (e: unknown) => e instanceof CatalogError ? e.message : e instanceof ForbiddenError ? "Você não tem permissão para esta ação." : e instanceof Error && /reembolso|pagamento aprovado/i.test(e.message) ? e.message : null;
async function run(back: string, ok: string, fn: () => Promise<unknown>) {
  try { await fn(); } catch (e) { const m = msg(e); if (!m) throw e; redirect(`${back}${back.includes("?") ? "&" : "?"}erro=${encodeURIComponent(m)}`); }
  revalidatePath("/admin/loja", "layout"); revalidatePath("/loja", "layout");
  redirect(ok);
}

export async function salvarProduto(fd: FormData) {
  const s = await requireAdmin();
  const id = (fd.get("id") as string) || null;
  let novo = id;
  const back = id ? `/admin/loja/produtos/${id}` : "/admin/loja/produtos";
  try {
    novo = await saveProduct(db, s, id, {
      name: String(fd.get("nome") ?? ""), slug: String(fd.get("slug") ?? "").trim(), category: String(fd.get("categoria") ?? ""),
      description: String(fd.get("descricao") ?? ""), coverMediaId: (fd.get("capa") as string) || null, active: fd.get("ativo") === "on",
    });
  } catch (e) { const m = msg(e); if (!m) throw e; redirect(`${back}?erro=${encodeURIComponent(m)}`); }
  revalidatePath("/loja", "layout");
  redirect(`/admin/loja/produtos/${novo}?ok=1`);
}

export async function salvarVariante(fd: FormData) {
  const s = await requireAdmin();
  const pid = String(fd.get("produto"));
  const back = `/admin/loja/produtos/${pid}`;
  await run(back, `${back}?ok=1`, () => saveVariant(db, s, pid, (fd.get("id") as string) || null, {
    sku: String(fd.get("sku") ?? ""), label: String(fd.get("rotulo") ?? ""), price: String(fd.get("preco") ?? ""),
    weightGrams: Number(fd.get("peso")) > 0 ? Math.round(Number(fd.get("peso"))) : null, active: fd.get("ativa") === "on",
  }));
}

export async function movimentarEstoque(fd: FormData) {
  const s = await requireAdmin();
  const pid = String(fd.get("produto"));
  const back = `/admin/loja/produtos/${pid}`;
  const tipo = String(fd.get("tipo")) as "entrada" | "ajuste" | "devolucao";
  await run(back, `${back}?ok=estoque`, () => moveStock(db, s, String(fd.get("variante")), tipo, Number(fd.get("quantidade")) | 0, String(fd.get("motivo") ?? "")));
}

export async function avancarEntrega(fd: FormData) {
  const s = await requireAdmin();
  const id = String(fd.get("id"));
  await run(`/admin/loja/pedidos/${id}`, `/admin/loja/pedidos/${id}?ok=1`, () => advanceFulfillment(db, s, id, String(fd.get("para"))));
}

export async function reembolsar(fd: FormData) {
  const s = await requireAdmin();
  const id = String(fd.get("id"));
  const back = `/admin/loja/pedidos/${id}`;
  await run(back, `${back}?ok=reembolso`, async () => {
    const { assertCan } = await import("@/server/authz");
    assertCan(s, "loja.reembolsar");
    const provider = getProvider();
    if (!provider) throw new CatalogError("Nenhum provedor de pagamento ativo.");
    const motivo = String(fd.get("motivo") ?? "").trim();
    if (motivo.length < 5) throw new CatalogError("Informe o motivo do reembolso.");
    await requestRefund(db, provider, s.userId, id, parseBRL(String(fd.get("valor") ?? "")), motivo);
  });
}

export async function resolverExcecao(fd: FormData) {
  const s = await requireAdmin();
  const back = String(fd.get("voltar") || "/admin/loja");
  await run(back, back.includes("?") ? `${back}&ok=1` : `${back}?ok=1`, () => resolveException(db, s, String(fd.get("id")), String(fd.get("decisao") ?? "")));
}
