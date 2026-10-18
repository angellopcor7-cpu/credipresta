import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
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

const NEGRO = rgb(0.07, 0.07, 0.1);
const GRIS = rgb(0.4, 0.4, 0.46);
const LINEA = rgb(0.8, 0.8, 0.83);
const RELLENO_HEADER = rgb(0.93, 0.93, 0.96);

type Columna<T> = {
  header: string;
  width: number;
  align?: "left" | "right";
  get: (fila: T) => string;
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
 * corten las columnas ni se pierda de vista qué es cada una. Devuelve el
 * contexto actualizado (puede haber terminado en una página distinta a la
 * que empezó) para poder seguir dibujando después de la tabla.
 */
function dibujarTabla<T>(
  ctx: ContextoTabla,
  columnas: Columna<T>[],
  filas: T[],
  opciones: { tamano?: number; altoFila?: number } = {}
): ContextoTabla {
  const { pdf, ancho, alto, margen, fontRegular, fontBold } = ctx;
  let { pagina, y } = ctx;
  const tamano = opciones.tamano ?? 8;
  const altoFila = opciones.altoFila ?? 15;
  const anchoTabla = columnas.reduce((s, c) => s + c.width, 0);

  function dibujarTextoEnColumna(texto: string, x: number, col: Columna<T>, bold: boolean) {
    const font = bold ? fontBold : fontRegular;
    let tam = tamano;
    while (tam > 5.5 && font.widthOfTextAtSize(texto, tam) > col.width - 8) tam -= 0.5;
    const tx = col.align === "right" ? x + col.width - 4 - font.widthOfTextAtSize(texto, tam) : x + 4;
    pagina.drawText(texto, { x: tx, y: y - altoFila + 4.5, size: tam, font, color: NEGRO });
  }

  function dibujarEncabezado() {
    pagina.drawRectangle({ x: margen, y: y - altoFila, width: anchoTabla, height: altoFila, color: RELLENO_HEADER });
    let x = margen;
    for (const col of columnas) {
      dibujarTextoEnColumna(col.header, x, col, true);
      x += col.width;
    }
    y -= altoFila;
    pagina.drawLine({ start: { x: margen, y }, end: { x: margen + anchoTabla, y }, thickness: 0.75, color: GRIS });
  }

  function nuevaPagina() {
    pagina = pdf.addPage([ancho, alto]);
    y = alto - margen;
    dibujarEncabezado();
  }

  dibujarEncabezado();

  for (const fila of filas) {
    if (y - altoFila < margen) nuevaPagina();
    let x = margen;
    for (const col of columnas) {
      dibujarTextoEnColumna(col.get(fila), x, col, false);
      x += col.width;
    }
    y -= altoFila;
    pagina.drawLine({ start: { x: margen, y }, end: { x: margen + anchoTabla, y }, thickness: 0.4, color: LINEA });
  }

  return { ...ctx, pagina, y };
}

/**
 * Genera el PDF de respaldo completo de un corte semanal: resumen general,
 * desglose por cobrador y el inventario completo de TODOS los clientes con
 * su préstamo más reciente (monto, saldo, mora, falta por cobrar). Es el
 * respaldo "en papel" que pidió Angel para que, si algún día se pierde algo
 * de la base de datos, quede al menos esta copia legible de lo que había.
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

  function texto(s: string, x: number, size = 10.5, bold = false, color = NEGRO) {
    pagina.drawText(s, { x, y, size, font: bold ? fontBold : fontRegular, color });
  }
  function anchoTexto(s: string, size: number, bold = false) {
    return (bold ? fontBold : fontRegular).widthOfTextAtSize(s, size);
  }

  texto("CREDIPRESTA $$", MARGEN_V, 13, true);
  y -= 22;
  texto("Respaldo completo del corte semanal", MARGEN_V, 17, true);
  y -= 24;
  texto(`Semana: ${datos.rangoSemana}`, MARGEN_V, 11);
  y -= 16;
  texto(`Generado: ${formatoFechaHora(datos.fechaGeneracion)}`, MARGEN_V, 11);
  y -= 16;
  texto(`Confirmado por: ${datos.generadoPor}`, MARGEN_V, 11);
  y -= 28;

  texto("RESUMEN GENERAL", MARGEN_V, 10.5, true, GRIS);
  y -= 18;

  const resumen: [string, string][] = [
    ["Clientes activos", String(datos.totales.clientesActivos)],
    ["Prestado esta semana", currency(datos.totales.prestadoSemana)],
    ["Recolectado esta semana", currency(datos.totales.cobradoSemana)],
    ["Mora generada esta semana", currency(datos.totales.moraGeneradaSemana)],
    ["Saldo pendiente (préstamos activos)", currency(datos.totales.saldoPendiente)],
    ["Mora acumulada (préstamos activos)", currency(datos.totales.moraAcumulada)],
    ["Falta por cobrar (saldo + mora)", currency(datos.totales.faltaPorCobrar)],
    ["Comisiones de la semana", currency(datos.totales.comision)],
  ];
  for (const [label, valor] of resumen) {
    texto(label, MARGEN_V, 10);
    texto(valor, ANCHO_V - MARGEN_V - anchoTexto(valor, 10, true), 10, true);
    y -= 16;
  }
  y -= 18;

  texto("POR COBRADOR", MARGEN_V, 10.5, true, GRIS);
  y -= 6;

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
    { header: "Mora gen.", width: 58, align: "right", get: (f) => currency(f.moraGeneradaSemana) },
    { header: "Mora acum.", width: 58, align: "right", get: (f) => currency(f.moraAcumulada) },
    { header: "Falta cobrar", width: 68, align: "right", get: (f) => currency(f.faltaPorCobrar) },
    { header: "Comisión", width: 65, align: "right", get: (f) => currency(f.comision) },
  ];
  ctx = dibujarTabla(ctx, columnasCobrador, datos.filasCobrador, { tamano: 8 });

  // ---------- Inventario completo de clientes (horizontal: más columnas) ----------
  const ANCHO_H = 792;
  const ALTO_H = 612;
  const MARGEN_H = 40;
  pagina = pdf.addPage([ANCHO_H, ALTO_H]);
  y = ALTO_H - MARGEN_H;
  pagina.drawText(
    `INVENTARIO COMPLETO DE CLIENTES (${datos.clientes.length}) — semana ${datos.rangoSemana}`,
    { x: MARGEN_H, y, size: 12, font: fontBold, color: NEGRO }
  );
  y -= 20;

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
    { header: "Mora", width: 55, align: "right", get: (c) => (c.moraAcumulada != null ? currency(c.moraAcumulada) : "—") },
    { header: "Falta cobrar", width: 62, align: "right", get: (c) => (c.faltaPorCobrar != null ? currency(c.faltaPorCobrar) : "—") },
    { header: "Inicio préstamo", width: 70, get: (c) => c.fechaInicio ?? "—" },
  ];
  dibujarTabla(ctx, columnasClientes, datos.clientes, { tamano: 7.5 });

  return pdf.save();
}
