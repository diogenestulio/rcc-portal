/**
 * Grupos de Oração — busca pública sem login e sem geolocalização obrigatória.
 * Só grupos publicados aparecem. Dados privados do coordenador NUNCA entram nesta consulta.
 */
import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import type { DB } from "@/db";
import { groupCorrection, groupPrivateContact, municipality, parish, prayerGroup, region } from "@/db/schema";
import { assertCan, type Subject } from "./authz";
import { audit } from "./audit";

export const STALE_DAYS = 180;
export type Period = "manha" | "tarde" | "noite";
export type GroupFilters = { municipio?: string; paroquia?: string; dia?: number; periodo?: Period; regiao?: string; q?: string; page?: number };

const PERIODS: Record<Period, [string, string | null]> = { manha: ["00:00", "12:00"], tarde: ["12:00", "18:00"], noite: ["18:00", null] };

export function parseGroupFilters(sp: Record<string, string | string[] | undefined>): GroupFilters {
  const one = (k: string) => { const v = sp[k]; return (Array.isArray(v) ? v[0] : v)?.slice(0, 80) || undefined; };
  const dia = one("dia");
  const periodo = one("periodo");
  const page = Number(one("pagina") ?? 1);
  return {
    municipio: one("municipio"), paroquia: one("paroquia"), regiao: one("regiao"), q: one("q"),
    dia: dia !== undefined && /^[0-6]$/.test(dia) ? Number(dia) : undefined,
    periodo: periodo && periodo in PERIODS ? (periodo as Period) : undefined,
    page: Number.isInteger(page) && page > 0 && page < 1000 ? page : 1,
  };
}

function escapeLike(s: string) { return s.replace(/[\\%_]/g, (c) => "\\" + c); }

export async function searchGroups(db: DB, f: GroupFilters, pageSize = 20) {
  const where: SQL[] = [eq(prayerGroup.published, true), sql`${prayerGroup.status} <> 'encerrado'`];
  if (f.municipio) where.push(eq(municipality.slug, f.municipio));
  if (f.paroquia) where.push(eq(parish.slug, f.paroquia));
  if (f.regiao) where.push(eq(region.slug, f.regiao));
  if (f.dia !== undefined) where.push(eq(prayerGroup.weekday, f.dia));
  if (f.periodo) {
    const [a, b] = PERIODS[f.periodo];
    where.push(b ? sql`${prayerGroup.startTime} >= ${a}::time and ${prayerGroup.startTime} < ${b}::time` : sql`${prayerGroup.startTime} >= ${a}::time`);
  }
  if (f.q) where.push(sql`f_unaccent(${prayerGroup.name} || ' ' || ${parish.name} || ' ' || ${prayerGroup.venue}) ilike f_unaccent(${"%" + escapeLike(f.q) + "%"})`);
  const page = f.page ?? 1;
  const rows = await db.select({
    id: prayerGroup.id, slug: prayerGroup.slug, name: prayerGroup.name, venue: prayerGroup.venue, weekday: prayerGroup.weekday,
    startTime: prayerGroup.startTime, endTime: prayerGroup.endTime, status: prayerGroup.status, lastConfirmedAt: prayerGroup.lastConfirmedAt,
    isDemo: prayerGroup.isDemo, parish: parish.name, municipality: municipality.name, region: region.name,
    total: sql<number>`count(*) over()::int`,
  }).from(prayerGroup)
    .innerJoin(parish, eq(parish.id, prayerGroup.parishId))
    .innerJoin(municipality, eq(municipality.id, prayerGroup.municipalityId))
    .leftJoin(region, eq(region.id, prayerGroup.regionId))
    .where(and(...where))
    .orderBy(asc(municipality.name), asc(prayerGroup.weekday), asc(prayerGroup.startTime), asc(prayerGroup.name))
    .limit(pageSize).offset((page - 1) * pageSize);
  return { rows, total: rows[0]?.total ?? 0, page, pageSize };
}

export function isStale(lastConfirmedAt: Date | null, now = new Date()) {
  return !lastConfirmedAt || now.getTime() - lastConfirmedAt.getTime() > STALE_DAYS * 86_400_000;
}

