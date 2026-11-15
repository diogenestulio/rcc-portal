#!/usr/bin/env bash
# Lado da VPS da cópia externa. Chamado pelo PC/NAS via ssh (backup-externo.sh); nunca grava nada em claro fora do lugar.
#
#   backup-externo-vps.sh exportar          -> envia para a saída padrão UM pacote criptografado (gpg, chave pública
#                                             do destino) com o backup mais recente do banco + mídia + configuração
#   backup-externo-vps.sh registrar ok|erro "detalhe"
#                                          -> grava o resultado em integration_state ("backup.externo"); o worker
#                                             alerta no Telegram se falhar ou se passar de 50 h sem cópia
#
# Conteúdo do pacote (tar): banco.dump, midia.tgz (com .sha256 de cada), env (o .env, com os segredos —
# por isso o pacote é criptografado), docker-compose.yml, backup.sh, este script, cron, nginx (conf e htpasswd)
# e manifesto.json (data, versão, contagens). A chave PRIVADA fica só no destino: a VPS não consegue abrir
# cópias antigas, nem quem a invadir.
set -euo pipefail
DIR=/opt/rcc-portal-hml
BK=/opt/backups/rcc-portal-hml
PUB=$DIR/backup-externo.pub.asc
NGINX=/opt/helpdesk/nginx/conf.d
cd "$DIR"
set -a; . ./.env; set +a

psql_hml() { docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"; }

case "${1:-}" in
exportar)
  [ -f "$PUB" ] || { echo "falta $PUB (rode backup-externo-chave.sh no PC)" >&2; exit 2; }
  # Backup local mais recente; se tiver mais de 26 h (ou não existir), faz um novo agora (com teste de restauração).
  ultimo=$(ls -t "$BK"/rcc-hml-2*.dump 2>/dev/null | head -1 || true)
  if [ -z "$ultimo" ] || [ -n "$(find "$ultimo" -mmin +1560)" ]; then
    ./backup.sh >&2
    ultimo=$(ls -t "$BK"/rcc-hml-2*.dump | head -1)
  fi
  ts=$(basename "$ultimo" .dump); ts=${ts#rcc-hml-}
  midia="$BK/rcc-hml-midia-$ts.tgz"
  [ -f "$midia" ] || { echo "mídia do backup $ts não encontrada" >&2; exit 3; }
  (cd "$BK" && sha256sum -c --quiet "rcc-hml-$ts.dump.sha256" "rcc-hml-midia-$ts.tgz.sha256") >&2

  tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT; chmod 700 "$tmp"
  ln -s "$ultimo" "$tmp/banco.dump"; ln -s "$midia" "$tmp/midia.tgz"
  (cd "$BK" && sha256sum "rcc-hml-$ts.dump" | sed "s|rcc-hml-$ts.dump|banco.dump|") > "$tmp/banco.dump.sha256"
  (cd "$BK" && sha256sum "rcc-hml-midia-$ts.tgz" | sed "s|rcc-hml-midia-$ts.tgz|midia.tgz|") > "$tmp/midia.tgz.sha256"
  mkdir "$tmp/config" "$tmp/config/nginx"
  cp -p .env "$tmp/config/env"
  cp -p docker-compose.yml backup.sh "$0" "$tmp/config/"
  cp -p /etc/cron.d/rcc-portal-hml "$tmp/config/cron" 2>/dev/null || true
  cp -p "$NGINX"/rcc-portal-hml.conf "$NGINX"/rcc-portal-hml.htpasswd "$tmp/config/nginx/" 2>/dev/null || true
  aud=$(psql_hml -Atc "select count(*) from audit_log")
  med=$(psql_hml -Atc "select count(*) from media")
  printf '{"backup":"%s","gerado_em":"%s","versao":"%s","auditoria_linhas":%s,"midia_registros":%s,"origem":"%s"}\n' \
    "$ts" "$(date -u +%FT%TZ)" "${RCC_VERSAO:-?}" "$aud" "$med" "$(hostname)" > "$tmp/manifesto.json"

  g=$(mktemp -d); trap 'rm -rf "$tmp" "$g"' EXIT
  gpg --homedir "$g" --batch --quiet --import "$PUB" 2>/dev/null
  fpr=$(gpg --homedir "$g" --batch --with-colons --list-keys | awk -F: '/^fpr/ {print $10; exit}')
  tar -chf - -C "$tmp" . | gpg --homedir "$g" --batch --trust-model always --compress-algo none -r "$fpr" --encrypt
  ;;
registrar)
  det=$(printf '%s' "${3:-}" | tr -d "'\"\\\\" | cut -c1-250)
  if [ "${2:-}" = ok ]; then
    psql_hml -qc "insert into integration_state (key, last_success_at, value) values ('backup.externo', now(), '{\"detalhe\": \"$det\"}') on conflict (key) do update set last_success_at = now(), value = excluded.value, updated_at = now()" >/dev/null
  else
    psql_hml -qc "insert into integration_state (key, last_error_at, last_error) values ('backup.externo', now(), '$det') on conflict (key) do update set last_error_at = now(), last_error = excluded.last_error, updated_at = now()" >/dev/null
  fi
  ;;
*) echo "uso: $0 exportar | registrar ok|erro detalhe" >&2; exit 1 ;;
esac
