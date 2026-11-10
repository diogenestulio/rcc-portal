/**
 * Conversões de fuso sem bibliotecas extras (Intl). Instantes são `Date` (UTC);
 * "horário de parede" é {y,m,d,h,mi} num fuso IANA.
 */
export type Wall = { y: number; m: number; d: number; h: number; mi: number };

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    fmtCache.set(tz, f);
  }
  return f;
}

export function utcToWall(instant: Date, tz: string): Wall {
  const parts = Object.fromEntries(fmt(tz).formatToParts(instant).map((p) => [p.type, p.value]));
  return { y: +parts.year, m: +parts.month, d: +parts.day, h: +parts.hour, mi: +parts.minute };
}

/** Converte horário de parede em instante UTC. Em lacunas de horário de verão, avança para o primeiro horário válido. */
export function wallToUtc(w: Wall, tz: string): Date {
  const guess = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi);
  let t = guess;
  for (let i = 0; i < 3; i++) {
    const got = utcToWall(new Date(t), tz);
    const diff = guess - Date.UTC(got.y, got.m - 1, got.d, got.h, got.mi);
    if (diff === 0) return new Date(t);
    t += diff;
  }
  return new Date(t);
}

export const pad = (n: number, l = 2) => String(n).padStart(l, "0");

/** "2026-11-10" → Date UTC à meia-noite (apenas como portador da data, sem significado de instante). */
export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function formatDateOnly(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function addDays(dateOnly: string, n: number) {
  const d = parseDateOnly(dateOnly);
  d.setUTCDate(d.getUTCDate() + n);
  return formatDateOnly(d);
}

const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
export const weekdayName = (i: number) => WEEKDAYS[i] ?? "";

export function formatLocal(instant: Date, tz: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, ...opts }).format(instant);
}
