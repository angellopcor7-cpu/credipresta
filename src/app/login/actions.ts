"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { enviarPushAUsuario } from "@/lib/push/enviar";

/** Lee "Chrome en Android", "Safari en iPhone", etc. de un User-Agent, sin meter una librería completa solo para esto. */
function navegadorYDispositivo(userAgent: string | null): string {
  if (!userAgent) return "dispositivo desconocido";

  const navegador = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /CriOS/.test(userAgent)
          ? "Chrome"
          : /Firefox\//.test(userAgent)
            ? "Firefox"
            : /Safari\//.test(userAgent)
              ? "Safari"
              : "un navegador";

  const dispositivo = /iPhone/.test(userAgent)
    ? "iPhone"
    : /iPad/.test(userAgent)
      ? "iPad"
      : /Android/.test(userAgent)
        ? "Android"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Macintosh/.test(userAgent)
            ? "Mac"
            : "un dispositivo";

  return `${navegador} en ${dispositivo}`;
}

/**
 * Solo login — no hay auto-registro público. Las cuentas de cobradores las
 * crea un administrador desde el panel (ver /cobradores/nuevo), y el primer
 * administrador se creó directamente en la base de datos.
 */
export async function signIn(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent("Correo o contraseña incorrectos")}`);
  }

  // Aviso de seguridad: "se inició sesión aquí" — a quién le tocó (Empresa o
  // cobrador) se lee directo de `usuarios`, sin pasar por getSesionUsuario
  // (que puede traer una sesión "impersonada" por una cookie vieja que no
  // aplica en este momento del login). Nunca bloquea el login si falla.
  if (user) {
    const { data: perfil } = await supabase
      .from("usuarios")
      .select("roles(nombre)")
      .eq("id", user.id)
      .maybeSingle();
    const rolNombre = (perfil?.roles as unknown as { nombre: string } | null)?.nombre;
    const vista = rolNombre === "administrador" ? "Empresa" : "cobrador";

    const encabezados = await headers();
    const dispositivo = navegadorYDispositivo(encabezados.get("user-agent"));
    const fechaHora = new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Mexico_City",
    }).format(new Date());

    await enviarPushAUsuario(user.id, {
      title: "Inicio de sesión",
      body: `Se inició sesión en ${vista} — ${dispositivo}, ${fechaHora}`,
    });
  }

  redirect("/dashboard");
}
