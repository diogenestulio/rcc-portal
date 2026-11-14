# Integrações — estado e procedimento para concluir

| Integração | Código | Estado | Bloqueio |
|---|---|---|---|
| Google Calendar | `src/server/calendar/google.ts` | lógica validada com API simulada; cliente HTTP escrito, **nunca executado contra o Google** | conta institucional e decisão da fonte de verdade |
| Provedor de pagamento | `src/server/store/providers.ts` | contrato + simulador validados | entidade vendedora, provedor, conta recebedora |
| E-mail transacional | `src/server/mail.ts`, `src/server/mail-jobs.ts` | **implementado e testado** com SMTP real (Mailpit local); falta provedor real | escolha do provedor e **domínio próprio** (SPF/DKIM/DMARC) |
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

### O que já funciona (14/11/2026)
- Envio por **SMTP de qualquer provedor** (`SMTP_URL`), pelo worker, com nova tentativa automática.
- Mensagens: inscrição confirmada, lista de espera, vaga liberada, pagamento confirmado, **redefinição de senha** (telas `/entrar/esqueci` e `/entrar/redefinir`).
- Segurança: mesma resposta exista ou não a conta; link de 30 min, uso único; link apagado do banco logo após o envio; conta desativada não recebe; todas as sessões encerradas ao redefinir.
- Sem imagens remotas, sem rastreamento de abertura ou clique, conteúdo escapado.
- Testes: `tests/mail.test.ts` (5) + ponta a ponta com SMTP real no Mailpit local (pedido pela tela → e-mail → link → nova senha → login).
- Sem `SMTP_URL`: desenvolvimento e homologação gravam `.eml` em arquivo; **produção recusa** (o job falha e aparece como alerta).

### Provedores pesquisados em 14/11/2026 (confirmar no site oficial antes de contratar)
| Provedor | Plano gratuito | Pago (a partir de) | Observações |
|---|---|---|---|
| Brevo | 300 e-mails/dia, SMTP incluído, sem cartão; aprovação da conta | ~US$ 9/mês (Starter) | Painel em português; suporte do gratuito por e-mail (24–48 h). Fontes: [dev.to](https://dev.to/techsifted/brevo-pricing-2026-every-plan-explained-with-the-hidden-costs-4oe3), [dreamlit.ai](https://dreamlit.ai/blog/brevo-review) |
| Resend | 3.000/mês, até 100/dia | ~US$ 20/mês (50 mil) | Simples para desenvolvedores; painel em inglês. Fonte: [resend.com/blog/new-free-tier](https://resend.com/blog/new-free-tier) |
| Amazon SES | — (cobrança por uso) | ~US$ 0,10 por 1.000 e-mails | O mais barato em volume, mas exige conta AWS, sair do “sandbox” e mais configuração; AWS criou planos agrupados em 07/2026. Fonte: [cloudburn.io](https://cloudburn.io/blog/amazon-ses-pricing) |

Volume esperado do portal: dezenas por dia (inscrições e senhas), com picos em eventos grandes. **Recomendação:** Brevo no plano gratuito (cabe com folga e tem painel em português). Se um evento passar de 300 inscrições num dia, os e-mails excedentes ficam na fila e saem no dia seguinte — ou contrata-se o plano pago naquele mês.

### Bloqueio: domínio próprio
Sem domínio próprio não é possível autenticar o remetente (SPF/DKIM/DMARC): os e-mails cairiam no spam ou seriam recusados. Enviar “em nome de” um Gmail pelo provedor **não** funciona (falha no DMARC).

### Passos para ativar (quando houver domínio, ex.: `rcccuiaba.org.br`)
1. Criar a conta no provedor com e-mail institucional (não pessoal) e ativar a verificação em duas etapas.
2. Adicionar o domínio no provedor; ele mostra os registros DNS. No painel do registro do domínio (ex.: registro.br), criar:
   - **SPF** (TXT em `@`): o valor que o provedor indicar, ex.: `v=spf1 include:<do provedor> ~all` (se já houver SPF, juntar num só).
   - **DKIM** (TXT ou CNAME com o nome que o provedor indicar).
   - **DMARC** (TXT em `_dmarc`): começar com `v=DMARC1; p=none; rua=mailto:<e-mail institucional>` e, após 2–4 semanas sem problemas, passar para `p=quarantine`.
3. Gerar as credenciais SMTP no provedor (usuário e chave) e colocar no `.env` **do servidor** (nunca no repositório):
   `SMTP_URL=smtp://<usuario>:<chave>@<host do provedor>:587` e `MAIL_FROM="RCC Arquidiocese de Cuiabá <nao-responda@<domínio>>"`. Caracteres especiais da chave precisam ser codificados (ex.: `@` → `%40`).
4. Reiniciar o worker; pedir uma redefinição de senha de teste e conferir no Gmail: “Mostrar original” deve indicar **SPF: PASS, DKIM: PASS, DMARC: PASS**.
5. Configurar no provedor o aviso de devoluções/reclamações (bounce/complaint) e revisar semanalmente no início.
