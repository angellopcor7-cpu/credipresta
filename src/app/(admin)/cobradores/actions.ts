"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirAdministrador } from "@/lib/auth/roles";

/**
 * Crea la cuenta de un cobrador nuevo: usuario en Supabase Auth (con la
 * llave service_role, porque un admin creando la cuenta de otra persona no
 * es un "signUp" normal), su fila en `usuarios` con rol=cobrador, y su fila
 * en `cobradores`. Si algo falla a medio camino, se intenta deshacer lo ya
 * creado para no dejar cuentas huérfanas.
 */
export async function crearCobrador(formData: FormData) {
  const sesion = await exigirAdministrador();

  const nombreCompleto = String(formData.get("nombre_completo") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const telefono = String(formData.get("telefono") || "").trim() || null;
  const zona = String(formData.get("zona") || "").trim() || null;
  const password = String(formData.get("password") || "");

  if (!nombreCompleto || !email || password.length < 6) {
    redirect(
      `/cobradores/nuevo?error=${encodeURIComponent(
        "Nombre, correo y una contraseña de al menos 6 caracteres son obligatorios"
      )}`
    );
  }

  const admin = createAdminClient();

  const { data: nuevoUsuario, error: errorAuth } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (errorAuth || !nuevoUsuario.user) {
    redirect(`/cobradores/nuevo?error=${encodeURIComponent(errorAuth?.message || "No se pudo crear la cuenta")}`);
  }

  const supabase = await createClient();
  const { data: rolCobrador } = await supabase.from("roles").select("id").eq("nombre", "cobrador").single();

  const { error: errorUsuario } = await admin.from("usuarios").insert({
    id: nuevoUsuario.user.id,
    nombre_completo: nombreCompleto,
    telefono,
    rol_id: rolCobrador?.id,
    activo: true,
  });

  if (errorUsuario) {
    await admin.auth.admin.deleteUser(nuevoUsuario.user.id);
    redirect(`/cobradores/nuevo?error=${encodeURIComponent(errorUsuario.message)}`);
  }

  const { error: errorCobrador } = await admin.from("cobradores").insert({
    usuario_id: nuevoUsuario.user.id,
    zona,
    activo: true,
  });

  if (errorCobrador) {
    await admin.auth.admin.deleteUser(nuevoUsuario.user.id);
    redirect(`/cobradores/nuevo?error=${encodeURIComponent(errorCobrador.message)}`);
  }

  await admin.from("historial_movimientos").insert({
    usuario_id: sesion.id,
    tipo_movimiento: "creacion_cobrador",
    descripcion: `Se creó la cuenta de cobrador para ${nombreCompleto} (${email})`,
  });

  revalidatePath("/cobradores");
  redirect("/cobradores");
}

/** Corrige nombre/teléfono (tabla `usuarios`) y zona (tabla `cobradores`) de un cobrador ya existente. */
export async function actualizarCobrador(formData: FormData) {
  await exigirAdministrador();
  const supabase = await createClient();

  const cobradorId = String(formData.get("cobrador_id") || "");
  const usuarioId = String(formData.get("usuario_id") || "");
  const nombreCompleto = String(formData.get("nombre_completo") || "").trim();
  const telefono = String(formData.get("telefono") || "").trim() || null;
  const zona = String(formData.get("zona") || "").trim() || null;

  if (!nombreCompleto) {
    redirect(`/cobradores/${cobradorId}?error=${encodeURIComponent("El nombre es obligatorio")}`);
  }

  const { error: errorUsuario } = await supabase
    .from("usuarios")
    .update({ nombre_completo: nombreCompleto, telefono })
    .eq("id", usuarioId);

  if (errorUsuario) {
    redirect(`/cobradores/${cobradorId}?error=${encodeURIComponent(errorUsuario.message)}`);
  }

  const { error: errorCobrador } = await supabase.from("cobradores").update({ zona }).eq("id", cobradorId);

  if (errorCobrador) {
    redirect(`/cobradores/${cobradorId}?error=${encodeURIComponent(errorCobrador.message)}`);
  }

  revalidatePath("/cobradores");
  revalidatePath(`/cobradores/${cobradorId}`);
  redirect(`/cobradores/${cobradorId}?exito=${encodeURIComponent("Datos actualizados")}`);
}

/**
 * Activa o desactiva a un cobrador de un jalón: `usuarios.activo` (le
 * bloquea/permite iniciar sesión) y `cobradores.activo` (lo saca/mete de la
 * lista de elegibles para nuevas rutas y de los conteos del panel). No borra
 * ni reasigna nada de su historial, clientes o préstamos.
 */
export async function cambiarEstadoCobrador(formData: FormData) {
  await exigirAdministrador();
  const supabase = await createClient();

  const cobradorId = String(formData.get("cobrador_id") || "");
  const usuarioId = String(formData.get("usuario_id") || "");
  const nuevoEstado = String(formData.get("nuevo_estado") || "") === "activar";

  const { error: errorCobrador } = await supabase
    .from("cobradores")
    .update({ activo: nuevoEstado })
    .eq("id", cobradorId);

  if (errorCobrador) {
    redirect(`/cobradores/${cobradorId}?error=${encodeURIComponent(errorCobrador.message)}`);
  }

  const { error: errorUsuario } = await supabase
    .from("usuarios")
    .update({ activo: nuevoEstado })
    .eq("id", usuarioId);

  if (errorUsuario) {
    redirect(`/cobradores/${cobradorId}?error=${encodeURIComponent(errorUsuario.message)}`);
  }

  revalidatePath("/cobradores");
  revalidatePath(`/cobradores/${cobradorId}`);
  redirect(
    `/cobradores/${cobradorId}?exito=${encodeURIComponent(
      nuevoEstado ? "Cobrador reactivado" : "Cobrador desactivado"
    )}`
  );
}

/** Le pone una contraseña nueva a la cuenta de acceso del cobrador (requiere la llave service_role). */
export async function restablecerPasswordCobrador(formData: FormData) {
  await exigirAdministrador();

  const cobradorId = String(formData.get("cobrador_id") || "");
  const usuarioId = String(formData.get("usuario_id") || "");
  const password = String(formData.get("password") || "");

  if (password.length < 6) {
    redirect(
      `/cobradores/${cobradorId}?error=${encodeURIComponent("La contraseña debe tener al menos 6 caracteres")}`
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(usuarioId, { password });

  if (error) {
    redirect(`/cobradores/${cobradorId}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/cobradores/${cobradorId}?exito=${encodeURIComponent("Contraseña actualizada")}`);
}
