// Casos de aceite 4 e 5: recorrência, alteração, cancelamento, API fora do ar sem duplicação;
// adicionar evento não exige e-mail.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeDb, makeEvent, reset } from "./helpers";
import { expandOccurrences } from "@/server/calendar/recurrence";
import { buildCalendar, foldLine, googleTemplateLink } from "@/server/calendar/ics";
import { googleIdFor, importFromGoogle, syncLag, SyncTokenGoneError, type CalendarApi, type GEvent } from "@/server/calendar/google";
import { utcToWall, wallToUtc } from "@/server/calendar/time";
import { register } from "@/server/registrations";
import { event, eventException, registration } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const { db, client } = makeDb();
afterAll(() => client.end());
beforeEach(() => reset(db));

describe("fuso e recorrência", () => {
  it("converte horário de parede de Cuiabá (UTC-4) e de São Paulo", () => {
    expect(wallToUtc({ y: 2026, m: 11, d: 12, h: 19, mi: 30 }, "America/Cuiaba").toISOString()).toBe("2026-11-12T23:30:00.000Z");
    expect(utcToWall(new Date("2026-11-12T23:30:00Z"), "America/Cuiaba")).toMatchObject({ h: 19, mi: 30, d: 12 });
    // Fuso com horário de verão (Nova York) preserva o horário local nos dois lados da mudança
    const ev = { id: "e", allDay: false, startsAt: wallToUtc({ y: 2026, m: 10, d: 29, h: 19, mi: 0 }, "America/New_York"), endsAt: null, startDate: null, endDate: null, timezone: "America/New_York", rrule: "FREQ=WEEKLY;COUNT=3", status: "agendado" };
    const occ = expandOccurrences(ev, [], new Date("2026-10-01Z"), new Date("2026-12-01Z"));
    expect(occ.map((o) => utcToWall(o.start!, "America/New_York").h)).toEqual([19, 19, 19]);
    expect(new Set(occ.map((o) => o.start!.getUTCHours())).size).toBe(2); // offset muda em 1/nov
  });

  it("série semanal com ocorrência cancelada e outra alterada", () => {
    const start = wallToUtc({ y: 2026, m: 11, d: 5, h: 19, mi: 30 }, "America/Cuiaba");
    const ev = { id: "e", allDay: false, startsAt: start, endsAt: new Date(start.getTime() + 7_200_000), startDate: null, endDate: null, timezone: "America/Cuiaba", rrule: "FREQ=WEEKLY;BYDAY=TH", status: "agendado" };
    const second = new Date(start.getTime() + 7 * 86_400_000).toISOString();
    const third = new Date(start.getTime() + 14 * 86_400_000).toISOString();
    const occ = expandOccurrences(ev, [
      { originalStart: second, cancelled: true, overrideStartsAt: null, overrideEndsAt: null, overrideLocation: null },
      { originalStart: third, cancelled: false, overrideStartsAt: new Date(new Date(third).getTime() + 3_600_000), overrideEndsAt: null, overrideLocation: "Igreja Matriz" },
    ], new Date("2026-11-01Z"), new Date("2026-11-30Z"));
    expect(occ).toHaveLength(4);
    expect(occ[1].cancelled).toBe(true);
    expect(occ[2]).toMatchObject({ modified: true, location: "Igreja Matriz" });
    expect(occ[2].start!.toISOString()).toBe(new Date(new Date(third).getTime() + 3_600_000).toISOString());
  });

  it("evento de dia inteiro é data local (sem deslocar o dia)", () => {
    const ev = { id: "e", allDay: true, startsAt: null, endsAt: null, startDate: "2026-12-08", endDate: "2026-12-09", timezone: "America/Cuiaba", rrule: null, status: "agendado" };
    const occ = expandOccurrences(ev, [], new Date("2026-12-01Z"), new Date("2026-12-31Z"));
    expect(occ).toEqual([expect.objectContaining({ date: "2026-12-08", endDate: "2026-12-09" })]);
  });

  it("RRULE maliciosa é recusada", () => {
    const ev = { id: "e", allDay: false, startsAt: new Date(), endsAt: null, startDate: null, endDate: null, timezone: "America/Cuiaba", rrule: "FREQ=DAILY\nDTSTART:19000101", status: "agendado" };
    expect(() => expandOccurrences(ev, [], new Date(), new Date(Date.now() + 86_400_000))).toThrow();
  });
});

