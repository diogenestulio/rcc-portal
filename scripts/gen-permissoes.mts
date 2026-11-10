/** Gera docs/05-permissoes.md a partir de src/server/authz.ts (fonte única). */
import { writeFileSync } from "node:fs";
import { ACTIONS, MATRIX, SENSITIVE, type Role } from "../src/server/authz";
const roles = Object.keys(MATRIX) as Role[];
const head = `# Matriz de permissões\n\nGerado por \`npm run docs:permissoes\` a partir de \`src/server/authz.ts\` — não edite à mão.\n\nRegras gerais: toda requisição é verificada no servidor; MFA é obrigatório para qualquer ação do painel; ações marcadas com 🔒 exigem login nos últimos 10 minutos; ações com escopo (grupo/região/ministério) só valem para os recursos daquele escopo; o administrador técnico **não** lê pedidos de oração.\n\n`;
const rows = Object.entries(ACTIONS).map(([a, d]) => `| ${SENSITIVE.has(a as never) ? "🔒 " : ""}\`${a}\` — ${d} | ${roles.map((r) => (MATRIX[r].includes(a as never) ? "✔" : "")).join(" | ")} |`);
writeFileSync("docs/05-permissoes.md", head + `| Ação | ${roles.join(" | ")} |\n|---|${roles.map(() => ":-:").join("|")}|\n` + rows.join("\n") + "\n");
console.log("docs/05-permissoes.md gerado");
