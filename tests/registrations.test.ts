// Caso de aceite 7 (inscrições simultâneas), check-in único, lista de espera, duplicidade.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeDb, makeEvent, makeUser, reset } from "./helpers";
import { cancelRegistration, checkIn, expireHolds, register, RegistrationError } from "@/server/registrations";
import { registration, ticketBatch } from "@/db/schema";
import { eq } from "drizzle-orm";

const { db, client } = makeDb(20);
afterAll(() => client.end());
beforeEach(() => reset(db));

describe("inscrições", () => {
  it("40 inscrições simultâneas para 10 vagas confirmam exatamente 10", async () => {
    const ev = await makeEvent(db, { capacity: 10 });
    const results = await Promise.allSettled(Array.from({ length: 40 }, (_, i) =>
      register(db, { eventId: ev.id, fullName: `Pessoa ${i}`, email: `p${i}@teste.invalid`, idempotencyKey: `k${i}` })));
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(10);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected.every((r) => r.reason instanceof RegistrationError && r.reason.code === "esgotado")).toBe(true);
    const rows = await db.select().from(registration).where(eq(registration.eventId, ev.id));
    expect(rows.filter((r) => r.status === "confirmada")).toHaveLength(10);
  });

  it("reenvio com a mesma chave é idempotente; mesmo e-mail com outro nome é permitido; mesmo nome+e-mail é duplicado", async () => {
    const ev = await makeEvent(db, { capacity: 5 });
    const a = await register(db, { eventId: ev.id, fullName: "João da Silva", email: "familia@teste.invalid", idempotencyKey: "x" });
    const again = await register(db, { eventId: ev.id, fullName: "João da Silva", email: "familia@teste.invalid", idempotencyKey: "x" });
    expect(again.id).toBe(a.id);
    await register(db, { eventId: ev.id, fullName: "Ana da Silva", email: "FAMILIA@teste.invalid", idempotencyKey: "y" });
    await expect(register(db, { eventId: ev.id, fullName: "joão  da silva", email: "familia@teste.invalid", idempotencyKey: "z" })).rejects.toMatchObject({ code: "duplicada" });
  });

  it("comprovante usa token opaco sem dados pessoais", async () => {
    const ev = await makeEvent(db);
    const r = await register(db, { eventId: ev.id, fullName: "Maria Teste", email: "maria@teste.invalid", idempotencyKey: "m" });
    expect(r.publicToken).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(r.publicToken).not.toContain("maria");
  });

  it("check-in é validado no servidor e só pode ser usado uma vez", async () => {
    const ev = await makeEvent(db);
    const op = await makeUser(db);
    const r = await register(db, { eventId: ev.id, fullName: "Pedro Teste", email: "pedro@teste.invalid", idempotencyKey: "p" });
    const outro = await makeEvent(db);
    expect(await checkIn(db, outro.id, r.publicToken, op)).toEqual({ ok: false, reason: "outro_evento" });
    const both = await Promise.all([checkIn(db, ev.id, r.publicToken, op), checkIn(db, ev.id, r.publicToken, op)]);
    expect(both.filter((x) => x.ok)).toHaveLength(1);
    expect(await checkIn(db, ev.id, r.publicToken, op)).toEqual({ ok: false, reason: "ja_utilizado" });
    expect(await checkIn(db, ev.id, "token-inexistente", op)).toEqual({ ok: false, reason: "invalido" });
  });

  it("lista de espera é promovida ao cancelar", async () => {
    const ev = await makeEvent(db, { capacity: 1, waitlistEnabled: true });
    const a = await register(db, { eventId: ev.id, fullName: "Primeira Pessoa", email: "a@teste.invalid", idempotencyKey: "a" });
    const b = await register(db, { eventId: ev.id, fullName: "Segunda Pessoa", email: "b@teste.invalid", idempotencyKey: "b" });
    expect(b.status).toBe("lista_espera");
    await cancelRegistration(db, a.publicToken, null);
    const [bb] = await db.select().from(registration).where(eq(registration.id, b.id));
    expect(bb.status).toBe("confirmada");
  });

  it("reserva paga expira, libera a vaga e não confirma sozinha", async () => {
    const ev = await makeEvent(db, { capacity: 1, holdMinutes: 15 });
    const [lote] = await db.insert(ticketBatch).values({ eventId: ev.id, name: "Lote 1", priceCents: 5000 }).returning();
    const r = await register(db, { eventId: ev.id, batchId: lote.id, fullName: "Paga Depois", email: "pd@teste.invalid", idempotencyKey: "pd" });
    expect(r.status).toBe("reservada");
    await expect(register(db, { eventId: ev.id, batchId: lote.id, fullName: "Outra", email: "o@teste.invalid", idempotencyKey: "o" })).rejects.toMatchObject({ code: "esgotado" });
    expect(await expireHolds(db, new Date(Date.now() + 16 * 60_000))).toBe(1);
    const later = new Date(Date.now() + 17 * 60_000);
    const r2 = await register(db, { eventId: ev.id, batchId: lote.id, fullName: "Outra", email: "o@teste.invalid", idempotencyKey: "o2" }, later);
    expect(r2.status).toBe("reservada");
  });

  it("inscrições fechadas, evento não publicado e cancelado são recusados", async () => {
    const fechado = await makeEvent(db, { registrationClosesAt: new Date(Date.now() - 1000) });
    await expect(register(db, { eventId: fechado.id, fullName: "Fulano Teste", email: "f@teste.invalid", idempotencyKey: "f1" })).rejects.toMatchObject({ code: "fechada" });
    const rascunho = await makeEvent(db, { publication: "rascunho" });
    await expect(register(db, { eventId: rascunho.id, fullName: "Fulano Teste", email: "f@teste.invalid", idempotencyKey: "f2" })).rejects.toMatchObject({ code: "nao_encontrado" });
    const cancelado = await makeEvent(db, { status: "cancelado" });
    await expect(register(db, { eventId: cancelado.id, fullName: "Fulano Teste", email: "f@teste.invalid", idempotencyKey: "f3" })).rejects.toMatchObject({ code: "fechada" });
  });
});
