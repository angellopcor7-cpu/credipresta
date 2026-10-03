/**
 * Redimensiona y recomprime una foto (a JPEG) en el navegador antes de
 * mandarla al servidor. Las 4 fotos de documentos que pide "nuevo cliente"
 * se toman con la cámara del celular — eso fácilmente da archivos de varios
 * MB cada una, y entre las 4 más las firmas revientan el límite de tamaño
 * del formulario (ver next.config.ts), tronando el alta completa del
 * cliente con un error genérico y sin dejar ningún rastro (ni cliente ni
 * solicitud creados). Esto evita ese problema de raíz en vez de solo subir
 * el límite.
 */
export async function comprimirImagen(
  archivo: File,
  opciones: { maxDimension?: number; calidad?: number } = {}
): Promise<File> {
  const { maxDimension = 1600, calidad = 0.75 } = opciones;

  // Si no es una imagen (o el navegador no soporta esto), se manda el
  // archivo original tal cual — mejor eso que tronar el flujo completo.
  if (!archivo.type.startsWith("image/") || typeof createImageBitmap !== "function") return archivo;

  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.max(1, Math.round(bitmap.width * escala));
    const alto = Math.max(1, Math.round(bitmap.height * escala));

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) return archivo;
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", calidad));
    if (!blob) return archivo;

    // Si la "compresión" salió más pesada que el original (fotos ya chicas,
    // capturas de pantalla con poco detalle), nos quedamos con el original.
    if (blob.size >= archivo.size) return archivo;

    const nombreBase = archivo.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${nombreBase}.jpg`, { type: "image/jpeg" });
  } catch {
    return archivo;
  }
}
