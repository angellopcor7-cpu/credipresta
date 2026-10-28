"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  UserRound,
  Users,
  Landmark,
  Scissors,
  History,
  Receipt,
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
  { label: "Historial", href: "/historial", icon: History },
  { label: "Gastos", href: "/gastos", icon: Receipt },
];

const TITULO_BASE = "CrediPresta";
// Cada cuántos milisegundos se vuelve a preguntar por el conteo de
// solicitudes pendientes mientras la pestaña sigue abierta — no son
// notificaciones push de verdad (eso Angel pidió dejarlo para después),
// nomás que el numerito del sidebar y el título de la pestaña no se queden
// desactualizados si se quedan viendo otra pantalla un buen rato.
const INTERVALO_REFRESCO_MS = 45_000;

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
 *
 * También avisa cuando hay solicitudes esperando respuesta: un numerito
 * junto a "Solicitudes" (aquí y en el cajón de móvil) y el mismo número en
 * el título de la pestaña del navegador, para que se note aunque Empresa
 * esté viendo otra parte de la app. El número llega ya calculado del
 * servidor al cargar la página, y de ahí en adelante se refresca solo cada
 * rato (ver INTERVALO_REFRESCO_MS) pidiéndolo a /api/solicitudes-pendientes-count.
 */
export function AdminSidebar({ solicitudesPendientesInicial }: { solicitudesPendientesInicial: number }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [pendientes, setPendientes] = useState(solicitudesPendientesInicial);
  // Para "adoptar" el valor nuevo del servidor cuando cambia (por ejemplo,
  // al navegar a otra pantalla del panel) sin esperar al siguiente refresco
  // por tiempo. Comparar y ajustar aquí mismo, durante el render, es el
  // patrón que React recomienda para esto — un useEffect que solo refleja
  // una prop hacia el estado dispara una vuelta extra de render de más.
  const [solicitudesPendientesPrevias, setSolicitudesPendientesPrevias] = useState(solicitudesPendientesInicial);
  if (solicitudesPendientesInicial !== solicitudesPendientesPrevias) {
    setSolicitudesPendientesPrevias(solicitudesPendientesInicial);
    setPendientes(solicitudesPendientesInicial);
  }

  useEffect(() => {
    const intervalo = setInterval(async () => {
      try {
        const res = await fetch("/api/solicitudes-pendientes-count", { cache: "no-store" });
        if (!res.ok) return;
        const datos: { count: number } = await res.json();
        setPendientes(datos.count);
      } catch {
        // Sin conexión momentánea o lo que sea: se intenta de nuevo en el
        // siguiente ciclo, no hace falta avisar nada por esto.
      }
    }, INTERVALO_REFRESCO_MS);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    document.title = pendientes > 0 ? `(${pendientes}) ${TITULO_BASE}` : TITULO_BASE;
  }, [pendientes]);

  const enlaces = (
    <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
      {MODULOS.map((m) => {
        const activo = estaActivo(pathname, m.href);
        const avisoSolicitudes = m.href === "/solicitudes" && pendientes > 0;
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
            <span className="flex-1">{m.label}</span>
            {avisoSolicitudes && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-[10px] font-bold text-white">
                {pendientes}
              </span>
            )}
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