describe("iCalendar e 'adicionar à agenda'", () => {
  const base = { uid: "abc@rcc", sequence: 2, title: "Retiro, Pentecostes; 2027", summary: "Linha 1\nLinha 2", location: "Ginásio", url: "https://exemplo.invalid/agenda/retiro", allDay: false,
    startsAt: new Date("2027-05-15T12:00:00Z"), endsAt: new Date("2027-05-15T20:00:00Z"), startDate: null, endDate: null, timezone: "America/Cuiaba", status: "agendado" as const, updatedAt: new Date("2026-11-10T00:00:00Z") };

  it("gera ICS válido: UID estável, SEQUENCE, escape, CRLF e dobra em 75 octetos", () => {
    const ics = buildCalendar([base], { name: "Agenda" });
    expect(ics).toContain("UID:abc@rcc\r\n");
    expect(ics).toContain("SEQUENCE:2");
    expect(ics).toContain("SUMMARY:Retiro\\, Pentecostes\\; 2027");
    expect(ics).toContain("DESCRIPTION:Linha 1\\nLinha 2");
    expect(ics).toContain("DTSTART:20270515T120000Z");
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(foldLine("Á".repeat(60)).split("\r\n ").every((p) => new TextEncoder().encode(p).length <= 75)).toBe(true);
  });

  it("cancelamento mantém UID e sai com STATUS:CANCELLED; dia inteiro usa VALUE=DATE", () => {
    const ics = buildCalendar([{ ...base, status: "cancelado", sequence: 3 }, { ...base, uid: "d@rcc", allDay: true, startsAt: null, endsAt: null, startDate: "2026-12-08", endDate: null }], { name: "A" });
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261208");
    expect(ics).toContain("DTEND;VALUE=DATE:20261209");
  });

  it("série com exceção cancelada vira EXDATE; feed não contém dados privados", () => {
    const ics = buildCalendar([{ ...base, rrule: "FREQ=WEEKLY", exceptions: [{ originalStart: "2027-05-22T12:00:00.000Z", cancelled: true, overrideStartsAt: null, overrideEndsAt: null, overrideLocation: null }] }], { name: "A", refreshHours: 6 });
    expect(ics).toContain("EXDATE;TZID=America/Cuiaba:20270522T080000");
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT6H");
    expect(ics).not.toMatch(/ATTENDEE|ORGANIZER|@teste\.invalid/);
  });

  it("link do Google cria cópia sem exigir e-mail ou login", () => {
    const url = new URL(googleTemplateLink(base));
    expect(url.hostname).toBe("calendar.google.com");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe("20270515T120000Z/20270515T200000Z");
    expect(url.toString()).not.toMatch(/email|login/i);
  });
});

class FakeApi implements CalendarApi {
  pages: { items: GEvent[]; nextPageToken?: string; nextSyncToken?: string }[] = [];
  down = false; gone = false; calls: string[] = [];
  async list(p: { syncToken?: string; pageToken?: string }) {
    this.calls.push(`list:${p.syncToken ?? "-"}:${p.pageToken ?? "-"}`);
    if (this.down) throw new Error("ECONNRESET");
    if (this.gone && p.syncToken) throw new SyncTokenGoneError();
    const idx = p.pageToken ? Number(p.pageToken) : 0;
    return this.pages[idx];
  }
  async upsert(ev: GEvent) { return { id: ev.id }; }
  async cancel() {}
}

