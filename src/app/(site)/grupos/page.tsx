import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { filterOptions, isStale, mapGroups, parseGroupFilters, searchGroups } from "@/server/groups";
import { GroupMap } from "@/components/site/GroupMap";
import { Badge, btn, Container, DemoBadge, EmptyState, field, PageHeader } from "@/components/ui";
import { fmtPublished, hhmm, weekday, WEEKDAY_OPTIONS } from "@/components/site/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Grupos de Oração", description: "Encontre um Grupo de Oração por município, paróquia, dia e horário." };

export default async function GruposPage({ searchParams }: PageProps<"/grupos">) {
  const sp = await searchParams;
  const f = parseGroupFilters(sp);
  const [opts, res, pontos] = await Promise.all([filterOptions(db), searchGroups(db, f), mapGroups(db, f)]);
  const pages = Math.max(1, Math.ceil(res.total / res.pageSize));
  const qs = (p: number) => { const u = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && k !== "pagina" ? [[k, v]] : []))); u.set("pagina", String(p)); return `?${u}`; };
  const anyFilter = f.municipio || f.paroquia || f.regiao || f.dia !== undefined || f.periodo || f.q;

  return (
    <>
      <PageHeader eyebrow="Grupos de Oração" title="Encontre um Grupo de Oração"
        intro="Os grupos são abertos a todos. Não é preciso cadastro: escolha o município e o dia, e vá ao encontro." />
      <Container className="py-10">
        <form method="get" role="search" aria-label="Filtrar grupos" className="grid gap-4 rounded-[var(--radius-lg)] border border-linha bg-papel p-5 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label htmlFor="municipio" className={field.label}>Município</label>
            <select id="municipio" name="municipio" defaultValue={f.municipio ?? ""} className={field.input}>
              <option value="">Todos</option>
              {opts.municipios.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label htmlFor="paroquia" className={field.label}>Paróquia</label>
            <select id="paroquia" name="paroquia" defaultValue={f.paroquia ?? ""} className={field.input}>
              <option value="">Todas</option>
              {opts.paroquias.filter((p) => !f.municipio || p.municipality === f.municipio).map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="dia" className={field.label}>Dia</label>
            <select id="dia" name="dia" defaultValue={f.dia !== undefined ? String(f.dia) : ""} className={field.input}>
              <option value="">Qualquer dia</option>
              {WEEKDAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="periodo" className={field.label}>Horário</label>
            <select id="periodo" name="periodo" defaultValue={f.periodo ?? ""} className={field.input}>
              <option value="">Qualquer horário</option>
              <option value="manha">Manhã</option>
              <option value="tarde">Tarde</option>
              <option value="noite">Noite</option>
            </select>
          </div>
          {opts.regioes.length > 0 && (
            <div className="lg:col-span-2">
              <label htmlFor="regiao" className={field.label}>Região</label>
              <select id="regiao" name="regiao" defaultValue={f.regiao ?? ""} className={field.input}>
                <option value="">Todas</option>
                {opts.regioes.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
              </select>
            </div>
          )}
          <div className={opts.regioes.length > 0 ? "lg:col-span-2" : "lg:col-span-4"}>
            <label htmlFor="q" className={field.label}>Nome do grupo ou local</label>
            <input id="q" name="q" type="search" defaultValue={f.q ?? ""} className={field.input} autoComplete="off" />
          </div>
          <div className="flex items-end gap-2 lg:col-span-2">
            <button type="submit" className={btn.primario}>Buscar</button>
            {anyFilter && <Link href="/grupos" className={btn.discreto}>Limpar</Link>}
          </div>
        </form>

        <GroupMap groups={pontos} totalNaLista={res.total} />

        <p className="mt-8 text-tinta-2" aria-live="polite">
          {res.total === 0 ? "Nenhum grupo encontrado." : `${res.total} ${res.total === 1 ? "grupo encontrado" : "grupos encontrados"}.`}
        </p>

        {res.total === 0 ? (
          <div className="mt-4">
            <EmptyState title="Nenhum grupo com esses filtros" action={<Link href="/grupos" className={btn.secundario}>Ver todos os grupos</Link>}>
              Tente outro dia ou horário. Se você conhece um grupo que não está na lista, <Link href="/contato">avise a coordenação</Link>.
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {res.rows.map((g) => (
              <li key={g.id} className="rounded-[var(--radius-lg)] border border-linha bg-papel p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-xl font-semibold"><Link href={`/grupos/${g.slug}`} className="text-tinta no-underline hover:underline">{g.name}</Link></h2>
                  <div className="flex gap-2">
                    {g.status === "pausado" && <Badge tone="alerta">Pausado</Badge>}
                    {isStale(g.lastConfirmedAt) && <Badge tone="neutro">Informação a confirmar</Badge>}
                    <DemoBadge show={g.isDemo} />
                  </div>
                </div>
                <p className="mt-2 font-semibold text-vinho">{weekday(g.weekday)}, {hhmm(g.startTime)}{g.endTime ? ` às ${hhmm(g.endTime)}` : ""}</p>
                <p className="text-tinta-2">{g.venue} — {g.parish}</p>
                <p className="text-sm text-tinta-3">{g.municipality}{g.region ? ` · ${g.region}` : ""}{g.lastConfirmedAt ? ` · confirmado em ${fmtPublished(g.lastConfirmedAt)}` : ""}</p>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <nav aria-label="Paginação" className="mt-8 flex items-center justify-center gap-3">
            {res.page > 1 && <Link href={qs(res.page - 1)} className={btn.secundario}>Anterior</Link>}
            <span className="text-tinta-2">Página {res.page} de {pages}</span>
            {res.page < pages && <Link href={qs(res.page + 1)} className={btn.secundario}>Próxima</Link>}
          </nav>
        )}
      </Container>
    </>
  );
}
