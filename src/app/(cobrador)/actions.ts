"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirVistaCobrador } from "@/lib/auth/roles";
import {
  esPlanValido,
  calcularMontoMora,
  calcularSaldoConMora,
  tieneCuotaVencidaSinPagar,
  calcularPorcentajeInteresPorPlan,
  calcularMontoTotal,
  calcularCuotaSugerida,
} from "@/lib/finance/calculos";
import { obtenerConfiguraciones } from "@/lib/config";
import { generarPagarePDF } from "@/lib/pdf/pagare";
import type { TipoDocumento } from "@/lib/types";

/** Un data URL de PNG con contenido real (no solo el prefijo, dibujado a mano en la cuadrícula de firma). */
function esFirmaValida(valor: FormDataEntryValue | null): valor is string {
  return typeof valor === "string" && valor.startsWith("data:image/png;base64,") && valor.length > 100;
}

const DIAS_SEMANA = [0, 1, 2, 3, 4, 5, 6];

function leerDiasPersonalizados(formData: FormData): number[] | null {
  if (!formData.get("personalizar_dias")) return null;
  const dias = DIAS_SEMANA.filter((d) => formData.get(`dia_${d}`));
  return dias; // puede ser un arreglo vacío a propósito (no cobra ningún día)
}

/**
 * El cobrador da de alta a un cliente nuevo y arma su solicitud de préstamo
 * en un solo paso: datos del cliente, el plan (20 o 30 días con interés
 * fijo, o uno personalizado con sus propios días y % de interés), foto de
 * su INE, y las dos firmas (cliente y cobrador) que se dibujaron en la
 * pantalla al momento de dar de alta. El pagaré ya no se sube como foto: se
 * genera aquí mismo (PDF con los datos del préstamo y ambas firmas) y ese es
 * el documento que queda guardado. Queda pendiente hasta que Empresa la
 * apruebe (y Empresa puede ajustar el % antes de aprobar).
 */
