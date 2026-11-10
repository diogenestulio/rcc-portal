/**
 * Contrato do provedor de pagamento. O portal NUNCA captura dados de cartão: usa checkout
 * hospedado do provedor. O webhook é só um SINAL — o estado é sempre reconsultado na API
 * do provedor (`fetchPayment`) antes de aplicar qualquer efeito.
 *
 * Provedor real: BLOQUEADO até definição da entidade vendedora (docs/01-pendencias-bloqueantes.md).
 * `SimulatedProvider` existe só para desenvolvimento/testes e é recusado fora de APP_ENV=development.
 */
import { sql } from "drizzle-orm";
import type { DB } from "@/db";
import { hmacHex, opaqueToken, safeEqual } from "../tokens";

export type ProviderPaymentState = {
  providerPaymentId: string; orderRef: string; status: "pendente" | "aprovado" | "recusado" | "estornado" | "estornado_parcial" | "chargeback" | "expirado";
  amountCents: number; currency: string; refundedCents: number; receiverId: string; stateAt: Date; method?: string;
};
export type WebhookSignal = { eventId: string; providerPaymentId: string };

export interface PaymentProvider {
  name: string;
  createCheckout(o: { orderRef: string; amountCents: number; description: string; returnUrl: string; expiresAt: Date }): Promise<{ providerPaymentId: string; checkoutUrl: string }>;
  fetchPayment(providerPaymentId: string): Promise<ProviderPaymentState>;
  refund(providerPaymentId: string, amountCents: number, idempotencyKey: string): Promise<{ providerRefundId: string }>;
  /** Autentica o webhook conforme a documentação do provedor (assinatura + janela anti-replay). */
  verifyWebhook(headers: Headers, rawBody: string, now?: Date): WebhookSignal;
}

export class WebhookAuthError extends Error {}

/** Simulador persistente (tabela integration_state), com assinatura HMAC e anti-replay de 5 min. */
export class SimulatedProvider implements PaymentProvider {
  name = "simulado";
  constructor(private db: DB, private secret: string, public receiverId = "recebedor-dev") {}

  private async save(s: ProviderPaymentState) {
    await this.db.execute(sql`insert into integration_state (key, value) values (${"sim:" + s.providerPaymentId}, ${JSON.stringify(s)}::jsonb)
      on conflict (key) do update set value = excluded.value, updated_at = now()`);
  }
  async createCheckout(o: { orderRef: string; amountCents: number }) {
    const id = `sim_${opaqueToken(9)}`;
    await this.save({ providerPaymentId: id, orderRef: o.orderRef, status: "pendente", amountCents: o.amountCents, currency: "BRL", refundedCents: 0, receiverId: this.receiverId, stateAt: new Date() });
    return { providerPaymentId: id, checkoutUrl: `/dev/checkout-simulado/${id}` };
  }
  async fetchPayment(id: string): Promise<ProviderPaymentState> {
    const [row] = await this.db.execute<{ value: ProviderPaymentState }>(sql`select value from integration_state where key = ${"sim:" + id}`);
    if (!row) throw new Error("pagamento desconhecido no provedor");
    return { ...row.value, stateAt: new Date(row.value.stateAt) };
  }
  /** Usado pelos testes e pela página de checkout simulado para mudar o estado "no provedor". */
  async setState(id: string, patch: Partial<ProviderPaymentState>) {
    const cur = await this.fetchPayment(id);
    await this.save({ ...cur, ...patch, stateAt: patch.stateAt ?? new Date() });
  }
  async refund(id: string, amountCents: number) {
    const cur = await this.fetchPayment(id);
    const refunded = Math.min(cur.amountCents, cur.refundedCents + amountCents);
    await this.save({ ...cur, refundedCents: refunded, status: refunded >= cur.amountCents ? "estornado" : "estornado_parcial", stateAt: new Date() });
    return { providerRefundId: `simr_${opaqueToken(6)}` };
  }
  sign(body: string, ts: number) { return hmacHex(this.secret, `${ts}.${body}`); }
  verifyWebhook(headers: Headers, rawBody: string, now = new Date()): WebhookSignal {
    const ts = Number(headers.get("x-sim-timestamp"));
    const sig = headers.get("x-sim-signature") ?? "";
    if (!Number.isFinite(ts) || Math.abs(now.getTime() / 1000 - ts) > 300) throw new WebhookAuthError("timestamp fora da janela");
    if (!safeEqual(this.sign(rawBody, ts), sig)) throw new WebhookAuthError("assinatura inválida");
    const body = JSON.parse(rawBody) as { id?: string; payment_id?: string };
    if (!body.id || !body.payment_id) throw new WebhookAuthError("corpo inválido");
    return { eventId: body.id, providerPaymentId: body.payment_id };
  }
}
