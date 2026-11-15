/** Endereço curto para URLs: sem acentos, minúsculo, só letras/números/hífen. */
export function slugify(s: string, max = 60) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, max).replace(/-$/, "") || "item";
}

/** Primeiro slug livre: base, base-2, base-3… (`taken` consulta a tabela certa). */
export async function uniqueSlug(base: string, taken: (slug: string) => Promise<boolean>) {
  const b = slugify(base);
  for (let i = 1; i < 200; i++) {
    const s = i === 1 ? b : `${b.slice(0, 55)}-${i}`;
    if (!(await taken(s))) return s;
  }
  throw new Error("Não foi possível gerar um endereço único.");
}
