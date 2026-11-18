# Pendências do lançamento institucional (18/11/2026)

Confronto com `04-matriz-requisitos.md`, `09-integracoes.md`, `07-operacao.md`, `17-alertas-telegram.md` e `18-backup-externo.md`. **O domínio fica fora deste escopo.** Os testes rodaram no desenvolvimento local (PC) e em ambiente descartável; a homologação foi atualizada depois.

**Responsáveis (sugeridos):**
- **UP:** UP Tecnologia (equipe técnica do portal).
- **Coord.:** coordenação da RCC Arquidiocese de Cuiabá.
- **Estadual:** coordenação estadual (RCCMT).
- **Entidade:** a pessoa jurídica responsável (CNPJ).

## 1. Marca e identidade visual

| Item | Implementado | Ação restante | Responsável | Evidência de aceite |
|---|---|---|---|---|
| Assinatura oficial "Renovação Carismática Católica + Arquidiocese de Cuiabá" | **Montada conforme o manual** (ADR-015): vetores oficiais com o nome de instância nas regras das p. 23–24, em placa branca no cabeçalho e painel branco na capa. O arquivo oficial da instância ainda não foi recebido. | Pedir à coordenação estadual o **arquivo digital da assinatura com o nome da instância** (manual, p. 23: "as dioceses possuem o arquivo digital com seu nome próprio"), nas versões **horizontal e vertical**, em vetor (SVG, PDF ou AI) e com as cores do manual (p. 12–13). Ao receber: trocar o componente `Wordmark` pela arte e conferir a redução mínima digital e a margem da barra do "i" (p. 18–20). | Coord. → Estadual; depois UP | Assinatura aplicada sem alteração, comparada com o arquivo recebido |
| PNG existente `rcc-logo-completo.png` | Conferido: é a **assinatura genérica em linha única vertical, sem instância**, em raster (702×302), enviada pelo coordenador. **Não é usada no site.** | Nenhuma. Pode virar referência de impressão se a coordenação confirmar a origem. | Coord. | — |
| Favicon e ícone do celular (só o símbolo) | Mantidos: o tamanho de 16–48 px não comporta a assinatura | **Decidir** se o símbolo isolado pode ser ícone. O manual (p. 5–11) preserva a unidade símbolo + logotipo e não trata de ícones. | Coord. | Decisão registrada |
| Autorização de uso das marcas (RCC, Arquidiocese, RCCMT, RCC Brasil no rodapé) | — | Pedir por escrito | Coord. | Documento arquivado |

## 2. E-mail

| Item | Implementado | Ação restante | Responsável | Evidência |
|---|---|---|---|---|
| Confirmação de inscrição | **Validada em caixa de TESTE LOCAL** (Mailpit) em 18/11/2026: inscrição gratuita pelo portal, worker enviou "Inscrição confirmada — Retiro de Jovens (demo)" com o link do comprovante | Repetir com o **SMTP institucional** e uma caixa externa (Gmail ou Outlook), conferindo a pasta de spam | UP + Coord. (conta do provedor) | E-mail recebido em caixa externa |
| Recuperação de senha | **Validada em caixa de teste local**: pedido em `/entrar/esqueci`; e-mail "Redefinição de senha" com validade de 30 minutos; o link abre "Criar nova senha" (válido) | Mesma validação com SMTP externo; testar também um link vencido | UP | Idem |
| Provedor SMTP e domínio (SPF/DKIM/DMARC) | Código pronto (`SMTP_URL`); a homologação grava em arquivo | Escolher o provedor (sugestão anterior: Brevo). Depende do domínio, que está fora do escopo. | Coord. + UP | `docs/09` atualizado |

## 3. Google Agenda

| Item | Implementado | Ação restante | Responsável | Evidência |
|---|---|---|---|---|
| Portal como fonte da agenda e feed ICS | Mantidos: `/agenda.ics` responde `BEGIN:VCALENDAR` (conferido em 18/11/2026) | — | — | `curl /agenda.ics` |
| Criação, alteração, cancelamento e repetição sem duplicatas | Lógica testada com API simulada: 13 casos em `tests/calendar.test.ts`, entre eles o ID estável que evita duplicatas | **Não validado com o Google real:** falta a chave da conta de serviço numa **agenda institucional de teste autorizada**. Passo a passo em `docs/09` e `scripts/agenda-teste.mts`. | Coord. (conta Google institucional) → UP | `agenda-teste` com 4 OK e evento aparecendo, alterando e cancelando no Google |

## 4. Recuperação (restauração)

**Ensaio feito em 18/11/2026** em ambiente descartável no PC, com `deploy/homologacao/ensaio-restauracao.sh`.

- **Cópia usada:** a externa criptografada `rcc-hml-completo-20261118T123002Z.tar.gpg`, gerada do backup da VPS de 18/11 às 04:15 UTC.
- **O que foi restaurado:** banco (PostgreSQL 17), mídias e configuração (`.env`), com o portal na **mesma imagem** da homologação. O worker não foi ligado, para não enviar e-mails nem alertas.
- **Resultado:**

