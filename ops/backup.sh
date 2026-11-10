#!/usr/bin/env bash
# Backup do banco (formato custom do pg_dump) + criptografia com age + cópia externa (rclone).
# Variáveis: DATABASE_URL, BACKUP_DIR, AGE_RECIPIENT (chave pública), RCLONE_REMOTE (opcional)
# Retenção proposta: 30 diários + 12 mensais (ajustar por custo/política). Ver docs/07-operacao.md.
set -euo pipefail
: "${DATABASE_URL:?}" "${BACKUP_DIR:?}" "${AGE_RECIPIENT:?}"
ts=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/monthly"
out="$BACKUP_DIR/daily/rcc-$ts.dump.age"
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" | age -r "$AGE_RECIPIENT" > "$out"
sha256sum "$out" > "$out.sha256"
# Mídias/objetos: sincronizar o bucket/pasta de storage junto (mesmo carimbo de tempo)
if [ -n "${STORAGE_DIR:-}" ]; then tar -C "$STORAGE_DIR" -cz . | age -r "$AGE_RECIPIENT" > "$BACKUP_DIR/daily/storage-$ts.tgz.age"; fi
[ "$(date -u +%d)" = "01" ] && cp "$out" "$BACKUP_DIR/monthly/"
find "$BACKUP_DIR/daily" -type f -mtime +30 -delete
find "$BACKUP_DIR/monthly" -type f -mtime +370 -delete
if [ -n "${RCLONE_REMOTE:-}" ]; then rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE" --immutable; fi
echo "{\"evento\":\"backup.ok\",\"arquivo\":\"$out\",\"bytes\":$(stat -c %s "$out")}"
