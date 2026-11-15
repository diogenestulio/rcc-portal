# Manual do Portal RCC Arquidiocese de Cuiabá

Para a coordenação e os servos que cuidam do portal. Linguagem simples. Os detalhes técnicos ficam nos documentos citados em cada seção.

> **Situação em 15/11/2026: HOMOLOGAÇÃO.** O portal está no ar só para testes, com **dados fictícios** e protegido por senha. Ainda não é o site oficial. Tudo o que for cadastrado agora serve para treinar e validar. Antes do lançamento, os dados de demonstração são apagados e o conteúdo real é cadastrado (ver seção 10).

---

## 1. Endereços e acesso

| O quê | Endereço |
|---|---|
| **Site (homologação)** | https://179-197-73-172.sslip.io:10443 |
| **Painel da equipe** | https://179-197-73-172.sslip.io:10443/entrar (depois do login, abre `/admin`) |
| Site oficial (futuro) | domínio próprio, ainda a definir (pendência institucional) |

São **duas portas** de acesso, nesta ordem:

**1ª: senha da homologação** (janela do navegador, antes de o site aparecer)
- Existe só enquanto o portal está em testes. No lançamento ela sai, e o site fica aberto ao público.
- Usuário: `homologacao`. A senha está guardada só no servidor. O administrador técnico a consulta com:
  ```powershell
  ssh helpdesk-vps "cat /root/rcc-portal-hml-acesso.txt"
  ```
- Entregue essa senha só a quem vai testar. Ela é a mesma para todos e não dá acesso ao painel.

**2ª: conta pessoal no painel** (tela "Entrar")
- Cada pessoa da equipe tem **a sua** conta: e-mail + senha + **verificação em duas etapas** (código de 6 dígitos de um aplicativo no celular). Não existe "login geral" compartilhado.
- **A primeira conta** (gestor institucional) é criada pelo administrador técnico, que digita a senha no próprio terminal. A senha não aparece na tela nem fica gravada em lugar nenhum:
  ```powershell
  ssh -t helpdesk-vps "/opt/rcc-portal-hml/conta.sh email@exemplo.org 'Nome Completo' gestor_institucional,editor,gestor_eventos"
  ```
  O mesmo comando serve para **trocar a senha** de alguém que perdeu o acesso.
- **As demais contas** são criadas pelo gestor no painel (seção 4). O painel gera uma senha provisória.

### Primeiro acesso ao painel
1. Abra o endereço do painel e entre com e-mail e senha.
2. O portal pede para configurar a **verificação em duas etapas**:
   1. instale no celular um aplicativo autenticador (Google Authenticator, Microsoft Authenticator ou Aegis);
   2. escaneie o QR Code mostrado na tela;
   3. digite o código de 6 dígitos que o aplicativo mostrar.
3. **Guarde os códigos de recuperação** que aparecem, impressos ou num cofre de senhas. Cada um funciona uma vez, se você perder o celular.
4. Se a conta foi criada com senha provisória, o portal pede para criar uma senha nova (mínimo de 12 caracteres).
5. Nos próximos acessos, use senha + código do aplicativo.

**Esqueceu a senha?** Peça ao gestor **Gerar senha provisória**. "Esqueci minha senha" por e-mail só funciona depois que o envio de e-mails for ativado.
**Perdeu o celular e os códigos?** Peça ao gestor **Zerar verificação em duas etapas**.

---

## 2. Quem faz o quê (papéis)

Cada pessoa recebe **só os papéis de que precisa**, e o painel mostra apenas o que o papel permite.

| Papel | Para quem | O que pode fazer |
|---|---|---|
| **Gestor institucional** | coordenação | contas e papéis da equipe; aprovar notícias e textos institucionais; publicar; grupos, eventos e auditoria |
| **Editor** | equipe de comunicação | escrever, enviar para revisão e publicar o que foi aprovado; enviar fotos |
| **Revisor** | revisor designado pela coordenação | aprovar textos de **doutrina, orientação pastoral, devoção e testemunho** (só ele) e também notícias |
| **Gestor de eventos** | equipe de eventos | criar e publicar eventos, ver inscritos, exportar lista, check-in |
| **Responsável local** | coordenador de grupo ou ministério | editar **o seu** grupo ou ministério e os eventos dele, check-in |
| **Intercessor** | ministério de intercessão | ler os pedidos de oração (e mais nada) |
| **Operador da loja** | quando a loja for ligada | catálogo, estoque, pedidos e reembolsos |
| **Administrador técnico** | equipe de TI | contas, integrações e auditoria. **Não** lê pedidos de oração nem publica conteúdo |

