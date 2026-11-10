import "server-only";
import { headers } from "next/headers";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { env } from "@/lib/env";
import { hmacHex } from "./tokens";

export class RateLimitError extends Error { constructor() { super("Muitas tentativas. Aguarde alguns minutos e tente novamente."); } }

/**
 * Limite por janela fixa, persistido no PostgreSQL. O IP NUNCA é guardado em claro:
 * usamos HMAC(IP) truncado (minimização). É uma camada de proteção, não garantia contra DoS.
 */
export async function checkRate(bucket: string, max: number, windowSeconds: number) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
  const key = `app:${bucket}:${hmacHex(env.APP_SIGNING_KEY, ip).slice(0, 24)}`;
  const now = Date.now();
  const rows = await db.execute<{ count: number }>(sql`
    insert into rate_limit (id, key, count, last_request) values (${key}, ${key}, 1, ${now})
    on conflict (key) do update set
      count = case when rate_limit.last_request < ${now - windowSeconds * 1000} then 1 else rate_limit.count + 1 end,
      last_request = case when rate_limit.last_request < ${now - windowSeconds * 1000} then ${now} else rate_limit.last_request end
    returning count`);
  if (rows[0].count > max) throw new RateLimitError();
}
