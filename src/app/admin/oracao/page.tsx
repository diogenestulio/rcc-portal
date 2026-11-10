import { db } from "@/db";
import { requireCan } from "@/server/session";
import { listPrayers, RETENTION_DAYS } from "@/server/prayer";
import { EmptyState } from "@/components/ui";
import { fmtPublished } from "@/components/site/format";

export const metadata = { title: "Pedidos de oração" };

export default async function Oracao() {
  const s = await requireCan("oracao.ler");
  const list = await listPrayers(db, s, 200);
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold">Pedidos de oração</h1>
      <p className="mt-1 text-tinta-2">Visível somente para intercessores autorizados. Não copie para grupos de mensagem. Cada pedido é apagado automaticamente {RETENTION_DAYS} dias após o envio.</p>
      {list.length === 0 ? <div className="mt-6"><EmptyState title="Nenhum pedido no momento" /></div> : (
        <ul className="mt-6 space-y-3">
          {list.map((p) => (
            <li key={p.id} className="rounded-[var(--radius-md)] border border-linha bg-papel p-4">
              <p className="text-sm text-tinta-3">{fmtPublished(p.createdAt)}{p.firstName ? ` · ${p.firstName}` : ""}</p>
              <p className="mt-1 whitespace-pre-line">{p.intention}</p>
              {p.wantsContact && p.contact && <p className="mt-2 text-sm font-semibold">Deseja contato: {p.contact}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
