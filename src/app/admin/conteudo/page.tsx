import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireAdmin, canView } from "@/server/session";
import { Badge, btn, EmptyState } from "@/components/ui";
import { fmtPublished } from "@/components/site/format";
import { STATUS_LABEL } from "./labels";

export const metadata = { title: "Conteúdo" };
const KIND: Record<string, string> = { pagina: "Página", noticia: "Notícia", formacao: "Formação", comunicado: "Comunicado" };

export default async function ConteudoList({ searchParams }: PageProps<"/admin/conteudo">) {
  const s = await requireAdmin();
  const sp = await searchParams;
  const status = typeof sp.status === "string" && sp.status in STATUS_LABEL ? sp.status : null;
  const rows = await db.execute<{ id: string; kind: string; slug: string; status: string; updated_at: Date; title: string; nature: string; public: boolean }>(sql`
    select ci.id, ci.kind::text, ci.slug, ci.status::text, ci.updated_at, r.title, r.nature::text, ci.published_revision_id is not null as public
    from content_item ci join content_revision r on r.id = ci.current_revision_id
    ${status ? sql`where ci.status = ${status}::content_status` : sql``}
    order by ci.updated_at desc limit 200`);
  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Conteúdo</h1>
        {canView(s, "conteudo.criar") && <Link href="/admin/conteudo/novo" className={btn.primario}>Novo conteúdo</Link>}
      </div>
      <nav aria-label="Filtrar por estado" className="mt-4 flex flex-wrap gap-2">
        <Link href="/admin/conteudo" className={!status ? "font-bold" : ""}>Todos</Link>
        {Object.entries(STATUS_LABEL).map(([k, [l]]) => <Link key={k} href={`/admin/conteudo?status=${k}`} className={status === k ? "font-bold" : ""}>{l}</Link>)}
      </nav>
      {rows.length === 0 ? <div className="mt-6"><EmptyState title="Nenhum conteúdo aqui" /></div> : (
        <table className="mt-6 w-full border-collapse overflow-hidden rounded-[var(--radius-md)] bg-papel text-left">
          <thead className="bg-marfim-2 text-sm"><tr><th scope="col" className="p-3">Título</th><th scope="col" className="p-3">Tipo</th><th scope="col" className="p-3">Estado</th><th scope="col" className="p-3">Atualizado</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-linha">
                <td className="p-3"><Link href={`/admin/conteudo/${r.id}`} className="font-semibold">{r.title}</Link>{r.public && r.status !== "publicado" && <span className="ml-2 text-sm text-tinta-3">(versão anterior no ar)</span>}</td>
                <td className="p-3">{KIND[r.kind]}</td>
                <td className="p-3"><Badge tone={STATUS_LABEL[r.status][1]}>{STATUS_LABEL[r.status][0]}</Badge></td>
                <td className="p-3 text-sm text-tinta-2">{fmtPublished(r.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
