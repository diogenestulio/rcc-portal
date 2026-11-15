import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireAdmin, canView } from "@/server/session";
import { staleGroups } from "@/server/groups";
import { syncLag } from "@/server/calendar/google";
import { Card, Notice } from "@/components/ui";
import { env } from "@/lib/env";

export const metadata = { title: "Início" };

export default async function AdminHome() {
  const s = await requireAdmin();
  const [[c], stale, [ex], [jobs], lag] = await Promise.all([
    db.execute<{ revisao: number; rascunho: number; correcoes: number }>(sql`select
      (select count(*) from content_item where status = 'em_revisao')::int as revisao,
      (select count(*) from content_item where status = 'rascunho')::int as rascunho,
      (select count(*) from group_correction where status = 'pendente')::int as correcoes`),
    staleGroups(db),
    db.execute<{ n: number }>(sql`select count(*)::int as n from exception_case where not resolved`),
    db.execute<{ mortos: number; atrasados: number }>(sql`select count(*) filter (where status='morto')::int as mortos,
      count(*) filter (where status='pendente' and run_at < now() - interval '15 minutes')::int as atrasados from job`),
    syncLag(db),
  ]);
  const tiles = [
    { show: canView(s, "conteudo.aprovar_doutrinal") || canView(s, "conteudo.aprovar_geral"), n: c.revisao, label: "conteúdos aguardando revisão", href: "/admin/conteudo?status=em_revisao" },
    { show: canView(s, "conteudo.criar"), n: c.rascunho, label: "rascunhos", href: "/admin/conteudo?status=rascunho" },
    { show: canView(s, "grupo.moderar_correcoes"), n: c.correcoes, label: "sugestões de correção de grupos", href: "/admin/grupos#correcoes" },
    { show: canView(s, "grupo.editar"), n: stale.length, label: "grupos sem confirmação há 180+ dias", href: "/admin/grupos?desatualizados=1" },
    { show: canView(s, "loja.pedidos") || canView(s, "evento.gerenciar"), n: ex.n, label: "exceções de pagamento/inscrição a resolver", href: "/admin/loja" },
  ].filter((t) => t.show);

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-semibold">Olá, {s.name.split(" ")[0]}</h1>
      <p className="mt-1 text-tinta-2">Resumo do que precisa da sua atenção.</p>
      {(jobs.mortos > 0 || jobs.atrasados > 0) && canView(s, "integracoes.gerenciar") && (
        <div className="mt-6"><Notice tone="alerta" title="Fila de tarefas">{jobs.atrasados} tarefa(s) atrasada(s) e {jobs.mortos} com falha definitiva. Ver docs/08-runbooks.md.</Notice></div>
      )}
      {env.GOOGLE_CALENDAR_MODE !== "off" && lag.stale && (
        <div className="mt-4"><Notice tone="alerta" title="Agenda Google">Sincronização atrasada ({lag.lagMinutes ?? "nunca"} min). O site mantém o último conteúdo válido.</Notice></div>
      )}
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Card as="li" key={t.label}>
            <Link href={t.href} className="block no-underline">
              <span className="block font-titulo text-4xl font-semibold text-marca">{t.n}</span>
              <span className="text-tinta">{t.label}</span>
            </Link>
          </Card>
        ))}
      </ul>
    </div>
  );
}
