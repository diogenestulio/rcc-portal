/**
 * Cria (ou reativa) uma conta da equipe e atribui papéis globais. Cadastro público é desligado,
 * então este é o caminho para o PRIMEIRO acesso. O MFA é configurado no primeiro login.
 *
 * Uso:  ADMIN_PASSWORD='senha-forte-12+' npx tsx scripts/create-admin.mts email@dominio "Nome" papel1,papel2
 * A senha vem de variável de ambiente para não ficar no histórico do shell como argumento.
 */
import "dotenv/config";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { audit } from "../src/server/audit";

const [email, name, rolesArg] = process.argv.slice(2);
const password = process.env.ADMIN_PASSWORD;
const ROLES = ["admin_tecnico", "gestor_institucional", "editor", "revisor", "gestor_eventos", "operador_loja", "responsavel_local", "intercessor"];
if (!email || !name || !password || password.length < 12) { console.error("Uso: ADMIN_PASSWORD=... create-admin.mts email nome papeis (senha com 12+ caracteres)"); process.exit(1); }
const roles = (rolesArg ?? "gestor_institucional").split(",").map((r) => r.trim());
if (roles.some((r) => !ROLES.includes(r))) { console.error(`Papéis válidos: ${ROLES.join(", ")}`); process.exit(1); }

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const hash = await hashPassword(password);
let userId = "";
await sql.begin(async (tx) => {
  const [u] = await tx`select id from "user" where email = ${email.toLowerCase()}`;
  const id = u?.id ?? randomUUID();
  if (!u) {
    await tx`insert into "user" (id, name, email, email_verified, active) values (${id}, ${name}, ${email.toLowerCase()}, true, true)`;
    await tx`insert into account (id, account_id, provider_id, user_id, password) values (${randomUUID()}, ${id}, 'credential', ${id}, ${hash})`;
  } else {
    await tx`update "user" set active = true, name = ${name} where id = ${id}`;
    await tx`update account set password = ${hash} where user_id = ${id} and provider_id = 'credential'`;
  }
  for (const r of roles) await tx`insert into role_assignment (user_id, role, scope_type) values (${id}, ${r}, 'global') on conflict do nothing`;
  userId = id;
});
// Auditoria pela mesma função da aplicação (mantém a cadeia de hash íntegra)
await audit(drizzle(sql) as never, { action: "usuario.bootstrap", resourceType: "user", resourceId: userId, detail: { papeis: roles } });
console.log(`Conta pronta para ${email} com papéis: ${roles.join(", ")}. Configure o MFA no primeiro acesso em /entrar.`);
await sql.end();
