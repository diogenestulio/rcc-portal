import { db } from "@/db";
import { requireCan } from "@/server/session";
import { listMedia, publicUrl } from "@/server/media";
import { Badge, Card, EmptyState } from "@/components/ui";
import { fmtPublished } from "@/components/site/format";
import { CopySnippet, EditMedia, MediaButtons, UploadForm, UsageNotice } from "./MediaForms";

export const metadata = { title: "Mídia" };

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.round(n / 1024)} KB`);

export default async function Midia() {
  const s = await requireCan("midia.enviar");
  const items = await listMedia(db, s);
  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-semibold">Mídia</h1>
      <p className="mt-1 text-tinta-2">Fotos e documentos usados no portal. Só envie fotos com autorização de quem aparece nelas.</p>
      <div className="mt-6 grid gap-6 xl:grid-cols-[22rem_1fr]">
        <Card><h2 className="mb-4 text-xl font-semibold">Enviar arquivo</h2><UploadForm /></Card>
        <section aria-labelledby="acervo">
          <h2 id="acervo" className="text-xl font-semibold">Acervo ({items.length})</h2>
          <div className="mt-3"><UsageNotice /></div>
          {items.length === 0 ? <div className="mt-4"><EmptyState title="Nenhum arquivo ainda" /></div> : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((m) => {
                const isImage = m.mimeType.startsWith("image/");
                const url = publicUrl(m);
                const snippet = isImage ? `![${m.altText ?? ""}](${url})` : url;
                return (
                  <li key={m.id} className="rounded-[var(--radius-md)] border border-linha bg-papel p-3">
                    {isImage && !m.isPrivate ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={publicUrl(m, 640)} alt={m.altText ?? ""} width={m.width ?? undefined} height={m.height ?? undefined} loading="lazy" className="aspect-[4/3] w-full rounded-md bg-marfim-2 object-cover" />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center rounded-md bg-marfim-2 font-titulo text-2xl text-tinta-3" aria-hidden="true">{isImage ? "Privada" : "PDF"}</div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.isPrivate && <Badge tone="alerta">Privado</Badge>}
                      {m.decorative && <Badge>Decorativa</Badge>}
                      <Badge tone="info">{isImage ? "Imagem" : "PDF"} · {kb(m.bytes)}</Badge>
                    </div>
                    <p className="mt-1 text-sm">{m.altText ?? (m.decorative ? <span className="text-tinta-3">sem descrição (decorativa)</span> : <span className="text-tinta-3">sem descrição</span>)}</p>
                    {m.credit && <p className="text-xs text-tinta-3">{m.credit}</p>}
                    <p className="text-xs text-tinta-3">{fmtPublished(m.createdAt)}</p>
                    {!m.isPrivate && <div className="mt-2"><code className="block break-all rounded bg-marfim-2 p-1.5 text-xs">{snippet}</code><CopySnippet text={snippet} /></div>}
                    <EditMedia id={m.id} alt={m.altText} decorative={m.decorative} credit={m.credit} isImage={isImage} />
                    <MediaButtons id={m.id} isPrivate={m.isPrivate} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
