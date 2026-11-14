"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { env } from "@/lib/env";
import { requireAdmin } from "@/server/session";
import { ForbiddenError } from "@/server/authz";
import { deleteMedia, MediaError, privateLink, updateMediaInfo, uploadMedia } from "@/server/media";

export type MidiaState = null | { ok: true; msg: string; link?: string } | { ok: false; erro: string };

const falha = (e: unknown): MidiaState => {
  if (e instanceof MediaError) return { ok: false, erro: e.message };
  if (e instanceof ForbiddenError) return { ok: false, erro: "Você não tem permissão para gerenciar mídia." };
  throw e;
};

export async function enviarMidia(_p: MidiaState, fd: FormData): Promise<MidiaState> {
  const s = await requireAdmin();
  const file = fd.get("arquivo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, erro: "Escolha um arquivo." };
  try {
    await uploadMedia(db, s, {
      file: Buffer.from(await file.arrayBuffer()), fileName: file.name,
      altText: String(fd.get("alt") ?? ""), decorative: fd.get("decorativa") === "on",
      credit: String(fd.get("credito") ?? ""), imageRightsAuthorized: fd.get("autorizada") === "on",
      isPrivate: fd.get("privado") === "on",
    });
  } catch (e) { return falha(e); }
  revalidatePath("/admin/midia");
  return { ok: true, msg: "Arquivo enviado." };
}

export async function editarMidia(_p: MidiaState, fd: FormData): Promise<MidiaState> {
  const s = await requireAdmin();
  try {
    await updateMediaInfo(db, s, String(fd.get("id")), { altText: String(fd.get("alt") ?? ""), decorative: fd.get("decorativa") === "on", credit: String(fd.get("credito") ?? "") });
  } catch (e) { return falha(e); }
  revalidatePath("/admin/midia");
  return { ok: true, msg: "Salvo." };
}

export async function excluirMidia(_p: MidiaState, fd: FormData): Promise<MidiaState> {
  const s = await requireAdmin();
  try { await deleteMedia(db, s, String(fd.get("id"))); } catch (e) { return falha(e); }
  revalidatePath("/admin/midia");
  return { ok: true, msg: "Arquivo excluído." };
}

export async function linkPrivado(_p: MidiaState, fd: FormData): Promise<MidiaState> {
  const s = await requireAdmin();
  try {
    const path = await privateLink(db, s, String(fd.get("id")), env.APP_SIGNING_KEY, 3600);
    return { ok: true, msg: "Link válido por 1 hora:", link: `${env.APP_URL}${path}` };
  } catch (e) { return falha(e); }
}
