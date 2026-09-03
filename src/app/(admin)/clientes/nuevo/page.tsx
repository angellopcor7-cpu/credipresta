import { createClient } from "@/lib/supabase/server";
import { crearCliente } from "../actions";

export default async function NuevoClientePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("rutas").select("id, nombre").eq("activa", true);
  const rutas = data ?? [];

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Nuevo cliente</h1>
      <form
        action={crearCliente}
        encType="multipart/form-data"
        className="space-y-6 bg-slate-900 p-6 rounded-xl border border-slate-800"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nombre completo" name="nombre_completo" required />
          <Field label="Teléfono" name="telefono" />
          <Field label="Identificación (INE)" name="identificacion" />
          <div className="space-y-1">
            <label className="text-sm text-slate-300" htmlFor="ruta_id">
              Asignar a ruta (opcional)
            </label>
            <select
              id="ruta_id"
              name="ruta_id"
              defaultValue=""
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Sin asignar todavía</option>
              {rutas.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Field label="Dirección" name="direccion" />
        <Field label="Referencia personal" name="referencia_personal" />
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="notas">
            Notas
          </label>
          <textarea
            id="notas"
            name="notas"
            rows={2}
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="space-y-3 pt-2 border-t border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">Documentos (opcional, máx. 10MB c/u)</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <FileField label="INE — frente" name="doc_ine_frente" />
            <FileField label="INE — reverso" name="doc_ine_reverso" />
            <FileField label="Comprobante de domicilio" name="doc_comprobante_domicilio" />
            <FileField label="Foto del cliente" name="doc_foto_cliente" />
            <FileField label="Contrato / pagaré" name="doc_contrato_pagare" />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-md py-2 text-sm">
          Guardar cliente
        </button>
      </form>
    </div>
  );
}

function Field({ label, name, required = false }: { label: string; name: string; required?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-slate-300" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        required={required}
        className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
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
        className="w-full text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200"
      />
    </div>
  );
}
