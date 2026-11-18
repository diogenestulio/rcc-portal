#!/usr/bin/env bash
# ENSAIO DE RESTAURAÇÃO em ambiente DESCARTÁVEL (PC com Docker), a partir da cópia externa criptografada.
#   bash deploy/homologacao/ensaio-restauracao.sh [arquivo.tar.gpg]      (padrão: a cópia mais recente do D:)
#   bash deploy/homologacao/ensaio-restauracao.sh --limpar               (remove contêineres, volume e rede do ensaio)
# Sobe: PostgreSQL 17 + portal (mesma imagem da homologação) em http://localhost:3300, com banco, mídias e
# configuração restaurados (MEDIA_DIR vem do docker-compose, não do .env). NÃO sobe o worker (não envia e-mails
# nem alertas). Mede o tempo e mostra o último dado recuperado.
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash: não converter /data/... em caminhos do Windows
DEST=${RCC_BACKUP_DEST:-"/d/Dados Backup Claude Projetos/RCC ARQUIDIOCESANO"}
export GNUPGHOME=${RCC_BACKUP_KEYDIR:-$HOME/.rcc-backup}/gnupg
N=rcc-ensaio; PORTA=${PORTA:-3300}
limpar() { docker rm -f $N-pg $N-app >/dev/null 2>&1 || true; docker volume rm $N-midia >/dev/null 2>&1 || true; docker network rm $N >/dev/null 2>&1 || true; }
if [ "${1:-}" = "--limpar" ]; then limpar; echo "ensaio removido"; exit 0; fi

ARQ=${1:-$(ls -t "$DEST"/rcc-hml-completo-*.tar.gpg | head -1)}
T0=$(date +%s); tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
echo "== 1. cópia: $(basename "$ARQ")"
(cd "$(dirname "$ARQ")" && sha256sum -c --quiet "$(basename "$ARQ").sha256")
gpg --batch --quiet --decrypt "$ARQ" 2>/dev/null | tar -xf - -C "$tmp"
(cd "$tmp" && sha256sum -c --quiet banco.dump.sha256 midia.tgz.sha256)
cat "$tmp/manifesto.json"; echo
VERSAO=$(sed -n 's/^RCC_VERSAO=//p' "$tmp/config/env")
docker image inspect "rcc-portal:$VERSAO" >/dev/null 2>&1 || { echo "imagem rcc-portal:$VERSAO ausente neste PC (rode o build ou use outra cópia)"; exit 2; }

echo "== 2. ambiente descartável"
limpar; docker network create $N >/dev/null
docker run -d --name $N-pg --network $N -e POSTGRES_PASSWORD=ensaio -e POSTGRES_DB=rcc postgres:17-alpine >/dev/null
for _ in $(seq 60); do docker exec $N-pg pg_isready -U postgres -d rcc -q 2>/dev/null && break; sleep 1; done; sleep 2
echo "== 3. banco"
docker exec -i $N-pg pg_restore -U postgres -d rcc --no-owner --no-privileges < "$tmp/banco.dump"
echo "== 4. mídias"
docker volume create $N-midia >/dev/null
docker run --rm -i -v $N-midia:/data/media postgres:17-alpine sh -c "tar -xzf - -C /data/media && chown -R 100:101 /data/media" < "$tmp/midia.tgz"
echo "== 5. portal (configuração restaurada, banco e endereço do ensaio)"
grep -vE '^(DATABASE_URL|APP_URL|TELEGRAM_|SMTP_URL|ENABLE_HSTS)=' "$tmp/config/env" > "$tmp/env.ensaio"
docker run -d --name $N-app --network $N -p 127.0.0.1:$PORTA:3000 --env-file "$(cygpath -w "$tmp/env.ensaio" 2>/dev/null || echo "$tmp/env.ensaio")" \
  -e DATABASE_URL=postgres://postgres:ensaio@$N-pg:5432/rcc -e APP_URL=http://localhost:$PORTA -e ENABLE_HSTS=false -e MEDIA_DIR=/data/media \
  -v $N-midia:/data/media "rcc-portal:$VERSAO" >/dev/null
for _ in $(seq 90); do curl -sf http://localhost:$PORTA/api/health >/dev/null 2>&1 && break; sleep 1; done
T1=$(date +%s)
echo "== 6. conferência"
curl -s http://localhost:$PORTA/api/health; echo
q() { docker exec $N-pg psql -U postgres -d rcc -Atc "$1"; }
echo "contagens: auditoria=$(q 'select count(*) from audit_log') midias=$(q 'select count(*) from media') inscricoes=$(q 'select count(*) from registration') conteudos=$(q 'select count(*) from content_item')"
echo "último dado recuperado: auditoria=$(q "select to_char(max(at) at time zone 'America/Cuiaba','DD/MM/YYYY HH24:MI') from audit_log") inscrição=$(q "select to_char(max(created_at) at time zone 'America/Cuiaba','DD/MM/YYYY HH24:MI') from registration")"
m=$(curl -s http://localhost:$PORTA/multimidia | grep -o '/midia/[0-9a-f-]*/w640/arquivo\.webp' | head -1)
[ -n "$m" ] && echo "imagem: $(curl -s -o /dev/null -w '%{http_code} %{content_type}' http://localhost:$PORTA$m) $m"
echo "cadeia de auditoria (null = íntegra): $(docker exec $N-app node scripts/verify-audit.mjs 2>&1 | tail -1)"
faltando=0; for k in $(q "select storage_key from media"); do docker exec $N-app test -f "/data/media/$k" || faltando=$((faltando + 1)); done
echo "arquivos de mídia faltando: $faltando"
echo "TEMPO até o portal responder: $((T1 - T0)) s"
echo "Portal do ensaio: http://localhost:$PORTA  (remover depois: bash deploy/homologacao/ensaio-restauracao.sh --limpar)"
