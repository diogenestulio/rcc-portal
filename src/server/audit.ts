import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { DB, Tx } from "@/db";

export type AuditEntry = {
  actorId?: string | null;
  action: string;           // ex.: "content.publish", "role.grant", "order.refund"
  resourceType: string;
  resourceId?: string | null;
  result?: "ok" | "negado" | "erro";
  correlationId?: string | null;
  /** Nunca incluir senhas, tokens, cookies, PAN/CVV, textos de oração ou formulários completos. */
  detail?: Record<string, unknown> | null;
};

/** JSON canônico (chaves ordenadas) — o jsonb do PostgreSQL reordena chaves, então o hash usa esta forma. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`;
}

const FORBIDDEN_KEYS = /pass(word)?|senha|token|secret|cookie|cvv|pan|card|intention|intencao/i;

export function scrubDetail(detail: Record<string, unknown> | null | undefined) {
  if (!detail) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(detail)) out[k] = FORBIDDEN_KEYS.test(k) ? "[omitido]" : v;
  // Normaliza como o jsonb armazenará (remove undefined, Date → string) para o hash bater na verificação.
  return JSON.parse(JSON.stringify(out)) as Record<string, unknown>;
}

/**
 * Registra auditoria com encadeamento de hash. Um advisory lock serializa a obtenção do hash
 * anterior para que a cadeia não bifurque sob concorrência.
 */
export async function audit(db: DB | Tx, e: AuditEntry) {
  const detail = scrubDetail(e.detail);
  const run = async (tx: DB | Tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7243001)`);
    const prev = await tx.execute<{ hash: string }>(sql`select hash from audit_log order by id desc limit 1`);
    const prevHash = prev[0]?.hash ?? "GENESIS";
    const at = new Date().toISOString();
    const payload = canonical([prevHash, at, e.actorId ?? null, e.action, e.resourceType, e.resourceId ?? null, e.result ?? "ok", detail]);
    const hash = createHash("sha256").update(payload).digest("hex");
    await tx.execute(sql`insert into audit_log (at, actor_id, action, resource_type, resource_id, result, correlation_id, detail, prev_hash, hash)
      values (${at}::timestamptz, ${e.actorId ?? null}, ${e.action}, ${e.resourceType}, ${e.resourceId ?? null}, ${e.result ?? "ok"},
              ${e.correlationId ?? null}, ${detail ? JSON.stringify(detail) : null}::jsonb, ${prevHash}, ${hash})`);
  };
  // Dentro de uma transação existente, participa dela; fora, abre a própria.
  if ("rollback" in db) return run(db);
  return (db as DB).transaction(run);
}

/** Verifica a cadeia inteira; retorna o id do primeiro registro inconsistente, ou null. */
export async function verifyAuditChain(db: DB): Promise<number | null> {
  const rows = await db.execute<{ id: number; at: Date; actor_id: string | null; action: string; resource_type: string; resource_id: string | null; result: string; detail: unknown; prev_hash: string; hash: string }>(
    sql`select id, at, actor_id, action, resource_type, resource_id, result, detail, prev_hash, hash from audit_log order by id`);
  let prev = "GENESIS";
  for (const r of rows) {
    const at = new Date(r.at).toISOString();
    const payload = canonical([prev, at, r.actor_id, r.action, r.resource_type, r.resource_id, r.result, r.detail ?? null]);
    const h = createHash("sha256").update(payload).digest("hex");
    if (r.prev_hash !== prev || r.hash !== h) return r.id;
    prev = r.hash;
  }
  return null;
}
