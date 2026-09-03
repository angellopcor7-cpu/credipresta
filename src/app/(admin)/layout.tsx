import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirAdministrador } from "@/lib/auth/roles";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await exigirAdministrador();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="font-bold text-lg">
            Credi<span className="text-emerald-400">Presta</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-slate-300 flex-wrap">
            <Link href="/dashboard" className="hover:text-white">
              Panel
            </Link>
            <Link href="/cobradores" className="hover:text-white">
              Cobradores
            </Link>
            <Link href="/rutas" className="hover:text-white">
              Rutas
            </Link>
            <Link href="/clientes" className="hover:text-white">
              Clientes
            </Link>
            <Link href="/prestamos" className="hover:text-white">
              Préstamos
            </Link>
            <span className="text-slate-500">{sesion.nombreCompleto}</span>
            <form action={signOut}>
              <button className="text-slate-400 hover:text-white">Cerrar sesión</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
