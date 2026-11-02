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
  generarCalendarioPagos,
  aplicarDescuentoApertura,
  aplicarPagoVariosDias,
  calcularAsignacionPago,
  type MotivoDescuentoApertura,
} from "@/lib/finance/calculos";
import { calcularDescuentoAperturaSolicitud } from "./descuentoApertura";
import { enviarPushAUsuario } from "@/lib/push/enviar";

/** Lee el nombre del cliente de una relación embebida de Supabase, que según
 * la consulta puede llegar como objeto único o como arreglo de un elemento. */
function nombreClienteEmbebido(c: unknown): string | null {
  if (!c) return null;
  if (Array.isArray(c)) return (c[0] as { nombre_completo?: string | null } | undefined)?.nombre_completo ?? null;
  return (c as { nombre_completo?: string | null }).nombre_completo ?? null;
}

/**
 * Aprueba una solicitud que armó un cobrador (datos del cliente + INE + foto
 * del pagaré ya firmado a mano + plan de 20/30 días o uno personalizado). El
 * % de interés total viene precargado en el formulario (el fijo del plan, o
 * el propuesto por el cobrador), pero Empresa lo puede cambiar ahí mismo
 * antes de aprobar — el que llega en "porcentaje_interes" es el que manda.
 * Un solo click crea el préstamo, su calendario de cobro (respetando los
 * días personalizados que haya elegido el cobrador) y activa al cliente.
 */
export async function aprobarSolicitud(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();
  const config = await obtenerConfiguraciones();

  const solicitudId = String(formData.get("solicitud_id") || "");
  const porcentaje = Number(formData.get("porcentaje_interes"));

  if (!porcentaje || porcentaje <= 0) {
    redirect(`/solicitudes?error=${encodeURIComponent("El % de interés debe ser mayor a 0")}`);
  }

  const { data: solicitud } = await supabase
    .from("solicitudes_prestamo")
    .select(
      "id, cliente_id, monto_solicitado, plazo_dias, estado, metodo_pago, datos_transferencia, dias_cobro_personalizados, fecha_solicitud"
    )
    .eq("id", solicitudId)
    .single();

  if (!solicitud) {
    redirect(`/solicitudes?error=${encodeURIComponent("Solicitud no encontrada")}`);
  }
  if (solicitud.estado !== "pendiente") {
    redirect(`/solicitudes?error=${encodeURIComponent("Esta solicitud ya fue revisada")}`);
  }
  if (!solicitud.plazo_dias || solicitud.plazo_dias <= 0) {
    redirect(`/solicitudes?error=${encodeURIComponent("El plazo en días debe ser mayor a 0")}`);
  }

  const { data: cliente } = await supabase
    .from("clientes")
    .select("cobrador_id, creado_por, nombre_completo")
    .eq("id", solicitud.cliente_id)
    .single();

  const montoPrestado = Number(solicitud.monto_solicitado);
  const plazoDias = solicitud.plazo_dias;
  const montoInteres = calcularInteres(montoPrestado, porcentaje);
  const montoTotalSinDescuento = calcularMontoTotal(montoPrestado, porcentaje);

  // Descuento fijo de apertura ($50 cliente nuevo/renovación normal, $150 si
  // liquidó antes de tiempo y renueva el mismo día) — el cliente recibe el
  // monto completo que pidió, pero el total que debe pagar baja por este
  // descuento. Se calcula con los mismos datos que ya se le mostraron a
  // Empresa en /solicitudes antes de aprobar.
  const { descuento: descuentoApertura, motivo: motivoDescuento } = await calcularDescuentoAperturaSolicitud(supabase, {
    clienteId: solicitud.cliente_id,
    fechaSolicitud: solicitud.fecha_solicitud,
  });
  const montoTotal = aplicarDescuentoApertura(montoTotalSinDescuento, descuentoApertura);
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
      revisado_por: sesion.id,
      fecha_revision: new Date().toISOString(),
      prestamo_id: prestamo.id,
    })
    .eq("id", solicitudId);

  await supabase.from("clientes").update({ estado: "activo" }).eq("id", solicitud.cliente_id);

  const etiquetaMotivoDescuento: Record<MotivoDescuentoApertura, string> = {
    cliente_nuevo: "cliente nuevo",
    renovacion_normal: "renovación",
    renovacion_mismo_dia_liquidacion_anticipada: "renovación el mismo día de una liquidación anticipada",
  };

  await supabase.from("historial_movimientos").insert({
    prestamo_id: prestamo.id,
    cliente_id: solicitud.cliente_id,
    usuario_id: sesion.id,
    tipo_movimiento: "aprobacion_solicitud",
    monto: montoPrestado,
    descripcion: `Solicitud aprobada: préstamo de $${montoPrestado} creado (total $${montoTotal} ya con descuento de apertura de $${descuentoApertura} por ${etiquetaMotivoDescuento[motivoDescuento]}, plan ${plazoDias} días)`,
  });

  if (cliente?.creado_por) {
    await enviarPushAUsuario(cliente.creado_por, {
      title: "Préstamo aprobado",
      body: `${cliente.nombre_completo ?? "Tu cliente"}: préstamo de $${montoPrestado} aprobado`,
      url: `/panel/clientes/${solicitud.cliente_id}`,
    });
  }

  revalidatePath("/solicitudes");
  revalidatePath("/prestamos");
  redirect(`/prestamos/${prestamo.id}`);
}

