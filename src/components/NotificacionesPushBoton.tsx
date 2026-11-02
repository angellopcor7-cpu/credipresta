"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { guardarSuscripcionPush, borrarSuscripcionPush } from "@/lib/push/actions";

type Estado = "cargando" | "no_soportado" | "inactivo" | "activo" | "bloqueado";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Segura = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(base64Segura);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/**
 * Botón de "Activar notificaciones": pide permiso al navegador y suscribe
 * este dispositivo a notificaciones push de verdad (le llegan aunque tenga
 * la pestaña o la app cerrada) — avisos de nuevas solicitudes (a Empresa) y
 * de que su solicitud fue aprobada/rechazada (al cobrador). Si el
 * navegador no soporta push (o no hay llave VAPID configurada todavía), el
 * botón simplemente no aparece.
 */
export function NotificacionesPushBoton() {
  const [estado, setEstado] = useState<Estado>(() => {
    if (typeof window === "undefined") return "cargando";
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return "no_soportado";
    }
    if (Notification.permission === "denied") {
      return "bloqueado";
    }
    return "cargando";
  });

  useEffect(() => {
    if (estado !== "cargando") return;
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registro) => registro.pushManager.getSubscription())
      .then((suscripcion) => setEstado(suscripcion ? "activo" : "inactivo"))
      .catch(() => setEstado("inactivo"));
  }, [estado]);

  async function activar() {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) return;

    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") {
      setEstado(permiso === "denied" ? "bloqueado" : "inactivo");
      return;
    }

    try {
      const registro = await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const json = suscripcion.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
      if (json.endpoint && json.keys) {
        await guardarSuscripcionPush({ endpoint: json.endpoint, keys: json.keys }, navigator.userAgent);
        setEstado("activo");
      }
    } catch {
      setEstado("inactivo");
    }
  }

  async function desactivar() {
    try {
      const registro = await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.getSubscription();
      if (suscripcion) {
        await borrarSuscripcionPush(suscripcion.endpoint);
        await suscripcion.unsubscribe();
      }
    } finally {
      setEstado("inactivo");
    }
  }

  if (estado === "cargando" || estado === "no_soportado") return null;

  if (estado === "bloqueado") {
    return (
      <span
        className="inline-flex items-center gap-1 text-ink-muted text-xs"
        title="Bloqueaste las notificaciones de CrediPresta en tu navegador — para activarlas, cambia el permiso de notificaciones de este sitio desde la configuración del navegador."
      >
        <BellOff className="h-4 w-4" />
      </span>
    );
  }

  if (estado === "activo") {
    return (
      <button
        type="button"
        onClick={desactivar}
        className="inline-flex items-center gap-1.5 text-accent-text hover:text-ink-muted text-xs"
        title="Notificaciones activadas — clic para desactivarlas en este dispositivo"
      >
        <BellRing className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={activar}
      className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink text-xs"
      title="Activar notificaciones en este dispositivo"
    >
      <Bell className="h-4 w-4" />
    </button>
  );
}
