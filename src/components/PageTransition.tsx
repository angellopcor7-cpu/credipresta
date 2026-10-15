"use client";

import { usePathname } from "next/navigation";

/**
 * Hace que cada pantalla entre con un fade + slide sutil al navegar, en vez
 * de aparecer de golpe. El `key={pathname}` es lo que obliga a React a
 * "remontar" este div en cada cambio de ruta — así la animación (definida
 * en globals.css, `.animate-page-in`) se vuelve a disparar cada vez, no
 * solo la primera vez que carga la app.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
