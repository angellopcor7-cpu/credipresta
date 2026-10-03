"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirAdministrador } from "@/lib/auth/roles";
import { calcularAsignacionPago, validarMontoPago } from "@/lib/finance/calculos";

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
