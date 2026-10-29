"use client";

import { useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { solicitarPagoExtra } from "../../../actions";

/**
 * "Pagó varios días": el cobrador ya no puede aplicar él mismo más de un
 * día de cuota (eso quedó solo en el botón normal de "Aplicar pago del
 * día"). Si el cliente paga el doble, el triple, etc., esto manda una
 * solicitud a Empresa con cuántos días EXTRA pagó — ella decide si los
 * acepta tal cual o los rechaza.
 */
export function PedirPagoExtraForm({ prestamoId }: { prestamoId: string }) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 text-sm bg-surface-2 hover:bg-surface-3 border border-border-strong text-ink font-medium rounded-md px-4 py-2.5"
      >
        <CalendarPlus className="h-4 w-4" />
        ¿Pagó más de un día?
      </button>
    );
  }

  return (
    <form
      action={solicitarPagoExtra}
      className="animate-panel-in space-y-2 bg-surface border border-border rounded-xl p-4 max-w-md w-full"
    >
      <input type="hidden" name="prestamo_id" value={prestamoId} />
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">¿Pagó más de un día?</h3>
        <button type="button" onClick={() => setAbierto(false)} className="text-ink-muted hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-ink-muted">
        Esto no se aplica todavía — le manda la solicitud a Empresa y ella decide si acepta esos días extra. El día
        de hoy se aplica aparte con el botón normal de &ldquo;Aplicar pago del día&rdquo;.
      </p>
      <div>
        <label className="text-xs text-ink-secondary" htmlFor="dias_extra">
          ¿Cuántos días EXTRA pagó? (sin contar el de hoy)
        </label>
        <input
          id="dias_extra"
          name="dias_extra"
          type="number"
          min="1"
          step="1"
          max="30"
          defaultValue={1}
          required
          className="mt-1 w-24 rounded-md bg-surface-2 border border-border-strong px-2 py-1.5 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>
      <textarea
        name="notas"
        placeholder="Por qué pagó de más (opcional)"
        rows={2}
        className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      <button className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold rounded-md py-2 text-sm">
        Mandar solicitud
      </button>
    </form>
  );
}
