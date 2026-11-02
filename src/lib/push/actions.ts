"use server";

import { createClient } from "@/lib/supabase/server";
import { getSesionUsuario } from "@/lib/auth/roles";

export type SuscripcionPushInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/**
 * Guarda (o actualiza si el navegador ya tenía una suscripción con el mismo
 * endpoint) la suscripción push de este dispositivo.
 *
 * OJO: se guarda con el id de la sesión REAL (`impersonadoPor?.id`), nunca
 * con el del cobrador impersonado. El endpoint identifica al DISPOSITIVO
 * (navegador), no a quién se está viendo en la app en ese momento — si
 * Empresa activa notificaciones en su propio teléfono mientras está "viendo
 * y actuando como" un cobrador (para probar o configurar), la suscripción
 * de ESE teléfono no debe quedar a nombre del cobrador: seguiría a nombre
 * de Empresa, y el teléfono de Empresa dejaría de recibir avisos de Empresa
 * (y en cambio empezaría a recibir los de ese cobrador) la próxima vez que
 * alguien reactive el push desde ahí.
 */
export async function guardarSuscripcionPush(suscripcion: SuscripcionPushInput, userAgent?: string) {
  const sesion = await getSesionUsuario();
  if (!sesion) return { ok: false as const, error: "No hay sesión" };
  if (!suscripcion?.endpoint || !suscripcion.keys?.p256dh || !suscripcion.keys?.auth) {
    return { ok: false as const, error: "Suscripción inválida" };
  }

  const usuarioId = sesion.impersonadoPor?.id ?? sesion.id;

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscripciones").upsert(
    {
      usuario_id: usuarioId,
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
