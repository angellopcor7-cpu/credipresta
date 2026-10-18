"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  FileText,
  UserRound,
  Users,
  Landmark,
  Scissors,
  Menu,
  X,
} from "lucide-react";

const MODULOS = [
  { label: "Panel", href: "/dashboard", icon: LayoutDashboard },
  { label: "Solicitudes", href: "/solicitudes", icon: FileText },
  { label: "Clientes", href: "/clientes", icon: UserRound },
  { label: "Cobradores", href: "/cobradores", icon: Users },
  { label: "Préstamos", href: "/prestamos", icon: Landmark },
  { label: "Hacer corte", href: "/corte", icon: Scissors },
];

function estaActivo(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Sidebar fijo del panel de Empresa (a petición de Angel, para que se vea
 * como el estilo de referencia que mandó: logo arriba, sección "Módulos" y
 * los enlaces de navegación en una barra lateral en vez de solo arriba). En
 * escritorio queda siempre visible; en celular/tablet se esconde y se abre
 * como un cajón con el botón de hamburguesa (fijo en la esquina para no
 * pelearse con el layout del header).
 */
export function AdminSidebar() {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  const enlaces = (
    <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
      {MODULOS.map((m) => {
        const activo = estaActivo(pathname, m.href);
        return (
          <Link
            key={m.href}
            href={m.href}
            // Al dar clic en un enlace del cajón (móvil) se cierra solo; en
            // el sidebar fijo de escritorio esto no tiene efecto visible.
            onClick={() => setAbierto(false)}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activo ? "bg-amber-500/15 text-accent-text" : "text-ink-secondary hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <m.icon className="h-4 w-4 shrink-0" />
            {m.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir menú"
        className="md:hidden fixed top-3.5 left-4 z-40 inline-flex items-center justify-center h-9 w-9 rounded-md border border-border-strong bg-surface text-ink-secondary hover:text-ink"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Sidebar fijo en escritorio */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 md:border-r md:border-border md:h-screen md:sticky md:top-0">
        <Link href="/dashboard" className="px-5 py-5 font-bold text-lg">
          Credi<span className="text-accent-text">Presta</span>
        </Link>
        <p className="px-5 pb-2 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">Módulos</p>
        {enlaces}
      </aside>

      {/* Cajón en móvil */}
      {abierto && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setAbierto(false)} />
          <aside className="animate-panel-in absolute left-0 top-0 flex h-full w-64 flex-col bg-page border-r border-border">
            <div className="flex items-center justify-between px-5 py-4">
              <span className="font-bold text-lg">
                Credi<span className="text-accent-text">Presta</span>
              </span>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menú"
                className="text-ink-muted hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="px-5 pb-2 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">Módulos</p>
            {enlaces}
          </aside>
        </div>
      )}
    </>
  );
}
