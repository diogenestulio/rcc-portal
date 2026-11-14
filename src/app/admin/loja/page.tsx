import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { exceptionCase } from "@/db/schema";
import { requireAdmin, canView } from "@/server/session";
import { adminOrders, FULFILLMENT_LABEL } from "@/server/store/catalog";
import { formatBRL } from "@/server/store/checkout";
import { Badge, btn, EmptyState, field, Notice } from "@/components/ui";
import { fmtPublished } from "@/components/site/format";
import { env } from "@/lib/env";
import { resolverExcecao } from "./actions";

export const metadata = { title: "Loja" };
const FILTROS: [string, string][] = [["", "Todos"], ["aguardando_pagamento", "Aguardando pagamento"], ["pago", "Pagos"], ["em_resolucao", "Em resolução"], ["concluido", "Concluídos"], ["expirado", "Expirados"]];
const TONE: Record<string, "sucesso" | "alerta" | "perigo" | "neutro"> = { pago: "sucesso", concluido: "sucesso", aguardando_pagamento: "alerta", em_resolucao: "perigo", expirado: "neutro", cancelado: "neutro", aberto: "neutro" };

export default async function LojaAdmin({ searchParams }: PageProps<"/admin/loja">) {
  const s = await requireAdmin();
  const sp = await searchParams;
  const podePedidos = canView(s, "loja.pedidos");
  const filtro = typeof sp.status === "string" ? sp.status : "";
  const [pedidos, ex] = await Promise.all([
    podePedidos ? adminOrders(db, s, filtro) : Promise.resolve([]),
    podePedidos || canView(s, "evento.gerenciar") ? db.select().from(exceptionCase).where(eq(exceptionCase.resolved, false)).orderBy(desc(exceptionCase.createdAt)).limit(100) : Promise.resolve([]),
  ]);
  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Loja</h1>
        {canView(s, "loja.produtos") && <Link href="/admin/loja/produtos" className={btn.secundario}>Produtos e estoque</Link>}
      </div>
      {(!env.STORE_ENABLED || env.PAYMENTS_PROVIDER === "off") && (
        <div className="mt-4"><Notice tone="alerta" title="Vendas desligadas no portal">
          Loja: {env.STORE_ENABLED ? "ligada" : "desligada"} · Pagamento: {env.PAYMENTS_PROVIDER === "off" ? "nenhum provedor (aguardando definição da entidade vendedora)" : `${env.PAYMENTS_PROVIDER} (só desenvolvimento)`}.
          Você já pode cadastrar produtos e estoque; a vitrine só aparece quando a loja for ligada.
        </Notice></div>
      )}
      {typeof sp.erro === "string" && <div className="mt-4"><Notice tone="perigo">{sp.erro}</Notice></div>}

      {ex.length > 0 && (
        <section className="mt-8" aria-labelledby="exc">
          <h2 id="exc" className="text-2xl font-semibold">Exceções a resolver ({ex.length})</h2>
          <p className="text-tinta-2">Pagamentos divergentes, aprovados depois de expirar a reserva, contestações. Resolva no provedor e registre aqui a decisão.</p>
          <ul className="mt-3 space-y-3">
            {ex.map((e) => (
              <li key={e.id} className="rounded-[var(--radius-md)] border-l-4 border-perigo bg-papel p-4">
                <p className="font-semibold">{e.kind.replaceAll("_", " ")} · {fmtPublished(e.createdAt)}{e.orderId && <> · <Link href={`/admin/loja/pedidos/${e.orderId}`}>ver pedido</Link></>}</p>
                <p className="text-sm text-tinta-2">{e.detail}</p>
                <form action={resolverExcecao} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={e.id} />
                  <div className="min-w-64 flex-1"><label htmlFor={`d-${e.id}`} className="sr-only">Decisão tomada</label><input id={`d-${e.id}`} name="decisao" required minLength={5} placeholder="Decisão tomada (ex.: reembolso integral feito no provedor)" className={field.input} /></div>
                  <button className={btn.secundario}>Marcar como resolvida</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {podePedidos && (
        <section className="mt-10" aria-labelledby="ped">
          <h2 id="ped" className="text-2xl font-semibold">Pedidos</h2>
          <nav aria-label="Filtrar pedidos" className="mt-2 flex flex-wrap gap-3 text-sm">
            {FILTROS.map(([k, l]) => <Link key={k} href={k ? `/admin/loja?status=${k}` : "/admin/loja"} className={filtro === k ? "font-bold" : ""}>{l}</Link>)}
          </nav>
          {pedidos.length === 0 ? <div className="mt-4"><EmptyState title="Nenhum pedido" /></div> : (
            <table className="mt-4 w-full border-collapse bg-papel text-left">
              <thead className="bg-marfim-2 text-sm"><tr><th scope="col" className="p-3">Pedido</th><th scope="col" className="p-3">Cliente</th><th scope="col" className="p-3">Situação</th><th scope="col" className="p-3">Entrega</th><th scope="col" className="p-3 text-right">Total</th></tr></thead>
              <tbody>{pedidos.map((o) => (
                <tr key={o.id} className="border-t border-linha">
                  <td className="p-3"><Link href={`/admin/loja/pedidos/${o.id}`} className="font-mono font-semibold">{o.id.slice(0, 8).toUpperCase()}</Link><span className="block text-xs text-tinta-3">{fmtPublished(o.createdAt)}</span></td>
                  <td className="p-3 text-sm">{o.customerName}</td>
                  <td className="p-3"><Badge tone={TONE[o.status]}>{o.status.replaceAll("_", " ")}</Badge></td>
                  <td className="p-3 text-sm">{FULFILLMENT_LABEL[o.fulfillmentStatus]}</td>
                  <td className="p-3 text-right font-semibold">{formatBRL(o.totalCents)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
