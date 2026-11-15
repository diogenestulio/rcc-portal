"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireAdmin, requireCan } from "@/server/session";
import { ForbiddenError } from "@/server/authz";
import { InputError } from "@/server/errors";
import { createMinistry, editMinistry, setMinistryPublished } from "@/server/ministries";

const campos = (fd: FormData) => ({ name: String(fd.get("nome") ?? ""), summary: String(fd.get("resumo") ?? ""), description: String(fd.get("descricao") ?? "") });

async function tentar<T>(back: string, fn: () => Promise<T>): Promise<T> {
  try { return await fn(); }
  catch (e) {
    if (e instanceof InputError) redirect(`${back}?erro=${encodeURIComponent(e.message)}`);
    if (e instanceof ForbiddenError) redirect(`${back}?erro=${encodeURIComponent("Você não tem permissão para esta ação.")}`);
    throw e;
  }
}

export async function criarMinisterio(fd: FormData) {
  const s = await requireCan("ministerio.criar");
  const id = await tentar("/admin/ministerios/novo", () => createMinistry(db, s, campos(fd)));
  redirect(`/admin/ministerios/${id}?novo=1`);
}

export async function salvarMinisterio(fd: FormData) {
  const s = await requireAdmin();
  const id = String(fd.get("id"));
  await tentar(`/admin/ministerios/${id}`, () => editMinistry(db, s, id, campos(fd)));
  revalidatePath("/ministerios", "layout");
  redirect(`/admin/ministerios/${id}?ok=1`);
}

export async function publicarMinisterio(fd: FormData) {
  const s = await requireCan("ministerio.publicar");
  const id = String(fd.get("id"));
  await tentar(`/admin/ministerios/${id}`, () => setMinistryPublished(db, s, id, fd.get("publicar") === "1"));
  revalidatePath("/ministerios", "layout");
  redirect(`/admin/ministerios/${id}?ok=1`);
}
