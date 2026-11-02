"use client";

import { LogIn } from "lucide-react";
import { entrarComoCobrador } from "./actions";

/**
 * Botón para que Empresa entre a ver y actuar como este cobrador (su panel
 * tal cual, con sus clientes reales) — pensado para revisar o cobrar en su
 * lugar cuando haga falta. Todo lo que se haga desde ahí queda registrado a
 * nombre del cobrador, no de Empresa; hay un botón de "Salir" en el aviso
 * que aparece arriba de /panel mientras esto está activo.
 */
export function EntrarComoCobradorButton({
  cobradorId,
  nombreCobrador,
}: {
  cobradorId: string;
  nombreCobrador: string;
}) {
  return (
    <form
      action={entrarComoCobrador}
      onSubmit={(e) => {
        if (
          !confirm(
            `¿Entrar como ${nombreCobrador}? Vas a ver y actuar en su panel tal cual él — sus pagos, clientes y solicitudes van a quedar registrados a su nombre. Puedes salir cuando quieras desde el aviso que va a aparecer arriba.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="cobrador_id" value={cobradorId} />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border bg-surface-2 hover:bg-surface-3 border-border-strong text-ink"
      >
        <LogIn className="h-3.5 w-3.5" />
        Entrar como {nombreCobrador.trim().split(/\s+/)[0] ?? nombreCobrador}
      </button>
    </form>
  );
}
