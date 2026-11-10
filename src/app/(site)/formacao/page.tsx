import type { Metadata } from "next";
import { ContentList, pageNum } from "@/components/site/ContentViews";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Formação", description: "Conteúdos de formação revisados, com fontes indicadas." };

export default async function Page({ searchParams }: PageProps<"/formacao">) {
  const sp = await searchParams;
  return <ContentList kind="formacao" base="/formacao" title="Formação" intro="Conteúdos de formação revisados, com fontes indicadas." page={pageNum(sp.pagina)} />;
}
