"use client";
import { useActionState } from "react";
import { acaoConta, concederPapel, criarConta, revogarPapel, type AcaoState } from "./actions";
import { btn, field, Notice } from "@/components/ui";

function Resultado({ s }: { s: AcaoState }) {
  if (!s) return null;
  if (!s.ok) return <div className="mt-3"><Notice tone="perigo">{s.erro}</Notice></div>;
  return (
    <div className="mt-3"><Notice tone="sucesso" title={s.msg}>
      {s.senha && (
        <>
          <p>Senha provisória (aparece <strong>só agora</strong>; entregue pessoalmente ou por canal seguro):</p>
          <p className="mt-2 select-all rounded-md bg-papel px-3 py-2 font-mono text-lg tracking-wider">{s.senha}</p>
          <p className="mt-2 text-sm">No primeiro acesso a pessoa cria a própria senha e configura a verificação em duas etapas.</p>
        </>
      )}
      {s.userId && <p className="mt-2"><a href={`/admin/usuarios/${s.userId}`}>Abrir a conta para atribuir papéis →</a></p>}
    </Notice></div>
  );
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState(criarConta, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div><label htmlFor="nome" className={field.label}>Nome completo</label><input id="nome" name="nome" required minLength={3} maxLength={120} className={field.input} /></div>
      <div><label htmlFor="email" className={field.label}>E-mail</label><input id="email" name="email" type="email" required maxLength={200} className={field.input} /></div>
      <button className={btn.primario} disabled={pending}>{pending ? "Criando…" : "Criar conta"}</button>
      <div className="sm:col-span-3"><Resultado s={state} /></div>
    </form>
  );
}

const ACOES: { acao: string; label: string; confirma: string; perigo?: boolean }[] = [
  { acao: "senha", label: "Gerar senha provisória", confirma: "Gerar nova senha provisória? A senha atual deixa de valer e as sessões são encerradas." },
  { acao: "sessoes", label: "Encerrar sessões", confirma: "Encerrar todas as sessões abertas desta conta?" },
  { acao: "mfa", label: "Zerar verificação em duas etapas", confirma: "Zerar o MFA? Use só quando a pessoa perdeu o aplicativo e os códigos de recuperação." },
];

export function AccountActions({ id, active }: { id: string; active: boolean }) {
  const [state, action, pending] = useActionState(acaoConta, null);
  const all = [...ACOES, active
    ? { acao: "desativar", label: "Desativar conta", confirma: "Desativar esta conta? A pessoa perde o acesso imediatamente.", perigo: true }
    : { acao: "reativar", label: "Reativar conta", confirma: "Reativar esta conta?" }];
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {all.map((a) => (
          <form key={a.acao} action={action} onSubmit={(e) => { if (!confirm(a.confirma)) e.preventDefault(); }}>
            <input type="hidden" name="id" value={id} /><input type="hidden" name="acao" value={a.acao} />
            <button className={"perigo" in a && a.perigo ? btn.perigo : btn.secundario} disabled={pending}>{a.label}</button>
          </form>
        ))}
      </div>
      <Resultado s={state} />
    </div>
  );
}

export type ScopeOption = { value: string; label: string };

export function GrantRoleForm({ id, roles, scopes }: { id: string; roles: { value: string; label: string }[]; scopes: ScopeOption[] }) {
  const [state, action, pending] = useActionState(concederPapel, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="id" value={id} />
      <div><label htmlFor="papel" className={field.label}>Papel</label>
        <select id="papel" name="papel" className={field.input}>{roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
      <div><label htmlFor="escopo" className={field.label}>Escopo</label>
        <select id="escopo" name="escopo" className={field.input} aria-describedby="escopo-dica">{scopes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
      <button className={btn.primario} disabled={pending}>Conceder</button>
      <p id="escopo-dica" className={field.hint + " sm:col-span-3"}>Escopo de grupo, região ou ministério só vale para “Responsável por grupo/ministério” e “Gestor de eventos”; os demais papéis são globais.</p>
      <div className="sm:col-span-3"><Resultado s={state} /></div>
    </form>
  );
}

export function RevokeRoleButton({ papelId, label }: { papelId: string; label: string }) {
  const [state, action, pending] = useActionState(revogarPapel, null);
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(`Revogar o papel “${label}”?`)) e.preventDefault(); }} className="inline">
      <input type="hidden" name="papelId" value={papelId} />
      <button className="text-sm text-perigo underline underline-offset-2" disabled={pending}>revogar</button>
      {state && !state.ok && <span role="alert" className="ml-2 text-sm font-semibold text-perigo">{state.erro}</span>}
    </form>
  );
}
