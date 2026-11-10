/**
 * Validação de uploads: tipo REAL por assinatura (magic bytes), limites, SVG/HTML proibidos,
 * imagens reprocessadas (descarta EXIF/GPS e qualquer conteúdo embutido).
 */
import sharp from "sharp";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export class UploadError extends Error {}

export type Detected = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

export function sniff(buf: Uint8Array): Detected | null {
  const s = (o: number, sig: number[]) => sig.every((b, i) => buf[o + i] === b);
  if (s(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (s(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (s(0, [0x52, 0x49, 0x46, 0x46]) && s(8, [0x57, 0x45, 0x42, 0x50])) return "image/webp";
  if (s(0, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}

export async function validateUpload(buf: Buffer, declaredName: string) {
  if (buf.length === 0) throw new UploadError("Arquivo vazio.");
  const head = buf.subarray(0, 1024).toString("utf8").toLowerCase();
  if (/\.svgz?$/i.test(declaredName) || head.includes("<svg") || head.includes("<!doctype html") || head.includes("<html") || head.includes("<script")) {
    throw new UploadError("SVG/HTML não são aceitos.");
  }
  const type = sniff(buf);
  if (!type) throw new UploadError("Tipo de arquivo não permitido. Envie JPEG, PNG, WebP ou PDF.");
  if (type === "application/pdf") {
    if (buf.length > MAX_PDF_BYTES) throw new UploadError("PDF acima de 20 MB.");
    if (/\/JavaScript|\/JS[\s(]|\/Launch|\/EmbeddedFile/.test(buf.toString("latin1"))) throw new UploadError("PDF com conteúdo ativo não é aceito.");
    return { type, data: buf, width: null as number | null, height: null as number | null };
  }
  if (buf.length > MAX_IMAGE_BYTES) throw new UploadError("Imagem acima de 8 MB.");
  try {
    const img = sharp(buf, { limitInputPixels: 40_000_000, failOn: "error" }).rotate();
    const out = await img.resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    return { type: "image/webp" as const, data: out.data, width: out.info.width as number | null, height: out.info.height as number | null };
  } catch {
    throw new UploadError("Imagem corrompida ou inválida.");
  }
}
