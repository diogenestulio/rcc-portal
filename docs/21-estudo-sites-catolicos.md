# Estudo de sites católicos e da RCC (16/11/2026)

Os sites foram visitados em 16/11/2026, pelo texto das páginas iniciais. Cores e animações não puderam ser avaliadas por esse método. O objetivo é aprender com o que funciona, sem copiar textos, imagens ou identidade de ninguém.

## Sites estudados

| Site | O que tem de forte | O que evitar |
|---|---|---|
| **RCC Brasil** (rccbrasil.org.br) | <ul><li>busca de Grupo de Oração por localização, cadastro e atualização de grupos</li><li>pedido de oração</li><li>formação por tema (RCC, Igreja, Papa, espiritualidade, formação humana)</li><li>downloads em PDF (subsídios, Lectio Divina), Revista Renovação</li><li>doações e campanhas (Espalhar a Chama), loja, cursos on-line, aplicativo, WhatsApp</li></ul> | menu com muitos níveis; materiais hospedados fora (MediaFire, Issuu); banners repetidos |
| **RCC Mato Grosso** (rccmt.com.br) | <ul><li>cartões de notícia limpos, com data</li><li>newsletter com consentimento</li><li>podcast (Spotify) e vídeos (YouTube)</li><li>acervo de eventos estaduais</li></ul> | pouca interação dentro do site: eventos sem inscrição, grupos num link externo |
| **Vatican News** (vaticannews.va/pt) | <ul><li>Evangelho do dia e Santo do dia</li><li>atividades do Papa (Angelus, audiências) e documentos com áudio</li><li>podcast, canal no WhatsApp, RSS</li><li>busca com filtros</li></ul> | volume enorme de conteúdo (não é o nosso caso) |
| **CNBB** (cnbb.org.br) | <ul><li>liturgia diária</li><li>Campanha da Fraternidade com texto-base e materiais</li><li>artigos dos bispos com foto</li><li>"Palavra oficial", downloads e publicações</li></ul> | anúncio comercial no meio do conteúdo; erros de digitação nos títulos; menus duplicados |
| **Canção Nova** (cancaonova.com) | <ul><li>liturgia, homilia e santo do dia</li><li>TV e rádio ao vivo</li><li>eventos com programação</li><li>pedido de oração; seção infantil</li><li>barra de progresso de campanha</li></ul> | rótulos em caixa alta; excesso de blocos |
| **Arquidiocese de Cuiabá** (arquidiocesecuiaba.org.br) | <ul><li>paróquias com página própria e **horários de missas**</li><li>calendário; Rádio Bom Jesus ("ouça agora")</li><li>widgets de Palavra do Pastor, Santo do dia e Liturgia diária</li><li>barra com links para Vaticano, CNBB e Regional Oeste 2</li></ul> | vídeos só por link externo |
| **Arquidiocese do Rio** (arqrio.org.br) | <ul><li>folheto da missa e partituras por QR code</li><li>WebTV e rádio</li><li>"Voz do Pastor"</li><li>página de proteção de menores e vulneráveis</li></ul> | busca de paróquias e missas não aparece na página inicial |

## O que o nosso portal já faz melhor

- **Grupos de Oração:** a busca é feita **dentro do portal**, com mapa, "perto de mim" sem enviar a localização e confirmação periódica dos dados.
- **Agenda com inscrição:** comprovante com QR Code, lista de espera e check-in, sem formulário externo.
- **Privacidade e acessibilidade:** os vídeos só carregam com o clique e o Lighthouse dá 100 em acessibilidade. Nenhum dos sites estudados mostra esse cuidado.
- **Fluxo editorial:** conteúdo doutrinal só vai ao ar com o revisor designado.

## O que foi incorporado agora

- **Igreja e Renovação:** bloco novo, inspirado nas seções "Igreja" da RCC Brasil e nas campanhas da CNBB. Mostra os acontecimentos da Igreja e da RCC com data, local e **link da fonte oficial**.
- **Mídias no conteúdo:** capa nos textos, vídeo do YouTube que só carrega com o clique e **PDF para baixar** dentro do texto.
- **Multimídia:** vídeos dos canais oficiais, materiais em PDF **hospedados no próprio portal** (sem MediaFire nem Issuu) e galeria com autorização de imagem.
- **Conteúdo proposto para avaliação**, com 7 ilustrações originais, 2 PDFs e 1 vídeo oficial:
  - CF 2027;
  - Pentecostes 2027;
  - JMJ Seul 2027;
  - 60 anos da RCC;
  - Semana Espalhar a Chama;
  - "Como acontece um Grupo de Oração", com o roteiro em PDF;
  - "Primeira vez no Grupo de Oração?", com o guia em PDF.
  - Para carregar: `scripts/conteudo-proposto.mts`.

