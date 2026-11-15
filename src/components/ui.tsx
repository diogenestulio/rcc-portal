import Link from "next/link";
import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";
import { instituicaoProvisoria as INST } from "@/config/instituicao";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Container({ children, className, narrow }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return <div className={cx("mx-auto w-full px-4 sm:px-6", narrow ? "max-w-3xl" : "max-w-6xl", className)}>{children}</div>;
}

const btnBase = "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] px-5 py-3 text-base font-semibold no-underline min-h-12 transition-[background-color,color,border-color,box-shadow,transform] duration-[var(--dur)] ease-[var(--ease-suave)] active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none";
export const btn = {
  primario: cx(btnBase, "bg-marca text-white shadow-[0_1px_2px_rgb(0_69_31/.25)] hover:bg-marca-escuro hover:text-white hover:shadow-[0_6px_16px_rgb(0_90_43/.28)] hover:-translate-y-px"),
  secundario: cx(btnBase, "border border-marca bg-papel text-marca hover:bg-marca-claro hover:text-marca-escuro hover:-translate-y-px"),
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
  marca: "bg-marca-claro text-marca",
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
    <header className="border-b border-linha bg-[radial-gradient(ellipse_at_top_right,var(--color-sol-claro),transparent_55%),linear-gradient(180deg,var(--color-marca-claro),var(--color-marfim))]">
      <Container className="py-10 sm:py-14">
        {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-sol-texto">{eyebrow}</p>}
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

export function Card({ children, className, as: As = "div", hover }: { children: ReactNode; className?: string; as?: "div" | "article" | "li" | "section"; hover?: boolean }) {
  return <As className={cx("rounded-[var(--radius-lg)] border border-linha bg-papel p-5 shadow-[var(--sombra)]", hover && "elevar", className)}>{children}</As>;
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

/** Brasão da RCC + nome da instituição. A imagem é decorativa (alt vazio): o nome em texto é o rótulo. */
export function Wordmark({ compact, inverse }: { compact?: boolean; inverse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      <Image src="/marca/rcc-simbolo-192.webp" alt="" width={253} height={192} priority className={compact ? "h-9 w-auto" : "h-11 w-auto sm:h-12"} />
      <span className="leading-tight">
        <span className={cx("block font-titulo text-base font-bold sm:text-lg", inverse ? "text-white" : "text-marca-escuro")}>{INST.nomePublico}</span>
        {!compact && <span className={cx("hidden text-xs font-medium tracking-wide sm:block", inverse ? "text-prata" : "text-tinta-3")}>Renovação Carismática Católica</span>}
      </span>
    </span>
  );
}
