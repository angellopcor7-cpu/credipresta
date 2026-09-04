import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { exigirCliente } from "@/lib/auth/roles";
import { formatoFechaCorta } from "@/lib/format";
import { obtenerCalendarioPorPrestamo } from "@/lib/supabase/calendario";
import { obtenerConfiguraciones } from "@/lib/config";
import { InfoDiasCobro } from "@/components/InfoDiasCobro";
import type { MetodoPago, Prestamo, SolicitudPrestamo } from "@/lib/types";

const ETIQUETAS_METODO_PAGO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  ambos: "Efectivo o transferencia",
};

const estadoDiaLabel: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente", clase: "bg-amber-950 text-amber-400 border-amber-900" },
  parcial: { texto: "Parcial", clase: "bg-sky-950 text-sky-400 border-sky-900" },
  pagado: { texto: "Pagado", clase: "bg-emerald-950 text-emerald-400 border-emerald-900" },
  no_aplica: { texto: "No aplica", clase: "bg-slate-800 text-slate-400 border-slate-700" },
};

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

const estadoPrestamoLabel: Record<string, string> = {
  activo: "Activo",
  en_mora: "En mora",
  liquidado: "Liquidado",
  cancelado: "Cancelado",
};

const estadoSolicitudLabel: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente de revisión", clase: "bg-amber-950 text-amber-400 border-amber-900" },
  esperando_firma: { texto: "Falta que firmes tu pagaré", clase: "bg-amber-950 text-amber-400 border-amber-900" },
  firmada: { texto: "Firmada, esperando aprobación", clase: "bg-sky-950 text-sky-400 border-sky-900" },
  aprobada: { texto: "Aprobada", clase: "bg-emerald-950 text-emerald-400 border-emerald-900" },
  rechazada: { texto: "Rechazada", clase: "bg-red-950 text-red-400 border-red-900" },
};

