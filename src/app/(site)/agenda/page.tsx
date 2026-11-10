import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { agenda, type AgendaItem } from "@/server/events";
import { StatusBadges } from "@/components/site/StatusBadges";
import { syncLag } from "@/server/calendar/google";
import { btn, Container, EmptyState, Notice, PageHeader } from "@/components/ui";
import { fmtDateOnly, fmtTime, TZ } from "@/components/site/format";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agenda", description: "Encontros, retiros, formações e eventos da RCC na Arquidiocese." };

function dayKey(o: AgendaItem) {
  if (o.date) return o.date;
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(o.start!);
}

export default async function AgendaPage() {
  const now = new Date();
  const items = await agenda(db, now, new Date(now.getTime() + 120 * 86_400_000));
  const groups = new Map<string, AgendaItem[]>();
  for (const o of items.slice(0, 200)) { const k = dayKey(o); groups.set(k, [...(groups.get(k) ?? []), o]); }
  const lag = env.GOOGLE_CALENDAR_MODE === "google_to_cms" ? await syncLag(db) : null;

  return (
    <>
      <PageHeader eyebrow="Agenda" title="Próximos eventos" intro="Encontros, retiros e formações. As reuniões semanais dos grupos estão em Grupos de Oração.">
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/agenda/mes" className={btn.secundario}>Ver por mês</Link>
          <a href="/agenda.ics" className={btn.discreto}>Assinar agenda (iCal)</a>
        </div>
      </PageHeader>
      <Container className="py-10">
        {lag?.stale && (
          <div className="mb-6"><Notice tone="alerta" title="Agenda possivelmente desatualizada">
            A última atualização foi {lag.lastSuccessAt ? `há ${lag.lagMinutes} minutos` : "não registrada"}. Confirme horários importantes com a organização.
          </Notice></div>
        )}
        {groups.size === 0 ? (
          <EmptyState title="Nenhum evento publicado neste período" action={<a href="/agenda.ics" className={btn.secundario}>Assinar a agenda</a>}>
            Assine a agenda para ser avisado pelo seu aplicativo de calendário quando novos eventos forem publicados.
          </EmptyState>
        ) : (
          <ol className="space-y-10">
            {[...groups.entries()].map(([day, list]) => (
              <li key={day}>
                <h2 className="border-b border-linha pb-2 text-xl font-semibold"><time dateTime={day}>{fmtDateOnly(day)}</time></h2>
                <ul className="mt-4 space-y-3">
                  {list.map((o) => (
                    <li key={`${o.eventId}-${o.key}`} className="grid gap-1 rounded-[var(--radius-md)] border border-linha bg-papel p-4 sm:grid-cols-[7rem_1fr]">
                      <p className="font-semibold text-vinho">{o.start ? <time dateTime={o.start.toISOString()}>{fmtTime(o.start)}</time> : "Dia inteiro"}</p>
                      <div>
                        <h3 className={`text-lg font-semibold ${o.cancelled ? "line-through decoration-1" : ""}`}><Link href={`/agenda/${o.ev.slug}`} className="text-tinta no-underline hover:underline">{o.ev.title}</Link></h3>
                        {(o.location ?? o.ev.location) && <p className="text-tinta-2">{o.location ?? o.ev.location}</p>}
                        <div className="mt-2 flex flex-wrap gap-2"><StatusBadges o={o} /></div>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </Container>
    </>
  );
}
