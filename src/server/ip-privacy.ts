/**
 * Minimização de IP (LGPD): o endereço nunca é gravado em claro.
 *  - `ipFingerprint`: HMAC-SHA256 com a chave do servidor, truncado — serve para comparar
 *    ("é o mesmo endereço?") sem permitir recuperar o IP.
 *  - `hashedRateLimitStorage`: armazenamento do limitador de tentativas da biblioteca de
 *    autenticação que guarda a chave (IP|rota) já transformada em HMAC.
 * Ver docs/15-incidente-2026-11-10.md (achado lateral) e docs/11-lgpd-seguranca.md.
 */
import { sql } from "drizzle-orm";
import type { DB } from "@/db";
import { hmacHex } from "./tokens";

export function ipFingerprint(ip: string | null | undefined, key: string): string | null {
  if (!ip) return null;
  return `h:${hmacHex(key, `ip:${ip}`).slice(0, 24)}`;
}

type Rule = { window: number; max: number };

/** Mesma semântica do armazenamento padrão (janela fixa), com chave em HMAC e operação atômica. */
export function hashedRateLimitStorage(db: DB, key: string) {
  return {
    async consume(rawKey: string, rule: Rule): Promise<{ allowed: boolean; retryAfter: number | null }> {
      const k = `ba:${hmacHex(key, `rl:${rawKey}`).slice(0, 32)}`;
      const now = Date.now();
      const windowMs = rule.window * 1000;
      const [row] = await db.execute<{ count: number; last_request: string }>(sql`
        insert into rate_limit (id, key, count, last_request) values (${k}, ${k}, 1, ${now})
        on conflict (key) do update set
          count = case when rate_limit.last_request <= ${now - windowMs} then 1 else rate_limit.count + 1 end,
          last_request = case when rate_limit.last_request <= ${now - windowMs} then ${now} else rate_limit.last_request end
        returning count, last_request`);
      if (row.count <= rule.max) return { allowed: true, retryAfter: null };
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((Number(row.last_request) + windowMs - now) / 1000)) };
    },
  };
}
