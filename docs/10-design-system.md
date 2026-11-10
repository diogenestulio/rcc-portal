# Design system

Implementação: tokens em `src/app/globals.css` (`@theme` do Tailwind 4) e componentes em `src/components/ui.tsx`.

## Princípios
Reverente, acolhedor e editorial. Muito espaço em branco, uma ação principal por bloco, nada se move sozinho. A chama aparece **uma vez**, estática, como marca provisória — não é o logotipo oficial e será substituída pela marca autorizada.

## Cores (provisórias até a identidade oficial)

| Token | Valor | Uso | Contraste sobre marfim |
|---|---|---|---|
| `marfim` | #FBF8F1 | fundo | — |
| `tinta` | #1F1B16 | texto | 16,1:1 |
| `tinta-2` / `tinta-3` | #4A4339 / #6B6256 | texto secundário / dicas | 9,2:1 / 5,7:1 |
| `vinho` | #7A2335 | cor principal: botões, links | 9,3:1 (branco sobre vinho 9,9:1) |
| `dourado` | #B8912F | **apenas decorativo** (filetes, chama) | 2,8:1 — por isso não é usado em texto |
| `dourado-texto` | #7A5A1C | rótulos pequenos | 6,0:1 |
| `azul` | #1F4E79 | informação e anel de foco | 8,2:1 |
| `verde`, `alerta`, `perigo` | — | confirmado, atenção, erro/cancelado | 5,6:1 · 5,4:1 · 7,0:1 em seus fundos claros |

Contrastes calculados pela fórmula de luminância relativa da WCAG 2.x em 10/11/2026; conferir de novo quando a cor oficial chegar. As cores de interface **não** têm significado litúrgico.

## Tipografia
Duas famílias, servidas do próprio domínio via `next/font` (licença SIL OFL): **Source Serif 4** (títulos) e **Inter** (texto). Corpo 17 px, entrelinha 1,6, títulos com `text-wrap: balance`, largura de leitura 68 caracteres.

## Componentes
`Container`, `PageHeader`, `ButtonLink`/`btn` (primário, secundário, discreto, perigo — altura mínima 48 px), `Badge`, `DemoBadge`, `Card`, `Notice` (status/alerta com `role`), `EmptyState`, `field` (rótulo, dica, erro), `Wordmark`.

## Movimento e foco
Transições ≤ 160 ms apenas em cor; `prefers-reduced-motion` zera animações. Foco: contorno azul de 3 px sempre visível. Link “Pular para o conteúdo” em todas as páginas.

## Pendências
Logotipo oficial, cor principal autorizada, fotografias da comunidade com autorização de imagem, protótipos de telas adicionais da loja.
