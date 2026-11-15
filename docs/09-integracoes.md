# Integrações — estado e procedimento para concluir

| Integração | Código | Estado | Bloqueio |
|---|---|---|---|
| Google Calendar | `src/server/calendar/google.ts`, `scripts/agenda-teste.mts` | lógica validada com API simulada; cliente HTTP escrito, **nunca executado contra o Google**; homologação pronta para receber a chave (15/11/2026) | conta Google **institucional** (decidido em 15/11/2026) e a chave da conta de serviço |
| Provedor de pagamento | `src/server/store/providers.ts` | contrato + simulador validados | entidade vendedora, provedor, conta recebedora |
| E-mail transacional | `src/server/mail.ts`, `src/server/mail-jobs.ts` | **implementado e testado** com SMTP real (Mailpit local); falta provedor real | escolha do provedor e **domínio próprio** (SPF/DKIM/DMARC) |
| Armazenamento de objetos (S3) | — | **não iniciado** (upload validado em memória, sem tela) | provedor/bucket |
| Alertas Telegram/e-mail | `src/server/alerts.ts` | Telegram **em uso** na homologação (`17-alertas-telegram.md`); e-mail depende do SMTP | provedor SMTP |

## Google Calendar — passos para ativar

**Decisão (10/11 e 15/11/2026):** o portal é a fonte de verdade (`cms_to_google`). O Google recebe uma **cópia** dos eventos **publicados**, numa agenda própria da **conta institucional da RCC**. Quem edita é sempre o portal; uma alteração feita direto no Google é sobrescrita na próxima edição.

### Parte 1: na conta Google institucional (navegador, ~15 min)

1. **Criar a agenda pública**
   1. Entre em `calendar.google.com` com a conta institucional.
   2. À esquerda, em **Outras agendas**, clique em **+** → **Criar nova agenda**.
   3. Nome: “Agenda RCC Arquidiocese de Cuiabá”. Fuso horário: **(GMT-04:00) Cuiabá**. Clique em **Criar agenda**.
2. **Criar o projeto e ativar a API**
   1. Entre em `console.cloud.google.com` com a mesma conta.
   2. No topo, clique no seletor de projeto → **Novo projeto**. Nome: “portal-rcc”. Clique em **Criar** e selecione o projeto.
   3. Menu ☰ → **APIs e serviços** → **Biblioteca** → busque “Google Calendar API” → **Ativar**.
3. **Criar a conta de serviço (o “robô” do portal)**
   1. Menu ☰ → **IAM e administrador** → **Contas de serviço** → **Criar conta de serviço**.
   2. Nome: “portal-agenda”. Clique em **Criar e continuar**. **Não** dê nenhum papel (pule) e clique em **Concluído**.
   3. Copie o **e-mail** da conta criada (termina em `@portal-rcc….iam.gserviceaccount.com`).
   4. Clique na conta → aba **Chaves** → **Adicionar chave** → **Criar nova chave** → **JSON** → **Criar**. Um arquivo `.json` é baixado.
   5. **Esse arquivo é uma senha.** Não mande por WhatsApp ou e-mail e não coloque no Drive nem no repositório.
   6. Se aparecer “A criação de chaves de conta de serviço está desativada” (política da organização, comum em Google Workspace novo): um administrador do Workspace precisa liberar a política `iam.disableServiceAccountKeyCreation` **só neste projeto**. Avise a equipe técnica.
4. **Compartilhar a agenda com o robô**
   1. Volte ao `calendar.google.com` → passe o mouse na agenda nova → ⋮ → **Configurações e compartilhamento**.
   2. Em **Compartilhar com pessoas e grupos específicos** → **Adicionar pessoas** → cole o e-mail da conta de serviço → permissão **“Fazer alterações nos eventos”** → **Enviar**.
   3. Na mesma página, em **Integrar agenda**, copie o **ID da agenda** (algo como `abc123…@group.calendar.google.com`).
   4. (Opcional, para o público ver no Google) Em **Permissões de acesso a eventos**, marque **Disponibilizar publicamente**.

### Parte 2: no PC, enviar a chave para a VPS (PowerShell)

Troque `C:\caminho\da\chave.json` pelo arquivo baixado.

```powershell
scp "C:\caminho\da\chave.json" helpdesk-vps:/opt/rcc-portal-hml/segredos/google-agenda.json
ssh helpdesk-vps "chown 100:101 /opt/rcc-portal-hml/segredos/google-agenda.json && chmod 400 /opt/rcc-portal-hml/segredos/google-agenda.json"
```

Depois **apague o arquivo `.json` da pasta Downloads** (a cópia que vale fica só na VPS; se perder, cria-se outra chave).

### Parte 3: configurar e testar (PowerShell)

1. Edite o `.env` da homologação e preencha `GOOGLE_CALENDAR_ID=` com o ID da agenda. A linha `GOOGLE_SERVICE_ACCOUNT_JSON_PATH=/run/segredos/google-agenda.json` já deve existir; se não existir, acrescente. **Cada variável numa linha própria.**
   ```powershell
   ssh -t helpdesk-vps "cd /opt/rcc-portal-hml && nano .env"
   ```
2. Reinicie e teste o acesso. O teste cria um evento “[TESTE]” para amanhã, altera e cancela.
   ```powershell
   ssh helpdesk-vps "cd /opt/rcc-portal-hml && docker compose up -d rcc-portal worker && docker compose exec -T worker node scripts/agenda-teste.mjs"
   ```
   O resultado esperado são quatro linhas `OK` e “Tudo certo”. Em caso de `FALHA`, a própria mensagem diz o que conferir.
3. Ligue a sincronização: no `.env`, troque para `GOOGLE_CALENDAR_MODE=cms_to_google` e reinicie. Em seguida, envie todos os eventos já publicados.
   ```powershell
   ssh -t helpdesk-vps "cd /opt/rcc-portal-hml && nano .env"
   ssh helpdesk-vps "cd /opt/rcc-portal-hml && docker compose up -d rcc-portal worker && docker compose exec -T worker node scripts/agenda-teste.mjs --todos"
   ```
4. Faça o teste de ponta a ponta no painel:
   1. publique um evento e confira se aparece no Google em até 1 min;
   2. edite o horário e confira de novo;
   3. cancele ou despublique e confira se sumiu.
   Se houver falha, ela aparece no Telegram como “tarefas que falharam (gcal.projetar)”.
5. Marque a integração como validada na matriz (linha Google Calendar).

**O que vai para o Google:** só título, data e hora, local e resumo do evento publicado, com o link “Detalhes e inscrições”. **Nunca** inscritos, e-mails ou notas internas.

**Trocar ou revogar a chave:** no Google Cloud → conta de serviço → Chaves → excluir a antiga e criar outra. Repita as partes 2 e 3, passo 2.

**Modo alternativo `google_to_cms`** (não escolhido): mesmos passos (leitura basta), com `GOOGLE_CALENDAR_MODE=google_to_cms`. Os eventos chegam como *candidato* e precisam ser publicados por um responsável.

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

## Mapa (OpenStreetMap)
Os blocos do mapa vêm de `tile.openstreetmap.org`, serviço comunitário sem garantia de disponibilidade e com política de uso que proíbe uso intenso (exige crédito visível, que o portal mostra). Para o volume de um portal diocesano é adequado; se o tráfego crescer muito, trocar por um provedor de blocos contratado (mudar a URL em `src/components/site/GroupMap.tsx` e a regra `img-src` em `src/proxy.ts`). Se o mapa ficar fora do ar, a lista de grupos continua funcionando.
