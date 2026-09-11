import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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

/** Genera el PDF del pagaré (tamaño carta) con los datos de un préstamo ya llenados en la plantilla. */
export async function generarPagarePDF(datos: DatosPagare): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Pagaré ${datos.folio}`);
  const pagina = pdf.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = ALTO_PAGINA - MARGEN;

  function linea(
    texto: string,
    opciones: { negrita?: boolean; tamano?: number; espacio?: number; centrado?: boolean } = {}
  ) {
    const font = opciones.negrita ? fontBold : fontRegular;
    const tamano = opciones.tamano ?? 11;
    const x = opciones.centrado ? (ANCHO_PAGINA - font.widthOfTextAtSize(texto, tamano)) / 2 : MARGEN;
    pagina.drawText(texto, { x, y, size: tamano, font, color: rgb(0.05, 0.05, 0.08) });
    y -= opciones.espacio ?? tamano + 8;
  }

  function parrafo(texto: string, tamano = 11) {
    const palabras = texto.split(" ");
    let renglon = "";
    for (const palabra of palabras) {
      const prueba = renglon ? `${renglon} ${palabra}` : palabra;
      if (fontRegular.widthOfTextAtSize(prueba, tamano) > ANCHO_TEXTO) {
        linea(renglon, { tamano });
        renglon = palabra;
      } else {
        renglon = prueba;
      }
    }
    if (renglon) linea(renglon, { tamano });
    y -= 8;
  }

  async function dibujarFirma(dataUrl: string | null | undefined): Promise<boolean> {
    if (!dataUrl?.startsWith("data:image/png;base64,")) return false;
    try {
      const base64 = dataUrl.split(",")[1] ?? "";
      const imagenFirma = await pdf.embedPng(Buffer.from(base64, "base64"));
      const anchoFirma = 130;
      const altoFirma = (imagenFirma.height / imagenFirma.width) * anchoFirma;
      // El tope de la imagen empieza justo debajo del renglón anterior (la
      // etiqueta "Firma del Suscriptor"/"Firma Aval"), nunca encima de él.
      const yTope = y;
      pagina.drawImage(imagenFirma, { x: MARGEN, y: yTope - altoFirma, width: anchoFirma, height: altoFirma });
      y = yTope - altoFirma - 4;
      return true;
    } catch {
      // Si por algo la firma no se puede leer, simplemente se deja la línea en blanco.
      return false;
    }
  }

  linea("CREDIPRESTA $$", { negrita: true, tamano: 13, centrado: true, espacio: 17 });
  linea("PAGARÉ", { negrita: true, tamano: 20, centrado: true, espacio: 12 });
  linea("SIN PROTESTO", { tamano: 9, centrado: true, espacio: 24 });

  // Campos tal cual el formato físico que ya usa el negocio: Bueno por, No.,
  // Fecha, Lugar, Cantidad, Pagos diarios, Interés moratorio, Vencimiento.
  linea(`Bueno por: ${formatoMoneda(datos.montoPrestado)}`, { tamano: 10, espacio: 15 });
  linea(`No.: ${datos.folio}`, { tamano: 10, espacio: 15 });
  linea(`Fecha: ${formatoFecha(datos.fechaFirma)}`, { tamano: 10, espacio: 15 });
  linea(`Lugar: ${datos.lugar || "—"}`, { tamano: 10, espacio: 15 });
  linea(`Cantidad $: ${formatoMoneda(datos.montoPrestado)}`, { tamano: 10, espacio: 15 });
  linea(`Pagos diarios $: ${formatoMoneda(datos.montoCuotaDiaria)}`, { tamano: 10, espacio: 15 });
  linea(`Interés moratorio % diario: ${datos.interesMoratorioDiarioPorcentaje ?? 0}%`, { tamano: 10, espacio: 15 });
  linea(`Vencimiento: ${formatoFecha(datos.fechaFin)}`, { tamano: 10, espacio: 18 });

  linea("DATOS DEL OBLIGADO SUSCRIPTOR:", { negrita: true, tamano: 10, espacio: 14 });
  linea(`Nombre: ${datos.nombreCliente}`, { tamano: 10, espacio: 18 });

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

  linea("Firma del Suscriptor", { tamano: 9, negrita: true, espacio: 6 });
  await dibujarFirma(datos.firmaClienteDataUrl);
  linea("_______________________________", { espacio: 13 });
  linea(datos.nombreCliente, { tamano: 9, espacio: 20 });

  linea("Firma Aval", { tamano: 9, negrita: true, espacio: 6 });
  await dibujarFirma(datos.firmaCobradorDataUrl);
  linea("_______________________________", { espacio: 13 });
  linea(datos.nombreCobrador, { tamano: 9, espacio: 20 });

  parrafo("El presente documento es un PAGARÉ y constituye título de crédito. Copia para control de CREDIPRESTA $$.", 7.5);
  parrafo(
    "Documento generado automáticamente a partir de los datos del préstamo. Se recomienda revisión legal antes " +
      "de su uso formal.",
    7.5
  );

  return pdf.save();
}
