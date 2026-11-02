"use client";

import { useState } from "react";
import { Coins, X } from "lucide-react";
import { solicitarPagoPersonalizado } from "../../../actions";

/**
 * "Insertar pago personalizado": para cuando el cliente paga una cantidad
 * que no corresponde a días completos de cuota (p. ej. abonó $350 y su
 * cuota diaria es $200). Igual que con "¿Pagó más de un día?", esto NO se
 * aplica directo — manda la cantidad exacta a Empresa y ella decide si la
 * aprueba o la rechaza.
 */
export function PedirPagoPersonalizadoForm({ prestamoId }: { prestamoId: string }) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 text-sm bg-surface-2 hover:bg-surface-3 border border-border-strong text-ink font-medium rounded-md px-4 py-2.5"
      >
        <Coins className="h-4 w-4" />
        Insertar pago personalizado
      </button>
    );
  }

  return (
    <form
      action={solicitarPagoPersonalizado}
      className="animate-panel-in space-y-2 bg-surface border border-border rounded-xl p-4 max-w-md w-full"
    >
      <input type="hidden" name="prestamo_id" value={prestamoId} />
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Insertar pago personalizado</h3>
        <button type="button" onClick={() => setAbierto(false)} className="text-ink-muted hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-ink-muted">
        Para cuando el cliente paga una cantidad que no es un número exacto de días (p. ej. $350 con cuota de $200).
        Esto tampoco se aplica todavía — le manda la cantidad a Empresa y ella decide si la aprueba.
      </p>
      <div>
        <label className="text-xs text-ink-secondary" htmlFor="monto_personalizado">
          ¿Cuánto pagó el cliente?
        </label>
        <input
          id="monto_personalizado"
          name="monto_personalizado"
          type="number"
          min="1"
          step="0.01"
          required
          placeholder="Ej. 350"
          className="mt-1 w-32 rounded-md bg-surface-2 border border-border-strong px-2 py-1.5 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>
      <textarea
        name="notas"
        placeholder="Notas (opcional)"
        rows={2}
        className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      <button className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold rounded-md py-2 text-sm">
        Mandar solicitud
      </button>
    </form>
  );
}
