import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { getPublishedByChave, listPublished } from "@/server/content";
import { Artigo } from "@/components/site/ContentViews";
import { Container, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

/** "A RCC" abre direto "Quem Somos" (página fixa por chave estável); demais páginas da seção ficam como navegação secundária. */
export async function generateMetadata(): Promise<Metadata> {
  const c = await getPublishedByChave(db, "quem-somos");
  return {
    title: c?.title ?? "A RCC", description: c?.summary ?? "Quem somos: a Renovação Carismática Católica na Arquidiocese de Cuiabá.",
    alternates: { canonical: "/a-rcc" }, openGraph: c ? { title: c.title, description: c.summary ?? undefined, type: "article" } : undefined,
  };
}

export default async function ARcc() {
  const [c, paginas] = await Promise.all([getPublishedByChave(db, "quem-somos"), listPublished(db, "pagina", 30)]);
  const outras = paginas.filter((p) => p.id !== c?.id);
  const secundaria = outras.length > 0 && (
    <nav aria-labelledby="mais-a-rcc" className="mt-14 border-t border-linha pt-8">
      <h2 id="mais-a-rcc" className="text-[1.8rem]">Também nesta seção</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {outras.map((p) => <li key={p.id}><Link href={`/a-rcc/${p.slug}`} className="font-titulo text-lg font-bold">{p.title}</Link>{p.summary && <p className="text-tinta-2">{p.summary}</p>}</li>)}
      </ul>
    </nav>
  );
  if (!c) {
    return (
      <>
        <PageHeader title="A RCC" />
        <Container narrow className="py-12">
          <p className="text-lg text-tinta-2">O texto de apresentação da Renovação Carismática Católica na Arquidiocese de Cuiabá está em preparação.</p>
          {secundaria}
        </Container>
      </>
    );
  }
  return <Artigo c={c} kind="pagina">{secundaria}</Artigo>;
}
