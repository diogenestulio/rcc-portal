import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { order, orderItem } from "@/db/schema";
import { env } from "@/lib/env";
import { formatBRL } from "@/server/store/checkout";
import { FULFILLMENT_LABEL } from "@/server/store/catalog";
import { Badge, Container, Notice } from "@/components/ui";
import { fmtPublished } from "@/components/site/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Seu pedido", robots: { index: false, follow: false } };

const STATUS: Record<string, [string, "sucesso" | "alerta" | "perigo" | "neutro" | "info"]> = {
  aberto: ["Aberto", "neutro"], aguardando_pagamento: ["Aguardando pagamento", "alerta"], pago: ["Pagamento confirmado", "sucesso"],
  em_resolucao: ["Em análise pela equipe", "alerta"], concluido: ["Concluído", "sucesso"], cancelado: ["Cancelado", "perigo"], expirado: ["Reserva expirada", "neutro"],
};

/** Acompanhamento sem login: só com o token opaco (não enumerável). */
export default async function Pedido({ params }: PageProps<"/pedido/[token]">) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const [o] = await db.select().from(order).where(eq(order.publicToken, token));
  if (!o || o.kind !== "loja") notFound();
  const items = await db.select().from(orderItem).where(eq(orderItem.orderId, o.id));
  const [label, tone] = STATUS[o.status];
  return (
    <Container narrow className="py-10">
      <p className="text-sm font-semibold uppercase tracking-wider text-dourado-texto">Pedido {o.id.slice(0, 8).toUpperCase()}</p>
      <h1 className="mt-2 text-4xl font-semibold">Seu pedido</h1>
      <p className="mt-1 text-tinta-2">Feito em {fmtPublished(o.createdAt)}</p>
      <div className="mt-4 flex flex-wrap gap-2"><Badge tone={tone}>{label}</Badge>{o.status === "pago" || o.status === "concluido" ? <Badge tone="info">Entrega: {FULFILLMENT_LABEL[o.fulfillmentStatus]}</Badge> : null}</div>
      {o.status === "aguardando_pagamento" && <div className="mt-6"><Notice tone="alerta">Assim que o provedor confirmar o pagamento, esta página muda para “Pagamento confirmado”. Voltar do site de pagamento não confirma o pedido sozinho; se você já pagou, aguarde alguns minutos e recarregue.</Notice></div>}
      {o.status === "em_resolucao" && <div className="mt-6"><Notice tone="alerta">Recebemos o pagamento, mas o item esgotou depois que a reserva expirou. A equipe vai entrar em contato para combinar a solução (reposição ou reembolso).</Notice></div>}
      {o.status === "expirado" && <div className="mt-6"><Notice>A reserva expirou sem pagamento confirmado. <Link href="/loja">Voltar à loja</Link>.</Notice></div>}
      <table className="mt-8 w-full border-collapse bg-papel text-left">
        <caption className="sr-only">Itens do pedido</caption>
        <thead className="bg-marfim-2 text-sm"><tr><th scope="col" className="p-3">Item</th><th scope="col" className="p-3">Qtd.</th><th scope="col" className="p-3 text-right">Total</th></tr></thead>
        <tbody>{items.map((i) => (
          <tr key={i.id} className="border-t border-linha"><td className="p-3">{i.productName}<span className="block text-sm text-tinta-3">{i.variantLabel}</span></td><td className="p-3">{i.quantity}</td><td className="p-3 text-right">{formatBRL(i.unitPriceCents * i.quantity)}</td></tr>
        ))}</tbody>
        <tfoot>
          {o.shippingCents > 0 && <tr className="border-t border-linha"><th scope="row" colSpan={2} className="p-3 text-right font-normal">Frete</th><td className="p-3 text-right">{formatBRL(o.shippingCents)}</td></tr>}
          <tr className="border-t border-linha"><th scope="row" colSpan={2} className="p-3 text-right">Total</th><td className="p-3 text-right font-semibold">{formatBRL(o.totalCents)}</td></tr>
        </tfoot>
      </table>
      {env.STORE_PICKUP_ENABLED && o.shippingCents === 0 && env.STORE_PICKUP_INFO && <p className="mt-4 text-sm text-tinta-2">Retirada: {env.STORE_PICKUP_INFO}</p>}
      <p className="mt-6 text-sm text-tinta-3">Guarde este endereço para acompanhar o pedido. Não compartilhe.</p>
    </Container>
  );
}
