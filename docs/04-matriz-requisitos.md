# Matriz requisito → implementação → teste → evidência → status

Atualizada em 10/11/2026. Estados: **não iniciado**, **em andamento**, **validado**, **bloqueado**.
“Validado” aqui significa validado **em desenvolvimento local** (PostgreSQL 17 em Docker, Next.js 16.4.6, Windows 11). Nada foi validado em homologação ou produção.

## Casos de aceite obrigatórios (seção 20)

| # | Requisito | Implementação | Teste | Evidência | Status |
|---|---|---|---|---|---|
| 1 | Visitante encontra grupo por município e dia | `src/server/groups.ts`, `/grupos` | `tests/groups-authz.test.ts` “encontra grupo por município e dia” | Teste passa; navegador: `/grupos?municipio=…&dia=4` → 1 grupo | validado |
| 2 | Editor não publica doutrinal sem revisão; revisão expira após edição | `src/server/content.ts` | `tests/content.test.ts` (5 casos) | Testes passam; navegador: autor vê “você não pode aprovar o próprio texto” | validado |
| 3 | Responsável de um grupo não lê/edita outro | `src/server/authz.ts`, `groups.ts` | `groups-authz.test.ts` “autorização por escopo” | Testes passam | validado |
| 4 | Calendário: recorrência, alteração, cancelamento, API fora sem duplicar | `src/server/calendar/*` | `tests/calendar.test.ts` (13 casos, API simulada) | Testes passam | validado (lógica) · **bloqueado** (API real) |
| 5 | Adicionar evento sem e-mail; assinatura sem promessa de tempo real | `/agenda/[slug]`, `evento.ics`, `/agenda.ics` | `calendar.test.ts` “link do Google…” | Navegador e `curl` do .ics | validado |
| 6 | Duas compras da última unidade → no máximo uma | `src/server/store/checkout.ts` | `tests/store.test.ts` | Teste concorrente passa | validado (provedor simulado) |
| 7 | Inscrições simultâneas não excedem vagas | `src/server/registrations.ts` | `registrations.test.ts` (40 × 10 vagas) | Teste concorrente passa | validado |
| 8 | Webhook duplicado/atrasado não duplica efeitos | `src/server/store/payments.ts` | `store.test.ts` | Teste passa | validado (provedor simulado) |
| 9 | Retorno do navegador não aprova pagamento | `payments.ts`, `/inscricao/[token]` | `store.test.ts` | Teste passa | validado |
| 10 | Reembolso, reserva expirada, pagamento tardio | `payments.ts` | `store.test.ts` (4 casos) | Testes passam | validado (provedor simulado) |
| 11 | Intenções/participantes/pedidos fora de busca, logs e cache | `prayer.ts`, `search.ts`, `audit.ts`, `next.config.ts` | `privacy-uploads-jobs.test.ts` | Teste + `curl -I` (no-store, noindex no painel) | validado |
| 12 | MFA, recuperação, revogação, bloqueio | better-auth + `twoFactor`, `session.ts`, `src/server/users.ts`, `/admin/usuarios`, `/admin/conta` | `tests/users.test.ts` (6) + navegador: conta criada no painel → senha provisória → troca obrigatória → MFA; senha provisória antiga recusada (401) | 10/11/2026 | validado; recuperação **por e-mail** validada com SMTP local (`tests/mail.test.ts` + Mailpit); **bloqueado** em homologação/produção até haver provedor e domínio |
| 13 | Upload inválido e arquivo privado bloqueados | `src/server/uploads.ts`, `tokens.ts` | `privacy-uploads-jobs.test.ts` | Testes passam | validado: `tests/media.test.ts` (5) + navegador (envio de foto e PDF privado, link temporário, adulteração do link → 404) |
| 14 | Compra, inscrição e administração por teclado e celular | Formulários HTML nativos, `<details>` no menu | Inscrição feita no navegador; teclado/leitor de tela **não testados** | — | em andamento |
| 15 | Backup restaurado permite conciliação | `ops/backup.sh`, `ops/restore-test.sh` | Restauração local do dump em banco temporário | Contagens idênticas, ~2 s (dev, dados de demonstração) | em andamento (sem teste em produção, sem conciliação com provedor real) |

Total automatizado: **82 testes em 12 arquivos, todos passando** (`npm test`, 14/11/2026).

## Demais requisitos por seção

