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
 *
 * Es UN solo botón que va rotando entre las 3 opciones con cada clic (en vez
 * de 3 botones uno al lado del otro) — en las barras de arriba de Empresa y
 * cobrador ya había varios iconos juntos (notificaciones, push, "Probar") y
 * sumarle 3 más ahí se sentía amontonado, sobre todo en celular.
 */
export function ThemeToggle() {
  const pref = useSyncExternalStore(suscribirse, leerPreferencia, leerPreferenciaServidor);

  useEffect(() => {
    aplicarTema(pref);
  }, [pref]);

  const indiceActual = OPCIONES.findIndex((o) => o.valor === pref);
  const actual = OPCIONES[indiceActual] ?? OPCIONES[0];
  const siguiente = OPCIONES[(indiceActual + 1) % OPCIONES.length];

  function rotar() {
    localStorage.setItem(CLAVE_STORAGE, siguiente.valor);
    window.dispatchEvent(new Event(EVENTO_CAMBIO));
  }

  return (
    <button
      type="button"
      onClick={rotar}
      aria-label={`Tema: ${actual.etiqueta} — cambiar a ${siguiente.etiqueta}`}
      title={`Tema: ${actual.etiqueta} (clic para cambiar a ${siguiente.etiqueta})`}
      className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-surface-2 border border-border text-ink-muted hover:text-ink transition-colors"
    >
      <actual.icono className="h-3.5 w-3.5" />
    </button>
  );
}
