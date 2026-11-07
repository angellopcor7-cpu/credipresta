"use client";

import { useState } from "react";
import { X } from "lucide-react";

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Avatar circular del cliente en su ficha: si tiene foto de la cara subida
 * (documento "foto_cliente"), la muestra ahí en vez de solo las iniciales —
 * y al darle clic se abre en grande encima de todo, para reconocerlo de un
 * vistazo sin tener que abrir el documento en otra pestaña. Si no tiene
 * foto, se comporta exactamente igual que antes (círculo con iniciales).
 */
export function FotoClienteAvatar({
  nombreCompleto,
  fotoUrl,
  tamano = "h-12 w-12",
}: {
  nombreCompleto: string;
  fotoUrl: string | null;
  tamano?: string;
}) {
  const [abierta, setAbierta] = useState(false);

  if (!fotoUrl) {
    return (
      <div
        className={`shrink-0 ${tamano} rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-neutral-950 font-bold`}
      >
        {iniciales(nombreCompleto)}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        title="Ver foto en grande"
        className={`shrink-0 ${tamano} rounded-full overflow-hidden border border-border-strong`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Storage, no vale la pena el pipeline de next/image para esto. */}
        <img src={fotoUrl} alt={nombreCompleto} className="h-full w-full object-cover object-top" />
      </button>

      {abierta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setAbierta(false)}
        >
          <button
            type="button"
            onClick={() => setAbierta(false)}
            aria-label="Cerrar"
            className="absolute top-4 right-4 text-white/80 hover:text-white"
          >
            <X className="h-7 w-7" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Storage */}
          <img
            src={fotoUrl}
            alt={nombreCompleto}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
