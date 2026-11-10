"use client";
import { authClient } from "@/lib/auth-client";

export function SignOut() {
  return (
    <button type="button" className="text-vinho underline underline-offset-2"
      onClick={async () => { await authClient.signOut(); window.location.assign("/entrar"); }}>
      Sair
    </button>
  );
}
