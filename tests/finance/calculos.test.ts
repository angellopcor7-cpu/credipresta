import { describe, it, expect } from "vitest";
import {
  calcularInteres,
  calcularMontoTotal,
  calcularSaldo,
  calcularCuotaSugerida,
  calcularMontoMora,
  esDiaDeCobro,
  generarCalendarioPagos,
  validarMontoPago,
} from "../../src/lib/finance/calculos";

describe("interés y total", () => {
  it("calcula 20% de interés sobre $1,000", () => {
    expect(calcularInteres(1000, 20)).toBe(200);
  });

  it("calcula el total a pagar de $1,000 + 20%", () => {
    expect(calcularMontoTotal(1000, 20)).toBe(1200);
  });

  it("calcula 20% de interés sobre $4,000", () => {
    expect(calcularInteres(4000, 20)).toBe(800);
    expect(calcularMontoTotal(4000, 20)).toBe(4800);
  });
});

describe("saldo (ejemplo exacto del negocio)", () => {
  it("préstamo $1,000 -> total $1,200 -> abono $200 -> saldo $1,000 -> abono $300 -> saldo $700", () => {
    const total = calcularMontoTotal(1000, 20);
    expect(total).toBe(1200);

    let saldo = calcularSaldo(total, [200]);
    expect(saldo).toBe(1000);

    saldo = calcularSaldo(total, [200, 300]);
    expect(saldo).toBe(700);
  });

  it("el saldo nunca queda negativo, aunque se sobrepague", () => {
    const total = calcularMontoTotal(1000, 20);
    const saldo = calcularSaldo(total, [1200, 500]);
    expect(saldo).toBe(0);
  });
});

describe("validación de pagos", () => {
  it("rechaza un pago mayor al saldo pendiente", () => {
    const resultado = validarMontoPago(500, 300);
    expect(resultado.valido).toBe(false);
  });

  it("acepta un pago igual al saldo pendiente (liquida)", () => {
    const resultado = validarMontoPago(300, 300);
    expect(resultado.valido).toBe(true);
  });

  it("rechaza montos en cero o negativos", () => {
    expect(validarMontoPago(0, 300).valido).toBe(false);
    expect(validarMontoPago(-10, 300).valido).toBe(false);
  });
});

describe("cuota sugerida", () => {
  it("divide el total entre el plazo en días", () => {
    expect(calcularCuotaSugerida(1200, 24)).toBe(50);
  });
});

describe("mora", () => {
  const regla = { umbral: 5000, moraBaja: 50, moraAlta: 100 };

  it("aplica mora baja si el saldo es menor al umbral", () => {
    expect(calcularMontoMora(4999, regla)).toBe(50);
  });

  it("aplica mora alta si el saldo es igual o mayor al umbral", () => {
    expect(calcularMontoMora(5000, regla)).toBe(100);
    expect(calcularMontoMora(9000, regla)).toBe(100);
  });
});

describe("días de cobro según monto del préstamo", () => {
  const regla = {
    umbral: 5000,
    diasMenorUmbral: [1, 2, 3, 4, 5, 6], // lunes-sábado
    diasMayorIgualUmbral: [1, 2, 3, 4, 5], // lunes-viernes
  };

  it("un préstamo menor a $5,000 SÍ cobra en sábado", () => {
    const sabado = new Date("2026-09-05T00:00:00Z"); // sábado
    expect(esDiaDeCobro(sabado, 3000, regla)).toBe(true);
  });

  it("un préstamo menor a $5,000 NO cobra en domingo", () => {
    const domingo = new Date("2026-09-06T00:00:00Z"); // domingo
    expect(esDiaDeCobro(domingo, 3000, regla)).toBe(false);
  });

  it("un préstamo de $5,000 o más NO cobra en sábado ni domingo", () => {
    const sabado = new Date("2026-09-05T00:00:00Z");
    const domingo = new Date("2026-09-06T00:00:00Z");
    expect(esDiaDeCobro(sabado, 5000, regla)).toBe(false);
    expect(esDiaDeCobro(domingo, 5000, regla)).toBe(false);
  });

  it("ambos cobran entre semana", () => {
    const martes = new Date("2026-09-08T00:00:00Z");
    expect(esDiaDeCobro(martes, 3000, regla)).toBe(true);
    expect(esDiaDeCobro(martes, 9000, regla)).toBe(true);
  });
});

describe("generación del calendario de pagos", () => {
  const regla = {
    umbral: 5000,
    diasMenorUmbral: [1, 2, 3, 4, 5, 6],
    diasMayorIgualUmbral: [1, 2, 3, 4, 5],
  };

  it("genera exactamente `plazoDias` fechas, todas válidas para el monto", () => {
    const dias = generarCalendarioPagos({
      fechaInicio: new Date("2026-09-01T00:00:00Z"), // martes
      plazoDias: 10,
      montoPrestamo: 6000, // >= 5000: solo lunes-viernes
      montoCuota: 50,
      regla,
    });

    expect(dias).toHaveLength(10);
    dias.forEach((d) => {
      const fecha = new Date(d.fechaProgramada + "T00:00:00Z");
      const diaSemana = fecha.getUTCDay();
      expect(diaSemana).not.toBe(0); // domingo
      expect(diaSemana).not.toBe(6); // sábado
    });
  });

  it("un préstamo menor a $5,000 sí incluye sábados en el calendario", () => {
    const dias = generarCalendarioPagos({
      fechaInicio: new Date("2026-09-01T00:00:00Z"),
      plazoDias: 10,
      montoPrestamo: 1000,
      montoCuota: 50,
      regla,
    });

    const incluyeSabado = dias.some((d) => new Date(d.fechaProgramada + "T00:00:00Z").getUTCDay() === 6);
    expect(incluyeSabado).toBe(true);
    dias.forEach((d) => {
      expect(new Date(d.fechaProgramada + "T00:00:00Z").getUTCDay()).not.toBe(0);
    });
  });

  it("los números de día son consecutivos del 1 al plazo", () => {
    const dias = generarCalendarioPagos({
      fechaInicio: new Date("2026-09-01T00:00:00Z"),
      plazoDias: 5,
      montoPrestamo: 1000,
      montoCuota: 50,
      regla,
    });
    expect(dias.map((d) => d.numeroDia)).toEqual([1, 2, 3, 4, 5]);
  });
});
