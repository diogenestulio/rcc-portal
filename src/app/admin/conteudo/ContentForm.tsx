import Link from "next/link";
import { btn, field } from "@/components/ui";

export const NATURE_OPTIONS = [
  ["noticia", "Notícia"], ["institucional", "Institucional"], ["doutrina", "Doutrina (exige revisor doutrinal)"],
  ["orientacao_pastoral", "Orientação pastoral (exige revisor doutrinal)"], ["devocao", "Devoção (exige revisor doutrinal)"],
  ["testemunho", "Testemunho pessoal (exige revisor doutrinal)"],
] as const;

type Values = {
  titulo?: string; resumo?: string | null; texto?: string; natureza?: string; autor?: string | null; fontes?: string | null; direitos?: string | null;
  capa?: string | null; data?: string | null; dataFim?: string | null; local?: string | null; link?: string | null;
};
export type Imagem = { id: string; alt: string | null };

export function ContentFields({ v = {}, disabled, imagens = [] }: { v?: Values; disabled?: boolean; imagens?: Imagem[] }) {
  return (
    <fieldset disabled={disabled} className="space-y-5">
      <div>
        <label htmlFor="titulo" className={field.label}>Título</label>
        <input id="titulo" name="titulo" required minLength={3} maxLength={200} defaultValue={v.titulo} className={field.input} />
      </div>
      <div>
        <label htmlFor="resumo" className={field.label}>Resumo (aparece nas listas e na busca)</label>
        <textarea id="resumo" name="resumo" maxLength={400} rows={2} defaultValue={v.resumo ?? ""} className={field.input} />
      </div>
      <div>
        <label htmlFor="natureza" className={field.label}>Natureza do conteúdo</label>
        <select id="natureza" name="natureza" defaultValue={v.natureza ?? "noticia"} className={field.input} aria-describedby="natureza-dica">
          {NATURE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <p id="natureza-dica" className={field.hint}>Distingue doutrina, orientação pastoral, devoção e testemunho. Conteúdo doutrinal, pastoral, devocional e testemunhos só são publicados após o revisor designado aprovar.</p>
      </div>
      <div>
        <label htmlFor="texto" className={field.label}>Texto</label>
        <textarea id="texto" name="texto" required rows={16} defaultValue={v.texto} className={field.input + " font-mono text-sm"} aria-describedby="texto-dica" />
        <p id="texto-dica" className={field.hint}>Parágrafos separados por linha em branco. <code>## Subtítulo</code>, <code>&gt; citação</code>, <code>- item</code>, <code>**negrito**</code>, <code>*itálico*</code>, <code>[texto](https://endereço)</code>. Imagem ou PDF: cole numa linha sozinha o código copiado em <Link href="/admin/midia">Mídia</Link> (legenda da imagem opcional na linha de baixo, começando com “— ”). Vídeo do YouTube numa linha sozinha: <code>[video: título](https://www.youtube.com/watch?v=…)</code> (só carrega quando a pessoa clica). Não invente citações: indique a fonte abaixo.</p>
      </div>
      <div>
        <label htmlFor="capa" className={field.label}>Imagem de capa (opcional)</label>
        <select id="capa" name="capa" defaultValue={v.capa ?? ""} className={field.input} aria-describedby="capa-dica">
          <option value="">Sem imagem de capa</option>
          {imagens.map((m) => <option key={m.id} value={m.id}>{m.alt ?? `Imagem ${m.id.slice(0, 8)}`}</option>)}
        </select>
        <p id="capa-dica" className={field.hint}>Aparece nas listas e no topo do texto. Envie antes em <Link href="/admin/midia">Mídia</Link>, com descrição e autorização de imagem.</p>
      </div>
      <fieldset className="rounded-[var(--radius-md)] border border-linha p-4">
        <legend className="px-1 font-semibold">Acontecimento (para a seção “Sede”; opcional nos demais)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="data" className={field.label}>Data de início</label><input id="data" name="data" type="date" defaultValue={v.data ?? ""} className={field.input} /></div>
          <div><label htmlFor="data_fim" className={field.label}>Data de término</label><input id="data_fim" name="data_fim" type="date" defaultValue={v.dataFim ?? ""} className={field.input} /></div>
          <div className="sm:col-span-2"><label htmlFor="local" className={field.label}>Local</label><input id="local" name="local" maxLength={200} defaultValue={v.local ?? ""} className={field.input} placeholder="Ex.: Seul, Coreia do Sul · Canção Nova, Cachoeira Paulista (SP)" /></div>
          <div className="sm:col-span-2"><label htmlFor="link" className={field.label}>Link da fonte oficial</label><input id="link" name="link" type="url" inputMode="url" defaultValue={v.link ?? ""} className={field.input} placeholder="https://" aria-describedby="link-dica" /><p id="link-dica" className={field.hint}>Site do Vaticano, da CNBB, da RCC Brasil ou da organização do evento. Sempre confira a informação na fonte.</p></div>
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="autor" className={field.label}>Autor</label>
          <input id="autor" name="autor" maxLength={120} defaultValue={v.autor ?? ""} className={field.input} />
        </div>
        <div>
          <label htmlFor="direitos" className={field.label}>Direitos de reprodução</label>
          <input id="direitos" name="direitos" maxLength={300} defaultValue={v.direitos ?? ""} className={field.input} placeholder="Ex.: texto próprio; foto autorizada por…" />
        </div>
      </div>
      <div>
        <label htmlFor="fontes" className={field.label}>Fontes e referências</label>
        <textarea id="fontes" name="fontes" maxLength={1000} rows={2} defaultValue={v.fontes ?? ""} className={field.input} placeholder="Ex.: Catecismo da Igreja Católica, §§ 1830-1832; Bíblia (edição usada)" />
      </div>
      {!disabled && <button className={btn.primario}>Salvar como rascunho</button>}
    </fieldset>
  );
}
