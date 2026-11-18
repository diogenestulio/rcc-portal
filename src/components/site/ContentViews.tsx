import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { db } from "@/db";
import { getPublished, listPublished, type ListedContent, type PublicContent } from "@/server/content";
import { publicUrl } from "@/server/media";
import { Badge, btn, Container, DemoBadge, EmptyState, PageHeader } from "@/components/ui";
import { fmtDateOnly, fmtPublished } from "./format";
import { LazyVideo } from "./LazyVideo";
import { instituicaoProvisoria as INST } from "@/config/instituicao";

const NATURE_LABEL: Record<string, string> = {
  doutrina: "Formação doutrinal", orientacao_pastoral: "Orientação pastoral", devocao: "Devoção",
  testemunho: "Testemunho pessoal", institucional: "Institucional", noticia: "Notícia",
};

type Kind = "noticia" | "formacao" | "pagina" | "igreja";

/** Período de um acontecimento ("16 de maio de 2027" ou "3 a 8 de agosto de 2027"). */
export function periodo(ini: string | null, fim: string | null) {
  if (!ini) return null;
  if (!fim || fim === ini) return fmtDateOnly(ini, { day: "numeric", month: "long", year: "numeric" });
  const [a, b] = [new Date(`${ini}T12:00:00Z`), new Date(`${fim}T12:00:00Z`)];
  const mesmoMes = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
  return mesmoMes
    ? `${a.getUTCDate()} a ${fmtDateOnly(fim, { day: "numeric", month: "long", year: "numeric" })}`
    : `${fmtDateOnly(ini, { day: "numeric", month: "long" })} a ${fmtDateOnly(fim, { day: "numeric", month: "long", year: "numeric" })}`;
}

/** Imagem de capa vinda da biblioteca (já redimensionada no servidor). */
export function Capa({ c, w = 1280, className, priority }: { c: Pick<ListedContent, "cover_id" | "cover_key" | "cover_alt" | "cover_w" | "cover_h">; w?: 640 | 1280; className?: string; priority?: boolean }) {
  if (!c.cover_id || !c.cover_key) return null;
  const m = { id: c.cover_id, storageKey: c.cover_key };
  return (
    // eslint-disable-next-line @next/next/no-img-element -- variantes já otimizadas pela biblioteca de mídia
    <img src={publicUrl(m, w)} srcSet={`${publicUrl(m, 640)} 640w, ${publicUrl(m, 1280)} 1280w`} sizes="(max-width: 768px) 100vw, 768px"
      alt={c.cover_alt ?? ""} width={c.cover_w ?? undefined} height={c.cover_h ?? undefined}
      loading={priority ? "eager" : "lazy"} decoding="async" className={className} />
  );
}

/** Corpo do texto: os marcadores de vídeo viram players que só carregam após o clique. */
export function Corpo({ html }: { html: string }) {
  const parts = html.split(/(<p data-video="[A-Za-z0-9_-]+" data-titulo="[^"]*">.*?<\/p>)/g);
  return (
    <div className="prosa mt-8">
      {parts.map((p, i) => {
        const v = /^<p data-video="([A-Za-z0-9_-]+)" data-titulo="([^"]*)">/.exec(p);
        if (v) {
          const titulo = v[2].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
          return <div key={i} className="not-prose my-8"><LazyVideo id={v[1]} title={titulo} /></div>;
        }
        return p.trim() ? <Fragment key={i}><div dangerouslySetInnerHTML={{ __html: p }} className="[&>*+*]:mt-[1em]" /></Fragment> : null;
      })}
    </div>
  );
}

export async function ContentList({ kind, base, title, intro, page = 1 }: { kind: Exclude<Kind, "igreja">; base: string; title: string; intro?: string; page?: number }) {
  const per = 12;
  const items = await listPublished(db, kind, per + 1, (page - 1) * per);
  const more = items.length > per;
  return (
    <>
      <PageHeader title={title} intro={intro} />
      <Container className="py-12">
        {items.length === 0 ? <EmptyState title="Ainda não há conteúdos publicados aqui">Os conteúdos passam por revisão antes de serem publicados.</EmptyState> : (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.slice(0, per).map((n) => (
              <li key={n.id} className="group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-linha bg-papel elevar">
                <Capa c={n} w={640} className="aspect-[16/9] w-full object-cover" />
                <article className="flex flex-1 flex-col p-6">
                  <p className="flex flex-wrap items-center gap-2 text-sm text-tinta-3">
                    {kind !== "pagina" && <time dateTime={new Date(n.published_at).toISOString()}>{fmtPublished(n.published_at)}</time>}
                    {kind === "formacao" && <Badge tone="marca">{NATURE_LABEL[n.nature]}</Badge>}
                    <DemoBadge show={n.is_demo} />
                  </p>
                  <h2 className="mt-2 font-titulo text-xl font-bold"><Link href={`${base}/${n.slug}`} className="text-tinta no-underline after:absolute after:inset-0 group-hover:text-marca-escuro group-hover:underline">{n.title}</Link></h2>
                  {n.summary && <p className="mt-2 text-tinta-2">{n.summary}</p>}
                </article>
              </li>
            ))}
          </ul>
        )}
        {(page > 1 || more) && (
          <nav aria-label="Paginação" className="mt-10 flex justify-center gap-3">
            {page > 1 && <Link className={btn.secundario} href={`${base}?pagina=${page - 1}`}>Anteriores</Link>}
            {more && <Link className={btn.secundario} href={`${base}?pagina=${page + 1}`}>Mais antigos</Link>}
          </nav>
        )}
      </Container>
    </>
  );
}

