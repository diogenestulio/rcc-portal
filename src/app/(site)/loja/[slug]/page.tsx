import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import { env } from "@/lib/env";
import { publicProduct } from "@/server/store/catalog";
import { formatBRL } from "@/server/store/checkout";
import { publicUrl } from "@/server/media";
import { btn, Container, DemoBadge, field, Notice } from "@/components/ui";
import { adicionar } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/loja/[slug]">): Promise<Metadata> {
  if (!env.STORE_ENABLED) return {};
  const r = await publicProduct(db, (await params).slug);
  return r ? { title: r.p.name, description: r.p.description?.slice(0, 160) } : {};
}

export default async function Produto({ params, searchParams }: PageProps<"/loja/[slug]">) {
  if (!env.STORE_ENABLED) notFound();
  const { slug } = await params;
  const sp = await searchParams;
  const r = await publicProduct(db, slug);
  if (!r) notFound();
  const { p, variants } = r;
  const [img] = p.coverMediaId ? await db.select().from(media).where(eq(media.id, p.coverMediaId)) : [];
  const algum = variants.some((v) => v.disponivel > 0);

  return (
    <Container className="py-10">
      <nav aria-label="Trilha"><Link href="/loja">← Loja</Link></nav>
      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={publicUrl(img)} srcSet={`${publicUrl(img, 640)} 640w, ${publicUrl(img, 1280)} 1280w, ${publicUrl(img)} 2400w`} sizes="(max-width: 768px) 100vw, 50vw"
              alt={img.altText ?? ""} width={img.width ?? undefined} height={img.height ?? undefined} className="w-full rounded-[var(--radius-lg)] border border-linha" />
          ) : <div className="aspect-square w-full rounded-[var(--radius-lg)] bg-marfim-2" aria-hidden="true" />}
          {img?.credit && <p className="mt-2 text-xs text-tinta-3">{img.credit}</p>}
        </div>
        <div>
          <p className="flex gap-2 text-sm text-tinta-3">{p.category}<DemoBadge show={p.isDemo} /></p>
          <h1 className="mt-1 text-display font-semibold">{p.name}</h1>
          {sp.erro && <div className="mt-4"><Notice tone="perigo">Esta opção ficou indisponível. Escolha outra.</Notice></div>}
          {p.description && <div className="prosa mt-4 whitespace-pre-line text-tinta-2">{p.description}</div>}
          {!algum ? <div className="mt-6"><Notice tone="alerta">Produto esgotado no momento.</Notice></div> : (
            <form action={adicionar} className="mt-8 space-y-5">
              <input type="hidden" name="slug" value={p.slug} />
              <fieldset>
                <legend className={field.label}>{variants.length > 1 ? "Escolha a opção" : "Opção"}</legend>
                <div className="mt-2 space-y-2">
                  {variants.map((v, i) => (
                    <label key={v.id} className={`flex min-h-12 items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-linha bg-papel px-3 ${v.disponivel ? "" : "opacity-60"}`}>
                      <span className="flex items-center gap-3">
                        <input type="radio" name="variante" value={v.id} required disabled={!v.disponivel} defaultChecked={v.disponivel > 0 && i === variants.findIndex((x) => x.disponivel > 0)} />
                        {v.label}
                      </span>
                      <span className="font-semibold">{formatBRL(v.priceCents)}{!v.disponivel && <span className="ml-2 text-sm font-normal text-tinta-3">esgotado</span>}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="max-w-32">
                <label htmlFor="quantidade" className={field.label}>Quantidade</label>
                <input id="quantidade" name="quantidade" type="number" min={1} max={20} defaultValue={1} className={field.input} />
              </div>
              <button className={btn.primario}>Adicionar ao carrinho</button>
              <p className="text-sm text-tinta-3">Preço e disponibilidade são confirmados na finalização da compra.</p>
            </form>
          )}
        </div>
      </div>
    </Container>
  );
}
