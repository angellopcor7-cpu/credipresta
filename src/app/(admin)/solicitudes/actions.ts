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
  calcularPorcentajeInteresTotal,
  generarCalendarioPagos,
} from "@/lib/finance/calculos";

/**
 * Aprueba una solicitud que un cliente pidió por su cuenta: crea el
 * préstamo real (con el mismo cálculo automático que `crearPrestamo`, el
 * administrador solo agrega el interés diario porque el cliente no lo
 * captura), genera su calendario de cobro, marca la solicitud como
 * aprobada y activa al cliente.
 */
export async function aprobarSolicitud(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();
  const config = await obtenerConfiguraciones();

  const solicitudId = String(formData.get("solicitud_id") || "");
  const porcentajeInteresDiario = Number(formData.get("porcentaje_interes_diario") || "");

  if (!porcentajeInteresDiario || porcentajeInteresDiario <= 0) {
    redirect(`/solicitudes?error=${encodeURIComponent("El interés diario debe ser mayor a 0")}`);
  }

  const { data: solicitud } = await supabase
    .from("solicitudes_prestamo")
    .select("id, cliente_id, monto_solicitado, plazo_dias, estado")
    .eq("id", solicitudId)
    .single();

  if (!solicitud) {
    redirect(`/solicitudes?error=${encodeURIComponent("Solicitud no encontrada")}`);
  }
  if (solicitud.estado !== "pendiente") {
    redirect(`/solicitudes?error=${encodeURIComponent("Esta solicitud ya fue revisada")}`);
  }

  const montoPrestado = Number(solicitud.monto_solicitado);
  const plazoDias = solicitud.plazo_dias;
  const porcentaje = calcularPorcentajeInteresTotal(porcentajeInteresDiario, plazoDias);
  const montoInteres = calcularInteres(montoPrestado, porcentaje);
  const montoTotal = calcularMontoTotal(montoPrestado, porcentaje);
  const montoCuota = calcularCuotaSugerida(montoTotal, plazoDias);

  const { data: prestamo, error } = await supabase
    .from("prestamos")
    .insert({
      cliente_id: solicitud.cliente_id,
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
    redirect(`/solicitudes?error=${encodeURIComponent(error?.message || "No se pudo crear el préstamo")}`);
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
  await supabase.from("calendario_pagos").insert(filasCalendario);

  await supabase
    .from("solicitudes_prestamo")
    .update({
      estado: "aprobada",
      revisado_por: sesion.id,
      fecha_revision: new Date().toISOString(),
      prestamo_id: prestamo.id,
    })
    .eq("id", solicitudId);

  await supabase.from("clientes").update({ estado: "activo" }).eq("id", solicitud.cliente_id);

  await supabase.from("historial_movimientos").insert({
    prestamo_id: prestamo.id,
    cliente_id: solicitud.cliente_id,
    usuario_id: sesion.id,
    tipo_movimiento: "aprobacion_solicitud",
    monto: montoPrestado,
    descripcion: `Solicitud aprobada: préstamo de $${montoPrestado} creado (total $${montoTotal})`,
  });

  revalidatePath("/solicitudes");
  revalidatePath("/prestamos");
  redirect(`/prestamos/${prestamo.id}`);
}

/** Rechaza una solicitud pendiente, con una nota opcional de por qué. */
export async function rechazarSolicitud(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();

  const solicitudId = String(formData.get("solicitud_id") || "");
  const notas = String(formData.get("notas") || "").trim() || null;

  await supabase
    .from("solicitudes_prestamo")
    .update({
      estado: "rechazada",
      revisado_por: sesion.id,
      fecha_revision: new Date().toISOString(),
      notas_revision: notas,
    })
    .eq("id", solicitudId)
    .eq("estado", "pendiente");

  revalidatePath("/solicitudes");
  redirect("/solicitudes");
}
