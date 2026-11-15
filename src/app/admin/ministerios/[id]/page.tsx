import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ministry } from "@/db/schema";
import { requireCan, canView } from "@/server/session";
import { btn, Notice } from "@/components/ui";
import { MinistryFields } from "../campos";
import { publicarMinisterio, salvarMinisterio } from "../actions";

export const metadata = { title: "Editar ministério" };

export default async function EditarMinisterio({ params, searchParams }: PageProps<"/admin/ministerios/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await requireCan("ministerio.editar", { ministryId: id });
  const sp = await searchParams;
  const [m] = await db.select().from(ministry).where(eq(ministry.id, id));
  if (!m) notFound();
  return (
    <div className="max-w-3xl">
      <p><Link href="/admin/ministerios">← Ministérios</Link></p>
      <h1 className="mt-3 text-3xl font-semibold">{m.name}</h1>
      <p className="text-sm text-tinta-3">
        {m.published ? <>No site: <Link href={`/ministerios/${m.slug}`}>/ministerios/{m.slug}</Link></> : "Oculto: não aparece no site."}
      </p>
      {sp.ok && <div className="mt-4"><Notice tone="sucesso">Salvo.</Notice></div>}
      {sp.novo && <div className="mt-4"><Notice tone="sucesso" title="Ministério criado (oculto)">Confira o texto e clique em “Publicar no portal” quando estiver pronto.</Notice></div>}
      {typeof sp.erro === "string" && <div className="mt-4"><Notice tone="perigo">{sp.erro}</Notice></div>}
      <form action={salvarMinisterio} className="mt-6 space-y-5">
        <input type="hidden" name="id" value={m.id} />
        <MinistryFields m={m} />
        <button className={btn.primario}>Salvar</button>
      </form>
      {canView(s, "ministerio.publicar") && (
        <form action={publicarMinisterio} className="mt-8 border-t border-linha pt-6">
          <input type="hidden" name="id" value={m.id} />
          <input type="hidden" name="publicar" value={m.published ? "0" : "1"} />
          <button className={m.published ? btn.discreto : btn.secundario}>{m.published ? "Ocultar do portal" : "Publicar no portal"}</button>
        </form>
      )}
    </div>
  );
}
