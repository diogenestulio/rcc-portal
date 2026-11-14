import { z } from "zod";

const schema = z.object({
  APP_ENV: z.enum(["development", "homologacao", "producao"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET precisa de 32+ caracteres"),
  APP_SIGNING_KEY: z.string().min(32),
  INSTITUTION_TIMEZONE: z.string().default("America/Cuiaba"),
  GOOGLE_CALENDAR_MODE: z.enum(["off", "cms_to_google", "google_to_cms"]).default("off"),
  GOOGLE_CALENDAR_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON_PATH: z.string().optional(),
  STORE_ENABLED: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  PAYMENTS_PROVIDER: z.enum(["off", "simulado"]).default("off"),
  /** Retirada no local: só se a operação oferecer (texto com endereço e horários). */
  STORE_PICKUP_ENABLED: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  STORE_PICKUP_INFO: z.string().max(300).default(""),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default("RCC Arquidiocese de Cuiabá <nao-responda@exemplo.invalid>"),
  ALERT_EMAIL: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
}).superRefine((v, ctx) => {
  // O provedor simulado nunca pode rodar fora do desenvolvimento.
  if (v.PAYMENTS_PROVIDER === "simulado" && v.APP_ENV !== "development") {
    ctx.addIssue({ code: "custom", message: "PAYMENTS_PROVIDER=simulado só é permitido em APP_ENV=development" });
  }
});

export const env = schema.parse(process.env);
export const isDev = env.APP_ENV === "development";
