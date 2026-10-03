import { describe, expect, it } from "vitest";
import { claveSemana, semanaMasDelta, domingoDe, estaEnSemana, formatoRangoSemana } from "../../src/lib/fechas";

describe("claveSemana", () => {
  it("devuelve el lunes de la semana para cualquier día de esa semana", () => {
    // Semana del lunes 2026-09-28 al domingo 2026-10-04.
    expect(claveSemana("2026-09-28")).toBe("2026-09-28"); // lunes
    expect(claveSemana("2026-09-30")).toBe("2026-09-28"); // miércoles
    expect(claveSemana("2026-10-04")).toBe("2026-09-28"); // domingo
  });

  it("funciona igual con un timestamptz que con una fecha simple", () => {
    expect(claveSemana("2026-09-30T23:50:00+00:00")).toBe(claveSemana("2026-09-30"));
  });
});

describe("domingoDe / semanaMasDelta", () => {
  it("el domingo de una semana es el lunes + 6 días", () => {
    expect(domingoDe("2026-09-28")).toBe("2026-10-04");
  });

  it("semanaMasDelta avanza o retrocede semanas completas", () => {
    expect(semanaMasDelta("2026-09-28", 1)).toBe("2026-10-05");
    expect(semanaMasDelta("2026-09-28", -1)).toBe("2026-09-21");
    expect(semanaMasDelta("2026-09-28", 0)).toBe("2026-09-28");
  });
});

describe("estaEnSemana", () => {
  it("es true para cualquier día dentro del rango lunes-domingo", () => {
    expect(estaEnSemana("2026-09-28", "2026-09-28")).toBe(true);
    expect(estaEnSemana("2026-10-01", "2026-09-28")).toBe(true);
    expect(estaEnSemana("2026-10-04", "2026-09-28")).toBe(true);
  });

  it("es false para fechas fuera del rango", () => {
    expect(estaEnSemana("2026-09-27", "2026-09-28")).toBe(false);
    expect(estaEnSemana("2026-10-05", "2026-09-28")).toBe(false);
  });

  it("funciona con timestamptz (ej. prestamos.created_at)", () => {
    expect(estaEnSemana("2026-10-01T03:00:00+00:00", "2026-09-28")).toBe(true);
  });
});

describe("formatoRangoSemana", () => {
  it("arma un rango legible lunes-domingo", () => {
    expect(formatoRangoSemana("2026-09-28")).toBe("28 - 4 oct 2026");
  });
});
