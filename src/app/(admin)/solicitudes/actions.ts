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
 * "Quién aprobó/rechazó" se elige de una lista (no se toma automático de la
 * sesión) porque en este negocio varias personas comparten la misma cuenta
 * de administrador — el nombre elegido aquí es el que va a salir como
 * cobrador en el pagaré. Se valida contra usuarios activos con rol
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
 * Paso 1: el admin fija el interés diario y genera el pagaré. Esto NO crea
 * el préstamo todavía — solo deja la solicitud en "esperando_firma" con el
 * interés ya fijo, para que el cliente pueda entrar a su cuenta, ver el
 * pagaré con esos datos y dibujar su firma.
 */
export async function generarPagareParaFirma(formData: FormData) {
  await exigirAdministrador();
  const supabase = await createClient();

  const solicitudId = String(formData.get("solicitud_id") || "");
  const porcentajeInteresDiario = Number(formData.get("porcentaje_interes_diario") || "");
  const datosTransferencia = String(formData.get("datos_transferencia") || "").trim() || null;

  if (!porcentajeInteresDiario || porcentajeInteresDiario <= 0) {
    redirect(`/solicitudes?error=${encodeURIComponent("El interés diario debe ser mayor a 0")}`);
  }

  const { data: solicitud } = await supabase
    .from("solicitudes_prestamo")
    .select("metodo_pago")
    .eq("id", solicitudId)
    .single();

  if (solicitud && solicitud.metodo_pago !== "efectivo" && !datosTransferencia) {
    redirect(
      `/solicitudes?error=${encodeURIComponent(
        "El cliente eligió transferencia — pon los datos para recibirla antes de generar el pagaré"
      )}`
    );
  }

  const { error } = await supabase
    .from("solicitudes_prestamo")
    .update({
      estado: "esperando_firma",
      porcentaje_interes_diario_propuesto: porcentajeInteresDiario,
      datos_transferencia: datosTransferencia,
    })
    .eq("id", solicitudId)
    .eq("estado", "pendiente");

  if (error) {
    redirect(`/solicitudes?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/solicitudes");
  redirect("/solicitudes");
}

/**
 * Paso 2 (final): una vez que el cliente ya firmó su pagaré (estado
 * "firmada"), el admin da el último click para crear el préstamo real, con
 * el mismo interés que ya se fijó y que el cliente ya vio y firmó — aquí ya
 * no se vuelve a pedir el interés, para que no pueda cambiar después de
 * firmado.
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
    .select(
      "id, cliente_id, monto_solicitado, plazo_dias, estado, porcentaje_interes_diario_propuesto, metodo_pago, datos_transferencia"
    )
    .eq("id", solicitudId)
    .single();

  if (!solicitud) {
    redirect(`/solicitudes?error=${encodeURIComponent("Solicitud no encontrada")}`);
  }
  if (solicitud.estado !== "firmada") {
    redirect(`/solicitudes?error=${encodeURIComponent("El cliente todavía no firma su pagaré")}`);
  }
  if (!solicitud.porcentaje_interes_diario_propuesto) {
    redirect(`/solicitudes?error=${encodeURIComponent("Falta el interés diario de esta solicitud")}`);
  }

  const montoPrestado = Number(solicitud.monto_solicitado);
  const plazoDias = solicitud.plazo_dias;
  const porcentaje = calcularPorcentajeInteresTotal(
    Number(solicitud.porcentaje_interes_diario_propuesto),
    plazoDias
  );
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
      metodo_pago: solicitud.metodo_pago,
      datos_transferencia: solicitud.datos_transferencia,
      // El "cobrador" que se ve en el pagaré sale de este campo, así que va
      // el admin elegido en el formulario (no necesariamente quien tiene la
      // sesión abierta, ya que varios comparten la misma cuenta).
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
    descripcion: `Solicitud aprobada: préstamo de $${montoPrestado} creado (total $${montoTotal})`,
  });

  revalidatePath("/solicitudes");
  revalidatePath("/prestamos");
  redirect(`/prestamos/${prestamo.id}`);
}

/** Rechaza una solicitud en cualquier etapa antes de la aprobación final, con una nota opcional de por qué. */
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
    .in("estado", ["pendiente", "esperando_firma", "firmada"]);

  revalidatePath("/solicitudes");
  redirect("/solicitudes");
}
