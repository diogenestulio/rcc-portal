import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { event } from "@/db/schema";
import { requireAdmin } from "@/server/session";
import { decide } from "@/server/authz";
import { Badge, btn, EmptyState } from "@/components/ui";
import { fmtDateOnly, fmtDateTime } from "@/components/site/format";

export const metadata = { title: "Eventos" };

export default async function EventosAdmin() {
  const s = await requireAdmin();
  const all = await db.select({ e: event, inscritos: sql<number>`(select count(*)::int from registration r where r.event_id = ${event.id} and r.status in ('confirmada','reservada'))` })
    .from(event).orderBy(desc(event.createdAt)).limit(300);
  const list = all.filter(({ e }) => decide(s, "evento.gerenciar", { groupId: e.groupId }).ok || decide(s, "evento.checkin", { groupId: e.groupId }).ok);
  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Eventos e inscrições</h1>
        <Link href="/admin/eventos/novo" className={btn.primario}>Novo evento</Link>
      </div>
      {list.length === 0 ? <div className="mt-6"><EmptyState title="Nenhum evento no seu escopo" /></div> : (
        <table className="mt-6 w-full border-collapse bg-papel text-left">
          <thead className="bg-marfim-2 text-sm"><tr><th scope="col" className="p-3">Evento</th><th scope="col" className="p-3">Quando</th><th scope="col" className="p-3">Situação</th><th scope="col" className="p-3">Inscritos</th></tr></thead>
          <tbody>
            {list.map(({ e, inscritos }) => (
              <tr key={e.id} className="border-t border-linha">
                <td className="p-3"><Link href={`/admin/eventos/${e.id}`} className="font-semibold">{e.title}</Link>{e.source === "google" && <span className="ml-2 text-sm text-tinta-3">(importado do Google)</span>}</td>
                <td className="p-3 text-sm">{e.allDay ? fmtDateOnly(e.startDate!) : fmtDateTime(e.startsAt!)}{e.rrule ? " · recorrente" : ""}</td>
                <td className="p-3 space-x-1">
                  <Badge tone={e.publication === "publicado" ? "sucesso" : e.publication === "candidato" ? "alerta" : "neutro"}>{e.publication}</Badge>
                  {e.status !== "agendado" && <Badge tone={e.status === "cancelado" ? "perigo" : "alerta"}>{e.status}</Badge>}
                </td>
                <td className="p-3">{e.registrationEnabled ? `${inscritos}${e.capacity ? ` / ${e.capacity}` : ""}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
