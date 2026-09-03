import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Cliente } from "@/lib/types";

const estadoLabel: Record<string, string> = {
  activo: "Activo",
  pendiente_aprobacion: "Pendiente de aprobación",
  inactivo: "Inactivo",
};

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("clientes").select("*").order("created_at", { ascending: false });
  const clientes = (data ?? []) as Cliente[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Link
          href="/clientes/nuevo"
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm px-4 py-2 rounded-md"
        >
          + Nuevo cliente
        </Link>
      </div>

      {clientes.length === 0 ? (
        <p className="text-slate-400 text-sm">Aún no hay clientes.</p>
      ) : (
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-left">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Identificación</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-t border-slate-800">
                  <td className="px-4 py-3">{c.nombre_completo}</td>
                  <td className="px-4 py-3 text-slate-300">{c.telefono ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-300">{c.identificacion ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-300">{estadoLabel[c.estado]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
