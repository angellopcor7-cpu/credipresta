import type { createClient } from "@/lib/supabase/server";
import { calcularDescuentoApertura, type MotivoDescuentoApertura } from "@/lib/finance/calculos";

export type DescuentoAperturaInfo = {
  descuento: number;
  motivo: MotivoDescuentoApertura;
};

/**
 * Decide cuánto descuento de apertura le toca a una solicitud (ver
 * `calcularDescuentoApertura` para las reglas): si el cliente nunca tuvo un
 * préstamo antes, es cliente nuevo ($50). Si ya tiene historial, es una
 * renovación — se revisa su último préstamo liquidado para saber si pidió
 * este préstamo nuevo el MISMO día que liquidó, y si liquidó antes de
 * completar su plazo (saldó antes de llegar al último día del calendario).
 * Ambas condiciones juntas son las que suben el descuento a $150.
 *
 * Se usa tanto para mostrarle la vista previa a Empresa en /solicitudes
 * como, con los mismos datos, dentro de `aprobarSolicitud` al crear el
 * préstamo real — así nunca se puede desincronizar lo que se mostró de lo
 * que de verdad se aplicó.
 */
export async function calcularDescuentoAperturaSolicitud(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: { clienteId: string; fechaSolicitud: string }
): Promise<DescuentoAperturaInfo> {
  const { count: prestamosPrevios } = await supabase
    .from("prestamos")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", params.clienteId);

  if (!prestamosPrevios) {
    return calcularDescuentoApertura({
      esClienteNuevo: true,
      liquidoAntesDeTiempo: false,
      renovacionMismoDiaQueLiquidacion: false,
    });
  }

  const { data: ultimoLiquidado } = await supabase
    .from("prestamos")
    .select("id, fecha_liquidacion")
    .eq("cliente_id", params.clienteId)
    .eq("estado", "liquidado")
    .not("fecha_liquidacion", "is", null)
    .order("fecha_liquidacion", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ultimoLiquidado?.fecha_liquidacion) {
    // Tiene historial pero ninguno quedó "liquidado" con fecha (caso raro:
    // p. ej. le cancelaron el préstamo anterior) — se trata como renovación
    // normal, no hay con qué comparar el "mismo día".
    return calcularDescuentoApertura({
      esClienteNuevo: false,
      liquidoAntesDeTiempo: false,
      renovacionMismoDiaQueLiquidacion: false,
    });
  }

  const { data: ultimoDiaCalendario } = await supabase
    .from("calendario_pagos")
    .select("fecha_programada")
    .eq("prestamo_id", ultimoLiquidado.id)
    .order("fecha_programada", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fechaLiquidacion = ultimoLiquidado.fecha_liquidacion.slice(0, 10);
  const liquidoAntesDeTiempo = !!ultimoDiaCalendario && fechaLiquidacion < ultimoDiaCalendario.fecha_programada;
  const renovacionMismoDiaQueLiquidacion = fechaLiquidacion === params.fechaSolicitud.slice(0, 10);

  return calcularDescuentoApertura({
    esClienteNuevo: false,
    liquidoAntesDeTiempo,
    renovacionMismoDiaQueLiquidacion,
  });
}
