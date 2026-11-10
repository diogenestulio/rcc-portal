import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { exceptionCase } from "@/db/schema";
import { requireAdmin, canView } from "@/server/session";
import { EmptyState, Notice } from "@/components/ui";
import { fmtPublished } from "@/components/site/format";
import { env } from "@/lib/env";

export const metadata = { title: "Loja" };

export default async function LojaAdmin() {
  const s = await requireAdmin();
  const ok = canView(s, "loja.pedidos") || canView(s, "evento.gerenciar");
  const ex = ok ? await db.select().from(exceptionCase).where(eq(exceptionCase.resolved, false)).orderBy(desc(exceptionCase.createdAt)).limit(100) : [];
  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-semibold">Loja e pagamentos</h1>
      <div className="mt-4"><Notice tone="alerta" title="Vendas desativadas">
        Loja: {env.STORE_ENABLED ? "ligada" : "desligada"} · Provedor: {env.PAYMENTS_PROVIDER === "off" ? "nenhum (bloqueado até definição institucional)" : `${env.PAYMENTS_PROVIDER} (somente desenvolvimento)`}.
        Regras de carrinho, estoque, pagamento e reembolso estão implementadas e testadas no servidor; as telas de operação de pedidos entram com a ativação.
      </Notice></div>
      <h2 className="mt-8 text-2xl font-semibold">Fila de exceções</h2>
      <p className="text-tinta-2">Pagamentos divergentes, aprovados após expirar a reserva, contestações.</p>
      {ex.length === 0 ? <div className="mt-4"><EmptyState title="Nenhuma exceção aberta" /></div> : (
        <ul className="mt-4 space-y-2">
          {ex.map((e) => <li key={e.id} className="rounded-md border border-linha bg-papel p-3"><strong>{e.kind}</strong> · {fmtPublished(e.createdAt)}<p className="text-sm">{e.detail}</p></li>)}
        </ul>
      )}
    </div>
  );
}
