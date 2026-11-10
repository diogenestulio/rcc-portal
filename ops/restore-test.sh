#!/usr/bin/env bash
# Teste de restauração: restaura um dump num banco TEMPORÁRIO, confere contagens e integridade
# da auditoria, mede o tempo e apaga o banco temporário. NÃO toca o banco de produção.
# Uso: ADMIN_URL=postgres://.../postgres ops/restore-test.sh arquivo.dump[.age]
set -euo pipefail
: "${ADMIN_URL:?}"; f="${1:?arquivo}"
tmp="rcc_restore_test_$(date +%s)"
start=$(date +%s)
psql "$ADMIN_URL" -qc "create database $tmp"
target="${ADMIN_URL%/*}/$tmp"
if [[ "$f" == *.age ]]; then age -d -i "${AGE_IDENTITY:?}" "$f" | pg_restore --no-owner -d "$target"; else pg_restore --no-owner -d "$target" "$f"; fi
psql "$target" -Atc "select 'eventos', count(*) from event union all select 'inscricoes', count(*) from registration union all select 'grupos', count(*) from prayer_group union all select 'pedidos', count(*) from \"order\" union all select 'auditoria', count(*) from audit_log"
echo "tempo_restauracao_s=$(( $(date +%s) - start ))"
psql "$ADMIN_URL" -qc "drop database $tmp with (force)"
