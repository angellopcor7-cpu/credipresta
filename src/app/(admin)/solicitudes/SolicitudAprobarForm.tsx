"use client";

import { useMemo, useState } from "react";
import { calcularInteres, calcularMontoTotal, calcularCuotaSugerida } from "@/lib/finance/calculos";
import { generarPagareParaFirma, aprobarSolicitud } from "./actions";
import type { EstadoSolicitud } from "@/lib/types";

const INTERES_DIARIO_POR_DEFECTO = 1;

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function Preview({ porcentajeTotal, interes, total, pagoDiario }: { porcentajeTotal: number; interes: number; total: number; pagoDiario: number }) {
  return (
    <div className="grid grid-cols-3 gap-3 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm max-w-md">
      <div>
        <p className="text-slate-500 text-xs">Interés total</p>
        <p className="font-semibold">
          {porcentajeTotal}% ({currency(interes)})
        </p>
      </div>
      <div>
        <p className="text-slate-500 text-xs">Total a pagar</p>
        <p className="font-semibold text-emerald-400">{currency(total)}</p>
      </div>
      <div>
        <p className="text-slate-500 text-xs">Pago diario</p>
        <p className="font-semibold">{currency(pagoDiario)}</p>
      </div>
    </div>
  );
}

/**
 * Estado por estado:
 * - pendiente: el admin escribe el interés diario y genera el pagaré (el
 *   botón "Aprobar" está bloqueado, todavía no existe).
 * - esperando_firma: el pagaré ya se generó con el interés fijo; se espera
 *   a que el cliente entre a su cuenta y dibuje su firma. Nada que hacer
 *   aquí más que esperar.
 * - firmada: el cliente ya firmó — se desbloquea "Aprobar" para crear el
 *   préstamo con esos mismos datos.
 */
export function SolicitudAprobarForm({
  solicitudId,
  montoSolicitado,
  plazoDias,
  estado,
  porcentajeInteresDiarioPropuesto,
  firmaClienteDataUrl,
}: {
  solicitudId: string;
  montoSolicitado: number;
  plazoDias: number;
  estado: EstadoSolicitud;
  porcentajeInteresDiarioPropuesto: number | null;
  firmaClienteDataUrl: string | null;
}) {
  const [interesDiario, setInteresDiario] = useState(String(INTERES_DIARIO_POR_DEFECTO));

  const previewEnVivo = useMemo(() => {
    const interesDiarioNum = Number(interesDiario);
    if (!interesDiarioNum || interesDiarioNum <= 0) return null;

    const porcentajeTotal = interesDiarioNum * plazoDias;
    return {
      porcentajeTotal,
      interes: calcularInteres(montoSolicitado, porcentajeTotal),
      total: calcularMontoTotal(montoSolicitado, porcentajeTotal),
      pagoDiario: calcularCuotaSugerida(calcularMontoTotal(montoSolicitado, porcentajeTotal), plazoDias),
    };
  }, [interesDiario, montoSolicitado, plazoDias]);

  const previewFijo = useMemo(() => {
    if (!porcentajeInteresDiarioPropuesto) return null;
    const porcentajeTotal = porcentajeInteresDiarioPropuesto * plazoDias;
    return {
      porcentajeTotal,
      interes: calcularInteres(montoSolicitado, porcentajeTotal),
      total: calcularMontoTotal(montoSolicitado, porcentajeTotal),
      pagoDiario: calcularCuotaSugerida(calcularMontoTotal(montoSolicitado, porcentajeTotal), plazoDias),
    };
  }, [porcentajeInteresDiarioPropuesto, montoSolicitado, plazoDias]);

  if (estado === "pendiente") {
    return (
      <form action={generarPagareParaFirma} className="space-y-3">
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
          <button
            type="submit"
            disabled={!previewEnVivo}
            className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm px-3 py-1.5 rounded-md"
          >
            Pagaré
          </button>
          <button
            type="button"
            disabled
            title="Primero hay que generar el pagaré y que el cliente lo firme"
            className="bg-emerald-500 text-slate-950 font-semibold text-sm px-3 py-1.5 rounded-md opacity-40 cursor-not-allowed"
          >
            Aprobar
          </button>
        </div>

        {previewEnVivo ? (
          <Preview {...previewEnVivo} />
        ) : (
          <p className="text-xs text-slate-500">Escribe el interés diario para generar el pagaré.</p>
        )}
      </form>
    );
  }

  if (estado === "esperando_firma") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs bg-amber-950 text-amber-400 border border-amber-900 rounded-full px-3 py-1.5">
            Esperando que el cliente firme su pagaré
          </span>
          <button
            type="button"
            disabled
            title="El cliente todavía no firma su pagaré"
            className="bg-emerald-500 text-slate-950 font-semibold text-sm px-3 py-1.5 rounded-md opacity-40 cursor-not-allowed"
          >
            Aprobar
          </button>
        </div>
        {previewFijo && <Preview {...previewFijo} />}
      </div>
    );
  }

  // firmada
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-900 rounded-full px-3 py-1.5">
          El cliente ya firmó su pagaré
        </span>
        <form action={aprobarSolicitud}>
          <input type="hidden" name="solicitud_id" value={solicitudId} />
          <button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm px-3 py-1.5 rounded-md">
            Aprobar
          </button>
        </form>
      </div>
      {previewFijo && <Preview {...previewFijo} />}
      {firmaClienteDataUrl && (
        <div>
          <p className="text-xs text-slate-500 mb-1">Firma del cliente</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={firmaClienteDataUrl}
            alt="Firma del cliente"
            className="bg-white rounded-md border border-slate-700 h-24 w-auto"
          />
        </div>
      )}
    </div>
  );
}
