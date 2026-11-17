# Design system

Implementação: tokens em `src/app/globals.css` (`@theme` do Tailwind 4) e componentes em `src/components/ui.tsx`.

## Princípios
**Direção "Verde majestoso" (ADR-011, 16/11/2026).** O verde-escuro do brasão é o **estandarte**: domina o cabeçalho, as aberturas de página e o rodapé. **Ouro e prata** são os metais: filete dourado com losango entre o estandarte e o conteúdo, selo do brasão com aro de ouro e botão de destaque em ouro. O conteúdo fica claro, silencioso e editorial.
- **Uma ousadia só:** o medalhão do brasão na abertura da página inicial, o único elemento com movimento ao carregar.
- **A data é a informação da agenda:** por isso aparece grande, como num calendário litúrgico.
- **Notícias com hierarquia:** uma em destaque e as outras em lista.
- **Rótulos:** em itálico Caslon e em caixa normal, nunca em caixa alta. Links sem setas.
- **Harmonia:** combina com a RCC Brasil (verde #006036, petróleo #004058) e a RCCMT (faixa verde-escura, logotipo à esquerda).

## Brasão (arquivos em `public/marca/`)

| Arquivo | Uso |
|---|---|
| `rcc-logo-completo.png` | brasão com o texto “Renovação Carismática Católica”, fundo transparente (materiais, impressão) |
| `rcc-simbolo.png` | só o símbolo, fundo transparente — destaque da página inicial |
| `rcc-simbolo-96.webp` / `-192.webp` | cabeçalho e rodapé (o rodapé usa um selo branco, porque a pomba é branca) |
| `src/app/icon.png`, `apple-icon.png`, `favicon.ico` | ícones do navegador e do celular |

Gerados em 14/11/2026 a partir do arquivo enviado pelo coordenador. O fundo foi removido só na área externa, e a pomba continua branca. O brasão aparece sempre com `alt=""`, porque o nome em texto ao lado já identifica o site. **Pendente:** confirmar com a coordenação a autorização de uso da marca e se existe versão vetorial (SVG) oficial.

## Cores

| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `estandarte` | #0A3A22 | cabeçalho, aberturas, rodapé | branco 12,8 · ouro 8,4 · ouro-suave 7,7 · prata 8,0 · marfim-texto 10,6 |
| `estandarte-2` / `noite` | #0F4A2C / #062616 | variações; faixa final do rodapé | branco 10,3 / 16,2 |
| `ouro` | #FFCB04 | amarelo do brasão: botão de destaque (texto em estandarte, 8,4), filetes, losangos | **nunca texto sobre fundo claro** (1,5) |
| `ouro-suave` | #E8C660 | títulos em itálico e links sobre o estandarte | 7,7 no estandarte |
| `prata` | #B8D0DC | texto secundário sobre o estandarte | 8,0 |
| `marfim-texto` | #EFEADB | texto corrido sobre o estandarte | 10,6 |
| `marfim` (fundo) | #F5F8F6 | fundo claro da página (névoa fria, não creme) | — |
| `tinta` / `tinta-2` / `tinta-3` | #13262D / #3B4C54 / #56666E | texto no claro | 15,6 / 8,9 / 6,0 sobre branco |
| `marca` / `marca-escuro` | #007437 / #005A2B | verde do brasão: links, botão principal no claro | 5,9 / 8,4 sobre branco |
| `sol-texto` | #7A5C00 | dourado legível no claro (mês da agenda, rótulos) | 6,3 |
| `petroleo` | #004159 | anel de foco no claro (no estandarte o foco é ouro) | 11,1 |
| `verde`, `alerta`, `perigo` | #1E6B3C · #7A5200 · #9B1C1C | estados | ≥ 5,4 nos fundos claros |

Contrastes calculados pela fórmula de luminância relativa da WCAG 2.x em 16/11/2026. As cores de interface **não** têm significado litúrgico.

## Tipografia
Três estilos de duas famílias, servidas do próprio domínio via `next/font` (licença SIL OFL):
- **Libre Caslon Display:** títulos grandes (`h1`, `h2`), peso único, sem negrito sintético.
- **Libre Caslon Text:** `h3` e `h4`, rótulos em itálico.
- **Albert Sans:** texto e interface.

Corpo de 17 px com entrelinha 1,62. A abertura da página inicial usa `text-monumental` (até 4,9 rem).

## Componentes
`Container`, `PageHeader` (faixa do estandarte com filete dourado), `ButtonLink`/`btn` (primário, secundário, discreto e perigo no claro; **ouro** e **claro** sobre o estandarte; altura mínima de 48 px), `Badge`, `DemoBadge`, `Card` (`hover` ativa a elevação), `Notice` (status/alerta com `role`), `EmptyState`, `field` (rótulo, dica, erro) e `Wordmark` (brasão no selo de ouro + nome em Caslon). Classes globais: `.estandarte`, `.sobre-estandarte` (foco em ouro), `.filete-ouro`, `.selo` e `.medalhao`.

## Movimento e foco
- **Um momento só:** ao carregar a página inicial, o medalhão do brasão aparece com o halo dourado (`.medalhao`, cerca de 0,9 s).
- **Respostas à ação:** cor e sublinhado nos links, sublinhado dourado no menu principal, borda e sombra nas listagens (`.elevar`, sem deslocamento) e menu do celular abrindo com leve deslize.
- `prefers-reduced-motion: reduce` desliga todas as animações e transições.
- **Foco:** contorno de 3 px, petróleo no claro e ouro sobre o estandarte, sempre visível. Link "Pular para o conteúdo" em todas as páginas.

## Pendências
Autorização formal de uso da marca e versão vetorial do brasão, fotografias da comunidade com autorização de imagem e protótipos de telas adicionais da loja.
