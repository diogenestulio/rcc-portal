import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { env } from "@/lib/env";
import { instituicaoProvisoria as INST } from "@/config/instituicao";

// next/font baixa as fontes no build e as serve do próprio domínio (sem requisição ao Google
// no navegador). Ambas sob SIL Open Font License.
const serif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });
const sans = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  title: { default: INST.nomePublico, template: `%s · ${INST.nomePublico}` },
  description: `${INST.nomeCompleto} — Grupos de Oração, formação, agenda e notícias.`,
  openGraph: { type: "website", locale: "pt_BR", siteName: INST.nomePublico },
  robots: env.APP_ENV === "producao" ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#007437", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${serif.variable} ${sans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
