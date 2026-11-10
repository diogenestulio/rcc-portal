/** Só desenvolvimento: gera o código TOTP atual a partir da chave base32 (para testes manuais). */
import { createHmac } from "node:crypto";
const secret = process.argv[2] ?? "";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
let bits = ""; for (const c of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
const h = createHmac("sha1", key).update(ctr).digest();
const o = h[h.length - 1] & 15;
console.log(String(((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, "0"));
