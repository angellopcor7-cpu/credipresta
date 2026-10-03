import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  ChevronLeft,
  ChevronRight,
  Scissors,
  Users,
  Landmark,
  TrendingUp,
  Wallet,
  CircleAlert,
  Banknote,
  type LucideIcon,
} from "lucide-react";
import { claveSemana, lunesDeHoy, semanaMasDelta, formatoRangoSemana, estaEnSemana, domingoDe } from "@/lib/fechas";
import type { TipoComision } from "@/lib/types";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

/**
 * "Corte semanal": lo que pidió Empresa en la llamada con el cliente — poder
 * ver, por cobrador/ruta, cuánto se prestó y se recolectó ESTA semana, cuánta
 * mora se generó, cuánto falta por cobrar en total (saldo + mora, ya
 * separados) y la comisión que le toca a cada cobrador según su configuración
 * (% de lo prestado o % de lo recolectado). Es, como lo describió el cliente,
 * un inventario: "esta ruta son tantos clientes, se ha prestado tanto, falta
 * por recolectar tanto".
 */
export default async function CortePage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const { semana } = await searchParams;
  const claveLunesSolicitada = semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? semana : lunesDeHoy();
  const claveLunes = claveSemana(claveLunesSolicitada); // normaliza: siempre el lunes de esa semana
  const claveDomingo = domingoDe(claveLunes);
  const esSemanaActual = claveLunes === lunesDeHoy();

  const supabase = await createClient();

  const [
    { data: cobradoresData },
    { data: rutasData },
    { data: clientesData },
    { data: prestamosData },
    { data: pagosSemana },
    { data: morasSemana },
  ] = await Promise.all([
    supabase
      .from("cobradores")
      .select("id, zona, tipo_comision, porcentaje_comision, usuarios(nombre_completo)")
      .eq("activo", true),
    supabase.from("rutas").select("id, nombre, cobrador_id").eq("activa", true),
    supabase.from("clientes").select("id, cobrador_id").eq("estado", "activo"),
    supabase.from("prestamos").select("id, cobrador_id, monto_prestado, created_at, saldo_actual, mora_acumulada, estado"),
    supabase.from("pagos").select("cobrador_id, monto, fecha_pago").gte("fecha_pago", claveLunes).lte("fecha_pago", claveDomingo),
    supabase.from("moras").select("monto_mora, fecha_generada, prestamo_id").gte("fecha_generada", claveLunes).lte("fecha_generada", claveDomingo),
  ]);

  const cobradores = (cobradoresData ?? []) as unknown as {
    id: string;
    zona: string | null;
    tipo_comision: TipoComision;
    porcentaje_comision: number;
    usuarios: { nombre_completo: string } | null;
  }[];
  const rutas = (rutasData ?? []) as { id: string; nombre: string; cobrador_id: string | null }[];
  const clientes = (clientesData ?? []) as { id: string; cobrador_id: string | null }[];
  const prestamos = (prestamosData ?? []) as {
    id: string;
    cobrador_id: string | null;
    monto_prestado: number;
    created_at: string;
    saldo_actual: number;
    mora_acumulada: number;
    estado: string;
  }[];
  const pagos = (pagosSemana ?? []) as { cobrador_id: string | null; monto: number; fecha_pago: string }[];
  const moras = (morasSemana ?? []) as { monto_mora: number; fecha_generada: string; prestamo_id: string }[];

  // Mapa préstamo -> cobrador, para poder sumar la mora de la semana (la
  // tabla `moras` no guarda cobrador_id directo) por cobrador.
  const cobradorPorPrestamo = new Map(prestamos.map((p) => [p.id, p.cobrador_id]));

  const filas = cobradores
    .map((c) => {
      const nombre = c.usuarios?.nombre_completo ?? "—";
      const rutasDelCobrador = rutas.filter((r) => r.cobrador_id === c.id).map((r) => r.nombre);
      const clientesActivos = clientes.filter((cl) => cl.cobrador_id === c.id).length;

      const prestamosDelCobrador = prestamos.filter((p) => p.cobrador_id === c.id);
      const prestamosActivosDelCobrador = prestamosDelCobrador.filter(
        (p) => p.estado === "activo" || p.estado === "en_mora"
      );

      const prestadoSemana = prestamosDelCobrador
        .filter((p) => estaEnSemana(p.created_at, claveLunes))
        .reduce((s, p) => s + Number(p.monto_prestado), 0);

      const cobradoSemana = pagos
        .filter((p) => p.cobrador_id === c.id)
        .reduce((s, p) => s + Number(p.monto), 0);

      const moraGeneradaSemana = moras
        .filter((m) => cobradorPorPrestamo.get(m.prestamo_id) === c.id)
        .reduce((s, m) => s + Number(m.monto_mora), 0);

      const saldoPendiente = prestamosActivosDelCobrador.reduce((s, p) => s + Number(p.saldo_actual), 0);
      const moraAcumulada = prestamosActivosDelCobrador.reduce((s, p) => s + Number(p.mora_acumulada), 0);
      const faltaPorCobrar = saldoPendiente + moraAcumulada;

      const comision =
        c.tipo_comision === "prestado" ? prestadoSemana * (c.porcentaje_comision / 100) : cobradoSemana * (c.porcentaje_comision / 100);

      return {
        id: c.id,
        nombre,
        zona: c.zona,
        rutas: rutasDelCobrador,
        clientesActivos,
        prestadoSemana,
        cobradoSemana,
        moraGeneradaSemana,
        saldoPendiente,
        moraAcumulada,
        faltaPorCobrar,
        tipoComision: c.tipo_comision,
        porcentajeComision: c.porcentaje_comision,
        comision,
      };
    })
    .sort((a, b) => b.faltaPorCobrar - a.faltaPorCobrar);

  const totales = filas.reduce(
    (acc, f) => ({
      clientesActivos: acc.clientesActivos + f.clientesActivos,
      prestadoSemana: acc.prestadoSemana + f.prestadoSemana,
      cobradoSemana: acc.cobradoSemana + f.cobradoSemana,
      moraGeneradaSemana: acc.moraGeneradaSemana + f.moraGeneradaSemana,
      saldoPendiente: acc.saldoPendiente + f.saldoPendiente,
      moraAcumulada: acc.moraAcumulada + f.moraAcumulada,
      faltaPorCobrar: acc.faltaPorCobrar + f.faltaPorCobrar,
      comision: acc.comision + f.comision,
    }),
    {
      clientesActivos: 0,
      prestadoSemana: 0,
      cobradoSemana: 0,
      moraGeneradaSemana: 0,
      saldoPendiente: 0,
      moraAcumulada: 0,
      faltaPorCobrar: 0,
      comision: 0,
    }
  );

  const stats: { label: string; value: string; icon: LucideIcon; tono: "neutral" | "amber" | "red" }[] = [
    { label: "Clientes activos", value: String(totales.clientesActivos), icon: Users, tono: "neutral" },
    { label: "Prestado esta semana", value: currency(totales.prestadoSemana), icon: Landmark, tono: "neutral" },
    { label: "Recolectado esta semana", value: currency(totales.cobradoSemana), icon: TrendingUp, tono: "neutral" },
    { label: "Mora generada esta semana", value: currency(totales.moraGeneradaSemana), icon: CircleAlert, tono: totales.moraGeneradaSemana > 0 ? "red" : "neutral" },
    { label: "Falta por cobrar (saldo + mora)", value: currency(totales.faltaPorCobrar), icon: Wallet, tono: "amber" },
    { label: "Mora acumulada total", value: currency(totales.moraAcumulada), icon: CircleAlert, tono: totales.moraAcumulada > 0 ? "red" : "neutral" },
    { label: "Comisiones de la semana", value: currency(totales.comision), icon: Banknote, tono: "amber" },
  ];

  const colorIcono: Record<string, string> = { neutral: "text-ink-muted", amber: "text-accent-text", red: "text-danger-text" };
  const colorValor: Record<string, string> = { neutral: "text-ink", amber: "text-accent-text", red: "text-danger-text" };
  const bordeTono: Record<string, string> = { neutral: "border-border", amber: "border-border", red: "border-danger-chip-border/50" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-accent-text" />
          <h1 className="text-2xl font-bold">Corte semanal</h1>
        </div>
        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-2 py-1.5">
          <Link
            href={`/corte?semana=${semanaMasDelta(claveLunes, -1)}`}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-surface-2 text-ink-secondary"
            title="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-medium px-2">
            {formatoRangoSemana(claveLunes)}
            {esSemanaActual && <span className="text-accent-text text-xs ml-1.5">(actual)</span>}
          </span>
          <Link
            href={`/corte?semana=${semanaMasDelta(claveLunes, 1)}`}
            className={`inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-surface-2 text-ink-secondary ${
              esSemanaActual ? "pointer-events-none opacity-30" : ""
            }`}
            title="Semana siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

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

      {filas.length === 0 ? (
        <p className="text-ink-muted text-sm">No hay cobradores activos para mostrar en el corte.</p>
      ) : (
        <div className="border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-ink-muted text-left">
              <tr>
                <th className="px-4 py-3">Cobrador / ruta</th>
                <th className="px-4 py-3">Clientes</th>
                <th className="px-4 py-3">Prestado (semana)</th>
                <th className="px-4 py-3">Recolectado (semana)</th>
                <th className="px-4 py-3">Mora generada (semana)</th>
                <th className="px-4 py-3">Mora acumulada</th>
                <th className="px-4 py-3">Falta por cobrar</th>
                <th className="px-4 py-3">Comisión</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link href={`/cobradores/${f.id}`} className="font-medium hover:text-accent-text">
                      {f.nombre}
                    </Link>
                    <p className="text-xs text-ink-muted">
                      {f.rutas.length > 0 ? f.rutas.join(", ") : f.zona ?? "Sin ruta asignada"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{f.clientesActivos}</td>
                  <td className="px-4 py-3 text-ink-secondary">{currency(f.prestadoSemana)}</td>
                  <td className="px-4 py-3 text-ink-secondary">{currency(f.cobradoSemana)}</td>
                  <td className={`px-4 py-3 ${f.moraGeneradaSemana > 0 ? "text-danger-text" : "text-ink-secondary"}`}>
                    {currency(f.moraGeneradaSemana)}
                  </td>
                  <td className={`px-4 py-3 ${f.moraAcumulada > 0 ? "text-danger-text" : "text-ink-secondary"}`}>
                    {currency(f.moraAcumulada)}
                  </td>
                  <td className="px-4 py-3 font-medium">{currency(f.faltaPorCobrar)}</td>
                  <td className="px-4 py-3 text-accent-text">
                    {currency(f.comision)}
                    <span className="block text-xs text-ink-muted">
                      {f.porcentajeComision}% {f.tipoComision === "prestado" ? "de lo prestado" : "de lo recolectado"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border-strong bg-surface font-semibold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3">{totales.clientesActivos}</td>
                <td className="px-4 py-3">{currency(totales.prestadoSemana)}</td>
                <td className="px-4 py-3">{currency(totales.cobradoSemana)}</td>
                <td className="px-4 py-3 text-danger-text">{currency(totales.moraGeneradaSemana)}</td>
                <td className="px-4 py-3 text-danger-text">{currency(totales.moraAcumulada)}</td>
                <td className="px-4 py-3">{currency(totales.faltaPorCobrar)}</td>
                <td className="px-4 py-3 text-accent-text">{currency(totales.comision)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
