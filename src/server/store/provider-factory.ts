import "server-only";
import { db } from "@/db";
import { env } from "@/lib/env";
import { SimulatedProvider, type PaymentProvider } from "./providers";

/** Provedor ativo. `null` = pagamentos desligados (padrão até a definição institucional). */
export function getProvider(): PaymentProvider | null {
  if (env.PAYMENTS_PROVIDER === "simulado" && env.APP_ENV === "development") return new SimulatedProvider(db, env.APP_SIGNING_KEY);
  return null;
}

/** Recebedor esperado — conferido em todo pagamento. Configurar junto com o provedor real. */
export function expectedReceiver() {
  return env.PAYMENTS_PROVIDER === "simulado" ? "recebedor-dev" : (process.env.PAYMENT_RECEIVER_ID ?? "__nao_configurado__");
}
