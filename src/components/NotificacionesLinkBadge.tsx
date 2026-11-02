"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

const INTERVALO_REFRESCO_MS = 45_000;

/**
 * Link a "/notificaciones" con un numerito de no leídas al lado — mismo
 * patrón de refresco que el sidebar de Empresa
 * (/api/notificaciones-no-leidas-count), pero como componente aparte para
 * usarse en el nav simple del cobrador (que no tiene sidebar).
 */
export function NotificacionesLinkBadge({ href, noLeidasInicial }: { href: string; noLeidasInicial: number }) {
  const [noLeidas, setNoLeidas] = useState(noLeidasInicial);
  const [previo, setPrevio] = useState(noLeidasInicial);
  if (noLeidasInicial !== previo) {
    setPrevio(noLeidasInicial);
    setNoLeidas(noLeidasInicial);
  }

  useEffect(() => {
    const intervalo = setInterval(async () => {
      try {
        const res = await fetch("/api/notificaciones-no-leidas-count", { cache: "no-store" });
        if (!res.ok) return;
        const datos: { count: number } = await res.json();
        setNoLeidas(datos.count);
      } catch {
        // Se intenta de nuevo en el siguiente ciclo.
      }
    }, INTERVALO_REFRESCO_MS);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <Link href={href} className="inline-flex items-center gap-1 hover:text-ink">
      <Bell className="h-4 w-4" />
      Notificaciones
      {noLeidas > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-[10px] font-bold text-white">
          {noLeidas}
        </span>
      )}
    </Link>
  );
}
