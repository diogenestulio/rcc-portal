import type { Metadata } from "next";
import { ContentList, pageNum } from "@/components/site/ContentViews";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notícias", description: "Notícias e comunicados da RCC na Arquidiocese." };

export default async function Page({ searchParams }: PageProps<"/noticias">) {
  const sp = await searchParams;
  return <ContentList kind="noticia" base="/noticias" title="Notícias" intro="Notícias e comunicados da RCC na Arquidiocese." page={pageNum(sp.pagina)} />;
}
