import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { event, prayerGroup, registration } from "@/db/schema";
import { requireAdmin } from "@/server/session";
import { assertCan, decide } from "@/server/authz";
import { audit } from "@/server/audit";
import { Badge, btn, Notice } from "@/components/ui";
import { fmtPublished } from "@/components/site/format";
import { EventForm } from "../EventForm";
import { publicarEvento } from "../actions";

export const metadata = { title: "Evento" };

export default async function EventoAdmin({ params, searchParams }: PageProps<"/admin/eventos/[id]">) {
  const s = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [ev] = await db.select().from(event).where(eq(event.id, id));
  if (!ev) notFound();
  assertCan(s, "evento.gerenciar", { groupId: ev.groupId });
  const groups = (await db.select({ id: prayerGroup.id, name: prayerGroup.name, regionId: prayerGroup.regionId }).from(prayerGroup).orderBy(prayerGroup.name))
    .filter((g) => decide(s, "evento.gerenciar", { groupId: g.id, regionId: g.regionId }).ok);
  const canSee = decide(s, "evento.participantes", { groupId: ev.groupId }).ok;
  const regs = canSee ? await db.select().from(registration).where(eq(registration.eventId, id)).orderBy(desc(registration.createdAt)).limit(1000) : [];
  if (canSee && regs.length) await audit(db, { actorId: s.userId, action: "evento.ver_participantes", resourceType: "event", resourceId: id, detail: { quantidade: regs.length } });

  return (
    <div className="max-w-6xl">
      <p><Link href="/admin/eventos">← Eventos</Link></p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">{ev.title}</h1>
        <Badge tone={ev.publication === "publicado" ? "sucesso" : "neutro"}>{ev.publication}</Badge>
      </div>
      {sp.ok && <div className="mt-4"><Notice tone="sucesso">Salvo.</Notice></div>}
      {sp.erro === "google" && <div className="mt-4"><Notice tone="alerta">Evento importado do Google: edite na agenda institucional do Google.</Notice></div>}
      {sp.erro === "dados" && <div className="mt-4"><Notice tone="perigo">Confira título, data e horários.</Notice></div>}
      {ev.source === "google" && <div className="mt-4"><Notice tone="info">Importado do Google Agenda (fonte de verdade). Campos importados bloqueados; aqui você só publica ou despublica.</Notice></div>}
      <div className="mt-4 flex flex-wrap gap-3">
        <form action={publicarEvento}><input type="hidden" name="id" value={ev.id} /><input type="hidden" name="publicar" value={ev.publication === "publicado" ? "0" : "1"} />
          <button className={ev.publication === "publicado" ? btn.discreto : btn.primario}>{ev.publication === "publicado" ? "Despublicar" : "Publicar no portal"}</button></form>
        {ev.publication === "publicado" && <Link href={`/agenda/${ev.slug}`} className={btn.discreto}>Ver página pública</Link>}
        {ev.registrationEnabled && <Link href={`/admin/eventos/${ev.id}/checkin`} className={btn.secundario}>Check-in</Link>}
        {canSee && decide(s, "evento.exportar").ok && <a href={`/admin/eventos/${ev.id}/participantes.csv`} className={btn.discreto}>Exportar participantes (CSV, auditado)</a>}
      </div>
      <div className="mt-8 grid gap-10 xl:grid-cols-2">
        <section><h2 className="mb-4 text-xl font-semibold">Dados do evento</h2><EventForm ev={ev} groups={groups} locked={ev.source === "google"} /></section>
        {ev.registrationEnabled && canSee && (
          <section>
            <h2 className="text-xl font-semibold">Inscrições ({regs.filter((r) => r.status === "confirmada").length} confirmadas)</h2>
            <p className="text-sm text-tinta-3">Lista restrita. O acesso é registrado na auditoria.</p>
            <table className="mt-4 w-full border-collapse bg-papel text-left text-sm">
              <thead className="bg-marfim-2"><tr><th scope="col" className="p-2">Nome</th><th scope="col" className="p-2">Situação</th><th scope="col" className="p-2">Check-in</th><th scope="col" className="p-2">Data</th></tr></thead>
              <tbody>{regs.map((r) => (
                <tr key={r.id} className="border-t border-linha"><td className="p-2">{r.fullName}<span className="block text-tinta-3">{r.email}</span></td><td className="p-2">{r.status}</td><td className="p-2">{r.checkedInAt ? "sim" : "—"}</td><td className="p-2">{fmtPublished(r.createdAt)}</td></tr>
              ))}</tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  );
}
