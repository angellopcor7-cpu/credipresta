import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

/**
 * Datos que cambian de un préstamo a otro. Todo lo demás (el texto legal,
 * el diseño) es la "plantilla" fija: nunca se vuelve a escribir a mano,
 * solo se llenan estos campos con lo que ya está guardado del préstamo.
 */
export type DatosPagare = {
  folio: string;
  nombreCliente: string;
  montoPrestado: number;
  porcentajeInteres: number;
  montoTotal: number;
  montoCuotaDiaria: number;
  plazoDias: number;
  fechaInicio: Date;
  fechaFin: Date;
  fechaFirma: Date;
  nombreCobrador: string;
  /** Lugar donde se firma (texto libre, ej. "Ciudad de México"). Solo para el documento. */
  lugar?: string;
  /** % de interés moratorio diario que se declara en el documento (no es el cálculo real de mora en pesos). */
  interesMoratorioDiarioPorcentaje?: number;
  /** Data URL "data:image/png;base64,..." de la firma que el cliente dibujó, si ya firmó. */
  firmaClienteDataUrl?: string | null;
  /** Data URL de la firma del cobrador/aval, si ya firmó. */
  firmaCobradorDataUrl?: string | null;
};

/**
 * Se formatea en la hora de México (no UTC): el servidor corre en UTC, así
 * que formatear "Fecha" con timeZone UTC podía mostrar el día siguiente al
 * real cuando ya es "mañana" en UTC pero sigue siendo "hoy" en México (por
 * ejemplo, de noche). México ya no tiene horario de verano, así que la
 * diferencia con UTC es constante y esto no afecta al cálculo de fechas
 * (que sigue haciéndose con setUTCDate en actions.ts), solo a cómo se ve.
 */
function formatoFecha(d: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(d);
}

