import Link from "next/link";
import { db } from "@/db";
import { ministry } from "@/db/schema";
import { requireAdmin, canView } from "@/server/session";
import { Badge, btn, EmptyState } from "@/components/ui";

export const metadata = { title: "Ministérios" };

export default async function MinisteriosAdmin() {
  const s = await requireAdmin();
  const all = await db.select().from(ministry).orderBy(ministry.name);
  // Responsável local vê só o(s) ministério(s) do seu escopo; o gestor vê todos.
  const mine = all.filter((m) => canView(s, "ministerio.editar", { ministryId: m.id }));
  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Ministérios</h1>
        {canView(s, "ministerio.criar") && <Link href="/admin/ministerios/novo" className={btn.primario}>Novo ministério</Link>}
      </div>
      <p className="mt-2 text-tinta-2">Aparecem no site em <Link href="/ministerios">Ministérios</Link> quando publicados.</p>
      {mine.length === 0 ? <div className="mt-6"><EmptyState title="Nenhum ministério no seu escopo" /></div> : (
        <table className="mt-6 w-full border-collapse bg-papel text-left">
          <thead className="bg-marfim-2 text-sm"><tr><th scope="col" className="p-3">Ministério</th><th scope="col" className="p-3">Resumo</th><th scope="col" className="p-3">Situação</th></tr></thead>
          <tbody>
            {mine.map((m) => (
              <tr key={m.id} className="border-t border-linha">
                <td className="p-3"><Link href={`/admin/ministerios/${m.id}`} className="font-semibold">{m.name}</Link></td>
                <td className="p-3 text-sm text-tinta-2">{m.summary ?? "—"}</td>
                <td className="p-3 space-x-1">{m.published ? <Badge tone="sucesso">Publicado</Badge> : <Badge>Oculto</Badge>} {m.isDemo && <Badge tone="alerta">Demonstração</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
