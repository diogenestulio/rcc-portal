import type { Metadata, Viewport } from "next";
import { Lato, Libre_Caslon_Display, Libre_Caslon_Text } from "next/font/google";
import "./globals.css";
import { env } from "@/lib/env";
import { instituicaoProvisoria as INST } from "@/config/instituicao";

// next/font baixa as fontes no build e as serve do próprio domínio (sem requisição ao Google
// no navegador). Todas sob SIL Open Font License. Lato é a fonte principal do Manual de Identidade Visual da RCC
// (assinatura e texto); Caslon é a fonte editorial dos títulos grandes. Ver docs/10-design-system.md.
const display = Libre_Caslon_Display({ variable: "--font-caslon-display", subsets: ["latin"], weight: "400", display: "swap" });
const serif = Libre_Caslon_Text({ variable: "--font-caslon-text", subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], display: "swap" });
const sans = Lato({ variable: "--font-lato", subsets: ["latin"], weight: ["400", "700", "900"], style: ["normal", "italic"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  title: { default: INST.nomePublico, template: `%s · ${INST.nomePublico}` },
  description: `${INST.nomeCompleto} — Grupos de Oração, formação, agenda e notícias.`,
  openGraph: { type: "website", locale: "pt_BR", siteName: INST.nomePublico },
  robots: env.APP_ENV === "producao" ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0a3a22", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${serif.variable} ${sans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
