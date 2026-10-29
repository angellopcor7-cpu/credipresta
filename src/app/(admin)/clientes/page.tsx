import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Cliente } from "@/lib/types";
import { obtenerConfiguraciones } from "@/lib/config";
import {
  esDiaDeCobro,
  tieneCuotaVencidaSinPagar,
  calcularSemaforoCliente,
  type SemaforoCliente,
} from "@/lib/finance/calculos";
import { Circle } from "lucide-react";

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

type ClienteConCobrador = Cliente & {
  cobradores: { usuarios: { nombre_completo: string } | null } | null;
};

export default async function ClientesPage() {
  const supabase = await createClient();
  const [{ data }, config] = await Promise.all([
    supabase.from("clientes").select("*, cobradores(usuarios(nombre_completo))").order("created_at", { ascending: false }),
    obtenerConfiguraciones(),
  ]);
  const clientes = (data ?? []) as unknown as ClienteConCobrador[];

  const { data: prestamosData } = await supabase
    .from("prestamos")
    .select("id, cliente_id, estado, mora_acumulada, monto_prestado, dias_cobro_personalizados")
    .in("cliente_id", clientes.map((c) => c.id))
    .in("estado", ["activo", "en_mora"]);
  const prestamosActivos = prestamosData ?? [];
  const prestamoActivoPorCliente = new Map(prestamosActivos.map((p) => [p.cliente_id, p]));
  const idsPrestamosActivos = prestamosActivos.map((p) => p.id);

  const hoy = new Date().toISOString().slice(0, 10);
  const [{ data: calendarioData }, { data: pagosHoyData }] = await Promise.all([
    idsPrestamosActivos.length > 0
      ? supabase.from("calendario_pagos").select("prestamo_id, fecha_programada, estado").in("prestamo_id", idsPrestamosActivos)
      : Promise.resolve({ data: [] }),
    idsPrestamosActivos.length > 0
      ? supabase
          .from("pagos")
          .select("prestamo_id, fecha_pago")
          .eq("tipo", "cuota_diaria")
          .gte("fecha_pago", hoy)
          .in("prestamo_id", idsPrestamosActivos)
      : Promise.resolve({ data: [] }),
  ]);

  const calendarioPorPrestamo = new Map<string, { fechaProgramada: string; estado: "pendiente" | "pagado" | "parcial" | "no_aplica" }[]>();
  for (const dia of calendarioData ?? []) {
    const lista = calendarioPorPrestamo.get(dia.prestamo_id) ?? [];
    lista.push({ fechaProgramada: dia.fecha_programada, estado: dia.estado });
    calendarioPorPrestamo.set(dia.prestamo_id, lista);
  }
  const prestamosConPagoHoy = new Set((pagosHoyData ?? []).map((p) => p.prestamo_id));

  const semaforoPorCliente = new Map<string, SemaforoCliente>();
  for (const cliente of clientes) {
    const prestamo = prestamoActivoPorCliente.get(cliente.id);
    if (!prestamo) {
      semaforoPorCliente.set(cliente.id, "sin_prestamo");
      continue;
    }
    const calendario = calendarioPorPrestamo.get(prestamo.id) ?? [];
    semaforoPorCliente.set(
      cliente.id,
      calcularSemaforoCliente({
        tienePrestamoActivo: true,
        enMora: prestamo.estado === "en_mora",
        moraAcumulada: Number(prestamo.mora_acumulada),
        tieneCuotaVencida: tieneCuotaVencidaSinPagar(calendario, hoy),
        esDiaDeCobroHoy: esDiaDeCobro(
          new Date(`${hoy}T00:00:00Z`),
          Number(prestamo.monto_prestado),
          config.reglaDiasCobro,
          prestamo.dias_cobro_personalizados
        ),
        yaPagoHoy: prestamosConPagoHoy.has(prestamo.id),
      })
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-ink-muted text-sm">Los da de alta el cobrador desde su panel.</p>
        </div>
        <Link
          href="/clientes/existente"
          className="shrink-0 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm px-4 py-2 rounded-md"
        >
          + Cliente existente
        </Link>
      </div>

      {clientes.length === 0 ? (
        <p className="text-ink-muted text-sm">Aún no hay clientes.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <Circle className="h-3 w-3 text-green-500 fill-current" /> Al día
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Circle className="h-3 w-3 text-amber-400 fill-current" /> Hoy le toca pagar, aún no paga
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Circle className="h-3 w-3 text-red-500 fill-current" /> Atrasado / con mora
            </span>
          </div>
          <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface text-ink-muted text-left">
              <tr>
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Identificación</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Cobrador</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => {
                const nombreCobrador = c.cobradores?.usuarios?.nombre_completo;
                const semaforo = semaforoPorCliente.get(c.id) ?? "sin_prestamo";
                const estilo = SEMAFORO_ESTILO[semaforo];
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
                        {c.nombre_completo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">{c.telefono ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-secondary">{c.identificacion ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-secondary">{estadoLabel[c.estado]}</td>
                    <td className="px-4 py-3">
                      {c.cobrador_id ? (
                        <Link
                          href={`/cobradores/${c.cobrador_id}`}
                          className="inline-flex items-center text-xs bg-surface-2 hover:bg-surface-3 border border-border-strong text-ink-strong rounded-full px-3 py-1"
                        >
                          Cliente de {nombreCobrador ?? "—"}
                        </Link>
                      ) : (
                        <span className="text-xs text-ink-muted">Sin cobrador asignado</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
