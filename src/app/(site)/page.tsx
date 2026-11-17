import Link from "next/link";
import Image from "next/image";
import { db } from "@/db";
import { agenda, displayStatus } from "@/server/events";
import { listPublished } from "@/server/content";
import { ministry } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Badge, ButtonLink, Container, DemoBadge, EmptyState } from "@/components/ui";
import { cap, dateParts, fmtPublished } from "@/components/site/format";
import { LazyVideo } from "@/components/site/LazyVideo";
import { instituicaoHome } from "@/config/instituicao";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Título de seção com o link "ver tudo" alinhado à direita. */
function SectionHead({ id, title, href, more }: { id: string; title: string; href?: string; more?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-linha pb-4">
      <h2 id={id} className="text-[2rem] sm:text-[2.4rem]">{title}</h2>
      {href && <Link href={href} className="font-semibold">{more}</Link>}
    </div>
  );
}

export default async function Home() {
  const now = new Date();
  const [proximos, noticias, formacao, ministerios] = await Promise.all([
    agenda(db, now, new Date(now.getTime() + 60 * 86_400_000)),
    listPublished(db, "noticia", 4),
    listPublished(db, "formacao", 3),
    db.select().from(ministry).where(eq(ministry.published, true)).orderBy(ministry.name).limit(8),
  ]);
  const eventos = proximos.filter((o) => !o.cancelled).slice(0, 4);
  const [destaque, ...outras] = noticias;

  return (
    <>
      {/* Abertura: o estandarte continua o cabeçalho; o brasão no medalhão de ouro é o elemento marcante. */}
      <section aria-labelledby="destaque" className="estandarte sobre-estandarte relative overflow-hidden">
        <Container className="grid items-center gap-12 pb-16 pt-12 sm:pb-24 sm:pt-20 md:grid-cols-[1.2fr_1fr]">
          <div>
            <div aria-hidden="true" className="mb-9 w-28 md:hidden">
              <div className="medalhao"><div className="medalhao-disco"><Image src="/marca/rcc-simbolo-192.webp" alt="" width={253} height={192} className="h-auto w-[64%]" /></div></div>
            </div>
            <h1 id="destaque" className="text-monumental">Há um lugar para você rezar conosco.</h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-marfim-texto sm:text-xl">
              Os Grupos de Oração se reúnem toda semana nas paróquias da Arquidiocese de Cuiabá para louvar a Deus,
              ouvir a Palavra e acolher quem chega. Encontre o mais perto de você.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <ButtonLink href="/grupos" variant="ouro">Encontrar um Grupo de Oração</ButtonLink>
              <ButtonLink href="/agenda" variant="claro">Ver a agenda</ButtonLink>
            </div>
          </div>
          {/* Sem fotografias autorizadas ainda: o brasão é o elemento gráfico (decorativo para leitores de tela). */}
          <div aria-hidden="true" className="hidden w-full max-w-[21rem] justify-self-center md:block lg:max-w-[23rem]">
            <div className="medalhao">
              <div className="medalhao-disco">
                <Image src="/marca/rcc-simbolo.png" alt="" width={283} height={215} priority className="h-auto w-[62%]" />
              </div>
            </div>
          </div>
        </Container>
        <div aria-hidden="true" className="filete-ouro no-claro" />
      </section>

      {/* Próximos encontros: a data é a informação principal, por isso vem grande, como num calendário. */}
      <section aria-labelledby="proximos" className="py-16 sm:py-20">
        <Container>
          <SectionHead id="proximos" title="Próximos encontros" href="/agenda" more="Agenda completa" />
          {eventos.length === 0 ? (
            <div className="mt-8"><EmptyState title="Nenhum evento publicado para os próximos dias">Os Grupos de Oração continuam se reunindo semanalmente. <Link href="/grupos">Veja dias e horários</Link>.</EmptyState></div>
          ) : (
            <ol className="mt-2 grid lg:grid-cols-2 lg:gap-x-12">
              {eventos.map((o) => {
                const p = dateParts(o.start, o.date);
                return (
                  <li key={`${o.eventId}-${o.key}`} className="group relative grid grid-cols-[4.5rem_1fr] gap-5 border-b border-linha py-6">
                    <p className="text-center leading-none" aria-hidden="true">
                      <span className="block font-display text-[2.9rem] text-marca">{p.dia}</span>
                      <span className="mt-1 block text-sm font-semibold text-sol-texto">{p.mes}</span>
                    </p>
                    <div>
                      <h3 className="text-xl">
                        <Link href={`/agenda/${o.ev.slug}`} className="text-tinta no-underline after:absolute after:inset-0 group-hover:text-marca-escuro group-hover:underline">{o.ev.title}</Link>
                      </h3>
                      <p className="mt-1 text-tinta-2"><span className="sr-only">{p.dia} de {p.mes}, </span>{cap(p.semana)}{p.hora ? `, às ${p.hora}` : ", dia inteiro"}</p>
                      {o.ev.location && <p className="text-tinta-3">{o.location ?? o.ev.location}</p>}
                      {(o.ev.registrationEnabled || displayStatus(o.ev) === "adiado" || o.ev.isDemo) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {o.ev.registrationEnabled && <Badge tone="sucesso">Inscrições abertas</Badge>}
                          {displayStatus(o.ev) === "adiado" && <Badge tone="alerta">Adiado</Badge>}
                          <DemoBadge show={o.ev.isDemo} />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Container>
      </section>

      {/* Notícias: uma em destaque e as demais em lista, como numa folha paroquial. */}
      <section aria-labelledby="noticias" className="bg-papel py-16 sm:py-20">
        <Container>
          <SectionHead id="noticias" title="Notícias da Arquidiocese" href="/noticias" more="Todas as notícias" />
          {!destaque ? (
            <div className="mt-8"><EmptyState title="Ainda não há notícias publicadas" /></div>
          ) : (
            <div className="mt-8 grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-14">
              <article className="group relative">
                <p className="text-sm text-tinta-3"><time dateTime={new Date(destaque.published_at).toISOString()}>{fmtPublished(destaque.published_at)}</time> <DemoBadge show={destaque.is_demo} /></p>
                <h3 className="mt-2 font-display text-[1.9rem] font-normal leading-tight sm:text-[2.3rem]">
                  <Link href={`/noticias/${destaque.slug}`} className="text-tinta no-underline after:absolute after:inset-0 group-hover:text-marca-escuro">{destaque.title}</Link>
                </h3>
                {destaque.summary && <p className="mt-4 max-w-prose text-lg text-tinta-2">{destaque.summary}</p>}
                <p aria-hidden="true" className="mt-5 font-semibold text-marca group-hover:underline">Ler a notícia</p>
              </article>
              {outras.length > 0 && (
                <ul className="divide-y divide-linha border-t border-linha lg:border-t-0 lg:border-l lg:pl-12">
                  {outras.map((n) => (
                    <li key={n.id} className="group relative py-5 first:pt-5 lg:first:pt-0">
                      <p className="text-sm text-tinta-3"><time dateTime={new Date(n.published_at).toISOString()}>{fmtPublished(n.published_at)}</time> <DemoBadge show={n.is_demo} /></p>
                      <h3 className="mt-1 text-lg">
                        <Link href={`/noticias/${n.slug}`} className="text-tinta no-underline after:absolute after:inset-0 group-hover:text-marca-escuro group-hover:underline">{n.title}</Link>
                      </h3>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Container>
      </section>

      {/* Formação e ministérios */}
      <section aria-label="Formação e ministérios" className="py-16 sm:py-20">
        <Container className="grid gap-14 lg:grid-cols-2">
          <div>
            <SectionHead id="formacao" title="Formação" href="/formacao" more="Ver formação" />
            {formacao.length === 0 ? <p className="mt-6 text-tinta-2">Os primeiros conteúdos de formação estão em revisão.</p> : (
              <ul className="divide-y divide-linha">
                {formacao.map((f) => (
                  <li key={f.id} className="group relative py-5">
                    <h3 className="text-lg"><Link href={`/formacao/${f.slug}`} className="text-tinta no-underline after:absolute after:inset-0 group-hover:text-marca-escuro group-hover:underline">{f.title}</Link></h3>
                    {f.summary && <p className="mt-1 text-tinta-2">{f.summary}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <SectionHead id="ministerios" title="Ministérios" href="/ministerios" more="Todos os ministérios" />
            {ministerios.length === 0 ? <p className="mt-6 text-tinta-2">A lista de ministérios será publicada após confirmação da coordenação.</p> : (
              <ul className="grid sm:grid-cols-2 sm:gap-x-8">
                {ministerios.map((m) => (
                  <li key={m.id} className="border-b border-linha">
                    <Link href={`/ministerios/${m.slug}`} className="flex items-center gap-3 py-4 font-titulo text-[1.05rem] text-tinta no-underline hover:text-marca-escuro">
                      <span aria-hidden="true" className="h-2 w-2 shrink-0 rotate-45 bg-ouro" />
                      <span>{m.name} <DemoBadge show={m.isDemo} /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Container>
      </section>

      {/* Vídeo em destaque: só carrega o player após o clique */}
      {(instituicaoHome.videoDestaque || env.APP_ENV === "development") && (
        <section aria-labelledby="video" className="bg-marfim-2/60 py-16">
          <Container narrow>
            <h2 id="video" className="text-[2rem]">Em destaque</h2>
            {instituicaoHome.videoDestaque
              ? <div className="mt-6"><LazyVideo id={instituicaoHome.videoDestaque.youtubeId} title={instituicaoHome.videoDestaque.titulo} /></div>
              : <div className="mt-6"><EmptyState title="Nenhum vídeo configurado">Configure <code>videoDestaque</code> em <code>src/config/instituicao.ts</code>. (Aviso visível só em desenvolvimento.)</EmptyState></div>}
          </Container>
        </section>
      )}

      {/* Pedido de oração: faixa serena, sem apelo comercial */}
      <section aria-labelledby="oracao" className="pt-8">
        <Container narrow className="text-center">
          <div aria-hidden="true" className="filete-ouro no-claro mx-auto mb-12 max-w-xs" />
          <h2 id="oracao" className="text-[2rem] sm:text-[2.4rem]">Precisa de oração?</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-tinta-2">Envie sua intenção. Ela é lida somente pela equipe de intercessão e não é publicada.</p>
          <div className="mt-8"><ButtonLink href="/pedido-de-oracao">Enviar pedido de oração</ButtonLink></div>
        </Container>
      </section>
    </>
  );
}
