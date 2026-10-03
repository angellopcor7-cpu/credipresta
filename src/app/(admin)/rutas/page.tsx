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
          className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm px-4 py-2 rounded-md"
        >
          + Nueva ruta
        </Link>
      </div>

      {rutas.length === 0 ? (
        <p className="text-ink-muted text-sm">Aún no hay rutas.</p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface text-ink-muted text-left">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Zona</th>
                <th className="px-4 py-3">Cobrador</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rutas.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3">{r.nombre}</td>
                  <td className="px-4 py-3 text-ink-secondary">{r.zona ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {r.cobradores?.usuarios?.nombre_completo ?? "Sin asignar"}
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{r.activa ? "Activa" : "Inactiva"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
