/**
 * E-mail transacional (independente de provedor: qualquer serviço com SMTP — ver docs/09-integracoes.md).
 *  - Mensagens só transacionais: confirmação de inscrição, vaga, pagamento, redefinição de senha.
 *    Nada de divulgação aqui (marketing exige consentimento próprio).
 *  - Texto simples + HTML simples, sem imagens remotas, sem rastreamento de abertura/clique.
 *  - Conteúdo variável sempre escapado; links só do próprio portal.
 *  - Sem SMTP: desenvolvimento/homologação gravam .eml em arquivo; produção falha (vira alerta).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import nodemailer, { type Transporter } from "nodemailer";

export type Template =
  | { kind: "inscricao_confirmada"; nome: string; evento: string; quando: string; local: string | null; comprovante: string }
  | { kind: "inscricao_lista_espera"; nome: string; evento: string; posicao: number | null; comprovante: string }
  | { kind: "inscricao_vaga_liberada"; nome: string; evento: string; comprovante: string }
  | { kind: "pedido_pago"; nome: string; pedido: string }
  | { kind: "redefinir_senha"; nome: string; link: string; validadeMin: number };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;

type Block = { p?: string; botao?: { texto: string; url: string }; nota?: string };

/** Monta assunto, texto e HTML a partir de blocos já em texto puro (o HTML escapa tudo). */
function compose(assunto: string, saudacao: string, blocos: Block[], instituicao: string) {
  const text = [saudacao, "", ...blocos.flatMap((b) => [b.p, b.botao ? `${b.botao.texto}: ${b.botao.url}` : undefined, b.nota].filter(Boolean) as string[]).flatMap((l) => [l, ""]),
    "—", instituicao, "Mensagem automática: não responda este e-mail."].join("\n");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(assunto)}</title></head>
<body style="margin:0;background:#fbf8f1;font-family:Arial,Helvetica,sans-serif;color:#1f1b16">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3dacb;border-radius:12px">
<tr><td style="padding:24px 28px 8px;font-family:Georgia,serif;font-size:18px;font-weight:bold;color:#7a2335">${esc(instituicao)}</td></tr>
<tr><td style="padding:8px 28px 24px;font-size:16px;line-height:1.6">
<p style="margin:0 0 16px">${esc(saudacao)}</p>
${blocos.map((b) => [
    b.p ? `<p style="margin:0 0 16px">${esc(b.p)}</p>` : "",
    b.botao ? `<p style="margin:0 0 16px"><a href="${esc(b.botao.url)}" style="display:inline-block;background:#7a2335;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">${esc(b.botao.texto)}</a></p><p style="margin:0 0 16px;font-size:13px;color:#6b6256;word-break:break-all">Se o botão não funcionar, copie este endereço: ${esc(b.botao.url)}</p>` : "",
    b.nota ? `<p style="margin:0 0 16px;font-size:14px;color:#4a4339">${esc(b.nota)}</p>` : "",
  ].join("")).join("\n")}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e3dacb;font-size:12px;color:#6b6256">Mensagem automática: não responda este e-mail.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: assunto, text, html };
}

export function render(t: Template, instituicao: string) {
  switch (t.kind) {
    case "inscricao_confirmada":
      return compose(`Inscrição confirmada — ${t.evento}`, `Olá, ${firstName(t.nome)}.`, [
        { p: `Sua inscrição em “${t.evento}” está confirmada.` },
        { p: `Quando: ${t.quando}${t.local ? ` · Onde: ${t.local}` : ""}` },
        { botao: { texto: "Ver comprovante", url: t.comprovante }, nota: "Apresente o comprovante (QR Code) na entrada. Não compartilhe o link: ele vale como sua inscrição." },
      ], instituicao);
    case "inscricao_lista_espera":
      return compose(`Lista de espera — ${t.evento}`, `Olá, ${firstName(t.nome)}.`, [
        { p: `As vagas de “${t.evento}” se esgotaram e você entrou na lista de espera${t.posicao ? ` (posição ${t.posicao})` : ""}.` },
        { p: "Se uma vaga for liberada, avisaremos por e-mail." },
        { botao: { texto: "Acompanhar inscrição", url: t.comprovante } },
      ], instituicao);
    case "inscricao_vaga_liberada":
      return compose(`Vaga liberada — ${t.evento}`, `Olá, ${firstName(t.nome)}.`, [
        { p: `Uma vaga em “${t.evento}” foi liberada para você.` },
        { botao: { texto: "Ver inscrição", url: t.comprovante }, nota: "Se o evento for pago, a vaga fica reservada por tempo limitado até a confirmação do pagamento." },
      ], instituicao);
    case "pedido_pago":
      return compose("Pagamento confirmado", `Olá, ${firstName(t.nome)}.`, [
        { p: "Recebemos a confirmação do pagamento do seu pedido." },
        { botao: { texto: "Acompanhar pedido", url: t.pedido } },
      ], instituicao);
    case "redefinir_senha":
      return compose("Redefinição de senha", `Olá, ${firstName(t.nome)}.`, [
        { p: "Recebemos um pedido para criar uma nova senha para a sua conta da equipe." },
        { botao: { texto: "Criar nova senha", url: t.link }, nota: `O link vale por ${t.validadeMin} minutos e só pode ser usado uma vez.` },
        { nota: "Não foi você? Ignore esta mensagem: sua senha atual continua valendo. Se receber vários destes sem ter pedido, avise a coordenação." },
      ], instituicao);
  }
}

let transport: Transporter | null = null;

export type MailEnv = { SMTP_URL?: string; MAIL_FROM: string; APP_ENV: string; EMAIL_DIR?: string };

/** Envia (ou grava em arquivo fora da produção quando não há SMTP). Nunca registra o corpo em log. */
export async function deliver(env: MailEnv, to: string, msg: { subject: string; text: string; html: string }) {
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)) throw new Error("destinatário inválido");
  if (!env.SMTP_URL) {
    if (env.APP_ENV === "producao") throw new Error("SMTP não configurado");
    const dir = env.EMAIL_DIR || "storage/emails";
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${Date.now()}-${Math.random().toString(36).slice(2)}.eml`, `From: ${env.MAIL_FROM}\nTo: ${to}\nSubject: ${msg.subject}\n\n${msg.text}\n`);
    return { arquivo: true as const };
  }
  // Ex.: smtps://usuario:senha@smtp-relay.provedor.com:465  ou  smtp://usuario:senha@host:587 (STARTTLS)
  transport ??= nodemailer.createTransport(env.SMTP_URL);
  const info = await transport.sendMail({
    from: env.MAIL_FROM, to, subject: msg.subject, text: msg.text, html: msg.html,
    headers: { "Auto-Submitted": "auto-generated", "X-Auto-Response-Suppress": "All" },
  });
  return { arquivo: false as const, messageId: info.messageId };
}
