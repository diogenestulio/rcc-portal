#!/usr/bin/env bash
# Implanta/atualiza a HOMOLOGAÇÃO do portal na VPS. Roda no PC (Git Bash), a partir da pasta do portal.
#   deploy/homologacao/deploy.sh            -> build local, envia imagem, migra, reinicia app+worker
# Não mexe no Nginx compartilhado (isso é deploy/homologacao/publicar-nginx.sh, uma única vez).
set -euo pipefail
VPS=${VPS:-helpdesk-vps}
DIR=/opt/rcc-portal-hml
VERSAO=${VERSAO:-$(date -u +%Y%m%d%H%M)}

echo "== 1. testes e build local da imagem rcc-portal:$VERSAO"
npm test
docker build -t "rcc-portal:$VERSAO" .

echo "== 2. envio da imagem (docker save | gzip | ssh docker load)"
docker save "rcc-portal:$VERSAO" | gzip | ssh "$VPS" docker load

echo "== 3. arquivos de implantação"
ssh "$VPS" "mkdir -p $DIR /opt/backups/rcc-portal-hml && chmod 700 /opt/backups/rcc-portal-hml"
scp -q deploy/homologacao/docker-compose.yml deploy/homologacao/backup.sh "$VPS:$DIR/"
ssh "$VPS" "chmod 700 $DIR/backup.sh"

echo "== 4. .env (gerado NO SERVIDOR na primeira vez; segredos nunca passam pelo PC)"
ssh "$VPS" "bash -s" <<EOF
set -euo pipefail
cd $DIR
if [ ! -f .env ]; then
  pw=\$(openssl rand -hex 24)
  umask 077
  sed -e "s|__openssl_rand_hex_24__|\$pw|" -e "s|__mesma_senha__|\$pw|" \
      -e "0,/__openssl_rand_base64_32__/s|__openssl_rand_base64_32__|\$(openssl rand -hex 32)|" \
      -e "0,/__openssl_rand_base64_32__/s|__openssl_rand_base64_32__|\$(openssl rand -hex 32)|" \
      > .env <<'TPL'
$(cat deploy/homologacao/env.homologacao.example)
TPL
  echo ".env criado"
fi
sed -i "s|^RCC_VERSAO=.*|RCC_VERSAO=$VERSAO|" .env
chmod 600 .env
EOF

echo "== 5. backup antes de migrar (se já houver banco), migração e subida"
ssh "$VPS" "cd $DIR && (docker compose ps postgres --status running -q | grep -q . && ./backup.sh || true) \
  && docker compose up -d postgres && docker compose run --rm migrate && docker compose up -d --remove-orphans rcc-portal worker"

echo "== 6. verificação"
ssh "$VPS" "cd $DIR && sleep 8 && docker compose ps && docker compose exec -T rcc-portal node -e \"fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(t=>{console.log(t);process.exit(0)}).catch(e=>{console.error(e);process.exit(1)})\""
echo "OK: rcc-portal:$VERSAO em homologação. Rollback: RCC_VERSAO=<anterior> no .env + docker compose up -d --remove-orphans rcc-portal worker"
