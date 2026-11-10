/**
 * Fluxo editorial: rascunho → em_revisao → aprovado → agendado/publicado → arquivado.
 * Regras (testadas em tests/content.test.ts):
 *  - Aprovação pertence a UMA revisão. Qualquer edição cria nova revisão e exige nova aprovação.
 *  - A versão pública anterior continua no ar enquanto a nova aguarda revisão.
 *  - Conteúdo doutrinal, pastoral, devocional e testemunho só é aprovado por quem tem
 *    `conteudo.aprovar_doutrinal` (revisor designado). Isso NÃO equivale a aprovação eclesiástica formal.
 *  - Ninguém aprova a revisão que ele próprio escreveu.
 */
import { and, eq, sql } from "drizzle-orm";
import sanitizeHtml from "sanitize-html";
import type { DB } from "@/db";
import { contentItem, contentRevision } from "@/db/schema";
import { assertCan, type Subject } from "./authz";
import { audit } from "./audit";

export type Nature = "doutrina" | "orientacao_pastoral" | "devocao" | "testemunho" | "institucional" | "noticia";
export const DOCTRINAL: ReadonlySet<Nature> = new Set(["doutrina", "orientacao_pastoral", "devocao", "testemunho"]);

export class WorkflowError extends Error {}

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "h2", "h3", "h4", "strong", "em", "u", "s", "blockquote", "ul", "ol", "li", "a", "figure", "figcaption", "img", "hr", "cite"],
    allowedAttributes: { a: ["href", "title", "rel", "target"], img: ["src", "alt", "width", "height", "loading"] },
    allowedSchemes: ["https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: "noopener noreferrer" } }),
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
    },
    disallowedTagsMode: "discard",
  }).slice(0, 200_000);
}

export type RevisionInput = {
  title: string; summary?: string | null; bodyHtml: string; nature: Nature;
  authorName?: string | null; sourceReference?: string | null; rightsNotice?: string | null; coverMediaId?: string | null;
};

const kindNatureOk = (kind: string, nature: Nature) => !(kind === "noticia" && nature === "doutrina");

export async function createDraft(db: DB, s: Subject, input: { kind: "pagina" | "noticia" | "formacao" | "comunicado"; slug: string } & RevisionInput) {
  assertCan(s, "conteudo.criar");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) throw new WorkflowError("Endereço (slug) inválido: use letras minúsculas, números e hífens.");
  if (!kindNatureOk(input.kind, input.nature)) throw new WorkflowError("Notícia não pode ser classificada como doutrina; use Formação.");
  return db.transaction(async (tx) => {
    const [item] = await tx.insert(contentItem).values({ kind: input.kind, slug: input.slug }).returning();
    const [rev] = await tx.insert(contentRevision).values({
      itemId: item.id, number: 1, title: input.title.trim(), summary: input.summary ?? null,
      bodyHtml: sanitizeRichText(input.bodyHtml), nature: input.nature, authorName: input.authorName ?? null,
      sourceReference: input.sourceReference ?? null, rightsNotice: input.rightsNotice ?? null,
      coverMediaId: input.coverMediaId ?? null, createdBy: s.userId,
      searchVector: `${input.title} ${input.summary ?? ""} ${sanitizeHtml(input.bodyHtml, { allowedTags: [] })}`,
    }).returning();
    await tx.update(contentItem).set({ currentRevisionId: rev.id }).where(eq(contentItem.id, item.id));
    await audit(tx, { actorId: s.userId, action: "conteudo.criar", resourceType: "content", resourceId: item.id });
    return { itemId: item.id, revisionId: rev.id };
  });
}

async function lockItem(tx: Parameters<Parameters<DB["transaction"]>[0]>[0], itemId: string) {
  const rows = await tx.select().from(contentItem).where(eq(contentItem.id, itemId)).for("update");
  if (!rows[0]) throw new WorkflowError("Conteúdo não encontrado.");
  return rows[0];
}

