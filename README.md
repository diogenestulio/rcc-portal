# Portal RCC Arquidiocesana

Portal da Renovação Carismática Católica da Arquidiocese (nome definitivo pendente): Grupos de Oração, agenda com inscrições, formação, notícias, pedidos de oração, painel editorial com revisão doutrinal, e a base da loja.

**Estado:** desenvolvimento. Nada foi publicado. Veja `PROGRESSO.md` e `docs/04-matriz-requisitos.md`.

## Pilha
Next.js 16.4.6 (App Router, TypeScript 5.9) · React 19.3 · Tailwind CSS 4.3 · PostgreSQL 17 · Drizzle ORM 0.45 + postgres.js 3.4 · better-auth 1.7.20 (MFA TOTP) · Vitest 5. Versões fixadas no `package.json` + `package-lock.json`.

## Rodar
Ver `docs/07-operacao.md` › Desenvolvimento local. Resumo:

```bash
npm ci && npm run db:migrate && npm run db:seed && npm run dev
```

## Comandos
| Comando | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run worker` | fila durável e rotinas (expirar reservas, publicar agendados, conciliar, agenda Google, expurgo) |
| `npm test` | 55 testes contra PostgreSQL real (cria e destrói `rcc_test`) |
| `npm run typecheck` / `lint` | verificação estática |
| `npm run db:generate` / `db:migrate` / `db:seed` | migrações e dados de demonstração |
| `npm run docs:permissoes` | regenera a matriz de permissões a partir do código |
| `npx tsx scripts/create-admin.mts …` | cria conta da equipe (cadastro público é desligado) |
| `npx tsx scripts/verify-audit.mts` | verifica a cadeia de integridade da auditoria |

## Estrutura
```
src/app/(site)      páginas públicas          src/server/       regras de negócio (testadas)
src/app/admin       painel (login + MFA)      src/server/calendar  agenda, ICS, Google
src/app/entrar      login e MFA               src/server/store     carrinho, estoque, pagamentos
src/db/schema.ts    modelo de dados           drizzle/          migrações
tests/              testes                    ops/              backup e teste de restauração
docs/               documentação              scripts/          worker, seed, utilitários
```

## Documentação
1. `docs/01-pendencias-bloqueantes.md` — o que a instituição precisa responder
2. `docs/02-auditoria-referencias.md` — auditoria dos sites de referência
3. `docs/03-mapa-do-portal.md` — navegação e páginas
4. `docs/04-matriz-requisitos.md` — requisito → teste → evidência → status
5. `docs/05-permissoes.md` — matriz de permissões (gerada)
6. `docs/06-modelo-de-dados.md` — diagrama, dicionário, retenção
7. `docs/07-operacao.md` — deploy, rollback, backup, restauração, logs
8. `docs/08-runbooks.md` — incidentes
9. `docs/09-integracoes.md` — Google, pagamentos, e-mail (procedimentos para ativar)
10. `docs/10-design-system.md` · `docs/11-lgpd-seguranca.md` · `docs/12-custos.md` · `docs/13-adrs.md`
11. `docs/manual-administrador.md` — manual para voluntários
12. `docs/14-plano-homologacao.md` — homologação na VPS (`deploy/homologacao/`)
13. `docs/15-incidente-2026-11-10.md` — incidente de nome de serviço na rede compartilhada
