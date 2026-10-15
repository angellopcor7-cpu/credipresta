"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirAdministrador } from "@/lib/auth/roles";
import {
  calcularAsignacionPago,
  validarMontoPago,
  calcularInteres,
  calcularMontoTotal,
  calcularCuotaSugerida,
} from "@/lib/finance/calculos";

/**
 * Registra un pago o abono sobre un préstamo existente. El pago abona
 * primero a la mora acumulada (si tiene) y lo que sobra al saldo de
 * principal+interés — ver calcularAsignacionPago. Solo se marca "liquidado"
 * cuando AMBOS quedan en cero; si queda mora pendiente, el préstamo se
 * queda en su estado ("en_mora" normalmente) aunque el saldo ya esté en 0.
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
    .select("id, cliente_id, cobrador_id, saldo_actual, mora_acumulada, estado")
    .eq("id", prestamoId)
    .single();

  if (!prestamo) {
    redirect(`/prestamos?error=${encodeURIComponent("Préstamo no encontrado")}`);
  }

  if (prestamo.estado === "liquidado" || prestamo.estado === "cancelado") {
    redirect(`/prestamos/${prestamoId}?error=${encodeURIComponent("Este préstamo ya está liquidado o cancelado")}`);
  }

  const saldoActual = Number(prestamo.saldo_actual);
  const moraActual = Number(prestamo.mora_acumulada);
  const validacion = validarMontoPago(monto, saldoActual + moraActual);
  if (!validacion.valido) {
    redirect(`/prestamos/${prestamoId}?error=${encodeURIComponent(validacion.motivo || "Monto inválido")}`);
  }

  const { saldoNuevo, moraNueva } = calcularAsignacionPago(saldoActual, moraActual, monto);

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

  const liquidado = saldoNuevo === 0 && moraNueva === 0;
  const nuevoEstado = liquidado ? "liquidado" : prestamo.estado;
  await supabase
    .from("prestamos")
    .update({
      saldo_actual: saldoNuevo,
      mora_acumulada: moraNueva,
      estado: nuevoEstado,
      fecha_liquidacion: liquidado ? new Date().toISOString() : null,
    })
    .eq("id", prestamoId);

  await supabase.from("historial_movimientos").insert({
    prestamo_id: prestamoId,
    cliente_id: prestamo.cliente_id,
    usuario_id: sesion.id,
    tipo_movimiento: "pago",
    monto,
    descripcion: `Pago de $${monto} registrado (saldo: $${saldoActual} → $${saldoNuevo}, mora: $${moraActual} → $${moraNueva})`,
  });

  revalidatePath(`/prestamos/${prestamoId}`);
  revalidatePath("/prestamos");
  redirect(`/prestamos/${prestamoId}`);
}

/**
 * Reduce o perdona la mora acumulada de un préstamo — para cuando Empresa
 * negocia con el cliente ("te cobro solo la mitad de la mora para que
 * liquides hoy"). Nunca puede AUMENTAR la mora desde aquí, solo bajarla o
 * dejarla en $0. Si al perdonar queda saldo y mora en cero, se liquida el
 * préstamo igual que un pago (es lo típico: "perdono la mora para que
 * cierre hoy").
 */
