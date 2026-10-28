import { createClient } from "@/lib/supabase/server";
import type { Gasto, CategoriaGasto } from "@/lib/types";
import { crearGasto, eliminarGasto } from "./actions";
import { Receipt, Trash2, Building2, Users, Tag } from "lucide-react";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function formatoFechaCorta(fecha: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${fecha}T00:00:00Z`)
  );
}

const ETIQUETA_CATEGORIA: Record<CategoriaGasto, string> = {
  piso: "Piso / renta",
  comision_cobradores: "Comisión de cobradores",
  otro: "Otro",
};

const ICONO_CATEGORIA: Record<CategoriaGasto, typeof Building2> = {
  piso: Building2,
  comision_cobradores: Users,
  otro: Tag,
};

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Bitácora de gastos del negocio: renta del piso, lo que se le paga de
 * comisión a los cobradores, y cualquier otro gasto operativo (camisas,
 * reparación de motos, etc.). Es manual — Empresa lo anota cuando de verdad
 * sale el dinero — y de aquí se alimentan los totales de gasto que se ven
 * en /historial.
 */
export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; exito?: string }>;
}) {
  const { error, exito } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("gastos")
    .select("*, usuarios(nombre_completo)")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

  const gastos = (data ?? []) as unknown as (Gasto & { usuarios: { nombre_completo: string } | null })[];

  const inicioMes = hoyISO().slice(0, 7); // "YYYY-MM"
  const gastoTotal = gastos.reduce((s, g) => s + Number(g.monto), 0);
  const gastoEsteMes = gastos.filter((g) => g.fecha.slice(0, 7) === inicioMes).reduce((s, g) => s + Number(g.monto), 0);
  const gastoPorCategoria = (categoria: CategoriaGasto) =>
    gastos.filter((g) => g.categoria === categoria).reduce((s, g) => s + Number(g.monto), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Receipt className="h-5 w-5 text-accent-text" />
        <h1 className="text-2xl font-bold">Gastos</h1>
      </div>

      {error && (
        <p className="text-sm text-danger-text bg-danger-chip-bg/50 border border-danger-chip-border rounded-md px-3 py-2">{error}</p>
      )}
      {exito && (
        <p className="text-sm text-accent-text bg-accent-chip-bg/50 border border-accent-chip-border rounded-md px-3 py-2">
          {exito}
        </p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Resumen label="Gasto total" value={currency(gastoTotal)} destacado />
        <Resumen label="Gasto este mes" value={currency(gastoEsteMes)} destacado />
        <Resumen label="Piso / renta" value={currency(gastoPorCategoria("piso"))} />
        <Resumen label="Comisión cobradores" value={currency(gastoPorCategoria("comision_cobradores"))} />
        <Resumen label="Otros gastos" value={currency(gastoPorCategoria("otro"))} />
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">Registrar gasto</h2>
        <form action={crearGasto} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-ink-muted" htmlFor="categoria">
              Categoría
            </label>
            <select
              id="categoria"
              name="categoria"
              required
              defaultValue="otro"
              className="rounded-md bg-surface-2 border border-border-strong px-2 py-1.5 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="piso">Piso / renta</option>
              <option value="comision_cobradores">Comisión de cobradores</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-ink-muted" htmlFor="concepto">
              Concepto
            </label>
            <input
              id="concepto"
              name="concepto"
              required
              placeholder="Ej. renta de octubre, camisas, reparación de moto"
              className="w-64 rounded-md bg-surface-2 border border-border-strong px-2 py-1.5 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-ink-muted" htmlFor="monto">
              Monto
            </label>
            <input
              id="monto"
              name="monto"
              type="number"
              min="0.01"
              step="0.01"
              required
              className="w-28 rounded-md bg-surface-2 border border-border-strong px-2 py-1.5 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-ink-muted" htmlFor="fecha">
              Fecha
            </label>
            <input
              id="fecha"
              name="fecha"
              type="date"
              required
              defaultValue={hoyISO()}
              className="rounded-md bg-surface-2 border border-border-strong px-2 py-1.5 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-ink-muted" htmlFor="notas">
              Nota (opcional)
            </label>
            <input
              id="notas"
              name="notas"
              className="w-48 rounded-md bg-surface-2 border border-border-strong px-2 py-1.5 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <button className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm px-4 py-2 rounded-md">
            Registrar
          </button>
        </form>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Historial de gastos ({gastos.length})</h2>
        {gastos.length === 0 ? (
          <p className="text-ink-muted text-sm">Todavía no se ha registrado ningún gasto.</p>
        ) : (
          <div className="border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-ink-muted text-left">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Concepto</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Nota</th>
                  <th className="px-4 py-3">Registró</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {gastos.map((g) => {
                  const Icono = ICONO_CATEGORIA[g.categoria];
                  return (
                    <tr key={g.id} className="border-t border-border hover:bg-surface-2">
                      <td className="px-4 py-3 text-ink-muted whitespace-nowrap">{formatoFechaCorta(g.fecha)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs bg-surface-2 border border-border-strong rounded-full px-2 py-1">
                          <Icono className="h-3 w-3" />
                          {ETIQUETA_CATEGORIA[g.categoria]}
                        </span>
                      </td>
                      <td className="px-4 py-3">{g.concepto}</td>
                      <td className="px-4 py-3 font-medium text-danger-text">{currency(Number(g.monto))}</td>
                      <td className="px-4 py-3 text-ink-muted text-xs">{g.notas ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-muted text-xs">{g.usuarios?.nombre_completo ?? "—"}</td>
                      <td className="px-4 py-3">
                        <form action={eliminarGasto}>
                          <input type="hidden" name="gasto_id" value={g.id} />
                          <button
                            className="text-ink-muted hover:text-danger-text"
                            aria-label="Eliminar gasto"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Resumen({ label, value, destacado }: { label: string; value: string; destacado?: boolean }) {
  return (
    <div className={`bg-surface border rounded-xl p-4 ${destacado ? "border-accent-chip-border" : "border-border"}`}>
      <p className="text-ink-muted text-xs">{label}</p>
      <p className={`text-lg font-bold mt-1 ${destacado ? "text-accent-text" : ""}`}>{value}</p>
    </div>
  );
}
