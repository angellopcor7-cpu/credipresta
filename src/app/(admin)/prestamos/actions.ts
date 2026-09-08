"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirAdministrador } from "@/lib/auth/roles";
import { calcularSaldo, validarMontoPago } from "@/lib/finance/calculos";

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
