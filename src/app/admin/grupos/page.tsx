import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { groupCorrection, prayerGroup } from "@/db/schema";
import { requireAdmin, canView } from "@/server/session";
import { decide } from "@/server/authz";
import { isStale } from "@/server/groups";
import { Badge, btn, EmptyState, Notice } from "@/components/ui";
import { fmtPublished, hhmm, weekday } from "@/components/site/format";
import { moderar } from "./actions";

export const metadata = { title: "Grupos de Oração" };

export default async function GruposAdmin({ searchParams }: PageProps<"/admin/grupos">) {
  const s = await requireAdmin();
  const sp = await searchParams;
  const all = await db.select().from(prayerGroup).orderBy(prayerGroup.name);
  // Filtra pelo ESCOPO do usuário no servidor (responsável local vê só os seus).
  const mine = all.filter((g) => decide(s, "grupo.editar", { groupId: g.id, regionId: g.regionId }).ok);
  const list = sp.desatualizados ? mine.filter((g) => isStale(g.lastConfirmedAt)) : mine;
  const corrections = canView(s, "grupo.moderar_correcoes")
    ? await db.select({ c: groupCorrection, name: prayerGroup.name, gid: prayerGroup.id }).from(groupCorrection).innerJoin(prayerGroup, eq(prayerGroup.id, groupCorrection.groupId))
        .where(eq(groupCorrection.status, "pendente")).orderBy(desc(groupCorrection.createdAt)).limit(100)
    : [];
  const [{ n: staleCount }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from prayer_group where published and (last_confirmed_at is null or last_confirmed_at < now() - interval '180 days')`);

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-semibold">Grupos de Oração</h1>
      {typeof sp.ok === "string" && <div className="mt-4"><Notice tone="sucesso">Alteração registrada.</Notice></div>}
      <p className="mt-2 text-tinta-2">{mine.length} grupo(s) no seu escopo · {staleCount} publicados sem confirmação há mais de 180 dias. <Link href={sp.desatualizados ? "/admin/grupos" : "/admin/grupos?desatualizados=1"}>{sp.desatualizados ? "Ver todos" : "Ver só desatualizados"}</Link></p>
      {list.length === 0 ? <div className="mt-6"><EmptyState title="Nenhum grupo no seu escopo" /></div> : (
        <table className="mt-6 w-full border-collapse bg-papel text-left">
          <thead className="bg-marfim-2 text-sm"><tr><th scope="col" className="p-3">Grupo</th><th scope="col" className="p-3">Quando</th><th scope="col" className="p-3">Situação</th><th scope="col" className="p-3">Confirmado</th></tr></thead>
          <tbody>
            {list.map((g) => (
              <tr key={g.id} className="border-t border-linha">
                <td className="p-3"><Link href={`/admin/grupos/${g.id}`} className="font-semibold">{g.name}</Link></td>
                <td className="p-3">{weekday(g.weekday)}, {hhmm(g.startTime)}</td>
                <td className="p-3 space-x-1">{g.published ? <Badge tone="sucesso">Publicado</Badge> : <Badge>Oculto</Badge>} {g.status !== "ativo" && <Badge tone="alerta">{g.status}</Badge>}</td>
                <td className="p-3 text-sm">{g.lastConfirmedAt ? fmtPublished(g.lastConfirmedAt) : "nunca"} {isStale(g.lastConfirmedAt) && <Badge tone="alerta">Conferir</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canView(s, "grupo.moderar_correcoes") && (
        <section id="correcoes" className="mt-12">
          <h2 className="text-2xl font-semibold">Sugestões de correção de visitantes</h2>
          <p className="text-tinta-2">Nada é aplicado automaticamente: confira e edite o grupo se a sugestão proceder.</p>
          {corrections.length === 0 ? <p className="mt-4 text-tinta-3">Nenhuma sugestão pendente.</p> : (
            <ul className="mt-4 space-y-3">
              {corrections.map(({ c, name, gid }) => (
                <li key={c.id} className="rounded-[var(--radius-md)] border border-linha bg-papel p-4">
                  <p className="text-sm text-tinta-3"><Link href={`/admin/grupos/${gid}`}>{name}</Link> · {fmtPublished(c.createdAt)}{c.contactEmail ? ` · ${c.contactEmail}` : ""}</p>
                  <p className="mt-1 whitespace-pre-line">{c.message}</p>
                  <form action={moderar} className="mt-3 flex gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <button name="decisao" value="aceita" className={btn.secundario}>Marcar como aplicada</button>
                    <button name="decisao" value="rejeitada" className={btn.discreto}>Rejeitar</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
