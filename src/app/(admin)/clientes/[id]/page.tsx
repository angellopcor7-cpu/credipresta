import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatoFechaCorta } from "@/lib/format";
import { obtenerConfiguraciones } from "@/lib/config";
import {
  esDiaDeCobro,
  tieneCuotaVencidaSinPagar,
  calcularSemaforoCliente,
  obtenerFechasPagadas,
  type SemaforoCliente,
} from "@/lib/finance/calculos";
import { CalendarioPagosMensual } from "@/components/CalendarioPagosMensual";
import type { CalendarioPago, Cliente, Mora, Pago, Prestamo, SolicitudPrestamo, TipoDocumento } from "@/lib/types";
import {
  ArrowLeft,
  Landmark,
  Wallet,
  TrendingUp,
  PiggyBank,
  CircleCheck,
  CircleAlert,
  Clock,
  FileText,
  Phone,
  MapPin,
  CalendarDays,
  Circle,
} from "lucide-react";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

const ESTADO_CLIENTE_LABEL: Record<string, string> = {
  activo: "Activo",
  pendiente_aprobacion: "Pendiente de aprobación",
  inactivo: "Inactivo",
};

const ESTADO_PRESTAMO_LABEL: Record<string, string> = {
  activo: "Activo",
  en_mora: "En mora",
  liquidado: "Liquidado",
  cancelado: "Cancelado",
};

const SEMAFORO_ESTILO: Record<SemaforoCliente, { color: string; titulo: string }> = {
  verde: { color: "text-green-500", titulo: "Al día — ya pagó hoy, o hoy no le tocaba" },
  amarillo: { color: "text-amber-400", titulo: "Hoy le toca pagar y todavía no registra el pago del día" },
  rojo: { color: "text-red-500", titulo: "Atrasado o con mora" },
  sin_prestamo: { color: "text-ink-muted", titulo: "No tiene un préstamo activo ahorita" },
};

const ETIQUETAS_DOCUMENTO: Record<TipoDocumento, string> = {
  ine_frente: "INE frente",
  ine_reverso: "INE reverso",
  comprobante_domicilio: "Comprobante domicilio",
  foto_cliente: "Foto",
  contrato_pagare: "Contrato",
  pagare_firmado: "Pagaré firmado",
  pagare_impreso: "Pagaré impreso",
  otro: "Otro",
};

type ClienteConCobrador = Cliente & {
  cobradores: { usuarios: { nombre_completo: string } | null } | null;
};

