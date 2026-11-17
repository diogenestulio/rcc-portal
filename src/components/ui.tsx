import Link from "next/link";
import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";
import { instituicaoProvisoria as INST } from "@/config/instituicao";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Container({ children, className, narrow }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return <div className={cx("mx-auto w-full px-4 sm:px-6", narrow ? "max-w-3xl" : "max-w-6xl", className)}>{children}</div>;
}

const btnBase = "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] px-5 py-3 text-base font-semibold tracking-[0.01em] no-underline min-h-12 transition-[background-color,color,border-color,box-shadow] duration-[var(--dur)] ease-[var(--ease-suave)] disabled:opacity-60 disabled:cursor-not-allowed";
export const btn = {
  primario: cx(btnBase, "bg-marca text-white shadow-[inset_0_-2px_0_rgb(0_0_0/.12)] hover:bg-marca-escuro hover:text-white"),
  secundario: cx(btnBase, "border border-marca bg-papel text-marca hover:bg-marca-claro hover:text-marca-escuro"),
  discreto: cx(btnBase, "text-tinta-2 hover:bg-marfim-2 hover:text-tinta"),
  perigo: cx(btnBase, "bg-perigo text-white hover:opacity-90"),
  /** Sobre o estandarte (verde-escuro): ouro do brasão com texto verde. */
  ouro: cx(btnBase, "bg-ouro text-estandarte shadow-[inset_0_-2px_0_rgb(0_0_0/.14)] hover:bg-[#ffd94a] hover:text-estandarte"),
  /** Sobre o estandarte: contorno claro. */
  claro: cx(btnBase, "border border-ouro-suave/70 text-marfim-texto hover:border-ouro hover:bg-white/5 hover:text-white"),
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

/** Cabeçalho das páginas internas: faixa do estandarte com o título em Caslon e o filete dourado. */
export function PageHeader({ title, intro, eyebrow, children }: { title: string; intro?: ReactNode; eyebrow?: string; children?: ReactNode }) {
  return (
    <header className="estandarte sobre-estandarte">
      <Container className="pb-12 pt-10 sm:pb-16 sm:pt-14">
        {eyebrow && <p className="mb-3 font-titulo text-lg italic text-ouro-suave">{eyebrow}</p>}
        <h1 className="text-display">{title}</h1>
        {intro && <div className="mt-4 max-w-2xl text-lg text-prata">{intro}</div>}
        {children}
      </Container>
      <div aria-hidden="true" className="filete-ouro no-claro" />
    </header>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-linha bg-papel p-8 text-center">
      <p className="font-display text-2xl">{title}</p>
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

/** Brasão da RCC no selo de ouro + nome da instituição. A imagem é decorativa (alt vazio): o nome em texto é o rótulo. */
export function Wordmark({ compact, inverse }: { compact?: boolean; inverse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3.5">
      <span className={cx("selo shrink-0", compact ? "h-10 w-10" : "h-12 w-12 sm:h-14 sm:w-14")}>
        <Image src="/marca/rcc-simbolo-96.webp" alt="" width={126} height={96} priority className={compact ? "h-6 w-auto" : "h-7 w-auto sm:h-9"} />
      </span>
      <span className="leading-tight">
        <span className={cx("block font-display", compact ? "text-[1.05rem]" : "text-[1.15rem] sm:whitespace-nowrap sm:text-[1.35rem]", inverse ? "text-white" : "text-estandarte")}>{INST.nomePublico}</span>
        {!compact && <span className={cx("hidden text-[0.8rem] font-medium tracking-[0.02em] sm:block", inverse ? "text-prata" : "text-tinta-3")}>Renovação Carismática Católica</span>}
      </span>
    </span>
  );
}
