import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import { Wordmark } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entrar — equipe", robots: { index: false, follow: false } };

export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const sp = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-linha bg-papel p-8 shadow-[var(--sombra)]">
        <Wordmark />
        <h1 className="mt-6 text-2xl font-semibold">Acesso da equipe</h1>
        <p className="mt-1 text-tinta-2">Área restrita a servos com conta criada pela coordenação.</p>
        {sp.sem_papel && <p role="alert" className="mt-4 rounded-md bg-alerta-claro p-3 text-alerta">Sua conta ainda não tem papel atribuído. Fale com o gestor institucional.</p>}
        <LoginForm />
      </div>
    </main>
  );
}
