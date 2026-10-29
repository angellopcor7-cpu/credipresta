"use client";

import { Landmark, Ban } from "lucide-react";
import { cambiarPuedeDarPrestamos } from "../actions";

/**
 * Switch para dejar a un cobrador cobrar nada más, sin poder dar de alta
 * clientes nuevos ni renovar préstamos — para cuando alguien solo entra a
 * cubrir la ruta de otro cobrador.
 */
export function PuedeDarPrestamosButton({
  cobradorId,
  nombreCobrador,
  puedeDarPrestamos,
}: {
  cobradorId: string;
  nombreCobrador: string;
  puedeDarPrestamos: boolean;
}) {
  return (
    <form
      action={cambiarPuedeDarPrestamos}
      onSubmit={(e) => {
        const mensaje = puedeDarPrestamos
          ? `¿Quitarle a ${nombreCobrador} el permiso de dar préstamos? Va a poder seguir cobrando sus clientes y los que cubra, pero ya no podrá dar de alta clientes nuevos ni renovar préstamos.`
          : `¿Darle a ${nombreCobrador} permiso para dar préstamos de nuevo?`;
        if (!confirm(mensaje)) e.preventDefault();
      }}
    >
      <input type="hidden" name="cobrador_id" value={cobradorId} />
      <input type="hidden" name="puede_dar_prestamos" value={puedeDarPrestamos ? "no" : "si"} />
      <button
        type="submit"
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border ${
          puedeDarPrestamos
            ? "bg-surface-2 hover:bg-surface-3 border-border-strong text-ink"
            : "bg-accent-chip-bg/60 hover:bg-amber-900 border-accent-chip-border text-accent-text"
        }`}
      >
        {puedeDarPrestamos ? <Ban className="h-3.5 w-3.5" /> : <Landmark className="h-3.5 w-3.5" />}
        {puedeDarPrestamos ? "Quitar permiso de dar préstamos" : "Dar permiso de dar préstamos"}
      </button>
    </form>
  );
}
