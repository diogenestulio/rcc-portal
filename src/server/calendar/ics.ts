/**
 * Geração de iCalendar (RFC 5545) para:
 *  - cópia de um evento (/agenda/[slug]/evento.ics) — o visitante recebe uma cópia; não há garantia
 *    de atualização posterior;
 *  - feed de assinatura (/agenda.ics) — o aplicativo do visitante consulta periodicamente
 *    (frequência decidida pelo aplicativo, não por nós).
 * UID é estável; alterações incrementam SEQUENCE; cancelamentos saem com STATUS:CANCELLED.
 * O feed só contém campos públicos.
 */
import { formatDateOnly, parseDateOnly } from "./time";
import type { ExceptionLike } from "./recurrence";

export type IcsEvent = {
  uid: string; sequence: number; title: string; summary?: string | null; location?: string | null; address?: string | null;
  url?: string | null; allDay: boolean; startsAt: Date | null; endsAt: Date | null; startDate: string | null; endDate: string | null;
  timezone: string; rrule?: string | null; status: "agendado" | "adiado" | "cancelado"; updatedAt: Date;
  exceptions?: ExceptionLike[];
};

export function escapeText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Dobra linhas em 75 octetos (UTF-8), sem quebrar caracteres multibyte. */
export function foldLine(line: string) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "", curLen = 0, limit = 75;
  for (const ch of line) {
    const l = enc.encode(ch).length;
    if (curLen + l > limit) { out.push(cur); cur = ""; curLen = 0; limit = 74; }
    cur += ch; curLen += l;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const FIXED_OFFSETS: Record<string, string> = { "America/Cuiaba": "-0400", "America/Campo_Grande": "-0400", "America/Sao_Paulo": "-0300", "America/Porto_Velho": "-0400" };

const utcStamp =(d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dateStamp = (s: string) => s.replaceAll("-", "");

function statusOf(s: IcsEvent["status"]) {
  return s === "cancelado" ? "CANCELLED" : s === "adiado" ? "TENTATIVE" : "CONFIRMED";
}

function vevent(e: IcsEvent, lines: string[], dtstamp: Date) {
  lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${utcStamp(dtstamp)}`, `LAST-MODIFIED:${utcStamp(e.updatedAt)}`, `SEQUENCE:${e.sequence}`);
  if (e.allDay) {
    const end = e.endDate ?? formatDateOnly(new Date(parseDateOnly(e.startDate!).getTime() + 86_400_000));
    lines.push(`DTSTART;VALUE=DATE:${dateStamp(e.startDate!)}`, `DTEND;VALUE=DATE:${dateStamp(end)}`);
  } else {
    // Instantes em UTC — interoperável sem VTIMEZONE; a RRULE (se houver) vai com TZID para preservar o horário local.
    if (e.rrule) {
      lines.push(`DTSTART;TZID=${e.timezone}:${localStamp(e.startsAt!, e.timezone)}`);
      lines.push(`DTEND;TZID=${e.timezone}:${localStamp(e.endsAt ?? new Date(e.startsAt!.getTime() + 3_600_000), e.timezone)}`);
    } else {
      lines.push(`DTSTART:${utcStamp(e.startsAt!)}`, `DTEND:${utcStamp(e.endsAt ?? new Date(e.startsAt!.getTime() + 3_600_000))}`);
    }
  }
  if (e.rrule) lines.push(`RRULE:${e.rrule.replace(/^RRULE:/i, "")}`);
  for (const ex of e.exceptions ?? []) {
    if (!ex.cancelled) continue;
    lines.push(e.allDay ? `EXDATE;VALUE=DATE:${dateStamp(ex.originalStart)}` : `EXDATE;TZID=${e.timezone}:${localStamp(new Date(ex.originalStart), e.timezone)}`);
  }
  lines.push(`SUMMARY:${escapeText((e.status === "cancelado" ? "[CANCELADO] " : e.status === "adiado" ? "[ADIADO] " : "") + e.title)}`);
  if (e.summary) lines.push(`DESCRIPTION:${escapeText(e.summary + (e.url ? `\n\nDetalhes e atualizações: ${e.url}` : ""))}`);
  else if (e.url) lines.push(`DESCRIPTION:${escapeText(`Detalhes e atualizações: ${e.url}`)}`);
  const loc = [e.location, e.address].filter(Boolean).join(" — ");
  if (loc) lines.push(`LOCATION:${escapeText(loc)}`);
  if (e.url) lines.push(`URL:${e.url}`);
  lines.push(`STATUS:${statusOf(e.status)}`, "TRANSP:OPAQUE", "END:VEVENT");

  // Ocorrências alteradas: VEVENT com o mesmo UID e RECURRENCE-ID.
  for (const ex of e.exceptions ?? []) {
    if (ex.cancelled || !ex.overrideStartsAt || e.allDay) continue;
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${utcStamp(dtstamp)}`, `SEQUENCE:${e.sequence}`,
      `RECURRENCE-ID;TZID=${e.timezone}:${localStamp(new Date(ex.originalStart), e.timezone)}`,
      `DTSTART:${utcStamp(ex.overrideStartsAt)}`,
      `DTEND:${utcStamp(ex.overrideEndsAt ?? new Date(ex.overrideStartsAt.getTime() + 3_600_000))}`,
      `SUMMARY:${escapeText(e.title)}`);
    if (ex.overrideLocation ?? loc) lines.push(`LOCATION:${escapeText(ex.overrideLocation ?? loc)}`);
    lines.push(`STATUS:${statusOf(e.status)}`, "END:VEVENT");
  }
}

