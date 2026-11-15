# Cópia externa do backup (homologação)

O backup diário da VPS (`backup.sh`, 00:15 de Cuiabá, com teste de restauração) fica **no mesmo disco** que o sistema. A cópia externa leva tudo o que é preciso para reconstruir o portal para **fora da VPS**, criptografado.

| | Hoje | Futuro |
|---|---|---|
| Destino | PC do coordenador técnico: `D:\Dados Backup Claude Projetos\RCC ARQUIDIOCESANO` | NAS da UP Tecnologia (mesmos scripts; mudar `RCC_BACKUP_DEST`) |
| Quem puxa | Agendador de Tarefas do Windows, todo dia às 08:30 (ou assim que o PC ligar) | tarefa agendada no NAS |

## Como funciona

1. O PC chama a VPS por SSH (`backup-externo-vps.sh exportar`).
2. A VPS monta um pacote com:
   - o backup mais recente do banco e da mídia, junto com os `sha256` de cada um;
   - o `.env` com os segredos, o `docker-compose.yml` e os scripts;
   - o cron e a configuração do nginx (conf e senha da homologação);
   - um `manifesto.json`.
3. Ela **criptografa** o pacote com a chave **pública** do destino (GnuPG, curva 25519). O pacote já sai cifrado da VPS, e nada fica salvo em claro além do backup local de sempre.
4. O PC grava o pacote e o **abre com a chave privada**. Em seguida:
   - confere os `sha256`;
   - restaura o banco num PostgreSQL descartável (Docker), se o Docker Desktop estiver aberto;
   - compara as linhas da auditoria com o manifesto.
5. Só então o pacote recebe o nome final, `rcc-hml-completo-AAAAMMDDTHHMMSSZ.tar.gpg`, e ganha seu `.sha256`.
6. **Retenção:** ficam as 30 cópias mais recentes e mais a última de cada mês, por 12 meses.
7. O resultado vai para a VPS (`integration_state`, chave `backup.externo`). O worker manda alerta 🔴 no Telegram se a cópia falhar ou se passar **50 h** sem cópia (o PC pode ficar desligado num fim de semana).

Histórico das execuções: `backup-externo.log`, na pasta de destino (uma linha JSON por execução).

## A chave (ponto mais importante)

- **Onde fica:**
  - chave privada em `C:\Users\<usuário>\.rcc-backup\gnupg`, fora do D: e fora do repositório;
  - chave pública na VPS, em `/opt/rcc-portal-hml/backup-externo.pub.asc`.
- **O que a VPS consegue:** ela só cifra e **não consegue abrir** cópias antigas, nem quem a invadir.
- **Sem a chave privada não há restauração.** Ao criar a chave, o script gera `chave-privada-GUARDAR.asc` na mesma pasta:
  1. copie esse arquivo para um pendrive guardado ou para um cofre de senhas;
  2. depois apague-o do PC.
- Impressão digital da chave atual: `04D6D681D247054CAEC38497270C6A142D158CA6`, criada em 15/11/2026.
- A chave não tem senha, porque o PC precisa abrir o pacote sozinho todo dia para conferir. A proteção vem da conta do Windows e da cópia de guarda fora do PC. No NAS, avaliar uma chave com senha e conferência semanal.

## Instalação (uma vez, no PC)

Rodar no Git Bash, a partir da pasta do portal:

```bash
bash deploy/homologacao/backup-externo-chave.sh      # cria a chave e envia a pública à VPS
bash deploy/homologacao/backup-externo.sh            # primeira cópia (teste)
```

Agendamento diário (PowerShell, na pasta do portal):

```powershell
powershell -ExecutionPolicy Bypass -File deploy\homologacao\agendar-backup-externo.ps1
```

## Restaurar a partir da cópia externa

Rodar no Git Bash do PC que tem a chave. `<arquivo>` é a cópia escolhida.

```bash
export GNUPGHOME=~/.rcc-backup/gnupg            # ou: gpg --import chave-privada-GUARDAR.asc num PC novo
cd "/d/Dados Backup Claude Projetos/RCC ARQUIDIOCESANO"
sha256sum -c <arquivo>.sha256
mkdir -p ~/restauracao && gpg -d <arquivo> | tar -xf - -C ~/restauracao
cd ~/restauracao && sha256sum -c banco.dump.sha256 midia.tgz.sha256 && cat manifesto.json
```

Na VPS nova (ou na mesma, depois de uma perda):

1. Recriar `/opt/rcc-portal-hml` a partir de `config/`:
   - `config/env` vira `.env`, com `chmod 600`;
   - copiar `docker-compose.yml`, `backup.sh` e `backup-externo-vps.sh`;
   - o cron vai para `/etc/cron.d/rcc-portal-hml`;
   - `config/nginx/*` vai para o `conf.d` do nginx.
2. Enviar a imagem do portal (`deploy.sh`, ou só os passos 1 e 2 dele) e subir **apenas o postgres**.
3. Restaurar o banco: `docker compose exec -T postgres pg_restore -U $POSTGRES_USER -d $POSTGRES_DB --clean --if-exists --no-owner < banco.dump`.
4. Restaurar a mídia: `docker compose run --rm -T rcc-portal tar -xzf - -C /data/media < midia.tgz`.
5. Subir o portal com o **worker parado** e seguir os passos pós-restauração de `07-operacao.md`. Depois disso, subir o worker.

## Evidência (15/11/2026)

- **Primeira cópia:**
  - 133 KB e 11 s de ponta a ponta;
  - restaurada num PostgreSQL 17 descartável, com as mesmas 2 linhas de auditoria do manifesto;
  - o pacote não tem texto em claro e não abre sem a chave.
- **Falha simulada (chave ausente):** o script saiu com código 1 e registrou o erro na VPS.
- **Retenção simulada:** de 60 cópias falsas espalhadas por 15 meses, ficaram 33 (as 30 mais recentes e mais 3 meses antigos, cobrindo 12 meses no total).
- **Ainda não testado:** a restauração completa numa VPS nova (passos 1 a 5). Fazer antes da produção.
