import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "@/db";
import { event, registration } from "@/db/schema";
import { Badge, Container, Notice } from "@/components/ui";
import { fmtDateOnly, fmtDateTime } from "@/components/site/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Comprovante de inscrição", robots: { index: false, follow: false } };

const LABEL = {
  confirmada: ["Inscrição confirmada", "sucesso"], reservada: ["Aguardando confirmação do pagamento", "alerta"], lista_espera: ["Lista de espera", "info"],
  cancelada: ["Cancelada", "perigo"], expirada: ["Reserva expirada", "neutro"], em_resolucao: ["Em análise pela organização", "alerta"],
} as const;

export default async function Comprovante({ params }: PageProps<"/inscricao/[token]">) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const [row] = await db.select({ r: registration, ev: event }).from(registration).innerJoin(event, eq(event.id, registration.eventId)).where(eq(registration.publicToken, token));
  if (!row) notFound();
  const { r, ev } = row;
  const [label, tone] = LABEL[r.status];
  // O QR contém SOMENTE o token opaco — nenhum dado pessoal.
  const qr = r.status === "confirmada" ? await QRCode.toString(token, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1f1b16", light: "#ffffff" } }) : null;

  return (
    <Container narrow className="py-10">
      <p className="text-sm font-semibold uppercase tracking-wider text-dourado-texto">Comprovante</p>
      <h1 className="mt-2 text-4xl font-semibold">{ev.title}</h1>
      <p className="mt-2 text-tinta-2">{ev.allDay ? fmtDateOnly(ev.startDate!) : fmtDateTime(ev.startsAt!)}{ev.location ? ` · ${ev.location}` : ""}</p>
      <div className="mt-4"><Badge tone={tone}>{label}</Badge></div>

      {r.status === "reservada" && <div className="mt-6"><Notice tone="alerta">Sua vaga está reservada até a confirmação do pagamento pelo provedor. Voltar do site de pagamento não confirma a inscrição sozinho — esta página será atualizada quando o pagamento for validado.</Notice></div>}
      {r.status === "lista_espera" && <div className="mt-6"><Notice>Você está na lista de espera (posição {r.waitlistPosition}). Avisaremos por e-mail se uma vaga for liberada.</Notice></div>}

      <div className="mt-8 grid gap-6 rounded-[var(--radius-lg)] border border-linha bg-papel p-6 sm:grid-cols-[1fr_auto]">
        <dl className="space-y-3">
          <div><dt className="text-sm text-tinta-3">Participante</dt><dd className="font-semibold">{r.fullName}</dd></div>
          <div><dt className="text-sm text-tinta-3">Código</dt><dd className="font-mono text-sm break-all">{token}</dd></div>
          {r.checkedInAt && <div><dt className="text-sm text-tinta-3">Presença</dt><dd>Check-in realizado</dd></div>}
        </dl>
        {qr && <div className="h-44 w-44" role="img" aria-label="QR Code para check-in no evento" dangerouslySetInnerHTML={{ __html: qr }} />}
      </div>
      <p className="mt-6 text-sm text-tinta-2">Guarde este endereço: ele é o seu comprovante. Não compartilhe o código. <Link href={`/agenda/${ev.slug}`}>Ver detalhes do evento</Link>.</p>
    </Container>
  );
}
