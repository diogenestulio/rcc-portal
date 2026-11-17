import Link from "next/link";
import Image from "next/image";
import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { agenda, displayStatus } from "@/server/events";
import { listPublished } from "@/server/content";
import { filterOptions } from "@/server/groups";
import { ministry } from "@/db/schema";
import { Badge, ButtonLink, Container, DemoBadge, btn, cx, field } from "@/components/ui";
import { cap, dateParts, fmtPublished, WEEKDAY_OPTIONS } from "@/components/site/format";
import { IconeCalendario, IconeChama, IconeLivro, IconeMaos, IconePomba } from "@/components/site/Icones";
import { LazyVideo } from "@/components/site/LazyVideo";
import { instituicaoHome } from "@/config/instituicao";

export const dynamic = "force-dynamic";

function SectionHead({ id, title, intro, href, more, claro }: { id: string; title: string; intro?: string; href?: string; more?: string; claro?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <div className="max-w-2xl">
        <h2 id={id} className="text-[2.1rem] sm:text-[2.7rem]">{title}</h2>
        {intro && <p className={cx("mt-2 text-lg", claro ? "text-prata" : "text-tinta-2")}>{intro}</p>}
      </div>
      {href && <Link href={href} className="font-semibold">{more}</Link>}
    </div>
  );
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export default async function Home() {
  const now = new Date();
  const [proximos, noticias, formacao, ministerios, opts, [contagem]] = await Promise.all([
    agenda(db, now, new Date(now.getTime() + 90 * 86_400_000)),
    listPublished(db, "noticia", 4),
    listPublished(db, "formacao", 3),
    db.select().from(ministry).where(eq(ministry.published, true)).orderBy(ministry.name).limit(8),
    filterOptions(db),
    db.execute<{ grupos: number; municipios: number }>(sql`select count(*)::int as grupos, count(distinct municipality_id)::int as municipios
      from prayer_group where published and status <> 'encerrado'`),
  ]);
  const eventos = proximos.filter((o) => !o.cancelled).slice(0, 4);
  const [principal, ...seguintes] = eventos;
  const [destaque, ...outras] = noticias;
  const totalGrupos = contagem?.grupos ?? 0, totalMun = contagem?.municipios ?? 0;

  return (
    <>
      {/* ───── Abertura: brasão livre com raios dourados de Pentecostes ───── */}
      <section aria-labelledby="destaque" className="estandarte textura-losangos sobre-estandarte relative isolate overflow-hidden">
        <div aria-hidden="true" className="raios -z-10" />
        <Container className="grid items-center gap-10 pb-32 pt-12 sm:pb-36 sm:pt-16 md:grid-cols-[1.15fr_1fr] lg:pt-20">
          <div>
            <h1 id="destaque" className="text-monumental">Há um lugar para você rezar conosco.</h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-marfim-texto sm:text-xl">
              Os Grupos de Oração se reúnem toda semana nas paróquias da Arquidiocese de Cuiabá para louvar a Deus,
              ouvir a Palavra e acolher quem chega.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/agenda" variant="ouro">Ver a agenda</ButtonLink>
              <ButtonLink href="/a-rcc" variant="claro">Conhecer a RCC</ButtonLink>
            </div>
          </div>
          <div aria-hidden="true" className="relative order-first justify-self-start md:order-none md:justify-self-center">
            <div className="brilho -inset-[30%]" />
            <Image src="/marca/rcc-livre.webp" alt="" width={598} height={462} priority className="brasao-livre brasao-entrada relative h-auto w-40 sm:w-52 md:w-[24rem] lg:w-[27rem]" />
          </div>
        </Container>
        <div aria-hidden="true" className="filete-ouro no-claro" />
      </section>

      {/* ───── Buscador de grupos: sobe por cima do filete, convidando a começar ───── */}
      <Container className="relative z-10 -mt-24 sm:-mt-28">
        <form method="get" action="/grupos" role="search" aria-labelledby="buscar-grupo"
          className="grid gap-5 rounded-[var(--radius-lg)] border border-linha bg-papel p-6 shadow-[var(--sombra-alta)] sm:p-8 lg:grid-cols-[1.3fr_1fr_1fr_auto] lg:items-end">
          <div className="flex items-start gap-4 lg:pr-4">
            <IconeChama className="caminho-icone mt-1 h-10 w-10 shrink-0 text-marca" />
            <div>
              <h2 id="buscar-grupo" className="font-titulo text-[1.45rem] font-bold leading-tight">Encontre um Grupo de Oração</h2>
              <p className="mt-1 text-tinta-2">{totalGrupos > 0 ? `${plural(totalGrupos, "grupo", "grupos")} em ${plural(totalMun, "município", "municípios")}. Escolha onde e quando.` : "Escolha onde e quando."}</p>
            </div>
          </div>
          <div>
            <label htmlFor="h-municipio" className={field.label}>Município</label>
            <select id="h-municipio" name="municipio" defaultValue="" className={field.input}>
              <option value="">Todos</option>
              {opts.municipios.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="h-dia" className={field.label}>Dia</label>
            <select id="h-dia" name="dia" defaultValue="" className={field.input}>
              <option value="">Qualquer dia</option>
              {WEEKDAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{cap(d.label)}</option>)}
            </select>
          </div>
          <button className={btn.primario}>Buscar grupos</button>
        </form>
      </Container>

      {/* ───── Caminhos: por onde explorar ───── */}
      <section aria-labelledby="caminhos" className="py-20 sm:py-24">
        <Container>
          <SectionHead id="caminhos" title="Por onde começar" intro="Tudo o que a RCC da Arquidiocese oferece, a um clique." />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
            <li className="caminho estandarte textura-losangos sobre-estandarte group rounded-[var(--radius-lg)] p-8 sm:col-span-2 lg:row-span-2">
              <IconeChama className="caminho-icone h-14 w-14 text-ouro" />
              <h3 className="mt-6 font-display text-[2.2rem] font-normal leading-tight">
                <Link href="/grupos" className="!text-white no-underline after:absolute after:inset-0">Grupos de Oração</Link>
              </h3>
              <p className="mt-3 max-w-md text-lg text-marfim-texto">O coração da Renovação: louvor, Palavra e partilha toda semana, perto de você.</p>
              <p className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-prata">
                <span><span className="font-display text-4xl text-ouro">{totalGrupos}</span> {totalGrupos === 1 ? "grupo" : "grupos"}</span>
                <span><span className="font-display text-4xl text-ouro">{totalMun}</span> {totalMun === 1 ? "município" : "municípios"}</span>
              </p>
              <p aria-hidden="true" className="mt-8 font-semibold text-ouro-suave"><span className="caminho-ir">Ver todos os grupos e o mapa</span></p>
            </li>
            {[
              { href: "/agenda", t: "Agenda", d: "Retiros, encontros e formações com inscrição on-line.", I: IconeCalendario, ir: "Ver eventos" },
              { href: "/formacao", t: "Formação", d: "Textos para crescer na fé e servir melhor.", I: IconeLivro, ir: "Ler conteúdos" },
              { href: "/ministerios", t: "Ministérios", d: "Música, intercessão, pregação, jovens e muito mais.", I: IconePomba, ir: "Conhecer" },
              { href: "/pedido-de-oracao", t: "Pedido de oração", d: "A equipe de intercessão reza pela sua intenção.", I: IconeMaos, ir: "Enviar pedido" },
            ].map(({ href, t, d, I, ir }) => (
              <li key={href} className="caminho group rounded-[var(--radius-lg)] border border-linha bg-papel p-6 hover:border-ouro-suave hover:shadow-[var(--sombra-alta)] focus-within:border-ouro-suave">
                <I className="caminho-icone h-11 w-11 text-marca" />
                <h3 className="mt-5 text-[1.35rem]"><Link href={href} className="text-tinta no-underline after:absolute after:inset-0 group-hover:text-marca-escuro">{t}</Link></h3>
                <p className="mt-2 text-tinta-2">{d}</p>
                <p aria-hidden="true" className="mt-4 font-semibold text-marca"><span className="caminho-ir">{ir}</span></p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ───── Agenda: o próximo encontro em destaque, os seguintes como calendário ───── */}
      <section aria-labelledby="proximos" className="bg-papel py-20 sm:py-24">
        <Container>
          <SectionHead id="proximos" title="Próximos encontros" href="/agenda" more="Agenda completa" />
          {!principal ? (
            <p className="mt-8 text-lg text-tinta-2">Nenhum evento publicado para os próximos dias. Os Grupos de Oração continuam se reunindo semanalmente: <Link href="/grupos">veja dias e horários</Link>.</p>
          ) : (
            <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
              {(() => {
                const p = dateParts(principal.start, principal.date);
                return (
                  <article className="estandarte textura-losangos sobre-estandarte group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] p-8 sm:p-10">
                    <p className="flex items-baseline gap-4" aria-hidden="true">
                      <span className="font-display text-[5.5rem] leading-none text-ouro">{p.dia}</span>
                      <span className="leading-tight"><span className="block font-titulo text-xl italic text-ouro-suave">{p.mes}</span><span className="block text-prata">{cap(p.semana)}{p.hora ? `, ${p.hora}` : ""}</span></span>
                    </p>
                    <h3 className="mt-6 font-display text-[2rem] font-normal leading-tight">
                      <Link href={`/agenda/${principal.ev.slug}`} className="!text-white no-underline after:absolute after:inset-0">
                        <span className="sr-only">{p.dia} de {p.mes}: </span>{principal.ev.title}
                      </Link>
                    </h3>
                    {principal.ev.location && <p className="mt-2 text-marfim-texto">{principal.location ?? principal.ev.location}</p>}
                    <div className="mt-5 flex flex-wrap gap-2">
                      {principal.ev.registrationEnabled && <Badge tone="sucesso">Inscrições abertas</Badge>}
                      {displayStatus(principal.ev) === "adiado" && <Badge tone="alerta">Adiado</Badge>}
                      <DemoBadge show={principal.ev.isDemo} />
                    </div>
                    <p aria-hidden="true" className="mt-auto pt-8 font-semibold text-ouro-suave group-hover:underline">{principal.ev.registrationEnabled ? "Ver detalhes e fazer inscrição" : "Ver detalhes"}</p>
                  </article>
                );
              })()}
              {seguintes.length > 0 && (
                <ol className="divide-y divide-linha self-start border-y border-linha">
                  {seguintes.map((o) => {
                    const p = dateParts(o.start, o.date);
                    return (
                      <li key={`${o.eventId}-${o.key}`} className="group relative grid grid-cols-[4.5rem_1fr] gap-5 py-6">
                        <p className="text-center leading-none" aria-hidden="true">
                          <span className="block font-display text-[2.8rem] text-marca">{p.dia}</span>
                          <span className="mt-1 block font-titulo italic text-sol-texto">{p.mes}</span>
                        </p>
                        <div>
                          <h3 className="text-xl"><Link href={`/agenda/${o.ev.slug}`} className="text-tinta no-underline after:absolute after:inset-0 group-hover:text-marca-escuro group-hover:underline"><span className="sr-only">{p.dia} de {p.mes}: </span>{o.ev.title}</Link></h3>
                          <p className="mt-1 text-tinta-2">{cap(p.semana)}{p.hora ? `, às ${p.hora}` : ", dia inteiro"}</p>
                          {o.ev.location && <p className="text-tinta-3">{o.location ?? o.ev.location}</p>}
                          {(o.ev.registrationEnabled || o.ev.isDemo) && <div className="mt-2 flex flex-wrap gap-2">{o.ev.registrationEnabled && <Badge tone="sucesso">Inscrições abertas</Badge>}<DemoBadge show={o.ev.isDemo} /></div>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
        </Container>
      </section>

      {/* ───── A Palavra: Pentecostes, a origem da Renovação ───── */}
      <section aria-labelledby="palavra" className="estandarte textura-losangos sobre-estandarte relative isolate overflow-hidden py-24 sm:py-28">
        <div aria-hidden="true" className="raios -z-10 opacity-80 [inset:-30%_-10%_-30%_-10%]" />
        <Container narrow className="text-center">
          <div aria-hidden="true" className="mx-auto mb-10 h-3 w-3 rotate-45 bg-ouro" />
          <h2 id="palavra" className="sr-only">A Palavra</h2>
          <blockquote>
            <p className="font-display text-[2.3rem] leading-[1.15] text-white sm:text-[3.4rem]">“Todos ficaram cheios do Espírito Santo.”</p>
            <footer className="mt-5 font-titulo text-lg italic text-ouro-suave">Atos dos Apóstolos 2,4</footer>
          </blockquote>
          <p className="mx-auto mt-8 max-w-xl text-lg text-marfim-texto">A Renovação Carismática Católica vive a graça de Pentecostes: a experiência pessoal do amor de Deus, a oração de louvor e a vida em comunidade.</p>
          <div className="mt-9"><ButtonLink href="/a-rcc" variant="claro">Conheça a nossa história</ButtonLink></div>
        </Container>
      </section>

      {/* ───── Notícias ───── */}
      <section aria-labelledby="noticias" className="py-20 sm:py-24">
        <Container>
          <SectionHead id="noticias" title="Notícias da Arquidiocese" href="/noticias" more="Todas as notícias" />
          {!destaque ? (
            <p className="mt-8 text-lg text-tinta-2">Ainda não há notícias publicadas.</p>
          ) : (
            <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
              <article className="group relative rounded-[var(--radius-lg)] border border-linha bg-papel p-8 shadow-[var(--sombra)] transition-shadow hover:shadow-[var(--sombra-alta)] sm:p-10">
                <div aria-hidden="true" className="mb-6 h-1 w-16 bg-ouro" />
                <p className="text-sm text-tinta-3"><time dateTime={new Date(destaque.published_at).toISOString()}>{fmtPublished(destaque.published_at)}</time> <DemoBadge show={destaque.is_demo} /></p>
                <h3 className="mt-3 font-display text-[2rem] font-normal leading-tight sm:text-[2.5rem]">
                  <Link href={`/noticias/${destaque.slug}`} className="text-tinta no-underline after:absolute after:inset-0 group-hover:text-marca-escuro">{destaque.title}</Link>
                </h3>
                {destaque.summary && <p className="mt-4 max-w-prose text-lg text-tinta-2">{destaque.summary}</p>}
                <p aria-hidden="true" className="mt-6 font-semibold text-marca group-hover:underline">Ler a notícia</p>
              </article>
              {outras.length > 0 && (
                <ul className="grid gap-4">
                  {outras.map((n) => (
                    <li key={n.id} className="group relative rounded-[var(--radius-lg)] border border-linha bg-papel p-6 transition-[border-color,box-shadow] hover:border-ouro-suave hover:shadow-[var(--sombra)]">
                      <p className="text-sm text-tinta-3"><time dateTime={new Date(n.published_at).toISOString()}>{fmtPublished(n.published_at)}</time> <DemoBadge show={n.is_demo} /></p>
                      <h3 className="mt-1 text-lg"><Link href={`/noticias/${n.slug}`} className="text-tinta no-underline after:absolute after:inset-0 group-hover:text-marca-escuro group-hover:underline">{n.title}</Link></h3>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Container>
      </section>

      {/* ───── Formação e ministérios ───── */}
      <section aria-label="Formação e ministérios" className="border-y border-linha bg-marfim-2/70 py-20 sm:py-24">
        <Container className="grid gap-16 lg:grid-cols-2">
          <div>
            <SectionHead id="formacao" title="Formação" href="/formacao" more="Ver formação" />
            {formacao.length === 0 ? <p className="mt-6 text-tinta-2">Os primeiros conteúdos de formação estão em revisão.</p> : (
              <ul className="mt-6 divide-y divide-linha border-y border-linha">
                {formacao.map((f) => (
                  <li key={f.id} className="group relative flex gap-4 py-5">
                    <IconeLivro className="mt-0.5 h-7 w-7 shrink-0 text-sol-texto" />
                    <div>
                      <h3 className="text-lg"><Link href={`/formacao/${f.slug}`} className="text-tinta no-underline after:absolute after:inset-0 group-hover:text-marca-escuro group-hover:underline">{f.title}</Link></h3>
                      {f.summary && <p className="mt-1 text-tinta-2">{f.summary}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <SectionHead id="ministerios" title="Ministérios" href="/ministerios" more="Todos os ministérios" />
            {ministerios.length === 0 ? <p className="mt-6 text-tinta-2">A lista de ministérios será publicada após confirmação da coordenação.</p> : (
              <ul className="mt-6 flex flex-wrap gap-3">
                {ministerios.map((m) => (
                  <li key={m.id}>
                    <Link href={`/ministerios/${m.slug}`} className="inline-flex items-center gap-2.5 rounded-full border border-linha bg-papel px-5 py-3 font-titulo text-tinta no-underline transition-colors hover:border-ouro-suave hover:bg-estandarte hover:!text-white">
                      <span aria-hidden="true" className="h-2 w-2 shrink-0 rotate-45 bg-ouro" />{m.name} <DemoBadge show={m.isDemo} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Container>
      </section>

      {/* Vídeo em destaque: só aparece quando configurado; o player só carrega após o clique */}
      {instituicaoHome.videoDestaque && (
        <section aria-labelledby="video" className="py-20">
          <Container narrow>
            <h2 id="video" className="text-[2.1rem]">Em destaque</h2>
            <div className="mt-6"><LazyVideo id={instituicaoHome.videoDestaque.youtubeId} title={instituicaoHome.videoDestaque.titulo} /></div>
          </Container>
        </section>
      )}

      {/* ───── Pedido de oração ───── */}
      <section aria-labelledby="oracao" className="pt-20 sm:pt-24">
        <Container>
          <div className="estandarte textura-losangos sobre-estandarte relative grid items-center gap-8 overflow-hidden rounded-[var(--radius-lg)] p-8 sm:p-12 md:grid-cols-[auto_1fr_auto]">
            <IconeMaos className="h-20 w-20 text-ouro" />
            <div>
              <h2 id="oracao" className="text-[2.1rem] sm:text-[2.5rem]">Precisa de oração?</h2>
              <p className="mt-2 max-w-xl text-lg text-marfim-texto">Envie sua intenção. Ela é lida somente pela equipe de intercessão e não é publicada.</p>
            </div>
            <ButtonLink href="/pedido-de-oracao" variant="ouro">Enviar pedido de oração</ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
