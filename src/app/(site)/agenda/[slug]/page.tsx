import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { displayStatus, getPublicEvent, toIcs } from "@/server/events";
import { expandOccurrences } from "@/server/calendar/recurrence";
import { googleTemplateLink } from "@/server/calendar/ics";
import { formatBRL } from "@/server/store/checkout";
import { Badge, btn, Container, DemoBadge, Notice } from "@/components/ui";
import { fmtDateOnly, fmtDateTime, fmtTime } from "@/components/site/format";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/agenda/[slug]">): Promise<Metadata> {
  const r = await getPublicEvent(db, (await params).slug);
  return r ? { title: r.ev.title, description: r.ev.summary ?? undefined, openGraph: { title: r.ev.title, description: r.ev.summary ?? undefined } } : {};
}

const WINDOW_TEXT = { abertas: "Inscrições abertas", em_breve: "Inscrições em breve", encerradas: "Inscrições encerradas", esgotadas: "Vagas esgotadas", nao_aplica: "" } as const;

export default async function EventoPage({ params }: PageProps<"/agenda/[slug]">) {
  const { slug } = await params;
  const r = await getPublicEvent(db, slug);
  if (!r) notFound();
  const { ev, exceptions, batches, occupied, window } = r;
  const st = displayStatus(ev);
  const now = new Date();
  const next = ev.rrule ? expandOccurrences(ev, exceptions, now, new Date(now.getTime() + 60 * 86_400_000)).slice(0, 6) : [];
  const ics = toIcs(ev, exceptions, env.APP_URL);
  const when = ev.allDay
    ? `${fmtDateOnly(ev.startDate!)}${ev.endDate && ev.endDate !== ev.startDate ? ` (dia inteiro)` : " — dia inteiro"}`
    : `${fmtDateTime(ev.startsAt!)}${ev.endsAt ? ` até ${fmtTime(ev.endsAt)}` : ""}`;
  const vagas = ev.capacity != null ? Math.max(0, ev.capacity - occupied) : null;
  // JSON-LD apenas com dados públicos e reais do cadastro
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Event", name: ev.title, description: ev.summary ?? undefined,
    startDate: ev.allDay ? ev.startDate : ev.startsAt?.toISOString(), endDate: ev.allDay ? ev.endDate ?? undefined : ev.endsAt?.toISOString(),
    eventStatus: st === "cancelado" ? "https://schema.org/EventCancelled" : st === "adiado" ? "https://schema.org/EventPostponed" : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: ev.location ? { "@type": "Place", name: ev.location, address: ev.address ?? undefined } : undefined,
  };

  return (
    <Container narrow className="py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Trilha"><Link href="/agenda">← Agenda</Link></nav>
      <div className="mt-4 flex flex-wrap gap-2">
        {st === "cancelado" && <Badge tone="perigo">Cancelado</Badge>}
        {st === "adiado" && <Badge tone="alerta">Adiado</Badge>}
        {st === "encerrado" && <Badge>Encerrado</Badge>}
        {window !== "nao_aplica" && st === "agendado" && <Badge tone={window === "abertas" ? "sucesso" : "neutro"}>{WINDOW_TEXT[window]}</Badge>}
        <DemoBadge show={ev.isDemo} />
      </div>
      <h1 className="mt-2 text-display font-semibold">{ev.title}</h1>
      {ev.summary && <p className="mt-3 text-lg text-tinta-2">{ev.summary}</p>}

      {st === "cancelado" && <div className="mt-6"><Notice tone="perigo" title="Este evento foi cancelado">Quem já se inscreveu será informado pela organização.</Notice></div>}
      {st === "adiado" && <div className="mt-6"><Notice tone="alerta" title="Este evento foi adiado">A nova data será publicada aqui.</Notice></div>}

      <dl className="mt-8 grid gap-5 rounded-[var(--radius-lg)] border border-linha bg-papel p-6 sm:grid-cols-2">
        <div><dt className="font-titulo text-[0.95rem] italic text-sol-texto">Quando</dt><dd className="mt-1 font-semibold text-marca">{ev.rrule ? "Evento recorrente — próximas datas abaixo" : when}</dd></div>
        {ev.location && <div><dt className="font-titulo text-[0.95rem] italic text-sol-texto">Onde</dt><dd className="mt-1">{ev.location}{ev.address && <><br />{ev.address}</>}</dd></div>}
        {vagas != null && st === "agendado" && <div><dt className="font-titulo text-[0.95rem] italic text-sol-texto">Vagas</dt><dd className="mt-1">{vagas > 0 ? `${vagas} de ${ev.capacity}` : "Esgotadas"}</dd></div>}
        {batches.length > 0 && <div><dt className="font-titulo text-[0.95rem] italic text-sol-texto">Valores</dt><dd className="mt-1">{batches.map((b) => <span key={b.id} className="block">{b.name}: {b.priceCents === 0 ? "gratuito" : formatBRL(b.priceCents)}</span>)}</dd></div>}
      </dl>

      {next.length > 0 && (
        <section aria-labelledby="datas" className="mt-8">
          <h2 id="datas" className="text-xl font-semibold">Próximas datas</h2>
          <ul className="mt-3 space-y-1">
            {next.map((o) => <li key={o.key} className={o.cancelled ? "text-tinta-3 line-through" : ""}>{o.start ? fmtDateTime(o.start) : fmtDateOnly(o.date!)}{o.cancelled && <span className="ml-2 font-semibold text-perigo no-underline">cancelado</span>}{o.modified && <span className="ml-2 text-azul">(alterado{o.location ? `: ${o.location}` : ""})</span>}</li>)}
          </ul>
        </section>
      )}

      {ev.descriptionHtml && <div className="prosa mt-8" dangerouslySetInnerHTML={{ __html: ev.descriptionHtml }} />}

      {window === "abertas" && st === "agendado" && (
        <div className="mt-10"><Link href={`/agenda/${ev.slug}/inscricao`} className={btn.primario}>Fazer inscrição</Link></div>
      )}

      {st !== "encerrado" && (
        <section aria-labelledby="add" className="mt-12 rounded-[var(--radius-lg)] border border-linha bg-marfim-2/60 p-6">
          <h2 id="add" className="text-xl font-semibold">Adicionar à minha agenda</h2>
          <p className="mt-1 text-tinta-2">Não é preciso informar e-mail nem fazer login.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={googleTemplateLink(ics)} className={btn.secundario} rel="noopener noreferrer external">Google Agenda<span className="sr-only"> (abre site externo)</span></a>
            <a href={`/agenda/${ev.slug}/evento.ics`} className={btn.secundario} download>Baixar arquivo .ics (Apple, Outlook)</a>
            <a href="/agenda.ics" className={btn.discreto}>Assinar a agenda completa</a>
          </div>
          <details className="mt-4 text-sm text-tinta-2">
            <summary className="cursor-pointer font-semibold text-tinta">Qual a diferença?</summary>
            <p className="mt-2"><strong>Adicionar o evento</strong> cria uma cópia na sua agenda. Se a organização mudar horário ou local depois, a cópia pode não ser atualizada — confira esta página.</p>
            <p className="mt-2"><strong>Assinar a agenda</strong> faz seu aplicativo consultar nossa agenda de tempos em tempos. A frequência depende do aplicativo (pode levar horas), então mudanças não aparecem instantaneamente.</p>
          </details>
        </section>
      )}
    </Container>
  );
}
