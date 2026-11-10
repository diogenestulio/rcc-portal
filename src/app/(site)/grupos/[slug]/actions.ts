"use server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { suggestCorrection } from "@/server/groups";
import { checkRate } from "@/server/ratelimit";

export async function sugerirCorrecao(fd: FormData) {
  const slug = String(fd.get("slug") ?? "").slice(0, 120);
  await checkRate("sugestao", 5, 3600);
  const email = String(fd.get("email") ?? "").trim();
  await suggestCorrection(db, slug, String(fd.get("mensagem") ?? ""), /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null);
  redirect(`/grupos/${encodeURIComponent(slug)}?enviado=1#corrigir`);
}
