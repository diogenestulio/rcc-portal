import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  // Fora de produção, nada é indexável. noindex NÃO substitui autenticação: o painel exige login.
  if (env.APP_ENV !== "producao") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/entrar", "/api/", "/inscricao/", "/pedido/", "/carrinho", "/busca"] }],
    sitemap: `${env.APP_URL}/sitemap.xml`,
  };
}
