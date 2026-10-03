import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  UserRound,
  Users,
  Landmark,
  Wallet,
  TrendingUp,
  CircleAlert,
  CircleCheck,
  CircleX,
  UserPlus,
  Clock,
  ChevronRight,
  FileText,
  Route,
  UserRoundCog,
  Scissors,
  type LucideIcon,
} from "lucide-react";
import type { PuntoOtorgadoCobrado, PuntoMora } from "./AnalisisCharts";
import { AnalisisPeriodos } from "./AnalisisPeriodos";
import { claveMes, ultimosMeses, claveDia, ultimosDias, claveSemana, ultimasSemanas } from "@/lib/fechas";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

/** A diferencia de formatoFechaCorta (que es para fechas sin hora), esto formatea un timestamptz completo. */
function formatoFechaHora(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(new Date(iso));
}

const ICONO_MOVIMIENTO: Record<string, LucideIcon> = {
  pago: CircleCheck,
  mora: CircleAlert,
  ajuste_mora: CircleCheck,
  aprobacion_solicitud: CircleCheck,
  rechazo_solicitud: CircleX,
  creacion_cobrador: UserPlus,
  reasignacion_cliente: UserRoundCog,
};

const COLOR_MOVIMIENTO: Record<string, string> = {
  pago: "text-ink-secondary bg-surface-2",
  mora: "text-danger-text bg-danger-chip-bg",
  ajuste_mora: "text-accent-text bg-accent-chip-bg",
  aprobacion_solicitud: "text-accent-text bg-accent-chip-bg",
  rechazo_solicitud: "text-danger-text bg-danger-chip-bg",
  creacion_cobrador: "text-ink-secondary bg-surface-2",
  reasignacion_cliente: "text-ink-secondary bg-surface-2",
};

