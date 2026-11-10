import type { Metadata } from "next";
import Link from "next/link";
import { btn, Container, field, Notice, PageHeader } from "@/components/ui";
import { RETENTION_DAYS } from "@/server/prayer";
import { enviarPedido } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pedido de oração", robots: { index: true, follow: true } };

export default async function PedidoOracao({ searchParams }: PageProps<"/pedido-de-oracao">) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Pedido de oração" intro="A equipe de intercessão reza pelas intenções recebidas. Seu pedido não é publicado nem compartilhado." />
      <Container narrow className="py-10">
        {sp.enviado === "1" ? (
          <Notice tone="sucesso" title="Recebemos sua intenção">Vamos rezar por ela. Que o Espírito Santo console e fortaleça você.</Notice>
        ) : (
          <form action={enviarPedido} className="space-y-5">
            {sp.erro && <Notice tone="perigo">{sp.erro === "limite" ? "Muitos envios em pouco tempo. Tente mais tarde." : "Escreva sua intenção (até 1500 caracteres)."}</Notice>}
            <div>
              <label htmlFor="nome" className={field.label}>Primeiro nome (opcional)</label>
              <input id="nome" name="nome" maxLength={60} autoComplete="given-name" className={field.input} />
            </div>
            <div>
              <label htmlFor="intencao" className={field.label}>Sua intenção</label>
              <textarea id="intencao" name="intencao" required minLength={3} maxLength={1500} rows={6} className={field.input} aria-describedby="intencao-dica" />
              <p id="intencao-dica" className={field.hint}>Não é necessário descrever detalhes de saúde ou fatos íntimos. Este espaço não substitui o sacramento da Confissão nem acompanhamento profissional.</p>
            </div>
            <div className="flex items-start gap-3">
              <input id="contato_ok" name="contato_ok" type="checkbox" className="mt-1.5 h-5 w-5" />
              <label htmlFor="contato_ok">Gostaria que alguém da equipe entrasse em contato comigo</label>
            </div>
            <div>
              <label htmlFor="contato" className={field.label}>Telefone ou e-mail (só se marcou a opção acima)</label>
              <input id="contato" name="contato" maxLength={120} className={field.input} />
            </div>
            <p className="text-sm text-tinta-2">
              Seu pedido é lido apenas pela equipe de intercessão autorizada e é apagado automaticamente após {RETENTION_DAYS} dias.
              Saiba mais na <Link href="/privacidade">política de privacidade</Link>.
            </p>
            <button className={btn.primario}>Enviar pedido</button>
          </form>
        )}
      </Container>
    </>
  );
}
