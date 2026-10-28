import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CobradorConUsuario } from "@/lib/types";
import { ChevronRight } from "lucide-react";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

export default async function CobradoresPage() {
  const supabase = await createClient();

  const [{ data }, { data: clientesActivos }, { data: rutasData }, { data: prestamosData }, { data: pagosData }] =
    await Promise.all([
      supabase
        .from("cobradores")
        .select("*, usuarios(nombre_completo, telefono)")
        .order("fecha_ingreso", { ascending: false }),
      supabase.from("clientes").select("cobrador_id").eq("estado", "activo"),
      supabase.from("rutas").select("nombre, cobrador_id").eq("activa", true),
      supabase.from("prestamos").select("cobrador_id, monto_prestado, monto_total, mora_acumulada, estado"),
      supabase.from("pagos").select("cobrador_id, monto"),
    ]);

  const cobradores = (data ?? []) as unknown as CobradorConUsuario[];

  const conteoClientes = new Map<string, number>();
  for (const c of clientesActivos ?? []) {
    if (!c.cobrador_id) continue;
    conteoClientes.set(c.cobrador_id, (conteoClientes.get(c.cobrador_id) ?? 0) + 1);
  }

  const rutasPorCobrador = new Map<string, string[]>();
  for (const r of rutasData ?? []) {
    if (!r.cobrador_id) continue;
    const lista = rutasPorCobrador.get(r.cobrador_id) ?? [];
    lista.push(r.nombre);
    rutasPorCobrador.set(r.cobrador_id, lista);
  }

  // Totales por cobrador, de TODO su historial (no solo lo activo):
  // cuánto se le ha prestado en capital, cuánto es eso ya con intereses
  // (lo que en total debían pagar sus clientes), y cuánto llevan de mora
  // pendiente (esta última solo de préstamos todavía activos/en mora, no
  // tiene sentido sumar la de uno ya liquidado).
  type TotalesCobrador = { prestado: number; conIntereses: number; mora: number; recolectado: number };
  const totalesPorCobrador = new Map<string, TotalesCobrador>();
  const obtenerTotales = (cobradorId: string): TotalesCobrador => {
    const existente = totalesPorCobrador.get(cobradorId);
    if (existente) return existente;
    const nuevo = { prestado: 0, conIntereses: 0, mora: 0, recolectado: 0 };
    totalesPorCobrador.set(cobradorId, nuevo);
    return nuevo;
  };

  for (const p of prestamosData ?? []) {
    if (!p.cobrador_id) continue;
    const t = obtenerTotales(p.cobrador_id);
    t.prestado += Number(p.monto_prestado);
    t.conIntereses += Number(p.monto_total);
    if (p.estado === "activo" || p.estado === "en_mora") {
      t.mora += Number(p.mora_acumulada);
    }
  }
  for (const pago of pagosData ?? []) {
    if (!pago.cobrador_id) continue;
    obtenerTotales(pago.cobrador_id).recolectado += Number(pago.monto);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cobradores</h1>
        <Link
          href="/cobradores/nuevo"
          className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm px-4 py-2 rounded-md"
        >
          + Nuevo cobrador
        </Link>
      </div>

      {cobradores.length === 0 ? (
        <p className="text-ink-muted text-sm">Aún no hay cobradores registrados.</p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface text-ink-muted text-left">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Ruta</th>
                <th className="px-4 py-3">Clientes activos</th>
                <th className="px-4 py-3">Prestado</th>
                <th className="px-4 py-3">Con intereses</th>
                <th className="px-4 py-3">Recolectado</th>
                <th className="px-4 py-3">Mora</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {cobradores.map((c) => {
                const totales = totalesPorCobrador.get(c.id) ?? { prestado: 0, conIntereses: 0, mora: 0, recolectado: 0 };
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <Link href={`/cobradores/${c.id}`} className="font-medium hover:text-accent-text hover:underline">
                        {c.usuarios?.nombre_completo ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">{c.usuarios?.telefono ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-secondary">
                      {(rutasPorCobrador.get(c.id) ?? []).join(", ") || "Sin ruta asignada"}
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">{conteoClientes.get(c.id) ?? 0}</td>
                    <td className="px-4 py-3 text-ink-secondary">{currency(totales.prestado)}</td>
                    <td className="px-4 py-3 text-ink-secondary">{currency(totales.conIntereses)}</td>
                    <td className="px-4 py-3 text-accent-text">{currency(totales.recolectado)}</td>
                    <td className={`px-4 py-3 ${totales.mora > 0 ? "text-danger-text font-medium" : "text-ink-muted"}`}>
                      {currency(totales.mora)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs border rounded-full px-2 py-1 ${
                          c.activo
                            ? "bg-surface-2 text-ink-strong border-border-soft"
                            : "bg-surface-2 text-ink-muted border-border-strong"
                        }`}
                      >
                        {c.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/cobradores/${c.id}`}
                        className="inline-flex items-center text-ink-muted hover:text-ink"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
