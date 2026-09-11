import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirVistaCobrador } from "@/lib/auth/roles";
import { formatoFechaCorta } from "@/lib/format";
import { aplicarPagoDelDia } from "../../../actions";
import { EliminarClienteButton } from "../../EliminarClienteButton";
import { EditarClienteForm } from "./EditarClienteForm";
import type { CalendarioPago, Cliente, Mora, Pago, Prestamo, SolicitudPrestamo, TipoDocumento } from "@/lib/types";
import {
  ArrowLeft,
  Landmark,
  Wallet,
  TrendingUp,
  PiggyBank,
  CircleCheck,
  CircleAlert,
  CircleX,
  Clock,
  FileText,
  Phone,
  MapPin,
  CalendarDays,
} from "lucide-react";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

const ETIQUETAS_DOCUMENTO: Record<TipoDocumento, string> = {
  ine_frente: "INE frente",
  ine_reverso: "INE reverso",
  comprobante_domicilio: "Comprobante domicilio",
  foto_cliente: "Foto",
  contrato_pagare: "Contrato",
  pagare_firmado: "Pagaré firmado",
  otro: "Otro",
};

const ETIQUETAS_ESTADO_PRESTAMO: Record<string, string> = {
  activo: "Activo",
  en_mora: "En mora",
  liquidado: "Liquidado",
  cancelado: "Cancelado",
};

