import { requireCan } from "@/server/session";
import { field, Notice } from "@/components/ui";
import { ContentFields } from "../ContentForm";
import { criar } from "../actions";

export const metadata = { title: "Novo conteúdo" };

export default async function Novo({ searchParams }: PageProps<"/admin/conteudo/novo">) {
  await requireCan("conteudo.criar");
  const sp = await searchParams;
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold">Novo conteúdo</h1>
      {typeof sp.erro === "string" && <div className="mt-4"><Notice tone="perigo">{sp.erro}</Notice></div>}
      <form action={criar} className="mt-6 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="tipo" className={field.label}>Tipo</label>
            <select id="tipo" name="tipo" className={field.input}>
              <option value="noticia">Notícia</option><option value="formacao">Formação</option>
              <option value="pagina">Página institucional</option><option value="comunicado">Comunicado</option>
            </select>
          </div>
          <div>
            <label htmlFor="slug" className={field.label}>Endereço (slug)</label>
            <input id="slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} className={field.input} placeholder="retiro-de-carnaval-2027" />
            <p className={field.hint}>Minúsculas, números e hífens. Não muda depois de publicado.</p>
          </div>
        </div>
        <ContentFields />
      </form>
    </div>
  );
}
