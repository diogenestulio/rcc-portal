"use client";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { btn, Notice } from "@/components/ui";

export type MapGroup = { slug: string; name: string; venue: string; weekday: number; startTime: string; lat: number; lng: number; municipality: string };

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const hora = (t: string) => t.slice(0, 5).replace(":", "h");

/** Distância em km (fórmula de haversine) — calculada no aparelho; a posição não vai ao servidor. */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
const fmtKm = (d: number) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(d < 10 ? 1 : 0).replace(".", ",")} km`);

/**
 * Mapa opcional. Nada de terceiros é carregado até o clique em “Mostrar mapa” (os blocos do mapa
 * vêm do OpenStreetMap, que recebe o endereço IP de quem vê). A lista ao lado continua sendo a
 * forma principal e completa de encontrar um grupo.
 */
export function GroupMap({ groups, totalNaLista }: { groups: MapGroup[]; totalNaLista: number }) {
  const [show, setShow] = useState(false);
  const [perto, setPerto] = useState<{ g: MapGroup; d: number }[] | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show || !el.current || groups.length === 0) return;
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false, keyboard: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">colaboradores do OpenStreetMap</a>',
      }).addTo(map);
      const bounds = L.latLngBounds([]);
      for (const g of groups) {
        // Conteúdo do balão montado com elementos (nunca HTML com dados) — sem risco de injeção.
        const box = document.createElement("div");
        const a = document.createElement("a"); a.href = `/grupos/${g.slug}`; a.textContent = g.name; a.style.fontWeight = "600";
        const p = document.createElement("div"); p.textContent = `${DIAS[g.weekday]}, ${hora(g.startTime)} · ${g.venue} · ${g.municipality}`;
        box.append(a, p);
        L.circleMarker([g.lat, g.lng], { radius: 9, color: "#004159", weight: 2, fillColor: "#007437", fillOpacity: 0.9 })
          .bindPopup(box).bindTooltip(g.name).addTo(map);
        bounds.extend([g.lat, g.lng]);
      }
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    });
    return () => { cancelled = true; map?.remove(); };
  }, [show, groups]);

  function pertoDeMim() {
    setGeoMsg(null);
    if (!("geolocation" in navigator)) { setGeoMsg("Este navegador não informa a localização. Use os filtros de município e dia."); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPerto(groups.map((g) => ({ g, d: km(me, g) })).sort((x, y) => x.d - y.d).slice(0, 5));
      },
      () => { setBusy(false); setGeoMsg("Não foi possível obter sua localização (permissão negada ou indisponível). Use os filtros de município e dia."); },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 },
    );
  }

  if (groups.length === 0) return null;
  return (
    <section aria-labelledby="mapa-titulo" className="mt-8 rounded-[var(--radius-lg)] border border-linha bg-papel p-5">
      <h2 id="mapa-titulo" className="text-xl font-semibold">Mapa e grupos perto de você</h2>
      <p className="mt-1 text-sm text-tinta-2">
        {groups.length} de {totalNaLista} grupo(s) desta busca têm localização cadastrada. O mapa e a localização são opcionais: a lista abaixo tem todas as informações.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {!show && <button type="button" className={btn.secundario} onClick={() => setShow(true)}>Mostrar mapa</button>}
        <button type="button" className={btn.secundario} onClick={pertoDeMim} disabled={busy}>{busy ? "Obtendo localização…" : "Grupos perto de mim"}</button>
      </div>
      {!show && <p className="mt-2 text-xs text-tinta-3">Ao mostrar o mapa, as imagens vêm do OpenStreetMap, que recebe o endereço de internet de quem vê. “Perto de mim” pede permissão ao navegador; sua posição fica só no seu aparelho.</p>}
      {geoMsg && <div className="mt-4"><Notice tone="alerta">{geoMsg}</Notice></div>}
      {perto && (
        <div className="mt-4" aria-live="polite">
          <h3 className="font-semibold">Mais próximos de você (em linha reta)</h3>
          <ol className="mt-2 space-y-1">
            {perto.map(({ g, d }) => <li key={g.slug}><a href={`/grupos/${g.slug}`} className="font-semibold">{g.name}</a> — {fmtKm(d)} · {DIAS[g.weekday]}, {hora(g.startTime)}</li>)}
          </ol>
        </div>
      )}
      {show && <div ref={el} role="region" aria-label="Mapa dos Grupos de Oração (a lista abaixo tem as mesmas informações)" className="mt-4 h-96 w-full overflow-hidden rounded-[var(--radius-md)] border border-linha" />}
    </section>
  );
}
