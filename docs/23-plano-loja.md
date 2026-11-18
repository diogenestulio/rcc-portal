# Plano da Loja RCC Arquidiocese de Cuiabá (18/11/2026)

**Situação:** vendas e inscrições pagas continuam **desligadas** (`STORE_ENABLED=false`, `PAYMENTS_PROVIDER=off`).
- `/loja` mostra "em preparação"; produtos, carrinho e checkout ficam fora do ar; a loja está fora do menu.
- **Ativação comercial só depois do aceite da entidade responsável.**
- Nada aqui supõe tarifa, contrato, conta recebedora ou data assumida pela RCC.

**Classificação:** **E** = existente e validado (testes automatizados, provedor simulado); **P** = parcial; **A** = ausente; **D** = depende de decisão.

## Inventário do que já existe (inspeção de `src/server/store`, painel, banco e testes)

| Requisito | Classe | Onde / evidência |
|---|---|---|
| Catálogo com produtos, categorias, variantes (SKU por tamanho/cor), preço em **centavos** e publicação só com variante ativa | E | `catalog.ts`, `tests/catalog.test.ts` |
| Estoque com reserva, baixa, ajuste com motivo e histórico | E | `catalog.ts`, tabela `stock_movement` |
| **Duas compras simultâneas da última unidade → no máximo uma** | E | `tests/store.test.ts` (teste concorrente) |
| Carrinho em cookie HttpOnly e preço **recalculado no servidor** e gravado no pedido | E | `checkout.ts`, `store.test.ts` |
| Reserva com expiração; pagamento tardio sem estoque vai para "em resolução" | E | `payments.ts`, `store.test.ts` |
| Checkout **hospedado** (o portal nunca vê o cartão), contrato `PaymentProvider` | E (simulador) / **A** (provedor real) | `providers.ts` |
| Webhook com assinatura, anti-replay, inbox única e **reconsulta ao provedor** | E (simulador) | `store.test.ts` |
| Retorno do navegador **não** aprova o pedido | E | `store.test.ts` |
| Reembolso parcial e total (não repõe estoque sozinho) e conciliação (`reconcile`) | E (simulador) | `payments.ts` |
| Retirada local com etapas de entrega (separando, retirado, entregue) | E | `catalog.ts`, painel `/admin/loja` |
| Acompanhamento do pedido por token e e-mail "Pagamento confirmado" | P (o e-mail depende do SMTP institucional) | `/pedido/[token]`, `mail-jobs.ts` |
| Papel `operador_loja`, auditoria de cada ação, exceções com decisão escrita | E | `authz.ts`, `catalog.test.ts` |
| Inscrições pagas separadas dos produtos (mesmo provedor) | P (lógica pronta: "confirma só com pagamento validado") | `store.test.ts` |
| Fotos de produto (biblioteca com autorização de imagem) | P (falta foto real) | `/admin/midia` |
| Frete por CEP, peso, dimensões e origem | **A** ("frete indisponível nunca vira frete grátis" está testado) | `checkout.ts` |
| Relatórios (vendas por período, por produto, estoque baixo) | **A** | — |
| Documento fiscal | **D/A** (depende da natureza jurídica da entidade) | — |
| Políticas (trocas, devolução, privacidade da loja, atendimento) | **D** | — |

## Etapas

Estimativas em **dias de trabalho de 1 desenvolvedor** da UP. Não incluem o tempo de decisão da entidade.

### Etapa 1: operação da loja (decisões)

- **Requisitos e decisões:**
  - entidade vendedora (CNPJ) e **conta recebedora**;
  - gestores e operadores;
  - catálogo inicial e política de preços;
  - documentos fiscais exigidos para a natureza jurídica;
  - privacidade, trocas, devolução e atendimento;
  - retirada (local, dias e responsável) e, se houver, entrega e expedição.
- **Entregáveis:** documento de regras assinado; páginas `/termos` e trocas e devolução com o texto aprovado.
- **Dependências:** entidade e contabilidade.
- **Responsável sugerido:** Entidade + Coord.; UP redige a minuta técnica.
- **Esforço:** 2 dias (UP).
- **Custos:** único, eventual consulta contábil ou jurídica (a cotar); recorrente, nenhum.
- **Riscos:** venda sem nota quando ela for exigida; responsabilidade pela expedição indefinida.
- **Aceite:** a entidade aprova regras, papéis e operação inicial.

### Etapa 2: catálogo e estoque

- **Requisitos:**
  - camisetas e apostilas com fotos autorizadas;
  - SKU por tamanho e cor, preço em centavos;
  - disponibilidade, reserva e expiração (já existem).
- **Entregáveis:**
  - catálogo real cadastrado;
  - relatório de **estoque baixo**;
  - categoria "Apostilas".
  - Se houver **produto digital** (PDF pago), entrega por link temporário: a biblioteca privada já gera links de 1 h.
- **Dependências:** etapa 1, fotos e preços.
- **Responsável:** operador da loja (cadastro) + UP.
- **Esforço:** 3 dias.
- **Custos:** nenhum.
- **Riscos:** fotos sem autorização; estoque inicial divergente do físico.
- **Aceite:** **duas compras simultâneas da última unidade geram no máximo uma venda atendida** (já automatizado; repetir no sandbox).

### Etapa 3: checkout e pagamentos

**Provedores comparados.** As tarifas são as das páginas públicas consultadas em 18/11/2026 e mudam por contrato e volume: **confirmar a proposta comercial em nome da entidade.**

