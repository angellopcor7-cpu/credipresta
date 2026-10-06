"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { agregarRutaACobrador } from "../actions";

/** Botón "+ Nueva ruta" chiquito para agregarle una ruta a este cobrador sin salir de su ficha. */
export function AgregarRutaForm({ cobradorId }: { cobradorId: string }) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1 text-xs text-accent-text hover:underline"
      >
        <Plus className="h-3 w-3" />
        Nueva ruta
      </button>
    );
  }

  return (
    <form action={agregarRutaACobrador} className="flex items-center gap-2">
      <input type="hidden" name="cobrador_id" value={cobradorId} />
      <input
        name="nombre"
        placeholder="Nombre de la ruta"
        required
        autoFocus
        className="rounded-md bg-surface-2 border border-border-strong px-2 py-1.5 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      <button type="submit" className="text-xs bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold rounded-md px-3 py-1.5">
        Guardar
      </button>
      <button type="button" onClick={() => setAbierto(false)} className="text-ink-muted hover:text-ink">
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}
