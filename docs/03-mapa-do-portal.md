# Mapa do portal

## Navegação principal (7 grupos)

| Grupo | Rotas | Finalidade | Público | Estado vazio |
|---|---|---|---|---|
| A RCC | `/a-rcc`, `/a-rcc/[slug]` (identidade, história, coordenação, documentos, contato) | Explicar quem somos e o vínculo com a Igreja local | Visitantes, imprensa, paróquias | “Conteúdo institucional em preparação” + contato |
| Grupos de Oração | `/grupos`, `/grupos/[slug]`, `/grupos/[slug]/sugerir-correcao` | Encontrar um grupo e participar | Quem quer participar | “Nenhum grupo com esses filtros” + limpar filtros + sugerir grupo |
| Ministérios e Formação | `/formacao`, `/formacao/[slug]`, `/ministerios`, `/ministerios/[slug]` | Formação e serviço | Membros e servos | Lista de ministérios sem artigos ainda |
| Agenda | `/agenda` (lista), `/agenda/mes`, `/agenda/[slug]`, `/agenda/[slug]/inscricao` | Encontros, retiros, inscrições | Todos | “Nenhum evento publicado neste período” + assinar agenda |
| Notícias | `/noticias`, `/noticias/[slug]` | Notícias e comunicados | Todos | “Ainda não há notícias publicadas” |
| Multimídia | `/multimidia` (vídeos, fotos, downloads) | Transmissões e materiais | Todos | Link do canal oficial |
| Loja | `/loja`, `/loja/[slug]`, `/carrinho`, `/pedido/[token]` | Catálogo e pedidos | Compradores | “Loja em preparação” enquanto `STORE_ENABLED=false` |

## Utilitários (não duplicam o menu)

Busca `/busca` · Contato `/contato` · Pedido de oração `/pedido-de-oracao` · Colaborar `/colaborar` (desligado até definição) · Conta `/entrar` · Carrinho `/carrinho`.

## Rodapé

Identificação institucional · Contato e atendimento · `/privacidade` · `/cookies` · `/acessibilidade` · `/termos` · Vínculos oficiais (Arquidiocese, RCCMT, RCC Brasil, marcados como sites externos) · Assinar agenda (`/agenda.ics`).

## Feeds e arquivos técnicos

`/agenda.ics` (assinatura pública) · `/agenda/[slug]/evento.ics` (cópia de um evento) · `/sitemap.xml` · `/robots.txt` · `/api/health`.

## Administração (`/admin`, `noindex`, exige login + MFA)

Painel · Conteúdo (páginas, artigos, notícias) com fluxo rascunho → em revisão → aprovado → publicado → arquivado · Fila de revisão · Grupos e sugestões de correção · Ministérios · Eventos e inscrições · Check-in · Mídia · Loja (produtos, estoque, pedidos, exceções) · Pedidos de oração (só intercessores) · Usuários e papéis · Integrações · Auditoria.

## Home (ordem)

1. Identidade e navegação compacta
2. Destaque: imagem + mensagem curta + “Encontre um Grupo de Oração” e “Veja a agenda”
3. Próximos encontros e inscrições abertas
4. Notícias arquidiocesanas
5. Formação, ministérios e vida dos grupos
6. Vídeo em destaque (carregado só ao clicar)
7. Chamada discreta para loja/colaboração
8. Rodapé institucional
