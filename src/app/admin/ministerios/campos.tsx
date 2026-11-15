import { field } from "@/components/ui";

type M = { name?: string; summary?: string | null; description?: string | null };

export function MinistryFields({ m = {} }: { m?: M }) {
  return (
    <>
      <div><label htmlFor="nome" className={field.label}>Nome</label><input id="nome" name="nome" required minLength={3} maxLength={120} defaultValue={m.name ?? ""} className={field.input} placeholder="Ministério de Música" /></div>
      <div>
        <label htmlFor="resumo" className={field.label}>Resumo (uma frase)</label>
        <input id="resumo" name="resumo" maxLength={300} defaultValue={m.summary ?? ""} className={field.input} aria-describedby="resumo-dica" />
        <p id="resumo-dica" className={field.hint}>Aparece na lista de ministérios do site.</p>
      </div>
      <div>
        <label htmlFor="descricao" className={field.label}>Descrição</label>
        <textarea id="descricao" name="descricao" rows={8} maxLength={6000} defaultValue={m.description ?? ""} className={field.input} aria-describedby="descricao-dica" />
        <p id="descricao-dica" className={field.hint}>Missão, como participar e contato institucional. Separe os parágrafos com uma linha em branco. Não use telefone ou e-mail pessoal.</p>
      </div>
    </>
  );
}