function localStamp(d: Date, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}${p.month}${p.day}T${p.hour}${p.minute}${p.second}`;
}

export function buildCalendar(events: IcsEvent[], opts: { name: string; method?: "PUBLISH"; now?: Date; refreshHours?: number }) {
  const now = opts.now ?? new Date();
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RCC Arquidiocese de Cuiaba//Portal//PT-BR", "CALSCALE:GREGORIAN", `METHOD:${opts.method ?? "PUBLISH"}`,
    `X-WR-CALNAME:${escapeText(opts.name)}`, "X-WR-TIMEZONE:America/Cuiaba"];
  if (opts.refreshHours) lines.push(`REFRESH-INTERVAL;VALUE=DURATION:PT${opts.refreshHours}H`, `X-PUBLISHED-TTL:PT${opts.refreshHours}H`);
  // VTIMEZONE mínimo para os fusos sem horário de verão vigente que usamos com TZID.
  // (America/Cuiaba: UTC-4 fixo desde 2019. Outro fuso com DST exigiria regras completas — ver ADR-004.)
  const tzs = new Set(events.filter((e) => e.rrule && !e.allDay).map((e) => e.timezone));
  for (const tz of tzs) {
    const off = FIXED_OFFSETS[tz];
    if (!off) continue;
    lines.push("BEGIN:VTIMEZONE", `TZID:${tz}`, "BEGIN:STANDARD", "DTSTART:19700101T000000", `TZOFFSETFROM:${off}`, `TZOFFSETTO:${off}`, `TZNAME:${off.slice(0, 3)}`, "END:STANDARD", "END:VTIMEZONE");
  }
  for (const e of events) vevent(e, lines, now);
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Link "Adicionar ao Google Agenda" (cria uma CÓPIA na agenda do visitante). */
export function googleTemplateLink(e: IcsEvent) {
  const dates = e.allDay
    ? `${dateStamp(e.startDate!)}/${dateStamp(e.endDate ?? formatDateOnly(new Date(parseDateOnly(e.startDate!).getTime() + 86_400_000)))}`
    : `${utcStamp(e.startsAt!)}/${utcStamp(e.endsAt ?? new Date(e.startsAt!.getTime() + 3_600_000))}`;
  const p = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates, ctz: e.timezone });
  if (e.summary || e.url) p.set("details", [e.summary, e.url ? `Detalhes: ${e.url}` : null].filter(Boolean).join("\n\n"));
  const loc = [e.location, e.address].filter(Boolean).join(" — ");
  if (loc) p.set("location", loc);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
