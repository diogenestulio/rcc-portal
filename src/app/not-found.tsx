import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col items-start justify-center px-4 py-24">
      <p className="font-titulo text-lg italic text-sol-texto">Página não encontrada</p>
      <h1 className="mt-2 text-4xl font-semibold">Não encontramos esta página</h1>
      <p className="mt-3 text-tinta-2">Ela pode ter mudado de endereço ou ainda não ter sido publicada.</p>
      <p className="mt-6 flex gap-4"><Link href="/">Página inicial</Link><Link href="/grupos">Grupos de Oração</Link><Link href="/agenda">Agenda</Link></p>
    </main>
  );
}
