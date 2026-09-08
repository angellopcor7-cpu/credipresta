import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirVistaCobrador } from "@/lib/auth/roles";
import { formatoFechaCorta } from "@/lib/format";
import { aplicarPagoDelDia, marcarIncumplidoDelDia } from "../../../actions";
import type { CalendarioPago, Cliente, Mora, Pago, Prestamo, SolicitudPrestamo, TipoDocumento } from "@/lib/types";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
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

  const puedeCobrar = !!prestamoActivo && (prestamoActivo.estado === "activo" || prestamoActivo.estado === "en_mora");
  const abonado = prestamoActivo ? Number(prestamoActivo.monto_total) - Number(prestamoActivo.saldo_actual) : 0;
  const solicitudPendiente = solicitudes.find((s) => s.estado === "pendiente");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/panel" className="text-sm text-slate-400 hover:text-white">
          ← Mis clientes
        </Link>
        <h1 className="text-2xl font-bold mt-1">{cliente.nombre_completo}</h1>
        <p className="text-slate-400 text-sm">{cliente.telefono ?? "Sin teléfono"}</p>
        {cliente.direccion && <p className="text-slate-500 text-xs">{cliente.direccion}</p>}
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">{error}</p>
      )}
      {exito && (
        <p className="text-sm text-emerald-400 bg-emerald-950/50 border border-emerald-900 rounded-md px-3 py-2">
          {exito}
        </p>
      )}

      {cliente.estado === "pendiente_aprobacion" && (
        <div className="bg-amber-950/50 border border-amber-900 rounded-md px-4 py-3 text-sm text-amber-300">
          {solicitudPendiente ? (
            <>
              Esperando que Empresa apruebe la solicitud de {currency(Number(solicitudPendiente.monto_solicitado))} a{" "}
              {solicitudPendiente.plazo_dias} días.
            </>
          ) : (
            "Esperando aprobación de Empresa."
          )}
        </div>
      )}

      {prestamoActivo && (
        <>
          <div className="grid sm:grid-cols-4 gap-4">
            <Resumen label="Prestado" value={currency(Number(prestamoActivo.monto_prestado))} />
            <Resumen label="Total con interés" value={currency(Number(prestamoActivo.monto_total))} />
            <Resumen label="Abonado" value={currency(abonado)} />
            <Resumen label="Saldo" value={currency(Number(prestamoActivo.saldo_actual))} destacado />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <span className="border border-slate-700 rounded-full px-2 py-1">
              {ETIQUETAS_ESTADO_PRESTAMO[prestamoActivo.estado]}
            </span>
            <span>Plan: {prestamoActivo.plazo_dias} días</span>
            <span>Pago diario: {currency(Number(prestamoActivo.monto_cuota_sugerida))}</span>
            <span>Inicio: {formatoFechaCorta(prestamoActivo.fecha_inicio)}</span>
            <span>Vence: {formatoFechaCorta(calendario.at(-1)?.fecha_programada)}</span>
            {prestamoActivo.dias_cobro_personalizados && (
              <span>
                Días de cobro:{" "}
                {prestamoActivo.dias_cobro_personalizados.length === 0
                  ? "ninguno fijo"
                  : prestamoActivo.dias_cobro_personalizados.map((d) => DIAS_SEMANA_LABEL[d]).join(", ")}
              </span>
            )}
          </div>

          {puedeCobrar && (
            <div className="flex flex-wrap gap-3">
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
                <button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm px-3 py-1.5 rounded-md">
                  Aplicar pago del día
                </button>
              </form>

              <form action={marcarIncumplidoDelDia} className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <input type="hidden" name="prestamo_id" value={prestamoActivo.id} />
                <button className="text-sm bg-red-500/90 hover:bg-red-500 text-white font-semibold px-3 py-1.5 rounded-md">
                  No pagó hoy (marcar incumplido)
                </button>
              </form>
            </div>
          )}
        </>
      )}

      <div>
        <h2 className="font-semibold mb-2">Documentos</h2>
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
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-full px-3 py-1"
              >
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
                    <td className="px-3 py-2 text-emerald-400">{currency(Number(p.monto))}</td>
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

function Resumen({ label, value, destacado }: { label: string; value: string; destacado?: boolean }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <p className="text-slate-500 text-xs">{label}</p>
      <p className={`text-xl font-bold ${destacado ? "text-amber-400" : ""}`}>{value}</p>
    </div>
  );
}
