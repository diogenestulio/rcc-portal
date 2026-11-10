import type { Metadata } from "next";
import { ContentList, pageNum } from "@/components/site/ContentViews";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "A RCC", description: "Identidade, história, coordenação, documentos e contatos." };

export default async function Page({ searchParams }: PageProps<"/a-rcc">) {
  const sp = await searchParams;
  return <ContentList kind="pagina" base="/a-rcc" title="A RCC" intro="Identidade, história, coordenação, documentos e contatos." page={pageNum(sp.pagina)} />;
}
