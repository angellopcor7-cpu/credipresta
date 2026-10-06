"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { actualizarCobrador } from "../actions";
import { TIPOS_COMISION, type TipoComision } from "@/lib/types";

/**
 * Botón de lápiz que despliega un formulario chiquito para corregir
 * nombre/teléfono/comisión de un cobrador ya dado de alta (errores de
 * captura, renegociar su comisión). La ruta se asigna por separado (ver
 * "Rutas asignadas" más abajo); esto no toca su cuenta de acceso ni su
 * contraseña.
 */
export function EditarCobradorForm({
  cobradorId,
  usuarioId,
  nombreCompleto,
  telefono,
  tipoComision,
  porcentajeComision,
}: {
  cobradorId: string;
  usuarioId: string;
  nombreCompleto: string;
  telefono: string | null;
  tipoComision: TipoComision;
  porcentajeComision: number;
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
        Editar nombre / teléfono / comisión
      </button>
    );
  }

  return (
    <form
      action={actualizarCobrador}
      className="w-full bg-surface border border-border rounded-lg p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-strong">Editar datos del cobrador</p>
        <button type="button" onClick={() => setEditando(false)} className="text-ink-muted hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <input type="hidden" name="cobrador_id" value={cobradorId} />
      <input type="hidden" name="usuario_id" value={usuarioId} />
      <div className="grid sm:grid-cols-2 gap-3">
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
          <label className="text-xs text-ink-muted" htmlFor="editar_tipo_comision">
            Comisión sobre
          </label>
          <select
            id="editar_tipo_comision"
            name="tipo_comision"
            defaultValue={tipoComision}
            className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {TIPOS_COMISION.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-ink-muted" htmlFor="editar_porcentaje_comision">
            Porcentaje de comisión
          </label>
          <input
            id="editar_porcentaje_comision"
            name="porcentaje_comision"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={porcentajeComision}
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
