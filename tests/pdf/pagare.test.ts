import { describe, expect, it } from "vitest";
import { generarPagarePDF } from "../../src/lib/pdf/pagare";

const datosBase = {
  folio: "ABC12345",
  nombreCliente: "Juana Pérez López",
  montoPrestado: 5000,
  porcentajeInteres: 20,
  montoTotal: 6000,
  montoCuotaDiaria: 300,
  plazoDias: 20,
  fechaInicio: new Date("2026-09-01T00:00:00Z"),
  fechaFin: new Date("2026-09-21T00:00:00Z"),
  fechaFirma: new Date("2026-09-01T00:00:00Z"),
  nombreCobrador: "Administración de CrediPresta",
};

describe("generarPagarePDF", () => {
  it("genera un PDF válido (encabezado %PDF)", async () => {
    const bytes = await generarPagarePDF(datosBase);
    const encabezado = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(encabezado).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(500);
  });

  it("no truena con un nombre muy largo (fuerza el ajuste de línea)", async () => {
    const bytes = await generarPagarePDF({
      ...datosBase,
      nombreCliente: "María Fernanda de los Ángeles Rodríguez Hernández Martínez de la Cruz",
    });
    expect(bytes.length).toBeGreaterThan(500);
  });

  it("no truena con montos y plazos distintos", async () => {
    const bytes = await generarPagarePDF({
      ...datosBase,
      montoPrestado: 15000,
      porcentajeInteres: 45,
      montoTotal: 21750,
      montoCuotaDiaria: 483.33,
      plazoDias: 45,
    });
    expect(bytes.length).toBeGreaterThan(500);
  });

  it("incluye la firma del cliente cuando se le pasa una imagen válida", async () => {
    const firmaPngValida =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const bytes = await generarPagarePDF({ ...datosBase, firmaClienteDataUrl: firmaPngValida });
    const encabezado = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(encabezado).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(500);
  });

  it("no truena si la firma viene corrupta (deja la línea en blanco)", async () => {
    const bytes = await generarPagarePDF({
      ...datosBase,
      firmaClienteDataUrl: "data:image/png;base64,esto-no-es-un-png-valido",
    });
    expect(bytes.length).toBeGreaterThan(500);
  });
});
