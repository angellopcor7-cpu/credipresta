import type { MetadataRoute } from "next";

/**
 * Manifest de PWA — sin esto, cuando alguien agrega CrediPresta a su
 * pantalla de inicio en Android, el shortcut abre dentro de una pestaña de
 * Chrome normal (con la barra de dirección y el menú de 3 puntos arriba).
 * Con "display: standalone" abre como app de verdad, sin esa barra.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CrediPresta",
    short_name: "CrediPresta",
    description: "Gestión de préstamos, clientes y pagos",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
