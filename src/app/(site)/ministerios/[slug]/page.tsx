import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { ministry } from "@/db/schema";
import { Container, DemoBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/ministerios/[slug]">) {
  const { slug } = await params;
  const [m] = await db.select({ name: ministry.name, summary: ministry.summary }).from(ministry).where(and(eq(ministry.slug, slug), eq(ministry.published, true)));
  return m ? { title: m.name, description: m.summary ?? undefined } : {};
}

export default async function Ministerio({ params }: PageProps<"/ministerios/[slug]">) {
  const { slug } = await params;
  const [m] = await db.select().from(ministry).where(and(eq(ministry.slug, slug), eq(ministry.published, true)));
  if (!m) notFound();
  return (
    <Container narrow className="py-10">
      <nav aria-label="Trilha"><Link href="/ministerios">← Ministérios</Link></nav>
      <h1 className="mt-4 text-display font-semibold">{m.name} <DemoBadge show={m.isDemo} /></h1>
      {m.summary && <p className="mt-3 text-lg text-tinta-2">{m.summary}</p>}
      {m.description && <div className="prosa mt-8">{m.description.split(/\n\s*\n/).map((par, i) => <p key={i} className="whitespace-pre-line">{par}</p>)}</div>}
    </Container>
  );
}
