import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireAdmin, canView } from "@/server/session";
import { Badge, btn, EmptyState, field, Notice } from "@/components/ui";
import { fmtPublished } from "@/components/site/format";
import { STATUS_LABEL } from "./labels";
import { paginaFixa } from "@/server/content";
import { vincularQuemSomos } from "./actions";

export const metadata = { title: "Conteúdo" };
const KIND: Record<string, string> = { pagina: "Página", noticia: "Notícia", formacao: "Formação", comunicado: "Comunicado", igreja: "Sede" };

export default async function ConteudoList({ searchParams }: PageProps<"/admin/conteudo">) {
  const s = await requireAdmin();
  const sp = await searchParams;
  const status = typeof sp.status === "string" && sp.status in STATUS_LABEL ? sp.status : null;
  const rows = await db.execute<{ id: string; kind: string; slug: string; status: string; updated_at: Date; title: string; nature: string; public: boolean }>(sql`
    select ci.id, ci.kind::text, ci.slug, ci.status::text, ci.updated_at, r.title, r.nature::text, ci.published_revision_id is not null as public
    from content_item ci join content_revision r on r.id = ci.current_revision_id
    ${status ? sql`where ci.status = ${status}::content_status` : sql``}
    order by ci.updated_at desc limit 200`);
  const qs = await paginaFixa(db, "quem-somos");
  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Conteúdo</h1>
        {canView(s, "conteudo.criar") && <Link href="/admin/conteudo/novo" className={btn.primario}>Novo conteúdo</Link>}
      </div>
      {sp.ok === "vinculado" && <div className="mt-4"><Notice tone="sucesso">Página vinculada a A RCC → Quem Somos.</Notice></div>}
      {typeof sp.erro === "string" && <div className="mt-4"><Notice tone="perigo">{sp.erro}</Notice></div>}
      <section id="quem-somos" aria-labelledby="qs-titulo" className="mt-6 rounded-[var(--radius-lg)] border border-linha bg-papel p-5">
        <h2 id="qs-titulo" className="font-titulo text-xl font-bold">A RCC → Quem Somos</h2>
        <p className="mt-1 text-sm text-tinta-3">É o texto que aparece ao clicar em “A RCC” no menu. O vínculo não depende do título nem do endereço.</p>
        {qs.vinculada ? (
          <p className="mt-3 flex flex-wrap items-center gap-2">
            <Link href={`/admin/conteudo/${qs.vinculada.id}`} className="font-semibold">{qs.vinculada.title}</Link>
            <Badge tone={STATUS_LABEL[qs.vinculada.status]?.[1] ?? "neutro"}>{STATUS_LABEL[qs.vinculada.status]?.[0] ?? qs.vinculada.status}</Badge>
            {qs.vinculada.is_demo && <Badge tone="alerta">Demonstração</Badge>}
            {!qs.vinculada.publicada && <span className="text-sm text-alerta">Sem versão publicada: o site mostra “em preparação”.</span>}
          </p>
        ) : (
          <p className="mt-3 text-alerta">Nenhuma página vinculada: o site mostra “em preparação” em A RCC.</p>
        )}
        {canView(s, "conteudo.estrutura") && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            {qs.candidatas.length > 0 && (
              <form action={vincularQuemSomos} className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="qs-item" className={field.label}>{qs.vinculada ? "Trocar a página vinculada" : "Escolher a página"}</label>
                  <select id="qs-item" name="item" defaultValue={qs.vinculada?.id ?? ""} className={field.input} required>
                    <option value="" disabled>Escolha…</option>
                    {qs.candidatas.map((c) => <option key={c.id} value={c.id}>{c.title} (/{c.slug})</option>)}
                  </select>
                </div>
                <button className={btn.secundario}>Vincular</button>
              </form>
            )}
            {!qs.vinculada && canView(s, "conteudo.criar") && <Link href="/admin/conteudo/novo?tipo=pagina&chave=quem-somos" className={btn.primario}>Criar a página Quem Somos</Link>}
          </div>
        )}
      </section>
      <nav aria-label="Filtrar por estado" className="mt-6 flex flex-wrap gap-2">
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
