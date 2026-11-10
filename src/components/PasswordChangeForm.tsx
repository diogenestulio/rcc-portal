"use client";
import { useActionState } from "react";
import { trocarSenha, type SenhaState } from "@/app/entrar/trocar-senha/actions";
import { btn, field } from "@/components/ui";

export function PasswordChangeForm({ currentLabel = "Senha atual", next }: { currentLabel?: string; next: string }) {
  const [state, action, pending] = useActionState<SenhaState, FormData>(trocarSenha, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="atual" className={field.label}>{currentLabel}</label>
        <input id="atual" name="atual" type="password" autoComplete="current-password" required className={field.input} />
      </div>
      <div>
        <label htmlFor="nova" className={field.label}>Nova senha</label>
        <input id="nova" name="nova" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className={field.input} aria-describedby="nova-dica" />
        <p id="nova-dica" className={field.hint}>Pelo menos 12 caracteres. Uma frase longa é mais fácil de lembrar e mais segura.</p>
      </div>
      <div>
        <label htmlFor="confirma" className={field.label}>Repita a nova senha</label>
        <input id="confirma" name="confirma" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className={field.input} />
      </div>
      {state && !state.ok && <p role="alert" className={field.error}>{state.erro}</p>}
      <button className={btn.primario} disabled={pending}>{pending ? "Salvando…" : "Salvar nova senha"}</button>
    </form>
  );
}
