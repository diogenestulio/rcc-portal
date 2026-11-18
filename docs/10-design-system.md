# Design system

Implementação: tokens em `src/app/globals.css` (`@theme` do Tailwind 4) e componentes em `src/components/ui.tsx`.

## Princípios
**Direção "Verde majestoso" (ADR-011, 16/11/2026).** O verde-escuro do brasão é o **estandarte**: domina o cabeçalho, as aberturas de página e o rodapé. **Ouro e prata** são os metais: filete dourado com losango entre o estandarte e o conteúdo, selo do brasão com aro de ouro e botão de destaque em ouro. O conteúdo fica claro, silencioso e editorial.
- **Brasão livre (ADR-012):** sem moldura, com contorno claro e brilho dourado (`.brasao-livre`), sobre raios dourados (`.raios`) e textura de losangos (`.estandarte.textura-losangos`). O único movimento ao carregar é a entrada do brasão e dos raios.
- **Convite a explorar:** buscador de grupos logo na abertura e blocos "Por onde começar" (`.caminho`) com ícones próprios em `src/components/site/Icones.tsx`.
- **A data é a informação da agenda:** por isso aparece grande, como num calendário litúrgico.
- **Notícias com hierarquia:** uma em destaque e as outras em lista.
- **Rótulos:** em itálico Caslon e em caixa normal, nunca em caixa alta. Links sem setas.
- **Harmonia:** combina com a RCC Brasil (verde #006036, petróleo #004058) e a RCCMT (faixa verde-escura, logotipo à esquerda).

## Marca (Manual de Identidade Visual da RCC)

**Fonte:** o Manual de Identidade Visual da RCC Brasil, em PDF, que o coordenador enviou em 16/11/2026.
- **Símbolo oficial:** o símbolo está em **vetor** no próprio manual. Foi convertido para `public/marca/rcc-simbolo.svg` (8 KB, nítido em qualquer tamanho) por `scripts/marca-pdf2svg.py`.
- **Cores:** as do manual (páginas 12 a 14). Os gradientes são os oficiais: amarelo #FDC800 → #FDFA00 e verde #006036 → #009049.
- **Assinaturas da RCC Brasil** (condensada, linha única e sigla): ficam em `docs/marca-referencia/` só como referência de proporção. **Não** são usadas no site, porque dizem "Brasil".

| Arquivo | Uso |
|---|---|
| `rcc-simbolo.svg` | símbolo oficial: cabeçalho, rodapé e abertura da página inicial |
| `rcc-logo-completo.png`, `rcc-simbolo.png` | PNGs antigos, mantidos para impressão e para gerar os ícones |
| `src/app/icon.png`, `apple-icon.png`, `favicon.ico` | ícones do navegador e do celular |

**Identificação no site (desde 18/11/2026):** **não** há assinatura montada.
- O manual exige a arte oficial com o nome da instância (p. 5–11 e 23: "as dioceses possuem o arquivo digital com seu nome próprio") e proíbe alterar proporção, fonte e aplicação.
- Até chegar o arquivo "Renovação Carismática Católica — Arquidiocese de Cuiabá" da coordenação estadual, o componente `Wordmark` mostra **só texto** ("RCC Arquidiocese de Cuiabá / Renovação Carismática Católica"), **sem o símbolo**, no cabeçalho, no rodapé, no painel, na tela de entrar e nos PDFs.
- A capa é **tipográfica**, sem o símbolo ampliado: não há filtro, contorno, brilho nem animação sobre a marca.
- **Ao receber o arquivo oficial:**
  1. usar a versão **horizontal** no cabeçalho, com o nome da instância alinhado à esquerda e a 70% do tamanho (p. 23), sem combinar condensada, linha única e sigla (p. 5);
  2. conferir a redução mínima (p. 18–19) e a margem da barra do "i" (p. 20);
  3. se o fundo verde prejudicar a leitura, colocar a arte sobre área clara, sem filtro.
- `rcc-simbolo.svg` (vetor extraído do manual) fica guardado para a arte oficial e para material impresso. **Não é usado sozinho no site.**

**Pendente:** autorização formal da coordenação para o uso da marca pela instância.

## Cores

| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `estandarte` | #0A3A22 | cabeçalho, aberturas, rodapé | branco 12,8 · ouro 8,4 · ouro-suave 7,7 · prata 8,0 · marfim-texto 10,6 |
| `estandarte-2` / `noite` | #0F4A2C / #062616 | variações; faixa final do rodapé | branco 10,3 / 16,2 |
| `ouro` | #FDC800 | amarelo do manual (Pantone 7406): botão de destaque (texto em estandarte, 8,4), filetes, losangos | **nunca texto sobre fundo claro** (1,5) |
| `ouro-suave` | #E8C660 | títulos em itálico e links sobre o estandarte | 7,7 no estandarte |
| `prata` | #B8D0DC | texto secundário sobre o estandarte | 8,0 |
| `marfim-texto` | #EFEADB | texto corrido sobre o estandarte | 10,6 |
| `marfim` (fundo) | #F5F8F6 | fundo claro da página (névoa fria, não creme) | — |
| `tinta` / `tinta-2` / `tinta-3` | #13262D / #3B4C54 / #56666E | texto no claro | 15,6 / 8,9 / 6,0 sobre branco |
| `marca` / `marca-escuro` | #006036 / #004A29 | verde do manual (Pantone 364): links, botão principal no claro | 7,7 / 10,4 sobre branco |
| `sol-texto` | #7A5C00 | dourado legível no claro (mês da agenda, rótulos) | 6,3 |
| `petroleo` | #004058 | petróleo do manual (Pantone 548): nome de instância no claro, anel de foco | 11,2 |
| `verde-vivo` / `limao` | #009049 / #FDFA00 | cores claras do gradiente oficial: **só decorativas** | 4,1 (insuficiente para texto) |
| `verde`, `alerta`, `perigo` | #1E6B3C · #7A5200 · #9B1C1C | estados | ≥ 5,4 nos fundos claros |

Contrastes calculados pela fórmula de luminância relativa da WCAG 2.x em 16/11/2026. As cores de interface **não** têm significado litúrgico.

## Tipografia
- **Lato:** fonte principal do manual. Usada na assinatura (Lato Bold) e em todo o texto do site, nos pesos 400, 700 e 900.
- **Libre Caslon Display/Text:** fonte editorial, só nos títulos grandes e nos rótulos em itálico, **fora** da assinatura. A Calibri, fonte auxiliar do manual, não tem licença para a web; a Lato cumpre esse papel.

Corpo de 17 px com entrelinha 1,62. A abertura da página inicial usa `text-monumental` (até 4,9 rem). Todas as fontes são servidas do próprio domínio via `next/font` (licença SIL OFL).

## Componentes
`Container`, `PageHeader` (faixa do estandarte com filete dourado), `ButtonLink`/`btn` (primário, secundário, discreto e perigo no claro; **ouro** e **claro** sobre o estandarte; altura mínima de 48 px), `Badge`, `DemoBadge`, `Card` (`hover` ativa a elevação), `Notice` (status/alerta com `role`), `EmptyState`, `field` (rótulo, dica, erro) e `Wordmark` (brasão no selo de ouro + nome em Caslon). Classes globais: `.estandarte`, `.textura-losangos`, `.sobre-estandarte` (foco em ouro), `.filete-ouro`, `.brasao-livre`, `.raios`, `.brilho` e `.caminho`.

## Movimento e foco
- **Um momento só:** ao carregar a página inicial, o brasão sobe levemente e os raios dourados se abrem (cerca de 1,1 a 1,8 s).
- **Respostas à ação:** cor e sublinhado nos links, sublinhado dourado no menu principal, borda e sombra nas listagens (`.elevar`, sem deslocamento) e menu do celular abrindo com leve deslize.
- `prefers-reduced-motion: reduce` desliga todas as animações e transições.
- **Foco:** contorno de 3 px, petróleo no claro e ouro sobre o estandarte, sempre visível. Link "Pular para o conteúdo" em todas as páginas.

## Pendências
Autorização formal de uso da marca e versão vetorial do brasão, fotografias da comunidade com autorização de imagem e protótipos de telas adicionais da loja.
