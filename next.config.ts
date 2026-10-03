import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Por defecto Next.js limita el body de una Server Action a 1 MB. El
      // alta de cliente nuevo manda 4 fotos de documentos (cámara del
      // celular) + 2 firmas en un solo envío — eso solo no cabría en 1 MB ni
      // comprimiendo las fotos en el navegador (ver comprimirImagen.ts).
      // Vercel además limita el body de una función serverless a ~4.5 MB,
      // así que 4mb deja margen sin pasarse de ese techo de la plataforma.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