const DIAS_SEMANA_LABEL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function DetalleClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; exito?: string }>;
}) {
  const { id } = await params;
  const { error, exito } = await searchParams;
  const sesion = await exigirVistaCobrador();
  const supabase = await createClient();

  const { data: clienteData } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .eq("cobrador_id", sesion.cobradorId)
    .maybeSingle();

  if (!clienteData) notFound();
  const cliente = clienteData as Cliente;

  const [{ data: prestamosData }, { data: documentosData }, { data: solicitudesData }] = await Promise.all([
    supabase.from("prestamos").select("*").eq("cliente_id", id).order("created_at", { ascending: false }),
    supabase.from("documentos_clientes").select("tipo_documento, storage_path").eq("cliente_id", id),
    supabase
      .from("solicitudes_prestamo")
      .select("*")
      .eq("cliente_id", id)
      .order("fecha_solicitud", { ascending: false }),
  ]);

  const prestamos = (prestamosData ?? []) as Prestamo[];
  const solicitudes = (solicitudesData ?? []) as SolicitudPrestamo[];
  const prestamoActivo = prestamos.find((p) => p.estado === "activo" || p.estado === "en_mora") ?? prestamos[0];

  const [{ data: pagosData }, { data: calendarioData }, { data: morasData }] = await Promise.all([
    prestamoActivo
      ? supabase.from("pagos").select("*").eq("prestamo_id", prestamoActivo.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Pago[] }),
    prestamoActivo
      ? supabase.from("calendario_pagos").select("*").eq("prestamo_id", prestamoActivo.id).order("numero_dia")
      : Promise.resolve({ data: [] as CalendarioPago[] }),
    prestamoActivo
      ? supabase.from("moras").select("*").eq("prestamo_id", prestamoActivo.id).order("fecha_generada", { ascending: false })
      : Promise.resolve({ data: [] as Mora[] }),
  ]);

  const pagos = (pagosData ?? []) as Pago[];
  const calendario = (calendarioData ?? []) as CalendarioPago[];
  const moras = (morasData ?? []) as Mora[];

  const documentosPorTipo = (documentosData ?? []) as { tipo_documento: TipoDocumento; storage_path: string }[];
  let documentosConUrl: { tipo: TipoDocumento; url: string }[] = [];
  if (documentosPorTipo.length > 0) {
    const { data: firmados } = await supabase.storage
      .from("documentos-clientes")
      .createSignedUrls(
        documentosPorTipo.map((d) => d.storage_path),
        3600
      );
    documentosConUrl = documentosPorTipo
      .map((d, i) => ({ tipo: d.tipo_documento, url: firmados?.[i]?.signedUrl ?? "" }))
      .filter((d) => d.url);
  }

  // Para bloquear el botón de "pago del día": un préstamo no puede recibir
  // dos pagos de cuota diaria el mismo día. La mora ya no la aplica el
  // cobrador — se genera sola cuando pasan 24 horas sin pago.
  const hoy = new Date().toISOString().slice(0, 10);
  const yaPagoHoy = pagos.some((p) => p.tipo === "cuota_diaria" && p.fecha_pago?.slice(0, 10) === hoy);

  const puedeCobrar = !!prestamoActivo && (prestamoActivo.estado === "activo" || prestamoActivo.estado === "en_mora");
  const abonado = prestamoActivo ? Number(prestamoActivo.monto_total) - Number(prestamoActivo.saldo_actual) : 0;
  const progreso =
    prestamoActivo && Number(prestamoActivo.monto_total) > 0
      ? Math.min(100, Math.round((abonado / Number(prestamoActivo.monto_total)) * 100))
      : 0;
  const solicitudPendiente = solicitudes.find((s) => s.estado === "pendiente");
  const solicitudRechazada = solicitudes.find((s) => s.estado === "rechazada");
  const enMora = !!prestamoActivo && prestamoActivo.estado === "en_mora";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/panel" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" />
          Mis clientes
        </Link>

        <div className="flex items-center gap-3 mt-3">
          <div className="shrink-0 h-12 w-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-bold">
            {iniciales(cliente.nombre_completo)}
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">{cliente.nombre_completo}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-400 text-sm">
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {cliente.telefono ?? "Sin teléfono"}
              </span>
              {cliente.direccion && (
                <span className="inline-flex items-center gap-1 text-slate-500 text-xs">
                  <MapPin className="h-3.5 w-3.5" />
                  {cliente.direccion}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-2">
          <EditarClienteForm
            clienteId={cliente.id}
            nombreCompleto={cliente.nombre_completo}
            telefono={cliente.telefono}
            direccion={cliente.direccion}
          />
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

      {cliente.estado === "pendiente_aprobacion" && (
        <div className="flex items-start gap-2 bg-amber-950/50 border border-amber-900 rounded-md px-4 py-3 text-sm text-amber-300">
          <Clock className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            {solicitudPendiente ? (
              <>
                Esperando que Empresa apruebe la solicitud de {currency(Number(solicitudPendiente.monto_solicitado))} a{" "}
                {solicitudPendiente.plazo_dias} días.
              </>
            ) : (
              "Esperando aprobación de Empresa."
            )}
          </p>
        </div>
      )}

      {cliente.estado !== "pendiente_aprobacion" && solicitudRechazada && !prestamoActivo && (
        <div className="flex items-start justify-between gap-3 bg-red-950/50 border border-red-900 rounded-md px-4 py-3 text-sm text-red-300">
          <div className="flex items-start gap-2">
            <CircleX className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Empresa rechazó la solicitud de {currency(Number(solicitudRechazada.monto_solicitado))}.
              {solicitudRechazada.notas_revision ? ` Motivo: ${solicitudRechazada.notas_revision}` : ""}
            </p>
          </div>
          {cliente.estado === "inactivo" && (
            <EliminarClienteButton clienteId={cliente.id} nombreCliente={cliente.nombre_completo} />
          )}
        </div>
      )}

      {prestamoActivo && (
        <>
          <div className="grid sm:grid-cols-4 gap-4">
            <Resumen icon={Landmark} label="Prestado" value={currency(Number(prestamoActivo.monto_prestado))} tone="sky" />
            <Resumen icon={Wallet} label="Total con interés" value={currency(Number(prestamoActivo.monto_total))} tone="amber" />
            <Resumen icon={TrendingUp} label="Abonado" value={currency(abonado)} tone="sky" />
            <Resumen icon={PiggyBank} label="Saldo" value={currency(Number(prestamoActivo.saldo_actual))} tone="amber" destacado />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Progreso del préstamo</span>
              <span>{progreso}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className={`h-full rounded-full ${enMora ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${progreso}%` }} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <span
              className={`inline-flex items-center gap-1 border rounded-full px-2 py-1 ${
                enMora
                  ? "bg-red-950 text-red-400 border-red-900"
                  : prestamoActivo.estado === "activo"
                    ? "bg-sky-950 text-sky-400 border-sky-900"
                    : "border-slate-700"
              }`}
            >
              {enMora ? <CircleAlert className="h-3.5 w-3.5" /> : <CircleCheck className="h-3.5 w-3.5" />}
              {ETIQUETAS_ESTADO_PRESTAMO[prestamoActivo.estado]}
            </span>
            <span className="inline-flex items-center gap-1 border border-slate-800 rounded-full px-2 py-1">
              <CalendarDays className="h-3.5 w-3.5" />
              Plan {prestamoActivo.plazo_dias} días
            </span>
            <span className="border border-slate-800 rounded-full px-2 py-1">
              Pago diario: {currency(Number(prestamoActivo.monto_cuota_sugerida))}
            </span>
            <span className="border border-slate-800 rounded-full px-2 py-1">
              Inicio: {formatoFechaCorta(prestamoActivo.fecha_inicio)}
            </span>
            <span className="border border-slate-800 rounded-full px-2 py-1">
              Vence: {formatoFechaCorta(calendario.at(-1)?.fecha_programada)}
            </span>
            {prestamoActivo.dias_cobro_personalizados && (
              <span className="border border-slate-800 rounded-full px-2 py-1">
                Días de cobro:{" "}
                {prestamoActivo.dias_cobro_personalizados.length === 0
                  ? "ninguno fijo"
                  : prestamoActivo.dias_cobro_personalizados.map((d) => DIAS_SEMANA_LABEL[d]).join(", ")}
              </span>
            )}
          </div>

          {puedeCobrar && (
            <div className="flex flex-wrap gap-3">
              {yaPagoHoy ? (
                <span className="inline-flex items-center gap-1.5 text-sm bg-slate-900 border border-slate-800 text-slate-400 rounded-xl px-4 py-3">
                  <CircleCheck className="h-4 w-4" />
                  Ya se cobró el pago de hoy
                </span>
              ) : (
                <form
                  action={aplicarPagoDelDia}
                  className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3"
                >
                  <input type="hidden" name="prestamo_id" value={prestamoActivo.id} />
                  <label className="text-sm text-slate-300" htmlFor="monto">
                    Monto
                  </label>
                  <input
                    id="monto"
                    name="monto"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={prestamoActivo.saldo_actual}
                    defaultValue={prestamoActivo.monto_cuota_sugerida}
                    className="w-28 rounded-md bg-slate-800 border border-slate-700 px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm px-3 py-1.5 rounded-md">
                    <CircleCheck className="h-4 w-4" />
                    Aplicar pago del día
                  </button>
                </form>
              )}
            </div>
          )}
        </>
      )}

      <div>
        <h2 className="font-semibold mb-2 flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-slate-500" />
          Documentos
        </h2>
        {documentosConUrl.length === 0 ? (
          <p className="text-sm text-slate-500">Sin documentos subidos.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {documentosConUrl.map((doc, i) => (
              <a
                key={i}
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-full px-3 py-1"
              >
                <FileText className="h-3 w-3" />
                {ETIQUETAS_DOCUMENTO[doc.tipo]}
              </a>
            ))}
          </div>
        )}
      </div>

      {moras.length > 0 && (
        <div>
          <h2 className="font-semibold mb-2">Moras</h2>
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Día de atraso</th>
                  <th className="px-3 py-2">Monto</th>
                  <th className="px-3 py-2">Saldo resultante</th>
                </tr>
              </thead>
              <tbody>
                {moras.map((m) => (
                  <tr key={m.id} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-400">{formatoFechaCorta(m.fecha_generada)}</td>
                    <td className="px-3 py-2">{m.dia_atraso}</td>
                    <td className="px-3 py-2 text-red-400">{currency(Number(m.monto_mora))}</td>
                    <td className="px-3 py-2">{currency(Number(m.saldo_posterior))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pagos.length > 0 && (
        <div>
          <h2 className="font-semibold mb-2">Pagos registrados</h2>
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Monto</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Saldo resultante</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-400">{formatoFechaCorta(p.fecha_pago?.slice(0, 10))}</td>
                    <td className="px-3 py-2 text-sky-400">{currency(Number(p.monto))}</td>
                    <td className="px-3 py-2 text-slate-400">{p.tipo === "cuota_diaria" ? "Cuota diaria" : p.tipo}</td>
                    <td className="px-3 py-2">{currency(Number(p.saldo_posterior))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {prestamos.length > 1 && (
        <div>
          <h2 className="font-semibold mb-2">Historial de préstamos</h2>
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left">
                <tr>
                  <th className="px-3 py-2">Inicio</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {prestamos.map((p) => (
                  <tr key={p.id} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-400">{formatoFechaCorta(p.fecha_inicio)}</td>
                    <td className="px-3 py-2">{p.plazo_dias} días</td>
                    <td className="px-3 py-2">{currency(Number(p.monto_total))}</td>
                    <td className="px-3 py-2 text-slate-400">{ETIQUETAS_ESTADO_PRESTAMO[p.estado]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Resumen({
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
    <div className={`bg-slate-900 border rounded-xl p-4 flex items-center gap-3 ${destacado ? "border-amber-800" : "border-slate-800"}`}>
      <div className={`shrink-0 rounded-lg p-2 ${toneClasses}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-slate-500 text-xs">{label}</p>
        <p className={`text-lg font-bold ${destacado ? "text-amber-400" : ""}`}>{value}</p>
      </div>
    </div>
  );
}
