import Link from "next/link";
import { requireCan } from "@/server/session";
import { btn, Notice } from "@/components/ui";
import { MinistryFields } from "../campos";
import { criarMinisterio } from "../actions";

export const metadata = { title: "Novo ministério" };

export default async function NovoMinisterio({ searchParams }: PageProps<"/admin/ministerios/novo">) {
  await requireCan("ministerio.criar");
  const sp = await searchParams;
  return (
    <div className="max-w-3xl">
      <p><Link href="/admin/ministerios">← Ministérios</Link></p>
      <h1 className="mt-3 text-3xl font-semibold">Novo ministério</h1>
      <p className="mt-2 text-tinta-2">É criado <strong>oculto</strong>. Confira o texto e publique na tela seguinte.</p>
      {typeof sp.erro === "string" && <div className="mt-4"><Notice tone="perigo">{sp.erro}</Notice></div>}
      <form action={criarMinisterio} className="mt-6 space-y-5">
        <MinistryFields />
        <button className={btn.primario}>Criar ministério (oculto)</button>
      </form>
    </div>
  );
}
