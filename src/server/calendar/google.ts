/**
 * Integração Google Calendar — UMA fonte de verdade por agenda (ADR-003):
 *  - cms_to_google (padrão): o CMS manda; o Google recebe uma PROJEÇÃO dos eventos públicos via jobs.
 *  - google_to_cms: a agenda institucional no Google manda; o portal importa como CANDIDATO
 *    e os campos importados ficam bloqueados no CMS.
 * Sem sincronização bidirecional. Nunca importa convidados, e-mails, notas privadas ou outras agendas.
 *
 * ESTADO: lógica testada com cliente simulado (tests/calendar-sync.test.ts). A chamada HTTP real
 * (GoogleHttpCalendarApi) está escrita conforme a documentação oficial mas NÃO foi validada contra
 * a API — depende de credenciais institucionais (ver docs/09-integracoes.md).
 */
import { and, eq } from "drizzle-orm";
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import type { DB } from "@/db";
import { event, eventException, integrationState } from "@/db/schema";
import { sanitizeRichText } from "../content";
import { audit } from "../audit";
import { opaqueToken } from "../tokens";

// ───────── Tipos mínimos da API (somente campos públicos que usamos) ─────────
export type GDate = { date?: string; dateTime?: string; timeZone?: string };
export type GEvent = {
  id: string; status?: "confirmed" | "tentative" | "cancelled"; summary?: string; description?: string; location?: string;
  start?: GDate; end?: GDate; recurrence?: string[]; recurringEventId?: string; originalStartTime?: GDate;
  updated?: string; etag?: string; visibility?: string; iCalUID?: string; sequence?: number;
};
export type ListResult = { items: GEvent[]; nextPageToken?: string; nextSyncToken?: string };
export class SyncTokenGoneError extends Error { constructor() { super("syncToken inválido (410)"); } }

export interface CalendarApi {
  list(params: { syncToken?: string; pageToken?: string }): Promise<ListResult>;
  upsert(ev: GEvent): Promise<{ id: string; etag?: string }>;
  cancel(id: string): Promise<void>;
}

// ───────── Importação Google → portal ─────────
type ImportStats = { created: number; updated: number; cancelled: number; exceptions: number; ignoredPrivate: number; fullResync: boolean };

function mapTimes(g: GEvent, fallbackTz: string) {
  if (g.start?.date) return { allDay: true, startDate: g.start.date, endDate: g.end?.date ?? null, startsAt: null, endsAt: null, timezone: g.start.timeZone ?? fallbackTz };
  return { allDay: false, startDate: null, endDate: null, startsAt: g.start?.dateTime ? new Date(g.start.dateTime) : null, endsAt: g.end?.dateTime ? new Date(g.end.dateTime) : null, timezone: g.start?.timeZone ?? fallbackTz };
}

function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "evento";
}

