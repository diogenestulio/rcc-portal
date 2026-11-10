import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { roleAssignment, user } from "@/db/schema";
import { assertCan, decide, ForbiddenError, type Action, type ResourceScope, type Subject } from "./authz";
import { audit } from "./audit";

export type AdminSubject = Subject & { name: string; email: string };

export async function currentSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Sujeito autenticado para autorização no servidor (papéis lidos do banco a cada requisição). */
export async function currentSubject(): Promise<AdminSubject | null> {
  const s = await currentSession();
  if (!s) return null;
  const [u] = await db.select({ active: user.active, twoFactorEnabled: user.twoFactorEnabled }).from(user).where(eq(user.id, s.user.id));
  if (!u?.active) return null;
  const assignments = await db.select({ role: roleAssignment.role, scopeType: roleAssignment.scopeType, scopeId: roleAssignment.scopeId })
    .from(roleAssignment).where(eq(roleAssignment.userId, s.user.id));
  return { userId: s.user.id, name: s.user.name, email: s.user.email, assignments, mfa: !!u.twoFactorEnabled, recentAuthAt: new Date(s.session.createdAt) };
}

/** Páginas do painel: exige login, MFA ativo e ao menos um papel. */
export async function requireAdmin(): Promise<AdminSubject> {
  const s = await currentSubject();
  if (!s) redirect("/entrar");
  if (!s.mfa) redirect("/entrar/mfa");
  if (s.assignments.length === 0) redirect("/entrar?sem_papel=1");
  return s;
}

export async function requireCan(action: Action, resource?: ResourceScope) {
  const s = await requireAdmin();
  try { assertCan(s, action, resource); }
  catch (e) {
    if (e instanceof ForbiddenError) await audit(db, { actorId: s.userId, action, resourceType: "autorizacao", result: "negado", detail: { motivo: e.reason } });
    throw e;
  }
  return s;
}

export function canView(s: Subject, action: Action, resource?: ResourceScope) {
  return decide(s, action, resource).ok;
}
