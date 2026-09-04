"use client";

import { useMemo, useState } from "react";
import { crearPrestamo } from "../actions";
import { calcularInteres, calcularMontoTotal, calcularCuotaSugerida } from "@/lib/finance/calculos";

const INTERES_DIARIO_POR_DEFECTO = 1;
const PLAZO_POR_DEFECTO = 20;

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

type Cliente = { id: string; nombre_completo: string };
type Cobrador = { id: string; usuarios: { nombre_completo: string } | null };

export function NuevoPrestamoForm({
  clientes,
  cobradores,
  error,
}: {
  clientes: Cliente[];
  cobradores: Cobrador[];
  error?: string;
}) {
  const [monto, setMonto] = useState("");
  const [plazo, setPlazo] = useState(String(PLAZO_POR_DEFECTO));
  const [interesDiario, setInteresDiario] = useState(String(INTERES_DIARIO_POR_DEFECTO));
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia" | "ambos">("efectivo");
  const [datosTransferencia, setDatosTransferencia] = useState("");
  const requiereDatosTransferencia = metodoPago === "transferencia" || metodoPago === "ambos";

  // Cálculo en vivo con lo que el usuario va escribiendo — las mismas
  // funciones puras que usa el servidor, para que la vista previa sea
  // exactamente lo que se va a guardar.
  const preview = useMemo(() => {
    const montoNum = Number(monto);
    const plazoNum = Number(plazo);
    const interesDiarioNum = Number(interesDiario);

    if (!montoNum || montoNum <= 0 || !plazoNum || plazoNum <= 0 || !interesDiarioNum || interesDiarioNum <= 0) {
      return null;
    }

    const porcentajeTotal = interesDiarioNum * plazoNum;
    const interes = calcularInteres(montoNum, porcentajeTotal);
    const total = calcularMontoTotal(montoNum, porcentajeTotal);
    const pagoDiario = calcularCuotaSugerida(total, plazoNum);

    return { porcentajeTotal, interes, total, pagoDiario };
  }, [monto, plazo, interesDiario]);

  return (
    <form action={crearPrestamo} className="space-y-4 bg-slate-900 p-6 rounded-xl border border-slate-800">
      <div className="space-y-1">
        <label className="text-sm text-slate-300" htmlFor="cliente_id">
          Cliente
        </label>
        <select
          id="cliente_id"
          name="cliente_id"
          required
          defaultValue=""
          className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="" disabled>
            Selecciona un cliente
          </option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre_completo}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm text-slate-300" htmlFor="cobrador_id">
          Cobrador responsable (opcional)
        </label>
        <select
          id="cobrador_id"
          name="cobrador_id"
          defaultValue=""
          className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Sin asignar</option>
          {cobradores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.usuarios?.nombre_completo}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="monto_prestado">
            Monto prestado
          </label>
          <input
            id="monto_prestado"
            name="monto_prestado"
            type="number"
            min="1"
            step="0.01"
            required
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="plazo_dias">
            Plazo (días)
          </label>
          <input
            id="plazo_dias"
            name="plazo_dias"
            type="number"
            min="1"
            step="1"
            required
            value={plazo}
            onChange={(e) => setPlazo(e.target.value)}
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm text-slate-300" htmlFor="porcentaje_interes_diario">
          Interés diario (%)
        </label>
        <input
          id="porcentaje_interes_diario"
          name="porcentaje_interes_diario"
          type="number"
          min="0.01"
          step="0.01"
          required
          value={interesDiario}
          onChange={(e) => setInteresDiario(e.target.value)}
          className="w-full max-w-[10rem] rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm text-slate-300">Método de pago</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { value: "efectivo", label: "Efectivo" },
              { value: "transferencia", label: "Transferencia" },
              { value: "ambos", label: "Ambos" },
            ] as const
          ).map((opcion) => (
            <label
              key={opcion.value}
              className="flex items-center justify-center gap-1.5 rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-xs text-slate-300 has-[:checked]:border-emerald-500 has-[:checked]:text-emerald-400 cursor-pointer"
            >
              <input
                type="radio"
                name="metodo_pago"
                value={opcion.value}
                checked={metodoPago === opcion.value}
                onChange={() => setMetodoPago(opcion.value)}
                className="accent-emerald-500"
              />
              {opcion.label}
            </label>
          ))}
        </div>
        {requiereDatosTransferencia && (
          <textarea
            name="datos_transferencia"
            rows={2}
            value={datosTransferencia}
            onChange={(e) => setDatosTransferencia(e.target.value)}
            placeholder="Datos para recibir la transferencia: banco, cuenta/CLABE, titular"
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        )}
      </div>

      {preview ? (
        <div className="grid grid-cols-3 gap-3 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm">
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
        <p className="text-xs text-slate-500">
          Llena monto, plazo e interés diario para ver aquí cuánto va a pagar en total. El interés, el total y el
          calendario de pagos se calculan automáticamente al guardar.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">{error}</p>
      )}

      <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-md py-2 text-sm">
        Crear préstamo
      </button>
    </form>
  );
}
