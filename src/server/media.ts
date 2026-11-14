/**
 * Biblioteca de mídia. Regras (tests/media.test.ts):
 *  - Só JPEG/PNG/WebP/PDF verificados pelo conteúdo (uploads.ts); imagens reprocessadas em WebP,
 *    sem metadados, com variantes de 640 e 1280 px para telas pequenas.
 *  - Imagem exige texto alternativo OU marcação explícita de “decorativa”; foto de pessoas exige
 *    confirmar a autorização de uso de imagem.
 *  - Arquivo privado nunca é servido pela rota pública: só por link temporário assinado.
 *  - Exclusão bloqueada enquanto o arquivo estiver em uso (capa, foto de grupo, produto, texto).
 *  - Armazenamento em disco (MEDIA_DIR). Trocar por S3 = reimplementar `storage` abaixo.
 */
import { desc, eq, sql } from "drizzle-orm";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { DB } from "@/db";
import { media } from "@/db/schema";
import { assertCan, type Subject } from "./authz";
import { audit } from "./audit";
import { validateUpload, UploadError } from "./uploads";
import { signDownload, verifyDownload } from "./tokens";

export class MediaError extends Error {}
export const VARIANT_WIDTHS = [640, 1280] as const;

const baseDir = () => path.resolve(process.env.MEDIA_DIR || "storage/media");
const safeKey = (k: string) => { if (!/^[0-9a-f-]{36}(-w\d+)?\.(webp|pdf)$/.test(k)) throw new MediaError("Chave inválida."); return k; };

export const storage = {
  async put(key: string, data: Buffer) { await mkdir(baseDir(), { recursive: true }); await writeFile(path.join(baseDir(), safeKey(key)), data, { mode: 0o640 }); },
  async get(key: string) { return readFile(path.join(baseDir(), safeKey(key))); },
  async del(key: string) { await unlink(path.join(baseDir(), safeKey(key))).catch(() => {}); },
};

export const variantKey = (storageKey: string, w: number) => storageKey.replace(/\.webp$/, `-w${w}.webp`);
const slugName = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "arquivo";

/** URL pública estável (o id garante unicidade; o nome é só legibilidade). */
export function publicUrl(m: { id: string; storageKey: string }, w?: number) {
  const ext = m.storageKey.endsWith(".pdf") ? "pdf" : "webp";
  return `/midia/${m.id}${w ? `/w${w}` : ""}/arquivo.${ext}`;
}

export type UploadInput = { file: Buffer; fileName: string; altText?: string | null; decorative?: boolean; credit?: string | null; imageRightsAuthorized?: boolean; isPrivate?: boolean };

export async function uploadMedia(db: DB, s: Subject, input: UploadInput) {
  assertCan(s, "midia.enviar");
  let v;
  try { v = await validateUpload(input.file, input.fileName); }
  catch (e) { if (e instanceof UploadError) throw new MediaError(e.message); throw e; }
  const isImage = v.type.startsWith("image/");
  const alt = input.altText?.trim().slice(0, 300) || null;
  if (isImage && !alt && !input.decorative) throw new MediaError("Descreva a imagem (texto alternativo) ou marque como decorativa.");
  if (isImage && !input.imageRightsAuthorized) throw new MediaError("Confirme que há autorização para usar esta imagem (pessoas retratadas e autor da foto).");
  const id = randomUUID();
  const storageKey = `${id}.${isImage ? "webp" : "pdf"}`;
  await storage.put(storageKey, v.data);
  if (isImage && v.width) {
    for (const w of VARIANT_WIDTHS) {
      if (v.width <= w) continue;
      await storage.put(variantKey(storageKey, w), await sharp(v.data).resize({ width: w }).webp({ quality: 78 }).toBuffer());
    }
  }
  try {
    await db.insert(media).values({
      id, storageKey, mimeType: v.type, bytes: v.data.length, width: v.width, height: v.height,
      altText: isImage ? (input.decorative ? null : alt) : alt, decorative: isImage && !!input.decorative,
      credit: input.credit?.trim().slice(0, 200) || null, imageRightsAuthorized: !!input.imageRightsAuthorized,
      isPrivate: !!input.isPrivate, uploadedBy: s.userId,
    });
  } catch (e) { await removeFiles(storageKey); throw e; }
  await audit(db, { actorId: s.userId, action: "midia.enviar", resourceType: "media", resourceId: id, detail: { tipo: v.type, bytes: v.data.length, privado: !!input.isPrivate, nomeOriginal: slugName(input.fileName) } });
  return { id, storageKey, url: publicUrl({ id, storageKey }), width: v.width, height: v.height };
}

