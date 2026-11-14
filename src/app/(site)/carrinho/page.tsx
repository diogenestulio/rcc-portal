import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { cart } from "@/db/schema";
import { env } from "@/lib/env";
import { formatBRL, priceCart } from "@/server/store/checkout";
import { readCartToken } from "@/server/store/cart-cookie";
import { btn, Container, EmptyState, field, Notice, PageHeader } from "@/components/ui";
import { alterarQuantidade, finalizar } from "../loja/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Carrinho", robots: { index: false, follow: false } };

const ERROS: Record<string, string> = {
  sem_estoque: "Um dos itens esgotou enquanto você finalizava. Ajuste o carrinho.",
  frete_indisponivel: "Ainda não calculamos frete para entrega. Escolha a retirada no local, se disponível.",
  carrinho_vazio: "Seu carrinho está vazio.",
  loja_desativada: "Os pagamentos online ainda não estão ativos.",
  dados: "Confira nome e e-mail.",
  limite: "Muitas tentativas. Aguarde alguns minutos.",
  invalido: "Opção de entrega inválida.",
};

export default async function Carrinho({ searchParams }: PageProps<"/carrinho">) {
  const sp = await searchParams;
  if (!env.STORE_ENABLED) return <><PageHeader title="Carrinho" /><Container narrow className="py-10"><EmptyState title="Loja em preparação" /></Container></>;
  const token = await readCartToken();
  const [c] = token ? await db.select().from(cart).where(and(eq(cart.token, token), gt(cart.expiresAt, new Date()))) : [];
  const pricing = c ? await priceCart(db, c.id) : null;
  const erro = typeof sp.erro === "string" ? ERROS[sp.erro] ?? "Não foi possível finalizar." : null;

  return (
    <>
      <PageHeader title="Carrinho" />
      <Container narrow className="py-10">
        {sp.ok === "adicionado" && <div className="mb-6"><Notice tone="sucesso">Produto adicionado. <Link href="/loja">Continuar comprando</Link></Notice></div>}
        {!pricing || pricing.lines.length === 0 ? (
          <EmptyState title="Seu carrinho está vazio" action={<Link href="/loja" className={btn.secundario}>Ver produtos</Link>} />
        ) : (
          <>
            <table className="w-full border-collapse bg-papel text-left">
              <caption className="sr-only">Itens do carrinho</caption>
              <thead className="bg-marfim-2 text-sm"><tr><th scope="col" className="p-3">Produto</th><th scope="col" className="p-3">Qtd.</th><th scope="col" className="p-3 text-right">Total</th></tr></thead>
              <tbody>
                {pricing.lines.map((l) => (
                  <tr key={l.variantId} className="border-t border-linha">
                    <td className="p-3"><span className="font-semibold">{l.productName}</span><span className="block text-sm text-tinta-3">{l.variantLabel} · {formatBRL(l.unitPriceCents)} cada</span></td>
                    <td className="p-3">
                      <form action={alterarQuantidade} className="flex items-center gap-2">
                        <input type="hidden" name="variante" value={l.variantId} />
                        <label className="sr-only" htmlFor={`q-${l.variantId}`}>Quantidade de {l.productName}</label>
                        <input id={`q-${l.variantId}`} name="quantidade" type="number" min={0} max={20} defaultValue={l.quantity} className="w-16 rounded-[var(--radius-sm)] border border-tinta-3 px-2 py-2" />
                        <button className="text-sm text-vinho underline underline-offset-2">Atualizar</button>
                      </form>
                    </td>
                    <td className="p-3 text-right font-semibold">{formatBRL(l.lineCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t border-linha"><th scope="row" colSpan={2} className="p-3 text-right">Subtotal</th><td className="p-3 text-right font-semibold">{formatBRL(pricing.subtotalCents)}</td></tr></tfoot>
            </table>
            <p className="mt-2 text-sm text-tinta-3">Para remover um item, coloque a quantidade 0 e clique em Atualizar.</p>

            <section id="finalizar" aria-labelledby="fin" className="mt-10 rounded-[var(--radius-lg)] border border-linha bg-papel p-6">
              <h2 id="fin" className="text-2xl font-semibold">Finalizar compra</h2>
              {erro && <div className="mt-4"><Notice tone="perigo">{erro}</Notice></div>}
              <form action={finalizar} className="mt-4 space-y-4">
                <input type="hidden" name="chave" value={randomUUID()} />
                <div><label htmlFor="nome" className={field.label}>Nome completo</label><input id="nome" name="nome" required minLength={3} maxLength={120} autoComplete="name" className={field.input} /></div>
                <div><label htmlFor="email" className={field.label}>E-mail</label><input id="email" name="email" type="email" required maxLength={200} autoComplete="email" className={field.input} /><p className={field.hint}>Para enviar a confirmação e o link de acompanhamento do pedido.</p></div>
                <div><label htmlFor="telefone" className={field.label}>Telefone (opcional)</label><input id="telefone" name="telefone" type="tel" maxLength={30} autoComplete="tel" className={field.input} /></div>
                <fieldset>
                  <legend className={field.label}>Entrega</legend>
                  <div className="mt-2 space-y-2">
                    {env.STORE_PICKUP_ENABLED && (
                      <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-linha p-3"><input type="radio" name="entrega" value="retirada" defaultChecked required className="mt-1" />
                        <span><span className="font-semibold">Retirar no local — sem custo</span>{env.STORE_PICKUP_INFO && <span className="block text-sm text-tinta-2">{env.STORE_PICKUP_INFO}</span>}</span></label>
                    )}
                    <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-linha p-3"><input type="radio" name="entrega" value="entrega" required defaultChecked={!env.STORE_PICKUP_ENABLED} className="mt-1" />
                      <span><span className="font-semibold">Entrega pelos Correios/transportadora</span><span className="block text-sm text-tinta-2">Frete calculado pelo CEP (ainda não disponível).</span></span></label>
                  </div>
                </fieldset>
                <div className="max-w-48"><label htmlFor="cep" className={field.label}>CEP (para entrega)</label><input id="cep" name="cep" inputMode="numeric" maxLength={9} autoComplete="postal-code" className={field.input} /></div>
                <div className="flex items-center justify-between border-t border-linha pt-4"><span className="font-semibold">Total a pagar</span><span className="text-xl font-semibold text-vinho">{formatBRL(pricing.totalCents)}</span></div>
                <p className="text-sm text-tinta-2">O pagamento é feito na página segura do provedor. Os itens ficam reservados por 30 minutos. Seus dados são usados só para este pedido (<Link href="/privacidade">privacidade</Link>).</p>
                <button className={btn.primario}>Ir para o pagamento</button>
              </form>
            </section>
          </>
        )}
      </Container>
    </>
  );
}
