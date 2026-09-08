"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirAdministrador } from "@/lib/auth/roles";
import { obtenerConfiguraciones } from "@/lib/config";
import {
  calcularPorcentajeInteresPorPlan,
  calcularInteres,
  calcularMontoTotal,
  calcularCuotaSugerida,
  generarCalendarioPagos,
  esPlanValido,
} from "@/lib/finance/calculos";

/**
 * "Quién aprobó/rechazó" se elige de una lista (no se toma automático de la
 * sesión) porque en este negocio varias personas comparten la misma cuenta
 * de administrador — el nombre elegido aquí es el que queda registrado como
 * quien revisó la solicitud. Se valida contra usuarios activos con rol
 * administrador para que no se pueda mandar cualquier id desde el formulario.
 */
async function validarAdministradorSeleccionado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  usuarioId: string
) {
  if (!usuarioId) return null;
  const { data } = await supabase
    .from("usuarios")
    .select("id, roles!inner(nombre)")
    .eq("id", usuarioId)
    .eq("activo", true)
    .eq("roles.nombre", "administrador")
    .maybeSingle();
  return data ? usuarioId : null;
}

/**
 * Aprueba una solicitud que armó un cobrador (datos del cliente + INE + foto
 * del pagaré ya firmado a mano + plan de 20 o 30 días). El interés total ya
 * viene fijo por el plan, así que aquí no se vuelve a pedir nada: un solo
 * click crea el préstamo, su calendario de cobro (respetando los días
 * personalizados que haya elegido el cobrador) y activa al cliente.
 */
export async function aprobarSolicitud(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();
  const config = await obtenerConfiguraciones();

  const solicitudId = String(formData.get("solicitud_id") || "");
  const revisadoPorSeleccionado = await validarAdministradorSeleccionado(
    supabase,
    String(formData.get("revisado_por") || "")
  );

  if (!revisadoPorSeleccionado) {
    redirect(`/solicitudes?error=${encodeURIComponent("Selecciona quién aprueba esta solicitud")}`);
  }

  const { data: solicitud } = await supabase
    .from("solicitudes_prestamo")
    .select("id, cliente_id, monto_solicitado, plazo_dias, estado, metodo_pago, datos_transferencia, dias_cobro_personalizados")
    .eq("id", solicitudId)
    .single();

  if (!solicitud) {
    redirect(`/solicitudes?error=${encodeURIComponent("Solicitud no encontrada")}`);
  }
  if (solicitud.estado !== "pendiente") {
    redirect(`/solicitudes?error=${encodeURIComponent("Esta solicitud ya fue revisada")}`);
  }
  if (!esPlanValido(solicitud.plazo_dias)) {
    redirect(`/solicitudes?error=${encodeURIComponent("Plan inválido: debe ser 20 o 30 días")}`);
  }

  const { data: cliente } = await supabase.from("clientes").select("cobrador_id").eq("id", solicitud.cliente_id).single();

  const montoPrestado = Number(solicitud.monto_solicitado);
  const plazoDias = solicitud.plazo_dias;
  const porcentaje = calcularPorcentajeInteresPorPlan(plazoDias as 20 | 30);
  const montoInteres = calcularInteres(montoPrestado, porcentaje);
  const montoTotal = calcularMontoTotal(montoPrestado, porcentaje);
  const montoCuota = calcularCuotaSugerida(montoTotal, plazoDias);

  const { data: prestamo, error } = await supabase
    .from("prestamos")
    .insert({
      cliente_id: solicitud.cliente_id,
      cobrador_id: cliente?.cobrador_id ?? null,
      monto_prestado: montoPrestado,
      porcentaje_interes: porcentaje,
      monto_interes: montoInteres,
      monto_total: montoTotal,
      saldo_actual: montoTotal,
      plazo_dias: plazoDias,
      monto_cuota_sugerida: montoCuota,
      estado: "activo",
      metodo_pago: solicitud.metodo_pago,
      datos_transferencia: solicitud.datos_transferencia,
      dias_cobro_personalizados: solicitud.dias_cobro_personalizados,
      creado_por: revisadoPorSeleccionado,
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
    diasPersonalizados: solicitud.dias_cobro_personalizados,
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
      revisado_por: revisadoPorSeleccionado,
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
    descripcion: `Solicitud aprobada: préstamo de $${montoPrestado} creado (total $${montoTotal}, plan ${plazoDias} días)`,
  });

  revalidatePath("/solicitudes");
  revalidatePath("/prestamos");
  redirect(`/prestamos/${prestamo.id}`);
}

/** Rechaza una solicitud pendiente, con una nota opcional de por qué. */
export async function rechazarSolicitud(formData: FormData) {
  await exigirAdministrador();
  const supabase = await createClient();

  const solicitudId = String(formData.get("solicitud_id") || "");
  const notas = String(formData.get("notas") || "").trim() || null;
  const revisadoPorSeleccionado = await validarAdministradorSeleccionado(
    supabase,
    String(formData.get("revisado_por") || "")
  );

  if (!revisadoPorSeleccionado) {
    redirect(`/solicitudes?error=${encodeURIComponent("Selecciona quién rechaza esta solicitud")}`);
  }

  await supabase
    .from("solicitudes_prestamo")
    .update({
      estado: "rechazada",
      revisado_por: revisadoPorSeleccionado,
      fecha_revision: new Date().toISOString(),
      notas_revision: notas,
    })
    .eq("id", solicitudId)
    .eq("estado", "pendiente");

  revalidatePath("/solicitudes");
  redirect("/solicitudes");
}
