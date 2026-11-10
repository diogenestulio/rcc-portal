// Casos de aceite 1 e 3: busca de grupos; responsável de um grupo não acessa outro.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeDb, makeGroup, makeUser, reset, subject, territory, g } from "./helpers";
import { editGroup, getPrivateContact, getPublicGroup, isStale, parseGroupFilters, searchGroups, suggestCorrection } from "@/server/groups";
import { decide, ForbiddenError, MATRIX } from "@/server/authz";
import { groupPrivateContact, prayerGroup } from "@/db/schema";
import { eq } from "drizzle-orm";

const { db, client } = makeDb();
afterAll(() => client.end());
beforeEach(() => reset(db));

describe("busca de grupos", () => {
  it("encontra grupo por município e dia; ignora não publicados e encerrados", async () => {
    const a = await territory(db), b = await territory(db);
    const alvo = await makeGroup(db, a, { name: "Grupo Chama Viva", weekday: 4 });
    await makeGroup(db, a, { weekday: 2 });
    await makeGroup(db, b, { weekday: 4 });
    await makeGroup(db, a, { weekday: 4, published: false });
    await makeGroup(db, a, { weekday: 4, status: "encerrado" });
    const r = await searchGroups(db, parseGroupFilters({ municipio: a.municipality.slug, dia: "4" }));
    expect(r.rows.map((x) => x.id)).toEqual([alvo.id]);
    const det = await getPublicGroup(db, alvo.slug);
    expect(det?.name).toBe("Grupo Chama Viva");
    expect(det?.lastConfirmedAt).toBeInstanceOf(Date);
  });

  it("filtro por período e texto sem acento; parâmetros inválidos são ignorados", async () => {
    const a = await territory(db);
    const noite = await makeGroup(db, a, { name: "Renascer", startTime: "19:30" });
    await makeGroup(db, a, { name: "Manhã de Louvor", startTime: "08:00" });
    expect((await searchGroups(db, parseGroupFilters({ periodo: "noite" }))).rows.map((x) => x.id)).toEqual([noite.id]);
    expect((await searchGroups(db, parseGroupFilters({ q: "manha" }))).rows).toHaveLength(1);
    const f = parseGroupFilters({ dia: "9", periodo: "madrugada", pagina: "-3" });
    expect(f).toMatchObject({ dia: undefined, periodo: undefined, page: 1 });
    expect((await searchGroups(db, parseGroupFilters({ q: "%' or 1=1 --" }))).rows).toHaveLength(0);
  });

  it("telefone do coordenador só aparece com autorização; sugestão não altera o grupo", async () => {
    const a = await territory(db);
    const grp = await makeGroup(db, a);
    await db.insert(groupPrivateContact).values({ groupId: grp.id, coordinatorPhone: "(65) 90000-0000", coordinatorEmail: "coord@teste.invalid" });
    expect((await getPublicGroup(db, grp.slug))?.authorizedPhone).toBeNull();
    expect(JSON.stringify(await getPublicGroup(db, grp.slug))).not.toContain("coord@teste.invalid");
    await suggestCorrection(db, grp.slug, "O horário mudou para 20h, por favor atualizar.");
    const [after] = await db.select().from(prayerGroup).where(eq(prayerGroup.id, grp.id));
    expect(after.startTime).toBe("19:30:00");
  });

  it("marca como desatualizado após 180 dias", () => {
    expect(isStale(null)).toBe(true);
    expect(isStale(new Date(Date.now() - 181 * 86_400_000))).toBe(true);
    expect(isStale(new Date())).toBe(false);
  });
});

describe("autorização por escopo", () => {
  it("responsável de um grupo não edita nem lê contato privado de outro", async () => {
    const a = await territory(db);
    const meu = await makeGroup(db, a), outro = await makeGroup(db, a);
    const resp = subject(await makeUser(db), [{ role: "responsavel_local", scopeType: "grupo", scopeId: meu.id }]);
    await editGroup(db, resp, meu.id, { description: "Atualizado" });
    await expect(editGroup(db, resp, outro.id, { description: "x" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getPrivateContact(db, resp, outro.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getPrivateContact(db, resp, meu.id)).resolves.toBeNull();
  });

  it("escopo regional cobre apenas grupos da região", async () => {
    const a = await territory(db), b = await territory(db);
    const ga = await makeGroup(db, a), gb = await makeGroup(db, b);
    const resp = subject(await makeUser(db), [{ role: "responsavel_local", scopeType: "regiao", scopeId: a.region.id }]);
    await editGroup(db, resp, ga.id, { description: "ok" });
    await expect(editGroup(db, resp, gb.id, { description: "x" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("sem MFA, nada; ação sensível exige reautenticação recente", () => {
    const s = subject("u", [g("gestor_institucional")], { mfa: false });
    expect(decide(s, "conteudo.criar")).toEqual({ ok: false, reason: "mfa_obrigatorio" });
    const old = subject("u", [g("gestor_institucional")], { recentAuthAt: new Date(Date.now() - 3_600_000) });
    expect(decide(old, "papeis.conceder")).toEqual({ ok: false, reason: "reautenticar" });
    expect(decide(old, "conteudo.criar")).toEqual({ ok: true });
  });

  it("administrador técnico não lê pedidos de oração por padrão", () => {
    expect(MATRIX.admin_tecnico).not.toContain("oracao.ler");
    expect(decide(subject("u", [g("admin_tecnico")]), "oracao.ler").ok).toBe(false);
    expect(decide(subject("u", [g("intercessor")]), "oracao.ler").ok).toBe(true);
  });

  it("papel com escopo não vale para ações globais", () => {
    const s = subject("u", [{ role: "gestor_eventos", scopeType: "grupo", scopeId: "00000000-0000-0000-0000-000000000001" }]);
    expect(decide(s, "evento.exportar").ok).toBe(false);
  });
});
