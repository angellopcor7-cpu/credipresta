"use client";

import { useState } from "react";
import { ajustarMora } from "../actions";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function redondear(valor: number) {
  return Math.round(valor * 100) / 100;
}

/**
 * Formulario para bajar o perdonar la mora acumulada de un préstamo —
 * botón "cambiar/perdonar mora" que pidió el cliente. Los presets (mitad,
 * cuarto, perdonar todo) solo rellenan el campo "nueva mora"; el monto final
 * siempre se puede ajustar a mano antes de confirmar, y el motivo es
 * obligatorio para que quede registrado por qué se perdonó.
 */
export function AjusteMoraForm({ prestamoId, moraActual }: { prestamoId: string; moraActual: number }) {
  const [moraNueva, setMoraNueva] = useState(String(moraActual));
  const [abierto, setAbierto] = useState(false);

  if (moraActual <= 0) return null;

  const presets: { label: string; valor: number }[] = [
    { label: "Perdonar mitad", valor: redondear(moraActual / 2) },
    { label: "Perdonar un cuarto", valor: redondear(moraActual - moraActual / 4) },
    { label: "Perdonar todo", valor: 0 },
  ];

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-sm bg-surface-2 hover:bg-surface-3 border border-border-strong text-ink font-medium rounded-md px-4 py-2"
      >
        Cambiar / perdonar mora
      </button>
    );
  }

  return (
    <form
      action={ajustarMora}
      className="space-y-3 bg-surface p-4 rounded-xl border border-border max-w-md"
    >
      <input type="hidden" name="prestamo_id" value={prestamoId} />
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Cambiar / perdonar mora</h3>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-xs text-ink-muted hover:text-ink"
        >
          Cancelar
        </button>
      </div>
      <p className="text-xs text-ink-muted">
        Mora acumulada actual: <span className="text-danger-text font-medium">{currency(moraActual)}</span>. Este
        ajuste solo puede bajarla, nunca subirla.
      </p>

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setMoraNueva(String(preset.valor))}
            className="text-xs bg-surface-2 hover:bg-surface-3 border border-border-strong rounded-md px-3 py-1.5"
          >
            {preset.label} ({currency(preset.valor)})
          </button>
        ))}
      </div>

      <div className="space-y-1">
        <label className="text-sm text-ink-secondary" htmlFor="mora_nueva">
          Nueva mora (después del ajuste)
        </label>
        <input
          id="mora_nueva"
          name="mora_nueva"
          type="number"
          min="0"
          max={moraActual}
          step="0.01"
          value={moraNueva}
          onChange={(e) => setMoraNueva(e.target.value)}
          required
          className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm text-ink-secondary" htmlFor="motivo">
          Motivo del ajuste
        </label>
        <input
          id="motivo"
          name="motivo"
          placeholder="Ej. cliente liquidó, se negoció por teléfono..."
          required
          className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <button className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold rounded-md py-2 text-sm">
        Confirmar ajuste
      </button>
    </form>
  );
}
