/** Ícones de traço próprios do portal (decorativos: sempre acompanhados de texto). */
type P = { className?: string };
const base = { viewBox: "0 0 48 48", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

/** Chama de Pentecostes — Grupos de Oração. */
export function IconeChama({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M24 5c2 6 9 10 9 19a9 9 0 0 1-18 0c0-4 2-7 4-9 0 4 2 6 4 6-1-6 1-12 1-16Z" />
      <path d="M24 43c-3 0-5-2-5-5 0-3 3-5 5-8 2 3 5 5 5 8 0 3-2 5-5 5Z" />
    </svg>
  );
}

/** Calendário — Agenda. */
export function IconeCalendario({ className }: P) {
  return (
    <svg {...base} className={className}>
      <rect x="7" y="10" width="34" height="31" rx="3" />
      <path d="M7 19h34M16 6v8M32 6v8" />
      <path d="M17 27h4M27 27h4M17 34h4" />
    </svg>
  );
}

/** Livro aberto — Formação. */
export function IconeLivro({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M24 13c-4-3-10-4-17-3v26c7-1 13 0 17 3 4-3 10-4 17-3V10c-7-1-13 0-17 3Z" />
      <path d="M24 13v26" />
      <path d="M12 17c3 0 6 .5 8 1.5M12 23c3 0 6 .5 8 1.5M28 18.5c2-1 5-1.5 8-1.5M28 24.5c2-1 5-1.5 8-1.5" />
    </svg>
  );
}

/** Pomba — Ministérios (dons do Espírito). */
export function IconePomba({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M6 22c6-1 10 1 13 4l5-12c2-4 7-6 11-4l6 2-6 3c1 6-2 12-8 15-5 3-12 3-17 0l4-3c-4-1-6-3-8-5Z" />
      <path d="M33 13h.01" />
    </svg>
  );
}

/** Mãos em oração — Pedido de oração. */
export function IconeMaos({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M22 8c-2 1-3 3-3 5v12l-6 7v8h9l2-4" />
      <path d="M26 8c2 1 3 3 3 5v12l6 7v8h-9l-2-4" />
      <path d="M22 8c1 2 1 18 2 28M26 8c-1 2-1 18-2 28" />
    </svg>
  );
}
