/**
 * Valores PROVISÓRIOS até a confirmação institucional (docs/01-pendencias-bloqueantes.md).
 * Em produção, os dados vêm da tabela `institution`; estes são apenas o fallback.
 */
export const instituicaoProvisoria = {
  nomePublico: "RCC Arquidiocese de Cuiabá", // confirmado pelo responsável em 10/11/2026; denominação pública exata ainda a validar
  nomeCompleto: "Renovação Carismática Católica da Arquidiocese de Cuiabá",
  arquidiocese: "Arquidiocese de Cuiabá" as string | null,
  conselho: null as string | null,     // PENDENTE: nomenclatura local
  fuso: "America/Cuiaba",
  /** Vínculos institucionais exibidos como sites externos — não falamos em nome deles. */
  vinculos: [
    { nome: "RCC Brasil", url: "https://rccbrasil.org.br/", relacao: "Movimento em nível nacional" },
    { nome: "RCC Mato Grosso", url: "https://www.rccmt.com.br/", relacao: "Conselho estadual" },
  ],
};

/** Conteúdo configurável da home. `videoDestaque: null` oculta a seção em produção. */
export const instituicaoHome: { videoDestaque: { youtubeId: string; titulo: string } | null } = {
  videoDestaque: null, // PENDENTE: vídeo oficial autorizado
};
