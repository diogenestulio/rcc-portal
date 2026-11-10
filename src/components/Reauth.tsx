"use client";
import { authClient } from "@/lib/auth-client";
import { btn, Notice } from "@/components/ui";

/** Ações sensíveis exigem login recente (≤ 10 min). Sai e volta para a mesma página após entrar. */
export function ReauthNotice({ back }: { back: string }) {
  return (
    <Notice tone="info" title="Confirme sua identidade">
      <p>Esta área altera contas e permissões. Por segurança, ela só abre até 10 minutos depois do login.</p>
      <button type="button" className={btn.secundario + " mt-3"}
        onClick={async () => { await authClient.signOut(); window.location.assign(`/entrar?reautenticar=1&volta=${encodeURIComponent(back)}`); }}>
        Entrar de novo
      </button>
    </Notice>
  );
}
