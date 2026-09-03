import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirCobrador } from "@/lib/auth/roles";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function CobradorLayout({ children }: { children: React.ReactNode }) {
  const sesion = await exigirCobrador();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/panel" className="font-bold text-lg">
            Credi<span className="text-emerald-400">Presta</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-300">
            <span className="text-slate-500">{sesion.nombreCompleto}</span>
            <form action={signOut}>
              <button className="text-slate-400 hover:text-white">Cerrar sesión</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
