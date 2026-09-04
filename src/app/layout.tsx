import type { Metadata } from "next";
import "./globals.css";
import DevModoPrueba from "./DevModoPrueba";

export const metadata: Metadata = {
  title: "CrediPresta",
  description: "Gestión de préstamos, clientes y pagos",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <DevModoPrueba />
      </body>
    </html>
  );
}
