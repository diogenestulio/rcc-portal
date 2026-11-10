import { db } from "@/db";
import { getPublicEvent, toIcs } from "@/server/events";
import { buildCalendar } from "@/server/calendar/ics";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/agenda/[slug]/evento.ics">) {
  const { slug } = await ctx.params;
  const r = await getPublicEvent(db, slug);
  if (!r) return new Response("Evento não encontrado", { status: 404 });
  const body = buildCalendar([toIcs(r.ev, r.exceptions, env.APP_URL)], { name: r.ev.title });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug.replace(/[^a-z0-9-]/g, "")}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
