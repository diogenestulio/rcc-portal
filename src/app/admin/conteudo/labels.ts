export const STATUS_LABEL: Record<string, [string, "neutro" | "info" | "alerta" | "sucesso" | "perigo" | "vinho"]> = {
  rascunho: ["Rascunho", "neutro"], em_revisao: ["Em revisão", "alerta"], aprovado: ["Aprovado", "info"],
  agendado: ["Agendado", "info"], publicado: ["Publicado", "sucesso"], arquivado: ["Arquivado", "neutro"],
};