function formatoMoneda(n: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

const ANCHO_PAGINA = 612;
const ALTO_PAGINA = 792;
const MARGEN = 60;
const ANCHO_TEXTO = ANCHO_PAGINA - MARGEN * 2;
const MARGEN_MARCO = 32;

// Paleta: negro casi puro para el texto principal, gris para etiquetas/
// líneas divisorias, y un gris muy claro de relleno para las cajas
// destacadas (Bueno por / Vencimiento), para que el documento se vea como
// un formato oficial y no como texto plano.
const NEGRO = rgb(0.07, 0.07, 0.1);
const GRIS = rgb(0.4, 0.4, 0.46);
const LINEA_COLOR = rgb(0.55, 0.55, 0.6);
const RELLENO_CLARO = rgb(0.95, 0.95, 0.97);

/** Genera el PDF del pagaré (tamaño carta) con los datos de un préstamo ya llenados en la plantilla. */
export async function generarPagarePDF(datos: DatosPagare): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Pagaré ${datos.folio}`);
  const pagina = pdf.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontCursiva = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let y = ALTO_PAGINA - MARGEN;

  // Marco decorativo de todo el documento, para que se vea como un formato
  // oficial y no como una hoja de texto suelto.
  pagina.drawRectangle({
    x: MARGEN_MARCO,
    y: MARGEN_MARCO,
    width: ANCHO_PAGINA - MARGEN_MARCO * 2,
    height: ALTO_PAGINA - MARGEN_MARCO * 2,
    borderColor: LINEA_COLOR,
    borderWidth: 1.2,
  });

  function anchoDeTexto(texto: string, tamano: number, font: PDFFont = fontRegular) {
    return font.widthOfTextAtSize(texto, tamano);
  }

  function centrarX(texto: string, tamano: number, font: PDFFont = fontRegular) {
    return (ANCHO_PAGINA - anchoDeTexto(texto, tamano, font)) / 2;
  }

  function linea(
    texto: string,
    opciones: {
      negrita?: boolean;
      cursiva?: boolean;
      tamano?: number;
      espacio?: number;
      centrado?: boolean;
      color?: ReturnType<typeof rgb>;
    } = {}
  ) {
    const font = opciones.negrita ? fontBold : opciones.cursiva ? fontCursiva : fontRegular;
    const tamano = opciones.tamano ?? 11;
    const x = opciones.centrado ? centrarX(texto, tamano, font) : MARGEN;
    pagina.drawText(texto, { x, y, size: tamano, font, color: opciones.color ?? NEGRO });
    y -= opciones.espacio ?? tamano + 8;
  }

  function parrafo(texto: string, tamano = 11) {
    const palabras = texto.split(" ");
    let renglon = "";
    const lineas: string[] = [];
    for (const palabra of palabras) {
      const prueba = renglon ? `${renglon} ${palabra}` : palabra;
      if (fontRegular.widthOfTextAtSize(prueba, tamano) > ANCHO_TEXTO) {
        lineas.push(renglon);
        renglon = palabra;
      } else {
        renglon = prueba;
      }
    }
    if (renglon) lineas.push(renglon);
    for (const renglonTexto of lineas) {
      pagina.drawText(renglonTexto, { x: MARGEN, y, size: tamano, font: fontRegular, color: NEGRO });
      y -= tamano + 6;
    }
    y -= 6;
  }

  function lineaH(x1: number, yLinea: number, x2: number, grosor = 1, color = LINEA_COLOR) {
    pagina.drawLine({ start: { x: x1, y: yLinea }, end: { x: x2, y: yLinea }, thickness: grosor, color });
  }

  function lineaV(x: number, y1: number, y2: number, grosor = 1, color = LINEA_COLOR) {
    pagina.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness: grosor, color });
  }

  function caja(x: number, yTope: number, ancho: number, alto: number, opciones: { relleno?: boolean } = {}) {
    pagina.drawRectangle({
      x,
      y: yTope - alto,
      width: ancho,
      height: alto,
      color: opciones.relleno ? RELLENO_CLARO : undefined,
      borderColor: LINEA_COLOR,
      borderWidth: 1,
    });
  }

  /**
   * Dibuja texto centrado dentro de un ancho fijo, reduciendo el tamaño de
   * letra si hace falta (nombres largos no se salen de su columna).
   */
  function textoCentradoAjustado(
    texto: string,
    xCaja: number,
    yTexto: number,
    anchoCaja: number,
    tamanoMax = 9,
    tamanoMin = 6.5
  ) {
    let tamano = tamanoMax;
    while (tamano > tamanoMin && anchoDeTexto(texto, tamano) > anchoCaja) {
      tamano -= 0.5;
    }
    const x = xCaja + Math.max(0, (anchoCaja - anchoDeTexto(texto, tamano)) / 2);
    pagina.drawText(texto, { x, y: yTexto, size: tamano, font: fontRegular, color: NEGRO });
  }

  /** Etiqueta pequeña en gris + valor debajo, usado dentro de las celdas de la tabla de datos. */
  function celda(label: string, valor: string, x: number, yTope: number) {
    pagina.drawText(label.toUpperCase(), { x: x + 10, y: yTope - 15, size: 7.5, font: fontBold, color: GRIS });
    pagina.drawText(valor, { x: x + 10, y: yTope - 31, size: 10.5, font: fontRegular, color: NEGRO });
  }

  /** Dibuja una firma (imagen PNG) centrada dentro de una caja, sin deformarla. */
  async function dibujarFirmaEnCaja(
    dataUrl: string | null | undefined,
    x: number,
    yTope: number,
    ancho: number,
    alto: number
  ) {
    if (!dataUrl?.startsWith("data:image/png;base64,")) return;
    try {
      const base64 = dataUrl.split(",")[1] ?? "";
      const imagenFirma = await pdf.embedPng(Buffer.from(base64, "base64"));
      const relacion = imagenFirma.width / imagenFirma.height;
      const relleno = 10; // margen interno para que la firma no toque el borde de la caja
      let w = ancho - relleno * 2;
      let h = w / relacion;
      if (h > alto - relleno * 2) {
        h = alto - relleno * 2;
        w = h * relacion;
      }
      const imgX = x + (ancho - w) / 2;
      const imgY = yTope - alto + (alto - h) / 2;
      pagina.drawImage(imagenFirma, { x: imgX, y: imgY, width: w, height: h });
    } catch {
      // Si por algo la firma no se puede leer, la caja se queda en blanco.
    }
  }

  // ---- Encabezado ----
  linea("CREDIPRESTA $$", { negrita: true, tamano: 14, centrado: true, espacio: 19 });
  linea("PAGARÉ", { negrita: true, tamano: 23, centrado: true, espacio: 15 });
  linea("SIN PROTESTO", { tamano: 9, cursiva: true, centrado: true, espacio: 12 });
  lineaH(MARGEN, y, ANCHO_PAGINA - MARGEN, 1.2);
  y -= 16;

  // ---- No. de folio (izq.) y Fecha (der.), en la misma línea ----
  pagina.drawText(`No. ${datos.folio}`, { x: MARGEN, y, size: 10, font: fontBold, color: NEGRO });
  const textoFecha = `Fecha: ${formatoFecha(datos.fechaFirma)}`;
  pagina.drawText(textoFecha, {
    x: ANCHO_PAGINA - MARGEN - anchoDeTexto(textoFecha, 10),
    y,
    size: 10,
    font: fontRegular,
    color: NEGRO,
  });
  y -= 28;

  // ---- "Bueno por": el monto destacado, como en un formato bancario ----
  const ALTO_BUENO_POR = 48;
  caja(MARGEN, y, ANCHO_TEXTO, ALTO_BUENO_POR, { relleno: true });
  const etiquetaBuenoPor = "BUENO POR";
  pagina.drawText(etiquetaBuenoPor, {
    x: centrarX(etiquetaBuenoPor, 8, fontBold),
    y: y - 15,
    size: 8,
    font: fontBold,
    color: GRIS,
  });
  const montoTexto = formatoMoneda(datos.montoPrestado);
  pagina.drawText(montoTexto, {
    x: centrarX(montoTexto, 19, fontBold),
    y: y - 37,
    size: 19,
    font: fontBold,
    color: NEGRO,
  });
  y -= ALTO_BUENO_POR + 16;

  // ---- Tabla 2x2: Lugar / Cantidad $ / Pagos diarios $ / Interés moratorio ----
  const ALTO_FILA = 38;
  const ALTO_TABLA = ALTO_FILA * 2;
  const ANCHO_COL = ANCHO_TEXTO / 2;
  caja(MARGEN, y, ANCHO_TEXTO, ALTO_TABLA);
  lineaV(MARGEN + ANCHO_COL, y, y - ALTO_TABLA);
  lineaH(MARGEN, y - ALTO_FILA, MARGEN + ANCHO_TEXTO);

  celda("Lugar", datos.lugar || "—", MARGEN, y);
  celda("Cantidad $", formatoMoneda(datos.montoPrestado), MARGEN + ANCHO_COL, y);
  celda("Pagos diarios $", formatoMoneda(datos.montoCuotaDiaria), MARGEN, y - ALTO_FILA);
  celda("Interés moratorio % diario", `${datos.interesMoratorioDiarioPorcentaje ?? 0}%`, MARGEN + ANCHO_COL, y - ALTO_FILA);
  y -= ALTO_TABLA + 16;

  // ---- Vencimiento: fila destacada de ancho completo ----
  const ALTO_VENCIMIENTO = 30;
  caja(MARGEN, y, ANCHO_TEXTO, ALTO_VENCIMIENTO, { relleno: true });
  const textoVencimiento = `VENCIMIENTO:   ${formatoFecha(datos.fechaFin)}`;
  pagina.drawText(textoVencimiento, {
    x: centrarX(textoVencimiento, 11, fontBold),
    y: y - 20,
    size: 11,
    font: fontBold,
    color: NEGRO,
  });
  y -= ALTO_VENCIMIENTO + 20;

  // ---- Datos del obligado suscriptor ----
  linea("DATOS DEL OBLIGADO SUSCRIPTOR", { negrita: true, tamano: 9, espacio: 15 });
  linea("NOMBRE", { negrita: true, tamano: 7.5, espacio: 12, color: GRIS });
  linea(datos.nombreCliente, { negrita: true, tamano: 11, espacio: 8 });
  lineaH(MARGEN, y, ANCHO_PAGINA - MARGEN, 0.75);
  y -= 20;

  // ---- Texto legal ----
  parrafo(
    `El suscrito se obliga a pagar la cantidad señalada en este PAGARÉ, en los términos y plazos aquí ` +
      `establecidos, comprometiéndose a realizar los pagos diarios indicados. En caso de incumplimiento de uno o ` +
      `más pagos, se tendrá por vencida anticipadamente la totalidad de la obligación, exigiéndose el pago ` +
      `inmediato del saldo pendiente, además del interés moratorio diario y los gastos de cobranza que se generen.`,
    9
  );
  parrafo(
    `Este pagaré se rige conforme a lo dispuesto por el Artículo 170 de la Ley General de Títulos y Operaciones ` +
      `de Crédito y demás relativos. En caso de incumplimiento se procederá conforme a la legislación mercantil ` +
      `vigente.`,
    9
  );
  y -= 6;

  // ---- Firmas: cliente (suscriptor) y cobrador (aval), lado a lado ----
  const ESPACIO_ENTRE_FIRMAS = 30;
  const ANCHO_FIRMA = (ANCHO_TEXTO - ESPACIO_ENTRE_FIRMAS) / 2;
  const X_FIRMA_CLIENTE = MARGEN;
  const X_FIRMA_COBRADOR = MARGEN + ANCHO_FIRMA + ESPACIO_ENTRE_FIRMAS;
  const ALTO_CAJA_FIRMA = 85;

  pagina.drawText("FIRMA DEL SUSCRIPTOR", { x: X_FIRMA_CLIENTE, y, size: 9, font: fontBold, color: NEGRO });
  pagina.drawText("FIRMA AVAL", { x: X_FIRMA_COBRADOR, y, size: 9, font: fontBold, color: NEGRO });
  y -= 12;

  caja(X_FIRMA_CLIENTE, y, ANCHO_FIRMA, ALTO_CAJA_FIRMA);
  caja(X_FIRMA_COBRADOR, y, ANCHO_FIRMA, ALTO_CAJA_FIRMA);
  await dibujarFirmaEnCaja(datos.firmaClienteDataUrl, X_FIRMA_CLIENTE, y, ANCHO_FIRMA, ALTO_CAJA_FIRMA);
  await dibujarFirmaEnCaja(datos.firmaCobradorDataUrl, X_FIRMA_COBRADOR, y, ANCHO_FIRMA, ALTO_CAJA_FIRMA);
  y -= ALTO_CAJA_FIRMA + 14;

  // Ancho un poco menor que la caja de la firma, para que quede aire a los
  // lados aunque el nombre sea largo (se reduce el tamaño de letra si aun
  // así no cabe, en vez de salirse de la columna).
  textoCentradoAjustado(datos.nombreCliente, X_FIRMA_CLIENTE, y, ANCHO_FIRMA - 6);
  textoCentradoAjustado(datos.nombreCobrador, X_FIRMA_COBRADOR, y, ANCHO_FIRMA - 6);
  lineaH(X_FIRMA_CLIENTE, y - 4, X_FIRMA_CLIENTE + ANCHO_FIRMA, 0.75, NEGRO);
  lineaH(X_FIRMA_COBRADOR, y - 4, X_FIRMA_COBRADOR + ANCHO_FIRMA, 0.75, NEGRO);
  return pdf.save();
}
