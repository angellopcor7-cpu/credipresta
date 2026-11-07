import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Cliente } from "@/lib/types";
import { obtenerConfiguraciones } from "@/lib/config";
import {
  tieneCuotaVencidaSinPagar,
  calcularSemaforoCliente,
  type SemaforoCliente,
} from "@/lib/finance/calculos";
import { Circle, Users, HardDrive } from "lucide-react";
import { obtenerUsoStorage, PROMEDIO_BYTES_POR_CLIENTE_ESTIMADO } from "@/lib/storage/usoStorage";
import { ClientesTabla, type FilaClienteTabla } from "./ClientesTabla";

type ClienteConCobrador = Cliente & {
  cobradores: { usuarios: { nombre_completo: string } | null } | null;
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; exito?: string }>;
}) {
  const { error, exito } = await searchParams;
  const supabase = await createClient();
  const [{ data }, config, uso] = await Promise.all([
    supabase.from("clientes").select("*, cobradores(usuarios(nombre_completo))").order("created_at", { ascending: false }),
    obtenerConfiguraciones(),
    obtenerUsoStorage(),
  ]);
  const clientes = (data ?? []) as unknown as ClienteConCobrador[];

  // Cupo estimado de clientes con el plan actual de Supabase: toma el
  // promedio real de lo que pesan los documentos de los clientes que ya
  // existen (ya comprimidos a ~1MB máx. cada uno) y lo compara contra el
  // límite de storage del plan. Si todavía no hay suficientes datos reales
  // (pocos clientes), usa un estimado razonable en su lugar.
  const promedioBytesPorCliente =
    clientes.length >= 3 && uso.bytesDocumentos > 0
      ? uso.bytesDocumentos / clientes.length
      : PROMEDIO_BYTES_POR_CLIENTE_ESTIMADO;
  const cupoEstimadoClientes = Math.max(1, Math.floor(config.limiteStorageBytes / promedioBytesPorCliente));

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

  // Fecha del préstamo MÁS RECIENTE de cada cliente (cualquier estado, no
  // solo activo/en_mora) — para la columna "Último préstamo" de la tabla.
  const { data: todosPrestamosData } = await supabase
    .from("prestamos")
    .select("cliente_id, fecha_inicio")
    .in("cliente_id", clientes.map((c) => c.id))
    .order("fecha_inicio", { ascending: false });
  const ultimoPrestamoPorCliente = new Map<string, string>();
  for (const p of todosPrestamosData ?? []) {
    if (!ultimoPrestamoPorCliente.has(p.cliente_id)) {
      ultimoPrestamoPorCliente.set(p.cliente_id, p.fecha_inicio);
    }
  }

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
        // OJO: esto NO es "hoy es día de cobro según la regla general" (eso
        // marcaba como "le toca pagar hoy" a un préstamo recién aprobado
        // HOY, cuyo primer cobro real es hasta mañana) — es "el calendario
        // de ESTE préstamo tiene una fecha programada para hoy".
        esDiaDeCobroHoy: calendario.some((d) => d.fechaProgramada === hoy),
        yaPagoHoy: prestamosConPagoHoy.has(prestamo.id),
      })
    );
  }

  const filas: FilaClienteTabla[] = clientes.map((c) => ({
    id: c.id,
    nombreCompleto: c.nombre_completo,
    telefono: c.telefono,
    identificacion: c.identificacion,
    estado: c.estado,
    cobradorId: c.cobrador_id,
    nombreCobrador: c.cobradores?.usuarios?.nombre_completo ?? null,
    semaforo: semaforoPorCliente.get(c.id) ?? "sin_prestamo",
    ultimoPrestamoFecha: ultimoPrestamoPorCliente.get(c.id) ?? null,
  }));

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

      {error && (
        <p className="text-sm text-danger-text bg-danger-chip-bg/50 border border-danger-chip-border rounded-md px-3 py-2">{error}</p>
      )}
      {exito && (
        <p className="text-sm text-accent-text bg-accent-chip-bg/50 border border-accent-chip-border rounded-md px-3 py-2">
          {exito}
        </p>
      )}

      {clientes.length === 0 ? (
        <p className="text-ink-muted text-sm">Aún no hay clientes.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
            <div className="flex flex-wrap items-center gap-4">
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
            <span
              className="inline-flex items-center gap-1.5 shrink-0"
              title="Cupo estimado según cuánto pesan en promedio los documentos de tus clientes reales. Si subes a Pro, este número sube solo."
            >
              <Users className="h-3 w-3" />
              {clientes.length} cliente{clientes.length === 1 ? "" : "s"}
              <span className="text-ink-muted/60">·</span>
              <HardDrive className="h-3 w-3" />
              cupo ~{cupoEstimadoClientes.toLocaleString("es-MX")}
            </span>
          </div>
          <ClientesTabla filas={filas} />
        </>
      )}
    </div>
  );
}