const ETIQUETA_MOVIMIENTO: Record<string, string> = {
  pago: "Pago registrado",
  mora: "Mora aplicada",
  ajuste_mora: "Ajuste de mora",
  aprobacion_solicitud: "Solicitud aprobada",
  rechazo_solicitud: "Solicitud rechazada",
  creacion_cobrador: "Cobrador dado de alta",
  reasignacion_cliente: "Cliente reasignado",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: clientesCount },
    { count: cobradoresCount },
    { data: prestamos },
    { count: solicitudesPendientesCount },
    { data: actividadReciente },
    { data: todasLasMoras },
    { data: todosLosPagos },
    { data: clientesActivosPorCobrador },
    { data: cobradoresActivos },
  ] = await Promise.all([
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("estado", "activo"),
    supabase.from("cobradores").select("*", { count: "exact", head: true }).eq("activo", true),
    supabase
      .from("prestamos")
      .select("estado, saldo_actual, mora_acumulada, monto_prestado, created_at, cobrador_id"),
    supabase.from("solicitudes_prestamo").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase
      .from("historial_movimientos")
      .select("id, tipo_movimiento, descripcion, monto, created_at, clientes(nombre_completo)")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("moras").select("monto_mora, fecha_generada"),
    supabase.from("pagos").select("monto, fecha_pago"),
    supabase.from("clientes").select("cobrador_id").eq("estado", "activo"),
    supabase.from("cobradores").select("id, zona, usuarios(nombre_completo)").eq("activo", true),
  ]);

  const listaPrestamos = prestamos ?? [];
  const activos = listaPrestamos.filter((p) => p.estado === "activo" || p.estado === "en_mora");
  const enMora = listaPrestamos.filter((p) => p.estado === "en_mora");
  const carteraActiva = activos.reduce((s, p) => s + Number(p.saldo_actual), 0);
  const totalPrestado = listaPrestamos.reduce((s, p) => s + Number(p.monto_prestado), 0);
  const moraTotal = activos.reduce((s, p) => s + Number(p.mora_acumulada), 0);
  const solicitudesPendientes = solicitudesPendientesCount ?? 0;

  const stats: { label: string; value: string; icon: LucideIcon; tono: "neutral" | "amber" | "red" }[] = [
    { label: "Clientes activos", value: String(clientesCount ?? 0), icon: UserRound, tono: "neutral" },
    { label: "Cobradores activos", value: String(cobradoresCount ?? 0), icon: Users, tono: "neutral" },
    { label: "Préstamos activos", value: String(activos.length), icon: Landmark, tono: "neutral" },
    { label: "Préstamos en mora", value: String(enMora.length), icon: CircleAlert, tono: enMora.length > 0 ? "red" : "neutral" },
    { label: "Cartera pendiente", value: currency(carteraActiva), icon: Wallet, tono: "amber" },
    { label: "Mora pendiente", value: currency(moraTotal), icon: CircleAlert, tono: moraTotal > 0 ? "red" : "neutral" },
    { label: "Total prestado (histórico)", value: currency(totalPrestado), icon: TrendingUp, tono: "neutral" },
  ];

  const colorIcono: Record<string, string> = {
    neutral: "text-ink-muted",
    amber: "text-accent-text",
    red: "text-danger-text",
  };
  const colorValor: Record<string, string> = {
    neutral: "text-ink",
    amber: "text-accent-text",
    red: "text-danger-text",
  };
  const bordeTono: Record<string, string> = {
    neutral: "border-border",
    amber: "border-border",
    red: "border-danger-chip-border/50",
  };

  const accesos: { label: string; href: string; icon: LucideIcon }[] = [
    { label: "Solicitudes", href: "/solicitudes", icon: FileText },
    { label: "Clientes", href: "/clientes", icon: UserRound },
    { label: "Cobradores", href: "/cobradores", icon: Users },
    { label: "Préstamos", href: "/prestamos", icon: Landmark },
    { label: "Rutas", href: "/rutas", icon: Route },
    { label: "Hacer corte", href: "/corte", icon: Scissors },
  ];

  // --- Análisis: tendencias por periodo (semana = días, mes = semanas, 6 meses = meses) ---
  function construirAnalisis(
    buckets: { clave: string; etiqueta: string }[],
    claveDe: (fechaTexto: string) => string
  ): { otorgadoCobrado: PuntoOtorgadoCobrado[]; mora: PuntoMora[] } {
    const otorgadoPor = new Map(buckets.map((b) => [b.clave, 0]));
    for (const p of listaPrestamos) {
      if (!p.created_at) continue;
      const clave = claveDe(p.created_at);
      if (otorgadoPor.has(clave)) otorgadoPor.set(clave, otorgadoPor.get(clave)! + Number(p.monto_prestado));
    }

    const cobradoPor = new Map(buckets.map((b) => [b.clave, 0]));
    for (const pago of todosLosPagos ?? []) {
      const clave = claveDe(pago.fecha_pago);
      if (cobradoPor.has(clave)) cobradoPor.set(clave, cobradoPor.get(clave)! + Number(pago.monto));
    }

    const moraPor = new Map(buckets.map((b) => [b.clave, 0]));
    for (const mora of todasLasMoras ?? []) {
      const clave = claveDe(mora.fecha_generada);
      if (moraPor.has(clave)) moraPor.set(clave, moraPor.get(clave)! + Number(mora.monto_mora));
    }

    return {
      otorgadoCobrado: buckets.map((b) => ({
        mes: b.etiqueta,
        otorgado: otorgadoPor.get(b.clave) ?? 0,
        cobrado: cobradoPor.get(b.clave) ?? 0,
      })),
      mora: buckets.map((b) => ({ mes: b.etiqueta, monto: moraPor.get(b.clave) ?? 0 })),
    };
  }

  const analisisSemana = construirAnalisis(ultimosDias(7), claveDia);
  const analisisMes = construirAnalisis(ultimasSemanas(5), claveSemana);
  const analisisSeisMeses = construirAnalisis(ultimosMeses(6), claveMes);

  // --- Análisis: desempeño por cobrador ---
  const filasCobrador = (cobradoresActivos ?? [])
    .map((c) => {
      const cobrador = c as unknown as { id: string; zona: string | null; usuarios: { nombre_completo: string } | null };
      const clientesActivos = (clientesActivosPorCobrador ?? []).filter(
        (cl) => cl.cobrador_id === cobrador.id
      ).length;
      const prestamosActivosCobrador = listaPrestamos.filter(
        (p) => p.cobrador_id === cobrador.id && (p.estado === "activo" || p.estado === "en_mora")
      );
      const carteraCobrador = prestamosActivosCobrador.reduce((s, p) => s + Number(p.saldo_actual), 0);
      const moraCobrador = prestamosActivosCobrador.reduce((s, p) => s + Number(p.mora_acumulada), 0);
      return {
        id: cobrador.id,
        nombre: cobrador.usuarios?.nombre_completo ?? "—",
        zona: cobrador.zona,
        clientesActivos,
        carteraActiva: carteraCobrador,
        moraPendiente: moraCobrador,
      };
    })
    .sort((a, b) => b.carteraActiva - a.carteraActiva);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Panel</h1>
        <p className="text-ink-muted text-sm mt-1">Resumen general de CrediPresta.</p>
      </div>

      {solicitudesPendientes > 0 && (
        <Link
          href="/solicitudes"
          className="flex items-center justify-between gap-3 bg-amber-500/10 border border-amber-600/40 rounded-xl px-5 py-4 hover:bg-amber-500/15 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-500/20 p-2 shrink-0">
              <Clock className="h-5 w-5 text-accent-text" />
            </div>
            <div>
              <p className="font-semibold text-accent-text">
                {solicitudesPendientes} {solicitudesPendientes === 1 ? "solicitud" : "solicitudes"} esperando aprobación
              </p>
              <p className="text-xs text-accent-text/70">Revísalas antes de que el cliente se quede esperando.</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-accent-text shrink-0" />
        </Link>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`bg-surface border rounded-xl p-4 ${bordeTono[s.tono]}`}>
            <div className="flex items-center gap-1.5 text-ink-muted">
              <s.icon className={`h-3.5 w-3.5 ${colorIcono[s.tono]}`} />
              <p className="text-xs">{s.label}</p>
            </div>
            <p className={`text-xl font-semibold mt-2 ${colorValor[s.tono]}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-ink-secondary mb-3">Accesos rápidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {accesos.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex flex-col items-center gap-2 bg-surface border border-border hover:border-amber-500/50 hover:bg-surface-2 rounded-xl p-4 text-center transition-colors"
            >
              <div className="rounded-full bg-surface-2 p-2">
                <a.icon className="h-5 w-5 text-accent-text" />
              </div>
              <span className="text-sm text-ink-strong">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <AnalisisPeriodos
        semana={analisisSemana}
        mes={analisisMes}
        seisMeses={analisisSeisMeses}
      />

      {filasCobrador.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-ink-secondary mb-3">Desempeño por cobrador</h2>
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface text-ink-muted text-left">
                <tr>
                  <th className="px-4 py-3">Cobrador</th>
                  <th className="px-4 py-3">Zona</th>
                  <th className="px-4 py-3">Clientes activos</th>
                  <th className="px-4 py-3">Cartera activa</th>
                  <th className="px-4 py-3">Mora pendiente</th>
                </tr>
              </thead>
              <tbody>
                {filasCobrador.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{c.nombre}</td>
                    <td className="px-4 py-3 text-ink-secondary">{c.zona ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-secondary">{c.clientesActivos}</td>
                    <td className="px-4 py-3 text-ink-secondary">{currency(c.carteraActiva)}</td>
                    <td className={`px-4 py-3 ${c.moraPendiente > 0 ? "text-danger-text" : "text-ink-secondary"}`}>
                      {currency(c.moraPendiente)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {actividadReciente && actividadReciente.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-ink-secondary mb-3">Actividad reciente</h2>
          <div className="bg-surface border border-border rounded-xl divide-y divide-border">
            {actividadReciente.map((m) => {
              const Icono = ICONO_MOVIMIENTO[m.tipo_movimiento] ?? CircleCheck;
              const colorIcono = COLOR_MOVIMIENTO[m.tipo_movimiento] ?? "text-ink-muted bg-surface-2";
              const cliente = (m as unknown as { clientes: { nombre_completo: string } | null }).clientes;
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`rounded-full p-1.5 shrink-0 ${colorIcono}`}>
                    <Icono className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-strong truncate">
                      {m.descripcion || ETIQUETA_MOVIMIENTO[m.tipo_movimiento] || m.tipo_movimiento}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {cliente?.nombre_completo ?? "—"} · {formatoFechaHora(m.created_at)}
                    </p>
                  </div>
                  {m.monto != null && (
                    <p className="text-sm font-semibold shrink-0">{currency(Number(m.monto))}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
