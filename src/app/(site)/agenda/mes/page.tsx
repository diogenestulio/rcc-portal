import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { agenda, type AgendaItem } from "@/server/events";
import { wallToUtc } from "@/server/calendar/time";
import { Container, PageHeader, btn } from "@/components/ui";
import { fmtTime, TZ } from "@/components/site/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agenda do mês" };

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WD_FULL = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export default async function MesPage({ searchParams }: PageProps<"/agenda/mes">) {
  const sp = await searchParams;
  const nowLocal = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).format(new Date());
  const m = typeof sp.m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m) ? sp.m : nowLocal.slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  const from = wallToUtc({ y, m: mo, d: 1, h: 0, mi: 0 }, TZ);
  const to = wallToUtc({ y: mo === 12 ? y + 1 : y, m: mo === 12 ? 1 : mo + 1, d: 1, h: 0, mi: 0 }, TZ);
  const items = await agenda(db, from, to);
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const firstWd = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
  const byDay = new Map<number, AgendaItem[]>();
  for (const o of items) {
    const d = o.date ? Number(o.date.slice(8, 10)) : Number(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, day: "2-digit" }).format(o.start!));
    if (o.date && o.date.slice(0, 7) !== m) continue;
    byDay.set(d, [...(byDay.get(d) ?? []), o]);
  }
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, mo - 1, 15)));
  const prev = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  const cells: (number | null)[] = [...Array(firstWd).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  return (
    <>
      <PageHeader eyebrow="Agenda" title={`Agenda de ${label}`}>
        <nav aria-label="Navegar entre meses" className="mt-6 flex flex-wrap gap-3">
          <Link href={`/agenda/mes?m=${prev}`} className={btn.secundario}>← Mês anterior</Link>
          <Link href={`/agenda/mes?m=${next}`} className={btn.secundario}>Próximo mês →</Link>
          <Link href="/agenda" className={btn.discreto}>Ver em lista</Link>
        </nav>
      </PageHeader>
      <Container className="py-10">
        {/* Grade visual (telas largas). A lista abaixo é a versão acessível e completa. */}
        <table className="hidden w-full table-fixed border-collapse md:table" aria-describedby="nota-grade">
          <caption className="sr-only">Calendário de {label}</caption>
          <thead><tr>{WD.map((d, i) => <th key={d} scope="col" className="py-2 text-sm font-semibold text-tinta-3"><abbr title={WD_FULL[i]} className="no-underline">{d}</abbr></th>)}</tr></thead>
          <tbody>
            {Array.from({ length: cells.length / 7 }, (_, r) => (
              <tr key={r}>
                {cells.slice(r * 7, r * 7 + 7).map((d, i) => (
                  <td key={i} className="h-28 border border-linha bg-papel p-1.5 align-top">
                    {d && <>
                      <span className="text-sm font-semibold text-tinta-3">{d}</span>
                      <ul className="mt-1 space-y-1">
                        {(byDay.get(d) ?? []).slice(0, 3).map((o) => (
                          <li key={`${o.eventId}-${o.key}`} className="truncate text-xs">
                            <Link href={`/agenda/${o.ev.slug}`} className={`no-underline ${o.cancelled ? "text-tinta-3 line-through" : "text-vinho"}`}>{o.start ? `${fmtTime(o.start)} ` : ""}{o.ev.title}</Link>
                          </li>
                        ))}
                        {(byDay.get(d)?.length ?? 0) > 3 && <li className="text-xs text-tinta-3">+{byDay.get(d)!.length - 3} na lista</li>}
                      </ul>
                    </>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p id="nota-grade" className="sr-only">A lista de eventos do mês, abaixo da grade, contém as mesmas informações.</p>

        <h2 className="mt-10 text-2xl font-semibold">Eventos do mês</h2>
        {items.length === 0 ? <p className="mt-3 text-tinta-2">Nenhum evento publicado neste mês.</p> : (
          <ul className="mt-4 divide-y divide-linha border-y border-linha">
            {[...byDay.entries()].sort((a, b) => a[0] - b[0]).flatMap(([d, list]) => list.map((o) => (
              <li key={`${o.eventId}-${o.key}`} className="flex flex-wrap gap-x-4 py-3">
                <span className="w-40 font-semibold text-vinho">{d} de {label.split(" ")[0]}{o.start ? `, ${fmtTime(o.start)}` : ""}</span>
                <Link href={`/agenda/${o.ev.slug}`} className={o.cancelled ? "line-through" : ""}>{o.ev.title}</Link>
                {o.cancelled && <span className="font-semibold text-perigo">(cancelado)</span>}
              </li>
            )))}
          </ul>
        )}
      </Container>
    </>
  );
}