/**
 * Rechaza una solicitud pendiente, con una nota opcional de por qué.
 * También pasa al cliente a "inactivo": si no se hiciera, el cliente se
 * quedaba para siempre como "pendiente de aprobación" en el panel del
 * cobrador aunque Empresa ya la hubiera rechazado, porque ese estado vive
 * en la tabla `clientes` y solo `aprobarSolicitud` lo actualizaba.
 */
export async function rechazarSolicitud(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();

  const solicitudId = String(formData.get("solicitud_id") || "");
  const notas = String(formData.get("notas") || "").trim() || null;

  const { data: solicitud } = await supabase
    .from("solicitudes_prestamo")
    .select("id, cliente_id, estado, monto_solicitado")
    .eq("id", solicitudId)
    .single();

  if (!solicitud) {
    redirect(`/solicitudes?error=${encodeURIComponent("Solicitud no encontrada")}`);
  }
  if (solicitud.estado !== "pendiente") {
    redirect(`/solicitudes?error=${encodeURIComponent("Esta solicitud ya fue revisada")}`);
  }

  const { data: cliente } = await supabase
    .from("clientes")
    .select("creado_por, nombre_completo")
    .eq("id", solicitud.cliente_id)
    .single();

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

  // Solo se pasa el cliente a "inactivo" si esta era su PRIMERA solicitud
  // (nunca tuvo un préstamo real) — así es como "Nuevo cliente" lo deja
  // listo para poder borrarse. Si el cliente ya tiene préstamos de antes
  // (le rechazaron pedir uno NUEVO, ver "Solicitar nuevo préstamo"), se
  // regresa a "activo": sigue siendo un cliente real con historial, nomás
  // no le dieron este préstamo — y si se dejara en "pendiente_aprobacion"
  // se quedaría pegado ahí para siempre, sin poder volver a solicitar.
  const { count: tienePrestamos } = await supabase
    .from("prestamos")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", solicitud.cliente_id);
  await supabase
    .from("clientes")
    .update({ estado: tienePrestamos ? "activo" : "inactivo" })
    .eq("id", solicitud.cliente_id);

  await supabase.from("historial_movimientos").insert({
    cliente_id: solicitud.cliente_id,
    usuario_id: sesion.id,
    tipo_movimiento: "rechazo_solicitud",
    monto: solicitud.monto_solicitado,
    descripcion: `Solicitud rechazada${notas ? `: ${notas}` : ""}`,
  });

  if (cliente?.creado_por) {
    await enviarPushAUsuario(cliente.creado_por, {
      title: "Préstamo rechazado",
      body: `${cliente.nombre_completo ?? "Tu cliente"}: la solicitud fue rechazada${notas ? ` (${notas})` : ""}`,
      url: "/panel",
    });
  }

  revalidatePath("/solicitudes");
  revalidatePath("/panel");
  redirect("/solicitudes");
}

/**
 * Aprueba una solicitud de perdón de mora que mandó un cobrador: Empresa
 * decide aquí cuánto se perdona (no tiene que ser toda la mora). Usa la
 * misma regla que `ajustarMora` (admin/prestamos/actions.ts) — solo puede
 * bajar la mora, nunca subirla, y si saldo y mora quedan en $0 se liquida el
 * préstamo de una vez.
 */
