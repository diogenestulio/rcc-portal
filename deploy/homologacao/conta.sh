#!/usr/bin/env bash
# Cria ou reativa uma conta da equipe NA HOMOLOGAÇÃO e define a senha, digitada aqui (não aparece na tela,
# não fica no histórico e não passa por nenhum outro lugar). Uso, do PC (PowerShell ou Git Bash):
#   ssh -t helpdesk-vps "/opt/rcc-portal-hml/conta.sh email@exemplo.org 'Nome Completo' gestor_institucional,editor"
# Papéis: admin_tecnico gestor_institucional editor revisor gestor_eventos operador_loja responsavel_local intercessor
# A verificação em duas etapas é configurada no primeiro acesso em /entrar. Outras contas: criar pelo painel
# (Usuários e papéis → Nova conta), que gera senha provisória.
set -euo pipefail
cd /opt/rcc-portal-hml
email=${1:?informe o e-mail}; nome=${2:?informe o nome entre aspas}; papeis=${3:-gestor_institucional}
read -rsp "Nova senha para $email (mínimo 12 caracteres): " p1; echo
read -rsp "Repita a senha: " p2; echo
[ "$p1" = "$p2" ] || { echo "As senhas não conferem." >&2; exit 1; }
[ ${#p1} -ge 12 ] || { echo "A senha precisa de pelo menos 12 caracteres." >&2; exit 1; }
ADMIN_PASSWORD="$p1" docker compose exec -T -e ADMIN_PASSWORD worker node scripts/create-admin.mjs "$email" "$nome" "$papeis"
