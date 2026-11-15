/**
 * Alertas operacionais por Telegram.
 *
 * - O worker roda as verificações a cada minuto (`collectChecks`) e o `AlertTracker` decide o que enviar:
 *   problema novo (confirmado em `confirmAfter` verificações seguidas, padrão 2 — evita alarme falso em reinícios) → 🔴; problema que continua → lembrete a cada `repeatMs` (padrão 6 h); problema resolvido → ✅.
 * - O estado fica em memória do worker: reiniciar o worker reenvia uma vez os alertas ainda ativos (de propósito).
 * - As mensagens NUNCA levam dados pessoais, textos de oração, e-mails, tokens ou conteúdo de payloads:
 *   só contagens, tipos de tarefa e horários.
 * - Sem Telegram configurado, os alertas só vão para o log (JSON) do worker.
 */
import { sql } from "drizzle-orm";
import type { DB } from "@/db";
import { verifyAuditChain } from "@/server/audit";

export type Check = { key: string; title: string; ok: boolean; detail?: string };
export type Outgoing = { key: string; kind: "novo" | "lembrete" | "resolvido"; text: string };
type State = { since: number; lastSent: number; title: string };

const fmtDur = (ms: number) => {
  const m = Math.round(ms / 60_000);
  return m < 60 ? `${m} min` : m < 48 * 60 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} dias`;
};

export class AlertTracker {
  private active = new Map<string, State>();
  private streak = new Map<string, number>();
  constructor(private label: string, private repeatMs = 6 * 3600_000, private confirmAfter = 2) {}

  /** O que precisa ser enviado agora. Só as chaves presentes em `checks` são avaliadas (as ausentes não mudam). */
  plan(checks: Check[], now = Date.now()): Outgoing[] {
    const out: Outgoing[] = [];
    for (const c of checks) {
      const st = this.active.get(c.key);
      const det = c.detail ? `\n${c.detail}` : "";
      const n = c.ok ? 0 : (this.streak.get(c.key) ?? 0) + 1;
      this.streak.set(c.key, n);
      if (!c.ok && !st && n >= this.confirmAfter) out.push({ key: c.key, kind: "novo", text: `🔴 ${this.label} — ${c.title}${det}` });
      else if (!c.ok && st && now - st.lastSent >= this.repeatMs)
        out.push({ key: c.key, kind: "lembrete", text: `🔴 ${this.label} — continua há ${fmtDur(now - st.since)}: ${c.title}${det}` });
      else if (c.ok && st) out.push({ key: c.key, kind: "resolvido", text: `✅ ${this.label} — resolvido após ${fmtDur(now - st.since)}: ${st.title}` });
    }
    return out;
  }

  /** Confirma um envio bem-sucedido (se o envio falhar, o mesmo aviso é planejado de novo no próximo ciclo). */
  markSent(o: Outgoing, title: string, now = Date.now()) {
    if (o.kind === "resolvido") this.active.delete(o.key);
    else if (o.kind === "novo") this.active.set(o.key, { since: now, lastSent: now, title });
    else { const st = this.active.get(o.key); if (st) st.lastSent = now; }
  }

  activeKeys() { return [...this.active.keys()]; }
}

export type TelegramConfig = { token?: string; chatId?: string };
export const telegramEnabled = (c: TelegramConfig) => !!(c.token && c.chatId);

/** Envia texto simples (sem parse_mode: nada no texto é interpretado como HTML/Markdown). */
export async function sendTelegram(c: TelegramConfig, text: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (!telegramEnabled(c)) throw new Error("Telegram não configurado");
  const res = await fetchImpl(`https://api.telegram.org/bot${c.token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: c.chatId, text: text.slice(0, 3500), disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    // Nunca repassar a URL (contém o token) para logs; só o código e a descrição do Telegram.
    let desc = ""; try { desc = String(((await res.json()) as { description?: string }).description ?? ""); } catch { /* sem corpo */ }
    throw new Error(`Telegram respondeu ${res.status}${desc ? `: ${desc.slice(0, 120)}` : ""}`);
  }
}

export const BACKUP_KEY = "backup";
export const EXTERNAL_BACKUP_KEY = "backup.externo";

async function backupCheck(db: DB, key: string, title: string, maxH: number, now: Date): Promise<Check> {
  const [b] = await db.execute<{ ok_at: Date | null; err_at: Date | null; err: string | null }>(sql`select last_success_at as ok_at,
    last_error_at as err_at, last_error as err from integration_state where key = ${key}`);
  const okAt = b?.ok_at ? new Date(b.ok_at) : null, errAt = b?.err_at ? new Date(b.err_at) : null;
  let ok = true, detail: string | undefined;
  if (errAt && (!okAt || errAt > okAt)) { ok = false; detail = `Última execução falhou: ${(b?.err ?? "sem detalhe").slice(0, 200)}`; }
  else if (!okAt) { ok = false; detail = "Nenhum backup registrado ainda."; }
  else if (now.getTime() - okAt.getTime() > maxH * 3600_000) { ok = false; detail = `Último backup bem-sucedido há ${fmtDur(now.getTime() - okAt.getTime())}.`; }
  return { key, title, ok, detail };
}

