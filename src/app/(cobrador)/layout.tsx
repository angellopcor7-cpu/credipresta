import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirVistaCobrador } from "@/lib/auth/roles";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function CobradorLayout({ children }: { children: React.ReactNode }) {
  const sesion = await exigirVistaCobrador();

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/panel" className="font-bold text-lg">
            Credi<span className="text-amber-400">Presta</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-neutral-300 flex-wrap">
            <Link href="/panel" className="hover:text-white">
              Mis clientes
            </Link>
            <Link href="/panel/clientes/nuevo" className="hover:text-white">
              + Nuevo cliente
            </Link>
            {sesion.rol === "administrador" && (
              <Link
                href="/dashboard"
                className="text-xs border border-neutral-700 rounded-full px-3 py-1 hover:border-neutral-500"
              >
                Vista Empresa
              </Link>
            )}
            <span className="text-neutral-500">{sesion.nombreCompleto}</span>
            <form action={signOut}>
              <button className="text-neutral-400 hover:text-white">Cerrar sesión</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
