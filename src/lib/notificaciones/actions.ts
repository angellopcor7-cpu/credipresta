"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSesionUsuario } from "@/lib/auth/roles";
import { enviarPushAUsuario } from "@/lib/push/enviar";

/**
 * Marca una notificación como leída y manda a quien la abrió a su destino
 * (la ficha del cliente, /solicitudes, etc.) — o de vuelta a la lista de
 * notificaciones si no tiene un destino particular. Un solo action para
 * poder usar un <form> por notificación sin necesitar JavaScript del lado
 * del cliente.
 */
export async function abrirNotificacion(formData: FormData) {
  const sesion = await getSesionUsuario();
  if (!sesion) redirect("/login");

  const id = String(formData.get("id") || "");
  const url = String(formData.get("url") || "") || null;
  // "/notificaciones" es la página de Empresa; los cobradores (y Empresa
  // impersonando a uno) tienen la suya en "/panel/notificaciones" — las
  // páginas de admin y cobrador no pueden compartir la misma URL.
  const rutaNotificaciones = sesion.rol === "administrador" ? "/notificaciones" : "/panel/notificaciones";

  const supabase = await createClient();
  await supabase.from("notificaciones").update({ leida: true }).eq("id", id).eq("usuario_id", sesion.id);

  redirect(url || rutaNotificaciones);
}

/** Marca TODAS las notificaciones del usuario actual como leídas, sin salir de la página. */
export async function marcarTodasLeidas(formData: FormData) {
  const sesion = await getSesionUsuario();
  if (!sesion) redirect("/login");
  const rutaNotificaciones = sesion.rol === "administrador" ? "/notificaciones" : "/panel/notificaciones";

  const supabase = await createClient();
  await supabase.from("notificaciones").update({ leida: true }).eq("usuario_id", sesion.id).eq("leida", false);

  const volverA = String(formData.get("volver_a") || rutaNotificaciones);
  revalidatePath(volverA);
  redirect(volverA);
}

/**
 * Botón de "Probar notificación": se manda un aviso de prueba a sí mismo
 * (queda en la pestaña de Notificaciones y, si ya activó el push en este
 * dispositivo, también le debe llegar como notificación de verdad) — para
 * confirmar de un clic que las llaves VAPID y el resto quedaron bien
 * configurados, sin tener que esperar a que pase algo real en la app.
 */
export async function enviarNotificacionDePrueba() {
  const sesion = await getSesionUsuario();
  if (!sesion) redirect("/login");

  await enviarPushAUsuario(sesion.id, {
    title: "Notificación de prueba",
    body: "Si ves esto aquí (y te llegó como push, si ya lo activaste), todo está funcionando ✅",
  });

  const rutaNotificaciones = sesion.rol === "administrador" ? "/notificaciones" : "/panel/notificaciones";
  revalidatePath(rutaNotificaciones);
  redirect(rutaNotificaciones);
}
