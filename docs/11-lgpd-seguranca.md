# Segurança (referência OWASP ASVS 5.0.0) e tratamento de dados

> Isto é um mapeamento técnico de controles implementados, **não** uma certificação nem uma verificação independente. A versão do ASVS deve ser reconferida na revisão de segurança.

## Controles implementados (com evidência)

| Área | Controle | Onde | Evidência |
|---|---|---|---|
| Autenticação | Hash de senha da biblioteca, mínimo 12 caracteres, cadastro público desligado | `src/lib/auth.ts` | configuração |
| Autenticação | MFA TOTP obrigatório para o painel, códigos de recuperação | `session.ts`, `/entrar/mfa` | fluxo executado no navegador |
| Autenticação | Rate limit de login/TOTP/reset no banco; mensagem genérica (anti-enumeração) | `auth.ts`, `LoginForm.tsx` | configuração |
| Sessão | Cookies HttpOnly, SameSite=Lax, Secure sob HTTPS; 12 h; reautenticação ≤ 10 min para ações sensíveis | `auth.ts`, `authz.ts` | teste `decide(...)=reautenticar` |
| Autorização | Matriz por ação + escopo, verificada no servidor em toda ação | `authz.ts` | `groups-authz.test.ts` |
| Acesso por ID | Tokens opacos de 144+ bits para comprovantes, pedidos, carrinho | `tokens.ts` | teste do comprovante |
| Entrada | Validação no servidor; HTML sanitizado por lista de permissões | `content.ts`, `richtext.ts` | teste de sanitização + `<script>` gravado como texto |
| SQL | Consultas parametrizadas (Drizzle/postgres.js); `LIKE` escapado | `groups.ts`, `search.ts` | teste com `%' or 1=1 --` |
| Uploads | Tipo real por assinatura, SVG/HTML proibidos, PDF com JS recusado, imagem recodificada sem EXIF | `uploads.ts` | testes |
| CSV | Neutralização de fórmulas na exportação | `participantes.csv/route.ts` | código |
| Cabeçalhos | CSP com nonce, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP; HSTS opcional | `proxy.ts`, `next.config.ts` | `curl -I` |
| Cache | `private, no-store` + `noindex` em painel, comprovantes, pedidos e API | `next.config.ts` | `curl -I /admin` |
| Webhooks | Assinatura + janela anti-replay + inbox única + reconsulta ao provedor | `payments.ts` | testes |
| Auditoria | Somente inclusão (triggers) + cadeia SHA-256; campos sensíveis omitidos | `audit.ts`, migração 0001 | testes |
| Segredos | Apenas no servidor; `.env*` fora do git; validação de ambiente | `env.ts`, `.gitignore` | — |

## Lacunas conhecidas (antes da produção)
- Recuperação de senha depende do e-mail transacional (não implementado).
- Antivírus em uploads e armazenamento de objetos privado: não iniciados.
- CI de dependências/segredos escrito mas não executado. `npm audit --omit=dev` em 10/11/2026: 4 alertas **moderados** (aviso do `esbuild` sobre o servidor de desenvolvimento, GHSA-67mh-4wv8-2f99); nenhum alto ou crítico. Reavaliar antes do lançamento.
- Teste de intrusão / revisão independente: não realizados.

## Tratamento de dados (LGPD) — a validar com encarregado e jurídico

| Tratamento | Dados | Finalidade | Base legal (hipótese a validar) | Acesso | Retenção proposta |
|---|---|---|---|---|---|
| Inscrição em evento | nome, e-mail, telefone opcional | organizar o evento | execução de procedimento solicitado pelo titular / legítimo interesse | gestor de eventos do escopo | anonimizar 12 meses após o evento |
| Pedido de oração | intenção, primeiro nome e contato opcionais | intercessão | consentimento (dado que pode revelar convicção religiosa/saúde) | intercessores | 60 dias |
| Sugestão de correção | mensagem, e-mail opcional | manter dados dos grupos corretos | legítimo interesse | moderadores | 12 meses |
| Contato de coordenador | nome, telefone, e-mail | gestão interna | legítimo interesse; publicação só com autorização | responsável do escopo | enquanto coordenar |
| Equipe | nome, e-mail, sessões, auditoria | segurança | legítimo interesse / obrigação | administração | conta ativa + 180 dias de auditoria |

Princípios aplicados no código: coleta mínima; marketing nunca condiciona inscrição; sem analytics nem cookies não essenciais; vídeo e mapa só após clique; pedidos de oração fora de busca, logs e notificações. Menores, autorização de imagem, newsletter e contribuições: fluxos **não implementados** até definição institucional.
