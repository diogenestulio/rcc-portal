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
    allowedAttributes: { a: ["href", "title", "rel", "target"], img: ["src", "srcset", "sizes", "alt", "width", "height", "loading", "decoding"], p: ["data-video", "data-titulo", "class"] },
    allowedClasses: { p: ["anexo"] },
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
  /** Só para "Igreja e Renovação" (opcionais): data (AAAA-MM-DD), término, local e link da fonte oficial (https). */
  eventDate?: string | null; eventEndDate?: string | null; eventPlace?: string | null; externalUrl?: string | null;
};

export type ContentKind = "pagina" | "noticia" | "formacao" | "comunicado" | "igreja";

/** Valida e normaliza os campos de evento/link (lança WorkflowError com mensagem para o usuário). */
function extras(i: RevisionInput) {
  const d = (v?: string | null) => {
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00Z`))) throw new WorkflowError("Data inválida: use o seletor de data.");
    return v;
  };
  const eventDate = d(i.eventDate), eventEndDate = d(i.eventEndDate);
  if (eventEndDate && !eventDate) throw new WorkflowError("Informe a data de início antes da data de término.");
  if (eventDate && eventEndDate && eventEndDate < eventDate) throw new WorkflowError("A data de término é anterior à de início.");
  let externalUrl: string | null = (i.externalUrl ?? "").trim() || null;
  if (externalUrl) {
    try { const u = new URL(externalUrl); if (u.protocol !== "https:") throw new Error(); externalUrl = u.toString(); }
    catch { throw new WorkflowError("Link oficial inválido: use um endereço completo começando com https://"); }
  }
  return { eventDate, eventEndDate, eventPlace: (i.eventPlace ?? "").trim().slice(0, 200) || null, externalUrl, coverMediaId: i.coverMediaId || null };
}

const kindNatureOk = (kind: string, nature: Nature) => !(kind === "noticia" && nature === "doutrina");

export async function createDraft(db: DB, s: Subject, input: { kind: ContentKind; slug: string } & RevisionInput) {
  assertCan(s, "conteudo.criar");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) throw new WorkflowError("Endereço (slug) inválido: use letras minúsculas, números e hífens.");
  if (!kindNatureOk(input.kind, input.nature)) throw new WorkflowError("Notícia não pode ser classificada como doutrina; use Formação.");
  return db.transaction(async (tx) => {
    const [item] = await tx.insert(contentItem).values({ kind: input.kind, slug: input.slug }).returning();
    const [rev] = await tx.insert(contentRevision).values({
      itemId: item.id, number: 1, title: input.title.trim(), summary: input.summary ?? null,
      bodyHtml: sanitizeRichText(input.bodyHtml), nature: input.nature, authorName: input.authorName ?? null,
      sourceReference: input.sourceReference ?? null, rightsNotice: input.rightsNotice ?? null,
      ...extras(input), createdBy: s.userId,
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
      ...extras(input), createdBy: s.userId,
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
export type PublicContent = {
  id: string; slug: string; kind: string; published_at: Date; title: string; summary: string | null; body_html: string; nature: string;
  author_name: string | null; source_reference: string | null; rights_notice: string | null; approved_at: Date; updated_at: Date; is_demo: boolean;
  event_date: string | null; event_end_date: string | null; event_place: string | null; external_url: string | null;
  cover_id: string | null; cover_key: string | null; cover_alt: string | null; cover_w: number | null; cover_h: number | null; cover_credit: string | null;
};
const COLS = sql`ci.id, ci.slug, ci.kind, ci.published_at, ci.is_demo, r.title, r.summary, r.nature,
  to_char(r.event_date, 'YYYY-MM-DD') as event_date, to_char(r.event_end_date, 'YYYY-MM-DD') as event_end_date, r.event_place, r.external_url,
  m.id as cover_id, m.storage_key as cover_key, m.alt_text as cover_alt, m.width as cover_w, m.height as cover_h, m.credit as cover_credit`;
const FROM = sql`from content_item ci join content_revision r on r.id = ci.published_revision_id
  left join media m on m.id = r.cover_media_id and not m.is_private`;

export async function getPublished(db: DB, kind: string, slug: string) {
  const rows = await db.execute<PublicContent>(sql`
    select ${COLS}, r.body_html, r.author_name, r.source_reference, r.rights_notice, r.approved_at, r.created_at as updated_at
    ${FROM}
    where ci.kind = ${kind}::content_kind and ci.slug = ${slug} and ci.published_revision_id is not null and ci.status <> 'arquivado'`);
  return rows[0] ?? null;
}

export type ListedContent = Omit<PublicContent, "body_html" | "author_name" | "source_reference" | "rights_notice" | "approved_at" | "updated_at">;

export async function listPublished(db: DB, kind: string, limit = 12, offset = 0) {
  return db.execute<ListedContent>(sql`
    select ${COLS} ${FROM}
    where ci.kind = ${kind}::content_kind and ci.published_revision_id is not null and ci.status <> 'arquivado'
    order by ci.published_at desc limit ${Math.min(limit, 50)} offset ${Math.max(0, offset)}`);
}

/**
 * "Igreja e Renovação": acontecimentos com data a partir de hoje (o mais próximo primeiro) e,
 * separadamente, a cobertura (sem data futura), mais recente primeiro.
 */
export async function listIgreja(db: DB, opts: { proximos: boolean; hoje: string; limit?: number; offset?: number }) {
  const lim = Math.min(opts.limit ?? 12, 50), off = Math.max(0, opts.offset ?? 0);
  return opts.proximos
    ? db.execute<ListedContent>(sql`select ${COLS} ${FROM}
        where ci.kind = 'igreja' and ci.published_revision_id is not null and ci.status <> 'arquivado'
          and coalesce(r.event_end_date, r.event_date) >= ${opts.hoje}::date
        order by r.event_date asc, ci.published_at desc limit ${lim} offset ${off}`)
    : db.execute<ListedContent>(sql`select ${COLS} ${FROM}
        where ci.kind = 'igreja' and ci.published_revision_id is not null and ci.status <> 'arquivado'
          and (r.event_date is null or coalesce(r.event_end_date, r.event_date) < ${opts.hoje}::date)
        order by ci.published_at desc limit ${lim} offset ${off}`);
}

// ───────── Páginas fixas (identificador estável) ─────────
/** Seções do site que apontam para UMA página institucional, independentemente de título e endereço. */
export const PAGINAS_FIXAS = { "quem-somos": "A RCC → Quem Somos" } as const;
export type ChaveFixa = keyof typeof PAGINAS_FIXAS;

/** Leitura pública da página fixa: sempre a revisão PUBLICADA (uma edição em revisão não aparece). */
export async function getPublishedByChave(db: DB, chave: ChaveFixa) {
  const rows = await db.execute<PublicContent>(sql`
    select ${COLS}, r.body_html, r.author_name, r.source_reference, r.rights_notice, r.approved_at, r.created_at as updated_at
    ${FROM}
    where ci.chave = ${chave} and ci.published_revision_id is not null and ci.status <> 'arquivado'`);
  return rows[0] ?? null;
}

/** Estado da página fixa para o painel: vinculada (com situação) ou não; e as páginas candidatas. */
export async function paginaFixa(db: DB, chave: ChaveFixa) {
  const [vinc] = await db.execute<{ id: string; slug: string; status: string; title: string; publicada: boolean; is_demo: boolean }>(sql`
    select ci.id, ci.slug, ci.status::text, r.title, ci.published_revision_id is not null as publicada, ci.is_demo
    from content_item ci join content_revision r on r.id = ci.current_revision_id where ci.chave = ${chave}`);
  const candidatas = await db.execute<{ id: string; slug: string; title: string; status: string }>(sql`
    select ci.id, ci.slug, r.title, ci.status::text from content_item ci join content_revision r on r.id = ci.current_revision_id
    where ci.kind = 'pagina' and ci.status <> 'arquivado' and (ci.chave is null or ci.chave = ${chave}) order by r.title`);
  return { vinculada: vinc ?? null, candidatas: [...candidatas] };
}

/** Vincula (ou troca) a página institucional de uma seção fixa. Não altera texto, revisões nem publicação. */
export async function vincularPaginaFixa(db: DB, s: Subject, chave: ChaveFixa, itemId: string) {
  assertCan(s, "conteudo.estrutura");
  if (!(chave in PAGINAS_FIXAS)) throw new WorkflowError("Seção fixa desconhecida.");
  await db.transaction(async (tx) => {
    const item = await lockItem(tx, itemId);
    if (item.kind !== "pagina") throw new WorkflowError("Escolha uma página institucional (tipo Página).");
    if (item.status === "arquivado") throw new WorkflowError("Esta página está arquivada.");
    if (item.chave && item.chave !== chave) throw new WorkflowError("Esta página já está vinculada a outra seção fixa.");
    const [ant] = await tx.select({ id: contentItem.id }).from(contentItem).where(eq(contentItem.chave, chave));
    if (ant && ant.id !== itemId) await tx.update(contentItem).set({ chave: null, updatedAt: new Date() }).where(eq(contentItem.id, ant.id));
    await tx.update(contentItem).set({ chave, updatedAt: new Date() }).where(eq(contentItem.id, itemId));
    await audit(tx, { actorId: s.userId, action: "conteudo.vincular_secao", resourceType: "content", resourceId: itemId, detail: { secao: chave, anterior: ant?.id ?? null } });
  });
}
