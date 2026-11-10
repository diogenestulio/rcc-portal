# Auditoria das referências

Data da coleta: 10/11/2026. Executor: Claude Code (sessão de implementação).

## Cobertura e limites (leia antes)

- **Amostra:** home, “Grupos de Oração” e “Notícias” do rccmt.com.br; home, “Pedido de oração” e “Notícias” do rccbrasil.org.br; o link “Encontre um Grupo de Oração” publicado no menu do RCCMT. Total: 7 URLs. **Não** foram auditados ministérios, formação, eventos individuais, downloads e contato página a página.
- **Método:** leitura do HTML entregue ao cliente (WebFetch) e medição com `curl` (código HTTP, bytes do HTML, TTFB, tempo total) a partir de uma conexão residencial em Cuiabá/MT. Os números valem só para o documento HTML (não incluem imagens, CSS e JS carregados depois) e para uma única medição; **não são Core Web Vitals**.
- **Não realizados:** capturas de tela, Lighthouse, teste com leitor de tela, teste por toque, envio de formulários e qualquer teste invasivo. Segurança interna, banco e backup de terceiros **não podem** ser avaliados a partir da aparência ou do HTTPS e não foram avaliados.
- Classificação usada: **F** = fato observado; **H** = hipótese; **D** = decisão para o novo portal.

## Medições (documento HTML, uma amostra)

| URL | HTTP | HTML (bytes) | TTFB | `<script>` | `<img>` | `alt=""` |
|---|---|---|---|---|---|---|
| https://www.rccmt.com.br/ | 200 | 996.261 | 1,15 s | 64 | 17 | 0 |
| https://www.rccmt.com.br/grupos-de-oracao | 200 | 682.511 | 0,44 s | 61 | 11 | 0 |
| https://www.rccmt.com.br/noticias | 200 | 997.025 | 0,27 s | 65 | 35 | 0 |
| https://rccbrasil.org.br/ | 200 | 430.746 | 1,05 s | 108 | 60 | 52 |
| https://rccbrasil.org.br/pedido-de-oracao/ | 200 | 162.597 | 0,64 s | 94 | 2 | 2 |
| https://rccbrasil.org.br/noticias/ | 200 | 154.076 | 0,66 s | 93 | 2 | 2 |
| http://www.rccbrasil.net/grupodeoracao/ | **404** | 162 | 0,94 s | – | – | – |

Cabeçalhos (home): rccmt.com.br responde via Cloudflare com HSTS e `X-Content-Type-Options`; rccbrasil.org.br responde `nginx/1.18.0 (Ubuntu)` sem HSTS, CSP ou `X-Frame-Options` visíveis no `HEAD` (F).

## Achados

| # | Site / URL | Funcionalidade | Ponto forte | Problema reproduzido | Melhoria para o novo portal | Prior. | Esforço |
|---|---|---|---|---|---|---|---|
| 1 | rccmt / menu “Encontre um Grupo de Oração” → http://www.rccbrasil.net/grupodeoracao/ | Localizar grupo | Item visível no menu | **F:** o link responde **404** e usa HTTP | **D:** busca própria de grupos, sem depender de serviço externo, com data de última confirmação | Alta | Médio |
| 2 | rccmt / home | Notícias | Notícias recentes logo no topo | **F:** HTML de ~1 MB e 64 scripts para três notícias; **H:** construtor de sites com muito JS | **D:** orçamento de 1,5 MB de transferência inicial **total**, páginas públicas majoritariamente sem JS | Alta | Baixo |
| 3 | rccmt / home | Identidade | Logo presente | **F:** `alt` do logo é o nome de arquivo “000.png” | **D:** `alt` com o nome da instituição; checagem de `alt` no CMS | Média | Baixo |
| 4 | rccmt / menu | Navegação | Menu curto (7 itens) | **F:** item “More” sem destino; eventos de 2020–2024 ainda no menu | **D:** menu configurável; eventos encerrados saem da navegação automaticamente | Média | Baixo |
| 5 | rccmt / rodapé | Institucional | Telefone e WhatsApp | **F:** sem política de privacidade ou termos | **D:** rodapé com privacidade, cookies, acessibilidade e vínculos oficiais | Alta | Baixo |
| 6 | rccmt / topo | Serviços | Separa App, Loja e Cursos | **F:** loja (rccshop.com.br) e cursos (ieadrccbrasil.com.br) são serviços externos; loja via HTTP | **D:** loja própria só depois de definir titularidade; vínculos externos rotulados como externos | Média | – |
| 7 | rccbrasil / home | Destaques | Versões de banner para desktop e celular | **F:** carrossel de 5 banners + carrossel de notícias; **H:** autoplay (não confirmado) | **D:** sem carrossel automático; um destaque principal com duas ações | Alta | Baixo |
| 8 | rccbrasil / home | Imagens | Muitas imagens otimizadas por tamanho | **F:** 52 de 60 `<img>` com `alt=""`, incluindo banners com texto | **D:** `alt` obrigatório no upload, com opção explícita “decorativa” | Alta | Baixo |
| 9 | rccbrasil / home | Grupos | Campo “Procurar” na home | **H:** busca por texto livre; filtros por dia/município não observados | **D:** filtros por município, paróquia, dia, horário e região, sem login nem geolocalização | Alta | Médio |
| 10 | rccbrasil / home | Ordem da home | Conteúdo rico | **F:** 13 seções, patrocinador logo após o banner e produtos com preço na home | **D:** home de 8 blocos, loja só como chamada discreta, sem publicidade na primeira dobra | Média | Baixo |
| 11 | rccbrasil / pedido-de-oracao | Pedido de oração | Fluxo existe | **F:** 94 scripts na página; **H:** terceiros carregados num formulário sensível (não verificado) | **D:** pedidos de oração privados, sem scripts de terceiros, fora de busca, analytics e logs | Alta | Médio |
| 12 | rccbrasil / links | Redes | Presença em várias redes | **F:** links com texto “Item da lista”; `javascript:void(0)` | **D:** links com nome acessível; nenhum link sem destino | Média | Baixo |
| 13 | rccbrasil / servidor | Cabeçalhos | HTTPS ativo | **F:** sem HSTS/CSP no `HEAD` da home; versão do nginx exposta | **D:** HSTS (após validar subdomínios), CSP, `nosniff`, `frame-ancestors`, sem versão do servidor | Alta | Baixo |
| 14 | ambos | Downloads / mídia | Acervo existente | **F:** downloads hospedados em mediafire.com e revista no issuu (rccbrasil) | **D:** downloads com tipo, tamanho e descrição; armazenamento de objetos próprio | Média | Médio |

## O que as referências inspiram (sem copiar)

- Estrutura de serviços: grupos de oração, formação, eventos, multimídia, downloads, pedido de oração, loja.
- Separação RCC Brasil × RCC no estado × RCC diocesana: os dois sites mostram vínculos entre instâncias. O novo portal mostra esses vínculos como **links externos rotulados**, sem falar em nome delas.
- Nenhum texto, imagem, logotipo ou layout das referências foi reaproveitado no código.

## Próximas coletas recomendadas

1. Lighthouse móvel repetido 3× nas mesmas 7 URLs (ferramenta, dispositivo emulado e data registrados).
2. Navegação por teclado e leitor de tela (NVDA) nos menus das duas homes.
3. Amostra de 3 páginas internas por seção (ministérios, formação, eventos, downloads, contato).
