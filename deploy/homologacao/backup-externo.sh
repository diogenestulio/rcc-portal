#!/usr/bin/env bash
# Cópia EXTERNA do backup da homologação, puxada pelo PC (hoje) ou pelo NAS da UP Tecnologia (futuro).
#   bash deploy/homologacao/backup-externo.sh
# Agendado no Agendador de Tarefas do Windows ("RCC Portal - backup externo", diário). Pré-requisito, uma vez:
#   bash deploy/homologacao/backup-externo-chave.sh
#
# Passos: VPS gera o pacote criptografado → grava no destino como .part → abre o pacote AQUI com a chave privada
# → confere sha256 do banco e da mídia → restaura o banco num PostgreSQL descartável (Docker, se estiver rodando)
# e compara a contagem da auditoria com o manifesto → renomeia para o nome final → retenção (30 diários + 1 por
# mês por 12 meses) → registra o resultado na VPS (o worker alerta no Telegram se falhar ou passar de 50 h).
set -euo pipefail
VPS=${VPS:-helpdesk-vps}
DEST=${RCC_BACKUP_DEST:-"/d/Dados Backup Claude Projetos/RCC ARQUIDIOCESANO"}
KEYDIR=${RCC_BACKUP_KEYDIR:-$HOME/.rcc-backup}
REMOTO=/opt/rcc-portal-hml/backup-externo-vps.sh
export GNUPGHOME="$KEYDIR/gnupg"
mkdir -p "$DEST"
LOG="$DEST/backup-externo.log"
ts=$(date -u +%Y%m%dT%H%M%SZ)
final="$DEST/rcc-hml-completo-$ts.tar.gpg"
part="$final.part"
tmp=$(mktemp -d)
cleanup() { rm -rf "$tmp"; rm -f "$part"; docker rm -f "rcc-restore-$ts" >/dev/null 2>&1 || true; }
trap cleanup EXIT

log() { printf '{"t":"%s","evento":"%s"%s}\n' "$(date -u +%FT%TZ)" "$1" "${2:+,$2}" | tee -a "$LOG"; }
falhar() { log "backup_externo.erro" "\"detalhe\":\"$1\""; ssh "$VPS" "$REMOTO registrar erro '$1'" || true; exit 1; }
trap 'falhar "falhou na linha $LINENO do backup-externo.sh"' ERR

gpg --batch --list-secret-keys "backup-externo@rcc-portal" >/dev/null 2>&1 || falhar "chave privada ausente no PC"

# 1. Pacote criptografado (já sai cifrado da VPS)
ssh "$VPS" "$REMOTO exportar" > "$part"
[ -s "$part" ] || falhar "pacote vazio"

# 2. Abrir e conferir aqui (prova de que a cópia é restaurável com a chave que temos)
gpg --batch --quiet --decrypt "$part" 2>/dev/null | tar -xf - -C "$tmp"
(cd "$tmp" && sha256sum -c --quiet banco.dump.sha256 midia.tgz.sha256) || falhar "sha256 não confere"
tar -tzf "$tmp/midia.tgz" >/dev/null || falhar "pacote de mídia corrompido"
[ -s "$tmp/config/env" ] && [ -s "$tmp/config/docker-compose.yml" ] || falhar "configuração incompleta no pacote"
esperado=$(sed -E 's/.*"auditoria_linhas":([0-9]+).*/\1/' "$tmp/manifesto.json")
origem=$(sed -E 's/.*"backup":"([^"]+)".*/\1/' "$tmp/manifesto.json")

# 3. Restauração real num PostgreSQL descartável (pula, sem falhar, se o Docker Desktop não estiver rodando)
restauracao="pulada (Docker parado)"
if docker info >/dev/null 2>&1; then
  docker run -d --rm --name "rcc-restore-$ts" -e POSTGRES_PASSWORD=descartavel postgres:17-alpine >/dev/null
  for _ in $(seq 60); do docker exec "rcc-restore-$ts" pg_isready -U postgres -q 2>/dev/null && break; sleep 1; done
  sleep 2
  docker exec -i "rcc-restore-$ts" pg_restore -U postgres --no-owner -d postgres < "$tmp/banco.dump"
  n=$(docker exec "rcc-restore-$ts" psql -U postgres -Atc "select count(*) from audit_log")
  [ "$n" = "$esperado" ] || falhar "restauração com $n linhas de auditoria; esperado $esperado"
  restauracao="ok ($n linhas de auditoria)"
fi

# 4. Nome final + sha256 do pacote cifrado (para conferir cópias no NAS/pendrive)
mv "$part" "$final"
(cd "$DEST" && sha256sum "$(basename "$final")" > "$(basename "$final").sha256")

# 5. Retenção: 30 mais recentes + o mais recente de cada um dos últimos 12 meses
mapfile -t todos < <(cd "$DEST" && ls -1 rcc-hml-completo-*.tar.gpg 2>/dev/null | sort -r)
declare -A manter=() meses=()
for i in "${!todos[@]}"; do
  f=${todos[$i]}; m=${f:17:6}
  [ "$i" -lt 30 ] && manter[$f]=1
  if [ -z "${meses[$m]:-}" ] && [ "${#meses[@]}" -lt 12 ]; then meses[$m]=1; manter[$f]=1; fi
done
removidos=0
for f in "${todos[@]}"; do
  [ -n "${manter[$f]:-}" ] || { rm -f "$DEST/$f" "$DEST/$f.sha256"; removidos=$((removidos + 1)); }
done

bytes=$(stat -c %s "$final")
trap - ERR
log "backup_externo.ok" "\"arquivo\":\"$(basename "$final")\",\"bytes\":$bytes,\"origem\":\"$origem\",\"restauracao\":\"$restauracao\",\"guardados\":$(( ${#todos[@]} - removidos )),\"removidos\":$removidos"
ssh "$VPS" "$REMOTO registrar ok 'origem=$origem bytes=$bytes restauracao=$restauracao'"
