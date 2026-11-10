"use server";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { session } from "@/db/schema";
import { requireAdmin } from "@/server/session";
import { audit } from "@/server/audit";

/** Encerra todas as sessões da própria pessoa, menos a atual (ex.: esqueceu logado num computador da paróquia). */
export async function encerrarOutrasSessoes() {
  const s = await requireAdmin();
  const r = await db.delete(session).where(and(eq(session.userId, s.userId), ne(session.id, s.sessionId))).returning({ id: session.id });
  await audit(db, { actorId: s.userId, action: "conta.encerrar_outras_sessoes", resourceType: "user", resourceId: s.userId, detail: { sessoesEncerradas: r.length } });
  redirect("/admin/conta?ok=1");
}
