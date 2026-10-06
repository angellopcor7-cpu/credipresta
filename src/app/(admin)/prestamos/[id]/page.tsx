import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatoFechaCorta } from "@/lib/format";
import { obtenerConfiguraciones } from "@/lib/config";
import { InfoDiasCobro } from "@/components/InfoDiasCobro";
import type { CalendarioPago, Mora, Pago, Prestamo, TipoDocumento } from "@/lib/types";
import { AjusteMoraForm } from "./AjusteMoraForm";

const ETIQUETAS_DOCUMENTO: Partial<Record<TipoDocumento, string>> = {
  ine_frente: "INE frente",
  ine_reverso: "INE reverso",
  foto_cliente: "Foto del cliente",
  comprobante_domicilio: "Comprobante de domicilio",
};

const ORDEN_DOCUMENTOS: TipoDocumento[] = ["ine_frente", "ine_reverso", "foto_cliente", "comprobante_domicilio"];

type PrestamoConClienteDetalle = Prestamo & {
  clientes: { nombre_completo: string; telefono: string | null } | null;
  usuarios: { nombre_completo: string } | null;
};

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

const estadoLabel: Record<string, string> = {
  activo: "Activo",
  en_mora: "En mora",
  liquidado: "Liquidado",
  cancelado: "Cancelado",
};

