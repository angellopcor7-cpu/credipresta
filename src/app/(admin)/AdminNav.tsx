"use client";

import Link from "next/link";
import { Repeat } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Nav del admin: a petición de Empresa se quitaron los enlaces de texto
 * (Panel, Cobradores, Rutas, Clientes, Préstamos, Corte, Solicitudes) — esa
 * navegación ahora se hace desde los "Accesos rápidos" del dashboard (ver
 * dashboard/page.tsx). "Vista Cobrador" se queda aquí arriba porque Empresa
 * pidió explícitamente no moverlo a los accesos rápidos.
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
      <Link
        href="/panel"
        className="inline-flex items-center gap-1.5 text-xs border border-border-strong rounded-full px-3 py-1 hover:border-border-soft"
      >
        <Repeat className="h-3.5 w-3.5" />
        Vista Cobrador
      </Link>
      <ThemeToggle />
      <span className="text-ink-muted hidden sm:inline">{nombreUsuario}</span>
      <form action={signOutAction}>
        <button className="text-ink-muted hover:text-ink">Cerrar sesión</button>
      </form>
    </div>
  );
}
