import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "./env";
import { enqueue } from "@/server/jobs";
import { instituicaoProvisoria as INST } from "@/config/instituicao";
import { hashedRateLimitStorage, ipFingerprint } from "@/server/ip-privacy";

/**
 * Autenticação (ADR-005): better-auth, e-mail + senha (hash da biblioteca), MFA TOTP
 * obrigatório para o painel, cadastro público DESLIGADO (contas criadas pela administração),
 * rate limit persistido no banco, cookies HttpOnly/SameSite=Lax e Secure sob HTTPS.
 */
export const auth = betterAuth({
  appName: INST.nomePublico,
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_URL],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification, twoFactor: schema.twoFactor, rateLimit: schema.rateLimit },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 30,
    sendResetPassword: async ({ user, url }) => {
      // Enviado pelo worker; o link não vai para logs.
      await enqueue(db, "email.redefinir_senha", { userId: user.id, url });
    },
  },
  session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 60, freshAge: 60 * 10 },
  rateLimit: {
    enabled: true, window: 60, max: 60,
    // Chave (IP|rota) gravada só como HMAC — o IP nunca fica em claro no banco.
    customStorage: hashedRateLimitStorage(db, env.APP_SIGNING_KEY),
    customRules: { "/sign-in/email": { window: 300, max: 5 }, "/two-factor/verify-totp": { window: 300, max: 5 }, "/request-password-reset": { window: 3600, max: 3 } },
  },
  // Sessões: o IP vira impressão digital (HMAC) antes de ir para o banco.
  databaseHooks: {
    session: {
      create: { before: async (s) => ({ data: { ...s, ipAddress: ipFingerprint(s.ipAddress, env.APP_SIGNING_KEY) } }) },
      update: { before: async (s) => ({ data: "ipAddress" in s && s.ipAddress && !String(s.ipAddress).startsWith("h:") ? { ...s, ipAddress: ipFingerprint(String(s.ipAddress), env.APP_SIGNING_KEY) } : s }) },
    },
  },
  advanced: { useSecureCookies: env.APP_URL.startsWith("https://"), cookiePrefix: "rcc" },
  plugins: [twoFactor({ issuer: INST.nomePublico }), nextCookies()],
});
