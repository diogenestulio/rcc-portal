import Link from "next/link";
import Image from "next/image";
import { Container, Wordmark } from "@/components/ui";
import { env } from "@/lib/env";
import { instituicaoProvisoria } from "@/config/instituicao";
import { instituicaoProvisoria as INST } from "@/config/instituicao";

export const NAV = [
  { href: "/a-rcc", label: "A RCC" },
  { href: "/grupos", label: "Grupos de Oração" },
  { href: "/formacao", label: "Ministérios e Formação" },
  { href: "/agenda", label: "Agenda" },
  { href: "/noticias", label: "Notícias" },
  { href: "/multimidia", label: "Multimídia" },
  { href: "/loja", label: "Loja" },
];

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
}

export function SiteHeader() {
  return (
    <header className="estandarte sobre-estandarte sticky top-0 z-40 border-b border-white/10">
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <div aria-hidden="true" className="faixa-marca" />
      {env.APP_ENV !== "producao" && (
        <p className="bg-alerta-claro px-4 py-1 text-center text-sm font-semibold text-alerta">
          Ambiente de {env.APP_ENV === "development" ? "desenvolvimento" : "homologação"}: conteúdos marcados como “Demonstração” são fictícios.
        </p>
      )}
      <Container className="flex items-center justify-between gap-4 py-3.5">
        <Link href="/" className="no-underline"><Wordmark inverse /><span className="sr-only">, página inicial</span></Link>
        <nav aria-label="Principal" className="hidden xl:block">
          <ul className="flex items-center gap-0.5">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="relative block whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-2 text-[0.95rem] font-medium !text-marfim-texto no-underline after:absolute after:inset-x-3 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-ouro after:transition-transform after:duration-[var(--dur)] hover:!text-white hover:after:scale-x-100">{n.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1">
          <Link href="/busca" className="rounded-[var(--radius-sm)] p-3 !text-marfim-texto hover:bg-white/10 hover:!text-white" aria-label="Buscar no portal"><SearchIcon /></Link>
          {/* Menu móvel sem JavaScript: <details> é acessível por teclado e leitor de tela */}
          <details className="group relative xl:hidden">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-[var(--radius-sm)] px-3 font-semibold text-marfim-texto transition-colors hover:bg-white/10 hover:text-white group-open:bg-white/10 [&::-webkit-details-marker]:hidden">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
              <span className="sr-only sm:not-sr-only">Menu</span>
            </summary>
            <nav aria-label="Principal (celular)" className="menu-painel absolute right-0 mt-3 w-72 overflow-hidden rounded-[var(--radius-lg)] border border-linha bg-papel p-2 shadow-[var(--sombra-alta)]">
              <ul>
                {NAV.map((n) => <li key={n.href}><Link href={n.href} className="block rounded-[var(--radius-sm)] px-4 py-3 font-medium !text-tinta no-underline hover:bg-marca-claro hover:!text-marca-escuro">{n.label}</Link></li>)}
                <li className="mt-1 border-t border-linha pt-1"><Link href="/pedido-de-oracao" className="block rounded-[var(--radius-sm)] px-4 py-3 !text-tinta no-underline hover:bg-marca-claro">Pedido de oração</Link></li>
                <li><Link href="/contato" className="block rounded-[var(--radius-sm)] px-4 py-3 !text-tinta no-underline hover:bg-marca-claro">Contato</Link></li>
              </ul>
            </nav>
          </details>
        </div>
      </Container>
    </header>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="estandarte sobre-estandarte mt-24">
      <div aria-hidden="true" className="filete-ouro" />
      <Container className="grid gap-12 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-4">
            <span className="selo h-16 w-16 shrink-0"><Image src="/marca/rcc-simbolo-96.webp" alt="" width={126} height={96} className="h-10 w-auto" /></span>
            <p className="font-display text-2xl leading-snug text-white">{instituicaoProvisoria.nomeCompleto}</p>
          </div>
          <p className="mt-5 max-w-md text-marfim-texto">
            Movimento eclesial a serviço da evangelização, em comunhão com a {INST.arquidiocese ?? "Arquidiocese"}.
            {/* PENDENTE: nomenclatura do conselho/coordenação local */}
          </p>
          <p className="mt-4 text-sm text-prata">Atendimento: <Link href="/contato">canais oficiais de contato</Link></p>
        </div>
        <nav aria-label="Institucional">
          <p className="font-titulo text-lg italic text-ouro-suave">Institucional</p>
          <ul className="mt-4 space-y-2.5 [&_a]:!text-marfim-texto [&_a]:no-underline [&_a:hover]:!text-ouro [&_a:hover]:underline">
            <li><Link href="/a-rcc">Quem somos</Link></li>
            <li><Link href="/privacidade">Privacidade</Link></li>
            <li><Link href="/cookies">Cookies</Link></li>
            <li><Link href="/acessibilidade">Acessibilidade</Link></li>
            <li><Link href="/termos">Termos de uso</Link></li>
            <li><a href="/agenda.ics">Assinar a agenda (iCal)</a></li>
          </ul>
        </nav>
        <nav aria-label="Vínculos oficiais">
          <p className="font-titulo text-lg italic text-ouro-suave">Vínculos</p>
          <ul className="mt-4 space-y-3 [&_a]:!text-marfim-texto [&_a]:no-underline [&_a:hover]:!text-ouro [&_a:hover]:underline">
            {instituicaoProvisoria.vinculos.map((v) => (
              <li key={v.url}>
                <a href={v.url} rel="noopener noreferrer external">{v.nome}<span className="sr-only"> (site externo)</span></a>
                <span className="block text-sm text-prata">{v.relacao}, site externo</span>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
      <div className="bg-noite">
        <Container className="py-5 text-sm text-prata">
          © {year} {INST.nomePublico}. Este portal não fala em nome da RCC Brasil, do conselho estadual nem da {INST.arquidiocese ?? "Arquidiocese"}.
        </Container>
      </div>
    </footer>
  );
}
