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
        <p className="text-ink-muted text-sm">Los da de alta el cobrador desde su panel.</p>
      </div>

      {clientes.length === 0 ? (
        <p className="text-ink-muted text-sm">Aún no hay clientes.</p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface text-ink-muted text-left">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Identificación</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3">{c.nombre_completo}</td>
                  <td className="px-4 py-3 text-ink-secondary">{c.telefono ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-secondary">{c.identificacion ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-secondary">{estadoLabel[c.estado]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
