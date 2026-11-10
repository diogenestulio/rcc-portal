import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { instituicaoProvisoria as INST } from "@/config/instituicao";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Container({ children, className, narrow }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return <div className={cx("mx-auto w-full px-4 sm:px-6", narrow ? "max-w-3xl" : "max-w-6xl", className)}>{children}</div>;
}

const btnBase = "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] px-5 py-3 text-base font-semibold no-underline transition-colors duration-[var(--dur)] min-h-12 disabled:opacity-60 disabled:cursor-not-allowed";
export const btn = {
  primario: cx(btnBase, "bg-vinho text-white hover:bg-vinho-escuro hover:text-white"),
  secundario: cx(btnBase, "border border-vinho bg-papel text-vinho hover:bg-vinho-claro"),
  discreto: cx(btnBase, "text-tinta-2 hover:bg-marfim-2 hover:text-tinta"),
  perigo: cx(btnBase, "bg-perigo text-white hover:opacity-90"),
};

export function ButtonLink({ variant = "primario", className, ...p }: ComponentProps<typeof Link> & { variant?: keyof typeof btn }) {
  return <Link {...p} className={cx(btn[variant], className)} />;
}

const tones = {
  neutro: "bg-marfim-2 text-tinta-2",
  info: "bg-azul-claro text-azul",
  sucesso: "bg-verde-claro text-verde",
  alerta: "bg-alerta-claro text-alerta",
  perigo: "bg-perigo-claro text-perigo",
  vinho: "bg-vinho-claro text-vinho",
};
export function Badge({ tone = "neutro", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold", tones[tone])}>{children}</span>;
}

/** Selo para dados fictícios — só existem no ambiente de desenvolvimento. */
export function DemoBadge({ show }: { show?: boolean }) {
  if (!show) return null;
  return <Badge tone="alerta">Demonstração</Badge>;
}

export function PageHeader({ title, intro, eyebrow, children }: { title: string; intro?: ReactNode; eyebrow?: string; children?: ReactNode }) {
  return (
    <header className="border-b border-linha bg-marfim-2/60">
      <Container className="py-10 sm:py-14">
        {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-dourado-texto">{eyebrow}</p>}
        <h1 className="text-display font-semibold">{title}</h1>
        {intro && <div className="mt-3 max-w-2xl text-lg text-tinta-2">{intro}</div>}
        {children}
      </Container>
    </header>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-linha bg-papel p-8 text-center">
      <p className="font-titulo text-xl font-semibold">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-prose text-tinta-2">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Card({ children, className, as: As = "div" }: { children: ReactNode; className?: string; as?: "div" | "article" | "li" | "section" }) {
  return <As className={cx("rounded-[var(--radius-lg)] border border-linha bg-papel p-5 shadow-[var(--sombra)]", className)}>{children}</As>;
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "alerta" | "sucesso" | "perigo"; title?: string; children: ReactNode }) {
  const map = { info: "border-azul bg-azul-claro", alerta: "border-alerta bg-alerta-claro", sucesso: "border-verde bg-verde-claro", perigo: "border-perigo bg-perigo-claro" };
  return (
    <div role={tone === "perigo" ? "alert" : "status"} className={cx("rounded-[var(--radius-md)] border-l-4 p-4 text-tinta", map[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}

export const field = {
  label: "block font-semibold text-tinta",
  hint: "mt-1 text-sm text-tinta-3",
  input: "mt-1.5 block w-full rounded-[var(--radius-sm)] border border-tinta-3 bg-papel px-3 py-2.5 text-base text-tinta placeholder:text-tinta-3 min-h-12",
  error: "mt-1 text-sm font-semibold text-perigo",
};

/** Marca tipográfica provisória: NÃO é o logotipo oficial (aguardando arquivo autorizado). */
export function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg aria-hidden="true" viewBox="0 0 24 32" className={compact ? "h-7 w-5" : "h-9 w-7"}>
        <path d="M12 2c2.8 5 7 8.3 7 15a7 7 0 0 1-14 0c0-3.6 1.6-6 3.4-8 .2 2.3 1.1 3.8 2.6 4.6C10.6 9.8 10.9 6 12 2Z" fill="var(--color-vinho)" />
        <path d="M12 17c1.6 1.7 2.6 3.1 2.6 4.8a2.6 2.6 0 0 1-5.2 0c0-1.7 1-3.1 2.6-4.8Z" fill="var(--color-dourado)" />
      </svg>
      <span className="leading-tight">
        <span className="block font-titulo text-base font-bold text-tinta sm:text-lg">{INST.nomePublico}</span>
        {!compact && <span className="hidden text-xs text-tinta-3 sm:block">Renovação Carismática Católica</span>}
      </span>
    </span>
  );
}
