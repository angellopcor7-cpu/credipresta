import { TestTube2 } from "lucide-react";
import { enviarNotificacionDePrueba } from "@/lib/notificaciones/actions";

/**
 * Botón rápido para probar que las notificaciones quedaron bien
 * configuradas: manda un aviso de prueba a quien le dio clic (push +
 * en-app) y lo manda a su pestaña de Notificaciones a verlo. Si activaste
 * el push en este dispositivo, también debería sonar/aparecer como
 * notificación real del navegador.
 */
export function ProbarNotificacionBoton() {
  return (
    <form action={enviarNotificacionDePrueba}>
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink text-xs"
        title="Mandarme una notificación de prueba (push + en-app)"
      >
        <TestTube2 className="h-4 w-4" />
        <span className="hidden sm:inline">Probar</span>
      </button>
    </form>
  );
}