/** Edição sempre gera nova revisão; a aprovação anterior não se transfere. */
export async function editContent(db: DB, s: Subject, itemId: string, input: RevisionInput) {
  assertCan(s, "conteudo.editar");
  return db.transaction(async (tx) => {
    const item = await lockItem(tx, itemId);
    if (item.status === "arquivado") throw new WorkflowError("Conteúdo arquivado: restaure antes de editar.");
    if (!kindNatureOk(item.kind, input.nature)) throw new WorkflowError("Notícia não pode ser classificada como doutrina; use Formação.");
    const [{ max }] = await tx.select({ max: sql<number>`max(${contentRevision.number})` }).from(contentRevision).where(eq(contentRevision.itemId, itemId));
    const [rev] = await tx.insert(contentRevision).values({
      itemId, number: Number(max) + 1, title: input.title.trim(), summary: input.summary ?? null,
      bodyHtml: sanitizeRichText(input.bodyHtml), nature: input.nature, authorName: input.authorName ?? null,
      sourceReference: input.sourceReference ?? null, rightsNotice: input.rightsNotice ?? null,
      coverMediaId: input.coverMediaId ?? null, createdBy: s.userId,
      searchVector: `${input.title} ${input.summary ?? ""} ${sanitizeHtml(input.bodyHtml, { allowedTags: [] })}`,
    }).returning();
    // publishedRevisionId é preservado: a versão pública anterior continua no ar.
    await tx.update(contentItem).set({ currentRevisionId: rev.id, status: "rascunho", publishAt: null, updatedAt: new Date() }).where(eq(contentItem.id, itemId));
    await audit(tx, { actorId: s.userId, action: "conteudo.editar", resourceType: "content", resourceId: itemId, detail: { revisao: rev.number } });
    return { revisionId: rev.id, number: rev.number };
  });
}

export async function submitForReview(db: DB, s: Subject, itemId: string) {
  assertCan(s, "conteudo.enviar_revisao");
  return db.transaction(async (tx) => {
    const item = await lockItem(tx, itemId);
    if (item.status !== "rascunho") throw new WorkflowError(`Só rascunhos vão para revisão (estado atual: ${item.status}).`);
    await tx.update(contentItem).set({ status: "em_revisao", updatedAt: new Date() }).where(eq(contentItem.id, itemId));
    await audit(tx, { actorId: s.userId, action: "conteudo.enviar_revisao", resourceType: "content", resourceId: itemId });
  });
}

export async function approveRevision(db: DB, s: Subject, itemId: string, revisionId: string, note?: string) {
  return db.transaction(async (tx) => {
    const item = await lockItem(tx, itemId);
    if (item.status !== "em_revisao") throw new WorkflowError("Este conteúdo não está aguardando revisão.");
    if (item.currentRevisionId !== revisionId) throw new WorkflowError("A revisão foi alterada depois do envio; revise a versão mais recente.");
    const [rev] = await tx.select().from(contentRevision).where(and(eq(contentRevision.id, revisionId), eq(contentRevision.itemId, itemId)));
    if (!rev) throw new WorkflowError("Revisão não encontrada.");
    assertCan(s, DOCTRINAL.has(rev.nature as Nature) ? "conteudo.aprovar_doutrinal" : "conteudo.aprovar_geral");
    if (rev.createdBy === s.userId) throw new WorkflowError("Quem escreveu a revisão não pode aprová-la.");
    await tx.update(contentRevision).set({ approvedBy: s.userId, approvedAt: new Date(), reviewNote: note ?? null }).where(eq(contentRevision.id, revisionId));
    await tx.update(contentItem).set({ status: "aprovado", updatedAt: new Date() }).where(eq(contentItem.id, itemId));
    await audit(tx, { actorId: s.userId, action: "conteudo.aprovar", resourceType: "content", resourceId: itemId, detail: { revisao: rev.number, natureza: rev.nature } });
  });
}

export async function returnToDraft(db: DB, s: Subject, itemId: string, note: string) {
  return db.transaction(async (tx) => {
    const item = await lockItem(tx, itemId);
    const [rev] = await tx.select().from(contentRevision).where(eq(contentRevision.id, item.currentRevisionId!));
    assertCan(s, DOCTRINAL.has(rev.nature as Nature) ? "conteudo.aprovar_doutrinal" : "conteudo.aprovar_geral");
    if (item.status !== "em_revisao") throw new WorkflowError("Este conteúdo não está aguardando revisão.");
    await tx.update(contentRevision).set({ reviewNote: note }).where(eq(contentRevision.id, rev.id));
    await tx.update(contentItem).set({ status: "rascunho", updatedAt: new Date() }).where(eq(contentItem.id, itemId));
    await audit(tx, { actorId: s.userId, action: "conteudo.devolver", resourceType: "content", resourceId: itemId });
  });
}

