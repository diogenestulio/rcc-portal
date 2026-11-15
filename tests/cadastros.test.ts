// Cadastro de grupo novo (com paróquia/município novos) e ministérios pelo painel: permissões, escopo e validação.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { makeDb, makeUser, reset, subject, territory, g } from "./helpers";
import { createGroup, searchGroups, parseGroupFilters } from "@/server/groups";
import { createMinistry, editMinistry, setMinistryPublished } from "@/server/ministries";
import { ForbiddenError } from "@/server/authz";
import { InputError } from "@/server/errors";
import { slugify } from "@/server/slug";
import { ministry, municipality, parish, prayerGroup } from "@/db/schema";

const { db, client } = makeDb();
afterAll(() => client.end());
beforeEach(() => reset(db));

const base = { name: "Grupo Chama Viva", venue: "Salão paroquial", weekday: 2, startTime: "19:30" };

describe("grupo novo", () => {
  it("gestor cria em paróquia existente: oculto, a confirmar, herda município e região; slug único", async () => {
    const t = await territory(db);
    const gestor = subject(await makeUser(db), [g("gestor_institucional")]);
    const id = await createGroup(db, gestor, { ...base, parishId: t.parish.id });
    const [grp] = await db.select().from(prayerGroup).where(eq(prayerGroup.id, id));
    expect(grp).toMatchObject({ published: false, status: "a_confirmar", municipalityId: t.municipality.id, regionId: t.region.id, slug: "grupo-chama-viva" });
    const id2 = await createGroup(db, gestor, { ...base, parishId: t.parish.id });
    expect((await db.select({ s: prayerGroup.slug }).from(prayerGroup).where(eq(prayerGroup.id, id2)))[0].s).toBe("grupo-chama-viva-2");
    expect((await searchGroups(db, parseGroupFilters({}))).rows).toHaveLength(0); // oculto não aparece no site
  });

  it("cria paróquia e município novos; município com mesmo nome (sem acento/maiúscula) é reaproveitado", async () => {
    const gestor = subject(await makeUser(db), [g("gestor_institucional")]);
    await createGroup(db, gestor, { ...base, newParish: { name: "Paróquia São Sebastião", newMunicipality: "Várzea Grande" } });
    await createGroup(db, gestor, { ...base, name: "Outro", newParish: { name: "Paróquia Nossa Senhora", newMunicipality: "varzea grande" } });
    expect(await db.select({ n: municipality.name, s: municipality.slug }).from(municipality)).toEqual([{ n: "Várzea Grande", s: "varzea-grande" }]);
    expect((await db.select().from(parish)).map((p) => p.slug).sort()).toEqual(["paroquia-nossa-senhora", "paroquia-sao-sebastiao"]);
    const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from audit_log where action in ('grupo.criar','paroquia.criar','municipio.criar')`);
    expect(n).toBeGreaterThanOrEqual(5);
  });

  it("validação com mensagem para o usuário e nada gravado pela metade", async () => {
    const gestor = subject(await makeUser(db), [g("gestor_institucional")]);
    await expect(createGroup(db, gestor, { ...base, name: "x", newParish: { name: "Paróquia Nova", newMunicipality: "Cidade" } })).rejects.toBeInstanceOf(InputError);
    await expect(createGroup(db, gestor, { ...base, newParish: { name: "Paróquia Nova" } })).rejects.toThrow(/município/);
    await expect(createGroup(db, gestor, { ...base, startTime: "7h" })).rejects.toThrow(/início/);
    expect(await db.select().from(parish)).toHaveLength(0);       // transação desfeita
    expect(await db.select().from(municipality)).toHaveLength(0);
  });

  it("responsável local e editor não criam grupos", async () => {
    const t = await territory(db);
    const grp = await db.insert(prayerGroup).values({ name: "G", slug: "g", parishId: t.parish.id, municipalityId: t.municipality.id, venue: "S", weekday: 1, startTime: "19:00" }).returning();
    const local = subject(await makeUser(db), [{ role: "responsavel_local", scopeType: "grupo", scopeId: grp[0].id }]);
    const editor = subject(await makeUser(db), [g("editor")]);
    await expect(createGroup(db, local, { ...base, parishId: t.parish.id })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createGroup(db, editor, { ...base, parishId: t.parish.id })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("ministérios", () => {
  it("gestor cria (oculto), publica e oculta; responsável só edita o seu", async () => {
    const gestor = subject(await makeUser(db), [g("gestor_institucional")]);
    const id = await createMinistry(db, gestor, { name: "Ministério de Música", summary: "Louvor nos grupos" });
    expect((await db.select().from(ministry).where(eq(ministry.id, id)))[0]).toMatchObject({ published: false, slug: "ministerio-de-musica" });
    await setMinistryPublished(db, gestor, id, true);
    expect((await db.select({ p: ministry.published }).from(ministry).where(eq(ministry.id, id)))[0].p).toBe(true);

    const outro = await createMinistry(db, gestor, { name: "Ministério Jovem" });
    const resp = subject(await makeUser(db), [{ role: "responsavel_local", scopeType: "ministerio", scopeId: id }]);
    await editMinistry(db, resp, id, { name: "Ministério de Música", description: "Parágrafo 1\n\nParágrafo 2" });
    await expect(editMinistry(db, resp, outro, { name: "Invadido" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setMinistryPublished(db, resp, id, false)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createMinistry(db, resp, { name: "Novo" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(editMinistry(db, gestor, id, { name: "  " })).rejects.toBeInstanceOf(InputError);
    expect((await db.select({ n: ministry.name }).from(ministry).where(eq(ministry.id, outro)))[0].n).toBe("Ministério Jovem");
  });
});

it("slugify: acentos, símbolos e limite", () => {
  expect(slugify("  Paróquia São João Batista — Centro! ")).toBe("paroquia-sao-joao-batista-centro");
  expect(slugify("???")).toBe("item");
  expect(slugify("a".repeat(80)).length).toBe(60);
});
