import Link from "next/link";
import { db } from "@/db";
import { prayerGroup } from "@/db/schema";
import { requireAdmin } from "@/server/session";
import { decide } from "@/server/authz";
import { Notice } from "@/components/ui";
import { EventForm } from "../EventForm";

export const metadata = { title: "Novo evento" };

export default async function NovoEvento({ searchParams }: PageProps<"/admin/eventos/novo">) {
  const s = await requireAdmin();
  const sp = await searchParams;
  const groups = (await db.select({ id: prayerGroup.id, name: prayerGroup.name, regionId: prayerGroup.regionId }).from(prayerGroup).orderBy(prayerGroup.name))
    .filter((g) => decide(s, "evento.gerenciar", { groupId: g.id, regionId: g.regionId }).ok);
  return (
    <div className="max-w-3xl">
      <p><Link href="/admin/eventos">← Eventos</Link></p>
      <h1 className="mt-3 text-3xl font-semibold">Novo evento</h1>
      <p className="text-tinta-2">O evento nasce como rascunho; publique depois de conferir.</p>
      {sp.erro && <div className="mt-4"><Notice tone="perigo">Confira título, data e horários (o término deve ser depois do início).</Notice></div>}
      <div className="mt-6"><EventForm groups={groups} /></div>
    </div>
  );
}
