import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900 text-white px-6">
      <div className="fixed top-4 right-4 flex bg-slate-900 border border-slate-800 rounded-full p-1 text-sm">
        <Link href="/login" className="px-4 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-slate-800">
          Negocio
        </Link>
        <Link
          href="/cliente/login"
          className="px-4 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-slate-800"
        >
          Cliente
        </Link>
      </div>

      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Credi<span className="text-emerald-400">Presta</span>
        </h1>
        <p className="text-slate-300 text-lg">
          Gestiona tus préstamos, clientes y pagos en un solo lugar. Simple,
          rápido y en la nube.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-block bg-emerald-500 hover:bg-emerald-400 transition-colors text-slate-950 font-semibold px-6 py-3 rounded-lg"
          >
            Iniciar sesión (negocio)
          </Link>
          <Link
            href="/cliente/registro"
            className="inline-block border border-slate-700 hover:border-slate-500 transition-colors text-white font-semibold px-6 py-3 rounded-lg"
          >
            Soy cliente, quiero un préstamo
          </Link>
        </div>
      </div>
    </div>
  );
}
