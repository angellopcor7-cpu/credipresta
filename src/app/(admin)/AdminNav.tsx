"use client";

import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Nav del admin: a petición de Empresa se quitaron todos los enlaces de
 * texto (Panel, Cobradores, Rutas, Clientes, Préstamos, Corte, Solicitudes)
 * — la navegación ahora se hace solo desde los "Accesos rápidos" del
 * dashboard (ver dashboard/page.tsx). Aquí solo queda lo que pidió dejar:
 * el selector de tema, el nombre de la cuenta y cerrar sesión.
 */
export function AdminNav({
  nombreUsuario,
  signOutAction,
}: {
  nombreUsuario: string;
  signOutAction: () => Promise<void>;
}) {
  return (
    <div className="flex items-center gap-3 sm:gap-5 text-sm text-ink-secondary">
      <ThemeToggle />
      <span className="text-ink-muted hidden sm:inline">{nombreUsuario}</span>
      <form action={signOutAction}>
        <button className="text-ink-muted hover:text-ink">Cerrar sesión</button>
      </form>
    </div>
  );
}