export async function crearClienteYSolicitud(formData: FormData) {
  const sesion = await exigirVistaCobrador();
  const supabase = await createClient();

  const nombreCompleto = String(formData.get("nombre_completo") || "").trim();
  const telefono = String(formData.get("telefono") || "").trim() || null;
  const direccion = String(formData.get("direccion") || "").trim() || null;
  const montoSolicitado = Number(formData.get("monto_solicitado"));
  const plazoDias = Number(formData.get("plazo_dias"));
  const porcentajePersonalizadoTexto = formData.get("porcentaje_interes_personalizado");
  const porcentajePersonalizado = porcentajePersonalizadoTexto ? Number(porcentajePersonalizadoTexto) : null;
  const ineFrente = formData.get("doc_ine_frente") as File | null;
  const ineReverso = formData.get("doc_ine_reverso") as File | null;
  const comprobanteDomicilio = formData.get("doc_comprobante_domicilio") as File | null;
  const fotoCliente = formData.get("doc_foto_cliente") as File | null;
  const firmaClienteDataUrl = formData.get("firma_cliente_data_url");
  const firmaCobradorDataUrl = formData.get("firma_cobrador_data_url");

  if (!nombreCompleto) {
    redirect(`/panel/clientes/nuevo?error=${encodeURIComponent("El nombre del cliente es obligatorio")}`);
  }
  if (!montoSolicitado || montoSolicitado <= 0) {
    redirect(`/panel/clientes/nuevo?error=${encodeURIComponent("El monto debe ser mayor a 0")}`);
  }
  if (porcentajePersonalizado != null) {
    if (porcentajePersonalizado <= 0) {
      redirect(`/panel/clientes/nuevo?error=${encodeURIComponent("El % de interés personalizado debe ser mayor a 0")}`);
    }
    if (!plazoDias || plazoDias <= 0) {
      redirect(`/panel/clientes/nuevo?error=${encodeURIComponent("Los días del plazo deben ser mayor a 0")}`);
    }
  } else if (!esPlanValido(plazoDias)) {
    redirect(`/panel/clientes/nuevo?error=${encodeURIComponent("Elige un plan de 20 o 30 días, o pon un % personalizado")}`);
  }
  if (!ineFrente || ineFrente.size === 0) {
    redirect(`/panel/clientes/nuevo?error=${encodeURIComponent("Falta la foto del INE")}`);
  }
  if (!esFirmaValida(firmaClienteDataUrl) || !esFirmaValida(firmaCobradorDataUrl)) {
    redirect(`/panel/clientes/nuevo?error=${encodeURIComponent("Falta la firma del cliente y/o del cobrador en el pagaré")}`);
  }

  const diasPersonalizados = leerDiasPersonalizados(formData);

  const { data: cliente, error: errorCliente } = await supabase
    .from("clientes")
    .insert({
      nombre_completo: nombreCompleto,
      telefono,
      direccion,
      estado: "pendiente_aprobacion",
      cobrador_id: sesion.cobradorId,
      creado_por: sesion.id,
    })
    .select("id")
    .single();

  if (errorCliente || !cliente) {
    redirect(
      `/panel/clientes/nuevo?error=${encodeURIComponent(errorCliente?.message || "No se pudo crear el cliente")}`
    );
  }

  const documentos: { archivo: File; tipo: TipoDocumento }[] = [{ archivo: ineFrente, tipo: "ine_frente" }];
  if (ineReverso && ineReverso.size > 0) documentos.push({ archivo: ineReverso, tipo: "ine_reverso" });
  if (comprobanteDomicilio && comprobanteDomicilio.size > 0) {
    documentos.push({ archivo: comprobanteDomicilio, tipo: "comprobante_domicilio" });
  }
  if (fotoCliente && fotoCliente.size > 0) documentos.push({ archivo: fotoCliente, tipo: "foto_cliente" });

  for (const { archivo, tipo } of documentos) {
    const rutaArchivo = `${cliente.id}/${tipo}/${Date.now()}-${archivo.name}`;
    const { error: errorSubida } = await supabase.storage
      .from("documentos-clientes")
      .upload(rutaArchivo, archivo, { contentType: archivo.type });

    if (!errorSubida) {
      await supabase.from("documentos_clientes").insert({
        cliente_id: cliente.id,
        tipo_documento: tipo,
        storage_path: rutaArchivo,
        subido_por: sesion.id,
      });
    }
  }

  // El pagaré ya no se sube como foto: se genera aquí mismo con los datos
  // que el cobrador acaba de capturar y las dos firmas dibujadas en la
  // pantalla (cliente y cobrador), y ese PDF es el que queda como
  // "pagare_firmado". Fecha de inicio/vencimiento son un estimado (el
  // calendario real, saltando días según la regla del negocio, se genera
  // hasta que Empresa apruebe el préstamo).
  const config = await obtenerConfiguraciones();
  const porcentajeEfectivo = porcentajePersonalizado ?? calcularPorcentajeInteresPorPlan(plazoDias as 20 | 30);
  const montoTotalPagare = calcularMontoTotal(montoSolicitado, porcentajeEfectivo);
  const montoCuotaPagare = calcularCuotaSugerida(montoTotalPagare, plazoDias);
  const fechaFirma = new Date();
  const fechaFinEstimada = new Date(fechaFirma);
  fechaFinEstimada.setUTCDate(fechaFinEstimada.getUTCDate() + plazoDias);

  const bytesPagare = await generarPagarePDF({
    folio: cliente.id.slice(0, 8).toUpperCase(),
    nombreCliente: nombreCompleto,
    montoPrestado: montoSolicitado,
    porcentajeInteres: porcentajeEfectivo,
    montoTotal: montoTotalPagare,
    montoCuotaDiaria: montoCuotaPagare,
    plazoDias,
    fechaInicio: fechaFirma,
    fechaFin: fechaFinEstimada,
    fechaFirma,
    nombreCobrador: sesion.nombreCompleto,
    lugar: config.lugarPagare,
    interesMoratorioDiarioPorcentaje: config.interesMoratorioDiarioPagare,
    firmaClienteDataUrl: String(firmaClienteDataUrl),
    firmaCobradorDataUrl: String(firmaCobradorDataUrl),
  });

  const rutaPagare = `${cliente.id}/pagare_firmado/${Date.now()}-pagare-firmado.pdf`;
  const { error: errorSubidaPagare } = await supabase.storage
    .from("documentos-clientes")
    .upload(rutaPagare, Buffer.from(bytesPagare), { contentType: "application/pdf" });

  if (!errorSubidaPagare) {
    await supabase.from("documentos_clientes").insert({
      cliente_id: cliente.id,
      tipo_documento: "pagare_firmado",
      storage_path: rutaPagare,
      subido_por: sesion.id,
    });
  }

  const { error: errorSolicitud } = await supabase.from("solicitudes_prestamo").insert({
    cliente_id: cliente.id,
    monto_solicitado: montoSolicitado,
    plazo_dias: plazoDias,
    porcentaje_interes_personalizado: porcentajePersonalizado,
    dias_cobro_personalizados: diasPersonalizados,
  });

  if (errorSolicitud) {
    redirect(`/panel/clientes/nuevo?error=${encodeURIComponent(errorSolicitud.message)}`);
  }

  revalidatePath("/panel");
  redirect("/panel?exito=" + encodeURIComponent(`${nombreCompleto} quedó pendiente de aprobación por Empresa.`));
}

