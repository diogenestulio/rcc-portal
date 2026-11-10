// Casos de aceite 11 (privacidade), 13 (uploads) e jobs duráveis.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { makeDb, makeUser, reset, subject, g } from "./helpers";
import { listPrayers, purgeExpiredPrayers, submitPrayer } from "@/server/prayer";
import { validateUpload, UploadError } from "@/server/uploads";
import { enqueue, runJobsOnce, backoffMs } from "@/server/jobs";
import { scrubDetail } from "@/server/audit";
import { signDownload, verifyDownload } from "@/server/tokens";
import { ForbiddenError } from "@/server/authz";
import { searchPublic } from "@/server/search";
import { auditLog, job } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

const { db, client } = makeDb();
afterAll(() => client.end());
beforeEach(() => reset(db));

describe("pedidos de oração", () => {
  it("intenção não aparece na busca, na auditoria nem na fila de notificação", async () => {
    const segredo = "intencao-sigilosa-xyz";
    await submitPrayer(db, { firstName: "Ana", intention: `Pela saúde da família ${segredo}` });
    expect(await searchPublic(db, segredo)).toEqual([]);
    const jobs = await db.select().from(job);
    expect(JSON.stringify(jobs)).not.toContain(segredo);
    const intercessor = subject(await makeUser(db), [g("intercessor")]);
    expect((await listPrayers(db, intercessor))[0].intention).toContain(segredo);
    expect(JSON.stringify(await db.select().from(auditLog))).not.toContain(segredo);
  });

  it("técnico não lê; expurgo remove após o prazo", async () => {
    await submitPrayer(db, { intention: "Intenção qualquer" });
    await expect(listPrayers(db, subject(await makeUser(db), [g("admin_tecnico")]))).rejects.toBeInstanceOf(ForbiddenError);
    expect(await purgeExpiredPrayers(db, new Date())).toBe(0);
    expect(await purgeExpiredPrayers(db, new Date(Date.now() + 61 * 86_400_000))).toBe(1);
  });

  it("auditoria remove campos sensíveis do detalhe", () => {
    expect(scrubDetail({ password: "x", token: "y", intencao: "z", campo: 1 })).toEqual({ password: "[omitido]", token: "[omitido]", intencao: "[omitido]", campo: 1 });
  });
});

describe("uploads", () => {
  it("recusa SVG, HTML disfarçado, extensão falsa e PDF com JavaScript", async () => {
    await expect(validateUpload(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"), "a.png")).rejects.toBeInstanceOf(UploadError);
    await expect(validateUpload(Buffer.from("<!DOCTYPE html><html></html>"), "foto.jpg")).rejects.toBeInstanceOf(UploadError);
    await expect(validateUpload(Buffer.from("MZ\x90\x00executavel"), "foto.jpg")).rejects.toThrow(/não permitido/);
    await expect(validateUpload(Buffer.from("%PDF-1.7\n/OpenAction << /S /JavaScript /JS (app.alert(1)) >>"), "doc.pdf")).rejects.toThrow(/conteúdo ativo/);
    await expect(validateUpload(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]), "x.jpg")).rejects.toThrow(/inválida/);
  });

  it("reprocessa imagem e remove metadados EXIF", async () => {
    const jpg = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#c33" } })
      .withMetadata({ exif: { IFD0: { Copyright: "SEGREDO-GPS" } } }).jpeg().toBuffer();
    expect(jpg.toString("latin1")).toContain("SEGREDO-GPS");
    const out = await validateUpload(jpg, "foto.jpg");
    expect(out.type).toBe("image/webp");
    expect(out.data.toString("latin1")).not.toContain("SEGREDO-GPS");
    expect((await sharp(out.data).metadata()).exif).toBeUndefined();
  });

  it("URL temporária de arquivo privado expira e não aceita outra chave de objeto", () => {
    const k = "k".repeat(32);
    const { exp, sig } = signDownload(k, "privado/a.pdf", 60);
    expect(verifyDownload(k, "privado/a.pdf", exp, sig)).toBe(true);
    expect(verifyDownload(k, "privado/b.pdf", exp, sig)).toBe(false);
    expect(verifyDownload(k, "privado/a.pdf", exp, sig, Date.now() + 120_000)).toBe(false);
  });
});

describe("fila durável", () => {
  it("deduplica, executa, reprograma com backoff e marca como morto no limite", async () => {
    expect(await enqueue(db, "t.ok", {}, { dedupeKey: "d" })).not.toBeNull();
    expect(await enqueue(db, "t.ok", {}, { dedupeKey: "d" })).toBeNull();
    await enqueue(db, "t.falha", {}, { maxAttempts: 2 });
    let ran = 0;
    const handlers = { "t.ok": async () => { ran++; }, "t.falha": async () => { throw new Error("boom"); } };
    await runJobsOnce(db, handlers);
    expect(ran).toBe(1);
    const [f] = await db.select().from(job).where(eq(job.type, "t.falha"));
    expect(f).toMatchObject({ status: "pendente", attempts: 1, lastError: "boom" });
    await db.execute(sql`update job set run_at = now() where id = ${f.id}`);
    await runJobsOnce(db, handlers);
    expect((await db.select().from(job).where(eq(job.id, f.id)))[0].status).toBe("morto");
    expect(backoffMs(1, 0)).toBe(30_000);
    expect(backoffMs(20, 0)).toBe(3_600_000);
  });

  it("dois workers não executam o mesmo job", async () => {
    for (let i = 0; i < 10; i++) await enqueue(db, "t.c", { i });
    const seen: number[] = [];
    const h = { "t.c": async (p: Record<string, unknown>) => { seen.push(p.i as number); await new Promise((r) => setTimeout(r, 20)); } };
    await Promise.all([runJobsOnce(db, h, "w1"), runJobsOnce(db, h, "w2"), runJobsOnce(db, h, "w3")]);
    expect(new Set(seen).size).toBe(seen.length);
  });
});
