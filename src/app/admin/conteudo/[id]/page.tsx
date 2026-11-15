import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contentItem, contentRevision, user } from "@/db/schema";
import { requireAdmin, canView } from "@/server/session";
import { DOCTRINAL, type Nature } from "@/server/content";
import { htmlToText } from "@/server/richtext";
import { Badge, btn, field, Notice } from "@/components/ui";
import { fmtPublished } from "@/components/site/format";
import { ContentFields } from "../ContentForm";
import { salvar, transicao } from "../actions";
import { STATUS_LABEL } from "../labels";

export const metadata = { title: "Editar conteúdo" };
const PUBLIC_BASE: Record<string, string> = { pagina: "/a-rcc", noticia: "/noticias", formacao: "/formacao", comunicado: "/noticias" };
const OK: Record<string, string> = { criado: "Rascunho criado.", salvo: "Nova revisão salva como rascunho.", enviar: "Enviado para revisão.", aprovar: "Revisão aprovada.", devolver: "Devolvido ao autor.", publicar: "Publicado (ou agendado).", arquivar: "Arquivado." };

export default async function EditContent({ params, searchParams }: PageProps<"/admin/conteudo/[id]">) {
  const s = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [item] = await db.select().from(contentItem).where(eq(contentItem.id, id));
  if (!item) notFound();
  const revs = await db.select({ r: contentRevision, author: user.name }).from(contentRevision).leftJoin(user, eq(user.id, contentRevision.createdBy))
    .where(eq(contentRevision.itemId, id)).orderBy(desc(contentRevision.number));
  const cur = revs.find((x) => x.r.id === item.currentRevisionId)!.r;
  const doctrinal = DOCTRINAL.has(cur.nature as Nature);
  const canApprove = canView(s, doctrinal ? "conteudo.aprovar_doutrinal" : "conteudo.aprovar_geral") && cur.createdBy !== s.userId;
  const [label, tone] = STATUS_LABEL[item.status];

  return (
    <div className="max-w-6xl">
      <p><Link href="/admin/conteudo">← Conteúdo</Link></p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">{cur.title}</h1>
        <Badge tone={tone}>{label}</Badge>
        {doctrinal && <Badge tone="marca">Revisão doutrinal obrigatória</Badge>}
      </div>
      <p className="mt-1 text-sm text-tinta-3">Revisão nº {cur.number} · {item.publishedRevisionId ? <Link href={`${PUBLIC_BASE[item.kind]}/${item.slug}`}>ver versão pública</Link> : "ainda não publicado"}</p>
      {typeof sp.erro === "string" && <div className="mt-4"><Notice tone="perigo">{sp.erro}</Notice></div>}
      {typeof sp.ok === "string" && OK[sp.ok] && <div className="mt-4"><Notice tone="sucesso">{OK[sp.ok]}</Notice></div>}
      {item.publishedRevisionId && item.publishedRevisionId !== cur.id && <div className="mt-4"><Notice tone="info">A versão publicada anterior continua no ar até esta revisão ser aprovada e publicada.</Notice></div>}
      {cur.reviewNote && item.status === "rascunho" && <div className="mt-4"><Notice tone="alerta" title="Observação do revisor">{cur.reviewNote}</Notice></div>}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <form action={salvar}>
          <input type="hidden" name="id" value={id} />
          <ContentFields disabled={!canView(s, "conteudo.editar") || item.status === "arquivado"}
            v={{ titulo: cur.title, resumo: cur.summary, texto: htmlToText(cur.bodyHtml), natureza: cur.nature, autor: cur.authorName, fontes: cur.sourceReference, direitos: cur.rightsNotice }} />
          <p className="mt-3 text-sm text-tinta-3">Salvar cria uma nova revisão e exige nova aprovação antes de publicar.</p>
        </form>

        <aside aria-label="Fluxo e histórico" className="space-y-4">
          <section className="rounded-[var(--radius-lg)] border border-linha bg-papel p-4">
            <h2 className="text-lg font-semibold">Fluxo</h2>
            <p className="mt-2 text-sm text-tinta-2">rascunho → em revisão → aprovado → publicado/agendado → arquivado</p>
            <div className="mt-4 space-y-3">
              {item.status === "rascunho" && canView(s, "conteudo.enviar_revisao") && (
                <form action={transicao}><input type="hidden" name="id" value={id} /><input type="hidden" name="acao" value="enviar" /><button className={btn.secundario + " w-full"}>Enviar para revisão</button></form>
              )}
              {item.status === "em_revisao" && canApprove && (
                <form action={transicao} className="space-y-2">
                  <input type="hidden" name="id" value={id} /><input type="hidden" name="revisao" value={cur.id} />
                  <label htmlFor="nota" className={field.label}>Observação (opcional)</label>
                  <textarea id="nota" name="nota" rows={2} className={field.input} />
                  <div className="flex gap-2">
                    <button name="acao" value="aprovar" className={btn.primario}>Aprovar</button>
                    <button name="acao" value="devolver" className={btn.secundario}>Devolver</button>
                  </div>
                  <p className="text-xs text-tinta-3">Aprovação interna — não equivale a aprovação eclesiástica formal.</p>
                </form>
              )}
              {item.status === "em_revisao" && !canApprove && <p className="text-sm text-tinta-2">Aguardando {doctrinal ? "revisor doutrinal" : "revisor"}{cur.createdBy === s.userId ? " (você não pode aprovar o próprio texto)" : ""}.</p>}
              {item.status === "aprovado" && canView(s, "conteudo.publicar") && (
                <form action={transicao} className="space-y-2">
                  <input type="hidden" name="id" value={id} /><input type="hidden" name="acao" value="publicar" />
                  <label htmlFor="quando" className={field.label}>Agendar (opcional, horário de Cuiabá)</label>
                  <input id="quando" name="quando" type="datetime-local" className={field.input} />
                  <button className={btn.primario + " w-full"}>Publicar</button>
                </form>
              )}
              {item.status !== "arquivado" && canView(s, "conteudo.arquivar") && (
                <form action={transicao}><input type="hidden" name="id" value={id} /><input type="hidden" name="acao" value="arquivar" /><button className={btn.discreto + " w-full"}>Arquivar</button></form>
              )}
            </div>
          </section>
          <section className="rounded-[var(--radius-lg)] border border-linha bg-papel p-4">
            <h2 className="text-lg font-semibold">Histórico</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {revs.map(({ r, author }) => (
                <li key={r.id}>
                  <span className="font-semibold">nº {r.number}</span> · {author ?? "—"} · {fmtPublished(r.createdAt)}
                  {r.approvedAt && <span className="text-verde"> · aprovada</span>}
                  {r.id === item.publishedRevisionId && <span className="text-marca"> · no ar</span>}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
