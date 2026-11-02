import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Notificaciones push de verdad (le llegan aunque tenga la pestaña/app
 * cerrada) — usan las llaves VAPID configuradas en Vercel:
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY (pública, también la usa el navegador para
 * suscribirse) y VAPID_PRIVATE_KEY (solo servidor). Si no están puestas
 * todavía, se desactiva en silencio (no revienta el flujo que la dispara —
 * aprobar un préstamo no debe fallar porque la notificación no se pudo
 * mandar).
 */
function vapidConfigurado() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configurado = false;
function asegurarVapid() {
  if (configurado || !vapidConfigurado()) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:soporte@credipresta.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configurado = true;
}

export type PayloadPush = { title: string; body: string; url?: string };

/**
 * Manda un aviso a un usuario: SIEMPRE lo guarda en `notificaciones` (lo
 * que llena la pestaña "Notificaciones" dentro de la app, sin depender de
 * nada más), y ADEMÁS lo manda como push de verdad a todas sus
 * suscripciones (navegadores/dispositivos) si las llaves VAPID ya están
 * configuradas. Borra solas las suscripciones que ya expiraron.
 */
export async function enviarPushAUsuario(usuarioId: string, payload: PayloadPush) {
  const admin = createAdminClient();

  await admin.from("notificaciones").insert({
    usuario_id: usuarioId,
    titulo: payload.title,
    cuerpo: payload.body,
    url: payload.url ?? null,
  });

  if (!vapidConfigurado()) return;
  asegurarVapid();

  const { data: suscripciones } = await admin
    .from("push_subscripciones")
    .select("id, endpoint, p256dh, auth")
    .eq("usuario_id", usuarioId);

  if (!suscripciones || suscripciones.length === 0) return;

  await Promise.all(
    suscripciones.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err) {
        // 404/410 = la suscripción ya no existe del lado del navegador (desinstaló, limpió datos, etc.) — se borra sola.
        const status = (err as { statusCode?: number } | null)?.statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscripciones").delete().eq("id", sub.id);
        }
      }
    })
  );
}

/** Manda el mismo aviso (notificación en-app + push) a todos los administradores activos (Empresa). */
export async function enviarPushAEmpresa(payload: PayloadPush) {
  const admin = createAdminClient();
  const { data: administradores } = await admin
    .from("usuarios")
    .select("id, roles!inner(nombre)")
    .eq("roles.nombre", "administrador")
    .eq("activo", true);

  await Promise.all((administradores ?? []).map((a) => enviarPushAUsuario(a.id, payload)));
}
