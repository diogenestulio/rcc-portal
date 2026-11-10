/** Leitura pública da agenda (somente eventos publicados) e mapeamentos para ICS. */
import { and, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { event, eventException, ticketBatch } from "@/db/schema";
import { expandOccurrences, type Occurrence } from "./calendar/recurrence";
import type { IcsEvent } from "./calendar/ics";
import { registrationWindow } from "./registrations";

export type PublicEvent = typeof event.$inferSelect;
export type AgendaItem = Occurrence & { ev: PublicEvent };

export async function agenda(db: DB, from: Date, to: Date): Promise<AgendaItem[]> {
  const evs = await db.select().from(event).where(and(eq(event.publication, "publicado"), sql`(
      ${event.rrule} is not null
      or (${event.startsAt} < ${to.toISOString()}::timestamptz and coalesce(${event.endsAt}, ${event.startsAt}) >= ${from.toISOString()}::timestamptz)
      or (${event.startDate} <= ${to.toISOString()}::date and coalesce(${event.endDate}, ${event.startDate} + 1) >= ${from.toISOString()}::date))`));
  if (evs.length === 0) return [];
  const exs = await db.select().from(eventException).where(inArray(eventException.eventId, evs.map((e) => e.id)));
  const out: AgendaItem[] = [];
  for (const ev of evs) {
    try {
      for (const o of expandOccurrences(ev, exs.filter((x) => x.eventId === ev.id), from, to)) out.push({ ...o, ev });
    } catch { /* RRULE inválida: evento é ignorado na expansão e aparece no painel para correção */ }
  }
  const t = (o: AgendaItem) => o.start?.getTime() ?? Date.parse(`${o.date}T12:00:00Z`);
  return out.sort((a, b) => t(a) - t(b));
}

export async function getPublicEvent(db: DB, slug: string) {
  const [ev] = await db.select().from(event).where(and(eq(event.slug, slug), eq(event.publication, "publicado")));
  if (!ev) return null;
  const [exceptions, batches, occ] = await Promise.all([
    db.select().from(eventException).where(eq(eventException.eventId, ev.id)),
    db.select().from(ticketBatch).where(eq(ticketBatch.eventId, ev.id)).orderBy(ticketBatch.sortOrder),
    db.execute<{ n: number }>(sql`select count(*)::int as n from registration where event_id = ${ev.id}
      and (status in ('confirmada','em_resolucao') or (status = 'reservada' and hold_expires_at > now()))`),
  ]);
  const occupied = occ[0].n;
  return { ev, exceptions, batches, occupied, window: registrationWindow(ev, occupied) };
}

export function toIcs(ev: PublicEvent, exceptions: (typeof eventException.$inferSelect)[], appUrl: string): IcsEvent {
  return {
    uid: ev.icalUid, sequence: ev.sequence, title: ev.title, summary: ev.summary, location: ev.location, address: ev.address,
    url: `${appUrl}/agenda/${ev.slug}`, allDay: ev.allDay, startsAt: ev.startsAt, endsAt: ev.endsAt, startDate: ev.startDate, endDate: ev.endDate,
    timezone: ev.timezone, rrule: ev.rrule, status: ev.status, updatedAt: ev.updatedAt, exceptions,
  };
}

/** Estado temporal exibido: agendado/adiado/cancelado vêm do cadastro; "encerrado" é calculado. */
export function displayStatus(ev: PublicEvent, now = new Date()): "agendado" | "adiado" | "cancelado" | "encerrado" {
  if (ev.status !== "agendado") return ev.status;
  if (ev.rrule) return "agendado";
  const end = ev.allDay ? (ev.endDate ? Date.parse(`${ev.endDate}T04:00:00Z`) : Date.parse(`${ev.startDate}T04:00:00Z`) + 86_400_000) : (ev.endsAt ?? ev.startsAt)!.getTime();
  return end < now.getTime() ? "encerrado" : "agendado";
}
