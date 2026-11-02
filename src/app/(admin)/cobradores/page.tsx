import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CobradorConUsuario } from "@/lib/types";
import type { MotivoDescuentoApertura } from "@/lib/finance/calculos";
import { ChevronRight } from "lucide-react";
import { EntrarComoCobradorButton } from "./EntrarComoCobradorButton";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

const ETIQUETA_MOTIVO_DESCUENTO: Record<MotivoDescuentoApertura, string> = {
  cliente_nuevo: "cliente nuevo",
  renovacion_normal: "renovación",
  renovacion_mismo_dia_liquidacion_anticipada: "renovación anticipada el mismo día",
};

function razonDescuentoTexto(t: { descuentoTotal: number; descuentosPorMotivo: Record<MotivoDescuentoApertura, { cantidad: number; monto: number }> }) {
  if (t.descuentoTotal <= 0) return "Sin descuentos de apertura registrados todavía.";
  const partes = (Object.entries(t.descuentosPorMotivo) as [MotivoDescuentoApertura, { cantidad: number; monto: number }][])
    .filter(([, v]) => v.cantidad > 0)
    .map(([motivo, v]) => `${v.cantidad} por ${ETIQUETA_MOTIVO_DESCUENTO[motivo]} (${currency(v.monto)})`);
  return `Se descontaron ${currency(t.descuentoTotal)} en total: ${partes.join(", ")}.`;
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
      supabase
        .from("prestamos")
        .select("cobrador_id, monto_prestado, monto_total, mora_acumulada, estado, descuento_apertura, motivo_descuento_apertura"),
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

  // Totales por cobrador, de TODO su historial (no solo lo activo): cuánto
  // se le ha prestado en capital, cuánto es eso con intereses SIN el
  // descuento de apertura (lo que el cliente habría debido pagar sin
  // descuento), cuánto es ya CON el descuento aplicado (lo que de verdad
  // debía pagar — monto_total ya viene así guardado), cuánto se le
  // descontó en total y por qué motivo, y cuánto llevan de mora pendiente
  // (esta última solo de préstamos todavía activos/en mora, no tiene
  // sentido sumar la de uno ya liquidado).
  //
  // Nota: descuento_apertura/motivo_descuento_apertura solo se guardan
  // estructurados desde nov. 2026 — en préstamos de antes quedan en 0/null,
  // así que para esos "con intereses" (sin descuento) y "con descuento"
  // salen iguales (no se puede reconstruir el descuento real que tuvieron).
  type TotalesCobrador = {
    prestado: number;
    conInteresesSinDescuento: number;
    conDescuento: number;
    descuentoTotal: number;
    descuentosPorMotivo: Record<MotivoDescuentoApertura, { cantidad: number; monto: number }>;
    mora: number;
    recolectado: number;
  };
  const totalesPorCobrador = new Map<string, TotalesCobrador>();
  const obtenerTotales = (cobradorId: string): TotalesCobrador => {
    const existente = totalesPorCobrador.get(cobradorId);
    if (existente) return existente;
    const nuevo: TotalesCobrador = {
      prestado: 0,
      conInteresesSinDescuento: 0,
      conDescuento: 0,
      descuentoTotal: 0,
      descuentosPorMotivo: {
        cliente_nuevo: { cantidad: 0, monto: 0 },
        renovacion_normal: { cantidad: 0, monto: 0 },
        renovacion_mismo_dia_liquidacion_anticipada: { cantidad: 0, monto: 0 },
      },
      mora: 0,
      recolectado: 0,
    };
    totalesPorCobrador.set(cobradorId, nuevo);
    return nuevo;
  };

  for (const p of prestamosData ?? []) {
    if (!p.cobrador_id) continue;
    const t = obtenerTotales(p.cobrador_id);
    const descuento = Number(p.descuento_apertura ?? 0);
    t.prestado += Number(p.monto_prestado);
    t.conDescuento += Number(p.monto_total);
    t.conInteresesSinDescuento += Number(p.monto_total) + descuento;
    t.descuentoTotal += descuento;
    if (p.motivo_descuento_apertura && descuento > 0) {
      const motivo = p.motivo_descuento_apertura as MotivoDescuentoApertura;
      t.descuentosPorMotivo[motivo].cantidad += 1;
      t.descuentosPorMotivo[motivo].monto += descuento;
    }
    if (p.estado === "activo" || p.estado === "en_mora") {
      t.mora += Number(p.mora_acumulada);
    }
  }
  for (const pago of pagosData ?? []) {
    if (!pago.cobrador_id) continue;
    obtenerTotales(pago.cobrador_id).recolectado += Number(pago.monto);
  }

  const cobradoresActivos = cobradores.filter((c) => c.activo).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cobradores</h1>
          <p className="text-ink-muted text-sm mt-1">
            {cobradores.length} registrado{cobradores.length === 1 ? "" : "s"} ({cobradoresActivos} activo
            {cobradoresActivos === 1 ? "" : "s"}). No tienen un máximo real — el storage no les pesa, y el límite de
            usuarios activos del plan gratis de Supabase (50,000 al mes) está muy por arriba de lo que este negocio
            va a necesitar.
          </p>
        </div>
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
                <th className="px-4 py-3" title="Lo que en total debían pagar sus clientes CON intereses, SIN restar ningún descuento de apertura.">
                  Con intereses (sin descuento)
                </th>
                <th className="px-4 py-3" title="Lo que en realidad debían pagar sus clientes: con intereses y ya con el descuento de apertura restado. Pasa el mouse sobre el número de cada fila para ver el por qué del descuento.">
                  Total con descuento
                </th>
                <th className="px-4 py-3">Recolectado</th>
                <th className="px-4 py-3">Mora</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {cobradores.map((c) => {
                const totales =
                  totalesPorCobrador.get(c.id) ??
                  obtenerTotales(c.id);
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
                    <td className="px-4 py-3 text-ink-secondary">{currency(totales.conInteresesSinDescuento)}</td>
                    <td className="px-4 py-3 text-ink-secondary" title={razonDescuentoTexto(totales)}>
                      {currency(totales.conDescuento)}
                    </td>
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
                      <div className="flex items-center gap-2 justify-end">
                        {c.activo && (
                          <EntrarComoCobradorButton
                            cobradorId={c.id}
                            nombreCobrador={c.usuarios?.nombre_completo ?? "este cobrador"}
                          />
                        )}
                        <Link
                          href={`/cobradores/${c.id}`}
                          className="inline-flex items-center text-ink-muted hover:text-ink"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
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