export type CheckOptions = {
  /** Verificar a cadeia da auditoria (mais pesado: o worker faz de hora em hora). */
  audit?: boolean;
  /** URL interna de saúde do portal (ex.: http://rcc-portal:3000/api/health). */
  healthUrl?: string;
  /** Endereço público (passa pelo nginx). Qualquer resposta abaixo de 500 conta como “no ar”. */
  publicUrl?: string;
  /** Exigir backup recente (homologação/produção). */
  expectBackup?: boolean;
  backupMaxAgeH?: number;
  /** Exigir cópia externa recente (feita pelo PC/NAS, que pode ficar desligado: limite padrão 50 h). */
  expectExternalBackup?: boolean;
  externalBackupMaxAgeH?: number;
  fetchImpl?: typeof fetch;
  now?: Date;
};

/** Executa as verificações. Lança exceção se o banco estiver inacessível (o worker trata como alerta “banco”). */
export async function collectChecks(db: DB, o: CheckOptions = {}): Promise<Check[]> {
  const now = o.now ?? new Date();
  const checks: Check[] = [];

  // Fila: tarefas atrasadas (e-mails, sincronizações…) e tarefas que desistiram após todas as tentativas.
  const late = await db.execute<{ type: string; n: number }>(sql`select type, count(*)::int as n from job
    where status = 'pendente' and run_at < ${now.toISOString()}::timestamptz - interval '15 minutes' group by type order by type`);
  checks.push({ key: "fila.atrasada", title: "tarefas atrasadas na fila", ok: late.length === 0,
    detail: late.length ? late.map((r) => `${r.type}: ${r.n}`).join(", ") : undefined });
  const dead = await db.execute<{ type: string; n: number; erro: string | null }>(sql`select type, count(*)::int as n,
      left(max(last_error), 120) as erro from job
    where status = 'morto' and created_at > ${now.toISOString()}::timestamptz - interval '7 days' group by type order by type`);
  checks.push({ key: "fila.morta", title: "tarefas que falharam em todas as tentativas (últimos 7 dias)", ok: dead.length === 0,
    detail: dead.length ? dead.map((r) => `${r.type}: ${r.n}${r.erro ? ` (último erro: ${r.erro})` : ""}`).join("\n") : undefined });

  // Backup: o script de backup registra sucesso/falha em integration_state (chave "backup");
  // a cópia externa (backup-externo.sh, no PC/NAS) registra na chave "backup.externo".
  if (o.expectBackup) checks.push(await backupCheck(db, BACKUP_KEY, "backup diário", o.backupMaxAgeH ?? 26, now));
  if (o.expectExternalBackup) checks.push(await backupCheck(db, EXTERNAL_BACKUP_KEY, "cópia externa do backup", o.externalBackupMaxAgeH ?? 50, now));

  if (o.audit) {
    const bad = await verifyAuditChain(db);
    checks.push({ key: "auditoria", title: "integridade da auditoria", ok: bad === null,
      detail: bad === null ? undefined : `Cadeia de hash inconsistente a partir do registro ${bad}. Não apague nada; ver runbook.` });
  }

  const f = o.fetchImpl ?? fetch;
  if (o.healthUrl) {
    let ok = false, detail: string | undefined;
    try {
      const r = await f(o.healthUrl, { signal: AbortSignal.timeout(8_000) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean };
      ok = r.ok && j.ok === true;
      if (!ok) detail = `Saúde interna respondeu ${r.status}.`;
    } catch (e) { detail = `Sem resposta do portal (${String((e as Error).name ?? e)}).`; }
    checks.push({ key: "portal", title: "portal fora do ar (verificação interna)", ok, detail });
  }
  if (o.publicUrl) {
    let ok = false, detail: string | undefined;
    try {
      const r = await f(o.publicUrl, { signal: AbortSignal.timeout(10_000), redirect: "manual" });
      ok = r.status < 500;
      if (!ok) detail = `Endereço público respondeu ${r.status}.`;
    } catch (e) { detail = `Endereço público sem resposta (${String((e as Error).name ?? e)}).`; }
    checks.push({ key: "publico", title: "endereço público inacessível", ok, detail });
  }
  return checks;
}
