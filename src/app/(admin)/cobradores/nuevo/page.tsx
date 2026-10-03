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
        className="space-y-4 bg-surface p-6 rounded-xl border border-border"
      >
        <Field label="Nombre completo" name="nombre_completo" required />
        <Field label="Correo (para iniciar sesión)" name="email" type="email" required />
        <Field label="Contraseña temporal" name="password" type="password" required hint="Mínimo 6 caracteres — el cobrador la puede cambiar después." />
        <Field label="Teléfono" name="telefono" />
        <Field label="Zona" name="zona" />

        {error && (
          <p className="text-sm text-danger-text bg-danger-chip-bg/50 border border-danger-chip-border rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold rounded-md py-2 text-sm">
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
      <label className="text-sm text-ink-secondary" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
