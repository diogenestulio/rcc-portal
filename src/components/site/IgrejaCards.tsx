import Link from "next/link";
import type { ListedContent } from "@/server/content";
import { DemoBadge } from "@/components/ui";
import { Capa, periodo } from "./ContentViews";
import { dateParts } from "./format";

/** Cartão de acontecimento da Igreja/RCC: capa, data em destaque e local. */
export function CartaoAcontecimento({ c, grande }: { c: ListedContent; grande?: boolean }) {
  const p = c.event_date ? dateParts(null, c.event_date) : null;
  const quando = periodo(c.event_date, c.event_end_date);
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-linha bg-papel transition-[border-color,box-shadow] duration-[var(--dur)] hover:border-ouro-suave hover:shadow-[var(--sombra-alta)] focus-within:border-ouro-suave">
      <div className="relative">
        {c.cover_id
          ? <Capa c={c} w={grande ? 1280 : 640} className={grande ? "aspect-[16/9] w-full object-cover" : "aspect-[16/10] w-full object-cover"} />
          : <div aria-hidden="true" className="estandarte textura-losangos aspect-[16/10] w-full" />}
        {p && (
          <p aria-hidden="true" className="absolute left-4 top-4 rounded-[var(--radius-md)] bg-estandarte/95 px-3 py-2 text-center leading-none shadow-[var(--sombra-alta)]">
            <span className="block font-display text-3xl text-ouro">{p.dia}</span>
            <span className="mt-1 block font-titulo text-sm italic text-ouro-suave">{p.mes}</span>
          </p>
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className={grande ? "font-display text-[1.9rem] font-normal leading-tight" : "text-[1.3rem]"}>
          <Link href={`/igreja-e-renovacao/${c.slug}`} className="text-tinta no-underline after:absolute after:inset-0 group-hover:text-marca-escuro group-hover:underline">{c.title}</Link>
        </h3>
        {quando && <p className="mt-2 font-bold text-marca">{quando}</p>}
        {c.event_place && <p className="text-tinta-3">{c.event_place}</p>}
        {c.summary && <p className="mt-3 text-tinta-2">{c.summary}</p>}
        <div className="mt-auto pt-4"><DemoBadge show={c.is_demo} /></div>
      </div>
    </article>
  );
}
