"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun, Monitor } from "lucide-react";

export type PreferenciaTema = "dark" | "light" | "system";

const CLAVE_STORAGE = "credipresta-tema";
const EVENTO_CAMBIO = "credipresta-tema-cambio";

function resolverTema(pref: PreferenciaTema): "dark" | "light" {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return pref;
}

function aplicarTema(pref: PreferenciaTema) {
  document.documentElement.setAttribute("data-theme", resolverTema(pref));
}

function leerPreferencia(): PreferenciaTema {
  return (localStorage.getItem(CLAVE_STORAGE) as PreferenciaTema | null) ?? "dark";
}

function leerPreferenciaServidor(): PreferenciaTema {
  return "dark";
}

/**
 * useSyncExternalStore en vez de leer localStorage en un useEffect con
 * setState: así React maneja bien la primera pintada (servidor no conoce la
 * preferencia guardada) sin parpadeos ni renders en cascada.
 */
function suscribirse(avisar: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: light)");
  media.addEventListener("change", avisar);
  window.addEventListener(EVENTO_CAMBIO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    media.removeEventListener("change", avisar);
    window.removeEventListener(EVENTO_CAMBIO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

const OPCIONES: { valor: PreferenciaTema; icono: typeof Moon; etiqueta: string }[] = [
  { valor: "dark", icono: Moon, etiqueta: "Oscuro" },
  { valor: "light", icono: Sun, etiqueta: "Claro" },
  { valor: "system", icono: Monitor, etiqueta: "Sistema" },
];

/**
 * Selector de tema oscuro / claro / sistema. El tema real ya se aplica antes
 * de pintar la página (script en el <head> de src/app/layout.tsx, para
 * evitar el parpadeo), este componente solo deja que el usuario lo cambie y
 * lo guarda en localStorage para la próxima visita.
 */
export function ThemeToggle() {
  const pref = useSyncExternalStore(suscribirse, leerPreferencia, leerPreferenciaServidor);

  useEffect(() => {
    aplicarTema(pref);
  }, [pref]);

  function elegir(nueva: PreferenciaTema) {
    localStorage.setItem(CLAVE_STORAGE, nueva);
    window.dispatchEvent(new Event(EVENTO_CAMBIO));
  }

  return (
    <div className="inline-flex items-center gap-0.5 bg-surface-2 border border-border rounded-full p-0.5">
      {OPCIONES.map(({ valor, icono: Icono, etiqueta }) => (
        <button
          key={valor}
          type="button"
          onClick={() => elegir(valor)}
          aria-label={etiqueta}
          aria-pressed={pref === valor}
          title={etiqueta}
          className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
            pref === valor ? "bg-amber-500 text-neutral-950" : "text-ink-muted hover:text-ink"
          }`}
        >
          <Icono className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
