import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { municipality, parish, region } from "@/db/schema";
import { requireCan } from "@/server/session";
import { btn, field, Notice } from "@/components/ui";
import { WEEKDAY_OPTIONS } from "@/components/site/format";
import { criarGrupo } from "../actions";

export const metadata = { title: "Novo grupo" };

export default async function NovoGrupo({ searchParams }: PageProps<"/admin/grupos/novo">) {
  await requireCan("grupo.criar");
  const sp = await searchParams;
  const [paroquias, municipios, regioes] = await Promise.all([
    db.select({ id: parish.id, name: parish.name, mun: municipality.name }).from(parish).innerJoin(municipality, eq(municipality.id, parish.municipalityId)).orderBy(asc(municipality.name), asc(parish.name)),
    db.select({ id: municipality.id, name: municipality.name }).from(municipality).orderBy(asc(municipality.name)),
    db.select({ id: region.id, name: region.name }).from(region).orderBy(asc(region.sortOrder), asc(region.name)),
  ]);

  return (
    <div className="max-w-3xl">
      <p><Link href="/admin/grupos">← Grupos</Link></p>
      <h1 className="mt-3 text-3xl font-semibold">Novo Grupo de Oração</h1>
      <p className="mt-2 text-tinta-2">O grupo é criado <strong>oculto</strong> e “a confirmar”. Na tela seguinte você completa endereço, contato e mapa, confirma com o grupo e publica.</p>
      {typeof sp.erro === "string" && <div className="mt-4"><Notice tone="perigo">{sp.erro}</Notice></div>}

      <form action={criarGrupo} className="mt-6 space-y-5">
        <div><label htmlFor="nome" className={field.label}>Nome do grupo</label><input id="nome" name="nome" required minLength={3} maxLength={120} className={field.input} placeholder="Grupo de Oração Chama Viva" /></div>
        <div className="grid gap-5 sm:grid-cols-3">
          <div><label htmlFor="dia" className={field.label}>Dia</label><select id="dia" name="dia" required className={field.input}>{WEEKDAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
          <div><label htmlFor="inicio" className={field.label}>Início</label><input id="inicio" name="inicio" type="time" required className={field.input} /></div>
          <div><label htmlFor="fim" className={field.label}>Término (opcional)</label><input id="fim" name="fim" type="time" className={field.input} /></div>
        </div>
        <div><label htmlFor="local" className={field.label}>Local do encontro</label><input id="local" name="local" required minLength={3} maxLength={200} className={field.input} placeholder="Salão paroquial" /><p className={field.hint}>Local público (igreja, salão, capela). Nunca a casa de alguém.</p></div>

        <div>
          <label htmlFor="paroquia" className={field.label}>Paróquia</label>
          <select id="paroquia" name="paroquia" required defaultValue="" className={field.input} aria-describedby="paroquia-dica">
            <option value="" disabled>Escolha…</option>
            {paroquias.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.mun})</option>)}
            <option value="nova">Outra: cadastrar nova paróquia</option>
          </select>
          <p id="paroquia-dica" className={field.hint}>Se a paróquia não estiver na lista, escolha “Outra” e preencha o quadro abaixo.</p>
        </div>

        <fieldset className="rounded-[var(--radius-md)] border border-linha p-4">
          <legend className="px-1 font-semibold">Nova paróquia (só se escolheu “Outra”)</legend>
          <div className="space-y-4">
            <div><label htmlFor="nova_paroquia" className={field.label}>Nome da paróquia</label><input id="nova_paroquia" name="nova_paroquia" maxLength={160} className={field.input} placeholder="Paróquia São Sebastião" /></div>
            <div>
              <label htmlFor="municipio" className={field.label}>Município</label>
              <select id="municipio" name="municipio" defaultValue="" className={field.input}>
                <option value="">Escolha…</option>
                {municipios.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                <option value="novo">Outro: cadastrar novo município</option>
              </select>
            </div>
            <div><label htmlFor="novo_municipio" className={field.label}>Novo município (só se escolheu “Outro”)</label><input id="novo_municipio" name="novo_municipio" maxLength={120} className={field.input} /></div>
            {regioes.length > 0 && (
              <div>
                <label htmlFor="regiao" className={field.label}>Região (opcional)</label>
                <select id="regiao" name="regiao" defaultValue="" className={field.input}>
                  <option value="">Sem região</option>
                  {regioes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            )}
            <p className={field.hint}>Confira a grafia: paróquias e municípios novos passam a aparecer nos filtros do site. Um município com o mesmo nome de um já cadastrado é reaproveitado.</p>
          </div>
        </fieldset>

        <button className={btn.primario}>Criar grupo (oculto)</button>
      </form>
    </div>
  );
}
