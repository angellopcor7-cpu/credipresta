import { createClient } from "@/lib/supabase/server";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Wallet,
  CircleAlert,
  Landmark,
  Receipt,
  Users,
  CircleCheck,
  Clock,
  History,
  type LucideIcon,
} from "lucide-react";
import { formatoRangoSemana, formatoRangoSemanaCorto } from "@/lib/fechas";
import { GananciaChart, type PuntoGanancia } from "./GananciaChart";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

type CorteFila = {
  id: string;
  clave_lunes: string;
  clave_domingo: string;
  total_clientes_activos: number;
  total_prestado_semana: number;
  total_cobrado_semana: number;
  total_mora_generada_semana: number;
  total_mora_acumulada: number;
  total_falta_por_cobrar: number;
  total_comision: number;
};

type GastoFila = { monto: number; fecha: string; categoria: string };

/** Suma los gastos cuya fecha cae dentro de [claveLunes, claveDomingo], ambos inclusive. */
function gastoDeLaSemana(gastos: GastoFila[], claveLunes: string, claveDomingo: string) {
  return gastos
    .filter((g) => g.fecha >= claveLunes && g.fecha <= claveDomingo)
    .reduce((s, g) => s + Number(g.monto), 0);
}

/**
 * Vista de conjunto para ver semana a semana si el negocio va mejorando o
 * empeorando: junta el historial de cortes semanales (ya guardado en
 * `cortes_semanales`, siempre como quedó al momento de cerrar esa semana)
 * con los gastos registrados en /gastos, semana por semana y en totales
 * generales. No reemplaza el detalle por cobrador de /corte — aquí es la
 * foto completa del negocio a lo largo del tiempo.
 */
