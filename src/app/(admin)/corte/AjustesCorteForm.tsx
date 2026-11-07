"use client";

import { useState } from "react";
import { Settings, X } from "lucide-react";
import { actualizarDiaInicioSemana } from "./actions";

const DIAS = [
  { valor: 0, etiqueta: "Domingo" },
  { valor: 1, etiqueta: "Lunes" },
  { valor: 2, etiqueta: "Martes" },
  { valor: 3, etiqueta: "Miércoles" },
  { valor: 4, etiqueta: "Jueves" },
  { valor: 5, etiqueta: "Viernes" },
  { valor: 6, etiqueta: "Sábado" },
] as const;

/**
 * Botón de engrane que despliega un formulario chiquito para elegir qué día
 * empieza la semana del corte (antes era siempre lunes a fuerza en el
 * código) — a petición de Angel. Solo afecta semanas nuevas; los cortes ya
 * confirmados se quedan con las fechas con las que se guardaron.
 */
export function AjustesCorteForm({ diaInicioSemanaActual }: { diaInicioSemanaActual: number }) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Elegir qué día empieza la semana del corte"
        className="inline-flex items-center justify-center h-9 w-9 rounded-md bg-surface-2 hover:bg-surface-3 border border-border-strong text-ink-secondary hover:text-ink"
      >
        <Settings className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setAbierto(false)}>
      <form
        action={actualizarDiaInicioSemana}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-surface border border-border rounded-xl p-5 space-y-3"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-strong">Día de inicio de la semana</p>
          <button type="button" onClick={() => setAbierto(false)} className="text-ink-muted hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-ink-muted">
          No es obligatorio que sea lunes a domingo — elige con qué día quieres que empiece y termine la semana del
          corte, del Panel y de /historial. Solo afecta semanas nuevas; los cortes ya confirmados no cambian.
        </p>
        <select
          name="dia_inicio_semana"
          defaultValue={diaInicioSemanaActual}
          className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {DIAS.map((d) => (
            <option key={d.valor} value={d.valor}>
              {d.etiqueta}
            </option>
          ))}
        </select>
        <button className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm rounded-md py-2">
          Guardar
        </button>
      </form>
    </div>
  );
}
