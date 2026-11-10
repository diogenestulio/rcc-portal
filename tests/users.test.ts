// Gestão de usuários: anti-escalada, último gestor, sessões encerradas, senha provisória (caso de aceite 12).
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { verifyPassword } from "better-auth/crypto";
import { makeDb, makeGroup, makeUser, reset, subject, territory, g } from "./helpers";
import { createUser, grantRole, listUsers, resetMfa, resetPassword, revokeRole, revokeSessions, setActive, UserAdminError } from "@/server/users";
import { ForbiddenError } from "@/server/authz";
import { account, roleAssignment, session, twoFactor, user } from "@/db/schema";

const { db, client } = makeDb();
afterAll(() => client.end());
beforeEach(() => reset(db));

async function gestor() {
  const id = await makeUser(db, "Gestor");
  await db.insert(roleAssignment).values({ userId: id, role: "gestor_institucional", scopeType: "global" });
  return subject(id, [g("gestor_institucional")]);
}
async function addSession(userId: string) {
  await db.insert(session).values({ id: crypto.randomUUID(), token: crypto.randomUUID(), userId, expiresAt: new Date(Date.now() + 3_600_000) });
}

describe("usuários e papéis", () => {
  it("cria conta com senha provisória válida, troca obrigatória e e-mail único", async () => {
    const s = await gestor();
    const r = await createUser(db, s, { name: "Maria Servidora", email: "Maria@Teste.invalid" });
    expect(r.tempPassword).toMatch(/^[a-zA-Z2-9]{16}$/);
    const [u] = await db.select().from(user).where(eq(user.id, r.userId));
    expect(u).toMatchObject({ email: "maria@teste.invalid", mustChangePassword: true, active: true });
    const [a] = await db.select().from(account).where(eq(account.userId, r.userId));
    expect(await verifyPassword({ hash: a.password!, password: r.tempPassword })).toBe(true);
    await expect(createUser(db, s, { name: "Outra Pessoa", email: "maria@teste.invalid" })).rejects.toBeInstanceOf(UserAdminError);
  });

  it("só quem tem usuarios.gerenciar cria contas; papéis exigem papeis.conceder e reautenticação recente", async () => {
    const editor = subject(await makeUser(db), [g("editor")]);
    await expect(createUser(db, editor, { name: "Xxx Yyy", email: "x@teste.invalid" })).rejects.toBeInstanceOf(ForbiddenError);
    const tecnico = subject(await makeUser(db), [g("admin_tecnico")]);
    const alvo = await makeUser(db);
    await expect(grantRole(db, tecnico, { userId: alvo, role: "revisor", scopeType: "global", scopeId: null })).rejects.toBeInstanceOf(ForbiddenError);
    const velho = { ...(await gestor()), recentAuthAt: new Date(Date.now() - 3_600_000) };
    await expect(grantRole(db, velho, { userId: alvo, role: "revisor", scopeType: "global", scopeId: null })).rejects.toMatchObject({ reason: "reautenticar" });
  });

  it("anti-escalada: ninguém altera os próprios papéis, conta ou MFA", async () => {
    const s = await gestor();
    await expect(grantRole(db, s, { userId: s.userId, role: "intercessor", scopeType: "global", scopeId: null })).rejects.toThrow(/própria conta/);
    await expect(setActive(db, s, s.userId, false)).rejects.toThrow(/própria conta/);
    await expect(resetMfa(db, s, s.userId)).rejects.toThrow(/própria conta/);
    await expect(resetPassword(db, s, s.userId)).rejects.toThrow(/própria conta/);
    const [ra] = await db.select().from(roleAssignment).where(eq(roleAssignment.userId, s.userId));
    await expect(revokeRole(db, s, ra.id)).rejects.toThrow(/própria conta/);
  });

  it("sempre resta um gestor institucional ativo", async () => {
    const a = await gestor();
    const b = await gestor();
    // b desativa a: ok (b continua)
    await setActive(db, b, a.userId, false);
    // a reativado por b; agora a tenta tirar o papel de b enquanto b é o único outro... ambos ativos → permitido
    await setActive(db, b, a.userId, true);
    const [rb] = await db.select().from(roleAssignment).where(eq(roleAssignment.userId, b.userId));
    await revokeRole(db, a, rb.id);
    // agora a é o último gestor: b (sem papel de gestor) não consegue agir; e não há como remover a
    const [ra] = await db.select().from(roleAssignment).where(eq(roleAssignment.userId, a.userId));
    const c = await gestor();
    await db.delete(roleAssignment).where(eq(roleAssignment.userId, c.userId)); // c perde o papel no banco, mas a sessão "antiga" ainda o declara
    await expect(revokeRole(db, c, ra.id)).rejects.toThrow(/ao menos um gestor/);
    await expect(setActive(db, c, a.userId, false)).rejects.toThrow(/última conta de gestor/);
  });

  it("desativar, redefinir senha e zerar MFA encerram as sessões", async () => {
    const s = await gestor();
    const alvo = await makeUser(db);
    await db.insert(twoFactor).values({ id: crypto.randomUUID(), userId: alvo, secret: "x", backupCodes: "y" });
    await addSession(alvo); await addSession(alvo);
    await resetMfa(db, s, alvo);
    expect(await db.select().from(session).where(eq(session.userId, alvo))).toHaveLength(0);
    expect(await db.select().from(twoFactor).where(eq(twoFactor.userId, alvo))).toHaveLength(0);
    expect((await db.select().from(user).where(eq(user.id, alvo)))[0].twoFactorEnabled).toBe(false);
    await addSession(alvo);
    await setActive(db, s, alvo, false);
    expect(await db.select().from(session).where(eq(session.userId, alvo))).toHaveLength(0);
    await setActive(db, s, alvo, true);
    await addSession(alvo);
    expect(await revokeSessions(db, s, alvo)).toBe(1);
  });

  it("papéis com escopo só para responsável local e gestor de eventos, com alvo existente", async () => {
    const s = await gestor();
    const alvo = await makeUser(db);
    const t = await territory(db);
    const grp = await makeGroup(db, t);
    await expect(grantRole(db, s, { userId: alvo, role: "editor", scopeType: "grupo", scopeId: grp.id })).rejects.toThrow(/só pode ser global/);
    await expect(grantRole(db, s, { userId: alvo, role: "responsavel_local", scopeType: "global", scopeId: null })).rejects.toThrow(/precisa de um grupo/);
    await expect(grantRole(db, s, { userId: alvo, role: "responsavel_local", scopeType: "grupo", scopeId: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow(/não encontrado/);
    await grantRole(db, s, { userId: alvo, role: "responsavel_local", scopeType: "grupo", scopeId: grp.id });
    await expect(grantRole(db, s, { userId: alvo, role: "responsavel_local", scopeType: "grupo", scopeId: grp.id })).rejects.toThrow(/já tem/);
    const list = await listUsers(db, s);
    expect(list.find((u) => u.id === alvo)?.roles[0]).toMatchObject({ role: "responsavel_local", scope_name: grp.name });
  });
});