export default async function ClientePage({
  searchParams,
}: {
  searchParams: Promise<{ exito?: string; error?: string }>;
}) {
  const { exito, error } = await searchParams;
  const sesion = await exigirCliente();
  const supabase = await createClient();

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, estado")
    .eq("usuario_id", sesion.id)
    .maybeSingle();

  const [{ data: prestamos }, { data: solicitudes }] = await Promise.all([
    cliente
      ? supabase.from("prestamos").select("*").eq("cliente_id", cliente.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Prestamo[] }),
    cliente
      ? supabase
          .from("solicitudes_prestamo")
          .select("*")
          .eq("cliente_id", cliente.id)
          .order("fecha_solicitud", { ascending: false })
      : Promise.resolve({ data: [] as SolicitudPrestamo[] }),
  ]);

  const listaPrestamos = (prestamos ?? []) as Prestamo[];
  const listaSolicitudes = (solicitudes ?? []) as SolicitudPrestamo[];
  const tieneSolicitudPendiente = listaSolicitudes.some((s) =>
    ["pendiente", "esperando_firma", "firmada"].includes(s.estado)
  );
  const calendarioPorPrestamo = await obtenerCalendarioPorPrestamo(
    supabase,
    listaPrestamos.map((p) => p.id)
  );
  const config = await obtenerConfiguraciones();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hola, {sesion.nombreCompleto || "cliente"}</h1>
        {!tieneSolicitudPendiente && (
          <Link
            href="/cliente/solicitar"
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm px-4 py-2 rounded-md"
          >
            Pedir un préstamo
          </Link>
        )}
      </div>

      {exito && (
        <p className="text-sm text-emerald-400 bg-emerald-950/50 border border-emerald-900 rounded-md px-3 py-2">
          {exito}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">{error}</p>
      )}

      <div>
        <h2 className="font-semibold mb-2">Mis solicitudes</h2>
        {listaSolicitudes.length === 0 ? (
          <p className="text-slate-500 text-sm">Todavía no has pedido ningún préstamo.</p>
        ) : (
          <div className="space-y-2">
            {listaSolicitudes.map((s) => {
              const estado = estadoSolicitudLabel[s.estado];
              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4"
                >
                  <div>
                    <p className="font-medium">
                      {currency(Number(s.monto_solicitado))} a {s.plazo_dias} días
                    </p>
                    <p className="text-slate-500 text-xs">
                      Pedido el {new Date(s.fecha_solicitud).toLocaleDateString("es-MX")} · Pago:{" "}
                      {ETIQUETAS_METODO_PAGO[s.metodo_pago]}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs border rounded-full px-2 py-1 ${estado.clase}`}>{estado.texto}</span>
                    {s.estado === "esperando_firma" && (
                      <Link
                        href={`/cliente/solicitudes/${s.id}/firmar`}
                        className="text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-md px-3 py-1.5"
                      >
                        Firmar pagaré
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">Mis préstamos</h2>
        {listaPrestamos.length > 0 && (
          <InfoDiasCobro
            umbral={config.umbralMora}
            diasMenorUmbral={config.diasCobroMenorUmbral}
            diasMayorIgualUmbral={config.diasCobroMayorIgualUmbral}
          />
        )}
        {listaPrestamos.length === 0 ? (
          <p className="text-slate-500 text-sm">Todavía no tienes ningún préstamo activo.</p>
        ) : (
          <div className="space-y-3">
            {listaPrestamos.map((p) => {
              const diasCalendario = calendarioPorPrestamo.get(p.id) ?? [];
              const fechaLimite = diasCalendario.at(-1)?.fecha_programada;
              return (
                <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs border border-slate-700 rounded-full px-2 py-1 text-slate-300">
                      {estadoPrestamoLabel[p.estado] ?? p.estado}
                    </span>
                    <p className="text-emerald-400 font-semibold">{currency(Number(p.saldo_actual))} de saldo</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs">Total a pagar</p>
                      <p className="font-medium">{currency(Number(p.monto_total))}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Pago diario</p>
                      <p className="font-medium">{currency(Number(p.monto_cuota_sugerida))}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Inicio</p>
                      <p className="font-medium">{formatoFechaCorta(p.fecha_inicio)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Fecha límite</p>
                      <p className="font-medium">{formatoFechaCorta(fechaLimite)}</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    Método de pago: <span className="text-slate-200">{ETIQUETAS_METODO_PAGO[p.metodo_pago]}</span>
                  </p>
                  {p.datos_transferencia && (
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm">
                      <p className="text-slate-500 text-xs mb-1">Datos para tu transferencia</p>
                      <p className="text-slate-200 whitespace-pre-line">{p.datos_transferencia}</p>
                    </div>
                  )}

                  {diasCalendario.length > 0 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-emerald-400 hover:text-emerald-300 font-medium">
                        Ver mis días de pago (recomendado)
                      </summary>
                      <div className="mt-3 border border-slate-800 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-950 text-slate-400 text-left sticky top-0">
                            <tr>
                              <th className="px-3 py-2">Día</th>
                              <th className="px-3 py-2">Fecha</th>
                              <th className="px-3 py-2">Pago mínimo sugerido</th>
                              <th className="px-3 py-2">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {diasCalendario.map((d) => {
                              const estadoDia = estadoDiaLabel[d.estado] ?? estadoDiaLabel.pendiente;
                              return (
                                <tr key={d.id} className="border-t border-slate-800">
                                  <td className="px-3 py-2 text-slate-300">{d.numero_dia}</td>
                                  <td className="px-3 py-2 text-slate-300">{formatoFechaCorta(d.fecha_programada)}</td>
                                  <td className="px-3 py-2">{currency(Number(d.monto_esperado))}</td>
                                  <td className="px-3 py-2">
                                    <span className={`text-xs border rounded-full px-2 py-1 ${estadoDia.clase}`}>
                                      {estadoDia.texto}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Estos montos son una recomendación de cuánto pagar cada día para terminar a tiempo — puedes
                        abonar más o menos, lo importante es el saldo total.
                      </p>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
