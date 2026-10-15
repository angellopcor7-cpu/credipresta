"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { editarDatosPrestamo } from "../actions";

type DatosPrestamo = {
  id: string;
  monto_prestado: number;
  porcentaje_interes: number;
  plazo_dias: number;
  fecha_inicio: string;
  metodo_pago: string;
  datos_transferencia: string | null;
  saldo_actual: number;
  mora_acumulada: number;
};

/**
 * "Corregir datos del préstamo" — para cuando Empresa se equivoca al
 * capturar los números (sobre todo en "Cliente existente", donde todo se
 * escribe a mano). No es para el día a día del cobro — eso sigue siendo
 * "Registrar pago" y "Cambiar/perdonar mora" — esto es solo para arreglar
 * un dato mal puesto, y por eso pide un motivo.
 */
export function EditarPrestamoForm({ prestamo }: { prestamo: DatosPrestamo }) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 text-sm bg-surface-2 hover:bg-surface-3 border border-border-strong text-ink font-medium rounded-md px-4 py-2"
      >
        <Pencil className="h-3.5 w-3.5" />
        Corregir datos del préstamo
      </button>
    );
  }

  return (
    <form
      action={editarDatosPrestamo}
      className="space-y-3 bg-surface p-4 rounded-xl border border-border max-w-md"
    >
      <input type="hidden" name="prestamo_id" value={prestamo.id} />
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Corregir datos del préstamo</h3>
        <button type="button" onClick={() => setAbierto(false)} className="text-ink-muted hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-ink-muted">
        Para arreglar un dato mal capturado. No cambia el calendario de cobro ya generado.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Campo label="Monto prestado" name="monto_prestado" type="number" step="0.01" defaultValue={prestamo.monto_prestado} />
        <Campo label="% interés total" name="porcentaje_interes" type="number" step="0.01" defaultValue={prestamo.porcentaje_interes} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Plazo (días)" name="plazo_dias" type="number" defaultValue={prestamo.plazo_dias} />
        <Campo label="Fecha de inicio" name="fecha_inicio" type="date" defaultValue={prestamo.fecha_inicio} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Saldo actual" name="saldo_actual" type="number" step="0.01" defaultValue={prestamo.saldo_actual} />
        <Campo label="Mora acumulada" name="mora_acumulada" type="number" step="0.01" defaultValue={prestamo.mora_acumulada} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-ink-secondary" htmlFor="metodo_pago">
            Método de pago
          </label>
          <select
            id="metodo_pago"
            name="metodo_pago"
            defaultValue={prestamo.metodo_pago}
            className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="ambos">Efectivo o transferencia</option>
          </select>
        </div>
        <Campo
          label="Datos de transferencia"
          name="datos_transferencia"
          type="text"
          defaultValue={prestamo.datos_transferencia ?? ""}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-ink-secondary" htmlFor="motivo">
          Motivo de la corrección
        </label>
        <input
          id="motivo"
          name="motivo"
          required
          placeholder="Ej. me equivoqué al capturar el monto abonado"
          className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <button className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold rounded-md py-2 text-sm">
        Guardar corrección
      </button>
    </form>
  );
}

function Campo({
  label,
  name,
  type,
  step,
  defaultValue,
}: {
  label: string;
  name: string;
  type: string;
  step?: string;
  defaultValue: string | number;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-ink-secondary" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        required={type !== "text"}
        className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
    </div>
  );
}
