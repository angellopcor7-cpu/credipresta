import { createClient } from "@/lib/supabase/server";
import type { CobradorConUsuario } from "@/lib/types";
import { crearRuta } from "../actions";

export default async function NuevaRutaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("cobradores").select("*, usuarios(nombre_completo, telefono)").eq("activo", true);
  const cobradores = (data ?? []) as unknown as CobradorConUsuario[];

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Nueva ruta</h1>
      <form action={crearRuta} className="space-y-4 bg-slate-900 p-6 rounded-xl border border-slate-800">
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="nombre">
            Nombre de la ruta
          </label>
          <input
            id="nombre"
            name="nombre"
            required
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="zona">
            Zona
          </label>
          <input
            id="zona"
            name="zona"
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
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
            {cobradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.usuarios?.nombre_completo}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-md py-2 text-sm">
          Guardar ruta
        </button>
      </form>
    </div>
  );
}
