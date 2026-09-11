"use client";

import { useState } from "react";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Redondea hacia arriba a un número "limpio" para usarlo como techo del eje Y. */
function techoLimpio(valor: number) {
  if (valor <= 0) return 100;
  const magnitud = 10 ** Math.floor(Math.log10(valor));
  return Math.ceil(valor / magnitud) * magnitud;
}

export type PuntoOtorgadoCobrado = { mes: string; otorgado: number; cobrado: number };

/** Gráfica de barras agrupadas: monto otorgado vs. cobrado por mes. */
export function GraficaOtorgadoCobrado({ datos }: { datos: PuntoOtorgadoCobrado[] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const techo = techoLimpio(Math.max(1, ...datos.flatMap((d) => [d.otorgado, d.cobrado])));
  const ticks = [techo, techo / 2, 0];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-slate-300">Otorgado vs. cobrado</h3>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-600" />
            Otorgado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            Cobrado
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[52px_1fr]">
        <div className="flex flex-col justify-between h-40 text-[10px] text-slate-500 text-right pr-2">
          {ticks.map((t) => (
            <span key={t}>{currency(t)}</span>
          ))}
        </div>
        <div className="h-40 flex items-end gap-2 border-l border-slate-800 pl-2">
          {datos.map((d, i) => (
            <div
              key={d.mes}
              tabIndex={0}
              onMouseEnter={() => setActivo(i)}
              onMouseLeave={() => setActivo(null)}
              onFocus={() => setActivo(i)}
              onBlur={() => setActivo(null)}
              className="flex-1 h-full flex items-end justify-center gap-0.5 relative outline-none"
            >
              {activo === i && (
                <div className="absolute bottom-full mb-1.5 z-10 bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1.5 text-[11px] whitespace-nowrap shadow-lg">
                  <p className="text-slate-300 font-medium mb-1 capitalize">{d.mes}</p>
                  <p className="text-sky-400">
                    Otorgado: <span className="text-white font-medium">{currency(d.otorgado)}</span>
                  </p>
                  <p className="text-emerald-400">
                    Cobrado: <span className="text-white font-medium">{currency(d.cobrado)}</span>
                  </p>
                </div>
              )}
              <div className="w-full max-w-[16px] flex flex-col items-center justify-end h-full">
                <div
                  className="w-full rounded-t-[4px] bg-sky-600 transition-opacity"
                  style={{
                    height: `${Math.max(1, (d.otorgado / techo) * 100)}%`,
                    opacity: activo === null || activo === i ? 1 : 0.45,
                  }}
                />
              </div>
              <div className="w-full max-w-[16px] flex flex-col items-center justify-end h-full">
                <div
                  className="w-full rounded-t-[4px] bg-emerald-600 transition-opacity"
                  style={{
                    height: `${Math.max(1, (d.cobrado / techo) * 100)}%`,
                    opacity: activo === null || activo === i ? 1 : 0.45,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div />
        <div className="flex justify-around text-[10px] text-slate-500 pt-1.5 pl-2">
          {datos.map((d) => (
            <span key={d.mes} className="capitalize">
              {d.mes}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export type PuntoMora = { mes: string; monto: number };

/** Gráfica de barras: mora generada por mes (una sola serie). */
export function GraficaMora({ datos }: { datos: PuntoMora[] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const techo = techoLimpio(Math.max(1, ...datos.map((d) => d.monto)));
  const ticks = [techo, techo / 2, 0];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Mora generada por mes</h3>

      <div className="grid grid-cols-[52px_1fr]">
        <div className="flex flex-col justify-between h-40 text-[10px] text-slate-500 text-right pr-2">
          {ticks.map((t) => (
            <span key={t}>{currency(t)}</span>
          ))}
        </div>
        <div className="h-40 flex items-end gap-2 border-l border-slate-800 pl-2">
          {datos.map((d, i) => (
            <div
              key={d.mes}
              tabIndex={0}
              onMouseEnter={() => setActivo(i)}
              onMouseLeave={() => setActivo(null)}
              onFocus={() => setActivo(i)}
              onBlur={() => setActivo(null)}
              className="flex-1 h-full flex items-end justify-center relative outline-none"
            >
              {activo === i && (
                <div className="absolute bottom-full mb-1.5 z-10 bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1.5 text-[11px] whitespace-nowrap shadow-lg">
                  <p className="text-slate-300 font-medium capitalize mb-0.5">{d.mes}</p>
                  <p className="text-red-400">
                    Mora: <span className="text-white font-medium">{currency(d.monto)}</span>
                  </p>
                </div>
              )}
              <div className="w-full max-w-[20px] flex flex-col items-center justify-end h-full">
                <div
                  className="w-full rounded-t-[4px] bg-red-500 transition-opacity"
                  style={{
                    height: `${Math.max(1, (d.monto / techo) * 100)}%`,
                    opacity: activo === null || activo === i ? 1 : 0.45,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div />
        <div className="flex justify-around text-[10px] text-slate-500 pt-1.5 pl-2">
          {datos.map((d) => (
            <span key={d.mes} className="capitalize">
              {d.mes}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
