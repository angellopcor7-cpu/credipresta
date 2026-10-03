import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatoFechaCorta } from "@/lib/format";
import { obtenerFechaLimitePorPrestamo } from "@/lib/supabase/calendario";
import type { PrestamoConCliente } from "@/lib/types";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

const estadoLabel: Record<string, string> = {
  activo: "Activo",
  en_mora: "En mora",
  liquidado: "Liquidado",
  cancelado: "Cancelado",
};

const estadoColor: Record<string, string> = {
  activo: "bg-surface-2 text-ink-strong border-border-soft",
  en_mora: "bg-accent-chip-bg text-accent-text border-accent-chip-border",
  liquidado: "bg-surface-2 text-ink-muted border-border-strong",
  cancelado: "bg-danger-chip-bg text-danger-text border-danger-chip-border",
};

export default async function PrestamosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("prestamos")
    .select("*, clientes(nombre_completo)")
    .order("created_at", { ascending: false });

  const prestamos = (data ?? []) as unknown as PrestamoConCliente[];
  const fechaLimitePorPrestamo = await obtenerFechaLimitePorPrestamo(
    supabase,
    prestamos.map((p) => p.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Préstamos</h1>
        <p className="text-ink-muted text-sm">Se crean al aprobar una solicitud del cobrador.</p>
      </div>

      {prestamos.length === 0 ? (
        <p className="text-ink-muted text-sm">Aún no hay préstamos.</p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface text-ink-muted text-left">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Prestado</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Saldo</th>
                <th className="px-4 py-3">Inicio</th>
                <th className="px-4 py-3">Vence</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {prestamos.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/prestamos/${p.id}`} className="hover:text-accent-text">
                      {p.clientes?.nombre_completo ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{currency(Number(p.monto_prestado))}</td>
                  <td className="px-4 py-3 text-ink-secondary">{currency(Number(p.monto_total))}</td>
                  <td className="px-4 py-3 font-medium">{currency(Number(p.saldo_actual))}</td>
                  <td className="px-4 py-3 text-ink-muted">{formatoFechaCorta(p.fecha_inicio)}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {formatoFechaCorta(fechaLimitePorPrestamo.get(p.id))}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs border rounded-full px-2 py-1 ${estadoColor[p.estado]}`}>
                      {estadoLabel[p.estado]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
