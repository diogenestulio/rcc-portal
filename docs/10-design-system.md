# Design system

Implementação: tokens em `src/app/globals.css` (`@theme` do Tailwind 4) e componentes em `src/components/ui.tsx`.

## Princípios
Reverente, acolhedor e editorial. Muito espaço em branco, uma ação principal por bloco, nada se move sozinho além de uma entrada suave. A identidade vem do **brasão da RCC**: verde e amarelo da fita, petróleo do contorno e prata da cruz. Ela está em harmonia com a RCC Brasil (rccbrasil.org.br: verde #006036, petróleo #004058) e a RCCMT (rccmt.com.br: faixa verde-escura, logo à esquerda).

## Brasão (arquivos em `public/marca/`)

| Arquivo | Uso |
|---|---|
| `rcc-logo-completo.png` | brasão com o texto “Renovação Carismática Católica”, fundo transparente (materiais, impressão) |
| `rcc-simbolo.png` | só o símbolo, fundo transparente — destaque da página inicial |
| `rcc-simbolo-96.webp` / `-192.webp` | cabeçalho e rodapé (o rodapé usa um selo branco, porque a pomba é branca) |
| `src/app/icon.png`, `apple-icon.png`, `favicon.ico` | ícones do navegador e do celular |

Gerados em 14/11/2026 a partir do arquivo enviado pelo coordenador. O fundo foi removido só na área externa, e a pomba continua branca. O brasão aparece sempre com `alt=""`, porque o nome em texto ao lado já identifica o site. **Pendente:** confirmar com a coordenação a autorização de uso da marca e se existe versão vetorial (SVG) oficial.

## Cores

| Token | Valor | Uso | Contraste (branco / fundo) |
|---|---|---|---|
| `marfim` (fundo) | #F6F9F7 | fundo da página | — |
| `marfim-2` | #EAF2ED | faixas e blocos suaves | — |
| `tinta` | #14262E | texto | 15,6 / 14,7 |
| `tinta-2` / `tinta-3` | #3B4C54 / #56666E | texto secundário / dicas | 8,9 / 8,4 · 6,0 / 5,6 |
| `marca` | #007437 | verde do brasão: botões, links, destaques | 5,9 / 5,6 (branco sobre ela 5,9) |
| `marca-escuro` | #005A2B | hover, nome no cabeçalho | 8,4 / 7,9 |
| `marca-noite` | #00451F | rodapé | branco 11,2 · amarelo 7,4 |
| `marca-claro` | #E6F2EA | fundos de destaque e hover | — |
| `sol` | #FFCB04 | amarelo do brasão: **só decorativo ou sobre fundo escuro** | 1,5 no claro (proibido em texto claro) |
| `sol-texto` | #7A5C00 | rótulos dourados sobre fundo claro | 6,3 / 5,9 |
| `petroleo` | #004159 | anel de foco e informação | 11,1 / 10,4 |
| `prata` | #B8D0DC | decorativo; texto só sobre `marca-noite` (7,0) | — |
| `verde`, `alerta`, `perigo` | #1E6B3C · #7A5200 · #9B1C1C | confirmado, atenção, erro/cancelado | ≥ 5,4 em seus fundos claros |

Os contrastes foram calculados pela fórmula de luminância relativa da WCAG 2.x em 14/11/2026. A revarredura com axe-core das páginas principais não encontrou violações. As cores de interface **não** têm significado litúrgico.

**Faixa da marca** (`.faixa-marca`): 4 px no topo do cabeçalho e do rodapé, com gradiente verde → amarelo que ecoa a fita do brasão.

## Tipografia
Duas famílias, servidas do próprio domínio via `next/font` (licença SIL OFL): **Source Serif 4** (títulos) e **Inter** (texto). Corpo 17 px, entrelinha 1,6, títulos com `text-wrap: balance`, largura de leitura 68 caracteres.

## Componentes
`Container`, `PageHeader` (fundo em degradê verde-claro e amarelo-claro), `ButtonLink`/`btn` (primário, secundário, discreto e perigo, com altura mínima de 48 px), `Badge`, `DemoBadge`, `Card` (`hover` ativa a elevação), `Notice` (status/alerta com `role`), `EmptyState`, `field` (rótulo, dica, erro) e `Wordmark` (brasão + nome).

## Movimento e foco
- Duração padrão de 180 ms, com curva `--ease-suave`.
- Links: transição de cor.
- Botões: cor, sombra e elevação de 1 px no hover; afundam 1 px ao clicar.
- Cartões de listagem (`.elevar`): sobem 2 px, ganham sombra e borda esverdeada no hover e no foco do teclado.
- Brasão da página inicial e menu do celular: entrada suave (`.surgir`, só opacidade e 6 px).
- Nada pisca nem se move sozinho em loop.
- `prefers-reduced-motion: reduce` desliga todas as animações e transições.
- Foco: contorno petróleo de 3 px, sempre visível.
- Link “Pular para o conteúdo” em todas as páginas.

## Pendências
Autorização formal de uso da marca e versão vetorial do brasão, fotografias da comunidade com autorização de imagem e protótipos de telas adicionais da loja.
