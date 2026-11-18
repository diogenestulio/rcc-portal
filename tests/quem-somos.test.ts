// "A RCC" abre "Quem Somos": vínculo estável por chave, versão publicada preservada durante a revisão, permissões e menu.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { makeDb, makeUser, reset, subject, g } from "./helpers";
import { approveRevision, createDraft, editContent, getPublishedByChave, paginaFixa, publish, submitForReview, vincularPaginaFixa, WorkflowError } from "@/server/content";
import { ForbiddenError } from "@/server/authz";
import { NAV } from "@/components/site/SiteChrome";

const { db, client } = makeDb();
afterAll(() => client.end());
beforeEach(() => reset(db));

async function atores() {
  return {
    editor: subject(await makeUser(db, "Editor"), [g("editor")]),
    revisor: subject(await makeUser(db, "Revisor"), [g("revisor")]),
    gestor: subject(await makeUser(db, "Gestor"), [g("gestor_institucional")]),
  };
}
const rev = async (itemId: string) => (await db.execute<{ r: string }>(sql`select current_revision_id as r from content_item where id = ${itemId}`))[0].r;

describe("A RCC → Quem Somos", () => {
  it("editor altera, revisor aprova e a página pública reflete; durante a revisão, a versão publicada continua no ar", async () => {
    const { editor, revisor, gestor } = await atores();
    const { itemId } = await createDraft(db, editor, { kind: "pagina", slug: "quem-somos", title: "Quem Somos", bodyHtml: "<p>Versão 1</p>", nature: "institucional" });
    await vincularPaginaFixa(db, gestor, "quem-somos", itemId);
    expect(await getPublishedByChave(db, "quem-somos")).toBeNull(); // ainda não publicada → site mostra "em preparação"
    await submitForReview(db, editor, itemId);
    await approveRevision(db, revisor, itemId, await rev(itemId));
    await publish(db, editor, itemId);
    expect((await getPublishedByChave(db, "quem-somos"))?.body_html).toContain("Versão 1");

    // Nova edição, com troca de título e de endereço não muda o vínculo, e a versão 1 segue pública até a aprovação.
    await editContent(db, editor, itemId, { title: "Quem somos nós", bodyHtml: "<p>Versão 2</p>", nature: "institucional" });
    await db.execute(sql`update content_item set slug = 'sobre-a-rcc' where id = ${itemId}`);
    await submitForReview(db, editor, itemId);
    expect((await getPublishedByChave(db, "quem-somos"))?.body_html).toContain("Versão 1");
    await approveRevision(db, revisor, itemId, await rev(itemId));
    await publish(db, editor, itemId);
    const pub = await getPublishedByChave(db, "quem-somos");
    expect(pub).toMatchObject({ title: "Quem somos nós", slug: "sobre-a-rcc" });
    expect(pub?.body_html).toContain("Versão 2");
  });

  it("com páginas ambíguas, o gestor escolhe; trocar não apaga nada; editor não pode vincular", async () => {
    const { editor, gestor } = await atores();
    const a = (await createDraft(db, editor, { kind: "pagina", slug: "quem-somos", title: "Quem somos (antiga)", bodyHtml: "<p>a</p>", nature: "institucional" })).itemId;
    const b = (await createDraft(db, editor, { kind: "pagina", slug: "quem-somos-2026", title: "Quem somos (nova)", bodyHtml: "<p>b</p>", nature: "institucional" })).itemId;
    const noticia = (await createDraft(db, editor, { kind: "noticia", slug: "n", title: "Notícia", bodyHtml: "<p>n</p>", nature: "noticia" })).itemId;
    expect((await paginaFixa(db, "quem-somos")).candidatas.map((c) => c.id).sort()).toEqual([a, b].sort());
    await expect(vincularPaginaFixa(db, editor, "quem-somos", a)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(vincularPaginaFixa(db, gestor, "quem-somos", noticia)).rejects.toBeInstanceOf(WorkflowError);
    await vincularPaginaFixa(db, gestor, "quem-somos", a);
    await vincularPaginaFixa(db, gestor, "quem-somos", b);
    const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from content_item where chave = 'quem-somos'`);
    expect(n).toBe(1);
    expect((await paginaFixa(db, "quem-somos")).vinculada?.id).toBe(b);
    const [{ t }] = await db.execute<{ t: number }>(sql`select count(*)::int as t from content_item where kind = 'pagina'`);
    expect(t).toBe(2); // nada foi apagado
  });
});

it("menu: mesma lista no computador e no celular, na ordem e grafia definidas", () => {
  expect(NAV.map((n) => n.label)).toEqual(["A RCC", "Sede", "Grupos de Oração", "Formação", "Notícias", "Agenda", "Multimídia"]);
  expect(NAV.find((n) => n.label === "Sede")?.href).toBe("/igreja-e-renovacao"); // rota preservada
  expect(NAV.some((n) => n.href === "/loja")).toBe(false); // loja fora do menu (fechada ao público)
});
