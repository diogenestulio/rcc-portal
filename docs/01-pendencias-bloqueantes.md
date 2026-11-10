# Informações institucionais

Só estão aqui as perguntas que **bloqueiam uma decisão**. Os valores atuais podem ser trocados em `src/config/instituicao.ts` e na tabela `institution`.

## Decidido em 10/11/2026 (resposta do responsável pelo projeto)

| Tema | Decisão | Efeito no projeto |
|---|---|---|
| Arquidiocese | **Arquidiocese de Cuiabá** | Nome exibido: “RCC Arquidiocese de Cuiabá” (provisório até confirmar a denominação pública exata); fuso America/Cuiaba mantido |
| Hospedagem | **Homologação na VPS atual; servidor próprio quando ativar loja/inscrições pagas** | Plano de deploy em `docs/07-operacao.md` |
| Agenda | **O portal é a fonte de verdade** (CMS → Google) | `GOOGLE_CALENDAR_MODE=cms_to_google` quando houver credenciais; até lá `off` e o portal publica o feed `.ics` |
| Loja e pagamentos | **Vendas adiadas** | Lançamento sem loja e sem inscrições pagas; `STORE_ENABLED=false`, `PAYMENTS_PROVIDER=off` |

## Ainda pendente

**1. Identidade e abrangência**
- Denominação pública exata da RCC local e nome do órgão (conselho arquidiocesano, coordenação…). Há setores, foranias ou regiões a exibir?
- Lista oficial de municípios e paróquias que pertencem à Arquidiocese de Cuiabá (ou quem fornece). Não presumir que todo município da região pertence a ela.
- Domínio desejado e quem é o titular do registro.

**2. Identidade visual**
- Logotipo autorizado (vetor) e cor principal oficial; manual de marca, se houver.
- Fotografias da comunidade com autorização de imagem.
- Autorização para mostrar as marcas da Arquidiocese, da RCCMT e da RCC Brasil no rodapé.

**3. Responsáveis**
- Gestor institucional (aprova conteúdo e permissões).
- Revisor editorial/doutrinal designado.
- Administrador técnico e um substituto.
- Encarregado de dados (LGPD) e quem valida as políticas juridicamente.

**4. Agenda Google** (só quando for ativar)
- Conta Google institucional que terá a agenda pública e quem a administra.

**5. Loja** (só quando for retomada)
- Entidade vendedora (CNPJ), conta recebedora, provedor, operação de pedidos/expedição e políticas de troca e reembolso.
- Inscrições de menores: termo e campos definidos pela instituição.

## Valores ainda provisórios

| Tema | Valor atual | Onde mudar |
|---|---|---|
| Cor principal | Vinho `#7A2335` (não oficial) | `src/app/globals.css` |
| Marca | Chama tipográfica (não é o logotipo) | `Wordmark` em `src/components/ui.tsx` |
| Dízimo | Não implementado | — |
