/**
 * CONTEÚDO PROPOSTO para avaliação da coordenação (homologação ou desenvolvimento; nunca produção).
 * Carrega ilustrações ORIGINAIS, dois PDFs e textos do bloco "Igreja e Renovação" e da Formação, todos marcados
 * como demonstração (is_demo = true), para serem revistos, corrigidos ou descartados antes do lançamento.
 *  - Fatos (datas, lemas, links) conferidos nas fontes oficiais em 16/11/2026 (Vaticano, CNBB, RCC Brasil).
 *  - Vídeo: apenas de canal oficial (RCCBRASIL), conferido no oEmbed do YouTube.
 *  - Idempotente: o que já existe (mesmo endereço ou mesma descrição de mídia) é mantido.
 * Uso: npx tsx scripts/conteudo-proposto.mts   |   na homologação: docker compose exec worker node scripts/conteudo-proposto.mjs
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";
import type { DB } from "../src/db";
import { contentItem, contentRevision, media, user } from "../src/db/schema";
import { uploadMedia, publicUrl } from "../src/server/media";
import { sanitizeRichText } from "../src/server/content";
import { textToHtml } from "../src/server/richtext";
import type { Subject } from "../src/server/authz";

if (!["development", "homologacao"].includes(process.env.APP_ENV ?? "")) { console.error("Recusado: só em APP_ENV=development ou homologacao."); process.exit(1); }

const client = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(client, { schema }) as unknown as DB;
const DIR = path.resolve(process.cwd(), "scripts/conteudo-proposto");
const AUTOR = "seed-demo";
await db.insert(user).values({ id: AUTOR, name: "Seed de demonstração", email: "seed@demo.invalid", emailVerified: true, active: false }).onConflictDoNothing();
const s: Subject = { userId: AUTOR, assignments: [{ role: "gestor_institucional", scopeType: "global", scopeId: null }], mfa: true, recentAuthAt: new Date() };

const CREDITO = "Ilustração original do portal (proposta para avaliação)";
async function midia(arquivo: string, descricao: string) {
  const [ja] = await db.select().from(media).where(and(eq(media.altText, descricao), eq(media.isPrivate, false)));
  if (ja) return ja;
  const r = await uploadMedia(db, s, { file: readFileSync(path.join(DIR, arquivo)), fileName: arquivo, altText: descricao, credit: arquivo.endsWith(".pdf") ? "Material de demonstração do portal, sujeito a revisão" : CREDITO, imageRightsAuthorized: true });
  const [m] = await db.select().from(media).where(eq(media.id, r.id));
  return m;
}

const img = {
  pentecostes: await midia("pentecostes.png", "Ilustração: pomba branca sob luz dourada e chamas de fogo sobre fundo verde, lembrando Pentecostes"),
  jmj: await midia("jmj.png", "Ilustração: peregrinos seguindo um caminho dourado entre montanhas, em direção a uma estrela"),
  cf: await midia("cf2027.png", "Ilustração: duas figuras adultas em verde acolhendo uma criança em amarelo"),
  sessenta: await midia("sessenta.png", "Ilustração: número 60 em dourado com a frase anos de Renovação, 1967 a 2027"),
  chama: await midia("chama.png", "Ilustração: uma grande chama dourada sobre fundo verde-escuro"),
  grupo: await midia("grupo.png", "Ilustração: pessoas sentadas em roda em volta de uma chama e de uma Bíblia aberta"),
  boasvindas: await midia("boasvindas.png", "Ilustração: porta em arco aberta, com luz dourada, e uma pessoa entrando"),
};
const pdf = {
  roteiro: await midia("roteiro-grupo-de-oracao.pdf", "Roteiro de um Grupo de Oração"),
  guia: await midia("guia-boas-vindas.pdf", "Bem-vindo ao Grupo de Oração: guia para a primeira visita"),
};
const pdfLink = (m: typeof pdf.roteiro, t: string) => `[pdf: ${t}](${publicUrl(m)})`;

type Item = {
  kind: "igreja" | "formacao" | "noticia"; slug: string; titulo: string; resumo: string; texto: string; natureza: "noticia" | "institucional" | "orientacao_pastoral";
  capa: { id: string }; data?: string; dataFim?: string; local?: string; link?: string; fontes?: string; diasAtras: number;
};

const AVISO = "*Texto proposto pela equipe do portal para avaliação da coordenação. Confira e ajuste antes da publicação oficial.*";

const itens: Item[] = [
  {
    kind: "igreja", slug: "campanha-da-fraternidade-2027", natureza: "noticia", capa: img.cf, diasAtras: 1,
    titulo: "Campanha da Fraternidade 2027: Fraternidade e o Cuidado das Crianças",
    resumo: "A CNBB já lançou o texto-base da Campanha de 2027, que começa na Quarta-feira de Cinzas, 10 de fevereiro.",
    data: "2027-02-10", local: "Em todas as dioceses do Brasil", link: "https://www.cnbb.org.br/lancamento-texto-base-campanha-fraternidade-2027/",
    fontes: "CNBB, lançamento do texto-base da CF 2027 (novembro de 2026).",
    texto: `A Campanha da Fraternidade de 2027 terá como tema **Fraternidade e o Cuidado das Crianças** e como lema **“Quem recebe uma criança em meu nome, a mim recebe”** (Mt 18,5). O texto-base foi lançado pelas Edições CNBB em novembro de 2026.

## Quando começa

Como todos os anos, a Campanha é aberta na **Quarta-feira de Cinzas**, que em 2027 cai no dia **10 de fevereiro**, e acompanha todo o tempo da Quaresma.

## Como os Grupos de Oração podem participar

- Rezar pelas crianças e pelas famílias nos momentos de intercessão.
- Estudar o texto-base com a equipe de coordenação.
- Apoiar as iniciativas da paróquia durante a Quaresma.
- Lembrar da coleta da solidariedade no Domingo de Ramos.

${AVISO}`,
  },
  {
    kind: "igreja", slug: "pentecostes-2027", natureza: "noticia", capa: img.pentecostes, diasAtras: 2,
    titulo: "Pentecostes 2027: 16 de maio",
    resumo: "A solenidade que está no coração da Renovação Carismática será celebrada em 16 de maio de 2027.",
    data: "2027-05-16", local: "Nas paróquias e Grupos de Oração da Arquidiocese",
    fontes: "Bíblia, Atos dos Apóstolos 2,1-4. Calendário litúrgico (Páscoa em 28 de março de 2027).",
    texto: `Cinquenta dias depois da Páscoa, a Igreja celebra **Pentecostes**, a vinda do Espírito Santo sobre os apóstolos reunidos com Maria no Cenáculo (At 2,1-4). Em 2027, a solenidade cai no dia **16 de maio**.

> Todos ficaram cheios do Espírito Santo.

Para a Renovação Carismática Católica, Pentecostes é uma data especial: a RCC nasceu do desejo de viver hoje a mesma experiência do Espírito Santo que transformou a Igreja nascente.

## Sugestões para os grupos

- Preparar a **novena ao Espírito Santo**, entre a Ascensão e Pentecostes.
- Organizar, com a paróquia, uma **vigília de Pentecostes**.
- Convidar quem ainda não conhece o Grupo de Oração.

${AVISO}`,
  },
  {
    kind: "igreja", slug: "jmj-seul-2027", natureza: "noticia", capa: img.jmj, diasAtras: 3,
    titulo: "Jornada Mundial da Juventude 2027 em Seul",
    resumo: "De 3 a 8 de agosto de 2027, jovens do mundo inteiro se encontram com o Papa Leão XIV na Coreia do Sul.",
    data: "2027-08-03", dataFim: "2027-08-08", local: "Seul, Coreia do Sul", link: "https://www.vaticannews.va/pt/vaticano/news/2026-08/lancado-o-hino-oficial-da-jmj-seul-2027.print.html",
    fontes: "Vatican News (agosto de 2026); Sala de Imprensa da Santa Sé (julho de 2026).",
    texto: `A próxima **Jornada Mundial da Juventude** acontece em **Seul, na Coreia do Sul, de 3 a 8 de agosto de 2027**. Será a primeira JMJ presidida pelo **Papa Leão XIV** e a primeira realizada na Coreia.

O lema é **“Tende coragem: eu venci o mundo!”** (Jo 16,33). O hino oficial, *Confidite, Ego Vici Mundum*, foi lançado em agosto de 2026, exatamente um ano antes do encontro.

## Para os jovens da RCC

Mesmo quem não puder viajar pode viver a Jornada: acompanhar as transmissões, rezar pelos peregrinos e participar das iniciativas de jovens da Arquidiocese.

${AVISO}`,
  },
  {
    kind: "igreja", slug: "60-anos-da-renovacao-carismatica", natureza: "institucional", capa: img.sessenta, diasAtras: 4,
    titulo: "Rumo aos 60 anos da Renovação Carismática Católica",
    resumo: "Em 2027, a RCC completa 60 anos no mundo. A RCC Brasil prepara uma peregrinação à Itália para celebrar a data.",
    link: "https://rccbrasil.org.br/blog/rccbrasil-organiza-peregrinacao-a-italia-para-celebrar-os-60-anos-da-renovacao-carismatica-catolica-no-mundo/",
    fontes: "RCC Brasil (novembro de 2026). Histórico da RCC: Duquesne, EUA, 1967; chegada ao Brasil em 1969, em Campinas (SP).",
    texto: `A Renovação Carismática Católica nasceu em **1967**, nos Estados Unidos, a partir de um retiro de estudantes universitários que pediram a graça de um novo Pentecostes. Em **2027**, o movimento completa **60 anos** no mundo.

No Brasil, a RCC chegou em **1969**, em Campinas (SP), e hoje está presente em todo o país, com milhares de Grupos de Oração.

## Peregrinação à Itália

Para celebrar a data, a **RCC Brasil** organiza uma peregrinação à Itália. As informações oficiais estão no site da RCC Brasil, no link da fonte oficial desta página.

${AVISO}`,
  },
  {
    kind: "igreja", slug: "semana-espalhar-a-chama", natureza: "noticia", capa: img.chama, diasAtras: 5,
    titulo: "Semana Espalhar a Chama: RCC Brasil mobiliza os Grupos de Oração",
    resumo: "O projeto ligado à construção da Sede Nacional convida os grupos de todo o país a rezar e colaborar.",
    link: "https://rccbrasil.org.br/blog/rccbrasil-prepara-semana-espalhar-a-chama-para-mobilizar-grupos-de-oracao-em-todo-o-brasil/",
    fontes: "RCC Brasil, notícia e vídeo oficial do canal RCCBRASIL.",
    texto: `A RCC Brasil prepara a **Semana Espalhar a Chama**, que busca mobilizar os Grupos de Oração de todo o país. O projeto está ligado à construção da **Sede Nacional** da RCC e, segundo a RCC Brasil, nasceu de moções espirituais que vão além da própria obra.

Assista ao vídeo oficial da RCC Brasil sobre o tema:

[video: Moções espirituais para a Sede Nacional da RCCBRASIL](https://www.youtube.com/watch?v=OvCqsKWvyR0)

${AVISO}`,
  },
  {
    kind: "formacao", slug: "como-acontece-um-grupo-de-oracao", natureza: "orientacao_pastoral", capa: img.grupo, diasAtras: 6,
    titulo: "Como acontece um Grupo de Oração",
    resumo: "Os momentos de um encontro semanal, do acolhimento ao envio, com um roteiro para baixar.",
    fontes: "Experiência dos Grupos de Oração da RCC; texto a ser revisado pelo revisor designado.",
    texto: `O Grupo de Oração é o coração da Renovação Carismática. Toda semana, pessoas de todas as idades se reúnem para **louvar a Deus, ouvir a Palavra e rezar umas pelas outras**, em comunhão com a paróquia.

## Os momentos do encontro

1. Acolhida
2. Oração inicial e invocação do Espírito Santo
3. Louvor
4. Proclamação da Palavra
5. Pregação
6. Oração e partilha
7. Avisos e envio

## Roteiro para quem coordena

O roteiro abaixo traz o tempo sugerido de cada momento e dicas práticas para a equipe de serviço.

${pdfLink(pdf.roteiro, "Roteiro de um Grupo de Oração")}

${AVISO}`,
  },
  {
    kind: "formacao", slug: "primeira-vez-no-grupo-de-oracao", natureza: "orientacao_pastoral", capa: img.boasvindas, diasAtras: 7,
    titulo: "Primeira vez num Grupo de Oração?",
    resumo: "Um guia simples para quem vai pela primeira vez: o que esperar, o que levar e como se sentir em casa.",
    fontes: "Texto proposto pela equipe do portal, a ser revisado.",
    texto: `Ir pela primeira vez a um Grupo de Oração pode gerar dúvidas. A boa notícia: **não é preciso se inscrever, pagar nada nem conhecer as músicas**. Basta chegar.

## O que esperar

Você vai encontrar acolhida, cantos de louvor, a leitura da Bíblia, uma pregação e um tempo de oração. Pode participar do jeito que se sentir à vontade, inclusive só observando.

## Leve o guia com você

${pdfLink(pdf.guia, "Bem-vindo ao Grupo de Oração: guia para a primeira visita")}

Depois, procure um grupo perto de você na página **Grupos de Oração** do portal.

${AVISO}`,
  },
];

let criados = 0;
for (const it of itens) {
  const [ja] = await db.select({ id: contentItem.id }).from(contentItem).where(and(eq(contentItem.kind, it.kind), eq(contentItem.slug, it.slug)));
  if (ja) continue;
  const html = sanitizeRichText(textToHtml(it.texto));
  const quando = new Date(Date.now() - it.diasAtras * 86_400_000);
  await db.transaction(async (tx) => {
    const [item] = await tx.insert(contentItem).values({ kind: it.kind, slug: it.slug, status: "publicado", isDemo: true, publishedAt: quando }).returning();
    const [rev] = await tx.insert(contentRevision).values({
      itemId: item.id, number: 1, title: it.titulo, summary: it.resumo, bodyHtml: html, nature: it.natureza,
      authorName: "Equipe do portal (proposta)", sourceReference: it.fontes ?? null,
      rightsNotice: "Texto e ilustração originais do portal; vídeo incorporado do canal oficial de origem.",
      coverMediaId: it.capa.id, eventDate: it.data ?? null, eventEndDate: it.dataFim ?? null, eventPlace: it.local ?? null, externalUrl: it.link ?? null,
      createdBy: AUTOR, approvedBy: AUTOR, approvedAt: new Date(), searchVector: `${it.titulo} ${it.resumo} ${it.texto}`,
    }).returning();
    await tx.update(contentItem).set({ currentRevisionId: rev.id, publishedRevisionId: rev.id }).where(eq(contentItem.id, item.id));
  });
  criados++;
}
await client.end();
console.log(`Conteúdo proposto: ${criados} item(ns) criado(s); ${itens.length - criados} já existia(m). Mídias: ${Object.keys(img).length} imagens e ${Object.keys(pdf).length} PDFs.`);
process.exit(0);
