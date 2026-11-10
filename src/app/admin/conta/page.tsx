import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { session } from "@/db/schema";
import { requireAdmin } from "@/server/session";
import { ROLE_LABEL } from "@/server/users";
import { PasswordChangeForm } from "@/components/PasswordChangeForm";
import { fmtPublished } from "@/components/site/format";
import { encerrarOutrasSessoes } from "./actions";
import { btn, Card } from "@/components/ui";

export const metadata = { title: "Minha conta" };

function device(ua: string | null) {
  if (!ua) return "Dispositivo desconhecido";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Outro";
  const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "navegador";
  return `${br} em ${os}`;
}

export default async function MinhaConta({ searchParams }: PageProps<"/admin/conta">) {
  const s = await requireAdmin();
  const sp = await searchParams;
  const sessions = await db.select({ id: session.id, ua: session.userAgent, createdAt: session.createdAt, updatedAt: session.updatedAt })
    .from(session).where(and(eq(session.userId, s.userId), gt(session.expiresAt, new Date()))).orderBy(desc(session.updatedAt));
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold">Minha conta</h1>
      <p className="mt-1 text-tinta-2">{s.name} · {s.email}</p>
      <p className="text-sm text-tinta-3">{s.assignments.map((a) => ROLE_LABEL[a.role]).join(", ")}</p>

      <Card className="mt-6">
        <h2 className="text-xl font-semibold">Sessões abertas</h2>
        {sp.ok && <p role="status" className="mt-2 font-semibold text-verde">Outras sessões encerradas.</p>}
        <ul className="mt-3 space-y-2">
          {sessions.map((x) => (
            <li key={x.id} className="text-sm"><span className="font-semibold">{device(x.ua)}</span> · desde {fmtPublished(x.createdAt)}{x.id === s.sessionId && <span className="ml-2 text-verde">(esta)</span>}</li>
          ))}
        </ul>
        {sessions.length > 1 && <form action={encerrarOutrasSessoes} className="mt-4"><button className={btn.secundario}>Encerrar as outras sessões</button></form>}
      </Card>

      <Card className="mt-6">
        <h2 className="text-xl font-semibold">Trocar senha</h2>
        {sp.senha && <p role="status" className="mt-2 font-semibold text-verde">Senha alterada. As outras sessões desta conta foram encerradas.</p>}
        <PasswordChangeForm next="/admin/conta" />
      </Card>
    </div>
  );
}
