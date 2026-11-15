# Roteiro de teste com leitor de tela (NVDA)

**Objetivo:** confirmar que uma pessoa que **não enxerga a tela** consegue usar as tarefas principais do portal. O teste automático (axe-core, ver `16-acessibilidade.md`) não encontrou violações, mas só uma pessoa usando o leitor de tela descobre se a experiência faz sentido.

**Onde:** homologação, `https://179-197-73-172.sslip.io:10443`. A senha de acesso da homologação é digitada uma vez, numa janela do navegador e não do site. Peça ajuda a alguém que enxerga só nesse passo.

**Tempo:** de 1 h 30 a 2 h. Pode ser dividido em dois dias (parte A: site público; parte B: painel).

**Quem testa:** o ideal é uma pessoa que **já usa NVDA no dia a dia**. Se for alguém da equipe aprendendo agora, o teste vale, mas registre "testador iniciante" na ficha.

---

## 1. Preparação (uma vez)

1. Instale o **NVDA**, que é gratuito, a partir de `nvaccess.org` (Download). Versão usada no teste: anote na ficha.
2. Use o **Firefox** ou o **Chrome** atualizado. Anote qual.
3. Feche outras abas e janelas.
4. Abra o NVDA (Ctrl + Alt + N). Ele começa a falar.
5. Teclas essenciais. "NVDA" é a tecla **Insert** ou o **Caps Lock**, conforme a configuração.

| Tecla | O que faz |
|---|---|
| Ctrl | cala a fala na hora |
| ↓ / ↑ | lê a próxima / anterior linha |
| Tab / Shift + Tab | próximo / anterior item clicável (link, botão, campo) |
| H / Shift + H | próximo / anterior título |
| 1, 2, 3 | próximo título de nível 1, 2, 3 |
| D | próxima região (cabeçalho, navegação, conteúdo, rodapé) |
| K | próximo link |
| F | próximo campo de formulário |
| B | próximo botão |
| L / I | próxima lista / item de lista |
| NVDA + F7 | **lista de elementos**: títulos, links e regiões da página, para escolher |
| NVDA + Espaço | alterna entre modo de navegação e modo de foco (para digitar) |
| Enter / Espaço | ativa link ou botão |
| NVDA + T | lê o título da janela (aba) |

> **Dica:** ao entrar num campo de texto com Tab, o NVDA muda sozinho para o modo de foco (um som de "clique"). Para voltar a navegar com H, D e K, aperte Esc.

---

## 2. Como registrar

Para cada passo, marque um destes resultados:
- **OK:** funcionou e o que o NVDA falou fez sentido.
- **Confuso:** funcionou, mas a fala estava estranha, repetida ou faltou informação.
- **Bloqueio:** não foi possível concluir sem ajuda de alguém que enxerga.

Anote **o que o NVDA falou**, do jeito que ouviu, quando algo não estiver certo. Isso ajuda a corrigir. Use a ficha do fim do documento.

---

## Parte A: site público

### A1. Primeiras impressões (página inicial)
1. Abra o endereço da homologação e aperte **NVDA + T**.
   **Esperado:** o título da aba com o nome da instituição.
2. Aperte **Tab** uma vez.
   **Esperado:** "Pular para o conteúdo, link". Aperte Enter: a leitura continua no início do conteúdo, e não no menu.
3. Volte ao topo (Ctrl + Home) e aperte **D** várias vezes.
   **Esperado:** regiões com nome, como "banner", "navegação", "principal" e "informações de conteúdo"/rodapé, sem regiões repetidas ou sem nome.
4. Aperte **1**.
   **Esperado:** existe **um** título de nível 1, e ele descreve a página.
5. Abra a lista de elementos (**NVDA + F7**) → **Títulos**.
   **Esperado:** os títulos formam um sumário que faz sentido (nível 1, depois 2, depois 3, sem pular).
6. Aperte **K** até o logotipo.
   **Esperado:** "link, [nome da instituição], página inicial". O brasão (imagem) **não** deve ser lido como "imagem" ou "gráfico" sem nome.

### A2. Menu e navegação
1. Use **Tab** pelo menu principal.
   **Esperado:** cada item é lido como link, com o nome visível.
