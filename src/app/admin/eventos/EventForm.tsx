import { btn, field } from "@/components/ui";
import { htmlToText } from "@/server/richtext";
import type { event } from "@/db/schema";
import { utcToWall, pad } from "@/server/calendar/time";
import { salvarEvento } from "./actions";

const TZ = process.env.INSTITUTION_TIMEZONE || "America/Cuiaba";
const toLocalInput = (d: Date | null) => { if (!d) return ""; const w = utcToWall(d, TZ); return `${w.y}-${pad(w.m)}-${pad(w.d)}T${pad(w.h)}:${pad(w.mi)}`; };
const RREV: Record<string, string> = { "FREQ=WEEKLY": "semanal", "FREQ=WEEKLY;INTERVAL=2": "quinzenal", "FREQ=MONTHLY": "mensal" };

export function EventForm({ ev, groups, locked }: { ev?: typeof event.$inferSelect; groups: { id: string; name: string }[]; locked?: boolean }) {
  return (
    <form action={salvarEvento} className="space-y-5">
      {ev && <input type="hidden" name="id" value={ev.id} />}
      <fieldset disabled={locked} className="space-y-5">
        <div><label htmlFor="titulo" className={field.label}>Título</label><input id="titulo" name="titulo" required minLength={3} maxLength={200} defaultValue={ev?.title} className={field.input} /></div>
        <div><label htmlFor="resumo" className={field.label}>Resumo</label><input id="resumo" name="resumo" maxLength={400} defaultValue={ev?.summary ?? ""} className={field.input} /></div>
        <div className="flex items-center gap-2"><input id="dia_inteiro" name="dia_inteiro" type="checkbox" defaultChecked={ev?.allDay} className="h-5 w-5" /><label htmlFor="dia_inteiro">Evento de dia inteiro (sem horário)</label></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><label htmlFor="inicio" className={field.label}>Início (horário de Cuiabá)</label><input id="inicio" name="inicio" type="datetime-local" defaultValue={toLocalInput(ev?.startsAt ?? null)} className={field.input} /></div>
          <div><label htmlFor="fim" className={field.label}>Término</label><input id="fim" name="fim" type="datetime-local" defaultValue={toLocalInput(ev?.endsAt ?? null)} className={field.input} /></div>
          <div><label htmlFor="data_inicio" className={field.label}>Data inicial (dia inteiro)</label><input id="data_inicio" name="data_inicio" type="date" defaultValue={ev?.startDate ?? ""} className={field.input} /></div>
          <div><label htmlFor="data_fim" className={field.label}>Dia seguinte ao último dia (dia inteiro)</label><input id="data_fim" name="data_fim" type="date" defaultValue={ev?.endDate ?? ""} className={field.input} /></div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><label htmlFor="repeticao" className={field.label}>Repetição</label><select id="repeticao" name="repeticao" defaultValue={ev?.rrule ? RREV[ev.rrule] ?? "" : ""} className={field.input}><option value="">Não se repete</option><option value="semanal">Semanal</option><option value="quinzenal">Quinzenal</option><option value="mensal">Mensal</option></select></div>
          <div><label htmlFor="situacao" className={field.label}>Situação</label><select id="situacao" name="situacao" defaultValue={ev?.status ?? "agendado"} className={field.input}><option value="agendado">Agendado</option><option value="adiado">Adiado</option><option value="cancelado">Cancelado</option></select></div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><label htmlFor="local" className={field.label}>Local</label><input id="local" name="local" defaultValue={ev?.location ?? ""} className={field.input} /></div>
          <div><label htmlFor="endereco" className={field.label}>Endereço</label><input id="endereco" name="endereco" defaultValue={ev?.address ?? ""} className={field.input} /></div>
        </div>
        <div><label htmlFor="grupo" className={field.label}>Grupo responsável (opcional)</label><select id="grupo" name="grupo" defaultValue={ev?.groupId ?? ""} className={field.input}><option value="">Coordenação arquidiocesana</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
        <div><label htmlFor="descricao" className={field.label}>Descrição</label><textarea id="descricao" name="descricao" rows={6} defaultValue={ev?.descriptionHtml ? htmlToText(ev.descriptionHtml) : ""} className={field.input} /></div>
        <fieldset className="rounded-[var(--radius-md)] border border-linha p-4">
          <legend className="px-1 font-semibold">Inscrições</legend>
          <div className="flex items-center gap-2"><input id="inscricoes" name="inscricoes" type="checkbox" defaultChecked={ev?.registrationEnabled} className="h-5 w-5" /><label htmlFor="inscricoes">Receber inscrições pelo portal</label></div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="vagas" className={field.label}>Vagas (vazio = sem limite)</label><input id="vagas" name="vagas" inputMode="numeric" pattern="\d*" defaultValue={ev?.capacity ?? ""} className={field.input} /></div>
            <div><label htmlFor="encerra" className={field.label}>Encerrar inscrições em</label><input id="encerra" name="encerra" type="datetime-local" defaultValue={toLocalInput(ev?.registrationClosesAt ?? null)} className={field.input} /></div>
          </div>
          <div className="mt-3 flex items-center gap-2"><input id="espera" name="espera" type="checkbox" defaultChecked={ev?.waitlistEnabled} className="h-5 w-5" /><label htmlFor="espera">Lista de espera quando esgotar</label></div>
          <p className={field.hint}>Lotes pagos dependem do provedor de pagamento (ainda não ativado).</p>
        </fieldset>
      </fieldset>
      {!locked && <button className={btn.primario}>Salvar</button>}
    </form>
  );
}
