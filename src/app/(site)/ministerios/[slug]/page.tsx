import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { ministry } from "@/db/schema";
import { Container, DemoBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Ministerio({ params }: PageProps<"/ministerios/[slug]">) {
  const { slug } = await params;
  const [m] = await db.select().from(ministry).where(and(eq(ministry.slug, slug), eq(ministry.published, true)));
  if (!m) notFound();
  return (
    <Container narrow className="py-10">
      <nav aria-label="Trilha"><Link href="/ministerios">← Ministérios</Link></nav>
      <h1 className="mt-4 text-display font-semibold">{m.name} <DemoBadge show={m.isDemo} /></h1>
      {m.summary && <p className="mt-3 text-lg text-tinta-2">{m.summary}</p>}
      {m.description && <div className="prosa mt-8"><p>{m.description}</p></div>}
    </Container>
  );
}
