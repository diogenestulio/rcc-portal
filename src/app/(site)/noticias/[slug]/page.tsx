import type { Metadata } from "next";
import { db } from "@/db";
import { getPublished } from "@/server/content";
import { ContentPage } from "@/components/site/ContentViews";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/noticias/[slug]">): Promise<Metadata> {
  const c = await getPublished(db, "noticia", (await params).slug);
  return c ? { title: c.title, description: c.summary ?? undefined, alternates: { canonical: `/noticias/${c.slug}` }, openGraph: { title: c.title, description: c.summary ?? undefined, type: "article" } } : {};
}

export default async function Page({ params }: PageProps<"/noticias/[slug]">) {
  const { slug } = await params;
  return <ContentPage kind="noticia" slug={slug} back={{ href: "/noticias", label: "Notícias" }} />;
}