export default async function DetalleClienteAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: clienteData }, config] = await Promise.all([
    supabase.from("clientes").select("*, cobradores(usuarios(nombre_completo))").eq("id", id).maybeSingle(),
    obtenerConfiguraciones(),
  ]);

  if (!clienteData) notFound();
  const cliente = clienteData as unknown as ClienteConCobrador;

  const [{ data: prestamosData }, { data: solicitudesData }, { data: documentosData }] = await Promise.all([
    supabase.from("prestamos").select("*").eq("cliente_id", id).order("created_at", { ascending: false }),
    supabase.from("solicitudes_prestamo").select("*").eq("cliente_id", id).order("fecha_solicitud", { ascending: false }),
    supabase.from("documentos_clientes").select("tipo_documento, storage_path").eq("cliente_id", id),
  ]);

  const prestamos = (prestamosData ?? []) as Prestamo[];
  const solicitudes = (solicitudesData ?? []) as SolicitudPrestamo[];
  // Si pidió un préstamo que está abierto ahorita (activo o en mora), ese es
  // el que importa mostrar. Si no tiene uno abierto, se enseña el último que
  // tuvo (los préstamos ya vienen ordenados del más nuevo al más viejo).
  const prestamoRelevante = prestamos.find((p) => p.estado === "activo" || p.estado === "en_mora") ?? prestamos[0];
  const solicitudPendiente = solicitudes.find((s) => s.estado === "pendiente");

  const [{ data: pagosData }, { data: calendarioData }, { data: morasData }] = await Promise.all([
    prestamoRelevante
      ? supabase.from("pagos").select("*").eq("prestamo_id", prestamoRelevante.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Pago[] }),
    prestamoRelevante
      ? supabase.from("calendario_pagos").select("*").eq("prestamo_id", prestamoRelevante.id).order("numero_dia")
      : Promise.resolve({ data: [] as CalendarioPago[] }),
    prestamoRelevante
      ? supabase.from("moras").select("*").eq("prestamo_id", prestamoRelevante.id).order("fecha_generada", { ascending: false })
      : Promise.resolve({ data: [] as Mora[] }),
  ]);

  const pagos = (pagosData ?? []) as Pago[];
  const calendario = (calendarioData ?? []) as CalendarioPago[];
  const moras = (morasData ?? []) as Mora[];

  const hoy = new Date().toISOString().slice(0, 10);
  const cantidadPagosCuota = pagos.filter((p) => p.tipo === "cuota_diaria").length;
  const fechasPagadas = obtenerFechasPagadas(
    calendario.map((d) => ({ numeroDia: d.numero_dia, fechaProgramada: d.fecha_programada })),
    cantidadPagosCuota
  );

  const tienePrestamoAbierto = !!prestamoRelevante && (prestamoRelevante.estado === "activo" || prestamoRelevante.estado === "en_mora");
  const abonado = prestamoRelevante ? Number(prestamoRelevante.monto_total) - Number(prestamoRelevante.saldo_actual) : 0;
  const progreso =
    prestamoRelevante && Number(prestamoRelevante.monto_total) > 0
      ? Math.min(100, Math.round((abonado / Number(prestamoRelevante.monto_total)) * 100))
      : 0;

  const semaforo: SemaforoCliente = !tienePrestamoAbierto
    ? "sin_prestamo"
    : calcularSemaforoCliente({
        tienePrestamoActivo: true,
        enMora: prestamoRelevante!.estado === "en_mora",
        moraAcumulada: Number(prestamoRelevante!.mora_acumulada),
        tieneCuotaVencida: tieneCuotaVencidaSinPagar(
          calendario.map((d) => ({ fechaProgramada: d.fecha_programada, estado: d.estado })),
          hoy
        ),
        esDiaDeCobroHoy: esDiaDeCobro(
          new Date(`${hoy}T00:00:00Z`),
          Number(prestamoRelevante!.monto_prestado),
          config.reglaDiasCobro,
          prestamoRelevante!.dias_cobro_personalizados
        ),
        yaPagoHoy: pagos.some((p) => p.tipo === "cuota_diaria" && p.fecha_pago?.slice(0, 10) === hoy),
      });
  const estiloSemaforo = SEMAFORO_ESTILO[semaforo];

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

  return (
    <div className="space-y-6">
      <div>
        <Link href="/clientes" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" />
          Clientes
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
          <div className="flex items-center gap-3">
            <div className="shrink-0 h-12 w-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-neutral-950 font-bold">
              {iniciales(cliente.nombre_completo)}
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight flex items-center gap-2">
                {cliente.nombre_completo}
                <span title={estiloSemaforo.titulo}>
                  <Circle className={`h-3 w-3 ${estiloSemaforo.color} fill-current`} aria-hidden="true" />
                  <span className="sr-only">{estiloSemaforo.titulo}</span>
                </span>
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-ink-muted text-sm">
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {cliente.telefono ?? "Sin teléfono"}
                </span>
                {cliente.direccion && (
                  <span className="inline-flex items-center gap-1 text-xs">
                    <MapPin className="h-3.5 w-3.5" />
                    {cliente.direccion}
                  </span>
                )}
              </div>
            </div>
          </div>

          {cliente.cobrador_id ? (
            <Link
              href={`/cobradores/${cliente.cobrador_id}`}
              className="shrink-0 inline-flex items-center text-xs bg-surface-2 hover:bg-surface-3 border border-border-strong text-ink-strong rounded-full px-3 py-1"
            >
              Cliente de {cliente.cobradores?.usuarios?.nombre_completo ?? "—"}
            </Link>
          ) : (
            <span className="shrink-0 text-xs text-ink-muted">Sin cobrador asignado</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
        <span className="border border-border-strong rounded-full px-2 py-1">{ESTADO_CLIENTE_LABEL[cliente.estado]}</span>
        {cliente.identificacion && <span>Identificación: {cliente.identificacion}</span>}
        {cliente.referencia_personal && <span>Referencia: {cliente.referencia_personal}</span>}
      </div>
      {cliente.notas && <p className="text-sm text-ink-secondary bg-surface border border-border rounded-md px-3 py-2">{cliente.notas}</p>}

      {solicitudPendiente && (
        <div className="flex items-start gap-2 bg-accent-chip-bg/50 border border-accent-chip-border rounded-md px-4 py-3 text-sm text-accent-text">
          <Clock className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Tiene una solicitud pendiente de {currency(Number(solicitudPendiente.monto_solicitado))} a{" "}
            {solicitudPendiente.plazo_dias} días esperando revisión.{" "}
            <Link href="/solicitudes" className="underline">
              Ir a Solicitudes
            </Link>
          </p>
        </div>
      )}

      {!prestamoRelevante ? (
        <p className="text-ink-muted text-sm">Este cliente todavía no tiene ningún préstamo.</p>
      ) : (
        <>
          {!tienePrestamoAbierto && (
            <p className="text-xs text-ink-muted bg-surface border border-border rounded-md px-3 py-2">
              Este cliente no tiene un préstamo abierto ahorita — se muestra su último préstamo ({ESTADO_PRESTAMO_LABEL[prestamoRelevante.estado]}).
            </p>
          )}

          <div className="grid sm:grid-cols-5 gap-4">
            <Resumen icon={Landmark} label="Prestado" value={currency(Number(prestamoRelevante.monto_prestado))} tone="neutral" />
            <Resumen icon={Wallet} label="Total con interés" value={currency(Number(prestamoRelevante.monto_total))} tone="amber" />
            <Resumen icon={TrendingUp} label="Abonado" value={currency(abonado)} tone="neutral" />
            <Resumen
              icon={CircleAlert}
              label="Mora"
              value={currency(Number(prestamoRelevante.mora_acumulada))}
              tone={Number(prestamoRelevante.mora_acumulada) > 0 ? "red" : "neutral"}
              destacado={Number(prestamoRelevante.mora_acumulada) > 0}
            />
            <Resumen
              icon={PiggyBank}
              label="Saldo (con mora)"
              value={currency(Number(prestamoRelevante.saldo_actual) + Number(prestamoRelevante.mora_acumulada))}
              tone="amber"
              destacado
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-ink-muted">
              <span>Progreso del préstamo</span>
              <span>{progreso}%</span>
            </div>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${prestamoRelevante.estado === "en_mora" ? "bg-red-500" : "bg-amber-500"}`}
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <span
              className={`inline-flex items-center gap-1 border rounded-full px-2 py-1 ${
                prestamoRelevante.estado === "en_mora"
                  ? "bg-danger-chip-bg text-danger-text border-danger-chip-border"
                  : prestamoRelevante.estado === "activo"
                    ? "bg-surface-2 text-ink-strong border-border-soft"
                    : "border-border-strong"
              }`}
            >
              {prestamoRelevante.estado === "en_mora" ? <CircleAlert className="h-3.5 w-3.5" /> : <CircleCheck className="h-3.5 w-3.5" />}
              {ESTADO_PRESTAMO_LABEL[prestamoRelevante.estado]}
            </span>
            <span className="inline-flex items-center gap-1 border border-border rounded-full px-2 py-1">
              <CalendarDays className="h-3.5 w-3.5" />
              Plan {prestamoRelevante.plazo_dias} días
            </span>
            <span className="border border-border rounded-full px-2 py-1">
              Pago diario: {currency(Number(prestamoRelevante.monto_cuota_sugerida))}
            </span>
            <span className="border border-border rounded-full px-2 py-1">Inicio: {formatoFechaCorta(prestamoRelevante.fecha_inicio)}</span>
            <span className="border border-border rounded-full px-2 py-1">
              Vence: {formatoFechaCorta(calendario.at(-1)?.fecha_programada)}
            </span>
            <Link
              href={`/prestamos/${prestamoRelevante.id}`}
              className="inline-flex items-center gap-1 text-accent-text hover:underline"
            >
              Ver préstamo completo →
            </Link>
          </div>

          {calendario.length > 0 && (
            <div>
              <h2 className="font-semibold mb-2 flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-ink-muted" />
                Calendario de pagos
              </h2>
              <CalendarioPagosMensual calendario={calendario} fechasPagadas={fechasPagadas} hoy={hoy} />
            </div>
          )}
        </>
      )}

      <div>
        <h2 className="font-semibold mb-2 flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-ink-muted" />
          Documentos
        </h2>
        {documentosConUrl.length === 0 ? (
          <p className="text-sm text-ink-muted">Sin documentos subidos.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {documentosConUrl.map((doc, i) => (
              <a
                key={i}
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs bg-surface-2 hover:bg-surface-3 text-ink-strong border border-border-strong rounded-full px-3 py-1"
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
          <h2 className="font-semibold mb-2">Moras del préstamo mostrado</h2>
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface text-ink-muted text-left">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Día de atraso</th>
                  <th className="px-3 py-2">Monto</th>
                  <th className="px-3 py-2">Saldo resultante</th>
                </tr>
              </thead>
              <tbody>
                {moras.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-3 py-2 text-ink-muted">{formatoFechaCorta(m.fecha_generada)}</td>
                    <td className="px-3 py-2">{m.dia_atraso}</td>
                    <td className="px-3 py-2 text-danger-text">{currency(Number(m.monto_mora))}</td>
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
          <h2 className="font-semibold mb-2">Pagos registrados del préstamo mostrado</h2>
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface text-ink-muted text-left">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Monto</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Saldo resultante</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-2 text-ink-muted">{formatoFechaCorta(p.fecha_pago?.slice(0, 10))}</td>
                    <td className="px-3 py-2">{currency(Number(p.monto))}</td>
                    <td className="px-3 py-2 text-ink-muted">{p.tipo === "cuota_diaria" ? "Cuota diaria" : p.tipo}</td>
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
          <h2 className="font-semibold mb-2">Historial de préstamos ({prestamos.length})</h2>
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface text-ink-muted text-left">
                <tr>
                  <th className="px-3 py-2">Inicio</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {prestamos.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-2 text-ink-muted">{formatoFechaCorta(p.fecha_inicio)}</td>
                    <td className="px-3 py-2">{p.plazo_dias} días</td>
                    <td className="px-3 py-2">{currency(Number(p.monto_total))}</td>
                    <td className="px-3 py-2 text-ink-muted">{ESTADO_PRESTAMO_LABEL[p.estado]}</td>
                    <td className="px-3 py-2">
                      <Link href={`/prestamos/${p.id}`} className="text-accent-text hover:underline">
                        Ver →
                      </Link>
                    </td>
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
  tone: "amber" | "neutral" | "red";
  destacado?: boolean;
}) {
  const toneClasses =
    tone === "amber"
      ? "bg-amber-500/10 text-accent-text"
      : tone === "red"
        ? "bg-danger-chip-bg text-danger-text"
        : "bg-surface-2 text-ink-secondary";
  const colorValor = tone === "red" ? "text-danger-text" : "text-accent-text";
  return (
    <div
      className={`bg-surface border rounded-xl p-4 flex items-center gap-3 ${
        destacado ? (tone === "red" ? "border-danger-chip-border" : "border-accent-chip-border") : "border-border"
      }`}
    >
      <div className={`shrink-0 rounded-lg p-2 ${toneClasses}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-ink-muted text-xs">{label}</p>
        <p className={`text-lg font-bold ${destacado ? colorValor : ""}`}>{value}</p>
      </div>
    </div>
  );
}
