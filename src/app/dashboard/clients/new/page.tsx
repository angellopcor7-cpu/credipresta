import { createClientRecord } from "../actions";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Nuevo cliente</h1>
      <form
        action={createClientRecord}
        className="space-y-4 bg-slate-900 p-6 rounded-xl border border-slate-800"
      >
        <Field label="Nombre completo" name="full_name" required />
        <Field label="Teléfono" name="phone" />
        <Field label="Correo" name="email" type="email" />
        <Field label="Identificación" name="national_id" />
        <Field label="Dirección" name="address" />
        <Field label="Notas" name="notes" textarea />

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

function Field({
  label,
  name,
  type = "text",
  required = false,
  textarea = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-slate-300" htmlFor={name}>
        {label}
      </label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          rows={3}
          className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          required={required}
          className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      )}
    </div>
  );
}
