"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireAdmin } from "@/server/session";
import { ForbiddenError, type Role, type ScopeType } from "@/server/authz";
import { createUser, grantRole, resetMfa, resetPassword, revokeRole, revokeSessions, setActive, UserAdminError } from "@/server/users";

export type AcaoState = null | { ok: true; msg: string; senha?: string; userId?: string } | { ok: false; erro: string };

const erro = (e: unknown): AcaoState => {
  if (e instanceof UserAdminError) return { ok: false, erro: e.message };
  if (e instanceof ForbiddenError) return { ok: false, erro: e.reason === "reautenticar" ? "Por segurança, entre de novo (login com mais de 10 minutos)." : "Você não tem permissão para esta ação." };
  throw e;
};

async function run(fn: () => Promise<AcaoState>): Promise<AcaoState> {
  try { const r = await fn(); revalidatePath("/admin/usuarios", "layout"); return r; } catch (e) { return erro(e); }
}

export async function criarConta(_p: AcaoState, fd: FormData): Promise<AcaoState> {
  const s = await requireAdmin();
  return run(async () => {
    const r = await createUser(db, s, { name: String(fd.get("nome") ?? ""), email: String(fd.get("email") ?? "") });
    return { ok: true, msg: "Conta criada.", senha: r.tempPassword, userId: r.userId };
  });
}

export async function acaoConta(_p: AcaoState, fd: FormData): Promise<AcaoState> {
  const s = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const acao = String(fd.get("acao") ?? "");
  return run(async () => {
    switch (acao) {
      case "senha": return { ok: true, msg: "Senha provisória gerada; as sessões foram encerradas.", senha: await resetPassword(db, s, id) };
      case "sessoes": return { ok: true, msg: `${await revokeSessions(db, s, id)} sessão(ões) encerrada(s).` };
      case "mfa": await resetMfa(db, s, id); return { ok: true, msg: "Verificação em duas etapas zerada; a pessoa configura de novo no próximo login." };
      case "desativar": await setActive(db, s, id, false); return { ok: true, msg: "Conta desativada e sessões encerradas." };
      case "reativar": await setActive(db, s, id, true); return { ok: true, msg: "Conta reativada." };
      default: return { ok: false, erro: "Ação desconhecida." };
    }
  });
}

export async function concederPapel(_p: AcaoState, fd: FormData): Promise<AcaoState> {
  const s = await requireAdmin();
  const scope = String(fd.get("escopo") ?? "global"); // "global" | "grupo:<id>" | "regiao:<id>" | "ministerio:<id>"
  const [scopeType, scopeId] = scope.includes(":") ? scope.split(":") : ["global", null];
  return run(async () => {
    await grantRole(db, s, { userId: String(fd.get("id")), role: String(fd.get("papel")) as Role, scopeType: scopeType as ScopeType, scopeId: scopeId ?? null });
    return { ok: true, msg: "Papel concedido." };
  });
}

export async function revogarPapel(_p: AcaoState, fd: FormData): Promise<AcaoState> {
  const s = await requireAdmin();
  return run(async () => { await revokeRole(db, s, String(fd.get("papelId"))); return { ok: true, msg: "Papel revogado." }; });
}
