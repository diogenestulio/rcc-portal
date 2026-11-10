import { eq } from "drizzle-orm";
import { db } from "@/db";
import { event, registration } from "@/db/schema";
import { currentSubject } from "@/server/session";
import { decide } from "@/server/authz";
import { audit } from "@/server/audit";

export const dynamic = "force-dynamic";

/** Neutraliza injeção de fórmula em planilhas (=, +, -, @ no início). */
const csv = (v: unknown) => {
  const s = String(v ?? "");
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** Exportação restrita (evento.exportar + reautenticação recente) e auditada. */
export async function GET(_req: Request, ctx: RouteContext<"/admin/eventos/[id]/participantes.csv">) {
  const s = await currentSubject();
  const { id } = await ctx.params;
  if (!s || !/^[0-9a-f-]{36}$/.test(id)) return new Response(null, { status: 404 });
  const [ev] = await db.select().from(event).where(eq(event.id, id));
  const d = decide(s, "evento.exportar", { groupId: ev?.groupId });
  if (!ev || !d.ok) {
    await audit(db, { actorId: s.userId, action: "evento.exportar", resourceType: "event", resourceId: id, result: "negado", detail: { motivo: d.ok ? "nao_encontrado" : d.reason } });
    return new Response(d.ok ? null : "Acesso negado. Se for reautenticação, saia e entre novamente.", { status: 403 });
  }
  const rows = await db.select().from(registration).where(eq(registration.eventId, id));
  await audit(db, { actorId: s.userId, action: "evento.exportar", resourceType: "event", resourceId: id, detail: { linhas: rows.length } });
  const lines = rows.map((r) => [r.fullName, r.email, r.phone, r.status, r.checkedInAt?.toISOString(), r.createdAt.toISOString()].map(csv).join(","));
  const body = ["nome,email,telefone,situacao,checkin,inscrito_em", ...lines].join("\r\n");
  return new Response("﻿" + body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="participantes-${ev.slug}.csv"`, "Cache-Control": "private, no-store" },
  });
}