/** Aplica UM evento do Google de forma idempotente (chave: source+externalId). Não toca em inscrições. */
export async function applyGoogleEvent(db: DB, g: GEvent, tz: string, stats: ImportStats) {
  if (g.visibility === "private" || g.visibility === "confidential") { stats.ignoredPrivate++; return; }

  // Instância de série recorrente → exceção do evento mestre.
  if (g.recurringEventId) {
    const [master] = await db.select({ id: event.id }).from(event).where(and(eq(event.source, "google"), eq(event.externalId, g.recurringEventId)));
    if (!master) return; // mestre chegará depois (ordem não garantida); a reconciliação completa corrige
    const orig = g.originalStartTime?.date ?? (g.originalStartTime?.dateTime ? new Date(g.originalStartTime.dateTime).toISOString() : null);
    if (!orig) return;
    const t = mapTimes(g, tz);
    await db.insert(eventException).values({
      eventId: master.id, originalStart: orig, cancelled: g.status === "cancelled", externalId: g.id,
      overrideStartsAt: t.startsAt, overrideEndsAt: t.endsAt, overrideLocation: g.location ?? null,
    }).onConflictDoUpdate({ target: [eventException.eventId, eventException.originalStart], set: {
      cancelled: g.status === "cancelled", overrideStartsAt: t.startsAt, overrideEndsAt: t.endsAt, overrideLocation: g.location ?? null,
    } });
    stats.exceptions++;
    return;
  }

  const [existing] = await db.select().from(event).where(and(eq(event.source, "google"), eq(event.externalId, g.id)));
  if (g.status === "cancelled") {
    // Cancelamento: marcamos o evento, NUNCA apagamos (inscrições e dados editoriais locais são preservados).
    if (existing && existing.status !== "cancelado") {
      await db.update(event).set({ status: "cancelado", sequence: existing.sequence + 1, updatedAt: new Date() }).where(eq(event.id, existing.id));
      stats.cancelled++;
    }
    return;
  }
  // Atualização fora de ordem: ignora versão mais antiga do que a já aplicada.
  const gUpdated = g.updated ? new Date(g.updated) : new Date();
  if (existing?.externalUpdatedAt && existing.externalUpdatedAt.getTime() > gUpdated.getTime()) return;

  const t = mapTimes(g, tz);
  if (!t.allDay && !t.startsAt) return;
  const rrule = g.recurrence?.find((r) => r.startsWith("RRULE:"))?.slice(6) ?? null;
  const fields = {
    title: (g.summary ?? "Evento sem título").slice(0, 200),
    descriptionHtml: g.description ? sanitizeRichText(g.description) : null,
    location: g.location ?? null, ...t, rrule,
    status: g.status === "tentative" ? ("adiado" as const) : ("agendado" as const),
    externalEtag: g.etag ?? null, externalUpdatedAt: gUpdated, updatedAt: new Date(),
  };
  if (existing) {
    const changed = existing.title !== fields.title || existing.startsAt?.getTime() !== fields.startsAt?.getTime() || existing.startDate !== fields.startDate || existing.rrule !== fields.rrule || existing.location !== fields.location || existing.status !== fields.status;
    await db.update(event).set({ ...fields, sequence: changed ? existing.sequence + 1 : existing.sequence }).where(eq(event.id, existing.id));
    stats.updated++;
  } else {
    await db.insert(event).values({
      ...fields, source: "google", externalId: g.id, publication: "candidato", // aguarda validação do responsável
      slug: `${slugify(fields.title)}-${opaqueToken(4).toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      icalUid: g.iCalUID ?? `${g.id}@google.com`,
    }).onConflictDoNothing();
    stats.created++;
  }
}

const STATE_KEY = "google_calendar_import";

/** Sincronização incremental com paginação; em 410 faz ressincronização completa sem apagar dados locais. */
export async function importFromGoogle(db: DB, api: CalendarApi, tz = "America/Cuiaba"): Promise<ImportStats> {
  const stats: ImportStats = { created: 0, updated: 0, cancelled: 0, exceptions: 0, ignoredPrivate: 0, fullResync: false };
  const [state] = await db.select().from(integrationState).where(eq(integrationState.key, STATE_KEY));
  let syncToken = (state?.value as { syncToken?: string } | undefined)?.syncToken;
  const run = async (token?: string) => {
    let pageToken: string | undefined;
    let next: string | undefined;
    const deferred: GEvent[] = [];
    do {
      const page = await api.list({ syncToken: token, pageToken });
      for (const g of page.items) {
        if (g.recurringEventId) deferred.push(g);
        else await applyGoogleEvent(db, g, tz, stats);
      }
      pageToken = page.nextPageToken;
      next = page.nextSyncToken ?? next;
    } while (pageToken);
    // Exceções depois dos mestres, para não depender da ordem da API.
    for (const g of deferred) await applyGoogleEvent(db, g, tz, stats);
    return next;
  };
  try {
    try { syncToken = await run(syncToken); }
    catch (e) {
      if (!(e instanceof SyncTokenGoneError)) throw e;
      stats.fullResync = true;
      syncToken = await run(undefined);
    }
    await db.insert(integrationState).values({ key: STATE_KEY, value: { syncToken }, lastSuccessAt: new Date() })
      .onConflictDoUpdate({ target: integrationState.key, set: { value: { syncToken }, lastSuccessAt: new Date(), lastError: null, updatedAt: new Date() } });
    await audit(db, { action: "agenda.importar", resourceType: "integracao", resourceId: STATE_KEY, detail: stats });
    return stats;
  } catch (e) {
    // Falha: mantém o último conteúdo público válido; registra para alerta.
    await db.insert(integrationState).values({ key: STATE_KEY, value: state?.value ?? {}, lastErrorAt: new Date(), lastError: String(e).slice(0, 300) })
      .onConflictDoUpdate({ target: integrationState.key, set: { lastErrorAt: new Date(), lastError: String(e).slice(0, 300), updatedAt: new Date() } });
    throw e;
  }
}

// ───────── Exportação portal → Google (projeção) ─────────
/** ID estável aceito pelo Google (base32hex: 0-9 a-v): o UUID sem hífens é hexadecimal, subconjunto válido. */
export const googleIdFor = (eventId: string) => `rcc${eventId.replaceAll("-", "")}`;

export function toGoogleEvent(ev: typeof event.$inferSelect, publicUrl: string): GEvent {
  const base: GEvent = {
    id: googleIdFor(ev.id), summary: ev.title, location: [ev.location, ev.address].filter(Boolean).join(" — ") || undefined,
    description: [ev.summary, `Detalhes e inscrições: ${publicUrl}`].filter(Boolean).join("\n\n"),
    status: ev.status === "cancelado" ? "cancelled" : ev.status === "adiado" ? "tentative" : "confirmed",
    iCalUID: ev.icalUid, sequence: ev.sequence, visibility: "public",
  };
  if (ev.allDay) { base.start = { date: ev.startDate! }; base.end = { date: ev.endDate ?? ev.startDate! }; }
  else { base.start = { dateTime: ev.startsAt!.toISOString(), timeZone: ev.timezone }; base.end = { dateTime: (ev.endsAt ?? new Date(ev.startsAt!.getTime() + 3_600_000)).toISOString(), timeZone: ev.timezone }; }
  if (ev.rrule) base.recurrence = [`RRULE:${ev.rrule}`];
  return base;
}

/** Handler do job `gcal.projetar` (idempotente: upsert pelo ID estável). */
export async function projectEventToGoogle(db: DB, api: CalendarApi, eventId: string, appUrl: string) {
  const [ev] = await db.select().from(event).where(eq(event.id, eventId));
  if (!ev || ev.source !== "cms") return;
  // Rascunhos/arquivados saem da projeção pública.
  if (ev.publication !== "publicado") { await api.cancel(googleIdFor(ev.id)); return; }
  const res = await api.upsert(toGoogleEvent(ev, `${appUrl}/agenda/${ev.slug}`));
  await db.update(event).set({ externalId: res.id, externalEtag: res.etag ?? null }).where(eq(event.id, ev.id));
}

/** Atraso de sincronização (para alerta interno e aviso público). */
export async function syncLag(db: DB, now = new Date()) {
  const [s] = await db.select().from(integrationState).where(eq(integrationState.key, STATE_KEY));
  if (!s?.lastSuccessAt) return { lastSuccessAt: null, lagMinutes: null, stale: true };
  const lag = Math.round((now.getTime() - s.lastSuccessAt.getTime()) / 60000);
  return { lastSuccessAt: s.lastSuccessAt, lagMinutes: lag, stale: lag > 15 };
}

// ───────── Cliente HTTP real (service account com agenda COMPARTILHADA com ela) ─────────
export class GoogleHttpCalendarApi implements CalendarApi {
  private token?: { value: string; exp: number };
  constructor(private calendarId: string, private keyFile: string, private scope = "https://www.googleapis.com/auth/calendar.events") {}

  private async accessToken() {
    if (this.token && this.token.exp > Date.now() + 60_000) return this.token.value;
    const key = JSON.parse(readFileSync(this.keyFile, "utf8")) as { client_email: string; private_key: string };
    const now = Math.floor(Date.now() / 1000);
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: key.client_email, scope: this.scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
    const sig = createSign("RSA-SHA256").update(unsigned).sign(key.private_key).toString("base64url");
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }), signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`token Google: HTTP ${r.status}`);
    const j = (await r.json()) as { access_token: string; expires_in: number };
    this.token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
    return j.access_token;
  }
  private base() { return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events`; }
  private async req(url: string, init: RequestInit = {}) {
    const r = await fetch(url, { ...init, headers: { ...init.headers, authorization: `Bearer ${await this.accessToken()}`, "content-type": "application/json" }, signal: AbortSignal.timeout(20_000) });
    return r;
  }
  async list(p: { syncToken?: string; pageToken?: string }): Promise<ListResult> {
    const q = new URLSearchParams({ maxResults: "250", showDeleted: "true", singleEvents: "false" });
    if (p.syncToken) q.set("syncToken", p.syncToken);
    if (p.pageToken) q.set("pageToken", p.pageToken);
    const r = await this.req(`${this.base()}?${q}`);
    if (r.status === 410) throw new SyncTokenGoneError();
    if (!r.ok) throw new Error(`Google list: HTTP ${r.status}`);
    const j = (await r.json()) as ListResult;
    return { items: j.items ?? [], nextPageToken: j.nextPageToken, nextSyncToken: j.nextSyncToken };
  }
  async upsert(ev: GEvent) {
    let r = await this.req(`${this.base()}/${ev.id}`, { method: "PUT", body: JSON.stringify(ev) });
    if (r.status === 404) r = await this.req(this.base(), { method: "POST", body: JSON.stringify(ev) });
    if (!r.ok) throw new Error(`Google upsert: HTTP ${r.status}`);
    const j = (await r.json()) as { id: string; etag?: string };
    return { id: j.id, etag: j.etag };
  }
  async cancel(id: string) {
    const r = await this.req(`${this.base()}/${id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });
    if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error(`Google cancel: HTTP ${r.status}`);
  }
}

