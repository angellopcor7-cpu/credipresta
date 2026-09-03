import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CalendarioPago, Mora, Pago, Prestamo } from "@/lib/types";
import { registrarPago } from "../actions";
import { aplicarMoraDesdeFormulario } from "../moras-actions";

type PrestamoConClienteDetalle = Prestamo & {
  clientes: { nombre_completo: string; telefono: string | null } | null;
};

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

const estadoLabel: Record<string, string> = {
  activo: "Activo",
  en_mora: "En mora",
  liquidado: "Liquidado",
  cancelado: "Cancelado",
};

export default async function DetallePrestamoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; exito?: string }>;
}) {
  const { id } = await params;
  const { error, exito } = await searchParams;
  const supabase = await createClient();

  const [{ data: prestamo }, { data: pagos }, { data: calendario }, { data: moras }] = await Promise.all([
    supabase.from("prestamos").select("*, clientes(nombre_completo, telefono)").eq("id", id).single(),
    supabase.from("pagos").select("*").eq("prestamo_id", id).order("created_at", { ascending: false }),
    supabase.from("calendario_pagos").select("*").eq("prestamo_id", id).order("numero_dia"),
    supabase.from("moras").select("*").eq("prestamo_id", id).order("fecha_generada", { ascending: false }),
  ]);

  if (!prestamo) notFound();

  const p = prestamo as unknown as PrestamoConClienteDetalle;
  const listaPagos = (pagos ?? []) as Pago[];
  const listaCalendario = (calendario ?? []) as CalendarioPago[];
  const listaMoras = (moras ?? []) as Mora[];
  const puedeRecibirPagos = p.estado === "activo" || p.estado === "en_mora";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/prestamos" className="text-sm text-slate-400 hover:text-white">
          ← Préstamos
        </Link>
        <h1 className="text-2xl font-bold mt-1">{p.clientes?.nombre_completo ?? "—"}</h1>
        <p className="text-slate-400 text-sm">{p.clientes?.telefono ?? "Sin teléfono"}</p>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <Resumen label="Prestado" value={currency(Number(p.monto_prestado))} />
        <Resumen label="Interés" value={`${p.porcentaje_interes}%`} />
        <Resumen label="Total a pagar" value={currency(Number(p.monto_total))} />
        <Resumen label="Saldo actual" value={currency(Number(p.saldo_actual))} destacado />
      </div>

      <div className="flex items-center gap-3 text-sm text-slate-400">
        <span className="border border-slate-700 rounded-full px-2 py-1">{estadoLabel[p.estado]}</span>
        <span>Plazo: {p.plazo_dias} días</span>
        <span>Cuota sugerida: {currency(Number(p.monto_cuota_sugerida))}</span>
      </div>

      {exito && (
        <p className="text-sm text-emerald-400 bg-emerald-950/50 border border-emerald-900 rounded-md px-3 py-2">
          {exito}
        </p>
      )}

      {puedeRecibirPagos && (
        <form action={aplicarMoraDesdeFormulario}>
          <input type="hidden" name="prestamo_id" value={p.id} />
          <button className="text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-md px-4 py-2">
            Aplicar mora de hoy
          </button>
        </form>
      )}

      {puedeRecibirPagos ? (
        <form
          action={registrarPago}
          className="space-y-3 bg-slate-900 p-6 rounded-xl border border-slate-800 max-w-md"
        >
          <input type="hidden" name="prestamo_id" value={p.id} />
          <h2 className="font-semibold">Registrar pago / abono</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm text-slate-300" htmlFor="monto">
                Monto
              </label>
              <input
                id="monto"
                name="monto"
                type="number"
                min="0.01"
                step="0.01"
                max={p.saldo_actual}
                required
                className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-300" htmlFor="tipo">
                Tipo
              </label>
              <select
                id="tipo"
                name="tipo"
                defaultValue="cuota_diaria"
                className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="cuota_diaria">Cuota diaria</option>
                <option value="abono_libre">Abono libre</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-300" htmlFor="metodo">
              Método (opcional)
            </label>
            <input
              id="metodo"
              name="metodo"
              placeholder="Efectivo, transferencia..."
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-md py-2 text-sm">
            Registrar
          </button>
        </form>
      ) : (
        <p className="text-sm text-slate-500">
          Este préstamo está {estadoLabel[p.estado].toLowerCase()} — no admite más pagos.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <h2 className="font-semibold mb-2">Historial de pagos</h2>
          {listaPagos.length === 0 ? (
            <p className="text-slate-500 text-sm">Sin pagos registrados.</p>
          ) : (
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-slate-400 text-left">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Monto</th>
                    <th className="px-3 py-2">Saldo después</th>
                  </tr>
                </thead>
                <tbody>
                  {listaPagos.map((pago) => (
                    <tr key={pago.id} className="border-t border-slate-800">
                      <td className="px-3 py-2 text-slate-300">{pago.fecha_pago}</td>
                      <td className="px-3 py-2">{currency(Number(pago.monto))}</td>
                      <td className="px-3 py-2 text-slate-300">
                        {pago.saldo_posterior !== null ? currency(Number(pago.saldo_posterior)) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h2 className="font-semibold mb-2">Historial de moras</h2>
          {listaMoras.length === 0 ? (
            <p className="text-slate-500 text-sm">Sin moras aplicadas.</p>
          ) : (
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-slate-400 text-left">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Día atraso</th>
                    <th className="px-3 py-2">Monto</th>
                    <th className="px-3 py-2">Saldo después</th>
                  </tr>
                </thead>
                <tbody>
                  {listaMoras.map((mora) => (
                    <tr key={mora.id} className="border-t border-slate-800">
                      <td className="px-3 py-2 text-slate-300">{mora.fecha_generada}</td>
                      <td className="px-3 py-2 text-slate-300">{mora.dia_atraso}</td>
                      <td className="px-3 py-2 text-amber-400">{currency(Number(mora.monto_mora))}</td>
                      <td className="px-3 py-2 text-slate-300">{currency(Number(mora.saldo_posterior))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h2 className="font-semibold mb-2">Calendario de cobro</h2>
          <div className="border border-slate-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left sticky top-0">
                <tr>
                  <th className="px-3 py-2">Día</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Monto esperado</th>
                </tr>
              </thead>
              <tbody>
                {listaCalendario.map((d) => (
                  <tr key={d.id} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-300">{d.numero_dia}</td>
                    <td className="px-3 py-2 text-slate-300">{d.fecha_programada}</td>
                    <td className="px-3 py-2">{currency(Number(d.monto_esperado))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Resumen({ label, value, destacado = false }: { label: string; value: string; destacado?: boolean }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <p className="text-slate-400 text-xs">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${destacado ? "text-emerald-400" : ""}`}>{value}</p>
    </div>
  );
}