export async function getPublicGroup(db: DB, slug: string) {
  const [g] = await db.select({
    id: prayerGroup.id, slug: prayerGroup.slug, name: prayerGroup.name, venue: prayerGroup.venue, publicAddress: prayerGroup.publicAddress,
    weekday: prayerGroup.weekday, startTime: prayerGroup.startTime, endTime: prayerGroup.endTime, accessibilityInfo: prayerGroup.accessibilityInfo,
    description: prayerGroup.description, publicContact: prayerGroup.publicContact, status: prayerGroup.status, lastConfirmedAt: prayerGroup.lastConfirmedAt,
    latitude: prayerGroup.latitude, longitude: prayerGroup.longitude, isDemo: prayerGroup.isDemo,
    parish: parish.name, municipality: municipality.name, municipalitySlug: municipality.slug, region: region.name,
  }).from(prayerGroup).innerJoin(parish, eq(parish.id, prayerGroup.parishId)).innerJoin(municipality, eq(municipality.id, prayerGroup.municipalityId))
    .leftJoin(region, eq(region.id, prayerGroup.regionId)).where(and(eq(prayerGroup.slug, slug), eq(prayerGroup.published, true)));
  if (!g) return null;
  // Telefone pessoal só é público com autorização registrada.
  const [pc] = await db.select({ phone: groupPrivateContact.coordinatorPhone, ok: groupPrivateContact.phonePublicationAuthorized })
    .from(groupPrivateContact).where(eq(groupPrivateContact.groupId, g.id));
  return { ...g, authorizedPhone: pc?.ok ? pc.phone : null };
}

export async function filterOptions(db: DB) {
  const [m, p, r] = await Promise.all([
    db.execute<{ slug: string; name: string }>(sql`select distinct m.slug, m.name from municipality m join prayer_group g on g.municipality_id = m.id and g.published order by m.name`),
    db.execute<{ slug: string; name: string; municipality: string }>(sql`select distinct p.slug, p.name, m.slug as municipality from parish p join prayer_group g on g.parish_id = p.id and g.published join municipality m on m.id = p.municipality_id order by p.name`),
    db.execute<{ slug: string; name: string }>(sql`select distinct r.slug, r.name, r.sort_order from region r join prayer_group g on g.region_id = r.id and g.published order by r.sort_order, r.name`),
  ]);
  return { municipios: [...m], paroquias: [...p], regioes: [...r] };
}

/** Sugestão de correção de visitante: entra na fila de moderação, nunca altera o grupo. */
export async function suggestCorrection(db: DB, groupSlug: string, message: string, contactEmail?: string | null) {
  const msg = message.trim();
  if (msg.length < 10 || msg.length > 2000) throw new Error("Descreva a correção (10 a 2000 caracteres).");
  const [g] = await db.select({ id: prayerGroup.id }).from(prayerGroup).where(and(eq(prayerGroup.slug, groupSlug), eq(prayerGroup.published, true)));
  if (!g) throw new Error("Grupo não encontrado.");
  await db.insert(groupCorrection).values({ groupId: g.id, message: msg, contactEmail: contactEmail?.trim() || null });
}

export type GroupEdit = Partial<Pick<typeof prayerGroup.$inferInsert, "name" | "venue" | "publicAddress" | "weekday" | "startTime" | "endTime" | "accessibilityInfo" | "description" | "publicContact" | "status">>;

async function loadScope(db: DB, groupId: string) {
  const [g] = await db.select({ id: prayerGroup.id, regionId: prayerGroup.regionId }).from(prayerGroup).where(eq(prayerGroup.id, groupId));
  if (!g) throw new Error("Grupo não encontrado.");
  return { groupId: g.id, regionId: g.regionId };
}

/** Edição por responsável local: somente grupos do seu escopo; o servidor verifica sempre. */
export async function editGroup(db: DB, s: Subject, groupId: string, changes: GroupEdit) {
  assertCan(s, "grupo.editar", await loadScope(db, groupId));
  await db.update(prayerGroup).set({ ...changes, updatedAt: new Date() }).where(eq(prayerGroup.id, groupId));
  await audit(db, { actorId: s.userId, action: "grupo.editar", resourceType: "prayer_group", resourceId: groupId, detail: { campos: Object.keys(changes) } });
}

export async function confirmGroup(db: DB, s: Subject, groupId: string) {
  assertCan(s, "grupo.editar", await loadScope(db, groupId));
  await db.update(prayerGroup).set({ lastConfirmedAt: new Date(), lastConfirmedBy: s.userId, status: "ativo" }).where(eq(prayerGroup.id, groupId));
  await audit(db, { actorId: s.userId, action: "grupo.confirmar", resourceType: "prayer_group", resourceId: groupId });
}

export async function getPrivateContact(db: DB, s: Subject, groupId: string) {
  assertCan(s, "grupo.contato_privado", await loadScope(db, groupId));
  const [pc] = await db.select().from(groupPrivateContact).where(eq(groupPrivateContact.groupId, groupId));
  return pc ?? null;
}

/** Lembretes internos: grupos publicados sem confirmação recente. */
export async function staleGroups(db: DB, now = new Date()) {
  return db.execute<{ id: string; name: string; last_confirmed_at: Date | null }>(sql`
    select id, name, last_confirmed_at from prayer_group where published and status <> 'encerrado'
      and (last_confirmed_at is null or last_confirmed_at < ${now.toISOString()}::timestamptz - make_interval(days => ${STALE_DAYS}))
    order by last_confirmed_at nulls first`);
}
