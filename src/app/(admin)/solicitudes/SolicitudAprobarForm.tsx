"use client";

import { calcularPorcentajeInteresPorPlan, calcularInteres, calcularMontoTotal, calcularCuotaSugerida } from "@/lib/finance/calculos";
import { aprobarSolicitud } from "./actions";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

const DIAS_SEMANA_LABEL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Aprobar/rechazar ya no depende de una firma digital: el plan (20 o 30 días) ya trae el interés fijo, así que solo falta elegir quién aprueba. */
export function SolicitudAprobarForm({
  solicitudId,
  montoSolicitado,
  plazoDias,
  diasPersonalizados,
  administradores,
}: {
  solicitudId: string;
  montoSolicitado: number;
  plazoDias: number;
  diasPersonalizados: number[] | null;
  administradores: { id: string; nombre: string }[];
}) {
  const porcentajeTotal = calcularPorcentajeInteresPorPlan(plazoDias === 30 ? 30 : 20);
  const interes = calcularInteres(montoSolicitado, porcentajeTotal);
  const total = calcularMontoTotal(montoSolicitado, porcentajeTotal);
  const pagoDiario = calcularCuotaSugerida(total, plazoDias);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm max-w-md">
        <div>
          <p className="text-slate-500 text-xs">Interés total ({plazoDias} días)</p>
          <p className="font-semibold">
            {porcentajeTotal}% ({currency(interes)})
          </p>
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
