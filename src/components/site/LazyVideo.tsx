"use client";
import { useState } from "react";

/**
 * Vídeo sob demanda: nada de terceiros é carregado até o clique (privacidade e desempenho).
 * Usa youtube-nocookie e nunca inicia com som automático.
 */
export function LazyVideo({ id, title }: { id: string; title: string }) {
  const [on, setOn] = useState(false);
  const safe = /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
  if (!safe) return null;
  return (
    <div className="estandarte textura-losangos aspect-video overflow-hidden rounded-[var(--radius-lg)] border border-linha">
      {on ? (
        <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${safe}?autoplay=1&mute=0&rel=0`} title={title}
          allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      ) : (
        <button type="button" onClick={() => setOn(true)} className="flex h-full w-full flex-col items-center justify-center gap-3 text-white">
          <svg aria-hidden="true" viewBox="0 0 64 64" className="h-16 w-16"><circle cx="32" cy="32" r="31" fill="#fdc800" /><path d="M26 20v24l19-12z" fill="#0a3a22" /></svg>
          <span className="font-semibold">Assistir: {title}</span>
          <span className="max-w-sm px-4 text-center text-sm text-prata">Ao clicar, o vídeo será carregado do YouTube, que poderá coletar dados conforme a política dele.</span>
        </button>
      )}
    </div>
  );
}
