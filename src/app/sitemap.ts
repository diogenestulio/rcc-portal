import type { MetadataRoute } from "next";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Somente conteúdo publicado. Rascunhos, comprovantes, pedidos e painel nunca entram. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.APP_URL;
  const fixed = ["", "/grupos", "/agenda", "/noticias", "/formacao", "/a-rcc", "/ministerios", "/multimidia", "/pedido-de-oracao", "/privacidade", "/acessibilidade"].map((p) => ({ url: `${base}${p}` }));
  const [content, groups, events] = await Promise.all([
    db.execute<{ kind: string; slug: string; updated_at: Date }>(sql`select kind::text, slug, updated_at from content_item where published_revision_id is not null and status <> 'arquivado' and not is_demo`),
    db.execute<{ slug: string; updated_at: Date }>(sql`select slug, updated_at from prayer_group where published and not is_demo`),
    db.execute<{ slug: string; updated_at: Date }>(sql`select slug, updated_at from event where publication = 'publicado' and not is_demo`),
  ]);
  const KIND: Record<string, string> = { noticia: "/noticias", formacao: "/formacao", pagina: "/a-rcc", comunicado: "/noticias" };
  return [
    ...fixed,
    ...content.map((c) => ({ url: `${base}${KIND[c.kind]}/${c.slug}`, lastModified: new Date(c.updated_at) })),
    ...groups.map((g) => ({ url: `${base}/grupos/${g.slug}`, lastModified: new Date(g.updated_at) })),
    ...events.map((e) => ({ url: `${base}/agenda/${e.slug}`, lastModified: new Date(e.updated_at) })),
  ];
}
