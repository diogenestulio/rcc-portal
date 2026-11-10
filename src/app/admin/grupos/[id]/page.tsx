import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { prayerGroup } from "@/db/schema";
import { requireAdmin, canView } from "@/server/session";
import { assertCan } from "@/server/authz";
import { getPrivateContact, isStale } from "@/server/groups";
import { btn, field, Notice } from "@/components/ui";
import { fmtPublished, WEEKDAY_OPTIONS } from "@/components/site/format";
import { confirmar, publicar, salvarGrupo } from "../actions";

export const metadata = { title: "Editar grupo" };

export default async function EditGroup({ params, searchParams }: PageProps<"/admin/grupos/[id]">) {
  const s = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [g] = await db.select().from(prayerGroup).where(eq(prayerGroup.id, id));
  if (!g) notFound();
  assertCan(s, "grupo.editar", { groupId: g.id, regionId: g.regionId }); // fora do escopo → erro 500 genérico, auditado em requireCan
  const pc = await getPrivateContact(db, s, g.id);

  return (
    <div className="max-w-3xl">
      <p><Link href="/admin/grupos">← Grupos</Link></p>
      <h1 className="mt-3 text-3xl font-semibold">{g.name}</h1>
      <p className="text-sm text-tinta-3">Última confirmação: {g.lastConfirmedAt ? fmtPublished(g.lastConfirmedAt) : "nunca"}</p>
      {sp.ok && <div className="mt-4"><Notice tone="sucesso">Salvo.</Notice></div>}
      {sp.erro && <div className="mt-4"><Notice tone="perigo">Confira dia, horário e situação.</Notice></div>}
      {isStale(g.lastConfirmedAt) && (
        <div className="mt-4"><Notice tone="alerta" title="Confirmação pendente">
          Confira com o grupo se os dados continuam corretos e clique em “Confirmar dados”.
          <form action={confirmar} className="mt-2"><input type="hidden" name="id" value={g.id} /><button className={btn.secundario}>Confirmar dados</button></form>
        </Notice></div>
      )}
      <form action={salvarGrupo} className="mt-6 space-y-5">
        <input type="hidden" name="id" value={g.id} />
        <div><label htmlFor="nome" className={field.label}>Nome</label><input id="nome" name="nome" required defaultValue={g.name} className={field.input} /></div>
        <div className="grid gap-5 sm:grid-cols-3">
          <div><label htmlFor="dia" className={field.label}>Dia</label><select id="dia" name="dia" defaultValue={String(g.weekday)} className={field.input}>{WEEKDAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
          <div><label htmlFor="inicio" className={field.label}>Início</label><input id="inicio" name="inicio" type="time" required defaultValue={g.startTime.slice(0, 5)} className={field.input} /></div>
          <div><label htmlFor="fim" className={field.label}>Término</label><input id="fim" name="fim" type="time" defaultValue={g.endTime?.slice(0, 5) ?? ""} className={field.input} /></div>
        </div>
        <div><label htmlFor="local" className={field.label}>Local</label><input id="local" name="local" required defaultValue={g.venue} className={field.input} /></div>
        <div><label htmlFor="endereco" className={field.label}>Endereço público</label><input id="endereco" name="endereco" defaultValue={g.publicAddress ?? ""} className={field.input} /></div>
        <div><label htmlFor="acessibilidade" className={field.label}>Acessibilidade (informada pelo grupo)</label><input id="acessibilidade" name="acessibilidade" defaultValue={g.accessibilityInfo ?? ""} className={field.input} /></div>
        <div><label htmlFor="descricao" className={field.label}>Descrição</label><textarea id="descricao" name="descricao" rows={4} defaultValue={g.description ?? ""} className={field.input} /></div>
        <div><label htmlFor="contato_publico" className={field.label}>Contato institucional público</label><input id="contato_publico" name="contato_publico" defaultValue={g.publicContact ?? ""} className={field.input} /><p className={field.hint}>Ex.: secretaria da paróquia. Não use dados pessoais aqui.</p></div>
        <div><label htmlFor="situacao" className={field.label}>Situação</label><select id="situacao" name="situacao" defaultValue={g.status} className={field.input}><option value="ativo">Ativo</option><option value="pausado">Pausado</option><option value="a_confirmar">A confirmar</option><option value="encerrado">Encerrado</option></select></div>
        <fieldset className="rounded-[var(--radius-md)] border border-linha p-4">
          <legend className="px-1 font-semibold">Contato do coordenador (privado)</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label htmlFor="coord_nome" className={field.label}>Nome</label><input id="coord_nome" name="coord_nome" defaultValue={pc?.coordinatorName ?? ""} className={field.input} /></div>
            <div><label htmlFor="coord_tel" className={field.label}>Telefone</label><input id="coord_tel" name="coord_tel" type="tel" defaultValue={pc?.coordinatorPhone ?? ""} className={field.input} /></div>
            <div><label htmlFor="coord_email" className={field.label}>E-mail</label><input id="coord_email" name="coord_email" type="email" defaultValue={pc?.coordinatorEmail ?? ""} className={field.input} /></div>
          </div>
          <label className="mt-3 flex items-start gap-2"><input type="checkbox" name="autoriza_telefone" defaultChecked={pc?.phonePublicationAuthorized} className="mt-1.5 h-5 w-5" /> O coordenador autorizou expressamente a publicação do telefone</label>
        </fieldset>
        <button className={btn.primario}>Salvar</button>
      </form>
      {canView(s, "grupo.publicar") && (
        <form action={publicar} className="mt-8 border-t border-linha pt-6">
          <input type="hidden" name="id" value={g.id} /><input type="hidden" name="publicar" value={g.published ? "0" : "1"} />
          <button className={g.published ? btn.discreto : btn.secundario}>{g.published ? "Ocultar do portal" : "Publicar no portal"}</button>
        </form>
      )}
    </div>
  );
}
