import sharp from "sharp";

/** Límite que le pedimos a cada foto/documento: que no pese más de esto. */
const LIMITE_BYTES = 1024 * 1024; // 1 MB

const ANCHO_INICIAL = 1600; // de sobra para que un INE o comprobante se siga leyendo bien
const CALIDAD_INICIAL = 80;
const INTENTOS_MAXIMOS = 5;

/**
 * Comprime una imagen para que no pese más de ~1MB (bajando calidad y, si
 * hace falta, también el ancho), sin perder legibilidad del documento. Todo
 * se reencoda a JPEG para normalizar formatos pesados (PNG, HEIC, etc.).
 *
 * Si el archivo NO es una imagen (p. ej. un PDF del pagaré ya impreso), lo
 * regresamos intacto: no hay forma segura de recomprimir un PDF aquí sin
 * arriesgar que quede ilegible o corrupto.
 *
 * Esto corre en el servidor (Server Action), justo antes de subir a
 * Supabase Storage — así se aplica sin importar por dónde entre el archivo.
 */
export async function comprimirDocumentoSiAplica(
  archivo: File
): Promise<{ buffer: Buffer; contentType: string; nombre: string }> {
  const nombreOriginal = archivo.name || "archivo";

  if (!archivo.type.startsWith("image/")) {
    return {
      buffer: Buffer.from(await archivo.arrayBuffer()),
      contentType: archivo.type || "application/octet-stream",
      nombre: nombreOriginal,
    };
  }

  const original = Buffer.from(await archivo.arrayBuffer());

  let calidad = CALIDAD_INICIAL;
  let ancho: number | undefined = ANCHO_INICIAL;
  let salida = await recodificar(original, ancho, calidad);

  let intentos = 0;
  while (salida.byteLength > LIMITE_BYTES && intentos < INTENTOS_MAXIMOS) {
    calidad = Math.max(35, calidad - 15);
    ancho = ancho ? Math.round(ancho * 0.85) : undefined;
    salida = await recodificar(original, ancho, calidad);
    intentos++;
  }

  const base = nombreOriginal.replace(/\.[^./]+$/, "");
  return { buffer: salida, contentType: "image/jpeg", nombre: `${base}.jpg` };
}

async function recodificar(original: Buffer, ancho: number | undefined, calidad: number): Promise<Buffer> {
  return sharp(original, { failOn: "none" })
    .rotate() // respeta la orientación EXIF (fotos tomadas con el celular de lado) antes de tirar los metadatos
    .resize({ width: ancho, withoutEnlargement: true })
    .jpeg({ quality: calidad })
    .toBuffer();
}
