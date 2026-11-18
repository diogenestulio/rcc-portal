import type { Metadata } from "next";
import { db } from "@/db";
import { permanentRedirect } from "next/navigation";
import { getPublished, getPublishedByChave } from "@/server/content";
import { ContentPage } from "@/components/site/ContentViews";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/a-rcc/[slug]">): Promise<Metadata> {
  const c = await getPublished(db, "pagina", (await params).slug);
  return c ? { title: c.title, description: c.summary ?? undefined, alternates: { canonical: `/a-rcc/${c.slug}` }, openGraph: { title: c.title, description: c.summary ?? undefined, type: "article" } } : {};
}

export default async function Page({ params }: PageProps<"/a-rcc/[slug]">) {
  const { slug } = await params;
  // Link antigo de "Quem Somos" (/a-rcc/<endereço>) continua válido: redireciona de forma permanente para /a-rcc.
  const fixa = await getPublishedByChave(db, "quem-somos");
  if (fixa && fixa.slug === slug) permanentRedirect("/a-rcc");
  return <ContentPage kind="pagina" slug={slug} back={{ href: "/a-rcc", label: "A RCC" }} />;
}
