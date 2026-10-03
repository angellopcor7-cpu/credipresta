import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeft, History } from "lucide-react";
import { formatoRangoSemana } from "@/lib/fechas";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function formatoFechaHora(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(new Date(iso));
}

/** Lista de todos los cortes semanales ya confirmados — el registro permanente de cada cierre de semana. */
export default async function HistorialCortesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("cortes_semanales")
    .select(
      "id, clave_lunes, fecha_corte, total_clientes_activos, total_prestado_semana, total_cobrado_semana, total_mora_generada_semana, total_falta_por_cobrar, total_comision, usuarios(nombre_completo)"
    )
    .order("clave_lunes", { ascending: false });

  const cortes = (data ?? []) as unknown as {
    id: string;
    clave_lunes: string;
    fecha_corte: string;
    total_clientes_activos: number;
    total_prestado_semana: number;
    total_cobrado_semana: number;
    total_mora_generada_semana: number;
    total_falta_por_cobrar: number;
    total_comision: number;
    usuarios: { nombre_completo: string } | null;
  }[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/corte" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4" />
          Corte semanal
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-accent-text" />
        <h1 className="text-2xl font-bold">Historial de cortes</h1>
      </div>

      {cortes.length === 0 ? (
        <p className="text-ink-muted text-sm">
          Todavía no se ha confirmado ningún corte. Ve a{" "}
          <Link href="/corte" className="text-accent-text hover:underline">
            Corte semanal
          </Link>{" "}
          para cerrar la semana actual.
        </p>
      ) : (
        <div className="border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-ink-muted text-left">
              <tr>
                <th className="px-4 py-3">Semana</th>
                <th className="px-4 py-3">Confirmado</th>
                <th className="px-4 py-3">Clientes</th>
                <th className="px-4 py-3">Prestado</th>
                <th className="px-4 py-3">Recolectado</th>
                <th className="px-4 py-3">Mora generada</th>
                <th className="px-4 py-3">Falta por cobrar</th>
                <th className="px-4 py-3">Comisión</th>
              </tr>
            </thead>
            <tbody>
              {cortes.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/corte?semana=${c.clave_lunes}`} className="font-medium hover:text-accent-text">
                      {formatoRangoSemana(c.clave_lunes)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted text-xs">
                    {formatoFechaHora(c.fecha_corte)}
                    {c.usuarios?.nombre_completo ? ` · ${c.usuarios.nombre_completo}` : ""}
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{c.total_clientes_activos}</td>
                  <td className="px-4 py-3 text-ink-secondary">{currency(Number(c.total_prestado_semana))}</td>
                  <td className="px-4 py-3 text-ink-secondary">{currency(Number(c.total_cobrado_semana))}</td>
                  <td className="px-4 py-3 text-danger-text">{currency(Number(c.total_mora_generada_semana))}</td>
                  <td className="px-4 py-3 font-medium">{currency(Number(c.total_falta_por_cobrar))}</td>
                  <td className="px-4 py-3 text-accent-text">{currency(Number(c.total_comision))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
