/**
 * Busca pública (PostgreSQL). Fontes SOMENTE de conteúdo publicado: revisões publicadas,
 * grupos publicados e eventos publicados. Rascunhos, pedidos de oração, participantes,
 * pedidos da loja e intenções nunca fazem parte destas consultas.
 */
import { sql } from "drizzle-orm";
import type { DB } from "@/db";

export type SearchHit = { type: "conteudo" | "grupo" | "evento"; kind: string; slug: string; title: string; snippet: string | null };

export async function searchPublic(db: DB, q: string, limit = 30): Promise<SearchHit[]> {
  const term = q.trim().slice(0, 100);
  if (term.length < 2) return [];
  const like = "%" + term.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
  const rows = await db.execute<SearchHit & { rank: number }>(sql`
    with q as (select websearch_to_tsquery('portuguese', f_unaccent(${term})) as tsq)
    select 'conteudo' as type, ci.kind::text as kind, ci.slug, r.title, r.summary as snippet,
           ts_rank(to_tsvector('portuguese', f_unaccent(coalesce(r.search_text, r.title))), q.tsq) as rank
      from content_item ci join content_revision r on r.id = ci.published_revision_id, q
     where ci.status <> 'arquivado'
       and (to_tsvector('portuguese', f_unaccent(coalesce(r.search_text, r.title))) @@ q.tsq or f_unaccent(r.title) ilike f_unaccent(${like}))
    union all
    select 'grupo', 'grupo', g.slug, g.name, g.venue, 0.5
      from prayer_group g join parish p on p.id = g.parish_id join municipality m on m.id = g.municipality_id
     where g.published and g.status <> 'encerrado' and f_unaccent(g.name || ' ' || p.name || ' ' || m.name) ilike f_unaccent(${like})
    union all
    select 'evento', 'evento', e.slug, e.title, e.summary, 0.4
      from event e
     where e.publication = 'publicado' and f_unaccent(e.title || ' ' || coalesce(e.summary, '')) ilike f_unaccent(${like})
    order by rank desc limit ${Math.min(limit, 50)}`);
  return rows.map((r) => ({ type: r.type, kind: r.kind, slug: r.slug, title: r.title, snippet: r.snippet }));
}
