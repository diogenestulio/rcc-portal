import type { NextConfig } from "next";

// ADR-002: Cache Components desligado nesta versão; páginas com dados são renderizadas por
// requisição (necessário para CSP com nonce). Cabeçalhos de cache definidos por rota.
const nextConfig: NextConfig = {
  cacheComponents: false,
  output: "standalone", // imagem Docker enxuta (deploy/homologacao)
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["sharp"],
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=(), usb=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ];
    // HSTS só em produção e só depois de validar todos os subdomínios (docs/07-operacao.md).
    if (process.env.ENABLE_HSTS === "true") common.push({ key: "Strict-Transport-Security", value: "max-age=31536000" });
    const privateNoStore = [{ key: "Cache-Control", value: "private, no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/:path*", headers: common },
      { source: "/admin/:path*", headers: privateNoStore },
      { source: "/admin", headers: privateNoStore },
      { source: "/entrar/:path*", headers: privateNoStore },
      { source: "/entrar", headers: privateNoStore },
      { source: "/carrinho", headers: privateNoStore },
      { source: "/pedido/:path*", headers: privateNoStore },
      { source: "/inscricao/:path*", headers: privateNoStore },
      { source: "/pedido-de-oracao", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      // Link temporário de arquivo privado: não vaza pela origem (Referer) nem fica em cache.
      { source: "/midia/privado/:path*", headers: [...privateNoStore, { key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
  turbopack: {
    rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } },
  },
};

export default nextConfig;
