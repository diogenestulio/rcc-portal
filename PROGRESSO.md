# Progresso — atualizado em 10/11/2026

## Entrega 1 (esta sessão) — concluída em desenvolvimento local

**Funciona e foi verificado:**
- Portal público: home (8 blocos), Grupos de Oração com filtros sem login, páginas de grupo com sugestão de correção moderada, agenda (lista, mês, detalhe), “adicionar à minha agenda” (Google, .ics, assinatura), inscrição gratuita com comprovante e QR opaco, notícias, formação, páginas institucionais, ministérios, busca, pedido de oração, minutas de políticas, sitemap/robots, 404.
- Painel: login, MFA obrigatório (configurado e usado no navegador), início com pendências, conteúdo com fluxo de revisão, grupos (edição por escopo, confirmação, contato privado, moderação), eventos (criar, publicar, inscritos, check-in, exportação auditada), pedidos de oração (só intercessores), fila de exceções, auditoria com verificação de integridade.
- Servidor: 55 testes automatizados em PostgreSQL real cobrindo os casos de aceite 1–11 e 13 (concorrência de vagas e de estoque, webhooks duplicados/fora de ordem, pagamento tardio, reembolsos, recorrência com fuso, importação Google simulada, sanitização, uploads, fila durável, auditoria append-only).
- Build de produção ok; ~290 KB comprimidos por página (laboratório local).
- Backup/restauração: scripts prontos; restauração testada localmente.

**Não feito / bloqueado:** ver `docs/04-matriz-requisitos.md` (status “não iniciado” e “bloqueado”).

## Decisões institucionais recebidas (10/11/2026)
Arquidiocese de Cuiabá · homologação na VPS atual (servidor próprio ao ativar vendas) · portal é a fonte de verdade da agenda · loja e pagamentos adiados.

## Próximos passos sugeridos (ordem)
1. Pendências restantes de `docs/01-pendencias-bloqueantes.md` (denominação exata, paróquias, marca, responsáveis, domínio).
2. ~~Tela de usuários e papéis + revogação de sessões~~ (feito em 10/11/2026: criar conta com senha provisória, papéis com escopo, desativar, encerrar sessões, zerar MFA, Minha conta; 6 testes novos). E-mail transacional (habilita recuperação de senha por e-mail) continua pendente.
3. Biblioteca de mídia (upload validado já existe) com armazenamento de objetos.
4. Auditoria de acessibilidade manual (teclado + NVDA + 320 px) e Lighthouse repetível.
5. Homologação na VPS: plano e arquivos prontos e testados localmente (`docs/14-plano-homologacao.md`); no ar em https://179-197-73-172.sslip.io:10443 (com senha) desde 10/11/2026; backup diário com teste de restauração agendado. CI no repositório institucional.
6. Google Calendar real (procedimento em `docs/09-integracoes.md`).
7. Loja: telas de catálogo/carrinho/checkout após definir a entidade vendedora e o provedor.

## Decisões tomadas sem consulta (substituíveis)
Cor vinho provisória, marca tipográfica provisória, retenção de 60 dias para pedidos de oração, editor de texto simples. Detalhes em `docs/13-adrs.md`.

## Ambiente local desta sessão
- PostgreSQL em Docker: container `rcc-pg-dev`, porta 127.0.0.1:55432.
- Conta de teste local: credenciais em `.env` (`DEV_ADMIN_*`, não versionado). MFA será pedido no próximo login (banco recriado).
