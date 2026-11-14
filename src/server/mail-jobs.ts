/** Tarefas de e-mail da fila (usadas pelo worker; testadas em tests/mail.test.ts). */
import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as schema from "@/db/schema";
import type { JobHandler } from "./jobs";
import { deliver, render, type MailEnv } from "./mail";

const TZ = process.env.INSTITUTION_TIMEZONE || "America/Cuiaba";
const quando = (ev: typeof schema.event.$inferSelect) => {
  const f = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...o }).format(d);
  if (ev.allDay) return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${ev.startDate}T12:00:00Z`));
  return `${f(ev.startsAt!, { weekday: "long", day: "numeric", month: "long" })}, ${f(ev.startsAt!, { hour: "2-digit", minute: "2-digit" })}`;
};

export function emailHandlers(db: DB, env: MailEnv & { APP_URL: string }, instituicao: string): Record<string, JobHandler> {
  return {
    "email.inscricao": async (p) => {
      const [row] = await db.select({ r: schema.registration, ev: schema.event }).from(schema.registration)
        .innerJoin(schema.event, eq(schema.event.id, schema.registration.eventId)).where(eq(schema.registration.id, String(p.registrationId)));
      if (!row) return;
      const { r, ev } = row;
      const comprovante = `${env.APP_URL}/inscricao/${r.publicToken}`;
      const t = String(p.template);
      // Só envia se o estado ainda corresponde (ex.: cancelada depois de enfileirar → não confirma).
      if (t === "confirmada" && r.status !== "confirmada") return;
      if (t === "lista_espera" && r.status !== "lista_espera") return;
      const msg = t === "confirmada" ? render({ kind: "inscricao_confirmada", nome: r.fullName, evento: ev.title, quando: quando(ev), local: ev.location, comprovante }, instituicao)
        : t === "lista_espera" ? render({ kind: "inscricao_lista_espera", nome: r.fullName, evento: ev.title, posicao: r.waitlistPosition, comprovante }, instituicao)
        : render({ kind: "inscricao_vaga_liberada", nome: r.fullName, evento: ev.title, comprovante }, instituicao);
      await deliver(env, r.email, msg);
    },
    "email.pedido": async (p) => {
      const [o] = await db.select().from(schema.order).where(eq(schema.order.id, String(p.orderId)));
      if (o) await deliver(env, o.customerEmail, render({ kind: "pedido_pago", nome: o.customerName, pedido: `${env.APP_URL}/pedido/${o.publicToken}` }, instituicao));
    },
    "email.redefinir_senha": async (p) => {
      const [u] = await db.select().from(schema.user).where(eq(schema.user.id, String(p.userId)));
      if (!u?.active) return; // conta desativada não recebe link
      const link = String(p.url);
      if (!link.startsWith(`${env.APP_URL}/`)) throw new Error("link de redefinição fora do portal");
      await deliver(env, u.email, render({ kind: "redefinir_senha", nome: u.name, link, validadeMin: 30 }, instituicao));
    },
  };
}
