# Revisão de acessibilidade (WCAG 2.2 AA) — 14/11/2026

> Revisão técnica feita em desenvolvimento local. **Não é declaração de conformidade** nem auditoria independente.

## Método

1. **Verificação automática** com axe-core 4.14.0 (dependência de desenvolvimento), regras `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` e `best-practice`, executada no navegador em cada página, com dados de demonstração e sessão de administrador.
   - O arquivo `public/_axe-dev.js` é uma cópia local do axe, fora do git (`.gitignore`), e não vai para a imagem.
   - Como repetir: `copy node_modules\axe-core\axe.min.js public\_axe-dev.js`, abrir a página e executar no console:
     `eval(await (await fetch('/_axe-dev.js')).text()); (await axe.run()).violations`
2. **Teste manual de teclado:** a primeira tecla Tab mostra “Pular para o conteúdo”, que leva a `#conteudo`; o foco é visível (contorno de 2,4 px, cor de destaque); o menu do celular (`<details>`) abre com Enter e mostra todos os itens.
3. **Tela pequena (320 × 700 px):** sem rolagem horizontal (`scrollWidth = 320`) em início, grupos, agenda do mês, evento, inscrição, produto e pedido; um único `h1` por página e sem saltos na hierarquia de títulos.
4. **Preferência por menos movimento:** `globals.css` zera animações e transições com `prefers-reduced-motion: reduce`.

## Cobertura

- **Site:** início, grupos (lista, mapa e página do grupo), agenda (lista, mês, evento e inscrição), notícias (lista e artigo), formação, ministérios, A RCC, multimídia, contato, pedido de oração, busca, privacidade, acessibilidade, loja, produto, carrinho e pedido.
- **Acesso:** entrar, esqueci a senha, redefinir senha e verificação em duas etapas (`/entrar/mfa`). A troca de senha obrigatória (`/entrar/trocar-senha`) usa o mesmo formulário de “Minha conta”, que foi varrido; a rota em si só abre para contas com senha provisória.
- **Painel:** início, conteúdo (lista, novo e edição), grupos (lista e edição), eventos (lista, detalhe, novo e check-in), mídia, usuários, conta, loja (pedidos, produtos e produto), oração e auditoria.
- **Comprovante de inscrição** (`/inscricao/[token]`), gerado por uma inscrição de teste local.

## Achados e correções

| Regra (axe) | Impacto | Onde | Correção |
|---|---|---|---|
| `label-content-name-mismatch` (2.5.3) | sério | link do logotipo em todas as páginas públicas (`SiteChrome.tsx`) | removido o `aria-label`; o texto visível passou a ser o nome, com “, página inicial” em `sr-only` |
| `definition-list` (1.3.1) | sério | `/grupos/[slug]`: linha “Informações confirmadas…” dentro do `<dl>` sem `dt`/`dd` | movida para um `<p>` depois da lista |
| `list` (1.3.1) | sério | painel, edição de conteúdo: `<ol>` com texto solto | trocado por `<p>` |
| `landmark-unique` | moderado | dois `<aside>` sem nome no painel | `aria-label="Menu do painel"` e `aria-label="Fluxo e histórico"` |

**Revarredura após as correções:** nenhuma violação nas páginas listadas em “Cobertura”.

## O que já existia e foi conferido

- Mensagens de erro de formulário com `role="alert"`; avisos com `role="status"`; resultados de busca, de filtros de grupos e “perto de mim” com `aria-live="polite"`.
- Links externos indicam “(abre site externo)” para leitores de tela.
- Mapa: carregado só após clique, com região nomeada e a observação de que a lista tem as mesmas informações; a lista é sempre a forma principal.
- Contraste das cores calculado em `docs/10-design-system.md`.

## Limitações declaradas

- **Sem teste com leitor de tela real** (NVDA, JAWS, TalkBack, VoiceOver) e sem participação de pessoas com deficiência. Ferramentas automáticas detectam só parte dos problemas.
- O menu do celular usa `<details>` nativo: a tecla Esc não o fecha (fecha com Enter no botão “Menu”). Não é falha WCAG, mas pode ser melhorado.
- O mapa (Leaflet) tem teclado próprio, porém os marcadores circulares não recebem foco. Por isso a lista e “Grupos perto de mim” trazem as mesmas informações.
- Zoom de 200 % e espaçamento de texto (1.4.12) não foram medidos separadamente; o layout usa unidades relativas e quebra de linha.
- Revisar de novo quando chegarem o logotipo e a cor oficiais, e após cada tela nova.
