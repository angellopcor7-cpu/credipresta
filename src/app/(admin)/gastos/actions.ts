"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirAdministrador } from "@/lib/auth/roles";
import type { CategoriaGasto } from "@/lib/types";

const CATEGORIAS_VALIDAS: CategoriaGasto[] = ["piso", "comision_cobradores", "otro"];

/**
 * Registra un gasto del negocio (renta del piso, comisión que se le pagó a
 * los cobradores, o cualquier otro gasto operativo — camisas, reparación de
 * motos, etc.). Es un registro manual: Empresa lo anota cuando de verdad
 * sale el dinero, no se genera solo a partir del corte ni de nada más.
 */
export async function crearGasto(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();

  const categoria = String(formData.get("categoria") || "");
  const concepto = String(formData.get("concepto") || "").trim();
  const monto = Number(formData.get("monto"));
  const fecha = String(formData.get("fecha") || "").trim();
  const notas = String(formData.get("notas") || "").trim() || null;

  if (!CATEGORIAS_VALIDAS.includes(categoria as CategoriaGasto)) {
    redirect(`/gastos?error=${encodeURIComponent("Elige una categoría válida")}`);
  }
  if (!concepto) {
    redirect(`/gastos?error=${encodeURIComponent("Falta el concepto del gasto")}`);
  }
  if (!monto || monto <= 0) {
    redirect(`/gastos?error=${encodeURIComponent("El monto debe ser mayor a 0")}`);
  }
  if (!fecha) {
    redirect(`/gastos?error=${encodeURIComponent("Falta la fecha del gasto")}`);
  }

  const { error } = await supabase.from("gastos").insert({
    categoria,
    concepto,
    monto,
    fecha,
    notas,
    creado_por: sesion.id,
  });

  if (error) {
    redirect(`/gastos?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/gastos");
  revalidatePath("/historial");
  redirect(`/gastos?exito=${encodeURIComponent("Gasto registrado")}`);
}

/** Borra un gasto que se registró mal (monto equivocado, duplicado, etc.). */
export async function eliminarGasto(formData: FormData) {
  await exigirAdministrador();
  const supabase = await createClient();

  const gastoId = String(formData.get("gasto_id") || "");
  await supabase.from("gastos").delete().eq("id", gastoId);

  revalidatePath("/gastos");
  revalidatePath("/historial");
  redirect("/gastos");
}
