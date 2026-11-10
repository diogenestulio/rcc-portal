"use client";
import { useState } from "react";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth-client";
import { btn, field } from "@/components/ui";

export function MfaSetup() {
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(null); setBusy(true);
    const password = String(new FormData(e.currentTarget).get("senha"));
    const { data, error } = await authClient.twoFactor.enable({ password });
    setBusy(false);
    if (error || !data || !("totpURI" in data)) { setErr("Senha incorreta."); return; }
    setQr(await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220 }));
    setSecret(new URL(data.totpURI).searchParams.get("secret"));
    setCodes(data.backupCodes);
  }

  async function confirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(null); setBusy(true);
    const code = String(new FormData(e.currentTarget).get("codigo")).replace(/\s/g, "");
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setBusy(false);
    if (error) { setErr("Código inválido. Confira o horário do celular e tente de novo."); return; }
    window.location.assign("/admin");
  }

  if (!qr) return (
    <form onSubmit={start} className="mt-6 space-y-4">
      <div>
        <label htmlFor="senha" className={field.label}>Confirme sua senha</label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required className={field.input} />
      </div>
      {err && <p role="alert" className={field.error}>{err}</p>}
      <button className={btn.primario} disabled={busy}>Continuar</button>
    </form>
  );

  return (
    <div className="mt-6 space-y-6">
      <ol className="list-decimal space-y-4 pl-5">
        <li>
          <p>Escaneie o QR Code no aplicativo autenticador.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR Code para configurar o aplicativo autenticador" width={220} height={220} className="mt-2 rounded-md border border-linha" />
          {secret && <p className="mt-2 text-sm text-tinta-2">Sem câmera? Digite a chave: <code className="break-all font-mono">{secret}</code></p>}
        </li>
        <li>
          <p className="font-semibold">Guarde os códigos de recuperação em local seguro (cada um funciona uma vez):</p>
          <ul className="mt-2 grid grid-cols-2 gap-1 rounded-md bg-marfim-2 p-3 font-mono text-sm">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
        </li>
        <li>
          <form onSubmit={confirm} className="space-y-3">
            <label htmlFor="codigo" className={field.label}>Digite o código de 6 dígitos que aparece no aplicativo</label>
            <input id="codigo" name="codigo" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" required className={field.input} />
            {err && <p role="alert" className={field.error}>{err}</p>}
            <button className={btn.primario} disabled={busy}>Ativar e entrar no painel</button>
          </form>
        </li>
      </ol>
    </div>
  );
}