| Provedor | Checkout hospedado | Pix | Cartão | Boleto | Observação |
|---|---|---|---|---|---|
| **Mercado Pago (Checkout Pro)** | sim | 0,99% por venda (página oficial) | 3,98% a 4,98% conforme o prazo de recebimento (página oficial) | 3,99% (página de link de pagamento) | ambiente de testes com usuários de teste; webhooks com assinatura |
| **Asaas** | fatura hospedada / link | R$ 1,99 por transação (tabela padrão; promoções temporárias) | 2,99% + R$ 0,49 à vista (padrão) | R$ 1,99 (padrão) | sandbox separado; não há condição pública para entidade sem fins lucrativos |
| **PagBank** | sim | não confirmado em fonte oficial | não confirmado em fonte oficial | — | as fontes de terceiros divergem |

- **Recomendação para homologação:** **Mercado Pago Checkout Pro.** Ele tem checkout hospedado com Pix, cartão e boleto num só fluxo, sandbox com usuários de teste e notificações assinadas, e é o que menos código pede, dado o contrato `PaymentProvider` que já existe. O **Asaas** fica como alternativa se o custo fixo por Pix for melhor para o ticket médio. A escolha final é da entidade, com as duas propostas na mão.
- **Entregáveis:**
  - adaptador `MercadoPagoProvider` (`createCheckout`, `fetchPayment`, `refund`, `verifyWebhook`);
  - variável `PAYMENTS_PROVIDER=mercadopago`;
  - credenciais no `.env` do servidor;
  - **conta recebedora protegida** (já existe o fluxo com reautenticação e auditoria);
  - conciliação agendada no worker.
- **Dependências:** etapa 1 (conta da entidade no provedor).
- **Responsável:** UP; a entidade cria a conta.
- **Esforço:** 6 dias (adaptador, 2 dias; webhooks e conciliação, 2 dias; testes no sandbox, 2 dias).
- **Custos:** únicos, nenhum. Recorrentes, apenas as **tarifas por venda** do contrato.
- **Riscos:**
  - mudança de API do provedor;
  - chargeback;
  - webhook fora do ar: mitigado pela conciliação.
- **Aceite:** compra no sandbox tratando corretamente confirmação repetida, falha, expiração, pagamento tardio e reembolso; o retorno do navegador **não** aprova o pedido. Os casos já existem nos testes com simulador e devem ser repetidos no sandbox.

### Etapa 4: entrega e pós-venda

- **MVP:** só **retirada local**: já existe, falta a regra aprovada.
- **Evolução, se aprovada:** cotação por **CEP, peso, dimensões e origem**:
  - Correios por contrato, ou um agregador (ex.: Melhor Envio);
  - **a cotar**, sem tarifa suposta.
- **Entregáveis:**
  - peso e dimensões por variante;
  - cotação no checkout, com o **total e o frete recalculados no servidor antes da cobrança**;
  - etiqueta e rastreio no painel;
  - e-mails de pedido enviado e entregue;
  - fluxo de devolução.
- **Dependências:** contrato de frete e SMTP.
- **Responsável:** UP + operador.
- **Esforço:** MVP, 1 dia; evolução, 6 dias.
- **Custos:** recorrente, frete por envio (repassado ou não, decisão da entidade).
- **Riscos:** endereço incorreto; extravio; frete subestimado.
- **Aceite:** total e frete recalculados antes da cobrança; o operador acompanha e resolve um pedido sem duplicar estoque nem reembolso.

### Etapa 5: painel, implantação e suporte

- **Entregáveis:**
  - relatórios de vendas, por produto e por período, e exportação CSV com neutralização de fórmulas (já existe nas inscrições);
  - **backup com recuperação pontual (RPO 15 min, WAL)**: exigência registrada em `docs/07` antes de vender;
  - **servidor próprio para o portal** quando a loja ligar (decisão de 10/11/2026);
  - ensaio de restauração e conciliação depois de uma falha;
  - separação contábil entre produtos e inscrições (mesmo provedor, referências distintas).
- **Dependências:** etapas 1 a 4.
- **Responsável:** UP.
- **Esforço:** 5 dias.
- **Custos:**
  - recorrentes: servidor dedicado e armazenamento externo para o WAL (a cotar);
  - únicos: migração (incluída no esforço).
- **Riscos:** perda de pedidos sem WAL; VPS compartilhada sobrecarregada.
- **Aceite:** compra de teste completa, do catálogo ao estorno, com evidência no painel, no provedor e no estoque. Ativação comercial só depois do aceite.

## Ordem de execução

1. **MVP (retirada local):** etapa 1 → etapa 2 → etapa 3 → etapa 4 (só retirada) → etapa 5. Soma **cerca de 17 dias** de trabalho da UP, mais o tempo de decisão da entidade.
2. **Evolução (entrega):** etapa 4 completa, com mais 6 dias, depois do contrato de frete.
3. **Inscrições pagas:** podem entrar junto com o MVP, porque usam o mesmo adaptador: mais 2 dias para testar lotes pagos no sandbox.

## Premissas da estimativa

- Uma pessoa da UP dedicada; decisões da entidade entregues completas.
- Provedor com checkout hospedado (sem armazenar cartão) e documentação pública estável.
- Catálogo inicial pequeno (até cerca de 30 produtos).
- Não inclui: emissão fiscal integrada (se exigida, nova estimativa), aplicativo, marketplace, domínio, SMTP (já previsto à parte).
