import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { ministry, prayerGroup, region } from "@/db/schema";
import { requireAdmin } from "@/server/session";
import { decide, type Role } from "@/server/authz";
import { listUsers, ROLE_LABEL } from "@/server/users";
import { Badge, Card, Notice } from "@/components/ui";
import { ReauthNotice } from "@/components/Reauth";
import { AccountActions, GrantRoleForm, RevokeRoleButton, type ScopeOption } from "../UserForms";

export const metadata = { title: "Conta" };

export default async function Conta({ params }: PageProps<"/admin/usuarios/[id]">) {
  const s = await requireAdmin();
  const { id } = await params;
  const back = `/admin/usuarios/${id}`;
  const d = decide(s, "usuarios.gerenciar");
  if (!d.ok) return <div className="max-w-3xl">{d.reason === "reautenticar" ? <ReauthNotice back={back} /> : <Notice tone="alerta">Sem permissão.</Notice>}</div>;
  const u = (await listUsers(db, s)).find((x) => x.id === id);
  if (!u) notFound();
  const self = u.id === s.userId;
  const canGrant = decide(s, "papeis.conceder").ok;
  const [groups, regions, ministries] = await Promise.all([
    db.select({ id: prayerGroup.id, name: prayerGroup.name }).from(prayerGroup).orderBy(prayerGroup.name),
    db.select({ id: region.id, name: region.name }).from(region).orderBy(region.name),
    db.select({ id: ministry.id, name: ministry.name }).from(ministry).orderBy(ministry.name),
  ]);
  const scopes: ScopeOption[] = [
    { value: "global", label: "Global (toda a RCC)" },
    ...regions.map((r) => ({ value: `regiao:${r.id}`, label: `Região: ${r.name}` })),
    ...groups.map((g) => ({ value: `grupo:${g.id}`, label: `Grupo: ${g.name}` })),
    ...ministries.map((m) => ({ value: `ministerio:${m.id}`, label: `Ministério: ${m.name}` })),
  ];
  const roles = (Object.keys(ROLE_LABEL) as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }));

  return (
    <div className="max-w-4xl">
      <p><Link href="/admin/usuarios">← Usuários</Link></p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="text-3xl font-semibold">{u.name}</h1>
        {!u.active && <Badge tone="perigo">Desativada</Badge>}
        {u.mfa ? <Badge tone="sucesso">MFA ativo</Badge> : <Badge tone="alerta">Sem MFA</Badge>}
        {u.must_change && <Badge tone="info">Senha provisória</Badge>}
      </div>
      <p className="text-tinta-2">{u.email}</p>
      {self && <div className="mt-4"><Notice tone="info">Esta é a sua conta. Para trocar sua senha ou encerrar suas sessões, use <Link href="/admin/conta">Minha conta</Link>. Seus papéis só podem ser alterados por outro gestor.</Notice></div>}

      <Card className="mt-6">
        <h2 className="text-xl font-semibold">Papéis</h2>
        {u.roles.length === 0 ? <p className="mt-2 text-tinta-3">Sem papel: a pessoa entra, mas não acessa nada do painel.</p> : (
          <ul className="mt-3 space-y-2">
            {u.roles.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3">
                <span className="font-semibold">{ROLE_LABEL[r.role]}</span>
                <span className="text-sm text-tinta-2">{r.scope_type === "global" ? "global" : `${r.scope_type}: ${r.scope_name ?? r.scope_id}`}</span>
                {canGrant && !self && <RevokeRoleButton papelId={r.id} label={ROLE_LABEL[r.role]} />}
              </li>
            ))}
          </ul>
        )}
        {canGrant && !self && u.active && <div className="mt-6 border-t border-linha pt-4"><GrantRoleForm id={u.id} roles={roles} scopes={scopes} /></div>}
      </Card>

      {!self && (
        <Card className="mt-6">
          <h2 className="text-xl font-semibold">Acesso</h2>
          <p className="mt-1 text-sm text-tinta-2">{u.sessions} sessão(ões) aberta(s). Ao desativar, gerar senha ou zerar o MFA, todas são encerradas.</p>
          <div className="mt-4"><AccountActions id={u.id} active={u.active} /></div>
        </Card>
      )}
    </div>
  );
}