export async function aprobarPerdonMora(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();

  const solicitudId = String(formData.get("solicitud_id") || "");
  const montoPerdonado = Number(formData.get("monto_perdonado"));
  const notas = String(formData.get("notas") || "").trim() || null;

  const { data: solicitud } = await supabase
    .from("solicitudes_perdon_mora")
    .select("id, prestamo_id, cliente_id, estado, solicitado_por, clientes(nombre_completo)")
    .eq("id", solicitudId)
    .single();

  if (!solicitud) {
    redirect(`/solicitudes?error=${encodeURIComponent("Solicitud no encontrada")}`);
  }
  if (solicitud.estado !== "pendiente") {
    redirect(`/solicitudes?error=${encodeURIComponent("Esta solicitud ya fue resuelta")}`);
  }

  const { data: prestamo } = await supabase
    .from("prestamos")
    .select("id, saldo_actual, mora_acumulada, estado")
    .eq("id", solicitud.prestamo_id)
    .single();

  if (!prestamo) {
    redirect(`/solicitudes?error=${encodeURIComponent("Préstamo no encontrado")}`);
  }

  const moraActual = Number(prestamo.mora_acumulada);
  if (!Number.isFinite(montoPerdonado) || montoPerdonado <= 0) {
    redirect(`/solicitudes?error=${encodeURIComponent("El monto a perdonar debe ser mayor a 0")}`);
  }
  if (montoPerdonado > moraActual) {
    redirect(`/solicitudes?error=${encodeURIComponent("No puedes perdonar más de la mora acumulada actual")}`);
  }

  const moraNueva = Math.round((moraActual - montoPerdonado) * 100) / 100;
  const saldoActual = Number(prestamo.saldo_actual);
  const liquidado = saldoActual === 0 && moraNueva === 0;

  await supabase
    .from("prestamos")
    .update({
      mora_acumulada: moraNueva,
      estado: liquidado ? "liquidado" : prestamo.estado,
      fecha_liquidacion: liquidado ? new Date().toISOString() : null,
    })
    .eq("id", solicitud.prestamo_id);

  await supabase
    .from("solicitudes_perdon_mora")
    .update({
      estado: "aprobada",
      monto_perdonado: montoPerdonado,
      notas_resolucion: notas,
      resuelto_por: sesion.id,
      fecha_resolucion: new Date().toISOString(),
    })
    .eq("id", solicitudId)
    .eq("estado", "pendiente");

  await supabase.from("historial_movimientos").insert({
    prestamo_id: solicitud.prestamo_id,
    cliente_id: solicitud.cliente_id,
    usuario_id: sesion.id,
    tipo_movimiento: "ajuste_mora",
    monto: montoPerdonado,
    descripcion: `Perdón de mora aprobado (pedido por el cobrador): $${moraActual} → $${moraNueva} (se perdonaron $${montoPerdonado})`,
  });

  if (solicitud.solicitado_por) {
    await enviarPushAUsuario(solicitud.solicitado_por, {
      title: "Perdón de mora aprobado",
      body: `${nombreClienteEmbebido(solicitud.clientes) ?? "Tu cliente"}: se perdonaron $${montoPerdonado} de mora`,
      url: `/panel/clientes/${solicitud.cliente_id}`,
    });
  }

  revalidatePath("/solicitudes");
  revalidatePath(`/prestamos/${solicitud.prestamo_id}`);
  revalidatePath(`/panel/clientes/${solicitud.cliente_id}`);
  revalidatePath("/dashboard");
  redirect(`/solicitudes?exito=${encodeURIComponent(`Se perdonaron $${montoPerdonado} de mora`)}`);
}

/** Rechaza una solicitud de perdón de mora pendiente, con una nota opcional de por qué. */
export async function rechazarPerdonMora(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();

  const solicitudId = String(formData.get("solicitud_id") || "");
  const notas = String(formData.get("notas") || "").trim() || null;

  const { data: solicitud } = await supabase
    .from("solicitudes_perdon_mora")
    .select("id, cliente_id, estado, solicitado_por, clientes(nombre_completo)")
    .eq("id", solicitudId)
    .single();

  if (!solicitud) {
    redirect(`/solicitudes?error=${encodeURIComponent("Solicitud no encontrada")}`);
  }
  if (solicitud.estado !== "pendiente") {
    redirect(`/solicitudes?error=${encodeURIComponent("Esta solicitud ya fue resuelta")}`);
  }

  await supabase
    .from("solicitudes_perdon_mora")
    .update({
      estado: "rechazada",
      notas_resolucion: notas,
      resuelto_por: sesion.id,
      fecha_resolucion: new Date().toISOString(),
    })
    .eq("id", solicitudId)
    .eq("estado", "pendiente");

  if (solicitud.solicitado_por) {
    await enviarPushAUsuario(solicitud.solicitado_por, {
      title: "Perdón de mora rechazado",
      body: `${nombreClienteEmbebido(solicitud.clientes) ?? "Tu cliente"}: Empresa rechazó el perdón de mora${notas ? ` (${notas})` : ""}`,
      url: `/panel/clientes/${solicitud.cliente_id}`,
    });
  }

  revalidatePath("/solicitudes");
  redirect(`/solicitudes?exito=${encodeURIComponent("Solicitud de perdón de mora rechazada")}`);
}