export default async function DetallePrestamoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; exito?: string }>;
}) {
  const { id } = await params;
  const { error, exito } = await searchParams;
  const supabase = await createClient();

  const [{ data: prestamo }, { data: pagos }, { data: calendario }, { data: moras }, config] = await Promise.all([
    supabase
      .from("prestamos")
      .select("*, clientes(nombre_completo, telefono), usuarios!prestamos_creado_por_fkey(nombre_completo)")
      .eq("id", id)
      .single(),
    supabase.from("pagos").select("*").eq("prestamo_id", id).order("created_at", { ascending: false }),
    supabase.from("calendario_pagos").select("*").eq("prestamo_id", id).order("numero_dia"),
    supabase.from("moras").select("*").eq("prestamo_id", id).order("fecha_generada", { ascending: false }),
    obtenerConfiguraciones(),
  ]);

  if (!prestamo) notFound();

  const p = prestamo as unknown as PrestamoConClienteDetalle;
  const listaPagos = (pagos ?? []) as Pago[];
  const listaCalendario = (calendario ?? []) as CalendarioPago[];
  const listaMoras = (moras ?? []) as Mora[];
  const puedeRecibirPagos = p.estado === "activo" || p.estado === "en_mora";

  // Documentos del cliente (INE, foto, domicilio) — de solo lectura aquí; se
  // suben desde el alta que hace el cobrador en su panel.
  const { data: documentosData } = await supabase
    .from("documentos_clientes")
    .select("tipo_documento, storage_path")
    .eq("cliente_id", p.cliente_id);

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
      .filter((d) => d.url && ORDEN_DOCUMENTOS.includes(d.tipo))
      .sort((a, b) => ORDEN_DOCUMENTOS.indexOf(a.tipo) - ORDEN_DOCUMENTOS.indexOf(b.tipo));
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/prestamos" className="text-sm text-ink-muted hover:text-ink">
          ← Préstamos
        </Link>
        <div className="flex items-center justify-between gap-3 mt-1">
          <div>
            <h1 className="text-2xl font-bold">{p.clientes?.nombre_completo ?? "—"}</h1>
            <p className="text-ink-muted text-sm">{p.clientes?.telefono ?? "Sin teléfono"}</p>
          </div>
          <a
            href={`/prestamos/${p.id}/pagare`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-sm bg-surface-2 hover:bg-surface-3 border border-border-strong text-ink font-medium rounded-md px-4 py-2"
          >
            Descargar pagaré (PDF)
          </a>
        </div>
      </div>

      <div className="grid sm:grid-cols-5 gap-4">
        <Resumen label="Prestado" value={currency(Number(p.monto_prestado))} />
        <Resumen label="Interés" value={`${p.porcentaje_interes}%`} />
        <Resumen label="Total a pagar" value={currency(Number(p.monto_total))} />
        <Resumen label="Saldo actual" value={currency(Number(p.saldo_actual))} destacado />
        <Resumen
          label="Mora acumulada"
          value={currency(Number(p.mora_acumulada))}
          destacado={Number(p.mora_acumulada) > 0}
          peligro={Number(p.mora_acumulada) > 0}
        />
      </div>
      <p className="text-sm text-ink-muted -mt-2">
        Falta por cobrar en total (saldo + mora):{" "}
        <span className="font-semibold text-ink">
          {currency(Number(p.saldo_actual) + Number(p.mora_acumulada))}
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
        <span className="border border-border-strong rounded-full px-2 py-1">{estadoLabel[p.estado]}</span>
        <span>Plazo: {p.plazo_dias} días</span>
        <span>Cuota sugerida: {currency(Number(p.monto_cuota_sugerida))}</span>
        <span>Inicio: {formatoFechaCorta(p.fecha_inicio)}</span>
        <span>Fecha límite: {formatoFechaCorta(listaCalendario.at(-1)?.fecha_programada)}</span>
        <span>Cobrador (pagaré): {p.usuarios?.nombre_completo ?? "Administración de CrediPresta"}</span>
        <span>
          Pago: {p.metodo_pago === "efectivo" ? "Efectivo" : p.metodo_pago === "transferencia" ? "Transferencia" : "Efectivo o transferencia"}
        </span>
      </div>

      {p.datos_transferencia && (
        <div className="bg-surface border border-border rounded-lg p-3 text-sm text-ink-secondary">
          <p className="text-ink-muted text-xs mb-1">Datos de transferencia compartidos con el cliente</p>
          <p className="whitespace-pre-line">{p.datos_transferencia}</p>
        </div>
      )}

      {error && (
        <p className="text-sm text-danger-text bg-danger-chip-bg/50 border border-danger-chip-border rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {exito && (
        <p className="text-sm text-accent-text bg-accent-chip-bg/50 border border-accent-chip-border rounded-md px-3 py-2">
          {exito}
        </p>
      )}

      <p className="text-xs text-ink-muted bg-surface border border-border rounded-md px-3 py-2 max-w-2xl">
        El cobro de pagos y la mora diaria se manejan desde el panel del cobrador. Aquí solo se ven los datos del
        préstamo{Number(p.mora_acumulada) > 0 ? " y se puede perdonar o reducir la mora si Empresa lo negoció con el cliente." : "."}
      </p>

      {puedeRecibirPagos && Number(p.mora_acumulada) > 0 && (
        <AjusteMoraForm prestamoId={p.id} moraActual={Number(p.mora_acumulada)} />
      )}

      <div>
        <h2 className="font-semibold mb-2 flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-ink-muted" />
          Documentos del cliente
        </h2>
        {documentosConUrl.length === 0 ? (
          <p className="text-sm text-ink-muted">Sin documentos subidos.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
            {documentosConUrl.map((doc, i) => (
              <a
                key={i}
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="block group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={doc.url}
                  alt={ETIQUETAS_DOCUMENTO[doc.tipo] ?? doc.tipo}
                  className="w-full h-28 object-cover rounded-lg border border-border group-hover:border-amber-500/60"
                />
                <p className="text-xs text-ink-muted mt-1 text-center">{ETIQUETAS_DOCUMENTO[doc.tipo] ?? doc.tipo}</p>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <h2 className="font-semibold mb-2">Historial de pagos</h2>
          {listaPagos.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin pagos registrados.</p>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface text-ink-muted text-left">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Monto</th>
                    <th className="px-3 py-2">Saldo después</th>
                  </tr>
                </thead>
                <tbody>
                  {listaPagos.map((pago) => (
                    <tr key={pago.id} className="border-t border-border">
                      <td className="px-3 py-2 text-ink-secondary">{pago.fecha_pago}</td>
                      <td className="px-3 py-2">{currency(Number(pago.monto))}</td>
                      <td className="px-3 py-2 text-ink-secondary">
                        {pago.saldo_posterior !== null ? currency(Number(pago.saldo_posterior)) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h2 className="font-semibold mb-2">Historial de moras</h2>
          {listaMoras.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin moras aplicadas.</p>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface text-ink-muted text-left">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Día atraso</th>
                    <th className="px-3 py-2">Monto</th>
                    <th className="px-3 py-2">Saldo después</th>
                  </tr>
                </thead>
                <tbody>
                  {listaMoras.map((mora) => (
                    <tr key={mora.id} className="border-t border-border">
                      <td className="px-3 py-2 text-ink-secondary">{mora.fecha_generada}</td>
                      <td className="px-3 py-2 text-ink-secondary">{mora.dia_atraso}</td>
                      <td className="px-3 py-2 text-accent-text">{currency(Number(mora.monto_mora))}</td>
                      <td className="px-3 py-2 text-ink-secondary">{currency(Number(mora.saldo_posterior))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h2 className="font-semibold mb-2">Calendario de cobro</h2>
          <div className="mb-3">
            <InfoDiasCobro
              umbral={config.umbralMora}
              diasMenorUmbral={config.diasCobroMenorUmbral}
              diasMayorIgualUmbral={config.diasCobroMayorIgualUmbral}
            />
          </div>
          <div className="border border-border rounded-xl overflow-hidden max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-ink-muted text-left sticky top-0">
                <tr>
                  <th className="px-3 py-2">Día</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Monto esperado</th>
                </tr>
              </thead>
              <tbody>
                {listaCalendario.map((d) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-3 py-2 text-ink-secondary">{d.numero_dia}</td>
                    <td className="px-3 py-2 text-ink-secondary">{d.fecha_programada}</td>
                    <td className="px-3 py-2">{currency(Number(d.monto_esperado))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Resumen({
  label,
  value,
  destacado = false,
  peligro = false,
}: {
  label: string;
  value: string;
  destacado?: boolean;
  peligro?: boolean;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <p className="text-ink-muted text-xs">{label}</p>
      <p
        className={`text-xl font-semibold mt-1 ${
          peligro ? "text-danger-text" : destacado ? "text-accent-text" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
