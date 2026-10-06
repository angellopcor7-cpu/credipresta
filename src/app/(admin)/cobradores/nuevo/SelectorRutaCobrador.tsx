"use client";

import { useState } from "react";

/**
 * Campo "Ruta" del alta de cobrador: si ya hay rutas sin asignar, deja
 * elegir una (select); si no hay ninguna, o si el admin prefiere, deja
 * escribir el nombre de una ruta nueva que se crea y se le asigna de un
 * jalón al cobrador recién creado.
 */
export function SelectorRutaCobrador({
  rutasDisponibles,
}: {
  rutasDisponibles: { id: string; nombre: string }[];
}) {
  const [creandoNueva, setCreandoNueva] = useState(rutasDisponibles.length === 0);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm text-ink-secondary" htmlFor={creandoNueva ? "ruta_nueva" : "ruta_id"}>
          Ruta
        </label>
        {rutasDisponibles.length > 0 && (
          <button
            type="button"
            onClick={() => setCreandoNueva((v) => !v)}
            className="text-xs text-accent-text hover:underline"
          >
            {creandoNueva ? "Elegir ruta existente" : "+ Nueva ruta"}
          </button>
        )}
      </div>
      {creandoNueva ? (
        <input
          id="ruta_nueva"
          name="ruta_nueva"
          placeholder="Nombre de la nueva ruta"
          className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      ) : (
        <select
          id="ruta_id"
          name="ruta_id"
          defaultValue=""
          className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">Sin ruta por ahora</option>
          {rutasDisponibles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
