import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { DB } from "@/db";
import type { Assignment, Subject } from "@/server/authz";
import { randomUUID } from "node:crypto";

export function makeDb(max = 10) {
  const client = postgres(process.env.DATABASE_URL!, { max, onnotice: () => {} });
  return { db: drizzle(client, { schema }) as unknown as DB, client };
}

export async function reset(db: DB) {
  const rows = await db.execute<{ tablename: string }>(sql`select tablename from pg_tables where schemaname = 'public' and tablename not in ('audit_log')`);
  await db.execute(sql.raw(`truncate ${rows.map((r) => `"${r.tablename}"`).join(", ")} restart identity cascade`));
}

export async function makeUser(db: DB, name = "Usuário Teste") {
  const id = randomUUID();
  await db.insert(schema.user).values({ id, name, email: `${id}@teste.invalid`, emailVerified: true, twoFactorEnabled: true });
  return id;
}

export function subject(userId: string, assignments: Assignment[], extra: Partial<Subject> = {}): Subject {
  return { userId, assignments, mfa: true, recentAuthAt: new Date(), ...extra };
}
export const g = (role: Assignment["role"]): Assignment => ({ role, scopeType: "global", scopeId: null });

let n = 0;
export async function territory(db: DB) {
  n++;
  const [r] = await db.insert(schema.region).values({ name: `Região ${n}`, slug: `regiao-${n}` }).returning();
  const [m] = await db.insert(schema.municipality).values({ name: `Município ${n}`, slug: `municipio-${n}`, regionId: r.id }).returning();
  const [p] = await db.insert(schema.parish).values({ name: `Paróquia ${n}`, slug: `paroquia-${n}`, municipalityId: m.id, regionId: r.id }).returning();
  return { region: r, municipality: m, parish: p };
}

export async function makeGroup(db: DB, t: Awaited<ReturnType<typeof territory>>, over: Partial<typeof schema.prayerGroup.$inferInsert> = {}) {
  n++;
  const [grp] = await db.insert(schema.prayerGroup).values({
    name: `Grupo ${n}`, slug: `grupo-${n}`, parishId: t.parish.id, municipalityId: t.municipality.id, regionId: t.region.id,
    venue: "Salão paroquial", weekday: 4, startTime: "19:30", status: "ativo", published: true, lastConfirmedAt: new Date(), ...over,
  }).returning();
  return grp;
}

export async function makeEvent(db: DB, over: Partial<typeof schema.event.$inferInsert> = {}) {
  n++;
  const [ev] = await db.insert(schema.event).values({
    slug: `evento-${n}`, title: `Evento ${n}`, startsAt: new Date(Date.now() + 7 * 86_400_000), endsAt: new Date(Date.now() + 7 * 86_400_000 + 3 * 3_600_000),
    publication: "publicado", icalUid: `${randomUUID()}@teste`, registrationEnabled: true, ...over,
  }).returning();
  return ev;
}
