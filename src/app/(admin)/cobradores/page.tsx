import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CobradorConUsuario } from "@/lib/types";

export default async function CobradoresPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cobradores")
    .select("*, usuarios(nombre_completo, telefono)")
    .order("fecha_ingreso", { ascending: false });

  const cobradores = (data ?? []) as unknown as CobradorConUsuario[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cobradores</h1>
        <Link
          href="/cobradores/nuevo"
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm px-4 py-2 rounded-md"
        >
          + Nuevo cobrador
        </Link>
      </div>

      {cobradores.length === 0 ? (
        <p className="text-slate-400 text-sm">Aún no hay cobradores registrados.</p>
      ) : (
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-left">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Zona</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {cobradores.map((c) => (
                <tr key={c.id} className="border-t border-slate-800">
                  <td className="px-4 py-3">{c.usuarios?.nombre_completo ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-300">{c.usuarios?.telefono ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-300">{c.zona ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs border rounded-full px-2 py-1 ${
                        c.activo
                          ? "bg-emerald-950 text-emerald-400 border-emerald-900"
                          : "bg-slate-800 text-slate-500 border-slate-700"
                      }`}
                    >
                      {c.activo ? "Activo" : "Inactivo"}
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
