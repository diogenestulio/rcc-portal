"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { groupCorrection, groupPrivateContact, prayerGroup } from "@/db/schema";
import { requireAdmin, requireCan } from "@/server/session";
import { decide } from "@/server/authz";
import { confirmGroup, createGroup, editGroup, parseCoord } from "@/server/groups";
import { ForbiddenError } from "@/server/authz";
import { InputError } from "@/server/errors";
import { audit } from "@/server/audit";

const STATUS = ["ativo", "pausado", "encerrado", "a_confirmar"] as const;

export async function salvarGrupo(fd: FormData) {
  const s = await requireAdmin();
  const id = String(fd.get("id"));
  const weekday = Number(fd.get("dia"));
  const status = String(fd.get("situacao")) as (typeof STATUS)[number];
  const time = (v: FormDataEntryValue | null) => (/^\d{2}:\d{2}$/.test(String(v)) ? String(v) : null);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !STATUS.includes(status) || !time(fd.get("inicio"))) redirect(`/admin/grupos/${id}?erro=1`);
  let latitude: string | null, longitude: string | null;
  try {
    latitude = parseCoord(fd.get("latitude") as string, "lat");
    longitude = parseCoord(fd.get("longitude") as string, "lng");
    if ((latitude == null) !== (longitude == null)) throw new Error("Informe latitude e longitude juntas (ou deixe as duas vazias).");
  } catch (e) {
    redirect(`/admin/grupos/${id}?erro=coord&msg=${encodeURIComponent((e as Error).message)}`);
  }
  await editGroup(db, s, id, {
    name: String(fd.get("nome")).trim().slice(0, 120), venue: String(fd.get("local")).trim().slice(0, 200),
    publicAddress: String(fd.get("endereco") ?? "").trim().slice(0, 300) || null, weekday, startTime: time(fd.get("inicio"))!, endTime: time(fd.get("fim")),
    accessibilityInfo: String(fd.get("acessibilidade") ?? "").trim().slice(0, 300) || null, description: String(fd.get("descricao") ?? "").trim().slice(0, 2000) || null,
    publicContact: String(fd.get("contato_publico") ?? "").trim().slice(0, 200) || null, status, latitude, longitude,
  });
  // Contato privado: só quem tem grupo.contato_privado no escopo
  const [g] = await db.select({ regionId: prayerGroup.regionId }).from(prayerGroup).where(eq(prayerGroup.id, id));
  if (!decide(s, "grupo.contato_privado", { groupId: id, regionId: g.regionId }).ok) { revalidatePath("/grupos", "layout"); redirect(`/admin/grupos/${id}?ok=1`); }
  const auth = fd.get("autoriza_telefone") === "on";
  await db.insert(groupPrivateContact).values({
    groupId: id, coordinatorName: String(fd.get("coord_nome") ?? "").slice(0, 120) || null, coordinatorPhone: String(fd.get("coord_tel") ?? "").slice(0, 30) || null,
    coordinatorEmail: String(fd.get("coord_email") ?? "").slice(0, 200) || null, phonePublicationAuthorized: auth, authorizationRecordedAt: auth ? new Date() : null,
  }).onConflictDoUpdate({ target: groupPrivateContact.groupId, set: {
    coordinatorName: String(fd.get("coord_nome") ?? "").slice(0, 120) || null, coordinatorPhone: String(fd.get("coord_tel") ?? "").slice(0, 30) || null,
    coordinatorEmail: String(fd.get("coord_email") ?? "").slice(0, 200) || null, phonePublicationAuthorized: auth, updatedAt: new Date(),
  } });
  revalidatePath("/grupos", "layout");
  redirect(`/admin/grupos/${id}?ok=1`);
}

export async function confirmar(fd: FormData) {
  const s = await requireAdmin();
  const id = String(fd.get("id"));
  await confirmGroup(db, s, id);
  revalidatePath("/grupos", "layout");
  redirect(`/admin/grupos/${id}?ok=1`);
}

export async function publicar(fd: FormData) {
  const s = await requireCan("grupo.publicar");
  const id = String(fd.get("id"));
  const pub = fd.get("publicar") === "1";
  await db.update(prayerGroup).set({ published: pub, updatedAt: new Date() }).where(eq(prayerGroup.id, id));
  await audit(db, { actorId: s.userId, action: pub ? "grupo.publicar" : "grupo.despublicar", resourceType: "prayer_group", resourceId: id });
  revalidatePath("/grupos", "layout");
  redirect(`/admin/grupos/${id}?ok=1`);
}

export async function moderar(fd: FormData) {
  const s = await requireCan("grupo.moderar_correcoes");
  const id = String(fd.get("id"));
  const d = fd.get("decisao") === "aceita" ? "aceita" : "rejeitada";
  await db.update(groupCorrection).set({ status: d, moderatedBy: s.userId, moderatedAt: new Date() }).where(eq(groupCorrection.id, id));
  await audit(db, { actorId: s.userId, action: `grupo.correcao_${d}`, resourceType: "group_correction", resourceId: id });
  redirect("/admin/grupos?ok=1#correcoes");
}

/** Cadastro de grupo novo: nasce oculto e "a confirmar"; abre a edição para completar e publicar. */
export async function criarGrupo(fd: FormData) {
  const s = await requireCan("grupo.criar");
  const txt = (k: string) => String(fd.get(k) ?? "").trim();
  const par = txt("paroquia");
  const mun = txt("municipio");
  let id: string;
  try {
    id = await createGroup(db, s, {
      name: txt("nome"), venue: txt("local"), weekday: Number(txt("dia")), startTime: txt("inicio"), endTime: txt("fim") || null,
      parishId: par && par !== "nova" ? par : null,
      newParish: par === "nova" ? { name: txt("nova_paroquia"), municipalityId: mun && mun !== "novo" ? mun : null, newMunicipality: mun === "novo" ? txt("novo_municipio") : null, regionId: txt("regiao") || null } : null,
    });
  } catch (e) {
    if (e instanceof InputError) redirect(`/admin/grupos/novo?erro=${encodeURIComponent(e.message)}`);
    if (e instanceof ForbiddenError) redirect(`/admin/grupos/novo?erro=${encodeURIComponent("Você não tem permissão para esta ação.")}`);
    throw e;
  }
  redirect(`/admin/grupos/${id}?novo=1`);
}