Regras que o portal garante:
- **Ninguém aprova o próprio texto.**
- Ninguém altera os próprios papéis.
- Sempre fica ao menos um gestor.
- Ações sensíveis (contas, papéis, exportar inscritos) exigem ter entrado nos últimos 10 minutos.
- Tudo fica registrado na **auditoria**.

Matriz completa: `docs/05-permissoes.md`.

---

## 3. Como o site é alimentado

Todo o conteúdo do site é cadastrado **pelo painel**. Não é preciso programar nem mexer no servidor.

| Parte do site | Onde se cadastra no painel | Quem |
|---|---|---|
| **Página inicial** | é montada sozinha: próximos eventos publicados, últimas notícias e atalhos | — |
| **A RCC** (identidade, história, coordenação, documentos) | **Conteúdo** → tipo *Página*: cada página publicada vira um item em `/a-rcc/endereço-curto` | editor + aprovação |
| **Contato**, **Multimídia**, **Colaborar**, **Privacidade** | textos fixos, hoje com aviso de "pendente"; **mudam pela equipe técnica** quando a coordenação enviar os dados (seção 11) | equipe técnica |
| **Notícias** | **Conteúdo** → tipo *Notícia* | editor + aprovação |
| **Formação** | **Conteúdo** → tipo *Formação* (natureza doutrina, orientação pastoral ou devoção) | editor + **revisor** |
| **Comunicados** | **Conteúdo** → tipo *Comunicado* | editor + gestor |
| **Grupos de Oração** (lista, página do grupo e mapa) | **Grupos** | gestor ou responsável local |
| **Agenda** (lista, mês, página do evento, arquivo de calendário e, depois, a Google Agenda) | **Eventos** | gestor de eventos ou responsável local |
| **Inscrições em eventos** | dentro do evento: marcar "recebe inscrições" | gestor de eventos |
| **Fotos e documentos** | **Mídia** | editor, gestor e gestor de eventos |
| **Pedido de oração** (formulário do site) | chega em **Oração** | intercessor |
| **Ministérios** | lista exibida no site; **edição pelo painel ainda não existe** (seção 11) | equipe técnica |
| **Loja** | **Loja** (desligada até a decisão institucional) | operador da loja |
| Nome, endereço e redes sociais da instituição | configuração técnica (`src/config/instituicao.ts`) | equipe técnica |

### Caminho de um texto até o site
```
Rascunho → Enviar para revisão → Aprovado (pelo revisor ou gestor) → Publicar (ou agendar) → No ar
                    ↑ devolvido com observação ←┘
```
Uma correção num texto publicado cria uma **nova versão**. A versão antiga continua no ar até a nova ser aprovada.

---

## 4. Usuários e papéis (gestor institucional)

1. **Usuários e papéis → Nova conta**: informe nome e e-mail. O portal mostra uma **senha provisória uma única vez**. Entregue pessoalmente ou por canal seguro; nunca em grupo de WhatsApp.
2. Abra a conta e **conceda os papéis**. "Responsável local" e "Gestor de eventos" podem ser limitados a um grupo, região ou ministério; os outros valem para tudo.
3. Na troca de equipe, use **Desativar conta**. O acesso acaba na hora e o histórico continua.
4. **Gerar senha provisória** invalida a senha antiga. **Zerar verificação em duas etapas** faz a pessoa configurar de novo.
5. Esta área exige ter entrado há menos de 10 minutos. Se pedir, entre de novo.

## 5. Conteúdo: notícias, formação e páginas

1. **Conteúdo → Novo conteúdo.**
   1. Escolha o **tipo**: página, notícia, formação ou comunicado.
   2. Escolha um **endereço curto**, sem acentos nem espaços (ex.: `retiro-de-jovens-2027`).
