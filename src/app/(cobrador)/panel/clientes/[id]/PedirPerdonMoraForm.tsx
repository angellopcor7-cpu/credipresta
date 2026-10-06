"use client";

import { useState } from "react";
import { HeartHandshake, X } from "lucide-react";
import { solicitarPerdonMora } from "../../../actions";

/**
 * "Pedir perdón de mora": el cobrador no decide cuánto se perdona, solo
 * manda la solicitud — Empresa la revisa en /solicitudes y decide cuánto
 * perdonar o la rechaza. Solo se muestra desde el 2º día de atraso (lo
 * controla la página que lo renderiza).
 */
export function PedirPerdonMoraForm({ prestamoId }: { prestamoId: string }) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 text-sm bg-surface-2 hover:bg-surface-3 border border-border-strong text-ink font-medium rounded-md px-4 py-2.5"
      >
        <HeartHandshake className="h-4 w-4" />
        Pedir perdón de mora
      </button>
    );
  }

  return (
    <form
      action={solicitarPerdonMora}
      className="space-y-2 bg-surface border border-border rounded-xl p-4 max-w-md w-full"
    >
      <input type="hidden" name="prestamo_id" value={prestamoId} />
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Pedir perdón de mora</h3>
        <button type="button" onClick={() => setAbierto(false)} className="text-ink-muted hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-ink-muted">
        Esto no perdona la mora todavía — le manda la solicitud a Empresa y ella decide cuánto perdonar.
      </p>
      <textarea
        name="notas"
        placeholder="Por qué se pide (opcional)"
        rows={2}
        className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      <button className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold rounded-md py-2 text-sm">
        Mandar solicitud
      </button>
    </form>
  );
}
