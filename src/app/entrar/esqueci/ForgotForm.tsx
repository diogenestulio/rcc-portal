"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { btn, field, Notice } from "@/components/ui";

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null); setBusy(true);
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/entrar/redefinir" });
    setBusy(false);
    if (error?.status === 429) { setErr("Muitos pedidos. Aguarde uma hora e tente de novo."); return; }
    // Mesma resposta exista ou não a conta (não revela quem tem cadastro).
    setSent(true);
  }

  if (sent) return (
    <div className="mt-6"><Notice tone="sucesso" title="Pedido recebido">
      Se este e-mail tiver uma conta, você receberá em alguns minutos um link válido por 30 minutos. Confira também a caixa de spam.
      Não chegou? Peça ao gestor institucional uma senha provisória.
    </Notice></div>
  );
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className={field.label}>E-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required maxLength={200} className={field.input} />
      </div>
      {err && <p role="alert" className={field.error}>{err}</p>}
      <button className={btn.primario + " w-full"} disabled={busy}>{busy ? "Enviando…" : "Enviar link"}</button>
    </form>
  );
}
