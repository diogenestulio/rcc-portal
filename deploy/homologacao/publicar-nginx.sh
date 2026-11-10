#!/usr/bin/env bash
# UMA VEZ: publica a homologação na porta 10443 do Nginx COMPARTILHADO (HelpDesk, Querigmática, UP Gestão).
# Mexe em infraestrutura de outros sistemas: fazer em horário de pouco uso e com o responsável ciente.
# Passos: backup do compose e do conf.d → senha de acesso (htpasswd) → conf → linha "10443:10443"
#        → nginx -t num container temporário → recriar SÓ o nginx → conferir as 5 portas.
# Depois: copiar rcc-portal-hml.conf e a linha 10443 também para o repositório local do helpdesk,
#         senão o próximo deploy do HelpDesk apaga a publicação.
set -euo pipefail
VPS=${VPS:-helpdesk-vps}
TS=$(date -u +%Y%m%dT%H%M%SZ)
scp -q deploy/homologacao/rcc-portal-hml.conf "$VPS:/tmp/rcc-portal-hml.conf"
ssh "$VPS" "bash -s" <<EOF
set -euo pipefail
cd /opt/helpdesk
cp docker-compose.yml docker-compose.yml.bak-antes-rcc-hml-$TS
tar -czf /root/nginx-confd-antes-rcc-hml-$TS.tgz -C nginx conf.d

# Senha de acesso à homologação (usuário "homologacao"); mostrada UMA vez e guardada só no servidor.
if [ ! -f nginx/conf.d/rcc-portal-hml.htpasswd ]; then
  pw=\$(openssl rand -base64 15 | tr -d '/+=')
  printf 'homologacao:%s\n' "\$(openssl passwd -apr1 "\$pw")" > nginx/conf.d/rcc-portal-hml.htpasswd
  chmod 644 nginx/conf.d/rcc-portal-hml.htpasswd
  printf 'usuario=homologacao\nsenha=%s\n' "\$pw" > /root/rcc-portal-hml-acesso.txt && chmod 600 /root/rcc-portal-hml-acesso.txt
  echo "Senha gerada em /root/rcc-portal-hml-acesso.txt"
fi
mv /tmp/rcc-portal-hml.conf nginx/conf.d/rcc-portal-hml.conf

# Porta no compose (aditivo, logo após a 9443)
grep -q '"10443:10443"' docker-compose.yml || sed -i '/- "9443:9443"/a\      # 10443: Portal RCC Arquidiocese de Cuiabá (HOMOLOGAÇÃO), stack em /opt/rcc-portal-hml. Ver nginx/conf.d/rcc-portal-hml.conf. Não remover.\n      - "10443:10443"' docker-compose.yml
grep -n '10443' docker-compose.yml

# Valida a configuração inteira ANTES de tocar no nginx em produção
docker run --rm --network helpdesk_default -v /opt/helpdesk/nginx/conf.d:/etc/nginx/conf.d:ro \
  -v helpdesk_certbot-conf:/etc/letsencrypt:ro nginx:alpine nginx -t

# Porta nova exige RECRIAR o container (restart não publica porta). --no-deps: não toca no app do HelpDesk.
docker compose up -d --no-deps nginx
sleep 3
docker exec helpdesk-nginx-1 sh -c 'netstat -tln 2>/dev/null || ss -tln' | grep -E ':(80|443|8443|9443|10443) '
for p in 443 8443 9443 10443; do printf "%s -> " \$p; curl -sk -o /dev/null -w "%{http_code}\n" https://127.0.0.1:\$p/; done
EOF
echo "Conferir: 443/8443/9443 com os mesmos códigos de antes; 10443 = 401 (pede senha). Em caso de problema:"
echo "  ssh $VPS 'cd /opt/helpdesk && cp docker-compose.yml.bak-antes-rcc-hml-$TS docker-compose.yml && rm nginx/conf.d/rcc-portal-hml.conf && docker compose up -d --no-deps nginx'"
