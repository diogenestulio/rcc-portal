import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";

/** Token opaco, não enumerável (128+ bits), seguro para URL. */
export function opaqueToken(bytes = 18): string {
  return randomBytes(bytes).toString("base64url");
}

export function hmacHex(key: string, data: string): string {
  return createHmac("sha256", key).update(data).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** URL temporária assinada para arquivos privados: `exp` em segundos epoch. */
export function signDownload(key: string, objectKey: string, ttlSeconds: number, now = Date.now()) {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  return { exp, sig: hmacHex(key, `${objectKey}.${exp}`) };
}
export function verifyDownload(key: string, objectKey: string, exp: number, sig: string, now = Date.now()) {
  if (!Number.isFinite(exp) || exp < Math.floor(now / 1000)) return false;
  return safeEqual(hmacHex(key, `${objectKey}.${exp}`), sig);
}
