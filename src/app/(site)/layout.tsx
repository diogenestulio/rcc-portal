import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="flex-1" tabIndex={-1}>{children}</main>
      <SiteFooter />
    </>
  );
}
