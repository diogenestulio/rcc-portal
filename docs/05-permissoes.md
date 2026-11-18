# Matriz de permissões

Gerado por `npm run docs:permissoes` a partir de `src/server/authz.ts` — não edite à mão.

Regras gerais: toda requisição é verificada no servidor; MFA é obrigatório para qualquer ação do painel; ações marcadas com 🔒 exigem login nos últimos 10 minutos; ações com escopo (grupo/região/ministério) só valem para os recursos daquele escopo; o administrador técnico **não** lê pedidos de oração.

| Ação | admin_tecnico | gestor_institucional | editor | revisor | gestor_eventos | operador_loja | responsavel_local | intercessor |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `conteudo.criar` — Criar rascunho de conteúdo |  | ✔ | ✔ |  |  |  |  |  |
| `conteudo.editar` — Editar rascunho / criar nova revisão |  | ✔ | ✔ |  |  |  |  |  |
| `conteudo.enviar_revisao` — Enviar para revisão |  | ✔ | ✔ |  |  |  |  |  |
| `conteudo.aprovar_doutrinal` — Aprovar conteúdo doutrinal/pastoral/devocional |  |  |  | ✔ |  |  |  |  |
| `conteudo.aprovar_geral` — Aprovar notícia, comunicado, institucional |  | ✔ |  | ✔ |  |  |  |  |
| `conteudo.publicar` — Publicar/agendar revisão aprovada |  | ✔ | ✔ |  |  |  |  |  |
| `conteudo.arquivar` — Arquivar conteúdo |  | ✔ |  |  |  |  |  |  |
| `conteudo.estrutura` — Definir páginas fixas do site (ex.: A RCC → Quem Somos) |  | ✔ |  |  |  |  |  |  |
| `midia.enviar` — Enviar mídia | ✔ | ✔ | ✔ |  | ✔ | ✔ |  |  |
| `grupo.criar` — Cadastrar grupo novo (e paróquia/município novos) |  | ✔ |  |  |  |  |  |  |
| `grupo.editar` — Editar dados do grupo |  | ✔ |  |  |  |  | ✔ |  |
| `grupo.publicar` — Publicar/despublicar grupo |  | ✔ |  |  |  |  |  |  |
| `grupo.contato_privado` — Ver/editar contato privado do coordenador |  | ✔ |  |  |  |  | ✔ |  |
| `grupo.moderar_correcoes` — Moderar sugestões de correção |  | ✔ |  |  |  |  |  |  |
| `ministerio.criar` — Cadastrar ministério novo |  | ✔ |  |  |  |  |  |  |
| `ministerio.editar` — Editar ministério |  | ✔ |  |  |  |  | ✔ |  |
| `ministerio.publicar` — Publicar/ocultar ministério |  | ✔ |  |  |  |  |  |  |
| `evento.gerenciar` — Criar/editar/publicar eventos |  | ✔ |  |  | ✔ |  | ✔ |  |
| `evento.participantes` — Ver participantes |  | ✔ |  |  | ✔ |  | ✔ |  |
| 🔒 `evento.exportar` — Exportar participantes (auditado) |  |  |  |  | ✔ |  |  |  |
| `evento.checkin` — Realizar check-in |  |  |  |  | ✔ |  | ✔ |  |
| `loja.produtos` — Gerenciar catálogo e estoque |  |  |  |  |  | ✔ |  |  |
| `loja.pedidos` — Operar pedidos e entregas |  |  |  |  |  | ✔ |  |  |
| `loja.reembolsar` — Solicitar reembolso |  |  |  |  |  | ✔ |  |  |
| 🔒 `loja.conta_recebedora` — Alterar conta recebedora/provedor (sensível) |  | ✔ |  |  |  |  |  |  |
| `oracao.ler` — Ler pedidos de oração |  |  |  |  |  |  |  | ✔ |
| 🔒 `usuarios.gerenciar` — Criar/desativar usuários, revogar sessões | ✔ | ✔ |  |  |  |  |  |  |
| 🔒 `papeis.conceder` — Conceder/revogar papéis (sensível) |  | ✔ |  |  |  |  |  |  |
| 🔒 `integracoes.gerenciar` — Configurar integrações (sensível) | ✔ |  |  |  |  |  |  |  |
| `auditoria.ler` — Consultar auditoria | ✔ | ✔ |  |  |  |  |  |  |
