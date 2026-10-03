"use client";

import { useState } from "react";
import { reasignarTodosLosClientes } from "../actions";

/**
 * Botón que despliega un formulario para mover TODA la cartera de clientes
 * (y sus préstamos activos) de este cobrador a otro de un jalón — para
 * cuando alguien deja de trabajar.
 */
export function ReasignarTodosForm({
  cobradorOrigenId,
  nombreCobrador,
  cantidadClientes,
  otrosCobradores,
}: {
  cobradorOrigenId: string;
  nombreCobrador: string;
  cantidadClientes: number;
  otrosCobradores: { id: string; nombre: string }[];
}) {
  const [abierto, setAbierto] = useState(false);

  if (otrosCobradores.length === 0 || cantidadClientes === 0) return null;

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-xs text-accent-text hover:underline"
      >
        Reasignar todos sus clientes a otro cobrador
      </button>
    );
  }

  return (
    <form
      action={reasignarTodosLosClientes}
      onSubmit={(e) => {
        const select = e.currentTarget.elements.namedItem("nuevo_cobrador_id") as HTMLSelectElement | null;
        const nombreDestino = select?.selectedOptions[0]?.text ?? "el cobrador elegido";
        if (
          !confirm(
            `¿Mover los ${cantidadClientes} clientes de ${nombreCobrador} a ${nombreDestino}? Esto también mueve sus préstamos activos o en mora.`
          )
        ) {
          e.preventDefault();
        }
      }}
      className="flex flex-wrap items-center gap-2 bg-surface border border-border rounded-lg p-3"
    >
      <input type="hidden" name="cobrador_origen_id" value={cobradorOrigenId} />
      <select
        name="nuevo_cobrador_id"
        required
        defaultValue=""
        className="rounded-md bg-surface-2 border border-border-strong px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        <option value="" disabled>
          Elige el cobrador destino…
        </option>
        {otrosCobradores.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nombre}
          </option>
        ))}
      </select>
      <button className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs px-3 py-1.5 rounded-md">
        Mover {cantidadClientes} {cantidadClientes === 1 ? "cliente" : "clientes"}
      </button>
      <button type="button" onClick={() => setAbierto(false)} className="text-ink-muted hover:text-ink text-xs">
        Cancelar
      </button>
    </form>
  );
}
