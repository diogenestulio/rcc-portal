import type { Metadata } from "next";
import Link from "next/link";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import { env } from "@/lib/env";
import { publicCatalog, publicCategories } from "@/server/store/catalog";
import { formatBRL } from "@/server/store/checkout";
import { publicUrl } from "@/server/media";
import { Badge, btn, Container, DemoBadge, EmptyState, field, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Loja", description: "Livros, materiais de formação e artigos religiosos." };

export default async function Loja({ searchParams }: PageProps<"/loja">) {
  if (!env.STORE_ENABLED) {
    return (
      <>
        <PageHeader title="Loja" intro="Livros, materiais de formação e artigos religiosos." />
        <Container narrow className="py-10">
          <EmptyState title="Loja em preparação">
            As vendas online serão abertas após a definição da entidade responsável, do atendimento e das políticas de entrega, troca e reembolso.
          </EmptyState>
        </Container>
      </>
    );
  }
  const sp = await searchParams;
  const categoria = typeof sp.categoria === "string" ? sp.categoria : undefined;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : undefined;
  const [items, cats] = await Promise.all([publicCatalog(db, { categoria, q }), publicCategories(db)]);
  const covers = items.filter((p) => p.coverMediaId).map((p) => p.coverMediaId!);
  const imgs = covers.length ? await db.select().from(media).where(inArray(media.id, covers)) : [];

  return (
    <>
      <PageHeader title="Loja" intro="Livros, materiais de formação e artigos religiosos.">
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/carrinho" className={btn.secundario}>Ver carrinho</Link>
        </div>
      </PageHeader>
      <Container className="py-10">
        <form role="search" method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-60 flex-1"><label htmlFor="q" className={field.label}>Buscar produto</label><input id="q" name="q" type="search" defaultValue={q ?? ""} className={field.input} /></div>
          {cats.length > 0 && (
            <div><label htmlFor="categoria" className={field.label}>Categoria</label>
              <select id="categoria" name="categoria" defaultValue={categoria ?? ""} className={field.input}><option value="">Todas</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          )}
          <button className={btn.primario}>Filtrar</button>
          {(q || categoria) && <Link href="/loja" className={btn.discreto}>Limpar</Link>}
        </form>
        {items.length === 0 ? <div className="mt-8"><EmptyState title="Nenhum produto encontrado" /></div> : (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => {
              const img = imgs.find((m) => m.id === p.coverMediaId);
              return (
                <li key={p.id} className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-linha bg-papel">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={publicUrl(img, 640)} alt={img.altText ?? ""} width={img.width ?? undefined} height={img.height ?? undefined} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  ) : <div className="aspect-[4/3] w-full bg-marfim-2" aria-hidden="true" />}
                  <div className="flex flex-1 flex-col p-4">
                    <p className="flex gap-2 text-sm text-tinta-3">{p.category}<DemoBadge show={p.isDemo} /></p>
                    <h2 className="mt-1 text-lg font-semibold"><Link href={`/loja/${p.slug}`} className="text-tinta no-underline hover:underline">{p.name}</Link></h2>
                    <p className="mt-auto pt-3 font-semibold text-vinho">{p.variants > 1 ? "a partir de " : ""}{formatBRL(p.fromCents!)}</p>
                    {!p.available && <div className="mt-2"><Badge>Esgotado</Badge></div>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </>
  );
}
