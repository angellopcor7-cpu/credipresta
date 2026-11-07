import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type Color } from "pdf-lib";
import type { FilaCorteCobrador, TotalesCorte } from "@/lib/types";
import type { ClienteRespaldo } from "@/app/(admin)/corte/calcular";

export type DatosRespaldoCorte = {
  rangoSemana: string;
  fechaGeneracion: Date;
  generadoPor: string;
  totales: TotalesCorte;
  filasCobrador: FilaCorteCobrador[];
  clientes: ClienteRespaldo[];
};

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function formatoFechaHora(d: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(d);
}

// Paleta — el mismo dorado/ámbar que ya usa el resto de la app (botones,
// tema), pero en un tono más oscuro que en pantalla porque en papel/PDF un
// ámbar claro sobre blanco se lee mal. Resto en escala de grises neutra.
const NEGRO = rgb(0.09, 0.09, 0.11);
const GRIS = rgb(0.4, 0.4, 0.46);
const GRIS_CLARO = rgb(0.58, 0.58, 0.63);
const LINEA = rgb(0.82, 0.82, 0.85);
const RELLENO_HEADER = rgb(0.94, 0.94, 0.97);
const RELLENO_ZEBRA = rgb(0.975, 0.975, 0.98);
const BLANCO = rgb(1, 1, 1);
const ACENTO = rgb(0.71, 0.33, 0.04); // ámbar oscuro (~#b45309), legible en papel
const ACENTO_CLARO = rgb(0.992, 0.95, 0.85); // ámbar muy claro, para fondos
const PELIGRO = rgb(0.72, 0.11, 0.11); // rojo, solo para montos de mora/falta por cobrar > 0

type Columna<T> = {
  header: string;
  width: number;
  align?: "left" | "right";
  get: (fila: T) => string;
  /** Color del texto para esa celda en particular (ej. rojo si hay mora). Default: NEGRO. */
  color?: (fila: T) => Color;
};

type ContextoTabla = {
  pdf: PDFDocument;
  pagina: PDFPage;
  y: number;
  ancho: number;
  alto: number;
  margen: number;
  fontRegular: PDFFont;
  fontBold: PDFFont;
};

/**
 * Dibuja una tabla con encabezado repetido en cada página nueva que haga
 * falta — así el PDF de respaldo puede tener cientos de clientes sin que se
 * corten las columnas ni se pierda de vista qué es cada una. Alterna el
 * fondo de las filas (zebra) para que sea más fácil seguir una fila larga
 * con la vista, y opcionalmente cierra con una fila de totales en negritas.
 * Devuelve el contexto actualizado (puede haber terminado en una página
 * distinta a la que empezó) para poder seguir dibujando después.
 */
function dibujarTabla<T>(
  ctx: ContextoTabla,
  columnas: Columna<T>[],
  filas: T[],
  opciones: { tamano?: number; altoFila?: number; filaTotal?: Partial<Record<number, string>> } = {}
): ContextoTabla {
  const { pdf, ancho, alto, margen, fontRegular, fontBold } = ctx;
  let { pagina, y } = ctx;
  const tamano = opciones.tamano ?? 8;
  const altoFila = opciones.altoFila ?? 15;
  const anchoTabla = columnas.reduce((s, c) => s + c.width, 0);

  function dibujarTextoEnColumna(texto: string, x: number, col: Columna<T>, bold: boolean, color: Color) {
    const font = bold ? fontBold : fontRegular;
    let tam = tamano;
    while (tam > 5.5 && font.widthOfTextAtSize(texto, tam) > col.width - 8) tam -= 0.5;
    const tx = col.align === "right" ? x + col.width - 4 - font.widthOfTextAtSize(texto, tam) : x + 4;
    pagina.drawText(texto, { x: tx, y: y - altoFila + 4.5, size: tam, font, color });
  }

  function dibujarEncabezado() {
    pagina.drawRectangle({ x: margen, y: y - altoFila, width: anchoTabla, height: altoFila, color: RELLENO_HEADER });
    let x = margen;
    for (const col of columnas) {
      dibujarTextoEnColumna(col.header, x, col, true, GRIS);
      x += col.width;
    }
    y -= altoFila;
    pagina.drawLine({ start: { x: margen, y }, end: { x: margen + anchoTabla, y }, thickness: 0.75, color: ACENTO });
  }

  function nuevaPagina() {
    pagina = pdf.addPage([ancho, alto]);
    y = alto - margen;
    dibujarEncabezado();
  }

  dibujarEncabezado();

  filas.forEach((fila, i) => {
    if (y - altoFila < margen) nuevaPagina();
    if (i % 2 === 1) {
      pagina.drawRectangle({ x: margen, y: y - altoFila, width: anchoTabla, height: altoFila, color: RELLENO_ZEBRA });
    }
    let x = margen;
    for (const col of columnas) {
      dibujarTextoEnColumna(col.get(fila), x, col, false, col.color ? col.color(fila) : NEGRO);
      x += col.width;
    }
    y -= altoFila;
    pagina.drawLine({ start: { x: margen, y }, end: { x: margen + anchoTabla, y }, thickness: 0.4, color: LINEA });
  });

  if (opciones.filaTotal) {
    if (y - altoFila < margen) nuevaPagina();
    pagina.drawLine({ start: { x: margen, y: y + 1 }, end: { x: margen + anchoTabla, y: y + 1 }, thickness: 1.2, color: NEGRO });
    let x = margen;
    for (let i = 0; i < columnas.length; i++) {
      const col = columnas[i];
      const valor = opciones.filaTotal[i];
      if (valor !== undefined) dibujarTextoEnColumna(valor, x, col, true, NEGRO);
      x += col.width;
    }
    y -= altoFila;
    pagina.drawLine({ start: { x: margen, y }, end: { x: margen + anchoTabla, y }, thickness: 0.4, color: LINEA });
  }

  return { ...ctx, pagina, y };
}

