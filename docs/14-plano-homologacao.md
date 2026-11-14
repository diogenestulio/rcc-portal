# Plano de homologação na VPS atual

> **Incidente 10–11/11/2026:** o serviço chamado `app` colidiu com o HelpDesk na rede compartilhada; corrigido (serviço renomeado para `rcc-portal`). Ver `15-incidente-2026-11-10.md`.

Decisão de 10/11/2026: homologação na VPS Hostinger compartilhada; servidor próprio quando loja/inscrições pagas forem ativadas.
**Situação (10/11/2026, 20:09 UTC):** passo 1 **executado** — stack `rcc-portal-hml` no ar na VPS com a imagem `rcc-portal:202611102006` (55 testes passando antes do build; migração aplicada; app *healthy*, `/api/health` ok, worker ativo, 0 reinícios; memória em uso: app 58 MB, worker 21 MB, Postgres 33 MB). `.env` gerado no servidor (permissão 600, sem marcadores sobrando). Outros sistemas inalterados (443=307, 8443=200, 9443=200 antes e depois; Nginx não reiniciado). Passo 2 **executado**: seed de demonstração (7 grupos, 4 eventos, 5 conteúdos, todos marcados como demonstração) e conta `diogenestulio@gmail.com` (gestor institucional, editor, gestor de eventos, intercessor); senha gerada no servidor em `/root/rcc-portal-hml-admin.txt` (600). Cadeia de auditoria íntegra. Passo 3 **executado** (20:13 UTC): porta 10443 publicada; Nginx recriado com as 5 portas escutando; de fora: 443=307, 8443=200, 9443=200 (iguais ao antes), 10443 sem senha=401, com senha: páginas 200, `/admin` 307, `X-Robots-Tag: noindex`, login HTTPS com cookie `Secure; HttpOnly; SameSite=Lax`. Senha de acesso em `/root/rcc-portal-hml-acesso.txt` (600). Backup do compose: `/opt/helpdesk/docker-compose.yml.bak-antes-rcc-hml-20261110T201303Z`. Passo 4 **executado**: compose e os arquivos `rcc-portal-hml.conf`/`.htpasswd` copiados para o repositório local do HelpDesk no D: (md5 iguais aos da VPS, **sem commit**, como os demais confs compartilhados). Passo 7 desnecessário (porta já acessível). Passo 5 **executado**: backup manual verificado (dump de 95 KB, sha256 ok, restauração de teste em 1 s) e agendado em `/etc/cron.d/rcc-portal-hml` às 04:15 UTC (00:15 em Cuiabá), log em `/var/log/rcc-portal-hml-backup.log`. **Todos os passos do plano concluídos.** O backup fica na própria VPS (sem cópia externa) — aceitável só porque os dados são fictícios.

## 1. Situação da VPS (lida em 10/11/2026, somente leitura)

| Item | Valor |
|---|---|
| CPU / RAM | 1 vCPU · 3,9 GB (≈ 2,6 GB disponíveis) · swap 2 GB sem uso |
| Disco | 48 GB, 36 GB livres |
| Sistemas no ar | HelpDesk (80/443), Formação Querigmática (8443), UP Gestão (9443) — todos pelo Nginx `helpdesk-nginx-1` |
| Firewall do SO | `ufw` inativo; INPUT ACCEPT (firewall do painel Hostinger não verificado) |
| Ferramentas | `openssl` presente; `age` e `htpasswd` ausentes (o plano não depende deles) |

## 2. Desenho

```
Internet ──https :10443──▶ helpdesk-nginx-1 (senha de homologação + noindex)
                                  │  rede helpdesk_default (alias rcc-hml-app; serviço `rcc-portal` — nunca `app`)
                                  ▼
                 /opt/rcc-portal-hml  ── app (Next.js, 384 MB)
                                       ├ worker (fila e rotinas, 192 MB)
                                       └ postgres 17 (256 MB, rede interna, sem porta)
```

- Endereço: `https://179-197-73-172.sslip.io:10443` (mesmo certificado dos outros sistemas; sem domínio ainda).
- **Toda a homologação fica atrás de senha** (HTTP Basic no Nginx), além do login + MFA do painel. Fora de produção o portal também responde `robots: Disallow /` e `noindex`.
- Dados: **somente fictícios** (seed com selo “Demonstração”). E-mails não saem: são gravados como `.eml` no volume `emails` do worker.
- Memória: limites somam ~832 MB; medido no teste local: app 102 MB, worker 25 MB, Postgres 54 MB (em repouso). Imagem: 311 MB.

## 3. Arquivos (em `deploy/homologacao/`)