2. Escolha a **natureza**: notícia, institucional, doutrina, orientação pastoral, devoção ou testemunho. As quatro últimas só vão ao ar com o **revisor**.
3. Escreva o texto. A formatação é simples:
   - parágrafos separados por uma linha em branco;
   - `## Subtítulo` numa linha;
   - `**negrito**`;
   - `- item` para listas.
4. Indique as **fontes** (documento, livro, site) e os **direitos** (quem fez a foto, de quem é o texto).
5. **Salvar como rascunho → Enviar para revisão.**
6. O revisor aprova ou devolve com observação.
7. Aprovado, clique em **Publicar** (agora) ou agende data e hora.
8. **Arquivar** tira do ar sem apagar. Só o gestor pode arquivar.

**Não publique:**
- citações sem fonte conferida;
- promessas de cura;
- revelações privadas apresentadas como verdade de fé;
- fotos sem autorização;
- dados pessoais de terceiros;
- textos gerados por inteligência artificial sem revisão humana.

## 6. Mídia: fotos e documentos

1. **Mídia → Enviar arquivo.** Aceita fotos JPEG, PNG ou WebP de até 8 MB e PDF de até 9 MB. As fotos são reduzidas e perdem a localização GPS automaticamente.
2. Escreva a **descrição da imagem** (o que ela mostra, para quem não enxerga) ou marque "só decorativa". Informe o **crédito**.
3. Confirme que há **autorização de imagem** do autor e das pessoas que aparecem. No caso de menores, a autorização é dos responsáveis.
4. Para usar num texto:
   1. clique em **Copiar código para o texto**;
   2. cole numa linha sozinha do editor;
   3. se quiser uma legenda, escreva na linha de baixo, começando com "— ".
5. **Arquivo privado** (atas, listas internas) não aparece no site. Para compartilhar com a equipe, use **Gerar link (1 h)**; o link expira sozinho.
6. Só dá para **excluir** um arquivo que não esteja em uso em nenhuma página.

## 7. Grupos de Oração

- **Grupos → nome do grupo:** ajuste dia, horário, local, paróquia e acessibilidade do local.
- **Contato do coordenador:**
  - é **privado**;
  - o telefone só aparece no site se o coordenador autorizar e você marcar a caixa.
- **Localização no mapa** (opcional):
  - use a latitude e a longitude do **local público** do encontro (igreja ou salão), **nunca de uma casa**;
  - para obter os números, clique com o botão direito no local, no Google Maps ou no OpenStreetMap, e copie os dois números.
- **Confirmar dados:** clique a cada contato com o grupo. Grupos sem confirmação há 180 dias aparecem no site como "Informação a confirmar".
- **Publicar ou despublicar** um grupo é tarefa do gestor.
- **Sugestões de visitantes** chegam em **Grupos → Sugestões**. Nada muda sozinho:
  1. confira a sugestão;
  2. edite o grupo, se for o caso;
  3. marque a sugestão como aplicada ou rejeitada.
- **Grupo novo:** por enquanto, cadastrado pela equipe técnica (seção 11).

## 8. Eventos e inscrições

1. **Eventos → Novo evento.** Informe data e hora (horário de Cuiabá) ou marque "dia inteiro". Para encontros que se repetem (ex.: toda terça), escolha a repetição.
2. Para receber inscrições, marque a caixa e defina vagas, prazo e lista de espera.
3. O evento nasce como **rascunho**. Confira e clique em **Publicar no portal**. Com a Google Agenda ligada, ele aparece lá em até 1 minuto.
4. **Adiar ou cancelar:** mude a situação, **não apague**. O site, o arquivo de calendário e a Google Agenda recebem a mudança.
5. **Inscritos:** abra o evento para ver a lista. **Exportar** a lista fica registrado na auditoria. Não repasse a planilha em grupos de mensagem.
6. **Check-in no dia:** abra o evento → **Check-in** → digite ou cole o código do comprovante. Cada comprovante vale uma vez.
7. **Lista de espera:** quando alguém cancela, a próxima pessoa da fila recebe a vaga.

## 9. Pedidos de oração (intercessores)

- Só quem tem o papel **Intercessor** vê os pedidos. Nem o administrador técnico vê.
- Marque cada pedido como **em oração** ou **concluído**.
- Os pedidos **somem sozinhos após 60 dias**.
- Não copie, não fotografe e não comente nomes fora da equipe de intercessão.

