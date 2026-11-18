import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { listIgreja } from "@/server/content";
import { btn, Container, EmptyState, PageHeader } from "@/components/ui";
import { CartaoAcontecimento } from "@/components/site/IgrejaCards";
import { pageNum } from "@/components/site/ContentViews";
import { TZ } from "@/components/site/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sede", alternates: { canonical: "/igreja-e-renovacao" }, description: "Acontecimentos da Igreja Católica e da Renovação Carismática no Brasil e no mundo." };

const hojeLocal = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

export default async function IgrejaERenovacao({ searchParams }: PageProps<"/igreja-e-renovacao">) {
  const page = pageNum((await searchParams).pagina);
  const per = 9;
  const hoje = hojeLocal();
  const [proximos, cobertura] = await Promise.all([
    page === 1 ? listIgreja(db, { proximos: true, hoje, limit: 12 }) : Promise.resolve([]),
    listIgreja(db, { proximos: false, hoje, limit: per + 1, offset: (page - 1) * per }),
  ]);
  const more = cobertura.length > per;
  return (
    <>
      <PageHeader title="Sede"
        intro="O que está acontecendo na Igreja Católica e na Renovação Carismática, no Brasil e no mundo: grandes encontros, campanhas, datas e celebrações, sempre com o link da fonte oficial." />
      <Container className="py-14">
        {page === 1 && (
          <section aria-labelledby="proximos">
            <h2 id="proximos" className="text-[2.1rem] sm:text-[2.5rem]">Próximos acontecimentos</h2>
            {proximos.length === 0 ? <p className="mt-4 text-tinta-2">Nenhum acontecimento futuro publicado no momento.</p> : (
              <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {proximos.map((c, i) => <li key={c.id} className={i === 0 && proximos.length > 2 ? "md:col-span-2 lg:col-span-2 lg:row-span-2" : ""}><CartaoAcontecimento c={c} grande={i === 0 && proximos.length > 2} /></li>)}
              </ul>
            )}
          </section>
        )}
        <section aria-labelledby="cobertura" className={page === 1 ? "mt-20" : ""}>
          <h2 id="cobertura" className="text-[2.1rem] sm:text-[2.5rem]">Cobertura e reflexões</h2>
          {cobertura.length === 0 ? <div className="mt-6"><EmptyState title="Ainda não há publicações aqui" /></div> : (
            <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {cobertura.slice(0, per).map((c) => <li key={c.id}><CartaoAcontecimento c={c} /></li>)}
            </ul>
          )}
          {(page > 1 || more) && (
            <nav aria-label="Paginação" className="mt-10 flex justify-center gap-3">
              {page > 1 && <Link className={btn.secundario} href={`/igreja-e-renovacao?pagina=${page - 1}`}>Anteriores</Link>}
              {more && <Link className={btn.secundario} href={`/igreja-e-renovacao?pagina=${page + 1}`}>Mais antigas</Link>}
            </nav>
          )}
        </section>
      </Container>
    </>
  );
}
