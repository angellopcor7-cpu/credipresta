"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatoRangoSemana, formatoRangoSemanaCorto } from "@/lib/fechas";
import { GananciaChart, type PuntoGanancia } from "./GananciaChart";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function redondearCentavos(n: number) {
  return Math.round(n * 100) / 100;
}

type CorteFila = {
  id: string;
  clave_lunes: string;
  clave_domingo: string;
  total_clientes_activos: number;
  total_prestado_semana: number;
  total_cobrado_semana: number;
  total_mora_generada_semana: number;
  total_mora_acumulada: number;
  total_falta_por_cobrar: number;
  total_comision: number;
};

type GastoFila = { monto: number; fecha: string; categoria: string };

/** Suma los gastos cuya fecha cae dentro de [claveLunes, claveDomingo], ambos inclusive. */
function gastoDeLaSemana(gastos: GastoFila[], claveLunes: string, claveDomingo: string) {
  return gastos
    .filter((g) => g.fecha >= claveLunes && g.fecha <= claveDomingo)
    .reduce((s, g) => s + Number(g.monto), 0);
}

const PERIODOS = [
  { valor: "semana", etiqueta: "1 semana", dias: 7 },
  { valor: "mes", etiqueta: "1 mes", dias: 30 },
  { valor: "seisMeses", etiqueta: "6 meses", dias: 182 },
] as const;

type Periodo = (typeof PERIODOS)[number]["valor"];

/**
 * Filtro de periodo (igual al de "Análisis" en el Panel de Empresa) para la
 * gráfica de rentabilidad y la tabla "Semana por semana" — los únicos dos
 * bloques de /historial que son una serie en el tiempo (las tarjetas de
 * "Ahorita" e "Histórico" arriba siguen siendo siempre todo el tiempo, por
 * definición). Como cada corte ya es UNA fila por semana, cambiar de
 * periodo aquí es nomás recortar el arreglo por fecha — no hace falta que
 * el servidor precalcule nada aparte, a diferencia del Panel.
 */
