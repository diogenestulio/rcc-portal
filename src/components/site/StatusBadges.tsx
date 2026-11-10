import { displayStatus, type AgendaItem } from "@/server/events";
import { Badge, DemoBadge } from "@/components/ui";

export function StatusBadges({ o }: { o: AgendaItem }) {
  const st = o.cancelled ? "cancelado" : displayStatus(o.ev);
  return (
    <>
      {st === "cancelado" && <Badge tone="perigo">Cancelado</Badge>}
      {st === "adiado" && <Badge tone="alerta">Adiado</Badge>}
      {st === "encerrado" && <Badge>Encerrado</Badge>}
      {o.modified && !o.cancelled && <Badge tone="info">Horário ou local alterado</Badge>}
      {o.ev.registrationEnabled && st === "agendado" && <Badge tone="sucesso">Com inscrição</Badge>}
      <DemoBadge show={o.ev.isDemo} />
    </>
  );
}

