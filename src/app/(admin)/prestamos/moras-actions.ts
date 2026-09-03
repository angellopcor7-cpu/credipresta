"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdministrador } from "@/lib/auth/roles";
import { obtenerConfiguraciones } from "@/lib/config";
import {
  calcularMontoMora,
  calcularSaldoConMora,
  tieneCuotaVencidaSinPagar,
  type ReglaMora,
} from "@/lib/finance/calculos";

export type ResultadoMora = {
  prestamoId: string;
  aplicada: boolean;
  motivo?: string;
  montoMora?: number;
};

/**
 * Aplica la mora del día a UN préstamo, si le corresponde. No aplica si:
 * - el préstamo ya está liquidado o cancelado,
 * - no tiene ninguna cuota vencida sin pagar,
 * - ya se le generó una mora hoy (la tabla `moras` además lo bloquea con
 *   una restricción única, esto es solo para dar un mensaje claro antes).
 *
 * Si aplica, inserta el registro en `moras` con los 7 datos exigidos por el
 * negocio (fecha, monto, día de atraso, saldo anterior, saldo nuevo,
 * usuario, préstamo) y suma la mora al saldo del préstamo.
 */
async function aplicarMoraAUnPrestamo(
  prestamoId: string,
  hoy: string,
  usuarioId: string,
  reglaMora: ReglaMora
): Promise<ResultadoMora> {
  const supabase = await createClient();

  const { data: prestamo } = await supabase
    .from("prestamos")
    .select("id, saldo_actual, estado")
    .eq("id", prestamoId)
    .single();

  if (!prestamo) return { prestamoId, aplicada: false, motivo: "Préstamo no encontrado" };
  if (prestamo.estado === "liquidado" || prestamo.estado === "cancelado") {
    return { prestamoId, aplicada: false, motivo: "El préstamo ya está liquidado o cancelado" };
  }

  const { data: calendario } = await supabase
    .from("calendario_pagos")
    .select("fecha_programada, estado")
    .eq("prestamo_id", prestamoId);

  const enAtraso = tieneCuotaVencidaSinPagar(
    (calendario ?? []).map((dia) => ({
      fechaProgramada: dia.fecha_programada,
      estado: dia.estado as "pendiente" | "pagado" | "parcial" | "no_aplica",
    })),
    hoy
  );
  if (!enAtraso) return { prestamoId, aplicada: false, motivo: "No tiene cuotas vencidas" };

  const { count: moraHoy } = await supabase
    .from("moras")
    .select("id", { count: "exact", head: true })
    .eq("prestamo_id", prestamoId)
    .eq("fecha_generada", hoy);
  if (moraHoy) return { prestamoId, aplicada: false, motivo: "Ya se aplicó la mora de hoy" };

  const { count: morasPrevias } = await supabase
    .from("moras")
    .select("id", { count: "exact", head: true })
    .eq("prestamo_id", prestamoId);

  const saldoActual = Number(prestamo.saldo_actual);
  const diaAtraso = (morasPrevias ?? 0) + 1;
  const montoMora = calcularMontoMora(saldoActual, reglaMora);
  const saldoNuevo = calcularSaldoConMora(saldoActual, montoMora);

  const { error: errorMora } = await supabase.from("moras").insert({
    prestamo_id: prestamoId,
    monto_mora: montoMora,
    dia_atraso: diaAtraso,
    saldo_anterior: saldoActual,
    saldo_posterior: saldoNuevo,
    fecha_generada: hoy,
    generada_por: usuarioId,
  });
  if (errorMora) return { prestamoId, aplicada: false, motivo: errorMora.message };

  await supabase.from("prestamos").update({ saldo_actual: saldoNuevo, estado: "en_mora" }).eq("id", prestamoId);

  await supabase.from("historial_movimientos").insert({
    prestamo_id: prestamoId,
    usuario_id: usuarioId,
    tipo_movimiento: "mora",
    monto: montoMora,
    descripcion: `Mora día ${diaAtraso} aplicada: $${montoMora} (saldo $${saldoActual} → $${saldoNuevo})`,
  });

  return { prestamoId, aplicada: true, montoMora };
}

/** Botón "Aplicar mora" de un préstamo individual, en su página de detalle. */
export async function aplicarMoraDeHoy(prestamoId: string): Promise<ResultadoMora> {
  const sesion = await exigirAdministrador();
  const config = await obtenerConfiguraciones();
  const hoy = new Date().toISOString().slice(0, 10);

  const resultado = await aplicarMoraAUnPrestamo(prestamoId, hoy, sesion.id, config.reglaMora);

  revalidatePath(`/prestamos/${prestamoId}`);
  revalidatePath("/prestamos");
  revalidatePath("/dashboard");
  return resultado;
}

/** Revisa TODOS los préstamos activos/en mora y aplica la mora del día a los que tengan cuotas vencidas. */
export async function aplicarMorasDelDia(): Promise<ResultadoMora[]> {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();
  const config = await obtenerConfiguraciones();
  const hoy = new Date().toISOString().slice(0, 10);

  const { data: prestamos } = await supabase.from("prestamos").select("id").in("estado", ["activo", "en_mora"]);

  const resultados: ResultadoMora[] = [];
  for (const prestamo of prestamos ?? []) {
    resultados.push(await aplicarMoraAUnPrestamo(prestamo.id, hoy, sesion.id, config.reglaMora));
  }

  revalidatePath("/prestamos");
  revalidatePath("/dashboard");
  return resultados;
}
