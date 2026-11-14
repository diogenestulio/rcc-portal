// Mapa dos grupos: coordenadas validadas, só grupos publicados com localização, mesmos filtros da lista,
// e nenhum dado privado no que vai para o navegador.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeDb, makeGroup, makeUser, reset, subject, territory } from "./helpers";
import { editGroup, mapGroups, parseCoord, parseGroupFilters } from "@/server/groups";
import { groupPrivateContact } from "@/db/schema";

const { db, client } = makeDb();
afterAll(() => client.end());
beforeEach(() => reset(db));

describe("coordenadas", () => {
  it("aceita vírgula ou ponto, normaliza e recusa valores inválidos", () => {
    expect(parseCoord("-15,6014", "lat")).toBe("-15.601400");
    expect(parseCoord(" -56.0979 ", "lng")).toBe("-56.097900");
    expect(parseCoord("", "lat")).toBeNull();
    for (const bad of ["91", "abc", "-15,6,1", "1e3"]) expect(() => parseCoord(bad, "lat")).toThrow();
    expect(() => parseCoord("-181", "lng")).toThrow(/intervalo/);
  });

  it("latitude e longitude precisam vir juntas", async () => {
    const t = await territory(db);
    const grp = await makeGroup(db, t);
    const s = subject(await makeUser(db), [{ role: "responsavel_local", scopeType: "grupo", scopeId: grp.id }]);
    await expect(editGroup(db, s, grp.id, { latitude: "-15.600000", longitude: null })).rejects.toThrow(/juntas/);
    await editGroup(db, s, grp.id, { latitude: "-15.600000", longitude: "-56.100000" });
  });
});

describe("pontos do mapa", () => {
  it("só publicados, ativos, com localização e respeitando os filtros; sem dados privados", async () => {
    const a = await territory(db), b = await territory(db);
    const ok = await makeGroup(db, a, { weekday: 4, latitude: "-15.600000", longitude: "-56.100000" });
    await makeGroup(db, a, { weekday: 4 });                                                         // sem localização
    await makeGroup(db, a, { weekday: 4, latitude: "-15.61", longitude: "-56.11", published: false }); // oculto
    await makeGroup(db, a, { weekday: 4, latitude: "-15.62", longitude: "-56.12", status: "encerrado" });
    await makeGroup(db, b, { weekday: 4, latitude: "-15.63", longitude: "-56.13" });                 // outro município
    await db.insert(groupPrivateContact).values({ groupId: ok.id, coordinatorPhone: "(65) 90000-0000", coordinatorEmail: "coord@teste.invalid" });
    const pts = await mapGroups(db, parseGroupFilters({ municipio: a.municipality.slug, dia: "4" }));
    expect(pts).toEqual([expect.objectContaining({ slug: ok.slug, lat: -15.6, lng: -56.1 })]);
    expect(Object.keys(pts[0]).sort()).toEqual(["lat", "lng", "municipality", "name", "slug", "startTime", "venue", "weekday"]);
    expect(JSON.stringify(pts)).not.toMatch(/coord@|90000/);
  });
});
