"use client";
import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { btn, field, Notice } from "@/components/ui";

export function ResetForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const nova = String(fd.get("nova")), confirma = String(fd.get("confirma"));
    if (nova !== confirma) { setErr("As duas senhas não são iguais."); return; }
    if (nova.length < 12) { setErr("Use pelo menos 12 caracteres."); return; }
    setBusy(true);
    const { error } = await authClient.resetPassword({ newPassword: nova, token });
    setBusy(false);
    if (error) { setErr("Link inválido ou expirado. Peça um novo link."); return; }
    setDone(true);
  }

  if (done) return (
    <div className="mt-6 space-y-4">
      <Notice tone="sucesso">Senha criada. Por segurança, as sessões abertas desta conta foram encerradas.</Notice>
      <Link href="/entrar" className={btn.primario}>Entrar</Link>
    </div>
  );
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="nova" className={field.label}>Nova senha</label>
        <input id="nova" name="nova" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className={field.input} aria-describedby="nova-dica" />
        <p id="nova-dica" className={field.hint}>Pelo menos 12 caracteres. A verificação em duas etapas continua valendo no próximo login.</p>
      </div>
      <div>
        <label htmlFor="confirma" className={field.label}>Repita a nova senha</label>
        <input id="confirma" name="confirma" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className={field.input} />
      </div>
      {err && <p role="alert" className={field.error}>{err}</p>}
      <button className={btn.primario + " w-full"} disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}</button>
    </form>
  );
}