export async function ajustarMora(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();

  const prestamoId = String(formData.get("prestamo_id") || "");
  const moraNuevaTexto = formData.get("mora_nueva");
  const motivo = String(formData.get("motivo") || "").trim();

  const { data: prestamo } = await supabase
    .from("prestamos")
    .select("id, cliente_id, saldo_actual, mora_acumulada, estado")
    .eq("id", prestamoId)
    .single();

  if (!prestamo) {
    redirect(`/prestamos?error=${encodeURIComponent("Préstamo no encontrado")}`);
  }
  if (prestamo.estado === "liquidado" || prestamo.estado === "cancelado") {
    redirect(`/prestamos/${prestamoId}?error=${encodeURIComponent("Este préstamo ya está liquidado o cancelado")}`);
  }

  const moraActual = Number(prestamo.mora_acumulada);
  const moraNueva = Number(moraNuevaTexto);

  if (!Number.isFinite(moraNueva) || moraNueva < 0) {
    redirect(`/prestamos/${prestamoId}?error=${encodeURIComponent("Monto de mora inválido")}`);
  }
  if (moraNueva > moraActual) {
    redirect(
      `/prestamos/${prestamoId}?error=${encodeURIComponent("Este ajuste solo puede bajar la mora, no subirla")}`
    );
  }
  if (!motivo) {
    redirect(`/prestamos/${prestamoId}?error=${encodeURIComponent("Escribe el motivo del ajuste")}`);
  }

  const saldoActual = Number(prestamo.saldo_actual);
  const liquidado = saldoActual === 0 && moraNueva === 0;

  await supabase
    .from("prestamos")
    .update({
      mora_acumulada: moraNueva,
      estado: liquidado ? "liquidado" : prestamo.estado,
      fecha_liquidacion: liquidado ? new Date().toISOString() : null,
    })
    .eq("id", prestamoId);

  const descuento = Math.round((moraActual - moraNueva) * 100) / 100;
  await supabase.from("historial_movimientos").insert({
    prestamo_id: prestamoId,
    cliente_id: prestamo.cliente_id,
    usuario_id: sesion.id,
    tipo_movimiento: "ajuste_mora",
    monto: descuento,
    descripcion: `Ajuste de mora: $${moraActual} → $${moraNueva} (se perdonaron $${descuento}). Motivo: ${motivo}`,
  });

  revalidatePath(`/prestamos/${prestamoId}`);
  revalidatePath("/prestamos");
  revalidatePath("/dashboard");
  redirect(
    `/prestamos/${prestamoId}?exito=${encodeURIComponent(
      liquidado ? "Mora ajustada y préstamo liquidado" : `Mora ajustada a $${moraNueva}`
    )}`
  );
}

/**
 * Corrige datos del préstamo capturados mal — pensado sobre todo para
 * "Cliente existente" (Empresa captura montos/fechas a mano y se puede
 * equivocar), pero sirve para cualquier préstamo. Recalcula interés, total
 * y cuota sugerida a partir del monto y % que queden, y recalcula el estado
 * (activo/en_mora/liquidado) a partir del saldo y la mora que queden.
 *
 * Esto NO regenera el calendario de cobro ni el historial de moras — si
 * cambia el plazo o la fecha de inicio de un préstamo que ya tiene
 * calendario/mora generados, ese calendario se queda como estaba y hay que
 * avisarle a Claude para ajustarlo a mano.
 */
