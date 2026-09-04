"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirAdministrador } from "@/lib/auth/roles";
import { obtenerConfiguraciones } from "@/lib/config";
import {
  calcularInteres,
  calcularMontoTotal,
  calcularCuotaSugerida,
  calcularPorcentajeInteresPorPlazo,
  calcularSaldo,
  validarMontoPago,
  generarCalendarioPagos,
  PLAZOS_VALIDOS,
} from "@/lib/finance/calculos";

/**
 * Crea un préstamo nuevo: calcula automáticamente el interés (20% por
 * defecto, tomado de `configuraciones`), el total a pagar y la cuota
 * sugerida, y genera el calendario completo de días de cobro según la
 * regla vigente (que depende del monto del préstamo). Nada de esto se le
 * pide al usuario a mano.
 */
export async function crearPrestamo(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();
  const config = await obtenerConfiguraciones();

  const clienteId = String(formData.get("cliente_id") || "");
  const montoPrestado = Number(formData.get("monto_prestado"));
  const plazoDias = Number(formData.get("plazo_dias") || "");
  const cobradorId = String(formData.get("cobrador_id") || "") || null;

  if (!clienteId) {
    redirect(`/prestamos/nuevo?error=${encodeURIComponent("Selecciona un cliente")}`);
  }
  if (!montoPrestado || montoPrestado <= 0) {
    redirect(`/prestamos/nuevo?error=${encodeURIComponent("El monto prestado debe ser mayor a 0")}`);
  }
  if (!PLAZOS_VALIDOS.includes(plazoDias as (typeof PLAZOS_VALIDOS)[number])) {
    redirect(
      `/prestamos/nuevo?error=${encodeURIComponent(`El plazo debe ser de ${PLAZOS_VALIDOS.join(" o ")} días`)}`
    );
  }

  // El interés lo determina el plazo (20 días -> 20%, 30 días -> 30%), no se
  // captura aparte — así lo pidió el negocio.
  const porcentaje = calcularPorcentajeInteresPorPlazo(plazoDias);
  const montoInteres = calcularInteres(montoPrestado, porcentaje);
  const montoTotal = calcularMontoTotal(montoPrestado, porcentaje);
  const montoCuota = calcularCuotaSugerida(montoTotal, plazoDias);

  const { data: prestamo, error } = await supabase
    .from("prestamos")
    .insert({
      cliente_id: clienteId,
      cobrador_id: cobradorId,
      monto_prestado: montoPrestado,
      porcentaje_interes: porcentaje,
      monto_interes: montoInteres,
      monto_total: montoTotal,
      saldo_actual: montoTotal,
      plazo_dias: plazoDias,
      monto_cuota_sugerida: montoCuota,
      estado: "activo",
      creado_por: sesion.id,
    })
    .select("id, fecha_inicio")
    .single();

  if (error || !prestamo) {
    redirect(`/prestamos/nuevo?error=${encodeURIComponent(error?.message || "No se pudo crear el préstamo")}`);
  }

  const calendario = generarCalendarioPagos({
    fechaInicio: new Date(`${prestamo.fecha_inicio}T00:00:00Z`),
    plazoDias,
    montoPrestamo: montoPrestado,
    montoCuota,
    regla: config.reglaDiasCobro,
  });

  const filasCalendario = calendario.map((d) => ({
    prestamo_id: prestamo.id,
    numero_dia: d.numeroDia,
    fecha_programada: d.fechaProgramada,
    monto_esperado: d.montoEsperado,
  }));

  const { error: errorCalendario } = await supabase.from("calendario_pagos").insert(filasCalendario);

  await supabase.from("historial_movimientos").insert({
    prestamo_id: prestamo.id,
    cliente_id: clienteId,
    usuario_id: sesion.id,
    tipo_movimiento: "creacion_prestamo",
    monto: montoPrestado,
    descripcion: errorCalendario
      ? `Préstamo de $${montoPrestado} creado, pero el calendario de pagos falló: ${errorCalendario.message}`
      : `Préstamo de $${montoPrestado} creado (total a pagar $${montoTotal}, ${plazoDias} días)`,
  });

  revalidatePath("/prestamos");
  redirect(`/prestamos/${prestamo.id}`);
}

/**
 * Registra un pago o abono sobre un préstamo existente. Vuelve a calcular
 * el saldo con la misma función pura que usa el resto de la app (para que
 * nunca pueda quedar negativo) y guarda saldo anterior/posterior en el
 * propio registro del pago, como exige el historial de movimientos.
 */
export async function registrarPago(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();

  const prestamoId = String(formData.get("prestamo_id") || "");
  const monto = Number(formData.get("monto"));
  const tipo = String(formData.get("tipo") || "abono_libre");
  const metodo = String(formData.get("metodo") || "") || null;
  const notas = String(formData.get("notas") || "") || null;

  const { data: prestamo } = await supabase
    .from("prestamos")
    .select("id, cliente_id, cobrador_id, saldo_actual, estado")
    .eq("id", prestamoId)
    .single();

  if (!prestamo) {
    redirect(`/prestamos?error=${encodeURIComponent("Préstamo no encontrado")}`);
  }

  if (prestamo.estado === "liquidado" || prestamo.estado === "cancelado") {
    redirect(`/prestamos/${prestamoId}?error=${encodeURIComponent("Este préstamo ya está liquidado o cancelado")}`);
  }

  const saldoActual = Number(prestamo.saldo_actual);
  const validacion = validarMontoPago(monto, saldoActual);
  if (!validacion.valido) {
    redirect(`/prestamos/${prestamoId}?error=${encodeURIComponent(validacion.motivo || "Monto inválido")}`);
  }

  const saldoNuevo = calcularSaldo(saldoActual, [monto]);

  const { error: errorPago } = await supabase.from("pagos").insert({
    prestamo_id: prestamoId,
    cliente_id: prestamo.cliente_id,
    cobrador_id: prestamo.cobrador_id,
    monto,
    tipo,
    registrado_por: sesion.id,
    metodo,
    notas,
    saldo_anterior: saldoActual,
    saldo_posterior: saldoNuevo,
  });

  if (errorPago) {
    redirect(`/prestamos/${prestamoId}?error=${encodeURIComponent(errorPago.message)}`);
  }

  const nuevoEstado = saldoNuevo === 0 ? "liquidado" : prestamo.estado;
  await supabase
    .from("prestamos")
    .update({
      saldo_actual: saldoNuevo,
      estado: nuevoEstado,
      fecha_liquidacion: saldoNuevo === 0 ? new Date().toISOString() : null,
    })
    .eq("id", prestamoId);

  await supabase.from("historial_movimientos").insert({
    prestamo_id: prestamoId,
    cliente_id: prestamo.cliente_id,
    usuario_id: sesion.id,
    tipo_movimiento: "pago",
    monto,
    descripcion: `Pago de $${monto} registrado (saldo: $${saldoActual} → $${saldoNuevo})`,
  });

  revalidatePath(`/prestamos/${prestamoId}`);
  revalidatePath("/prestamos");
  redirect(`/prestamos/${prestamoId}`);
}
