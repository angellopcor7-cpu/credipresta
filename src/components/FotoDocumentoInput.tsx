"use client";

import { useRef, useState } from "react";
import { Camera, Image as ImageIcon } from "lucide-react";

/**
 * Reemplaza un <input type="file"> normal para fotos de documentos: en vez
 * de dejar que el navegador decida solo (en algunos Android abre derecho a
 * la galería, en otros derecho a la cámara, según el `capture` que se le
 * ponga), muestra dos botones explícitos — "Cámara" y "Galería" — que
 * activan/quitan el atributo `capture` del input JUSTO antes de abrirlo.
 * El input sigue siendo uno solo (mismo `name`), así que el envío nativo
 * del formulario no cambia.
 */
export function FotoDocumentoInput({
  id,
  name,
  label,
  required,
  onFileChange,
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  onFileChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);

  function abrir(modo: "camara" | "galeria") {
    const input = inputRef.current;
    if (!input) return;
    if (modo === "camara") {
      input.setAttribute("capture", "environment");
    } else {
      input.removeAttribute("capture");
    }
    input.click();
  }

  function manejarCambio(e: React.ChangeEvent<HTMLInputElement>) {
    setNombreArchivo(e.target.files?.[0]?.name ?? null);
    onFileChange?.(e);
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm text-ink-secondary" htmlFor={id}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept="image/*"
        required={required}
        onChange={manejarCambio}
        className="hidden"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => abrir("camara")}
          className="inline-flex items-center gap-1.5 text-xs bg-surface-3 hover:bg-surface-2 border border-border-strong text-ink rounded-md px-3 py-1.5"
        >
          <Camera className="h-3.5 w-3.5" />
          Cámara
        </button>
        <button
          type="button"
          onClick={() => abrir("galeria")}
          className="inline-flex items-center gap-1.5 text-xs bg-surface-3 hover:bg-surface-2 border border-border-strong text-ink rounded-md px-3 py-1.5"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Galería
        </button>
      </div>
      {nombreArchivo && <p className="text-xs text-accent-text truncate">✓ {nombreArchivo}</p>}
    </div>
  );
}
