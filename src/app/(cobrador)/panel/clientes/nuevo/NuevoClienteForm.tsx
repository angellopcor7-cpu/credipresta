"use client";

import { useMemo, useState } from "react";
import { UserRound, Landmark, CalendarClock, FileImage, CircleCheck } from "lucide-react";
import { crearClienteYSolicitud } from "../../../actions";
import {
  calcularPorcentajeInteresPorPlan,
  calcularInteres,
  calcularMontoTotal,
  calcularCuotaSugerida,
  type PlanPrestamo,
} from "@/lib/finance/calculos";

const DIAS_SEMANA = [
  { valor: 0, label: "Domingo" },
  { valor: 1, label: "Lunes" },
  { valor: 2, label: "Martes" },
  { valor: 3, label: "Miércoles" },
  { valor: 4, label: "Jueves" },
  { valor: 5, label: "Viernes" },
  { valor: 6, label: "Sábado" },
];
const DIAS_ENTRE_SEMANA = [1, 2, 3, 4, 5];

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

export function NuevoClienteForm({ error }: { error?: string }) {
  const [monto, setMonto] = useState("");
  const [plan, setPlan] = useState<PlanPrestamo>(20);
  const [personalizarDias, setPersonalizarDias] = useState(false);
  const [diasElegidos, setDiasElegidos] = useState<number[]>(DIAS_ENTRE_SEMANA);

  const preview = useMemo(() => {
    const montoNum = Number(monto);
    if (!montoNum || montoNum <= 0) return null;

    const porcentaje = calcularPorcentajeInteresPorPlan(plan);
    const interes = calcularInteres(montoNum, porcentaje);
    const total = calcularMontoTotal(montoNum, porcentaje);
    const pagoDiario = calcularCuotaSugerida(total, plan);

    return { porcentaje, interes, total, pagoDiario };
  }, [monto, plan]);

  function alternarDia(dia: number) {
    setDiasElegidos((actual) => (actual.includes(dia) ? actual.filter((d) => d !== dia) : [...actual, dia].sort()));
  }

  return (
    <form
      action={crearClienteYSolicitud}
      encType="multipart/form-data"
      className="space-y-5 bg-slate-900 p-6 rounded-xl border border-slate-800"
    >
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
          <UserRound className="h-4 w-4 text-amber-400" />
          Datos del cliente
        </p>
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="nombre_completo">
            Nombre completo
          </label>
          <input
            id="nombre_completo"
            name="nombre_completo"
            required
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm text-slate-300" htmlFor="telefono">
              Teléfono
            </label>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-300" htmlFor="direccion">
              Dirección
            </label>
            <input
              id="direccion"
              name="direccion"
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-slate-800 pt-4">
        <p className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
          <Landmark className="h-4 w-4 text-amber-400" />
          Préstamo
        </p>
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="monto_solicitado">
            Valor del préstamo
          </label>
          <input
            id="monto_solicitado"
            name="monto_solicitado"
            type="number"
            min="1"
            step="0.01"
            required
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="w-full max-w-xs rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="space-y-1">
          <p className="text-sm text-slate-300">Plan</p>
          <div className="grid grid-cols-2 gap-2 max-w-xs">
            {([20, 30] as const).map((opcion) => (
              <label
                key={opcion}
                className="flex flex-col items-center gap-0.5 rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-300 has-[:checked]:border-amber-500 has-[:checked]:text-amber-400 cursor-pointer"
              >
                <input
                  type="radio"
                  name="plazo_dias"
                  value={opcion}
                  checked={plan === opcion}
                  onChange={() => setPlan(opcion)}
                  className="accent-amber-500"
                />
                <span className="font-semibold">{opcion} días</span>
                <span className="text-xs">{calcularPorcentajeInteresPorPlan(opcion)}% total</span>
              </label>
            ))}
          </div>
        </div>

        {preview ? (
          <div className="grid grid-cols-3 gap-3 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm max-w-md">
            <div>
              <p className="text-slate-500 text-xs">Interés total</p>
              <p className="font-semibold">
                {preview.porcentaje}% ({currency(preview.interes)})
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Valor a pagar</p>
              <p className="font-semibold text-amber-400">{currency(preview.total)}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Pago diario</p>
              <p className="font-semibold">{currency(preview.pagoDiario)}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Escribe el valor del préstamo para ver el total y el pago diario.</p>
        )}
      </div>

      <div className="space-y-2 border-t border-slate-800 pt-4">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            name="personalizar_dias"
            checked={personalizarDias}
            onChange={(e) => setPersonalizarDias(e.target.checked)}
            className="accent-amber-500"
          />
          <CalendarClock className="h-4 w-4 text-slate-400 shrink-0" />
          Este cliente va a pagar en días distintos a los normales (por ejemplo, fines de semana)
        </label>
        {personalizarDias && (
          <div className="space-y-2 pl-6">
            <p className="text-xs text-slate-500">Marca los días en que SÍ se le va a cobrar a este cliente.</p>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA.map((dia) => (
                <label
                  key={dia.valor}
                  className="flex items-center gap-1.5 rounded-md bg-slate-800 border border-slate-700 px-2 py-1.5 text-xs text-slate-300 has-[:checked]:border-amber-500 has-[:checked]:text-amber-400 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    name={`dia_${dia.valor}`}
                    checked={diasElegidos.includes(dia.valor)}
                    onChange={() => alternarDia(dia.valor)}
                    className="accent-amber-500"
                  />
                  {dia.label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-slate-800 pt-4">
        <p className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
          <FileImage className="h-4 w-4 text-amber-400" />
          Documentos
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm text-slate-300" htmlFor="doc_ine_frente">
              Foto del INE (frente)
            </label>
            <input
              id="doc_ine_frente"
              name="doc_ine_frente"
              type="file"
              accept="image/*"
              capture="environment"
              required
              className="w-full text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-300" htmlFor="doc_ine_reverso">
              Foto del INE (reverso, opcional)
            </label>
            <input
              id="doc_ine_reverso"
              name="doc_ine_reverso"
              type="file"
              accept="image/*"
              capture="environment"
              className="w-full text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-white"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="doc_pagare_firmado">
            Foto del pagaré ya firmado a mano
          </label>
          <input
            id="doc_pagare_firmado"
            name="doc_pagare_firmado"
            type="file"
            accept="image/*"
            capture="environment"
            required
            className="w-full text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-white"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">{error}</p>
      )}

      <button className="w-full inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-md py-2 text-sm">
        <CircleCheck className="h-4 w-4" />
        Crear cliente y enviar a Empresa
      </button>
    </form>
  );
}
