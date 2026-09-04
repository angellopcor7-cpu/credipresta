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
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">
            Credi<span className="text-emerald-400">Presta</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Crea tu cuenta para pedir un préstamo</p>
        </div>

        <form
          action={registrarCliente}
          encType="multipart/form-data"
          className="space-y-4 bg-slate-900 p-6 rounded-xl border border-slate-800"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo label="Nombre completo" name="nombre_completo" required />
            <Campo label="Teléfono" name="telefono" type="tel" />
          </div>
          <Campo label="Dirección" name="direccion" />

          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h2 className="text-sm font-semibold text-slate-200">Documentos (obligatorios, máx. 10MB c/u)</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Archivo label="INE — frente" name="doc_ine_frente" />
              <Archivo label="INE — reverso" name="doc_ine_reverso" />
              <Archivo label="Comprobante de domicilio" name="doc_comprobante_domicilio" />
              <Archivo label="Foto tuya" name="doc_foto_cliente" />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-4">
            <Campo label="Correo" name="email" type="email" required />
            <Campo label="Contraseña" name="password" type="password" required minLength={6} />
            <Campo label="Confirmar contraseña" name="confirmar_password" type="password" required minLength={6} />
          </div>

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

function Archivo({ label, name }: { label: string; name: string }) {
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
