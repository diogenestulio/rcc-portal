import Link from "next/link";
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
    <header className="sticky top-0 z-40 border-b border-linha bg-marfim/95 backdrop-blur supports-[backdrop-filter]:bg-marfim/85">
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      {env.APP_ENV !== "producao" && (
        <p className="bg-alerta-claro px-4 py-1 text-center text-sm font-semibold text-alerta">
          Ambiente de {env.APP_ENV === "development" ? "desenvolvimento" : "homologação"} — conteúdos marcados como “Demonstração” são fictícios.
        </p>
      )}
      <Container className="flex items-center justify-between gap-4 py-3">
        <Link href="/" className="no-underline" aria-label={`${INST.nomePublico} — página inicial`}><Wordmark /></Link>
        <nav aria-label="Principal" className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {NAV.map((n) => (
              <li key={n.href}><Link href={n.href} className="whitespace-nowrap rounded-md px-3 py-2 text-[0.95rem] font-medium text-tinta no-underline hover:bg-marfim-2">{n.label}</Link></li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1">
          <Link href="/busca" className="rounded-md p-3 text-tinta hover:bg-marfim-2" aria-label="Buscar no portal"><SearchIcon /></Link>
          {/* Menu móvel sem JavaScript: <details> é acessível por teclado e leitor de tela */}
          <details className="group relative xl:hidden">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-md px-3 font-semibold hover:bg-marfim-2 [&::-webkit-details-marker]:hidden">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
              <span className="sr-only sm:not-sr-only">Menu</span>
            </summary>
            <nav aria-label="Principal (celular)" className="absolute right-0 mt-2 w-72 rounded-[var(--radius-lg)] border border-linha bg-papel p-2 shadow-[var(--sombra)]">
              <ul>
                {NAV.map((n) => <li key={n.href}><Link href={n.href} className="block rounded-md px-4 py-3 font-medium text-tinta no-underline hover:bg-marfim-2">{n.label}</Link></li>)}
                <li className="mt-1 border-t border-linha pt-1"><Link href="/pedido-de-oracao" className="block rounded-md px-4 py-3 text-tinta no-underline hover:bg-marfim-2">Pedido de oração</Link></li>
                <li><Link href="/contato" className="block rounded-md px-4 py-3 text-tinta no-underline hover:bg-marfim-2">Contato</Link></li>
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
    <footer className="mt-20 border-t border-linha bg-tinta text-[#efe9dd]">
      <Container className="grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-titulo text-xl font-semibold text-white">{instituicaoProvisoria.nomeCompleto}</p>
          <p className="mt-2 max-w-md text-[#d9d1c3]">
            Movimento eclesial a serviço da evangelização, em comunhão com a {INST.arquidiocese ?? "Arquidiocese"}.
            {/* PENDENTE: nomenclatura do conselho/coordenação local */}
          </p>
          <p className="mt-4 text-sm text-[#cfc6b6]">Atendimento: <Link href="/contato" className="text-white">canais oficiais de contato</Link></p>
        </div>
        <nav aria-label="Institucional">
          <p className="font-semibold text-white">Institucional</p>
          <ul className="mt-3 space-y-2 text-[#e3dccf]">
            <li><Link className="text-inherit" href="/a-rcc">Quem somos</Link></li>
            <li><Link className="text-inherit" href="/privacidade">Privacidade</Link></li>
            <li><Link className="text-inherit" href="/cookies">Cookies</Link></li>
            <li><Link className="text-inherit" href="/acessibilidade">Acessibilidade</Link></li>
            <li><Link className="text-inherit" href="/termos">Termos de uso</Link></li>
            <li><a className="text-inherit" href="/agenda.ics">Assinar a agenda (iCal)</a></li>
          </ul>
        </nav>
        <nav aria-label="Vínculos oficiais">
          <p className="font-semibold text-white">Vínculos</p>
          <ul className="mt-3 space-y-2 text-[#e3dccf]">
            {instituicaoProvisoria.vinculos.map((v) => (
              <li key={v.url}>
                <a className="text-inherit" href={v.url} rel="noopener noreferrer external">{v.nome}<span className="sr-only"> (site externo)</span></a>
                <span className="block text-xs text-[#bdb4a4]">{v.relacao} — site externo</span>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
      <div className="border-t border-white/10">
        <Container className="py-5 text-sm text-[#bdb4a4]">
          © {year} {INST.nomePublico}. Este portal não fala em nome da RCC Brasil, do conselho estadual nem da {INST.arquidiocese ?? "Arquidiocese"}.
        </Container>
      </div>
    </footer>
  );
}
