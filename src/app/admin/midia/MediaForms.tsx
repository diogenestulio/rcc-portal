"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { editarMidia, enviarMidia, excluirMidia, linkPrivado, type MidiaState } from "./actions";
import { btn, field, Notice } from "@/components/ui";

function Res({ s }: { s: MidiaState }) {
  if (!s) return null;
  if (!s.ok) return <p role="alert" className={field.error}>{s.erro}</p>;
  return (
    <p role="status" className="mt-2 text-sm font-semibold text-verde">
      {s.msg}{s.link && <span className="mt-1 block select-all break-all rounded bg-marfim-2 p-2 font-mono font-normal text-tinta">{s.link}</span>}
    </p>
  );
}

export function UploadForm() {
  const [state, action, pending] = useActionState(enviarMidia, null);
  const [decorativa, setDecorativa] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Depois de um envio bem-sucedido, limpa o formulário para o próximo arquivo.
  useEffect(() => { if (state?.ok) formRef.current?.reset(); }, [state]);
  return (
    <form ref={formRef} action={action} className="space-y-4" onReset={() => setDecorativa(false)}>
      <div>
        <label htmlFor="arquivo" className={field.label}>Arquivo</label>
        <input id="arquivo" name="arquivo" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" className={field.input} aria-describedby="arquivo-dica" />
        <p id="arquivo-dica" className={field.hint}>JPEG, PNG ou WebP (até 8 MB) e PDF (até 9 MB). Fotos são convertidas, reduzidas e têm os dados de localização removidos.</p>
      </div>
      <div>
        <label htmlFor="alt" className={field.label}>Descrição da imagem (texto alternativo)</label>
        <input id="alt" name="alt" maxLength={300} disabled={decorativa} className={field.input} aria-describedby="alt-dica" />
        <p id="alt-dica" className={field.hint}>O que a foto mostra, para quem usa leitor de tela. Ex.: “Jovens rezando diante do Santíssimo na Paróquia São José”.</p>
        <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" name="decorativa" checked={decorativa} onChange={(e) => setDecorativa(e.target.checked)} className="h-5 w-5" /> É só decorativa (não transmite informação)</label>
      </div>
      <div>
        <label htmlFor="credito" className={field.label}>Crédito / direitos</label>
        <input id="credito" name="credito" maxLength={200} className={field.input} placeholder="Ex.: Foto: Pascom Paróquia São José" />
      </div>
      <label className="flex items-start gap-2"><input type="checkbox" name="autorizada" className="mt-1 h-5 w-5" /> <span>Para fotos: tenho autorização do autor e das pessoas que aparecem (ou dos responsáveis, no caso de menores).</span></label>
      <label className="flex items-start gap-2"><input type="checkbox" name="privado" className="mt-1 h-5 w-5" /> <span>Arquivo privado (só a equipe, por link temporário — ex.: atas, listas internas)</span></label>
      <button className={btn.primario} disabled={pending}>{pending ? "Enviando…" : "Enviar"}</button>
      <Res s={state} />
    </form>
  );
}

export function CopySnippet({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="text-sm text-marca underline underline-offset-2"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); } catch { /* sem permissão: o texto continua visível para copiar à mão */ } }}>
      {ok ? "Copiado!" : "Copiar código para o texto"}
    </button>
  );
}

export function EditMedia({ id, alt, decorative, credit, isImage }: { id: string; alt: string | null; decorative: boolean; credit: string | null; isImage: boolean }) {
  const [state, action, pending] = useActionState(editarMidia, null);
  const [dec, setDec] = useState(decorative);
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-marca">Editar descrição e crédito</summary>
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="id" value={id} />
        <input name="alt" aria-label="Descrição" defaultValue={alt ?? ""} disabled={dec} maxLength={300} className={field.input} />
        {isImage && <label className="flex items-center gap-2"><input type="checkbox" name="decorativa" checked={dec} onChange={(e) => setDec(e.target.checked)} className="h-4 w-4" /> Decorativa</label>}
        <input name="credito" aria-label="Crédito" defaultValue={credit ?? ""} maxLength={200} className={field.input} />
        <button className={btn.secundario} disabled={pending}>Salvar</button>
        <Res s={state} />
      </form>
    </details>
  );
}

export function MediaButtons({ id, isPrivate }: { id: string; isPrivate: boolean }) {
  const [ls, linkAction, lp] = useActionState(linkPrivado, null);
  const [ds, delAction, dp] = useActionState(excluirMidia, null);
  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-wrap gap-3 text-sm">
        {isPrivate && <form action={linkAction}><input type="hidden" name="id" value={id} /><button className="text-marca underline underline-offset-2" disabled={lp}>Gerar link (1 h)</button></form>}
        <form action={delAction} onSubmit={(e) => { if (!confirm("Excluir este arquivo? Não dá para desfazer.")) e.preventDefault(); }}>
          <input type="hidden" name="id" value={id} /><button className="text-perigo underline underline-offset-2" disabled={dp}>Excluir</button>
        </form>
      </div>
      <Res s={ls} /><Res s={ds} />
    </div>
  );
}

export function UsageNotice() {
  return <Notice tone="info">Para pôr uma imagem num texto, copie o código e cole numa linha sozinha do editor de conteúdo. Se quiser legenda, escreva na linha de baixo começando com “— ”.</Notice>;
}
