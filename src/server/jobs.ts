import { sql } from "drizzle-orm";
import type { DB, Tx } from "@/db";
import { job } from "@/db/schema";

export type JobHandler = (payload: Record<string, unknown>, ctx: { db: DB; jobId: string; attempt: number }) => Promise<void>;

/** Enfileira um job na MESMA transação da mudança de dados (padrão outbox). */
export async function enqueue(db: DB | Tx, type: string, payload: Record<string, unknown> = {}, opts: { dedupeKey?: string; runAt?: Date; maxAttempts?: number } = {}) {
  const rows = await db.insert(job).values({
    type, payload, dedupeKey: opts.dedupeKey ?? null, runAt: opts.runAt ?? new Date(), maxAttempts: opts.maxAttempts ?? 8,
  }).onConflictDoNothing().returning({ id: job.id });
  return rows[0]?.id ?? null; // null = já havia um job ativo com a mesma dedupeKey
}

/** Backoff exponencial com teto de 1 h e jitter de até 20%. */
export function backoffMs(attempt: number, rand = Math.random()) {
  const base = Math.min(60 * 60 * 1000, 30_000 * 2 ** Math.max(0, attempt - 1));
  return Math.round(base * (1 + 0.2 * rand));
}

/** Reivindica até `limit` jobs prontos (SKIP LOCKED permite vários workers). Recupera jobs travados > 10 min. */
export async function claimJobs(db: DB, workerId: string, limit = 5) {
  return db.execute<{ id: string; type: string; payload: Record<string, unknown>; attempts: number; max_attempts: number }>(sql`
    update job set status = 'executando', locked_at = now(), locked_by = ${workerId}, attempts = attempts + 1
    where id in (
      select id from job
      where (status = 'pendente' and run_at <= now())
         or (status = 'executando' and locked_at < now() - interval '10 minutes')
      order by run_at
      limit ${limit}
      for update skip locked)
    returning id, type, payload, attempts, max_attempts`);
}

export async function runJobsOnce(db: DB, handlers: Record<string, JobHandler>, workerId = "worker") {
  const claimed = await claimJobs(db, workerId);
  for (const j of claimed) {
    const handler = handlers[j.type];
    try {
      if (!handler) throw new Error(`sem handler para ${j.type}`);
      await handler(j.payload, { db, jobId: j.id, attempt: j.attempts });
      await db.execute(sql`update job set status = 'concluido', finished_at = now(), last_error = null where id = ${j.id}`);
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      const dead = j.attempts >= j.max_attempts;
      const next = new Date(Date.now() + backoffMs(j.attempts));
      await db.execute(sql`update job set status = ${dead ? "morto" : "pendente"}::job_status, last_error = ${msg},
        run_at = ${next.toISOString()}::timestamptz, locked_at = null, locked_by = null where id = ${j.id}`);
    }
  }
  return claimed.length;
}
