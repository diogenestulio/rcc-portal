"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { btn, field } from "@/components/ui";

export function LoginForm() {
  const [step, setStep] = useState<"senha" | "totp">("senha");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null); setBusy(true);
    const fd = new FormData(e.currentTarget);
    const { data, error } = await authClient.signIn.email({ email: String(fd.get("email")), password: String(fd.get("senha")) });
    setBusy(false);
    // Mensagem genérica: não revela se o e-mail existe (anti-enumeração).
    if (error) { setErr(error.status === 429 ? "Muitas tentativas. Aguarde alguns minutos." : "E-mail ou senha incorretos."); return; }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) { setStep("totp"); return; }
    window.location.assign("/entrar/mfa"); // conta sem MFA: configuração obrigatória
  }

  async function onTotp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null); setBusy(true);
    const code = String(new FormData(e.currentTarget).get("codigo")).replace(/\s/g, "");
    const r = /^\d{6}$/.test(code)
      ? await authClient.twoFactor.verifyTotp({ code })
      : await authClient.twoFactor.verifyBackupCode({ code });
    setBusy(false);
    if (r.error) { setErr("Código inválido ou expirado."); return; }
    window.location.assign("/admin");
  }

  if (step === "totp") return (
    <form onSubmit={onTotp} className="mt-6 space-y-4">
      <div>
        <label htmlFor="codigo" className={field.label}>Código do aplicativo autenticador</label>
        <input id="codigo" name="codigo" inputMode="numeric" autoComplete="one-time-code" required className={field.input} autoFocus />
        <p className={field.hint}>6 dígitos. Sem acesso ao aplicativo? Use um código de recuperação.</p>
      </div>
      {err && <p role="alert" className={field.error}>{err}</p>}
      <button className={btn.primario + " w-full"} disabled={busy}>{busy ? "Verificando…" : "Verificar"}</button>
    </form>
  );

  return (
    <form onSubmit={onPassword} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className={field.label}>E-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required className={field.input} />
      </div>
      <div>
        <label htmlFor="senha" className={field.label}>Senha</label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required className={field.input} />
      </div>
      {err && <p role="alert" className={field.error}>{err}</p>}
      <button className={btn.primario + " w-full"} disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
