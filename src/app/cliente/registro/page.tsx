import Link from "next/link";
import { registrarCliente } from "../actions";

export default async function RegistroClientePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">
            Credi<span className="text-emerald-400">Presta</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Crea tu cuenta para pedir un préstamo</p>
        </div>

        <form action={registrarCliente} className="space-y-4 bg-slate-900 p-6 rounded-xl border border-slate-800">
          <Campo label="Nombre completo" name="nombre_completo" required />
          <Campo label="Teléfono" name="telefono" type="tel" />
          <Campo label="Dirección" name="direccion" />
          <Campo label="Correo" name="email" type="email" required />
          <Campo label="Contraseña" name="password" type="password" required minLength={6} />

          {error && (
            <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button className="w-full bg-emerald-500 hover:bg-emerald-400 transition-colors text-slate-950 font-semibold rounded-md py-2 text-sm">
            Crear cuenta
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          ¿Ya tienes cuenta?{" "}
          <Link href="/cliente/login" className="text-emerald-400 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

function Campo({
  label,
  name,
  type = "text",
  required = false,
  minLength,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  minLength?: number;
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
        minLength={minLength}
        className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}
