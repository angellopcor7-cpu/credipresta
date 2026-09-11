"use client";

import { UserRoundX, UserRoundCheck } from "lucide-react";
import { cambiarEstadoCobrador } from "../actions";

/**
 * Activa/desactiva al cobrador de un jalón: desactivarlo le bloquea el
 * inicio de sesión (usuarios.activo) y lo saca de la lista de elegibles
 * para nuevas rutas (cobradores.activo). No borra nada de su historial.
 */
export function EstadoCobradorButton({
  cobradorId,
  usuarioId,
  nombreCobrador,
  activo,
}: {
  cobradorId: string;
  usuarioId: string;
  nombreCobrador: string;
  activo: boolean;
}) {
  return (
    <form
      action={cambiarEstadoCobrador}
      onSubmit={(e) => {
        const mensaje = activo
          ? `¿Desactivar a ${nombreCobrador}? Ya no podrá iniciar sesión ni se le podrán asignar nuevas rutas. Sus clientes y préstamos no se ven afectados.`
          : `¿Reactivar a ${nombreCobrador}?`;
        if (!confirm(mensaje)) e.preventDefault();
      }}
    >
      <input type="hidden" name="cobrador_id" value={cobradorId} />
      <input type="hidden" name="usuario_id" value={usuarioId} />
      <input type="hidden" name="nuevo_estado" value={activo ? "desactivar" : "activar"} />
      <button
        type="submit"
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border ${
          activo
            ? "bg-red-950/60 hover:bg-red-900 border-red-900 text-red-300"
            : "bg-emerald-950/60 hover:bg-emerald-900 border-emerald-900 text-emerald-300"
        }`}
      >
        {activo ? <UserRoundX className="h-3.5 w-3.5" /> : <UserRoundCheck className="h-3.5 w-3.5" />}
        {activo ? "Desactivar cobrador" : "Reactivar cobrador"}
      </button>
    </form>
  );
}