## Sugestões de dados e recursos para acrescentar

Em ordem de valor para quem visita. Os itens marcados com **(dados)** dependem de informação da coordenação; os outros são desenvolvimento.

### Prioridade alta (antes do lançamento)

1. **Dados reais dos Grupos de Oração (dados).** Para cada grupo:
   - nome, paróquia, endereço do local, dia e horário;
   - coordenador (privado);
   - telefone ou WhatsApp público autorizado;
   - acessibilidade do local;
   - foto autorizada da fachada ou do grupo.
2. **Lista oficial de paróquias e municípios da Arquidiocese (dados),** com regiões ou foranias, se existirem.
3. **Coordenação (dados):** nomes e funções do conselho arquidiocesano, com foto autorizada. Página "Quem somos".
4. **Canais oficiais (dados):** e-mail, WhatsApp, Instagram, YouTube e endereço da sede. Hoje a página Contato mostra "pendente".
5. **Ministérios reais (dados):** quais existem, quem coordena (só o nome público) e como participar.
6. **Fotos com autorização de imagem (dados):** encontros, Grupos de Oração e eventos. Uma boa foto por seção muda o site inteiro.

### Prioridade média (primeiros meses)

7. **Liturgia do dia e Santo do dia:** um bloco discreto na página inicial, com link para a fonte oficial (CNBB ou Vatican News). Todos os sites estudados têm.
8. **Escola de formação e Seminário de Vida no Espírito Santo:** calendário, inscrição e materiais em PDF, usando a agenda com inscrição que já existe.
9. **Newsletter e lembretes:** cadastro com consentimento (LGPD) e envio pelo provedor de e-mail, que fica por último.
10. **Galeria por evento:** álbuns de fotos ligados a cada evento da agenda.
11. **Testemunhos:** histórias de fé com autorização, revisadas pelo revisor designado (o fluxo já existe).
12. **Rede de intercessão:** escala de intercessores e pedidos por tema, sem expor nomes.

### Prioridade futura

13. **Doações:** Pix com QR Code para projetos da RCC arquidiocesana, com prestação de contas. Depende de definição institucional, como a loja.
14. **Transmissões ao vivo:** missas, Cenáculo e congressos, incorporados do canal oficial e só carregados com o clique.
15. **Podcast e rádio:** pregações em áudio e link da Rádio Bom Jesus da Arquidiocese.
16. **Aplicativo (PWA):** "instalar no celular", com a agenda e os grupos funcionando mesmo sem internet.
17. **Mapa da RCC no Mato Grosso:** ligação com a RCCMT e a RCC Brasil para os grupos aparecerem também na busca nacional (cadastro de grupos da RCC Brasil).
18. **Proteção de menores e pessoas vulneráveis:** página com a política da Arquidiocese e um canal de denúncia, como faz a Arquidiocese do Rio.

## Fontes

- RCC Brasil: https://rccbrasil.org.br/
- RCC Brasil, peregrinação aos 60 anos: https://rccbrasil.org.br/blog/rccbrasil-organiza-peregrinacao-a-italia-para-celebrar-os-60-anos-da-renovacao-carismatica-catolica-no-mundo/
- RCC Brasil, Semana Espalhar a Chama: https://rccbrasil.org.br/blog/rccbrasil-prepara-semana-espalhar-a-chama-para-mobilizar-grupos-de-oracao-em-todo-o-brasil/
- RCC Mato Grosso: https://www.rccmt.com.br/
- Vatican News: https://www.vaticannews.va/pt.html
- Vatican News, hino da JMJ Seul 2027: https://www.vaticannews.va/pt/vaticano/news/2026-08/lancado-o-hino-oficial-da-jmj-seul-2027.print.html
- CNBB: https://www.cnbb.org.br/
- CNBB, texto-base da CF 2027: https://www.cnbb.org.br/lancamento-texto-base-campanha-fraternidade-2027/
- Canção Nova: https://www.cancaonova.com/
- Arquidiocese de Cuiabá: https://www.arquidiocesecuiaba.org.br/
- Arquidiocese do Rio de Janeiro: https://arqrio.org.br/
