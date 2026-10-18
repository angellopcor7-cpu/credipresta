"use client";

import Link from "next/link";
import { LogOut, Repeat } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Nav del admin: a petición de Empresa se quitaron los enlaces de texto
 * (Panel, Cobradores, Rutas, Clientes, Préstamos, Corte, Solicitudes) — esa
 * navegación ahora vive en el sidebar (ver AdminSidebar.tsx) y en los
 * "Accesos rápidos" del dashboard. "Vista Cobrador" se queda aquí arriba
 * porque Empresa pidió explícitamente no moverlo.
 */
export function AdminNav({
  nombreUsuario,
  signOutAction,
}: {
  nombreUsuario: string;
  signOutAction: () => Promise<void>;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 text-sm text-ink-secondary">
      <Link
        href="/panel"
        className="inline-flex items-center gap-1.5 text-xs border border-border-strong rounded-full px-3 py-1.5 hover:border-border-soft"
        title={`Sesión de ${nombreUsuario}`}
      >
        <Repeat className="h-3.5 w-3.5" />
        Vista Cobrador
      </Link>
      <ThemeToggle />
      <form action={signOutAction}>
        <button className="inline-flex items-center gap-1.5 text-xs bg-surface-2 hover:bg-surface-3 border border-border-strong text-ink font-medium rounded-full px-3 py-1.5">
          <LogOut className="h-3.5 w-3.5" />
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
