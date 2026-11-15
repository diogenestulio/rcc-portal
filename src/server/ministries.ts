/**
 * Ministérios: o gestor cadastra e publica; o responsável local do ministério (papel com escopo
 * "ministerio") edita o texto do SEU ministério. Nada é apagado: ocultar tira do site.
 */
import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { ministry } from "@/db/schema";
import { assertCan, type Subject } from "./authz";
import { audit } from "./audit";
import { uniqueSlug } from "./slug";
import { InputError } from "./errors";

export type MinistryInput = { name: string; summary?: string | null; description?: string | null };

function clean(i: MinistryInput) {
  const name = i.name.trim().slice(0, 120);
  if (name.length < 3) throw new InputError("Informe o nome do ministério.");
  return { name, summary: i.summary?.trim().slice(0, 300) || null, description: i.description?.trim().slice(0, 6000) || null };
}

const slugTaken = (db: DB) => async (x: string) => (await db.select({ id: ministry.id }).from(ministry).where(eq(ministry.slug, x))).length > 0;

/** Nasce OCULTO: o gestor confere e publica. */
export async function createMinistry(db: DB, s: Subject, input: MinistryInput) {
  assertCan(s, "ministerio.criar");
  const v = clean(input);
  const [m] = await db.insert(ministry).values({ ...v, slug: await uniqueSlug(v.name, slugTaken(db)), published: false }).returning({ id: ministry.id });
  await audit(db, { actorId: s.userId, action: "ministerio.criar", resourceType: "ministry", resourceId: m.id });
  return m.id;
}

export async function editMinistry(db: DB, s: Subject, id: string, input: MinistryInput) {
  assertCan(s, "ministerio.editar", { ministryId: id });
  const [cur] = await db.select({ id: ministry.id }).from(ministry).where(eq(ministry.id, id));
  if (!cur) throw new InputError("Ministério não encontrado.");
  await db.update(ministry).set({ ...clean(input), updatedAt: new Date() }).where(eq(ministry.id, id));
  await audit(db, { actorId: s.userId, action: "ministerio.editar", resourceType: "ministry", resourceId: id });
}

export async function setMinistryPublished(db: DB, s: Subject, id: string, published: boolean) {
  assertCan(s, "ministerio.publicar");
  await db.update(ministry).set({ published, updatedAt: new Date() }).where(eq(ministry.id, id));
  await audit(db, { actorId: s.userId, action: published ? "ministerio.publicar" : "ministerio.ocultar", resourceType: "ministry", resourceId: id });
}
