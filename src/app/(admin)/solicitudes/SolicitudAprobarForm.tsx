"use client";

import { useMemo, useState } from "react";
import { calcularInteres, calcularMontoTotal, calcularCuotaSugerida } from "@/lib/finance/calculos";
import { aprobarSolicitud } from "./actions";

const INTERES_DIARIO_POR_DEFECTO = 1;

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

/** Form de aprobar con vista previa en vivo: la solicitud ya trae monto y plazo fijos, lo único que el admin ajusta es el interés diario. */
export function SolicitudAprobarForm({ solicitudId, montoSolicitado, plazoDias }: {
  solicitudId: string;
  montoSolicitado: number;
  plazoDias: number;
}) {
  const [interesDiario, setInteresDiario] = useState(String(INTERES_DIARIO_POR_DEFECTO));

  const preview = useMemo(() => {
    const interesDiarioNum = Number(interesDiario);
    if (!interesDiarioNum || interesDiarioNum <= 0) return null;

    const porcentajeTotal = interesDiarioNum * plazoDias;
    const interes = calcularInteres(montoSolicitado, porcentajeTotal);
    const total = calcularMontoTotal(montoSolicitado, porcentajeTotal);
    const pagoDiario = calcularCuotaSugerida(total, plazoDias);

    return { porcentajeTotal, interes, total, pagoDiario };
  }, [interesDiario, montoSolicitado, plazoDias]);

  return (
    <form action={aprobarSolicitud} className="space-y-3">
      <input type="hidden" name="solicitud_id" value={solicitudId} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-slate-400" htmlFor={`interes-${solicitudId}`}>
          Interés diario (%)
        </label>
        <input
          id={`interes-${solicitudId}`}
          name="porcentaje_interes_diario"
          type="number"
          min="0.01"
          step="0.01"
          value={interesDiario}
          onChange={(e) => setInteresDiario(e.target.value)}
          required
          className="w-20 rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm px-3 py-1.5 rounded-md">
          Aprobar
        </button>
      </div>

      {preview ? (
        <div className="grid grid-cols-3 gap-3 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm max-w-md">
          <div>
            <p className="text-slate-500 text-xs">Interés total</p>
            <p className="font-semibold">
              {preview.porcentajeTotal}% ({currency(preview.interes)})
            </p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Total a pagar</p>
            <p className="font-semibold text-emerald-400">{currency(preview.total)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Pago diario</p>
            <p className="font-semibold">{currency(preview.pagoDiario)}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Escribe el interés diario para ver cuánto va a pagar en total.</p>
      )}
    </form>
  );
}
