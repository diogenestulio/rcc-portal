# Integrações — estado e procedimento para concluir

| Integração | Código | Estado | Bloqueio |
|---|---|---|---|
| Google Calendar | `src/server/calendar/google.ts` | lógica validada com API simulada; cliente HTTP escrito, **nunca executado contra o Google** | conta institucional e decisão da fonte de verdade |
| Provedor de pagamento | `src/server/store/providers.ts` | contrato + simulador validados | entidade vendedora, provedor, conta recebedora |
| E-mail transacional | `scripts/worker.mts` (`sendMail`) | em dev grava `.eml`; envio real **não implementado** | escolha do provedor, domínio (SPF/DKIM/DMARC) |
| Armazenamento de objetos (S3) | — | **não iniciado** (upload validado em memória, sem tela) | provedor/bucket |
| Alertas Telegram/e-mail | worker registra em log | **não iniciado** | bot/canal institucional |

## Google Calendar — passos para ativar

**Modo padrão `cms_to_google`:**
1. Na conta Google institucional, criar uma agenda **só para eventos públicos** (ex.: “Agenda pública RCC”).
2. No Google Cloud (projeto da instituição), ativar a *Google Calendar API* e criar uma *service account*; baixar a chave JSON para o servidor (fora do repositório, permissão 600).
3. Compartilhar **essa agenda** com o e-mail da service account com “Fazer alterações nos eventos”. Sem compartilhamento, a service account não acessa a agenda.
4. `.env`: `GOOGLE_CALENDAR_MODE=cms_to_google`, `GOOGLE_CALENDAR_ID=<id da agenda>`, `GOOGLE_SERVICE_ACCOUNT_JSON_PATH=/caminho/chave.json`. Escopo usado: `calendar.events`.
5. Reiniciar o worker; publicar um evento de teste em homologação; conferir no Google; editar e cancelar; conferir de novo.
6. Só então marcar a integração como validada na matriz.

**Modo alternativo `google_to_cms`:** mesmos passos 1–3 (permissão de leitura basta), `GOOGLE_CALENDAR_MODE=google_to_cms`. Eventos chegam como *candidato* e precisam ser publicados por um responsável.

## Pagamentos — passos para ativar
1. Definir entidade vendedora (CNPJ), responsável, atendimento e políticas (`/termos`, troca, reembolso).
2. Escolher **um** provedor com checkout hospedado e Pix/cartão/boleto conforme necessidade; registrar tarifas consultadas, ambiente de testes e limites neste documento.
3. Implementar o adaptador `PaymentProvider` (criar checkout, consultar pagamento, reembolsar, verificar webhook conforme a documentação do provedor).
4. Testar em sandbox do provedor: aprovado, recusado, expirado, duplicado, fora de ordem, reembolso parcial/total, chargeback.
5. `PAYMENT_RECEIVER_ID` no `.env`; reautenticação + auditoria para alterá-lo.
6. Avaliar as obrigações PCI aplicáveis (o checkout hospedado reduz, mas não elimina).
7. Backups com recuperação pontual (RPO 15 min) antes de vender.

## E-mail transacional
Escolher provedor, configurar SPF, DKIM e DMARC no domínio, tratar devoluções/reclamações via webhook do provedor e implementar `sendMail` no worker. Até lá, recuperação de senha e confirmações **não chegam** por e-mail fora do desenvolvimento.
