// Minimização de IP: o login real (biblioteca de autenticação) não grava IP em claro
// nem na sessão nem no limitador de tentativas, e o limitador continua bloqueando.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { makeDb, reset } from "./helpers";
import { auth } from "@/lib/auth";
import { ipFingerprint } from "@/server/ip-privacy";
import { account, session, user } from "@/db/schema";

const { db, client } = makeDb();
afterAll(() => client.end());
beforeEach(() => reset(db));

const IP = "203.0.113.77"; // faixa reservada para documentação (RFC 5737)
const req = (path: string, body: unknown) => new Request(`http://localhost:3000/api/auth${path}`, {
  method: "POST", body: JSON.stringify(body),
  headers: { "content-type": "application/json", origin: "http://localhost:3000", "x-forwarded-for": IP },
});

async function makeLoginUser() {
  const id = randomUUID();
  await db.insert(user).values({ id, name: "Pessoa Teste", email: "login@teste.invalid", emailVerified: true });
  await db.insert(account).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: await hashPassword("senha-correta-123") });
  return id;
}

describe("minimização de IP", () => {
  it("impressão digital é estável, não contém o IP e muda com a chave", () => {
    const a = ipFingerprint(IP, "k".repeat(32));
    expect(a).toMatch(/^h:[0-9a-f]{24}$/);
    expect(a).toBe(ipFingerprint(IP, "k".repeat(32)));
    expect(a).not.toContain("203.0.113");
    expect(a).not.toBe(ipFingerprint(IP, "z".repeat(32)));
    expect(ipFingerprint(null, "k".repeat(32))).toBeNull();
  });

  it("login grava sessão sem IP em claro e o limitador usa chave em HMAC", async () => {
    const id = await makeLoginUser();
    const res = await auth.handler(req("/sign-in/email", { email: "login@teste.invalid", password: "senha-correta-123" }));
    expect(res.status).toBe(200);
    const [s] = await db.select().from(session).where(eq(session.userId, id));
    expect(s.ipAddress).toMatch(/^h:/);
    const keys = await db.execute<{ key: string }>(sql`select key from rate_limit`);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((k) => k.key.startsWith("ba:") && !k.key.includes("203.0.113"))).toBe(true);
  });

  it("o limitador continua bloqueando após 5 tentativas erradas em 5 minutos", async () => {
    await makeLoginUser();
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await auth.handler(req("/sign-in/email", { email: "login@teste.invalid", password: "errada-errada-1" }))).status);
    expect(codes.slice(0, 5).every((c) => c === 401)).toBe(true);
    expect(codes.slice(5)).toEqual([429, 429]);
  });
});
