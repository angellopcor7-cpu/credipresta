import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirVistaCobrador } from "@/lib/auth/roles";
import { ThemeToggle } from "@/components/ThemeToggle";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function CobradorLayout({ children }: { children: React.ReactNode }) {
  const sesion = await exigirVistaCobrador();

  return (
    <div className="min-h-screen bg-page text-ink">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/panel" className="font-bold text-lg">
            Credi<span className="text-accent-text">Presta</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-ink-secondary flex-wrap">
            <Link href="/panel" className="hover:text-ink">
              Mis clientes
            </Link>
            <Link href="/panel/clientes/nuevo" className="hover:text-ink">
              + Nuevo cliente
            </Link>
            {sesion.rol === "administrador" && (
              <Link
                href="/dashboard"
                className="text-xs border border-border-strong rounded-full px-3 py-1 hover:border-border-soft"
              >
                Vista Empresa
              </Link>
            )}
            <ThemeToggle />
            <span className="text-ink-muted">{sesion.nombreCompleto}</span>
            <form action={signOut}>
              <button className="text-ink-muted hover:text-ink">Cerrar sesión</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
