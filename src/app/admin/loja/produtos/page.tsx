import Link from "next/link";
import { db } from "@/db";
import { requireCan } from "@/server/session";
import { adminProducts } from "@/server/store/catalog";
import { formatBRL } from "@/server/store/checkout";
import { Badge, btn, Card, EmptyState, field, Notice } from "@/components/ui";
import { salvarProduto } from "../actions";

export const metadata = { title: "Produtos" };

export default async function Produtos({ searchParams }: PageProps<"/admin/loja/produtos">) {
  const s = await requireCan("loja.produtos");
  const sp = await searchParams;
  const list = await adminProducts(db, s);
  return (
    <div className="max-w-6xl">
      <p><Link href="/admin/loja">← Loja</Link></p>
      <h1 className="mt-3 text-3xl font-semibold">Produtos e estoque</h1>
      {typeof sp.erro === "string" && <div className="mt-4"><Notice tone="perigo">{sp.erro}</Notice></div>}
      <Card className="mt-6">
        <h2 className="text-xl font-semibold">Novo produto</h2>
        <p className="text-sm text-tinta-2">Crie o produto, depois cadastre as variantes (tamanho, cor ou “Único”) com preço e estoque, e só então publique.</p>
        <form action={salvarProduto} className="mt-4 grid gap-4 sm:grid-cols-3 sm:items-end">
          <div><label htmlFor="nome" className={field.label}>Nome</label><input id="nome" name="nome" required minLength={3} maxLength={160} className={field.input} /></div>
          <div><label htmlFor="slug" className={field.label}>Endereço</label><input id="slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} placeholder="terco-de-madeira" className={field.input} /></div>
          <div><label htmlFor="categoria" className={field.label}>Categoria</label><input id="categoria" name="categoria" maxLength={60} placeholder="Livros" className={field.input} /></div>
          <button className={btn.primario + " sm:col-span-3 sm:justify-self-start"}>Criar produto</button>
        </form>
      </Card>
      {list.length === 0 ? <div className="mt-6"><EmptyState title="Nenhum produto cadastrado" /></div> : (
        <table className="mt-6 w-full border-collapse bg-papel text-left">
          <thead className="bg-marfim-2 text-sm"><tr><th scope="col" className="p-3">Produto</th><th scope="col" className="p-3">Variantes</th><th scope="col" className="p-3">Estoque livre</th><th scope="col" className="p-3">Situação</th></tr></thead>
          <tbody>{list.map((p) => {
            const livre = p.variants.reduce((a, v) => a + v.stockOnHand - v.stockReserved, 0);
            return (
              <tr key={p.id} className="border-t border-linha">
                <td className="p-3"><Link href={`/admin/loja/produtos/${p.id}`} className="font-semibold">{p.name}</Link><span className="block text-xs text-tinta-3">{p.category}</span></td>
                <td className="p-3 text-sm">{p.variants.map((v) => `${v.label} (${formatBRL(v.priceCents)})`).join(", ") || <span className="text-tinta-3">nenhuma</span>}</td>
                <td className="p-3">{livre}{livre === 0 && p.variants.length > 0 && <Badge tone="alerta">esgotado</Badge>}</td>
                <td className="p-3">{p.active ? <Badge tone="sucesso">Publicado</Badge> : <Badge>Rascunho</Badge>}</td>
              </tr>
            );
          })}</tbody>
        </table>
      )}
    </div>
  );
}
