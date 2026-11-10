import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ministry } from "@/db/schema";
import { Container, DemoBadge, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ministérios" };

export default async function Ministerios() {
  const list = await db.select().from(ministry).where(eq(ministry.published, true)).orderBy(ministry.name);
  return (
    <>
      <PageHeader title="Ministérios" intro="Serviços que sustentam a vida dos Grupos de Oração na Arquidiocese." />
      <Container className="py-10">
        {list.length === 0 ? <EmptyState title="Ministérios em atualização">A coordenação está confirmando a lista de ministérios locais. Veja também a <Link href="/formacao">formação</Link>.</EmptyState> : (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {list.map((m) => (
              <li key={m.id} className="rounded-[var(--radius-lg)] border border-linha bg-papel p-5">
                <h2 className="text-xl font-semibold"><Link href={`/ministerios/${m.slug}`} className="text-tinta no-underline hover:underline">{m.name}</Link> <DemoBadge show={m.isDemo} /></h2>
                {m.summary && <p className="mt-2 text-tinta-2">{m.summary}</p>}
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
