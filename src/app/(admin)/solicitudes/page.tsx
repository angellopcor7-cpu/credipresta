import { createClient } from "@/lib/supabase/server";
import type { SolicitudConCliente } from "@/lib/types";
import { aprobarSolicitud, rechazarSolicitud } from "./actions";

const INTERES_DIARIO_POR_DEFECTO = 1;

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: pendientes }, { data: revisadas }] = await Promise.all([
    supabase
      .from("solicitudes_prestamo")
      .select("*, clientes(nombre_completo, telefono)")
      .eq("estado", "pendiente")
      .order("fecha_solicitud", { ascending: true }),
    supabase
      .from("solicitudes_prestamo")
      .select("*, clientes(nombre_completo, telefono)")
      .neq("estado", "pendiente")
      .order("fecha_revision", { ascending: false })
      .limit(20),
  ]);

  const listaPendientes = (pendientes ?? []) as unknown as SolicitudConCliente[];
  const listaRevisadas = (revisadas ?? []) as unknown as SolicitudConCliente[];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Solicitudes de préstamo</h1>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">{error}</p>
      )}

      <div>
        <h2 className="font-semibold mb-2">Pendientes de revisión ({listaPendientes.length})</h2>
        {listaPendientes.length === 0 ? (
          <p className="text-slate-500 text-sm">No hay solicitudes pendientes.</p>
        ) : (
          <div className="space-y-3">
            {listaPendientes.map((s) => (
              <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{s.clientes?.nombre_completo ?? "—"}</p>
                    <p className="text-slate-500 text-xs">{s.clientes?.telefono ?? "Sin teléfono"}</p>
                  </div>
                  <p className="text-emerald-400 font-semibold">
                    {currency(Number(s.monto_solicitado))} a {s.plazo_dias} días
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <form action={aprobarSolicitud} className="flex items-center gap-2">
                    <input type="hidden" name="solicitud_id" value={s.id} />
                    <label className="text-xs text-slate-400" htmlFor={`interes-${s.id}`}>
                      Interés diario (%)
                    </label>
                    <input
                      id={`interes-${s.id}`}
                      name="porcentaje_interes_diario"
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={INTERES_DIARIO_POR_DEFECTO}
                      required
                      className="w-20 rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm px-3 py-1.5 rounded-md">
                      Aprobar
                    </button>
                  </form>

                  <form action={rechazarSolicitud} className="flex items-center gap-2">
                    <input type="hidden" name="solicitud_id" value={s.id} />
                    <input
                      name="notas"
                      placeholder="Motivo (opcional)"
                      className="w-40 rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <button className="bg-red-500/90 hover:bg-red-500 text-white font-semibold text-sm px-3 py-1.5 rounded-md">
                      Rechazar
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-semibold mb-2">Revisadas recientemente</h2>
        {listaRevisadas.length === 0 ? (
          <p className="text-slate-500 text-sm">Todavía no has revisado ninguna.</p>
        ) : (
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left">
                <tr>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Monto</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {listaRevisadas.map((s) => (
                  <tr key={s.id} className="border-t border-slate-800">
                    <td className="px-3 py-2">{s.clientes?.nombre_completo ?? "—"}</td>
                    <td className="px-3 py-2">{currency(Number(s.monto_solicitado))}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs border rounded-full px-2 py-1 ${
                          s.estado === "aprobada"
                            ? "bg-emerald-950 text-emerald-400 border-emerald-900"
                            : "bg-red-950 text-red-400 border-red-900"
                        }`}
                      >
                        {s.estado === "aprobada" ? "Aprobada" : "Rechazada"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
