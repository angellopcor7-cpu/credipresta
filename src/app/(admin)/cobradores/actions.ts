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
