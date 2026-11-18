# Decisões de arquitetura (ADRs)

## ADR-001 — Monólito modular em Next.js + PostgreSQL
**Decisão:** um único app Next.js 16.4.6 (App Router, TypeScript) com módulos de domínio em `src/server/*`, PostgreSQL 17 e um worker separado (`scripts/worker.mts`). Sem microserviços nem Redis.
**Motivo:** equipe voluntária pequena, tráfego modesto, um único lugar para auditar. Revisar se houver necessidade medida.

## ADR-002 — Renderização por requisição e Cache Components desligado
**Decisão:** `cacheComponents: false`; páginas com dados usam `dynamic = "force-dynamic"`; publicação chama `revalidatePath`.
**Motivo:** a CSP com nonce exige renderização dinâmica (documentação do Next 16), e evita qualquer risco de dados privados em cache compartilhado. **Custo:** sem cache de HTML na CDN. Medido: ~10 KB de HTML comprimido por página. Se a carga exigir, cachear só páginas públicas sem nonce (CSP por hash) — decisão futura com medição.

## ADR-003 — Uma fonte de verdade por agenda; sem sincronização bidirecional
**Confirmado pela instituição em 10/11/2026: o portal é a fonte de verdade.**
**Decisão:** padrão `cms_to_google` (o CMS manda; o Google recebe projeção via job `gcal.projetar`, com ID estável `rcc<uuid>`). Alternativa `google_to_cms`: importação incremental (syncToken, paginação, 410 → ressincronização completa) como **candidato**, com campos bloqueados no CMS. Cancelamentos marcam, nunca apagam. Notificações push do Google **não** foram implementadas na v1: a reconciliação a cada 15 min cumpre a meta proposta de 15 min.

## ADR-004 — Fusos e datas
Instantes em `timestamptz` (UTC). Dia inteiro em `date`. Recorrência expandida sobre o horário de parede no fuso IANA do evento (`src/server/calendar/recurrence.ts`), testado com fuso com horário de verão. ICS usa UTC para eventos simples e `TZID` + `VTIMEZONE` mínimo para séries; o VTIMEZONE embutido só cobre fusos de deslocamento fixo (America/Cuiaba). Outro fuso com horário de verão exigiria regras completas.

## ADR-005 — Autenticação com better-auth 1.7.20
E-mail + senha (cadastro público desligado), MFA TOTP obrigatório para o painel (`requireAdmin`), códigos de recuperação, rate limit persistido no PostgreSQL, sessão de 12 h, reautenticação ≤ 10 min para ações sensíveis (`SENSITIVE` em `authz.ts`). Contas criadas por `scripts/create-admin.mts`.

## ADR-006 — CSP
`script-src 'self' 'nonce-…' 'strict-dynamic'`, `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`. **Exceção documentada:** `style-src 'unsafe-inline'`, porque o framework injeta estilos inline (observado no navegador). Risco aceito: injeção de CSS é bem menos grave que de script, e todo HTML do CMS é sanitizado sem atributos `style`.

## ADR-007 — Fila durável em PostgreSQL (outbox) e inbox de webhooks
Tabela `job` com `FOR UPDATE SKIP LOCKED`, backoff exponencial com teto de 1 h, estado `morto` após o limite, deduplicação por `dedupe_key`. Webhooks entram em `webhook_inbox` com chave única (provedor, id do evento); o estado é sempre reconsultado no provedor. Nenhum trabalho confiável roda “solto” após uma resposta HTTP.

## ADR-008 — Pagamentos: checkout hospedado, provedor ainda não escolhido
Contrato `PaymentProvider` (`src/server/store/providers.ts`). O portal nunca recebe dados de cartão. Provedor real bloqueado até definir a entidade vendedora; o `SimulatedProvider` é recusado fora de `APP_ENV=development` (validação em `src/lib/env.ts`).

## ADR-009 — Editor de texto simples
Volunteers escrevem num formato leve (parágrafos, `##`, `>`, listas, negrito/itálico, links https), convertido no servidor e sanitizado por lista de permissões. Evita editores pesados e colagem de HTML perigoso. Revisitar se a equipe pedir editor visual.

