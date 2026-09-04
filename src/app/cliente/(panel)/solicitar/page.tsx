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
        Elige cuánto necesitas y a cuántos días, y sube tus documentos. Tu solicitud queda pendiente hasta que un
        administrador la revise y la apruebe.
      </p>

      <form
        action={crearSolicitudPrestamo}
        encType="multipart/form-data"
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

        <div className="space-y-3 pt-2 border-t border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">Documentos (obligatorios, máx. 10MB c/u)</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <FileField label="INE — frente" name="doc_ine_frente" />
            <FileField label="INE — reverso" name="doc_ine_reverso" />
            <FileField label="Comprobante de domicilio" name="doc_comprobante_domicilio" />
            <FileField label="Foto tuya" name="doc_foto_cliente" />
          </div>
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

function FileField({ label, name }: { label: string; name: string }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-slate-300" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="file"
        accept="image/*,.pdf"
        required
        className="w-full text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200"
      />
    </div>
  );
}