export async function ContentPage({ kind, slug, back }: { kind: Kind; slug: string; back: { href: string; label: string } }) {
  const c = await getPublished(db, kind, slug);
  if (!c) notFound();
  return <Artigo c={c} kind={kind} back={back} />;
}

/** Corpo completo de um conteúdo publicado (usado também em /a-rcc, que mostra "Quem Somos" direto). */
export function Artigo({ c, kind, back, children }: { c: PublicContent; kind: Kind; back?: { href: string; label: string }; children?: React.ReactNode }) {
  const quando = periodo(c.event_date, c.event_end_date);
  return (
    <Container narrow className="py-10">
      {back && <nav aria-label="Trilha"><Link href={back.href}>← {back.label}</Link></nav>}
      <article className={back ? "mt-4" : ""}>
        <header>
          <p className="flex flex-wrap items-center gap-2 text-sm text-tinta-3">
            {kind !== "pagina" && <time dateTime={new Date(c.published_at).toISOString()}>{fmtPublished(c.published_at)}</time>}
            {kind === "formacao" && <Badge tone="marca">{NATURE_LABEL[c.nature]}</Badge>}
            <DemoBadge show={c.is_demo} />
          </p>
          <h1 className="mt-2 text-display">{c.title}</h1>
          {c.summary && <p className="mt-3 text-lg text-tinta-2">{c.summary}</p>}
          {c.author_name && <p className="mt-3 text-sm text-tinta-3">Por {c.author_name}</p>}
        </header>
        {c.cover_id && (
          <figure className="mt-8">
            <Capa c={c} priority className="w-full rounded-[var(--radius-lg)] object-cover" />
            {c.cover_credit && <figcaption className="mt-2 text-sm text-tinta-3">{c.cover_credit}</figcaption>}
          </figure>
        )}
        {(quando || c.event_place || c.external_url) && (
          <aside aria-label="Sobre o acontecimento" className="estandarte textura-losangos sobre-estandarte mt-8 grid gap-4 rounded-[var(--radius-lg)] p-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <dl className="grid gap-3 sm:grid-cols-2">
              {quando && <div><dt className="font-titulo italic text-ouro-suave">Quando</dt><dd className="text-lg text-white">{quando}</dd></div>}
              {c.event_place && <div><dt className="font-titulo italic text-ouro-suave">Onde</dt><dd className="text-lg text-white">{c.event_place}</dd></div>}
            </dl>
            {c.external_url && (
              <a href={c.external_url} rel="noopener noreferrer external" className={btn.ouro}>
                Fonte oficial<span className="sr-only"> (abre site externo: {new URL(c.external_url).hostname})</span>
              </a>
            )}
          </aside>
        )}
        <Corpo html={c.body_html} />
        {(c.source_reference || c.rights_notice || kind === "formacao") && (
          <footer className="mt-10 space-y-1 border-t border-linha pt-4 text-sm text-tinta-3">
            {c.source_reference && <p>Fontes: {c.source_reference}</p>}
            {c.rights_notice && <p>Direitos: {c.rights_notice}</p>}
            {kind === "formacao" && (c.is_demo
              ? <p>Conteúdo de demonstração: ainda não passou pela revisão da equipe designada.</p>
              : <p>Conteúdo revisado pela equipe designada pela {INST.nomePublico} em {fmtPublished(c.approved_at)}. Esta revisão não constitui aprovação eclesiástica formal (imprimatur).</p>)}
          </footer>
        )}
      </article>
      {children}
    </Container>
  );
}

export const pageNum = (v: unknown) => { const n = Number(Array.isArray(v) ? v[0] : v); return Number.isInteger(n) && n > 0 && n < 500 ? n : 1; };