| Conferência | Resultado |
|---|---|
| Tempo até o portal responder (descriptografar, restaurar e subir) | **11 s** |
| Saúde | `{"ok":true,"db":"ok"}` |
| Contagens | 16 linhas de auditoria, 9 mídias, 12 conteúdos. **Cadeia de auditoria íntegra.** |
| Mídias | **0 arquivos faltando**; imagem servida com 200 `image/webp` |
| Login | Senha certa: 200; senha errada: 401 (conta de ensaio criada só no ambiente descartável) |
| Inscrição gratuita | Feita pelo navegador no portal restaurado e gravada como `confirmada` |
| Último dado recuperado | Auditoria de 16/11/2026 às 22:02 (horário de Cuiabá), igual à origem |

**Pendências da recuperação:**

| Item | Ação restante | Responsável | Evidência |
|---|---|---|---|
| Restauração completa numa **VPS nova** (nginx, certificado, cron) | Ensaiar antes da produção (passos em `docs/18`) | UP | Relatório com tempo |
| Conferência diária da cópia externa | O `backup-externo.log` registrou "restauração **pulada (Docker parado)**" em 17 e 18/11. Abrir o Docker Desktop junto com o Windows ou levar a conferência para o NAS. | UP | Log com "restauração ok" |
| **Monitor externo** (avisa mesmo com a VPS e o worker parados) | **Não existe.** Os alertas atuais dependem do worker. Criar um monitor externo (ex.: UptimeRobot) para o endereço da homologação, esperando **401** sem senha, e para a porta 443. Requer criar a conta: decisão e cadastro ficam com você. | UP (você cria a conta) | Alerta recebido ao parar o contêiner de teste |

## 5. Conteúdo e aceite

| Item | Situação | Ação restante | Responsável |
|---|---|---|---|
| Responsáveis (gestor, revisor doutrinal, administrador técnico e substituto, encarregado LGPD) | Pendente (`docs/01`) | Nomear | Coord. |
| Texto oficial de **Quem Somos** | Hoje é o texto de **demonstração** do seed (selo "Demonstração"). Nenhum texto foi inventado. | Escrever, revisar e publicar no painel em **Conteúdo → A RCC → Quem Somos** | Coord. (texto) + revisor |
| Fotografias com autorização de imagem | Nenhuma; a capa é tipográfica até haver foto | Enviar fotos com termo de autorização | Coord. |
| Dados institucionais | Contato, coordenação, ministérios, grupos e paróquias reais: pendentes (`docs/21`, sugestões 1 a 5) | Enviar | Coord. |
| Leitura de Quem Somos, inscrição gratuita, check-in e publicação: **teclado** | Inscrição por teclado (Tab/Enter) feita em 18/11; menu e A RCC navegáveis; Lighthouse com acessibilidade 100 nas páginas novas | Check-in e publicação por teclado no painel, com uma conta com duas etapas | UP |
| Os mesmos fluxos: **celular** | Emulação em 390 px: menu e capa sem rolagem lateral | Testar num aparelho real | Equipe RCC |
| Os mesmos fluxos: **leitor de tela** | Roteiro pronto (`docs/19-roteiro-nvda.md`) | **Exige a equipe RCC**, de preferência alguém que use NVDA | Equipe RCC |

## 6. Demais pendências documentadas

| Pendência | Necessária à 1ª publicação? | Situação |
|---|---|---|
| Assinatura oficial, Quem Somos real, contatos, responsáveis, autorização de marcas | **Sim** | Depende da coordenação |
| SMTP institucional (confirmações e senha) | **Sim**, se houver inscrições ou equipe usando "esqueci a senha" | Depende de decisão e do domínio |
| Monitor externo e ensaio em VPS nova | **Sim** (operação segura) | UP |
| Teste com leitor de tela | Recomendado antes; pode ir logo depois com o compromisso registrado | Equipe RCC |
| Google Agenda | Não (o ICS cobre) | Depende de credenciais |
| Calendário litúrgico | Não: etapa posterior; precisa de fonte autorizada (CNBB) | Decisão |
| Campanhas (banners e páginas de campanha) | Não: etapa posterior | Decisão |
| Redirecionamentos gerenciáveis no painel | Não. Os redirecionamentos atuais (`/a-rcc/<antigo>` → `/a-rcc`) estão no código. | Etapa posterior |
| Regras para **menores** nas inscrições (termo e responsável) | **Sim, se** houver evento com menores | Decisão institucional |
| **Transferência** de inscrição | Não: etapa posterior | Decisão |
| Loja e inscrições pagas | Não (desligadas) | Ver `23-plano-loja.md` |
| Domínio | Fora do escopo desta etapa | — |
