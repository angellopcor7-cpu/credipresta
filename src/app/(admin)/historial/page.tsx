import { createClient } from "@/lib/supabase/server";
import {
  TrendingUp,
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
import { HistorialPeriodos } from "./HistorialPeriodos";

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

      <HistorialPeriodos cortes={cortes} gastos={gastos} />
    </div>
  );
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
