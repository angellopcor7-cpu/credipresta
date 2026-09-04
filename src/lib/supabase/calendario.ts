import type { createClient } from "@/lib/supabase/server";
import type { CalendarioPago } from "@/lib/types";

/**
 * Trae la última fecha programada del calendario de cobro de cada préstamo
 * (su fecha límite real) — no se calcula sumando los días del plazo, porque
 * el calendario salta días que no son de cobro (fines de semana, según la
 * regla por monto), así que la única fuente confiable es lo que ya está
 * guardado en `calendario_pagos`.
 */
export async function obtenerFechaLimitePorPrestamo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  prestamoIds: string[]
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (prestamoIds.length === 0) return mapa;

  const { data } = await supabase
    .from("calendario_pagos")
    .select("prestamo_id, fecha_programada")
    .in("prestamo_id", prestamoIds)
    .order("numero_dia", { ascending: false });

  for (const fila of data ?? []) {
    // Ordenado descendente: la primera fila que vemos de cada préstamo es la última fecha de su calendario.
    if (!mapa.has(fila.prestamo_id)) {
      mapa.set(fila.prestamo_id, fila.fecha_programada);
    }
  }

  return mapa;
}

/**
 * Trae el calendario de cobro completo (todos los días, en orden) de cada
 * préstamo — para mostrarle al cliente sus días de pago sugeridos con el
 * monto mínimo recomendado por día y si ya lo pagó o no.
 */
export async function obtenerCalendarioPorPrestamo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  prestamoIds: string[]
): Promise<Map<string, CalendarioPago[]>> {
  const mapa = new Map<string, CalendarioPago[]>();
  if (prestamoIds.length === 0) return mapa;

  const { data } = await supabase
    .from("calendario_pagos")
    .select("*")
    .in("prestamo_id", prestamoIds)
    .order("numero_dia", { ascending: true });

  for (const fila of (data ?? []) as CalendarioPago[]) {
    const lista = mapa.get(fila.prestamo_id) ?? [];
    lista.push(fila);
    mapa.set(fila.prestamo_id, lista);
  }

  return mapa;
}
