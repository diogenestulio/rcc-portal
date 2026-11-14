import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/** Carrinho: só um token opaco em cookie HttpOnly (nada em localStorage, nenhum dado pessoal). */
export const CART_COOKIE = "rcc_carrinho";

export async function readCartToken() {
  const v = (await cookies()).get(CART_COOKIE)?.value;
  return v && /^[A-Za-z0-9_-]{20,64}$/.test(v) ? v : null;
}

export async function writeCartToken(token: string) {
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: env.APP_URL.startsWith("https://"), path: "/", maxAge: 60 * 60 * 24 * 30,
  });
}
