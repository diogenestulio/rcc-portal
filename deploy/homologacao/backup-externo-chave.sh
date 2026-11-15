#!/usr/bin/env bash
# UMA VEZ, no PC (Git Bash): cria o par de chaves da cópia externa e envia SÓ a chave pública para a VPS.
#   bash deploy/homologacao/backup-externo-chave.sh
# A chave privada fica em ~/.rcc-backup/gnupg (fora do D: e fora do repositório). Sem ela, nenhum backup
# externo pode ser aberto: guarde uma cópia (arquivo chave-privada-GUARDAR.asc) num pendrive ou cofre de senhas
# e depois apague-a do PC. Quando o NAS da UP assumir, a mesma chave (ou uma nova) vai para lá.
set -euo pipefail
VPS=${VPS:-helpdesk-vps}
KEYDIR=${RCC_BACKUP_KEYDIR:-$HOME/.rcc-backup}
export GNUPGHOME="$KEYDIR/gnupg"
mkdir -p "$GNUPGHOME"; chmod 700 "$KEYDIR" "$GNUPGHOME"

if ! gpg --batch --list-secret-keys "backup-externo@rcc-portal" >/dev/null 2>&1; then
  # Sem senha na chave: o PC precisa abrir o pacote sozinho todo dia para conferir. A proteção é a pasta do usuário
  # do Windows e a cópia de guarda fora do PC.
  gpg --batch --passphrase '' --quick-generate-key "RCC Portal backup externo <backup-externo@rcc-portal>" ed25519 sign never
  fpr=$(gpg --batch --with-colons --list-keys "backup-externo@rcc-portal" | awk -F: '/^fpr/ {print $10; exit}')
  gpg --batch --passphrase '' --quick-add-key "$fpr" cv25519 encr never
  gpg --batch --armor --export-secret-keys "$fpr" > "$KEYDIR/chave-privada-GUARDAR.asc"
  chmod 600 "$KEYDIR/chave-privada-GUARDAR.asc"
  echo "Chave criada. GUARDE uma cópia de: $KEYDIR/chave-privada-GUARDAR.asc"
fi
fpr=$(gpg --batch --with-colons --list-keys "backup-externo@rcc-portal" | awk -F: '/^fpr/ {print $10; exit}')
gpg --batch --armor --export "$fpr" > "$KEYDIR/chave-publica.asc"
scp -q "$KEYDIR/chave-publica.asc" "$VPS:/opt/rcc-portal-hml/backup-externo.pub.asc"
scp -q deploy/homologacao/backup-externo-vps.sh "$VPS:/opt/rcc-portal-hml/"
ssh "$VPS" "chmod 644 /opt/rcc-portal-hml/backup-externo.pub.asc && chmod 700 /opt/rcc-portal-hml/backup-externo-vps.sh"
echo "Chave pública enviada à VPS. Impressão digital: $fpr"
