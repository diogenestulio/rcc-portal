import Link from "next/link";
import { db } from "@/db";
import { requireAdmin } from "@/server/session";
import { decide } from "@/server/authz";
import { listUsers, ROLE_LABEL } from "@/server/users";
import { Badge, Card, Notice } from "@/components/ui";
import { ReauthNotice } from "@/components/Reauth";
import { fmtPublished } from "@/components/site/format";
import { CreateUserForm } from "./UserForms";

export const metadata = { title: "Usuários e papéis" };

export default async function Usuarios() {
  const s = await requireAdmin();
  const d = decide(s, "usuarios.gerenciar");
  if (!d.ok) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold">Usuários e papéis</h1>
        <div className="mt-6">{d.reason === "reautenticar" ? <ReauthNotice back="/admin/usuarios" /> : <Notice tone="alerta">Você não tem permissão para gerenciar usuários.</Notice>}</div>
      </div>
    );
  }
  const users = await listUsers(db, s);
  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-semibold">Usuários e papéis</h1>
      <p className="mt-1 text-tinta-2">Não há cadastro público: as contas da equipe são criadas aqui. Cada ação fica registrada na auditoria.</p>
      <Card className="mt-6">
        <h2 className="text-xl font-semibold">Nova conta</h2>
        <div className="mt-4"><CreateUserForm /></div>
      </Card>
      <table className="mt-8 w-full border-collapse bg-papel text-left">
        <thead className="bg-marfim-2 text-sm"><tr><th scope="col" className="p-3">Pessoa</th><th scope="col" className="p-3">Papéis</th><th scope="col" className="p-3">Segurança</th><th scope="col" className="p-3">Último acesso</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className={`border-t border-linha ${u.active ? "" : "opacity-60"}`}>
              <td className="p-3"><Link href={`/admin/usuarios/${u.id}`} className="font-semibold">{u.name}</Link>{u.id === s.userId && <span className="ml-1 text-sm text-tinta-3">(você)</span>}<span className="block text-sm text-tinta-3">{u.email}</span></td>
              <td className="p-3 text-sm">{u.roles.length === 0 ? <span className="text-tinta-3">sem papel</span> : u.roles.map((r) => <span key={r.id} className="block">{ROLE_LABEL[r.role]}{r.scope_type !== "global" ? ` — ${r.scope_name ?? r.scope_type}` : ""}</span>)}</td>
              <td className="space-x-1 p-3">
                {!u.active && <Badge tone="perigo">Desativada</Badge>}
                {u.mfa ? <Badge tone="sucesso">MFA ativo</Badge> : <Badge tone="alerta">Sem MFA</Badge>}
                {u.must_change && <Badge tone="info">Senha provisória</Badge>}
              </td>
              <td className="p-3 text-sm">{u.last_seen ? fmtPublished(u.last_seen) : "nunca"}{u.sessions > 0 && <span className="block text-tinta-3">{u.sessions} sessão(ões) aberta(s)</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
