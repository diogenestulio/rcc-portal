# Runbooks

Cada runbook: **sinal → primeiros 15 minutos → correção → depois**. Responsáveis a definir (`docs/01-pendencias-bloqueantes.md`).

## 1. Portal fora do ar
- **Sinal:** `/api/health` ≠ 200 ou sem resposta.
- **15 min:** `systemctl status` (app e worker) · espaço em disco · `pg_isready` · últimos logs do proxy.
- **Correção:** reiniciar app; se o banco caiu, reiniciar PostgreSQL e conferir disco; se foi deploy, voltar a versão anterior (ver `07-operacao.md`).
- **Depois:** registrar horário de início/fim e causa.

## 2. Fila de jobs atrasada ou com mortos
- **Sinal:** painel “Fila de tarefas” ou `/api/health` com `jobsAtrasados`/`jobsMortos` > 0.
- **Ação:** `select type, last_error, attempts from job where status in ('morto','pendente') order by run_at limit 50;`. Corrigir a causa (SMTP, Google, provedor). Reprocessar: `update job set status='pendente', attempts=0, run_at=now() where id = '…';` (um por vez, conferindo se o efeito não é duplicável).

## 3. Agenda Google atrasada
- **Sinal:** aviso no painel e na agenda (> 15 min sem sucesso).
- **Ação:** `select * from integration_state where key='google_calendar_import';` → `last_error`. Credencial revogada → ver runbook 4. Erro 410 é tratado sozinho (ressincronização). O site mantém o último conteúdo válido.

## 4. Credencial comprometida (senha da equipe, chave de API, conta Google, provedor)
1. Revogar imediatamente no serviço de origem (provedor/Google) e gerar nova.
2. Trocar no `.env` do servidor e reiniciar app e worker.
3. Senha de usuário: redefinir e revogar sessões (`delete from session where user_id = '…';`).
4. `BETTER_AUTH_SECRET` vazado: trocar invalida todas as sessões — avisar a equipe.
5. Conferir auditoria do período (`/admin/auditoria`) e registrar o incidente.

## 5. Incidente de dados pessoais
1. Conter (desativar a rota/usuário envolvido).
2. Preservar evidências (auditoria, logs) — não apagar.
3. Acionar o encarregado de dados e a coordenação; avaliar comunicação à ANPD e aos titulares conforme a LGPD (prazo e critérios a confirmar juridicamente).
4. Relatório: o que, quando, quem, quantos titulares, medidas tomadas.

## 6. Falha do provedor de pagamento
- Webhooks param → a conciliação de 15 min reconsulta pagamentos recentes.
- Pagamento aprovado depois de a reserva expirar → `exception_case` (“pagamento_tardio_…”): decidir vaga/estoque extra ou reembolso; **não prometer entrega inexistente**.
- Divergência de valor/recebedor → `pagamento_divergente`: não liberar nada; contatar o provedor.

## 7. Recuperação (restauração)
Seguir `07-operacao.md` › “Teste de restauração”, com o worker parado até a reconciliação.

## 8. Cadeia de auditoria inconsistente
- **Sinal:** `/admin/auditoria` mostra “Inconsistência na cadeia”.
- **Ação:** tratar como possível adulteração: restringir acesso ao banco, comparar com o backup mais recente (`verify-audit.mts` no banco restaurado) e registrar incidente.
