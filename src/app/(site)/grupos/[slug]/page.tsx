import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { getPublicGroup, isStale } from "@/server/groups";
import { Badge, btn, Container, DemoBadge, field, Notice } from "@/components/ui";
import { fmtPublished, hhmm, weekday } from "@/components/site/format";
import { sugerirCorrecao } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/grupos/[slug]">): Promise<Metadata> {
  const g = await getPublicGroup(db, (await params).slug);
  return g ? { title: g.name, description: `${g.name} — ${weekday(g.weekday)}, ${hhmm(g.startTime)}, ${g.venue}, ${g.municipality}.` } : {};
}

export default async function GrupoPage({ params, searchParams }: PageProps<"/grupos/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const g = await getPublicGroup(db, slug);
  if (!g) notFound();
  const stale = isStale(g.lastConfirmedAt);
  const osm = g.latitude && g.longitude ? `https://www.openstreetmap.org/?mlat=${encodeURIComponent(g.latitude)}&mlon=${encodeURIComponent(g.longitude)}#map=17/${g.latitude}/${g.longitude}` : null;

  return (
    <Container narrow className="py-10">
      <nav aria-label="Trilha"><Link href="/grupos">← Grupos de Oração</Link></nav>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {g.status === "pausado" && <Badge tone="alerta">Pausado temporariamente</Badge>}
        <DemoBadge show={g.isDemo} />
      </div>
      <h1 className="mt-2 text-display font-semibold">{g.name}</h1>
      <p className="mt-2 text-lg text-tinta-2">{g.parish} · {g.municipality}{g.region ? ` · ${g.region}` : ""}</p>

      {stale && (
        <div className="mt-6"><Notice tone="alerta" title="Informação a confirmar">
          Estes dados não foram confirmados pela coordenação nos últimos meses. Antes de ir, confirme com a paróquia.
        </Notice></div>
      )}

      <dl className="mt-8 grid gap-6 rounded-[var(--radius-lg)] border border-linha bg-papel p-6 sm:grid-cols-2">
        <div><dt className="text-sm font-semibold uppercase tracking-wide text-tinta-3">Quando</dt><dd className="mt-1 text-lg font-semibold text-vinho">Toda {weekday(g.weekday)}, {hhmm(g.startTime)}{g.endTime ? ` às ${hhmm(g.endTime)}` : ""}</dd></div>
        <div><dt className="text-sm font-semibold uppercase tracking-wide text-tinta-3">Onde</dt><dd className="mt-1">{g.venue}{g.publicAddress && <><br />{g.publicAddress}</>}</dd></div>
        {g.accessibilityInfo && <div className="sm:col-span-2"><dt className="text-sm font-semibold uppercase tracking-wide text-tinta-3">Acessibilidade informada</dt><dd className="mt-1">{g.accessibilityInfo}</dd></div>}
        {(g.publicContact || g.authorizedPhone) && <div className="sm:col-span-2"><dt className="text-sm font-semibold uppercase tracking-wide text-tinta-3">Contato</dt><dd className="mt-1">{g.publicContact}{g.authorizedPhone && <><br />Telefone (autorizado): {g.authorizedPhone}</>}</dd></div>}
        <div className="sm:col-span-2 text-sm text-tinta-3">{g.lastConfirmedAt ? `Informações confirmadas pela coordenação em ${fmtPublished(g.lastConfirmedAt)}.` : "Informações ainda não confirmadas pela coordenação."}</div>
      </dl>

      {osm && <p className="mt-4"><a href={osm} rel="noopener noreferrer external" className="font-semibold">Ver localização no OpenStreetMap<span className="sr-only"> (abre site externo)</span></a></p>}
      {g.description && <div className="prosa mt-8"><p>{g.description}</p></div>}

      <section aria-labelledby="corrigir" className="mt-12 border-t border-linha pt-8">
        <h2 id="corrigir" className="text-2xl font-semibold">Algo mudou neste grupo?</h2>
        {sp.enviado === "1" ? (
          <div className="mt-4"><Notice tone="sucesso">Obrigado! Sua sugestão foi enviada para a coordenação e será conferida antes de qualquer alteração.</Notice></div>
        ) : (
          <form action={sugerirCorrecao} className="mt-4 space-y-4">
            <input type="hidden" name="slug" value={g.slug} />
            <div>
              <label htmlFor="mensagem" className={field.label}>O que precisa ser corrigido?</label>
              <textarea id="mensagem" name="mensagem" required minLength={10} maxLength={2000} rows={4} className={field.input} />
              <p className={field.hint}>A sugestão é conferida pela coordenação; nada é publicado automaticamente.</p>
            </div>
            <div>
              <label htmlFor="email" className={field.label}>Seu e-mail (opcional)</label>
              <input id="email" name="email" type="email" maxLength={200} autoComplete="email" className={field.input} />
              <p className={field.hint}>Usado apenas para tirar dúvidas sobre esta sugestão.</p>
            </div>
            <button className={btn.secundario}>Enviar sugestão</button>
          </form>
        )}
      </section>
    </Container>
  );
}
