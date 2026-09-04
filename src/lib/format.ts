/** Formatea una fecha guardada como texto "YYYY-MM-DD" (sin hora) a algo legible, ej. "1 sep 2026". */
export function formatoFechaCorta(fecha: string | null | undefined): string {
  if (!fecha) return "—";
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${fecha}T00:00:00Z`)
  );
}
