import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrediPresta",
  description: "Gestión de préstamos, clientes y pagos",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
