/**
 * Dados de DEMONSTRAÇÃO — somente APP_ENV=development ou homologacao (nunca produção). Tudo é marcado is_demo=true e exibido
 * com o selo "Demonstração". Nomes de lugares e grupos são FICTÍCIOS de propósito.
 * Não há citações, autoridades, fotografias ou contatos reais.
 */
import "dotenv/config";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

if (!["development", "homologacao"].includes(process.env.APP_ENV ?? "")) { console.error("Seed recusado: só em APP_ENV=development ou homologacao."); process.exit(1); }
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const now = new Date();
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);
/** Horário local de Cuiabá (UTC-4, sem horário de verão) → instante UTC */
const cuiaba = (d: Date, h: number, m = 0) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h + 4, m));
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

await sql.begin(async (tx) => {
  await tx`insert into institution (id, public_name, timezone, confirmed) values (1, 'RCC Arquidiocese de Cuiabá', 'America/Cuiaba', false) on conflict (id) do nothing`;
  const regs = await tx`insert into region (name, slug, sort_order) values ('Região Demonstração Norte','demo-norte',1), ('Região Demonstração Sul','demo-sul',2) on conflict (slug) do update set name = excluded.name returning id, slug`;
  const R = Object.fromEntries(regs.map((r) => [r.slug, r.id]));
  const muns = await tx`insert into municipality (name, slug, region_id) values
    ('Vila Esperança (demo)','vila-esperanca-demo', ${R["demo-norte"]}),
    ('Campo da Paz (demo)','campo-da-paz-demo', ${R["demo-norte"]}),
    ('Serra Clara (demo)','serra-clara-demo', ${R["demo-sul"]})
    on conflict (slug) do update set name = excluded.name returning id, slug, region_id`;
  const M = Object.fromEntries(muns.map((m) => [m.slug, m]));
  const pars = await tx`insert into parish (name, slug, municipality_id, region_id) values
    ('Paróquia Demonstração A','par-demo-a', ${M["vila-esperanca-demo"].id}, ${R["demo-norte"]}),
    ('Paróquia Demonstração B','par-demo-b', ${M["vila-esperanca-demo"].id}, ${R["demo-norte"]}),
    ('Paróquia Demonstração C','par-demo-c', ${M["campo-da-paz-demo"].id}, ${R["demo-norte"]}),
    ('Paróquia Demonstração D','par-demo-d', ${M["serra-clara-demo"].id}, ${R["demo-sul"]})
    on conflict (slug) do update set name = excluded.name returning id, slug, municipality_id, region_id`;
  const groups: [string, string, number, string, string | null, boolean][] = [
    ["Grupo Demo Chama Viva", "par-demo-a", 4, "19:30", "21:30", true],
    ["Grupo Demo Água Viva", "par-demo-a", 1, "20:00", null, true],
    ["Grupo Demo Pentecostes", "par-demo-b", 2, "19:00", "20:30", true],
    ["Grupo Demo Renascer", "par-demo-c", 6, "08:30", "10:00", true],
    ["Grupo Demo Jovens em Cristo", "par-demo-c", 5, "19:30", null, false],
    ["Grupo Demo Maria Mãe", "par-demo-d", 3, "15:00", "16:30", true],
    ["Grupo Demo Sopro Divino", "par-demo-d", 0, "18:00", "19:30", true],
  ];
  for (const [name, par, wd, st, en, confirmed] of groups) {
    const p = pars.find((x) => x.slug === par)!;
    const slug = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
    await tx`insert into prayer_group (name, slug, parish_id, municipality_id, region_id, venue, weekday, start_time, end_time, status, published,
      last_confirmed_at, description, accessibility_info, public_contact, is_demo)
      values (${name}, ${slug}, ${p.id}, ${p.municipality_id}, ${p.region_id}, 'Salão paroquial (demo)', ${wd}, ${st}, ${en}, 'ativo', true,
      ${confirmed ? days(-20) : days(-400)}, 'Descrição de demonstração. Substituir pelo texto aprovado pela coordenação.',
      ${wd % 2 ? "Acesso sem degraus (informação de demonstração)" : null}, 'secretaria@paroquia-demo.invalid', true)
      on conflict (slug) do nothing`;
  }
  for (const [n, s] of [["Ministério de Música (demo)", "musica-demo"], ["Ministério de Intercessão (demo)", "intercessao-demo"], ["Ministério Jovem (demo)", "jovem-demo"], ["Ministério de Pregação (demo)", "pregacao-demo"]]) {
    await tx`insert into ministry (name, slug, summary, published, is_demo) values (${n}, ${s}, 'Resumo de demonstração.', true, true) on conflict (slug) do nothing`;
  }
  // Usuário técnico do seed (sem senha; não faz login) para registrar autoria das revisões de demonstração
  const seedUser = "seed-demo";
  await tx`insert into "user" (id, name, email, email_verified, active) values (${seedUser}, 'Seed de demonstração', 'seed@demo.invalid', true, false) on conflict (id) do nothing`;
  const contents: [string, string, string, string, string][] = [
    ["noticia", "encontro-de-coordenadores-demo", "Encontro de coordenadores reúne grupos da região (demo)", "noticia", "Notícia de demonstração para validar o layout da home e da listagem."],
    ["noticia", "nova-agenda-de-formacoes-demo", "Agenda de formações do semestre é publicada (demo)", "noticia", "Texto fictício. Nenhum fato real é descrito."],
    ["noticia", "retiro-de-jovens-demo", "Inscrições abertas para o retiro de jovens (demo)", "noticia", "Exemplo de notícia ligada a um evento com inscrição."],
    ["formacao", "o-que-e-um-grupo-de-oracao-demo", "O que acontece em um Grupo de Oração (demo)", "institucional", "Conteúdo de demonstração. O texto definitivo deve ser escrito e revisado pela equipe designada."],
    ["pagina", "quem-somos", "Quem somos (demo)", "institucional", "Página institucional de demonstração — substituir pelo texto aprovado."],
  ];
  let i = 0;
  for (const [kind, slug, title, nature, summary] of contents) {
    i++;
    const item = randomUUID(), rev = randomUUID();
    const ins = await tx`insert into content_item (id, kind, slug, status, published_at, is_demo) values (${item}, ${kind}, ${slug}, 'publicado', ${days(-i * 3)}, true)
      on conflict (kind, slug) do nothing returning id`;
    if (!ins.length) continue;
    await tx`insert into content_revision (id, item_id, number, title, summary, body_html, nature, created_by, approved_by, approved_at, search_text)
      values (${rev}, ${item}, 1, ${title}, ${summary}, ${`<p>${summary}</p><p>Este parágrafo existe apenas para testar a tipografia de leitura longa no portal, em celulares e computadores.</p>`}, ${nature}, ${seedUser}, ${seedUser}, ${days(-i * 3)}, ${title + " " + summary})`;
    await tx`update content_item set current_revision_id = ${rev}, published_revision_id = ${rev} where id = ${item}`;
  }
  const vila = M["vila-esperanca-demo"].id;
  const evs = [
    { slug: "retiro-de-jovens-demo", title: "Retiro de Jovens (demo)", summary: "Dois dias de oração, louvor e formação para jovens.", location: "Casa de retiros (demo)", allDay: true, startDate: dateOnly(days(24)), endDate: dateOnly(days(26)), capacity: 40, reg: true },
    { slug: "noite-de-louvor-demo", title: "Noite de Louvor (demo)", summary: "Momento aberto de louvor e adoração.", location: "Paróquia Demonstração A", startsAt: cuiaba(days(5), 19, 30), endsAt: cuiaba(days(5), 22), capacity: 120, reg: true },
    { slug: "formacao-de-servos-demo", title: "Formação de Servos (demo)", summary: "Encontro mensal de formação para servos dos grupos.", location: "Paróquia Demonstração C", startsAt: cuiaba(days(12), 8), endsAt: cuiaba(days(12), 12), reg: false, rrule: "FREQ=MONTHLY;COUNT=6" },
    { slug: "encontro-cancelado-demo", title: "Encontro regional (demo)", summary: "Exemplo de evento cancelado.", location: "Ginásio (demo)", startsAt: cuiaba(days(9), 14), endsAt: cuiaba(days(9), 18), reg: false, status: "cancelado" },
  ];
  for (const e of evs) {
    await tx`insert into event (slug, title, summary, location, municipality_id, all_day, starts_at, ends_at, start_date, end_date, timezone, rrule, status, publication,
      ical_uid, registration_enabled, capacity, is_demo, registration_closes_at)
      values (${e.slug}, ${e.title}, ${e.summary}, ${e.location}, ${vila}, ${!!e.allDay}, ${e.startsAt ?? null}, ${e.endsAt ?? null}, ${e.startDate ?? null}, ${e.endDate ?? null},
        'America/Cuiaba', ${e.rrule ?? null}, ${e.status ?? "agendado"}, 'publicado', ${`${randomUUID()}@rcc-demo.invalid`}, ${e.reg}, ${e.capacity ?? null}, true, ${e.reg ? days(20) : null})
      on conflict (slug) do nothing`;
  }
});
console.log("Seed de demonstração aplicado.");
await sql.end();
