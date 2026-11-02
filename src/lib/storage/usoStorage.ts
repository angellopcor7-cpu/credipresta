import { createClient } from "@/lib/supabase/server";

export type UsoStorage = {
  /** Bytes usados solo en el bucket de documentos de clientes (fotos, INE, pagarés). */
  bytesDocumentos: number;
  /** Bytes usados en todo el storage del proyecto (documentos + respaldos de corte, etc.). */
  bytesTotal: number;
};

/**
 * Lee cuánto storage (almacenamiento de archivos) se está usando realmente
 * en Supabase, vía la función `resumen_uso_storage()` (admin-only — para
 * cualquier otro usuario regresa vacío). Solo tiene sentido llamarla desde
 * páginas de Empresa (admin).
 */
export async function obtenerUsoStorage(): Promise<UsoStorage> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("resumen_uso_storage");

  let bytesDocumentos = 0;
  let bytesTotal = 0;
  for (const fila of (data ?? []) as { bucket_id: string; bytes: number | string }[]) {
    const bytes = Number(fila.bytes) || 0;
    bytesTotal += bytes;
    if (fila.bucket_id === "documentos-clientes") bytesDocumentos = bytes;
  }

  return { bytesDocumentos, bytesTotal };
}

/** Promedio razonable de bytes por cliente cuando todavía no hay suficientes datos reales. */
export const PROMEDIO_BYTES_POR_CLIENTE_ESTIMADO = 700 * 1024; // ~700KB: 4 documentos ya comprimidos (~1MB máx. cada uno, pero en la práctica pesan menos)

export function formatoBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
