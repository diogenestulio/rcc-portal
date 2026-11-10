"use server";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { event, payment, ticketBatch } from "@/db/schema";
import { register, RegistrationError } from "@/server/registrations";
import { checkRate, RateLimitError } from "@/server/ratelimit";
import { getProvider } from "@/server/store/provider-factory";
import { env } from "@/lib/env";

export async function inscrever(fd: FormData) {
  const slug = String(fd.get("slug") ?? "").slice(0, 120);
  const back = (code: string) => redirect(`/agenda/${encodeURIComponent(slug)}/inscricao?erro=${code}`);
  let token: string;
  let checkoutUrl: string | null = null;
  try {
    await checkRate("inscricao", 10, 600);
    const [ev] = await db.select({ id: event.id }).from(event).where(and(eq(event.slug, slug), eq(event.publication, "publicado")));
    if (!ev) return back("fechada");
    const batchId = (fd.get("lote") as string) || null;
    if (batchId) {
      const [b] = await db.select().from(ticketBatch).where(and(eq(ticketBatch.id, batchId), eq(ticketBatch.eventId, ev.id)));
      if (b && b.priceCents > 0 && !getProvider()) return back("pagamento");
    }
    const r = await register(db, {
      eventId: ev.id, batchId, fullName: String(fd.get("nome") ?? ""), email: String(fd.get("email") ?? ""),
      phone: String(fd.get("telefone") ?? "") || null, idempotencyKey: String(fd.get("chave") ?? "").slice(0, 64) || crypto.randomUUID(),
    });
    token = r.publicToken;
    if (r.status === "reservada" && r.orderId) {
      const provider = getProvider()!;
      const [existing] = await db.select().from(payment).where(eq(payment.orderId, r.orderId));
      if (!existing) {
        const co = await provider.createCheckout({ orderRef: r.orderId, amountCents: r.priceCents, description: "Inscrição", returnUrl: `${env.APP_URL}/inscricao/${token}`, expiresAt: r.holdExpiresAt! });
        await db.insert(payment).values({ orderId: r.orderId, provider: provider.name, providerPaymentId: co.providerPaymentId, amountCents: r.priceCents });
        checkoutUrl = co.checkoutUrl;
      }
    }
  } catch (e) {
    if (e instanceof RateLimitError) return back("limite");
    if (e instanceof RegistrationError) return back(e.code);
    throw e;
  }
  redirect(checkoutUrl ?? `/inscricao/${token}`);
}