| Arquivo | Função |
|---|---|
| `../../Dockerfile` | imagem única: Next standalone + scripts empacotados (worker, migrate, seed, create-admin, verify-audit) |
| `docker-compose.yml` | stack `rcc-portal-hml` (app, worker, postgres, ferramentas) |
| `env.homologacao.example` | modelo do `.env`; os segredos são gerados **no servidor** |
| `rcc-portal-hml.conf` | bloco do Nginx compartilhado (porta 10443, senha, noindex, resolução tardia) |
| `publicar-nginx.sh` | **uma vez**: backup, senha, conf, porta 10443, `nginx -t`, recriar só o Nginx, conferir as 5 portas |
| `deploy.sh` | a cada versão: testes → build → envio da imagem → backup → migração → subida → verificação |
| `backup.sh` | diário: dump do banco + pacote da mídia (volume `midia`), sha256, **teste de restauração** e conferência de que toda mídia do banco tem arquivo; retenção de 7 dias |

## 4. Passo a passo (cada passo precisa do seu “ok”)

1. **Implantar a stack** — `deploy/homologacao/deploy.sh`. Cria `/opt/rcc-portal-hml`, gera o `.env` no servidor, sobe Postgres, migra, sobe app e worker. **Não toca em nenhum outro sistema.**
2. **Dados de demonstração e primeira conta**
   `ssh helpdesk-vps 'cd /opt/rcc-portal-hml && docker compose run --rm ferramentas scripts/seed-dev.mjs'`
   Conta: `docker compose run --rm -e ADMIN_PASSWORD=… ferramentas scripts/create-admin.mjs email "Nome" papeis` (senha digitada por você, no servidor).
3. **Publicar no Nginx compartilhado** — `deploy/homologacao/publicar-nginx.sh`. **Este é o único passo que afeta os outros 3 sistemas:** recria o container do Nginx (alguns segundos sem resposta em 443/8443/9443). Sugestão: fazer à noite. O script faz backup, valida com `nginx -t` antes e mostra o comando de volta.
4. **Repositório do HelpDesk** — copiar `rcc-portal-hml.conf` e a linha `"10443:10443"` para o repositório local do helpdesk; caso contrário, o próximo deploy do HelpDesk remove a publicação (já aconteceu com outro sistema).
5. **Backup agendado** — criar `/etc/cron.d/rcc-portal-hml`:
   `15 4 * * * root /opt/rcc-portal-hml/backup.sh >> /var/log/rcc-portal-hml-backup.log 2>&1`
6. **Verificação final** (de fora da VPS): 10443 pede senha (401); com senha, home 200; `/api/health` ok; 443/8443/9443 com os mesmos códigos de antes; login + MFA no navegador; inscrição de teste; worker gerando `.eml`.
7. **Firewall da Hostinger**: se a porta 10443 não responder de fora, liberar no painel (as outras portas já funcionam, então provavelmente basta adicionar 10443).

## 5. Volta atrás (rollback)

| Situação | Ação |
|---|---|
| Nova versão com defeito | `RCC_VERSAO=<anterior>` no `.env` + `docker compose up -d app worker` (migrações são aditivas) |
| Nginx com problema após o passo 3 | comando impresso pelo `publicar-nginx.sh` (restaura o compose do HelpDesk e remove o conf) |
| Remover a homologação | `docker compose down -v` em `/opt/rcc-portal-hml` + passo acima para o Nginx |

## 6. Teste local já feito (10/11/2026)

Imagem `rcc-portal` construída; em contêineres com `APP_ENV=homologacao`: migração ok, seed ok, conta criada, cadeia de auditoria íntegra; `/`, `/grupos`, `/agenda`, `/agenda.ics`, `/api/health`, `/entrar` → 200; `/admin` → 307 (login); login correto 200 e incorreto 401; aviso de homologação no topo; `robots.txt` bloqueando tudo; worker iniciado. **Não testado:** o bloco do Nginx real, a senha HTTP Basic e o acesso externo à porta 10443.

## 7. Antes de virar produção (fora deste plano)
Domínio próprio, servidor dedicado, e-mail transacional, backup criptografado com cópia externa, HSTS e as pendências institucionais de `01-pendencias-bloqueantes.md`.

## Correção 14/11/2026 — pasta de e-mails sem permissão
Desde a primeira implantação, o worker não conseguia gravar os `.eml` (volume `emails` criado como `root`; o worker roda como `app`): e-mails de homologação falhavam com `EACCES` e eram tentados de novo. Corrigido na VPS (`chown app:app` no volume) e no `Dockerfile` (a pasta já nasce com o dono certo). Teste com a conta fictícia `teste.redefinir@teste.invalid` (desativada após o teste): pedido de redefinição → `.eml` gerado com link da homologação → payload do job apagado.
