import { weekdayName } from "@/server/calendar/time";

export const TZ = process.env.INSTITUTION_TIMEZONE || "America/Cuiaba";

export function fmtDateTime(d: Date, tz = TZ) {
  return cap(new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(d));
}
export function fmtDay(d: Date, tz = TZ) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "short", day: "2-digit", month: "short" }).format(d);
}
export function fmtTime(d: Date, tz = TZ) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(d);
}
export function fmtDateOnly(s: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) {
  return cap(new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...opts }).format(new Date(`${s}T12:00:00Z`)));
}
export function fmtPublished(d: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(new Date(d));
}
export const hhmm = (t: string | null) => (t ? t.slice(0, 5).replace(":", "h") : "");
export const weekday = (i: number) => weekdayName(i);
export const WEEKDAY_OPTIONS = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ value: String(i), label: weekdayName(i) }));

export const cap = (s: string) => (s ? s[0].toLocaleUpperCase("pt-BR") + s.slice(1) : s);

/** Partes de uma data para o "calendário" da agenda: dia grande, mês e dia da semana por extenso. */
export function dateParts(start: Date | null, dateOnly?: string | null, tz = TZ) {
  const d = start ?? new Date(`${dateOnly}T12:00:00Z`);
  const z = start ? tz : "UTC";
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: z, ...o }).format(d);
  return { dia: f({ day: "numeric" }), mes: f({ month: "short" }).replace(".", ""), semana: f({ weekday: "long" }), hora: start ? fmtTime(start, tz).replace(":", "h") : null };
}
