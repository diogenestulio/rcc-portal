import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { getPublished, listPublished } from "@/server/content";
import { Badge, btn, Container, DemoBadge, EmptyState, PageHeader } from "@/components/ui";
import { fmtPublished } from "./format";
import { instituicaoProvisoria as INST } from "@/config/instituicao";

const NATURE_LABEL: Record<string, string> = {
  doutrina: "Formação doutrinal", orientacao_pastoral: "Orientação pastoral", devocao: "Devoção",
  testemunho: "Testemunho pessoal", institucional: "Institucional", noticia: "Notícia",
};

export async function ContentList({ kind, base, title, intro, page = 1 }: { kind: "noticia" | "formacao" | "pagina"; base: string; title: string; intro?: string; page?: number }) {
  const per = 12;
  const items = await listPublished(db, kind, per + 1, (page - 1) * per);
  const more = items.length > per;
  return (
    <>
      <PageHeader title={title} intro={intro} />
      <Container className="py-10">
        {items.length === 0 ? <EmptyState title="Ainda não há conteúdos publicados aqui">Os conteúdos passam por revisão antes de serem publicados.</EmptyState> : (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.slice(0, per).map((n) => (
              <li key={n.id} className="rounded-[var(--radius-lg)] border border-linha bg-papel elevar p-5">
                <article>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-tinta-3">
                    {kind !== "pagina" && <time dateTime={new Date(n.published_at).toISOString()}>{fmtPublished(n.published_at)}</time>}
                    {kind === "formacao" && <Badge tone="marca">{NATURE_LABEL[n.nature]}</Badge>}
                    <DemoBadge show={n.is_demo} />
                  </p>
                  <h2 className="mt-2 text-xl font-semibold"><Link href={`${base}/${n.slug}`} className="text-tinta no-underline hover:underline">{n.title}</Link></h2>
                  {n.summary && <p className="mt-2 text-tinta-2">{n.summary}</p>}
                </article>
              </li>
            ))}
          </ul>
        )}
        {(page > 1 || more) && (
          <nav aria-label="Paginação" className="mt-8 flex justify-center gap-3">
            {page > 1 && <Link className={btn.secundario} href={`${base}?pagina=${page - 1}`}>Anteriores</Link>}
            {more && <Link className={btn.secundario} href={`${base}?pagina=${page + 1}`}>Mais antigos</Link>}
          </nav>
        )}
      </Container>
    </>
  );
}

export async function ContentPage({ kind, slug, back }: { kind: "noticia" | "formacao" | "pagina"; slug: string; back: { href: string; label: string } }) {
  const c = await getPublished(db, kind, slug);
  if (!c) notFound();
  return (
    <Container narrow className="py-10">
      <nav aria-label="Trilha"><Link href={back.href}>← {back.label}</Link></nav>
      <article className="mt-4">
        <header>
          <p className="flex flex-wrap items-center gap-2 text-sm text-tinta-3">
            {kind !== "pagina" && <time dateTime={new Date(c.published_at).toISOString()}>{fmtPublished(c.published_at)}</time>}
            {kind === "formacao" && <Badge tone="marca">{NATURE_LABEL[c.nature]}</Badge>}
            <DemoBadge show={c.is_demo} />
          </p>
          <h1 className="mt-2 text-display font-semibold">{c.title}</h1>
          {c.summary && <p className="mt-3 text-lg text-tinta-2">{c.summary}</p>}
          {c.author_name && <p className="mt-3 text-sm text-tinta-3">Por {c.author_name}</p>}
        </header>
        <div className="prosa mt-8" dangerouslySetInnerHTML={{ __html: c.body_html }} />
        {(c.source_reference || c.rights_notice || kind === "formacao") && (
          <footer className="mt-10 space-y-1 border-t border-linha pt-4 text-sm text-tinta-3">
            {c.source_reference && <p>Fontes: {c.source_reference}</p>}
            {c.rights_notice && <p>Direitos: {c.rights_notice}</p>}
            {kind === "formacao" && <p>Conteúdo revisado pela equipe designada pela {INST.nomePublico} em {fmtPublished(c.approved_at)}. Esta revisão não constitui aprovação eclesiástica formal (imprimatur).</p>}
          </footer>
        )}
      </article>
    </Container>
  );
}

export const pageNum = (v: unknown) => { const n = Number(Array.isArray(v) ? v[0] : v); return Number.isInteger(n) && n > 0 && n < 500 ? n : 1; };
