import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { searchPublic } from "@/server/search";
import { btn, Container, EmptyState, field, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Busca", robots: { index: false, follow: true } };

const HREF = { conteudo: { noticia: "/noticias", formacao: "/formacao", pagina: "/a-rcc", comunicado: "/noticias" } as Record<string, string>, grupo: "/grupos", evento: "/agenda" };
const TYPE = { conteudo: "Conteúdo", grupo: "Grupo de Oração", evento: "Evento" };

export default async function Busca({ searchParams }: PageProps<"/busca">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const hits = q ? await searchPublic(db, q) : [];
  return (
    <>
      <PageHeader title="Buscar no portal" />
      <Container narrow className="py-10">
        <form role="search" method="get" className="flex gap-2">
          <label htmlFor="q" className="sr-only">Termo de busca</label>
          <input id="q" name="q" type="search" defaultValue={q} minLength={2} className={field.input + " mt-0"} placeholder="Ex.: retiro, Grupo de Oração, Espírito Santo" />
          <button className={btn.primario}>Buscar</button>
        </form>
        {q && (
          <section aria-live="polite" className="mt-8">
            <h2 className="sr-only">Resultados</h2>
            {hits.length === 0 ? <EmptyState title={`Nada encontrado para “${q}”`}>Tente outra palavra ou veja os <Link href="/grupos">Grupos de Oração</Link> e a <Link href="/agenda">agenda</Link>.</EmptyState> : (
              <ul className="divide-y divide-linha border-y border-linha">
                {hits.map((h) => (
                  <li key={`${h.type}-${h.slug}`} className="py-4">
                    <p className="text-sm text-tinta-3">{TYPE[h.type]}</p>
                    <Link href={`${h.type === "conteudo" ? HREF.conteudo[h.kind] : HREF[h.type]}/${h.slug}`} className="font-titulo text-lg font-semibold">{h.title}</Link>
                    {h.snippet && <p className="text-tinta-2">{h.snippet}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </Container>
    </>
  );
}
