"use server";

import { createClient } from "@/lib/supabase/server";
import { getSesionUsuario } from "@/lib/auth/roles";

export type SuscripcionPushInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** Guarda (o actualiza si el navegador ya tenía una suscripción con el mismo endpoint) la suscripción push del usuario en sesión. */
export async function guardarSuscripcionPush(suscripcion: SuscripcionPushInput, userAgent?: string) {
  const sesion = await getSesionUsuario();
  if (!sesion) return { ok: false as const, error: "No hay sesión" };
  if (!suscripcion?.endpoint || !suscripcion.keys?.p256dh || !suscripcion.keys?.auth) {
    return { ok: false as const, error: "Suscripción inválida" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscripciones").upsert(
    {
      usuario_id: sesion.id,
      endpoint: suscripcion.endpoint,
      p256dh: suscripcion.keys.p256dh,
      auth: suscripcion.keys.auth,
      user_agent: userAgent?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" }
  );

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

/** Borra la suscripción de este navegador (se llama al desactivar notificaciones, o si el navegador reporta que ya no es válida). */
export async function borrarSuscripcionPush(endpoint: string) {
  const sesion = await getSesionUsuario();
  if (!sesion || !endpoint) return { ok: false as const };

  const supabase = await createClient();
  await supabase.from("push_subscripciones").delete().eq("endpoint", endpoint);
  return { ok: true as const };
}
