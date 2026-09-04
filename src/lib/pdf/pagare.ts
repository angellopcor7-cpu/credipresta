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
  /** Data URL "data:image/png;base64,..." de la firma que el cliente dibujó en su portal, si ya firmó. */
  firmaClienteDataUrl?: string | null;
};

function formatoFecha(d: Date): string {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(
    d
  );
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

  linea("PAGARÉ", { negrita: true, tamano: 22, centrado: true, espacio: 34 });
  linea(`Folio: ${datos.folio}`, { tamano: 9, espacio: 20 });
  linea(`Lugar y fecha de firma: ${formatoFecha(datos.fechaFirma)}`, { espacio: 26 });

  parrafo(
    `Por medio del presente título de crédito, yo, ${datos.nombreCliente}, declaro haber recibido de ` +
      `CrediPresta un préstamo por la cantidad de ${formatoMoneda(datos.montoPrestado)} (moneda nacional), y ` +
      `me obligo incondicionalmente a pagar a su orden la cantidad total de ${formatoMoneda(datos.montoTotal)}, ` +
      `que incluye un interés del ${datos.porcentajeInteres}% sobre el monto prestado.`
  );

  parrafo(
    `El pago se realizará en un plazo de ${datos.plazoDias} días, mediante abonos diarios sugeridos de ` +
      `${formatoMoneda(datos.montoCuotaDiaria)}, iniciando el ${formatoFecha(datos.fechaInicio)} y concluyendo ` +
      `el ${formatoFecha(datos.fechaFin)}.`
  );

  parrafo(
    `En caso de atraso en cualquiera de los pagos, acepto el cargo de los recargos por mora vigentes de ` +
      `CrediPresta, sin que esto implique novación de esta obligación.`
  );

  parrafo(`Cobrador(a) responsable de esta cuenta: ${datos.nombreCobrador}.`);

  y -= 50;

  if (datos.firmaClienteDataUrl?.startsWith("data:image/png;base64,")) {
    try {
      const base64 = datos.firmaClienteDataUrl.split(",")[1] ?? "";
      const imagenFirma = await pdf.embedPng(Buffer.from(base64, "base64"));
      const anchoFirma = 180;
      const altoFirma = (imagenFirma.height / imagenFirma.width) * anchoFirma;
      pagina.drawImage(imagenFirma, { x: MARGEN, y: y - altoFirma + 10, width: anchoFirma, height: altoFirma });
      y -= altoFirma - 4;
    } catch {
      // Si por algo la firma no se puede leer, simplemente se deja la línea en blanco.
    }
  }

  linea("_______________________________", { espacio: 16 });
  linea("Firma del cliente", { tamano: 9, espacio: 14 });
  linea(datos.nombreCliente, { tamano: 9, espacio: 40 });

  linea("_______________________________", { espacio: 16 });
  linea("Firma por CrediPresta", { tamano: 9 });

  y -= 30;
  parrafo(
    "Documento generado automáticamente a partir de los datos del préstamo. Se recomienda revisión legal antes " +
      "de su uso formal.",
    8
  );

  return pdf.save();
}
