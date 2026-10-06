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
  calcularSaldo,
  generarCalendarioPagos,
} from "@/lib/finance/calculos";

/**
 * Da de alta un cliente que YA traía un préstamo en curso antes de empezar a
 * usar la app — clientes reales del negocio de Empresa que ya estaban
 * pagando. A diferencia del flujo normal (cobrador pide → Empresa aprueba →
 * préstamo nuevo arrancando en $0 abonado), aquí Empresa captura el estado
 * real de HOY: cuánto se prestó, cuánto ya se ha abonado y cuánta mora lleva
 * acumulada — así el saldo y la mora en la app arrancan igual que en la vida
 * real, no desde cero.
 *
 * El calendario de cobro se genera completo (como cualquier préstamo nuevo)
 * y se deja en "pendiente" — igual que en el flujo normal, ese calendario es
 * solo de referencia: la mora la sigue aplicando el cobrador a mano, día por
 * día, con "No pagó hoy". Si ya traía mora, se reconstruyen esos días de
 * atraso en la tabla `moras` repartiendo el monto que Empresa indicó, para
 * que el contador de "día de atraso" (el que usan "No pagó hoy" y "Pedir
 * perdón de mora") siga avanzando bien desde aquí.
 */
export async function crearClienteExistente(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();
  const config = await obtenerConfiguraciones();

  const nombreCompleto = String(formData.get("nombre_completo") || "").trim();
  const telefono = String(formData.get("telefono") || "").trim() || null;
  const direccion = String(formData.get("direccion") || "").trim() || null;
  const identificacion = String(formData.get("identificacion") || "").trim() || null;
  const referenciaPersonal = String(formData.get("referencia_personal") || "").trim() || null;
  const notasTexto = String(formData.get("notas") || "").trim();
  const cobradorId = String(formData.get("cobrador_id") || "").trim();

  const montoPrestado = Number(formData.get("monto_prestado"));
  const porcentajeInteres = Number(formData.get("porcentaje_interes"));
  const plazoDias = Number(formData.get("plazo_dias"));
  const fechaInicio = String(formData.get("fecha_inicio") || "").trim();
  const metodoPago = String(formData.get("metodo_pago") || "efectivo").trim();
  const datosTransferencia = String(formData.get("datos_transferencia") || "").trim() || null;

  const montoAbonado = Number(formData.get("monto_abonado") || 0);
  const moraAcumulada = Number(formData.get("mora_acumulada") || 0);
  const diasAtrasoIngresado = Number(formData.get("dias_atraso") || 0);

  const hoy = new Date().toISOString().slice(0, 10);

  if (!nombreCompleto) {
    redirect(`/clientes/existente?error=${encodeURIComponent("El nombre del cliente es obligatorio")}`);
  }
  if (!cobradorId) {
    redirect(`/clientes/existente?error=${encodeURIComponent("Elige a qué cobrador pertenece este cliente")}`);
  }
  if (!montoPrestado || montoPrestado <= 0) {
    redirect(`/clientes/existente?error=${encodeURIComponent("El monto prestado debe ser mayor a 0")}`);
  }
  if (!porcentajeInteres || porcentajeInteres <= 0) {
    redirect(`/clientes/existente?error=${encodeURIComponent("El % de interés total debe ser mayor a 0")}`);
  }
  if (!plazoDias || plazoDias <= 0) {
    redirect(`/clientes/existente?error=${encodeURIComponent("El plazo en días debe ser mayor a 0")}`);
  }
  if (!fechaInicio) {
    redirect(`/clientes/existente?error=${encodeURIComponent("La fecha en que se prestó el dinero es obligatoria")}`);
  }
  if (fechaInicio > hoy) {
    redirect(`/clientes/existente?error=${encodeURIComponent("La fecha de inicio no puede ser en el futuro")}`);
  }
  if (montoAbonado < 0) {
    redirect(`/clientes/existente?error=${encodeURIComponent("Lo abonado no puede ser negativo")}`);
  }
  if (moraAcumulada < 0) {
    redirect(`/clientes/existente?error=${encodeURIComponent("La mora no puede ser negativa")}`);
  }

  const montoInteres = calcularInteres(montoPrestado, porcentajeInteres);
  const montoTotal = calcularMontoTotal(montoPrestado, porcentajeInteres);
  const montoCuota = calcularCuotaSugerida(montoTotal, plazoDias);

  if (montoAbonado > montoTotal) {
    redirect(
      `/clientes/existente?error=${encodeURIComponent(
        `Lo abonado ($${montoAbonado}) no puede ser mayor al total con intereses ($${montoTotal})`
      )}`
    );
  }

  const saldoActual = calcularSaldo(montoTotal, [montoAbonado]);
  const diasAtraso = moraAcumulada > 0 ? Math.max(1, Math.round(diasAtrasoIngresado) || 1) : 0;

  let estadoPrestamo: "activo" | "en_mora" | "liquidado" = "activo";
  if (saldoActual <= 0 && moraAcumulada <= 0) estadoPrestamo = "liquidado";
  else if (moraAcumulada > 0) estadoPrestamo = "en_mora";

  const notas = notasTexto
    ? `${notasTexto} (cliente existente, migrado por Empresa)`
    : "Cliente existente, migrado por Empresa";

  const { data: cliente, error: errorCliente } = await supabase
    .from("clientes")
    .insert({
      nombre_completo: nombreCompleto,
      telefono,
      direccion,
      identificacion,
      referencia_personal: referenciaPersonal,
      notas,
      estado: "activo",
      cobrador_id: cobradorId,
      creado_por: sesion.id,
    })
    .select("id")
    .single();

  if (errorCliente || !cliente) {
    redirect(
      `/clientes/existente?error=${encodeURIComponent(errorCliente?.message || "No se pudo crear el cliente")}`
    );
  }

  const { data: prestamo, error: errorPrestamo } = await supabase
    .from("prestamos")
    .insert({
      cliente_id: cliente.id,
      cobrador_id: cobradorId,
      monto_prestado: montoPrestado,
      porcentaje_interes: porcentajeInteres,
      monto_interes: montoInteres,
      monto_total: montoTotal,
      saldo_actual: saldoActual,
      plazo_dias: plazoDias,
      monto_cuota_sugerida: montoCuota,
      fecha_inicio: fechaInicio,
      estado: estadoPrestamo,
      metodo_pago: metodoPago,
      datos_transferencia: datosTransferencia,
      mora_acumulada: moraAcumulada,
      fecha_liquidacion: estadoPrestamo === "liquidado" ? new Date().toISOString() : null,
      creado_por: sesion.id,
    })
    .select("id")
    .single();

  if (errorPrestamo || !prestamo) {
    redirect(
      `/clientes/existente?error=${encodeURIComponent(errorPrestamo?.message || "No se pudo crear el préstamo")}`
    );
  }

  const calendario = generarCalendarioPagos({
    fechaInicio: new Date(`${fechaInicio}T00:00:00Z`),
    plazoDias,
    montoPrestamo: montoPrestado,
    montoCuota,
    regla: config.reglaDiasCobro,
    diasPersonalizados: null,
  });
  if (calendario.length > 0) {
    await supabase.from("calendario_pagos").insert(
      calendario.map((d) => ({
        prestamo_id: prestamo.id,
        numero_dia: d.numeroDia,
        fecha_programada: d.fechaProgramada,
        monto_esperado: d.montoEsperado,
      }))
    );
  }

  // Reconstruye los días de atraso que ya traía, repartiendo el monto de
  // mora entre esos días (el último día absorbe el residuo del redondeo
  // para que la suma cuadre exacto con lo que Empresa capturó).
  if (moraAcumulada > 0 && diasAtraso > 0) {
    const porDia = Math.floor((moraAcumulada / diasAtraso) * 100) / 100;
    const filasMora = [];
    for (let i = diasAtraso; i >= 1; i--) {
      const fecha = new Date(`${hoy}T00:00:00Z`);
      fecha.setUTCDate(fecha.getUTCDate() - i);
      const numeroDeAtraso = diasAtraso - i + 1;
      const esUltimoDia = i === 1;
      const montoFila = esUltimoDia ? Math.round((moraAcumulada - porDia * (diasAtraso - 1)) * 100) / 100 : porDia;
      filasMora.push({
        prestamo_id: prestamo.id,
        monto_mora: montoFila,
        dia_atraso: numeroDeAtraso,
        fecha_generada: fecha.toISOString().slice(0, 10),
        saldo_anterior: saldoActual,
        saldo_posterior: saldoActual,
        generada_por: sesion.id,
      });
    }
    await supabase.from("moras").insert(filasMora);
  }

  await supabase.from("historial_movimientos").insert({
    prestamo_id: prestamo.id,
    cliente_id: cliente.id,
    usuario_id: sesion.id,
    tipo_movimiento: "cliente_existente_migrado",
    monto: montoPrestado,
    descripcion: `Cliente existente agregado por Empresa: prestó $${montoPrestado}, ya abonado $${montoAbonado}, saldo $${saldoActual}${
      moraAcumulada > 0 ? `, con mora de $${moraAcumulada} (${diasAtraso} días de atraso)` : ""
    }.`,
  });

  revalidatePath("/clientes");
  revalidatePath("/prestamos");
  redirect(
    `/prestamos/${prestamo.id}?exito=${encodeURIComponent(`${nombreCompleto} se agregó como cliente existente`)}`
  );
}
