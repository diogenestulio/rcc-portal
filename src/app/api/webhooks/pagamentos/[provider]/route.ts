import { db } from "@/db";
import { handleWebhook } from "@/server/store/payments";
import { WebhookAuthError } from "@/server/store/providers";
import { expectedReceiver, getProvider } from "@/server/store/provider-factory";

export const dynamic = "force-dynamic";
const MAX_BODY = 64 * 1024;

/** Webhook de pagamento: autenticado, deduplicado, e sempre reconsultado no provedor. */
export async function POST(req: Request, ctx: RouteContext<"/api/webhooks/pagamentos/[provider]">) {
  const { provider: name } = await ctx.params;
  const provider = getProvider();
  if (!provider || provider.name !== name) return new Response(null, { status: 404 });
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY) return new Response(null, { status: 413 });
  const raw = await req.text();
  if (raw.length > MAX_BODY) return new Response(null, { status: 413 });
  try {
    const r = await handleWebhook(db, provider, req.headers, raw, expectedReceiver());
    return Response.json({ ok: true, duplicado: r.duplicate });
  } catch (e) {
    if (e instanceof WebhookAuthError) return new Response(null, { status: 401 });
    console.error(JSON.stringify({ nivel: "erro", evento: "webhook.falha", provedor: name, correlationId: req.headers.get("x-correlation-id") }));
    return new Response(null, { status: 500 });
  }
}
