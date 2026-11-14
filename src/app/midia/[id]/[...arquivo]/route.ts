import { db } from "@/db";
import { readForServe } from "@/server/media";

export const dynamic = "force-dynamic";

/**
 * Arquivo público: /midia/<id>/arquivo.webp ou /midia/<id>/w640/arquivo.webp (variante).
 * O id é único e o conteúdo nunca muda (edição gera outro id) → cache longo e imutável.
 * Arquivos privados respondem 404 aqui (não revelam existência).
 */
export async function GET(_req: Request, ctx: RouteContext<"/midia/[id]/[...arquivo]">) {
  const { id, arquivo } = await ctx.params;
  const w = arquivo.length === 2 && /^w\d{3,4}$/.test(arquivo[0]) ? Number(arquivo[0].slice(1)) : undefined;
  if (arquivo.length > 2) return new Response(null, { status: 404 });
  const r = await readForServe(db, id, { width: w });
  if (!r) return new Response("Arquivo não encontrado", { status: 404 });
  const pdf = r.m.mimeType === "application/pdf";
  return new Response(new Uint8Array(r.data), {
    headers: {
      "Content-Type": r.m.mimeType,
      "Content-Length": String(r.data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": pdf ? `inline; filename="documento-${r.m.id.slice(0, 8)}.pdf"` : "inline",
      // PDF aberto no navegador fica isolado (sem scripts nem acesso à origem do portal).
      ...(pdf ? { "Content-Security-Policy": "sandbox; default-src 'none'; object-src 'self'" } : {}),
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