/**
 * "Aplicar pago del día": registra la cuota de hoy como pagada (por el monto
 * sugerido del calendario) para ese préstamo. Usa la misma tabla `pagos` y
 * política RLS que ya deja al cobrador registrar pagos de sus propios
 * clientes.
 */
export async function aplicarPagoDelDia(formData: FormData) {
  const sesion = await exigirVistaCobrador();
  const supabase = await createClient();

  const prestamoId = String(formData.get("prestamo_id") || "");
  const montoTexto = formData.get("monto");

  const { data: prestamo } = await supabase
    .from("prestamos")
    .select("id, cliente_id, cobrador_id, saldo_actual, monto_cuota_sugerida, estado")
    .eq("id", prestamoId)
    .single();

  if (!prestamo) {
    redirect(`/panel?error=${encodeURIComponent("Préstamo no encontrado")}`);
  }
  if (prestamo.estado === "liquidado" || prestamo.estado === "cancelado") {
    redirect(`/panel/clientes/${prestamo.cliente_id}?error=${encodeURIComponent("Este préstamo ya está cerrado")}`);
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const { data: pagosHoy } = await supabase
    .from("pagos")
    .select("id, fecha_pago")
    .eq("prestamo_id", prestamoId)
    .eq("tipo", "cuota_diaria");
  const yaPagoHoy = (pagosHoy ?? []).some((p) => p.fecha_pago?.slice(0, 10) === hoy);
  if (yaPagoHoy) {
    redirect(`/panel/clientes/${prestamo.cliente_id}?error=${encodeURIComponent("Ya se aplicó el pago de hoy para este préstamo")}`);
  }

  const saldoActual = Number(prestamo.saldo_actual);
  const monto = montoTexto ? Number(montoTexto) : Number(prestamo.monto_cuota_sugerida);
  const montoAplicado = Math.min(monto, saldoActual);

  if (!montoAplicado || montoAplicado <= 0) {
    redirect(`/panel/clientes/${prestamo.cliente_id}?error=${encodeURIComponent("Monto inválido")}`);
  }

  const saldoNuevo = Math.max(0, Math.round((saldoActual - montoAplicado) * 100) / 100);

  const { error: errorPago } = await supabase.from("pagos").insert({
    prestamo_id: prestamoId,
    cliente_id: prestamo.cliente_id,
    cobrador_id: prestamo.cobrador_id,
    monto: montoAplicado,
    tipo: "cuota_diaria",
    registrado_por: sesion.id,
    saldo_anterior: saldoActual,
    saldo_posterior: saldoNuevo,
  });

  if (errorPago) {
    redirect(`/panel/clientes/${prestamo.cliente_id}?error=${encodeURIComponent(errorPago.message)}`);
  }

  await supabase
    .from("prestamos")
    .update({
      saldo_actual: saldoNuevo,
      estado: saldoNuevo === 0 ? "liquidado" : "activo",
      fecha_liquidacion: saldoNuevo === 0 ? new Date().toISOString() : null,
    })
    .eq("id", prestamoId);

  revalidatePath("/panel");
  revalidatePath(`/panel/clientes/${prestamo.cliente_id}`);
  redirect(`/panel/clientes/${prestamo.cliente_id}?exito=${encodeURIComponent(`Pago de $${montoAplicado} aplicado`)}`);
}

/**
 * "No cumplió el pago": el cobrador marca que el cliente no pagó hoy y se
 * aumenta la mora del préstamo (misma regla que ya usa Empresa desde
 * /prestamos, adaptada para que el propio cobrador la pueda aplicar sobre
 * sus clientes). No hace nada si el préstamo ya está cerrado, no tiene
 * ninguna cuota vencida sin pagar, o ya se le aplicó la mora de hoy.
 */
export async function marcarIncumplidoDelDia(formData: FormData) {
  const sesion = await exigirVistaCobrador();
  const supabase = await createClient();
  const config = await obtenerConfiguraciones();

  const prestamoId = String(formData.get("prestamo_id") || "");
  const hoy = new Date().toISOString().slice(0, 10);

  const { data: prestamo } = await supabase
    .from("prestamos")
    .select("id, cliente_id, saldo_actual, estado")
    .eq("id", prestamoId)
    .single();

  if (!prestamo) {
    redirect(`/panel?error=${encodeURIComponent("Préstamo no encontrado")}`);
  }
  if (prestamo.estado === "liquidado" || prestamo.estado === "cancelado") {
    redirect(`/panel/clientes/${prestamo.cliente_id}?error=${encodeURIComponent("Este préstamo ya está cerrado")}`);
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
  if (!enAtraso) {
    redirect(`/panel/clientes/${prestamo.cliente_id}?error=${encodeURIComponent("Este cliente no tiene cuotas vencidas todavía")}`);
  }

  const { count: moraHoy } = await supabase
    .from("moras")
    .select("id", { count: "exact", head: true })
    .eq("prestamo_id", prestamoId)
    .eq("fecha_generada", hoy);
  if (moraHoy) {
    redirect(`/panel/clientes/${prestamo.cliente_id}?error=${encodeURIComponent("Ya se marcó el incumplimiento de hoy")}`);
  }

  const { count: morasPrevias } = await supabase
    .from("moras")
    .select("id", { count: "exact", head: true })
    .eq("prestamo_id", prestamoId);

  const saldoActual = Number(prestamo.saldo_actual);
  const diaAtraso = (morasPrevias ?? 0) + 1;
  const montoMora = calcularMontoMora(saldoActual, config.reglaMora);
  const saldoNuevo = calcularSaldoConMora(saldoActual, montoMora);

  const { error: errorMora } = await supabase.from("moras").insert({
    prestamo_id: prestamoId,
    monto_mora: montoMora,
    dia_atraso: diaAtraso,
    saldo_anterior: saldoActual,
    saldo_posterior: saldoNuevo,
    fecha_generada: hoy,
    generada_por: sesion.id,
  });
  if (errorMora) {
    redirect(`/panel/clientes/${prestamo.cliente_id}?error=${encodeURIComponent(errorMora.message)}`);
  }

  await supabase.from("prestamos").update({ saldo_actual: saldoNuevo, estado: "en_mora" }).eq("id", prestamoId);

  await supabase.from("historial_movimientos").insert({
    prestamo_id: prestamoId,
    cliente_id: prestamo.cliente_id,
    usuario_id: sesion.id,
    tipo_movimiento: "mora",
    monto: montoMora,
    descripcion: `Mora día ${diaAtraso} aplicada por el cobrador: $${montoMora} (saldo $${saldoActual} → $${saldoNuevo})`,
  });

  revalidatePath("/panel");
  revalidatePath(`/panel/clientes/${prestamo.cliente_id}`);
  redirect(
    `/panel/clientes/${prestamo.cliente_id}?exito=${encodeURIComponent(`Incumplimiento marcado: mora de $${montoMora} aplicada`)}`
  );
}
