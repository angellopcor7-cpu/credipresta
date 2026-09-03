import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="font-bold text-lg">
            Credi<span className="text-emerald-400">Presta</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-slate-300">
            <Link href="/dashboard" className="hover:text-white">
              Panel
            </Link>
            <Link href="/dashboard/clients" className="hover:text-white">
              Clientes
            </Link>
            <Link href="/dashboard/loans" className="hover:text-white">
              Préstamos
            </Link>
            <span className="text-slate-500">{user.email}</span>
            <form action={signOut}>
              <button className="text-slate-400 hover:text-white">
                Cerrar sesión
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
