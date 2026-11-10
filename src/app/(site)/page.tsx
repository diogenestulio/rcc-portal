import Link from "next/link";
import { db } from "@/db";
import { agenda, displayStatus } from "@/server/events";
import { listPublished } from "@/server/content";
import { ministry } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Badge, ButtonLink, Card, Container, DemoBadge, EmptyState } from "@/components/ui";
import { fmtDateOnly, fmtDay, fmtPublished, fmtTime } from "@/components/site/format";
import { LazyVideo } from "@/components/site/LazyVideo";
import { instituicaoHome } from "@/config/instituicao";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function Home() {
  const now = new Date();
  const [proximos, noticias, formacao, ministerios] = await Promise.all([
    agenda(db, now, new Date(now.getTime() + 60 * 86_400_000)),
    listPublished(db, "noticia", 3),
    listPublished(db, "formacao", 3),
    db.select().from(ministry).where(eq(ministry.published, true)).limit(6),
  ]);
  const eventos = proximos.filter((o) => !o.cancelled).slice(0, 4);

  return (
    <>
      {/* 2. Destaque: mensagem curta + duas ações. Sem carrossel, sem produtos. */}
      <section aria-labelledby="destaque" className="relative overflow-hidden border-b border-linha bg-[radial-gradient(ellipse_at_top_right,var(--color-vinho-claro),transparent_60%)]">
        <Container className="grid items-center gap-10 py-14 sm:py-20 md:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-dourado-texto">Renovação Carismática Católica</p>
            <h1 id="destaque" className="mt-3 text-display font-semibold">
              Há um lugar para você rezar conosco.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-tinta-2">
              Os Grupos de Oração se reúnem toda semana nas paróquias da Arquidiocese para louvar a Deus, ouvir a Palavra e
              acolher quem chega. Encontre o mais perto de você.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/grupos">Encontre um Grupo de Oração</ButtonLink>
              <ButtonLink href="/agenda" variant="secundario">Veja a agenda</ButtonLink>
            </div>
          </div>
          {/* Sem fotografias autorizadas ainda: composição gráfica estática, sem imagem de pessoas ou eventos. */}
          <div aria-hidden="true" className="hidden justify-self-center md:block">
            <svg viewBox="0 0 220 260" className="h-72 w-auto">
              <defs>
                <linearGradient id="chama" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#7a2335" /><stop offset="1" stopColor="#b8912f" /></linearGradient>
              </defs>
              <circle cx="110" cy="130" r="104" fill="none" stroke="#e3dacb" />
              <circle cx="110" cy="130" r="78" fill="none" stroke="#e3dacb" strokeDasharray="2 6" />
              <path d="M110 40c18 30 44 50 44 92a44 44 0 0 1-88 0c0-22 10-37 21-50 1 14 7 23 16 28-2-25 0-45 7-70Z" fill="url(#chama)" opacity=".92" />
              <path d="M110 132c10 10 16 19 16 29a16 16 0 0 1-32 0c0-10 6-19 16-29Z" fill="#fbf8f1" opacity=".9" />
            </svg>
          </div>
        </Container>
      </section>

      {/* 3. Próximos encontros e inscrições abertas */}
      <section aria-labelledby="proximos" className="py-14">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="proximos" className="text-3xl font-semibold">Próximos encontros</h2>
            <Link href="/agenda" className="font-semibold">Agenda completa →</Link>
          </div>
          {eventos.length === 0 ? (
            <div className="mt-6"><EmptyState title="Nenhum evento publicado para os próximos dias">Os Grupos de Oração continuam se reunindo semanalmente. <Link href="/grupos">Veja dias e horários</Link>.</EmptyState></div>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {eventos.map((o) => (
                <Card as="li" key={`${o.eventId}-${o.key}`} className="flex flex-col">
                  <p className="text-sm font-semibold text-dourado-texto">{o.start ? `${fmtDay(o.start)} · ${fmtTime(o.start)}` : fmtDateOnly(o.date!, { weekday: "short", day: "2-digit", month: "short" })}</p>
                  <h3 className="mt-1 text-lg font-semibold"><Link href={`/agenda/${o.ev.slug}`} className="text-tinta no-underline hover:underline">{o.ev.title}</Link></h3>
                  {o.ev.location && <p className="mt-1 text-tinta-2">{o.location ?? o.ev.location}</p>}
                  <div className="mt-auto flex flex-wrap gap-2 pt-3">
                    {o.ev.registrationEnabled && <Badge tone="sucesso">Inscrições</Badge>}
                    {displayStatus(o.ev) === "adiado" && <Badge tone="alerta">Adiado</Badge>}
                    <DemoBadge show={o.ev.isDemo} />
                  </div>
                </Card>
              ))}
            </ul>
          )}
        </Container>
      </section>

      {/* 4. Notícias */}
      <section aria-labelledby="noticias" className="border-y border-linha bg-papel py-14">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="noticias" className="text-3xl font-semibold">Notícias da Arquidiocese</h2>
            <Link href="/noticias" className="font-semibold">Todas as notícias →</Link>
          </div>
          {noticias.length === 0 ? (
            <div className="mt-6"><EmptyState title="Ainda não há notícias publicadas" /></div>
          ) : (
            <ul className="mt-6 grid gap-6 md:grid-cols-3">
              {noticias.map((n) => (
                <li key={n.id}>
                  <article>
                    <p className="text-sm text-tinta-3"><time dateTime={new Date(n.published_at).toISOString()}>{fmtPublished(n.published_at)}</time> <DemoBadge show={n.is_demo} /></p>
                    <h3 className="mt-1 text-xl font-semibold"><Link href={`/noticias/${n.slug}`} className="text-tinta no-underline hover:underline">{n.title}</Link></h3>
                    {n.summary && <p className="mt-2 text-tinta-2">{n.summary}</p>}
                  </article>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </section>

      {/* 5. Formação, ministérios e vida dos grupos */}
      <section aria-labelledby="formacao" className="py-14">
        <Container className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 id="formacao" className="text-3xl font-semibold">Formação</h2>
            {formacao.length === 0 ? <p className="mt-4 text-tinta-2">Os primeiros conteúdos de formação estão em revisão.</p> : (
              <ul className="mt-5 divide-y divide-linha border-y border-linha">
                {formacao.map((f) => (
                  <li key={f.id} className="py-4">
                    <Link href={`/formacao/${f.slug}`} className="font-titulo text-lg font-semibold text-tinta no-underline hover:underline">{f.title}</Link>
                    {f.summary && <p className="text-tinta-2">{f.summary}</p>}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4"><Link href="/formacao" className="font-semibold">Ver formação →</Link></p>
          </div>
          <div>
            <h2 className="text-3xl font-semibold">Ministérios</h2>
            {ministerios.length === 0 ? <p className="mt-4 text-tinta-2">A lista de ministérios será publicada após confirmação da coordenação.</p> : (
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {ministerios.map((m) => (
                  <li key={m.id}><Link href={`/ministerios/${m.slug}`} className="block rounded-[var(--radius-md)] border border-linha bg-papel px-4 py-3 font-semibold text-tinta no-underline hover:border-vinho">{m.name} <DemoBadge show={m.isDemo} /></Link></li>
                ))}
              </ul>
            )}
          </div>
        </Container>
      </section>

      {/* 6. Vídeo em destaque — só carrega o player após o clique */}
      {(instituicaoHome.videoDestaque || env.APP_ENV === "development") && (
        <section aria-labelledby="video" className="border-t border-linha bg-marfim-2/60 py-14">
          <Container narrow>
            <h2 id="video" className="text-3xl font-semibold">Em destaque</h2>
            {instituicaoHome.videoDestaque
              ? <div className="mt-6"><LazyVideo id={instituicaoHome.videoDestaque.youtubeId} title={instituicaoHome.videoDestaque.titulo} /></div>
              : <div className="mt-6"><EmptyState title="Nenhum vídeo configurado">Configure <code>videoDestaque</code> em <code>src/config/instituicao.ts</code>. (Aviso visível só em desenvolvimento.)</EmptyState></div>}
          </Container>
        </section>
      )}

      {/* 7. Chamada discreta */}
      <section aria-label="Colaboração" className="py-14">
        <Container>
          <div className="flex flex-col items-start justify-between gap-4 rounded-[var(--radius-lg)] border border-linha bg-papel p-6 sm:flex-row sm:items-center">
            <div>
              <p className="font-titulo text-xl font-semibold">Precisa de oração?</p>
              <p className="text-tinta-2">Envie sua intenção. Ela é lida somente pela equipe de intercessão e não é publicada.</p>
            </div>
            <ButtonLink href="/pedido-de-oracao" variant="secundario">Enviar pedido de oração</ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