describe("importação Google → portal", () => {
  const master: GEvent = { id: "g1", status: "confirmed", summary: "Grupo de Oração Semanal", start: { dateTime: "2026-11-05T19:30:00-04:00", timeZone: "America/Cuiaba" }, end: { dateTime: "2026-11-05T21:30:00-04:00" }, recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=TH"], updated: "2026-11-01T10:00:00Z" };

  it("importa com paginação, como candidato, sem duplicar ao reimportar", async () => {
    const api = new FakeApi();
    api.pages = [{ items: [master], nextPageToken: "1" }, { items: [{ id: "g2", summary: "Retiro", start: { date: "2026-12-08" }, end: { date: "2026-12-09" }, updated: "2026-11-01T10:00:00Z" }, { id: "gp", summary: "Reunião particular", visibility: "private", start: { date: "2026-12-01" } }], nextSyncToken: "tok1" }];
    const s1 = await importFromGoogle(db, api);
    expect(s1).toMatchObject({ created: 2, ignoredPrivate: 1 });
    const evs = await db.select().from(event);
    expect(evs.every((e) => e.publication === "candidato")).toBe(true);
    expect(evs.find((e) => e.externalId === "g2")).toMatchObject({ allDay: true, startDate: "2026-12-08" });
    api.pages = [{ items: [master], nextSyncToken: "tok2" }];
    await importFromGoogle(db, api);
    expect(await db.select().from(event)).toHaveLength(2);
    expect(api.calls.at(-1)).toBe("list:tok1:-");
  });

  it("alteração incrementa SEQUENCE; evento fora de ordem (mais antigo) é ignorado; instância cancelada vira exceção", async () => {
    const api = new FakeApi();
    api.pages = [{ items: [master], nextSyncToken: "t" }];
    await importFromGoogle(db, api);
    api.pages = [{ items: [
      { id: "g1_x", recurringEventId: "g1", status: "cancelled", originalStartTime: { dateTime: "2026-11-12T19:30:00-04:00" } },
      { ...master, summary: "Grupo de Oração (novo local)", location: "Salão São José", updated: "2026-11-03T10:00:00Z" },
    ], nextSyncToken: "t2" }];
    await importFromGoogle(db, api);
    let [ev] = await db.select().from(event).where(eq(event.externalId, "g1"));
    expect(ev).toMatchObject({ title: "Grupo de Oração (novo local)", sequence: 1 });
    const ex = await db.select().from(eventException).where(eq(eventException.eventId, ev.id));
    expect(ex).toEqual([expect.objectContaining({ originalStart: "2026-11-12T23:30:00.000Z", cancelled: true })]);
    api.pages = [{ items: [{ ...master, summary: "Versão antiga", updated: "2026-10-01T00:00:00Z" }], nextSyncToken: "t3" }];
    await importFromGoogle(db, api);
    [ev] = await db.select().from(event).where(eq(event.externalId, "g1"));
    expect(ev.title).toBe("Grupo de Oração (novo local)");
  });

  it("cancelamento no Google não apaga o evento nem as inscrições", async () => {
    const api = new FakeApi();
    api.pages = [{ items: [master], nextSyncToken: "t" }];
    await importFromGoogle(db, api);
    const [ev] = await db.select().from(event).where(eq(event.externalId, "g1"));
    await db.update(event).set({ publication: "publicado", registrationEnabled: true }).where(eq(event.id, ev.id));
    await register(db, { eventId: ev.id, fullName: "Maria Teste", email: "maria@teste.invalid", idempotencyKey: "k1" });
    api.pages = [{ items: [{ id: "g1", status: "cancelled" }], nextSyncToken: "t2" }];
    await importFromGoogle(db, api);
    const [after] = await db.select().from(event).where(eq(event.id, ev.id));
    expect(after.status).toBe("cancelado");
    expect(await db.select().from(registration).where(eq(registration.eventId, ev.id))).toHaveLength(1);
  });

  it("token inválido (410) faz ressincronização completa; API fora do ar mantém conteúdo e registra atraso", async () => {
    const api = new FakeApi();
    api.pages = [{ items: [master], nextSyncToken: "t" }];
    await importFromGoogle(db, api);
    api.gone = true;
    api.pages = [{ items: [master], nextSyncToken: "novo" }];
    expect((await importFromGoogle(db, api)).fullResync).toBe(true);
    expect(await db.select().from(event)).toHaveLength(1);
    api.down = true;
    await expect(importFromGoogle(db, api)).rejects.toThrow("ECONNRESET");
    expect(await db.select().from(event).where(and(eq(event.externalId, "g1")))).toHaveLength(1);
    const lag = await syncLag(db, new Date(Date.now() + 20 * 60_000));
    expect(lag.stale).toBe(true);
  });

  it("ID de projeção para o Google é estável e usa apenas base32hex", async () => {
    const ev = await makeEvent(db);
    expect(googleIdFor(ev.id)).toMatch(/^[0-9a-v]{5,1024}$/);
    expect(googleIdFor(ev.id)).toBe(googleIdFor(ev.id));
  });
});
