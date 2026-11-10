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
| 12 | MFA, recuperação, revogação, bloqueio | better-auth + `twoFactor`, `session.ts` | Manual no navegador (login → MFA obrigatório → painel) | Fluxo executado em 10/11/2026 | **em andamento**: MFA validado; recuperação de senha depende de SMTP; revogação de sessão sem tela |
| 13 | Upload inválido e arquivo privado bloqueados | `src/server/uploads.ts`, `tokens.ts` | `privacy-uploads-jobs.test.ts` | Testes passam | validado (lógica) · tela de upload **não iniciada** |
| 14 | Compra, inscrição e administração por teclado e celular | Formulários HTML nativos, `<details>` no menu | Inscrição feita no navegador; teclado/leitor de tela **não testados** | — | em andamento |
| 15 | Backup restaurado permite conciliação | `ops/backup.sh`, `ops/restore-test.sh` | Restauração local do dump em banco temporário | Contagens idênticas, ~2 s (dev, dados de demonstração) | em andamento (sem teste em produção, sem conciliação com provedor real) |

Total automatizado: **55 testes em 6 arquivos, todos passando** (`npm test`, 10/11/2026).

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
| 7 | Grupos: filtros, sem login, correção moderada, contato privado, desatualizados | validado | Mapa opcional: link OSM; “perto de mim” não iniciado |
| 8 | Agenda própria (lista, mês, detalhe), estados, ICS, feed | validado | |
| 8 | Google Calendar real | **bloqueado** | Fonte de verdade decidida (portal → Google); faltam credenciais da conta institucional |
| 9 | Lotes, capacidade, espera, check-in único, QR opaco | validado | Lotes pagos dependem do provedor |
| 9 | Transferência, menores | não iniciado | Regras institucionais |
| 10 | Loja: regras de servidor (carrinho, estoque, pagamento, reembolso) | validado (simulado) | |
| 10 | Catálogo público, carrinho e checkout (telas), frete, produto digital | não iniciado | Loja desligada até titularidade |
| 10 | Provedor real (Pix/cartão/boleto) | adiado por decisão | Vendas adiadas em 10/11/2026; retomar com entidade vendedora |
| 11 | Papéis, matriz, escopos, MFA, reautenticação, fluxo editorial, auditoria | validado | `docs/05-permissoes.md` |
| 11 | Telas: usuários/papéis, mídia, menus, campanhas, redirecionamentos | não iniciado | Papéis via `scripts/create-admin.mts` |
| 12 | Monólito modular, fila em PostgreSQL, outbox/inbox | validado | |
| 13 | Modelo de dados e migrações | validado | `docs/06-modelo-de-dados.md` |
| 14 | Cabeçalhos, CSP com nonce, rate limit, sanitização, CSRF (Server Actions + SameSite) | validado (dev) | HSTS só em produção |
| 14 | Mapeamento ASVS 5.0.0 | em andamento | Controles listados em `docs/11-lgpd-seguranca.md`; sem verificação independente |
| 15 | SEO: sitemap, robots, canonical, JSON-LD de evento | validado | |
| 15 | Imagens responsivas da biblioteca de mídia | não iniciado | Sem fotos ainda |
| 16 | Peso de transferência | validado (lab) | ~290 KB gzip por página (orçamento 1,5 MB) |
| 16 | WCAG 2.2 AA completo, Core Web Vitals de campo | em andamento | Sem auditoria manual completa; sem dados de campo |
| 17 | Backup criptografado, retenção, restauração | em andamento | Homologação: backup diário + restauração de teste automáticos na VPS (sem criptografia/cópia externa, dados fictícios); produção ainda não |
| 18 | Auditoria append-only com cadeia de hash, logs JSON sem dados sensíveis | validado | |
| 18 | Alertas e-mail/Telegram | não iniciado | Worker só registra em log |
| 19 | CI | em andamento | `.github/workflows/ci.yml` escrito, nunca executado |
| 19 | Orçamento mensal com preços consultados | não iniciado | `docs/12-custos.md` lista componentes; preços não consultados |
