import { NextRequest, NextResponse } from "next/server";

/** CSP com nonce por requisição (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md). */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Estilos inline são injetados pelo framework (React/Next). Permitidos apenas para ESTILO
    // (risco bem menor que script); scripts seguem com nonce + strict-dynamic. Ver ADR-006.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    // Vídeos só carregam após clique do visitante (youtube-nocookie).
    "frame-src https://www.youtube-nocookie.com",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
  const correlationId = request.headers.get("x-correlation-id")?.slice(0, 64) || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-correlation-id", correlationId);
  requestHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("x-correlation-id", correlationId);
  return res;
}

export const config = {
  matcher: [{
    source: "/((?!_next/static|_next/image|favicon.ico|fonts/|midia/).*)",
    missing: [{ type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }],
  }],
};
