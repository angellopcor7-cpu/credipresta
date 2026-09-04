"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirCliente } from "@/lib/auth/roles";
import type { TipoDocumento } from "@/lib/types";

const DOCUMENTOS_REGISTRO: { campo: string; tipo: TipoDocumento; etiqueta: string }[] = [
  { campo: "doc_ine_frente", tipo: "ine_frente", etiqueta: "INE — frente" },
  { campo: "doc_ine_reverso", tipo: "ine_reverso", etiqueta: "INE — reverso" },
  { campo: "doc_comprobante_domicilio", tipo: "comprobante_domicilio", etiqueta: "Comprobante de domicilio" },
  { campo: "doc_foto_cliente", tipo: "foto_cliente", etiqueta: "Foto tuya" },
];

/**
 * Registro libre de cliente: cualquiera puede crear su cuenta con correo y
 * contraseña, y sube sus documentos (INE, comprobante, foto) desde el
 * primer momento. Un trigger en la base de datos (handle_new_cliente_signup)
 * detecta `tipo_cuenta: "cliente"` en los metadatos y crea automáticamente
 * su fila en `usuarios` (rol cliente) y en `clientes` — no hace falta que
 * un admin lo dé de alta primero.
 *
 * Los documentos se suben con el cliente admin (service_role) porque, si el
 * proyecto tiene confirmación de correo activada, todavía no hay sesión
 * iniciada justo después de crear la cuenta y las políticas normales (RLS)
 * no dejarían subir nada sin sesión.
 */
export async function registrarCliente(formData: FormData) {
  const nombreCompleto = String(formData.get("nombre_completo") || "").trim();
  const telefono = String(formData.get("telefono") || "").trim();
  const direccion = String(formData.get("direccion") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const confirmarPassword = String(formData.get("confirmar_password") || "");

  if (!nombreCompleto || !email || password.length < 6) {
    redirect(
      `/cliente/registro?error=${encodeURIComponent(
        "Nombre, correo y una contraseña de al menos 6 caracteres son obligatorios"
      )}`
    );
  }
  if (password !== confirmarPassword) {
    redirect(`/cliente/registro?error=${encodeURIComponent("Las contraseñas no coinciden")}`);
  }
  for (const { campo, etiqueta } of DOCUMENTOS_REGISTRO) {
    const archivo = formData.get(campo) as File | null;
    if (!archivo || archivo.size === 0) {
      redirect(`/cliente/registro?error=${encodeURIComponent(`Falta subir: ${etiqueta}`)}`);
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        tipo_cuenta: "cliente",
        nombre_completo: nombreCompleto,
        telefono: telefono || null,
        direccion: direccion || null,
      },
    },
  });

  if (error) {
    redirect(`/cliente/registro?error=${encodeURIComponent(error.message)}`);
  }

  // El trigger handle_new_cliente_signup ya creó la fila en `clientes` como
  // parte del mismo insert en auth.users, así que ya existe aquí.
  const admin = createAdminClient();
  const { data: cliente } = await admin
    .from("clientes")
    .select("id")
    .eq("usuario_id", data.user!.id)
    .maybeSingle();

  if (cliente) {
    for (const { campo, tipo } of DOCUMENTOS_REGISTRO) {
      const archivo = formData.get(campo) as File;
      const rutaArchivo = `${cliente.id}/${tipo}/${Date.now()}-${archivo.name}`;
      const { error: errorSubida } = await admin.storage
        .from("documentos-clientes")
        .upload(rutaArchivo, archivo, { contentType: archivo.type });

      if (!errorSubida) {
        await admin.from("documentos_clientes").insert({
          cliente_id: cliente.id,
          tipo_documento: tipo,
          storage_path: rutaArchivo,
          subido_por: data.user!.id,
        });
      }
    }
  }

  if (!data.session) {
    // El proyecto tiene confirmación de correo activada: la cuenta se creó
    // pero todavía no puede iniciar sesión hasta que confirme el correo.
    redirect("/cliente/login?mensaje=" + encodeURIComponent("Revisa tu correo para confirmar tu cuenta y luego inicia sesión."));
  }

  redirect("/cliente");
}

/** Login de cliente — igual que el de negocio, pero regresa los errores a /cliente/login en vez de /login. */
export async function iniciarSesionCliente(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/cliente/login?error=${encodeURIComponent("Correo o contraseña incorrectos")}`);
  }

  redirect("/cliente");
}

/** El cliente pide un préstamo: queda como solicitud pendiente hasta que un administrador la revise y apruebe. Sus documentos ya quedaron subidos al crear su cuenta. */
export async function crearSolicitudPrestamo(formData: FormData) {
  const sesion = await exigirCliente();
  const supabase = await createClient();

  const montoSolicitado = Number(formData.get("monto_solicitado"));
  const plazoDias = Number(formData.get("plazo_dias"));

  if (!montoSolicitado || montoSolicitado <= 0) {
    redirect(`/cliente/solicitar?error=${encodeURIComponent("El monto debe ser mayor a 0")}`);
  }
  if (!plazoDias || plazoDias <= 0) {
    redirect(`/cliente/solicitar?error=${encodeURIComponent("El plazo en días debe ser mayor a 0")}`);
  }

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id")
    .eq("usuario_id", sesion.id)
    .maybeSingle();

  if (!cliente) {
    redirect(`/cliente/solicitar?error=${encodeURIComponent("No se encontró tu perfil de cliente")}`);
  }

  const { error } = await supabase.from("solicitudes_prestamo").insert({
    cliente_id: cliente!.id,
    monto_solicitado: montoSolicitado,
    plazo_dias: plazoDias,
  });

  if (error) {
    redirect(`/cliente/solicitar?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/cliente");
  redirect("/cliente?exito=" + encodeURIComponent("Tu solicitud fue enviada. Un administrador la va a revisar."));
}