/** Caja chica estilo "stat card" — etiqueta gris arriba, valor grande abajo. */
function dibujarCajaStat(
  pagina: PDFPage,
  fontRegular: PDFFont,
  fontBold: PDFFont,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  valor: string,
  colorValor: Color = NEGRO
) {
  pagina.drawRectangle({ x, y: y - h, width: w, height: h, color: BLANCO, borderColor: LINEA, borderWidth: 0.75 });
  pagina.drawRectangle({ x, y: y - h, width: 3, height: h, color: ACENTO });
  pagina.drawText(label.toUpperCase(), { x: x + 12, y: y - 15, size: 7.5, font: fontRegular, color: GRIS });
  let tam = 13.5;
  while (tam > 9 && fontBold.widthOfTextAtSize(valor, tam) > w - 20) tam -= 0.5;
  pagina.drawText(valor, { x: x + 12, y: y - h + 13, size: tam, font: fontBold, color: colorValor });
}

/**
 * Genera el PDF de respaldo completo de un corte semanal: resumen general,
 * desglose por cobrador y el inventario completo de TODOS los clientes con
 * su préstamo más reciente (monto, saldo, mora, falta por cobrar). Es el
 * respaldo "en papel" que pidió Angel para que, si algún día se pierde algo
 * de la base de datos, quede al menos esta copia legible de lo que había.
 *
 * Estilo: membrete con barra de acento dorada, tarjetas de resumen en vez
 * de una lista plana, tablas con renglones alternados (zebra) y totales en
 * negritas, montos de mora/falta por cobrar en rojo cuando son mayores a
 * cero, y pie de página con número de página en todas las hojas — a
 * petición de Angel, para que se vea como un reporte de verdad y no una
 * tabla cruda.
 */
