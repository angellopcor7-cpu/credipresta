"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const ENLACES = [
  { href: "/dashboard", label: "Panel" },
  { href: "/cobradores", label: "Cobradores" },
  { href: "/rutas", label: "Rutas" },
  { href: "/clientes", label: "Clientes" },
  { href: "/prestamos", label: "Préstamos" },
  { href: "/corte", label: "Corte" },
];

/**
 * Nav del admin: en pantallas chicas (celular) se colapsa en un botón de
 * hamburguesa con un panel lateral, porque con todos los enlaces en una sola
 * fila se encimaban feo con el logo. En pantallas medianas+ se ve igual que
 * antes, en una sola fila horizontal.
 */
export function AdminNav({
  solicitudesPendientes,
  nombreUsuario,
  signOutAction,
}: {
  solicitudesPendientes: number;
  nombreUsuario: string;
  signOutAction: () => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <nav className="hidden md:flex items-center gap-5 text-sm text-ink-secondary">
        {ENLACES.map((e) => (
          <Link key={e.href} href={e.href} className="hover:text-ink">
            {e.label}
          </Link>
        ))}
        <Link href="/solicitudes" className="hover:text-ink relative inline-flex items-center gap-1">
          Solicitudes
          {solicitudesPendientes > 0 && (
            <span className="inline-flex items-center justify-center bg-amber-500 text-neutral-950 text-xs font-bold rounded-full h-5 min-w-5 px-1">
              {solicitudesPendientes}
            </span>
          )}
        </Link>
        <Link
          href="/panel"
          className="text-xs border border-border-strong rounded-full px-3 py-1 hover:border-border-soft"
        >
          Vista Cobrador
        </Link>
        <ThemeToggle />
        <span className="text-ink-muted">{nombreUsuario}</span>
        <form action={signOutAction}>
          <button className="text-ink-muted hover:text-ink">Cerrar sesión</button>
        </form>
      </nav>

      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="md:hidden relative inline-flex items-center justify-center text-ink-secondary hover:text-ink p-1.5 -mr-1.5"
        aria-label="Abrir menú"
      >
        <Menu className="h-6 w-6" />
        {solicitudesPendientes > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-amber-500 text-neutral-950 text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
            {solicitudesPendientes}
          </span>
        )}
      </button>

      {abierto && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setAbierto(false)} />
          <div className="absolute top-0 right-0 bottom-0 w-64 max-w-[80vw] bg-surface border-l border-border p-5 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-ink-muted">{nombreUsuario}</span>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="text-ink-muted hover:text-ink p-1"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-2">
              <ThemeToggle />
            </div>
            {ENLACES.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                onClick={() => setAbierto(false)}
                className="text-sm text-ink-secondary hover:text-ink hover:bg-surface-2 rounded-md px-3 py-2.5"
              >
                {e.label}
              </Link>
            ))}
            <Link
              href="/solicitudes"
              onClick={() => setAbierto(false)}
              className="text-sm text-ink-secondary hover:text-ink hover:bg-surface-2 rounded-md px-3 py-2.5 flex items-center justify-between"
            >
              Solicitudes
              {solicitudesPendientes > 0 && (
                <span className="inline-flex items-center justify-center bg-amber-500 text-neutral-950 text-xs font-bold rounded-full h-5 min-w-5 px-1">
                  {solicitudesPendientes}
                </span>
              )}
            </Link>
            <Link
              href="/panel"
              onClick={() => setAbierto(false)}
              className="text-sm text-ink-secondary hover:text-ink hover:bg-surface-2 rounded-md px-3 py-2.5 mt-2 border border-border-strong"
            >
              Vista Cobrador
            </Link>
            <form action={signOutAction} className="mt-auto pt-4 border-t border-border">
              <button className="w-full text-left text-sm text-ink-muted hover:text-ink px-3 py-2.5">
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
