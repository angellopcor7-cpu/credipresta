import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-ink">
            Credi<span className="text-accent-text">Presta</span>
          </h1>
          <p className="text-ink-muted text-sm mt-1">
            Accede a tu panel de gestión
          </p>
        </div>

        <form className="space-y-4 bg-surface p-6 rounded-xl border border-border">
          <div className="space-y-1">
            <label className="text-sm text-ink-secondary" htmlFor="email">
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink-secondary" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {error && (
            <p className="text-sm text-danger-text bg-danger-chip-bg/50 border border-danger-chip-border rounded-md px-3 py-2">
              {error}
            </p>
          )}
          {message && (
            <p className="text-sm text-accent-text bg-accent-chip-bg/50 border border-accent-chip-border rounded-md px-3 py-2">
              {message}
            </p>
          )}

          <button
            formAction={signIn}
            className="w-full bg-amber-500 hover:bg-amber-400 transition-colors text-neutral-950 font-semibold rounded-md py-2 text-sm"
          >
            Iniciar sesión
          </button>
        </form>

        <p className="text-center text-xs text-ink-muted">
          Las cuentas de cobradores las crea un administrador desde el panel.
        </p>
      </div>
    </div>
  );
}
