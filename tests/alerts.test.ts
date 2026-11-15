// Alertas operacionais: anti-repetição, resolução, verificações no banco e envio ao Telegram sem vazar dados.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { makeDb, reset } from "./helpers";
import { AlertTracker, collectChecks, sendTelegram, type Check } from "@/server/alerts";
import { enqueue } from "@/server/jobs";

const { db, client } = makeDb();
afterAll(() => client.end());
beforeEach(() => reset(db));

const H = 3600_000;
const falha: Check = { key: "fila.morta", title: "tarefas que falharam", ok: false, detail: "email.enviar: 1" };
const ok: Check = { ...falha, ok: true, detail: undefined };

describe("AlertTracker", () => {
  it("avisa uma vez, lembra a cada 6 h e avisa quando resolve", () => {
    const t = new AlertTracker("[RCC · teste]");
    const t0 = 1_000_000;
    expect(t.plan([falha], t0 - 60_000)).toEqual([]);             // 1ª falha: aguarda confirmação
    const [n] = t.plan([falha], t0);
    expect(n).toMatchObject({ kind: "novo" });
    expect(n.text).toContain("🔴 [RCC · teste] — tarefas que falharam\nemail.enviar: 1");
    t.markSent(n, falha.title, t0);
    expect(t.plan([falha], t0 + 60_000)).toEqual([]);           // sem repetição no minuto seguinte
    expect(t.plan([falha], t0 + 5 * H)).toEqual([]);
    const [l] = t.plan([falha], t0 + 6 * H);
    expect(l).toMatchObject({ kind: "lembrete" });
    expect(l.text).toContain("continua há 6 h");
    t.markSent(l, falha.title, t0 + 6 * H);
    expect(t.plan([falha], t0 + 7 * H)).toEqual([]);
    const [r] = t.plan([ok], t0 + 8 * H);
    expect(r).toMatchObject({ kind: "resolvido" });
    expect(r.text).toBe("✅ [RCC · teste] — resolvido após 8 h: tarefas que falharam");
    t.markSent(r, ok.title, t0 + 8 * H);
    expect(t.activeKeys()).toEqual([]);
    expect(t.plan([ok], t0 + 9 * H)).toEqual([]);                // tudo bem e nada ativo → silêncio
  });

  it("se o envio falhar (sem markSent), tenta de novo no próximo ciclo; chaves ausentes não mudam", () => {
    const t = new AlertTracker("[x]", 6 * H, 1);
    expect(t.plan([falha], 0)).toHaveLength(1);
    expect(t.plan([falha], 60_000)).toHaveLength(1);             // não confirmado → planeja de novo
    t.markSent(t.plan([falha], 120_000)[0], falha.title, 120_000);
    expect(t.plan([{ key: "auditoria", title: "a", ok: true }], 180_000)).toEqual([]); // outra chave: não resolve a fila
    expect(t.activeKeys()).toEqual(["fila.morta"]);
  });
});

it("falha isolada (ex.: worker subiu antes do portal) não gera alerta", () => {
  const t = new AlertTracker("[x]");
  expect(t.plan([falha], 0)).toEqual([]);
  expect(t.plan([ok], 60_000)).toEqual([]);
  expect(t.plan([falha], 120_000)).toEqual([]);                  // a contagem recomeçou
  expect(t.plan([falha], 180_000)).toHaveLength(1);
});

describe("verificações", () => {
  it("fila atrasada e tarefas mortas: só tipo e contagem, nunca o conteúdo", async () => {
    expect((await collectChecks(db)).every((c) => c.ok)).toBe(true);
    await enqueue(db, "email.enviar", { to: "pessoa@teste.invalid", _sensivel: true }, { runAt: new Date(Date.now() - 20 * 60_000) });
    const id = await enqueue(db, "gcal.projetar", { eventId: "x" });
    await db.execute(sql`update job set status = 'morto', last_error = 'Google Calendar não configurado' where id = ${id}`);
    const cs = await collectChecks(db);
    expect(cs.find((c) => c.key === "fila.atrasada")).toMatchObject({ ok: false, detail: "email.enviar: 1" });
    expect(cs.find((c) => c.key === "fila.morta")).toMatchObject({ ok: false, detail: "gcal.projetar: 1 (último erro: Google Calendar não configurado)" });
    expect(JSON.stringify(cs)).not.toContain("pessoa@");
  });

  it("backup: sem registro, falha registrada, atrasado e em dia", async () => {
    const now = new Date();
    const backup = async () => (await collectChecks(db, { expectBackup: true, now })).find((c) => c.key === "backup")!;
    expect(await backup()).toMatchObject({ ok: false, detail: "Nenhum backup registrado ainda." });
    await db.execute(sql`insert into integration_state (key, last_success_at) values ('backup', now() - interval '30 hours')`);
    expect((await backup()).detail).toMatch(/há 30 h/);
    await db.execute(sql`update integration_state set last_error_at = now(), last_error = 'falhou na linha 22 do backup.sh' where key = 'backup'`);
    expect(await backup()).toMatchObject({ ok: false, detail: "Última execução falhou: falhou na linha 22 do backup.sh" });
    await db.execute(sql`update integration_state set last_success_at = now() + interval '1 second' where key = 'backup'`);
    expect(await backup()).toMatchObject({ ok: true });
    expect((await collectChecks(db)).some((c) => c.key === "backup")).toBe(false); // sem expectBackup, não verifica
  });

  it("portal e endereço público: saúde interna precisa de ok=true; público aceita qualquer resposta < 500", async () => {
    const resp = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
    const run = async (f: typeof fetch) => Object.fromEntries((await collectChecks(db, { healthUrl: "http://h/api/health", publicUrl: "https://p/", fetchImpl: f })).map((c) => [c.key, c.ok]));
    expect(await run((async (u: string) => (String(u).startsWith("http://h") ? resp(200, { ok: true }) : resp(401))) as typeof fetch)).toMatchObject({ portal: true, publico: true });
    expect(await run((async (u: string) => (String(u).startsWith("http://h") ? resp(503, { ok: false }) : resp(502))) as typeof fetch)).toMatchObject({ portal: false, publico: false });
    expect(await run((async () => { throw new TypeError("fetch failed"); }) as typeof fetch)).toMatchObject({ portal: false, publico: false });
  });

  it("auditoria íntegra não gera alerta", async () => {
    expect((await collectChecks(db, { audit: true })).find((c) => c.key === "auditoria")).toMatchObject({ ok: true });
  });
});

describe("Telegram", () => {
  it("envia texto simples ao chat configurado e não expõe o token no erro", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const fake = (async (url: string, init: RequestInit) => { calls.push({ url, body: JSON.parse(String(init.body)) }); return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
    await sendTelegram({ token: "123:ABC", chatId: "-100" }, "🔴 teste", fake);
    expect(calls[0].url).toBe("https://api.telegram.org/bot123:ABC/sendMessage");
    expect(calls[0].body).toEqual({ chat_id: "-100", text: "🔴 teste", disable_web_page_preview: true }); // sem parse_mode
    const ruim = (async () => new Response(JSON.stringify({ description: "Unauthorized" }), { status: 401 })) as unknown as typeof fetch;
    const err = await sendTelegram({ token: "123:SEGREDO", chatId: "-100" }, "x", ruim).catch((e: Error) => e);
    expect(String(err)).toContain("Telegram respondeu 401: Unauthorized");
    expect(String(err)).not.toContain("SEGREDO");
    await expect(sendTelegram({}, "x", fake)).rejects.toThrow(/não configurado/);
  });
});
