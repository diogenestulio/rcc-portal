#!/usr/bin/env bash
# Backup diário da HOMOLOGAÇÃO (dados fictícios): banco (pg_dump custom) + arquivos da biblioteca de
# mídia (tar.gz), ambos com sha256 e o mesmo carimbo de tempo; retenção de 7 dias; teste de restauração
# do banco num banco temporário e conferência de que toda mídia do banco tem arquivo no pacote.
# Agendado em /etc/cron.d/rcc-portal-hml. (Produção usará ops/backup.sh com criptografia e cópia externa.)
set -euo pipefail
cd /opt/rcc-portal-hml
DEST=/opt/backups/rcc-portal-hml
ts=$(date -u +%Y%m%dT%H%M%SZ)
f="$DEST/rcc-hml-$ts.dump"
fm="$DEST/rcc-hml-midia-$ts.tgz"
set -a; . ./.env; set +a

docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" --format=custom --no-owner "$POSTGRES_DB" > "$f"
chmod 600 "$f"; sha256sum "$f" > "$f.sha256"

# Mídia: lida de dentro do contêiner do portal (dono do volume)
docker compose exec -T rcc-portal tar -czf - -C /data/media . > "$fm"
chmod 600 "$fm"; sha256sum "$fm" > "$fm.sha256"

# Teste de restauração do banco (banco temporário, apagado ao fim)
start=$(date +%s)
docker compose exec -T postgres sh -c "psql -U $POSTGRES_USER -d postgres -qc 'drop database if exists restore_teste' -c 'create database restore_teste'"
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" --no-owner -d restore_teste < "$f"
n=$(docker compose exec -T postgres psql -U "$POSTGRES_USER" -d restore_teste -Atc "select count(*) from audit_log")
keys=$(docker compose exec -T postgres psql -U "$POSTGRES_USER" -d restore_teste -Atc "select storage_key from media")
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -qc "drop database restore_teste"

# Conferência mídia: cada registro do banco restaurado precisa do arquivo no pacote
lista=$(tar -tzf "$fm")
faltando=0
for k in $keys; do grep -qx "./$k" <<<"$lista" || faltando=$((faltando + 1)); done
nkeys=$(printf '%s\n' "$keys" | grep -c . || true)

find "$DEST" -name 'rcc-hml-*' -mtime +7 -delete
status=$([ "$faltando" -eq 0 ] && echo "backup.ok" || echo "backup.midia_incompleta")
echo "{\"t\":\"$(date -u +%FT%TZ)\",\"evento\":\"$status\",\"arquivo\":\"$f\",\"bytes\":$(stat -c %s "$f"),\"midia_bytes\":$(stat -c %s "$fm"),\"restauracao_s\":$(( $(date +%s) - start )),\"auditoria_linhas\":$n,\"midia_registros\":$nkeys,\"midia_faltando\":$faltando}"
[ "$faltando" -eq 0 ]
