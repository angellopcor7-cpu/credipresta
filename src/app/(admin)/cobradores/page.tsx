import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CobradorConUsuario } from "@/lib/types";
import { ChevronRight } from "lucide-react";

export default async function CobradoresPage() {
  const supabase = await createClient();

  const [{ data }, { data: clientesActivos }] = await Promise.all([
    supabase
      .from("cobradores")
      .select("*, usuarios(nombre_completo, telefono)")
      .order("fecha_ingreso", { ascending: false }),
    supabase.from("clientes").select("cobrador_id").eq("estado", "activo"),
  ]);

  const cobradores = (data ?? []) as unknown as CobradorConUsuario[];

  const conteoClientes = new Map<string, number>();
  for (const c of clientesActivos ?? []) {
    if (!c.cobrador_id) continue;
    conteoClientes.set(c.cobrador_id, (conteoClientes.get(c.cobrador_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cobradores</h1>
        <Link
          href="/cobradores/nuevo"
          className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm px-4 py-2 rounded-md"
        >
          + Nuevo cobrador
        </Link>
      </div>

      {cobradores.length === 0 ? (
        <p className="text-ink-muted text-sm">Aún no hay cobradores registrados.</p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface text-ink-muted text-left">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Zona</th>
                <th className="px-4 py-3">Clientes activos</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {cobradores.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/cobradores/${c.id}`} className="font-medium hover:text-accent-text hover:underline">
                      {c.usuarios?.nombre_completo ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{c.usuarios?.telefono ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-secondary">{c.zona ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-secondary">{conteoClientes.get(c.id) ?? 0}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs border rounded-full px-2 py-1 ${
                        c.activo
                          ? "bg-surface-2 text-ink-strong border-border-soft"
                          : "bg-surface-2 text-ink-muted border-border-strong"
                      }`}
                    >
                      {c.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/cobradores/${c.id}`}
                      className="inline-flex items-center text-ink-muted hover:text-ink"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
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
