"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirAdministrador } from "@/lib/auth/roles";
import { lunesDeHoy, domingoDe, claveSemana, formatoRangoSemana } from "@/lib/fechas";
import { calcularCorte, construirDetalleClientes } from "./calcular";
import { generarRespaldoCortePDF } from "@/lib/pdf/respaldoCorte";

/**
 * "Confirmar corte": congela los números de la semana actual (prestado,
 * recolectado, mora generada, comisiones) en un registro permanente — el
 * cierre semanal que pidió Empresa. NO toca el saldo ni la mora real de los
 * clientes (eso sigue intacto, es dinero que de verdad deben); lo único que
 * "se reinicia" es que, a partir de la semana siguiente, /corte vuelve a
 * mostrar $0 en los contadores de "esta semana" porque ya está viendo una
 * semana nueva y sin movimientos todavía.
 *
 * Solo se puede confirmar la semana EN CURSO (no una pasada ni futura), y
 * solo una vez — si ya existe un corte para esa semana, se bloquea para no
 * pisar el registro histórico.
 */
export async function confirmarCorte(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();

  const claveLunesForm = String(formData.get("clave_lunes") || "");
  const claveLunes = claveSemana(claveLunesForm || lunesDeHoy());

  if (claveLunes !== lunesDeHoy()) {
    redirect(`/corte?semana=${claveLunes}&error=${encodeURIComponent("Solo se puede confirmar el corte de la semana en curso")}`);
  }

  const { data: existente } = await supabase
    .from("cortes_semanales")
    .select("id")
    .eq("clave_lunes", claveLunes)
    .maybeSingle();

  if (existente) {
    redirect(`/corte?semana=${claveLunes}&error=${encodeURIComponent("Ya se hizo el corte de esta semana")}`);
  }

  const { filas, totales } = await calcularCorte(supabase, claveLunes);

  const { data: corteInsertado, error } = await supabase
    .from("cortes_semanales")
    .insert({
      clave_lunes: claveLunes,
      clave_domingo: domingoDe(claveLunes),
      creado_por: sesion.id,
      total_clientes_activos: totales.clientesActivos,
      total_prestado_semana: totales.prestadoSemana,
      total_cobrado_semana: totales.cobradoSemana,
      total_mora_generada_semana: totales.moraGeneradaSemana,
      total_mora_acumulada: totales.moraAcumulada,
      total_falta_por_cobrar: totales.faltaPorCobrar,
      total_comision: totales.comision,
      detalle: filas,
    })
    .select("id")
    .single();

  if (error || !corteInsertado) {
    redirect(`/corte?semana=${claveLunes}&error=${encodeURIComponent(error?.message || "No se pudo guardar el corte")}`);
  }

  // Respaldo en PDF de TODA la cartera (clientes, lo cobrado, lo que falta
  // por cobrar, mora) al momento de este corte — lo pidió Angel para tener
  // una copia legible fuera de la base de datos. Si por algo falla (PDF
  // raro, subida al storage, etc.) el corte en sí YA quedó confirmado
  // arriba, así que no se bloquea por esto: el corte es lo que de verdad
  // importa cerrar a tiempo cada semana.
  try {
    const clientes = await construirDetalleClientes(supabase);
    const pdfBytes = await generarRespaldoCortePDF({
      rangoSemana: formatoRangoSemana(claveLunes),
      fechaGeneracion: new Date(),
      generadoPor: sesion.nombreCompleto,
      totales,
      filasCobrador: filas,
      clientes,
    });
    const rutaPdf = `${claveLunes}/respaldo-${Date.now()}.pdf`;
    const { error: errorSubida } = await supabase.storage
      .from("respaldos-corte")
      .upload(rutaPdf, Buffer.from(pdfBytes), { contentType: "application/pdf" });
    if (!errorSubida) {
      await supabase.from("cortes_semanales").update({ pdf_path: rutaPdf }).eq("id", corteInsertado.id);
    }
  } catch {
    // Se ignora a propósito: ver comentario de arriba.
  }

  await supabase.from("historial_movimientos").insert({
    usuario_id: sesion.id,
    tipo_movimiento: "corte_semanal",
    monto: totales.faltaPorCobrar,
    descripcion: `Corte de la semana confirmado: prestado ${totales.prestadoSemana}, recolectado ${totales.cobradoSemana}, mora generada ${totales.moraGeneradaSemana}`,
  });

  revalidatePath("/corte");
  revalidatePath("/corte/historial");
  revalidatePath("/dashboard");
  redirect(`/corte?semana=${claveLunes}&exito=${encodeURIComponent("Corte de la semana confirmado")}`);
}
