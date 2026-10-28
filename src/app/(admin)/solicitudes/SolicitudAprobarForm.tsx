"use client";

import { useState } from "react";
import {
  calcularPorcentajeInteresPorPlan,
  calcularInteres,
  calcularMontoTotal,
  calcularCuotaSugerida,
  aplicarDescuentoApertura,
  esPlanValido,
  type MotivoDescuentoApertura,
} from "@/lib/finance/calculos";
import { aprobarSolicitud } from "./actions";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

const DIAS_SEMANA_LABEL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const ETIQUETA_MOTIVO_DESCUENTO: Record<MotivoDescuentoApertura, string> = {
  cliente_nuevo: "cliente nuevo",
  renovacion_normal: "renovación",
  renovacion_mismo_dia_liquidacion_anticipada: "liquidó antes de tiempo y renueva el mismo día",
};

/**
 * Aprobar/rechazar: el % de interés total viene precargado (el fijo del
 * plan, o el que haya propuesto el cobrador si mandó uno personalizado),
 * pero Empresa lo puede cambiar aquí mismo antes de aprobar — el número que
 * quede en el cuadro es el que se usa para crear el préstamo.
 *
 * El descuento de apertura ($50 o $150, ver `calcularDescuentoApertura`) ya
 * viene calculado desde el servidor (mismo cálculo que usará
 * `aprobarSolicitud` al crear el préstamo) — aquí solo se muestra y se resta
 * del total, para que Empresa vea antes de aprobar cuánto se le va a
 * descontar al cliente y por qué.
 */
export function SolicitudAprobarForm({
  solicitudId,
  montoSolicitado,
  plazoDias,
  porcentajePersonalizado,
  diasPersonalizados,
  administradores,
  descuentoApertura,
  motivoDescuentoApertura,
}: {
  solicitudId: string;
  montoSolicitado: number;
  plazoDias: number;
  porcentajePersonalizado: number | null;
  diasPersonalizados: number[] | null;
  administradores: { id: string; nombre: string }[];
  descuentoApertura: number;
  motivoDescuentoApertura: MotivoDescuentoApertura;
}) {
  const porcentajeInicial =
    porcentajePersonalizado ?? (esPlanValido(plazoDias) ? calcularPorcentajeInteresPorPlan(plazoDias) : 0);
  const [porcentajeTexto, setPorcentajeTexto] = useState(String(porcentajeInicial));

  const porcentaje = Number(porcentajeTexto) || 0;
  const interes = porcentaje > 0 ? calcularInteres(montoSolicitado, porcentaje) : 0;
  const totalSinDescuento = porcentaje > 0 ? calcularMontoTotal(montoSolicitado, porcentaje) : montoSolicitado;
  const total = aplicarDescuentoApertura(totalSinDescuento, descuentoApertura);
  const pagoDiario = porcentaje > 0 && plazoDias > 0 ? calcularCuotaSugerida(total, plazoDias) : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-4 bg-page border border-border rounded-lg p-3 text-sm max-w-xl">
        <div className="space-y-1">
          <label className="text-ink-muted text-xs" htmlFor={`porcentaje-${solicitudId}`}>
            % de interés total ({plazoDias} días)
            {porcentajePersonalizado != null && <span className="text-accent-text"> · propuesto por el cobrador</span>}
          </label>
          <input
            id={`porcentaje-${solicitudId}`}
            type="number"
            min="0.01"
            step="0.01"
            value={porcentajeTexto}
            onChange={(e) => setPorcentajeTexto(e.target.value)}
            className="w-24 rounded-md bg-surface-2 border border-border-strong px-2 py-1.5 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div>
          <p className="text-ink-muted text-xs">Interés</p>
          <p className="font-semibold">{currency(interes)}</p>
        </div>
        <div>
          <p className="text-ink-muted text-xs">Total a pagar</p>
          <p className="font-semibold text-accent-text">{currency(total)}</p>
        </div>
        <div>
          <p className="text-ink-muted text-xs">Pago diario</p>
          <p className="font-semibold">{currency(pagoDiario)}</p>
        </div>
      </div>

      {descuentoApertura > 0 && (
        <p className="text-xs text-accent-text">
          Se le aplicará un descuento de apertura de {currency(descuentoApertura)} por{" "}
          {ETIQUETA_MOTIVO_DESCUENTO[motivoDescuentoApertura]} (ya restado del total de arriba: sin descuento
          serían {currency(totalSinDescuento)}).
        </p>
      )}

      {diasPersonalizados && (
        <p className="text-xs text-accent-text">
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
          className="rounded-md bg-surface-2 border border-border-strong px-2 py-1.5 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
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
        <button className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm px-3 py-1.5 rounded-md">
          Aprobar
        </button>
      </form>
    </div>
  );
}