2. Diminua a janela até virar "celular" (ou peça ajuda) e encontre o botão **Menu**.
   **Esperado:** "Menu, botão, recolhido". Enter abre e os itens aparecem. Observe se ao abrir o NVDA avisa "expandido".
3. Abra a busca pelo cabeçalho.
   **Esperado:** o botão é lido como "Buscar no portal".

### A3. Encontrar um grupo de oração
1. Vá em **Grupos**.
2. Com **F**, encontre os filtros (cidade, dia, etc.).
   **Esperado:** cada campo tem nome falado ("Cidade, caixa de combinação", e assim por diante).
3. Escolha um filtro e aplique.
   **Esperado:** dá para saber quantos grupos foram encontrados ("N grupos encontrados"). **Observe com atenção:** isso foi falado sozinho, ou você teve que procurar? Anote.
4. Entre num grupo com **K** e Enter.
   **Esperado:** dia, horário, endereço e contato lidos em ordem lógica.
5. Na página de grupos, encontre o botão **"Mostrar mapa"**.
   **Esperado:** o texto que avisa sobre o OpenStreetMap é lido perto do botão. O mapa é **opcional**, e a lista tem as mesmas informações. Teste também **"Grupos perto de mim"**: ao permitir a localização, deve ser falada uma lista "Mais próximos de você".

### A4. Agenda e inscrição em evento
1. Vá em **Agenda**. Com **H**, percorra os eventos.
   **Esperado:** cada evento tem título, data e local compreensíveis.
2. Abra a visão **mês**.
   **Esperado:** dá para entender em que dia cai cada evento, sem depender de cores.
3. Entre num evento **com inscrição** e vá ao formulário de inscrição.
4. Aperte **Tab** pelos campos **sem preencher nada** e envie.
   **Esperado:** o NVDA **anuncia os erros** ("alerta…"), e é possível chegar a cada campo com problema e ouvir a mensagem dele.
5. Preencha corretamente e envie.
   **Esperado:** a confirmação é anunciada ou fica no início da leitura. O **comprovante** pode ser lido. O QR Code é imagem com descrição, e o código do comprovante aparece em texto.
6. Se houver o link **"Adicionar à minha agenda"** (arquivo .ics), ele é lido com nome claro.

### A5. Pedido de oração
1. Vá em **Pedido de oração**.
2. Preencha o formulário. Observe:
   - se o NVDA lê o rótulo **e a dica** de cada campo, como o limite de caracteres e o aviso de privacidade;
   - se a caixa de **consentimento** é lida inteira, e não só "caixa de seleção, não marcada".
3. Envie.
   **Esperado:** a confirmação é anunciada.

### A6. Busca
1. Busque por uma palavra comum (ex.: "retiro").
   **Esperado:** os resultados são anunciados ou estão logo no início do conteúdo. Cada resultado é um link com nome claro.
2. Busque por uma palavra sem resultado (ex.: "xyzabc").
   **Esperado:** a mensagem "nenhum resultado" é falada.

### A7. Notícias e páginas de texto
1. Abra uma notícia e use **H** e **↓** para ler.
   **Esperado:** leitura corrida, sem trechos "pulados". Imagens com descrição ou ignoradas, se forem só decorativas.
2. Encontre um **link externo**.
   **Esperado:** "(abre site externo)" é falado.

### A8. Loja (se estiver visível)
1. Abra um produto, escolha a quantidade e adicione ao carrinho.
   **Esperado:** o NVDA confirma que o item foi adicionado.
2. No **carrinho**, mude a quantidade e remova um item.
   **Esperado:** dá para saber o total atualizado.

### A9. Rodapé e acessibilidade
1. Vá ao rodapé (**D** até a última região).
   **Esperado:** os títulos "Institucional" e "Vínculos" são lidos, e os links têm nomes claros.
2. Abra **Acessibilidade**.
   **Esperado:** a página explica como pedir ajuda ou relatar problemas.

---

## Parte B: painel (equipe)

Use uma conta de teste da homologação, com dados fictícios.

### B1. Entrar com verificação em duas etapas
1. Vá em **Entrar**. Preencha e-mail e senha.
   **Esperado:** cada campo tem nome. Uma senha errada gera erro **anunciado**.
