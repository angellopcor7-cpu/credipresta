"use client";

import { useState } from "react";
import { entrarComoClienteDePrueba, entrarComoCobradorDePrueba } from "./dev-modo-prueba-actions";

/**
 * Widget flotante solo para pruebas: deja saltar rápido a la vista de
 * Cliente o de Cobrador sin cerrar sesión e iniciar sesión a mano. Debe
 * quitarse antes de entregar la app final al cliente.
 */
export default function DevModoPrueba() {
  const [cargando, setCargando] = useState<"cliente" | "cobrador" | null>(null);

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-amber-500 text-slate-950 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-bold mb-2">MODO PRUEBA</p>
      <div className="flex flex-col gap-2">
        <form
          action={async () => {
            setCargando("cliente");
            await entrarComoClienteDePrueba();
          }}
        >
          <button
            type="submit"
            disabled={cargando !== null}
            className="w-full bg-slate-950 text-white font-semibold px-3 py-1.5 rounded-md hover:bg-slate-800 disabled:opacity-50"
          >
            {cargando === "cliente" ? "Entrando..." : "Ver como Cliente"}
          </button>
        </form>
        <form
          action={async () => {
            setCargando("cobrador");
            await entrarComoCobradorDePrueba();
          }}
        >
          <button
            type="submit"
            disabled={cargando !== null}
            className="w-full bg-slate-950 text-white font-semibold px-3 py-1.5 rounded-md hover:bg-slate-800 disabled:opacity-50"
          >
            {cargando === "cobrador" ? "Entrando..." : "Ver como Cobrador"}
          </button>
        </form>
      </div>
    </div>
  );
}
