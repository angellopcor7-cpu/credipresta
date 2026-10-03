"use client";

import { useState } from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";

/**
 * Abre o cierra de un solo click todos los desplegables de acciones
 * (".cliente-details") de la lista de clientes. Cada tarjeta sigue teniendo
 * su propio <details> individual — este botón nomás los controla a todos a
 * la vez, sin necesidad de que React lleve el estado de cada uno.
 */
export function AbrirTodoButton() {
  const [abierto, setAbierto] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        const nuevoEstado = !abierto;
        document.querySelectorAll<HTMLDetailsElement>(".cliente-details").forEach((detalle) => {
          detalle.open = nuevoEstado;
        });
        setAbierto(nuevoEstado);
      }}
      className="inline-flex items-center gap-1.5 text-xs bg-surface-2 hover:bg-surface-3 border border-border-strong text-ink-strong font-medium px-3 py-1.5 rounded-full"
    >
      {abierto ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
      {abierto ? "Cerrar todo" : "Abrir todo"}
    </button>
  );
}
