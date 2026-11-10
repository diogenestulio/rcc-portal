import { and, eq, gte, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { event, eventException } from "@/db/schema";
import { toIcs } from "@/server/events";
import { buildCalendar } from "@/server/calendar/ics";
import { env } from "@/lib/env";
import { instituicaoProvisoria as INST } from "@/config/instituicao";

export const dynamic = "force-dynamic";

/**
 * Feed público de assinatura. Somente eventos publicados e campos públicos.
 * Inclui cancelados recentes (STATUS:CANCELLED) para que assinantes recebam o cancelamento.
 */
export async function GET() {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const evs = await db.select().from(event).where(and(eq(event.publication, "publicado"),
    or(isNotNull(event.rrule), gte(event.startsAt, since), sql`${event.startDate} >= ${since.toISOString()}::date`)));
  const exs = evs.length ? await db.select().from(eventException).where(inArray(eventException.eventId, evs.map((e) => e.id))) : [];
  const body = buildCalendar(evs.map((e) => toIcs(e, exs.filter((x) => x.eventId === e.id), env.APP_URL)), { name: `Agenda ${INST.nomePublico}`, refreshHours: 6 });
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}
