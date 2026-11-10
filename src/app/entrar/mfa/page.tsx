import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentSubject } from "@/server/session";
import { MfaSetup } from "./MfaSetup";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Configurar verificação em duas etapas", robots: { index: false } };

export default async function MfaPage() {
  const s = await currentSubject();
  if (!s) redirect("/entrar");
  if (s.mustChangePassword) redirect("/entrar/trocar-senha");
  if (s.mfa) redirect("/admin");
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg rounded-[var(--radius-lg)] border border-linha bg-papel p-8 shadow-[var(--sombra)]">
        <h1 className="text-2xl font-semibold">Verificação em duas etapas</h1>
        <p className="mt-2 text-tinta-2">Obrigatória para todos os acessos ao painel. Use um aplicativo autenticador (por exemplo, Google Authenticator, Microsoft Authenticator ou Aegis).</p>
        <MfaSetup />
      </div>
    </main>
  );
}
