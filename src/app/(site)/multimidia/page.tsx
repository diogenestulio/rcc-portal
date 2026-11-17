import type { Metadata } from "next";
import { and, desc, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import { publicUrl } from "@/server/media";
import { Container, EmptyState, PageHeader } from "@/components/ui";
import { LazyVideo } from "@/components/site/LazyVideo";
import { videosMultimidia } from "@/config/instituicao";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Multimídia", description: "Vídeos, materiais para download e galeria de imagens da RCC da Arquidiocese de Cuiabá." };

const kb = (b: number) => (b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default async function Multimidia() {
  const [pdfs, imagens] = await Promise.all([
    db.select().from(media).where(and(eq(media.isPrivate, false), eq(media.mimeType, "application/pdf"))).orderBy(desc(media.createdAt)).limit(30),
    // Galeria: só imagens com autorização de uso registrada e que não sejam decorativas.
    db.select().from(media).where(and(eq(media.isPrivate, false), like(media.mimeType, "image/%"), eq(media.imageRightsAuthorized, true), eq(media.decorative, false)))
      .orderBy(desc(media.createdAt)).limit(24),
  ]);

  return (
    <>
      <PageHeader title="Multimídia" intro="Vídeos dos canais oficiais, materiais para baixar e a galeria de imagens da Renovação na Arquidiocese." />
      <Container className="space-y-20 py-14">
        <section aria-labelledby="videos">
          <h2 id="videos" className="text-[2.1rem] sm:text-[2.5rem]">Vídeos</h2>
          <p className="mt-2 max-w-2xl text-tinta-2">Os vídeos continuam nos canais oficiais e só carregam quando você clica para assistir.</p>
          {videosMultimidia.length === 0 ? <div className="mt-6"><EmptyState title="Nenhum vídeo selecionado ainda" /></div> : (
            <ul className="mt-8 grid gap-8 md:grid-cols-2">
              {videosMultimidia.map((v) => (
                <li key={v.youtubeId}>
                  <LazyVideo id={v.youtubeId} title={v.titulo} />
                  <p className="mt-3 font-titulo text-lg font-bold">{v.titulo}</p>
                  <p className="text-sm text-tinta-3">Canal oficial: {v.canal}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="materiais">
          <h2 id="materiais" className="text-[2.1rem] sm:text-[2.5rem]">Materiais para baixar</h2>
          {pdfs.length === 0 ? <div className="mt-6"><EmptyState title="Nenhum material publicado ainda" /></div> : (
            <ul className="mt-8 grid gap-4 md:grid-cols-2">
              {pdfs.map((p) => (
                <li key={p.id}>
                  <a href={publicUrl(p)} className="group flex items-center gap-4 rounded-[var(--radius-lg)] border border-linha bg-papel p-5 text-tinta no-underline transition-[border-color,box-shadow] hover:border-ouro-suave hover:shadow-[var(--sombra-alta)]">
                    <span aria-hidden="true" className="grid h-16 w-13 shrink-0 place-items-center rounded-[4px] bg-estandarte px-3 text-sm font-black tracking-wide text-ouro shadow-[inset_0_-4px_0_var(--color-ouro)]">PDF</span>
                    <span className="flex-1">
                      <span className="block font-titulo text-lg font-bold group-hover:text-marca-escuro group-hover:underline">{p.altText ?? "Documento"}</span>
                      <span className="block text-sm text-tinta-3">PDF, {kb(p.bytes)}{p.credit ? `. ${p.credit}` : ""}</span>
                    </span>
                    <span aria-hidden="true" className="font-bold text-marca">Baixar</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="galeria">
          <h2 id="galeria" className="text-[2.1rem] sm:text-[2.5rem]">Galeria</h2>
          {imagens.length === 0 ? <div className="mt-6"><EmptyState title="Ainda não há imagens na galeria">Só entram aqui imagens com autorização de uso registrada.</EmptyState></div> : (
            <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {imagens.map((m) => (
                <li key={m.id}>
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element -- variantes otimizadas pela biblioteca de mídia */}
                    <img src={publicUrl(m, 640)} alt={m.altText ?? ""} width={m.width ?? undefined} height={m.height ?? undefined} loading="lazy" decoding="async" className="aspect-square w-full rounded-[var(--radius-md)] object-cover" />
                    {m.credit && <figcaption className="mt-1.5 text-xs text-tinta-3">{m.credit}</figcaption>}
                  </figure>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Container>
    </>
  );
}
