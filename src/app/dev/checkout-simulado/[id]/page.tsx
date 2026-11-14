import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { order, payment } from "@/db/schema";
import { env } from "@/lib/env";
import { formatBRL } from "@/server/store/checkout";
import { getProvider, expectedReceiver } from "@/server/store/provider-factory";
import { SimulatedProvider } from "@/server/store/providers";
import { handleWebhook } from "@/server/store/payments";
import { btn } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pagamento SIMULADO", robots: { index: false, follow: false } };

/**
 * SOMENTE DESENVOLVIMENTO: imita a página do provedor. Ao decidir, o “provedor” muda o estado e
 * dispara o webhook assinado — o pedido segue exatamente o mesmo caminho de produção
 * (webhook autenticado → reconsulta → aplicação idempotente). Em homologação/produção: 404.
 */
function guard() {
  const p = getProvider();
  if (env.APP_ENV !== "development" || !(p instanceof SimulatedProvider)) notFound();
  return p;
}

async function decidir(fd: FormData) {
  "use server";
  const p = guard();
  const id = String(fd.get("id"));
  const status = fd.get("decisao") === "aprovar" ? "aprovado" : "recusado";
  await p.setState(id, { status, method: "pix (simulado)" });
  const body = JSON.stringify({ id: `evt_${crypto.randomUUID()}`, payment_id: id });
  const ts = Math.floor(Date.now() / 1000);
  await handleWebhook(db, p, new Headers({ "x-sim-timestamp": String(ts), "x-sim-signature": p.sign(body, ts) }), body, expectedReceiver());
  const [row] = await db.select({ token: order.publicToken }).from(payment).innerJoin(order, eq(order.id, payment.orderId)).where(eq(payment.providerPaymentId, id));
  redirect(`/pedido/${row.token}`);
}

export default async function CheckoutSimulado({ params }: PageProps<"/dev/checkout-simulado/[id]">) {
  const p = guard();
  const { id } = await params;
  let st;
  try { st = await p.fetchPayment(id); } catch { notFound(); }
  const [row] = await db.select({ token: order.publicToken }).from(payment).innerJoin(order, eq(order.id, payment.orderId)).where(eq(payment.providerPaymentId, id));
  return (
    <main className="mx-auto max-w-md flex-1 px-4 py-16">
      <p className="rounded-md bg-alerta-claro p-3 text-sm font-semibold text-alerta">Página de pagamento SIMULADA — existe só no ambiente de desenvolvimento. Nenhum dinheiro é movimentado.</p>
      <h1 className="mt-6 text-2xl font-semibold">Pagar {formatBRL(st.amountCents)}</h1>
      <p className="mt-1 text-tinta-2">Situação no “provedor”: {st.status}</p>
      {st.status === "pendente" ? (
        <form action={decidir} className="mt-6 flex flex-wrap gap-3">
          <input type="hidden" name="id" value={id} />
          <button name="decisao" value="aprovar" className={btn.primario}>Aprovar pagamento</button>
          <button name="decisao" value="recusar" className={btn.secundario}>Recusar</button>
        </form>
      ) : row && <p className="mt-6"><a href={`/pedido/${row.token}`}>Ver o pedido</a></p>}
      {row && <p className="mt-6 text-sm"><a href={`/pedido/${row.token}`}>Voltar ao portal sem pagar</a> (simula o visitante voltando: o pedido continua aguardando).</p>}
    </main>
  );
}
