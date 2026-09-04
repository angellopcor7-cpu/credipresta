import Link from "next/link";
import { iniciarSesionCliente } from "../actions";

export default async function LoginClientePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mensaje?: string }>;
}) {
  const { error, mensaje } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">
            Credi<span className="text-emerald-400">Presta</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Accede a tu cuenta de cliente</p>
        </div>

        <form className="space-y-4 bg-slate-900 p-6 rounded-xl border border-slate-800">
          <div className="space-y-1">
            <label className="text-sm text-slate-300" htmlFor="email">
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-300" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {mensaje && (
            <p className="text-sm text-emerald-400 bg-emerald-950/50 border border-emerald-900 rounded-md px-3 py-2">
              {mensaje}
            </p>
          )}
          {error && (
            <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            formAction={iniciarSesionCliente}
            className="w-full bg-emerald-500 hover:bg-emerald-400 transition-colors text-slate-950 font-semibold rounded-md py-2 text-sm"
          >
            Iniciar sesión
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          ¿No tienes cuenta?{" "}
          <Link href="/cliente/registro" className="text-emerald-400 hover:underline">
            Crea una
          </Link>
        </p>
      </div>
    </div>
  );
}
