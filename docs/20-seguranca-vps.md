# Segurança da VPS e plano de testes

A VPS (Hostinger, Ubuntu 24.04) é **compartilhada**: HelpDesk (UP DESK), Querigmática, UP Gestão e a homologação do portal. Uma brecha no servidor afeta todos os sistemas. Os controles **dentro do portal** estão em `11-lgpd-seguranca.md`.

## Situação encontrada em 15/11/2026

| Item | Antes | Risco |
|---|---|---|
| SSH | `root` podia entrar **com senha** (`50-cloud-init.conf` ligava a senha) | alto: **2.501 tentativas de senha em 7 dias**, vindas de robôs (dois endereços fizeram 873 cada) |
| Bloqueio de insistentes | nenhum (sem fail2ban) | médio |
| Atualizações automáticas de segurança | **ligadas** (`unattended-upgrades`) | — |
| Logins aceitos nos últimos 30 dias | **todos por chave** (a chave `helpdesk-deploy` e a do terminal do painel Hostinger) | nenhum login por senha: não há sinal de invasão |
| Portas abertas | 22 (SSH), 80/443, 8443, 9443, 10443 (nginx em contêiner) | esperado |

## O que foi feito (15/11/2026)

1. **SSH só por chave:** criado o arquivo `/etc/ssh/sshd_config.d/00-endurecimento.conf`, que é lido antes dos outros:
   - `PasswordAuthentication no`, `KbdInteractiveAuthentication no` e `PermitRootLogin prohibit-password`;
   - `MaxAuthTries 3`, `LoginGraceTime 30` e `X11Forwarding no`.
   - **Testado:** uma conexão nova por chave funciona, e uma tentativa por senha é recusada (`Permission denied (publickey)`).
2. **fail2ban** (`/etc/fail2ban/jail.d/endurecimento.local`):
   - 5 erros em 10 min → bloqueio de 1 h;
   - 3 bloqueios em 1 dia → bloqueio de 1 semana (`recidive`).
3. **Acesso de avaliador na homologação:** usuário `avaliador` na senha do nginx.
   - A senha foi gerada no servidor e fica em `/root/rcc-portal-hml-avaliador.txt`.
   - Para remover, apague a linha `avaliador:` de `/opt/helpdesk/nginx/conf.d/rcc-portal-hml.htpasswd`. Não precisa reiniciar nada.
   - Cópia anterior do arquivo: `rcc-portal-hml.htpasswd.bak-20261115`.
4. **Conferência depois das mudanças:** os 16 contêineres continuaram no ar, sem reinício, e os quatro sistemas responderam.

**Se perder o acesso SSH** (chave perdida ou PC trocado), use o **terminal do navegador no painel da Hostinger**: VPS → Terminal. Ele entra por mecanismo próprio. Para desbloquear um IP, rode `fail2ban-client unban <ip>`.

## Decisões

- **Firewall no servidor (ufw): não ativado.**
  - O único serviço que o próprio servidor expõe é o SSH (22). As portas dos sites são abertas pelo Docker, que **passa por cima** do ufw; ligar o ufw daria falsa sensação de proteção e arriscaria a rede dos contêineres de produção.
  - **Recomendado:** usar o **firewall do painel da Hostinger** (antes de o tráfego chegar à VPS), liberando só 22, 80, 443, 8443, 9443 e 10443. É feito por você no hPanel: VPS → Segurança → Firewall.

## Pendente (combinar janela de manutenção)

- **Reiniciar a VPS:** há atualização de kernel e libc aguardando reinício (`/var/run/reboot-required`), além de 48 pacotes não urgentes. O reinício tira **todos** os sistemas do ar por cerca de 2 a 5 minutos.
- **Procedimento sugerido** (madrugada ou domingo):
  1. `apt-get upgrade`;
  2. `reboot`;
  3. conferir `docker ps` (todos os contêineres têm `restart: unless-stopped`);
  4. abrir os quatro endereços.

## Plano de testes de segurança

| Etapa | Como | Quando | Situação |
|---|---|---|---|
| Testes automáticos de permissões, injeção de SQL, uploads e sanitização | `npm test` (97 testes) + CI a cada envio | sempre | **em uso** |
| Dependências vulneráveis e segredos no código | `npm audit` + gitleaks no CI | sempre | **em uso** |
| Varredura automática do site | OWASP ZAP (baseline e depois completo, logado) contra a homologação, com relatório | antes do lançamento | a fazer (exige baixar a imagem do ZAP, ~1,5 GB) |
| Testes manuais dirigidos | força bruta no login, troca de IDs na URL, painel sem as duas etapas, upload malicioso, sessões | antes do lançamento | a fazer |
| Teste de invasão por terceiro | profissional de segurança | antes de ligar loja ou inscrições pagas | a contratar |
| Rotina | revisar contas e auditoria (mensal); reinício para kernel (mensal); restauração do backup (trimestral) | sempre | manual em `manual-administrador.md` |

“100% seguro” não existe. A meta é **reduzir riscos em camadas, detectar rápido** (alertas no Telegram, auditoria) e **conseguir voltar** (backup testado, cópia externa).
