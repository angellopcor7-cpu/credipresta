"use client";

import { useState } from "react";
import { calcularPorcentajeInteresPorPlan, calcularInteres, calcularMontoTotal, calcularCuotaSugerida, esPlanValido } from "@/lib/finance/calculos";
import { aprobarSolicitud } from "./actions";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

const DIAS_SEMANA_LABEL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/**
 * Aprobar/rechazar: el % de interés total viene precargado (el fijo del
 * plan, o el que haya propuesto el cobrador si mandó uno personalizado),
 * pero Empresa lo puede cambiar aquí mismo antes de aprobar — el número que
 * quede en el cuadro es el que se usa para crear el préstamo.
 */
export function SolicitudAprobarForm({
  solicitudId,
  montoSolicitado,
  plazoDias,
  porcentajePersonalizado,
  diasPersonalizados,
  administradores,
}: {
  solicitudId: string;
  montoSolicitado: number;
  plazoDias: number;
  porcentajePersonalizado: number | null;
  diasPersonalizados: number[] | null;
  administradores: { id: string; nombre: string }[];
}) {
  const porcentajeInicial =
    porcentajePersonalizado ?? (esPlanValido(plazoDias) ? calcularPorcentajeInteresPorPlan(plazoDias) : 0);
  const [porcentajeTexto, setPorcentajeTexto] = useState(String(porcentajeInicial));

  const porcentaje = Number(porcentajeTexto) || 0;
  const interes = porcentaje > 0 ? calcularInteres(montoSolicitado, porcentaje) : 0;
  const total = porcentaje > 0 ? calcularMontoTotal(montoSolicitado, porcentaje) : montoSolicitado;
  const pagoDiario = porcentaje > 0 && plazoDias > 0 ? calcularCuotaSugerida(total, plazoDias) : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-4 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm max-w-xl">
        <div className="space-y-1">
          <label className="text-slate-500 text-xs" htmlFor={`porcentaje-${solicitudId}`}>
            % de interés total ({plazoDias} días)
            {porcentajePersonalizado != null && <span className="text-amber-400"> · propuesto por el cobrador</span>}
          </label>
          <input
            id={`porcentaje-${solicitudId}`}
            type="number"
            min="0.01"
            step="0.01"
            value={porcentajeTexto}
            onChange={(e) => setPorcentajeTexto(e.target.value)}
            className="w-24 rounded-md bg-slate-800 border border-slate-700 px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div>
          <p className="text-slate-500 text-xs">Interés</p>
          <p className="font-semibold">{currency(interes)}</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs">Total a pagar</p>
          <p className="font-semibold text-amber-400">{currency(total)}</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs">Pago diario</p>
          <p className="font-semibold">{currency(pagoDiario)}</p>
        </div>
      </div>

      {diasPersonalizados && (
        <p className="text-xs text-amber-400">
          Días de cobro personalizados:{" "}
          {diasPersonalizados.length === 0 ? "ninguno fijo" : diasPersonalizados.map((d) => DIAS_SEMANA_LABEL[d]).join(", ")}
        </p>
      )}

      <form action={aprobarSolicitud} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="solicitud_id" value={solicitudId} />
        <input type="hidden" name="porcentaje_interes" value={porcentajeTexto} />
        <select
          name="revisado_por"
          required
          defaultValue=""
          className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="" disabled>
            ¿Quién aprueba?
          </option>
          {administradores.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
        <button className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm px-3 py-1.5 rounded-md">
          Aprobar
        </button>
      </form>
    </div>
  );
}
