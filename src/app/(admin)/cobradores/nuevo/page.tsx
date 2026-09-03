import { crearCobrador } from "../actions";

export default async function NuevoCobradorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Nuevo cobrador</h1>
      <form
        action={crearCobrador}
        className="space-y-4 bg-slate-900 p-6 rounded-xl border border-slate-800"
      >
        <Field label="Nombre completo" name="nombre_completo" required />
        <Field label="Correo (para iniciar sesión)" name="email" type="email" required />
        <Field label="Contraseña temporal" name="password" type="password" required hint="Mínimo 6 caracteres — el cobrador la puede cambiar después." />
        <Field label="Teléfono" name="telefono" />
        <Field label="Zona" name="zona" />

        {error && (
          <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-md py-2 text-sm">
          Crear cobrador
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
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-slate-300" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
