import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
  activo: "bg-emerald-950 text-emerald-400 border-emerald-900",
  en_mora: "bg-amber-950 text-amber-400 border-amber-900",
  liquidado: "bg-slate-800 text-slate-400 border-slate-700",
  cancelado: "bg-red-950 text-red-400 border-red-900",
};

export default async function PrestamosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("prestamos")
    .select("*, clientes(nombre_completo)")
    .order("created_at", { ascending: false });

  const prestamos = (data ?? []) as unknown as PrestamoConCliente[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Préstamos</h1>
        <Link
          href="/prestamos/nuevo"
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm px-4 py-2 rounded-md"
        >
          + Nuevo préstamo
        </Link>
      </div>

      {prestamos.length === 0 ? (
        <p className="text-slate-400 text-sm">Aún no hay préstamos.</p>
      ) : (
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-left">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Prestado</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Saldo</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {prestamos.map((p) => (
                <tr key={p.id} className="border-t border-slate-800 hover:bg-slate-900/50">
                  <td className="px-4 py-3">
                    <Link href={`/prestamos/${p.id}`} className="hover:text-emerald-400">
                      {p.clientes?.nombre_completo ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{currency(Number(p.monto_prestado))}</td>
                  <td className="px-4 py-3 text-slate-300">{currency(Number(p.monto_total))}</td>
                  <td className="px-4 py-3 font-medium">{currency(Number(p.saldo_actual))}</td>
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
