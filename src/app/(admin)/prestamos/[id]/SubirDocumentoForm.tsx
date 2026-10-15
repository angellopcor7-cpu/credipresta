"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
import { subirDocumentoCliente } from "../../clientes/actions";
import { comprimirImagen } from "@/lib/comprimirImagen";

const OPCIONES: { value: string; label: string }[] = [
  { value: "ine_frente", label: "INE frente" },
  { value: "ine_reverso", label: "INE reverso" },
  { value: "foto_cliente", label: "Foto del cliente" },
  { value: "comprobante_domicilio", label: "Comprobante de domicilio" },
  { value: "pagare_impreso", label: "Pagaré impreso (foto)" },
  { value: "otro", label: "Otro" },
];

/**
 * Para subir documentos que falten — sobre todo los clientes que se
 * agregaron con "Cliente existente" (no pasaron por el alta normal del
 * cobrador, así que no traen INE/foto/comprobante). "Pagaré impreso" es
 * para el negocio que ya tiene el pagaré en papel, firmado a mano — en vez
 * de generar uno nuevo en la app, aquí se sube la foto del que ya existe.
 */
export function SubirDocumentoForm({ clienteId, volverA }: { clienteId: string; volverA: string }) {
  const [abierto, setAbierto] = useState(false);
  // Se bloquea el botón de enviar mientras la foto se está comprimiendo,
  // para no mandar el archivo pesado original por ganarle a la compresión.
  const [procesando, setProcesando] = useState(false);

  /**
   * Una foto tomada con la cámara del celular fácilmente pesa varios MB —
   * eso revienta el límite de tamaño del formulario (ver next.config.ts) y
   * la subida truena con un error genérico. Se recomprime en el navegador
   * antes de enviarla, reemplazando el archivo del propio input (así no hay
   * que tocar nada del envío nativo del formulario) — mismo truco que usa
   * el alta de "nuevo cliente".
   */
  async function comprimirDocumento(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const archivo = input.files?.[0];
    if (!archivo) return;
    setProcesando(true);
    try {
      const comprimida = await comprimirImagen(archivo);
      if (comprimida !== archivo) {
        const dt = new DataTransfer();
        dt.items.add(comprimida);
        input.files = dt.files;
      }
    } finally {
      setProcesando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 text-xs bg-surface-2 hover:bg-surface-3 border border-border-strong text-ink font-medium rounded-md px-3 py-1.5"
      >
        <Upload className="h-3.5 w-3.5" />
        Subir documento
      </button>
    );
  }

  return (
    <form
      action={subirDocumentoCliente}
      encType="multipart/form-data"
      className="animate-panel-in space-y-3 bg-surface p-4 rounded-xl border border-border max-w-md"
    >
      <input type="hidden" name="cliente_id" value={clienteId} />
      <input type="hidden" name="volver_a" value={volverA} />
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Subir documento</h3>
        <button type="button" onClick={() => setAbierto(false)} className="text-ink-muted hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-sm text-ink-secondary" htmlFor="tipo_documento">
          ¿Qué documento es?
        </label>
        <select
          id="tipo_documento"
          name="tipo_documento"
          required
          defaultValue=""
          className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="" disabled>
            Elige el tipo
          </option>
          {OPCIONES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm text-ink-secondary" htmlFor="archivo">
          Foto o archivo
        </label>
        <input
          id="archivo"
          name="archivo"
          type="file"
          accept="image/*,.pdf"
          required
          onChange={comprimirDocumento}
          className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm file:mr-3 file:rounded file:border-0 file:bg-surface-3 file:px-2 file:py-1 file:text-xs"
        />
      </div>

      <button
        disabled={procesando}
        className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-neutral-950 font-semibold rounded-md py-2 text-sm"
      >
        {procesando ? "Preparando foto…" : "Subir"}
      </button>
    </form>
  );
}
