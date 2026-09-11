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
  type LucideIcon,
} from "lucide-react";
import { GraficaOtorgadoCobrado, GraficaMora, type PuntoOtorgadoCobrado, type PuntoMora } from "./AnalisisCharts";

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

/**
 * Clave "YYYY-MM" de una fecha, en horario de Ciudad de México. Sirve tanto para
 * columnas `timestamptz` (con hora) como `date` (solo fecha, ej. "2026-09-01").
 */
function claveMes(fechaTexto: string) {
  const fecha = new Date(fechaTexto.length === 10 ? `${fechaTexto}T12:00:00Z` : fechaTexto);
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "America/Mexico_City",
  })
    .format(fecha)
    .slice(0, 7);
}

/** Los últimos `cantidad` meses (incluyendo el actual), del más viejo al más nuevo, en hora de CDMX. */
function ultimosMeses(cantidad: number) {
  const partesHoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valores: Record<string, string> = {};
  for (const parte of partesHoy) valores[parte.type] = parte.value;
  const hoyEnMexico = new Date(Date.UTC(Number(valores.year), Number(valores.month) - 1, 1));

  const meses: { clave: string; etiqueta: string }[] = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    const fecha = new Date(hoyEnMexico);
    fecha.setUTCMonth(fecha.getUTCMonth() - i);
    const clave = `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
    const etiqueta = new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" }).format(fecha);
    meses.push({ clave, etiqueta });
  }
  return meses;
}

const ICONO_MOVIMIENTO: Record<string, LucideIcon> = {
  pago: CircleCheck,
  mora: CircleAlert,
  aprobacion_solicitud: CircleCheck,
  rechazo_solicitud: CircleX,
  creacion_cobrador: UserPlus,
};

const COLOR_MOVIMIENTO: Record<string, string> = {
  pago: "text-sky-400 bg-sky-950",
  mora: "text-red-400 bg-red-950",
  aprobacion_solicitud: "text-amber-400 bg-amber-950",
  rechazo_solicitud: "text-red-400 bg-red-950",
  creacion_cobrador: "text-sky-400 bg-sky-950",
};

const ETIQUETA_MOVIMIENTO: Record<string, string> = {
  pago: "Pago registrado",
  mora: "Mora aplicada",
  aprobacion_solicitud: "Solicitud aprobada",
  rechazo_solicitud: "Solicitud rechazada",
  creacion_cobrador: "Cobrador dado de alta",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: clientesCount },
    { count: cobradoresCount },
    { data: prestamos },
    { data: morasPendientes },
    { count: solicitudesPendientesCount },
    { data: actividadReciente },
    { data: todasLasMoras },
    { data: todosLosPagos },
    { data: clientesActivosPorCobrador },
    { data: cobradoresActivos },
  ] = await Promise.all([
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("estado", "activo"),
    supabase.from("cobradores").select("*", { count: "exact", head: true }).eq("activo", true),
    supabase.from("prestamos").select("estado, saldo_actual, monto_prestado, created_at, cobrador_id"),
    supabase.from("moras").select("monto_mora, prestamos(cobrador_id)").eq("estado", "pendiente"),
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
  const moraTotal = (morasPendientes ?? []).reduce((s, m) => s + Number(m.monto_mora), 0);
  const solicitudesPendientes = solicitudesPendientesCount ?? 0;

  const stats: { label: string; value: string; icon: LucideIcon; tono: "neutral" | "amber" | "red" | "sky" }[] = [
    { label: "Clientes activos", value: String(clientesCount ?? 0), icon: UserRound, tono: "sky" },
    { label: "Cobradores activos", value: String(cobradoresCount ?? 0), icon: Users, tono: "sky" },
    { label: "Préstamos activos", value: String(activos.length), icon: Landmark, tono: "sky" },
    { label: "Préstamos en mora", value: String(enMora.length), icon: CircleAlert, tono: enMora.length > 0 ? "red" : "neutral" },
    { label: "Cartera pendiente", value: currency(carteraActiva), icon: Wallet, tono: "amber" },
    { label: "Mora pendiente", value: currency(moraTotal), icon: CircleAlert, tono: moraTotal > 0 ? "red" : "neutral" },
    { label: "Total prestado (histórico)", value: currency(totalPrestado), icon: TrendingUp, tono: "neutral" },
  ];

  const colorIcono: Record<string, string> = {
    neutral: "text-slate-400",
    amber: "text-amber-400",
    red: "text-red-400",
    sky: "text-sky-400",
  };
  const colorValor: Record<string, string> = {
    neutral: "text-white",
    amber: "text-amber-400",
    red: "text-red-400",
    sky: "text-white",
  };
  const bordeTono: Record<string, string> = {
    neutral: "border-slate-800",
    amber: "border-slate-800",
    red: "border-red-900/50",
    sky: "border-slate-800",
  };

  const accesos: { label: string; href: string; icon: LucideIcon }[] = [
    { label: "Solicitudes", href: "/solicitudes", icon: FileText },
    { label: "Clientes", href: "/clientes", icon: UserRound },
    { label: "Cobradores", href: "/cobradores", icon: Users },
    { label: "Préstamos", href: "/prestamos", icon: Landmark },
    { label: "Rutas", href: "/rutas", icon: Route },
  ];

  // --- Análisis: tendencias de los últimos 6 meses ---
  const meses = ultimosMeses(6);

  const otorgadoPorMes = new Map(meses.map((m) => [m.clave, 0]));
  for (const p of listaPrestamos) {
    if (!p.created_at) continue;
    const clave = claveMes(p.created_at);
    if (otorgadoPorMes.has(clave)) otorgadoPorMes.set(clave, otorgadoPorMes.get(clave)! + Number(p.monto_prestado));
  }

  const cobradoPorMes = new Map(meses.map((m) => [m.clave, 0]));
  for (const pago of todosLosPagos ?? []) {
    const clave = claveMes(pago.fecha_pago);
    if (cobradoPorMes.has(clave)) cobradoPorMes.set(clave, cobradoPorMes.get(clave)! + Number(pago.monto));
  }

  const moraPorMes = new Map(meses.map((m) => [m.clave, 0]));
  for (const mora of todasLasMoras ?? []) {
    const clave = claveMes(mora.fecha_generada);
    if (moraPorMes.has(clave)) moraPorMes.set(clave, moraPorMes.get(clave)! + Number(mora.monto_mora));
  }

  const datosOtorgadoCobrado: PuntoOtorgadoCobrado[] = meses.map((m) => ({
    mes: m.etiqueta,
    otorgado: otorgadoPorMes.get(m.clave) ?? 0,
    cobrado: cobradoPorMes.get(m.clave) ?? 0,
  }));

  const datosMora: PuntoMora[] = meses.map((m) => ({
    mes: m.etiqueta,
    monto: moraPorMes.get(m.clave) ?? 0,
  }));

  // --- Análisis: desempeño por cobrador ---
  const filasCobrador = (cobradoresActivos ?? [])
    .map((c) => {
      const cobrador = c as unknown as { id: string; zona: string | null; usuarios: { nombre_completo: string } | null };
      const clientesActivos = (clientesActivosPorCobrador ?? []).filter(
        (cl) => cl.cobrador_id === cobrador.id
      ).length;
      const carteraCobrador = listaPrestamos
        .filter((p) => p.cobrador_id === cobrador.id && (p.estado === "activo" || p.estado === "en_mora"))
        .reduce((s, p) => s + Number(p.saldo_actual), 0);
      const moraCobrador = (morasPendientes ?? [])
        .filter(
          (m) =>
            (m as unknown as { prestamos: { cobrador_id: string } | null }).prestamos?.cobrador_id === cobrador.id
        )
        .reduce((s, m) => s + Number(m.monto_mora), 0);
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
        <p className="text-slate-400 text-sm mt-1">Resumen general de CrediPresta.</p>
      </div>

      {solicitudesPendientes > 0 && (
        <Link
          href="/solicitudes"
          className="flex items-center justify-between gap-3 bg-amber-500/10 border border-amber-600/40 rounded-xl px-5 py-4 hover:bg-amber-500/15 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-500/20 p-2 shrink-0">
              <Clock className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-amber-300">
                {solicitudesPendientes} {solicitudesPendientes === 1 ? "solicitud" : "solicitudes"} esperando aprobación
              </p>
              <p className="text-xs text-amber-200/70">Revísalas antes de que el cliente se quede esperando.</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-amber-400 shrink-0" />
        </Link>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`bg-slate-900 border rounded-xl p-4 ${bordeTono[s.tono]}`}>
            <div className="flex items-center gap-1.5 text-slate-400">
              <s.icon className={`h-3.5 w-3.5 ${colorIcono[s.tono]}`} />
              <p className="text-xs">{s.label}</p>
            </div>
            <p className={`text-xl font-semibold mt-2 ${colorValor[s.tono]}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Accesos rápidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {accesos.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex flex-col items-center gap-2 bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/70 rounded-xl p-4 text-center transition-colors"
            >
              <div className="rounded-full bg-slate-800 p-2">
                <a.icon className="h-5 w-5 text-amber-400" />
              </div>
              <span className="text-sm text-slate-200">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Análisis (últimos 6 meses)</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GraficaOtorgadoCobrado datos={datosOtorgadoCobrado} />
          <GraficaMora datos={datosMora} />
        </div>
      </div>

      {filasCobrador.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Desempeño por cobrador</h2>
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left">
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
                  <tr key={c.id} className="border-t border-slate-800">
                    <td className="px-4 py-3 font-medium">{c.nombre}</td>
                    <td className="px-4 py-3 text-slate-300">{c.zona ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-300">{c.clientesActivos}</td>
                    <td className="px-4 py-3 text-slate-300">{currency(c.carteraActiva)}</td>
                    <td className={`px-4 py-3 ${c.moraPendiente > 0 ? "text-red-400" : "text-slate-300"}`}>
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
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Actividad reciente</h2>
          <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
            {actividadReciente.map((m) => {
              const Icono = ICONO_MOVIMIENTO[m.tipo_movimiento] ?? CircleCheck;
              const colorIcono = COLOR_MOVIMIENTO[m.tipo_movimiento] ?? "text-slate-400 bg-slate-800";
              const cliente = (m as unknown as { clientes: { nombre_completo: string } | null }).clientes;
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`rounded-full p-1.5 shrink-0 ${colorIcono}`}>
                    <Icono className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-200 truncate">
                      {m.descripcion || ETIQUETA_MOVIMIENTO[m.tipo_movimiento] || m.tipo_movimiento}
                    </p>
                    <p className="text-xs text-slate-500">
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