export async function publish(db: DB, s: Subject, itemId: string, at?: Date, now = new Date()) {
  assertCan(s, "conteudo.publicar");
  return db.transaction(async (tx) => {
    const item = await lockItem(tx, itemId);
    if (item.status !== "aprovado") throw new WorkflowError("Só é possível publicar uma revisão aprovada.");
    const [rev] = await tx.select().from(contentRevision).where(eq(contentRevision.id, item.currentRevisionId!));
    if (!rev?.approvedAt || !rev.approvedBy) throw new WorkflowError("A revisão atual não tem aprovação registrada.");
    const scheduled = at && at.getTime() > now.getTime();
    await tx.update(contentItem).set(scheduled
      ? { status: "agendado", publishAt: at, updatedAt: now }
      : { status: "publicado", publishedRevisionId: rev.id, publishedAt: item.publishedAt ?? now, publishAt: null, updatedAt: now },
    ).where(eq(contentItem.id, itemId));
    await audit(tx, { actorId: s.userId, action: scheduled ? "conteudo.agendar" : "conteudo.publicar", resourceType: "content", resourceId: itemId, detail: { revisao: rev.number } });
    return { scheduled: !!scheduled };
  });
}

/** Executado pelo worker: publica itens agendados cujo horário chegou (revisão ainda aprovada). */
export async function publishDue(db: DB, now = new Date()) {
  const rows = await db.execute<{ id: string }>(sql`
    update content_item ci set status = 'publicado', published_revision_id = ci.current_revision_id,
      published_at = coalesce(ci.published_at, ${now.toISOString()}::timestamptz), publish_at = null, updated_at = now()
    from content_revision r
    where r.id = ci.current_revision_id and r.approved_at is not null
      and ci.status = 'agendado' and ci.publish_at <= ${now.toISOString()}::timestamptz
    returning ci.id`);
  for (const r of rows) await audit(db, { actorId: null, action: "conteudo.publicar_agendado", resourceType: "content", resourceId: r.id });
  return rows.length;
}

export async function archive(db: DB, s: Subject, itemId: string) {
  assertCan(s, "conteudo.arquivar");
  await db.transaction(async (tx) => {
    await lockItem(tx, itemId);
    await tx.update(contentItem).set({ status: "arquivado", archivedAt: new Date(), publishedRevisionId: null, updatedAt: new Date() }).where(eq(contentItem.id, itemId));
    await audit(tx, { actorId: s.userId, action: "conteudo.arquivar", resourceType: "content", resourceId: itemId });
  });
}

/** Leitura pública: SEMPRE a revisão publicada, nunca a de trabalho. */
export async function getPublished(db: DB, kind: string, slug: string) {
  const rows = await db.execute<{ id: string; slug: string; kind: string; published_at: Date; title: string; summary: string | null; body_html: string; nature: string; author_name: string | null; source_reference: string | null; rights_notice: string | null; approved_at: Date; updated_at: Date; is_demo: boolean }>(sql`
    select ci.id, ci.slug, ci.kind, ci.published_at, ci.is_demo, r.title, r.summary, r.body_html, r.nature, r.author_name,
           r.source_reference, r.rights_notice, r.approved_at, r.created_at as updated_at
    from content_item ci join content_revision r on r.id = ci.published_revision_id
    where ci.kind = ${kind}::content_kind and ci.slug = ${slug} and ci.published_revision_id is not null and ci.status <> 'arquivado'`);
  return rows[0] ?? null;
}

export async function listPublished(db: DB, kind: string, limit = 12, offset = 0) {
  return db.execute<{ id: string; slug: string; published_at: Date; title: string; summary: string | null; nature: string; is_demo: boolean }>(sql`
    select ci.id, ci.slug, ci.published_at, ci.is_demo, r.title, r.summary, r.nature
    from content_item ci join content_revision r on r.id = ci.published_revision_id
    where ci.kind = ${kind}::content_kind and ci.published_revision_id is not null and ci.status <> 'arquivado'
    order by ci.published_at desc limit ${Math.min(limit, 50)} offset ${Math.max(0, offset)}`);
}
