"use client";

import { useState } from "react";
import Link from "next/link";
import { Circle, Search, Trash2 } from "lucide-react";
import { eliminarClienteTotal } from "./actions";
import type { SemaforoCliente } from "@/lib/finance/calculos";

const estadoLabel: Record<string, string> = {
  activo: "Activo",
  pendiente_aprobacion: "Pendiente de aprobación",
  inactivo: "Inactivo",
};

const SEMAFORO_ESTILO: Record<SemaforoCliente, { color: string; titulo: string }> = {
  verde: { color: "text-green-500", titulo: "Al día — ya pagó hoy, o hoy no le tocaba" },
  amarillo: { color: "text-amber-400", titulo: "Hoy le toca pagar y todavía no registra el pago del día" },
  rojo: { color: "text-red-500", titulo: "Atrasado o con mora" },
  sin_prestamo: { color: "text-ink-muted", titulo: "No tiene un préstamo activo ahorita" },
};

export type FilaClienteTabla = {
  id: string;
  nombreCompleto: string;
  telefono: string | null;
  identificacion: string | null;
  estado: string;
  cobradorId: string | null;
  nombreCobrador: string | null;
  semaforo: SemaforoCliente;
  /** Fecha (YYYY-MM-DD) del préstamo más reciente del cliente, o null si nunca ha tenido uno. */
  ultimoPrestamoFecha: string | null;
};

function formatoFecha(fecha: string | null) {
  if (!fecha) return "Nunca";
  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Tabla de /clientes con buscador en vivo (nombre, teléfono, identificación
 * o cobrador — sin acentos en cuenta, nada más minúsculas) y el botón de
 * eliminar PARA SIEMPRE a un cliente, a petición de Angel. Es componente
 * cliente solo por el buscador; los datos ya vienen calculados del server.
 */
export function ClientesTabla({ filas }: { filas: FilaClienteTabla[] }) {
  const [busqueda, setBusqueda] = useState("");

  const texto = busqueda.trim().toLowerCase();
  const filasFiltradas = texto
    ? filas.filter(
        (f) =>
          f.nombreCompleto.toLowerCase().includes(texto) ||
          (f.telefono ?? "").toLowerCase().includes(texto) ||
          (f.identificacion ?? "").toLowerCase().includes(texto) ||
          (f.nombreCobrador ?? "").toLowerCase().includes(texto)
      )
    : filas;

  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar nombre, teléfono, ID o cobrador…"
          className="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        />
      </div>

      {filasFiltradas.length === 0 ? (
        <p className="text-ink-muted text-sm py-6 text-center">Ningún cliente coincide con &quot;{busqueda}&quot;.</p>
      ) : (
        <div className="border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-ink-muted text-left">
              <tr>
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Identificación</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Cobrador</th>
                <th className="px-4 py-3">Último préstamo</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.map((c) => {
                const estilo = SEMAFORO_ESTILO[c.semaforo];
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <span title={estilo.titulo}>
                        <Circle className={`h-3 w-3 ${estilo.color} fill-current`} aria-hidden="true" />
                        <span className="sr-only">{estilo.titulo}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/clientes/${c.id}`} className="font-medium text-ink hover:text-accent-text hover:underline">
                        {c.nombreCompleto}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">{c.telefono ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-secondary">{c.identificacion ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-secondary">{estadoLabel[c.estado] ?? c.estado}</td>
                    <td className="px-4 py-3">
                      {c.cobradorId ? (
                        <Link
                          href={`/cobradores/${c.cobradorId}`}
                          className="inline-flex items-center text-xs bg-surface-2 hover:bg-surface-3 border border-border-strong text-ink-strong rounded-full px-3 py-1"
                        >
                          Cliente de {c.nombreCobrador ?? "—"}
                        </Link>
                      ) : (
                        <span className="text-xs text-ink-muted">Sin cobrador asignado</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-secondary text-xs whitespace-nowrap">
                      {formatoFecha(c.ultimoPrestamoFecha)}
                    </td>
                    <td className="px-4 py-3">
                      <form
                        action={eliminarClienteTotal}
                        onSubmit={(e) => {
                          if (
                            !confirm(
                              `¿Eliminar a ${c.nombreCompleto} PARA SIEMPRE? Esto borra también todos sus préstamos, pagos, mora y documentos. No hay forma de deshacerlo.`
                            )
                          ) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="cliente_id" value={c.id} />
                        <button
                          type="submit"
                          title="Eliminar cliente para siempre"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-full text-ink-muted hover:text-danger-text hover:bg-danger-chip-bg/40 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
