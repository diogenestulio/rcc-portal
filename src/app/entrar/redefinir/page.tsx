import type { Metadata } from "next";
import Link from "next/link";
import { Notice, Wordmark } from "@/components/ui";
import { ResetForm } from "./ResetForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Criar nova senha", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function Redefinir({ searchParams }: PageProps<"/entrar/redefinir">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" && /^[A-Za-z0-9_-]{8,200}$/.test(sp.token) ? sp.token : null;
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-linha bg-papel p-8 shadow-[var(--sombra)]">
        <Wordmark />
        <h1 className="mt-6 text-2xl font-semibold">Criar nova senha</h1>
        {!token || sp.error ? (
          <div className="mt-6"><Notice tone="alerta" title="Link inválido ou expirado">
            Os links valem por 30 minutos e só podem ser usados uma vez. <Link href="/entrar/esqueci">Peça um novo link</Link>.
          </Notice></div>
        ) : <ResetForm token={token} />}
      </div>
    </main>
  );
}
