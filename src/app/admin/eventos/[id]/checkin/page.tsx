import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { event } from "@/db/schema";
import { requireAdmin } from "@/server/session";
import { assertCan } from "@/server/authz";
import { btn, field, Notice } from "@/components/ui";
import { fazerCheckin } from "../../actions";

export const metadata = { title: "Check-in" };
const MSG: Record<string, [string, "sucesso" | "perigo" | "alerta"]> = {
  ok: ["Check-in registrado", "sucesso"], ja_utilizado: ["Este comprovante JÁ foi utilizado", "perigo"], invalido: ["Código não encontrado", "perigo"],
  outro_evento: ["Comprovante de OUTRO evento", "perigo"], nao_confirmada: ["Inscrição não confirmada (pagamento pendente, cancelada ou em espera)", "alerta"],
  negado: ["Sem permissão para check-in neste evento", "perigo"],
};

export default async function Checkin({ params, searchParams }: PageProps<"/admin/eventos/[id]/checkin">) {
  const s = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [ev] = await db.select().from(event).where(eq(event.id, id));
  if (!ev) notFound();
  assertCan(s, "evento.checkin", { groupId: ev.groupId });
  const m = typeof sp.r === "string" ? MSG[sp.r] : null;
  return (
    <div className="max-w-xl">
      <p><Link href={`/admin/eventos/${id}`}>← {ev.title}</Link></p>
      <h1 className="mt-3 text-3xl font-semibold">Check-in</h1>
      <p className="text-tinta-2">Leia o QR Code com a câmera do celular (ele contém só o código do comprovante) e cole aqui, ou digite o código.</p>
      {m && <div className="mt-4"><Notice tone={m[1]} title={m[0]}>{sp.r === "ok" && typeof sp.n === "string" ? sp.n : " "}</Notice></div>}
      <form action={fazerCheckin} className="mt-6 space-y-3">
        <input type="hidden" name="id" value={id} />
        <label htmlFor="codigo" className={field.label}>Código ou endereço do comprovante</label>
        <input id="codigo" name="codigo" required autoFocus autoComplete="off" className={field.input} />
        <button className={btn.primario}>Validar</button>
      </form>
    </div>
  );
}
