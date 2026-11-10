import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentSubject } from "@/server/session";
import { PasswordChangeForm } from "@/components/PasswordChangeForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Criar sua senha", robots: { index: false, follow: false } };

export default async function TrocarSenha() {
  const s = await currentSubject();
  if (!s) redirect("/entrar");
  if (!s.mustChangePassword) redirect(s.mfa ? "/admin" : "/entrar/mfa");
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-linha bg-papel p-8 shadow-[var(--sombra)]">
        <h1 className="text-2xl font-semibold">Crie a sua senha</h1>
        <p className="mt-2 text-tinta-2">Você entrou com uma senha provisória. Escolha uma senha pessoal antes de continuar; ninguém da administração vai conhecê-la.</p>
        <PasswordChangeForm currentLabel="Senha provisória" next={s.mfa ? "/admin" : "/entrar/mfa"} />
      </div>
    </main>
  );
}
