import type { Metadata } from "next";
import { db } from "@/db";
import { getPublished } from "@/server/content";
import { ContentPage } from "@/components/site/ContentViews";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/igreja-e-renovacao/[slug]">): Promise<Metadata> {
  const c = await getPublished(db, "igreja", (await params).slug);
  return c ? { title: c.title, description: c.summary ?? undefined, alternates: { canonical: `/igreja-e-renovacao/${c.slug}` }, openGraph: { title: c.title, description: c.summary ?? undefined, type: "article" } } : {};
}

export default async function Page({ params }: PageProps<"/igreja-e-renovacao/[slug]">) {
  const { slug } = await params;
  return <ContentPage kind="igreja" slug={slug} back={{ href: "/igreja-e-renovacao", label: "Igreja e Renovação" }} />;
}
