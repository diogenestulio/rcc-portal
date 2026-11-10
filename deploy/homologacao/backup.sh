#!/usr/bin/env bash
# Backup diário da HOMOLOGAÇÃO (dados fictícios): pg_dump custom + sha256, retenção de 7 dias,
# e teste de restauração em banco temporário dentro do próprio container. Agendar em /etc/cron.d/rcc-portal-hml.
# (Produção usará ops/backup.sh com criptografia e cópia externa.)
set -euo pipefail
cd /opt/rcc-portal-hml
DEST=/opt/backups/rcc-portal-hml
ts=$(date -u +%Y%m%dT%H%M%SZ)
f="$DEST/rcc-hml-$ts.dump"
set -a; . ./.env; set +a
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" --format=custom --no-owner "$POSTGRES_DB" > "$f"
chmod 600 "$f"; sha256sum "$f" > "$f.sha256"
# Teste de restauração (banco temporário, apagado ao fim)
start=$(date +%s)
docker compose exec -T postgres sh -c "psql -U $POSTGRES_USER -d postgres -qc 'drop database if exists restore_teste' -c 'create database restore_teste'"
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" --no-owner -d restore_teste < "$f"
n=$(docker compose exec -T postgres psql -U "$POSTGRES_USER" -d restore_teste -Atc "select count(*) from audit_log")
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -qc "drop database restore_teste"
find "$DEST" -name 'rcc-hml-*' -mtime +7 -delete
echo "{\"t\":\"$(date -u +%FT%TZ)\",\"evento\":\"backup.ok\",\"arquivo\":\"$f\",\"bytes\":$(stat -c %s "$f"),\"restauracao_s\":$(( $(date +%s) - start )),\"auditoria_linhas\":$n}"
