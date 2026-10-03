"use client";

import { useState } from "react";
import { KeyRound, X } from "lucide-react";
import { restablecerPasswordCobrador } from "../actions";

/** Le pone una contraseña nueva a la cuenta del cobrador, para cuando la olvida. */
export function RestablecerPasswordForm({
  cobradorId,
  usuarioId,
}: {
  cobradorId: string;
  usuarioId: string;
}) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink underline"
      >
        <KeyRound className="h-3 w-3" />
        Restablecer contraseña
      </button>
    );
  }

  return (
    <form
      action={restablecerPasswordCobrador}
      className="w-full bg-surface border border-border rounded-lg p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-strong">Restablecer contraseña</p>
        <button type="button" onClick={() => setAbierto(false)} className="text-ink-muted hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <input type="hidden" name="cobrador_id" value={cobradorId} />
      <input type="hidden" name="usuario_id" value={usuarioId} />
      <div className="space-y-1">
        <label className="text-xs text-ink-muted" htmlFor="password">
          Contraseña nueva
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          placeholder="Mínimo 6 caracteres"
          className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>
      <button className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm px-3 py-1.5 rounded-md">
        Actualizar contraseña
      </button>
    </form>
  );
}
