"use client";

import { useState } from "react";
import { GraficaOtorgadoCobrado, GraficaMora, type PuntoOtorgadoCobrado, type PuntoMora } from "./AnalisisCharts";

type DatosAnalisis = { otorgadoCobrado: PuntoOtorgadoCobrado[]; mora: PuntoMora[] };

const PERIODOS = [
  { valor: "semana", etiqueta: "1 semana" },
  { valor: "mes", etiqueta: "1 mes" },
  { valor: "seisMeses", etiqueta: "6 meses" },
] as const;

type Periodo = (typeof PERIODOS)[number]["valor"];

/**
 * El servidor ya calculó los 3 periodos (semana = por día, mes = por semana,
 * 6 meses = por mes) en dashboard/page.tsx, así que cambiar de periodo acá
 * es instantáneo — nada más se cambia qué arreglo se le pasa a las gráficas.
 */
export function AnalisisPeriodos({
  semana,
  mes,
  seisMeses,
}: {
  semana: DatosAnalisis;
  mes: DatosAnalisis;
  seisMeses: DatosAnalisis;
}) {
  const [periodo, setPeriodo] = useState<Periodo>("seisMeses");

  const datos: Record<Periodo, DatosAnalisis> = { semana, mes, seisMeses };
  const actual = datos[periodo];

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="text-sm font-semibold text-ink-secondary">Análisis</h2>
        <div className="inline-flex items-center gap-0.5 bg-surface-2 border border-border rounded-full p-0.5 text-xs">
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              type="button"
              onClick={() => setPeriodo(p.valor)}
              aria-pressed={periodo === p.valor}
              className={`rounded-full px-3 py-1 font-medium transition-colors ${
                periodo === p.valor ? "bg-amber-500 text-neutral-950" : "text-ink-muted hover:text-ink"
              }`}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GraficaOtorgadoCobrado datos={actual.otorgadoCobrado} />
        <GraficaMora datos={actual.mora} />
      </div>
    </div>
  );
}
