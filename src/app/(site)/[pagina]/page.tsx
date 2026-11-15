import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, EmptyState, Notice, PageHeader } from "@/components/ui";
import { RETENTION_DAYS } from "@/server/prayer";
import { instituicaoProvisoria as INST } from "@/config/instituicao";

/**
 * Páginas utilitárias e MINUTAS de políticas. Os textos jurídicos são rascunhos técnicos e
 * DEVEM ser validados pelo encarregado/jurídico antes da produção (docs/11-lgpd.md).
 */
const PAGES: Record<string, { title: string; intro?: string; body: React.ReactNode; draft?: boolean }> = {
  multimidia: {
    title: "Multimídia",
    intro: "Transmissões, vídeos, fotos e materiais para download.",
    body: <EmptyState title="Acervo em organização">Os vídeos e materiais serão publicados aqui com tipo, tamanho e descrição. Transmissões só carregam quando você clicar.</EmptyState>,
  },
  contato: {
    title: "Contato",
    intro: `Canais oficiais de atendimento da ${INST.nomePublico}.`,
    body: <Notice tone="alerta" title="Contatos oficiais pendentes">Os canais de atendimento serão publicados após confirmação da coordenação. Nenhum contato foi presumido.</Notice>,
  },
  colaborar: {
    title: "Colaborar",
    body: <EmptyState title="Em definição">As formas de colaboração com a {INST.nomePublico} dependem de definição institucional. O dízimo paroquial é entregue na sua paróquia.</EmptyState>,
  },
  privacidade: {
    title: "Política de privacidade", draft: true,
    body: (
      <div className="prosa">
        <p>Este portal coleta somente os dados necessários para cada finalidade:</p>
        <ul>
          <li><strong>Inscrições em eventos:</strong> nome, e-mail e, opcionalmente, telefone — para organizar o evento e enviar a confirmação. Não usamos para divulgação sem sua escolha.</li>
          <li><strong>Pedidos de oração:</strong> a intenção e, opcionalmente, primeiro nome e contato. Lidos somente pela equipe de intercessão autorizada; não são publicados, não entram em busca nem em estatísticas, e são apagados após {RETENTION_DAYS} dias.</li>
          <li><strong>Sugestões de correção de grupos:</strong> a mensagem e, opcionalmente, e-mail para retorno.</li>
          <li><strong>Compras (quando ativadas):</strong> dados do pedido; os dados de cartão são informados diretamente ao provedor de pagamento, nunca a este portal.</li>
        </ul>
        <p>Dados de participação religiosa podem ser considerados dados sensíveis pela LGPD. Por isso aplicamos acesso restrito, registro de auditoria e prazos de exclusão.</p>
        <p>Não usamos cookies de publicidade. Vídeos e mapas de terceiros só são carregados quando você clica.</p>
        <p><strong>Encarregado de dados:</strong> [pendente de designação].</p>
      </div>
    ),
  },
  cookies: {
    title: "Cookies", draft: true,
    body: <div className="prosa"><p>Usamos apenas cookies essenciais: sessão da equipe administrativa e carrinho (quando a loja estiver ativa). Não há cookies de publicidade nem de análise nesta versão. Se um serviço de estatística for adotado, ele só será ativado após sua escolha, que poderá ser revista a qualquer momento.</p></div>,
  },
  acessibilidade: {
    title: "Acessibilidade",
    body: <div className="prosa"><p>Nosso objetivo é atender às diretrizes WCAG 2.2 nível AA. O portal funciona por teclado, tem atalho “Pular para o conteúdo”, mostra onde está o foco, respeita a preferência por menos animações, não usa carrossel automático, oferece a agenda em formato de lista e se adapta a telas pequenas (até 320 pixels de largura) sem rolagem lateral. O mapa dos grupos é opcional: a lista tem as mesmas informações.</p><p>Última revisão: novembro de 2026, com verificação automática (axe-core) de todas as páginas e testes manuais de teclado e de tela pequena. Ainda não houve teste com leitores de tela por pessoas que os usam no dia a dia.</p><p>Esta é uma meta em verificação contínua, não uma declaração de conformidade. Encontrou uma barreira? Escreva para a coordenação pelos canais de <Link href="/contato">contato</Link>.</p></div>,
  },
  termos: {
    title: "Termos de uso", draft: true,
    body: <div className="prosa"><p>Os conteúdos de formação indicam sua natureza (doutrina, orientação pastoral, devoção ou testemunho) e suas fontes. A revisão interna não constitui aprovação eclesiástica formal. O uso de textos e imagens segue os direitos indicados em cada conteúdo.</p></div>,
  },
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[pagina]">): Promise<Metadata> {
  const p = PAGES[(await params).pagina];
  return p ? { title: p.title } : {};
}

export default async function UtilPage({ params }: PageProps<"/[pagina]">) {
  const p = PAGES[(await params).pagina];
  if (!p) notFound();
  return (
    <>
      <PageHeader title={p.title} intro={p.intro} />
      <Container narrow className="py-10">
        {p.draft && <div className="mb-6"><Notice tone="alerta" title="Minuta">Texto provisório, pendente de validação institucional e jurídica.</Notice></div>}
        {p.body}
      </Container>
    </>
  );
}
