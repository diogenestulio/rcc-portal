"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireAdmin } from "@/server/session";
import { approveRevision, archive, createDraft, editContent, publish, returnToDraft, submitForReview, WorkflowError, type Nature } from "@/server/content";
import { ForbiddenError } from "@/server/authz";
import { textToHtml } from "@/server/richtext";

const KINDS = ["pagina", "noticia", "formacao", "comunicado"] as const;
const NATURES = ["doutrina", "orientacao_pastoral", "devocao", "testemunho", "institucional", "noticia"] as const;

function input(fd: FormData) {
  const nature = String(fd.get("natureza"));
  if (!NATURES.includes(nature as Nature)) throw new WorkflowError("Natureza inválida.");
  const title = String(fd.get("titulo") ?? "").trim();
  if (title.length < 3 || title.length > 200) throw new WorkflowError("Título entre 3 e 200 caracteres.");
  return {
    title, summary: String(fd.get("resumo") ?? "").trim().slice(0, 400) || null,
    bodyHtml: textToHtml(String(fd.get("texto") ?? "").slice(0, 100_000)), nature: nature as Nature,
    authorName: String(fd.get("autor") ?? "").trim().slice(0, 120) || null,
    sourceReference: String(fd.get("fontes") ?? "").trim().slice(0, 1000) || null,
    rightsNotice: String(fd.get("direitos") ?? "").trim().slice(0, 300) || null,
  };
}

const msg = (e: unknown) => e instanceof ForbiddenError
  ? (e.reason === "reautenticar" ? "Por segurança, entre novamente para esta ação." : "Você não tem permissão para esta ação.")
  : e instanceof WorkflowError ? e.message : null;

async function run(back: string, fn: () => Promise<unknown>, ok: string) {
  try { await fn(); }
  catch (e) { const m = msg(e); if (!m) throw e; redirect(`${back}${back.includes("?") ? "&" : "?"}erro=${encodeURIComponent(m)}`); }
  revalidatePath("/", "layout"); // invalida páginas públicas após mudança editorial
  redirect(ok);
}

export async function criar(fd: FormData) {
  const s = await requireAdmin();
  const kind = String(fd.get("tipo"));
  if (!KINDS.includes(kind as (typeof KINDS)[number])) redirect("/admin/conteudo/novo?erro=Tipo%20inv%C3%A1lido");
  let id: string;
  try {
    id = (await createDraft(db, s, { kind: kind as (typeof KINDS)[number], slug: String(fd.get("slug") ?? "").trim(), ...input(fd) })).itemId;
  } catch (e) {
    const m = msg(e) ?? (String((e as { cause?: { code?: string } })?.cause?.code) === "23505" ? "Já existe um conteúdo com este endereço." : null);
    if (!m) throw e;
    redirect(`/admin/conteudo/novo?erro=${encodeURIComponent(m)}`);
  }
  redirect(`/admin/conteudo/${id}?ok=criado`);
}

export async function salvar(fd: FormData) {
  const s = await requireAdmin();
  const id = String(fd.get("id"));
  await run(`/admin/conteudo/${id}`, () => editContent(db, s, id, input(fd)), `/admin/conteudo/${id}?ok=salvo`);
}

export async function transicao(fd: FormData) {
  const s = await requireAdmin();
  const id = String(fd.get("id"));
  const acao = String(fd.get("acao"));
  const back = `/admin/conteudo/${id}`;
  const note = String(fd.get("nota") ?? "").slice(0, 1000);
  const fns: Record<string, () => Promise<unknown>> = {
    enviar: () => submitForReview(db, s, id),
    aprovar: () => approveRevision(db, s, id, String(fd.get("revisao")), note || undefined),
    devolver: () => returnToDraft(db, s, id, note || "Devolvido para ajustes."),
    publicar: () => { const at = String(fd.get("quando") ?? ""); return publish(db, s, id, at ? new Date(`${at}:00-04:00`) : undefined); },
    arquivar: () => archive(db, s, id),
  };
  if (!fns[acao]) redirect(back);
  await run(back, fns[acao], `${back}?ok=${acao}`);
}