/**
 * Aprueba una solicitud de "pagó varios días" TAL CUAL la pidió el cobrador
 * — Empresa no puede cambiar el número de días, solo aceptar o rechazar.
 * Aplica cada día por separado (misma regla que un pago normal: primero
 * mora, luego saldo) y se detiene sola si el préstamo se liquida antes de
 * usar todos los días pedidos.
 */
export async function aprobarPagoExtra(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();

  const solicitudId = String(formData.get("solicitud_id") || "");
  const notas = String(formData.get("notas") || "").trim() || null;

  const { data: solicitud } = await supabase
    .from("solicitudes_pago_extra")
    .select(
      "id, prestamo_id, cliente_id, cobrador_id, tipo, dias_extra, monto_personalizado, estado, solicitado_por, clientes(nombre_completo)"
    )
    .eq("id", solicitudId)
    .single();

  if (!solicitud) {
    redirect(`/solicitudes?error=${encodeURIComponent("Solicitud no encontrada")}`);
  }
  if (solicitud.estado !== "pendiente") {
    redirect(`/solicitudes?error=${encodeURIComponent("Esta solicitud ya fue resuelta")}`);
  }

  const { data: prestamo } = await supabase
    .from("prestamos")
    .select("id, saldo_actual, mora_acumulada, monto_cuota_sugerida, estado")
    .eq("id", solicitud.prestamo_id)
    .single();

  if (!prestamo) {
    redirect(`/solicitudes?error=${encodeURIComponent("Préstamo no encontrado")}`);
  }
  if (prestamo.estado === "liquidado" || prestamo.estado === "cancelado") {
    redirect(`/solicitudes?error=${encodeURIComponent("Este préstamo ya está cerrado, no se le puede aplicar más pagos")}`);
  }

  const saldoActual = Number(prestamo.saldo_actual);
  const moraActual = Number(prestamo.mora_acumulada);
  const montoCuota = Number(prestamo.monto_cuota_sugerida);

  // "Pagó varios días" reparte cada día por separado; "monto personalizado"
  // es un solo pago por la cantidad exacta que pidió el cobrador (topado a
  // lo que en realidad debía, por si pagó de más de lo que le quedaba).
  const esPersonalizado = solicitud.tipo === "monto_personalizado";
  const { montosPorDia, saldoFinal, moraFinal } = esPersonalizado
    ? (() => {
        const restante = Math.round((saldoActual + moraActual) * 100) / 100;
        const monto = Math.min(Number(solicitud.monto_personalizado), restante);
        if (monto <= 0) return { montosPorDia: [] as number[], saldoFinal: saldoActual, moraFinal: moraActual };
        const { saldoNuevo, moraNueva } = calcularAsignacionPago(saldoActual, moraActual, monto);
        return { montosPorDia: [monto], saldoFinal: saldoNuevo, moraFinal: moraNueva };
      })()
    : aplicarPagoVariosDias(saldoActual, moraActual, montoCuota, solicitud.dias_extra ?? 0);

  if (montosPorDia.length === 0) {
    redirect(`/solicitudes?error=${encodeURIComponent("Este préstamo ya no tiene saldo pendiente")}`);
  }

  let saldoCorrida = saldoActual;
  let moraCorrida = moraActual;
  const ahora = Date.now();
  const filasPago = montosPorDia.map((monto, i) => {
    const { saldoNuevo, moraNueva } = calcularAsignacionPago(saldoCorrida, moraCorrida, monto);
    const fila = {
      prestamo_id: solicitud.prestamo_id,
      cliente_id: solicitud.cliente_id,
      cobrador_id: solicitud.cobrador_id,
      monto,
      tipo: "cuota_diaria" as const,
      registrado_por: solicitud.solicitado_por ?? sesion.id,
      saldo_anterior: saldoCorrida,
      saldo_posterior: saldoNuevo,
      // Cada día extra queda registrado con un timestamp distinto (aunque
      // sea el mismo día real) para que el orden de los días quede claro en
      // el historial de pagos.
      fecha_pago: new Date(ahora + i * 1000).toISOString(),
    };
    saldoCorrida = saldoNuevo;
    moraCorrida = moraNueva;
    return fila;
  });

  const { error: errorPagos } = await supabase.from("pagos").insert(filasPago);
  if (errorPagos) {
    redirect(`/solicitudes?error=${encodeURIComponent(errorPagos.message)}`);
  }

  const liquidado = saldoFinal === 0 && moraFinal === 0;
  await supabase
    .from("prestamos")
    .update({
      saldo_actual: saldoFinal,
      mora_acumulada: moraFinal,
      estado: liquidado ? "liquidado" : prestamo.estado,
      fecha_liquidacion: liquidado ? new Date().toISOString() : null,
    })
    .eq("id", solicitud.prestamo_id);

  const montoTotalAplicado = montosPorDia.reduce((s, m) => s + m, 0);

  await supabase
    .from("solicitudes_pago_extra")
    .update({
      estado: "aprobada",
      notas_resolucion: notas,
      resuelto_por: sesion.id,
      fecha_resolucion: new Date().toISOString(),
    })
    .eq("id", solicitudId)
    .eq("estado", "pendiente");

  const descripcion = esPersonalizado
    ? `Pago personalizado aprobado (pedido por el cobrador): $${montoTotalAplicado}${
        montoTotalAplicado < Number(solicitud.monto_personalizado)
          ? ` (el cliente pagó $${solicitud.monto_personalizado}, pero el préstamo ya se liquidó con $${montoTotalAplicado})`
          : ""
      }`
    : `Pago de ${montosPorDia.length} día(s) extra aprobado (pedido por el cobrador): $${montoTotalAplicado}${
        montosPorDia.length < (solicitud.dias_extra ?? 0)
          ? ` (se liquidó antes de completar los ${solicitud.dias_extra} días pedidos)`
          : ""
      }`;

  await supabase.from("historial_movimientos").insert({
    prestamo_id: solicitud.prestamo_id,
    cliente_id: solicitud.cliente_id,
    usuario_id: sesion.id,
    tipo_movimiento: "pago",
    monto: montoTotalAplicado,
    descripcion,
  });

  if (solicitud.solicitado_por) {
    await enviarPushAUsuario(solicitud.solicitado_por, {
      title: esPersonalizado ? "Pago personalizado aprobado" : "Días extra aprobados",
      body: `${nombreClienteEmbebido(solicitud.clientes) ?? "Tu cliente"}: se aplicó $${montoTotalAplicado}`,
      url: `/panel/clientes/${solicitud.cliente_id}`,
    });
  }

  revalidatePath("/solicitudes");
  revalidatePath(`/prestamos/${solicitud.prestamo_id}`);
  revalidatePath(`/panel/clientes/${solicitud.cliente_id}`);
  revalidatePath("/panel");
  revalidatePath("/dashboard");
  redirect(
    `/solicitudes?exito=${encodeURIComponent(
      esPersonalizado ? `Se aplicó el pago personalizado ($${montoTotalAplicado})` : `Se aplicaron ${montosPorDia.length} día(s) de pago ($${montoTotalAplicado})`
    )}`
  );
}

