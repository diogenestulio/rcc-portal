# Operação: execução, deploy, rollback, backup e restauração

## Desenvolvimento local

```bash
docker run -d --name rcc-pg-dev -e POSTGRES_PASSWORD=dev_only_pw -e POSTGRES_DB=rcc_dev -p 127.0.0.1:55432:5432 postgres:17-alpine
cp .env.example .env    # gere BETTER_AUTH_SECRET e APP_SIGNING_KEY com: openssl rand -base64 32
npm ci
npm run db:migrate
npm run db:seed         # só APP_ENV=development; dados marcados "Demonstração"
ADMIN_PASSWORD='uma-senha-longa' npx tsx scripts/create-admin.mts voce@exemplo "Seu Nome" gestor_institucional,editor
npm run dev             # http://localhost:3000 — painel em /entrar (MFA obrigatório)
npm run worker          # em outro terminal: fila e rotinas
npm test                # cria/destroi o banco rcc_test
```

## Homologação e produção (proposta — não executada)

- **Ambientes separados**: bancos, segredos e domínios distintos; homologação protegida por login e sem dados reais.
- **Processos**: `next start` (app) e `npm run worker` (worker), cada um com reinício automático (systemd ou container). Pelo menos 1 worker; mais de um é seguro (SKIP LOCKED).
- **Conexões**: `DB_POOL_MAX` app 10 + worker 4. PostgreSQL sem porta pública.
- **Proxy reverso** (nginx/Caddy) com TLS; `ENABLE_HSTS=true` só depois de conferir todos os subdomínios.
- **Ordem do deploy**: backup → `npm ci` → `npm run db:migrate` → `npm run build` → reiniciar app → reiniciar worker → `GET /api/health`.
- **Migrações compatíveis**: só alterações aditivas no mesmo deploy (adicionar coluna/tabela). Remoções em deploy posterior, depois que o código antigo saiu. **Reverter o código não reverte os dados.**
- **Rollback**: voltar a versão anterior do app (mantendo o banco). Se uma migração precisar ser desfeita, restaurar backup em banco paralelo e reconciliar (ver abaixo) — nunca `drop` às cegas.

### Hospedagem (decidido em 10/11/2026)
Homologação na VPS atual (1 vCPU / 3,9 GB, compartilhada com outros sistemas), atrás do nginx existente, com banco e serviços próprios e sem porta pública. Servidor dedicado ao portal quando a loja ou as inscrições pagas forem ativadas. Antes de subir: conferir memória livre e definir limites de memória para os processos do portal, para não afetar os outros sistemas.

## Backup

**Homologação (em uso):** `deploy/homologacao/backup.sh` na VPS (diário, com teste de restauração, 7 dias) + **cópia externa criptografada** puxada pelo PC (hoje) / NAS da UP (futuro), com conferência e restauração no destino, retenção de 30 diários + 12 mensais e alerta após 50 h sem cópia: ver `18-backup-externo.md`.

**Produção (planejado):** `ops/backup.sh`: `pg_dump` (formato custom) → criptografia `age` → `sha256` → retenção (30 diários / 12 mensais) → cópia externa com `rclone --immutable`. Mídias (`STORAGE_DIR`) no mesmo ciclo.

| Serviço | Meta proposta | Como atingir | Situação |
|---|---|---|---|
| Portal editorial | RPO ≤ 24 h, RTO ≤ 8 h | backup diário + restauração documentada | scripts prontos, não agendados |
| Inscrições e loja | RPO ≤ 15 min, RTO ≤ 4 h | **exige** arquivamento contínuo de WAL (ex.: pgBackRest/WAL-G para armazenamento externo) | **não implementado** — avaliar custo antes de ativar vendas |

- A chave privada do `age` e este documento ficam **fora** do servidor (cofre da instituição + cópia impressa com o gestor), para restaurar mesmo com a aplicação fora do ar.
- Replicação não é backup.
- Alertas: falha do script (código ≠ 0), ausência de backup em 26 h, disco > 80%.

## Teste de restauração

`ops/restore-test.sh` restaura num banco temporário, mostra contagens e o tempo, e apaga o banco temporário.

**Evidência (10/11/2026, desenvolvimento):** dump de 187 KB restaurado em banco temporário no PostgreSQL 17 local; contagens de eventos, inscrições, grupos, auditoria e conteúdos idênticas às da origem; ~2 s no total. **Não** representa o tempo de produção.

Fazer antes do lançamento e a cada trimestre. Depois de restaurar em produção:
1. Manter o worker **parado** até concluir os passos abaixo (evita reenvio de e-mails e reexecução de jobs).
2. Marcar como `concluido` os jobs de e-mail anteriores ao ponto de restauração que já tinham sido enviados (conferir pelo provedor de e-mail).
3. Rodar a conciliação de pagamentos (`reconcile`) contra o provedor — estados chegam pela API, sem cobrar de novo.
4. Reaplicar exclusões feitas depois do backup (pedidos de oração expirados são removidos pelo expurgo diário; pedidos de exclusão de titulares precisam de registro próprio).
5. Registrar tempo, integridade (`npx tsx scripts/verify-audit.mts`) e divergências em relatório.

## Logs

- Worker e webhooks escrevem JSON de uma linha (`t`, `nivel`, `evento`, ids). Nunca senhas, tokens, cookies, dados de cartão, textos de oração ou formulários completos.
- Auditoria (`audit_log`) separada dos logs operacionais; somente inclusão; verificação de integridade em `/admin/auditoria`.
- IP: o limitador usa HMAC truncado do IP; o IP não é guardado em claro.
