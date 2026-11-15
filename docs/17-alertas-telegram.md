# Alertas operacionais no Telegram

O **worker** verifica o sistema a cada minuto e avisa um chat do Telegram quando algo dá errado.

## O que é verificado

| Chave | Quando alerta | Frequência |
|---|---|---|
| `banco` | o worker não consegue consultar o PostgreSQL | 1 min |
| `portal` | `/api/health` interno não responde `ok: true` | 1 min |
| `publico` | endereço público (pelo nginx) sem resposta ou com erro 5xx (401 da senha da homologação conta como “no ar”) | 1 min |
| `fila.atrasada` | tarefas pendentes há mais de 15 min (e-mails, sincronizações) | 1 min |
| `fila.morta` | tarefas que esgotaram as tentativas nos últimos 7 dias | 1 min |
| `backup` | a última execução do `backup.sh` falhou, ou não há backup bem-sucedido há mais de 26 h | 1 min |
| `backup.externo` | a última cópia externa (PC/NAS) falhou, ou não há cópia há mais de 50 h (`BACKUP_EXTERNO_MAX_H`) — ver `18-backup-externo.md` | 1 min |
| `auditoria` | a cadeia de hash da auditoria não confere | 1 h |
| exceção operacional | pagamento tardio, divergência de valor etc. (só o tipo; detalhe no painel) | na hora |

**Regras de envio:** problema novo, confirmado em duas verificações seguidas (evita alarme falso enquanto o portal reinicia numa implantação) → 🔴; se continuar, lembrete a cada 6 h (`ALERT_REPEAT_HOURS`); quando volta ao normal → ✅ com a duração. Se o Telegram estiver fora, o aviso é tentado de novo no minuto seguinte. Reiniciar o worker reenvia uma vez os alertas ainda ativos.

**Privacidade:** as mensagens têm só tipos de tarefa, contagens e horários. Nunca nomes, e-mails, textos de oração, tokens ou conteúdo de pedidos.

## Configurar (uma vez)

1. No Telegram, fale com **@BotFather** → `/newbot` → escolha nome e usuário. Ele devolve o **token** (`123456:ABC…`). Pode reaproveitar um bot que já exista.
2. Crie um grupo (ex.: “RCC Portal — Alertas”), adicione o bot e mande qualquer mensagem no grupo.
3. Descubra o **ID do chat**: abra `https://api.telegram.org/bot<TOKEN>/getUpdates` no navegador e procure `"chat":{"id":-100…`. Grupos têm ID negativo.
4. Na VPS, edite o `.env` da homologação (o token **não** passa pelo PC nem pelo git):
   ```
   ssh helpdesk-vps
   cd /opt/rcc-portal-hml
   nano .env          # preencher TELEGRAM_BOT_TOKEN= e TELEGRAM_CHAT_ID=
   docker compose up -d worker
   docker compose exec worker node scripts/alerta-teste.mjs
   ```
   A última linha manda uma mensagem de teste ao grupo.

Sem token e chat configurados, os alertas aparecem só no log: `docker compose logs worker | grep alerta`.

## Rede

O worker está em duas redes: `interna` (sem internet, com o banco e o portal) e `saida`, uma rede **própria** do projeto, usada só para sair para a internet (Telegram e, no futuro, SMTP). O worker **não** entra na rede do HelpDesk (ver incidente de 10/11/2026).

## Limitações

- Se o **próprio worker** ou a **VPS inteira** caírem, ninguém avisa. Para isso é preciso um monitor externo (ex.: UptimeRobot ou o monitoramento da VPS).
- O estado dos alertas fica na memória do worker. Com mais de um worker, os avisos seriam duplicados. A homologação tem um só.
- Alertas por e-mail (`ALERT_EMAIL`) ainda não estão ligados. Dependem do provedor SMTP.