## ADR-010 — Identidade visual a partir do brasão da RCC (14/11/2026)
**Decisão do coordenador:** a cor do portal deriva do brasão da RCC (verde #007437, amarelo #FFCB04, petróleo #004159, prata #B8D0DC), em harmonia com RCC Brasil e RCCMT. Substitui a cor vinho provisória. O amarelo só aparece como decoração ou sobre fundo escuro (contraste 1,5:1 no claro). Brasão como imagem decorativa (`alt=""`) ao lado do nome em texto. **Pendente:** autorização formal de uso da marca e versão vetorial oficial. Detalhes em `docs/10-design-system.md`.

## ADR-011 — Layout "Verde majestoso" (16/11/2026)
**Decisão do coordenador** (escolhida entre três direções: Cenáculo, Luz clara e Verde majestoso): o verde-escuro do brasão vira **estandarte** no cabeçalho, nas aberturas de página e no rodapé, com **ouro e prata** como metais (filete dourado com losango, selo do brasão com aro de ouro, botão de destaque em ouro). O conteúdo continua claro.
- **Tipografia:** Libre Caslon (Display e Text), a letra de missais e Bíblias impressas, nos títulos; Albert Sans no texto.
- **Movimento:** um único momento ao carregar, o medalhão do brasão na página inicial. Os cartões não "pulam" mais no hover; mudam só a borda e a sombra.
- **Sem rótulos em caixa alta:** os rótulos de seção passam a usar itálico Caslon.
- **Verificação:** contrastes AA e Lighthouse com acessibilidade 100 nas páginas verificadas. Detalhes em `docs/10-design-system.md`.

## ADR-012 — Página inicial mais rica e brasão livre (16/11/2026)
**Decisão do coordenador:** o layout do ADR-011 ficou simples demais. A paleta "Verde majestoso" foi mantida e o brasão saiu do círculo: agora é o **brasão livre**, com contorno claro fino (gerado a partir do PNG em `public/marca/rcc-livre*.webp`) e brilho dourado.
- **Abertura:** raios dourados de Pentecostes, textura "semeada" de pequenos losangos e **buscador de grupos** (município e dia) sobreposto ao filete.
- **"Por onde começar":** blocos para explorar o site, com ícones próprios (chama, calendário, livro, pomba e mãos). O bloco maior é Grupos de Oração, com contagens reais.
- **Agenda:** o próximo encontro em destaque, com a data grande em ouro.
- **Faixa da Palavra:** At 2,4.
- **Notícias:** em cartões.
- **Ministérios:** em selos que ficam verdes ao passar o mouse.
- **Pedido de oração:** em painel próprio.
- **Verificação:** Lighthouse com acessibilidade 100 no celular e no computador, sem rolagem lateral em 390 px.
- **Pendente:** a imagem do brasão é ampliada a partir de um PNG de 283 px. A versão vetorial oficial deixará a abertura nítida em telas de alta resolução.

## ADR-013 — Marca conforme o Manual de Identidade Visual da RCC (16/11/2026)
O coordenador enviou o manual oficial (PDF). O símbolo, que estava em vetor no próprio PDF, foi extraído para SVG (`public/marca/rcc-simbolo.svg`) e substitui as imagens ampliadas: fica nítido em qualquer tela.
- **Cores e fonte:** cores alinhadas às do manual (#006036, #004058, #FDC800, #B8D0DC e os gradientes oficiais). Lato, a fonte principal do manual, entra na assinatura e no texto; Caslon fica só nos títulos editoriais.
- **Assinatura:** "Renovação Carismática Católica" + "Arquidiocese de Cuiabá", conforme as páginas 23 e 24 do manual.
- **Cabeçalho:** reorganizado em duas faixas (assinatura e ações; menu), porque o nome oficial é mais longo.
- **Fundo verde:** sobre o verde, o símbolo leva um contorno claro finíssimo para cumprir a proibição de "fundo da mesma cor".

## ADR-014 — Marca sem montagem, A RCC abre Quem Somos e menu com Sede (18/11/2026)
- **Marca:** o revisor apontou que "símbolo + texto HTML" equivale a improvisar o logotipo e que o símbolo ampliado sobre grafismos fere o manual (p. 5–11, 21–22). Até chegar a assinatura oficial da instância, o site usa identificação textual e capa tipográfica (`docs/10`).
- **A RCC:** `/a-rcc` mostra direto a página fixa **Quem Somos**, ligada por chave estável (`content_item.chave = 'quem-somos'`, migração 0005), independente de título e endereço. O link antigo `/a-rcc/<endereço>` redireciona com 308 e a URL canônica é `/a-rcc`. No painel, a ligação fica em **Conteúdo → A RCC → Quem Somos** (permissão `conteudo.estrutura`, só o gestor).
- **Menu:** a mesma lista no computador e no celular: A RCC, Sede, Grupos de Oração, Formação, Notícias, Agenda, Multimídia. "Sede" substitui o rótulo "Igreja e Renovação" e **mantém a rota** `/igreja-e-renovacao`, para que os links já divulgados continuem valendo. A loja fica fora do menu e do rodapé enquanto estiver fechada.
