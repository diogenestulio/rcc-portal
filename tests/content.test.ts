// Caso de aceite 2: editor não publica versão doutrinal sem revisão; revisão expira após edição.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeDb, makeUser, reset, subject, g } from "./helpers";
import { approveRevision, createDraft, editContent, getPublished, publish, publishDue, sanitizeRichText, submitForReview } from "@/server/content";
import { ForbiddenError } from "@/server/authz";
import { verifyAuditChain } from "@/server/audit";
import { sql } from "drizzle-orm";

const { db, client } = makeDb();
afterAll(() => client.end());
beforeEach(() => reset(db));

async function actors() {
  const editor = subject(await makeUser(db, "Editor"), [g("editor")]);
  const revisor = subject(await makeUser(db, "Revisor"), [g("revisor")]);
  const gestor = subject(await makeUser(db, "Gestor"), [g("gestor_institucional")]);
  return { editor, revisor, gestor };
}
const doc = { kind: "formacao" as const, slug: "dons-do-espirito", title: "Os dons do Espírito Santo", bodyHtml: "<p>Texto v1</p>", nature: "doutrina" as const, sourceReference: "CIC 1830-1831" };

describe("fluxo editorial", () => {
  it("editor não publica conteúdo doutrinal sem aprovação do revisor", async () => {
    const { editor } = await actors();
    const { itemId } = await createDraft(db, editor, doc);
    await expect(publish(db, editor, itemId)).rejects.toThrow(/aprovada/);
    await submitForReview(db, editor, itemId);
    await expect(publish(db, editor, itemId)).rejects.toThrow(/aprovada/);
    // Editor também não pode aprovar
    const { revisionId } = (await db.execute<{ revisionId: string }>(sql`select current_revision_id as "revisionId" from content_item where id = ${itemId}`))[0];
    await expect(approveRevision(db, editor, itemId, revisionId)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await getPublished(db, "formacao", "dons-do-espirito")).toBeNull();
  });

  it("gestor (aprovação geral) não aprova doutrina; revisor aprova; autor não aprova a própria revisão", async () => {
    const { editor, revisor, gestor } = await actors();
    const { itemId, revisionId } = await createDraft(db, editor, doc);
    await submitForReview(db, editor, itemId);
    await expect(approveRevision(db, gestor, itemId, revisionId)).rejects.toBeInstanceOf(ForbiddenError);
    const revAutor = subject(await makeUser(db), [g("revisor"), g("editor")]);
    const own = await createDraft(db, revAutor, { ...doc, slug: "outro" });
    await submitForReview(db, revAutor, own.itemId);
    await expect(approveRevision(db, revAutor, own.itemId, own.revisionId)).rejects.toThrow(/não pode aprová-la/);
    await approveRevision(db, revisor, itemId, revisionId);
    await publish(db, editor, itemId);
    expect((await getPublished(db, "formacao", "dons-do-espirito"))?.body_html).toBe("<p>Texto v1</p>");
  });

  it("edição após aprovação invalida a aprovação e mantém a versão pública anterior", async () => {
    const { editor, revisor } = await actors();
    const { itemId, revisionId } = await createDraft(db, editor, doc);
    await submitForReview(db, editor, itemId);
    await approveRevision(db, revisor, itemId, revisionId);
    await publish(db, editor, itemId);

    await editContent(db, editor, itemId, { ...doc, bodyHtml: "<p>Texto v2</p>" });
    await expect(publish(db, editor, itemId)).rejects.toThrow(/aprovada/);
    // Público continua vendo a v1
    expect((await getPublished(db, "formacao", "dons-do-espirito"))?.body_html).toBe("<p>Texto v1</p>");
  });

  it("revisor não aprova revisão diferente da enviada (edição durante a revisão)", async () => {
    const { editor, revisor } = await actors();
    const { itemId, revisionId } = await createDraft(db, editor, doc);
    await submitForReview(db, editor, itemId);
    await editContent(db, editor, itemId, { ...doc, bodyHtml: "<p>mudou</p>" });
    await expect(approveRevision(db, revisor, itemId, revisionId)).rejects.toThrow();
  });

  it("agendamento só publica revisão aprovada quando chega a hora", async () => {
    const { editor, revisor } = await actors();
    const { itemId, revisionId } = await createDraft(db, editor, { ...doc, nature: "noticia", kind: "noticia", slug: "agendada" });
    await submitForReview(db, editor, itemId);
    await approveRevision(db, revisor, itemId, revisionId);
    const at = new Date(Date.now() + 3_600_000);
    await publish(db, editor, itemId, at);
    expect(await publishDue(db, new Date())).toBe(0);
    expect(await getPublished(db, "noticia", "agendada")).toBeNull();
    expect(await publishDue(db, new Date(at.getTime() + 1000))).toBe(1);
    expect(await getPublished(db, "noticia", "agendada")).not.toBeNull();
  });

  it("sanitiza HTML rico (scripts, eventos, javascript:)", () => {
    const out = sanitizeRichText(`<p onclick="x()">Oi<script>alert(1)</script><a href="javascript:alert(1)">l</a><img src="http://x/a.png" onerror="y()"><iframe src="https://e"></iframe></p>`);
    expect(out).not.toMatch(/script|onclick|onerror|javascript:|iframe|http:\/\//);
  });

  it("auditoria é append-only e a cadeia de hash é verificável", async () => {
    const { editor } = await actors();
    await createDraft(db, editor, { ...doc, slug: "a1" });
    await createDraft(db, editor, { ...doc, slug: "a2" });
    expect(await verifyAuditChain(db)).toBeNull();
    const blocked = { cause: expect.objectContaining({ message: expect.stringMatching(/somente inclusão/) }) };
    await expect(db.execute(sql`update audit_log set action = 'x'`)).rejects.toMatchObject(blocked);
    await expect(db.execute(sql`delete from audit_log`)).rejects.toMatchObject(blocked);
    await expect(db.execute(sql`truncate audit_log`)).rejects.toMatchObject(blocked);
  });
});
