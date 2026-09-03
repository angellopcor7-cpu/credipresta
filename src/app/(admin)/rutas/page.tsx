import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function RutasPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rutas")
    .select("*, cobradores(usuarios(nombre_completo))")
    .order("created_at", { ascending: false });

  const rutas = (data ?? []) as unknown as Array<{
    id: string;
    nombre: string;
    zona: string | null;
    activa: boolean;
    cobradores: { usuarios: { nombre_completo: string } | null } | null;
  }>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rutas</h1>
        <Link
          href="/rutas/nueva"
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm px-4 py-2 rounded-md"
        >
          + Nueva ruta
        </Link>
      </div>

      {rutas.length === 0 ? (
        <p className="text-slate-400 text-sm">Aún no hay rutas.</p>
      ) : (
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-left">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Zona</th>
                <th className="px-4 py-3">Cobrador</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rutas.map((r) => (
                <tr key={r.id} className="border-t border-slate-800">
                  <td className="px-4 py-3">{r.nombre}</td>
                  <td className="px-4 py-3 text-slate-300">{r.zona ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {r.cobradores?.usuarios?.nombre_completo ?? "Sin asignar"}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{r.activa ? "Activa" : "Inactiva"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
