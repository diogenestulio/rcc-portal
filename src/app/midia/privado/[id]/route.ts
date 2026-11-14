import { db } from "@/db";
import { env } from "@/lib/env";
import { readForServe } from "@/server/media";

export const dynamic = "force-dynamic";

/** Arquivo privado: só com link temporário assinado (gerado no painel, auditado). Nunca em cache compartilhado. */
export async function GET(req: Request, ctx: RouteContext<"/midia/privado/[id]">) {
  const { id } = await ctx.params;
  const u = new URL(req.url);
  const exp = Number(u.searchParams.get("exp"));
  const sig = u.searchParams.get("sig") ?? "";
  const r = await readForServe(db, id, { signed: { exp, sig, key: env.APP_SIGNING_KEY } });
  const priv = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };
  if (!r) return new Response("Link inválido ou expirado. Peça um novo link a quem compartilhou.", { status: 404, headers: priv });
  const pdf = r.m.mimeType === "application/pdf";
  return new Response(new Uint8Array(r.data), {
    headers: {
      ...priv,
      "Content-Type": r.m.mimeType,
      "Content-Length": String(r.data.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": pdf ? `inline; filename="documento-${r.m.id.slice(0, 8)}.pdf"` : "inline",
      ...(pdf ? { "Content-Security-Policy": "sandbox; default-src 'none'; object-src 'self'" } : {}),
    },
  });
}