export async function generarRespaldoCortePDF(datos: DatosRespaldoCorte): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Respaldo corte ${datos.rangoSemana}`);
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // ---------- Portada + resumen general (carta vertical) ----------
  const ANCHO_V = 612;
  const ALTO_V = 792;
  const MARGEN_V = 48;
  let pagina = pdf.addPage([ANCHO_V, ALTO_V]);
  let y = ALTO_V - MARGEN_V;

  function texto(s: string, x: number, size = 10.5, bold = false, color: Color = NEGRO) {
    pagina.drawText(s, { x, y, size, font: bold ? fontBold : fontRegular, color });
  }
  function tituloSeccion(s: string) {
    pagina.drawRectangle({ x: MARGEN_V, y: y - 11, width: 3, height: 12, color: ACENTO });
    texto(s, MARGEN_V + 10, 11, true, NEGRO);
    y -= 20;
  }

  // Barra de acento arriba de la portada — el "membrete" del reporte.
  pagina.drawRectangle({ x: 0, y: ALTO_V - 7, width: ANCHO_V, height: 7, color: ACENTO });
  y -= 6;

  texto("CREDIPRESTA $$", MARGEN_V, 21, true);
  y -= 16;
  texto("Respaldo completo del corte semanal", MARGEN_V, 12, false, GRIS);
  y -= 26;

  // Caja de metadatos (semana / generado / confirmado por) en 3 columnas.
  const cajaMetaAlto = 46;
  pagina.drawRectangle({ x: MARGEN_V, y: y - cajaMetaAlto, width: ANCHO_V - 2 * MARGEN_V, height: cajaMetaAlto, color: ACENTO_CLARO });
  const colMetaW = (ANCHO_V - 2 * MARGEN_V) / 3;
  const metaItems: [string, string][] = [
    ["Semana", datos.rangoSemana],
    ["Generado", formatoFechaHora(datos.fechaGeneracion)],
    ["Confirmado por", datos.generadoPor],
  ];
  metaItems.forEach(([label, valor], i) => {
    const x = MARGEN_V + 14 + i * colMetaW;
    pagina.drawText(label.toUpperCase(), { x, y: y - 17, size: 7, font: fontRegular, color: GRIS });
    let tam = 10;
    const maxW = colMetaW - 20;
    while (tam > 7 && fontBold.widthOfTextAtSize(valor, tam) > maxW) tam -= 0.5;
    pagina.drawText(valor, { x, y: y - 32, size: tam, font: fontBold, color: NEGRO });
  });
  y -= cajaMetaAlto + 22;

  tituloSeccion("RESUMEN GENERAL");

  const resumen: { label: string; valor: string; peligro?: boolean }[] = [
    { label: "Clientes activos", valor: String(datos.totales.clientesActivos) },
    { label: "Prestado esta semana", valor: currency(datos.totales.prestadoSemana) },
    { label: "Recolectado esta semana", valor: currency(datos.totales.cobradoSemana) },
    { label: "Mora generada esta semana", valor: currency(datos.totales.moraGeneradaSemana), peligro: datos.totales.moraGeneradaSemana > 0 },
    { label: "Saldo pendiente (préstamos activos)", valor: currency(datos.totales.saldoPendiente) },
    { label: "Mora acumulada (préstamos activos)", valor: currency(datos.totales.moraAcumulada), peligro: datos.totales.moraAcumulada > 0 },
    { label: "Falta por cobrar (saldo + mora)", valor: currency(datos.totales.faltaPorCobrar), peligro: datos.totales.faltaPorCobrar > 0 },
    { label: "Comisiones de la semana", valor: currency(datos.totales.comision) },
  ];
  const GAP = 10;
  const cajaW = (ANCHO_V - 2 * MARGEN_V - GAP) / 2;
  const cajaH = 42;
  resumen.forEach((stat, i) => {
    const col = i % 2;
    const fila = Math.floor(i / 2);
    const x = MARGEN_V + col * (cajaW + GAP);
    const yFila = y - fila * (cajaH + 8);
    dibujarCajaStat(pagina, fontRegular, fontBold, x, yFila, cajaW, cajaH, stat.label, stat.valor, stat.peligro ? PELIGRO : NEGRO);
  });
  y -= Math.ceil(resumen.length / 2) * (cajaH + 8) + 14;

  tituloSeccion("POR COBRADOR");

  let ctx: ContextoTabla = {
    pdf,
    pagina,
    y,
    ancho: ANCHO_V,
    alto: ALTO_V,
    margen: MARGEN_V,
    fontRegular,
    fontBold,
  };

  const columnasCobrador: Columna<FilaCorteCobrador>[] = [
    { header: "Cobrador", width: 92, get: (f) => f.nombre },
    { header: "Clientes", width: 45, align: "right", get: (f) => String(f.clientesActivos) },
    { header: "Prestado", width: 65, align: "right", get: (f) => currency(f.prestadoSemana) },
    { header: "Recolectado", width: 65, align: "right", get: (f) => currency(f.cobradoSemana) },
    { header: "Mora gen.", width: 58, align: "right", get: (f) => currency(f.moraGeneradaSemana), color: (f) => (f.moraGeneradaSemana > 0 ? PELIGRO : NEGRO) },
    { header: "Mora acum.", width: 58, align: "right", get: (f) => currency(f.moraAcumulada), color: (f) => (f.moraAcumulada > 0 ? PELIGRO : NEGRO) },
    { header: "Falta cobrar", width: 68, align: "right", get: (f) => currency(f.faltaPorCobrar), color: (f) => (f.faltaPorCobrar > 0 ? PELIGRO : NEGRO) },
    { header: "Comisión", width: 65, align: "right", get: (f) => currency(f.comision) },
  ];
  ctx = dibujarTabla(ctx, columnasCobrador, datos.filasCobrador, {
    tamano: 8,
    filaTotal: {
      0: "TOTAL",
      1: String(datos.totales.clientesActivos),
      2: currency(datos.totales.prestadoSemana),
      3: currency(datos.totales.cobradoSemana),
      4: currency(datos.totales.moraGeneradaSemana),
      5: currency(datos.totales.moraAcumulada),
      6: currency(datos.totales.faltaPorCobrar),
      7: currency(datos.totales.comision),
    },
  });

  // ---------- Inventario completo de clientes (horizontal: más columnas) ----------
  const ANCHO_H = 792;
  const ALTO_H = 612;
  const MARGEN_H = 40;
  pagina = pdf.addPage([ANCHO_H, ALTO_H]);
  pagina.drawRectangle({ x: 0, y: ALTO_H - 6, width: ANCHO_H, height: 6, color: ACENTO });
  y = ALTO_H - MARGEN_H;
  pagina.drawRectangle({ x: MARGEN_H, y: y - 11, width: 3, height: 12, color: ACENTO });
  pagina.drawText(
    `INVENTARIO COMPLETO DE CLIENTES (${datos.clientes.length}) — semana ${datos.rangoSemana}`,
    { x: MARGEN_H + 10, y, size: 12, font: fontBold, color: NEGRO }
  );
  y -= 22;

  ctx = {
    pdf,
    pagina,
    y,
    ancho: ANCHO_H,
    alto: ALTO_H,
    margen: MARGEN_H,
    fontRegular,
    fontBold,
  };

  const columnasClientes: Columna<ClienteRespaldo>[] = [
    { header: "Nombre", width: 130, get: (c) => c.nombre },
    { header: "Cobrador", width: 85, get: (c) => c.cobrador },
    { header: "Teléfono", width: 60, get: (c) => c.telefono ?? "—" },
    { header: "Estado cliente", width: 55, get: (c) => c.estadoCliente },
    { header: "Préstamo", width: 55, get: (c) => c.prestamoEstado ?? "Sin préstamo" },
    { header: "Monto prestado", width: 60, align: "right", get: (c) => (c.montoPrestado != null ? currency(c.montoPrestado) : "—") },
    { header: "Saldo", width: 58, align: "right", get: (c) => (c.saldoActual != null ? currency(c.saldoActual) : "—") },
    {
      header: "Mora",
      width: 55,
      align: "right",
      get: (c) => (c.moraAcumulada != null ? currency(c.moraAcumulada) : "—"),
      color: (c) => (c.moraAcumulada != null && c.moraAcumulada > 0 ? PELIGRO : NEGRO),
    },
    {
      header: "Falta cobrar",
      width: 62,
      align: "right",
      get: (c) => (c.faltaPorCobrar != null ? currency(c.faltaPorCobrar) : "—"),
      color: (c) => (c.faltaPorCobrar != null && c.faltaPorCobrar > 0 ? PELIGRO : NEGRO),
    },
    { header: "Inicio préstamo", width: 70, get: (c) => c.fechaInicio ?? "—" },
  ];
  dibujarTabla(ctx, columnasClientes, datos.clientes, { tamano: 7.5 });

  // ---------- Pie de página en todas las hojas (ya con el total de páginas) ----------
  const paginas = pdf.getPages();
  const totalPaginas = paginas.length;
  const MARGEN_PIE = 36;
  paginas.forEach((p, i) => {
    const { width } = p.getSize();
    const yPie = 22;
    p.drawLine({ start: { x: MARGEN_PIE, y: yPie + 12 }, end: { x: width - MARGEN_PIE, y: yPie + 12 }, thickness: 0.5, color: LINEA });
    p.drawText("CrediPresta $$ · Documento generado automáticamente · Confidencial", {
      x: MARGEN_PIE,
      y: yPie,
      size: 7.5,
      font: fontRegular,
      color: GRIS_CLARO,
    });
    const textoPagina = `Página ${i + 1} de ${totalPaginas}`;
    const anchoPagina = fontRegular.widthOfTextAtSize(textoPagina, 7.5);
    p.drawText(textoPagina, { x: width - MARGEN_PIE - anchoPagina, y: yPie, size: 7.5, font: fontRegular, color: GRIS_CLARO });
  });

  return pdf.save();
}
