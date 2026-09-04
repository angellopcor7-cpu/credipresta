import { createClient } from "@/lib/supabase/server";
import type { SolicitudConCliente, TipoDocumento } from "@/lib/types";
import { rechazarSolicitud } from "./actions";
import { SolicitudAprobarForm } from "./SolicitudAprobarForm";

const ETIQUETAS_DOCUMENTO: Record<TipoDocumento, string> = {
  ine_frente: "INE frente",
  ine_reverso: "INE reverso",
  comprobante_domicilio: "Comprobante domicilio",
  foto_cliente: "Foto",
  contrato_pagare: "Contrato",
  otro: "Otro",
};

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

/** Trae los links (temporales, 1h) a los documentos de cada cliente con solicitud pendiente, para revisarlos antes de aprobar. */
async function obtenerDocumentosPorCliente(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clienteIds: string[]
) {
  if (clienteIds.length === 0) return new Map<string, { tipo: TipoDocumento; url: string }[]>();

  const { data: documentos } = await supabase
    .from("documentos_clientes")
    .select("cliente_id, tipo_documento, storage_path")
    .in("cliente_id", clienteIds);

  const mapa = new Map<string, { tipo: TipoDocumento; url: string }[]>();
  if (!documentos || documentos.length === 0) return mapa;

  const { data: firmados } = await supabase.storage
    .from("documentos-clientes")
    .createSignedUrls(
      documentos.map((d) => d.storage_path),
      3600
    );

  documentos.forEach((doc, i) => {
    const url = firmados?.[i]?.signedUrl;
    if (!url) return;
    const lista = mapa.get(doc.cliente_id) ?? [];
    lista.push({ tipo: doc.tipo_documento, url });
    mapa.set(doc.cliente_id, lista);
  });

  return mapa;
}

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: pendientes }, { data: revisadas }] = await Promise.all([
    supabase
      .from("solicitudes_prestamo")
      .select("*, clientes(nombre_completo, telefono)")
      .in("estado", ["pendiente", "esperando_firma", "firmada"])
      .order("fecha_solicitud", { ascending: true }),
    supabase
      .from("solicitudes_prestamo")
      .select("*, clientes(nombre_completo, telefono)")
      .in("estado", ["aprobada", "rechazada"])
      .order("fecha_revision", { ascending: false })
      .limit(20),
  ]);

  const listaPendientes = (pendientes ?? []) as unknown as SolicitudConCliente[];
  const listaRevisadas = (revisadas ?? []) as unknown as SolicitudConCliente[];
  const documentosPorCliente = await obtenerDocumentosPorCliente(
    supabase,
    listaPendientes.map((s) => s.cliente_id)
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Solicitudes de préstamo</h1>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">{error}</p>
      )}

      <div>
        <h2 className="font-semibold mb-2">Pendientes de revisión ({listaPendientes.length})</h2>
        {listaPendientes.length === 0 ? (
          <p className="text-slate-500 text-sm">No hay solicitudes pendientes.</p>
        ) : (
          <div className="space-y-3">
            {listaPendientes.map((s) => (
              <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{s.clientes?.nombre_completo ?? "—"}</p>
                    <p className="text-slate-500 text-xs">{s.clientes?.telefono ?? "Sin teléfono"}</p>
                  </div>
                  <p className="text-emerald-400 font-semibold">
                    {currency(Number(s.monto_solicitado))} a {s.plazo_dias} días
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(documentosPorCliente.get(s.cliente_id) ?? []).map((doc, i) => (
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
                  {(documentosPorCliente.get(s.cliente_id) ?? []).length === 0 && (
                    <span className="text-xs text-amber-400">Sin documentos subidos</span>
                  )}
                </div>

                <div className="flex flex-wrap items-start gap-4">
                  <SolicitudAprobarForm
                    solicitudId={s.id}
                    montoSolicitado={Number(s.monto_solicitado)}
                    plazoDias={s.plazo_dias}
                    estado={s.estado}
                    porcentajeInteresDiarioPropuesto={
                      s.porcentaje_interes_diario_propuesto !== null
                        ? Number(s.porcentaje_interes_diario_propuesto)
                        : null
                    }
                    firmaClienteDataUrl={s.firma_cliente_data_url}
                  />

                  <form action={rechazarSolicitud} className="flex items-center gap-2">
                    <input type="hidden" name="solicitud_id" value={s.id} />
                    <input
                      name="notas"
                      placeholder="Motivo (opcional)"
                      className="w-40 rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <button className="bg-red-500/90 hover:bg-red-500 text-white font-semibold text-sm px-3 py-1.5 rounded-md">
                      Rechazar
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-semibold mb-2">Revisadas recientemente</h2>
        {listaRevisadas.length === 0 ? (
          <p className="text-slate-500 text-sm">Todavía no has revisado ninguna.</p>
        ) : (
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left">
                <tr>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Monto</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {listaRevisadas.map((s) => (
                  <tr key={s.id} className="border-t border-slate-800">
                    <td className="px-3 py-2">{s.clientes?.nombre_completo ?? "—"}</td>
                    <td className="px-3 py-2">{currency(Number(s.monto_solicitado))}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs border rounded-full px-2 py-1 ${
                          s.estado === "aprobada"
                            ? "bg-emerald-950 text-emerald-400 border-emerald-900"
                            : "bg-red-950 text-red-400 border-red-900"
                        }`}
                      >
                        {s.estado === "aprobada" ? "Aprobada" : "Rechazada"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
