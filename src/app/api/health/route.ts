import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/** Saúde para monitoramento externo. Não expõe versões nem detalhes internos. */
export async function GET() {
  const started = Date.now();
  try {
    const [r] = await db.execute<{ pend: number; mortos: number }>(sql`select
      count(*) filter (where status = 'pendente' and run_at < now() - interval '15 minutes')::int as pend,
      count(*) filter (where status = 'morto')::int as mortos from job`);
    return Response.json({ ok: true, db: "ok", latencyMs: Date.now() - started, jobsAtrasados: r.pend, jobsMortos: r.mortos });
  } catch {
    return Response.json({ ok: false, db: "erro" }, { status: 503 });
  }
}
