import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirAdministrador } from "@/lib/auth/roles";
import { saludoPorHora } from "@/lib/fechas";
import { PageTransition } from "@/components/PageTransition";
import { AdminNav } from "./AdminNav";
import { AdminSidebar } from "./AdminSidebar";

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
  const primerNombre = sesion.nombreCompleto.trim().split(/\s+/)[0] ?? sesion.nombreCompleto;

  const supabase = await createClient();
  // Cuenta las 3 clases de solicitud que le llegan a Empresa (préstamo
  // nuevo/renovación, perdón de mora, pago de días extra/personalizado) —
  // antes solo contaba préstamo nuevo aquí, así que el numerito del
  // sidebar al cargar la página se quedaba corto si lo único pendiente
  // era, por ejemplo, un perdón de mora.
  const [
    { count: countPrestamo },
    { count: countPerdonMora },
    { count: countPagoExtra },
    { count: notificacionesNoLeidasCount },
  ] = await Promise.all([
    supabase.from("solicitudes_prestamo").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase.from("solicitudes_perdon_mora").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase.from("solicitudes_pago_extra").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase.from("notificaciones").select("id", { count: "exact", head: true }).eq("usuario_id", sesion.id).eq("leida", false),
  ]);
  const solicitudesPendientesCount = (countPrestamo ?? 0) + (countPerdonMora ?? 0) + (countPagoExtra ?? 0);

  return (
    <div className="min-h-screen bg-page text-ink md:flex">
      <AdminSidebar
        solicitudesPendientesInicial={solicitudesPendientesCount}
        notificacionesNoLeidasInicial={notificacionesNoLeidasCount ?? 0}
      />
      <div className="flex-1 min-w-0">
        <header className="border-b border-border">
          <div className="pl-14 pr-4 py-4 md:px-8 flex items-center justify-between gap-3 flex-wrap">
            <p className="font-semibold">
              {saludoPorHora()} {primerNombre}
            </p>
            <AdminNav nombreUsuario={sesion.nombreCompleto} signOutAction={signOut} />
          </div>
        </header>
        <main className="px-4 py-8 md:px-8 max-w-7xl">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
