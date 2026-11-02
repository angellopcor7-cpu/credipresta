import { Bell, BellOff } from "lucide-react";
import { abrirNotificacion, marcarTodasLeidas } from "@/lib/notificaciones/actions";

export type NotificacionItem = {
  id: string;
  titulo: string;
  cuerpo: string;
  url: string | null;
  leida: boolean;
  created_at: string;
};

function formatoFecha(iso: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

/**
 * Lista de notificaciones (historial en-app de los avisos que también se
 * mandan como push) — la misma vista sirve tanto para Empresa
 * (`/notificaciones` en el panel de admin) como para cada cobrador
 * (`/notificaciones` en su panel): cada quien solo ve las suyas, filtradas
 * server-side por RLS/consulta antes de llegar aquí.
 */
export function NotificacionesLista({ notificaciones, volverA }: { notificaciones: NotificacionItem[]; volverA: string }) {
  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  if (notificaciones.length === 0) {
    return (
      <div className="border border-border rounded-xl p-8 text-center text-ink-muted">
        <BellOff className="h-8 w-8 mx-auto mb-3 opacity-50" />
        <p>Todavía no tienes notificaciones.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {noLeidas > 0 && (
        <form action={marcarTodasLeidas} className="flex justify-end">
          <input type="hidden" name="volver_a" value={volverA} />
          <button
            type="submit"
            className="text-xs font-medium text-accent-text hover:text-ink-muted border border-border-strong rounded-full px-3 py-1.5"
          >
            Marcar todas como leídas ({noLeidas})
          </button>
        </form>
      )}
      <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
        {notificaciones.map((n) => (
          <form key={n.id} action={abrirNotificacion}>
            <input type="hidden" name="id" value={n.id} />
            <input type="hidden" name="url" value={n.url ?? ""} />
            <button
              type="submit"
              className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-surface-2 ${
                n.leida ? "bg-page" : "bg-amber-500/5"
              }`}
            >
              <Bell className={`h-4 w-4 mt-0.5 shrink-0 ${n.leida ? "text-ink-muted" : "text-accent-text"}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${n.leida ? "text-ink-secondary" : "font-semibold text-ink"}`}>{n.titulo}</p>
                <p className="text-sm text-ink-secondary mt-0.5">{n.cuerpo}</p>
                <p className="text-xs text-ink-muted mt-1">{formatoFecha(n.created_at)}</p>
              </div>
              {!n.leida && <span className="mt-1.5 h-2 w-2 rounded-full bg-accent-text shrink-0" />}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