/** Rechaza una solicitud de "pagó varios días" pendiente, con una nota opcional de por qué. */
export async function rechazarPagoExtra(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();

  const solicitudId = String(formData.get("solicitud_id") || "");
  const notas = String(formData.get("notas") || "").trim() || null;

  const { data: solicitud } = await supabase
    .from("solicitudes_pago_extra")
    .select("id, cliente_id, estado, solicitado_por, clientes(nombre_completo)")
    .eq("id", solicitudId)
    .single();

  if (!solicitud) {
    redirect(`/solicitudes?error=${encodeURIComponent("Solicitud no encontrada")}`);
  }
  if (solicitud.estado !== "pendiente") {
    redirect(`/solicitudes?error=${encodeURIComponent("Esta solicitud ya fue resuelta")}`);
  }

  await supabase
    .from("solicitudes_pago_extra")
    .update({
      estado: "rechazada",
      notas_resolucion: notas,
      resuelto_por: sesion.id,
      fecha_resolucion: new Date().toISOString(),
    })
    .eq("id", solicitudId)
    .eq("estado", "pendiente");

  if (solicitud.solicitado_por) {
    await enviarPushAUsuario(solicitud.solicitado_por, {
      title: "Solicitud rechazada",
      body: `${nombreClienteEmbebido(solicitud.clientes) ?? "Tu cliente"}: Empresa rechazó la solicitud${notas ? ` (${notas})` : ""}`,
      url: `/panel/clientes/${solicitud.cliente_id}`,
    });
  }

  revalidatePath("/solicitudes");
  redirect(`/solicitudes?exito=${encodeURIComponent("Solicitud de días extra rechazada")}`);
}