| Seção | Item | Status | Observação |
|---|---|---|---|
| 1 | Identidade provisória, sem usar RCCMT/RCC Brasil como dono | validado | Rodapé declara que não fala em nome delas |
| 1 | Arquidiocese (Cuiabá, definida em 10/11/2026) | validado | Nome exibido provisório “RCC Arquidiocese de Cuiabá” |
| 1 | Denominação exata, abrangência, domínio, marca | **bloqueado** | `docs/01-pendencias-bloqueantes.md` |
| 3 | Auditoria das referências | em andamento | Amostra de 7 URLs; sem Lighthouse/leitor de tela |
| 4 | Natureza do conteúdo, fontes, direitos, revisão doutrinal | validado | Selo “não equivale a aprovação eclesiástica” |
| 4 | Calendário litúrgico | não iniciado | Depende de fonte autorizada |
| 5 | Design system próprio, tokens, 2 famílias tipográficas | validado | Cor principal provisória |
| 5 | Fotografias reais autorizadas | **bloqueado** | Nenhuma foto inventada |
| 6 | Menu de 7 grupos, rodapé, estados vazios | validado | |
| 7 | Grupos: filtros, sem login, correção moderada, contato privado, desatualizados | validado | Mapa opcional carregado só após clique (OpenStreetMap) e “perto de mim” com cálculo no aparelho — `tests/map.test.ts` + navegador |
| 8 | Agenda própria (lista, mês, detalhe), estados, ICS, feed | validado | |
| 8 | Google Calendar real | **bloqueado** | Fonte de verdade decidida (portal → Google); faltam credenciais da conta institucional |
| 9 | Lotes, capacidade, espera, check-in único, QR opaco | validado | Lotes pagos dependem do provedor |
| 9 | Transferência, menores | não iniciado | Regras institucionais |
| 10 | Loja: regras de servidor (carrinho, estoque, pagamento, reembolso) | validado (simulado) | |
| 10 | Telas: vitrine (busca, categoria), produto com variantes, carrinho (cookie HttpOnly), checkout com retirada local, acompanhamento do pedido por token; painel de produtos/variantes/estoque, pedidos, etapas de entrega, reembolso, fila de exceções | validado em desenvolvimento (`tests/catalog.test.ts` + navegador com pagamento simulado) | **Desligada** em homologação/produção até titularidade |
| 10 | Frete por CEP/transportadora, produto digital | não iniciado | Depende de contrato com transportadora |
| 10 | Provedor real (Pix/cartão/boleto) | adiado por decisão | Vendas adiadas em 10/11/2026; retomar com entidade vendedora |
| 11 | Papéis, matriz, escopos, MFA, reautenticação, fluxo editorial, auditoria | validado | `docs/05-permissoes.md` |
| 11 | Tela de usuários e papéis (criar conta, senha provisória, conceder/revogar papel com escopo, desativar, encerrar sessões, zerar MFA) e “Minha conta” | validado | Anti-escalada e “último gestor” testados |
| 11 | Biblioteca de mídia (envio, texto alternativo obrigatório, autorização de imagem, variantes 640/1280, privado com link de 1 h, exclusão bloqueada em uso, imagem no texto) | validado | Armazenamento em disco; S3 não iniciado |
| 11 | Telas: menus, campanhas, redirecionamentos | não iniciado | |
| 12 | Monólito modular, fila em PostgreSQL, outbox/inbox | validado | |
| 13 | Modelo de dados e migrações | validado | `docs/06-modelo-de-dados.md` |
| 14 | Cabeçalhos, CSP com nonce, rate limit, sanitização, CSRF (Server Actions + SameSite) | validado (dev) | HSTS só em produção |
| 14 | Mapeamento ASVS 5.0.0 | em andamento | Controles listados em `docs/11-lgpd-seguranca.md`; sem verificação independente |
| 15 | SEO: sitemap, robots, canonical, JSON-LD de evento | validado | |
| 15 | Imagens responsivas da biblioteca de mídia | validado | `srcset` 640/1280/original; fotos reais ainda não recebidas |
| 16 | Peso de transferência | validado (lab) | ~290 KB gzip por página (orçamento 1,5 MB) |
| 16 | WCAG 2.2 AA — verificação automática (axe-core 4.14, ~45 rotas) + teclado + 320 px | validado (dev) | `docs/16-acessibilidade.md`; 4 achados corrigidos, revarredura sem violações |
| 16 | WCAG 2.2 AA completo (leitor de tela, usuários reais), Core Web Vitals de campo | em andamento | Sem teste com NVDA/TalkBack nem com pessoas com deficiência; sem dados de campo |
| 17 | Backup criptografado, retenção, restauração | em andamento | Homologação: backup diário + restauração de teste automáticos na VPS (sem criptografia/cópia externa, dados fictícios); produção ainda não |
| 18 | Auditoria append-only com cadeia de hash, logs JSON sem dados sensíveis | validado | |
| 18 | Alertas e-mail/Telegram | não iniciado | Worker só registra em log |
| 19 | CI | em andamento | GitHub Actions roda a cada push: tipos, lint, testes, migrações, build e auditoria de dependências passavam; o gitleaks falhava com 6 falsos positivos (valores fictícios de teste e do `.env.example`), corrigidos em 15/11/2026 — confirmar no próximo push |
| 19 | Orçamento mensal com preços consultados | não iniciado | `docs/12-custos.md` lista componentes; preços não consultados |
