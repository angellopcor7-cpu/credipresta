import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirVistaCobrador } from "@/lib/auth/roles";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PageTransition } from "@/components/PageTransition";
import { NotificacionesPushBoton } from "@/components/NotificacionesPushBoton";
import { NotificacionesLinkBadge } from "@/components/NotificacionesLinkBadge";
import { ProbarNotificacionBoton } from "@/components/ProbarNotificacionBoton";
import { salirDeImpersonacion } from "./actions";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function CobradorLayout({ children }: { children: React.ReactNode }) {
  const sesion = await exigirVistaCobrador();
  const supabase = await createClient();
  const { count: notificacionesNoLeidasCount } = await supabase
    .from("notificaciones")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", sesion.id)
    .eq("leida", false);

  return (
    <div className="min-h-screen bg-page text-ink">
      {sesion.impersonadoPor && (
        <div className="bg-amber-500 text-neutral-950 text-sm px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
          <span>
            Estás viendo y actuando como <strong>{sesion.nombreCompleto}</strong> — todo lo que hagas aquí queda
            registrado a su nombre, no al de {sesion.impersonadoPor.nombreCompleto}.
          </span>
          <form action={salirDeImpersonacion}>
            <button
              type="submit"
              className="shrink-0 bg-neutral-950 text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-neutral-900"
            >
              Salir y volver a Empresa
            </button>
          </form>
        </div>
      )}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/panel" className="font-bold text-lg">
            Credi<span className="text-accent-text">Presta</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-ink-secondary flex-wrap">
            <Link href="/panel" className="hover:text-ink">
              Mis clientes
            </Link>
            {sesion.puedeDarPrestamos && (
              <Link href="/panel/clientes/nuevo" className="hover:text-ink">
                + Nuevo cliente
              </Link>
            )}
            {sesion.rol === "administrador" && (
              <Link
                href="/dashboard"
                className="text-xs border border-border-strong rounded-full px-3 py-1 hover:border-border-soft"
              >
                Vista Empresa
              </Link>
            )}
            <NotificacionesLinkBadge href="/panel/notificaciones" noLeidasInicial={notificacionesNoLeidasCount ?? 0} />
            <NotificacionesPushBoton />
            <ProbarNotificacionBoton />
            <ThemeToggle />
            <span className="text-ink-muted">{sesion.nombreCompleto}</span>
            <form action={signOut}>
              <button className="text-ink-muted hover:text-ink">Cerrar sesión</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
