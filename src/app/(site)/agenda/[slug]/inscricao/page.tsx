import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { getPublicEvent } from "@/server/events";
import { formatBRL } from "@/server/store/checkout";
import { btn, Container, field, Notice } from "@/components/ui";
import { env } from "@/lib/env";
import { inscrever } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inscrição", robots: { index: false } };

const ERR: Record<string, string> = {
  esgotado: "As vagas se esgotaram enquanto você preenchia. Sentimos muito.",
  duplicada: "Já existe uma inscrição com este nome e e-mail neste evento.",
  fechada: "As inscrições não estão abertas.",
  invalida: "Confira os dados informados.",
  pagamento: "O pagamento online ainda não está disponível para este evento. Procure a organização.",
  limite: "Muitas tentativas. Aguarde alguns minutos.",
};

export default async function InscricaoPage({ params, searchParams }: PageProps<"/agenda/[slug]/inscricao">) {
  const { slug } = await params;
  const sp = await searchParams;
  const r = await getPublicEvent(db, slug);
  if (!r) notFound();
  const { ev, batches, window } = r;
  const err = typeof sp.erro === "string" ? ERR[sp.erro] ?? ERR.invalida : null;
  const pagos = batches.some((b) => b.priceCents > 0);

  return (
    <Container narrow className="py-10">
      <nav aria-label="Trilha"><Link href={`/agenda/${ev.slug}`}>← {ev.title}</Link></nav>
      <h1 className="mt-4 text-4xl font-semibold">Inscrição</h1>
      <p className="mt-2 text-lg text-tinta-2">{ev.title}</p>

      {window !== "abertas" ? (
        <div className="mt-8"><Notice tone="alerta">As inscrições para este evento não estão abertas no momento.</Notice></div>
      ) : (
        <form action={inscrever} className="mt-8 space-y-5" noValidate={false}>
          {err && <Notice tone="perigo">{err}</Notice>}
          <input type="hidden" name="slug" value={ev.slug} />
          <input type="hidden" name="chave" value={randomUUID()} />
          {batches.length > 0 && (
            <fieldset>
              <legend className={field.label}>Lote</legend>
              <div className="mt-2 space-y-2">
                {batches.map((b, i) => (
                  <label key={b.id} className="flex min-h-12 items-center gap-3 rounded-[var(--radius-sm)] border border-linha bg-papel px-3">
                    <input type="radio" name="lote" value={b.id} defaultChecked={i === 0} required />
                    <span>{b.name} — {b.priceCents === 0 ? "gratuito" : formatBRL(b.priceCents)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div>
            <label htmlFor="nome" className={field.label}>Nome completo</label>
            <input id="nome" name="nome" required minLength={3} maxLength={120} autoComplete="name" className={field.input} />
          </div>
          <div>
            <label htmlFor="email" className={field.label}>E-mail</label>
            <input id="email" name="email" type="email" required maxLength={200} autoComplete="email" className={field.input} aria-describedby="email-dica" />
            <p id="email-dica" className={field.hint}>Para enviar a confirmação. Pessoas da mesma família podem usar o mesmo e-mail.</p>
          </div>
          <div>
            <label htmlFor="telefone" className={field.label}>Telefone (opcional)</label>
            <input id="telefone" name="telefone" type="tel" maxLength={30} autoComplete="tel" className={field.input} />
          </div>
          <p className="text-sm text-tinta-2">
            Usamos estes dados somente para organizar este evento, conforme a <Link href="/privacidade">política de privacidade</Link>.
            A inscrição não inclui cadastro em listas de divulgação.
          </p>
          {pagos && env.PAYMENTS_PROVIDER === "off" && <Notice tone="alerta">Pagamento online ainda não habilitado: lotes pagos não podem ser concluídos por aqui.</Notice>}
          <button type="submit" className={btn.primario}>Confirmar inscrição</button>
        </form>
      )}
    </Container>
  );
}
