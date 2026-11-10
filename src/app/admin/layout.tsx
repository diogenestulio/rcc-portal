import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin, canView } from "@/server/session";
import { Wordmark } from "@/components/ui";
import { SignOut } from "./SignOut";
import type { Action } from "@/server/authz";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Painel", template: "%s · Painel RCC" }, robots: { index: false, follow: false } };

const LINKS: { href: string; label: string; any: Action[] }[] = [
  { href: "/admin", label: "Início", any: [] },
  { href: "/admin/conteudo", label: "Conteúdo", any: ["conteudo.criar", "conteudo.aprovar_doutrinal", "conteudo.aprovar_geral"] },
  { href: "/admin/grupos", label: "Grupos de Oração", any: ["grupo.editar", "grupo.moderar_correcoes"] },
  { href: "/admin/eventos", label: "Eventos e inscrições", any: ["evento.gerenciar", "evento.checkin"] },
  { href: "/admin/oracao", label: "Pedidos de oração", any: ["oracao.ler"] },
  { href: "/admin/loja", label: "Loja", any: ["loja.pedidos", "loja.produtos"] },
  { href: "/admin/auditoria", label: "Auditoria", any: ["auditoria.ler"] },
];

/** Escopos locais também liberam o menu (o servidor filtra os registros). */
const visible = (s: Awaited<ReturnType<typeof requireAdmin>>, any: Action[]) =>
  any.length === 0 || any.some((a) => canView(s, a) || s.assignments.some((x) => x.scopeType !== "global" && (a.startsWith("grupo.") || a.startsWith("evento."))));

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const s = await requireAdmin();
  return (
    <div className="flex min-h-full flex-1 flex-col bg-marfim-2/50 lg:flex-row">
      <a href="#painel" className="skip-link">Pular para o conteúdo</a>
      <aside className="border-b border-linha bg-papel lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="p-4"><Link href="/admin" className="no-underline"><Wordmark compact /></Link></div>
        <nav aria-label="Painel" className="px-2 pb-4">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {LINKS.filter((l) => visible(s, l.any)).map((l) => (
              <li key={l.href}><Link href={l.href} className="block whitespace-nowrap rounded-md px-3 py-2.5 font-medium text-tinta no-underline hover:bg-marfim-2">{l.label}</Link></li>
            ))}
          </ul>
        </nav>
        <div className="hidden border-t border-linha p-4 text-sm lg:block">
          <p className="font-semibold">{s.name}</p>
          <p className="text-tinta-3">{s.assignments.map((a) => a.role.replace("_", " ")).join(", ")}</p>
          <div className="mt-3 flex gap-3"><Link href="/" >Ver portal</Link><SignOut /></div>
        </div>
      </aside>
      <main id="painel" className="flex-1 p-4 sm:p-8" tabIndex={-1}>{children}</main>
    </div>
  );
}
