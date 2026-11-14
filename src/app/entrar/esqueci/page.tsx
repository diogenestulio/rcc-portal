import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/ui";
import { ForgotForm } from "./ForgotForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Esqueci minha senha", robots: { index: false, follow: false } };

export default function Esqueci() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-linha bg-papel p-8 shadow-[var(--sombra)]">
        <Wordmark />
        <h1 className="mt-6 text-2xl font-semibold">Esqueci minha senha</h1>
        <p className="mt-1 text-tinta-2">Informe o e-mail da sua conta da equipe. Se ele estiver cadastrado, enviaremos um link para criar uma nova senha.</p>
        <ForgotForm />
        <p className="mt-6 text-sm"><Link href="/entrar">← Voltar para o login</Link></p>
      </div>
    </main>
  );
}
