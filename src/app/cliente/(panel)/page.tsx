import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { exigirCliente } from "@/lib/auth/roles";
import { formatoFechaCorta } from "@/lib/format";
import { obtenerFechaLimitePorPrestamo } from "@/lib/supabase/calendario";
import { obtenerConfiguraciones } from "@/lib/config";
import { InfoDiasCobro } from "@/components/InfoDiasCobro";
import type { Prestamo, SolicitudPrestamo } from "@/lib/types";

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
  const tieneSolicitudPendiente = listaSolicitudes.some((s) => s.estado === "pendiente");
  const fechaLimitePorPrestamo = await obtenerFechaLimitePorPrestamo(
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
                  className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-4"
                >
                  <div>
                    <p className="font-medium">
                      {currency(Number(s.monto_solicitado))} a {s.plazo_dias} días
                    </p>
                    <p className="text-slate-500 text-xs">
                      Pedido el {new Date(s.fecha_solicitud).toLocaleDateString("es-MX")}
                    </p>
                  </div>
                  <span className={`text-xs border rounded-full px-2 py-1 ${estado.clase}`}>{estado.texto}</span>
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
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left">
                <tr>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Total a pagar</th>
                  <th className="px-3 py-2">Saldo actual</th>
                  <th className="px-3 py-2">Pago diario</th>
                  <th className="px-3 py-2">Inicio</th>
                  <th className="px-3 py-2">Fecha límite</th>
                </tr>
              </thead>
              <tbody>
                {listaPrestamos.map((p) => (
                  <tr key={p.id} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-300">{estadoPrestamoLabel[p.estado] ?? p.estado}</td>
                    <td className="px-3 py-2">{currency(Number(p.monto_total))}</td>
                    <td className="px-3 py-2 text-emerald-400">{currency(Number(p.saldo_actual))}</td>
                    <td className="px-3 py-2 text-slate-300">{currency(Number(p.monto_cuota_sugerida))}</td>
                    <td className="px-3 py-2 text-slate-400">{formatoFechaCorta(p.fecha_inicio)}</td>
                    <td className="px-3 py-2 text-slate-400">
                      {formatoFechaCorta(fechaLimitePorPrestamo.get(p.id))}
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
