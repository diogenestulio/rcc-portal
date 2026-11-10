"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { currentSubject } from "@/server/session";
import { markPasswordChanged } from "@/server/users";

export type SenhaState = null | { ok: true } | { ok: false; erro: string };

/**
 * Troca de senha feita NO SERVIDOR pela biblioteca de autenticação (confere a senha atual) e só
 * então libera a marca de senha provisória — não há como limpar a marca sem trocar a senha.
 */
export async function trocarSenha(_prev: SenhaState, fd: FormData): Promise<SenhaState> {
  const s = await currentSubject();
  if (!s) return { ok: false, erro: "Sessão expirada. Entre novamente." };
  const atual = String(fd.get("atual") ?? "");
  const nova = String(fd.get("nova") ?? "");
  if (nova !== String(fd.get("confirma") ?? "")) return { ok: false, erro: "As duas senhas novas não são iguais." };
  if (nova.length < 12 || nova.length > 128) return { ok: false, erro: "A nova senha precisa ter de 12 a 128 caracteres." };
  if (nova === atual) return { ok: false, erro: "A nova senha precisa ser diferente da atual." };
  try {
    await auth.api.changePassword({ body: { currentPassword: atual, newPassword: nova, revokeOtherSessions: true }, headers: await headers() });
  } catch {
    return { ok: false, erro: "Senha atual incorreta." };
  }
  await markPasswordChanged(db, s.userId); // limpa a marca de provisória (se houver) e audita a troca
  // A biblioteca encerra as outras sessões e emite um cookie novo; redirecionar faz a próxima página
  // ser carregada já com ele (redesenhar esta página com o cookie antigo levaria ao login).
  const next = String(fd.get("next") ?? "");
  redirect(s.mustChangePassword ? (s.mfa ? "/admin" : "/entrar/mfa") : next === "/admin/conta" ? "/admin/conta?senha=1" : "/admin");
}
