import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900 text-white px-6">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Credi<span className="text-emerald-400">Presta</span>
        </h1>
        <p className="text-slate-300 text-lg">
          Gestiona tus préstamos, clientes y pagos en un solo lugar. Simple,
          rápido y en la nube.
        </p>
        <Link
          href="/login"
          className="inline-block bg-emerald-500 hover:bg-emerald-400 transition-colors text-slate-950 font-semibold px-6 py-3 rounded-lg"
        >
          Iniciar sesión
        </Link>
      </div>
    </div>
  );
}
