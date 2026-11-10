"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { event } from "@/db/schema";
import { requireAdmin } from "@/server/session";
import { assertCan, ForbiddenError } from "@/server/authz";
import { audit } from "@/server/audit";
import { enqueue } from "@/server/jobs";
import { checkIn } from "@/server/registrations";
import { wallToUtc } from "@/server/calendar/time";
import { sanitizeRichText } from "@/server/content";
import { textToHtml } from "@/server/richtext";
import { env } from "@/lib/env";

const TZ = env.INSTITUTION_TIMEZONE;
function local(v: FormDataEntryValue | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(v ?? ""));
  return m ? wallToUtc({ y: +m[1], m: +m[2], d: +m[3], h: +m[4], mi: +m[5] }, TZ) : null;
}
const RRULES: Record<string, string | null> = { "": null, semanal: "FREQ=WEEKLY", quinzenal: "FREQ=WEEKLY;INTERVAL=2", mensal: "FREQ=MONTHLY" };

export async function salvarEvento(fd: FormData) {
  const s = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const groupId = (fd.get("grupo") as string) || null;
  assertCan(s, "evento.gerenciar", { groupId });
  const allDay = fd.get("dia_inteiro") === "on";
  const startDate = String(fd.get("data_inicio") ?? "");
  const startsAt = local(fd.get("inicio")), endsAt = local(fd.get("fim"));
  const title = String(fd.get("titulo") ?? "").trim();
  const back = id ? `/admin/eventos/${id}` : "/admin/eventos/novo";
  if (title.length < 3 || (allDay ? !/^\d{4}-\d{2}-\d{2}$/.test(startDate) : !startsAt) || (endsAt && startsAt && endsAt <= startsAt)) redirect(`${back}?erro=dados`);
  const cap = String(fd.get("vagas") ?? "").trim();
  const values = {
    title: title.slice(0, 200), summary: String(fd.get("resumo") ?? "").trim().slice(0, 400) || null,
    descriptionHtml: sanitizeRichText(textToHtml(String(fd.get("descricao") ?? "").slice(0, 50_000))) || null,
    location: String(fd.get("local") ?? "").trim().slice(0, 200) || null, address: String(fd.get("endereco") ?? "").trim().slice(0, 300) || null,
    allDay, startsAt: allDay ? null : startsAt, endsAt: allDay ? null : endsAt,
    startDate: allDay ? startDate : null, endDate: allDay ? (String(fd.get("data_fim") ?? "") || null) : null,
    timezone: TZ, rrule: RRULES[String(fd.get("repeticao") ?? "")] ?? null, groupId,
    registrationEnabled: fd.get("inscricoes") === "on", capacity: /^\d+$/.test(cap) && +cap > 0 ? +cap : null,
    waitlistEnabled: fd.get("espera") === "on", registrationClosesAt: local(fd.get("encerra")),
    status: (["agendado", "adiado", "cancelado"].includes(String(fd.get("situacao"))) ? String(fd.get("situacao")) : "agendado") as "agendado" | "adiado" | "cancelado",
    updatedAt: new Date(),
  };
  let eventId = id;
  if (id) {
    const [cur] = await db.select().from(event).where(eq(event.id, id));
    if (!cur) redirect("/admin/eventos");
    if (cur.source === "google") redirect(`${back}?erro=google`); // campos importados ficam bloqueados no CMS
    await db.update(event).set({ ...values, sequence: cur.sequence + 1 }).where(eq(event.id, id));
  } else {
    const slug = title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) + "-" + randomUUID().slice(0, 6);
    const [ev] = await db.insert(event).values({ ...values, slug, icalUid: `${randomUUID()}@rcc-arquidiocesana`, publication: "rascunho" }).returning({ id: event.id });
    eventId = ev.id;
  }
  await audit(db, { actorId: s.userId, action: id ? "evento.editar" : "evento.criar", resourceType: "event", resourceId: eventId });
  if (env.GOOGLE_CALENDAR_MODE === "cms_to_google") await enqueue(db, "gcal.projetar", { eventId }, { dedupeKey: `gcal:${eventId}` });
  revalidatePath("/agenda", "layout");
  redirect(`/admin/eventos/${eventId}?ok=1`);
}

export async function publicarEvento(fd: FormData) {
  const s = await requireAdmin();
  const id = String(fd.get("id"));
  const [ev] = await db.select().from(event).where(eq(event.id, id));
  if (!ev) redirect("/admin/eventos");
  assertCan(s, "evento.gerenciar", { groupId: ev.groupId });
  const to = fd.get("publicar") === "1" ? "publicado" : "rascunho";
  await db.update(event).set({ publication: to, sequence: ev.sequence + 1, updatedAt: new Date() }).where(eq(event.id, id));
  await audit(db, { actorId: s.userId, action: to === "publicado" ? "evento.publicar" : "evento.despublicar", resourceType: "event", resourceId: id });
  if (env.GOOGLE_CALENDAR_MODE === "cms_to_google") await enqueue(db, "gcal.projetar", { eventId: id }, { dedupeKey: `gcal:${id}` });
  revalidatePath("/agenda", "layout");
  redirect(`/admin/eventos/${id}?ok=1`);
}

export async function fazerCheckin(fd: FormData) {
  const s = await requireAdmin();
  const id = String(fd.get("id"));
  const [ev] = await db.select({ groupId: event.groupId }).from(event).where(eq(event.id, id));
  try { assertCan(s, "evento.checkin", { groupId: ev?.groupId }); } catch (e) { if (e instanceof ForbiddenError) redirect(`/admin/eventos/${id}/checkin?r=negado`); throw e; }
  const raw = String(fd.get("codigo") ?? "").trim();
  const token = raw.includes("/inscricao/") ? raw.split("/inscricao/")[1].split(/[?#]/)[0] : raw;
  const r = await checkIn(db, id, token.slice(0, 64), s.userId);
  redirect(`/admin/eventos/${id}/checkin?r=${r.ok ? "ok" : r.reason}${r.ok ? `&n=${encodeURIComponent(r.name)}` : ""}`);
}
