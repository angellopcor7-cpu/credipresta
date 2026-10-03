import Link from "next/link";

/** App privada: solo Empresa y Cobrador entran aquí — no hay registro público. */
export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-6">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Credi<span className="text-amber-400">Presta</span>
        </h1>
        <p className="text-neutral-300 text-lg">Acceso privado para Empresa y Cobrador.</p>
        <Link
          href="/login"
          className="inline-block bg-amber-500 hover:bg-amber-400 transition-colors text-neutral-950 font-semibold px-6 py-3 rounded-lg"
        >
          Iniciar sesión
        </Link>
      </div>
    </div>
  );
}
