// Bloco "Igreja e Renovação": campos de acontecimento, listagens (próximos x cobertura), vídeo e PDF no texto.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeDb, makeUser, reset, subject, g } from "./helpers";
import { approveRevision, createDraft, getPublished, listIgreja, publish, sanitizeRichText, submitForReview, WorkflowError } from "@/server/content";
import { htmlToText, textToHtml } from "@/server/richtext";
import { sql } from "drizzle-orm";

const { db, client } = makeDb();
afterAll(() => client.end());
beforeEach(() => reset(db));

async function publicar(over: Record<string, unknown>) {
  const editor = subject(await makeUser(db, "Editor"), [g("editor")]);
  const gestor = subject(await makeUser(db, "Gestor"), [g("gestor_institucional")]);
  const { itemId } = await createDraft(db, editor, { kind: "igreja", slug: `item-${Math.random().toString(36).slice(2, 8)}`, title: "Acontecimento", bodyHtml: "<p>Texto</p>", nature: "noticia", ...over });
  await submitForReview(db, editor, itemId);
  const [{ rev }] = await db.execute<{ rev: string }>(sql`select current_revision_id as rev from content_item where id = ${itemId}`);
  await approveRevision(db, gestor, itemId, rev);
  await publish(db, editor, itemId);
  return itemId;
}

describe("Igreja e Renovação", () => {
  it("separa próximos acontecimentos (mais próximo primeiro) da cobertura; evento em andamento continua nos próximos", async () => {
    await publicar({ title: "JMJ", eventDate: "2027-08-03", eventEndDate: "2027-08-08", eventPlace: "Seul", externalUrl: "https://www.vaticannews.va/pt.html" });
    await publicar({ title: "Pentecostes", eventDate: "2027-05-16" });
    await publicar({ title: "Já passou", eventDate: "2026-01-10" });
    await publicar({ title: "Reflexão sem data" });
    const prox = await listIgreja(db, { proximos: true, hoje: "2027-08-05" });
    expect(prox.map((p) => p.title)).toEqual(["JMJ"]); // termina dia 8: ainda está acontecendo
    const prox2 = await listIgreja(db, { proximos: true, hoje: "2027-01-01" });
    expect(prox2.map((p) => p.title)).toEqual(["Pentecostes", "JMJ"]);
    expect(prox2[1]).toMatchObject({ event_date: "2027-08-03", event_end_date: "2027-08-08", event_place: "Seul", external_url: "https://www.vaticannews.va/pt.html" });
    const cob = await listIgreja(db, { proximos: false, hoje: "2027-01-01" });
    expect(cob.map((p) => p.title).sort()).toEqual(["Já passou", "Reflexão sem data"]);
  });

  it("valida datas e link oficial com mensagens para o usuário", async () => {
    const editor = subject(await makeUser(db), [g("editor")]);
    const base = { kind: "igreja" as const, slug: "x", title: "Teste", bodyHtml: "<p>a</p>", nature: "noticia" as const };
    await expect(createDraft(db, editor, { ...base, externalUrl: "http://inseguro.org" })).rejects.toThrow(/https/);
    await expect(createDraft(db, editor, { ...base, externalUrl: "javascript:alert(1)" })).rejects.toBeInstanceOf(WorkflowError);
    await expect(createDraft(db, editor, { ...base, eventDate: "2027-05-16", eventEndDate: "2027-05-10" })).rejects.toThrow(/anterior/);
    await expect(createDraft(db, editor, { ...base, eventEndDate: "2027-05-10" })).rejects.toThrow(/início/);
    await expect(createDraft(db, editor, { ...base, eventDate: "16/05/2027" })).rejects.toThrow(/Data inválida/);
  });

  it("capa privada nunca aparece na leitura pública", async () => {
    const id = await publicar({ title: "Com capa" });
    await db.execute(sql`insert into media (id, storage_key, mime_type, bytes, is_private, decorative) values ('00000000-0000-0000-0000-0000000000aa', 'priv.webp', 'image/webp', 10, true, true)`);
    await db.execute(sql`update content_revision set cover_media_id = '00000000-0000-0000-0000-0000000000aa' where item_id = ${id}`);
    const [{ slug }] = await db.execute<{ slug: string }>(sql`select slug from content_item where id = ${id}`);
    expect((await getPublished(db, "igreja", slug))?.cover_id).toBeNull();
  });
});

describe("texto rico: vídeo e PDF", () => {
  it("linha de vídeo do YouTube vira marcador seguro; ida e volta preserva o texto", () => {
    const html = sanitizeRichText(textToHtml("Intro\n\n[video: Hino \"oficial\" <b>x</b>](https://www.youtube.com/watch?v=OvCqsKWvyR0)\n\n[pdf: Roteiro](/midia/9a996a2e-607d-4da8-b258-81e1d0a37a41/arquivo.pdf)"));
    expect(html).toContain('<p data-video="OvCqsKWvyR0" data-titulo="Hino &quot;oficial&quot; &lt;b&gt;x&lt;/b&gt;">');
    expect(html).toContain('<p class="anexo"><a href="/midia/9a996a2e-607d-4da8-b258-81e1d0a37a41/arquivo.pdf" rel="noopener noreferrer">Roteiro</a></p>');
    expect(html).not.toContain("<b>");
    const volta = htmlToText(html);
    expect(volta).toContain("[video: Hino \"oficial\" <b>x</b>](https://www.youtube.com/watch?v=OvCqsKWvyR0)");
    expect(volta).toContain("[pdf: Roteiro](/midia/9a996a2e-607d-4da8-b258-81e1d0a37a41/arquivo.pdf)");
  });

  it("não aceita vídeo de outro site, PDF externo nem atributos inventados", () => {
    expect(textToHtml("[video: x](https://evil.example/watch?v=abcdefg)")).not.toContain("data-video");
    expect(textToHtml("[pdf: x](https://evil.example/a.pdf)")).not.toContain("anexo");
    const sujo = sanitizeRichText('<p class="perigo" data-video="x" onclick="alert(1)" style="color:red">oi</p><p class="anexo">ok</p>');
    expect(sujo).not.toMatch(/perigo|onclick|style/);
    expect(sujo).toContain('<p class="anexo">ok</p>');
  });
});
