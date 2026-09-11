"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { actualizarCobrador } from "../actions";

/**
 * Botón de lápiz que despliega un formulario chiquito para corregir
 * nombre/teléfono/zona de un cobrador ya dado de alta (errores de captura,
 * cambio de zona). No toca su cuenta de acceso ni su contraseña.
 */
export function EditarCobradorForm({
  cobradorId,
  usuarioId,
  nombreCompleto,
  telefono,
  zona,
}: {
  cobradorId: string;
  usuarioId: string;
  nombreCompleto: string;
  telefono: string | null;
  zona: string | null;
}) {
  const [editando, setEditando] = useState(false);

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white underline"
      >
        <Pencil className="h-3 w-3" />
        Editar nombre / teléfono / zona
      </button>
    );
  }

  return (
    <form
      action={actualizarCobrador}
      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-200">Editar datos del cobrador</p>
        <button type="button" onClick={() => setEditando(false)} className="text-slate-500 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <input type="hidden" name="cobrador_id" value={cobradorId} />
      <input type="hidden" name="usuario_id" value={usuarioId} />
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-slate-400" htmlFor="editar_nombre_completo">
            Nombre completo
          </label>
          <input
            id="editar_nombre_completo"
            name="nombre_completo"
            defaultValue={nombreCompleto}
            required
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400" htmlFor="editar_telefono">
            Teléfono
          </label>
          <input
            id="editar_telefono"
            name="telefono"
            type="tel"
            defaultValue={telefono ?? ""}
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400" htmlFor="editar_zona">
            Zona
          </label>
          <input
            id="editar_zona"
            name="zona"
            defaultValue={zona ?? ""}
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>
      <button className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm px-3 py-1.5 rounded-md">
        Guardar cambios
      </button>
    </form>
  );
}
