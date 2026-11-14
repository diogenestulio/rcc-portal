// Biblioteca de mídia: validação, texto alternativo, autorização de imagem, variantes, privado/público,
// exclusão bloqueada em uso e imagem no texto (caso de aceite 13).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { makeDb, makeUser, reset, subject, g } from "./helpers";
import { deleteMedia, MediaError, privateLink, readForServe, uploadMedia, usages } from "@/server/media";
import { createDraft } from "@/server/content";
import { textToHtml, htmlToText } from "@/server/richtext";
import { sanitizeRichText } from "@/server/content";
import { ForbiddenError } from "@/server/authz";

const { db, client } = makeDb();
const KEY = "k".repeat(40);
let dir = "";
beforeAll(() => { dir = mkdtempSync(path.join(tmpdir(), "rcc-media-")); process.env.MEDIA_DIR = dir; });
afterAll(async () => { await client.end(); rmSync(dir, { recursive: true, force: true }); });
beforeEach(() => reset(db));

const photo = (w = 1800, h = 1200) => sharp({ create: { width: w, height: h, channels: 3, background: "#7a2335" } }).jpeg().toBuffer();
const pdf = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF");

describe("biblioteca de mídia", () => {
  it("exige descrição ou 'decorativa' e autorização de imagem; gera variantes menores", async () => {
    const s = subject(await makeUser(db), [g("editor")]);
    await expect(uploadMedia(db, s, { file: await photo(), fileName: "a.jpg", imageRightsAuthorized: true })).rejects.toThrow(/texto alternativo/);
    await expect(uploadMedia(db, s, { file: await photo(), fileName: "a.jpg", altText: "Grupo rezando" })).rejects.toThrow(/autorização/);
    const r = await uploadMedia(db, s, { file: await photo(), fileName: "Foto Grupo.JPG", altText: "Grupo rezando", imageRightsAuthorized: true });
    expect(r).toMatchObject({ width: 1800, height: 1200 });
    expect(r.url).toBe(`/midia/${r.id}/arquivo.webp`);
    const v640 = await readForServe(db, r.id, { width: 640 });
    expect((await sharp(v640!.data).metadata()).width).toBe(640);
    const v1280 = await readForServe(db, r.id, { width: 1280 });
    expect((await sharp(v1280!.data).metadata()).width).toBe(1280);
    // imagem pequena: pedir variante maior que ela devolve o original
    const small = await uploadMedia(db, s, { file: await photo(500, 300), fileName: "p.png", decorative: true, imageRightsAuthorized: true });
    expect((await sharp((await readForServe(db, small.id, { width: 1280 }))!.data).metadata()).width).toBe(500);
  });

  it("recusa SVG e tipo falso; sem papel não envia", async () => {
    const s = subject(await makeUser(db), [g("editor")]);
    await expect(uploadMedia(db, s, { file: Buffer.from("<svg onload='x()'/>"), fileName: "x.svg" })).rejects.toBeInstanceOf(MediaError);
    await expect(uploadMedia(db, s, { file: Buffer.from("MZ executável"), fileName: "foto.jpg" })).rejects.toBeInstanceOf(MediaError);
    const intercessor = subject(await makeUser(db), [g("intercessor")]);
    await expect(uploadMedia(db, intercessor, { file: pdf, fileName: "d.pdf" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("privado não sai pela rota pública; link assinado funciona e expira", async () => {
    const s = subject(await makeUser(db), [g("editor")]);
    const r = await uploadMedia(db, s, { file: pdf, fileName: "ata.pdf", isPrivate: true });
    expect(await readForServe(db, r.id, {})).toBeNull();
    const link = await privateLink(db, s, r.id, KEY, 60);
    const u = new URL(link, "http://x");
    const exp = Number(u.searchParams.get("exp")), sig = u.searchParams.get("sig")!;
    expect((await readForServe(db, r.id, { signed: { exp, sig, key: KEY } }))?.m.id).toBe(r.id);
    expect(await readForServe(db, r.id, { signed: { exp: exp - 120, sig, key: KEY } })).toBeNull();
    expect(await readForServe(db, r.id, { signed: { exp, sig: "0".repeat(64), key: KEY } })).toBeNull();
    // e o público não abre pela rota privada
    const pub = await uploadMedia(db, s, { file: pdf, fileName: "folheto.pdf" });
    expect(await readForServe(db, pub.id, {})).not.toBeNull();
    expect(await readForServe(db, pub.id, { signed: { exp, sig, key: KEY } })).toBeNull();
  });

  it("não exclui arquivo usado num texto; exclui quando livre", async () => {
    const s = subject(await makeUser(db), [g("editor")]);
    const r = await uploadMedia(db, s, { file: await photo(), fileName: "a.jpg", altText: "Altar", imageRightsAuthorized: true });
    await createDraft(db, s, { kind: "noticia", slug: "com-foto", title: "Com foto", nature: "noticia", bodyHtml: textToHtml(`Texto\n\n![Altar](${r.url})`) });
    expect(await usages(db, r.id)).toEqual([{ onde: "texto de conteúdo", n: 1 }]);
    await expect(deleteMedia(db, s, r.id)).rejects.toThrow(/Em uso/);
    const livre = await uploadMedia(db, s, { file: pdf, fileName: "x.pdf" });
    await deleteMedia(db, s, livre.id);
    expect(await readForServe(db, livre.id, {})).toBeNull();
  });

  it("imagem no editor vira <figure> com variantes e volta ao texto; URL externa ou script não", () => {
    const id = "0b6f3c1e-1111-4222-8333-444455556666";
    const html = sanitizeRichText(textToHtml(`![Grupo "rezando"](/midia/${id}/arquivo.webp)\n— Foto: Pascom (demo)\n\n![x](https://e.com/a.png)\n\n![y](javascript:alert(1))`));
    expect(html).toContain(`src="/midia/${id}/arquivo.webp"`);
    expect(html).toContain(`/midia/${id}/w640/arquivo.webp 640w`);
    expect(html).toContain("<figcaption>— Foto: Pascom (demo)</figcaption>".replace("— ", ""));
    expect(html).not.toMatch(/<img[^>]+(e\.com|javascript)/);
    expect(htmlToText(html)).toContain(`![Grupo &quot;rezando&quot;](/midia/${id}/arquivo.webp)\n— Foto: Pascom (demo)`.replace(/&quot;/g, '"'));
  });
});
