import type { Metadata } from "next";
import { db } from "@/db";
import { getPublished } from "@/server/content";
import { ContentPage } from "@/components/site/ContentViews";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/formacao/[slug]">): Promise<Metadata> {
  const c = await getPublished(db, "formacao", (await params).slug);
  return c ? { title: c.title, description: c.summary ?? undefined, alternates: { canonical: `/formacao/${c.slug}` }, openGraph: { title: c.title, description: c.summary ?? undefined, type: "article" } } : {};
}

export default async function Page({ params }: PageProps<"/formacao/[slug]">) {
  const { slug } = await params;
  return <ContentPage kind="formacao" slug={slug} back={{ href: "/formacao", label: "Formação" }} />;
}
