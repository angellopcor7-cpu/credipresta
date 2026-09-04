"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirCliente } from "@/lib/auth/roles";

/**
 * Registro libre de cliente: cualquiera puede crear su cuenta con correo y
 * contraseña. Un trigger en la base de datos (handle_new_cliente_signup)
 * detecta `tipo_cuenta: "cliente"` en los metadatos y crea automáticamente
 * su fila en `usuarios` (rol cliente) y en `clientes` — no hace falta que
 * un admin lo dé de alta primero.
 */
export async function registrarCliente(formData: FormData) {
  const nombreCompleto = String(formData.get("nombre_completo") || "").trim();
  const telefono = String(formData.get("telefono") || "").trim();
  const direccion = String(formData.get("direccion") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!nombreCompleto || !email || password.length < 6) {
    redirect(
      `/cliente/registro?error=${encodeURIComponent(
        "Nombre, correo y una contraseña de al menos 6 caracteres son obligatorios"
      )}`
    );
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

/** El cliente pide un préstamo: queda como solicitud pendiente hasta que un administrador la revise y apruebe. */
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
