/**
 * Utilidades de fecha en horario de Ciudad de México, compartidas entre el
 * dashboard (Análisis por periodo) y el corte semanal. Viven en un solo
 * lugar para no tener dos copias de la misma lógica de "qué semana es hoy"
 * desincronizándose entre sí.
 */

/** "Buenos días" / "Buenas tardes" / "Buenas noches" según la hora actual en CDMX (para el saludo del panel). */
export function saludoPorHora(): string {
  const horaCDMX = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Mexico_City",
    }).format(new Date())
  );
  if (horaCDMX < 12) return "Buenos días";
  if (horaCDMX < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** La fecha de hoy ("YYYY-MM-DD") en hora de CDMX, como objeto Date en UTC a mediodía (evita saltos de día). */
export function hoyEnMexicoComoFecha(): Date {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valores: Record<string, string> = {};
  for (const parte of partes) valores[parte.type] = parte.value;
  return new Date(Date.UTC(Number(valores.year), Number(valores.month) - 1, Number(valores.day), 12));
}

/**
 * Clave "YYYY-MM" de una fecha, en horario de Ciudad de México. Sirve tanto para
 * columnas `timestamptz` (con hora) como `date` (solo fecha, ej. "2026-09-01").
 */
export function claveMes(fechaTexto: string): string {
  const fecha = new Date(fechaTexto.length === 10 ? `${fechaTexto}T12:00:00Z` : fechaTexto);
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "America/Mexico_City",
  })
    .format(fecha)
    .slice(0, 7);
}

/** Los últimos `cantidad` meses (incluyendo el actual), del más viejo al más nuevo, en hora de CDMX. */
export function ultimosMeses(cantidad: number): { clave: string; etiqueta: string }[] {
  const hoyEnMexico = hoyEnMexicoComoFecha();
  const primerDiaDelMes = new Date(Date.UTC(hoyEnMexico.getUTCFullYear(), hoyEnMexico.getUTCMonth(), 1));

  const meses: { clave: string; etiqueta: string }[] = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    const fecha = new Date(primerDiaDelMes);
    fecha.setUTCMonth(fecha.getUTCMonth() - i);
    const clave = `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
    const etiqueta = new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" }).format(fecha);
    meses.push({ clave, etiqueta });
  }
  return meses;
}

/** Clave "YYYY-MM-DD" de una fecha, en hora de CDMX (funciona con columnas `date` y `timestamptz`). */
export function claveDia(fechaTexto: string): string {
  const fecha = new Date(fechaTexto.length === 10 ? `${fechaTexto}T12:00:00Z` : fechaTexto);
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(fecha);
}

/** Los últimos `cantidad` días (incluyendo hoy), del más viejo al más nuevo, en hora de CDMX. */
export function ultimosDias(cantidad: number): { clave: string; etiqueta: string }[] {
  const hoy = hoyEnMexicoComoFecha();
  const dias: { clave: string; etiqueta: string }[] = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    const fecha = new Date(hoy);
    fecha.setUTCDate(fecha.getUTCDate() - i);
    const clave = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(fecha);
    const etiqueta = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(
      fecha
    );
    dias.push({ clave, etiqueta });
  }
  return dias;
}

/**
 * Clave "YYYY-MM-DD" del primer día de la semana que contiene `fechaTexto`,
 * en hora de CDMX. `diaInicioSemana` es 0=domingo..6=sábado (configurable
 * por Angel desde /corte, guardado en `configuraciones` — ver
 * `obtenerConfiguraciones`); por defecto 1 = lunes, que era el único
 * comportamiento antes de que esto se pudiera elegir. El nombre de la
 * función sigue diciendo "semana" en general (no "lunes") a propósito: el
 * día que regresa depende de esta configuración.
 */
export function claveSemana(fechaTexto: string, diaInicioSemana: number = 1): string {
  const fecha = new Date(fechaTexto.length === 10 ? `${fechaTexto}T12:00:00Z` : fechaTexto);
  const partes = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Mexico_City",
  }).formatToParts(fecha);
  const valores: Record<string, string> = {};
  for (const parte of partes) valores[parte.type] = parte.value;
  const diaUTC = new Date(Date.UTC(Number(valores.year), Number(valores.month) - 1, Number(valores.day), 12));
  const diaSemana = diaUTC.getUTCDay(); // 0 = domingo
  const diasDesdeElInicio = (diaSemana - diaInicioSemana + 7) % 7;
  diaUTC.setUTCDate(diaUTC.getUTCDate() - diasDesdeElInicio);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(diaUTC);
}

/** Las últimas `cantidad` semanas (incluyendo la actual, empezando en `diaInicioSemana`), del más vieja a la más nueva, en hora de CDMX. */
export function ultimasSemanas(cantidad: number, diaInicioSemana: number = 1): { clave: string; etiqueta: string }[] {
  const hoy = hoyEnMexicoComoFecha();
  const claveHoy = claveSemana(new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(hoy), diaInicioSemana);
  const lunesActual = new Date(`${claveHoy}T12:00:00Z`);

  const semanas: { clave: string; etiqueta: string }[] = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    const fecha = new Date(lunesActual);
    fecha.setUTCDate(fecha.getUTCDate() - i * 7);
    const clave = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(fecha);
    const etiqueta = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(
      fecha
    );
    semanas.push({ clave, etiqueta });
  }
  return semanas;
}

/** Primer día ("YYYY-MM-DD") de la semana actual (según `diaInicioSemana`), en hora de CDMX. */
export function lunesDeHoy(diaInicioSemana: number = 1): string {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(hoyEnMexicoComoFecha());
  return claveSemana(hoy, diaInicioSemana);
}

/** Suma (o resta, con delta negativo) `delta` semanas a una clave de lunes "YYYY-MM-DD". */
export function semanaMasDelta(claveLunes: string, delta: number): string {
  const fecha = new Date(`${claveLunes}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + delta * 7);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(fecha);
}

/** Último día ("YYYY-MM-DD") de la semana que empieza en `claveLunes` (6 días después — funciona para cualquier `diaInicioSemana`, no solo lunes-domingo). */
export function domingoDe(claveLunes: string): string {
  const fecha = new Date(`${claveLunes}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + 6);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(fecha);
}

/** true si `fechaTexto` (date o timestamptz) cae dentro de la semana (lunes-domingo) de `claveLunes`, en hora de CDMX. */
export function estaEnSemana(fechaTexto: string, claveLunes: string): boolean {
  const dia = claveDia(fechaTexto);
  return dia >= claveLunes && dia <= domingoDe(claveLunes);
}

/** "1 - 7 sep 2026" a partir del lunes de una semana. */
export function formatoRangoSemana(claveLunes: string): string {
  const lunes = new Date(`${claveLunes}T12:00:00Z`);
  const domingo = new Date(`${domingoDe(claveLunes)}T12:00:00Z`);
  const diaLunes = lunes.getUTCDate();
  const textoDomingo = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(domingo);
  return `${diaLunes} - ${textoDomingo}`;
}

/** Versión compacta sin año ("1-7 sep"), para etiquetas de eje donde no cabe el formato completo. */
export function formatoRangoSemanaCorto(claveLunes: string): string {
  const lunes = new Date(`${claveLunes}T12:00:00Z`);
  const domingo = new Date(`${domingoDe(claveLunes)}T12:00:00Z`);
  const diaLunes = lunes.getUTCDate();
  const textoDomingo = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(domingo);
  return `${diaLunes}-${textoDomingo}`;
}
