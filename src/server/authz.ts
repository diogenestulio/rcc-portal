/**
 * Autorização no servidor — fonte única da matriz de permissões (docs/05-permissoes.md é gerado
 * a partir daqui por `npm run docs:permissoes`). Esconder botões NÃO é autorização: toda ação
 * de servidor chama `assertCan`.
 */
export type Role =
  | "admin_tecnico" | "gestor_institucional" | "editor" | "revisor" | "gestor_eventos"
  | "operador_loja" | "responsavel_local" | "intercessor";

export type ScopeType = "global" | "regiao" | "grupo" | "ministerio";
export type Assignment = { role: Role; scopeType: ScopeType; scopeId: string | null };
export type Subject = { userId: string; assignments: Assignment[]; mfa: boolean; recentAuthAt?: Date | null };
export type ResourceScope = { groupId?: string | null; regionId?: string | null; ministryId?: string | null };

export const ACTIONS = {
  "conteudo.criar": "Criar rascunho de conteúdo",
  "conteudo.editar": "Editar rascunho / criar nova revisão",
  "conteudo.enviar_revisao": "Enviar para revisão",
  "conteudo.aprovar_doutrinal": "Aprovar conteúdo doutrinal/pastoral/devocional",
  "conteudo.aprovar_geral": "Aprovar notícia, comunicado, institucional",
  "conteudo.publicar": "Publicar/agendar revisão aprovada",
  "conteudo.arquivar": "Arquivar conteúdo",
  "conteudo.estrutura": "Definir páginas fixas do site (ex.: A RCC → Quem Somos)",
  "midia.enviar": "Enviar mídia",
  "grupo.criar": "Cadastrar grupo novo (e paróquia/município novos)",
  "grupo.editar": "Editar dados do grupo",
  "grupo.publicar": "Publicar/despublicar grupo",
  "grupo.contato_privado": "Ver/editar contato privado do coordenador",
  "grupo.moderar_correcoes": "Moderar sugestões de correção",
  "ministerio.criar": "Cadastrar ministério novo",
  "ministerio.editar": "Editar ministério",
  "ministerio.publicar": "Publicar/ocultar ministério",
  "evento.gerenciar": "Criar/editar/publicar eventos",
  "evento.participantes": "Ver participantes",
  "evento.exportar": "Exportar participantes (auditado)",
  "evento.checkin": "Realizar check-in",
  "loja.produtos": "Gerenciar catálogo e estoque",
  "loja.pedidos": "Operar pedidos e entregas",
  "loja.reembolsar": "Solicitar reembolso",
  "loja.conta_recebedora": "Alterar conta recebedora/provedor (sensível)",
  "oracao.ler": "Ler pedidos de oração",
  "usuarios.gerenciar": "Criar/desativar usuários, revogar sessões",
  "papeis.conceder": "Conceder/revogar papéis (sensível)",
  "integracoes.gerenciar": "Configurar integrações (sensível)",
  "auditoria.ler": "Consultar auditoria",
} as const;
export type Action = keyof typeof ACTIONS;

/** Ações que exigem reautenticação recente (≤ 10 min). */
export const SENSITIVE: ReadonlySet<Action> = new Set<Action>([
  "papeis.conceder", "loja.conta_recebedora", "integracoes.gerenciar", "evento.exportar", "usuarios.gerenciar",
]);

/** Ações em que o escopo organizacional do papel restringe o recurso. */
const SCOPED: ReadonlySet<Action> = new Set<Action>([
  "grupo.editar", "grupo.contato_privado", "ministerio.editar", "evento.gerenciar", "evento.participantes", "evento.checkin",
]);

export const MATRIX: Record<Role, readonly Action[]> = {
  // Técnico: mantém o sistema, mas NÃO lê pedidos de oração nem aprova conteúdo.
  admin_tecnico: ["usuarios.gerenciar", "integracoes.gerenciar", "auditoria.ler", "midia.enviar"],
  gestor_institucional: [
    "conteudo.criar", "conteudo.editar", "conteudo.enviar_revisao", "conteudo.aprovar_geral", "conteudo.publicar", "conteudo.arquivar",
    "conteudo.estrutura", "midia.enviar", "grupo.criar", "grupo.editar", "grupo.publicar", "grupo.contato_privado", "grupo.moderar_correcoes", "ministerio.criar", "ministerio.editar",
    "ministerio.publicar", "evento.gerenciar", "evento.participantes", "usuarios.gerenciar", "papeis.conceder", "loja.conta_recebedora", "auditoria.ler",
  ],
  editor: ["conteudo.criar", "conteudo.editar", "conteudo.enviar_revisao", "conteudo.publicar", "midia.enviar"],
  revisor: ["conteudo.aprovar_doutrinal", "conteudo.aprovar_geral"],
  gestor_eventos: ["evento.gerenciar", "evento.participantes", "evento.exportar", "evento.checkin", "midia.enviar"],
  operador_loja: ["loja.produtos", "loja.pedidos", "loja.reembolsar", "midia.enviar"],
  responsavel_local: ["grupo.editar", "grupo.contato_privado", "ministerio.editar", "evento.gerenciar", "evento.participantes", "evento.checkin"],
  intercessor: ["oracao.ler"],
};

function scopeCovers(a: Assignment, r: ResourceScope | undefined): boolean {
  if (a.scopeType === "global") return true;
  if (!r) return false; // papel com escopo nunca vale para "qualquer recurso"
  switch (a.scopeType) {
    case "grupo": return !!r.groupId && r.groupId === a.scopeId;
    case "regiao": return !!r.regionId && r.regionId === a.scopeId;
    case "ministerio": return !!r.ministryId && r.ministryId === a.scopeId;
  }
}

export type Decision = { ok: true } | { ok: false; reason: "sem_permissao" | "fora_do_escopo" | "mfa_obrigatorio" | "reautenticar" };

export function decide(s: Subject, action: Action, resource?: ResourceScope, now = new Date()): Decision {
  const granting = s.assignments.filter((a) => MATRIX[a.role]?.includes(action));
  if (granting.length === 0) return { ok: false, reason: "sem_permissao" };
  if (SCOPED.has(action) && !granting.some((a) => scopeCovers(a, resource))) return { ok: false, reason: "fora_do_escopo" };
  if (!SCOPED.has(action) && !granting.some((a) => a.scopeType === "global")) return { ok: false, reason: "fora_do_escopo" };
  if (!s.mfa) return { ok: false, reason: "mfa_obrigatorio" };
  if (SENSITIVE.has(action)) {
    const fresh = s.recentAuthAt && now.getTime() - s.recentAuthAt.getTime() <= 10 * 60 * 1000;
    if (!fresh) return { ok: false, reason: "reautenticar" };
  }
  return { ok: true };
}

export class ForbiddenError extends Error {
  constructor(public reason: Exclude<Decision, { ok: true }>["reason"], public action: Action) {
    super(`Acesso negado (${reason}) para ${action}`);
  }
}

export function assertCan(s: Subject, action: Action, resource?: ResourceScope, now = new Date()) {
  const d = decide(s, action, resource, now);
  if (!d.ok) throw new ForbiddenError(d.reason, action);
}

export function hasAnyRole(s: Subject) { return s.assignments.length > 0; }
