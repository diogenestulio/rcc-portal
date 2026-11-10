/**
 * Expansão de ocorrências preservando o fuso IANA original do evento.
 * A RRULE é aplicada sobre o HORÁRIO DE PAREDE (técnica "floating" do rrule.js) e cada
 * ocorrência é convertida para UTC com o fuso do evento — assim "toda quinta às 19h30"
 * continua às 19h30 locais mesmo que o fuso mude de deslocamento.
 */
import { RRule } from "rrule";
import { addDays, formatDateOnly, parseDateOnly, utcToWall, wallToUtc } from "./time";

export type EventLike = {
  id: string; allDay: boolean; startsAt: Date | null; endsAt: Date | null;
  startDate: string | null; endDate: string | null; timezone: string; rrule: string | null; status: string;
};
export type ExceptionLike = { originalStart: string; cancelled: boolean; overrideStartsAt: Date | null; overrideEndsAt: Date | null; overrideLocation: string | null };

export type Occurrence = {
  eventId: string;
  /** Chave da ocorrência = início original (ISO UTC) ou data (dia inteiro). Igual ao RECURRENCE-ID. */
  key: string;
  allDay: boolean;
  start: Date | null; end: Date | null;     // eventos com horário
  date: string | null; endDate: string | null; // dia inteiro (fim exclusivo)
  cancelled: boolean;
  modified: boolean;
  location?: string | null;
};

const MAX_OCCURRENCES = 500;

function sanitizeRule(rule: string) {
  // Aceitamos apenas a parte RRULE (sem DTSTART embutido) e impomos limites razoáveis.
  const r = rule.replace(/^RRULE:/i, "").trim();
  if (!/^[A-Z0-9=;,\-+:]+$/i.test(r)) throw new Error("RRULE inválida");
  if (/DTSTART|TZID/i.test(r)) throw new Error("RRULE não pode conter DTSTART/TZID");
  return r;
}

export function expandOccurrences(ev: EventLike, exceptions: ExceptionLike[], rangeStart: Date, rangeEnd: Date): Occurrence[] {
  const exMap = new Map(exceptions.map((e) => [e.originalStart, e]));
  const out: Occurrence[] = [];

  if (ev.allDay) {
    const start = ev.startDate!;
    const end = ev.endDate ?? addDays(start, 1);
    const lenDays = Math.max(1, Math.round((parseDateOnly(end).getTime() - parseDateOnly(start).getTime()) / 86_400_000));
    const dates: string[] = [];
    if (ev.rrule) {
      const rule = RRule.fromString(`DTSTART:${start.replaceAll("-", "")}T000000Z\nRRULE:${sanitizeRule(ev.rrule)}`);
      const from = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), rangeStart.getUTCDate() - lenDays));
      rule.between(from, rangeEnd, true).slice(0, MAX_OCCURRENCES).forEach((d) => dates.push(formatDateOnly(d)));
    } else dates.push(start);
    for (const d of dates) {
      const ex = exMap.get(d);
      const occEnd = addDays(d, lenDays);
      // Datas de dia inteiro são datas locais; comparamos como portadores de data (sem fuso).
      if (!(parseDateOnly(d).getTime() < rangeEnd.getTime() && parseDateOnly(occEnd).getTime() > rangeStart.getTime())) continue;
      out.push({ eventId: ev.id, key: d, allDay: true, start: null, end: null, date: d, endDate: occEnd, cancelled: ev.status === "cancelado" || !!ex?.cancelled, modified: !!ex && !ex.cancelled, location: ex?.overrideLocation });
    }
    return out;
  }

  const startsAt = ev.startsAt!;
  const durMs = (ev.endsAt ?? new Date(startsAt.getTime() + 60 * 60 * 1000)).getTime() - startsAt.getTime();
  const instants: Date[] = [];
  if (ev.rrule) {
    const w = utcToWall(startsAt, ev.timezone);
    const floatingStart = new Date(Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi));
    const rule = new RRule({ ...RRule.parseString(sanitizeRule(ev.rrule)), dtstart: floatingStart });
    // Margem de 1 dia nas bordas para compensar o deslocamento do fuso na comparação "floating".
    const fl = rule.between(new Date(rangeStart.getTime() - durMs - 86_400_000), new Date(rangeEnd.getTime() + 86_400_000), true).slice(0, MAX_OCCURRENCES);
    for (const f of fl) instants.push(wallToUtc({ y: f.getUTCFullYear(), m: f.getUTCMonth() + 1, d: f.getUTCDate(), h: f.getUTCHours(), mi: f.getUTCMinutes() }, ev.timezone));
  } else instants.push(startsAt);

  for (const s of instants) {
    const key = s.toISOString();
    const ex = exMap.get(key);
    const start = ex?.overrideStartsAt ?? s;
    const end = ex?.overrideEndsAt ?? new Date(start.getTime() + durMs);
    if (end.getTime() <= rangeStart.getTime() || start.getTime() >= rangeEnd.getTime()) continue;
    out.push({ eventId: ev.id, key, allDay: false, start, end, date: null, endDate: null, cancelled: ev.status === "cancelado" || !!ex?.cancelled, modified: !!ex && !ex.cancelled, location: ex?.overrideLocation });
  }
  return out.sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0));
}
