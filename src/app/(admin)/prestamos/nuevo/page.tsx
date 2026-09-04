import { createClient } from "@/lib/supabase/server";
import { crearPrestamo } from "../actions";
import { calcularMontoTotal, calcularPorcentajeInteresPorPlazo, PLAZOS_VALIDOS } from "@/lib/finance/calculos";

export default async function NuevoPrestamoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data: clientes }, { data: cobradores }] = await Promise.all([
    supabase.from("clientes").select("id, nombre_completo").eq("estado", "activo").order("nombre_completo"),
    supabase.from("cobradores").select("id, usuarios(nombre_completo)").eq("activo", true),
  ]);

  const listaCobradores = (cobradores ?? []) as unknown as Array<{
    id: string;
    usuarios: { nombre_completo: string } | null;
  }>;

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Nuevo préstamo</h1>
      <form action={crearPrestamo} className="space-y-4 bg-slate-900 p-6 rounded-xl border border-slate-800">
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="cliente_id">
            Cliente
          </label>
          <select
            id="cliente_id"
            name="cliente_id"
            required
            defaultValue=""
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="" disabled>
              Selecciona un cliente
            </option>
            {(clientes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre_completo}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="cobrador_id">
            Cobrador responsable (opcional)
          </label>
          <select
            id="cobrador_id"
            name="cobrador_id"
            defaultValue=""
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Sin asignar</option>
            {listaCobradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.usuarios?.nombre_completo}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-slate-300" htmlFor="monto_prestado">
              Monto prestado
            </label>
            <input
              id="monto_prestado"
              name="monto_prestado"
              type="number"
              min="1"
              step="0.01"
              required
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-300" htmlFor="plazo_dias">
              Plazo
            </label>
            <select
              id="plazo_dias"
              name="plazo_dias"
              required
              defaultValue={PLAZOS_VALIDOS[0]}
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {PLAZOS_VALIDOS.map((dias) => (
                <option key={dias} value={dias}>
                  {dias} días ({calcularPorcentajeInteresPorPlazo(dias)}% de interés)
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          El interés depende del plazo: a 20 días es 20%, a 30 días es 30%. Por ejemplo, $5,000 a 20 días da un
          total a pagar de{" "}
          {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
            calcularMontoTotal(5000, calcularPorcentajeInteresPorPlazo(20))
          )}{" "}
          (pago diario $300). El total, el interés y el calendario de pagos se calculan automáticamente al
          guardar.
        </p>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-md py-2 text-sm">
          Crear préstamo
        </button>
      </form>
    </div>
  );
}
