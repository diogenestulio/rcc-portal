// E-mail transacional: modelos seguros, redefinição de senha ponta a ponta (sem revelar contas),
// link apagado do banco após o envio e confirmação de inscrição.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { makeDb, makeEvent, reset } from "./helpers";
import { render, deliver } from "@/server/mail";
import { emailHandlers } from "@/server/mail-jobs";
import { runJobsOnce } from "@/server/jobs";
import { register } from "@/server/registrations";
import { auth } from "@/lib/auth";
import { account, job, session, user } from "@/db/schema";

const { db, client } = makeDb();
let dir = "";
const APP = "http://localhost:3000";
const envMail = () => ({ SMTP_URL: undefined, MAIL_FROM: "RCC Teste <nao-responda@teste.invalid>", APP_ENV: "development", EMAIL_DIR: dir, APP_URL: APP });
beforeAll(() => { dir = mkdtempSync(path.join(tmpdir(), "rcc-mail-")); });
afterAll(async () => { await client.end(); rmSync(dir, { recursive: true, force: true }); });
beforeEach(async () => { await reset(db); for (const f of readdirSync(dir)) rmSync(path.join(dir, f)); });

const post = (p: string, body: unknown, ip = "198.51.100.7") => auth.handler(new Request(`${APP}/api/auth${p}`, {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", origin: APP, "x-forwarded-for": ip },
}));
const emails = () => readdirSync(dir).map((f) => readFileSync(path.join(dir, f), "utf8"));

describe("modelos de e-mail", () => {
  it("escapa conteúdo variável no HTML e não usa imagens remotas nem rastreamento", () => {
    const m = render({ kind: "inscricao_confirmada", nome: "<script>x</script> Ana", evento: `Retiro "A&B" <b>`, quando: "sábado, 12h", local: null, comprovante: `${APP}/inscricao/abc` }, "RCC Teste");
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;b&gt;");
    expect(m.html).not.toMatch(/<img|pixel|utm_/i);
    expect(m.text).toContain(`${APP}/inscricao/abc`);
    expect(m.subject).toBe(`Inscrição confirmada — Retiro "A&B" <b>`);
  });

  it("sem SMTP: grava arquivo em desenvolvimento e falha em produção", async () => {
    const m = render({ kind: "pedido_pago", nome: "Ana", pedido: `${APP}/pedido/x` }, "RCC");
    await deliver(envMail(), "ana@teste.invalid", m);
    expect(emails()).toHaveLength(1);
    await expect(deliver({ ...envMail(), APP_ENV: "producao" }, "ana@teste.invalid", m)).rejects.toThrow(/SMTP não configurado/);
    await expect(deliver(envMail(), "nao é email", m)).rejects.toThrow(/destinatário/);
  });
});

describe("redefinição de senha", () => {
  it("resposta igual com ou sem conta; link chega, é apagado do banco e troca a senha", async () => {
    const id = randomUUID();
    await db.insert(user).values({ id, name: "Ana Servidora", email: "ana@teste.invalid", emailVerified: true });
    await db.insert(account).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: await hashPassword("senha-antiga-123") });
    await db.insert(session).values({ id: randomUUID(), token: randomUUID(), userId: id, expiresAt: new Date(Date.now() + 3_600_000) });

    const a = await post("/request-password-reset", { email: "ana@teste.invalid", redirectTo: "/entrar/redefinir" });
    const b = await post("/request-password-reset", { email: "ninguem@teste.invalid", redirectTo: "/entrar/redefinir" });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(await a.text()).toBe(await b.text());

    const jobs = await db.select().from(job).where(eq(job.type, "email.redefinir_senha"));
    expect(jobs).toHaveLength(1);
    expect(jobs[0].payload).toMatchObject({ _sensivel: true });

    await runJobsOnce(db, emailHandlers(db, envMail(), "RCC Teste"));
    const [done] = await db.select().from(job).where(eq(job.id, jobs[0].id));
    expect(done).toMatchObject({ status: "concluido", payload: {} });

    const [eml] = emails();
    const link = /(http:\/\/localhost:3000\/api\/auth\/reset-password\/\S+)/.exec(eml)![1];
    const token = /reset-password\/([^?]+)/.exec(link)![1];
    expect(eml).toContain("Redefinição de senha");

    const r = await post("/reset-password", { newPassword: "senha-nova-segura-456", token }); // gitleaks:allow (senha fictícia de teste)
    expect(r.status).toBe(200);
    expect(await db.select().from(session).where(eq(session.userId, id))).toHaveLength(0); // sessões encerradas
    expect((await post("/sign-in/email", { email: "ana@teste.invalid", password: "senha-nova-segura-456" }, "198.51.100.8")).status).toBe(200); // gitleaks:allow (senha fictícia de teste)
    expect((await post("/sign-in/email", { email: "ana@teste.invalid", password: "senha-antiga-123" }, "198.51.100.9")).status).toBe(401);
    expect((await post("/reset-password", { newPassword: "outra-senha-qualquer-789", token })).status).toBe(400); // uso único // gitleaks:allow (senha fictícia de teste)
  });

  it("conta desativada não recebe link", async () => {
    const id = randomUUID();
    await db.insert(user).values({ id, name: "Inativo", email: "inativo@teste.invalid", active: false });
    await db.insert(account).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: await hashPassword("qualquer-senha-123") });
    await post("/request-password-reset", { email: "inativo@teste.invalid", redirectTo: "/entrar/redefinir" });
    await runJobsOnce(db, emailHandlers(db, envMail(), "RCC Teste"));
    expect(emails()).toHaveLength(0);
  });
});

describe("e-mails de inscrição", () => {
  it("confirmação leva título, data e link do comprovante; não confirma inscrição cancelada", async () => {
    const ev = await makeEvent(db, { title: "Noite de Louvor (teste)", location: "Matriz" });
    const r = await register(db, { eventId: ev.id, fullName: "Maria Teste", email: "maria@teste.invalid", idempotencyKey: "k1" });
    await runJobsOnce(db, emailHandlers(db, envMail(), "RCC Teste"));
    const [m] = emails();
    expect(m).toContain("Inscrição confirmada — Noite de Louvor (teste)");
    expect(m).toContain(`${APP}/inscricao/${r.publicToken}`);
    expect(m).toContain("Matriz");
    // cancelada antes de o worker rodar: a confirmação não sai
    const r2 = await register(db, { eventId: ev.id, fullName: "Joao Teste", email: "joao@teste.invalid", idempotencyKey: "k2" });
    const { cancelRegistration } = await import("@/server/registrations");
    await cancelRegistration(db, r2.publicToken, null);
    await runJobsOnce(db, emailHandlers(db, envMail(), "RCC Teste"));
    expect(emails().filter((e) => e.includes("joao@teste.invalid"))).toHaveLength(0);
  });
});
