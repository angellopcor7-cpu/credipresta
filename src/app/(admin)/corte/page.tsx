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
  CircleCheck,
  Banknote,
  History,
  type LucideIcon,
} from "lucide-react";
import { claveSemana, lunesDeHoy, semanaMasDelta, formatoRangoSemana } from "@/lib/fechas";
import { calcularCorte } from "./calcular";
import { confirmarCorte } from "./actions";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

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
 * "Corte semanal": lo que pidió Empresa en la llamada con el cliente — poder
 * ver, por cobrador/ruta, cuánto se prestó y se recolectó ESTA semana, cuánta
 * mora se generó, cuánto falta por cobrar en total (saldo + mora, ya
 * separados) y la comisión que le toca a cada cobrador según su configuración
 * (% de lo prestado o % de lo recolectado). Es, como lo describió el cliente,
 * un inventario: "esta ruta son tantos clientes, se ha prestado tanto, falta
 * por recolectar tanto".
 *
 * El botón "Confirmar corte" congela estos números en un registro permanente
 * (ver ./actions.ts) — NO borra ni perdona el saldo/mora real de los
 * clientes, solo dice "ya se cerraron las cuentas de esta semana". La semana
 * siguiente ya se ve en $0 sola porque los contadores de "esta semana" se
 * calculan en vivo sobre el rango de fechas de cada semana.
 */
export default async function CortePage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string; error?: string; exito?: string }>;
}) {
  const { semana, error, exito } = await searchParams;
  const claveLunesSolicitada = semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? semana : lunesDeHoy();
  const claveLunes = claveSemana(claveLunesSolicitada); // normaliza: siempre el lunes de esa semana
  const esSemanaActual = claveLunes === lunesDeHoy();

  const supabase = await createClient();

  const [{ filas, totales }, { data: corteExistente }] = await Promise.all([
    calcularCorte(supabase, claveLunes),
    supabase
      .from("cortes_semanales")
      .select("id, fecha_corte, creado_por, usuarios(nombre_completo)")
      .eq("clave_lunes", claveLunes)
      .maybeSingle(),
  ]);

  const corte = corteExistente as unknown as {
    id: string;
    fecha_corte: string;
    creado_por: string | null;
    usuarios: { nombre_completo: string } | null;
  } | null;

  const stats: { label: string; value: string; icon: LucideIcon; tono: "neutral" | "amber" | "red" }[] = [
    { label: "Clientes activos", value: String(totales.clientesActivos), icon: Users, tono: "neutral" },
    { label: "Prestado esta semana", value: currency(totales.prestadoSemana), icon: Landmark, tono: "neutral" },
    { label: "Recolectado esta semana", value: currency(totales.cobradoSemana), icon: TrendingUp, tono: "neutral" },
    {
      label: "Mora generada esta semana",
      value: currency(totales.moraGeneradaSemana),
      icon: CircleAlert,
      tono: totales.moraGeneradaSemana > 0 ? "red" : "neutral",
    },
    { label: "Falta por cobrar (saldo + mora)", value: currency(totales.faltaPorCobrar), icon: Wallet, tono: "amber" },
    {
      label: "Mora acumulada total",
      value: currency(totales.moraAcumulada),
      icon: CircleAlert,
      tono: totales.moraAcumulada > 0 ? "red" : "neutral",
    },
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
        <div className="flex items-center gap-3">
          <Link
            href="/corte/historial"
            className="inline-flex items-center gap-1.5 text-sm bg-surface-2 hover:bg-surface-3 border border-border-strong text-ink font-medium rounded-md px-3 py-2"
          >
            <History className="h-4 w-4" />
            Historial de cortes
          </Link>
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
      </div>

      {error && (
        <p className="text-sm text-danger-text bg-danger-chip-bg/50 border border-danger-chip-border rounded-md px-3 py-2">{error}</p>
      )}
      {exito && (
        <p className="text-sm text-accent-text bg-accent-chip-bg/50 border border-accent-chip-border rounded-md px-3 py-2">{exito}</p>
      )}

      {corte ? (
        <div className="flex items-center gap-2 bg-surface-2 border border-border-soft rounded-md px-4 py-3 text-sm text-ink-secondary">
          <CircleCheck className="h-4 w-4 text-accent-text shrink-0" />
          <p>
            Corte de esta semana ya confirmado el {formatoFechaHora(corte.fecha_corte)}
            {corte.usuarios?.nombre_completo ? ` por ${corte.usuarios.nombre_completo}` : ""}. Estos números quedaron
            congelados en el{" "}
            <Link href="/corte/historial" className="text-accent-text hover:underline">
              historial
            </Link>
            .
          </p>
        </div>
      ) : (
        esSemanaActual && (
          <form action={confirmarCorte} className="flex items-center gap-3">
            <input type="hidden" name="clave_lunes" value={claveLunes} />
            <button className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm px-4 py-2.5 rounded-lg shadow-lg shadow-amber-950/50">
              <Scissors className="h-4 w-4" />
              Confirmar corte de esta semana
            </button>
            <p className="text-xs text-ink-muted max-w-sm">
              Guarda estos números como el cierre oficial de la semana. No borra ni perdona el saldo o la mora real de
              los clientes.
            </p>
          </form>
        )
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
