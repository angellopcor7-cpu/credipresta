import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrediPresta",
  description: "Gestión de préstamos, clientes y pagos",
};

const SCRIPT_TEMA = `
  (function () {
    try {
      var pref = localStorage.getItem("credipresta-tema") || "dark";
      var resuelto =
        pref === "system"
          ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
          : pref;
      document.documentElement.setAttribute("data-theme", resuelto);
    } catch (e) {}
  })();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased" data-theme="dark">
      <head>
        {/* Aplica el tema guardado ANTES de pintar, para que no haya parpadeo
            (un flash en oscuro u otro en claro) al cargar cada página. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