## 10. Rotina e procedimentos

**A cada semana**
- **Editor:** publicar as notícias da semana e conferir a agenda dos próximos 30 dias.
- **Gestor de eventos:** conferir vagas e inscrições dos eventos abertos.
- **Gestor:** responder às sugestões de grupos pendentes.
- **Intercessores:** acompanhar os pedidos novos.

**A cada mês**
- **Gestor:**
  - revisar quem tem acesso (Usuários e papéis) e desativar quem saiu;
  - conferir a **Auditoria** em busca de algo estranho.
- **Responsáveis locais:** clicar em **Confirmar dados** nos grupos visitados.

**A cada trimestre** (equipe técnica)
- Testar a restauração completa do backup (`docs/18-backup-externo.md`).
- Conferir se a chave de guarda do backup continua acessível.

**Antes do lançamento oficial**
1. Definir o domínio e os responsáveis (gestor, revisor, administrador técnico, encarregado LGPD), conforme `docs/01-pendencias-bloqueantes.md`.
2. Obter a autorização de uso do brasão e a versão vetorial oficial.
3. Ativar o envio de e-mails (provedor) e a Google Agenda institucional.
4. Fazer o teste com leitor de tela (`docs/19-roteiro-nvda.md`).
5. **Apagar os dados de demonstração** e cadastrar o conteúdo real:
   1. páginas da seção A RCC; dados de Contato e Privacidade (equipe técnica);
   2. grupos;
   3. próximos eventos;
   4. três ou mais notícias.
6. Retirar a senha da homologação e publicar no domínio oficial.

## 11. Limitações atuais (o painel ainda não faz)

- **Cadastrar grupo novo** e **editar ministérios**. Hoje só a equipe técnica faz isso. Está previsto acrescentar ao painel.
- **Contato, Multimídia, Colaborar e Privacidade** são textos fixos. A coordenação envia os dados (canais oficiais, vídeos, política aprovada) e a equipe técnica publica.
- **E-mails automáticos** (confirmação de inscrição, "esqueci minha senha") ficam gravados no servidor e **não chegam** até ativar o provedor de e-mail.
- **Google Agenda:** pronta, aguardando a chave da conta institucional (`docs/09-integracoes.md`).
- **Loja e inscrições pagas:** desligadas por decisão institucional.

## 12. Problemas comuns

| Situação | O que fazer |
|---|---|
| O navegador pede usuário e senha antes de abrir o site | É a senha da homologação (seção 1). Usuário `homologacao`. |
| "Código inválido" na verificação em duas etapas | Confira se a hora do celular está automática. Use o código mais novo do aplicativo. |
| A tela de usuários pede para entrar de novo | Normal: ações sensíveis exigem login recente (10 min). |
| O texto não aparece no site | Veja a situação: precisa estar **Publicado**, e não só Aprovado ou Agendado para o futuro. |
| Não aparece o botão de aprovar | Você não pode aprovar o próprio texto, ou o seu papel não aprova essa natureza. |
| A foto não pode ser excluída | Ela está em uso num texto. Retire do texto primeiro. |
| Chegou um alerta 🔴 no Telegram | Avise a equipe técnica. O alerta diz o que falhou e o ✅ avisa quando volta ao normal (`docs/17-alertas-telegram.md`). |

## 13. Para a equipe técnica

| Assunto | Documento |
|---|---|
| Implantar, voltar versão, logs | `docs/07-operacao.md` · comando `bash deploy/homologacao/deploy.sh` (no PC) |
| Backup na VPS e cópia externa criptografada no PC | `docs/18-backup-externo.md` |
| Alertas no Telegram | `docs/17-alertas-telegram.md` |
| Google Agenda, pagamentos, e-mail | `docs/09-integracoes.md` |
| Incidentes e recuperação | `docs/08-runbooks.md` |
| Segurança e LGPD | `docs/11-lgpd-seguranca.md` |
| Acessibilidade | `docs/16-acessibilidade.md` e `docs/19-roteiro-nvda.md` |
| Cores e brasão | `docs/10-design-system.md` |

## Ambiente de demonstração

Itens com o selo **Demonstração** são fictícios: 7 grupos, 4 eventos e 5 conteúdos de exemplo. Servem para treinar e são apagados antes do lançamento.
