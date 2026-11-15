/**
 * Teste REAL da Google Agenda (conta de serviço + agenda compartilhada com ela).
 *   Homologação: docker compose exec worker node scripts/agenda-teste.mjs            -> testa acesso (cria e cancela 1 evento "[TESTE]")
 *                docker compose exec worker node scripts/agenda-teste.mjs --todos    -> agenda a projeção de todos os eventos publicados
 * Local:        npx tsx scripts/agenda-teste.mts [--todos]
 * Nunca imprime a chave nem o token. O evento de teste fica CANCELADO (não aparece para o público).
 */
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { GoogleHttpCalendarApi } from "../src/server/calendar/google";

const id = process.env.GOOGLE_CALENDAR_ID, key = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH, mode = process.env.GOOGLE_CALENDAR_MODE ?? "off";
const sair = (msg: string): never => { console.error(msg); process.exit(1); };
if (!id || !key) sair("Faltam GOOGLE_CALENDAR_ID e/ou GOOGLE_SERVICE_ACCOUNT_JSON_PATH no .env.");
if (!existsSync(key!)) sair(`Arquivo da chave não encontrado em ${key} (confira o volume "segredos" e as permissões).`);
let email = "";
try { email = (JSON.parse(readFileSync(key!, "utf8")) as { client_email?: string }).client_email ?? ""; }
catch { sair("O arquivo da chave não é um JSON válido (baixe de novo a chave da conta de serviço)."); }
console.log(`Conta de serviço: ${email}\nAgenda: ${id}\nModo no .env: ${mode}`);

const api = new GoogleHttpCalendarApi(id!, key!);

if (process.argv.includes("--todos")) {
  if (mode !== "cms_to_google") sair("Use --todos só com GOOGLE_CALENDAR_MODE=cms_to_google.");
  const { db } = await import("../src/db");
  const { event } = await import("../src/db/schema");
  const { enqueue } = await import("../src/server/jobs");
  const evs = await db.select({ id: event.id }).from(event).where(and(eq(event.source, "cms"), eq(event.publication, "publicado")));
  for (const e of evs) await enqueue(db, "gcal.projetar", { eventId: e.id }, { dedupeKey: `gcal:${e.id}` });
  console.log(`${evs.length} evento(s) publicado(s) enviados para a fila; o worker projeta em até 1 min.`);
  process.exit(0);
}

const passo = async <T,>(nome: string, f: () => Promise<T>) => {
  try { const r = await f(); console.log(`OK   ${nome}`); return r; }
  catch (e) {
    const m = (e as Error).message;
    const dica = /DECODER|PEM|private key|asn1/i.test(m) ? " → arquivo da chave corrompido ou incompleto (baixe uma nova chave JSON)."
      : /token Google: HTTP 400|401/.test(m) ? " → chave inválida, revogada ou relógio errado."
      : /403/.test(m) ? " → a API Google Calendar não está ativada no projeto, ou a agenda não foi compartilhada com a conta de serviço com 'Fazer alterações nos eventos'."
      : /404/.test(m) ? " → ID da agenda errado, ou agenda não compartilhada com a conta de serviço." : "";
    return sair(`FALHA ${nome}: ${m}${dica}`);
  }
};

await passo("ler a agenda", () => api.list({}));
const amanha = new Date(Date.now() + 86_400_000);
const fim = new Date(amanha.getTime() + 3_600_000);
const evId = `rccteste${Date.now().toString(32)}`; // base32hex (0-9, a-v), aceito como ID pelo Google
await passo("criar evento de teste", () => api.upsert({
  id: evId, summary: "[TESTE] Portal RCC — pode ignorar", description: "Criado por scripts/agenda-teste.mts e cancelado em seguida.",
  start: { dateTime: amanha.toISOString(), timeZone: "America/Cuiaba" }, end: { dateTime: fim.toISOString(), timeZone: "America/Cuiaba" }, visibility: "public",
}));
await passo("alterar evento de teste", () => api.upsert({
  id: evId, summary: "[TESTE] Portal RCC — alterado", start: { dateTime: amanha.toISOString(), timeZone: "America/Cuiaba" },
  end: { dateTime: fim.toISOString(), timeZone: "America/Cuiaba" }, visibility: "public",
}));
await passo("cancelar evento de teste", () => api.cancel(evId));
console.log("\nTudo certo: o portal consegue publicar na agenda. Próximo passo: GOOGLE_CALENDAR_MODE=cms_to_google, reiniciar e rodar com --todos.");
process.exit(0);
