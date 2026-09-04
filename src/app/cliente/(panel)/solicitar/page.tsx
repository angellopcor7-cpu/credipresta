import { crearSolicitudPrestamo } from "../../actions";

export default async function SolicitarPrestamoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold">Pedir un préstamo</h1>
      <p className="text-slate-400 text-sm">
        Elige cuánto necesitas y a cuántos días. Tu solicitud queda pendiente hasta que un administrador la revise
        y la apruebe.
      </p>

      <form
        action={crearSolicitudPrestamo}
        className="space-y-4 bg-slate-900 p-6 rounded-xl border border-slate-800"
      >
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="monto_solicitado">
            Monto que necesitas
          </label>
          <input
            id="monto_solicitado"
            name="monto_solicitado"
            type="number"
            min="1"
            step="0.01"
            required
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="plazo_dias">
            Plazo (días)
          </label>
          <input
            id="plazo_dias"
            name="plazo_dias"
            type="number"
            min="1"
            step="1"
            defaultValue={20}
            required
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm text-slate-300">Método de pago</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "efectivo", label: "Efectivo" },
              { value: "transferencia", label: "Transferencia" },
              { value: "ambos", label: "Ambos" },
            ].map((opcion, i) => (
              <label
                key={opcion.value}
                className="flex items-center justify-center gap-1.5 rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-xs text-slate-300 has-[:checked]:border-emerald-500 has-[:checked]:text-emerald-400 cursor-pointer"
              >
                <input
                  type="radio"
                  name="metodo_pago"
                  value={opcion.value}
                  defaultChecked={i === 0}
                  className="accent-emerald-500"
                />
                {opcion.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Si eliges transferencia, el administrador te va a compartir los datos de la cuenta al aprobar tu
            solicitud.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">{error}</p>
        )}

        <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-md py-2 text-sm">
          Enviar solicitud
        </button>
      </form>
    </div>
  );
}