2. Na verificação em duas etapas, digite o código do aplicativo autenticador.
   **Esperado:** o campo de código é claro. Um código errado gera erro anunciado.

### B2. Orientação no painel
1. Com **D**, encontre "Menu do painel" e "principal".
2. Com **K**, percorra o menu do painel.
   **Esperado:** o item atual é indicado ("atual" ou semelhante). Anote se não for.

### B3. Criar um conteúdo (notícia) em rascunho
1. Vá em **Conteúdo → Novo**.
2. Preencha título e resumo e escreva **dois parágrafos** no campo de texto, usando **negrito** e uma **lista**, se houver barra de ferramentas.
   **Observe:** dá para saber em que campo se está? Os botões de formatação são lidos com nome? É possível digitar normalmente?
3. Salve como rascunho.
   **Esperado:** a mensagem de sucesso é anunciada.
4. Na tela do conteúdo, encontre "Fluxo e histórico".
   **Esperado:** dá para entender a situação (rascunho, em revisão, publicado).

### B4. Enviar uma imagem com descrição
1. Vá em **Mídia** e envie uma imagem.
2. **Esperado:**
   - o botão de escolher arquivo é lido;
   - existe um campo para o **texto alternativo** (descrição), com nome claro;
   - a conclusão do envio é anunciada.

### B5. Eventos e check-in
1. Abra um evento no painel e a lista de inscritos.
   **Esperado:** a tabela é lida com cabeçalhos ("Nome, coluna…"). Com Ctrl + Alt + setas é possível navegar por células.
2. Abra o **check-in** e confirme a presença de uma pessoa.
   **Esperado:** a confirmação é anunciada.

### B6. Sair
1. Encontre o botão **Sair** e use.
   **Esperado:** volta para a tela pública ou de entrada, com aviso.

---

## 3. Extras (sem leitor de tela, 15 min)

- **Zoom de 200 %** (Ctrl + +, quatro vezes): repetir A1, A3 e A4. Nada pode ficar cortado ou sobreposto, e a rolagem deve ser só vertical.
- **Só teclado, sem NVDA:** repetir A4 (inscrição) usando apenas Tab, Enter e Espaço. O contorno de foco precisa estar **sempre visível**.
- **Menos movimento:** no Windows, Configurações → Acessibilidade → Efeitos visuais → desligar "Efeitos de animação". As páginas não devem ter nenhuma animação.

---

## 4. Ficha de resultado

Copie esta tabela num documento ou planilha e preencha.

| Data | Testador | Experiência com NVDA | Versão do NVDA | Navegador e versão |
|---|---|---|---|---|
| | | diária / ocasional / iniciante | | |

| Passo | Resultado (OK / Confuso / Bloqueio) | O que o NVDA falou / observação |
|---|---|---|
| A1 Primeiras impressões | | |
| A2 Menu e navegação | | |
| A3 Grupos | | |
| A4 Agenda e inscrição | | |
| A5 Pedido de oração | | |
| A6 Busca | | |
| A7 Notícias | | |
| A8 Loja | | |
| A9 Rodapé e acessibilidade | | |
| B1 Entrar com duas etapas | | |
| B2 Orientação no painel | | |
| B3 Conteúdo em rascunho | | |
| B4 Imagem com descrição | | |
| B5 Eventos e check-in | | |
| B6 Sair | | |
| Zoom 200 % | | |
| Só teclado | | |
| Menos movimento | | |

**Depois do teste:** envie a ficha preenchida para a equipe técnica.
- Cada **Bloqueio** vira correção antes do lançamento.
- Cada **Confuso** é avaliado.
- O resultado é registrado em `16-acessibilidade.md` (seção "Limitações declaradas") e na matriz de requisitos.

## Pontos que já sabemos que merecem atenção

- **Grupos, total de resultados:** o texto "N grupos encontrados" está numa região que avisa mudanças. Mas, se o filtro recarrega a página, o NVDA pode não falar sozinho. Ver o passo A3.3.
- **Menu do celular:** a tecla Esc não fecha o menu. Ele fecha com Enter no botão "Menu".
- **Mapa:** os marcadores não recebem foco do teclado. A lista e "perto de mim" são a alternativa.
- **Editor de texto do painel:** é o ponto de maior risco do painel e merece cuidado no passo B3.