export default async function HistorialPage() {
  const supabase = await createClient();

  const [{ data: cortesData }, { data: gastosData }] = await Promise.all([
    supabase
      .from("cortes_semanales")
      .select(
        "id, clave_lunes, clave_domingo, total_clientes_activos, total_prestado_semana, total_cobrado_semana, total_mora_generada_semana, total_mora_acumulada, total_falta_por_cobrar, total_comision"
      )
      .order("clave_lunes", { ascending: false }),
    supabase.from("gastos").select("monto, fecha, categoria"),
  ]);

  const cortes = (cortesData ?? []) as CorteFila[];
  const gastos = (gastosData ?? []) as GastoFila[];

  const hoy = new Date().toISOString().slice(0, 10);
  const inicioMes = hoy.slice(0, 7);

  const gastoTotalHistorico = gastos.reduce((s, g) => s + Number(g.monto), 0);
  const gastoEsteMes = gastos.filter((g) => g.fecha.slice(0, 7) === inicioMes).reduce((s, g) => s + Number(g.monto), 0);

  // Niveles (cuánto hay AHORITA): se toman del corte más reciente, no se
  // suman entre semanas (serían deuda contada varias veces). Flujos (cuánto
  // se prestó/cobró/pagó de comisión EN la semana) sí se suman entre todos
  // los cortes para dar un total histórico.
  const corteMasReciente = cortes[0] ?? null;
  const totalPrestadoHistorico = cortes.reduce((s, c) => s + Number(c.total_prestado_semana), 0);
  const totalCobradoHistorico = cortes.reduce((s, c) => s + Number(c.total_cobrado_semana), 0);
  const totalComisionHistorica = cortes.reduce((s, c) => s + Number(c.total_comision), 0);

  const faltaPorCobrarActualSinMora = corteMasReciente
    ? Number(corteMasReciente.total_falta_por_cobrar) - Number(corteMasReciente.total_mora_acumulada)
    : 0;
  const moraAcumuladaActual = corteMasReciente ? Number(corteMasReciente.total_mora_acumulada) : 0;
  const faltaPorCobrarActualConMora = corteMasReciente ? Number(corteMasReciente.total_falta_por_cobrar) : 0;

  // Para la gráfica: de más vieja a más nueva (se lee de izquierda a
  // derecha), con la ganancia/pérdida estimada de cada semana ya calculada.
  const datosGanancia: PuntoGanancia[] = [...cortes]
    .reverse()
    .map((c) => {
      const gastoSemana = gastoDeLaSemana(gastos, c.clave_lunes, c.clave_domingo);
      const comision = Number(c.total_comision);
      const ingreso = Number(c.total_cobrado_semana);
      return {
        id: c.id,
        etiqueta: formatoRangoSemana(c.clave_lunes),
        etiquetaCorta: formatoRangoSemanaCorto(c.clave_lunes),
        ingreso,
        comision,
        gasto: gastoSemana,
        ganancia: ingreso - comision - gastoSemana,
      };
    });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Historial del negocio</h1>
        <p className="text-ink-muted text-sm mt-1">
          Semana a semana, para ver si la empresa va mejorando o empeorando.
        </p>
      </div>

      <div>
        <h2 className="flex items-center gap-1.5 font-semibold mb-3 text-sm text-ink-muted uppercase tracking-wide">
          <Clock className="h-3.5 w-3.5" />
          Ahorita (al corte más reciente)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Falta por cobrar (sin mora)"
            value={currency(faltaPorCobrarActualSinMora)}
            icon={Wallet}
            tono="neutral"
          />
          <StatCard
            label="Mora acumulada"
            value={currency(moraAcumuladaActual)}
            icon={CircleAlert}
            tono={moraAcumuladaActual > 0 ? "red" : "neutral"}
          />
          <StatCard
            label="Falta por cobrar (con mora incluida)"
            value={currency(faltaPorCobrarActualConMora)}
            icon={Landmark}
            tono="amber"
            destacado
          />
        </div>
      </div>

      <div>
        <h2 className="flex items-center gap-1.5 font-semibold mb-3 text-sm text-ink-muted uppercase tracking-wide">
          <History className="h-3.5 w-3.5" />
          Histórico (todo lo acumulado)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard label="Total prestado" value={currency(totalPrestadoHistorico)} icon={TrendingUp} tono="neutral" />
          <StatCard label="Total cobrado" value={currency(totalCobradoHistorico)} icon={CircleCheck} tono="neutral" />
          <StatCard
            label="Comisión pagada a cobradores"
            value={currency(totalComisionHistorica)}
            icon={Users}
            tono="amber"
          />
          <StatCard label="Gasto total" value={currency(gastoTotalHistorico)} icon={Receipt} tono="red" />
          <StatCard label="Gasto este mes" value={currency(gastoEsteMes)} icon={Receipt} tono="red" />
        </div>
      </div>

      <div>
        <h2 className="flex items-center gap-1.5 font-semibold mb-1">
          <TrendingUp className="h-4 w-4 text-ink-muted" />
          ¿El negocio va rentable?
        </h2>
        <p className="text-ink-muted text-xs mb-3">
          Ganancia o pérdida estimada por semana (cobrado − comisión de cobradores − gastos). No separa todavía
          capital de interés, así que es una foto del flujo de caja, no la utilidad contable exacta.
        </p>
        <div className="bg-surface border border-border rounded-xl p-4 sm:p-5">
          <GananciaChart datos={datosGanancia} />
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Semana por semana</h2>
        {cortes.length === 0 ? (
          <p className="text-ink-muted text-sm">
            Todavía no se ha confirmado ningún corte semanal — este historial se va llenando solo cada vez que se
            hace un corte en <span className="text-ink-strong">Hacer corte</span>.
          </p>
        ) : (
          <>
            <p className="sm:hidden text-xs text-ink-muted mb-2">Desliza la tabla hacia los lados para ver todo →</p>
            <div className="border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface text-ink-muted text-left border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Semana</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Clientes</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Prestado</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Cobrado</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Mora acumulada</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Falta sin mora</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Falta con mora</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Comisión</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Gasto de la semana</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Tendencia</th>
                  </tr>
                </thead>
                <tbody>
                  {cortes.map((c, i) => {
                    // cortes está ordenado de más nueva a más vieja; la
                    // siguiente en el arreglo es la semana ANTERIOR.
                    const anterior = cortes[i + 1] ?? null;
                    const gastoSemana = gastoDeLaSemana(gastos, c.clave_lunes, c.clave_domingo);
                    const faltaConMora = Number(c.total_falta_por_cobrar);
                    const faltaConMoraAnterior = anterior ? Number(anterior.total_falta_por_cobrar) : null;
                    return (
                      <tr key={c.id} className="border-t border-border hover:bg-surface-2 transition-colors">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{formatoRangoSemana(c.clave_lunes)}</td>
                        <td className="px-4 py-3 text-ink-secondary whitespace-nowrap">{c.total_clientes_activos}</td>
                        <td className="px-4 py-3 text-ink-secondary whitespace-nowrap">{currency(Number(c.total_prestado_semana))}</td>
                        <td className="px-4 py-3 text-ink-secondary whitespace-nowrap">{currency(Number(c.total_cobrado_semana))}</td>
                        <td className="px-4 py-3 text-danger-text whitespace-nowrap">{currency(Number(c.total_mora_acumulada))}</td>
                        <td className="px-4 py-3 text-ink-secondary whitespace-nowrap">
                          {currency(Number(c.total_falta_por_cobrar) - Number(c.total_mora_acumulada))}
                        </td>
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{currency(faltaConMora)}</td>
                        <td className="px-4 py-3 text-accent-text whitespace-nowrap">{currency(Number(c.total_comision))}</td>
                        <td className="px-4 py-3 text-danger-text whitespace-nowrap">{currency(gastoSemana)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Tendencia actual={faltaConMora} anterior={faltaConMoraAnterior} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="text-xs text-ink-muted mt-2">
          La tendencia compara la deuda total pendiente (falta por cobrar con mora incluida) contra la semana
          anterior: que BAJE es lo bueno (se está cobrando más de lo que se presta/acumula de mora).
        </p>
      </div>
    </div>
  );
}

function Tendencia({ actual, anterior }: { actual: number; anterior: number | null }) {
  if (anterior === null) return <span className="text-ink-muted text-xs">—</span>;
  const diferencia = redondearCentavos(actual - anterior);
  if (diferencia === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
        <Minus className="h-3.5 w-3.5" />
        Igual
      </span>
    );
  }
  if (diferencia < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-accent-text">
        <TrendingDown className="h-3.5 w-3.5" />
        Mejorando ({currency(Math.abs(diferencia))})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-danger-text">
      <TrendingUp className="h-3.5 w-3.5" />
      Empeorando ({currency(diferencia)})
    </span>
  );
}

function redondearCentavos(n: number) {
  return Math.round(n * 100) / 100;
}

function StatCard({
  label,
  value,
  icon: Icon,
  tono = "neutral",
  destacado = false,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tono?: "neutral" | "amber" | "red";
  destacado?: boolean;
}) {
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
  return (
    <div className={`bg-surface border rounded-xl p-4 ${destacado ? "border-accent-chip-border" : bordeTono[tono]}`}>
      <div className="flex items-center gap-1.5 text-ink-muted">
        <Icon className={`h-3.5 w-3.5 ${colorIcono[tono]}`} />
        <p className="text-xs">{label}</p>
      </div>
      <p className={`text-xl font-semibold mt-2 ${colorValor[tono]}`}>{value}</p>
    </div>
  );
}
