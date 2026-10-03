"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { actualizarDatosCliente } from "../../../actions";

/**
 * Botón de lápiz que despliega un formulario chiquito para corregir
 * nombre/teléfono/dirección de un cliente ya dado de alta (errores de
 * captura). No toca nada del préstamo, el pagaré ni el estado del cliente.
 */
export function EditarClienteForm({
  clienteId,
  nombreCompleto,
  telefono,
  direccion,
}: {
  clienteId: string;
  nombreCompleto: string;
  telefono: string | null;
  direccion: string | null;
}) {
  const [editando, setEditando] = useState(false);

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink underline"
      >
        <Pencil className="h-3 w-3" />
        Editar nombre / teléfono / dirección
      </button>
    );
  }

  return (
    <form action={actualizarDatosCliente} className="w-full bg-surface border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-strong">Editar datos del cliente</p>
        <button type="button" onClick={() => setEditando(false)} className="text-ink-muted hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <input type="hidden" name="cliente_id" value={clienteId} />
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-ink-muted" htmlFor="editar_nombre_completo">
            Nombre completo
          </label>
          <input
            id="editar_nombre_completo"
            name="nombre_completo"
            defaultValue={nombreCompleto}
            required
            className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-ink-muted" htmlFor="editar_telefono">
            Teléfono
          </label>
          <input
            id="editar_telefono"
            name="telefono"
            type="tel"
            defaultValue={telefono ?? ""}
            className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-ink-muted" htmlFor="editar_direccion">
            Dirección
          </label>
          <input
            id="editar_direccion"
            name="direccion"
            defaultValue={direccion ?? ""}
            className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>
      <button className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm px-3 py-1.5 rounded-md">
        Guardar cambios
      </button>
    </form>
  );
}
