import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { requireCan, canView } from "@/server/session";
import { adminOrder, FULFILLMENT_LABEL, centsToInput } from "@/server/store/catalog";
import { formatBRL } from "@/server/store/checkout";
import { audit } from "@/server/audit";
import { getProvider } from "@/server/store/provider-factory";
import { Badge, btn, Card, field, Notice } from "@/components/ui";
import { fmtPublished } from "@/components/site/format";
import { avancarEntrega, reembolsar, resolverExcecao } from "../../actions";

export const metadata = { title: "Pedido" };
const PROXIMA: Record<string, [string, string][]> = {
  nao_iniciado: [["separando", "Começar separação"]], separando: [["retirado", "Marcar como retirado"], ["enviado", "Marcar como enviado"]], enviado: [["entregue", "Marcar como entregue"]],
};

export default async function PedidoAdmin({ params, searchParams }: PageProps<"/admin/loja/pedidos/[id]">) {
  const s = await requireCan("loja.pedidos");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const r = await adminOrder(db, s, id);
  if (!r) notFound();
  const { o, items, pays, ex } = r;
  await audit(db, { actorId: s.userId, action: "loja.ver_pedido", resourceType: "order", resourceId: id });
  const pago = pays.find((p) => p.status === "aprovado" || p.status === "estornado_parcial");
  const podeEntregar = o.status === "pago" || o.status === "concluido";
  return (
    <div className="max-w-4xl">
      <p><Link href="/admin/loja">← Loja</Link></p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="font-mono text-3xl font-semibold">{o.id.slice(0, 8).toUpperCase()}</h1>
        <Badge>{o.status.replaceAll("_", " ")}</Badge><Badge tone="info">pagamento: {o.paymentStatus.replaceAll("_", " ")}</Badge><Badge tone="info">entrega: {FULFILLMENT_LABEL[o.fulfillmentStatus]}</Badge>
      </div>
      <p className="text-sm text-tinta-3">Feito em {fmtPublished(o.createdAt)} · acesso registrado na auditoria</p>
      {typeof sp.erro === "string" && <div className="mt-4"><Notice tone="perigo">{sp.erro}</Notice></div>}
      {sp.ok === "reembolso" && <div className="mt-4"><Notice tone="sucesso">Reembolso solicitado ao provedor. A situação do pagamento muda quando o provedor confirmar.</Notice></div>}
      {sp.ok === "1" && <div className="mt-4"><Notice tone="sucesso">Atualizado.</Notice></div>}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Cliente</h2>
          <p>{o.customerName}</p><p className="text-sm text-tinta-2">{o.customerEmail}{o.customerPhone ? ` · ${o.customerPhone}` : ""}</p>
          <p className="mt-2 text-sm">{o.shippingCents === 0 && !o.shippingCep ? "Retirada no local" : `Entrega — CEP ${o.shippingCep ?? "?"}`}</p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Entrega</h2>
          {!podeEntregar ? <p className="text-sm text-tinta-2">A separação só começa depois do pagamento aprovado.</p> : (PROXIMA[o.fulfillmentStatus] ?? []).length === 0 ? <p className="text-sm text-tinta-2">Pedido finalizado.</p> : (
            <div className="flex flex-wrap gap-2">
              {PROXIMA[o.fulfillmentStatus].map(([para, l]) => (
                <form key={para} action={avancarEntrega}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="para" value={para} /><button className={btn.secundario}>{l}</button></form>
              ))}
            </div>
          )}
        </Card>
      </div>

      <table className="mt-6 w-full border-collapse bg-papel text-left">
        <caption className="sr-only">Itens (preços do momento da compra)</caption>
        <thead className="bg-marfim-2 text-sm"><tr><th scope="col" className="p-3">Item</th><th scope="col" className="p-3">SKU</th><th scope="col" className="p-3">Qtd.</th><th scope="col" className="p-3 text-right">Total</th></tr></thead>
        <tbody>{items.map((i) => <tr key={i.id} className="border-t border-linha"><td className="p-3">{i.productName} — {i.variantLabel}</td><td className="p-3 font-mono text-sm">{i.sku}</td><td className="p-3">{i.quantity}</td><td className="p-3 text-right">{formatBRL(i.unitPriceCents * i.quantity)}</td></tr>)}</tbody>
        <tfoot><tr className="border-t border-linha"><th scope="row" colSpan={3} className="p-3 text-right">Total</th><td className="p-3 text-right font-semibold">{formatBRL(o.totalCents)}</td></tr></tfoot>
      </table>

      <Card className="mt-6">
        <h2 className="text-lg font-semibold">Pagamentos</h2>
        <ul className="mt-2 space-y-1 text-sm">{pays.map((p) => <li key={p.id}>{p.provider} · {p.status.replaceAll("_", " ")} · {formatBRL(p.amountCents)}{p.refundedCents ? ` · reembolsado ${formatBRL(p.refundedCents)}` : ""}{p.method ? ` · ${p.method}` : ""}</li>)}</ul>
        {pago && canView(s, "loja.reembolsar") && (
          getProvider() ? (
            <form action={reembolsar} className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
              <input type="hidden" name="id" value={o.id} />
              <div><label htmlFor="valor" className={field.label}>Valor (R$)</label><input id="valor" name="valor" required defaultValue={centsToInput(pago.amountCents - pago.refundedCents)} className={field.input} /></div>
              <div><label htmlFor="motivo" className={field.label}>Motivo</label><input id="motivo" name="motivo" required minLength={5} className={field.input} /></div>
              <button className={btn.perigo}>Solicitar reembolso</button>
              <p className={field.hint + " sm:col-span-3"}>Reembolso não devolve o produto ao estoque automaticamente: se o item voltar, registre uma “devolução” no estoque.</p>
            </form>
          ) : <p className="mt-2 text-sm text-tinta-3">Reembolso indisponível: nenhum provedor ativo.</p>
        )}
      </Card>

      {ex.length > 0 && (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold">Exceções deste pedido</h2>
          <ul className="mt-2 space-y-3">{ex.map((e) => (
            <li key={e.id} className="text-sm"><span className="font-semibold">{e.kind.replaceAll("_", " ")}</span> — {e.detail} {e.resolved ? <Badge tone="sucesso">resolvida</Badge> : (
              <form action={resolverExcecao} className="mt-2 flex flex-wrap gap-2"><input type="hidden" name="id" value={e.id} /><input type="hidden" name="voltar" value={`/admin/loja/pedidos/${o.id}`} />
                <label className="sr-only" htmlFor={`d-${e.id}`}>Decisão tomada</label><input id={`d-${e.id}`} name="decisao" required minLength={5} placeholder="Decisão tomada" className={field.input + " mt-0 flex-1"} /><button className={btn.secundario}>Resolver</button></form>
            )}</li>
          ))}</ul>
        </Card>
      )}
    </div>
  );
}
