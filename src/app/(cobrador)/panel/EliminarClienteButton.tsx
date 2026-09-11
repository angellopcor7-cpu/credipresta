"use client";

import { Trash2 } from "lucide-react";
import { eliminarClienteRechazado } from "../actions";

/**
 * Botón para quitar de la lista a un cliente cuya solicitud ya rechazó
 * Empresa. Pide confirmación porque es un borrado permanente (se van sus
 * documentos también) — no es reversible desde la app.
 */
export function EliminarClienteButton({ clienteId, nombreCliente }: { clienteId: string; nombreCliente: string }) {
  return (
    <form
      action={eliminarClienteRechazado}
      onSubmit={(e) => {
        if (!confirm(`¿Eliminar a ${nombreCliente}? Esto borra sus documentos y no se puede deshacer.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="cliente_id" value={clienteId} />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 text-xs bg-red-950/60 hover:bg-red-900 border border-red-900 text-red-300 font-medium px-3 py-1.5 rounded-md"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Eliminar
      </button>
    </form>
  );
}