async function removeFiles(storageKey: string) {
  await storage.del(storageKey);
  if (storageKey.endsWith(".webp")) for (const w of VARIANT_WIDTHS) await storage.del(variantKey(storageKey, w));
}

/** Onde o arquivo está sendo usado (impede excluir algo que quebraria uma página). */
export async function usages(db: DB, mediaId: string) {
  const like = `%/midia/${mediaId}%`;
  const rows = await db.execute<{ onde: string; n: number }>(sql`
    select 'capa de conteúdo' as onde, count(*)::int as n from content_revision where cover_media_id = ${mediaId}
    union all select 'texto de conteúdo', count(*)::int from content_revision where body_html like ${like}
    union all select 'foto de grupo', count(*)::int from prayer_group where photo_media_id = ${mediaId}
    union all select 'produto', count(*)::int from product where cover_media_id = ${mediaId}
    union all select 'descrição de evento', count(*)::int from event where description_html like ${like}`);
  return rows.filter((r) => r.n > 0);
}

export async function deleteMedia(db: DB, s: Subject, mediaId: string) {
  assertCan(s, "midia.enviar");
  const [m] = await db.select().from(media).where(eq(media.id, mediaId));
  if (!m) throw new MediaError("Arquivo não encontrado.");
  const u = await usages(db, mediaId);
  if (u.length) throw new MediaError(`Em uso (${u.map((x) => `${x.onde}: ${x.n}`).join(", ")}). Remova das páginas antes de excluir.`);
  await db.delete(media).where(eq(media.id, mediaId));
  await removeFiles(m.storageKey);
  await audit(db, { actorId: s.userId, action: "midia.excluir", resourceType: "media", resourceId: mediaId });
}

export async function updateMediaInfo(db: DB, s: Subject, mediaId: string, info: { altText?: string | null; decorative?: boolean; credit?: string | null }) {
  assertCan(s, "midia.enviar");
  const [m] = await db.select().from(media).where(eq(media.id, mediaId));
  if (!m) throw new MediaError("Arquivo não encontrado.");
  const isImage = m.mimeType.startsWith("image/");
  const alt = info.altText?.trim().slice(0, 300) || null;
  if (isImage && !alt && !info.decorative) throw new MediaError("Descreva a imagem ou marque como decorativa.");
  await db.update(media).set({ altText: info.decorative ? null : alt, decorative: isImage && !!info.decorative, credit: info.credit?.trim().slice(0, 200) || null }).where(eq(media.id, mediaId));
  await audit(db, { actorId: s.userId, action: "midia.editar", resourceType: "media", resourceId: mediaId });
}

export async function listMedia(db: DB, s: Subject, limit = 200) {
  assertCan(s, "midia.enviar");
  return db.select().from(media).orderBy(desc(media.createdAt)).limit(limit);
}

/** Link temporário para arquivo privado (ex.: documento interno da equipe). */
export async function privateLink(db: DB, s: Subject, mediaId: string, signingKey: string, ttlSeconds = 3600) {
  assertCan(s, "midia.enviar");
  const [m] = await db.select().from(media).where(eq(media.id, mediaId));
  if (!m) throw new MediaError("Arquivo não encontrado.");
  const { exp, sig } = signDownload(signingKey, m.storageKey, ttlSeconds);
  await audit(db, { actorId: s.userId, action: "midia.link_privado", resourceType: "media", resourceId: mediaId, detail: { validadeSegundos: ttlSeconds } });
  return `/midia/privado/${m.id}?exp=${exp}&sig=${sig}`;
}

/** Leitura para as rotas: pública só se não for privado; privada só com assinatura válida. */
export async function readForServe(db: DB, mediaId: string, opts: { width?: number; signed?: { exp: number; sig: string; key: string } }) {
  if (!/^[0-9a-f-]{36}$/.test(mediaId)) return null;
  const [m] = await db.select().from(media).where(eq(media.id, mediaId));
  if (!m) return null;
  if (m.isPrivate) {
    if (!opts.signed || !verifyDownload(opts.signed.key, m.storageKey, opts.signed.exp, opts.signed.sig)) return null;
  } else if (opts.signed) return null; // rota privada não serve arquivo público (evita confusão de cache)
  let key = m.storageKey;
  if (opts.width && m.mimeType === "image/webp" && (VARIANT_WIDTHS as readonly number[]).includes(opts.width) && m.width && m.width > opts.width) key = variantKey(m.storageKey, opts.width);
  try { return { m, data: await storage.get(key) }; } catch { return null; }
}
