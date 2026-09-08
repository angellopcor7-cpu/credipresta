import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { exigirVistaCobrador } from "@/lib/auth/roles";
import { aplicarPagoDelDia, marcarIncumplidoDelDia } from "../actions";
import { AbrirTodoButton } from "./AbrirTodoButton";
import type { Cliente, Prestamo } from "@/lib/types";
import {
  Wallet,
  TrendingUp,
  PiggyBank,
  Plus,
  CircleCheck,
  CircleAlert,
  Clock,
  Phone,
  UserPlus,
  ChevronDown,
} from "lucide-react";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

const estadoClienteLabel: Record<string, string> = {
  pendiente_aprobacion: "Pendiente de aprobación",
  activo: "Al corriente",
  inactivo: "Inactivo",
};

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * "Mis clientes": la pantalla principal del cobrador. Lista a todos sus
 * clientes con el total (con interés), lo abonado y el saldo de cada uno, y
 * arriba el total sumado de toda su cartera — tal cual lo pidió el negocio
 * ("que todos los clientes se suban y puedan ver el total"). Los clientes en
 * mora se muestran primero, para que el cobrador sepa a quién atender hoy.
 */
export default async function PanelCobradorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; exito?: string }>;
}) {
  const { error, exito } = await searchParams;
  const sesion = await exigirVistaCobrador();
  const supabase = await createClient();

  const { data: clientesData } = await supabase
    .from("clientes")
    .select("*")
    .eq("cobrador_id", sesion.cobradorId)
    .order("created_at", { ascending: false });
  const clientes = (clientesData ?? []) as Cliente[];
  const clienteIds = clientes.map((c) => c.id);

  const { data: prestamosData } =
    clienteIds.length > 0
      ? await supabase.from("prestamos").select("*").in("cliente_id", clienteIds)
      : { data: [] as Prestamo[] };
  const prestamos = (prestamosData ?? []) as Prestamo[];

  const prestamoIds = prestamos.map((p) => p.id);
  const { data: morasData } =
    prestamoIds.length > 0
      ? await supabase.from("moras").select("prestamo_id").in("prestamo_id", prestamoIds).eq("estado", "pendiente")
      : { data: [] as { prestamo_id: string }[] };
  const prestamosConMora = new Set((morasData ?? []).map((m) => m.prestamo_id));

  // Para bloquear los botones de hoy: un préstamo no puede recibir dos
  // "pago del día" ni dos "no pagó" (mora) el mismo día.
  const hoy = new Date().toISOString().slice(0, 10);
  const [{ data: pagosHoyData }, { data: morasHoyData }] = await Promise.all([
    prestamoIds.length > 0
      ? supabase.from("pagos").select("prestamo_id, fecha_pago").in("prestamo_id", prestamoIds).eq("tipo", "cuota_diaria")
      : Promise.resolve({ data: [] as { prestamo_id: string; fecha_pago: string }[] }),
    prestamoIds.length > 0
      ? supabase.from("moras").select("prestamo_id").in("prestamo_id", prestamoIds).eq("fecha_generada", hoy)
      : Promise.resolve({ data: [] as { prestamo_id: string }[] }),
  ]);
  const prestamosPagadosHoy = new Set(
    (pagosHoyData ?? []).filter((p) => p.fecha_pago?.slice(0, 10) === hoy).map((p) => p.prestamo_id)
  );
  const prestamosMoraHoy = new Set((morasHoyData ?? []).map((m) => m.prestamo_id));

  const filas = clientes.map((cliente) => {
    const prestamosDelCliente = prestamos.filter((p) => p.cliente_id === cliente.id);
    const total = prestamosDelCliente.reduce((suma, p) => suma + Number(p.monto_total), 0);
    const saldo = prestamosDelCliente.reduce((suma, p) => suma + Number(p.saldo_actual), 0);
    const abonado = total - saldo;
    const progreso = total > 0 ? Math.min(100, Math.round((abonado / total) * 100)) : 0;

    const prestamoActivo = prestamosDelCliente.find((p) => p.estado === "activo" || p.estado === "en_mora");
    const enMora = prestamosDelCliente.some((p) => prestamosConMora.has(p.id) || p.estado === "en_mora");
    const todosLiquidados = prestamosDelCliente.length > 0 && prestamosDelCliente.every((p) => p.estado === "liquidado");

    let estadoTexto = estadoClienteLabel[cliente.estado] ?? cliente.estado;
    if (cliente.estado === "activo") {
      estadoTexto = todosLiquidados ? "Liquidado" : enMora ? "En mora" : "Al corriente";
    }

    // Prioridad para ordenar: mora primero (urge cobrarles), luego pendientes de aprobación, luego el resto.
    const prioridad = enMora ? 0 : cliente.estado === "pendiente_aprobacion" ? 1 : 2;

    return { cliente, total, abonado, saldo, progreso, prestamoActivo, estadoTexto, enMora, prioridad };
  });

  filas.sort((a, b) => a.prioridad - b.prioridad);

  const totalCartera = filas.reduce((suma, f) => suma + f.total, 0);
  const abonadoCartera = filas.reduce((suma, f) => suma + f.abonado, 0);
  const saldoCartera = filas.reduce((suma, f) => suma + f.saldo, 0);
  const clientesEnMora = filas.filter((f) => f.enMora).length;

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 p-6">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-amber-400/80 text-xs font-medium uppercase tracking-wider">Panel del cobrador</p>
            <h1 className="text-2xl font-bold mt-1">Hola, {sesion.nombreCompleto.split(" ")[0]}</h1>
            <p className="text-slate-400 text-sm mt-1">
              {clientes.length} cliente{clientes.length === 1 ? "" : "s"}
              {clientesEnMora > 0 && (
                <span className="text-red-400"> · {clientesEnMora} en mora</span>
              )}
            </p>
          </div>
          <Link
            href="/panel/clientes/nuevo"
            className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 transition-colors text-slate-950 font-semibold text-sm px-4 py-2.5 rounded-lg shadow-lg shadow-amber-950/50"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Nuevo cliente
          </Link>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">{error}</p>
      )}
      {exito && (
        <p className="text-sm text-amber-400 bg-amber-950/50 border border-amber-900 rounded-md px-3 py-2">
          {exito}
        </p>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <ResumenCartera icon={Wallet} label="Total con interés" value={currency(totalCartera)} tone="amber" />
        <ResumenCartera icon={TrendingUp} label="Abonado" value={currency(abonadoCartera)} tone="sky" />
        <ResumenCartera icon={PiggyBank} label="Saldo pendiente" value={currency(saldoCartera)} tone="amber" destacado />
      </div>

      {clientes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 text-center bg-slate-900 border border-dashed border-slate-800 rounded-2xl py-16 px-6">
          <div className="rounded-full bg-amber-500/10 p-3">
            <UserPlus className="h-6 w-6 text-amber-400" />
          </div>
          <p className="text-slate-300 font-medium">Todavía no tienes clientes</p>
          <p className="text-slate-500 text-sm max-w-xs">
            Da de alta al primero con el botón &quot;Nuevo cliente&quot; de arriba.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <AbrirTodoButton />
          </div>
          {filas.map(({ cliente, total, abonado, saldo, progreso, prestamoActivo, estadoTexto, enMora }) => (
            <div
              key={cliente.id}
              className={`group bg-slate-900 border rounded-xl p-4 flex flex-wrap items-center gap-4 border-l-4 transition-colors hover:bg-slate-900/70 ${
                enMora
                  ? "border-slate-800 border-l-red-500"
                  : cliente.estado === "pendiente_aprobacion"
                    ? "border-slate-800 border-l-amber-500"
                    : "border-slate-800 border-l-sky-600"
              }`}
            >
              <div className="flex items-center gap-3 min-w-[13rem]">
                <div className="shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-bold text-sm">
                  {iniciales(cliente.nombre_completo)}
                </div>
                <div>
                  <Link href={`/panel/clientes/${cliente.id}`} className="font-medium hover:text-amber-400">
                    {cliente.nombre_completo}
                  </Link>
                  <p className="text-slate-500 text-xs flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {cliente.telefono ?? "Sin teléfono"}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 mt-1 text-xs border rounded-full px-2 py-0.5 ${
                      cliente.estado === "pendiente_aprobacion"
                        ? "bg-amber-950 text-amber-400 border-amber-900"
                        : enMora
                          ? "bg-red-950 text-red-400 border-red-900"
                          : "bg-sky-950 text-sky-400 border-sky-900"
                    }`}
                  >
                    {cliente.estado === "pendiente_aprobacion" ? (
                      <Clock className="h-3 w-3" />
                    ) : enMora ? (
                      <CircleAlert className="h-3 w-3" />
                    ) : (
                      <CircleCheck className="h-3 w-3" />
                    )}
                    {estadoTexto}
                  </span>
                </div>
              </div>

              {prestamoActivo ? (
                <>
                  <div className="flex-1 min-w-[10rem] max-w-[16rem] space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Progreso</span>
                      <span>{progreso}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${enMora ? "bg-red-500" : "bg-amber-500"}`}
                        style={{ width: `${progreso}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-6 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs">Total</p>
                      <p className="font-semibold">{currency(total)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Abonado</p>
                      <p className="font-semibold text-sky-400">{currency(abonado)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Saldo</p>
                      <p className="font-semibold">{currency(saldo)}</p>
                    </div>
                  </div>
                  <details className="cliente-details group ml-auto w-full sm:w-auto">
                    <summary className="inline-flex items-center gap-1 text-xs text-amber-400 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                      <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                      Acciones de hoy
                    </summary>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {prestamosPagadosHoy.has(prestamoActivo.id) ? (
                        <span className="inline-flex items-center gap-1.5 text-sm bg-slate-800 text-slate-400 px-3 py-1.5 rounded-md">
                          <CircleCheck className="h-4 w-4" />
                          Ya cobrado hoy
                        </span>
                      ) : (
                        <form action={aplicarPagoDelDia}>
                          <input type="hidden" name="prestamo_id" value={prestamoActivo.id} />
                          <button className="inline-flex items-center gap-1.5 text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-3 py-1.5 rounded-md">
                            <CircleCheck className="h-4 w-4" />
                            Pago del día
                          </button>
                        </form>
                      )}
                      {prestamosMoraHoy.has(prestamoActivo.id) ? (
                        <span className="inline-flex items-center gap-1.5 text-sm bg-slate-800 text-slate-400 px-3 py-1.5 rounded-md">
                          <CircleAlert className="h-4 w-4" />
                          Ya marcado hoy
                        </span>
                      ) : (
                        <form action={marcarIncumplidoDelDia}>
                          <input type="hidden" name="prestamo_id" value={prestamoActivo.id} />
                          <button className="inline-flex items-center gap-1.5 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium px-3 py-1.5 rounded-md">
                            <CircleAlert className="h-4 w-4" />
                            No pagó
                          </button>
                        </form>
                      )}
                    </div>
                  </details>
                </>
              ) : (
                <p className="text-xs text-slate-500 ml-auto">
                  {cliente.estado === "pendiente_aprobacion"
                    ? "Esperando que Empresa apruebe la solicitud."
                    : "Sin préstamo activo."}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResumenCartera({
  icon: Icon,
  label,
  value,
  tone,
  destacado,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone: "amber" | "sky";
  destacado?: boolean;
}) {
  const toneClasses = tone === "amber" ? "bg-amber-500/10 text-amber-400" : "bg-sky-500/10 text-sky-400";
  return (
    <div
      className={`bg-slate-900 border rounded-xl p-4 flex items-center gap-3 ${
        destacado ? "border-amber-800" : "border-slate-800"
      }`}
    >
      <div className={`shrink-0 rounded-lg p-2.5 ${toneClasses}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-slate-500 text-xs">{label}</p>
        <p className={`text-xl font-bold ${destacado ? "text-amber-400" : ""}`}>{value}</p>
      </div>
    </div>
  );
}