export function HistorialPeriodos({ cortes, gastos }: { cortes: CorteFila[]; gastos: GastoFila[] }) {
  const [periodo, setPeriodo] = useState<Periodo>("seisMeses");

  const dias = PERIODOS.find((p) => p.valor === periodo)!.dias;
  const fechaCorte = new Date();
  fechaCorte.setUTCDate(fechaCorte.getUTCDate() - dias);
  const claveCorte = fechaCorte.toISOString().slice(0, 10);

  // cortes viene ordenado de más nueva a más vieja.
  const cortesFiltrados = cortes.filter((c) => c.clave_lunes >= claveCorte);

  const datosGanancia: PuntoGanancia[] = [...cortesFiltrados]
    .reverse()
    .map((c) => {
      const gastoSemana = gastoDeLaSemana(gastos, c.clave_lunes, c.clave_domingo);
      const comision = Number(c.total_comision);
      const ingreso = Number(c.total_cobrado_semana);
      return {
        id: c.id,
        etiqueta: formatoRangoSemana(c.clave_lunes),
        etiquetaCorta: formatoRangoSemanaCorto(c.clave_lunes),
        ingreso,
        comision,
        gasto: gastoSemana,
        ganancia: ingreso - comision - gastoSemana,
      };
    });

  const selectorPeriodo = (
    <div className="inline-flex items-center gap-0.5 bg-surface-2 border border-border rounded-full p-0.5 text-xs shrink-0">
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
  );

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-start justify-between flex-wrap gap-2 mb-1">
          <h2 className="flex items-center gap-1.5 font-semibold">
            <TrendingUp className="h-4 w-4 text-ink-muted" />
            ¿El negocio va rentable?
          </h2>
          {selectorPeriodo}
        </div>
        <p className="text-ink-muted text-xs mb-3">
          Ganancia o pérdida estimada por semana (cobrado − comisión de cobradores − gastos). No separa todavía
          capital de interés, así que es una foto del flujo de caja, no la utilidad contable exacta.
        </p>
        <div className="bg-surface border border-border rounded-xl p-4 sm:p-5">
          <GananciaChart datos={datosGanancia} />
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Semana por semana</h2>
        {cortesFiltrados.length === 0 ? (
          <p className="text-ink-muted text-sm">
            {cortes.length === 0
              ? "Todavía no se ha confirmado ningún corte semanal — este historial se va llenando solo cada vez que se hace un corte en Hacer corte."
              : "No hay cortes confirmados en este periodo."}
          </p>
        ) : (
          <>
            <p className="sm:hidden text-xs text-ink-muted mb-2">Desliza la tabla hacia los lados para ver todo →</p>
            <div className="border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface text-ink-muted text-left border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Semana</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Clientes</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Prestado</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Cobrado</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Mora acumulada</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Falta sin mora</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Falta con mora</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Comisión</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Gasto de la semana</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Tendencia</th>
                  </tr>
                </thead>
                <tbody>
                  {cortesFiltrados.map((c) => {
                    // cortesFiltrados está ordenado de más nueva a más
                    // vieja; la siguiente en el arreglo es la semana
                    // ANTERIOR — se compara contra el arreglo completo, no
                    // el filtrado, para que la tendencia de la semana más
                    // vieja visible no se pierda solo por el recorte.
                    const indiceCompleto = cortes.findIndex((cc) => cc.id === c.id);
                    const anterior = cortes[indiceCompleto + 1] ?? null;
                    const gastoSemana = gastoDeLaSemana(gastos, c.clave_lunes, c.clave_domingo);
                    const faltaConMora = Number(c.total_falta_por_cobrar);
                    const faltaConMoraAnterior = anterior ? Number(anterior.total_falta_por_cobrar) : null;
                    return (
                      <tr key={c.id} className="border-t border-border hover:bg-surface-2 transition-colors">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{formatoRangoSemana(c.clave_lunes)}</td>
                        <td className="px-4 py-3 text-ink-secondary whitespace-nowrap">{c.total_clientes_activos}</td>
                        <td className="px-4 py-3 text-ink-secondary whitespace-nowrap">{currency(Number(c.total_prestado_semana))}</td>
                        <td className="px-4 py-3 text-ink-secondary whitespace-nowrap">{currency(Number(c.total_cobrado_semana))}</td>
                        <td className="px-4 py-3 text-danger-text whitespace-nowrap">{currency(Number(c.total_mora_acumulada))}</td>
                        <td className="px-4 py-3 text-ink-secondary whitespace-nowrap">
                          {currency(Number(c.total_falta_por_cobrar) - Number(c.total_mora_acumulada))}
                        </td>
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{currency(faltaConMora)}</td>
                        <td className="px-4 py-3 text-accent-text whitespace-nowrap">{currency(Number(c.total_comision))}</td>
                        <td className="px-4 py-3 text-danger-text whitespace-nowrap">{currency(gastoSemana)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Tendencia actual={faltaConMora} anterior={faltaConMoraAnterior} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="text-xs text-ink-muted mt-2">
          La tendencia compara la deuda total pendiente (falta por cobrar con mora incluida) contra la semana
          anterior: que BAJE es lo bueno (se está cobrando más de lo que se presta/acumula de mora).
        </p>
      </div>
    </div>
  );
}

function Tendencia({ actual, anterior }: { actual: number; anterior: number | null }) {
  if (anterior === null) return <span className="text-ink-muted text-xs">—</span>;
  const diferencia = redondearCentavos(actual - anterior);
  if (diferencia === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
        <Minus className="h-3.5 w-3.5" />
        Igual
      </span>
    );
  }
  if (diferencia < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-accent-text">
        <TrendingDown className="h-3.5 w-3.5" />
        Mejorando ({currency(Math.abs(diferencia))})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-danger-text">
      <TrendingUp className="h-3.5 w-3.5" />
      Empeorando ({currency(diferencia)})
    </span>
  );
}
