import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import { requireCan } from "@/server/session";
import { adminProducts, centsToInput, stockHistory } from "@/server/store/catalog";
import { Badge, btn, Card, field, Notice } from "@/components/ui";
import { fmtPublished } from "@/components/site/format";
import { movimentarEstoque, salvarProduto, salvarVariante } from "../../actions";

export const metadata = { title: "Produto" };
const TIPO: Record<string, string> = { entrada: "Entrada", ajuste: "Ajuste", devolucao: "Devolução", baixa_venda: "Venda" };

export default async function ProdutoAdmin({ params, searchParams }: PageProps<"/admin/loja/produtos/[id]">) {
  const s = await requireCan("loja.produtos");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = (await adminProducts(db, s)).find((x) => x.id === id);
  if (!p) notFound();
  const [hist, imgs] = await Promise.all([
    stockHistory(db, s, id),
    db.select({ id: media.id, alt: media.altText }).from(media).where(and(like(media.mimeType, "image/%"), eq(media.isPrivate, false))).orderBy(desc(media.createdAt)).limit(100),
  ]);
  return (
    <div className="max-w-5xl">
      <p><Link href="/admin/loja/produtos">← Produtos</Link></p>
      <div className="mt-3 flex flex-wrap items-center gap-2"><h1 className="text-3xl font-semibold">{p.name}</h1>{p.active ? <Badge tone="sucesso">Publicado</Badge> : <Badge>Rascunho</Badge>}</div>
      {p.active && <p className="text-sm"><Link href={`/loja/${p.slug}`}>Ver na loja</Link> (aparece quando a loja estiver ligada)</p>}
      {typeof sp.erro === "string" && <div className="mt-4"><Notice tone="perigo">{sp.erro}</Notice></div>}
      {sp.ok && <div className="mt-4"><Notice tone="sucesso">{sp.ok === "estoque" ? "Estoque atualizado." : "Salvo."}</Notice></div>}

      <Card className="mt-6">
        <h2 className="text-xl font-semibold">Dados do produto</h2>
        <form action={salvarProduto} className="mt-4 space-y-4">
          <input type="hidden" name="id" value={p.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label htmlFor="nome" className={field.label}>Nome</label><input id="nome" name="nome" required defaultValue={p.name} className={field.input} /></div>
            <div><label htmlFor="slug" className={field.label}>Endereço</label><input id="slug" name="slug" required defaultValue={p.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={field.input} /></div>
            <div><label htmlFor="categoria" className={field.label}>Categoria</label><input id="categoria" name="categoria" defaultValue={p.category ?? ""} className={field.input} /></div>
          </div>
          <div><label htmlFor="descricao" className={field.label}>Descrição</label><textarea id="descricao" name="descricao" rows={5} maxLength={5000} defaultValue={p.description ?? ""} className={field.input} /></div>
          <div><label htmlFor="capa" className={field.label}>Foto (da biblioteca de Mídia)</label>
            <select id="capa" name="capa" defaultValue={p.coverMediaId ?? ""} className={field.input}><option value="">Sem foto</option>{imgs.map((m) => <option key={m.id} value={m.id}>{m.alt ?? `imagem ${m.id.slice(0, 8)}`}</option>)}</select>
            <p className={field.hint}>Envie a foto antes em <Link href="/admin/midia">Mídia</Link>.</p></div>
          <label className="flex items-center gap-2"><input type="checkbox" name="ativo" defaultChecked={p.active} className="h-5 w-5" /> Publicado na loja</label>
          <button className={btn.primario}>Salvar produto</button>
        </form>
      </Card>

      <Card className="mt-6">
        <h2 className="text-xl font-semibold">Variantes, preço e estoque</h2>
        <ul className="mt-4 space-y-4">
          {p.variants.map((v) => (
            <li key={v.id} className="rounded-[var(--radius-md)] border border-linha p-3">
              <form action={salvarVariante} className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem_6rem_auto] sm:items-end">
                <input type="hidden" name="produto" value={p.id} /><input type="hidden" name="id" value={v.id} />
                <div><label className={field.label} htmlFor={`sku-${v.id}`}>SKU</label><input id={`sku-${v.id}`} name="sku" defaultValue={v.sku} required className={field.input + " font-mono uppercase"} /></div>
                <div><label className={field.label} htmlFor={`r-${v.id}`}>Variante</label><input id={`r-${v.id}`} name="rotulo" defaultValue={v.label} required className={field.input} /></div>
                <div><label className={field.label} htmlFor={`p-${v.id}`}>Preço (R$)</label><input id={`p-${v.id}`} name="preco" defaultValue={centsToInput(v.priceCents)} required inputMode="decimal" className={field.input} /></div>
                <div><label className={field.label} htmlFor={`g-${v.id}`}>Peso (g)</label><input id={`g-${v.id}`} name="peso" type="number" min={0} defaultValue={v.weightGrams ?? ""} className={field.input} /></div>
                <div className="flex items-center gap-3"><label className="flex items-center gap-1 text-sm"><input type="checkbox" name="ativa" defaultChecked={v.active} /> ativa</label><button className={btn.secundario}>Salvar</button></div>
              </form>
              <p className="mt-2 text-sm">Em estoque: <strong>{v.stockOnHand}</strong> · reservado em pedidos: {v.stockReserved} · livre: <strong>{v.stockOnHand - v.stockReserved}</strong></p>
              <form action={movimentarEstoque} className="mt-2 flex flex-wrap items-end gap-2">
                <input type="hidden" name="produto" value={p.id} /><input type="hidden" name="variante" value={v.id} />
                <select name="tipo" aria-label="Tipo de movimentação" className="rounded-[var(--radius-sm)] border border-tinta-3 px-2 py-2"><option value="entrada">Entrada (+)</option><option value="devolucao">Devolução (+)</option><option value="ajuste">Ajuste (±)</option></select>
                <input name="quantidade" type="number" required aria-label="Quantidade" placeholder="Qtd." className="w-24 rounded-[var(--radius-sm)] border border-tinta-3 px-2 py-2" />
                <input name="motivo" aria-label="Motivo" placeholder="Motivo (obrigatório no ajuste)" maxLength={300} className="min-w-48 flex-1 rounded-[var(--radius-sm)] border border-tinta-3 px-2 py-2" />
                <button className={btn.discreto}>Registrar</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={salvarVariante} className="mt-6 grid gap-3 border-t border-linha pt-4 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end">
          <input type="hidden" name="produto" value={p.id} /><input type="hidden" name="ativa" value="on" />
          <div><label className={field.label} htmlFor="sku-novo">SKU</label><input id="sku-novo" name="sku" required placeholder="TERCO-MAD-G" className={field.input + " font-mono uppercase"} /></div>
          <div><label className={field.label} htmlFor="r-novo">Variante</label><input id="r-novo" name="rotulo" required placeholder="Único, P, M, Azul…" className={field.input} /></div>
          <div><label className={field.label} htmlFor="p-novo">Preço (R$)</label><input id="p-novo" name="preco" required inputMode="decimal" placeholder="39,90" className={field.input} /></div>
          <button className={btn.secundario}>Adicionar variante</button>
        </form>
      </Card>

      <Card className="mt-6">
        <h2 className="text-xl font-semibold">Histórico de estoque</h2>
        {hist.length === 0 ? <p className="mt-2 text-sm text-tinta-3">Sem movimentações.</p> : (
          <ul className="mt-2 space-y-1 text-sm">{hist.map(({ m, sku }) => <li key={m.id}>{fmtPublished(m.createdAt)} · <span className="font-mono">{sku}</span> · {TIPO[m.kind]} {m.quantity > 0 ? `+${m.quantity}` : m.quantity}{m.note ? ` — ${m.note}` : ""}</li>)}</ul>
        )}
      </Card>
    </div>
  );
}
