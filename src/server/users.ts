/**
 * Gestão de usuários e papéis (painel). Regras (tests/users.test.ts):
 *  - Cadastro público continua desligado: só a administração cria contas, com SENHA PROVISÓRIA
 *    mostrada uma única vez; o painel exige trocá-la no primeiro acesso.
 *  - Anti-escalada: ninguém concede, revoga, desativa ou zera o MFA de si mesmo por aqui.
 *  - Sempre resta ao menos um gestor institucional ativo.
 *  - Desativar, redefinir senha ou zerar MFA encerra todas as sessões da pessoa.
 *  - Papéis com escopo (grupo/região/ministério) só para responsável local e gestor de eventos.
 *  - Tudo auditado; senhas nunca vão para a auditoria.
 */
import { and, eq, sql } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { DB, Tx } from "@/db";
import { account, ministry, prayerGroup, region, roleAssignment, session, twoFactor, user } from "@/db/schema";
import { assertCan, type Role, type ScopeType, type Subject } from "./authz";
import { audit } from "./audit";

export class UserAdminError extends Error {}

export const ROLE_LABEL: Record<Role, string> = {
  admin_tecnico: "Administrador técnico", gestor_institucional: "Gestor institucional", editor: "Editor",
  revisor: "Revisor editorial/doutrinal", gestor_eventos: "Gestor de eventos", operador_loja: "Operador da loja",
  responsavel_local: "Responsável por grupo/ministério", intercessor: "Intercessor",
};
const SCOPABLE: ReadonlySet<Role> = new Set<Role>(["responsavel_local", "gestor_eventos"]);

/** Senha provisória legível (sem caracteres ambíguos), 16 caracteres ≈ 90 bits. */
export function tempPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function notSelf(s: Subject, userId: string, what: string) {
  if (s.userId === userId) throw new UserAdminError(`Por segurança, você não pode ${what} a sua própria conta por aqui.`);
}

async function activeManagers(tx: DB | Tx, exceptUser?: string, exceptAssignment?: string) {
  const [{ n }] = await tx.execute<{ n: number }>(sql`
    select count(distinct ra.user_id)::int as n from role_assignment ra join "user" u on u.id = ra.user_id
    where ra.role = 'gestor_institucional' and ra.scope_type = 'global' and u.active
      ${exceptUser ? sql`and ra.user_id <> ${exceptUser}` : sql``}
      ${exceptAssignment ? sql`and ra.id <> ${exceptAssignment}` : sql``}`);
  return n;
}

async function killSessions(tx: DB | Tx, userId: string) {
  const r = await tx.delete(session).where(eq(session.userId, userId)).returning({ id: session.id });
  return r.length;
}

export async function listUsers(db: DB, s: Subject) {
  assertCan(s, "usuarios.gerenciar");
  const users = await db.execute<{ id: string; name: string; email: string; active: boolean; mfa: boolean; must_change: boolean; created_at: Date; sessions: number; last_seen: Date | null }>(sql`
    select u.id, u.name, u.email, u.active, coalesce(u.two_factor_enabled, false) as mfa, u.must_change_password as must_change, u.created_at,
      (select count(*)::int from session x where x.user_id = u.id and x.expires_at > now()) as sessions,
      (select max(x.updated_at) from session x where x.user_id = u.id) as last_seen
    from "user" u where u.id <> 'seed-demo' order by u.active desc, u.name`);
  const roles = await db.execute<{ id: string; user_id: string; role: Role; scope_type: ScopeType; scope_id: string | null; scope_name: string | null }>(sql`
    select ra.id, ra.user_id, ra.role, ra.scope_type, ra.scope_id,
      coalesce(g.name, r.name, m.name) as scope_name
    from role_assignment ra
    left join prayer_group g on ra.scope_type = 'grupo' and g.id = ra.scope_id
    left join region r on ra.scope_type = 'regiao' and r.id = ra.scope_id
    left join ministry m on ra.scope_type = 'ministerio' and m.id = ra.scope_id
    order by ra.role`);
  return users.map((u) => ({ ...u, roles: roles.filter((r) => r.user_id === u.id) }));
}

export async function createUser(db: DB, s: Subject, input: { name: string; email: string }) {
  assertCan(s, "usuarios.gerenciar");
  const name = input.name.trim().replace(/\s+/g, " ");
  const email = input.email.trim().toLowerCase();
  if (name.length < 3 || name.length > 120) throw new UserAdminError("Informe o nome completo.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw new UserAdminError("E-mail inválido.");
  const pw = tempPassword();
  const hash = await hashPassword(pw);
  const id = randomUUID();
  await db.transaction(async (tx) => {
    const [exists] = await tx.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (exists) throw new UserAdminError("Já existe uma conta com este e-mail.");
    await tx.insert(user).values({ id, name, email, emailVerified: true, active: true, mustChangePassword: true });
    await tx.insert(account).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: hash });
    await audit(tx, { actorId: s.userId, action: "usuario.criar", resourceType: "user", resourceId: id });
  });
  return { userId: id, tempPassword: pw };
}

export async function resetPassword(db: DB, s: Subject, userId: string) {
  assertCan(s, "usuarios.gerenciar");
  notSelf(s, userId, "redefinir a senha de");
  const pw = tempPassword();
  const hash = await hashPassword(pw);
  await db.transaction(async (tx) => {
    const r = await tx.update(account).set({ password: hash, updatedAt: new Date() })
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential"))).returning({ id: account.id });
    if (!r.length) throw new UserAdminError("Conta não encontrada.");
    await tx.update(user).set({ mustChangePassword: true, updatedAt: new Date() }).where(eq(user.id, userId));
    const n = await killSessions(tx, userId);
    await audit(tx, { actorId: s.userId, action: "usuario.redefinir_senha", resourceType: "user", resourceId: userId, detail: { sessoesEncerradas: n } });
  });
  return pw;
}

