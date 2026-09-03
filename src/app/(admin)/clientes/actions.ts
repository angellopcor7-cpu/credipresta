"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirAdministrador } from "@/lib/auth/roles";
import type { TipoDocumento } from "@/lib/types";

const TIPOS_DOCUMENTO_FORM: { campo: string; tipo: TipoDocumento }[] = [
  { campo: "doc_ine_frente", tipo: "ine_frente" },
  { campo: "doc_ine_reverso", tipo: "ine_reverso" },
  { campo: "doc_comprobante_domicilio", tipo: "comprobante_domicilio" },
  { campo: "doc_foto_cliente", tipo: "foto_cliente" },
  { campo: "doc_contrato_pagare", tipo: "contrato_pagare" },
];

export async function crearCliente(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();

  const rutaId = String(formData.get("ruta_id") || "");

  const { data: cliente, error } = await supabase
    .from("clientes")
    .insert({
      nombre_completo: String(formData.get("nombre_completo")),
      telefono: String(formData.get("telefono") || "") || null,
      direccion: String(formData.get("direccion") || "") || null,
      identificacion: String(formData.get("identificacion") || "") || null,
      referencia_personal: String(formData.get("referencia_personal") || "") || null,
      notas: String(formData.get("notas") || "") || null,
      estado: "activo",
      creado_por: sesion.id,
    })
    .select("id")
    .single();

  if (error || !cliente) {
    redirect(`/clientes/nuevo?error=${encodeURIComponent(error?.message || "No se pudo crear el cliente")}`);
  }

  // Documentos (opcionales, hasta 10MB cada uno — reforzado también por el bucket)
  for (const { campo, tipo } of TIPOS_DOCUMENTO_FORM) {
    const archivo = formData.get(campo) as File | null;
    if (archivo && archivo.size > 0) {
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
  }

  // Asignación inicial a una ruta (opcional)
  if (rutaId) {
    const { data: ruta } = await supabase.from("rutas").select("cobrador_id").eq("id", rutaId).single();
    if (ruta?.cobrador_id) {
      await supabase.from("asignaciones").insert({
        cliente_id: cliente.id,
        ruta_id: rutaId,
        cobrador_id: ruta.cobrador_id,
        asignado_por: sesion.id,
      });
    }
  }

  await supabase.from("historial_movimientos").insert({
    cliente_id: cliente.id,
    usuario_id: sesion.id,
    tipo_movimiento: "creacion_cliente",
    descripcion: `Cliente ${formData.get("nombre_completo")} registrado`,
  });

  revalidatePath("/clientes");
  redirect("/clientes");
}