export async function editarDatosPrestamo(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();

  const prestamoId = String(formData.get("prestamo_id") || "");
  const montoPrestado = Number(formData.get("monto_prestado"));
  const porcentajeInteres = Number(formData.get("porcentaje_interes"));
  const plazoDias = Number(formData.get("plazo_dias"));
  const fechaInicio = String(formData.get("fecha_inicio") || "").trim();
  const metodoPago = String(formData.get("metodo_pago") || "efectivo").trim();
  const datosTransferencia = String(formData.get("datos_transferencia") || "").trim() || null;
  const saldoActual = Number(formData.get("saldo_actual"));
  const moraAcumulada = Number(formData.get("mora_acumulada"));
  const motivo = String(formData.get("motivo") || "").trim();

  const { data: prestamo } = await supabase
    .from("prestamos")
    .select("id, cliente_id, estado, monto_prestado, porcentaje_interes, plazo_dias, saldo_actual, mora_acumulada")
    .eq("id", prestamoId)
    .single();

  if (!prestamo) {
    redirect(`/prestamos?error=${encodeURIComponent("Préstamo no encontrado")}`);
  }
  if (prestamo.estado === "cancelado") {
    redirect(`/prestamos/${prestamoId}?error=${encodeURIComponent("Este préstamo está cancelado, ya no se puede editar")}`);
  }
  if (!motivo) {
    redirect(`/prestamos/${prestamoId}?error=${encodeURIComponent("Escribe por qué se corrige (para el historial)")}`);
  }
  if (!montoPrestado || montoPrestado <= 0) {
    redirect(`/prestamos/${prestamoId}?error=${encodeURIComponent("El monto prestado debe ser mayor a 0")}`);
  }
  if (!porcentajeInteres || porcentajeInteres <= 0) {
    redirect(`/prestamos/${prestamoId}?error=${encodeURIComponent("El % de interés debe ser mayor a 0")}`);
  }
  if (!plazoDias || plazoDias <= 0) {
    redirect(`/prestamos/${prestamoId}?error=${encodeURIComponent("El plazo en días debe ser mayor a 0")}`);
  }
  if (!fechaInicio) {
    redirect(`/prestamos/${prestamoId}?error=${encodeURIComponent("La fecha de inicio es obligatoria")}`);
  }
  if (!Number.isFinite(saldoActual) || saldoActual < 0) {
    redirect(`/prestamos/${prestamoId}?error=${encodeURIComponent("El saldo no puede ser negativo")}`);
  }
  if (!Number.isFinite(moraAcumulada) || moraAcumulada < 0) {
    redirect(`/prestamos/${prestamoId}?error=${encodeURIComponent("La mora no puede ser negativa")}`);
  }

  const montoInteres = calcularInteres(montoPrestado, porcentajeInteres);
  const montoTotal = calcularMontoTotal(montoPrestado, porcentajeInteres);
  const montoCuota = calcularCuotaSugerida(montoTotal, plazoDias);

  if (saldoActual > montoTotal) {
    redirect(
      `/prestamos/${prestamoId}?error=${encodeURIComponent(
        `El saldo ($${saldoActual}) no puede ser mayor al total con intereses ($${montoTotal})`
      )}`
    );
  }

  let estadoNuevo: "activo" | "en_mora" | "liquidado" = "activo";
  if (saldoActual <= 0 && moraAcumulada <= 0) estadoNuevo = "liquidado";
  else if (moraAcumulada > 0) estadoNuevo = "en_mora";

  await supabase
    .from("prestamos")
    .update({
      monto_prestado: montoPrestado,
      porcentaje_interes: porcentajeInteres,
      monto_interes: montoInteres,
      monto_total: montoTotal,
      monto_cuota_sugerida: montoCuota,
      plazo_dias: plazoDias,
      fecha_inicio: fechaInicio,
      metodo_pago: metodoPago,
      datos_transferencia: datosTransferencia,
      saldo_actual: saldoActual,
      mora_acumulada: moraAcumulada,
      estado: estadoNuevo,
      fecha_liquidacion: estadoNuevo === "liquidado" ? new Date().toISOString() : null,
    })
    .eq("id", prestamoId);

  await supabase.from("historial_movimientos").insert({
    prestamo_id: prestamoId,
    cliente_id: prestamo.cliente_id,
    usuario_id: sesion.id,
    tipo_movimiento: "correccion_datos",
    monto: montoPrestado,
    descripcion: `Datos corregidos por Empresa: prestado $${prestamo.monto_prestado}→$${montoPrestado}, interés ${prestamo.porcentaje_interes}%→${porcentajeInteres}%, saldo $${prestamo.saldo_actual}→$${saldoActual}, mora $${prestamo.mora_acumulada}→$${moraAcumulada}. Motivo: ${motivo}`,
  });

  revalidatePath(`/prestamos/${prestamoId}`);
  revalidatePath("/prestamos");
  revalidatePath("/dashboard");
  redirect(`/prestamos/${prestamoId}?exito=${encodeURIComponent("Datos del préstamo corregidos")}`);
}
