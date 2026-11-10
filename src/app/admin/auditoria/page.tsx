import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { requireCan } from "@/server/session";
import { verifyAuditChain } from "@/server/audit";
import { Notice } from "@/components/ui";

export const metadata = { title: "Auditoria" };

export default async function Auditoria() {
  await requireCan("auditoria.ler");
  const [rows, broken] = await Promise.all([db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(200), verifyAuditChain(db)]);
  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-semibold">Auditoria</h1>
      <div className="mt-4">{broken == null
        ? <Notice tone="sucesso">Cadeia de integridade verificada: nenhum registro alterado.</Notice>
        : <Notice tone="perigo" title="Inconsistência na cadeia">Registro {broken} não confere. Siga o runbook de incidente (docs/08-runbooks.md).</Notice>}</div>
      <table className="mt-6 w-full border-collapse bg-papel text-left text-sm">
        <thead className="bg-marfim-2"><tr><th scope="col" className="p-2">Quando (UTC)</th><th scope="col" className="p-2">Ação</th><th scope="col" className="p-2">Recurso</th><th scope="col" className="p-2">Ator</th><th scope="col" className="p-2">Resultado</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id} className="border-t border-linha">
            <td className="whitespace-nowrap p-2">{r.at.toISOString().slice(0, 19).replace("T", " ")}</td>
            <td className="p-2">{r.action}</td>
            <td className="p-2">{r.resourceType}{r.resourceId ? `:${r.resourceId.slice(0, 8)}` : ""}</td>
            <td className="p-2">{r.actorId?.slice(0, 8) ?? "sistema"}</td>
            <td className="p-2">{r.result}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
