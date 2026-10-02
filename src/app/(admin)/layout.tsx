import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirAdministrador } from "@/lib/auth/roles";
import { AdminNav } from "./AdminNav";

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
  const supabase = await createClient();
  const { count: solicitudesPendientes } = await supabase
    .from("solicitudes_prestamo")
    .select("id", { count: "exact", head: true })
    .eq("estado", "pendiente");

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="font-bold text-lg">
            Credi<span className="text-amber-400">Presta</span>
          </Link>
          <AdminNav
            solicitudesPendientes={solicitudesPendientes ?? 0}
            nombreUsuario={sesion.nombreCompleto}
            signOutAction={signOut}
          />
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