export async function setActive(db: DB, s: Subject, userId: string, active: boolean) {
  assertCan(s, "usuarios.gerenciar");
  notSelf(s, userId, active ? "reativar" : "desativar");
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7243002)`); // serializa a checagem do "último gestor"
    if (!active && (await activeManagers(tx, userId)) === 0) throw new UserAdminError("Esta é a última conta de gestor institucional ativa.");
    const r = await tx.update(user).set({ active, updatedAt: new Date() }).where(eq(user.id, userId)).returning({ id: user.id });
    if (!r.length) throw new UserAdminError("Conta não encontrada.");
    const n = active ? 0 : await killSessions(tx, userId);
    await audit(tx, { actorId: s.userId, action: active ? "usuario.reativar" : "usuario.desativar", resourceType: "user", resourceId: userId, detail: { sessoesEncerradas: n } });
  });
}

export async function revokeSessions(db: DB, s: Subject, userId: string) {
  assertCan(s, "usuarios.gerenciar");
  const n = await killSessions(db, userId);
  await audit(db, { actorId: s.userId, action: "usuario.encerrar_sessoes", resourceType: "user", resourceId: userId, detail: { sessoesEncerradas: n } });
  return n;
}

/** Para quem perdeu o aplicativo autenticador e os códigos de recuperação. */
export async function resetMfa(db: DB, s: Subject, userId: string) {
  assertCan(s, "usuarios.gerenciar");
  notSelf(s, userId, "zerar a verificação em duas etapas de");
  await db.transaction(async (tx) => {
    await tx.delete(twoFactor).where(eq(twoFactor.userId, userId));
    await tx.update(user).set({ twoFactorEnabled: false, updatedAt: new Date() }).where(eq(user.id, userId));
    const n = await killSessions(tx, userId);
    await audit(tx, { actorId: s.userId, action: "usuario.zerar_mfa", resourceType: "user", resourceId: userId, detail: { sessoesEncerradas: n } });
  });
}

export async function grantRole(db: DB, s: Subject, input: { userId: string; role: Role; scopeType: ScopeType; scopeId: string | null }) {
  assertCan(s, "papeis.conceder");
  notSelf(s, input.userId, "alterar os papéis de");
  if (!(input.role in ROLE_LABEL)) throw new UserAdminError("Papel inválido.");
  const scoped = input.scopeType !== "global";
  if (scoped && !SCOPABLE.has(input.role)) throw new UserAdminError("Este papel só pode ser global.");
  if (input.role === "responsavel_local" && !scoped) throw new UserAdminError("Responsável local precisa de um grupo, região ou ministério.");
  if (scoped) {
    if (!input.scopeId || !/^[0-9a-f-]{36}$/.test(input.scopeId)) throw new UserAdminError("Escolha o grupo, a região ou o ministério.");
    const table = input.scopeType === "grupo" ? prayerGroup : input.scopeType === "regiao" ? region : ministry;
    const [t] = await db.select({ id: table.id }).from(table).where(eq(table.id, input.scopeId));
    if (!t) throw new UserAdminError("Escopo não encontrado.");
  }
  const [u] = await db.select({ id: user.id, active: user.active }).from(user).where(eq(user.id, input.userId));
  if (!u?.active) throw new UserAdminError("Conta não encontrada ou desativada.");
  const r = await db.insert(roleAssignment).values({ userId: input.userId, role: input.role, scopeType: input.scopeType, scopeId: scoped ? input.scopeId : null, grantedBy: s.userId })
    .onConflictDoNothing().returning({ id: roleAssignment.id });
  if (!r.length) throw new UserAdminError("Esta pessoa já tem este papel neste escopo.");
  await audit(db, { actorId: s.userId, action: "papel.conceder", resourceType: "user", resourceId: input.userId, detail: { papel: input.role, escopo: input.scopeType, escopoId: input.scopeId } });
}

export async function revokeRole(db: DB, s: Subject, assignmentId: string) {
  assertCan(s, "papeis.conceder");
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7243002)`);
    const [ra] = await tx.select().from(roleAssignment).where(eq(roleAssignment.id, assignmentId));
    if (!ra) throw new UserAdminError("Papel não encontrado.");
    notSelf(s, ra.userId, "alterar os papéis de");
    if (ra.role === "gestor_institucional" && ra.scopeType === "global" && (await activeManagers(tx, undefined, ra.id)) === 0) {
      throw new UserAdminError("É preciso manter ao menos um gestor institucional ativo.");
    }
    await tx.delete(roleAssignment).where(eq(roleAssignment.id, assignmentId));
    await audit(tx, { actorId: s.userId, action: "papel.revogar", resourceType: "user", resourceId: ra.userId, detail: { papel: ra.role, escopo: ra.scopeType } });
  });
}

/** Chamado depois que a própria pessoa troca a senha provisória. */
export async function markPasswordChanged(db: DB, userId: string) {
  await db.update(user).set({ mustChangePassword: false, updatedAt: new Date() }).where(eq(user.id, userId));
  await audit(db, { actorId: userId, action: "usuario.trocar_senha", resourceType: "user", resourceId: userId });
}
